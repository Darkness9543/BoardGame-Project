// Rogue (RULES_INTERPRETATION 8.6, 4.4). STUB: owned by the abilities agent. The reveal rules R1 (adjacency),
// R2 (damage inside enemy LOV) and R3 (detection) are already enforced by the core (resolve.ts).

import type { AbilityDefinition } from '../types'

export const rogueAbilities: readonly AbilityDefinition[] = [
  {
    id: 'rogue.stealth',
    status: 'stub',
    // TODO(A8-06, A4-05, C11, ROG-1..3): `active` with no targets. validate (knowledge only): not already
    // stealthed; refuse with "An enemy can see this unit" if a VISIBLE enemy (q.units()) has the Rogue's
    // square in its LOV (q.inLov). resolve (truth): if ANY enemy unit sees the square, emit an abilityNote
    // "Spotted: an unseen enemy can see this square" to the owner and stop (AP and the action stay spent);
    // otherwise ctx.setStealthed(unit, true).
  },
  {
    id: 'rogue.assault',
    status: 'stub',
    // TODO(A8-07, ROG-4..10, ROG-17, C31): onAdjacencyGained(ctx, holder, info): if holder.stealthed, attack
    // with ctx.attack(holder, { kind: 'unit', unitId }, { source: 'rogue.assault', triggered: true }) and
    // return 'interrupt' (the move ends, the Rogue's own move included). If info.holderIsMover and several
    // enemies became adjacent, its controller picks (ROG-5): ctx.requestDecision(...) + onDecision. The core
    // runs mines -> these hooks (APNAP) -> reveals, so the Rogue is still stealthed when the hook runs.
  },
]
