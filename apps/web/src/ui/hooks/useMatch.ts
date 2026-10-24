import { useSyncExternalStore } from 'react'
import type { MatchController, MatchSnapshot } from '../../store/matchController'
import { useSessionStore } from '../../store/sessionStore'

const noop = (): (() => void) => () => undefined

/** The active match's snapshot (re-renders on every update), or null outside a match. */
export function useMatch(): { readonly controller: MatchController; readonly snap: MatchSnapshot } | null {
  const controller = useSessionStore((s) => s.controller)
  const snap = useSyncExternalStore(controller?.subscribe ?? noop, () => controller?.getSnapshot() ?? null)
  return controller === null || snap === null ? null : { controller, snap }
}
