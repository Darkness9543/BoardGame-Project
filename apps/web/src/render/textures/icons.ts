// SVG icons from public/assets/icons/clean (game-icons.net, fill="currentColor"), recoloured per ink and decoded
// to images for canvas drawing. A missing or broken file resolves to null and the caller draws its fallback.

import { assetUrl, iconPath } from '../assets'

const cache = new Map<string, Promise<HTMLImageElement | null>>()
const ready = new Map<string, HTMLImageElement | null>()

/** The icon if it already finished loading (null = missing), or undefined while unknown. */
export function iconIfReady(name: string, ink: string): HTMLImageElement | null | undefined {
  return ready.get(`${name}|${ink}`)
}

export function loadIcon(name: string, ink: string): Promise<HTMLImageElement | null> {
  const key = `${name}|${ink}`
  let pending = cache.get(key)
  if (pending === undefined) {
    pending = fetchIcon(name, ink).then((img) => {
      ready.set(key, img)
      return img
    })
    cache.set(key, pending)
  }
  return pending
}

async function fetchIcon(name: string, ink: string): Promise<HTMLImageElement | null> {
  if (typeof document === 'undefined') return null
  try {
    const res = await fetch(assetUrl(iconPath(name)))
    if (!res.ok) return null
    const text = await res.text()
    // A dev server answers unknown paths with index.html, so check that this really is an SVG.
    if (!text.includes('<svg')) return null
    const sized = /<svg[^>]*\swidth=/.test(text) ? text : text.replace('<svg', '<svg width="512" height="512"')
    const svg = sized.replaceAll('currentColor', ink)
    const img = new Image()
    img.decoding = 'async'
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await img.decode()
    return img
  } catch {
    return null
  }
}
