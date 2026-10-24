// Default scenarios (RULES_INTERPRETATION 1.8, A1-14; owner ruling R32). Zones and goal rows come from the rules
// (geometry.zoneRowsY, goalRowY); a scenario stores its shape rule, blockers and buildings.

import { CORNER_RADIUS, CORNER_RULE, type CornerRule } from '../constants'
import { parseSquare } from '../geometry'
import type { BuildingKind, ScenarioId, Square } from '../types'

export interface ScenarioBuilding {
  readonly kind: BuildingKind
  /** South-west square of the building (3x3 under R32). */
  readonly anchor: Square
}

/** R36: both kinds are impassable terrain; only tall blockers stop sight (VISION_OCCLUSION = 'tallBlockers'). */
export type BlockerKind = 'low' | 'tall'

export interface ScenarioDef {
  readonly id: ScenarioId
  readonly name: string
  readonly cornerRule: CornerRule
  readonly cornerRadius: number
  /** Low blockers: impassable, see-through (A1-11, A1-12). */
  readonly blockers: readonly Square[]
  /** R36: tall blockers also stop sight. None in the v1 scenarios. */
  readonly tallBlockers: readonly Square[]
  readonly buildings: readonly ScenarioBuilding[]
}

/** Every blocker of a scenario with its kind (R36), low ones first. */
export function scenarioBlockers(scenario: ScenarioDef): readonly { readonly square: Square; readonly kind: BlockerKind }[] {
  return [
    ...scenario.blockers.map((square) => ({ square, kind: 'low' as const })),
    ...scenario.tallBlockers.map((square) => ({ square, kind: 'tall' as const })),
  ]
}

// R32: 3x3 buildings centred on the middle row: Keep centre (6, 12) = G13, Market centre (18, 12) = S13.
const BUILDINGS: readonly ScenarioBuilding[] = [
  { kind: 'keep', anchor: parseSquare('F12') }, // Keep F12:H14 (x 5-7, y 11-13)
  { kind: 'market', anchor: parseSquare('R12') }, // Market R12:T14 (x 17-19, y 11-13)
]

// R32 (Q104 open): the 21 Crossroads blockers keep their v1 squares; with the 3x3 buildings they still leave both
// 16-square rings clear, keep 180-degree symmetry and keep every walkable square connected (geometry.test.ts).
// prettier-ignore
const CROSSROADS_BLOCKERS: readonly string[] = [
  'L13', 'M12', 'M13', 'M14', 'N13',                     // centre cross
  'J10', 'J11', 'J15', 'J16', 'P10', 'P11', 'P15', 'P16', // lane dividers
  'E9', 'F9', 'T9', 'U9',                                 // forward rocks, South
  'E17', 'F17', 'T17', 'U17',                             // forward rocks, North
]

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'crossroads',
    name: 'Crossroads',
    cornerRule: CORNER_RULE,
    cornerRadius: CORNER_RADIUS,
    blockers: CROSSROADS_BLOCKERS.map(parseSquare),
    tallBlockers: [],
    buildings: BUILDINGS,
  },
  {
    id: 'openField',
    name: 'Open Field',
    cornerRule: CORNER_RULE,
    cornerRadius: CORNER_RADIUS,
    blockers: [],
    tallBlockers: [],
    buildings: BUILDINGS,
  },
]

export const DEFAULT_SCENARIO: ScenarioId = 'crossroads'

export function scenarioDef(id: ScenarioId): ScenarioDef {
  const def = SCENARIOS.find((s) => s.id === id)
  if (def === undefined) throw new Error(`Unknown scenario: ${id}`)
  return def
}
