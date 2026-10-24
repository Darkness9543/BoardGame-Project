// @coinduel/engine: pure, deterministic rules engine. No DOM, no network, no clock, no Math.random.
// Rules source of truth: docs/RULES_INTERPRETATION.md. API guide: packages/engine/README.md.

export const ENGINE_VERSION = '0.1.0'

// Core types and constants
export * from './types'
export * from './constants'
export type { EventBody, EventType, GameEvent, MoveEndReason, VisibleEvent } from './events'
export type { Rejection, RejectionCode, Validation } from './rejection'

// Content tables (units, abilities, commanders, buildings, scenarios, factions)
export * from './content/index'

// Geometry, hashing, RNG
export * from './geometry'
export { canonicalJson, fnv1a32, fnv1a64Hex, hashJson, sha256Hex, utf8Bytes } from './hash'
export { combineSecrets, commitSecret, flipFirstSeat, nextId, nextInt, nextUint32, seedRng, verifySecret } from './rng'

// Game creation and commands
export { createGame, DEFAULT_SETTINGS, type CreateGameOptions } from './state'
export {
  apply,
  checkAbilityReady,
  checkTarget,
  isActionIntent,
  MARCH_OFFSETS,
  validate,
  validateIntent,
  type ActionIntent,
  type ApplyOptions,
  type ApplyResult,
  type Intent,
  type IntentKind,
  type MarchDirection,
} from './commands'
export { armyCost, armyUnitCount, checkArmy, zoneCapacity, type ArmyCheck } from './army'
export { allowedZones, deploymentSquares } from './deployment'

// Views, events, previews
export {
  canRequestTakeback,
  filterEvents,
  isVisibleSquare,
  projectView,
  ViewQuery,
  type AreaView,
  type DecisionView,
  type MineView,
  type OwnUnitDetails,
  type PlayerView,
  type TakebackView,
  type UnitView,
} from './view'
export {
  attackTargets,
  bestPath,
  chargeTargets,
  legalActions,
  previewAttack,
  reachableSquares,
  targetOptions,
  type ActionKind,
  type ActionOption,
  type ReachableSquare,
} from './preview'
export { StateQuery, type AreaCore, type BuildingCore, type MineCore, type RulesQuery, type StatsQuery, type UnitStats, type UnitTurnView } from './query'
export { computeHit, collectHit, PIPELINE_RULES, runPipeline, type Contribution, type PipelineInput, type PipelineResult, type PipelineRules } from './damage'
export { lovContains, visionMask } from './vision'

// History: log, replay, take-back frames, snapshots
export {
  deserializeState,
  hashState,
  replay,
  replayRecord,
  ReplayError,
  restoreRecord,
  serializeRecord,
  serializeState,
  startRecord,
  submit,
  type Frame,
  type LogEntry,
  type MatchRecord,
  type SubmitResult,
} from './history'

// Ability framework (for unit and commander files, and tests)
export type * from './abilities/types'
export { allAbilityDefinitions, getAbility, liveAbility, registerAbility } from './abilities/registry'

// Scenario DSL for tests and a dev sandbox
export { act, buildBattle, sqs, startMatch, unitIn, type Battle, type BattleSpec, type MatchStartSpec, type Placement, type PlacementSpec } from './testing/dsl'
export { findLeaks } from './testing/fogLeak'
