// Attack legality (2.6), shared by the Attack action and abilities that make attacks (Savagery).

import type { AttackTarget } from './abilities/types'
import { FRIENDLY_ATTACKS, SQUARE_ATTACK_MIN_RANGE } from './constants'
import type { RulesQuery } from './query'
import { reject, type Rejection } from './rejection'
import type { Square, UnitCore } from './types'

/**
 * A2-18 / A2-19 / A3-14: a visible enemy unit within attack range, or (range >= 2 only) any existing open
 * square in range that holds no own unit. Judged on what `q` knows; `from` measures range from another anchor
 * (the end square of a Charge, R26).
 */
export function checkAttackTarget(q: RulesQuery, attacker: UnitCore, target: AttackTarget, from?: Square): Rejection | null {
  if (attacker.anchor === null) return reject('NOT_DEPLOYED', 'This unit is not on the board')
  const origin: UnitCore = from === undefined ? attacker : { ...attacker, anchor: from }
  const stats = q.stats(attacker)
  if (stats.power < 1) return reject('NO_POWER', 'A unit with 0 Power cannot attack')
  switch (target.kind) {
    case 'unit': {
      const victim = q.unit(target.unitId)
      if (victim === undefined || victim.anchor === null) return reject('INVALID_TARGET', 'No visible unit there')
      if (victim.owner === attacker.owner && !FRIENDLY_ATTACKS) return reject('INVALID_TARGET', 'Attacks target enemy units only')
      if (q.distance(origin, victim) > stats.attackRange) return reject('OUT_OF_RANGE', 'Target is out of range')
      return null
    }
    case 'square': {
      if (stats.attackRange < SQUARE_ATTACK_MIN_RANGE) return reject('INVALID_TARGET', 'Only ranged attacks can target a square')
      if (!q.squareExists(target.square) || q.isTerrain(target.square)) return reject('INVALID_TARGET', 'That square cannot be targeted')
      if (q.distance(origin, target.square) > stats.attackRange) return reject('OUT_OF_RANGE', 'Square is out of range')
      if (q.unitAt(target.square)?.owner === attacker.owner) return reject('INVALID_TARGET', 'One of your units is there')
      return null
    }
  }
}
