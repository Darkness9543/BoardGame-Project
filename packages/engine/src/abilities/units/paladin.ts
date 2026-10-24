// Paladin (RULES_INTERPRETATION 8.9). Kernel exemplar: a target-side flat reduction.

import { abilityParam } from '../../content/abilities'
import type { AbilityDefinition } from '../types'

const REINFORCED_ARMOR = 'paladin.reinforcedArmor'
const REDUCTION = abilityParam(REINFORCED_ARMOR, 'reduction')

export const paladinAbilities: readonly AbilityDefinition[] = [
  {
    id: REINFORCED_ARMOR,
    status: 'implemented',
    // A8-12 / PAL-1..3 / R21: -2 (the `reduction` param) at pipeline step 4 on every damage instance this unit
    // receives (floor 1 is the pipeline's, A3-05); sacrifices and other non-damage loss never reach the pipeline.
    targetReduction: (_q, holder, hit) => (hit.target.id === holder.id ? REDUCTION : 0),
  },
]
