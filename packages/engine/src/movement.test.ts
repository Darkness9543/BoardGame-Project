import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { validate } from './commands'
import { parseSquare, squareName } from './geometry'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import { filterEvents, projectView } from './view'

describe('path legality from the mover\'s knowledge (2.5, A2-15 .. A2-17)', () => {
  const b = buildBattle({
    south: ['paladin@E5:P', 'footman@E6:F', 'noAcb@K5:D'],
    north: ['berserker@F6:B'],
    settings: { scenarioId: 'crossroads' },
  })
  const move = (path: string[], unit = 'P') => validate(b.state, b.south, { kind: 'move', unitId: b.id(unit), path: sqs(...path) })

  it('accepts 1..Movement orthogonal steps, through own units', () => {
    expect(move(['D5']).ok).toBe(true)
    expect(move(['E6', 'E7']).ok).toBe(true)
    expect(move(['D5', 'D6', 'D7']).ok).toBe(true)
  })

  it('refuses diagonal steps, long paths, enemies, terrain and ending on a unit', () => {
    expect(move(['F6'])).toMatchObject({ ok: false, code: 'INVALID_PATH' }) // the Berserker is there and visible
    expect(move(['D6'])).toMatchObject({ ok: false, code: 'INVALID_PATH' }) // diagonal
    expect(move(['D5', 'D6', 'D7', 'D8'])).toMatchObject({ ok: false, code: 'PATH_TOO_LONG' })
    expect(move(['E6'])).toMatchObject({ ok: false, code: 'INVALID_PATH' }) // ends on the Footman
    expect(move(['D5', 'D6', 'D7']).ok).toBe(true)
    expect(validate(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: [] })).toMatchObject({ ok: false, code: 'INVALID_PATH' })
  })

  it('refuses blockers (Crossroads E9)', () => {
    const c = buildBattle({ south: ['paladin@E8:P'], settings: { scenarioId: 'crossroads' } })
    expect(validate(c.state, c.south, { kind: 'move', unitId: c.id('P'), path: sqs('E9') })).toMatchObject({ ok: false, code: 'INVALID_PATH' })
  })

  it('a Movement-0 dummy cannot move (A8-14)', () => {
    expect(move(['K6'], 'D')).toMatchObject({ ok: false, code: 'CANNOT_MOVE' })
  })
})

describe('walking the path against the truth', () => {
  it('stops before an enemy that was hidden at declaration ("Blocked!", A2-17, A4-14)', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: ['soldier@E8:S'] })
    expect(projectView(b.state, b.south).units.some((u) => u.id === b.id('S'))).toBe(false)
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6', 'E7', 'E8') })
    const paladin = unitIn(r.state, b.id('P'))
    expect(paladin?.anchor).toEqual(parseSquare('E7'))
    expect(paladin?.turn.moves).toBe(1)
    expect(r.state.seats[b.south].ap).toBe(20 - 2) // the Move's AP stays spent
    expect(filterEvents(r.events, b.south).find((e) => e.type === 'moveEnded')).toMatchObject({ reason: 'blocked' })
  })

  it('backs up over own units when a reaction stops it on one (2.5 step 7)', () => {
    // Test-local stand-in for Assault: any enemy stepping next to a Rogue is stopped (no attack).
    registerAbility({ id: 'rogue.assault', status: 'implemented', onAdjacencyGained: () => 'interrupt' }, { replace: true })
    const b = buildBattle({ south: ['paladin@E5:P', 'footman@E6'], north: ['rogue@D6:R'] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6', 'E7', 'E8') })
    expect(unitIn(r.state, b.id('P'))?.anchor).toEqual(parseSquare('E5'))
    expect(filterEvents(r.events, b.south).find((e) => e.type === 'moveEnded')).toMatchObject({ reason: 'reaction' })
  })

  it('sets off a mine on the path and stops there (A8-16, TMN-1); own mines included (L102)', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], mines: [{ owner: 'south', at: 'E6' }] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6', 'E7', 'E8') })
    const paladin = unitIn(r.state, b.id('P'))
    expect(paladin?.anchor).toEqual(parseSquare('E6'))
    expect(paladin?.toughness).toBe(18 - 3) // R21: 5 - 2
    expect(r.state.mines).toHaveLength(0)
    expect(filterEvents(r.events, b.south).find((e) => e.type === 'moveEnded')).toMatchObject({ reason: 'mine' })
  })

  it('moves a Size-2 unit as a block that needs every square open (1.6)', () => {
    const b = buildBattle({ south: ['beast@D7:B'], settings: { scenarioId: 'crossroads' } })
    expect(validate(b.state, b.south, { kind: 'move', unitId: b.id('B'), path: sqs('D8') })).toMatchObject({ ok: false, code: 'INVALID_PATH' }) // E9 blocker
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('B'), path: sqs('C7', 'C8') })
    expect(unitIn(r.state, b.id('B'))?.anchor).toEqual(parseSquare('C8'))
  })

  it('shows the opponent only the steps where the mover is visible (4.8)', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: ['ranger@E11:R'] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6', 'E7', 'E8') })
    const seen = filterEvents(r.events, b.north).flatMap((e) => (e.type === 'unitMoved' ? [squareName(e.to)] : []))
    expect(seen).toEqual(['E8']) // the Ranger's LOV 3 reaches down to E8 only
    expect(filterEvents(r.events, b.south).filter((e) => e.type === 'unitMoved')).toHaveLength(3)
  })
})
