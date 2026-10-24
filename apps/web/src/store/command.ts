// State machine A (research-ux-conventions 23): select -> action -> targeting -> preview/confirm -> submit, as one
// pure reducer. Every legality question goes to the engine on the player's own view; ability targeting is driven
// by the abilities' declarative TargetSpecs. The command store runs the effects (sending intents, hints).

import {
  GROUP_MARCH_MAX,
  MARCH_OFFSETS,
  buildingDef,
  footprintSquares,
  isMovementStep,
  isOrthogonallyConnected,
  sameSquare,
  validateIntent,
  type AbilityTarget,
  type ActionIntent,
  type AttackTarget,
  type MarchDirection,
  type PlayerView,
  type Square,
  type TargetSpec,
  type UnitId,
  type UnitView,
} from '@coinduel/engine'
import type { PointerButton } from '../contracts'
import {
  abilitySpecs,
  actionOption,
  attackCandidates,
  chargeEnds,
  chargeMaxSteps,
  chargeOptions,
  chargeTargetsFrom,
  cycleUnit,
  enteredSquares,
  footprint,
  hazardPromptNeeded,
  knownMines,
  marchOption,
  minesOnPath,
  ownUnit,
  pickCandidates,
  reachTo,
  readyUnits,
  stepOpen,
  unitAt,
  unitById,
  viewQuery,
} from './rules'
import type { ConfirmMode } from './settings'

// ---------------------------------------------------------------- types

export type ActionRef =
  | { readonly kind: 'move' }
  | { readonly kind: 'attack' }
  | { readonly kind: 'defend' }
  | { readonly kind: 'charge' }
  | { readonly kind: 'march' }
  | { readonly kind: 'ability'; readonly abilityId: string }

export type InspectTarget =
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  | { readonly kind: 'ghost'; readonly unitId: UnitId }
  | { readonly kind: 'square'; readonly square: Square }

/** Fields shared by the states that work on a selected unit. */
export interface Working {
  readonly unitId: UnitId
  readonly action: ActionRef
  /** Completed picks, in TargetSpec order (Charge: [end square, target]). */
  readonly picks: readonly AbilityTarget[]
  /** Squares painted so far for a connectedSquares pick (Forcefield). */
  readonly partial: readonly Square[]
  /** The steered path (Move, Charge). */
  readonly trail: readonly Square[]
  /** Group march members (R27), the selected unit first. */
  readonly group: readonly UnitId[]
}

export interface Locked extends Working {
  readonly intent: ActionIntent
  /** Known mines the intent walks into (A8-17). */
  readonly hazards: readonly Square[]
  readonly hazardPrompt: boolean
  readonly lockedAt: number
  /** Where Esc returns to. */
  readonly back: CommandState
}

export type CommandState =
  | { readonly t: 'idle' }
  | { readonly t: 'inspect'; readonly target: InspectTarget }
  | { readonly t: 'selected'; readonly unitId: UnitId; readonly trail: readonly Square[] }
  | ({ readonly t: 'targeting' } & Working)
  | ({ readonly t: 'confirming' } & Locked)
  | ({ readonly t: 'hazard' } & Locked)
  | { readonly t: 'submitting'; readonly unitId: UnitId; readonly intent: ActionIntent }

type Targeting = Extract<CommandState, { t: 'targeting' }>
type Confirming = Extract<CommandState, { t: 'confirming' }>

export type CommandEvent =
  | { readonly t: 'clickUnit'; readonly unitId: UnitId; readonly button: PointerButton }
  | { readonly t: 'clickSquare'; readonly square: Square; readonly button: PointerButton }
  | { readonly t: 'hoverSquare'; readonly square: Square | null }
  | { readonly t: 'select'; readonly unitId: UnitId | null }
  | { readonly t: 'cycleUnit'; readonly delta: 1 | -1 }
  | { readonly t: 'inspect'; readonly target: InspectTarget }
  | { readonly t: 'action'; readonly action: ActionRef }
  | { readonly t: 'marchDirection'; readonly direction: MarchDirection }
  | { readonly t: 'cycleTarget'; readonly delta: 1 | -1 }
  | { readonly t: 'confirm' }
  | { readonly t: 'cancel' }
  | { readonly t: 'back' }
  | { readonly t: 'hazardAccept' }
  | { readonly t: 'hazardCancel' }
  | { readonly t: 'ack' }
  | { readonly t: 'reject'; readonly message: string }
  | { readonly t: 'sync' }

export type CommandEffect = { readonly t: 'send'; readonly intent: ActionIntent } | { readonly t: 'hint'; readonly text: string }

export interface CommandPrefs {
  readonly confirmMode: ConfirmMode
  readonly mineWarning: boolean
  readonly autoSelectNext: boolean
}

/** canCommand (23.1): my turn, connected, no take-back or reaction pending, game not over. */
export interface Gate {
  readonly open: boolean
  readonly reason: string | null
}

export interface CommandContext {
  readonly view: PlayerView
  readonly prefs: CommandPrefs
  readonly gate: Gate
  readonly now: number
  /** A last-seen ghost on this square, if any (client memory, A4-16). */
  readonly ghostAt?: (square: Square) => UnitId | null
  /** The square under the pointer: which square of a Size-2 token a click meant. */
  readonly hover?: Square | null
}

export interface CommandResult {
  readonly state: CommandState
  readonly effects: readonly CommandEffect[]
}

/** S-12.3: a confirming input less than this after the lock is ignored (double-click guard, row 24). */
export const CONFIRM_GUARD_MS = 250

export const IDLE: CommandState = { t: 'idle' }

// ---------------------------------------------------------------- the gate

export function commandGate(view: PlayerView, connected: boolean): Gate {
  const closed = (reason: string): Gate => ({ open: false, reason })
  if (view.phase === 'ended') return closed('The game is over')
  if (view.phase !== 'battle') return closed('The battle has not started')
  if (!connected) return closed('Not connected to the host')
  if (view.turn?.activeSeat !== view.seat) return closed("Opponent's turn: you can inspect but not act")
  if (view.decision !== null) return closed('Answer the prompt first')
  if (view.opponentDeciding) return closed('Waiting for the opponent to decide')
  const request = view.takeback.request
  if (request !== null) return closed(request.requester === view.seat ? 'Waiting for the opponent to answer your take-back request' : 'Answer the take-back request first')
  return { open: true, reason: null }
}

// ---------------------------------------------------------------- small helpers

const done = (state: CommandState, ...effects: CommandEffect[]): CommandResult => ({ state, effects })
const hint = (text: string): CommandEffect => ({ t: 'hint', text })
const selected = (unitId: UnitId): CommandState => ({ t: 'selected', unitId, trail: [] })

function fresh(unitId: UnitId, action: ActionRef, patch: Partial<Working> = {}): Working {
  return { unitId, action, picks: [], partial: [], trail: [], group: [], ...patch }
}

function fields(state: Working): Working {
  return { unitId: state.unitId, action: state.action, picks: state.picks, partial: state.partial, trail: state.trail, group: state.group }
}

function selectedUnitId(state: CommandState): UnitId | null {
  return state.t === 'idle' || state.t === 'inspect' ? null : state.unitId
}

export function sameTarget(a: AbilityTarget, b: AbilityTarget): boolean {
  if (a.kind === 'unit' && b.kind === 'unit') return a.unitId === b.unitId
  if (a.kind === 'square' && b.kind === 'square') return sameSquare(a.square, b.square)
  if (a.kind === 'squares' && b.kind === 'squares') {
    return a.squares.length === b.squares.length && a.squares.every((s) => b.squares.some((o) => sameSquare(s, o)))
  }
  return false
}

const asAttackTarget = (pick: AbilityTarget | undefined): AttackTarget | null => (pick === undefined || pick.kind === 'squares' ? null : pick)

function confirmRequired(mode: ConfirmMode, action: ActionRef): boolean {
  switch (mode) {
    case 'always':
      return true
    case 'attacksAbilities':
      return action.kind === 'attack' || action.kind === 'charge' || action.kind === 'ability'
    case 'never':
      return false
  }
}

/** R14: a harmful single-target ability aimed at one of my own units always asks first. */
function harmsOwnUnit(view: PlayerView, action: ActionRef, picks: readonly AbilityTarget[]): boolean {
  if (action.kind !== 'ability') return false
  return abilitySpecs(action.abilityId).some((spec, i) => {
    const pick = picks[i]
    return spec.kind === 'unit' && spec.relation === 'harmful' && pick?.kind === 'unit' && unitById(view, pick.unitId)?.owner === view.seat
  })
}

type PickKind = 'unit' | 'square' | 'squares' | 'attack' | 'none'

function specKind(spec: TargetSpec | undefined): PickKind {
  if (spec === undefined) return 'none'
  switch (spec.kind) {
    case 'unit':
      return 'unit'
    case 'square':
    case 'area3x3':
      return 'square'
    case 'connectedSquares':
      return 'squares'
    case 'attack':
      return 'attack'
  }
}

/** What the next pick of a working state must be. */
function pickKind(w: Working): PickKind {
  switch (w.action.kind) {
    case 'move':
      return w.picks.length === 0 ? 'square' : 'none'
    case 'attack':
      return w.picks.length === 0 ? 'attack' : 'none'
    case 'charge':
      return w.picks.length === 0 ? 'square' : w.picks.length === 1 ? 'unit' : 'none'
    case 'defend':
    case 'march':
      return 'none'
    case 'ability':
      return specKind(abilitySpecs(w.action.abilityId)[w.picks.length])
  }
}

function stepCount(action: ActionRef): number {
  switch (action.kind) {
    case 'move':
    case 'attack':
    case 'march':
      return 1
    case 'defend':
      return 0
    case 'charge':
      return 2
    case 'ability':
      return abilitySpecs(action.abilityId).length
  }
}

/** The valid picks for the step a working state is on (clicks, [ ] cycling, overlays). */
export function stepCandidates(view: PlayerView, w: Working): readonly AbilityTarget[] {
  switch (w.action.kind) {
    case 'move':
    case 'defend':
    case 'march':
      return []
    case 'attack':
      return w.picks.length === 0 ? attackCandidates(view, w.unitId) : []
    case 'charge': {
      if (w.picks.length === 0) return chargeEnds(view, w.unitId).map((square) => ({ kind: 'square', square }))
      const end = w.picks[0]
      return end?.kind === 'square' && w.picks.length === 1 ? chargeTargetsFrom(view, w.unitId, end.square).map((o) => o.target) : []
    }
    case 'ability':
      return abilitySpecs(w.action.abilityId)[w.picks.length] === undefined ? [] : pickCandidates(view, w.unitId, w.action.abilityId, w.picks.length, w.picks)
  }
}

function inBuilding(view: PlayerView, square: Square): boolean {
  return view.buildings.some((b) => footprintSquares(b.anchor, buildingDef(b.kind).size).some((s) => sameSquare(s, square)))
}

// ---------------------------------------------------------------- intents, hazards, commit

function buildIntent(view: PlayerView, w: Working, direction: MarchDirection | null): ActionIntent | null {
  const { unitId, action, picks } = w
  switch (action.kind) {
    case 'move': {
      const dest = picks[0]
      if (dest?.kind !== 'square') return null
      const last = w.trail[w.trail.length - 1]
      if (last !== undefined && sameSquare(last, dest.square)) {
        const steered: ActionIntent = { kind: 'move', unitId, path: w.trail }
        if (validateIntent(view, steered).ok) return steered
      }
      const best = reachTo(view, unitId, dest.square)
      return best === undefined ? null : { kind: 'move', unitId, path: best.path }
    }
    case 'attack': {
      const target = asAttackTarget(picks[0])
      return target === null ? null : { kind: 'attack', unitId, target }
    }
    case 'defend':
      return { kind: 'defend', unitId }
    case 'charge': {
      const end = picks[0]
      const target = asAttackTarget(picks[1])
      if (end?.kind !== 'square' || target === null) return null
      const lastStep = w.trail[w.trail.length - 1]
      if (lastStep !== undefined && sameSquare(lastStep, end.square)) {
        const steered: ActionIntent = { kind: 'charge', unitId, path: w.trail, target }
        if (validateIntent(view, steered).ok) return steered
      }
      const option = chargeTargetsFrom(view, unitId, end.square).find((o) => sameTarget(o.target, target))
      return option === undefined ? null : { kind: 'charge', unitId, path: option.path, target }
    }
    case 'march':
      return direction === null ? null : { kind: 'groupMarch', unitIds: w.group, direction }
    case 'ability':
      return { kind: 'useAbility', unitId, abilityId: action.abilityId, targets: picks }
  }
}

/** Known mines an intent walks into, and whether that needs the prompt (A8-17; R34 for the commander). */
export function hazardsOf(view: PlayerView, intent: ActionIntent, mineWarning: boolean): { readonly squares: Square[]; readonly prompt: boolean } {
  switch (intent.kind) {
    case 'move':
    case 'charge': {
      const unit = ownUnit(view, intent.unitId)
      if (unit === undefined) return { squares: [], prompt: false }
      const squares = minesOnPath(view, unit, intent.path)
      return { squares, prompt: hazardPromptNeeded(squares, unit, mineWarning) }
    }
    case 'groupMarch': {
      const offset = MARCH_OFFSETS[intent.direction]
      const squares: Square[] = []
      let prompt = false
      for (const id of intent.unitIds) {
        const unit = ownUnit(view, id)
        if (unit?.anchor == null) continue
        const hit = enteredSquares(unit.anchor, unit.size, [{ x: unit.anchor.x + offset.x, y: unit.anchor.y + offset.y }]).filter((s) =>
          knownMines(view).some((m) => sameSquare(m.square, s)),
        )
        if (hazardPromptNeeded(hit, unit, mineWarning)) prompt = true
        squares.push(...hit)
      }
      return { squares, prompt }
    }
    default:
      return { squares: [], prompt: false }
  }
}

function submit(unitId: UnitId, intent: ActionIntent): CommandResult {
  return done({ t: 'submitting', unitId, intent }, { t: 'send', intent })
}

/**
 * "-> commit" (23.3): lock a preview (Confirming), or skip straight to the mine prompt or to sending when the
 * player's confirmation mode allows it. `back` is where Esc returns from the preview.
 */
function commit(
  w: Working,
  ctx: CommandContext,
  back: CommandState,
  options: { readonly direction?: MarchDirection; readonly forceConfirm?: boolean } = {},
): CommandResult {
  const { view, prefs } = ctx
  if (!ctx.gate.open) return done(back, hint(ctx.gate.reason ?? 'You cannot act now'))
  const intent = buildIntent(view, w, options.direction ?? null)
  if (intent === null) return done(back, hint('That is not a legal choice'))
  const verdict = validateIntent(view, intent)
  if (!verdict.ok) return done(back, hint(verdict.message))
  const hazards = hazardsOf(view, intent, prefs.mineWarning)
  const locked: Locked = { ...w, intent, hazards: hazards.squares, hazardPrompt: hazards.prompt, lockedAt: ctx.now, back }
  if (options.forceConfirm === true || confirmRequired(prefs.confirmMode, w.action) || harmsOwnUnit(view, w.action, w.picks)) {
    return done({ t: 'confirming', ...locked })
  }
  if (hazards.prompt) return done({ t: 'hazard', ...locked })
  return submit(w.unitId, intent)
}

/** Adds a pick: advance to the next step, or commit after the last one. */
function addPick(w: Working, pick: AbilityTarget, ctx: CommandContext, back: CommandState, forceConfirm = false): CommandResult {
  const next: Working = { ...w, picks: [...w.picks, pick], partial: [] }
  if (next.picks.length < stepCount(w.action)) return done({ t: 'targeting', ...next })
  return commit(next, ctx, back, { forceConfirm })
}

// ---------------------------------------------------------------- trail steering (UX 8.3, the Advance Wars arrow)

/** Extend the trail one adjacent square at a time, pop it when the pointer goes back, else jump to the best path. */
export function steerTrail(view: PlayerView, unit: UnitView, trail: readonly Square[], square: Square | null, maxSteps: number): readonly Square[] {
  const anchor = unit.anchor
  if (square === null || anchor === null) return trail
  if (sameSquare(square, anchor)) return trail.length === 0 ? trail : []
  const end = trail[trail.length - 1] ?? anchor
  if (sameSquare(square, end)) return trail
  const previous = trail.length >= 2 ? trail[trail.length - 2] : anchor
  if (trail.length >= 1 && previous !== undefined && sameSquare(square, previous)) return trail.slice(0, -1)
  if (trail.length < maxSteps && isMovementStep(end, square) && !trail.some((s) => sameSquare(s, square)) && stepOpen(view, unit, square)) {
    return [...trail, square]
  }
  const best = reachTo(view, unit.id, square)
  return best !== undefined && best.path.length <= maxSteps ? best.path : trail
}

// ---------------------------------------------------------------- the reducer

export function reduceCommand(state: CommandState, event: CommandEvent, ctx: CommandContext): CommandResult {
  return handle(normalize(state, ctx), event, ctx)
}

/** Drops states that no longer make sense on this view (23.3 row 39). */
export function normalize(state: CommandState, ctx: CommandContext): CommandState {
  const { view } = ctx
  switch (state.t) {
    case 'idle':
    case 'submitting':
      return state
    case 'inspect': {
      const target = state.target
      return target.kind === 'unit' && unitById(view, target.unitId) === undefined ? IDLE : state
    }
    case 'selected':
      return ownUnit(view, state.unitId)?.anchor == null ? IDLE : state
    case 'targeting':
    case 'confirming':
    case 'hazard': {
      if (ownUnit(view, state.unitId)?.anchor == null) return IDLE
      if (!ctx.gate.open) return selected(state.unitId)
      if (state.t !== 'targeting' && !validateIntent(view, state.intent).ok) return normalize(state.back, ctx)
      return state
    }
  }
}

function handle(state: CommandState, event: CommandEvent, ctx: CommandContext): CommandResult {
  const { view } = ctx
  switch (event.t) {
    case 'sync':
      return done(state)
    case 'hoverSquare':
      return onHover(state, event.square, ctx)
    case 'select':
      return done(event.unitId !== null && ownUnit(view, event.unitId) !== undefined ? selected(event.unitId) : IDLE)
    case 'cycleUnit': {
      if (state.t === 'submitting') return done(state)
      const next = cycleUnit(view, selectedUnitId(state), event.delta)
      return next === null ? done(state, hint('You have no units on the board')) : done(selected(next))
    }
    case 'inspect':
      return state.t === 'submitting' ? done(state) : done({ t: 'inspect', target: event.target })
    case 'clickUnit':
      return event.button === 'secondary' ? onCancel(state, false) : onClickUnit(state, event.unitId, ctx)
    case 'clickSquare':
      return event.button === 'secondary' ? onCancel(state, false) : onClickSquare(state, event.square, ctx)
    case 'action':
      return onAction(state, event.action, ctx)
    case 'marchDirection':
      if ((state.t === 'targeting' || state.t === 'confirming') && state.action.kind === 'march') {
        return commit(fields(state), ctx, state.t === 'confirming' ? state.back : state, { direction: event.direction })
      }
      return done(state)
    case 'cycleTarget':
      return onCycleTarget(state, event.delta, ctx)
    case 'confirm':
      return onConfirm(state, ctx)
    case 'cancel':
      return onCancel(state, false)
    case 'back':
      return onCancel(state, true)
    case 'hazardAccept':
      return state.t === 'hazard' ? submit(state.unitId, state.intent) : done(state)
    case 'hazardCancel':
      return state.t === 'hazard' ? done(state.back) : done(state)
    case 'ack':
      return state.t === 'submitting' ? done(afterAction(state.unitId, ctx)) : done(state)
    case 'reject':
      return state.t === 'submitting' ? done(selected(state.unitId), hint(event.message)) : done(state)
  }
}

/** Rows 35-37: stay on the unit while it can still act, else the next ready unit (setting) or Idle. */
function afterAction(unitId: UnitId, ctx: CommandContext): CommandState {
  const { view } = ctx
  const unit = ownUnit(view, unitId)
  if (unit?.anchor != null && (readyUnits(view).some((u) => u.id === unitId) || abilityFollowUps(view, unitId).length > 0)) return selected(unitId)
  const next = ctx.prefs.autoSelectNext ? readyUnits(view)[0] : undefined
  return next === undefined ? IDLE : selected(next.id)
}

/** Abilities still usable once the unit has no action left (Savagery after its attack, Mend): the "Next" glow (10.4). */
export function abilityFollowUps(view: PlayerView, unitId: UnitId): string[] {
  const unit = ownUnit(view, unitId)
  if (unit?.own == null || unit.own.turn.actionsUsed < unit.own.actionAllowance) return []
  return unit.own.abilities.filter((id) => actionOption(view, unitId, 'ability', id)?.enabled === true)
}

function onHover(state: CommandState, square: Square | null, ctx: CommandContext): CommandResult {
  const { view } = ctx
  if (state.t === 'selected') {
    const unit = ownUnit(view, state.unitId)
    if (unit === undefined || actionOption(view, unit.id, 'move')?.enabled !== true) return done(state)
    const trail = steerTrail(view, unit, state.trail, square, unit.movement)
    return trail === state.trail ? done(state) : done({ ...state, trail })
  }
  if (state.t === 'targeting' && state.action.kind === 'charge' && state.picks.length === 0) {
    const unit = ownUnit(view, state.unitId)
    if (unit === undefined) return done(state)
    const trail = steerTrail(view, unit, state.trail, square, chargeMaxSteps(unit))
    return trail === state.trail ? done(state) : done({ ...state, trail })
  }
  return done(state)
}

function onAction(state: CommandState, action: ActionRef, ctx: CommandContext): CommandResult {
  const { view } = ctx
  if (state.t === 'submitting') return done(state)
  const unitId = selectedUnitId(state)
  if (unitId === null) return done(state, hint('Select one of your units first'))
  const unit = ownUnit(view, unitId)
  if (unit === undefined) return done(IDLE)
  if (!ctx.gate.open) return done(state, hint(ctx.gate.reason ?? 'You cannot act now'))
  const base = selected(unitId)
  if (action.kind === 'march') {
    const option = marchOption(view, unit)
    return option.enabled ? done({ t: 'targeting', ...fresh(unitId, action, { group: [unitId] }) }) : done(state, hint(option.reason ?? 'Group march is not available'))
  }
  const option = action.kind === 'ability' ? actionOption(view, unitId, 'ability', action.abilityId) : actionOption(view, unitId, action.kind)
  if (option === undefined) return done(state, hint('This unit has no such action'))
  if (!option.enabled) return done(state, hint(option.reason ?? 'Not available'))
  switch (action.kind) {
    case 'move':
      return done(state.t === 'selected' ? state : base, hint('Choose a destination'))
    case 'defend':
      return commit(fresh(unitId, action), ctx, base)
    case 'ability':
      return abilitySpecs(action.abilityId).length === 0 ? commit(fresh(unitId, action), ctx, base) : done({ t: 'targeting', ...fresh(unitId, action) })
    case 'attack':
    case 'charge':
      return done({ t: 'targeting', ...fresh(unitId, action) })
  }
}

function onClickUnit(state: CommandState, unitId: UnitId, ctx: CommandContext): CommandResult {
  const { view } = ctx
  const clicked = unitById(view, unitId)
  if (clicked === undefined) return done(state)
  const mine = clicked.owner === view.seat
  switch (state.t) {
    case 'submitting':
    case 'hazard':
      return done(state)
    case 'idle':
    case 'inspect':
      return done(mine ? selected(unitId) : { t: 'inspect', target: { kind: 'unit', unitId } })
    case 'selected': {
      if (mine) return done(unitId === state.unitId ? state : selected(unitId))
      if (!ctx.gate.open) return done({ t: 'inspect', target: { kind: 'unit', unitId } })
      const target: AbilityTarget = { kind: 'unit', unitId }
      if (actionOption(view, state.unitId, 'attack')?.enabled === true && attackCandidates(view, state.unitId).some((t) => sameTarget(t, target))) {
        return commit(fresh(state.unitId, { kind: 'attack' }, { picks: [target] }), ctx, state)
      }
      return done(state, hint(outOfReachText(view, state.unitId, clicked)))
    }
    case 'targeting':
      return onTargetUnit(state, clicked, ctx)
    case 'confirming':
      return onLockedClick(state, { kind: 'unit', unitId }, ctx)
  }
}

function outOfReachText(view: PlayerView, attackerId: UnitId, target: UnitView): string {
  const attacker = ownUnit(view, attackerId)
  if (attacker === undefined) return 'Select one of your units first'
  const option = actionOption(view, attackerId, 'attack')
  if (option !== undefined && !option.enabled && option.reason !== null && option.reason !== 'No target in range') return option.reason
  return `Out of reach (distance ${viewQuery(view).distance(attacker, target)}, reach ${attacker.attackRange})`
}

/**
 * A token stands on the square the player meant (Forcefield over own units, Slam on an occupied square). For a Size-2
 * token, that is the square under the pointer when this pick accepts it, else the first of its squares it accepts.
 */
function squareOnToken(view: PlayerView, w: Working, clicked: UnitView, hover: Square | null): Square | null {
  const candidates = stepCandidates(view, w)
  const accepted = (s: Square): boolean => candidates.some((c) => (c.kind === 'squares' ? c.squares.some((o) => sameSquare(o, s)) : sameTarget(c, { kind: 'square', square: s })))
  const squares = footprint(clicked)
  const pointed = hover !== null && squares.some((s) => sameSquare(s, hover)) && accepted(hover) ? hover : undefined
  return pointed ?? squares.find(accepted) ?? clicked.anchor
}

function onTargetUnit(state: Targeting, clicked: UnitView, ctx: CommandContext): CommandResult {
  const { view } = ctx
  const w = fields(state)
  if (w.action.kind === 'march') return toggleMarcher(state, clicked, ctx)
  if (w.action.kind === 'charge' && w.picks.length === 0) return chargeAtUnit(state, clicked, ctx)
  const kind = pickKind(w)
  if (kind === 'square' || kind === 'squares') {
    const square = squareOnToken(view, w, clicked, ctx.hover ?? null)
    if (square !== null) return onTargetSquare(state, square, ctx)
  }
  const pick: AbilityTarget = { kind: 'unit', unitId: clicked.id }
  if (stepCandidates(view, w).some((c) => sameTarget(c, pick))) return addPick(w, pick, ctx, state)
  if (clicked.owner === view.seat && w.picks.length === 0 && w.action.kind === 'attack') return done(selected(clicked.id))
  return done(state, hint(w.action.kind === 'attack' ? outOfReachText(view, w.unitId, clicked) : 'Not a valid target for this step'))
}

/** Charge without the second step: clicking an enemy picks a path that reaches it (the steered one when it can). */
function chargeAtUnit(state: Targeting, clicked: UnitView, ctx: CommandContext): CommandResult {
  const options = chargeOptions(ctx.view, state.unitId).filter((o) => o.target.kind === 'unit' && o.target.unitId === clicked.id)
  if (options.length === 0) return done(state, hint(clicked.owner === ctx.view.seat ? 'A charge must end in an attack on an enemy' : 'No charge reaches that unit'))
  const steeredEnd = state.trail[state.trail.length - 1]
  const option = options.find((o) => {
    const end = o.path[o.path.length - 1]
    return steeredEnd !== undefined && end !== undefined && sameSquare(end, steeredEnd)
  }) ?? options[0]
  const end = option?.path[option.path.length - 1]
  if (option === undefined || end === undefined) return done(state)
  const trail = steeredEnd !== undefined && sameSquare(steeredEnd, end) ? state.trail : option.path
  return commit({ ...fields(state), trail, picks: [{ kind: 'square', square: end }, { kind: 'unit', unitId: clicked.id }] }, ctx, state)
}

/** Connectivity by footprints, like the engine's check (a size-2 unit touches more squares than its anchor). */
function groupConnected(view: PlayerView, group: readonly UnitId[]): boolean {
  const q = viewQuery(view)
  const units = group.map((id) => ownUnit(view, id)).filter((u): u is UnitView => u !== undefined)
  const reached = new Set<UnitId>(units[0] === undefined ? [] : [units[0].id])
  for (let grew = true; grew; ) {
    grew = false
    for (const u of units) {
      if (!reached.has(u.id) && units.some((o) => reached.has(o.id) && q.isAdjacent(u, o))) {
        reached.add(u.id)
        grew = true
      }
    }
  }
  return reached.size === units.length
}

function toggleMarcher(state: Targeting, clicked: UnitView, ctx: CommandContext): CommandResult {
  const { view } = ctx
  if (clicked.owner !== view.seat) return done(state, hint('Only your own units can march'))
  if (state.group.includes(clicked.id)) {
    const group = state.group.filter((id) => id !== clicked.id)
    const first = group[0]
    return done(first === undefined ? selected(state.unitId) : { ...state, group, unitId: first })
  }
  if (state.group.length >= GROUP_MARCH_MAX) return done(state, hint(`At most ${GROUP_MARCH_MAX} units march together`))
  const option = marchOption(view, clicked)
  if (!option.enabled) return done(state, hint(option.reason ?? 'This unit cannot march'))
  const group = [...state.group, clicked.id]
  return groupConnected(view, group) ? done({ ...state, group }) : done(state, hint('Marching units must form one connected group'))
}

/** Whether a click on a square with a token on it still means the square (a square pick is expected). */
function wantsSquare(state: CommandState): boolean {
  if (state.t === 'targeting') {
    const kind = pickKind(fields(state))
    return state.action.kind !== 'move' && (kind === 'square' || kind === 'squares')
  }
  if (state.t === 'confirming') {
    const kind = pickKind({ ...fields(state), picks: state.picks.slice(0, -1) })
    return state.action.kind !== 'move' && (kind === 'square' || kind === 'squares')
  }
  return false
}

function onClickSquare(state: CommandState, square: Square, ctx: CommandContext): CommandResult {
  const { view } = ctx
  const occupant = unitAt(view, square)
  if (occupant !== undefined && !wantsSquare(state)) return onClickUnit(state, occupant.id, ctx)
  switch (state.t) {
    case 'submitting':
    case 'hazard':
      return done(state)
    case 'idle':
    case 'inspect': {
      const ghost = ctx.ghostAt?.(square) ?? null
      if (ghost !== null) return done({ t: 'inspect', target: { kind: 'ghost', unitId: ghost } })
      return done(inBuilding(view, square) ? { t: 'inspect', target: { kind: 'square', square } } : IDLE)
    }
    case 'selected': {
      const unitId = state.unitId
      if (reachTo(view, unitId, square) !== undefined) {
        if (actionOption(view, unitId, 'move')?.enabled === true) {
          return commit(fresh(unitId, { kind: 'move' }, { picks: [{ kind: 'square', square }], trail: state.trail }), ctx, state)
        }
        return done(state, hint(ctx.gate.reason ?? actionOption(view, unitId, 'move')?.reason ?? 'This unit cannot move now'))
      }
      if (attackCandidates(view, unitId).some((t) => t.kind === 'square' && sameSquare(t.square, square))) {
        return done(state, hint('Choose Attack (A) to fire at an empty square'))
      }
      const ghost = ctx.ghostAt?.(square) ?? null
      return done(ghost !== null ? { t: 'inspect', target: { kind: 'ghost', unitId: ghost } } : IDLE)
    }
    case 'targeting':
      return onTargetSquare(state, square, ctx)
    case 'confirming':
      return onLockedClick(state, { kind: 'square', square }, ctx)
  }
}

function onTargetSquare(state: Targeting, square: Square, ctx: CommandContext): CommandResult {
  const { view } = ctx
  const w = fields(state)
  if (w.action.kind === 'march') {
    const direction = directionTowards(view, w.group, square)
    return direction === null ? done(state, hint('Click a square next to the group, or use the arrow keys')) : commit(w, ctx, state, { direction })
  }
  const kind = pickKind(w)
  if (kind === 'squares') return paintSquare(state, square, ctx)
  const pick: AbilityTarget = { kind: 'square', square }
  if (!stepCandidates(view, w).some((c) => sameTarget(c, pick))) return done(state, hint(kind === 'attack' ? 'Nothing to attack there' : 'Not a valid square for this step'))
  if (w.action.kind === 'charge') {
    const trailEnd = w.trail[w.trail.length - 1]
    const trail = trailEnd !== undefined && sameSquare(trailEnd, square) ? w.trail : (chargeTargetsFrom(view, w.unitId, square)[0]?.path ?? w.trail)
    return done({ t: 'targeting', ...w, trail, picks: [pick], partial: [] })
  }
  return addPick(w, pick, ctx, state)
}

/** Forcefield painting (UX 10.3): click squares one by one; each must touch the group; clicking one again removes it. */
function paintSquare(state: Targeting, square: Square, ctx: CommandContext): CommandResult {
  const w = fields(state)
  if (w.action.kind !== 'ability') return done(state)
  const spec = abilitySpecs(w.action.abilityId)[w.picks.length]
  if (spec?.kind !== 'connectedSquares') return done(state)
  if (w.partial.some((s) => sameSquare(s, square))) return done({ ...state, partial: w.partial.filter((s) => !sameSquare(s, square)) })
  const inRange = stepCandidates(ctx.view, w).some((c) => c.kind === 'squares' && c.squares.some((s) => sameSquare(s, square)))
  if (!inRange) return done(state, hint(`${spec.label}: the square must be inside this unit's vision`))
  const partial = [...w.partial, square]
  if (!isOrthogonallyConnected(partial)) return done(state, hint(`${spec.label}: the squares must touch each other`))
  if (partial.length < spec.count) return done({ ...state, partial })
  return addPick(w, { kind: 'squares', squares: partial }, ctx, { ...state, partial: partial.slice(0, -1) })
}

/** Absolute march direction from the group towards a clicked square next to it. */
export function directionTowards(view: PlayerView, group: readonly UnitId[], square: Square): MarchDirection | null {
  for (const id of group) {
    const unit = ownUnit(view, id)
    if (unit?.anchor == null) continue
    for (const [direction, offset] of Object.entries(MARCH_OFFSETS) as [MarchDirection, Square][]) {
      const to = { x: unit.anchor.x + offset.x, y: unit.anchor.y + offset.y }
      if (enteredSquares(unit.anchor, unit.size, [to]).some((s) => sameSquare(s, square))) return direction
    }
  }
  return null
}

/** Confirming: the same target again confirms (BT-07); another valid target retargets (rows 25, 26). */
function onLockedClick(state: Confirming, clickedPick: AbilityTarget, ctx: CommandContext): CommandResult {
  const { view } = ctx
  const w = fields(state)
  if (state.action.kind === 'move') {
    const dest = state.picks[0]
    if (clickedPick.kind !== 'square' || dest?.kind !== 'square') return done(state)
    if (sameSquare(dest.square, clickedPick.square)) return onConfirm(state, ctx)
    return reachTo(view, state.unitId, clickedPick.square) !== undefined ? commit({ ...w, picks: [clickedPick] }, ctx, state.back, { forceConfirm: true }) : done(state.back)
  }
  if (state.action.kind === 'march') return done(state)
  const previous: Working = { ...w, picks: state.picks.slice(0, -1) }
  // A square pick clicked on a token means a square under it, as while targeting.
  const kind = pickKind(previous)
  const clicked = clickedPick.kind === 'unit' ? unitById(view, clickedPick.unitId) : undefined
  const onToken = clicked !== undefined && (kind === 'square' || kind === 'squares') ? squareOnToken(view, previous, clicked, ctx.hover ?? null) : null
  const pick: AbilityTarget = onToken === null ? clickedPick : { kind: 'square', square: onToken }
  const last = state.picks[state.picks.length - 1]
  const onLast =
    last !== undefined &&
    (sameTarget(last, pick) ||
      (last.kind === 'unit' && pick.kind === 'square' && unitAt(view, pick.square)?.id === last.unitId) ||
      (last.kind === 'squares' && pick.kind === 'square' && last.squares.some((s) => sameSquare(s, pick.square))))
  if (onLast) return onConfirm(state, ctx)
  const retarget = stepCandidates(view, previous).find((c) => sameTarget(c, pick))
  return retarget === undefined ? done(state) : commit({ ...previous, picks: [...previous.picks, retarget] }, ctx, state.back, { forceConfirm: true })
}

function onCycleTarget(state: CommandState, delta: 1 | -1, ctx: CommandContext): CommandResult {
  const { view } = ctx
  if (state.t === 'targeting') {
    const w = fields(state)
    const candidates = stepCandidates(view, w).filter((c) => c.kind !== 'squares')
    const first = delta > 0 ? candidates[0] : candidates[candidates.length - 1]
    if (first === undefined) return done(state)
    if (w.action.kind === 'charge' && w.picks.length === 0 && first.kind === 'square') return onTargetSquare(state, first.square, ctx)
    // Cycling previews: it always locks (never sends), whatever the confirmation mode.
    return addPick(w, first, ctx, state, true)
  }
  if (state.t === 'confirming' && state.action.kind !== 'move' && state.action.kind !== 'march') {
    const previous: Working = { ...fields(state), picks: state.picks.slice(0, -1) }
    const candidates = stepCandidates(view, previous).filter((c) => c.kind !== 'squares')
    if (candidates.length === 0) return done(state)
    const last = state.picks[state.picks.length - 1]
    const index = last === undefined ? -1 : candidates.findIndex((c) => sameTarget(c, last))
    const next = candidates[(index + delta + candidates.length) % candidates.length]
    return next === undefined ? done(state) : commit({ ...previous, picks: [...previous.picks, next] }, ctx, state.back, { forceConfirm: true })
  }
  return done(state)
}

function onConfirm(state: CommandState, ctx: CommandContext): CommandResult {
  switch (state.t) {
    case 'confirming':
      if (ctx.now - state.lockedAt < CONFIRM_GUARD_MS) return done(state)
      if (!ctx.gate.open) return done(selected(state.unitId), hint(ctx.gate.reason ?? 'You cannot act now'))
      return state.hazardPrompt ? done({ ...state, t: 'hazard', back: state }) : submit(state.unitId, state.intent)
    case 'hazard':
      // UX 8.7: the safe button has the default focus, so Enter cancels.
      return done(state.back)
    case 'targeting':
      return done(state, hint(state.action.kind === 'march' ? 'Choose a direction: an arrow key, or a square next to the group' : 'Choose a target first'))
    default:
      return done(state)
  }
}

function onCancel(state: CommandState, backspace: boolean): CommandResult {
  switch (state.t) {
    case 'idle':
    case 'submitting':
      return done(state)
    case 'inspect':
      return done(IDLE)
    case 'selected':
      return backspace && state.trail.length > 0 ? done({ ...state, trail: state.trail.slice(0, -1) }) : done(IDLE)
    case 'targeting':
      if (state.partial.length > 0) return done({ ...state, partial: state.partial.slice(0, -1) })
      if (backspace && state.action.kind === 'march' && state.group.length > 1) return done({ ...state, group: state.group.slice(0, -1) })
      if (state.picks.length > 0) return done({ ...state, picks: state.picks.slice(0, -1) })
      return done(selected(state.unitId))
    case 'confirming':
    case 'hazard':
      return done(state.back)
  }
}

// ---------------------------------------------------------------- read-outs for the HUD

export function commandUnitId(state: CommandState): UnitId | null {
  return selectedUnitId(state)
}

export function activeAction(state: CommandState): ActionRef | null {
  return state.t === 'targeting' || state.t === 'confirming' || state.t === 'hazard' ? state.action : null
}

export function workingOf(state: CommandState): Working | null {
  return state.t === 'targeting' || state.t === 'confirming' || state.t === 'hazard' ? fields(state) : null
}

/** The hint line (S-5.6): what the current state expects, plus the way out. */
export function hintLine(state: CommandState, view: PlayerView, gate: Gate): string {
  switch (state.t) {
    case 'idle':
      return gate.open ? 'Select a unit · Tab cycles the units that can still act · ? lists every shortcut' : (gate.reason ?? '')
    case 'inspect':
      return 'Inspecting · Esc to close'
    case 'selected': {
      if (!gate.open) return gate.reason ?? ''
      const move = actionOption(view, state.unitId, 'move')?.enabled === true
      const attack = actionOption(view, state.unitId, 'attack')?.enabled === true
      if (move && attack) return 'Click a square to move or an enemy to attack, or choose an action · Esc to deselect'
      if (move) return 'Click a highlighted square to move, or choose an action · Esc to deselect'
      if (attack) return 'Click an enemy to attack, or choose an action · Esc to deselect'
      return 'Choose an action · Esc to deselect'
    }
    case 'targeting':
      return targetingHint(state)
    case 'confirming':
      return 'Enter, Space or the same target again to confirm · Esc to go back'
    case 'hazard':
      return 'Walk into a known mine? Move anyway (M), or Cancel (Esc or Enter)'
    case 'submitting':
      return 'Sending…'
  }
}

function targetingHint(state: Targeting): string {
  const total = stepCount(state.action)
  const step = `(${Math.min(state.picks.length + 1, total)}/${total})`
  switch (state.action.kind) {
    case 'attack':
      return 'Choose a target · [ and ] cycle the targets · Esc to go back'
    case 'charge':
      return state.picks.length === 0
        ? `Charge ${step}: choose where to stop (the arrow follows the pointer), or click the enemy · Esc to go back`
        : `Charge ${step}: choose the unit to attack · Esc to go back`
    case 'march':
      return `Group march (${state.group.length}/${GROUP_MARCH_MAX}): click units to add or remove them, then an arrow key or a square beside the group · Esc to go back`
    case 'ability': {
      const spec = abilitySpecs(state.action.abilityId)[state.picks.length]
      if (spec === undefined) return ''
      const label = spec.kind === 'connectedSquares' ? `${spec.label} (${state.partial.length}/${spec.count} squares)` : spec.label
      return `${label} ${step} · [ and ] cycle the targets · Esc to go back`
    }
    case 'move':
    case 'defend':
      return ''
  }
}
