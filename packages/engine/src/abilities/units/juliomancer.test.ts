import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate, type Intent } from '../../commands'
import { KEEP_POWER_BONUS, RATASIUS_WEAKNESS, RATASIUS_WEAKNESS_RANGE } from '../../constants'
import { abilityData, abilityParam } from '../../content/abilities'
import { unitDef } from '../../content/units'
import { parseSquare } from '../../geometry'
import { legalActions } from '../../preview'
import { act, buildBattle, sqs, unitIn, type Battle } from '../../testing/dsl'
import { findLeaks } from '../../testing/fogLeak'
import { SEATS } from '../../types'
import { filterEvents, projectView } from '../../view'

const CAP = abilityParam('juliomancer.julioVernification', 'cap')
const COST = abilityData('juliomancer.julioVernification').apCost
const ARMOR = abilityParam('paladin.reinforcedArmor', 'reduction')
const SOLDIER = unitDef('soldier').toughness
const EMISSARY = unitDef('emissary').toughness

// Test-local stand-ins: Kulega's +1 LOV and a Fine Print that only reports deaths, and Ratasius' weakness (R13, R41).
registerAbility({ id: 'kulega.finePrinter', status: 'implemented', modifyStats: (_q, holder, target) => (target.owner === holder.owner ? { lov: 1 } : null) }, { replace: true })
registerAbility(
  {
    id: 'kulega.finePrint',
    status: 'implemented',
    onUnitDied: (ctx, holder, death) => ctx.emit({ type: 'abilityNote', unitId: holder.id, abilityId: 'kulega.finePrint', note: `saw ${death.unit.id}` }, [holder.owner]),
  },
  { replace: true },
)
registerAbility(
  {
    id: 'ratasius.great',
    status: 'implemented',
    attackerSubtraction: (q, holder, hit) => (hit.dealer !== null && hit.dealer.owner !== holder.owner && q.distance(holder, hit.dealer) <= RATASIUS_WEAKNESS_RANGE ? RATASIUS_WEAKNESS : 0),
  },
  { replace: true },
)

const julio = (b: Battle, sacrifice: string, target: string, unit = 'J'): Intent => ({
  kind: 'useAbility',
  unitId: b.id(unit),
  abilityId: 'juliomancer.julioVernification',
  targets: [
    { kind: 'unit', unitId: b.id(sacrifice) },
    { kind: 'unit', unitId: b.id(target) },
  ],
})

const stealthed = (at: string, label: string) => ({ type: 'rogue' as const, at, label, stealthed: true })

describe("juliomancer.mindsEye (8.8, A8-10, 4.6)", () => {
  it('reveals enemy stealthed units inside its LOV, not beyond (A4-08)', () => {
    const b = buildBattle({ south: ['juliomancer@M8:J'], north: [stealthed('M12', 'R')] })
    expect(unitIn(b.state, b.id('R'))?.stealthed).toBe(true) // distance 4
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('J'), path: sqs('M9') })
    expect(unitIn(r.state, b.id('R'))?.stealthed).toBe(false)
    expect(filterEvents(r.events, b.north)).toContainEqual({ type: 'unitRevealed', unitId: b.id('R'), cause: 'detection', byId: b.id('J') })
    expect(projectView(r.state, b.south).units.some((u) => u.id === b.id('R'))).toBe(true)
    for (const seat of SEATS) expect(findLeaks(r.state, seat)).toEqual([])
  })

  it("works on the opponent's turn too: a stealthed Rogue walking into its LOV is revealed", () => {
    const b = buildBattle({ south: ['juliomancer@M8:J'], north: [stealthed('M13', 'R')], active: 'north' })
    const r = act(b.state, b.north, { kind: 'move', unitId: b.id('R'), path: sqs('M12', 'M11') })
    expect(unitIn(r.state, b.id('R'))).toMatchObject({ anchor: parseSquare('M11'), stealthed: false })
  })

  it('reveals enemy mines in its LOV, and they stay revealed (A4-11, JUL-1)', () => {
    const b = buildBattle({ south: ['juliomancer@M8:J'], north: ['footman@A12'], mines: [{ owner: 'north', at: 'M11', label: 'near' }, { owner: 'north', at: 'M12', label: 'far' }] })
    const revealed = (state: typeof b.state) => state.mines.filter((m) => m.revealed).map((m) => m.id)
    expect(revealed(b.state)).toEqual([b.mineIds['near']])
    expect(projectView(b.state, b.south).mines.map((m) => m.id)).toEqual([b.mineIds['near']])
    const closer = act(b.state, b.south, { kind: 'move', unitId: b.id('J'), path: sqs('M9') }).state
    expect(revealed(closer)).toEqual([b.mineIds['near'], b.mineIds['far']])
    const back = act(act(act(closer, b.south, { kind: 'endTurn' }).state, b.north, { kind: 'endTurn' }).state, b.south, { kind: 'move', unitId: b.id('J'), path: sqs('M8') }).state
    expect(revealed(back)).toEqual([b.mineIds['near'], b.mineIds['far']])
    for (const seat of SEATS) expect(findLeaks(back, seat)).toEqual([])
  })

  it('never reveals its own side', () => {
    const b = buildBattle({ south: ['juliomancer@M8:J', stealthed('M9', 'R')], mines: [{ owner: 'south', at: 'M10' }] })
    expect(unitIn(b.state, b.id('R'))?.stealthed).toBe(true)
    expect(b.state.mines[0]?.revealed).toBe(false)
  })

  it('tells the Rogue owner of the reveal, and names the detector only if it can see it (A4-10)', () => {
    // Under Kulega the Juliomancer sees 4 squares; the Rogue (LOV 3) can't see it back.
    const b = buildBattle({ south: ['juliomancer@M8:J'], north: [stealthed('M12', 'R')], commanders: { south: 'kulega' } })
    expect(unitIn(b.state, b.id('R'))?.stealthed).toBe(false)
    const fresh = buildBattle({ south: ['juliomancer@M7:J'], north: [stealthed('M12', 'R')], commanders: { south: 'kulega' } })
    const r = act(fresh.state, fresh.south, { kind: 'move', unitId: fresh.id('J'), path: sqs('M8') })
    expect(filterEvents(r.events, fresh.north)).toContainEqual({ type: 'unitRevealed', unitId: fresh.id('R'), cause: 'detection', byId: null })
    expect(filterEvents(r.events, fresh.south)).toContainEqual({ type: 'unitRevealed', unitId: fresh.id('R'), cause: 'detection', byId: fresh.id('J') })
  })
})

describe('juliomancer.julioVernification (8.8, A8-11; owner rulings R14 and R22)', () => {
  it("sacrifices an adjacent own unit and deals its current toughness as ability damage within range 2, for 2 AP and the action", () => {
    const b = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S'], north: ['emissary@M10:E'] })
    const r = act(b.state, b.south, julio(b, 'S', 'E'))
    expect(unitIn(r.state, b.id('S'))).toBeUndefined()
    expect(unitIn(r.state, b.id('E'))?.toughness).toBe(EMISSARY - SOLDIER)
    expect(r.state.seats[b.south].ap).toBe(20 - (COST as number))
    expect(unitIn(r.state, b.id('J'))?.turn.actionsUsed).toBe(1)
    const mine = filterEvents(r.events, b.south)
    expect(mine).toContainEqual(expect.objectContaining({ type: 'unitDied', unitId: b.id('S'), cause: 'sacrifice' }))
    expect(mine).toContainEqual(expect.objectContaining({ type: 'unitDamaged', unitId: b.id('E'), kind: 'ability', source: 'juliomancer.julioVernification', dealerId: b.id('J') }))
  })

  it('caps the damage at 15 (R22): a Paladin or a Beast deals 15 (X-06, JUL-5, JUL-8, B22)', () => {
    const paladin = buildBattle({ south: ['juliomancer@M8:J', 'paladin@L8:K'], north: ['emissary@M10:E'] })
    expect(unitIn(act(paladin.state, paladin.south, julio(paladin, 'K', 'E')).state, paladin.id('E'))?.toughness).toBe(EMISSARY - CAP)
    const beast = buildBattle({ south: ['juliomancer@M8:J', 'beast@N7:B'], north: ['emissary@M10:E'] }) // N8 touches the Juliomancer
    const r = act(beast.state, beast.south, julio(beast, 'B', 'E'))
    expect(unitIn(r.state, beast.id('B'))).toBeUndefined()
    expect(unitIn(r.state, beast.id('E'))?.toughness).toBe(EMISSARY - CAP)
    expect(CAP).toBe(15)
  })

  it('uses current toughness, auras included: a hurt Soldier deals 3, a dummy next to a Priestess 8 (3.9, X-05)', () => {
    const hurt = buildBattle({ south: ['juliomancer@M8:J', { type: 'soldier', at: 'M7', label: 'S', toughness: 3 }], north: ['emissary@M10:E'] })
    expect(unitIn(act(hurt.state, hurt.south, julio(hurt, 'S', 'E')).state, hurt.id('E'))?.toughness).toBe(EMISSARY - 3)
    const dummy = buildBattle({ south: ['juliomancer@M8:J', 'noAcb@M7:D', 'priestess@L7'], north: ['emissary@M10:E'] })
    expect(unitIn(dummy.state, dummy.id('D'))?.toughness).toBe(unitDef('noAcb').toughness + 1)
    expect(unitIn(act(dummy.state, dummy.south, julio(dummy, 'D', 'E')).state, dummy.id('E'))?.toughness).toBe(EMISSARY - (unitDef('noAcb').toughness + 1))
  })

  it('may target one of its own units (R14) and the enemy commander, winning the game', () => {
    const own = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S', 'paladin@M9:T'] })
    expect(unitIn(act(own.state, own.south, julio(own, 'S', 'T')).state, own.id('T'))?.toughness).toBe(unitDef('paladin').toughness - (SOLDIER - ARMOR))
    const commander = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S'], north: ['commander@M10:C'] })
    expect(act(commander.state, commander.south, julio(commander, 'S', 'C')).state.result).toMatchObject({ winner: commander.south, reason: 'conquest' })
  })

  it('never sacrifices itself, an enemy or a commander, and never targets the sacrificed unit or itself (JUL-2)', () => {
    const b = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S', 'commander@L8:C'], north: ['footman@N8:F', 'emissary@M10:E'] })
    expect(validate(b.state, b.south, julio(b, 'J', 'E'))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(validate(b.state, b.south, julio(b, 'F', 'E'))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(validate(b.state, b.south, julio(b, 'C', 'E'))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(validate(b.state, b.south, julio(b, 'S', 'S'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
    expect(validate(b.state, b.south, julio(b, 'S', 'J'))).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(validate(b.state, b.south, julio(b, 'S', 'F')).ok).toBe(true)
  })

  it('measures both ranges from the Juliomancer: the sacrifice adjacent, the target within 2 (JUL-9, Q88)', () => {
    const b = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S', 'soldier@M6:FAR'], north: ['emissary@M10:A', 'emissary@L6:B'] })
    expect(validate(b.state, b.south, julio(b, 'S', 'A')).ok).toBe(true) // 2 from the Juliomancer, 3 from the Soldier
    expect(validate(b.state, b.south, julio(b, 'S', 'B'))).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' }) // 3 from the Juliomancer
    expect(validate(b.state, b.south, julio(b, 'FAR', 'A'))).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
  })

  it('needs a visible target: an unseen unit cannot be named, a detected Rogue can (JUL-3)', () => {
    const b = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S'], north: ['footman@M12:F', stealthed('N9', 'R')] })
    expect(validate(b.state, b.south, julio(b, 'S', 'F'))).toMatchObject({ ok: false, code: 'INVALID_TARGET' }) // out of sight
    expect(unitIn(b.state, b.id('R'))?.stealthed).toBe(false) // Mind's Eye covers the whole reach
    expect(validate(b.state, b.south, julio(b, 'S', 'R')).ok).toBe(true)
  })

  it('is reduced normally by Armor and Defend, never raised by the Keep (JUL-6, 3.2, X-15)', () => {
    const keep = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S'], north: ['paladin@M10:P'], control: { keep: 'south' } })
    const r = act(keep.state, keep.south, julio(keep, 'S', 'P'))
    expect(KEEP_POWER_BONUS).toBeGreaterThan(0)
    expect(unitIn(r.state, keep.id('P'))?.toughness).toBe(unitDef('paladin').toughness - (SOLDIER - ARMOR)) // no Keep bonus
    const defend = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S'], north: [{ type: 'emissary', at: 'M10', label: 'E', defending: true }] })
    expect(unitIn(act(defend.state, defend.south, julio(defend, 'S', 'E')).state, defend.id('E'))?.toughness).toBe(EMISSARY - Math.ceil(SOLDIER / 2))
  })

  it("has the Juliomancer as the dealer: next to an enemy Ratasius it deals 4 less (JUL-6, B23)", () => {
    const b = buildBattle({ south: ['juliomancer@M8:J', 'noAcb@M7:D'], north: ['commander@N8:R', 'emissary@M10:E'], commanders: { north: 'ratasius' } })
    expect(unitIn(act(b.state, b.south, julio(b, 'D', 'E')).state, b.id('E'))?.toughness).toBe(EMISSARY - (unitDef('noAcb').toughness - RATASIUS_WEAKNESS))
  })

  it('counts the sacrifice as a death whose triggers run after the damage (JUL-4, JUL-7, A3-13)', () => {
    const b = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S', 'paladin@L9:K'], north: ['emissary@M10:E'], commanders: { south: 'kulega' } })
    const events = filterEvents(act(b.state, b.south, julio(b, 'S', 'E')).events, b.south)
    const damaged = events.findIndex((e) => e.type === 'unitDamaged' && e.unitId === b.id('E'))
    const trigger = events.findIndex((e) => e.type === 'abilityNote' && e.note === `saw ${b.id('S')}`)
    expect(damaged).toBeGreaterThanOrEqual(0)
    expect(trigger).toBeGreaterThan(damaged)
  })

  it('shows on the action bar when both picks have candidates', () => {
    const b = buildBattle({ south: ['juliomancer@M8:J', 'soldier@M7:S'], north: ['emissary@M10:E'] })
    expect(legalActions(projectView(b.state, b.south), b.id('J')).find((o) => o.abilityId === 'juliomancer.julioVernification')).toMatchObject({ enabled: true, cost: COST })
    const alone = buildBattle({ south: ['juliomancer@M8:J'], north: ['emissary@M10:E'] })
    expect(legalActions(projectView(alone.state, alone.south), alone.id('J')).find((o) => o.abilityId === 'juliomancer.julioVernification')).toMatchObject({ enabled: false })
  })
})
