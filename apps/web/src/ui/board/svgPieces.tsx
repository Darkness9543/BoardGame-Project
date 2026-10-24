// Pieces of the SVG placeholder board: prisms (blockers, buildings), tokens, the path arrow, floaters and chips.

import { memo } from 'react'
import { BOARD_SIZE, buildingDef, footprintSquares, isVisibleSquare, type BuildingCore, type PlayerView, type Side, type Square, type UnitView } from '@coinduel/engine'
import type { Ghost } from '../../store/ghosts'
import type { Floater, Flash } from '../../store/playback'
import { CoinShape, FaceGradient } from '../components/Coin'
import { faceTone } from '../components/coinLook'
import { Glyph } from '../components/Icon'
import { BOARD_LOOK, BUILDING_SYMBOLS, OVERLAY_LOOK, gradePalette } from '../theme'
import type { BoardChip } from './extras'
import { CELL, centreOf, rectOf, type Projection } from './svgGeometry'
import { controllerTint, gradientFor } from './svgLook'

// ---------------------------------------------------------------- shared helpers

function screenOf(proj: Projection, square: Square, size: number, side: Side | null): { readonly x: number; readonly y: number } {
  const c = centreOf(square, size, side)
  return proj.toScreen(c.u, c.v)
}

function corners(proj: Projection, anchor: Square, size: number, side: Side | null): { x: number; y: number }[] {
  const r = rectOf(anchor, size, side)
  return [proj.toScreen(r.u, r.v), proj.toScreen(r.u + r.w, r.v), proj.toScreen(r.u + r.w, r.v + r.h), proj.toScreen(r.u, r.v + r.h)]
}

const points = (ps: readonly { x: number; y: number }[]): string => ps.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

export function GradientDefs({ clarity }: { readonly clarity: boolean }) {
  const palette = gradePalette(clarity)
  return (
    <>
      {Object.entries(palette).map(([tier, tone]) => (
        <FaceGradient key={tier} id={`svgb-g${tier}`} tone={tone} />
      ))}
      <FaceGradient id="svgb-gcommander" tone={faceTone('commander', null, clarity)} />
      <FaceGradient id="svgb-gdummy" tone={faceTone('noAcb', null, clarity)} />
      <pattern id="svgb-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      </pattern>
      <pattern id="svgb-threat" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke={OVERLAY_LOOK.attack} strokeOpacity="0.55" strokeWidth="2" />
      </pattern>
      <marker id="svgb-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={OVERLAY_LOOK.path} stroke={OVERLAY_LOOK.pathOutline} strokeWidth="1" />
      </marker>
    </>
  )
}

// ---------------------------------------------------------------- prisms (iso) and flat terrain (top)

export interface PrismSpec {
  readonly key: string
  readonly anchor: Square
  readonly size: number
  /** Height in cells. */
  readonly height: number
  readonly top: string
  readonly side: string
  readonly opacity: number
  readonly symbol: string | null
  readonly symbolTint: string | null
  readonly label: string | null
}

export function Prism({ spec, proj, side }: { readonly spec: PrismSpec; readonly proj: Projection; readonly side: Side | null }) {
  const base = corners(proj, spec.anchor, spec.size, side)
  const lift = proj.lift(spec.height)
  const top = base.map((p) => ({ x: p.x, y: p.y + lift }))
  const edges = [0, 1, 2, 3].map((i) => {
    const j = (i + 1) % 4
    const a = base[i] as { x: number; y: number }
    const b = base[j] as { x: number; y: number }
    return { i, j, depth: (a.y + b.y) / 2 }
  })
  edges.sort((p, q) => p.depth - q.depth)
  const centre = { x: top.reduce((s, p) => s + p.x, 0) / 4, y: top.reduce((s, p) => s + p.y, 0) / 4 }
  return (
    <g opacity={spec.opacity}>
      {edges.map((e) => (
        <polygon
          key={e.i}
          points={points([base[e.i] as { x: number; y: number }, base[e.j] as { x: number; y: number }, top[e.j] as { x: number; y: number }, top[e.i] as { x: number; y: number }])}
          fill={spec.side}
          stroke="rgba(27,20,16,0.6)"
          strokeWidth="0.8"
        />
      ))}
      <polygon points={points(top)} fill={spec.top} stroke="rgba(27,20,16,0.7)" strokeWidth="1" />
      {spec.symbol !== null && (
        <g>
          <circle cx={centre.x} cy={centre.y} r={CELL * 0.62} fill="#F3EAD2" stroke={spec.symbolTint ?? '#2B1D0E'} strokeWidth="3" />
          <Glyph name={spec.symbol} x={centre.x} y={centre.y} size={CELL * 0.85} fill="#2B1D0E" />
        </g>
      )}
      {spec.label !== null && (
        <text x={centre.x} y={centre.y + CELL * 1.05} textAnchor="middle" className="svgb-building-label">
          {spec.label}
        </text>
      )}
    </g>
  )
}

export function FlatBlocker({ anchor, tall, side, fogged }: { readonly anchor: Square; readonly tall: boolean; readonly side: Side | null; readonly fogged: boolean }) {
  const r = rectOf(anchor, 1, side)
  const inset = tall ? 2 : 4
  return (
    <g opacity={fogged ? 0.75 : 1}>
      {tall && <rect x={r.u + 5} y={r.v + 6} width={r.w - 4} height={r.h - 4} rx="3" fill="rgba(0,0,0,0.45)" />}
      <rect x={r.u + inset} y={r.v + inset} width={r.w - inset * 2} height={r.h - inset * 2} rx={tall ? 2 : 6} fill={tall ? BOARD_LOOK.blockerTall : BOARD_LOOK.blockerLow} />
      <rect x={r.u + inset + 3} y={r.v + inset + 2} width={r.w - inset * 2 - 6} height={(r.h - inset * 2) * 0.45} rx={tall ? 1 : 4} fill={tall ? BOARD_LOOK.blockerTallTop : BOARD_LOOK.blockerLowTop} opacity="0.8" />
      {tall && <path d={`M ${r.u + r.w / 2 - 5} ${r.v + r.h / 2 + 4} L ${r.u + r.w / 2} ${r.v + r.h / 2 - 5} L ${r.u + r.w / 2 + 5} ${r.v + r.h / 2 + 4} Z`} fill="#F1E6C8" opacity="0.8" />}
    </g>
  )
}

export function FlatBuilding({ building, side, me, highlighted }: { readonly building: BuildingCore; readonly side: Side | null; readonly me: string; readonly highlighted: boolean }) {
  const size = buildingDef(building.kind).size
  const r = rectOf(building.anchor, size, side)
  const tint = controllerTint(building, me)
  const owner = building.controller === null ? 'Neutral' : building.controller === me ? 'Yours' : 'Opponent'
  return (
    <g>
      <rect x={r.u + 2} y={r.v + 2} width={r.w - 4} height={r.h - 4} rx="6" fill={BOARD_LOOK.building} stroke={tint} strokeWidth={highlighted ? 5 : 3} />
      <rect x={r.u + 9} y={r.v + 9} width={r.w - 18} height={r.h - 18} rx="4" fill={BOARD_LOOK.buildingRoof} />
      <circle cx={r.u + r.w / 2} cy={r.v + r.h / 2 - 4} r={CELL * 0.72} fill="#F3EAD2" stroke={tint} strokeWidth="3" />
      <Glyph name={BUILDING_SYMBOLS[building.kind]} x={r.u + r.w / 2} y={r.v + r.h / 2 - 4} size={CELL} fill="#2B1D0E" />
      <text x={r.u + r.w / 2} y={r.v + r.h - 7} textAnchor="middle" className="svgb-building-label">
        {buildingDef(building.kind).name.replace('The ', '')} · {owner}
      </text>
    </g>
  )
}

// ---------------------------------------------------------------- tokens

export interface TokenSpec {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly r: number
  readonly depth: number
  readonly unit: UnitView | null
  readonly ghost: Ghost | null
}

export const Token = memo(function Token({
  spec,
  mine,
  view,
  clarity,
  selected,
  acted,
  ready,
}: {
  readonly spec: TokenSpec
  readonly mine: boolean
  readonly view: PlayerView
  readonly clarity: boolean
  readonly selected: boolean
  readonly acted: boolean
  readonly ready: boolean
}) {
  const source = spec.unit ?? spec.ghost
  if (source === null) return null
  const commander = view.commanders[source.owner]
  const look = {
    type: source.type,
    tier: source.tier,
    mine,
    commander,
    clarity,
    power: source.power,
    toughness: source.toughness,
    maxToughness: source.maxToughness,
    acted,
    defending: spec.unit?.defending ?? false,
    stealthed: spec.unit?.stealthed ?? false,
    ghost: spec.ghost !== null,
    selected,
  }
  return (
    <g className={ready ? 'svgb-ready' : undefined}>
      <CoinShape cx={spec.x} cy={spec.y} r={spec.r} look={look} gradientId={gradientFor(source)} />
      {spec.ghost !== null && (
        <text x={spec.x} y={spec.y - spec.r - 3} textAnchor="middle" className="svgb-ghost-label">
          {spec.ghost.vanished ? 'vanished' : `seen R${spec.ghost.seenRound}`}
        </text>
      )}
    </g>
  )
})

// ---------------------------------------------------------------- path, floaters, flashes, chips

export function PathArrow({ view, from, size, path, hazards, side }: {
  readonly view: PlayerView
  readonly from: Square
  readonly size: number
  readonly path: readonly Square[]
  readonly hazards: readonly Square[]
  readonly side: Side | null
}) {
  if (path.length === 0) return null
  const nodes = [from, ...path].map((s) => centreOf(s, size, side))
  const segments = nodes.slice(1).map((n, i) => {
    const p = nodes[i] as { u: number; v: number }
    const target = path[i] as Square
    const fog = footprintSquares(target, size).some((s) => !isVisibleSquare(view, s))
    const hazard = hazards.some((h) => footprintSquares(target, size).some((s) => s.x === h.x && s.y === h.y))
    return { p, n, fog, hazard, last: i === path.length - 1 }
  })
  return (
    <g className="svgb-path" pointerEvents="none">
      {segments.map((s, i) => (
        <line key={`o${i}`} x1={s.p.u} y1={s.p.v} x2={s.n.u} y2={s.n.v} stroke={OVERLAY_LOOK.pathOutline} strokeWidth="9" strokeLinecap="round" opacity="0.7" />
      ))}
      {segments.map((s, i) => (
        <line
          key={`l${i}`}
          x1={s.p.u}
          y1={s.p.v}
          x2={s.n.u}
          y2={s.n.v}
          stroke={s.hazard ? OVERLAY_LOOK.hazard : OVERLAY_LOOK.path}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={s.fog || s.hazard ? '7 6' : undefined}
          markerEnd={s.last ? 'url(#svgb-arrow)' : undefined}
        />
      ))}
      <text x={nodes[nodes.length - 1]?.u ?? 0} y={(nodes[nodes.length - 1]?.v ?? 0) + 4} textAnchor="middle" className="svgb-step-badge">
        {path.length}
      </text>
    </g>
  )
}

export function Floaters({ floaters, side, proj, reducedMotion }: { readonly floaters: readonly Floater[]; readonly side: Side | null; readonly proj: Projection; readonly reducedMotion: boolean }) {
  return (
    <g pointerEvents="none">
      {floaters.map((f) => {
        const p = screenOf(proj, f.square, 1, side)
        return (
          <text key={f.id} x={p.x} y={p.y - CELL * 0.45} textAnchor="middle" className={`svgb-floater svgb-floater-${f.tone} ${reducedMotion ? 'svgb-still' : ''}`}>
            {f.text}
          </text>
        )
      })}
    </g>
  )
}

export function Flashes({ flashes, side, proj }: { readonly flashes: readonly Flash[]; readonly side: Side | null; readonly proj: Projection }) {
  return (
    <g pointerEvents="none">
      {flashes.map((f) => {
        const a = screenOf(proj, f.from, 1, side)
        const b = screenOf(proj, f.to, 1, side)
        return <line key={f.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="svgb-flash" stroke={OVERLAY_LOOK.damage} strokeWidth="4" strokeLinecap="round" />
      })}
    </g>
  )
}

const CHIP_FILL: Readonly<Record<BoardChip['tone'], string>> = {
  enemy: '#E4572E',
  ally: '#E5484D',
  heal: '#2BB3A3',
  lethal: '#7A0E0E',
  win: '#C9A23A',
  info: '#3A2E22',
}

export function Chips({ chips, side, proj }: { readonly chips: readonly BoardChip[]; readonly side: Side | null; readonly proj: Projection }) {
  return (
    <g pointerEvents="none">
      {chips.map((c, i) => {
        const p = screenOf(proj, c.square, 1, side)
        const width = Math.max(28, c.text.length * 6.4 + 10)
        return (
          <g key={i} transform={`translate(${p.x} ${p.y - CELL * 0.95})`}>
            <rect x={-width / 2} y={-9} width={width} height={17} rx="8" fill={CHIP_FILL[c.tone]} stroke="#1B1410" strokeWidth="1" />
            <text x={0} y={4} textAnchor="middle" className="svgb-chip">
              {c.text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function Coordinates({ side }: { readonly side: Side | null }) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXY'
  const last = BOARD_SIZE - 1
  return (
    <g className="svgb-coords" pointerEvents="none">
      {[...Array(BOARD_SIZE).keys()].map((i) => {
        const x = side === 'north' ? last - i : i
        const y = side === 'north' ? i : last - i
        return (
          <g key={i}>
            <text x={i * CELL + CELL / 2} y={BOARD_SIZE * CELL + 14} textAnchor="middle">
              {letters.charAt(x)}
            </text>
            <text x={-8} y={i * CELL + CELL / 2 + 4} textAnchor="end">
              {y + 1}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function MineMark({ x, y, mine, revealed }: { readonly x: number; readonly y: number; readonly mine: boolean; readonly revealed: boolean }) {
  return (
    <g opacity={mine ? 0.75 : 1} pointerEvents="none">
      <circle cx={x} cy={y} r={CELL * 0.27} fill="#3A3632" stroke={mine ? '#F1E6C8' : '#E4572E'} strokeWidth="2" strokeDasharray={mine ? '3 2' : undefined} />
      <Glyph name="teller-mine" x={x} y={y} size={CELL * 0.4} fill="#E9ECEF" />
      {revealed && mine && <circle cx={x} cy={y} r={CELL * 0.35} fill="none" stroke="#E4572E" strokeWidth="1.5" />}
    </g>
  )
}
