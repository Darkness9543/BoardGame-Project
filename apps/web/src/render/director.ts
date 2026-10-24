// Plays timelines against the views the renderer receives. It diffs the previous and the next unit sets (so moves,
// arrivals and departures animate even without events, including a UI that feeds intermediate "beat" views),
// schedules the batch's cues on its own clock and answers "where and how is this token drawn right now".
// Pure: the caller passes `now` (performance.now() in the app).

import type { Square, UnitId, UnitView, VisibleEvent } from '@coinduel/engine'
import { easeInOutCubic } from './cameraMath'
import { footprintCentre, type Point2 } from './coords'
import { buildTimeline, CUE_MS, speedFactor, type Cue, type CueTarget, type FloatCue, type TimelineOptions } from './timeline'

/** A cue placed on the director's clock (absolute milliseconds). A step may start from a drawn point (a glide). */
export type PlayedCue = Cue & { readonly at0: number; readonly at1: number; readonly fromPoint?: Point2 }
export type PlayedFloat = FloatCue & { readonly at0: number; readonly at1: number }
type PlayedStep = Extract<PlayedCue, { readonly kind: 'step' }>
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type CueBody = DistributiveOmit<Cue, 'start' | 'end'>

export interface TokenSample {
  readonly x: number
  readonly z: number
  readonly opacity: number
  readonly scale: number
  /** Vertical offset: up while lunging, down while sinking on death. */
  readonly dy: number
  /** 0..1 strength of the red hit flash. */
  readonly flash: number
}

/** A unit that left the view but is still drawn while it walks into the fog or dies. */
export interface LeavingUnit {
  readonly unit: UnitView
  readonly died: boolean
  /** Anchor it rests on once its steps are done. */
  readonly rest: Square
  /** Absolute ms of the start and end of its fade (equal when the death cue does the fading). */
  readonly fadeFrom: number
  readonly until: number
}

export interface IngestInput {
  readonly prev: ReadonlyMap<UnitId, UnitView>
  readonly next: ReadonlyMap<UnitId, UnitView>
  /** A new event batch, or null when only the view changed. */
  readonly events: readonly VisibleEvent[] | null
  readonly options: TimelineOptions
  readonly now: number
}

const LUNGE_DISTANCE = 0.3
const LUNGE_HOP = 0.08

function moved(a: Square, b: Square): boolean {
  return a.x !== b.x || a.y !== b.y
}

export class AnimationDirector {
  private cues: PlayedCue[] = []
  private steps = new Map<UnitId, PlayedStep[]>()
  private leaving = new Map<UnitId, LeavingUnit>()
  /** Units that walked in from the fog: they fade in during their first step. */
  private arrivals = new Set<UnitId>()
  private lunges = new Map<PlayedCue, Point2>()
  private units = new Map<UnitId, UnitView>()
  private busy = 0
  private revision = 0

  /** Changes on every ingest, so React can re-render floats and leaving tokens. */
  get version(): number {
    return this.revision
  }

  /** Absolute ms until which frames are needed. */
  get busyUntil(): number {
    return this.busy
  }

  /** Drops everything in flight (a different seat now looks at the board, so nothing may carry over). */
  reset(): void {
    this.cues = []
    this.steps.clear()
    this.leaving.clear()
    this.arrivals.clear()
    this.lunges.clear()
    this.busy = 0
  }

  ingest(input: IngestInput): void {
    const { prev, next, events, options, now } = input
    if (events !== null || now >= this.busy) {
      this.cues = []
      this.leaving.clear()
      this.arrivals.clear()
      this.lunges.clear()
    }
    const walked = new Set<UnitId>()
    if (events !== null) {
      for (const cue of buildTimeline(events, options).cues) {
        this.cues.push({ ...cue, at0: now + cue.start, at1: now + cue.end })
        if (cue.kind === 'step') walked.add(cue.unitId)
      }
    }
    const factor = speedFactor(options.speed)
    const animated = factor > 0
    const moving = animated && !options.reducedMotion
    this.indexSteps()

    for (const [id, unit] of next) {
      if (unit.anchor === null) continue
      const before = prev.get(id)?.anchor ?? null
      if (before === null) {
        if (walked.has(id)) this.arrivals.add(id)
        else if (animated && !this.cues.some((c) => c.kind === 'appear' && c.unitId === id)) {
          this.place({ kind: 'appear', unitId: id }, now, CUE_MS.appear * factor)
        }
      } else if (moving && !walked.has(id) && moved(before, unit.anchor)) {
        // Glide from wherever the token is drawn now, replacing a slide still under way, so rapid views stay smooth.
        const drawn = this.sample(id, unit.size, before, now)
        this.cues = this.cues.filter((c) => !(c.kind === 'step' && c.unitId === id))
        this.place({ kind: 'step', unitId: id, from: before, to: unit.anchor }, now, CUE_MS.slide * factor, { x: drawn.x, z: drawn.z })
      }
    }
    this.indexSteps()

    const fadeMs = CUE_MS.appear * factor
    for (const [id, unit] of prev) {
      if (next.has(id) || unit.anchor === null || !animated) continue
      const death = this.cues.find((c): c is Extract<PlayedCue, { kind: 'death' }> => c.kind === 'death' && c.unitId === id)
      const steps = this.steps.get(id) ?? []
      const lastStep = steps[steps.length - 1]
      if (death !== undefined) {
        this.leaving.set(id, { unit, died: true, rest: death.at, fadeFrom: death.at1, until: death.at1 })
      } else {
        const fadeFrom = Math.max(now, lastStep?.at1 ?? now)
        this.leaving.set(id, { unit, died: false, rest: lastStep?.to ?? unit.anchor, fadeFrom, until: fadeFrom + fadeMs })
      }
    }

    this.units = new Map([...prev, ...next])
    for (const cue of this.cues) if (cue.kind === 'lunge') this.lunges.set(cue, this.lungeDirection(cue))
    this.updateBusy(now)
    this.revision++
  }

  /** An attack shown without events (a UI's own playback): the attacker lunges at the square and the victim flashes. */
  strike(attackerId: UnitId | null, toward: Square, victimId: UnitId | null, options: TimelineOptions, now: number): void {
    const factor = speedFactor(options.speed)
    if (factor === 0) return
    if (attackerId !== null && !options.reducedMotion) {
      const cue: PlayedCue = { kind: 'lunge', unitId: attackerId, toward: { kind: 'square', square: toward }, start: 0, end: 0, at0: now, at1: now + CUE_MS.lunge * factor }
      this.cues.push(cue)
      this.lunges.set(cue, this.lungeDirection(cue))
    }
    if (victimId !== null) this.place({ kind: 'hit', unitId: victimId }, now + (CUE_MS.lunge * factor) / 2, CUE_MS.hit * factor)
    this.updateBusy(now)
    this.revision++
  }

  leavingUnits(now: number): LeavingUnit[] {
    return [...this.leaving.values()].filter((l) => l.until > now)
  }

  /** When a departing unit is gone (a ghost of it waits until then), or null if it is not departing. */
  leavingUntil(unitId: UnitId): number | null {
    return this.leaving.get(unitId)?.until ?? null
  }

  floats(): PlayedFloat[] {
    const out: PlayedFloat[] = []
    for (const c of this.cues) if (c.kind === 'float') out.push(c)
    return out
  }

  bursts(): Extract<PlayedCue, { readonly kind: 'burst' }>[] {
    const out: Extract<PlayedCue, { readonly kind: 'burst' }>[] = []
    for (const c of this.cues) if (c.kind === 'burst') out.push(c)
    return out
  }

  /** Where a cue target stands at `now`; unit targets follow the unit's animation. Buildings are the caller's. */
  targetPoint(target: CueTarget, now: number): Point2 | null {
    switch (target.kind) {
      case 'unit': {
        const unit = this.units.get(target.unitId)
        if (unit?.anchor == null) return null
        const rest = this.leaving.get(target.unitId)?.rest ?? unit.anchor
        const s = this.sample(target.unitId, unit.size, rest, now)
        return { x: s.x, z: s.z }
      }
      case 'square':
        return footprintCentre(target.square, 1)
      case 'building':
        return null
    }
  }

  /** `anchor` is the unit's anchor in the current view (or its LeavingUnit.rest). */
  sample(unitId: UnitId, size: number, anchor: Square, now: number): TokenSample {
    const steps = this.steps.get(unitId) ?? []
    let pos = footprintCentre(anchor, size)
    const lastStep = steps[steps.length - 1]
    if (lastStep !== undefined && now < lastStep.at1) pos = this.alongSteps(steps, size, now)
    let opacity = 1
    let scale = 1
    let dy = 0
    let flash = 0
    for (const c of this.cues) {
      if (!('unitId' in c) || c.unitId !== unitId) continue
      if (now < c.at0) {
        if (c.kind === 'appear') opacity = 0
        continue
      }
      if (now >= c.at1) {
        if (c.kind === 'death') opacity = 0
        continue
      }
      const u = (now - c.at0) / Math.max(1, c.at1 - c.at0)
      switch (c.kind) {
        case 'lunge': {
          const d = this.lunges.get(c) ?? { x: 0, z: 0 }
          const k = Math.sin(Math.PI * u)
          pos = { x: pos.x + d.x * k * LUNGE_DISTANCE, z: pos.z + d.z * k * LUNGE_DISTANCE }
          dy += k * LUNGE_HOP
          break
        }
        case 'hit':
          flash = Math.max(flash, 1 - u)
          break
        case 'appear':
          opacity = Math.min(opacity, u)
          scale = 0.85 + 0.15 * u
          break
        case 'death':
          opacity = Math.min(opacity, 1 - u)
          scale = 1 - 0.3 * u
          dy -= 0.12 * u
          break
        case 'step':
          break
      }
    }
    const first = steps[0]
    if (first !== undefined && this.arrivals.has(unitId) && now < first.at1) {
      opacity = Math.min(opacity, Math.max(0, (now - first.at0) / Math.max(1, first.at1 - first.at0)))
    }
    const leaving = this.leaving.get(unitId)
    if (leaving !== undefined && !leaving.died && now >= leaving.fadeFrom) {
      opacity = Math.min(opacity, Math.max(0, (leaving.until - now) / Math.max(1, leaving.until - leaving.fadeFrom)))
    }
    return { x: pos.x, z: pos.z, opacity, scale, dy, flash }
  }

  private alongSteps(steps: readonly PlayedStep[], size: number, now: number): Point2 {
    const first = steps[0]
    if (first === undefined) return { x: 0, z: 0 }
    let pos = first.fromPoint ?? footprintCentre(first.from, size)
    for (const s of steps) {
      if (now >= s.at1) {
        pos = footprintCentre(s.to, size)
        continue
      }
      if (now < s.at0) break
      const a = s.fromPoint ?? footprintCentre(s.from, size)
      const b = footprintCentre(s.to, size)
      const u = easeInOutCubic((now - s.at0) / Math.max(1, s.at1 - s.at0))
      return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }
    }
    return pos
  }

  private indexSteps(): void {
    this.steps.clear()
    for (const c of this.cues) {
      if (c.kind !== 'step') continue
      const list = this.steps.get(c.unitId)
      if (list === undefined) this.steps.set(c.unitId, [c])
      else list.push(c)
    }
    for (const list of this.steps.values()) list.sort((a, b) => a.at0 - b.at0)
  }

  private updateBusy(now: number): void {
    let busy = now
    for (const c of this.cues) busy = Math.max(busy, c.at1)
    for (const l of this.leaving.values()) busy = Math.max(busy, l.until)
    this.busy = busy
  }

  private place(cue: CueBody, at: number, duration: number, fromPoint?: Point2): void {
    const timed = { ...cue, start: 0, end: duration, at0: at, at1: at + duration }
    this.cues.push(fromPoint === undefined ? timed : { ...timed, fromPoint })
  }

  private lungeDirection(cue: PlayedCue): Point2 {
    if (cue.kind !== 'lunge') return { x: 0, z: 0 }
    const attacker = this.units.get(cue.unitId)
    if (attacker?.anchor == null) return { x: 0, z: 0 }
    const from = this.sample(cue.unitId, attacker.size, attacker.anchor, cue.at0)
    const to = this.targetPoint(cue.toward, cue.at0)
    if (to === null) return { x: 0, z: 0 }
    const dx = to.x - from.x
    const dz = to.z - from.z
    const len = Math.hypot(dx, dz)
    return len < 1e-6 ? { x: 0, z: 0 } : { x: dx / len, z: dz / len }
  }
}
