// Every resolved event the engine emits. Each GameEvent carries `visibleTo`, decided at emit time from
// both seats' vision (4.8). view.filterEvents(events, seat) keeps a seat's events and strips the audience.
// Where seats may learn different things (an unseen attacker, part of an area), the engine emits one
// variant per audience instead of redacting later. Achievements read this per-seat stream (A13-03).

import type {
  AbilityTarget,
  AttackTarget,
  DamageKind,
  DamageStep,
  RevealCause,
} from './abilities/types'
import type { PreferenceValue } from './constants'
import type { MatchSummary } from './summary'
import type {
  AbilityId,
  AreaId,
  BuildingKind,
  CommanderId,
  DeathCause,
  DecisionId,
  GameResult,
  MatchSettings,
  MineId,
  Seat,
  Square,
  UnitId,
  UnitTypeId,
} from './types'

export type MoveEndReason = 'completed' | 'blocked' | 'mine' | 'reaction' | 'died'

export type EventBody =
  // ---- lobby and setup (2.1)
  | { readonly type: 'settingsChanged'; readonly settings: MatchSettings }
  /** The opponent's variant carries the commander only once it is public (R16: in the lobby). */
  | { readonly type: 'armyChosen'; readonly seat: Seat; readonly commander: CommanderId | null; readonly variant: string | null }
  | { readonly type: 'readyChanged'; readonly seat: Seat; readonly ready: boolean }
  | { readonly type: 'coinFlipped'; readonly southSeat: Seat }
  | { readonly type: 'deploymentStarted'; readonly commanders: Readonly<Record<Seat, CommanderId>> }
  | { readonly type: 'unitPlaced'; readonly unitId: UnitId; readonly anchor: Square }
  | { readonly type: 'unitUnplaced'; readonly unitId: UnitId }
  | { readonly type: 'deploymentConfirmed'; readonly seat: Seat; readonly confirmed: boolean }
  | { readonly type: 'battleStarted'; readonly southSeat: Seat }
  // ---- turns (2.10)
  | { readonly type: 'turnStarted'; readonly seat: Seat; readonly turnNumber: number; readonly round: number }
  /** Both seats under R15 (SHOW_OPPONENT_AP); otherwise own seat only (A4-02). */
  | { readonly type: 'apChanged'; readonly seat: Seat; readonly ap: number; readonly delta: number }
  | { readonly type: 'turnEnded'; readonly seat: Seat }
  // ---- actions
  /** One per movement step; the opponent gets the steps where the unit is visible at either end. */
  | { readonly type: 'unitMoved'; readonly unitId: UnitId; readonly from: Square; readonly to: Square }
  | { readonly type: 'moveEnded'; readonly unitId: UnitId; readonly at: Square; readonly reason: MoveEndReason }
  | { readonly type: 'defendChanged'; readonly unitId: UnitId; readonly defending: boolean; readonly reason: 'action' | 'expired' | 'acted' }
  | { readonly type: 'unitAttacked'; readonly attackerId: UnitId; readonly target: AttackTarget; readonly source: string }
  /** A blind shot at a square with nothing on it ("Nothing there", 2.6); attacker's seat only. */
  | { readonly type: 'attackMissed'; readonly attackerId: UnitId; readonly square: Square }
  | { readonly type: 'abilityUsed'; readonly unitId: UnitId; readonly abilityId: AbilityId; readonly targets: readonly AbilityTarget[] }
  /** Free-form ability feedback ("Spotted: an unseen enemy can see this square"). */
  | { readonly type: 'abilityNote'; readonly unitId: UnitId | null; readonly abilityId: AbilityId; readonly note: string }
  // ---- toughness (3.3-3.9)
  | {
      readonly type: 'unitDamaged'
      readonly unitId: UnitId
      readonly amount: number
      readonly toughness: number
      readonly kind: DamageKind
      readonly source: string
      /** null when there is no dealer, or for a seat that can't see the dealer (A4-12). */
      readonly dealerId: UnitId | null
      readonly breakdown: readonly DamageStep[]
    }
  | { readonly type: 'unitHealed'; readonly unitId: UnitId; readonly amount: number; readonly toughness: number; readonly source: string }
  /** Non-damage loss (A3-08): Shared wounds donor, aura loss. */
  | { readonly type: 'toughnessLost'; readonly unitId: UnitId; readonly amount: number; readonly toughness: number; readonly source: string }
  | { readonly type: 'maxToughnessChanged'; readonly unitId: UnitId; readonly delta: number; readonly toughness: number; readonly source: string }
  | {
      readonly type: 'unitDied'
      readonly unitId: UnitId
      readonly unitType: UnitTypeId
      readonly owner: Seat
      readonly at: Square
      readonly cause: DeathCause
    }
  | { readonly type: 'unitRevived'; readonly unitId: UnitId; readonly anchor: Square; readonly toughness: number }
  | {
      readonly type: 'unitCreated'
      readonly unitId: UnitId
      readonly unitType: UnitTypeId
      readonly owner: Seat
      readonly anchor: Square
      readonly createdBy: UnitId | null
    }
  // ---- hidden information (section 4)
  /** Owner only. */
  | { readonly type: 'stealthChanged'; readonly unitId: UnitId; readonly stealthed: boolean }
  /** The owner always; `byId` only if the owner can see the revealer (A4-10). */
  | { readonly type: 'unitRevealed'; readonly unitId: UnitId; readonly cause: RevealCause; readonly byId: UnitId | null }
  | { readonly type: 'minePlaced'; readonly mineId: MineId; readonly owner: Seat; readonly square: Square }
  | { readonly type: 'mineRevealed'; readonly mineId: MineId; readonly owner: Seat; readonly square: Square }
  | {
      readonly type: 'mineExploded'
      readonly mineId: MineId
      readonly owner: Seat
      readonly square: Square
      readonly victimId: UnitId | null
      readonly trigger: 'entered' | 'shot'
    }
  /** The opponent's variant lists only the squares inside its vision (A4-13). */
  | {
      readonly type: 'areaCreated'
      readonly areaId: AreaId
      readonly abilityId: AbilityId
      readonly owner: Seat
      readonly squares: readonly Square[]
      readonly expiresAtOwnTurn: number
    }
  | { readonly type: 'areaExpired'; readonly areaId: AreaId }
  // ---- objectives (6.4), public
  | { readonly type: 'buildingCaptured'; readonly building: BuildingKind; readonly seat: Seat; readonly previous: Seat | null }
  | { readonly type: 'buildingHeld'; readonly building: BuildingKind; readonly seat: Seat }
  | { readonly type: 'buildingContested'; readonly building: BuildingKind }
  // ---- reactions, take-backs, draws (2.11, 9, 2.12)
  | { readonly type: 'decisionRequested'; readonly decisionId: DecisionId; readonly seat: Seat; readonly kind: string }
  | { readonly type: 'decisionResolved'; readonly decisionId: DecisionId; readonly seat: Seat; readonly choice: string; readonly automatic: boolean }
  | { readonly type: 'takebackRequested'; readonly seat: Seat; readonly actionSeq: number }
  | { readonly type: 'takebackDeclined'; readonly seat: Seat; readonly actionSeq: number }
  | { readonly type: 'takebackApplied'; readonly seat: Seat; readonly actionSeq: number }
  | { readonly type: 'drawOffered'; readonly seat: Seat }
  | { readonly type: 'drawDeclined'; readonly seat: Seat }
  | { readonly type: 'preferenceChanged'; readonly seat: Seat; readonly key: string; readonly value: PreferenceValue }
  | { readonly type: 'gameEnded'; readonly result: GameResult }
  /** R38 / R39: right after gameEnded, to both seats (the fog has lifted): the match as data for the local log. */
  | { readonly type: 'matchSummary'; readonly summary: MatchSummary }

export type EventType = EventBody['type']

/** As stored by the authority. */
export type GameEvent = EventBody & { readonly visibleTo: readonly Seat[] }

/** As delivered to one seat (audience stripped). */
export type VisibleEvent = EventBody
