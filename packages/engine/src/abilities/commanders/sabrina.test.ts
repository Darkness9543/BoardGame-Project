import { describe, expect, it } from 'vitest'
import { checkArmy } from '../../army'
import { validate } from '../../commands'
import { DUMMY_CAP } from '../../constants'
import { abilityText } from '../../content/abilities'
import { commanderDef } from '../../content/commanders'
import { abilitiesFor, unitCost } from '../../content/derived'
import { ROSTER_IDS, unitDef } from '../../content/units'
import { parseSquare } from '../../geometry'
import { legalActions } from '../../preview'
import { DEFAULT_SETTINGS } from '../../state'
import { act, buildBattle, sqs, unitIn } from '../../testing/dsl'
import { projectView } from '../../view'
import { registerAbility } from '../registry'

// Test-local stand-in for Mad inventor (A8-15, another agent's stub): a dummy adjacent to an own Artificer gets +1 Power
// and Movement 1.
registerAbility(
  {
    id: 'artificer.madInventor',
    status: 'implemented',
    modifyStats: (q, holder, target) =>
      target.type === 'noAcb' && target.owner === holder.owner && q.isAdjacent(holder, target) ? { power: 1, movement: 1 } : null,
  },
  { replace: true },
)

describe('sabrina.reelfinisher (7.6, A7-11)', () => {
  it('gives own Artificers and dummies +2 Power and nothing to the enemy or other units; Artificers show as type 10', () => {
    const b = buildBattle({
      south: ['artificer@E5:A', 'noAcb@G5:D', 'mercenary@I5:M'],
      north: ['artificer@E20:EA', 'noAcb@G20:ED'],
      commanders: { south: 'sabrina' },
    })
    const unit = (label: string, seat = b.south) => projectView(b.state, seat).units.find((u) => u.id === b.id(label))
    expect(unit('A')).toMatchObject({ power: 3, maxToughness: 15, tier: 10 })
    expect(unit('D')).toMatchObject({ power: 2, maxToughness: 7, tier: null })
    expect(unit('M')).toMatchObject({ power: 2, maxToughness: 1, tier: 1 })
    expect(unit('EA', b.north)).toMatchObject({ power: 1, tier: 20 })
    expect(unit('ED', b.north)).toMatchObject({ power: 0 })
  })

  it('prices Artificers at 10 and every other unit of type 20 or more at x1.2 rounded up; nothing else changes (SAB-1, SAB-2)', () => {
    const prices = Object.fromEntries(ROSTER_IDS.map((t) => [t, unitCost(t, 'sabrina')]))
    expect(prices).toEqual({
      footman: 1, mercenary: 1, soldier: 2, ranger: 2, berserker: 5, rogue: 5, priestess: 10, juliomancer: 10,
      paladin: 24, artificer: 10, royalWizard: 60, beast: 60, emissary: 120, scourge: 120,
    })
    for (const type of ROSTER_IDS) expect(unitCost(type, 'kulega')).toBe(unitDef(type).cost)
  })

  it('re-prices army validation (SAB-4, X-16): 20 Artificers fit the budget, two Scourges no longer do', () => {
    expect(checkArmy({ faction: 'lojrar', commander: 'sabrina', units: { artificer: 20 } }, DEFAULT_SETTINGS)).toMatchObject({ ok: true, cost: 200 })
    expect(DUMMY_CAP(20)).toBe(12) // SAB-7: 20 Artificers allow 3 + floor(19 / 2) dummies
    expect(checkArmy({ faction: 'lojrar', commander: 'sabrina', units: { artificer: 21 } }, DEFAULT_SETTINGS).errors).toContain('Over budget: 210 of 200')
    expect(checkArmy({ faction: 'lojrar', commander: 'kulega', units: { scourge: 2 } }, DEFAULT_SETTINGS)).toMatchObject({ ok: true, cost: 200 })
    expect(checkArmy({ faction: 'lojrar', commander: 'sabrina', units: { scourge: 2 } }, DEFAULT_SETTINGS)).toMatchObject({ ok: false, cost: 240 })
    expect(checkArmy({ faction: 'empire', commander: 'sabrina', units: { paladin: 1, royalWizard: 1, emissary: 1 } }, DEFAULT_SETTINGS)).toMatchObject({ ok: false, cost: 204 })
    expect(checkArmy({ faction: 'empire', commander: 'trill', units: { paladin: 1, royalWizard: 1, emissary: 1 } }, DEFAULT_SETTINGS)).toMatchObject({ ok: true, cost: 170 })
  })

  it('takes Trip Mine away from her Artificers only (SAB-5): it is not on the ability bar and cannot be used', () => {
    const b = buildBattle({ south: ['artificer@E5:A'], commanders: { south: 'sabrina' } })
    const view = projectView(b.state, b.south)
    expect(view.units.find((u) => u.id === b.id('A'))?.own?.abilities).toEqual(['artificer.mindsEye', 'artificer.prototypeNoAcb', 'artificer.madInventor'])
    expect(legalActions(view, b.id('A')).some((o) => o.abilityId === 'artificer.tripMine')).toBe(false)
    expect(validate(b.state, b.south, { kind: 'useAbility', unitId: b.id('A'), abilityId: 'artificer.tripMine', targets: [{ kind: 'square', square: parseSquare('E6') }] })).toMatchObject({
      ok: false,
      code: 'UNKNOWN_ABILITY',
    })
    expect(abilitiesFor('artificer', 'kulega')).toContain('artificer.tripMine')
  })

  it('lets a dummy attack with its 2 Power (A2-19), where a dummy without Sabrina cannot', () => {
    const b = buildBattle({ south: ['noAcb@E5:D'], north: ['soldier@E6:S'], commanders: { south: 'sabrina' } })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('D'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7 - 2)
    const plain = buildBattle({ south: ['noAcb@E5:D'], north: ['soldier@E6:S'] })
    expect(validate(plain.state, plain.south, { kind: 'attack', unitId: plain.id('D'), target: { kind: 'unit', unitId: plain.id('S') } })).toMatchObject({ ok: false, code: 'NO_POWER' })
  })

  it('raises attack damage but never the AP cost (SAB-3, A2-32)', () => {
    const b = buildBattle({ south: ['artificer@E5:A'], north: ['soldier@E6:S'], commanders: { south: 'sabrina' } })
    expect(projectView(b.state, b.south).units.find((u) => u.id === b.id('A'))?.own?.apCost).toBe(1)
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('A'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7 - 3)
    expect(r.state.seats[b.south].ap).toBe(20 - 1)
  })

  it('adds up with Mad inventor and the Keep (B24 under R31): a dummy hits for 0 + 2 + 1 + 1 = 4', () => {
    const b = buildBattle({ south: ['artificer@E4:A', 'noAcb@E5:D'], north: ['soldier@E6:S'], commanders: { south: 'sabrina' }, control: { keep: 'south' } })
    expect(projectView(b.state, b.south).units.find((u) => u.id === b.id('D'))?.power).toBe(4)
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('D'), target: { kind: 'unit', unitId: b.id('S') } })
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(7 - 4)
  })

  it('counts her Artificers as type 10 for every rule: they get no Market action (6.6), a Mercenary does', () => {
    const b = buildBattle({ south: ['artificer@E5:A', 'mercenary@G5:M'], commanders: { south: 'sabrina' }, control: { market: 'south' } })
    const defended = act(b.state, b.south, { kind: 'defend', unitId: b.id('A') }).state
    expect(validate(defended, b.south, { kind: 'move', unitId: b.id('A'), path: sqs('E6') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
    const merc = act(b.state, b.south, { kind: 'defend', unitId: b.id('M') }).state
    expect(validate(merc, b.south, { kind: 'move', unitId: b.id('M'), path: sqs('G6') }).ok).toBe(true)
  })

  it('renders her texts from the same numbers (R35)', () => {
    expect(abilityText('sabrina.reelfinisher')).toContain('get 2 additional Power')
    expect(commanderDef('sabrina').text).toContain('type 10')
    expect(commanderDef('sabrina').text).toContain('20% more expensive')
  })
})
