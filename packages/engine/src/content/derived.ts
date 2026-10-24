// Facts that follow from content alone (unit type + the owner's commander and its variant). Commander
// identities and variants are public from the lobby (R16, R11), so the authority and clients compute these.

import type { AbilityId, CommanderId, RosterUnitId, Tier, UnitTypeId } from '../types'
import { commanderDef, commanderVariant, type CommanderStats, type UnitFilter } from './commanders'
import { unitDef } from './units'

/** A7-11: effective tier (Sabrina's Artificers are type 10 for every purpose). */
export function tierFor(type: UnitTypeId, commander: CommanderId | null): Tier | null {
  const base = unitDef(type).tier
  if (base === null || commander === null) return base
  return commanderDef(commander).tierOverrides.find((o) => o.type === type)?.tier ?? base
}

function matches(filter: UnitFilter, type: UnitTypeId, tier: Tier | null): boolean {
  if (filter.types !== undefined && !filter.types.includes(type)) return false
  if (filter.tiers !== undefined && (tier === null || !filter.tiers.includes(tier))) return false
  return true
}

/**
 * Abilities of a unit of this type under this commander (and variant): own list + grants - revokes (7.3; A7-07:
 * own units only, created and revived ones included).
 */
export function abilitiesFor(type: UnitTypeId, commander: CommanderId | null, variant: string | null = null): AbilityId[] {
  if (commander === null) return type === 'commander' ? [] : [...unitDef(type).abilities]
  const def = commanderDef(commander)
  const chosen = commanderVariant(commander, variant)
  if (type === 'commander') return [...def.abilities, ...(chosen?.abilities ?? [])]
  const list = [...unitDef(type).abilities]
  const tier = tierFor(type, commander)
  for (const grant of [...def.grants, ...(chosen?.grants ?? [])]) {
    if (matches(grant.filter, type, tier) && !list.includes(grant.ability)) list.push(grant.ability)
  }
  return list.filter((id) => !def.revokes.some((r) => r.ability === id && matches(r.filter, type, tier)))
}

/** A5-01 / A7-11: what one unit costs in an army led by this commander (percent rules round up). */
export function unitCost(type: RosterUnitId, commander: CommanderId): number {
  const def = unitDef(type)
  let cost = def.cost
  for (const rule of commanderDef(commander).costRules) {
    switch (rule.kind) {
      case 'fixed':
        if (rule.type === type) cost = rule.cost
        break
      case 'percent':
        if (def.tier !== null && def.tier >= rule.minTier && !rule.exceptTypes.includes(type)) {
          cost = Math.floor((cost * rule.percent + 99) / 100)
        }
        break
    }
  }
  return cost
}

/** Printed stats of a commander unit (base R8 plus the named commander's overrides). */
export function commanderStats(commander: CommanderId): CommanderStats {
  return commanderDef(commander).stats
}
