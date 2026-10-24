// Pure board geometry (RULES_INTERPRETATION section 1). No game state here: scenario terrain and
// occupancy live in state.ts and vision.ts.

import {
  ADJACENCY,
  BOARD_SIZE,
  CORNER_RADIUS,
  CORNER_RULE,
  EXTENDED_ZONE_ROWS,
  MOVE_DIRECTIONS,
  NORMAL_ZONE_ROWS,
  type CornerRule,
  type Neighbourhood,
} from './constants'
import type { Metric, Side, Square } from './types'

export const SQUARE_COUNT = BOARD_SIZE * BOARD_SIZE
const LAST = BOARD_SIZE - 1

export function sq(x: number, y: number): Square {
  return { x, y }
}

export function squareIndex(s: Square): number {
  return s.y * BOARD_SIZE + s.x
}

export function squareFromIndex(index: number): Square {
  return { x: index % BOARD_SIZE, y: Math.floor(index / BOARD_SIZE) }
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.x === b.x && a.y === b.y
}

export function onGrid(s: Square): boolean {
  return Number.isInteger(s.x) && Number.isInteger(s.y) && s.x >= 0 && s.y >= 0 && s.x <= LAST && s.y <= LAST
}

/** A1-02: whether a square exists after the corners are cut (rule A by default; B, C, D per 1.3). */
export function squareExists(s: Square, rule: CornerRule = CORNER_RULE, radius: number = CORNER_RADIUS): boolean {
  if (!onGrid(s)) return false
  const u = Math.min(s.x, LAST - s.x)
  const v = Math.min(s.y, LAST - s.y)
  switch (rule) {
    case 'A':
      return !(u < radius && v < radius && (radius - u) ** 2 + (radius - v) ** 2 > radius ** 2)
    case 'B':
      return !(u < radius && v < radius && (2 * radius - 1 - 2 * u) ** 2 + (2 * radius - 1 - 2 * v) ** 2 > 4 * radius ** 2)
    case 'C':
      return u + v > radius - 1
    case 'D':
      return (2 * u + 1) ** 2 + (2 * v + 1) ** 2 >= 4 * radius ** 2
  }
}

export function existingSquares(rule: CornerRule = CORNER_RULE, radius: number = CORNER_RADIUS): Square[] {
  const out: Square[] = []
  for (let y = 0; y <= LAST; y++) for (let x = 0; x <= LAST; x++) if (squareExists({ x, y }, rule, radius)) out.push({ x, y })
  return out
}

export function manhattan(a: Square, b: Square): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export function chebyshev(a: Square, b: Square): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/** Inclusive rectangle covered by a footprint. */
export interface Rect {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

export function footprintRect(anchor: Square, size: number): Rect {
  return { x0: anchor.x, y0: anchor.y, x1: anchor.x + size - 1, y1: anchor.y + size - 1 }
}

/** A1-09: Size S fills an S x S block anchored at its south-west square. */
export function footprintSquares(anchor: Square, size: number): Square[] {
  const out: Square[] = []
  for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) out.push({ x: anchor.x + dx, y: anchor.y + dy })
  return out
}

/** Distance between the nearest squares of two rectangles (1.4: "the minimum over every square of A and B"). */
export function rectDistance(a: Rect, b: Rect, metric: Metric = 'manhattan'): number {
  const dx = Math.max(0, b.x0 - a.x1, a.x0 - b.x1)
  const dy = Math.max(0, b.y0 - a.y1, a.y0 - b.y1)
  return metric === 'manhattan' ? dx + dy : Math.max(dx, dy)
}

export function footprintDistance(
  anchorA: Square,
  sizeA: number,
  anchorB: Square,
  sizeB: number,
  metric: Metric = 'manhattan',
): number {
  return rectDistance(footprintRect(anchorA, sizeA), footprintRect(anchorB, sizeB), metric)
}

export function pointRect(s: Square): Rect {
  return { x0: s.x, y0: s.y, x1: s.x, y1: s.y }
}

/** Metric used by "adjacent", melee reach and "range 1" (A1-05). */
export function adjacencyMetric(mode: Neighbourhood = ADJACENCY): Metric {
  return mode === 'ORTHO_4' ? 'manhattan' : 'chebyshev'
}

/** Existing squares within `range` of a footprint (its own squares included, distance 0). */
export function squaresWithin(anchor: Square, size: number, range: number, metric: Metric = 'manhattan'): Square[] {
  const rect = footprintRect(anchor, size)
  const out: Square[] = []
  for (let y = rect.y0 - range; y <= rect.y1 + range; y++) {
    for (let x = rect.x0 - range; x <= rect.x1 + range; x++) {
      const s = { x, y }
      if (squareExists(s) && rectDistance(rect, pointRect(s), metric) <= range) out.push(s)
    }
  }
  return out
}

/** Existing squares at exactly `distance` from a footprint. */
export function squaresAtDistance(anchor: Square, size: number, distance: number, metric: Metric = 'manhattan'): Square[] {
  const rect = footprintRect(anchor, size)
  return squaresWithin(anchor, size, distance, metric).filter((s) => rectDistance(rect, pointRect(s), metric) === distance)
}

/** A1-03: LOV N = every existing square within Manhattan N of any footprint square (no occlusion). */
export function lovSquares(anchor: Square, size: number, lov: number): Square[] {
  return squaresWithin(anchor, size, lov, 'manhattan')
}

/** Squares adjacent to a footprint: 4 around a 1x1 and 8 around a 2x2 under ORTHO_4 (1.6). */
export function adjacentSquares(anchor: Square, size: number, mode: Neighbourhood = ADJACENCY): Square[] {
  return squaresAtDistance(anchor, size, 1, adjacencyMetric(mode))
}

/** A1-06 / A6-06: "range of 1 (including corners)": the Chebyshev-1 ring, 16 squares around a 3x3 building (R32). */
export function ringSquares(anchor: Square, size: number): Square[] {
  return squaresAtDistance(anchor, size, 1, 'chebyshev')
}

const ORTHO_OFFSETS: readonly Square[] = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
]
const KING_OFFSETS: readonly Square[] = [
  ...ORTHO_OFFSETS,
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
  { x: -1, y: 1 },
]

export function neighbourOffsets(mode: Neighbourhood): readonly Square[] {
  return mode === 'ORTHO_4' ? ORTHO_OFFSETS : KING_OFFSETS
}

/** A1-08: whether `from -> to` is a single legal movement step. */
export function isMovementStep(from: Square, to: Square, mode: Neighbourhood = MOVE_DIRECTIONS): boolean {
  return mode === 'ORTHO_4' ? manhattan(from, to) === 1 : chebyshev(from, to) === 1
}

/** A1-07 / A8-19: a 3x3 area (Chebyshev <= 1 of the centre); squares off the board are dropped. */
export function area3x3(centre: Square): Square[] {
  return squaresWithin(centre, 1, 1, 'chebyshev')
}

/** A8-18 / C27: the squares form one orthogonally connected group (any tetromino for 4 squares). */
export function isOrthogonallyConnected(squares: readonly Square[]): boolean {
  if (squares.length === 0) return false
  const keys = new Set(squares.map(squareIndex))
  if (keys.size !== squares.length) return false
  const first = squares[0]
  if (first === undefined) return false
  const seen = new Set<number>([squareIndex(first)])
  const queue: Square[] = [first]
  while (queue.length > 0) {
    const cur = queue.shift()
    if (cur === undefined) break
    for (const o of ORTHO_OFFSETS) {
      const next = { x: cur.x + o.x, y: cur.y + o.y }
      const k = squareIndex(next)
      if (onGrid(next) && keys.has(k) && !seen.has(k)) {
        seen.add(k)
        queue.push(next)
      }
    }
  }
  return seen.size === keys.size
}

/** FORCEFIELD_SHAPE 'square2x2' alternative (Q64). */
export function isSquare2x2(squares: readonly Square[]): boolean {
  if (squares.length !== 4) return false
  const minX = Math.min(...squares.map((s) => s.x))
  const minY = Math.min(...squares.map((s) => s.y))
  return footprintSquares({ x: minX, y: minY }, 2).every((f) => squares.some((s) => sameSquare(s, f)))
}

/**
 * A8-20: Forceful slam splash. `target` must be adjacent (Manhattan 1) to the footprint. With d the unit
 * vector from the touching footprint square to the target, the splash is every 8-neighbour of the target
 * with dot(v, d) >= 0: the 3 squares beyond it and the 2 beside it. Squares off the board are dropped.
 */
export function slamSplash(anchor: Square, size: number, target: Square): Square[] {
  const touching = footprintSquares(anchor, size).find((f) => manhattan(f, target) === 1)
  if (touching === undefined) return []
  const d = { x: target.x - touching.x, y: target.y - touching.y }
  return KING_OFFSETS.filter((v) => v.x * d.x + v.y * d.y >= 0)
    .map((v) => ({ x: target.x + v.x, y: target.y + v.y }))
    .filter((s) => squareExists(s))
}

// ---------------------------------------------------------------- sides, rows and zones (1.2, 5.2)

export function opposite(side: Side): Side {
  return side === 'south' ? 'north' : 'south'
}

/** A1-01: South's back row is row 1 (y 0); North's is row 25 (y 24). Each client draws its own back row at the bottom (A1-15). */
export function backRowY(side: Side): number {
  return side === 'south' ? 0 : LAST
}

/** A6-04: the goal row is the opponent's back row. */
export function goalRowY(side: Side): number {
  return backRowY(opposite(side))
}

/** A5-05: rows (y values) of a side's normal zone (5 rows) or extended zone (the 2 rows in front). */
export function zoneRowsY(side: Side, zone: 'normal' | 'extended'): number[] {
  const from = zone === 'normal' ? 0 : NORMAL_ZONE_ROWS
  const count = zone === 'normal' ? NORMAL_ZONE_ROWS : EXTENDED_ZONE_ROWS
  const rows: number[] = []
  for (let i = from; i < from + count; i++) rows.push(side === 'south' ? i : LAST - i)
  return rows
}

export function isInZone(side: Side, s: Square, zone: 'normal' | 'extended'): boolean {
  return zoneRowsY(side, zone).includes(s.y)
}

export function zoneSquares(side: Side, zone: 'normal' | 'extended'): Square[] {
  const rows = zoneRowsY(side, zone)
  return existingSquares().filter((s) => rows.includes(s.y))
}

// ---------------------------------------------------------------- square names (A1-01: column letter + row number)

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXY'

export function squareName(s: Square): string {
  return `${COLUMNS.charAt(s.x)}${s.y + 1}`
}

/** 'M13' -> { x: 12, y: 12 }. Throws on malformed names. */
export function parseSquare(name: string): Square {
  const match = /^([A-Y])([0-9]{1,2})$/.exec(name.trim().toUpperCase())
  const col = match?.[1]
  const row = match?.[2]
  if (col === undefined || row === undefined) throw new Error(`Bad square name: ${name}`)
  const s = { x: COLUMNS.indexOf(col), y: Number(row) - 1 }
  if (!onGrid(s)) throw new Error(`Square off the grid: ${name}`)
  return s
}
