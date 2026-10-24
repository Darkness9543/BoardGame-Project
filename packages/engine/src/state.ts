// Creating a game and reading raw facts from a GameState (no rules evaluation here).

import {
  BUDGET,
  KEEP_ENABLED,
  MARKET_ENABLED,
  REVIVE_PREFERENCE,
  RULES_VERSION,
  SCHEMA_VERSION,
  TAKEBACKS,
  TAKEBACKS_PER_GAME,
  TIME_BANK,
  TURN_TIMER,
  VISION_OCCLUSION,
} from './constants'
import { abilitiesFor, commanderStats, tierFor } from './content/derived'
import { buildingDef } from './content/buildings'
import { DEFAULT_SCENARIO, scenarioDef, type ScenarioDef } from './content/scenarios'
import { unitDef } from './content/units'
import { footprintSquares, sameSquare, squareExists, squareIndex } from './geometry'
import { nextId, seedRng } from './rng'
import type {
  AbilityId,
  BuildingState,
  CommanderId,
  GameState,
  MatchSettings,
  MineState,
  Seat,
  SeatState,
  Side,
  Square,
  Tier,
  UnitCore,
  UnitState,
  UnitTurnState,
  UnitTypeId,
} from './types'

export const DEFAULT_SETTINGS: MatchSettings = {
  scenarioId: DEFAULT_SCENARIO,
  budget: BUDGET,
  keepEnabled: KEEP_ENABLED,
  marketEnabled: MARKET_ENABLED,
  takebacks: TAKEBACKS,
  takebacksPerGame: TAKEBACKS_PER_GAME,
  turnTimerSeconds: TURN_TIMER,
  timeBankSeconds: TIME_BANK,
  devContent: false,
}

export interface CreateGameOptions {
  /** Host-chosen seed; ids and the coin flip also mix in the commit-reveal coin seed. */
  readonly seed: string
  readonly settings?: Partial<MatchSettings>
  readonly names?: Partial<Record<Seat, string>>
}

/** A new match in the lobby phase (2.1 step 1). */
export function createGame(options: CreateGameOptions): GameState {
  const settings: MatchSettings = { ...DEFAULT_SETTINGS, ...options.settings }
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    phase: 'lobby',
    settings,
    seed: options.seed,
    rng: seedRng(options.seed),
    southSeat: null,
    seats: { host: newSeatState(options.names?.host ?? 'Host'), guest: newSeatState(options.names?.guest ?? 'Guest') },
    units: [],
    fallen: [],
    mines: [],
    areas: [],
    buildings: buildingsFor(settings),
    turn: null,
    transition: null,
    decisions: [],
    takeback: { request: null, declined: [], used: { host: 0, guest: 0 } },
    drawOffer: null,
    firstContactRound: null,
    lastAction: null,
    actionCount: 0,
    nextSeq: 1,
    result: null,
  }
}

function newSeatState(name: string): SeatState {
  return {
    name,
    army: null,
    ready: false,
    deploymentConfirmed: false,
    ap: 0,
    ownTurns: 0,
    counters: {},
    turnCounters: {},
    apDebt: 0,
    siegeTurns: 0,
    preferences: { revive: REVIVE_PREFERENCE },
  }
}

/** A6-09: a switched-off building is removed from the scenario. */
export function buildingsFor(settings: MatchSettings): BuildingState[] {
  return scenarioDef(settings.scenarioId)
    .buildings.filter((b) => (b.kind === 'keep' ? settings.keepEnabled : settings.marketEnabled))
    .map((b) => ({ kind: b.kind, anchor: b.anchor, controller: null }))
}

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

export function scenarioOf(state: GameState): ScenarioDef {
  return scenarioDef(state.settings.scenarioId)
}

export function opponentOf(seat: Seat): Seat {
  return seat === 'host' ? 'guest' : 'host'
}

export function sideOf(state: GameState, seat: Seat): Side | null {
  if (state.southSeat === null) return null
  return state.southSeat === seat ? 'south' : 'north'
}

export function commanderIdOf(state: GameState, seat: Seat): CommanderId | null {
  return state.seats[seat].army?.commander ?? null
}

/** R11: the commander's chosen variant (Baba Yaga), public with the commander. */
export function commanderVariantOf(state: GameState, seat: Seat): string | null {
  return state.seats[seat].army?.variant ?? null
}

// ---------------------------------------------------------------- units

export function getUnit(state: GameState, id: string): UnitState | undefined {
  return state.units.find((u) => u.id === id)
}

export function requireUnit(state: GameState, id: string): UnitState {
  const unit = getUnit(state, id)
  if (unit === undefined) throw new Error(`No living unit ${id}`)
  return unit
}

export function isCommanderType(type: UnitTypeId): boolean {
  return type === 'commander'
}

export function unitSize(unit: Pick<UnitCore, 'type'>): 1 | 2 {
  return unitDef(unit.type).size
}

export function unitFootprint(unit: Pick<UnitCore, 'type' | 'anchor'>): Square[] {
  return unit.anchor === null ? [] : footprintSquares(unit.anchor, unitSize(unit))
}

export function placedUnits(state: GameState): UnitState[] {
  return state.units.filter((u) => u.anchor !== null)
}

export function commanderUnitOf(state: GameState, seat: Seat): UnitState | undefined {
  return state.units.find((u) => u.owner === seat && u.type === 'commander')
}

/** Printed stats: the unit line, or the commander's own line (7.10). */
export interface PrintedStats {
  readonly power: number
  readonly toughness: number
  readonly lov: number
  readonly movement: number
  readonly ap: number
  readonly attackRange: number
  readonly size: 1 | 2
}

export function printedStatsFor(type: UnitTypeId, commander: CommanderId | null): PrintedStats {
  const def = unitDef(type)
  if (type === 'commander' && commander !== null) {
    const c = commanderStats(commander)
    return { power: c.power, toughness: c.toughness, lov: c.lov, movement: c.movement, ap: c.ap, attackRange: def.attackRange, size: def.size }
  }
  return { power: def.power, toughness: def.toughness, lov: def.lov, movement: def.movement, ap: def.ap, attackRange: def.attackRange, size: def.size }
}

export function printedStats(state: GameState, unit: Pick<UnitCore, 'type' | 'owner'>): PrintedStats {
  return printedStatsFor(unit.type, commanderIdOf(state, unit.owner))
}

export function effectiveTier(state: GameState, unit: Pick<UnitCore, 'type' | 'owner'>): Tier | null {
  return tierFor(unit.type, commanderIdOf(state, unit.owner))
}

export function unitAbilities(state: GameState, unit: Pick<UnitCore, 'type' | 'owner'>): AbilityId[] {
  return abilitiesFor(unit.type, commanderIdOf(state, unit.owner), commanderVariantOf(state, unit.owner))
}

export function freshTurnState(): UnitTurnState {
  return { actionsUsed: 0, moves: 0, basicAttack: false, abilityUses: {}, flags: {} }
}

// ---------------------------------------------------------------- board occupancy and terrain

/** Low and tall blockers are both impassable terrain (A1-11, R36). */
export function isBlocker(state: GameState, s: Square): boolean {
  const scenario = scenarioOf(state)
  return scenario.blockers.some((b) => sameSquare(b, s)) || scenario.tallBlockers.some((b) => sameSquare(b, s))
}

/** VISION_OCCLUSION (A1-12, R36): what stops sight on this scenario. */
export function sightBlockersExist(scenario: ScenarioDef): boolean {
  switch (VISION_OCCLUSION) {
    case 'none':
      return false
    case 'tallBlockers':
      return scenario.tallBlockers.length > 0
    case 'allTerrain':
      return true
  }
}

export function blocksSightIn(scenario: ScenarioDef, s: Square, isTerrainSquare: (s: Square) => boolean): boolean {
  switch (VISION_OCCLUSION) {
    case 'none':
      return false
    case 'tallBlockers':
      return scenario.tallBlockers.some((b) => sameSquare(b, s))
    case 'allTerrain':
      return isTerrainSquare(s)
  }
}

export function buildingAt(state: GameState, s: Square): BuildingState | undefined {
  return state.buildings.find((b) => footprintSquares(b.anchor, buildingDef(b.kind).size).some((f) => sameSquare(f, s)))
}

/** A1-11 / A1-13: blockers and buildings can't be entered, deployed on or targeted. */
export function isTerrain(state: GameState, s: Square): boolean {
  return isBlocker(state, s) || buildingAt(state, s) !== undefined
}

/** Exists, and is open ground (not a blocker or building). */
export function isOpenGround(state: GameState, s: Square): boolean {
  return squareExists(s) && !isTerrain(state, s)
}

export function occupancy(state: GameState): Map<number, UnitState> {
  const map = new Map<number, UnitState>()
  for (const unit of state.units) for (const s of unitFootprint(unit)) map.set(squareIndex(s), unit)
  return map
}

export function unitAt(state: GameState, s: Square): UnitState | undefined {
  return state.units.find((u) => unitFootprint(u).some((f) => sameSquare(f, s)))
}

export function mineAt(state: GameState, s: Square): MineState | undefined {
  return state.mines.find((m) => sameSquare(m.square, s))
}

// ---------------------------------------------------------------- ids and creation order

/** Draws an opaque id from the state RNG (mutates `state.rng`), skipping ids already in use. */
export function drawId(state: GameState, prefix: string): string {
  const used = new Set<string>([
    ...state.units.map((u) => u.id),
    ...state.fallen.map((f) => f.unit.id),
    ...state.mines.map((m) => m.id),
    ...state.areas.map((a) => a.id),
    ...state.decisions.map((d) => d.id),
  ])
  for (;;) {
    const [id, rng] = nextId(state.rng, prefix)
    state.rng = rng
    if (!used.has(id)) return id
  }
}

/** Next creation-order number (mutates `state.nextSeq`). */
export function drawSeq(state: GameState): number {
  const seq = state.nextSeq
  state.nextSeq += 1
  return seq
}

export function newUnit(
  state: GameState,
  type: UnitTypeId,
  owner: Seat,
  anchor: Square | null,
  toughness: number,
  createdBy: string | null,
): UnitState {
  return {
    id: drawId(state, 'u'),
    type,
    owner,
    anchor,
    toughness,
    defending: false,
    stealthed: false,
    seq: drawSeq(state),
    createdBy,
    permanentToughness: 0,
    auraToughness: 0,
    cooldowns: {},
    turn: freshTurnState(),
    memory: {},
  }
}

/** Own-turn index of a seat (0 before its first turn). */
export function ownTurnOf(state: GameState, seat: Seat): number {
  return state.seats[seat].ownTurns
}

/** Global turn number at which `seat`'s own turn `ownTurn` starts (South plays the odd turns). */
export function globalTurnOfOwnTurn(state: GameState, seat: Seat, ownTurn: number): number | null {
  const side = sideOf(state, seat)
  if (side === null) return null
  return side === 'south' ? 2 * ownTurn - 1 : 2 * ownTurn
}
