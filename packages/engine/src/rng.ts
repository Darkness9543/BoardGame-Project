// Seeded deterministic RNG (mulberry32) whose whole state is one uint32 stored in GameState, plus the
// commit-reveal helpers the session uses for a fair first-player coin flip (NC 7.15, S28). The engine
// never calls Math.random or reads the clock.

import { fnv1a32, sha256Hex } from './hash'
import type { RngState, Seat } from './types'

export function seedRng(seed: string): RngState {
  return { s: fnv1a32(seed) }
}

/** Returns a uint32 and the next state. */
export function nextUint32(rng: RngState): readonly [number, RngState] {
  const a = (rng.s + 0x6d2b79f5) >>> 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [(t ^ (t >>> 14)) >>> 0, { s: a }]
}

/** Integer in [0, n) by modulo: exactly uniform when n divides 2^32 (the coin flip uses n = 2). */
export function nextInt(rng: RngState, n: number): readonly [number, RngState] {
  const [value, next] = nextUint32(rng)
  return [value % n, next]
}

/** A2-04: the coin flip. The winner of the flip moves first and plays South. */
export function flipFirstSeat(rng: RngState): readonly [Seat, RngState] {
  const [bit, next] = nextInt(rng, 2)
  return [bit === 0 ? 'host' : 'guest', next]
}

/** Opaque id such as 'u-3k9f2a1' (NC 7.19 #2: ids must not reveal army size or creation order). */
export function nextId(rng: RngState, prefix: string): readonly [string, RngState] {
  const [value, next] = nextUint32(rng)
  return [`${prefix}-${value.toString(36).padStart(7, '0')}`, next]
}

// ---------------------------------------------------------------- commit-reveal (S28)

const COMMIT_PREFIX = 'coinduel-commit:'

/** Each side publishes commitSecret(nonce) first and reveals the nonce once both commitments are in. */
export function commitSecret(secret: string): string {
  return sha256Hex(COMMIT_PREFIX + secret)
}

export function verifySecret(commitment: string, secret: string): boolean {
  return commitSecret(secret) === commitment.toLowerCase()
}

/** The coin seed both sides can recompute from the two revealed nonces (pass it to startDeployment). */
export function combineSecrets(hostSecret: string, guestSecret: string): string {
  return sha256Hex(`${hostSecret}|${guestSecret}`)
}
