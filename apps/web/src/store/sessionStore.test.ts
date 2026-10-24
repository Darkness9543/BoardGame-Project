import { describe, expect, it } from 'vitest'
import { STARTER_ARMIES } from './armies'
import { useSessionStore } from './sessionStore'
import { setAppStore, memoryStore } from './storage'
import { useToasts } from './toasts'

setAppStore(memoryStore())

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('the sandbox', () => {
  it('follows the turn, and only the seat on screen raises toasts', async () => {
    useSessionStore.getState().startSkirmish({ host: 'Ann', guest: 'Bo' })
    const sandbox = useSessionStore.getState().sandbox
    if (sandbox === null) throw new Error('no sandbox')
    expect(sandbox.seat).toBe('host')
    const before = useToasts.getState().toasts.length

    expect((await sandbox.controllers.host.session.dispatch({ kind: 'endTurn' })).ok).toBe(true)
    await flush()

    expect(useSessionStore.getState().sandbox?.seat).toBe('guest')
    expect(useSessionStore.getState().controller).toBe(sandbox.controllers.guest)
    // The guest's beast starts beside the Market: one toast, from the guest's side only.
    expect(useToasts.getState().toasts.slice(before).map((t) => t.text)).toEqual(['You captured the Market'])
    useSessionStore.getState().detach()
  })

  it('runs the whole hot-seat flow: each seat readies its army in the lobby, then each deploys', async () => {
    const [first, second] = STARTER_ARMIES
    if (first === undefined || second === undefined) throw new Error('no starter armies')
    useSessionStore.getState().startSandbox({ names: { host: 'Ann', guest: 'Bo' }, settings: { scenarioId: 'openField' } })
    const store = () => useSessionStore.getState()
    expect(store().controller?.snapshot.view.phase).toBe('lobby')
    expect(store().sandbox?.seat).toBe('host')
    await store().controller?.session.lobby.setArmy(first.army)
    await store().controller?.session.lobby.setReady(true)
    expect(store().sandbox?.seat).toBe('guest')
    await store().controller?.session.lobby.setArmy(second.army)
    await store().controller?.session.lobby.setReady(true)
    await flush()
    expect(store().controller?.snapshot.view.phase).toBe('deployment')
    store().playAs('host')
    expect(store().controller).toBe(store().sandbox?.controllers.host)
    expect(store().controller?.snapshot.view.seat).toBe('host')
    store().detach()
    expect(store().mode).toBeNull()
  })
})
