import { describe, expect, it } from 'vitest'
import { act, buildBattle, projectView } from '@coinduel/engine'
import { canStillAct, readyUnits } from './rules'

describe('"can still act" (S-12.1)', () => {
  it('counts an enabled ability cheaper than the unit\'s AP: a Rogue with 1 AP can still Stealth', () => {
    const b = buildBattle({ south: ['rogue@E5:R', 'commander@M3:C'], ap: 2 })
    const state = act(b.state, b.south, { kind: 'defend', unitId: b.id('C') }).state // 1 AP left; the Rogue's actions cost 2
    const view = projectView(state, b.south)
    const rogue = view.units.find((u) => u.id === b.id('R'))
    if (rogue === undefined) throw new Error('no rogue')
    expect(canStillAct(view, rogue)).toBe(true)
    expect(readyUnits(view).map((u) => u.id)).toEqual([b.id('R')])
  })

  it('does not count it when it is disabled: a watched Rogue with 1 AP cannot act', () => {
    const b = buildBattle({ south: ['rogue@E5:R', 'commander@M3:C'], north: ['soldier@E7:S'], ap: 2 })
    const state = act(b.state, b.south, { kind: 'defend', unitId: b.id('C') }).state
    const view = projectView(state, b.south)
    const rogue = view.units.find((u) => u.id === b.id('R'))
    if (rogue === undefined) throw new Error('no rogue')
    expect(canStillAct(view, rogue)).toBe(false)
  })
})
