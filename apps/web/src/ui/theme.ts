// The UI's view of the art-direction defaults. Grade palettes, owner cues, board, fog, overlay colours, fonts and
// symbols live in one file, src/theme/theme.ts (research-art.md section 0, pending the owner's choice, A13-05);
// this module adds only the HTML chrome (the war-table skin), the UI icons and publishing it all as CSS variables.

import { themeCssVariables } from '../theme/css'

export {
  AREA_SYMBOLS,
  AREA_SYMBOL_DEFAULT,
  BOARD_LOOK,
  BUILDING_SYMBOLS,
  COMMANDER_LOOK,
  COMMANDER_PORTRAITS,
  FACTION_EMBLEMS,
  FONTS,
  MINE_LOOK,
  OVERLAY_LOOK,
  OWNER_CUES,
  PALETTE_CLARITY,
  PALETTE_HERALDIC,
  SIDE_TINT,
  SPECIAL_FACES,
  UNIT_SYMBOLS,
  gradePalette,
  rankPips,
  type GradePalette,
  type GradeTone,
  type Hatch,
  type OwnerCue,
} from '../theme/theme'

/** HTML panels, text and buttons: dark walnut and parchment ink with brass accents. */
export const UI_LOOK = {
  bg: '#14100C',
  bgRaised: '#1C1611',
  panel: '#231C15',
  panelAlt: '#2D241B',
  panelHigh: '#3A2E22',
  border: '#4A3B2C',
  borderStrong: '#6B5539',
  ink: '#F1E6C8',
  inkMuted: '#B9A98D',
  inkFaint: '#857660',
  accent: '#D4A93A',
  accentInk: '#1B1410',
  danger: '#E5604D',
  ok: '#71C16E',
  warn: '#E8B44A',
  info: '#6FB6E8',
  focus: '#FFF3B0',
} as const

/** Icons of the HUD (files in public/assets/icons/clean, research-art 4.3). */
export const UI_ICONS = {
  power: 'pointy-sword',
  toughness: 'heart-shield',
  lov: 'semi-closed-eye',
  movement: 'walking-boot',
  ap: 'lightning-helix',
  cooldown: 'hourglass',
  defending: 'checked-shield',
  stealthed: 'invisible',
  regeneration: 'regeneration',
  takeback: 'anticlockwise-rotation',
  achievements: 'laurels-trophy',
  budget: 'crown-coin',
  forcefield: 'energy-shield',
  mine: 'teller-mine',
  commander: 'chess-king',
  attack: 'crossed-swords',
  charge: 'pointy-sword',
  march: 'knight-banner',
  revealed: 'semi-closed-eye',
  range: 'bow-arrow',
} as const

export type UiIcon = keyof typeof UI_ICONS

export interface ThemeOptions {
  readonly clarity: boolean
}

export function themeVariables(options: ThemeOptions): Record<string, string> {
  const vars: Record<string, string> = { ...themeCssVariables(options.clarity) }
  for (const [key, value] of Object.entries(UI_LOOK)) vars[`--ui-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = value
  return vars
}

export function applyTheme(root: HTMLElement, options: ThemeOptions): void {
  for (const [name, value] of Object.entries(themeVariables(options))) root.style.setProperty(name, value)
  root.dataset['palette'] = options.clarity ? 'clarity' : 'heraldic'
}
