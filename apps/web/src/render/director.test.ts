import { describe, it, expect } from 'vitest'
import type { Square, UnitId, UnitView, VisibleEvent } from '@coinduel/engine'
import { footprintCentre } from './coords'
import { AnimationDirector } from './director'
import { CUE_MS } from './timeline'

function unit(id: UnitId, anchor: Square, owner: 'host' | 'guest' = 'host'): UnitView {
  return {
    id,
    type: 'footman',
    owner,
    anchor,
    toughness: 2,
    defending: false,
    stealthed: false,
    isCommander: false,
    size: 1,
    tier: 1,
    power: 1,
    maxToughness: 2,
    lov: 1,
    movement: 1,
    attackRange: 1,
    own: null,
  }
}

function units(...list: UnitView[]): Map<UnitId, UnitView> {
  return new Map(list.map((u) => [u.id, u]))
}

const normal = { speed: 'normal', reducedMotion: false } as const

describe('animation director', () => {
  it('slides a unit whose anchor changed when no events came with the view', () => {
    const d = new AnimationDirector()
    const a = { x: 3, y: 3 }
    const b = { x: 3, y: 4 }
    d.ingest({ prev: units(unit('u', a)), next: units(unit('u', b)), events: null, options: normal, now: 1000 })
    expect(d.sample('u', 1, b, 1000)).toMatchObject(footprintCentre(a, 1))
    expect(d.sample('u', 1, b, 1000 + CUE_MS.slide)).toMatchObject(footprintCentre(b, 1))
    expect(d.busyUntil).toBe(1000 + CUE_MS.slide)
  })

  it('walks the event steps and then rests on the view anchor', () => {
    const d = new AnimationDirector()
    const events: VisibleEvent[] = [
      { type: 'unitMoved', unitId: 'u', from: { x: 1, y: 1 }, to: { x: 1, y: 2 } },
      { type: 'unitMoved', unitId: 'u', from: { x: 1, y: 2 }, to: { x: 1, y: 3 } },
    ]
    const end = { x: 1, y: 3 }
    d.ingest({ prev: units(unit('u', { x: 1, y: 1 })), next: units(unit('u', end)), events, options: normal, now: 0 })
    expect(d.sample('u', 1, end, 0)).toMatchObject(footprintCentre({ x: 1, y: 1 }, 1))
    expect(d.sample('u', 1, end, CUE_MS.step)).toMatchObject(footprintCentre({ x: 1, y: 2 }, 1))
    expect(d.sample('u', 1, end, 5000)).toMatchObject(footprintCentre(end, 1))
  })

  it('fades a new unit in and keeps a departing one until it has faded out', () => {
    const d = new AnimationDirector()
    d.ingest({ prev: units(unit('old', { x: 0, y: 5 })), next: units(unit('new', { x: 9, y: 9 })), events: null, options: normal, now: 0 })
    expect(d.sample('new', 1, { x: 9, y: 9 }, 0).opacity).toBe(0)
    expect(d.sample('new', 1, { x: 9, y: 9 }, CUE_MS.appear).opacity).toBe(1)
    const leaving = d.leavingUnits(10)
    expect(leaving.map((l) => l.unit.id)).toEqual(['old'])
    expect(d.sample('old', 1, { x: 0, y: 5 }, CUE_MS.appear / 2).opacity).toBeCloseTo(0.5)
    expect(d.leavingUnits(CUE_MS.appear + 1)).toEqual([])
  })

  it('plays a death where the unit fell', () => {
    const d = new AnimationDirector()
    const events: VisibleEvent[] = [{ type: 'unitDied', unitId: 'v', unitType: 'footman', owner: 'guest', at: { x: 4, y: 4 }, cause: 'damage' }]
    d.ingest({ prev: units(unit('v', { x: 4, y: 4 }, 'guest')), next: units(), events, options: normal, now: 0 })
    const [l] = d.leavingUnits(0)
    expect(l?.died).toBe(true)
    expect(l?.rest).toEqual({ x: 4, y: 4 })
    const mid = d.sample('v', 1, { x: 4, y: 4 }, CUE_MS.death / 2)
    expect(mid.opacity).toBeCloseTo(0.5)
    expect(mid.scale).toBeLessThan(1)
    expect(d.sample('v', 1, { x: 4, y: 4 }, CUE_MS.death + 1).opacity).toBe(0)
  })

  it('lunges the attacker towards its target and flashes the target', () => {
    const d = new AnimationDirector()
    const events: VisibleEvent[] = [
      { type: 'unitAttacked', attackerId: 'a', target: { kind: 'unit', unitId: 't' }, source: 'attack' },
      { type: 'unitDamaged', unitId: 't', amount: 1, toughness: 1, kind: 'attack', source: 'attack', dealerId: 'a', breakdown: [] },
    ]
    const map = units(unit('a', { x: 5, y: 5 }), unit('t', { x: 6, y: 5 }, 'guest'))
    d.ingest({ prev: map, next: map, events, options: normal, now: 0 })
    const peak = d.sample('a', 1, { x: 5, y: 5 }, CUE_MS.lunge / 2)
    expect(peak.x).toBeGreaterThan(footprintCentre({ x: 5, y: 5 }, 1).x + 0.2)
    expect(d.sample('t', 1, { x: 6, y: 5 }, CUE_MS.lunge / 2 + 1).flash).toBeGreaterThan(0.9)
    expect(d.floats().map((f) => f.text)).toEqual(['−1'])
  })

  it('glides on from where the token is drawn when views arrive faster than a slide (beat playback)', () => {
    const d = new AnimationDirector()
    const a = { x: 2, y: 2 }
    const b = { x: 2, y: 3 }
    const c = { x: 2, y: 4 }
    d.ingest({ prev: units(unit('u', a)), next: units(unit('u', b)), events: null, options: normal, now: 0 })
    const mid = CUE_MS.slide / 2
    const before = d.sample('u', 1, b, mid)
    d.ingest({ prev: units(unit('u', b)), next: units(unit('u', c)), events: null, options: normal, now: mid })
    const after = d.sample('u', 1, c, mid)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.z).toBeCloseTo(before.z)
    expect(d.sample('u', 1, c, mid + CUE_MS.slide)).toMatchObject(footprintCentre(c, 1))
  })

  it('shows a strike without events: the attacker lunges at the square and the victim flashes', () => {
    const d = new AnimationDirector()
    const map = units(unit('a', { x: 5, y: 5 }), unit('t', { x: 5, y: 6 }, 'guest'))
    d.ingest({ prev: map, next: map, events: null, options: normal, now: 0 })
    d.strike('a', { x: 5, y: 6 }, 't', normal, 100)
    expect(d.sample('a', 1, { x: 5, y: 5 }, 100 + CUE_MS.lunge / 2).z).toBeLessThan(footprintCentre({ x: 5, y: 5 }, 1).z - 0.2)
    expect(d.sample('t', 1, { x: 5, y: 6 }, 100 + CUE_MS.lunge / 2 + 1).flash).toBeGreaterThan(0.9)
    expect(d.busyUntil).toBeGreaterThan(100 + CUE_MS.lunge / 2)
  })

  it('animates nothing at instant speed', () => {
    const d = new AnimationDirector()
    d.ingest({ prev: units(unit('u', { x: 1, y: 1 })), next: units(unit('w', { x: 2, y: 2 })), events: null, options: { speed: 'instant', reducedMotion: false }, now: 0 })
    expect(d.leavingUnits(0)).toEqual([])
    expect(d.sample('w', 1, { x: 2, y: 2 }, 0).opacity).toBe(1)
    expect(d.busyUntil).toBe(0)
  })
})
