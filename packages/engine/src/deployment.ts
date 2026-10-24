// Deployment (5.2-5.4): simultaneous and hidden; every unit must be placed before Confirm.

import { unitDef } from './content/units'
import { footprintSquares, isInZone, zoneSquares } from './geometry'
import type { RulesQuery } from './query'
import { reject, type Rejection } from './rejection'
import type { Side, Square, UnitCore, UnitTypeId } from './types'

/** A5-04 / A5-07: Vanguard units may use both zones; the commander and everyone else the normal zone. */
export function allowedZones(type: UnitTypeId): readonly ('normal' | 'extended')[] {
  return unitDef(type).vanguard && type !== 'commander' ? ['normal', 'extended'] : ['normal']
}

/** Every existing square a unit type may occupy in its side's zones (before terrain and occupancy). */
export function deploymentSquares(side: Side, type: UnitTypeId): Square[] {
  return allowedZones(type).flatMap((zone) => zoneSquares(side, zone))
}

export function checkPlacement(q: RulesQuery, side: Side, unit: UnitCore, anchor: Square): Rejection | null {
  const def = unitDef(unit.type)
  if (!def.deployable) return reject('NOT_DEPLOYABLE', 'This unit cannot be deployed')
  const zones = allowedZones(unit.type)
  for (const s of footprintSquares(anchor, def.size)) {
    if (!q.squareExists(s) || q.isTerrain(s)) return reject('SQUARE_UNAVAILABLE', 'That square is not open ground')
    if (!zones.some((zone) => isInZone(side, s, zone))) return reject('OUTSIDE_ZONE', 'Outside your deployment zone')
    const occupant = q.unitAt(s)
    if (occupant !== undefined && occupant.id !== unit.id) return reject('SQUARE_UNAVAILABLE', 'Another unit is there')
  }
  return null
}
