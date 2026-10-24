// The Keep and the Market (R32: 3x3, impassable terrain; research-art section 9). Each sits on a stone plinth, shows
// the KayKit model in the controller's colour variant (procedural placeholder while loading or when the file is
// missing), flies a banner when controlled, carries a camera-facing emblem badge, and outlines its 16-square
// capture ring (R32, A6-06): dashed gold while neutral, solid in the controller's tone. In iso a building turns
// to x-ray while it hides the hovered square or the selected unit (research-ux-conventions S-7.4).

import { memo, useLayoutEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Billboard, Line } from '@react-three/drei'
import { buildingDef, footprintSquares, ringSquares, type BuildingCore, type Seat, type Square } from '@coinduel/engine'
import { adjustHex, BOARD_LOOK, BUILDING_LOOK, FOG_LOOK, SIDE_TINT } from '../../theme'
import { buildingModelPath, useAssetManifest } from '../assets'
import { occludes } from '../cameraMath'
import { footprintCentre, type Point2 } from '../coords'
import { regionOutline, segmentPoints } from '../outline'
import { emblemTexture, type ControllerRole } from '../textures/emblems'
import { LAYER_ORDER, LAYER_Y, useScene } from './context'
import { fitModel, tintModel, useModel, WithModel } from './models'

const XRAY_OPACITY = 0.3
const PLACEHOLDER = { stone: '#A39377', wood: '#8A6A48' } as const
const EMBLEM_RADIUS = 0.42

function controllerRole(controller: Seat | null, mySeat: Seat): ControllerRole {
  if (controller === null) return 'neutral'
  return controller === mySeat ? 'me' : 'opponent'
}

interface BuildingsProps {
  /** Board-local points that must not be hidden (hovered square, selected unit, path end). */
  readonly keepVisible: readonly Point2[]
  readonly hover: Square | null
}

export const Buildings = memo(function Buildings({ keepVisible, hover }: BuildingsProps) {
  const { view } = useScene()
  return (
    <group>
      {view.buildings.map((b) => (
        <Building key={b.kind} building={b} keepVisible={keepVisible} hover={hover} />
      ))}
    </group>
  )
})

function modelHeight(kind: BuildingCore['kind']): number {
  return kind === 'keep' ? BUILDING_LOOK.keepHeight : BUILDING_LOOK.marketMaxHeight
}

function Building({ building, keepVisible, hover }: { readonly building: BuildingCore } & BuildingsProps) {
  const { mySeat, fogActive, isVisible, targetPose, yaw } = useScene()
  const manifest = useAssetManifest()
  const size = buildingDef(building.kind).size
  const role = controllerRole(building.controller, mySeat)
  const centre = footprintCentre(building.anchor, size)
  const footprint = useMemo(() => footprintSquares(building.anchor, size), [building.anchor, size])
  const ring = useMemo(() => ringSquares(building.anchor, size), [building.anchor, size])
  const fogged = fogActive && footprint.every((s) => !isVisible(s))
  const height = modelHeight(building.kind)
  const xray = useMemo(() => {
    const box = { x0: centre.x - size / 2, x1: centre.x + size / 2, z0: centre.z - size / 2, z1: centre.z + size / 2, height }
    return keepVisible.some((p) => occludes(box, p, targetPose, yaw))
  }, [centre.x, centre.z, size, height, keepVisible, targetPose, yaw])
  const brightness = fogged ? FOG_LOOK.objectBrightness : 1
  const opacity = xray ? XRAY_OPACITY : 1
  const path = buildingModelPath(building.kind, BUILDING_LOOK.model[role])
  const placeholder = <PlaceholderBuilding kind={building.kind} role={role} brightness={brightness} opacity={opacity} />
  const hovered = hover !== null && [...footprint, ...ring].some((s) => s.x === hover.x && s.y === hover.y)

  return (
    <group>
      <mesh position={[centre.x, 0.03, centre.z]} receiveShadow castShadow>
        <boxGeometry args={[size * 0.97, 0.06, size * 0.97]} />
        <meshStandardMaterial color={BOARD_LOOK.plinth} roughness={0.9} />
      </mesh>
      <group position={[centre.x, 0.06, centre.z]}>
        {manifest?.has(path) === true ? (
          <WithModel fallback={placeholder}>
            <BuildingModel path={path} span={size * BUILDING_LOOK.footprintFill} kind={building.kind} brightness={brightness} opacity={opacity} />
          </WithModel>
        ) : (
          placeholder
        )}
        {role !== 'neutral' && <Banner role={role} offset={size / 2 - 0.22} />}
        <Billboard position={[0, height + 0.55, 0]}>
          <mesh renderOrder={LAYER_ORDER.emblem}>
            <circleGeometry args={[EMBLEM_RADIUS, 48]} />
            <meshBasicMaterial map={emblemTexture(building.kind, role)} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
        </Billboard>
      </group>
      <CaptureRing ring={ring} role={role} highlighted={hovered} />
    </group>
  )
}

function BuildingModel(props: { readonly path: string; readonly span: number; readonly kind: BuildingCore['kind']; readonly brightness: number; readonly opacity: number }) {
  const { path, span, kind, brightness, opacity } = props
  const source = useModel(path)
  const invalidate = useThree((s) => s.invalidate)
  const model = useMemo(
    () => (kind === 'keep' ? fitModel(source, { span, height: BUILDING_LOOK.keepHeight }) : fitModel(source, { span, height: null, maxHeight: BUILDING_LOOK.marketMaxHeight })),
    [source, span, kind],
  )
  useLayoutEffect(() => {
    tintModel(model, brightness, opacity)
    invalidate()
  }, [model, brightness, opacity, invalidate])
  return <primitive object={model} />
}

function Banner({ role, offset }: { readonly role: Exclude<ControllerRole, 'neutral'>; readonly offset: number }) {
  const colour = BUILDING_LOOK.banner[role]
  return (
    <group position={[-offset, 0, -offset]}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 1.9, 8]} />
        <meshStandardMaterial color="#3B2A1A" roughness={0.7} />
      </mesh>
      <mesh position={[0.3, 1.66, 0]} castShadow>
        <boxGeometry args={[0.56, 0.36, 0.02]} />
        <meshStandardMaterial color={colour} roughness={0.75} metalness={role === 'me' ? 0.25 : 0.1} />
      </mesh>
    </group>
  )
}

function CaptureRing({ ring, role, highlighted }: { readonly ring: readonly Square[]; readonly role: ControllerRole; readonly highlighted: boolean }) {
  const points = useMemo(() => segmentPoints(regionOutline(ring), LAYER_Y.outline), [ring])
  return (
    <Line
      points={points}
      segments
      color={BUILDING_LOOK.ring[role]}
      lineWidth={highlighted ? 0.075 : 0.045}
      worldUnits
      dashed={role === 'neutral'}
      dashSize={0.28}
      gapSize={0.16}
      transparent
      opacity={highlighted ? 1 : 0.75}
      depthWrite={false}
      renderOrder={LAYER_ORDER.outline}
    />
  )
}

/** Procedural Keep (towers round a hall) and Market (stalls round a well), roofed in the controller's tint. */
function PlaceholderBuilding(props: { readonly kind: BuildingCore['kind']; readonly role: ControllerRole; readonly brightness: number; readonly opacity: number }) {
  const { kind, role, brightness, opacity } = props
  const transparent = opacity < 1
  const material = (hex: string, roughness: number) => (
    <meshStandardMaterial color={adjustHex(hex, 1, brightness)} roughness={roughness} transparent={transparent} opacity={opacity} depthWrite={!transparent} />
  )
  const stone = material(PLACEHOLDER.stone, 0.9)
  const roof = material(SIDE_TINT[role], 0.7)
  const wood = material(PLACEHOLDER.wood, 0.85)
  const corners: readonly (readonly [number, number])[] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]
  if (kind === 'keep') {
    return (
      <group>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.9, 1.5]} />
          {stone}
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow rotation-y={Math.PI / 4}>
          <coneGeometry args={[1.05, 0.5, 4]} />
          {roof}
        </mesh>
        {corners.map(([sx, sz]) => (
          <group key={`${sx},${sz}`} position={[sx * 0.95, 0, sz * 0.95]}>
            <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.33, 1.24, 12]} />
              {stone}
            </mesh>
            <mesh position={[0, 1.47, 0]} castShadow>
              <coneGeometry args={[0.4, 0.46, 12]} />
              {roof}
            </mesh>
          </group>
        ))}
      </group>
    )
  }
  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.5, 0.12, 2.5]} />
        {wood}
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.36, 16]} />
        {stone}
      </mesh>
      {corners.map(([sx, sz]) => (
        <group key={`${sx},${sz}`} position={[sx * 0.78, 0.12, sz * 0.78]}>
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.5, 0.56]} />
            {wood}
          </mesh>
          <mesh position={[0, 0.62, 0]} rotation-x={sz * 0.18} castShadow>
            <boxGeometry args={[0.9, 0.06, 0.74]} />
            {roof}
          </mesh>
        </group>
      ))}
    </group>
  )
}
