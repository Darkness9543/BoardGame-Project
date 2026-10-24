import { describe, expect, it } from 'vitest'
import { QUESO_AP, QUESO_BEACON_HEAL, QUESO_COMMANDER_TOUGHNESS, REACTION_PROMPT_TIMEOUT_S } from '../../constants'
import { validate } from '../../commands'
import type { GameEvent } from '../../events'
import { area3x3, footprintSquares, parseSquare, sameSquare } from '../../geometry'
import { StateQuery } from '../../query'
import { act, buildBattle, sqs, unitIn, type Battle, type PlacementSpec } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import type { GameState, Seat, UnitState, UnitTypeId } from '../../types'
import { filterEvents, projectView } from '../../view'
import { registerAbility } from '../registry'

// Test-local stand-ins for other agents' stubs: Pajazon areas (A8-19: heal own units at the end of the owner's turn,
// 3 damage to enemy units at the end of the opponent's), a bare sacrifice (Feast without its own heal, A8-21) and
// Assault (A8-07).
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) => {
        const inside = q.units().filter((u) => u.owner === ending && q.footprint(u).some((s) => area.squares.some((a) => sameSquare(a, s))))
        return ending === area.owner ? { heal: inside.map((u) => ({ target: u.id, amount: 3 })) } : { damage: inside.map((u) => ({ target: u.id, amount: 3 })) }
      },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'beast.feast',
    status: 'implemented',
    active: {
      targets: [{ kind: 'unit', label: 'Meal', range: 1, relation: 'own', includeSelf: false, allowCommander: false }],
      resolve: (ctx, _unit, targets) => {
        const t = targets[0]
        const meal = t?.kind === 'unit' ? ctx.unit(t.unitId) : undefined
        if (meal !== undefined) ctx.sacrifice(meal, 'beast.feast')
      },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'rogue.assault',
    status: 'implemented',
    onAdjacencyGained: (ctx, holder, info) => {
      if (!holder.stealthed) return
      const target = info.holderIsMover ? info.enemies[0] : info.step.mover
      if (target !== undefined) ctx.attack(holder, { kind: 'unit', unitId: target.id }, { source: 'rogue.assault', triggered: true })
      return 'interrupt'
    },
  },
  { replace: true },
)

function addArea(state: GameState, owner: Seat, centre: string): void {
  state.areas.push({ id: `a-q${state.areas.length}`, abilityId: 'royalWizard.pajazon', owner, sourceId: null, squares: area3x3(parseSquare(centre)), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 90 + state.areas.length, data: {} })
}

function stored(state: GameState, id: string): UnitState {
  const unit = state.units.find((u) => u.id === id)
  if (unit === undefined) throw new Error(`no living unit ${id}`)
  return unit
}

/** Lowers Queso's max toughness as earlier revives would have (R18), so the limits can be tested directly. */
function setQuesoBase(b: Battle, base: number): void {
  const queso = stored(b.state, b.id('Q'))
  queso.permanentToughness = base - QUESO_COMMANDER_TOUGHNESS
  queso.toughness = base
}

function answer(state: GameState, seat: Seat, choice: string) {
  const decision = projectView(state, seat).decision
  if (decision === null) throw new Error('no decision to answer')
  return act(state, seat, { kind: 'respondDecision', decisionId: decision.id, choice })
}

/** Queso on M3, the victim V on M5 (distance 2), a North Berserker on M6 about to strike it on North's turn. */
function victimSetup(victim: Partial<PlacementSpec> & { readonly type: UnitTypeId }): Battle {
  return buildBattle({ south: ['commander@M3:Q', { at: 'M5', label: 'V', ...victim }], north: ['berserker@M6:B'], commanders: { south: 'queso' }, active: 'north' })
}

function strike(b: Battle, state: GameState = b.state, target = 'V') {
  return act(state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id(target) } })
}

const types = (events: readonly GameEvent[], seat: Seat) => filterEvents(events, seat).map((e) => e.type)

describe('the Queso commander (R8, R17)', () => {
  it('is 1/6 and pays 2 AP for each of its actions', () => {
    const b = buildBattle({ south: ['commander@M3:Q'], commanders: { south: 'queso' } })
    const queso = projectView(b.state, b.south).units.find((u) => u.id === b.id('Q'))
    expect([queso?.maxToughness, queso?.own?.apCost]).toEqual([QUESO_COMMANDER_TOUGHNESS, QUESO_AP])
    expect(act(b.state, b.south, { kind: 'move', unitId: b.id('Q'), path: sqs('M4') }).state.seats[b.south].ap).toBe(20 - QUESO_AP)
  })
})

describe('queso.beacon (7.9, A7-15; heal 3 under owner ruling R24)', () => {
  function setup() {
    return buildBattle({
      south: [
        { type: 'commander', at: 'M3', label: 'Q', toughness: 2 },
        { type: 'paladin', at: 'M5', label: 'P', toughness: 10 },
        { type: 'soldier', at: 'N4', label: 'S', toughness: 6 },
        { type: 'footman', at: 'M6', label: 'FAR', toughness: 1 },
      ],
      north: [{ type: 'footman', at: 'L4', label: 'E', toughness: 1 }],
      commanders: { south: 'queso' },
    })
  }

  it('heals own units within range 2 of Queso, Queso included, by 3 at the end of his own turn, capped (QUE-2, QUE-3)', () => {
    const b = setup()
    const r = act(b.state, b.south, { kind: 'endTurn' })
    const toughness = (label: string) => unitIn(r.state, b.id(label))?.toughness
    expect([toughness('Q'), toughness('P'), toughness('S'), toughness('FAR'), toughness('E')]).toEqual([2 + 3, 10 + 3, 7, 1, 1]) // S: 6 + 1 + 3, capped
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitHealed', unitId: b.id('P'), amount: QUESO_BEACON_HEAL, toughness: 13, source: 'queso.beacon' })
  })

  it("does nothing at the end of the opponent's turn (\"not the opponent's turn\")", () => {
    const b = setup()
    const southEnded = act(b.state, b.south, { kind: 'endTurn' }).state
    const northEnded = act(southEnded, b.north, { kind: 'endTurn' }).state
    expect(unitIn(northEnded, b.id('P'))?.toughness).toBe(13)
    const again = act(northEnded, b.south, { kind: 'endTurn' }).state
    expect([unitIn(again, b.id('P'))?.toughness, unitIn(again, b.id('Q'))?.toughness]).toEqual([16, 6])
  })

  it('adds up with the other end-of-turn heals, each capped (X-25)', () => {
    const b = buildBattle({
      south: ['commander@M3:Q', { type: 'paladin', at: 'M5', label: 'P', toughness: 5 }, { type: 'soldier', at: 'N4', label: 'S', toughness: 1 }],
      commanders: { south: 'queso' },
    })
    addArea(b.state, b.south, 'M5') // an own Pajazon over P and S
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(5 + 3 + 3)
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7) // 1 + 1 + 3 + 3, capped
  })
})

describe('queso.revive (7.9, A7-16; cost by tier under owner ruling R18)', () => {
  it('asks its controller when an own unit dies within range 2 on the opponent turn; "yes" revives it at half its base toughness', () => {
    const b = victimSetup({ type: 'soldier' })
    const paused = strike(b).state
    const decision = projectView(paused, b.south).decision
    expect(decision).toMatchObject({
      kind: 'queso.revive',
      prompt: "Your Soldier died near Queso. Revive it with 4 toughness for 1 of Queso's max toughness?",
      options: [
        { id: 'yes', label: 'Revive' },
        { id: 'no', label: 'Let it fall' },
      ],
      defaultOption: 'no',
      timeoutSeconds: REACTION_PROMPT_TIMEOUT_S,
      preferenceKey: 'revive', // the Ask / Always / Never preference answers it (A2-30)
      data: { unitId: b.id('V'), toughness: 4, cost: 1 },
    })
    expect(validate(paused, b.north, { kind: 'endTurn' })).toMatchObject({ ok: false, code: 'DECISION_PENDING' })
    expect(projectView(paused, b.north).opponentDeciding).toBe(true) // the Berserker saw it die

    const r = answer(paused, b.south, 'yes')
    expect(unitIn(r.state, b.id('V'))).toMatchObject({ anchor: parseSquare('M5'), toughness: 4, defending: false })
    expect(unitIn(r.state, b.id('Q'))).toMatchObject({ permanentToughness: -1, toughness: 5 })
    expect(projectView(r.state, b.south).units.find((u) => u.id === b.id('Q'))?.maxToughness).toBe(5)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitRevived', unitId: b.id('V'), anchor: parseSquare('M5'), toughness: 4 })
    expect(validate(r.state, b.north, { kind: 'endTurn' }).ok).toBe(true)
  })

  it('"no" lets it fall at no cost', () => {
    const b = victimSetup({ type: 'soldier' })
    const r = answer(strike(b).state, b.south, 'no')
    expect(unitIn(r.state, b.id('V'))).toBeUndefined()
    expect(unitIn(r.state, b.id('Q'))).toMatchObject({ permanentToughness: 0, toughness: 6 })
  })

  it.each([
    ['emissary', 3, 25],
    ['royalWizard', 2, 12],
    ['paladin', 1, 9], // T4 under R21: a 10/18 Paladin returns at 9
    ['footman', 1, 1],
    ['noAcb', 1, 4], // dummies count as "other" (R18)
  ] as const)('prices a %s at %i max toughness and revives it at %i (R18)', (type, cost, revived) => {
    const b = victimSetup({ type, toughness: 1 })
    const paused = strike(b).state
    expect(projectView(paused, b.south).decision?.data).toMatchObject({ cost, toughness: revived })
    const r = answer(paused, b.south, 'yes')
    expect(unitIn(r.state, b.id('V'))?.toughness).toBe(revived)
    expect(projectView(r.state, b.south).units.find((u) => u.id === b.id('Q'))?.own?.baseToughness).toBe(QUESO_COMMANDER_TOUGHNESS - cost)
  })

  it('is offered only while paying leaves Queso at 1 max toughness or more (QUE-5, R18)', () => {
    const emissary = victimSetup({ type: 'emissary', toughness: 1 })
    setQuesoBase(emissary, 3)
    expect(strike(emissary).state.decisions).toHaveLength(0) // 3 - 3 = 0

    const wizard = victimSetup({ type: 'royalWizard', toughness: 1 })
    setQuesoBase(wizard, 3)
    const r = answer(strike(wizard).state, wizard.south, 'yes') // 3 - 2 = 1
    expect(stored(r.state, wizard.id('Q')).toughness).toBe(1)

    const spent = victimSetup({ type: 'footman' })
    setQuesoBase(spent, 1)
    expect(strike(spent).state.decisions).toHaveLength(0)
  })

  it('stops after the last affordable revive: from max 2, one revive, then none', () => {
    const b = buildBattle({
      south: ['commander@M3:Q', 'footman@M5:V'],
      north: ['berserker@M6:B', 'berserker@L5:B2'],
      commanders: { south: 'queso' },
      active: 'north',
    })
    setQuesoBase(b, 2)
    const revived = answer(strike(b).state, b.south, 'yes').state
    expect(unitIn(revived, b.id('V'))?.toughness).toBe(1)
    const again = act(revived, b.north, { kind: 'attack', unitId: b.id('B2'), target: { kind: 'unit', unitId: b.id('V') } }).state
    expect(again.decisions).toHaveLength(0)
    expect(unitIn(again, b.id('V'))).toBeUndefined()
  })

  it('counts only deaths within range 2, judged where the unit died (QUE-10); a Size-2 Beast by any of its squares', () => {
    const far = buildBattle({ south: ['commander@M3:Q', 'footman@M6:V'], north: ['berserker@M7:B'], commanders: { south: 'queso' }, active: 'north' })
    expect(strike(far).state.decisions).toHaveLength(0)

    const beast = buildBattle({
      south: ['commander@M3:Q', { type: 'beast', at: 'N4', label: 'V', toughness: 1 }],
      north: ['berserker@P4:B'],
      commanders: { south: 'queso' },
      active: 'north',
    })
    const paused = strike(beast).state
    expect(projectView(paused, beast.south).decision?.data).toMatchObject({ cost: 2, toughness: 20 })
    const r = answer(paused, beast.south, 'yes')
    expect(unitIn(r.state, beast.id('V'))?.anchor).toEqual(parseSquare('N4'))
    const q = new StateQuery(r.state)
    for (const s of footprintSquares(parseSquare('N4'), 2)) expect(q.unitAt(s)?.id).toBe(beast.id('V'))
  })

  it('clears statuses but keeps the actions used this turn (QUE-6)', () => {
    const defended = victimSetup({ type: 'soldier', toughness: 1, defending: true })
    const r = answer(strike(defended).state, defended.south, 'yes')
    expect(unitIn(r.state, defended.id('V'))?.defending).toBe(false)

    const walker = buildBattle({ south: ['commander@M3:Q', 'footman@M4:F'], commanders: { south: 'queso' }, mines: [{ owner: 'north', at: 'M5' }] })
    const died = act(walker.state, walker.south, { kind: 'move', unitId: walker.id('F'), path: sqs('M5') }).state
    const back = answer(died, walker.south, 'yes').state // on his own turn too
    expect(unitIn(back, walker.id('F'))).toMatchObject({ anchor: parseSquare('M5'), toughness: 1 })
    expect(validate(back, walker.south, { kind: 'move', unitId: walker.id('F'), path: sqs('M6') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('counts sacrifices (QUE-8, X-07): the fodder is offered back once the effect has resolved', () => {
    const b = buildBattle({ south: ['commander@L3:Q', 'beast@M5:BEAST', 'ranger@L5:R'], commanders: { south: 'queso' } })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('BEAST'), abilityId: 'beast.feast', targets: [{ kind: 'unit', unitId: b.id('R') }] })
    expect(types(r.events, b.south).slice(-2)).toEqual(['unitDied', 'decisionRequested'])
    expect(r.state.fallen.find((f) => f.unit.id === b.id('R'))?.cause).toBe('sacrifice')
    expect(unitIn(answer(r.state, b.south, 'yes').state, b.id('R'))).toMatchObject({ anchor: parseSquare('L5'), toughness: 1 })
  })

  it('X-26: a death at the end of his own turn pauses the end phase; the revived unit is then healed in the resumed heal step', () => {
    const b = buildBattle({ south: ['commander@M3:Q', { type: 'soldier', at: 'M5', label: 'S', toughness: 3 }], commanders: { south: 'queso' } })
    addArea(b.state, b.north, 'M6') // an enemy Pajazon over the Soldier
    const paused = act(b.state, b.south, { kind: 'endTurn' }).state
    expect(paused.transition).toEqual({ endingSeat: b.south, next: 'heal' })
    expect(projectView(paused, b.south).decision?.kind).toBe('queso.revive')
    const r = answer(paused, b.south, 'yes')
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7) // 4, then Perseverance +1 and the beacon +3, capped
    expect(r.state.turn?.activeSeat).toBe(b.north)
  })

  it("hides the prompt from an opponent who didn't see the death, and leaks nothing (2.11, C14)", () => {
    const b = buildBattle({ south: ['commander@M3:Q', { type: 'soldier', at: 'M5', label: 'S', toughness: 3 }], commanders: { south: 'queso' } })
    addArea(b.state, b.north, 'M6')
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(projectView(r.state, b.north)).toMatchObject({ decision: null, opponentDeciding: false })
    expect(types(r.events, b.north)).not.toContain('decisionRequested')
    for (const seat of [b.south, b.north]) expect(findLeaks(r.state, seat)).toEqual([])
    const seen = strike(victimSetup({ type: 'soldier' }))
    expect(types(seen.events, 'guest')).toContain('decisionRequested')
  })

  it("answers from the 'revive' preference at once: 'always' revives, 'never' lets it fall, neither pauses", () => {
    const b = victimSetup({ type: 'soldier' })
    const always = act(b.state, b.south, { kind: 'setPreference', key: 'revive', value: 'always' }).state
    const r = strike(b, always)
    expect(r.state.decisions).toHaveLength(0)
    expect(unitIn(r.state, b.id('V'))?.toughness).toBe(4)
    const never = act(b.state, b.south, { kind: 'setPreference', key: 'revive', value: 'never' }).state
    const r2 = strike(b, never)
    expect(r2.state.decisions).toHaveLength(0)
    expect(unitIn(r2.state, b.id('V'))).toBeUndefined()
  })

  it('never revives enemy units (QUE-2)', () => {
    const b = buildBattle({ south: ['commander@M3:Q', 'berserker@M4:B'], north: ['footman@M5:V'], commanders: { south: 'queso' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('V') } })
    expect(r.state.decisions).toHaveLength(0)
  })

  it('falls back to the nearest free square within range 2 when its squares were filled first (A7-16), and revealing a Rogue there triggers no Assault (QUE-12)', () => {
    const b = buildBattle({
      south: ['commander@M3:Q', 'soldier@M5:V'],
      north: ['berserker@M6:B', { type: 'rogue', at: 'L4', label: 'RO', stealthed: true }],
      commanders: { south: 'queso' },
      active: 'north',
    })
    const paused = JSON.parse(JSON.stringify(strike(b).state)) as GameState
    stored(paused, b.id('B')).anchor = parseSquare('M5') // stands in for an effect that fills the square first
    const r = answer(paused, b.south, 'yes')
    expect(unitIn(r.state, b.id('V'))).toMatchObject({ anchor: parseSquare('M4'), toughness: 4 }) // M4, L5, N5 tie: lowest row first
    expect(unitIn(r.state, b.id('RO'))?.stealthed).toBe(false)
    expect(r.events.some((e) => e.type === 'unitDamaged')).toBe(false)
  })

  it('checks the price again when queued revives outrun what Queso can pay (R18)', () => {
    const b = buildBattle({ south: ['commander@M3:Q', 'footman@M4:A', 'footman@L4:C'], commanders: { south: 'queso' } })
    setQuesoBase(b, 2)
    addArea(b.state, b.north, 'L5') // an enemy Pajazon over both Footmen, not over Queso
    const paused = act(b.state, b.south, { kind: 'endTurn' }).state
    expect(paused.decisions).toHaveLength(2)
    const first = answer(paused, b.south, 'yes')
    const second = answer(first.state, b.south, 'yes')
    expect(unitIn(second.state, b.id('A'))).toBeDefined()
    expect(unitIn(second.state, b.id('C'))).toBeUndefined()
    expect(stored(second.state, b.id('Q')).permanentToughness).toBe(1 - QUESO_COMMANDER_TOUGHNESS)
    expect(filterEvents(second.events, b.south)).toContainEqual(expect.objectContaining({ type: 'abilityNote', abilityId: 'queso.revive' }))
  })
})
