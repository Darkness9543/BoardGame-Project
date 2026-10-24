import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { TRILL_TOUGHNESS_BONUS } from '../../constants'
import { abilityParam } from '../../content/abilities'
import { unitDef } from '../../content/units'
import type { GameEvent } from '../../events'
import { area3x3, parseSquare, sameSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn, type Battle } from '../../testing/dsl'
import type { GameState, Seat, Square } from '../../types'

const REDUCTION = abilityParam('footman.lineFormation', 'reduction')
const BERSERKER = unitDef('berserker').power
const TICK = abilityParam('royalWizard.pajazon', 'damage')
const FORCEFIELD = abilityParam('royalWizard.forcefield', 'reduction')
const MINE = abilityParam('artificer.tripMine', 'damage')

// Test-local stand-ins for other files' abilities, so these tests exercise Line Formation alone: a Pajazon-like tick,
// a Forcefield-like area reduction and Trill's toughness bonus (R23).
const inside = (squares: readonly Square[], footprint: readonly Square[]): boolean => footprint.some((s) => squares.some((a) => sameSquare(a, s)))
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) =>
        ending === area.owner ? null : { damage: q.units().filter((u) => u.owner === ending && inside(area.squares, q.footprint(u))).map((u) => ({ target: u.id, amount: TICK })) },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'royalWizard.forcefield',
    status: 'implemented',
    area: { targetReduction: (q, area, hit) => (hit.target.owner === area.owner && inside(area.squares, q.footprint(hit.target)) ? FORCEFIELD : 0) },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'trill.hydrocephalic',
    status: 'implemented',
    modifyStats: (q, holder, target) => {
      const tier = q.tierOf(target)
      return target.owner === holder.owner && (tier === 1 || tier === 2 || tier === 5) ? { baseToughness: TRILL_TOUGHNESS_BONUS } : null
    },
  },
  { replace: true },
)

function amountsTo(events: readonly GameEvent[], unitId: string): number[] {
  return events.flatMap((e) => (e.type === 'unitDamaged' && e.unitId === unitId ? [e.amount] : []))
}

/** The attacker (a South unit) hits the target once from the battle's starting state; returns the damage dealt. */
function strike(b: Battle, attacker: string, target: string): number[] {
  const r = act(b.state, b.south, { kind: 'attack', unitId: b.id(attacker), target: { kind: 'unit', unitId: b.id(target) } })
  return amountsTo(r.events, b.id(target))
}

function addArea(state: GameState, abilityId: string, owner: Seat, squares: readonly Square[]): void {
  state.areas.push({ id: `a-test${state.areas.length}`, abilityId, owner, sourceId: null, squares: [...squares], createdOnOwnTurn: 0, expiresAtOwnTurn: 9, seq: state.nextSeq++, data: {} })
}

describe('footman.lineFormation (8.1, A8-01)', () => {
  it('protects only the middle of a line of three (FTM-1, FTM-3)', () => {
    const b = buildBattle({ south: ['berserker@M14:BM', 'berserker@L14:BL'], north: ['footman@L15:L', 'footman@M15:M', 'footman@N15:N'] })
    expect(strike(b, 'BM', 'M')).toEqual([BERSERKER - REDUCTION])
    expect(strike(b, 'BL', 'L')).toEqual([BERSERKER])
  })

  it('protects all four Footmen of a 2x2 block under orthogonal adjacency (FTM-3, X-29)', () => {
    const b = buildBattle({
      south: ['berserker@L14:A', 'berserker@M14:B', 'berserker@K16:C', 'berserker@N16:D'],
      north: ['footman@L15:F1', 'footman@M15:F2', 'footman@L16:F3', 'footman@M16:F4'],
    })
    expect([strike(b, 'A', 'F1'), strike(b, 'B', 'F2'), strike(b, 'C', 'F3'), strike(b, 'D', 'F4')]).toEqual(Array(4).fill([BERSERKER - REDUCTION]))
  })

  it('protects only the corner of an L', () => {
    const b = buildBattle({ south: ['berserker@L14:A', 'berserker@K16:B', 'berserker@M14:C'], north: ['footman@L16:TOP', 'footman@L15:CORNER', 'footman@M15:RIGHT'] })
    expect(strike(b, 'A', 'CORNER')).toEqual([BERSERKER - REDUCTION])
    expect(strike(b, 'B', 'TOP')).toEqual([BERSERKER])
    expect(strike(b, 'C', 'RIGHT')).toEqual([BERSERKER])
  })

  it('is on or off: four neighbours still give only -2 (FTM-1), here against ability damage', () => {
    // The centre of a plus has no free neighbour, so a Juliomancer at range 2 hits it with a sacrificed Soldier (7).
    const b = buildBattle({
      south: ['juliomancer@O16:J', 'soldier@O17:S'],
      north: ['footman@M16:C', 'footman@M15', 'footman@M17', 'footman@L16', 'footman@N16'],
    })
    const r = act(b.state, b.south, {
      kind: 'useAbility',
      unitId: b.id('J'),
      abilityId: 'juliomancer.julioVernification',
      targets: [
        { kind: 'unit', unitId: b.id('S') },
        { kind: 'unit', unitId: b.id('C') },
      ],
    })
    expect(amountsTo(r.events, b.id('C'))).toEqual([unitDef('soldier').toughness - REDUCTION])
  })

  it('counts own Footmen only: never enemy Footmen, dummies or Mercenaries (FTM-2, FTM-5)', () => {
    const enemies = buildBattle({ south: ['berserker@M14:B', 'footman@L15', 'footman@N15'], north: ['footman@M15:F'] })
    expect(strike(enemies, 'B', 'F')).toEqual([BERSERKER])
    const others = buildBattle({ south: ['berserker@M14:B'], north: ['footman@M15:F', 'noAcb@L15', 'mercenary@N15'] })
    expect(strike(others, 'B', 'F')).toEqual([BERSERKER])
  })

  it('protects the Footman itself, not its neighbours', () => {
    const b = buildBattle({ south: ['berserker@M14:B'], north: ['soldier@M15:S', 'footman@L15', 'footman@N15'] })
    expect(strike(b, 'B', 'S')).toEqual([BERSERKER])
  })

  it('subtracts before Defend halves (FTM-6, B27: 8 - 2 = 6, halved to 3)', () => {
    const b = buildBattle({ south: ['berserker@M14:B'], north: [{ type: 'footman', at: 'M15', label: 'F', defending: true }, 'footman@L15', 'footman@N15'] })
    expect(strike(b, 'B', 'F')).toEqual([Math.ceil((BERSERKER - REDUCTION) / 2)])
  })

  it('never takes a hit below 1 (A3-05)', () => {
    const b = buildBattle({ south: ['footman@M14:A'], north: ['footman@M15:F', 'footman@L15', 'footman@N15'] })
    expect(strike(b, 'A', 'F')).toEqual([1])
  })

  it('applies to mines, on its own turn too: 5 - 2 = 3 (A8-01)', () => {
    const b = buildBattle({ south: ['footman@E5', 'footman@G5', 'footman@F4:X'], mines: [{ owner: 'north', at: 'F5' }] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('X'), path: sqs('F5') })
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'unitDamaged', unitId: b.id('X'), amount: MINE - REDUCTION, kind: 'mine' }))
  })

  it('judges simultaneous damage on the board before the blast (FTM-4): a tick kills the ends, the middle keeps its -2', () => {
    const b = buildBattle({ south: ['footman@E5:L', 'footman@F5:M', 'footman@G5:R'] })
    addArea(b.state, 'royalWizard.pajazon', b.north, area3x3(parseSquare('F5')))
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('L'))).toBeUndefined()
    expect(unitIn(r.state, b.id('R'))).toBeUndefined()
    expect(unitIn(r.state, b.id('M'))?.toughness).toBe(unitDef('footman').toughness - (TICK - REDUCTION))
  })

  it('adds up with a Forcefield, still at least 1 (FTM-7, B19)', () => {
    const b = buildBattle({ south: ['footman@E5', 'footman@G5', 'footman@F4:X'], mines: [{ owner: 'north', at: 'F5' }] })
    addArea(b.state, 'royalWizard.forcefield', b.south, sqs('F5'))
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('X'), path: sqs('F5') })
    expect(amountsTo(r.events, b.id('X'))).toEqual([1])
    expect(unitIn(r.state, b.id('X'))?.toughness).toBe(unitDef('footman').toughness - 1)
  })

  it('keeps Trill Footmen (1/3 under R23) alive through a tick: 3 - 2 = 1, while the ends die (FTM-8, X-21)', () => {
    const b = buildBattle({ south: ['footman@E5:L', 'footman@F5:M', 'footman@G5:R'], commanders: { south: 'trill' } })
    const toughness = unitDef('footman').toughness + TRILL_TOUGHNESS_BONUS
    expect(unitIn(b.state, b.id('M'))?.toughness).toBe(toughness)
    addArea(b.state, 'royalWizard.pajazon', b.north, area3x3(parseSquare('F5')))
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('M'))?.toughness).toBe(toughness - (TICK - REDUCTION))
    expect(unitIn(r.state, b.id('L'))).toBeUndefined()
  })
})
