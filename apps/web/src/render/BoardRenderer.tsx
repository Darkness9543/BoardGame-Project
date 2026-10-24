// The 3D board renderer (contracts.ts BoardRendererProps, plus the optional BoardRendererExtras). It draws only what
// the PlayerView holds and reports pointer input; it never decides what a click means. See README.md.

import { useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import { toast } from '../store/toasts'
import { probeGpu } from './gpuProbe'

/** The software-rendering warning is shown once per page load. */
let warnedSoftware = false
import { FONTS, OVERLAY_LOOK, OWNER_CUES, rgba } from '../theme'
import { boardYaw, localToWorld, squareCentre } from './coords'
import type { RigApi } from './scene/CameraRig'
import { Scene } from './scene/Scene'
import type { BoardRendererHandle, BoardViewProps } from './types'
import { useReducedMotion } from './useReducedMotion'
import { useSettings, type RenderQuality } from '../store/settings'
import './render.css'

/** Canvas settings per 3D quality preset (Options > Display > 3D quality). */
const QUALITY: Record<RenderQuality, { dpr: [number, number]; antialias: boolean; shadows: false | 'percentage' | 'soft' }> = {
  // 1x pixels, no MSAA, no shadow map: an integrated GPU can hold 144 Hz during camera glides.
  performance: { dpr: [1, 1], antialias: false, shadows: false },
  // Up to 1.5x pixels; MSAA; PCF shadows rendered on demand (shadowDirty.ts).
  balanced: { dpr: [1, 1.5], antialias: true, shadows: 'percentage' },
  // Up to 2x pixels; soft shadows.
  quality: { dpr: [1, 2], antialias: true, shadows: 'soft' },
}

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
  const quality = useSettings((s) => s.settings.renderQuality)
  const preset = QUALITY[quality]
  useEffect(() => {
    if (warnedSoftware) return
    const gpu = probeGpu()
    if (!gpu.software) return
    warnedSoftware = true
    toast(
      'Your browser is drawing the board without the graphics card (software rendering), so it will be slow. Enable hardware acceleration in the browser settings and relaunch it, or switch to the 2D board in Options.',
      'warn',
    )
    console.warn('[board] software WebGL renderer:', gpu.renderer)
  }, [])

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
        // Antialiasing is fixed at context creation, so a preset change remounts the canvas.
        key={quality}
        orthographic
        flat
        frameloop="demand"
        shadows={preset.shadows}
        dpr={preset.dpr}
        // 'default' power lets a dual-GPU laptop keep the integrated GPU (and its fans quiet).
        gl={{ antialias: preset.antialias, powerPreference: 'default' }}
        camera={{ position: [0, 80, 0], zoom: 30, near: 1, far: 220 }}
      >
        <Scene {...rest} reducedMotion={reducedMotion} rigApi={rigApi} faceYaw={faceYaw} />
      </Canvas>
    </div>
  )
}
