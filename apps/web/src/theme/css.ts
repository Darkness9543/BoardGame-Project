// The theme as CSS custom properties (same names as ui/theme.ts) and the font loader. DOM access is guarded so
// the module also loads in Node tests.

import { BOARD_LOOK, FONT_STYLESHEET_URL, FONTS, gradePalette, OVERLAY_LOOK, OWNER_CUES, SIDE_TINT } from './theme'

export function themeCssVariables(clarity: boolean): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(OVERLAY_LOOK)) vars[`--ov-${kebab(key)}`] = value
  for (const [key, value] of Object.entries(SIDE_TINT)) vars[`--side-${key}`] = value
  for (const [key, value] of Object.entries(BOARD_LOOK)) vars[`--board-${kebab(key)}`] = value
  for (const [key, value] of Object.entries(FONTS)) vars[`--font-${key}`] = value
  for (const [tier, tone] of Object.entries(gradePalette(clarity))) {
    vars[`--grade-${tier}`] = tone.base
    vars[`--grade-${tier}-ink`] = tone.ink
    vars[`--grade-${tier}-hi`] = tone.highlight
    vars[`--grade-${tier}-lo`] = tone.shadow
  }
  vars['--owner-me'] = OWNER_CUES.me.bezel
  vars['--owner-opponent'] = OWNER_CUES.opponent.bezel
  return vars
}

const FONT_LINK_ID = 'coinduel-theme-fonts'

/**
 * Adds the theme's font stylesheet once, unless the page already links one (or self-hosts the faces and marks
 * that with <link data-theme-fonts>). Returns whether it added the link.
 */
export function ensureThemeFonts(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (doc === undefined) return false
  if (doc.getElementById(FONT_LINK_ID) !== null) return false
  if (doc.querySelector('link[data-theme-fonts], link[href*="fonts.googleapis.com"]') !== null) return false
  const link = doc.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = FONT_STYLESHEET_URL
  doc.head.appendChild(link)
  return true
}

function kebab(key: string): string {
  return key.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)
}
