import { describe, expect, it } from 'vitest'
import { TRILL_COMMANDER_TOUGHNESS, TRILL_TOUGHNESS_BONUS } from '../../constants'
import { abilityText } from '../../content/abilities'
import { area3x3, parseSquare, sameSquare } from '../../geometry'
import { replay } from '../../history'
import { act, buildBattle, sqs, startMatch, unitIn } from '../../testing/dsl'
import type { GameState, Seat, UnitId } from '../../types'
import { projectView } from '../../view'
import { registerAbility } from '../registry'

// Test-local stand-ins for other agents' stubs, for X-21: Line Formation (A8-01) and an enemy Pajazon tick (A8-19).
registerAbility(
  {
    id: 'footman.lineFormation',
    status: 'implemented',
    targetReduction: (q, holder, hit) =>
      hit.target.id === holder.id && q.adjacentUnits(holder).filter((u) => u.owner === holder.owner && u.type === 'footman').length >= 2 ? 2 : 0,
  },
  { replace: true },
)
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) =>
        ending === area.owner
          ? null
          : { damage: q.units().filter((u) => u.owner === ending && q.footprint(u).some((s) => area.squares.some((a) => sameSquare(a, s)))).map((u) => ({ target: u.id, amount: 3 })) },
    },
  },
  { replace: true },
)

function viewed(state: GameState, seat: Seat, id: UnitId) {
  const unit = projectView(state, seat).units.find((u) => u.id === id)
  if (unit === undefined) throw new Error(`unit ${id} not in view`)
  return { toughness: unit.toughness, maxToughness: unit.maxToughness, baseToughness: unit.own?.baseToughness ?? null }
}

describe('trill.hydrocephalic (7.4, A7-08; +1 and commander 6 under owner ruling R23)', () => {
  it('gives own units of type 1, 2 and 5 +1 base, max and current toughness, in either faction (R7)', () => {
    // Units stand apart so that no other unit's aura (Strong aura, Line Formation) touches them.
    const b = buildBattle({
      south: ['footman@E5:F', 'soldier@G5:S', 'berserker@I5:B', 'priestess@K5:P', 'paladin@M5:PAL'],
      north: ['mercenary@E20:M', 'ranger@G20:R', 'rogue@I20:RO', 'juliomancer@K20:J', 'artificer@M20:A'],
      commanders: { south: 'trill', north: 'trill' },
    })
    const bonus = TRILL_TOUGHNESS_BONUS
    const expected: [string, Seat, number][] = [
      ['F', b.south, 2 + bonus],
      ['S', b.south, 7 + bonus],
      ['B', b.south, 2 + bonus],
      ['P', b.south, 15],
      ['PAL', b.south, 18],
      ['M', b.north, 1 + bonus],
      ['R', b.north, 1 + bonus],
      ['RO', b.north, 4 + bonus],
      ['J', b.north, 15],
      ['A', b.north, 15],
    ]
    for (const [label, seat, toughness] of expected) {
      expect(viewed(b.state, seat, b.id(label)), label).toEqual({ toughness, maxToughness: toughness, baseToughness: toughness })
    }
  })

  it('leaves the opponent, dummies and the commander alone; the commander is 1/6 by content (R23)', () => {
    const b = buildBattle({ south: ['commander@E3:C', 'noAcb@F5:D'], north: ['footman@E20:EF'], commanders: { south: 'trill' } })
    expect(viewed(b.state, b.north, b.id('EF')).maxToughness).toBe(2)
    expect(viewed(b.state, b.south, b.id('D')).maxToughness).toBe(7) // no type (TRI-3)
    expect(viewed(b.state, b.south, b.id('C')).maxToughness).toBe(TRILL_COMMANDER_TOUGHNESS)
    expect(projectView(b.state, b.south).units.find((u) => u.id === b.id('C'))?.power).toBe(1)
  })

  it('creates the units at the raised toughness when deployment starts, and they start the battle with it', () => {
    const record = startMatch({
      armies: {
        host: { faction: 'empire', commander: 'trill', units: { footman: 2, soldier: 1, berserker: 1, paladin: 1 } },
        guest: { faction: 'lojrar', commander: 'kulega', units: { mercenary: 2 } },
      },
    })
    const toughness = (seat: Seat, type: string) => record.state.units.filter((u) => u.owner === seat && u.type === type).map((u) => u.toughness)
    expect(toughness('host', 'footman')).toEqual([3, 3])
    expect(toughness('host', 'soldier')).toEqual([8])
    expect(toughness('host', 'berserker')).toEqual([3])
    expect(toughness('host', 'paladin')).toEqual([18])
    expect(toughness('host', 'commander')).toEqual([6])
    expect(toughness('guest', 'mercenary')).toEqual([1, 1])

    const start = record.log.findIndex((e) => e.intent.kind === 'startDeployment')
    const deployment = replay(record.initial, record.log.slice(0, start + 1))
    expect(deployment.phase).toBe('deployment')
    expect(deployment.units.filter((u) => u.owner === 'host' && u.type === 'footman').map((u) => u.toughness)).toEqual([3, 3])
  })

  it('is carried by each type 1, 2 and 5 unit, so it lasts the whole game, even on the final board after Trill falls (7.3)', () => {
    const b = buildBattle({ south: ['commander@M3:C', 'footman@E5:F', 'priestess@G5:P'], north: ['berserker@M4:B'], commanders: { south: 'trill' }, active: 'north' })
    const abilities = (label: string) => projectView(b.state, b.south).units.find((u) => u.id === b.id(label))?.own?.abilities
    expect([abilities('F'), abilities('C'), abilities('P')]).toEqual([['footman.lineFormation', 'trill.hydrocephalic'], [], ['priestess.strongAura', 'priestess.sharedWounds']])
    const r = act(b.state, b.north, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('C') } })
    expect(r.state.result).toMatchObject({ winner: b.north, reason: 'conquest' })
    expect(projectView(r.state, b.south).units.find((u) => u.id === b.id('F'))).toMatchObject({ toughness: 3, maxToughness: 3 })
  })

  it('is permanent base toughness, so healing caps at the raised max (TRI-1)', () => {
    const b = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: 7 }], commanders: { south: 'trill' } })
    const r = act(b.state, b.south, { kind: 'endTurn' }) // Perseverance +1
    expect(unitIn(r.state, b.id('S'))?.toughness).toBe(8)
    const plain = buildBattle({ south: [{ type: 'soldier', at: 'E5', label: 'S', toughness: 7 }] })
    expect(unitIn(act(plain.state, plain.south, { kind: 'endTurn' }).state, plain.id('S'))?.toughness).toBe(7)
  })

  it('lets the 1/6 Trill commander survive its own mine, which kills a 1/5 commander (X-17, TRI-5 under R8 / R23)', () => {
    const trill = buildBattle({ south: ['commander@E3:C'], commanders: { south: 'trill' }, mines: [{ owner: 'south', at: 'E4' }] })
    const r = act(trill.state, trill.south, { kind: 'move', unitId: trill.id('C'), path: sqs('E4') })
    expect(unitIn(r.state, trill.id('C'))?.toughness).toBe(1)
    expect(r.state.result).toBeNull()

    const base = buildBattle({ south: ['commander@E3:C'], mines: [{ owner: 'south', at: 'E4' }] })
    const r2 = act(base.state, base.south, { kind: 'move', unitId: base.id('C'), path: sqs('E4') })
    expect(r2.state.result).toMatchObject({ winner: base.north, reason: 'conquest' })
  })

  describe('X-21 under R23: a 1/3 Trill Footman in formation', () => {
    it('takes 1 per Pajazon tick, while Footmen outside the formation take the full 3 (3.4: judged on the board before)', () => {
      const b = buildBattle({ south: ['footman@D5:L', 'footman@E5:MID', 'footman@F5:R'], commanders: { south: 'trill' } })
      b.state.areas.push({ id: 'a-x21', abilityId: 'royalWizard.pajazon', owner: b.north, sourceId: null, squares: area3x3(parseSquare('E5')), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 90, data: {} })
      const r = act(b.state, b.south, { kind: 'endTurn' })
      expect(unitIn(r.state, b.id('MID'))?.toughness).toBe(3 - 1)
      expect(unitIn(r.state, b.id('L'))).toBeUndefined()
      expect(unitIn(r.state, b.id('R'))).toBeUndefined()
    })

    it('takes 3 from a mine, which now kills it (a 1/4 Footman under the old +2 survived)', () => {
      const b = buildBattle({ south: ['footman@D6', 'footman@F6', 'footman@E5:X'], commanders: { south: 'trill' }, mines: [{ owner: 'north', at: 'E6' }] })
      const r = act(b.state, b.south, { kind: 'move', unitId: b.id('X'), path: sqs('E6') })
      const hit = r.events.find((e) => e.type === 'unitDamaged' && e.unitId === b.id('X'))
      expect(hit).toMatchObject({ amount: 5 - 2, kind: 'mine' })
      expect(unitIn(r.state, b.id('X'))).toBeUndefined()
    })
  })

  it('renders its card text from the ruled numbers (R35)', () => {
    expect(abilityText('trill.hydrocephalic')).toBe(`All your units of type 1, 2 and 5 gain ${TRILL_TOUGHNESS_BONUS} toughness. The commander has toughness ${TRILL_COMMANDER_TOUGHNESS}.`)
  })
})
