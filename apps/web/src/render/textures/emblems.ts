// Building emblems (research-art 9.2: ivory disc, controller-coloured ring, Keep tower or Market stall), Trip Mine
// faces (a blackened-iron hex nut) and the milled side texture of opponent coins.

import { RepeatWrapping, type CanvasTexture } from 'three'
import type { BuildingKind } from '@coinduel/engine'
import { BUILDING_LOOK, BUILDING_SYMBOLS, FONTS, MINE_LOOK, MINE_SYMBOL, mixHex, OWNER_CUES, type OwnerRole } from '../../theme'
import { context2d, createCanvas, disc, makeTexture, notifyTexturesChanged, TAU } from './canvas'
import { iconIfReady, loadIcon } from './icons'

export type ControllerRole = OwnerRole | 'neutral'

interface Entry {
  readonly canvas: HTMLCanvasElement
  readonly texture: CanvasTexture
}

const cache = new Map<string, Entry>()

function cached(key: string, size: number, draw: (ctx: CanvasRenderingContext2D) => void, icon: { name: string; ink: string } | null): CanvasTexture {
  const hit = cache.get(key)
  if (hit !== undefined) return hit.texture
  const canvas = createCanvas(size, size)
  const entry = { canvas, texture: makeTexture(canvas) }
  cache.set(key, entry)
  draw(context2d(canvas))
  if (icon !== null && iconIfReady(icon.name, icon.ink) === undefined) {
    void loadIcon(icon.name, icon.ink).then(() => {
      draw(context2d(canvas))
      entry.texture.needsUpdate = true
      notifyTexturesChanged()
    })
  }
  return entry.texture
}

function drawIcon(ctx: CanvasRenderingContext2D, name: string, ink: string, box: number, fallback: string): void {
  const c = ctx.canvas.width / 2
  const icon = iconIfReady(name, ink)
  if (icon !== null && icon !== undefined) ctx.drawImage(icon, c - box / 2, c - box / 2, box, box)
  else if (icon === null) {
    ctx.font = `700 ${Math.round(box * 0.6)}px ${FONTS.display}`
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(fallback, c, c + 2)
  }
}

export function emblemTexture(kind: BuildingKind, controller: ControllerRole): CanvasTexture {
  const name = BUILDING_SYMBOLS[kind]
  const size = 128
  return cached(
    `emblem|${kind}|${controller}`,
    size,
    (ctx) => {
      const c = size / 2
      ctx.clearRect(0, 0, size, size)
      disc(ctx, c, c, c - 3)
      ctx.fillStyle = BUILDING_LOOK.emblemFace
      ctx.fill()
      ctx.lineWidth = 9
      ctx.strokeStyle = BUILDING_LOOK.emblemRing[controller]
      ctx.stroke()
      disc(ctx, c, c, c - 9)
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(43, 29, 14, 0.45)'
      ctx.stroke()
      drawIcon(ctx, name, BUILDING_LOOK.emblemInk, size * 0.58, kind === 'keep' ? 'K' : 'M')
    },
    { name, ink: BUILDING_LOOK.emblemInk },
  )
}

/** The mine's top face; the opacity and outline that mark it owner-only are the mesh's. */
export function mineTexture(): CanvasTexture {
  const size = 128
  return cached(
    'mine',
    size,
    (ctx) => {
      const c = size / 2
      ctx.clearRect(0, 0, size, size)
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU
        const x = c + Math.cos(a) * (c - 3)
        const y = c + Math.sin(a) * (c - 3)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      const g = ctx.createRadialGradient(c - 20, c - 24, 6, c, c, c)
      g.addColorStop(0, mixHex(MINE_LOOK.face, '#FFFFFF', 0.2))
      g.addColorStop(1, MINE_LOOK.face)
      ctx.fillStyle = g
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#1B1410'
      ctx.stroke()
      drawIcon(ctx, MINE_SYMBOL, MINE_LOOK.ink, size * 0.6, '!')
    },
    { name: MINE_SYMBOL, ink: MINE_LOOK.ink },
  )
}

/** Reeded coin side for the opponent's milled rim (OW-3); wraps around the cylinder. */
export function milledSideTexture(): CanvasTexture {
  const key = 'milled'
  const hit = cache.get(key)
  if (hit !== undefined) return hit.texture
  const canvas = createCanvas(256, 8)
  const ctx = context2d(canvas)
  const metal = OWNER_CUES.opponent.metal
  for (let i = 0; i < 64; i++) {
    ctx.fillStyle = i % 2 === 0 ? mixHex(metal, '#FFFFFF', 0.22) : mixHex(metal, '#000000', 0.35)
    ctx.fillRect(i * 4, 0, 4, 8)
  }
  const texture = makeTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.repeat.set(2, 1)
  cache.set(key, { canvas, texture })
  return texture
}
