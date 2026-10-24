// The Move action (2.5). checkPath judges a committed path on the mover's knowledge (A2-17, A4-14);
// walkPath resolves it step by step against the true state in the fixed per-step order:
// enter -> mines -> adjacency triggers (Assault, APNAP) -> other step hooks -> reveals and vision ->
// goal row -> interrupt check ("Blocked!" before entering a square that holds an enemy).

import { liveAbility } from './abilities/registry'
import type { StepInfo } from './abilities/types'
import { ADJACENCY, MOVE_EXACT_DISTANCE } from './constants'
import type { MoveEndReason } from './events'
import { adjacencyMetric, footprintRect, footprintSquares, goalRowY, isMovementStep, rectDistance, sameSquare } from './geometry'
import type { RulesQuery } from './query'
import { reject, type Rejection } from './rejection'
import type { Resolver } from './resolve'
import { SEATS, type Square, type UnitCore, type UnitState } from './types'

/**
 * A2-15 / A2-16: 1..Movement orthogonal steps over existing open squares, never through a known enemy.
 * `maxSteps` lowers the limit (a Charge moves at most Movement - 1, R26).
 */
export function checkPath(q: RulesQuery, unit: UnitCore, path: readonly Square[], maxSteps?: number): Rejection | null {
  if (unit.anchor === null) return reject('NOT_DEPLOYED', 'This unit is not on the board')
  const movement = Math.min(q.stats(unit).movement, maxSteps ?? Number.POSITIVE_INFINITY)
  if (movement < 1) return reject('CANNOT_MOVE', 'This unit cannot move')
  if (path.length === 0) return reject('INVALID_PATH', 'The path is empty')
  if (path.length > movement) return reject('PATH_TOO_LONG', `This unit moves at most ${movement} squares`)
  if (MOVE_EXACT_DISTANCE && path.length !== movement) return reject('INVALID_PATH', `This unit must move exactly ${movement} squares`)
  const size = q.sizeOf(unit)
  let previous = unit.anchor
  for (const step of path) {
    if (!isMovementStep(previous, step)) return reject('INVALID_PATH', 'Each step must be one orthogonal square')
    for (const s of footprintSquares(step, size)) {
      if (!q.squareExists(s) || q.isTerrain(s)) return reject('INVALID_PATH', 'The path crosses a blocked square')
      const occupant = q.unitAt(s)
      if (occupant !== undefined && occupant.owner !== unit.owner) return reject('INVALID_PATH', 'An enemy unit is in the way')
    }
    previous = step
  }
  const end = footprintSquares(previous, size)
  if (end.some((s) => (q.unitAt(s)?.id ?? unit.id) !== unit.id)) return reject('INVALID_PATH', 'The path must end on empty squares')
  return null
}

function enemyBlocks(r: Resolver, unit: UnitState, anchor: Square): boolean {
  return footprintSquares(anchor, r.sizeOf(unit)).some((s) => {
    const occupant = r.unitAt(s)
    return occupant !== undefined && occupant.owner !== unit.owner
  })
}

function overlapsOther(r: Resolver, unit: UnitState): boolean {
  const own = r.footprint(unit)
  return r.state.units.some((u) => u !== unit && r.footprint(u).some((f) => own.some((s) => sameSquare(s, f))))
}

/** Assault and other "enemy came adjacent" hooks: stationary enemies first, then the mover (ROG-6). */
function runAdjacencyHooks(r: Resolver, mover: UnitState, gained: readonly UnitState[], step: StepInfo): boolean {
  let interrupt = false
  for (const holder of [...gained].sort((a, b) => a.seq - b.seq)) {
    for (const id of r.abilitiesOf(holder)) {
      const hook = liveAbility(id)?.onAdjacencyGained
      if (hook === undefined || r.isOver() || !r.state.units.includes(holder) || !r.state.units.includes(mover)) continue
      if (hook(r, holder, { step, enemies: [mover], holderIsMover: false }) === 'interrupt') interrupt = true
    }
  }
  if (gained.length > 0) {
    for (const id of r.abilitiesOf(mover)) {
      const hook = liveAbility(id)?.onAdjacencyGained
      if (hook === undefined || r.isOver() || !r.state.units.includes(mover)) continue
      const alive = gained.filter((g) => r.state.units.includes(g))
      if (alive.length > 0 && hook(r, mover, { step, enemies: alive, holderIsMover: true }) === 'interrupt') interrupt = true
    }
  }
  return interrupt
}

function runStepHooks(r: Resolver, step: StepInfo): boolean {
  let interrupt = false
  for (const holder of r.holdersApnap()) {
    for (const id of r.abilitiesOf(holder)) {
      const hook = liveAbility(id)?.onUnitStep
      if (hook === undefined || r.isOver() || !r.state.units.includes(holder)) continue
      if (hook(r, holder, step) === 'interrupt') interrupt = true
    }
  }
  return interrupt
}

/** Resolves a validated path. The Move's AP and action are already spent and stay spent (A2-17). */
export function walkPath(r: Resolver, unit: UnitState, path: readonly Square[]): MoveEndReason {
  const visited: Square[] = unit.anchor === null ? [] : [unit.anchor]
  const metric = adjacencyMetric(ADJACENCY)
  const size = r.sizeOf(unit)
  let reason: MoveEndReason = 'completed'

  for (const [stepIndex, next] of path.entries()) {
    const from = unit.anchor
    if (from === null) break
    if (enemyBlocks(r, unit, next)) {
      reason = 'blocked'
      break
    }
    const previousRect = footprintRect(from, size)
    const previousSquares = footprintSquares(from, size)
    const sawBefore = opponentSees(r, unit)
    const enemiesBefore = r.state.units.filter(
      (u) => u.owner !== unit.owner && u.anchor !== null && rectDistance(previousRect, footprintRect(u.anchor, r.sizeOf(u)), metric) > 1,
    )

    // 1. Enter.
    visited.push(next)
    shift(r, unit, from, next, sawBefore)

    // 2. Mines on newly entered squares (A8-16, TMN-1).
    const entered = footprintSquares(next, size).filter((s) => !previousSquares.some((p) => sameSquare(p, s)))
    const mineWentOff = r.triggerMines(unit, entered)
    if (r.isOver() || !r.state.units.includes(unit)) return finish(r, unit, 'died')

    // 3. Assault and other adjacency triggers; then generic step hooks.
    const step: StepInfo = { mover: unit, from, to: next, stepIndex }
    const gained = enemiesBefore.filter((e) => r.state.units.includes(e) && r.distance(unit, e, metric) === 1)
    const assaulted = runAdjacencyHooks(r, unit, gained, step)
    const reacted = runStepHooks(r, step) || assaulted

    // 4-5. Reveals and vision (deaths have resolved as they happened).
    r.settle()
    if (r.isOver() || !r.state.units.includes(unit)) return finish(r, unit, r.state.units.includes(unit) ? 'reaction' : 'died')

    // 6. A6-03: a living commander standing on its goal row wins at once.
    const side = r.sideOf(unit.owner)
    if (unit.type === 'commander' && side !== null && r.footprint(unit).some((s) => s.y === goalRowY(side))) {
      r.endGame(unit.owner, 'domination')
      return 'completed'
    }

    // 7. Interrupts.
    if (mineWentOff) {
      reason = 'mine'
      break
    }
    if (reacted) {
      reason = 'reaction'
      break
    }
  }

  // 2.5 step 7: a stopped mover backs up over own units to the last square where it may end.
  while (overlapsOther(r, unit) && visited.length > 1) {
    const from = unit.anchor
    visited.pop()
    const back = visited[visited.length - 1]
    if (from === null || back === undefined) break
    shift(r, unit, from, back, opponentSees(r, unit))
  }
  r.settle()
  return finish(r, unit, reason)
}

/** Moves the footprint one step; the opponent sees the step if it saw the unit before or sees it after (4.8). */
function shift(r: Resolver, unit: UnitState, from: Square, to: Square, sawBefore: boolean): void {
  unit.anchor = to
  r.invalidate()
  r.emit({ type: 'unitMoved', unitId: unit.id, from, to }, sawBefore || opponentSees(r, unit) ? SEATS : [unit.owner])
}

function opponentSees(r: Resolver, unit: UnitState): boolean {
  return r.canSee(r.opponentOf(unit.owner), unit)
}

function finish(r: Resolver, unit: UnitState, reason: MoveEndReason): MoveEndReason {
  if (unit.anchor !== null && r.state.units.includes(unit)) r.emit({ type: 'moveEnded', unitId: unit.id, at: unit.anchor, reason }, r.seatsSeeing(unit))
  return reason
}
