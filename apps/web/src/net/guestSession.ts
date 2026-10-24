// The guest of an online match (NC 7.1): it sends intents and renders what the host sends, nothing more. It
// checks every view against its hash and its sequence number and asks for a full snapshot on any gap
// (NC 7.9); it reconnects with its seat token and is resynced from its last hashes (NC 7.11); it runs its own
// reaction-prompt timeout (A2-30); and it keeps its army and placements sealed on this machine until the host
// has committed to its own, recording what it needs to audit the host after the game (R37).

import {
  canonicalJson,
  createGame,
  hashJson,
  projectView,
  validateIntent,
  verifySecret,
  type ArmyList,
  type Intent,
  type PlayerView,
  type VisibleEvent,
} from '@coinduel/engine'
import type { ConnectionStatus, DispatchResult, LobbyOperations, OpponentPresence } from '../contracts'
import { OneShot, type Clock, type TimerHandle } from './clock'
import { DISPATCH_TIMEOUT_MS, MAX_PENDING_IDS, REJOIN_BACKOFF_MS, RESYNC_RETRY_MS } from './constants'
import { checkDraftIntent, EMPTY_DRAFT, overlayDraft, prunePlacements, publicArmy, revealIntents, type GuestDraft } from './draft'
import type { SessionEnvironment } from './environment'
import { EMPTY_FAIRNESS, verifyAudit, type AuditVerdict, type FairnessRecord } from './fairness'
import { cleanName, decodeHostMessage } from './guards'
import { LinkMonitor } from './heartbeat'
import type { NetSettings } from './ice'
import { invitationProof, roomCode, type Invite } from './invite'
import {
  wire,
  type AuditBody,
  type DeliveryBody,
  type LockPhase,
  type MetaWire,
  type RejectMessage,
  type ResyncReason,
  type SnapshotReason,
  type WelcomeMessage,
} from './messages'
import { answerReaction, lobbyOperations, logFinishedMatch, presence, refused, takebackOperations } from './operations'
import { newNonce, newShortId, type RandomSource } from './random'
import { RoomConnection } from './roomConnection'
import { SeatFeed, type SessionUpdate } from './seatFeed'
import { saveGuestJoin, type GuestJoinSave, type KeyValueStore } from './storage'
import { TransportError, type PeerId, type TransportFactory, type TransportProblem } from './transport'
import type { TurnClockView } from './turnClock'
import type { FairnessView, NetSession, NetTakebackOperations, RoomInfo, SessionProblem, SessionProblemKind } from './types'
import { versionMismatch, type Versions } from './versions'

export interface GuestOptions {
  readonly invite: Invite
  readonly name: string
  readonly saved: GuestJoinSave | null
  readonly net: NetSettings
  readonly transport: TransportFactory
  readonly clock: Clock
  readonly random: RandomSource
  readonly storage: KeyValueStore
  readonly environment: SessionEnvironment
  readonly versions: Versions
}

interface Pending {
  readonly resolve: (result: DispatchResult) => void
  readonly timer: TimerHandle
  /** Which welcome it was sent under; older ones unanswered after a reconnect were never received. */
  readonly connection: number
}

const MAX_HASH_FAILURES = 3
const LOCK_PHASES: readonly LockPhase[] = ['army', 'deploy']
const TIMED_OUT: DispatchResult = { ok: false, code: 'TIMEOUT', message: 'The host did not answer in time' }

const REJECT_KIND: Readonly<Record<RejectMessage['b']['reason'], SessionProblemKind>> = {
  version: 'version',
  full: 'room-full',
  'bad-invite': 'bad-invite',
}

function placeholderView(name: string): PlayerView {
  return projectView(createGame({ seed: 'placeholder', names: { host: 'Host', guest: name } }), 'guest')
}

export class GuestSession implements NetSession {
  readonly mode = 'guest'
  readonly seat = 'guest'
  readonly room: RoomInfo
  readonly lobby: LobbyOperations
  readonly takeback: NetTakebackOperations
  readonly fairness: FairnessView
  private readonly name: string
  private readonly feed: SeatFeed
  private readonly link: LinkMonitor
  private readonly roomLink: RoomConnection
  private readonly proof: string
  private readonly unwatch: () => void
  private readonly pending = new Map<string, Pending>()
  private readonly hashes = new Map<number, { readonly viewHash: string; readonly stateHash: string }>()
  private readonly resyncTimer: OneShot
  private readonly rejoinTimer: OneShot
  private hostPeer: PeerId | null = null
  private connectionId = 0
  private seatToken: string | null
  private hostName: string | null = null
  private hostHidden = false
  private stopped = false
  private closed = false
  private haveView = false
  private awaiting = false
  private hashFailures = 0
  private rejoinAttempt = 0
  private lastSeq: number | null = null
  private epochValue = 0
  private lastHashes: { readonly view: string; readonly state: string } | null = null
  private meta: MetaWire | null = null
  private draft: GuestDraft
  private exposed: PlayerView
  private clockView: TurnClockView | null = null
  private takebackDeadline: number | null = null
  private flushing: Record<LockPhase, boolean> = { army: false, deploy: false }
  /** The commitment the host refused a reveal against: it changed since, so the reveal waits for the new one. */
  private failedAgainst: Record<LockPhase, string | null> = { army: null, deploy: null }
  /** The reveal in progress, retried under the same call id after a lost link so the host never applies it twice. */
  private reveals: Record<LockPhase, { readonly payload: string; readonly id: string } | null> = { army: null, deploy: null }
  private publicArmyInFlight = false
  private fairnessRecord: Omit<FairnessRecord, 'hashes'> = EMPTY_FAIRNESS
  private coinRevealed: { readonly round: number; readonly nonce: string; readonly commit: string } | null = null
  /** The guest's own Ready dropped since its last coin nonce: a new coin round is then expected. */
  private readyBroke = false
  /** Coin rounds the host replaced after the guest's nonce was sent while the guest stayed ready (R37). */
  private coinRestarts = 0
  private notes: readonly string[] = []
  private noteKeys: readonly string[] = []
  private audit: AuditBody | null = null
  private verdictValue: AuditVerdict | null = null
  private problemValue: SessionProblem | null = null
  private presenceView: OpponentPresence

  constructor(private readonly options: GuestOptions) {
    this.name = cleanName(options.name, 'Guest')
    this.seatToken = options.saved?.seatToken ?? null
    this.draft = { ...EMPTY_DRAFT, army: options.saved?.army ?? null, placements: options.saved?.placements ?? {} }
    this.proof = invitationProof(options.invite)
    this.room = { roomId: options.invite.roomId, code: roomCode(options.invite.roomId), inviteLink: null }
    this.feed = new SeatFeed('guest', placeholderView(this.name), options.clock, (decisionId, choice) => {
      void this.dispatch({ kind: 'respondDecision', decisionId, choice })
    })
    this.exposed = this.feed.view
    this.link = new LinkMonitor(options.clock, (n, t) => this.send(wire('ping', { n, t, waiting: [] })), () => this.onLinkChange())
    this.resyncTimer = new OneShot(options.clock)
    this.rejoinTimer = new OneShot(options.clock)
    this.presenceView = presence(false, null, 'away')
    const dispatch = (intent: Intent): Promise<DispatchResult> => this.dispatch(intent)
    this.lobby = lobbyOperations(dispatch, () => null)
    this.takeback = takebackOperations(dispatch, () => this.exposed, () => this.takebackDeadline)
    const self = this
    this.fairness = {
      get notes() {
        return self.notes
      },
      get auditReady() {
        return self.audit !== null
      },
      get verdict() {
        return self.verdictValue
      },
      verify: () => {
        if (self.audit === null) return null
        const hashes: Record<string, { readonly viewHash: string; readonly stateHash: string }> = {}
        for (const [length, entry] of self.hashes) hashes[String(length)] = entry
        self.verdictValue = verifyAudit(self.audit, { ...self.fairnessRecord, hashes })
        self.notify()
        return self.verdictValue
      },
    }
    this.roomLink = new RoomConnection({ appId: options.net.appId, roomId: options.invite.roomId, secret: options.invite.secret }, options.net, options.transport, {
      onMessage: (peer, text) => this.onMessage(peer, text),
      onPeerJoin: (peer) => {
        if (this.hostPeer === null && !this.stopped) this.sendHello(peer)
      },
      onPeerLeave: (peer) => {
        if (peer === this.hostPeer) this.hostGone()
      },
      onProblem: (problem) => this.onTransportProblem(problem),
      onConnectError: (error) => this.onConnectError(error),
    })
    this.unwatch = options.environment.watchVisibility((hidden) => this.send(wire('presence', { state: hidden ? 'hidden' : 'active' })))
    this.persist()
    this.roomLink.open()
  }

  // ---------------------------------------------------------------- Session

  get phase(): PlayerView['phase'] {
    return this.exposed.phase
  }
  get view(): PlayerView {
    return this.exposed
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
  get connection(): ConnectionStatus {
    return this.link.status
  }
  get opponent(): OpponentPresence {
    return this.presenceView
  }
  get synced(): boolean {
    return this.haveView
  }
  get clock(): TurnClockView | null {
    return this.clockView
  }
  get rttMs(): number | null {
    return this.link.rttMs
  }
  get problem(): SessionProblem | null {
    return this.problemValue
  }
  get updateSeq(): number {
    return this.feed.updateSeq
  }
  get history(): readonly SessionUpdate[] {
    return this.feed.history
  }

  dispatch(intent: Intent): Promise<DispatchResult> {
    if (this.closed) return refused('NOT_CONNECTED', 'You left the game')
    if (!this.haveView) return refused('NOT_CONNECTED', 'Still connecting to the host')
    switch (intent.kind) {
      case 'setArmy':
        return this.chooseArmy(intent.army)
      case 'setReady':
        return this.lockArmy(intent.ready)
      case 'deploy':
      case 'undeploy':
        return this.place(intent)
      case 'confirmDeployment':
        return this.lockDeployment(intent.confirmed)
      case 'startDeployment':
        return refused('NOT_HOST', 'The host starts the match')
      default:
        return this.sendIntent(intent)
    }
  }

  respondToReaction(choice: string): Promise<DispatchResult> {
    return answerReaction((intent) => this.dispatch(intent), this.exposed, choice)
  }

  rematch(): Promise<DispatchResult> {
    return refused('NOT_HOST', 'The host starts a rematch')
  }

  subscribe(listener: () => void): () => void {
    return this.feed.subscribe(listener)
  }

  close(): void {
    if (this.closed) return
    this.send(wire('bye', { reason: 'leave' }))
    this.closed = true
    this.roomLink.close()
    this.link.stop()
    this.resyncTimer.cancel()
    this.rejoinTimer.cancel()
    this.unwatch()
    this.settle(() => true, 'You left the game')
    this.feed.dispose()
  }

  // ---------------------------------------------------------------- sealed submissions (R37)

  /** The army stays here; the host gets its public part (R16: commander and variant) at once. */
  private chooseArmy(army: ArmyList): Promise<DispatchResult> {
    const check = validateIntent(this.exposed, { kind: 'setArmy', army })
    if (!check.ok) return Promise.resolve(check)
    const wasLocked = this.draft.lock.army
    this.draft = { ...this.draft, army, lock: { ...this.draft.lock, army: false } }
    this.failedAgainst.army = null
    if (wasLocked) this.send(wire('lock', { phase: 'army', locked: false }))
    this.persist()
    this.afterChange()
    return Promise.resolve({ ok: true })
  }

  /** Ready = sealed: revealed to the host only once it has committed to its own army. */
  private lockArmy(ready: boolean): Promise<DispatchResult> {
    const raw = this.feed.view
    if (raw.phase !== 'lobby') return refused('WRONG_PHASE', `Not during ${raw.phase}`)
    if (!ready) {
      if (this.draft.lock.army) {
        this.draft = { ...this.draft, lock: { ...this.draft.lock, army: false } }
        this.send(wire('lock', { phase: 'army', locked: false }))
        this.afterChange()
        return Promise.resolve({ ok: true })
      }
      return raw.lobby.ready.guest ? this.sendIntent({ kind: 'setReady', ready: false }) : Promise.resolve({ ok: true })
    }
    if (raw.lobby.ready.guest || this.draft.lock.army) return Promise.resolve({ ok: true })
    if (this.draft.army === null) return refused('NOT_READY', 'Choose an army first')
    const check = validateIntent(this.exposed, { kind: 'setReady', ready: true })
    if (!check.ok) return Promise.resolve(check)
    // The host already holds this exact army (revealed before): nothing is sealed any more.
    if (this.hostHoldsRealArmy()) return this.sendIntent({ kind: 'setReady', ready: true })
    this.draft = { ...this.draft, lock: { ...this.draft.lock, army: true } }
    this.failedAgainst.army = null
    this.send(wire('lock', { phase: 'army', locked: true }))
    this.afterChange()
    return Promise.resolve({ ok: true })
  }

  private place(intent: Extract<Intent, { readonly kind: 'deploy' | 'undeploy' }>): Promise<DispatchResult> {
    const check = checkDraftIntent(this.feed.view, this.draft, intent)
    if (!check.ok) return Promise.resolve(check)
    const placements = { ...this.draft.placements }
    if (intent.kind === 'deploy') placements[intent.unitId] = intent.anchor
    else delete placements[intent.unitId]
    const wasLocked = this.draft.lock.deploy
    this.draft = { ...this.draft, placements, lock: { ...this.draft.lock, deploy: false } } // placing withdraws Confirm
    this.failedAgainst.deploy = null
    if (wasLocked) this.send(wire('lock', { phase: 'deploy', locked: false }))
    this.persist()
    this.afterChange()
    return Promise.resolve({ ok: true })
  }

  private lockDeployment(confirmed: boolean): Promise<DispatchResult> {
    const raw = this.feed.view
    if (!confirmed) {
      if (this.draft.lock.deploy) {
        this.draft = { ...this.draft, lock: { ...this.draft.lock, deploy: false } }
        this.send(wire('lock', { phase: 'deploy', locked: false }))
        this.afterChange()
        return Promise.resolve({ ok: true })
      }
      return raw.deploymentConfirmed.guest ? this.sendIntent({ kind: 'confirmDeployment', confirmed: false }) : Promise.resolve({ ok: true })
    }
    const check = checkDraftIntent(raw, this.draft, { kind: 'confirmDeployment', confirmed: true })
    if (!check.ok) return Promise.resolve(check)
    if (this.draft.lock.deploy) return Promise.resolve({ ok: true })
    this.draft = { ...this.draft, lock: { ...this.draft.lock, deploy: true } }
    this.failedAgainst.deploy = null
    this.send(wire('lock', { phase: 'deploy', locked: true }))
    this.afterChange()
    return Promise.resolve({ ok: true })
  }

  private hostHoldsRealArmy(): boolean {
    const held = this.feed.view.myArmy
    return held !== null && this.draft.army !== null && canonicalJson(held) === canonicalJson(this.draft.army)
  }

  /** Keeps the host's copy of our army at the public part of the draft (or at the revealed army). */
  private syncPublicArmy(): void {
    const raw = this.feed.view
    const army = this.draft.army
    if (raw.phase !== 'lobby' || army === null || this.publicArmyInFlight || !this.canSend() || this.hostHoldsRealArmy()) return
    const placeholder = publicArmy(army)
    if (raw.myArmy !== null && canonicalJson(raw.myArmy) === canonicalJson(placeholder)) return
    this.publicArmyInFlight = true
    void this.sendIntent({ kind: 'setArmy', army: placeholder }).then(() => {
      this.publicArmyInFlight = false
      this.syncPublicArmy() // the army may have changed again meanwhile
    })
  }

  private tryReveal(phase: LockPhase): void {
    const commit = this.meta?.commits[phase] ?? null
    const raw = this.feed.view
    if (!this.draft.lock[phase] || this.flushing[phase] || !this.canSend() || commit === null || commit === this.failedAgainst[phase]) return
    if (phase === 'army' ? raw.phase !== 'lobby' : raw.phase !== 'deployment') return
    const intents = revealIntents(phase, this.draft)
    if (intents === null) return
    // R37: from this message on the host holds the sealed data, whatever it answers; the audit holds it to this commitment.
    if (this.fairnessRecord.sentAgainst[phase] === null) {
      this.fairnessRecord = { ...this.fairnessRecord, sentAgainst: { ...this.fairnessRecord.sentAgainst, [phase]: commit } }
    }
    const payload = `${commit}|${canonicalJson(intents)}`
    const retry = this.reveals[phase]
    const id = retry !== null && retry.payload === payload ? retry.id : newShortId(this.options.random)
    this.reveals[phase] = { payload, id }
    this.flushing[phase] = true
    void this.call((callId) => wire('reveal', { id: callId, phase, against: commit, intents }), id).then((result) => {
      this.flushing[phase] = false
      if (result.ok) {
        this.draft = { ...this.draft, lock: { ...this.draft.lock, [phase]: false } }
        this.fairnessRecord = { ...this.fairnessRecord, revealedAgainst: { ...this.fairnessRecord.revealedAgainst, [phase]: commit } }
        this.reveals[phase] = null
      } else if (result.code !== 'NOT_CONNECTED' && result.code !== 'TIMEOUT') {
        // Refused, so it waits for a new commitment. NOT_AVAILABLE: the host's commitment changed meanwhile, yet the
        // host has seen the sealed data now.
        this.failedAgainst[phase] = commit
        this.reveals[phase] = null
        if (result.code === 'NOT_AVAILABLE') {
          this.note(`The host changed its ${phase === 'army' ? 'army' : 'deployment'} after yours was sent to it; the post-game check compares it with the one it had locked`)
        }
      }
      // A lost link (NOT_CONNECTED, TIMEOUT) leaves it to be sent again, under the same id, once the link is back.
      this.afterChange()
    })
  }

  /** R37 coin flip: answer the host's commitment with a fresh nonce, then check the host's nonce against it. */
  private handleCoin(): void {
    const coin = this.meta?.coin ?? null
    if (coin === null) return
    const mine = this.coinRevealed
    if (coin.hostNonce === null) {
      if (this.feed.view.phase !== 'lobby' || !this.canSend()) return
      if (mine !== null && mine.round === coin.round) return
      if (mine !== null && !this.readyBroke) {
        this.coinRestarts += 1
        const times = this.coinRestarts === 1 ? 'once' : `${this.coinRestarts} times`
        this.note(`The host restarted the coin flip after your nonce was sent, while you stayed ready (${times})`, 'coin-restart')
      }
      const nonce = newNonce(this.options.random)
      this.coinRevealed = { round: coin.round, nonce, commit: coin.commit }
      this.readyBroke = false
      this.send(wire('coinReveal', { round: coin.round, nonce }))
      return
    }
    if (mine === null || mine.round !== coin.round || this.fairnessRecord.coin !== null) return
    if (coin.commit !== mine.commit || !verifySecret(mine.commit, coin.hostNonce)) this.note("The host's coin nonce does not match its commitment")
    this.fairnessRecord = { ...this.fairnessRecord, coin: { commit: mine.commit, hostNonce: coin.hostNonce, guestNonce: mine.nonce } }
  }

  /** After a reconnect the host may never have received our nonce: send the same one again. */
  private resendCoinNonce(): void {
    const coin = this.meta?.coin ?? null
    const mine = this.coinRevealed
    if (coin !== null && coin.hostNonce === null && mine !== null && mine.round === coin.round) {
      this.send(wire('coinReveal', { round: mine.round, nonce: mine.nonce }))
    }
  }

  /** The draft follows the phase; lock flags are re-sent after a reconnect. */
  private reconcileDraft(events: readonly VisibleEvent[]): void {
    const raw = this.feed.view
    let draft = this.draft
    if (raw.phase !== 'lobby' && draft.lock.army) draft = { ...draft, lock: { ...draft.lock, army: false } }
    if (raw.phase === 'deployment') draft = { ...draft, placements: prunePlacements(raw, draft.placements) }
    else if (draft.lock.deploy || Object.keys(draft.placements).length > 0) draft = { ...draft, placements: {}, lock: { ...draft.lock, deploy: false } }
    if (raw.phase === 'lobby' && draft.lock.army && events.some((e) => e.type === 'settingsChanged')) {
      draft = { ...draft, lock: { ...draft.lock, army: false } } // new settings un-ready both seats
      this.send(wire('lock', { phase: 'army', locked: false }))
    }
    if (this.fairnessRecord.revealedAgainst.army !== null && raw.phase === 'lobby' && events.some((e) => e.type === 'armyChosen' && e.seat === 'host')) {
      this.note('The host picked its army again after yours was revealed to it; the post-game check will show whether it changed')
    }
    // Only the guest's own Ready dropping excuses a new coin round; the host toggling its own does not (R37).
    if (raw.phase === 'lobby' && !raw.lobby.ready.guest) this.readyBroke = true
    this.draft = draft
  }

  // ---------------------------------------------------------------- inbound

  private onMessage(peer: PeerId, text: string): void {
    if (this.closed || this.stopped) return
    const decoded = decodeHostMessage(text)
    if (!decoded.ok) {
      if (decoded.reason === 'version') this.fail('version', 'The host runs a different version of the game. Both of you should reload the page.')
      return
    }
    const message = decoded.message
    if (this.hostPeer === null) {
      // Until a host welcomes us, only its answer to our hello matters.
      if (message.t === 'welcome') this.onWelcome(peer, message.b)
      else if (message.t === 'reject') this.fail(REJECT_KIND[message.b.reason], message.b.message)
      return
    }
    if (peer !== this.hostPeer) return
    this.link.heard()
    switch (message.t) {
      case 'welcome':
        this.onWelcome(peer, message.b)
        return
      case 'reject':
        this.fail(REJECT_KIND[message.b.reason], message.b.message)
        return
      case 'snapshot':
        this.onSnapshot(message.b)
        return
      case 'update':
        this.onUpdate(message.b)
        return
      case 'synced':
        this.onSynced(message.b.seq, message.b.epoch, message.b.meta)
        return
      case 'meta':
        this.applyMeta(message.b.meta)
        this.feed.setDecisionWindow(message.b.meta.decisionMs)
        this.afterChange()
        return
      case 'result':
        this.finish(message.b.id, message.b.result)
        return
      case 'audit':
        this.audit = message.b
        this.notify()
        return
      case 'ping':
        for (const id of message.b.waiting) this.hold(id)
        this.send(wire('pong', message.b))
        return
      case 'pong':
        this.link.pong(message.b.t)
        return
      case 'presence':
        this.hostHidden = message.b.state === 'hidden'
        this.refresh()
        this.notify()
        return
      case 'bye':
        this.hostGone()
        return
      default: {
        const unhandled: never = message
        return unhandled
      }
    }
  }

  private sendHello(peer: PeerId): void {
    this.roomLink.send(
      peer,
      wire('hello', {
        versions: this.options.versions,
        name: this.name,
        proof: this.proof,
        seatToken: this.seatToken,
        lastSeq: this.haveView ? this.lastSeq : null,
        viewHash: this.lastHashes?.view ?? null,
        stateHash: this.lastHashes?.state ?? null,
        pending: [...this.pending.keys()].slice(0, MAX_PENDING_IDS),
      }),
    )
  }

  private onWelcome(peer: PeerId, body: WelcomeMessage['b']): void {
    const mismatch = versionMismatch(this.options.versions, body.versions, 'host')
    if (mismatch !== null) return this.fail('version', mismatch)
    if (body.roomId !== this.room.roomId) return
    this.hostPeer = peer
    this.seatToken = body.seatToken
    this.hostName = cleanName(body.hostName, 'Host')
    this.connectionId += 1
    for (const id of body.stillPending) this.hold(id) // NC 7.8: queued at the host, not lost with the old link
    this.awaiting = true
    this.resyncTimer.start(RESYNC_RETRY_MS, () => this.retrySync('gap')) // the snapshot may be lost too
    this.rejoinTimer.cancel()
    this.rejoinAttempt = 0
    if (this.problemValue?.kind === 'transport') this.problemValue = null
    this.link.up()
    this.send(wire('presence', { state: this.options.environment.isHidden() ? 'hidden' : 'active' }))
    this.persist()
    this.refresh()
    this.notify()
  }

  private onSnapshot(body: DeliveryBody & { readonly why: SnapshotReason }): void {
    if (body.view.seat !== 'guest' || hashJson(body.view) !== body.viewHash) {
      this.hashFailed()
      return
    }
    this.resyncTimer.cancel()
    this.awaiting = false
    if (body.why === 'reset') this.onReset(body.meta.seedCommit)
    this.accept(body, body.why)
    this.settle((p) => p.connection < this.connectionId, 'Your last action was not sent')
    this.resendLocks()
    this.resendCoinNonce()
    this.afterChange()
  }

  private onUpdate(body: DeliveryBody): void {
    if (this.awaiting) return
    if (body.epoch !== this.epochValue) return this.requestResync('epoch')
    if (this.lastSeq === null || body.seq !== this.lastSeq + 1) return this.requestResync('gap')
    if (body.view.seat !== 'guest' || hashJson(body.view) !== body.viewHash) return this.hashFailed()
    this.accept(body, 'update')
    this.afterChange()
  }

  private onSynced(seq: number, epoch: number, meta: MetaWire): void {
    this.resyncTimer.cancel()
    this.awaiting = false
    this.lastSeq = seq
    this.epochValue = epoch
    this.applyMeta(meta)
    this.feed.setDecisionWindow(meta.decisionMs)
    this.settle((p) => p.connection < this.connectionId, 'Your last action was not sent')
    this.resendLocks()
    this.resendCoinNonce()
    this.afterChange()
  }

  private accept(body: DeliveryBody, why: SnapshotReason | 'update'): void {
    this.haveView = true
    this.hashFailures = 0
    this.lastSeq = body.seq
    this.epochValue = body.epoch
    this.lastHashes = { view: body.viewHash, state: body.stateHash }
    this.hashes.set(body.logLength, { viewHash: body.viewHash, stateHash: body.stateHash })
    this.applyMeta(body.meta)
    this.feed.deliver({ why, events: body.events, view: body.view, decisionMs: body.meta.decisionMs })
    this.reconcileDraft(body.events)
    logFinishedMatch(this.options.storage, `guest-${this.room.roomId}-${body.meta.seedCommit}`, 'guest', 'guest', body.view, body.events, this.options.clock.now())
  }

  private applyMeta(meta: MetaWire): void {
    const now = this.options.clock.now()
    this.meta = meta
    if (this.fairnessRecord.seedCommit === null) this.fairnessRecord = { ...this.fairnessRecord, seedCommit: meta.seedCommit }
    else if (this.fairnessRecord.seedCommit !== meta.seedCommit && this.feed.view.phase !== 'lobby') this.note('The host changed the game seed during the match')
    this.clockView = meta.clock === null ? null : { ...meta.clock, at: now }
    this.takebackDeadline = meta.takebackMs === null ? null : now + meta.takebackMs
  }

  /**
   * A new timeline from the host. Only a real new match (a new seed, or after the game ended) starts a fresh record to
   * audit. The lobby rebuilt with this guest's name keeps its commitments and drops only the hashes of the old
   * timeline; a reset during the deployment or the battle keeps everything, for the audit to compare.
   */
  private onReset(seedCommit: string): void {
    const recorded = this.fairnessRecord.seedCommit
    const phase = this.feed.view.phase
    if (recorded === null || seedCommit !== recorded || phase === 'ended') this.newGame()
    else if (phase === 'lobby') this.hashes.clear()
    else this.note('The host restarted the game record during the match')
  }

  /** A rematch: a fresh record to audit; the chosen army stays as a convenience. */
  private newGame(): void {
    this.hashes.clear()
    this.fairnessRecord = EMPTY_FAIRNESS
    this.coinRevealed = null
    this.readyBroke = false
    this.coinRestarts = 0
    this.audit = null
    this.verdictValue = null
    this.notes = []
    this.noteKeys = []
    this.failedAgainst = { army: null, deploy: null }
    this.reveals = { army: null, deploy: null }
    this.draft = { ...EMPTY_DRAFT, army: this.draft.army }
  }

  private resendLocks(): void {
    for (const phase of LOCK_PHASES) if (this.draft.lock[phase]) this.send(wire('lock', { phase, locked: true }))
  }

  private hashFailed(): void {
    this.hashFailures += 1
    if (this.hashFailures > MAX_HASH_FAILURES) {
      this.problemValue = { kind: 'desync', message: 'The game state from the host keeps arriving damaged. Reload the page to reconnect.' }
      this.awaiting = true
      this.notify()
      return
    }
    this.requestResync('hash')
  }

  private requestResync(reason: ResyncReason): void {
    if (this.hostPeer === null || (this.awaiting && this.resyncTimer.active)) return
    this.awaiting = true
    this.send(wire('resync', { reason }))
    this.resyncTimer.start(RESYNC_RETRY_MS, () => this.retrySync(reason))
  }

  /** Still no snapshot: ask (again). */
  private retrySync(reason: ResyncReason): void {
    if (!this.awaiting || this.hostPeer === null) return
    this.awaiting = false
    this.requestResync(reason)
  }

  private hostGone(): void {
    if (this.hostPeer === null) return
    this.hostPeer = null
    this.hostHidden = false
    this.awaiting = false
    this.resyncTimer.cancel()
    this.link.down()
    this.scheduleRejoin()
    this.refresh()
    this.notify()
  }

  /** NC 7.5: while the host is away, rejoin the signalling room with backoff (1, 2, 4 ... 30 s). */
  private scheduleRejoin(): void {
    if (this.stopped || this.closed) return
    const delays = REJOIN_BACKOFF_MS
    const delay = delays[Math.min(this.rejoinAttempt, delays.length - 1)] ?? 30_000
    this.rejoinAttempt += 1
    this.rejoinTimer.start(delay, () => {
      if (this.hostPeer !== null || this.stopped || this.closed) return
      this.roomLink.open()
      this.scheduleRejoin()
    })
  }

  private onLinkChange(): void {
    if (this.link.status === 'lost' && this.hostPeer !== null) {
      this.hostGone()
      return
    }
    this.refresh()
    this.notify()
  }

  private onTransportProblem(problem: TransportProblem): void {
    if (problem.kind === 'send-failed') return
    this.problemValue = { kind: 'transport', message: `Could not connect to the host directly (${problem.detail}). A TURN relay may be needed.` }
    this.notify()
  }

  private onConnectError(error: unknown): void {
    if (error instanceof TransportError && error.kind === 'insecure-context') {
      this.fail('insecure-context', error.message)
      return
    }
    this.problemValue = { kind: 'transport', message: error instanceof Error ? error.message : 'Could not open the room' }
    this.notify()
    this.scheduleRejoin()
  }

  /** A refusal (version, full room, bad invite) or an unusable page: stop trying and say why. */
  private fail(kind: SessionProblemKind, message: string): void {
    this.problemValue = { kind, message }
    this.stopped = true
    this.hostPeer = null
    this.rejoinTimer.cancel()
    this.resyncTimer.cancel()
    this.roomLink.close()
    this.link.down()
    this.settle(() => true, message)
    this.refresh()
    this.notify()
  }

  // ---------------------------------------------------------------- outbound

  private canSend(): boolean {
    return !this.closed && !this.stopped && this.hostPeer !== null && this.haveView && !this.awaiting
  }

  private send(text: string): void {
    if (this.hostPeer !== null && !this.closed) this.roomLink.send(this.hostPeer, text)
  }

  private sendIntent(intent: Intent): Promise<DispatchResult> {
    if (!this.canSend()) return refused('NOT_CONNECTED', this.hostPeer === null ? 'Not connected to the host' : 'Reconnecting to the host')
    const check = validateIntent(this.exposed, intent)
    if (!check.ok) return Promise.resolve(check)
    return this.call((id) => wire('intent', { id, epoch: this.epochValue, intent }))
  }

  /** Sends a request that the host answers with a result message; resolves with that result. */
  private call(message: (id: string) => string, id: string = newShortId(this.options.random)): Promise<DispatchResult> {
    if (!this.canSend()) return refused('NOT_CONNECTED', 'Not connected to the host')
    return new Promise((resolve) => {
      const timer = this.options.clock.setTimeout(() => this.finish(id, TIMED_OUT), DISPATCH_TIMEOUT_MS)
      this.pending.set(id, { resolve, timer, connection: this.connectionId })
      this.send(message(id))
    })
  }

  /** The host still holds this intent (queued behind a prompt, 2.11): it stays pending, under the current link. */
  private hold(id: string): void {
    const entry = this.pending.get(id)
    if (entry === undefined) return
    this.options.clock.clearTimeout(entry.timer)
    const timer = this.options.clock.setTimeout(() => this.finish(id, TIMED_OUT), DISPATCH_TIMEOUT_MS)
    this.pending.set(id, { ...entry, timer, connection: this.connectionId })
  }

  private finish(id: string, result: DispatchResult): void {
    const entry = this.pending.get(id)
    if (entry === undefined) return
    this.pending.delete(id)
    this.options.clock.clearTimeout(entry.timer)
    entry.resolve(result)
  }

  private settle(which: (pending: Pending) => boolean, message: string): void {
    for (const [id, entry] of [...this.pending]) if (which(entry)) this.finish(id, { ok: false, code: 'NOT_CONNECTED', message })
  }

  // ---------------------------------------------------------------- derived state

  private afterChange(): void {
    this.syncPublicArmy()
    this.handleCoin()
    for (const phase of LOCK_PHASES) this.tryReveal(phase)
    this.refresh()
    this.notify()
  }

  private refresh(): void {
    this.exposed = overlayDraft(this.feed.view, this.draft)
    const joined = this.hostName !== null
    const activity = this.hostPeer === null ? 'away' : this.hostHidden ? 'hidden' : 'active'
    const current = this.presenceView
    if (current.joined !== joined || current.name !== this.hostName || current.activity !== activity) {
      this.presenceView = presence(joined, this.hostName, activity)
    }
  }

  /** Adds a fairness note, or updates the one with the same key (a count that grows). */
  private note(text: string, key: string = text): void {
    const index = this.noteKeys.indexOf(key)
    if (index < 0) {
      this.notes = [...this.notes, text]
      this.noteKeys = [...this.noteKeys, key]
    } else if (this.notes[index] !== text) {
      this.notes = this.notes.map((n, i) => (i === index ? text : n))
    }
  }

  private persist(): void {
    saveGuestJoin(this.options.storage, {
      roomId: this.room.roomId,
      secret: this.options.invite.secret,
      name: this.name,
      seatToken: this.seatToken,
      army: this.draft.army,
      placements: this.draft.placements,
    })
  }

  private notify(): void {
    this.feed.notify()
  }
}
