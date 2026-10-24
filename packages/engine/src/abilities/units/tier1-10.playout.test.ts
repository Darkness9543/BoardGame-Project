// Random legal playouts with the tier-1 to tier-10 units' abilities (Footman, Mercenary, Soldier, Ranger, Berserker,
// Rogue, Priestess, Juliomancer): Stealth, Assault and its target prompt, Savagery, auras, Shared wounds and Julio
// Vernification must keep the state consistent, every view fog-safe and the log replayable.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { liveAbility } from '../registry'
import type { AbilityTarget } from '../types'
import { validateIntent, type Intent } from '../../commands'
import { abilityData, hasAbilityData } from '../../content/abilities'
import { footprintSquares, squareExists, squareIndex } from '../../geometry'
import { hashState, replay, startRecord, submit } from '../../history'
import { attackTargets, reachableSquares, targetOptions } from '../../preview'
import { StateQuery } from '../../query'
import { isTerrain } from '../../state'
import { buildBattle, type PlacementSpec } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import type { GameState, RosterUnitId, Seat } from '../../types'
import { projectView, type PlayerView } from '../../view'

const TYPES: readonly RosterUnitId[] = ['footman', 'mercenary', 'soldier', 'ranger', 'berserker', 'rogue', 'priestess', 'juliomancer']

function actor(state: GameState): Seat | null {
  if (state.phase === 'ended') return null
  return state.decisions[0]?.seat ?? state.turn?.activeSeat ?? null
}

/** Every combination of the first few candidates for each pick (validateIntent keeps the legal ones). */
function picks(view: PlayerView, unitId: string, abilityId: string, count: number): AbilityTarget[][] {
  let combos: AbilityTarget[][] = [[]]
  for (let index = 0; index < count; index++) {
    const options = targetOptions(view, unitId, abilityId, index, []).slice(0, 4)
    combos = combos.flatMap((combo) => options.map((o) => [...combo, o]))
  }
  return combos
}

function candidates(state: GameState, seat: Seat): Intent[] {
  const view = projectView(state, seat)
  if (view.decision !== null) return view.decision.options.map((o) => ({ kind: 'respondDecision', decisionId: view.decision?.id ?? '', choice: o.id }))
  const out: Intent[] = [{ kind: 'endTurn' }]
  const forward = (y: number): number => (view.side === 'south' ? y : -y)
  for (const unit of view.units) {
    if (unit.owner !== seat || unit.anchor === null) continue
    out.push({ kind: 'defend', unitId: unit.id })
    // The squares furthest towards the enemy, so that the armies meet.
    const reach = reachableSquares(view, unit.id).sort((a, b) => forward(b.anchor.y) - forward(a.anchor.y))
    for (const r of reach.slice(0, 4)) out.push({ kind: 'move', unitId: unit.id, path: r.path })
    for (const target of attackTargets(view, unit.id).slice(0, 3)) out.push({ kind: 'attack', unitId: unit.id, target })
    for (const abilityId of unit.own?.abilities ?? []) {
      if (!hasAbilityData(abilityId) || abilityData(abilityId).kind !== 'active') continue
      const count = liveAbility(abilityId)?.active?.targets.length ?? 0
      for (const targets of picks(view, unit.id, abilityId, count)) out.push({ kind: 'useAbility', unitId: unit.id, abilityId, targets })
    }
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
    // A4-06 (R1): a stealthed unit is never next to an enemy once a resolution has settled.
    if (unit.stealthed && q.adjacentUnits(unit).some((u) => u.owner !== unit.owner)) problems.push(`${unit.id} stealthed next to an enemy`)
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

describe('random legal playouts with tier 1-10 abilities (fast-check)', () => {
  it('keep the state consistent, every view fog-safe and the log replayable', () => {
    fc.assert(
      fc.property(
        fc.array(placementArb, { minLength: 2, maxLength: 7 }),
        fc.array(placementArb, { minLength: 2, maxLength: 7 }),
        fc.array(fc.nat(), { minLength: 30, maxLength: 90 }),
        (southUnits, northUnits, choices) => {
          const open = buildBattle().state
          const used = new Set<number>()
          const place = (units: typeof southUnits, baseRow: number, dir: number): PlacementSpec[] =>
            units.flatMap((u) => {
              const at = { x: u.x, y: baseRow + dir * u.row }
              if (used.has(squareIndex(at)) || !squareExists(at) || isTerrain(open, at)) return []
              used.add(squareIndex(at))
              return [{ type: u.type, at, stealthed: u.type === 'rogue' && u.stealthed }]
            })
          // The fronts start two rows apart, so that most playouts reach contact at once.
          const b = buildBattle({ south: ['commander@M2', ...place(southUnits, 11, -1)], north: ['commander@M24', ...place(northUnits, 13, 1)] })
          let record = startRecord(b.state)
          for (const choice of choices) {
            const seat = actor(record.state)
            if (seat === null) break
            const options = candidates(record.state, seat)
            // Prefer abilities a third of the time and attacks another third, so playouts reach stealth, ambushes,
            // Savagery and sacrifices; moves and the rest fill the remainder.
            const abilities = options.filter((i) => i.kind === 'useAbility')
            const attacks = options.filter((i) => i.kind === 'attack')
            const preferred = choice % 3 === 0 ? abilities : choice % 3 === 1 ? attacks : options
            const pool = preferred.length > 0 ? preferred : options
            const intent = pool[Math.floor(choice / 3) % pool.length]
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
