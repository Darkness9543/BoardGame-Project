import { describe, expect, it } from 'vitest'
import type { Intent } from '../../commands'
import { abilityParam } from '../../content/abilities'
import { abilitiesFor, unitCost } from '../../content/derived'
import { unitDef } from '../../content/units'
import { area3x3, parseSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { GameState } from '../../types'
import { projectView } from '../../view'

const END: Intent = { kind: 'endTurn' }
const attack = (unitId: string, targetId: string): Intent => ({ kind: 'attack', unitId, target: { kind: 'unit', unitId: targetId } })
const toughness = (state: GameState, id: string) => unitIn(state, id)?.toughness

// Attack vectors from Appendix B under the rulings: Berserker 8 (R20), armour 2 (R21), Keep +1 Power (R31).
const VECTORS = [
  { name: 'B1: a Berserker (8)', attacker: 'berserker', defending: false, keep: false, damage: 6 },
  { name: 'B2: a Berserker (8) on a defending Paladin', attacker: 'berserker', defending: true, keep: false, damage: 3 },
  { name: 'B3: a Footman (1)', attacker: 'footman', defending: false, keep: false, damage: 1 },
  { name: 'B4: a Footman (1) on a defending Paladin', attacker: 'footman', defending: true, keep: false, damage: 1 },
  { name: 'B5: a Keep Footman (2)', attacker: 'footman', defending: false, keep: true, damage: 1 },
  { name: 'B28 / PAL-1: a Beast (20) on a defending Paladin', attacker: 'beast', defending: true, keep: false, damage: 9 },
] as const

describe('paladin.reinforcedArmor (8.9, A8-12; 10/18 and armour 2 under owner ruling R21)', () => {
  it('reads the R21 numbers from the content tables: 10/18, Movement 3, AP 2, armour 2', () => {
    expect(unitDef('paladin')).toMatchObject({ power: 10, toughness: 18, lov: 2, movement: 3, ap: 2, tier: 20 })
    expect(abilityParam('paladin.reinforcedArmor', 'reduction')).toBe(2)
    const b = buildBattle({ south: ['paladin@E5:P'] })
    expect(projectView(b.state, b.south).units.find((u) => u.id === b.id('P'))).toMatchObject({ power: 10, toughness: 18, maxToughness: 18, movement: 3 })
  })

  it('reduces every attack by 2, never below 1 (PAL-1)', () => {
    const b = buildBattle({ south: ['berserker@E5:B', 'footman@F6:F'], north: ['paladin@E6:P'], control: { market: 'south' } })
    let state = act(b.state, b.south, attack(b.id('B'), b.id('P'))).state
    expect(toughness(state, b.id('P'))).toBe(18 - 6)
    state = act(state, b.south, attack(b.id('F'), b.id('P'))).state
    expect(toughness(state, b.id('P'))).toBe(18 - 6 - 1)
  })

  it.each(VECTORS)('$name deals $damage, subtracting before Defend halves (C3)', ({ attacker, defending, keep, damage }) => {
    const b = buildBattle({
      south: [`${attacker}@E5:A`],
      north: [{ type: 'paladin', at: attacker === 'beast' ? 'E7' : 'E6', label: 'P', defending }],
      control: keep ? { keep: 'south' } : {},
    })
    expect(toughness(act(b.state, b.south, attack(b.id('A'), b.id('P'))).state, b.id('P'))).toBe(18 - damage)
  })

  it('reduces ability damage, mines and ticks too ("all damage", PAL-3, B18)', () => {
    const smite = buildBattle({ south: ['emissary@E5:E'], north: ['paladin@E7:P'] })
    const r = act(smite.state, smite.south, { kind: 'useAbility', unitId: smite.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: smite.id('P') }] })
    expect(toughness(r.state, smite.id('P'))).toBe(18 - 6)

    const mine = buildBattle({ south: ['paladin@E5:P'], mines: [{ owner: 'north', at: 'E6' }] })
    const r2 = act(mine.state, mine.south, { kind: 'move', unitId: mine.id('P'), path: sqs('E6') })
    expect(toughness(r2.state, mine.id('P'))).toBe(18 - 3)

    const tick = buildBattle({ south: ['paladin@E5:P'] })
    tick.state.areas.push({ id: 'a-t', abilityId: 'royalWizard.pajazon', owner: tick.north, sourceId: null, squares: area3x3(parseSquare('E5')), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 50, data: {} })
    const r3 = act(tick.state, tick.south, END)
    expect(toughness(r3.state, tick.id('P'))).toBe(18 - 1)
  })

  it('takes 1 from the Smite and Forceful slam splashes (PAL-3, R25)', () => {
    const b = buildBattle({ south: ['emissary@J10:E', 'beast@N10:B'], north: ['juliomancer@J13:T', 'paladin@J14:P1', 'juliomancer@N12:U', 'paladin@N13:P2'] })
    let state = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: b.id('T') }] }).state
    state = act(state, b.south, { kind: 'useAbility', unitId: b.id('B'), abilityId: 'beast.forcefulSlam', targets: [{ kind: 'square', square: parseSquare('N12') }] }).state
    expect([toughness(state, b.id('P1')), toughness(state, b.id('P2'))]).toEqual([17, 17])
  })

  it('adds to a friendly Forcefield, still dealing at least 1 (PAL-2)', () => {
    const b = buildBattle({ south: ['royalWizard@J10:W', 'paladin@J12:P'], north: ['berserker@J13:B'] })
    const cast: Intent = { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.forcefield', targets: [{ kind: 'squares', squares: sqs('J11', 'J12', 'K11', 'K12') }] }
    const state = act(act(act(b.state, b.south, cast).state, b.south, END).state, b.north, attack(b.id('B'), b.id('P'))).state
    expect(toughness(state, b.id('P'))).toBe(18 - 1) // max(1, 8 - 2 - 8)
  })

  it('never softens a sacrifice: Feast eats a full Paladin and heals its 18 (A3-08, 3.9)', () => {
    const b = buildBattle({ south: [{ type: 'beast', at: 'J10', label: 'B', toughness: 20 }, 'paladin@J12:P'] })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('B'), abilityId: 'beast.feast', targets: [{ kind: 'unit', unitId: b.id('P') }] })
    expect(unitIn(r.state, b.id('P'))).toBeUndefined()
    expect(toughness(r.state, b.id('B'))).toBe(20 + 18)
  })

  it('only protects the Paladin itself', () => {
    const b = buildBattle({ south: ['berserker@E5:B'], north: ['paladin@F7', 'soldier@E6:S'] })
    const r = act(b.state, b.south, attack(b.id('B'), b.id('S')))
    expect(unitIn(r.state, b.id('S'))).toBeUndefined()
  })

  it('is type 20: Fine Print under Kulega, 24 coins under Sabrina (PAL-4)', () => {
    expect(abilitiesFor('paladin', 'kulega')).toContain('kulega.finePrint')
    expect(unitCost('paladin', 'sabrina')).toBe(24)
  })
})
