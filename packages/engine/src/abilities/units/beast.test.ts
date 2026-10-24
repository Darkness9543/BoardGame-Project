import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate, type Intent } from '../../commands'
import { KULEGA_HEAL_CAP, RATASIUS_WEAKNESS, RATASIUS_WEAKNESS_RANGE } from '../../constants'
import { unitDef } from '../../content/units'
import { parseSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { GameState, Seat } from '../../types'
import { filterEvents } from '../../view'

const SLAM = 'beast.forcefulSlam'
const FEAST = 'beast.feast'
const END: Intent = { kind: 'endTurn' }

// Test-local stand-ins for commander stubs: Ratasius' weakness (A7-14) for X-32, and Kulega's Fine Print (A7-10) to
// see a death trigger run after Feast's heal (X-08).
registerAbility(
  {
    id: 'ratasius.great',
    status: 'implemented',
    attackerSubtraction: (q, holder, hit) =>
      hit.dealer !== null && hit.dealer.owner !== holder.owner && q.distance(holder, hit.dealer) <= RATASIUS_WEAKNESS_RANGE ? RATASIUS_WEAKNESS : 0,
  },
  { replace: true },
)
registerAbility(
  {
    id: 'kulega.finePrint',
    status: 'implemented',
    onUnitDied: (ctx, holder, death) => {
      if ((death.tier === 1 || death.tier === 2) && death.footprint.some((s) => ctx.isAdjacent(holder, s))) {
        ctx.heal(holder, Math.min(KULEGA_HEAL_CAP, death.baseToughness), 'kulega.finePrint')
      }
    },
  },
  { replace: true },
)

const slam = (unitId: string, square: string): Intent => ({ kind: 'useAbility', unitId, abilityId: SLAM, targets: [{ kind: 'square', square: parseSquare(square) }] })
const feast = (unitId: string, eatenId: string): Intent => ({ kind: 'useAbility', unitId, abilityId: FEAST, targets: [{ kind: 'unit', unitId: eatenId }] })
const toughness = (state: GameState, id: string) => unitIn(state, id)?.toughness
const endTurns = (state: GameState, ...seats: Seat[]) => seats.reduce((s, seat) => act(s, seat, END).state, state)

describe('beast stats (8.12)', () => {
  it('is a Size-2 20/40 with LOV 2, Movement 2 and AP 3 from the content table', () => {
    expect(unitDef('beast')).toMatchObject({ power: 20, toughness: 40, size: 2, lov: 2, movement: 2, ap: 3, tier: 50 })
  })
})

// The Beast at J10 covers J10:K11. Slamming J12 (north of its left column) splashes I12, I13, J13, K13 and K12.
describe('beast.forcefulSlam (8.12, A8-20)', () => {
  it('deals 10 on the target square and 3 on the 5 squares beyond and beside it, own units included (BEA-1..3, X-18)', () => {
    const b = buildBattle({
      south: ['beast@J10:B', 'footman@K12:OWN'],
      north: ['juliomancer@J12:T', 'juliomancer@I12:W', 'juliomancer@I13:NW', 'juliomancer@J13:N', 'juliomancer@K13:NE', 'juliomancer@J14:FAR', 'juliomancer@L12:SIDE'],
    })
    const r = act(b.state, b.south, slam(b.id('B'), 'J12'))
    expect(toughness(r.state, b.id('T'))).toBe(15 - 10)
    expect(['W', 'NW', 'N', 'NE'].map((label) => toughness(r.state, b.id(label)))).toEqual([12, 12, 12, 12])
    expect(unitIn(r.state, b.id('OWN'))).toBeUndefined()
    expect([toughness(r.state, b.id('FAR')), toughness(r.state, b.id('SIDE')), toughness(r.state, b.id('B'))]).toEqual([15, 15, 40])
    expect(r.state.seats[b.south].ap).toBe(20 - 4)
    expect(unitIn(r.state, b.id('B'))?.cooldowns[SLAM]).toEqual({ usedOnOwnTurn: 1, readyOnOwnTurn: 3 })
    const hits = r.events.flatMap((e) => (e.type === 'unitDamaged' ? [e] : []))
    expect(new Set(hits.map((e) => e.unitId)).size).toBe(6)
    expect(hits.every((e) => e.kind === 'ability' && e.source === SLAM)).toBe(true)
  })

  it('splashes even when the target square is empty (A8-20)', () => {
    const b = buildBattle({ south: ['beast@J10:B'], north: ['juliomancer@J13:N'] })
    expect(toughness(act(b.state, b.south, slam(b.id('B'), 'J12')).state, b.id('N'))).toBe(15 - 3)
  })

  it('hits a Size-2 unit once: 10 if it covers the target, else 3 however many splash squares it covers (A1-10, A3-07)', () => {
    const onTarget = buildBattle({ south: ['beast@J10:B'], north: ['beast@J12:T'] })
    expect(toughness(act(onTarget.state, onTarget.south, slam(onTarget.id('B'), 'J12')).state, onTarget.id('T'))).toBe(40 - 10)
    // The Beast at P5 slams P7: the splash is O7, O8, P8, Q7 and Q8; each enemy Beast covers two of those squares.
    const beside = buildBattle({ south: ['beast@P5:B'], north: ['beast@N7:L', 'beast@Q7:R'] })
    const r = act(beside.state, beside.south, slam(beside.id('B'), 'P7'))
    expect([toughness(r.state, beside.id('L')), toughness(r.state, beside.id('R'))]).toEqual([37, 37])
  })

  it('sets off no mine on the target or splash squares (BEA-4, TMN-3)', () => {
    const b = buildBattle({ south: ['beast@J10:B'], mines: [{ owner: 'north', at: 'J12' }, { owner: 'north', at: 'J13' }, { owner: 'south', at: 'K12' }] })
    expect(act(b.state, b.south, slam(b.id('B'), 'J12')).state.mines).toHaveLength(3)
  })

  it('hits hidden units and reveals a Rogue on a splash square, which always lies in its LOV (BEA-5)', () => {
    const b = buildBattle({ south: ['beast@J10:B'], north: [{ type: 'rogue', at: 'J13', label: 'R', stealthed: true }] })
    expect(unitIn(act(b.state, b.south, slam(b.id('B'), 'J12')).state, b.id('R'))).toMatchObject({ toughness: 4 - 3, stealthed: false })
  })

  it('is ability damage: Defend and armour cut it, the Keep does not raise it (BEA-7, X-15)', () => {
    const b = buildBattle({ south: ['beast@J10:B'], north: [{ type: 'paladin', at: 'J12', label: 'P', defending: true }, 'juliomancer@J13:J'], control: { keep: 'south' } })
    const r = act(b.state, b.south, slam(b.id('B'), 'J12'))
    expect(toughness(r.state, b.id('P'))).toBe(18 - 4) // ceil((10 - 2) / 2)
    expect(toughness(r.state, b.id('J'))).toBe(15 - 3)
  })

  it("deals 1 to a Paladin inside its owner's Forcefield (B12)", () => {
    const b = buildBattle({ south: ['beast@J10:B'], north: ['royalWizard@J15:W', 'paladin@J12:P'], active: 'north' })
    const state = act(
      act(b.state, b.north, { kind: 'useAbility', unitId: b.id('W'), abilityId: 'royalWizard.forcefield', targets: [{ kind: 'squares', squares: sqs('J12', 'J13', 'J14', 'K13') }] }).state,
      b.north,
      END,
    ).state
    expect(toughness(act(state, b.south, slam(b.id('B'), 'J12')).state, b.id('P'))).toBe(18 - 1)
  })

  it('targets one of the 8 squares next to the footprint and has CD 1 (A8-20, A2-22)', () => {
    const b = buildBattle({ south: ['beast@J10:B'], north: ['juliomancer@L10:E'] })
    const check = (state: GameState, square: string) => validate(state, b.south, slam(b.id('B'), square))
    for (const square of ['J12', 'K12', 'J9', 'K9', 'I10', 'I11', 'L10', 'L11']) expect(check(b.state, square).ok).toBe(true)
    for (const square of ['J13', 'K11', 'L12']) expect(check(b.state, square)).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    const asUnit: Intent = { kind: 'useAbility', unitId: b.id('B'), abilityId: SLAM, targets: [{ kind: 'unit', unitId: b.id('E') }] }
    expect(validate(b.state, b.south, asUnit)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    let state = endTurns(act(b.state, b.south, slam(b.id('B'), 'J12')).state, b.south, b.north)
    expect(check(state, 'J12')).toMatchObject({ ok: false, code: 'ON_COOLDOWN' })
    state = endTurns(state, b.south, b.north)
    expect(check(state, 'J12').ok).toBe(true)
  })

  it('is a draw when one blow kills both commanders (X-19, A6-02)', () => {
    const b = buildBattle({ south: ['beast@J10:B', { type: 'commander', at: 'K12', label: 'MINE', toughness: 3 }], north: ['commander@J12'] })
    expect(act(b.state, b.south, slam(b.id('B'), 'J12')).state.result).toMatchObject({ winner: null, reason: 'simultaneousCommanderDeath' })
  })

  it('is weakened next to an enemy Ratasius: 6 on the target, and 1 rather than 0 on the splash (X-32, B15, BEA-6, R13)', () => {
    const b = buildBattle({ south: ['beast@J10:B'], north: ['commander@L10', 'juliomancer@J12:T', 'juliomancer@J13:S'], commanders: { north: 'ratasius' } })
    const r = act(b.state, b.south, slam(b.id('B'), 'J12'))
    expect([toughness(r.state, b.id('T')), toughness(r.state, b.id('S'))]).toEqual([15 - 6, 15 - 1])
  })
})

describe('beast.feast (8.12, A8-21)', () => {
  it('eats an adjacent own dummy for 2 AP and heals by its 7 (T7, DUM-8)', () => {
    const b = buildBattle({ south: [{ type: 'beast', at: 'J10', label: 'B', toughness: 30 }, 'noAcb@J12:D'] })
    const r = act(b.state, b.south, feast(b.id('B'), b.id('D')))
    expect(unitIn(r.state, b.id('D'))).toBeUndefined()
    expect(toughness(r.state, b.id('B'))).toBe(37)
    expect(r.state.seats[b.south].ap).toBe(20 - 2)
    expect(r.state.fallen).toEqual([expect.objectContaining({ unit: expect.objectContaining({ id: b.id('D') }), cause: 'sacrifice' })])
    const events = filterEvents(r.events, b.south)
    expect(events).toContainEqual(expect.objectContaining({ type: 'unitDied', unitId: b.id('D'), cause: 'sacrifice' }))
    expect(events).toContainEqual({ type: 'unitHealed', unitId: b.id('B'), amount: 7, toughness: 37, source: FEAST })
  })

  it("heals by the eaten unit's current toughness, never above max (BEA-9, BEA-12, T8)", () => {
    const hurt = buildBattle({ south: [{ type: 'beast', at: 'J10', label: 'B', toughness: 20 }, { type: 'soldier', at: 'J12', label: 'S', toughness: 3 }] })
    expect(toughness(act(hurt.state, hurt.south, feast(hurt.id('B'), hurt.id('S'))).state, hurt.id('B'))).toBe(20 + 3)
    const nearlyFull = buildBattle({ south: [{ type: 'beast', at: 'J10', label: 'B', toughness: 38 }, 'soldier@J12:S'] })
    expect(toughness(act(nearlyFull.state, nearlyFull.south, feast(nearlyFull.id('B'), nearlyFull.id('S'))).state, nearlyFull.id('B'))).toBe(40)
    const full = buildBattle({ south: ['beast@J10:B', 'soldier@J12:S'] })
    const wasted = act(full.state, full.south, feast(full.id('B'), full.id('S')))
    expect(unitIn(wasted.state, full.id('S'))).toBeUndefined()
    expect(toughness(wasted.state, full.id('B'))).toBe(40)
    expect(wasted.events.some((e) => e.type === 'unitHealed')).toBe(false)
  })

  it('eats only an adjacent own unit that is not the commander (BEA-8, A3-13)', () => {
    const b = buildBattle({ south: ['beast@J10:B', 'commander@I10:C', 'soldier@J13:FAR'], north: ['soldier@L10:E'] })
    const check = (label: string) => validate(b.state, b.south, feast(b.id('B'), b.id(label)))
    expect(check('E')).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(check('C')).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(check('B')).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(check('FAR')).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
  })

  it("counts as a death for other triggers, which run after Feast's heal (BEA-10, 2.11, X-08)", () => {
    const b = buildBattle({
      south: [{ type: 'beast', at: 'J10', label: 'B', toughness: 38 }, 'soldier@J12:S', { type: 'paladin', at: 'J13', label: 'P', toughness: 10 }],
      commanders: { south: 'kulega' },
    })
    const r = act(b.state, b.south, feast(b.id('B'), b.id('S')))
    expect([toughness(r.state, b.id('B')), toughness(r.state, b.id('P'))]).toEqual([40, 10 + KULEGA_HEAL_CAP])
    const order = filterEvents(r.events, b.south).flatMap((e) => (e.type === 'unitDied' || e.type === 'unitHealed' ? [`${e.type}:${e.unitId}`] : []))
    expect(order).toEqual([`unitDied:${b.id('S')}`, `unitHealed:${b.id('B')}`, `unitHealed:${b.id('P')}`])
  })
})
