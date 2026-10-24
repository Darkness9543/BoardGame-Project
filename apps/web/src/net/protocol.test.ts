import { describe, expect, it } from 'vitest'
import { buildBattle, findLeaks, hashJson, projectView, registerAbility, startRecord, type Seat } from '@coinduel/engine'
import { HEARTBEAT_INTERVAL_MS, PROTOCOL_VERSION, RESYNC_RETRY_MS, UNSTABLE_AFTER_MS } from './constants'
import { invitationProof, parseInviteText } from './invite'
import { wire } from './messages'
import { memoryStore } from './storage'
import { FakeHub } from './testing/fakeNetwork'
import { ManualClock } from './testing/manualClock'
import { expectOk, placeAll, SMALL_ARMIES, someMove } from './testing/flows'
import { connectPair, guestOn, hostOn, messagesTo, typesFrom, type Pair } from './testing/harness'
import { localVersions } from './versions'
import type { NetSession } from './types'

// Test-local stand-in for Queso's revive (the real one is another agent's file): it prompts the dead unit's owner.
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

function peers(hub: FakeHub): { readonly host: string; readonly guest: string } {
  const [host, guest] = hub.peerIds()
  if (host === undefined || guest === undefined) throw new Error('both peers must be in the room')
  return { host, guest }
}

/** Delivers the network, then awaits a promise that needed it (a guest dispatch waits for the host's answer). */
async function done<T>(p: Pair, promise: Promise<T>): Promise<T> {
  await p.hub.settle()
  return promise
}

/** Lets time pass one heartbeat at a time, delivering the pings in between. */
async function elapse(p: Pair, ms: number): Promise<void> {
  for (let spent = 0; spent < ms; spent += HEARTBEAT_INTERVAL_MS) {
    p.clock.advance(Math.min(HEARTBEAT_INTERVAL_MS, ms - spent))
    await p.hub.settle()
  }
}

function expectGuestInSync(p: Pair): void {
  const truth = p.host.debugRecord().state
  expect(hashJson(p.guest.view)).toBe(hashJson(projectView(truth, 'guest')))
  expect(findLeaks(truth, 'guest', p.guest.view)).toEqual([])
}

async function toBattle(p: Pair): Promise<void> {
  expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
  expectOk(await p.guest.lobby.setReady(true))
  expectOk(await p.host.lobby.setArmy(SMALL_ARMIES.host))
  expectOk(await p.host.lobby.setReady(true))
  await p.hub.settle()
  expect(p.host.phase).toBe('deployment')
  expect(p.guest.phase).toBe('deployment')
  await placeAll(p.host)
  await placeAll(p.guest)
  expectOk(await p.guest.dispatch({ kind: 'confirmDeployment', confirmed: true }))
  expectOk(await p.host.dispatch({ kind: 'confirmDeployment', confirmed: true }))
  await p.hub.settle()
  expect(p.host.phase).toBe('battle')
  expect(p.guest.phase).toBe('battle')
}

/** The epoch of the last view the guest was sent. */
function guestEpoch(p: Pair): number {
  const last = messagesTo(p.hub, peers(p.hub).guest)
    .flatMap((m) => (m.t === 'snapshot' || m.t === 'update' || m.t === 'synced' ? [m.b.epoch] : []))
    .at(-1)
  if (last === undefined) throw new Error('the guest has no view')
  return last
}

function sessionOf(p: Pair, seat: Seat): NetSession {
  return seat === 'host' ? p.host : p.guest
}

function activeSeat(p: Pair): Seat {
  const turn = p.host.view.turn
  if (turn === null) throw new Error('no turn')
  return turn.activeSeat
}

describe('join and snapshot (NC 7.7)', () => {
  it('admits the guest with welcome + snapshot, and both sides see each other', async () => {
    const p = await connectPair()
    const { guest } = peers(p.hub)
    const received = messagesTo(p.hub, guest)
    expect(received[0]?.t).toBe('welcome')
    expect(received.find((m) => m.t === 'snapshot' || m.t === 'update')).toMatchObject({ t: 'snapshot', b: { why: 'join' } })
    expect(p.guest.synced).toBe(true)
    expect(p.guest.connection).toBe('connected')
    expect(p.host.connection).toBe('connected')
    expect(p.host.opponent).toEqual({ joined: true, name: 'Gil', activity: 'active' })
    expect(p.guest.opponent).toEqual({ joined: true, name: 'Hana', activity: 'active' })
    expect(p.host.view.names).toEqual({ host: 'Hana', guest: 'Gil' }) // the lobby is rebuilt with the guest's name
    expect(p.guest.room?.code).toBe(p.host.room.code)
    expect(p.guest.lobby.inviteLink).toBeNull()
    expectGuestInSync(p)
  })

  it('sends the guest only its own projection, never the state, and nothing of the hidden army before the battle', async () => {
    const p = await connectPair()
    await toBattle(p)
    const truth = p.host.debugRecord().state
    const { guest } = peers(p.hub)
    const hostUnitIds = truth.units.filter((u) => u.owner === 'host').map((u) => u.id)
    const battleStart = p.hub.log.findIndex((m) => m.to === guest && m.text.includes('"battleStarted"'))
    expect(battleStart).toBeGreaterThan(0)
    for (const message of p.hub.log.slice(0, battleStart).filter((m) => m.to === guest)) {
      for (const id of hostUnitIds) expect(message.text).not.toContain(id)
    }
    expect(p.hub.log.filter((m) => m.to === guest).some((m) => m.text.includes('"rng"'))).toBe(false)
    expectGuestInSync(p)
  })

  it('applies an update per accepted intent with seq + 1 and verified hashes', async () => {
    const p = await connectPair()
    await toBattle(p)
    const mover = sessionOf(p, activeSeat(p))
    const before = p.guest.updateSeq
    expectOk(await done(p, mover.dispatch({ kind: 'move', ...someMove(mover) })))
    expectOk(await done(p, mover.dispatch({ kind: 'endTurn' })))
    await p.hub.settle()
    expect(p.guest.updateSeq).toBeGreaterThan(before)
    const updates = messagesTo(p.hub, peers(p.hub).guest).flatMap((m) => (m.t === 'update' ? [m.b.seq] : []))
    expect(updates).toEqual(updates.map((_, i) => (updates[0] ?? 0) + i))
    expectGuestInSync(p)
  })
})

describe('resync (NC 7.9)', () => {
  it('asks for a snapshot after a lost update (gap)', async () => {
    const p = await connectPair()
    await toBattle(p)
    const { guest } = peers(p.hub)
    let dropped = 0
    p.hub.intercept = (m) => (m.to === guest && m.text.includes('"t":"update"') && dropped++ === 0 ? null : m.text)
    const mover = sessionOf(p, activeSeat(p))
    expectOk(await done(p, mover.dispatch({ kind: 'move', ...someMove(mover) })))
    expectOk(await done(p, mover.dispatch({ kind: 'endTurn' })))
    await p.hub.settle()
    p.hub.intercept = null
    const resyncs = p.hub.log.filter((m) => m.from === guest && m.text.includes('"t":"resync"'))
    expect(resyncs.map((m) => (JSON.parse(m.text) as { b: { reason: string } }).b.reason)).toEqual(['gap'])
    expect(messagesTo(p.hub, guest).some((m) => m.t === 'snapshot' && m.b.why === 'resync')).toBe(true)
    expectGuestInSync(p)
  })

  it('asks for a snapshot when a view does not match its hash', async () => {
    const p = await connectPair()
    await toBattle(p)
    const { guest } = peers(p.hub)
    let corrupted = false
    p.hub.intercept = (m) => {
      if (corrupted || m.to !== guest || !m.text.includes('"t":"update"')) return m.text
      corrupted = true
      const message = JSON.parse(m.text) as { b: { view: { myAp: number } } }
      message.b.view.myAp += 1000
      return JSON.stringify(message)
    }
    const mover = sessionOf(p, activeSeat(p))
    expectOk(await done(p, mover.dispatch({ kind: 'move', ...someMove(mover) })))
    await p.hub.settle()
    p.hub.intercept = null
    expect(typesFrom(p.hub, guest)).toContain('resync')
    expectGuestInSync(p)
  })
})

describe('lost snapshot', () => {
  it('asks again when the first snapshot after welcome never arrives', async () => {
    const hub = new FakeHub()
    const clock = new ManualClock()
    const host = hostOn(hub, clock, memoryStore())
    const invite = parseInviteText(host.room.inviteLink ?? '')
    if (invite === null) throw new Error('no invite')
    let dropped = false
    hub.intercept = (m) => {
      if (dropped || !m.text.includes('"t":"snapshot"')) return m.text
      dropped = true
      return null
    }
    const guest = guestOn(hub, clock, memoryStore(), invite)
    await hub.settle()
    expect(dropped).toBe(true)
    expect(guest.synced).toBe(false)
    clock.advance(RESYNC_RETRY_MS)
    await hub.settle()
    expect(guest.synced).toBe(true)
    expect(hashJson(guest.view)).toBe(hashJson(projectView(host.debugRecord().state, 'guest')))
  })
})

describe('presence, heartbeat and reconnection (NC 7.10, 7.11)', () => {
  it('shows a hidden tab as hidden, not disconnected', async () => {
    const p = await connectPair()
    p.guestEnv.hidden = true
    p.guestEnv.fire()
    await p.hub.settle()
    expect(p.host.opponent.activity).toBe('hidden')
    p.guestEnv.hidden = false
    p.guestEnv.fire()
    await p.hub.settle()
    expect(p.host.opponent.activity).toBe('active')
  })

  it('goes unstable after 15 s of silence and lost after 90 s, without forfeiting anyone', async () => {
    const p = await connectPair()
    const { guest } = peers(p.hub)
    p.hub.intercept = (m) => (m.from === guest ? null : m.text) // the guest goes silent
    await elapse(p, UNSTABLE_AFTER_MS)
    expect(p.host.connection).toBe('unstable')
    await elapse(p, 75_000)
    expect(p.host.connection).toBe('lost')
    expect(p.host.opponent.activity).toBe('away')
    expect(p.host.phase).toBe('lobby')
    expect(p.host.view.result).toBeNull()
  })

  it('reconnects a dropped guest with "synced" when nothing changed, and with a snapshot otherwise', async () => {
    const p = await connectPair()
    await toBattle(p)
    const { guest } = peers(p.hub)
    p.hub.disconnect(guest)
    await p.hub.settle()
    expect(p.guest.connection).toBe('lost')
    expect(p.host.opponent.activity).toBe('away')
    expect(p.host.clock?.pausedBy).toBe('disconnected') // 2.12: the turn timer waits
    p.hub.reconnect(guest)
    await p.hub.settle()
    expect(messagesTo(p.hub, guest).some((m) => m.t === 'synced')).toBe(true)
    expect(p.guest.connection).toBe('connected')
    expect(p.host.clock?.running).toBe(true)

    p.hub.disconnect(guest)
    await p.hub.settle()
    const mover = sessionOf(p, activeSeat(p))
    if (mover === p.host) {
      expectOk(await p.host.dispatch({ kind: 'move', ...someMove(p.host) }))
      expectOk(await p.host.dispatch({ kind: 'endTurn' }))
    } else {
      expectOk(await p.host.dispatch({ kind: 'offerDraw' }))
    }
    p.hub.reconnect(guest)
    await p.hub.settle()
    const last = messagesTo(p.hub, guest).filter((m) => m.t === 'snapshot').at(-1)
    expect(last?.t === 'snapshot' && last.b.why).toBe('resync')
    expectGuestInSync(p)
  })

  it('answers an action that was in flight when the link dropped, without applying it twice (NC 7.8 rule 5)', async () => {
    const p = await connectPair()
    await toBattle(p)
    if (activeSeat(p) !== 'guest') {
      expectOk(await p.host.dispatch({ kind: 'endTurn' }))
      await p.hub.settle()
    }
    const { guest } = peers(p.hub)
    let resultsDropped = 0
    p.hub.intercept = (m) => (m.to === guest && m.text.includes('"t":"result"') && resultsDropped++ === 0 ? null : m.text)
    const pending = p.guest.dispatch({ kind: 'move', ...someMove(p.guest) })
    await p.hub.settle()
    p.hub.intercept = null
    p.hub.disconnect(guest)
    await p.hub.settle()
    p.hub.reconnect(guest)
    await p.hub.settle()
    expect(await pending).toEqual({ ok: true }) // answered from the host's result cache after the reconnect
    expect(p.host.debugRecord().log.filter((e) => e.intent.kind === 'move' && e.seat === 'guest')).toHaveLength(1)
    expectGuestInSync(p)
  })

  it('lets the guest come back after a reload with its seat token and draft', async () => {
    const p = await connectPair()
    expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
    await p.hub.settle()
    p.guest.close()
    await p.hub.settle()
    expect(p.host.opponent.activity).toBe('away')
    const again = guestOn(p.hub, p.clock, p.guestStore, p.invite)
    await p.hub.settle()
    expect(again.connection).toBe('connected')
    expect(again.view.myArmy).toEqual(SMALL_ARMIES.guest)
    expect(p.host.opponent).toMatchObject({ joined: true, activity: 'active' })
  })

  it('resumes the host after a reload from its saved room, and the guest rejoins', async () => {
    const p = await connectPair()
    await toBattle(p)
    const roomId = p.host.room.roomId
    const before = hashJson(p.host.debugRecord().state)
    p.host.close()
    await p.hub.settle()
    expect(p.guest.opponent.activity).toBe('away')
    const host = hostOn(p.hub, p.clock, p.hostStore, { resume: roomId })
    expect(host.room.roomId).toBe(roomId)
    expect(hashJson(host.debugRecord().state)).toBe(before)
    await elapse(p, 1_000) // the guest's rejoin backoff
    expect(p.guest.connection).toBe('connected')
    expect(host.opponent).toMatchObject({ joined: true, name: 'Gil', activity: 'active' })
    expect(hashJson(p.guest.view)).toBe(hashJson(projectView(host.debugRecord().state, 'guest')))
  })
})

describe('admission (NC 7.4, 7.17)', () => {
  it('refuses a guest on another version with a message that says what to do', async () => {
    const p = await connectPair({ guestVersions: { rules: 99 } })
    expect(p.guest.problem?.kind).toBe('version')
    expect(p.guest.problem?.message).toMatch(/different version.*reload/)
    expect(p.guest.connection).toBe('lost')
    expect(p.host.opponent.joined).toBe(false)
  })

  it('refuses a third player while the seated guest is connected', async () => {
    const p = await connectPair()
    const third = guestOn(p.hub, p.clock, memoryStore(), p.invite, { guestName: 'Tess' })
    await p.hub.settle()
    expect(third.problem?.kind).toBe('room-full')
    expect(p.host.opponent.name).toBe('Gil')
  })

  it('gives the seat to a new device while the seated guest is away, invalidating the old token', async () => {
    const p = await connectPair()
    p.hub.disconnect(peers(p.hub).guest)
    await p.hub.settle()
    const other = guestOn(p.hub, p.clock, memoryStore(), p.invite, { guestName: 'Gil Phone' })
    await p.hub.settle()
    expect(other.connection).toBe('connected')
    expect(p.host.opponent.name).toBe('Gil Phone')
  })

  it('refuses a hello whose invite proof is wrong, and never meets a peer with another secret', async () => {
    const p = await connectPair()
    const { host } = peers(p.hub)
    const room = p.hub.join({ appId: 'coinduel-p2p-v1', roomId: p.invite.roomId, secret: p.invite.secret, iceServers: [] })
    const bad = { versions: localVersions('dev'), name: 'Mallory', proof: invitationProof({ ...p.invite, secret: 'x'.repeat(22) }), seatToken: null, lastSeq: null, viewHash: null, stateHash: null, pending: [] }
    p.hub.inject(room.peerId, host, wire('hello', bad))
    await p.hub.settle()
    const answer = p.hub.log.find((m) => m.to === room.peerId)
    expect(answer?.text).toContain('"bad-invite"')

    const stranger = guestOn(p.hub, p.clock, memoryStore(), { ...p.invite, secret: 'y'.repeat(22) })
    await p.hub.settle()
    expect(stranger.connection).toBe('connecting')
  })
})

describe('the trust boundary (host side)', () => {
  it('drops malformed and unauthorised messages and keeps serving the real guest', async () => {
    const p = await connectPair()
    const { host, guest } = peers(p.hub)
    const outsider = p.hub.join({ appId: 'coinduel-p2p-v1', roomId: p.invite.roomId, secret: p.invite.secret, iceServers: [] })
    const garbage = [
      'not json',
      '[]',
      JSON.stringify({ v: PROTOCOL_VERSION, t: 'intent', b: { id: 'x', epoch: 0, intent: { kind: 'move' } } }),
      JSON.stringify({ v: PROTOCOL_VERSION, t: 'update', b: {} }), // a host message from a guest
      'x'.repeat(70_000),
    ]
    for (const text of garbage) p.hub.inject(guest, host, text)
    // Well-formed once its unknown field is dropped; the engine then refuses it (no resigning in the lobby).
    p.hub.inject(guest, host, `{"v":${PROTOCOL_VERSION},"t":"intent","b":{"id":"x2","epoch":0,"intent":{"kind":"resign","constructor":{"x":1}}}}`)
    p.hub.inject(outsider.peerId, host, wire('intent', { id: 'o1', epoch: 0, intent: { kind: 'resign' } }))
    await p.hub.settle()
    expect(p.host.malformed).toBe(garbage.length)
    expect(p.host.phase).toBe('lobby')
    expect(p.hub.log.some((m) => m.to === outsider.peerId)).toBe(false)
    expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
    await p.hub.settle()
    expect(p.host.view.commanders.guest).toBe('ratasius')
  })

  it('logs a guest intent rebuilt from its known fields only', async () => {
    const p = await connectPair()
    await toBattle(p)
    if (activeSeat(p) !== 'guest') {
      expectOk(await p.host.dispatch({ kind: 'endTurn' }))
      await p.hub.settle()
    }
    const { host, guest } = peers(p.hub)
    const move = someMove(p.guest)
    p.hub.inject(guest, host, JSON.stringify({ v: PROTOCOL_VERSION, t: 'intent', b: { id: 'raw-1', epoch: guestEpoch(p), intent: { kind: 'move', ...move, sneaky: 'x' } } }))
    await p.hub.settle()
    const logged = p.host.debugRecord().log.at(-1)
    expect(logged).toEqual({ seat: 'guest', intent: { kind: 'move', unitId: move.unitId, path: move.path } })
  })

  it('refuses an intent composed before a take-back rewound the game (epochs)', async () => {
    const p = await connectPair()
    await toBattle(p)
    if (activeSeat(p) !== 'guest') {
      expectOk(await p.host.dispatch({ kind: 'endTurn' }))
      await p.hub.settle()
    }
    const { host, guest } = peers(p.hub)
    p.hub.inject(guest, host, wire('intent', { id: 'stale-1', epoch: 7, intent: { kind: 'endTurn' } }))
    await p.hub.settle()
    expect(p.hub.log.filter((m) => m.to === guest).at(-1)?.text).toContain('"NOT_AVAILABLE"')
  })
})

describe('take-back over the network (section 9, NC 7.13)', () => {
  it('shows the request to the decider, restores the earlier state on accept and resyncs both sides', async () => {
    const p = await connectPair()
    await toBattle(p)
    if (activeSeat(p) !== 'guest') {
      expectOk(await p.host.dispatch({ kind: 'endTurn' }))
      await p.hub.settle()
    }
    const before = hashJson(p.guest.view.units)
    expectOk(await done(p, p.guest.dispatch({ kind: 'move', ...someMove(p.guest) })))
    expectOk(await done(p, p.guest.takeback.request()))
    await p.hub.settle()
    expect(p.host.takeback.state.request?.requester).toBe('guest')
    expect(p.host.takeback.deadline).toBe(p.clock.now() + 30_000)
    expect(p.guest.takeback.deadline).toBe(p.clock.now() + 30_000)
    expect(p.host.clock?.pausedBy).toBe('takeback')
    expectOk(await p.host.takeback.respond(true))
    await p.hub.settle()
    const snapshots = messagesTo(p.hub, peers(p.hub).guest).filter((m) => m.t === 'snapshot')
    expect(snapshots.at(-1)?.t === 'snapshot' && snapshots.at(-1)?.b.why).toBe('takeback')
    expect(hashJson(p.guest.view.units)).toBe(before)
    expect(p.guest.view.takeback.usedByMe).toBe(1)
    expectGuestInSync(p)
  })

  it('auto-declines an unanswered request after 30 s', async () => {
    const p = await connectPair()
    await toBattle(p)
    const mover = sessionOf(p, activeSeat(p))
    expectOk(await done(p, mover.dispatch({ kind: 'move', ...someMove(mover) })))
    expectOk(await done(p, mover.takeback.request()))
    await p.hub.settle()
    await elapse(p, 30_000)
    expect(p.host.takeback.state.request).toBeNull()
    expect(p.guest.takeback.state.request).toBeNull()
    expect(p.guest.history.flatMap((u) => u.events).some((e) => e.type === 'takebackDeclined')).toBe(true)
  })
})

describe('reaction prompts relayed to the guest (A2-30, NC 7.14)', () => {
  it('times the prompt out on the guest after 15 s and then runs the host intent that waited for it', async () => {
    const battle = buildBattle({
      south: ['berserker@E5:B'],
      north: [{ type: 'soldier', at: 'E6', label: 'S', toughness: 1 }, 'commander@E8:Q'],
      commanders: { north: 'queso' },
      settings: { scenarioId: 'openField', turnTimerSeconds: null },
    })
    const p = await connectPair({ record: startRecord(battle.state) })
    expect(p.guest.phase).toBe('battle')
    expectOk(await p.host.dispatch({ kind: 'attack', unitId: battle.id('B'), target: { kind: 'unit', unitId: battle.id('S') } }))
    await p.hub.settle()
    expect(p.guest.pendingReaction?.kind).toBe('queso.revive')
    expect(p.guest.reactionDeadline).toBe(p.clock.now() + 15_000)
    expect(p.host.view.opponentDeciding).toBe(true)
    let ended = false
    const endTurn = p.host.dispatch({ kind: 'endTurn' }).then((r) => {
      ended = r.ok
    })
    await p.hub.settle()
    expect(ended).toBe(false)
    await elapse(p, 15_000)
    await endTurn
    expect(ended).toBe(true)
    expect(p.guest.pendingReaction).toBeNull()
    expect(p.guest.view.turn?.activeSeat).toBe('guest')
    expect(p.host.debugRecord().log.some((e) => e.seat === 'guest' && e.intent.kind === 'respondDecision')).toBe(true)
  })

  it('lets the guest answer the prompt itself', async () => {
    const battle = buildBattle({
      south: ['berserker@E5:B'],
      north: [{ type: 'soldier', at: 'E6', label: 'S', toughness: 1 }, 'commander@E8:Q'],
      commanders: { north: 'queso' },
    })
    const p = await connectPair({ record: startRecord(battle.state) })
    expectOk(await p.host.dispatch({ kind: 'attack', unitId: battle.id('B'), target: { kind: 'unit', unitId: battle.id('S') } }))
    await p.hub.settle()
    expect(p.host.clock?.pausedBy).toBe('decision') // R29: prompts stop the turn timer
    expectOk(await done(p, p.guest.respondToReaction('yes')))
    await p.hub.settle()
    expect(p.guest.pendingReaction).toBeNull()
    expect(p.host.clock?.running).toBe(true)
  })
})

describe('the R29 turn timer online', () => {
  it('is on by default, ends an idle turn after 90 s + 60 s, and stops while the guest is away', async () => {
    const p = await connectPair()
    await toBattle(p)
    expect(p.guest.clock).toMatchObject({ running: true, turnMs: 90_000 })
    const turn = p.host.view.turn?.number ?? 0
    await elapse(p, 150_000)
    expect(p.host.view.turn?.number).toBe(turn + 1)
    expect(p.guest.view.turn?.number).toBe(turn + 1)
    p.hub.disconnect(peers(p.hub).guest)
    await p.hub.settle()
    p.clock.advance(400_000)
    await p.hub.settle()
    expect(p.host.view.turn?.number).toBe(turn + 1)
  })
})
