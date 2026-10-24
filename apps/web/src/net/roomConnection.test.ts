import { describe, expect, it } from 'vitest'
import { netSettings } from './ice'
import { RoomConnection } from './roomConnection'
import type { TransportFactory } from './transport'

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const env = { VITE_METERED_APP: undefined, VITE_METERED_KEY: undefined, VITE_TURN_URLS: undefined, VITE_TURN_USERNAME: undefined, VITE_TURN_CREDENTIAL: undefined }

describe('RoomConnection', () => {
  it('keeps what is sent before the transport is ready (a peer replayed while joining) and delivers it in order', async () => {
    const sent: string[] = []
    const factory: TransportFactory = (_join, handlers) => {
      handlers.onPeerJoin('peer-early') // Trystero replays peers already in the room when the handler is set
      return Promise.resolve({ send: (_peer, text) => sent.push(text), close: () => undefined })
    }
    let connection: RoomConnection | null = null
    connection = new RoomConnection({ appId: 'a', roomId: 'r', secret: 's' }, netSettings({}, env), factory, {
      onMessage: () => undefined,
      onPeerJoin: (peer) => {
        connection?.send(peer, 'hello')
        connection?.send(peer, 'again')
      },
      onPeerLeave: () => undefined,
      onProblem: () => undefined,
      onConnectError: () => undefined,
    })
    connection.open()
    await settle()
    expect(sent).toEqual(['hello', 'again'])
  })

  it('ignores a transport that arrives after the connection was reopened or closed', async () => {
    const closed: string[] = []
    let calls = 0
    const factory: TransportFactory = () => {
      const id = `t${++calls}`
      return Promise.resolve({ send: () => undefined, close: () => closed.push(id) })
    }
    const connection = new RoomConnection({ appId: 'a', roomId: 'r', secret: 's' }, netSettings({}, env), factory, {
      onMessage: () => undefined,
      onPeerJoin: () => undefined,
      onPeerLeave: () => undefined,
      onProblem: () => undefined,
      onConnectError: () => undefined,
    })
    connection.open()
    connection.open() // the first one is stale before it even arrives
    await settle()
    connection.close()
    expect(closed).toEqual(['t1', 't2'])
  })

  it('reads TURN servers from the build environment', () => {
    expect(netSettings({}, { ...env, VITE_TURN_URLS: 'turn:a.example:3478, turns:a.example:443', VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'p' })).toMatchObject({
      appId: 'coinduel-p2p-v1',
      iceServers: [{ urls: ['turn:a.example:3478', 'turns:a.example:443'], username: 'u', credential: 'p' }],
      metered: null,
    })
    expect(netSettings({}, { ...env, VITE_METERED_APP: 'coinduel', VITE_METERED_KEY: 'k' }).metered).toEqual({ appName: 'coinduel', apiKey: 'k' })
    expect(netSettings({}, env).iceServers).toEqual([]) // STUN only by default
  })
})
