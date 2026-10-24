// Coin dimensions (research-art 5.4 size and thickness ladders, 6.2 special tokens) and shared geometries.
// Geometries are cached per dimension and never disposed: there are only a handful of sizes.

import { CircleGeometry, CylinderGeometry, RingGeometry, TorusGeometry, type BufferGeometry } from 'three'
import type { UnitView } from '@coinduel/engine'
import { tierIndex, TOKEN_METRICS } from '../../theme'

export interface CoinSize {
  readonly radius: number
  readonly height: number
}

export function coinSize(unit: Pick<UnitView, 'isCommander' | 'type' | 'size' | 'tier'>): CoinSize {
  const m = TOKEN_METRICS
  if (unit.size === 2) return { radius: m.size2Diameter / 2, height: m.size2Height }
  if (unit.isCommander) return { radius: m.commanderDiameter / 2, height: m.commanderHeight }
  if (unit.type === 'noAcb' || unit.tier === null) return { radius: m.dummyDiameter / 2, height: m.dummyHeight }
  const i = tierIndex(unit.tier)
  return { radius: (m.diameterBase + m.diameterStep * i) / 2, height: m.heightBase + m.heightStep * i }
}

const cache = new Map<string, BufferGeometry>()

function cached<T extends BufferGeometry>(key: string, make: () => T): T {
  const hit = cache.get(key)
  if (hit !== undefined) return hit as T
  const g = make()
  cache.set(key, g)
  return g
}

/** The coin body, standing on y = 0. */
export function bodyGeometry(c: CoinSize, sides = 56): CylinderGeometry {
  return cached(`body|${c.radius}|${c.height}|${sides}`, () => {
    const g = new CylinderGeometry(c.radius, c.radius * 1.015, c.height, sides, 1)
    g.translate(0, c.height / 2, 0)
    return g
  })
}

/** The raised rim lip on the top edge, straddling it so it hides little of the face (lies flat after rotation). */
export function rimGeometry(c: CoinSize): TorusGeometry {
  const tube = Math.max(0.013, c.radius * 0.035)
  return cached(`rim|${c.radius}`, () => new TorusGeometry(c.radius - tube * 0.4, tube, 8, 64))
}

export function faceGeometry(radius: number, segments = 56): CircleGeometry {
  return cached(`face|${radius}|${segments}`, () => new CircleGeometry(radius, segments))
}

/** An arc of a flat ring, clockwise from 12 o'clock on screen; `fraction` is quantised so geometries are shared. */
export function arcGeometry(inner: number, outer: number, fromFraction: number, toFraction: number): RingGeometry {
  const q = (f: number): number => Math.round(Math.min(1, Math.max(0, f)) * 96) / 96
  const a = q(fromFraction)
  const b = q(toFraction)
  return cached(`arc|${inner}|${outer}|${a}|${b}`, () => {
    const length = Math.max(1e-4, (b - a) * Math.PI * 2)
    return new RingGeometry(inner, outer, 64, 1, Math.PI / 2 - b * Math.PI * 2, length)
  })
}

export function ringGeometry(inner: number, outer: number): RingGeometry {
  return cached(`ring|${inner}|${outer}`, () => new RingGeometry(inner, outer, 64, 1))
}
