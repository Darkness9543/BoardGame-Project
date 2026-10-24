// PLACEHOLDER board renderer: a 2D SVG implementation of BoardRendererProps (top view, and a true-isometric
// projection where buildings and tall blockers stand up, occlude what is behind them and fade when they hide
// the cursor or a unit, R36). The R3F renderer replaces it through ui/board/registry.ts.

import { memo, useMemo, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  buildingDef,
  existingSquares,
  footprintSquares,
  goalRowY,
  isVisibleSquare,
  opposite,
  scenarioBlockers,
  scenarioDef,
  squareExists,
  squareIndex,
  zoneSquares,
  type PlayerView,
  type Side,
  type Square,
  type UnitId,
  type UnitView,
} from '@coinduel/engine'
import type { BoardRendererProps, PointerButton } from '../../contracts'
import { Glyph } from '../components/Icon'
import { AREA_SYMBOLS, AREA_SYMBOL_DEFAULT, BOARD_LOOK, OVERLAY_LOOK, SIDE_TINT } from '../theme'
import { useBoardExtras } from './extras'
import { CELL, cellOf, centreOf, depthOf, projection, rectOf, squareAtPlane } from './svgGeometry'
import { Chips, Coordinates, FlatBlocker, FlatBuilding, Flashes, Floaters, GradientDefs, MineMark, PathArrow, Prism, Token, type PrismSpec, type TokenSpec } from './svgPieces'
import { controllerTint, tokenRadius } from './svgLook'

const ALL_SQUARES = existingSquares()

function SquareFill({ squares, side, fill, opacity, stroke, inset = 0, className }: {
  readonly squares: readonly Square[]
  readonly side: Side | null
  readonly fill: string
  readonly opacity?: number
  readonly stroke?: string
  readonly inset?: number
  readonly className?: string
}) {
  return (
    <g opacity={opacity} className={className} pointerEvents="none">
      {squares.map((s) => {
        const r = rectOf(s, 1, side)
        return <rect key={squareIndex(s)} x={r.u + inset} y={r.v + inset} width={r.w - inset * 2} height={r.h - inset * 2} rx={inset > 0 ? 3 : 0} fill={fill} stroke={stroke} strokeWidth={stroke === undefined ? undefined : 2} />
      })}
    </g>
  )
}

/** The ground: slabs, fog with its ink edge, zones and the goal row. Re-renders only when they change. */
const Ground = memo(function Ground({ side, visibility, phase, zones, showExtended }: {
  readonly side: Side | null
  readonly visibility: string
  readonly phase: PlayerView['phase']
  readonly zones: BoardRendererProps['overlays']['deploymentZones']
  readonly showExtended: boolean
}) {
  const fogOn = phase === 'battle'
  const visible = (s: Square): boolean => visibility.charAt(squareIndex(s)) === '1'
  const edges: string[] = []
  if (fogOn) {
    for (const s of ALL_SQUARES) {
      if (!visible(s)) continue
      const r = rectOf(s, 1, side)
      const around: readonly [Square, string][] = [
        [{ x: s.x, y: s.y + (side === 'north' ? -1 : 1) }, `M${r.u} ${r.v}h${CELL}`],
        [{ x: s.x, y: s.y + (side === 'north' ? 1 : -1) }, `M${r.u} ${r.v + CELL}h${CELL}`],
        [{ x: s.x + (side === 'north' ? 1 : -1), y: s.y }, `M${r.u} ${r.v}v${CELL}`],
        [{ x: s.x + (side === 'north' ? -1 : 1), y: s.y }, `M${r.u + CELL} ${r.v}v${CELL}`],
      ]
      for (const [n, d] of around) if (!squareExists(n) || !visible(n)) edges.push(d)
    }
  }
  return (
    <g pointerEvents="none">
      {ALL_SQUARES.map((s) => {
        const c = cellOf(s, side)
        return <rect key={squareIndex(s)} x={c.col * CELL} y={c.row * CELL} width={CELL} height={CELL} fill={(s.x + s.y) % 2 === 0 ? BOARD_LOOK.slabA : BOARD_LOOK.slabB} stroke={BOARD_LOOK.grid} strokeWidth="0.6" />
      })}
      {zones !== null && <SquareFill squares={zones.normal} side={side} fill={BOARD_LOOK.zoneMine} />}
      {zones !== null && showExtended && <SquareFill squares={zones.extended} side={side} fill="url(#svgb-hatch)" />}
      {zones !== null && showExtended && <SquareFill squares={zones.extended} side={side} fill={BOARD_LOOK.zoneExtended} />}
      {fogOn && <SquareFill squares={ALL_SQUARES.filter((s) => !visible(s))} side={side} fill={BOARD_LOOK.fog} />}
      {fogOn && <path d={edges.join('')} stroke={BOARD_LOOK.fogEdge} strokeWidth="2" fill="none" />}
    </g>
  )
})

interface Overlay {
  readonly squares: readonly Square[]
  readonly fill: string
  readonly opacity: number
  readonly stroke?: string
  readonly inset?: number
}

export function SvgBoard(props: BoardRendererProps) {
  const extras = useBoardExtras()
  const { view, overlays, selection, cameraMode, showExtendedZone } = props
  const side = view.side
  const me = view.seat
  const proj = useMemo(() => projection(cameraMode), [cameraMode])
  const svgRef = useRef<SVGSVGElement>(null)
  const hoverRef = useRef<{ square: Square | null; unit: UnitId | null }>({ square: null, unit: null })
  const scenario = scenarioDef(view.settings.scenarioId)
  const occupancy = useMemo(() => {
    const map = new Map<number, UnitView>()
    for (const u of view.units) if (u.anchor !== null) for (const s of footprintSquares(u.anchor, u.size)) map.set(squareIndex(s), u)
    return map
  }, [view.units])

  const squareFromEvent = (e: ReactPointerEvent | ReactMouseEvent): Square | null => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (svg == null || ctm == null) return null
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    const plane = proj.toPlane(point.x, point.y)
    const square = squareAtPlane(plane.u, plane.v, side)
    return square !== null && squareExists(square) ? square : null
  }

  const onMove = (e: ReactPointerEvent) => {
    const square = squareFromEvent(e)
    const current = hoverRef.current
    if (current.square?.x !== square?.x || current.square?.y !== square?.y) {
      current.square = square
      props.onSquareHover(square)
    }
    const unit = square === null ? null : (occupancy.get(squareIndex(square))?.id ?? null)
    if (unit !== current.unit) {
      current.unit = unit
      props.onUnitHover(unit)
    }
  }

  const onLeave = () => {
    hoverRef.current = { square: null, unit: null }
    props.onSquareHover(null)
    props.onUnitHover(null)
  }

  const click = (e: ReactMouseEvent, button: PointerButton) => {
    const square = squareFromEvent(e)
    if (square === null) return
    const unit = occupancy.get(squareIndex(square))
    if (unit !== undefined) props.onUnitClick(unit.id, button)
    else props.onSquareClick(square, button)
  }

  const hazardReach = overlays.reachable.filter((s) => extras.hazards.some((h) => h.x === s.x && h.y === s.y))
  const groundOverlays: Overlay[] = [
    { squares: extras.threat, fill: 'url(#svgb-threat)', opacity: 1 },
    { squares: overlays.reachable.filter((s) => !hazardReach.includes(s)), fill: OVERLAY_LOOK.move, opacity: 0.32 },
    { squares: hazardReach, fill: OVERLAY_LOOK.hazard, opacity: 0.45 },
    { squares: overlays.abilityTargets, fill: OVERLAY_LOOK.ability, opacity: 0.36 },
    { squares: extras.area, fill: OVERLAY_LOOK.ability, opacity: 0.5 },
    { squares: extras.picked, fill: OVERLAY_LOOK.ability, opacity: 0.75, inset: 3 },
    { squares: overlays.attackRange, fill: 'none', opacity: 0.95, stroke: OVERLAY_LOOK.attack, inset: 2 },
    { squares: extras.captureRing, fill: 'none', opacity: 0.9, stroke: OVERLAY_LOOK.highlight, inset: 4 },
    { squares: extras.highlight, fill: OVERLAY_LOOK.highlight, opacity: 0.45, stroke: OVERLAY_LOOK.highlight, inset: 1 },
  ]
  const battle = view.phase === 'battle'
  const goal = side === null || !battle ? null : goalRowY(side)
  const mover = view.units.find((u) => u.id === selection.unitId)

  // Things that stand on the board, drawn back to front so that nearer ones cover farther ones (R36 occlusion).
  const iso = cameraMode === 'iso'
  const tokens: TokenSpec[] = []
  for (const unit of view.units) {
    if (unit.anchor === null) continue
    const c = centreOf(unit.anchor, unit.size, side)
    const p = proj.toScreen(c.u, c.v)
    const r = tokenRadius(unit, iso)
    tokens.push({ key: unit.id, x: p.x, y: p.y - (iso ? r * 0.55 : 0), r, depth: depthOf(c.u, c.v, cameraMode), unit, ghost: null })
  }
  for (const ghost of extras.ghosts) {
    const c = centreOf(ghost.anchor, ghost.size, side)
    const p = proj.toScreen(c.u, c.v)
    const r = tokenRadius(ghost, iso)
    tokens.push({ key: `ghost-${ghost.unitId}`, x: p.x, y: p.y - (iso ? r * 0.55 : 0), r, depth: depthOf(c.u, c.v, cameraMode), unit: null, ghost })
  }

  const prisms: (PrismSpec & { readonly depth: number })[] = []
  if (iso) {
    const watched = [extras.hover, ...(mover?.anchor == null ? [] : [mover.anchor]), ...view.units.filter((u) => u.owner === me).map((u) => u.anchor)].filter((s): s is Square => s !== null)
    const hides = (anchor: Square, size: number): boolean => {
      const front = centreOf(anchor, size, side)
      return watched.some((s) => {
        const c = centreOf(s, 1, side)
        const behind = depthOf(c.u, c.v, 'iso') < depthOf(front.u, front.v, 'iso')
        const a = proj.toScreen(c.u, c.v)
        const b = proj.toScreen(front.u, front.v)
        return behind && Math.abs(a.x - b.x) < CELL * (size + 0.4) && b.y - a.y > -CELL * 0.4 && b.y - a.y < CELL * (size * 1.6 + 1)
      })
    }
    for (const blocker of scenarioBlockers(scenario)) {
      const c = centreOf(blocker.square, 1, side)
      const tall = blocker.kind === 'tall'
      prisms.push({
        key: `b${squareIndex(blocker.square)}`,
        anchor: blocker.square,
        size: 1,
        height: tall ? 1.6 : 0.35,
        top: tall ? BOARD_LOOK.blockerTallTop : BOARD_LOOK.blockerLowTop,
        side: tall ? BOARD_LOOK.blockerTall : BOARD_LOOK.blockerLow,
        opacity: tall && hides(blocker.square, 1) ? 0.35 : 1,
        symbol: null,
        symbolTint: null,
        label: null,
        depth: depthOf(c.u, c.v, 'iso') + CELL * 0.5,
      })
    }
    for (const building of view.buildings) {
      const size = buildingDef(building.kind).size
      const c = centreOf(building.anchor, size, side)
      prisms.push({
        key: building.kind,
        anchor: building.anchor,
        size,
        height: building.kind === 'keep' ? 1.5 : 1,
        top: BOARD_LOOK.buildingRoof,
        side: BOARD_LOOK.building,
        opacity: hides(building.anchor, size) ? 0.35 : 0.95,
        symbol: building.kind === 'keep' ? 'white-tower' : 'shop',
        symbolTint: controllerTint(building, me),
        label: null,
        depth: depthOf(c.u, c.v, 'iso') + CELL * size * 0.5,
      })
    }
  }
  const standing = [...tokens.map((t) => ({ kind: 'token' as const, depth: t.depth, token: t })), ...prisms.map((p) => ({ kind: 'prism' as const, depth: p.depth, prism: p }))].sort(
    (a, b) => a.depth - b.depth,
  )

  return (
    <svg
      ref={svgRef}
      className={`svgb svgb-${cameraMode}`}
      viewBox={proj.viewBox}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={(e) => click(e, 'primary')}
      onContextMenu={(e) => {
        e.preventDefault()
        click(e, 'secondary')
      }}
      role="grid"
      aria-label="Battlefield"
    >
      <defs>
        <GradientDefs clarity={extras.clarity} />
      </defs>
      <g transform={proj.ground}>
        <rect x={-6} y={-6} width={25 * CELL + 12} height={25 * CELL + 12} rx="8" fill={BOARD_LOOK.frame} stroke={BOARD_LOOK.frameEdge} strokeWidth="3" />
        <rect x={0} y={0} width={25 * CELL} height={25 * CELL} fill={BOARD_LOOK.void} />
        <Ground side={side} visibility={view.visibility} phase={view.phase} zones={overlays.deploymentZones} showExtended={showExtendedZone} />
        {goal !== null && <SquareFill squares={ALL_SQUARES.filter((s) => s.y === goal)} side={side} fill="none" stroke={BOARD_LOOK.goalRow} inset={1} opacity={0.55} />}
        {view.phase === 'deployment' && side !== null && (
          <SquareFill squares={[...zoneSquares(opposite(side), 'normal'), ...zoneSquares(opposite(side), 'extended')]} side={side} fill="rgba(20,16,12,0.28)" />
        )}
        {view.areas.map((area) => (
          <g key={area.id}>
            <SquareFill squares={area.squares} side={side} fill={area.owner === me ? SIDE_TINT.me : SIDE_TINT.opponent} opacity={0.3} />
            {area.squares.slice(0, 1).map((s) => {
              const c = centreOf(s, 1, side)
              return <Glyph key="g" name={AREA_SYMBOLS[area.abilityId] ?? AREA_SYMBOL_DEFAULT} x={c.u} y={c.v} size={CELL * 0.6} fill={area.owner === me ? '#5C4310' : '#1B1410'} opacity={0.8} />
            })}
          </g>
        ))}
        {groundOverlays.map((o, i) => (
          <SquareFill key={i} squares={o.squares} side={side} fill={o.fill} opacity={o.opacity} {...(o.stroke === undefined ? {} : { stroke: o.stroke })} inset={o.inset ?? 0} />
        ))}
        {overlays.reachable.map((s) => {
          const c = centreOf(s, 1, side)
          return <circle key={`d${squareIndex(s)}`} cx={c.u} cy={c.v} r="3" fill={OVERLAY_LOOK.move} pointerEvents="none" />
        })}
        {extras.visionPreview.length > 0 && <SquareFill squares={extras.visionPreview} side={side} fill="rgba(255,255,255,0.10)" />}
        {!iso && scenarioBlockers(scenario).map((b) => <FlatBlocker key={squareIndex(b.square)} anchor={b.square} tall={b.kind === 'tall'} side={side} fogged={battle && !isVisibleSquare(view, b.square)} />)}
        {!iso && view.buildings.map((b) => <FlatBuilding key={b.kind} building={b} side={side} me={me} highlighted={extras.captureRing.length > 0} />)}
        {mover?.anchor != null && <PathArrow view={view} from={mover.anchor} size={mover.size} path={overlays.path} hazards={extras.hazards} side={side} />}
        {view.mines.map((m) => {
          const c = centreOf(m.square, 1, side)
          return <MineMark key={m.id} x={c.u} y={c.v} mine={m.owner === me} revealed={m.revealed} />
        })}
        {extras.hover !== null && <SquareFill squares={[extras.hover]} side={side} fill="none" stroke={OVERLAY_LOOK.hover} inset={1} opacity={0.9} />}
        {selection.square !== null && <SquareFill squares={[selection.square]} side={side} fill="none" stroke={OVERLAY_LOOK.selection} inset={0} />}
        {extras.focus !== null && <SquareFill squares={[extras.focus]} side={side} fill="none" stroke={OVERLAY_LOOK.highlight} inset={-2} className="svgb-focus" />}
        {!iso && extras.coordinates && <Coordinates side={side} />}
      </g>
      {standing.map((item) =>
        item.kind === 'prism' ? (
          <Prism key={item.prism.key} spec={item.prism} proj={proj} side={side} />
        ) : (
          <Token
            key={item.token.key}
            spec={item.token}
            mine={(item.token.unit ?? item.token.ghost)?.owner === me}
            view={view}
            clarity={extras.clarity}
            selected={item.token.unit !== null && item.token.unit.id === selection.unitId}
            acted={item.token.unit !== null && item.token.unit.owner === me && battle && view.turn?.activeSeat === me && !extras.ready.has(item.token.unit.id)}
            ready={extras.highlightReady && item.token.unit !== null && extras.ready.has(item.token.unit.id)}
          />
        ),
      )}
      <Flashes flashes={extras.flashes} side={side} proj={proj} />
      <Floaters floaters={extras.floaters} side={side} proj={proj} reducedMotion={extras.reducedMotion} />
      <Chips chips={extras.chips} side={side} proj={proj} />
    </svg>
  )
}
