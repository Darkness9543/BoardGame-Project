import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { TRILL_TOUGHNESS_BONUS } from '../../constants'
import { abilityParam } from '../../content/abilities'
import { unitDef } from '../../content/units'
import { area3x3, parseSquare, sameSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { GameState, Seat, Square } from '../../types'
import { filterEvents } from '../../view'

const HEAL = abilityParam('soldier.perseverance', 'heal')
const SOLDIER = unitDef('soldier').toughness
const PAJAZON_DAMAGE = abilityParam('royalWizard.pajazon', 'damage')
const PAJAZON_HEAL = abilityParam('royalWizard.pajazon', 'heal')

// Test-local stand-ins for other files' abilities: a Pajazon that heals its owner's units and damages the other
// side's at the end of a turn (A8-19), and Trill's toughness bonus (R23).
const inside = (squares: readonly Square[], footprint: readonly Square[]): boolean => footprint.some((s) => squares.some((a) => sameSquare(a, s)))
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) => {
        const units = q.units().filter((u) => u.owner === ending && inside(area.squares, q.footprint(u)))
        return ending === area.owner
          ? { heal: units.map((u) => ({ target: u.id, amount: PAJAZON_HEAL })) }
          : { damage: units.map((u) => ({ target: u.id, amount: PAJAZON_DAMAGE })) }
      },
    },
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

function addArea(state: GameState, owner: Seat, centre: string): void {
  state.areas.push({ id: `a-test${state.areas.length}`, abilityId: 'royalWizard.pajazon', owner, sourceId: null, squares: area3x3(parseSquare(centre)), createdOnOwnTurn: 0, expiresAtOwnTurn: 9, seq: state.nextSeq++, data: {} })
}

describe('soldier.perseverance (8.3, A8-03)', () => {
  it('regenerates 1 at the end of its own turn, capped at max toughness', () => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: 5 }, 'soldier@G5:FULL'] })
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(6)
    expect(unitIn(r.state, b.id('FULL'))?.toughness).toBe(7)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitHealed', unitId: b.id('S'), amount: 1, toughness: 6, source: 'soldier.perseverance' })
  })

  it("never fires at the end of the opponent's turn (SOL-1)", () => {
    const b = buildBattle({ north: [{ type: 'soldier', at: 'E15', label: 'S', toughness: 5 }] })
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(5)
    const r2 = act(r.state, b.north, { kind: 'endTurn' })
    expect(unitIn(r2.state, b.id('S'))?.toughness).toBe(6)
  })

  it('shows the heal to the opponent only if it can see the Soldier', () => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: 5 }], north: ['ranger@E8'] })
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(filterEvents(r.events, b.north).some((e) => e.type === 'unitHealed')).toBe(true)
    const hidden = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: 5 }] })
    expect(filterEvents(act(hidden.state, hidden.south, { kind: 'endTurn' }).events, hidden.north).some((e) => e.type === 'unitHealed')).toBe(false)
  })

  it('fires whether or not the Soldier acted or was hurt that turn (SOL-1)', () => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'A', toughness: 5 }, 'soldier@K5:M'], north: ['footman@E6:F'], mines: [{ owner: 'north', at: 'K6' }] })
    let state = act(b.state, b.south, { kind: 'attack', unitId: b.id('A'), target: { kind: 'unit', unitId: b.id('F') } }).state
    state = act(state, b.south, { kind: 'move', unitId: b.id('M'), path: sqs('K6') }).state
    const hurt = unitIn(state, b.id('M'))?.toughness ?? 0
    const r = act(state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('A'))?.toughness).toBe(5 + HEAL)
    expect(unitIn(r.state, b.id('M'))?.toughness).toBe(hurt + HEAL)
  })

  it.each([
    [3, undefined],
    [4, 2],
  ])('lands after enemy end-of-turn damage: a Soldier at %i inside an enemy Pajazon ends at %s (SOL-2, SOL-3, T9, T10, X-10)', (start, expected) => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: start }] })
    addArea(b.state, b.north, 'E5')
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(expected)
  })

  it('adds up with an own Pajazon heal, capped at max (SOL-4, X-25)', () => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'LOW', toughness: 2 }, { type: 'soldier', at: 'F5', label: 'HIGH', toughness: 5 }] })
    addArea(b.state, b.south, 'E5')
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('LOW'))?.toughness).toBe(2 + PAJAZON_HEAL + HEAL)
    expect(unitIn(r.state, b.id('HIGH'))?.toughness).toBe(SOLDIER)
  })

  it('regenerates up to the Trill maximum (SOL-5: a 2/8 Soldier under R23)', () => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: SOLDIER }], commanders: { south: 'trill' } })
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(SOLDIER + TRILL_TOUGHNESS_BONUS)
  })
})
