// Random identifiers for client-side records (profiles, saved armies, rooms). The engine's own ids come from its
// seeded RNG; these never enter the rules.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32

export function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

/** `length` Crockford base32 characters (5 bits each). */
export function randomCode(length: number): string {
  let out = ''
  for (const byte of randomBytes(length)) out += ALPHABET.charAt(byte % 32)
  return out
}

export function randomId(prefix: string): string {
  return `${prefix}-${randomCode(12).toLowerCase()}`
}

