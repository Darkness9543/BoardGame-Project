import { describe, expect, it } from 'vitest'
import { createGame, hashState, startRecord, type MatchSummary } from '@coinduel/engine'
import { STORAGE_PREFIX } from './constants'
import { appendMatchLog, clearMatchLog, readMatchLog, type MatchLogEntry } from './matchLog'
import { browserStore, forgetHostRoom, loadGuestJoin, loadHostRoom, memoryStore, saveGuestJoin, saveHostRoom } from './storage'
import { SMALL_ARMIES } from './testing/flows'

const summary: MatchSummary = {
  winner: 'host',
  reason: 'conquest',
  turns: 12,
  rounds: 6,
  southSeat: 'host',
  scenarioId: 'crossroads',
  armies: { host: SMALL_ARMIES.host, guest: SMALL_ARMIES.guest },
  commanders: { host: 'trill', guest: 'ratasius' },
  commanderVariants: { host: null, guest: null },
  unitTypes: { host: {}, guest: {} },
}

const entry = (id: string): MatchLogEntry => ({ id, finishedAt: 1, mode: 'host', seat: 'host', names: { host: 'A', guest: 'B' }, summary })

describe('room persistence (NC 7.11, 7.12)', () => {
  it('round-trips a host room, rebuilding the record by replay', () => {
    const store = memoryStore()
    const record = startRecord(createGame({ seed: 'persist' }))
    saveHostRoom(store, { roomId: 'R', secret: 'S', hostName: 'Hana', record, guest: { tokenHash: 'h', name: 'Gil' }, salts: { c: 's' } })
    const loaded = loadHostRoom(store, 'R')
    expect(loaded).toMatchObject({ roomId: 'R', secret: 'S', hostName: 'Hana', guest: { tokenHash: 'h', name: 'Gil' }, salts: { c: 's' } })
    expect(loaded === null ? '' : hashState(loaded.record.state)).toBe(hashState(record.state))
    forgetHostRoom(store, 'R')
    expect(loadHostRoom(store, 'R')).toBeNull()
  })

  it('round-trips a guest join with its draft, and reads corrupt entries as missing', () => {
    const store = memoryStore()
    saveGuestJoin(store, { roomId: 'R', secret: 'S', name: 'Gil', seatToken: 'T', army: SMALL_ARMIES.guest, placements: { 'u-1': { x: 2, y: 1 } } })
    expect(loadGuestJoin(store, 'R')).toEqual({ roomId: 'R', secret: 'S', name: 'Gil', seatToken: 'T', army: SMALL_ARMIES.guest, placements: { 'u-1': { x: 2, y: 1 } } })
    store.set(`${STORAGE_PREFIX}join:R`, '{"v":1,"secret":5}')
    expect(loadGuestJoin(store, 'R')).toBeNull()
    store.set(`${STORAGE_PREFIX}room:R`, 'not json')
    expect(loadHostRoom(store, 'R')).toBeNull()
  })

  it('falls back to memory where there is no localStorage', () => {
    const store = browserStore()
    store.set('k', 'v')
    expect(store.get('k')).toBe('v')
    store.remove('k')
    expect(store.get('k')).toBeNull()
  })
})

describe('local match log (R38)', () => {
  it('keeps finished matches newest first, once each', () => {
    const store = memoryStore()
    appendMatchLog(store, entry('a'))
    appendMatchLog(store, entry('b'))
    appendMatchLog(store, entry('a'))
    expect(readMatchLog(store).map((e) => e.id)).toEqual(['b', 'a'])
    clearMatchLog(store)
    expect(readMatchLog(store)).toEqual([])
  })

  it('ignores a corrupt log', () => {
    const store = memoryStore()
    store.set(`${STORAGE_PREFIX}matchLog`, '[{"id":1},"x"]')
    expect(readMatchLog(store)).toEqual([])
  })
})
