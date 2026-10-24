// The commanders against the real unit abilities, without stand-ins: the interaction rows of docs/analysis/abilities.md
// section 4 (and RULES_INTERPRETATION 8.17 / Appendix B) that involve a commander, under the owner rulings.

import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../../events'
import { parseSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { GameState, Seat } from '../../types'
import { filterEvents, projectView } from '../../view'

const endTurns = (state: GameState, ...seats: Seat[]): GameState => seats.reduce((s, seat) => act(s, seat, { kind: 'endTurn' }).state, state)

function damageTo(events: readonly GameEvent[], unitId: string): number | undefined {
  const hit = events.find((e) => e.type === 'unitDamaged' && e.unitId === unitId)
  return hit?.type === 'unitDamaged' ? hit.amount : undefined
}

function answer(state: GameState, seat: Seat, choice: string) {
  const decision = projectView(state, seat).decision
  if (decision === null) throw new Error('no decision to answer')
  return act(state, seat, { kind: 'respondDecision', decisionId: decision.id, choice })
}

describe('Ratasius I', () => {
  it('X-02: a stealthed Rogue can never Assault him; the same walk by a base commander ends in an Assault', () => {
    const walk = (commander: 'ratasius' | 'baseline') => {
      const b = buildBattle({ south: ['commander@M3:R'], north: [{ type: 'rogue', at: 'M8', label: 'RO', stealthed: true }], commanders: { south: commander } })
      const halfway = act(b.state, b.south, { kind: 'move', unitId: b.id('R'), path: sqs('M4', 'M5') }).state
      return { b, halfway, state: act(endTurns(halfway, b.south, b.north), b.south, { kind: 'move', unitId: b.id('R'), path: sqs('M6', 'M7') }).state }
    }
    const ratasius = walk('ratasius')
    expect(unitIn(ratasius.halfway, ratasius.b.id('RO'))?.stealthed).toBe(false) // detected at distance 3
    expect(unitIn(ratasius.state, ratasius.b.id('R'))?.toughness).toBe(5)
    const plain = walk('baseline')
    expect(plain.state.result).toMatchObject({ winner: plain.b.north, reason: 'conquest' }) // 7 on a 1/5 commander
  })

  it('X-03: his LOV 6 leaves fewer squares to Stealth in: a Rogue 6 squares away is spotted', () => {
    const attempt = (commander: 'ratasius' | 'baseline') => {
      const b = buildBattle({ south: ['commander@M3:R'], north: ['rogue@M9:RO'], commanders: { south: commander }, active: 'north' })
      return { b, r: act(b.state, b.north, { kind: 'useAbility', unitId: b.id('RO'), abilityId: 'rogue.stealth', targets: [] }) }
    }
    const spotted = attempt('ratasius')
    expect(unitIn(spotted.r.state, spotted.b.id('RO'))?.stealthed).toBe(false)
    expect(filterEvents(spotted.r.events, spotted.b.north)).toContainEqual(expect.objectContaining({ type: 'abilityNote', abilityId: 'rogue.stealth' }))
    const hidden = attempt('baseline')
    expect(unitIn(hidden.r.state, hidden.b.id('RO'))?.stealthed).toBe(true)
  })

  it("B11: Smite from an Emissary at his side deals 4, and 1 to each unit next to the target (R25 splash, R13 floor)", () => {
    const b = buildBattle({ south: ['commander@M3:R', 'soldier@M6:T', 'footman@N6:F'], north: ['emissary@M4:E'], commanders: { south: 'ratasius' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: b.id('T') }] })
    expect([damageTo(r.events, b.id('T')), damageTo(r.events, b.id('F'))]).toEqual([8 - 4, 1])
  })

  it('X-32 / B15: a Forceful slam from a Beast at his side deals 6 on the target and 1 on the splash (R13)', () => {
    const b = buildBattle({ south: ['commander@M3:R', 'soldier@P3:T', 'footman@P4:F'], north: ['beast@N2:BEAST'], commanders: { south: 'ratasius' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('BEAST'), abilityId: 'beast.forcefulSlam', targets: [{ kind: 'square', square: parseSquare('P3') }] })
    expect([damageTo(r.events, b.id('T')), damageTo(r.events, b.id('F'))]).toEqual([10 - 4, 1])
  })

  it('X-22: a Pajazon cast by a Wizard at his side still ticks for 3', () => {
    const b = buildBattle({ south: ['commander@M3:R', 'soldier@M6:S'], north: ['royalWizard@M4:W'], commanders: { south: 'ratasius' }, active: 'north' })
    const cast = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.pajazon', targets: [{ kind: 'square', square: parseSquare('M6') }] }).state
    const r = act(endTurns(cast, b.north), b.south, { kind: 'endTurn' })
    expect(damageTo(r.events, b.id('S'))).toBe(3)
  })
})

describe('Kulega', () => {
  it("X-03 / KUL-1: his +1 LOV spots a Rogue trying to Stealth 4 squares away, and widens Mind's Eye", () => {
    const b = buildBattle({ south: ['commander@M3:K'], north: ['rogue@M7:RO'], commanders: { south: 'kulega' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('RO'), abilityId: 'rogue.stealth', targets: [] })
    expect(unitIn(r.state, b.id('RO'))?.stealthed).toBe(false)
    const eye = buildBattle({ south: ['juliomancer@M5:J'], north: [{ type: 'rogue', at: 'M9', label: 'RO', stealthed: true }], commanders: { south: 'kulega' } })
    expect(unitIn(eye.state, eye.id('RO'))?.stealthed).toBe(false)
  })

  it('X-08 / T8: a Beast feasting on a Ranger next to an Artificer: the Beast heals by the Ranger, the Artificer by Fine Print', () => {
    const b = buildBattle({
      south: [{ type: 'beast', at: 'E5', label: 'BEAST', toughness: 30 }, 'ranger@G5:R', { type: 'artificer', at: 'H5', label: 'A', toughness: 10 }],
      commanders: { south: 'kulega' },
    })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('BEAST'), abilityId: 'beast.feast', targets: [{ kind: 'unit', unitId: b.id('R') }] })
    expect([unitIn(r.state, b.id('BEAST'))?.toughness, unitIn(r.state, b.id('A'))?.toughness]).toEqual([31, 11])
  })
})

describe('Trill', () => {
  it('X-21 under R23: a 1/3 Footman in formation takes 1 from an enemy Pajazon tick; Footmen out of formation die', () => {
    const b = buildBattle({ south: ['footman@D5:L', 'footman@E5:MID', 'footman@F5:R'], north: ['royalWizard@E8:W'], commanders: { south: 'trill' }, active: 'north' })
    const cast = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.pajazon', targets: [{ kind: 'square', square: parseSquare('E5') }] }).state
    const state = endTurns(cast, b.north, b.south)
    expect([unitIn(state, b.id('L')), unitIn(state, b.id('MID'))?.toughness, unitIn(state, b.id('R'))]).toEqual([undefined, 2, undefined])
  })
})

describe('Sabrina', () => {
  it('X-16: her Artificer builds a dummy that hits for 3 at once (2 from her, 1 from Mad inventor)', () => {
    const b = buildBattle({ south: ['artificer@E5:A'], north: ['soldier@E7:S'], commanders: { south: 'sabrina' } })
    const built = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('A'), abilityId: 'artificer.prototypeNoAcb', targets: [{ kind: 'square', square: parseSquare('E6') }] }).state
    const dummy = built.units.find((u) => u.type === 'noAcb' && u.owner === b.south)
    if (dummy === undefined) throw new Error('no dummy')
    expect(projectView(built, b.south).units.find((u) => u.id === dummy.id)?.power).toBe(3)
    const r = act(built, b.south, { kind: 'attack', unitId: dummy.id, target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7 - 3)
  })
})

describe('Queso', () => {
  it('X-07: a Juliomancer sacrifices a dummy for 7 damage, and Queso then offers the dummy back at 4', () => {
    const b = buildBattle({ south: ['commander@M3:Q', 'juliomancer@M5:J', 'noAcb@M4:D'], north: ['soldier@M7:S'], commanders: { south: 'queso' } })
    const r = act(b.state, b.south, {
      kind: 'useAbility',
      unitId: b.id('J'),
      abilityId: 'juliomancer.julioVernification',
      targets: [
        { kind: 'unit', unitId: b.id('D') },
        { kind: 'unit', unitId: b.id('S') },
      ],
    })
    const types = filterEvents(r.events, b.south).map((e) => e.type)
    expect(unitIn(r.state, b.id('S'))).toBeUndefined()
    expect(types.indexOf('decisionRequested')).toBeGreaterThan(types.indexOf('unitDamaged')) // the sacrifice's trigger comes after the effect
    expect(unitIn(answer(r.state, b.south, 'yes').state, b.id('D'))).toMatchObject({ anchor: parseSquare('M4'), toughness: 4 })
  })

  it('X-25: an own Pajazon, the beacon and Perseverance all heal at one end of turn, each capped', () => {
    const b = buildBattle({
      south: ['commander@M3:Q', { type: 'paladin', at: 'M5', label: 'P', toughness: 5 }, { type: 'soldier', at: 'L4', label: 'S', toughness: 1 }, 'royalWizard@M8:W'],
      commanders: { south: 'queso' },
    })
    const cast = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.pajazon', targets: [{ kind: 'square', square: parseSquare('M5') }] }).state
    const r = act(cast, b.south, { kind: 'endTurn' })
    expect([unitIn(r.state, b.id('P'))?.toughness, unitIn(r.state, b.id('S'))?.toughness]).toEqual([5 + 3 + 3, 7])
  })

  it('QUE-9: a unit dying in the same resolution as Queso is not offered back: the game is over (Smite splash, R25)', () => {
    const b = buildBattle({ south: ['commander@M3:Q', 'footman@M4:F'], north: ['emissary@M6:E'], commanders: { south: 'queso' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: b.id('Q') }] })
    expect(r.state.result).toMatchObject({ winner: b.north, reason: 'conquest' })
    expect(unitIn(r.state, b.id('F'))).toBeUndefined()
    expect(r.state.decisions).toHaveLength(0)
  })

  it('X-26: an enemy Pajazon kills a Soldier at the end of his turn; the end phase waits for the revive, then heals it', () => {
    const b = buildBattle({ south: ['commander@M3:Q', { type: 'soldier', at: 'M5', label: 'S', toughness: 3 }], north: ['royalWizard@M8:W'], commanders: { south: 'queso' }, active: 'north' })
    const cast = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.pajazon', targets: [{ kind: 'square', square: parseSquare('M5') }] }).state
    const paused = act(endTurns(cast, b.north), b.south, { kind: 'endTurn' }).state
    expect(projectView(paused, b.south).decision?.kind).toBe('queso.revive')
    expect(projectView(paused, b.north).opponentDeciding).toBe(true) // the Wizard saw it die
    const r = answer(paused, b.south, 'yes')
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7)
    expect(r.state.turn?.activeSeat).toBe(b.north)
  })
})

describe('Baba Yaga', () => {
  it('Cauldron: a Mercenary sacrificed to Julio Vernification is offered back once the damage is dealt', () => {
    const b = buildBattle({
      south: ['commander@M3:Y', 'juliomancer@M5:J', 'mercenary@L5:V'],
      north: ['soldier@M7:S'],
      commanders: { south: 'babaYaga' },
      variants: { south: 'cauldron' },
    })
    const r = act(b.state, b.south, {
      kind: 'useAbility',
      unitId: b.id('J'),
      abilityId: 'juliomancer.julioVernification',
      targets: [
        { kind: 'unit', unitId: b.id('V') },
        { kind: 'unit', unitId: b.id('S') },
      ],
    })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7 - 1)
    expect(unitIn(answer(r.state, b.south, 'return-0').state, b.id('V'))?.anchor).toEqual(parseSquare('M2'))
  })

  it('Hex Ward adds to an own Forcefield (R45) in a mixed army (R43): a hexed Juliomancer takes 15 - 8 - 1 from a Scourge', () => {
    const b = buildBattle({
      south: ['commander@M3:Y', 'juliomancer@M5:IN', 'royalWizard@N4:W', 'footman@L3:F', 'footman@K3', 'footman@L2'],
      north: ['scourge@M6:S', 'berserker@L4:B'],
      commanders: { south: 'babaYaga' },
      variants: { south: 'hex-ward' },
    })
    const field = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.forcefield', targets: [{ kind: 'squares', squares: sqs('M5', 'M4', 'L4', 'K4') }] }).state
    const northTurn = endTurns(field, b.south)
    const r = act(northTurn, b.north, { kind: 'attack', unitId: b.id('S'), target: { kind: 'unit', unitId: b.id('IN') } })
    expect(damageTo(r.events, b.id('IN'))).toBe(15 - 8 - 1)
    // R44: an Empire Footman in formation right next to her is not white: Line Formation alone.
    const formed = act(northTurn, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('F') } })
    expect(damageTo(formed.events, b.id('F'))).toBe(8 - 2)
  })
})
