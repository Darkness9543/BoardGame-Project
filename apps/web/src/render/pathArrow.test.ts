import { describe, it, expect } from 'vitest'
import type { Square } from '@coinduel/engine'
import { footprintCentre } from './coords'
import { arrowHead, pathRuns, stepKind, trimEnd, type PathKnowledge } from './pathArrow'

const key = (s: Square): string => `${s.x},${s.y}`

function knowledge(fogged: readonly Square[] = [], mines: readonly Square[] = []): PathKnowledge {
  const fog = new Set(fogged.map(key))
  const mine = new Set(mines.map(key))
  return { isVisible: (s) => !fog.has(key(s)), hasKnownMine: (s) => mine.has(key(s)) }
}

describe('path arrow runs', () => {
  const start = { x: 5, y: 5 }
  const path = [
    { x: 5, y: 6 },
    { x: 5, y: 7 },
    { x: 6, y: 7 },
  ]

  it('draws a clear path as one run through every footprint centre, starting at the unit', () => {
    const runs = pathRuns(start, path, 1, knowledge())
    expect(runs).toHaveLength(1)
    expect(runs[0]?.kind).toBe('clear')
    expect(runs[0]?.points).toEqual([start, ...path].map((s) => footprintCentre(s, 1)))
  })

  it('switches to a dashed fog run where the path enters fog, and an amber one into a known mine', () => {
    const runs = pathRuns(start, path, 1, knowledge([{ x: 5, y: 7 }], [{ x: 6, y: 7 }]))
    expect(runs.map((r) => r.kind)).toEqual(['clear', 'fog', 'hazard'])
    expect(runs[1]?.points[0]).toEqual(footprintCentre({ x: 5, y: 6 }, 1))
  })

  it('judges a size-2 step only on the squares it newly enters', () => {
    // Moving the 2x2 at (5,5) north enters (5,7) and (6,7); (5,6) and (6,6) are already covered.
    expect(stepKind({ x: 5, y: 5 }, { x: 5, y: 6 }, 2, knowledge([{ x: 5, y: 6 }]))).toBe('clear')
    expect(stepKind({ x: 5, y: 5 }, { x: 5, y: 6 }, 2, knowledge([{ x: 6, y: 7 }]))).toBe('fog')
    expect(pathRuns({ x: 5, y: 5 }, [{ x: 5, y: 6 }], 2, knowledge())[0]?.points[1]).toEqual(footprintCentre({ x: 5, y: 6 }, 2))
  })

  it('points the head along the last step (north is -z)', () => {
    const head = arrowHead(start, [{ x: 5, y: 6 }], 1)
    expect(head?.angle).toBeCloseTo(-Math.PI / 2)
    expect(head?.tip).toEqual(footprintCentre({ x: 5, y: 6 }, 1))
    expect(arrowHead(start, [], 1)).toBeNull()
  })

  it('trims the line end back to the arrowhead base', () => {
    const trimmed = trimEnd([{ x: 0, z: 0 }, { x: 2, z: 0 }], 0.5)
    expect(trimmed[1]).toEqual({ x: 1.5, z: 0 })
  })
})
