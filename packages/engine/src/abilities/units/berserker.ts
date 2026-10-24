// Berserker (RULES_INTERPRETATION 8.5; 8/2 under owner ruling R20). STUB: owned by the abilities agent. A Charge
// (R26) counts as a basic Attack, so it enables Savagery too (the core sets turn.basicAttack).

import type { AbilityDefinition } from '../types'

export const berserkerAbilities: readonly AbilityDefinition[] = [
  {
    id: 'berserker.savagery',
    status: 'stub',
    // TODO(A8-05, BER-1..8, C15): `active` with targets [{ kind: 'attack', label: 'Target' }]. Cost 2, not an
    // action, once per turn come from content data. validate: q.unitTurn(unit)?.basicAttack must be true
    // (only a basic Attack enables it, BER-3). resolve: ctx.attack(unit, target, { source: 'berserker.savagery',
    // triggered: false }) - it is an attack, so it cancels the Berserker's own Defend (BER-8).
  },
]
