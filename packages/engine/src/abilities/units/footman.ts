// Footman (RULES_INTERPRETATION 8.1). STUB: owned by the abilities agent; replace 'stub' with
// 'implemented' once the hook below exists and is tested.

import type { AbilityDefinition } from '../types'

export const footmanAbilities: readonly AbilityDefinition[] = [
  {
    id: 'footman.lineFormation',
    status: 'stub',
    // TODO(A8-01, FTM-1..8): targetReduction(q, holder, hit): when hit.target is the holder and at least
    // params.allies OTHER own Footmen are adjacent (q.adjacentUnits), return params.reduction; else 0.
    // All damage kinds; on/off (4 neighbours still give -2). Area damage is judged on the board before (3.4).
  },
]
