// Public surface of the 3D board renderer. The dev demo is imported from './RenderDemo' directly (route '#/dev/render')
// so it stays out of the game bundle.

export { BoardRenderer } from './BoardRenderer'
export { ExtrasBoard } from './ExtrasBoard'
export { BLOCKER_MODEL_PATHS, buildingModelPath, commanderIcon, loadAssetManifest, unitGlyph, unitIcon } from './assets'
export type { AnimationSpeed } from './timeline'
export type { IsoStyle } from './cameraMath'
export type {
  AreaPreview,
  BoardChip,
  BoardFloater,
  BoardRendererExtras,
  BoardRendererHandle,
  BoardStrike,
  BoardViewProps,
  ChipTone,
  DamageForecast,
  GhostMarker,
  MovePreview,
} from './types'
