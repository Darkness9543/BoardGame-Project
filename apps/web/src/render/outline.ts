// Outlines of square regions in board-local coordinates: the exact fog boundary (research-art 11, F3-lite), LOV
// previews, capture rings and zone edges. Collinear unit edges are merged so dashes run continuously.

import { BOARD_SIZE, type Square } from '@coinduel/engine'
import { squareCentre, squareKey } from './coords'

/** x0, z0, x1, z1 with x0 <= x1 and z0 <= z1 (axis-aligned). */
export type Segment = readonly [number, number, number, number]

const SIDES = [
  { dx: 0, dy: 1 }, // north: the edge at z - 0.5
  { dx: 0, dy: -1 }, // south: z + 0.5
  { dx: 1, dy: 0 }, // east: x + 0.5
  { dx: -1, dy: 0 }, // west: x - 0.5
] as const

/**
 * Every edge between a square of the region and a neighbour outside it. `keep(outside)` filters the outside
 * neighbours (the fog boundary keeps only existing squares, so the board's own edge gets no ink line).
 */
export function regionOutline(region: readonly Square[], keep: (outside: Square) => boolean = () => true): Segment[] {
  const inside = new Set(region.map(squareKey))
  const out: Segment[] = []
  for (const s of region) {
    const c = squareCentre(s)
    for (const side of SIDES) {
      const n = { x: s.x + side.dx, y: s.y + side.dy }
      const nIn = n.x >= 0 && n.y >= 0 && n.x < BOARD_SIZE && n.y < BOARD_SIZE && inside.has(squareKey(n))
      if (nIn || !keep(n)) continue
      if (side.dy !== 0) {
        const z = side.dy === 1 ? c.z - 0.5 : c.z + 0.5
        out.push([c.x - 0.5, z, c.x + 0.5, z])
      } else {
        const x = side.dx === 1 ? c.x + 0.5 : c.x - 0.5
        out.push([x, c.z - 0.5, x, c.z + 0.5])
      }
    }
  }
  return mergeCollinear(out)
}

/** Joins touching segments that lie on the same horizontal or vertical line. */
export function mergeCollinear(segments: readonly Segment[]): Segment[] {
  const horizontal = new Map<number, Segment[]>()
  const vertical = new Map<number, Segment[]>()
  for (const s of segments) {
    const isHorizontal = s[1] === s[3]
    const map = isHorizontal ? horizontal : vertical
    const key = Math.round((isHorizontal ? s[1] : s[0]) * 2)
    const list = map.get(key)
    if (list === undefined) map.set(key, [s])
    else list.push(s)
  }
  const out: Segment[] = []
  for (const [map, horizontalLine] of [
    [horizontal, true],
    [vertical, false],
  ] as const) {
    for (const list of map.values()) {
      const from = (s: Segment): number => (horizontalLine ? s[0] : s[1])
      const to = (s: Segment): number => (horizontalLine ? s[2] : s[3])
      const sorted = [...list].sort((a, b) => from(a) - from(b))
      let current: Segment | null = null
      for (const s of sorted) {
        if (current !== null && Math.abs(from(s) - to(current)) < 1e-6) {
          current = [current[0], current[1], s[2], s[3]]
          continue
        }
        if (current !== null) out.push(current)
        current = s
      }
      if (current !== null) out.push(current)
    }
  }
  return out
}

/** Flattens segments to the point pairs drei's <Line segments> expects, at height y. */
export function segmentPoints(segments: readonly Segment[], y: number): [number, number, number][] {
  const points: [number, number, number][] = []
  for (const s of segments) points.push([s[0], y, s[1]], [s[2], y, s[3]])
  return points
}
