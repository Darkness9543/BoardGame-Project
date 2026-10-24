// Square overlay tiles (research-ux-conventions 6.3): each style is a fill, an edge and a glyph, so meaning never
// rests on colour alone. One small texture per style, drawn on instanced quads.

import type { CanvasTexture } from 'three'
import { OVERLAY_ALPHA, OVERLAY_LOOK, OWNER_CUES, rgba, SIDE_TINT } from '../../theme'
import { context2d, createCanvas, disc, makeTexture } from './canvas'

export type TileStyle =
  | 'move'
  | 'hazard'
  | 'attack'
  | 'ability'
  | 'areaPrimary'
  | 'areaSecondary'
  | 'threat'
  | 'zoneMine'
  | 'zoneExtended'
  | 'zoneOpponent'
  | 'areaMine'
  | 'areaOpponent'

const SIZE = 64
const tiles = new Map<TileStyle, CanvasTexture>()

export function tileTexture(style: TileStyle): CanvasTexture {
  const cached = tiles.get(style)
  if (cached !== undefined) return cached
  const canvas = createCanvas(SIZE, SIZE)
  draw(context2d(canvas), style)
  const texture = makeTexture(canvas)
  tiles.set(style, texture)
  return texture
}

function fill(ctx: CanvasRenderingContext2D, colour: string): void {
  ctx.fillStyle = colour
  ctx.fillRect(0, 0, SIZE, SIZE)
}

function border(ctx: CanvasRenderingContext2D, colour: string, inset: number, width: number, dash: readonly number[] = []): void {
  ctx.setLineDash([...dash])
  ctx.lineWidth = width
  ctx.strokeStyle = colour
  ctx.strokeRect(inset + width / 2, inset + width / 2, SIZE - 2 * inset - width, SIZE - 2 * inset - width)
  ctx.setLineDash([])
}

function hatch(ctx: CanvasRenderingContext2D, colour: string, step: number, width: number): void {
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  for (let k = -SIZE; k < SIZE * 2; k += step) {
    ctx.beginPath()
    ctx.moveTo(k, SIZE)
    ctx.lineTo(k + SIZE, 0)
    ctx.stroke()
  }
}

function hexCells(ctx: CanvasRenderingContext2D, colour: string): void {
  ctx.strokeStyle = colour
  ctx.lineWidth = 1.5
  const r = 9
  for (let row = -1; row < 5; row++) {
    for (let col = -1; col < 5; col++) {
      const x = col * r * 1.5
      const y = row * r * Math.sqrt(3) + (col % 2 === 0 ? 0 : (r * Math.sqrt(3)) / 2)
      ctx.beginPath()
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const px = x + Math.cos(a) * r
        const py = y + Math.sin(a) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, style: TileStyle): void {
  const c = SIZE / 2
  ctx.clearRect(0, 0, SIZE, SIZE)
  switch (style) {
    case 'move':
      fill(ctx, rgba(OVERLAY_LOOK.move, OVERLAY_ALPHA.move))
      disc(ctx, c, c, 5)
      ctx.fillStyle = rgba('#FFFFFF', 0.85)
      ctx.fill()
      break
    case 'hazard':
      fill(ctx, rgba(OVERLAY_LOOK.hazard, OVERLAY_ALPHA.hazard))
      ctx.fillStyle = '#1B1410'
      ctx.font = `800 ${SIZE * 0.5}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', c, c + 2)
      break
    case 'attack':
      fill(ctx, rgba(OVERLAY_LOOK.attack, OVERLAY_ALPHA.attack))
      hatch(ctx, rgba(OVERLAY_LOOK.attack, 0.32), 9, 2)
      border(ctx, rgba(OVERLAY_LOOK.attack, 0.95), 3, 3)
      break
    case 'ability':
      fill(ctx, rgba(OVERLAY_LOOK.ability, OVERLAY_ALPHA.ability))
      ctx.beginPath()
      ctx.moveTo(c, c - 7)
      ctx.lineTo(c + 7, c)
      ctx.lineTo(c, c + 7)
      ctx.lineTo(c - 7, c)
      ctx.closePath()
      ctx.fillStyle = rgba('#FFFFFF', 0.85)
      ctx.fill()
      break
    case 'areaPrimary':
      fill(ctx, rgba(OVERLAY_LOOK.ability, OVERLAY_ALPHA.areaPrimary))
      border(ctx, rgba('#FFFFFF', 0.8), 2, 2)
      break
    case 'areaSecondary':
      fill(ctx, rgba(OVERLAY_LOOK.splash, OVERLAY_ALPHA.areaSecondary))
      border(ctx, rgba(OVERLAY_LOOK.splash, 0.95), 2, 2, [6, 4])
      break
    case 'threat':
      hatch(ctx, rgba(OVERLAY_LOOK.threat, 0.5), 8, 2.5)
      fill(ctx, rgba(OVERLAY_LOOK.threat, OVERLAY_ALPHA.threat * 0.4))
      break
    case 'zoneMine':
      fill(ctx, rgba(OWNER_CUES.me.bezel, OVERLAY_ALPHA.zoneMine))
      border(ctx, rgba(OWNER_CUES.me.bezel, 0.35), 1, 1)
      break
    case 'zoneExtended':
      fill(ctx, rgba(OWNER_CUES.me.bezel, OVERLAY_ALPHA.zoneExtended))
      hatch(ctx, rgba(OWNER_CUES.me.bezel, 0.3), 10, 2)
      break
    case 'zoneOpponent':
      fill(ctx, rgba('#1B1410', OVERLAY_ALPHA.zoneOpponent))
      break
    case 'areaMine':
      fill(ctx, rgba(SIDE_TINT.me, OVERLAY_ALPHA.area))
      hexCells(ctx, rgba(SIDE_TINT.me, 0.55))
      break
    case 'areaOpponent':
      fill(ctx, rgba(SIDE_TINT.opponent, OVERLAY_ALPHA.area))
      hexCells(ctx, rgba(SIDE_TINT.opponent, 0.6))
      break
  }
}
