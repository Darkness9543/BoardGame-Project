// Trill "The Hydrocephalic" (RULES_INTERPRETATION 7.4, owner ruling R23). STUB: owned by the commanders agent.
// The commander's own toughness 6 is content data (content/commanders.ts).

import type { AbilityDefinition } from '../types'

export const trillAbilities: readonly AbilityDefinition[] = [
  {
    id: 'trill.hydrocephalic',
    status: 'stub',
    // TODO(A7-08, R23): modifyStats(q, holder, target): own units whose q.tierOf is 1, 2 or 5 get
    // { baseToughness: params.toughness } (permanent; units are created at full toughness, so it also
    // raises their starting current toughness). Dummies and the commander have no tier.
  },
]
