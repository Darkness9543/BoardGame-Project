import { describe, expect, it } from 'vitest'
import { parseSquare } from './geometry'
import { act, buildBattle, sqs } from './testing/dsl'
import { findEventLeaks } from './testing/fogLeak'
import { filterEvents } from './view'

describe('events never name a unit the receiving seat cannot see (4.8, A4-12)', () => {
  it("a dummy created in sight of an Artificer in the fog: the dummy is shown, not who made it", () => {
    const b = buildBattle({ south: ['artificer@E11:A'], north: ['soldier@E14:S'] })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('A'), abilityId: 'artificer.prototypeNoAcb', targets: [{ kind: 'square', square: parseSquare('E12') }] })
    const seen = filterEvents(r.events, b.north)
    expect(seen).toContainEqual(expect.objectContaining({ type: 'unitCreated', createdBy: null }))
    expect(JSON.stringify(seen)).not.toContain(b.id('A'))
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'unitCreated', createdBy: b.id('A') }))
    expect(findEventLeaks(b.state, r.state, b.north, r.events)).toEqual([])
  })

  it('a stealthed Rogue on an unwatched mine: the owner hears the explosion but not who set it off', () => {
    const b = buildBattle({ south: [{ type: 'rogue', at: 'E5', label: 'R', stealthed: true }], north: ['soldier@E20:S'], mines: [{ owner: 'north', at: 'E6' }] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('R'), path: sqs('E6') })
    const seen = filterEvents(r.events, b.north)
    expect(seen).toContainEqual(expect.objectContaining({ type: 'mineExploded', victimId: null, square: parseSquare('E6') }))
    expect(JSON.stringify(seen)).not.toContain(b.id('R'))
    expect(findEventLeaks(b.state, r.state, b.north, r.events)).toEqual([])
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'mineExploded', victimId: b.id('R') }))
  })

  it('a visible victim is still named to the mine owner', () => {
    const b = buildBattle({ south: ['soldier@E5:V'], north: ['soldier@E8:S'], mines: [{ owner: 'north', at: 'E6' }] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('V'), path: sqs('E6') })
    expect(filterEvents(r.events, b.north)).toContainEqual(expect.objectContaining({ type: 'mineExploded', victimId: b.id('V') }))
  })
})
