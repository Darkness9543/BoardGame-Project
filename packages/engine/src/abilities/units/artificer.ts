// Artificer (RULES_INTERPRETATION 8.10, 8.15, 8.16). STUB: owned by the abilities agent. Mines (stepping on
// them, remote detonation, visibility) are core rules; this file only creates them.

import type { AbilityDefinition } from '../types'

export const artificerAbilities: readonly AbilityDefinition[] = [
  {
    id: 'artificer.mindsEye',
    status: 'stub',
    // TODO(A8-10, A4-11): detection: () => ({ kind: 'lov' }).
  },
  {
    id: 'artificer.prototypeNoAcb',
    status: 'stub',
    // TODO(A8-13, A8-14, ART-1..5): `active`, cost 2. targets: [{ kind: 'square', minRange: 1, range: 1,
    // free: true }]. validate: own living 'noAcb' units < DUMMY_CAP(own Artificers alive) (constants.ts).
    // resolve: ctx.createUnit('noAcb', unit.owner, square, unit) (an unseen mine there goes off, ART-8).
  },
  {
    id: 'artificer.madInventor',
    status: 'stub',
    // TODO(A8-15, ART-6..7): modifyStats(q, holder, target): an own 'noAcb' adjacent to the holder gets
    // { movement: params.movement, power: params.power } (once, however many Artificers are adjacent).
  },
  {
    id: 'artificer.tripMine',
    status: 'stub',
    // TODO(A8-16, A8-17, ART-8..9): `active`, cost 2. targets: [{ kind: 'square', minRange: 1, range: 1,
    // free: true }]. validate: own mines (q.mines()) < MINE_CAP(own Artificers alive). resolve:
    // ctx.placeMine(unit.owner, square, unit); on 'blockedByHiddenMine' emit an abilityNote. Sabrina revokes
    // this ability through content data.
  },
]
