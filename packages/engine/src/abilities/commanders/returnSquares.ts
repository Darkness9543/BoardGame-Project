// Where a unit brought back by a commander effect may stand: Queso's revive (A7-16) and Baba Yaga's Cauldron (R11).

import type { Seat, Square } from '../../types'
import type { ResolveContext } from '../types'

/**
 * Open ground with no unit and no mine the owner knows about (its own, or a revealed enemy mine it can see). An
 * unseen enemy mine is not excluded, since that would leak it (A4-14); the core sets it off on the returning unit.
 */
export function isFreeForReturn(ctx: ResolveContext, owner: Seat, square: Square): boolean {
  if (!ctx.squareExists(square) || ctx.isTerrain(square) || ctx.unitAt(square) !== undefined) return false
  const mine = ctx.mineAt(square)
  if (mine === undefined) return true
  return mine.owner !== owner && !(mine.revealed && ctx.seesSquare(owner, square))
}
