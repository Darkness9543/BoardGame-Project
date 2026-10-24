// Random legal playouts with the tier-20 to tier-100 units' abilities (Paladin, Artificer, Royal Wizard, Beast,
// Emissary, Scourge): mines, dummies, areas, splashes and sacrifices must keep the state consistent, every view
// fog-safe and the log replayable. Pre-stealthed Rogues are the hidden targets; their own abilities are stubbed
// here so that only the abilities above and the core are exercised.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import type { AbilityTarget } from '../types'
import { validateIntent, type Intent } from '../../commands'
import { abilityData, hasAbilityData } from '../../content/abilities'
import { footprintSquares, sameSquare, squareExists, squareIndex } from '../../geometry'
import { hashState, replay, startRecord, submit } from '../../history'
import { attackTargets, reachableSquares, targetOptions } from '../../preview'
import { StateQuery } from '../../query'
import { isTerrain } from '../../state'
import { buildBattle, type PlacementSpec } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import type { GameState, RosterUnitId, Seat } from '../../types'
import { projectView, type PlayerView } from '../../view'
import { liveAbility } from '../registry'

registerAbility({ id: 'rogue.stealth', status: 'stub' }, { replace: true })
registerAbility({ id: 'rogue.assault', status: 'stub' }, { replace: true })

const TYPES: readonly RosterUnitId[] = ['paladin', 'artificer', 'royalWizard', 'beast', 'emissary', 'scourge', 'soldier', 'rogue']

function actor(state: GameState): Seat | null {
  if (state.phase === 'ended') return null
  return state.decisions[0]?.seat ?? state.turn?.activeSeat ?? null
}

/** Forcefield picks: O-tetrominoes around the Wizard (validateIntent keeps the legal ones). */
function tetrominoes(view: PlayerView, unitId: string): AbilityTarget[] {
  const anchor = view.units.find((u) => u.id === unitId)?.anchor
  if (anchor == null) return []
  const out: AbilityTarget[] = []
  for (const dx of [-2, 0, 1]) {
    for (const dy of [-2, 0, 1]) {
      const s = { x: anchor.x + dx, y: anchor.y + dy }
      out.push({ kind: 'squares', squares: footprintSquares(s, 2) })
    }
  }
  return out
}

function abilityIntents(view: PlayerView, unitId: string): Intent[] {
  const out: Intent[] = []
  for (const abilityId of view.units.find((u) => u.id === unitId)?.own?.abilities ?? []) {
    if (!hasAbilityData(abilityId) || abilityData(abilityId).kind !== 'active') continue
    const specs = liveAbility(abilityId)?.active?.targets ?? []
    const picks: AbilityTarget[][] =
      specs.length === 0
        ? [[]]
        : specs.length > 1
          ? []
          : specs[0]?.kind === 'connectedSquares'
            ? tetrominoes(view, unitId).map((t) => [t])
            : targetOptions(view, unitId, abilityId, 0, []).slice(0, 6).map((t) => [t])
    for (const targets of picks) out.push({ kind: 'useAbility', unitId, abilityId, targets })
  }
  return out
}

function candidates(state: GameState, seat: Seat): Intent[] {
  const view = projectView(state, seat)
  if (view.decision !== null) return view.decision.options.map((o) => ({ kind: 'respondDecision', decisionId: view.decision?.id ?? '', choice: o.id }))
  const out: Intent[] = [{ kind: 'endTurn' }]
  for (const unit of view.units) {
    if (unit.owner !== seat || unit.anchor === null) continue
    out.push({ kind: 'defend', unitId: unit.id })
    for (const reach of reachableSquares(view, unit.id).slice(0, 4)) out.push({ kind: 'move', unitId: unit.id, path: reach.path })
    for (const target of attackTargets(view, unit.id).slice(0, 3)) out.push({ kind: 'attack', unitId: unit.id, target })
    out.push(...abilityIntents(view, unit.id))
  }
  return out.filter((i) => validateIntent(view, i).ok)
}

function invariants(state: GameState): string[] {
  const problems: string[] = []
  const q = new StateQuery(state)
  const taken = new Set<number>()
  for (const unit of state.units) {
    if (unit.anchor === null) continue
    for (const s of footprintSquares(unit.anchor, q.sizeOf(unit))) {
      if (!squareExists(s) || isTerrain(state, s)) problems.push(`${unit.id} off open ground`)
      if (taken.has(squareIndex(s))) problems.push(`overlap at ${s.x},${s.y}`)
      taken.add(squareIndex(s))
    }
    if (unit.toughness <= 0 || unit.toughness > q.stats(unit).maxToughness) problems.push(`${unit.id} at ${unit.toughness}`)
  }
  for (const mine of state.mines) {
    if (taken.has(squareIndex(mine.square))) problems.push(`live mine ${mine.id} under a unit`) // A8-16: entering sets it off
    if (state.mines.some((m) => m !== mine && sameSquare(m.square, mine.square))) problems.push(`two mines on one square`)
  }
  for (const area of state.areas) {
    if (state.seats[area.owner].ownTurns >= area.expiresAtOwnTurn) problems.push(`area ${area.id} outlived its duration`) // A2-23, A2-24
  }
  for (const seat of ['host', 'guest'] as const) if (state.seats[seat].ap < 0) problems.push(`${seat} AP negative`)
  return problems
}

const placementArb = fc.record({
  type: fc.constantFrom(...TYPES),
  x: fc.integer({ min: 2, max: 21 }),
  row: fc.integer({ min: 0, max: 3 }),
  stealthed: fc.boolean(),
})

describe('random legal playouts with tier 20-100 abilities (fast-check)', () => {
  it('keep the state consistent, every view fog-safe and the log replayable', () => {
    fc.assert(
      fc.property(
        fc.array(placementArb, { minLength: 2, maxLength: 6 }),
        fc.array(placementArb, { minLength: 2, maxLength: 6 }),
        fc.array(fc.nat(), { minLength: 20, maxLength: 60 }),
        (southUnits, northUnits, choices) => {
          const open = buildBattle().state
          const used = new Set<number>()
          const place = (units: typeof southUnits, baseRow: number, dir: number): PlacementSpec[] =>
            units.flatMap((u) => {
              const at = { x: u.x, y: baseRow + dir * u.row }
              const squares = footprintSquares(at, u.type === 'beast' ? 2 : 1)
              if (squares.some((s) => used.has(squareIndex(s)) || !squareExists(s) || isTerrain(open, s))) return []
              for (const s of squares) used.add(squareIndex(s))
              return [{ type: u.type, at, stealthed: u.type === 'rogue' && u.stealthed }]
            })
          const b = buildBattle({ south: ['commander@M2', ...place(southUnits, 10, -1)], north: ['commander@M24', ...place(northUnits, 14, 1)] })
          let record = startRecord(b.state)
          for (const choice of choices) {
            const seat = actor(record.state)
            if (seat === null) break
            const options = candidates(record.state, seat)
            // Half the time, prefer an ability so that playouts reach mines, dummies, areas and splashes.
            const abilities = options.filter((i) => i.kind === 'useAbility')
            const intent = choice % 2 === 0 && abilities.length > 0 ? abilities[(choice >> 1) % abilities.length] : options[choice % options.length]
            if (intent === undefined) break
            const result = submit(record, seat, intent)
            if (!result.ok) throw new Error(`candidate rejected: ${result.code} ${result.message}`)
            record = result.record
            expect(JSON.parse(JSON.stringify(record.state))).toEqual(record.state)
            expect(invariants(record.state)).toEqual([])
            for (const viewer of ['host', 'guest'] as const) expect(findLeaks(record.state, viewer)).toEqual([])
          }
          expect(hashState(replay(record.initial, record.log))).toBe(hashState(record.state))
        },
      ),
      { numRuns: 30, seed: 20261024 },
    )
  })
})
