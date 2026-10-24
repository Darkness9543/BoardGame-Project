import { describe, expect, it } from 'vitest'
import { createGame, deploymentSquares, projectView, startRecord, submit, type MatchRecord } from '@coinduel/engine'
import { checkDraftIntent, EMPTY_DRAFT, overlayDraft, overlayOpponentLock, publicArmy, revealIntents } from './draft'
import { SMALL_ARMIES } from './testing/flows'

function deploymentRecord(): MatchRecord {
  let record = startRecord(createGame({ seed: 'draft', settings: { scenarioId: 'openField' } }))
  for (const intent of [
    { seat: 'host', intent: { kind: 'setArmy', army: SMALL_ARMIES.host } },
    { seat: 'guest', intent: { kind: 'setArmy', army: SMALL_ARMIES.guest } },
    { seat: 'host', intent: { kind: 'setReady', ready: true } },
    { seat: 'guest', intent: { kind: 'setReady', ready: true } },
    { seat: 'host', intent: { kind: 'startDeployment', coinSeed: 'c' } },
  ] as const) {
    const result = submit(record, intent.seat, intent.intent)
    if (!result.ok) throw new Error(result.message)
    record = result.record
  }
  return record
}

describe('guest drafts (sealed submissions, R37)', () => {
  it('keeps only the commander and variant public (R16)', () => {
    expect(publicArmy({ faction: 'lojrar', commander: 'babaYaga', variant: 'mend', units: { mercenary: 9 } })).toEqual({
      faction: 'lojrar',
      commander: 'babaYaga',
      variant: 'mend',
      units: {},
    })
  })

  it('shows the draft army and the pending lock over the lobby view', () => {
    const view = projectView(createGame({ seed: 'x' }), 'guest')
    const shown = overlayDraft(view, { ...EMPTY_DRAFT, army: SMALL_ARMIES.guest, lock: { army: true, deploy: false } })
    expect(shown.myArmy).toEqual(SMALL_ARMIES.guest)
    expect(shown.lobby.ready).toEqual({ host: false, guest: true })
    expect(overlayDraft(view, EMPTY_DRAFT).myArmy).toBeNull()
  })

  it('places draft units, recomputes the guest vision and validates against the draft', () => {
    const record = deploymentRecord()
    const view = projectView(record.state, 'guest')
    const unit = view.units.find((u) => u.owner === 'guest' && !u.isCommander)
    if (unit === undefined || view.side === null) throw new Error('no unit')
    const square = deploymentSquares(view.side, unit.type)[0]
    if (square === undefined) throw new Error('no square')
    const draft = { ...EMPTY_DRAFT, placements: { [unit.id]: square } }
    const shown = overlayDraft(view, draft)
    expect(shown.units.find((u) => u.id === unit.id)?.anchor).toEqual(square)
    expect(shown.visibility).not.toBe(view.visibility)
    const other = view.units.find((u) => u.owner === 'guest' && u.id !== unit.id)
    if (other === undefined) throw new Error('no second unit')
    expect(checkDraftIntent(view, draft, { kind: 'deploy', unitId: other.id, anchor: square })).toMatchObject({ ok: false, code: 'SQUARE_UNAVAILABLE' })
    expect(checkDraftIntent(view, draft, { kind: 'confirmDeployment', confirmed: true })).toMatchObject({ ok: false, code: 'NOT_ALL_DEPLOYED' })
  })

  it('reveals placements in a stable order, then the confirmation', () => {
    const draft = { ...EMPTY_DRAFT, placements: { 'u-b': { x: 1, y: 0 }, 'u-a': { x: 0, y: 0 } } }
    expect(revealIntents('deploy', draft)).toEqual([
      { kind: 'deploy', unitId: 'u-a', anchor: { x: 0, y: 0 } },
      { kind: 'deploy', unitId: 'u-b', anchor: { x: 1, y: 0 } },
      { kind: 'confirmDeployment', confirmed: true },
    ])
    expect(revealIntents('army', EMPTY_DRAFT)).toBeNull()
  })

  it('shows the host that the guest waits for it', () => {
    const lobby = projectView(createGame({ seed: 'x' }), 'host')
    expect(overlayOpponentLock(lobby, 'guest', { army: true, deploy: false }).lobby.ready.guest).toBe(true)
    expect(overlayOpponentLock(lobby, 'guest', { army: false, deploy: true })).toBe(lobby)
  })
})
