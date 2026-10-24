// The session clock: epoch milliseconds plus one-shot timers. Every timer in this layer goes through an
// injected Clock, so tests drive time by hand (testing/manualClock.ts).

export type TimerHandle = number

export interface Clock {
  /** Epoch milliseconds. */
  now(): number
  setTimeout(callback: () => void, ms: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
}

/** One restartable timer. */
export class OneShot {
  private handle: TimerHandle | null = null

  constructor(private readonly clock: Clock) {}

  start(ms: number, callback: () => void): void {
    this.cancel()
    this.handle = this.clock.setTimeout(() => {
      this.handle = null
      callback()
    }, Math.max(0, ms))
  }

  cancel(): void {
    if (this.handle === null) return
    this.clock.clearTimeout(this.handle)
    this.handle = null
  }

  get active(): boolean {
    return this.handle !== null
  }
}
