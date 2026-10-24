import { describe, expect, it } from 'vitest'
import { act, buildBattle, unitIn } from '../../testing/dsl'
import { filterEvents } from '../../view'

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
})
