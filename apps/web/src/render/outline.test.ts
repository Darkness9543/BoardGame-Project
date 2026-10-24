import { describe, it, expect } from 'vitest'
import { existingSquares, squareExists, type Square } from '@coinduel/engine'
import { squareCentre } from './coords'
import { mergeCollinear, regionOutline, segmentPoints, type Segment } from './outline'

function length(segments: readonly Segment[]): number {
  return segments.reduce((sum, s) => sum + Math.hypot(s[2] - s[0], s[3] - s[1]), 0)
}

describe('region outlines', () => {
  it('outlines a single square with its four unit edges', () => {
    const c = squareCentre({ x: 12, y: 12 })
    const out = regionOutline([{ x: 12, y: 12 }])
    expect(out).toHaveLength(4)
    expect(length(out)).toBeCloseTo(4)
    for (const s of out) for (const v of [s[0], s[2]]) expect(Math.abs(v - c.x)).toBeCloseTo(0.5)
  })

  it('merges collinear edges so a 3 x 3 block has four sides of length 3', () => {
    const block: Square[] = []
    for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) block.push({ x, y })
    const out = regionOutline(block)
    expect(out).toHaveLength(4)
    for (const s of out) expect(Math.hypot(s[2] - s[0], s[3] - s[1])).toBeCloseTo(3)
  })

  it('keeps holes: a ring of 16 squares round a 3 x 3 has an outer and an inner boundary', () => {
    const ring: Square[] = []
    for (let y = 4; y < 9; y++) for (let x = 4; x < 9; x++) if (x === 4 || x === 8 || y === 4 || y === 8) ring.push({ x, y })
    expect(length(regionOutline(ring))).toBeCloseTo(20 + 12)
  })

  it('drops edges whose outside neighbour is filtered out (the fog line never runs along the board edge)', () => {
    const visible = existingSquares().filter((s) => s.y <= 2)
    const fogLine = regionOutline(visible, (outside) => squareExists(outside))
    for (const s of fogLine) expect(s[1]).toBeCloseTo(s[3])
    expect(fogLine.every((s) => Math.abs(s[1] - (12 - 2 - 0.5)) < 1e-9)).toBe(true)
  })

  it('does not bridge gaps between collinear edges', () => {
    expect(mergeCollinear([[0, 0, 1, 0], [2, 0, 3, 0]])).toHaveLength(2)
    expect(mergeCollinear([[0, 0, 1, 0], [1, 0, 2, 0]])).toEqual([[0, 0, 2, 0]])
  })

  it('flattens segments into point pairs at a height', () => {
    expect(segmentPoints([[0, 1, 2, 1]], 0.5)).toEqual([
      [0, 0.5, 1],
      [2, 0.5, 1],
    ])
  })
})
