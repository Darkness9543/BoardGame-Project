// The sandbox (hot-seat) session: both seats in one browser, the authority in memory, and a seat switcher. Each
// seat still receives only its own projection and filtered events, so the UI stays honest about the fog even
// here; only `debugRecord()` shows the truth. Used for development, tests and solo rule checking. The R29 turn
// timer is off unless the settings switch it on; the coin flip uses fresh local nonces (no opponent to cheat).

import {
  combineSecrets,
  createGame,
  SEATS,
  startRecord,
  type Intent,
  type MatchRecord,
  type PlayerView,
  type Seat,
  type VisibleEvent,
} from '@coinduel/engine'
import type { ConnectionStatus, DispatchResult, LobbyOperations, OpponentPresence } from '../contracts'
import { MatchAuthority, other, type SeatDelivery } from './authority'
import { systemClock, type Clock } from './clock'
import { verifyOwnRecord, type AuditVerdict } from './fairness'
import { answerReaction, lobbyOperations, logFinishedMatch, presence, refused, takebackOperations } from './operations'
import { cryptoRandom, newNonce, newSeed, type RandomSource } from './random'
import { SeatFeed, type SessionUpdate } from './seatFeed'
import { browserStore, type KeyValueStore } from './storage'
import type { TurnClockView } from './turnClock'
import type { FairnessView, LocalSession, LocalSessionConfig, NetSession, NetTakebackOperations, RoomInfo, SessionProblem } from './types'

const DEFAULT_NAMES: Readonly<Record<Seat, string>> = { host: 'Player 1', guest: 'Player 2' }

/** One seat of the sandbox: everything the UI reads for that seat, nothing of the other's. */
class LocalEndpoint implements NetSession {
  readonly mode = 'local'
  readonly synced = true
  readonly room: RoomInfo | null = null
  readonly rttMs: number | null = null
  readonly problem: SessionProblem | null = null
  readonly connection: ConnectionStatus = 'connected'
  readonly feed: SeatFeed
  readonly lobby: LobbyOperations
  readonly takeback: NetTakebackOperations
  readonly fairness: FairnessView
  private clockView: TurnClockView | null = null
  private opponentView: OpponentPresence

  constructor(
    private readonly owner: LocalSessionImpl,
    readonly seat: Seat,
    view: PlayerView,
    clock: Clock,
  ) {
    this.feed = new SeatFeed(seat, view, clock, (decisionId, choice) => {
      void this.dispatch({ kind: 'respondDecision', decisionId, choice })
    })
    const dispatch = (intent: Intent): Promise<DispatchResult> => this.dispatch(intent)
    this.lobby = lobbyOperations(dispatch, () => null)
    this.takeback = takebackOperations(dispatch, () => this.feed.view, () => owner.takebackDeadline())
    this.fairness = owner.fairness
    this.opponentView = presence(true, view.names[other(seat)], 'active')
  }

  get phase(): PlayerView['phase'] {
    return this.feed.view.phase
  }
  get view(): PlayerView {
    return this.feed.view
  }
  get events(): readonly VisibleEvent[] {
    return this.feed.events
  }
  get pendingReaction(): PlayerView['decision'] {
    return this.feed.pendingReaction
  }
  get reactionDeadline(): number | null {
    return this.feed.reactionDeadline
  }
  get updateSeq(): number {
    return this.feed.updateSeq
  }
  get history(): readonly SessionUpdate[] {
    return this.feed.history
  }
  get clock(): TurnClockView | null {
    return this.clockView
  }
  get opponent(): OpponentPresence {
    return this.opponentView
  }

  dispatch(intent: Intent): Promise<DispatchResult> {
    return this.owner.dispatchAs(this.seat, intent)
  }
  respondToReaction(choice: string): Promise<DispatchResult> {
    return answerReaction((intent) => this.dispatch(intent), this.feed.view, choice)
  }
  rematch(): Promise<DispatchResult> {
    return this.owner.rematch()
  }
  close(): void {
    this.owner.close()
  }
  subscribe(listener: () => void): () => void {
    return this.feed.subscribe(listener)
  }

  receive(delivery: SeatDelivery, decisionMs: number | null): void {
    this.feed.deliver({ why: delivery.why, events: delivery.events, view: delivery.view, decisionMs })
  }

  refresh(clockView: TurnClockView | null): void {
    this.clockView = clockView
    const name = this.feed.view.names[other(this.seat)]
    if (this.opponentView.name !== name) this.opponentView = presence(true, name, 'active')
  }
}

export class LocalSessionImpl implements LocalSession {
  readonly mode = 'local'
  readonly fairness: FairnessView
  private readonly authority: MatchAuthority
  private readonly endpoints: Record<Seat, LocalEndpoint>
  private readonly listeners = new Set<() => void>()
  private readonly clockSource: Clock
  private readonly random: RandomSource
  private readonly store: KeyValueStore
  private readonly coinSeed: string | null
  private current: Seat
  private follow: boolean
  private flipping = false
  private closed = false
  private lastVerdict: AuditVerdict | null = null

  constructor(config: LocalSessionConfig) {
    this.clockSource = config.clock ?? systemClock
    this.random = config.random ?? cryptoRandom
    this.store = config.storage ?? browserStore()
    this.coinSeed = config.coinSeed ?? null
    this.current = config.startSeat ?? 'host'
    this.follow = config.followTurn ?? true
    const record =
      config.record ??
      startRecord(
        createGame({
          seed: config.seed ?? newSeed(this.random),
          settings: { turnTimerSeconds: null, timeBankSeconds: null, ...config.settings },
          names: { ...DEFAULT_NAMES, ...config.names },
        }),
      )
    const self = this
    this.fairness = {
      notes: [],
      get auditReady() {
        return self.authority.state.phase === 'ended'
      },
      get verdict() {
        return self.lastVerdict
      },
      verify: () => {
        self.lastVerdict = verifyOwnRecord(self.authority.record)
        self.notify()
        return self.lastVerdict
      },
    }
    this.authority = new MatchAuthority(record, this.clockSource, {
      deliver: (seat, delivery) => this.deliver(seat, delivery),
      changed: () => this.changed(),
    })
    this.endpoints = {
      host: new LocalEndpoint(this, 'host', this.authority.view('host'), this.clockSource),
      guest: new LocalEndpoint(this, 'guest', this.authority.view('guest'), this.clockSource),
    }
    this.changed()
  }

  private get active(): LocalEndpoint {
    return this.endpoints[this.current]
  }

  get seat(): Seat {
    return this.current
  }
  get phase(): PlayerView['phase'] {
    return this.active.phase
  }
  get view(): PlayerView {
    return this.active.view
  }
  get events(): readonly VisibleEvent[] {
    return this.active.events
  }
  get lobby(): LobbyOperations {
    return this.active.lobby
  }
  get takeback(): NetTakebackOperations {
    return this.active.takeback
  }
  get connection(): ConnectionStatus {
    return 'connected'
  }
  get opponent(): OpponentPresence {
    return this.active.opponent
  }
  get pendingReaction(): PlayerView['decision'] {
    return this.active.pendingReaction
  }
  get reactionDeadline(): number | null {
    return this.active.reactionDeadline
  }
  get synced(): boolean {
    return true
  }
  get clock(): TurnClockView | null {
    return this.active.clock
  }
  get room(): RoomInfo | null {
    return null
  }
  get rttMs(): number | null {
    return null
  }
  get problem(): SessionProblem | null {
    return null
  }
  get updateSeq(): number {
    return this.active.updateSeq
  }
  get history(): readonly SessionUpdate[] {
    return this.active.history
  }
  get followTurn(): boolean {
    return this.follow
  }

  dispatch(intent: Intent): Promise<DispatchResult> {
    return this.active.dispatch(intent)
  }

  respondToReaction(choice: string): Promise<DispatchResult> {
    return this.active.respondToReaction(choice)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setSeat(seat: Seat): void {
    if (seat === this.current) return
    this.current = seat
    this.notify()
  }

  setFollowTurn(on: boolean): void {
    this.follow = on
    if (on) this.followSeat()
    this.notify()
  }

  endpoint(seat: Seat): NetSession {
    return this.endpoints[seat]
  }

  debugRecord(): MatchRecord {
    return this.authority.record
  }

  dispatchAs(seat: Seat, intent: Intent): Promise<DispatchResult> {
    if (this.closed) return refused('NOT_CONNECTED', 'The sandbox is closed')
    if (intent.kind === 'startDeployment') return refused('NOT_AVAILABLE', 'The match starts by itself once both players are ready')
    return this.authority.submit(seat, intent)
  }

  takebackDeadline(): number | null {
    return this.authority.takebackDeadline()
  }

  rematch(): Promise<DispatchResult> {
    const state = this.authority.state
    if (state.phase !== 'ended') return refused('NOT_AVAILABLE', 'A rematch starts once the game is over')
    const names = { host: state.seats.host.name, guest: state.seats.guest.name }
    this.authority.replaceRecord(startRecord(createGame({ seed: newSeed(this.random), settings: state.settings, names })))
    this.lastVerdict = null
    return Promise.resolve({ ok: true })
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.authority.dispose()
    for (const seat of SEATS) this.endpoints[seat].feed.dispose()
    this.listeners.clear()
  }

  private deliver(seat: Seat, delivery: SeatDelivery): void {
    this.endpoints[seat].receive(delivery, this.authority.remainingMs(this.authority.decisionDeadline(seat)))
    if (seat === 'host') {
      const state = this.authority.state
      logFinishedMatch(this.store, `local-${state.seed}`, 'local', 'host', delivery.view, delivery.events, this.clockSource.now())
    }
  }

  private changed(): void {
    for (const seat of SEATS) this.endpoints[seat].refresh(this.authority.clockView(seat))
    this.maybeFlipCoin()
    if (this.follow) this.followSeat()
    for (const seat of SEATS) this.endpoints[seat].feed.notify()
    this.notify()
  }

  /** Both seats ready: flip with two fresh nonces and start the deployment (deferred out of the current submit). */
  private maybeFlipCoin(): void {
    const bothReady = (): boolean => this.authority.state.phase === 'lobby' && SEATS.every((s) => this.authority.state.seats[s].ready)
    if (this.flipping || !bothReady()) return
    this.flipping = true
    queueMicrotask(() => {
      this.flipping = false
      if (this.closed || !bothReady()) return
      const coinSeed = this.coinSeed ?? combineSecrets(newNonce(this.random), newNonce(this.random))
      void this.authority.submit('host', { kind: 'startDeployment', coinSeed })
    })
  }

  private followSeat(): void {
    const target = this.seatToFollow()
    if (target !== null) this.current = target
  }

  /**
   * Who must act next, judged from the views: the decider of a prompt, the answerer of a take-back request, the active
   * seat; in the lobby and the deployment, the other seat once the current one is ready or confirmed. Null keeps the seat.
   */
  private seatToFollow(): Seat | null {
    for (const seat of SEATS) if (this.endpoints[seat].view.decision !== null) return seat
    const view = this.endpoints.host.view
    const request = view.takeback.request
    if (request !== null) return other(request.requester)
    switch (view.phase) {
      case 'lobby':
        return this.stillToFinish(view.lobby.ready)
      case 'deployment':
        return this.stillToFinish(view.deploymentConfirmed)
      case 'battle':
        return view.turn?.activeSeat ?? null
      case 'ended':
        return null
    }
  }

  private stillToFinish(done: Readonly<Record<Seat, boolean>>): Seat | null {
    const next = other(this.current)
    return done[this.current] && !done[next] ? next : null
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

export function createLocalSession(config: LocalSessionConfig): LocalSession {
  return new LocalSessionImpl(config)
}
