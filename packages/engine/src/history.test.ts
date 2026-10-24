import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { validateIntent, type Intent } from './commands'
import { footprintSquares, squareExists, squareIndex } from './geometry'
import { hashState, replay, restoreRecord, serializeRecord, startRecord, submit, type MatchRecord } from './history'
import { attackTargets, reachableSquares } from './preview'
import { isTerrain } from './state'
import { StateQuery } from './query'
import { buildBattle, sqs, startMatch, type Placement } from './testing/dsl'
import { findLeaks } from './testing/fogLeak'
import type { GameState, RosterUnitId, Seat } from './types'
import { projectView } from './view'

function must(record: MatchRecord, seat: Seat, intent: Intent): MatchRecord {
  const result = submit(record, seat, intent)
  if (!result.ok) throw new Error(`${intent.kind}: ${result.code} ${result.message}`)
  return result.record
}

/** State equality for take-backs: everything except the take-back bookkeeping (A9-02, TB-7). */
function withoutTakebackMeta(state: GameState): string {
  return hashState({ ...state, takeback: { request: null, declined: [], used: { host: 0, guest: 0 } } })
}

describe('take-back (section 9)', () => {
  const battle = () => buildBattle({ south: ['paladin@E5:P', 'soldier@G5:S'], north: ['soldier@E9:N', 'footman@P20'] })

  it('restores the exact state before the undone action, with everything it caused (TB-2, TB-6)', () => {
    const b = battle()
    let record = startRecord(b.state)
    const before = record.state
    record = must(record, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6', 'E7') })
    expect(projectView(record.state, b.south).units.some((u) => u.id === b.id('N'))).toBe(true) // the move revealed it
    record = must(record, b.south, { kind: 'requestTakeback' })
    expect(record.state.takeback.request).toMatchObject({ requester: b.south, actionSeq: 1, revealedUnits: [b.id('N')] }) // TB-5
    record = must(record, b.north, { kind: 'acceptTakeback' })
    expect(withoutTakebackMeta(record.state)).toBe(withoutTakebackMeta(before))
    expect(record.state.takeback.used[b.south]).toBe(1)
  })

  it('undoes step by step back to the start of the turn, never past an opponent action (TB-3)', () => {
    const b = battle()
    let record = startRecord(b.state)
    record = must(record, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('D5') })
    record = must(record, b.south, { kind: 'defend', unitId: b.id('S') })
    record = must(record, b.south, { kind: 'requestTakeback' })
    record = must(record, b.north, { kind: 'acceptTakeback' })
    expect(record.state.units.find((u) => u.id === b.id('S'))?.defending).toBe(false)
    record = must(record, b.south, { kind: 'requestTakeback' })
    record = must(record, b.north, { kind: 'acceptTakeback' })
    expect(withoutTakebackMeta(record.state)).toBe(withoutTakebackMeta(b.state))
    expect(projectView(record.state, b.south).takeback.canRequest).toBe(false)
  })

  it('lets End Turn be undone until the opponent acts (TB-3)', () => {
    const b = battle()
    let record = startRecord(b.state)
    record = must(record, b.south, { kind: 'endTurn' })
    expect(projectView(record.state, b.south).takeback.canRequest).toBe(true)
    const undone = must(must(record, b.south, { kind: 'requestTakeback' }), b.north, { kind: 'acceptTakeback' })
    expect(undone.state.turn?.activeSeat).toBe(b.south)
    record = must(record, b.north, { kind: 'endTurn' })
    expect(projectView(record.state, b.south).takeback.canRequest).toBe(false)
  })

  it('refuses a declined action again and blocks the requester while a request is pending (TB-4, TB-7)', () => {
    const b = battle()
    let record = startRecord(b.state)
    record = must(record, b.south, { kind: 'defend', unitId: b.id('S') })
    record = must(record, b.south, { kind: 'requestTakeback' })
    expect(submit(record, b.south, { kind: 'defend', unitId: b.id('P') })).toMatchObject({ ok: false, code: 'TAKEBACK_PENDING' })
    expect(submit(record, b.south, { kind: 'acceptTakeback' })).toMatchObject({ ok: false, code: 'NO_TAKEBACK_REQUEST' })
    record = must(record, b.north, { kind: 'declineTakeback' })
    expect(submit(record, b.south, { kind: 'requestTakeback' })).toMatchObject({ ok: false, code: 'TAKEBACK_UNAVAILABLE' })
  })

  it('honours the lobby switch and the per-game limit (TB-1, TB-7) and ends with the game (A9-05)', () => {
    const off = buildBattle({ settings: { takebacks: false }, south: ['soldier@G5:S'] })
    const r = must(startRecord(off.state), off.south, { kind: 'defend', unitId: off.id('S') })
    expect(submit(r, off.south, { kind: 'requestTakeback' })).toMatchObject({ ok: false, code: 'TAKEBACK_UNAVAILABLE' })
    const limited = buildBattle({ settings: { takebacksPerGame: 0 }, south: ['soldier@G5:S'] })
    const r2 = must(startRecord(limited.state), limited.south, { kind: 'defend', unitId: limited.id('S') })
    expect(projectView(r2.state, limited.south).takeback).toMatchObject({ canRequest: false, remaining: 0 })
    const ended = must(must(startRecord(battle().state), 'host', { kind: 'defend', unitId: battle().id('S') }), 'guest', { kind: 'resign' })
    expect(submit(ended, 'host', { kind: 'requestTakeback' })).toMatchObject({ ok: false, code: 'GAME_OVER' })
  })
})

describe('replay, snapshot and restore (5.6)', () => {
  it('replays a full lobby-to-battle record to the identical state and restores it from JSON', () => {
    let record = startMatch({ armies: { host: { faction: 'empire', commander: 'trill', units: { paladin: 1, soldier: 2 } }, guest: { faction: 'lojrar', commander: 'babaYaga', variant: 'hex-ward', units: { ranger: 2, beast: 1 } } } })
    const south = record.state.southSeat ?? 'host'
    record = must(record, south, { kind: 'endTurn' })
    const replayed = replay(record.initial, record.log)
    expect(replayed).toEqual(record.state)
    expect(hashState(replayed)).toBe(hashState(record.state))
    const restored = restoreRecord(serializeRecord(record))
    expect(hashState(restored.state)).toBe(hashState(record.state))
    expect(restored.log).toEqual(record.log)
  })
})

// ---------------------------------------------------------------- property-based playouts

const TYPES: readonly RosterUnitId[] = ['footman', 'mercenary', 'soldier', 'ranger', 'berserker', 'rogue', 'paladin', 'beast', 'priestess', 'artificer']

function actor(state: GameState): Seat | null {
  if (state.phase === 'ended') return null
  const head = state.decisions[0]
  if (head !== undefined) return head.seat
  const request = state.takeback.request
  if (request !== null) return request.requester === 'host' ? 'guest' : 'host'
  return state.turn?.activeSeat ?? null
}

function candidates(state: GameState, seat: Seat): Intent[] {
  const view = projectView(state, seat)
  if (view.decision !== null) return view.decision.options.map((o) => ({ kind: 'respondDecision', decisionId: view.decision?.id ?? '', choice: o.id }))
  if (view.takeback.request !== null) return [{ kind: 'acceptTakeback' }, { kind: 'declineTakeback' }]
  const out: Intent[] = [{ kind: 'endTurn' }]
  if (view.takeback.canRequest) out.push({ kind: 'requestTakeback' })
  for (const unit of view.units) {
    if (unit.owner !== seat || unit.anchor === null) continue
    out.push({ kind: 'defend', unitId: unit.id })
    for (const reach of reachableSquares(view, unit.id).slice(0, 6)) out.push({ kind: 'move', unitId: unit.id, path: reach.path })
    for (const target of attackTargets(view, unit.id).slice(0, 4)) out.push({ kind: 'attack', unitId: unit.id, target })
    // R26 Charge: one step, then any visible enemy (validateIntent keeps the legal ones).
    for (const reach of reachableSquares(view, unit.id).filter((x) => x.path.length === 1).slice(0, 4)) {
      for (const enemy of view.units.filter((u) => u.owner !== seat).slice(0, 3)) {
        out.push({ kind: 'charge', unitId: unit.id, path: reach.path, target: { kind: 'unit', unitId: enemy.id } })
      }
    }
    // R27 Group march: the unit with an adjacent own neighbour, one step in each direction.
    const buddy = view.units.find((u) => u.owner === seat && u.id !== unit.id && u.anchor !== null && Math.abs(u.anchor.x - (unit.anchor?.x ?? 0)) + Math.abs(u.anchor.y - (unit.anchor?.y ?? 0)) === 1)
    for (const direction of ['north', 'east', 'south', 'west'] as const) {
      out.push({ kind: 'groupMarch', unitIds: buddy === undefined ? [unit.id] : [unit.id, buddy.id], direction })
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
    if (unit.toughness <= 0) problems.push(`${unit.id} alive at ${unit.toughness}`)
    if (unit.toughness > q.stats(unit).maxToughness) problems.push(`${unit.id} above max`)
  }
  for (const seat of ['host', 'guest'] as const) if (state.seats[seat].ap < 0) problems.push(`${seat} AP negative`)
  if (state.phase === 'battle' && ['host', 'guest'].some((seat) => !state.units.some((u) => u.owner === seat && u.type === 'commander'))) problems.push('commander missing')
  return problems
}

const placementArb = fc.record({ type: fc.constantFrom(...TYPES), x: fc.integer({ min: 1, max: 22 }), row: fc.integer({ min: 0, max: 2 }) })

describe('random legal playouts (fast-check, 8.3)', () => {
  it('replay equals live play; states stay JSON-safe, consistent and fog-safe at every step', () => {
    fc.assert(
      fc.property(
        fc.array(placementArb, { minLength: 1, maxLength: 5 }),
        fc.array(placementArb, { minLength: 1, maxLength: 5 }),
        fc.array(fc.nat(), { minLength: 10, maxLength: 60 }),
        (southUnits, northUnits, choices) => {
          const open = buildBattle().state
          const used = new Set<number>()
          const place = (units: typeof southUnits, baseRow: number, dir: number): Placement[] => {
            return units.flatMap((u) => {
              const anchor = { x: u.x, y: baseRow + dir * u.row }
              const squares = footprintSquares(anchor, u.type === 'beast' ? 2 : 1)
              if (squares.some((s) => used.has(squareIndex(s)) || !squareExists(s) || isTerrain(open, s))) return []
              for (const s of squares) used.add(squareIndex(s))
              return [{ type: u.type, at: anchor }]
            })
          }
          const b = buildBattle({ south: ['commander@M3', ...place(southUnits, 11, -1)], north: ['commander@M23', ...place(northUnits, 12, 1)] })
          let record = startRecord(b.state)
          for (const choice of choices) {
            const seat = actor(record.state)
            if (seat === null) break
            const options = candidates(record.state, seat)
            // Half the time, prefer an attack on a visible unit so playouts reach combat, deaths and wins.
            const fights = options.filter((i) => i.kind === 'attack' && i.target.kind === 'unit')
            const intent = choice % 2 === 0 && fights.length > 0 ? fights[(choice >> 1) % fights.length] : options[choice % options.length]
            if (intent === undefined) break
            const result = submit(record, seat, intent)
            if (!result.ok) throw new Error(`candidate rejected: ${result.code}`)
            record = result.record
            expect(JSON.parse(JSON.stringify(record.state))).toEqual(record.state)
            expect(invariants(record.state)).toEqual([])
            for (const viewer of ['host', 'guest'] as const) expect(findLeaks(record.state, viewer)).toEqual([])
          }
          expect(hashState(replay(record.initial, record.log))).toBe(hashState(record.state))
        },
      ),
      { numRuns: 25, seed: 20261024 },
    )
  })
})
