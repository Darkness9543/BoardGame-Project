// Match statistics and the end-of-game summary (owner rulings R38, R39). The resolver records every damage
// instance and death as it happens; the summary is emitted with gameEnded so the session can log the match.

import type { ArmyList, CommanderId, GameResultReason, GameState, MatchStats, ScenarioId, Seat, UnitTypeId, UnitTypeTally } from './types'

export interface MatchSummary {
  /** null = draw. */
  readonly winner: Seat | null
  /** The win condition (conquest, domination, siege, ...). */
  readonly reason: GameResultReason
  readonly turns: number
  readonly rounds: number
  readonly southSeat: Seat | null
  readonly scenarioId: ScenarioId
  /** Both army lists: units, commander and variant. */
  readonly armies: Readonly<Record<Seat, ArmyList | null>>
  /** The same commanders and variants as in `armies`, named as in PlayerView. */
  readonly commanders: Readonly<Record<Seat, CommanderId | null>>
  readonly commanderVariants: Readonly<Record<Seat, string | null>>
  readonly unitTypes: Readonly<MatchStats>
}

function tallyOf(stats: MatchStats, seat: Seat, type: UnitTypeId): UnitTypeTally {
  const existing = stats[seat][type]
  if (existing !== undefined) return existing
  const fresh: UnitTypeTally = { damageDealt: 0, damageTaken: 0, kills: 0, losses: 0 }
  stats[seat][type] = fresh
  return fresh
}

/** The unit (and seat) credited with a damage instance; null for damage nobody is credited with. */
export interface DamageCredit {
  readonly seat: Seat
  readonly type: UnitTypeId
}

/** R39: one damage instance; `amount` is the toughness actually removed. */
export function recordDamage(
  stats: MatchStats,
  credit: DamageCredit | null,
  target: { readonly owner: Seat; readonly type: UnitTypeId },
  amount: number,
  killed: boolean,
): void {
  if (amount <= 0) return
  tallyOf(stats, target.owner, target.type).damageTaken += amount
  if (credit === null || credit.seat === target.owner) return
  const dealer = tallyOf(stats, credit.seat, credit.type)
  dealer.damageDealt += amount
  if (killed) dealer.kills += 1
}

export function recordLoss(stats: MatchStats, unit: { readonly owner: Seat; readonly type: UnitTypeId }): void {
  tallyOf(stats, unit.owner, unit.type).losses += 1
}

/** R38: the finished match as data (null while it is still running). */
export function matchSummary(state: GameState): MatchSummary | null {
  const result = state.result
  if (result === null) return null
  return {
    winner: result.winner,
    reason: result.reason,
    turns: result.turnNumber,
    rounds: Math.ceil(result.turnNumber / 2),
    southSeat: state.southSeat,
    scenarioId: state.settings.scenarioId,
    armies: { host: state.seats.host.army, guest: state.seats.guest.army },
    commanders: { host: state.seats.host.army?.commander ?? null, guest: state.seats.guest.army?.commander ?? null },
    commanderVariants: { host: state.seats.host.army?.variant ?? null, guest: state.seats.guest.army?.variant ?? null },
    unitTypes: JSON.parse(JSON.stringify(state.matchStats)) as MatchStats,
  }
}
