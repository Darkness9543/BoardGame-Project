import { describe, expect, it } from 'vitest'
import { createGame, projectView, startRecord, submit, validateIntent, zoneSquares, type ArmyList, type Intent, type MatchRecord, type Seat } from '@coinduel/engine'
import { STARTER_ARMIES } from './armies'
import { BROWSING, autoDeployIntents, captureFormation, formationIntents, mirrorIntents, reduceDeploy, trayGroups, unplacedCount, validSquares } from './deploy'

function must(record: MatchRecord, seat: Seat, intent: Intent): MatchRecord {
  const result = submit(record, seat, intent)
  if (!result.ok) throw new Error(`${intent.kind}: ${result.message}`)
  return result.record
}

function deployment(host: ArmyList, guest: ArmyList, scenarioId: 'crossroads' | 'openField' = 'crossroads'): MatchRecord {
  let record = startRecord(createGame({ seed: 'deploy-test', settings: { scenarioId } }))
  record = must(record, 'host', { kind: 'setArmy', army: host })
  record = must(record, 'guest', { kind: 'setArmy', army: guest })
  record = must(record, 'host', { kind: 'setReady', ready: true })
  record = must(record, 'guest', { kind: 'setReady', ready: true })
  return must(record, 'host', { kind: 'startDeployment', coinSeed: 'coin' })
}

const sendAll = (record: MatchRecord, seat: Seat, intents: readonly Intent[]): MatchRecord => intents.reduce((r, i) => must(r, seat, i), record)

describe('deployment', () => {
  it('auto-deploy places every starter army legally on both sides, and the battle can start', () => {
    for (const [i, starter] of STARTER_ARMIES.entries()) {
      const other = STARTER_ARMIES[(i + 1) % STARTER_ARMIES.length]?.army ?? starter.army
      let record = deployment(starter.army, other)
      for (const seat of ['host', 'guest'] as const) {
        record = sendAll(record, seat, autoDeployIntents(projectView(record.state, seat)))
        expect(unplacedCount(projectView(record.state, seat))).toBe(0)
        record = must(record, seat, { kind: 'confirmDeployment', confirmed: true })
      }
      expect(record.state.phase).toBe('battle')
    }
  })

  it('the tray lists the commander first and a brush stays armed while copies remain', () => {
    const army: ArmyList = { faction: 'empire', commander: 'trill', units: { footman: 2, paladin: 1 } }
    let record = deployment(army, army)
    const view = projectView(record.state, 'host')
    const tray = trayGroups(view)
    expect(tray.map((g) => g.type)).toEqual(['commander', 'footman', 'paladin'])
    const squares = validSquares(view, 'footman')
    const [first, second] = squares
    if (first === undefined || second === undefined) throw new Error('no squares')
    const armed = reduceDeploy(BROWSING, { t: 'pickType', type: 'footman' }, view)
    expect(armed.state).toEqual({ t: 'brush', type: 'footman' })
    const placed = reduceDeploy(armed.state, { t: 'clickSquare', square: first, button: 'primary' }, view)
    expect(placed.intents).toHaveLength(1)
    expect(placed.state).toEqual({ t: 'brush', type: 'footman' })
    record = sendAll(record, 'host', placed.intents)
    const view2 = projectView(record.state, 'host')
    const last = reduceDeploy(placed.state, { t: 'clickSquare', square: second, button: 'primary' }, view2)
    expect(last.state).toEqual(BROWSING)
  })

  it('lifting a token and clicking another of the same size swaps them', () => {
    const army: ArmyList = { faction: 'empire', commander: 'trill', units: { footman: 1, soldier: 1 } }
    let record = deployment(army, army)
    record = sendAll(record, 'host', autoDeployIntents(projectView(record.state, 'host')))
    const view = projectView(record.state, 'host')
    const footman = view.units.find((u) => u.type === 'footman')
    const soldier = view.units.find((u) => u.type === 'soldier')
    if (footman?.anchor == null || soldier?.anchor == null) throw new Error('not placed')
    const lifted = reduceDeploy(BROWSING, { t: 'clickUnit', unitId: footman.id, button: 'primary' }, view)
    expect(lifted.state).toEqual({ t: 'lifted', unitId: footman.id })
    const swapped = reduceDeploy(lifted.state, { t: 'clickUnit', unitId: soldier.id, button: 'primary' }, view)
    record = sendAll(record, 'host', swapped.intents)
    const after = projectView(record.state, 'host')
    expect(after.units.find((u) => u.id === footman.id)?.anchor).toEqual(soldier.anchor)
    expect(after.units.find((u) => u.id === soldier.id)?.anchor).toEqual(footman.anchor)
  })

  it('a saved formation restores the same squares relative to the own edge, on either side', () => {
    const army = STARTER_ARMIES[3]?.army
    if (army === undefined) throw new Error('missing starter')
    let record = deployment(army, army)
    for (const seat of ['host', 'guest'] as const) {
      record = sendAll(record, seat, autoDeployIntents(projectView(record.state, seat)))
    }
    const hostSlots = captureFormation(projectView(record.state, 'host'))
    const guestSlots = captureFormation(projectView(record.state, 'guest'))
    expect(guestSlots).toEqual(hostSlots)
    record = sendAll(record, 'host', mirrorIntents(projectView(record.state, 'host')))
    expect(captureFormation(projectView(record.state, 'host'))).not.toEqual(hostSlots)
    record = sendAll(record, 'host', formationIntents(projectView(record.state, 'host'), hostSlots))
    expect(captureFormation(projectView(record.state, 'host'))).toEqual(hostSlots)
  })
})

describe('deployment swaps respect each unit\'s zones (A5-04)', () => {
  function placed() {
    const army: ArmyList = { faction: 'lojrar', commander: 'trill', units: { rogue: 1, mercenary: 2 } }
    let record = deployment(army, army, 'openField')
    const view = projectView(record.state, 'host')
    if (view.side === null) throw new Error('no side')
    const side = view.side
    const rogue = view.units.find((u) => u.type === 'rogue')
    const mercenary = view.units.find((u) => u.type === 'mercenary')
    if (rogue === undefined || mercenary === undefined) throw new Error('missing units')
    const free = (zone: 'normal' | 'extended') => zoneSquares(side, zone).find((s) => validateIntent(view, { kind: 'deploy', unitId: rogue.id, anchor: s }).ok)
    const extended = free('extended')
    const normal = free('normal')
    if (extended === undefined || normal === undefined) throw new Error('no squares')
    record = sendAll(record, 'host', [{ kind: 'deploy', unitId: rogue.id, anchor: extended }, { kind: 'deploy', unitId: mercenary.id, anchor: normal }])
    return { view: projectView(record.state, 'host'), rogue: rogue.id, mercenary: mercenary.id }
  }

  it('refuses to swap a Vanguard unit in the extended rows with one that may not stand there, sending nothing', () => {
    const { view, rogue, mercenary } = placed()
    const lifted = reduceDeploy({ t: 'lifted', unitId: rogue }, { t: 'clickUnit', unitId: mercenary, button: 'primary' }, view)
    expect(lifted).toEqual({ state: { t: 'lifted', unitId: rogue }, intents: [], hint: "Mercenary can't stand in the extended rows" })
    const dragged = reduceDeploy(BROWSING, { t: 'drop', source: { unitId: mercenary }, square: view.units.find((u) => u.id === rogue)?.anchor ?? null }, view)
    expect(dragged.intents).toEqual([])
  })

  it('refuses a tray brush or drag of such a unit onto a Vanguard token in the extended rows', () => {
    const { view, rogue } = placed()
    const brushed = reduceDeploy({ t: 'brush', type: 'mercenary' }, { t: 'clickUnit', unitId: rogue, button: 'primary' }, view)
    expect(brushed).toMatchObject({ intents: [], hint: "Mercenary can't stand in the extended rows" })
    const square = view.units.find((u) => u.id === rogue)?.anchor ?? null
    expect(reduceDeploy(BROWSING, { t: 'drop', source: { type: 'mercenary' }, square }, view).intents).toEqual([])
  })
})
