// Board-to-screen maths for the SVG placeholder board. The ground is a 25 x 25 plane of CELL units; each client
// draws its own back row at the bottom (A1-15: North sees the board rotated 180 degrees). The isometric view is
// the plane rotated 45 degrees and squashed to sin(35.264 deg), so picking stays an exact affine inverse.

import { BOARD_SIZE, type Side, type Square } from '@coinduel/engine'

export const CELL = 30
const SPAN = BOARD_SIZE * CELL
/** sin(35.264 deg): the vertical squash of true isometric. */
const ISO_Y = Math.sqrt(1 / 3)
const COS45 = Math.SQRT1_2
/** Screen offset of one unit of height (in cells) in iso: cos(35.264 deg). */
export const ISO_HEIGHT = Math.sqrt(2 / 3)

export interface Projection {
  readonly mode: 'top' | 'iso'
  readonly viewBox: string
  /** SVG matrix for the ground layer. */
  readonly ground: string
  /** Plane point (u, v) to screen. */
  toScreen(u: number, v: number): { readonly x: number; readonly y: number }
  /** Screen point to plane point. */
  toPlane(x: number, y: number): { readonly u: number; readonly v: number }
  /** Screen y offset of a height in cells (0 in top view). */
  lift(cells: number): number
}

const ISO_W = SPAN * Math.SQRT2
const ISO_H = ISO_W * ISO_Y

export function projection(mode: 'top' | 'iso'): Projection {
  if (mode === 'top') {
    return {
      mode,
      viewBox: `-26 -10 ${SPAN + 36} ${SPAN + 38}`,
      ground: 'matrix(1 0 0 1 0 0)',
      toScreen: (u, v) => ({ x: u, y: v }),
      toPlane: (x, y) => ({ u: x, v: y }),
      lift: () => 0,
    }
  }
  const a = COS45
  const b = ISO_Y * COS45
  const c = -COS45
  const d = ISO_Y * COS45
  const e = ISO_W / 2 - (a * SPAN) / 2 - (c * SPAN) / 2
  const f = ISO_H / 2 - (b * SPAN) / 2 - (d * SPAN) / 2 + CELL * 2
  const det = a * d - b * c
  return {
    mode,
    viewBox: `-20 -10 ${ISO_W + 40} ${ISO_H + CELL * 3}`,
    ground: `matrix(${a} ${b} ${c} ${d} ${e} ${f})`,
    toScreen: (u, v) => ({ x: a * u + c * v + e, y: b * u + d * v + f }),
    toPlane: (x, y) => {
      const px = x - e
      const py = y - f
      return { u: (d * px - c * py) / det, v: (-b * px + a * py) / det }
    },
    lift: (cells) => -cells * CELL * ISO_HEIGHT,
  }
}

/** Screen column/row of a square for this side (own back row at the bottom). */
export function cellOf(square: Square, side: Side | null): { readonly col: number; readonly row: number } {
  const last = BOARD_SIZE - 1
  return side === 'north' ? { col: last - square.x, row: square.y } : { col: square.x, row: last - square.y }
}

export function squareOfCell(col: number, row: number, side: Side | null): Square {
  const last = BOARD_SIZE - 1
  return side === 'north' ? { x: last - col, y: row } : { x: col, y: last - row }
}

/** Plane rectangle of a footprint (anchor = south-west square). */
export function rectOf(anchor: Square, size: number, side: Side | null): { readonly u: number; readonly v: number; readonly w: number; readonly h: number } {
  const corner = side === 'north' ? anchor : { x: anchor.x, y: anchor.y + size - 1 }
  const start = cellOf(corner, side)
  const col = side === 'north' ? start.col - (size - 1) : start.col
  return { u: col * CELL, v: start.row * CELL, w: size * CELL, h: size * CELL }
}

export function centreOf(anchor: Square, size: number, side: Side | null): { readonly u: number; readonly v: number } {
  const r = rectOf(anchor, size, side)
  return { u: r.u + r.w / 2, v: r.v + r.h / 2 }
}

export function squareAtPlane(u: number, v: number, side: Side | null): Square | null {
  const col = Math.floor(u / CELL)
  const row = Math.floor(v / CELL)
  if (col < 0 || row < 0 || col >= BOARD_SIZE || row >= BOARD_SIZE) return null
  return squareOfCell(col, row, side)
}

/** Depth for back-to-front drawing (larger = nearer the viewer). */
export function depthOf(u: number, v: number, mode: 'top' | 'iso'): number {
  return mode === 'iso' ? u + v : v
}
