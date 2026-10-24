// glTF plumbing with graceful fallback: an error boundary that shows the procedural placeholder when a model is
// missing or broken, a loader without Draco/Meshopt (the packs are plain glTF, so nothing is fetched from a CDN),
// fitting a model into a box, and per-instance material clones for fog tint and x-ray.

import { Component, Suspense, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Color, Group, Mesh, Vector3, type Material, type Object3D } from 'three'
import { assetUrl } from '../assets'

interface BoundaryProps {
  readonly fallback: ReactNode
  readonly children: ReactNode
}

class AssetBoundary extends Component<BoundaryProps, { readonly failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Shows `fallback` while the model loads and if it fails. */
export function WithModel({ fallback, children }: BoundaryProps) {
  return (
    <AssetBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </AssetBoundary>
  )
}

export function useModel(path: string): Object3D {
  return useGLTF(assetUrl(path), false, false).scene
}

export interface FitBox {
  /** The larger horizontal side is scaled to this. */
  readonly span: number
  /** Target height (non-uniform Y scale), or null to keep the proportions. */
  readonly height: number | null
  /** Cap on the height when the proportions are kept. */
  readonly maxHeight?: number
}

/** A clone of `source` centred on the origin, standing on y = 0, scaled into the box, with cloned materials. */
export function fitModel(source: Object3D, box: FitBox): Group {
  const model = source.clone(true)
  const bounds = new Box3().setFromObject(model)
  const size = bounds.getSize(new Vector3())
  const centre = bounds.getCenter(new Vector3())
  const s = box.span / Math.max(size.x, size.z, 1e-6)
  let sy = box.height === null ? s : box.height / Math.max(size.y, 1e-6)
  if (box.height === null && box.maxHeight !== undefined) sy = Math.min(sy, box.maxHeight / Math.max(size.y, 1e-6))
  model.position.set(-centre.x * s, -bounds.min.y * sy, -centre.z * s)
  model.scale.set(s, sy, s)
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return
    o.castShadow = true
    o.receiveShadow = true
    o.material = Array.isArray(o.material) ? o.material.map(cloneMaterial) : cloneMaterial(o.material)
  })
  const group = new Group()
  group.add(model)
  return group
}

function cloneMaterial(m: Material): Material {
  const copy = m.clone()
  if ('color' in copy && copy.color instanceof Color) copy.userData['baseColor'] = copy.color.clone()
  return copy
}

/** Darkens a fitted model (fog) and fades it (x-ray), on its cloned materials. */
export function tintModel(root: Object3D, brightness: number, opacity: number): void {
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const material = m as Material & { color?: Color }
      const base = material.userData['baseColor']
      if (base instanceof Color && material.color !== undefined) material.color.copy(base).multiplyScalar(brightness)
      const faded = opacity < 1
      if (material.transparent !== faded || material.opacity !== opacity) {
        material.transparent = faded
        material.opacity = opacity
        material.depthWrite = !faded
        material.needsUpdate = true
      }
    }
  })
}
