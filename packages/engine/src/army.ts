// Army building (5.1): the one validation function shared by the army builder and the authority (13.3).

import {
  ARMY_UNIT_CAP,
  COMMANDER_FACTION_LOCK,
  MIN_ARMY_UNITS,
  MUST_SPEND_FULL_BUDGET,
} from './constants'
import { commanderDef, groupFaction, isCommanderId } from './content/commanders'
import { unitCost } from './content/derived'
import { availableRoster } from './content/factions'
import { buildingDef } from './content/buildings'
import { scenarioDef } from './content/scenarios'
import { ROSTER_IDS, unitDef } from './content/units'
import { footprintSquares, sameSquare, zoneSquares } from './geometry'
import type { ArmyList, MatchSettings, RosterUnitId } from './types'

export interface ArmyCheck {
  readonly ok: boolean
  readonly cost: number
  readonly unitCount: number
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

/** Total cost under the army's own commander (A5-11; Sabrina re-prices, A7-11). */
export function armyCost(army: ArmyList): number {
  if (!isCommanderId(army.commander)) return 0
  let cost = 0
  for (const type of ROSTER_IDS) cost += (army.units[type] ?? 0) * unitCost(type, army.commander)
  return cost
}

export function armyUnitCount(army: ArmyList): number {
  return ROSTER_IDS.reduce((sum, type) => sum + (army.units[type] ?? 0), 0)
}

/** Free open-ground squares of one side's normal and extended zones in a scenario (A5-03). */
export function zoneCapacity(settings: MatchSettings): { readonly normal: number; readonly extended: number } {
  const scenario = scenarioDef(settings.scenarioId)
  const blocked = [
    ...scenario.blockers,
    ...scenario.buildings
      .filter((b) => (b.kind === 'keep' ? settings.keepEnabled : settings.marketEnabled))
      .flatMap((b) => footprintSquares(b.anchor, buildingDef(b.kind).size)),
  ]
  const free = (zone: 'normal' | 'extended') => zoneSquares('south', zone).filter((s) => !blocked.some((b) => sameSquare(b, s))).length
  return { normal: free('normal'), extended: free('extended') }
}

export function checkArmy(army: ArmyList, settings: MatchSettings): ArmyCheck {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isCommanderId(army.commander)) {
    return { ok: false, cost: 0, unitCount: 0, errors: ['Unknown commander'], warnings }
  }
  const commander = commanderDef(army.commander)
  if (!commander.selectable && !settings.devContent) errors.push(`${commander.name} is not available`)
  // R7: commanders are not tied to a faction; the lock alternative maps group A to the Empire and B to Lojrar.
  if (COMMANDER_FACTION_LOCK && groupFaction(commander.group) !== army.faction) errors.push(`${commander.name} does not lead this faction`)
  // R11: a commander with variants (Baba Yaga) needs one; the others take none.
  if (commander.variants.length > 0) {
    if (!commander.variants.some((v) => v.id === army.variant)) errors.push(`Choose a variant for ${commander.name}`)
  } else if (army.variant !== undefined) {
    errors.push(`${commander.name} has no variants`)
  }

  const roster = availableRoster(army.faction)
  let nonVanguardArea = 0
  let totalArea = 0
  for (const [key, count] of Object.entries(army.units)) {
    const type = key as RosterUnitId
    if (!ROSTER_IDS.includes(type)) {
      errors.push(`Unknown unit: ${key}`)
      continue
    }
    if (count === undefined || !Number.isInteger(count) || count < 0) {
      errors.push(`Bad count for ${key}`)
      continue
    }
    if (count > 0 && !roster.includes(type)) errors.push(`${unitDef(type).name} is not in this faction's roster`)
    const area = unitDef(type).size ** 2 * count
    totalArea += area
    if (!unitDef(type).vanguard) nonVanguardArea += area
  }

  const cost = armyCost(army)
  const unitCount = armyUnitCount(army)
  if (cost > settings.budget) errors.push(`Over budget: ${cost} of ${settings.budget}`) // A5-02
  if (MUST_SPEND_FULL_BUDGET && cost !== settings.budget) errors.push('The whole budget must be spent')
  if (ARMY_UNIT_CAP !== null && unitCount > ARMY_UNIT_CAP) errors.push(`At most ${ARMY_UNIT_CAP} units`)
  // A5-03: the army must fit; the commander takes one normal-zone square.
  const capacity = zoneCapacity(settings)
  if (1 + nonVanguardArea > capacity.normal) errors.push("The army doesn't fit in the deployment zone")
  else if (1 + totalArea > capacity.normal + capacity.extended) errors.push("The army doesn't fit in the deployment zones")
  if (unitCount < Math.max(1, MIN_ARMY_UNITS)) {
    if (MIN_ARMY_UNITS > 0) errors.push(`At least ${MIN_ARMY_UNITS} units`)
    else warnings.push('Your army has no units besides the commander') // A5-12
  }
  return { ok: errors.length === 0, cost, unitCount, errors, warnings }
}
