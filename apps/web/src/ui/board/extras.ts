// What the battle UI wants drawn beyond BoardRendererProps (contracts.ts has no channel for them): last-seen ghosts,
// floating combat text, attack flashes, the camera focus, previews under the cursor and forecast chips. Renderers
// read them with useBoardExtras(); one that doesn't simply draws without them.

import { createContext, useContext } from 'react'
import type { Square, UnitId } from '@coinduel/engine'
import type { Ghost } from '../../store/ghosts'
import type { Flash, Floater } from '../../store/playback'
import type { AnimationSpeed } from '../../store/settings'

export type ChipTone = 'enemy' | 'ally' | 'heal' | 'lethal' | 'win' | 'info'

export interface BoardChip {
  readonly square: Square
  readonly text: string
  readonly tone: ChipTone
}

export interface BoardExtras {
  readonly ghosts: readonly Ghost[]
  readonly floaters: readonly Floater[]
  readonly flashes: readonly Flash[]
  /** Camera focus: the acting unit (playback) or the unit the player jumped to. */
  readonly focus: Square | null
  /** Known mines on the previewed path (A8-17), drawn as hazards. */
  readonly hazards: readonly Square[]
  /** Squares already picked in a multi-step action, the painted Forcefield, the march group. */
  readonly picked: readonly Square[]
  /** The area or splash under the cursor (Pajazon, Smite, Forceful slam, march destinations). */
  readonly area: readonly Square[]
  /** Squares a hovered log line or toast refers to. */
  readonly highlight: readonly Square[]
  readonly hover: Square | null
  /** Forecast chips next to targets ("-6 -> 14/20", LETHAL, WIN). */
  readonly chips: readonly BoardChip[]
  /** Own units that can still act during my turn; the others are drawn as acted. */
  readonly ready: ReadonlySet<UnitId>
  /** Mark the ready units with a soft pulse (S-11.5, an option). */
  readonly highlightReady: boolean
  /** Capture ring of the hovered building (16 squares, R32). */
  readonly captureRing: readonly Square[]
  /** The vision the moving unit would have at the previewed destination (UX 8.4). */
  readonly visionPreview: readonly Square[]
  /** Squares visible enemies could attack next turn (danger zone, T). */
  readonly threat: readonly Square[]
  readonly clarity: boolean
  readonly coordinates: boolean
  readonly reducedMotion: boolean
  /** How fast tokens glide between views (the playback's own beats follow the same option). */
  readonly animationSpeed: AnimationSpeed
}

export const NO_EXTRAS: BoardExtras = {
  ghosts: [],
  floaters: [],
  flashes: [],
  focus: null,
  hazards: [],
  picked: [],
  area: [],
  highlight: [],
  hover: null,
  chips: [],
  ready: new Set(),
  highlightReady: true,
  captureRing: [],
  visionPreview: [],
  threat: [],
  clarity: false,
  coordinates: true,
  reducedMotion: false,
  animationSpeed: 'normal',
}

export const BoardExtrasContext = createContext<BoardExtras>(NO_EXTRAS)

export function useBoardExtras(): BoardExtras {
  return useContext(BoardExtrasContext)
}
