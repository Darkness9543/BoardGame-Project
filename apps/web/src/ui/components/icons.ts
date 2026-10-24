// Loading the icons in public/assets/icons/clean (game-icons.net, CC BY 3.0; credits in ATTRIBUTION.md). The files
// are single-colour paths, so they are inlined and can take any colour.

import { useEffect, useState } from 'react'

export interface IconShape {
  readonly viewBox: string
  readonly paths: readonly string[]
}

const shapes = new Map<string, IconShape>()
const loading = new Map<string, Promise<IconShape>>()
export const EMPTY_ICON: IconShape = { viewBox: '0 0 512 512', paths: [] }

export function iconUrl(name: string): string {
  return `${import.meta.env.BASE_URL}assets/icons/clean/${name}.svg`
}

function parse(text: string): IconShape {
  const viewBox = /viewBox="([^"]+)"/.exec(text)?.[1] ?? EMPTY_ICON.viewBox
  const paths = [...text.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1] ?? '').filter((d) => d !== '')
  return { viewBox, paths }
}

export function loadIcon(name: string): Promise<IconShape> {
  const known = shapes.get(name)
  if (known !== undefined) return Promise.resolve(known)
  let pending = loading.get(name)
  if (pending === undefined) {
    pending = fetch(iconUrl(name))
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        const shape = text === '' ? EMPTY_ICON : parse(text)
        shapes.set(name, shape)
        return shape
      })
      .catch(() => EMPTY_ICON)
    loading.set(name, pending)
  }
  return pending
}

export function useIcon(name: string): IconShape | null {
  const [shape, setShape] = useState<IconShape | null>(() => shapes.get(name) ?? null)
  useEffect(() => {
    let live = true
    const known = shapes.get(name)
    if (known !== undefined) {
      setShape(known)
      return
    }
    void loadIcon(name).then((s) => {
      if (live) setShape(s)
    })
    return () => {
      live = false
    }
  }, [name])
  return shape
}
