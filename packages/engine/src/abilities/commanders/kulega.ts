// Kulega "The Fine Printer" (RULES_INTERPRETATION 7.5). STUB: owned by the commanders agent. The grant of
// Fine Print to own type-20 units is content data (content/commanders.ts).

import type { AbilityDefinition } from '../types'

export const kulegaAbilities: readonly AbilityDefinition[] = [
  {
    id: 'kulega.finePrinter',
    status: 'stub',
    // TODO(A7-09): modifyStats(q, holder, target): every own unit (commander and dummies included) gets
    // { lov: params.lov }. This also widens Mind's Eye and the Forcefield's "in LOV" area automatically.
  },
  {
    id: 'kulega.finePrint',
    status: 'stub',
    // TODO(A7-10, KULEGA_ENEMY_DEATHS, X-08): onUnitDied(ctx, holder, death): if death.tier is 1 or 2 (either
    // side) and one of death.footprint is adjacent to the holder at the moment of death, heal the holder
    // min(KULEGA_HEAL_CAP, death.baseToughness). One instance per death per type-20 unit; sacrifices count.
  },
]
