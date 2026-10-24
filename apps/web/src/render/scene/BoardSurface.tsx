// The sand-table board (research-art 10.1 B3): one instanced slab per existing square (A1-02: cut corners are
// simply absent), two sand tones with a little per-square variation, a darker underlay that shows in the gaps as a
// subtle grid, fogged squares dimmed and desaturated per instance (research-art 11 F3-lite), the war table below,
// the coordinate labels, and the invisible ground plane every square pick goes through.

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Square } from '@coinduel/engine'
import { adjustHex, BOARD_LOOK, FOG_LOOK, mixHex } from '../../theme'
import { BOARD_HALF, localToSquare, squareCentre, worldToLocal } from '../coords'
import { labelTexture } from '../textures/labels'
import { usePointer, useScene } from './context'
import { YawGroup } from './YawGroup'

const SLAB = { size: 0.95, height: 0.14 } as const
const TABLE_Y = -0.15
const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXY'

/** Deterministic 0..1 noise per square, for the slab tone variation. */
function noise(s: Square): number {
  const n = Math.sin(s.x * 127.1 + s.y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function slabColour(s: Square, fogged: boolean): string {
  const tone = (s.x + s.y) % 2 === 0 ? BOARD_LOOK.slabA : BOARD_LOOK.slabB
  const jittered = adjustHex(tone, 1, 0.975 + noise(s) * 0.05)
  if (!fogged) return jittered
  return adjustHex(mixHex(jittered, FOG_LOOK.tint, FOG_LOOK.tintAmount), FOG_LOOK.saturation, FOG_LOOK.brightness)
}

interface BoardSurfaceProps {
  readonly squares: readonly Square[]
  readonly showCoordinates: boolean
}

export const BoardSurface = memo(function BoardSurface({ squares, showCoordinates }: BoardSurfaceProps) {
  const { fogActive, isVisible, view } = useScene()
  const invalidate = useThree((s) => s.invalidate)
  const slabs = useRef<InstancedMesh>(null)
  const underlay = useRef<InstancedMesh>(null)
  const slabGeometry = useMemo(() => new RoundedBoxGeometry(SLAB.size, SLAB.height, SLAB.size, 2, 0.03), [])
  useEffect(() => () => slabGeometry.dispose(), [slabGeometry])

  useLayoutEffect(() => {
    const dummy = new Object3D()
    for (const [i, s] of squares.entries()) {
      const c = squareCentre(s)
      dummy.position.set(c.x, -SLAB.height / 2, c.z)
      dummy.updateMatrix()
      slabs.current?.setMatrixAt(i, dummy.matrix)
      dummy.position.set(c.x, -SLAB.height + 0.02, c.z)
      dummy.updateMatrix()
      underlay.current?.setMatrixAt(i, dummy.matrix)
    }
    for (const mesh of [slabs.current, underlay.current]) {
      if (mesh === null) continue
      mesh.count = squares.length
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    invalidate()
  }, [squares, invalidate])

  useLayoutEffect(() => {
    const mesh = slabs.current
    if (mesh === null) return
    const colour = new Color()
    for (const [i, s] of squares.entries()) mesh.setColorAt(i, colour.set(slabColour(s, fogActive && !isVisible(s))))
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true
    invalidate()
  }, [squares, fogActive, isVisible, view.visibility, invalidate])

  return (
    <group>
      <instancedMesh ref={slabs} args={[slabGeometry, undefined, squares.length]} receiveShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.93} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={underlay} args={[undefined, undefined, squares.length]} frustumCulled={false}>
        <boxGeometry args={[1.0, 0.04, 1.0]} />
        <meshStandardMaterial color={BOARD_LOOK.underlay} roughness={1} />
      </instancedMesh>
      <mesh rotation-x={-Math.PI / 2} position-y={TABLE_Y} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color={BOARD_LOOK.table} roughness={1} />
      </mesh>
      <PickingPlane />
      {showCoordinates && <Coordinates />}
    </group>
  )
})

function PickingPlane() {
  const { yaw, exists, unitAt } = useScene()
  const pointer = usePointer()
  const squareOf = (e: ThreeEvent<PointerEvent | MouseEvent>): Square | null => {
    const s = localToSquare(worldToLocal({ x: e.point.x, z: e.point.z }, yaw))
    return s !== null && exists(s) ? s : null
  }
  const click = (e: ThreeEvent<MouseEvent>, button: 'primary' | 'secondary'): void => {
    if (button === 'secondary') e.nativeEvent.preventDefault()
    if (pointer.suppressClick(e.delta)) return
    const s = squareOf(e)
    if (s === null) return
    const unit = unitAt(s)
    if (unit !== undefined) pointer.clickUnit(unit.id, button)
    else pointer.clickSquare(s, button)
  }
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      onPointerMove={(e) => pointer.hoverSquare(squareOf(e))}
      onPointerDown={(e) => {
        const s = squareOf(e)
        if (s === null) return
        if (e.pointerType === 'touch') pointer.hoverSquare(s)
        pointer.pressStart({ unitId: unitAt(s)?.id ?? null, square: s }, e.pointerType, e.clientX, e.clientY)
      }}
      onClick={(e) => click(e, 'primary')}
      onContextMenu={(e) => click(e, 'secondary')}
    >
      <planeGeometry args={[BOARD_HALF * 2 + 1, BOARD_HALF * 2 + 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  )
}

/** Absolute labels (S-6.1): letters along the viewer's bottom edge, numbers along the left edge. */
function Coordinates() {
  const { side } = useScene()
  const flip = side === 'north' ? -1 : 1
  const edge = BOARD_HALF + 0.95
  const y = TABLE_Y + 0.01
  const items = useMemo(() => {
    const out: { key: string; text: string; x: number; z: number }[] = []
    for (let i = 0; i < COLUMNS.length; i++) out.push({ key: `c${i}`, text: COLUMNS.charAt(i), x: i - BOARD_HALF, z: edge * flip })
    for (let r = 0; r < COLUMNS.length; r++) out.push({ key: `r${r}`, text: String(r + 1), x: -edge * flip, z: BOARD_HALF - r })
    return out
  }, [edge, flip])
  return (
    <group>
      {items.map((item) => (
        <YawGroup key={item.key} position={[item.x, y, item.z]}>
          <CoordinateLabel text={item.text} />
        </YawGroup>
      ))}
    </group>
  )
}

function CoordinateLabel({ text }: { readonly text: string }) {
  const label = useMemo(() => labelTexture(text, 'coordinate'), [text])
  const h = 0.42
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <planeGeometry args={[h * label.aspect, h]} />
      <meshBasicMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
