// The seam between the session protocol and the network (NC 7.3). A transport moves JSON text between peers
// of one room and reports peers joining and leaving; it knows nothing about the game. `transportFromRoom`
// adapts anything shaped like a Trystero room (the real one, or the in-memory fake the tests use), so the only
// Trystero-specific code left is the joinRoom call in trysteroTransport.ts.

export type PeerId = string

export type TransportProblemKind = 'insecure-context' | 'join-failed' | 'send-failed' | 'unavailable'

export interface TransportProblem {
  readonly kind: TransportProblemKind
  readonly detail: string
}

/** Thrown by a transport factory that cannot start at all (no secure context, library failed to load). */
export class TransportError extends Error {
  constructor(
    readonly kind: TransportProblemKind,
    message: string,
  ) {
    super(message)
    this.name = 'TransportError'
  }
}

/** Bound when the transport is created, so no event can arrive before the session listens. */
export interface TransportHandlers {
  onMessage(peer: PeerId, text: string): void
  onPeerJoin(peer: PeerId): void
  onPeerLeave(peer: PeerId): void
  onProblem(problem: TransportProblem): void
}

export interface Transport {
  send(peer: PeerId, text: string): void
  close(): void
}

/** STUN/TURN entries as RTCIceServer and Trystero's turnConfig take them. */
export interface IceServer {
  readonly urls: string | readonly string[]
  readonly username?: string
  readonly credential?: string
}

/** Everything a transport needs to join one game's room. */
export interface RoomJoin {
  readonly appId: string
  readonly roomId: string
  /** The invite secret: Trystero's password, which encrypts the SDP on the signalling relays. */
  readonly secret: string
  /** Extra ICE servers (TURN); the library's default STUN servers are always used too. */
  readonly iceServers: readonly IceServer[]
}

export type TransportFactory = (join: RoomJoin, handlers: TransportHandlers) => Promise<Transport>

/** One message channel of a room, as Trystero's makeAction returns it (string payloads only). */
export interface RoomAction {
  send(data: string, options?: { readonly target?: string | null }): Promise<void>
  onMessage: ((data: string, context: { readonly peerId: string }) => void) | null
}

/** The part of a Trystero Room this layer uses. */
export interface RoomLike {
  makeAction(namespace: string): RoomAction
  onPeerJoin: ((peerId: string) => void) | null
  onPeerLeave: ((peerId: string) => void) | null
  leave(): Promise<void>
}

/** One channel carries the whole protocol; the message type is inside the JSON. */
export const MESSAGE_ACTION = 'm'

export function transportFromRoom(room: RoomLike, handlers: TransportHandlers): Transport {
  const action = room.makeAction(MESSAGE_ACTION)
  let closed = false
  action.onMessage = (data, context) => {
    if (!closed && typeof data === 'string') handlers.onMessage(context.peerId, data)
  }
  room.onPeerJoin = (peer) => {
    if (!closed) handlers.onPeerJoin(peer)
  }
  room.onPeerLeave = (peer) => {
    if (!closed) handlers.onPeerLeave(peer)
  }
  return {
    send(peer, text) {
      if (closed) return
      action.send(text, { target: peer }).catch((error: unknown) => {
        handlers.onProblem({ kind: 'send-failed', detail: error instanceof Error ? error.message : String(error) })
      })
    },
    close() {
      if (closed) return
      closed = true
      action.onMessage = null
      room.onPeerJoin = null
      room.onPeerLeave = null
      void room.leave()
    },
  }
}
