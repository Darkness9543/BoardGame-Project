// Fog-leak detector (NC 7.19): walks a PlayerView's JSON and lists anything the seat may not know, with
// the JSON path where it appears. Returns [] when the view is clean. Used by the view tests and the
// random-playout property test.
//
// Disclosures by design are allowed: a take-back request shows the requester its own action (the decider gets it only
// as far as it saw it, 9 TB-4, and is checked like the rest of its view); AP totals (R15) and army lists from
// deployment (R33) are public.

import { ARMY_LISTS_PUBLIC, SHOW_OPPONENT_AP } from '../constants'
import { unitsNamed } from '../disclosure'
import type { GameEvent, VisibleEvent } from '../events'
import { squareIndex } from '../geometry'
import { StateQuery } from '../query'
import type { GameState, Seat, UnitId } from '../types'
import { filterEvents, projectView, type PlayerView } from '../view'
import { unitVisibleTo, visionMask } from '../vision'

/** The requester's own action in its take-back request: nothing in it is news to the requester. */
const OWN_REQUEST_PREFIX = '$.takeback.request.action'
/**
 * While the game runs the view's fallen list holds only the seat's own dead units, so their last squares are the seat's
 * own knowledge, even when a hidden enemy stands there later; enemy entries in it are reported separately.
 */
const OWN_FALLEN_PREFIX = '$.fallen'

interface Found {
  readonly strings: Map<string, string>
  readonly anchors: Map<number, string>
}

function walk(value: unknown, path: string, found: Found, skip: readonly string[]): void {
  if (skip.some((p) => path.startsWith(p))) return
  if (typeof value === 'string') {
    if (!found.strings.has(value)) found.strings.set(value, path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, found, skip))
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const [key, v] of Object.entries(value)) {
    if (!found.strings.has(key)) found.strings.set(key, `${path}.${key} (key)`)
    if (key === 'anchor' && !path.startsWith(OWN_FALLEN_PREFIX) && v !== null && typeof v === 'object' && 'x' in v && 'y' in v) {
      const s = v as { x: unknown; y: unknown }
      if (typeof s.x === 'number' && typeof s.y === 'number') found.anchors.set(squareIndex({ x: s.x, y: s.y }), `${path}.anchor`)
    }
    walk(v, `${path}.${key}`, found, skip)
  }
}

/** The unit an event is about; each such event reaches only the seats that could see that unit when it happened. */
function subjectOf(e: VisibleEvent): UnitId | null {
  switch (e.type) {
    case 'unitAttacked':
    case 'attackMissed':
      return e.attackerId
    case 'unitMoved':
    case 'moveEnded':
    case 'defendChanged':
    case 'abilityUsed':
    case 'unitDamaged':
    case 'unitHealed':
    case 'toughnessLost':
    case 'maxToughnessChanged':
    case 'unitDied':
    case 'unitRevived':
    case 'unitCreated':
    case 'unitRevealed':
      return e.unitId
    default:
      return null
  }
}

/**
 * The same check over the events one resolution sent `seat`: every unit an event names must be the seat's own, seen by
 * it before or after, or the subject of one of those events (seen at that moment). A dealer, creator or mine victim
 * the seat never saw is a leak (A4-12, 4.8).
 */
export function findEventLeaks(before: GameState, after: GameState, seat: Seat, events: readonly GameEvent[]): string[] {
  if (after.phase === 'ended') return []
  const delivered = filterEvents(events, seat)
  const known = new Set<UnitId>([...projectView(before, seat).units, ...projectView(after, seat).units].map((u) => u.id))
  for (const e of delivered) {
    const subject = subjectOf(e)
    if (subject !== null) known.add(subject)
  }
  const own = (id: UnitId): boolean =>
    [before, after].some((s) => s.units.some((u) => u.id === id && u.owner === seat) || s.fallen.some((f) => f.unit.id === id && f.unit.owner === seat))
  const leaks: string[] = []
  for (const e of delivered) for (const id of unitsNamed(e)) if (!known.has(id) && !own(id)) leaks.push(`${e.type} names unseen unit ${id}`)
  return leaks
}

export function findLeaks(state: GameState, seat: Seat, view: PlayerView = projectView(state, seat)): string[] {
  if (state.phase === 'ended') return []
  const leaks: string[] = []
  const q = new StateQuery(state)
  const mask = visionMask(q, seat)
  const found: Found = { strings: new Map(), anchors: new Map() }
  walk(JSON.parse(JSON.stringify(view)) as unknown, '$', found, view.takeback.request?.requester === seat ? [OWN_REQUEST_PREFIX] : [])

  for (const unit of state.units) {
    if (unit.owner === seat) continue
    if (state.phase === 'battle' && unitVisibleTo(q, seat, unit, mask)) continue
    const at = found.strings.get(unit.id)
    if (at !== undefined) leaks.push(`hidden unit id ${unit.id} at ${at}`)
    const anchorAt = unit.anchor === null ? undefined : found.anchors.get(squareIndex(unit.anchor))
    if (anchorAt !== undefined) leaks.push(`hidden unit position of ${unit.id} at ${anchorAt}`)
  }
  for (const fallen of state.fallen) {
    if (fallen.unit.owner !== seat && view.fallen.some((f) => f.id === fallen.unit.id)) leaks.push(`enemy fallen unit ${fallen.unit.id}`)
  }
  for (const mine of state.mines) {
    const visible = mine.owner === seat || (mine.revealed && mask[squareIndex(mine.square)] === 1)
    const at = found.strings.get(mine.id)
    if (!visible && at !== undefined) leaks.push(`hidden mine ${mine.id} at ${at}`)
  }
  for (const unit of view.units) {
    if (unit.owner !== seat && unit.own !== null) leaks.push(`own-only details of enemy ${unit.id}`)
    if (unit.owner !== seat && unit.stealthed) leaks.push(`stealth status of enemy ${unit.id}`)
  }
  if (!SHOW_OPPONENT_AP && view.opponentAp !== null) leaks.push('opponent AP')
  const head = state.decisions[0]
  if (head !== undefined && head.seat !== seat && found.strings.has(head.id)) leaks.push('opponent decision id')
  if (view.armies !== null && (!ARMY_LISTS_PUBLIC || state.phase === 'lobby')) leaks.push('army lists before they are public')
  return leaks
}
