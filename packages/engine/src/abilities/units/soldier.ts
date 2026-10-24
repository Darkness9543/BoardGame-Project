// Soldier (RULES_INTERPRETATION 8.3). Kernel exemplar: an end-of-own-turn trigger.

import { abilityParam } from '../../content/abilities'
import type { AbilityDefinition } from '../types'

const PERSEVERANCE = 'soldier.perseverance'
const HEAL = abilityParam(PERSEVERANCE, 'heal')

export const soldierAbilities: readonly AbilityDefinition[] = [
  {
    id: PERSEVERANCE,
    status: 'implemented',
    // A8-03 / SOL-1..3: every own turn end, capped; it lands after end-of-turn damage (2.10 step 3), so a
    // Soldier killed by an enemy Pajazon tick never regenerates (T9, T10).
    endOfOwnTurn: (_q, holder) => ({ heal: [{ target: holder.id, amount: HEAL }] }),
  },
]
