// The few browser facts a session reads: tab visibility (NC 7.10 presence: "opponent switched tabs" rather than
// "disconnected") and the page address invite links are built from. Injected, so tests run headless.

export interface SessionEnvironment {
  isHidden(): boolean
  /** Calls back when the tab is hidden or shown; returns an unsubscribe function. */
  watchVisibility(onChange: (hidden: boolean) => void): () => void
  /** The page address without its fragment, or null outside a browser. */
  baseUrl(): string | null
}

export const browserEnvironment: SessionEnvironment = {
  isHidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  watchVisibility(onChange) {
    if (typeof document === 'undefined') return () => undefined
    const listener = (): void => onChange(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  },
  baseUrl() {
    if (typeof location === 'undefined') return null
    return `${location.origin}${location.pathname}${location.search}`
  },
}

/** No document: always visible; tests can flip `hidden` and call `fire`. */
export function headlessEnvironment(baseUrl: string | null = null): SessionEnvironment & { hidden: boolean; fire(): void } {
  const listeners = new Set<(hidden: boolean) => void>()
  const env = {
    hidden: false,
    isHidden: () => env.hidden,
    watchVisibility(onChange: (hidden: boolean) => void) {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
    baseUrl: () => baseUrl,
    fire() {
      for (const listener of listeners) listener(env.hidden)
    },
  }
  return env
}
