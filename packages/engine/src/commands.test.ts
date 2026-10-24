import { describe, expect, it } from 'vitest'
import { checkArmy } from './army'
import { apply, validate, type Intent } from './commands'
import { apForRound } from './constants'
import { filterEvents, projectView } from './view'
import { createGame, DEFAULT_SETTINGS } from './state'
import { parseSquare } from './geometry'
import { startMatch } from './testing/dsl'
import type { ArmyList, GameState, Seat } from './types'

const EMPIRE: ArmyList = { faction: 'empire', commander: 'trill', units: { footman: 2, soldier: 1, paladin: 1 } }
const LOJRAR: ArmyList = { faction: 'lojrar', commander: 'queso', units: { mercenary: 3, rogue: 1 } }

function must(state: GameState, seat: Seat, intent: Intent): GameState {
  const result = apply(state, seat, intent)
  if (!result.ok) throw new Error(`${intent.kind}: ${result.code} ${result.message}`)
  return result.state
}

describe('army validation (5.1, 7.2)', () => {
  it('accepts a legal army and reports its cost', () => {
    const check = checkArmy(EMPIRE, DEFAULT_SETTINGS)
    expect(check).toMatchObject({ ok: true, cost: 2 + 2 + 20, unitCount: 4 })
  })

  it('rejects over-budget armies, other factions\' units and unavailable commanders', () => {
    expect(checkArmy({ faction: 'empire', commander: 'trill', units: { emissary: 2, berserker: 1 } }, DEFAULT_SETTINGS).ok).toBe(false)
    expect(checkArmy({ faction: 'empire', commander: 'trill', units: { ranger: 1 } }, DEFAULT_SETTINGS).errors).toContain("Ranger is not in this faction's roster") // R4
    expect(checkArmy({ faction: 'empire', commander: 'baseline', units: {} }, DEFAULT_SETTINGS).ok).toBe(false)
    expect(checkArmy({ faction: 'empire', commander: 'baseline', units: {} }, { ...DEFAULT_SETTINGS, devContent: true }).ok).toBe(true)
  })

  it('lets any commander lead either faction (R7) and requires a Baba Yaga variant (R11)', () => {
    expect(checkArmy({ faction: 'empire', commander: 'queso', units: { footman: 1 } }, DEFAULT_SETTINGS).ok).toBe(true)
    expect(checkArmy({ faction: 'lojrar', commander: 'babaYaga', units: { mercenary: 2 } }, DEFAULT_SETTINGS).errors).toContain('Choose a variant for Baba Yaga')
    expect(checkArmy({ faction: 'lojrar', commander: 'babaYaga', units: { mercenary: 2 }, variant: 'cauldron' }, DEFAULT_SETTINGS).ok).toBe(true)
    expect(checkArmy({ faction: 'lojrar', commander: 'trill', units: {}, variant: 'mend' }, DEFAULT_SETTINGS).ok).toBe(false)
  })

  it('prices with the commander (Sabrina) and warns about commander-only armies', () => {
    expect(checkArmy({ faction: 'lojrar', commander: 'sabrina', units: { artificer: 20 } }, DEFAULT_SETTINGS)).toMatchObject({ ok: true, cost: 200 })
    expect(checkArmy({ faction: 'empire', commander: 'sabrina', units: { paladin: 2 } }, DEFAULT_SETTINGS)).toMatchObject({ cost: 48 })
    expect(checkArmy({ faction: 'empire', commander: 'trill', units: {} }, DEFAULT_SETTINGS).warnings).toHaveLength(1)
  })

  it('caps deployed units at 50, commander excluded (R2) and still checks deployability (A5-03)', () => {
    expect(checkArmy({ faction: 'empire', commander: 'trill', units: { footman: 50 } }, DEFAULT_SETTINGS).ok).toBe(true)
    expect(checkArmy({ faction: 'empire', commander: 'trill', units: { footman: 51 } }, DEFAULT_SETTINGS).errors).toContain('At most 50 units')
    expect(checkArmy({ faction: 'empire', commander: 'trill', units: { footman: 48, beast: 0 } }, DEFAULT_SETTINGS).ok).toBe(true)
  })
})

describe('lobby (2.1)', () => {
  it('needs both players ready, and only the host starts', () => {
    let state = createGame({ seed: 's' })
    state = must(state, 'host', { kind: 'setArmy', army: EMPIRE })
    expect(apply(state, 'host', { kind: 'setReady', ready: true }).ok).toBe(true)
    state = must(state, 'host', { kind: 'setReady', ready: true })
    expect(validate(state, 'host', { kind: 'startDeployment', coinSeed: 'c' })).toMatchObject({ ok: false, code: 'NOT_READY' })
    expect(validate(state, 'guest', { kind: 'setReady', ready: true })).toMatchObject({ ok: false, code: 'NOT_READY' })
    state = must(state, 'guest', { kind: 'setArmy', army: LOJRAR })
    state = must(state, 'guest', { kind: 'setReady', ready: true })
    expect(validate(state, 'guest', { kind: 'startDeployment', coinSeed: 'c' })).toMatchObject({ ok: false, code: 'NOT_HOST' })
    expect(validate(state, 'host', { kind: 'startDeployment', coinSeed: 'c' }).ok).toBe(true)
  })

  it('un-readies players when the army or the settings change (PX AB-16)', () => {
    let state = createGame({ seed: 's' })
    state = must(state, 'host', { kind: 'setArmy', army: EMPIRE })
    state = must(state, 'host', { kind: 'setReady', ready: true })
    state = must(state, 'host', { kind: 'setArmy', army: { ...EMPIRE, units: { footman: 1 } } })
    expect(state.seats.host.ready).toBe(false)
    state = must(state, 'host', { kind: 'setReady', ready: true })
    state = must(state, 'host', { kind: 'updateSettings', settings: { keepEnabled: false } })
    expect(state.seats.host.ready).toBe(false)
    expect(state.buildings.map((b) => b.kind)).toEqual(['market'])
    expect(validate(state, 'guest', { kind: 'updateSettings', settings: { budget: 100 } })).toMatchObject({ ok: false, code: 'NOT_HOST' })
  })

  it('keeps the army lists secret in the lobby but shows the commander once chosen (R16)', () => {
    let state = createGame({ seed: 's' })
    state = must(state, 'host', { kind: 'setArmy', army: EMPIRE })
    const guestView = projectView(state, 'guest')
    expect(guestView.myArmy).toBeNull()
    expect(guestView.armies).toBeNull()
    expect(guestView.lobby.armyChosen.host).toBe(true)
    expect(guestView.commanders.host).toBe('trill')
    expect(JSON.stringify(guestView)).not.toContain('paladin')
  })
})

describe('deployment (5.2-5.4)', () => {
  function deploymentState(): GameState {
    let state = createGame({ seed: 'dep', settings: { scenarioId: 'openField' } })
    state = must(state, 'host', { kind: 'setArmy', army: EMPIRE })
    state = must(state, 'guest', { kind: 'setArmy', army: LOJRAR })
    state = must(state, 'host', { kind: 'setReady', ready: true })
    state = must(state, 'guest', { kind: 'setReady', ready: true })
    return must(state, 'host', { kind: 'startDeployment', coinSeed: 'coin' })
  }

  it('flips the first player, creates every unit undeployed and reveals the commanders (A2-04, A5-09)', () => {
    const state = deploymentState()
    expect(state.phase).toBe('deployment')
    expect(state.southSeat === 'host' || state.southSeat === 'guest').toBe(true)
    expect(state.units.filter((u) => u.owner === 'host')).toHaveLength(5)
    expect(state.units.filter((u) => u.owner === 'guest')).toHaveLength(5)
    expect(state.units.every((u) => u.anchor === null)).toBe(true)
    const guestView = projectView(state, 'guest')
    expect(guestView.commanders).toEqual({ host: 'trill', guest: 'queso' })
    expect(guestView.units.every((u) => u.owner === 'guest')).toBe(true)
  })

  it('builds units at full toughness, commander modifiers included', () => {
    const state = deploymentState()
    const queso = state.units.find((u) => u.owner === 'guest' && u.type === 'commander')
    const trill = state.units.find((u) => u.owner === 'host' && u.type === 'commander')
    expect(queso?.toughness).toBe(6) // R8
    expect(trill?.toughness).toBe(6) // R23
  })

  it('checks zones: normal for most units, extended rows for Vanguard units, never for the commander', () => {
    const state = deploymentState()
    const host = 'host'
    const side = state.southSeat === host ? 'south' : 'north'
    const row = (n: number) => (side === 'south' ? n : 26 - n)
    const unitOf = (type: string) => state.units.find((u) => u.owner === host && u.type === type)?.id ?? ''
    const at = (col: string, r: number) => parseSquare(`${col}${row(r)}`)
    expect(validate(state, host, { kind: 'deploy', unitId: unitOf('paladin'), anchor: at('M', 5) }).ok).toBe(true)
    expect(validate(state, host, { kind: 'deploy', unitId: unitOf('paladin'), anchor: at('M', 6) })).toMatchObject({ ok: false, code: 'OUTSIDE_ZONE' })
    const guestSide = side === 'south' ? 'north' : 'south'
    const guestAt = (col: string, r: number) => parseSquare(`${col}${guestSide === 'south' ? r : 26 - r}`)
    const rogue = state.units.find((u) => u.owner === 'guest' && u.type === 'rogue')?.id ?? ''
    expect(validate(state, 'guest', { kind: 'deploy', unitId: rogue, anchor: guestAt('M', 7) }).ok).toBe(true)
    expect(validate(state, 'guest', { kind: 'deploy', unitId: rogue, anchor: guestAt('M', 8) })).toMatchObject({ ok: false, code: 'OUTSIDE_ZONE' })
    expect(validate(state, host, { kind: 'deploy', unitId: unitOf('commander'), anchor: at('M', 6) })).toMatchObject({ ok: false, code: 'OUTSIDE_ZONE' })
    expect(validate(state, host, { kind: 'deploy', unitId: unitOf('commander'), anchor: at('A', 1) })).toMatchObject({ ok: false, code: 'SQUARE_UNAVAILABLE' })
  })

  it('needs every unit placed before Confirm, and hides placements from the opponent', () => {
    let state = deploymentState()
    expect(validate(state, 'host', { kind: 'confirmDeployment', confirmed: true })).toMatchObject({ ok: false, code: 'NOT_ALL_DEPLOYED' })
    const side = state.southSeat === 'host' ? 'south' : 'north'
    const unit = state.units.find((u) => u.owner === 'host')
    if (unit === undefined) throw new Error('no unit')
    const result = apply(state, 'host', { kind: 'deploy', unitId: unit.id, anchor: parseSquare(side === 'south' ? 'M3' : 'M23') })
    if (!result.ok) throw new Error(result.message)
    state = result.state
    expect(filterEvents(result.events, 'guest')).toEqual([])
    expect(projectView(state, 'guest').units.some((u) => u.owner === 'host')).toBe(false)
  })
})

describe('starting the battle (2.1, 2.3)', () => {
  it('gives both players the round pool, doubled until first contact, with no first-turn cut (R1, R9, R28)', () => {
    const record = startMatch({ armies: { host: EMPIRE, guest: LOJRAR } })
    const south = record.state.southSeat
    if (south === null) throw new Error('no south')
    const north = south === 'host' ? 'guest' : 'host'
    expect(record.state.phase).toBe('battle')
    expect(record.state.turn).toEqual({ number: 1, activeSeat: south })
    const pools = (start: GameState, turns: number): number[] => {
      let state = start
      const out: number[] = []
      for (let turn = 0; turn < turns; turn++) {
        const seat = turn % 2 === 0 ? south : north
        out.push(state.seats[seat].ap)
        state = must(state, seat, { kind: 'endTurn' })
      }
      return out
    }
    expect(pools(record.state, 6)).toEqual([20, 20, 22, 22, 24, 24]) // the armies never meet: the boost runs on
    const contacted = { ...record.state, firstContactRound: 1 }
    const plain = pools(contacted, 44)
    expect(plain.slice(0, 6)).toEqual([20, 20, 11, 11, 12, 12]) // boosted through the contact round only
    expect(plain.slice(20, 22)).toEqual([20, 20]) // round 11: the R1 cap
    expect(plain.slice(38, 44)).toEqual([21, 21, 22, 22, 23, 23]) // rounds 20-22: late escalation
    expect([apForRound(1), apForRound(11), apForRound(19), apForRound(20), apForRound(25)]).toEqual([10, 20, 20, 21, 26])
  })

  it('makes both army lists public at the start of deployment (R33)', () => {
    let state = createGame({ seed: 'lists', settings: { scenarioId: 'openField' } })
    state = must(state, 'host', { kind: 'setArmy', army: EMPIRE })
    state = must(state, 'guest', { kind: 'setArmy', army: LOJRAR })
    state = must(state, 'host', { kind: 'setReady', ready: true })
    state = must(state, 'guest', { kind: 'setReady', ready: true })
    expect(projectView(state, 'guest').armies).toBeNull()
    state = must(state, 'host', { kind: 'startDeployment', coinSeed: 'c' })
    expect(projectView(state, 'guest').armies?.host).toEqual(EMPIRE)
  })

  it('never shows the enemy army on deployed back rows (deployment is out of vision, 5.4)', () => {
    const record = startMatch({ armies: { host: EMPIRE, guest: LOJRAR } })
    for (const seat of ['host', 'guest'] as const) {
      expect(projectView(record.state, seat).units.every((u) => u.owner === seat)).toBe(true)
    }
  })

  it('refuses actions out of turn and after the game ends', () => {
    const record = startMatch({ armies: { host: EMPIRE, guest: LOJRAR } })
    const south = record.state.southSeat ?? 'host'
    const north = south === 'host' ? 'guest' : 'host'
    expect(validate(record.state, north, { kind: 'endTurn' })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' })
    const resigned = must(record.state, north, { kind: 'resign' })
    expect(resigned.result).toMatchObject({ winner: south, reason: 'resignation' })
    expect(validate(resigned, south, { kind: 'endTurn' })).toMatchObject({ ok: false, code: 'GAME_OVER' })
  })
})
