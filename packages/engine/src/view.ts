// Per-seat projection (4.2, 4.9; A4-15: one authority holds the state and sends each seat only its view). projectView(state, seat) contains only what that seat may know: its own
// units in full, enemy units only while visible (public fields only), no enemy cooldowns, counters or hidden
// objects (AP totals are public, R15), and pending decisions only if addressed to the seat. When the game ends
// the fog lifts.
// Last-seen markers are client memory and never part of a view (A4-16).

import { ADJACENCY, apForRound, ARMY_LISTS_PUBLIC, COMMANDER_REVEAL, SHOW_OPPONENT_AP, type PreferenceValue } from './constants'
import { abilitiesFor } from './content/derived'
import { buildingDef } from './content/buildings'
import { scenarioDef } from './content/scenarios'
import { unitDef } from './content/units'
import { actionSurcharge } from './economy'
import type { GameEvent, VisibleEvent } from './events'
import { adjacencyMetric, footprintSquares, sameSquare, SQUARE_COUNT, squareExists, squareIndex } from './geometry'
import { measureDistance, StateQuery, type AreaCore, type BuildingCore, type MineCore, type RulesQuery, type UnitStats, type UnitTurnView } from './query'
import { blocksSightIn, globalTurnOfOwnTurn, opponentOf, sideOf, sightBlockersExist, unitAbilities } from './state'
import {
  SEATS,
  type AbilityId,
  type ArmyList,
  type CommanderId,
  type CooldownState,
  type DecisionOption,
  type GameResult,
  type GameState,
  type JsonValue,
  type MatchSettings,
  type Metric,
  type Phase,
  type Seat,
  type Side,
  type Square,
  type TakebackRequest,
  type Tier,
  type UnitCore,
  type UnitId,
  type UnitState,
} from './types'
import { lovContains, mineVisibleTo, unitVisibleTo, visionMask } from './vision'

/** Only for the viewer's own units. */
export interface OwnUnitDetails {
  readonly baseToughness: number
  readonly actionAllowance: number
  readonly apCost: number
  /** Extra AP the unit's next action costs (Holy Fervor). */
  readonly nextActionSurcharge: number
  readonly turn: UnitTurnView
  readonly cooldowns: Readonly<Record<AbilityId, CooldownState>>
  readonly abilities: readonly AbilityId[]
}

export interface UnitView extends UnitCore {
  readonly isCommander: boolean
  readonly size: 1 | 2
  readonly tier: Tier | null
  /** Public effective stats (4.2: current and max Power and Toughness; LOV, Movement and range follow from type and commander). */
  readonly power: number
  readonly maxToughness: number
  readonly lov: number
  readonly movement: number
  readonly attackRange: number
  readonly own: OwnUnitDetails | null
}

export type MineView = MineCore

export interface AreaView extends AreaCore {
  /** Global turn number at whose start it expires. */
  readonly expiresAtTurn: number | null
}

export interface DecisionView {
  readonly id: string
  readonly kind: string
  readonly prompt: string
  readonly options: readonly DecisionOption[]
  readonly defaultOption: string
  readonly timeoutSeconds: number
  readonly data: Readonly<Record<string, JsonValue>>
}

export interface TakebackView {
  readonly request: TakebackRequest | null
  /** Whether this seat may request a take-back now (9 TB-3). */
  readonly canRequest: boolean
  readonly usedByMe: number
  /** null = unlimited. */
  readonly remaining: number | null
}

export interface PlayerView {
  readonly seat: Seat
  readonly side: Side | null
  readonly phase: Phase
  readonly settings: MatchSettings
  readonly southSeat: Seat | null
  readonly names: Readonly<Record<Seat, string>>
  readonly turn: { readonly number: number; readonly round: number; readonly activeSeat: Seat } | null
  /** Own-turn indexes of both seats (public: they follow from the turn number). */
  readonly ownTurns: Readonly<Record<Seat, number>>
  readonly myAp: number
  /** AP owed and deducted from my next pool (Cauldron, R11). */
  readonly myApDebt: number
  /** This round's pool size, the same for both players (R1; public, A4-02). */
  readonly apPool: number
  /** Opponent's remaining AP and AP debt when SHOW_OPPONENT_AP (R15), else null. */
  readonly opponentAp: number | null
  readonly opponentApDebt: number | null
  /** R28: the round of first contact (public through the AP totals); null = the approach boost still runs. */
  readonly firstContactRound: number | null
  /** R30: consecutive own turns each seat started holding both buildings (public HUD counter). */
  readonly siegeTurns: Readonly<Record<Seat, number>>
  readonly lobby: { readonly ready: Readonly<Record<Seat, boolean>>; readonly armyChosen: Readonly<Record<Seat, boolean>> }
  readonly myArmy: ArmyList | null
  /** Both armies once they are public (game over, or ARMY_LISTS_PUBLIC). */
  readonly armies: Readonly<Record<Seat, ArmyList | null>> | null
  readonly commanders: Readonly<Record<Seat, CommanderId | null>>
  /** Commander variants (Baba Yaga, R11), public together with the commander. */
  readonly commanderVariants: Readonly<Record<Seat, string | null>>
  readonly deploymentConfirmed: Readonly<Record<Seat, boolean>>
  /** 625 characters, '1' = square inside my vision (index = y * 25 + x). */
  readonly visibility: string
  /** My units (deployed or not) and the enemy units I can see. */
  readonly units: readonly UnitView[]
  /** My dead units; everyone's once the game ends. */
  readonly fallen: readonly UnitView[]
  readonly mines: readonly MineView[]
  /** My areas in full; enemy areas clipped to my vision (A4-13). */
  readonly areas: readonly AreaView[]
  readonly buildings: readonly BuildingCore[]
  /** My own-turn counters and my every-turn counters (ability bookkeeping such as Mend or Cauldron uses). */
  readonly myCounters: Readonly<Record<string, number>>
  readonly myTurnCounters: Readonly<Record<string, number>>
  readonly preferences: Readonly<Record<string, PreferenceValue>>
  /** A decision I must answer. */
  readonly decision: DecisionView | null
  /** The opponent is answering a decision about something I could see (2.11). */
  readonly opponentDeciding: boolean
  readonly takeback: TakebackView
  readonly drawOffer: Seat | null
  readonly result: GameResult | null
}

// ---------------------------------------------------------------- projection

function ownDetails(q: StateQuery, unit: UnitState, stats: UnitStats): OwnUnitDetails {
  return {
    baseToughness: stats.baseToughness,
    actionAllowance: stats.actionAllowance,
    apCost: stats.apCost,
    nextActionSurcharge: actionSurcharge(q, unit),
    turn: unit.turn,
    cooldowns: unit.cooldowns,
    abilities: unitAbilities(q.state, unit),
  }
}

function unitView(q: StateQuery, unit: UnitState, own: boolean): UnitView {
  const stats = q.stats(unit)
  return {
    id: unit.id,
    type: unit.type,
    owner: unit.owner,
    anchor: unit.anchor,
    toughness: unit.toughness,
    defending: unit.defending,
    stealthed: own ? unit.stealthed : false,
    isCommander: unit.type === 'commander',
    size: stats.size,
    tier: stats.tier,
    power: stats.power,
    maxToughness: stats.maxToughness,
    lov: stats.lov,
    movement: stats.movement,
    attackRange: stats.attackRange,
    own: own ? ownDetails(q, unit, stats) : null,
  }
}

/** R16 / A5-09: when the opponent's commander (and variant) become public. */
function commanderRevealed(state: GameState): boolean {
  switch (COMMANDER_REVEAL) {
    case 'lobby':
      return true
    case 'deploymentStart':
      return state.phase !== 'lobby'
    case 'battleStart':
      return state.phase === 'battle' || state.phase === 'ended'
  }
}

/** 9 TB-3 / TB-7 / A9-05: may `seat` ask to undo the most recent action? */
export function canRequestTakeback(state: GameState, seat: Seat): boolean {
  const last = state.lastAction
  const limit = state.settings.takebacksPerGame
  return (
    state.settings.takebacks &&
    state.phase === 'battle' &&
    state.takeback.request === null &&
    state.decisions.length === 0 &&
    last !== null &&
    last.seat === seat &&
    !state.takeback.declined.includes(last.seq) &&
    (limit === null || state.takeback.used[seat] < limit)
  )
}

export function projectView(state: GameState, seat: Seat): PlayerView {
  const q = new StateQuery(state)
  const ended = state.phase === 'ended'
  const battle = state.phase === 'battle'
  const other = opponentOf(seat)
  const mask = ended ? new Uint8Array(SQUARE_COUNT).fill(1) : visionMask(q, seat)
  const sees = (unit: UnitState): boolean => ended || (battle && unitVisibleTo(q, seat, unit, mask))

  const units = state.units.filter((u) => u.owner === seat || sees(u)).map((u) => unitView(q, u, u.owner === seat))
  const fallen = state.fallen.filter((f) => ended || f.unit.owner === seat).map((f) => unitView(q, f.unit, f.unit.owner === seat))
  const mines = state.mines
    .filter((m) => ended || mineVisibleTo(seat, m, mask))
    .map((m) => ({ id: m.id, owner: m.owner, square: m.square, revealed: m.revealed }))
  const areas: AreaView[] = []
  for (const area of state.areas) {
    const squares = area.owner === seat || ended ? area.squares : area.squares.filter((s) => mask[squareIndex(s)] === 1)
    if (squares.length === 0) continue
    areas.push({
      id: area.id,
      abilityId: area.abilityId,
      owner: area.owner,
      squares,
      expiresAtOwnTurn: area.expiresAtOwnTurn,
      expiresAtTurn: globalTurnOfOwnTurn(state, area.owner, area.expiresAtOwnTurn),
      data: area.owner === seat ? area.data : {},
    })
  }
  const head = state.decisions[0]
  const decision: DecisionView | null =
    head !== undefined && head.seat === seat
      ? {
          id: head.id,
          kind: head.kind,
          prompt: head.prompt,
          options: head.options,
          defaultOption: head.defaultOption,
          timeoutSeconds: head.timeoutSeconds,
          data: head.data,
        }
      : null
  const commandersPublic = commanderRevealed(state)
  const armiesPublic = ended || (ARMY_LISTS_PUBLIC && state.phase !== 'lobby')
  const limit = state.settings.takebacksPerGame
  return {
    seat,
    side: sideOf(state, seat),
    phase: state.phase,
    settings: state.settings,
    southSeat: state.southSeat,
    names: { host: state.seats.host.name, guest: state.seats.guest.name },
    turn: state.turn === null ? null : { number: state.turn.number, round: Math.ceil(state.turn.number / 2), activeSeat: state.turn.activeSeat },
    ownTurns: { host: state.seats.host.ownTurns, guest: state.seats.guest.ownTurns },
    myAp: state.seats[seat].ap,
    myApDebt: state.seats[seat].apDebt,
    apPool: apForRound(state.turn === null ? 1 : Math.ceil(state.turn.number / 2)),
    opponentAp: SHOW_OPPONENT_AP ? state.seats[other].ap : null,
    opponentApDebt: SHOW_OPPONENT_AP ? state.seats[other].apDebt : null,
    firstContactRound: state.firstContactRound,
    siegeTurns: { host: state.seats.host.siegeTurns, guest: state.seats.guest.siegeTurns },
    lobby: {
      ready: { host: state.seats.host.ready, guest: state.seats.guest.ready },
      armyChosen: { host: state.seats.host.army !== null, guest: state.seats.guest.army !== null },
    },
    myArmy: state.seats[seat].army,
    armies: armiesPublic ? { host: state.seats.host.army, guest: state.seats.guest.army } : null,
    commanders: {
      host: seat === 'host' || commandersPublic ? (state.seats.host.army?.commander ?? null) : null,
      guest: seat === 'guest' || commandersPublic ? (state.seats.guest.army?.commander ?? null) : null,
    },
    commanderVariants: {
      host: seat === 'host' || commandersPublic ? (state.seats.host.army?.variant ?? null) : null,
      guest: seat === 'guest' || commandersPublic ? (state.seats.guest.army?.variant ?? null) : null,
    },
    deploymentConfirmed: { host: state.seats.host.deploymentConfirmed, guest: state.seats.guest.deploymentConfirmed },
    visibility: Array.from(mask, (v) => (v === 1 ? '1' : '0')).join(''),
    units,
    fallen,
    mines,
    areas,
    buildings: state.buildings.map((b) => ({ kind: b.kind, anchor: b.anchor, controller: b.controller })),
    myCounters: state.seats[seat].counters,
    myTurnCounters: state.seats[seat].turnCounters,
    preferences: state.seats[seat].preferences,
    decision,
    opponentDeciding: head !== undefined && head.seat !== seat && head.publicTo.includes(seat),
    takeback: {
      request: state.takeback.request,
      canRequest: canRequestTakeback(state, seat),
      usedByMe: state.takeback.used[seat],
      remaining: limit === null ? null : Math.max(0, limit - state.takeback.used[seat]),
    },
    drawOffer: state.drawOffer,
    result: state.result,
  }
}

/** A seat's events with the audience stripped (the audience itself would reveal enemy vision). */
export function filterEvents(events: readonly GameEvent[], seat: Seat): VisibleEvent[] {
  return events.filter((e) => e.visibleTo.includes(seat)).map(stripAudience)
}

function stripAudience(event: GameEvent): VisibleEvent {
  const { visibleTo: _audience, ...body } = event
  return body as VisibleEvent
}

// ---------------------------------------------------------------- knowledge-only query

/** RulesQuery over a PlayerView: legality checks and previews on a client see exactly what the seat sees. */
export class ViewQuery implements RulesQuery {
  readonly perspective: Seat
  private readonly occupancy = new Map<number, UnitView>()

  constructor(readonly view: PlayerView) {
    this.perspective = view.seat
    for (const unit of view.units) {
      if (unit.anchor === null) continue
      for (const s of footprintSquares(unit.anchor, unit.size)) this.occupancy.set(squareIndex(s), unit)
    }
  }

  get phase(): Phase {
    return this.view.phase
  }
  get activeSeat(): Seat | null {
    return this.view.turn?.activeSeat ?? null
  }
  get turnNumber(): number {
    return this.view.turn?.number ?? 0
  }
  get settings(): MatchSettings {
    return this.view.settings
  }
  opponentOf(seat: Seat): Seat {
    return opponentOf(seat)
  }
  sideOf(seat: Seat): Side | null {
    if (this.view.southSeat === null) return null
    return this.view.southSeat === seat ? 'south' : 'north'
  }
  ownTurn(seat: Seat): number {
    return this.view.ownTurns[seat]
  }
  commanderOf(seat: Seat): CommanderId | null {
    return this.view.commanders[seat]
  }
  commanderVariantOf(seat: Seat): string | null {
    return this.view.commanderVariants[seat]
  }
  viewUnit(unit: UnitCore | UnitId): UnitView | undefined {
    const id = typeof unit === 'string' ? unit : unit.id
    return this.view.units.find((u) => u.id === id)
  }
  unit(id: UnitId): UnitCore | undefined {
    return this.viewUnit(id)
  }
  units(): readonly UnitCore[] {
    return this.view.units.filter((u) => u.anchor !== null)
  }
  unitAt(square: Square): UnitCore | undefined {
    return this.occupancy.get(squareIndex(square))
  }
  sizeOf(unit: UnitCore): 1 | 2 {
    return this.viewUnit(unit)?.size ?? unitDef(unit.type).size
  }
  footprint(unit: UnitCore): readonly Square[] {
    return unit.anchor === null ? [] : footprintSquares(unit.anchor, this.sizeOf(unit))
  }
  distance(a: UnitCore | Square, b: UnitCore | Square, metric: Metric = 'manhattan'): number {
    return measureDistance((u) => this.sizeOf(u), a, b, metric)
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
    const v = this.viewUnit(unit)
    const def = unitDef(unit.type)
    if (v === undefined) {
      return { power: def.power, baseToughness: def.toughness, maxToughness: def.toughness, lov: def.lov, movement: def.movement, attackRange: def.attackRange, actionAllowance: 1, apCost: def.ap, tier: def.tier, size: def.size }
    }
    return {
      power: v.power,
      baseToughness: v.own?.baseToughness ?? v.maxToughness,
      maxToughness: v.maxToughness,
      lov: v.lov,
      movement: v.movement,
      attackRange: v.attackRange,
      actionAllowance: v.own?.actionAllowance ?? 1,
      apCost: v.own?.apCost ?? def.ap,
      tier: v.tier,
      size: v.size,
    }
  }
  tierOf(unit: UnitCore): Tier | null {
    return this.viewUnit(unit)?.tier ?? unitDef(unit.type).tier
  }
  isCommander(unit: UnitCore): boolean {
    return unit.type === 'commander'
  }
  abilitiesOf(unit: UnitCore): readonly AbilityId[] {
    return this.viewUnit(unit)?.own?.abilities ?? abilitiesFor(unit.type, this.view.commanders[unit.owner], this.view.commanderVariants[unit.owner])
  }
  hasAbility(unit: UnitCore, abilityId: AbilityId): boolean {
    return this.abilitiesOf(unit).includes(abilityId)
  }
  squareExists(square: Square): boolean {
    return squareExists(square)
  }
  hasSightBlockers(): boolean {
    return sightBlockersExist(scenarioDef(this.view.settings.scenarioId))
  }
  blocksSight(square: Square): boolean {
    return blocksSightIn(scenarioDef(this.view.settings.scenarioId), square, (s) => this.isTerrain(s))
  }
  isTerrain(square: Square): boolean {
    const scenario = scenarioDef(this.view.settings.scenarioId)
    return (
      scenario.blockers.some((b) => sameSquare(b, square)) ||
      scenario.tallBlockers.some((b) => sameSquare(b, square)) ||
      this.view.buildings.some((b) => footprintSquares(b.anchor, buildingDef(b.kind).size).some((f) => sameSquare(f, square)))
    )
  }
  areas(): readonly AreaCore[] {
    return this.view.areas
  }
  mines(): readonly MineCore[] {
    return this.view.mines
  }
  mineAt(square: Square): MineCore | undefined {
    return this.view.mines.find((m) => sameSquare(m.square, square))
  }
  buildings(): readonly BuildingCore[] {
    return this.view.buildings
  }
  inLov(viewer: UnitCore, square: Square): boolean {
    return lovContains(this, viewer, square)
  }
  unitTurn(unit: UnitCore): UnitTurnView | undefined {
    return this.viewUnit(unit)?.own?.turn
  }
  cooldown(unit: UnitCore, abilityId: AbilityId): CooldownState | undefined {
    return this.viewUnit(unit)?.own?.cooldowns[abilityId]
  }
  seatCounter(seat: Seat, key: string): number {
    return seat === this.view.seat ? (this.view.myCounters[key] ?? 0) : 0
  }
  turnCounter(seat: Seat, key: string): number {
    return seat === this.view.seat ? (this.view.myTurnCounters[key] ?? 0) : 0
  }
  ap(seat: Seat): number | undefined {
    if (seat === this.view.seat) return this.view.myAp
    return this.view.opponentAp ?? undefined
  }
}

/** Squares currently in a view's vision. */
export function isVisibleSquare(view: PlayerView, square: Square): boolean {
  return view.visibility.charAt(squareIndex(square)) === '1'
}
