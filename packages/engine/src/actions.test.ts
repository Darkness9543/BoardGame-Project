import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { validate } from './commands'
import { APPROACH_BOOST, CHARGE_SURCHARGE, GROUP_MARCH_COST, GROUP_MARCH_MAX, SCOURGE_AP_BONUS, apForRound } from './constants'
import { parseSquare } from './geometry'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import { filterEvents } from './view'

// Test-local stand-ins for stubs whose core support these tests exercise.
registerAbility({ id: 'scourge.tribute', status: 'implemented', startOfTurnAp: () => SCOURGE_AP_BONUS }, { replace: true })
registerAbility(
  {
    id: 'priestess.sharedWounds',
    status: 'implemented',
    active: {
      targets: [
        { kind: 'unit', label: 'Donor', range: 1, relation: 'own', includeSelf: true, allowCommander: true },
        { kind: 'unit', label: 'Recipient', range: 1, relation: 'own', includeSelf: true, allowCommander: true },
      ],
      resolve: (ctx, _unit, targets) => {
        const [d, r] = targets
        const donor = d?.kind === 'unit' ? ctx.unit(d.unitId) : undefined
        const recipient = r?.kind === 'unit' ? ctx.unit(r.unitId) : undefined
        if (donor === undefined || recipient === undefined) return
        const amount = Math.ceil(donor.toughness / 2) // R19
        ctx.loseToughness(donor, amount, 'priestess.sharedWounds', { canKill: true })
        ctx.heal(recipient, amount, 'priestess.sharedWounds')
      },
    },
  },
  { replace: true },
)

describe('Charge (R26)', () => {
  it('moves up to Movement - 1 and attacks from the end square, as one action costing AP + 1', () => {
    const b = buildBattle({ south: ['rogue@E5:R'], north: ['soldier@E7:S'] })
    const r = act(b.state, b.south, { kind: 'charge', unitId: b.id('R'), path: sqs('E6'), target: { kind: 'unit', unitId: b.id('S') } })
    const rogue = unitIn(r.state, b.id('R'))
    expect(rogue?.anchor).toEqual(parseSquare('E6'))
    expect(rogue?.turn).toMatchObject({ actionsUsed: 1, moves: 1, basicAttack: true })
    expect(unitIn(r.state, b.id('S'))).toBeUndefined() // 7 Power kills the 2/7 Soldier
    expect(r.state.seats[b.south].ap).toBe(20 - (2 + CHARGE_SURCHARGE))
  })

  it('refuses units with Movement 1, paths of full Movement, and targets out of reach from the end square', () => {
    const b = buildBattle({ south: ['soldier@E5:S', 'rogue@G5:R'], north: ['footman@E7:F', 'footman@G8:G'] })
    expect(validate(b.state, b.south, { kind: 'charge', unitId: b.id('S'), path: sqs('E6'), target: { kind: 'unit', unitId: b.id('F') } })).toMatchObject({
      ok: false,
      code: 'CANNOT_MOVE',
    })
    expect(validate(b.state, b.south, { kind: 'charge', unitId: b.id('R'), path: sqs('G6', 'G7'), target: { kind: 'unit', unitId: b.id('G') } })).toMatchObject({
      ok: false,
      code: 'PATH_TOO_LONG',
    })
    expect(validate(b.state, b.south, { kind: 'charge', unitId: b.id('R'), path: sqs('G6'), target: { kind: 'unit', unitId: b.id('G') } })).toMatchObject({
      ok: false,
      code: 'OUT_OF_RANGE',
    })
  })

  it('spends its AP but never attacks when the walk is interrupted (a mine)', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: ['soldier@E7:S'], mines: [{ owner: 'north', at: 'E6' }] })
    const r = act(b.state, b.south, { kind: 'charge', unitId: b.id('P'), path: sqs('E6'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7)
    expect(unitIn(r.state, b.id('P'))?.turn.basicAttack).toBe(false)
    expect(r.state.seats[b.south].ap).toBe(20 - (2 + CHARGE_SURCHARGE))
  })

  it('ends on a bump into an enemy that was hidden at declaration: no attack, AP spent', () => {
    // The Soldier's LOV shows the target; the stealthed Rogue on the path is revealed when the Paladin steps next to it.
    const b = buildBattle({ south: ['paladin@E5:P', 'soldier@H7'], north: [{ type: 'rogue', at: 'E7', label: 'R', stealthed: true }, 'footman@F7:F'] })
    const r = act(b.state, b.south, { kind: 'charge', unitId: b.id('P'), path: sqs('E6', 'E7'), target: { kind: 'unit', unitId: b.id('F') } })
    expect(unitIn(r.state, b.id('P'))).toMatchObject({ anchor: parseSquare('E6'), turn: expect.objectContaining({ actionsUsed: 1, moves: 1, basicAttack: false }) })
    expect(unitIn(r.state, b.id('F'))?.toughness).toBe(2)
    expect(r.state.seats[b.south].ap).toBe(20 - (2 + CHARGE_SURCHARGE))
  })
})

describe('Group march (R27)', () => {
  it('steps every unit of a connected group one square the same way for 2 AP, using each one\'s action', () => {
    const b = buildBattle({ south: ['footman@E5:A', 'footman@F5:B', 'soldier@F4:C'] })
    const r = act(b.state, b.south, { kind: 'groupMarch', unitIds: [b.id('A'), b.id('B'), b.id('C')], direction: 'north' })
    expect([b.id('A'), b.id('B'), b.id('C')].map((id) => unitIn(r.state, id)?.anchor)).toEqual(sqs('E6', 'F6', 'F5'))
    expect(r.state.seats[b.south].ap).toBe(20 - GROUP_MARCH_COST)
    expect(unitIn(r.state, b.id('C'))?.turn).toMatchObject({ actionsUsed: 1, moves: 1 })
  })

  it('refuses split groups, units that already acted, and steps into terrain or onto other units', () => {
    const b = buildBattle({ south: ['footman@E5:A', 'footman@H5:B', 'footman@E6:C', 'soldier@E7:D'], settings: { scenarioId: 'crossroads' } })
    const march = (ids: string[], direction: 'north' | 'east' = 'north') =>
      validate(b.state, b.south, { kind: 'groupMarch', unitIds: ids.map((l) => b.id(l)), direction })
    expect(march(['A', 'B'])).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(march(['A', 'C'])).toMatchObject({ ok: false, code: 'INVALID_PATH' }) // C would end on D
    expect(march(['A', 'C', 'D']).ok).toBe(true) // the front unit vacates first
    const acted = act(b.state, b.south, { kind: 'defend', unitId: b.id('A') }).state
    expect(validate(acted, b.south, { kind: 'groupMarch', unitIds: [b.id('A')], direction: 'east' })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('stops only the unit that is interrupted (a mine)', () => {
    const b = buildBattle({ south: ['footman@E5:A', 'footman@F5:B'], mines: [{ owner: 'north', at: 'E6' }] })
    const r = act(b.state, b.south, { kind: 'groupMarch', unitIds: [b.id('A'), b.id('B')], direction: 'north' })
    expect(unitIn(r.state, b.id('A'))).toBeUndefined() // 5 damage on a 1/2 Footman
    expect(unitIn(r.state, b.id('B'))?.anchor).toEqual(parseSquare('F6'))
  })

  it(`lets the commander march, front to back, and takes at most ${GROUP_MARCH_MAX} units`, () => {
    const b = buildBattle({ south: ['commander@E3:C', 'footman@E4:F'] })
    const r = act(b.state, b.south, { kind: 'groupMarch', unitIds: [b.id('C'), b.id('F')], direction: 'north' })
    expect([b.id('C'), b.id('F')].map((id) => unitIn(r.state, id)?.anchor)).toEqual(sqs('E4', 'E5'))
    const row = buildBattle({ south: ['E', 'F', 'G', 'H', 'I', 'J', 'K'].map((c) => `footman@${c}5:${c}`) })
    const march = (labels: string[]) => validate(row.state, row.south, { kind: 'groupMarch', unitIds: labels.map((l) => row.id(l)), direction: 'north' })
    expect(march(['E', 'F', 'G', 'H', 'I', 'J', 'K'])).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(march(['E', 'F', 'G', 'H', 'I', 'J']).ok).toBe(true)
  })
})

describe('approach boost and AP grants (R25, R28)', () => {
  it('records first contact when any unit first sees an enemy unit, ending the boost after that round', () => {
    const b = buildBattle({ south: ['paladin@E6:P'], north: ['soldier@E12:S'] })
    expect(b.state.firstContactRound).toBeNull()
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E7', 'E8', 'E9') })
    expect(r.state.firstContactRound).toBeNull() // E9 to E12 is 3: still unseen by both (LOV 2)
    const r2 = act(act(r.state, b.south, { kind: 'endTurn' }).state, b.north, { kind: 'move', unitId: b.id('S'), path: sqs('E11') })
    expect(r2.state.firstContactRound).toBe(1)
    const south = act(r2.state, b.north, { kind: 'endTurn' }).state
    expect(south.seats[b.south].ap).toBe(apForRound(2)) // round 2: no boost any more
  })

  it('adds a living Scourge\'s Tribute after the cap', () => {
    const b = buildBattle({ north: ['scourge@M20'] })
    const north = act(b.state, b.south, { kind: 'endTurn' }).state
    expect(north.seats[b.north].ap).toBe(apForRound(1) * APPROACH_BOOST + SCOURGE_AP_BONUS)
  })
})

describe('non-damage toughness loss that can kill (R19)', () => {
  it('lets a Shared wounds donor at 1 die; its death is reported', () => {
    const b = buildBattle({ south: ['priestess@E5:P', { type: 'footman', at: 'E6', label: 'D', toughness: 1 }, { type: 'soldier', at: 'F5', label: 'R', toughness: 3 }] })
    const r = act(b.state, b.south, {
      kind: 'useAbility',
      unitId: b.id('P'),
      abilityId: 'priestess.sharedWounds',
      targets: [
        { kind: 'unit', unitId: b.id('D') },
        { kind: 'unit', unitId: b.id('R') },
      ],
    })
    expect(unitIn(r.state, b.id('D'))).toBeUndefined()
    expect(unitIn(r.state, b.id('R'))?.toughness).toBe(4)
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'unitDied', unitId: b.id('D'), cause: 'toughnessLoss' }))
  })
})
