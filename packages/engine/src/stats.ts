// Effective stats (3.1, A3-09: printed, base = printed + permanent, max = base + auras, current is stored):
// printed stats + commander, building, aura and ability modifiers, derived on
// demand from content and state (never stored, so auras stay correct as units move).

import { liveAbility } from './abilities/registry'
import type { StatModifier } from './abilities/types'
import {
  ACTIONS_PER_TURN,
  AURA_LOSS_CAN_KILL,
  KEEP_POWER_BONUS,
  MARKET_EXTRA_ACTIONS,
  MARKET_TIER1_ACTION,
  MARKET_TIERS,
  SAME_NAME_STACKING,
} from './constants'
import type { StatsQuery, UnitStats } from './query'
import { printedStats, unitAbilities } from './state'
import type { GameState, UnitCore, UnitState } from './types'

/** A query over a real state (the authority); stats need the stored permanent toughness. */
export type StatsSource = StatsQuery & { readonly state: GameState }

interface Totals {
  power: number
  baseToughness: number
  maxToughness: number
  lov: number
  movement: number
  attackRange: number
  actions: number
}

const FIELDS = ['power', 'baseToughness', 'maxToughness', 'lov', 'movement', 'attackRange', 'actions'] as const

function emptyTotals(): Totals {
  return { power: 0, baseToughness: 0, maxToughness: 0, lov: 0, movement: 0, attackRange: 0, actions: 0 }
}

/** A3-15: per source name, field-wise max over holders (or the sum if SAME_NAME_STACKING). */
function mergeInto(bySource: Map<string, Totals>, source: string, mod: StatModifier): void {
  const current = bySource.get(source) ?? emptyTotals()
  for (const field of FIELDS) {
    const value = mod[field] ?? 0
    if (field === 'attackRange') current.attackRange = Math.max(current.attackRange, value)
    else current[field] = SAME_NAME_STACKING ? current[field] + value : Math.max(current[field], value)
  }
  bySource.set(source, current)
}

/** A6-10 / A6-11 / R31: building effects are global for the controller, so the core owns them (the Market's AP is in turn.ts). */
function buildingModifiers(q: StatsSource, target: UnitCore, bySource: Map<string, Totals>): void {
  for (const building of q.buildings()) {
    if (building.controller !== target.owner) continue
    switch (building.kind) {
      case 'keep':
        mergeInto(bySource, 'keep', { power: KEEP_POWER_BONUS })
        break
      case 'market': {
        const tier = q.tierOf(target)
        if (MARKET_TIER1_ACTION && tier !== null && MARKET_TIERS.includes(tier)) mergeInto(bySource, 'market', { actions: MARKET_EXTRA_ACTIONS }) // A6-11, R31
        break
      }
    }
  }
}

export function collectModifiers(q: StatsSource, target: UnitCore): Totals {
  const bySource = new Map<string, Totals>()
  buildingModifiers(q, target, bySource)
  for (const holder of q.state.units) {
    for (const abilityId of unitAbilities(q.state, holder)) {
      const hook = liveAbility(abilityId)?.modifyStats
      if (hook === undefined) continue
      const mod = hook(q, holder, target)
      if (mod !== null) mergeInto(bySource, abilityId, mod)
    }
  }
  const totals = emptyTotals()
  for (const t of bySource.values()) {
    for (const field of FIELDS) {
      if (field === 'attackRange') totals.attackRange = Math.max(totals.attackRange, t.attackRange)
      else totals[field] += t[field]
    }
  }
  return totals
}

function storedUnit(state: GameState, unit: UnitCore): UnitState | undefined {
  return state.units.find((u) => u.id === unit.id) ?? state.fallen.find((f) => f.unit.id === unit.id)?.unit
}

export function computeStats(q: StatsSource, unit: UnitCore): UnitStats {
  const printed = printedStats(q.state, unit)
  const mods = collectModifiers(q, unit)
  const baseToughness = printed.toughness + mods.baseToughness + (storedUnit(q.state, unit)?.permanentToughness ?? 0)
  return {
    power: Math.max(0, printed.power + mods.power),
    baseToughness,
    maxToughness: Math.max(1, baseToughness + mods.maxToughness),
    lov: Math.max(0, printed.lov + mods.lov),
    movement: Math.max(0, printed.movement + mods.movement),
    attackRange: Math.max(printed.attackRange, mods.attackRange),
    actionAllowance: ACTIONS_PER_TURN + mods.actions,
    apCost: printed.ap,
    tier: q.tierOf(unit),
    size: printed.size,
  }
}

/**
 * A3-11: gaining a temporary toughness bonus raises max and current; losing it lowers both, never below 1
 * unless AURA_LOSS_CAN_KILL. Mutates the unit; returns the change applied to current toughness.
 */
export function syncAuraToughness(q: StatsSource, unit: UnitState): number {
  const target = collectModifiers(q, unit).maxToughness
  const delta = target - unit.auraToughness
  if (delta === 0) return 0
  const before = unit.toughness
  unit.toughness = delta > 0 || AURA_LOSS_CAN_KILL ? unit.toughness + delta : Math.max(1, unit.toughness + delta)
  unit.auraToughness = target
  return unit.toughness - before
}
