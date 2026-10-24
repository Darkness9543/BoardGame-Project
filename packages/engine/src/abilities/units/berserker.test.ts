import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate, type Intent } from '../../commands'
import { COMMAND_AURA_RANGE, KEEP_POWER_BONUS } from '../../constants'
import { abilityData, abilityParam } from '../../content/abilities'
import { unitDef } from '../../content/units'
import type { GameEvent } from '../../events'
import { parseSquare } from '../../geometry'
import { legalActions } from '../../preview'
import { act, buildBattle, sqs, unitIn, type Battle } from '../../testing/dsl'
import type { GameState } from '../../types'
import { filterEvents, projectView } from '../../view'

const POWER = unitDef('berserker').power
const ARMOR = abilityParam('paladin.reinforcedArmor', 'reduction')
const SAVAGERY_AP = abilityData('berserker.savagery').apCost
const ATTACK_AP = unitDef('berserker').ap

// Test-local Command Aura stand-in (A8-25): own units within range 2 of the Scourge get one extra action.
registerAbility(
  {
    id: 'scourge.commandAura',
    status: 'implemented',
    modifyStats: (q, holder, target) => (target.id !== holder.id && target.owner === holder.owner && q.distance(holder, target) <= COMMAND_AURA_RANGE ? { actions: 1 } : null),
  },
  { replace: true },
)

const attack = (b: Battle, target: string, unit = 'B'): Intent => ({ kind: 'attack', unitId: b.id(unit), target: { kind: 'unit', unitId: b.id(target) } })
const savagery = (b: Battle, target: string, unit = 'B'): Intent => ({
  kind: 'useAbility',
  unitId: b.id(unit),
  abilityId: 'berserker.savagery',
  targets: [{ kind: 'unit', unitId: b.id(target) }],
})

function run(state: GameState, b: Battle, intents: readonly Intent[]): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = []
  for (const intent of intents) {
    const r = act(state, b.south, intent)
    state = r.state
    events.push(...r.events)
  }
  return { state, events }
}

function savageryOption(state: GameState, b: Battle) {
  return legalActions(projectView(state, b.south), b.id('B')).find((o) => o.abilityId === 'berserker.savagery')
}

describe('berserker.savagery (8.5, A8-05; the Berserker is 8/2 under owner ruling R20)', () => {
  it('reads the Berserker from the content table: 8/2 (R20)', () => {
    expect(unitDef('berserker')).toMatchObject({ power: 8, toughness: 2 })
    expect(SAVAGERY_AP).toBe(2)
  })

  it('attacks a second time for 2 AP after a basic Attack: 3 AP for two hits, still one action (BER-1)', () => {
    const b = buildBattle({ south: ['berserker@M14:B'], north: ['paladin@M15:P'] })
    const r = run(b.state, b, [attack(b, 'P'), savagery(b, 'P')])
    expect(unitIn(r.state, b.id('P'))?.toughness).toBe(unitDef('paladin').toughness - 2 * (POWER - ARMOR)) // BER-6: one pipeline each
    expect(r.state.seats[b.south].ap).toBe(20 - ATTACK_AP - 2)
    expect(unitIn(r.state, b.id('B'))?.turn).toMatchObject({ actionsUsed: 1, abilityUses: { 'berserker.savagery': 1 } })
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'unitAttacked', attackerId: b.id('B'), target: { kind: 'unit', unitId: b.id('P') }, source: 'berserker.savagery' })
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'unitDamaged', unitId: b.id('P'), kind: 'attack', source: 'berserker.savagery' }))
  })

  it('needs a basic Attack first this turn: not before it, not after a Defend (BER-3)', () => {
    const b = buildBattle({ south: ['berserker@M14:B'], north: ['paladin@M15:P'] })
    expect(validate(b.state, b.south, savagery(b, 'P'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
    const defended = act(b.state, b.south, { kind: 'defend', unitId: b.id('B') }).state
    expect(validate(defended, b.south, savagery(b, 'P'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
  })

  it('is once per turn: it cannot follow itself (BER-3)', () => {
    const b = buildBattle({ south: ['berserker@M14:B'], north: ['scourge@M15:S'] })
    const r = run(b.state, b, [attack(b, 'S'), savagery(b, 'S')])
    expect(validate(r.state, b.south, savagery(b, 'S'))).toMatchObject({ ok: false, code: 'LIMIT_REACHED' })
  })

  it('keeps its button on the action bar for the rest of the turn, even after other units acted (BER-2, C15)', () => {
    const b = buildBattle({ south: ['berserker@M14:B', 'soldier@C10:S'], north: ['scourge@M15:T'] })
    expect(savageryOption(b.state, b)).toMatchObject({ enabled: false, cost: 2, reason: expect.stringContaining('basic Attack') })
    const attacked = act(b.state, b.south, attack(b, 'T')).state
    expect(savageryOption(attacked, b)).toMatchObject({ enabled: true, cost: 2, reason: null })
    const later = act(attacked, b.south, { kind: 'move', unitId: b.id('S'), path: sqs('C11') }).state
    expect(savageryOption(later, b)?.enabled).toBe(true)
    const used = act(later, b.south, savagery(b, 'T')).state
    expect(savageryOption(used, b)).toMatchObject({ enabled: false, reason: expect.stringContaining('again this turn') })
  })

  it('may hit another unit when the first attack killed its target (BER-4)', () => {
    const b = buildBattle({ south: ['berserker@M14:B'], north: ['footman@M15:F', 'soldier@L14:S'] })
    const r = run(b.state, b, [attack(b, 'F'), savagery(b, 'S')])
    expect(unitIn(r.state, b.id('F'))).toBeUndefined()
    expect(unitIn(r.state, b.id('S'))).toBeUndefined()
  })

  it('needs its 2 AP and a legal attack target', () => {
    const poor = buildBattle({ south: ['berserker@M14:B'], north: ['scourge@M15:T'], ap: ATTACK_AP + 1 })
    const attacked = act(poor.state, poor.south, attack(poor, 'T')).state
    expect(validate(attacked, poor.south, savagery(poor, 'T'))).toMatchObject({ ok: false, code: 'NOT_ENOUGH_AP' })
    const b = buildBattle({ south: ['berserker@M14:B'], north: ['scourge@M15:T', 'soldier@M16:FAR'] }) // visible (LOV 2), out of reach
    const ready = act(b.state, b.south, attack(b, 'T')).state
    expect(validate(ready, b.south, savagery(b, 'FAR'))).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' })
    expect(validate(ready, b.south, { kind: 'useAbility', unitId: b.id('B'), abilityId: 'berserker.savagery', targets: [{ kind: 'square', square: parseSquare('M13') }] })).toMatchObject({
      ok: false,
      code: 'INVALID_TARGET',
    })
  })

  it('needs a new basic Attack on each own turn', () => {
    const b = buildBattle({ south: ['berserker@M14:B'], north: ['scourge@M15:T'] })
    let state = act(b.state, b.south, attack(b, 'T')).state
    state = act(act(state, b.south, { kind: 'endTurn' }).state, b.north, { kind: 'endTurn' }).state
    expect(validate(state, b.south, savagery(b, 'T'))).toMatchObject({ ok: false, code: 'REQUIREMENT_NOT_MET' })
  })

  it('gives three attacks with a Command Aura action: Attack, Savagery, Attack for 4 AP (BER-5, X-13)', () => {
    const b = buildBattle({ south: ['berserker@M14:B', 'scourge@O14'], north: ['scourge@M15:T'] })
    const r = run(b.state, b, [attack(b, 'T'), savagery(b, 'T'), attack(b, 'T')])
    expect(unitIn(r.state, b.id('T'))?.toughness).toBe(unitDef('scourge').toughness - 3 * POWER)
    expect(r.state.seats[b.south].ap).toBe(20 - (ATTACK_AP + 2 + ATTACK_AP))
    expect(validate(r.state, b.south, savagery(b, 'T'))).toMatchObject({ ok: false, code: 'LIMIT_REACHED' })
  })

  it('gets the Keep bonus on each attack (BER-6, X-15)', () => {
    const b = buildBattle({ south: ['berserker@M14:B'], north: ['scourge@M15:T'], control: { keep: 'south' } })
    const r = run(b.state, b, [attack(b, 'T'), savagery(b, 'T')])
    expect(unitIn(r.state, b.id('T'))?.toughness).toBe(unitDef('scourge').toughness - 2 * (POWER + KEEP_POWER_BONUS))
  })

  it("is an attack, so it cancels the Berserker's own Defend (BER-8, 2.7)", () => {
    const b = buildBattle({ south: ['berserker@M14:B', 'scourge@O14'], north: ['scourge@M15:T'] })
    const defended = run(b.state, b, [attack(b, 'T'), { kind: 'defend', unitId: b.id('B') }])
    expect(unitIn(defended.state, b.id('B'))?.defending).toBe(true)
    const r = act(defended.state, b.south, savagery(b, 'T'))
    expect(unitIn(r.state, b.id('B'))?.defending).toBe(false)
    expect(filterEvents(r.events, b.south)).toContainEqual({ type: 'defendChanged', unitId: b.id('B'), defending: false, reason: 'acted' })
  })
})
