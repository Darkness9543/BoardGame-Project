import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { area3x3, parseSquare, sameSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'

// Test-local damage sources standing in for stub abilities: a Smite-like hit and a Pajazon-like tick.
registerAbility(
  {
    id: 'emissary.smite',
    status: 'implemented',
    active: {
      targets: [{ kind: 'unit', label: 'Target', range: 3, relation: 'enemy', includeSelf: false, allowCommander: true }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        const target = t?.kind === 'unit' ? ctx.unit(t.unitId) : undefined
        if (target !== undefined) ctx.dealDamage({ target, kind: 'ability', base: 8, source: 'emissary.smite', dealer: unit })
      },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) =>
        ending === area.owner
          ? null
          : { damage: q.units().filter((u) => u.owner === ending && q.footprint(u).some((s) => area.squares.some((a) => sameSquare(a, s)))).map((u) => ({ target: u.id, amount: 3 })) },
    },
  },
  { replace: true },
)

describe('paladin.reinforcedArmor (8.9, A8-12; 10/18 and armour 2 under owner ruling R21)', () => {
  it('reduces every attack by 2, never below 1 (PAL-1)', () => {
    const b = buildBattle({ south: ['berserker@E5:B', 'footman@F6:F'], north: ['paladin@E6:P'], control: { market: 'south' } })
    let state = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('P') } }).state
    expect(unitIn(state, b.id('P'))?.toughness).toBe(18 - 6)
    state = act(state, b.south, { kind: 'attack', unitId: b.id('F'), target: { kind: 'unit', unitId: b.id('P') } }).state
    expect(unitIn(state, b.id('P'))?.toughness).toBe(18 - 6 - 1)
  })

  it('reduces ability damage, mines and ticks too ("all damage", PAL-3)', () => {
    const smite = buildBattle({ south: ['emissary@E5:E'], north: ['paladin@E7:P'] })
    const r = act(smite.state, smite.south, { kind: 'useAbility', unitId: smite.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: smite.id('P') }] })
    expect(unitIn(r.state, smite.id('P'))?.toughness).toBe(18 - 6)

    const mine = buildBattle({ south: ['paladin@E5:P'], mines: [{ owner: 'north', at: 'E6' }] })
    const r2 = act(mine.state, mine.south, { kind: 'move', unitId: mine.id('P'), path: sqs('E6') })
    expect(unitIn(r2.state, mine.id('P'))?.toughness).toBe(18 - 3)

    const tick = buildBattle({ south: ['paladin@E5:P'] })
    tick.state.areas.push({ id: 'a-t', abilityId: 'royalWizard.pajazon', owner: tick.north, sourceId: null, squares: area3x3(parseSquare('E5')), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 50, data: {} })
    const r3 = act(tick.state, tick.south, { kind: 'endTurn' })
    expect(unitIn(r3.state, tick.id('P'))?.toughness).toBe(18 - 1)
  })

  it('subtracts before Defend halves (C3, PAL-1)', () => {
    const b = buildBattle({ south: ['beast@E5:B'], north: [{ type: 'paladin', at: 'E7', label: 'P', defending: true }] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('P') } })
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(18 - 9) // ceil((20 - 2) / 2)
  })

  it('only protects the Paladin itself', () => {
    const b = buildBattle({ south: ['berserker@E5:B'], north: ['paladin@F7', 'soldier@E6:S'] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))).toBeUndefined()
  })
})
