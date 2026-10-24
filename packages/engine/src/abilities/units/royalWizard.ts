// Royal Wizard (RULES_INTERPRETATION 8.11). STUB: owned by the abilities agent.

import type { AbilityDefinition } from '../types'

export const royalWizardAbilities: readonly AbilityDefinition[] = [
  {
    id: 'royalWizard.forcefield',
    status: 'stub',
    // TODO(A8-18, A2-24, WIZ-1..5): `active`, cost 2, CD 1. targets: [{ kind: 'connectedSquares', label,
    // count: params.squares }] (the core checks existence, the Wizard's LOV and orthogonal connectivity;
    // FORCEFIELD_SHAPE). resolve: ctx.createArea({ abilityId, owner, source: unit, squares,
    // durationOwnTurns: FORCEFIELD_DURATION }). area.targetReduction(q, area, hit): an OWN unit
    // (hit.target.owner === area.owner) with any footprint square on area.squares -> params.reduction.
  },
  {
    id: 'royalWizard.pajazon',
    status: 'stub',
    // TODO(A8-19, A2-23, WIZ-6..12): `active`, cost 3, CD 1. targets: [{ kind: 'area3x3', label,
    // centreRange: params.centreRange }]. resolve: ctx.createArea({ squares: area3x3(centre) (geometry.ts),
    // durationOwnTurns: params.duration, ... }). area.endOfTurn(q, area, endingSeat): endingSeat ===
    // area.owner -> { heal: own units inside, params.heal each }; otherwise -> { damage: endingSeat's units
    // inside, params.damage each }. One tick per unit; the core dedupes overlapping areas (WIZ-7).
  },
]
