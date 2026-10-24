import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import type { RulesQuery } from './query'
import { validate } from './commands'
import { area3x3, parseSquare, sameSquare } from './geometry'
import { act, buildBattle, unitIn } from './testing/dsl'
import { filterEvents, projectView } from './view'
import type { AreaState, GameState, Seat, Square, UnitCore } from './types'

const inside = (q: RulesQuery, squares: readonly Square[], seat: Seat): UnitCore[] =>
  q.units().filter((u) => u.owner === seat && q.footprint(u).some((s) => squares.some((a) => sameSquare(a, s))))

// Test-local stand-ins for stub abilities (the real ones are other agents' work).
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) =>
        ending === area.owner
          ? { heal: inside(q, area.squares, ending).map((u) => ({ target: u.id, amount: 3 })) }
          : { damage: inside(q, area.squares, ending).map((u) => ({ target: u.id, amount: 3 })) },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'scourge.commandAura',
    status: 'implemented',
    onUnitDied: (ctx, holder, death) => ctx.emit({ type: 'abilityNote', unitId: holder.id, abilityId: 'scourge.commandAura', note: `saw ${death.unit.id}` }, ['host', 'guest']),
  },
  { replace: true },
)
// The real beacon (R24) would add its heal to the resumed heal step; its own tests are in abilities/commanders/queso.test.ts.
registerAbility({ id: 'queso.beacon', status: 'stub' }, { replace: true })
registerAbility(
  {
    id: 'queso.revive',
    status: 'implemented',
    onUnitDied: (ctx, holder, death) => {
      if (death.unit.owner !== holder.owner || death.isCommander || ctx.distance(holder, death.footprint[0] ?? holder) > 2) return
      ctx.requestDecision({
        abilityId: 'queso.revive',
        holder,
        seat: holder.owner,
        kind: 'queso.revive',
        prompt: 'Revive?',
        options: [
          { id: 'yes', label: 'Revive' },
          { id: 'no', label: 'Let it go' },
        ],
        defaultOption: 'no',
        alwaysOption: 'yes',
        preferenceKey: 'revive',
        subject: death.unit,
        data: { unitId: death.unit.id, toughness: Math.ceil(death.baseToughness / 2) },
      })
    },
    onDecision: (ctx, holder, decision, choice) => {
      const unitId = decision.data['unitId']
      const toughness = decision.data['toughness']
      if (choice !== 'yes' || holder === null || typeof unitId !== 'string' || typeof toughness !== 'number') return
      ctx.changePermanentToughness(holder, -1)
      ctx.revive(unitId, toughness)
    },
  },
  { replace: true },
)

function addArea(state: GameState, owner: Seat, centre: string, createdOnOwnTurn: number, duration: number): void {
  const area: AreaState = {
    id: `a-test${state.areas.length}`,
    abilityId: 'royalWizard.pajazon',
    owner,
    sourceId: null,
    squares: area3x3(parseSquare(centre)),
    createdOnOwnTurn,
    expiresAtOwnTurn: createdOnOwnTurn + duration,
    seq: state.nextSeq++,
    data: {},
  }
  state.areas.push(area)
}

describe('end of turn order (2.10, A2-27, C33)', () => {
  it.each([
    [3, undefined],
    [4, 2],
  ])('T9/T10: a Soldier at %i inside an enemy Pajazon ends its turn at %s (damage first, then Perseverance)', (start, expected) => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: start }] })
    addArea(b.state, b.north, 'E5', 0, 2)
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(expected)
    const types = filterEvents(r.events, b.south).map((e) => e.type)
    expect(types.indexOf('unitDamaged')).toBeLessThan(types.indexOf('turnStarted'))
  })

  it('heals at the end of own turns and damages at the end of opponent turns, for two own turns (A2-23)', () => {
    const b = buildBattle({ south: [{ type: 'paladin', at: 'E10', label: 'P', toughness: 1 }], north: ['soldier@F10:S'] })
    addArea(b.state, b.south, 'E10', 1, 2)
    let state = b.state
    const log: string[] = []
    for (const seat of [b.south, b.north, b.south, b.north, b.south, b.north]) {
      const r = act(state, seat, { kind: 'endTurn' })
      for (const e of filterEvents(r.events, b.south)) {
        if ((e.type === 'unitHealed' || e.type === 'unitDamaged') && e.source === 'royalWizard.pajazon') log.push(`${e.type}:${e.amount}`)
        if (e.type === 'areaExpired') log.push('expired')
      }
      state = r.state
    }
    expect(log).toEqual(['unitHealed:3', 'unitDamaged:3', 'unitHealed:3', 'unitDamaged:3', 'expired'])
  })

  it('resolves simultaneous triggers non-active player first (APNAP, A2-28)', () => {
    const b = buildBattle({ south: ['scourge@E5:SA', 'berserker@G5:B'], north: ['scourge@E15:NB', 'footman@G6:F'] })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('F') } })
    const notes = filterEvents(r.events, b.south).flatMap((e) => (e.type === 'abilityNote' ? [e.unitId] : []))
    expect(notes).toEqual([b.id('NB'), b.id('SA')])
  })

  it('a commander killed by an end-of-turn tick ends the game before any heal (2.10 step 2)', () => {
    const b = buildBattle({ south: [{ type: 'commander', at: 'E5', label: 'C', toughness: 3 }] })
    addArea(b.state, b.north, 'E5', 0, 2)
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(r.state.result).toMatchObject({ winner: b.north, reason: 'conquest' })
    expect(r.state.phase).toBe('ended')
  })
})

describe('reaction decisions during the end phase (2.11, A2-30, X-26)', () => {
  function setup() {
    const b = buildBattle({
      south: ['commander@E3:Q', { type: 'soldier', at: 'E5', label: 'S', toughness: 3 }, { type: 'soldier', at: 'F4', label: 'T', toughness: 5 }],
      commanders: { south: 'queso' },
    })
    addArea(b.state, b.north, 'E5', 0, 2)
    return b
  }

  it('pauses the end phase until the decider answers, then resumes in order', () => {
    const b = setup()
    const paused = act(b.state, b.south, { kind: 'endTurn' }).state
    expect(paused.decisions).toHaveLength(1)
    expect(paused.transition).toEqual({ endingSeat: b.south, next: 'heal' })
    expect(paused.turn?.activeSeat).toBe(b.south)
    expect(projectView(paused, b.south).decision?.kind).toBe('queso.revive')
    expect(validate(paused, b.south, { kind: 'endTurn' })).toMatchObject({ ok: false, code: 'DECISION_PENDING' })
    // North can't see the prompt: it is answered as if there were none (2.11), and a legal intent waits.
    expect(validate(paused, b.north, { kind: 'endTurn' })).toEqual(validate(b.state, b.north, { kind: 'endTurn' }))
    expect(validate(paused, b.north, { kind: 'endTurn' })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' })
    expect(validate(paused, b.north, { kind: 'offerDraw' })).toMatchObject({ ok: false, code: 'DECISION_PENDING' })

    const decisionId = paused.decisions[0]?.id ?? ''
    const r = act(paused, b.south, { kind: 'respondDecision', decisionId, choice: 'yes' })
    const soldier = unitIn(r.state, b.id('S'))
    expect(soldier?.toughness).toBe(4 + 1) // revived at ceil(7 / 2) = 4, then Perseverance +1 in the resumed heal step
    expect(soldier?.anchor).toEqual(parseSquare('E5'))
    const queso = unitIn(r.state, b.id('Q'))
    expect(queso?.permanentToughness).toBe(-1)
    expect(r.state.turn?.activeSeat).toBe(b.north)
    expect(r.state.transition).toBeNull()
  })

  it('answers at once from an Always / Never preference, without pausing', () => {
    const b = setup()
    const always = act(b.state, b.south, { kind: 'setPreference', key: 'revive', value: 'always' }).state
    const r = act(always, b.south, { kind: 'endTurn' })
    expect(r.state.decisions).toHaveLength(0)
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(5)
    const never = act(b.state, b.south, { kind: 'setPreference', key: 'revive', value: 'never' }).state
    const r2 = act(never, b.south, { kind: 'endTurn' })
    expect(unitIn(r2.state, b.id('S'))).toBeUndefined()
    expect(r2.state.turn?.activeSeat).toBe(b.north)
  })

  it('tells the other seat a decision is pending only if it could see the subject', () => {
    const b = setup()
    const paused = act(b.state, b.south, { kind: 'endTurn' }).state
    expect(projectView(paused, b.north).opponentDeciding).toBe(false)
    expect(projectView(paused, b.north).decision).toBeNull()
  })
})
