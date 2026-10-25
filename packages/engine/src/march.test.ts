// R46 Group march: the scaling price (1-3 units 2 AP, 4-5 units 3 AP, 6 units 4 AP) and the same-type rule with
// the Soldier's Lockstep exception.

import { describe, expect, it } from 'vitest'
import { act, buildBattle, projectView, validate, type Intent } from './index'
import { groupMarchCost, marchTypesCompatible } from './index'

function march(unitIds: readonly string[]): Intent {
  return { kind: 'groupMarch', unitIds, direction: 'north' }
}

function messageOf(v: unknown): string {
  return typeof v === 'object' && v !== null && 'message' in v ? String((v as { message: unknown }).message) : ''
}

describe('R46 group march cost', () => {
  it('follows the owner table: 1-3 units 2 AP, 4-5 units 3 AP, 6 units 4 AP', () => {
    expect([1, 2, 3, 4, 5, 6].map(groupMarchCost)).toEqual([2, 2, 2, 3, 3, 4])
  })

  it('spends the scaled price when the group marches', () => {
    const b = buildBattle({ south: ['footman@E3:A', 'footman@F3:B', 'footman@G3:C', 'footman@H3:D', 'footman@I3:E', 'footman@J3:F'], north: ['footman@M20:N'] })
    const seat = b.seat('south')
    const before = projectView(b.state, seat).myAp
    const after = act(b.state, seat, march([b.id('A'), b.id('B'), b.id('C'), b.id('D'), b.id('E'), b.id('F')])).state
    expect(before - projectView(after, seat).myAp).toBe(4)
    const trio = act(b.state, seat, march([b.id('A'), b.id('B'), b.id('C')])).state
    expect(before - projectView(trio, seat).myAp).toBe(2)
    const four = act(b.state, seat, march([b.id('A'), b.id('B'), b.id('C'), b.id('D')])).state
    expect(before - projectView(four, seat).myAp).toBe(3)
  })
})

describe('R46 same-type rule and Lockstep', () => {
  it('refuses a group that mixes unit types', () => {
    const b = buildBattle({ south: ['footman@E3:A', 'mercenary@F3:M'], north: ['footman@M20:N'] })
    const v = validate(b.state, b.seat('south'), march([b.id('A'), b.id('M')]))
    expect(v.ok).toBe(false)
    expect(messageOf(v)).toMatch(/own type/)
  })

  it('accepts a group of one type, and a Soldier joining any group', () => {
    const b = buildBattle({ south: ['footman@E3:A', 'footman@F3:B', 'soldier@G3:S', 'mercenary@H3:M'], north: ['footman@M20:N'] })
    const seat = b.seat('south')
    expect(validate(b.state, seat, march([b.id('A'), b.id('B')])).ok).toBe(true)
    expect(validate(b.state, seat, march([b.id('A'), b.id('B'), b.id('S')])).ok).toBe(true)
    expect(validate(b.state, seat, march([b.id('S'), b.id('M')])).ok).toBe(true)
    // Footman + Soldier + Mercenary: the Soldier is fine, but Footman and Mercenary are two strict types.
    expect(validate(b.state, seat, march([b.id('A'), b.id('B'), b.id('S'), b.id('M')])).ok).toBe(false)
  })

  it('exposes the rule to clients', () => {
    expect(marchTypesCompatible(['footman', 'footman', 'soldier'])).toBe(true)
    expect(marchTypesCompatible(['footman', 'mercenary'])).toBe(false)
    expect(marchTypesCompatible(['soldier', 'beast'])).toBe(true)
    expect(marchTypesCompatible(['soldier'])).toBe(true)
  })
})
