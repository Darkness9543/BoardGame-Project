// What every layer of the scene shares: the view and its derived board facts, presentation options, the
// animation director and the live camera yaw (written by the rig every frame, read by tokens and labels).

import { createContext, useContext } from 'react'
import type { PlayerView, Seat, Side, Square, UnitId, UnitView } from '@coinduel/engine'
import type { PointerButton } from '../../contracts'
import type { CameraPose } from '../cameraMath'
import type { AnimationDirector } from '../director'
import type { AnimationSpeed } from '../timeline'

export interface MutableRef<T> {
  current: T
}

export interface SceneInfo {
  readonly view: PlayerView
  readonly mySeat: Seat
  /** My side (South until the coin flip has run). */
  readonly side: Side
  /** Yaw of the board group (0 for South, PI for North). */
  readonly yaw: number
  /** Fog is drawn in battle only: the map is public, and the lobby and deployment show the whole board. */
  readonly fogActive: boolean
  readonly isVisible: (s: Square) => boolean
  readonly exists: (s: Square) => boolean
  /** The unit covering a square, from the view (footprints included). */
  readonly unitAt: (s: Square) => UnitView | undefined
  readonly isMyTurn: boolean
  readonly clarity: boolean
  readonly reducedMotion: boolean
  readonly speed: AnimationSpeed
  readonly director: AnimationDirector
  /** Camera azimuth minus board yaw: the yaw that keeps coin faces and labels upright on screen. */
  readonly faceYaw: MutableRef<number>
  /** The camera pose the rig is heading to (x-ray tests use it). */
  readonly targetPose: CameraPose
}

export const SceneContext = createContext<SceneInfo | null>(null)

export function useScene(): SceneInfo {
  const info = useContext(SceneContext)
  if (info === null) throw new Error('useScene outside the board scene')
  return info
}

/** Pointer plumbing from meshes to the renderer's callbacks (priority: unit token, then square). */
export interface PointerApi {
  hoverSquare(square: Square | null): void
  hoverUnit(unitId: UnitId, square: Square): void
  clickSquare(square: Square, button: PointerButton): void
  clickUnit(unitId: UnitId, button: PointerButton): void
  /** Touch long-press: starts a timer that fires a secondary click on the target. */
  pressStart(target: { readonly unitId: UnitId | null; readonly square: Square }, pointerType: string, x: number, y: number): void
  /** Whether a click should be ignored (it ended a drag or a long-press). */
  suppressClick(delta: number): boolean
}

export const PointerContext = createContext<PointerApi | null>(null)

export function usePointer(): PointerApi {
  const api = useContext(PointerContext)
  if (api === null) throw new Error('usePointer outside the board scene')
  return api
}

/** Drags shorter than this (in CSS pixels) still count as clicks. */
export const CLICK_SLOP_PX = 6
export const LONG_PRESS_MS = 520

/** Layer heights above the slab tops (board units), bottom to top (research-ux-conventions 6.3 draw order). */
export const LAYER_Y = {
  area: 0.004,
  zone: 0.006,
  fill: 0.008,
  preview: 0.01,
  path: 0.014,
  outline: 0.016,
  hover: 0.018,
} as const

/** renderOrder for the transparent ground layers, matching LAYER_Y. */
export const LAYER_ORDER = {
  area: 1,
  zone: 2,
  fill: 3,
  preview: 4,
  path: 5,
  outline: 6,
  hover: 7,
  token: 10,
  badge: 11,
  emblem: 20,
} as const
