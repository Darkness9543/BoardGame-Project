import { describe, expect, it } from 'vitest'
import { buildingDef } from './content/buildings'
import { scenarioDef } from './content/scenarios'
import {
  adjacentSquares,
  area3x3,
  backRowY,
  existingSquares,
  footprintDistance,
  footprintSquares,
  goalRowY,
  isOrthogonallyConnected,
  lovSquares,
  manhattan,
  parseSquare,
  ringSquares,
  sameSquare,
  slamSplash,
  sq,
  squareExists,
  squareName,
  squaresAtDistance,
  zoneSquares,
} from './geometry'
import type { Square } from './types'

describe('board shape (1.3, A1-02)', () => {
  it('rule A leaves 593 squares, 8 removed per corner', () => {
    expect(existingSquares('A', 4)).toHaveLength(593)
  })

  it.each([
    ['B', 613],
    ['C', 585],
    ['D', 573],
  ] as const)('alternative rule %s leaves %i squares', (rule, count) => {
    expect(existingSquares(rule, 4)).toHaveLength(count)
  })

  it('has 17 / 21 / 23 / 23 / 25 squares on rows 1-5 and the mirror on rows 21-25', () => {
    const perRow = (y: number) => existingSquares().filter((s) => s.y === y).length
    expect([0, 1, 2, 3, 4].map(perRow)).toEqual([17, 21, 23, 23, 25])
    expect([24, 23, 22, 21, 20].map(perRow)).toEqual([17, 21, 23, 23, 25])
    for (let y = 4; y <= 20; y++) expect(perRow(y)).toBe(25)
  })

  it('cuts the south-west corner as drawn in 1.3', () => {
    const row = (y: number) => ['A', 'B', 'C', 'D', 'E', 'F'].map((c) => (squareExists(parseSquare(`${c}${y}`)) ? '#' : '.')).join('')
    expect([row(6), row(5), row(4), row(3), row(2), row(1)]).toEqual(['######', '######', '.#####', '.#####', '..####', '....##'])
  })

  it('is symmetric under a 90-degree turn', () => {
    for (const s of existingSquares()) expect(squareExists({ x: 24 - s.y, y: s.x })).toBe(true)
  })
})

describe('zones (5.2, A5-05)', () => {
  it.each(['south', 'north'] as const)('%s has 109 normal and 50 extended squares', (side) => {
    expect(zoneSquares(side, 'normal')).toHaveLength(109)
    expect(zoneSquares(side, 'extended')).toHaveLength(50)
  })

  it('places South on rows 1-7 and North on rows 19-25, with goal rows opposite (A1-01, A6-04)', () => {
    expect(new Set(zoneSquares('south', 'normal').map((s) => s.y))).toEqual(new Set([0, 1, 2, 3, 4]))
    expect(new Set(zoneSquares('south', 'extended').map((s) => s.y))).toEqual(new Set([5, 6]))
    expect(new Set(zoneSquares('north', 'normal').map((s) => s.y))).toEqual(new Set([20, 21, 22, 23, 24]))
    expect(new Set(zoneSquares('north', 'extended').map((s) => s.y))).toEqual(new Set([18, 19]))
    expect([backRowY('south'), goalRowY('south'), backRowY('north'), goalRowY('north')]).toEqual([0, 24, 24, 0])
  })
})

describe('distances and LOV (1.4)', () => {
  it.each([
    [1, 4],
    [2, 12],
    [3, 24],
    [4, 40],
    [5, 60],
    [6, 84],
  ])('LOV %i shows 2N(N+1) = %i squares around a centre unit', (lov, expected) => {
    expect(lovSquares(sq(12, 12), 1, lov).length - 1).toBe(expected)
  })

  it('LOV is clipped by the board edge (E1 has no D1 neighbour)', () => {
    expect(lovSquares(parseSquare('E1'), 1, 1).length - 1).toBe(2)
  })

  it('measures footprints by their nearest squares', () => {
    expect(footprintDistance(sq(0, 0), 2, sq(3, 0), 1)).toBe(2)
    expect(footprintDistance(sq(5, 5), 2, sq(7, 7), 1)).toBe(2)
    expect(footprintDistance(sq(5, 5), 2, sq(7, 7), 1, 'chebyshev')).toBe(1)
    expect(manhattan(sq(0, 0), sq(3, 4))).toBe(7)
  })

  it('a 1x1 unit has 4 adjacent squares; a 2x2 has 8 adjacent and 12 "including corners" (1.6)', () => {
    expect(adjacentSquares(sq(10, 10), 1)).toHaveLength(4)
    expect(adjacentSquares(sq(10, 10), 2)).toHaveLength(8)
    expect(squaresAtDistance(sq(10, 10), 2, 1, 'chebyshev')).toHaveLength(12)
  })

  it('a ring has 12 squares around a 2x2 (A6-06) and 16 around a 3x3 building (R32)', () => {
    expect(ringSquares(parseSquare('G13'), 2)).toHaveLength(12)
    expect(ringSquares(parseSquare('F12'), 3)).toHaveLength(16)
  })

  it('a 3x3 area has 9 squares and loses off-board ones (A1-07)', () => {
    expect(area3x3(sq(12, 12))).toHaveLength(9)
    expect(area3x3(parseSquare('E1'))).toHaveLength(5)
  })

  it('names squares as column letter + row number', () => {
    expect(parseSquare('M13')).toEqual({ x: 12, y: 12 })
    expect(squareName({ x: 0, y: 24 })).toBe('A25')
    expect(() => parseSquare('Z9')).toThrow()
  })
})

describe('Forceful slam template (8.12, A8-20)', () => {
  const beast = sq(10, 10)
  const own = [sq(10, 10), sq(11, 10), sq(10, 11), sq(11, 11)]

  it.each(adjacentSquares(beast, 2).map((t) => [t]))('target %o gets a 5-square splash away from the Beast', (target: Square) => {
    const splash = slamSplash(beast, 2, target)
    expect(splash).toHaveLength(5)
    expect(splash.some((s) => own.some((o) => sameSquare(o, s)))).toBe(false)
    expect(splash.some((s) => sameSquare(s, target))).toBe(false)
  })

  it('matches case 1 of the drawing: T north of the left column', () => {
    const splash = slamSplash(sq(0 + 5, 0 + 5), 2, sq(5, 7))
    expect(new Set(splash.map(squareName))).toEqual(new Set(['E9', 'F9', 'G9', 'E8', 'G8']))
  })
})

describe('Forcefield shapes (A8-18)', () => {
  it.each([
    ['O', [sq(0, 0), sq(1, 0), sq(0, 1), sq(1, 1)], true],
    ['I', [sq(0, 5), sq(1, 5), sq(2, 5), sq(3, 5)], true],
    ['T', [sq(5, 5), sq(6, 5), sq(7, 5), sq(6, 4)], true],
    ['S', [sq(5, 5), sq(6, 5), sq(6, 6), sq(7, 6)], true],
    ['diagonal', [sq(5, 5), sq(6, 6), sq(7, 7), sq(8, 8)], false],
    ['split', [sq(5, 5), sq(6, 5), sq(8, 5), sq(9, 5)], false],
    ['duplicate', [sq(5, 5), sq(5, 5), sq(6, 5), sq(7, 5)], false],
  ] as const)('%s shape: connected = %s', (_name, squares, expected) => {
    expect(isOrthogonallyConnected(squares)).toBe(expected)
  })
})

describe('Crossroads (1.8, A1-14, R32 with 3x3 buildings)', () => {
  const crossroads = scenarioDef('crossroads')
  const buildingSquares = crossroads.buildings.flatMap((b) => footprintSquares(b.anchor, buildingDef(b.kind).size))
  const blocked = (s: Square) => crossroads.blockers.some((b) => sameSquare(b, s)) || buildingSquares.some((b) => sameSquare(b, s))

  it('has 21 blockers outside every zone and ring, and 554 walkable squares', () => {
    expect(crossroads.blockers).toHaveLength(21)
    const zones = [...zoneSquares('south', 'normal'), ...zoneSquares('south', 'extended'), ...zoneSquares('north', 'normal'), ...zoneSquares('north', 'extended')]
    expect(crossroads.blockers.some((b) => zones.some((z) => sameSquare(z, b)))).toBe(false)
    const rings = crossroads.buildings.flatMap((b) => ringSquares(b.anchor, buildingDef(b.kind).size))
    expect(rings).toHaveLength(32)
    expect(rings.some((r) => blocked(r))).toBe(false)
    expect(existingSquares().filter((s) => !blocked(s))).toHaveLength(593 - 21 - 18)
  })

  it('centres both 3x3 buildings on row 13 and maps the Keep onto the Market under a 180-degree turn', () => {
    for (const b of crossroads.blockers) expect(crossroads.blockers.some((o) => sameSquare(o, { x: 24 - b.x, y: 24 - b.y }))).toBe(true)
    const keep = crossroads.buildings.find((b) => b.kind === 'keep')?.anchor
    const market = crossroads.buildings.find((b) => b.kind === 'market')?.anchor
    expect(keep).toEqual({ x: 5, y: 11 }) // centre (6, 12) = G13
    expect(keep && market && { x: 24 - (keep.x + 2), y: 24 - (keep.y + 2) }).toEqual(market)
  })

  it('keeps every walkable square connected', () => {
    const walkable = existingSquares().filter((s) => !blocked(s))
    expect(isOrthogonallyConnected(walkable)).toBe(true)
  })
})
