// Look decisions of the SVG placeholder board that aren't geometry: gradient ids, token sizes, building tints.

import { TIERS, type BuildingCore, type UnitView } from '@coinduel/engine'
import { SIDE_TINT } from '../theme'
import { CELL } from './svgGeometry'

export function gradientFor(unit: { readonly type: UnitView['type']; readonly tier: UnitView['tier'] }): string {
  if (unit.type === 'commander') return 'svgb-gcommander'
  return unit.tier === null ? 'svgb-gdummy' : `svgb-g${unit.tier}`
}

/** Token radius: the size ladder (research-art 5.4: 0.76 .. 0.94 tiles), larger for the commander and the Beast. */
export function tokenRadius(unit: { readonly type: UnitView['type']; readonly tier: UnitView['tier']; readonly size: 1 | 2 }, iso: boolean): number {
  if (unit.size === 2) return CELL * (iso ? 0.82 : 0.9)
  if (unit.type === 'commander') return CELL * 0.48
  if (unit.tier === null) return CELL * 0.36
  return (CELL * (0.76 + 0.03 * Math.max(0, TIERS.indexOf(unit.tier)))) / 2
}

export function controllerTint(building: BuildingCore, me: string): string {
  if (building.controller === null) return SIDE_TINT.neutral
  return building.controller === me ? SIDE_TINT.me : SIDE_TINT.opponent
}
