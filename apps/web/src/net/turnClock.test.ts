import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@coinduel/engine'
import { clockRemaining, clockWire, createTurnClock, expiresAt, pauseClock, readClock, resumeClock, startTurn } from './turnClock'

const settings = { ...DEFAULT_SETTINGS, turnTimerSeconds: 90, timeBankSeconds: 60 }
const T0 = 1_000_000

describe('R29 turn clock', () => {
  it('is off when the lobby turned the timer off', () => {
    expect(createTurnClock({ ...settings, turnTimerSeconds: null }, 1, 'host', T0)).toBeNull()
  })

  it('spends the turn first, then the active player bank, then expires', () => {
    const clock = createTurnClock(settings, 1, 'host', T0)
    if (clock === null) throw new Error('no clock')
    expect(expiresAt(clock)).toBe(T0 + 150_000)
    expect(readClock(clock, T0 + 30_000)).toMatchObject({ turnMs: 60_000, onBank: false, expired: false })
    expect(readClock(clock, T0 + 100_000)).toMatchObject({ turnMs: 0, bankMs: { host: 50_000, guest: 60_000 }, onBank: true, expired: false })
    expect(readClock(clock, T0 + 150_000).expired).toBe(true)
  })

  it('stops while paused and keeps the bank between turns (not refilled)', () => {
    let clock = createTurnClock(settings, 1, 'host', T0)
    if (clock === null) throw new Error('no clock')
    clock = pauseClock(clock, 'decision', T0 + 10_000)
    expect(expiresAt(clock)).toBeNull()
    expect(readClock(clock, T0 + 500_000).turnMs).toBe(80_000)
    clock = resumeClock(clock, T0 + 500_000)
    expect(expiresAt(clock)).toBe(T0 + 500_000 + 80_000 + 60_000)
    clock = startTurn(clock, settings, 2, 'guest', T0 + 600_000) // host used 20 s of its bank
    expect(clock).toMatchObject({ turnNumber: 2, activeSeat: 'guest', turnMs: 90_000, bankMs: { host: 40_000, guest: 60_000 }, running: true })
  })

  it('lets the HUD count down from a wire snapshot', () => {
    const clock = createTurnClock(settings, 1, 'guest', T0)
    if (clock === null) throw new Error('no clock')
    const view = { ...clockWire(clock, T0 + 5_000), at: 2_000 } // received on another machine's clock
    expect(clockRemaining(view, 2_000 + 85_000)).toMatchObject({ turnMs: 0, onBank: true, bankMs: { guest: 60_000 } })
    expect(clockRemaining({ ...view, running: false }, 9_999_999).turnMs).toBe(85_000)
  })
})
