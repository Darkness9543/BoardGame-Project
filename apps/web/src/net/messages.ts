// The message catalogue (NC 7.6), as sent over the wire: `{ v, t, b }` = protocol version, type, body, as JSON
// text. The host sends each guest only its own projection (PlayerView) and filtered events, never a GameState,
// except the post-game audit once the fog has lifted (NC 7.19 #1, #10). guards.ts parses every inbound message.

import type { GameState, Intent, LogEntry, PlayerView, Seat, VisibleEvent } from '@coinduel/engine'
import type { DispatchResult } from '../contracts'
import { PROTOCOL_VERSION } from './constants'
import type { Versions } from './versions'

/** The sealed submissions of S28 / R37: the army in the lobby and the placements in deployment. */
export type LockPhase = 'army' | 'deploy'

/** Why the R29 turn clock is stopped: a reaction prompt (R29), a take-back request (TB-4) or a lost link (2.12). */
export type ClockPause = 'decision' | 'takeback' | 'disconnected'

/** The turn clock as measured by the host at send time; the guest counts down from its own receipt time. */
export interface ClockWire {
  readonly activeSeat: Seat
  readonly running: boolean
  readonly pausedBy: ClockPause | null
  readonly turnMs: number
  readonly bankMs: Readonly<Record<Seat, number>>
}

/** One commit-reveal coin flip round (R37): the host's commitment, and its nonce once the flip is done. */
export interface CoinWire {
  readonly round: number
  readonly commit: string
  readonly hostNonce: string | null
}

/** Session state that rides with every view: clocks as remaining durations, and the commit-reveal state. */
export interface MetaWire {
  /** commitSecret of the game seed, published before any nonce is revealed (the coin flip mixes in the seed). */
  readonly seedCommit: string
  readonly clock: ClockWire | null
  /** Until the pending take-back request auto-declines (TB-4). */
  readonly takebackMs: number | null
  /** Until the guest's own pending reaction prompt answers itself (A2-30). */
  readonly decisionMs: number | null
  /** The host's current sealed submissions; the guest reveals its own only against one of these. */
  readonly commits: Readonly<Record<LockPhase, string | null>>
  readonly coin: CoinWire | null
}

export type SnapshotReason = 'join' | 'resync' | 'takeback' | 'reset'
export type ResyncReason = 'gap' | 'hash' | 'epoch'
export type RejectReason = 'version' | 'full' | 'bad-invite'
export type Presence = 'active' | 'hidden'

/** One projection for the guest: the view itself (not a patch), its hash, and the host's state hash for the audit. */
export interface DeliveryBody {
  /** +1 per update to this guest; a snapshot resets the count. */
  readonly seq: number
  /** +1 whenever the timeline is rewritten (an accepted take-back, a rematch); older intents are refused. */
  readonly epoch: number
  readonly events: readonly VisibleEvent[]
  readonly view: PlayerView
  readonly viewHash: string
  readonly stateHash: string
  /** Log entries behind this view: where the audit replay checks the two hashes. */
  readonly logLength: number
  readonly meta: MetaWire
}

/** Sent once the game is over: everything the guest needs to replay and check the match (R37). */
export interface AuditBody {
  readonly initial: GameState
  readonly log: readonly LogEntry[]
  /** Commitment hash -> salt, for every commitment the host published. */
  readonly salts: Readonly<Record<string, string>>
}

interface Envelope<T extends string, B> {
  readonly v: typeof PROTOCOL_VERSION
  readonly t: T
  readonly b: B
}

// ---------------------------------------------------------------- guest -> host

export type HelloMessage = Envelope<
  'hello',
  {
    readonly versions: Versions
    readonly name: string
    readonly proof: string
    /** Issued by the host's welcome; proves this is the seated guest coming back (NC 7.11). */
    readonly seatToken: string | null
    readonly lastSeq: number | null
    /** "Resync from hash": if either still matches, the host answers `synced` instead of a full snapshot. */
    readonly viewHash: string | null
    readonly stateHash: string | null
    /** Intents sent before the link dropped and never answered. */
    readonly pending: readonly string[]
  }
>
export type IntentMessage = Envelope<'intent', { readonly id: string; readonly epoch: number; readonly intent: Intent }>
export type ResyncMessage = Envelope<'resync', { readonly reason: ResyncReason }>
/** "I pressed Ready / Confirm and wait for your commitment" (the host shows it at once). */
export type LockMessage = Envelope<'lock', { readonly phase: LockPhase; readonly locked: boolean }>
/** The guest's sealed submission in clear, valid only while the host still holds commitment `against`. */
export type RevealMessage = Envelope<'reveal', { readonly id: string; readonly phase: LockPhase; readonly against: string; readonly intents: readonly Intent[] }>
export type CoinRevealMessage = Envelope<'coinReveal', { readonly round: number; readonly nonce: string }>

// ---------------------------------------------------------------- host -> guest

export type WelcomeMessage = Envelope<
  'welcome',
  {
    readonly versions: Versions
    readonly seatToken: string
    readonly hostName: string
    readonly roomId: string
    /** Ids of the hello's unanswered intents that the host still holds (queued behind a prompt, 2.11): they stay pending. */
    readonly stillPending: readonly string[]
  }
>
export type RejectMessage = Envelope<'reject', { readonly reason: RejectReason; readonly message: string; readonly versions: Versions }>
export type SnapshotMessage = Envelope<'snapshot', DeliveryBody & { readonly why: SnapshotReason }>
export type UpdateMessage = Envelope<'update', DeliveryBody>
export type SyncedMessage = Envelope<'synced', { readonly seq: number; readonly epoch: number; readonly meta: MetaWire }>
export type MetaMessage = Envelope<'meta', { readonly meta: MetaWire }>
export type ResultMessage = Envelope<'result', { readonly id: string; readonly result: DispatchResult }>
export type AuditMessage = Envelope<'audit', AuditBody>

// ---------------------------------------------------------------- both directions

/** The host's pings list the guest intents it still holds, so their answers aren't given up as lost while they wait. */
export type PingMessage = Envelope<'ping', { readonly n: number; readonly t: number; readonly waiting: readonly string[] }>
export type PongMessage = Envelope<'pong', { readonly n: number; readonly t: number; readonly waiting: readonly string[] }>
export type PresenceMessage = Envelope<'presence', { readonly state: Presence }>
export type ByeMessage = Envelope<'bye', { readonly reason: 'leave' | 'replaced' }>

type SharedMessage = PingMessage | PongMessage | PresenceMessage | ByeMessage

export type GuestMessage = HelloMessage | IntentMessage | ResyncMessage | LockMessage | RevealMessage | CoinRevealMessage | SharedMessage
export type HostMessage =
  | WelcomeMessage
  | RejectMessage
  | SnapshotMessage
  | UpdateMessage
  | SyncedMessage
  | MetaMessage
  | ResultMessage
  | AuditMessage
  | SharedMessage

type AnyMessage = GuestMessage | HostMessage
export type MessageType = AnyMessage['t']
export type BodyOf<T extends MessageType> = Extract<AnyMessage, { readonly t: T }>['b']

/** Serialises one message for the transport. */
export function wire<T extends MessageType>(t: T, b: BodyOf<T>): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, t, b })
}
