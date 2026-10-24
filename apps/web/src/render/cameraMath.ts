// Camera maths for the orthographic rig (research-framework 4.2, research-art 10.3). A pose is an elevation and
// an azimuth on a sphere around a ground target; its basis never degenerates at the top pose, so one tween covers
// the top <-> iso switch. Zoom is pixels per board unit (three's orthographic frustum is the canvas in pixels).

import type { Point2 } from './coords'

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Radians. Elevation 90 degrees looks straight down; azimuth 0 looks from +z (the viewer's bottom edge). */
export interface CameraPose {
  readonly elevation: number
  readonly azimuth: number
}

export type CameraMode = 'top' | 'iso'
export type IsoStyle = 'true' | 'dimetric'

/** atan(1 / sqrt 2) = 35.264 degrees: the three board axes foreshorten equally. */
export const TRUE_ISOMETRIC_ELEVATION = Math.atan(1 / Math.SQRT2)
/** 2:1 dimetric, the pixel-art convention. */
export const DIMETRIC_ELEVATION = Math.PI / 6
export const ISO_AZIMUTH = Math.PI / 4
export const TOP_POSE: CameraPose = { elevation: Math.PI / 2, azimuth: 0 }

export function poseFor(mode: CameraMode, isoStyle: IsoStyle = 'true', rotationSteps = 0): CameraPose {
  if (mode === 'top') return TOP_POSE
  const elevation = isoStyle === 'true' ? TRUE_ISOMETRIC_ELEVATION : DIMETRIC_ELEVATION
  return { elevation, azimuth: ISO_AZIMUTH + (rotationSteps * Math.PI) / 2 }
}

export interface PoseBasis {
  /** From the target towards the camera. */
  readonly dir: Vec3
  /** Screen up and screen right, both perpendicular to dir. */
  readonly up: Vec3
  readonly right: Vec3
}

export function poseBasis(pose: CameraPose): PoseBasis {
  const ce = Math.cos(pose.elevation)
  const se = Math.sin(pose.elevation)
  const ca = Math.cos(pose.azimuth)
  const sa = Math.sin(pose.azimuth)
  return {
    dir: { x: ce * sa, y: se, z: ce * ca },
    up: { x: -se * sa, y: ce, z: -se * ca },
    right: { x: ca, y: 0, z: -sa },
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** The ground displacement under a screen-plane offset (ox right, oy up, in board units) for parallel rays. */
export function groundShift(ox: number, oy: number, pose: CameraPose): Point2 {
  const { dir, up, right } = poseBasis(pose)
  const o = { x: ox * right.x + oy * up.x, y: ox * right.y + oy * up.y, z: ox * right.z + oy * up.z }
  const k = o.y / dir.y
  return { x: o.x - dir.x * k, z: o.z - dir.z * k }
}

/** Screen-plane coordinates (board units, relative to the target) of a world point. */
export function screenOffset(p: Vec3, target: Point2, pose: CameraPose): { readonly x: number; readonly y: number } {
  const { up, right } = poseBasis(pose)
  const rel = { x: p.x - target.x, y: p.y, z: p.z - target.z }
  return { x: dot(rel, right), y: dot(rel, up) }
}

export interface Extent {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
}

export function screenExtent(points: readonly Vec3[], pose: CameraPose): Extent {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    const s = screenOffset(p, { x: 0, z: 0 }, pose)
    minX = Math.min(minX, s.x)
    maxX = Math.max(maxX, s.x)
    minY = Math.min(minY, s.y)
    maxY = Math.max(maxY, s.y)
  }
  return { minX, maxX, minY, maxY }
}

export interface Viewport {
  readonly width: number
  readonly height: number
}

/** Zoom and ground target that fit `points` (world space) inside the viewport, leaving `margin` (0..1) free. */
export function fitView(points: readonly Vec3[], pose: CameraPose, viewport: Viewport, margin: number): { readonly zoom: number; readonly target: Point2 } {
  if (points.length === 0 || viewport.width <= 0 || viewport.height <= 0) return { zoom: 1, target: { x: 0, z: 0 } }
  const e = screenExtent(points, pose)
  const w = Math.max(e.maxX - e.minX, 1e-6)
  const h = Math.max(e.maxY - e.minY, 1e-6)
  const zoom = Math.min(viewport.width / w, viewport.height / h) * (1 - margin)
  return { zoom, target: groundShift((e.minX + e.maxX) / 2, (e.minY + e.maxY) / 2, pose) }
}

/** New target that keeps the ground point under the pointer (px, py: pixels from the viewport centre, y up) fixed. */
export function zoomAt(target: Point2, zoom: number, nextZoom: number, px: number, py: number, pose: CameraPose): Point2 {
  const k = 1 / zoom - 1 / nextZoom
  const shift = groundShift(px * k, py * k, pose)
  return { x: target.x + shift.x, z: target.z + shift.z }
}

/** New target after the pointer moved by (dx, dy) pixels (y up): the grabbed ground point follows the pointer. */
export function panBy(target: Point2, zoom: number, dx: number, dy: number, pose: CameraPose): Point2 {
  const shift = groundShift(dx / zoom, dy / zoom, pose)
  return { x: target.x - shift.x, z: target.z - shift.z }
}

export function clampTarget(target: Point2, limit: number): Point2 {
  return { x: Math.min(limit, Math.max(-limit, target.x)), z: Math.min(limit, Math.max(-limit, target.z)) }
}

/** Azimuth along the shorter arc. */
export function lerpPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  let d = (b.azimuth - a.azimuth) % (2 * Math.PI)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return { elevation: a.elevation + (b.elevation - a.elevation) * t, azimuth: a.azimuth + d * t }
}

export function easeInOutCubic(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
}

export interface FootprintBox {
  /** Board-local rectangle (inclusive edges, in board units) and the object's height. */
  readonly x0: number
  readonly z0: number
  readonly x1: number
  readonly z1: number
  readonly height: number
}

/**
 * Whether the ground point `p` (board-local) is hidden behind a box for the camera, so the box should turn to
 * x-ray (research-ux-conventions S-7.4). Walks from `p` towards the camera, rising at tan(elevation), and tests
 * the segment against the footprint with the slab method.
 */
export function occludes(box: FootprintBox, p: Point2, pose: CameraPose, boardYawRadians: number): boolean {
  if (pose.elevation >= Math.PI / 2 - 1e-3) return false
  const { dir } = poseBasis(pose)
  const length = Math.hypot(dir.x, dir.z)
  if (length < 1e-9) return false
  // Horizontal direction towards the camera, in board-local coordinates.
  const c = Math.cos(boardYawRadians)
  const s = Math.sin(boardYawRadians)
  const wx = dir.x / length
  const wz = dir.z / length
  const ux = wx * c - wz * s
  const uz = wx * s + wz * c
  const reach = box.height / Math.tan(pose.elevation)
  let t0 = 0
  let t1 = reach
  for (const [origin, delta, lo, hi] of [
    [p.x, ux, box.x0, box.x1],
    [p.z, uz, box.z0, box.z1],
  ] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < lo || origin > hi) return false
      continue
    }
    const a = (lo - origin) / delta
    const b = (hi - origin) / delta
    t0 = Math.max(t0, Math.min(a, b))
    t1 = Math.min(t1, Math.max(a, b))
    if (t0 > t1) return false
  }
  // A point inside the footprint itself is the building's own square, not something behind it.
  const inside = p.x >= box.x0 && p.x <= box.x1 && p.z >= box.z0 && p.z <= box.z1
  return !inside && t1 > 0
}
