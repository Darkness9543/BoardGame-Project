// The move-path arrow (research-ux-conventions 8.3): solid over seen ground, dashed and lighter where it enters
// fog, amber where it enters a known mine. A path is the move intent's anchor list with the start excluded.

import { footprintSquares, sameSquare, type Square } from '@coinduel/engine'
import { footprintCentre, type Point2 } from './coords'

export type PathRunKind = 'clear' | 'fog' | 'hazard'

export interface PathRun {
  readonly kind: PathRunKind
  /** Footprint centres, the first one shared with the previous run. */
  readonly points: readonly Point2[]
}

export interface PathKnowledge {
  readonly isVisible: (s: Square) => boolean
  readonly hasKnownMine: (s: Square) => boolean
}

/** The kind of one step, judged on the squares it newly enters. */
export function stepKind(from: Square, to: Square, size: number, knowledge: PathKnowledge): PathRunKind {
  const before = footprintSquares(from, size)
  const entered = footprintSquares(to, size).filter((s) => !before.some((b) => sameSquare(b, s)))
  if (entered.some(knowledge.hasKnownMine)) return 'hazard'
  if (entered.some((s) => !knowledge.isVisible(s))) return 'fog'
  return 'clear'
}

export function pathRuns(start: Square, path: readonly Square[], size: number, knowledge: PathKnowledge): PathRun[] {
  const runs: { kind: PathRunKind; points: Point2[] }[] = []
  let previous = start
  for (const next of path) {
    const kind = stepKind(previous, next, size, knowledge)
    const last = runs[runs.length - 1]
    if (last !== undefined && last.kind === kind) last.points.push(footprintCentre(next, size))
    else runs.push({ kind, points: [footprintCentre(previous, size), footprintCentre(next, size)] })
    previous = next
  }
  return runs
}

export interface ArrowHead {
  readonly tip: Point2
  /** Direction of travel of the last step, in radians from +x towards +z. */
  readonly angle: number
}

export function arrowHead(start: Square, path: readonly Square[], size: number): ArrowHead | null {
  const last = path[path.length - 1]
  if (last === undefined) return null
  const before = path.length >= 2 ? path[path.length - 2] : start
  if (before === undefined) return null
  const a = footprintCentre(before, size)
  const b = footprintCentre(last, size)
  return { tip: b, angle: Math.atan2(b.z - a.z, b.x - a.x) }
}

/** Shortens the final run so the line stops at the base of the arrowhead. */
export function trimEnd(points: readonly Point2[], by: number): Point2[] {
  const out = [...points]
  const last = out[out.length - 1]
  const prev = out[out.length - 2]
  if (last === undefined || prev === undefined) return out
  const dx = last.x - prev.x
  const dz = last.z - prev.z
  const len = Math.hypot(dx, dz)
  if (len <= by) return out
  out[out.length - 1] = { x: last.x - (dx / len) * by, z: last.z - (dz / len) * by }
  return out
}
