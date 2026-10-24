import { describe, expect, it } from 'vitest'
import { canonicalJson, fnv1a64Hex, hashJson, sha256Hex } from './hash'
import { combineSecrets, commitSecret, flipFirstSeat, nextId, nextUint32, seedRng, verifySecret } from './rng'

describe('SHA-256 (commit-reveal, S28)', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['é', '4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c'],
    ['héllo wörld 🎲', 'bd234629787ac3233cff7c703046f7e0491c9dcf9321ac6a18e48ad5c34d9e68'],
  ])('sha256(%j)', (input, expected) => {
    expect(sha256Hex(input)).toBe(expected)
  })

  it('handles inputs longer than one block', () => {
    expect(sha256Hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3')
  })
})

describe('FNV-1a 64 (sync hashes)', () => {
  it.each([
    ['', 'cbf29ce484222325'],
    ['a', 'af63dc4c8601ec8c'],
    ['foobar', '85944171f73967e8'],
  ])('fnv1a64(%j)', (input, expected) => {
    expect(fnv1a64Hex(input)).toBe(expected)
  })

  it('hashes canonical JSON, so key order does not matter', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}')
    expect(hashJson({ x: 1, y: 2 })).toBe(hashJson({ y: 2, x: 1 }))
    expect(hashJson({ x: 1 })).not.toBe(hashJson({ x: 2 }))
  })
})

describe('seeded RNG and commit-reveal (A2-04)', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const run = (seed: string) => {
      let rng = seedRng(seed)
      const out: number[] = []
      for (let i = 0; i < 5; i++) {
        const [value, next] = nextUint32(rng)
        out.push(value)
        rng = next
      }
      return out
    }
    expect(run('alpha')).toEqual(run('alpha'))
    expect(run('alpha')).not.toEqual(run('beta'))
    for (const v of run('alpha')) expect(Number.isInteger(v) && v >= 0 && v < 2 ** 32).toBe(true)
  })

  it('flips both outcomes over many seeds', () => {
    const seats = new Set(Array.from({ length: 40 }, (_, i) => flipFirstSeat(seedRng(`s${i}`))[0]))
    expect(seats).toEqual(new Set(['host', 'guest']))
  })

  it('draws opaque ids', () => {
    const [id] = nextId(seedRng('x'), 'u')
    expect(id).toMatch(/^u-[0-9a-z]{7}$/)
  })

  it('verifies commitments and combines both secrets', () => {
    const commitment = commitSecret('host-nonce')
    expect(verifySecret(commitment, 'host-nonce')).toBe(true)
    expect(verifySecret(commitment, 'other')).toBe(false)
    expect(combineSecrets('a', 'b')).not.toBe(combineSecrets('b', 'a'))
    expect(combineSecrets('a', 'b')).toMatch(/^[0-9a-f]{64}$/)
  })
})
