// Art-direction defaults in one file (docs/analysis/research-art.md section 0), pending the owner's choice
// (A13-05). Grade palettes, the owner cue, special faces, board and overlay colours, token sizes, symbols and
// fonts all live here, so trying another contender is an edit to this file only.
// Names and values match apps/web/src/ui/theme.ts where the two overlap, so either can re-export the other.

import type { BuildingKind, CommanderId, FactionId, Tier, UnitTypeId } from '@coinduel/engine'

// ---------------------------------------------------------------- grade palettes (research-art 5.3)

/** Petra Sancta hatching, the heraldic non-colour grade cue of palette D (drawn on the coin bezel). */
export type Hatch = 'plain' | 'dots' | 'grid' | 'vertical' | 'horizontal' | 'diagonalRight' | 'diagonalLeft'

export interface GradeTone {
  readonly base: string
  readonly highlight: string
  readonly shadow: string
  /** Icon and numeral colour with the higher WCAG contrast on `base` (research-art Appendix B). */
  readonly ink: string
  readonly hatch: Hatch
}

export type GradePalette = Readonly<Record<Tier, GradeTone>>

/** Palette D "Heraldic euro" (the recommended default): Argent, Or, Sable, Gules, Azure, Purpure, Vert. */
export const PALETTE_HERALDIC: GradePalette = {
  1: { base: '#E9ECEF', highlight: '#F3F5F8', shadow: '#A9ACAE', ink: '#1B1410', hatch: 'plain' },
  2: { base: '#E8B923', highlight: '#FFF094', shadow: '#A67B00', ink: '#1B1410', hatch: 'dots' },
  5: { base: '#2B2B2E', highlight: '#555557', shadow: '#060607', ink: '#FFF8E7', hatch: 'grid' },
  10: { base: '#A81E2B', highlight: '#CE6866', shadow: '#610000', ink: '#FFF8E7', hatch: 'vertical' },
  20: { base: '#1B4597', highlight: '#5577B7', shadow: '#000755', ink: '#FFF8E7', hatch: 'horizontal' },
  50: { base: '#A05BB8', highlight: '#CA96DE', shadow: '#622176', ink: '#FFF8E7', hatch: 'diagonalRight' },
  100: { base: '#4DA457', highlight: '#93D297', shadow: '#06661F', ink: '#1B1410', hatch: 'diagonalLeft' },
}

/** Palette C warm/cool zig-zag: the colour-blind "Clarity mode" palette, shown with rank pips. */
export const PALETTE_CLARITY: GradePalette = {
  1: { base: '#4A2C17', highlight: '#725949', shadow: '#150100', ink: '#FFF8E7', hatch: 'plain' },
  2: { base: '#2F4C7C', highlight: '#637BA1', shadow: '#011740', ink: '#FFF8E7', hatch: 'plain' },
  5: { base: '#8E5B2A', highlight: '#B78E6B', shadow: '#512500', ink: '#FFF8E7', hatch: 'plain' },
  10: { base: '#5C8CC4', highlight: '#99BEEA', shadow: '#255182', ink: '#1B1410', hatch: 'plain' },
  20: { base: '#D2A43C', highlight: '#FDDA93', shadow: '#916800', ink: '#1B1410', hatch: 'plain' },
  50: { base: '#A3D0F2', highlight: '#D8FAFF', shadow: '#6891AF', ink: '#1B1410', hatch: 'plain' },
  100: { base: '#FFF1B5', highlight: '#FFF6C9', shadow: '#BDB079', ink: '#1B1410', hatch: 'plain' },
}

export function gradePalette(clarity: boolean): GradePalette {
  return clarity ? PALETTE_CLARITY : PALETTE_HERALDIC
}

const TIER_ORDER: readonly Tier[] = [1, 2, 5, 10, 20, 50, 100]

/** 0 for tier 1 ... 6 for tier 100: drives the size and thickness ladders and the rank pips. */
export function tierIndex(tier: Tier): number {
  return TIER_ORDER.indexOf(tier)
}

/** Rank pips (cue P): 1..7 dots, shown in Clarity mode. */
export function rankPips(tier: Tier): number {
  return tierIndex(tier) + 1
}

// ---------------------------------------------------------------- owner cue (research-art 6.3: OW-1 + OW-3)

export type OwnerRole = 'me' | 'opponent'

export interface OwnerCue {
  /** Bezel band on the coin face, and its outer edge line. */
  readonly bezel: string
  readonly edge: string
  /** Smooth outline for you, milled (serrated) for the opponent: a shape cue that survives greyscale. */
  readonly rim: 'smooth' | 'milled'
  /** Text colour on a bezel-coloured plate. */
  readonly label: string
  /** T2 coin side and rim (research-art 6.1): brass for you, blackened iron for the opponent. */
  readonly metal: string
  readonly metalness: number
  readonly roughness: number
}

export const OWNER_CUES: Readonly<Record<OwnerRole, OwnerCue>> = {
  me: { bezel: '#F1E6C8', edge: '#7A5A14', rim: 'smooth', label: '#2B1D0E', metal: '#C9A23A', metalness: 0.75, roughness: 0.35 },
  opponent: { bezel: '#2A2622', edge: '#6B625A', rim: 'milled', label: '#F1E6C8', metal: '#2E2A27', metalness: 0.6, roughness: 0.55 },
}

/** Faction ornament inside the bezel (research-art 6.3): Empire pearls, Lojrar rune notches. */
export const FACTION_ORNAMENT: Readonly<Record<FactionId, { readonly kind: 'pearls' | 'notches'; readonly count: number }>> = {
  empire: { kind: 'pearls', count: 24 },
  lojrar: { kind: 'notches', count: 3 },
}

// ---------------------------------------------------------------- faces without a grade (research-art 6.2)

export const SPECIAL_FACES = {
  commander: { base: '#F3EAD2', highlight: '#FFF9EA', shadow: '#BFAF8C', ink: '#2B1D0E', hatch: 'plain' },
  dummy: { base: '#8D949B', highlight: '#B9BEC3', shadow: '#5A6066', ink: '#1B1410', hatch: 'plain' },
} as const satisfies Readonly<Record<string, GradeTone>>

/** The commander's crown mark and double gold rim. */
export const COMMANDER_LOOK = { crown: '#D4A62A', crownEdge: '#7A5A14', rim: '#D9B24A' } as const

/** Trip Mine: a blackened-iron hex nut; the owner sees it at reduced opacity (research-art 6.2). */
export const MINE_LOOK = { face: '#3A3632', ink: '#E9ECEF', ownerOpacity: 0.55, revealedRing: '#E4572E' } as const

// ---------------------------------------------------------------- board, fog, overlays (research-art 10, 11)

export const BOARD_LOOK = {
  slabA: '#D9CBA6',
  slabB: '#CFBF97',
  frame: '#4A3520',
  frameEdge: '#2B1D0E',
  void: '#17120D',
  grid: 'rgba(43, 29, 14, 0.28)',
  blockerLow: '#8A7A64',
  blockerLowTop: '#A8977D',
  blockerTall: '#4E4438',
  blockerTallTop: '#6E6253',
  building: '#7A6248',
  buildingRoof: '#9C8160',
  fog: 'rgba(23, 18, 13, 0.52)',
  fogEdge: '#2B1D0E',
  goalRow: '#C9A23A',
  zoneMine: 'rgba(241, 230, 200, 0.30)',
  zoneExtended: 'rgba(241, 230, 200, 0.16)',
  /** 3D only: the slab gaps show this underlay, which reads as a subtle grid. */
  underlay: '#7C6C52',
  /** 3D only: the war table under the board, and the scene background. */
  table: '#241D17',
  background: '#17120D',
  /** 3D only: the stone plinth under each building. */
  plinth: '#B5A584',
} as const

/** F3-lite fog (research-art 11): fogged slabs dimmed and desaturated, a crisp ink line on the exact LOV boundary. */
export const FOG_LOOK = {
  brightness: 0.52,
  saturation: 0.28,
  /** A cool tint mixed into fogged slabs. */
  tint: '#5D6B7C',
  tintAmount: 0.14,
  /** Ink edge width in board units (about 2 px at the default zoom). */
  edgeWidth: 0.055,
  /** Darkening of blockers and buildings that stand entirely in fog. */
  objectBrightness: 0.62,
} as const

export const OVERLAY_LOOK = {
  move: '#4FC3F7',
  attack: '#E4572E',
  ability: '#A47BEA',
  hazard: '#F2A33A',
  heal: '#2BB3A3',
  path: '#FFFFFF',
  pathOutline: '#1B1410',
  selection: '#FFF3B0',
  revealed: '#B07CFF',
  highlight: '#FFD166',
  damage: '#FF6B57',
  ally: '#E5484D',
  /** 3D additions. */
  pathFog: '#D7E2EC',
  splash: '#F28C38',
  threat: '#E4572E',
  vision: '#FFFFFF',
  hover: '#FFFFFF',
  toughnessHigh: '#5DBB63',
  toughnessMid: '#F2B33D',
  toughnessLow: '#E4572E',
  toughnessTrack: '#1B1410',
  lethal: '#FF3B30',
} as const

/** Fill opacities of the square overlays (research-ux-conventions 6.3: fill + edge + glyph, never colour alone). */
export const OVERLAY_ALPHA = {
  move: 0.32,
  hazard: 0.4,
  attack: 0.24,
  ability: 0.34,
  areaPrimary: 0.5,
  areaSecondary: 0.36,
  threat: 0.2,
  zoneMine: 0.2,
  zoneExtended: 0.12,
  zoneOpponent: 0.16,
  area: 0.26,
} as const

/** Per-side tints for buildings and areas: lightness-based like the token cue. */
export const SIDE_TINT = {
  me: '#E9C46A',
  opponent: '#7D8A99',
  neutral: '#B8A88E',
} as const

/** Token states (research-art 6.4, research-ux-conventions 6.2). */
export const TOKEN_STATE_LOOK = {
  stealthOpacity: 0.45,
  ghostOpacity: 0.38,
  actedSaturation: 0.4,
  actedBrightness: 0.75,
  selectedLift: 0.15,
  hoverLift: 0.04,
  floatDamage: '#FF6B57',
  floatHeal: '#5FE0C0',
  floatStatus: '#FFF3B0',
  floatWarning: '#F2A33A',
} as const

// ---------------------------------------------------------------- token metrics (research-art 5.4, 6.2; tile = 1)

export const TOKEN_METRICS = {
  /** Size ladder S: diameter = base + step * tier index (0.76 ... 0.94). */
  diameterBase: 0.76,
  diameterStep: 0.03,
  /** Thickness ladder T (visible in iso): height = base + step * tier index (0.10 ... 0.17). */
  heightBase: 0.1,
  heightStep: 0.012,
  commanderDiameter: 0.96,
  commanderHeight: 0.16,
  dummyDiameter: 0.7,
  dummyHeight: 0.09,
  size2Diameter: 1.84,
  size2Height: 0.18,
  mineDiameter: 0.5,
  mineHeight: 0.06,
  /** Bezel band width as a fraction of the face radius. */
  bezelFraction: 0.16,
  /** Icon box as a fraction of the face diameter. */
  iconFraction: 0.62,
} as const

// ---------------------------------------------------------------- objectives (research-art 9)

export type KayKitColour = 'blue' | 'green' | 'red' | 'yellow'

export const BUILDING_LOOK = {
  emblemFace: '#F3EAD2',
  emblemInk: '#2B1D0E',
  emblemRing: { me: '#C9A23A', opponent: '#2E2A27', neutral: '#8A6A1C' },
  /** Capture-ring outline: dashed gold while neutral, solid in the controller's tone otherwise. */
  ring: { me: '#F1E6C8', opponent: '#6B625A', neutral: '#7A4B12' },
  banner: { me: '#E9C46A', opponent: '#3A3836' },
  /** The KayKit colour variant shown for each controller. */
  model: { me: 'blue', opponent: 'red', neutral: 'green' } satisfies Readonly<Record<OwnerRole | 'neutral', KayKitColour>>,
  /** K1b: the KayKit castle squashed to about 1.5 tiles tall; the market keeps its proportions up to a cap. */
  keepHeight: 1.5,
  marketMaxHeight: 1.25,
  /** Footprint margin inside the 3x3 (R32). */
  footprintFill: 0.88,
} as const

// ---------------------------------------------------------------- fonts (research-art 12)

/** CSS font stacks (P1 "Imperial"). */
export const FONTS = {
  display: "'Cinzel', 'Times New Roman', serif",
  ui: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  numbers: "'Barlow Semi Condensed', 'Inter', system-ui, sans-serif",
} as const

/**
 * Google Fonts CSS2 URL for the P1 faces (Cinzel 700/900, Inter 400/600, Barlow Semi Condensed 600/800) and the
 * Lojrar accent Grenze Gotisch 500/700. Production should self-host the WOFF2 files instead (research-art 12, GDPR).
 */
export const FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;800&family=Cinzel:wght@700;900' +
  '&family=Grenze+Gotisch:wght@500;700&family=Inter:wght@400;600&display=swap'

// ---------------------------------------------------------------- symbols (research-art 4; files in public/assets/icons/clean)

/** Unit token symbols (the manifest's primaries), keyed by UnitDef.symbol, which is the unit type id. */
export const UNIT_SYMBOLS: Readonly<Record<UnitTypeId, string>> = {
  footman: 'spears',
  mercenary: 'crossed-swords',
  soldier: 'visored-helm',
  ranger: 'bowman',
  berserker: 'battle-axe',
  rogue: 'hood',
  priestess: 'holy-grail',
  juliomancer: 'third-eye',
  paladin: 'templar-shield',
  artificer: 'gear-hammer',
  royalWizard: 'pointy-hat',
  beast: 'minotaur',
  emissary: 'angel-wings',
  scourge: 'crowned-skull',
  commander: 'chess-king',
  noAcb: 'vintage-robot',
}

export const COMMANDER_PORTRAITS: Readonly<Record<CommanderId, string>> = {
  trill: 'brain',
  kulega: 'magnifying-glass',
  sabrina: 'film-spool',
  babaYaga: 'witch-flight',
  ratasius: 'rat',
  queso: 'cheese-wedge',
  baseline: 'chess-king',
}

export const FACTION_EMBLEMS: Readonly<Record<FactionId, string>> = { empire: 'eagle-emblem', lojrar: 'wolf-head' }

export const BUILDING_SYMBOLS: Readonly<Record<BuildingKind, string>> = { keep: 'white-tower', market: 'shop' }

/** Status badges on tokens (research-art 6.4). */
export const BADGE_SYMBOLS = {
  defending: 'checked-shield',
  stealthed: 'invisible',
  acted: 'hourglass',
  revealed: 'semi-closed-eye',
} as const

export const MINE_SYMBOL = 'teller-mine'

/** Icons on the stat plate under a hovered token. */
export const STAT_SYMBOLS = { power: 'pointy-sword', toughness: 'heart-shield' } as const

/** Ground-decal glyphs of area effects, keyed by ability id; others use AREA_SYMBOL_DEFAULT. */
export const AREA_SYMBOLS: Readonly<Record<string, string>> = {
  'royalWizard.forcefield': 'energy-shield',
  'royalWizard.pajazon': 'regeneration',
}
export const AREA_SYMBOL_DEFAULT = 'rune-stone'
