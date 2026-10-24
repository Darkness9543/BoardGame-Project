import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import { projectView } from './view'

// Test-local Strong aura stand-in (A8-08): own units adjacent to the holder get +1 Power and +1 max toughness.
registerAbility(
  {
    id: 'priestess.strongAura',
    status: 'implemented',
    modifyStats: (q, holder, target) =>
      target.id !== holder.id && target.owner === holder.owner && q.isAdjacent(holder, target) ? { power: 1, maxToughness: 1 } : null,
  },
  { replace: true },
)

const stats = (state: Parameters<typeof projectView>[0], seat: 'host' | 'guest', id: string) => {
  const u = projectView(state, seat).units.find((x) => x.id === id)
  return u === undefined ? undefined : `${u.power}/${u.toughness}/${u.maxToughness}`
}

describe('toughness auras (3.7, A3-11)', () => {
  it('T1: a commander next to its Priestess gains +1/+1 (2/6 under the R8 base of 1/5)', () => {
    const b = buildBattle({ south: ['commander@E5:C', 'priestess@E6:P'] })
    expect(stats(b.state, b.south, b.id('C'))).toBe('2/6/6')
  })

  it('T2: at 1 toughness inside the aura it steps away and stays at 1, still alive (AURA_LOSS_CAN_KILL = false)', () => {
    const b = buildBattle({ south: ['commander@E5:C', 'priestess@E6:P'] })
    const hurt = { ...b.state, units: b.state.units.map((u) => (u.id === b.id('C') ? { ...u, toughness: 1 } : u)) }
    const r = act(hurt, b.south, { kind: 'move', unitId: b.id('C'), path: sqs('D5') })
    expect(stats(r.state, b.south, b.id('C'))).toBe('1/1/5')
  })

  it('T3: a Footman at 1 inside the aura stays at 1 when the Priestess walks away (max 3 -> 2)', () => {
    const b = buildBattle({ south: [{ type: 'footman', at: 'E5', label: 'F', toughness: 1 }, 'priestess@E6:P'] })
    expect(stats(b.state, b.south, b.id('F'))).toBe('2/1/3')
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E7', 'E8') })
    expect(stats(r.state, b.south, b.id('F'))).toBe('1/1/2')
  })

  it('gaining the aura raises current and max together; one copy however many Priestesses (A3-15)', () => {
    const b = buildBattle({ south: ['soldier@E5:S', 'priestess@E7:P', 'priestess@D5:Q'] })
    expect(stats(b.state, b.south, b.id('S'))).toBe('3/8/8')
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6') })
    expect(stats(r.state, b.south, b.id('S'))).toBe('3/8/8')
    expect(unitIn(r.state, b.id('S'))?.auraToughness).toBe(1)
  })

  it('heals never exceed max toughness (A3-10)', () => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: 7 }] })
    expect(unitIn(act(b.state, b.south, { kind: 'endTurn' }).state, b.id('S'))?.toughness).toBe(7)
  })
})
