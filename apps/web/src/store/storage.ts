// Local persistence (PX G-06): one versioned key per kind of data. The store itself is the session layer's (every
// access guarded, memory when storage is blocked), shared through appStore() so the UI and the sessions read and
// write the same one. A private window still runs the game; it just keeps nothing between visits.

import { browserStore, memoryStore, type KeyValueStore } from '../net'

export { memoryStore, type KeyValueStore }

export const STORAGE_PREFIX = 'coinduel.'

let shared: KeyValueStore | null = null

export function appStore(): KeyValueStore {
  shared ??= browserStore()
  return shared
}

/** Tests swap the backing store. */
export function setAppStore(store: KeyValueStore): void {
  shared = store
}

export function readJson<T>(store: KeyValueStore, key: string, parse: (raw: unknown) => T | null, fallback: T): T {
  const text = store.get(STORAGE_PREFIX + key)
  if (text === null) return fallback
  try {
    return parse(JSON.parse(text)) ?? fallback
  } catch {
    return fallback
  }
}

export function writeJson(store: KeyValueStore, key: string, value: unknown): void {
  store.set(STORAGE_PREFIX + key, JSON.stringify(value))
}

// ---------------------------------------------------------------- tiny guards for parsing stored JSON

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

export function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback
}
