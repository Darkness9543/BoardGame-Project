// Ranger (RULES_INTERPRETATION 8.4). Kernel exemplar: a static stat modifier. With range >= 2 the core
// attack rules (attack.ts) let it target any square without an own unit (blind shot, A2-18) and set off a
// mine there (L101); it is the only "ranged attack" in v1.

import { abilityParam } from '../../content/abilities'
import type { AbilityDefinition } from '../types'

const RANGED_ATTACK = 'ranger.rangedAttack'
const RANGE = abilityParam(RANGED_ATTACK, 'range')

export const rangerAbilities: readonly AbilityDefinition[] = [
  {
    id: RANGED_ATTACK,
    status: 'implemented',
    // A8-04 / RNG-1..2: range 2 (Manhattan, no minimum, no line-of-fire check); Kulega's LOV bonus leaves it at 2.
    modifyStats: (_q, holder, target) => (target.id === holder.id ? { attackRange: RANGE } : null),
  },
]
