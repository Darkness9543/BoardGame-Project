// Mercenary (RULES_INTERPRETATION 8.2): Fierce attacker, an attacker-side addition on its own attacks.

import { abilityParam } from '../../content/abilities'
import { MERC_COUNTS_SELF } from '../../constants'
import type { AbilityDefinition } from '../types'

const FIERCE_ATTACKER = 'mercenary.fierceAttacker'
const PER_MERCENARY = abilityParam(FIERCE_ATTACKER, 'perMercenary')

export const mercenaryAbilities: readonly AbilityDefinition[] = [
  {
    id: FIERCE_ATTACKER,
    status: 'implemented',
    // A8-02: the core calls this for the dealer's own abilities on attacks only (MER-4), at pipeline step 2, before
    // reductions and Defend (MER-5). MER-1: the attacker doesn't count itself; MER-2: only its own side's
    // Mercenaries; MER-3: +3 at most against a 1x1 target, +7 against a 2x2; MER-7: dummies never count.
    attackerAddition: (q, holder, hit) =>
      q
        .adjacentUnits(hit.target)
        .filter((u) => u.owner === holder.owner && u.type === 'mercenary' && (MERC_COUNTS_SELF || u.id !== holder.id)).length * PER_MERCENARY,
  },
]
