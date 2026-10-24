// The app's session provider for online play (the shape of apps/web/src/store/sessionProvider.ts, matched
// structurally so this layer does not depend on the store). It keeps one live session per room and knows how to
// reopen a room this browser hosts or joined. Integration: setSessionProvider(netProvider()).

import type { MatchSettings } from '@coinduel/engine'
import type { Clock } from './clock'
import { canResumeHost, createSession } from './createSession'
import type { NetSettings } from './ice'
import { browserStore, forgetGuestJoin, forgetHostRoom, loadGuestJoin, type KeyValueStore } from './storage'
import type { TransportFactory } from './transport'
import type { NetSession } from './types'

export interface NetProviderOptions {
  readonly storage?: KeyValueStore
  readonly net?: Partial<NetSettings>
  readonly build?: string
  readonly transport?: TransportFactory
  readonly clock?: Clock
  readonly baseUrl?: string
}

export interface NetProvider {
  readonly name: string
  host(request: { readonly name: string; readonly settings?: Partial<MatchSettings> }): Promise<{ readonly roomId: string; readonly session: NetSession }>
  join(request: { readonly roomId: string; readonly secret: string; readonly name: string }): Promise<NetSession>
  resume(roomId: string, name: string): Promise<NetSession | null>
  leave(roomId: string): void
  rematch(roomId: string): Promise<NetSession>
}

export function netProvider(options: NetProviderOptions = {}): NetProvider {
  const storage = options.storage ?? browserStore()
  const live = new Map<string, NetSession>()
  const common = {
    storage,
    ...(options.net === undefined ? {} : { net: options.net }),
    ...(options.build === undefined ? {} : { build: options.build }),
    ...(options.transport === undefined ? {} : { transport: options.transport }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  }
  const keep = (roomId: string, session: NetSession): NetSession => {
    live.set(roomId, session)
    return session
  }
  return {
    name: 'Online (peer-to-peer)',
    async host(request) {
      const session = createSession({
        mode: 'host',
        name: request.name,
        ...common,
        ...(request.settings === undefined ? {} : { settings: request.settings }),
        ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }),
      })
      const roomId = session.room?.roomId
      if (roomId === undefined) throw new Error('The host session has no room')
      return { roomId, session: keep(roomId, session) }
    },
    async join(request) {
      const existing = live.get(request.roomId)
      if (existing?.mode === 'host') throw new Error('You are the host of this game: send the link to your friend, or open it in another browser')
      if (existing !== undefined) return existing
      return keep(request.roomId, createSession({ mode: 'guest', name: request.name, invite: { roomId: request.roomId, secret: request.secret }, ...common }))
    },
    async resume(roomId, name) {
      const existing = live.get(roomId)
      if (existing !== undefined) return existing
      if (canResumeHost(roomId, storage)) return keep(roomId, createSession({ mode: 'host', name, resume: roomId, ...common }))
      const joined = loadGuestJoin(storage, roomId)
      if (joined === null) return null
      return keep(roomId, createSession({ mode: 'guest', name: joined.name, invite: { roomId, secret: joined.secret }, ...common }))
    },
    leave(roomId) {
      live.get(roomId)?.close()
      live.delete(roomId)
      forgetHostRoom(storage, roomId)
      forgetGuestJoin(storage, roomId)
    },
    async rematch(roomId) {
      const session = live.get(roomId)
      if (session === undefined || session.mode !== 'host') throw new Error('Only the host starts a rematch')
      const result = await session.rematch()
      if (!result.ok) throw new Error(result.message)
      return session
    },
  }
}
