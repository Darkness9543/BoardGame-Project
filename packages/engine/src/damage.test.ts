import { describe, expect, it } from 'vitest'
import { PIPELINE_RULES, runPipeline, type Contribution, type PipelineInput } from './damage'
import { parseSquare } from './geometry'
import { act, buildBattle, unitIn } from './testing/dsl'
import type { GameEvent } from './events'

const c = (source: string, amount: number): Contribution => ({ source, amount })
// Appendix B was computed with the pre-ruling numbers (armour 3); the pipeline arithmetic is what these pin.
const ARMOR = c('paladin.reinforcedArmor', 3)
const LINE = c('footman.lineFormation', 2)
const FIELD = c('royalWizard.forcefield', 8)
const WEAK = c('ratasius.great', 4)

function hit(base: number, opts: Partial<Omit<PipelineInput, 'base'>> = {}): number {
  return runPipeline({ base, isAttack: true, additions: [], subtractions: [], reductions: [], defending: false, ...opts }).amount
}

describe('Appendix B damage vectors (pipeline 3.3)', () => {
  it.each([
    ['B1 Berserker (12) attacks a Paladin', hit(12, { reductions: [ARMOR] }), 9],
    ['B2 Berserker (12) attacks a defending Paladin', hit(12, { reductions: [ARMOR], defending: true }), 5],
    ['B3 Footman (1) attacks a Paladin', hit(1, { reductions: [ARMOR] }), 1],
    ['B4 Footman (1) attacks a defending Paladin', hit(1, { reductions: [ARMOR], defending: true }), 1],
    ['B5 Keep-buffed Footman (4) attacks a Paladin', hit(4, { reductions: [ARMOR] }), 1],
    ['B6 Mercenary +3 attacks a defending Paladin', hit(2, { additions: [c('mercenary.fierceAttacker', 3)], reductions: [ARMOR], defending: true }), 1],
    ['B7 Mercenary +3 attacks a Footman in formation', hit(2, { additions: [c('mercenary.fierceAttacker', 3)], reductions: [LINE] }), 3],
    ['B8 Footman next to Ratasius attacks anything (R13: floor 1, was "no damage")', hit(1, { subtractions: [WEAK] }), 1],
    ['B9 revealed Rogue (7) next to Ratasius attacks him', hit(7, { subtractions: [WEAK] }), 3],
    ['B10 Smite (8) on a defending Emissary', hit(8, { isAttack: false, defending: true }), 4],
    ['B11 Smite (8) from an Emissary next to Ratasius', hit(8, { isAttack: false, subtractions: [WEAK] }), 4],
    ['B12 Slam (10) on a Paladin in a friendly Forcefield', hit(10, { isAttack: false, reductions: [ARMOR, FIELD] }), 1],
    ['B13 Beast (20) on a defending Paladin in a Forcefield', hit(20, { reductions: [ARMOR, FIELD], defending: true }), 5],
    ['B14 Slam splash (3) on a Footman in formation', hit(3, { isAttack: false, reductions: [LINE] }), 1],
    ['B15a Slam from a Beast next to Ratasius (target)', hit(10, { isAttack: false, subtractions: [WEAK] }), 6],
    ['B15b Slam from a Beast next to Ratasius (splash; R13: floor 1)', hit(3, { isAttack: false, subtractions: [WEAK] }), 1],
    ['B16 mine on a Beast', hit(10, { isAttack: false }), 10],
    ['B17 mine on a defending Beast', hit(10, { isAttack: false, defending: true }), 5],
    ['B18 mine on a Paladin', hit(5, { isAttack: false, reductions: [ARMOR] }), 2],
    ['B19 mine on a Footman in formation in a Forcefield', hit(5, { isAttack: false, reductions: [LINE, FIELD] }), 1],
    ['B20 Pajazon tick on a Trill Footman in formation', hit(3, { isAttack: false, reductions: [LINE] }), 1],
    ['B21 Pajazon tick next to Ratasius (never weakened)', hit(3, { isAttack: false }), 3],
    ['B22 Julio sacrificing a full Beast, on an Emissary (uncapped arithmetic)', hit(40, { isAttack: false }), 40],
    ['B23 Julio next to Ratasius sacrificing a dummy (7)', hit(7, { isAttack: false, subtractions: [WEAK] }), 3],
    ['B24 Sabrina dummy with Mad inventor and the Keep attacks a Footman', hit(0 + 2 + 1 + 3), 6],
    ['B25 Keep Berserker next to a Priestess attacks an Emissary', hit(12 + 3 + 1), 16],
    ['B26 Keep Assault (10) on a defending Soldier', hit(10, { defending: true }), 5],
    ['B27 Berserker on a defending Footman in formation', hit(12, { reductions: [LINE], defending: true }), 5],
    ['B28 Beast (20) on a defending Paladin', hit(20, { reductions: [ARMOR], defending: true }), 9],
  ])('%s = %i', (_name, actual, expected) => {
    expect(actual).toBe(expected)
  })

  it('adds attacker bonuses to attacks only (A3-02)', () => {
    expect(hit(5, { isAttack: false, additions: [c('x', 3)] })).toBe(5)
  })

  it('keeps the old "a 0 hit is no damage" rule behind WEAKNESS_FLOOR = 0 (A3-04 before R13)', () => {
    const input: PipelineInput = { base: 1, isAttack: true, additions: [], subtractions: [WEAK], reductions: [], defending: true }
    expect(runPipeline(input).amount).toBe(1)
    expect(runPipeline(input, { ...PIPELINE_RULES, weaknessFloor: 0 }).amount).toBe(0)
  })

  it('can swap Defend and flat reductions with DAMAGE_ORDER (C3)', () => {
    const input: PipelineInput = { base: 12, isAttack: true, additions: [], subtractions: [], reductions: [ARMOR], defending: true }
    expect(runPipeline(input, { ...PIPELINE_RULES, order: 'halveThenSubtract' }).amount).toBe(3)
    expect(runPipeline(input).amount).toBe(5)
  })

  it('records each step with running totals and floors', () => {
    const { breakdown } = runPipeline({ base: 1, isAttack: true, additions: [], subtractions: [], reductions: [ARMOR], defending: true })
    expect(breakdown.map((s) => [s.step, s.source, s.delta, s.total])).toEqual([
      ['base', 'base', 1, 1],
      ['reduction', 'paladin.reinforcedArmor', -3, -2],
      ['reduction', 'floor', 3, 1],
      ['defend', 'defend', 0, 1],
    ])
  })
})

function damageTo(events: readonly GameEvent[], unitId: string): number[] {
  return events.flatMap((e) => (e.type === 'unitDamaged' && e.unitId === unitId && e.visibleTo.length > 0 ? [e.amount] : [])).slice(0, 1)
}

describe('damage through real attacks (integration, current stats)', () => {
  it.each([
    ['berserker', false, 6], // R20/R21: 8 - 2
    ['berserker', true, 3], // ceil(6 / 2)
    ['footman', false, 1],
    ['footman', true, 1],
  ] as const)('%s hits a Paladin (defending: %s) for %i', (attacker, defending, expected) => {
    const b = buildBattle({ south: [`${attacker}@E5:A`], north: [{ type: 'paladin', at: 'E6', label: 'P', defending }] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('A'), target: { kind: 'unit', unitId: b.id('P') } })
    expect(damageTo(r.events, b.id('P'))).toEqual([expected])
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(18 - expected)
  })

  it('B28 shape: a Beast hits a defending Paladin for ceil((20 - 2) / 2) = 9', () => {
    const b = buildBattle({ south: ['beast@E5:B'], north: [{ type: 'paladin', at: 'E7', label: 'P', defending: true }] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('P') } })
    expect(damageTo(r.events, b.id('P'))).toEqual([9])
  })

  it('R31: the Keep gives +1 Power to its controller, for attacks only', () => {
    const b = buildBattle({ south: ['footman@E5:F'], north: ['paladin@E6:P', 'footman@J20:G'], control: { keep: 'south' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('F'), target: { kind: 'unit', unitId: b.id('P') } })
    expect(damageTo(r.events, b.id('P'))).toEqual([1]) // max(1, 2 - 2)
    const plain = buildBattle({ south: ['berserker@E5:B'], north: ['soldier@E6:S'], control: { keep: 'south' } })
    const r2 = act(plain.state, plain.south, { kind: 'attack', unitId: plain.id('B'), target: { kind: 'unit', unitId: plain.id('S') } })
    expect(damageTo(r2.events, plain.id('S'))).toEqual([9])
  })

  it('B16 / B18 shape: mines deal 10 to a Size-2 unit and 5 - 2 to a Paladin', () => {
    const beast = buildBattle({ south: ['beast@E5:B'], mines: [{ owner: 'north', at: 'E7' }] })
    const r = act(beast.state, beast.south, { kind: 'move', unitId: beast.id('B'), path: [parseSquare('E6')] })
    expect(damageTo(r.events, beast.id('B'))).toEqual([10])
    const paladin = buildBattle({ south: ['paladin@E5:P'], mines: [{ owner: 'north', at: 'E6' }] })
    const r2 = act(paladin.state, paladin.south, { kind: 'move', unitId: paladin.id('P'), path: [parseSquare('E6')] })
    expect(damageTo(r2.events, paladin.id('P'))).toEqual([3])
  })

  it('Defend halves every instance, rounding up (L15)', () => {
    const b = buildBattle({ south: ['berserker@E5:B'], north: [{ type: 'soldier', at: 'E6', label: 'S', defending: true }] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(damageTo(r.events, b.id('S'))).toEqual([4])
  })
})
