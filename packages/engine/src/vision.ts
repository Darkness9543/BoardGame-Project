// Vision and detection (RULES_INTERPRETATION 4.1-4.6). Pure functions over a RulesQuery, so the authority
// and a client (on its own view) compute the same areas. State-based reveals live in resolve.ts.

import { liveAbility } from './abilities/registry'
import type { Detection } from './abilities/types'
import { lovSquares, footprintSquares, neighbourOffsets, SQUARE_COUNT, squareExists, squareIndex } from './geometry'
import type { MineCore, RulesQuery } from './query'
import type { Seat, Square, UnitCore } from './types'

/**
 * A1-03 / A1-12 / R36: squares inside a unit's LOV. Without sight blockers it is the Manhattan diamond(s); with
 * them (`blocksSight`, per VISION_OCCLUSION), it is a flood fill of orthogonal steps within the LOV radius that
 * sees a blocking square but doesn't pass it.
 */
export function lovIndices(anchor: Square, size: number, lov: number, blocksSight: ((s: Square) => boolean) | null): number[] {
  const diamond = lovSquares(anchor, size, lov)
  if (blocksSight === null || !diamond.some(blocksSight)) return diamond.map(squareIndex)
  const seen = new Set<number>()
  const queue: { s: Square; d: number }[] = footprintSquares(anchor, size).map((s) => ({ s, d: 0 }))
  for (const item of queue) seen.add(squareIndex(item.s))
  while (queue.length > 0) {
    const cur = queue.shift()
    if (cur === undefined) break
    if (cur.d >= lov || (cur.d > 0 && blocksSight(cur.s))) continue
    for (const o of neighbourOffsets('ORTHO_4')) {
      const next = { x: cur.s.x + o.x, y: cur.s.y + o.y }
      const k = squareIndex(next)
      if (!squareExists(next) || seen.has(k)) continue
      seen.add(k)
      queue.push({ s: next, d: cur.d + 1 })
    }
  }
  return [...seen]
}

export function unitLovIndices(q: RulesQuery, unit: UnitCore): number[] {
  if (unit.anchor === null) return []
  return lovIndices(unit.anchor, q.sizeOf(unit), q.stats(unit).lov, q.hasSightBlockers() ? (s) => q.blocksSight(s) : null)
}

/** Whether `square` is inside `viewer`'s LOV. */
export function lovContains(q: RulesQuery, viewer: UnitCore, square: Square): boolean {
  if (viewer.anchor === null) return false
  if (!q.hasSightBlockers()) return q.distance(viewer, square) <= q.stats(viewer).lov
  return unitLovIndices(q, viewer).includes(squareIndex(square))
}

/** A4-01: a seat's vision = union of its placed units' LOV (commander and dummies included). 1 = visible. */
export function visionMask(q: RulesQuery, seat: Seat): Uint8Array {
  const mask = new Uint8Array(SQUARE_COUNT)
  for (const unit of q.units()) {
    if (unit.owner !== seat) continue
    for (const index of unitLovIndices(q, unit)) mask[index] = 1
  }
  return mask
}

export function maskHas(mask: Uint8Array, square: Square): boolean {
  return mask[squareIndex(square)] === 1
}

/** A4-03: visible = inside vision and not invisible to that seat; own units are always visible (A4-04). */
export function unitVisibleTo(q: RulesQuery, seat: Seat, unit: UnitCore, mask: Uint8Array): boolean {
  if (unit.owner === seat) return true
  if (unit.anchor === null || unit.stealthed) return false
  return q.footprint(unit).some((s) => maskHas(mask, s))
}

/** A4-05 / A4-11: a mine is visible to its owner, and to the opponent once revealed and in vision. */
export function mineVisibleTo(seat: Seat, mine: MineCore, mask: Uint8Array): boolean {
  return mine.owner === seat || (mine.revealed && maskHas(mask, mine.square))
}

/** Units of `watcher` whose LOV contains any of `squares` (Stealth activation A4-05, reveal R2 A4-07). */
export function watchersOf(q: RulesQuery, watcher: Seat, squares: readonly Square[]): UnitCore[] {
  return q.units().filter((u) => u.owner === watcher && squares.some((s) => lovContains(q, u, s)))
}

/** The detection areas a unit projects (Mind's Eye, Ratasius; A4-08). */
export function detectionsOf(q: RulesQuery, unit: UnitCore): Detection[] {
  const out: Detection[] = []
  for (const id of q.abilitiesOf(unit)) {
    const detection = liveAbility(id)?.detection?.(q, unit)
    if (detection !== undefined && detection !== null) out.push(detection)
  }
  return out
}

export function detects(q: RulesQuery, detector: UnitCore, square: Square): boolean {
  return detectionsOf(q, detector).some((d) =>
    d.kind === 'lov' ? lovContains(q, detector, square) : q.distance(detector, square) <= d.range,
  )
}

/** The first unit of `seat` that detects any of `squares`, if any. */
export function detectorOf(q: RulesQuery, seat: Seat, squares: readonly Square[]): UnitCore | undefined {
  return q.units().find((u) => u.owner === seat && squares.some((s) => detects(q, u, s)))
}
