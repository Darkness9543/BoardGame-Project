// Client-side helpers on a PlayerView (PX R1: the UI asks the engine for every range, path, preview and
// legality check). They only use the seat's knowledge, so they can't leak and never disagree with
// validateIntent.

import { liveAbility } from './abilities/registry'
import type { AbilityTarget, AttackTarget, HitContext } from './abilities/types'
import { checkAttackTarget } from './attack'
import { checkAbilityReady, checkTarget, validateIntent } from './commands'
import { abilityData, hasAbilityData } from './content/abilities'
import { computeHit, type PipelineResult } from './damage'
import { abilityCost, basicActionCost, checkAp, checkCanAct } from './economy'
import { existingSquares, footprintSquares, neighbourOffsets, sameSquare, squaresWithin } from './geometry'
import { CHARGE_ENABLED, CHARGE_MIN_MOVEMENT, CHARGE_SURCHARGE, MOVE_DIRECTIONS } from './constants'
import type { Square, UnitId } from './types'
import { ViewQuery, type PlayerView } from './view'

export interface ReachableSquare {
  /** Where the unit's anchor ends. */
  readonly anchor: Square
  /** The suggested path (anchor positions, start excluded). */
  readonly path: readonly Square[]
  /** Known mines (own or revealed enemy) the path enters; > 0 means the UI should ask first (A8-17). */
  readonly knownMines: number
}

/** Every square the unit may legally move to, with a path that avoids known mines when possible. */
export function reachableSquares(view: PlayerView, unitId: UnitId): ReachableSquare[] {
  const q = new ViewQuery(view)
  const unit = q.viewUnit(unitId)
  if (unit === undefined || unit.anchor === null || unit.owner !== view.seat) return []
  const steps = q.stats(unit).movement
  const best = new Map<string, ReachableSquare>()
  const offsets = neighbourOffsets(MOVE_DIRECTIONS)
  const explore = (from: Square, path: Square[], mines: number): void => {
    if (path.length > 0 && !sameSquare(from, start)) {
      const intent = { kind: 'move' as const, unitId, path: [...path] }
      if (validateIntent(view, intent).ok) {
        const key = `${from.x},${from.y}`
        const current = best.get(key)
        if (current === undefined || mines < current.knownMines || (mines === current.knownMines && path.length < current.path.length)) {
          best.set(key, { anchor: from, path: [...path], knownMines: mines })
        }
      }
    }
    if (path.length >= steps) return
    for (const o of offsets) {
      const next = { x: from.x + o.x, y: from.y + o.y }
      const entered = footprintSquares(next, unit.size).filter((s) => !footprintSquares(from, unit.size).some((p) => sameSquare(p, s)))
      const hits = entered.filter((s) => q.mineAt(s) !== undefined).length
      explore(next, [...path, next], mines + hits)
    }
  }
  const start = unit.anchor
  explore(start, [], 0)
  return [...best.values()]
}

export function bestPath(view: PlayerView, unitId: UnitId, to: Square): readonly Square[] | null {
  return reachableSquares(view, unitId).find((r) => sameSquare(r.anchor, to))?.path ?? null
}

/** Units and squares a basic attack by this unit may target now (squares only for range >= 2). */
export function attackTargets(view: PlayerView, unitId: UnitId): AttackTarget[] {
  const q = new ViewQuery(view)
  const unit = q.viewUnit(unitId)
  if (unit === undefined || unit.anchor === null) return []
  const out: AttackTarget[] = []
  for (const other of q.units()) {
    const target: AttackTarget = { kind: 'unit', unitId: other.id }
    if (checkAttackTarget(q, unit, target) === null) out.push(target)
  }
  for (const square of squaresWithin(unit.anchor, unit.size, q.stats(unit).attackRange)) {
    if (q.unitAt(square) !== undefined) continue
    const target: AttackTarget = { kind: 'square', square }
    if (checkAttackTarget(q, unit, target) === null) out.push(target)
  }
  return out
}

export type ActionKind = 'move' | 'attack' | 'defend' | 'charge' | 'ability'

/** R26: every legal (path, target) pair for a Charge by this unit. */
export function chargeTargets(view: PlayerView, unitId: UnitId): { readonly path: readonly Square[]; readonly target: AttackTarget }[] {
  const q = new ViewQuery(view)
  const unit = q.viewUnit(unitId)
  if (unit === undefined || unit.anchor === null || !CHARGE_ENABLED) return []
  const out: { path: readonly Square[]; target: AttackTarget }[] = []
  for (const reach of reachableSquares(view, unitId)) {
    if (reach.path.length > unit.movement - 1) continue
    for (const other of q.units()) {
      const target: AttackTarget = { kind: 'unit', unitId: other.id }
      if (validateIntent(view, { kind: 'charge', unitId, path: reach.path, target }).ok) out.push({ path: reach.path, target })
    }
  }
  return out
}

export interface ActionOption {
  readonly kind: ActionKind
  readonly abilityId: string | null
  /** Effective AP cost if declared now. */
  readonly cost: number
  readonly enabled: boolean
  /** Why it's disabled (a reason the player can see), or null. */
  readonly reason: string | null
}

function option(kind: ActionKind, abilityId: string | null, cost: number, blocked: string | null): ActionOption {
  return { kind, abilityId, cost, enabled: blocked === null, reason: blocked }
}

/**
 * The action bar for one unit, with costs and the reason (visible to the player) why an action is disabled.
 * A two-pick ability is enabled only when some first pick leaves a legal second one (Shared wounds needs a donor and
 * another recipient); the full legality of a chosen combination is validateIntent's job once the picks are made.
 */
export function legalActions(view: PlayerView, unitId: UnitId): ActionOption[] {
  const q = new ViewQuery(view)
  const unit = q.viewUnit(unitId)
  if (unit === undefined || unit.owner !== view.seat || unit.anchor === null) return []
  const gate = validateIntent(view, { kind: 'endTurn' }) // not my turn, game over, a pending decision or take-back
  const gated = gate.ok ? null : gate.message
  const cost = basicActionCost(q, unit)
  const ap = (): string | null => checkAp(q, view.seat, cost)?.message ?? null

  const moveBlocked =
    gated ??
    checkCanAct(q, unit, 'move')?.message ??
    (q.stats(unit).movement < 1 ? 'This unit cannot move' : null) ??
    ap() ??
    (reachableSquares(view, unitId).length === 0 ? 'No square to move to' : null)
  const attackBlocked =
    gated ??
    checkCanAct(q, unit, 'other')?.message ??
    (q.stats(unit).power < 1 ? 'A unit with 0 Power cannot attack' : null) ??
    ap() ??
    (attackTargets(view, unitId).length === 0 ? 'No target in range' : null)
  const defendBlocked = gated ?? checkCanAct(q, unit, 'other')?.message ?? ap()
  const chargeCost = cost + CHARGE_SURCHARGE
  const chargeBlocked =
    gated ??
    (!CHARGE_ENABLED ? 'Charge is switched off' : null) ??
    (q.stats(unit).movement < CHARGE_MIN_MOVEMENT ? `Charging needs Movement ${CHARGE_MIN_MOVEMENT} or more` : null) ??
    checkCanAct(q, unit, 'move')?.message ??
    checkAp(q, view.seat, chargeCost)?.message ??
    (chargeTargets(view, unitId).length === 0 ? 'No target to charge' : null)
  const options = [
    option('move', null, cost, moveBlocked),
    option('attack', null, cost, attackBlocked),
    option('defend', null, cost, defendBlocked),
    option('charge', null, chargeCost, chargeBlocked),
  ]

  for (const abilityId of q.abilitiesOf(unit)) {
    if (!hasAbilityData(abilityId) || abilityData(abilityId).kind !== 'active') continue
    const blocked = gated ?? checkAbilityReady(q, view.seat, unit, abilityId)?.message ?? targetsBlocked(view, unitId, abilityId)
    options.push(option('ability', abilityId, abilityCost(q, unit, abilityData(abilityId)), blocked))
  }
  return options
}

function targetsBlocked(view: PlayerView, unitId: UnitId, abilityId: string): string | null {
  const specs = liveAbility(abilityId)?.active?.targets ?? []
  if (specs.length === 0) {
    const verdict = validateIntent(view, { kind: 'useAbility', unitId, abilityId, targets: [] })
    return verdict.ok ? null : verdict.message
  }
  if (specs.length === 2) {
    const pairs = targetOptions(view, unitId, abilityId, 0, []).some((first) => targetOptions(view, unitId, abilityId, 1, [first]).length > 0)
    return pairs ? null : 'No valid target'
  }
  return specs.every((_, index) => targetOptions(view, unitId, abilityId, index, []).length > 0) ? null : 'No valid target'
}

/**
 * Candidates for pick `index` of an ability that satisfy its declarative spec. When `picked` holds every earlier pick
 * and this is the last one, the candidates also pass the whole check (`validateIntent`, the ability's own `validate`
 * included), so a UI highlights only targets the authority will accept. Earlier picks can't be judged that way.
 */
export function targetOptions(
  view: PlayerView,
  unitId: UnitId,
  abilityId: string,
  index: number,
  picked: readonly AbilityTarget[],
): AbilityTarget[] {
  const candidates = specCandidates(view, unitId, abilityId, index)
  const specs = liveAbility(abilityId)?.active?.targets ?? []
  const complete = index === specs.length - 1 && picked.length === index && specs[index]?.kind !== 'connectedSquares'
  if (!complete) return candidates
  return candidates.filter((c) => validateIntent(view, { kind: 'useAbility', unitId, abilityId, targets: [...picked, c] }).ok)
}

function specCandidates(view: PlayerView, unitId: UnitId, abilityId: string, index: number): AbilityTarget[] {
  const q = new ViewQuery(view)
  const unit = q.viewUnit(unitId)
  const spec = liveAbility(abilityId)?.active?.targets[index]
  if (unit === undefined || unit.anchor === null || spec === undefined) return []
  const candidates: AbilityTarget[] = []
  switch (spec.kind) {
    case 'unit':
      for (const other of q.units()) candidates.push({ kind: 'unit', unitId: other.id })
      break
    case 'square':
      for (const square of squaresWithin(unit.anchor, unit.size, spec.range, spec.metric)) candidates.push({ kind: 'square', square })
      break
    case 'area3x3':
      for (const square of squaresWithin(unit.anchor, unit.size, spec.centreRange)) candidates.push({ kind: 'square', square })
      break
    case 'connectedSquares':
      // Free-form shapes: the UI collects the squares one by one; offer every square inside LOV.
      return existingSquares()
        .filter((s) => q.inLov(unit, s))
        .map((s) => ({ kind: 'squares', squares: [s] }))
    case 'attack':
      return attackTargets(view, unitId)
  }
  return candidates.filter((c) => checkTarget(q, unit, spec, c) === null)
}

/** Damage preview of a basic attack on a visible unit, from the viewer's knowledge (PX forecast). */
export function previewAttack(view: PlayerView, attackerId: UnitId, targetId: UnitId): PipelineResult | null {
  const q = new ViewQuery(view)
  const attacker = q.viewUnit(attackerId)
  const target = q.viewUnit(targetId)
  if (attacker === undefined || target === undefined) return null
  const hit: HitContext = { target, kind: 'attack', base: q.stats(attacker).power, source: 'attack', dealer: attacker }
  return computeHit(q, hit)
}
