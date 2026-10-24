// Owner rulings (docs/RULES_INTERPRETATION.md, R1-R45) that no module test pins yet. Module tests cover the rest;
// the README's "Rulings applied" list says where each ruling lives.

import { describe, expect, it } from 'vitest'
import type { TargetSpec } from './abilities/types'
import { apply, checkTarget } from './commands'
import {
  apForRound,
  APPROACH_BOOST,
  ARMY_LISTS_PUBLIC,
  ARMY_UNIT_CAP,
  BABA_CAULDRON_AP_DEBT,
  BABA_CAULDRON_COST,
  BABA_CAULDRON_PER_TURN,
  BABA_CAULDRON_PER_UNIT,
  BABA_COMMANDER_TOUGHNESS,
  BABA_HEX_RANGE,
  BABA_HEX_REDUCTION,
  BABA_HEX_TOUGHNESS,
  BABA_MEND_COST,
  BABA_MEND_HEAL,
  BABA_MEND_MAX_PER_UNIT,
  BABA_MEND_USES_PER_TURN,
  BABA_WHITE,
  COMMANDER_FACTION_LOCK,
  COMMANDER_REVEAL,
  FRIENDLY_SINGLE_TARGET,
  JULIO_DAMAGE_CAP,
  LOJRAR_PROXY_ROSTER,
  MAX_MOVES_PER_TURN,
  QUESO_BEACON_HEAL,
  QUESO_REVIVE_COST,
  SHARED_WOUNDS_ROUNDING,
  SHOW_OPPONENT_AP,
  SMITE_SPLASH,
  VISION_OCCLUSION,
  WEAKNESS_FLOOR,
} from './constants'
import { abilityParam } from './content/abilities'
import { SCENARIOS, scenarioBlockers, scenarioDef, type ScenarioDef } from './content/scenarios'
import { parseSquare, squareIndex } from './geometry'
import { StateQuery } from './query'
import { blocksSightIn, createGame, sightBlockersExist } from './state'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import { TIERS, type Square } from './types'
import { filterEvents, projectView, ViewQuery } from './view'
import { unitVisibleTo, visionMask } from './vision'

describe('ruled constants', () => {
  it('carry the values of the rulings', () => {
    expect([ARMY_UNIT_CAP, COMMANDER_FACTION_LOCK, LOJRAR_PROXY_ROSTER, MAX_MOVES_PER_TURN]).toEqual([50, false, false, 'allowance']) // R2, R7, R4, R12
    expect([WEAKNESS_FLOOR, FRIENDLY_SINGLE_TARGET, SHOW_OPPONENT_AP, COMMANDER_REVEAL, ARMY_LISTS_PUBLIC]).toEqual([1, true, true, 'lobby', true]) // R13-R16, R33
    expect([JULIO_DAMAGE_CAP, QUESO_BEACON_HEAL, SHARED_WOUNDS_ROUNDING, SMITE_SPLASH, VISION_OCCLUSION]).toEqual([15, 3, 'ceil', 3, 'tallBlockers']) // R22, R24, R19, R25, R36
    expect([abilityParam('juliomancer.julioVernification', 'cap'), abilityParam('queso.beacon', 'heal'), abilityParam('emissary.smite', 'splash')]).toEqual([15, 3, 3])
  })

  it('carry the values of R44 and R45 (Baba Yaga for the Lojrar Clan units)', () => {
    expect(BABA_WHITE).toEqual({ faction: 'lojrar' })
    expect([BABA_COMMANDER_TOUGHNESS, BABA_MEND_COST, BABA_MEND_HEAL, BABA_MEND_USES_PER_TURN, BABA_MEND_MAX_PER_UNIT]).toEqual([6, 1, 4, 3, 2])
    expect([BABA_HEX_RANGE, BABA_HEX_TOUGHNESS, BABA_HEX_REDUCTION, BABA_CAULDRON_PER_TURN, BABA_CAULDRON_PER_UNIT, BABA_CAULDRON_AP_DEBT]).toEqual([3, 1, 1, 2, 2, true])
    expect(TIERS.map((tier) => BABA_CAULDRON_COST(tier))).toEqual([1, 1, 1, 2, 4, 10, 20])
    expect([abilityParam('babaYaga.mend', 'heal'), abilityParam('babaYaga.mend', 'perTurn')]).toEqual([4, 3])
  })

  it.each([
    [100, 3],
    [50, 2],
    [20, 1],
    [1, 1],
    [null, 1],
  ] as const)('R18: reviving a tier-%s unit costs Queso %i max toughness', (tier, cost) => {
    expect(QUESO_REVIVE_COST(tier)).toBe(cost)
  })
})

describe('R14: single-target harmful effects may name own units', () => {
  const b = buildBattle({ south: ['emissary@E5:E', 'footman@E7:OWN'], north: ['soldier@F7:FOE'] })
  const q = new ViewQuery(projectView(b.state, b.south))
  const emissary = q.unit(b.id('E'))
  const spec = (relation: 'harmful' | 'enemy'): TargetSpec => ({ kind: 'unit', label: 'Target', range: 3, relation, includeSelf: false, allowCommander: true })

  it("accepts an own unit for relation 'harmful' while FRIENDLY_SINGLE_TARGET is on, never for 'enemy'", () => {
    if (emissary === undefined) throw new Error('no Emissary')
    expect(checkTarget(q, emissary, spec('harmful'), { kind: 'unit', unitId: b.id('OWN') })).toBeNull()
    expect(checkTarget(q, emissary, spec('harmful'), { kind: 'unit', unitId: b.id('FOE') })).toBeNull()
    expect(checkTarget(q, emissary, spec('enemy'), { kind: 'unit', unitId: b.id('OWN') })).toMatchObject({ code: 'INVALID_TARGET' })
    expect(checkTarget(q, emissary, spec('harmful'), { kind: 'unit', unitId: b.id('E') })).toMatchObject({ code: 'INVALID_TARGET' }) // includeSelf
  })
})

describe('R16: the commander and its variant are public in the lobby', () => {
  it('shows Baba Yaga and her variant to the opponent as soon as they are chosen, but not the units', () => {
    const r = apply(createGame({ seed: 'r16' }), 'guest', {
      kind: 'setArmy',
      army: { faction: 'lojrar', commander: 'babaYaga', variant: 'hex-ward', units: { mercenary: 2 } },
    })
    if (!r.ok) throw new Error(r.message)
    const host = projectView(r.state, 'host')
    expect([host.commanders.guest, host.commanderVariants.guest, host.armies]).toEqual(['babaYaga', 'hex-ward', null])
    expect(filterEvents(r.events, 'host')).toContainEqual({ type: 'armyChosen', seat: 'guest', commander: 'babaYaga', variant: 'hex-ward' })
  })
})

describe('R28: first contact is recorded the moment a unit sees an enemy', () => {
  it('counts a sighting that ends within the same action (the mover dies on a mine in enemy sight)', () => {
    const b = buildBattle({ south: ['footman@E8:F'], north: ['soldier@E11:S'], mines: [{ owner: 'north', at: 'E9' }] })
    expect(b.state.firstContactRound).toBeNull()
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('E9') })
    expect(unitIn(r.state, b.id('F'))).toBeUndefined()
    expect(r.state.firstContactRound).toBe(1)
    const north = act(r.state, b.south, { kind: 'endTurn' }).state
    expect(north.seats[b.north].ap).toBe(apForRound(1) * APPROACH_BOOST) // the rest of the contact round stays boosted
    expect(act(north, b.north, { kind: 'endTurn' }).state.seats[b.south].ap).toBe(apForRound(2))
  })

  it('ignores mines and unrevealed stealthed units, but counts what a stealthed unit sees', () => {
    const b = buildBattle({
      south: ['emissary@E5:E'],
      north: [{ type: 'rogue', at: 'E9', label: 'R', stealthed: true }],
      mines: [{ owner: 'north', at: 'F6', revealed: true }],
    })
    expect(projectView(b.state, b.south).mines).toHaveLength(1)
    expect(b.state.firstContactRound).toBeNull() // the Emissary's LOV 4 covers the Rogue's square, but it is stealthed
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('E'), path: sqs('E6') })
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(true)
    expect(r.state.firstContactRound).toBe(1) // the Rogue's LOV 3 now reaches the Emissary
  })
})

describe('R32: Open Field changes only the buildings', () => {
  it('has the Crossroads 3x3 buildings and no blockers', () => {
    expect(scenarioDef('openField').buildings).toEqual(scenarioDef('crossroads').buildings)
    expect(scenarioDef('openField').blockers).toEqual([])
  })
})

describe('R36: low and tall blockers', () => {
  const tall: ScenarioDef = { ...scenarioDef('openField'), tallBlockers: [parseSquare('M14')] }

  /** The authority's query over a board that has one tall blocker (the v1 scenarios have none). */
  class TallBlockerQuery extends StateQuery {
    override hasSightBlockers(): boolean {
      return sightBlockersExist(tall)
    }
    override blocksSight(s: Square): boolean {
      return blocksSightIn(tall, s, (x) => this.isTerrain(x))
    }
  }

  it('gives every blocker a kind; the v1 scenarios use low ones only', () => {
    expect(scenarioBlockers(scenarioDef('crossroads')).map((b) => b.kind)).toEqual(Array(21).fill('low'))
    expect(scenarioBlockers(tall)).toEqual([{ square: parseSquare('M14'), kind: 'tall' }])
    expect(SCENARIOS.every((s) => s.tallBlockers.length === 0)).toBe(true)
  })

  it('a tall blocker is seen but hides what lies behind it; sight floods round it within the LOV radius', () => {
    const seen = (mask: Uint8Array, name: string) => mask[squareIndex(parseSquare(name))]
    const b = buildBattle({ south: ['soldier@M13:S'], north: ['footman@M15:BEHIND', 'footman@L14:BESIDE'] })
    expect(seen(visionMask(new StateQuery(b.state), b.south), 'M15')).toBe(1) // no tall blocker: the plain diamond
    const q = new TallBlockerQuery(b.state)
    const mask = visionMask(q, b.south)
    expect(['M14', 'M15', 'L14'].map((name) => seen(mask, name))).toEqual([1, 0, 1])
    const behind = q.unit(b.id('BEHIND'))
    const beside = q.unit(b.id('BESIDE'))
    if (behind === undefined || beside === undefined) throw new Error('missing unit')
    expect([unitVisibleTo(q, b.south, behind, mask), unitVisibleTo(q, b.south, beside, mask)]).toEqual([false, true])

    const far = buildBattle({ south: ['emissary@M13:E'] }) // LOV 4: the 4-step detour reaches M15, not M16
    expect(['M15', 'M16'].map((name) => seen(visionMask(new TallBlockerQuery(far.state), far.south), name))).toEqual([1, 0])
  })
})
