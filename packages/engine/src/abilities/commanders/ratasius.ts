// Ratasius I "The Great" (RULES_INTERPRETATION 7.8, A7-14; owner rulings R13, R41). His LOV 6 is content data.

import { abilityParam } from '../../content/abilities'
import type { AbilityDefinition } from '../types'

const ID = 'ratasius.great'

export const ratasiusAbilities: readonly AbilityDefinition[] = [
  {
    id: ID,
    status: 'implemented',
    // A4-08 / A4-11 / RAT-7: enemy stealthed units and enemy mines within range 3 are revealed, state-based on both
    // turns. A stealthed Rogue is revealed at distance 3, so it can never Assault him (RAT-6, X-02).
    detection: () => ({ kind: 'range', range: abilityParam(ID, 'detectionRange') }),
    // A7-14 / R41: an enemy dealer within range 1 deals 4 less per damage instance, against every target (RAT-2),
    // judged where it stands when the damage resolves (RAT-1: an aura, no lingering status; a 2x2 by any square, RAT-5).
    // The core asks only for damage dealt right now by a unit, never mines or Pajazon ticks (RAT-3, X-22), and floors
    // the hit at WEAKNESS_FLOOR = 1 (R13, which supersedes A3-04's floor 0).
    attackerSubtraction: (q, holder, hit) => {
      if (hit.dealer === null) return 0
      const dealer = q.unit(hit.dealer.id) ?? hit.dealer
      if (dealer.owner === holder.owner) return 0
      return q.distance(holder, dealer) <= abilityParam(ID, 'weaknessRange') ? abilityParam(ID, 'weakness') : 0
    },
  },
]
