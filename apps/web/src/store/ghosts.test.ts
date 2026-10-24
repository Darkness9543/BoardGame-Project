import { describe, expect, it } from 'vitest'
import { buildBattle, filterEvents, parseSquare, projectView, startRecord, submit, unitIn, type Intent, type MatchRecord, type Seat } from '@coinduel/engine'
import { EMPTY_GHOSTS, ghostAt, updateGhosts, type GhostMemory } from './ghosts'

function step(record: MatchRecord, seat: Seat, intent: Intent): { record: MatchRecord; events: ReturnType<typeof filterEvents> } {
  const result = submit(record, seat, intent)
  if (!result.ok) throw new Error(result.message)
  return { record: result.record, events: filterEvents(result.events, 'host') }
}

function setup() {
  const b = buildBattle({ south: ['paladin@G5:P'], north: ['soldier@G7:S'] })
  return { b, record: startRecord(b.state) }
}

describe('last-seen ghosts', () => {
  it('leaves a ghost where an enemy left vision, and clears it when that square is seen empty', () => {
    const { b, record } = setup()
    const before = projectView(record.state, 'host')
    expect(before.units.some((u) => u.id === b.id('S'))).toBe(true)

    const moved = step(record, 'host', { kind: 'move', unitId: b.id('P'), path: [parseSquare('G4'), parseSquare('G3')] })
    let memory: GhostMemory = updateGhosts(EMPTY_GHOSTS, before, projectView(moved.record.state, 'host'), moved.events)
    expect(memory.ghosts.map((g) => g.unitId)).toEqual([b.id('S')])
    expect(ghostAt(memory, parseSquare('G7'))?.toughness).toBe(7)
    expect(memory.ghosts[0]?.vanished).toBe(false)

    let r = step(moved.record, 'host', { kind: 'endTurn' })
    let view = projectView(r.record.state, 'host')
    memory = updateGhosts(memory, projectView(moved.record.state, 'host'), view, r.events)
    r = step(r.record, 'guest', { kind: 'move', unitId: b.id('S'), path: [parseSquare('G8')] })
    const prev = view
    view = projectView(r.record.state, 'host')
    memory = updateGhosts(memory, prev, view, r.events)
    expect(memory.ghosts.length).toBe(1)
    r = step(r.record, 'guest', { kind: 'endTurn' })
    memory = updateGhosts(memory, view, projectView(r.record.state, 'host'), r.events)
    const back = step(r.record, 'host', { kind: 'move', unitId: b.id('P'), path: [parseSquare('G4'), parseSquare('G5')] })
    memory = updateGhosts(memory, projectView(r.record.state, 'host'), projectView(back.record.state, 'host'), back.events)
    expect(memory.ghosts).toEqual([])
  })

  it('remembers a unit seen walking into the fog on the last square it stepped onto', () => {
    const b = buildBattle({ south: ['paladin@L8:P'], north: ['mercenary@L10:M'] })
    const view = projectView(b.state, b.south)
    const id = b.id('M')
    const fogged = parseSquare('L12')
    const hidden = [...view.visibility].map((c, i) => (i === fogged.y * 25 + fogged.x ? '0' : c)).join('')
    const next = { ...view, units: view.units.filter((u) => u.id !== id), visibility: hidden }
    const memory = updateGhosts(EMPTY_GHOSTS, view, next, [{ type: 'unitMoved', unitId: id, from: parseSquare('L11'), to: fogged }])
    expect(memory.ghosts.map((g) => [g.unitId, g.anchor, g.vanished])).toEqual([[id, fogged, false]])
  })

  it('keeps a unit that vanished in plain sight (Stealth) as a vanished ghost', () => {
    const b = buildBattle({ south: ['paladin@L8:P'], north: ['mercenary@L10:M'] })
    const view = projectView(b.state, b.south)
    const memory = updateGhosts(EMPTY_GHOSTS, view, { ...view, units: view.units.filter((u) => u.id !== b.id('M')) }, [])
    expect(memory.ghosts[0]?.vanished).toBe(true)
  })

  it('never ghosts the dead', () => {
    const b = buildBattle({ south: ['paladin@L8:P'], north: ['mercenary@L10:M'] })
    const view = projectView(b.state, b.south)
    const next = { ...view, units: view.units.filter((u) => u.id !== b.id('M')) }
    const died = [{ type: 'unitDied' as const, unitId: b.id('M'), unitType: 'mercenary' as const, owner: b.north, at: parseSquare('L10'), cause: 'damage' as const }]
    expect(updateGhosts(EMPTY_GHOSTS, view, next, died).ghosts).toEqual([])
  })

  it('a take-back of the action that created a ghost removes it (TB-8)', () => {
    const { b, record } = setup()
    const before = projectView(record.state, 'host')
    const moved = step(record, 'host', { kind: 'move', unitId: b.id('P'), path: [parseSquare('G4'), parseSquare('G3')] })
    let memory = updateGhosts(EMPTY_GHOSTS, before, projectView(moved.record.state, 'host'), moved.events)
    expect(memory.ghosts.length).toBe(1)
    const asked = step(moved.record, 'host', { kind: 'requestTakeback' })
    memory = updateGhosts(memory, projectView(moved.record.state, 'host'), projectView(asked.record.state, 'host'), asked.events)
    const undone = step(asked.record, 'guest', { kind: 'acceptTakeback' })
    memory = updateGhosts(memory, projectView(asked.record.state, 'host'), projectView(undone.record.state, 'host'), undone.events)
    expect(memory.ghosts).toEqual([])
  })

  it('a unit seen again is no longer a ghost, and the memory clears when the battle ends', () => {
    const { b, record } = setup()
    const view = projectView(record.state, 'host')
    const memory: GhostMemory = {
      ghosts: [
        { unitId: b.id('S'), type: 'soldier', owner: 'guest', anchor: parseSquare('A12'), size: 1, tier: 2, isCommander: false, power: 2, toughness: 7, maxToughness: 7, seenTurn: 1, seenRound: 1, vanished: false },
      ],
      history: [],
    }
    expect(updateGhosts(memory, view, view, []).ghosts).toEqual([])
    expect(updateGhosts(memory, view, { ...view, phase: 'ended' }, [])).toEqual(EMPTY_GHOSTS)
  })
})

describe('last-seen ghosts after a take-back (TB-8)', () => {
  it('leaves no marker for a unit that only the undone action revealed', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: ['soldier@E10:S'] })
    let record = startRecord(b.state)
    let memory = EMPTY_GHOSTS
    const run = (seat: Seat, intent: Intent): void => {
      const before = projectView(record.state, 'host')
      const r = step(record, seat, intent)
      record = r.record
      memory = updateGhosts(memory, before, projectView(record.state, 'host'), r.events)
    }
    expect(projectView(record.state, 'host').units.some((u) => u.id === b.id('S'))).toBe(false)
    run('host', { kind: 'move', unitId: b.id('P'), path: [parseSquare('E6'), parseSquare('E7'), parseSquare('E8')] })
    expect(projectView(record.state, 'host').units.some((u) => u.id === b.id('S'))).toBe(true) // the move revealed it
    run('host', { kind: 'requestTakeback' })
    run('guest', { kind: 'acceptTakeback' })
    expect(unitIn(record.state, b.id('P'))?.anchor).toEqual(parseSquare('E5'))
    expect(memory.ghosts).toEqual([])
    expect(ghostAt(memory, parseSquare('E10'))).toBeUndefined()
  })
})
