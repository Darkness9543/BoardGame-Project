import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate, type Intent } from '../../commands'
import { COMMAND_AURA_RANGE, KEEP_POWER_BONUS } from '../../constants'
import { abilityParam } from '../../content/abilities'
import { commanderStats } from '../../content/derived'
import { unitDef } from '../../content/units'
import { act, buildBattle, sqs, unitIn, type Battle } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import { SEATS, type GameState, type Seat } from '../../types'
import { filterEvents, projectView } from '../../view'

const AURA_POWER = abilityParam('priestess.strongAura', 'power')
const AURA_TOUGHNESS = abilityParam('priestess.strongAura', 'toughness')
const PRIESTESS = unitDef('priestess')
const share = (toughness: number): number => Math.ceil(toughness / 2) // R19

// Test-local stand-ins: Command Aura (an extra action) and a Fine Print that only reports the deaths it sees.
registerAbility(
  {
    id: 'scourge.commandAura',
    status: 'implemented',
    modifyStats: (q, holder, target) => (target.id !== holder.id && target.owner === holder.owner && q.distance(holder, target) <= COMMAND_AURA_RANGE ? { actions: 1 } : null),
  },
  { replace: true },
)
registerAbility(
  {
    id: 'kulega.finePrint',
    status: 'implemented',
    onUnitDied: (ctx, holder, death) => ctx.emit({ type: 'abilityNote', unitId: holder.id, abilityId: 'kulega.finePrint', note: `saw ${death.unit.id}` }, [holder.owner]),
  },
  { replace: true },
)

/** power/current/max as the seat sees it. */
function stats(state: GameState, seat: Seat, id: string): string | undefined {
  const u = projectView(state, seat).units.find((x) => x.id === id)
  return u === undefined ? undefined : `${u.power}/${u.toughness}/${u.maxToughness}`
}

const wounds = (b: Battle, donor: string, recipient: string, priestess = 'P'): Intent => ({
  kind: 'useAbility',
  unitId: b.id(priestess),
  abilityId: 'priestess.sharedWounds',
  targets: [
    { kind: 'unit', unitId: b.id(donor) },
    { kind: 'unit', unitId: b.id(recipient) },
  ],
})

describe('priestess.strongAura (8.7, A8-08)', () => {
  it('gives adjacent own units +1/+1, never the Priestess herself or enemies', () => {
    const b = buildBattle({ south: ['priestess@M8:P', 'soldier@M9:S'], north: ['footman@L8:F'] })
    const soldier = unitDef('soldier')
    expect(stats(b.state, b.south, b.id('S'))).toBe(`${soldier.power + AURA_POWER}/${soldier.toughness + AURA_TOUGHNESS}/${soldier.toughness + AURA_TOUGHNESS}`)
    expect(stats(b.state, b.south, b.id('P'))).toBe(`${PRIESTESS.power}/${PRIESTESS.toughness}/${PRIESTESS.toughness}`)
    expect(stats(b.state, b.south, b.id('F'))).toBe('1/2/2')
  })

  it('buffs dummies and the commander (PRI-1, X-20: a 2/6 commander under R8)', () => {
    const b = buildBattle({ south: ['priestess@M8:P', 'noAcb@M9:D', 'commander@L8:C'] })
    expect(stats(b.state, b.south, b.id('D'))).toBe('1/8/8')
    const commander = commanderStats('baseline')
    expect(stats(b.state, b.south, b.id('C'))).toBe(`${commander.power + 1}/${commander.toughness + 1}/${commander.toughness + 1}`)
  })

  it('lets two adjacent Priestesses buff each other, and never stacks on one unit (PRI-2, A3-15)', () => {
    const pair = buildBattle({ south: ['priestess@M8:P', 'priestess@M9:Q'] })
    expect(stats(pair.state, pair.south, pair.id('P'))).toBe('4/16/16')
    const both = buildBattle({ south: ['priestess@L8', 'priestess@N8', 'soldier@M8:S'] })
    expect(stats(both.state, both.south, both.id('S'))).toBe('3/8/8')
  })

  it('reaches a Beast through any of its squares (PRI-3)', () => {
    const b = buildBattle({ south: ['priestess@M8:P', 'beast@N8:B'] })
    expect(stats(b.state, b.south, b.id('B'))).toBe('21/41/41')
  })

  it('raises current and max together when gained, and never kills when lost (A3-11, PRI-4, T2, T3)', () => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'M9', label: 'S', toughness: 5 }, 'priestess@O8:P'] })
    const joined = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('N8', 'M8') }).state
    expect(stats(joined, b.south, b.id('S'))).toBe('3/6/8')

    const footman = buildBattle({ south: [{ type: 'footman', at: 'M9', label: 'F', toughness: 1 }, 'priestess@M8:P'] })
    expect(stats(footman.state, footman.south, footman.id('F'))).toBe('2/1/3')
    const left = act(footman.state, footman.south, { kind: 'move', unitId: footman.id('P'), path: sqs('L8', 'K8') }).state
    expect(stats(left, footman.south, footman.id('F'))).toBe('1/1/2')

    const commander = buildBattle({ south: [{ type: 'commander', at: 'M9', label: 'C', toughness: 1 }, 'priestess@M8:P'] })
    const away = act(commander.state, commander.south, { kind: 'move', unitId: commander.id('C'), path: sqs('M10') }).state
    expect(unitIn(away, commander.id('C'))?.toughness).toBe(1)
  })

  it('ends with the Priestess: her death takes the bonus away, never below 1', () => {
    const b = buildBattle({ south: ['berserker@M7:B'], north: [{ type: 'priestess', at: 'M8', label: 'P', toughness: 8 }, { type: 'soldier', at: 'M9', label: 'S', toughness: 1 }, 'soldier@N8:T'] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('P') } })
    expect(unitIn(r.state, b.id('P'))).toBeUndefined()
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(1)
    expect(unitIn(r.state, b.id('T'))?.toughness).toBe(unitDef('soldier').toughness)
  })

  it('adds its Power to attacks: Berserker 8 + Keep 1 + aura 1 (B25 under R20 and R31)', () => {
    const b = buildBattle({ south: ['priestess@L14:P', 'berserker@M14:B'], north: ['emissary@M15:E'], control: { keep: 'south' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('E') } })
    expect(unitIn(r.state, b.id('E'))?.toughness).toBe(unitDef('emissary').toughness - (unitDef('berserker').power + KEEP_POWER_BONUS + AURA_POWER))
  })
})

describe('priestess.sharedWounds (8.7, A8-09; owner ruling R19)', () => {
  it('moves half of the donor toughness, rounded up, to the recipient; the overflow is wasted (R19, PRI-6, T6)', () => {
    // The Priestess donates 15 -> loses 8; the Footman next to her (max 3 with the aura) heals only 2.
    const b = buildBattle({ south: ['priestess@M8:P', { type: 'footman', at: 'M9', label: 'F', toughness: 1 }] })
    const r = act(b.state, b.south, wounds(b, 'P', 'F'))
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(PRIESTESS.toughness - share(PRIESTESS.toughness))
    expect(unitIn(r.state, b.id('F'))?.toughness).toBe(3) // capped at max toughness, the aura included (PRI-7)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'toughnessLost', unitId: b.id('P'), amount: share(PRIESTESS.toughness), toughness: 7, source: 'priestess.sharedWounds' })
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitHealed', unitId: b.id('F'), amount: 2, toughness: 3, source: 'priestess.sharedWounds' })
  })

  it('costs the Priestess her own AP (2) and her action (A2-12)', () => {
    const b = buildBattle({ south: ['priestess@M8:P', { type: 'soldier', at: 'M9', label: 'S', toughness: 2 }] })
    const r = act(b.state, b.south, wounds(b, 'P', 'S'))
    expect(r.state.seats[b.south].ap).toBe(20 - PRIESTESS.ap)
    expect(unitIn(r.state, b.id('P'))?.turn.actionsUsed).toBe(1)
    expect(validate(r.state, b.south, wounds(b, 'P', 'S'))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('kills a donor at 1, a death for every trigger, which runs after the heal (R19, Q106, 2.11)', () => {
    const b = buildBattle({
      south: ['priestess@M8:P', { type: 'footman', at: 'M9', label: 'D', toughness: 1 }, { type: 'soldier', at: 'L8', label: 'R', toughness: 3 }, 'paladin@M10:K'],
      commanders: { south: 'kulega' },
    })
    const r = act(b.state, b.south, wounds(b, 'D', 'R'))
    expect(unitIn(r.state, b.id('D'))).toBeUndefined()
    expect(unitIn(r.state, b.id('R'))?.toughness).toBe(4)
    const events = filterEvents(r.events, b.south)
    expect(events).toContainEqual(expect.objectContaining({ type: 'unitDied', unitId: b.id('D'), cause: 'toughnessLoss' }))
    const healed = events.findIndex((e) => e.type === 'unitHealed')
    const trigger = events.findIndex((e) => e.type === 'abilityNote' && e.note === `saw ${b.id('D')}`)
    expect(trigger).toBeGreaterThan(healed)
  })

  it('takes the Priestess or own units next to her, as two different picks (A8-09, PRI-8, PRI-9, PRI-12)', () => {
    const b = buildBattle({ south: ['priestess@M8:P', 'soldier@M9:S', 'soldier@M10:FAR'], north: ['soldier@L8:E'] })
    expect(validate(b.state, b.south, wounds(b, 'S', 'S'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
    expect(validate(b.state, b.south, wounds(b, 'E', 'S'))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(validate(b.state, b.south, wounds(b, 'S', 'E'))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(validate(b.state, b.south, wounds(b, 'FAR', 'S'))).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    expect(validate(b.state, b.south, wounds(b, 'S', 'FAR'))).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    expect(validate(b.state, b.south, wounds(b, 'S', 'P')).ok).toBe(true)
    expect(validate(b.state, b.south, wounds(b, 'P', 'S')).ok).toBe(true)
  })

  it('lets the commander give or receive, but never its last toughness (PRI-10, A7-04 with R19)', () => {
    const b = buildBattle({ south: ['priestess@M8:P', { type: 'commander', at: 'M9', label: 'C', toughness: 2 }, { type: 'soldier', at: 'L8', label: 'S', toughness: 2 }] })
    const r = act(b.state, b.south, wounds(b, 'C', 'S'))
    expect(unitIn(r.state, b.id('C'))?.toughness).toBe(1)
    expect(validate(r.state, b.south, wounds(b, 'S', 'C'))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
    const low = buildBattle({ south: ['priestess@M8:P', { type: 'commander', at: 'M9', label: 'C', toughness: 1 }, { type: 'soldier', at: 'L8', label: 'S', toughness: 2 }] })
    expect(validate(low.state, low.south, wounds(low, 'C', 'S'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET', message: 'The commander cannot give its last toughness' })
    expect(validate(low.state, low.south, wounds(low, 'S', 'C')).ok).toBe(true)
  })

  it('is not damage: no Armor, no Defend halving, no reveal (A3-08, PRI-11)', () => {
    const b = buildBattle({ south: ['priestess@M8:P', { type: 'paladin', at: 'M9', label: 'K', toughness: 18, defending: true }, { type: 'soldier', at: 'L8', label: 'S', toughness: 1 }] })
    const r = act(b.state, b.south, wounds(b, 'K', 'S'))
    expect(unitIn(r.state, b.id('K'))?.toughness).toBe(18 - share(18))

    const sneaky = buildBattle({ south: ['priestess@M8:P', { type: 'rogue', at: 'M9', label: 'R', stealthed: true }, { type: 'soldier', at: 'L8', label: 'S', toughness: 1 }], north: ['ranger@M12'] })
    const r2 = act(sneaky.state, sneaky.south, wounds(sneaky, 'R', 'S'))
    expect(unitIn(r2.state, sneaky.id('R'))).toMatchObject({ stealthed: true, toughness: unitDef('rogue').toughness + AURA_TOUGHNESS - share(unitDef('rogue').toughness + AURA_TOUGHNESS) })
    expect(filterEvents(r2.events, sneaky.north).some((e) => e.type === 'toughnessLost')).toBe(false)
    for (const seat of SEATS) expect(findLeaks(r2.state, seat)).toEqual([])
  })

  it('may heal a unit already at full: the donor still pays (PRI-6)', () => {
    const b = buildBattle({ south: ['priestess@M8:P', 'soldier@M9:S'] })
    const r = act(b.state, b.south, wounds(b, 'P', 'S'))
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(PRIESTESS.toughness - share(PRIESTESS.toughness))
    expect(r.events.some((e) => e.type === 'unitHealed')).toBe(false)
  })

  it('can be used twice in a turn with an extra action (PRI-12)', () => {
    const b = buildBattle({ south: ['priestess@M8:P', 'scourge@O8', { type: 'soldier', at: 'M9', label: 'S', toughness: 1 }] })
    let state = act(b.state, b.south, wounds(b, 'P', 'S')).state
    state = act(state, b.south, wounds(b, 'P', 'S')).state
    expect(unitIn(state, b.id('P'))?.toughness).toBe(PRIESTESS.toughness - share(PRIESTESS.toughness) - share(PRIESTESS.toughness - share(PRIESTESS.toughness)))
    expect(state.seats[b.south].ap).toBe(20 - 2 * PRIESTESS.ap)
  })
})
