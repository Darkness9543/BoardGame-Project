// Scourge of the Gods (RULES_INTERPRETATION 8.14; Tribute under owner ruling R25).

import { abilityParam } from '../../content/abilities'
import type { AbilityDefinition } from '../types'

const COMMAND_AURA = 'scourge.commandAura'
const TRIBUTE = 'scourge.tribute'

const AURA_RANGE = abilityParam(COMMAND_AURA, 'range')
const AURA_ACTIONS = abilityParam(COMMAND_AURA, 'extraActions')
const TRIBUTE_AP = abilityParam(TRIBUTE, 'ap')

export const scourgeAbilities: readonly AbilityDefinition[] = [
  {
    id: COMMAND_AURA,
    status: 'implemented',
    // A8-25 / SCO-1..7: own units within range 2 (footprint to footprint), never the Scourge itself, get one more
    // action, paid at its usual cost (no AP). The allowance is read when an action is declared, so leaving the range
    // or the Scourge's death loses an unused one (X-27); two Scourges still give one (A3-15); R12: it may be a Move.
    modifyStats: (q, holder, target) =>
      target.owner === holder.owner && target.id !== holder.id && q.distance(holder, target) <= AURA_RANGE ? { actions: AURA_ACTIONS } : null,
  },
  {
    id: TRIBUTE,
    status: 'implemented',
    // R25 (Q101): +2 AP at the start of each own turn while the Scourge lives, added after the R1 cap. The core
    // counts one bonus per ability id, so two Scourges give +2 once (a reading R25 doesn't settle).
    startOfTurnAp: () => TRIBUTE_AP,
  },
]
