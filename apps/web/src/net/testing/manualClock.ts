// A Clock whose time moves only when a test says so; due timers run in order.

import type { Clock, TimerHandle } from '../clock'

interface Timer {
  readonly id: number
  readonly at: number
  readonly callback: () => void
}

export class ManualClock implements Clock {
  private time: number
  private nextId = 1
  private timers: Timer[] = []

  constructor(start = 1_800_000_000_000) {
    this.time = start
  }

  now(): number {
    return this.time
  }

  setTimeout(callback: () => void, ms: number): TimerHandle {
    const id = this.nextId++
    this.timers.push({ id, at: this.time + Math.max(0, ms), callback })
    return id
  }

  clearTimeout(handle: TimerHandle): void {
    this.timers = this.timers.filter((t) => t.id !== handle)
  }

  /** Moves time forward by `ms`, running every timer that falls due, including timers those schedule. */
  advance(ms: number): void {
    const target = this.time + ms
    for (;;) {
      const due = this.timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0]
      if (due === undefined) break
      this.timers = this.timers.filter((t) => t.id !== due.id)
      this.time = Math.max(this.time, due.at)
      due.callback()
    }
    this.time = target
  }

  get pendingTimers(): number {
    return this.timers.length
  }
}
