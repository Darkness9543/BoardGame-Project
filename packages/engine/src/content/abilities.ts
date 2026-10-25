// Declarative ability data: name, kind, cost, cooldown, numeric parameters and card text. The rules code
// (abilities/units/*.ts) reads its numbers from `params`, and cards render `text` from the same params,
// so the rule and its description can't drift (S26, PX G-03). Texts carry the S26 typo fixes.

import {
  BABA_CAULDRON_COST,
  BABA_CAULDRON_PER_TURN,
  BABA_CAULDRON_PER_UNIT,
  BABA_HEX_RANGE,
  BABA_HEX_REDUCTION,
  BABA_HEX_TOUGHNESS,
  BABA_MEND_COST,
  BABA_MEND_HEAL,
  BABA_MEND_MAX_PER_UNIT,
  BABA_MEND_USES_PER_TURN,
  COMMAND_AURA_RANGE,
  DUMMY_CAP,
  DUMMY_MOVE,
  JULIO_DAMAGE_CAP,
  KULEGA_HEAL_CAP,
  MINE_CAP,
  QUESO_BEACON_HEAL,
  QUESO_REVIVE_COST,
  SCOURGE_AP_BONUS,
  SMITE_SPLASH,
  TRILL_COMMANDER_TOUGHNESS,
  TRILL_TOUGHNESS_BONUS,
  MINE_DAMAGE,
  MINE_LARGE_BONUS,
  PAJAZON_CENTRE_RANGE,
  PAJAZON_DURATION,
  RATASIUS_DETECTION_RANGE,
  RATASIUS_WEAKNESS,
  RATASIUS_WEAKNESS_RANGE,
  SHARED_WOUNDS_COST,
} from '../constants'
import { TIERS, type AbilityId, type Tier } from '../types'

/** passive = always on, no action; active = declared by the player; triggered = fires by itself (8.0). */
export type AbilityKind = 'passive' | 'active' | 'triggered'

export interface AbilityData {
  readonly id: AbilityId
  readonly name: string
  readonly kind: AbilityKind
  /** AP price; 'unit' = the unit's own AP cost (Shared wounds, A2-12); null = not declared. */
  readonly apCost: number | 'unit' | null
  /** Uses one of the unit's actions (A2-06). Savagery and Baba Yaga's regeneration don't (A2-11). */
  readonly usesAction: boolean
  /** CD N in own turns (A2-22); 0 = none. */
  readonly cooldown: number
  /** Max uses per unit per own turn; null = limited only by actions. */
  readonly usesPerTurn: number | null
  /** May be used again in the turn it was used despite its cooldown ("Can be applied twice", A2-22). */
  readonly sameTurnReuse: boolean
  readonly params: Readonly<Record<string, number>>
  /** Card text; {param} placeholders are filled from params. */
  readonly text: string
  readonly assumptions: readonly string[]
}

type Spec = Partial<Omit<AbilityData, 'id' | 'name' | 'kind' | 'text'>> & Pick<AbilityData, 'name' | 'kind' | 'text'>

function passive(id: AbilityId, spec: Omit<Spec, 'kind'>): AbilityData {
  return build(id, { ...spec, kind: 'passive' })
}
function triggered(id: AbilityId, spec: Omit<Spec, 'kind'>): AbilityData {
  return build(id, { ...spec, kind: 'triggered' })
}
function active(id: AbilityId, spec: Omit<Spec, 'kind'>): AbilityData {
  return build(id, { usesAction: true, ...spec, kind: 'active' })
}
function build(id: AbilityId, spec: Spec): AbilityData {
  return {
    id,
    name: spec.name,
    kind: spec.kind,
    apCost: spec.apCost ?? null,
    usesAction: spec.usesAction ?? false,
    cooldown: spec.cooldown ?? 0,
    usesPerTurn: spec.usesPerTurn ?? null,
    sameTurnReuse: spec.sameTurnReuse ?? false,
    params: spec.params ?? {},
    text: spec.text,
    assumptions: spec.assumptions ?? [],
  }
}

export const ABILITY_DATA: readonly AbilityData[] = [
  // ---- Footman (8.1)
  passive('footman.lineFormation', {
    name: 'Line Formation',
    params: { allies: 2, reduction: 2 },
    text: 'If {allies} other Footmen are adjacent to this unit, reduce the incoming damage by {reduction} (not below 1).',
    assumptions: ['A8-01'],
  }),
  // ---- Mercenary (8.2)
  passive('mercenary.fierceAttacker', {
    name: 'Fierce Attacker',
    params: { perMercenary: 1 },
    text: 'Deal {perMercenary} extra damage for each other Mercenary that is adjacent to the attacked unit.',
    assumptions: ['A8-02'],
  }),
  // ---- Soldier (8.3)
  passive('soldier.perseverance', {
    name: 'Perseverance',
    params: { heal: 1 },
    text: 'Regenerate {heal} toughness at the end of your turn.',
    assumptions: ['A8-03'],
  }),
  passive('soldier.lockstep', {
    name: 'Lockstep',
    params: {},
    text: 'Can march with units of any type. (Other units march only with units of their own type.)',
    assumptions: ['R46'],
  }),
  // ---- Ranger (8.4)
  passive('ranger.rangedAttack', {
    name: 'Ranged Attack',
    params: { range: 2 },
    text: "This unit's attack has a range of {range}. It may target an empty square, which sets off a mine there.",
    assumptions: ['A8-04', 'A2-18'],
  }),
  // ---- Berserker (8.5): passive permission with a paid extra attack (A2-11)
  active('berserker.savagery', {
    name: 'Savagery',
    apCost: 2,
    usesAction: false,
    usesPerTurn: 1,
    params: {},
    text: 'After attacking with the Berserker, you can spend {apCost} AP to attack an additional time. Only once per turn.',
    assumptions: ['A8-05', 'A2-11'],
  }),
  // ---- Rogue (8.6)
  active('rogue.stealth', {
    name: 'Stealth',
    apCost: 1,
    params: {},
    text:
      'Only usable if this unit is not inside the LOV of an enemy unit. This unit becomes invisible. It is revealed when it is ' +
      '1 square away from an enemy unit, or when it receives damage inside enemy LOV.',
    assumptions: ['A8-06', 'A4-05', 'A4-06', 'A4-07', 'A4-08'],
  }),
  triggered('rogue.assault', {
    name: 'Assault',
    apCost: 0,
    params: {},
    text:
      'When an enemy unit comes into the melee range of this unit while this unit is in stealth, perform an automatic attack ' +
      "on the entering unit without spending AP. (This can also occur in the opponent's turn.)",
    assumptions: ['A8-07'],
  }),
  // ---- Priestess (8.7)
  passive('priestess.strongAura', {
    name: 'Strong Aura',
    params: { power: 1, toughness: 1 },
    text: 'Units adjacent to the Priestess gain {power} additional Power and {toughness} toughness.',
    assumptions: ['A8-08', 'A3-11'],
  }),
  active('priestess.sharedWounds', {
    name: 'Shared Wounds',
    apCost: SHARED_WOUNDS_COST,
    params: {},
    text:
      'Sacrifice half (rounded up) of the toughness of an adjacent unit (or of the Priestess). Heal another unit (or the ' +
      "Priestess) by that number, but not above the unit's base toughness.",
    assumptions: ['A8-09', 'A3-08', 'R19'],
  }),
  // ---- Juliomancer (8.8)
  passive('juliomancer.mindsEye', {
    name: "Mind's Eye",
    params: {},
    text: 'This unit reveals invisible units in its LOV.',
    assumptions: ['A8-10', 'A4-11'],
  }),
  active('juliomancer.julioVernification', {
    name: 'Julio Vernification',
    apCost: 2,
    params: { range: 2, cap: JULIO_DAMAGE_CAP },
    text: 'Sacrifice an adjacent unit. Deal damage equal to its current toughness (at most {cap}) to a unit in range {range}.',
    assumptions: ['A8-11', 'A3-13', 'R14', 'R22'],
  }),
  // ---- Paladin (8.9)
  passive('paladin.reinforcedArmor', {
    name: 'Reinforced Armor',
    params: { reduction: 2 }, // R21: was 3
    text: 'Reduce all damage dealt to this unit by {reduction} (not below 1).',
    assumptions: ['A8-12', 'R21'],
  }),
  // ---- Artificer (8.10)
  passive('artificer.mindsEye', {
    name: "Mind's Eye",
    params: {},
    text: 'This unit reveals invisible units in its LOV.',
    assumptions: ['A8-10', 'A4-11'],
  }),
  active('artificer.prototypeNoAcb', {
    name: 'Prototype No-ACB',
    apCost: 2,
    params: {},
    text:
      "Create a dummy unit in a free adjacent square. It's a 0/7 unit, it cannot move and has a LOV of 1 and AP 1. A maximum " +
      `of ${DUMMY_CAP(1)} dummies can be active at the same time (all Artificers; every two Artificers beyond the first one ` +
      'increase this limit by 1).',
    assumptions: ['A8-13', 'A8-14'],
  }),
  passive('artificer.madInventor', {
    name: 'Mad Inventor',
    params: { power: 1, movement: DUMMY_MOVE },
    text:
      'No-ACB prototypes can move when adjacent to any allied Artificer and gain {power} Power. (This effect disappears when the ' +
      'Artificer steps out of range.)',
    assumptions: ['A8-15'],
  }),
  active('artificer.tripMine', {
    name: 'Trip Mine B20',
    apCost: 2,
    params: { damage: MINE_DAMAGE, largeBonus: MINE_LARGE_BONUS },
    text:
      'Deploy an invisible mine in a free adjacent square. It explodes when any unit steps on it, dealing {damage} damage, ' +
      `+{largeBonus} if the unit has a size of 2 or greater. A maximum of ${MINE_CAP(1)} mines can be active at the same time (all ` +
      'Artificers; each Artificer beyond the first one increases this limit by 1). Mines can be triggered from a distance by ' +
      'attacking the square with a ranged attack.',
    assumptions: ['A8-16', 'A8-17'],
  }),
  // ---- Royal Wizard (8.11)
  active('royalWizard.forcefield', {
    name: 'Forcefield',
    apCost: 2,
    cooldown: 1,
    params: { squares: 4, reduction: 8 },
    text:
      "Choose {squares} connected squares in the Wizard's LOV. Damage received by friendly units inside the forcefield is " +
      'reduced by {reduction} (not below 1). Lasts until your next turn. CD 1.',
    assumptions: ['A8-18', 'A2-24'],
  }),
  active('royalWizard.pajazon', {
    name: 'Pajazon',
    apCost: 3,
    cooldown: 1,
    params: { centreRange: PAJAZON_CENTRE_RANGE, duration: PAJAZON_DURATION, heal: 3, damage: 3 },
    text:
      'Create a 3x3 area with its centre at range {centreRange} for {duration} turns. At the end of your turn, allied units in ' +
      "the area regenerate {heal} toughness; at the end of the opponent's turn, enemy units in the area take {damage} damage. CD 1.",
    assumptions: ['A8-19', 'A2-23'],
  }),
  // ---- Beast of Knorund (8.12)
  active('beast.forcefulSlam', {
    name: 'Forceful Slam',
    apCost: 4,
    cooldown: 1,
    params: { damage: 10, splash: 3 },
    text: 'Deal {damage} damage to an adjacent square, and {splash} damage to the 5 opposite adjacent squares of the target. CD 1.',
    assumptions: ['A8-20', 'A3-07'],
  }),
  active('beast.feast', {
    name: 'Feast',
    apCost: 2,
    params: {},
    text: 'Sacrifice an adjacent unit and gain toughness equal to its toughness.',
    assumptions: ['A8-21', 'A3-13'],
  }),
  // ---- Celestial Emissary (8.13)
  active('emissary.holyBlessing', {
    name: 'Holy Blessing',
    apCost: 3,
    params: { range: 2, heal: 5 },
    text: 'Heal allied units in a range of {range} by {heal}.',
    assumptions: ['A8-22'],
  }),
  active('emissary.smite', {
    name: 'Smite',
    apCost: 3,
    params: { range: 3, damage: 8, splash: SMITE_SPLASH },
    text: 'Deal {damage} damage to a unit at a range of {range}, and {splash} damage to each unit next to it.',
    assumptions: ['A8-23', 'R14', 'R25'],
  }),
  passive('emissary.holyFervor', {
    name: 'Holy Fervor',
    params: { extraActions: 1, surcharge: 1 },
    text: 'This unit can take 2 actions per turn. Every action after the first costs {surcharge} extra AP.',
    assumptions: ['A8-24'],
  }),
  // ---- Scourge of the Gods (8.14)
  passive('scourge.commandAura', {
    name: 'Command Aura',
    params: { range: COMMAND_AURA_RANGE, extraActions: 1 },
    text: "Units within range {range} of this unit can take an additional action each turn. Doesn't include this unit.",
    assumptions: ['A8-25'],
  }),
  passive('scourge.tribute', {
    name: 'Tribute',
    params: { ap: SCOURGE_AP_BONUS },
    text: 'While this unit is alive, you receive {ap} extra AP at the start of each of your turns.',
    assumptions: ['R25'],
  }),
  // ---- Commanders (section 7)
  passive('trill.hydrocephalic', {
    name: 'The Hydrocephalic',
    params: { toughness: TRILL_TOUGHNESS_BONUS }, // R23: was +2
    text: `All your units of type 1, 2 and 5 gain {toughness} toughness. The commander has toughness ${TRILL_COMMANDER_TOUGHNESS}.`,
    assumptions: ['A7-08', 'R23'],
  }),
  passive('kulega.finePrinter', {
    name: 'The Fine Printer',
    params: { lov: 1 },
    text: 'All your units gain {lov} LOV. Your units of type 20 gain Fine Print.',
    assumptions: ['A7-09'],
  }),
  triggered('kulega.finePrint', {
    name: 'Fine Print',
    params: { cap: KULEGA_HEAL_CAP },
    text:
      "When a unit of type 1 or 2 dies adjacent to this unit, regenerate toughness equal to that unit's toughness, maximum " +
      'of {cap} per instance.',
    assumptions: ['A7-10'],
  }),
  passive('sabrina.reelfinisher', {
    name: 'The Reelfinisher',
    params: { power: 2 },
    text:
      'Artificers and No-ACBs get {power} additional Power. Artificers are now considered type 10. Artificers can no longer ' +
      'use mines. Each other unit of type 20 and above is 20% more expensive to deploy.',
    assumptions: ['A7-11'],
  }),
  // Baba Yaga (owner ruling R11 replaces the spec's regeneration; R44: white = the Lojrar Clan units; R45: the
  // balanced numbers). One variant per army.
  active('babaYaga.mend', {
    name: 'Regenerate',
    apCost: BABA_MEND_COST,
    usesAction: false,
    usesPerTurn: BABA_MEND_MAX_PER_UNIT, // R45: at most 2 on the same unit per turn
    params: { heal: BABA_MEND_HEAL, perTurn: BABA_MEND_USES_PER_TURN },
    text:
      'Restore {heal} toughness to this unit for {apCost} AP. Not an action. At most {perTurn} uses per turn across your army, ' +
      `and at most ${BABA_MEND_MAX_PER_UNIT} on the same unit.`,
    assumptions: ['R11', 'R44', 'R45'],
  }),
  passive('babaYaga.hexWard', {
    name: 'Hex Ward',
    params: { range: BABA_HEX_RANGE, toughness: BABA_HEX_TOUGHNESS, reduction: BABA_HEX_REDUCTION },
    text: 'Your Lojrar Clan units within range {range} of Baba Yaga gain {toughness} toughness and take {reduction} less damage (not below 1).',
    assumptions: ['R11', 'R44', 'R45', 'A3-11'],
  }),
  triggered('babaYaga.cauldron', {
    name: 'Cauldron',
    params: { perTurn: BABA_CAULDRON_PER_TURN, perUnit: BABA_CAULDRON_PER_UNIT },
    text:
      `When one of your Lojrar Clan units dies, you may pay AP by its type (${cauldronCostText()}) to return it at full ` +
      'toughness to a free square adjacent to Baba Yaga. At most {perTurn} returns per turn and {perUnit} per unit per game. ' +
      "On the opponent's turn the AP is owed.",
    assumptions: ['R11', 'R44', 'R45', 'A2-30'],
  }),
  passive('ratasius.great', {
    name: 'The Great',
    params: { detectionRange: RATASIUS_DETECTION_RANGE, weaknessRange: RATASIUS_WEAKNESS_RANGE, weakness: RATASIUS_WEAKNESS },
    text:
      'This commander has LOV 6. Reveals all invisible enemies in range of {detectionRange}. Enemies in range of ' +
      '{weaknessRange} gain weakness and deal {weakness} less damage.',
    assumptions: ['A7-14', 'A4-08', 'A4-11'],
  }),
  triggered('queso.beacon', {
    name: 'Beacon of Hope',
    params: { range: 2, heal: QUESO_BEACON_HEAL }, // R24: was 5
    text: "Your units in range of {range} regenerate {heal} toughness each of your turns (not the opponent's turn).",
    assumptions: ['A7-15', 'R24'],
  }),
  triggered('queso.revive', {
    name: 'Revive',
    params: { range: 2 },
    text:
      `When one of your units in that area dies you can choose to sacrifice max toughness (${QUESO_REVIVE_COST(100)} for a ` +
      `type-100 unit, ${QUESO_REVIVE_COST(50)} for type 50, ${QUESO_REVIVE_COST(1)} otherwise) to revive that unit with half ` +
      'of its base toughness rounded up.',
    assumptions: ['A7-16', 'A2-30', 'R18'],
  }),
]

/** R45 in words, from BABA_CAULDRON_COST: "type 1, 2 and 5: 1 AP; type 10: 2 AP; ...". */
export function cauldronCostText(): string {
  const groups: { readonly cost: number; readonly tiers: Tier[] }[] = []
  for (const tier of TIERS) {
    const cost = BABA_CAULDRON_COST(tier)
    const last = groups[groups.length - 1]
    if (last !== undefined && last.cost === cost) last.tiers.push(tier)
    else groups.push({ cost, tiers: [tier] })
  }
  const list = (tiers: readonly Tier[]): string => (tiers.length === 1 ? String(tiers[0]) : `${tiers.slice(0, -1).join(', ')} and ${tiers[tiers.length - 1]}`)
  return groups.map((g) => `type ${list(g.tiers)}: ${g.cost} AP`).join('; ')
}

const BY_ID = new Map<AbilityId, AbilityData>(ABILITY_DATA.map((a) => [a.id, a]))

export function abilityData(id: AbilityId): AbilityData {
  const data = BY_ID.get(id)
  if (data === undefined) throw new Error(`Unknown ability: ${id}`)
  return data
}

export function hasAbilityData(id: AbilityId): boolean {
  return BY_ID.has(id)
}

/** A numeric parameter of an ability (throws if the table lacks it, so typos fail fast). */
export function abilityParam(id: AbilityId, key: string): number {
  const value = abilityData(id).params[key]
  if (value === undefined) throw new Error(`Ability ${id} has no param ${key}`)
  return value
}

/** Card text with its {param} placeholders filled in. */
export function abilityText(id: AbilityId): string {
  const data = abilityData(id)
  return data.text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    if (key === 'apCost') return typeof data.apCost === 'number' ? String(data.apCost) : whole
    const value = data.params[key]
    return value === undefined ? whole : String(value)
  })
}
