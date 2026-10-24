// The action economy (2.3, 2.4): allowance, the one-Move rule, AP costs and cooldowns. Checks take a
// RulesQuery, so they run on the actor's view.

import { liveAbility } from './abilities/registry'
import { ABILITY_COST_MODE, MAX_MOVES_PER_TURN } from './constants'
import type { AbilityData } from './content/abilities'
import type { RulesQuery } from './query'
import { reject, type Rejection } from './rejection'
import type { Seat, UnitCore } from './types'

/** Extra AP on the unit's next action (Holy Fervor, A8-24). Only actions pay it. */
export function actionSurcharge(q: RulesQuery, unit: UnitCore): number {
  const used = q.unitTurn(unit)?.actionsUsed ?? 0
  let total = 0
  for (const id of q.abilitiesOf(unit)) total += liveAbility(id)?.actionSurcharge?.(used) ?? 0
  return total
}

/** A2-09 / A2-32: Move, Attack and Defend cost the unit's fixed AP stat plus any surcharge. */
export function basicActionCost(q: RulesQuery, unit: UnitCore): number {
  return q.stats(unit).apCost + actionSurcharge(q, unit)
}

/** A2-10: an ability's cost replaces the unit's AP ('unit' = the unit's own AP cost, A2-12). */
export function abilityCost(q: RulesQuery, unit: UnitCore, data: AbilityData): number {
  const unitAp = q.stats(unit).apCost
  const own = data.apCost === 'unit' ? unitAp : (data.apCost ?? 0)
  const base = ABILITY_COST_MODE === 'add' && data.apCost !== 'unit' ? own + unitAp : own
  return base + (data.usesAction ? actionSurcharge(q, unit) : 0)
}

/** A2-07 / A2-13 / R12: the allowance is computed when the action is declared. */
export function checkCanAct(q: RulesQuery, unit: UnitCore, kind: 'move' | 'other'): Rejection | null {
  const turn = q.unitTurn(unit)
  if (turn === undefined) return reject('NOT_YOUR_UNIT', 'Not your unit')
  if (turn.actionsUsed >= q.stats(unit).actionAllowance) return reject('NO_ACTIONS_LEFT', 'This unit has no actions left this turn')
  // R12: each extra action may be a Move; a numeric MAX_MOVES_PER_TURN caps them.
  if (kind === 'move' && MAX_MOVES_PER_TURN !== 'allowance' && turn.moves >= MAX_MOVES_PER_TURN) {
    return reject('ALREADY_MOVED', 'This unit already moved this turn')
  }
  return null
}

export function checkAp(q: RulesQuery, seat: Seat, cost: number): Rejection | null {
  const ap = q.ap(seat) ?? 0
  return ap < cost ? reject('NOT_ENOUGH_AP', `Not enough AP: needs ${cost}, has ${ap}`) : null
}

/** A2-22: CD N used on own turn T is ready on own turn T + N + 1 ("Can be applied twice": same turn allowed). */
export function cooldownBlocks(q: RulesQuery, unit: UnitCore, data: AbilityData, seat: Seat): boolean {
  const cooldown = q.cooldown(unit, data.id)
  if (cooldown === undefined) return false
  const now = q.ownTurn(seat)
  if (now >= cooldown.readyOnOwnTurn) return false
  return !(data.sameTurnReuse && cooldown.usedOnOwnTurn === now)
}
