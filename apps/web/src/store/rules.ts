// The UI's questions to the engine, memoised per PlayerView (views are immutable, so a WeakMap cache is safe).
// Everything here runs on the player's own view, so it can't leak hidden facts (PX R1, UX 27.1).

import {
  CHARGE_MIN_MOVEMENT,
  COMMANDER_MINE_CONFIRMATION,
  GROUP_MARCH_COST,
  GROUP_MARCH_ENABLED,
  abilityData,
  attackTargets,
  chargeTargets,
  footprintSquares,
  hasAbilityData,
  isVisibleSquare,
  legalActions,
  liveAbility,
  reachableSquares,
  sameSquare,
  squareIndex,
  targetOptions,
  ViewQuery,
  type AbilityTarget,
  type ActionOption,
  type AttackTarget,
  type MineView,
  type PlayerView,
  type ReachableSquare,
  type Square,
  type TargetSpec,
  type UnitId,
  type UnitView,
} from '@coinduel/engine'

const cache = new WeakMap<PlayerView, Map<string, unknown>>()

function memo<T>(view: PlayerView, key: string, compute: () => T): T {
  let entries = cache.get(view)
  if (entries === undefined) {
    entries = new Map()
    cache.set(view, entries)
  }
  if (entries.has(key)) return entries.get(key) as T
  const value = compute()
  entries.set(key, value)
  return value
}

export const squareKey = (s: Square): number => squareIndex(s)

// ---------------------------------------------------------------- units and squares

export function unitById(view: PlayerView, unitId: UnitId | null): UnitView | undefined {
  if (unitId === null) return undefined
  return view.units.find((u) => u.id === unitId)
}

export function ownUnit(view: PlayerView, unitId: UnitId | null): UnitView | undefined {
  const unit = unitById(view, unitId)
  return unit !== undefined && unit.owner === view.seat ? unit : undefined
}

function occupancy(view: PlayerView): ReadonlyMap<number, UnitView> {
  return memo(view, 'occupancy', () => {
    const map = new Map<number, UnitView>()
    for (const unit of view.units) {
      if (unit.anchor === null) continue
      for (const s of footprintSquares(unit.anchor, unit.size)) map.set(squareIndex(s), unit)
    }
    return map
  })
}

export function unitAt(view: PlayerView, square: Square): UnitView | undefined {
  return occupancy(view).get(squareIndex(square))
}

export function footprint(unit: UnitView): Square[] {
  return unit.anchor === null ? [] : footprintSquares(unit.anchor, unit.size)
}

export function isMyTurn(view: PlayerView): boolean {
  return view.phase === 'battle' && view.turn?.activeSeat === view.seat
}

export function myCommander(view: PlayerView): UnitView | undefined {
  return view.units.find((u) => u.isCommander && u.owner === view.seat)
}

export function deployedOwnUnits(view: PlayerView): UnitView[] {
  return view.units.filter((u) => u.owner === view.seat && u.anchor !== null)
}

/**
 * S-12.1 "can still act": an action left, and one of the unit's actions enabled and affordable. A basic action at the
 * unit's AP (Defend almost always counts) settles it cheaply; short of that AP, an ability that costs less and uses an
 * action may still be possible (Stealth 1, Forcefield or Feast 2, Smite 3), which the engine's action bar judges.
 */
export function canStillAct(view: PlayerView, unit: UnitView): boolean {
  const own = unit.own
  if (own === null || unit.anchor === null || !isMyTurn(view)) return false
  if (own.turn.actionsUsed >= own.actionAllowance) return false
  if (view.myAp >= own.apCost + own.nextActionSurcharge) return true
  return actionsFor(view, unit.id).some((o) => o.kind === 'ability' && o.enabled && o.abilityId !== null && hasAbilityData(o.abilityId) && abilityData(o.abilityId).usesAction)
}

export function readyUnits(view: PlayerView): UnitView[] {
  return memo(view, 'ready', () => deployedOwnUnits(view).filter((u) => canStillAct(view, u)))
}

/** Tab / Shift+Tab order: units that can still act, or every own unit when none can. */
export function cycleUnit(view: PlayerView, current: UnitId | null, delta: 1 | -1): UnitId | null {
  const ready = readyUnits(view)
  const pool = ready.length > 0 ? ready : deployedOwnUnits(view)
  if (pool.length === 0) return null
  const index = pool.findIndex((u) => u.id === current)
  const next = index < 0 ? (delta > 0 ? 0 : pool.length - 1) : (index + delta + pool.length) % pool.length
  return pool[next]?.id ?? null
}

// ---------------------------------------------------------------- engine previews, memoised

export function reach(view: PlayerView, unitId: UnitId): readonly ReachableSquare[] {
  return memo(view, `reach:${unitId}`, () => reachableSquares(view, unitId))
}

export function reachTo(view: PlayerView, unitId: UnitId, square: Square): ReachableSquare | undefined {
  return reach(view, unitId).find((r) => sameSquare(r.anchor, square))
}

export function actionsFor(view: PlayerView, unitId: UnitId): readonly ActionOption[] {
  return memo(view, `actions:${unitId}`, () => legalActions(view, unitId))
}

export function actionOption(view: PlayerView, unitId: UnitId, kind: ActionOption['kind'], abilityId: string | null = null): ActionOption | undefined {
  return actionsFor(view, unitId).find((o) => o.kind === kind && o.abilityId === abilityId)
}

export function attackCandidates(view: PlayerView, unitId: UnitId): readonly AttackTarget[] {
  return memo(view, `attack:${unitId}`, () => attackTargets(view, unitId))
}

export interface ChargeOption {
  readonly path: readonly Square[]
  readonly target: AttackTarget
}

export function chargeOptions(view: PlayerView, unitId: UnitId): readonly ChargeOption[] {
  return memo(view, `charge:${unitId}`, () => chargeTargets(view, unitId))
}

/** R26: where a charge may end (each has at least one target from there). */
export function chargeEnds(view: PlayerView, unitId: UnitId): readonly Square[] {
  return memo(view, `chargeEnds:${unitId}`, () => {
    const out: Square[] = []
    for (const option of chargeOptions(view, unitId)) {
      const end = option.path[option.path.length - 1]
      if (end !== undefined && !out.some((s) => sameSquare(s, end))) out.push(end)
    }
    return out
  })
}

export function chargeTargetsFrom(view: PlayerView, unitId: UnitId, end: Square): readonly ChargeOption[] {
  return chargeOptions(view, unitId).filter((o) => {
    const last = o.path[o.path.length - 1]
    return last !== undefined && sameSquare(last, end)
  })
}

export const chargeMaxSteps = (unit: UnitView): number => Math.max(0, unit.movement - 1)
export const canCharge = (unit: UnitView): boolean => unit.movement >= CHARGE_MIN_MOVEMENT

export function abilitySpecs(abilityId: string): readonly TargetSpec[] {
  return liveAbility(abilityId)?.active?.targets ?? []
}

export function pickCandidates(view: PlayerView, unitId: UnitId, abilityId: string, index: number, picks: readonly AbilityTarget[]): readonly AbilityTarget[] {
  return memo(view, `pick:${unitId}:${abilityId}:${index}:${JSON.stringify(picks)}`, () => targetOptions(view, unitId, abilityId, index, picks))
}

// ---------------------------------------------------------------- R27 Group march (not in legalActions)

export interface MarchOption {
  readonly enabled: boolean
  readonly reason: string | null
  readonly cost: number
}

export function marchOption(view: PlayerView, unit: UnitView): MarchOption {
  const blocked = (reason: string): MarchOption => ({ enabled: false, reason, cost: GROUP_MARCH_COST })
  if (!GROUP_MARCH_ENABLED) return blocked('Group march is switched off')
  if (!isMyTurn(view)) return blocked('Not your turn')
  if (view.decision !== null || view.opponentDeciding) return blocked('Waiting for a decision')
  if (view.takeback.request !== null) return blocked('A take-back request is pending')
  if ((unit.own?.turn.actionsUsed ?? 0) > 0) return blocked('Marching units must not have acted this turn')
  if (unit.movement < 1) return blocked('This unit cannot move')
  if (view.myAp < GROUP_MARCH_COST) return blocked(`Not enough AP: needs ${GROUP_MARCH_COST}, has ${view.myAp}`)
  return { enabled: true, reason: null, cost: GROUP_MARCH_COST }
}

/** Own units that could join a march (not acted, can move). Connectivity is validateIntent's job. */
export function marchCandidates(view: PlayerView): UnitView[] {
  return memo(view, 'marchCandidates', () => deployedOwnUnits(view).filter((u) => (u.own?.turn.actionsUsed ?? 1) === 0 && u.movement >= 1))
}

// ---------------------------------------------------------------- known mines (A8-17, R34)

/** Mines the player knows about: their own and revealed enemy mines in vision. */
export function knownMines(view: PlayerView): readonly MineView[] {
  return view.mines
}

/** Squares a path newly enters, step by step (a size-2 unit enters two squares per step). */
export function enteredSquares(start: Square, size: 1 | 2, path: readonly Square[]): Square[] {
  const out: Square[] = []
  let previous = footprintSquares(start, size)
  for (const anchor of path) {
    const now = footprintSquares(anchor, size)
    for (const s of now) if (!previous.some((p) => sameSquare(p, s))) out.push(s)
    previous = now
  }
  return out
}

export function minesOnPath(view: PlayerView, unit: UnitView, path: readonly Square[]): Square[] {
  if (unit.anchor === null) return []
  const entered = enteredSquares(unit.anchor, unit.size, path)
  return entered.filter((s) => knownMines(view).some((m) => sameSquare(m.square, s)))
}

/** A8-17 + R34: whether entering known mines needs the hazard prompt. */
export function hazardPromptNeeded(mines: readonly Square[], unit: UnitView, mineWarning: boolean): boolean {
  if (mines.length === 0) return false
  return mineWarning || (unit.isCommander && COMMANDER_MINE_CONFIRMATION)
}

// ---------------------------------------------------------------- terrain and vision

export function viewQuery(view: PlayerView): ViewQuery {
  return memo(view, 'query', () => new ViewQuery(view))
}

/** A step may enter this square (as far as the player knows): it exists, isn't terrain, holds no known enemy. */
export function stepOpen(view: PlayerView, unit: UnitView, anchor: Square): boolean {
  const q = viewQuery(view)
  return footprintSquares(anchor, unit.size).every((s) => {
    if (!q.squareExists(s) || q.isTerrain(s)) return false
    const occupant = unitAt(view, s)
    return occupant === undefined || occupant.owner === unit.owner
  })
}

export function fogged(view: PlayerView, square: Square): boolean {
  return !isVisibleSquare(view, square)
}
