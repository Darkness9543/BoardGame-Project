// State machine B (research-ux-conventions 24): hidden, simultaneous deployment by brush (a tray type), by lifting a
// placed token, by swapping two tokens, plus the auto-deploy heuristic (24.5), mirroring and saved formations
// (PX DP-09). The engine's validateIntent is the judge of every square; placements are sent as deploy intents.

import {
  BOARD_SIZE,
  allowedZones,
  backRowY,
  deploymentSquares,
  footprintSquares,
  isInZone,
  sameSquare,
  squareIndex,
  unitDef,
  validateIntent,
  type Intent,
  type PlayerView,
  type Side,
  type Square,
  type UnitId,
  type UnitTypeId,
  type UnitView,
} from '@coinduel/engine'
import type { PointerButton } from '../contracts'
import { unitAt, viewQuery } from './rules'

export type DeployState =
  | { readonly t: 'browsing' }
  | { readonly t: 'brush'; readonly type: UnitTypeId }
  | { readonly t: 'lifted'; readonly unitId: UnitId }

export type DeployEvent =
  | { readonly t: 'pickType'; readonly type: UnitTypeId }
  | { readonly t: 'clickSquare'; readonly square: Square; readonly button: PointerButton }
  | { readonly t: 'clickUnit'; readonly unitId: UnitId; readonly button: PointerButton }
  | { readonly t: 'drop'; readonly source: { readonly type: UnitTypeId } | { readonly unitId: UnitId }; readonly square: Square | null }
  | { readonly t: 'cancel' }

export interface DeployResult {
  readonly state: DeployState
  /** Sent in order; each one is validated by the authority. */
  readonly intents: readonly Intent[]
  readonly hint: string | null
}

export const BROWSING: DeployState = { t: 'browsing' }

// ---------------------------------------------------------------- the tray

export interface TrayGroup {
  readonly type: UnitTypeId
  readonly total: number
  readonly unplaced: readonly UnitView[]
  readonly placed: readonly UnitView[]
  /** May use the extended rows (Vanguard, A5-04). */
  readonly vanguard: boolean
}

export function ownArmyUnits(view: PlayerView): UnitView[] {
  return view.units.filter((u) => u.owner === view.seat && unitDef(u.type).deployable)
}

/** Groups by type, the commander first (required), then by tier. */
export function trayGroups(view: PlayerView): TrayGroup[] {
  const groups = new Map<UnitTypeId, UnitView[]>()
  for (const unit of ownArmyUnits(view)) groups.set(unit.type, [...(groups.get(unit.type) ?? []), unit])
  return [...groups.entries()]
    .map(([type, units]) => ({
      type,
      total: units.length,
      unplaced: units.filter((u) => u.anchor === null),
      placed: units.filter((u) => u.anchor !== null),
      vanguard: allowedZones(type).includes('extended'),
    }))
    .sort((a, b) => Number(b.type === 'commander') - Number(a.type === 'commander') || (unitDef(a.type).tier ?? 0) - (unitDef(b.type).tier ?? 0))
}

export function unplacedCount(view: PlayerView): number {
  return ownArmyUnits(view).filter((u) => u.anchor === null).length
}

function nextUnplaced(view: PlayerView, type: UnitTypeId): UnitView | undefined {
  return ownArmyUnits(view).find((u) => u.type === type && u.anchor === null)
}

/** Squares where a unit of this type may be placed now (the engine's own check, per square). */
export function validSquares(view: PlayerView, type: UnitTypeId, unitId?: UnitId): Square[] {
  if (view.side === null) return []
  const unit = unitId === undefined ? nextUnplaced(view, type) ?? ownArmyUnits(view).find((u) => u.type === type) : ownArmyUnits(view).find((u) => u.id === unitId)
  if (unit === undefined) return []
  return deploymentSquares(view.side, type).filter((s) => validateIntent(view, { kind: 'deploy', unitId: unit.id, anchor: s }).ok)
}

// ---------------------------------------------------------------- the reducer

const result = (state: DeployState, intents: readonly Intent[] = [], hint: string | null = null): DeployResult => ({ state, intents, hint })

function place(view: PlayerView, unit: UnitView, square: Square): Intent[] | string {
  const verdict = validateIntent(view, { kind: 'deploy', unitId: unit.id, anchor: square })
  return verdict.ok ? [{ kind: 'deploy', unitId: unit.id, anchor: square }] : verdict.message
}

/** Why `unit` may not stand at `anchor` because of its zones (A5-04: only Vanguard units use the extended rows), or null. */
function zoneRefusal(view: PlayerView, unit: UnitView, anchor: Square): string | null {
  const side = view.side
  if (side === null) return 'Sides are not decided yet'
  const zones = allowedZones(unit.type)
  const fits = footprintSquares(anchor, unit.size).every((s) => zones.some((zone) => isInZone(side, s, zone)))
  return fits ? null : `${unitDef(unit.type).name} can't stand in the extended rows`
}

/**
 * Swap two placed tokens of the same size (UX 24.3): free one square, move, then refill the other. Both must be
 * allowed where they go, or nothing is sent (a half-applied swap would drop a unit back to the tray).
 */
function swap(view: PlayerView, moving: UnitView, other: UnitView, origin: Square | null): Intent[] | string {
  if (moving.size !== other.size) return 'Only units of the same size can swap'
  const target = other.anchor
  if (target === null) return 'That unit is not placed'
  const refusal = zoneRefusal(view, moving, target) ?? (origin === null ? null : zoneRefusal(view, other, origin))
  if (refusal !== null) return refusal
  const intents: Intent[] = [{ kind: 'undeploy', unitId: other.id }, { kind: 'deploy', unitId: moving.id, anchor: target }]
  if (origin !== null) intents.push({ kind: 'deploy', unitId: other.id, anchor: origin })
  return intents
}

export function reduceDeploy(state: DeployState, event: DeployEvent, view: PlayerView): DeployResult {
  const own = (id: UnitId): UnitView | undefined => ownArmyUnits(view).find((u) => u.id === id)
  switch (event.t) {
    case 'cancel':
      return result(BROWSING)
    case 'pickType':
      return nextUnplaced(view, event.type) === undefined ? result(state, [], 'Every unit of that type is placed') : result({ t: 'brush', type: event.type })
    case 'clickUnit': {
      const unit = own(event.unitId)
      if (unit === undefined) return result(state)
      if (event.button === 'secondary') return unit.anchor === null ? result(state) : result(BROWSING, [{ kind: 'undeploy', unitId: unit.id }])
      return onToken(state, unit, view)
    }
    case 'clickSquare': {
      if (event.button === 'secondary') return result(BROWSING)
      const occupant = unitAt(view, event.square)
      if (occupant !== undefined && occupant.owner === view.seat) return onToken(state, occupant, view)
      return onSquare(state, event.square, view)
    }
    case 'drop': {
      const source = event.source
      const moving = 'unitId' in source ? own(source.unitId) : nextUnplaced(view, source.type)
      if (moving === undefined) return result(BROWSING)
      if (event.square === null) return moving.anchor === null ? result(BROWSING) : result(BROWSING, [{ kind: 'undeploy', unitId: moving.id }])
      const occupant = unitAt(view, event.square)
      if (occupant !== undefined && occupant.owner === view.seat && occupant.id !== moving.id) {
        const intents = swap(view, moving, occupant, moving.anchor)
        return typeof intents === 'string' ? result(BROWSING, [], intents) : result(BROWSING, intents)
      }
      const intents = place(view, moving, event.square)
      return typeof intents === 'string' ? result(BROWSING, [], intents) : result(BROWSING, intents)
    }
  }
}

function onToken(state: DeployState, unit: UnitView, view: PlayerView): DeployResult {
  switch (state.t) {
    case 'browsing':
      return unit.anchor === null ? result({ t: 'brush', type: unit.type }) : result({ t: 'lifted', unitId: unit.id })
    case 'lifted': {
      if (state.unitId === unit.id) return result(BROWSING)
      const moving = ownArmyUnits(view).find((u) => u.id === state.unitId)
      if (moving === undefined) return result(BROWSING)
      const intents = swap(view, moving, unit, moving.anchor)
      return typeof intents === 'string' ? result(state, [], intents) : result(BROWSING, intents)
    }
    case 'brush': {
      const moving = nextUnplaced(view, state.type)
      if (moving === undefined) return result({ t: 'lifted', unitId: unit.id })
      // A tray brush onto a placed token: it takes the square and the token goes back to the tray.
      if (moving.size !== unit.size || unit.anchor === null) return result(state, [], 'Only units of the same size can swap')
      const refusal = zoneRefusal(view, moving, unit.anchor)
      if (refusal !== null) return result(state, [], refusal)
      const intents: Intent[] = [{ kind: 'undeploy', unitId: unit.id }, { kind: 'deploy', unitId: moving.id, anchor: unit.anchor }]
      return result(remainingBrush(view, state.type, 1), intents)
    }
  }
}

function remainingBrush(view: PlayerView, type: UnitTypeId, consumed: number): DeployState {
  const left = ownArmyUnits(view).filter((u) => u.type === type && u.anchor === null).length - consumed
  return left > 0 ? { t: 'brush', type } : BROWSING
}

function onSquare(state: DeployState, square: Square, view: PlayerView): DeployResult {
  switch (state.t) {
    case 'browsing':
      return result(state)
    case 'brush': {
      const unit = nextUnplaced(view, state.type)
      if (unit === undefined) return result(BROWSING)
      const intents = place(view, unit, square)
      // The brush stays on the type while copies remain (sticky, UX 24.3).
      return typeof intents === 'string' ? result(state, [], intents) : result(remainingBrush(view, state.type, 1), intents)
    }
    case 'lifted': {
      const unit = ownArmyUnits(view).find((u) => u.id === state.unitId)
      if (unit === undefined) return result(BROWSING)
      const intents = place(view, unit, square)
      return typeof intents === 'string' ? result(state, [], intents) : result(BROWSING, intents)
    }
  }
}

// ---------------------------------------------------------------- planning placements locally

/** Rows counted from this side's own edge: row 1 is the back row. */
export function rowY(side: Side, row: number): number {
  return side === 'south' ? backRowY('south') + (row - 1) : backRowY('north') - (row - 1)
}

export function rowOf(side: Side, y: number): number {
  return side === 'south' ? y - backRowY('south') + 1 : backRowY('north') - y + 1
}

class Planner {
  private readonly taken = new Set<number>()

  constructor(private readonly view: PlayerView, private readonly side: Side, keep: readonly UnitView[]) {
    for (const u of keep) if (u.anchor !== null) for (const s of footprintSquares(u.anchor, u.size)) this.taken.add(squareIndex(s))
  }

  fits(unit: UnitView, anchor: Square): boolean {
    const q = viewQuery(this.view)
    const zone = deploymentSquares(this.side, unit.type)
    return footprintSquares(anchor, unit.size).every(
      (s) => q.squareExists(s) && !q.isTerrain(s) && zone.some((z) => sameSquare(z, s)) && !this.taken.has(squareIndex(s)),
    )
  }

  take(unit: UnitView, anchor: Square): void {
    for (const s of footprintSquares(anchor, unit.size)) this.taken.add(squareIndex(s))
  }

  /** The first fitting anchor in the given rows, centre outwards, left first as this player sees the board. */
  best(unit: UnitView, rows: readonly number[]): Square | null {
    const centre = (BOARD_SIZE - unit.size) / 2
    const columns = [...Array(BOARD_SIZE - unit.size + 1).keys()].sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b)
    for (const row of rows) {
      for (const column of columns) {
        // A size-2 anchor is its south-west square; on North's side the block extends towards the own edge.
        const y = rowY(this.side, row) - (this.side === 'north' && unit.size === 2 ? 1 : 0)
        const anchor = { x: toColumn(this.side, column, unit.size), y }
        if (this.fits(unit, anchor)) return anchor
      }
    }
    return null
  }
}

/** UX 24.5: commander centre-back, toughest units in the front row, scouts and long sight behind, the rest from the centre. */
export function autoDeployPlan(view: PlayerView): { unitId: UnitId; anchor: Square }[] {
  const side = view.side
  if (side === null) return []
  const units = ownArmyUnits(view)
  const planner = new Planner(view, side, units.filter((u) => u.anchor !== null))
  const pending = units.filter((u) => u.anchor === null)
  const plan: { unitId: UnitId; anchor: Square }[] = []
  const put = (unit: UnitView, rows: readonly number[]): boolean => {
    const anchor = planner.best(unit, rows)
    if (anchor === null) return false
    planner.take(unit, anchor)
    plan.push({ unitId: unit.id, anchor })
    return true
  }
  const everyRow = [5, 4, 3, 2, 1]
  const commander = pending.find((u) => u.isCommander)
  if (commander !== undefined) put(commander, [1, 2, 3, 4, 5])
  const rest = pending.filter((u) => !u.isCommander)
  const vanguard = rest.filter((u) => allowedZones(u.type).includes('extended'))
  const ranged = rest.filter((u) => !vanguard.includes(u) && (u.lov >= 3 || u.attackRange >= 2))
  const others = rest.filter((u) => !vanguard.includes(u) && !ranged.includes(u)).sort((a, b) => b.maxToughness - a.maxToughness)
  for (const unit of others) put(unit, everyRow)
  for (const unit of ranged) put(unit, [4, 3, 2, 5, 1])
  for (const unit of vanguard) put(unit, [6, 7, 5, 4, 3, 2, 1])
  return plan
}

export function autoDeployIntents(view: PlayerView): Intent[] {
  return autoDeployPlan(view).map((p) => ({ kind: 'deploy', unitId: p.unitId, anchor: p.anchor }))
}

/** Mirror the placed formation left-right. Everything is lifted first so swapped squares can't collide. */
export function mirrorIntents(view: PlayerView): Intent[] {
  const placed = ownArmyUnits(view).filter((u) => u.anchor !== null)
  const lift: Intent[] = placed.map((u) => ({ kind: 'undeploy', unitId: u.id }))
  const drop: Intent[] = placed.flatMap((u) => (u.anchor === null ? [] : [{ kind: 'deploy' as const, unitId: u.id, anchor: { x: BOARD_SIZE - u.size - u.anchor.x, y: u.anchor.y } }]))
  return [...lift, ...drop]
}

export function clearIntents(view: PlayerView): Intent[] {
  return ownArmyUnits(view)
    .filter((u) => u.anchor !== null)
    .map((u) => ({ kind: 'undeploy', unitId: u.id }))
}

// ---------------------------------------------------------------- formations (DP-09), relative to the own edge

export interface FormationSlot {
  readonly type: UnitTypeId
  /** The k-th unit of this type in the army (0-based). */
  readonly ordinal: number
  /** Column as seen from the own edge (left to right for this player). */
  readonly column: number
  /** Row counted from the own edge (1 = back row). */
  readonly row: number
}

function ordinals(view: PlayerView): Map<UnitId, number> {
  const seen = new Map<UnitTypeId, number>()
  const out = new Map<UnitId, number>()
  for (const u of ownArmyUnits(view)) {
    const n = seen.get(u.type) ?? 0
    out.set(u.id, n)
    seen.set(u.type, n + 1)
  }
  return out
}

/** North sees the board rotated 180 degrees, so its "left" is the high x. */
function toColumn(side: Side, x: number, size: number): number {
  return side === 'south' ? x : BOARD_SIZE - size - x
}

export function captureFormation(view: PlayerView): FormationSlot[] {
  const side = view.side
  if (side === null) return []
  const ord = ordinals(view)
  return ownArmyUnits(view).flatMap((u) => {
    if (u.anchor === null) return []
    const yForRow = side === 'north' && u.size === 2 ? u.anchor.y + 1 : u.anchor.y
    return [{ type: u.type, ordinal: ord.get(u.id) ?? 0, column: toColumn(side, u.anchor.x, u.size), row: rowOf(side, yForRow) }]
  })
}

/** Places what fits; units whose saved square is blocked stay in the tray. */
export function formationIntents(view: PlayerView, slots: readonly FormationSlot[]): Intent[] {
  const side = view.side
  if (side === null) return []
  const ord = ordinals(view)
  const units = ownArmyUnits(view)
  const planner = new Planner(view, side, [])
  const intents: Intent[] = units.filter((u) => u.anchor !== null).map((u) => ({ kind: 'undeploy', unitId: u.id }))
  for (const slot of slots) {
    const unit = units.find((u) => u.type === slot.type && ord.get(u.id) === slot.ordinal)
    if (unit === undefined) continue
    const y = rowY(side, slot.row) - (side === 'north' && unit.size === 2 ? 1 : 0)
    const anchor = { x: toColumn(side, slot.column, unit.size), y }
    if (!planner.fits(unit, anchor)) continue
    planner.take(unit, anchor)
    intents.push({ kind: 'deploy', unitId: unit.id, anchor })
  }
  return intents
}
