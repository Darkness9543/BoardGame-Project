// Runtime validation at the trust boundary (NC 5.9, 7.19), written by hand (no schema library). The host
// parses every guest message and rebuilds each value field by field, so nothing reaches the engine, the log or
// another player unless it has exactly the shape the engine's types promise; unknown fields are dropped. The
// guest checks host messages more lightly (the host is the authority anyway), enough that a broken message
// can't crash the UI. Values are still judged by the engine: these guards bound shapes, not rules.

import {
  BOARD_SIZE,
  deserializeState,
  FACTIONS,
  isCommanderId,
  isRosterUnit,
  MARCH_OFFSETS,
  ROSTER_IDS,
  SCENARIOS,
  SEATS,
  SQUARE_COUNT,
  type AbilityTarget,
  type ArmyList,
  type AttackTarget,
  type FactionId,
  type GameState,
  type Intent,
  type IntentKind,
  type LogEntry,
  type MarchDirection,
  type MatchSettings,
  type Phase,
  type PlayerView,
  type PreferenceValue,
  type RosterUnitId,
  type ScenarioId,
  type Seat,
  type Square,
  type VisibleEvent,
} from '@coinduel/engine'
import type { DispatchResult } from '../contracts'
import {
  MAX_ABILITY_TARGETS,
  MAX_BUDGET,
  MAX_GUEST_MESSAGE_CHARS,
  MAX_HOST_MESSAGE_CHARS,
  MAX_ID_CHARS,
  MAX_MARCH_UNITS,
  MAX_PATH_STEPS,
  MAX_PENDING_IDS,
  MAX_REVEAL_INTENTS,
  MAX_TARGET_SQUARES,
  MAX_TEXT_CHARS,
  MAX_TIMER_SECONDS,
  MAX_UNIT_COUNT,
  NAME_MAX_LENGTH,
  PROTOCOL_VERSION,
} from './constants'
import type {
  AuditBody,
  ClockPause,
  ClockWire,
  GuestMessage,
  HostMessage,
  LockPhase,
  MetaWire,
  Presence,
  RejectReason,
  ResyncReason,
  SnapshotReason,
} from './messages'
import type { Versions } from './versions'

export const BAD: unique symbol = Symbol('bad')
export type Bad = typeof BAD
export type Parsed<T> = T | Bad

type Fields = Readonly<Record<string, unknown>>
type Parser<T> = (value: unknown) => Parsed<T>

const MAX_HASH_CHARS = 128
const MAX_EVENTS = 10_000
const MAX_LOG_ENTRIES = 100_000
const MAX_MESSAGE_TEXT = 1_000

// ---------------------------------------------------------------- primitives

function isRecord(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, max: number = MAX_TEXT_CHARS): Parsed<string> {
  return typeof value === 'string' && value.length <= max ? value : BAD
}

function id(value: unknown): Parsed<string> {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_CHARS ? value : BAD
}

function hash(value: unknown): Parsed<string> {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_HASH_CHARS ? value : BAD
}

function flag(value: unknown): Parsed<boolean> {
  return typeof value === 'boolean' ? value : BAD
}

function integer(value: unknown, min: number, max: number): Parsed<number> {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : BAD
}

function decimal(value: unknown, min: number, max: number): Parsed<number> {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : BAD
}

const count: Parser<number> = (value) => integer(value, 0, Number.MAX_SAFE_INTEGER)
const millis: Parser<number> = (value) => decimal(value, 0, MAX_TIMER_SECONDS * 1000)

function nullable<T>(value: unknown, parse: Parser<T>): Parsed<T | null> {
  return value === null ? null : parse(value)
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): Parsed<T> {
  return options.find((option) => option === value) ?? BAD
}

/** The keys of an exhaustive `Record<Union, ...>` table, so a runtime list can't drift from its type. */
function keysOf<T extends string>(table: Readonly<Record<T, unknown>>): readonly T[] {
  return Object.keys(table) as T[]
}

function list<T>(value: unknown, max: number, item: Parser<T>): Parsed<T[]> {
  if (!Array.isArray(value) || value.length > max) return BAD
  const items: readonly unknown[] = value
  const out: T[] = []
  for (const raw of items) {
    const parsed = item(raw)
    if (parsed === BAD) return BAD
    out.push(parsed)
  }
  return out
}

type Schema = Readonly<Record<string, (value: unknown) => unknown>>
type Shape<S extends Schema> = { readonly [K in keyof S]: Exclude<ReturnType<S[K]>, Bad> }

/** An object with exactly these fields, each parsed; any other field is dropped. */
function shape<S extends Schema>(value: unknown, schema: S): Parsed<Shape<S>> {
  if (!isRecord(value)) return BAD
  const out: Record<string, unknown> = {}
  for (const [key, parse] of Object.entries(schema)) {
    const parsed = parse(value[key])
    if (parsed === BAD) return BAD
    out[key] = parsed
  }
  return out as Shape<S>
}

function withKind<K extends string, T extends object>(kind: K, parsed: Parsed<T>): Parsed<{ readonly kind: K } & T> {
  return parsed === BAD ? BAD : { kind, ...parsed }
}

// ---------------------------------------------------------------- engine values

const seat: Parser<Seat> = (value) => oneOf(value, SEATS)
const PHASES = keysOf<Phase>({ lobby: true, deployment: true, battle: true, ended: true })
const PREFERENCES = keysOf<PreferenceValue>({ ask: true, always: true, never: true })
const MARCH_DIRECTIONS: readonly MarchDirection[] = keysOf(MARCH_OFFSETS)
const FACTION_IDS: readonly FactionId[] = FACTIONS.map((f) => f.id)
const SCENARIO_IDS: readonly ScenarioId[] = SCENARIOS.map((s) => s.id)

function square(value: unknown): Parsed<Square> {
  return shape(value, { x: (v) => integer(v, 0, BOARD_SIZE - 1), y: (v) => integer(v, 0, BOARD_SIZE - 1) })
}

const path: Parser<Square[]> = (value) => list(value, MAX_PATH_STEPS, square)

function attackTarget(value: unknown): Parsed<AttackTarget> {
  if (!isRecord(value)) return BAD
  switch (value['kind']) {
    case 'unit':
      return withKind('unit', shape(value, { unitId: id }))
    case 'square':
      return withKind('square', shape(value, { square }))
    default:
      return BAD
  }
}

function abilityTarget(value: unknown): Parsed<AbilityTarget> {
  if (isRecord(value) && value['kind'] === 'squares') {
    return withKind('squares', shape(value, { squares: (v) => list(v, MAX_TARGET_SQUARES, square) }))
  }
  return attackTarget(value)
}

/** An army list from the network or from an imported text (the army builder can reuse it). */
export function parseArmyList(value: unknown): Parsed<ArmyList> {
  if (!isRecord(value)) return BAD
  const rawUnits = value['units']
  const commander = value['commander']
  const faction = oneOf(value['faction'], FACTION_IDS)
  if (!isRecord(rawUnits) || faction === BAD || typeof commander !== 'string' || !isCommanderId(commander)) return BAD
  const entries = Object.entries(rawUnits)
  if (entries.length > ROSTER_IDS.length) return BAD
  const units: Partial<Record<RosterUnitId, number>> = {}
  for (const [type, raw] of entries) {
    const n = integer(raw, 0, MAX_UNIT_COUNT)
    if (!isRosterUnit(type) || n === BAD) return BAD
    units[type] = n
  }
  if (value['variant'] === undefined) return { faction, commander, units }
  const variant = id(value['variant'])
  return variant === BAD ? BAD : { faction, commander, units, variant }
}

const SETTING_PARSERS: { readonly [K in keyof MatchSettings]: Parser<MatchSettings[K]> } = {
  scenarioId: (v) => oneOf(v, SCENARIO_IDS),
  budget: (v) => integer(v, 1, MAX_BUDGET),
  keepEnabled: flag,
  marketEnabled: flag,
  takebacks: flag,
  takebacksPerGame: (v) => nullable(v, (n) => integer(n, 0, MAX_UNIT_COUNT)),
  turnTimerSeconds: (v) => nullable(v, (n) => decimal(n, 1, MAX_TIMER_SECONDS)),
  timeBankSeconds: (v) => nullable(v, (n) => decimal(n, 0, MAX_TIMER_SECONDS)),
  devContent: flag,
}

type SettingsDraft = { -readonly [K in keyof MatchSettings]?: MatchSettings[K] }

function isSettingKey(key: string): key is keyof MatchSettings {
  return Object.hasOwn(SETTING_PARSERS, key)
}

function setSetting<K extends keyof MatchSettings>(out: SettingsDraft, key: K, raw: unknown): boolean {
  const parsed = SETTING_PARSERS[key](raw)
  if (parsed === BAD) return false
  out[key] = parsed
  return true
}

export function parseSettingsPatch(value: unknown): Parsed<Partial<MatchSettings>> {
  if (!isRecord(value)) return BAD
  const out: SettingsDraft = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!isSettingKey(key) || !setSetting(out, key, raw)) return BAD
  }
  return out
}

type IntentOf<K extends IntentKind> = Extract<Intent, { readonly kind: K }>

/** One parser per intent kind; a new kind in the engine fails to compile here until it is handled. */
const INTENT_PARSERS: { readonly [K in IntentKind]: (v: Fields) => Parsed<IntentOf<K>> } = {
  setArmy: (v) => withKind('setArmy', shape(v, { army: parseArmyList })),
  setReady: (v) => withKind('setReady', shape(v, { ready: flag })),
  updateSettings: (v) => withKind('updateSettings', shape(v, { settings: parseSettingsPatch })),
  startDeployment: (v) => withKind('startDeployment', shape(v, { coinSeed: hash })),
  deploy: (v) => withKind('deploy', shape(v, { unitId: id, anchor: square })),
  undeploy: (v) => withKind('undeploy', shape(v, { unitId: id })),
  confirmDeployment: (v) => withKind('confirmDeployment', shape(v, { confirmed: flag })),
  move: (v) => withKind('move', shape(v, { unitId: id, path })),
  attack: (v) => withKind('attack', shape(v, { unitId: id, target: attackTarget })),
  defend: (v) => withKind('defend', shape(v, { unitId: id })),
  useAbility: (v) =>
    withKind('useAbility', shape(v, { unitId: id, abilityId: id, targets: (t) => list(t, MAX_ABILITY_TARGETS, abilityTarget) })),
  charge: (v) => withKind('charge', shape(v, { unitId: id, path, target: attackTarget })),
  groupMarch: (v) =>
    withKind('groupMarch', shape(v, { unitIds: (u) => list(u, MAX_MARCH_UNITS, id), direction: (d) => oneOf(d, MARCH_DIRECTIONS) })),
  endTurn: () => ({ kind: 'endTurn' }),
  respondDecision: (v) => withKind('respondDecision', shape(v, { decisionId: id, choice: id })),
  requestTakeback: () => ({ kind: 'requestTakeback' }),
  acceptTakeback: () => ({ kind: 'acceptTakeback' }),
  declineTakeback: () => ({ kind: 'declineTakeback' }),
  resign: () => ({ kind: 'resign' }),
  offerDraw: () => ({ kind: 'offerDraw' }),
  acceptDraw: () => ({ kind: 'acceptDraw' }),
  declineDraw: () => ({ kind: 'declineDraw' }),
  setPreference: (v) => withKind('setPreference', shape(v, { key: id, value: (p) => oneOf(p, PREFERENCES) })),
}

function isIntentKind(kind: string): kind is IntentKind {
  return Object.hasOwn(INTENT_PARSERS, kind)
}

/** A fresh, minimal Intent, or BAD. */
export function parseIntent(value: unknown): Parsed<Intent> {
  if (!isRecord(value)) return BAD
  const kind = value['kind']
  return typeof kind === 'string' && isIntentKind(kind) ? INTENT_PARSERS[kind](value) : BAD
}

export function parseVersions(value: unknown): Parsed<Versions> {
  return shape(value, {
    protocol: count,
    engine: id,
    rules: count,
    schema: count,
    build: (v) => text(v, MAX_ID_CHARS),
  })
}

/** Control, zero-width and bidi-override characters, which could hide or reorder a name on screen. */
const INVISIBLE: readonly (readonly [number, number])[] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2066, 0x2069],
]

function visible(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return !INVISIBLE.some(([low, high]) => code >= low && code <= high)
}

/** PX G-05: printable, single-spaced, at most NAME_MAX_LENGTH characters; the fallback if nothing is left. */
export function cleanName(raw: string, fallback: string): string {
  const spaced = [...raw].filter(visible).join('').replace(/\s+/g, ' ').trim()
  const cleaned = [...spaced].slice(0, NAME_MAX_LENGTH).join('').trim()
  return cleaned.length > 0 ? cleaned : fallback
}

// ---------------------------------------------------------------- envelopes

export type DecodeFailure = 'too-large' | 'not-json' | 'malformed' | 'version'
export type Decoded<M> = { readonly ok: true; readonly message: M } | { readonly ok: false; readonly reason: DecodeFailure }

type Opened = { readonly ok: true; readonly t: string; readonly b: Fields } | { readonly ok: false; readonly reason: DecodeFailure }

function open(raw: string, maxChars: number): Opened {
  if (raw.length > maxChars) return { ok: false, reason: 'too-large' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'not-json' }
  }
  const message: unknown = parsed
  if (!isRecord(message)) return { ok: false, reason: 'malformed' }
  // The version is read before the shape, so a peer on another protocol still gets a clear refusal.
  if (message['v'] !== PROTOCOL_VERSION) return { ok: false, reason: 'version' }
  const t = message['t']
  const b = message['b']
  return typeof t === 'string' && isRecord(b) ? { ok: true, t, b } : { ok: false, reason: 'malformed' }
}

const MALFORMED = { ok: false, reason: 'malformed' } as const

function accept<M>(message: M): Decoded<M> {
  return { ok: true, message }
}

const v = PROTOCOL_VERSION
const LOCK_PHASES = keysOf<LockPhase>({ army: true, deploy: true })
const PRESENCES = keysOf<Presence>({ active: true, hidden: true })
const RESYNC_REASONS = keysOf<ResyncReason>({ gap: true, hash: true, epoch: true })
const REJECT_REASONS = keysOf<RejectReason>({ version: true, full: true, 'bad-invite': true })
const SNAPSHOT_REASONS = keysOf<SnapshotReason>({ join: true, resync: true, takeback: true, reset: true })
const CLOCK_PAUSES = keysOf<ClockPause>({ decision: true, takeback: true, disconnected: true })
const BYE_REASONS = keysOf<'leave' | 'replaced'>({ leave: true, replaced: true })

const pingBody = {
  n: count,
  t: (value: unknown) => decimal(value, 0, Number.MAX_SAFE_INTEGER),
  waiting: (value: unknown) => list(value, MAX_PENDING_IDS, id),
}

/** What the host accepts from a guest. Anything else is dropped (and counted) by the session. */
export function decodeGuestMessage(raw: string): Decoded<GuestMessage> {
  const opened = open(raw, MAX_GUEST_MESSAGE_CHARS)
  if (!opened.ok) return opened
  const { t, b } = opened
  switch (t) {
    case 'hello': {
      const body = shape(b, {
        versions: parseVersions,
        name: (value) => text(value),
        proof: hash,
        seatToken: (value) => nullable(value, id),
        lastSeq: (value) => nullable(value, count),
        viewHash: (value) => nullable(value, hash),
        stateHash: (value) => nullable(value, hash),
        pending: (value) => list(value, MAX_PENDING_IDS, id),
      })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'intent': {
      const body = shape(b, { id, epoch: count, intent: parseIntent })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'resync': {
      const body = shape(b, { reason: (value) => oneOf(value, RESYNC_REASONS) })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'lock': {
      const body = shape(b, { phase: (value) => oneOf(value, LOCK_PHASES), locked: flag })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'reveal': {
      const body = shape(b, {
        id,
        phase: (value) => oneOf(value, LOCK_PHASES),
        against: hash,
        intents: (value) => list(value, MAX_REVEAL_INTENTS, parseIntent),
      })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'coinReveal': {
      const body = shape(b, { round: count, nonce: id })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'ping':
    case 'pong': {
      const body = shape(b, pingBody)
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'presence': {
      const body = shape(b, { state: (value) => oneOf(value, PRESENCES) })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'bye': {
      const body = shape(b, { reason: (value) => oneOf(value, BYE_REASONS) })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    default:
      return MALFORMED
  }
}

// ---------------------------------------------------------------- host messages (checked lightly by the guest)

/** The fields the session and UI rely on; the rest of the view is trusted to the authority. */
function viewShape(value: unknown): Parsed<PlayerView> {
  if (!isRecord(value)) return BAD
  const visibility = value['visibility']
  const ok =
    seat(value['seat']) !== BAD &&
    oneOf(value['phase'], PHASES) !== BAD &&
    typeof visibility === 'string' &&
    visibility.length === SQUARE_COUNT &&
    ['units', 'fallen', 'mines', 'areas', 'buildings'].every((key) => Array.isArray(value[key])) &&
    ['settings', 'lobby', 'takeback', 'names', 'commanders'].every((key) => isRecord(value[key]))
  return ok ? (value as unknown as PlayerView) : BAD
}

function eventShape(value: unknown): Parsed<VisibleEvent> {
  return isRecord(value) && typeof value['type'] === 'string' ? (value as unknown as VisibleEvent) : BAD
}

function clockWire(value: unknown): Parsed<ClockWire> {
  return shape(value, {
    activeSeat: seat,
    running: flag,
    pausedBy: (p) => nullable(p, (r) => oneOf(r, CLOCK_PAUSES)),
    turnMs: millis,
    bankMs: (bank) => shape(bank, { host: millis, guest: millis }),
  })
}

function metaWire(value: unknown): Parsed<MetaWire> {
  return shape(value, {
    seedCommit: hash,
    clock: (c) => nullable(c, clockWire),
    takebackMs: (ms) => nullable(ms, millis),
    decisionMs: (ms) => nullable(ms, millis),
    commits: (c) => shape(c, { army: (h) => nullable(h, hash), deploy: (h) => nullable(h, hash) }),
    coin: (c) => nullable(c, (coin) => shape(coin, { round: count, commit: hash, hostNonce: (n) => nullable(n, id) })),
  })
}

function dispatchResult(value: unknown): Parsed<DispatchResult> {
  if (!isRecord(value)) return BAD
  if (value['ok'] === true) return { ok: true }
  const code = id(value['code'])
  const message = text(value['message'], MAX_MESSAGE_TEXT)
  // The code is shown, never acted on, and the guest trusts the authority's vocabulary.
  return value['ok'] === false && code !== BAD && message !== BAD ? ({ ok: false, code, message } as DispatchResult) : BAD
}

function logEntry(value: unknown): Parsed<LogEntry> {
  return shape(value, { seat, intent: parseIntent })
}

function gameState(value: unknown): Parsed<GameState> {
  try {
    return deserializeState(JSON.stringify(value))
  } catch {
    return BAD
  }
}

function stringRecord(value: unknown): Parsed<Record<string, string>> {
  if (!isRecord(value)) return BAD
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value)) {
    const parsed = hash(raw)
    if (key.length > MAX_HASH_CHARS || parsed === BAD) return BAD
    out[key] = parsed
  }
  return out
}

function auditBody(value: unknown): Parsed<AuditBody> {
  return shape(value, { initial: gameState, log: (l) => list(l, MAX_LOG_ENTRIES, logEntry), salts: stringRecord })
}

const deliveryFields = {
  seq: count,
  epoch: count,
  events: (value: unknown) => list(value, MAX_EVENTS, eventShape),
  view: viewShape,
  viewHash: hash,
  stateHash: hash,
  logLength: count,
  meta: metaWire,
}

/** What the guest accepts from the host. */
export function decodeHostMessage(raw: string): Decoded<HostMessage> {
  const opened = open(raw, MAX_HOST_MESSAGE_CHARS)
  if (!opened.ok) return opened
  const { t, b } = opened
  switch (t) {
    case 'welcome': {
      const body = shape(b, {
        versions: parseVersions,
        seatToken: id,
        hostName: (value) => text(value),
        roomId: id,
        stillPending: (value) => list(value, MAX_PENDING_IDS, id),
      })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'reject': {
      const body = shape(b, {
        reason: (value) => oneOf(value, REJECT_REASONS),
        message: (value) => text(value, MAX_MESSAGE_TEXT),
        versions: parseVersions,
      })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'snapshot': {
      const body = shape(b, { ...deliveryFields, why: (value) => oneOf(value, SNAPSHOT_REASONS) })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'update': {
      const body = shape(b, deliveryFields)
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'synced': {
      const body = shape(b, { seq: count, epoch: count, meta: metaWire })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'meta': {
      const body = shape(b, { meta: metaWire })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'result': {
      const body = shape(b, { id, result: dispatchResult })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'audit': {
      const body = auditBody(b)
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'ping':
    case 'pong': {
      const body = shape(b, pingBody)
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'presence': {
      const body = shape(b, { state: (value) => oneOf(value, PRESENCES) })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    case 'bye': {
      const body = shape(b, { reason: (value) => oneOf(value, BYE_REASONS) })
      return body === BAD ? MALFORMED : accept({ v, t, b: body })
    }
    default:
      return MALFORMED
  }
}
