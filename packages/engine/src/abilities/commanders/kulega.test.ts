import { describe, expect, it } from 'vitest'
import { KULEGA_HEAL_CAP } from '../../constants'
import { area3x3, parseSquare, sameSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { UnitTypeId } from '../../types'
import { filterEvents, isVisibleSquare, projectView } from '../../view'
import { registerAbility } from '../registry'

// Test-local stand-ins for other agents' stubs: a Mind's Eye detector (A8-10), a bare sacrifice (Feast without its own
// heal, A8-21) and an enemy Pajazon tick (A8-19).
registerAbility({ id: 'artificer.mindsEye', status: 'implemented', detection: () => ({ kind: 'lov' }) }, { replace: true })
registerAbility(
  {
    id: 'beast.feast',
    status: 'implemented',
    active: {
      targets: [{ kind: 'unit', label: 'Meal', range: 1, relation: 'own', includeSelf: false, allowCommander: false }],
      resolve: (ctx, _unit, targets) => {
        const t = targets[0]
        const meal = t?.kind === 'unit' ? ctx.unit(t.unitId) : undefined
        if (meal !== undefined) ctx.sacrifice(meal, 'beast.feast')
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

describe('kulega.finePrinter (7.5, A7-09)', () => {
  it('gives every own unit +1 LOV, the commander and dummies included, and nothing to the opponent', () => {
    const b = buildBattle({
      south: ['commander@E3:C', 'footman@G5:F', 'noAcb@I5:D', 'paladin@K5:P'],
      north: ['footman@E20:N'],
      commanders: { south: 'kulega' },
    })
    const lov = (label: string, seat = b.south) => projectView(b.state, seat).units.find((u) => u.id === b.id(label))?.lov
    expect([lov('C'), lov('F'), lov('D'), lov('P')]).toEqual([4, 2, 2, 3])
    expect(lov('N', b.north)).toBe(1)
  })

  it('widens vision (KUL-1): the commander sees an enemy 4 squares away', () => {
    const spec = { south: ['commander@M3:C'], north: ['footman@M7:N'] } as const
    const kulega = buildBattle({ ...spec, commanders: { south: 'kulega' } })
    expect(isVisibleSquare(projectView(kulega.state, kulega.south), parseSquare('M7'))).toBe(true)
    expect(projectView(kulega.state, kulega.south).units.some((u) => u.id === kulega.id('N'))).toBe(true)
    const plain = buildBattle(spec)
    expect(isVisibleSquare(projectView(plain.state, plain.south), parseSquare('M7'))).toBe(false)
  })

  it("widens Mind's Eye (KUL-1, X-03): an Artificer reveals a stealthed Rogue 4 squares away", () => {
    const spec = { south: ['artificer@M5:A'], north: [{ type: 'rogue', at: 'M9', label: 'R', stealthed: true }] } as const
    const kulega = buildBattle({ ...spec, commanders: { south: 'kulega' } })
    expect(unitIn(kulega.state, kulega.id('R'))?.stealthed).toBe(false)
    const plain = buildBattle(spec)
    expect(unitIn(plain.state, plain.id('R'))?.stealthed).toBe(true)
  })
})

describe('kulega.finePrint (7.5, A7-10)', () => {
  it("heals an adjacent type-20 unit when an own type-1 unit dies on the opponent's turn; other own units get nothing", () => {
    const b = buildBattle({
      south: [{ type: 'paladin', at: 'E5', label: 'P', toughness: 10 }, 'footman@E6:F', { type: 'soldier', at: 'D6', label: 'S', toughness: 5 }],
      north: ['berserker@E7:B'],
      commanders: { south: 'kulega' },
      active: 'north',
    })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('F') } })
    expect(unitIn(r.state, b.id('F'))).toBeUndefined()
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(12)
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(5) // a Soldier has no Fine Print (type 2)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitHealed', unitId: b.id('P'), amount: 2, toughness: 12, source: 'kulega.finePrint' })
  })

  it.each([
    ['footman', 2],
    ['mercenary', 1],
    ['soldier', KULEGA_HEAL_CAP], // T5: base 7, capped at 4 per instance
    ['ranger', 1],
  ] as const)("counts enemy deaths too (KUL-2): killing an adjacent enemy %s heals %i (KUL-3: its base toughness)", (type, heal) => {
    const b = buildBattle({ south: [{ type: 'paladin', at: 'E5', label: 'P', toughness: 10 }], north: [`${type}@E6:V`], commanders: { south: 'kulega' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('P'), target: { kind: 'unit', unitId: b.id('V') } })
    expect(unitIn(r.state, b.id('V'))).toBeUndefined()
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(10 + heal)
  })

  it("reads the base toughness under the dead unit's own commander: an enemy Trill Footman (1/3) heals 3", () => {
    const b = buildBattle({ south: [{ type: 'paladin', at: 'E5', label: 'P', toughness: 10 }], north: ['footman@E6:V'], commanders: { south: 'kulega', north: 'trill' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('P'), target: { kind: 'unit', unitId: b.id('V') } })
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(13)
  })

  it.each(['berserker', 'rogue', 'noAcb'] as const)('never triggers on the death of a %s (type 5 or more, or no type; KUL-7)', (type: UnitTypeId) => {
    const b = buildBattle({ south: [{ type: 'paladin', at: 'E5', label: 'P', toughness: 10 }], north: [`${type}@E6:V`], commanders: { south: 'kulega' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('P'), target: { kind: 'unit', unitId: b.id('V') } })
    expect(unitIn(r.state, b.id('V'))).toBeUndefined()
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(10)
  })

  it('judges adjacency on the square the unit died on (KUL-6): a Footman stepping onto a mine next to the Paladin', () => {
    const b = buildBattle({
      south: [{ type: 'paladin', at: 'E5', label: 'P', toughness: 10 }, 'footman@E7:F'],
      commanders: { south: 'kulega' },
      mines: [{ owner: 'north', at: 'E6' }],
    })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('E6') })
    expect(unitIn(r.state, b.id('F'))).toBeUndefined()
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(12)
  })

  it('does nothing for a death that is not adjacent (a diagonal square is distance 2)', () => {
    const b = buildBattle({ south: [{ type: 'paladin', at: 'E5', label: 'P', toughness: 10 }, 'soldier@G6:S'], north: ['footman@F6:V'], commanders: { south: 'kulega' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('S'), target: { kind: 'unit', unitId: b.id('V') } })
    expect(unitIn(r.state, b.id('V'))).toBeUndefined()
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(10)
  })

  it('heals every adjacent type-20 unit once per death, Artificers included (KUL-5)', () => {
    const b = buildBattle({
      south: [{ type: 'paladin', at: 'D6', label: 'P', toughness: 10 }, { type: 'artificer', at: 'F6', label: 'A', toughness: 10 }, 'footman@E6:F'],
      north: ['berserker@E7:B'],
      commanders: { south: 'kulega' },
      active: 'north',
    })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('F') } })
    expect([unitIn(r.state, b.id('P'))?.toughness, unitIn(r.state, b.id('A'))?.toughness]).toEqual([12, 12])
  })

  it('heals once for each death in one simultaneous event (KUL-5), after the damage', () => {
    const b = buildBattle({ south: [{ type: 'paladin', at: 'E5', label: 'P', toughness: 10 }, 'footman@D5:L', 'footman@F5:R'], commanders: { south: 'kulega' } })
    b.state.areas.push({ id: 'a-k', abilityId: 'royalWizard.pajazon', owner: b.north, sourceId: null, squares: area3x3(parseSquare('E5')), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 90, data: {} })
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('L'))).toBeUndefined()
    expect(unitIn(r.state, b.id('R'))).toBeUndefined()
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(10 - (3 - 2) + 2 + 2) // its own tick (Reinforced Armor), then two heals
  })

  it('caps the heal at max toughness', () => {
    const b = buildBattle({ south: [{ type: 'paladin', at: 'E5', label: 'P', toughness: 17 }], north: ['soldier@E6:V'], commanders: { south: 'kulega' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('P'), target: { kind: 'unit', unitId: b.id('V') } })
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(18)
  })

  it('counts sacrifices as deaths (KUL-4, T8 / X-08 in a Lojrar army): a Beast eats a Ranger next to an Artificer', () => {
    const b = buildBattle({
      south: ['beast@E5:BEAST', 'ranger@G5:R', { type: 'artificer', at: 'H5', label: 'A', toughness: 10 }],
      commanders: { south: 'kulega' },
    })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('BEAST'), abilityId: 'beast.feast', targets: [{ kind: 'unit', unitId: b.id('R') }] })
    expect(r.state.fallen.find((f) => f.unit.id === b.id('R'))?.cause).toBe('sacrifice')
    expect(unitIn(r.state, b.id('A'))?.toughness).toBe(11)
  })
})
