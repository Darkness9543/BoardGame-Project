// Lights fixed in world space (outside the board group), so both seats see the same light on screen: a warm key
// light from the upper left with soft shadows, a sky/ground fill, and a procedural room environment that gives
// the brass and iron rims their reflections without downloading an HDR.
//
// The shadow map renders on demand (see shadowDirty.ts): the light and the board never move, so camera pans, zooms
// and the top/iso switch reuse the last map; only content changes (token moves, lifts, deaths, model loads) redraw it.

import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { markShadowsDirty, takeShadowsDirty } from './shadowDirty'

const SHADOW_EXTENT = 18
/** 1024 texels over 36 world units is about 28 per square: plenty for coin-sized casters under PCF filtering. */
const SHADOW_MAP = 1024

export function Lighting() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.32
    invalidate()
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, invalidate])

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    markShadowsDirty()
    invalidate()
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl, invalidate])

  // Runs before R3F's render (priority 0 callbacks run in registration order, all before the frame is drawn).
  useFrame(() => {
    if (takeShadowsDirty()) gl.shadowMap.needsUpdate = true
  })

  return (
    <>
      <hemisphereLight args={['#FFF4DF', '#4A3B2C', 0.7]} />
      <directionalLight
        castShadow
        position={[-12, 24, 5]}
        intensity={1.25}
        color="#FFF1DA"
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={3}
      />
    </>
  )
}
