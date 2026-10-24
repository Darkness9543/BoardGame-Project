// Event playback (UX 15.3, S-15.7): the view is the truth; events only animate the change towards it. The
// timeline replays steps, attacks and deaths as "beats" over the final view, so any renderer that draws a
// PlayerView shows the motion. Floating numbers and attack flashes go to the board extras.

import { buildingDef, type PlayerView, type Square, type UnitId, type UnitView, type VisibleEvent } from '@coinduel/engine'
import type { AnimationSpeed } from './settings'

export type FloaterTone = 'damage' | 'heal' | 'word' | 'warn'

export interface Floater {
  readonly id: number
  readonly square: Square
  readonly text: string
  readonly tone: FloaterTone
  readonly bornAt: number
}

export interface Flash {
  readonly id: number
  readonly from: Square
  readonly to: Square
}

export interface Beat {
  /** The view this beat animates towards (its update's final view). */
  readonly base: PlayerView
  readonly duration: number
  /** Anchors that differ from the final view during this beat. */
  readonly positions: ReadonlyMap<UnitId, Square>
  /** Units of the final view not on the board yet (they walk in later). */
  readonly hidden: ReadonlySet<UnitId>
  /** Units that die later in the batch, still drawn. */
  readonly lingering: readonly UnitView[]
  readonly floaters: readonly Omit<Floater, 'id' | 'bornAt'>[]
  readonly flashes: readonly Omit<Flash, 'id'>[]
  /** Camera focus: the square of the acting unit. */
  readonly focus: Square | null
}

export interface Timing {
  readonly step: number
  readonly attack: number
  readonly hit: number
  readonly death: number
}

export const FLOATER_LIFETIME_MS = 1100

export function timingFor(speed: AnimationSpeed, reducedMotion: boolean): Timing | null {
  if (speed === 'instant' || reducedMotion) return null
  const k = speed === 'fast' ? 0.5 : 1
  return { step: 150 * k, attack: 300 * k, hit: 220 * k, death: 260 * k }
}

const centre = (unit: UnitView | undefined, at: Square | null): Square | null => at ?? unit?.anchor ?? null

/** Builds the beats for one update. With no timing (instant, reduced motion) a single beat carries the floaters. */
export function buildTimeline(before: PlayerView | null, events: readonly VisibleEvent[], after: PlayerView, timing: Timing | null): Beat[] {
  const positions = new Map<UnitId, Square>()
  const hidden = new Set<UnitId>()
  const beforeUnits = new Map((before?.units ?? []).map((u) => [u.id, u]))
  const afterIds = new Set(after.units.map((u) => u.id))
  const dying = new Map<UnitId, UnitView>()
  for (const e of events) {
    if (e.type === 'unitDied') {
      const unit = beforeUnits.get(e.unitId)
      if (unit !== undefined && !afterIds.has(e.unitId)) dying.set(e.unitId, unit)
    }
  }
  const moved = new Set(events.flatMap((e) => (e.type === 'unitMoved' ? [e.unitId] : [])))
  for (const unit of after.units) {
    const was = beforeUnits.get(unit.id)
    if (!moved.has(unit.id)) continue
    if (was?.anchor != null) positions.set(unit.id, was.anchor)
    else hidden.add(unit.id)
  }
  const where = (id: UnitId): Square | null => positions.get(id) ?? dying.get(id)?.anchor ?? after.units.find((u) => u.id === id)?.anchor ?? null
  const beats: Beat[] = []
  let pending: { floaters: Omit<Floater, 'id' | 'bornAt'>[]; flashes: Omit<Flash, 'id'>[]; focus: Square | null } = { floaters: [], flashes: [], focus: null }
  const lingering = (): UnitView[] => [...dying.values()].map((u) => (positions.has(u.id) ? { ...u, anchor: positions.get(u.id) ?? u.anchor } : u))
  const push = (duration: number): void => {
    beats.push({ base: after, duration, positions: new Map(positions), hidden: new Set(hidden), lingering: lingering(), floaters: pending.floaters, flashes: pending.flashes, focus: pending.focus })
    pending = { floaters: [], flashes: [], focus: null }
  }
  const word = (square: Square | null, text: string, tone: FloaterTone): void => {
    if (square !== null) pending.floaters.push({ square, text, tone })
  }

  for (const e of events) {
    switch (e.type) {
      case 'unitMoved':
        positions.set(e.unitId, e.to)
        hidden.delete(e.unitId)
        pending.focus = e.to
        if (timing !== null) push(timing.step)
        break
      case 'moveEnded':
        positions.delete(e.unitId)
        if (e.reason === 'blocked') word(e.at, 'Blocked!', 'warn')
        if (e.reason === 'reaction') word(e.at, 'Ambushed!', 'warn')
        break
      case 'unitAttacked': {
        const from = where(e.attackerId)
        const to = e.target.kind === 'unit' ? where(e.target.unitId) : e.target.square
        if (from !== null && to !== null) pending.flashes.push({ from, to })
        pending.focus = to ?? from
        if (timing !== null) push(timing.attack)
        break
      }
      case 'attackMissed':
        word(e.square, 'Nothing there', 'word')
        break
      case 'unitDamaged':
        word(centre(undefined, where(e.unitId)), `−${e.amount}`, 'damage')
        if (timing !== null) push(timing.hit)
        break
      case 'unitHealed':
        word(where(e.unitId), `+${e.amount}`, 'heal')
        break
      case 'toughnessLost':
        word(where(e.unitId), `−${e.amount}`, 'damage')
        break
      case 'mineExploded':
        word(e.square, 'Mine!', 'warn')
        pending.focus = e.square
        break
      case 'unitDied': {
        word(e.at, '✝', 'warn')
        dying.delete(e.unitId)
        if (timing !== null) push(timing.death)
        break
      }
      case 'unitRevealed':
        word(where(e.unitId), 'Revealed!', 'warn')
        break
      case 'defendChanged':
        if (e.reason === 'action') word(where(e.unitId), 'Defending', 'word')
        break
      case 'buildingCaptured': {
        const building = after.buildings.find((b) => b.kind === e.building)
        const half = Math.floor(buildingDef(e.building).size / 2)
        if (building !== undefined) word({ x: building.anchor.x + half, y: building.anchor.y + half }, 'Captured!', 'word')
        break
      }
      case 'unitRevived':
        word(e.anchor, 'Returned', 'heal')
        break
      default:
        break
    }
  }
  positions.clear()
  hidden.clear()
  if (pending.floaters.length > 0 || pending.flashes.length > 0 || beats.length === 0) push(0)
  return beats
}

/** The view drawn during a beat: its update's final positions, minus units still to walk in, plus units still to die. */
export function displayView(live: PlayerView, beat: Beat | null): PlayerView {
  if (beat === null) return live
  const after = beat.base
  if (beat.positions.size === 0 && beat.hidden.size === 0 && beat.lingering.length === 0) return after
  const units = after.units
    .filter((u) => !beat.hidden.has(u.id))
    .map((u) => {
      const at = beat.positions.get(u.id)
      return at === undefined ? u : { ...u, anchor: at }
    })
  return { ...after, units: [...units, ...beat.lingering.filter((u) => !after.units.some((a) => a.id === u.id))] }
}

// ---------------------------------------------------------------- the runner (scheduler injected, DOM-free)

export interface Scheduler {
  now(): number
  after(ms: number, run: () => void): () => void
}

export const realScheduler: Scheduler = {
  now: () => Date.now(),
  after: (ms, run) => {
    const handle = setTimeout(run, ms)
    return () => clearTimeout(handle)
  },
}

export interface PlaybackSnapshot {
  readonly beat: Beat | null
  readonly floaters: readonly Floater[]
  readonly flashes: readonly Flash[]
  readonly focus: Square | null
  readonly playing: boolean
}

export class PlaybackRunner {
  private queue: Beat[] = []
  private current: Beat | null = null
  private floaters: Floater[] = []
  private flashes: Flash[] = []
  private cancel: (() => void) | null = null
  private sweep: (() => void) | null = null
  private nextId = 1
  private snapshotValue: PlaybackSnapshot = { beat: null, floaters: [], flashes: [], focus: null, playing: false }

  constructor(
    private readonly scheduler: Scheduler,
    private readonly onChange: () => void,
  ) {}

  get snapshot(): PlaybackSnapshot {
    return this.snapshotValue
  }

  /** Queues a batch; a batch arriving mid-play is played after it (catch-up runs at the same pace). */
  play(beats: readonly Beat[]): void {
    this.queue.push(...beats)
    if (this.current === null) this.advance()
  }

  /** Space / click: jump to the end (S-15.7). */
  skip(): void {
    this.cancel?.()
    this.cancel = null
    for (const beat of this.queue) this.spawn(beat, false)
    this.queue = []
    this.current = null
    this.flashes = []
    this.publish()
  }

  dispose(): void {
    this.cancel?.()
    this.sweep?.()
    this.queue = []
  }

  private advance(): void {
    const beat = this.queue.shift() ?? null
    this.current = beat
    if (beat === null) {
      this.flashes = []
      this.publish()
      return
    }
    this.spawn(beat, true)
    this.publish()
    this.cancel = this.scheduler.after(beat.duration, () => {
      this.cancel = null
      this.advance()
    })
  }

  private spawn(beat: Beat, withFlashes: boolean): void {
    const now = this.scheduler.now()
    for (const f of beat.floaters) this.floaters.push({ ...f, id: this.nextId++, bornAt: now })
    this.flashes = withFlashes ? beat.flashes.map((f) => ({ ...f, id: this.nextId++ })) : []
    this.scheduleSweep()
  }

  private scheduleSweep(): void {
    if (this.sweep !== null || this.floaters.length === 0) return
    this.sweep = this.scheduler.after(FLOATER_LIFETIME_MS, () => {
      this.sweep = null
      const now = this.scheduler.now()
      this.floaters = this.floaters.filter((f) => now - f.bornAt < FLOATER_LIFETIME_MS)
      this.publish()
      this.scheduleSweep()
    })
  }

  private publish(): void {
    this.snapshotValue = {
      beat: this.current,
      floaters: [...this.floaters],
      flashes: this.flashes,
      focus: this.current?.focus ?? null,
      playing: this.current !== null,
    }
    this.onChange()
  }
}
