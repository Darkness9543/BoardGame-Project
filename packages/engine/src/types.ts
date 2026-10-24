// Core identifiers and the GameState shape. The state is plain JSON (no Map, Set, class, undefined
// or NaN), integers only, and holds its own RNG state, so it can be cloned, hashed, sent and replayed.
// Engine code mutates private clones only; callers must treat every GameState they receive as immutable.

import type { PreferenceValue } from './constants'
import type { ActionIntent } from './commands'

/** A player slot. The lobby creator is the host; who plays South is decided by the coin flip (A2-04). Strictly two seats (A13-02). */
export type Seat = 'host' | 'guest'
export const SEATS: readonly Seat[] = ['host', 'guest']
/** South moves first (A1-01, A2-04). */
export type Side = 'south' | 'north'

/** 0-based: x = column A..Y (west to east as South sees it), y = row 1..25 minus 1 (south to north). */
export interface Square {
  readonly x: number
  readonly y: number
}
export type Metric = 'manhattan' | 'chebyshev'

/** A unit's denomination: its type, grade and default cost (A5-01). */
export type Tier = 1 | 2 | 5 | 10 | 20 | 50 | 100
export const TIERS: readonly Tier[] = [1, 2, 5, 10, 20, 50, 100]

export type RosterUnitId =
  | 'footman'
  | 'mercenary'
  | 'soldier'
  | 'ranger'
  | 'berserker'
  | 'rogue'
  | 'priestess'
  | 'juliomancer'
  | 'paladin'
  | 'artificer'
  | 'royalWizard'
  | 'beast'
  | 'emissary'
  | 'scourge'
/** Roster units plus the commander and the created No-ACB dummy. */
export type UnitTypeId = RosterUnitId | 'commander' | 'noAcb'
/** 'baseline' is a dev/test commander with no effects; it is not selectable in normal lobbies. */
export type CommanderId = 'trill' | 'kulega' | 'sabrina' | 'babaYaga' | 'ratasius' | 'queso' | 'baseline'
export type FactionId = 'empire' | 'lojrar'
export type BuildingKind = 'keep' | 'market'
export type ScenarioId = 'crossroads' | 'openField'
export type Phase = 'lobby' | 'deployment' | 'battle' | 'ended'

/** Opaque ids drawn from the seeded RNG, so they reveal nothing about army size (NC 7.19 #2). */
export type UnitId = string
export type MineId = string
export type AreaId = string
export type DecisionId = string
/** '<unit or commander>.<ability>', for example 'soldier.perseverance'. */
export type AbilityId = string

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

/** An army = faction + commander + unit counts (A5-11), plus the commander's variant when it has some (R11). */
export interface ArmyList {
  readonly faction: FactionId
  readonly commander: CommanderId
  readonly units: Partial<Record<RosterUnitId, number>>
  /** Required for commanders with variants (Baba Yaga: 'mend' | 'hex-ward' | 'cauldron'); public with the commander. */
  readonly variant?: string
}

/** Lobby settings (2.1). Everything else is a constant. */
export interface MatchSettings {
  readonly scenarioId: ScenarioId
  readonly budget: number
  readonly keepEnabled: boolean
  readonly marketEnabled: boolean
  readonly takebacks: boolean
  /** null = unlimited (TAKEBACKS_PER_GAME). */
  readonly takebacksPerGame: number | null
  /** null = off. The session runs the clock and sends endTurn when it expires (R29: 90 s by default online). */
  readonly turnTimerSeconds: number | null
  /** R29: per-player time bank used after the turn timer runs out; null = none. */
  readonly timeBankSeconds: number | null
  /** Allows non-selectable dev content such as the 'baseline' commander. */
  readonly devContent: boolean
}

/** The fields every unit representation shares (true state and per-seat views); ability hooks see these. */
export interface UnitCore {
  readonly id: UnitId
  readonly type: UnitTypeId
  readonly owner: Seat
  /** South-west square of the footprint; null while undeployed. */
  readonly anchor: Square | null
  /** Current toughness. */
  readonly toughness: number
  readonly defending: boolean
  readonly stealthed: boolean
}

/** A2-22: CD N used on own turn T is ready again on own turn T + N + 1. */
export interface CooldownState {
  readonly usedOnOwnTurn: number
  readonly readyOnOwnTurn: number
}

/** Per-turn counters, reset at the start of the controller's turn (2.10 start step 2). */
export interface UnitTurnState {
  actionsUsed: number
  /** Moves taken this turn (R12: each extra action may be a Move). */
  moves: number
  /** A basic Attack resolved this turn (enables Savagery, A8-05). */
  basicAttack: boolean
  abilityUses: Record<AbilityId, number>
  /** Free-form per-turn flags for ability code. */
  flags: Record<string, number>
}

export interface UnitState {
  id: UnitId
  type: UnitTypeId
  owner: Seat
  anchor: Square | null
  toughness: number
  defending: boolean
  stealthed: boolean
  /** Creation order: the deterministic tie-break inside one player's simultaneous effects (A2-28). */
  seq: number
  createdBy: UnitId | null
  /** Permanent max-toughness change stored on the unit (Queso's payments, A3-11). */
  permanentToughness: number
  /** Temporary max-toughness bonus currently applied (Strong aura); see stats.syncAuraToughness. */
  auraToughness: number
  /** A2-25: per ability per unit instance; kept through a revive. */
  cooldowns: Record<AbilityId, CooldownState>
  turn: UnitTurnState
  /** Persistent per-unit numbers for ability code (survive turns and revives). */
  memory: Record<string, number>
}

export type DeathCause = 'damage' | 'sacrifice' | 'auraLoss' | 'toughnessLoss'

export interface FallenUnit {
  unit: UnitState
  /** Global turn number of the death (0 before the battle). */
  diedOnTurn: number
  cause: DeathCause
}

export interface MineState {
  id: MineId
  owner: Seat
  square: Square
  /** Revealed to the opponent by detection (A4-11); stays revealed until it explodes. */
  revealed: boolean
  seq: number
  placedBy: UnitId | null
}

/** A created area effect (Forcefield, Pajazon). It outlives its creator (A2-26). */
export interface AreaState {
  id: AreaId
  abilityId: AbilityId
  owner: Seat
  sourceId: UnitId | null
  squares: Square[]
  createdOnOwnTurn: number
  /** Removed at the start of the owner's own turn with this index (A2-23, A2-24). */
  expiresAtOwnTurn: number
  seq: number
  data: Record<string, number>
}

export interface BuildingState {
  kind: BuildingKind
  anchor: Square
  /** "Active" = controlled (A6-05); null = neutral. */
  controller: Seat | null
}

export interface SeatState {
  name: string
  army: ArmyList | null
  ready: boolean
  deploymentConfirmed: boolean
  ap: number
  /** Own-turn index: 0 before this seat's first turn, then 1, 2, 3, ... (2.2). */
  ownTurns: number
  /** Per-turn seat counters for ability code (Mend uses), reset at the start of this seat's own turn. */
  counters: Record<string, number>
  /** Seat counters reset at the start of every turn, either player's (Cauldron returns per turn, R11). */
  turnCounters: Record<string, number>
  /** AP owed, deducted from this seat's next pool (Cauldron on the opponent's turn, R11). */
  apDebt: number
  /** R30: consecutive own turns started while controlling both buildings. */
  siegeTurns: number
  preferences: Record<string, PreferenceValue>
}

/** A2-05: a turn is one player's turn; a round is South's turn then North's. */
export interface TurnState {
  /** Global turn number: 1 = South's first turn, 2 = North's first turn, ... */
  number: number
  activeSeat: Seat
}

/** End-of-turn processing in the fixed order of 2.10; it can pause for a reaction decision. */
export type TransitionStep = 'damage' | 'heal' | 'capture' | 'expire' | 'start'
export interface TurnTransition {
  endingSeat: Seat
  next: TransitionStep
}

export interface DecisionOption {
  readonly id: string
  readonly label: string
}

/** A choice that pauses the game (Queso's revive, A2-30). Resolved by a respondDecision intent. */
export interface PendingDecision {
  id: DecisionId
  seat: Seat
  /** Ability whose onDecision hook resolves the answer. */
  abilityId: AbilityId
  holderId: UnitId | null
  kind: string
  prompt: string
  options: DecisionOption[]
  /** Chosen on timeout and by the 'never' preference. */
  defaultOption: string
  /** Chosen by the 'always' preference. */
  alwaysOption: string | null
  /** Seat preference that can answer it without pausing (REVIVE_PREFERENCE). */
  preferenceKey: string | null
  timeoutSeconds: number
  /** Seats allowed to know a decision is pending: the decider, plus the other seat if the subject was visible to it. */
  publicTo: Seat[]
  data: Record<string, JsonValue>
}

export interface TakebackRequest {
  requester: Seat
  actionSeq: number
  /** The action to undo (shown to the decider, 9 TB-4). */
  action: ActionIntent
  /** What the action revealed to the requester about the decider's side (9 TB-5). */
  revealedUnits: UnitId[]
  revealedMines: MineId[]
}

export interface TakebackState {
  request: TakebackRequest | null
  /** Action seqs whose take-back was declined; they can't be requested again (TB-7). */
  declined: number[]
  used: Record<Seat, number>
}

export interface LastAction {
  seq: number
  seat: Seat
  intent: ActionIntent
}

/** A6-12: conquest = enemy commander killed; domination = own commander reached the last row; R30: siege. */
export type GameResultReason = 'conquest' | 'domination' | 'siege' | 'resignation' | 'agreement' | 'simultaneousCommanderDeath'

export interface GameResult {
  /** null = draw. */
  readonly winner: Seat | null
  readonly reason: GameResultReason
  readonly turnNumber: number
}

/** mulberry32 state (uint32). */
export interface RngState {
  readonly s: number
}

export interface GameState {
  schemaVersion: number
  rulesVersion: number
  phase: Phase
  settings: MatchSettings
  seed: string
  rng: RngState
  /** Set by the coin flip when deployment starts. */
  southSeat: Seat | null
  seats: Record<Seat, SeatState>
  /** Living units in creation order (deployed or not). */
  units: UnitState[]
  fallen: FallenUnit[]
  mines: MineState[]
  areas: AreaState[]
  buildings: BuildingState[]
  turn: TurnState | null
  transition: TurnTransition | null
  /** Queue of pending decisions; the head is the one being asked. */
  decisions: PendingDecision[]
  takeback: TakebackState
  /** Seat with an open draw offer. */
  drawOffer: Seat | null
  /** R28: the round of first contact (any unit first saw an enemy unit); null = the approach boost still runs. */
  firstContactRound: number | null
  /** Most recent battle action (move, attack, defend, ability, end turn); take-back targets it. */
  lastAction: LastAction | null
  actionCount: number
  nextSeq: number
  result: GameResult | null
}
