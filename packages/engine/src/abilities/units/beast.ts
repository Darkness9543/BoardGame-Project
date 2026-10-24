// Beast of Knorund (RULES_INTERPRETATION 8.12, Size 2 per 1.6). STUB: owned by the abilities agent.

import type { AbilityDefinition } from '../types'

export const beastAbilities: readonly AbilityDefinition[] = [
  {
    id: 'beast.forcefulSlam',
    status: 'stub',
    // TODO(A8-20, A3-07, BEA-1..7): `active`, cost 4, CD 1. targets: [{ kind: 'square', minRange: 1, range: 1,
    // free: false }]. resolve: splash = slamSplash(anchor, 2, target) (geometry.ts); hits = the unit on the
    // target square (params.damage) + every other unit on splash squares (params.splash, once each), dealer =
    // the Beast, friendly fire on (SLAM_FRIENDLY_FIRE); ctx.dealDamageTogether(hits). It never sets off mines.
  },
  {
    id: 'beast.feast',
    status: 'stub',
    // TODO(A8-21, BEA-8..12): `active`, cost 2. targets: [{ kind: 'unit', relation: 'own', range: 1,
    // includeSelf: false, allowCommander: false }]. resolve: amount = the eaten unit's current toughness
    // (FEAST_TOUGHNESS); ctx.sacrifice(target, id); ctx.heal(unit, amount, id) (capped, no overheal).
  },
]
