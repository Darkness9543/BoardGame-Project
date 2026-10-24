// Every active ability cast through the battle UI's state machine (select, action, picks from clicks, confirm) and
// accepted by the real engine; plus the targeting checks the player sees before anything is sent.

import { describe, expect, it } from 'vitest'
import { ABILITY_DATA, apply, buildBattle, parseSquare, projectView, type ActionIntent, type BattleSpec, type GameState, type Seat } from '@coinduel/engine'
import { CONFIRM_GUARD_MS, IDLE, commandGate, reduceCommand, stepCandidates, type CommandContext, type CommandEvent, type CommandResult } from './command'

const sq = parseSquare

function ctxFor(state: GameState, seat: Seat, now = 1000): CommandContext {
  const view = projectView(state, seat)
  return { view, prefs: { confirmMode: 'always', mineWarning: true, autoSelectNext: false }, gate: commandGate(view, true), now }
}

function run(ctx: CommandContext, events: readonly CommandEvent[]): CommandResult {
  let result: CommandResult = { state: IDLE, effects: [] }
  for (const event of events) result = reduceCommand(result.state, event, ctx)
  return result
}

interface Case {
  readonly abilityId: string
  readonly battle: BattleSpec
  /** The acting unit's label. */
  readonly unit: string
  /** The clicks after choosing the ability, as squares or unit labels. */
  readonly picks: readonly ({ readonly square: string } | { readonly unit: string })[]
  /** Moves made before the cast (Savagery needs a basic Attack first). */
  readonly before?: (b: ReturnType<typeof buildBattle>) => readonly ActionIntent[]
}

const CASES: readonly Case[] = [
  {
    abilityId: 'berserker.savagery',
    battle: { south: ['berserker@E5:B'], north: ['paladin@E6:P'] },
    unit: 'B',
    picks: [{ unit: 'P' }],
    before: (b) => [{ kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('P') } }],
  },
  { abilityId: 'rogue.stealth', battle: { south: ['rogue@E5:R'] }, unit: 'R', picks: [] },
  {
    abilityId: 'priestess.sharedWounds',
    battle: { south: ['priestess@M10:P', { type: 'soldier', at: 'M11', label: 'S', toughness: 3 }] },
    unit: 'P',
    picks: [{ unit: 'P' }, { unit: 'S' }],
  },
  {
    abilityId: 'juliomancer.julioVernification',
    battle: { south: ['juliomancer@J5:J', 'footman@J6:F'], north: ['berserker@J7:B'] },
    unit: 'J',
    picks: [{ unit: 'F' }, { unit: 'B' }],
  },
  { abilityId: 'artificer.prototypeNoAcb', battle: { south: ['artificer@M10:A'] }, unit: 'A', picks: [{ square: 'M11' }] },
  { abilityId: 'artificer.tripMine', battle: { south: ['artificer@M10:A'] }, unit: 'A', picks: [{ square: 'M9' }] },
  {
    abilityId: 'royalWizard.forcefield',
    battle: { south: ['royalWizard@M10:W'] },
    unit: 'W',
    picks: [{ square: 'M11' }, { square: 'M12' }, { square: 'N12' }, { square: 'N11' }],
  },
  { abilityId: 'royalWizard.pajazon', battle: { south: ['royalWizard@M10:W'], north: ['soldier@M14'] }, unit: 'W', picks: [{ square: 'M13' }] },
  { abilityId: 'beast.forcefulSlam', battle: { south: ['beast@M10:X'], north: ['soldier@M12:S'] }, unit: 'X', picks: [{ unit: 'S' }] },
  { abilityId: 'beast.feast', battle: { south: [{ type: 'beast', at: 'M10', label: 'X', toughness: 20 }, 'footman@M12:F'] }, unit: 'X', picks: [{ unit: 'F' }] },
  { abilityId: 'emissary.holyBlessing', battle: { south: [{ type: 'emissary', at: 'M10', label: 'E', toughness: 30 }] }, unit: 'E', picks: [] },
  { abilityId: 'emissary.smite', battle: { south: ['emissary@M10:E'], north: ['paladin@M13:P'] }, unit: 'E', picks: [{ unit: 'P' }] },
  {
    abilityId: 'babaYaga.mend',
    battle: { south: [{ type: 'juliomancer', at: 'M10', label: 'F', toughness: 1 }], commanders: { south: 'babaYaga' }, variants: { south: 'mend' } },
    unit: 'F',
    picks: [],
  },
]

function pickEvent(b: ReturnType<typeof buildBattle>, pick: Case['picks'][number]): CommandEvent {
  return 'square' in pick ? { t: 'clickSquare', square: sq(pick.square), button: 'primary' } : { t: 'clickUnit', unitId: b.id(pick.unit), button: 'primary' }
}

describe('casting every active ability from the battle UI', () => {
  it('covers every active ability in the content table', () => {
    const active = ABILITY_DATA.filter((a) => a.kind === 'active').map((a) => a.id)
    expect(CASES.map((c) => c.abilityId).sort()).toEqual([...active].sort())
  })

  for (const c of CASES) {
    it(`${c.abilityId}: picks from clicks, a locked preview, then an intent the engine accepts`, () => {
      const b = buildBattle(c.battle)
      let state = b.state
      for (const intent of c.before?.(b) ?? []) {
        const result = apply(state, b.south, intent)
        if (!result.ok) throw new Error(result.message)
        state = result.state
      }
      const ctx = ctxFor(state, b.south)
      const picked = run(ctx, [
        { t: 'clickUnit', unitId: b.id(c.unit), button: 'primary' },
        { t: 'action', action: { kind: 'ability', abilityId: c.abilityId } },
        ...c.picks.map((p) => pickEvent(b, p)),
      ])
      expect(picked.state.t, JSON.stringify(picked.effects)).toBe('confirming')
      const sent = reduceCommand(picked.state, { t: 'confirm' }, { ...ctx, now: ctx.now + CONFIRM_GUARD_MS + 1 })
      const effect = sent.effects.find((e) => e.t === 'send')
      if (effect?.t !== 'send') throw new Error(`nothing sent: ${JSON.stringify(sent.effects)}`)
      expect(effect.intent).toMatchObject({ kind: 'useAbility', unitId: b.id(c.unit), abilityId: c.abilityId })
      const result = apply(state, b.south, effect.intent)
      expect(result.ok ? 'ok' : result.message).toBe('ok')
    })
  }
})

describe('targeting checks before anything is sent', () => {
  it('Shared wounds: once the donor is picked it is no longer offered as the recipient', () => {
    const b = buildBattle({ south: ['priestess@M10:P', 'soldier@M11:S'] })
    const ctx = ctxFor(b.state, b.south)
    const r = run(ctx, [
      { t: 'clickUnit', unitId: b.id('P'), button: 'primary' },
      { t: 'action', action: { kind: 'ability', abilityId: 'priestess.sharedWounds' } },
      { t: 'clickUnit', unitId: b.id('S'), button: 'primary' },
      { t: 'clickUnit', unitId: b.id('S'), button: 'primary' },
    ])
    expect(r.state.t).toBe('targeting')
    expect(r.effects).toEqual([{ t: 'hint', text: 'Not a valid target for this step' }])
    if (r.state.t !== 'targeting') throw new Error('not targeting')
    expect(stepCandidates(ctx.view, r.state)).toEqual([{ kind: 'unit', unitId: b.id('P') }])
  })

  it('Smite on an own unit (R14) is offered but always asks first', () => {
    const b = buildBattle({ south: ['emissary@M10:E', 'soldier@M12:S'], north: ['paladin@M13:P'] })
    const ctx = { ...ctxFor(b.state, b.south), prefs: { confirmMode: 'never' as const, mineWarning: true, autoSelectNext: false } }
    const r = run(ctx, [
      { t: 'clickUnit', unitId: b.id('E'), button: 'primary' },
      { t: 'action', action: { kind: 'ability', abilityId: 'emissary.smite' } },
      { t: 'clickUnit', unitId: b.id('S'), button: 'primary' },
    ])
    expect(r.state.t).toBe('confirming')
  })

  it('Trip mine refuses a square that is not free, with the reason on the hint line', () => {
    const b = buildBattle({ south: ['artificer@M10:A', 'footman@M11:F'] })
    const ctx = ctxFor(b.state, b.south)
    const r = run(ctx, [
      { t: 'clickUnit', unitId: b.id('A'), button: 'primary' },
      { t: 'action', action: { kind: 'ability', abilityId: 'artificer.tripMine' } },
      { t: 'clickSquare', square: sq('M11'), button: 'primary' },
    ])
    expect(r.state.t).toBe('targeting')
    expect(r.effects).toEqual([{ t: 'hint', text: 'Not a valid square for this step' }])
  })

  it('Forceful slam on a Size-2 enemy takes the square of it that touches the Beast', () => {
    const b = buildBattle({ south: ['beast@M10:X'], north: ['beast@O9:Y'] })
    const ctx = ctxFor(b.state, b.south)
    const r = run(ctx, [
      { t: 'clickUnit', unitId: b.id('X'), button: 'primary' },
      { t: 'action', action: { kind: 'ability', abilityId: 'beast.forcefulSlam' } },
      { t: 'clickUnit', unitId: b.id('Y'), button: 'primary' },
    ])
    expect(r.state.t === 'confirming' && r.state.intent).toMatchObject({ targets: [{ kind: 'square', square: sq('O10') }] })
  })

  it('Savagery stays disabled until the Berserker has attacked this turn', () => {
    const b = buildBattle({ south: ['berserker@E5:B'], north: ['paladin@E6:P'] })
    const ctx = ctxFor(b.state, b.south)
    const r = run(ctx, [
      { t: 'clickUnit', unitId: b.id('B'), button: 'primary' },
      { t: 'action', action: { kind: 'ability', abilityId: 'berserker.savagery' } },
    ])
    expect(r.state.t).toBe('selected')
    expect(r.effects).toEqual([{ t: 'hint', text: 'Savagery follows a basic Attack by this Berserker this turn' }])
  })
})
