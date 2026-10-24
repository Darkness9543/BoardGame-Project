# Session layer (`apps/web/src/net`)

Everything between the UI and the rules engine: who holds the authoritative game, how each player gets **only their own projection**, and how two browsers talk. The UI imports from `./net` (`index.ts`) only, and holds a `NetSession`, which is the contract's `Session` (`../contracts.ts`) plus the extras below.

Design: `docs/analysis/research-netcode.md` ("NC"), section 7. Rules: `docs/RULES_INTERPRETATION.md`, rulings R16, R29, R33, R37, R38, sections 2.11 and 9.

| Mode | What it is | Authority |
|---|---|---|
| `local` | The sandbox (hot seat): both seats in one browser, a seat switcher. For development, tests and solo rule checking. | In memory |
| `host` | Online, the lobby creator. Runs the engine, validates every guest message, sends the guest only its own view. | This browser |
| `guest` | Online, opened the invite link. Sends intents, renders what the host sends. | The host |

In every mode each seat receives only `projectView(state, seat)` and `filterEvents(events, seat)`. Even the sandbox UI never sees the other seat's fog; only `debugRecord()` (labelled spoilers) shows the truth.

## Quick start

```ts
import { createSession, parseInviteHash } from './net'

// Sandbox: no turn timer unless the settings switch it on (R29).
const sandbox = createSession({ mode: 'local', settings: { scenarioId: 'crossroads' } })

// Host: creates a room; share session.lobby.inviteLink. The turn timer is on by default online (R29).
const host = createSession({ mode: 'host', name: 'Hana' })

// Guest: from the invite link's fragment.
const invite = parseInviteHash(location.hash)
const guest = invite === null ? null : createSession({ mode: 'guest', name: 'Gil', invite })

// React: every getter is stable between notifications, so useSyncExternalStore works directly
// (subscribe is a method: call it on the session).
const view = useSyncExternalStore((listener) => session.subscribe(listener), () => session.view)
```

`createSession` never touches the network synchronously: the Trystero transport is imported lazily, so the sandbox and the tests never load it. `netProvider()` (`provider.ts`: `host`, `join`, `resume`, `leave`, `rematch`) keeps one live session per room on top of `createSession`. `main.tsx` registers it with the app's shared storage and the build id: `setSessionProvider(netProvider({ storage: appStore(), build: __BUILD_ID__ }))` (`store/sessionProvider.ts`). The sandbox screen uses `createSession({ mode: 'local' })` directly, with one UI controller per `endpoint(seat)`.

## `NetSession` (contract + extras)

The contract fields behave as documented in `contracts.ts`. Notes per field:

- `view` is always a real `PlayerView`. A guest that has not received its first view yet shows a placeholder lobby view with `synced === false`.
- `events` are the events that came with the latest view. Several deliveries can arrive between two renders; use `history` / `updateSeq` to replay them all.
- `dispatch(intent)` resolves once the authority accepted or refused. Refusals are the engine's (`RejectionCode`, worded from the sender's knowledge), plus `NOT_CONNECTED`, `TIMEOUT` (45 s), and `NOT_AVAILABLE` for an intent overtaken by a take-back. An intent that meets a reaction prompt the sender may not know about **waits** instead of being refused (2.11). The session also refuses `startDeployment` from the UI, because it starts the match itself after the coin flip.
- `pendingReaction` / `reactionDeadline` hold the prompt and its deadline. The client answers with the prompt's default when the window ends (A2-30, 15 s). The host has a backstop 5 s later in case the deciding guest has vanished.
- `connection` is the health of the link to the other player: `connecting` until the handshake is done (or until a guest joins, for the host); `unstable` after 15 s of silence; `lost` after 90 s, or when the peer leaves. `opponent.activity` is `active`, `hidden` (tab switched) or `away`. Nobody forfeits automatically (NC Q18).

| Extra | Meaning |
|---|---|
| `mode` | `'local' \| 'host' \| 'guest'`. |
| `synced` | False only for a guest before its first view. |
| `clock: TurnClockView \| null` | The R29 timer: `{ activeSeat, running, pausedBy, turnMs, bankMs, at }`, measured at `at` (session clock, epoch ms). Use `clockRemaining(view, Date.now())` each frame: it spends the turn first, then the active player's bank. null when the timer is off or no battle is running. |
| `takeback.deadline` | Epoch ms when the pending take-back request auto-declines (TB-4, 30 s), or null. |
| `room: { roomId, code, inviteLink } \| null` | `code` is the room id grouped for reading aloud (`9F3K-Q2M7-TX`). `inviteLink` is set for the host only. |
| `rttMs` | Round-trip time from the heartbeat. |
| `problem: { kind, message } \| null` | `version`, `room-full`, `bad-invite`, `insecure-context` (stop), `transport` (it retries), `desync`. The message is written for the player. |
| `fairness` | `{ notes, auditReady, verdict, verify() }`, the commit-reveal checks (see below). `notes` lists anything suspicious seen during the match. |
| `updateSeq`, `history` | Delivery counter, and the last 64 deliveries `{ seq, why, events, view, at }`, oldest first. The opponent-turn replay reads them. |
| `respondToReaction(choice)` | Sugar for `dispatch({ kind: 'respondDecision', ... })`. |
| `rematch()` | Host and sandbox, after the game: a new match with the same players and settings (same room and link). |
| `close()` | Leaves the room and stops every timer. |

`LocalSession` adds `seat` switching (`setSeat`), `followTurn` / `setFollowTurn` (default on: it follows the player who must act, which is the decider of a prompt or a take-back request, else the active seat in the battle; in the lobby and the deployment it hands over to the other seat once the current one is ready or confirmed), `endpoint(seat)` (a session pinned to one seat, for two boards side by side), and `debugRecord()`. `HostSession` also has `debugRecord()` for a spoilers overlay that is off by default (NC 7.19 #11).

Other exports:

- Invites: `parseInviteHash`, `parseInviteText` (a pasted link, `#/join/...`, or `ROOM/SECRET` with or without dashes), `inviteHash`, `inviteLink`, `hostResumeHash` / `parseHostHash` (`#/host/<roomId>`), `roomCode`.
- Storage and the log: `canResumeHost(roomId)`, `forgetHostRoom`, `forgetGuestJoin`, `readMatchLog` / `clearMatchLog` (the only match log: the achievements screen reads it through `store/matchLog.ts`), `browserStore`, `memoryStore` (the UI's `store/storage.ts` shares one `browserStore()` with the sessions).
- Settings and helpers: `netSettings`, `fetchMeteredIceServers`, `parseArmyList` (the strict guard; the army text import can reuse it), `parseIntent`, `cleanName`, `skirmishRecord(names, seed)` (the sandbox's quick battle, a DSL record for `createSession({ mode: 'local', record })`).

## Invite links and admission (NC 7.4, 7.17)

- The link is `<page>#/join/<roomId>/<secret>`. The roomId is 10 characters of Crockford base32 (about 50 bits) and names the signalling room. The secret is 22 characters of base64url (128 bits) and is Trystero's `password`, which encrypts the SDP on the public relays. The fragment never reaches a web server.
- The guest's `hello` carries `sha256(roomId, secret)` as its proof of invitation, so a peer without the link can't even ask. It also carries the protocol, engine, rules and schema versions. A mismatch on either side is refused with a message that tells both players to reload.
- The host issues a **seat token**. A guest that comes back with it (reload, new connection) gets its seat back. While the seated guest is connected, anyone else is refused with "room full". While it is away, a new device may take the seat (`SEAT_TAKEOVER_WHEN_AWAY`; the link is the proof).
- Rooms are saved in `localStorage` (`coinduel:room:<id>` for the host: secret, record, guest seat, salts; `coinduel:join:<id>` for the guest: secret, token, draft). A reloaded host reopens with `createSession({ mode: 'host', name, resume: roomId })`. A reloaded guest just opens the same link.

## The protocol (`messages.ts`, validated in `guards.ts`)

Wire format: JSON text `{ v: PROTOCOL_VERSION, t, b }` on one Trystero action channel (`'m'`). The version is read before the shape, so a peer on another protocol still gets a clear refusal.

| Guest -> host | Body |
|---|---|
| `hello` | versions, name, invite proof, seat token, last seq, last view and state hashes, ids of unanswered intents |
| `intent` | `{ id, epoch, intent }` |
| `resync` | `{ reason: gap \| hash \| epoch }` |
| `lock` | `{ phase: army \| deploy, locked }`: Ready / Confirm pressed, waiting for the host's commitment |
| `reveal` | `{ id, phase, against, intents }`: the sealed submission, valid only against that host commitment |
| `coinReveal` | `{ round, nonce }` |

| Host -> guest | Body |
|---|---|
| `welcome` | versions, seat token, host name, room id, and which of the hello's unanswered intents it still holds (queued behind a prompt: they stay pending) |
| `reject` | `{ reason: version \| full \| bad-invite, message }` |
| `snapshot` | the full delivery (below) plus `why: join \| resync \| takeback \| reset` |
| `update` | `{ seq, epoch, events, view, viewHash, stateHash, logLength, meta }` |
| `synced` | `{ seq, epoch, meta }`: after a reconnect, the guest's view (or the whole state) is unchanged |
| `meta` | session state that changed without a view change |
| `result` | `{ id, result: DispatchResult }` |
| `audit` | `{ initial, log, salts }`, once the game is over |

Both directions: `ping` / `pong` (every 5 s; the host's pings list the guest intents it still holds, which keeps their dispatch timeouts from firing while they wait), `presence` (`active` / `hidden`), `bye`.

`meta` rides with every view: `seedCommit`, the turn clock (as remaining durations), the take-back window, the guest's prompt window, the host's current commitments, and the coin round. The clock is the one the guest may know: R29 stops it for every reaction prompt, but a prompt hidden from the guest shows as a running clock (2.11), and a lone `meta` is only sent when something the guest may know changed. Once such a prompt ends the guest's countdown is corrected at the next delivery; whether R29 or 2.11 should win for hidden prompts is an open owner question.

**Updates carry the whole new view, not a patch.** Views are a few KB; resync is always a full snapshot (NC 7.9). The guest requests a snapshot on a seq gap, an epoch change, or a view whose `hashJson` differs from `viewHash`. After a reconnect, if its last `stateHash` or `viewHash` still matches, the host answers `synced` instead ("resync from hash"). Intent ids make retransmission safe: after a reconnect, the host answers unanswered ids from a result cache, the welcome names the ones it still holds (they stay pending), and the guest reports any others as "not sent" (PX NET-02). An intent is never applied twice. Epochs go up on an accepted take-back or a restart; an intent from an older epoch is refused.

**The trust boundary.** The host parses every guest message by hand. Intents are rebuilt field by field from the engine's types: unknown fields are dropped and sizes are bounded. The parser table is keyed by `IntentKind`, so a new engine intent fails to compile here until it is handled. Messages from a peer that hasn't been admitted are ignored. Malformed ones are dropped and counted. The seat always comes from the channel, never from the payload. The engine then judges every value.

**What a guest never receives** (NC 7.19): a `GameState` before the game is over, a hidden unit's id or position, or anything addressed to the host. A seat that can see no change gets no message at all, so even the timing of hidden actions stays private. Public by rule: AP (R15), commanders from the lobby (R16), army lists from deployment (R33), the take-back request, and the Siege and first-contact counters. The shared `stateHash` reveals nothing, because the game seed (192 random bits) is part of the hashed state.

## Rule clocks run by the session

| Rule | Who runs it | Behaviour |
|---|---|---|
| R29 turn timer | the authority (`authority.ts`, `turnClock.ts`) | 90 s per turn, then the active player's 60 s per-game bank; at zero the authority sends `endTurn` (never a loss). It stops during reaction prompts, take-back requests and disconnections. Lobby setting: online on by default, sandbox off (`turnTimerSeconds` / `timeBankSeconds`, null = off). |
| TB-4 take-back auto-decline | the authority | `declineTakeback` 30 s after the request (`TAKEBACK_TIMEOUT_S`). |
| A2-30 reaction prompt | the decider's client | Its default answer after 15 s (`REACTION_PROMPT_TIMEOUT_S`). The host's backstop answers at 15 + 5 s. |
| 2.11 hidden decisions | the authority | Intents refused with `DECISION_PENDING` wait in a queue (up to 16) and run once the prompt is answered. |

## Fairness: commit-reveal and the audit (S28 / R37, NC 7.15)

With host authority the host could counter-pick, so the guest reveals nothing until the host has committed:

1. **Seed.** `meta.seedCommit = commitSecret('seed|' + seed)` is sent before any nonce. The coin flip mixes in the seed, so the host can't pick it afterwards.
2. **Coin flip.** Once both seats are ready, the host publishes `commitSecret(hostNonce)`. The guest answers with its own nonce. The host starts the deployment with `combineSecrets(hostNonce, guestNonce)` and reveals its nonce, and the guest checks it against the commitment. A round the host replaces after the guest's nonce went out, while the guest stayed ready, is noted with a count (the host toggling its own Ready is no excuse: it could re-roll the flip that way).
3. **Army.** The guest's army stays on the guest's machine. Only its public part (commander and variant, as R16 requires) goes to the host at once, and the guest's UI shows the real army over the host's view. When the guest presses Ready, it sends `lock` (the host's UI shows the guest as ready and waiting). The host's Ready publishes a salted commitment of its army. Only then does the guest `reveal` its army and ready, in one batch, and only against that commitment. From that message on the host holds the army, even if it refuses the reveal (its commitment changed meanwhile), so the guest records the first commitment it sent against as well as the one accepted, and notes a refusal at once. A host that picks its army again after the reveal is noted live (`fairness.notes`); the audit then checks the army against both commitments. A reveal lost to a dropped link (no refusal) is sent again, under the same id, once the link is back.
4. **Deployment.** Same pattern. Placements stay in the guest's draft (validated with `validateIntent` on its draft view) until the host confirms. Then the guest reveals every placement and Confirm at once. Both seats confirmed means the battle starts, so there is no window to react.
5. **Audit.** After the game the host sends `{ initial, log, salts }`. `fairness.verify()` replays it with the same `submit()` and checks: the seed commitment, the coin seed, the host's army and placements against the commitments the guest revealed (and first sent) against, **every view and state hash the guest was sent** (by log length), and that the record covers every move the guest saw. The host's `verify()` checks that its own log replays to its state. A `reset` snapshot starts a fresh record only for a real new match (a new seed, or after the game ended); the lobby rebuilt with the guest's name keeps its commitments, and a reset during the match is noted and keeps everything.

This makes cheating detectable, not impossible: a modified host can still peek with devtools (NC 7.15). The Durable Object relay of NC 4.5 is the upgrade path to server authority.

## Network setup

- **Trystero 0.26** with the default **Nostr** signalling (`trystero/nostr`), in `trysteroTransport.ts` only. Game data never touches the relays: they carry the SDP, encrypted with the invite secret, and the data channel is end-to-end DTLS between the browsers.
- **A secure context is required.** Trystero uses `crypto.subtle`, which exists on `https://` and `http://localhost`, but **not on plain `http://<LAN-IP>`** (for example `vite --host` opened from a phone). The session then reports `problem.kind === 'insecure-context'` with an explanation. Develop on localhost, deploy on https (GitHub Pages).
- **appId** `DEFAULT_APP_ID = 'coinduel-p2p-v1'` namespaces our rooms on the public relays and seeds which 5 Nostr relays a room uses. Keep it permanent; changing it splits players across relays.
- **TURN (optional; STUN only by default).** About 15-20 % of pairs need a relay (a phone on mobile data is the classic case). The free Metered key goes in `apps/web/.env.local`, which is not committed:
  ```
  VITE_METERED_APP=<your app name>     # https://<name>.metered.live
  VITE_METERED_KEY=<api key>
  ```
  You can give static TURN credentials instead: `VITE_TURN_URLS=turn:host:3478,turns:host:443`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`. Or pass `net: { iceServers: [...] }` to `createSession`. Metered's key is client-side by design, so the worst case is someone using up the monthly quota.
- `trystero` is pinned to exactly 0.26.0 in `apps/web/package.json`: wire-format changes happen between minor versions, and both peers load the same bundle.
- The build id in version errors comes from `BUILD_ID` (or GitHub Actions' `GITHUB_SHA`) at build time (`vite.config.ts`); it is `dev` otherwise.

## Testing

`testing/` holds the loopback harness:

- `FakeHub` is an in-memory stand-in for Trystero's room API (`makeAction` send/receive, `onPeerJoin`, `onPeerLeave`, `leave`). It is keyed by appId, roomId and password like Trystero. Delivery is queued, and a test can drop, alter or inject messages, or cut a peer off. The real `transportFromRoom` adapter runs on top of it, so only the `joinRoom` call is untested.
- `ManualClock` runs every session timer under test control.
- `connectPair()` (`harness.ts`) builds a real `HostSession` and `GuestSession` on one hub and clock.

The suites cover the guards (`guards.test.ts`), invites, the turn clock, the authority, drafts, storage and the match log, the sandbox (`localSession.test.ts`), the protocol end to end (`protocol.test.ts`: join, updates, gap and hash resync, presence, heartbeat, reconnect, the result cache, reloads of either side, version mismatch, room full, seat takeover, bad proofs, malformed and unauthorised messages, epochs, take-back accept and auto-decline, relayed prompts, the online timer), and commit-reveal and the audit, including a counter-picking host (`fairness.test.ts`).

## Files

```
index.ts            public surface               createSession.ts  the factory (+ lazy Trystero)
types.ts            NetSession, LocalSession, configs
authority.ts        engine + per-seat delivery + rule clocks + decision queue
localSession.ts     sandbox        hostSession.ts   online host      guestSession.ts  online guest
seatFeed.ts         one seat's view, events, history, prompt timeout
messages.ts         catalogue      guards.ts        runtime validation (trust boundary)
transport.ts        the seam, transportFromRoom      trysteroTransport.ts  joinRoom (only Trystero import)
roomConnection.ts   open/reopen a room, stale-transport guard, outbox
heartbeat.ts        ping, unstable/lost              turnClock.ts     R29 clock as data
fairness.ts         commitments + audit              draft.ts         guest sealed drafts, lock overlays
invite.ts versions.ts random.ts clock.ts environment.ts ice.ts storage.ts matchLog.ts operations.ts provider.ts constants.ts
testing/            fakeNetwork.ts manualClock.ts harness.ts flows.ts
```

## Known gaps

- `contracts.ts` has no "not received yet" state for `Session.view`; a guest shows a placeholder lobby view while `synced` is false.
- The engine has no rename intent. The host rebuilds the lobby record with the guest's name when the guest first joins (replay is exact); after the lobby, a guest that takes over a seat keeps the old seat name in `view.names` (`opponent.name` is current).
- A disconnected player can't be claimed against ("claim victory after N minutes", PX NET-03): there is no forfeit result in the engine, and NC Q18 defers it.
- There is no single-host-tab guard (Web Locks) and no deployment timer (PX DP-10 is not a ruling).
- A relay transport (Cloudflare Durable Object, NC 4.5) would plug into `TransportFactory` unchanged; it isn't built.
