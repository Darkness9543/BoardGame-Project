import { describe, expect, it } from 'vitest'
import { APPROACH_BOOST, MARKET_AP_BONUS, SIEGE_TURNS, apForRound } from './constants'
import { act, buildBattle } from './testing/dsl'
import { filterEvents, projectView } from './view'
import type { GameState, Seat } from './types'

// R32: the Keep is the 3x3 F12:H14 (ring E11:I15), the Market the 3x3 R12:T14 (ring Q11:U15).
const keepOf = (state: GameState) => state.buildings.find((b) => b.kind === 'keep')?.controller ?? null

function endTurn(state: GameState, seat: Seat) {
  return act(state, seat, { kind: 'endTurn' })
}

describe('building capture (6.4, R32)', () => {
  it('captures at the end of the turn when only one side is in the 16-square ring (A6-06, A6-07)', () => {
    const b = buildBattle({ south: ['footman@E11'], settings: { scenarioId: 'crossroads' } })
    expect(keepOf(b.state)).toBeNull()
    const r = endTurn(b.state, b.south)
    expect(keepOf(r.state)).toBe(b.south)
    expect(filterEvents(r.events, b.north)).toContainEqual({ type: 'buildingCaptured', building: 'keep', seat: b.south, previous: null })
  })

  it('counts corners of the ring but not squares further out', () => {
    expect(keepOf(endTurn(buildBattle({ south: ['footman@I15'] }).state, 'host').state)).toBe('host')
    expect(keepOf(endTurn(buildBattle({ south: ['footman@J15'] }).state, 'host').state)).toBeNull()
  })

  it('is contested when both sides are present, and announced publicly (C13)', () => {
    const b = buildBattle({ south: ['footman@E11'], north: ['footman@I15'], control: { keep: 'north' } })
    const r = endTurn(b.state, b.south)
    expect(keepOf(r.state)).toBe(b.north)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'buildingContested', building: 'keep' })
  })

  it('keeps control when the ring empties, and is retaken by the same method', () => {
    const b = buildBattle({ north: ['footman@E11'], control: { keep: 'south' } })
    const r = endTurn(b.state, b.south) // checked at the end of every turn, the non-capturer's included
    expect(keepOf(r.state)).toBe(b.north)
    const empty = buildBattle({ control: { keep: 'south' } })
    expect(keepOf(endTurn(empty.state, empty.south).state)).toBe(empty.south)
  })

  it('counts stealthed units and dummies, never mines (A6-08)', () => {
    const stealthy = buildBattle({ south: [{ type: 'rogue', at: 'E11', stealthed: true }], north: ['footman@I15'] })
    expect(filterEvents(endTurn(stealthy.state, stealthy.south).events, stealthy.north)).toContainEqual({ type: 'buildingContested', building: 'keep' })
    expect(keepOf(endTurn(buildBattle({ south: ['noAcb@E11'] }).state, 'host').state)).toBe('host')
    expect(keepOf(endTurn(buildBattle({ mines: [{ owner: 'south', at: 'E11' }] }).state, 'host').state)).toBeNull()
  })

  it('shows control to both players through fog', () => {
    const b = buildBattle({ south: ['footman@E11'] })
    const state = endTurn(b.state, b.south).state
    expect(projectView(state, b.north).buildings.find((x) => x.kind === 'keep')?.controller).toBe(b.south)
  })

  it('removes switched-off buildings from the scenario (A6-09)', () => {
    const b = buildBattle({ settings: { keepEnabled: false } })
    expect(b.state.buildings.map((x) => x.kind)).toEqual(['market'])
  })
})

describe('Market AP and the Siege win (R30, R31)', () => {
  it('gives the Market controller +2 AP at the start of its turns, after the cap', () => {
    const b = buildBattle({ control: { market: 'north' } })
    const north = endTurn(b.state, b.south).state
    expect(north.seats[b.north].ap).toBe(apForRound(1) * APPROACH_BOOST + MARKET_AP_BONUS)
  })

  it(`wins by Siege after holding both buildings at the start of ${SIEGE_TURNS} consecutive own turns`, () => {
    const b = buildBattle({ control: { keep: 'south', market: 'south' } })
    let state = b.state
    for (let i = 1; i < SIEGE_TURNS; i++) {
      state = endTurn(endTurn(state, b.south).state, b.north).state
      expect(state.seats[b.south].siegeTurns).toBe(i)
      expect(projectView(state, b.north).siegeTurns[b.south]).toBe(i) // public counter
    }
    state = endTurn(endTurn(state, b.south).state, b.north).state
    expect(state.result).toMatchObject({ winner: b.south, reason: 'siege' })
  })

  it('resets the Siege count when a building is lost, and needs both buildings enabled', () => {
    const b = buildBattle({ north: ['footman@Q11'], control: { keep: 'south', market: 'south' } })
    let state = endTurn(b.state, b.south).state // North's footman takes the Market at the end of South's turn
    expect(state.buildings.find((x) => x.kind === 'market')?.controller).toBe(b.north)
    state = endTurn(state, b.north).state
    expect(state.seats[b.south].siegeTurns).toBe(0)
    const single = buildBattle({ settings: { marketEnabled: false }, control: { keep: 'south' } })
    const later = endTurn(endTurn(single.state, single.south).state, single.north).state
    expect(later.seats[single.south].siegeTurns).toBe(0)
  })
})
