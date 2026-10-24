// Beast of Knorund (RULES_INTERPRETATION 8.12). It is Size 2 (1.6): ranges and adjacency are measured from its
// nearest square, so it has 8 adjacent squares.

import { abilityParam } from '../../content/abilities'
import { FEAST_TOUGHNESS, SACRIFICE_ENEMIES, SLAM_FRIENDLY_FIRE } from '../../constants'
import { adjacencyMetric, slamSplash } from '../../geometry'
import type { RulesQuery } from '../../query'
import type { UnitCore } from '../../types'
import type { AbilityDefinition } from '../types'

const SLAM = 'beast.forcefulSlam'
const FEAST = 'beast.feast'

const SLAM_DAMAGE = abilityParam(SLAM, 'damage')
const SLAM_SPLASH = abilityParam(SLAM, 'splash')

/** A8-21 / BEA-12 (Q87): what Feast heals, read just before the sacrifice, auras included (3.9). */
function feastAmount(q: RulesQuery, eaten: UnitCore): number {
  switch (FEAST_TOUGHNESS) {
    case 'current':
      return eaten.toughness
    case 'base':
      return q.stats(eaten).baseToughness
    case 'max':
      return q.stats(eaten).maxToughness
  }
}

export const beastAbilities: readonly AbilityDefinition[] = [
  {
    id: SLAM,
    status: 'implemented',
    active: {
      // A8-20: any existing square adjacent to the footprint, empty or not (the UI confirms own victims, X-18).
      targets: [{ kind: 'square', label: 'Target square', minRange: 1, range: 1, metric: adjacencyMetric(), free: false }],
      resolve: (ctx, unit, targets) => {
        const target = targets[0]
        if (target?.kind !== 'square' || unit.anchor === null) return
        // A8-20 / BEA-1..4 / A3-07: 10 on the unit on the target, 3 on each unit on the 5 squares beyond and beside
        // it, as one simultaneous effect: every unit is hit once, a unit on both takes the 10 only. Hidden units are
        // hit too (BEA-5); no mine goes off; off-board squares and blockers absorb nothing. The Beast is the dealer,
        // so weakness applies (BEA-6, R13 floor 1) and the Keep doesn't (BEA-7).
        ctx.dealSplash({
          source: SLAM,
          dealer: unit,
          target: ctx.unitAt(target.square) ?? null,
          damage: SLAM_DAMAGE,
          squares: slamSplash(unit.anchor, ctx.sizeOf(unit), target.square),
          splash: SLAM_SPLASH,
          friendlyFire: SLAM_FRIENDLY_FIRE, // BEA-3 (Q66)
        })
      },
    },
  },
  {
    id: FEAST,
    status: 'implemented',
    active: {
      // A8-21 / BEA-8 / A3-13: an adjacent own unit, never a commander (or an enemy, SACRIFICE_ENEMIES).
      targets: [{ kind: 'unit', label: 'Unit to eat', range: 1, metric: adjacencyMetric(), relation: SACRIFICE_ENEMIES ? 'any' : 'own', includeSelf: false, allowCommander: false }],
      resolve: (ctx, unit, targets) => {
        const target = targets[0]
        const eaten = target?.kind === 'unit' ? ctx.unit(target.unitId) : undefined
        if (eaten === undefined) return
        const amount = feastAmount(ctx, eaten)
        // A3-13 / BEA-10: a death for every trigger, which runs after this effect (2.11).
        ctx.sacrifice(eaten, FEAST)
        ctx.heal(unit, amount, FEAST) // A3-10 / BEA-9: capped at max toughness, no overheal
      },
    },
  },
]
