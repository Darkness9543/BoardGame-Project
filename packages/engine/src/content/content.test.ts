import { describe, expect, it } from 'vitest'
import { allAbilityDefinitions, getAbility } from '../abilities/registry'
import { CORNER_RULE } from '../constants'
import { ABILITY_DATA, abilityText } from './abilities'
import { COMMANDERS, commanderDef } from './commanders'
import { abilitiesFor, tierFor, unitCost } from './derived'
import { availableRoster, factionDef } from './factions'
import { SCENARIOS } from './scenarios'
import { COMMANDER_UNIT, NO_ACB_UNIT, ROSTER, unitDef } from './units'

describe('unit lines (spec digit by digit, with owner rulings R8, R20, R21, R25)', () => {
  // Name, Power/Toughness, Size, LOV, Movement, AP
  it.each([
    ['footman', 1, 2, 1, 1, 1, 1, 1],
    ['mercenary', 2, 1, 1, 1, 1, 1, 1],
    ['soldier', 2, 7, 1, 2, 1, 1, 2],
    ['ranger', 3, 1, 1, 3, 1, 1, 2],
    ['berserker', 8, 2, 1, 2, 1, 1, 5], // R20 (spec 12/2)
    ['rogue', 7, 4, 1, 3, 2, 2, 5],
    ['priestess', 3, 15, 1, 2, 2, 2, 10],
    ['juliomancer', 3, 15, 1, 3, 1, 2, 10],
    ['paladin', 10, 18, 1, 2, 3, 2, 20], // R21 (spec 12/20)
    ['artificer', 1, 15, 1, 3, 2, 1, 20],
    ['royalWizard', 10, 24, 1, 3, 1, 3, 50], // R25 (spec 10/20)
    ['beast', 20, 40, 2, 2, 2, 3, 50],
    ['emissary', 15, 50, 1, 4, 2, 4, 100],
    ['scourge', 15, 33, 1, 3, 2, 3, 100],
    ['commander', 1, 5, 1, 3, 2, 1, null], // owner ruling R8 (the spec's L32 had 1/1, Movement 1)
    ['noAcb', 0, 7, 1, 1, 0, 1, null],
  ] as const)('%s is %i/%i size %i LOV %i Mv %i AP %i tier %s', (id, power, toughness, size, lov, movement, ap, tier) => {
    const def = unitDef(id)
    expect([def.power, def.toughness, def.size, def.lov, def.movement, def.ap, def.tier]).toEqual([power, toughness, size, lov, movement, ap, tier])
    expect(def.cost).toBe(tier ?? 0) // A5-01: cost = tier
  })

  it('splits the 14 units into two 7-unit home rosters, one unit per tier each (owner ruling R4)', () => {
    expect(ROSTER).toHaveLength(14)
    expect(factionDef('empire').roster).toEqual(['footman', 'soldier', 'berserker', 'priestess', 'paladin', 'royalWizard', 'emissary'])
    expect(factionDef('lojrar').roster).toEqual(['mercenary', 'ranger', 'rogue', 'juliomancer', 'artificer', 'beast', 'scourge'])
    for (const faction of ['empire', 'lojrar'] as const) {
      expect(new Set(factionDef(faction).roster.map((id) => unitDef(id).tier)).size).toBe(7)
    }
  })

  it('offers all 14 units to every army, whatever its banner (owner ruling R43)', () => {
    for (const faction of ['empire', 'lojrar'] as const) expect(availableRoster(faction)).toEqual(ROSTER.map((u) => u.id))
  })

  it('marks only the Rogue and the Ranger as Vanguard (A5-04) and never deploys dummies', () => {
    expect(ROSTER.filter((u) => u.vanguard).map((u) => u.id)).toEqual(['ranger', 'rogue'])
    expect(COMMANDER_UNIT.vanguard).toBe(false)
    expect(NO_ACB_UNIT.deployable).toBe(false)
  })
})

describe('commanders (section 7, owner rulings R7, R8, R11)', () => {
  it.each([
    ['trill', 'A', 1, 6, 3, 2, 1], // R23
    ['kulega', 'A', 1, 5, 3, 2, 1],
    ['sabrina', 'A', 1, 5, 3, 2, 1],
    ['babaYaga', 'B', 1, 6, 3, 2, 1], // R45
    ['ratasius', 'B', 1, 5, 6, 2, 1],
    ['queso', 'B', 1, 6, 3, 2, 2], // R8, R17
  ] as const)('%s (group %s) is %i/%i LOV %i Mv %i AP %i', (id, group, power, toughness, lov, movement, ap) => {
    const c = commanderDef(id)
    expect(c.group).toBe(group)
    expect([c.stats.power, c.stats.toughness, c.stats.lov, c.stats.movement, c.stats.ap]).toEqual([power, toughness, lov, movement, ap])
    expect(c.selectable).toBe(true)
  })

  it('gives Baba Yaga three variants with their own abilities (R11); "white" = the Lojrar Clan units (R44)', () => {
    expect(commanderDef('babaYaga').variants.map((v) => v.id)).toEqual(['mend', 'hex-ward', 'cauldron'])
    for (const type of ['mercenary', 'ranger', 'rogue', 'juliomancer', 'artificer', 'beast', 'scourge'] as const) {
      expect(abilitiesFor(type, 'babaYaga', 'mend')).toContain('babaYaga.mend')
    }
    for (const type of ['footman', 'soldier', 'berserker', 'priestess', 'paladin', 'royalWizard', 'emissary', 'commander', 'noAcb'] as const) {
      expect(abilitiesFor(type, 'babaYaga', 'mend')).not.toContain('babaYaga.mend')
    }
    expect(abilitiesFor('commander', 'babaYaga', 'hex-ward')).toEqual(['babaYaga.hexWard'])
    expect(abilitiesFor('commander', 'babaYaga', 'cauldron')).toEqual(['babaYaga.cauldron'])
    expect(abilitiesFor('mercenary', 'babaYaga', 'cauldron')).not.toContain('babaYaga.mend')
  })

  it("prints Baba Yaga's R45 numbers in her variant texts", () => {
    const text = (id: string) => commanderDef('babaYaga').variants.find((v) => v.id === id)?.text ?? ''
    expect(text('mend')).toContain('restore 4 toughness')
    expect(text('mend')).toContain('at most 2 on the same unit')
    expect(text('cauldron')).toContain('type 1, 2 and 5: 1 AP; type 10: 2 AP; type 20: 4 AP; type 50: 10 AP; type 100: 20 AP')
    expect(abilityText('babaYaga.mend')).toBe('Restore 4 toughness to this unit for 1 AP. Not an action. At most 3 uses per turn across your army, and at most 2 on the same unit.')
    expect(abilityText('babaYaga.cauldron')).toContain('Lojrar Clan units')
  })

  it('applies Sabrina prices: Artificer 10, other type >= 20 x1.2 rounded up (A7-11)', () => {
    expect(['paladin', 'artificer', 'royalWizard', 'beast', 'emissary', 'scourge', 'priestess'].map((t) => unitCost(t as never, 'sabrina'))).toEqual([24, 10, 60, 60, 120, 120, 10])
    expect(unitCost('paladin', 'trill')).toBe(20)
    expect(tierFor('artificer', 'sabrina')).toBe(10)
    expect(abilitiesFor('artificer', 'sabrina')).not.toContain('artificer.tripMine')
  })

  it('grants Fine Print to type-20 units under Kulega', () => {
    expect(abilitiesFor('paladin', 'kulega')).toContain('kulega.finePrint')
    expect(abilitiesFor('artificer', 'kulega')).toContain('kulega.finePrint')
    expect(abilitiesFor('soldier', 'kulega')).not.toContain('kulega.finePrint')
  })
})

describe('ability data and definitions', () => {
  const referenced = new Set<string>([
    ...ROSTER.flatMap((u) => u.abilities),
    ...COMMANDERS.flatMap((c) => [
      ...c.abilities,
      ...c.grants.map((g) => g.ability),
      ...c.revokes.map((r) => r.ability),
      ...c.variants.flatMap((v) => [...v.abilities, ...v.grants.map((g) => g.ability)]),
    ]),
  ])

  it('has data and a definition for every referenced ability, and nothing unreferenced', () => {
    const dataIds = new Set(ABILITY_DATA.map((a) => a.id))
    const defIds = new Set(allAbilityDefinitions().map((d) => d.id))
    expect([...referenced].filter((id) => !dataIds.has(id))).toEqual([])
    expect([...referenced].filter((id) => !defIds.has(id))).toEqual([])
    expect([...dataIds].filter((id) => !referenced.has(id))).toEqual([])
  })

  it('gives every implemented active ability an active spec', () => {
    for (const data of ABILITY_DATA) {
      const def = getAbility(data.id)
      if (def?.status === 'implemented' && data.kind === 'active') expect(def.active).toBeDefined()
    }
  })

  it('implements every ability in the content table: no stub is left', () => {
    expect(ABILITY_DATA.filter((a) => getAbility(a.id)?.status !== 'implemented').map((a) => a.id)).toEqual([])
  })

  it('renders card text from the same numbers the rules use, with the S26 fixes', () => {
    expect(abilityText('paladin.reinforcedArmor')).toBe('Reduce all damage dealt to this unit by 2 (not below 1).') // R21
    expect(abilityText('soldier.perseverance')).toBe('Regenerate 1 toughness at the end of your turn.')
    expect(abilityText('berserker.savagery')).toContain('spend 2 AP')
    expect(abilityText('royalWizard.forcefield')).toContain("the Wizard's LOV")
    expect(abilityText('artificer.madInventor')).toContain('No-ACB prototypes')
    expect(abilityText('priestess.sharedWounds')).toContain("the unit's base toughness")
    expect(abilityText('rogue.assault')).toContain("opponent's turn")
    const all = ABILITY_DATA.map((a) => abilityText(a.id)).join(' ')
    expect(all).not.toMatch(/\{\w+\}/) // every placeholder filled
    expect(all).not.toMatch(/\bhp\b|health|creature|wizards LOV|Prototypes NO-ACB|opponents turn|including diagonals/)
  })

  it('records assumption ids for every ability', () => {
    for (const data of ABILITY_DATA) expect(data.assumptions.length).toBeGreaterThan(0)
  })
})

describe('scenarios', () => {
  it('use the global corner rule', () => {
    for (const s of SCENARIOS) expect(s.cornerRule).toBe(CORNER_RULE)
  })
})
