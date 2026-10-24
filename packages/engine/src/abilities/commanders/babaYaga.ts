// Baba Yaga "The Bwitch" (owner ruling R11 replaces RULES_INTERPRETATION 7.7). STUB: owned by the commanders
// agent. The army picks one variant (ArmyList.variant: 'mend' | 'hex-ward' | 'cauldron', validated by
// checkArmy); content/commanders.ts maps each variant to the abilities below. "Units of white" = tier-1 units
// (BABA_WHITE_GRADES, R6). Base stats 1/5, Mv 2, AP 1, LOV 3 (R8) are content data.

import type { AbilityDefinition } from '../types'

export const babaYagaAbilities: readonly AbilityDefinition[] = [
  {
    id: 'babaYaga.mend',
    status: 'stub',
    // TODO(R11 variant A "Mend the swarm"): granted to own white units. `active` with no targets; content data
    // gives cost 1, not an action, no cooldown. validate: q.seatCounter(unit.owner, 'babaYaga.mend') <
    // BABA_MEND_USES_PER_TURN (army-wide; resets at the start of the owner's turn). resolve: heal the unit to its
    // max toughness (ctx.heal(unit, max - current, id)) and ctx.setSeatCounter(owner, 'babaYaga.mend', n + 1).
  },
  {
    id: 'babaYaga.hexWard',
    status: 'stub',
    // TODO(R11 variant B "Hex Ward"): carried by the commander. modifyStats(q, holder, target): own tier-1 units
    // within BABA_HEX_RANGE of Baba Yaga get { maxToughness: BABA_HEX_TOUGHNESS } (an aura: the core syncs current
    // toughness and losing it never kills, A3-11). targetReduction(q, holder, hit): the same units take
    // BABA_HEX_REDUCTION less from every source (floor 1 is the pipeline's).
  },
  {
    id: 'babaYaga.cauldron',
    status: 'stub',
    // TODO(R11 variant C "Cauldron"): carried by the commander. onUnitDied(ctx, holder, death): an own tier-1 unit
    // died (any cause, sacrifices included); if q.turnCounter(owner, 'babaYaga.cauldron') < BABA_CAULDRON_PER_TURN,
    // ctx.memory(unit, 'cauldronReturns') < BABA_CAULDRON_PER_UNIT and a free square adjacent to Baba Yaga exists,
    // ctx.requestDecision({ options: one per free square + 'no', defaultOption 'no', preferenceKey 'revive', ... }).
    // onDecision: on a square, ctx.chargeAp(owner, BABA_CAULDRON_COST) (an AP debt on the opponent's turn,
    // BABA_CAULDRON_AP_DEBT), ctx.revive(unitId, its base toughness, square), ctx.exhaust(returned unit), bump both
    // counters (ctx.setTurnCounter resets every turn; ctx.setMemory persists).
  },
]
