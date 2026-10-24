// Inputs the renderer accepts beyond contracts.ts (BoardRendererProps). Every field is optional, so a caller that
// only knows the contract still works; README.md lists them as contract gaps.

import type { Ref } from 'react'
import type { Square, UnitId, UnitView, VisibleEvent } from '@coinduel/engine'
import type { BoardRendererProps } from '../contracts'
import type { IsoStyle } from './cameraMath'
import type { AnimationSpeed, FloatTone } from './timeline'

/** A last-seen enemy (A4-16 / C24: client memory, research-ux-conventions 13.3). */
export interface GhostMarker {
  /** The unit as it was last seen; its anchor is where it was last seen. */
  readonly unit: UnitView
  /** Round in which it was last seen (badge "R6"). */
  readonly seenRound: number
  /** It vanished on a square still in vision (Stealth): kept until seen again, killed or walked over. */
  readonly vanished: boolean
}

/** A damage forecast on a target token (from previewAttack or an ability preview). */
export interface DamageForecast {
  readonly unitId: UnitId
  readonly amount: number
  /** Unseen modifiers may change it (the forecast's "~"). */
  readonly uncertain?: boolean | undefined
}

/** A move arrow for a unit other than the selected one (Group march, R27). */
export interface MovePreview {
  readonly unitId: UnitId
  readonly path: readonly Square[]
}

/** The footprint of an area ability under the cursor: the main squares and the splash (Slam, Smite, Pajazon). */
export interface AreaPreview {
  readonly primary: readonly Square[]
  readonly secondary: readonly Square[]
}

/** A floating number or word from a UI that runs its own event playback (instead of passing `events`). */
export interface BoardFloater {
  readonly id: number | string
  readonly square: Square
  readonly text: string
  readonly tone: FloatTone
}

/** An attack shown by a UI's own playback: the unit on `from` lunges at `to`, and whatever stands there flashes. */
export interface BoardStrike {
  readonly id: number | string
  readonly from: Square
  readonly to: Square
}

export type ChipTone = 'enemy' | 'ally' | 'heal' | 'lethal' | 'win' | 'info'

/** A forecast or result chip next to a square ("-6 -> 14/20", LETHAL, WIN). */
export interface BoardChip {
  readonly square: Square
  readonly text: string
  readonly tone: ChipTone
}

export interface BoardRendererExtras {
  /** The batch that produced `view` (Session.events), for animations and floating numbers. */
  readonly events?: readonly VisibleEvent[] | undefined
  /** Changes with every new batch; each batch plays once. Defaults to the identity of `events`. */
  readonly eventsKey?: number | string | undefined
  readonly ghosts?: readonly GhostMarker[] | undefined
  readonly forecasts?: readonly DamageForecast[] | undefined
  readonly movePreviews?: readonly MovePreview[] | undefined
  readonly areaPreview?: AreaPreview | null | undefined
  /** Danger zone: squares visible enemies could attack next turn (research-ux-conventions 9.7). */
  readonly threat?: readonly Square[] | undefined
  /** Keyboard cursor, drawn like the pointer hover (and used for the hover previews). */
  readonly cursor?: Square | null | undefined
  /** Palette C plus rank pips (the UI's clarityMode). */
  readonly clarity?: boolean | undefined
  /** Defaults to the prefers-reduced-motion media query. */
  readonly reducedMotion?: boolean | undefined
  readonly animationSpeed?: AnimationSpeed | undefined
  /** Pan to the first visible action of each new batch when it is off screen. */
  readonly followEvents?: boolean | undefined
  /** Column letters and row numbers along the viewer's edges (default on). */
  readonly showCoordinates?: boolean | undefined
  /** A faint ring on own units that can still act during my turn (default on). */
  readonly highlightReady?: boolean | undefined
  readonly isoStyle?: IsoStyle | undefined
  /** Floating numbers and words of a UI's own playback (alternative to `events`). */
  readonly floaters?: readonly BoardFloater[] | undefined
  /** Attacks of a UI's own playback; each id plays once. */
  readonly strikes?: readonly BoardStrike[] | undefined
  /** Camera focus (the acting unit, or the unit the player jumped to): centred when it changes and is off screen. */
  readonly focus?: Square | null | undefined
  /** Known mines on the previewed path (A8-17), drawn as hazards. */
  readonly hazards?: readonly Square[] | undefined
  /** Squares already picked in a multi-step action (Forcefield painting, march group). */
  readonly picked?: readonly Square[] | undefined
  /** Squares a hovered log line or toast refers to. */
  readonly highlight?: readonly Square[] | undefined
  /** A building's capture ring to outline (e.g. while its card is hovered). */
  readonly captureRing?: readonly Square[] | undefined
  /** The vision a moving unit would have at the previewed destination (research-ux-conventions 8.4). */
  readonly visionPreview?: readonly Square[] | undefined
  readonly chips?: readonly BoardChip[] | undefined
  /** Own units that can still act, when the UI knows exactly (otherwise the renderer estimates from the view). */
  readonly readyUnits?: ReadonlySet<UnitId> | undefined
  /** Imperative camera control for keyboard shortcuts. */
  readonly ref?: Ref<BoardRendererHandle> | undefined
}

export type BoardViewProps = BoardRendererProps & BoardRendererExtras

export interface BoardRendererHandle {
  /** Centres a square (smoothly unless motion is reduced). */
  focus(square: Square): void
  /** Zooms to fit the whole board. */
  fit(): void
  /** Multiplies the zoom around the screen centre (> 1 zooms in). */
  zoomBy(factor: number): void
  /** Pans by screen-relative board units: dx to the right, dy upwards. */
  panBy(dx: number, dy: number): void
  /** Iso only: turns the view by 90-degree steps (Q / E). */
  rotate(steps: number): void
  /** Whether a square's centre is inside the central part of the canvas. */
  isOnScreen(square: Square): boolean
}
