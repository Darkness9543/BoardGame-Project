// Priestess (RULES_INTERPRETATION 8.7). STUB: owned by the abilities agent.

import type { AbilityDefinition } from '../types'

export const priestessAbilities: readonly AbilityDefinition[] = [
  {
    id: 'priestess.strongAura',
    status: 'stub',
    // TODO(A8-08, A3-11, PRI-1..4): modifyStats(q, holder, target): own units adjacent to the holder (not the
    // holder) get { power: params.power, maxToughness: params.toughness }. The core syncs current toughness
    // when the aura is gained or lost (losing it never kills) and applies one copy per unit (A3-15).
  },
  {
    id: 'priestess.sharedWounds',
    status: 'stub',
    // TODO(A8-09, A3-08, PRI-5..12): `active`, cost = the Priestess's AP (content 'unit'). targets: donor and
    // recipient, each { kind: 'unit', relation: 'own', range: 1, includeSelf: true, allowCommander: true }.
    // validate: distinct. resolve (R19: SHARED_WOUNDS_ROUNDING = ceil): amount = ceil(donor.toughness / 2);
    // ctx.loseToughness(donor, amount, id, { canKill: true }) (a donor at 1 dies); ctx.heal(recipient, amount, id)
    // (overflow is wasted). The commander may not be a donor that would die (A7-04: never sacrificed).
  },
]
