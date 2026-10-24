// What a coin looks like (research-art 6): its face tone (grade, or the special faces without a grade) and symbol.

import type { CommanderId, Tier, UnitTypeId } from '@coinduel/engine'
import { COMMANDER_PORTRAITS, SPECIAL_FACES, UNIT_SYMBOLS, gradePalette, type GradeTone } from '../theme'

export interface CoinLook {
  readonly type: UnitTypeId
  /** Effective tier (Sabrina's Artificer shows tier 10), null for tokens without a grade. */
  readonly tier: Tier | null
  readonly mine: boolean
  readonly commander: CommanderId | null
  readonly clarity: boolean
  readonly power?: number
  readonly toughness?: number
  readonly maxToughness?: number
  readonly acted?: boolean
  readonly defending?: boolean
  readonly stealthed?: boolean
  readonly ghost?: boolean
  readonly selected?: boolean
  readonly showPlate?: boolean
}

export function faceTone(type: UnitTypeId, tier: Tier | null, clarity: boolean): GradeTone {
  if (type === 'commander') return SPECIAL_FACES.commander
  if (tier === null) return SPECIAL_FACES.dummy
  return gradePalette(clarity)[tier]
}

/** The unit symbol; a commander shows its portrait. */
export function coinSymbol(type: UnitTypeId, commander: CommanderId | null): string {
  if (type === 'commander' && commander !== null) return COMMANDER_PORTRAITS[commander]
  return UNIT_SYMBOLS[type]
}
