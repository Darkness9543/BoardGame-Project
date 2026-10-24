// Board coordinates of the 3D scene. The board lies in the XZ plane of a group that is turned half a turn for
// North (A1-15: each client draws its own back row at the bottom); everything inside the group uses these
// local coordinates, and only picking and camera fitting convert to and from world space.

import { BOARD_SIZE, type Side, type Square } from '@coinduel/engine'

export interface Point2 {
  readonly x: number
  readonly z: number
}

/** Distance from the board centre to the centre of an edge square (12 on a 25 x 25 board). */
export const BOARD_HALF = (BOARD_SIZE - 1) / 2

/** Local centre of a square: +x runs east (column A to Y), +z runs south (row 25 towards row 1). */
export function squareCentre(s: Square): Point2 {
  return { x: s.x - BOARD_HALF, z: BOARD_HALF - s.y }
}

/** Centre of a size x size footprint anchored at its south-west square (A1-09). */
export function footprintCentre(anchor: Square, size: number): Point2 {
  const c = squareCentre(anchor)
  return { x: c.x + (size - 1) / 2, z: c.z - (size - 1) / 2 }
}

/** The grid square under a local point, or null outside the 25 x 25 grid (cut corners are the caller's check). */
export function localToSquare(p: Point2): Square | null {
  const x = Math.round(p.x + BOARD_HALF)
  const y = Math.round(BOARD_HALF - p.z)
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return null
  return { x, y }
}

/** Yaw of the board group: South's back row at the bottom of the screen; North's view is turned 180 degrees. */
export function boardYaw(side: Side): number {
  return side === 'north' ? Math.PI : 0
}

/** World XZ to the local XZ of a group whose rotation.y is `yaw` (three: x' = x cos + z sin, z' = -x sin + z cos). */
export function worldToLocal(p: Point2, yaw: number): Point2 {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: p.x * c - p.z * s, z: p.x * s + p.z * c }
}

export function localToWorld(p: Point2, yaw: number): Point2 {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: p.x * c + p.z * s, z: -p.x * s + p.z * c }
}

export function squareKey(s: Square): number {
  return s.y * BOARD_SIZE + s.x
}
