// Neutral objectives (SPEC L45, L52, L53; RULES_INTERPRETATION 6.4-6.6; owner rulings R30-R32). Their effects
// are core rules (stats.ts for the Keep's Power and the Market's action, turn.ts for AP and Siege).

import { BUILDING_SIZE, KEEP_POWER_BONUS, MARKET_AP_BONUS, MARKET_EXTRA_ACTIONS, SIEGE_TURNS } from '../constants'
import type { BuildingKind } from '../types'

export interface BuildingDef {
  readonly kind: BuildingKind
  readonly name: string
  /** R32: 3x3 terrain (A1-13: impassable, not targetable). */
  readonly size: number
  readonly text: string
  readonly symbol: string
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    kind: 'keep',
    name: 'The Keep',
    size: BUILDING_SIZE,
    text: `While you control the Keep, all your units gain ${KEEP_POWER_BONUS} Power.`,
    symbol: 'keep',
  },
  {
    kind: 'market',
    name: 'The Market',
    size: BUILDING_SIZE,
    text:
      `While you control the Market, you receive ${MARKET_AP_BONUS} extra AP at the start of each of your turns, and your ` +
      `type-1 units have ${MARKET_EXTRA_ACTIONS} additional action per turn.`,
    symbol: 'market',
  },
]

export function buildingDef(kind: BuildingKind): BuildingDef {
  const def = BUILDINGS.find((b) => b.kind === kind)
  if (def === undefined) throw new Error(`Unknown building: ${kind}`)
  return def
}

/** A6-04 / L45 wording fix (S26): "Once conquered, the building can be reconquered by the same method." */
export const CAPTURE_RULE_TEXT =
  'A building is conquered at the end of a turn when units of only one player are within range 1 of it (including ' +
  'corners). Once conquered, it can be reconquered by the same method.'

/** R30: the third win condition. */
export const SIEGE_RULE_TEXT = `Siege: control both the Keep and the Market at the start of ${SIEGE_TURNS} consecutive turns of yours to win.`
