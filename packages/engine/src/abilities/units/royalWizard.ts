// Royal Wizard (RULES_INTERPRETATION 8.11; 10/24 under owner ruling R25, content data). Both abilities create areas
// that outlive the Wizard (A2-26, WIZ-11). The core expires them at the start of the owner's turn, shows the
// opponent only the squares in its vision (A4-13) and applies end-of-turn damage before every heal (2.10, WIZ-9).

import { abilityParam } from '../../content/abilities'
import { FORCEFIELD_DURATION } from '../../constants'
import { area3x3, sameSquare } from '../../geometry'
import type { AreaCore, RulesQuery } from '../../query'
import type { Seat, UnitCore } from '../../types'
import type { AbilityDefinition } from '../types'

const FORCEFIELD = 'royalWizard.forcefield'
const PAJAZON = 'royalWizard.pajazon'

const FIELD_SQUARES = abilityParam(FORCEFIELD, 'squares')
const FIELD_REDUCTION = abilityParam(FORCEFIELD, 'reduction')
const PAJAZON_CENTRE_RANGE = abilityParam(PAJAZON, 'centreRange')
const PAJAZON_TURNS = abilityParam(PAJAZON, 'duration')
const PAJAZON_HEAL = abilityParam(PAJAZON, 'heal')
const PAJAZON_DAMAGE = abilityParam(PAJAZON, 'damage')

/** WIZ-5: a Size-2 unit is inside if any of its squares is. */
function covers(q: RulesQuery, area: AreaCore, unit: UnitCore): boolean {
  return q.footprint(unit).some((s) => area.squares.some((a) => sameSquare(a, s)))
}

/** The seat's units inside the area as they stand now, hidden ones included (WIZ-8). */
function unitsInside(q: RulesQuery, area: AreaCore, seat: Seat): UnitCore[] {
  return q.units().filter((u) => u.owner === seat && covers(q, area, u))
}

export const royalWizardAbilities: readonly AbilityDefinition[] = [
  {
    id: FORCEFIELD,
    status: 'implemented',
    active: {
      // A8-18 / C27 / WIZ-1: 4 orthogonally connected existing squares inside the Wizard's LOV, its own square,
      // occupied squares and blockers included; the core checks the count, LOV and shape (FORCEFIELD_SHAPE).
      targets: [{ kind: 'connectedSquares', label: 'Forcefield squares', count: FIELD_SQUARES }],
      resolve: (ctx, unit, targets) => {
        const target = targets[0]
        if (target?.kind !== 'squares') return
        // A2-24: no stated duration, so until the start of the Wizard's next turn; the squares stay put (WIZ-3).
        ctx.createArea({ abilityId: FORCEFIELD, owner: unit.owner, source: unit, squares: target.squares, durationOwnTurns: FORCEFIELD_DURATION })
      },
    },
    area: {
      // A8-18 / WIZ-4 / WIZ-5: pipeline step 4 on every hit an own unit inside takes, mines and ticks included
      // (floor 1); enemies inside get nothing; two Forcefields count once (A3-15, one contribution per ability).
      targetReduction: (q, area, hit) => (hit.target.owner === area.owner && covers(q, area, hit.target) ? FIELD_REDUCTION : 0),
    },
  },
  {
    id: PAJAZON,
    status: 'implemented',
    active: {
      // A8-19: a centre up to range 3 from the Wizard, its own square included (PAJAZON_CENTRE_RANGE).
      targets: [{ kind: 'area3x3', label: 'Centre', centreRange: PAJAZON_CENTRE_RANGE }],
      resolve: (ctx, unit, targets) => {
        const target = targets[0]
        if (target?.kind !== 'square') return
        // A8-19 / A2-23: the 3x3 minus off-board squares, for two own turns counting this one (gone at the start of
        // own turn T + 2): 2 heal ticks, the first at the end of this turn, and 2 damage ticks.
        ctx.createArea({ abilityId: PAJAZON, owner: unit.owner, source: unit, squares: area3x3(target.square), durationOwnTurns: PAJAZON_TURNS })
      },
    },
    area: {
      // A8-19: own units inside heal at the end of the owner's turns, enemy units inside take a tick at the end of the
      // opponent's turns; positions are read at tick time. Overlapping Pajazons give one tick per unit (WIZ-7), ticks
      // are never weakened (WIZ-10) and set off no mine (TMN-3).
      endOfTurn: (q, area, endingSeat) =>
        endingSeat === area.owner
          ? { heal: unitsInside(q, area, endingSeat).map((u) => ({ target: u.id, amount: PAJAZON_HEAL })) }
          : { damage: unitsInside(q, area, endingSeat).map((u) => ({ target: u.id, amount: PAJAZON_DAMAGE })) },
    },
  },
]
