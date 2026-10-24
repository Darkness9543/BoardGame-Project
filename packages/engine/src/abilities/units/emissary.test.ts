import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate, type Intent } from '../../commands'
import { RATASIUS_WEAKNESS, RATASIUS_WEAKNESS_RANGE } from '../../constants'
import { unitDef } from '../../content/units'
import { parseSquare } from '../../geometry'
import { legalActions } from '../../preview'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { GameState, Seat } from '../../types'
import { filterEvents, projectView } from '../../view'

const BLESSING = 'emissary.holyBlessing'
const SMITE = 'emissary.smite'

// Test-local stand-in for a commander stub: Ratasius' weakness (A7-14), for CEL-8 and B11.
registerAbility(
  {
    id: 'ratasius.great',
    status: 'implemented',
    attackerSubtraction: (q, holder, hit) =>
      hit.dealer !== null && hit.dealer.owner !== holder.owner && q.distance(holder, hit.dealer) <= RATASIUS_WEAKNESS_RANGE ? RATASIUS_WEAKNESS : 0,
  },
  { replace: true },
)

const smite = (unitId: string, targetId: string): Intent => ({ kind: 'useAbility', unitId, abilityId: SMITE, targets: [{ kind: 'unit', unitId: targetId }] })
const bless = (unitId: string): Intent => ({ kind: 'useAbility', unitId, abilityId: BLESSING, targets: [] })
const move = (unitId: string, ...path: string[]): Intent => ({ kind: 'move', unitId, path: sqs(...path) })
const toughness = (state: GameState, id: string) => unitIn(state, id)?.toughness
const apOf = (state: GameState, seat: Seat) => state.seats[seat].ap

describe('emissary stats (8.13)', () => {
  it('is 15/50 with LOV 4, Movement 2 and AP 4 from the content table', () => {
    expect(unitDef('emissary')).toMatchObject({ power: 15, toughness: 50, lov: 4, movement: 2, ap: 4, tier: 100 })
  })
})

describe('emissary.holyBlessing (8.13, A8-22)', () => {
  it('heals own units within range 2 by 5, the Emissary included, capped at max (CEL-1, A3-10)', () => {
    const b = buildBattle({
      south: [
        { type: 'emissary', at: 'J10', label: 'E', toughness: 40 },
        { type: 'juliomancer', at: 'J12', label: 'NEAR', toughness: 5 },
        { type: 'paladin', at: 'K11', label: 'FULLISH', toughness: 16 },
        { type: 'soldier', at: 'J13', label: 'FAR', toughness: 1 },
      ],
      north: [{ type: 'juliomancer', at: 'I11', label: 'FOE', toughness: 5 }],
    })
    const r = act(b.state, b.south, bless(b.id('E')))
    expect(['E', 'NEAR', 'FULLISH', 'FAR', 'FOE'].map((label) => toughness(r.state, b.id(label)))).toEqual([45, 10, 18, 1, 5])
    expect(apOf(r.state, b.south)).toBe(20 - 3)
    const healed = filterEvents(r.events, b.south).flatMap((e) => (e.type === 'unitHealed' ? [[e.unitId, e.amount]] : []))
    expect(healed).toEqual([
      [b.id('E'), 5],
      [b.id('NEAR'), 5],
      [b.id('FULLISH'), 2],
    ])
  })

  it('heals own stealthed units without revealing them (CEL-2)', () => {
    const b = buildBattle({ south: ['emissary@J10:E', { type: 'rogue', at: 'J12', label: 'R', toughness: 1, stealthed: true }], north: ['ranger@J15'] })
    expect(projectView(b.state, b.north).units.some((u) => u.id === b.id('R'))).toBe(false) // J12 is in the Ranger's LOV
    const r = act(b.state, b.south, bless(b.id('E')))
    expect(unitIn(r.state, b.id('R'))).toMatchObject({ toughness: 4, stealthed: true })
    expect(filterEvents(r.events, b.north).some((e) => e.type === 'unitHealed')).toBe(false)
  })
})

describe('emissary.smite (8.13, A8-23; owner rulings R14, R25)', () => {
  it('deals 8 to the target and 3 to every unit on its 4 orthogonal neighbours, own units included; no mine goes off (CEL-3)', () => {
    const b = buildBattle({
      south: ['emissary@J10:E', 'footman@K13:OWN', 'juliomancer@J12:ALLY'],
      north: ['juliomancer@J13:T', 'juliomancer@I13:W', 'juliomancer@L13:FAR'],
      mines: [{ owner: 'north', at: 'J14' }],
    })
    const r = act(b.state, b.south, smite(b.id('E'), b.id('T')))
    expect([toughness(r.state, b.id('T')), toughness(r.state, b.id('W')), toughness(r.state, b.id('ALLY')), toughness(r.state, b.id('FAR'))]).toEqual([7, 12, 12, 15])
    expect(unitIn(r.state, b.id('OWN'))).toBeUndefined()
    expect(r.state.mines).toHaveLength(1)
    expect(apOf(r.state, b.south)).toBe(20 - 3)
    const hits = r.events.flatMap((e) => (e.type === 'unitDamaged' ? [e] : []))
    expect(new Set(hits.map((e) => e.unitId)).size).toBe(4)
    expect(hits.every((e) => e.kind === 'ability' && e.source === SMITE)).toBe(true)
  })

  it('may target an own unit (R14, FRIENDLY_SINGLE_TARGET) but never the Emissary itself', () => {
    const b = buildBattle({ south: ['emissary@J10:E', 'juliomancer@J12:ALLY'] })
    expect(toughness(act(b.state, b.south, smite(b.id('E'), b.id('ALLY'))).state, b.id('ALLY'))).toBe(15 - 8)
    expect(validate(b.state, b.south, smite(b.id('E'), b.id('E')))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
  })

  it('reaches a visible unit up to range 3, never a hidden one (A8-23)', () => {
    const b = buildBattle({ south: ['emissary@J10:E'], north: ['juliomancer@J13:IN', 'juliomancer@J14:OUT', { type: 'rogue', at: 'J12', label: 'HIDDEN', stealthed: true }] })
    expect(validate(b.state, b.south, smite(b.id('E'), b.id('IN'))).ok).toBe(true)
    expect(validate(b.state, b.south, smite(b.id('E'), b.id('OUT')))).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    expect(validate(b.state, b.south, smite(b.id('E'), b.id('HIDDEN')))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
  })

  it('is ability damage: halved on a defending target, untouched by the Keep (B10, X-15)', () => {
    const b = buildBattle({ south: ['emissary@J10:E'], north: [{ type: 'juliomancer', at: 'J13', label: 'T', defending: true }], control: { keep: 'south' } })
    const r = act(b.state, b.south, smite(b.id('E'), b.id('T')))
    expect(toughness(r.state, b.id('T'))).toBe(15 - 4)
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'unitDamaged', unitId: b.id('T'), breakdown: [expect.objectContaining({ step: 'base', delta: 8 }), expect.objectContaining({ step: 'defend', total: 4 })] }))
  })

  it('hits a Size-2 target once and splashes the 8 squares around it', () => {
    const b = buildBattle({ south: ['emissary@J10:E', 'soldier@J11:S'], north: ['beast@J12:T', 'juliomancer@L13:SIDE', 'juliomancer@L14:CORNER'] })
    const r = act(b.state, b.south, smite(b.id('E'), b.id('T')))
    expect([toughness(r.state, b.id('T')), toughness(r.state, b.id('S')), toughness(r.state, b.id('SIDE')), toughness(r.state, b.id('CORNER'))]).toEqual([40 - 8, 7 - 3, 15 - 3, 15])
  })

  it('splashes the Emissary itself when it stands next to its target (R25 read literally)', () => {
    const b = buildBattle({ south: ['emissary@J10:E'], north: ['juliomancer@J11:T'] })
    const r = act(b.state, b.south, smite(b.id('E'), b.id('T')))
    expect([toughness(r.state, b.id('T')), toughness(r.state, b.id('E'))]).toEqual([15 - 8, 50 - 3])
  })

  it('is weakened next to an enemy Ratasius: 4 on the target and 1 on the splash (CEL-8, B11, R13)', () => {
    const b = buildBattle({ south: ['emissary@J10:E'], north: ['commander@I10', 'juliomancer@J13:T', 'juliomancer@J14:N'], commanders: { north: 'ratasius' } })
    const r = act(b.state, b.south, smite(b.id('E'), b.id('T')))
    expect([toughness(r.state, b.id('T')), toughness(r.state, b.id('N'))]).toEqual([15 - 4, 15 - 1])
  })

  it('wins the game on the enemy commander (A6-01)', () => {
    const b = buildBattle({ south: ['emissary@J10:E'], north: ['commander@J12:C'] })
    expect(act(b.state, b.south, smite(b.id('E'), b.id('C'))).state.result).toMatchObject({ winner: b.south, reason: 'conquest' })
  })
})

describe('emissary.holyFervor (8.13, A8-24)', () => {
  it('gives two actions a turn; every action after the first costs 1 AP more, in either order (CEL-6)', () => {
    const b = buildBattle({ south: ['emissary@J10:E'], north: ['scourge@J13:T'] })
    const before = projectView(b.state, b.south).units.find((u) => u.id === b.id('E'))
    expect(before?.own).toMatchObject({ actionAllowance: 2, nextActionSurcharge: 0 })

    const moved = act(b.state, b.south, move(b.id('E'), 'J11'))
    expect(projectView(moved.state, b.south).units.find((u) => u.id === b.id('E'))?.own?.nextActionSurcharge).toBe(1)
    expect(legalActions(projectView(moved.state, b.south), b.id('E')).find((o) => o.abilityId === SMITE)?.cost).toBe(3 + 1)
    const moveFirst = act(moved.state, b.south, smite(b.id('E'), b.id('T'))).state
    expect(apOf(moveFirst, b.south)).toBe(20 - 4 - (3 + 1))

    const smiteFirst = act(act(b.state, b.south, smite(b.id('E'), b.id('T'))).state, b.south, move(b.id('E'), 'J11')).state
    expect(apOf(smiteFirst, b.south)).toBe(20 - 3 - (4 + 1))
    expect(validate(smiteFirst, b.south, { kind: 'defend', unitId: b.id('E') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('may spend the extra action on a second Move (R12, superseding CEL-4)', () => {
    const b = buildBattle({ south: ['emissary@J10:E'] })
    const state = act(act(b.state, b.south, move(b.id('E'), 'J11', 'J12')).state, b.south, move(b.id('E'), 'J13', 'J14')).state
    expect(unitIn(state, b.id('E'))?.anchor).toEqual(parseSquare('J14'))
    expect(apOf(state, b.south)).toBe(20 - 4 - 5)
  })

  it('allows the same ability twice: Smite twice is 7 AP for 16, Holy blessing twice +10 (CEL-5)', () => {
    const b = buildBattle({ south: [{ type: 'emissary', at: 'J10', label: 'E', toughness: 30 }], north: ['scourge@J13:T'] })
    const twice = act(act(b.state, b.south, smite(b.id('E'), b.id('T'))).state, b.south, smite(b.id('E'), b.id('T'))).state
    expect([toughness(twice, b.id('T')), apOf(twice, b.south)]).toEqual([33 - 16, 20 - 7])
    const blessed = act(act(b.state, b.south, bless(b.id('E'))).state, b.south, bless(b.id('E'))).state
    expect([toughness(blessed, b.id('E')), apOf(blessed, b.south)]).toEqual([30 + 10, 20 - 7])
  })

  it('stacks with Command Aura: three actions, the second and third 1 AP dearer each (CEL-7, X-12)', () => {
    const b = buildBattle({ south: ['emissary@J10:E', 'scourge@I11'], north: ['juliomancer@J13:T'] })
    expect(projectView(b.state, b.south).units.find((u) => u.id === b.id('E'))?.own?.actionAllowance).toBe(3)
    let state = act(b.state, b.south, smite(b.id('E'), b.id('T'))).state
    state = act(state, b.south, bless(b.id('E'))).state
    state = act(state, b.south, { kind: 'defend', unitId: b.id('E') }).state
    expect(apOf(state, b.south)).toBe(20 - 3 - (3 + 1) - (4 + 1))
    expect(validate(state, b.south, move(b.id('E'), 'K10'))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })
})
