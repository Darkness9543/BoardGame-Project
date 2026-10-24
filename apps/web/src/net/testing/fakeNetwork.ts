// An in-memory stand-in for Trystero's room API (makeAction send/receive, onPeerJoin, onPeerLeave, leave), so the
// session protocol runs end to end in a test with no network. Rooms are keyed by appId, roomId and password like
// Trystero's (peers with another secret never meet). Delivery is queued, as on a real network, and tests can drop,
// alter or inject messages and cut a peer off.

import { transportFromRoom, type RoomAction, type RoomJoin, type RoomLike, type TransportFactory } from '../transport'

export interface FakeMessage {
  readonly from: string
  readonly to: string
  readonly text: string
}

class FakeAction implements RoomAction {
  onMessage: ((data: string, context: { readonly peerId: string }) => void) | null = null

  constructor(private readonly room: FakeRoom) {}

  send(data: string, options?: { readonly target?: string | null }): Promise<void> {
    const target = options?.target
    const targets = target === undefined || target === null ? this.room.hub.peersBesides(this.room) : [target]
    for (const to of targets) this.room.hub.post(this.room.peerId, to, data)
    return Promise.resolve()
  }
}

export class FakeRoom implements RoomLike {
  onPeerJoin: ((peerId: string) => void) | null = null
  onPeerLeave: ((peerId: string) => void) | null = null
  private action: FakeAction | null = null

  constructor(
    readonly hub: FakeHub,
    readonly peerId: string,
    readonly key: string,
  ) {}

  makeAction(): RoomAction {
    this.action = new FakeAction(this)
    return this.action
  }

  leave(): Promise<void> {
    this.hub.remove(this)
    return Promise.resolve()
  }

  receive(from: string, text: string): void {
    this.action?.onMessage?.(text, { peerId: from })
  }
}

export class FakeHub {
  private readonly rooms = new Map<string, FakeRoom>()
  private readonly cutOff = new Set<string>()
  private queue: (() => void)[] = []
  private counter = 0
  /** Every message posted, in order, before any interception. */
  readonly log: FakeMessage[] = []
  /** Return null to drop a message in flight, or the text to deliver instead. */
  intercept: ((message: FakeMessage) => string | null) | null = null

  readonly factory: TransportFactory = (join, handlers) => Promise.resolve(transportFromRoom(this.join(join), handlers))

  join(join: RoomJoin): FakeRoom {
    const room = new FakeRoom(this, `peer-${++this.counter}`, `${join.appId}|${join.roomId}|${join.secret}`)
    const others = this.peersOf(room.key)
    this.rooms.set(room.peerId, room)
    for (const other of others) this.announce(other, room)
    return room
  }

  /** Peers currently in the room, newest last. */
  peerIds(): string[] {
    return [...this.rooms.keys()]
  }

  peersBesides(room: FakeRoom): string[] {
    return this.peersOf(room.key)
      .filter((p) => p.peerId !== room.peerId)
      .map((p) => p.peerId)
  }

  post(from: string, to: string, text: string): void {
    const message: FakeMessage = { from, to, text }
    this.log.push(message)
    if (this.cutOff.has(from) || this.cutOff.has(to)) return
    const delivered = this.intercept === null ? text : this.intercept(message)
    if (delivered === null) return
    this.queue.push(() => {
      const target = this.rooms.get(to)
      const sender = this.rooms.get(from)
      if (target !== undefined && sender !== undefined && sender.key === target.key && !this.cutOff.has(to) && !this.cutOff.has(from)) {
        target.receive(from, delivered)
      }
    })
  }

  /** Sends raw text as if `from` had sent it (malformed-input tests). */
  inject(from: string, to: string, text: string): void {
    this.queue.push(() => this.rooms.get(to)?.receive(from, text))
  }

  remove(room: FakeRoom): void {
    if (!this.rooms.delete(room.peerId)) return
    for (const other of this.peersOf(room.key)) this.queue.push(() => other.onPeerLeave?.(room.peerId))
  }

  /** The link of one peer drops: both sides see the other leave, and messages are lost until `reconnect`. */
  disconnect(peerId: string): void {
    const room = this.rooms.get(peerId)
    if (room === undefined || this.cutOff.has(peerId)) return
    this.cutOff.add(peerId)
    for (const other of this.peersOf(room.key)) {
      if (other.peerId === peerId) continue
      this.queue.push(() => other.onPeerLeave?.(peerId))
      this.queue.push(() => room.onPeerLeave?.(other.peerId))
    }
  }

  reconnect(peerId: string): void {
    const room = this.rooms.get(peerId)
    if (room === undefined || !this.cutOff.delete(peerId)) return
    for (const other of this.peersOf(room.key)) if (other.peerId !== peerId) this.announce(other, room)
  }

  /** Delivers queued events until none are left; returns how many ran. */
  flush(): number {
    let ran = 0
    while (this.queue.length > 0) {
      const next = this.queue.shift()
      next?.()
      ran += 1
      if (ran > 100_000) throw new Error('FakeHub: message storm')
    }
    return ran
  }

  /** Flushes until the network and the promise queues are both quiet. */
  async settle(): Promise<void> {
    for (let round = 0; round < 500; round++) {
      this.flush()
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (this.queue.length === 0) return
    }
    throw new Error('FakeHub: the network never settled')
  }

  private peersOf(key: string): FakeRoom[] {
    return [...this.rooms.values()].filter((r) => r.key === key)
  }

  private announce(a: FakeRoom, b: FakeRoom): void {
    this.queue.push(() => a.onPeerJoin?.(b.peerId))
    this.queue.push(() => b.onPeerJoin?.(a.peerId))
  }
}
