// Footman (RULES_INTERPRETATION 8.1): Line Formation, a target-side flat reduction.

import { abilityParam } from '../../content/abilities'
import type { RulesQuery } from '../../query'
import type { UnitCore } from '../../types'
import type { AbilityDefinition } from '../types'

const LINE_FORMATION = 'footman.lineFormation'
const ALLIES = abilityParam(LINE_FORMATION, 'allies')
const REDUCTION = abilityParam(LINE_FORMATION, 'reduction')

/**
 * FTM-1: "another 2" = at least two others; FTM-2: own Footmen only; FTM-5: dummies and Mercenaries are never
 * Footmen. Adjacency follows ADJACENCY, so under ORTHO_4 a 2x2 block protects all four (FTM-3, X-29).
 */
function inFormation(q: RulesQuery, footman: UnitCore): boolean {
  return q.adjacentUnits(footman).filter((u) => u.owner === footman.owner && u.type === 'footman').length >= ALLIES
}

export const footmanAbilities: readonly AbilityDefinition[] = [
  {
    id: LINE_FORMATION,
    status: 'implemented',
    // A8-01: every damage kind on both players' turns, on or off (4 neighbours still give -2). The floor of 1 is the
    // pipeline's (A3-05), and simultaneous damage is computed on the board before the blast (FTM-4, 3.4).
    targetReduction: (q, holder, hit) => (hit.target.id === holder.id && inFormation(q, holder) ? REDUCTION : 0),
  },
]
