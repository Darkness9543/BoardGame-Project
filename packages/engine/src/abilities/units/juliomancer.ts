// Juliomancer (RULES_INTERPRETATION 8.8, with owner rulings R14 and R22).

import { abilityParam } from '../../content/abilities'
import { JULIO_RANGE_ORIGIN, SACRIFICE_ENEMIES } from '../../constants'
import { adjacencyMetric } from '../../geometry'
import type { RulesQuery } from '../../query'
import type { UnitCore } from '../../types'
import type { AbilityDefinition, AbilityTarget } from '../types'

const MINDS_EYE = 'juliomancer.mindsEye'
const JULIO = 'juliomancer.julioVernification'
const RANGE = abilityParam(JULIO, 'range')
const CAP = abilityParam(JULIO, 'cap')
/**
 * How much farther than RANGE a target may be from the Juliomancer when the range counts from the sacrificed unit:
 * adjacent (1) plus across a 2x2 footprint (2).
 */
const SACRIFICED_ORIGIN_EXTRA_REACH = 3

/** A8-11 / JUL-9 (Q88, default accepted): range 2 from the Juliomancer. The alternative origin is checked in validate. */
function targetReach(): number {
  switch (JULIO_RANGE_ORIGIN) {
    case 'juliomancer':
      return RANGE
    case 'sacrificed':
      return RANGE + SACRIFICED_ORIGIN_EXTRA_REACH
  }
}

function pickedUnit(q: RulesQuery, target: AbilityTarget | undefined): UnitCore | undefined {
  return target?.kind === 'unit' ? q.unit(target.unitId) : undefined
}

export const juliomancerAbilities: readonly AbilityDefinition[] = [
  {
    id: MINDS_EYE,
    status: 'implemented',
    // A8-10 / A4-08: enemy stealthed units inside its LOV are revealed, and enemy mines too (A4-11,
    // MINDS_EYE_REVEALS_MINES); the core checks after every step and event, on both players' turns. Revealed mines stay
    // revealed (JUL-1).
    detection: () => ({ kind: 'lov' }),
  },
  {
    id: JULIO,
    status: 'implemented',
    // A8-11: 2 AP and the Juliomancer's action (content data); both picks are made together.
    active: {
      targets: [
        // JUL-2 / A3-13: an adjacent own unit (a Beast if any square is adjacent, JUL-8), never itself or a commander.
        { kind: 'unit', label: 'Sacrifice', range: 1, metric: adjacencyMetric(), relation: SACRIFICE_ENEMIES ? 'any' : 'own', includeSelf: false, allowCommander: false },
        // R14: an enemy or one of the caster's own units (the UI confirms an own target). JUL-3: a visible unit, never a square.
        { kind: 'unit', label: 'Target', range: targetReach(), relation: 'harmful', includeSelf: false, allowCommander: true },
      ],
      validate: (q, _unit, targets) => {
        const sacrificed = pickedUnit(q, targets[0])
        const target = pickedUnit(q, targets[1])
        if (sacrificed === undefined || target === undefined) return 'Choose a unit to sacrifice and a target'
        if (sacrificed.id === target.id) return 'The target cannot be the sacrificed unit'
        if (JULIO_RANGE_ORIGIN === 'sacrificed' && q.distance(sacrificed, target) > RANGE) return 'The target is out of range of the sacrificed unit'
        return null
      },
      resolve: (ctx, unit, targets) => {
        const sacrificed = pickedUnit(ctx, targets[0])
        if (sacrificed === undefined) return
        // 3.9: its current toughness just before the sacrifice, auras included; R22 caps the damage at 15.
        const damage = Math.min(sacrificed.toughness, CAP)
        const targetId = targets[1]?.kind === 'unit' ? targets[1].unitId : null
        // A3-13 / JUL-7: a death for every trigger; the core runs its triggers after this effect (JUL-4, 2.11).
        ctx.sacrifice(sacrificed, JULIO)
        const target = targetId === null ? undefined : ctx.unit(targetId)
        // Fixed ability damage: Power bonuses such as the Keep never apply (3.2); target reductions and Defend do
        // (JUL-6), and the Juliomancer is the dealer, so Ratasius' weakness applies to it.
        if (target !== undefined) ctx.dealDamage({ target, kind: 'ability', base: damage, source: JULIO, dealer: unit })
      },
    },
  },
]
