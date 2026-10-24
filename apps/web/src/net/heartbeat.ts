// Link health (NC 7.5, 7.10): a ping every 5 s each way; any inbound message counts as a sign of life. The link
// is unstable after 15 s of silence and lost after 90 s (longer than Chrome's one-wake-a-minute throttling of
// hidden tabs) or as soon as the transport reports the peer gone. Nobody forfeits automatically (NC Q18).

import type { ConnectionStatus } from '../contracts'
import { OneShot, type Clock } from './clock'
import { HEARTBEAT_INTERVAL_MS, LOST_AFTER_MS, UNSTABLE_AFTER_MS } from './constants'

export class LinkMonitor {
  private state: ConnectionStatus = 'connecting'
  private lastHeard = 0
  private pings = 0
  private rtt: number | null = null
  private readonly timer: OneShot

  constructor(
    private readonly clock: Clock,
    private readonly ping: (n: number, sentAt: number) => void,
    private readonly onChange: () => void,
  ) {
    this.timer = new OneShot(clock)
  }

  get status(): ConnectionStatus {
    return this.state
  }

  get rttMs(): number | null {
    return this.rtt
  }

  /** The handshake completed. */
  up(): void {
    this.lastHeard = this.clock.now()
    this.set('connected')
    this.schedule()
  }

  /** Any message from the peer. */
  heard(): void {
    this.lastHeard = this.clock.now()
    if (this.state === 'unstable') this.set('connected')
  }

  pong(sentAt: number): void {
    this.heard()
    this.rtt = Math.max(0, this.clock.now() - sentAt)
  }

  /** The peer left or the link was closed. */
  down(): void {
    this.timer.cancel()
    this.set('lost')
  }

  /** Back to waiting for a peer (before any handshake, or while rejoining). */
  reset(): void {
    this.timer.cancel()
    this.set('connecting')
  }

  stop(): void {
    this.timer.cancel()
  }

  private schedule(): void {
    this.timer.start(HEARTBEAT_INTERVAL_MS, () => this.tick())
  }

  private tick(): void {
    const silent = this.clock.now() - this.lastHeard
    if (silent >= LOST_AFTER_MS) {
      this.down()
      return
    }
    if (silent >= UNSTABLE_AFTER_MS) this.set('unstable')
    this.pings += 1
    this.ping(this.pings, this.clock.now())
    this.schedule()
  }

  private set(next: ConnectionStatus): void {
    if (this.state === next) return
    this.state = next
    this.onChange()
  }
}
