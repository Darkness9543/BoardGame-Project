// The six commanders (SPEC "Commanders", RULES_INTERPRETATION section 7 and owner rulings R7, R8, R11) as
// data: presentation group, card text, the commander unit's stats, and the army-building rules the core must
// know (granted and revoked abilities, tier and cost changes, selectable variants). Their in-battle behaviour
// lives in abilities/commanders/*.ts.

import {
  BABA_CAULDRON_PER_TURN,
  BABA_CAULDRON_PER_UNIT,
  BABA_COMMANDER_TOUGHNESS,
  BABA_HEX_RANGE,
  BABA_HEX_REDUCTION,
  BABA_HEX_TOUGHNESS,
  BABA_MEND_COST,
  BABA_MEND_HEAL,
  BABA_MEND_MAX_PER_UNIT,
  BABA_MEND_USES_PER_TURN,
  BABA_WHITE,
  COMMANDER_BASE_TOUGHNESS,
  COMMANDER_MOVEMENT,
  KULEGA_HEAL_CAP,
  QUESO_AP,
  QUESO_BEACON_HEAL,
  QUESO_COMMANDER_TOUGHNESS,
  QUESO_REVIVE_COST,
  RATASIUS_DETECTION_RANGE,
  RATASIUS_WEAKNESS,
  RATASIUS_WEAKNESS_RANGE,
  SABRINA_ARTIFICER_COST,
  SABRINA_ARTIFICER_TIER,
  SABRINA_SURCHARGE,
  SABRINA_SURCHARGE_MIN_TIER,
  TRILL_COMMANDER_TOUGHNESS,
  TRILL_TOUGHNESS_BONUS,
} from '../constants'
import type { AbilityId, CommanderId, FactionId, RosterUnitId, Tier, UnitTypeId } from '../types'
import { abilityParam, cauldronCostText } from './abilities'

export interface CommanderStats {
  readonly power: number
  readonly toughness: number
  readonly lov: number
  readonly movement: number
  readonly ap: number
}

/** Which own units an ability grant or revoke applies to. Tiers are effective tiers (after tierOverrides). */
export interface UnitFilter {
  readonly types?: readonly UnitTypeId[]
  readonly tiers?: readonly Tier[]
  /** The units' home factions (R44: Baba Yaga's "units of white" are the Lojrar Clan units). */
  readonly factions?: readonly FactionId[]
}

export interface AbilityGrant {
  readonly ability: AbilityId
  readonly filter: UnitFilter
}

export interface TierOverride {
  readonly type: RosterUnitId
  readonly tier: Tier
}

/** Army cost changes (A7-11). Percent rules round up. */
export type CostRule =
  | { readonly kind: 'fixed'; readonly type: RosterUnitId; readonly cost: number }
  | { readonly kind: 'percent'; readonly minTier: Tier; readonly exceptTypes: readonly RosterUnitId[]; readonly percent: number }

/** A selectable variant (R11: Baba Yaga). Its abilities and grants add to the commander's own. */
export interface CommanderVariantDef {
  readonly id: string
  readonly name: string
  readonly text: string
  readonly abilities: readonly AbilityId[]
  readonly grants: readonly AbilityGrant[]
}

export interface CommanderDef {
  readonly id: CommanderId
  readonly name: string
  readonly title: string
  /** R7: presentation order only (the PDF's two groups); COMMANDER_FACTION_LOCK would map A = Empire, B = Lojrar. */
  readonly group: 'A' | 'B'
  /** false = dev/test content, hidden from the builder and refused unless settings.devContent. */
  readonly selectable: boolean
  readonly stats: CommanderStats
  /** Abilities carried by the commander unit itself (its army-wide effects). */
  readonly abilities: readonly AbilityId[]
  readonly grants: readonly AbilityGrant[]
  readonly revokes: readonly AbilityGrant[]
  readonly tierOverrides: readonly TierOverride[]
  readonly costRules: readonly CostRule[]
  /** When non-empty, the army must pick one (ArmyList.variant). */
  readonly variants: readonly CommanderVariantDef[]
  readonly text: string
  readonly assumptions: readonly string[]
}

/** R8: base commander 1/5, Movement 2, AP 1, LOV 3. */
const BASE: CommanderStats = { power: 1, toughness: COMMANDER_BASE_TOUGHNESS, lov: 3, movement: COMMANDER_MOVEMENT, ap: 1 }
/** A7-14: "This commander has LOV 6". */
const RATASIUS_LOV = 6

type CommanderSpec = Omit<CommanderDef, 'grants' | 'revokes' | 'tierOverrides' | 'costRules' | 'selectable' | 'variants'> &
  Partial<CommanderDef>

function commander(def: CommanderSpec): CommanderDef {
  return { selectable: true, grants: [], revokes: [], tierOverrides: [], costRules: [], variants: [], ...def }
}

export const COMMANDERS: readonly CommanderDef[] = [
  commander({
    id: 'trill',
    name: 'Trill',
    title: 'The Hydrocephalic',
    group: 'A',
    stats: { ...BASE, toughness: TRILL_COMMANDER_TOUGHNESS }, // A7-08 / R8 / R23
    abilities: [],
    // A7-08 / TRI-1: each own unit of type 1, 2 or 5 carries its permanent bonus itself, so it never depends on Trill
    // standing (the final board after his death stays consistent).
    grants: [{ ability: 'trill.hydrocephalic', filter: { tiers: [1, 2, 5] } }],
    text: `All units of type 1, 2 and 5 gain ${TRILL_TOUGHNESS_BONUS} toughness. The commander has toughness ${TRILL_COMMANDER_TOUGHNESS}.`,
    assumptions: ['A7-08', 'R8', 'R23'],
  }),
  commander({
    id: 'kulega',
    name: 'Kulega',
    title: 'The Fine Printer',
    group: 'A',
    stats: BASE,
    abilities: ['kulega.finePrinter'],
    grants: [{ ability: 'kulega.finePrint', filter: { tiers: [20] } }], // A7-10
    text:
      `All units gain ${abilityParam('kulega.finePrinter', 'lov')} LOV. All units of type 20 gain the following ability: when a ` +
      `unit of type 1 or 2 dies adjacent to this unit, regenerate toughness equal to that unit's toughness, maximum of ` +
      `${KULEGA_HEAL_CAP} per instance.`,
    assumptions: ['A7-09', 'A7-10'],
  }),
  commander({
    id: 'sabrina',
    name: 'Sabrina',
    title: 'The Reelfinisher',
    group: 'A',
    stats: BASE,
    abilities: ['sabrina.reelfinisher'],
    revokes: [{ ability: 'artificer.tripMine', filter: { types: ['artificer'] } }], // A7-11: no mines
    tierOverrides: [{ type: 'artificer', tier: SABRINA_ARTIFICER_TIER }],
    costRules: [
      { kind: 'fixed', type: 'artificer', cost: SABRINA_ARTIFICER_COST },
      { kind: 'percent', minTier: SABRINA_SURCHARGE_MIN_TIER, exceptTypes: ['artificer'], percent: SABRINA_SURCHARGE },
    ],
    text:
      `Artificers and No-ACBs get ${abilityParam('sabrina.reelfinisher', 'power')} additional Power. Artificers are now ` +
      `considered type ${SABRINA_ARTIFICER_TIER}. Artificers can no longer use mines. Each other unit of type ` +
      `${SABRINA_SURCHARGE_MIN_TIER} and above is ${SABRINA_SURCHARGE - 100}% more expensive to deploy.`,
    assumptions: ['A7-11'],
  }),
  commander({
    id: 'babaYaga',
    name: 'Baba Yaga',
    title: 'The Bwitch',
    group: 'B',
    stats: { ...BASE, toughness: BABA_COMMANDER_TOUGHNESS }, // R45
    abilities: [],
    // R11: the spec's regeneration text is replaced by three player-selected variants; R44: "units of white" are the
    // Lojrar Clan units; R45: the balanced numbers.
    variants: [
      {
        id: 'mend',
        name: 'Mend the Swarm',
        text:
          `Your Lojrar Clan units gain Regenerate: for ${BABA_MEND_COST} AP, restore ${BABA_MEND_HEAL} toughness to the unit. ` +
          `Not an action; at most ${BABA_MEND_USES_PER_TURN} uses per turn, and at most ${BABA_MEND_MAX_PER_UNIT} on the same unit.`,
        abilities: [],
        grants: [{ ability: 'babaYaga.mend', filter: { factions: [BABA_WHITE.faction] } }],
      },
      {
        id: 'hex-ward',
        name: 'Hex Ward',
        text:
          `Your Lojrar Clan units within range ${BABA_HEX_RANGE} of Baba Yaga gain ${BABA_HEX_TOUGHNESS} toughness and take ` +
          `${BABA_HEX_REDUCTION} less damage (not below 1).`,
        abilities: ['babaYaga.hexWard'],
        grants: [],
      },
      {
        id: 'cauldron',
        name: 'Cauldron',
        text:
          `When one of your Lojrar Clan units dies, you may pay AP by its type (${cauldronCostText()}) to return it at full ` +
          `toughness to a free square adjacent to Baba Yaga. At most ${BABA_CAULDRON_PER_TURN} returns per turn, and ` +
          `${BABA_CAULDRON_PER_UNIT} per unit per game.`,
        abilities: ['babaYaga.cauldron'],
        grants: [],
      },
    ],
    text: 'Choose one variant when you pick Baba Yaga: Mend the Swarm, Hex Ward or Cauldron.',
    assumptions: ['R11', 'R44', 'R45'],
  }),
  commander({
    id: 'ratasius',
    name: 'Ratasius I',
    title: 'The Great',
    group: 'B',
    stats: { ...BASE, lov: RATASIUS_LOV },
    abilities: ['ratasius.great'],
    text:
      `This commander has LOV ${RATASIUS_LOV}. Reveals all invisible enemies in range of ${RATASIUS_DETECTION_RANGE}. ` +
      `Enemies in range of ${RATASIUS_WEAKNESS_RANGE} gain weakness and deal ${RATASIUS_WEAKNESS} less damage.`,
    assumptions: ['A7-14'],
  }),
  commander({
    id: 'queso',
    name: 'Queso',
    title: 'The Beacon of Hope',
    group: 'B',
    stats: { ...BASE, toughness: QUESO_COMMANDER_TOUGHNESS, ap: QUESO_AP }, // R8 / R17: its AP is its cost per action (A7-03)
    abilities: ['queso.beacon', 'queso.revive'],
    text:
      `This commander's AP is ${QUESO_AP}. Nearby units in range of ${abilityParam('queso.beacon', 'range')} regenerate ` +
      `${QUESO_BEACON_HEAL} toughness each of your turns (not the opponent's turn). When a unit in that area dies you can ` +
      `choose to sacrifice max toughness (${QUESO_REVIVE_COST(100)} for type 100, ${QUESO_REVIVE_COST(50)} for type 50, ` +
      `${QUESO_REVIVE_COST(1)} otherwise) to revive that unit with half of its base toughness rounded up.`,
    assumptions: ['A7-15', 'A7-16', 'R8', 'R17', 'R18', 'R24'],
  }),
  commander({
    id: 'baseline',
    name: 'Baseline',
    title: 'Test Commander',
    group: 'A',
    selectable: false,
    stats: BASE,
    abilities: [],
    text: 'Dev and test commander with the base stats and no effects.',
    assumptions: ['A7-01'],
  }),
]

const BY_ID = new Map<CommanderId, CommanderDef>(COMMANDERS.map((c) => [c.id, c]))

export function commanderDef(id: CommanderId): CommanderDef {
  const def = BY_ID.get(id)
  if (def === undefined) throw new Error(`Unknown commander: ${id}`)
  return def
}

export function isCommanderId(id: string): id is CommanderId {
  return BY_ID.has(id as CommanderId)
}

/** The faction a commander group stands for when COMMANDER_FACTION_LOCK is on (R7's alternative). */
export function groupFaction(group: 'A' | 'B'): FactionId {
  return group === 'A' ? 'empire' : 'lojrar'
}

export function commanderVariant(id: CommanderId, variant: string | null | undefined): CommanderVariantDef | undefined {
  return commanderDef(id).variants.find((v) => v.id === variant)
}
