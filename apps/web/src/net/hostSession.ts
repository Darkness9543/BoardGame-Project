// The host of an online match (NC 7.1): the lobby creator's browser runs the authority. It admits one guest
// (version handshake, invite proof, seat token), sends it only its own projection (a full snapshot on join,
// resync, take-back and restart; otherwise an update with its filtered events, the new view and the hashes),
// parses every guest message at the trust boundary, runs the commit-reveal coin flip and sealed submissions
// (R37), and sends the audit once the game is over. The host's own UI goes through the same engine checks.

import {
  combineSecrets,
  commitSecret,
  createGame,
  replayRecord,
  SEATS,
  sha256Hex,
  startRecord,
  type Intent,
  type IntentKind,
  type MatchRecord,
  type PlayerView,
  type Seat,
  type VisibleEvent,
} from '@coinduel/engine'
import type { ConnectionStatus, DispatchResult, LobbyOperations, OpponentPresence } from '../contracts'
import { MatchAuthority, type SeatDelivery } from './authority'
import type { Clock } from './clock'
import { MAX_PENDING_IDS, RESULT_CACHE_SIZE, SEAT_TAKEOVER_WHEN_AWAY } from './constants'
import { overlayOpponentLock } from './draft'
import type { SessionEnvironment } from './environment'
import { armyPayload, commitment, placementPayload, seatPlacements, seedCommitment, verifyOwnRecord, type AuditVerdict } from './fairness'
import { cleanName, decodeGuestMessage } from './guards'
import { LinkMonitor } from './heartbeat'
import type { NetSettings } from './ice'
import { invitationProof, inviteLink, roomCode, type Invite } from './invite'
import { wire, type HelloMessage, type IntentMessage, type LockMessage, type LockPhase, type MetaWire, type RejectReason, type RevealMessage, type SnapshotReason } from './messages'
import { answerReaction, lobbyOperations, logFinishedMatch, presence, refused, takebackOperations } from './operations'
import { newNonce, newSeed, newToken, type RandomSource } from './random'
import { RoomConnection } from './roomConnection'
import { SeatFeed, type SessionUpdate } from './seatFeed'
import { saveHostRoom, type KeyValueStore } from './storage'
import { TransportError, type PeerId, type TransportFactory, type TransportProblem } from './transport'
import type { TurnClockView } from './turnClock'
import type { FairnessView, NetSession, NetTakebackOperations, RoomInfo, SessionProblem } from './types'
import { versionMismatch, type Versions } from './versions'

export interface HostOptions {
  readonly invite: Invite
  readonly hostName: string
  readonly record: MatchRecord
  /** The seated guest of a resumed room. */
  readonly guest: { readonly tokenHash: string; readonly name: string } | null
  readonly salts: Readonly<Record<string, string>>
  readonly net: NetSettings
  readonly transport: TransportFactory
  readonly clock: Clock
  readonly random: RandomSource
  readonly storage: KeyValueStore
  readonly environment: SessionEnvironment
  readonly baseUrl: string | null
  readonly versions: Versions
}

interface Commit {
  readonly hash: string
  readonly payload: string
}

interface CoinRound {
  readonly round: number
  readonly nonce: string
  readonly commit: string
  readonly revealed: boolean
}

const REVEALABLE: Readonly<Record<LockPhase, readonly IntentKind[]>> = {
  army: ['setArmy', 'setReady'],
  deploy: ['deploy', 'undeploy', 'confirmDeployment'],
}

const tokenDigest = (token: string): string => sha256Hex(`coinduel-seat|${token}`)

export class HostSession implements NetSession {
  readonly mode = 'host'
  readonly seat = 'host'
  readonly synced = true
  readonly room: RoomInfo
  readonly lobby: LobbyOperations
  readonly takeback: NetTakebackOperations
  readonly fairness: FairnessView
  private readonly authority: MatchAuthority
  private readonly feed: SeatFeed
  private readonly link: LinkMonitor
  private readonly roomLink: RoomConnection
  private readonly proof: string
  private readonly unwatch: () => void
  private readonly results = new Map<string, DispatchResult>()
  private readonly inFlight = new Set<string>()
  private guestPeer: PeerId | null = null
  private welcomed = false
  private guest: { readonly tokenHash: string; readonly name: string } | null
  private guestHidden = false
  private guestLock: Readonly<Record<LockPhase, boolean>> = { army: false, deploy: false }
  private commits: Readonly<Record<LockPhase, Commit | null>> = { army: null, deploy: null }
  private salts: Record<string, string>
  private coin: CoinRound | null = null
  private coinRound = 0
  private seedCommit: string
  private lastMetaKey = ''
  private auditSentTo: PeerId | null = null
  private savedRecord: MatchRecord | null = null
  private exposed: PlayerView
  private clockView: TurnClockView | null = null
  private presenceView: OpponentPresence
  private problemValue: SessionProblem | null = null
  private verdictValue: AuditVerdict | null = null
  private closed = false
  /** Guest messages dropped at the trust boundary (diagnostics). */
  malformed = 0

  constructor(private readonly options: HostOptions) {
    this.guest = options.guest
    this.salts = { ...options.salts }
    this.seedCommit = seedCommitment(options.record.initial.seed)
    this.proof = invitationProof(options.invite)
    const { roomId } = options.invite
    this.room = { roomId, code: roomCode(roomId), inviteLink: options.baseUrl === null ? null : inviteLink(options.baseUrl, options.invite) }
    this.authority = new MatchAuthority(options.record, options.clock, {
      deliver: (seat, delivery) => this.onDelivery(seat, delivery),
      changed: () => this.onChanged(),
    })
    this.feed = new SeatFeed('host', this.authority.view('host'), options.clock, (decisionId, choice) => {
      void this.dispatch({ kind: 'respondDecision', decisionId, choice })
    })
    this.link = new LinkMonitor(options.clock, (n, t) => this.sendGuest(wire('ping', { n, t, waiting: this.waiting() })), () => this.onLinkChange())
    this.exposed = this.feed.view
    this.presenceView = presence(this.guest !== null, this.guest?.name ?? null, 'away')
    const dispatch = (intent: Intent): Promise<DispatchResult> => this.dispatch(intent)
    this.lobby = lobbyOperations(dispatch, () => this.room.inviteLink)
    this.takeback = takebackOperations(dispatch, () => this.exposed, () => this.authority.takebackDeadline())
    const self = this
    this.fairness = {
      notes: [],
      get auditReady() {
        return self.authority.state.phase === 'ended'
      },
      get verdict() {
        return self.verdictValue
      },
      verify: () => {
        self.verdictValue = verifyOwnRecord(self.authority.record)
        self.notify()
        return self.verdictValue
      },
    }
    this.roomLink = new RoomConnection({ appId: options.net.appId, roomId, secret: options.invite.secret }, options.net, options.transport, {
      onMessage: (peer, text) => this.onMessage(peer, text),
      onPeerJoin: () => undefined, // the guest speaks first (hello)
      onPeerLeave: (peer) => {
        if (peer === this.guestPeer) this.guestGone()
      },
      onProblem: (problem) => this.onTransportProblem(problem),
      onConnectError: (error) => this.onConnectError(error),
    })
    this.unwatch = options.environment.watchVisibility((hidden) => this.sendGuest(wire('presence', { state: hidden ? 'hidden' : 'active' })))
    this.authority.setLinkDown(true) // no guest yet: a resumed battle's clock waits for it
    this.persist(true)
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
    if (this.closed) return refused('NOT_CONNECTED', 'The room is closed')
    if (intent.kind === 'startDeployment') return refused('NOT_AVAILABLE', 'The match starts by itself after the coin flip')
    return this.authority.submit('host', intent)
  }

  respondToReaction(choice: string): Promise<DispatchResult> {
    return answerReaction((intent) => this.dispatch(intent), this.feed.view, choice)
  }

  rematch(): Promise<DispatchResult> {
    const state = this.authority.state
    if (state.phase !== 'ended') return refused('NOT_AVAILABLE', 'A rematch starts once the game is over')
    const game = createGame({
      seed: newSeed(this.options.random),
      settings: state.settings,
      names: { host: state.seats.host.name, guest: state.seats.guest.name },
    })
    this.commits = { army: null, deploy: null }
    this.coin = null
    this.salts = {}
    this.guestLock = { army: false, deploy: false }
    this.auditSentTo = null
    this.verdictValue = null
    this.seedCommit = seedCommitment(game.seed)
    this.authority.replaceRecord(startRecord(game))
    return Promise.resolve({ ok: true })
  }

  subscribe(listener: () => void): () => void {
    return this.feed.subscribe(listener)
  }

  /** Spoilers (NC 7.19 #11): the true state, for a dev overlay that is off by default, exports and bug reports. */
  debugRecord(): MatchRecord {
    return this.authority.record
  }

  close(): void {
    if (this.closed) return
    this.sendGuest(wire('bye', { reason: 'leave' }))
    this.closed = true
    this.roomLink.close()
    this.link.stop()
    this.authority.dispose()
    this.unwatch()
    this.feed.dispose()
  }

  // ---------------------------------------------------------------- inbound

  private onMessage(peer: PeerId, text: string): void {
    if (this.closed) return
    const decoded = decodeGuestMessage(text)
    if (!decoded.ok) {
      this.malformed += 1
      if (decoded.reason === 'version') {
        this.refuse(peer, 'version', 'This room runs a different version of the game. Both players should reload the page.')
      }
      return
    }
    const message = decoded.message
    if (message.t === 'hello') {
      this.onHello(peer, message.b)
      return
    }
    if (peer !== this.guestPeer || !this.welcomed) return
    this.link.heard()
    switch (message.t) {
      case 'intent':
        this.onIntent(message.b)
        return
      case 'resync':
        this.sendDelivery(this.authority.snapshot('guest', 'resync'), 'resync')
        return
      case 'lock':
        this.onLock(message.b)
        return
      case 'reveal':
        this.onReveal(message.b)
        return
      case 'coinReveal':
        this.onCoinReveal(message.b.round, message.b.nonce)
        return
      case 'ping':
        this.sendGuest(wire('pong', message.b))
        return
      case 'pong':
        this.link.pong(message.b.t)
        return
      case 'presence':
        this.guestHidden = message.b.state === 'hidden'
        this.refresh()
        this.notify()
        return
      case 'bye':
        this.guestGone()
        return
      default: {
        const unhandled: never = message
        return unhandled
      }
    }
  }

  private refuse(peer: PeerId, reason: RejectReason, message: string): void {
    this.roomLink.send(peer, wire('reject', { reason, message, versions: this.options.versions }))
  }

  private onHello(peer: PeerId, hello: HelloMessage['b']): void {
    const mismatch = versionMismatch(this.options.versions, hello.versions, 'guest')
    if (mismatch !== null) return this.refuse(peer, 'version', mismatch)
    if (hello.proof !== this.proof) return this.refuse(peer, 'bad-invite', 'This invite link does not match the room. Ask your friend for a new link.')
    const seated = this.guest
    const returning = seated !== null && hello.seatToken !== null && tokenDigest(hello.seatToken) === seated.tokenHash
    if (seated !== null && !returning) {
      const seatedIsHere = this.guestPeer !== null && this.guestPeer !== peer && this.link.status !== 'lost'
      if (seatedIsHere || !SEAT_TAKEOVER_WHEN_AWAY) return this.refuse(peer, 'full', 'This game already has two players.')
    }
    const token = returning && hello.seatToken !== null ? hello.seatToken : newToken(this.options.random)
    if (this.guestPeer !== null && this.guestPeer !== peer) this.roomLink.send(this.guestPeer, wire('bye', { reason: 'replaced' }))
    const name = cleanName(hello.name, 'Guest')
    this.guestPeer = peer
    this.welcomed = false
    this.guest = { tokenHash: tokenDigest(token), name }
    this.guestLock = { army: false, deploy: false }
    this.auditSentTo = null
    this.renameGuest(name)
    const stillPending = hello.pending.filter((id) => this.inFlight.has(id))
    this.sendGuestRaw(wire('welcome', { versions: this.options.versions, seatToken: token, hostName: this.options.hostName, roomId: this.room.roomId, stillPending }))
    this.welcomed = true
    for (const id of hello.pending) {
      const result = this.results.get(id)
      if (result !== undefined) this.sendGuest(wire('result', { id, result }))
    }
    this.sendGuest(wire('presence', { state: this.options.environment.isHidden() ? 'hidden' : 'active' }))
    if (this.problemValue?.kind === 'transport') this.problemValue = null
    this.link.up()
    // "Resync from hash": a guest whose view (or the whole state) is unchanged gets no snapshot.
    const inSync = hello.lastSeq !== null && (hello.stateHash === this.authority.stateHash || hello.viewHash === this.authority.viewHash('guest'))
    if (inSync) {
      this.refreshDerived()
      this.lastMetaKey = this.metaKey()
      this.sendGuest(wire('synced', { seq: this.authority.seq('guest'), epoch: this.authority.epoch, meta: this.meta() }))
    } else {
      this.sendDelivery(this.authority.snapshot('guest', hello.lastSeq === null ? 'join' : 'resync'), hello.lastSeq === null ? 'join' : 'resync')
    }
    this.authority.setLinkDown(false)
    this.persist(true)
    this.maybeSendAudit()
    this.refresh()
    this.notify()
  }

  /** Before any battle, a lobby rebuilt with the guest's name (the engine has no rename intent; replay is exact). */
  private renameGuest(name: string): void {
    const record = this.authority.record
    if (record.state.phase !== 'lobby' || record.state.seats.guest.name === name) return
    const initial = createGame({
      seed: record.initial.seed,
      settings: record.initial.settings,
      names: { host: record.initial.seats.host.name, guest: name },
    })
    try {
      this.authority.replaceRecord(replayRecord(initial, record.log))
    } catch {
      // The log no longer replays under the new name: keep the old one.
    }
  }

  private onIntent(body: IntentMessage['b']): void {
    const cached = this.results.get(body.id)
    if (cached !== undefined) {
      this.sendGuest(wire('result', { id: body.id, result: cached }))
      return
    }
    if (this.inFlight.has(body.id)) return
    if (body.epoch !== this.authority.epoch) {
      this.answer(body.id, { ok: false, code: 'NOT_AVAILABLE', message: 'The game changed (a take-back or a restart) before this arrived; check the board and try again' })
      return
    }
    this.inFlight.add(body.id)
    void this.authority.submit('guest', body.intent).then((result) => {
      this.inFlight.delete(body.id)
      this.answer(body.id, result)
    })
  }

  /** Guest intents still in progress (queued behind a prompt, 2.11), for the guest's dispatch timeouts. */
  private waiting(): string[] {
    return [...this.inFlight].slice(0, MAX_PENDING_IDS)
  }

  private answer(id: string, result: DispatchResult): void {
    this.results.set(id, result)
    for (const oldest of this.results.keys()) {
      if (this.results.size <= RESULT_CACHE_SIZE) break
      this.results.delete(oldest)
    }
    this.sendGuest(wire('result', { id, result }))
  }

  private onLock(body: LockMessage['b']): void {
    const phase = this.authority.state.phase
    if ((body.phase === 'army' && phase !== 'lobby') || (body.phase === 'deploy' && phase !== 'deployment')) return
    this.guestLock = { ...this.guestLock, [body.phase]: body.locked }
    this.refresh()
    this.notify()
  }

  /** The guest's sealed submission: applied all at once, and only against the commitment it was made for. */
  private onReveal(body: RevealMessage['b']): void {
    const cached = this.results.get(body.id)
    if (cached !== undefined) {
      this.sendGuest(wire('result', { id: body.id, result: cached }))
      return
    }
    const phase = this.authority.state.phase
    const commit = this.commits[body.phase]
    const rightPhase = body.phase === 'army' ? phase === 'lobby' : phase === 'deployment'
    if (!rightPhase || commit === null || commit.hash !== body.against) {
      this.answer(body.id, { ok: false, code: 'NOT_AVAILABLE', message: 'The host changed its choice before yours arrived; nothing of yours was used' })
      return
    }
    if (!body.intents.every((intent) => REVEALABLE[body.phase].includes(intent.kind))) {
      this.answer(body.id, { ok: false, code: 'NOT_AVAILABLE', message: 'Not a sealed submission' })
      return
    }
    const result = this.authority.submitBatch('guest', body.intents)
    if (result.ok) this.guestLock = { ...this.guestLock, [body.phase]: false }
    this.answer(body.id, result)
    this.refresh()
    this.notify()
  }

  private onCoinReveal(round: number, nonce: string): void {
    const coin = this.coin
    if (coin === null || coin.revealed || coin.round !== round || this.authority.state.phase !== 'lobby') return
    this.coin = { ...coin, revealed: true }
    void this.authority.submit('host', { kind: 'startDeployment', coinSeed: combineSecrets(coin.nonce, nonce) })
  }

  private guestGone(): void {
    if (this.guestPeer === null) return
    this.guestPeer = null
    this.welcomed = false
    this.guestHidden = false
    this.guestLock = { army: false, deploy: false }
    this.auditSentTo = null
    this.link.down()
    this.authority.setLinkDown(true)
  }

  private onLinkChange(): void {
    if (this.link.status === 'lost' && this.guestPeer !== null) {
      this.guestGone()
      return
    }
    this.refresh()
    this.notify()
  }

  private onTransportProblem(problem: TransportProblem): void {
    if (problem.kind === 'send-failed') return // a peer that just left; the leave event follows
    this.problemValue = { kind: 'transport', message: `Could not connect to your friend directly (${problem.detail}). A TURN relay may be needed.` }
    this.notify()
  }

  private onConnectError(error: unknown): void {
    const insecure = error instanceof TransportError && error.kind === 'insecure-context'
    this.problemValue = { kind: insecure ? 'insecure-context' : 'transport', message: error instanceof Error ? error.message : 'Could not open the room' }
    this.notify()
  }

  // ---------------------------------------------------------------- outbound

  private sendGuestRaw(text: string): void {
    if (this.guestPeer !== null) this.roomLink.send(this.guestPeer, text)
  }

  private sendGuest(text: string): void {
    if (this.welcomed) this.sendGuestRaw(text)
  }

  private onDelivery(seat: Seat, delivery: SeatDelivery): void {
    if (seat === 'host') {
      this.feed.deliver({
        why: delivery.why,
        events: delivery.events,
        view: delivery.view,
        decisionMs: this.authority.remainingMs(this.authority.decisionDeadline('host')),
      })
      logFinishedMatch(
        this.options.storage,
        `host-${this.room.roomId}-${this.authority.record.initial.seed}`,
        'host',
        'host',
        delivery.view,
        delivery.events,
        this.options.clock.now(),
      )
      return
    }
    this.sendDelivery(delivery, delivery.why === 'update' ? null : delivery.why)
  }

  private sendDelivery(delivery: SeatDelivery, why: SnapshotReason | null): void {
    if (!this.welcomed) return
    this.refreshDerived()
    const meta = this.meta()
    this.lastMetaKey = this.metaKey()
    const body = {
      seq: delivery.seq,
      epoch: delivery.epoch,
      events: delivery.events,
      view: delivery.view,
      viewHash: delivery.viewHash,
      stateHash: delivery.stateHash,
      logLength: delivery.logLength,
      meta,
    }
    this.sendGuest(why === null ? wire('update', body) : wire('snapshot', { ...body, why }))
  }

  private meta(): MetaWire {
    const coin = this.coin
    return {
      seedCommit: this.seedCommit,
      clock: this.authority.clockWire('guest'),
      takebackMs: this.authority.remainingMs(this.authority.takebackDeadline()),
      decisionMs: this.authority.remainingMs(this.authority.decisionDeadline('guest')),
      commits: { army: this.commits.army?.hash ?? null, deploy: this.commits.deploy?.hash ?? null },
      coin: coin === null ? null : { round: coin.round, commit: coin.commit, hostNonce: coin.revealed ? coin.nonce : null },
    }
  }

  /**
   * Changes when the meta would tell the guest something new (not merely as clocks tick). Only what the guest may know
   * counts, so not even the timing of a message gives away a prompt hidden from it (2.11).
   */
  private metaKey(): string {
    return JSON.stringify([
      this.seedCommit,
      this.authority.clockKey('guest'),
      this.authority.timerKey('guest'),
      this.commits.army?.hash ?? null,
      this.commits.deploy?.hash ?? null,
      this.coin?.round ?? null,
      this.coin?.revealed ?? null,
    ])
  }

  private flushMeta(): void {
    if (!this.welcomed) return
    const key = this.metaKey()
    if (key === this.lastMetaKey) return
    this.lastMetaKey = key
    this.sendGuest(wire('meta', { meta: this.meta() }))
  }

  private maybeSendAudit(): void {
    if (this.authority.state.phase !== 'ended' || !this.welcomed || this.guestPeer === null || this.auditSentTo === this.guestPeer) return
    this.auditSentTo = this.guestPeer
    const record = this.authority.record
    this.sendGuest(wire('audit', { initial: record.initial, log: record.log, salts: this.salts }))
  }

  // ---------------------------------------------------------------- derived state

  private onChanged(): void {
    this.refreshDerived()
    this.flushMeta()
    this.maybeSendAudit()
    this.persist(false)
    this.refresh()
    this.notify()
  }

  /** The host's commitments follow its own state; a coin round opens once both seats are ready (R37). */
  private refreshDerived(): void {
    const state = this.authority.state
    const host = state.seats.host
    this.commits = {
      army: state.phase === 'lobby' && host.ready && host.army !== null ? this.commitFor('army', armyPayload(host.army)) : null,
      deploy: state.phase === 'deployment' && host.deploymentConfirmed ? this.commitFor('deploy', placementPayload(seatPlacements(state, 'host'))) : null,
    }
    if (state.phase !== 'lobby' && this.guestLock.army) this.guestLock = { ...this.guestLock, army: false }
    if (state.phase !== 'deployment' && this.guestLock.deploy) this.guestLock = { ...this.guestLock, deploy: false }
    if (state.phase !== 'lobby') return
    if (!SEATS.every((s) => state.seats[s].ready)) {
      if (this.coin !== null && !this.coin.revealed) this.coin = null
      return
    }
    if (this.coin === null || this.coin.revealed) {
      this.coinRound += 1
      const nonce = newNonce(this.options.random)
      this.coin = { round: this.coinRound, nonce, commit: commitSecret(nonce), revealed: false }
    }
  }

  private commitFor(phase: LockPhase, payload: string): Commit {
    const existing = this.commits[phase]
    if (existing !== null && existing.payload === payload) return existing
    const salt = newNonce(this.options.random)
    const hash = commitment(phase, payload, salt)
    this.salts[hash] = salt
    return { hash, payload }
  }

  private refresh(): void {
    this.exposed = overlayOpponentLock(this.feed.view, 'guest', this.guestLock)
    this.clockView = this.authority.clockView('host')
    const joined = this.guest !== null
    const name = this.guest?.name ?? null
    const activity = this.guestPeer === null ? 'away' : this.guestHidden ? 'hidden' : 'active'
    const current = this.presenceView
    if (current.joined !== joined || current.name !== name || current.activity !== activity) this.presenceView = presence(joined, name, activity)
  }

  private persist(force: boolean): void {
    const record = this.authority.record
    if (!force && record === this.savedRecord) return
    this.savedRecord = record
    saveHostRoom(this.options.storage, {
      roomId: this.room.roomId,
      secret: this.options.invite.secret,
      hostName: this.options.hostName,
      record,
      guest: this.guest,
      salts: this.salts,
    })
  }

  private notify(): void {
    this.feed.notify()
  }
}
