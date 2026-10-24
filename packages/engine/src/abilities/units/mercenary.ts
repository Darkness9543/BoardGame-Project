// Mercenary (RULES_INTERPRETATION 8.2). STUB: owned by the abilities agent.

import type { AbilityDefinition } from '../types'

export const mercenaryAbilities: readonly AbilityDefinition[] = [
  {
    id: 'mercenary.fierceAttacker',
    status: 'stub',
    // TODO(A8-02, MER-1..7): attackerAddition(q, holder, hit) is called for the dealer's own abilities on
    // attacks only: return params.perMercenary x (OTHER own Mercenaries adjacent to hit.target), never
    // counting the attacker (MERC_COUNTS_SELF = false). Max +3 vs a 1x1 target, +7 vs a 2x2.
  },
]
