// Match history (9, NC 7.13): an append-only log of accepted intents, deterministic replay, take-back
// frames, snapshots and stable hashes. The authority keeps a MatchRecord and feeds every intent through
// submit(); replay(initial, log) rebuilds the identical record because apply() is deterministic and the
// RNG lives in the state.

import { apply, isActionIntent, type ApplyResult, type Intent } from './commands'
import { SCHEMA_VERSION } from './constants'
import type { GameEvent } from './events'
import { canonicalJson, hashJson } from './hash'
import type { Rejection } from './rejection'
import type { GameState, Seat } from './types'

export interface LogEntry {
  readonly seat: Seat
  readonly intent: Intent
}

/** The state just before a battle action: what an accepted take-back restores. */
export interface Frame {
  readonly actionSeq: number
  readonly turnNumber: number
  readonly before: GameState
}

export interface MatchRecord {
  readonly initial: GameState
  readonly log: readonly LogEntry[]
  readonly state: GameState
  /** Recent frames only (the current and previous turn; take-backs never reach further, TB-3). */
  readonly frames: readonly Frame[]
}

export type SubmitResult =
  | { readonly ok: true; readonly record: MatchRecord; readonly events: readonly GameEvent[] }
  | Rejection

export function startRecord(initial: GameState): MatchRecord {
  return { initial, log: [], state: initial, frames: [] }
}

/** Validates and applies one intent, appends it to the log and maintains take-back frames. */
export function submit(record: MatchRecord, seat: Seat, intent: Intent): SubmitResult {
  const result: ApplyResult = apply(record.state, seat, intent, {
    stateBeforeAction: (seq) => record.frames.find((f) => f.actionSeq === seq)?.before,
  })
  if (!result.ok) return result
  let frames = record.frames
  if (isActionIntent(intent)) {
    frames = [...frames, { actionSeq: record.state.actionCount + 1, turnNumber: record.state.turn?.number ?? 0, before: record.state }]
  }
  if (intent.kind === 'acceptTakeback') {
    const undone = result.state.actionCount + 1
    frames = frames.filter((f) => f.actionSeq < undone)
  }
  const turn = result.state.turn?.number ?? 0
  frames = frames.filter((f) => f.turnNumber >= turn - 1)
  return {
    ok: true,
    record: { initial: record.initial, log: [...record.log, { seat, intent }], state: result.state, frames },
    events: result.events,
  }
}

export class ReplayError extends Error {
  constructor(
    readonly index: number,
    readonly rejection: Rejection,
  ) {
    super(`Replay rejected entry ${index}: ${rejection.code} ${rejection.message}`)
  }
}

/** Rebuilds the whole record (frames included) from its initial state and log; throws ReplayError on a rejected entry. */
export function replayRecord(initial: GameState, log: readonly LogEntry[]): MatchRecord {
  let record = startRecord(initial)
  for (const [index, entry] of log.entries()) {
    const result = submit(record, entry.seat, entry.intent)
    if (!result.ok) throw new ReplayError(index, result)
    record = result.record
  }
  return record
}

/** Deterministic replay: replay(initial, record.log) deep-equals record.state. */
export function replay(initial: GameState, log: readonly LogEntry[]): GameState {
  return replayRecord(initial, log).state
}

/** Stable 64-bit hash for sync checks (canonical JSON, NC 7.9). */
export function hashState(state: GameState): string {
  return hashJson(state)
}

export function serializeState(state: GameState): string {
  return canonicalJson(state)
}

export function deserializeState(text: string): GameState {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || (parsed as { schemaVersion?: unknown }).schemaVersion !== SCHEMA_VERSION) {
    throw new Error('Not a game state of this schema version')
  }
  return parsed as GameState
}

/** Persistence format: the initial state and the log (the state is rebuilt by replay). */
export function serializeRecord(record: MatchRecord): string {
  return canonicalJson({ initial: record.initial, log: record.log })
}

export function restoreRecord(text: string): MatchRecord {
  const parsed = JSON.parse(text) as { initial?: unknown; log?: unknown }
  if (!Array.isArray(parsed.log)) throw new Error('Not a match record')
  const initial = deserializeState(JSON.stringify(parsed.initial))
  return replayRecord(initial, parsed.log as LogEntry[])
}
