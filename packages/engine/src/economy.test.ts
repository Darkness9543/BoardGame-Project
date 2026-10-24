import { describe, expect, it } from 'vitest'
import { abilityParam } from './content/abilities'
import { registerAbility } from './abilities/registry'
import { validate } from './commands'
import { parseSquare } from './geometry'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import type { GameState, Seat } from './types'

// Test-local stand-ins for stub abilities, to exercise the core rules they rely on.
registerAbility(
  {
    id: 'emissary.smite',
    status: 'implemented',
    active: {
      targets: [{ kind: 'unit', label: 'Target', range: 3, relation: 'enemy', includeSelf: false, allowCommander: true }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        const target = t?.kind === 'unit' ? ctx.unit(t.unitId) : undefined
        if (target !== undefined) ctx.dealDamage({ target, kind: 'ability', base: abilityParam('emissary.smite', 'damage'), source: 'emissary.smite', dealer: unit })
      },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'emissary.holyFervor',
    status: 'implemented',
    modifyStats: (_q, holder, target) => (holder.id === target.id ? { actions: 1 } : null),
    actionSurcharge: (used) => (used >= 1 ? 1 : 0),
  },
  { replace: true },
)
registerAbility(
  { id: 'royalWizard.forcefield', status: 'implemented', active: { targets: [], resolve: () => undefined } },
  { replace: true },
)

function endTurns(state: GameState, seats: readonly Seat[]): GameState {
  return seats.reduce((s, seat) => act(s, seat, { kind: 'endTurn' }).state, state)
}

describe('AP pool (2.3)', () => {
  it('refills to the round pool at the start of each own turn and never carries over (R1, R28, A2-03)', () => {
    const b = buildBattle({ south: ['footman@E5:F'] })
    let state = act(b.state, b.south, { kind: 'defend', unitId: b.id('F') }).state
    expect(state.seats[b.south].ap).toBe(19)
    state = endTurns(state, [b.south])
    expect(state.seats[b.north].ap).toBe(20) // round 1 for North too, doubled before first contact
    state = endTurns(state, [b.north])
    expect(state.seats[b.south].ap).toBe(22) // round 2: 11 x 2, nothing carried over
  })

  it('refuses an action the pool cannot pay for', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], ap: 1 })
    expect(validate(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6') })).toMatchObject({ ok: false, code: 'NOT_ENOUGH_AP' })
  })
})

describe('actions (2.4)', () => {
  it('allows one action per unit per turn (A2-07)', () => {
    const b = buildBattle({ south: ['soldier@E5:S'], north: ['footman@F6:F'] })
    const moved = act(b.state, b.south, { kind: 'move', unitId: b.id('S'), path: sqs('E6') }).state
    expect(validate(moved, b.south, { kind: 'attack', unitId: b.id('S'), target: { kind: 'unit', unitId: b.id('F') } })).toMatchObject({
      ok: false,
      code: 'NO_ACTIONS_LEFT',
    })
  })

  it('lets an extra action be a second Move, paying for each (R12, A2-09)', () => {
    const b = buildBattle({ south: ['footman@E5:F'], north: ['footman@E9:G'], control: { market: 'south' } })
    let state = act(b.state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('E6') }).state
    state = act(state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('E7') }).state
    expect(unitIn(state, b.id('F'))).toMatchObject({ anchor: parseSquare('E7'), turn: expect.objectContaining({ moves: 2, actionsUsed: 2 }) })
    expect(state.seats[b.south].ap).toBe(20 - 2)
    expect(validate(state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('E8') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('lets a Market Footman move and then attack, paying for both (A6-11)', () => {
    const b = buildBattle({ south: ['footman@E5:F'], north: ['footman@E7:G'], control: { market: 'south' } })
    let state = act(b.state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('E6') }).state
    state = act(state, b.south, { kind: 'attack', unitId: b.id('F'), target: { kind: 'unit', unitId: b.id('G') } }).state
    expect(state.seats[b.south].ap).toBe(20 - 2)
    expect(validate(state, b.south, { kind: 'defend', unitId: b.id('F') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('gives the Market action to type-1 units only, never to the commander or dummies', () => {
    const b = buildBattle({ south: ['commander@E3:C', 'soldier@E5:S', 'footman@F5:F'], control: { market: 'south' } })
    const moved = (id: string) => act(b.state, b.south, { kind: 'defend', unitId: b.id(id) }).state
    expect(validate(moved('C'), b.south, { kind: 'defend', unitId: b.id('C') }).ok).toBe(false)
    expect(validate(moved('S'), b.south, { kind: 'defend', unitId: b.id('S') }).ok).toBe(false)
    expect(validate(moved('F'), b.south, { kind: 'defend', unitId: b.id('F') }).ok).toBe(true)
  })

  it('needs Power >= 1 to attack (A2-19)', () => {
    const b = buildBattle({ south: ['noAcb@E5:D'], north: ['footman@E6:F'] })
    expect(validate(b.state, b.south, { kind: 'attack', unitId: b.id('D'), target: { kind: 'unit', unitId: b.id('F') } })).toMatchObject({
      ok: false,
      code: 'NO_POWER',
    })
  })
})

describe('active abilities (2.8, A2-10)', () => {
  it("pays the ability's cost instead of the unit's AP", () => {
    const b = buildBattle({ south: ['emissary@E5:E'], north: ['soldier@E7:S'] })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: b.id('S') }] })
    expect(r.state.seats[b.south].ap).toBe(20 - 3)
    expect(unitIn(r.state, b.id('S'))).toBeUndefined() // 8 ability damage kills the 2/7 Soldier
    expect(r.state.fallen.map((f) => f.unit.id)).toEqual([b.id('S')])
  })

  it('charges Holy Fervor +1 on every action after the first (A8-24)', () => {
    const b = buildBattle({ south: ['emissary@E5:E'], north: ['soldier@F7:T'] })
    let state = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: b.id('T') }] }).state
    state = act(state, b.south, { kind: 'move', unitId: b.id('E'), path: sqs('D5') }).state
    expect(state.seats[b.south].ap).toBe(20 - 3 - (4 + 1))
  })

  it('applies CD 1 as "usable every other own turn" (A2-22)', () => {
    const b = buildBattle({ south: ['royalWizard@E5:W'] })
    const use = (s: GameState) => act(s, b.south, { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.forcefield', targets: [] }).state
    let state = use(b.state)
    expect(unitIn(state, b.id('W'))?.cooldowns['royalWizard.forcefield']).toEqual({ usedOnOwnTurn: 1, readyOnOwnTurn: 3 })
    state = endTurns(state, [b.south, b.north])
    expect(validate(state, b.south, { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.forcefield', targets: [] })).toMatchObject({
      ok: false,
      code: 'ON_COOLDOWN',
    })
    state = endTurns(state, [b.south, b.north])
    expect(use(state).seats[b.south].ap).toBe(12 * 2 - 2) // round 3, still before first contact (R28)
  })

  it('refuses abilities that are still stubs, and passives', () => {
    const b = buildBattle({ south: ['rogue@E5:R', 'paladin@G5:P'] })
    expect(validate(b.state, b.south, { kind: 'useAbility', unitId: b.id('R'), abilityId: 'rogue.stealth', targets: [] })).toMatchObject({
      ok: false,
      code: 'NOT_IMPLEMENTED',
    })
    expect(validate(b.state, b.south, { kind: 'useAbility', unitId: b.id('P'), abilityId: 'paladin.reinforcedArmor', targets: [] })).toMatchObject({
      ok: false,
      code: 'NOT_ACTIVE_ABILITY',
    })
  })
})

describe('Defend (2.7, A2-21)', () => {
  it('lasts through the opponent turn and ends when its controller next starts a turn', () => {
    const b = buildBattle({ south: ['soldier@E5:S'], north: ['berserker@E6:B'] })
    let state = act(b.state, b.south, { kind: 'defend', unitId: b.id('S') }).state
    state = endTurns(state, [b.south])
    expect(unitIn(state, b.id('S'))?.defending).toBe(true)
    state = act(state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('S') } }).state
    expect(unitIn(state, b.id('S'))?.toughness).toBe(7 - 4) // ceil(8 / 2)
    state = endTurns(state, [b.north])
    expect(unitIn(state, b.id('S'))?.defending).toBe(false)
  })

  it('is cancelled when the unit takes another action that turn (C25)', () => {
    const b = buildBattle({ south: ['footman@E5:F'], north: ['footman@E6:G'], control: { market: 'south' } })
    let state = act(b.state, b.south, { kind: 'defend', unitId: b.id('F') }).state
    expect(unitIn(state, b.id('F'))?.defending).toBe(true)
    state = act(state, b.south, { kind: 'attack', unitId: b.id('F'), target: { kind: 'unit', unitId: b.id('G') } }).state
    expect(unitIn(state, b.id('F'))?.defending).toBe(false)
    expect(unitIn(state, b.id('F'))?.anchor).toEqual(parseSquare('E5'))
  })
})
