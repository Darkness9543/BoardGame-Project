import { describe, expect, it } from 'vitest'
import { buildBattle, findLeaks, registerAbility, SEATS, startRecord, TAKEBACK_TIMEOUT_S, type Seat } from '@coinduel/engine'
import { createSession } from './createSession'
import { readMatchLog } from './matchLog'
import { memoryStore } from './storage'
import { expectOk, placeAll, SMALL_ARMIES, someMove } from './testing/flows'
import { ManualClock } from './testing/manualClock'
import type { LocalSession } from './types'

// A test-local stand-in for Queso's revive (the real one is another agent's file): it prompts the dead unit's owner.
registerAbility(
  {
    id: 'queso.revive',
    status: 'implemented',
    onUnitDied: (ctx, holder, death) => {
      if (death.unit.owner !== holder.owner || death.isCommander) return
      ctx.requestDecision({
        abilityId: 'queso.revive',
        holder,
        seat: holder.owner,
        kind: 'queso.revive',
        prompt: 'Revive?',
        options: [
          { id: 'yes', label: 'Revive' },
          { id: 'no', label: 'Let it fall' },
        ],
        defaultOption: 'no',
        alwaysOption: 'yes',
        preferenceKey: 'revive',
        subject: death.unit,
        data: {},
      })
    },
    onDecision: () => undefined,
  },
  { replace: true },
)

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function sandbox(options: { timer?: boolean } = {}): { session: LocalSession; clock: ManualClock; store: ReturnType<typeof memoryStore> } {
  const clock = new ManualClock()
  const store = memoryStore()
  const settings = options.timer === true ? { scenarioId: 'openField' as const, turnTimerSeconds: 90, timeBankSeconds: 60 } : { scenarioId: 'openField' as const }
  const session = createSession({ mode: 'local', clock, storage: store, coinSeed: 'fixed-coin', seed: 'sandbox-seed', settings })
  return { session, clock, store }
}

function expectNoLeaks(session: LocalSession): void {
  const state = session.debugRecord().state
  for (const seat of SEATS) expect(findLeaks(state, seat, session.endpoint(seat).view)).toEqual([])
}

async function toBattle(session: LocalSession): Promise<void> {
  for (const seat of SEATS) {
    const endpoint = session.endpoint(seat)
    expectOk(await endpoint.lobby.setArmy(SMALL_ARMIES[seat]))
    expectOk(await endpoint.lobby.setReady(true))
  }
  await flush() // the coin flip runs right after the submit that made both ready
  expect(session.phase).toBe('deployment')
  for (const seat of SEATS) {
    await placeAll(session.endpoint(seat))
    expectOk(await session.endpoint(seat).dispatch({ kind: 'confirmDeployment', confirmed: true }))
  }
  expect(session.phase).toBe('battle')
}

function southOf(session: LocalSession): Seat {
  const south = session.view.southSeat
  if (south === null) throw new Error('no South')
  return south
}

describe('LocalSession (sandbox / hot-seat)', () => {
  it('plays lobby -> coin flip -> hidden deployment -> battle, each seat seeing only its own projection', async () => {
    const { session } = sandbox()
    expect(session.mode).toBe('local')
    expect(session.connection).toBe('connected')
    expect(session.clock).toBeNull()
    await toBattle(session)
    expectNoLeaks(session)
    const placedByOther = session.endpoint('guest').history.flatMap((u) => u.events).filter((e) => e.type === 'unitPlaced')
    expect(placedByOther.every((e) => e.type === 'unitPlaced' && session.endpoint('guest').view.units.some((u) => u.id === e.unitId))).toBe(true)
    expect(session.view.armies).not.toBeNull() // R33: both lists public from deployment
  })

  it('follows the player who must act, and lets the seat be switched by hand', async () => {
    const { session } = sandbox()
    await toBattle(session)
    const south = southOf(session)
    expect(session.seat).toBe(south)
    const move = someMove(session)
    expectOk(await session.dispatch({ kind: 'move', ...move }))
    expectOk(await session.dispatch({ kind: 'endTurn' }))
    expect(session.seat).not.toBe(south)
    session.setFollowTurn(false)
    session.setSeat(south)
    expect(session.seat).toBe(south)
    expect((await session.dispatch({ kind: 'endTurn' })).ok).toBe(false)
    expectNoLeaks(session)
  })

  it('hands the lobby and the deployment to the seat that has not finished yet', async () => {
    const { session } = sandbox()
    expect(session.seat).toBe('host')
    expectOk(await session.lobby.setArmy(SMALL_ARMIES.host))
    expectOk(await session.lobby.setReady(true))
    expect(session.seat).toBe('guest')
    expectOk(await session.lobby.setArmy(SMALL_ARMIES.guest))
    expectOk(await session.lobby.setReady(true))
    await flush()
    expect(session.phase).toBe('deployment')
    const first = session.seat
    await placeAll(session.endpoint(first))
    expectOk(await session.dispatch({ kind: 'confirmDeployment', confirmed: true }))
    expect(session.seat).not.toBe(first)
    await placeAll(session)
    expectOk(await session.dispatch({ kind: 'confirmDeployment', confirmed: true }))
    expect(session.phase).toBe('battle')
    expect(session.seat).toBe(southOf(session))
  })

  it('refuses a hand-made startDeployment: the session flips the coin itself', async () => {
    const { session } = sandbox()
    const result = await session.dispatch({ kind: 'startDeployment', coinSeed: 'mine' })
    expect(result).toMatchObject({ ok: false, code: 'NOT_AVAILABLE' })
  })

  it('has no turn timer in the sandbox unless the settings switch it on (R29)', async () => {
    const off = sandbox()
    await toBattle(off.session)
    expect(off.session.clock).toBeNull()

    const on = sandbox({ timer: true })
    await toBattle(on.session)
    const clock = on.session.clock
    expect(clock).toMatchObject({ running: true, pausedBy: null, turnMs: 90_000, bankMs: { host: 60_000, guest: 60_000 } })
    const turn = on.session.view.turn?.number ?? 0
    on.clock.advance(149_000)
    expect(on.session.view.turn?.number).toBe(turn)
    on.clock.advance(1_000)
    await flush()
    expect(on.session.view.turn?.number).toBe(turn + 1) // the host-side clock ended the turn
    expect(on.session.clock?.bankMs[southOf(on.session)]).toBe(0)
  })

  it('pauses the clock during a take-back request, which auto-declines after 30 s (TB-4)', async () => {
    const { session, clock } = sandbox({ timer: true })
    await toBattle(session)
    const south = southOf(session)
    session.setFollowTurn(false)
    const move = someMove(session)
    expectOk(await session.dispatch({ kind: 'move', ...move }))
    expectOk(await session.takeback.request())
    const deadline = session.takeback.deadline
    expect(deadline).toBe(clock.now() + TAKEBACK_TIMEOUT_S * 1000)
    expect(session.clock).toMatchObject({ running: false, pausedBy: 'takeback' })
    expect(session.endpoint(south === 'host' ? 'guest' : 'host').takeback.state.request?.requester).toBe(south)
    clock.advance(TAKEBACK_TIMEOUT_S * 1000)
    await flush()
    expect(session.takeback.state.request).toBeNull()
    expect(session.history.some((u) => u.events.some((e) => e.type === 'takebackDeclined'))).toBe(true)
    expect(session.clock).toMatchObject({ running: true, pausedBy: null })
  })

  it('accepts a take-back and restores the exact earlier view', async () => {
    const { session } = sandbox()
    await toBattle(session)
    const south = southOf(session)
    const before = session.endpoint(south).view
    expectOk(await session.dispatch({ kind: 'move', ...someMove(session) }))
    expectOk(await session.takeback.request())
    expect(session.seat).not.toBe(south) // followTurn: the decider answers
    expectOk(await session.takeback.respond(true))
    const after = session.endpoint(south).view
    expect(after.units).toEqual(before.units)
    expect(after.takeback.usedByMe).toBe(1)
  })

  it('times a reaction prompt out to its default and then runs the intent that waited for it (A2-30, 2.11)', async () => {
    const clock = new ManualClock()
    const battle = buildBattle({
      south: ['berserker@E5:B'],
      north: [{ type: 'soldier', at: 'E6', label: 'S', toughness: 1 }, 'commander@E8:Q'],
      commanders: { north: 'queso' },
    })
    const session = createSession({ mode: 'local', clock, storage: memoryStore(), record: startRecord(battle.state) })
    expectOk(await session.dispatch({ kind: 'attack', unitId: battle.id('B'), target: { kind: 'unit', unitId: battle.id('S') } }))
    expect(session.seat).toBe(battle.north) // followTurn moved to the decider
    expect(session.pendingReaction?.kind).toBe('queso.revive')
    expect(session.reactionDeadline).toBe(clock.now() + 15_000)
    expect(session.endpoint(battle.south).view.opponentDeciding).toBe(true)

    let ended = false
    const endTurn = session.endpoint(battle.south).dispatch({ kind: 'endTurn' }).then((r) => {
      ended = r.ok
    })
    await flush()
    expect(ended).toBe(false) // queued behind the prompt, not refused
    clock.advance(15_000)
    await endTurn
    expect(ended).toBe(true)
    expect(session.endpoint(battle.north).view.turn?.activeSeat).toBe(battle.north)
    const resolved = session.endpoint(battle.north).history.flatMap((u) => u.events).find((e) => e.type === 'decisionResolved')
    expect(resolved).toMatchObject({ choice: 'no' })
  })

  it('logs the finished match (R38) and starts a rematch with the same players', async () => {
    const { session, store } = sandbox()
    await toBattle(session)
    expectOk(await session.dispatch({ kind: 'resign' }))
    expect(session.phase).toBe('ended')
    const log = readMatchLog(store)
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ mode: 'local', summary: { reason: 'resignation' } })
    expect(session.fairness.auditReady).toBe(true)
    expect(session.fairness.verify()).toMatchObject({ ok: true })
    expectOk(await session.rematch())
    expect(session.phase).toBe('lobby')
    expect(session.view.names).toEqual({ host: 'Player 1', guest: 'Player 2' })
    expect(readMatchLog(store)).toHaveLength(1)
  })

  it('refuses everything once closed', async () => {
    const { session } = sandbox()
    session.close()
    expect(await session.dispatch({ kind: 'setReady', ready: true })).toMatchObject({ ok: false, code: 'NOT_CONNECTED' })
  })
})
