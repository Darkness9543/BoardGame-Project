// A reaction prompt the guest can't know about (2.11, 4.8): the host's own revive prompt after its unit dies on an
// unwatched mine. Nothing the guest receives may change because of it: not the clock, not the answer to a probe, not
// the fate of an intent it sent meanwhile.

import { describe, expect, it } from 'vitest'
import { buildBattle, parseSquare, startRecord } from '@coinduel/engine'
import type { DispatchResult } from '../contracts'
import { HEARTBEAT_INTERVAL_MS } from './constants'
import { decodeHostMessage } from './guards'
import { expectOk } from './testing/flows'
import { connectPair, type Pair } from './testing/harness'

async function promptPending(): Promise<Pair> {
  const b = buildBattle({
    south: ['commander@E3:Q', { type: 'soldier', at: 'E4', label: 'S', toughness: 1 }],
    north: ['commander@U25'],
    commanders: { south: 'queso' },
    mines: [{ owner: 'north', at: 'E5' }],
    settings: { turnTimerSeconds: 90, timeBankSeconds: 60 },
  })
  const p = await connectPair({ record: startRecord(b.state) })
  expect(p.guest.phase).toBe('battle')
  expectOk(await p.host.dispatch({ kind: 'move', unitId: b.id('S'), path: [parseSquare('E5')] }))
  await p.hub.settle()
  expect(p.host.pendingReaction?.kind).toBe('queso.revive')
  expect(p.guest.view.opponentDeciding).toBe(false)
  return p
}

function guestPeer(p: Pair): string {
  return p.hub.peerIds()[1] ?? ''
}

/** Lets time pass one heartbeat at a time, delivering the pings in between. */
async function elapse(p: Pair, ms: number): Promise<void> {
  for (let spent = 0; spent < ms; spent += HEARTBEAT_INTERVAL_MS) {
    p.clock.advance(Math.min(HEARTBEAT_INTERVAL_MS, ms - spent))
    await p.hub.settle()
  }
}

describe('a prompt hidden from the guest (2.11)', () => {
  it('keeps the clock running for the guest, while the host sees it stopped (R29), in every message it gets', async () => {
    const p = await promptPending()
    expect(p.host.clock).toMatchObject({ running: false, pausedBy: 'decision' })
    expect(p.guest.clock).toMatchObject({ running: true, pausedBy: null })
    await elapse(p, 10_000)
    const clocks = p.hub.log
      .filter((m) => m.to === guestPeer(p))
      .flatMap((m) => {
        const decoded = decodeHostMessage(m.text)
        if (!decoded.ok) return []
        const message = decoded.message
        return message.t === 'update' || message.t === 'snapshot' || message.t === 'meta' || message.t === 'synced' ? [message.b.meta.clock] : []
      })
    expect(clocks.length).toBeGreaterThan(0)
    expect(clocks.every((c) => c === null || c.pausedBy !== 'decision')).toBe(true)
  })

  it('answers an illegal probe at once, as if there were no prompt', async () => {
    const p = await promptPending()
    let answer: DispatchResult | null = null
    void p.guest.dispatch({ kind: 'endTurn' }).then((r) => (answer = r))
    await p.hub.settle()
    expect(answer).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' })
  })

  it('keeps an intent queued behind it pending across a reconnect, then applies it', async () => {
    const p = await promptPending()
    let answer: DispatchResult | null = null
    void p.guest.dispatch({ kind: 'offerDraw' }).then((r) => (answer = r))
    await p.hub.settle()
    expect(answer).toBeNull() // waits like an animation pause
    p.hub.disconnect(guestPeer(p))
    await p.hub.settle()
    p.hub.reconnect(guestPeer(p))
    await p.hub.settle()
    expect(answer).toBeNull() // not "Your last action was not sent"
    await elapse(p, HEARTBEAT_INTERVAL_MS)
    const intentId = (JSON.parse(p.hub.log.find((m) => m.from === guestPeer(p) && m.text.includes('"t":"intent"'))?.text ?? '{}') as { b?: { id?: string } }).b?.id
    const pings = p.hub.log.filter((m) => m.to === guestPeer(p) && m.text.includes('"t":"ping"'))
    expect(pings.some((m) => intentId !== undefined && m.text.includes(intentId))).toBe(true) // the host says it still holds it
    await elapse(p, 20_000) // the host's prompt answers itself (A2-30), and the queue drains
    expect(p.host.pendingReaction).toBeNull()
    expect(answer).toEqual({ ok: true })
    expect(p.host.debugRecord().state.drawOffer).toBe('guest')
  })
})
