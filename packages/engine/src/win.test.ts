import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { validate } from './commands'
import { parseSquare } from './geometry'
import { act, buildBattle, sqs } from './testing/dsl'

// Test-local stand-in: a 10-damage blast on every unit within range 1 of the target square, as one
// simultaneous effect (like Forceful slam, X-19).
registerAbility(
  {
    id: 'beast.forcefulSlam',
    status: 'implemented',
    active: {
      targets: [{ kind: 'square', label: 'Target', minRange: 1, range: 1, free: false }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        if (t?.kind !== 'square') return
        const hit = [ctx.unitAt(t.square), ...ctx.unitsWithin(t.square, 1)].filter((u) => u !== undefined && u.id !== unit.id)
        ctx.dealDamageTogether(hit.flatMap((target) => (target === undefined ? [] : [{ target, kind: 'ability' as const, base: 10, source: 'beast.forcefulSlam', dealer: unit }])))
      },
    },
  },
  { replace: true },
)

describe('conquest (6.2)', () => {
  it('wins at once when the enemy commander dies (A6-01)', () => {
    const b = buildBattle({ south: ['berserker@M12:B'], north: ['commander@M13:C'] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('C') } })
    expect(r.state.result).toEqual({ winner: b.south, reason: 'conquest', turnNumber: 1 })
    expect(r.state.phase).toBe('ended')
  })

  it('is a draw when both commanders die in the same resolution (A6-02, X-19)', () => {
    const b = buildBattle({ south: ['beast@L10:B', 'commander@N12'], north: ['commander@M13'] })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('B'), abilityId: 'beast.forcefulSlam', targets: [{ kind: 'square', square: parseSquare('M12') }] })
    expect(r.state.result).toMatchObject({ winner: null, reason: 'simultaneousCommanderDeath' })
  })

  it('loses to your own mine (TMN-6, X-17)', () => {
    const b = buildBattle({ south: ['commander@M5:C'], mines: [{ owner: 'south', at: 'M6' }] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('C'), path: sqs('M6') })
    expect(r.state.result).toMatchObject({ winner: b.north, reason: 'conquest' })
  })
})

describe('domination: reaching the last row (6.3)', () => {
  it('wins the moment the commander enters its goal row (A6-03, A6-04)', () => {
    const b = buildBattle({ south: ['commander@M24:C'] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('C'), path: sqs('M25') })
    expect(r.state.result).toMatchObject({ winner: b.south, reason: 'domination' })
  })

  it("does not win if the step's mine kills it first (X-04)", () => {
    const b = buildBattle({ south: ['commander@M24:C'], mines: [{ owner: 'north', at: 'M25' }] })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('C'), path: sqs('M25') })
    expect(r.state.result).toMatchObject({ winner: b.north, reason: 'conquest' })
  })

  it('works for North towards row 1', () => {
    const b = buildBattle({ north: ['commander@M2:C'], active: 'north' })
    const r = act(b.state, b.north, { kind: 'move', unitId: b.id('C'), path: sqs('M1') })
    expect(r.state.result).toMatchObject({ winner: b.north, reason: 'domination' })
  })
})

describe('resignation and draws (2.12)', () => {
  it('lets either player resign at any time', () => {
    const b = buildBattle()
    expect(act(b.state, b.north, { kind: 'resign' }).state.result).toMatchObject({ winner: b.south, reason: 'resignation' })
  })

  it('ends in a draw only when the opponent accepts the offer', () => {
    const b = buildBattle()
    const offered = act(b.state, b.south, { kind: 'offerDraw' }).state
    expect(validate(offered, b.south, { kind: 'acceptDraw' })).toMatchObject({ ok: false, code: 'NO_DRAW_OFFER' })
    const declined = act(offered, b.north, { kind: 'declineDraw' }).state
    expect(declined.drawOffer).toBeNull()
    const agreed = act(act(b.state, b.south, { kind: 'offerDraw' }).state, b.north, { kind: 'acceptDraw' }).state
    expect(agreed.result).toMatchObject({ winner: null, reason: 'agreement' })
  })
})
