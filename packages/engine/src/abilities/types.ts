// The ability framework: what a unit or commander file exports. Every hook is optional; the engine calls
// each one at a fixed point of the rules (see README "Ability framework"). Numbers come from the
// content table (content/abilities.ts, read them with abilityParam), never from literals in hooks.

import type { AreaCore, RulesQuery, StatsQuery } from '../query'
import type { EventBody } from '../events'
import type {
  AbilityId,
  DeathCause,
  DecisionId,
  DecisionOption,
  JsonValue,
  Metric,
  Seat,
  Square,
  Tier,
  UnitCore,
  UnitId,
} from '../types'

// ---------------------------------------------------------------- static modifiers

/** What a holder adds to one unit's stats. Same-named modifiers apply once per unit (A3-15). */
export interface StatModifier {
  readonly power?: number
  /** Permanent: raises base toughness (Trill, A7-08). */
  readonly baseToughness?: number
  /** Temporary aura: raises max toughness; losing it never kills (A3-11). */
  readonly maxToughness?: number
  readonly lov?: number
  readonly movement?: number
  /** The unit's attack range becomes at least this (Ranger, A8-04). */
  readonly attackRange?: number
  /** Extra action allowance this turn (Market, Command Aura, Holy Fervor; A2-13). */
  readonly actions?: number
}

/** Where a detector reveals enemy invisible units and mines (A4-08, A4-11). */
export type Detection = { readonly kind: 'lov' } | { readonly kind: 'range'; readonly range: number }

// ---------------------------------------------------------------- damage (3.2, 3.3)

/** attack = Power-based (basic attacks, Savagery, Assault); ability = fixed instant damage; tick = Pajazon. */
export type DamageKind = 'attack' | 'ability' | 'mine' | 'tick'

export interface HitContext {
  readonly target: UnitCore
  readonly kind: DamageKind
  /** Pipeline step 1: the attacker's current Power, or the ability's fixed number. */
  readonly base: number
  /** Ability id, 'attack' or 'mine'; used for the log and for deduplication. */
  readonly source: string
  /** The unit dealing the damage right now (attacks, Smite, Slam, Julio); null for mines and ticks. */
  readonly dealer: UnitCore | null
  /**
   * Match statistics only (R39): the unit credited when there is no dealer (a mine's Artificer, an area's caster).
   * It never changes the damage; the core sets it for mines and end-of-turn ticks.
   */
  readonly creditId?: UnitId | null
}

export type PipelineStep = 'base' | 'addition' | 'subtraction' | 'reduction' | 'defend'

export interface DamageStep {
  readonly step: PipelineStep
  readonly source: string
  readonly delta: number
  /** Running total after this step. */
  readonly total: number
}

export interface DamageOutcome {
  readonly targetId: UnitId
  /** Toughness actually lost (0 = no damage at all and no damage event, A3-04). */
  readonly amount: number
  readonly breakdown: readonly DamageStep[]
  readonly killed: boolean
}

// ---------------------------------------------------------------- triggers

export interface StepInfo {
  readonly mover: UnitCore
  readonly from: Square
  readonly to: Square
  /** 0-based index of the step within the move. */
  readonly stepIndex: number
}

export interface AdjacencyInfo {
  readonly step: StepInfo
  /** Enemy units whose distance to the holder became 1 in this step (the mover, or for the mover itself all of them). */
  readonly enemies: readonly UnitCore[]
  readonly holderIsMover: boolean
  /**
   * Whether the holder was stealthed when this step's adjacency triggers were collected. An earlier hook of the
   * same step may have revealed it since (ROG-6: two stealthed Rogues meeting both Assault, the stationary one first).
   */
  readonly holderStealthed: boolean
}

/** 'interrupt' ends the move after this step (2.5 step 7). */
export type StepOutcome = 'continue' | 'interrupt'

export interface DeathInfo {
  /** The unit as it was when it died (no longer on the board). */
  readonly unit: UnitCore
  readonly footprint: readonly Square[]
  readonly cause: DeathCause
  readonly tier: Tier | null
  readonly baseToughness: number
  readonly isCommander: boolean
}

export interface TickDamage {
  readonly target: UnitId
  readonly amount: number
}

export interface TickHeal {
  readonly target: UnitId
  readonly amount: number
}

/** End-of-turn effects are returned as data so the engine applies them in the fixed order of 2.10. */
export interface TurnEffects {
  readonly damage?: readonly TickDamage[]
  readonly heal?: readonly TickHeal[]
}

// ---------------------------------------------------------------- decisions (2.11)

export interface DecisionRequest {
  /** The ability whose onDecision hook receives the answer, and the unit carrying it. */
  readonly abilityId: AbilityId
  readonly holder: UnitCore | null
  readonly seat: Seat
  readonly kind: string
  readonly prompt: string
  readonly options: readonly DecisionOption[]
  /** Chosen on timeout and by the 'never' preference. */
  readonly defaultOption: string
  /** Chosen by the 'always' preference. */
  readonly alwaysOption?: string
  /** Seat preference key that may answer without pausing ('revive'). */
  readonly preferenceKey?: string
  readonly timeoutSeconds?: number
  /** The unit the decision is about; the other seat learns a decision is pending only if it can see it. */
  readonly subject?: UnitCore
  readonly data?: Readonly<Record<string, JsonValue>>
}

export interface DecisionCore {
  readonly id: DecisionId
  readonly seat: Seat
  readonly kind: string
  readonly data: Readonly<Record<string, JsonValue>>
}

// ---------------------------------------------------------------- targeting (declarative, UI-driven)

/**
 * Whose units a unit pick may name. 'harmful' is for single-target harmful effects (Smite, Julio Vernification):
 * enemy units, plus own units while FRIENDLY_SINGLE_TARGET is on (owner ruling R14; the UI confirms an own target).
 */
export type Relation = 'own' | 'enemy' | 'any' | 'harmful'

/**
 * One pick of an active ability, in order. Ranges are measured from the user's footprint, in Manhattan distance unless
 * `metric` says otherwise: an "adjacent" pick passes `metric: adjacencyMetric()` so it follows the ADJACENCY switch.
 */
export type TargetSpec =
  | {
      readonly kind: 'unit'
      readonly label: string
      readonly range: number
      readonly metric?: Metric
      readonly relation: Relation
      readonly includeSelf: boolean
      readonly allowCommander: boolean
    }
  | {
      readonly kind: 'square'
      readonly label: string
      readonly minRange: number
      readonly range: number
      readonly metric?: Metric
      /** Exists, open ground, no known unit, no own mine (A8-13). */
      readonly free: boolean
    }
  | { readonly kind: 'area3x3'; readonly label: string; readonly centreRange: number }
  | { readonly kind: 'connectedSquares'; readonly label: string; readonly count: number }
  /** Any legal basic-attack target of this unit (Savagery). */
  | { readonly kind: 'attack'; readonly label: string }

export type AttackTarget =
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  | { readonly kind: 'square'; readonly square: Square }

export type AbilityTarget =
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  | { readonly kind: 'square'; readonly square: Square }
  | { readonly kind: 'squares'; readonly squares: readonly Square[] }

// ---------------------------------------------------------------- the mutation context

export interface AttackOutcome {
  readonly result: 'hit' | 'nullified' | 'mine' | 'nothing'
  readonly damage: number
  readonly targetId: UnitId | null
}

export type RevealCause = 'adjacency' | 'damage' | 'detection'

export interface AreaSpec {
  readonly abilityId: AbilityId
  readonly owner: Seat
  readonly source: UnitCore | null
  readonly squares: readonly Square[]
  /** Own turns it lasts, counting the creation turn (A2-23). */
  readonly durationOwnTurns: number
  readonly data?: Readonly<Record<string, number>>
}

export type MinePlacement = 'placed' | 'blockedByHiddenMine'

/**
 * Fixed ability damage on one unit plus a splash on squares, resolved as one simultaneous effect (3.4). Smite (R25):
 * squares = adjacentSquares(target anchor, size, 'ORTHO_4'). Forceful slam (A8-20): squares = slamSplash(...).
 */
export interface SplashSpec {
  readonly source: AbilityId
  /** The unit dealing it (Ratasius' weakness applies, R13 floors it at 1). */
  readonly dealer: UnitCore
  /** The unit taking the main hit (Smite's target, the unit on Slam's target square), or null for an empty square. */
  readonly target: UnitCore | null
  readonly damage: number
  /** Squares whose units take `splash`; squares without a unit, terrain and off-board squares absorb nothing. */
  readonly squares: readonly Square[]
  readonly splash: number
  /** false = the dealer's own units are skipped (SLAM_FRIENDLY_FIRE's alternative); R25's Smite splash passes true. */
  readonly friendlyFire: boolean
}

/** Truth-side context for resolving effects. All state changes go through these methods. */
export interface ResolveContext extends RulesQuery {
  /** Every hit goes through the pipeline; deaths and their triggers resolve immediately. */
  dealDamage(hit: HitContext): DamageOutcome
  /** Simultaneous damage (3.4): computed on the board before, applied together, deaths resolved together. */
  dealDamageTogether(hits: readonly HitContext[]): readonly DamageOutcome[]
  /**
   * A target hit plus a splash as one effect (Smite R25, Forceful slam A8-20): every unit is hit once, a unit on
   * both takes only the main hit, and no mine goes off. Outcomes list the main target first when there is one.
   */
  dealSplash(spec: SplashSpec): readonly DamageOutcome[]
  /** Capped at max toughness (A3-10). Returns the amount actually healed. */
  heal(target: UnitCore, amount: number, source: string): number
  /**
   * Toughness loss that is not damage (A3-08): no pipeline, no reveal. Never below 1 unless `canKill` (Shared wounds
   * under R19, where a donor at 1 dies). Returns the amount lost.
   */
  loseToughness(target: UnitCore, amount: number, source: string, options?: { readonly canKill?: boolean }): number
  /** Destroys an own non-commander unit (A3-13); its death triggers run after the current effect. */
  sacrifice(unit: UnitCore, source: string): void
  /** An attack outside the Attack action (Savagery, Assault). `triggered` attacks don't cancel Defend. */
  attack(attacker: UnitCore, target: AttackTarget, options: { readonly source: string; readonly triggered: boolean }): AttackOutcome
  /** Creates a No-ACB dummy on a square; entering an unseen mine sets it off (A8-16). */
  createUnit(type: 'noAcb', owner: Seat, anchor: Square, createdBy: UnitCore | null): UnitCore | null
  placeMine(owner: Seat, square: Square, placedBy: UnitCore | null): MinePlacement
  createArea(spec: AreaSpec): AreaCore
  setStealthed(unit: UnitCore, stealthed: boolean): void
  reveal(unit: UnitCore, cause: RevealCause, by: UnitCore | null): void
  /**
   * Queso's revive (A7-16) and Cauldron's return (R11): the same instance comes back at `toughness` with temporary
   * statuses cleared, on the squares where it died or at `anchor`. Returns null if the squares are not free.
   */
  revive(unitId: UnitId, toughness: number, anchor?: Square): UnitCore | null
  /** Marks a unit as having used every action (and its Move) this turn (Cauldron's returned unit, R11). */
  exhaust(unit: UnitCore): void
  /**
   * Charges AP outside an action. On the seat's own turn it is paid now (false if the pool can't cover it); on the
   * opponent's turn it becomes a debt deducted from the seat's next pool (R11, BABA_CAULDRON_AP_DEBT).
   */
  chargeAp(seat: Seat, amount: number): boolean
  /** Permanent max-toughness change (Queso's payment); current is clamped to the new max (A3-11). */
  changePermanentToughness(unit: UnitCore, delta: number): void
  requestDecision(request: DecisionRequest): void
  setTurnFlag(unit: UnitCore, key: string, value: number): void
  setMemory(unit: UnitCore, key: string, value: number): void
  memory(unit: UnitCore, key: string): number
  /** Reset at the start of the seat's own turn (q.seatCounter reads it). */
  setSeatCounter(seat: Seat, key: string, value: number): void
  /** Reset at the start of every turn, either player's (q.turnCounter reads it). */
  setTurnCounter(seat: Seat, key: string, value: number): void
  /** A unit that died this game (for revives). */
  fallenUnit(id: UnitId): UnitCore | undefined
  /** Truth-side vision (host only). */
  canSee(seat: Seat, unit: UnitCore): boolean
  seesSquare(seat: Seat, square: Square): boolean
  /** Emits an event to the listed seats (the engine strips the audience before sending, view.filterEvents). */
  emit(event: EventBody, visibleTo: readonly Seat[]): void
}

// ---------------------------------------------------------------- the definition every file exports

export interface ActiveSpec {
  readonly targets: readonly TargetSpec[]
  /** Extra legality on the actor's knowledge only; return a player-facing reason, or null if legal. */
  readonly validate?: (q: RulesQuery, unit: UnitCore, targets: readonly AbilityTarget[]) => string | null
  /**
   * A precondition that doesn't depend on the targets (Savagery needs a basic Attack this turn), on the actor's
   * knowledge. checkAbilityReady runs it, so the action bar (legalActions) shows the reason before any pick.
   */
  readonly requirement?: (q: RulesQuery, unit: UnitCore) => string | null
  /** Resolves against the true state. AP, the action, cooldowns and use counts are already paid. */
  readonly resolve: (ctx: ResolveContext, unit: UnitCore, targets: readonly AbilityTarget[]) => void
  /** The opponent is not told the ability was used, even when it sees the user (4.8: a mine placement tells it nothing). */
  readonly secret?: boolean
}

export interface AreaHooks {
  /** Pipeline step 4 for units standing in the area (Forcefield). */
  readonly targetReduction?: (q: RulesQuery, area: AreaCore, hit: HitContext) => number
  /** Called at the end of every turn; `endingSeat` is the player whose turn ends (2.10). */
  readonly endOfTurn?: (q: RulesQuery, area: AreaCore, endingSeat: Seat) => TurnEffects | null
}

export interface AbilityDefinition {
  /** Must match an entry of content/abilities.ts. */
  readonly id: AbilityId
  /** 'stub' abilities are listed on cards but refused when used (and their hooks are ignored). */
  readonly status: 'implemented' | 'stub'
  /** Static modifier the holder projects onto `target` (the holder itself included). */
  readonly modifyStats?: (q: StatsQuery, holder: UnitCore, target: UnitCore) => StatModifier | null
  readonly detection?: (q: RulesQuery, holder: UnitCore) => Detection | null
  /** Step 2, attacks only; called for the dealer's own abilities. */
  readonly attackerAddition?: (q: RulesQuery, holder: UnitCore, hit: HitContext) => number
  /** Step 3 (floor WEAKNESS_FLOOR, 1 under R13); called for every unit's abilities, dealt damage only (not mines or ticks). */
  readonly attackerSubtraction?: (q: RulesQuery, holder: UnitCore, hit: HitContext) => number
  /** Step 4 (floor 1); called for every unit's abilities. */
  readonly targetReduction?: (q: RulesQuery, holder: UnitCore, hit: HitContext) => number
  /** Extra AP on the holder's own next action, given the actions it already used this turn (Holy Fervor). */
  readonly actionSurcharge?: (actionsUsed: number) => number
  /** An enemy became adjacent through a movement step (Assault). Called in APNAP order (2.11). */
  readonly onAdjacencyGained?: (ctx: ResolveContext, holder: UnitCore, info: AdjacencyInfo) => StepOutcome | void
  /** Any unit completed a movement step (after mines and adjacency hooks). */
  readonly onUnitStep?: (ctx: ResolveContext, holder: UnitCore, step: StepInfo) => StepOutcome | void
  readonly onDamaged?: (ctx: ResolveContext, holder: UnitCore, hit: HitContext, outcome: DamageOutcome) => void
  /** A unit died (sacrifices included); the holder is alive. Called in APNAP order. */
  readonly onUnitDied?: (ctx: ResolveContext, holder: UnitCore, death: DeathInfo) => void
  /** The holder's controller's turn ends (2.10 steps 1 and 3). */
  readonly endOfOwnTurn?: (q: RulesQuery, holder: UnitCore) => TurnEffects | null
  readonly endOfOpponentTurn?: (q: RulesQuery, holder: UnitCore) => TurnEffects | null
  /** The holder's controller's turn starts (2.10 start step 5). */
  readonly startOfOwnTurn?: (ctx: ResolveContext, holder: UnitCore) => void
  /** Extra AP its controller receives when its turn starts, added after the cap (Tribute, R25). One per ability id. */
  readonly startOfTurnAp?: (q: RulesQuery, holder: UnitCore) => number
  readonly onDecision?: (ctx: ResolveContext, holder: UnitCore | null, decision: DecisionCore, choice: string) => void
  readonly active?: ActiveSpec
  /** Hooks for areas this ability creates (they outlive the creator, A2-26). */
  readonly area?: AreaHooks
}
