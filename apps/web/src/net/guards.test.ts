import { describe, expect, it } from 'vitest'
import type { Intent } from '@coinduel/engine'
import { MAX_GUEST_MESSAGE_CHARS, PROTOCOL_VERSION } from './constants'
import { BAD, cleanName, decodeGuestMessage, decodeHostMessage, parseArmyList, parseIntent, parseSettingsPatch } from './guards'
import { wire } from './messages'
import { localVersions } from './versions'

const LEGAL: readonly Intent[] = [
  { kind: 'setArmy', army: { faction: 'lojrar', commander: 'babaYaga', variant: 'cauldron', units: { mercenary: 12 } } },
  { kind: 'setReady', ready: true },
  { kind: 'updateSettings', settings: { budget: 150, turnTimerSeconds: null, scenarioId: 'openField' } },
  { kind: 'startDeployment', coinSeed: 'abc' },
  { kind: 'deploy', unitId: 'u-1', anchor: { x: 3, y: 1 } },
  { kind: 'undeploy', unitId: 'u-1' },
  { kind: 'confirmDeployment', confirmed: false },
  { kind: 'move', unitId: 'u-1', path: [{ x: 3, y: 2 }, { x: 3, y: 3 }] },
  { kind: 'attack', unitId: 'u-1', target: { kind: 'unit', unitId: 'u-2' } },
  { kind: 'attack', unitId: 'u-1', target: { kind: 'square', square: { x: 4, y: 4 } } },
  { kind: 'defend', unitId: 'u-1' },
  { kind: 'useAbility', unitId: 'u-1', abilityId: 'royalWizard.forcefield', targets: [{ kind: 'squares', squares: [{ x: 1, y: 1 }, { x: 1, y: 2 }] }] },
  { kind: 'charge', unitId: 'u-1', path: [{ x: 3, y: 2 }], target: { kind: 'unit', unitId: 'u-2' } },
  { kind: 'groupMarch', unitIds: ['u-1', 'u-3'], direction: 'north' },
  { kind: 'endTurn' },
  { kind: 'respondDecision', decisionId: 'd-1', choice: 'yes' },
  { kind: 'requestTakeback' },
  { kind: 'acceptTakeback' },
  { kind: 'declineTakeback' },
  { kind: 'resign' },
  { kind: 'offerDraw' },
  { kind: 'acceptDraw' },
  { kind: 'declineDraw' },
  { kind: 'setPreference', key: 'revive', value: 'always' },
]

describe('parseIntent (trust boundary)', () => {
  it.each(LEGAL.map((intent) => [intent.kind, intent] as const))('round-trips a well-formed %s', (_kind, intent) => {
    expect(parseIntent(JSON.parse(JSON.stringify(intent)))).toEqual(intent)
  })

  it('drops unknown fields instead of passing them on', () => {
    const parsed = parseIntent({ kind: 'move', unitId: 'u-1', path: [{ x: 1, y: 1, z: 9 }], __proto__x: 1, extra: { evil: true } })
    expect(parsed).toEqual({ kind: 'move', unitId: 'u-1', path: [{ x: 1, y: 1 }] })
  })

  it.each([
    ['not an object', 'move'],
    ['an unknown kind', { kind: 'teleport', unitId: 'u-1' }],
    ['a prototype key as kind', { kind: 'constructor' }],
    ['a missing field', { kind: 'move', unitId: 'u-1' }],
    ['a square off the board', { kind: 'deploy', unitId: 'u-1', anchor: { x: 25, y: 0 } }],
    ['a fractional coordinate', { kind: 'deploy', unitId: 'u-1', anchor: { x: 1.5, y: 0 } }],
    ['NaN', { kind: 'deploy', unitId: 'u-1', anchor: { x: Number.NaN, y: 0 } }],
    ['a huge path', { kind: 'move', unitId: 'u-1', path: Array.from({ length: 65 }, () => ({ x: 1, y: 1 })) }],
    ['an over-long id', { kind: 'defend', unitId: 'x'.repeat(65) }],
    ['an empty id', { kind: 'defend', unitId: '' }],
    ['a bad attack target', { kind: 'attack', unitId: 'u-1', target: { kind: 'squares', squares: [] } }],
    ['a bad march direction', { kind: 'groupMarch', unitIds: ['u-1'], direction: 'up' }],
    ['a bad preference', { kind: 'setPreference', key: 'revive', value: 'sometimes' }],
    ['a string boolean', { kind: 'setReady', ready: 'true' }],
  ])('rejects %s', (_label, value) => {
    expect(parseIntent(value)).toBe(BAD)
  })

  it('checks army lists field by field', () => {
    expect(parseArmyList({ faction: 'empire', commander: 'trill', units: { footman: 3 } })).toEqual({ faction: 'empire', commander: 'trill', units: { footman: 3 } })
    expect(parseArmyList({ faction: 'orcs', commander: 'trill', units: {} })).toBe(BAD)
    expect(parseArmyList({ faction: 'empire', commander: 'gandalf', units: {} })).toBe(BAD)
    expect(parseArmyList({ faction: 'empire', commander: 'trill', units: { dragon: 1 } })).toBe(BAD)
    expect(parseArmyList({ faction: 'empire', commander: 'trill', units: { footman: -1 } })).toBe(BAD)
    expect(parseArmyList({ faction: 'empire', commander: 'trill', units: { footman: 2.5 } })).toBe(BAD)
  })

  it('accepts only known settings with the right types', () => {
    expect(parseSettingsPatch({ takebacksPerGame: null, keepEnabled: false })).toEqual({ takebacksPerGame: null, keepEnabled: false })
    expect(parseSettingsPatch({ budget: '200' })).toBe(BAD)
    expect(parseSettingsPatch({ fog: false })).toBe(BAD)
    expect(parseSettingsPatch({ turnTimerSeconds: 0 })).toBe(BAD)
  })
})

describe('decodeGuestMessage', () => {
  const hello = {
    versions: localVersions('test'),
    name: 'Ana',
    proof: 'p'.repeat(64),
    seatToken: null,
    lastSeq: null,
    viewHash: null,
    stateHash: null,
    pending: [],
  }

  it('accepts a well-formed hello and intent', () => {
    expect(decodeGuestMessage(wire('hello', hello))).toEqual({ ok: true, message: { v: PROTOCOL_VERSION, t: 'hello', b: hello } })
    const decoded = decodeGuestMessage(wire('intent', { id: 'i1', epoch: 0, intent: { kind: 'endTurn' } }))
    expect(decoded.ok && decoded.message.t === 'intent' && decoded.message.b.intent).toEqual({ kind: 'endTurn' })
  })

  it.each([
    ['not JSON', '{"v":1,', 'not-json'],
    ['a bare value', '42', 'malformed'],
    ['another protocol version', JSON.stringify({ v: 99, t: 'hello', b: {} }), 'version'],
    ['no version at all', JSON.stringify({ t: 'hello', b: hello }), 'version'],
    ['an unknown type', JSON.stringify({ v: PROTOCOL_VERSION, t: 'snapshot', b: {} }), 'malformed'],
    ['a body that is not an object', JSON.stringify({ v: PROTOCOL_VERSION, t: 'resync', b: [] }), 'malformed'],
    ['a bad intent inside', wire('intent', { id: 'i1', epoch: 0, intent: { kind: 'move' } as unknown as Intent }), 'malformed'],
    ['an oversized message', JSON.stringify({ v: PROTOCOL_VERSION, t: 'hello', b: { name: 'x'.repeat(MAX_GUEST_MESSAGE_CHARS) } }), 'too-large'],
  ])('refuses %s', (_label, text, reason) => {
    expect(decodeGuestMessage(text)).toEqual({ ok: false, reason })
  })

  it('never lets a guest message pose as a host message', () => {
    expect(decodeGuestMessage(wire('welcome', { versions: localVersions('t'), seatToken: 'x', hostName: 'H', roomId: 'R', stillPending: [] })).ok).toBe(false)
    expect(decodeHostMessage(wire('hello', hello)).ok).toBe(false)
  })
})

describe('cleanName', () => {
  it('strips control, zero-width and bidi characters, collapses spaces and caps the length', () => {
    expect(cleanName(`  Copper${String.fromCharCode(0x202e)}  Duke${String.fromCharCode(0x200b)} `, 'Guest')).toBe('Copper Duke')
    expect(cleanName('A'.repeat(50), 'Guest')).toHaveLength(20)
    expect(cleanName(String.fromCharCode(0x0007, 0x200d), 'Guest')).toBe('Guest')
  })
})
