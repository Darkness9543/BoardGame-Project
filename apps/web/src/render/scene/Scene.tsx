// The scene inside the canvas: derives the board facts from the view, owns hover and pointer plumbing (emitting
// the contract's callbacks once per change), feeds the animation director, and composes the layers inside the
// board group, which turns half a turn for North.

import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import {
  buildingDef,
  existingSquares,
  isVisibleSquare,
  scenarioBlockers,
  scenarioDef,
  squareExists,
  footprintSquares,
  type Square,
  type UnitId,
  type UnitView,
} from '@coinduel/engine'
import { BOARD_LOOK, BUILDING_LOOK } from '../../theme'
import { poseFor, type CameraPose, type Vec3 } from '../cameraMath'
import { BOARD_HALF, boardYaw, footprintCentre, localToWorld, squareCentre, squareKey, type Point2 } from '../coords'
import { AnimationDirector } from '../director'
import { onTexturesChanged } from '../textures/canvas'
import { firstActionTarget } from '../timeline'
import type { BoardViewProps, DamageForecast } from '../types'
import { Blockers } from './Blockers'
import { BoardSurface } from './BoardSurface'
import { Buildings } from './Buildings'
import { CameraRig, type RigApi } from './CameraRig'
import { CLICK_SLOP_PX, LONG_PRESS_MS, PointerContext, SceneContext, type MutableRef, type PointerApi, type SceneInfo } from './context'
import { DirectorTicker, Effects } from './Effects'
import { Lighting } from './Lighting'
import { OverlayLayer, type OverlayMarks } from './Overlays'
import { TokenLayer } from './Tokens'

export interface SceneProps extends Omit<BoardViewProps, 'ref' | 'reducedMotion'> {
  readonly reducedMotion: boolean
  readonly rigApi: MutableRef<RigApi | null>
  readonly faceYaw: MutableRef<number>
}

const NO_FORECASTS: readonly DamageForecast[] = []
const NO_SQUARES: readonly Square[] = []
const NO_PREVIEWS: NonNullable<BoardViewProps['movePreviews']> = []
const NO_GHOSTS: NonNullable<BoardViewProps['ghosts']> = []
const NO_FLOATERS: NonNullable<BoardViewProps['floaters']> = []
const NO_CHIPS: NonNullable<BoardViewProps['chips']> = []
const PRESS_SLOP_PX = 10

function sameSquare(a: Square | null, b: Square | null): boolean {
  return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y)
}

export function Scene(props: SceneProps) {
  const { view, mySeat, selection, overlays, cameraMode, showExtendedZone, rigApi, faceYaw, reducedMotion } = props
  const speed = props.animationSpeed ?? 'normal'
  const clarity = props.clarity ?? false
  const isoStyle = props.isoStyle ?? 'true'
  const showCoordinates = props.showCoordinates ?? true
  const highlightReady = props.highlightReady ?? true
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)

  // ------------------------------------------------------------ board facts
  const scenario = scenarioDef(view.settings.scenarioId)
  const squares = useMemo(() => existingSquares(scenario.cornerRule, scenario.cornerRadius), [scenario])
  const blockers = useMemo(() => scenarioBlockers(scenario), [scenario])
  const side = view.side ?? 'south'
  const yaw = boardYaw(side)
  const fogActive = view.phase === 'battle'
  const exists = useMemo(() => (s: Square) => squareExists(s, scenario.cornerRule, scenario.cornerRadius), [scenario])
  const isVisible = useMemo(() => (fogActive ? (s: Square) => isVisibleSquare(view, s) : () => true), [fogActive, view])
  const occupancy = useMemo(() => {
    const map = new Map<number, UnitView>()
    for (const u of view.units) if (u.anchor !== null) for (const s of footprintSquares(u.anchor, u.size)) map.set(squareKey(s), u)
    return map
  }, [view.units])
  const unitAt = useMemo(() => (s: Square) => occupancy.get(squareKey(s)), [occupancy])
  const [goalPose, setGoalPose] = useState<CameraPose>(() => poseFor(cameraMode, isoStyle))

  const fitPoints = useMemo(() => {
    const points: Vec3[] = []
    const push = (p: Point2, y: number): void => {
      const w = localToWorld(p, yaw)
      points.push({ x: w.x, y, z: w.z })
    }
    for (const s of squares) {
      const c = squareCentre(s)
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const) push({ x: c.x + dx, z: c.z + dz }, 0)
    }
    if (showCoordinates) {
      const e = BOARD_HALF + 1.3
      for (const [x, z] of [[-e, -e], [e, -e], [-e, e], [e, e]] as const) push({ x, z }, 0)
    }
    for (const b of scenario.buildings) {
      const size = buildingDef(b.kind).size
      const c = footprintCentre(b.anchor, size)
      const top = (b.kind === 'keep' ? BUILDING_LOOK.keepHeight : BUILDING_LOOK.marketMaxHeight) + 1
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) push({ x: c.x + (dx * size) / 2, z: c.z + (dz * size) / 2 }, top)
    }
    return points
  }, [squares, scenario, yaw, showCoordinates])

  // ------------------------------------------------------------ animation director
  const director = useMemo(() => new AnimationDirector(), [])
  const prevUnits = useRef<ReadonlyMap<UnitId, UnitView>>(new Map())
  const lastBatch = useRef<unknown>(undefined)
  const lastSeat = useRef(mySeat)
  const [renderTick, bump] = useReducer((n: number) => n + 1, 0)
  const latest = useRef(props)
  latest.current = props

  useLayoutEffect(() => {
    const next = new Map<UnitId, UnitView>()
    for (const u of view.units) if (u.anchor !== null) next.set(u.id, u)
    const events = props.events
    const key = props.eventsKey ?? events
    const fresh = events !== undefined && events.length > 0 && key !== lastBatch.current
    lastBatch.current = key
    // Another seat now looks at the board (hot seat): nothing of the previous seat's knowledge may animate out.
    const seatChanged = lastSeat.current !== mySeat
    lastSeat.current = mySeat
    if (seatChanged) director.reset()
    const prev = seatChanged ? new Map<UnitId, UnitView>() : prevUnits.current
    director.ingest({ prev, next, events: fresh && !seatChanged ? events : null, options: { speed, reducedMotion }, now: performance.now() })
    prevUnits.current = next
    bump()
    if (fresh && !seatChanged && props.followEvents === true) {
      const target = firstActionTarget(events)
      const point = target === null ? null : director.targetPoint(target, performance.now())
      if (point !== null) {
        const world = localToWorld(point, yaw)
        if (rigApi.current?.isOnScreen(world) === false) rigApi.current.focus(world)
      }
    }
  }, [view, mySeat, props.events, props.eventsKey])

  useEffect(() => {
    const ms = director.busyUntil - performance.now()
    if (ms <= 0) return
    const timer = window.setTimeout(bump, ms + 40)
    return () => window.clearTimeout(timer)
  }, [director, renderTick])

  useEffect(() => onTexturesChanged(() => invalidate()), [invalidate])

  // ------------------------------------------------------------ hover and pointer plumbing
  const [hover, setHover] = useState<Square | null>(null)
  const [hoverUnitId, setHoverUnitId] = useState<UnitId | null>(null)
  const emitted = useRef<{ square: Square | null; unit: UnitId | null }>({ square: null, unit: null })
  const unitAtRef = useRef(unitAt)
  unitAtRef.current = unitAt
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const suppressUntil = useRef(0)

  const pointer = useMemo<PointerApi>(() => {
    const report = (square: Square | null, tokenUnit: UnitId | null): void => {
      setHover((prev) => (sameSquare(prev, square) ? prev : square))
      setHoverUnitId(tokenUnit)
      const unit = tokenUnit ?? (square === null ? null : (unitAtRef.current(square)?.id ?? null))
      if (!sameSquare(emitted.current.square, square)) {
        emitted.current.square = square
        latest.current.onSquareHover(square)
      }
      if (emitted.current.unit !== unit) {
        emitted.current.unit = unit
        latest.current.onUnitHover(unit)
      }
    }
    return {
      hoverSquare: (square) => report(square, null),
      hoverUnit: (unitId, square) => report(square, unitId),
      clickSquare: (square, button) => latest.current.onSquareClick(square, button),
      clickUnit: (unitId, button) => latest.current.onUnitClick(unitId, button),
      pressStart: (target, pointerType, x, y) => {
        if (press.current !== null) window.clearTimeout(press.current.timer)
        press.current = null
        if (pointerType !== 'touch') return
        const timer = window.setTimeout(() => {
          press.current = null
          suppressUntil.current = performance.now() + 700
          if (target.unitId !== null) latest.current.onUnitClick(target.unitId, 'secondary')
          else latest.current.onSquareClick(target.square, 'secondary')
        }, LONG_PRESS_MS)
        press.current = { timer, x, y }
      },
      suppressClick: (delta) => delta > CLICK_SLOP_PX || performance.now() < suppressUntil.current,
    }
  }, [])

  useEffect(() => {
    const el = gl.domElement
    const cancel = (): void => {
      if (press.current !== null) window.clearTimeout(press.current.timer)
      press.current = null
    }
    const onMove = (e: PointerEvent): void => {
      const p = press.current
      if (p !== null && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP_PX) cancel()
    }
    const onLeave = (): void => {
      cancel()
      pointer.hoverSquare(null)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', cancel)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancel()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', cancel)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [gl, pointer])

  // ------------------------------------------------------------ derived props for the layers
  const selectedUnit = selection.unitId === null ? null : (view.units.find((u) => u.id === selection.unitId) ?? null)
  const cursor = props.cursor ?? null
  const focusSquare = cursor ?? hover
  const hoverUnit = useMemo(() => {
    if (hoverUnitId !== null) return view.units.find((u) => u.id === hoverUnitId) ?? null
    return focusSquare === null ? null : (unitAt(focusSquare) ?? null)
  }, [hoverUnitId, focusSquare, unitAt, view.units])

  // A unit can arrive under (or leave) a pointer that stays still; keep onUnitHover in step with the view.
  const pointerUnit = hoverUnitId ?? (hover === null ? null : (unitAt(hover)?.id ?? null))
  useEffect(() => {
    if (emitted.current.unit === pointerUnit) return
    emitted.current.unit = pointerUnit
    latest.current.onUnitHover(pointerUnit)
  }, [pointerUnit])
  const forecasts = useMemo(() => new Map((props.forecasts ?? NO_FORECASTS).map((f) => [f.unitId, f])), [props.forecasts])
  // A1-16 / RULES 13.6: in iso a building must not hide a unit, the hovered square or the path's end.
  const keepVisible = useMemo(() => {
    const points: Point2[] = []
    if (focusSquare !== null) points.push(squareCentre(focusSquare))
    const pathEnd = overlays.path[overlays.path.length - 1]
    if (pathEnd !== undefined) points.push(squareCentre(pathEnd))
    for (const u of view.units) if (u.anchor !== null) points.push(footprintCentre(u.anchor, u.size))
    return points
  }, [focusSquare, overlays.path, view.units])

  const marks = useMemo<OverlayMarks>(
    () => ({
      hazards: props.hazards ?? NO_SQUARES,
      picked: props.picked ?? NO_SQUARES,
      highlight: props.highlight ?? NO_SQUARES,
      captureRing: props.captureRing ?? NO_SQUARES,
      visionPreview: props.visionPreview ?? NO_SQUARES,
    }),
    [props.hazards, props.picked, props.highlight, props.captureRing, props.visionPreview],
  )

  // A UI's own playback: each strike plays once as a lunge and a hit flash.
  const playedStrikes = useRef(new Set<number | string>())
  useEffect(() => {
    let played = false
    const current = new Set<number | string>()
    for (const strike of props.strikes ?? []) {
      current.add(strike.id)
      if (playedStrikes.current.has(strike.id)) continue
      director.strike(unitAt(strike.from)?.id ?? null, strike.to, unitAt(strike.to)?.id ?? null, { speed, reducedMotion }, performance.now())
      played = true
    }
    playedStrikes.current = current
    if (played) bump()
  }, [props.strikes, director, unitAt, speed, reducedMotion])

  // Camera focus from the UI: centre the square when it changes and is off screen.
  const focus = props.focus ?? null
  useEffect(() => {
    if (focus === null) return
    const world = localToWorld(squareCentre(focus), yaw)
    if (rigApi.current?.isOnScreen(world) === false) rigApi.current.focus(world)
  }, [focus?.x, focus?.y, yaw, rigApi])

  const info = useMemo<SceneInfo>(
    () => ({
      view,
      mySeat,
      side,
      yaw,
      fogActive,
      isVisible,
      exists,
      unitAt,
      isMyTurn: view.phase === 'battle' && view.turn?.activeSeat === mySeat,
      clarity,
      reducedMotion,
      speed,
      director,
      faceYaw,
      targetPose: goalPose,
    }),
    [view, mySeat, side, yaw, fogActive, isVisible, exists, unitAt, clarity, reducedMotion, speed, director, faceYaw, goalPose],
  )

  return (
    <SceneContext.Provider value={info}>
      <PointerContext.Provider value={pointer}>
        <color attach="background" args={[BOARD_LOOK.background]} />
        <Lighting />
        <CameraRig
          mode={cameraMode}
          isoStyle={isoStyle}
          reducedMotion={reducedMotion}
          fitPoints={fitPoints}
          boardYaw={yaw}
          faceYaw={faceYaw}
          apiRef={rigApi}
          onGoalPose={setGoalPose}
        />
        <DirectorTicker version={renderTick} />
        <group rotation-y={yaw}>
          <BoardSurface squares={squares} showCoordinates={showCoordinates} />
          <Blockers blockers={blockers} />
          <OverlayLayer
            overlays={overlays}
            showExtendedZone={showExtendedZone}
            selectedUnit={selectedUnit}
            selectedSquare={selection.square}
            hover={hover}
            cursor={cursor}
            hoverUnit={hoverUnit}
            movePreviews={props.movePreviews ?? NO_PREVIEWS}
            areaPreview={props.areaPreview ?? null}
            threat={props.threat ?? NO_SQUARES}
            marks={marks}
          />
          <Buildings keepVisible={keepVisible} hover={focusSquare} />
          <TokenLayer
            selectedId={selection.unitId}
            hoverUnitId={hoverUnit?.id ?? null}
            forecasts={forecasts}
            ghosts={props.ghosts ?? NO_GHOSTS}
            highlightReady={highlightReady}
            readyUnits={props.readyUnits ?? null}
            animationVersion={renderTick}
          />
          <Effects version={director.version} floaters={props.floaters ?? NO_FLOATERS} chips={props.chips ?? NO_CHIPS} />
        </group>
      </PointerContext.Provider>
    </SceneContext.Provider>
  )
}
