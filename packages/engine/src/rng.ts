// Seeded deterministic RNG (mulberry32, one uint32 of state) for the first-player coin flip, plus the commit-reveal
// helpers the session uses to make that flip fair (NC 7.15, S28). Ids are not drawn from it: a 32-bit state can be
// recovered from one output (state.drawId). The engine never calls Math.random or reads the clock.

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
