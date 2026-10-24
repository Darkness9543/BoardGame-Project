// Baba Yaga "The Bwitch" (owner ruling R11 replaces RULES_INTERPRETATION 7.7; R44 and R45 retune it). The army picks
// one variant (ArmyList.variant: 'mend' | 'hex-ward' | 'cauldron', checked by checkArmy) and content/commanders.ts
// maps each variant to the abilities below. "Units of white" are the Lojrar Clan units of any tier (R44, BABA_WHITE,
// content/derived isBabaWhite). Her 1/6, Mv 2, AP 1, LOV 3 (R8, R45) are content data.

import { ADJACENCY, BABA_CAULDRON_AP_DEBT, BABA_CAULDRON_COST, SACRIFICE_COUNTS_AS_DEATH } from '../../constants'
import { abilityParam } from '../../content/abilities'
import { isBabaWhite } from '../../content/derived'
import { unitDef } from '../../content/units'
import { adjacencyMetric, backRowY, footprintDistance, footprintSquares, parseSquare, sameSquare, squareName } from '../../geometry'
import type { StatsQuery } from '../../query'
import type { Square, UnitCore } from '../../types'
import type { AbilityDefinition, ResolveContext } from '../types'
import { isFreeForReturn } from './returnSquares'

const MEND = 'babaYaga.mend'
const HEX = 'babaYaga.hexWard'
const CAULDRON = 'babaYaga.cauldron'
/** Every-turn seat counter of the returns made this turn; also the per-unit memory key of the returns made this game. */
const RETURNS = 'babaYaga.cauldron'
/** Every-turn seat counters of the prompts still awaiting an answer, and of the AP they would cost. */
const PENDING = 'babaYaga.cauldron.pending'
const PENDING_AP = 'babaYaga.cauldron.pendingAp'
const NO = 'no'

/** R11 B / R44: an own Lojrar Clan unit within Manhattan range 3 of Baba Yaga. */
function hexed(q: StatsQuery, baba: UnitCore, unit: UnitCore): boolean {
  return unit.owner === baba.owner && unit.id !== baba.id && isBabaWhite(unit.type) && q.distance(baba, unit) <= abilityParam(HEX, 'range')
}

/**
 * R11 C: anchors next to Baba Yaga (adjacency distance 1) where the returning unit's whole footprint is free (a Beast
 * needs a free 2x2, R44), nearest her own back row first; the 'always' preference takes the first.
 */
function returnAnchors(ctx: ResolveContext, baba: UnitCore, size: 1 | 2): Square[] {
  const side = ctx.sideOf(baba.owner)
  if (baba.anchor === null || side === null) return []
  const back = backRowY(side)
  const babaSize = ctx.sizeOf(baba)
  const metric = adjacencyMetric(ADJACENCY)
  const anchors: Square[] = []
  for (let y = baba.anchor.y - size; y <= baba.anchor.y + babaSize; y++) {
    for (let x = baba.anchor.x - size; x <= baba.anchor.x + babaSize; x++) {
      const anchor = { x, y }
      if (footprintDistance(anchor, size, baba.anchor, babaSize, metric) !== 1) continue
      if (footprintSquares(anchor, size).every((s) => isFreeForReturn(ctx, baba.owner, s))) anchors.push(anchor)
    }
  }
  const rowGap = (anchor: Square): number => Math.min(...footprintSquares(anchor, size).map((s) => Math.abs(s.y - back)))
  return anchors.sort((a, b) => rowGap(a) - rowGap(b) || a.x - b.x)
}

/** Option ids name no square: the opponent may learn the answer (decisionResolved) but not where Baba Yaga stands. */
const optionId = (index: number): string => `return-${index}`

/** The anchor an answer picked or, if an earlier answer in the same queue took it, the first one still free. */
function chosenAnchor(ctx: ResolveContext, baba: UnitCore, size: 1 | 2, offered: readonly string[], choice: string): Square | null {
  const free = returnAnchors(ctx, baba, size)
  const picked = offered.find((_, i) => optionId(i) === choice)
  const square = picked === undefined ? null : parseSquare(picked)
  return free.find((a) => square !== null && sameSquare(a, square)) ?? free[0] ?? null
}

export const babaYagaAbilities: readonly AbilityDefinition[] = [
  {
    id: MEND,
    status: 'implemented',
    // R11 A "Mend the swarm", granted to own Lojrar Clan units (R44, content grant). Content data (R45): 1 AP restores
    // 4 toughness, not an action (so it never cancels Defend, A2-11), no cooldown, at most 2 uses on one unit per turn
    // (usesPerTurn, checked by the core). Own turn only: the core takes useAbility from the active seat alone. At most 3
    // uses per turn across the army: a seat counter reset at the owner's turn start.
    active: {
      targets: [],
      requirement: (q, unit) => {
        const perTurn = abilityParam(MEND, 'perTurn')
        if (q.seatCounter(unit.owner, MEND) >= perTurn) return `Regenerate was already used ${perTurn} times this turn`
        return unit.toughness >= q.stats(unit).maxToughness ? 'This unit is already at full toughness' : null
      },
      resolve: (ctx, unit) => {
        ctx.heal(unit, abilityParam(MEND, 'heal'), MEND) // R45: capped at max (A3-10)
        ctx.setSeatCounter(unit.owner, MEND, ctx.seatCounter(unit.owner, MEND) + 1)
      },
    },
  },
  {
    id: HEX,
    status: 'implemented',
    // R11 B "Hex Ward" (unchanged by R45), carried by Baba Yaga: own Lojrar Clan units within range 3 (R44) get +1 max
    // toughness as an aura (the core moves current with it, and losing it never kills, A3-11) and take 1 less damage
    // from every source, a target-side reduction added to any others with the usual floor of 1 (A3-05). No AP, no action.
    modifyStats: (q, holder, target) => (hexed(q, holder, target) ? { maxToughness: abilityParam(HEX, 'toughness') } : null),
    targetReduction: (q, holder, hit) => (hexed(q, holder, hit.target) ? abilityParam(HEX, 'reduction') : 0),
  },
  {
    id: CAULDRON,
    status: 'implemented',
    // R11 C "Cauldron", carried by Baba Yaga: when an own Lojrar Clan unit dies (R44; any cause, sacrifices included)
    // its owner may return it at once, through the reaction prompt (A2-30: 15 s, then "no"), for ceil(tier / 5) AP,
    // minimum 1 (R45). The death stands and fires every other death trigger (Kulega's Fine Print). Limits: 2 returns per
    // turn, each turn (either player's) counting on its own, and 2 per unit per game. Prompts still awaiting an answer
    // count against the limit and the AP, so a queue of them never offers more than can be paid for.
    onUnitDied: (ctx, holder, death) => {
      const owner = holder.owner
      if (death.unit.owner !== owner || !isBabaWhite(death.unit.type)) return
      if (death.cause === 'sacrifice' && !SACRIFICE_COUNTS_AS_DEATH) return
      const ownTurn = ctx.activeSeat === owner
      if (!ownTurn && !BABA_CAULDRON_AP_DEBT) return // without the debt there is no AP to pay with on the opponent's turn
      const cost = BABA_CAULDRON_COST(death.tier)
      const pending = ctx.turnCounter(owner, PENDING)
      const pendingAp = ctx.turnCounter(owner, PENDING_AP)
      if (ctx.turnCounter(owner, RETURNS) + pending >= abilityParam(CAULDRON, 'perTurn')) return
      if (ctx.memory(death.unit, RETURNS) >= abilityParam(CAULDRON, 'perUnit')) return
      if (ownTurn && (ctx.ap(owner) ?? 0) < pendingAp + cost) return
      const anchors = returnAnchors(ctx, holder, ctx.sizeOf(death.unit))
      if (anchors.length === 0) return // R11: no free adjacent square, no return
      ctx.setTurnCounter(owner, PENDING, pending + 1)
      ctx.setTurnCounter(owner, PENDING_AP, pendingAp + cost)
      const paid = ownTurn ? `${cost} AP` : `${cost} AP, taken from your next turn`
      ctx.requestDecision({
        abilityId: CAULDRON,
        holder,
        seat: owner,
        kind: CAULDRON,
        prompt: `Your ${unitDef(death.unit.type).name} died. Return it next to Baba Yaga at full toughness for ${paid}?`,
        options: [...anchors.map((s, i) => ({ id: optionId(i), label: `Return to ${squareName(s)}` })), { id: NO, label: 'Let it fall' }],
        defaultOption: NO,
        alwaysOption: optionId(0),
        preferenceKey: 'revive',
        subject: death.unit,
        data: { unitId: death.unit.id, toughness: death.baseToughness, cost, squares: anchors.map(squareName).join(',') },
      })
    },
    // R45: the AP is paid now on the owner's turn or owed from its next pool (AP debt, BABA_CAULDRON_AP_DEBT); the same
    // unit returns at full base toughness with its statuses cleared and its actions for this turn used. The footprint is
    // checked before anything is paid, so a failed return costs nothing; the counters move before the return, so a
    // return onto an unseen mine that kills it again sees them.
    onDecision: (ctx, holder, decision, choice) => {
      const owner = decision.seat
      const unitId = decision.data['unitId']
      const toughness = decision.data['toughness']
      const cost = decision.data['cost']
      const offered = decision.data['squares']
      ctx.setTurnCounter(owner, PENDING, Math.max(0, ctx.turnCounter(owner, PENDING) - 1))
      if (typeof cost === 'number') ctx.setTurnCounter(owner, PENDING_AP, Math.max(0, ctx.turnCounter(owner, PENDING_AP) - cost))
      const fallen = typeof unitId === 'string' ? ctx.fallenUnit(unitId) : undefined
      if (choice === NO || holder === null || fallen === undefined || typeof toughness !== 'number' || typeof cost !== 'number') return
      const anchor = chosenAnchor(ctx, holder, ctx.sizeOf(fallen), typeof offered === 'string' ? offered.split(',') : [], choice)
      if (anchor === null || !ctx.chargeAp(owner, cost)) {
        const note = anchor === null ? 'No free square next to Baba Yaga' : 'Not enough AP to return the unit'
        ctx.emit({ type: 'abilityNote', unitId: holder.id, abilityId: CAULDRON, note }, [owner])
        return
      }
      ctx.setTurnCounter(owner, RETURNS, ctx.turnCounter(owner, RETURNS) + 1)
      ctx.setMemory(fallen, RETURNS, ctx.memory(fallen, RETURNS) + 1)
      const back = ctx.revive(fallen.id, toughness, anchor)
      if (back !== null) ctx.exhaust(back)
    },
  },
]
