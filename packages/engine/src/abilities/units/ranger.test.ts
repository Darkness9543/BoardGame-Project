import { describe, expect, it } from 'vitest'
import { validate } from '../../commands'
import { parseSquare, squaresWithin } from '../../geometry'
import { attackTargets } from '../../preview'
import { act, buildBattle, unitIn } from '../../testing/dsl'
import { filterEvents, projectView } from '../../view'

const shoot = (square: string) => ({ kind: 'square' as const, square: parseSquare(square) })

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
})
