import { describe, expect, it } from 'vitest'
import type { TurnClockView } from '../net'
import { clockDisplay, formatClock } from './turnClock'

const view = (patch: Partial<TurnClockView> = {}): TurnClockView => ({
  activeSeat: 'host',
  running: true,
  pausedBy: null,
  turnMs: 90_000,
  bankMs: { host: 60_000, guest: 45_000 },
  at: 1_000,
  ...patch,
})

describe('turn clock display (R29)', () => {
  it('spends the turn time first, then the active player’s bank', () => {
    expect(clockDisplay(view(), 31_000)).toEqual({ active: 'host', turnLeftMs: 60_000, bankLeftMs: 60_000, inBank: false, paused: false })
    expect(clockDisplay(view(), 101_000)).toMatchObject({ turnLeftMs: 0, bankLeftMs: 50_000, inBank: true })
    expect(clockDisplay(view({ activeSeat: 'guest' }), 101_000)).toMatchObject({ bankLeftMs: 35_000 })
  })

  it('stands still while paused, and is absent when the timer is off', () => {
    expect(clockDisplay(view({ running: false, pausedBy: 'decision' }), 500_000)).toMatchObject({ turnLeftMs: 90_000, paused: true })
    expect(clockDisplay(null, 0)).toBeNull()
    expect(formatClock(61_001)).toBe('1:02')
  })
})
