// Text drawn into textures: board coordinates (A-Y, 1-25), the ghost's "R6" badge and an area's turns-left chip.

import type { CanvasTexture } from 'three'
import { FONTS } from '../../theme'
import { context2d, createCanvas, disc, makeTexture, redrawOnFontLoad, roundRect } from './canvas'

export type LabelStyle = 'coordinate' | 'badge' | 'chip'

export interface LabelTexture {
  readonly texture: CanvasTexture
  /** Width / height. */
  readonly aspect: number
}

const HEIGHT = 64
const labels = new Map<string, { text: string; style: LabelStyle; canvas: HTMLCanvasElement; label: LabelTexture }>()

function font(style: LabelStyle): string {
  switch (style) {
    case 'coordinate':
      return `600 ${HEIGHT * 0.62}px ${FONTS.numbers}`
    case 'badge':
    case 'chip':
      return `800 ${HEIGHT * 0.6}px ${FONTS.numbers}`
  }
}

function widthFor(text: string, style: LabelStyle): number {
  const ctx = context2d(createCanvas(4, 4))
  ctx.font = font(style)
  const w = Math.ceil(ctx.measureText(text).width) + (style === 'coordinate' ? 8 : 28)
  return style === 'chip' ? Math.max(HEIGHT, w) : w
}

export function labelTexture(text: string, style: LabelStyle): LabelTexture {
  const key = `${style}|${text}`
  const cached = labels.get(key)
  if (cached !== undefined) return cached.label
  const canvas = createCanvas(widthFor(text, style), HEIGHT)
  const label = { texture: makeTexture(canvas), aspect: canvas.width / HEIGHT }
  labels.set(key, { text, style, canvas, label })
  draw(canvas, text, style)
  return label
}

redrawOnFontLoad(() => {
  for (const entry of labels.values()) {
    draw(entry.canvas, entry.text, entry.style)
    entry.label.texture.needsUpdate = true
  }
})

function draw(canvas: HTMLCanvasElement, text: string, style: LabelStyle): void {
  const ctx = context2d(canvas)
  const w = canvas.width
  ctx.clearRect(0, 0, w, HEIGHT)
  switch (style) {
    case 'coordinate':
      break
    case 'badge':
      roundRect(ctx, 2, 6, w - 4, HEIGHT - 12, (HEIGHT - 12) / 2)
      ctx.fillStyle = 'rgba(27, 20, 16, 0.85)'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(241, 230, 200, 0.7)'
      ctx.stroke()
      break
    case 'chip':
      disc(ctx, w / 2, HEIGHT / 2, HEIGHT / 2 - 3)
      ctx.fillStyle = 'rgba(27, 20, 16, 0.85)'
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(241, 230, 200, 0.8)'
      ctx.stroke()
      break
  }
  ctx.font = font(style)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style === 'coordinate' ? 'rgba(233, 221, 191, 0.78)' : '#FFF8E7'
  ctx.fillText(text, w / 2, HEIGHT / 2 + 2)
}
