// R46 Group march helpers shared by the kernel's validation and the UI (who may join whom, what a group costs).
// The kernel checks the same rule in checkGroupMarch through the ability registry; these read the content tables,
// so a client can explain a refusal before sending an intent.

import { unitDef } from './content/units'
import { MARCH_ANY_TYPE_ABILITY, MARCH_SAME_TYPE } from './constants'
import type { UnitTypeId } from './types'

/** The Soldier's Lockstep passive: this type may march with a group of any other type. */
export function marchesWithAnyType(type: UnitTypeId): boolean {
  return unitDef(type).abilities.includes(MARCH_ANY_TYPE_ABILITY)
}

/** R46: every unit of a march group has the same type, ignoring units that march with any type. */
export function marchTypesCompatible(types: readonly UnitTypeId[]): boolean {
  if (!MARCH_SAME_TYPE) return true
  const strict = new Set(types.filter((t) => !marchesWithAnyType(t)))
  return strict.size <= 1
}
