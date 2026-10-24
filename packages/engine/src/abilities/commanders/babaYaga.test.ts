import { describe, expect, it } from 'vitest'
import {
  BABA_CAULDRON_COST,
  BABA_COMMANDER_TOUGHNESS,
  BABA_HEX_REDUCTION,
  BABA_MEND_COST,
  BABA_MEND_HEAL,
  BABA_MEND_MAX_PER_UNIT,
  BABA_MEND_USES_PER_TURN,
  REACTION_PROMPT_TIMEOUT_S,
} from '../../constants'
import { validate, validateIntent, type Intent } from '../../commands'
import { abilitiesFor } from '../../content/derived'
import type { GameEvent } from '../../events'
import { area3x3, parseSquare, sameSquare } from '../../geometry'
import { legalActions } from '../../preview'
import { act, buildBattle, sqs, unitIn, type Battle, type BattleSpec } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import type { GameState, Seat } from '../../types'
import { filterEvents, projectView } from '../../view'
import { registerAbility } from '../registry'

// Test-local stand-ins for other agents' stubs: an enemy Pajazon tick (A8-19), Smite (A8-23), a bare sacrifice (Feast
// without its own heal, A8-21) and Line Formation (A8-01).
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) =>
        ending === area.owner
          ? null
          : { damage: q.units().filter((u) => u.owner === ending && q.footprint(u).some((s) => area.squares.some((a) => sameSquare(a, s)))).map((u) => ({ target: u.id, amount: 3 })) },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'emissary.smite',
    status: 'implemented',
    active: {
      targets: [{ kind: 'unit', label: 'Target', range: 3, relation: 'harmful', includeSelf: false, allowCommander: true }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        const target = t?.kind === 'unit' ? ctx.unit(t.unitId) : undefined
        if (target !== undefined) ctx.dealDamage({ target, kind: 'ability', base: 8, source: 'emissary.smite', dealer: unit })
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
    id: 'footman.lineFormation',
    status: 'implemented',
    targetReduction: (q, holder, hit) =>
      hit.target.id === holder.id && q.adjacentUnits(holder).filter((u) => u.owner === holder.owner && u.type === 'footman').length >= 2 ? 2 : 0,
  },
  { replace: true },
)

const MEND = 'babaYaga.mend'

function battle(variant: 'mend' | 'hex-ward' | 'cauldron', spec: BattleSpec): Battle {
  return buildBattle({ ...spec, commanders: { south: 'babaYaga', ...spec.commanders }, variants: { south: variant } })
}

function addArea(state: GameState, owner: Seat, centre: string): void {
  state.areas.push({ id: `a-b${state.areas.length}`, abilityId: 'royalWizard.pajazon', owner, sourceId: null, squares: area3x3(parseSquare(centre)), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 90 + state.areas.length, data: {} })
}

function damageTo(events: readonly GameEvent[], unitId: string): number | undefined {
  const hit = events.find((e) => e.type === 'unitDamaged' && e.unitId === unitId)
  return hit?.type === 'unitDamaged' ? hit.amount : undefined
}

function answer(state: GameState, seat: Seat, choice: string) {
  const decision = projectView(state, seat).decision
  if (decision === null) throw new Error('no decision to answer')
  return act(state, seat, { kind: 'respondDecision', decisionId: decision.id, choice })
}

const endTurns = (state: GameState, ...seats: Seat[]): GameState => seats.reduce((s, seat) => act(s, seat, { kind: 'endTurn' }).state, state)

describe('babaYaga.mend: "Mend the swarm" (owner rulings R11 variant A, R44, R45)', () => {
  const setup = (spec: BattleSpec = {}) =>
    battle('mend', {
      south: [
        'commander@M3:Y',
        { type: 'juliomancer', at: 'E5', label: 'J1', toughness: 1 },
        { type: 'juliomancer', at: 'G5', label: 'J2', toughness: 1 },
        { type: 'rogue', at: 'I5', label: 'R1', toughness: 1 },
        { type: 'rogue', at: 'K5', label: 'R2', toughness: 1 },
        { type: 'soldier', at: 'O5', label: 'S', toughness: 1 },
        { type: 'footman', at: 'S5', label: 'F', toughness: 1 },
        'artificer@Q5:FULL',
      ],
      ...spec,
    })
  const use = (b: Battle, label: string): Intent => ({ kind: 'useAbility', unitId: b.id(label), abilityId: MEND, targets: [] })

  it(`restores ${BABA_MEND_HEAL} toughness for ${BABA_MEND_COST} AP (capped at max), without using its action or cancelling Defend`, () => {
    const b = setup()
    const defended = act(b.state, b.south, { kind: 'defend', unitId: b.id('J1') }).state
    const r = act(defended, b.south, use(b, 'J1'))
    expect(unitIn(r.state, b.id('J1'))).toMatchObject({ toughness: 1 + BABA_MEND_HEAL, defending: true, turn: expect.objectContaining({ actionsUsed: 1 }) })
    expect(r.state.seats[b.south].ap).toBe(20 - 2 - BABA_MEND_COST)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitHealed', unitId: b.id('J1'), amount: BABA_MEND_HEAL, toughness: 1 + BABA_MEND_HEAL, source: MEND })
    expect(unitIn(act(b.state, b.south, use(b, 'R1')).state, b.id('R1'))?.toughness).toBe(4) // a Rogue's full heal (max 4)
    const mended = act(b.state, b.south, use(b, 'J2')).state
    expect(validate(mended, b.south, { kind: 'move', unitId: b.id('J2'), path: sqs('G6') }).ok).toBe(true) // not an action
  })

  it(`is used at most ${BABA_MEND_MAX_PER_UNIT} times on the same unit per turn: a Juliomancer at 1/15 reaches 5, then 9, then no more`, () => {
    const b = setup()
    let state = act(b.state, b.south, use(b, 'J1')).state
    expect(unitIn(state, b.id('J1'))?.toughness).toBe(5)
    state = act(state, b.south, use(b, 'J1')).state
    expect(unitIn(state, b.id('J1'))?.toughness).toBe(9)
    const refused = validate(state, b.south, use(b, 'J1'))
    expect(refused).toMatchObject({ ok: false, code: 'LIMIT_REACHED' })
    expect(validateIntent(projectView(state, b.south), use(b, 'J1'))).toEqual(refused) // the client judges it the same way
    const later = endTurns(state, b.south, b.north)
    expect(unitIn(act(later, b.south, use(b, 'J1')).state, b.id('J1'))?.toughness).toBe(13) // no cooldown; a new turn
  })

  it(`allows ${BABA_MEND_USES_PER_TURN} uses per turn across the army; the count resets at the start of the owner's turn`, () => {
    const b = setup()
    let state = b.state
    for (const label of ['J1', 'J2', 'R1']) state = act(state, b.south, use(b, label)).state
    expect(projectView(state, b.south).myCounters[MEND]).toBe(3)
    const refused = validate(state, b.south, use(b, 'R2'))
    expect(refused).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET', message: 'Regenerate was already used 3 times this turn' })
    expect(validateIntent(projectView(state, b.south), use(b, 'R2'))).toEqual(refused)
    const later = endTurns(state, b.south, b.north)
    expect(projectView(later, b.south).myCounters[MEND]).toBeUndefined()
    expect(unitIn(act(later, b.south, use(b, 'R2')).state, b.id('R2'))?.toughness).toBe(4)
  })

  it("belongs to own Lojrar Clan units of every tier (R44), never to Empire units, and only under the 'mend' variant", () => {
    const b = setup()
    expect(validate(b.state, b.south, use(b, 'S'))).toMatchObject({ ok: false, code: 'UNKNOWN_ABILITY' }) // an Empire Soldier
    expect(validate(b.state, b.south, use(b, 'F'))).toMatchObject({ ok: false, code: 'UNKNOWN_ABILITY' }) // tier 1, but Empire
    for (const type of ['mercenary', 'ranger', 'rogue', 'juliomancer', 'artificer', 'beast', 'scourge'] as const) {
      expect(abilitiesFor(type, 'babaYaga', 'mend')).toContain(MEND)
    }
    const hex = battle('hex-ward', { south: [{ type: 'juliomancer', at: 'E9', label: 'J1', toughness: 1 }] })
    expect(validate(hex.state, hex.south, use(hex, 'J1'))).toMatchObject({ ok: false, code: 'UNKNOWN_ABILITY' })
  })

  it("is refused at full toughness, on the opponent's turn and without the AP", () => {
    const b = setup()
    expect(validate(b.state, b.south, use(b, 'FULL'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET', message: 'This unit is already at full toughness' })
    expect(validate(endTurns(b.state, b.south), b.south, use(b, 'J1'))).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' })
    const broke = setup({ ap: 0 })
    expect(validate(broke.state, broke.south, use(broke, 'J1'))).toMatchObject({ ok: false, code: 'NOT_ENOUGH_AP' })
  })

  it("is on the unit's action bar with its cost, disabled with a reason when it would do nothing", () => {
    const b = setup()
    const view = projectView(b.state, b.south)
    expect(legalActions(view, b.id('J1'))).toContainEqual({ kind: 'ability', abilityId: MEND, cost: BABA_MEND_COST, enabled: true, reason: null })
    expect(legalActions(view, b.id('FULL'))).toContainEqual({ kind: 'ability', abilityId: MEND, cost: BABA_MEND_COST, enabled: false, reason: 'This unit is already at full toughness' })
  })
})

describe('babaYaga.hexWard: "Hex Ward" (owner rulings R11 variant B, R44, R45)', () => {
  it('gives own Lojrar Clan units within range 3 of Baba Yaga +1 max and current toughness, and nobody else', () => {
    const b = battle('hex-ward', {
      south: ['commander@M3:Y', 'juliomancer@M6:IN', 'juliomancer@M7:OUT', 'rogue@O3:R', 'footman@K3:F', 'soldier@N4:S'],
      north: ['mercenary@L5:E'],
    })
    const stats = (label: string, seat = b.south) => {
      const unit = projectView(b.state, seat).units.find((u) => u.id === b.id(label))
      return [unit?.toughness, unit?.maxToughness]
    }
    expect(stats('IN')).toEqual([16, 16])
    expect(stats('OUT')).toEqual([15, 15]) // distance 4
    expect(stats('R')).toEqual([5, 5]) // a Rogue at range 2 (R44: any tier)
    expect(stats('F')).toEqual([2, 2]) // an Empire Footman: not white
    expect(stats('S')).toEqual([7, 7])
    expect(stats('Y')).toEqual([BABA_COMMANDER_TOUGHNESS, BABA_COMMANDER_TOUGHNESS]) // R45
    expect(stats('E', b.north)).toEqual([1, 1]) // an enemy Mercenary in range
  })

  it.each([
    ['soldier', 2 - BABA_HEX_REDUCTION],
    ['ranger', 3 - BABA_HEX_REDUCTION],
    ['footman', 1], // floor 1 (A3-05)
  ] as const)('takes 1 less from an attack by a %s, never below 1', (type, dealt) => {
    const b = battle('hex-ward', { south: ['commander@M3:Y', 'juliomancer@M5:IN'], north: [`${type}@M6:A`], active: 'north' })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('A'), target: { kind: 'unit', unitId: b.id('IN') } })
    expect(damageTo(r.events, b.id('IN'))).toBe(dealt)
  })

  it('takes 1 less from mines, ticks and ability damage too ("every source")', () => {
    const mine = battle('hex-ward', { south: ['commander@M3:Y', 'juliomancer@M4:IN'], mines: [{ owner: 'north', at: 'M5' }] })
    expect(damageTo(act(mine.state, mine.south, { kind: 'move', unitId: mine.id('IN'), path: sqs('M5') }).events, mine.id('IN'))).toBe(5 - 1)

    const tick = battle('hex-ward', { south: ['commander@M3:Y', 'juliomancer@M5:IN'] })
    addArea(tick.state, tick.north, 'M6')
    const ticked = act(tick.state, tick.south, { kind: 'endTurn' })
    expect(damageTo(ticked.events, tick.id('IN'))).toBe(3 - 1)
    expect(unitIn(ticked.state, tick.id('IN'))?.toughness).toBe(16 - 2)

    const smite = battle('hex-ward', { south: ['commander@M3:Y', 'juliomancer@M5:IN'], north: ['emissary@M8:E'], active: 'north' })
    const smitten = act(smite.state, smite.north, { kind: 'useAbility', unitId: smite.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: smite.id('IN') }] })
    expect(damageTo(smitten.events, smite.id('IN'))).toBe(8 - 1)
  })

  it('adds to other reductions (an own Forcefield) and comes before Defend halves (3.3)', () => {
    const shielded = battle('hex-ward', { south: ['commander@M3:Y', 'juliomancer@M5:IN'], north: ['scourge@M6:A'], active: 'north' })
    shielded.state.areas.push({ id: 'a-ff', abilityId: 'royalWizard.forcefield', owner: shielded.south, sourceId: null, squares: sqs('M5', 'L5', 'K5', 'J5'), createdOnOwnTurn: 1, expiresAtOwnTurn: 2, seq: 99, data: {} })
    const r = act(shielded.state, shielded.north, { kind: 'attack', unitId: shielded.id('A'), target: { kind: 'unit', unitId: shielded.id('IN') } })
    expect(damageTo(r.events, shielded.id('IN'))).toBe(15 - 8 - 1) // Forcefield and Hex Ward

    const defended = battle('hex-ward', { south: ['commander@M3:Y', { type: 'juliomancer', at: 'M5', label: 'IN', defending: true }], north: ['ranger@M7:R'], active: 'north' })
    const r2 = act(defended.state, defended.north, { kind: 'attack', unitId: defended.id('R'), target: { kind: 'unit', unitId: defended.id('IN') } })
    expect(damageTo(r2.events, defended.id('IN'))).toBe(1) // ceil((3 - 1) / 2)
  })

  it('follows Baba Yaga: leaving her range lowers max and current but never kills (A3-11); coming back raises both', () => {
    const b = battle('hex-ward', { south: ['commander@M3:Y', { type: 'juliomancer', at: 'M6', label: 'HURT', toughness: 1 }, 'juliomancer@K4:FULL'] })
    const away = act(b.state, b.south, { kind: 'move', unitId: b.id('Y'), path: sqs('M2') }).state // both now at distance 4
    expect([unitIn(away, b.id('HURT'))?.toughness, unitIn(away, b.id('FULL'))?.toughness]).toEqual([1, 15])
    const back = act(endTurns(away, b.south, b.north), b.south, { kind: 'move', unitId: b.id('Y'), path: sqs('M3') }).state
    expect(unitIn(back, b.id('HURT'))).toMatchObject({ toughness: 2, auraToughness: 1 })
    expect(unitIn(back, b.id('FULL'))?.toughness).toBe(16)
  })

  it('ends with Baba Yaga: the final board after her fall shows consistent toughness (A2-26, A3-11)', () => {
    const b = battle('hex-ward', { south: ['commander@M3:Y', 'juliomancer@M5:IN'], north: ['berserker@M4:B'], active: 'north' })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('Y') } })
    expect(r.state.result).toMatchObject({ winner: b.north, reason: 'conquest' })
    expect(projectView(r.state, b.south).units.find((u) => u.id === b.id('IN'))).toMatchObject({ toughness: 15, maxToughness: 15 })
  })

  it('is public: the opponent sees the raised max toughness of a visible unit', () => {
    const b = battle('hex-ward', { south: ['commander@M3:Y', 'juliomancer@M6:IN'], north: ['ranger@M9:R'] })
    expect(projectView(b.state, b.north).units.find((u) => u.id === b.id('IN'))?.maxToughness).toBe(16)
  })

  it("belongs to the 'hex-ward' variant only", () => {
    const b = battle('mend', { south: ['commander@M3:Y', 'juliomancer@M5:IN'] })
    expect(unitIn(b.state, b.id('IN'))?.toughness).toBe(15)
  })
})

describe('babaYaga.cauldron: "Cauldron" (owner rulings R11 variant C, R44, R45)', () => {
  /** Baba Yaga on M3 (free neighbours M2, L3, N3, M4), a Mercenary V on M5 and North's Berserker on M6, North to act. */
  const setup = (spec: BattleSpec = {}) =>
    battle('cauldron', { south: ['commander@M3:Y', 'mercenary@M5:V'], north: ['berserker@M6:B'], active: 'north', ...spec })
  const strike = (b: Battle, state: GameState = b.state, attacker = 'B', target = 'V') =>
    act(state, b.north, { kind: 'attack', unitId: b.id(attacker), target: { kind: 'unit', unitId: b.id(target) } })

  it("offers to bring a dead white unit back next to Baba Yaga at full toughness; on the opponent's turn the AP is owed", () => {
    const b = setup({ south: ['commander@M3:Y', { type: 'mercenary', at: 'M5', label: 'V', defending: true }] })
    const paused = strike(b).state
    expect(projectView(paused, b.south).decision).toMatchObject({
      kind: 'babaYaga.cauldron',
      prompt: `Your Mercenary died. Return it next to Baba Yaga at full toughness for ${BABA_CAULDRON_COST(1)} AP, taken from your next turn?`,
      options: [
        { id: 'return-0', label: 'Return to M2' }, // nearest her own back row first
        { id: 'return-1', label: 'Return to L3' },
        { id: 'return-2', label: 'Return to N3' },
        { id: 'return-3', label: 'Return to M4' },
        { id: 'no', label: 'Let it fall' },
      ],
      defaultOption: 'no',
      timeoutSeconds: REACTION_PROMPT_TIMEOUT_S,
    })
    const r = answer(paused, b.south, 'return-3')
    const back = unitIn(r.state, b.id('V'))
    expect(back).toMatchObject({ anchor: parseSquare('M4'), toughness: 1, defending: false, stealthed: false })
    expect(back?.turn.actionsUsed).toBeGreaterThanOrEqual(1)
    expect([projectView(r.state, b.south).myApDebt, projectView(r.state, b.north).opponentApDebt]).toEqual([1, 1]) // R15

    const declined = answer(paused, b.south, 'no').state
    const withDebt = endTurns(r.state, b.north).seats[b.south]
    expect(withDebt.ap).toBe(endTurns(declined, b.north).seats[b.south].ap - BABA_CAULDRON_COST(1))
    expect(withDebt.apDebt).toBe(0)
  })

  it('pays at once on its owner\'s turn, and the returned unit has no action left', () => {
    const b = battle('cauldron', { south: ['commander@M3:Y', 'mercenary@M5:V'], mines: [{ owner: 'north', at: 'M6' }] })
    const died = act(b.state, b.south, { kind: 'move', unitId: b.id('V'), path: sqs('M6') }).state
    expect(projectView(died, b.south).decision?.prompt).toBe(`Your Mercenary died. Return it next to Baba Yaga at full toughness for ${BABA_CAULDRON_COST(1)} AP?`)
    const r = answer(died, b.south, 'return-0')
    expect(unitIn(r.state, b.id('V'))?.anchor).toEqual(parseSquare('M2'))
    expect(r.state.seats[b.south]).toMatchObject({ ap: 20 - 1 - BABA_CAULDRON_COST(1), apDebt: 0 })
    expect(validate(r.state, b.south, { kind: 'move', unitId: b.id('V'), path: sqs('M1') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('"no" lets it fall at no cost and uses up nothing; a return shows in the turn\'s counter', () => {
    const b = setup()
    const paused = strike(b).state
    expect(projectView(paused, b.south).myTurnCounters).toEqual({ 'babaYaga.cauldron.pending': 1, 'babaYaga.cauldron.pendingAp': BABA_CAULDRON_COST(1) })
    const r = answer(paused, b.south, 'no')
    expect(unitIn(r.state, b.id('V'))).toBeUndefined()
    expect(r.state.seats[b.south]).toMatchObject({ apDebt: 0, turnCounters: { 'babaYaga.cauldron.pending': 0, 'babaYaga.cauldron.pendingAp': 0 } })
    expect(projectView(answer(paused, b.south, 'return-0').state, b.south).myTurnCounters).toEqual({ 'babaYaga.cauldron': 1, 'babaYaga.cauldron.pending': 0, 'babaYaga.cauldron.pendingAp': 0 })
  })

  it("answers from the 'revive' preference at once: 'always' takes the first square, 'never' lets it fall", () => {
    const b = setup()
    const always = strike(b, act(b.state, b.south, { kind: 'setPreference', key: 'revive', value: 'always' }).state).state
    expect(always.decisions).toHaveLength(0)
    expect(unitIn(always, b.id('V'))?.anchor).toEqual(parseSquare('M2'))
    const never = strike(b, act(b.state, b.south, { kind: 'setPreference', key: 'revive', value: 'never' }).state).state
    expect(never.decisions).toHaveLength(0)
    expect(unitIn(never, b.id('V'))).toBeUndefined()
  })

  it('returns at most 2 units per turn, and each turn (either player\'s) counts afresh', () => {
    const b = battle('cauldron', {
      south: ['commander@M3:Y', 'mercenary@E5:V1', 'mercenary@G5:V2', 'mercenary@I5:V3'],
      north: ['berserker@E6:B1', 'berserker@G6:B2', 'berserker@I6:B3'],
      mines: [{ owner: 'north', at: 'K3' }],
      active: 'north',
    })
    let state = answer(strike(b, b.state, 'B1', 'V1').state, b.south, 'return-0').state
    state = answer(strike(b, state, 'B2', 'V2').state, b.south, 'return-0').state
    expect([unitIn(state, b.id('V1'))?.anchor, unitIn(state, b.id('V2'))?.anchor]).toEqual([parseSquare('M2'), parseSquare('L3')])
    state = strike(b, state, 'B3', 'V3').state
    expect(state.decisions).toHaveLength(0) // a third death this turn
    state = endTurns(state, b.north)
    const died = act(state, b.south, { kind: 'move', unitId: b.id('V2'), path: sqs('K3') }).state // onto a mine, on the next turn
    expect(projectView(died, b.south).decision?.kind).toBe('babaYaga.cauldron')
  })

  it('returns a given unit at most twice per game', () => {
    const b = battle('cauldron', { south: ['commander@M3:Y', 'mercenary@M4:V'], north: ['berserker@M5:B1', 'berserker@L4:B2'], active: 'north' })
    let state = answer(strike(b, b.state, 'B1').state, b.south, 'return-3').state
    state = answer(strike(b, state, 'B2').state, b.south, 'return-3').state
    expect(unitIn(state, b.id('V'))?.anchor).toEqual(parseSquare('M4'))
    state = strike(b, endTurns(state, b.north, b.south), 'B1').state
    expect(state.decisions).toHaveLength(0)
    expect(unitIn(state, b.id('V'))).toBeUndefined()
  })

  it('needs a free square next to Baba Yaga: her own mines and any unit take one, and with none there is no return', () => {
    const mined = setup({ mines: [{ owner: 'south', at: 'M2' }] })
    expect(projectView(strike(mined).state, mined.south).decision?.options.map((o) => o.label)).toEqual(['Return to L3', 'Return to N3', 'Return to M4', 'Let it fall'])
    const boxed = setup({ south: ['commander@M3:Y', 'ranger@M2', 'ranger@L3', 'ranger@N3', 'ranger@M4', 'mercenary@E5:V'], north: ['berserker@E6:B'] })
    const r = strike(boxed)
    expect(unitIn(r.state, boxed.id('V'))).toBeUndefined()
    expect(r.state.decisions).toHaveLength(0)
  })

  it('works for own Lojrar Clan units of every tier (R44), never Empire units or enemies', () => {
    const ranger = setup({ south: ['commander@M3:Y', 'ranger@M5:V'] })
    expect(projectView(strike(ranger).state, ranger.south).decision?.kind).toBe('babaYaga.cauldron') // type 2, Lojrar
    const footman = setup({ south: ['commander@M3:Y', 'footman@M5:V'] })
    expect(strike(footman).state.decisions).toHaveLength(0) // type 1, but Empire
    const enemy = battle('cauldron', { south: ['commander@M3:Y', 'berserker@E5:B'], north: ['mercenary@E6:V'] })
    expect(act(enemy.state, enemy.south, { kind: 'attack', unitId: enemy.id('B'), target: { kind: 'unit', unitId: enemy.id('V') } }).state.decisions).toHaveLength(0)
  })

  it.each([
    [1, 1],
    [2, 1],
    [5, 1],
    [10, 2],
    [20, 4],
    [50, 10],
    [100, 20],
  ] as const)('costs ceil(tier / 5) AP, minimum 1 (R45): type %i costs %i', (tier, cost) => {
    expect(BABA_CAULDRON_COST(tier)).toBe(cost)
  })

  it('charges by tier: a Juliomancer eaten by Feast comes back for 2 AP, and is not offered without them (R45)', () => {
    const b = battle('cauldron', { south: ['commander@M3:Y', 'beast@O5:BEAST', 'juliomancer@N5:J'] })
    const feast: Intent = { kind: 'useAbility', unitId: b.id('BEAST'), abilityId: 'beast.feast', targets: [{ kind: 'unit', unitId: b.id('J') }] }
    const eaten = act(b.state, b.south, feast).state
    expect(projectView(eaten, b.south).decision?.prompt).toBe(`Your Juliomancer died. Return it next to Baba Yaga at full toughness for ${BABA_CAULDRON_COST(10)} AP?`)
    const r = answer(eaten, b.south, 'return-0')
    expect(unitIn(r.state, b.id('J'))).toMatchObject({ anchor: parseSquare('M2'), toughness: 15 })
    expect(r.state.seats[b.south].ap).toBe(20 - 2 - 2)
    const poor = battle('cauldron', { south: ['commander@M3:Y', 'beast@O5:BEAST', 'juliomancer@N5:J'], ap: 3 })
    expect(act(poor.state, poor.south, { ...feast, unitId: poor.id('BEAST'), targets: [{ kind: 'unit', unitId: poor.id('J') }] }).state.decisions).toHaveLength(0)
  })

  it('returns a Size-2 Beast only to a free 2x2 next to Baba Yaga, never one overlapping her', () => {
    const b = setup({ south: ['commander@M3:Y', 'ranger@M2', { type: 'beast', at: 'E5', label: 'V', toughness: 1 }], north: ['berserker@E7:B'] })
    const decision = projectView(strike(b).state, b.south).decision
    expect(decision?.prompt).toBe(`Your Beast of Knorund died. Return it next to Baba Yaga at full toughness for ${BABA_CAULDRON_COST(50)} AP, taken from your next turn?`)
    expect(decision?.options.map((o) => o.label)).toEqual(['Return to K2', 'Return to N2', 'Return to K3', 'Return to N3', 'Return to L4', 'Return to M4', 'Let it fall'])
    const r = answer(strike(b).state, b.south, 'return-1')
    expect(unitIn(r.state, b.id('V'))).toMatchObject({ anchor: parseSquare('N2'), toughness: 40 })
    expect(r.state.seats[b.south].apDebt).toBe(BABA_CAULDRON_COST(50))

    // Free single squares next to her, but no free 2x2: a Mercenary may come back, a Beast may not.
    const ring = ['commander@M3:Y', 'ranger@L2', 'ranger@N2', 'ranger@L4', 'ranger@N4']
    const beast = setup({ south: [...ring, { type: 'beast', at: 'E5', label: 'V', toughness: 1 }], north: ['berserker@E7:B'] })
    expect(strike(beast).state.decisions).toHaveLength(0)
    expect(projectView(strike(setup({ south: [...ring, 'mercenary@M6:V'], north: ['berserker@M7:B'] })).state, b.south).decision?.options).toHaveLength(5)
  })

  it('checks the 2x2 before paying: when an earlier answer took the only one, the next return costs and counts nothing', () => {
    const b = battle('cauldron', {
      south: ['commander@M3:Y', 'ranger@L2', 'ranger@N2', 'ranger@L4', 'ranger@M5', { type: 'beast', at: 'E7', label: 'V1', toughness: 1 }, { type: 'beast', at: 'C7', label: 'V2', toughness: 1 }],
      north: ['beast@E9:SLAM'],
      active: 'north',
    })
    const slam: Intent = { kind: 'useAbility', unitId: b.id('SLAM'), abilityId: 'beast.forcefulSlam', targets: [{ kind: 'square', square: parseSquare('E8') }] }
    const paused = act(b.state, b.north, slam).state
    expect(paused.decisions).toHaveLength(2) // both Beasts died in one Slam
    const first = answer(paused, b.south, 'return-0')
    expect(unitIn(first.state, b.id('V1'))?.anchor).toEqual(parseSquare('N3')) // the only free 2x2
    expect(first.state.seats[b.south].apDebt).toBe(BABA_CAULDRON_COST(50))
    const second = answer(first.state, b.south, 'return-0')
    expect(unitIn(second.state, b.id('V2'))).toBeUndefined()
    expect(second.state.seats[b.south]).toMatchObject({ apDebt: BABA_CAULDRON_COST(50), turnCounters: { 'babaYaga.cauldron': 1 } })
    expect(filterEvents(second.events, b.south)).toContainEqual(expect.objectContaining({ type: 'abilityNote', note: 'No free square next to Baba Yaga' }))
  })

  it("owes the AP of a costly return on the opponent's turn and carries what the next pool can't cover (R45)", () => {
    const b = setup({ south: ['commander@M3:Y', { type: 'scourge', at: 'M5', label: 'V', toughness: 1 }], north: ['berserker@M6:B'] })
    const r = answer(strike(b).state, b.south, 'return-0')
    expect(projectView(r.state, b.south).myApDebt).toBe(BABA_CAULDRON_COST(100))
    const next = endTurns(r.state, b.north) // South's round-2 turn: 11 AP, plus 2 from the living Scourge's Tribute
    expect(next.seats[b.south]).toMatchObject({ ap: 0, apDebt: 20 - 13 })
    const after = endTurns(next, b.south, b.north) // round 3: 12 + 2, less the 7 still owed
    expect(after.seats[b.south]).toMatchObject({ ap: 14 - 7, apDebt: 0 })
  })

  it('counts sacrifices: a Mercenary eaten by an own Beast is offered back once the effect has resolved', () => {
    const b = battle('cauldron', { south: ['commander@M3:Y', 'beast@O5:BEAST', 'mercenary@N5:V'] })
    const r = act(b.state, b.south, { kind: 'useAbility', unitId: b.id('BEAST'), abilityId: 'beast.feast', targets: [{ kind: 'unit', unitId: b.id('V') }] })
    expect(r.state.fallen.find((f) => f.unit.id === b.id('V'))?.cause).toBe('sacrifice')
    expect(projectView(r.state, b.south).decision?.kind).toBe('babaYaga.cauldron')
  })

  it("leaves the death standing for every other death trigger: an enemy Kulega Paladin next to it still heals", () => {
    const b = setup({ north: [{ type: 'paladin', at: 'M6', label: 'P', toughness: 10 }], commanders: { north: 'kulega' } })
    const paused = strike(b, b.state, 'P').state
    expect(unitIn(paused, b.id('P'))?.toughness).toBe(11)
    expect(unitIn(answer(paused, b.south, 'return-0').state, b.id('V'))).toBeDefined()
  })

  it('returns two units that died together; a square the first one took sends the second to the next free one', () => {
    const b = battle('cauldron', { south: ['commander@M3:Y', 'mercenary@E5:V1', 'mercenary@F5:V2'] })
    addArea(b.state, b.north, 'E5')
    const paused = act(b.state, b.south, { kind: 'endTurn' }).state
    expect(paused.decisions).toHaveLength(2)
    const first = answer(paused, b.south, 'return-0')
    const second = answer(first.state, b.south, 'return-0') // M2 is taken by now
    expect([unitIn(second.state, b.id('V1'))?.anchor, unitIn(second.state, b.id('V2'))?.anchor]).toEqual([parseSquare('M2'), parseSquare('L3')])
    const paid = [...first.events, ...second.events].filter((e) => e.type === 'apChanged' && e.seat === b.south && e.delta === -BABA_CAULDRON_COST(1))
    expect(paid).toHaveLength(2) // the end of its own turn: paid from what is left
    expect(second.state.turn?.activeSeat).toBe(b.north)
  })

  it('tells the opponent nothing about where Baba Yaga stands, and nothing at all about a death it did not see', () => {
    const b = setup()
    const r = answer(strike(b).state, b.south, 'return-3')
    const resolved = filterEvents(r.events, b.north).find((e) => e.type === 'decisionResolved')
    expect(resolved).toMatchObject({ type: 'decisionResolved', choice: 'return-3' }) // an opaque option id
    expect(findLeaks(r.state, b.north)).toEqual([])

    const unseen = battle('cauldron', { south: ['commander@M3:Y', 'mercenary@E5:V'] })
    addArea(unseen.state, unseen.north, 'E5')
    const paused = act(unseen.state, unseen.south, { kind: 'endTurn' })
    expect(projectView(paused.state, unseen.north)).toMatchObject({ decision: null, opponentDeciding: false })
    expect(filterEvents(paused.events, unseen.north).some((e) => e.type === 'decisionRequested')).toBe(false)
    for (const seat of [unseen.south, unseen.north]) expect(findLeaks(paused.state, seat)).toEqual([])
  })

  it("is not offered on its owner's turn without the AP to pay, counting the prompts already waiting", () => {
    const b = battle('cauldron', { south: ['commander@M3:Y', 'mercenary@M5:V'], mines: [{ owner: 'north', at: 'M6' }], ap: 1 })
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('V'), path: sqs('M6') })
    expect(unitIn(r.state, b.id('V'))).toBeUndefined()
    expect(r.state.decisions).toHaveLength(0)

    const two = battle('cauldron', { south: ['commander@M3:Y', 'mercenary@E5:V1', 'mercenary@F5:V2'], ap: 1 })
    addArea(two.state, two.north, 'E5')
    const paused = act(two.state, two.south, { kind: 'endTurn' }).state // both die together; 1 AP pays for one return
    expect(paused.decisions).toHaveLength(1)
  })

  it('sets off an unseen enemy mine on the chosen square, which may bring the next prompt (A4-14)', () => {
    const b = setup({ mines: [{ owner: 'north', at: 'M2' }] })
    const r = answer(strike(b).state, b.south, 'return-0')
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'mineExploded', victimId: b.id('V') }))
    expect(unitIn(r.state, b.id('V'))).toBeUndefined()
    expect(projectView(r.state, b.south).decision?.kind).toBe('babaYaga.cauldron') // the second return of this turn and unit
  })
})
