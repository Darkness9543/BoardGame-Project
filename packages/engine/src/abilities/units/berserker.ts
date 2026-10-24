// Berserker (RULES_INTERPRETATION 8.5; 8/2 under owner ruling R20, read from the content table). Savagery is a paid
// extra attack that is not an action (A2-11): its 2 AP, "not an action" and "once per turn" are content data.

import { SAVAGERY_WINDOW } from '../../constants'
import type { RulesQuery } from '../../query'
import type { UnitCore } from '../../types'
import type { AbilityDefinition } from '../types'

const SAVAGERY = 'berserker.savagery'

/** A8-05 / BER-3: only a basic Attack enables it (a Charge counts, R26; Defend or Savagery itself don't). */
function savageryUnavailable(q: RulesQuery, unit: UnitCore): string | null {
  switch (SAVAGERY_WINDOW) {
    case 'restOfTurn': // C15 / BER-2: any time later in the same turn, even after other units acted
      return q.unitTurn(unit)?.basicAttack === true ? null : 'Savagery follows a basic Attack by this Berserker this turn'
  }
}

export const berserkerAbilities: readonly AbilityDefinition[] = [
  {
    id: SAVAGERY,
    status: 'implemented',
    active: {
      // BER-4: any legal attack target at that time, the first target or another one.
      targets: [{ kind: 'attack', label: 'Target' }],
      requirement: savageryUnavailable,
      resolve: (ctx, unit, targets) => {
        const target = targets[0]
        if (target === undefined || target.kind === 'squares') return
        // BER-6: its own damage pipeline. BER-8: an attack, so it cancels the Berserker's own Defend (triggered: false).
        ctx.attack(unit, target, { source: SAVAGERY, triggered: false })
      },
    },
  },
]
