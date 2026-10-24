import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate } from '../../commands'
import { KEEP_POWER_BONUS, RATASIUS_WEAKNESS, RATASIUS_WEAKNESS_RANGE, TRILL_TOUGHNESS_BONUS } from '../../constants'
import { abilityParam } from '../../content/abilities'
import { unitDef } from '../../content/units'
import { parseSquare, squaresWithin } from '../../geometry'
import { attackTargets } from '../../preview'
import { act, buildBattle, unitIn } from '../../testing/dsl'
import { filterEvents, projectView } from '../../view'

const shoot = (square: string) => ({ kind: 'square' as const, square: parseSquare(square) })
const RANGER = unitDef('ranger')
const RANGE = abilityParam('ranger.rangedAttack', 'range')

// Test-local stand-ins for commander effects (other files): Ratasius' weakness (R13, R41), Kulega's +1 LOV and Trill's
// toughness bonus (R23).
registerAbility(
  {
    id: 'ratasius.great',
    status: 'implemented',
    attackerSubtraction: (q, holder, hit) => (hit.dealer !== null && hit.dealer.owner !== holder.owner && q.distance(holder, hit.dealer) <= RATASIUS_WEAKNESS_RANGE ? RATASIUS_WEAKNESS : 0),
  },
  { replace: true },
)
registerAbility({ id: 'kulega.finePrinter', status: 'implemented', modifyStats: (_q, holder, target) => (target.owner === holder.owner ? { lov: 1 } : null) }, { replace: true })
registerAbility(
  {
    id: 'trill.hydrocephalic',
    status: 'implemented',
    modifyStats: (q, holder, target) => {
      const tier = q.tierOf(target)
      return target.owner === holder.owner && (tier === 1 || tier === 2 || tier === 5) ? { baseToughness: TRILL_TOUGHNESS_BONUS } : null
    },
  },
  { replace: true },
)

describe('ranger.rangedAttack (8.4, A8-04)', () => {
  it('has attack range 2: 12 squares, diagonal neighbours included, no minimum (RNG-1)', () => {
    const b = buildBattle({ south: ['ranger@M10:R'], north: ['footman@N11:D', 'footman@M12:F', 'footman@M13:X'] })
    expect(projectView(b.state, b.south).units.find((u) => u.id === b.id('R'))?.attackRange).toBe(2)
    const targets = attackTargets(projectView(b.state, b.south), b.id('R'))
    const units = targets.flatMap((t) => (t.kind === 'unit' ? [t.unitId] : []))
    expect(units.sort()).toEqual([b.id('D'), b.id('F')].sort())
    expect(targets.filter((t) => t.kind === 'square')).toHaveLength(squaresWithin(parseSquare('M10'), 1, 2).length - 1 - 2)
  })

  it('may shoot an empty square: "Nothing there", AP and action spent (A2-18, RNG-4)', () => {
    const b = buildBattle({ south: ['ranger@E5:R'] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: shoot('E7') })
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'attackMissed', attackerId: b.id('R'), square: parseSquare('E7') })
    expect(r.state.seats[b.south].ap).toBe(20 - 1)
    expect(unitIn(r.state, b.id('R'))?.turn.actionsUsed).toBe(1)
  })

  it('hits an invisible unit on the square and reveals it (RNG-4, X-23)', () => {
    const b = buildBattle({ south: ['ranger@E5:R'], north: [{ type: 'rogue', at: 'F6', label: 'G', stealthed: true }] })
    expect(projectView(b.state, b.south).units.some((u) => u.id === b.id('G'))).toBe(false)
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: shoot('F6') })
    expect(unitIn(r.state, b.id('G'))).toMatchObject({ toughness: 1, stealthed: false })
  })

  it('sets off a mine on the square from a distance, without damage, whoever owns it (L101, X-24)', () => {
    const b = buildBattle({ south: ['ranger@E5:R'], north: ['ranger@E9:N'], mines: [{ owner: 'north', at: 'E7' }, { owner: 'south', at: 'F6' }] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: shoot('E7') })
    expect(r.state.mines.map((m) => m.owner)).toEqual([b.south])
    expect(filterEvents(r.events, b.north)).toContainEqual(expect.objectContaining({ type: 'mineExploded', trigger: 'shot', victimId: null }))
    const r2 = act(r.state, b.south, { kind: 'endTurn' })
    const r3 = act(act(r2.state, b.north, { kind: 'endTurn' }).state, b.south, { kind: 'attack', unitId: b.id('R'), target: shoot('F6') })
    expect(r3.state.mines).toHaveLength(0)
  })

  it('cannot shoot a square holding an own unit, and melee units cannot target squares (C28)', () => {
    const b = buildBattle({ south: ['ranger@E5:R', 'footman@E7:F', 'soldier@G5:S'] })
    expect(validate(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: shoot('E7') })).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(validate(b.state, b.south, { kind: 'attack', unitId: b.id('S'), target: shoot('G6') })).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(validate(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: shoot('E8') })).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
  })

  it("stays hidden when it shoots from outside the target's vision (A4-12, C23)", () => {
    const b = buildBattle({ south: ['ranger@E5:R'], north: ['footman@E7:F'] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: { kind: 'unit', unitId: b.id('F') } })
    expect(projectView(r.state, b.north).units.some((u) => u.id === b.id('R'))).toBe(false)
  })

  it('shoots past units in the way: there is no line of fire (RNG-2)', () => {
    const b = buildBattle({ south: ['ranger@E5:R', 'paladin@E6'], north: ['soldier@E7:S'] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(unitDef('soldier').toughness - RANGER.power)
  })

  it("measures range to a 2x2 target's nearest square (1.4)", () => {
    const b = buildBattle({ south: ['ranger@E5:R'], north: ['beast@F6:NEAR', 'beast@H5:FAR'] })
    expect(validate(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: { kind: 'unit', unitId: b.id('NEAR') } }).ok).toBe(true)
    expect(validate(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: { kind: 'unit', unitId: b.id('FAR') } })).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
  })

  it('always tells the owner of a mine it set off, even without sight of the square (RNG-5)', () => {
    const b = buildBattle({ south: ['ranger@E5:R'], mines: [{ owner: 'north', at: 'E7' }] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: shoot('E7') })
    for (const seat of [b.south, b.north]) expect(filterEvents(r.events, seat)).toContainEqual(expect.objectContaining({ type: 'mineExploded', trigger: 'shot' }))
  })

  it('is not weakened by Ratasius from distance 2, only from next to him (RNG-6, R13 floor 1, R41)', () => {
    const b = buildBattle({ south: ['ranger@E5:FAR', 'ranger@F7:NEAR'], north: ['commander@E7:C'], commanders: { north: 'ratasius' } })
    const far = act(b.state, b.south, { kind: 'attack', unitId: b.id('FAR'), target: { kind: 'unit', unitId: b.id('C') } })
    const toughness = unitIn(b.state, b.id('C'))?.toughness ?? 0
    expect(unitIn(far.state, b.id('C'))?.toughness).toBe(toughness - RANGER.power)
    const near = act(b.state, b.south, { kind: 'attack', unitId: b.id('NEAR'), target: { kind: 'unit', unitId: b.id('C') } })
    expect(unitIn(near.state, b.id('C'))?.toughness).toBe(toughness - 1)
  })

  it('adds the Keep bonus to its shots (R31)', () => {
    const b = buildBattle({ south: ['ranger@E5:R'], north: ['soldier@E7:S'], control: { keep: 'south' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('R'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(unitDef('soldier').toughness - (RANGER.power + KEEP_POWER_BONUS))
  })

  it('keeps range 2 under Kulega (LOV 4) and is 3/2 under Trill (RNG-7 with R23)', () => {
    const kulega = buildBattle({ south: ['ranger@E5:R'], commanders: { south: 'kulega' } })
    expect(projectView(kulega.state, kulega.south).units.find((u) => u.id === kulega.id('R'))).toMatchObject({ lov: RANGER.lov + 1, attackRange: RANGE })
    const trill = buildBattle({ south: ['ranger@E5:R'], commanders: { south: 'trill' } })
    expect(projectView(trill.state, trill.south).units.find((u) => u.id === trill.id('R'))).toMatchObject({ power: RANGER.power, maxToughness: RANGER.toughness + TRILL_TOUGHNESS_BONUS })
  })
})
