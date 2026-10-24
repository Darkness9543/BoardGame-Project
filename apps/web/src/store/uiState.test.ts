import { describe, expect, it } from 'vitest'
import { useSessionStore } from './sessionStore'
import { useSettings } from './settings'
import { memoryStore, setAppStore } from './storage'
import { useUiState } from './uiState'

describe('the camera view (A1-16)', () => {
  it('follows the Default view option at once, and starts every new match in it', () => {
    setAppStore(memoryStore())
    useSettings.getState().update({ defaultView: 'iso' })
    expect(useUiState.getState().cameraMode).toBe('iso')
    useUiState.getState().toggleCamera()
    expect(useUiState.getState().cameraMode).toBe('top')
    useSessionStore.setState({ roomId: 'room-a' })
    expect(useUiState.getState().cameraMode).toBe('iso')
    useUiState.getState().toggleCamera()
    useSessionStore.setState({ roomId: 'room-a' }) // the same match: the player's toggle stays
    expect(useUiState.getState().cameraMode).toBe('top')
    useSessionStore.setState({ roomId: 'room-b' })
    expect(useUiState.getState().cameraMode).toBe('iso')
    useSettings.getState().update({ defaultView: 'top' })
    expect(useUiState.getState().cameraMode).toBe('top')
  })
})
