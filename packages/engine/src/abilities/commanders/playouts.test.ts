// Random legal playouts with every commander and every Baba Yaga variant, against the real unit abilities: after each
// intent the state stays JSON-safe, consistent and fog-safe for both seats, and the log replays to the same state.

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { validateIntent, type Intent } from '../../commands'
import { footprintSquares, squareExists, squareIndex } from '../../geometry'
import { hashState, replay, startRecord, submit } from '../../history'
import { attackTargets, reachableSquares, targetOptions } from '../../preview'
import { StateQuery } from '../../query'
import { isTerrain } from '../../state'
import { buildBattle, type Placement } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import type { AbilityTarget } from '../types'
import type { CommanderId, GameState, RosterUnitId, Seat, UnitTypeId } from '../../types'
import { projectView } from '../../view'
import { liveAbility } from '../registry'

const LEADERS: readonly { readonly commander: CommanderId; readonly variant?: string }[] = [
  { commander: 'trill' },
  { commander: 'kulega' },
  { commander: 'sabrina' },
  { commander: 'babaYaga', variant: 'mend' },
  { commander: 'babaYaga', variant: 'hex-ward' },
  { commander: 'babaYaga', variant: 'cauldron' },
  { commander: 'ratasius' },
  { commander: 'queso' },
]
const ROSTERS: readonly (readonly (RosterUnitId | 'noAcb')[])[] = [
  ['footman', 'footman', 'soldier', 'berserker', 'priestess', 'paladin', 'royalWizard', 'emissary'],
  ['mercenary', 'mercenary', 'ranger', 'rogue', 'juliomancer', 'artificer', 'beast', 'noAcb'],
]

function actor(state: GameState): Seat | null {
  if (state.phase === 'ended') return null
  return state.decisions[0]?.seat ?? state.turn?.activeSeat ?? null
}

/** Picks for an ability with one or two target specs, from the declarative candidates (validateIntent filters them). */
function abilityPicks(view: ReturnType<typeof projectView>, unitId: string, abilityId: string): AbilityTarget[][] {
  const count = liveAbility(abilityId)?.active?.targets.length ?? 0
  const first = targetOptions(view, unitId, abilityId, 0, []).slice(0, 3)
  if (count === 0) return [[]]
  if (count === 1) return first.map((t) => [t])
  const second = targetOptions(view, unitId, abilityId, 1, []).slice(0, 3)
  return first.flatMap((a) => second.map((b) => [a, b]))
}

function candidates(state: GameState, seat: Seat): Intent[] {
  const view = projectView(state, seat)
  const decision = view.decision
  if (decision !== null) return decision.options.map((o) => ({ kind: 'respondDecision', decisionId: decision.id, choice: o.id }))
  const out: Intent[] = [{ kind: 'endTurn' }]
  for (const unit of view.units) {
    if (unit.owner !== seat || unit.anchor === null) continue
    out.push({ kind: 'defend', unitId: unit.id })
    for (const reach of reachableSquares(view, unit.id).slice(0, 4)) out.push({ kind: 'move', unitId: unit.id, path: reach.path })
    for (const target of attackTargets(view, unit.id).slice(0, 3)) out.push({ kind: 'attack', unitId: unit.id, target })
    for (const abilityId of unit.own?.abilities ?? []) {
      const active = liveAbility(abilityId)?.active
      if (active === undefined || active.targets.some((t) => t.kind === 'connectedSquares')) continue // Forcefield shapes are not enumerated
      for (const targets of abilityPicks(view, unit.id, abilityId)) out.push({ kind: 'useAbility', unitId: unit.id, abilityId, targets })
    }
  }
  return out.filter((intent) => validateIntent(view, intent).ok)
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
    if (unit.toughness <= 0) problems.push(`${unit.id} alive at ${unit.toughness}`)
    if (unit.toughness > q.stats(unit).maxToughness) problems.push(`${unit.id} above max`)
    if (q.stats(unit).baseToughness < 1) problems.push(`${unit.id} base toughness below 1`)
  }
  for (const seat of ['host', 'guest'] as const) {
    if (state.seats[seat].ap < 0) problems.push(`${seat} AP negative`)
    if (Object.values(state.seats[seat].turnCounters).some((n) => n < 0)) problems.push(`${seat} negative turn counter`)
  }
  return problems
}


const placementArb = fc.record({ slot: fc.nat(7), x: fc.integer({ min: 1, max: 22 }), row: fc.integer({ min: 0, max: 2 }) })

describe('random playouts with every commander (fast-check)', () => {
  it('keep the state consistent and fog-safe and replay exactly', () => {
    fc.assert(
      fc.property(
        fc.nat(LEADERS.length - 1),
        fc.nat(LEADERS.length - 1),
        fc.nat(1),
        fc.array(placementArb, { minLength: 2, maxLength: 6 }),
        fc.array(placementArb, { minLength: 2, maxLength: 6 }),
        fc.array(fc.nat(), { minLength: 20, maxLength: 50 }),
        (southLeader, northLeader, southRoster, southUnits, northUnits, choices) => {
          const open = buildBattle().state
          const used = new Set<number>([squareIndex({ x: 12, y: 8 }), squareIndex({ x: 12, y: 15 })])
          const place = (units: typeof southUnits, roster: readonly UnitTypeId[], baseRow: number, dir: number): Placement[] =>
            units.flatMap((u) => {
              const type = roster[u.slot % roster.length] ?? 'footman'
              const anchor = { x: u.x, y: baseRow + dir * u.row }
              const squares = footprintSquares(anchor, type === 'beast' ? 2 : 1)
              if (squares.some((s) => used.has(squareIndex(s)) || !squareExists(s) || isTerrain(open, s))) return []
              for (const s of squares) used.add(squareIndex(s))
              return [{ type, at: anchor }]
            })
          const south = LEADERS[southLeader] ?? { commander: 'trill' }
          const north = LEADERS[northLeader] ?? { commander: 'queso' }
          const b = buildBattle({
            south: ['commander@M9', ...place(southUnits, ROSTERS[southRoster] ?? [], 11, -1)],
            north: ['commander@M16', ...place(northUnits, ROSTERS[1 - southRoster] ?? [], 12, 1)],
            commanders: { south: south.commander, north: north.commander },
            variants: { ...(south.variant === undefined ? {} : { south: south.variant }), ...(north.variant === undefined ? {} : { north: north.variant }) },
          })
          let record = startRecord(b.state)
          for (const choice of choices) {
            const seat = actor(record.state)
            if (seat === null) break
            const options = candidates(record.state, seat)
            // Prefer fights and abilities half the time, so playouts reach deaths, revives and returns.
            const busy = options.filter((i) => i.kind === 'attack' || i.kind === 'useAbility')
            const intent = choice % 2 === 0 && busy.length > 0 ? busy[(choice >> 1) % busy.length] : options[choice % options.length]
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
      { numRuns: 40, seed: 20261024 },
    )
  })
})
