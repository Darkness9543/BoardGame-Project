// R38 / R39: every finished match is logged locally from the engine's `matchSummary` event (armies, commanders,
// winner, rounds, win condition, and per unit type the damage, kills and losses), newest first.

import type { MatchSummary, Seat } from '@coinduel/engine'
import { MATCH_LOG_LIMIT, STORAGE_PREFIX } from './constants'
import type { KeyValueStore } from './storage'

export type MatchLogMode = 'local' | 'host' | 'guest'

export interface MatchLogEntry {
  readonly id: string
  /** Epoch ms. */
  readonly finishedAt: number
  readonly mode: MatchLogMode
  /** The seat this browser played (the sandbox logs from the host seat). */
  readonly seat: Seat
  readonly names: Readonly<Record<Seat, string>>
  readonly summary: MatchSummary
}

const LOG_KEY = `${STORAGE_PREFIX}matchLog`

function isEntry(value: unknown): value is MatchLogEntry {
  if (typeof value !== 'object' || value === null) return false
  if (!('id' in value) || !('finishedAt' in value) || !('summary' in value) || !('names' in value)) return false
  const summary = value.summary
  return typeof value.id === 'string' && typeof value.finishedAt === 'number' && typeof summary === 'object' && summary !== null && 'winner' in summary
}

export function readMatchLog(store: KeyValueStore): MatchLogEntry[] {
  const raw = store.get(LOG_KEY)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

/** Adds an entry unless one with the same id is already there. */
export function appendMatchLog(store: KeyValueStore, entry: MatchLogEntry): void {
  const entries = readMatchLog(store)
  if (entries.some((e) => e.id === entry.id)) return
  store.set(LOG_KEY, JSON.stringify([entry, ...entries].slice(0, MATCH_LOG_LIMIT)))
}

export function clearMatchLog(store: KeyValueStore): void {
  store.remove(LOG_KEY)
}
