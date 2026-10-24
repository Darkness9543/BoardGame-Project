import { describe, expect, it } from 'vitest'
import { registerAbility } from './abilities/registry'
import { area3x3, parseSquare, sameSquare } from './geometry'
import { act, buildBattle, sqs } from './testing/dsl'
import { matchSummary } from './summary'
import { filterEvents } from './view'

// Test-local Pajazon stand-in: 3 damage to the enemy units in the area at the end of their turn.
registerAbility(
  {
    id: 'royalWizard.pajazon',
    status: 'implemented',
    area: {
      endOfTurn: (q, area, ending) =>
        ending === area.owner
          ? null
          : { damage: q.units().filter((u) => u.owner === ending && area.squares.some((s) => q.footprint(u).some((f) => sameSquare(f, s)))).map((u) => ({ target: u.id, amount: 3 })) },
    },
  },
  { replace: true },
)

describe('match statistics per unit type (R39)', () => {
  it('credits a mine to the Artificer that placed it', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: ['artificer@J20:ART'], mines: [{ owner: 'north', at: 'E6' }] })
    const mine = b.state.mines[0]
    if (mine === undefined) throw new Error('no mine')
    mine.placedBy = b.id('ART')
    const r = act(b.state, b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6') })
    expect(r.state.matchStats[b.north].artificer).toEqual({ damageDealt: 3, damageTaken: 0, kills: 0, losses: 0 })
    expect(r.state.matchStats[b.south].paladin).toEqual({ damageDealt: 0, damageTaken: 3, kills: 0, losses: 0 })
  })

  it("credits an area's ticks to its caster", () => {
    const b = buildBattle({ south: ['soldier@E5:S'], north: ['royalWizard@J20:W'] })
    b.state.areas.push({ id: 'a-t', abilityId: 'royalWizard.pajazon', owner: b.north, sourceId: b.id('W'), squares: area3x3(parseSquare('E5')), createdOnOwnTurn: 0, expiresAtOwnTurn: 2, seq: 90, data: {} })
    const r = act(b.state, b.south, { kind: 'endTurn' })
    expect(r.state.matchStats[b.north].royalWizard?.damageDealt).toBe(3)
  })
})

describe('the match summary (R38)', () => {
  it('is emitted to both seats right after gameEnded, with armies, result, rounds and per-type tallies', () => {
    const b = buildBattle({ south: ['berserker@M12:B'], north: ['commander@M13:C', 'mercenary@A10'], commanders: { north: 'babaYaga' }, variants: { north: 'cauldron' } })
    expect(matchSummary(b.state)).toBeNull()
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('C') } })
    for (const seat of [b.south, b.north]) {
      const types = filterEvents(r.events, seat).map((e) => e.type)
      expect(types.slice(-2)).toEqual(['gameEnded', 'matchSummary'])
    }
    const summary = matchSummary(r.state)
    expect(summary).toMatchObject({ winner: b.south, reason: 'conquest', turns: 1, rounds: 1, southSeat: b.south, scenarioId: 'openField' })
    expect(summary?.armies[b.north]).toMatchObject({ commander: 'babaYaga', variant: 'cauldron', units: { mercenary: 1 } })
    expect(summary?.commanders).toEqual({ [b.south]: 'baseline', [b.north]: 'babaYaga' })
    expect(summary?.commanderVariants).toEqual({ [b.south]: null, [b.north]: 'cauldron' })
    expect(summary?.unitTypes[b.south].berserker).toEqual({ damageDealt: 6, damageTaken: 0, kills: 1, losses: 0 }) // 8 Power on 6 toughness (R45): overkill excluded
    expect(summary?.unitTypes[b.north].commander).toEqual({ damageDealt: 0, damageTaken: 6, kills: 0, losses: 1 })
    expect(filterEvents(r.events, b.north)).toContainEqual({ type: 'matchSummary', summary })
  })

  it('summarises resignations and agreed draws too', () => {
    const b = buildBattle()
    expect(matchSummary(act(b.state, b.south, { kind: 'resign' }).state)).toMatchObject({ winner: b.north, reason: 'resignation' })
    const offered = act(b.state, b.south, { kind: 'offerDraw' }).state
    expect(matchSummary(act(offered, b.north, { kind: 'acceptDraw' }).state)).toMatchObject({ winner: null, reason: 'agreement' })
  })
})
