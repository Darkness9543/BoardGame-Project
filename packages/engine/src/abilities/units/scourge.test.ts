import { describe, expect, it } from 'vitest'
import { validate, type Intent } from '../../commands'
import { AP_MAX, APPROACH_BOOST, SCOURGE_AP_BONUS, apForRound } from '../../constants'
import { abilityParam } from '../../content/abilities'
import { unitDef } from '../../content/units'
import { parseSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { GameState, Seat } from '../../types'
import { projectView } from '../../view'

const END: Intent = { kind: 'endTurn' }

const move = (unitId: string, ...path: string[]): Intent => ({ kind: 'move', unitId, path: sqs(...path) })
const attack = (unitId: string, targetId: string): Intent => ({ kind: 'attack', unitId, target: { kind: 'unit', unitId: targetId } })
const defend = (unitId: string): Intent => ({ kind: 'defend', unitId })
const allowance = (state: GameState, seat: Seat, id: string) => projectView(state, seat).units.find((u) => u.id === id)?.own?.actionAllowance

describe('scourge stats (8.14)', () => {
  it('is 15/33 with LOV 3, Movement 2 and AP 3 from the content table', () => {
    expect(unitDef('scourge')).toMatchObject({ power: 15, toughness: 33, lov: 3, movement: 2, ap: 3, tier: 100 })
  })
})

describe('scourge.commandAura (8.14, A8-25)', () => {
  it('gives own units within range 2, not the Scourge, one more action, paid as usual; it may be a second Move (R12)', () => {
    const b = buildBattle({ south: ['scourge@J10:SC', 'soldier@J12:S'] })
    expect([allowance(b.state, b.south, b.id('S')), allowance(b.state, b.south, b.id('SC'))]).toEqual([2, 1])
    const state = act(act(b.state, b.south, move(b.id('S'), 'J11')).state, b.south, move(b.id('S'), 'I11')).state
    expect(unitIn(state, b.id('S'))?.anchor).toEqual(parseSquare('I11'))
    expect(state.seats[b.south].ap).toBe(20 - 1 - 1) // no AP from the aura (A8-25)
    expect(validate(act(b.state, b.south, move(b.id('SC'), 'K10')).state, b.south, defend(b.id('SC')))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('never helps enemy units in range (SCO-6)', () => {
    const b = buildBattle({ south: ['scourge@J10'], north: ['soldier@J12:E'], active: 'north' })
    expect(allowance(b.state, b.north, b.id('E'))).toBe(1)
    expect(validate(act(b.state, b.north, move(b.id('E'), 'J13')).state, b.north, defend(b.id('E')))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('measures range from the nearest square of a Size-2 unit (SCO-7)', () => {
    const b = buildBattle({ south: ['scourge@J10', 'beast@J12:IN', 'beast@M10:OUT'] })
    expect([allowance(b.state, b.south, b.id('IN')), allowance(b.state, b.south, b.id('OUT'))]).toEqual([2, 1])
  })

  it('gives one extra action however many Scourges are in range, the other Scourge included (SCO-2, A3-15)', () => {
    const b = buildBattle({ south: ['scourge@J10:A', 'scourge@L10:B', 'soldier@K11:S'] })
    expect(['S', 'A', 'B'].map((label) => allowance(b.state, b.south, b.id(label)))).toEqual([2, 2, 2])
  })

  it('adds to the Market: a Footman in both may Move, Attack and Attack (X-14, SCO-2)', () => {
    const b = buildBattle({ south: ['scourge@J10', 'footman@J12:F'], north: ['juliomancer@K11:E'], control: { market: 'south' } })
    expect(allowance(b.state, b.south, b.id('F'))).toBe(3)
    let state = act(b.state, b.south, move(b.id('F'), 'J11')).state
    state = act(act(state, b.south, attack(b.id('F'), b.id('E'))).state, b.south, attack(b.id('F'), b.id('E'))).state
    expect([unitIn(state, b.id('E'))?.toughness, state.seats[b.south].ap]).toEqual([15 - 2, 20 - 3])
    expect(validate(state, b.south, defend(b.id('F')))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('is checked when an action is declared: walking out of range loses the extra action, walking in gains it (SCO-1, X-27)', () => {
    const b = buildBattle({ south: ['scourge@J10', 'soldier@J12:OUT', 'soldier@L11:IN'] })
    const left = act(b.state, b.south, move(b.id('OUT'), 'J13')).state
    expect(validate(left, b.south, defend(b.id('OUT')))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
    expect(allowance(b.state, b.south, b.id('IN'))).toBe(1)
    const arrived = act(b.state, b.south, move(b.id('IN'), 'K11')).state
    expect(validate(arrived, b.south, defend(b.id('IN'))).ok).toBe(true)
  })

  it("takes an unused extra action away the moment the Scourge dies (SCO-5)", () => {
    const b = buildBattle({ south: [{ type: 'scourge', at: 'J10', label: 'SC', toughness: 1 }, 'soldier@J12:S'], mines: [{ owner: 'south', at: 'I10' }] })
    let state = act(b.state, b.south, move(b.id('S'), 'J11')).state
    state = act(state, b.south, move(b.id('SC'), 'I10')).state // its own mine kills it
    expect(unitIn(state, b.id('SC'))).toBeUndefined()
    expect(validate(state, b.south, defend(b.id('S')))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('includes the commander and dummies: the commander may Move, then Attack (SCO-4)', () => {
    const b = buildBattle({ south: ['scourge@J10', 'commander@J12:C', 'noAcb@I10:D'], north: ['juliomancer@K11:E'] })
    expect(allowance(b.state, b.south, b.id('D'))).toBe(2)
    const state = act(act(b.state, b.south, move(b.id('C'), 'J11')).state, b.south, attack(b.id('C'), b.id('E'))).state
    expect([unitIn(state, b.id('E'))?.toughness, state.seats[b.south].ap]).toEqual([15 - 1, 20 - 2])
  })

  it('lets a Berserker make two basic attacks in one turn (X-13, SCO-8)', () => {
    const b = buildBattle({ south: ['scourge@J10', 'berserker@J12:B'], north: ['paladin@J13:P'] })
    const state = act(act(b.state, b.south, attack(b.id('B'), b.id('P'))).state, b.south, attack(b.id('B'), b.id('P'))).state
    expect(unitIn(state, b.id('P'))?.toughness).toBe(18 - 2 * (8 - 2))
  })
})

describe('scourge.tribute (owner ruling R25)', () => {
  it('adds 2 AP at the start of each own turn while the Scourge lives, on top of the curve, never for the opponent (R1, R28)', () => {
    expect(abilityParam('scourge.tribute', 'ap')).toBe(SCOURGE_AP_BONUS)
    const b = buildBattle({ north: ['scourge@M20'] })
    const north = act(b.state, b.south, END).state
    expect(north.seats[b.north].ap).toBe(apForRound(1) * APPROACH_BOOST + SCOURGE_AP_BONUS)
    expect(act(north, b.north, END).state.seats[b.south].ap).toBe(apForRound(2) * APPROACH_BOOST)
    const late: GameState = { ...b.state, turn: { number: 21, activeSeat: b.south }, firstContactRound: 1 }
    expect(act(late, b.south, END).state.seats[b.north].ap).toBe(AP_MAX + SCOURGE_AP_BONUS) // round 11: after the cap
  })

  it('stops once the Scourge is dead', () => {
    const b = buildBattle({ north: [{ type: 'scourge', at: 'M20', label: 'S', toughness: 1 }], mines: [{ owner: 'north', at: 'M19' }], active: 'north' })
    let state = act(b.state, b.north, move(b.id('S'), 'M19')).state
    expect(unitIn(state, b.id('S'))).toBeUndefined()
    state = act(act(state, b.north, END).state, b.south, END).state
    expect(state.seats[b.north].ap).toBe(apForRound(2) * APPROACH_BOOST)
  })

  it('is counted once for two Scourges (one bonus per ability id, an open reading of R25)', () => {
    const b = buildBattle({ north: ['scourge@M20', 'scourge@O20'] })
    expect(act(b.state, b.south, END).state.seats[b.north].ap).toBe(apForRound(1) * APPROACH_BOOST + SCOURGE_AP_BONUS)
  })
})
