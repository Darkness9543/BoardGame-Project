// Trill "The Hydrocephalic" (RULES_INTERPRETATION 7.4; owner rulings R8, R23). Content data grants this ability to each own
// unit of type 1, 2 or 5 (A7-08, effective tiers), and the commander's own toughness (TRILL_COMMANDER_TOUGHNESS = 6,
// R23) is content data too.

import { abilityParam } from '../../content/abilities'
import type { AbilityDefinition } from '../types'

const ID = 'trill.hydrocephalic'

export const trillAbilities: readonly AbilityDefinition[] = [
  {
    id: ID,
    status: 'implemented',
    // A7-08 / R23 (TRILL_TOUGHNESS_BONUS): permanent base toughness on the unit itself (TRI-1), so units are created at
    // the raised toughness when deployment starts, every "base" rule sees it (Kulega's heal, revives, the Shared wounds
    // cap), and it holds wherever Trill stands, even after he falls (7.3: for the whole game). Own units only (A7-07);
    // dummies and the commander have no type and get nothing (TRI-3).
    modifyStats: (_q, holder, target) => (holder.id === target.id ? { baseToughness: abilityParam(ID, 'toughness') } : null),
  },
]
