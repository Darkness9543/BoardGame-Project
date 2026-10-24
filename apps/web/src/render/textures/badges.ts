// Small round badges: token statuses (research-art 6.4: Defending, Stealthed for the owner, Acted, Revealed), the
// lethal-forecast skull, the "vanished here" mark on ghosts, and icon chips for area effects.

import type { CanvasTexture } from 'three'
import { BADGE_SYMBOLS, FONTS, OVERLAY_LOOK } from '../../theme'
import { context2d, createCanvas, disc, makeTexture, notifyTexturesChanged, redrawOnFontLoad, TAU } from './canvas'
import { iconIfReady, loadIcon } from './icons'

export type BadgeKind = 'defending' | 'stealthed' | 'acted' | 'revealed' | 'lethal' | 'vanished'

const SIZE = 96
const INK = '#FFF8E7'

interface BadgeLook {
  /** Icon file name, or null for a drawn mark. */
  readonly symbol: string | null
  readonly fill: string
  readonly ring: string
  /** Shown when there is no icon (or it is missing). */
  readonly mark: 'skull' | string
}

interface Entry {
  readonly look: BadgeLook
  readonly canvas: HTMLCanvasElement
  readonly texture: CanvasTexture
}

const entries = new Map<string, Entry>()
const DARK = 'rgba(27, 20, 16, 0.92)'
const IVORY = '#F1E6C8'

function badgeLook(kind: BadgeKind): BadgeLook {
  switch (kind) {
    case 'defending':
    case 'stealthed':
    case 'acted':
      return { symbol: BADGE_SYMBOLS[kind], fill: DARK, ring: IVORY, mark: kind.charAt(0).toUpperCase() }
    case 'revealed':
      return { symbol: BADGE_SYMBOLS.revealed, fill: DARK, ring: OVERLAY_LOOK.revealed, mark: 'R' }
    case 'lethal':
      return { symbol: null, fill: OVERLAY_LOOK.lethal, ring: IVORY, mark: 'skull' }
    case 'vanished':
      return { symbol: null, fill: DARK, ring: IVORY, mark: '?' }
  }
}

export function badgeTexture(kind: BadgeKind): CanvasTexture {
  return texture(`badge|${kind}`, badgeLook(kind))
}

/** A dark chip with an icon (area-effect glyphs). */
export function iconChipTexture(symbol: string): CanvasTexture {
  return texture(`chip|${symbol}`, { symbol, fill: DARK, ring: IVORY, mark: '•' })
}

function texture(key: string, look: BadgeLook): CanvasTexture {
  const cached = entries.get(key)
  if (cached !== undefined) return cached.texture
  const canvas = createCanvas(SIZE, SIZE)
  const entry: Entry = { look, canvas, texture: makeTexture(canvas) }
  entries.set(key, entry)
  draw(entry)
  if (look.symbol !== null && iconIfReady(look.symbol, INK) === undefined) {
    void loadIcon(look.symbol, INK).then(() => {
      draw(entry)
      notifyTexturesChanged()
    })
  }
  return entry.texture
}

redrawOnFontLoad(() => {
  for (const entry of entries.values()) draw(entry)
})

function draw(entry: Entry): void {
  const { look, canvas } = entry
  const ctx = context2d(canvas)
  const c = SIZE / 2
  ctx.clearRect(0, 0, SIZE, SIZE)
  disc(ctx, c, c, c - 3)
  ctx.fillStyle = look.fill
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = look.ring
  ctx.stroke()
  entry.texture.needsUpdate = true
  const icon = look.symbol === null ? null : iconIfReady(look.symbol, INK)
  if (icon !== null && icon !== undefined) {
    const s = SIZE * 0.6
    ctx.drawImage(icon, c - s / 2, c - s / 2, s, s)
    return
  }
  if (icon === undefined) return
  if (look.mark === 'skull') {
    drawSkull(ctx, c, SIZE * 0.3)
    return
  }
  ctx.font = `700 ${Math.round(SIZE * 0.5)}px ${FONTS.display}`
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(look.mark, c, c + 2)
}

function drawSkull(ctx: CanvasRenderingContext2D, c: number, s: number): void {
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(c, c - s * 0.15, s * 0.78, Math.PI * 0.85, Math.PI * 0.15 + TAU)
  ctx.lineTo(c + s * 0.42, c + s * 0.75)
  ctx.lineTo(c - s * 0.42, c + s * 0.75)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = OVERLAY_LOOK.lethal
  for (const dx of [-0.32, 0.32]) {
    disc(ctx, c + dx * s, c - s * 0.12, s * 0.2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.moveTo(c, c + s * 0.12)
  ctx.lineTo(c - s * 0.1, c + s * 0.34)
  ctx.lineTo(c + s * 0.1, c + s * 0.34)
  ctx.closePath()
  ctx.fill()
}
