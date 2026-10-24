import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { AP_BASE, AP_MAX, APPROACH_BOOST, MARKET_AP_BONUS, SCOURGE_AP_BONUS, apForRound } from './constants'
import { act, buildBattle } from './testing/dsl'
import type { GameState, Seat } from './types'
import { projectView } from './view'

// Test-local Tribute stand-in (R25): the AP-income hook the Scourge file will implement.
registerAbility({ id: 'scourge.tribute', status: 'implemented', startOfTurnAp: () => SCOURGE_AP_BONUS }, { replace: true })

interface PoolOptions {
  /** null = no contact yet (the approach boost runs). */
  readonly contactRound?: number | null
  readonly market?: boolean
  readonly scourge?: boolean
  readonly debt?: number
}

/** The pool `side` starts its turn of `round` with: the other side ends the turn just before it. */
function poolAt(side: 'south' | 'north', round: number, options: PoolOptions = {}): { state: GameState; seat: Seat } {
  const b = buildBattle({
    north: options.scourge === true ? ['scourge@M20'] : [],
    active: side === 'south' ? 'north' : 'south',
    control: options.market === true ? { market: side } : {},
  })
  const seat = b.seat(side)
  const ending = b.seat(side === 'south' ? 'north' : 'south')
  const debt = { ...b.state.seats[seat], apDebt: options.debt ?? 0 }
  const before: GameState = {
    ...b.state,
    turn: { number: side === 'south' ? 2 * round - 2 : 2 * round - 1, activeSeat: ending },
    firstContactRound: options.contactRound ?? null,
    seats: { ...b.state.seats, [seat]: debt },
  }
  return { state: act(before, ending, { kind: 'endTurn' }).state, seat }
}

const ap = (side: 'south' | 'north', round: number, options?: PoolOptions): number => {
  const { state, seat } = poolAt(side, round, options)
  return state.seats[seat].ap
}

// R1 + R28: 10 + (round - 1), capped at 20 for rounds 1-19; from round 20 the cap lifts: 20 + (round - 19).
const CURVE = [
  [1, 10],
  [2, 11],
  [11, 20],
  [19, 20],
  [20, 21],
  [25, 26],
] as const

describe('AP curve (owner rulings R1, R9, R28)', () => {
  it.each(CURVE)('round %i is worth %i', (round, value) => {
    expect(apForRound(round)).toBe(value)
  })

  it('starts at AP_BASE and is capped at AP_MAX until the late escalation', () => {
    expect(apForRound(1)).toBe(AP_BASE)
    expect(Math.max(...[...Array(19).keys()].map((i) => apForRound(i + 1)))).toBe(AP_MAX)
  })

  it.each(CURVE)('round %i: both seats get double the curve (%i) before first contact', (round, value) => {
    expect(ap('north', round)).toBe(value * APPROACH_BOOST)
    if (round > 1) expect(ap('south', round)).toBe(value * APPROACH_BOOST)
  })

  it.each(CURVE.filter(([round]) => round > 1))('round %i: both seats get the plain curve (%i) once the contact round is over', (round, value) => {
    expect(ap('north', round, { contactRound: round - 1 })).toBe(value)
    expect(ap('south', round, { contactRound: round - 1 })).toBe(value)
  })

  it('keeps the boost to the end of the round of first contact, for the second player too', () => {
    expect(ap('north', 3, { contactRound: 3 })).toBe(apForRound(3) * APPROACH_BOOST)
    expect(ap('south', 4, { contactRound: 3 })).toBe(apForRound(4))
  })

  it("shows the round's pool, boost included, to both seats (view.apPool)", () => {
    const boosted = poolAt('north', 3)
    const plain = poolAt('north', 3, { contactRound: 2 })
    for (const seat of ['host', 'guest'] as const) {
      expect(projectView(boosted.state, seat).apPool).toBe(apForRound(3) * APPROACH_BOOST)
      expect(projectView(plain.state, seat).apPool).toBe(apForRound(3))
    }
  })
})

describe('AP add-ons after the cap (R31 Market, R25 Tribute) and the Cauldron debt (R11)', () => {
  it('adds the Market +2 and a living Scourge +2 on top of the capped and of the escalated curve', () => {
    expect(ap('north', 11, { contactRound: 10, market: true })).toBe(AP_MAX + MARKET_AP_BONUS)
    expect(ap('north', 11, { contactRound: 10, scourge: true })).toBe(AP_MAX + SCOURGE_AP_BONUS)
    expect(ap('north', 25, { contactRound: 24, market: true, scourge: true })).toBe(26 + MARKET_AP_BONUS + SCOURGE_AP_BONUS)
  })

  it('adds them to the boosted value before contact', () => {
    expect(ap('north', 1, { market: true, scourge: true })).toBe(apForRound(1) * APPROACH_BOOST + MARKET_AP_BONUS + SCOURGE_AP_BONUS)
  })

  it('deducts an AP debt at the start of the owner turn, clears it, and shows it to both seats until then (R15)', () => {
    const { state, seat } = poolAt('north', 5, { contactRound: 4, debt: 1 })
    expect(state.seats[seat].ap).toBe(apForRound(5) - 1)
    expect(state.seats[seat].apDebt).toBe(0)
    const b = buildBattle()
    const owing: GameState = { ...b.state, seats: { ...b.state.seats, [b.north]: { ...b.state.seats[b.north], apDebt: 1 } } }
    expect(projectView(owing, b.south)).toMatchObject({ opponentApDebt: 1, opponentAp: 0 })
    expect(projectView(owing, b.north)).toMatchObject({ myApDebt: 1, opponentAp: 20 })
  })

  it('loses unspent AP at the end of the turn (A2-03)', () => {
    const b = buildBattle({ ap: 7 })
    const r = act(act(b.state, b.south, { kind: 'endTurn' }).state, b.north, { kind: 'endTurn' })
    expect(r.state.seats[b.south].ap).toBe(apForRound(2) * APPROACH_BOOST)
  })

  it('shows the lost AP to both seats as soon as the turn has ended (R15)', () => {
    const b = buildBattle({ ap: 7 })
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(r.state.seats[b.south].ap).toBe(0)
    expect(projectView(r.state, b.north).opponentAp).toBe(0)
    expect(r.events.filter((e) => e.type === 'apChanged').map((e) => (e.type === 'apChanged' ? [e.seat, e.ap, e.delta] : null))[0]).toEqual([b.south, 0, -7])
  })
})
