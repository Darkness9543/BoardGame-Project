// Factions (7.2). Owner ruling R4: the PDF's two columns are the two rosters, one unit per tier each.

import { LOJRAR_PROXY_ROSTER } from '../constants'
import type { FactionId, RosterUnitId } from '../types'
import { ROSTER } from './units'

export interface FactionDef {
  readonly id: FactionId
  readonly name: string
  /** The faction's own 7 units, in tier order. */
  readonly roster: readonly RosterUnitId[]
}

function rosterOf(faction: FactionId): RosterUnitId[] {
  return ROSTER.filter((u) => u.faction === faction).map((u) => u.id as RosterUnitId)
}

export const FACTIONS: readonly FactionDef[] = [
  { id: 'empire', name: 'The Empire', roster: rosterOf('empire') },
  { id: 'lojrar', name: 'Lojrar Clan', roster: rosterOf('lojrar') },
]

export function factionDef(id: FactionId): FactionDef {
  const def = FACTIONS.find((f) => f.id === id)
  if (def === undefined) throw new Error(`Unknown faction: ${id}`)
  return def
}

/** R4: an army fields its own faction's units only (LOJRAR_PROXY_ROSTER, now false, was the old A7-05 stand-in). */
export function availableRoster(id: FactionId): readonly RosterUnitId[] {
  if (id === 'lojrar' && LOJRAR_PROXY_ROSTER) return [...factionDef('empire').roster, ...factionDef('lojrar').roster]
  return factionDef(id).roster
}
