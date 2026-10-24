import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { parseSquare, squareIndex } from './geometry'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import { lovIndices } from './vision'

// Test-local Ratasius detection stand-in (A7-14): reveals within Manhattan range 3 of the commander.
registerAbility({ id: 'ratasius.great', status: 'implemented', detection: () => ({ kind: 'range', range: 3 }) }, { replace: true })

describe('VISION_OCCLUSION (A1-12, R36 tall blockers)', () => {
  const blockers = new Set([squareIndex(parseSquare('M14'))])
  const isTerrain = (s: { x: number; y: number }) => blockers.has(squareIndex(s))

  it('without sight blockers LOV is the plain diamond', () => {
    const seen = lovIndices(parseSquare('M13'), 1, 2, null)
    expect(seen).toContain(squareIndex(parseSquare('M15')))
    expect(seen).toHaveLength(13)
  })

  it('a tall blocker is seen but blocks sight past it (flood fill within the LOV radius)', () => {
    const seen = lovIndices(parseSquare('M13'), 1, 2, isTerrain)
    expect(seen).toContain(squareIndex(parseSquare('M14')))
    expect(seen).not.toContain(squareIndex(parseSquare('M15')))
    expect(seen).toContain(squareIndex(parseSquare('L14')))
  })
})

describe('range detection (Ratasius, A4-08)', () => {
  it('reveals a stealthed enemy within range 3 of the detector, not at 4', () => {
    const b = buildBattle({
      south: ['commander@E5:C'],
      north: [{ type: 'rogue', at: 'E10', label: 'R', stealthed: true }],
      commanders: { south: 'ratasius' },
    })
    expect(unitIn(b.state, b.id('R'))?.stealthed).toBe(true)
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('C'), path: sqs('E6') })
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(true) // distance 4
    const r2 = act(act(r.state, b.south, { kind: 'endTurn' }).state, b.north, { kind: 'endTurn' }).state
    const r3 = act(r2, b.south, { kind: 'move', unitId: b.id('C'), path: sqs('E7') })
    expect(unitIn(r3.state, b.id('R'))?.stealthed).toBe(false) // distance 3
  })
})
