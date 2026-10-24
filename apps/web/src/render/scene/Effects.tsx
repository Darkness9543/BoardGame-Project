// Floating combat text and bursts (research-ux-conventions S-15.3): red damage, teal heals and status words
// (Blocked!, Mine!, Revealed!, Captured!), stacked so they don't overlap; an expanding ring where a mine goes off.
// The DOM text is CSS-animated (crisp, and calm under prefers-reduced-motion); the ticker keeps the demand
// frameloop drawing while the director has work.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Mesh, MeshBasicMaterial } from 'three'
import { buildingDef } from '@coinduel/engine'
import { FONTS, OVERLAY_LOOK, TOKEN_STATE_LOOK } from '../../theme'
import { footprintCentre, squareCentre, type Point2 } from '../coords'
import type { PlayedCue } from '../director'
import type { CueTarget, FloatTone } from '../timeline'
import type { BoardChip, BoardFloater, ChipTone } from '../types'
import { ringGeometry } from './coinGeometry'
import { LAYER_ORDER, LAYER_Y, useScene } from './context'

const FLOAT_HEIGHT = 0.55
const STACK_PX = 20
/** How long a UI-driven float shows (the UI sweeps it after about this long). */
const UI_FLOAT_MS = 1100
const CHIP_HEIGHT = 0.8

function toneColour(tone: FloatTone): string {
  switch (tone) {
    case 'damage':
      return TOKEN_STATE_LOOK.floatDamage
    case 'heal':
      return TOKEN_STATE_LOOK.floatHeal
    case 'status':
      return TOKEN_STATE_LOOK.floatStatus
    case 'warning':
      return TOKEN_STATE_LOOK.floatWarning
  }
}

/** Keeps frames coming while the director animates (render on demand otherwise idles). */
export function DirectorTicker({ version }: { readonly version: number }) {
  const { director } = useScene()
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [version, invalidate])
  useFrame(() => {
    if (performance.now() < director.busyUntil) invalidate()
  })
  return null
}

interface EffectsProps {
  readonly version: number
  /** Floats of a UI's own playback; they start when they first appear. */
  readonly floaters: readonly BoardFloater[]
  readonly chips: readonly BoardChip[]
}

export function Effects({ version, floaters, chips }: EffectsProps) {
  const { director, view } = useScene()
  const now = performance.now()
  const floats = useMemo(() => director.floats(), [director, version])
  const bursts = useMemo(() => director.bursts(), [director, version])
  const buildingPoint = (target: CueTarget): Point2 | null => {
    if (target.kind !== 'building') return null
    const b = view.buildings.find((x) => x.kind === target.building)
    return b === undefined ? null : footprintCentre(b.anchor, buildingDef(b.kind).size)
  }
  return (
    <group>
      {floats
        .filter((f) => f.at1 > now)
        .map((f) => {
          const at = buildingPoint(f.at) ?? director.targetPoint(f.at, f.at0)
          if (at === null) return null
          const lift = f.at.kind === 'building' ? 2.1 : FLOAT_HEIGHT
          return (
            <FloatText key={`${version}:${f.id}`} text={f.text} tone={f.tone} stack={f.stack} at={at} lift={lift} delay={Math.max(0, f.at0 - now)} duration={f.at1 - f.at0} />
          )
        })}
      {floaters.map((f, i) => (
        <FloatText
          key={`ui:${f.id}`}
          text={f.text}
          tone={f.tone}
          stack={floaters.slice(0, i).filter((o) => o.square.x === f.square.x && o.square.y === f.square.y).length}
          at={squareCentre(f.square)}
          lift={FLOAT_HEIGHT}
          delay={0}
          duration={UI_FLOAT_MS}
        />
      ))}
      {chips.map((c) => (
        <Chip key={`${c.square.x},${c.square.y}:${c.text}`} chip={c} />
      ))}
      {bursts
        .filter((b) => b.at1 > now)
        .map((b, i) => (
          <Burst key={`${version}:${i}`} cue={b} />
        ))}
    </group>
  )
}

interface FloatTextProps {
  readonly text: string
  readonly tone: FloatTone
  readonly stack: number
  readonly at: Point2
  readonly lift: number
  readonly delay: number
  readonly duration: number
}

function FloatText({ text, tone, stack, at, lift, delay, duration }: FloatTextProps) {
  const big = tone === 'damage' || tone === 'heal'
  return (
    <Html position={[at.x, lift, at.z]} center pointerEvents="none" zIndexRange={[30, 10]}>
      <div className="cdr-float-stack" style={{ transform: `translateY(${-stack * STACK_PX}px)` }}>
        <div
          className={big ? 'cdr-float cdr-float-big' : 'cdr-float'}
          style={{ color: toneColour(tone), fontFamily: FONTS.numbers, animationDelay: `${delay}ms`, animationDuration: `${Math.max(1, duration)}ms` }}
        >
          {text}
        </div>
      </div>
    </Html>
  )
}

function Burst({ cue }: { readonly cue: PlayedCue }) {
  const { reducedMotion } = useScene()
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const c = cue.kind === 'burst' ? squareCentre(cue.square) : { x: 0, z: 0 }
  useFrame(() => {
    const u = Math.min(1, Math.max(0, (performance.now() - cue.at0) / Math.max(1, cue.at1 - cue.at0)))
    const visible = performance.now() >= cue.at0
    if (mesh.current !== null) {
      mesh.current.visible = visible && u < 1
      mesh.current.scale.setScalar(reducedMotion ? 1 : 0.3 + 1.3 * u)
    }
    if (material.current !== null) material.current.opacity = (1 - u) * 0.9
  })
  return (
    <mesh ref={mesh} geometry={ringGeometry(0.18, 0.5)} rotation-x={-Math.PI / 2} position={[c.x, LAYER_Y.hover + 0.01, c.z]} renderOrder={LAYER_ORDER.badge}>
      <meshBasicMaterial ref={material} color={OVERLAY_LOOK.hazard} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function chipColours(tone: ChipTone): { readonly ink: string; readonly bg: string } {
  switch (tone) {
    case 'enemy':
      return { ink: OVERLAY_LOOK.damage, bg: 'rgba(27, 20, 16, 0.9)' }
    case 'ally':
      return { ink: OVERLAY_LOOK.hazard, bg: 'rgba(27, 20, 16, 0.9)' }
    case 'heal':
      return { ink: TOKEN_STATE_LOOK.floatHeal, bg: 'rgba(27, 20, 16, 0.9)' }
    case 'lethal':
      return { ink: '#FFF8E7', bg: OVERLAY_LOOK.lethal }
    case 'win':
      return { ink: '#1B1410', bg: OVERLAY_LOOK.highlight }
    case 'info':
      return { ink: '#F1E6C8', bg: 'rgba(27, 20, 16, 0.9)' }
  }
}

/** A forecast or result chip above a square (the UI's "-6 -> 14/20", LETHAL, WIN). */
function Chip({ chip }: { readonly chip: BoardChip }) {
  const c = squareCentre(chip.square)
  const colours = chipColours(chip.tone)
  return (
    <Html position={[c.x, CHIP_HEIGHT, c.z]} center pointerEvents="none" zIndexRange={[25, 10]}>
      <div className="cdr-chip" style={{ color: colours.ink, background: colours.bg, fontFamily: FONTS.numbers }}>
        {chip.text}
      </div>
    </Html>
  )
}
