// The session layer's public surface (README.md). The UI imports from here only.

export { canResumeHost, createSession } from './createSession'
export { skirmishRecord } from './skirmish'
export { netProvider, type NetProvider, type NetProviderOptions } from './provider'
export { hostResumeHash, inviteHash, inviteLink, parseHostHash, parseInviteHash, parseInviteText, roomCode, type Invite } from './invite'
export { clockRemaining, type ClockReading, type TurnClockView } from './turnClock'
export { clearMatchLog, readMatchLog, type MatchLogEntry, type MatchLogMode } from './matchLog'
export { browserStore, forgetGuestJoin, forgetHostRoom, memoryStore, type KeyValueStore } from './storage'
export { fetchMeteredIceServers, netSettings, type MeteredTurn, type NetSettings } from './ice'
export { BAD, cleanName, parseArmyList, parseIntent, type Parsed } from './guards'
export { browserEnvironment, headlessEnvironment, type SessionEnvironment } from './environment'
export { systemClock, type Clock } from './clock'
export { DEFAULT_APP_ID, PROTOCOL_VERSION } from './constants'
export type { AuditVerdict } from './fairness'
export type { SessionUpdate } from './seatFeed'
export type { IceServer, Transport, TransportFactory, TransportHandlers } from './transport'
export type { ClockPause } from './messages'
export type {
  FairnessView,
  GuestSessionConfig,
  HostSessionConfig,
  LocalSession,
  LocalSessionConfig,
  NetSession,
  NetTakebackOperations,
  RoomInfo,
  SessionConfig,
  SessionMode,
  SessionProblem,
  SessionProblemKind,
} from './types'
