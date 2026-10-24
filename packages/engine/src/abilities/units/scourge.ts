// Scourge of the Gods (RULES_INTERPRETATION 8.14). STUB: owned by the abilities agent.

import type { AbilityDefinition } from '../types'

export const scourgeAbilities: readonly AbilityDefinition[] = [
  {
    id: 'scourge.commandAura',
    status: 'stub',
    // TODO(A8-25, SCO-1..7): modifyStats(q, holder, target): own units within params.range of the holder
    // (q.distance, not the holder itself) get { actions: params.extraActions }. The allowance is evaluated
    // when an action is declared, so moving out of range loses the unused action (SCO-1, X-27).
  },
  {
    id: 'scourge.tribute',
    status: 'stub',
    // TODO(R25, Q101): startOfTurnAp: () => params.ap (SCOURGE_AP_BONUS). The core adds it to its owner's pool
    // after the cap while this unit lives; same-named bonuses count once (A3-15).
  },
]
