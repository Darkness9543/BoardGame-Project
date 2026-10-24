// UX 19.5: when the turn passes to you, the tab title says so until the tab has focus, and a system notification
// fires while the tab is hidden (if the player switched it on and the browser allowed it).

import { useEffect } from 'react'
import type { TurnBanner } from '../../store/matchController'
import { useSettings } from '../../store/settings'

const BASE_TITLE = 'Coin Duel'

export function useTurnNotice(banner: TurnBanner | null, opponentName: string): void {
  const notify = useSettings((s) => s.settings.notifyTurn)
  useEffect(() => {
    if (banner === null || !banner.mine || Date.now() - banner.at > 5000) return
    const hidden = document.visibilityState === 'hidden' || !document.hasFocus()
    if (!hidden) return
    document.title = `● Your turn · ${BASE_TITLE}`
    if (notify && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
      try {
        new Notification('Your turn', { body: `${banner.text}: ${opponentName} ended their turn`, tag: 'coinduel-turn' })
      } catch {
        // some browsers only allow notifications from a service worker
      }
    }
    const restore = () => {
      if (document.visibilityState === 'visible') document.title = BASE_TITLE
    }
    window.addEventListener('focus', restore)
    document.addEventListener('visibilitychange', restore)
    return () => {
      window.removeEventListener('focus', restore)
      document.removeEventListener('visibilitychange', restore)
    }
  }, [banner, notify, opponentName])
  useEffect(() => () => void (document.title = BASE_TITLE), [])
}
