import { describe, expect, it } from 'vitest'
import type { Intent } from './commands'
import { parseSquare } from './geometry'
import { startRecord, submit, type MatchRecord } from './history'
import { buildBattle, sqs, type BattleSpec } from './testing/dsl'
import { cloneState } from './state'
import { findLeaks } from './testing/fogLeak'
import type { Seat } from './types'
import { canRequestTakeback, projectView } from './view'

function must(record: MatchRecord, seat: Seat, intent: Intent): MatchRecord {
  const result = submit(record, seat, intent)
  if (!result.ok) throw new Error(`${intent.kind}: ${result.code} ${result.message}`)
  return result.record
}

/** South acts, then asks to take it back; returns the record with the request pending. */
function requested(spec: BattleSpec, act: (ids: (label: string) => string) => Intent) {
  const b = buildBattle(spec)
  const acted = must(startRecord(b.state), b.south, act(b.id))
  return { b, acted, record: must(acted, b.south, { kind: 'requestTakeback' }) }
}

describe('a take-back request shows the decider only what it saw of the action (9 TB-4 within 4.2, 4.8)', () => {
  it('a Trip Mine laid in the fog: the decider learns nothing, neither the Artificer nor the square', () => {
    const { b, record } = requested({ south: ['artificer@E10:A'], north: ['soldier@E20:S'] }, (id) => ({
      kind: 'useAbility',
      unitId: id('A'),
      abilityId: 'artificer.tripMine',
      targets: [{ kind: 'square', square: parseSquare('E11') }],
    }))
    const decider = projectView(record.state, b.north)
    expect(decider.takeback.request).toEqual({ requester: b.south, actionSeq: 1, action: { kind: 'unseen' }, disclosure: { units: [], mines: [], assaults: 0, prompts: 0 } })
    expect(JSON.stringify(decider)).not.toContain(b.id('A'))
    expect(findLeaks(record.state, b.north)).toEqual([])
    expect(projectView(record.state, b.south).takeback.request?.action).toMatchObject({ kind: 'useAbility', unitId: b.id('A') }) // the requester's own
    const declined = must(record, b.north, { kind: 'declineTakeback' })
    expect(declined.state.mines.map((m) => m.square)).toEqual([parseSquare('E11')])
  })

  it('a move in the fog is unseen; a move from sight into the fog shows the steps it saw, not the unit', () => {
    const fogged = requested({ south: ['paladin@E5:P'], north: ['soldier@E20:S'] }, (id) => ({ kind: 'move', unitId: id('P'), path: sqs('E6', 'E7') }))
    expect(projectView(fogged.record.state, fogged.b.north).takeback.request?.action).toEqual({ kind: 'unseen' })
    expect(findLeaks(fogged.record.state, fogged.b.north)).toEqual([])

    const away = requested({ south: ['paladin@G9:P'], north: ['soldier@E9:S'] }, (id) => ({ kind: 'move', unitId: id('P'), path: sqs('G8', 'G7', 'G6') }))
    expect(projectView(away.record.state, away.b.north).takeback.request?.action).toEqual({ kind: 'move', unitId: null, path: [parseSquare('G8')] })
    expect(findLeaks(away.record.state, away.b.north)).toEqual([])

    const seen = requested({ south: ['paladin@G9:P'], north: ['soldier@E9:S'] }, (id) => ({ kind: 'move', unitId: id('P'), path: sqs('F9') }))
    expect(projectView(seen.record.state, seen.b.north).takeback.request?.action).toEqual({ kind: 'move', unitId: seen.b.id('P'), path: [parseSquare('F9')] })
  })

  it("Stealth is secret even when the decider's unseen watcher sees the attempt fail (4.8)", () => {
    const { b, record } = requested(
      { south: ['rogue@E10:R'], north: [{ type: 'rogue', at: 'E12', label: 'W', stealthed: true }] },
      (id) => ({ kind: 'useAbility', unitId: id('R'), abilityId: 'rogue.stealth', targets: [] }),
    )
    expect(projectView(record.state, b.north).units.some((u) => u.id === b.id('R'))).toBe(true)
    expect(projectView(record.state, b.north).takeback.request?.action).toEqual({ kind: 'unseen' })
  })
})

describe('the decider is told what the action revealed to the requester (9 TB-5, A9-03)', () => {
  it('a mine of the decider set off on the way, with its square', () => {
    const { b, record } = requested({ south: ['soldier@E5:S'], north: ['soldier@E20:N'], mines: [{ owner: 'north', at: 'E6' }] }, (id) => ({ kind: 'move', unitId: id('S'), path: sqs('E6') }))
    expect(projectView(record.state, b.north).takeback.request?.disclosure?.mines).toEqual([{ id: b.mineIds['mine0'], square: parseSquare('E6'), setOff: true }])
    expect(projectView(record.state, b.south).takeback.request?.disclosure).toBeNull() // the requester's view has none
  })

  it("a mine Mind's Eye revealed halfway that is out of sight by the end", () => {
    const { b, record } = requested({ south: ['artificer@E5:A'], north: ['soldier@E20:N'], mines: [{ owner: 'north', at: 'B6' }] }, (id) => ({ kind: 'move', unitId: id('A'), path: sqs('E6', 'E7') }))
    expect(projectView(record.state, b.south).mines).toEqual([]) // no longer in the requester's vision
    expect(projectView(record.state, b.north).takeback.request?.disclosure?.mines).toEqual([{ id: b.mineIds['mine0'], square: parseSquare('B6'), setOff: false }])
  })

  it("the decider's units it revealed, an Assault that fired and a prompt the decider answered", () => {
    const assault = requested(
      { south: ['paladin@M5:P'], north: [{ type: 'rogue', at: 'M8', label: 'R', stealthed: true }] },
      (id) => ({ kind: 'move', unitId: id('P'), path: sqs('M6', 'M7') }),
    )
    expect(projectView(assault.record.state, assault.b.north).takeback.request?.disclosure).toMatchObject({ units: [assault.b.id('R')], assaults: 1 })

    const b = buildBattle({ south: ['berserker@M10:B'], north: ['commander@M13:Q', 'soldier@M11:S'], commanders: { north: 'queso' } })
    const killed = must(startRecord(b.state), b.south, { kind: 'attack', unitId: b.id('B'), target: { kind: 'unit', unitId: b.id('S') } })
    const decision = projectView(killed.state, b.north).decision
    const answered = must(killed, b.north, { kind: 'respondDecision', decisionId: decision?.id ?? '', choice: 'yes' })
    const record = must(answered, b.south, { kind: 'requestTakeback' })
    expect(projectView(record.state, b.north).takeback.request?.disclosure).toMatchObject({ prompts: 1 })
  })
})

describe('a prompt the seat may not know about changes nothing it can observe (2.11)', () => {
  it("leaves the other seat's take-back right as it is", () => {
    const b = buildBattle({ south: ['soldier@E5:S'], north: ['soldier@E20:N'], active: 'north' })
    const acted = must(startRecord(b.state), b.north, { kind: 'defend', unitId: b.id('N') })
    expect(canRequestTakeback(acted.state, b.north)).toBe(true)
    const hidden = cloneState(acted.state)
    hidden.decisions.push({ id: 'd-hidden', seat: b.south, abilityId: 'queso.revive', holderId: null, kind: 'queso.revive', prompt: '?', options: [{ id: 'no', label: 'No' }], defaultOption: 'no', alwaysOption: null, preferenceKey: null, timeoutSeconds: 15, publicTo: [b.south], data: {} })
    expect(canRequestTakeback(hidden, b.north)).toBe(true)
    expect(projectView(hidden, b.north).takeback.canRequest).toBe(true)
    const shown = cloneState(hidden)
    shown.decisions[0]?.publicTo.push(b.north)
    expect(canRequestTakeback(shown, b.north)).toBe(false)
  })
})
