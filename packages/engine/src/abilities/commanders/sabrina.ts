// Sabrina "The Reelfinisher" (RULES_INTERPRETATION 7.6, A7-11). The rest of her text is content data in
// content/commanders.ts: Artificers are type 10 for every rule (tierOverrides: cost, grade, tier checks), they lose
// Trip Mine (revokes), and every other unit of type 20 or more costs x1.2 rounded up (costRules). The builder and
// checkArmy read prices through unitCost(type, commander) / armyCost.

import { abilityParam } from '../../content/abilities'
import type { UnitTypeId } from '../../types'
import type { AbilityDefinition } from '../types'

const ID = 'sabrina.reelfinisher'
/** A7-11: "Artificers and No-ACBs get 2 additional power". */
const POWERED: readonly UnitTypeId[] = ['artificer', 'noAcb']

export const sabrinaAbilities: readonly AbilityDefinition[] = [
  {
    id: ID,
    status: 'implemented',
    // A7-11 / X-16: own Artificers become 3/15 and own dummies 2/7, so a dummy may attack (A2-19). Power changes attack
    // damage only (A3-02); Mad inventor's +1 is a differently named bonus and adds up (A3-15). AP costs are unchanged
    // (SAB-3, A2-32).
    modifyStats: (_q, holder, target) =>
      target.owner === holder.owner && POWERED.includes(target.type) ? { power: abilityParam(ID, 'power') } : null,
  },
]
