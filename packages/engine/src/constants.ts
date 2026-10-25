// Every tunable and rule switch named in docs/RULES_INTERPRETATION.md Appendix A, plus the core
// numbers the engine needs. Assumption IDs (A2-07, ...) point at section 10 of that document, so an
// owner answer becomes a one-line edit here. Per-ability numbers live in content/abilities.ts.

import type { FactionId, Tier, UnitTypeId } from './types'

/** 2: GameState.matchStats (R38, R39). 3: idCounter replaces rng (opaque ids); take-back disclosures in lastAction. */
export const SCHEMA_VERSION = 3
/** Bump on any rules change; the netcode handshake compares it (NC 7.17). 2: the rulings compliance audit. 3: R43-R45. */
export const RULES_VERSION = 3

// ---------------------------------------------------------------- board and geometry (section 1)

export const BOARD_SIZE = 25
/** A1-02: corner cut rule A (8 squares per corner, 593 squares). Alternatives B, C and D are implemented. */
export type CornerRule = 'A' | 'B' | 'C' | 'D'
export const CORNER_RULE: CornerRule = 'A'
export const CORNER_RADIUS = 4
/** A1-05: "adjacent", melee reach and "range 1" are Manhattan 1 (4 squares around a 1x1). */
export type Neighbourhood = 'ORTHO_4' | 'KING_8'
export const ADJACENCY: Neighbourhood = 'ORTHO_4'
/** A1-08: movement steps are orthogonal; L34 supersedes L15's "including diagonals". */
export const MOVE_DIRECTIONS: Neighbourhood = 'ORTHO_4'
/**
 * A1-12 / owner ruling R36: occlusion is per blocker. 'tallBlockers' = only tall blockers stop sight (the v1
 * scenarios have none, so nothing blocks sight); 'allTerrain' = every blocker and building does; 'none' = never.
 */
export type VisionOcclusion = 'none' | 'tallBlockers' | 'allTerrain'
export const VISION_OCCLUSION: VisionOcclusion = 'tallBlockers'

// ---------------------------------------------------------------- AP and actions (section 2)

/**
 * Owner ruling R1 (supersedes A2-01): AP(round) = min(AP_BASE + (round - 1) x AP_PER_ROUND_INCREMENT, AP_MAX),
 * the same for both players in a round: 10, 11, ..., 20 from round 11 on. The old fixed AP_PER_TURN is withdrawn.
 */
export const AP_BASE = 10
export const AP_PER_ROUND_INCREMENT = 1
export const AP_MAX = 20
/** R28 late escalation: from this round the R1 cap no longer applies: AP(r) = AP_MAX + (r - (ESCALATION_FROM_ROUND - 1)). */
export const ESCALATION_FROM_ROUND = 20
/** R28 approach boost: until the end of the round of first contact, the round's curve value is multiplied by this. */
export const APPROACH_BOOST = 2
/** The R1 curve with R28's late escalation (no approach boost, no bonuses): 10, 11, ..., 20, then 21 at round 20. */
export function apForRound(round: number): number {
  const r = Math.max(1, round)
  if (r >= ESCALATION_FROM_ROUND) return AP_MAX + (r - (ESCALATION_FROM_ROUND - 1)) * AP_PER_ROUND_INCREMENT
  return Math.min(AP_BASE + (r - 1) * AP_PER_ROUND_INCREMENT, AP_MAX)
}
/** Owner rulings R1 / R9 (supersede A2-02): no first-turn reduction; a number would replace South's first pool. */
export const FIRST_TURN_AP: number | null = null
/** A2-03: unspent AP is lost; a positive value would carry up to that many AP into the next turn. */
export const AP_CARRYOVER = 0
/** A2-09: AP is paid for every action, extra actions included. */
export const AP_PAYMENT: 'perAction' = 'perAction'
/** A2-10: an active ability's cost replaces the unit's AP cost ('add' = on top of it, Q14). */
export type AbilityCostMode = 'replace' | 'add'
export const ABILITY_COST_MODE: AbilityCostMode = 'replace'
/** A2-07: one action per unit per turn unless an effect adds more. */
export const ACTIONS_PER_TURN = 1
/** Owner ruling R12 (supersedes A2-08): every extra action may also be a Move; a number would cap Moves per turn. */
export const MAX_MOVES_PER_TURN: number | 'allowance' = 'allowance'
/** R26 Charge: a unit with Movement >= 2 moves up to Movement - 1 and attacks, as one action costing its AP + 1. */
export const CHARGE_ENABLED = true
export const CHARGE_SURCHARGE = 1
export const CHARGE_MIN_MOVEMENT = 2
/** R27 Group march: 2 AP, up to 6 connected own units that haven't acted each step 1 square the same way. */
export const GROUP_MARCH_ENABLED = true
/** The price of a march of 1 to 3 units; larger groups pay more (groupMarchCost). */
export const GROUP_MARCH_COST = 2
export const GROUP_MARCH_MAX = 6
/** R46 (owner's table): 1-3 units 2 AP, 4-5 units 3 AP, 6 units 4 AP. */
export function groupMarchCost(unitCount: number): number {
  return Math.max(GROUP_MARCH_COST, 1 + Math.floor(unitCount / 2))
}
/** R46: units march only with units of their own type, except holders of MARCH_ANY_TYPE_ABILITY (the Soldier). */
export const MARCH_SAME_TYPE = true
export const MARCH_ANY_TYPE_ABILITY = 'soldier.lockstep'
/** A2-15: a Move may stop after 1..N steps (true = exactly N, Q84). */
export const MOVE_EXACT_DISTANCE = false
/** A2-22: CD N = after use on own turn T, usable again on own turn T + N + 1. */
export const COOLDOWN_MODE: 'skipOwnTurns' = 'skipOwnTurns'
/** A2-23: "for N turns" counts the controller's own turns, including the creation turn. */
export const DURATION_UNIT: 'ownTurns' = 'ownTurns'
/** A2-24: a non-passive effect without a stated duration lasts until its controller's next turn starts. */
export const DEFAULT_EFFECT_DURATION_OWN_TURNS = 1

// ---------------------------------------------------------------- combat (section 3)

/** A3-03 / C3: subtract flat reductions, then halve for Defend. */
export type DamageOrder = 'subtractThenHalve' | 'halveThenSubtract'
export const DAMAGE_ORDER: DamageOrder = 'subtractThenHalve'
/** A3-05: target-side reductions never take a hit below 1. */
export const TARGET_REDUCTION_FLOOR = 1
/**
 * Owner ruling R13 (supersedes A3-04 / C4): attacker-side subtractions (Ratasius' weakness) can't take a hit below
 * 1. With 0, a hit brought to 0 would be no damage at all (no reveal, no trigger).
 */
export const WEAKNESS_FLOOR = 1
/** A3-11 / C5: losing a toughness aura never drops current toughness below 1. */
export const AURA_LOSS_CAN_KILL = false
/** A3-10: healing is capped at max toughness. */
export const OVERHEAL = false
/** A3-15: a same-named effect applies once per unit; differently named effects add up. */
export const SAME_NAME_STACKING = false
/** A3-13: sacrifices take own non-commander units only, and count as dying. */
export const SACRIFICE_ENEMIES = false
export const SACRIFICE_COUNTS_AS_DEATH = true
/** A3-14: basic attacks target enemy units only. */
export const FRIENDLY_ATTACKS = false
/** Owner ruling R14 (supersedes C16): Smite and Julio Vernification may target own units (the UI confirms). */
export const FRIENDLY_SINGLE_TARGET = true
/** A2-18 / C28: only attacks with range >= 2 may target a square (blind shots, remote mine detonation). */
export type SquareAttacks = 'rangedOnly' | 'everyAttack'
export const SQUARE_ATTACKS: SquareAttacks = 'rangedOnly'
export const SQUARE_ATTACK_MIN_RANGE = SQUARE_ATTACKS === 'rangedOnly' ? 2 : 1

// ---------------------------------------------------------------- vision and hidden information (section 4)

/** A4-05 / C11: Stealth is disabled if a watcher is visible; otherwise it may fail with its AP spent. */
export const STEALTH_FAIL_MODE: 'disableIfVisibleElseFail' = 'disableIfVisibleElseFail'
/** A4-11 / C12: Mind's Eye (and Ratasius) also reveal enemy mines. */
export const MINDS_EYE_REVEALS_MINES = true
/** Owner ruling R15 (supersedes A4-02 / C22): both players see both AP totals and AP debts. */
export const SHOW_OPPONENT_AP = true
/** A4-12 / C23: attacking from the fog does not reveal the attacker. */
export const ATTACKER_GHOST_MARKER = false
/** A4-16 / C24: last-seen markers are client memory only, never engine state. */
export const LAST_SEEN_MARKERS = true

// ---------------------------------------------------------------- army building and deployment (section 5)

/** A5-02 / A5-14: one lobby value, stored per player. */
export const BUDGET = 200
export const MUST_SPEND_FULL_BUDGET = false
/** A5-12: a commander-only army is legal (the builder warns). */
export const MIN_ARMY_UNITS = 0
/**
 * Owner rulings R2 / R10 (supersede A5-03; R5 keeps balance for later playtests): at most 50 units deployed; the commander and units created in play
 * (dummies, revived or returned units) don't count. Deployability still applies. null = no cap.
 */
export const ARMY_UNIT_CAP: number | null = 50
/** A5-05: zone depth in rows, counted from each side's back row. */
export const NORMAL_ZONE_ROWS = 5
export const EXTENDED_ZONE_ROWS = 2
/** A5-04: units that may also deploy in the extended zone ("Vanguard"). */
export const VANGUARD_UNITS: readonly UnitTypeId[] = ['rogue', 'ranger']
/** Owner ruling R16 (supersedes A5-09 / C21): a commander (and its variant) is public in the lobby once selected. */
export type CommanderReveal = 'lobby' | 'deploymentStart' | 'battleStart'
export const COMMANDER_REVEAL: CommanderReveal = 'lobby'
/** Owner ruling R33 (supersedes A5-08): both army lists are public from the start of deployment. */
export const ARMY_LISTS_PUBLIC = true

// ---------------------------------------------------------------- objectives (section 6)

/** A6-07: captures are checked at the end of every turn ('endOfOwnTurn' = only when the capturer's turn ends). */
export type CaptureTiming = 'endOfEveryTurn' | 'endOfOwnTurn'
export const CAPTURE_TIMING: CaptureTiming = 'endOfEveryTurn'
/** A6-08 / C13: invisible units and dummies capture and contest; mines never count. */
export const STEALTH_CAPTURES = true
export const DUMMIES_CAPTURE = true
/** A6-09: lobby defaults; a disabled building is removed from the scenario. */
export const KEEP_ENABLED = true
export const MARKET_ENABLED = true
/** Owner ruling R31 (supersedes A6-10's +3): the Keep's controller's units get +1 Power (attack damage only, A3-02). */
export const KEEP_POWER_BONUS = 1
/** R31: the Market's controller gets +2 AP at the start of each of its turns (after the cap) and keeps A6-11's action. */
export const MARKET_AP_BONUS = 2
export const MARKET_TIER1_ACTION = true
export const MARKET_EXTRA_ACTIONS = 1
export const MARKET_TIERS: readonly Tier[] = [1]
/** Owner ruling R32: buildings are 3x3, centred on the middle row; the capture ring is the 16 squares around them. */
export const BUILDING_SIZE = 3
/** Owner ruling R30 "Siege": controlling both buildings at the start of 5 consecutive own turns wins (both enabled). */
export const SIEGE_TURNS = 5
/** A6-02: both commanders dying in the same resolution is a draw. */
export const SIMULTANEOUS_COMMANDER_DEATH: 'draw' = 'draw'

// ---------------------------------------------------------------- commanders and factions (section 7)

/** Owner ruling R4 (supersedes A7-05): each faction has its own 7-unit roster; no proxy. R43: armies mix both freely. */
export const LOJRAR_PROXY_ROSTER = false
/** Owner ruling R7 (supersedes A7-06): any commander may lead either faction. true = group A Empire, group B Lojrar. */
export const COMMANDER_FACTION_LOCK = false
/** Owner ruling R8 (supersedes 7.1's 1/1, Movement 1): base commander 1/5, Movement 2, AP 1, LOV 3. */
export const COMMANDER_BASE_TOUGHNESS = 5
export const COMMANDER_MOVEMENT = 2
/** Owner rulings R8 / R23 (Q102 open): Trill's commander toughness 6 and +1 for own tier 1, 2 and 5 units. */
export const TRILL_COMMANDER_TOUGHNESS = 6
export const TRILL_TOUGHNESS_BONUS = 1
/** R8 (Q97 accepted): Queso 6 toughness. R17 (supersedes A7-03's 3): Queso's AP per action is 2. */
export const QUESO_COMMANDER_TOUGHNESS = 6
export const QUESO_AP = 2
/** R24 (supersedes A7-15's 5): Queso's beacon heals 3. */
export const QUESO_BEACON_HEAL = 3
/** R18: a revive costs Queso max toughness by the revived unit's tier (dummies count as other). */
export const QUESO_REVIVE_COST = (tier: Tier | null): number => (tier !== null && tier >= 100 ? 3 : tier !== null && tier >= 50 ? 2 : 1)
/** A7-11: Sabrina's prices and tier change. */
export const SABRINA_ARTIFICER_COST = 10
export const SABRINA_ARTIFICER_TIER: Tier = 10
export const SABRINA_SURCHARGE = 120
export const SABRINA_SURCHARGE_MIN_TIER: Tier = 20
/**
 * Owner ruling R44 (supersedes R6's BABA_WHITE_GRADES = [1] and A7-12): Baba Yaga's "units of white" are the Lojrar
 * Clan units, any tier, in any army that fields them (R43).
 */
export const BABA_WHITE: { readonly faction: FactionId } = { faction: 'lojrar' }
/** R45: Baba Yaga's commander toughness (as Queso and Trill; two of her variants need her near the line). */
export const BABA_COMMANDER_TOUGHNESS = 6
/**
 * Owner ruling R11 (supersedes A7-13; BABA_USES_PER_TURN and BABA_CD_SCOPE are withdrawn): the player picks one
 * variant with Baba Yaga; it is stored in the army (ArmyList.variant, the per-army BABA_VARIANT) and revealed
 * with the commander.
 */
export const BABA_VARIANTS = ['mend', 'hex-ward', 'cauldron'] as const
export type BabaVariant = (typeof BABA_VARIANTS)[number]
/**
 * R11 variant A "Mend the swarm", retuned by R45: 1 AP restores 4 toughness (capped at max); not an action, own turn,
 * no CD; 3 uses per turn army-wide, at most 2 on the same unit per turn.
 */
export const BABA_MEND_COST = 1
export const BABA_MEND_HEAL = 4
export const BABA_MEND_USES_PER_TURN = 3
export const BABA_MEND_MAX_PER_UNIT = 2
/** R11 variant B "Hex Ward" (kept by R45): own white units within range 3 get +1 max and current toughness and take 1 less damage. */
export const BABA_HEX_RANGE = 3
export const BABA_HEX_REDUCTION = 1
export const BABA_HEX_TOUGHNESS = 1
/**
 * R11 variant C "Cauldron": AP per return (owed when it happens on the opponent's turn), 2 per turn, twice per unit.
 * R45: the cost is ceil(tier / 5), minimum 1 (types 1, 2, 5: 1 AP; 10: 2; 20: 4; 50: 10; 100: 20).
 */
export const BABA_CAULDRON_COST = (tier: Tier | null): number => Math.max(1, Math.ceil((tier ?? 1) / 5))
export const BABA_CAULDRON_PER_TURN = 2
export const BABA_CAULDRON_PER_UNIT = 2
export const BABA_CAULDRON_AP_DEBT = true
/** A7-10: Kulega's Fine Print also triggers on enemy deaths; heal capped at 4 per instance. */
export const KULEGA_ENEMY_DEATHS = true
export const KULEGA_HEAL_CAP = 4
/** A7-14: Ratasius' weakness (-4 per instance, range 1, instant damage only) and detection range. */
export const RATASIUS_WEAKNESS = 4
export const RATASIUS_WEAKNESS_RANGE = 1
export const RATASIUS_DETECTION_RANGE = 3
/** A7-15 / A7-16: Queso heals himself; a revive needs his max toughness to stay >= 1 after paying. */
export const QUESO_SELF_HEAL = true
export const QUESO_MIN_MAX_TOUGHNESS = 1
export type QuesoBeaconTiming = 'endOfOwnTurn' | 'startOfOwnTurn'
export const QUESO_BEACON_TIMING: QuesoBeaconTiming = 'endOfOwnTurn'
/** A2-30 / C14 / C29: reaction prompts default to "no" after the timeout (the session runs the clock). */
export const REACTION_PROMPT_TIMEOUT_S = 15
export type PreferenceValue = 'ask' | 'always' | 'never'
export const REVIVE_PREFERENCE: PreferenceValue = 'ask'

// ---------------------------------------------------------------- units and abilities (section 8)

/** A8-02: the attacking Mercenary doesn't count itself. */
export const MERC_COUNTS_SELF = false
/** A8-05 / C15: Savagery may be used any time later in the turn. */
export const SAVAGERY_WINDOW: 'restOfTurn' = 'restOfTurn'
/**
 * A8-09: Shared wounds costs the Priestess's own AP (2); recipient = the Priestess or adjacent. Owner ruling R19
 * (Q106 open): the donor loses half rounded UP, so a donor at 1 dies.
 */
export const SHARED_WOUNDS_COST: 'unit' = 'unit'
export const SHARED_WOUNDS_ROUNDING: 'floor' | 'ceil' = 'ceil'
export const SHARED_WOUNDS_RECIPIENT: 'selfOrAdjacent' = 'selfOrAdjacent'
/** A8-11: Julio Vernification's range is measured from the Juliomancer (Q88). R22: its damage is capped at 15. */
export const JULIO_RANGE_ORIGIN: 'juliomancer' | 'sacrificed' = 'juliomancer'
export const JULIO_DAMAGE_CAP = 15
/** Owner ruling R25 (Q101 open): Smite also deals 3 to each unit on the target's 4 neighbours (friendly fire on). */
export const SMITE_SPLASH = 3
/** R25: while a Scourge of the Gods lives, its owner gets +2 AP at the start of each own turn (after the cap). */
export const SCOURGE_AP_BONUS = 2
/** A8-13: shared dummy cap, n = own Artificers alive. */
export const DUMMY_CAP = (artificersAlive: number): number => 3 + Math.floor(Math.max(0, artificersAlive - 1) / 2)
/** A8-16: shared mine cap, n = own Artificers alive. */
export const MINE_CAP = (artificersAlive: number): number => 5 + Math.max(0, artificersAlive - 1)
/** A8-15 / A8-14: Mad inventor lets a dummy move 1; dummies may act on the turn they are created. */
export const DUMMY_MOVE = 1
export const DUMMY_SUMMONING_SICKNESS = false
/** A8-16: Trip Mine damage, +5 against size >= 2 (TMN-2: one instance per mine). */
export const MINE_DAMAGE = 5
export const MINE_LARGE_BONUS = 5
export const MINE_LARGE_MIN_SIZE = 2
/** A8-18 / C27: any 4 orthogonally connected squares; lasts until the Wizard's next turn starts. */
export type ForcefieldShape = 'connected' | 'square2x2'
export const FORCEFIELD_SHAPE: ForcefieldShape = 'connected'
export const FORCEFIELD_DURATION = DEFAULT_EFFECT_DURATION_OWN_TURNS
/** A8-19: centre up to range 3; lasts 2 of the caster's own turns. */
export const PAJAZON_CENTRE_RANGE = 3
export const PAJAZON_DURATION = 2
/** A8-20: Slam damages own units too (Q66). */
export const SLAM_FRIENDLY_FIRE = true
/** A8-21: Feast heals by the eaten unit's current toughness (Q87). */
export const FEAST_TOUGHNESS: 'current' | 'base' | 'max' = 'current'
/** A8-22: Holy blessing heals the Emissary too. */
export const HOLY_BLESSING_SELF = true
/** A8-24: every Emissary action after its first that turn costs +1 AP. */
export const HOLY_FERVOR_SURCHARGE: 'everyActionAfterFirst' | 'secondActionOnly' = 'everyActionAfterFirst'
/** A8-25: Command Aura range, checked when an action is declared. */
export const COMMAND_AURA_RANGE = 2
/** A8-17: player option (client side): ask before entering a known mine. Options never change a rule (A13-01). */
export const OWN_MINE_WARNING = true
/** Owner ruling R34: moving the commander onto a known mine always asks, even with the warning off (client side). */
export const COMMANDER_MINE_CONFIRMATION = true

// ---------------------------------------------------------------- take-back, timers, presentation

/** A9-04: lobby defaults; null = unlimited take-backs per game. */
export const TAKEBACKS = true
export const TAKEBACK_TIMEOUT_S = 30
export const TAKEBACKS_PER_GAME: number | null = null
/**
 * Owner ruling R29 (Q103 open; supersedes A2-31's "off"): 90 s per turn plus a 60 s bank per player, on by default
 * for online lobbies and off in the sandbox. The session runs the clock (prompts pause it) and ends the turn.
 */
export const TURN_TIMER: number | null = 90
export const TIME_BANK = 60
export const TURN_LIMIT: number | null = null
/** A1-16: presentation default only; the engine never reads it. Art decisions go through the mock page (A13-05). */
export const VIEW_MODE_DEFAULT: 'top' | 'iso' = 'top'
