import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { APPROACH_BOOST, BABA_CAULDRON_COST, BABA_CAULDRON_PER_TURN, apForRound } from './constants'
import { parseSquare, squareName } from './geometry'
import { act, buildBattle, unitIn } from './testing/dsl'
import { projectView } from './view'

// Test-local stand-in for Baba Yaga's Cauldron (R11), exercising the core primitives it needs: decisions,
// revive at a chosen square, exhaust, chargeAp (AP debt on the opponent's turn) and every-turn counters.
registerAbility(
  {
    id: 'babaYaga.cauldron',
    status: 'implemented',
    onUnitDied: (ctx, holder, death) => {
      if (death.unit.owner !== holder.owner || death.tier !== 1) return
      if (ctx.turnCounter(holder.owner, 'cauldron') >= BABA_CAULDRON_PER_TURN) return
      const squares = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }]
        .map((o) => ({ x: (holder.anchor?.x ?? 0) + o.x, y: (holder.anchor?.y ?? 0) + o.y }))
        .filter((s) => ctx.squareExists(s) && !ctx.isTerrain(s) && ctx.unitAt(s) === undefined)
      if (squares.length === 0) return
      ctx.requestDecision({
        abilityId: 'babaYaga.cauldron',
        holder,
        seat: holder.owner,
        kind: 'babaYaga.cauldron',
        prompt: 'Return it?',
        options: [...squares.map((s) => ({ id: squareName(s), label: squareName(s) })), { id: 'no', label: 'No' }],
        defaultOption: 'no',
        subject: death.unit,
        data: { unitId: death.unit.id, toughness: death.baseToughness },
      })
    },
    onDecision: (ctx, holder, decision, choice) => {
      const unitId = decision.data['unitId']
      const toughness = decision.data['toughness']
      if (choice === 'no' || holder === null || typeof unitId !== 'string' || typeof toughness !== 'number') return
      if (!ctx.chargeAp(holder.owner, BABA_CAULDRON_COST)) return
      const back = ctx.revive(unitId, toughness, parseSquare(choice))
      if (back !== null) ctx.exhaust(back)
      ctx.setTurnCounter(holder.owner, 'cauldron', ctx.turnCounter(holder.owner, 'cauldron') + 1)
    },
  },
  { replace: true },
)

describe('core primitives for owner ruling R11 (Cauldron)', () => {
  function setup() {
    return buildBattle({
      south: ['berserker@E8:B'],
      north: ['commander@E11:Y', 'mercenary@E9:M'],
      commanders: { north: 'babaYaga' },
      variants: { north: 'cauldron' },
    })
  }

  it('returns a dead unit at a chosen square, exhausted, and owes the AP when it is the opponent turn', () => {
    const b = setup()
    const paused = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('M') } }).state
    const decision = projectView(paused, b.north).decision
    expect(decision?.kind).toBe('babaYaga.cauldron')
    const r = act(paused, b.north, { kind: 'respondDecision', decisionId: decision?.id ?? '', choice: 'E12' })
    const mercenary = unitIn(r.state, b.id('M'))
    expect(mercenary?.anchor).toEqual(parseSquare('E12'))
    expect(mercenary?.toughness).toBe(1)
    expect(r.state.seats[b.north].apDebt).toBe(1)
    expect(r.state.seats[b.north].turnCounters['cauldron']).toBe(1)
    expect(projectView(r.state, b.north).myApDebt).toBe(1)

    const northTurn = act(r.state, b.south, { kind: 'endTurn' }).state
    expect(northTurn.seats[b.north].ap).toBe(apForRound(1) * APPROACH_BOOST - 1) // round 1 is boosted (R28); the debt comes off
    expect(northTurn.seats[b.north].apDebt).toBe(0)
    expect(northTurn.seats[b.north].turnCounters).toEqual({}) // every-turn counters reset
  })

  it('exhausts a unit returned on its own turn and pays the AP at once', () => {
    const b = buildBattle({
      south: ['commander@E11:Y', 'mercenary@E9:M'],
      north: [{ type: 'berserker', at: 'E8', label: 'B', defending: false }],
      commanders: { south: 'babaYaga' },
      variants: { south: 'cauldron' },
      mines: [{ owner: 'north', at: 'E10' }],
    })
    const paused = act(b.state, b.south, { kind: 'move', unitId: b.id('M'), path: [parseSquare('E10')] }).state
    const decision = projectView(paused, b.south).decision
    expect(decision?.kind).toBe('babaYaga.cauldron')
    const r = act(paused, b.south, { kind: 'respondDecision', decisionId: decision?.id ?? '', choice: 'D11' })
    expect(unitIn(r.state, b.id('M'))?.turn.actionsUsed).toBeGreaterThanOrEqual(1)
    expect(r.state.seats[b.south].ap).toBe(20 - 1 - 1) // the Move, then the Cauldron's AP
    expect(r.state.seats[b.south].apDebt).toBe(0)
  })
})
