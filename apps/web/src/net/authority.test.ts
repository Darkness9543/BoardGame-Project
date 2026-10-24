import { describe, expect, it } from 'vitest'
import { createGame, startRecord, submit, type MatchRecord, type Seat } from '@coinduel/engine'
import { MatchAuthority, type SeatDelivery } from './authority'
import { SMALL_ARMIES } from './testing/flows'
import { ManualClock } from './testing/manualClock'

function deploymentRecord(): MatchRecord {
  let record = startRecord(createGame({ seed: 'auth', settings: { scenarioId: 'openField' } }))
  for (const [seat, intent] of [
    ['host', { kind: 'setArmy', army: SMALL_ARMIES.host }],
    ['guest', { kind: 'setArmy', army: SMALL_ARMIES.guest }],
    ['host', { kind: 'setReady', ready: true }],
    ['guest', { kind: 'setReady', ready: true }],
    ['host', { kind: 'startDeployment', coinSeed: 'c' }],
  ] as const) {
    const result = submit(record, seat, intent)
    if (!result.ok) throw new Error(result.message)
    record = result.record
  }
  return record
}

function watched(record: MatchRecord): { authority: MatchAuthority; deliveries: { seat: Seat; delivery: SeatDelivery }[] } {
  const deliveries: { seat: Seat; delivery: SeatDelivery }[] = []
  const authority = new MatchAuthority(record, new ManualClock(), { deliver: (seat, delivery) => deliveries.push({ seat, delivery }), changed: () => undefined })
  return { authority, deliveries }
}

describe('MatchAuthority', () => {
  it('sends a seat nothing when nothing it can see changed (a hidden placement)', async () => {
    const { authority, deliveries } = watched(deploymentRecord())
    const unit = authority.view('host').units.find((u) => u.owner === 'host' && !u.isCommander)
    const side = authority.view('host').side
    if (unit === undefined || side === null) throw new Error('no unit')
    const anchor = { x: 12, y: side === 'south' ? 0 : 24 }
    expect(await authority.submit('host', { kind: 'deploy', unitId: unit.id, anchor })).toEqual({ ok: true })
    expect(deliveries.map((d) => d.seat)).toEqual(['host'])
    expect(deliveries[0]?.delivery).toMatchObject({ why: 'update', seq: 1, logLength: 6 })
  })

  it('applies a batch all at once or not at all', () => {
    const { authority, deliveries } = watched(deploymentRecord())
    const units = authority.view('guest').units.filter((u) => u.owner === 'guest')
    const side = authority.view('guest').side
    const first = units[0]
    if (first === undefined || side === null) throw new Error('no unit')
    const row = side === 'south' ? 0 : 24
    const bad = authority.submitBatch('guest', [
      { kind: 'deploy', unitId: first.id, anchor: { x: 10, y: row } },
      { kind: 'deploy', unitId: 'u-nobody', anchor: { x: 11, y: row } },
    ])
    expect(bad).toMatchObject({ ok: false, code: 'UNKNOWN_UNIT' })
    expect(deliveries).toEqual([])
    expect(authority.record.log).toHaveLength(5)
    const good = authority.submitBatch(
      'guest',
      units.map((u, i) => ({ kind: 'deploy' as const, unitId: u.id, anchor: { x: 10 + i, y: row } })),
    )
    expect(good).toEqual({ ok: true })
    expect(authority.record.log).toHaveLength(5 + units.length)
    expect(deliveries.filter((d) => d.seat === 'guest')).toHaveLength(1)
  })

  it('starts a new epoch and snapshots both seats when the record is replaced', () => {
    const { authority, deliveries } = watched(deploymentRecord())
    authority.replaceRecord(startRecord(createGame({ seed: 'fresh' })))
    expect(authority.epoch).toBe(1)
    expect(deliveries.map((d) => [d.seat, d.delivery.why])).toEqual([
      ['host', 'reset'],
      ['guest', 'reset'],
    ])
  })

  it('refuses everything once disposed', async () => {
    const { authority } = watched(deploymentRecord())
    authority.dispose()
    expect(await authority.submit('host', { kind: 'resign' })).toMatchObject({ ok: false, code: 'NOT_CONNECTED' })
  })
})
