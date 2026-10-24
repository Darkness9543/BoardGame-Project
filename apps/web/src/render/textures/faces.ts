// Coin faces (research-art 6.1 T1 face on the T2 coin): owner bezel with the faction ornament and the heraldic
// hatching, milled or smooth outline, grade-coloured face, unit symbol, numeral cartouche at 12 o'clock (crown for
// the commander), rank pips in clarity mode. Faces are cached per look and redrawn when the icon or fonts arrive.

import type { CanvasTexture } from 'three'
import type { FactionId, Tier } from '@coinduel/engine'
import {
  adjustHex,
  COMMANDER_LOOK,
  contrastRatio,
  FACTION_ORNAMENT,
  FONTS,
  gradePalette,
  mixHex,
  OWNER_CUES,
  rankPips,
  rgba,
  SPECIAL_FACES,
  TOKEN_METRICS,
  TOKEN_STATE_LOOK,
  type GradeTone,
  type Hatch,
  type OwnerRole,
} from '../../theme'
import { context2d, createCanvas, disc, makeTexture, notifyTexturesChanged, redrawOnFontLoad, requestFont, roundRect, TAU } from './canvas'
import { iconIfReady, loadIcon } from './icons'

export type FaceKind = 'unit' | 'commander' | 'dummy'
/** Acted: desaturated and darker (research-art 6.4). Ghost: greyscale memory of an enemy (research-ux 6.2). */
export type FaceVariant = 'normal' | 'acted' | 'ghost'

export interface FaceSpec {
  readonly kind: FaceKind
  readonly tier: Tier | null
  /** Icon file name, or null for the glyph only. */
  readonly symbol: string | null
  readonly glyph: string
  readonly owner: OwnerRole
  readonly faction: FactionId | null
  readonly clarity: boolean
  readonly variant: FaceVariant
}

export const FACE_TEXTURE_SIZE = 256

const NUMERAL_FONT = (px: number): string => `800 ${px}px ${FONTS.numbers}`
const GLYPH_FONT = (px: number): string => `700 ${px}px ${FONTS.display}`

interface FaceEntry {
  readonly spec: FaceSpec
  readonly canvas: HTMLCanvasElement
  readonly texture: CanvasTexture
}

const faces = new Map<string, FaceEntry>()

function faceKey(s: FaceSpec): string {
  return [s.kind, s.tier ?? '-', s.symbol ?? '-', s.glyph, s.owner, s.faction ?? '-', s.clarity ? 'c' : 'h', s.variant].join('|')
}

export function faceTexture(spec: FaceSpec): CanvasTexture {
  const key = faceKey(spec)
  const cached = faces.get(key)
  if (cached !== undefined) return cached.texture
  const canvas = createCanvas(FACE_TEXTURE_SIZE, FACE_TEXTURE_SIZE)
  const entry: FaceEntry = { spec, canvas, texture: makeTexture(canvas) }
  faces.set(key, entry)
  redraw(entry)
  const ink = transform(spec.variant)(tone(spec).ink)
  if (spec.symbol !== null && iconIfReady(spec.symbol, ink) === undefined) {
    void loadIcon(spec.symbol, ink).then(() => {
      redraw(entry)
      notifyTexturesChanged()
    })
  }
  return entry.texture
}

redrawOnFontLoad(() => {
  for (const entry of faces.values()) redraw(entry)
})
requestFont(NUMERAL_FONT(40))
requestFont(GLYPH_FONT(40))

function redraw(entry: FaceEntry): void {
  drawFace(context2d(entry.canvas), entry.spec)
  entry.texture.needsUpdate = true
}

function tone(spec: FaceSpec): GradeTone {
  switch (spec.kind) {
    case 'commander':
      return SPECIAL_FACES.commander
    case 'dummy':
      return SPECIAL_FACES.dummy
    case 'unit':
      return spec.tier === null ? SPECIAL_FACES.dummy : gradePalette(spec.clarity)[spec.tier]
  }
}

function transform(variant: FaceVariant): (hex: string) => string {
  switch (variant) {
    case 'normal':
      return (hex) => hex
    case 'acted':
      return (hex) => adjustHex(hex, TOKEN_STATE_LOOK.actedSaturation, TOKEN_STATE_LOOK.actedBrightness)
    case 'ghost':
      return (hex) => adjustHex(hex, 0, 0.95)
  }
}

/** Dark or light ink, whichever reads better on `hex`. */
function inkOn(hex: string): string {
  return contrastRatio(hex, '#1B1410') >= contrastRatio(hex, '#FFF8E7') ? '#1B1410' : '#FFF8E7'
}

function drawFace(ctx: CanvasRenderingContext2D, spec: FaceSpec): void {
  const tf = transform(spec.variant)
  const t = tone(spec)
  const cue = OWNER_CUES[spec.owner]
  const size = ctx.canvas.width
  const c = size / 2
  const outer = c - 2
  const faceR = outer * (1 - TOKEN_METRICS.bezelFraction)
  const bandMid = (outer + faceR) / 2
  ctx.clearRect(0, 0, size, size)

  // Bezel band in the owner's tone, lit from the top left.
  const band = ctx.createLinearGradient(c - outer, c - outer, c + outer, c + outer)
  band.addColorStop(0, tf(mixHex(cue.bezel, '#FFFFFF', 0.28)))
  band.addColorStop(0.55, tf(cue.bezel))
  band.addColorStop(1, tf(mixHex(cue.bezel, '#000000', 0.3)))
  disc(ctx, c, c, outer)
  ctx.fillStyle = band
  ctx.fill()

  if (!spec.clarity && t.hatch !== 'plain' && spec.kind === 'unit') {
    ctx.save()
    ctx.beginPath()
    ctx.arc(c, c, outer - 3, 0, TAU)
    ctx.arc(c, c, faceR + 1, 0, TAU, true)
    ctx.clip('evenodd')
    drawHatch(ctx, t.hatch, size, rgba(tf(inkOn(cue.bezel)), 0.22))
    ctx.restore()
  }

  if (spec.faction !== null && spec.kind !== 'dummy') drawOrnament(ctx, spec.faction, c, outer, faceR, rgba(tf(inkOn(cue.bezel)), 0.4))
  drawOutline(ctx, cue.rim, c, outer, tf(cue.edge), tf(cue.bezel))

  // Face: grade colour with a soft radial highlight.
  const face = ctx.createRadialGradient(c - faceR * 0.35, c - faceR * 0.4, faceR * 0.08, c, c, faceR)
  face.addColorStop(0, tf(t.highlight))
  face.addColorStop(0.5, tf(t.base))
  face.addColorStop(1, tf(mixHex(t.base, t.shadow, 0.65)))
  disc(ctx, c, c, faceR)
  ctx.fillStyle = face
  ctx.fill()
  disc(ctx, c, c, faceR)
  ctx.lineWidth = 2
  ctx.strokeStyle = rgba(tf(t.ink), 0.35)
  ctx.stroke()

  const ink = tf(t.ink)
  const iconBox = faceR * 2 * TOKEN_METRICS.iconFraction
  const icon = spec.symbol === null ? null : iconIfReady(spec.symbol, ink)
  const iconY = c + faceR * 0.06
  if (icon !== null && icon !== undefined) {
    ctx.drawImage(icon, c - iconBox / 2, iconY - iconBox / 2, iconBox, iconBox)
  } else if (icon === null) {
    const px = Math.round(faceR * (spec.glyph.length > 1 ? 0.62 : 0.9))
    ctx.font = GLYPH_FONT(px)
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(spec.glyph, c, iconY + px * 0.04)
  }

  if (spec.kind === 'commander') drawCrown(ctx, c, c - outer + outer * 0.16, outer * 0.2, tf)
  else if (spec.kind === 'unit' && spec.tier !== null) drawCartouche(ctx, String(spec.tier), c, c - outer + outer * 0.13, outer, tf)
  if (spec.clarity && spec.kind === 'unit' && spec.tier !== null) drawPips(ctx, rankPips(spec.tier), c, bandMid, rgba(tf(inkOn(cue.bezel)), 0.85))
}

function drawHatch(ctx: CanvasRenderingContext2D, hatch: Exclude<Hatch, 'plain'>, size: number, colour: string): void {
  const step = 7
  ctx.strokeStyle = colour
  ctx.fillStyle = colour
  ctx.lineWidth = 1.6
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  switch (hatch) {
    case 'dots':
      for (let y = step / 2; y < size; y += step) for (let x = step / 2; x < size; x += step) {
        disc(ctx, x, y, 1.3)
        ctx.fill()
      }
      break
    case 'grid':
      for (let v = 0; v < size; v += step) {
        line(v, 0, v, size)
        line(0, v, size, v)
      }
      break
    case 'vertical':
      for (let x = 0; x < size; x += step) line(x, 0, x, size)
      break
    case 'horizontal':
      for (let y = 0; y < size; y += step) line(0, y, size, y)
      break
    case 'diagonalRight':
      for (let k = -size; k < size * 2; k += step) line(k, size, k + size, 0)
      break
    case 'diagonalLeft':
      for (let k = -size; k < size * 2; k += step) line(k, 0, k + size, size)
      break
  }
}

function drawOrnament(ctx: CanvasRenderingContext2D, faction: FactionId, c: number, outer: number, faceR: number, colour: string): void {
  const ornament = FACTION_ORNAMENT[faction]
  const mid = (outer + faceR) / 2
  ctx.fillStyle = colour
  switch (ornament.kind) {
    case 'pearls':
      for (let i = 0; i < ornament.count; i++) {
        const a = (i / ornament.count) * TAU
        disc(ctx, c + Math.cos(a) * mid, c + Math.sin(a) * mid, 2.1)
        ctx.fill()
      }
      break
    case 'notches':
      for (let i = 0; i < ornament.count; i++) {
        const a = Math.PI / 2 + (i / ornament.count) * TAU
        const tip = { x: c + Math.cos(a) * (outer - 9), y: c + Math.sin(a) * (outer - 9) }
        const side = 0.07
        ctx.beginPath()
        ctx.moveTo(tip.x, tip.y)
        ctx.lineTo(c + Math.cos(a - side) * (outer - 1), c + Math.sin(a - side) * (outer - 1))
        ctx.lineTo(c + Math.cos(a + side) * (outer - 1), c + Math.sin(a + side) * (outer - 1))
        ctx.closePath()
        ctx.fill()
      }
      break
  }
}

/** OW-3: a smooth edge line for you, milled teeth for the opponent. */
function drawOutline(ctx: CanvasRenderingContext2D, rim: 'smooth' | 'milled', c: number, outer: number, edge: string, bezel: string): void {
  switch (rim) {
    case 'smooth':
      disc(ctx, c, c, outer - 1.5)
      ctx.lineWidth = 3
      ctx.strokeStyle = edge
      ctx.stroke()
      break
    case 'milled': {
      const teeth = 56
      ctx.lineWidth = 2.6
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * TAU
        ctx.strokeStyle = i % 2 === 0 ? edge : mixHex(bezel, '#000000', 0.45)
        ctx.beginPath()
        ctx.moveTo(c + Math.cos(a) * (outer - 7), c + Math.sin(a) * (outer - 7))
        ctx.lineTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer)
        ctx.stroke()
      }
      break
    }
  }
}

/** Numeral cartouche (cue N): the grade value on a dark plate at 12 o'clock, overlapping the bezel. */
function drawCartouche(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, outer: number, tf: (hex: string) => string): void {
  const h = outer * 0.25
  const w = outer * (0.2 + 0.11 * text.length)
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.32)
  ctx.fillStyle = rgba(tf('#1B1410'), 0.88)
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = rgba(tf('#C9A23A'), 0.85)
  ctx.stroke()
  ctx.font = NUMERAL_FONT(Math.round(h * 0.82))
  ctx.fillStyle = tf('#FFF8E7')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, cy + h * 0.04)
}

/** The commander's crown mark, in the cartouche's place. */
function drawCrown(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, tf: (hex: string) => string): void {
  const w = s * 1.7
  const h = s * 1.05
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  ctx.beginPath()
  ctx.moveTo(x0, y0 + h)
  ctx.lineTo(x0, y0 + h * 0.25)
  ctx.lineTo(x0 + w * 0.25, y0 + h * 0.6)
  ctx.lineTo(cx, y0)
  ctx.lineTo(x0 + w * 0.75, y0 + h * 0.6)
  ctx.lineTo(x0 + w, y0 + h * 0.25)
  ctx.lineTo(x0 + w, y0 + h)
  ctx.closePath()
  ctx.fillStyle = tf(COMMANDER_LOOK.crown)
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = tf(COMMANDER_LOOK.crownEdge)
  ctx.stroke()
  for (const px of [x0, cx, x0 + w]) {
    disc(ctx, px, px === cx ? y0 : y0 + h * 0.25, s * 0.12)
    ctx.fill()
    ctx.stroke()
  }
}

/** Rank pips (cue P): 1..7 dots along the lower bezel arc. */
function drawPips(ctx: CanvasRenderingContext2D, count: number, c: number, radius: number, colour: string): void {
  const spacing = 0.2
  ctx.fillStyle = colour
  for (let i = 0; i < count; i++) {
    const a = Math.PI / 2 + (i - (count - 1) / 2) * spacing
    disc(ctx, c + Math.cos(a) * radius, c + Math.sin(a) * radius, 3.4)
    ctx.fill()
  }
}
