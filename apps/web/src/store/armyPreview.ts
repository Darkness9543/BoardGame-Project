// Builder previews from the engine itself (PX AB-14): each roster unit's effective stats under a commander and
// variant, read from a scratch board (units far apart and away from the commander, so positional auras don't
// count, as AB-14 asks). Commander passives therefore show exactly as the rules compute them.

import {
  ROSTER,
  abilitiesFor,
  buildBattle,
  commanderStats,
  projectView,
  tierFor,
  unitCost,
  unitDef,
  type CommanderId,
  type RosterUnitId,
  type Tier,
  type UnitView,
} from '@coinduel/engine'

export interface UnitPreview {
  readonly type: RosterUnitId
  readonly tier: Tier | null
  readonly cost: number
  readonly baseCost: number
  readonly power: number
  readonly toughness: number
  readonly lov: number
  readonly movement: number
  readonly attackRange: number
  readonly ap: number
  readonly abilities: readonly string[]
  /** Abilities of the unit line the commander removes (Sabrina's mines). */
  readonly revoked: readonly string[]
  /** Abilities the commander or variant grants (Kulega's Fine Print, Mend). */
  readonly granted: readonly string[]
}

export interface CommanderPreview {
  readonly power: number
  readonly toughness: number
  readonly lov: number
  readonly movement: number
  readonly ap: number
  readonly abilities: readonly string[]
}

const cache = new Map<string, { readonly units: ReadonlyMap<RosterUnitId, UnitPreview>; readonly commander: CommanderPreview }>()

function scratchViews(commander: CommanderId, variant: string | null): Map<string, UnitView> {
  // Three squares apart (no adjacency or range-2 aura), rows 17 and 20: clear of the buildings and the commander.
  const placements = ROSTER.map((u, i) => `${u.id}@${'CFILORUX'.charAt(i % 8)}${17 + Math.floor(i / 8) * 3}`)
  const battle = buildBattle({ south: placements, commanders: { south: commander }, ...(variant === null ? {} : { variants: { south: variant } }) })
  const view = projectView(battle.state, battle.south)
  const out = new Map<string, UnitView>()
  for (const u of view.units) if (u.owner === view.seat) out.set(u.type, u)
  return out
}

export function previewArmy(commander: CommanderId, variant: string | null): { readonly units: ReadonlyMap<RosterUnitId, UnitPreview>; readonly commander: CommanderPreview } {
  const key = `${commander}|${variant ?? ''}`
  const known = cache.get(key)
  if (known !== undefined) return known
  let views = new Map<string, UnitView>()
  try {
    views = scratchViews(commander, variant)
  } catch {
    // Printed stats below.
  }
  const units = new Map<RosterUnitId, UnitPreview>()
  for (const def of ROSTER) {
    const type = def.id as RosterUnitId
    const v = views.get(type)
    const abilities = abilitiesFor(type, commander, variant)
    units.set(type, {
      type,
      tier: tierFor(type, commander),
      cost: unitCost(type, commander),
      baseCost: def.cost,
      power: v?.power ?? def.power,
      toughness: v?.maxToughness ?? def.toughness,
      lov: v?.lov ?? def.lov,
      movement: v?.movement ?? def.movement,
      attackRange: v?.attackRange ?? def.attackRange,
      ap: v?.own?.apCost ?? def.ap,
      abilities,
      revoked: def.abilities.filter((a) => !abilities.includes(a)),
      granted: abilities.filter((a) => !def.abilities.includes(a)),
    })
  }
  const printed = commanderStats(commander)
  const c = views.get('commander')
  const result = {
    units,
    commander: {
      power: c?.power ?? printed.power,
      toughness: c?.maxToughness ?? printed.toughness,
      lov: c?.lov ?? printed.lov,
      movement: c?.movement ?? printed.movement,
      ap: c?.own?.apCost ?? printed.ap,
      abilities: abilitiesFor('commander', commander, variant),
    },
  }
  cache.set(key, result)
  return result
}

export function printedDef(type: RosterUnitId): ReturnType<typeof unitDef> {
  return unitDef(type)
}
