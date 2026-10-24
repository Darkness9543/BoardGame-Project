import { describe, expect, it } from 'vitest'
import { combineSecrets, deploymentSquares, validateIntent, type ArmyList } from '@coinduel/engine'
import { verifyAudit, type FairnessRecord } from './fairness'
import { decodeHostMessage } from './guards'
import type { AuditMessage, HostMessage, LockPhase, MetaWire } from './messages'
import { expectOk, placeAll, SMALL_ARMIES } from './testing/flows'
import { connectPair, messagesTo, type Pair } from './testing/harness'

async function done<T>(p: Pair, promise: Promise<T>): Promise<T> {
  await p.hub.settle()
  return promise
}

function guestPeer(p: Pair): string {
  const peer = p.hub.peerIds()[1]
  if (peer === undefined) throw new Error('no guest in the room')
  return peer
}

function metaOf(message: HostMessage): MetaWire | null {
  switch (message.t) {
    case 'snapshot':
    case 'update':
    case 'synced':
    case 'meta':
      return message.b.meta
    default:
      return null
  }
}

/** Index in the hub log of the first host message to the guest whose meta passes `test`. */
function firstMetaIndex(p: Pair, test: (meta: MetaWire) => boolean): number {
  const guest = guestPeer(p)
  return p.hub.log.findIndex((m) => {
    if (m.to !== guest) return false
    const decoded = decodeHostMessage(m.text)
    const meta = decoded.ok ? metaOf(decoded.message) : null
    return meta !== null && test(meta)
  })
}

function firstFromGuest(p: Pair, type: string): number {
  const guest = guestPeer(p)
  return p.hub.log.findIndex((m) => m.from === guest && m.text.includes(`"t":"${type}"`))
}

function auditOf(p: Pair): AuditMessage {
  const audit = messagesTo(p.hub, guestPeer(p)).find((m): m is AuditMessage => m.t === 'audit')
  if (audit === undefined) throw new Error('no audit was sent')
  return audit
}

/** What the guest recorded, rebuilt from the traffic (to check doctored audits against). */
function recordFromTraffic(p: Pair): FairnessRecord {
  const guest = guestPeer(p)
  const hashes: Record<string, { viewHash: string; stateHash: string }> = {}
  for (const m of messagesTo(p.hub, guest)) {
    if (m.t === 'snapshot' || m.t === 'update') hashes[String(m.b.logLength)] = { viewHash: m.b.viewHash, stateHash: m.b.stateHash }
  }
  const reveals = p.hub.log
    .filter((m) => m.from === guest && m.text.includes('"t":"reveal"'))
    .map((m) => (JSON.parse(m.text) as { b: { phase: LockPhase; against: string } }).b)
  const against = (phase: LockPhase): string | null => reveals.filter((r) => r.phase === phase).at(-1)?.against ?? null
  const first = (phase: LockPhase): string | null => reveals.find((r) => r.phase === phase)?.against ?? null
  return { seedCommit: null, coin: null, revealedAgainst: { army: against('army'), deploy: against('deploy') }, sentAgainst: { army: first('army'), deploy: first('deploy') }, hashes }
}

function auditSeedCommit(p: Pair): string {
  const seed = messagesTo(p.hub, guestPeer(p)).flatMap((m) => {
    const meta = metaOf(m)
    return meta === null ? [] : [meta.seedCommit]
  })[0]
  if (seed === undefined) throw new Error('no seed commitment was sent')
  return seed
}

async function lobbyToDeployment(p: Pair): Promise<void> {
  expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
  expectOk(await p.guest.lobby.setReady(true))
  await p.hub.settle()
  expectOk(await p.host.lobby.setArmy(SMALL_ARMIES.host))
  expectOk(await p.host.lobby.setReady(true))
  await p.hub.settle()
  expect(p.guest.phase).toBe('deployment')
}

async function deploymentToBattle(p: Pair): Promise<void> {
  await placeAll(p.guest)
  expectOk(await p.guest.dispatch({ kind: 'confirmDeployment', confirmed: true }))
  await p.hub.settle()
  await placeAll(p.host)
  expectOk(await p.host.dispatch({ kind: 'confirmDeployment', confirmed: true }))
  await p.hub.settle()
  expect(p.guest.phase).toBe('battle')
}

async function finish(p: Pair): Promise<void> {
  expectOk(await done(p, p.guest.dispatch({ kind: 'resign' })))
  await p.hub.settle()
  expect(p.guest.phase).toBe('ended')
}

describe('sealed army (S28 / R37, R16)', () => {
  it('sends only the commander and variant until the host has locked, then reveals the army in one batch', async () => {
    const p = await connectPair()
    const guest = guestPeer(p)
    expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
    expectOk(await p.guest.lobby.setReady(true))
    await p.hub.settle()

    expect(p.host.view.commanders.guest).toBe('ratasius') // R16: public on selection
    expect(p.host.view.lobby.ready.guest).toBe(true) // shown as waiting for the host
    expect(p.host.debugRecord().state.seats.guest.army?.units).toEqual({}) // but the host does not have it
    expect(p.hub.log.filter((m) => m.from === guest).some((m) => m.text.includes('mercenary'))).toBe(false)
    expect(p.guest.view.myArmy).toEqual(SMALL_ARMIES.guest)
    expect(p.guest.view.lobby.ready.guest).toBe(true)

    expectOk(await p.host.lobby.setArmy(SMALL_ARMIES.host))
    expectOk(await p.host.lobby.setReady(true))
    await p.hub.settle()

    const committed = firstMetaIndex(p, (meta) => meta.commits.army !== null)
    const revealed = firstFromGuest(p, 'reveal')
    expect(committed).toBeGreaterThan(-1)
    expect(revealed).toBeGreaterThan(committed)
    expect(p.hub.log[revealed]?.text).toContain('mercenary')
    expect(p.guest.phase).toBe('deployment')
    expect(p.guest.view.armies?.guest).toEqual(SMALL_ARMIES.guest) // R33
  })

  it('flips the coin by commit-reveal: the guest answers the commitment, then checks the host nonce', async () => {
    const p = await connectPair()
    await lobbyToDeployment(p)
    const committed = firstMetaIndex(p, (meta) => meta.coin !== null)
    const answered = firstFromGuest(p, 'coinReveal')
    expect(committed).toBeGreaterThan(-1)
    expect(answered).toBeGreaterThan(committed)
    const guestNonce = (JSON.parse(p.hub.log[answered]?.text ?? '{}') as { b: { nonce: string } }).b.nonce
    const revealedAt = firstMetaIndex(p, (meta) => meta.coin?.hostNonce != null)
    expect(revealedAt).toBeGreaterThan(answered)
    const revealed = decodeHostMessage(p.hub.log[revealedAt]?.text ?? '')
    const hostNonce = revealed.ok ? metaOf(revealed.message)?.coin?.hostNonce : undefined
    const start = p.host.debugRecord().log.find((e) => e.intent.kind === 'startDeployment')?.intent
    expect(start).toEqual({ kind: 'startDeployment', coinSeed: combineSecrets(hostNonce ?? '', guestNonce) })
    expect(p.guest.fairness.notes).toEqual([])
  })
})

describe('sealed deployment', () => {
  it('keeps the placements on the guest until the host has confirmed its own', async () => {
    const p = await connectPair()
    const guest = guestPeer(p)
    await lobbyToDeployment(p)
    await placeAll(p.guest)
    expectOk(await p.guest.dispatch({ kind: 'confirmDeployment', confirmed: true }))
    await p.hub.settle()
    const draft = p.guest.view.units.filter((u) => u.owner === 'guest')
    expect(draft.every((u) => u.anchor !== null)).toBe(true) // the guest sees its draft
    expect(p.host.debugRecord().state.units.filter((u) => u.owner === 'guest').every((u) => u.anchor === null)).toBe(true)
    expect(p.host.view.deploymentConfirmed.guest).toBe(true) // shown as waiting for the host
    expect(p.hub.log.filter((m) => m.from === guest).some((m) => draft.some((u) => m.text.includes(u.id)))).toBe(false)

    await placeAll(p.host)
    expectOk(await p.host.dispatch({ kind: 'confirmDeployment', confirmed: true }))
    await p.hub.settle()
    expect(p.guest.phase).toBe('battle')
    const truth = p.host.debugRecord().state.units
    for (const unit of draft) expect(truth.find((u) => u.id === unit.id)?.anchor).toEqual(unit.anchor)
  })

  it('withdraws Confirm when a placement changes, as the engine does', async () => {
    const p = await connectPair()
    await lobbyToDeployment(p)
    await placeAll(p.guest)
    expectOk(await p.guest.dispatch({ kind: 'confirmDeployment', confirmed: true }))
    const unit = p.guest.view.units.find((u) => u.owner === 'guest' && !u.isCommander)
    if (unit === undefined) throw new Error('no unit')
    expectOk(await p.guest.dispatch({ kind: 'undeploy', unitId: unit.id }))
    await p.hub.settle()
    expect(p.guest.view.deploymentConfirmed.guest).toBe(false)
    expect(p.host.view.deploymentConfirmed.guest).toBe(false)
    expect(await p.guest.dispatch({ kind: 'confirmDeployment', confirmed: true })).toMatchObject({ ok: false, code: 'NOT_ALL_DEPLOYED' })
  })
})

describe('post-game audit (R37)', () => {
  it('replays the whole match and checks every commitment and hash', async () => {
    const p = await connectPair()
    await lobbyToDeployment(p)
    await deploymentToBattle(p)
    expect(p.guest.fairness.auditReady).toBe(false)
    await finish(p)
    expect(p.guest.fairness.auditReady).toBe(true)
    const verdict = p.guest.fairness.verify()
    expect(verdict).toMatchObject({ ok: true })
    expect(verdict?.checks ?? 0).toBeGreaterThan(5)
    expect(p.guest.fairness.verdict).toBe(verdict)
    expect(p.host.fairness.verify()).toMatchObject({ ok: true })
  })

  it('flags an audit that does not match what the guest was shown', async () => {
    const p = await connectPair()
    await lobbyToDeployment(p)
    await deploymentToBattle(p)
    await finish(p)
    const audit = auditOf(p).b
    const record = recordFromTraffic(p)
    expect(verifyAudit(audit, record)).toMatchObject({ ok: true })

    const forged = verifyAudit({ ...audit, salts: Object.fromEntries(Object.keys(audit.salts).map((hash) => [hash, 'forged'])) }, record)
    expect(forged.ok ? '' : forged.problems.join(' ')).toMatch(/army differs/)
    expect(forged.ok ? '' : forged.problems.join(' ')).toMatch(/deployment differs/)

    const shortened = verifyAudit({ ...audit, log: audit.log.slice(0, -1) }, record)
    expect(shortened.ok ? '' : shortened.problems.join(' ')).toMatch(/record stops at move/)

    const reordered = verifyAudit({ ...audit, log: [...audit.log].reverse() }, record)
    expect(reordered.ok).toBe(false)

    const otherSeed = verifyAudit({ ...audit, initial: { ...audit.initial, seed: 'another-seed' } }, { ...record, seedCommit: auditSeedCommit(p) })
    expect(otherSeed.ok ? '' : otherSeed.problems.join(' ')).toMatch(/seed differs/)
  })

  it('notices a host that changes its army after the guest revealed its own', async () => {
    const p = await connectPair()
    const guest = guestPeer(p)
    expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
    expectOk(await p.guest.lobby.setReady(true))
    expectOk(await p.host.lobby.setArmy(SMALL_ARMIES.host))
    p.hub.intercept = (m) => (m.from === guest && m.text.includes('"t":"coinReveal"') ? null : m.text) // the flip stalls
    expectOk(await p.host.lobby.setReady(true))
    await p.hub.settle()
    expect(p.host.debugRecord().state.seats.guest.army).toEqual(SMALL_ARMIES.guest) // revealed

    expectOk(await p.host.lobby.setArmy({ faction: 'empire', commander: 'trill', units: { berserker: 3 } })) // a counter-pick
    expectOk(await p.host.lobby.setReady(true))
    p.hub.intercept = null
    await p.hub.settle()
    expect(p.guest.fairness.notes.join(' ')).toMatch(/picked its army again after yours was revealed/)
    expect(p.guest.phase).toBe('deployment')
    await deploymentToBattle(p)
    await finish(p)
    const verdict = p.guest.fairness.verify()
    expect(verdict?.ok).toBe(false)
    expect(verdict !== null && !verdict.ok ? verdict.problems.join(' ') : '').toMatch(/army differs/)
  })
})

/** Rewrites the `against` of the guest's next reveal in flight, so the host's honest code refuses it (it still sees it). */
function spoilNextReveal(p: Pair): void {
  const guest = guestPeer(p)
  let spoiled = false
  p.hub.intercept = (m) => {
    if (spoiled || m.from !== guest || !m.text.includes('"t":"reveal"')) return m.text
    spoiled = true
    return m.text.replace(/"against":"[0-9a-f]+"/, `"against":"${'0'.repeat(64)}"`)
  }
}

const COUNTER_PICK: ArmyList = { faction: 'empire', commander: 'trill', units: { berserker: 3 } }

describe('a refused reveal still binds the host (R37)', () => {
  it('flags a host that refuses the first army reveal, then picks again', async () => {
    const p = await connectPair()
    expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
    expectOk(await p.guest.lobby.setReady(true))
    await p.hub.settle()
    spoilNextReveal(p)
    expectOk(await p.host.lobby.setArmy(SMALL_ARMIES.host))
    expectOk(await p.host.lobby.setReady(true))
    await p.hub.settle()
    expect(p.guest.phase).toBe('lobby') // refused: the host has the guest's army, the guest's ready is not used
    p.hub.intercept = null
    expectOk(await p.host.lobby.setArmy(COUNTER_PICK))
    expectOk(await p.host.lobby.setReady(true))
    await p.hub.settle()
    expect(p.guest.phase).toBe('deployment') // the guest revealed again against the new commitment
    expect(p.guest.fairness.notes.join(' ')).toMatch(/changed its army after yours was sent/)
    await deploymentToBattle(p)
    await finish(p)
    const verdict = p.guest.fairness.verify()
    expect(verdict !== null && !verdict.ok ? verdict.problems.join(' ') : '').toMatch(/army differs from the one it locked when you sent yours/)
  })

  it('flags a host that refuses the first deployment reveal, then moves a unit', async () => {
    const p = await connectPair()
    await lobbyToDeployment(p)
    await placeAll(p.guest)
    expectOk(await p.guest.dispatch({ kind: 'confirmDeployment', confirmed: true }))
    await p.hub.settle()
    await placeAll(p.host)
    spoilNextReveal(p)
    expectOk(await p.host.dispatch({ kind: 'confirmDeployment', confirmed: true }))
    await p.hub.settle()
    expect(p.guest.phase).toBe('deployment')
    p.hub.intercept = null
    const unit = p.host.view.units.find((u) => u.owner === 'host' && u.anchor !== null && !u.isCommander)
    if (unit?.anchor == null) throw new Error('no host unit placed')
    const view = p.host.view
    const anchor = (view.side === null ? [] : deploymentSquares(view.side, unit.type)).find((s) => validateIntent(view, { kind: 'deploy', unitId: unit.id, anchor: s }).ok && (s.x !== unit.anchor?.x || s.y !== unit.anchor.y))
    if (anchor === undefined) throw new Error('nowhere to move')
    expectOk(await p.host.dispatch({ kind: 'deploy', unitId: unit.id, anchor }))
    expectOk(await p.host.dispatch({ kind: 'confirmDeployment', confirmed: true }))
    await p.hub.settle()
    expect(p.guest.phase).toBe('battle')
    await finish(p)
    const verdict = p.guest.fairness.verify()
    expect(verdict !== null && !verdict.ok ? verdict.problems.join(' ') : '').toMatch(/deployment differs from the one it locked when you sent yours/)
  })
})

describe('the fairness record survives what a host may try (R37)', () => {
  it("keeps the commitments through a 'reset' snapshot that only replays the lobby", async () => {
    const p = await connectPair()
    const guest = guestPeer(p)
    expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
    expectOk(await p.guest.lobby.setReady(true))
    expectOk(await p.host.lobby.setArmy(SMALL_ARMIES.host))
    p.hub.intercept = (m) => (m.from === guest && m.text.includes('"t":"coinReveal"') ? null : m.text) // the flip stalls
    expectOk(await p.host.lobby.setReady(true))
    await p.hub.settle()
    expect(p.host.debugRecord().state.seats.guest.army).toEqual(SMALL_ARMIES.guest) // revealed
    const last = p.hub.log.filter((m) => m.to === guest && (m.text.includes('"t":"update"') || m.text.includes('"t":"snapshot"'))).at(-1)
    if (last === undefined) throw new Error('no delivery to replay')
    const replayed = JSON.parse(last.text) as { v: number; t: string; b: Record<string, unknown> }
    p.hub.inject(p.hub.peerIds()[0] ?? '', guest, JSON.stringify({ ...replayed, t: 'snapshot', b: { ...replayed.b, why: 'reset' } }))
    await p.hub.settle()
    expectOk(await p.host.lobby.setArmy(COUNTER_PICK))
    expectOk(await p.host.lobby.setReady(true))
    p.hub.intercept = null
    await p.hub.settle()
    expect(p.guest.fairness.notes.join(' ')).toMatch(/picked its army again after yours was revealed/)
    await deploymentToBattle(p)
    await finish(p)
    const verdict = p.guest.fairness.verify()
    expect(verdict?.ok).toBe(false)
  })

  it('notes a coin flip the host restarts after the guest sent its nonce, by toggling its own Ready', async () => {
    const p = await connectPair()
    const guest = guestPeer(p)
    expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
    expectOk(await p.guest.lobby.setReady(true))
    expectOk(await p.host.lobby.setArmy(SMALL_ARMIES.host))
    let dropped = 0
    p.hub.intercept = (m) => (m.from === guest && m.text.includes('"t":"coinReveal"') && dropped++ === 0 ? null : m.text)
    expectOk(await p.host.lobby.setReady(true))
    await p.hub.settle()
    expect(p.guest.phase).toBe('lobby') // the host withholds the start
    expectOk(await p.host.lobby.setReady(false))
    expectOk(await p.host.lobby.setReady(true))
    await p.hub.settle()
    expect(p.guest.phase).toBe('deployment')
    expect(p.guest.fairness.notes.join(' ')).toMatch(/restarted the coin flip after your nonce was sent, while you stayed ready \(once\)/)
  })

  it('sends a reveal lost to a dropped link again once the link is back, under the same id', async () => {
    const p = await connectPair()
    const guest = guestPeer(p)
    expectOk(await p.guest.lobby.setArmy(SMALL_ARMIES.guest))
    expectOk(await p.guest.lobby.setReady(true))
    await p.hub.settle()
    let lost = 0
    p.hub.intercept = (m) => (m.from === guest && m.text.includes('"t":"reveal"') && lost++ === 0 ? null : m.text)
    expectOk(await p.host.lobby.setArmy(SMALL_ARMIES.host))
    expectOk(await p.host.lobby.setReady(true))
    await p.hub.settle()
    p.hub.disconnect(guest)
    await p.hub.settle()
    p.hub.reconnect(guest)
    await p.hub.settle()
    p.clock.advance(100_000)
    await p.hub.settle()
    const reveals = p.hub.log.filter((m) => m.from === guest && m.text.includes('"t":"reveal"')).map((m) => (JSON.parse(m.text) as { b: { id: string } }).b.id)
    expect(reveals.length).toBeGreaterThanOrEqual(2)
    expect(new Set(reveals).size).toBe(1)
    expect(p.guest.phase).toBe('deployment')
  })
})
