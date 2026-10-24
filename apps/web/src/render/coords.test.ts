import { describe, it, expect } from 'vitest'
import { Group, Vector3 } from 'three'
import { BOARD_SIZE } from '@coinduel/engine'
import { BOARD_HALF, boardYaw, footprintCentre, localToSquare, localToWorld, squareCentre, worldToLocal } from './coords'

describe('board coordinates', () => {
  it('maps every grid square to its centre and back', () => {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const c = squareCentre({ x, y })
        expect(localToSquare(c)).toEqual({ x, y })
        expect(localToSquare({ x: c.x + 0.45, z: c.z - 0.45 })).toEqual({ x, y })
      }
    }
  })

  it("draws South's back row at the bottom (+z) with column A on the left", () => {
    expect(squareCentre({ x: 0, y: 0 })).toEqual({ x: -BOARD_HALF, z: BOARD_HALF })
    expect(squareCentre({ x: 24, y: 24 })).toEqual({ x: BOARD_HALF, z: -BOARD_HALF })
  })

  it('returns null off the grid', () => {
    expect(localToSquare({ x: -BOARD_HALF - 0.6, z: 0 })).toBeNull()
    expect(localToSquare({ x: 0, z: BOARD_HALF + 0.6 })).toBeNull()
  })

  it('centres a size-2 footprint between its four squares (anchor = south-west)', () => {
    const a = squareCentre({ x: 3, y: 4 })
    expect(footprintCentre({ x: 3, y: 4 }, 2)).toEqual({ x: a.x + 0.5, z: a.z - 0.5 })
    expect(footprintCentre({ x: 3, y: 4 }, 1)).toEqual(a)
  })

  it("turns the board half a turn for North, so North's back row is at the bottom and column A on the right", () => {
    const yaw = boardYaw('north')
    const northBackRowA = localToWorld(squareCentre({ x: 0, y: 24 }), yaw)
    expect(northBackRowA.z).toBeCloseTo(BOARD_HALF)
    expect(northBackRowA.x).toBeCloseTo(BOARD_HALF)
    expect(boardYaw('south')).toBe(0)
  })

  it('inverts world and local coordinates for any yaw', () => {
    for (const yaw of [0, 0.3, Math.PI / 2, Math.PI, -2.1]) {
      const p = { x: 3.25, z: -7.5 }
      const back = worldToLocal(localToWorld(p, yaw), yaw)
      expect(back.x).toBeCloseTo(p.x)
      expect(back.z).toBeCloseTo(p.z)
    }
  })

  it("agrees with three.js's rotation.y", () => {
    for (const yaw of [Math.PI, 0.7]) {
      const group = new Group()
      group.rotation.y = yaw
      group.updateMatrixWorld()
      const world = group.localToWorld(new Vector3(2, 0, -5))
      const mine = localToWorld({ x: 2, z: -5 }, yaw)
      expect(mine.x).toBeCloseTo(world.x)
      expect(mine.z).toBeCloseTo(world.z)
    }
  })
})
