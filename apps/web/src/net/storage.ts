// Browser storage for what must survive a reload (NC 7.11, 7.12): the host's room (secret, record, guest seat,
// commitment salts) and the guest's join (secret, seat token, draft). Host and guest data use different keys,
// so two tabs of one browser can host and join the same room. Storage is an outside input, so every load is
// checked; a corrupt entry reads as missing.

import { restoreRecord, serializeRecord, type ArmyList, type MatchRecord, type Square, type UnitId } from '@coinduel/engine'
import { STORAGE_PREFIX } from './constants'
import { BAD, parseArmyList } from './guards'

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>()
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value)
    },
    remove: (key) => {
      data.delete(key)
    },
  }
}

/** localStorage when it works (private windows and blocked storage throw), otherwise memory for this page. */
export function browserStore(): KeyValueStore {
  const fallback = memoryStore()
  const local = (): Storage | null => {
    try {
      return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
    } catch {
      return null
    }
  }
  return {
    get(key) {
      try {
        return local()?.getItem(key) ?? fallback.get(key)
      } catch {
        return fallback.get(key)
      }
    },
    set(key, value) {
      try {
        const storage = local()
        if (storage === null) fallback.set(key, value)
        else storage.setItem(key, value)
      } catch {
        fallback.set(key, value)
      }
    },
    remove(key) {
      fallback.remove(key)
      try {
        local()?.removeItem(key)
      } catch {
        // nothing to remove
      }
    },
  }
}

function readJson(store: KeyValueStore, key: string): Record<string, unknown> | null {
  const raw = store.get(key)
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const isText = (value: unknown): value is string => typeof value === 'string'

// ---------------------------------------------------------------- host rooms

export interface HostRoomSave {
  readonly roomId: string
  readonly secret: string
  readonly hostName: string
  readonly record: MatchRecord
  readonly guest: { readonly tokenHash: string; readonly name: string } | null
  readonly salts: Readonly<Record<string, string>>
}

const hostKey = (roomId: string): string => `${STORAGE_PREFIX}room:${roomId}`

export function saveHostRoom(store: KeyValueStore, save: HostRoomSave): void {
  store.set(
    hostKey(save.roomId),
    JSON.stringify({ v: 1, roomId: save.roomId, secret: save.secret, hostName: save.hostName, record: serializeRecord(save.record), guest: save.guest, salts: save.salts }),
  )
}

export function loadHostRoom(store: KeyValueStore, roomId: string): HostRoomSave | null {
  const data = readJson(store, hostKey(roomId))
  if (data === null || data['v'] !== 1 || !isText(data['secret']) || !isText(data['hostName']) || !isText(data['record'])) return null
  const guest = data['guest']
  const salts = data['salts']
  let record: MatchRecord
  try {
    record = restoreRecord(data['record'])
  } catch {
    return null
  }
  const seat =
    typeof guest === 'object' && guest !== null && 'tokenHash' in guest && 'name' in guest && isText(guest.tokenHash) && isText(guest.name)
      ? { tokenHash: guest.tokenHash, name: guest.name }
      : null
  const saltMap: Record<string, string> = {}
  if (typeof salts === 'object' && salts !== null) for (const [k, v] of Object.entries(salts)) if (isText(v)) saltMap[k] = v
  return { roomId, secret: data['secret'], hostName: data['hostName'], record, guest: seat, salts: saltMap }
}

export function forgetHostRoom(store: KeyValueStore, roomId: string): void {
  store.remove(hostKey(roomId))
}

// ---------------------------------------------------------------- guest joins

export interface GuestJoinSave {
  readonly roomId: string
  readonly secret: string
  readonly name: string
  readonly seatToken: string | null
  readonly army: ArmyList | null
  readonly placements: Readonly<Record<UnitId, Square>>
}

const joinKey = (roomId: string): string => `${STORAGE_PREFIX}join:${roomId}`

export function saveGuestJoin(store: KeyValueStore, save: GuestJoinSave): void {
  store.set(joinKey(save.roomId), JSON.stringify({ v: 1, ...save }))
}

function isSquare(value: unknown): value is Square {
  return typeof value === 'object' && value !== null && 'x' in value && 'y' in value && Number.isInteger(value.x) && Number.isInteger(value.y)
}

export function forgetGuestJoin(store: KeyValueStore, roomId: string): void {
  store.remove(joinKey(roomId))
}

export function loadGuestJoin(store: KeyValueStore, roomId: string): GuestJoinSave | null {
  const data = readJson(store, joinKey(roomId))
  if (data === null || data['v'] !== 1 || !isText(data['secret']) || !isText(data['name'])) return null
  const token = data['seatToken']
  const army = data['army'] === null || data['army'] === undefined ? null : parseArmyList(data['army'])
  const placements: Record<UnitId, Square> = {}
  const rawPlacements = data['placements']
  if (typeof rawPlacements === 'object' && rawPlacements !== null) {
    for (const [unitId, anchor] of Object.entries(rawPlacements)) if (isSquare(anchor)) placements[unitId] = { x: anchor.x, y: anchor.y }
  }
  return {
    roomId,
    secret: data['secret'],
    name: data['name'],
    seatToken: isText(token) ? token : null,
    army: army === BAD ? null : army,
    placements,
  }
}
