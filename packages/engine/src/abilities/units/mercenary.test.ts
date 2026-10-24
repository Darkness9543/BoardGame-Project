import { describe, expect, it } from 'vitest'
import { registerAbility } from '../registry'
import { validate } from '../../commands'
import { COMMAND_AURA_RANGE, KEEP_POWER_BONUS } from '../../constants'
import { abilityParam } from '../../content/abilities'
import { unitDef } from '../../content/units'
import type { GameEvent } from '../../events'
import { previewAttack } from '../../preview'
import { act, buildBattle, sqs, unitIn, type Battle } from '../../testing/dsl'
import { projectView } from '../../view'

const POWER = unitDef('mercenary').power
const PER = abilityParam('mercenary.fierceAttacker', 'perMercenary')
const ARMOR = abilityParam('paladin.reinforcedArmor', 'reduction')
const LINE = abilityParam('footman.lineFormation', 'reduction')

// Test-local Command Aura stand-in (A8-25): own units within range 2 of the Scourge get one extra action.
registerAbility(
  {
    id: 'scourge.commandAura',
    status: 'implemented',
    modifyStats: (q, holder, target) => (target.id !== holder.id && target.owner === holder.owner && q.distance(holder, target) <= COMMAND_AURA_RANGE ? { actions: 1 } : null),
  },
  { replace: true },
)

function amountsTo(events: readonly GameEvent[], unitId: string): number[] {
  return events.flatMap((e) => (e.type === 'unitDamaged' && e.unitId === unitId ? [e.amount] : []))
}

function strike(b: Battle, attacker: string, target: string): number[] {
  const r = act(b.state, b.south, { kind: 'attack', unitId: b.id(attacker), target: { kind: 'unit', unitId: b.id(target) } })
  return amountsTo(r.events, b.id(target))
}

describe('mercenary.fierceAttacker (8.2, A8-02)', () => {
  it('does not count the attacker itself (MER-1)', () => {
    const b = buildBattle({ south: ['mercenary@M14:A'], north: ['soldier@M15:T'] })
    expect(strike(b, 'A', 'T')).toEqual([POWER])
  })

  it('adds 1 for each other own Mercenary next to the target, +3 at most against a 1x1 (MER-3)', () => {
    const one = buildBattle({ south: ['mercenary@M14:A', 'mercenary@L15'], north: ['soldier@M15:T'] })
    expect(strike(one, 'A', 'T')).toEqual([POWER + PER])
    const full = buildBattle({ south: ['mercenary@M14:A', 'mercenary@L15', 'mercenary@N15', 'mercenary@M16'], north: ['soldier@M15:T'] })
    expect(strike(full, 'A', 'T')).toEqual([POWER + 3 * PER])
  })

  it('reaches +7 against a 2x2 Beast, which has 8 neighbours (MER-3)', () => {
    const b = buildBattle({
      south: ['mercenary@M14:A', 'mercenary@N14', 'mercenary@L15', 'mercenary@L16', 'mercenary@O15', 'mercenary@O16', 'mercenary@M17', 'mercenary@N17'],
      north: ['beast@M15:T'],
    })
    expect(strike(b, 'A', 'T')).toEqual([POWER + 7 * PER])
  })

  it("counts only the attacker's side, only next to the target, and never dummies (MER-2, MER-7)", () => {
    const theirs = buildBattle({ south: ['mercenary@M14:A'], north: ['soldier@M15:T', 'mercenary@L15', 'mercenary@N15'] })
    expect(strike(theirs, 'A', 'T')).toEqual([POWER])
    const nearMe = buildBattle({ south: ['mercenary@M14:A', 'mercenary@L14', 'mercenary@N14'], north: ['soldier@M15:T'] })
    expect(strike(nearMe, 'A', 'T')).toEqual([POWER])
    const dummies = buildBattle({ south: ['mercenary@M14:A', 'noAcb@L15', 'noAcb@N15'], north: ['soldier@M15:T'] })
    expect(strike(dummies, 'A', 'T')).toEqual([POWER])
  })

  it("belongs to the Mercenary's own attacks: a Footman striking a surrounded target gets nothing (MER-4)", () => {
    const b = buildBattle({ south: ['footman@M14:F', 'mercenary@L15', 'mercenary@N15', 'mercenary@M16'], north: ['soldier@M15:T'] })
    expect(strike(b, 'F', 'T')).toEqual([unitDef('footman').power])
  })

  it('is added before reductions and Defend (MER-5, B6 under R21)', () => {
    const paladin = buildBattle({
      south: ['mercenary@M14:A', 'mercenary@L15', 'mercenary@N15', 'mercenary@M16'],
      north: [{ type: 'paladin', at: 'M15', label: 'T', defending: true }],
    })
    expect(strike(paladin, 'A', 'T')).toEqual([Math.ceil((POWER + 3 * PER - ARMOR) / 2)])
    // B7: a 1x1 Footman in formation leaves room for one more Mercenary under ORTHO_4; the Keep keeps it above the floor.
    const formation = buildBattle({ south: ['mercenary@M14:A', 'mercenary@M16'], north: ['footman@M15:T', 'footman@L15', 'footman@N15'], control: { keep: 'south' } })
    expect(strike(formation, 'A', 'T')).toEqual([POWER + KEEP_POWER_BONUS + PER - LINE])
  })

  it('stacks on the Keep: Power 3 before the bonus (MER-6, X-15)', () => {
    const b = buildBattle({ south: ['mercenary@M14:A', 'mercenary@L15', 'mercenary@N15', 'mercenary@M16'], north: ['soldier@M15:T'], control: { keep: 'south' } })
    expect(strike(b, 'A', 'T')).toEqual([POWER + KEEP_POWER_BONUS + 3 * PER])
  })

  it('shows in the attack forecast from the attacker side knowledge', () => {
    const b = buildBattle({ south: ['mercenary@M14:A', 'mercenary@L15', 'mercenary@N15'], north: ['soldier@M15:T'] })
    expect(previewAttack(projectView(b.state, b.south), b.id('A'), b.id('T'))?.amount).toBe(POWER + 2 * PER)
  })

  it('moves in and strikes with the Market action (MER-8); Market + Command Aura give three actions (X-14)', () => {
    const market = buildBattle({ south: ['mercenary@M13:A', 'mercenary@L15'], north: ['soldier@M15:T'], control: { market: 'south' } })
    const moved = act(market.state, market.south, { kind: 'move', unitId: market.id('A'), path: sqs('M14') }).state
    expect(strike({ ...market, state: moved }, 'A', 'T')).toEqual([POWER + PER])

    const both = buildBattle({ south: ['mercenary@M13:A', 'scourge@O14'], north: ['scourge@M15:T'], control: { market: 'south' } })
    let state = act(both.state, both.south, { kind: 'move', unitId: both.id('A'), path: sqs('M14') }).state
    state = act(state, both.south, { kind: 'attack', unitId: both.id('A'), target: { kind: 'unit', unitId: both.id('T') } }).state
    state = act(state, both.south, { kind: 'attack', unitId: both.id('A'), target: { kind: 'unit', unitId: both.id('T') } }).state
    expect(unitIn(state, both.id('T'))?.toughness).toBe(unitDef('scourge').toughness - 2 * POWER)
    expect(validate(state, both.south, { kind: 'defend', unitId: both.id('A') })).toMatchObject({ ok: false, code: 'NO_ACTIONS_LEFT' })
  })
})
