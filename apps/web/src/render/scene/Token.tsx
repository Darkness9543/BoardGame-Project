// One coin token (research-art 6, research-ux-conventions 6.2): a T2 coin in the owner's metal (brass and smooth for
// you, iron and milled for the opponent) carrying the T1 face, lifted when selected, with a toughness arc, status
// badges, action pips and a forecast plate. Position, fades, lunges and hit flashes come from the director.

import { memo, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Color, Mesh, type Group, type Material, type MeshBasicMaterial } from 'three'
import { unitDef, type Square, type UnitView } from '@coinduel/engine'
import { COMMANDER_LOOK, OVERLAY_LOOK, OWNER_CUES, STAT_SYMBOLS, TOKEN_STATE_LOOK, type OwnerRole } from '../../theme'
import { assetUrl, commanderIcon, iconPath, unitGlyph, unitIcon } from '../assets'
import { footprintCentre, localToSquare, worldToLocal } from '../coords'
import { markShadowsDirty } from './shadowDirty'
import { badgeTexture, type BadgeKind } from '../textures/badges'
import { milledSideTexture } from '../textures/emblems'
import { faceTexture, type FaceVariant } from '../textures/faces'
import { labelTexture } from '../textures/labels'
import type { DamageForecast } from '../types'
import { arcGeometry, bodyGeometry, coinSize, faceGeometry, rimGeometry, ringGeometry, type CoinSize } from './coinGeometry'
import { LAYER_ORDER, usePointer, useScene } from './context'

export type TokenMode = 'live' | 'leaving' | 'ghost'

export interface TokenProps {
  readonly unit: UnitView
  /** Where it rests: the view's anchor, a leaving unit's last square, or where a ghost was last seen. */
  readonly anchor: Square
  readonly mode: TokenMode
  readonly selected: boolean
  readonly hovered: boolean
  readonly forecast: DamageForecast | null
  /** Own unit that can still act during my turn. */
  readonly ready: boolean
  /** Own unit with no actions left during my turn. */
  readonly acted: boolean
  readonly ghostLabel: string | null
  readonly vanished: boolean
}

const FLASH = new Color(OVERLAY_LOOK.damage)
const WHITE = new Color('#FFFFFF')
const LIFT_RATE = 14
/** A ghost appears once the unit it remembers has finished walking out of sight. */
const GHOST_FADE_MS = 240

/** Fades every material under `root` by `factor`, relative to the opacity each one was created with. */
function fade(root: Group, factor: number): void {
  root.traverse((o) => {
    if (!(o instanceof Mesh) || Array.isArray(o.material)) return
    const m = o.material as Material
    const stored: unknown = m.userData['baseOpacity']
    const base = typeof stored === 'number' ? stored : m.opacity
    m.userData['baseOpacity'] = base
    m.opacity = base * factor
  })
}

function faceVariant(mode: TokenMode, acted: boolean): FaceVariant {
  if (mode === 'ghost') return 'ghost'
  return acted ? 'acted' : 'normal'
}

function toughnessColour(fraction: number): string {
  if (fraction > 0.6) return OVERLAY_LOOK.toughnessHigh
  if (fraction > 0.3) return OVERLAY_LOOK.toughnessMid
  return OVERLAY_LOOK.toughnessLow
}

export const Token = memo(function Token(props: TokenProps) {
  const { unit, anchor, mode, selected, hovered, forecast, ready, acted, ghostLabel, vanished } = props
  const { view, mySeat, clarity, director, faceYaw, reducedMotion, yaw } = useScene()
  const pointer = usePointer()
  const invalidate = useThree((s) => s.invalidate)
  const root = useRef<Group>(null)
  const lift = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const faceMat = useRef<MeshBasicMaterial>(null)
  const liftNow = useRef(0)
  const lastFrame = useRef(0)
  const lastFade = useRef(-1)

  const role: OwnerRole = unit.owner === mySeat ? 'me' : 'opponent'
  const cue = OWNER_CUES[role]
  const size: CoinSize = coinSize(unit)
  const faction = unit.isCommander
    ? ((unit.owner === mySeat ? view.myArmy : view.armies?.[unit.owner])?.faction ?? null)
    : unitDef(unit.type).faction
  const texture = useMemo(
    () =>
      faceTexture({
        kind: unit.isCommander ? 'commander' : unit.type === 'noAcb' ? 'dummy' : 'unit',
        tier: unit.tier,
        symbol: unit.isCommander ? commanderIcon(view.commanders[unit.owner] ?? null) : unitIcon(unit.type),
        glyph: unitGlyph(unit.type),
        owner: role,
        faction,
        clarity,
        variant: faceVariant(mode, acted),
      }),
    [unit.isCommander, unit.type, unit.tier, unit.owner, view.commanders, role, faction, clarity, mode, acted],
  )
  const milled = cue.rim === 'milled' ? milledSideTexture() : null
  const baseOpacity = mode === 'ghost' ? TOKEN_STATE_LOOK.ghostOpacity : unit.stealthed ? TOKEN_STATE_LOOK.stealthOpacity : 1
  const goalLift = mode !== 'live' ? 0 : selected ? TOKEN_STATE_LOOK.selectedLift : hovered ? TOKEN_STATE_LOOK.hoverLift : 0
  const fraction = unit.maxToughness > 0 ? unit.toughness / unit.maxToughness : 0
  const after = forecast === null ? fraction : Math.max(0, unit.toughness - forecast.amount) / Math.max(1, unit.maxToughness)
  const lethal = forecast !== null && forecast.amount >= unit.toughness
  const showArc = mode !== 'ghost' && (fraction < 1 || hovered || selected || forecast !== null)
  const badges: BadgeKind[] = []
  if (unit.defending) badges.push('defending')
  if (unit.stealthed) badges.push('stealthed')
  if (vanished) badges.push('vanished')
  if (acted) badges.push('acted')
  if (lethal) badges.push('lethal')
  const own = unit.own
  const pips = mode === 'live' && own !== null && own.actionAllowance > 1 && view.turn?.activeSeat === mySeat ? own.actionAllowance : 0
  const pipsLeft = own === null ? 0 : Math.max(0, own.actionAllowance - own.turn.actionsUsed)

  const ghostSample = (now: number) => {
    const until = director.leavingUntil(unit.id)
    const shown = until === null ? 1 : Math.min(1, Math.max(0, (now - until) / GHOST_FADE_MS))
    const c = footprintCentre(anchor, unit.size)
    return { x: c.x, z: c.z, opacity: shown, scale: 1, dy: 0, flash: 0 }
  }

  useFrame(() => {
    const now = performance.now()
    const dt = lastFrame.current === 0 ? 1 / 60 : Math.min(0.1, (now - lastFrame.current) / 1000)
    lastFrame.current = now
    const s = mode === 'ghost' ? ghostSample(now) : director.sample(unit.id, unit.size, anchor, now)
    root.current?.position.set(s.x, 0, s.z)
    const k = reducedMotion ? 1 : 1 - Math.exp(-LIFT_RATE * dt)
    liftNow.current += (goalLift - liftNow.current) * k
    if (lift.current !== null) {
      lift.current.position.y = liftNow.current + s.dy
      lift.current.scale.setScalar(s.scale)
    }
    if (spin.current !== null) spin.current.rotation.y = faceYaw.current
    const opacity = baseOpacity * s.opacity
    if (lift.current !== null && opacity !== lastFade.current) {
      lastFade.current = opacity // traversing every mesh of every token each frame was pure waste while nothing faded
      fade(lift.current, opacity)
    }
    faceMat.current?.color.copy(WHITE).lerp(FLASH, s.flash * 0.75)
    if (Math.abs(goalLift - liftNow.current) > 0.0005 || (mode === 'ghost' && s.opacity < 1)) {
      markShadowsDirty() // the coin is still rising, sinking or fading, so its shadow changes this frame
      invalidate()
    }
  })

  const live = mode === 'live'
  const squareUnder = (e: ThreeEvent<PointerEvent | MouseEvent>): Square => {
    if (unit.size === 1) return anchor
    const s = localToSquare(worldToLocal({ x: e.point.x, z: e.point.z }, yaw))
    if (s === null) return anchor
    return { x: Math.min(anchor.x + unit.size - 1, Math.max(anchor.x, s.x)), y: Math.min(anchor.y + unit.size - 1, Math.max(anchor.y, s.y)) }
  }
  const handlers = live
    ? {
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          pointer.hoverUnit(unit.id, squareUnder(e))
        },
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          if (e.pointerType === 'touch') pointer.hoverUnit(unit.id, squareUnder(e))
          pointer.pressStart({ unitId: unit.id, square: squareUnder(e) }, e.pointerType, e.clientX, e.clientY)
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          if (!pointer.suppressClick(e.delta)) pointer.clickUnit(unit.id, 'primary')
        },
        onContextMenu: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          e.nativeEvent.preventDefault()
          if (!pointer.suppressClick(e.delta)) pointer.clickUnit(unit.id, 'secondary')
        },
      }
    : {}
  const r = size.radius
  const h = size.height
  const top = h + 0.004
  const badgeR = Math.max(0.1, r * 0.27)
  const badgeSpots: readonly (readonly [number, number])[] = [
    [-0.72, -0.72],
    [0.72, -0.72],
    [0.72, 0.72],
    [-0.72, 0.72],
  ]

  return (
    <group ref={root}>
      {live && (selected || hovered || ready) && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.006} geometry={ringGeometry(r + (selected ? 0.05 : 0.02), r + (selected ? 0.13 : hovered ? 0.06 : 0.05))} renderOrder={LAYER_ORDER.hover}>
          <meshBasicMaterial color={selected ? OVERLAY_LOOK.selection : hovered ? OVERLAY_LOOK.hover : cue.bezel} transparent opacity={selected ? 0.95 : hovered ? 0.8 : 0.45} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <group ref={lift}>
        <group ref={spin}>
          <mesh geometry={bodyGeometry(size)} castShadow={mode !== 'ghost' && !unit.stealthed} receiveShadow renderOrder={LAYER_ORDER.token} {...handlers}>
            <meshStandardMaterial color={milled === null ? cue.metal : '#FFFFFF'} metalness={cue.metalness} roughness={cue.roughness} map={milled} transparent />
          </mesh>
          <mesh geometry={rimGeometry(size)} rotation-x={-Math.PI / 2} position-y={h} renderOrder={LAYER_ORDER.token}>
            <meshStandardMaterial color={unit.isCommander ? COMMANDER_LOOK.rim : milled === null ? cue.metal : '#FFFFFF'} map={unit.isCommander ? null : milled} metalness={cue.metalness} roughness={cue.roughness * 0.8} transparent />
          </mesh>
          <mesh geometry={faceGeometry(r * 0.97)} rotation-x={-Math.PI / 2} position-y={top} renderOrder={LAYER_ORDER.token}>
            <meshBasicMaterial ref={faceMat} map={texture} transparent toneMapped={false} />
          </mesh>
          {showArc && <ToughnessArc radius={r} y={top + 0.004} fraction={fraction} after={after} />}
          {badges.map((kind, i) => {
            const spot = badgeSpots[i % badgeSpots.length] ?? [0, 0]
            return (
              <mesh key={kind} geometry={faceGeometry(badgeR, 32)} rotation-x={-Math.PI / 2} position={[spot[0] * r, top + 0.01, spot[1] * r]} renderOrder={LAYER_ORDER.badge}>
                <meshBasicMaterial map={badgeTexture(kind)} transparent depthWrite={false} toneMapped={false} />
              </mesh>
            )
          })}
          {pips > 1 && <ActionPips count={pips} left={pipsLeft} radius={r} y={top + 0.008} />}
          {ghostLabel !== null && <GhostLabel text={ghostLabel} radius={r} y={top + 0.012} />}
          {live && (hovered || selected || forecast !== null) && <StatPlate unit={unit} forecast={forecast} lethal={lethal} radius={r} y={h} />}
        </group>
      </group>
    </group>
  )
})

function ToughnessArc({ radius, y, fraction, after }: { readonly radius: number; readonly y: number; readonly fraction: number; readonly after: number }) {
  const inner = radius + 0.02
  const outer = radius + 0.065
  return (
    <group rotation-x={-Math.PI / 2} position-y={y}>
      <mesh geometry={ringGeometry(inner, outer)} renderOrder={LAYER_ORDER.badge}>
        <meshBasicMaterial color={OVERLAY_LOOK.toughnessTrack} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </mesh>
      {after > 0 && (
        <mesh geometry={arcGeometry(inner, outer, 0, after)} renderOrder={LAYER_ORDER.badge}>
          <meshBasicMaterial color={toughnessColour(fraction)} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {after < fraction && (
        <mesh geometry={arcGeometry(inner, outer, after, fraction)} renderOrder={LAYER_ORDER.badge}>
          <meshBasicMaterial color={after <= 0 ? OVERLAY_LOOK.lethal : '#FFFFFF'} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/** One pip per action of a multi-action unit (Market, Command Aura, Holy Fervor), lit while unused. */
function ActionPips({ count, left, radius, y }: { readonly count: number; readonly left: number; readonly radius: number; readonly y: number }) {
  return (
    <group position={[0, y, radius * 0.62]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} geometry={faceGeometry(0.045, 16)} rotation-x={-Math.PI / 2} position-x={(i - (count - 1) / 2) * 0.11} renderOrder={LAYER_ORDER.badge}>
          <meshBasicMaterial color={i < left ? OVERLAY_LOOK.selection : '#3A3029'} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function GhostLabel({ text, radius, y }: { readonly text: string; readonly radius: number; readonly y: number }) {
  const label = useMemo(() => labelTexture(text, 'badge'), [text])
  const h = 0.2
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y, radius * 0.7]} renderOrder={LAYER_ORDER.badge}>
      <planeGeometry args={[h * label.aspect, h]} />
      <meshBasicMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Inline style for drei `Html` overlays: they must never catch the pointer (see StatPlate). */
const HTML_PASSTHROUGH = { pointerEvents: 'none' } as const

/** Power and toughness under a hovered or selected token, and the forecast ("-8 -> 4", or LETHAL). */
function StatPlate(props: { readonly unit: UnitView; readonly forecast: DamageForecast | null; readonly lethal: boolean; readonly radius: number; readonly y: number }) {
  const { unit, forecast, lethal, radius, y } = props
  return (
    // drei applies `pointerEvents` only in transform mode; `style` and the wrapper class keep this plate from
    // stealing the pointer from the canvas (which cleared the hover and made the plate flicker).
    <Html position={[0, y, radius + 0.2]} center pointerEvents="none" style={HTML_PASSTHROUGH} wrapperClass="cdr-html" zIndexRange={[20, 0]}>
      <div className="cdr-plate">
        <PlateIcon symbol={STAT_SYMBOLS.power} />
        <span className="cdr-plate-power">{unit.power}</span>
        <PlateIcon symbol={STAT_SYMBOLS.toughness} />
        <span className={unit.toughness < unit.maxToughness ? 'cdr-plate-hurt' : ''}>{unit.toughness}</span>
        {unit.toughness < unit.maxToughness && <span className="cdr-plate-max">/{unit.maxToughness}</span>}
        {forecast !== null && (
          <span className={lethal ? 'cdr-plate-lethal' : 'cdr-plate-forecast'}>
            {forecast.uncertain === true ? '~' : ''}
            {`−${forecast.amount}`}
            {lethal ? ' lethal' : ` → ${Math.max(0, unit.toughness - forecast.amount)}`}
          </span>
        )}
      </div>
    </Html>
  )
}

/** A theme icon tinted with the text colour (CSS mask), crisp at any size. */
function PlateIcon({ symbol }: { readonly symbol: string }) {
  const url = `url("${assetUrl(iconPath(symbol))}")`
  return <span className="cdr-plate-icon" style={{ maskImage: url, WebkitMaskImage: url }} aria-hidden />
}
