// Ground overlays, bottom to top (research-ux-conventions 6.3): area effects, deployment zones, the danger zone,
// square fills (reach, hazard reach, attack reach, ability targets), area previews, the exact fog boundary, the
// hovered unit's LOV, the goal row, move arrows, target rings, and the hover / cursor / selected-square frames.

import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, RingGeometry, Shape, ShapeGeometry } from 'three'
import {
  adjacentSquares,
  BOARD_SIZE,
  existingSquares,
  goalRowY,
  lovContains,
  opposite,
  squaresWithin,
  ViewQuery,
  zoneSquares,
  type AreaView,
  type Square,
  type UnitView,
} from '@coinduel/engine'
import { AREA_SYMBOL_DEFAULT, AREA_SYMBOLS, BOARD_LOOK, FOG_LOOK, OVERLAY_LOOK, SIDE_TINT } from '../../theme'
import type { BoardOverlays } from '../../contracts'
import { footprintCentre, squareCentre, squareKey } from '../coords'
import { regionOutline, segmentPoints } from '../outline'
import { arrowHead, pathRuns, trimEnd, type PathRun } from '../pathArrow'
import { iconChipTexture } from '../textures/badges'
import { labelTexture } from '../textures/labels'
import { tileTexture, type TileStyle } from '../textures/tiles'
import type { AreaPreview, MovePreview } from '../types'
import { coinSize } from './coinGeometry'
import { LAYER_ORDER, LAYER_Y, useScene } from './context'
import { YawGroup } from './YawGroup'

const MAX_TILES = BOARD_SIZE * BOARD_SIZE
const TILE_GEOMETRY = new PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2)
const tileMaterials = new Map<TileStyle, MeshBasicMaterial>()

function tileMaterial(style: TileStyle): MeshBasicMaterial {
  let m = tileMaterials.get(style)
  if (m === undefined) {
    m = new MeshBasicMaterial({ map: tileTexture(style), transparent: true, depthWrite: false, toneMapped: false })
    tileMaterials.set(style, m)
  }
  return m
}

/** Square frame (hover, cursor, selected square): a 4-segment ring turned to be axis-aligned. */
function frameGeometry(half: number, stroke: number): RingGeometry {
  return new RingGeometry((half - stroke) * Math.SQRT2, half * Math.SQRT2, 4, 1, Math.PI / 4)
}
const HOVER_FRAME = frameGeometry(0.49, 0.055)
const SELECT_FRAME = frameGeometry(0.5, 0.085)

interface OverlayLayerProps {
  readonly overlays: BoardOverlays
  readonly showExtendedZone: boolean
  readonly selectedUnit: UnitView | null
  readonly selectedSquare: Square | null
  readonly hover: Square | null
  readonly cursor: Square | null
  readonly hoverUnit: UnitView | null
  readonly movePreviews: readonly MovePreview[]
  readonly areaPreview: AreaPreview | null
  readonly threat: readonly Square[]
  readonly marks: OverlayMarks
}

/** Square sets a UI may add on top of the contract's overlays (all optional for it, empty here). */
export interface OverlayMarks {
  readonly hazards: readonly Square[]
  readonly picked: readonly Square[]
  readonly highlight: readonly Square[]
  readonly captureRing: readonly Square[]
  readonly visionPreview: readonly Square[]
}

export const OverlayLayer = memo(function OverlayLayer(props: OverlayLayerProps) {
  const { overlays, showExtendedZone, selectedUnit, selectedSquare, hover, cursor, hoverUnit, movePreviews, areaPreview, threat, marks } = props
  const { view, side, fogActive, isVisible, unitAt } = useScene()
  const mineKeys = useMemo(() => new Set(view.mines.map((m) => squareKey(m.square))), [view.mines])
  // A8-17: a reachable square holding a known mine (own, or a revealed enemy one) is a hazard; routes through one
  // show on the path arrow (the contract passes squares, not their paths).
  const [reach, hazard] = useMemo(() => {
    const safe: Square[] = []
    const risky: Square[] = []
    for (const s of overlays.reachable) (mineKeys.has(squareKey(s)) ? risky : safe).push(s)
    return [safe, risky]
  }, [overlays.reachable, mineKeys])
  // A5-05: during deployment the opponent's normal zone is washed dark (zones are public geometry).
  const opponentZone = useMemo(
    () => (view.phase === 'deployment' && overlays.deploymentZones !== null ? zoneSquares(opposite(side), 'normal') : []),
    [view.phase, overlays.deploymentZones, side],
  )
  const targets = useMemo(() => {
    const keys = new Set(overlays.attackRange.map(squareKey))
    const hit = new Map<string, UnitView>()
    for (const s of overlays.attackRange) {
      const u = unitAt(s)
      if (u !== undefined && u.owner !== view.seat && keys.has(squareKey(s))) hit.set(u.id, u)
    }
    return [...hit.values()]
  }, [overlays.attackRange, unitAt, view.seat])

  return (
    <group>
      <Areas areas={view.areas} />
      {overlays.deploymentZones !== null && <Tiles squares={overlays.deploymentZones.normal} style="zoneMine" layer="zone" />}
      {overlays.deploymentZones !== null && showExtendedZone && <Tiles squares={overlays.deploymentZones.extended} style="zoneExtended" layer="zone" />}
      {overlays.deploymentZones !== null && showExtendedZone && <Outline squares={overlays.deploymentZones.extended} colour={BOARD_LOOK.zoneMine} width={0.03} dashed layer="zone" />}
      {opponentZone.length > 0 && <Tiles squares={opponentZone} style="zoneOpponent" layer="zone" />}
      {threat.length > 0 && <Tiles squares={threat} style="threat" layer="zone" />}
      <Tiles squares={reach} style="move" layer="fill" />
      <Tiles squares={hazard} style="hazard" layer="fill" />
      <Tiles squares={marks.hazards} style="hazard" layer="preview" />
      <Tiles squares={overlays.attackRange} style="attack" layer="fill" />
      <Tiles squares={overlays.abilityTargets} style="ability" layer="fill" />
      {areaPreview != null && <Tiles squares={areaPreview.secondary} style="areaSecondary" layer="preview" />}
      {areaPreview != null && <Tiles squares={areaPreview.primary} style="areaPrimary" layer="preview" />}
      {fogActive && <FogEdge />}
      {view.phase === 'battle' && <GoalRow highlighted={selectedUnit?.isCommander === true && selectedUnit.owner === view.seat} />}
      {hoverUnit !== null && <VisionOutline unit={hoverUnit} />}
      {marks.visionPreview.length > 0 && <Outline squares={marks.visionPreview} colour={OVERLAY_LOOK.vision} width={0.05} dashed layer="outline" />}
      {marks.captureRing.length > 0 && <Outline squares={marks.captureRing} colour={OVERLAY_LOOK.highlight} width={0.06} dashed={false} layer="outline" />}
      {hoverUnit !== null && hoverUnit.stealthed && hoverUnit.anchor !== null && (
        <Outline squares={adjacentSquares(hoverUnit.anchor, hoverUnit.size)} colour={OVERLAY_LOOK.revealed} width={0.04} dashed layer="outline" />
      )}
      {selectedUnit?.anchor != null && overlays.path.length > 0 && (
        <PathArrow start={selectedUnit.anchor} path={overlays.path} size={selectedUnit.size} movement={selectedUnit.movement} primary isVisible={isVisible} mineKeys={mineKeys} />
      )}
      {movePreviews.map((m) => {
        const unit = view.units.find((u) => u.id === m.unitId)
        if (unit?.anchor == null || m.path.length === 0) return null
        return <PathArrow key={m.unitId} start={unit.anchor} path={m.path} size={unit.size} movement={unit.movement} primary={false} isVisible={isVisible} mineKeys={mineKeys} />
      })}
      {targets.map((u) => (
        <TargetRing key={u.id} unit={u} />
      ))}
      {marks.highlight.map((s) => (
        <Frame key={`h${s.x},${s.y}`} square={s} colour={OVERLAY_LOOK.highlight} thick />
      ))}
      {marks.picked.map((s) => (
        <Frame key={`p${s.x},${s.y}`} square={s} colour={OVERLAY_LOOK.selection} thick />
      ))}
      {selectedSquare !== null && <Frame square={selectedSquare} colour={OVERLAY_LOOK.selection} thick />}
      {hover !== null && <Frame square={hover} colour={OVERLAY_LOOK.hover} thick={false} />}
      {cursor !== null && (hover === null || cursor.x !== hover.x || cursor.y !== hover.y) && <Frame square={cursor} colour={OVERLAY_LOOK.selection} thick={false} />}
    </group>
  )
})

function Tiles({ squares, style, layer }: { readonly squares: readonly Square[]; readonly style: TileStyle; readonly layer: keyof typeof LAYER_Y }) {
  const { yaw } = useScene()
  const invalidate = useThree((s) => s.invalidate)
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (mesh === null) return
    const dummy = new Object3D()
    const count = Math.min(squares.length, MAX_TILES)
    for (let i = 0; i < count; i++) {
      const s = squares[i]
      if (s === undefined) continue
      const c = squareCentre(s)
      dummy.position.set(c.x, LAYER_Y[layer], c.z)
      dummy.rotation.set(0, -yaw, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    invalidate()
  }, [squares, layer, yaw, invalidate])
  return <instancedMesh ref={ref} args={[TILE_GEOMETRY, tileMaterial(style), MAX_TILES]} renderOrder={LAYER_ORDER[layer]} frustumCulled={false} />
}

function Outline(props: { readonly squares: readonly Square[]; readonly colour: string; readonly width: number; readonly dashed: boolean; readonly layer: keyof typeof LAYER_Y; readonly keep?: (s: Square) => boolean }) {
  const { squares, colour, width, dashed, layer, keep } = props
  const points = useMemo(() => segmentPoints(regionOutline(squares, keep), LAYER_Y[layer]), [squares, keep, layer])
  if (points.length === 0) return null
  return (
    <Line
      points={points}
      segments
      color={colour}
      lineWidth={width}
      worldUnits
      dashed={dashed}
      dashSize={0.2}
      gapSize={0.12}
      transparent
      depthWrite={false}
      renderOrder={LAYER_ORDER[layer]}
    />
  )
}

/** F3-lite: a crisp ink line on the exact LOV boundary; the board's own edge gets none. */
function FogEdge() {
  const { view, exists, isVisible } = useScene()
  const visible = useMemo(() => existingSquares().filter((s) => exists(s) && isVisible(s)), [exists, isVisible, view.visibility])
  return <Outline squares={visible} colour={BOARD_LOOK.fogEdge} width={FOG_LOOK.edgeWidth} dashed={false} layer="outline" keep={exists} />
}

/** The hovered unit's vision (research-art 11), with R36 occlusion through the engine's LOV test. */
function VisionOutline({ unit }: { readonly unit: UnitView }) {
  const { view, exists } = useScene()
  const squares = useMemo(() => {
    if (unit.anchor === null) return []
    const q = new ViewQuery(view)
    return squaresWithin(unit.anchor, unit.size, unit.lov).filter((s) => exists(s) && lovContains(q, unit, s))
  }, [view, unit, exists])
  return <Outline squares={squares} colour={OVERLAY_LOOK.vision} width={0.035} dashed layer="outline" />
}

/** The opponent's back row (A6-04, the domination goal), brighter while my commander is selected. */
function GoalRow({ highlighted }: { readonly highlighted: boolean }) {
  const { side, exists } = useScene()
  const row = useMemo(() => {
    const y = goalRowY(side)
    const out: Square[] = []
    for (let x = 0; x < BOARD_SIZE; x++) if (exists({ x, y })) out.push({ x, y })
    return out
  }, [side, exists])
  return <Outline squares={row} colour={BOARD_LOOK.goalRow} width={highlighted ? 0.07 : 0.035} dashed={!highlighted} layer="outline" />
}

function Frame({ square, colour, thick }: { readonly square: Square; readonly colour: string; readonly thick: boolean }) {
  const c = squareCentre(square)
  return (
    <mesh geometry={thick ? SELECT_FRAME : HOVER_FRAME} rotation-x={-Math.PI / 2} position={[c.x, LAYER_Y.hover, c.z]} renderOrder={LAYER_ORDER.hover}>
      <meshBasicMaterial color={colour} transparent opacity={thick ? 0.95 : 0.85} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** A dashed crosshair ring round each visible enemy the selected unit can attack. */
function TargetRing({ unit }: { readonly unit: UnitView }) {
  const points = useMemo(() => {
    if (unit.anchor === null) return []
    const c = footprintCentre(unit.anchor, unit.size)
    const r = coinSize(unit).radius + 0.1
    const out: [number, number, number][] = []
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2
      out.push([c.x + Math.cos(a) * r, LAYER_Y.outline, c.z + Math.sin(a) * r])
    }
    return out
  }, [unit])
  if (points.length === 0) return null
  return <Line points={points} color={OVERLAY_LOOK.attack} lineWidth={0.05} worldUnits dashed dashSize={0.16} gapSize={0.08} transparent depthWrite={false} renderOrder={LAYER_ORDER.outline} />
}

const HEAD_LENGTH = 0.3

function headGeometry(length: number, halfWidth: number): ShapeGeometry {
  const shape = new Shape()
  shape.moveTo(length * 0.8, 0)
  shape.lineTo(-length * 0.2, halfWidth)
  shape.lineTo(-length * 0.2, -halfWidth)
  shape.closePath()
  return new ShapeGeometry(shape).rotateX(-Math.PI / 2)
}
const HEAD = headGeometry(HEAD_LENGTH, 0.2)
const HEAD_OUTLINE = headGeometry(HEAD_LENGTH + 0.12, 0.28)

function runColour(run: PathRun): string {
  switch (run.kind) {
    case 'clear':
      return OVERLAY_LOOK.path
    case 'fog':
      return OVERLAY_LOOK.pathFog
    case 'hazard':
      return OVERLAY_LOOK.hazard
  }
}

/** The move arrow (research-ux-conventions 8.3): solid on seen ground, dashed into fog, amber into a known mine. */
function PathArrow(props: {
  readonly start: Square
  readonly path: readonly Square[]
  readonly size: number
  readonly movement: number
  readonly primary: boolean
  readonly isVisible: (s: Square) => boolean
  readonly mineKeys: ReadonlySet<number>
}) {
  const { start, path, size, movement, primary, isVisible, mineKeys } = props
  const runs = useMemo(() => pathRuns(start, path, size, { isVisible, hasKnownMine: (s) => mineKeys.has(squareKey(s)) }), [start, path, size, isVisible, mineKeys])
  const head = useMemo(() => arrowHead(start, path, size), [start, path, size])
  const width = primary ? 0.13 : 0.09
  const y = LAYER_Y.path
  const last = runs[runs.length - 1]
  const lastKind = last?.kind ?? 'clear'
  return (
    <group>
      {runs.map((run, i) => {
        const points = (i === runs.length - 1 ? trimEnd(run.points, HEAD_LENGTH * 0.6) : run.points).map((p) => [p.x, y, p.z] as [number, number, number])
        return (
          <group key={i}>
            <Line points={points} color={OVERLAY_LOOK.pathOutline} lineWidth={width + 0.08} worldUnits transparent opacity={0.85} depthWrite={false} renderOrder={LAYER_ORDER.path} />
            <Line
              points={points}
              color={runColour(run)}
              lineWidth={width}
              worldUnits
              dashed={run.kind !== 'clear'}
              dashSize={0.18}
              gapSize={0.12}
              transparent
              depthWrite={false}
              renderOrder={LAYER_ORDER.path}
            />
          </group>
        )
      })}
      {head !== null && (
        <group position={[head.tip.x, y, head.tip.z]} rotation-y={-head.angle}>
          <mesh geometry={HEAD_OUTLINE} position-x={-0.06} renderOrder={LAYER_ORDER.path}>
            <meshBasicMaterial color={OVERLAY_LOOK.pathOutline} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh geometry={HEAD} position-y={0.001} renderOrder={LAYER_ORDER.path}>
            <meshBasicMaterial color={runColour({ kind: lastKind, points: [] })} depthWrite={false} transparent toneMapped={false} />
          </mesh>
        </group>
      )}
      {head !== null && primary && <StepChip at={head.tip} text={`${path.length}/${movement}`} />}
    </group>
  )
}

function StepChip({ at, text }: { readonly at: { readonly x: number; readonly z: number }; readonly text: string }) {
  const label = useMemo(() => labelTexture(text, 'chip'), [text])
  const h = 0.3
  return (
    <YawGroup position={[at.x, LAYER_Y.hover + 0.02, at.z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0.34, 0, -0.34]} renderOrder={LAYER_ORDER.badge}>
        <planeGeometry args={[h * label.aspect, h]} />
        <meshBasicMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </YawGroup>
  )
}

/** Area effects in view (A4-13: my areas in full, enemy areas clipped to my vision): a tinted decal, a glyph and turns left. */
function Areas({ areas }: { readonly areas: readonly AreaView[] }) {
  const { view, mySeat } = useScene()
  return (
    <group>
      {areas.map((a) => {
        const own = a.owner === mySeat
        const centre = a.squares.reduce((acc, s) => ({ x: acc.x + s.x / a.squares.length, y: acc.y + s.y / a.squares.length }), { x: 0, y: 0 })
        const anchor = a.squares.reduce((best, s) => (Math.hypot(s.x - centre.x, s.y - centre.y) < Math.hypot(best.x - centre.x, best.y - centre.y) ? s : best), a.squares[0] ?? { x: 0, y: 0 })
        const turns = Math.max(0, a.expiresAtOwnTurn - view.ownTurns[a.owner])
        return (
          <group key={a.id}>
            <Tiles squares={a.squares} style={own ? 'areaMine' : 'areaOpponent'} layer="area" />
            <Outline squares={a.squares} colour={own ? SIDE_TINT.me : SIDE_TINT.opponent} width={0.04} dashed={false} layer="area" />
            <AreaChip square={anchor} symbol={AREA_SYMBOLS[a.abilityId] ?? AREA_SYMBOL_DEFAULT} turns={turns} />
          </group>
        )
      })}
    </group>
  )
}

function AreaChip({ square, symbol, turns }: { readonly square: Square; readonly symbol: string; readonly turns: number }) {
  const c = squareCentre(square)
  const label = useMemo(() => labelTexture(String(turns), 'chip'), [turns])
  return (
    <YawGroup position={[c.x, LAYER_Y.preview + 0.01, c.z]}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={LAYER_ORDER.fill}>
        <circleGeometry args={[0.2, 32]} />
        <meshBasicMaterial map={iconChipTexture(symbol)} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {turns > 0 && (
        <mesh rotation-x={-Math.PI / 2} position={[0.22, 0.002, 0.18]} renderOrder={LAYER_ORDER.fill}>
          <planeGeometry args={[0.2 * label.aspect, 0.2]} />
          <meshBasicMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </YawGroup>
  )
}
