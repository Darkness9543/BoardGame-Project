// The local match log (owner rulings R38, R39): every finished match this browser played, as the engine's
// matchSummary (armies, commanders, winner, rounds, win condition, per-unit-type damage and kills). The sessions
// write it once per match (net/matchLog.ts); this store reads it for the screens and refreshes when a match ends.

import { create } from 'zustand'
import { clearMatchLog, readMatchLog, type MatchLogEntry } from '../net'
import { appStore } from './storage'

export type { MatchLogEntry }

interface MatchLogStore {
  readonly entries: readonly MatchLogEntry[]
  /** Reads the log again (a session has just logged a finished match). */
  refresh(): void
  clear(): void
}

export const useMatchLog = create<MatchLogStore>()((set) => ({
  entries: readMatchLog(appStore()),
  refresh() {
    set({ entries: readMatchLog(appStore()) })
  },
  clear() {
    clearMatchLog(appStore())
    set({ entries: [] })
  },
}))
