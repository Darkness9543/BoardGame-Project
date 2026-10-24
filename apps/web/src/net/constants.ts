// Session-layer tunables (docs/analysis/research-netcode.md, "NC"). The rule timers themselves (take-back
// and reaction-prompt windows, the R29 turn timer and bank) are engine constants and lobby settings.

/** Wire protocol version, compared in the hello handshake; bump on any incompatible message change (NC 7.6, 7.17). */
export const PROTOCOL_VERSION = 2

/**
 * Trystero appId. Unique and permanent: it namespaces our rooms on the public signalling relays and seeds which
 * 5 Nostr relays a room uses, so changing it splits players onto different relays (NC 4.2).
 */
export const DEFAULT_APP_ID = 'coinduel-p2p-v1'

/** NC 7.10: ping cadence, and the silences after which the link counts as unstable, then lost. */
export const HEARTBEAT_INTERVAL_MS = 5_000
export const UNSTABLE_AFTER_MS = 15_000
export const LOST_AFTER_MS = 90_000

/** NC 7.5: after the host is lost, the guest rejoins the signalling room with this backoff. */
export const REJOIN_BACKOFF_MS: readonly number[] = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]

/** A dispatched intent with no answer resolves as TIMEOUT (a queued intent may wait out a 15 s reaction prompt). */
export const DISPATCH_TIMEOUT_MS = 45_000

/** A guest that asked for a resync and heard nothing asks again after this long. */
export const RESYNC_RETRY_MS = 5_000

/** Host-side backstop on top of a remote decider's prompt window (A2-30), so a vanished guest can't stall the game. */
export const DECISION_GRACE_MS = 5_000

/** Intents that meet a decision their sender may not know about wait in this queue (2.11); more are refused. */
export const MAX_QUEUED_INTENTS = 16

/** Trust boundary (NC 5.9): inbound size caps, in UTF-16 characters of the JSON text. */
export const MAX_GUEST_MESSAGE_CHARS = 64 * 1024
export const MAX_HOST_MESSAGE_CHARS = 8 * 1024 * 1024

/** Field bounds for guest messages; the engine still judges every value, these only bound the shape. */
export const MAX_ID_CHARS = 64
export const MAX_TEXT_CHARS = 200
export const MAX_PATH_STEPS = 64
export const MAX_ABILITY_TARGETS = 8
export const MAX_TARGET_SQUARES = 64
export const MAX_MARCH_UNITS = 16
export const MAX_REVEAL_INTENTS = 256
export const MAX_UNIT_COUNT = 1_000
export const MAX_BUDGET = 100_000
export const MAX_TIMER_SECONDS = 86_400
export const MAX_PENDING_IDS = 64

/** NC 7.8 rule 5: guest intent results kept by id, so a retransmission is answered without re-applying. */
export const RESULT_CACHE_SIZE = 128

/** Delivered batches kept per session for the opponent-turn replay. */
export const HISTORY_LIMIT = 64

/** R38: finished matches kept in the local match log. */
export const MATCH_LOG_LIMIT = 200

/** NC 7.11: a new device may take the guest seat while the seated guest is disconnected (the link is the proof). */
export const SEAT_TAKEOVER_WHEN_AWAY = true

/** PX G-05: display names are trimmed to this length. */
export const NAME_MAX_LENGTH = 20

/** NC 7.4 invite format: a 10-character Crockford base32 room id (~50 bits) and a 22-character base64url secret (128 bits). */
export const ROOM_ID_LENGTH = 10
export const SECRET_LENGTH = 22

/** Prefix of every key this layer writes to browser storage (host rooms, guest joins, the match log). */
export const STORAGE_PREFIX = 'coinduel:'
