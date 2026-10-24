// What the board shows for the current command state (UX 6.3 overlay vocabulary): reach, the path arrow, attack
// and ability targets, previews under the cursor, forecast chips and the hint chips. Every square comes from the
// engine's preview helpers on the player's own view.

import {
  MARCH_OFFSETS,
  area3x3,
  buildingDef,
  footprintSquares,
  lovSquares,
  ringSquares,
  sameSquare,
  squareExists,
  squareIndex,
  squaresWithin,
  type AbilityTarget,
  type PlayerView,
  type Square,
  type TargetSpec,
  type UnitView,
} from '@coinduel/engine'
import type { BoardOverlays, BoardSelection } from '../../contracts'
import { directionTowards, hazardsOf, stepCandidates, workingOf, type CommandState } from '../../store/command'
import { abilityForecast, attackForecast, chargeForecast, splashSquares, type Forecast } from '../../store/forecast'
import type { MatchSnapshot } from '../../store/matchController'
import { abilitySpecs, actionOption, attackCandidates, chargeEnds, chargeTargetsFrom, footprint, marchCandidates, minesOnPath, ownUnit, reach, reachTo, readyUnits, unitAt, unitById } from '../../store/rules'
import type { Settings } from '../../store/settings'
import type { BoardChip, BoardExtras } from '../board/extras'

export interface BoardModel {
  readonly selection: BoardSelection
  readonly overlays: BoardOverlays
  readonly extras: BoardExtras
  readonly forecast: Forecast | null
}

const EMPTY_OVERLAYS: BoardOverlays = { reachable: [], path: [], attackRange: [], abilityTargets: [], deploymentZones: null }

function targetSquares(view: PlayerView, targets: readonly AbilityTarget[]): Square[] {
  return targets.flatMap((t) => {
    if (t.kind === 'square') return [t.square]
    if (t.kind === 'squares') return [...t.squares]
    const unit = unitById(view, t.unitId)
    return unit === undefined ? [] : footprint(unit)
  })
}

function chipsFor(view: PlayerView, forecast: Forecast | null): BoardChip[] {
  if (forecast === null) return []
  const chips: BoardChip[] = []
  for (const hit of forecast.hits) {
    const unit = unitById(view, hit.targetId)
    if (unit?.anchor == null) continue
    const approx = forecast.uncertain ? '≈' : ''
    const text = hit.wins ? `${approx}−${hit.amount} WIN` : hit.lethal ? `${approx}−${hit.amount} LETHAL` : `${approx}−${hit.amount} → ${hit.after}/${hit.max}`
    chips.push({ square: unit.anchor, text, tone: hit.wins ? 'win' : hit.lethal ? 'lethal' : hit.ally ? 'ally' : 'enemy' })
  }
  for (const heal of forecast.heals) {
    const unit = unitById(view, heal.targetId)
    if (unit?.anchor != null && heal.amount > 0) chips.push({ square: unit.anchor, text: `+${heal.amount} → ${heal.after}`, tone: 'heal' })
  }
  return chips
}

/** UX 9.7 danger zone: where visible enemies could strike next turn (attack reach, plus a Charge's approach, R26). */
export function threatSquares(view: PlayerView): Square[] {
  const out = new Map<number, Square>()
  for (const enemy of view.units) {
    if (enemy.owner === view.seat || enemy.anchor === null || enemy.power < 1) continue
    const reachBonus = enemy.movement >= 2 ? enemy.movement - 1 : 0
    for (const s of squaresWithin(enemy.anchor, enemy.size, enemy.attackRange + reachBonus)) out.set(squareIndex(s), s)
  }
  return [...out.values()]
}

function forecastFor(view: PlayerView, state: CommandState): Forecast | null {
  if (state.t !== 'confirming' && state.t !== 'hazard') return null
  const intent = state.intent
  switch (intent.kind) {
    case 'attack':
      return intent.target.kind === 'unit' ? attackForecast(view, intent.unitId, intent.target.unitId) : null
    case 'charge':
      return intent.target.kind === 'unit' ? chargeForecast(view, intent.unitId, intent.path, intent.target.unitId) : null
    case 'useAbility':
      return abilityForecast(view, intent.unitId, intent.abilityId, intent.targets)
    default:
      return null
  }
}

export function boardModel(
  snap: MatchSnapshot,
  state: CommandState,
  hover: Square | null,
  hoverUnit: string | null,
  settings: Settings,
  ui: { readonly threat: boolean; readonly highlight: readonly Square[]; readonly focus: Square | null },
  reducedMotion: boolean,
): BoardModel {
  const view = snap.view
  const myTurn = view.turn?.activeSeat === view.seat && view.phase === 'battle'
  let overlays: BoardOverlays = EMPTY_OVERLAYS
  let hazards: Square[] = []
  let picked: Square[] = []
  let area: Square[] = []
  let visionPreview: Square[] = []
  let captureRing: Square[] = []
  let chipForecast: Forecast | null = null
  let selectedId: string | null = null
  let selectedSquare: Square | null = null

  const pathPreview = (unit: UnitView, trail: readonly Square[], maxSteps: number, allowed: (s: Square) => boolean): Square[] => {
    if (hover === null || !allowed(hover)) return []
    const end = trail[trail.length - 1]
    if (end !== undefined && sameSquare(end, hover)) return [...trail]
    const best = reachTo(view, unit.id, hover)
    return best !== undefined && best.path.length <= maxSteps ? [...best.path] : []
  }

  switch (state.t) {
    case 'idle':
      break
    case 'inspect': {
      const target = state.target
      if (target.kind === 'unit') selectedId = target.unitId
      if (target.kind === 'ghost') picked = snap.ghosts.ghosts.filter((g) => g.unitId === target.unitId).flatMap((g) => footprintSquares(g.anchor, g.size))
      if (target.kind === 'square') {
        const building = view.buildings.find((b) => footprintSquares(b.anchor, buildingDef(b.kind).size).some((s) => sameSquare(s, target.square)))
        if (building !== undefined) captureRing = ringSquares(building.anchor, buildingDef(building.kind).size).filter((s) => squareExists(s))
      }
      break
    }
    case 'selected': {
      selectedId = state.unitId
      const unit = ownUnit(view, state.unitId)
      if (unit === undefined) break
      const canMove = actionOption(view, unit.id, 'move')?.enabled === true
      const reachable = canMove ? reach(view, unit.id).map((r) => r.anchor) : []
      const path = canMove ? pathPreview(unit, state.trail, unit.movement, (s) => reachable.some((r) => sameSquare(r, s))) : []
      const attack = actionOption(view, unit.id, 'attack')?.enabled === true ? targetSquares(view, attackCandidates(view, unit.id)) : []
      overlays = { ...EMPTY_OVERLAYS, reachable, path, attackRange: attack }
      hazards = [...minesOnPath(view, unit, path), ...reach(view, unit.id).filter((r) => r.knownMines > 0).map((r) => r.anchor)]
      const dest = path[path.length - 1]
      if (dest !== undefined) visionPreview = lovSquares(dest, unit.size, unit.lov).filter((s) => squareExists(s))
      if (hoverUnit !== null) {
        const target = unitById(view, hoverUnit)
        if (target !== undefined && target.owner !== view.seat && attackCandidates(view, unit.id).some((t) => t.kind === 'unit' && t.unitId === target.id)) {
          chipForecast = attackForecast(view, unit.id, target.id)
        }
      }
      break
    }
    case 'targeting':
    case 'confirming':
    case 'hazard': {
      const w = workingOf(state)
      if (w === null) break
      selectedId = w.unitId
      const unit = ownUnit(view, w.unitId)
      if (unit === undefined) break
      const locked = state.t !== 'targeting'
      const candidates = locked ? [] : stepCandidates(view, w)
      picked = [...targetSquares(view, w.picks), ...w.partial]
      switch (w.action.kind) {
        case 'attack':
          overlays = { ...EMPTY_OVERLAYS, attackRange: locked ? [] : targetSquares(view, candidates) }
          if (!locked && hoverUnit !== null) chipForecast = attackForecast(view, unit.id, hoverUnit)
          break
        case 'charge': {
          const ends = chargeEnds(view, unit.id)
          if (w.picks.length === 0 && !locked) {
            const path = pathPreview(unit, w.trail, Math.max(0, unit.movement - 1), (s) => ends.some((e) => sameSquare(e, s)))
            overlays = { ...EMPTY_OVERLAYS, reachable: [...ends], path }
            hazards = minesOnPath(view, unit, path)
          } else {
            const end = w.picks[0]
            const path = state.t === 'targeting' ? w.trail : state.intent.kind === 'charge' ? state.intent.path : w.trail
            const targets = end?.kind === 'square' && !locked ? chargeTargetsFrom(view, unit.id, end.square).map((o) => o.target) : []
            overlays = { ...EMPTY_OVERLAYS, path: [...path], attackRange: targetSquares(view, targets) }
            hazards = minesOnPath(view, unit, path)
            if (!locked && hoverUnit !== null && targets.some((t) => t.kind === 'unit' && t.unitId === hoverUnit)) chipForecast = chargeForecast(view, unit.id, path, hoverUnit)
          }
          break
        }
        case 'march': {
          const candidatesSquares = marchCandidates(view)
            .filter((u) => !w.group.includes(u.id))
            .flatMap((u) => footprint(u))
          picked = w.group.flatMap((id) => {
            const u = ownUnit(view, id)
            return u === undefined ? [] : footprint(u)
          })
          const direction = state.t === 'targeting' ? (hover === null ? null : directionTowards(view, w.group, hover)) : state.intent.kind === 'groupMarch' ? state.intent.direction : null
          if (direction !== null) {
            const o = MARCH_OFFSETS[direction]
            area = w.group.flatMap((id) => {
              const u = ownUnit(view, id)
              return u?.anchor == null ? [] : footprintSquares({ x: u.anchor.x + o.x, y: u.anchor.y + o.y }, u.size)
            })
            if (state.t === 'targeting') hazards = hazardsOf(view, { kind: 'groupMarch', unitIds: w.group, direction }, true).squares
          }
          overlays = { ...EMPTY_OVERLAYS, abilityTargets: locked ? [] : candidatesSquares }
          break
        }
        case 'ability': {
          const abilityId = w.action.abilityId
          const spec = abilitySpecs(abilityId)[w.picks.length]
          let targets = locked ? [] : targetSquares(view, candidates)
          if (spec?.kind === 'connectedSquares') targets = targets.filter((s) => !w.partial.some((p) => sameSquare(p, s)))
          overlays = { ...EMPTY_OVERLAYS, abilityTargets: targets }
          if (!locked && hover !== null && targets.some((s) => sameSquare(s, hover))) {
            if (spec?.kind === 'area3x3') area = area3x3(hover).filter((s) => squareExists(s))
            const picks = [...w.picks, pickAt(view, hover, spec)]
            area = [...area, ...splashSquares(view, unit, abilityId, picks)]
            if (picks.length === abilitySpecs(abilityId).length) chipForecast = abilityForecast(view, unit.id, abilityId, picks)
          }
          if (locked) area = splashSquares(view, unit, abilityId, w.picks)
          break
        }
        case 'move':
        case 'defend':
          break
      }
      if (locked) {
        const intent = state.intent
        if (intent.kind === 'move') {
          overlays = { ...overlays, path: [...intent.path] }
          const dest = intent.path[intent.path.length - 1]
          if (dest !== undefined) {
            visionPreview = lovSquares(dest, unit.size, unit.lov).filter((s) => squareExists(s))
            selectedSquare = dest
          }
        }
        hazards = state.hazards.length > 0 ? [...state.hazards] : hazards
        const last = w.picks[w.picks.length - 1]
        if (last !== undefined) selectedSquare = targetSquares(view, [last])[0] ?? selectedSquare
      }
      break
    }
    case 'submitting':
      selectedId = state.unitId
      if (state.intent.kind === 'move' || state.intent.kind === 'charge') overlays = { ...EMPTY_OVERLAYS, path: [...state.intent.path] }
      break
  }

  const forecast = forecastFor(view, state)
  const playback = snap.playback
  const extras: BoardExtras = {
    ghosts: settings.lastSeenMarkers ? snap.ghosts.ghosts : [],
    floaters: playback.floaters,
    flashes: playback.flashes,
    focus: (settings.followEnemyActions ? playback.focus : null) ?? ui.focus,
    hazards,
    picked,
    area,
    highlight: ui.highlight,
    hover,
    chips: chipsFor(view, forecast ?? chipForecast),
    ready: new Set(myTurn ? readyUnits(view).map((u) => u.id) : []),
    highlightReady: settings.highlightReady,
    captureRing,
    visionPreview,
    threat: ui.threat ? threatSquares(view) : [],
    clarity: settings.clarityMode,
    coordinates: settings.coordinates,
    reducedMotion,
    animationSpeed: settings.animationSpeed,
  }
  return { selection: { unitId: selectedId, square: selectedSquare }, overlays, extras, forecast }
}

/** The pick a hovered square would make for this spec (a unit pick names the unit standing there). */
function pickAt(view: PlayerView, square: Square, spec: TargetSpec | undefined): AbilityTarget {
  const unit = spec?.kind === 'unit' ? unitAt(view, square) : undefined
  return unit === undefined ? { kind: 'square', square } : { kind: 'unit', unitId: unit.id }
}
