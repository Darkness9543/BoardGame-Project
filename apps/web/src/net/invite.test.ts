import { describe, expect, it } from 'vitest'
import { hostResumeHash, inviteHash, inviteLink, invitationProof, parseHostHash, parseInviteHash, parseInviteText, roomCode } from './invite'
import { cryptoRandom, newRoomId, newSecret, ROOM_ID_PATTERN, SECRET_PATTERN, type RandomSource } from './random'

const fixedRandom = (byte: number): RandomSource => ({ fill: (bytes) => bytes.fill(byte) })

describe('invite links (NC 7.4)', () => {
  it('makes a 10-character Crockford room id and a 22-character base64url secret', () => {
    for (let i = 0; i < 50; i++) {
      expect(newRoomId(cryptoRandom)).toMatch(ROOM_ID_PATTERN)
      expect(newSecret(cryptoRandom)).toMatch(SECRET_PATTERN)
    }
    expect(newRoomId(fixedRandom(31))).toBe('ZZZZZZZZZZ')
  })

  it('round-trips through the hash and the shared link', () => {
    const invite = { roomId: '9F3KQ2M7TX', secret: 'Q2xhdWRlUm9ja3NIZXJlIS' }
    expect(inviteHash(invite)).toBe('#/join/9F3KQ2M7TX/Q2xhdWRlUm9ja3NIZXJlIS')
    expect(parseInviteHash(inviteHash(invite))).toEqual(invite)
    const link = inviteLink('https://owner.github.io/coinduel/?x=1#/lobby', invite)
    expect(link).toBe('https://owner.github.io/coinduel/?x=1#/join/9F3KQ2M7TX/Q2xhdWRlUm9ja3NIZXJlIS')
    expect(parseInviteText(`  ${link}  `)).toEqual(invite)
    expect(parseInviteHash('/join/9f3kq2m7tx/Q2xhdWRlUm9ja3NIZXJlIS')).toEqual(invite)
  })

  it.each([
    ['#/join/9F3KQ2M7TX'],
    ['#/join/9F3KQ2M7T/Q2xhdWRlUm9ja3NIZXJlIS'],
    ['#/join/9F3KQ2M7TU/Q2xhdWRlUm9ja3NIZXJlIS'],
    ['#/join/9F3KQ2M7TX/short'],
    ['#/join/9F3KQ2M7TX/Q2xhdWRlUm9ja3NIZXJlIS/extra'],
    ['#/host/9F3KQ2M7TX'],
    [''],
  ])('rejects %s', (hash) => {
    expect(parseInviteHash(hash)).toBeNull()
  })

  it('parses the host resume route and formats the room code', () => {
    expect(parseHostHash(hostResumeHash('9F3KQ2M7TX'))).toBe('9F3KQ2M7TX')
    expect(parseHostHash('#/join/9F3KQ2M7TX/Q2xhdWRlUm9ja3NIZXJlIS')).toBeNull()
    expect(roomCode('9F3KQ2M7TX')).toBe('9F3K-Q2M7-TX')
  })

  it('proves the secret without containing it', () => {
    const invite = { roomId: '9F3KQ2M7TX', secret: 'Q2xhdWRlUm9ja3NIZXJlIS' }
    const proof = invitationProof(invite)
    expect(proof).toMatch(/^[0-9a-f]{64}$/)
    expect(proof).not.toContain(invite.secret)
    expect(invitationProof({ ...invite, secret: 'Q2xhdWRlUm9ja3NIZXJlIT' })).not.toBe(proof)
  })
})
