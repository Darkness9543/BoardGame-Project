// The host-authoritative match (NC 7.1, 7.8). One MatchRecord; every intent goes through the engine's submit(),
// whoever sends it (the host's own UI included, NC 7.8 rule 4); each seat is then handed only its own projection
// and its filtered events. It also runs the clocks the engine leaves to the session: the R29 turn timer, the
// take-back auto-decline (TB-4) and a backstop for reaction prompts (A2-30), and it queues intents that meet a
// pending decision their sender may not know about (2.11).

import {
  filterEvents,
  hashJson,
  hashState,
  projectView,
  SEATS,
  submit,
  TAKEBACK_TIMEOUT_S,
  type GameEvent,
  type GameState,
  type Intent,
  type MatchRecord,
  type PlayerView,
  type Seat,
  type VisibleEvent,
} from '@coinduel/engine'
import type { DispatchResult } from '../contracts'
import { OneShot, type Clock } from './clock'
import { DECISION_GRACE_MS, MAX_QUEUED_INTENTS } from './constants'
import type { ClockPause, ClockWire } from './messages'
import {
  clockWire,
  createTurnClock,
  expiresAt,
  pauseClock,
  readClock,
  resumeClock,
  startTurn,
  type TurnClockState,
  type TurnClockView,
} from './turnClock'

export type DeliveryReason = 'update' | 'join' | 'resync' | 'takeback' | 'reset'

export interface SeatDelivery {
  readonly why: DeliveryReason
  readonly seq: number
  readonly epoch: number
  readonly events: readonly VisibleEvent[]
  readonly view: PlayerView
  readonly viewHash: string
  readonly stateHash: string
  readonly logLength: number
}

export interface AuthorityHooks {
  /** A seat's new projection (called for both seats before `changed`). */
  deliver(seat: Seat, delivery: SeatDelivery): void
  /** After any change of state, clocks or timers. */
  changed(): void
}

interface Projection {
  readonly view: PlayerView
  readonly hash: string
}

interface Queued {
  readonly seat: Seat
  readonly intent: Intent
  readonly resolve: (result: DispatchResult) => void
}

interface Window {
  readonly key: string
  readonly seat: Seat
  readonly since: number
  readonly ms: number
}

export const other = (seat: Seat): Seat => (seat === 'host' ? 'guest' : 'host')

const ok: DispatchResult = { ok: true }

export class MatchAuthority {
  private current: MatchRecord
  private epochValue = 0
  private hash: string
  private projections: Record<Seat, Projection>
  private readonly seqs: Record<Seat, number> = { host: 0, guest: 0 }
  private queue: Queued[] = []
  private draining = false
  private disposed = false
  private linkDown = false
  private turnClock: TurnClockState | null = null
  private takebackWindow: Window | null = null
  private decisionWindow: Window | null = null
  private readonly clockTimer: OneShot
  private readonly takebackTimer: OneShot
  private readonly decisionTimer: OneShot

  constructor(
    record: MatchRecord,
    private readonly clock: Clock,
    private readonly hooks: AuthorityHooks,
  ) {
    this.current = record
    this.hash = hashState(record.state)
    this.projections = this.project()
    this.clockTimer = new OneShot(clock)
    this.takebackTimer = new OneShot(clock)
    this.decisionTimer = new OneShot(clock)
    this.syncTimers()
  }

  get record(): MatchRecord {
    return this.current
  }

  get state(): GameState {
    return this.current.state
  }

  get epoch(): number {
    return this.epochValue
  }

  get stateHash(): string {
    return this.hash
  }

  view(seat: Seat): PlayerView {
    return this.projections[seat].view
  }

  viewHash(seat: Seat): string {
    return this.projections[seat].hash
  }

  seq(seat: Seat): number {
    return this.seqs[seat]
  }

  /** The current projection as a snapshot (join, resync); it does not advance the seat's seq. */
  snapshot(seat: Seat, why: 'join' | 'resync'): SeatDelivery {
    return this.delivery(seat, why, [])
  }

  /**
   * Validates and applies one intent. An intent refused with DECISION_PENDING waits in a queue until the
   * decision is answered, then runs (2.11): the sender may not know about the prompt, so the wait has to look
   * like an ordinary pause, never like a refusal.
   */
  submit(seat: Seat, intent: Intent): Promise<DispatchResult> {
    if (this.disposed) return Promise.resolve({ ok: false, code: 'NOT_CONNECTED', message: 'The match is closed' })
    return new Promise((resolve) => {
      const outcome = this.attempt(seat, intent)
      if (outcome !== 'queued') {
        resolve(outcome)
        return
      }
      if (this.queue.length >= MAX_QUEUED_INTENTS) {
        resolve({ ok: false, code: 'DECISION_PENDING', message: 'Waiting for a decision' })
        return
      }
      this.queue.push({ seat, intent, resolve })
    })
  }

  /** Applies several intents of one seat as a unit: all of them, or none (a revealed sealed submission). */
  submitBatch(seat: Seat, intents: readonly Intent[]): DispatchResult {
    let record = this.current
    const events: GameEvent[] = []
    for (const intent of intents) {
      const result = submit(record, seat, intent)
      if (!result.ok) return { ok: false, code: result.code, message: result.message }
      record = result.record
      events.push(...result.events)
    }
    this.adopt(record, events, 'update')
    return ok
  }

  /** A new timeline (rematch, or a lobby rebuilt with the guest's name): both seats get a snapshot. */
  replaceRecord(record: MatchRecord): void {
    for (const queued of this.queue.splice(0)) queued.resolve({ ok: false, code: 'NOT_AVAILABLE', message: 'The match was restarted' })
    this.turnClock = null
    this.adopt(record, [], 'reset')
  }

  /** 2.12: the turn timer stops while the other player is disconnected. */
  setLinkDown(down: boolean): void {
    if (this.linkDown === down) return
    this.linkDown = down
    this.syncClock()
    this.hooks.changed()
  }

  /** The R29 clock now as `seat` may see it, for its HUD (stable until the next `changed`). */
  clockView(seat: Seat): TurnClockView | null {
    const wire = this.clockWire(seat)
    return wire === null ? null : { ...wire, at: this.clock.now() }
  }

  /**
   * The clock as `seat` may see it. R29 stops it for every reaction prompt, but a prompt the seat may not know about
   * has to look like an ordinary pause in play (2.11): to that seat the clock runs on from where it stopped.
   */
  clockWire(seat: Seat): ClockWire | null {
    const clock = this.turnClock
    if (clock === null) return null
    const now = this.clock.now()
    const shown = this.pauseReason(this.current.state, seat)
    if (shown === clock.pausedBy) return clockWire(clock, now)
    return clockWire(shown === null ? { ...clock, running: true, pausedBy: null } : { ...clock, running: false, pausedBy: shown }, now)
  }

  /** Changes whenever the clock as `seat` sees it starts, stops or switches turn (not as time passes). */
  clockKey(seat: Seat): string {
    const clock = this.turnClock
    return clock === null ? 'off' : `${clock.turnNumber}|${clock.activeSeat}|${this.pauseReason(this.current.state, seat) ?? 'running'}`
  }

  /** Epoch ms of the take-back auto-decline (TB-4), or null. */
  takebackDeadline(): number | null {
    return this.takebackWindow === null ? null : this.takebackWindow.since + this.takebackWindow.ms
  }

  /** Epoch ms when `seat`'s pending reaction prompt answers itself (A2-30), or null. */
  decisionDeadline(seat: Seat): number | null {
    const window = this.decisionWindow
    return window === null || window.seat !== seat ? null : window.since + window.ms
  }

  remainingMs(deadline: number | null): number | null {
    return deadline === null ? null : Math.max(0, deadline - this.clock.now())
  }

  /** The take-back window (public, TB-4) and `seat`'s own prompt window. */
  timerKey(seat: Seat): string {
    const decision = this.decisionWindow?.seat === seat ? this.decisionWindow.key : ''
    return `${this.takebackWindow?.key ?? ''}|${decision}`
  }

  dispose(): void {
    this.disposed = true
    this.clockTimer.cancel()
    this.takebackTimer.cancel()
    this.decisionTimer.cancel()
    for (const queued of this.queue.splice(0)) queued.resolve({ ok: false, code: 'NOT_CONNECTED', message: 'The match is closed' })
  }

  // ---------------------------------------------------------------- internals

  private attempt(seat: Seat, intent: Intent): DispatchResult | 'queued' {
    const result = submit(this.current, seat, intent)
    if (!result.ok) return result.code === 'DECISION_PENDING' ? 'queued' : { ok: false, code: result.code, message: result.message }
    this.adopt(result.record, result.events, intent.kind === 'acceptTakeback' ? 'takeback' : 'update')
    return ok
  }

  private project(): Record<Seat, Projection> {
    const at = (seat: Seat): Projection => {
      const view = projectView(this.current.state, seat)
      return { view, hash: hashJson(view) }
    }
    return { host: at('host'), guest: at('guest') }
  }

  private delivery(seat: Seat, why: DeliveryReason, events: readonly VisibleEvent[]): SeatDelivery {
    const projection = this.projections[seat]
    return {
      why,
      seq: this.seqs[seat],
      epoch: this.epochValue,
      events,
      view: projection.view,
      viewHash: projection.hash,
      stateHash: this.hash,
      logLength: this.current.log.length,
    }
  }

  private adopt(record: MatchRecord, events: readonly GameEvent[], why: 'update' | 'takeback' | 'reset'): void {
    const previous = this.projections
    this.current = record
    if (why !== 'update') this.epochValue += 1
    this.hash = hashState(record.state)
    this.projections = this.project()
    this.syncTimers()
    for (const seat of SEATS) {
      const seen = filterEvents(events, seat)
      // Nothing visible happened to this seat: sending nothing keeps even the timing of hidden actions private.
      if (why === 'update' && seen.length === 0 && previous[seat].hash === this.projections[seat].hash) continue
      if (why === 'update') this.seqs[seat] += 1
      this.hooks.deliver(seat, this.delivery(seat, why, seen))
    }
    this.hooks.changed()
    this.drain()
  }

  private drain(): void {
    if (this.draining) return
    this.draining = true
    try {
      while (this.queue.length > 0 && this.current.state.decisions.length === 0) {
        const next = this.queue.shift()
        if (next === undefined) break
        const outcome = this.attempt(next.seat, next.intent)
        if (outcome === 'queued') {
          this.queue.unshift(next)
          break
        }
        next.resolve(outcome)
      }
    } finally {
      this.draining = false
    }
  }

  private syncTimers(): void {
    const state = this.current.state
    const now = this.clock.now()

    const request = state.takeback.request
    if (request === null) {
      this.takebackWindow = null
      this.takebackTimer.cancel()
    } else if (this.takebackWindow === null) {
      const decider = other(request.requester)
      this.takebackWindow = { key: `t${request.actionSeq}@${now}`, seat: decider, since: now, ms: TAKEBACK_TIMEOUT_S * 1000 }
      this.takebackTimer.start(TAKEBACK_TIMEOUT_S * 1000, () => this.expireTakeback(request.actionSeq))
    }

    const head = state.decisions[0]
    if (head === undefined) {
      this.decisionWindow = null
      this.decisionTimer.cancel()
    } else if (this.decisionWindow?.key !== head.id) {
      const ms = head.timeoutSeconds * 1000
      this.decisionWindow = { key: head.id, seat: head.seat, since: now, ms }
      this.decisionTimer.start(ms + DECISION_GRACE_MS, () => this.expireDecision(head.id))
    }

    this.syncClock()
  }

  /** Why the clock stops (R29, TB-4, 2.12), or what `seat` may be told of it: a prompt hidden from it doesn't count. */
  private pauseReason(state: GameState, seat: Seat | null = null): ClockPause | null {
    const head = state.decisions[0]
    if (head !== undefined && (seat === null || head.publicTo.includes(seat))) return 'decision'
    if (state.takeback.request !== null) return 'takeback'
    return this.linkDown ? 'disconnected' : null
  }

  private syncClock(): void {
    const state = this.current.state
    const turn = state.turn
    if (state.phase !== 'battle' || turn === null || state.settings.turnTimerSeconds === null) {
      this.turnClock = null
      this.clockTimer.cancel()
      return
    }
    const now = this.clock.now()
    let clock = this.turnClock ?? createTurnClock(state.settings, turn.number, turn.activeSeat, now)
    if (clock === null) return
    // A new turn, or an undone End Turn (the turn number went back): the turn time starts again.
    if (clock.turnNumber !== turn.number) clock = startTurn(clock, state.settings, turn.number, turn.activeSeat, now)
    const pause = this.pauseReason(state)
    clock = pause === null ? resumeClock(clock, now) : pauseClock(clock, pause, now)
    this.turnClock = clock
    const expiry = expiresAt(clock)
    if (expiry === null) this.clockTimer.cancel()
    else this.clockTimer.start(expiry - now, () => this.expireTurn(clock.turnNumber))
  }

  private expireTurn(turnNumber: number): void {
    const clock = this.turnClock
    const turn = this.current.state.turn
    if (clock === null || turn === null || turn.number !== turnNumber) return
    if (!readClock(clock, this.clock.now()).expired) {
      this.syncClock()
      return
    }
    void this.submit(turn.activeSeat, { kind: 'endTurn' })
  }

  private expireTakeback(actionSeq: number): void {
    const request = this.current.state.takeback.request
    if (request === null || request.actionSeq !== actionSeq) return
    void this.submit(other(request.requester), { kind: 'declineTakeback' })
  }

  private expireDecision(decisionId: string): void {
    const head = this.current.state.decisions[0]
    if (head === undefined || head.id !== decisionId) return
    void this.submit(head.seat, { kind: 'respondDecision', decisionId: head.id, choice: head.defaultOption })
  }
}
