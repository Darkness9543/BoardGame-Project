// What one seat's client holds: the latest view, the events that came with it, a short history of deliveries
// (for the opponent-turn replay), the reaction-prompt deadline with its client-side timeout (A2-30: 15 s, then
// the default answer), and the subscribers. Every session kind (sandbox, host, guest) is built on one of these.

import type { DecisionView, PlayerView, Seat, VisibleEvent } from '@coinduel/engine'
import { OneShot, type Clock } from './clock'
import { HISTORY_LIMIT } from './constants'
import type { DeliveryReason } from './authority'

/** One delivered batch, kept for the opponent-turn replay and for spotting renders that skipped a batch. */
export interface SessionUpdate {
  /** This session's update counter (`updateSeq` after this batch). */
  readonly seq: number
  readonly why: DeliveryReason
  readonly events: readonly VisibleEvent[]
  readonly view: PlayerView
  /** Session clock, epoch ms. */
  readonly at: number
}

export interface FeedInput {
  readonly why: DeliveryReason
  readonly events: readonly VisibleEvent[]
  readonly view: PlayerView
  /** What is left of this seat's prompt window when the authority knows it; otherwise the prompt's own timeout. */
  readonly decisionMs: number | null
}

export class SeatFeed {
  private currentView: PlayerView
  private currentEvents: readonly VisibleEvent[] = []
  private counter = 0
  private recent: readonly SessionUpdate[] = []
  private deadline: number | null = null
  private decisionId: string | null = null
  private readonly listeners = new Set<() => void>()
  private readonly timer: OneShot

  constructor(
    readonly seat: Seat,
    view: PlayerView,
    private readonly clock: Clock,
    /** Answers this seat's prompt with its default when the window runs out. */
    private readonly answer: (decisionId: string, choice: string) => void,
  ) {
    this.currentView = view
    this.timer = new OneShot(clock)
  }

  get view(): PlayerView {
    return this.currentView
  }

  get events(): readonly VisibleEvent[] {
    return this.currentEvents
  }

  get updateSeq(): number {
    return this.counter
  }

  get history(): readonly SessionUpdate[] {
    return this.recent
  }

  get pendingReaction(): DecisionView | null {
    return this.currentView.decision
  }

  get reactionDeadline(): number | null {
    return this.deadline
  }

  /** Stores a delivery without notifying; the session notifies once it has updated everything else. */
  deliver(input: FeedInput): void {
    this.currentView = input.view
    this.currentEvents = input.events
    this.counter += 1
    const entry: SessionUpdate = { seq: this.counter, why: input.why, events: input.events, view: input.view, at: this.clock.now() }
    this.recent = [...this.recent.slice(-(HISTORY_LIMIT - 1)), entry]
    this.trackDecision(input.decisionMs)
  }

  /** A host-provided window for the prompt already on screen (the guest learns it with the view). */
  setDecisionWindow(ms: number | null): void {
    const decision = this.currentView.decision
    if (decision === null || ms === null) return
    this.startWindow(decision, ms)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  notify(): void {
    for (const listener of [...this.listeners]) listener()
  }

  dispose(): void {
    this.timer.cancel()
    this.listeners.clear()
  }

  private trackDecision(decisionMs: number | null): void {
    const decision = this.currentView.decision
    if (decision === null) {
      this.timer.cancel()
      this.deadline = null
      this.decisionId = null
      return
    }
    if (decision.id === this.decisionId) return
    this.startWindow(decision, decisionMs ?? decision.timeoutSeconds * 1000)
  }

  private startWindow(decision: DecisionView, ms: number): void {
    this.decisionId = decision.id
    this.deadline = this.clock.now() + ms
    this.timer.start(ms, () => {
      if (this.currentView.decision?.id === decision.id) this.answer(decision.id, decision.defaultOption)
    })
  }
}
