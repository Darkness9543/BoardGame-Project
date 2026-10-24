// The version handshake (NC 7.17): both peers must run the same protocol, engine, rules and state schema, or
// the guest is refused with a message that tells both players what to do. The build id is informational.

import { ENGINE_VERSION, RULES_VERSION, SCHEMA_VERSION } from '@coinduel/engine'
import { PROTOCOL_VERSION } from './constants'

export interface Versions {
  readonly protocol: number
  readonly engine: string
  readonly rules: number
  readonly schema: number
  /** The deployed build (a git SHA injected by Vite, or 'dev'); not compared, only named in the mismatch message. */
  readonly build: string
}

export function localVersions(build: string, override: Partial<Versions> = {}): Versions {
  return { protocol: PROTOCOL_VERSION, engine: ENGINE_VERSION, rules: RULES_VERSION, schema: SCHEMA_VERSION, build, ...override }
}

function describe(v: Versions): string {
  return `build ${v.build}: engine ${v.engine}, rules ${v.rules}, protocol ${v.protocol}, schema ${v.schema}`
}

/** null when compatible; otherwise the message both players see. `theirRole` names the other side. */
export function versionMismatch(mine: Versions, theirs: Versions, theirRole: 'host' | 'guest'): string | null {
  const same = mine.protocol === theirs.protocol && mine.engine === theirs.engine && mine.rules === theirs.rules && mine.schema === theirs.schema
  if (same) return null
  return (
    `Your friend is running a different version of the game (${theirRole}: ${describe(theirs)}; you: ${describe(mine)}). ` +
    'Both of you should reload the page, then open the invite link again.'
  )
}
