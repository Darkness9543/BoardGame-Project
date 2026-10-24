// RulesQuery: the read-only world interface every rule and ability hook is written against. It has two
// implementations: StateQuery over the full GameState (the authority, omniscient) and ViewQuery over a
// PlayerView (a client, knowledge only; see view.ts). Validation and previews run on a ViewQuery, so they
// can only ever use what the acting seat may know (4.7, 4.9).

import { ADJACENCY } from './constants'
import { adjacencyMetric, footprintRect, pointRect, rectDistance, sameSquare, squareExists } from './geometry'
import {
  buildingAt,
  commanderIdOf,
  commanderVariantOf,
  effectiveTier,
  isBlocker,
  blocksSightIn,
  opponentOf,
  scenarioOf,
  sideOf,
  sightBlockersExist,
  unitAbilities,
  unitFootprint,
  unitSize,
} from './state'
import { computeStats } from './stats'
import { lovContains } from './vision'
import type {
  AbilityId,
  AreaId,
  BuildingKind,
  CommanderId,
  CooldownState,
  GameState,
  MatchSettings,
  Metric,
  MineId,
  Phase,
  Seat,
  Side,
  Square,
  Tier,
  UnitCore,
  UnitId,
  UnitTurnState,
} from './types'

/** Effective stats after commanders, buildings, auras and abilities (3.1, 2.4). */
export interface UnitStats {
  readonly power: number
  readonly baseToughness: number
  readonly maxToughness: number
  readonly lov: number
  readonly movement: number
  readonly attackRange: number
  readonly actionAllowance: number
  readonly apCost: number
  readonly tier: Tier | null
  readonly size: 1 | 2
}

export interface AreaCore {
  readonly id: AreaId
  readonly abilityId: AbilityId
  readonly owner: Seat
  readonly squares: readonly Square[]
  readonly expiresAtOwnTurn: number
  readonly data: Readonly<Record<string, number>>
}

export interface MineCore {
  readonly id: MineId
  readonly owner: Seat
  readonly square: Square
  readonly revealed: boolean
}

export interface BuildingCore {
  readonly kind: BuildingKind
  readonly anchor: Square
  readonly controller: Seat | null
}

export type UnitTurnView = Readonly<UnitTurnState>

export interface RulesQuery {
  /** The seat whose knowledge this is; null = the authority's full state. */
  readonly perspective: Seat | null
  readonly phase: Phase
  readonly activeSeat: Seat | null
  readonly turnNumber: number
  readonly settings: MatchSettings
  opponentOf(seat: Seat): Seat
  sideOf(seat: Seat): Side | null
  /** Own-turn index of a seat (0 before its first turn). */
  ownTurn(seat: Seat): number
  commanderOf(seat: Seat): CommanderId | null
  /** R11: the commander's variant (Baba Yaga), public with the commander. */
  commanderVariantOf(seat: Seat): string | null
  /** A living unit that this query knows about (placed or, for own units, undeployed). */
  unit(id: UnitId): UnitCore | undefined
  /** Living, placed, known units in creation order. */
  units(): readonly UnitCore[]
  unitAt(square: Square): UnitCore | undefined
  sizeOf(unit: UnitCore): 1 | 2
  footprint(unit: UnitCore): readonly Square[]
  /** A1-04: distance between nearest squares (1.4), ignoring terrain and units; Infinity if either unit is undeployed. */
  distance(a: UnitCore | Square, b: UnitCore | Square, metric?: Metric): number
  /** ADJACENCY distance 1 (A1-05); a unit is never adjacent to itself. */
  isAdjacent(a: UnitCore | Square, b: UnitCore | Square): boolean
  /** Known placed units within `range` of the origin, excluding the origin unit itself. */
  unitsWithin(origin: UnitCore | Square, range: number, metric?: Metric): readonly UnitCore[]
  adjacentUnits(unit: UnitCore): readonly UnitCore[]
  stats(unit: UnitCore): UnitStats
  tierOf(unit: UnitCore): Tier | null
  isCommander(unit: UnitCore): boolean
  abilitiesOf(unit: UnitCore): readonly AbilityId[]
  hasAbility(unit: UnitCore, abilityId: AbilityId): boolean
  squareExists(square: Square): boolean
  /** Blocker or building (A1-11, A1-13). */
  isTerrain(square: Square): boolean
  /** R36 / VISION_OCCLUSION: whether anything on this board stops sight, and whether this square does. */
  hasSightBlockers(): boolean
  blocksSight(square: Square): boolean
  areas(): readonly AreaCore[]
  mines(): readonly MineCore[]
  mineAt(square: Square): MineCore | undefined
  buildings(): readonly BuildingCore[]
  /** The square is inside the unit's LOV (Manhattan, A1-03; tall blockers occlude it under R36). */
  inLov(viewer: UnitCore, square: Square): boolean
  /** Per-turn counters of a unit (own units only on a ViewQuery). */
  unitTurn(unit: UnitCore): UnitTurnView | undefined
  cooldown(unit: UnitCore, abilityId: AbilityId): CooldownState | undefined
  /** Counters reset at the start of the seat's own turn (own seat only on a ViewQuery). */
  seatCounter(seat: Seat, key: string): number
  /** Counters reset at the start of every turn (own seat only on a ViewQuery). */
  turnCounter(seat: Seat, key: string): number
  /** Remaining AP; on a ViewQuery the opponent's is public under R15 (undefined if SHOW_OPPONENT_AP is off). */
  ap(seat: Seat): number | undefined
}

/** What static-modifier hooks may read: everything except stats (prevents recursion). */
export type StatsQuery = Omit<RulesQuery, 'stats' | 'inLov'>

function rectOfTarget(sizeOf: (u: UnitCore) => 1 | 2, x: UnitCore | Square) {
  if ('id' in x) return x.anchor === null ? null : footprintRect(x.anchor, sizeOf(x))
  return pointRect(x)
}

/** Shared geometry part of a RulesQuery over any unit list. */
export function measureDistance(
  sizeOf: (u: UnitCore) => 1 | 2,
  a: UnitCore | Square,
  b: UnitCore | Square,
  metric: Metric = 'manhattan',
): number {
  const ra = rectOfTarget(sizeOf, a)
  const rb = rectOfTarget(sizeOf, b)
  if (ra === null || rb === null) return Number.POSITIVE_INFINITY
  return rectDistance(ra, rb, metric)
}

/** RulesQuery over the authority's full state. */
export class StateQuery implements RulesQuery {
  readonly perspective = null
  constructor(readonly state: GameState) {}

  get phase(): Phase {
    return this.state.phase
  }
  get activeSeat(): Seat | null {
    return this.state.turn?.activeSeat ?? null
  }
  get turnNumber(): number {
    return this.state.turn?.number ?? 0
  }
  get settings(): MatchSettings {
    return this.state.settings
  }
  opponentOf(seat: Seat): Seat {
    return opponentOf(seat)
  }
  sideOf(seat: Seat): Side | null {
    return sideOf(this.state, seat)
  }
  ownTurn(seat: Seat): number {
    return this.state.seats[seat].ownTurns
  }
  commanderOf(seat: Seat): CommanderId | null {
    return commanderIdOf(this.state, seat)
  }
  commanderVariantOf(seat: Seat): string | null {
    return commanderVariantOf(this.state, seat)
  }
  unit(id: UnitId): UnitCore | undefined {
    return this.state.units.find((u) => u.id === id)
  }
  units(): readonly UnitCore[] {
    return this.state.units.filter((u) => u.anchor !== null)
  }
  unitAt(square: Square): UnitCore | undefined {
    return this.state.units.find((u) => unitFootprint(u).some((f) => sameSquare(f, square)))
  }
  sizeOf(unit: UnitCore): 1 | 2 {
    return unitSize(unit)
  }
  footprint(unit: UnitCore): readonly Square[] {
    return unitFootprint(unit)
  }
  distance(a: UnitCore | Square, b: UnitCore | Square, metric: Metric = 'manhattan'): number {
    return measureDistance(unitSize, a, b, metric)
  }
  isAdjacent(a: UnitCore | Square, b: UnitCore | Square): boolean {
    if ('id' in a && 'id' in b && a.id === b.id) return false
    return this.distance(a, b, adjacencyMetric(ADJACENCY)) === 1
  }
  unitsWithin(origin: UnitCore | Square, range: number, metric: Metric = 'manhattan'): readonly UnitCore[] {
    const originId = 'id' in origin ? origin.id : null
    return this.units().filter((u) => u.id !== originId && this.distance(origin, u, metric) <= range)
  }
  adjacentUnits(unit: UnitCore): readonly UnitCore[] {
    return this.units().filter((u) => this.isAdjacent(unit, u))
  }
  stats(unit: UnitCore): UnitStats {
    return computeStats(this, unit)
  }
  tierOf(unit: UnitCore): Tier | null {
    return effectiveTier(this.state, unit)
  }
  isCommander(unit: UnitCore): boolean {
    return unit.type === 'commander'
  }
  abilitiesOf(unit: UnitCore): readonly AbilityId[] {
    return unitAbilities(this.state, unit)
  }
  hasAbility(unit: UnitCore, abilityId: AbilityId): boolean {
    return this.abilitiesOf(unit).includes(abilityId)
  }
  squareExists(square: Square): boolean {
    return squareExists(square)
  }
  isTerrain(square: Square): boolean {
    return isBlocker(this.state, square) || buildingAt(this.state, square) !== undefined
  }
  hasSightBlockers(): boolean {
    return sightBlockersExist(scenarioOf(this.state))
  }
  blocksSight(square: Square): boolean {
    return blocksSightIn(scenarioOf(this.state), square, (s) => this.isTerrain(s))
  }
  areas(): readonly AreaCore[] {
    return this.state.areas
  }
  mines(): readonly MineCore[] {
    return this.state.mines
  }
  mineAt(square: Square): MineCore | undefined {
    return this.state.mines.find((m) => sameSquare(m.square, square))
  }
  buildings(): readonly BuildingCore[] {
    return this.state.buildings
  }
  inLov(viewer: UnitCore, square: Square): boolean {
    return lovContains(this, viewer, square)
  }
  unitTurn(unit: UnitCore): UnitTurnView | undefined {
    return this.state.units.find((u) => u.id === unit.id)?.turn
  }
  cooldown(unit: UnitCore, abilityId: AbilityId): CooldownState | undefined {
    return this.state.units.find((u) => u.id === unit.id)?.cooldowns[abilityId]
  }
  seatCounter(seat: Seat, key: string): number {
    return this.state.seats[seat].counters[key] ?? 0
  }
  turnCounter(seat: Seat, key: string): number {
    return this.state.seats[seat].turnCounters[key] ?? 0
  }
  ap(seat: Seat): number | undefined {
    return this.state.seats[seat].ap
  }
}
