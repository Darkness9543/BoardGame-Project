import { useEffect, useState } from 'react'

/** The current time, refreshed every `intervalMs` (countdowns, clocks). Pass 0 to stop ticking: an idle battle
 *  screen must not re-render (and redraw the board) on a timer when nothing is counting down. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (intervalMs <= 0) return
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
