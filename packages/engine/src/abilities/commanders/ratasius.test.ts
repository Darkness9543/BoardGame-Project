import { describe, expect, it } from 'vitest'
import { RATASIUS_WEAKNESS } from '../../constants'
import { abilityParam } from '../../content/abilities'
import type { GameEvent } from '../../events'
import { adjacentSquares, area3x3, parseSquare, sameSquare, slamSplash } from '../../geometry'
import { previewAttack } from '../../preview'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import type { UnitId } from '../../types'
import { filterEvents, isVisibleSquare, projectView } from '../../view'
import { registerAbility } from '../registry'

// Test-local stand-ins for other agents' stubs: Smite with its R25 splash, Forceful slam (A8-20), an enemy Pajazon tick
// (A8-19) and Assault (A8-07: a stealthed Rogue attacks an enemy that comes adjacent through a step).
registerAbility(
  {
    id: 'emissary.smite',
    status: 'implemented',
    active: {
      targets: [{ kind: 'unit', label: 'Target', range: 3, relation: 'harmful', includeSelf: false, allowCommander: true }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        const target = t?.kind === 'unit' ? ctx.unit(t.unitId) : undefined
        if (target?.anchor == null) return
        const squares = adjacentSquares(target.anchor, ctx.sizeOf(target), 'ORTHO_4')
        ctx.dealSplash({ source: 'emissary.smite', dealer: unit, target, damage: abilityParam('emissary.smite', 'damage'), squares, splash: abilityParam('emissary.smite', 'splash'), friendlyFire: true })
      },
    },
  },
  { replace: true },
)
registerAbility(
  {
    id: 'beast.forcefulSlam',
    status: 'implemented',
    active: {
      targets: [{ kind: 'square', label: 'Target', minRange: 1, range: 1, free: false }],
      resolve: (ctx, unit, targets) => {
        const t = targets[0]
        if (t?.kind !== 'square' || unit.anchor === null) return
        const squares = slamSplash(unit.anchor, ctx.sizeOf(unit), t.square)
        ctx.dealSplash({ source: 'beast.forcefulSlam', dealer: unit, target: ctx.unitAt(t.square) ?? null, damage: abilityParam('beast.forcefulSlam', 'damage'), squares, splash: abilityParam('beast.forcefulSlam', 'splash'), friendlyFire: true })
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
registerAbility(
  {
    id: 'rogue.assault',
    status: 'implemented',
    onAdjacencyGained: (ctx, holder, info) => {
      if (!holder.stealthed) return
      const target = info.holderIsMover ? info.enemies[0] : info.step.mover
      if (target === undefined) return
      ctx.attack(holder, { kind: 'unit', unitId: target.id }, { source: 'rogue.assault', triggered: true })
      return 'interrupt'
    },
  },
  { replace: true },
)

function damageTo(events: readonly GameEvent[], unitId: UnitId): number | undefined {
  const hit = events.find((e) => e.type === 'unitDamaged' && e.unitId === unitId)
  return hit?.type === 'unitDamaged' ? hit.amount : undefined
}

function weakened(events: readonly GameEvent[], unitId: UnitId): boolean {
  const hit = events.find((e) => e.type === 'unitDamaged' && e.unitId === unitId)
  return hit?.type === 'unitDamaged' && hit.breakdown.some((s) => s.step === 'subtraction' && s.source === 'ratasius.great' && s.delta === -RATASIUS_WEAKNESS)
}

describe('ratasius.great: LOV and detection (7.8, A7-14, A4-08, A4-11)', () => {
  it('has LOV 6 (content data): he sees 6 squares away, not 7', () => {
    const b = buildBattle({ south: ['commander@M3:R'], commanders: { south: 'ratasius' } })
    const view = projectView(b.state, b.south)
    expect(view.units.find((u) => u.id === b.id('R'))?.lov).toBe(6)
    expect([isVisibleSquare(view, parseSquare('M9')), isVisibleSquare(view, parseSquare('M10'))]).toEqual([true, false])
  })

  it('reveals stealthed enemy units within range 3, not 4, state-based as he moves', () => {
    const b = buildBattle({
      south: ['commander@M3:R'],
      north: [{ type: 'rogue', at: 'M6', label: 'IN', stealthed: true }, { type: 'rogue', at: 'Q3', label: 'OUT', stealthed: true }],
      commanders: { south: 'ratasius' },
    })
    expect([unitIn(b.state, b.id('IN'))?.stealthed, unitIn(b.state, b.id('OUT'))?.stealthed]).toEqual([false, true])
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('R'), path: sqs('N3') })
    expect(unitIn(r.state, b.id('OUT'))?.stealthed).toBe(false)
    for (const seat of [b.south, b.north]) {
      expect(filterEvents(r.events, seat)).toContainEqual(expect.objectContaining({ type: 'unitRevealed', unitId: b.id('OUT'), cause: 'detection' }))
    }
  })

  it('reveals enemy mines within range 3, not 4 (MINDS_EYE_REVEALS_MINES)', () => {
    const b = buildBattle({
      south: ['commander@M3:R'],
      mines: [{ owner: 'north', at: 'M6', label: 'IN' }, { owner: 'north', at: 'M7', label: 'OUT' }],
      commanders: { south: 'ratasius' },
    })
    const revealed = (state: typeof b.state) => state.mines.map((m) => [m.id, m.revealed])
    expect(revealed(b.state)).toEqual([[b.mineIds['IN'], true], [b.mineIds['OUT'], false]])
    expect(projectView(b.state, b.south).mines.map((m) => m.id)).toEqual([b.mineIds['IN']])
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('R'), path: sqs('M4') })
    expect(revealed(r.state)).toEqual([[b.mineIds['IN'], true], [b.mineIds['OUT'], true]])
    expect(filterEvents(r.events, b.north)).toContainEqual({ type: 'mineRevealed', mineId: b.mineIds['OUT'], owner: b.north, square: parseSquare('M7') })
  })

  it('can never be Assaulted by a stealthed Rogue (RAT-6, X-02): the Rogue is revealed at distance 3', () => {
    const walk = (commander: 'ratasius' | 'baseline') => {
      const b = buildBattle({ south: ['commander@M3:R'], north: [{ type: 'rogue', at: 'M8', label: 'RO', stealthed: true }], commanders: { south: commander } })
      let state = act(b.state, b.south, { kind: 'move', unitId: b.id('R'), path: sqs('M4', 'M5') }).state
      state = act(act(state, b.south, { kind: 'endTurn' }).state, b.north, { kind: 'endTurn' }).state
      return { b, state: act(state, b.south, { kind: 'move', unitId: b.id('R'), path: sqs('M6', 'M7') }).state }
    }
    const ratasius = walk('ratasius')
    expect(unitIn(ratasius.state, ratasius.b.id('R'))?.toughness).toBe(5)
    expect(ratasius.state.result).toBeNull()
    const plain = walk('baseline') // control: the same walk ends in an Assault for 7
    expect(plain.state.result).toMatchObject({ winner: plain.b.north, reason: 'conquest' })
  })
})

describe('ratasius.great: weakness (7.8, A7-14; floor 1 under R13, range 1 under R41)', () => {
  it.each([
    ['footman', 1],
    ['soldier', 1],
    ['rogue', 3], // B9 (Ratasius is 1/5 under R8)
    ['berserker', 4],
  ] as const)('an adjacent enemy %s deals 4 less to him, never below 1 (B8)', (type, dealt) => {
    const b = buildBattle({ south: ['commander@M3:R'], north: [`${type}@M4:A`], commanders: { south: 'ratasius' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('A'), target: { kind: 'unit', unitId: b.id('R') } })
    expect(damageTo(r.events, b.id('R'))).toBe(dealt)
    expect(unitIn(r.state, b.id('R'))?.toughness).toBe(5 - dealt)
    expect(weakened(r.events, b.id('R'))).toBe(true)
  })

  it('cuts the damage the enemy deals to every target, not only to him (RAT-2)', () => {
    const b = buildBattle({ south: ['commander@M3:R', 'soldier@N4:S'], north: ['berserker@M4:B'], commanders: { south: 'ratasius' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7 - 4)
  })

  it('lasts only while the enemy is within range 1 (RAT-1: an aura, no lingering status)', () => {
    const b = buildBattle({ south: ['commander@M3:R', 'soldier@M5:S'], north: ['berserker@M6:B'], commanders: { south: 'ratasius' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(damageTo(r.events, b.id('S'))).toBe(8)
    expect(weakened(r.events, b.id('S'))).toBe(false)
  })

  it('is judged where the dealer stands when the damage resolves (Charge, R26)', () => {
    const away = buildBattle({ south: ['commander@M3:R', 'paladin@O4:P'], north: ['rogue@M4:A'], commanders: { south: 'ratasius' }, active: 'north' })
    const r1 = act(away.state, away.north, { kind: 'charge', unitId: away.id('A'), path: sqs('N4'), target: { kind: 'unit', unitId: away.id('P') } })
    expect(damageTo(r1.events, away.id('P'))).toBe(7 - 2) // left his side first: only Reinforced Armor applies
    const into = buildBattle({ south: ['commander@M3:R', 'soldier@L4:S'], north: ['rogue@M5:A'], commanders: { south: 'ratasius' }, active: 'north' })
    const r2 = act(into.state, into.north, { kind: 'charge', unitId: into.id('A'), path: sqs('M4'), target: { kind: 'unit', unitId: into.id('S') } })
    expect(damageTo(r2.events, into.id('S'))).toBe(7 - 4)
  })

  it('never weakens his own units', () => {
    const b = buildBattle({ south: ['commander@M3:R', 'berserker@M4:B'], north: ['soldier@M5:S'], commanders: { south: 'ratasius' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(damageTo(r.events, b.id('S'))).toBe(8)
  })

  it('applies before Defend halves (C3): 8 - 4 = 4, then 2', () => {
    const b = buildBattle({
      south: ['commander@M3:R', { type: 'soldier', at: 'N4', label: 'S', defending: true }],
      north: ['berserker@M4:B'],
      commanders: { south: 'ratasius' },
      active: 'north',
    })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7 - 2)
  })

  it('reaches a Size-2 Beast through any of its squares (RAT-5)', () => {
    const b = buildBattle({ south: ['commander@M3:R', 'soldier@P3:S'], north: ['beast@N2:BEAST'], commanders: { south: 'ratasius' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('BEAST'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(damageTo(r.events, b.id('S'))).toBe(20 - 4)
  })

  it('weakens instant ability damage: Smite and each splash instance (B11; R25 splash floored at 1 by R13)', () => {
    const b = buildBattle({ south: ['commander@M3:R', 'soldier@M6:T', 'footman@N6:F'], north: ['emissary@M4:E'], commanders: { south: 'ratasius' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('E'), abilityId: 'emissary.smite', targets: [{ kind: 'unit', unitId: b.id('T') }] })
    expect(damageTo(r.events, b.id('T'))).toBe(8 - 4)
    expect(damageTo(r.events, b.id('F'))).toBe(1)
  })

  it('X-32 / B15: a Forceful slam from a Beast at his side deals 6 on the target and 1 on the splash (R13)', () => {
    const b = buildBattle({ south: ['commander@M3:R', 'soldier@P3:T', 'footman@P4:F'], north: ['beast@N2:BEAST'], commanders: { south: 'ratasius' }, active: 'north' })
    const r = act(b.state, b.north, { kind: 'useAbility', unitId: b.id('BEAST'), abilityId: 'beast.forcefulSlam', targets: [{ kind: 'square', square: parseSquare('P3') }] })
    expect(damageTo(r.events, b.id('T'))).toBe(10 - 4)
    expect(damageTo(r.events, b.id('F'))).toBe(1)
  })

  it('never weakens Pajazon ticks or mines, whoever stands next to him (RAT-3, X-22, B21)', () => {
    const tick = buildBattle({ south: ['commander@M3:R', 'soldier@P8:S'], north: ['royalWizard@M4:W'], commanders: { south: 'ratasius' } })
    tick.state.areas.push({ id: 'a-r', abilityId: 'royalWizard.pajazon', owner: tick.north, sourceId: tick.id('W'), squares: area3x3(parseSquare('P8')), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 90, data: {} })
    expect(damageTo(act(tick.state, tick.south, { kind: 'endTurn' }).events, tick.id('S'))).toBe(3)

    const mine = buildBattle({ south: ['commander@M3:R', 'soldier@P9:S'], north: ['artificer@M4:A'], commanders: { south: 'ratasius' }, mines: [{ owner: 'north', at: 'P8' }] })
    const placed = mine.state.mines[0]
    if (placed !== undefined) placed.placedBy = mine.id('A')
    expect(unitIn(act(mine.state, mine.south, { kind: 'move', unitId: mine.id('S'), path: sqs('P8') }).state, mine.id('S'))?.toughness).toBe(7 - 5)
  })

  it("shows in the attacker's damage preview, from the attacker's knowledge", () => {
    const b = buildBattle({ south: ['commander@M3:R'], north: ['berserker@M4:B'], commanders: { south: 'ratasius' }, active: 'north' })
    const preview = previewAttack(projectView(b.state, b.north), b.id('B'), b.id('R'))
    expect(preview?.amount).toBe(4)
    expect(preview?.breakdown).toContainEqual({ step: 'subtraction', source: 'ratasius.great', delta: -4, total: 4 })
  })
})
