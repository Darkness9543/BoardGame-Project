// Lights fixed in world space (outside the board group), so both seats see the same light on screen: a warm key
// light from the upper left with soft shadows, a sky/ground fill, and a procedural room environment that gives
// the brass and iron rims their reflections without downloading an HDR.

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const SHADOW_EXTENT = 18

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

  return (
    <>
      <hemisphereLight args={['#FFF4DF', '#4A3B2C', 0.7]} />
      <directionalLight
        castShadow
        position={[-12, 24, 5]}
        intensity={1.25}
        color="#FFF1DA"
        shadow-mapSize={[2048, 2048]}
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
