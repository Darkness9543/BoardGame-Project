// A group that turns with the camera so flat faces and labels on the board stay upright on screen in both views
// and for both seats.

import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useScene } from './context'

const ORIGIN = [0, 0, 0] as const

export function YawGroup({ children, position = ORIGIN }: { readonly children: ReactNode; readonly position?: readonly [number, number, number] }) {
  const { faceYaw } = useScene()
  const ref = useRef<Group>(null)
  useFrame(() => {
    if (ref.current !== null) ref.current.rotation.y = faceYaw.current
  })
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  )
}
