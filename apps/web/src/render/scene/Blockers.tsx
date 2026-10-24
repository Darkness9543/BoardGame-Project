// Blockers (A1-11, R36): low stone blocks, and taller pillars for the sight-blocking tall kind, which then also
// occlude in iso. Procedural instanced stones by default; the Kenney rock models from the asset manifest when
// present, with the stones as the loading and error fallback. Blockers wholly in fog are darkened.

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { BlockerKind, Square } from '@coinduel/engine'
import { adjustHex, BOARD_LOOK, FOG_LOOK } from '../../theme'
import { BLOCKER_MODEL_PATHS, useAssetManifest } from '../assets'
import { squareCentre } from '../coords'
import { useScene } from './context'
import { fitModel, tintModel, useModel, WithModel } from './models'

export interface Blocker {
  readonly square: Square
  readonly kind: BlockerKind
}

/** Deterministic jitter per square so the stones don't look stamped. */
function jitter(s: Square, salt: number): number {
  const n = Math.sin(s.x * 91.7 + s.y * 47.3 + salt * 13.1) * 24634.6345
  return n - Math.floor(n)
}

const SHAPES: Readonly<Record<BlockerKind, { readonly base: readonly [number, number, number]; readonly cap: readonly [number, number, number] }>> = {
  low: { base: [0.82, 0.3, 0.82], cap: [0.5, 0.2, 0.46] },
  tall: { base: [0.78, 1.25, 0.78], cap: [0.56, 0.32, 0.56] },
}

const MODEL_FIT: Readonly<Record<BlockerKind, { readonly span: number; readonly height: number }>> = {
  low: { span: 0.92, height: 0.48 },
  tall: { span: 0.86, height: 1.6 },
}

export const Blockers = memo(function Blockers({ blockers }: { readonly blockers: readonly Blocker[] }) {
  const manifest = useAssetManifest()
  return (
    <group>
      {(['low', 'tall'] as const).map((kind) => {
        const items = blockers.filter((b) => b.kind === kind)
        if (items.length === 0) return null
        const stones = <Stones kind={kind} items={items} />
        if (manifest?.has(BLOCKER_MODEL_PATHS[kind]) !== true) return <group key={kind}>{stones}</group>
        return (
          <WithModel key={kind} fallback={stones}>
            <ModelBlockers kind={kind} items={items} />
          </WithModel>
        )
      })}
    </group>
  )
})

function Stones({ kind, items }: { readonly kind: BlockerKind; readonly items: readonly Blocker[] }) {
  const { fogActive, isVisible } = useScene()
  const invalidate = useThree((s) => s.invalidate)
  const base = useRef<InstancedMesh>(null)
  const cap = useRef<InstancedMesh>(null)
  const shape = SHAPES[kind]
  const geometries = useMemo(
    () => ({
      base: new RoundedBoxGeometry(shape.base[0], shape.base[1], shape.base[2], 2, 0.07),
      cap: new RoundedBoxGeometry(shape.cap[0], shape.cap[1], shape.cap[2], 2, 0.06),
    }),
    [shape],
  )
  useEffect(
    () => () => {
      geometries.base.dispose()
      geometries.cap.dispose()
    },
    [geometries],
  )
  useLayoutEffect(() => {
    const dummy = new Object3D()
    const colour = new Color()
    const sideTone = kind === 'low' ? BOARD_LOOK.blockerLow : BOARD_LOOK.blockerTall
    const topTone = kind === 'low' ? BOARD_LOOK.blockerLowTop : BOARD_LOOK.blockerTallTop
    for (const [i, b] of items.entries()) {
      const c = squareCentre(b.square)
      const fog = fogActive && !isVisible(b.square) ? FOG_LOOK.objectBrightness : 1
      const scale = 0.92 + jitter(b.square, 1) * 0.12
      dummy.position.set(c.x, (shape.base[1] * scale) / 2, c.z)
      dummy.rotation.set(0, (jitter(b.square, 2) - 0.5) * 0.5, 0)
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      base.current?.setMatrixAt(i, dummy.matrix)
      base.current?.setColorAt(i, colour.set(adjustHex(sideTone, 1, (0.94 + jitter(b.square, 3) * 0.1) * fog)))
      dummy.position.set(c.x + (jitter(b.square, 4) - 0.5) * 0.18, shape.base[1] * scale + (shape.cap[1] * scale) / 2 - 0.03, c.z + (jitter(b.square, 5) - 0.5) * 0.18)
      dummy.rotation.set(0, jitter(b.square, 6) * Math.PI, 0)
      dummy.updateMatrix()
      cap.current?.setMatrixAt(i, dummy.matrix)
      cap.current?.setColorAt(i, colour.set(adjustHex(topTone, 1, fog)))
    }
    for (const mesh of [base.current, cap.current]) {
      if (mesh === null) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    invalidate()
  }, [items, kind, shape, fogActive, isVisible, invalidate])

  return (
    <group>
      <instancedMesh ref={base} args={[geometries.base, undefined, items.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.88} metalness={0.02} />
      </instancedMesh>
      <instancedMesh ref={cap} args={[geometries.cap, undefined, items.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.85} metalness={0.02} />
      </instancedMesh>
    </group>
  )
}

function ModelBlockers({ kind, items }: { readonly kind: BlockerKind; readonly items: readonly Blocker[] }) {
  const source = useModel(BLOCKER_MODEL_PATHS[kind])
  return (
    <group>
      {items.map((b) => (
        <ModelBlocker key={`${b.square.x},${b.square.y}`} source={source} blocker={b} />
      ))}
    </group>
  )
}

function ModelBlocker({ source, blocker }: { readonly source: Object3D; readonly blocker: Blocker }) {
  const { fogActive, isVisible } = useScene()
  const invalidate = useThree((s) => s.invalidate)
  const fit = MODEL_FIT[blocker.kind]
  const model = useMemo(() => fitModel(source, { span: fit.span, height: fit.height }), [source, fit])
  const fogged = fogActive && !isVisible(blocker.square)
  useLayoutEffect(() => {
    tintModel(model, fogged ? FOG_LOOK.objectBrightness : 1, 1)
    invalidate()
  }, [model, fogged, invalidate])
  const c = squareCentre(blocker.square)
  return <primitive object={model} position={[c.x, 0, c.z]} rotation-y={jitter(blocker.square, 2) * Math.PI * 2} />
}
