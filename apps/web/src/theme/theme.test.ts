import { describe, it, expect } from 'vitest'
import { TIERS } from '@coinduel/engine'
import { adjustHex, contrastRatio, hexToRgb, mixHex, rgbToHex } from './colour'
import { themeCssVariables } from './css'
import { gradePalette, OWNER_CUES, PALETTE_CLARITY, PALETTE_HERALDIC, rankPips, SPECIAL_FACES, tierIndex, UNIT_SYMBOLS } from './theme'

const INKS = ['#1B1410', '#FFF8E7'] as const

describe('grade palettes', () => {
  for (const [name, palette] of [
    ['heraldic', PALETTE_HERALDIC],
    ['clarity', PALETTE_CLARITY],
  ] as const) {
    it(`${name}: every tier has a face whose ink is the higher-contrast ink and readable (>= 4.2:1)`, () => {
      for (const tier of TIERS) {
        const tone = palette[tier]
        const best = contrastRatio(tone.base, INKS[0]) >= contrastRatio(tone.base, INKS[1]) ? INKS[0] : INKS[1]
        expect(tone.ink).toBe(best)
        expect(contrastRatio(tone.base, tone.ink)).toBeGreaterThanOrEqual(4.2)
      }
    })
  }

  it('keeps the seven grades apart in lightness or hue (no two faces alike)', () => {
    const bases = TIERS.map((t) => PALETTE_HERALDIC[t].base)
    expect(new Set(bases).size).toBe(7)
  })

  it('switches to the clarity palette for colour-blind mode, which uses rank pips instead of hatching', () => {
    expect(gradePalette(true)).toBe(PALETTE_CLARITY)
    expect(gradePalette(false)).toBe(PALETTE_HERALDIC)
    expect(TIERS.every((t) => PALETTE_CLARITY[t].hatch === 'plain')).toBe(true)
    expect(TIERS.map(rankPips)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(tierIndex(100)).toBe(6)
  })

  it('tells owners apart by lightness, which survives every colour deficiency', () => {
    expect(contrastRatio(OWNER_CUES.me.bezel, OWNER_CUES.opponent.bezel)).toBeGreaterThan(7)
    expect(OWNER_CUES.me.rim).toBe('smooth')
    expect(OWNER_CUES.opponent.rim).toBe('milled')
    expect(contrastRatio(SPECIAL_FACES.commander.base, SPECIAL_FACES.commander.ink)).toBeGreaterThan(7)
  })

  it('has a symbol for every unit type', () => {
    expect(Object.keys(UNIT_SYMBOLS)).toHaveLength(16)
  })
})

describe('colour helpers', () => {
  it('round-trips hex colours and mixes between them', () => {
    expect(rgbToHex(hexToRgb('#A81E2B'))).toBe('#A81E2B')
    expect(rgbToHex(hexToRgb('#abc'))).toBe('#AABBCC')
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000')
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF')
  })

  it('desaturates to grey and darkens', () => {
    const [r, g, b] = hexToRgb(adjustHex('#A81E2B', 0, 1))
    expect(r).toBeCloseTo(g, 2)
    expect(g).toBeCloseTo(b, 2)
    expect(adjustHex('#808080', 1, 0.5)).toBe('#404040')
  })

  it('measures WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1)
    expect(() => hexToRgb('nope')).toThrow()
  })
})

describe('CSS variables', () => {
  it('publishes the grade colours of the chosen palette', () => {
    expect(themeCssVariables(false)['--grade-10']).toBe(PALETTE_HERALDIC[10].base)
    expect(themeCssVariables(true)['--grade-10']).toBe(PALETTE_CLARITY[10].base)
    expect(themeCssVariables(false)['--font-numbers']).toContain('Barlow Semi Condensed')
  })
})
