// The one entry point: createSession(config) builds the sandbox, a host, or a guest. The Trystero transport is
// imported lazily, so the sandbox and the tests never load it and it stays out of the first bundle chunk.

import { createGame, startRecord } from '@coinduel/engine'
import { systemClock } from './clock'
import { browserEnvironment } from './environment'
import { cleanName } from './guards'
import { GuestSession } from './guestSession'
import { HostSession } from './hostSession'
import { netSettings } from './ice'
import { createLocalSession } from './localSession'
import { cryptoRandom, newRoomId, newSecret, newSeed } from './random'
import { browserStore, loadGuestJoin, loadHostRoom, type KeyValueStore } from './storage'
import { TransportError, type TransportFactory } from './transport'
import type { GuestSessionConfig, HostSessionConfig, LocalSession, LocalSessionConfig, NetSession, SessionConfig } from './types'
import { localVersions } from './versions'

const lazyTrystero: TransportFactory = async (join, handlers) => {
  let module: typeof import('./trysteroTransport')
  try {
    module = await import('./trysteroTransport')
  } catch {
    throw new TransportError('unavailable', 'Could not load the networking library. Check your connection and reload the page.')
  }
  return module.createTrysteroTransport(join, handlers)
}

function hostSession(config: HostSessionConfig): NetSession {
  const storage = config.storage ?? browserStore()
  const random = config.random ?? cryptoRandom
  const environment = config.environment ?? browserEnvironment
  const saved = config.resume === undefined ? null : loadHostRoom(storage, config.resume)
  if (config.resume !== undefined && saved === null) throw new Error(`There is no saved room ${config.resume} in this browser`)
  const hostName = saved?.hostName ?? cleanName(config.name, 'Host')
  const record =
    saved?.record ??
    config.record ??
    startRecord(createGame({ seed: newSeed(random), names: { host: hostName }, ...(config.settings === undefined ? {} : { settings: config.settings }) }))
  return new HostSession({
    invite: saved === null ? { roomId: newRoomId(random), secret: newSecret(random) } : { roomId: saved.roomId, secret: saved.secret },
    hostName,
    record,
    guest: saved?.guest ?? null,
    salts: saved?.salts ?? {},
    net: netSettings(config.net),
    transport: config.transport ?? lazyTrystero,
    clock: config.clock ?? systemClock,
    random,
    storage,
    environment,
    baseUrl: config.baseUrl ?? environment.baseUrl(),
    versions: localVersions(config.build ?? 'dev', config.versions),
  })
}

function guestSession(config: GuestSessionConfig): NetSession {
  const storage = config.storage ?? browserStore()
  const saved = loadGuestJoin(storage, config.invite.roomId)
  return new GuestSession({
    invite: config.invite,
    name: config.name,
    saved: saved !== null && saved.secret === config.invite.secret ? saved : null,
    net: netSettings(config.net),
    transport: config.transport ?? lazyTrystero,
    clock: config.clock ?? systemClock,
    random: config.random ?? cryptoRandom,
    storage,
    environment: config.environment ?? browserEnvironment,
    versions: localVersions(config.build ?? 'dev', config.versions),
  })
}

export function createSession(config: LocalSessionConfig): LocalSession
export function createSession(config: HostSessionConfig | GuestSessionConfig): NetSession
export function createSession(config: SessionConfig): NetSession
export function createSession(config: SessionConfig): NetSession {
  switch (config.mode) {
    case 'local':
      return createLocalSession(config)
    case 'host':
      return hostSession(config)
    case 'guest':
      return guestSession(config)
  }
}

/** Whether `#/host/<roomId>` can be reopened in this browser. */
export function canResumeHost(roomId: string, storage: KeyValueStore = browserStore()): boolean {
  return loadHostRoom(storage, roomId) !== null
}
