import { describe, expect, it } from 'vitest'
import { act, buildBattle, filterEvents, parseSquare, projectView } from '@coinduel/engine'
import { abilityForecast, attackForecast, mineForecast } from './forecast'
import { describeEvents } from './logText'
import { EMPTY_REGISTRY, learnUnits } from './naming'
import { unitById } from './rules'

describe('forecasts run the damage pipeline on the own view', () => {
  it('a mine hit counts the victim reductions (Reinforced Armor), and a lone Footman dies to it', () => {
    const b = buildBattle({ south: ['paladin@G5:P', 'footman@C5:F'], north: ['soldier@I20:S'], mines: [{ owner: 'south', at: 'G6' }] })
    const view = projectView(b.state, b.south)
    const paladin = unitById(view, b.id('P'))
    const footman = unitById(view, b.id('F'))
    if (paladin === undefined || footman === undefined) throw new Error('missing units')
    expect(mineForecast(view, paladin)).toMatchObject({ amount: 3, before: paladin.toughness, after: paladin.toughness - 3, lethal: false })
    expect(mineForecast(view, footman)).toMatchObject({ amount: 5, after: 0, lethal: true })
  })

  it('a lethal attack forecasts 0 toughness left, and the log line never shows a negative number', () => {
    const b = buildBattle({ south: ['berserker@N8:B'], north: ['rogue@N9:R'] })
    const view = projectView(b.state, b.south)
    const forecast = attackForecast(view, b.id('B'), b.id('R'))
    expect(forecast?.hits[0]).toMatchObject({ after: 0, lethal: true })

    const done = act(b.state, b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('R') } })
    const after = projectView(done.state, b.south)
    const events = filterEvents(done.events, b.south)
    const registry = learnUnits(learnUnits(EMPTY_REGISTRY, view), after, events)
    const lines = describeEvents(events, { view: after, registry, names: { host: 'Ann', guest: 'Bo' } }).map((l) => l.text)
    const damage = lines.find((t) => t.includes('damage'))
    expect(damage).toMatch(/^Enemy Rogue 1 took \d+ damage · \d+ → 0$/)
    expect(lines.every((t) => t.charAt(0) === t.charAt(0).toUpperCase())).toBe(true)
  })
})

describe('ability forecasts that are not an immediate hit', () => {
  it('Pajazon: no damage at once on the centre, only the ticks, never lethal or a win (A8-19)', () => {
    const b = buildBattle({ south: ['royalWizard@M10:W', { type: 'soldier', at: 'M12', label: 'S', toughness: 3 }], north: [{ type: 'commander', at: 'N12', label: 'C', toughness: 3 }, 'soldier@L13:E'] })
    const view = projectView(b.state, b.south)
    const forecast = abilityForecast(view, b.id('W'), 'royalWizard.pajazon', [{ kind: 'square', square: parseSquare('M12') }])
    expect(forecast?.hits).toEqual([])
    expect(forecast?.heals).toEqual([{ targetId: b.id('S'), amount: 3, after: 6, max: 7 }])
    expect(forecast?.notes.join(' ')).toMatch(/enemy units inside take 3 damage \(2 inside now\)/)
  })

  it('Shared wounds: the donor loses half rounded up, a donor at 1 dies, and a capped heal shows the waste (R19, PRI-6)', () => {
    const b = buildBattle({ south: [{ type: 'priestess', at: 'M10', label: 'P', toughness: 1 }, { type: 'soldier', at: 'M11', label: 'S', toughness: 6 }] })
    const view = projectView(b.state, b.south)
    const dying = abilityForecast(view, b.id('P'), 'priestess.sharedWounds', [{ kind: 'unit', unitId: b.id('P') }, { kind: 'unit', unitId: b.id('S') }])
    expect(dying?.hits[0]).toMatchObject({ targetId: b.id('P'), amount: 1, after: 0, lethal: true })
    const full = abilityForecast(view, b.id('P'), 'priestess.sharedWounds', [{ kind: 'unit', unitId: b.id('S') }, { kind: 'unit', unitId: b.id('P') }])
    expect(full?.hits[0]).toMatchObject({ targetId: b.id('S'), amount: 3, after: 3, lethal: false })
    expect(full?.heals).toEqual([{ targetId: b.id('P'), amount: 3, after: 4, max: 15 }])
    expect(full?.notes).toEqual([])

    const nearlyFull = buildBattle({ south: [{ type: 'priestess', at: 'M10', label: 'P', toughness: 14 }, { type: 'soldier', at: 'M11', label: 'S', toughness: 6 }] })
    const capped = abilityForecast(projectView(nearlyFull.state, nearlyFull.south), nearlyFull.id('P'), 'priestess.sharedWounds', [
      { kind: 'unit', unitId: nearlyFull.id('S') },
      { kind: 'unit', unitId: nearlyFull.id('P') },
    ])
    expect(capped?.heals).toEqual([{ targetId: nearlyFull.id('P'), amount: 1, after: 15, max: 15 }])
    expect(capped?.notes).toEqual(['2 of the 3 toughness is wasted: the recipient is capped at its max'])
  })
})
