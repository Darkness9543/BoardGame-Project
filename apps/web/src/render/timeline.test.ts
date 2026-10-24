import { describe, it, expect } from 'vitest'
import type { VisibleEvent } from '@coinduel/engine'
import { buildTimeline, CUE_MS, firstActionTarget, type Cue } from './timeline'

const normal = { speed: 'normal', reducedMotion: false } as const

const walk: VisibleEvent[] = [
  { type: 'unitMoved', unitId: 'u-a', from: { x: 1, y: 1 }, to: { x: 1, y: 2 } },
  { type: 'unitMoved', unitId: 'u-a', from: { x: 1, y: 2 }, to: { x: 1, y: 3 } },
  { type: 'moveEnded', unitId: 'u-a', at: { x: 1, y: 3 }, reason: 'blocked' },
]

const strike: VisibleEvent[] = [
  { type: 'unitAttacked', attackerId: 'u-a', target: { kind: 'unit', unitId: 'u-b' }, source: 'attack' },
  { type: 'unitDamaged', unitId: 'u-b', amount: 5, toughness: 0, kind: 'attack', source: 'attack', dealerId: 'u-a', breakdown: [] },
  { type: 'unitDied', unitId: 'u-b', unitType: 'footman', owner: 'guest', at: { x: 2, y: 3 }, cause: 'damage' },
]

function kinds(cues: readonly Cue[]): string[] {
  return cues.map((c) => c.kind)
}

describe('animation timeline', () => {
  it('plays steps one after another and names an interruption', () => {
    const { cues } = buildTimeline(walk, normal)
    const steps = cues.filter((c) => c.kind === 'step')
    expect(steps.map((s) => [s.start, s.end])).toEqual([
      [0, CUE_MS.step],
      [CUE_MS.step, 2 * CUE_MS.step],
    ])
    const blocked = cues.find((c) => c.kind === 'float')
    expect(blocked?.kind === 'float' && blocked.text).toBe('Blocked!')
    expect(blocked?.start).toBe(2 * CUE_MS.step)
  })

  it('lands the damage number half-way through the lunge, then the death', () => {
    const { cues, duration } = buildTimeline(strike, normal)
    expect(kinds(cues)).toEqual(['lunge', 'hit', 'float', 'death'])
    const hit = cues.find((c) => c.kind === 'hit')
    expect(hit?.start).toBe(CUE_MS.lunge / 2)
    const float = cues.find((c) => c.kind === 'float')
    expect(float?.kind === 'float' && float.text).toBe('−5')
    expect(duration).toBeGreaterThan(CUE_MS.lunge)
  })

  it('halves the timing when fast, and drops the motion but keeps the numbers when instant', () => {
    const fast = buildTimeline(walk, { speed: 'fast', reducedMotion: false })
    expect(fast.cues.find((c) => c.kind === 'step')?.end).toBe(CUE_MS.step / 2)
    const instant = buildTimeline([...walk, ...strike], { speed: 'instant', reducedMotion: false })
    expect(kinds(instant.cues).every((k) => k === 'float')).toBe(true)
    expect(instant.cues).toHaveLength(2)
  })

  it('swaps travel and lunges for fades under reduced motion', () => {
    const { cues } = buildTimeline([...walk, ...strike], { speed: 'normal', reducedMotion: true })
    expect(kinds(cues)).not.toContain('step')
    expect(kinds(cues)).not.toContain('lunge')
    expect(kinds(cues)).toContain('death')
    expect(kinds(cues)).toContain('hit')
  })

  it('stacks overlapping numbers on the same target', () => {
    const twice: VisibleEvent[] = [
      { type: 'unitDamaged', unitId: 'u-b', amount: 3, toughness: 4, kind: 'tick', source: 'pajazon', dealerId: null, breakdown: [] },
      { type: 'unitHealed', unitId: 'u-b', amount: 1, toughness: 5, source: 'perseverance' },
    ]
    const floats = buildTimeline(twice, normal).cues.filter((c) => c.kind === 'float')
    expect(floats.map((f) => (f.kind === 'float' ? f.stack : -1))).toEqual([0, 1])
  })

  it('finds where the first visible action happens', () => {
    expect(firstActionTarget(walk)).toEqual({ kind: 'square', square: { x: 1, y: 1 } })
    expect(firstActionTarget(strike)).toEqual({ kind: 'unit', unitId: 'u-a' })
    expect(firstActionTarget([{ type: 'turnEnded', seat: 'host' }])).toBeNull()
  })
})
