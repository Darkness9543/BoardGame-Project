// Kernel hooks that the ruled abilities rely on, exercised with test-local stand-ins (the real ability files are
// other agents' work): the splash helper (Smite R25, Forceful slam A8-20) and an aura that adds toughness and a
// flat damage reduction (Hex Ward, R11 variant B). The AP-income hook (Tribute, R25) is in ap.test.ts and the
// reaction prompt with AP debt (Cauldron, R11) in primitives.test.ts.

import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { BABA_HEX_RANGE, BABA_HEX_REDUCTION, BABA_HEX_TOUGHNESS, SLAM_FRIENDLY_FIRE } from './constants'
import { abilityParam } from './content/abilities'
import { adjacentSquares, parseSquare, slamSplash } from './geometry'
import type { StatsQuery } from './query'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import type { UnitCore } from './types'
import { projectView } from './view'

registerAbility(
  {
    id: 'emissary.smite',
    status: 'implemented',
    active: {
      targets: [{ kind: 'unit', label: 'Target', range: 3, relation: 'harmful', includeSelf: false, allowCommander: true }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        const target = t?.kind === 'unit' ? ctx.unit(t.unitId) : undefined
        if (target?.anchor == null) return
        ctx.dealSplash({
          source: 'emissary.smite',
          dealer: unit,
          target,
          damage: abilityParam('emissary.smite', 'damage'),
          squares: adjacentSquares(target.anchor, ctx.sizeOf(target), 'ORTHO_4'),
          splash: abilityParam('emissary.smite', 'splash'),
          friendlyFire: true,
        })
      },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'beast.forcefulSlam',
    status: 'implemented',
    active: {
      targets: [{ kind: 'square', label: 'Target', minRange: 1, range: 1, free: false }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        if (t?.kind !== 'square' || unit.anchor === null) return
        ctx.dealSplash({
          source: 'beast.forcefulSlam',
          dealer: unit,
          target: ctx.unitAt(t.square) ?? null,
          damage: abilityParam('beast.forcefulSlam', 'damage'),
          squares: slamSplash(unit.anchor, ctx.sizeOf(unit), t.square),
          splash: abilityParam('beast.forcefulSlam', 'splash'),
          friendlyFire: SLAM_FRIENDLY_FIRE,
        })
      },
    },
  },
  { replace: true },
)
const hexed = (q: StatsQuery, holder: UnitCore, target: UnitCore): boolean =>
  target.owner === holder.owner && target.id !== holder.id && q.tierOf(target) === 1 && q.distance(holder, target) <= BABA_HEX_RANGE
registerAbility(
  {
    id: 'babaYaga.hexWard',
    status: 'implemented',
    modifyStats: (q, holder, target) => (hexed(q, holder, target) ? { maxToughness: BABA_HEX_TOUGHNESS } : null),
    targetReduction: (q, holder, hit) => (hexed(q, holder, hit.target) ? BABA_HEX_REDUCTION : 0),
  },
  { replace: true },
)

const toughness = (state: Parameters<typeof unitIn>[0], id: string): number | undefined => unitIn(state, id)?.toughness

describe('dealSplash: Smite (R25)', () => {
  const b = buildBattle({
    south: ['emissary@E6:E', 'footman@F8:OWN'],
    north: ['paladin@E8:T', 'footman@E9:N1', 'paladin@D8:N2', 'soldier@E10:FAR'],
    mines: [{ owner: 'north', at: 'E7' }],
  })
  const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: b.id('T') }] })

  it('deals 8 to the target and 3 to every unit on its 4 orthogonal neighbours, own units included', () => {
    expect(toughness(r.state, b.id('T'))).toBe(18 - (8 - 2)) // Reinforced Armor on the main hit, once
    expect(unitIn(r.state, b.id('N1'))).toBeUndefined()
    expect(unitIn(r.state, b.id('OWN'))).toBeUndefined() // friendly fire on the splash (R25)
    expect(toughness(r.state, b.id('N2'))).toBe(18 - 1) // 3 - 2, floor 1
    expect(toughness(r.state, b.id('FAR'))).toBe(7)
  })

  it('is one ability-damage instance per unit and never sets off a mine', () => {
    const damaged = r.events.filter((e) => e.type === 'unitDamaged')
    expect(damaged.every((e) => e.type === 'unitDamaged' && e.kind === 'ability' && e.source === 'emissary.smite')).toBe(true)
    expect(new Set(damaged.map((e) => (e.type === 'unitDamaged' ? e.unitId : ''))).size).toBe(4)
    expect(r.state.mines).toHaveLength(1)
  })

  it('may target an own unit (R14) and splashes around it', () => {
    const own = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: b.id('OWN') }] })
    expect(unitIn(own.state, b.id('OWN'))).toBeUndefined()
    expect(toughness(own.state, b.id('T'))).toBe(18 - 1)
  })
})

describe('dealSplash: Forceful slam (A8-20)', () => {
  it('hits a unit covering the target and splash squares once, with the main damage only', () => {
    const b = buildBattle({ south: ['beast@E5:B', 'footman@D7:OWN'], north: ['beast@E7:T', 'footman@D8:N'] })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('B'), abilityId: 'beast.forcefulSlam', targets: [{ kind: 'square', square: parseSquare('E7') }] })
    expect(toughness(r.state, b.id('T'))).toBe(40 - 10)
    expect(unitIn(r.state, b.id('N'))).toBeUndefined()
    expect(unitIn(r.state, b.id('OWN'))).toBeUndefined() // SLAM_FRIENDLY_FIRE
    expect(toughness(r.state, b.id('B'))).toBe(40)
  })

  it('splashes even when the target square is empty', () => {
    const b = buildBattle({ south: ['beast@E5:B'], north: ['footman@E8:N'] })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('B'), abilityId: 'beast.forcefulSlam', targets: [{ kind: 'square', square: parseSquare('E7') }] })
    expect(unitIn(r.state, b.id('N'))).toBeUndefined()
  })
})

describe('an aura with toughness and a flat damage reduction (Hex Ward, R11 variant B)', () => {
  const setup = () =>
    buildBattle({
      south: ['commander@E3:Y', 'footman@E5:IN', 'footman@E8:OUT', 'soldier@F3:S'],
      north: ['soldier@E6:A', 'soldier@E9:B', 'footman@D5:F'],
      commanders: { south: 'babaYaga' },
      variants: { south: 'hex-ward' },
      active: 'north',
    })

  it('gives own white units in range +1 max and current toughness, nobody else', () => {
    const b = setup()
    const view = projectView(b.state, b.south)
    const stats = (label: string) => view.units.find((u) => u.id === b.id(label))
    expect(stats('IN')).toMatchObject({ toughness: 3, maxToughness: 3 })
    expect(stats('OUT')).toMatchObject({ toughness: 2, maxToughness: 2 })
    expect(stats('S')).toMatchObject({ toughness: 7, maxToughness: 7 })
  })

  it('takes 1 less from every hit, added to other reductions, with the usual floor of 1', () => {
    const b = setup()
    let state = act(b.state, b.north, { kind: 'attack', unitId: b.id('A'), target: { kind: 'unit', unitId: b.id('IN') } }).state
    expect(toughness(state, b.id('IN'))).toBe(3 - (2 - 1))
    state = act(state, b.north, { kind: 'attack', unitId: b.id('F'), target: { kind: 'unit', unitId: b.id('IN') } }).state
    expect(toughness(state, b.id('IN'))).toBe(2 - 1) // a 1-Power hit still deals 1
    state = act(state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('OUT') } }).state
    expect(unitIn(state, b.id('OUT'))).toBeUndefined() // out of range: the full 2
  })

  it('never kills when the aura is lost (A3-11)', () => {
    const b = setup()
    const hurt = act(b.state, b.north, { kind: 'attack', unitId: b.id('A'), target: { kind: 'unit', unitId: b.id('IN') } }).state
    const hurtMore = act(hurt, b.north, { kind: 'attack', unitId: b.id('F'), target: { kind: 'unit', unitId: b.id('IN') } }).state
    const south = act(hurtMore, b.north, { kind: 'endTurn' }).state
    const moved = act(south, b.south, { kind: 'move', unitId: b.id('Y'), path: sqs('D3') }).state // E5 is now at distance 3 still
    expect(toughness(moved, b.id('IN'))).toBe(1)
    const away = act(moved, b.south, { kind: 'move', unitId: b.id('IN'), path: sqs('F5') }).state // distance 4: aura lost
    expect(unitIn(away, b.id('IN'))).toMatchObject({ toughness: 1, auraToughness: 0 })
  })
})
