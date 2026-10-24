// The orthographic camera rig (research-framework 4.2, research-ux-conventions section 7). Two poses, top and iso,
// with an eased switch; zoom-to-fit that follows resizes until the player zooms or pans; wheel zoom towards the
// cursor, drag to pan with any button (a click that moved less than CLICK_SLOP_PX still picks), two-finger
// pinch. Free orbiting is off; iso turns only in 90-degree steps.

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Matrix4, OrthographicCamera, Vector3 } from 'three'
import {
  clampTarget,
  easeInOutCubic,
  fitView,
  lerpPose,
  panBy,
  poseBasis,
  poseFor,
  screenOffset,
  zoomAt,
  type CameraMode,
  type CameraPose,
  type IsoStyle,
  type Vec3,
} from '../cameraMath'
import { BOARD_HALF, type Point2 } from '../coords'
import { CLICK_SLOP_PX, type MutableRef } from './context'

export interface RigApi {
  /** World-space ground point. */
  focus(point: Point2): void
  fit(): void
  zoomBy(factor: number): void
  panBy(dx: number, dy: number): void
  rotate(steps: number): void
  isOnScreen(point: Point2): boolean
}

interface CameraRigProps {
  readonly mode: CameraMode
  readonly isoStyle: IsoStyle
  readonly reducedMotion: boolean
  /** World-space points the fit must contain (board outline and building tops, already turned by the board yaw). */
  readonly fitPoints: readonly Vec3[]
  readonly boardYaw: number
  readonly faceYaw: MutableRef<number>
  readonly apiRef: MutableRef<RigApi | null>
  /** The pose the rig is heading to (after a mode switch or an iso turn). */
  readonly onGoalPose: (pose: CameraPose) => void
}

interface Anim<T> {
  from: T
  to: T
  start: number
  duration: number
}

interface RigState {
  pose: Anim<CameraPose>
  target: Anim<Point2>
  zoom: Anim<number>
  /** Follows the board's fit until the player zooms or pans. */
  fitted: boolean
  rotation: number
}

const DISTANCE = 80
const FIT_MARGIN = 0.05
const POSE_MS = 350
const FOCUS_MS = 320
const PAN_LIMIT = BOARD_HALF + 1.5
const WHEEL_SPEED = 0.0016
const MIN_ZOOM_OF_FIT = 0.7
const MAX_ZOOM_SQUARES = 5

function anim<T>(value: T): Anim<T> {
  return { from: value, to: value, start: 0, duration: 0 }
}

function progress(a: Anim<unknown>, now: number): number {
  return a.duration <= 0 ? 1 : easeInOutCubic((now - a.start) / a.duration)
}

function sampleNumber(a: Anim<number>, now: number): number {
  return a.from + (a.to - a.from) * progress(a, now)
}

function samplePoint(a: Anim<Point2>, now: number): Point2 {
  const u = progress(a, now)
  return { x: a.from.x + (a.to.x - a.from.x) * u, z: a.from.z + (a.to.z - a.from.z) * u }
}

function samplePose(a: Anim<CameraPose>, now: number): CameraPose {
  return lerpPose(a.from, a.to, progress(a, now))
}

function running(a: Anim<unknown>, now: number): boolean {
  return a.duration > 0 && now < a.start + a.duration
}

const basis = new Matrix4()
const vr = new Vector3()
const vu = new Vector3()
const vd = new Vector3()

export function CameraRig(props: CameraRigProps) {
  const { mode, isoStyle, reducedMotion, fitPoints, boardYaw, faceYaw, apiRef } = props
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const events = useThree((s) => s.events)
  const pointerInside = useRef(false)
  const applied = useRef('')
  const rig = useRef<RigState>({ pose: anim(poseFor(mode, isoStyle)), target: anim({ x: 0, z: 0 }), zoom: anim(30), fitted: true, rotation: 0 })
  // Handlers and the imperative API read props through this ref, so the effects below only re-run when what they
  // subscribe to changes (the canvas element, the mode, the viewport).
  const latest = useRef({ fitPoints, size, reducedMotion, mode, isoStyle, onGoalPose: props.onGoalPose })
  latest.current = { fitPoints, size, reducedMotion, mode, isoStyle, onGoalPose: props.onGoalPose }

  const now = (): number => performance.now()
  const current = (): { pose: CameraPose; target: Point2; zoom: number } => {
    const t = now()
    return { pose: samplePose(rig.current.pose, t), target: samplePoint(rig.current.target, t), zoom: sampleNumber(rig.current.zoom, t) }
  }
  const limits = (pose: CameraPose): { min: number; max: number } => {
    const { size: s, fitPoints: points } = latest.current
    const fit = fitView(points, pose, s, FIT_MARGIN).zoom
    return { min: fit * MIN_ZOOM_OF_FIT, max: Math.max(fit, Math.min(s.width, s.height) / MAX_ZOOM_SQUARES) }
  }
  const setNow = (target: Point2, zoom: number): void => {
    const pose = rig.current.pose.to
    const { min, max } = limits(pose)
    rig.current.target = anim(clampTarget(target, PAN_LIMIT))
    rig.current.zoom = anim(Math.min(max, Math.max(min, zoom)))
    invalidate()
  }
  const animateTo = (target: Point2, zoom: number, ms: number): void => {
    const c = current()
    const duration = latest.current.reducedMotion ? 0 : ms
    rig.current.target = { from: c.target, to: clampTarget(target, PAN_LIMIT), start: now(), duration }
    rig.current.zoom = { from: c.zoom, to: zoom, start: now(), duration }
    invalidate()
  }
  const fitTo = (pose: CameraPose, ms: number): void => {
    const { fitPoints: points, size: s } = latest.current
    const fit = fitView(points, pose, s, FIT_MARGIN)
    rig.current.fitted = true
    animateTo(fit.target, fit.zoom, ms)
  }
  const poseTo = (pose: CameraPose): void => {
    const c = current()
    rig.current.pose = { from: c.pose, to: pose, start: now(), duration: latest.current.reducedMotion ? 0 : POSE_MS }
    latest.current.onGoalPose(pose)
    if (rig.current.fitted) fitTo(pose, POSE_MS)
    invalidate()
  }

  // Mode or iso style switch: tween the pose (and the fit while fitted).
  useEffect(() => {
    poseTo(poseFor(mode, isoStyle, rig.current.rotation))
  }, [mode, isoStyle])

  // First frame and every resize or scenario change: refit at once while fitted.
  useLayoutEffect(() => {
    if (rig.current.fitted) fitTo(rig.current.pose.to, 0)
    else invalidate()
  }, [size.width, size.height, fitPoints])

  useEffect(() => {
    apiRef.current = {
      focus: (point) => {
        rig.current.fitted = false
        animateTo(point, current().zoom, FOCUS_MS)
      },
      fit: () => fitTo(rig.current.pose.to, FOCUS_MS),
      zoomBy: (factor) => {
        const c = current()
        const { min, max } = limits(c.pose)
        rig.current.fitted = false
        animateTo(c.target, Math.min(max, Math.max(min, c.zoom * factor)), 160)
      },
      panBy: (dx, dy) => {
        const c = current()
        rig.current.fitted = false
        animateTo(panBy(c.target, 1, -dx, -dy, c.pose), c.zoom, 160)
      },
      rotate: (steps) => {
        if (latest.current.mode !== 'iso') return
        rig.current.rotation = (((rig.current.rotation + steps) % 4) + 4) % 4
        poseTo(poseFor('iso', latest.current.isoStyle, rig.current.rotation))
      },
      isOnScreen: (point) => {
        const c = current()
        const o = screenOffset({ x: point.x, y: 0, z: point.z }, c.target, c.pose)
        const { width, height } = latest.current.size
        return Math.abs(o.x * c.zoom) < width * 0.4 && Math.abs(o.y * c.zoom) < height * 0.4
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef])

  // Pointer pan, wheel zoom and pinch on the canvas element.
  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number }>()
    let dragging = false
    let downAt: { x: number; y: number } | null = null
    let pinch: { distance: number; mid: { x: number; y: number } } | null = null

    const local = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left - r.width / 2, y: r.height / 2 - (e.clientY - r.top) }
    }
    const pinchState = (): { distance: number; mid: { x: number; y: number } } | null => {
      const [a, b] = [...pointers.values()]
      if (a === undefined || b === undefined) return null
      return { distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
    }
    const onDown = (e: PointerEvent): void => {
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size === 1) {
        downAt = p
        dragging = false
      }
      pinch = pointers.size === 2 ? pinchState() : null
    }
    const onMove = (e: PointerEvent): void => {
      const before = pointers.get(e.pointerId)
      if (before === undefined) return
      const p = local(e)
      pointers.set(e.pointerId, p)
      const c = current()
      if (pointers.size >= 2 && pinch !== null) {
        const next = pinchState()
        if (next === null) return
        const { min, max } = limits(c.pose)
        const zoom = Math.min(max, Math.max(min, c.zoom * (next.distance / Math.max(1, pinch.distance))))
        const zoomed = zoomAt(c.target, c.zoom, zoom, next.mid.x, next.mid.y, c.pose)
        rig.current.fitted = false
        setNow(panBy(zoomed, zoom, next.mid.x - pinch.mid.x, next.mid.y - pinch.mid.y, c.pose), zoom)
        pinch = next
        dragging = true
        return
      }
      if (!dragging && downAt !== null && Math.hypot(p.x - downAt.x, p.y - downAt.y) > CLICK_SLOP_PX) {
        dragging = true
        el.setPointerCapture(e.pointerId)
      }
      if (!dragging) return
      rig.current.fitted = false
      setNow(panBy(c.target, c.zoom, p.x - before.x, p.y - before.y, c.pose), c.zoom)
    }
    const onUp = (e: PointerEvent): void => {
      pointers.delete(e.pointerId)
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      pinch = pointers.size === 2 ? pinchState() : null
      if (pointers.size === 0) {
        downAt = null
        dragging = false
      }
    }
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      const c = current()
      const { min, max } = limits(c.pose)
      const zoom = Math.min(max, Math.max(min, c.zoom * Math.exp(-e.deltaY * scale * WHEEL_SPEED)))
      const p = local(e)
      rig.current.fitted = false
      setNow(zoomAt(c.target, c.zoom, zoom, p.x, p.y, c.pose), zoom)
    }
    const onContextMenu = (e: Event): void => e.preventDefault()
    const onEnter = (): void => {
      pointerInside.current = true
    }
    const onLeave = (): void => {
      pointerInside.current = false
    }
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onContextMenu)
    el.style.touchAction = 'none'
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [gl])

  useFrame(() => {
    const t = now()
    const s = rig.current
    const pose = samplePose(s.pose, t)
    const target = samplePoint(s.target, t)
    const zoom = sampleNumber(s.zoom, t)
    const b = poseBasis(pose)
    camera.position.set(target.x + b.dir.x * DISTANCE, b.dir.y * DISTANCE, target.z + b.dir.z * DISTANCE)
    basis.makeBasis(vr.set(b.right.x, b.right.y, b.right.z), vu.set(b.up.x, b.up.y, b.up.z), vd.set(b.dir.x, b.dir.y, b.dir.z))
    camera.quaternion.setFromRotationMatrix(basis)
    if (camera instanceof OrthographicCamera && camera.zoom !== zoom) {
      camera.zoom = zoom
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
    // The board moved under a still pointer: pick again so the hovered square and unit stay true.
    const key = `${pose.elevation}|${pose.azimuth}|${target.x}|${target.z}|${zoom}`
    if (key !== applied.current) {
      applied.current = key
      if (pointerInside.current) events.update?.()
    }
    faceYaw.current = pose.azimuth - boardYaw
    // Tweens render at the display's refresh rate (the owner wants 144 Hz glides); cost is kept down elsewhere.
    if (running(s.pose, t) || running(s.target, t) || running(s.zoom, t)) invalidate()
  })

  return null
}
