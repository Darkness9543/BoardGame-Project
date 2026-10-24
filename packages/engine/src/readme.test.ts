import { describe, expect, it } from 'vitest'
import {
  act,
  buildBattle,
  combineSecrets,
  commitSecret,
  createGame,
  deploymentSquares,
  filterEvents,
  findLeaks,
  hashJson,
  projectView,
  reachableSquares,
  replay,
  restoreRecord,
  serializeRecord,
  startRecord,
  submit,
  unitIn,
  validateIntent,
  verifySecret,
  type Intent,
  type MatchRecord,
  type Seat,
} from './index'

// The README's examples, run for real, so the API guide can't drift from the code.

describe('README quick start', () => {
  it('runs lobby -> commit-reveal coin flip -> hidden deployment -> battle through submit', () => {
    let record: MatchRecord = startRecord(createGame({ seed: 'host-random-string', settings: { scenarioId: 'crossroads' } }))
    const send = (seat: Seat, intent: Intent): void => {
      const result = submit(record, seat, intent)
      if (!result.ok) throw new Error(`${intent.kind} rejected: ${result.code} ${result.message}`)
      record = result.record
      for (const s of ['host', 'guest'] as const) {
        expect(findLeaks(record.state, s)).toEqual([])
        if (intent.kind === 'deploy' && s !== seat) expect(filterEvents(result.events, s).some((e) => e.type === 'unitPlaced')).toBe(false)
      }
    }

    send('host', { kind: 'setArmy', army: { faction: 'empire', commander: 'trill', units: { footman: 10, paladin: 2 } } })
    send('guest', { kind: 'setArmy', army: { faction: 'lojrar', commander: 'babaYaga', variant: 'cauldron', units: { mercenary: 12 } } })
    send('host', { kind: 'setReady', ready: true })
    send('guest', { kind: 'setReady', ready: true })

    const hostNonce = 'host-nonce'
    const guestNonce = 'guest-nonce'
    expect(verifySecret(commitSecret(hostNonce), hostNonce)).toBe(true)
    expect(verifySecret(commitSecret(guestNonce), hostNonce)).toBe(false)
    send('host', { kind: 'startDeployment', coinSeed: combineSecrets(hostNonce, guestNonce) })
    expect(record.state.phase).toBe('deployment')

    for (const seat of ['host', 'guest'] as const) {
      const side = record.state.southSeat === seat ? 'south' : 'north'
      for (const unit of projectView(record.state, seat).units) {
        const anchor = deploymentSquares(side, unit.type).find(
          (s) => validateIntent(projectView(record.state, seat), { kind: 'deploy', unitId: unit.id, anchor: s }).ok,
        )
        if (anchor === undefined) throw new Error(`no square for ${unit.type}`)
        send(seat, { kind: 'deploy', unitId: unit.id, anchor })
      }
      send(seat, { kind: 'confirmDeployment', confirmed: true })
    }
    expect(record.state.phase).toBe('battle')

    const south = record.state.southSeat
    if (south === null) throw new Error('no South')
    const view = projectView(record.state, south)
    const mover = view.units.find((u) => !u.isCommander)
    const destination = mover === undefined ? undefined : reachableSquares(view, mover.id)[0]
    if (mover === undefined || destination === undefined) throw new Error('nothing to move')
    send(south, { kind: 'move', unitId: mover.id, path: destination.path })
    send(south, { kind: 'endTurn' })
    expect(record.state.turn?.activeSeat).not.toBe(south)

    expect(replay(record.initial, record.log)).toEqual(record.state)
    expect(restoreRecord(serializeRecord(record)).state).toEqual(record.state)
    expect(hashJson(projectView(record.state, 'guest'))).toBe(hashJson(projectView(replay(record.initial, record.log), 'guest')))
  })
})

describe('README scenario DSL example', () => {
  it('builds a battle, attacks, and stays fog-safe', () => {
    const b = buildBattle({
      south: ['paladin@E5:P', { type: 'soldier', at: 'F5', label: 'S', toughness: 3, defending: true }],
      north: ['berserker@E6:B', { type: 'rogue', at: 'J9', stealthed: true }],
      commanders: { north: 'babaYaga' },
      variants: { north: 'hex-ward' },
      mines: [{ owner: 'north', at: 'E7', label: 'm' }],
      control: { keep: 'south' },
      settings: { scenarioId: 'crossroads' },
      active: 'south',
      ap: 20,
    })
    const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('P'), target: { kind: 'unit', unitId: b.id('B') } })
    expect(unitIn(r.state, b.id('B'))).toBeUndefined()
    expect(findLeaks(r.state, b.north)).toEqual([])
    expect(b.mineIds['m']).toBeDefined()
    expect(unitIn(r.state, b.id('S'))).toMatchObject({ toughness: 3, defending: true })
  })
})
