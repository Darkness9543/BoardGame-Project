// Intents (commands) and their two entry points:
// - validate(state, seat, intent) / validateIntent(view, intent): legality judged ONLY from what the seat
//   can see (4.7). A move into an unseen enemy is legal and gets interrupted when walked ("bump").
// - Units act in any order and one unit's actions need not be consecutive (A2-14).
// - apply(state, seat, intent): validates, then resolves against the true state on a private clone and
//   returns { state, events }. The input state is never mutated.

import { liveAbility } from './abilities/registry'
import type { AbilityTarget, AttackTarget, TargetSpec } from './abilities/types'
import { checkArmy } from './army'
import { checkAttackTarget } from './attack'
import {
  CHARGE_ENABLED,
  CHARGE_MIN_MOVEMENT,
  CHARGE_SURCHARGE,
  FORCEFIELD_SHAPE,
  FRIENDLY_SINGLE_TARGET,
  GROUP_MARCH_ENABLED,
  GROUP_MARCH_MAX,
  groupMarchCost,
  MARCH_ANY_TYPE_ABILITY,
  MARCH_SAME_TYPE,
  type PreferenceValue,
} from './constants'
import { abilityData, hasAbilityData } from './content/abilities'
import { SCENARIOS } from './content/scenarios'
import { answerDecision, processDecisions } from './decisions'
import { checkPlacement } from './deployment'
import { disclose, NO_DISCLOSURE, seenBy, UNSEEN } from './disclosure'
import { abilityCost, basicActionCost, checkAp, checkCanAct, cooldownBlocks } from './economy'
import type { GameEvent } from './events'
import { footprintSquares, isOrthogonallyConnected, isSquare2x2 } from './geometry'
import { checkPath, walkPath } from './movement'
import type { RulesQuery } from './query'
import { OK, reject, type Rejection, type Validation } from './rejection'
import { Resolver } from './resolve'
import { confirmDeployment, deploy, setArmy, setReady, startDeployment, updateSettings } from './setup'
import { cloneState, opponentOf } from './state'
import { endTurn, runTurnTransition } from './turn'
import { SEATS, type ArmyList, type GameState, type MatchSettings, type Seat, type Square, type UnitCore, type UnitId, type UnitState } from './types'
import { projectView, ViewQuery, type PlayerView } from './view'

/** Battle actions: each one can be taken back with its consequences (9 TB-2, A9-01). */
export type ActionIntent =
  | { readonly kind: 'move'; readonly unitId: UnitId; readonly path: readonly Square[] }
  | { readonly kind: 'attack'; readonly unitId: UnitId; readonly target: AttackTarget }
  | { readonly kind: 'defend'; readonly unitId: UnitId }
  | { readonly kind: 'useAbility'; readonly unitId: UnitId; readonly abilityId: string; readonly targets: readonly AbilityTarget[] }
  /** R26: move up to Movement - 1 squares, then a basic attack from the end square; one action at AP + 1. */
  | { readonly kind: 'charge'; readonly unitId: UnitId; readonly path: readonly Square[]; readonly target: AttackTarget }
  /** R27: up to 6 connected own units that haven't acted each step 1 square the same way; 2 AP in total. */
  | { readonly kind: 'groupMarch'; readonly unitIds: readonly UnitId[]; readonly direction: MarchDirection }
  | { readonly kind: 'endTurn' }

/** Absolute board directions: north = towards row 25. */
export type MarchDirection = 'north' | 'east' | 'south' | 'west'

export const MARCH_OFFSETS: Readonly<Record<MarchDirection, Square>> = {
  north: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: -1 },
  west: { x: -1, y: 0 },
}

export type Intent =
  // lobby (either seat; settings and startDeployment: host only)
  | { readonly kind: 'setArmy'; readonly army: ArmyList }
  | { readonly kind: 'setReady'; readonly ready: boolean }
  | { readonly kind: 'updateSettings'; readonly settings: Partial<MatchSettings> }
  /** Sent by the host session after the commit-reveal coin flip (rng.combineSecrets). */
  | { readonly kind: 'startDeployment'; readonly coinSeed: string }
  // deployment
  | { readonly kind: 'deploy'; readonly unitId: UnitId; readonly anchor: Square }
  | { readonly kind: 'undeploy'; readonly unitId: UnitId }
  | { readonly kind: 'confirmDeployment'; readonly confirmed: boolean }
  // battle
  | ActionIntent
  /** The answer to a pending decision such as Queso's revive (2.11). */
  | { readonly kind: 'respondDecision'; readonly decisionId: string; readonly choice: string }
  | { readonly kind: 'requestTakeback' }
  | { readonly kind: 'acceptTakeback' }
  | { readonly kind: 'declineTakeback' }
  | { readonly kind: 'resign' }
  | { readonly kind: 'offerDraw' }
  | { readonly kind: 'acceptDraw' }
  | { readonly kind: 'declineDraw' }
  | { readonly kind: 'setPreference'; readonly key: string; readonly value: PreferenceValue }

export type IntentKind = Intent['kind']

export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | Rejection

export interface ApplyOptions {
  /** The state just before the action with this seq (history.ts supplies it; take-back needs it). */
  readonly stateBeforeAction?: (actionSeq: number) => GameState | undefined
}

const ACTION_KINDS: readonly IntentKind[] = ['move', 'attack', 'defend', 'useAbility', 'charge', 'groupMarch', 'endTurn']
const PREFERENCE_KEYS: readonly string[] = ['revive']
const PREFERENCE_VALUES: readonly PreferenceValue[] = ['ask', 'always', 'never']

export function isActionIntent(intent: Intent): intent is ActionIntent {
  return ACTION_KINDS.includes(intent.kind)
}

// ---------------------------------------------------------------- validation on knowledge

function ownPlacedUnit(view: PlayerView, unitId: UnitId): UnitCore | Rejection {
  const unit = view.units.find((u) => u.id === unitId)
  if (unit === undefined) return reject('UNKNOWN_UNIT', 'Unknown unit')
  if (unit.owner !== view.seat) return reject('NOT_YOUR_UNIT', 'Not your unit')
  if (unit.anchor === null) return reject('NOT_DEPLOYED', 'This unit is not on the board')
  return unit
}

function isRejection(x: unknown): x is Rejection {
  return typeof x === 'object' && x !== null && 'ok' in x && (x as { ok: unknown }).ok === false
}

function checkSettings(patch: Partial<MatchSettings>): Rejection | null {
  if (patch.budget !== undefined && (!Number.isInteger(patch.budget) || patch.budget < 1)) return reject('INVALID_SETTINGS', 'Bad budget')
  if (patch.scenarioId !== undefined && !SCENARIOS.some((s) => s.id === patch.scenarioId)) return reject('INVALID_SETTINGS', 'Unknown scenario')
  if (patch.takebacksPerGame !== undefined && patch.takebacksPerGame !== null && (!Number.isInteger(patch.takebacksPerGame) || patch.takebacksPerGame < 0)) {
    return reject('INVALID_SETTINGS', 'Bad take-back limit')
  }
  if (patch.turnTimerSeconds !== undefined && patch.turnTimerSeconds !== null && !(patch.turnTimerSeconds > 0)) {
    return reject('INVALID_SETTINGS', 'Bad turn timer')
  }
  return null
}

/** One pick against its declarative spec (abilities/types.ts TargetSpec). */
export function checkTarget(q: RulesQuery, unit: UnitCore, spec: TargetSpec, target: AbilityTarget): Rejection | null {
  switch (spec.kind) {
    case 'unit': {
      if (target.kind !== 'unit') return reject('INVALID_TARGET', `${spec.label}: choose a unit`)
      const picked = q.unit(target.unitId)
      if (picked === undefined || picked.anchor === null) return reject('INVALID_TARGET', `${spec.label}: no such unit`)
      if (picked.id === unit.id && !spec.includeSelf) return reject('INVALID_TARGET', `${spec.label}: not this unit`)
      if (spec.relation === 'own' && picked.owner !== unit.owner) return reject('INVALID_TARGET', `${spec.label}: choose one of your units`)
      const enemyOnly = spec.relation === 'enemy' || (spec.relation === 'harmful' && !FRIENDLY_SINGLE_TARGET) // R14
      if (enemyOnly && picked.owner === unit.owner) return reject('INVALID_TARGET', `${spec.label}: choose an enemy unit`)
      if (q.isCommander(picked) && !spec.allowCommander) return reject('INVALID_TARGET', `${spec.label}: not a commander`)
      if (q.distance(unit, picked, spec.metric) > spec.range) return reject('OUT_OF_RANGE', `${spec.label}: out of range`)
      return null
    }
    case 'square': {
      if (target.kind !== 'square') return reject('INVALID_TARGET', `${spec.label}: choose a square`)
      const s = target.square
      if (!q.squareExists(s)) return reject('INVALID_TARGET', `${spec.label}: no such square`)
      if (q.isTerrain(s)) return reject('SQUARE_UNAVAILABLE', `${spec.label}: blockers and buildings can't be targeted`) // A1-11, A1-13
      const d = q.distance(unit, s, spec.metric)
      if (d < spec.minRange || d > spec.range) return reject('OUT_OF_RANGE', `${spec.label}: out of range`)
      if (spec.free && (q.unitAt(s) !== undefined || q.mineAt(s)?.owner === unit.owner)) {
        return reject('SQUARE_UNAVAILABLE', `${spec.label}: the square is not free`) // A8-13
      }
      return null
    }
    case 'area3x3': {
      if (target.kind !== 'square') return reject('INVALID_TARGET', `${spec.label}: choose a centre square`)
      if (!q.squareExists(target.square)) return reject('INVALID_TARGET', `${spec.label}: no such square`)
      if (q.isTerrain(target.square)) return reject('SQUARE_UNAVAILABLE', `${spec.label}: blockers and buildings can't be targeted`) // A1-11, A1-13
      if (q.distance(unit, target.square) > spec.centreRange) return reject('OUT_OF_RANGE', `${spec.label}: out of range`)
      return null
    }
    case 'connectedSquares': {
      if (target.kind !== 'squares') return reject('INVALID_TARGET', `${spec.label}: choose ${spec.count} squares`)
      const squares = target.squares
      if (squares.length !== spec.count) return reject('INVALID_TARGET', `${spec.label}: choose ${spec.count} squares`)
      if (squares.some((s) => !q.squareExists(s) || !q.inLov(unit, s))) return reject('OUT_OF_RANGE', `${spec.label}: squares must be in LOV`)
      const shapeOk = FORCEFIELD_SHAPE === 'connected' ? isOrthogonallyConnected(squares) : isSquare2x2(squares)
      return shapeOk ? null : reject('INVALID_TARGET', `${spec.label}: the squares must be connected`) // A8-18
    }
    case 'attack':
      if (target.kind === 'squares') return reject('INVALID_TARGET', `${spec.label}: choose a unit or a square`)
      return checkAttackTarget(q, unit, target)
  }
}

/** Everything about using an ability except its targets: kind, implementation, cooldown, uses, allowance, AP. */
export function checkAbilityReady(q: RulesQuery, seat: Seat, unit: UnitCore, abilityId: string): Rejection | null {
  if (!q.hasAbility(unit, abilityId) || !hasAbilityData(abilityId)) return reject('UNKNOWN_ABILITY', 'This unit has no such ability')
  const data = abilityData(abilityId)
  if (data.kind !== 'active') return reject('NOT_ACTIVE_ABILITY', `${data.name} is not used by choice`)
  if (liveAbility(abilityId)?.active === undefined) return reject('NOT_IMPLEMENTED', `${data.name} is not implemented yet`)
  if (cooldownBlocks(q, unit, data, seat)) return reject('ON_COOLDOWN', `${data.name} is on cooldown`)
  const uses = q.unitTurn(unit)?.abilityUses[abilityId] ?? 0
  if (data.usesPerTurn !== null && uses >= data.usesPerTurn) return reject('LIMIT_REACHED', `${data.name} can't be used again this turn`)
  if (data.usesAction) {
    const blocked = checkCanAct(q, unit, 'other')
    if (blocked !== null) return blocked
  }
  const unmet = liveAbility(abilityId)?.active?.requirement?.(q, unit) ?? null
  if (unmet !== null) return reject('REQUIREMENT_NOT_MET', unmet)
  return checkAp(q, seat, abilityCost(q, unit, data))
}

function checkAbility(q: RulesQuery, view: PlayerView, unit: UnitCore, abilityId: string, targets: readonly AbilityTarget[]): Validation {
  const notReady = checkAbilityReady(q, view.seat, unit, abilityId)
  if (notReady !== null) return notReady
  const active = liveAbility(abilityId)?.active
  if (active === undefined) return reject('NOT_IMPLEMENTED', 'Not implemented yet')
  if (targets.length !== active.targets.length) return reject('INVALID_TARGET', `Expected ${active.targets.length} target(s)`)
  for (const [i, spec] of active.targets.entries()) {
    const target = targets[i]
    if (target === undefined) return reject('INVALID_TARGET', 'Missing target')
    const bad = checkTarget(q, unit, spec, target)
    if (bad !== null) return bad
  }
  const reason = active.validate?.(q, unit, targets) ?? null
  return reason === null ? OK : reject('REQUIREMENT_NOT_MET', reason)
}

/** Legality of an intent from a seat's own view. Clients call this for buttons and previews. */
export function validateIntent(view: PlayerView, intent: Intent): Validation {
  const me = view.seat
  if (view.phase === 'ended') return reject('GAME_OVER', 'The game is over')
  const q = new ViewQuery(view)
  const phaseIs = (phase: PlayerView['phase']): Rejection | null => (view.phase === phase ? null : reject('WRONG_PHASE', `Not during ${view.phase}`))

  switch (intent.kind) {
    case 'setArmy': {
      const wrong = phaseIs('lobby')
      if (wrong !== null) return wrong
      const check = checkArmy(intent.army, view.settings)
      return check.ok ? OK : reject('INVALID_ARMY', check.errors[0] ?? 'Invalid army')
    }
    case 'setReady': {
      const wrong = phaseIs('lobby')
      if (wrong !== null) return wrong
      if (!intent.ready) return OK
      if (view.myArmy === null) return reject('NOT_READY', 'Choose an army first')
      const check = checkArmy(view.myArmy, view.settings)
      return check.ok ? OK : reject('INVALID_ARMY', check.errors[0] ?? 'Invalid army')
    }
    case 'updateSettings':
      return phaseIs('lobby') ?? (me !== 'host' ? reject('NOT_HOST', 'Only the host changes settings') : (checkSettings(intent.settings) ?? OK))
    case 'startDeployment': {
      const wrong = phaseIs('lobby')
      if (wrong !== null) return wrong
      if (me !== 'host') return reject('NOT_HOST', 'Only the host starts the match')
      if (!SEATS.every((s) => view.lobby.ready[s])) return reject('NOT_READY', 'Both players must be ready')
      return intent.coinSeed.length > 0 ? OK : reject('INVALID_SETTINGS', 'Missing coin seed')
    }
    case 'deploy': {
      const wrong = phaseIs('deployment')
      if (wrong !== null) return wrong
      const unit = view.units.find((u) => u.id === intent.unitId && u.owner === me)
      if (unit === undefined) return reject('UNKNOWN_UNIT', 'Unknown unit')
      if (view.side === null) return reject('WRONG_PHASE', 'Sides are not decided yet')
      return checkPlacement(q, view.side, unit, intent.anchor) ?? OK
    }
    case 'undeploy': {
      const wrong = phaseIs('deployment')
      if (wrong !== null) return wrong
      const unit = view.units.find((u) => u.id === intent.unitId && u.owner === me)
      if (unit === undefined) return reject('UNKNOWN_UNIT', 'Unknown unit')
      return unit.anchor === null ? reject('NOT_DEPLOYED', 'This unit is not placed') : OK
    }
    case 'confirmDeployment': {
      const wrong = phaseIs('deployment')
      if (wrong !== null) return wrong
      if (intent.confirmed && view.units.some((u) => u.owner === me && u.anchor === null)) {
        return reject('NOT_ALL_DEPLOYED', 'Every unit must be deployed first') // A5-07
      }
      return OK
    }
    case 'setPreference':
      if (!PREFERENCE_KEYS.includes(intent.key)) return reject('UNKNOWN_PREFERENCE', 'Unknown preference')
      return PREFERENCE_VALUES.includes(intent.value) ? OK : reject('UNKNOWN_PREFERENCE', 'Unknown preference value')
    case 'resign':
      return view.phase === 'deployment' || view.phase === 'battle' ? OK : reject('WRONG_PHASE', 'Nothing to resign yet')
    default:
      break
  }

  // Battle intents.
  const notBattle = phaseIs('battle')
  if (notBattle !== null) return notBattle
  if (intent.kind === 'respondDecision') {
    if (view.decision === null || view.decision.id !== intent.decisionId) return reject('NO_DECISION', 'No such decision')
    return view.decision.options.some((o) => o.id === intent.choice) ? OK : reject('INVALID_CHOICE', 'Not one of the options')
  }
  if (view.decision !== null || view.opponentDeciding) return reject('DECISION_PENDING', 'Waiting for a decision')
  const request = view.takeback.request
  if (intent.kind === 'acceptTakeback' || intent.kind === 'declineTakeback') {
    if (request === null) return reject('NO_TAKEBACK_REQUEST', 'No take-back request')
    return request.requester === me ? reject('NO_TAKEBACK_REQUEST', 'The opponent decides') : OK
  }
  if (request !== null) return reject('TAKEBACK_PENDING', 'A take-back request is pending')

  switch (intent.kind) {
    case 'requestTakeback':
      return view.takeback.canRequest ? OK : reject('TAKEBACK_UNAVAILABLE', 'Nothing you can take back')
    case 'offerDraw':
      return view.drawOffer === null ? OK : reject('DRAW_ALREADY_OFFERED', 'A draw offer is open')
    case 'acceptDraw':
    case 'declineDraw':
      return view.drawOffer === opponentOf(me) ? OK : reject('NO_DRAW_OFFER', 'No draw offer')
    default:
      break
  }

  if (view.turn?.activeSeat !== me) return reject('NOT_YOUR_TURN', 'Not your turn')
  switch (intent.kind) {
    case 'endTurn':
      return OK
    case 'move': {
      const unit = ownPlacedUnit(view, intent.unitId)
      if (isRejection(unit)) return unit
      return checkCanAct(q, unit, 'move') ?? checkPath(q, unit, intent.path) ?? checkAp(q, me, basicActionCost(q, unit)) ?? OK
    }
    case 'attack': {
      const unit = ownPlacedUnit(view, intent.unitId)
      if (isRejection(unit)) return unit
      return checkCanAct(q, unit, 'other') ?? checkAttackTarget(q, unit, intent.target) ?? checkAp(q, me, basicActionCost(q, unit)) ?? OK
    }
    case 'defend': {
      const unit = ownPlacedUnit(view, intent.unitId)
      if (isRejection(unit)) return unit
      return checkCanAct(q, unit, 'other') ?? checkAp(q, me, basicActionCost(q, unit)) ?? OK
    }
    case 'useAbility': {
      const unit = ownPlacedUnit(view, intent.unitId)
      if (isRejection(unit)) return unit
      return checkAbility(q, view, unit, intent.abilityId, intent.targets)
    }
    case 'charge': {
      const unit = ownPlacedUnit(view, intent.unitId)
      if (isRejection(unit)) return unit
      return checkCharge(q, me, unit, intent.path, intent.target) ?? OK
    }
    case 'groupMarch':
      return checkGroupMarch(q, view, intent.unitIds, intent.direction) ?? OK
    default:
      return reject('WRONG_PHASE', 'Not available now')
  }
}

/** R26 Charge: Movement >= 2, a legal path of up to Movement - 1 steps, then a legal attack from its end. */
function checkCharge(q: RulesQuery, seat: Seat, unit: UnitCore, path: readonly Square[], target: AttackTarget): Rejection | null {
  if (!CHARGE_ENABLED) return reject('NOT_AVAILABLE', 'Charge is switched off')
  const stats = q.stats(unit)
  if (stats.movement < CHARGE_MIN_MOVEMENT) return reject('CANNOT_MOVE', `Charging needs Movement ${CHARGE_MIN_MOVEMENT} or more`)
  if (stats.power < 1) return reject('NO_POWER', 'A unit with 0 Power cannot attack')
  const end = path[path.length - 1]
  return (
    checkCanAct(q, unit, 'move') ??
    checkPath(q, unit, path, stats.movement - 1) ??
    (end === undefined ? reject('INVALID_PATH', 'The path is empty') : checkAttackTarget(q, unit, target, end)) ??
    checkAp(q, seat, basicActionCost(q, unit) + CHARGE_SURCHARGE)
  )
}

/** R27 Group march: 1..6 own units, one orthogonally connected group, none acted yet, each step legal. */
function checkGroupMarch(q: RulesQuery, view: PlayerView, unitIds: readonly UnitId[], direction: MarchDirection): Rejection | null {
  if (!GROUP_MARCH_ENABLED) return reject('NOT_AVAILABLE', 'Group march is switched off')
  if (unitIds.length === 0 || unitIds.length > GROUP_MARCH_MAX) return reject('INVALID_TARGET', `Choose 1 to ${GROUP_MARCH_MAX} units`)
  if (new Set(unitIds).size !== unitIds.length) return reject('INVALID_TARGET', 'Each unit marches once')
  const units: UnitCore[] = []
  for (const id of unitIds) {
    const unit = ownPlacedUnit(view, id)
    if (isRejection(unit)) return unit
    if ((q.unitTurn(unit)?.actionsUsed ?? 0) > 0) return reject('NO_ACTIONS_LEFT', 'Marching units must not have acted this turn')
    if (q.stats(unit).movement < 1) return reject('CANNOT_MOVE', 'A unit that cannot move cannot march')
    units.push(unit)
  }
  const reached = new Set<string>([units[0]?.id ?? ''])
  for (let grew = true; grew; ) {
    grew = false
    for (const u of units) {
      if (!reached.has(u.id) && units.some((o) => reached.has(o.id) && q.isAdjacent(u, o))) {
        reached.add(u.id)
        grew = true
      }
    }
  }
  if (reached.size !== units.length) return reject('INVALID_TARGET', 'Marching units must form one connected group')
  // R46: one unit type per group; a holder of the Soldier's Lockstep passive may join any group.
  if (MARCH_SAME_TYPE) {
    const strict = new Set(units.filter((u) => !q.hasAbility(u, MARCH_ANY_TYPE_ABILITY)).map((u) => u.type))
    if (strict.size > 1) return reject('INVALID_TARGET', 'Units march only with units of their own type; Soldiers can join any group')
  }
  const marching = new Set(unitIds)
  const offset = MARCH_OFFSETS[direction]
  for (const unit of units) {
    const anchor = unit.anchor
    if (anchor === null) return reject('NOT_DEPLOYED', 'This unit is not on the board')
    for (const s of footprintSquares({ x: anchor.x + offset.x, y: anchor.y + offset.y }, q.sizeOf(unit))) {
      if (!q.squareExists(s) || q.isTerrain(s)) return reject('INVALID_PATH', 'A marching unit would enter a blocked square')
      const occupant = q.unitAt(s)
      if (occupant !== undefined && occupant.id !== unit.id && !marching.has(occupant.id)) {
        return reject('INVALID_PATH', occupant.owner === unit.owner ? 'A marching unit would end on another unit' : 'An enemy unit is in the way')
      }
    }
  }
  return checkAp(q, view.seat, groupMarchCost(unitIds.length))
}

/** What a seat may still send while a reaction prompt is pending. */
const DURING_DECISIONS: readonly IntentKind[] = ['respondDecision', 'resign', 'setPreference']

/**
 * The authority's check. The seat's own view judges first, so no refusal depends on something it can't see; then a
 * decision it may not know about pauses a legal intent without saying why beyond "wait" (2.11: the session queues it
 * rather than showing the rejection, so even a probe can't tell a hidden prompt from an animation pause).
 */
export function validate(state: GameState, seat: Seat, intent: Intent, options: ApplyOptions = {}): Validation {
  const verdict = validateIntent(projectView(state, seat), intent)
  if (!verdict.ok) return verdict
  if (state.phase === 'battle' && state.decisions.length > 0 && !DURING_DECISIONS.includes(intent.kind)) {
    return reject('DECISION_PENDING', 'Waiting for a decision')
  }
  if (intent.kind === 'acceptTakeback') {
    const request = state.takeback.request
    if (request === null || options.stateBeforeAction?.(request.actionSeq) === undefined) {
      return reject('TAKEBACK_UNAVAILABLE', 'This action can no longer be taken back')
    }
  }
  return OK
}

// ---------------------------------------------------------------- resolution on the truth

function resolveAction(r: Resolver, seat: Seat, intent: ActionIntent): void {
  const state = r.state
  state.actionCount += 1
  state.lastAction = { seq: state.actionCount, seat, intent, seenByOther: UNSEEN, disclosure: NO_DISCLOSURE } // completed by recordForTakeback
  if (intent.kind === 'endTurn') {
    endTurn(r)
    return
  }
  if (intent.kind === 'groupMarch') {
    resolveGroupMarch(r, seat, intent.unitIds, intent.direction)
    processDecisions(r)
    return
  }
  const unit = r.stateUnit(intent.unitId)
  if (unit === undefined) return
  switch (intent.kind) {
    case 'move':
      r.beginAction(unit, 'move', basicActionCost(r, unit))
      walkPath(r, unit, intent.path)
      break
    case 'charge': {
      // R26: one action that counts as the Move; an interrupted charge spends its AP but never attacks.
      r.beginAction(unit, 'move', basicActionCost(r, unit) + CHARGE_SURCHARGE)
      const ended = walkPath(r, unit, intent.path)
      if (ended === 'completed' && r.state.units.includes(unit) && !r.isOver()) {
        r.attack(unit, intent.target, { source: 'charge', triggered: false })
        if (r.state.units.includes(unit)) unit.turn.basicAttack = true // counts as an Attack for Savagery
      }
      break
    }
    case 'attack':
      r.beginAction(unit, 'attack', basicActionCost(r, unit))
      r.attack(unit, intent.target, { source: 'attack', triggered: false })
      if (r.state.units.includes(unit)) unit.turn.basicAttack = true // enables Savagery (A8-05)
      break
    case 'defend':
      r.beginAction(unit, 'defend', basicActionCost(r, unit))
      unit.defending = true // A2-21: until the start of the controller's next turn
      r.emit({ type: 'defendChanged', unitId: unit.id, defending: true, reason: 'action' }, r.seatsSeeing(unit))
      break
    case 'useAbility': {
      const data = abilityData(intent.abilityId)
      const active = liveAbility(intent.abilityId)?.active
      if (active === undefined) return
      const cost = abilityCost(r, unit, data)
      if (data.usesAction) r.beginAction(unit, 'ability', cost)
      else r.spendAp(seat, cost)
      const ownTurn = r.ownTurn(seat)
      const previous = unit.cooldowns[data.id]
      if (data.cooldown > 0 && !(data.sameTurnReuse && previous?.usedOnOwnTurn === ownTurn)) {
        unit.cooldowns[data.id] = { usedOnOwnTurn: ownTurn, readyOnOwnTurn: ownTurn + data.cooldown + 1 } // A2-22
      }
      unit.turn.abilityUses[data.id] = (unit.turn.abilityUses[data.id] ?? 0) + 1
      r.emit({ type: 'abilityUsed', unitId: unit.id, abilityId: data.id, targets: intent.targets }, [seat])
      const other = opponentOf(seat)
      if (active.secret !== true && r.canSee(other, unit)) r.emit({ type: 'abilityUsed', unitId: unit.id, abilityId: data.id, targets: [] }, [other])
      r.withAbilityScope(() => active.resolve(r, unit, intent.targets))
      break
    }
  }
  processDecisions(r)
}

/** R27: one payment; marchers step front-to-back, each through the normal per-step rules (interruptions stop only it). */
function resolveGroupMarch(r: Resolver, seat: Seat, unitIds: readonly UnitId[], direction: MarchDirection): void {
  r.spendAp(seat, groupMarchCost(unitIds.length))
  const offset = MARCH_OFFSETS[direction]
  const lead = (u: UnitState): number => (u.anchor === null ? 0 : u.anchor.x * offset.x + u.anchor.y * offset.y)
  const marchers = unitIds.flatMap((id) => r.stateUnit(id) ?? []).sort((a, b) => lead(b) - lead(a) || a.seq - b.seq)
  for (const unit of marchers) {
    if (r.isOver() || !r.state.units.includes(unit) || unit.anchor === null) continue
    unit.turn.actionsUsed += 1
    unit.turn.moves += 1
    r.cancelDefend(unit, 'acted')
    walkPath(r, unit, [{ x: unit.anchor.x + offset.x, y: unit.anchor.y + offset.y }])
  }
}

function resolveIntent(r: Resolver, seat: Seat, intent: Intent): void {
  const state = r.state
  switch (intent.kind) {
    case 'setArmy':
      setArmy(r, seat, intent.army)
      return
    case 'setReady':
      setReady(r, seat, intent.ready)
      return
    case 'updateSettings':
      updateSettings(r, intent.settings)
      return
    case 'startDeployment':
      startDeployment(r, intent.coinSeed)
      return
    case 'deploy':
      deploy(r, seat, intent.unitId, intent.anchor)
      return
    case 'undeploy':
      deploy(r, seat, intent.unitId, null)
      return
    case 'confirmDeployment':
      confirmDeployment(r, seat, intent.confirmed)
      return
    case 'move':
    case 'attack':
    case 'defend':
    case 'useAbility':
    case 'charge':
    case 'groupMarch':
    case 'endTurn':
      resolveAction(r, seat, intent)
      return
    case 'respondDecision': {
      const decision = state.decisions.find((d) => d.id === intent.decisionId)
      if (decision !== undefined) answerDecision(r, decision, intent.choice, false)
      if (processDecisions(r) === 'clear') runTurnTransition(r)
      return
    }
    case 'requestTakeback': {
      const last = state.lastAction
      if (last === null) return
      state.takeback.request = { requester: seat, actionSeq: last.seq, action: last.intent, seenByDecider: last.seenByOther, disclosure: last.disclosure }
      r.emit({ type: 'takebackRequested', seat, actionSeq: last.seq }, SEATS)
      return
    }
    case 'declineTakeback': {
      const request = state.takeback.request
      if (request === null) return
      state.takeback.declined.push(request.actionSeq)
      state.takeback.request = null
      r.emit({ type: 'takebackDeclined', seat: request.requester, actionSeq: request.actionSeq }, SEATS)
      return
    }
    case 'acceptTakeback':
      return // handled by apply (it replaces the whole state)
    case 'resign':
      r.endGame(opponentOf(seat), 'resignation')
      return
    case 'offerDraw':
      state.drawOffer = seat
      r.emit({ type: 'drawOffered', seat }, SEATS)
      return
    case 'acceptDraw':
      r.endGame(null, 'agreement')
      return
    case 'declineDraw':
      state.drawOffer = null
      r.emit({ type: 'drawDeclined', seat }, SEATS)
      return
    case 'setPreference':
      state.seats[seat].preferences[intent.key] = intent.value
      r.emit({ type: 'preferenceChanged', seat, key: intent.key, value: intent.value }, [seat])
      if (state.phase === 'battle' && processDecisions(r) === 'clear') runTurnTransition(r)
      return
  }
}

/**
 * TB-4 / TB-5: an action records what the other seat saw of it and what it showed its actor; the answers to the
 * prompts it caused (and anything else before the next action) add to the latter.
 */
function recordForTakeback(before: GameState, after: GameState, seat: Seat, intent: Intent, events: readonly GameEvent[]): void {
  const last = after.lastAction
  if (last === null || after.phase !== 'battle') return
  if (isActionIntent(intent)) {
    last.seenByOther = seenBy(intent, before, after, events, opponentOf(seat))
    last.disclosure = disclose(NO_DISCLOSURE, before, after, events, seat)
  } else {
    last.disclosure = disclose(last.disclosure, before, after, events, last.seat)
  }
}

/** A9-02: the exact earlier state, keeping only the take-back bookkeeping and the players' own options. */
function restoreForTakeback(state: GameState, before: GameState): ApplyResult {
  const request = state.takeback.request
  if (request === null) return reject('NO_TAKEBACK_REQUEST', 'No take-back request')
  const restored = cloneState(before)
  restored.takeback = {
    request: null,
    declined: [...state.takeback.declined],
    used: { ...state.takeback.used, [request.requester]: state.takeback.used[request.requester] + 1 },
  }
  for (const seat of SEATS) restored.seats[seat].preferences = { ...state.seats[seat].preferences }
  const events: GameEvent[] = [{ type: 'takebackApplied', seat: request.requester, actionSeq: request.actionSeq, visibleTo: SEATS }]
  return { ok: true, state: restored, events }
}

export function apply(state: GameState, seat: Seat, intent: Intent, options: ApplyOptions = {}): ApplyResult {
  const verdict = validate(state, seat, intent, options)
  if (!verdict.ok) return verdict
  if (intent.kind === 'acceptTakeback') {
    const request = state.takeback.request
    const before = request === null ? undefined : options.stateBeforeAction?.(request.actionSeq)
    if (before === undefined) return reject('TAKEBACK_UNAVAILABLE', 'This action can no longer be taken back')
    return restoreForTakeback(state, before)
  }
  const draft = cloneState(state)
  const r = new Resolver(draft)
  resolveIntent(r, seat, intent)
  r.noteFirstContact() // R28
  recordForTakeback(state, draft, seat, intent, r.events)
  return { ok: true, state: draft, events: r.events }
}
