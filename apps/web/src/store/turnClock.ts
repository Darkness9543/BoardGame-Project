// The R29 turn clock as the HUD shows it. The clock itself runs in the session (net/turnClock.ts): the authority
// ends the turn once the turn time and then the active player's bank are spent, and stops it during prompts,
// take-back requests and disconnections. This only reads NetSession.clock.

import type { Seat } from '@coinduel/engine'
import { clockRemaining, type TurnClockView } from '../net'

export interface ClockDisplay {
  readonly active: Seat
  readonly turnLeftMs: number
  readonly bankLeftMs: number
  /** The turn time is spent and the bank is running. */
  readonly inBank: boolean
  readonly paused: boolean
}

/** What is left now, or null when the lobby turned the timer off (or no battle is running). */
export function clockDisplay(clock: TurnClockView | null, now: number): ClockDisplay | null {
  if (clock === null) return null
  const left = clockRemaining(clock, now)
  return { active: clock.activeSeat, turnLeftMs: left.turnMs, bankLeftMs: left.bankMs[clock.activeSeat], inBank: left.onBank, paused: !clock.running }
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
