// Every token on the board: my units and the enemy units I see, units still animating out of the view (walking into
// the fog, dying), last-seen ghosts, and known mines (mine own at reduced opacity with a dashed outline; revealed
// enemy mines with a warning ring).

import { memo, useMemo } from 'react'
import { Line } from '@react-three/drei'
import { footprintSquares, type MineView, type UnitId } from '@coinduel/engine'
import { MINE_LOOK, OWNER_CUES, TOKEN_METRICS } from '../../theme'
import { squareCentre, squareKey } from '../coords'
import { badgeTexture } from '../textures/badges'
import { mineTexture } from '../textures/emblems'
import type { DamageForecast, GhostMarker } from '../types'
import { faceGeometry } from './coinGeometry'
import { LAYER_ORDER, useScene } from './context'
import { Token } from './Token'

interface TokenLayerProps {
  readonly selectedId: UnitId | null
  readonly hoverUnitId: UnitId | null
  readonly forecasts: ReadonlyMap<UnitId, DamageForecast>
  readonly ghosts: readonly GhostMarker[]
  readonly highlightReady: boolean
  /** Exact 'can still act' set from the UI, or null to estimate from the view. */
  readonly readyUnits: ReadonlySet<UnitId> | null
  /** The director's version: a new value re-reads the leaving units. */
  readonly animationVersion: number
}

export const TokenLayer = memo(function TokenLayer(props: TokenLayerProps) {
  const { selectedId, hoverUnitId, forecasts, ghosts, highlightReady, readyUnits } = props
  const { view, mySeat, director, isMyTurn } = useScene()
  const units = view.units.filter((u) => u.anchor !== null)
  const leaving = director.leavingUnits(performance.now())
  const occupied = useMemo(() => {
    const keys = new Set<number>()
    for (const u of view.units) if (u.anchor !== null) for (const s of footprintSquares(u.anchor, u.size)) keys.add(squareKey(s))
    return keys
  }, [view.units])

  return (
    <group>
      {units.map((u) => {
        const anchor = u.anchor
        if (anchor === null) return null
        const own = u.owner === mySeat ? u.own : null
        const canAct = isMyTurn && own !== null && (readyUnits === null ? own.turn.actionsUsed < own.actionAllowance && view.myAp > 0 : readyUnits.has(u.id))
        return (
          <Token
            key={u.id}
            unit={u}
            anchor={anchor}
            mode="live"
            selected={u.id === selectedId}
            hovered={u.id === hoverUnitId}
            forecast={forecasts.get(u.id) ?? null}
            ready={highlightReady && canAct}
            acted={isMyTurn && own !== null && (readyUnits === null ? own.turn.actionsUsed >= own.actionAllowance : !readyUnits.has(u.id))}
            ghostLabel={null}
            vanished={false}
          />
        )
      })}
      {leaving.map((l) => (
        <Token
          key={`leaving:${l.unit.id}`}
          unit={l.unit}
          anchor={l.rest}
          mode="leaving"
          selected={false}
          hovered={false}
          forecast={null}
          ready={false}
          acted={false}
          ghostLabel={null}
          vanished={false}
        />
      ))}
      {ghosts.map((g) => {
        const anchor = g.unit.anchor
        if (anchor === null || footprintSquares(anchor, g.unit.size).some((s) => occupied.has(squareKey(s)))) return null
        return (
          <Token
            key={`ghost:${g.unit.id}`}
            unit={g.unit}
            anchor={anchor}
            mode="ghost"
            selected={false}
            hovered={false}
            forecast={null}
            ready={false}
            acted={false}
            ghostLabel={`R${g.seenRound}`}
            vanished={g.vanished}
          />
        )
      })}
      {view.mines.map((m) => (
        <MineToken key={m.id} mine={m} owned={m.owner === mySeat} />
      ))}
    </group>
  )
})

function MineToken({ mine, owned }: { readonly mine: MineView; readonly owned: boolean }) {
  const c = squareCentre(mine.square)
  const r = TOKEN_METRICS.mineDiameter / 2
  const h = TOKEN_METRICS.mineHeight
  const opacity = owned ? MINE_LOOK.ownerOpacity : 1
  const outline = useMemo(() => {
    const points: [number, number, number][] = []
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2
      points.push([Math.cos(a) * (r + 0.05), 0, Math.sin(a) * (r + 0.05)])
    }
    return points
  }, [r])
  return (
    <group position={[c.x, 0, c.z]}>
      <mesh position-y={h / 2} castShadow={!owned} renderOrder={LAYER_ORDER.token}>
        <cylinderGeometry args={[r, r * 1.05, h, 6]} />
        <meshStandardMaterial color={MINE_LOOK.face} metalness={0.55} roughness={0.5} transparent opacity={opacity} />
      </mesh>
      <mesh geometry={faceGeometry(r * 0.98, 6)} rotation-x={-Math.PI / 2} position-y={h + 0.003} renderOrder={LAYER_ORDER.token}>
        <meshBasicMaterial map={mineTexture()} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      <Line
        points={outline}
        position-y={0.012}
        color={owned ? OWNER_CUES.me.bezel : MINE_LOOK.revealedRing}
        lineWidth={0.035}
        worldUnits
        dashed={owned}
        dashSize={0.09}
        gapSize={0.06}
        transparent
        depthWrite={false}
        renderOrder={LAYER_ORDER.outline}
      />
      {owned && mine.revealed && (
        <mesh geometry={faceGeometry(0.1, 24)} rotation-x={-Math.PI / 2} position={[r * 0.75, h + 0.01, -r * 0.75]} renderOrder={LAYER_ORDER.badge}>
          <meshBasicMaterial map={badgeTexture('revealed')} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
