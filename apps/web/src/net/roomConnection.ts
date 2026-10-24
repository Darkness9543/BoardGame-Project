// Opens (and reopens) the transport of one room. Each opening is a generation: events from a transport that has
// since been replaced or closed are ignored, so a slow factory or a late peer event can't confuse the session.
// Peer events can arrive before the factory has returned the transport (Trystero replays peers already in the
// room as soon as a handler is set), so sends made meanwhile wait in an outbox.

import { resolveIceServers, type NetSettings } from './ice'
import type { PeerId, RoomJoin, Transport, TransportFactory, TransportHandlers } from './transport'

export interface RoomConnectionHandlers extends TransportHandlers {
  /** The factory failed (no secure context, library failed to load, ...). */
  onConnectError(error: unknown): void
}

/** More than a handshake's worth of messages waiting for a transport means something is wrong; the rest drop. */
const OUTBOX_LIMIT = 64

export class RoomConnection {
  private generation = 0
  private transport: Transport | null = null
  private outbox: { readonly peer: PeerId; readonly text: string }[] = []

  constructor(
    private readonly room: Omit<RoomJoin, 'iceServers'>,
    private readonly net: NetSettings,
    private readonly factory: TransportFactory,
    private readonly handlers: RoomConnectionHandlers,
  ) {}

  open(): void {
    this.transport?.close()
    this.transport = null
    this.outbox = []
    const generation = ++this.generation
    const live = (): boolean => generation === this.generation
    const handlers: TransportHandlers = {
      onMessage: (peer, text) => {
        if (live()) this.handlers.onMessage(peer, text)
      },
      onPeerJoin: (peer) => {
        if (live()) this.handlers.onPeerJoin(peer)
      },
      onPeerLeave: (peer) => {
        if (live()) this.handlers.onPeerLeave(peer)
      },
      onProblem: (problem) => {
        if (live()) this.handlers.onProblem(problem)
      },
    }
    void resolveIceServers(this.net)
      .then((iceServers) => this.factory({ ...this.room, iceServers }, handlers))
      .then((transport) => {
        if (!live()) {
          transport.close()
          return
        }
        this.transport = transport
        for (const { peer, text } of this.outbox.splice(0)) transport.send(peer, text)
      })
      .catch((error: unknown) => {
        if (live()) this.handlers.onConnectError(error)
      })
  }

  send(peer: PeerId, text: string): void {
    if (this.transport !== null) this.transport.send(peer, text)
    else if (this.outbox.length < OUTBOX_LIMIT) this.outbox.push({ peer, text })
  }

  close(): void {
    this.generation += 1
    this.outbox = []
    this.transport?.close()
    this.transport = null
  }
}
