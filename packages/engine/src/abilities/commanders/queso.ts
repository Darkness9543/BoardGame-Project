// Queso "The Beacon of Hope" (RULES_INTERPRETATION 7.9; owner rulings R8, R17, R18, R24). His 1/6 (R8, Q97) and his AP
// 2 per action (R17) are content data.

import {
  QUESO_BEACON_TIMING,
  QUESO_MIN_MAX_TOUGHNESS,
  QUESO_REVIVE_COST,
  QUESO_SELF_HEAL,
  SACRIFICE_COUNTS_AS_DEATH,
} from '../../constants'
import { abilityParam } from '../../content/abilities'
import { unitDef } from '../../content/units'
import { footprintDistance, footprintSquares, manhattan } from '../../geometry'
import type { RulesQuery } from '../../query'
import type { Square, UnitCore } from '../../types'
import type { AbilityDefinition, ResolveContext, TickHeal } from '../types'
import { isFreeForReturn } from './returnSquares'

const BEACON = 'queso.beacon'
const REVIVE = 'queso.revive'

/** A7-15 / R24 / QUE-2 / QUE-3: own units within range 2 of Queso heal 3, Queso himself while QUESO_SELF_HEAL. */
function beaconHeals(q: RulesQuery, queso: UnitCore): TickHeal[] {
  const range = abilityParam(BEACON, 'range')
  const amount = abilityParam(BEACON, 'heal')
  return q
    .units()
    .filter((u) => u.owner === queso.owner && (u.id === queso.id ? QUESO_SELF_HEAL : q.distance(queso, u) <= range))
    .map((u) => ({ target: u.id, amount }))
}

/**
 * QUE-7 / A7-16: the squares the unit died on; if something filled them first, the free anchor nearest to them whose
 * footprint is within range 2 of Queso. The rules let the controller choose among equally near squares; the engine
 * takes the lowest row, then the lowest column, so the answer needs no second prompt.
 */
function reviveAnchor(ctx: ResolveContext, queso: UnitCore, unit: UnitCore): Square | null {
  const died = unit.anchor
  if (died === null || queso.anchor === null) return null
  const size = ctx.sizeOf(unit)
  const fits = (anchor: Square): boolean => footprintSquares(anchor, size).every((s) => isFreeForReturn(ctx, unit.owner, s))
  if (fits(died)) return died
  const range = abilityParam(REVIVE, 'range')
  const quesoSize = ctx.sizeOf(queso)
  const candidates: Square[] = []
  for (let y = queso.anchor.y - range - size + 1; y <= queso.anchor.y + quesoSize - 1 + range; y++) {
    for (let x = queso.anchor.x - range - size + 1; x <= queso.anchor.x + quesoSize - 1 + range; x++) {
      const anchor = { x, y }
      if (footprintDistance(anchor, size, queso.anchor, quesoSize) <= range && fits(anchor)) candidates.push(anchor)
    }
  }
  candidates.sort((a, b) => manhattan(a, died) - manhattan(b, died) || a.y - b.y || a.x - b.x)
  return candidates[0] ?? null
}

/** QUE-5 / R18: a revive is possible only while paying leaves Queso's (permanent) max toughness at 1 or more. */
function canPay(q: RulesQuery, queso: UnitCore, cost: number): boolean {
  return q.stats(queso).baseToughness - cost >= QUESO_MIN_MAX_TOUGHNESS
}

export const quesoAbilities: readonly AbilityDefinition[] = [
  {
    id: BEACON,
    status: 'implemented',
    // A7-15 / QUESO_BEACON_TIMING: "each player turn (not the opponent's turn)": the end of Queso's own turn by default,
    // in 2.10 step 3 with the other heals (X-25: all capped, order irrelevant); the start of his turn is Q89's alternative.
    endOfOwnTurn: (q, holder) => (QUESO_BEACON_TIMING === 'endOfOwnTurn' ? { heal: beaconHeals(q, holder) } : null),
    startOfOwnTurn: (ctx, holder) => {
      if (QUESO_BEACON_TIMING !== 'startOfOwnTurn') return
      for (const h of beaconHeals(ctx, holder)) {
        const target = ctx.unit(h.target)
        if (target !== undefined) ctx.heal(target, h.amount, BEACON)
      }
    },
  },
  {
    id: REVIVE,
    status: 'implemented',
    // A7-16 / R18 / C14: an own non-commander unit dies within range 2 of Queso, on either player's turn, sacrifices
    // included (QUE-8, X-07); the area is judged at the moment of death (QUE-10). Its controller is asked (A2-30: 15 s,
    // then "no"; the 'revive' preference answers at once, X-26 in the end phase). Enemy units are never revived (QUE-2).
    // Each death Queso can pay for on its own is offered, even when several queue up that he can't all pay for: the
    // units differ in value, so the player chooses which to bring back, and a later "yes" he can no longer afford fails.
    onUnitDied: (ctx, holder, death) => {
      if (death.unit.owner !== holder.owner || death.isCommander) return // A7-04
      if (death.cause === 'sacrifice' && !SACRIFICE_COUNTS_AS_DEATH) return
      const range = abilityParam(REVIVE, 'range')
      if (!death.footprint.some((s) => ctx.distance(holder, s) <= range)) return
      const cost = QUESO_REVIVE_COST(death.tier)
      if (!canPay(ctx, holder, cost)) return
      const toughness = Math.ceil(death.baseToughness / 2) // L130: "half of its base toughness rounded up"
      ctx.requestDecision({
        abilityId: REVIVE,
        holder,
        seat: holder.owner,
        kind: REVIVE,
        prompt: `Your ${unitDef(death.unit.type).name} died near Queso. Revive it with ${toughness} toughness for ${cost} of Queso's max toughness?`,
        options: [
          { id: 'yes', label: 'Revive' },
          { id: 'no', label: 'Let it fall' },
        ],
        defaultOption: 'no',
        alwaysOption: 'yes',
        preferenceKey: 'revive',
        subject: death.unit,
        data: { unitId: death.unit.id, toughness, cost },
      })
    },
    // R18: Queso's max toughness drops by the cost for good (A3-11: current is clamped); the unit returns as the same
    // instance with its statuses cleared, keeping its cooldowns and actions used (QUE-6). Everything is checked again,
    // since an earlier answer in the same queue may have spent the toughness or taken the squares.
    onDecision: (ctx, holder, decision, choice) => {
      const unitId = decision.data['unitId']
      const toughness = decision.data['toughness']
      const cost = decision.data['cost']
      if (choice !== 'yes' || holder === null || typeof unitId !== 'string' || typeof toughness !== 'number' || typeof cost !== 'number') return
      const fallen = ctx.fallenUnit(unitId)
      if (fallen === undefined) return
      const anchor = canPay(ctx, holder, cost) ? reviveAnchor(ctx, holder, fallen) : null
      if (anchor === null) {
        ctx.emit({ type: 'abilityNote', unitId: holder.id, abilityId: REVIVE, note: 'The revive failed: Queso can no longer pay for it, or there is no free square' }, [holder.owner])
        return
      }
      ctx.changePermanentToughness(holder, -cost)
      ctx.revive(unitId, toughness, anchor)
    },
  },
]
