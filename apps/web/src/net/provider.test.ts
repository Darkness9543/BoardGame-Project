import { describe, expect, it } from 'vitest'
import { netProvider } from './provider'
import { memoryStore } from './storage'
import { FakeHub } from './testing/fakeNetwork'
import { ManualClock } from './testing/manualClock'
import { parseInviteText } from './invite'

describe('netProvider (the app adapter over createSession)', () => {
  it('hosts, joins, resumes the live session, and forgets a room it left', async () => {
    const hub = new FakeHub()
    const clock = new ManualClock()
    const hostSide = netProvider({ storage: memoryStore(), transport: hub.factory, clock, baseUrl: 'https://x.test/' })
    const guestSide = netProvider({ storage: memoryStore(), transport: hub.factory, clock })
    const { roomId, session: host } = await hostSide.host({ name: 'Hana', settings: { scenarioId: 'openField' } })
    const invite = parseInviteText(host.lobby.inviteLink ?? '')
    if (invite === null) throw new Error('no invite link')
    expect(invite.roomId).toBe(roomId)
    const guest = await guestSide.join({ ...invite, name: 'Gil' })
    await hub.settle()
    expect(guest.connection).toBe('connected')
    expect(await guestSide.resume(roomId, 'Gil')).toBe(guest)
    expect(await hostSide.resume(roomId, 'Hana')).toBe(host)
    await expect(hostSide.join({ ...invite, name: 'Hana' })).rejects.toThrow(/host of this game/)
    await expect(guestSide.rematch(roomId)).rejects.toThrow(/Only the host/)
    guestSide.leave(roomId)
    expect(await guestSide.resume(roomId, 'Gil')).toBeNull()
    hostSide.leave(roomId)
    expect(await hostSide.resume(roomId, 'Hana')).toBeNull()
  })

  it('reopens a hosted room from storage after a reload', async () => {
    const hub = new FakeHub()
    const storage = memoryStore()
    const first = netProvider({ storage, transport: hub.factory, clock: new ManualClock() })
    const { roomId, session } = await first.host({ name: 'Hana' })
    session.close()
    const second = netProvider({ storage, transport: hub.factory, clock: new ManualClock() })
    const resumed = await second.resume(roomId, 'Hana')
    expect(resumed?.lobby.inviteLink).toBe(session.lobby.inviteLink)
  })
})
