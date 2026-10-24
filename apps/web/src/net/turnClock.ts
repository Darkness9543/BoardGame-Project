// The R29 turn timer as pure data: each turn gets `turnTimerSeconds`; once that is spent the active player's
// per-game time bank (`timeBankSeconds`) runs; when both are gone the authority ends the turn (never the game).
// It stops during reaction prompts (R29), take-back requests (TB-4) and disconnections (2.12). The bank is not
// refilled between turns.

import type { MatchSettings, Seat } from '@coinduel/engine'
import type { ClockPause, ClockWire } from './messages'

export interface TurnClockState {
  readonly turnNumber: number
  readonly activeSeat: Seat
  /** Turn time and banks left at `since`. */
  readonly turnMs: number
  readonly bankMs: Readonly<Record<Seat, number>>
  readonly running: boolean
  readonly pausedBy: ClockPause | null
  readonly since: number
}

/** The clock as the UI shows it: values measured at `at` (session clock, epoch ms); count down while `running`. */
export interface TurnClockView extends ClockWire {
  readonly at: number
}

export interface ClockReading {
  readonly turnMs: number
  readonly bankMs: Readonly<Record<Seat, number>>
  /** The turn time is used up and the bank is running. */
  readonly onBank: boolean
  readonly expired: boolean
}

const seconds = (s: number | null): number => (s === null ? 0 : Math.round(s * 1000))

/** null when the lobby turned the timer off. */
export function createTurnClock(settings: MatchSettings, turnNumber: number, activeSeat: Seat, now: number): TurnClockState | null {
  if (settings.turnTimerSeconds === null) return null
  const bank = seconds(settings.timeBankSeconds)
  return {
    turnNumber,
    activeSeat,
    turnMs: seconds(settings.turnTimerSeconds),
    bankMs: { host: bank, guest: bank },
    running: true,
    pausedBy: null,
    since: now,
  }
}

/** Elapsed time spends the turn first, then the active player's bank. */
function spend(turnMs: number, bankMs: Readonly<Record<Seat, number>>, active: Seat, elapsed: number): ClockReading {
  const fromTurn = Math.min(turnMs, elapsed)
  const fromBank = Math.min(bankMs[active], elapsed - fromTurn)
  const turn = turnMs - fromTurn
  const bank = { ...bankMs, [active]: bankMs[active] - fromBank }
  return { turnMs: turn, bankMs: bank, onBank: turn === 0, expired: turn === 0 && bank[active] === 0 }
}

export function readClock(clock: TurnClockState, now: number): ClockReading {
  return spend(clock.turnMs, clock.bankMs, clock.activeSeat, clock.running ? Math.max(0, now - clock.since) : 0)
}

/** Folds the elapsed time into the stored values. */
function settle(clock: TurnClockState, now: number): TurnClockState {
  const reading = readClock(clock, now)
  return { ...clock, turnMs: reading.turnMs, bankMs: reading.bankMs, since: now }
}

export function startTurn(clock: TurnClockState, settings: MatchSettings, turnNumber: number, activeSeat: Seat, now: number): TurnClockState {
  const settled = settle(clock, now)
  return { ...settled, turnNumber, activeSeat, turnMs: seconds(settings.turnTimerSeconds), running: true, pausedBy: null }
}

export function pauseClock(clock: TurnClockState, reason: ClockPause, now: number): TurnClockState {
  if (!clock.running && clock.pausedBy === reason) return clock
  return { ...settle(clock, now), running: false, pausedBy: reason }
}

export function resumeClock(clock: TurnClockState, now: number): TurnClockState {
  if (clock.running) return clock
  return { ...settle(clock, now), running: true, pausedBy: null }
}

/** Epoch ms when the turn ends by itself, or null while stopped. */
export function expiresAt(clock: TurnClockState): number | null {
  return clock.running ? clock.since + clock.turnMs + clock.bankMs[clock.activeSeat] : null
}

export function clockWire(clock: TurnClockState, now: number): ClockWire {
  const reading = readClock(clock, now)
  return { activeSeat: clock.activeSeat, running: clock.running, pausedBy: clock.pausedBy, turnMs: reading.turnMs, bankMs: reading.bankMs }
}

/** For the HUD: what is left right now of a clock view (call it every frame or second). */
export function clockRemaining(view: TurnClockView, now: number): ClockReading {
  return spend(view.turnMs, view.bankMs, view.activeSeat, view.running ? Math.max(0, now - view.at) : 0)
}
