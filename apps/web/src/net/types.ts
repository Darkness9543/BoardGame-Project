// The session layer's public types. NetSession is the contract's Session (apps/web/src/contracts.ts) plus what the
// UI needs from this layer: the R29 clock, take-back deadline, room and invite, link health, fairness checks,
// a short delivery history and lifecycle calls. README.md documents the whole surface.

import type { MatchRecord, MatchSettings, Seat } from '@coinduel/engine'
import type { DispatchResult, Session, TakebackOperations } from '../contracts'
import type { Clock } from './clock'
import type { SessionEnvironment } from './environment'
import type { AuditVerdict } from './fairness'
import type { NetSettings } from './ice'
import type { Invite } from './invite'
import type { RandomSource } from './random'
import type { SessionUpdate } from './seatFeed'
import type { KeyValueStore } from './storage'
import type { TransportFactory } from './transport'
import type { TurnClockView } from './turnClock'
import type { Versions } from './versions'

export type SessionMode = 'local' | 'host' | 'guest'

export type SessionProblemKind = 'version' | 'room-full' | 'bad-invite' | 'insecure-context' | 'transport' | 'desync' | 'closed'

/** Something the player must be told about; the session keeps running unless `kind` says otherwise. */
export interface SessionProblem {
  readonly kind: SessionProblemKind
  readonly message: string
}

export interface RoomInfo {
  readonly roomId: string
  /** The room id grouped for reading aloud: "9F3K-Q2M7-TX". */
  readonly code: string
  /** Host only: the link to share (the guest's copy would carry the same secret). */
  readonly inviteLink: string | null
}

/** Commit-reveal and audit state (S28 / R37). */
export interface FairnessView {
  /** Anything suspicious seen during the match (for example the host picking its army again after yours was revealed). */
  readonly notes: readonly string[]
  /** The record to check is here: the host's audit arrived (guest), or the game is over (host, sandbox). */
  readonly auditReady: boolean
  /** The last result of `verify()`. */
  readonly verdict: AuditVerdict | null
  /** Replays the match with the engine and checks every commitment and hash; null if there is nothing to check yet. */
  verify(): AuditVerdict | null
}

export interface NetTakebackOperations extends TakebackOperations {
  /** Epoch ms (session clock) when the pending request auto-declines (TAKEBACK_TIMEOUT_S), or null. */
  readonly deadline: number | null
}

export interface NetSession extends Session {
  readonly mode: SessionMode
  /** False only for a guest that has not received its first view yet (`view` is then a placeholder lobby). */
  readonly synced: boolean
  readonly takeback: NetTakebackOperations
  /** The R29 turn timer, or null when it is off or not running (lobby, deployment, game over). */
  readonly clock: TurnClockView | null
  readonly room: RoomInfo | null
  /** Round-trip time to the other browser, from the heartbeat. */
  readonly rttMs: number | null
  readonly problem: SessionProblem | null
  readonly fairness: FairnessView
  /** +1 per delivered view; compare with history[].seq to replay batches a render skipped. */
  readonly updateSeq: number
  /** The last deliveries (events + view), oldest first: the opponent-turn replay reads it. */
  readonly history: readonly SessionUpdate[]
  /** Answers the pending reaction prompt (sugar for dispatch respondDecision). */
  respondToReaction(choice: string): Promise<DispatchResult>
  /** Host and sandbox: a new match with the same players and settings once this one has ended. */
  rematch(): Promise<DispatchResult>
  /** Leaves the room and stops every timer. */
  close(): void
}

/** The sandbox: both seats in one browser, each still shown only its own projection. */
export interface LocalSession extends NetSession {
  readonly mode: 'local'
  /** Switches which seat this session (and so the UI) acts as. */
  setSeat(seat: Seat): void
  /** Follow the player who must act: the active seat, or the one answering a prompt or a take-back request. */
  readonly followTurn: boolean
  setFollowTurn(on: boolean): void
  /** A session pinned to one seat (two boards side by side, tests). */
  endpoint(seat: Seat): NetSession
  /** Spoilers: the full record with the true state (dev tools, export, bug reports). */
  debugRecord(): MatchRecord
}

interface CommonConfig {
  readonly clock?: Clock
  readonly random?: RandomSource
  readonly storage?: KeyValueStore
  readonly environment?: SessionEnvironment
}

export interface LocalSessionConfig extends CommonConfig {
  readonly mode: 'local'
  readonly names?: Partial<Record<Seat, string>>
  /** R29: the sandbox has no turn timer unless these settings switch it on. */
  readonly settings?: Partial<MatchSettings>
  readonly seed?: string
  /** A fixed coin seed instead of fresh nonces, for reproducible sandbox games and tests. */
  readonly coinSeed?: string
  /** Start from this record instead of a new lobby (a DSL battle, a saved match). */
  readonly record?: MatchRecord
  /** Default true. */
  readonly followTurn?: boolean
  readonly startSeat?: Seat
}

interface NetConfig extends CommonConfig {
  readonly name: string
  readonly net?: Partial<NetSettings>
  /** Defaults to the lazily loaded Trystero transport. */
  readonly transport?: TransportFactory
  /** The deployed build id shown in version errors (e.g. a git SHA). */
  readonly build?: string
  /** Testing only: advertise other versions in the handshake. */
  readonly versions?: Partial<Versions>
}

export interface HostSessionConfig extends NetConfig {
  readonly mode: 'host'
  /** R29: online lobbies start with the turn timer on (90 s + 60 s bank). */
  readonly settings?: Partial<MatchSettings>
  /** The page address invite links are built from (default: the current page). */
  readonly baseUrl?: string
  /** Reopen this saved room (the `#/host/<roomId>` route) instead of creating one. */
  readonly resume?: string
  /** Start from this record (a saved match file). */
  readonly record?: MatchRecord
}

export interface GuestSessionConfig extends NetConfig {
  readonly mode: 'guest'
  readonly invite: Invite
}

export type SessionConfig = LocalSessionConfig | HostSessionConfig | GuestSessionConfig
