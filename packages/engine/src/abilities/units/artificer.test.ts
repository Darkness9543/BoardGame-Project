import { describe, expect, it } from 'vitest'
import { getAbility, registerAbility } from '../registry'
import { validate, type Intent } from '../../commands'
import { DUMMY_CAP, MINE_CAP, MINE_DAMAGE } from '../../constants'
import { abilityParam } from '../../content/abilities'
import { NO_ACB_UNIT } from '../../content/units'
import { parseSquare } from '../../geometry'
import { legalActions } from '../../preview'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import type { GameState, Seat } from '../../types'
import { filterEvents, projectView } from '../../view'

const PROTOTYPE = 'artificer.prototypeNoAcb'
const TRIP_MINE = 'artificer.tripMine'
const END: Intent = { kind: 'endTurn' }

// Test-local stand-in for a commander stub: Sabrina's +2 Power for Artificers and dummies (A7-11), for B24.
registerAbility(
  {
    id: 'sabrina.reelfinisher',
    status: 'implemented',
    modifyStats: (_q, holder, target) =>
      target.owner === holder.owner && (target.type === 'artificer' || target.type === 'noAcb') ? { power: abilityParam('sabrina.reelfinisher', 'power') } : null,
  },
  { replace: true },
)

const at = (name: string) => ({ kind: 'square' as const, square: parseSquare(name) })
const use = (unitId: string, abilityId: string, square: string): Intent => ({ kind: 'useAbility', unitId, abilityId, targets: [at(square)] })
const move = (unitId: string, ...path: string[]): Intent => ({ kind: 'move', unitId, path: sqs(...path) })
const attack = (unitId: string, targetId: string): Intent => ({ kind: 'attack', unitId, target: { kind: 'unit', unitId: targetId } })
const dummies = (state: GameState) => state.units.filter((u) => u.type === 'noAcb')
const viewOf = (state: GameState, seat: Seat, id: string) => projectView(state, seat).units.find((u) => u.id === id)

/** Far-away squares for the dummies and mines the cap tests start with. */
const SPARE = ['C5', 'C7', 'C9', 'C11', 'C13', 'C15']

describe("artificer.mindsEye (8.10, A8-10, A4-08)", () => {
  it('reveals stealthed enemies inside its LOV 3 and nothing beyond', () => {
    const b = buildBattle({
      south: ['artificer@J10:A'],
      north: [
        { type: 'rogue', at: 'J13', label: 'IN', stealthed: true },
        { type: 'rogue', at: 'N10', label: 'OUT', stealthed: true },
      ],
    })
    expect(unitIn(b.state, b.id('IN'))?.stealthed).toBe(false)
    expect(unitIn(b.state, b.id('OUT'))?.stealthed).toBe(true)
    expect(projectView(b.state, b.south).units.map((u) => u.id)).toContain(b.id('IN'))
    expect(findLeaks(b.state, b.south)).toEqual([])
  })

  it('is re-checked on every step: a Rogue walking into its LOV is revealed there (X-01)', () => {
    const b = buildBattle({ south: ['artificer@J10:A'], north: [{ type: 'rogue', at: 'J15', label: 'R', stealthed: true }], active: 'north' })
    const r = act(b.state, b.north, move(b.id('R'), 'J14', 'J13'))
    expect(unitIn(r.state, b.id('R'))).toMatchObject({ anchor: parseSquare('J13'), stealthed: false })
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitRevealed', unitId: b.id('R'), cause: 'detection', byId: b.id('A') })
  })

  it('reveals enemy mines in its LOV, which stay revealed and show while in vision (A4-11)', () => {
    const b = buildBattle({ south: ['artificer@J7:A'], mines: [{ owner: 'north', at: 'J11', label: 'near' }, { owner: 'north', at: 'J14', label: 'far' }] })
    expect(projectView(b.state, b.south).mines).toEqual([])
    const r = act(b.state, b.south, move(b.id('A'), 'J8'))
    expect(r.state.mines.map((m) => [m.id, m.revealed])).toEqual([
      [b.mineIds['near'], true],
      [b.mineIds['far'], false],
    ])
    expect(projectView(r.state, b.south).mines).toEqual([{ id: b.mineIds['near'], owner: b.north, square: parseSquare('J11'), revealed: true }])
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'mineRevealed', mineId: b.mineIds['near'], owner: b.north, square: parseSquare('J11') })
    expect(filterEvents(r.events, b.north)).toContainEqual(expect.objectContaining({ type: 'mineRevealed', mineId: b.mineIds['near'] }))
    expect(findLeaks(r.state, b.south)).toEqual([])

    let state = act(act(r.state, b.south, END).state, b.north, END).state
    state = act(state, b.south, move(b.id('A'), 'J7', 'J6')).state
    expect(state.mines[0]?.revealed).toBe(true)
    expect(projectView(state, b.south).mines).toEqual([]) // out of vision again
  })
})

describe('artificer.prototypeNoAcb (8.10, 8.15, A8-13, A8-14)', () => {
  it('creates a 0/7 dummy with LOV 1 and AP 1 on a free adjacent square, for 2 AP and the action', () => {
    const b = buildBattle({ south: ['artificer@J10:A'] })
    const r = act(b.state, b.south, use(b.id('A'), PROTOTYPE, 'J11'))
    const [dummy] = dummies(r.state)
    expect(NO_ACB_UNIT).toMatchObject({ power: 0, toughness: 7, lov: 1, movement: 0, ap: 1, tier: null, abilities: [] })
    expect(dummy).toMatchObject({ owner: b.south, anchor: parseSquare('J11'), toughness: 7, createdBy: b.id('A') })
    expect(viewOf(r.state, b.south, dummy?.id ?? '')).toMatchObject({ maxToughness: 7, lov: 1, attackRange: 1, tier: null, own: expect.objectContaining({ apCost: 1 }) })
    expect(r.state.seats[b.south].ap).toBe(20 - 2)
    expect(unitIn(r.state, b.id('A'))?.turn.actionsUsed).toBe(1)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitCreated', unitId: dummy?.id, unitType: 'noAcb', owner: b.south, anchor: parseSquare('J11'), createdBy: b.id('A') })
    expect(validate(r.state, b.south, use(b.id('A'), PROTOTYPE, 'J9'))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('shows the dummy to the opponent only if it sees the square (4.8)', () => {
    const unseen = buildBattle({ south: ['artificer@J10:A'] })
    const r1 = act(unseen.state, unseen.south, use(unseen.id('A'), PROTOTYPE, 'J11'))
    expect(filterEvents(r1.events, unseen.north).filter((e) => e.type === 'unitCreated' || e.type === 'abilityUsed')).toEqual([])
    const seen = buildBattle({ south: ['artificer@J10:A'], north: ['ranger@J13'] })
    const r2 = act(seen.state, seen.south, use(seen.id('A'), PROTOTYPE, 'J11'))
    expect(filterEvents(r2.events, seen.north).map((e) => e.type)).toEqual(expect.arrayContaining(['abilityUsed', 'unitCreated']))
    expect(findLeaks(r2.state, seen.north)).toEqual([])
  })

  it('may act on the turn it is created and, next to its creator, Move 1 square (ART-5, A8-15)', () => {
    const b = buildBattle({ south: ['artificer@J10:A'] })
    const created = act(b.state, b.south, use(b.id('A'), PROTOTYPE, 'J11')).state
    const id = dummies(created)[0]?.id ?? ''
    expect(validate(created, b.south, { kind: 'defend', unitId: id }).ok).toBe(true)
    const moved = act(created, b.south, move(id, 'J12')).state
    expect(unitIn(moved, id)?.anchor).toEqual(parseSquare('J12'))
    expect(moved.seats[b.south].ap).toBe(20 - 2 - NO_ACB_UNIT.ap)
  })

  it('needs a free adjacent square: open ground, no known unit, no own mine (A8-13)', () => {
    const b = buildBattle({ south: ['artificer@I12:A', 'soldier@I11'], north: ['ranger@J12'], mines: [{ owner: 'south', at: 'I13' }] })
    const check = (square: string) => validate(b.state, b.south, use(b.id('A'), PROTOTYPE, square))
    expect(check('H12')).toMatchObject({ ok: false, code: 'SQUARE_UNAVAILABLE' }) // the Keep (R32)
    expect(check('J12')).toMatchObject({ ok: false, code: 'SQUARE_UNAVAILABLE' }) // an enemy
    expect(check('I11')).toMatchObject({ ok: false, code: 'SQUARE_UNAVAILABLE' }) // an own unit
    expect(check('I13')).toMatchObject({ ok: false, code: 'SQUARE_UNAVAILABLE' }) // an own mine
    expect(check('J13')).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' }) // diagonal: distance 2
    expect(check('I12')).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    expect(legalActions(projectView(b.state, b.south), b.id('A')).find((o) => o.abilityId === PROTOTYPE)).toMatchObject({ enabled: false, reason: 'No valid target' })
  })

  it('may go onto a known enemy mine, which the new dummy sets off ("a unit created on it", A8-16)', () => {
    const b = buildBattle({ south: ['artificer@J10:A'], mines: [{ owner: 'north', at: 'J11' }] })
    expect(projectView(b.state, b.south).mines).toHaveLength(1) // Mind's Eye revealed it
    const r = act(b.state, b.south, use(b.id('A'), PROTOTYPE, 'J11'))
    const [dummy] = dummies(r.state)
    expect(dummy?.toughness).toBe(NO_ACB_UNIT.toughness - MINE_DAMAGE)
    expect(r.state.mines).toEqual([])
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'mineExploded', victimId: dummy?.id, trigger: 'entered' }))
  })

  it('caps dummies at 3 + floor((n - 1) / 2) for n Artificers alive (ART-1)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(DUMMY_CAP)).toEqual([3, 3, 4, 4, 5, 5, 6, 6, 7, 7])
  })

  it.each([[1], [2], [3]])('refuses a dummy beyond the army-wide cap with %i Artificer(s) (ART-1, ART-3)', (n) => {
    const cap = DUMMY_CAP(n)
    const setup = (count: number) =>
      buildBattle({ south: [...['J10', 'L10', 'N10'].slice(0, n).map((s, i) => `artificer@${s}:A${i}`), ...SPARE.slice(0, count).map((s) => `noAcb@${s}`)] })
    const below = setup(cap - 1)
    expect(validate(below.state, below.south, use(below.id('A0'), PROTOTYPE, 'J11')).ok).toBe(true)
    const full = setup(cap)
    const reason = `Max ${cap} dummies active (${cap}/${cap})` // PX BT-06
    expect(validate(full.state, full.south, use(full.id('A0'), PROTOTYPE, 'J11'))).toEqual({ ok: false, code: 'REQUIREMENT_NOT_MET', message: reason })
    expect(legalActions(projectView(full.state, full.south), full.id('A0')).find((o) => o.abilityId === PROTOTYPE)).toMatchObject({ enabled: false, reason })
  })

  it('keeps every dummy when the cap drops, but makes no new one until under it again (ART-2, ART-4)', () => {
    const b = buildBattle({
      south: ['artificer@J10:A', 'artificer@L10', { type: 'artificer', at: 'N10', label: 'DOOMED', toughness: 1 }, ...SPARE.slice(0, 4).map((s) => `noAcb@${s}`)],
      north: ['berserker@N11:B'],
      active: 'north',
    })
    let state = act(b.state, b.north, attack(b.id('B'), b.id('DOOMED'))).state
    state = act(state, b.north, END).state
    expect(dummies(state)).toHaveLength(4)
    expect(validate(state, b.south, use(b.id('A'), PROTOTYPE, 'J11'))).toEqual({ ok: false, code: 'REQUIREMENT_NOT_MET', message: 'Max 3 dummies active (4/3)' })
  })

  it('frees a slot the moment a dummy is destroyed (ART-3)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'noAcb@C5', 'noAcb@C7', { type: 'noAcb', at: 'P10', label: 'D', toughness: 1 }], north: ['berserker@P11:B'] })
    expect(validate(b.state, b.south, use(b.id('A'), PROTOTYPE, 'J11'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
    let state = act(b.state, b.south, END).state
    state = act(state, b.north, attack(b.id('B'), b.id('D'))).state
    state = act(state, b.north, END).state
    expect(validate(state, b.south, use(b.id('A'), PROTOTYPE, 'J11')).ok).toBe(true)
  })
})

describe('artificer.madInventor (8.10, A8-15)', () => {
  it('gives an own dummy next to an own Artificer Movement 1 and +1 Power at attack time; elsewhere it is 0/0 (ART-6)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'noAcb@J11:D', 'noAcb@C6:FAR'], north: ['juliomancer@J12:E', 'juliomancer@C7:F'] })
    expect(viewOf(b.state, b.south, b.id('D'))).toMatchObject({ power: 1, movement: 1 })
    expect(viewOf(b.state, b.south, b.id('FAR'))).toMatchObject({ power: 0, movement: 0 })
    expect(unitIn(act(b.state, b.south, attack(b.id('D'), b.id('E'))).state, b.id('E'))?.toughness).toBe(15 - 1)
    expect(validate(b.state, b.south, move(b.id('FAR'), 'D6'))).toMatchObject({ ok: false, code: 'CANNOT_MOVE' })
    expect(validate(b.state, b.south, attack(b.id('FAR'), b.id('F')))).toMatchObject({ ok: false, code: 'NO_POWER' })
  })

  it('gives +1 once however many Artificers are adjacent, and nothing from an enemy Artificer (A3-15, ART-7)', () => {
    const b = buildBattle({ south: ['artificer@J11', 'artificer@L11', 'noAcb@K11:TWO', 'noAcb@C6:ALONE'], north: ['artificer@C7'] })
    expect(viewOf(b.state, b.south, b.id('TWO'))).toMatchObject({ power: 1, movement: 1 })
    expect(viewOf(b.state, b.south, b.id('ALONE'))).toMatchObject({ power: 0, movement: 0 })
  })

  it('is read when the Move is declared: a dummy may walk away from its Artificer, then cannot move again (ART-6)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'noAcb@J11:D', 'scourge@L11'] }) // Command Aura: 2 actions
    const moved = act(b.state, b.south, move(b.id('D'), 'K11')).state
    expect(viewOf(moved, b.south, b.id('D'))).toMatchObject({ power: 0, movement: 0, own: expect.objectContaining({ actionAllowance: 2 }) })
    expect(validate(moved, b.south, move(b.id('D'), 'K12'))).toMatchObject({ ok: false, code: 'CANNOT_MOVE' })
  })

  it('adds to other Power bonuses: under Sabrina, with the Keep, a dummy hits for 0 + 2 + 1 + 1 (B24, X-16, R31)', () => {
    const b = buildBattle({ south: ['artificer@J10', 'noAcb@J11:D'], north: ['juliomancer@J12:E'], commanders: { south: 'sabrina' }, control: { keep: 'south' } })
    expect(unitIn(act(b.state, b.south, attack(b.id('D'), b.id('E'))).state, b.id('E'))?.toughness).toBe(15 - 4)
  })
})

describe('artificer.tripMine (8.10, 8.16, A8-16)', () => {
  it('places a mine on a free adjacent square for 2 AP and the action; the opponent learns nothing (4.5, 4.8)', () => {
    const b = buildBattle({ south: ['artificer@J10:A'], north: ['ranger@J13'] })
    expect(projectView(b.state, b.north).units.map((u) => u.id)).toContain(b.id('A')) // the opponent watches the Artificer
    const r = act(b.state, b.south, use(b.id('A'), TRIP_MINE, 'J11'))
    expect(r.state.mines).toEqual([expect.objectContaining({ owner: b.south, square: parseSquare('J11'), revealed: false, placedBy: b.id('A') })])
    expect(r.state.seats[b.south].ap).toBe(20 - 2)
    expect(unitIn(r.state, b.id('A'))?.turn.actionsUsed).toBe(1)
    expect(projectView(r.state, b.south).mines).toHaveLength(1)
    expect(projectView(r.state, b.north).mines).toEqual([])
    expect(findLeaks(r.state, b.north)).toEqual([])
    expect(filterEvents(r.events, b.south).map((e) => e.type)).toEqual(expect.arrayContaining(['abilityUsed', 'minePlaced']))
    expect(filterEvents(r.events, b.north).filter((e) => e.type === 'abilityUsed' || e.type === 'minePlaced')).toEqual([])
  })

  it('needs a free adjacent square that holds no known mine (A8-13, A8-16)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'soldier@I10'], mines: [{ owner: 'south', at: 'J11' }, { owner: 'north', at: 'K10' }] })
    const check = (square: string) => validate(b.state, b.south, use(b.id('A'), TRIP_MINE, square))
    expect(check('J11')).toMatchObject({ ok: false, code: 'SQUARE_UNAVAILABLE' })
    expect(check('K10')).toEqual({ ok: false, code: 'REQUIREMENT_NOT_MET', message: 'That square already holds a mine' })
    expect(check('I10')).toMatchObject({ ok: false, code: 'SQUARE_UNAVAILABLE' })
    expect(check('J12')).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    expect(check('J9').ok).toBe(true)
  })

  it('caps mines at 5 + (n - 1) for n Artificers alive (ART-1)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(MINE_CAP)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it.each([[1], [2]])('refuses a mine beyond the army-wide cap with %i Artificer(s) (ART-1, ART-3)', (n) => {
    const cap = MINE_CAP(n)
    const setup = (count: number) =>
      buildBattle({
        south: ['J10', 'L10'].slice(0, n).map((s, i) => `artificer@${s}:A${i}`),
        mines: SPARE.slice(0, count).map((s) => ({ owner: 'south' as const, at: s })),
      })
    const below = setup(cap - 1)
    expect(validate(below.state, below.south, use(below.id('A0'), TRIP_MINE, 'J11')).ok).toBe(true)
    const full = setup(cap)
    const reason = `Max ${cap} mines active (${cap}/${cap})` // PX BT-06
    expect(validate(full.state, full.south, use(full.id('A0'), TRIP_MINE, 'J11'))).toEqual({ ok: false, code: 'REQUIREMENT_NOT_MET', message: reason })
    expect(legalActions(projectView(full.state, full.south), full.id('A0')).find((o) => o.abilityId === TRIP_MINE)).toMatchObject({ enabled: false, reason })
  })

  it('frees a slot the moment a mine explodes (ART-3)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'scourge@E5:S'], mines: ['E6', 'C7', 'C9', 'C11', 'C13'].map((s) => ({ owner: 'south' as const, at: s })) })
    expect(validate(b.state, b.south, use(b.id('A'), TRIP_MINE, 'J11'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
    const stepped = act(b.state, b.south, move(b.id('S'), 'E6')).state
    expect(stepped.mines).toHaveLength(4)
    expect(validate(stepped, b.south, use(b.id('A'), TRIP_MINE, 'J11')).ok).toBe(true)
  })

  it('fails on an enemy mine it did not know of: nothing placed, that mine revealed, AP and action spent (ART-8, 4.7)', () => {
    const mindsEye = getAbility('artificer.mindsEye')
    registerAbility({ id: 'artificer.mindsEye', status: 'stub' }, { replace: true }) // as if MINDS_EYE_REVEALS_MINES were off
    try {
      const b = buildBattle({ south: ['artificer@J10:A'], mines: [{ owner: 'north', at: 'J11', label: 'enemy' }] })
      expect(projectView(b.state, b.south).mines).toEqual([])
      const r = act(b.state, b.south, use(b.id('A'), TRIP_MINE, 'J11'))
      expect(r.state.mines).toEqual([expect.objectContaining({ id: b.mineIds['enemy'], owner: b.north, revealed: true })])
      expect(projectView(r.state, b.south).mines).toHaveLength(1)
      expect(r.state.seats[b.south].ap).toBe(20 - 2)
      expect(unitIn(r.state, b.id('A'))?.turn.actionsUsed).toBe(1)
      expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'abilityNote', unitId: b.id('A'), abilityId: TRIP_MINE, note: 'An enemy mine is already there' })
    } finally {
      if (mindsEye !== undefined) registerAbility(mindsEye, { replace: true })
    }
  })

  it('explodes under any unit that enters its square, own units included, and stops it there (TMN-1)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'scourge@K11:S'] })
    const placed = act(b.state, b.south, use(b.id('A'), TRIP_MINE, 'J11')).state
    const r = act(placed, b.south, move(b.id('S'), 'J11', 'I11'))
    expect(unitIn(r.state, b.id('S'))).toMatchObject({ anchor: parseSquare('J11'), toughness: 33 - MINE_DAMAGE })
    expect(r.state.mines).toEqual([])
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'moveEnded', unitId: b.id('S'), reason: 'mine' }))
  })

  it('deals 10 to a unit of Size 2, and 5 to an enemy stepping on it (TMN-2, B16)', () => {
    const big = buildBattle({ south: ['artificer@J10:A', 'beast@K11:B'] })
    const placed = act(big.state, big.south, use(big.id('A'), TRIP_MINE, 'J11')).state
    expect(unitIn(act(placed, big.south, move(big.id('B'), 'J11')).state, big.id('B'))?.toughness).toBe(40 - 10)

    const foe = buildBattle({ south: ['artificer@J10:A'], north: ['soldier@J12:E'] })
    let state = act(foe.state, foe.south, use(foe.id('A'), TRIP_MINE, 'J11')).state
    state = act(state, foe.south, END).state
    expect(unitIn(act(state, foe.north, move(foe.id('E'), 'J11')).state, foe.id('E'))?.toughness).toBe(7 - MINE_DAMAGE)
  })

  it('is set off from a distance by a ranged attack on its square, without damage (L101, X-24)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'ranger@J13:R'] })
    const placed = act(b.state, b.south, use(b.id('A'), TRIP_MINE, 'J11')).state
    const r = act(placed, b.south, { kind: 'attack', unitId: b.id('R'), target: at('J11') })
    expect(r.state.mines).toEqual([])
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'mineExploded', trigger: 'shot', victimId: null }))
  })

  it("is revealed to the opponent by its Mind's Eye in range, then shown while in its vision (A4-11)", () => {
    const b = buildBattle({ south: ['artificer@J10:A'], north: ['artificer@J14'] })
    const r = act(b.state, b.south, use(b.id('A'), TRIP_MINE, 'J11'))
    expect(r.state.mines[0]?.revealed).toBe(true)
    expect(projectView(r.state, b.north).mines).toEqual([expect.objectContaining({ owner: b.south, square: parseSquare('J11'), revealed: true })])
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'mineRevealed', square: parseSquare('J11') }))
    expect(findLeaks(r.state, b.north)).toEqual([])
  })

  it('kills its own 1/5 commander like anyone else (X-17, TMN-6)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'commander@J12:C'] })
    const placed = act(b.state, b.south, use(b.id('A'), TRIP_MINE, 'J11')).state
    expect(act(placed, b.south, move(b.id('C'), 'J11')).state.result).toMatchObject({ winner: b.north, reason: 'conquest' })
  })

  it('is not available under Sabrina, whose Artificers keep Prototype No-ACB (A7-11, ART-10)', () => {
    const b = buildBattle({ south: ['artificer@J10:A'], commanders: { south: 'sabrina' } })
    expect(validate(b.state, b.south, use(b.id('A'), TRIP_MINE, 'J11'))).toMatchObject({ ok: false, code: 'UNKNOWN_ABILITY' })
    expect(validate(b.state, b.south, use(b.id('A'), PROTOTYPE, 'J11')).ok).toBe(true)
    expect(legalActions(projectView(b.state, b.south), b.id('A')).map((o) => o.abilityId)).not.toContain(TRIP_MINE)
  })

  it('lets an Artificer in a Command Aura create twice in one turn, a dummy and a mine (ART-9)', () => {
    const b = buildBattle({ south: ['artificer@J10:A', 'scourge@J12'] })
    let state = act(b.state, b.south, use(b.id('A'), PROTOTYPE, 'I10')).state
    state = act(state, b.south, use(b.id('A'), TRIP_MINE, 'J9')).state
    expect([dummies(state).length, state.mines.length, state.seats[b.south].ap]).toEqual([1, 1, 20 - 4])
  })
})
