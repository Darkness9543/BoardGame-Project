// Pure edits of a draft army for the builder, and the reprice note of AB-05.

import { DEFAULT_SETTINGS, armyCost, commanderDef, unitCost, unitDef, type ArmyList, type CommanderId, type FactionId, type MatchSettings, type RosterUnitId } from '@coinduel/engine'

export interface BuilderDraft {
  readonly name: string
  readonly army: ArmyList
}

export function withUnits(army: ArmyList, type: RosterUnitId, count: number): ArmyList {
  const units = { ...army.units }
  if (count > 0) units[type] = count
  else delete units[type]
  return { ...army, units }
}

/** R43: the banner is cosmetic; every unit stays in the army. */
export function withBanner(army: ArmyList, faction: FactionId): ArmyList {
  return army.faction === faction ? army : { ...army, faction }
}

export function withCommander(army: ArmyList, commander: CommanderId, variant: string | null): ArmyList {
  const { variant: _old, ...rest } = army
  return variant === null ? { ...rest, commander } : { ...rest, commander, variant }
}

/** AB-05: "Switching to Sabrina: Paladin 20 -> 24 (x2); total 200 -> 208; over budget by 8". */
export function repriceNote(before: ArmyList, after: ArmyList, budget: number): string | null {
  if (before.commander === after.commander) return null
  const changes: string[] = []
  for (const [type, n] of Object.entries(after.units)) {
    const t = type as RosterUnitId
    const a = unitCost(t, before.commander)
    const b = unitCost(t, after.commander)
    if (a !== b && (n ?? 0) > 0) changes.push(`${unitDef(t).name} ${a} → ${b} (×${n})`)
  }
  if (changes.length === 0) return null
  const total = armyCost(after)
  const over = total > budget ? `; over budget by ${total - budget}` : ''
  return `Switching to ${commanderDef(after.commander).name}: ${changes.join(', ')}; total ${armyCost(before)} → ${total}${over}`
}

/** Outside a lobby the builder checks against the default settings with the army's own budget (AB-09). */
export function builderSettings(budget: number): MatchSettings {
  return { ...DEFAULT_SETTINGS, budget }
}
