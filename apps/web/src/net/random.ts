// Unpredictable tokens for rooms, invite secrets, seat tokens and commit-reveal nonces. The engine's seeded
// RNG is deterministic by design, so the session draws these from crypto.getRandomValues (injectable for tests).

import { ROOM_ID_LENGTH, SECRET_LENGTH } from './constants'

export interface RandomSource {
  fill(bytes: Uint8Array<ArrayBuffer>): void
}

export const cryptoRandom: RandomSource = {
  fill: (bytes) => {
    globalThis.crypto.getRandomValues(bytes)
  },
}

/** Crockford base32 (no I, L, O, U), easy to read aloud. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** Alphabet sizes are powers of two, so masking a byte is unbiased. */
function randomString(random: RandomSource, alphabet: string, length: number): string {
  const bytes = new Uint8Array(length)
  random.fill(bytes)
  let out = ''
  for (const byte of bytes) out += alphabet.charAt(byte & (alphabet.length - 1))
  return out
}

export const newRoomId = (random: RandomSource): string => randomString(random, CROCKFORD, ROOM_ID_LENGTH)
export const newSecret = (random: RandomSource): string => randomString(random, BASE64URL, SECRET_LENGTH)
export const newToken = (random: RandomSource): string => randomString(random, BASE64URL, SECRET_LENGTH)
export const newNonce = (random: RandomSource): string => randomString(random, BASE64URL, SECRET_LENGTH)
/** The engine's game seed: 192 bits, so the state hash the host shares can't be brute-forced (NC 7.9). */
export const newSeed = (random: RandomSource): string => randomString(random, BASE64URL, 32)
/** Intent ids only need to be unique per guest session. */
export const newShortId = (random: RandomSource): string => randomString(random, BASE64URL, 10)

export const ROOM_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/
export const SECRET_PATTERN = /^[A-Za-z0-9_-]{22}$/
