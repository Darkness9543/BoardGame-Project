// Small pure colour helpers on '#RRGGBB' strings (sRGB), used to derive fog, acted and ghost variants from the
// theme and to check icon-ink contrast.

export type Rgb = readonly [number, number, number]

/** '#RRGGBB' or '#RGB' to 0..1 channels. */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Bad colour: ${hex}`)
  const n = Number.parseInt(full, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function rgbToHex(rgb: Rgb): string {
  const byte = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${byte(rgb[0])}${byte(rgb[1])}${byte(rgb[2])}`.toUpperCase()
}

export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

/** Rec. 709 luma in gamma space, the grey a desaturation moves towards. */
function luma(rgb: Rgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

/** saturation 1 keeps the colour, 0 gives grey; brightness multiplies every channel. */
export function adjustHex(hex: string, saturation: number, brightness: number): string {
  const rgb = hexToRgb(hex)
  const y = luma(rgb)
  return rgbToHex([
    (y + (rgb[0] - y) * saturation) * brightness,
    (y + (rgb[1] - y) * saturation) * brightness,
    (y + (rgb[2] - y) * saturation) * brightness,
  ])
}

function linear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** '#RRGGBB' plus an alpha to a CSS rgba() string. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
}
