// Commit-reveal and the post-game audit (S28 / R37, NC 7.15). With host authority the host could counter-pick an
// army or a deployment, or bias the first-player coin flip. So the host publishes a salted commitment of its own
// submission before the guest reveals one, commits to the game seed before any coin nonce is revealed, and after
// the game sends its whole record; the guest replays it with the same engine and checks every commitment and
// every view and state hash it received. It makes host cheating detectable, not impossible (NC 7.15).

import {
  canonicalJson,
  combineSecrets,
  commitSecret,
  hashJson,
  hashState,
  projectView,
  startRecord,
  submit,
  verifySecret,
  type ArmyList,
  type GameState,
  type MatchRecord,
  type Seat,
  type Square,
  type UnitId,
} from '@coinduel/engine'
import type { AuditBody, LockPhase } from './messages'

export interface Placement {
  readonly unitId: UnitId
  readonly anchor: Square
}

export const seedCommitment = (seed: string): string => commitSecret(`seed|${seed}`)

/** The canonical text a commitment covers. */
export function armyPayload(army: ArmyList): string {
  return canonicalJson(army)
}

export function seatPlacements(state: GameState, seat: Seat): Placement[] {
  return state.units
    .filter((u) => u.owner === seat && u.anchor !== null)
    .flatMap((u) => (u.anchor === null ? [] : [{ unitId: u.id, anchor: { x: u.anchor.x, y: u.anchor.y } }]))
    .sort((a, b) => (a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0))
}

export function placementPayload(placements: readonly Placement[]): string {
  return canonicalJson(placements)
}

export function commitment(phase: LockPhase, payload: string, salt: string): string {
  return commitSecret(`${phase}|${salt}|${payload}`)
}

/** What the guest recorded while playing, to check the audit against. */
export interface FairnessRecord {
  readonly seedCommit: string | null
  /** The coin flip that started the deployment: the host's commitment and nonce, and the guest's nonce. */
  readonly coin: { readonly commit: string; readonly hostNonce: string; readonly guestNonce: string } | null
  /** The host commitment each sealed submission was revealed against (the reveal the host accepted). */
  readonly revealedAgainst: Readonly<Record<LockPhase, string | null>>
  /**
   * The host commitment each sealed submission was first sent against. The host holds the data from then on, even if
   * it refused that reveal, so its final choice must still match this commitment.
   */
  readonly sentAgainst: Readonly<Record<LockPhase, string | null>>
  /** logLength -> the hashes the host sent with the view at that point. */
  readonly hashes: Readonly<Record<string, { readonly viewHash: string; readonly stateHash: string }>>
}

export const EMPTY_FAIRNESS: FairnessRecord = { seedCommit: null, coin: null, revealedAgainst: { army: null, deploy: null }, sentAgainst: { army: null, deploy: null }, hashes: {} }

export type AuditVerdict =
  | { readonly ok: true; readonly checks: number; readonly entries: number }
  | { readonly ok: false; readonly checks: number; readonly entries: number; readonly problems: readonly string[] }

function checkHashes(record: FairnessRecord, state: GameState, logLength: number, problems: string[]): number {
  const expected = record.hashes[String(logLength)]
  if (expected === undefined) return 0
  if (hashJson(projectView(state, 'guest')) !== expected.viewHash) problems.push(`The view you were shown after move ${logLength} does not match the replay`)
  if (hashState(state) !== expected.stateHash) problems.push(`The host's game state after move ${logLength} does not match the replay`)
  return 2
}

const WHAT: Readonly<Record<LockPhase, string>> = { army: 'army', deploy: 'deployment' }

function checkCommit(phase: LockPhase, payload: string, against: string | null, salts: Readonly<Record<string, string>>, problems: string[], when: string): number {
  if (against === null) return 0
  const salt = salts[against]
  if (salt === undefined || commitment(phase, payload, salt) !== against) problems.push(`The host's ${WHAT[phase]} differs from the one it locked ${when}`)
  return 1
}

/** The host's final submission against the commitment the guest's was accepted under, and the one it was first sent under. */
function checkCommits(phase: LockPhase, payload: string, record: FairnessRecord, salts: Readonly<Record<string, string>>, problems: string[]): number {
  let checks = checkCommit(phase, payload, record.revealedAgainst[phase], salts, problems, 'before seeing yours')
  const sent = record.sentAgainst[phase]
  if (sent !== null && sent !== record.revealedAgainst[phase]) checks += checkCommit(phase, payload, sent, salts, problems, 'when you sent yours')
  return checks
}

/**
 * Replays the host's record (the same submit() the host ran) and checks it against what the guest saw.
 * Synchronous; a long match replays in well under a second.
 */
export function verifyAudit(audit: AuditBody, record: FairnessRecord): AuditVerdict {
  const problems: string[] = []
  let checks = 1
  // A shorter record could hide whatever happened after its end: it must cover every view the guest was shown.
  const seen = Math.max(0, ...Object.keys(record.hashes).map(Number))
  if (audit.log.length < seen) problems.push(`The record stops at move ${audit.log.length}, but you were shown move ${seen}`)
  if (record.seedCommit !== null) {
    checks += 1
    if (seedCommitment(audit.initial.seed) !== record.seedCommit) problems.push('The game seed differs from the one the host committed to')
  }
  let replayed: MatchRecord = startRecord(audit.initial)
  checks += checkHashes(record, replayed.state, 0, problems)
  for (const [index, entry] of audit.log.entries()) {
    const before = replayed.state
    if (entry.intent.kind === 'startDeployment') {
      const army = before.seats.host.army
      checks += checkCommits('army', army === null ? '' : armyPayload(army), record, audit.salts, problems)
      if (record.coin !== null) {
        checks += 1
        const { commit, hostNonce, guestNonce } = record.coin
        if (!verifySecret(commit, hostNonce) || entry.intent.coinSeed !== combineSecrets(hostNonce, guestNonce)) {
          problems.push('The coin flip used a different seed than the two revealed nonces')
        }
      }
    }
    const result = submit(replayed, entry.seat, entry.intent)
    if (!result.ok) {
      problems.push(`Move ${index + 1} (${entry.intent.kind}) is not legal on replay: ${result.message}`)
      return { ok: false, checks, entries: index, problems }
    }
    replayed = result.record
    if (before.phase === 'deployment' && replayed.state.phase === 'battle') {
      checks += checkCommits('deploy', placementPayload(seatPlacements(before, 'host')), record, audit.salts, problems)
    }
    checks += checkHashes(record, replayed.state, index + 1, problems)
  }
  return problems.length === 0 ? { ok: true, checks, entries: audit.log.length } : { ok: false, checks, entries: audit.log.length, problems }
}

/** The host's own check (R37's audit from its side): the log replays to exactly the state it holds. */
export function verifyOwnRecord(record: MatchRecord): AuditVerdict {
  let replayed = startRecord(record.initial)
  for (const [index, entry] of record.log.entries()) {
    const next = submit(replayed, entry.seat, entry.intent)
    if (!next.ok) return { ok: false, checks: 1, entries: index, problems: [`Move ${index + 1} (${entry.intent.kind}) is not legal on replay: ${next.message}`] }
    replayed = next.record
  }
  const entries = record.log.length
  return hashState(replayed.state) === hashState(record.state)
    ? { ok: true, checks: 1, entries }
    : { ok: false, checks: 1, entries, problems: ['The replay differs from the live state'] }
}
