// Celestial Emissary (RULES_INTERPRETATION 8.13; Smite's own targets and splash under owner rulings R14 and R25).

import { abilityParam } from '../../content/abilities'
import { HOLY_BLESSING_SELF, HOLY_FERVOR_SURCHARGE } from '../../constants'
import { adjacentSquares } from '../../geometry'
import type { AbilityDefinition } from '../types'

const HOLY_BLESSING = 'emissary.holyBlessing'
const SMITE = 'emissary.smite'
const HOLY_FERVOR = 'emissary.holyFervor'

const BLESSING_RANGE = abilityParam(HOLY_BLESSING, 'range')
const BLESSING_HEAL = abilityParam(HOLY_BLESSING, 'heal')
const SMITE_RANGE = abilityParam(SMITE, 'range')
const SMITE_DAMAGE = abilityParam(SMITE, 'damage')
const SMITE_SPLASH = abilityParam(SMITE, 'splash')
const FERVOR_ACTIONS = abilityParam(HOLY_FERVOR, 'extraActions')
const FERVOR_SURCHARGE = abilityParam(HOLY_FERVOR, 'surcharge')

/** A8-24 / CEL-7: extra AP on the Emissary's next action, given the actions it has used this turn. */
function fervorSurcharge(actionsUsed: number): number {
  switch (HOLY_FERVOR_SURCHARGE) {
    case 'everyActionAfterFirst':
      return actionsUsed >= 1 ? FERVOR_SURCHARGE : 0
    case 'secondActionOnly':
      return actionsUsed === 1 ? FERVOR_SURCHARGE : 0
  }
}

export const emissaryAbilities: readonly AbilityDefinition[] = [
  {
    id: HOLY_BLESSING,
    status: 'implemented',
    active: {
      targets: [],
      // A8-22 / CEL-1 / CEL-2: own units within range 2 and the Emissary itself (HOLY_BLESSING_SELF) heal 5, capped;
      // a heal never reveals a stealthed unit.
      resolve: (ctx, unit) => {
        const allies = ctx.unitsWithin(unit, BLESSING_RANGE).filter((u) => u.owner === unit.owner)
        for (const ally of HOLY_BLESSING_SELF ? [unit, ...allies] : allies) ctx.heal(ally, BLESSING_HEAL, HOLY_BLESSING)
      },
    },
  },
  {
    id: SMITE,
    status: 'implemented',
    active: {
      // A8-23 / R14: a visible unit up to range 3, an own one included (FRIENDLY_SINGLE_TARGET; the UI confirms).
      targets: [{ kind: 'unit', label: 'Target', range: SMITE_RANGE, relation: 'harmful', includeSelf: false, allowCommander: true }],
      resolve: (ctx, unit, targets) => {
        const target = targets[0]
        const victim = target?.kind === 'unit' ? ctx.unit(target.unitId) : undefined
        if (victim === undefined || victim.anchor === null) return
        // R25 (Q101): 8 on the target and 3 on every unit on its orthogonal neighbours (8 squares round a Size-2
        // target), friendly fire on, the Emissary too if it stands there; one simultaneous effect. The Emissary is the
        // dealer, so weakness applies (CEL-8, R13 floor 1). It targets a unit, so it is no ranged attack and sets off
        // no mine (CEL-3).
        ctx.dealSplash({
          source: SMITE,
          dealer: unit,
          target: victim,
          damage: SMITE_DAMAGE,
          squares: adjacentSquares(victim.anchor, ctx.sizeOf(victim), 'ORTHO_4'),
          splash: SMITE_SPLASH,
          friendlyFire: true,
        })
      },
    },
  },
  {
    id: HOLY_FERVOR,
    status: 'implemented',
    // A8-24: two actions a turn; R12: the extra one may be a second Move. It adds to Command Aura and the Market,
    // and every action after the first costs +1 AP whatever it is (CEL-6, CEL-7).
    modifyStats: (_q, holder, target) => (target.id === holder.id ? { actions: FERVOR_ACTIONS } : null),
    actionSurcharge: fervorSurcharge,
  },
]
