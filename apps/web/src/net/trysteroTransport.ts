// The only module that touches Trystero (serverless WebRTC; signalling over public Nostr relays, NC 4.2). It is
// imported lazily by createSession, so tests and the sandbox never load it. Game data never touches the relays:
// they carry only the SDP, encrypted with the invite secret as password, and the data channel is end-to-end
// DTLS between the two browsers.
//
// Trystero needs a secure context (https:// or http://localhost): it hashes and encrypts with crypto.subtle,
// which plain http://<LAN-IP> (e.g. `vite --host` opened from a phone) does not have (NC 0 #5, 8.4).

import { joinRoom } from 'trystero/nostr'
import { MAX_GUEST_MESSAGE_CHARS, MAX_HOST_MESSAGE_CHARS } from './constants'
import { TransportError, transportFromRoom, type IceServer, type RoomLike, type TransportFactory } from './transport'

/** The largest message either side sends (UTF-16 chars; up to 3 bytes each in UTF-8). */
const MAX_RECEIVE_BYTES = 3 * Math.max(MAX_GUEST_MESSAGE_CHARS, MAX_HOST_MESSAGE_CHARS)

function turnConfig(servers: readonly IceServer[]): { urls: string | string[]; username?: string; credential?: string }[] {
  return servers.map((s) => ({
    urls: typeof s.urls === 'string' ? s.urls : [...s.urls],
    ...(s.username === undefined ? {} : { username: s.username }),
    ...(s.credential === undefined ? {} : { credential: s.credential }),
  }))
}

export const createTrysteroTransport: TransportFactory = async (join, handlers) => {
  if (!globalThis.isSecureContext || globalThis.crypto?.subtle === undefined) {
    throw new TransportError(
      'insecure-context',
      'Online play needs a secure page: open the game over https:// or on http://localhost. ' +
        'A plain http:// address on your network (for example from a phone) cannot connect.',
    )
  }
  const room: RoomLike = joinRoom(
    { appId: join.appId, password: join.secret, turnConfig: turnConfig(join.iceServers), maxReceiveBytes: MAX_RECEIVE_BYTES },
    join.roomId,
    { onJoinError: (details) => handlers.onProblem({ kind: 'join-failed', detail: details.error }) },
  )
  return transportFromRoom(room, handlers)
}
