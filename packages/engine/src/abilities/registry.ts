// Registry of ability definitions keyed by ability id. Filled from abilities/index.ts on first use;
// registerAbility lets tests and future content add definitions (vitest isolates modules per file).

import type { AbilityId } from '../types'
import { ABILITY_DEFINITIONS } from './index'
import type { AbilityDefinition } from './types'

const registry = new Map<AbilityId, AbilityDefinition>()
let loaded = false

function ensureLoaded(): void {
  if (loaded) return
  loaded = true
  for (const def of ABILITY_DEFINITIONS) {
    if (registry.has(def.id)) throw new Error(`Duplicate ability definition: ${def.id}`)
    registry.set(def.id, def)
  }
}

export function getAbility(id: AbilityId): AbilityDefinition | undefined {
  ensureLoaded()
  return registry.get(id)
}

/** The definition if it is implemented; stubs are ignored by the rules. */
export function liveAbility(id: AbilityId): AbilityDefinition | undefined {
  const def = getAbility(id)
  return def !== undefined && def.status === 'implemented' ? def : undefined
}

export function registerAbility(def: AbilityDefinition, options: { readonly replace?: boolean } = {}): void {
  ensureLoaded()
  if (registry.has(def.id) && options.replace !== true) throw new Error(`Ability already registered: ${def.id}`)
  registry.set(def.id, def)
}

export function allAbilityDefinitions(): readonly AbilityDefinition[] {
  ensureLoaded()
  return [...registry.values()]
}
