// Priestess (RULES_INTERPRETATION 8.7, with owner ruling R19 for Shared wounds).

import { abilityParam } from '../../content/abilities'
import { SHARED_WOUNDS_RECIPIENT, SHARED_WOUNDS_ROUNDING } from '../../constants'
import { adjacencyMetric } from '../../geometry'
import type { RulesQuery } from '../../query'
import type { UnitCore } from '../../types'
import type { AbilityDefinition, AbilityTarget, TargetSpec } from '../types'

const STRONG_AURA = 'priestess.strongAura'
const AURA_POWER = abilityParam(STRONG_AURA, 'power')
const AURA_TOUGHNESS = abilityParam(STRONG_AURA, 'toughness')
const SHARED_WOUNDS = 'priestess.sharedWounds'

/** The Priestess herself or an own unit adjacent to her (A8-09; a Beast with any square adjacent, PRI-3). */
function nearPriestess(label: string): TargetSpec {
  return { kind: 'unit', label, range: 1, metric: adjacencyMetric(), relation: 'own', includeSelf: true, allowCommander: true }
}

function recipientSpec(): TargetSpec {
  switch (SHARED_WOUNDS_RECIPIENT) {
    case 'selfOrAdjacent': // PRI-9 (Q75)
      return nearPriestess('Recipient')
  }
}

/** What the donor loses and the recipient may gain: half its current toughness, R19 rounding up (A8-09: down). */
export function woundShare(toughness: number): number {
  switch (SHARED_WOUNDS_ROUNDING) {
    case 'ceil':
      return Math.ceil(toughness / 2)
    case 'floor':
      return Math.floor(toughness / 2)
  }
}

function pickedUnit(q: RulesQuery, target: AbilityTarget | undefined): UnitCore | undefined {
  return target?.kind === 'unit' ? q.unit(target.unitId) : undefined
}

export const priestessAbilities: readonly AbilityDefinition[] = [
  {
    id: STRONG_AURA,
    status: 'implemented',
    // A8-08 / PRI-1..4: own units adjacent to her (not herself; dummies and the commander included) get +1 Power and
    // +1 max toughness. The core moves current toughness with it, never below 1 on loss (A3-11), and applies one copy
    // however many Priestesses are adjacent (A3-15); two adjacent Priestesses buff each other (PRI-2).
    modifyStats: (q, holder, target) =>
      target.id !== holder.id && target.owner === holder.owner && q.isAdjacent(holder, target)
        ? { power: AURA_POWER, maxToughness: AURA_TOUGHNESS }
        : null,
  },
  {
    id: SHARED_WOUNDS,
    status: 'implemented',
    // A8-09: costs the Priestess's own AP (2, A2-12) and her action; both picks are made together; no cooldown.
    active: {
      targets: [nearPriestess('Donor'), recipientSpec()], // PRI-8: own units only
      validate: (q, _unit, targets) => {
        const donor = pickedUnit(q, targets[0])
        const recipient = pickedUnit(q, targets[1])
        if (donor === undefined || recipient === undefined) return 'Choose a donor and a recipient'
        if (donor.id === recipient.id) return 'The donor and the recipient must be different units' // PRI-12
        const share = woundShare(donor.toughness)
        if (share < 1) return 'The donor has no toughness to share' // PRI-5, only when rounding down
        // A7-04: a commander is never sacrificed, so under R19 it may give only while it survives the loss.
        if (q.isCommander(donor) && donor.toughness - share < 1) return 'The commander cannot give its last toughness'
        return null
      },
      resolve: (ctx, _unit, targets) => {
        const donor = pickedUnit(ctx, targets[0])
        const recipient = pickedUnit(ctx, targets[1])
        if (donor === undefined || recipient === undefined) return
        const share = woundShare(donor.toughness)
        // A3-08: not damage (no reductions, Defend or reveal, PRI-11). R19 / Q106: a donor at 1 dies, a death for every
        // trigger; the core runs its death triggers after this effect (2.11).
        ctx.loseToughness(donor, share, SHARED_WOUNDS, { canKill: !ctx.isCommander(donor) })
        // PRI-6 / PRI-7: capped at the recipient's max toughness, auras included; the rest is wasted.
        ctx.heal(recipient, share, SHARED_WOUNDS)
      },
    },
  },
]
