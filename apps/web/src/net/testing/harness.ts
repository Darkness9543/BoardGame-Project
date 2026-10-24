// The loopback harness: a real HostSession and GuestSession wired through the in-memory FakeHub, on one manual
// clock, so the whole protocol runs in a test exactly as it would over Trystero, minus the network.

import type { MatchRecord, MatchSettings } from '@coinduel/engine'
import { createSession } from '../createSession'
import { headlessEnvironment } from '../environment'
import { GuestSession } from '../guestSession'
import { decodeHostMessage } from '../guards'
import { HostSession } from '../hostSession'
import { parseInviteText, type Invite } from '../invite'
import type { HostMessage } from '../messages'
import { memoryStore, type KeyValueStore } from '../storage'
import type { Versions } from '../versions'
import { FakeHub } from './fakeNetwork'
import { ManualClock } from './manualClock'

export const BASE_URL = 'https://friends.example/coinduel/'

export interface Pair {
  readonly hub: FakeHub
  readonly clock: ManualClock
  readonly host: HostSession
  readonly guest: GuestSession
  readonly invite: Invite
  readonly hostStore: KeyValueStore
  readonly guestStore: KeyValueStore
  readonly hostEnv: Env
  readonly guestEnv: Env
}

export interface PairOptions {
  readonly settings?: Partial<MatchSettings>
  readonly record?: MatchRecord
  readonly guestVersions?: Partial<Versions>
  readonly guestName?: string
}

type Env = ReturnType<typeof headlessEnvironment>

export function hostOn(
  hub: FakeHub,
  clock: ManualClock,
  store: KeyValueStore,
  options: PairOptions & { readonly resume?: string } = {},
  environment: Env = headlessEnvironment(BASE_URL),
): HostSession {
  const session = createSession({
    mode: 'host',
    name: 'Hana',
    clock,
    storage: store,
    transport: hub.factory,
    environment,
    settings: { scenarioId: 'openField', ...options.settings },
    ...(options.record === undefined ? {} : { record: options.record }),
    ...(options.resume === undefined ? {} : { resume: options.resume }),
  })
  if (!(session instanceof HostSession)) throw new Error('not a host session')
  return session
}

export function guestOn(
  hub: FakeHub,
  clock: ManualClock,
  store: KeyValueStore,
  invite: Invite,
  options: PairOptions = {},
  environment: Env = headlessEnvironment(),
): GuestSession {
  const session = createSession({
    mode: 'guest',
    name: options.guestName ?? 'Gil',
    invite,
    clock,
    storage: store,
    transport: hub.factory,
    environment,
    ...(options.guestVersions === undefined ? {} : { versions: options.guestVersions }),
  })
  if (!(session instanceof GuestSession)) throw new Error('not a guest session')
  return session
}

/** A host, then a guest that opened its invite link; both connected and settled. */
export async function connectPair(options: PairOptions = {}): Promise<Pair> {
  const hub = new FakeHub()
  const clock = new ManualClock()
  const hostStore = memoryStore()
  const guestStore = memoryStore()
  const hostEnv = headlessEnvironment(BASE_URL)
  const guestEnv = headlessEnvironment()
  const host = hostOn(hub, clock, hostStore, options, hostEnv)
  const invite = parseInviteText(host.room.inviteLink ?? '')
  if (invite === null) throw new Error('the host has no invite link')
  const guest = guestOn(hub, clock, guestStore, invite, options, guestEnv)
  await hub.settle()
  return { hub, clock, host, guest, invite, hostStore, guestStore, hostEnv, guestEnv }
}

/** Every host message the hub carried to `peer`, decoded. */
export function messagesTo(hub: FakeHub, peer: string): HostMessage[] {
  return hub.log.filter((m) => m.to === peer).flatMap((m) => {
    const decoded = decodeHostMessage(m.text)
    return decoded.ok ? [decoded.message] : []
  })
}

/** The type of every message `from` sent, in order. */
export function typesFrom(hub: FakeHub, from: string): string[] {
  return hub.log.filter((m) => m.from === from).map((m) => (JSON.parse(m.text) as { t: string }).t)
}
