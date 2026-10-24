// Artificer (RULES_INTERPRETATION 8.10). The dummy (8.15) and the mine (8.16) are core objects: resolve.ts creates
// them, sets a mine off when any unit enters its square or a ranged attack targets it, and hides it from the
// opponent until detection reveals it. This file decides where they may go and how many may exist. Sabrina's
// Artificers lose Trip Mine through content data (A7-11).

import { abilityParam } from '../../content/abilities'
import { DUMMY_CAP, DUMMY_SUMMONING_SICKNESS, MINE_CAP } from '../../constants'
import { adjacencyMetric } from '../../geometry'
import type { RulesQuery } from '../../query'
import type { Seat, Square, UnitTypeId } from '../../types'
import type { AbilityDefinition, AbilityTarget, TargetSpec } from '../types'

const MINDS_EYE = 'artificer.mindsEye'
const PROTOTYPE = 'artificer.prototypeNoAcb'
const MAD_INVENTOR = 'artificer.madInventor'
const TRIP_MINE = 'artificer.tripMine'

const MAD_POWER = abilityParam(MAD_INVENTOR, 'power')
const MAD_MOVEMENT = abilityParam(MAD_INVENTOR, 'movement')

/**
 * A8-13: exists, open ground, no known unit, no own mine. Knowing is enough: a hidden unit on an adjacent square
 * is always revealed (R1), and Mind's Eye reveals any enemy mine there (ART-8).
 */
const FREE_ADJACENT_SQUARE: TargetSpec = { kind: 'square', label: 'Free adjacent square', minRange: 1, range: 1, metric: adjacencyMetric(), free: true }

/** ART-2 / ART-3: the caps are shared by the whole army and count what is alive now (n = own Artificers alive). */
function countOwn(q: RulesQuery, owner: Seat, type: UnitTypeId): number {
  return q.units().filter((u) => u.owner === owner && u.type === type).length
}

/** The action-bar reason at the cap (PX BT-06). Above a lowered cap nothing is destroyed (ART-2), so count > cap is possible. */
function capReason(count: number, cap: number, things: string): string | null {
  return count < cap ? null : `Max ${cap} ${things} active (${count}/${cap})`
}

function squareOf(targets: readonly AbilityTarget[]): Square | null {
  const target = targets[0]
  return target?.kind === 'square' ? target.square : null
}

export const artificerAbilities: readonly AbilityDefinition[] = [
  {
    id: MINDS_EYE,
    status: 'implemented',
    // A8-10 / A4-08 / A4-11 (MINDS_EYE_REVEALS_MINES): enemy stealthed units and enemy mines inside its LOV are
    // revealed; the core re-checks after every step, placement and creation, on both players' turns.
    detection: () => ({ kind: 'lov' }),
  },
  {
    id: PROTOTYPE,
    status: 'implemented',
    active: {
      targets: [FREE_ADJACENT_SQUARE],
      // A8-13 / ART-1..4: 3 + floor((n - 1) / 2) dummies at a time, created or not by this Artificer.
      requirement: (q, unit) => capReason(countOwn(q, unit.owner, 'noAcb'), DUMMY_CAP(countOwn(q, unit.owner, 'artificer')), 'dummies'),
      resolve: (ctx, unit, targets) => {
        const square = squareOf(targets)
        if (square === null) return
        // A8-14: a 0/7 dummy (content data); created on a mine, it sets it off (A8-16, ART-8).
        const dummy = ctx.createUnit('noAcb', unit.owner, square, unit)
        if (dummy !== null && DUMMY_SUMMONING_SICKNESS) ctx.exhaust(dummy) // A8-14 / ART-5: off, so it may act at once
      },
    },
  },
  {
    id: MAD_INVENTOR,
    status: 'implemented',
    // A8-15 / ART-6 / ART-7: an own dummy adjacent to an own Artificer may Move 1 and has +1 Power; two adjacent
    // Artificers still give +1 (A3-15). Stats are read when an action is declared, so a dummy may walk away from
    // every Artificer and then can't move again; the Power counts when its attack resolves.
    modifyStats: (q, holder, target) =>
      target.type === 'noAcb' && target.owner === holder.owner && q.isAdjacent(holder, target) ? { power: MAD_POWER, movement: MAD_MOVEMENT } : null,
  },
  {
    id: TRIP_MINE,
    status: 'implemented',
    active: {
      targets: [FREE_ADJACENT_SQUARE],
      secret: true, // 4.8: the opponent is told nothing about a mine placement
      // A8-16 / ART-1..4: 5 + (n - 1) mines at a time, and one mine per square.
      requirement: (q, unit) =>
        capReason(q.mines().filter((m) => m.owner === unit.owner).length, MINE_CAP(countOwn(q, unit.owner, 'artificer')), 'mines'),
      validate: (q, _unit, targets) => {
        const square = squareOf(targets)
        return square !== null && q.mineAt(square) !== undefined ? 'That square already holds a mine' : null
      },
      resolve: (ctx, unit, targets) => {
        const square = squareOf(targets)
        if (square === null) return
        // ART-8 / 4.7: onto an enemy mine the player didn't know of, nothing is placed and that mine is revealed;
        // the AP and the action stay spent.
        if (ctx.placeMine(unit.owner, square, unit) === 'blockedByHiddenMine') {
          ctx.emit({ type: 'abilityNote', unitId: unit.id, abilityId: TRIP_MINE, note: 'An enemy mine is already there' }, [unit.owner])
        }
      },
    },
  },
]
