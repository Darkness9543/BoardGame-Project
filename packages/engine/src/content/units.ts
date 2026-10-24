// Unit lines from the spec (GameSpec.pdf; SPEC_ORIGINAL L57-L120) in its order "Name, Power/Toughness, Size,
// LOV, Movement, AP", checked digit by digit against RULES_INTERPRETATION 8.0. Cost = tier (A5-01).
// Owner ruling R4: one unit per tier per faction (the PDF's two columns: Empire left, Lojrar Clan right).

import {
  COMMANDER_BASE_TOUGHNESS,
  COMMANDER_MOVEMENT,
  MINE_DAMAGE,
  MINE_LARGE_BONUS,
  MINE_LARGE_MIN_SIZE,
  VANGUARD_UNITS,
} from '../constants'
import type { AbilityId, FactionId, RosterUnitId, Tier, UnitTypeId } from '../types'

export interface UnitDef {
  readonly id: UnitTypeId
  readonly name: string
  /** null for the commander and created units. */
  readonly faction: FactionId | null
  /** Type/grade/denomination; null = no type (commander, No-ACB). */
  readonly tier: Tier | null
  readonly cost: number
  readonly power: number
  readonly toughness: number
  readonly size: 1 | 2
  readonly lov: number
  readonly movement: number
  /** AP cost per action (A2-32: a fixed stat). */
  readonly ap: number
  /** Basic attack range before abilities (the Ranger's 2 comes from its ability). */
  readonly attackRange: number
  /** A5-04: may also deploy in the extended zone. */
  readonly vanguard: boolean
  /** Created units (No-ACB) are never deployed (A5-07). */
  readonly deployable: boolean
  readonly abilities: readonly AbilityId[]
  /** Icon key for the token symbol (L44; colour = grade, A13-04, is the renderer's job). */
  readonly symbol: string
}

function roster(
  id: RosterUnitId,
  name: string,
  faction: FactionId,
  tier: Tier,
  stats: { power: number; toughness: number; size: 1 | 2; lov: number; movement: number; ap: number },
  abilities: readonly AbilityId[],
): UnitDef {
  return {
    id,
    name,
    faction,
    tier,
    cost: tier,
    ...stats,
    attackRange: 1,
    vanguard: VANGUARD_UNITS.includes(id),
    deployable: true,
    abilities,
    symbol: id,
  }
}

// prettier-ignore
export const ROSTER: readonly UnitDef[] = [
  roster('footman',     'Footman',             'empire', 1,   { power: 1,  toughness: 2,  size: 1, lov: 1, movement: 1, ap: 1 }, ['footman.lineFormation']),
  roster('mercenary',   'Mercenary',           'lojrar', 1,   { power: 2,  toughness: 1,  size: 1, lov: 1, movement: 1, ap: 1 }, ['mercenary.fierceAttacker']),
  roster('soldier',     'Soldier',             'empire', 2,   { power: 2,  toughness: 7,  size: 1, lov: 2, movement: 1, ap: 1 }, ['soldier.perseverance']),
  roster('ranger',      'Ranger',              'lojrar', 2,   { power: 3,  toughness: 1,  size: 1, lov: 3, movement: 1, ap: 1 }, ['ranger.rangedAttack']),
  roster('berserker',   'Berserker',           'empire', 5,   { power: 8,  toughness: 2,  size: 1, lov: 2, movement: 1, ap: 1 }, ['berserker.savagery']), // R20: was 12/2
  roster('rogue',       'Rogue',               'lojrar', 5,   { power: 7,  toughness: 4,  size: 1, lov: 3, movement: 2, ap: 2 }, ['rogue.stealth', 'rogue.assault']),
  roster('priestess',   'Priestess',           'empire', 10,  { power: 3,  toughness: 15, size: 1, lov: 2, movement: 2, ap: 2 }, ['priestess.strongAura', 'priestess.sharedWounds']),
  roster('juliomancer', 'Juliomancer',         'lojrar', 10,  { power: 3,  toughness: 15, size: 1, lov: 3, movement: 1, ap: 2 }, ['juliomancer.mindsEye', 'juliomancer.julioVernification']),
  roster('paladin',     'Paladin',             'empire', 20,  { power: 10, toughness: 18, size: 1, lov: 2, movement: 3, ap: 2 }, ['paladin.reinforcedArmor']), // R21: was 12/20
  roster('artificer',   'Artificer',           'lojrar', 20,  { power: 1,  toughness: 15, size: 1, lov: 3, movement: 2, ap: 1 }, ['artificer.mindsEye', 'artificer.prototypeNoAcb', 'artificer.madInventor', 'artificer.tripMine']),
  roster('royalWizard', 'Royal Wizard',        'empire', 50,  { power: 10, toughness: 24, size: 1, lov: 3, movement: 1, ap: 3 }, ['royalWizard.forcefield', 'royalWizard.pajazon']), // R25: was 10/20
  roster('beast',       'Beast of Knorund',    'lojrar', 50,  { power: 20, toughness: 40, size: 2, lov: 2, movement: 2, ap: 3 }, ['beast.forcefulSlam', 'beast.feast']),
  roster('emissary',    'Celestial Emissary',  'empire', 100, { power: 15, toughness: 50, size: 1, lov: 4, movement: 2, ap: 4 }, ['emissary.holyBlessing', 'emissary.smite', 'emissary.holyFervor']),
  roster('scourge',     'Scourge of the Gods', 'lojrar', 100, { power: 15, toughness: 33, size: 1, lov: 3, movement: 2, ap: 3 }, ['scourge.commandAura', 'scourge.tribute']),
]

/**
 * A7-01 / A7-02: the base commander, a full unit with no type. Owner ruling R8: 1/5, Movement 2, AP 1, LOV 3 (the
 * spec's literal L32 values were 1/1 and Movement 1). Named commanders override some stats in commanders.ts.
 */
export const COMMANDER_UNIT: UnitDef = {
  id: 'commander',
  name: 'Commander',
  faction: null,
  tier: null,
  cost: 0,
  power: 1,
  toughness: COMMANDER_BASE_TOUGHNESS,
  size: 1,
  lov: 3,
  movement: COMMANDER_MOVEMENT,
  ap: 1,
  attackRange: 1,
  vanguard: false,
  deployable: true,
  abilities: [],
  symbol: 'commander',
}

/** A8-14: Prototype No-ACB, created by the Artificer (L99). */
export const NO_ACB_UNIT: UnitDef = {
  id: 'noAcb',
  name: 'Prototype No-ACB',
  faction: null,
  tier: null,
  cost: 0,
  power: 0,
  toughness: 7,
  size: 1,
  lov: 1,
  movement: 0,
  ap: 1,
  attackRange: 1,
  vanguard: false,
  deployable: false,
  abilities: [],
  symbol: 'noAcb',
}

/** A8-16: the Trip Mine B20 object (not a unit). */
export const TRIP_MINE = {
  name: 'Trip Mine B20',
  damage: MINE_DAMAGE,
  largeBonus: MINE_LARGE_BONUS,
  largeMinSize: MINE_LARGE_MIN_SIZE,
} as const

const ALL_UNITS: readonly UnitDef[] = [...ROSTER, COMMANDER_UNIT, NO_ACB_UNIT]
const BY_ID = new Map<UnitTypeId, UnitDef>(ALL_UNITS.map((u) => [u.id, u]))

export function unitDef(id: UnitTypeId): UnitDef {
  const def = BY_ID.get(id)
  if (def === undefined) throw new Error(`Unknown unit type: ${id}`)
  return def
}

export const ROSTER_IDS: readonly RosterUnitId[] = ROSTER.map((u) => u.id as RosterUnitId)

export function isRosterUnit(id: string): id is RosterUnitId {
  return (ROSTER_IDS as readonly string[]).includes(id)
}
