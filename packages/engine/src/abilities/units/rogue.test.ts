import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate, type Intent } from '../../commands'
import { COMMAND_AURA_RANGE, KEEP_POWER_BONUS, RATASIUS_DETECTION_RANGE } from '../../constants'
import { abilityData, abilityParam } from '../../content/abilities'
import { commanderStats } from '../../content/derived'
import { unitDef } from '../../content/units'
import type { GameEvent } from '../../events'
import { area3x3, parseSquare, sameSquare } from '../../geometry'
import { legalActions } from '../../preview'
import { act, buildBattle, sqs, unitIn, type Battle } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import { SEATS, type GameState, type Seat, type Square } from '../../types'
import { filterEvents, projectView } from '../../view'

const ROGUE = unitDef('rogue')
const PALADIN = unitDef('paladin').toughness
const SOLDIER = unitDef('soldier').toughness
const ARMOR = abilityParam('paladin.reinforcedArmor', 'reduction')
const LINE = abilityParam('footman.lineFormation', 'reduction')
const STEALTH_AP = abilityData('rogue.stealth').apCost
const TICK = abilityParam('royalWizard.pajazon', 'damage')
const FORCEFIELD = abilityParam('royalWizard.forcefield', 'reduction')
const SPOTTED = 'Spotted: an unseen enemy can see this square'

// Test-local stand-ins for other files' abilities, so these tests exercise Stealth and Assault alone: a Pajazon-like
// tick, a Forcefield-like reduction, Command Aura, Ratasius' detection, and Artificers that create and walk dummies
// without Mind's Eye (which would reveal the Rogue first).
const inside = (squares: readonly Square[], footprint: readonly Square[]): boolean => footprint.some((s) => squares.some((a) => sameSquare(a, s)))
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) =>
        ending === area.owner ? null : { damage: q.units().filter((u) => u.owner === ending && inside(area.squares, q.footprint(u))).map((u) => ({ target: u.id, amount: TICK })) },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'royalWizard.forcefield',
    status: 'implemented',
    area: { targetReduction: (q, area, hit) => (hit.target.owner === area.owner && inside(area.squares, q.footprint(hit.target)) ? FORCEFIELD : 0) },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'scourge.commandAura',
    status: 'implemented',
    modifyStats: (q, holder, target) => (target.id !== holder.id && target.owner === holder.owner && q.distance(holder, target) <= COMMAND_AURA_RANGE ? { actions: 1 } : null),
  },
  { replace: true },
)
registerAbility({ id: 'ratasius.great', status: 'implemented', detection: () => ({ kind: 'range', range: RATASIUS_DETECTION_RANGE }) }, { replace: true })
registerAbility({ id: 'artificer.mindsEye', status: 'stub' }, { replace: true })
registerAbility(
  {
    id: 'artificer.prototypeNoAcb',
    status: 'implemented',
    active: {
      targets: [{ kind: 'square', label: 'Square', minRange: 1, range: 1, free: true }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        if (t?.kind === 'square') ctx.createUnit('noAcb', unit.owner, t.square, unit)
      },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'artificer.madInventor',
    status: 'implemented',
    modifyStats: (q, holder, target) => (target.type === 'noAcb' && target.owner === holder.owner && q.isAdjacent(holder, target) ? { movement: 1 } : null),
  },
  { replace: true },
)

const stealth = (b: Battle, unit = 'R'): Intent => ({ kind: 'useAbility', unitId: b.id(unit), abilityId: 'rogue.stealth', targets: [] })
const move = (b: Battle, unit: string, ...path: string[]): Intent => ({ kind: 'move', unitId: b.id(unit), path: sqs(...path) })
const stealthed = (at: string, label = 'R') => ({ type: 'rogue' as const, at, label, stealthed: true })
const ASSAULT = ROGUE.power - ARMOR // an Assault on a Paladin

function addArea(state: GameState, abilityId: string, owner: Seat, squares: readonly Square[]): void {
  state.areas.push({ id: `a-test${state.areas.length}`, abilityId, owner, sourceId: null, squares: [...squares], createdOnOwnTurn: 0, expiresAtOwnTurn: 9, seq: state.nextSeq++, data: {} })
}

function play(state: GameState, steps: readonly (readonly [Seat, Intent])[]): GameState {
  return steps.reduce((s, [seat, intent]) => act(s, seat, intent).state, state)
}

const types = (events: readonly GameEvent[], seat: Seat): string[] => filterEvents(events, seat).map((e) => e.type)

describe('rogue.stealth (8.6, A8-06, 4.4)', () => {
  it('makes the Rogue invisible to the opponent for 1 AP and its action, telling the opponent nothing', () => {
    const b = buildBattle({ south: ['rogue@M8:R'], north: ['emissary@M14:E'] })
    const r = act(b.state, b.south, stealth(b))
    expect(unitIn(r.state, b.id('R'))).toMatchObject({ stealthed: true, turn: expect.objectContaining({ actionsUsed: 1 }) })
    expect(r.state.seats[b.south].ap).toBe(20 - (STEALTH_AP as number))
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'stealthChanged', unitId: b.id('R'), stealthed: true })
    expect(types(r.events, b.north)).toEqual(['apChanged']) // 4.8 (the AP totals are public, R15)
    // The Emissary (LOV 4) walks to M12: the Rogue's square is now in its LOV, yet it sees nothing there.
    const state = play(r.state, [
      [b.south, { kind: 'endTurn' }],
      [b.north, move(b, 'E', 'M13', 'M12')],
    ])
    expect(projectView(state, b.north).units.some((u) => u.id === b.id('R'))).toBe(false)
    expect(unitIn(state, b.id('R'))?.stealthed).toBe(true)
    for (const seat of SEATS) expect(findLeaks(state, seat)).toEqual([])
  })

  it('is disabled while an enemy the player can see has the square in its LOV (A4-05, C11)', () => {
    const b = buildBattle({ south: ['rogue@M8:R'], north: ['soldier@M10:S'] })
    expect(validate(b.state, b.south, stealth(b))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET', message: 'An enemy can see this unit' })
    const option = legalActions(projectView(b.state, b.south), b.id('R')).find((o) => o.abilityId === 'rogue.stealth')
    expect(option).toMatchObject({ enabled: false, cost: STEALTH_AP, reason: 'An enemy can see this unit' })
  })

  it('fails against an unseen watcher, spending its AP and action: "Spotted" (ROG-2, C11, X-31)', () => {
    const b = buildBattle({ south: ['rogue@M8:R'], north: ['emissary@M12:E'] }) // LOV 4 reaches M8; the Rogue sees 3
    expect(projectView(b.state, b.south).units.some((u) => u.id === b.id('E'))).toBe(false)
    expect(validate(b.state, b.south, stealth(b)).ok).toBe(true)
    const r = act(b.state, b.south, stealth(b))
    expect(unitIn(r.state, b.id('R'))).toMatchObject({ stealthed: false, turn: expect.objectContaining({ actionsUsed: 1 }) })
    expect(r.state.seats[b.south].ap).toBe(20 - (STEALTH_AP as number))
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'abilityNote', unitId: b.id('R'), abilityId: 'rogue.stealth', note: SPOTTED })
    expect(types(r.events, b.north)).toEqual(['apChanged']) // the watcher learns nothing (4.8)
  })

  it('counts invisible enemies, dummies and the commander as watchers (A4-05)', () => {
    const hidden = buildBattle({ south: ['rogue@M8:R'], north: [stealthed('M11', 'N')] })
    expect(validate(hidden.state, hidden.south, stealth(hidden)).ok).toBe(true)
    expect(unitIn(act(hidden.state, hidden.south, stealth(hidden)).state, hidden.id('R'))?.stealthed).toBe(false)
    const dummy = buildBattle({ south: ['rogue@M8:R'], north: ['noAcb@N8'] })
    expect(validate(dummy.state, dummy.south, stealth(dummy))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
    const commander = buildBattle({ south: ['rogue@M8:R'], north: ['commander@M11'] })
    expect(validate(commander.state, commander.south, stealth(commander))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
  })

  it('needs a wider berth from a long-sighted enemy: Ratasius sees 6 squares (ROG-16, X-03)', () => {
    const lov = commanderStats('ratasius').lov
    const b = buildBattle({ south: ['rogue@M8:R'], north: [`commander@M${8 + lov}`], commanders: { north: 'ratasius' } })
    expect(validate(b.state, b.south, stealth(b)).ok).toBe(true)
    expect(unitIn(act(b.state, b.south, stealth(b)).state, b.id('R'))?.stealthed).toBe(false)
  })

  it('cannot be used while already stealthed (ROG-3) and takes the action (ROG-1)', () => {
    const b = buildBattle({ south: [stealthed('M8'), 'rogue@C8:Q'] })
    expect(validate(b.state, b.south, stealth(b))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET', message: 'This unit is already in stealth' })
    const used = act(b.state, b.south, stealth(b, 'Q')).state
    expect(validate(used, b.south, move(b, 'Q', 'C9'))).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })

  it('cannot be named by unit-targeted actions, but a blind shot at its square still hits it (4.4, RNG-4)', () => {
    const b = buildBattle({ south: [stealthed('M8')], north: ['ranger@M10:G'], active: 'north' })
    const named: Intent = { kind: 'attack', unitId: b.id('G'), target: { kind: 'unit', unitId: b.id('R') } }
    expect(validate(b.state, b.north, named)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('G'), target: { kind: 'square', square: parseSquare('M8') } })
    expect(unitIn(r.state, b.id('R'))).toMatchObject({ toughness: ROGUE.toughness - unitDef('ranger').power, stealthed: false })
  })

  it('lets the Rogue move and defend unseen (4.4)', () => {
    const b = buildBattle({ south: [stealthed('M8'), stealthed('P8', 'Q')], north: ['emissary@M14:E'] })
    const state = play(b.state, [
      [b.south, move(b, 'R', 'M9', 'M10')],
      [b.south, { kind: 'defend', unitId: b.id('Q') }],
    ])
    expect(unitIn(state, b.id('R'))?.stealthed).toBe(true)
    expect(unitIn(state, b.id('Q'))).toMatchObject({ stealthed: true, defending: true })
    expect(projectView(state, b.north).units.some((u) => u.type === 'rogue')).toBe(false)
  })

  it('stays hidden when damaged where no enemy sees it; damage inside enemy LOV reveals it (A4-07, ROG-11)', () => {
    const unseen = buildBattle({ south: [stealthed('M8')] })
    addArea(unseen.state, 'royalWizard.pajazon', unseen.north, area3x3(parseSquare('M8')))
    const r = act(unseen.state, unseen.south, { kind: 'endTurn' })
    expect(unitIn(r.state, unseen.id('R'))).toMatchObject({ stealthed: true, toughness: ROGUE.toughness - TICK })

    const seen = buildBattle({ south: [stealthed('M8')], north: ['ranger@M11'] })
    addArea(seen.state, 'royalWizard.pajazon', seen.north, area3x3(parseSquare('M8')))
    const r2 = act(seen.state, seen.south, { kind: 'endTurn' })
    expect(unitIn(r2.state, seen.id('R'))?.stealthed).toBe(false)
    expect(filterEvents(r2.events, seen.south)).toContainEqual({ type: 'unitRevealed', unitId: seen.id('R'), cause: 'damage', byId: null })
  })
})

describe('rogue.assault (8.6, A8-07)', () => {
  it("strikes an enemy that steps next to it on the opponent's turn, for free and before the reveal; the move ends there", () => {
    const b = buildBattle({ south: ['rogue@M8:R'], north: ['paladin@M11:P'] }) // the Paladin's LOV 2 doesn't reach M8
    const state = play(b.state, [
      [b.south, stealth(b)],
      [b.south, { kind: 'endTurn' }],
    ])
    const ap = state.seats[b.south].ap
    const r = act(state, b.north, move(b, 'P', 'M10', 'M9', 'L9'))
    expect(unitIn(r.state, b.id('P'))).toMatchObject({ anchor: parseSquare('M9'), toughness: PALADIN - ASSAULT })
    expect(unitIn(r.state, b.id('R'))).toMatchObject({ stealthed: false, turn: expect.objectContaining({ actionsUsed: 1 }) }) // still just its Stealth
    expect(r.state.seats[b.south].ap).toBe(ap)
    const mine = filterEvents(r.events, b.south)
    expect(mine).toContainEqual({ type: 'unitAttacked', attackerId: b.id('R'), target: { kind: 'unit', unitId: b.id('P') }, source: 'rogue.assault' })
    expect(mine).toContainEqual({ type: 'unitRevealed', unitId: b.id('R'), cause: 'adjacency', byId: b.id('P') })
    expect(types(r.events, b.south).indexOf('unitDamaged')).toBeLessThan(types(r.events, b.south).indexOf('unitRevealed'))
    // The mover's side learns the damage but not the hidden attacker, then sees the revealed Rogue (A4-12).
    const theirs = filterEvents(r.events, b.north)
    expect(theirs).toContainEqual(expect.objectContaining({ type: 'unitDamaged', unitId: b.id('P'), source: 'rogue.assault', dealerId: null }))
    expect(theirs).toContainEqual(expect.objectContaining({ type: 'moveEnded', unitId: b.id('P'), reason: 'reaction' }))
    expect(theirs.some((e) => e.type === 'unitAttacked')).toBe(false)
    expect(projectView(r.state, b.north).units.some((u) => u.id === b.id('R'))).toBe(true)
    for (const seat of SEATS) expect(findLeaks(r.state, seat)).toEqual([])
  })

  it('also fires when the Rogue steps next to an enemy, and ends its own move (C31)', () => {
    const b = buildBattle({ south: [stealthed('M8')], north: ['paladin@M10:P'] })
    const r = act(b.state, b.south, move(b, 'R', 'M9', 'N9'))
    expect(unitIn(r.state, b.id('R'))).toMatchObject({ anchor: parseSquare('M9'), stealthed: false })
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(PALADIN - ASSAULT)
    expect(r.state.seats[b.south].ap).toBe(20 - ROGUE.ap) // the Move only
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'moveEnded', unitId: b.id('R'), reason: 'reaction' }))
  })

  it('reveals but never strikes a unit created next to it (ROG-4)', () => {
    const b = buildBattle({ south: [stealthed('M8')], north: ['artificer@M10:A'], active: 'north' })
    const r = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('A'), abilityId: 'artificer.prototypeNoAcb', targets: [{ kind: 'square', square: parseSquare('M9') }] })
    expect(r.state.units.find((u) => u.type === 'noAcb')?.toughness).toBe(unitDef('noAcb').toughness)
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(false)
    expect(filterEvents(r.events, b.south)).toContainEqual(expect.objectContaining({ type: 'unitRevealed', unitId: b.id('R'), cause: 'adjacency' }))
  })

  it('lets its controller pick one target when its own step reaches several enemies (ROG-5, X-33)', () => {
    const b = buildBattle({ south: [stealthed('M8')], north: ['paladin@L10:P', 'soldier@N10:S'] })
    const paused = act(b.state, b.south, move(b, 'R', 'M9', 'M10'))
    const decision = projectView(paused.state, b.south).decision
    expect(decision).toMatchObject({ kind: 'rogue.assault', defaultOption: b.id('S'), preferenceKey: null }) // the weakest on timeout; no preference
    expect(decision?.options).toEqual([
      { id: b.id('P'), label: 'Paladin at L10' },
      { id: b.id('S'), label: 'Soldier at N10' },
    ])
    expect(paused.events.some((e) => e.type === 'unitDamaged')).toBe(false)
    expect(unitIn(paused.state, b.id('R'))).toMatchObject({ anchor: parseSquare('M10'), stealthed: false })
    expect(validate(paused.state, b.south, { kind: 'endTurn' })).toMatchObject({ ok: false, code: 'DECISION_PENDING' })

    const r = act(paused.state, b.south, { kind: 'respondDecision', decisionId: decision?.id ?? '', choice: b.id('P') })
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(PALADIN - ASSAULT)
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(SOLDIER)
    expect(r.events.filter((e) => e.type === 'unitAttacked')).toHaveLength(1)
    const timedOut = act(paused.state, b.south, { kind: 'respondDecision', decisionId: decision?.id ?? '', choice: decision?.defaultOption ?? '' })
    expect(unitIn(timedOut.state, b.id('S'))).toBeUndefined()
    for (const seat of SEATS) expect(findLeaks(paused.state, seat)).toEqual([])
  })

  it('resolves both Assaults when two stealthed Rogues meet, the stationary one first (ROG-6)', () => {
    const setup = () => buildBattle({ south: [stealthed('M8')], north: [stealthed('M11', 'N')] })
    // The stationary Rogue kills the mover, so the mover's Assault never resolves; nothing is left next to it.
    const b = setup()
    const r = act(b.state, b.south, move(b, 'R', 'M9', 'M10'))
    expect(unitIn(r.state, b.id('R'))).toBeUndefined()
    expect(unitIn(r.state, b.id('N'))).toMatchObject({ toughness: ROGUE.toughness, stealthed: true })
    // Behind Forcefields both survive: both strike, stationary first, and both end revealed.
    const s = setup()
    addArea(s.state, 'royalWizard.forcefield', s.south, sqs('M10'))
    addArea(s.state, 'royalWizard.forcefield', s.north, sqs('M11'))
    const r2 = act(s.state, s.south, move(s, 'R', 'M9', 'M10'))
    expect(r2.events.flatMap((e) => (e.type === 'unitAttacked' ? [e.attackerId] : []))).toEqual([s.id('N'), s.id('R')])
    expect(unitIn(r2.state, s.id('R'))).toMatchObject({ toughness: ROGUE.toughness - 1, stealthed: false })
    expect(unitIn(r2.state, s.id('N'))).toMatchObject({ toughness: ROGUE.toughness - 1, stealthed: false })
  })

  it('ends the move of a unit it kills, and wins on the enemy commander (ROG-7)', () => {
    const b = buildBattle({ south: [stealthed('M8')], north: ['commander@M11:C'], active: 'north' })
    const r = act(b.state, b.north, move(b, 'C', 'M10', 'M9'))
    expect(r.state.result).toMatchObject({ winner: b.south, reason: 'conquest' })
  })

  it('kills a commander stepping onto its goal row before it can win (X-04)', () => {
    const b = buildBattle({ south: ['commander@J4', stealthed('F1')], north: ['commander@E3:C'], active: 'north' })
    const r = act(b.state, b.north, move(b, 'C', 'E2', 'E1'))
    expect(r.state.result).toMatchObject({ winner: b.south, reason: 'conquest' })
  })

  it('goes through the full pipeline: the Keep, Defend and Line Formation (ROG-8, ROG-19, B26 under R31)', () => {
    const keep = buildBattle({ south: [stealthed('M8')], north: [{ type: 'soldier', at: 'M10', label: 'S', defending: true }], control: { keep: 'south' } })
    const r = act(keep.state, keep.south, move(keep, 'R', 'M9'))
    expect(unitIn(r.state, keep.id('S'))?.toughness).toBe(SOLDIER - Math.ceil((ROGUE.power + KEEP_POWER_BONUS) / 2))
    const line = buildBattle({ south: [stealthed('M8')], north: ['footman@M10:F', 'footman@L10', 'footman@N10'] })
    const r2 = act(line.state, line.south, move(line, 'R', 'M9'))
    expect(r2.events).toContainEqual(expect.objectContaining({ type: 'unitDamaged', unitId: line.id('F'), amount: ROGUE.power - LINE }))
  })

  it('costs nothing on its own turn: with a Command Aura action the Rogue may still attack (ROG-9)', () => {
    const b = buildBattle({ south: [stealthed('M8'), 'scourge@O9'], north: ['paladin@M10:P'] })
    const state = play(b.state, [
      [b.south, move(b, 'R', 'M9')],
      [b.south, { kind: 'attack', unitId: b.id('R'), target: { kind: 'unit', unitId: b.id('P') } }],
    ])
    expect(unitIn(state, b.id('P'))?.toughness).toBe(PALADIN - 2 * ASSAULT)
    expect(state.seats[b.south].ap).toBe(20 - 2 * ROGUE.ap)
  })

  it('strikes once per Stealth: after killing its target it stays hidden but no longer strikes (ROG-10)', () => {
    const b = buildBattle({ south: [stealthed('M8')], north: ['footman@M10:F', 'paladin@P8:P'], active: 'north' })
    const r = act(b.state, b.north, move(b, 'F', 'M9'))
    expect(unitIn(r.state, b.id('F'))).toBeUndefined()
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(true) // no enemy is left next to it (R1)
    const r2 = act(r.state, b.north, move(b, 'P', 'O8', 'N8'))
    expect(unitIn(r2.state, b.id('P'))).toMatchObject({ anchor: parseSquare('N8'), toughness: PALADIN })
    expect(unitIn(r2.state, b.id('R'))?.stealthed).toBe(false)
    expect(filterEvents(r2.events, b.north)).toContainEqual(expect.objectContaining({ type: 'moveEnded', unitId: b.id('P'), reason: 'completed' }))
  })

  it('re-arms with the next Stealth activation (ROG-3, ROG-10)', () => {
    const b = buildBattle({ south: [stealthed('M8')], north: ['footman@M10:F', 'paladin@P8:P'], active: 'north' })
    const state = play(b.state, [
      [b.north, move(b, 'F', 'M9')], // the Assault is spent on the Footman
      [b.north, move(b, 'P', 'O8', 'N8')], // revealed, no second Assault
      [b.north, { kind: 'endTurn' }],
      [b.south, move(b, 'R', 'L8', 'K8')], // out of the Paladin's LOV 2
      [b.south, { kind: 'endTurn' }],
      [b.north, { kind: 'endTurn' }],
      [b.south, stealth(b)],
      [b.south, { kind: 'endTurn' }],
    ])
    expect(unitIn(state, b.id('R'))?.stealthed).toBe(true)
    const r = act(state, b.north, move(b, 'P', 'M8', 'L8'))
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(PALADIN - ASSAULT)
  })

  it('stops a marching unit and a charge at the first adjacent step (ROG-17, R26, R27)', () => {
    const march = buildBattle({ south: [stealthed('M8')], north: ['footman@M10:A', 'footman@M11:B'], active: 'north' })
    const r = act(march.state, march.north, { kind: 'groupMarch', unitIds: [march.id('A'), march.id('B')], direction: 'south' })
    expect(unitIn(r.state, march.id('A'))).toBeUndefined() // stepped to M9 and was struck down
    expect(unitIn(r.state, march.id('B'))?.anchor).toEqual(parseSquare('M10'))

    // The Ranger shows the Soldier; the Paladin's charge passes next to the hidden Rogue at M9 and never attacks.
    const charge = buildBattle({ south: [stealthed('L9'), 'soldier@M8:S'], north: ['paladin@M11:P', 'ranger@P8'], active: 'north' })
    const c = act(charge.state, charge.north, { kind: 'charge', unitId: charge.id('P'), path: sqs('M10', 'M9'), target: { kind: 'unit', unitId: charge.id('S') } })
    expect(unitIn(c.state, charge.id('S'))?.toughness).toBe(SOLDIER)
    expect(unitIn(c.state, charge.id('P'))).toMatchObject({ anchor: parseSquare('M9'), toughness: PALADIN - ASSAULT, turn: expect.objectContaining({ basicAttack: false }) })
  })

  it('strikes a dummy that Mad inventor walks next to it: a cheap probe (X-28)', () => {
    const b = buildBattle({ south: [stealthed('M9')], north: ['artificer@M12:A', 'noAcb@M11:D'], active: 'north' })
    const r = act(b.state, b.north, move(b, 'D', 'M10'))
    expect(unitIn(r.state, b.id('D'))).toBeUndefined() // 7 damage on a 0/7 dummy
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(true)
  })

  it("can never strike a Mind's Eye unit or Ratasius: it is detected at distance 3 first (X-01, X-02, ROG-14)", () => {
    const b = buildBattle({ south: [stealthed('M6')], north: ['juliomancer@M11:J'] })
    const r = act(b.state, b.south, move(b, 'R', 'M7', 'M8'))
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(false)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitRevealed', unitId: b.id('R'), cause: 'detection', byId: b.id('J') })
    const next = play(r.state, [
      [b.south, { kind: 'endTurn' }],
      [b.north, { kind: 'endTurn' }],
      [b.south, move(b, 'R', 'M9', 'M10')],
    ])
    expect(unitIn(next, b.id('J'))?.toughness).toBe(unitDef('juliomancer').toughness)
    const later = play(next, [
      [b.south, { kind: 'endTurn' }],
      [b.north, { kind: 'endTurn' }],
    ])
    expect(validate(later, b.south, stealth(b))).toMatchObject({ ok: false, message: 'An enemy can see this unit' }) // ROG-14

    const rat = buildBattle({ south: [stealthed('M6')], north: ['commander@M11:C'], commanders: { north: 'ratasius' } })
    const r2 = act(rat.state, rat.south, move(rat, 'R', 'M7', 'M8'))
    expect(filterEvents(r2.events, rat.south)).toContainEqual({ type: 'unitRevealed', unitId: rat.id('R'), cause: 'detection', byId: rat.id('C') })
  })

  it("keeps the Rogue's Defend: a triggered attack does not cancel it (2.7)", () => {
    const b = buildBattle({ south: [{ ...stealthed('M8'), defending: true }], north: ['paladin@M11:P'], active: 'north' })
    const r = act(b.state, b.north, move(b, 'P', 'M10', 'M9'))
    expect(unitIn(r.state, b.id('R'))?.defending).toBe(true)
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(PALADIN - ASSAULT)
  })

  it('does nothing when the Rogue is not in stealth', () => {
    const b = buildBattle({ south: ['rogue@M8:R'], north: ['paladin@M11:P'], active: 'north' })
    const r = act(b.state, b.north, move(b, 'P', 'M10', 'M9', 'L9'))
    expect(unitIn(r.state, b.id('P'))).toMatchObject({ anchor: parseSquare('L9'), toughness: PALADIN })
  })
})
