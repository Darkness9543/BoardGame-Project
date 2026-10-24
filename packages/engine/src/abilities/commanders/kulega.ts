// Kulega "The Fine Printer" (RULES_INTERPRETATION 7.5). Granting Fine Print to own type-20 units is content data
// (content/commanders.ts), so it follows effective tiers.

import { KULEGA_ENEMY_DEATHS, SACRIFICE_COUNTS_AS_DEATH } from '../../constants'
import { abilityParam } from '../../content/abilities'
import type { Tier } from '../../types'
import type { AbilityDefinition } from '../types'

const PRINTER = 'kulega.finePrinter'
const FINE_PRINT = 'kulega.finePrint'
/** A7-10: "When a unit of type 1 or 2 dies". */
const TRIGGER_TIERS: readonly Tier[] = [1, 2]

export const kulegaAbilities: readonly AbilityDefinition[] = [
  {
    id: PRINTER,
    status: 'implemented',
    // A7-09 / KUL-1: every own unit, the commander and dummies included. Vision, Mind's Eye, the Forcefield's "in LOV"
    // squares and the enemy's Stealth check all read the LOV stat, so they widen with it (X-03).
    modifyStats: (_q, holder, target) => (target.owner === holder.owner ? { lov: abilityParam(PRINTER, 'lov') } : null),
  },
  {
    id: FINE_PRINT,
    status: 'implemented',
    // A7-10: a type-1 or type-2 unit of either side (KULEGA_ENEMY_DEATHS, KUL-2) dies adjacent to this unit, on either
    // player's turn; sacrifices count (KUL-4, X-08). Adjacency is judged on the squares it died on (KUL-6). Each death heals
    // each adjacent holder once (KUL-5) by min(cap, the dead unit's base toughness) (KUL-3), capped at the holder's max.
    // Dummies and commanders have no tier, so they never trigger it (KUL-7).
    onUnitDied: (ctx, holder, death) => {
      if (death.tier === null || !TRIGGER_TIERS.includes(death.tier)) return
      if (!KULEGA_ENEMY_DEATHS && death.unit.owner !== holder.owner) return
      if (death.cause === 'sacrifice' && !SACRIFICE_COUNTS_AS_DEATH) return
      if (!death.footprint.some((s) => ctx.isAdjacent(holder, s))) return
      ctx.heal(holder, Math.min(abilityParam(FINE_PRINT, 'cap'), death.baseToughness), FINE_PRINT)
    },
  },
]
