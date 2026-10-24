// Factions (7.2). Owner ruling R4: the PDF's two columns are the two rosters, one unit per tier each. Owner ruling
// R43: an army may mix units of both rosters, so a faction is the army's banner and its units' home.

import type { FactionId, RosterUnitId } from '../types'
import { ROSTER, ROSTER_IDS } from './units'

export interface FactionDef {
  readonly id: FactionId
  readonly name: string
  /** The faction's own 7 units (their home faction, R4), in tier order: presentation grouping since R43. */
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

/** R43: every army may field all 14 units, whatever its banner. */
export function availableRoster(_banner: FactionId): readonly RosterUnitId[] {
  return ROSTER_IDS
}
