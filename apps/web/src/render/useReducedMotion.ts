import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function systemPrefersReduced(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia(QUERY).matches
  } catch {
    return false
  }
}

/** The explicit setting when given, else the system preference (followed live). */
export function useReducedMotion(explicit: boolean | undefined): boolean {
  const [system, setSystem] = useState(systemPrefersReduced)
  useEffect(() => {
    if (explicit !== undefined || typeof matchMedia !== 'function') return
    const media = matchMedia(QUERY)
    const update = (): void => setSystem(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [explicit])
  return explicit ?? system
}
