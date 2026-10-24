// Juliomancer (RULES_INTERPRETATION 8.8). STUB: owned by the abilities agent.

import type { AbilityDefinition } from '../types'

export const juliomancerAbilities: readonly AbilityDefinition[] = [
  {
    id: 'juliomancer.mindsEye',
    status: 'stub',
    // TODO(A8-10, A4-11): detection: () => ({ kind: 'lov' }). The core reveals enemy stealthed units and
    // (MINDS_EYE_REVEALS_MINES) enemy mines inside the detector's LOV after every step and event.
  },
  {
    id: 'juliomancer.julioVernification',
    status: 'stub',
    // TODO(A8-11, JUL-1..9, R14, R22): `active`, cost 2. targets: [{ kind: 'unit', relation: 'own', range: 1,
    // includeSelf: false, allowCommander: false }, { kind: 'unit', relation: 'any' (R14: FRIENDLY_SINGLE_TARGET),
    // range: params.range, includeSelf: false, allowCommander: true }] (JULIO_RANGE_ORIGIN = the Juliomancer).
    // resolve: X = min(the sacrificed unit's current toughness, params.cap) (R22); ctx.sacrifice(s, id);
    // ctx.dealDamage({ target, kind: 'ability', base: X, source: id, dealer: unit }). Death triggers of the
    // sacrifice run after the damage (JUL-4).
  },
]
