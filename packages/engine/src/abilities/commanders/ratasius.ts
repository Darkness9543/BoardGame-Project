// Ratasius I "The Great" (RULES_INTERPRETATION 7.8). STUB: owned by the commanders agent. LOV 6 is content data.

import type { AbilityDefinition } from '../types'

export const ratasiusAbilities: readonly AbilityDefinition[] = [
  {
    id: 'ratasius.great',
    status: 'stub',
    // TODO(A7-14, A4-08, A4-11, X-02, X-22, X-32):
    // - detection: () => ({ kind: 'range', range: params.detectionRange }) (reveals stealthed units and mines).
    // - attackerSubtraction(q, holder, hit): hit.dealer is an enemy of the holder within
    //   params.weaknessRange -> params.weakness. The core only calls step 3 for dealt damage (never mines or
    //   Pajazon ticks) and floors at 1 (WEAKNESS_FLOOR, owner ruling R13).
  },
]
