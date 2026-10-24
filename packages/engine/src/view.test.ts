import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { area3x3, parseSquare } from './geometry'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import type { GameState } from './types'
import { filterEvents, isVisibleSquare, projectView } from './view'
import { findLeaks } from './testing/fogLeak'

// Test-local Mind's Eye stand-in (A8-10): detection over the unit's LOV.
registerAbility({ id: 'juliomancer.mindsEye', status: 'implemented', detection: () => ({ kind: 'lov' }) }, { replace: true })

describe('projectView (4.2, 4.9)', () => {
  const b = buildBattle({
    south: ['ranger@E5:R', 'soldier@P5:S'],
    north: ['footman@E7:SEEN', 'paladin@E15:FAR', { type: 'rogue', at: 'E8', label: 'HID', stealthed: true }],
    mines: [
      { owner: 'north', at: 'F6', label: 'enemyMine' },
      { owner: 'south', at: 'P6', label: 'ownMine' },
      { owner: 'north', at: 'G5', revealed: true, label: 'revealedMine' },
    ],
  })
  const view = projectView(b.state, b.south)

  it('shows own units in full and visible enemies with public fields only', () => {
    const own = view.units.find((u) => u.id === b.id('R'))
    expect(own?.own?.turn).toEqual({ actionsUsed: 0, moves: 0, basicAttack: false, abilityUses: {}, flags: {} })
    expect(own?.attackRange).toBe(2)
    const enemy = view.units.find((u) => u.id === b.id('SEEN'))
    expect(enemy).toMatchObject({ type: 'footman', power: 1, toughness: 2, maxToughness: 2, own: null, stealthed: false })
  })

  it('hides enemies outside vision and invisible enemies inside it (A4-03)', () => {
    expect(view.units.some((u) => u.id === b.id('FAR'))).toBe(false)
    expect(isVisibleSquare(view, parseSquare('E8'))).toBe(true)
    expect(view.units.some((u) => u.id === b.id('HID'))).toBe(false)
  })

  it('hides unrevealed enemy mines, shows own and revealed ones in vision (A4-11, C32)', () => {
    expect(view.mines.map((m) => m.id).sort()).toEqual([b.mineIds['ownMine'], b.mineIds['revealedMine']].sort())
  })

  it('shows both AP totals (R15) but never enemy cooldowns or counters', () => {
    expect(view.opponentAp).toBe(0)
    expect(view.opponentApDebt).toBe(0)
    expect(JSON.stringify(view.units.filter((u) => u.owner !== b.south))).not.toContain('cooldowns')
  })

  it('passes the JSON fog-leak walk for both seats', () => {
    expect(findLeaks(b.state, b.south)).toEqual([])
    expect(findLeaks(b.state, b.north)).toEqual([])
  })

  it("does not report a seat's own death square when a hidden enemy stands on it later", () => {
    const fight = buildBattle({ south: ['footman@E5:A', 'footman@F5:B'], north: ['paladin@T20:H'] })
    const dead = fight.state.units.find((u) => u.id === fight.id('B'))
    const hidden = fight.state.units.find((u) => u.id === fight.id('H'))
    if (dead === undefined || hidden?.anchor == null) throw new Error('setup')
    const state: GameState = {
      ...fight.state,
      units: fight.state.units.filter((u) => u.id !== dead.id),
      fallen: [{ unit: { ...dead, anchor: hidden.anchor }, diedOnTurn: 1, cause: 'damage' }],
    }
    expect(projectView(state, fight.south).fallen.map((f) => f.anchor)).toEqual([hidden.anchor])
    expect(findLeaks(state, fight.south)).toEqual([])
  })

  it('clips enemy areas to vision (A4-13)', () => {
    const s = structuredCloneState(b.state)
    s.areas.push({ id: 'a-x', abilityId: 'royalWizard.pajazon', owner: b.north, sourceId: null, squares: area3x3(parseSquare('E9')), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 99, data: {} })
    const squares = projectView(s, b.south).areas.find((a) => a.id === 'a-x')?.squares ?? []
    expect(squares.length).toBeGreaterThan(0)
    expect(squares.length).toBeLessThan(9)
    expect(squares.every((sq) => isVisibleSquare(projectView(s, b.south), sq))).toBe(true)
    expect(projectView(s, b.north).areas.find((a) => a.id === 'a-x')?.squares).toHaveLength(9)
  })

  it('lifts the fog when the game ends (2.1 step 7)', () => {
    const ended = act(b.state, b.north, { kind: 'resign' }).state
    const final = projectView(ended, b.south)
    expect(final.units.some((u) => u.id === b.id('FAR'))).toBe(true)
    expect(final.mines).toHaveLength(3)
    expect(final.armies).not.toBeNull()
  })
})

function structuredCloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

describe('stealth reveals (4.4)', () => {
  it('R1: an enemy at distance 1 reveals a stealthed unit, and its owner is told', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: [{ type: 'rogue', at: 'E9', label: 'R', stealthed: true }] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6', 'E7', 'E8') })
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(false)
    expect(filterEvents(r.events, b.north)).toContainEqual({ type: 'unitRevealed', unitId: b.id('R'), cause: 'adjacency', byId: b.id('P') })
    expect(projectView(r.state, b.south).units.some((u) => u.id === b.id('R'))).toBe(true)
  })

  it('R2: damage inside enemy LOV reveals; damage nobody sees does not (A4-07, ROG-11)', () => {
    const watched = buildBattle({ south: ['ranger@E5:R'], north: [{ type: 'rogue', at: 'E7', label: 'G', stealthed: true }] })
    const r = act(watched.state, watched.south, { kind: 'attack', unitId: watched.id('R'), target: { kind: 'square', square: parseSquare('E7') } })
    expect(unitIn(r.state, watched.id('G'))).toMatchObject({ stealthed: false, toughness: 1 })
    expect(filterEvents(r.events, watched.south).some((e) => e.type === 'unitDamaged' && e.unitId === watched.id('G'))).toBe(true)
  })

  it('R3: detection (Mind\'s Eye) reveals stealthed units and mines inside its LOV (A4-08, A4-11)', () => {
    const b = buildBattle({
      south: ['juliomancer@E5:J'],
      north: [{ type: 'rogue', at: 'E10', label: 'R', stealthed: true }],
      mines: [{ owner: 'north', at: 'F9', label: 'm' }],
    })
    expect(unitIn(b.state, b.id('R'))?.stealthed).toBe(true)
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('J'), path: sqs('E6') })
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(true) // E10 is at distance 4: outside LOV 3
    const r2 = act(act(r.state, b.south, { kind: 'endTurn' }).state, b.north, { kind: 'endTurn' }).state
    const r3 = act(r2, b.south, { kind: 'move', unitId: b.id('J'), path: sqs('E7') })
    expect(unitIn(r3.state, b.id('R'))?.stealthed).toBe(false)
    expect(r3.state.mines[0]?.revealed).toBe(true)
    expect(projectView(r3.state, b.south).mines.map((m) => m.id)).toEqual([b.mineIds['m']])
  })
})

describe('filterEvents (4.8)', () => {
  it('drops other seats\' events and strips the audience field', () => {
    const b = buildBattle({ south: ['paladin@E5:P'] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6') })
    const mine = filterEvents(r.events, b.south)
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every((e) => !('visibleTo' in e))).toBe(true)
    expect(filterEvents(r.events, b.north).some((e) => e.type === 'unitMoved')).toBe(false)
    expect(filterEvents(r.events, b.north).some((e) => e.type === 'apChanged')).toBe(true) // R15: AP is public
  })

  it('hides an unseen attacker from the damaged side (A4-12)', () => {
    const b = buildBattle({ south: ['ranger@E5:R'], north: ['footman@E7:F'] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: { kind: 'unit', unitId: b.id('F') } })
    const theirs = filterEvents(r.events, b.north)
    expect(theirs).toContainEqual(expect.objectContaining({ type: 'unitDamaged', unitId: b.id('F'), dealerId: null }))
    expect(theirs.some((e) => e.type === 'unitAttacked')).toBe(false)
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'unitDamaged', dealerId: b.id('R') }))
  })
})
