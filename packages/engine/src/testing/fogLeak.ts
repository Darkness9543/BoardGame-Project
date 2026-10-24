// Fog-leak detector (NC 7.19): walks a PlayerView's JSON and lists anything the seat may not know, with
// the JSON path where it appears. Returns [] when the view is clean. Used by the view tests and the
// random-playout property test.
//
// Disclosures by design are allowed: a take-back request shows the requester's own action to the decider (9 TB-4:
// "Request to take back: Paladin 2 moved E5 -> E8?"); AP totals (R15) and army lists from deployment (R33) are public.

import { ARMY_LISTS_PUBLIC, SHOW_OPPONENT_AP } from '../constants'
import { squareIndex } from '../geometry'
import { StateQuery } from '../query'
import type { GameState, Seat } from '../types'
import { projectView, type PlayerView } from '../view'
import { unitVisibleTo, visionMask } from '../vision'

const ALLOWED_PATH_PREFIXES = ['$.takeback.request.action']

interface Found {
  readonly strings: Map<string, string>
  readonly anchors: Map<number, string>
}

function walk(value: unknown, path: string, found: Found): void {
  if (ALLOWED_PATH_PREFIXES.some((p) => path.startsWith(p))) return
  if (typeof value === 'string') {
    if (!found.strings.has(value)) found.strings.set(value, path)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, found))
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const [key, v] of Object.entries(value)) {
    if (!found.strings.has(key)) found.strings.set(key, `${path}.${key} (key)`)
    if (key === 'anchor' && v !== null && typeof v === 'object' && 'x' in v && 'y' in v) {
      const s = v as { x: unknown; y: unknown }
      if (typeof s.x === 'number' && typeof s.y === 'number') found.anchors.set(squareIndex({ x: s.x, y: s.y }), `${path}.anchor`)
    }
    walk(v, `${path}.${key}`, found)
  }
}

export function findLeaks(state: GameState, seat: Seat, view: PlayerView = projectView(state, seat)): string[] {
  if (state.phase === 'ended') return []
  const leaks: string[] = []
  const q = new StateQuery(state)
  const mask = visionMask(q, seat)
  const found: Found = { strings: new Map(), anchors: new Map() }
  walk(JSON.parse(JSON.stringify(view)) as unknown, '$', found)

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
