import { describe, expect, it } from 'vitest'
import { act, buildBattle, parseSquare, projectView, type GameState, type Seat } from '@coinduel/engine'
import {
  CONFIRM_GUARD_MS,
  IDLE,
  commandGate,
  reduceCommand,
  type CommandContext,
  type CommandEvent,
  type CommandPrefs,
  type CommandResult,
  type CommandState,
} from './command'

const sq = parseSquare

function ctxFor(state: GameState, seat: Seat, prefs: Partial<CommandPrefs> = {}, now = 1000): CommandContext {
  const view = projectView(state, seat)
  return { view, prefs: { confirmMode: 'always', mineWarning: true, autoSelectNext: false, ...prefs }, gate: commandGate(view, true), now }
}

function run(state: CommandState, ctx: CommandContext, ...events: CommandEvent[]): CommandResult {
  let result: CommandResult = { state, effects: [] }
  for (const event of events) result = reduceCommand(result.state, event, ctx)
  return result
}

const later = (ctx: CommandContext, ms = CONFIRM_GUARD_MS + 50): CommandContext => ({ ...ctx, now: ctx.now + ms })

function basic() {
  return buildBattle({
    south: ['footman@E5:F', 'footman@C5:F2', 'footman@D5:F3', 'paladin@G5:P'],
    north: ['berserker@E6:B', 'soldier@I5:S'],
    mines: [{ owner: 'south', at: 'F5' }],
  })
}

describe('state machine A: move', () => {
  it('select, steer, lock, confirm with the same square, ack -> idle (23.6 #1)', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const selected = run(IDLE, ctx, { t: 'clickUnit', unitId: b.id('F'), button: 'primary' })
    expect(selected.state).toEqual({ t: 'selected', unitId: b.id('F'), trail: [] })
    const steered = run(selected.state, ctx, { t: 'hoverSquare', square: sq('E4') })
    expect(steered.state.t === 'selected' && steered.state.trail).toEqual([sq('E4')])
    const locked = run(steered.state, ctx, { t: 'clickSquare', square: sq('E4'), button: 'primary' })
    expect(locked.state.t).toBe('confirming')
    expect(locked.effects).toEqual([])
    const sent = run(locked.state, later(ctx), { t: 'clickSquare', square: sq('E4'), button: 'primary' })
    expect(sent.state.t).toBe('submitting')
    expect(sent.effects).toEqual([{ t: 'send', intent: { kind: 'move', unitId: b.id('F'), path: [sq('E4')] } }])

    const after = act(b.state, b.south, { kind: 'move', unitId: b.id('F'), path: [sq('E4')] })
    const acked = run(sent.state, ctxFor(after.state, b.south), { t: 'ack' })
    expect(acked.state).toEqual(IDLE)
  })

  it('pops the trail when the pointer goes back and Backspace removes the last step', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const r = run(
      { t: 'selected', unitId: b.id('P'), trail: [] },
      ctx,
      { t: 'hoverSquare', square: sq('G4') },
      { t: 'hoverSquare', square: sq('H4') },
      { t: 'hoverSquare', square: sq('H3') },
    )
    expect(r.state.t === 'selected' && r.state.trail).toEqual([sq('G4'), sq('H4'), sq('H3')])
    const popped = run(r.state, ctx, { t: 'hoverSquare', square: sq('H4') })
    expect(popped.state.t === 'selected' && popped.state.trail).toEqual([sq('G4'), sq('H4')])
    const backspace = run(popped.state, ctx, { t: 'back' })
    expect(backspace.state.t === 'selected' && backspace.state.trail).toEqual([sq('G4')])
  })

  it('a path into an own mine asks first; Cancel goes back to the preview (23.6 #4)', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const locked = run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'clickSquare', square: sq('F5'), button: 'primary' })
    expect(locked.state.t).toBe('confirming')
    const prompt = run(locked.state, later(ctx), { t: 'confirm' })
    expect(prompt.state.t).toBe('hazard')
    expect(prompt.state.t === 'hazard' && prompt.state.hazards).toEqual([sq('F5')])
    const cancelled = run(prompt.state, later(ctx), { t: 'hazardCancel' })
    expect(cancelled.state.t).toBe('confirming')
    const accepted = run(prompt.state, later(ctx), { t: 'hazardAccept' })
    expect(accepted.effects).toEqual([{ t: 'send', intent: { kind: 'move', unitId: b.id('F'), path: [sq('F5')] } }])
  })

  it('with the warning off the same move is sent without the prompt; Enter on the prompt cancels', () => {
    const b = basic()
    const off = ctxFor(b.state, b.south, { mineWarning: false })
    const locked = run({ t: 'selected', unitId: b.id('F'), trail: [] }, off, { t: 'clickSquare', square: sq('F5'), button: 'primary' })
    expect(run(locked.state, later(off), { t: 'confirm' }).state.t).toBe('submitting')

    const on = ctxFor(b.state, b.south)
    const prompt = run(run({ t: 'selected', unitId: b.id('F'), trail: [] }, on, { t: 'clickSquare', square: sq('F5'), button: 'primary' }).state, later(on), { t: 'confirm' })
    expect(run(prompt.state, later(on), { t: 'confirm' }).state.t).toBe('confirming')
  })

  it('R34: the commander always asks before entering a known mine, even with the warning off', () => {
    const b = buildBattle({ south: ['commander@E1:C'], north: ['soldier@J20'], mines: [{ owner: 'south', at: 'E2' }] })
    const ctx = ctxFor(b.state, b.south, { mineWarning: false, confirmMode: 'never' })
    const r = run({ t: 'selected', unitId: b.id('C'), trail: [] }, ctx, { t: 'clickSquare', square: sq('E2'), button: 'primary' })
    expect(r.state.t).toBe('hazard')
    expect(r.effects).toEqual([])
  })
})

describe('state machine A: attacks and confirmation modes', () => {
  it('a double-click within the guard only locks the preview (23.6 #2)', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const first = run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'clickUnit', unitId: b.id('B'), button: 'primary' })
    expect(first.state.t).toBe('confirming')
    const second = run(first.state, later(ctx, 100), { t: 'clickUnit', unitId: b.id('B'), button: 'primary' })
    expect(second.state.t).toBe('confirming')
    expect(second.effects).toEqual([])
    const third = run(first.state, later(ctx), { t: 'clickUnit', unitId: b.id('B'), button: 'primary' })
    expect(third.effects).toEqual([{ t: 'send', intent: { kind: 'attack', unitId: b.id('F'), target: { kind: 'unit', unitId: b.id('B') } } }])
  })

  it('Never: an attackable enemy is attacked at once; a mine path still prompts (23.6 #5)', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south, { confirmMode: 'never' })
    const attack = run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'clickUnit', unitId: b.id('B'), button: 'primary' })
    expect(attack.state.t).toBe('submitting')
    const mine = run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'clickSquare', square: sq('F5'), button: 'primary' })
    expect(mine.state.t).toBe('hazard')
  })

  it('Attacks & abilities: moves go straight out, attacks are previewed', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south, { confirmMode: 'attacksAbilities' })
    expect(run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'clickSquare', square: sq('E4'), button: 'primary' }).state.t).toBe('submitting')
    expect(run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'clickUnit', unitId: b.id('B'), button: 'primary' }).state.t).toBe('confirming')
  })

  it('an enemy out of reach explains why and keeps the selection', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const r = run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'clickUnit', unitId: b.id('S'), button: 'primary' })
    expect(r.state.t).toBe('selected')
    expect(r.effects).toEqual([{ t: 'hint', text: 'Out of reach (distance 4, reach 1)' }])
  })

  it('a rejection from the authority returns to the unit with the reason (23.6 #6)', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const r = run({ t: 'submitting', unitId: b.id('F'), intent: { kind: 'defend', unitId: b.id('F') } }, ctx, { t: 'reject', message: 'Not enough AP' })
    expect(r.state).toEqual({ t: 'selected', unitId: b.id('F'), trail: [] })
    expect(r.effects).toEqual([{ t: 'hint', text: 'Not enough AP' }])
  })

  it('Defend has no picks: Always previews it, Never sends it', () => {
    const b = basic()
    const always = ctxFor(b.state, b.south)
    expect(run({ t: 'selected', unitId: b.id('F'), trail: [] }, always, { t: 'action', action: { kind: 'defend' } }).state.t).toBe('confirming')
    const never = ctxFor(b.state, b.south, { confirmMode: 'never' })
    expect(run({ t: 'selected', unitId: b.id('F'), trail: [] }, never, { t: 'action', action: { kind: 'defend' } }).effects).toEqual([
      { t: 'send', intent: { kind: 'defend', unitId: b.id('F') } },
    ])
  })
})

describe('state machine A: multi-step targeting', () => {
  function julio() {
    return buildBattle({ south: ['juliomancer@J5:J', 'footman@J6:FF'], north: ['berserker@J7:B'] })
  }

  it('walks the picks and the Esc chain back to idle (23.6 #3)', () => {
    const b = julio()
    const ctx = ctxFor(b.state, b.south)
    const action = { kind: 'ability', abilityId: 'juliomancer.julioVernification' } as const
    const step1 = run({ t: 'selected', unitId: b.id('J'), trail: [] }, ctx, { t: 'action', action })
    expect(step1.state.t === 'targeting' && step1.state.picks).toEqual([])
    const step2 = run(step1.state, ctx, { t: 'clickUnit', unitId: b.id('FF'), button: 'primary' })
    expect(step2.state.t === 'targeting' && step2.state.picks).toEqual([{ kind: 'unit', unitId: b.id('FF') }])
    const locked = run(step2.state, ctx, { t: 'clickUnit', unitId: b.id('B'), button: 'primary' })
    expect(locked.state.t === 'confirming' && locked.state.intent).toEqual({
      kind: 'useAbility',
      unitId: b.id('J'),
      abilityId: action.abilityId,
      targets: [{ kind: 'unit', unitId: b.id('FF') }, { kind: 'unit', unitId: b.id('B') }],
    })
    const back1 = run(locked.state, ctx, { t: 'cancel' })
    expect(back1.state.t === 'targeting' && back1.state.picks.length).toBe(1)
    const back2 = run(back1.state, ctx, { t: 'cancel' })
    expect(back2.state.t === 'targeting' && back2.state.picks.length).toBe(0)
    const back3 = run(back2.state, ctx, { t: 'cancel' })
    expect(back3.state.t).toBe('selected')
    expect(run(back3.state, ctx, { t: 'cancel' }).state).toEqual(IDLE)
  })

  it('R14: a harmful pick on an own unit is always previewed, even with confirmation off', () => {
    const b = buildBattle({ south: ['juliomancer@J5:J', 'footman@J6:FF', 'footman@K5:G'], north: ['berserker@J8:B'] })
    const ctx = ctxFor(b.state, b.south, { confirmMode: 'never' })
    const action = { kind: 'ability', abilityId: 'juliomancer.julioVernification' } as const
    const r = run(
      { t: 'selected', unitId: b.id('J'), trail: [] },
      ctx,
      { t: 'action', action },
      { t: 'clickUnit', unitId: b.id('FF'), button: 'primary' },
      { t: 'clickUnit', unitId: b.id('G'), button: 'primary' },
    )
    expect(r.state.t).toBe('confirming')
  })

  it('[ and ] cycle the candidates into a locked preview without sending', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south, { confirmMode: 'never' })
    const r = run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'action', action: { kind: 'attack' } }, { t: 'cycleTarget', delta: 1 })
    expect(r.state.t).toBe('confirming')
    expect(r.effects).toEqual([])
  })
})

describe('R26 Charge and R27 Group march', () => {
  it('charge: choose the end square, then the target', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const step1 = run({ t: 'selected', unitId: b.id('P'), trail: [] }, ctx, { t: 'action', action: { kind: 'charge' } })
    expect(step1.state.t).toBe('targeting')
    const step2 = run(step1.state, ctx, { t: 'clickSquare', square: sq('H5'), button: 'primary' })
    expect(step2.state.t === 'targeting' && step2.state.picks).toEqual([{ kind: 'square', square: sq('H5') }])
    const locked = run(step2.state, ctx, { t: 'clickUnit', unitId: b.id('S'), button: 'primary' })
    expect(locked.state.t === 'confirming' && locked.state.intent).toEqual({
      kind: 'charge',
      unitId: b.id('P'),
      path: [sq('H5')],
      target: { kind: 'unit', unitId: b.id('S') },
    })
  })

  it('charge: clicking the enemy straight away picks a path that reaches it', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const r = run({ t: 'selected', unitId: b.id('P'), trail: [] }, ctx, { t: 'action', action: { kind: 'charge' } }, { t: 'clickUnit', unitId: b.id('S'), button: 'primary' })
    expect(r.state.t === 'confirming' && r.state.intent.kind).toBe('charge')
  })

  it('group march: add a connected unit, then a direction', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const r = run(
      { t: 'selected', unitId: b.id('F2'), trail: [] },
      ctx,
      { t: 'action', action: { kind: 'march' } },
      { t: 'clickUnit', unitId: b.id('F3'), button: 'primary' },
      { t: 'marchDirection', direction: 'north' },
    )
    expect(r.state.t === 'confirming' && r.state.intent).toEqual({ kind: 'groupMarch', unitIds: [b.id('F2'), b.id('F3')], direction: 'north' })
  })

  it('group march refuses a unit that is not connected to the group', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const r = run({ t: 'selected', unitId: b.id('F2'), trail: [] }, ctx, { t: 'action', action: { kind: 'march' } }, { t: 'clickUnit', unitId: b.id('P'), button: 'primary' })
    expect(r.state.t === 'targeting' && r.state.group).toEqual([b.id('F2')])
    expect(r.effects).toEqual([{ t: 'hint', text: 'Marching units must form one connected group' }])
  })
})

describe('the gate', () => {
  it("on the opponent's turn the selection is read-only (23.6 #9)", () => {
    const b = basic()
    const state = act(b.state, b.south, { kind: 'endTurn' }).state
    const ctx = ctxFor(state, b.south)
    expect(ctx.gate.open).toBe(false)
    const sel = run(IDLE, ctx, { t: 'clickUnit', unitId: b.id('F'), button: 'primary' })
    expect(sel.state.t).toBe('selected')
    const attack = run(sel.state, ctx, { t: 'action', action: { kind: 'attack' } })
    expect(attack.state.t).toBe('selected')
    expect(attack.effects).toEqual([{ t: 'hint', text: "Opponent's turn: you can inspect but not act" }])
    expect(run(sel.state, ctx, { t: 'clickUnit', unitId: b.id('B'), button: 'primary' }).state).toEqual({ t: 'inspect', target: { kind: 'unit', unitId: b.id('B') } })
  })

  it('a locked preview collapses to the selection when the gate closes', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const locked = run({ t: 'selected', unitId: b.id('F'), trail: [] }, ctx, { t: 'clickUnit', unitId: b.id('B'), button: 'primary' })
    const closed: CommandContext = { ...ctx, gate: { open: false, reason: 'Answer the prompt first' } }
    expect(run(locked.state, closed, { t: 'sync' }).state).toEqual({ t: 'selected', unitId: b.id('F'), trail: [] })
  })

  it('Tab cycles the units that can still act', () => {
    const b = basic()
    const ctx = ctxFor(b.state, b.south)
    const first = run(IDLE, ctx, { t: 'cycleUnit', delta: 1 })
    expect(first.state.t).toBe('selected')
    const second = run(first.state, ctx, { t: 'cycleUnit', delta: 1 })
    expect(second.state).not.toEqual(first.state)
    expect(run(second.state, ctx, { t: 'cycleUnit', delta: -1 }).state).toEqual(first.state)
  })
})

describe('square picks on a Size-2 token use the square under the pointer', () => {
  const ability = (abilityId: string): CommandEvent => ({ t: 'action', action: { kind: 'ability', abilityId } })
  const withHover = (ctx: CommandContext, square: string): CommandContext => ({ ...ctx, hover: sq(square) })
  const lockedSquare = (r: CommandResult) => (r.state.t === 'confirming' && r.state.intent.kind === 'useAbility' ? r.state.intent.targets[0] : undefined)

  it('Forceful slam on the far square of an enemy Beast', () => {
    const b = buildBattle({ south: ['beast@M10:B'], north: ['beast@O10:E'] })
    const ctx = ctxFor(b.state, b.south)
    const select = run(IDLE, ctx, { t: 'clickUnit', unitId: b.id('B'), button: 'primary' }, ability('beast.forcefulSlam'))
    expect(lockedSquare(run(select.state, withHover(ctx, 'O11'), { t: 'clickUnit', unitId: b.id('E'), button: 'primary' }))).toEqual({ kind: 'square', square: sq('O11') })
    expect(lockedSquare(run(select.state, withHover(ctx, 'O10'), { t: 'clickUnit', unitId: b.id('E'), button: 'primary' }))).toEqual({ kind: 'square', square: sq('O10') })
  })

  it('a Pajazon centred where the preview showed it', () => {
    const b = buildBattle({ south: ['royalWizard@M10:W'], north: ['beast@M11:E'] })
    const ctx = ctxFor(b.state, b.south)
    const select = run(IDLE, ctx, { t: 'clickUnit', unitId: b.id('W'), button: 'primary' }, ability('royalWizard.pajazon'))
    expect(lockedSquare(run(select.state, withHover(ctx, 'N12'), { t: 'clickUnit', unitId: b.id('E'), button: 'primary' }))).toEqual({ kind: 'square', square: sq('N12') })
  })

  it('a Forcefield painted across an own Beast', () => {
    const b = buildBattle({ south: ['royalWizard@M10:W', 'beast@N10:B'] })
    const ctx = ctxFor(b.state, b.south)
    let r = run(IDLE, ctx, { t: 'clickUnit', unitId: b.id('W'), button: 'primary' }, ability('royalWizard.forcefield'), { t: 'clickSquare', square: sq('M11'), button: 'primary' })
    r = run(r.state, withHover(ctx, 'N11'), { t: 'clickUnit', unitId: b.id('B'), button: 'primary' })
    expect(r.state.t === 'targeting' && r.state.partial).toEqual([sq('M11'), sq('N11')])
    r = run(r.state, ctx, { t: 'clickSquare', square: sq('M12'), button: 'primary' }, { t: 'clickSquare', square: sq('N12'), button: 'primary' })
    expect(r.state.t).toBe('confirming')
  })
})

describe('clicking a token while a square pick is locked (S-12.3)', () => {
  it('confirms a Slam aimed at the adjacent enemy by clicking it again, and retargets on another', () => {
    const b = buildBattle({ south: ['beast@M10:B'], north: ['soldier@M12:S', 'soldier@L11:T'] })
    const ctx = ctxFor(b.state, b.south)
    const locked = run(
      IDLE,
      ctx,
      { t: 'clickUnit', unitId: b.id('B'), button: 'primary' },
      { t: 'action', action: { kind: 'ability', abilityId: 'beast.forcefulSlam' } },
      { t: 'clickUnit', unitId: b.id('S'), button: 'primary' },
    )
    expect(locked.state.t).toBe('confirming')
    const again = run(locked.state, { ...later(ctx), hover: sq('M12') }, { t: 'clickUnit', unitId: b.id('S'), button: 'primary' })
    expect(again.state.t).toBe('submitting')
    expect(again.effects).toEqual([{ t: 'send', intent: { kind: 'useAbility', unitId: b.id('B'), abilityId: 'beast.forcefulSlam', targets: [{ kind: 'square', square: sq('M12') }] } }])
    const other = run(locked.state, { ...later(ctx), hover: sq('L11') }, { t: 'clickUnit', unitId: b.id('T'), button: 'primary' })
    expect(other.state.t === 'confirming' && other.state.intent.kind === 'useAbility' && other.state.intent.targets).toEqual([{ kind: 'square', square: sq('L11') }])
  })
})
