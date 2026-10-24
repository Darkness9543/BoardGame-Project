// Turns one batch of visible events into timed animation cues (research-framework 4.8, research-ux-conventions
// 8.6 and 15.3). The view stays the truth: cues only decide how tokens travel to where the new view puts them,
// and which floating words and numbers appear on the way.

import type { AttackTarget, BuildingKind, Square, UnitId, VisibleEvent } from '@coinduel/engine'

/** Same values as the UI's animation-speed setting. */
export type AnimationSpeed = 'normal' | 'fast' | 'instant'

export type CueTarget =
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  | { readonly kind: 'square'; readonly square: Square }
  | { readonly kind: 'building'; readonly building: BuildingKind }

export type FloatTone = 'damage' | 'heal' | 'status' | 'warning'

interface Timed {
  /** Milliseconds from the start of the batch. */
  readonly start: number
  readonly end: number
}

export type Cue = Timed &
  (
    | { readonly kind: 'step'; readonly unitId: UnitId; readonly from: Square; readonly to: Square }
    | { readonly kind: 'lunge'; readonly unitId: UnitId; readonly toward: CueTarget }
    | { readonly kind: 'hit'; readonly unitId: UnitId }
    | { readonly kind: 'float'; readonly id: number; readonly text: string; readonly tone: FloatTone; readonly at: CueTarget; readonly stack: number }
    | { readonly kind: 'burst'; readonly square: Square }
    | { readonly kind: 'death'; readonly unitId: UnitId; readonly at: Square }
    | { readonly kind: 'appear'; readonly unitId: UnitId }
  )

export type FloatCue = Extract<Cue, { readonly kind: 'float' }>

export interface Timeline {
  readonly cues: readonly Cue[]
  readonly duration: number
}

export interface TimelineOptions {
  readonly speed: AnimationSpeed
  /** prefers-reduced-motion: no travel or lunges; fades and numbers stay. */
  readonly reducedMotion: boolean
}

/** Durations at normal speed, in milliseconds (Lichess-like: fast halves them, instant drops the motion). */
export const CUE_MS = {
  step: 150,
  slide: 150,
  lunge: 260,
  hit: 340,
  float: 1050,
  burst: 520,
  death: 560,
  appear: 280,
  gap: 90,
} as const

export const EMPTY_TIMELINE: Timeline = { cues: [], duration: 0 }

export function speedFactor(speed: AnimationSpeed): number {
  switch (speed) {
    case 'normal':
      return 1
    case 'fast':
      return 0.5
    case 'instant':
      return 0
  }
}

function targetKey(t: CueTarget): string {
  switch (t.kind) {
    case 'unit':
      return `u:${t.unitId}`
    case 'square':
      return `s:${t.square.x},${t.square.y}`
    case 'building':
      return `b:${t.building}`
  }
}

function attackTarget(target: AttackTarget): CueTarget {
  return target.kind === 'unit' ? { kind: 'unit', unitId: target.unitId } : { kind: 'square', square: target.square }
}

export function buildTimeline(events: readonly VisibleEvent[], options: TimelineOptions): Timeline {
  const factor = speedFactor(options.speed)
  const animated = factor > 0
  const moving = animated && !options.reducedMotion
  const ms = (key: keyof typeof CUE_MS): number => CUE_MS[key] * factor
  const floatMs = Math.max(650, CUE_MS.float * Math.max(factor, 0.6))
  const cues: Cue[] = []
  const stacks = new Map<string, { end: number; count: number }>()
  let t = 0
  let floatId = 0

  const float = (text: string, tone: FloatTone, at: CueTarget): void => {
    const key = targetKey(at)
    const open = stacks.get(key)
    const stack = open !== undefined && open.end > t ? open.count : 0
    const end = t + floatMs
    stacks.set(key, { end, count: stack + 1 })
    cues.push({ kind: 'float', id: floatId++, text, tone, at, stack, start: t, end })
  }
  const unit = (unitId: UnitId): CueTarget => ({ kind: 'unit', unitId })
  const square = (s: Square): CueTarget => ({ kind: 'square', square: s })

  for (const e of events) {
    switch (e.type) {
      case 'unitMoved':
        if (moving) {
          cues.push({ kind: 'step', unitId: e.unitId, from: e.from, to: e.to, start: t, end: t + ms('step') })
          t += ms('step')
        }
        break
      case 'moveEnded':
        if (e.reason === 'blocked') float('Blocked!', 'warning', square(e.at))
        else if (e.reason === 'reaction') float('Ambushed!', 'warning', unit(e.unitId))
        break
      case 'unitAttacked':
        if (moving) {
          cues.push({ kind: 'lunge', unitId: e.attackerId, toward: attackTarget(e.target), start: t, end: t + ms('lunge') })
          t += ms('lunge') / 2
        }
        break
      case 'attackMissed':
        float('Nothing there', 'status', square(e.square))
        t += ms('gap')
        break
      case 'unitDamaged':
        if (animated) cues.push({ kind: 'hit', unitId: e.unitId, start: t, end: t + ms('hit') })
        float(`−${e.amount}`, 'damage', unit(e.unitId))
        t += ms('gap')
        break
      case 'toughnessLost':
        float(`−${e.amount}`, 'damage', unit(e.unitId))
        t += ms('gap')
        break
      case 'unitHealed':
        if (e.amount > 0) float(`+${e.amount}`, 'heal', unit(e.unitId))
        t += ms('gap')
        break
      case 'unitDied':
        if (animated) cues.push({ kind: 'death', unitId: e.unitId, at: e.at, start: t, end: t + ms('death') })
        t += ms('gap')
        break
      case 'mineExploded':
        if (animated) cues.push({ kind: 'burst', square: e.square, start: t, end: t + ms('burst') })
        float('Mine!', 'warning', square(e.square))
        t += ms('burst') / 2
        break
      case 'unitRevealed':
        float('Revealed!', 'status', unit(e.unitId))
        break
      case 'stealthChanged':
        if (e.stealthed) float('Hidden', 'status', unit(e.unitId))
        break
      case 'defendChanged':
        if (e.defending && e.reason === 'action') float('Defending', 'status', unit(e.unitId))
        break
      case 'buildingCaptured':
        float('Captured!', 'status', { kind: 'building', building: e.building })
        break
      case 'buildingContested':
        float('Contested', 'warning', { kind: 'building', building: e.building })
        break
      case 'unitCreated':
        if (animated) cues.push({ kind: 'appear', unitId: e.unitId, start: t, end: t + ms('appear') })
        break
      case 'unitRevived':
        if (animated) cues.push({ kind: 'appear', unitId: e.unitId, start: t, end: t + ms('appear') })
        float('Revived', 'heal', unit(e.unitId))
        break
      case 'settingsChanged':
      case 'armyChosen':
      case 'readyChanged':
      case 'coinFlipped':
      case 'deploymentStarted':
      case 'unitPlaced':
      case 'unitUnplaced':
      case 'deploymentConfirmed':
      case 'battleStarted':
      case 'turnStarted':
      case 'apChanged':
      case 'turnEnded':
      case 'abilityUsed':
      case 'abilityNote':
      case 'maxToughnessChanged':
      case 'minePlaced':
      case 'mineRevealed':
      case 'areaCreated':
      case 'areaExpired':
      case 'buildingHeld':
      case 'decisionRequested':
      case 'decisionResolved':
      case 'takebackRequested':
      case 'takebackDeclined':
      case 'takebackApplied':
      case 'drawOffered':
      case 'drawDeclined':
      case 'preferenceChanged':
      case 'gameEnded':
      case 'matchSummary':
        break
      default: {
        const unhandled: never = e
        void unhandled
      }
    }
  }
  const duration = cues.reduce((max, c) => Math.max(max, c.end), 0)
  return { cues, duration }
}

/** Where the batch's first visible action happens, for "follow visible enemy actions". */
export function firstActionTarget(events: readonly VisibleEvent[]): CueTarget | null {
  for (const e of events) {
    switch (e.type) {
      case 'unitMoved':
        return { kind: 'square', square: e.from }
      case 'unitAttacked':
        return { kind: 'unit', unitId: e.attackerId }
      case 'unitDamaged':
      case 'unitHealed':
      case 'unitCreated':
      case 'unitRevived':
        return { kind: 'unit', unitId: e.unitId }
      case 'mineExploded':
        return { kind: 'square', square: e.square }
      case 'unitDied':
        return { kind: 'square', square: e.at }
      default:
        break
    }
  }
  return null
}
