import { describe, expect, it } from 'vitest'
import { buildBattle, parseSquare, startRecord } from '@coinduel/engine'
import { createSession } from '../net'
import { ManualClock } from '../net/testing/manualClock'
import { MatchController } from './matchController'
import { useSettings } from './settings'
import { memoryStore, setAppStore } from './storage'

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('the reaction prompt\'s "Next time" row (A2-30)', () => {
  it('changes the standing preference without answering the open prompt', async () => {
    setAppStore(memoryStore())
    useSettings.getState().reset()
    const b = buildBattle({
      south: ['commander@E3:Q', { type: 'soldier', at: 'E4', label: 'S', toughness: 1 }],
      north: ['commander@U25'],
      commanders: { south: 'queso' },
      mines: [{ owner: 'north', at: 'E5' }],
    })
    const session = createSession({ mode: 'local', record: startRecord(b.state), clock: new ManualClock(), storage: memoryStore() })
    const host = session.endpoint('host')
    const controller = new MatchController(host, { roomId: 'sandbox-test', sandbox: true })
    await host.dispatch({ kind: 'move', unitId: b.id('S'), path: [parseSquare('E5')] })
    await flush()
    expect(host.pendingReaction?.kind).toBe('queso.revive')

    controller.setRevivePreference('always')
    await flush()
    expect(useSettings.getState().settings.revivePreference).toBe('always')
    expect(host.pendingReaction?.kind).toBe('queso.revive') // still asked: the row is about the next prompts
    expect(session.debugRecord().state.units.some((u) => u.id === b.id('S'))).toBe(false) // not revived by it

    await host.respondToReaction('no')
    await flush()
    expect(session.debugRecord().state.seats.host.preferences['revive']).toBe('always') // sent once the prompt was answered
    controller.dispose()
    session.close()
  })
})
