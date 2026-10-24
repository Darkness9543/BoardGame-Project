import { describe, it, expect } from 'vitest'
import { Matrix4, OrthographicCamera, Vector3 } from 'three'
import {
  clampTarget,
  DIMETRIC_ELEVATION,
  fitView,
  groundShift,
  lerpPose,
  occludes,
  panBy,
  poseBasis,
  poseFor,
  screenOffset,
  TOP_POSE,
  TRUE_ISOMETRIC_ELEVATION,
  zoomAt,
  type CameraPose,
  type Vec3,
} from './cameraMath'

const ISO = poseFor('iso')

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/** The ground point under a screen offset in pixels (y up). */
function groundUnder(target: { x: number; z: number }, zoom: number, px: number, py: number, pose: CameraPose) {
  const s = groundShift(px / zoom, py / zoom, pose)
  return { x: target.x + s.x, z: target.z + s.z }
}

describe('camera poses', () => {
  it('looks straight down in top view with the viewer\'s bottom edge (+z) at the bottom', () => {
    const b = poseBasis(TOP_POSE)
    expect(b.dir.y).toBeCloseTo(1)
    const close = (v: Vec3, x: number, y: number, z: number): void => {
      expect(v.x).toBeCloseTo(x)
      expect(v.y).toBeCloseTo(y)
      expect(v.z).toBeCloseTo(z)
    }
    close(b.up, 0, 0, -1)
    close(b.right, 1, 0, 0)
  })

  it('has an orthonormal right-handed basis in every pose', () => {
    for (const pose of [TOP_POSE, ISO, poseFor('iso', 'dimetric', 3), { elevation: 1.1, azimuth: -2 }]) {
      const { dir, up, right } = poseBasis(pose)
      expect(dot(dir, dir)).toBeCloseTo(1)
      expect(dot(up, up)).toBeCloseTo(1)
      expect(dot(right, right)).toBeCloseTo(1)
      expect(dot(dir, up)).toBeCloseTo(0)
      expect(dot(dir, right)).toBeCloseTo(0)
      expect(dot(up, right)).toBeCloseTo(0)
      // right x up = dir (three's camera looks along -z with x right and y up)
      const cross = { x: right.y * up.z - right.z * up.y, y: right.z * up.x - right.x * up.z, z: right.x * up.y - right.y * up.x }
      expect(cross.x).toBeCloseTo(dir.x)
      expect(cross.y).toBeCloseTo(dir.y)
      expect(cross.z).toBeCloseTo(dir.z)
    }
  })

  it('foreshortens the three axes equally in true isometric (35.264 degrees, 45 degrees)', () => {
    expect((TRUE_ISOMETRIC_ELEVATION * 180) / Math.PI).toBeCloseTo(35.264, 3)
    expect((DIMETRIC_ELEVATION * 180) / Math.PI).toBeCloseTo(30)
    const lengths = [
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ].map((axis) => Math.hypot(screenOffset(axis, { x: 0, z: 0 }, ISO).x, screenOffset(axis, { x: 0, z: 0 }, ISO).y))
    expect(lengths[0]).toBeCloseTo(Math.sqrt(2 / 3))
    expect(lengths[1]).toBeCloseTo(Math.sqrt(2 / 3))
    expect(lengths[2]).toBeCloseTo(Math.sqrt(2 / 3))
  })

  it('turns iso by 90-degree steps', () => {
    expect(poseFor('iso', 'true', 1).azimuth - poseFor('iso', 'true', 0).azimuth).toBeCloseTo(Math.PI / 2)
    expect(poseFor('top', 'true', 3)).toEqual(TOP_POSE)
  })

  it('matches a three.js orthographic camera built from the basis', () => {
    const pose = ISO
    const b = poseBasis(pose)
    const camera = new OrthographicCamera(-400, 400, 300, -300, 1, 200)
    camera.zoom = 20
    camera.position.set(1 + b.dir.x * 80, b.dir.y * 80, -2 + b.dir.z * 80)
    camera.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(b.right.x, b.right.y, b.right.z), new Vector3(b.up.x, b.up.y, b.up.z), new Vector3(b.dir.x, b.dir.y, b.dir.z)))
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const p = new Vector3(4, 0.5, 3)
    const ndc = p.clone().project(camera)
    const mine = screenOffset(p, { x: 1, z: -2 }, pose)
    expect(ndc.x * 400).toBeCloseTo(mine.x * 20)
    expect(ndc.y * 300).toBeCloseTo(mine.y * 20)
  })

  it('interpolates the azimuth along the shorter arc', () => {
    const a = { elevation: 1, azimuth: (350 * Math.PI) / 180 }
    const b = { elevation: 0.5, azimuth: (10 * Math.PI) / 180 }
    const mid = lerpPose(a, b, 0.5)
    expect(Math.cos(mid.azimuth)).toBeCloseTo(1)
    expect(mid.elevation).toBeCloseTo(0.75)
  })
})

describe('fitting, zooming and panning', () => {
  const board: Vec3[] = [
    { x: -12.5, y: 0, z: -12.5 },
    { x: 12.5, y: 0, z: -12.5 },
    { x: -12.5, y: 0, z: 12.5 },
    { x: 12.5, y: 0, z: 12.5 },
  ]

  it('fits the 25 x 25 board in top view to the smaller viewport side', () => {
    const fit = fitView(board, TOP_POSE, { width: 1000, height: 500 }, 0.1)
    expect(fit.zoom).toBeCloseTo((500 / 25) * 0.9)
    expect(fit.target.x).toBeCloseTo(0)
    expect(fit.target.z).toBeCloseTo(0)
  })

  it('fits the iso diamond (25 * sqrt 2 wide) and centres the flat board', () => {
    const fit = fitView([...board, { x: 0, y: 3, z: 0 }], ISO, { width: 1000, height: 1000 }, 0)
    expect(fit.zoom).toBeCloseTo(1000 / (25 * Math.SQRT2))
    const flat = fitView(board, ISO, { width: 1000, height: 1000 }, 0)
    expect(Math.hypot(flat.target.x, flat.target.z)).toBeCloseTo(0)
  })

  it('maps screen offsets to the ground in top view (screen up = -z)', () => {
    const s = groundShift(2, 3, TOP_POSE)
    expect(s.x).toBeCloseTo(2)
    expect(s.z).toBeCloseTo(-3)
  })

  it('keeps the ground point under the pointer fixed while zooming', () => {
    for (const pose of [TOP_POSE, ISO]) {
      const target = { x: 1.5, z: -2 }
      const before = groundUnder(target, 20, 130, -45, pose)
      const next = zoomAt(target, 20, 34, 130, -45, pose)
      const after = groundUnder(next, 34, 130, -45, pose)
      expect(after.x).toBeCloseTo(before.x)
      expect(after.z).toBeCloseTo(before.z)
    }
  })

  it('drags the grabbed ground point along with the pointer', () => {
    for (const pose of [TOP_POSE, ISO]) {
      const target = { x: 0, z: 0 }
      const grabbed = groundUnder(target, 25, 10, 10, pose)
      const next = panBy(target, 25, 60, -20, pose)
      const now = groundUnder(next, 25, 70, -10, pose)
      expect(now.x).toBeCloseTo(grabbed.x)
      expect(now.z).toBeCloseTo(grabbed.z)
    }
  })

  it('clamps the target to the board', () => {
    expect(clampTarget({ x: 40, z: -40 }, 13.5)).toEqual({ x: 13.5, z: -13.5 })
  })
})

describe('x-ray occlusion', () => {
  const keep = { x0: -1.5, x1: 1.5, z0: -1.5, z1: 1.5, height: 1.5 }

  it('hides a point just behind a building in iso, not one in front or far behind', () => {
    // The iso camera sits towards +x +z, so "behind" is towards -x -z.
    expect(occludes(keep, { x: -2, z: -2 }, ISO, 0)).toBe(true)
    expect(occludes(keep, { x: 2.5, z: 2.5 }, ISO, 0)).toBe(false)
    expect(occludes(keep, { x: -4, z: -4 }, ISO, 0)).toBe(false)
  })

  it('accounts for the half-turned North board', () => {
    expect(occludes(keep, { x: 2, z: 2 }, ISO, Math.PI)).toBe(true)
    expect(occludes(keep, { x: -2, z: -2 }, ISO, Math.PI)).toBe(false)
  })

  it('never occludes in top view, and never counts the building\'s own squares', () => {
    expect(occludes(keep, { x: -2, z: -2 }, TOP_POSE, 0)).toBe(false)
    expect(occludes(keep, { x: 0, z: 0 }, ISO, 0)).toBe(false)
  })
})
