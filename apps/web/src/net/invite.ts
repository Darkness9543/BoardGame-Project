// Invite links and room identity (NC 7.4). The link is `<site>#/join/<roomId>/<secret>`: the fragment never
// reaches the HTTP server, needs no rewrites on a static host and works on file://. The random roomId names the
// signalling room; the secret is Trystero's SDP password and, hashed, the guest's proof of invitation.

import { sha256Hex } from '@coinduel/engine'
import { ROOM_ID_PATTERN, SECRET_PATTERN } from './random'

export interface Invite {
  readonly roomId: string
  readonly secret: string
}

const JOIN_HASH = /^#?\/join\/([0-9A-Za-z]+)\/([A-Za-z0-9_-]+)\/?$/
const HOST_HASH = /^#?\/host\/([0-9A-Za-z]+)\/?$/

function normaliseRoomId(raw: string): string | null {
  const upper = raw.toUpperCase()
  return ROOM_ID_PATTERN.test(upper) ? upper : null
}

/** `#/join/<roomId>/<secret>` (with or without the '#') to an invite; null for anything else. */
export function parseInviteHash(hash: string): Invite | null {
  const match = JOIN_HASH.exec(hash.trim())
  if (match === null) return null
  const roomId = normaliseRoomId(match[1] ?? '')
  const secret = match[2] ?? ''
  return roomId !== null && SECRET_PATTERN.test(secret) ? { roomId, secret } : null
}

const BARE_INVITE = /^([0-9A-Za-z-]+)\/([A-Za-z0-9_-]+)$/

/**
 * A pasted invite (the "paste invite link" box, NC Q24): a whole link, its `#/join/...` part, or just
 * `ROOM/SECRET`, where the room may be written as its dashed code ("9F3K-Q2M7-TX").
 */
export function parseInviteText(text: string): Invite | null {
  const trimmed = text.trim()
  const at = trimmed.indexOf('#')
  if (at !== -1) return parseInviteHash(trimmed.slice(at))
  const bare = BARE_INVITE.exec(trimmed)
  if (bare === null) return parseInviteHash(trimmed)
  return parseInviteHash(`#/join/${(bare[1] ?? '').replace(/-/g, '')}/${bare[2] ?? ''}`)
}

export function inviteHash(invite: Invite): string {
  return `#/join/${invite.roomId}/${invite.secret}`
}

/** The link to share: the page address without its fragment, plus the invite fragment. */
export function inviteLink(baseUrl: string, invite: Invite): string {
  const at = baseUrl.indexOf('#')
  return `${at === -1 ? baseUrl : baseUrl.slice(0, at)}${inviteHash(invite)}`
}

/** The host's own resume address (NC 7.4): the secret stays in the host's storage. */
export function hostResumeHash(roomId: string): string {
  return `#/host/${roomId}`
}

export function parseHostHash(hash: string): string | null {
  const match = HOST_HASH.exec(hash.trim())
  return match === null ? null : normaliseRoomId(match[1] ?? '')
}

/** "9F3KQ2M7TX" as "9F3K-Q2M7-TX", for "does your friend see the same code?". */
export function roomCode(roomId: string): string {
  return (roomId.match(/.{1,4}/g) ?? []).join('-')
}

/** What the guest's hello carries to prove it holds the secret, without sending the secret itself. */
export function invitationProof(invite: Invite): string {
  return sha256Hex(`coinduel-invite|${invite.roomId}|${invite.secret}`)
}
