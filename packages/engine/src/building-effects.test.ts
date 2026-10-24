// The Keep and the Market as RULES_INTERPRETATION section 6 describes them, amended by owner rulings R12 (extra actions may
// be Moves), R31 (Keep +1 Power, Market +2 AP and the type-1 action) and R32 (3x3 buildings, 16-square rings). The Keep
// is F12:H14 (ring E11:I15), the Market R12:T14 (ring Q11:U15).

import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { validate } from './commands'
import { apForRound, APPROACH_BOOST, AP_MAX, KEEP_POWER_BONUS, MARKET_AP_BONUS } from './constants'
import type { GameEvent } from './events'
import { area3x3, parseSquare, sameSquare } from './geometry'
import { act, buildBattle, sqs, unitIn } from './testing/dsl'
import type { BuildingKind, GameState, Seat } from './types'
import { filterEvents, projectView } from './view'

// Test-local stand-ins for other agents' stubs: Smite as plain fixed ability damage (A8-23) and Pajazon ticks (A8-19).
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

const controller = (state: GameState, kind: BuildingKind): Seat | null => state.buildings.find((b) => b.kind === kind)?.controller ?? null
const endTurn = (state: GameState, seat: Seat) => act(state, seat, { kind: 'endTurn' })

function damageTo(events: readonly GameEvent[], unitId: string): number | undefined {
  const hit = events.find((e) => e.type === 'unitDamaged' && e.unitId === unitId)
  return hit?.type === 'unitDamaged' ? hit.amount : undefined
}

describe('capture, contest and recapture (6.4, A6-06 to A6-08, R32)', () => {
  it('is taken by the only side in the ring, survives a contest, changes hands by the same method, then is held', () => {
    const b = buildBattle({ south: ['footman@E11:SF'], north: ['footman@I16:NF'] })
    const t1 = endTurn(b.state, b.south)
    expect(controller(t1.state, 'keep')).toBe(b.south)
    for (const seat of [b.south, b.north]) expect(filterEvents(t1.events, seat)).toContainEqual({ type: 'buildingCaptured', building: 'keep', seat: b.south, previous: null })

    const t2 = endTurn(act(t1.state, b.north, { kind: 'move', unitId: b.id('NF'), path: sqs('I15') }).state, b.north)
    expect(controller(t2.state, 'keep')).toBe(b.south) // contested: nothing changes
    expect(filterEvents(t2.events, b.south)).toContainEqual({ type: 'buildingContested', building: 'keep' })

    const t3 = endTurn(act(t2.state, b.south, { kind: 'move', unitId: b.id('SF'), path: sqs('D11') }).state, b.south)
    expect(controller(t3.state, 'keep')).toBe(b.north)
    expect(filterEvents(t3.events, b.north)).toContainEqual({ type: 'buildingCaptured', building: 'keep', seat: b.north, previous: b.south })

    const t4 = endTurn(t3.state, b.north)
    expect(filterEvents(t4.events, b.south)).toContainEqual({ type: 'buildingHeld', building: 'keep', seat: b.north })
    for (const seat of [b.south, b.north]) expect(projectView(t4.state, seat).buildings.find((x) => x.kind === 'keep')?.controller).toBe(b.north)
  })

  it('counts a Size-2 unit when any of its squares is in the ring (1.6)', () => {
    expect(controller(endTurn(buildBattle({ south: ['beast@D10'] }).state, 'host').state, 'keep')).toBe('host') // E11 is in the ring
    expect(controller(endTurn(buildBattle({ south: ['beast@C10'] }).state, 'host').state, 'keep')).toBeNull()
  })
})

describe('only the controller benefits (A6-05)', () => {
  it("Keep: the controller's units hit for +1 Power, the opponent's don't", () => {
    const b = buildBattle({ south: ['footman@E5:SF', 'soldier@G5:SS'], north: ['footman@G6:NF', 'soldier@E6:NS'], control: { keep: 'south' } })
    const power = (seat: Seat, label: string) => projectView(b.state, seat).units.find((u) => u.id === b.id(label))?.power
    expect([power(b.south, 'SF'), power(b.north, 'NF')]).toEqual([1 + KEEP_POWER_BONUS, 1])
    const southHit = act(b.state, b.south, { kind: 'attack', unitId: b.id('SF'), target: { kind: 'unit', unitId: b.id('NS') } })
    expect(damageTo(southHit.events, b.id('NS'))).toBe(1 + KEEP_POWER_BONUS)
    const northHit = act(endTurn(southHit.state, b.south).state, b.north, { kind: 'attack', unitId: b.id('NF'), target: { kind: 'unit', unitId: b.id('SS') } })
    expect(damageTo(northHit.events, b.id('SS'))).toBe(1)
  })

  it("Market: the AP and the type-1 action are the controller's alone", () => {
    const b = buildBattle({ south: ['footman@E5:SF'], north: ['footman@E20:NF'], control: { market: 'south' } })
    const north = endTurn(b.state, b.south).state
    expect(north.seats[b.north].ap).toBe(apForRound(1) * APPROACH_BOOST)
    const defended = act(north, b.north, { kind: 'defend', unitId: b.id('NF') }).state
    expect(validate(defended, b.north, { kind: 'move', unitId: b.id('NF'), path: sqs('E19') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
    const south = endTurn(north, b.north).state
    expect(south.seats[b.south].ap).toBe(apForRound(2) * APPROACH_BOOST + MARKET_AP_BONUS)
    const southDefended = act(south, b.south, { kind: 'defend', unitId: b.id('SF') }).state
    expect(validate(southDefended, b.south, { kind: 'move', unitId: b.id('SF'), path: sqs('E6') }).ok).toBe(true)
  })
})

describe('the Keep bonus applies to attacks only (A3-02, A6-10 with +1 under R31)', () => {
  it('raises basic attacks and Charge attacks (R26: a basic attack from the end square)', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: ['royalWizard@E7:W'], control: { keep: 'south' } })
    const r = act(b.state, b.south, { kind: 'charge', unitId: b.id('P'), path: sqs('E6'), target: { kind: 'unit', unitId: b.id('W') } })
    expect(damageTo(r.events, b.id('W'))).toBe(10 + KEEP_POWER_BONUS)
  })

  it('reaches the commander and dummies: a dummy can attack with the Keep and not without it (A2-19)', () => {
    const spec = { south: ['commander@M3:C', 'noAcb@E5:D'], north: ['soldier@E6:S'] } as const
    const keep = buildBattle({ ...spec, control: { keep: 'south' } })
    const power = (label: string) => projectView(keep.state, keep.south).units.find((u) => u.id === keep.id(label))?.power
    expect([power('C'), power('D')]).toEqual([1 + KEEP_POWER_BONUS, KEEP_POWER_BONUS])
    const r = act(keep.state, keep.south, { kind: 'attack', unitId: keep.id('D'), target: { kind: 'unit', unitId: keep.id('S') } })
    expect(damageTo(r.events, keep.id('S'))).toBe(KEEP_POWER_BONUS)
    const plain = buildBattle(spec)
    expect(validate(plain.state, plain.south, { kind: 'attack', unitId: plain.id('D'), target: { kind: 'unit', unitId: plain.id('S') } })).toMatchObject({ ok: false, code: 'NO_POWER' })
  })

  it('never touches fixed damage: ability damage, mines and ticks', () => {
    const smite = buildBattle({ south: ['emissary@E5:E'], north: ['soldier@E8:S'], control: { keep: 'south' } })
    const smitten = act(smite.state, smite.south, { kind: 'useAbility', unitId: smite.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: smite.id('S') }] })
    expect(damageTo(smitten.events, smite.id('S'))).toBe(8)

    const mine = buildBattle({ north: ['soldier@E8:S'], mines: [{ owner: 'south', at: 'E7' }], control: { keep: 'south' }, active: 'north' })
    expect(damageTo(act(mine.state, mine.north, { kind: 'move', unitId: mine.id('S'), path: sqs('E7') }).events, mine.id('S'))).toBe(5)

    const tick = buildBattle({ north: ['soldier@E10:S'], control: { keep: 'south' }, active: 'north' })
    tick.state.areas.push({ id: 'a-keep', abilityId: 'royalWizard.pajazon', owner: tick.south, sourceId: null, squares: area3x3(parseSquare('E10')), createdOnOwnTurn: 1, expiresAtOwnTurn: 3, seq: 90, data: {} })
    expect(damageTo(endTurn(tick.state, tick.north).events, tick.id('S'))).toBe(3)
  })

  it('leaves AP costs alone (A2-32)', () => {
    const b = buildBattle({ south: ['footman@E5:F'], north: ['soldier@E6:S'], control: { keep: 'south' } })
    expect(act(b.state, b.south, { kind: 'attack', unitId: b.id('F'), target: { kind: 'unit', unitId: b.id('S') } }).state.seats[b.south].ap).toBe(20 - 1)
  })
})

describe('the Market (A6-11; R12, R31)', () => {
  it('gives its extra action to type-1 units only: Footman and Mercenary, not a Soldier, the commander or a dummy', () => {
    const b = buildBattle({ south: ['footman@E5:F', 'mercenary@G5:M', 'soldier@I5:S', 'commander@K3:C', 'noAcb@M5:D'], control: { market: 'south' } })
    const secondAction = (label: string) => validate(act(b.state, b.south, { kind: 'defend', unitId: b.id(label) }).state, b.south, { kind: 'defend', unitId: b.id(label) }).ok
    expect(['F', 'M', 'S', 'C', 'D'].map(secondAction)).toEqual([true, true, false, false, false])
  })

  it('gives exactly one extra action, which may be a second Move (R12 supersedes A6-11\'s one-Move rule); a third is refused', () => {
    const b = buildBattle({ south: ['footman@E5:F'], control: { market: 'south' } })
    let state = act(b.state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('E6') }).state
    state = act(state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('E7') }).state
    expect(unitIn(state, b.id('F'))).toMatchObject({ anchor: parseSquare('E7'), turn: expect.objectContaining({ moves: 2, actionsUsed: 2 }) })
    expect(state.seats[b.south].ap).toBe(20 - 2) // each action pays (A2-09)
    expect(validate(state, b.south, { kind: 'defend', unitId: b.id('F') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('adds its +2 AP after the cap (R31): 22 AP in a capped round', () => {
    const b = buildBattle({ south: ['footman@E5'], north: ['footman@E20'], control: { market: 'north' } })
    b.state.turn = { number: 21, activeSeat: b.south } // round 11, contact long made
    b.state.firstContactRound = 1
    expect(apForRound(11)).toBe(AP_MAX)
    expect(endTurn(b.state, b.south).state.seats[b.north].ap).toBe(AP_MAX + MARKET_AP_BONUS)
  })

  it('changes hands only at the end of a turn, so walking into the ring gives nothing until then (6.6)', () => {
    const b = buildBattle({ south: ['footman@P11:F'] })
    const inRing = act(b.state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('Q11') }).state
    expect(controller(inRing, 'market')).toBeNull()
    expect(validate(inRing, b.south, { kind: 'defend', unitId: b.id('F') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
    const next = endTurn(endTurn(inRing, b.south).state, b.north).state
    expect(controller(next, 'market')).toBe(b.south)
    expect(next.seats[b.south].ap).toBe(apForRound(2) * APPROACH_BOOST + MARKET_AP_BONUS)
    const defended = act(next, b.south, { kind: 'defend', unitId: b.id('F') }).state
    expect(validate(defended, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('Q12') }).ok).toBe(true)
  })
})
