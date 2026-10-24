// Scenario DSL: builds a battle-phase GameState from a compact description, for rules tests (and a dev
// sandbox). Units are placed by name at squares for a side:
//
//   const b = buildBattle({
//     south: ['commander@E1', 'paladin@E5:P', { type: 'soldier', at: 'F5', label: 'S', toughness: 3 }],
//     north: ['commander@U25', 'berserker@E6:B'],
//   })
//   const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('P'), target: { kind: 'unit', unitId: b.id('B') } })
//
// Defaults: Open Field, the effect-free 'baseline' commander, host = South, South active on its turn 1 with
// the round-1 pool (20 AP: R1 doubled by the R28 approach boost), buildings neutral. A side without a commander gets one on its back row (E1 / U25).

import { apply, type ApplyOptions, type ApplyResult, type Intent } from '../commands'
import { apForRound, APPROACH_BOOST } from '../constants'
import { commanderDef } from '../content/commanders'
import { isRosterUnit, unitDef } from '../content/units'
import { deploymentSquares } from '../deployment'
import { backRowY, footprintSquares, parseSquare, squareName } from '../geometry'
import { startRecord, submit, type MatchRecord } from '../history'
import { Resolver } from '../resolve'
import { createGame, isOpenGround, newUnit, opponentOf, unitAt } from '../state'
import type {
  ArmyList,
  BuildingKind,
  CommanderId,
  GameState,
  MatchSettings,
  RosterUnitId,
  Seat,
  Side,
  Square,
  UnitId,
  UnitState,
  UnitTypeId,
} from '../types'

export interface PlacementSpec {
  readonly type: UnitTypeId
  /** 'E5' or { x, y }: the unit's anchor (south-west square). */
  readonly at: string | Square
  readonly label?: string
  readonly toughness?: number
  readonly defending?: boolean
  readonly stealthed?: boolean
}

/** 'type@SQUARE' or 'type@SQUARE:label', e.g. 'paladin@E5:P'. */
export type Placement = string | PlacementSpec

export interface BattleSpec {
  readonly south?: readonly Placement[]
  readonly north?: readonly Placement[]
  readonly commanders?: Partial<Record<Side, CommanderId>>
  /** Commander variants (Baba Yaga, R11); defaults to the commander's first variant. */
  readonly variants?: Partial<Record<Side, string>>
  /** Which seat plays South (default 'host'). */
  readonly southSeat?: Seat
  /** Whose turn it is (default 'south'). */
  readonly active?: Side
  /** AP of the active side (default: the round-1 pool, 20). */
  readonly ap?: number
  readonly settings?: Partial<MatchSettings>
  readonly control?: Partial<Record<BuildingKind, Side>>
  readonly mines?: readonly { readonly owner: Side; readonly at: string | Square; readonly revealed?: boolean; readonly label?: string }[]
  readonly seed?: string
}

export interface Battle {
  readonly state: GameState
  readonly south: Seat
  readonly north: Seat
  /** Label -> unit id (labels default to the placement string). */
  readonly ids: Readonly<Record<string, UnitId>>
  /** Label -> mine id. */
  readonly mineIds: Readonly<Record<string, string>>
  id(label: string): UnitId
  seat(side: Side): Seat
}

function toSquare(at: string | Square): Square {
  return typeof at === 'string' ? parseSquare(at) : at
}

function parsePlacement(p: Placement): PlacementSpec & { readonly label: string } {
  if (typeof p !== 'string') return { ...p, label: p.label ?? `${p.type}@${typeof p.at === 'string' ? p.at : `${p.at.x},${p.at.y}`}` }
  const match = /^(\w+)@([A-Ya-y][0-9]{1,2})(?::(\w+))?$/.exec(p.trim())
  const type = match?.[1]
  const at = match?.[2]
  if (type === undefined || at === undefined) throw new Error(`Bad placement: ${p}`)
  return { type: type as UnitTypeId, at, label: match?.[3] ?? p }
}

export function buildBattle(spec: BattleSpec = {}): Battle {
  const south = spec.southSeat ?? 'host'
  const north = opponentOf(south)
  const seatOf = (side: Side): Seat => (side === 'south' ? south : north)
  const state = createGame({ seed: spec.seed ?? 'dsl', settings: { scenarioId: 'openField', devContent: true, ...spec.settings } })
  state.southSeat = south
  const ids: Record<string, UnitId> = {}
  const created: { unit: UnitState; spec: PlacementSpec }[] = []

  for (const side of ['south', 'north'] as const) {
    const seat = seatOf(side)
    const placements = [...(side === 'south' ? (spec.south ?? []) : (spec.north ?? []))].map(parsePlacement)
    if (!placements.some((p) => p.type === 'commander')) placements.unshift({ type: 'commander', at: side === 'south' ? 'E1' : 'U25', label: `${side}Commander` })
    const commander = spec.commanders?.[side] ?? 'baseline'
    const counts: Partial<Record<RosterUnitId, number>> = {}
    for (const p of placements) if (isRosterUnit(p.type)) counts[p.type] = (counts[p.type] ?? 0) + 1
    const firstRoster = placements.find((p) => isRosterUnit(p.type))
    const faction = firstRoster === undefined ? 'empire' : (unitDef(firstRoster.type).faction ?? 'empire')
    const variant = spec.variants?.[side] ?? commanderDef(commander).variants[0]?.id
    state.seats[seat].army = { faction, commander, units: counts, ...(variant === undefined ? {} : { variant }) }
    for (const p of placements) {
      const anchor = toSquare(p.at)
      for (const s of footprintSquares(anchor, unitDef(p.type).size)) {
        if (!isOpenGround(state, s)) throw new Error(`${p.label}: ${squareName(s)} is not open ground`)
        if (unitAt(state, s) !== undefined) throw new Error(`${p.label}: ${squareName(s)} is occupied`)
      }
      const unit = newUnit(state, p.type, seat, anchor, 1, null)
      state.units.push(unit)
      ids[p.label] = unit.id
      created.push({ unit, spec: p })
    }
  }

  const mineIds: Record<string, string> = {}
  for (const [i, m] of (spec.mines ?? []).entries()) {
    const id = `m-dsl${i}`
    state.mines.push({ id, owner: seatOf(m.owner), square: toSquare(m.at), revealed: m.revealed ?? false, seq: state.nextSeq++, placedBy: null })
    mineIds[m.label ?? `mine${i}`] = id
  }
  for (const building of state.buildings) {
    const side = spec.control?.[building.kind]
    building.controller = side === undefined ? null : seatOf(side)
  }

  const active = seatOf(spec.active ?? 'south')
  state.phase = 'battle'
  state.turn = { number: (spec.active ?? 'south') === 'south' ? 1 : 2, activeSeat: active }
  state.seats[south].ownTurns = 1
  state.seats[north].ownTurns = (spec.active ?? 'south') === 'north' ? 1 : 0
  state.seats[active].ap = spec.ap ?? apForRound(1) * APPROACH_BOOST

  const r = new Resolver(state)
  for (const { unit, spec: p } of created) {
    unit.toughness = r.stats(unit).baseToughness
    unit.defending = p.defending ?? false
    unit.stealthed = p.stealthed ?? false
  }
  r.invalidate()
  r.settle()
  r.noteFirstContact()
  for (const { unit, spec: p } of created) if (p.toughness !== undefined) unit.toughness = p.toughness

  return {
    state,
    south,
    north,
    ids,
    mineIds,
    id(label: string): UnitId {
      const id = ids[label]
      if (id === undefined) throw new Error(`No unit labelled ${label}`)
      return id
    },
    seat: seatOf,
  }
}

export interface MatchStartSpec {
  readonly armies: Readonly<Record<Seat, ArmyList>>
  readonly seed?: string
  /** Stands in for the commit-reveal result (rng.combineSecrets). */
  readonly coinSeed?: string
  readonly settings?: Partial<MatchSettings>
}

function submitOrThrow(record: MatchRecord, seat: Seat, intent: Intent): MatchRecord {
  const result = submit(record, seat, intent)
  if (!result.ok) throw new Error(`${intent.kind} rejected: ${result.code} ${result.message}`)
  return result.record
}

/**
 * Runs the real flow (lobby -> coin flip -> deployment -> battle) through history.submit, deploying every
 * unit on the first legal squares of its zones from the back row forward. Returns a record in the battle.
 */
export function startMatch(spec: MatchStartSpec): MatchRecord {
  let record = startRecord(createGame({ seed: spec.seed ?? 'match', settings: { scenarioId: 'openField', ...spec.settings } }))
  for (const seat of ['host', 'guest'] as const) {
    record = submitOrThrow(record, seat, { kind: 'setArmy', army: spec.armies[seat] })
    record = submitOrThrow(record, seat, { kind: 'setReady', ready: true })
  }
  record = submitOrThrow(record, 'host', { kind: 'startDeployment', coinSeed: spec.coinSeed ?? 'coin' })
  for (const seat of ['host', 'guest'] as const) {
    const side = record.state.southSeat === seat ? 'south' : 'north'
    const back = backRowY(side)
    for (const unit of record.state.units.filter((u) => u.owner === seat)) {
      const squares = deploymentSquares(side, unit.type).sort((a, b) => Math.abs(a.y - back) - Math.abs(b.y - back) || a.x - b.x)
      const anchor = squares.find((s) => submit(record, seat, { kind: 'deploy', unitId: unit.id, anchor: s }).ok)
      if (anchor === undefined) throw new Error(`No room to deploy ${unit.type}`)
      record = submitOrThrow(record, seat, { kind: 'deploy', unitId: unit.id, anchor })
    }
  }
  record = submitOrThrow(record, 'host', { kind: 'confirmDeployment', confirmed: true })
  return submitOrThrow(record, 'guest', { kind: 'confirmDeployment', confirmed: true })
}

/** apply() that throws with the rejection message, for concise tests. */
export function act(state: GameState, seat: Seat, intent: Intent, options?: ApplyOptions): Extract<ApplyResult, { ok: true }> {
  const result = apply(state, seat, intent, options)
  if (!result.ok) throw new Error(`${intent.kind} rejected: ${result.code} ${result.message}`)
  return result
}

export function unitIn(state: GameState, id: UnitId): UnitState | undefined {
  return state.units.find((u) => u.id === id)
}

export function sqs(...names: string[]): Square[] {
  return names.map(parseSquare)
}
