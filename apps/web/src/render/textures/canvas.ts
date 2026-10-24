// Canvas plumbing for the procedural textures: canvas creation, CanvasTexture setup, a change signal the scene
// turns into invalidate() (render on demand), and a font watcher that redraws text once the theme fonts load.

import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'

export const TAU = Math.PI * 2

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('2D canvas unavailable')
  return ctx
}

export function makeTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  texture.minFilter = LinearMipmapLinearFilter
  texture.needsUpdate = true
  return texture
}

export function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.closePath()
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.closePath()
}

// ---------------------------------------------------------------- change signal

const listeners = new Set<() => void>()

/** Called after any texture was redrawn asynchronously (an icon arrived, fonts loaded). */
export function onTexturesChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyTexturesChanged(): void {
  for (const l of listeners) l()
}

// ---------------------------------------------------------------- fonts

const redrawers = new Set<() => void>()
let watching = false

/** Registers a redraw for when web fonts finish loading (canvas text falls back until then). */
export function redrawOnFontLoad(redraw: () => void): void {
  redrawers.add(redraw)
  if (watching || typeof document === 'undefined' || !('fonts' in document)) return
  watching = true
  const run = (): void => {
    for (const r of redrawers) r()
    notifyTexturesChanged()
  }
  document.fonts.addEventListener('loadingdone', run)
  void document.fonts.ready.then(run)
}

/** Asks the browser to load a canvas font (canvas use alone does not reliably trigger the download). */
export function requestFont(spec: string): void {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  void document.fonts.load(spec).catch(() => undefined)
}
