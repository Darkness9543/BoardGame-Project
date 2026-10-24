// Queso "The Beacon of Hope" (RULES_INTERPRETATION 7.9, owner rulings R8, R17, R18, R24). STUB: owned by the
// commanders agent. 1/6 and AP 2 are content data.

import type { AbilityDefinition } from '../types'

export const quesoAbilities: readonly AbilityDefinition[] = [
  {
    id: 'queso.beacon',
    status: 'stub',
    // TODO(A7-15, R24, QUESO_BEACON_TIMING, QUESO_SELF_HEAL, X-25): endOfOwnTurn(q, holder): heal params.heal (3) on
    // every own unit within params.range of Queso (Queso included) -> { heal: [...] }.
  },
  {
    id: 'queso.revive',
    status: 'stub',
    // TODO(A7-16, R18, A2-30, C14, X-07, X-26): onUnitDied(ctx, holder, death): an own non-commander unit died
    // with a footprint square within params.range of Queso, and Queso's max toughness - QUESO_REVIVE_COST(death.tier)
    // >= QUESO_MIN_MAX_TOUGHNESS -> ctx.requestDecision({ seat: owner, kind: 'queso.revive', options yes/no,
    // defaultOption 'no', alwaysOption 'yes', preferenceKey 'revive', subject: death.unit, data: { unitId,
    // toughness: ceil(death.baseToughness / 2), cost } }). onDecision: on 'yes' ctx.changePermanentToughness(holder,
    // -cost) then ctx.revive(unitId, toughness, anchor). The anchor is where the unit died or, if those squares are
    // taken, the nearest free square within params.range of Queso (A7-16). Check that one exists before asking:
    // revive returns null when the squares are not free. The core pauses the game until the decision is answered.
  },
]
