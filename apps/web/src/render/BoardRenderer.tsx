// The 3D board renderer (contracts.ts BoardRendererProps, plus the optional BoardRendererExtras). It draws only what
// the PlayerView holds and reports pointer input; it never decides what a click means. See README.md.

import { useImperativeHandle, useRef, type CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import { FONTS, OVERLAY_LOOK, OWNER_CUES, rgba } from '../theme'
import { boardYaw, localToWorld, squareCentre } from './coords'
import type { RigApi } from './scene/CameraRig'
import { Scene } from './scene/Scene'
import type { BoardRendererHandle, BoardViewProps } from './types'
import { useReducedMotion } from './useReducedMotion'
import './render.css'

const PLATE_VARIABLES = {
  '--cdr-plate-bg': rgba('#1B1410', 0.88),
  '--cdr-plate-edge': rgba(OWNER_CUES.me.metal, 0.7),
  '--cdr-plate-ink': '#FFF8E7',
  '--cdr-hurt': OVERLAY_LOOK.toughnessMid,
  '--cdr-forecast': OVERLAY_LOOK.damage,
  '--cdr-lethal': OVERLAY_LOOK.lethal,
  '--cdr-font-numbers': FONTS.numbers,
} as const satisfies Record<string, string>

export function BoardRenderer(props: BoardViewProps) {
  const { ref, ...rest } = props
  const rigApi = useRef<RigApi | null>(null)
  const faceYaw = useRef(0)
  const yaw = boardYaw(props.view.side ?? 'south')
  const reducedMotion = useReducedMotion(props.reducedMotion)

  useImperativeHandle(
    ref,
    (): BoardRendererHandle => ({
      focus: (square) => rigApi.current?.focus(localToWorld(squareCentre(square), yaw)),
      fit: () => rigApi.current?.fit(),
      zoomBy: (factor) => rigApi.current?.zoomBy(factor),
      panBy: (dx, dy) => rigApi.current?.panBy(dx, dy),
      rotate: (steps) => rigApi.current?.rotate(steps),
      isOnScreen: (square) => rigApi.current?.isOnScreen(localToWorld(squareCentre(square), yaw)) ?? false,
    }),
    [yaw],
  )

  return (
    <div className={reducedMotion ? 'cdr-board cdr-reduced' : 'cdr-board'} style={PLATE_VARIABLES as CSSProperties}>
      <Canvas
        orthographic
        flat
        frameloop="demand"
        shadows="percentage"
        // Up to 1.5x device pixels: a 2x display would otherwise push 4x the pixels through MSAA and the shadow pass
        // for coins that already read crisply at 1.5x. 'default' power lets a dual-GPU laptop keep the integrated GPU
        // (and its fans quiet); the board needs no discrete GPU.
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'default' }}
        camera={{ position: [0, 80, 0], zoom: 30, near: 1, far: 220 }}
      >
        <Scene {...rest} reducedMotion={reducedMotion} rigApi={rigApi} faceYaw={faceYaw} />
      </Canvas>
    </div>
  )
}
