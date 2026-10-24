// One controller per session: it consumes every update exactly once, whatever the UI has mounted, and derives the
// client-side memory the screens need: the log, copy numbers, last-seen ghosts, achievement scratch, animation
// playback, the opponent's last turn for replay and turn notifications. A rematch (a new lobby in the same session)
// starts that memory afresh. The R29 clock is the session's own (NetSession.clock).

import type { DecisionView, MatchSummary, PlayerView, PreferenceValue, Seat, Square, VisibleEvent } from '@coinduel/engine'
import type { ConnectionStatus, OpponentPresence } from '../contracts'
import type { NetSession } from '../net'
import { forgetScratch, loadScratch, saveScratch, scratchFromView, trackUpdate, useAchievements, type AchievementId, type MatchScratch } from './achievements'
import { EMPTY_GHOSTS, updateGhosts, type GhostMemory } from './ghosts'
import { describeEvents, type LogEntry } from './logText'
import { useMatchLog } from './matchLog'
import { EMPTY_REGISTRY, learnUnits, ownedLabel, sentence, type UnitRegistry } from './naming'
import { PlaybackRunner, buildTimeline, displayView, realScheduler, timingFor, type Beat, type PlaybackSnapshot } from './playback'
import { profileName } from './profile'
import { prefersReducedMotion, useSettings } from './settings'
import { appStore } from './storage'
import { toast, type ToastTone } from './toasts'

export interface UpdateFrame {
  readonly before: PlayerView
  readonly events: readonly VisibleEvent[]
  readonly after: PlayerView
}

export interface TurnBanner {
  readonly text: string
  readonly mine: boolean
  readonly at: number
}

export interface MatchSnapshot {
  readonly version: number
  readonly seat: Seat
  /** The truth (the latest view). */
  readonly view: PlayerView
  /** What the board draws while animations play. */
  readonly display: PlayerView
  readonly connection: ConnectionStatus
  readonly opponent: OpponentPresence
  readonly names: Readonly<Record<Seat, string>>
  readonly reaction: DecisionView | null
  readonly reactionDeadline: number | null
  readonly log: readonly LogEntry[]
  readonly registry: UnitRegistry
  readonly ghosts: GhostMemory
  readonly playback: PlaybackSnapshot
  readonly replaying: boolean
  /** The opponent's last turn can be replayed (UX 19.6). */
  readonly canReplay: boolean
  /** When the current take-back request was first seen (for its countdown). */
  readonly takebackSeenAt: number | null
  readonly banner: TurnBanner | null
  /** The AP each seat had when its current or last turn started (the AP widget's full pip row). */
  readonly turnStartAp: Readonly<Record<Seat, number>>
  readonly summary: MatchSummary | null
  readonly unlocked: readonly AchievementId[]
}

export interface ControllerOptions {
  readonly roomId: string
  readonly sandbox: boolean
}

const ACTION_TYPES: ReadonlySet<VisibleEvent['type']> = new Set(['unitMoved', 'unitAttacked', 'abilityUsed', 'defendChanged', 'attackMissed', 'turnEnded'])

type MatchMemory = Pick<MatchSnapshot, 'log' | 'registry' | 'ghosts' | 'canReplay' | 'banner' | 'turnStartAp' | 'summary' | 'unlocked'>

/** The part of a snapshot that belongs to one match, as it is when the match begins. */
function freshMemory(view: PlayerView): MatchMemory {
  const ap = (seat: Seat): number => Math.max(view.apPool, seat === view.seat ? view.myAp : (view.opponentAp ?? 0))
  return {
    log: [],
    registry: learnUnits(EMPTY_REGISTRY, view),
    ghosts: EMPTY_GHOSTS,
    canReplay: false,
    banner: null,
    turnStartAp: { host: ap('host'), guest: ap('guest') },
    summary: null,
    unlocked: [],
  }
}

export class MatchController {
  private snapshotValue: MatchSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly runner: PlaybackRunner
  private readonly unsubscribe: () => void
  private lastView: PlayerView
  private lastEvents: readonly VisibleEvent[]
  private scratch: MatchScratch
  private committed = false
  private batch = 0
  private nextEntryId = 1
  private turnFrames: UpdateFrame[] = []
  private lastOpponentTurn: readonly UpdateFrame[] = []
  private replayingValue = false
  private preferenceSent: string | null = null
  private takebackAnswered: number | null = null
  private opponentJoined: boolean
  private foreground = true
  private disposed = false

  constructor(
    readonly session: NetSession,
    readonly options: ControllerOptions,
  ) {
    this.runner = new PlaybackRunner(realScheduler, () => this.onPlayback())
    this.lastView = session.view
    this.lastEvents = session.events
    // A refresh mid-match (NET-04) picks up the saved scratch; without one, the view still tells a hurt commander.
    const saved = options.sandbox ? null : loadScratch(appStore(), options.roomId, session.view)
    this.scratch = saved === null ? scratchFromView(session.seat, !options.sandbox, session.view) : trackUpdate(saved, session.view, [])
    this.opponentJoined = session.opponent.joined
    const view = session.view
    this.snapshotValue = {
      version: 0,
      seat: session.seat,
      view,
      display: view,
      connection: session.connection,
      opponent: session.opponent,
      names: this.namesFor(view, session.opponent),
      reaction: session.pendingReaction,
      reactionDeadline: session.reactionDeadline,
      ...freshMemory(view),
      playback: this.runner.snapshot,
      replaying: false,
      takebackSeenAt: view.takeback.request === null ? null : Date.now(),
    }
    this.unsubscribe = session.subscribe(() => this.onSession())
    this.syncPreference(view)
  }

  get snapshot(): MatchSnapshot {
    return this.snapshotValue
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): MatchSnapshot => this.snapshotValue

  dispose(): void {
    this.disposed = true
    this.unsubscribe()
    this.runner.dispose()
    this.listeners.clear()
  }

  /** The sandbox shows one seat at a time; only that seat's controller speaks up. */
  setForeground(on: boolean): void {
    this.foreground = on
  }

  /**
   * Toasts wait a microtask: in the sandbox the seat on screen can switch in the same update (follow the turn),
   * and the toast must come from the seat the player ends up looking at.
   */
  private say(text: string, tone: ToastTone, squares: readonly Square[] = []): void {
    queueMicrotask(() => {
      if (this.foreground && !this.disposed) toast(text, tone, squares)
    })
  }

  skipPlayback(): void {
    this.runner.skip()
    if (this.replayingValue) {
      this.replayingValue = false
      this.publish({})
    }
  }

  /** UX 19.6: replay the visible events of the opponent's last turn. */
  replayOpponentTurn(): void {
    const frames = this.lastOpponentTurn
    if (frames.length === 0) return
    const timing = this.timing() ?? { step: 150, attack: 300, hit: 220, death: 260 }
    this.runner.skip()
    this.replayingValue = true
    const beats: Beat[] = []
    for (const frame of frames) beats.push(...buildTimeline(frame.before, frame.events, frame.after, timing))
    this.runner.play(beats)
    this.publish({})
  }

  // ---------------------------------------------------------------- internals

  /** A new lobby after a finished match (rematch): forget the old match, keep the session. */
  private startOver(view: PlayerView): void {
    this.runner.skip()
    this.scratch = scratchFromView(this.session.seat, !this.options.sandbox, view)
    this.keepScratch()
    this.committed = false
    this.turnFrames = []
    this.lastOpponentTurn = []
    this.replayingValue = false
    this.preferenceSent = null
    this.takebackAnswered = null
    this.snapshotValue = { ...this.snapshotValue, ...freshMemory(view) }
  }

  private namesFor(view: PlayerView, opponent: OpponentPresence): Readonly<Record<Seat, string>> {
    const other: Seat = view.seat === 'host' ? 'guest' : 'host'
    const names = { ...view.names }
    if (opponent.name !== null && opponent.name !== '') names[other] = opponent.name
    // Online, my own name is my profile's: the record may hold a placeholder for the guest seat (no rename intent).
    if (!this.options.sandbox) names[view.seat] = profileName()
    return names
  }

  private timing(): ReturnType<typeof timingFor> {
    const settings = useSettings.getState().settings
    return timingFor(settings.animationSpeed, prefersReducedMotion(settings.motion))
  }

  private onPlayback(): void {
    const playback = this.runner.snapshot
    if (!playback.playing && this.replayingValue) this.replayingValue = false
    this.publish({ playback })
  }

  private onSession(): void {
    const session = this.session
    const view = session.view
    const events = session.events
    if (view !== this.lastView || events !== this.lastEvents) this.onUpdate(this.lastView, view, events)
    else this.publish({})
    if (session.opponent.joined !== this.opponentJoined) {
      this.opponentJoined = session.opponent.joined
      this.say(session.opponent.joined ? `${session.opponent.name ?? 'Your opponent'} joined` : 'Your opponent left', session.opponent.joined ? 'good' : 'warn')
    }
  }

  private onUpdate(before: PlayerView, view: PlayerView, events: readonly VisibleEvent[]): void {
    this.lastView = view
    this.lastEvents = events
    if (view.phase === 'lobby' && before.phase !== 'lobby') this.startOver(view)
    const snap = this.snapshotValue
    const now = Date.now()
    const names = this.namesFor(view, this.session.opponent)
    const registry = learnUnits(learnUnits(snap.registry, before), view, events)
    this.batch += 1

    // The log; a take-back strikes through the latest action batch (UX 15.2).
    let log = snap.log
    if (events.some((e) => e.type === 'takebackApplied')) {
      const lastAction = [...log].reverse().find((e) => !e.undone && e.category !== 'system')?.batch
      if (lastAction !== undefined) log = log.map((e) => (e.batch === lastAction ? { ...e, undone: true } : e))
    }
    const lines = describeEvents(events, { view, registry, names })
    if (lines.length > 0) {
      const round = view.turn?.round ?? 0
      const turn = view.turn?.number ?? 0
      log = [...log, ...lines.map((l) => ({ ...l, id: this.nextEntryId++, turn, round, batch: this.batch, undone: false }))]
    }

    const ghosts = updateGhosts(snap.ghosts, before, view, events)
    this.scratch = trackUpdate(this.scratch, view, events)
    this.keepScratch()

    // Opponent-turn frames (replay) and turn banners / notifications.
    const opponent: Seat = view.seat === 'host' ? 'guest' : 'host'
    let banner = snap.banner
    let turnStartAp = snap.turnStartAp
    if (view.phase === 'battle' && view.turn?.activeSeat === opponent && events.some((e) => ACTION_TYPES.has(e.type))) {
      this.turnFrames.push({ before, events, after: view })
    }
    for (const [index, e] of events.entries()) {
      if (e.type !== 'turnStarted') continue
      const refill = events.slice(0, index).reverse().find((x) => x.type === 'apChanged' && x.seat === e.seat)
      if (refill?.type === 'apChanged') turnStartAp = { ...turnStartAp, [e.seat]: refill.ap }
      const mine = e.seat === view.seat
      if (mine && this.turnFrames.length > 0) {
        this.lastOpponentTurn = this.turnFrames
        this.turnFrames = []
      }
      if (!mine) this.turnFrames = []
      banner = { text: mine ? `Your turn · Round ${e.round}` : `${names[e.seat]}'s turn · Round ${e.round}`, mine, at: now }
    }

    this.toastsFor(view, events, registry, names)
    let summary = snap.summary
    let unlocked = snap.unlocked
    for (const e of events) {
      if (e.type === 'matchSummary') {
        summary = e.summary
        useMatchLog.getState().refresh() // the session logged it before delivering (R38)
      }
      if (e.type === 'gameEnded' && !this.committed) {
        this.committed = true
        unlocked = useAchievements.getState().commit(this.scratch, e.result, Math.ceil(e.result.turnNumber / 2))
        if (!this.options.sandbox) forgetScratch(appStore(), this.options.roomId, this.session.seat)
      }
    }

    const takebackSeenAt = view.takeback.request === null ? null : (snap.takebackSeenAt ?? now)
    this.publish({ view, names, registry, log, ghosts, banner, turnStartAp, summary, unlocked, takebackSeenAt, canReplay: this.lastOpponentTurn.length > 0 })
    if (events.length > 0 && view.phase !== 'lobby') this.runner.play(buildTimeline(before, events, view, this.timing()))
    this.syncPreference(view)
    this.autoAnswerTakeback(view)
  }

  /** PX 8.6 / UX 8.8: interruptions and reveals of my units get a banner-like toast. */
  private toastsFor(view: PlayerView, events: readonly VisibleEvent[], registry: UnitRegistry, names: Readonly<Record<Seat, string>>): void {
    const me = view.seat
    const mine = (id: string): boolean => registry.units[id]?.owner === me
    for (const e of events) {
      switch (e.type) {
        case 'moveEnded':
          if (!mine(e.unitId)) break
          if (e.reason === 'blocked') this.say(`Blocked! ${sentence(ownedLabel(registry, view, e.unitId))} stopped: something unseen is in the way`, 'warn', [e.at])
          if (e.reason === 'mine') this.say(`Mine! ${sentence(ownedLabel(registry, view, e.unitId))} set off a mine`, 'bad', [e.at])
          if (e.reason === 'reaction') this.say(`Ambushed! ${sentence(ownedLabel(registry, view, e.unitId))} was attacked on the way`, 'bad', [e.at])
          break
        case 'unitRevealed':
          if (mine(e.unitId)) this.say(`${sentence(ownedLabel(registry, view, e.unitId))} was revealed`, 'warn')
          else this.say(`Revealed! ${sentence(ownedLabel(registry, view, e.unitId))}`, 'good')
          break
        case 'settingsChanged':
          if (view.seat !== 'host') this.say(`${names.host} changed the match settings`, 'info')
          break
        case 'takebackDeclined':
          this.say(e.seat === me ? 'Your take-back request was declined' : 'You declined the take-back', e.seat === me ? 'warn' : 'info')
          break
        case 'takebackApplied':
          this.say(e.seat === me ? 'Take-back accepted: your action is undone' : `You undid ${names[e.seat]}'s last action`, 'info')
          break
        case 'drawOffered':
          if (e.seat !== me) this.say(`${names[e.seat]} offers a draw`, 'info')
          break
        case 'buildingCaptured':
          this.say(e.seat === me ? `You captured the ${e.building === 'keep' ? 'Keep' : 'Market'}` : `${names[e.seat]} captured the ${e.building === 'keep' ? 'Keep' : 'Market'}`, e.seat === me ? 'good' : 'warn')
          break
        default:
          break
      }
    }
  }

  /**
   * A2-30: the player's standing answer to revive and Cauldron prompts. Changed while a prompt is open, it waits until
   * that prompt is answered: the engine applies a new preference to the open prompt at once, which would answer it.
   */
  setRevivePreference(value: PreferenceValue): void {
    useSettings.getState().update({ revivePreference: value })
    this.syncPreference(this.session.view)
  }

  /** Saves the scratch of an online match that is under way, for a reload (PX AC). */
  private keepScratch(): void {
    const phase = this.lastView.phase
    if (!this.options.sandbox && !this.committed && (phase === 'deployment' || phase === 'battle')) saveScratch(appStore(), this.options.roomId, this.scratch)
  }

  /** The revive / Cauldron preference (A2-30) lives in the player's options and is sent to the engine. */
  private syncPreference(view: PlayerView): void {
    if (view.phase !== 'deployment' && view.phase !== 'battle') return
    if (view.decision !== null) return // sent once the open prompt is answered (setRevivePreference)
    const wanted = useSettings.getState().settings.revivePreference
    if (view.preferences['revive'] === wanted || this.preferenceSent === wanted) return
    this.preferenceSent = wanted
    void this.session.dispatch({ kind: 'setPreference', key: 'revive', value: wanted })
  }

  private autoAnswerTakeback(view: PlayerView): void {
    const request = view.takeback.request
    if (request === null || request.requester === view.seat || this.takebackAnswered === request.actionSeq) return
    const answer = useSettings.getState().settings.takebackAnswer
    if (answer === 'ask') return
    this.takebackAnswered = request.actionSeq
    void this.session.takeback.respond(answer === 'autoAccept')
  }

  private publish(patch: Partial<MatchSnapshot>): void {
    const session = this.session
    const base = { ...this.snapshotValue, ...patch }
    const playback = patch.playback ?? this.runner.snapshot
    this.snapshotValue = {
      ...base,
      version: this.snapshotValue.version + 1,
      connection: session.connection,
      opponent: session.opponent,
      names: this.namesFor(base.view, session.opponent),
      reaction: session.pendingReaction,
      reactionDeadline: session.reactionDeadline,
      playback,
      display: displayView(base.view, playback.beat),
      replaying: this.replayingValue,
    }
    for (const listener of [...this.listeners]) listener()
  }
}
