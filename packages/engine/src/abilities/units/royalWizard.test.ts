import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate, type Intent } from '../../commands'
import { RATASIUS_WEAKNESS, RATASIUS_WEAKNESS_RANGE } from '../../constants'
import { unitDef } from '../../content/units'
import { area3x3, parseSquare } from '../../geometry'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { GameState, Seat } from '../../types'
import { filterEvents, projectView } from '../../view'

const FORCEFIELD = 'royalWizard.forcefield'
const PAJAZON = 'royalWizard.pajazon'
const END: Intent = { kind: 'endTurn' }

// Test-local stand-in for a commander stub: Ratasius' weakness (A7-14), to show that ticks are never weakened.
registerAbility(
  {
    id: 'ratasius.great',
    status: 'implemented',
    attackerSubtraction: (q, holder, hit) =>
      hit.dealer !== null && hit.dealer.owner !== holder.owner && q.distance(holder, hit.dealer) <= RATASIUS_WEAKNESS_RANGE ? RATASIUS_WEAKNESS : 0,
  },
  { replace: true },
)

const field = (unitId: string, ...squares: string[]): Intent => ({ kind: 'useAbility', unitId, abilityId: FORCEFIELD, targets: [{ kind: 'squares', squares: sqs(...squares) }] })
const pajazon = (unitId: string, centre: string): Intent => ({ kind: 'useAbility', unitId, abilityId: PAJAZON, targets: [{ kind: 'square', square: parseSquare(centre) }] })
const attack = (unitId: string, targetId: string): Intent => ({ kind: 'attack', unitId, target: { kind: 'unit', unitId: targetId } })
const toughness = (state: GameState, id: string) => unitIn(state, id)?.toughness
const endTurns = (state: GameState, ...seats: Seat[]) => seats.reduce((s, seat) => act(s, seat, END).state, state)

describe('royalWizard stats (8.11; owner ruling R25)', () => {
  it('is 10/24 with LOV 3, Movement 1 and AP 3 from the content table', () => {
    expect(unitDef('royalWizard')).toMatchObject({ power: 10, toughness: 24, lov: 3, movement: 1, ap: 3, tier: 50 })
  })
})

describe('royalWizard.forcefield (8.11, A8-18)', () => {
  it("takes 8 off every hit on own units inside (floor 1) until the start of the Wizard's next turn (A2-24)", () => {
    const b = buildBattle({ south: ['royalWizard@J10:W', 'juliomancer@J12:J'], north: ['berserker@J13:B'] })
    const cast = act(b.state, b.south, field(b.id('W'), 'J11', 'J12', 'K11', 'K12'))
    expect(cast.state.seats[b.south].ap).toBe(20 - 2)
    expect(cast.state.areas).toEqual([expect.objectContaining({ abilityId: FORCEFIELD, owner: b.south, squares: sqs('J11', 'J12', 'K11', 'K12'), expiresAtOwnTurn: 2 })])
    const hit = act(act(cast.state, b.south, END).state, b.north, attack(b.id('B'), b.id('J')))
    expect(toughness(hit.state, b.id('J'))).toBe(15 - 1)
    expect(filterEvents(hit.events, b.south)).toContainEqual(
      expect.objectContaining({
        type: 'unitDamaged',
        unitId: b.id('J'),
        amount: 1,
        breakdown: [
          { step: 'base', source: 'base', delta: 8, total: 8 },
          { step: 'reduction', source: FORCEFIELD, delta: -8, total: 0 },
          { step: 'reduction', source: 'floor', delta: 1, total: 1 },
        ],
      }),
    )
    const next = act(hit.state, b.north, END)
    expect(next.state.areas).toEqual([])
    expect(filterEvents(next.events, b.south)).toContainEqual({ type: 'areaExpired', areaId: cast.state.areas[0]?.id })
  })

  it("protects only its owner's units, and a Size-2 unit with any square inside (WIZ-3, WIZ-5)", () => {
    const b = buildBattle({ south: ['royalWizard@J10:W', 'beast@H9:Z', 'berserker@L11:K'], north: ['juliomancer@K11:E', 'berserker@G10:B'] })
    let state = act(b.state, b.south, field(b.id('W'), 'I10', 'I11', 'J11', 'K11')).state
    state = act(state, b.south, attack(b.id('K'), b.id('E'))).state
    expect(toughness(state, b.id('E'))).toBe(15 - 8)
    state = act(act(state, b.south, END).state, b.north, attack(b.id('B'), b.id('Z'))).state
    expect(toughness(state, b.id('Z'))).toBe(40 - 1)
  })

  it('also cuts mines and enemy Pajazon ticks to 1 (WIZ-5, TMN-5)', () => {
    const b = buildBattle({
      south: ['royalWizard@J10:W', 'juliomancer@J12:J', 'juliomancer@K12:M'],
      north: ['royalWizard@J15:N'],
      mines: [{ owner: 'north', at: 'K11' }],
      active: 'north',
    })
    let state = act(b.state, b.north, pajazon(b.id('N'), 'J13')).state // I12:K14 covers J12 and K12
    state = act(state, b.north, END).state
    state = act(state, b.south, field(b.id('W'), 'J11', 'J12', 'K11', 'K12')).state
    state = act(state, b.south, { kind: 'move', unitId: b.id('M'), path: sqs('K11') }).state
    expect(toughness(state, b.id('M'))).toBe(15 - 1)
    state = act(state, b.south, END).state
    expect(toughness(state, b.id('J'))).toBe(15 - 1)
  })

  it('stays on its squares and outlives the Wizard (WIZ-3, WIZ-11)', () => {
    const b = buildBattle({
      south: [{ type: 'royalWizard', at: 'J10', label: 'W', toughness: 1 }, 'juliomancer@J12:J', 'footman@K11:F'],
      north: ['berserker@I10:A', 'berserker@J13:B', 'berserker@L12:C'],
    })
    let state = act(b.state, b.south, field(b.id('W'), 'J11', 'J12', 'K11', 'K12')).state
    state = act(state, b.south, { kind: 'move', unitId: b.id('F'), path: sqs('L11') }).state
    state = act(act(state, b.south, END).state, b.north, attack(b.id('A'), b.id('W'))).state
    expect(unitIn(state, b.id('W'))).toBeUndefined()
    state = act(state, b.north, attack(b.id('B'), b.id('J'))).state
    expect(toughness(state, b.id('J'))).toBe(15 - 1)
    state = act(state, b.north, attack(b.id('C'), b.id('F'))).state
    expect(unitIn(state, b.id('F'))).toBeUndefined() // it walked out of the field
  })

  it("needs 4 orthogonally connected squares inside the Wizard's LOV, any tetromino (A8-18, C27, WIZ-1)", () => {
    const b = buildBattle({ south: ['royalWizard@J10:W'] })
    const check = (...squares: string[]) => validate(b.state, b.south, field(b.id('W'), ...squares))
    const shapes = [
      ['J11', 'J12', 'K11', 'K12'], // O
      ['I11', 'J11', 'K11', 'L11'], // I
      ['I11', 'J11', 'K11', 'J12'], // T
      ['J11', 'J12', 'J13', 'K11'], // L
      ['I11', 'J11', 'J12', 'K12'], // Z
      ['J10', 'J11', 'J12', 'J13'], // with the Wizard's own square
    ]
    for (const shape of shapes) expect(check(...shape).ok).toBe(true)
    expect(check('J11', 'J12', 'K11')).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(check('J11', 'J12', 'K11', 'K12', 'L11')).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(check('J11', 'J12', 'J13', 'J14')).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' }) // J14 is 4 away
    expect(check('J11', 'J12', 'L10', 'L11')).toMatchObject({ ok: false, code: 'INVALID_TARGET' }) // two pieces
    expect(check('J11', 'J11', 'J12', 'J13')).toMatchObject({ ok: false, code: 'INVALID_TARGET' }) // a square twice
  })

  it('may cover occupied squares and terrain, but every square must exist (8.11)', () => {
    const keep = buildBattle({ south: ['royalWizard@I13:W', 'juliomancer@I12'] })
    expect(validate(keep.state, keep.south, field(keep.id('W'), 'H12', 'H13', 'I12', 'I13')).ok).toBe(true) // the Keep
    const corner = buildBattle({ south: ['royalWizard@C4:W'] })
    expect(validate(corner.state, corner.south, field(corner.id('W'), 'A4', 'B4', 'C4', 'D4'))).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' }) // A4 is cut
  })

  it('has CD 1: usable every other own turn (A2-22)', () => {
    const b = buildBattle({ south: ['royalWizard@J10:W'] })
    const cast = (s: GameState) => act(s, b.south, field(b.id('W'), 'J11', 'J12', 'K11', 'K12')).state
    let state = cast(b.state)
    expect(unitIn(state, b.id('W'))?.cooldowns[FORCEFIELD]).toEqual({ usedOnOwnTurn: 1, readyOnOwnTurn: 3 })
    state = endTurns(state, b.south, b.north)
    expect(validate(state, b.south, field(b.id('W'), 'J11', 'J12', 'K11', 'K12'))).toMatchObject({ ok: false, code: 'ON_COOLDOWN' })
    state = endTurns(state, b.south, b.north)
    expect(cast(state).areas).toHaveLength(1)
  })

  it('counts once on a unit inside two Forcefields (WIZ-4, X-11)', () => {
    const b = buildBattle({ south: ['royalWizard@J10:V', 'royalWizard@I10:W', 'paladin@J12:P'], north: ['beast@J13:B'] })
    let state = act(b.state, b.south, field(b.id('V'), 'J11', 'J12', 'K11', 'K12')).state
    state = act(state, b.south, field(b.id('W'), 'I11', 'J11', 'I12', 'J12')).state
    state = act(act(state, b.south, END).state, b.north, attack(b.id('B'), b.id('P'))).state
    expect(toughness(state, b.id('P'))).toBe(18 - (20 - 2 - 8))
  })

  it('adds to other reductions before Defend halves: a defending Paladin hit for 20 takes 5 (X-09, B13, PAL-2)', () => {
    const b = buildBattle({ south: ['royalWizard@J10:W', 'paladin@J12:P'], north: ['beast@J13:B'] })
    let state = act(b.state, b.south, { kind: 'defend', unitId: b.id('P') }).state
    state = act(state, b.south, field(b.id('W'), 'J11', 'J12', 'K11', 'K12')).state
    state = act(act(state, b.south, END).state, b.north, attack(b.id('B'), b.id('P'))).state
    expect(toughness(state, b.id('P'))).toBe(18 - 5) // ceil((20 - 2 - 8) / 2)
  })
})

describe('royalWizard.pajazon (8.11, A8-19)', () => {
  it("heals own units inside at the end of own turns and hurts enemy units inside at the end of the opponent's, for two own turns (A2-23)", () => {
    const b = buildBattle({ south: ['royalWizard@J10:W', { type: 'juliomancer', at: 'I12', label: 'OWN', toughness: 2 }], north: ['juliomancer@K14:FOE'] })
    const cast = act(b.state, b.south, pajazon(b.id('W'), 'J13'))
    expect(cast.state.seats[b.south].ap).toBe(20 - 3)
    expect(cast.state.areas).toEqual([expect.objectContaining({ abilityId: PAJAZON, owner: b.south, squares: area3x3(parseSquare('J13')), expiresAtOwnTurn: 3 })])
    const track: (number | undefined)[][] = []
    let state = cast.state
    for (const seat of [b.south, b.north, b.south, b.north, b.south, b.north]) {
      state = act(state, seat, END).state
      track.push([toughness(state, b.id('OWN')), toughness(state, b.id('FOE'))])
    }
    expect(track).toEqual([
      [5, 15],
      [5, 12],
      [8, 12],
      [8, 9],
      [8, 9], // removed at the start of own turn 3
      [8, 9],
    ])
    expect(state.areas).toEqual([])
  })

  it('shows the opponent only the squares inside its vision (A4-13)', () => {
    const b = buildBattle({ south: ['royalWizard@J10:W'], north: ['juliomancer@K14'] })
    const cast = act(b.state, b.south, pajazon(b.id('W'), 'J13'))
    const seen = projectView(cast.state, b.north).areas[0]?.squares ?? []
    expect(seen).toHaveLength(8)
    expect(seen).not.toContainEqual(parseSquare('I12')) // 4 from K14
    expect(filterEvents(cast.events, b.north)).toContainEqual(expect.objectContaining({ type: 'areaCreated', squares: seen }))
  })

  it('is centred up to range 3 from the Wizard, its own square included; off-board squares are dropped (A8-19)', () => {
    const b = buildBattle({ south: ['royalWizard@J3:W'] })
    const check = (centre: string) => validate(b.state, b.south, pajazon(b.id('W'), centre))
    for (const centre of ['J6', 'L4', 'J3']) expect(check(centre).ok).toBe(true)
    expect(check('J7')).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    expect(check('L5')).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    expect(act(b.state, b.south, pajazon(b.id('W'), 'J1')).state.areas[0]?.squares).toEqual(sqs('I1', 'J1', 'K1', 'I2', 'J2', 'K2'))
    const corner = buildBattle({ south: ['royalWizard@C4:W'] })
    expect(validate(corner.state, corner.south, pajazon(corner.id('W'), 'A4'))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
  })

  it('has CD 1, so one Wizard can keep a Pajazon up all the time (A2-22, WIZ-6)', () => {
    const b = buildBattle({ south: ['royalWizard@J10:W'] })
    let state = endTurns(act(b.state, b.south, pajazon(b.id('W'), 'J12')).state, b.south, b.north)
    expect(state.areas).toHaveLength(1)
    expect(validate(state, b.south, pajazon(b.id('W'), 'J12'))).toMatchObject({ ok: false, code: 'ON_COOLDOWN' })
    state = endTurns(state, b.south, b.north)
    expect(state.areas).toEqual([])
    expect(act(state, b.south, pajazon(b.id('W'), 'J12')).state.areas).toHaveLength(1)
  })

  it('ticks once per unit under overlapping Pajazons (WIZ-7, X-11)', () => {
    const b = buildBattle({ south: ['royalWizard@J10:V', 'royalWizard@L10:W', { type: 'juliomancer', at: 'K11', label: 'OWN', toughness: 2 }], north: ['juliomancer@K12:FOE'] })
    let state = act(b.state, b.south, pajazon(b.id('V'), 'J12')).state
    state = act(state, b.south, pajazon(b.id('W'), 'L12')).state
    state = act(state, b.south, END).state
    expect(toughness(state, b.id('OWN'))).toBe(2 + 3)
    state = act(state, b.north, END).state
    expect(toughness(state, b.id('FOE'))).toBe(15 - 3)
  })

  it("hits hidden enemies; R2 reveals one only where the Wizard's player can see (WIZ-8)", () => {
    const b = buildBattle({
      south: ['royalWizard@J10:W'],
      north: [
        { type: 'rogue', at: 'K14', label: 'FAR', stealthed: true },
        { type: 'rogue', at: 'J12', label: 'NEAR', stealthed: true },
      ],
    })
    const state = endTurns(act(b.state, b.south, pajazon(b.id('W'), 'J13')).state, b.south)
    const r = act(state, b.north, END)
    expect(unitIn(r.state, b.id('FAR'))).toMatchObject({ toughness: 1, stealthed: true })
    expect(unitIn(r.state, b.id('NEAR'))).toMatchObject({ toughness: 1, stealthed: false })
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'unitRevealed', unitId: b.id('NEAR'), cause: 'damage' }))
    expect(filterEvents(r.events, b.south).some((e) => e.type === 'unitDamaged' && e.unitId === b.id('FAR'))).toBe(false)
  })

  it.each([
    [3, undefined],
    [4, 2],
  ])("hurts before the opponent's own heals: an enemy Soldier at %i ends its turn at %s (WIZ-9, X-10, T9, T10)", (start, expected) => {
    const b = buildBattle({ south: ['royalWizard@J10:W'], north: [{ type: 'soldier', at: 'J12', label: 'S', toughness: start }] })
    const state = endTurns(act(b.state, b.south, pajazon(b.id('W'), 'J12')).state, b.south, b.north)
    expect(toughness(state, b.id('S'))).toBe(expected)
  })

  it("is never weakened by Ratasius, unlike the Wizard's own attack (WIZ-10, X-22)", () => {
    const b = buildBattle({ south: ['royalWizard@J10:W'], north: ['commander@I10', 'juliomancer@J12:J', 'juliomancer@K10:K'], commanders: { north: 'ratasius' } })
    expect(toughness(act(b.state, b.south, attack(b.id('W'), b.id('K'))).state, b.id('K'))).toBe(15 - (10 - RATASIUS_WEAKNESS))
    const state = endTurns(act(b.state, b.south, pajazon(b.id('W'), 'J12')).state, b.south, b.north)
    expect(toughness(state, b.id('J'))).toBe(15 - 3)
  })

  it('kills an enemy commander that ends its turn inside at 3 or less, and heals an own one (WIZ-12, CMD-2)', () => {
    const b = buildBattle({
      south: ['royalWizard@J10:W', { type: 'commander', at: 'I11', label: 'MINE', toughness: 2 }],
      north: [{ type: 'commander', at: 'J13', label: 'THEIRS', toughness: 3 }],
    })
    const state = endTurns(act(b.state, b.south, pajazon(b.id('W'), 'J12')).state, b.south)
    expect(toughness(state, b.id('MINE'))).toBe(5)
    expect(act(state, b.north, END).state.result).toMatchObject({ winner: b.south, reason: 'conquest' })
  })

  it('sets off no mine and keeps ticking after the Wizard dies (TMN-3, WIZ-11)', () => {
    const b = buildBattle({ south: [{ type: 'royalWizard', at: 'J10', label: 'W', toughness: 1 }], north: ['berserker@I10:B', 'juliomancer@J12:J'], mines: [{ owner: 'north', at: 'K12' }] })
    let state = endTurns(act(b.state, b.south, pajazon(b.id('W'), 'J12')).state, b.south)
    state = act(state, b.north, attack(b.id('B'), b.id('W'))).state
    expect(unitIn(state, b.id('W'))).toBeUndefined()
    state = act(state, b.north, END).state
    expect(toughness(state, b.id('J'))).toBe(15 - 3)
    expect(state.mines).toHaveLength(1)
  })

  it('adds to other end-of-turn heals, all capped (X-25, A3-10)', () => {
    const b = buildBattle({ south: ['royalWizard@J10:W', { type: 'soldier', at: 'J12', label: 'S', toughness: 5 }] })
    const r = act(act(b.state, b.south, pajazon(b.id('W'), 'J12')).state, b.south, END)
    expect(toughness(r.state, b.id('S'))).toBe(7)
    const heals = filterEvents(r.events, b.south).flatMap((e) => (e.type === 'unitHealed' ? [[e.source, e.amount]] : []))
    expect(heals).toEqual([
      ['soldier.perseverance', 1],
      [PAJAZON, 1],
    ])
  })
})

describe('royalWizard: both spells in one turn (WIZ-13, SCO-3)', () => {
  it('needs a second action (Command Aura): 2 + 3 AP, separate cooldowns, never the same spell twice', () => {
    const lone = buildBattle({ south: ['royalWizard@J10:W'] })
    const once = act(lone.state, lone.south, field(lone.id('W'), 'J11', 'J12', 'K11', 'K12')).state
    expect(validate(once, lone.south, pajazon(lone.id('W'), 'J12'))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })

    const b = buildBattle({ south: ['royalWizard@J10:W', 'scourge@L10'] })
    let state = act(b.state, b.south, field(b.id('W'), 'J11', 'J12', 'K11', 'K12')).state
    expect(validate(state, b.south, field(b.id('W'), 'J11', 'J12', 'K11', 'K12'))).toMatchObject({ ok: false, code: 'ON_COOLDOWN' })
    state = act(state, b.south, pajazon(b.id('W'), 'J12')).state
    expect(state.seats[b.south].ap).toBe(20 - 2 - 3)
    expect(Object.keys(unitIn(state, b.id('W'))?.cooldowns ?? {}).sort()).toEqual([FORCEFIELD, PAJAZON].sort())
  })
})
