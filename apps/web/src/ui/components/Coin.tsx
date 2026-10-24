// The coin token (research-art 6.1 T1 face, 6.2 layout): grade colour on the face, the unit symbol, the grade
// numeral at 12 o'clock, a P/T plate below; the owner shown by the bezel's lightness and the rim's shape (smooth
// for you, milled for the opponent). Clarity mode adds rank pips. Drawn as SVG for cards, the tray and the
// placeholder board.

import { useId } from 'react'
import { unitDef } from '@coinduel/engine'
import { COMMANDER_LOOK, OWNER_CUES, rankPips, type GradeTone } from '../theme'
import { coinSymbol, faceTone, type CoinLook } from './coinLook'
import { Glyph } from './Icon'

/** One coin centred on (cx, cy) with radius r, inside an SVG. */
export function CoinShape({ cx, cy, r, look, gradientId }: { readonly cx: number; readonly cy: number; readonly r: number; readonly look: CoinLook; readonly gradientId: string }) {
  const cue = look.mine ? OWNER_CUES.me : OWNER_CUES.opponent
  const tone = faceTone(look.type, look.tier, look.clarity)
  const face = r * 0.8
  const dim = look.acted === true ? 0.55 : 1
  const opacity = look.ghost === true ? 0.38 : look.stealthed === true ? 0.5 : 1
  const showPlate = look.showPlate !== false && look.power !== undefined && look.toughness !== undefined
  const hurt = look.toughness !== undefined && look.maxToughness !== undefined && look.toughness < look.maxToughness
  const pips = look.clarity && look.tier !== null ? rankPips(look.tier) : 0
  return (
    <g opacity={opacity} style={look.ghost === true ? { filter: 'grayscale(1)' } : undefined}>
      <circle cx={cx} cy={cy + r * 0.06} r={r} fill="rgba(0,0,0,0.35)" />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.97}
        fill={cue.bezel}
        stroke={look.type === 'commander' ? COMMANDER_LOOK.rim : cue.edge}
        strokeWidth={r * (look.type === 'commander' ? 0.12 : 0.07)}
        strokeDasharray={cue.rim === 'milled' ? `${r * 0.11} ${r * 0.07}` : undefined}
        strokeDashoffset={0}
      />
      <circle cx={cx} cy={cy} r={face} fill={`url(#${gradientId})`} stroke="rgba(27,20,16,0.35)" strokeWidth={r * 0.03} />
      {look.acted === true && <circle cx={cx} cy={cy} r={face} fill="rgba(20,16,12,0.45)" />}
      <Glyph name={coinSymbol(look.type, look.commander)} x={cx} y={cy + (showPlate ? -r * 0.08 : 0)} size={face * 1.15} fill={tone.ink} opacity={dim} />
      {look.tier !== null && (
        <g>
          <rect x={cx - r * 0.3} y={cy - r * 1.02} width={r * 0.6} height={r * 0.36} rx={r * 0.12} fill={cue.bezel} stroke={cue.edge} strokeWidth={r * 0.03} />
          <text x={cx} y={cy - r * 0.75} textAnchor="middle" fontSize={r * 0.3} fontFamily="var(--font-numbers)" fontWeight={800} fill={cue.label}>
            {look.tier}
          </text>
        </g>
      )}
      {look.type === 'commander' && (
        <path
          d={`M ${cx - r * 0.34} ${cy - r * 0.7} L ${cx - r * 0.34} ${cy - r * 1.05} L ${cx - r * 0.17} ${cy - r * 0.88} L ${cx} ${cy - r * 1.12} L ${cx + r * 0.17} ${cy - r * 0.88} L ${cx + r * 0.34} ${cy - r * 1.05} L ${cx + r * 0.34} ${cy - r * 0.7} Z`}
          fill={COMMANDER_LOOK.crown}
          stroke={COMMANDER_LOOK.crownEdge}
          strokeWidth={r * 0.04}
        />
      )}
      {pips > 0 &&
        [...Array(pips).keys()].map((i) => {
          const angle = Math.PI * (0.62 + (0.76 * i) / Math.max(1, pips - 1))
          return <circle key={i} cx={cx + Math.cos(angle) * r * 0.88} cy={cy + Math.sin(angle) * r * 0.88} r={r * 0.06} fill={cue.label} />
        })}
      {showPlate && (
        <g>
          <rect x={cx - r * 0.52} y={cy + r * 0.52} width={r * 1.04} height={r * 0.4} rx={r * 0.12} fill="rgba(27,20,16,0.88)" />
          <text x={cx} y={cy + r * 0.83} textAnchor="middle" fontSize={r * 0.34} fontFamily="var(--font-numbers)" fontWeight={800} fill="#F1E6C8">
            {look.power}
            <tspan fill="#B9A98D">/</tspan>
            <tspan fill={hurt ? '#FF8A70' : '#F1E6C8'}>{look.toughness}</tspan>
          </text>
        </g>
      )}
      {look.defending === true && <Glyph name="checked-shield" x={cx - r * 0.78} y={cy - r * 0.72} size={r * 0.5} fill="#F1E6C8" />}
      {look.stealthed === true && <Glyph name="invisible" x={cx + r * 0.78} y={cy - r * 0.72} size={r * 0.5} fill="#E9DDFF" />}
      {look.selected === true && <circle cx={cx} cy={cy} r={r * 1.1} fill="none" stroke="var(--ov-selection)" strokeWidth={r * 0.1} />}
    </g>
  )
}

/** Gradient for one face tone (the lit coin face: highlight -> base -> shadow). */
export function FaceGradient({ id, tone }: { readonly id: string; readonly tone: GradeTone }) {
  return (
    <radialGradient id={id} cx="38%" cy="32%" r="75%">
      <stop offset="0%" stopColor={tone.highlight} />
      <stop offset="55%" stopColor={tone.base} />
      <stop offset="100%" stopColor={tone.shadow} />
    </radialGradient>
  )
}

/** A standalone coin for HTML (cards, tray, unit panel). */
export function Coin({ look, size = 44, title }: { readonly look: CoinLook; readonly size?: number; readonly title?: string }) {
  const id = `coin${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const tone = faceTone(look.type, look.tier, look.clarity)
  return (
    <svg className="coin" width={size} height={size} viewBox="-60 -64 120 128" role="img" aria-label={title ?? unitDef(look.type).name}>
      <defs>
        <FaceGradient id={id} tone={tone} />
      </defs>
      <CoinShape cx={0} cy={0} r={50} look={look} gradientId={id} />
    </svg>
  )
}
