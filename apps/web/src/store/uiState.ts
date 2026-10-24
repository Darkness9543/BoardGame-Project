// Transient presentation state shared by the match screens: camera mode (A1-16: every match starts from the player's
// default view), open panels and overlays, the hovered action-bar button, and the squares a hovered log line points at.

import { create } from 'zustand'
import type { Square, UnitId } from '@coinduel/engine'
import type { ActionRef } from './command'
import { useSessionStore } from './sessionStore'
import { useSettings, type ViewMode } from './settings'

export type SidePanel = 'log' | 'armies'

/** The action-bar button under the pointer or focus; what it says is read from the current buttons (S-10.5, S-11.2). */
export interface HoveredAction {
  readonly unitId: UnitId
  readonly action: ActionRef
}

interface UiState {
  readonly cameraMode: ViewMode
  readonly shortcutsOpen: boolean
  readonly menuOpen: boolean
  readonly sidePanel: SidePanel
  readonly sideOpen: boolean
  readonly threat: boolean
  readonly highlight: readonly Square[]
  /** The hovered action-bar button: its cost previews on the AP widget, its disabled reason on the hint line. */
  readonly hoveredAction: HoveredAction | null
  /** Square the player asked the camera to show (F, a log line, a toast). */
  readonly focus: Square | null
  toggleCamera(): void
  setCamera(mode: ViewMode): void
  setShortcuts(open: boolean): void
  setMenu(open: boolean): void
  showSide(panel: SidePanel): void
  toggleSide(): void
  toggleThreat(): void
  setHighlight(squares: readonly Square[]): void
  setHoveredAction(hovered: HoveredAction | null): void
  setFocus(square: Square | null): void
}

export const useUiState = create<UiState>()((set, get) => ({
  cameraMode: useSettings.getState().settings.defaultView,
  shortcutsOpen: false,
  menuOpen: false,
  sidePanel: 'log',
  sideOpen: true,
  threat: false,
  highlight: [],
  hoveredAction: null,
  focus: null,
  toggleCamera: () => set({ cameraMode: get().cameraMode === 'top' ? 'iso' : 'top' }),
  setCamera: (cameraMode) => set({ cameraMode }),
  setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
  setMenu: (menuOpen) => set({ menuOpen }),
  showSide: (sidePanel) => set({ sidePanel, sideOpen: true }),
  toggleSide: () => set({ sideOpen: !get().sideOpen }),
  toggleThreat: () => set({ threat: !get().threat }),
  setHighlight: (highlight) => set({ highlight }),
  setHoveredAction: (hoveredAction) => {
    if (!sameHover(get().hoveredAction, hoveredAction)) set({ hoveredAction })
  },
  setFocus: (focus) => set({ focus }),
}))

function sameHover(a: HoveredAction | null, b: HoveredAction | null): boolean {
  if (a === null || b === null) return a === b
  if (a.unitId !== b.unitId || a.action.kind !== b.action.kind) return false
  return a.action.kind !== 'ability' || (b.action.kind === 'ability' && a.action.abilityId === b.action.abilityId)
}

// A1-16: every new match starts in the player's default view, and changing that option applies at once.
let shownRoom: string | null = null
useSessionStore.subscribe((s) => {
  if (s.roomId === shownRoom) return
  shownRoom = s.roomId
  if (s.roomId !== null) useUiState.getState().setCamera(useSettings.getState().settings.defaultView)
})
useSettings.subscribe((s, previous) => {
  if (s.settings.defaultView !== previous.settings.defaultView) useUiState.getState().setCamera(s.settings.defaultView)
})
