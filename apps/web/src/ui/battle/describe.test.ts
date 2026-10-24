import { describe, expect, it } from 'vitest'
import { buildBattle, parseSquare, projectView, sqs, startRecord, submit, type Intent, type MatchRecord, type Seat } from '@coinduel/engine'
import { EMPTY_REGISTRY, learnUnits } from '../../store/naming'
import { describeIntent, disclosureLines } from './describe'

function must(record: MatchRecord, seat: Seat, intent: Intent): MatchRecord {
  const result = submit(record, seat, intent)
  if (!result.ok) throw new Error(`${intent.kind}: ${result.message}`)
  return result.record
}

describe('the take-back card (9 TB-4, TB-5)', () => {
  it('tells the decider its mine was set off, and shows the action only as far as it saw it', () => {
    const b = buildBattle({ south: ['paladin@E5:P'], north: ['soldier@E20:S'], mines: [{ owner: 'north', at: 'E6' }] })
    let record = must(startRecord(b.state), b.south, { kind: 'move', unitId: b.id('P'), path: sqs('E6') })
    record = must(record, b.south, { kind: 'requestTakeback' })
    const view = projectView(record.state, b.north)
    const request = view.takeback.request
    if (request === null || request.disclosure === null) throw new Error('no request for the decider')
    const registry = learnUnits(EMPTY_REGISTRY, view)
    expect(disclosureLines(request.disclosure, registry, view)).toEqual(['It set off your mine at E6'])
    expect(describeIntent(request.action, registry, view)).toBe('an action you could not see')
  })

  it('lists the units it revealed, an Assault and an answered prompt', () => {
    const view = projectView(buildBattle({ north: ['soldier@E9:S'] }).state, 'guest')
    const registry = learnUnits(EMPTY_REGISTRY, view)
    const soldier = view.units.find((u) => u.type === 'soldier')?.id ?? ''
    const lines = disclosureLines({ units: [soldier], mines: [{ id: 'm-1', square: parseSquare('H9'), setOff: false }], assaults: 1, prompts: 1 }, registry, view)
    expect(lines).toEqual([expect.stringMatching(/^It revealed your Soldier/), 'It revealed your mine at H9', "Your Rogue's Assault fired", 'You answered a reaction prompt'])
  })
})
