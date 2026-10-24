// Per-player options (PX section 10, UX 22.1). They change comfort, never a rule (A13-01). Defaults that the
// rules document names come from the engine's constants.

import { create } from 'zustand'
import { LAST_SEEN_MARKERS, OWN_MINE_WARNING, REVIVE_PREFERENCE, VIEW_MODE_DEFAULT, type PreferenceValue } from '@coinduel/engine'
import { appStore, boolOr, isRecord, oneOf, readJson, writeJson, type KeyValueStore } from './storage'

/** "Action confirmation" (UX 22.1): preview then confirm, for everything, for attacks and abilities, or never. */
export type ConfirmMode = 'always' | 'attacksAbilities' | 'never'
export type EndTurnConfirm = 'whenCanAct' | 'always' | 'never'
export type MotionPreference = 'system' | 'reduce' | 'full'
export type AnimationSpeed = 'normal' | 'fast' | 'instant'
export type TakebackAnswer = 'ask' | 'autoAccept' | 'autoDecline'
export type ViewMode = 'top' | 'iso'
export type LogFilter = 'all' | 'combat' | 'movement' | 'objectives' | 'system'
/** Which board renderer draws the match: the 3D board, or the light 2D one for slow devices. */
export type BoardChoice = '3d' | 'svg'

export interface Settings {
  readonly confirmMode: ConfirmMode
  /** A8-17 / L102: ask before a path enters a known mine. R34: the commander always asks. */
  readonly mineWarning: boolean
  /** A2-30: the answer to reaction prompts (Queso's revive, Cauldron). */
  readonly revivePreference: PreferenceValue
  /** A1-16: presentation only. */
  readonly defaultView: ViewMode
  /** A4-16: client memory of enemies that left vision. */
  readonly lastSeenMarkers: boolean
  /** Palette C plus rank pips (research-art 5.4). */
  readonly clarityMode: boolean
  readonly motion: MotionPreference
  readonly animationSpeed: AnimationSpeed
  readonly endTurnConfirm: EndTurnConfirm
  readonly autoSelectNext: boolean
  readonly highlightReady: boolean
  readonly coordinates: boolean
  /** Tab title is always updated; this adds a system notification while the tab is hidden. */
  readonly notifyTurn: boolean
  readonly takebackAnswer: TakebackAnswer
  readonly logFilter: LogFilter
  readonly followEnemyActions: boolean
  readonly board: BoardChoice
}

export const DEFAULT_SETTINGS_UI: Settings = {
  confirmMode: 'always',
  mineWarning: OWN_MINE_WARNING,
  revivePreference: REVIVE_PREFERENCE,
  defaultView: VIEW_MODE_DEFAULT,
  lastSeenMarkers: LAST_SEEN_MARKERS,
  clarityMode: false,
  motion: 'system',
  animationSpeed: 'normal',
  endTurnConfirm: 'whenCanAct',
  autoSelectNext: false,
  highlightReady: true,
  coordinates: true,
  notifyTurn: false,
  takebackAnswer: 'ask',
  logFilter: 'all',
  followEnemyActions: true,
  board: '3d',
}

const KEY = 'settings.v1'

export function parseSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS_UI
  if (!isRecord(raw)) return d
  return {
    confirmMode: oneOf(raw['confirmMode'], ['always', 'attacksAbilities', 'never'], d.confirmMode),
    mineWarning: boolOr(raw['mineWarning'], d.mineWarning),
    revivePreference: oneOf(raw['revivePreference'], ['ask', 'always', 'never'], d.revivePreference),
    defaultView: oneOf(raw['defaultView'], ['top', 'iso'], d.defaultView),
    lastSeenMarkers: boolOr(raw['lastSeenMarkers'], d.lastSeenMarkers),
    clarityMode: boolOr(raw['clarityMode'], d.clarityMode),
    motion: oneOf(raw['motion'], ['system', 'reduce', 'full'], d.motion),
    animationSpeed: oneOf(raw['animationSpeed'], ['normal', 'fast', 'instant'], d.animationSpeed),
    endTurnConfirm: oneOf(raw['endTurnConfirm'], ['whenCanAct', 'always', 'never'], d.endTurnConfirm),
    autoSelectNext: boolOr(raw['autoSelectNext'], d.autoSelectNext),
    highlightReady: boolOr(raw['highlightReady'], d.highlightReady),
    coordinates: boolOr(raw['coordinates'], d.coordinates),
    notifyTurn: boolOr(raw['notifyTurn'], d.notifyTurn),
    takebackAnswer: oneOf(raw['takebackAnswer'], ['ask', 'autoAccept', 'autoDecline'], d.takebackAnswer),
    logFilter: oneOf(raw['logFilter'], ['all', 'combat', 'movement', 'objectives', 'system'], d.logFilter),
    followEnemyActions: boolOr(raw['followEnemyActions'], d.followEnemyActions),
    board: oneOf(raw['board'], ['3d', 'svg'], d.board),
  }
}

export function loadSettings(store: KeyValueStore = appStore()): Settings {
  return readJson(store, KEY, parseSettings, DEFAULT_SETTINGS_UI)
}

interface SettingsStore {
  readonly settings: Settings
  update(patch: Partial<Settings>): void
  reset(): void
}

export const useSettings = create<SettingsStore>()((set, get) => ({
  settings: loadSettings(),
  update(patch) {
    const settings = { ...get().settings, ...patch }
    writeJson(appStore(), KEY, settings)
    set({ settings })
  },
  reset() {
    writeJson(appStore(), KEY, DEFAULT_SETTINGS_UI)
    set({ settings: DEFAULT_SETTINGS_UI })
  },
}))

export function prefersReducedMotion(preference: MotionPreference): boolean {
  if (preference !== 'system') return preference === 'reduce'
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
