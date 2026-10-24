// Celestial Emissary (RULES_INTERPRETATION 8.13). STUB: owned by the abilities agent.

import type { AbilityDefinition } from '../types'

export const emissaryAbilities: readonly AbilityDefinition[] = [
  {
    id: 'emissary.holyBlessing',
    status: 'stub',
    // TODO(A8-22, CEL-1..2): `active`, cost 3, no targets. resolve: every own unit within params.range of the
    // Emissary (itself included, HOLY_BLESSING_SELF) heals params.heal via ctx.heal (capped).
  },
  {
    id: 'emissary.smite',
    status: 'stub',
    // TODO(A8-23, CEL-3, CEL-8, R14, R25): `active`, cost 3. targets: [{ kind: 'unit', relation: 'any' (R14:
    // FRIENDLY_SINGLE_TARGET, the UI confirms), range: params.range, includeSelf: false, allowCommander: true }].
    // resolve: one simultaneous effect, ctx.dealDamageTogether([params.damage on the target, then params.splash on
    // every unit on the target's 4 orthogonal neighbours, friendly fire on]), dealer = unit. Not a ranged attack.
  },
  {
    id: 'emissary.holyFervor',
    status: 'stub',
    // TODO(A8-24, CEL-4..7): modifyStats: the holder itself gets { actions: params.extraActions }; and
    // actionSurcharge: (actionsUsed) => (actionsUsed >= 1 ? params.surcharge : 0) (HOLY_FERVOR_SURCHARGE).
    // Under R12 the extra action may also be a Move (the core's MAX_MOVES_PER_TURN = 'allowance').
  },
]
