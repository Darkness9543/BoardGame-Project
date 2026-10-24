# @coinduel/engine

The pure, deterministic rules engine for the 1v1 board game. It has no DOM, network, clock or `Math.random`. It imports as `'@coinduel/engine'` (which resolves to `src/index.ts`).

- **Rules source of truth:** `docs/RULES_INTERPRETATION.md`, including the **owner rulings R1-R42** at its top, which override older defaults. Every tunable is a named constant in `src/constants.ts` or a field in `src/content/*`. The code carries assumption IDs (`A2-07`) and ruling IDs (`R12`), so an owner answer is a one-line change.
- **This README is the API.** The guide sections explain how the pieces fit together for each kind of reader (session, UI, renderer, ability authors). The [export reference](#export-reference) at the end lists every symbol `src/index.ts` exports. `src/readme.test.ts` runs the examples, so they stay correct.

```
src/
  types.ts constants.ts geometry.ts hash.ts rng.ts        core data, tunables, board maths, hashing, RNG
  content/  units, abilities (data + card text), commanders, factions, buildings, scenarios, derived
  state.ts query.ts stats.ts vision.ts damage.ts          state helpers, RulesQuery, effective stats, vision, damage pipeline
  resolve.ts movement.ts attack.ts economy.ts deployment.ts army.ts setup.ts turn.ts decisions.ts
  commands.ts                                             Intent union, validate / validateIntent, apply
  view.ts preview.ts history.ts events.ts rejection.ts    projection, client helpers, log/replay/take-back, events
  summary.ts                                              match statistics and the end-of-game summary (R38, R39)
  abilities/  types.ts (framework), registry.ts, index.ts, units/<unit>.ts, commanders/<name>.ts
  testing/    dsl.ts (scenario builder), fogLeak.ts (leak detector)
```

## Invariants

1. **Pure and deterministic.** `apply(state, seat, intent)` never mutates its input. It works on a private JSON clone and returns `{ state, events }`. The only randomness is the coin flip, from the seeded RNG; ids are digests of the secret seed and `state.idCounter` (`drawId`), so no seat can predict them or count the hidden objects between two it sees. The same state and intent always give the same result, so `replay(initial, log)` deep-equals the live state. A fast-check property test checks this over random legal games.
2. **JSON only.** `GameState` holds only plain objects, arrays, strings, integer numbers, booleans and `null`. It has no `Map`, `Set`, class, `undefined` or `NaN`. You can `JSON.stringify` it, hash it (`hashState`) and send it. Treat every returned state as immutable.
3. **Legality is judged on knowledge.** `validate(state, seat, intent)` is `validateIntent(projectView(state, seat), intent)` plus hidden-state gates. A rejection never reveals hidden facts. A move into an unseen enemy is legal; it is interrupted when walked (the "bump" rule). A Stealth attempt watched by an unseen enemy fails visibly with its AP spent.
4. **No hidden information in views.** `projectView(state, seat)` holds only what that seat may know: its own units in full, and enemy units only while visible, with public fields only. Enemy mines appear only when revealed and in vision, and enemy areas are clipped to vision. Decisions appear only for the decider. `filterEvents` strips the audience field. A fog-leak walker (`findLeaks`) runs on every step of the property test. By design some things are public: AP totals (R15), commanders from the lobby (R16), army lists from deployment (R33), the take-back request's action as far as the decider saw it (TB-4), Siege counters (R30) and the first-contact round (R28). The match statistics (`matchStats`) are never in a view; they are published by the `matchSummary` event when the game ends.
5. **Integer maths.** Rounding is explicit: Defend uses `ceil`, Sabrina's prices round up, Shared wounds uses `ceil` (R19).

## Quick start (lobby → deployment → battle)

```ts
import {
  createGame, startRecord, submit, projectView, filterEvents, commitSecret, verifySecret, combineSecrets,
  type Intent, type MatchRecord, type Seat,
} from '@coinduel/engine'

let record: MatchRecord = startRecord(createGame({ seed: hostRandomString, settings: { scenarioId: 'crossroads' } }))

function send(seat: Seat, intent: Intent) {
  const result = submit(record, seat, intent)          // validate + apply + log + take-back frames
  if (!result.ok) return result                        // { ok: false, code, message }
  record = result.record
  for (const s of ['host', 'guest'] as const) deliver(s, projectView(record.state, s), filterEvents(result.events, s))
  return result
}

// Lobby: both seats choose an army and get ready (a Baba Yaga army also needs `variant`).
send('host', { kind: 'setArmy', army: { faction: 'empire', commander: 'trill', units: { footman: 10, paladin: 2 } } })
send('guest', { kind: 'setArmy', army: { faction: 'lojrar', commander: 'babaYaga', variant: 'cauldron', units: { mercenary: 12 } } })
send('host', { kind: 'setReady', ready: true }); send('guest', { kind: 'setReady', ready: true })

// Coin flip (commit-reveal, S28/R37): both publish commitSecret(nonce), then reveal; check with verifySecret.
send('host', { kind: 'startDeployment', coinSeed: combineSecrets(hostNonce, guestNonce) })  // host only

// Deployment (hidden, simultaneous): place every unit, then confirm. Battle starts when both confirm.
send(seat, { kind: 'deploy', unitId, anchor: { x: 12, y: 2 } })
send(seat, { kind: 'confirmDeployment', confirmed: true })

// Battle
send(south, { kind: 'move', unitId, path: [{ x: 12, y: 3 }, { x: 12, y: 4 }] })
send(south, { kind: 'endTurn' })
```

`src/readme.test.ts` runs this flow end to end; it picks deployment squares with `deploymentSquares` and `validateIntent`, as a client would. For tests, `startMatch({ armies })` (see the DSL section) runs the whole flow with automatic deployment.

## Seats, sides, squares

| Concept | Type | Notes |
|---|---|---|
| Seat | `'host' \| 'guest'` (`SEATS`) | The engine identity of a player. The session maps its transport to a seat. |
| Side | `'south' \| 'north'` | South moves first. The coin flip in `startDeployment` sets `state.southSeat` / `view.southSeat`, and `view.side` is my side. |
| Square | `{ x, y }`, 0-based | `x` = column A..Y (west to east), `y` = row 1..25 minus 1. Square names are absolute (`parseSquare('M13')` = `{12,12}`, `squareName`). Each client draws its own back row at the bottom: `backRowY(side)`, `goalRowY(side)`. |
| Unit ids | opaque strings `u-xxxxxxx` | Drawn from the seeded RNG, so they reveal nothing about army size. Mines use `m-...`, areas `a-...`, decisions `d-...`. |

A unit's `anchor` is its south-west square. A Size-2 Beast covers `anchor` to `anchor + (1,1)`; `footprintSquares(anchor, size)` lists the squares. Buildings are 3x3 (R32): the Keep is F12:H14 and the Market R12:T14.

## The authority loop (session layer)

- Keep one `MatchRecord` on the host (`startRecord`, `submit`). Persist it with `serializeRecord(record)` and rebuild it with `restoreRecord(json)`, which replays. `record.log` is the append-only intent log of `{ seat, intent }`.
- After each `submit`, send each seat `projectView(record.state, seat)` and `filterEvents(result.events, seat)`. Use `hashJson(view)` as the `viewHash` for resync checks (NC 7.9) and `hashState(state)` for host audits.
- **The seat comes from the channel, never from the payload.** Intents do not carry a seat.
- **Rejections.** Every `Rejection` is `{ ok: false, code: RejectionCode, message }` and is worded from the requester's knowledge. `validate` judges on the seat's view first, so a refusal never depends on a prompt it can't see. Only an intent that would be legal then gets `DECISION_PENDING` for a reaction prompt the requester may not know about (Queso's revive or Cauldron after an unseen death); the session should **queue** it and show a normal "waiting" animation instead of surfacing the code (2.11).
- **Reaction prompts.** `view.decision` holds `{ id, kind, prompt, options, defaultOption, timeoutSeconds, preferenceKey, data }` (`preferenceKey` is `'revive'` for Queso's revive and the Cauldron, which the seat's Ask / Always / Never preference can answer, and null for the Rogue's Assault target choice). The session runs the clock (`REACTION_PROMPT_TIMEOUT_S` = 15 s, with the turn timer paused) and on timeout sends `{ kind: 'respondDecision', decisionId, choice: defaultOption }`. Seat preferences answer at once without pausing: `{ kind: 'setPreference', key: 'revive', value: 'always' | 'never' | 'ask' }`. `view.opponentDeciding` is true only if the other seat could see the subject.
- **Take-backs** (section 9, A9-01) work only through `submit`, which keeps the frames. The requester sends `requestTakeback`. `view.takeback.request` then shows `{ requester, actionSeq, action, disclosure }`: the requester gets its own action and `disclosure: null`; the decider gets the action as far as it saw it (`DisclosedAction`: `{ kind: 'unseen' }` for an unseen unit or a secret ability, else the unit only while visible and only the steps and squares it saw) and the TB-5 `disclosure` (`{ units, mines: { id, square, setOff }[], assaults, prompts }`), both recorded from each seat's events as the action resolved. The decider sends `acceptTakeback` or `declineTakeback`, and the session auto-declines after `TAKEBACK_TIMEOUT_S` = 30 s. An accepted request restores the exact earlier state, and only the take-back bookkeeping and preferences are kept. `view.takeback.canRequest` tells a seat whether it may ask now: its own latest action this turn, or its End Turn until the opponent acts. A declined action can't be asked again, and the per-game limit is respected.
- **Timers** (R29): `settings.turnTimerSeconds` (90) and `settings.timeBankSeconds` (60) are lobby data. The session ends the turn by sending `endTurn` and pauses the clock during prompts and take-back requests. The engine has no clock.
- **Coin flip:** `commitSecret(nonce)` → `verifySecret(commitment, nonce)` → `combineSecrets(hostNonce, guestNonce)`. Pass the result as `startDeployment.coinSeed`. The engine reseeds its RNG with `seed|coinSeed` and flips.

## Intents (`Intent`, `commands.ts`)

| Kind | Fields | Phase / who | Notes |
|---|---|---|---|
| `setArmy` | `army: ArmyList` | lobby, either seat | Validated with `checkArmy`. Changing the army un-readies the seat. |
| `setReady` | `ready` | lobby | Needs a valid army. |
| `updateSettings` | `settings: Partial<MatchSettings>` | lobby, host | Un-readies both seats; a disabled building is removed. |
| `startDeployment` | `coinSeed` | lobby, host, both ready | Flips the coin, creates every unit undeployed, phase becomes `deployment`. |
| `deploy` | `unitId, anchor` | deployment | Zones: normal rows for everyone; normal + extended for the Vanguard units (Rogue, Ranger). The commander uses the normal zone only. Placing withdraws Confirm. |
| `undeploy` | `unitId` | deployment | |
| `confirmDeployment` | `confirmed` | deployment | Needs every unit placed. When both seats confirm, the battle starts. |
| `move` | `unitId, path: Square[]` | battle, active | An explicit orthogonal path of anchor positions (start excluded), 1..Movement steps. It may pass own units, but not known enemies or terrain, and must end on empty squares. |
| `attack` | `unitId, target: { kind: 'unit', unitId } \| { kind: 'square', square }` | battle, active | Melee targets a visible enemy. With range ≥ 2 (the Ranger) any square without an own unit can be targeted (a blind shot), and this sets off a mine there. |
| `defend` | `unitId` | battle, active | Halves incoming damage (rounding up) until the controller's next turn. Acting again cancels it. |
| `useAbility` | `unitId, abilityId, targets: AbilityTarget[]` | battle, active | `AbilityTarget` = `{kind:'unit',unitId}` \| `{kind:'square',square}` \| `{kind:'squares',squares}`. Picks follow the ability's `TargetSpec`s in order. |
| `charge` | `unitId, path, target` | battle, active | R26: Movement ≥ 2. Move up to Movement - 1 squares, then make a basic attack from the end square. One action costing AP + 1. It counts as the Move and as an Attack (Savagery). An interrupted walk means no attack, with the AP spent. |
| `groupMarch` | `unitIds, direction: 'north' \| 'east' \| 'south' \| 'west'` | battle, active | R27: 2 AP in total for 1-6 own units that form one orthogonally connected group and haven't acted. Each steps 1 square, front to back. Each step goes through the normal step rules, and an interruption stops only that unit. `MARCH_OFFSETS[direction]`. |
| `endTurn` | none | battle, active | Runs the end phase, then starts the opponent's turn. |
| `respondDecision` | `decisionId, choice` | the decider | Answers a reaction prompt. |
| `requestTakeback` / `acceptTakeback` / `declineTakeback` | none | requester / decider | Use `submit` (see above). |
| `resign` | none | deployment or battle, either seat | |
| `offerDraw` / `acceptDraw` / `declineDraw` | none | battle | An offer lapses when the turn ends. |
| `setPreference` | `key: 'revive', value` | any | `'ask' \| 'always' \| 'never'`. |

`ActionIntent` is the battle-action subset (move, attack, defend, useAbility, charge, groupMarch, endTurn); `isActionIntent(intent)` tests for it. Each action can be taken back.

Functions:

- `validate(state, seat, intent, options?) → Validation` is the authority's check.
- `validateIntent(view, intent) → Validation` is the same check run on a client's `PlayerView`. Use it to grey out buttons.
- `apply(state, seat, intent, options?) → ApplyResult`, where `ApplyResult = { ok: true, state, events } | Rejection`. `options.stateBeforeAction(seq)` is what makes `acceptTakeback` possible; `submit` supplies it.
- Sub-checks are exported for UIs: `checkTarget(q, unit, spec, target)` and `checkAbilityReady(q, seat, unit, abilityId)`.

`RejectionCode`: `GAME_OVER WRONG_PHASE NOT_YOUR_TURN NOT_HOST DECISION_PENDING TAKEBACK_PENDING INVALID_ARMY NOT_READY INVALID_SETTINGS UNKNOWN_UNIT NOT_YOUR_UNIT NOT_DEPLOYED NOT_DEPLOYABLE OUTSIDE_ZONE SQUARE_UNAVAILABLE NOT_ALL_DEPLOYED NO_ACTIONS_LEFT ALREADY_MOVED NOT_ENOUGH_AP CANNOT_MOVE INVALID_PATH PATH_TOO_LONG NO_POWER INVALID_TARGET OUT_OF_RANGE UNKNOWN_ABILITY NOT_ACTIVE_ABILITY NOT_IMPLEMENTED ON_COOLDOWN LIMIT_REACHED REQUIREMENT_NOT_MET NO_DECISION INVALID_CHOICE TAKEBACK_UNAVAILABLE NO_TAKEBACK_REQUEST NO_DRAW_OFFER DRAW_ALREADY_OFFERED UNKNOWN_PREFERENCE NOT_AVAILABLE`.

## The rules the kernel runs (summary; the document is authoritative)

- **Action economy.** Each unit gets one action per turn, plus extra allowance from the Market (tier-1 units), Command Aura and Holy Fervor. Extra actions may be Moves (R12, `MAX_MOVES_PER_TURN = 'allowance'`). AP is paid per action. An ability's cost replaces the unit's AP, and Holy Fervor adds +1 on later actions through its surcharge hook. Cooldown CD N means "ready on own turn T + N + 1".
- **AP pool at a turn start** (R1, R9, R25, R28, R31, R11): `apForRound(round)` = min(10 + (round - 1), 20), then from round 20 it grows as 21, 22, ... (late escalation). The pool is **doubled** until the end of the round of first contact (`state.firstContactRound`; the approach boost). First contact is recorded the moment any unit sees an enemy unit: `Resolver.invalidate()` checks it on every vision change, so a sighting that ends inside the same action still counts (a stealthed unit counts only once revealed, but what it sees counts; mines never do). The Market adds +2 for its controller and every `startOfTurnAp` hook (the Scourge's Tribute) adds its AP, both after the cap. Any Cauldron AP debt is subtracted; a debt larger than the pool leaves the AP at 0 and carries the rest to the following turn. Unspent AP is lost once the end phase is over: the ending seat's AP drops to 0 (`AP_CARRYOVER`), with an `apChanged` both seats see, so the HUD never shows leftover AP the opponent can't use. There is no first-turn cut (`FIRST_TURN_AP = null`).
- **Damage pipeline** (3.3), per hit:
  1. Base: the attack's current Power, or the ability's fixed number.
  2. Attacker additions, for attacks only (`attackerAddition` hooks of the dealer).
  3. Attacker subtractions (`attackerSubtraction` hooks of every unit), for dealt damage only, never mines or ticks. Floored at `WEAKNESS_FLOOR` = 1 (R13).
  4. Target flat reductions (`targetReduction` hooks of every unit and area), floored at 1.
  5. Defend: `ceil(x / 2)`.

  The same-named contributions apply once (A3-15). `runPipeline(input, rules?)` is the pure arithmetic, `collectHit(q, hit)` gathers the hooks, and `computeHit` does both. Simultaneous effects (`dealDamageTogether`, end-of-turn ticks) are computed on the board as it stood before, applied together, and their deaths resolve together. Healing is capped at max toughness. Losing a toughness aura never kills (A3-11).
- **Movement per step** (2.5): enter → mines on newly entered squares (5, or 10 for size 2) → adjacency hooks (Assault; stationary enemies first, then the mover) → generic step hooks → state-based reveals (R1 adjacency, R3 detection) and toughness auras → goal-row win → interrupt ("Blocked!" before entering a square that holds an enemy; mine; reaction; death). A mover stopped on an own unit backs up along its path.
- **End of turn** (2.10): damage ticks (one simultaneous event) → commander check → heals → captures → expiries → the next player's start (expire Defend and areas → reset counters → refill AP → advance the own-turn index → Siege check → start-of-turn hooks). The end phase pauses at a pending decision and resumes when it is answered.
- **Buildings** (6.4, R30-R32): a building is captured at the end of every turn if units of exactly one side (stealthed units and dummies included, mines never) stand in the 16-square ring around the 3x3. The Keep gives +1 Power (R31) and the Market +2 AP plus the tier-1 extra action. **Siege** (R30): holding both buildings at the start of 5 consecutive own turns wins. Losing either building resets the count.
- **Wins:** `conquest` (the enemy commander dies; both in one resolution is a draw, `simultaneousCommanderDeath`), `domination` (your commander enters its goal row after the step's triggers), `siege`, `resignation`, `agreement` (a draw). Every ending emits `gameEnded` and then `matchSummary` (R38, R39): the result, rounds, both armies and commanders, and per seat and unit type the damage dealt to enemies, damage taken, kills and losses (toughness actually removed, overkill excluded). A mine's damage is credited to the Artificer that placed it and an area's ticks to its caster (`HitContext.creditId`). `matchSummary(state)` rebuilds it from a finished state.
- **Vision:** each unit sees a Manhattan LOV diamond. Tall blockers stop sight with a flood fill within the LOV radius (R36; `VISION_OCCLUSION = 'tallBlockers'`): a tall blocker square is seen, nothing is seen through it, and sight may go round it. The v1 scenarios have none (`scenarioBlockers` gives each blocker its kind). A stealthed unit is invisible to the opponent until revealed by R1 (an adjacent enemy), R2 (damage inside enemy LOV) or R3 (`detection` hooks such as Mind's Eye and Ratasius). Mines are invisible until revealed by detection (`MINDS_EYE_REVEALS_MINES`).

## `PlayerView` (`projectView(state, seat)`)

| Field | Meaning |
|---|---|
| `seat`, `side`, `phase`, `settings`, `southSeat`, `names` | Identity and lobby data. |
| `turn` | `{ number, round, activeSeat }` or null before the battle. `ownTurns` gives both own-turn indexes. |
| `myAp`, `myApDebt`, `apPool` | My AP, my Cauldron debt, and this round's pool for both seats: the R1 curve, doubled while the R28 boost runs (public; the per-seat Market, Tribute and debt are not in it). |
| `opponentAp`, `opponentApDebt` | Public under R15 (null if `SHOW_OPPONENT_AP` is off). |
| `firstContactRound`, `siegeTurns` | R28 and R30 counters (public). |
| `lobby.ready`, `lobby.armyChosen` | Lobby status of both seats. |
| `myArmy`, `armies` | My army; both lists once public (deployment start under R33, or game end). |
| `commanders`, `commanderVariants` | Public in the lobby once selected (R16). |
| `deploymentConfirmed` | Both seats. |
| `visibility` | A 625-character string; `'1'` = in my vision (`index = y * 25 + x`, `isVisibleSquare(view, sq)`). |
| `units: UnitView[]` | My units (deployed or not) and the enemy units I see. |
| `fallen: UnitView[]` | My dead units, and everyone's at the end. |
| `mines: MineView[]` | `{ id, owner, square, revealed }`: my mines, plus revealed enemy mines in vision. |
| `areas: AreaView[]` | `{ id, abilityId, owner, squares, expiresAtOwnTurn, expiresAtTurn, data }`; enemy areas clipped to my vision. |
| `buildings` | `{ kind, anchor, controller }` (public). |
| `myCounters`, `myTurnCounters`, `preferences` | Ability bookkeeping for my seat; my options. |
| `decision`, `opponentDeciding` | A prompt for me; whether the opponent is answering one I can know about. |
| `takeback` | `{ request, canRequest, usedByMe, remaining }`; `request` is the seat's own projection (`TakebackRequestView`, see Take-backs). |
| `drawOffer`, `result` | `GameResult = { winner: Seat \| null, reason, turnNumber }`. |

`UnitView` (`extends UnitCore`): `id, type, owner, anchor, toughness, defending, stealthed` (always false for enemies), `isCommander, size, tier, power, maxToughness, lov, movement, attackRange`, and `own` (null for enemies). `own` is `OwnUnitDetails`: `{ baseToughness, actionAllowance, apCost, nextActionSurcharge, turn: { actionsUsed, moves, basicAttack, abilityUses, flags }, cooldowns, abilities }`. Unit names, symbols and texts come from the content tables, looked up by `type`.

When the game ends, the fog lifts: every unit, mine, area and army is shown.

## Events (`GameEvent` = `EventBody & { visibleTo }`; `filterEvents(events, seat)` → `VisibleEvent[]`)

Each event is emitted with its audience computed from both seats' vision at that moment. "Seats seeing the unit" means its owner, plus the opponent while the unit is visible to it. Where two seats may learn different things, the engine emits one variant per audience instead of redacting later.

| Event | Payload | Delivered to |
|---|---|---|
| `settingsChanged` | `settings` | both |
| `armyChosen` | `seat, commander, variant` | both (R16; under a later `COMMANDER_REVEAL` the opponent gets `commander: null, variant: null`) |
| `readyChanged` | `seat, ready` | both |
| `coinFlipped` | `southSeat` | both |
| `deploymentStarted` | `commanders` | both, and only when `COMMANDER_REVEAL` is `'deploymentStart'` (under R16 it never fires) |
| `unitPlaced`, `unitUnplaced` | `unitId, anchor`; `unitId` | own seat |
| `deploymentConfirmed` | `seat, confirmed` | both |
| `battleStarted` | `southSeat` | both |
| `turnStarted` | `seat, turnNumber, round` | both |
| `apChanged` | `seat, ap, delta` (a refill at a turn start, a payment, the loss of unspent AP after the end phase) | both (R15) |
| `turnEnded` | `seat` | both |
| `unitMoved` | `unitId, from, to`, one per step | the owner; the opponent for each step where it sees the unit before or after |
| `moveEnded` | `unitId, at, reason` (`completed`, `blocked`, `mine`, `reaction`, `died`) | seats seeing the unit |
| `defendChanged` | `unitId, defending, reason` (`action`, `expired`, `acted`) | seats seeing the unit |
| `unitAttacked` | `attackerId, target, source` | seats seeing the attacker |
| `attackMissed` | `attackerId, square` (a blind shot at an empty square) | the attacker's seat |
| `abilityUsed` | `unitId, abilityId, targets` | the user's seat; the opponent gets `targets: []` if it sees the unit |
| `abilityNote` | `unitId, abilityId, note` | whoever the ability chooses (`ctx.emit`) |
| `unitDamaged` | `unitId, amount, toughness, kind, source, dealerId, breakdown` | seats seeing the target; `dealerId` is null for a seat that can't see the dealer (A4-12) |
| `unitHealed`, `toughnessLost` | `unitId, amount, toughness, source` | seats seeing the unit |
| `maxToughnessChanged` | `unitId, delta, toughness, source` | seats seeing the unit |
| `unitDied` | `unitId, unitType, owner, at, cause` | seats seeing the unit as it dies |
| `unitRevived` | `unitId, anchor, toughness` | seats seeing the unit |
| `unitCreated` | `unitId, unitType, owner, anchor, createdBy` | seats seeing the new unit; `createdBy` is null for a seat that can't see the creator |
| `stealthChanged` | `unitId, stealthed` | the owner |
| `unitRevealed` | `unitId, cause` (`adjacency`, `damage`, `detection`), `byId` | the owner (`byId` only if it sees the revealer, A4-10); the opponent if it now sees the unit |
| `minePlaced` | `mineId, owner, square` | the owner |
| `mineRevealed` | `mineId, owner, square` | the owner, and the opponent if it sees the square |
| `mineExploded` | `mineId, owner, square, victimId, trigger` (`entered`, `shot`) | the owner, and the opponent if it sees the square; `victimId` is null for a seat that can't see the victim |
| `areaCreated` | `areaId, abilityId, owner, squares, expiresAtOwnTurn` | the owner in full; the opponent with only the squares in its vision (A4-13) |
| `areaExpired` | `areaId` | the owner, and the opponent if it sees any of the squares |
| `buildingCaptured`, `buildingHeld`, `buildingContested` | `building, seat, previous`; `building, seat`; `building` | both |
| `decisionRequested`, `decisionResolved` | `decisionId, seat, kind`; `decisionId, seat, choice, automatic` | the decider, and the opponent if it could see the subject |
| `takebackRequested`, `takebackDeclined`, `takebackApplied` | `seat` (the requester), `actionSeq` | both |
| `drawOffered`, `drawDeclined` | `seat` | both |
| `preferenceChanged` | `seat, key, value` | own seat |
| `gameEnded` | `result` | both |
| `matchSummary` | `summary: MatchSummary` = `{ winner, reason, turns, rounds, southSeat, scenarioId, armies, commanders, commanderVariants, unitTypes }`, where `unitTypes[seat][type]` = `{ damageDealt, damageTaken, kills, losses }` | both, right after `gameEnded` (R38, R39; the session logs it) |

The view is the truth; events drive animations, the log and achievements (A13-03). `breakdown` lists the pipeline steps `{ step: base\|addition\|subtraction\|reduction\|defend, source, delta, total }` for the forecast and log tooltips. `EventType` is the union of the `type` strings and `MoveEndReason` the `moveEnded` reasons.

## Client helpers (work on a `PlayerView`, so they can't leak)

| Function | Returns |
|---|---|
| `legalActions(view, unitId)` | `ActionOption[]`, each `{ kind: move\|attack\|defend\|charge\|ability, abilityId, cost, enabled, reason }`: the action bar with player-visible reasons. A Group march spans several units, so the UI builds it and checks it with `validateIntent`. |
| `reachableSquares(view, unitId)` | `{ anchor, path, knownMines }[]`: paths prefer avoiding known mines (A8-17). The UI asks before `knownMines > 0`, and always for the commander (R34, `COMMANDER_MINE_CONFIRMATION`). |
| `bestPath(view, unitId, to)` | A path or null. |
| `attackTargets(view, unitId)` | Legal basic-attack targets (units, and squares for range ≥ 2). |
| `chargeTargets(view, unitId)` | Legal `{ path, target }` pairs for a Charge. |
| `targetOptions(view, unitId, abilityId, index, picked)` | Candidates for pick `index` that satisfy the declarative spec. For the last pick, given every earlier one in `picked`, they also pass the whole `validateIntent` (the ability's own `validate` included), so the UI highlights only targets that will be accepted. |
| `previewAttack(view, attackerId, targetId)` | A `PipelineResult` forecast (`{ amount, breakdown }`) from my knowledge, or null if either unit is unknown. |
| `validateIntent(view, intent)` | The final legality check: the same check the authority runs. |
| `new ViewQuery(view)` | The `RulesQuery` over a view, for custom previews; `viewUnit(id)` returns the `UnitView`. |
| `deploymentSquares(side, type)`, `allowedZones(type)`, `checkArmy(army, settings)`, `armyCost`, `armyUnitCount`, `zoneCapacity` | Builder and deployment helpers (the same functions the authority uses). |

## Content (`src/content`)

- `ROSTER`, `unitDef(type)`, `COMMANDER_UNIT`, `NO_ACB_UNIT`, `TRIP_MINE`, `isRosterUnit`, `ROSTER_IDS`. Each `UnitDef` = `{ id, name, faction, tier, cost, power, toughness, size, lov, movement, ap, attackRange, vanguard, deployable, abilities, symbol }`.
  - **Empire:** Footman 1/2, Soldier 2/7, Berserker **8/2** (R20), Priestess 3/15, Paladin **10/18** (R21), Royal Wizard **10/24** (R25), Celestial Emissary 15/50.
  - **Lojrar:** Mercenary 2/1, Ranger 3/1, Rogue 7/4, Juliomancer 3/15, Artificer 1/15, Beast of Knorund 20/40 (size 2), Scourge of the Gods 15/33 (R4).
  - **Commander base** 1/5, Movement 2, AP 1, LOV 3 (R8). **No-ACB dummy** 0/7, LOV 1, Movement 0.
- `ABILITY_DATA`, `abilityData(id)`, `abilityParam(id, key)`, `abilityText(id)`. Each entry holds `{ id, name, kind: passive\|active\|triggered, apCost (number \| 'unit' \| null), usesAction, cooldown, usesPerTurn, sameTurnReuse, params, text, assumptions }`. Card text is rendered from `params` (`{key}` placeholders, `{apCost}`), with the S26 fixes applied, so cards and rules share the same numbers (R35).
- `COMMANDERS`, `commanderDef(id)`, `commanderVariant(id, variant)`, `groupFaction`, `isCommanderId`. Each `CommanderDef` = `{ id, name, title, group, selectable, stats, abilities, grants, revokes, tierOverrides, costRules, variants, text, assumptions }`.
  - Values: Trill 1/6 (R23), Queso 1/6 with AP 2 (R17), Ratasius LOV 6. Baba Yaga's variants are `mend`, `hex-ward` and `cauldron` (R11).
  - `'baseline'` is a non-selectable dev/test commander with no effects. It is allowed only with `settings.devContent`, and the DSL uses it by default.
- `FACTIONS`, `availableRoster(faction)`; `BUILDINGS`, `buildingDef(kind)` (size 3); `SCENARIOS`, `scenarioDef(id)` (`crossroads` with 21 blockers, `openField` with the same buildings and none; both have `tallBlockers: []`). `scenarioBlockers(scenario)` lists every blocker as `{ square, kind: 'low' | 'tall' }` (`BlockerKind`, R36) for renderers.
- Card texts that restate a tunable are built from the constant (R35), so changing `TRILL_COMMANDER_TOUGHNESS`, a `BABA_*` value or `QUESO_REVIVE_COST` changes the card too.
- Derived helpers: `tierFor(type, commander)`, `abilitiesFor(type, commander, variant)`, `unitCost(type, commander)`, `commanderStats`.

Ability ids (`content/abilities.ts`). The rule code for each lives in `abilities/units/<unit>.ts` or `abilities/commanders/<name>.ts`. Every entry is implemented (`content.test.ts` fails on a stub). The 13 **active** ones (declared by the player, with the picks of their `TargetSpec`s) are marked *A*; `apps/web/src/store/abilityCasting.test.ts` casts each of them through the battle UI's state machine against this engine.

| Unit or commander | Abilities |
|---|---|
| Footman | `footman.lineFormation` |
| Mercenary | `mercenary.fierceAttacker` |
| Soldier | `soldier.perseverance` |
| Ranger | `ranger.rangedAttack` |
| Berserker | `berserker.savagery` *A* (an attack target; after a basic Attack, not an action) |
| Rogue | `rogue.stealth` *A* (no picks; `secret`), `rogue.assault` (triggered; a `rogue.assault` prompt when several enemies are reached, ROG-5) |
| Priestess | `priestess.strongAura`, `priestess.sharedWounds` *A* (donor, recipient) |
| Juliomancer | `juliomancer.mindsEye`, `juliomancer.julioVernification` *A* (sacrifice, target) |
| Paladin | `paladin.reinforcedArmor` |
| Artificer | `artificer.mindsEye`, `artificer.prototypeNoAcb` *A* (free adjacent square), `artificer.madInventor`, `artificer.tripMine` *A* (free adjacent square; `secret`) |
| Royal Wizard | `royalWizard.forcefield` *A* (4 connected squares in LOV), `royalWizard.pajazon` *A* (a 3x3 centre) |
| Beast of Knorund | `beast.forcefulSlam` *A* (an adjacent square), `beast.feast` *A* (an adjacent own unit) |
| Celestial Emissary | `emissary.holyBlessing` *A* (no picks), `emissary.smite` *A* (a unit, own ones too under R14), `emissary.holyFervor` |
| Scourge of the Gods | `scourge.commandAura`, `scourge.tribute` |
| Trill | `trill.hydrocephalic`, granted to the army's tier 1, 2 and 5 units (each unit carries its permanent +1, A7-08), not held by the commander |
| Kulega | `kulega.finePrinter` (on the commander), `kulega.finePrint` (granted to tier-20 units) |
| Sabrina | `sabrina.reelfinisher`; she also revokes `artificer.tripMine` |
| Baba Yaga | `babaYaga.mend` *A* (granted to tier-1 units by the `mend` variant; no picks), `babaYaga.hexWard` (`hex-ward`), `babaYaga.cauldron` (`cauldron`; a reaction prompt) |
| Ratasius I | `ratasius.great` |
| Queso | `queso.beacon`, `queso.revive` (a reaction prompt) |

## Constants (`src/constants.ts`)

Every Appendix A switch and every ruling's constant is defined here, each with its ID; the export reference lists them all with their values. Highlights:

- **Board and vision:** `CORNER_RULE`, `ADJACENCY`, `MOVE_DIRECTIONS`, `VISION_OCCLUSION`.
- **AP:** `AP_BASE`, `AP_PER_ROUND_INCREMENT`, `AP_MAX`, `ESCALATION_FROM_ROUND`, `APPROACH_BOOST`, `apForRound`, `FIRST_TURN_AP`, `AP_CARRYOVER`, `ABILITY_COST_MODE`, `MAX_MOVES_PER_TURN`.
- **New actions:** `CHARGE_*`, `GROUP_MARCH_*`.
- **Damage and targeting:** `DAMAGE_ORDER`, `WEAKNESS_FLOOR`, `TARGET_REDUCTION_FLOOR`, `AURA_LOSS_CAN_KILL`, `OVERHEAL`, `SAME_NAME_STACKING`, `FRIENDLY_ATTACKS`, `FRIENDLY_SINGLE_TARGET`, `SQUARE_ATTACKS`.
- **Hidden information:** `MINDS_EYE_REVEALS_MINES`, `SHOW_OPPONENT_AP`, `COMMANDER_REVEAL`, `ARMY_LISTS_PUBLIC`.
- **Armies:** `BUDGET`, `ARMY_UNIT_CAP` (50), `VANGUARD_UNITS`.
- **Buildings:** `CAPTURE_TIMING`, `KEEP_POWER_BONUS`, `MARKET_AP_BONUS`, `BUILDING_SIZE`, `SIEGE_TURNS`.
- **Commanders:** the `BABA_*`, `QUESO_*` (including the function `QUESO_REVIVE_COST(tier)`), `TRILL_*`, `KULEGA_*` and `RATASIUS_*` constants.
- **Units and abilities:** `JULIO_DAMAGE_CAP`, `SMITE_SPLASH`, `SCOURGE_AP_BONUS`, `DUMMY_CAP(n)`, `MINE_CAP(n)`, `MINE_DAMAGE`.
- **Take-back and timers:** `TAKEBACKS`, `TAKEBACK_TIMEOUT_S`, `TURN_TIMER`, `TIME_BANK`, `REACTION_PROMPT_TIMEOUT_S`.

## Ability framework (for unit and commander files)

Each file `abilities/units/<unit>.ts` and `abilities/commanders/<name>.ts` exports `readonly AbilityDefinition[]`, and `abilities/index.ts` collects them. The registry indexes the definitions by id (`getAbility`, `liveAbility`, `registerAbility(def, { replace })`). The ids, costs, cooldowns, params and texts live in `content/abilities.ts`; **read numbers with `abilityParam(id, 'key')`, never literals.** Set `status: 'implemented'` once a file is done: stubs are listed on cards but refused when used (`NOT_IMPLEMENTED`), and their hooks are ignored.

```ts
export interface AbilityDefinition {
  id: AbilityId; status: 'implemented' | 'stub'
  modifyStats?(q: StatsQuery, holder, target): StatModifier | null   // power, baseToughness (permanent), maxToughness (aura), lov, movement, attackRange (at least), actions
  detection?(q, holder): { kind: 'lov' } | { kind: 'range'; range } | null   // reveals enemy stealthed units and mines
  attackerAddition?(q, holder /* = dealer */, hit): number   // step 2, attacks only
  attackerSubtraction?(q, holder /* any unit */, hit): number // step 3, dealt damage only
  targetReduction?(q, holder /* any unit */, hit): number     // step 4
  actionSurcharge?(actionsUsed): number                       // extra AP on the holder's next action
  onAdjacencyGained?(ctx, holder, { step, enemies, holderIsMover, holderStealthed }): 'interrupt' | 'continue' | void   // Assault; holderStealthed is judged as the step happens (ROG-6)
  onUnitStep?(ctx, holder, step): 'interrupt' | 'continue' | void
  onDamaged?(ctx, holder, hit, outcome): void
  onUnitDied?(ctx, holder, death: { unit, footprint, cause, tier, baseToughness, isCommander }): void
  endOfOwnTurn?(q, holder): { damage?, heal? } | null          // returned as data; applied in the 2.10 order
  endOfOpponentTurn?(q, holder): { damage?, heal? } | null
  startOfOwnTurn?(ctx, holder): void
  startOfTurnAp?(q, holder): number                            // extra AP at the owner's turn start (Tribute)
  onDecision?(ctx, holder, decision, choice): void             // answer to ctx.requestDecision
  active?: { targets: TargetSpec[]; requirement?(q, unit): string | null; validate?(q, unit, targets): string | null; resolve(ctx, unit, targets): void; secret?: boolean }
  area?: { targetReduction?(q, area, hit): number; endOfTurn?(q, area, endingSeat): { damage?, heal? } | null }
}
```

- **Holders.** Hooks run for every living unit that has the ability in its list (`q.abilitiesOf(unit)`). A unit's list is its own abilities plus the grants of its commander and variant, minus revokes. The commander unit carries the commander's and the variant's own abilities, so army-wide effects live there. Static hooks apply to every unit including the holder, so check `holder.id === target.id` or the owner yourself. Same-named modifiers count once per unit (the core keeps the field-wise maximum).
- **`TargetSpec`** (declarative, so the UI drives targeting from data):
  - `{ kind: 'unit', label, range, metric?, relation: own|enemy|any|harmful, includeSelf, allowCommander }`. Use `'harmful'` for single-target harmful effects (Smite, Julio Vernification's damage): enemies, plus own units while `FRIENDLY_SINGLE_TARGET` is on (R14; the UI confirms an own target).
  - `{ kind: 'square', label, minRange, range, metric?, free }` (free = open ground, no known unit, no own mine)
  - `{ kind: 'area3x3', label, centreRange }`
  - `{ kind: 'connectedSquares', label, count }` (inside LOV and orthogonally connected, or a 2x2 block under `FORCEFIELD_SHAPE = 'square2x2'`)
  - `{ kind: 'attack', label }` (any legal basic-attack target)

  Ranges are measured from the user's footprint, in Manhattan distance unless `metric` is given; "adjacent" picks (Shared wounds, Julio's sacrifice, Feast, Slam, the Artificer's squares) pass `metric: adjacencyMetric()` so they follow the `ADJACENCY` switch. The core checks them, as well as cooldowns, uses per turn, the action allowance and AP. `validate` adds custom rules and sees **only the actor's knowledge**: a `ViewQuery` on clients, the actor's projection on the host. `requirement` is the same for a rule that doesn't depend on the targets (Savagery after a basic Attack, Stealth's watcher check); `checkAbilityReady` runs it, so `legalActions` shows its reason before any pick. `secret: true` (Trip Mine) tells the opponent nothing about the use, not even an `abilityUsed` event while it sees the user (4.8).
- **`RulesQuery`** (read-only, on both the truth and a view):
  - Turn and players: `perspective, phase, activeSeat, turnNumber, settings, opponentOf, sideOf, ownTurn, commanderOf, commanderVariantOf`.
  - Units: `unit(id), units(), unitAt(sq), sizeOf, footprint, distance(a, b, metric?), isAdjacent, unitsWithin(origin, range), adjacentUnits, stats(unit)` (gives `UnitStats`: power, baseToughness, maxToughness, lov, movement, attackRange, actionAllowance, apCost, tier, size), `tierOf, isCommander, abilitiesOf, hasAbility`.
  - Board: `squareExists, isTerrain, hasSightBlockers, blocksSight, areas(), mines(), mineAt, buildings(), inLov`.
  - Counters: `unitTurn, cooldown, seatCounter, turnCounter, ap`.
  - `StatsQuery` (for `modifyStats`) is the same minus `stats` and `inLov`, which prevents recursion.
- **`ResolveContext`** (truth side, extends `RulesQuery`):
  - Damage and toughness: `dealDamage(hit)`, `dealDamageTogether(hits)` (one effect instance, simultaneous, once per unit), `dealSplash(spec)` (below), `heal`, `loseToughness(unit, n, source, { canKill })`, `sacrifice` (death triggers run after the effect), `changePermanentToughness`.
  - `dealSplash({ source, dealer, target, damage, squares, splash, friendlyFire })` (`SplashSpec`): fixed ability damage on `target` (or null for an empty square) plus `splash` on every unit standing on `squares`, as one simultaneous effect. The main hit comes first, so a unit on both takes only `damage`; a unit covering several squares takes `splash` once; no mine goes off; `friendlyFire: false` skips the dealer's own units. Smite (R25): `squares = adjacentSquares(target.anchor, size, 'ORTHO_4')`, `friendlyFire: true`. Forceful slam (A8-20): `squares = slamSplash(anchor, 2, square)`, `friendlyFire: SLAM_FRIENDLY_FIRE`.
  - Attacks and creation: `attack(attacker, target, { source, triggered })`, `createUnit('noAcb', owner, square, creator)`, `placeMine`, `createArea({ abilityId, owner, source, squares, durationOwnTurns, data })`.
  - Hidden information: `setStealthed`, `reveal`.
  - Revives and AP: `revive(unitId, toughness, anchor?)`, `exhaust(unit)`, `chargeAp(seat, n)` (pays now on the seat's own turn, otherwise becomes a debt).
  - Decisions and bookkeeping: `requestDecision({ abilityId, holder, seat, kind, prompt, options, defaultOption, alwaysOption?, preferenceKey?, subject?, data? })`, `setTurnFlag`, `setMemory`/`memory`, `setSeatCounter`, `setTurnCounter`, `fallenUnit`.
  - Vision and events: `canSee`, `seesSquare`, `emit(eventBody, visibleTo)`.

  `HitContext` = `{ target, kind: attack|ability|mine|tick, base, source, dealer, creditId? }`. Set `dealer` for instant damage a unit deals, so that Ratasius' weakness applies to it. `creditId` only names the unit credited in the match statistics when there is no dealer; the core sets it for mines and end-of-turn ticks.

The three kernel exemplars show the pattern:

```ts
// abilities/units/soldier.ts: end-of-own-turn regeneration
{ id: 'soldier.perseverance', status: 'implemented', endOfOwnTurn: (_q, holder) => ({ heal: [{ target: holder.id, amount: HEAL }] }) }
// abilities/units/paladin.ts: a target-side flat reduction (the floor of 1 is the pipeline's)
{ id: 'paladin.reinforcedArmor', status: 'implemented', targetReduction: (_q, holder, hit) => (hit.target.id === holder.id ? REDUCTION : 0) }
// abilities/units/ranger.ts: a static modifier; with range >= 2 the core allows blind shots and remote mine detonation
{ id: 'ranger.rangedAttack', status: 'implemented', modifyStats: (_q, holder, target) => (target.id === holder.id ? { attackRange: RANGE } : null) }
```

Every stub carries a `TODO(<IDs>)` with the hook to use and the rules to honour. The hooks for the abilities the rulings changed:

| Ruling | Ability | Kernel support (and the test that exercises it with a stand-in) |
|---|---|---|
| R25 | Tribute (+2 AP while alive) | `startOfTurnAp: () => abilityParam(id, 'ap')`; added after the cap, once per ability id (`ap.test.ts`). |
| R25 | Smite splash | `dealSplash` with the target's 4 orthogonal neighbours (`ruling-hooks.test.ts`). |
| R14 | Smite, Julio Vernification | `relation: 'harmful'` (`rulings.test.ts`). |
| R22 | Julio Vernification cap | `abilityParam('juliomancer.julioVernification', 'cap')` (= `JULIO_DAMAGE_CAP`). |
| R11 A | Mend the swarm | an `active` ability with `usesAction: false`; `q.seatCounter` / `ctx.setSeatCounter` for the 3 uses per turn (reset at the owner's turn start). |
| R11 B | Hex Ward | on the commander: `modifyStats` `{ maxToughness }` plus `targetReduction` for own tier-1 units in range; the pipeline adds it to other reductions and floors at 1, and losing the aura never kills (`ruling-hooks.test.ts`). |
| R11 C, R18 | Cauldron, Queso's revive | `onUnitDied` → `ctx.requestDecision({ options, defaultOption: 'no', alwaysOption, preferenceKey: 'revive', subject })` → `onDecision` → `ctx.chargeAp` (a debt on the opponent's turn, shown to both seats) / `ctx.changePermanentToughness(holder, -QUESO_REVIVE_COST(death.tier))`, then `ctx.revive(unitId, toughness, anchor)` and, for the Cauldron, `ctx.exhaust`. Per-turn and per-unit limits: `ctx.setTurnCounter`, `ctx.setMemory` (`primitives.test.ts`, `turn.test.ts`). |
| R19 | Shared wounds | `ctx.loseToughness(donor, Math.ceil(t / 2), id, { canKill: true })` (`actions.test.ts`). |
| R23, R24 | Trill, Queso's beacon | `abilityParam(id, 'toughness')` = 1 and `abilityParam(id, 'heal')` = 3. |

Core support that ability authors can rely on:

- reveal rules R1-R3;
- mines (stepping on them, blind shots, unseen-mine creation);
- deaths, deferred sacrifice triggers and commander-death wins;
- toughness-aura syncing;
- decision queueing, preferences and resuming the end phase;
- AP debt;
- per-turn and per-game counters.

## Testing (`src/testing`)

```ts
import { buildBattle, act, startMatch, sqs, unitIn, findLeaks } from '@coinduel/engine'

const b = buildBattle({
  south: ['paladin@E5:P', { type: 'soldier', at: 'F5', label: 'S', toughness: 3, defending: true }],
  north: ['berserker@E6:B', { type: 'rogue', at: 'J9', stealthed: true }],
  commanders: { north: 'babaYaga' }, variants: { north: 'hex-ward' },
  mines: [{ owner: 'north', at: 'E7', label: 'm' }], control: { keep: 'south' },
  settings: { scenarioId: 'crossroads' }, active: 'south', ap: 20,
})
const r = act(b.state, b.south, { kind: 'attack', unitId: b.id('P'), target: { kind: 'unit', unitId: b.id('B') } })
expect(unitIn(r.state, b.id('B'))).toBeUndefined()
expect(findLeaks(r.state, b.north)).toEqual([])
```

- **`buildBattle(spec)`** builds a battle-phase state directly; placements are not validated against zones.
  - `BattleSpec` = `{ south?, north?, commanders?, variants?, southSeat?, active?, ap?, settings?, control?, mines?, seed? }`. A `Placement` is `'type@SQUARE'`, `'type@SQUARE:label'` or a `PlacementSpec` `{ type, at, label?, toughness?, defending?, stealthed? }`; a mine is `{ owner, at, revealed?, label? }`.
  - Defaults: Open Field with `devContent` on, the effect-free `baseline` commander (a side without a commander gets one on E1 / U25), each commander's first variant, host = South, South's turn 1 with 20 AP (the boosted round-1 pool), buildings neutral.
  - Placements that are off open ground or overlapping throw.
  - It returns a `Battle`: `{ state, south, north, ids, mineIds, id(label), seat(side) }`. A placement written `'type@SQUARE:label'` gets that label; without one, the label is the placement string. Mine labels default to `mine0`, `mine1`, and so on.
- **`act(state, seat, intent, options?)`** is `apply` that throws with the rejection message.
- **`startMatch(spec)`** takes a `MatchStartSpec` `{ armies, seed?, coinSeed?, settings? }`, runs the real lobby → deployment flow through `submit` (on Open Field unless `settings` says otherwise) and returns a `MatchRecord` in the battle.
- **`sqs('E6', 'E7')`** parses square names; **`unitIn(state, id)`** returns a living unit.
- **`findLeaks(state, seat, view?)`** lists fog leaks with their JSON paths. **`findEventLeaks(before, after, seat, events)`** checks one resolution's delivered events the same way: every unit they name must be the seat's own, seen before or after, or the subject of one of them.
- **Testing a core rule that depends on a stub:** register a test-local stand-in with `registerAbility({ id: 'royalWizard.pajazon', status: 'implemented', area: {...} }, { replace: true })`. Vitest isolates modules per test file, so it affects only that file. Unit and commander agents should put their tests next to their file, for example `abilities/units/rogue.test.ts`.

## History, replay, snapshots, hashing

- `startRecord(initial)` → `MatchRecord { initial, log, state, frames }`.
- `submit(record, seat, intent)` → `{ ok, record, events } | Rejection`. It keeps a take-back frame (the state before each battle action) for the current and previous turn.
- `replay(initial, log)` → `GameState`, deterministic and equal to the live state. `replayRecord(initial, log)` also returns the frames. Both throw `ReplayError` if an entry no longer applies.
- `serializeRecord(record)` / `restoreRecord(json)` save and load a match; `serializeState` / `deserializeState` do the same for a single state (canonical JSON).
- `hashState(state)` and `hashJson(value)` give a 64-bit FNV-1a over canonical JSON. `sha256Hex(text)` is a pure-TS SHA-256. `seedRng`, `nextUint32`, `nextInt` and `flipFirstSeat` are the mulberry32 helpers (the coin flip only).

## Rulings applied (R1-R42)

Audited ruling by ruling against `docs/RULES_INTERPRETATION.md` (the rulings table at its top wins over everything else). "Session", "app" and "ability files" mark the rulings this package only supports.

| Ruling | Where | Tests |
|---|---|---|
| R1, R9, R28 AP curve, boost, escalation | `apForRound`, `economy.roundPool` / `approachBoostApplies`, `turn.turnPool`, `Resolver.noteFirstContact` (on every vision change), `view.apPool` | `ap.test.ts`, `rulings.test.ts`, `commands.test.ts` |
| R2, R10 50-unit cap | `checkArmy` (roster units only) | `commands.test.ts` |
| R3 orthogonal movement | `MOVE_DIRECTIONS` | `movement.test.ts` |
| R4 one home roster per faction; R43 mixed armies | `UnitDef.faction` (home faction), `availableRoster` (all 14 for every banner), `checkArmy` (an unknown banner is an error) | `content.test.ts`, `commands.test.ts` |
| R5, R40, R42 | nothing to build (Soldier stays 2/7, no Mercenary cap, no Warpath) | `content.test.ts` |
| R11, R44, R45 Baba Yaga | `BABA_WHITE` (`isBabaWhite`: the Lojrar Clan units), `ArmyList.variant` checked by `checkArmy`, the three variants in `content/commanders.ts`; the effects are the commander file's; an unpaid Cauldron debt carries in `turn.startTurn` | `content.test.ts`, `commands.test.ts`, `babaYaga.test.ts`, `primitives.test.ts`, `ruling-hooks.test.ts` |
| R7 commanders unlocked | `COMMANDER_FACTION_LOCK = false` | `commands.test.ts` |
| R8, R17, R23 commander stats | `COMMANDER_UNIT`, `CommanderDef.stats` (Trill 1/6, Queso 1/6 AP 2) | `content.test.ts`, `commands.test.ts` |
| R12 extra actions may be Moves | `MAX_MOVES_PER_TURN = 'allowance'`, `checkCanAct` | `economy.test.ts` |
| R13 weakness floor 1 | `WEAKNESS_FLOOR`, `runPipeline` | `damage.test.ts` |
| R14 friendly single targets | `relation: 'harmful'` in `checkTarget` | `rulings.test.ts`, `ruling-hooks.test.ts` |
| R15 AP public | `opponentAp`, `opponentApDebt`, `apChanged` to both seats | `view.test.ts`, `ap.test.ts` |
| R16 commander in the lobby | `armyChosen`, `view.commanders`, `view.commanderVariants` | `commands.test.ts`, `rulings.test.ts` |
| R18, R19, R22, R24 | `QUESO_REVIVE_COST`, `SHARED_WOUNDS_ROUNDING`, `JULIO_DAMAGE_CAP`, `QUESO_BEACON_HEAL` and the ability params; the effects are the ability files' | `rulings.test.ts` |
| R20, R21, R25 unit stats | `ROSTER` (Berserker 8/2, Paladin 10/18 with armour 2, Royal wizard 10/24) and the Paladin exemplar | `content.test.ts`, `paladin.test.ts`, `damage.test.ts` |
| R25 Tribute, Smite splash | `startOfTurnAp`, `dealSplash`; the abilities are the ability files' | `ap.test.ts`, `ruling-hooks.test.ts` |
| R26 Charge | the `charge` intent, `checkCharge`, `chargeTargets`; the action bar's Charge (C) in the app | `actions.test.ts`, `apps/web/src/store/command.test.ts` |
| R27 Group march | the `groupMarch` intent, `checkGroupMarch`; the action bar's March (G) in the app | `actions.test.ts`, `apps/web/src/store/command.test.ts` |
| R29 turn timer | `MatchSettings.turnTimerSeconds` / `timeBankSeconds`; the host session runs the clock (`apps/web/src/net/authority.ts`, `turnClock.ts`) and ends the turn | `apps/web/src/net/protocol.test.ts`, `localSession.test.ts` |
| R30 Siege | `checkSiege`, `SeatState.siegeTurns`, `view.siegeTurns` | `buildings.test.ts` |
| R31 Keep and Market | `stats.buildingModifiers` (+1 Power, tier-1 action), `turnPool` (+2 AP) | `damage.test.ts`, `buildings.test.ts`, `economy.test.ts` |
| R32 3x3 buildings | `BUILDING_SIZE`, scenario anchors F12 / R12, `ringSquares` (16 squares) | `geometry.test.ts`, `buildings.test.ts`, `rulings.test.ts` |
| R33 army lists public | `projectView` from the start of deployment | `commands.test.ts` |
| R34 commander mine confirmation | `COMMANDER_MINE_CONFIRMATION`; the prompt is the app's (`apps/web/src/store/command.ts`, `hazardsOf`) | `apps/web/src/store/command.test.ts` |
| R35 text from data | `abilityText`, card texts built from the constants | `content.test.ts` |
| R36 tall blockers | `ScenarioDef.tallBlockers`, `scenarioBlockers`, `VISION_OCCLUSION`, `lovIndices` | `vision.test.ts`, `rulings.test.ts` |
| R37 commit-reveal and audit | `commitSecret` / `verifySecret` / `combineSecrets`, `replay`; the protocol is the session's (`apps/web/src/net/fairness.ts`), the check is on the result screen | `readme.test.ts`, `hash.test.ts`, `apps/web/src/net/fairness.test.ts` |
| R38, R39 match log | `matchSummary` event and function, `GameState.matchStats`; the sessions store the log (`apps/web/src/net/matchLog.ts`), the achievements screen lists it; the AI harness is later dev tooling | `summary.test.ts`, `apps/web/src/net/localSession.test.ts` |
| R41 Ratasius | `RATASIUS_WEAKNESS_RANGE = 1`; the effect is the commander file's | - |

## Known gaps (kernel)

- Two Scourges give Tribute's +2 AP once: `startOfTurnAp` counts once per ability id, the A3-15 reading also used for Command Aura. R25 does not say; this is the default until the owner answers.
- `legalActions` has no Group march entry, because a march spans several units: the UI builds the intent and checks it with `validateIntent`.
- `ctx.revive` returns null when the target squares are taken. Queso's file then picks the nearest free square to the death square (lowest row, then column) with no second prompt; A7-16 says the controller chooses among equally near squares. The free-square check reads true positions, so an unseen stealthed enemy within range 2 is skipped (a one-bit leak in this rare fallback). A Cauldron return with no free square next to Baba Yaga simply doesn't happen (R11).
- Several deaths queued at once: Queso offers every death he could pay for on its own (a later "yes" he can no longer afford fails with an `abilityNote`), while the Cauldron counts waiting prompts against its 2-per-turn limit and the AP, so it never offers more than it can honour. The owner may want one policy.
- A Cauldron return at the end of the owner's own turn (an enemy Pajazon tick, say) is paid from the AP left over, so with 0 AP no return is offered. Leftover AP is then lost once the end phase is over (`apChanged` to 0, A2-03).
- Kulega's +1 LOV and Sabrina's +2 Power sit on the commander unit, so on the final board after that commander dies they revert; this is cosmetic. `endGame` re-syncs every toughness aura, so a final board never shows a unit above its max.
- An opponent who saw a death learns from whether a prompt appears that Queso is within range 2 and can pay, or that Baba Yaga has a free neighbour and returns left (C14 / PX BT-14, inherent in live prompts).
- `canRequestTakeback` flips to false as soon as the opponent acts, even with an unseen unit. This is a one-bit leak inherent in TB-3's "until the opponent acts".
- Turn timer, time bank, prompt timeouts, storing the match log and the AI harness (R29, R38) belong to the session layer. The engine carries the timer settings and emits `matchSummary`.
- The Crossroads blockers keep their v1 positions under R32's 3x3 buildings. The rings, symmetry and connectivity are verified by tests, but the owner may want a new layout (Q104).
- The Keep's +1 Power (R31, "on basic attacks") is a Power bonus, so it applies to all attack damage: basic attacks, Charge, Savagery and Assault (A3-02). Ability damage with a fixed number never gets it.
- R37's commit-reveal of armies and deployments, and its post-game audit, are the session's job (`apps/web/src/net/fairness.ts`): it commits with `commitSecret(nonce + canonicalJson(army))`, checks with `verifySecret`, and audits a finished match with `replay(initial, log)`.

Owner questions raised while implementing (defaults are in the code, each next to its assumption id):

- **ROG-10**: an Assault that kills the only adjacent enemy leaves the Rogue stealthed, because no reveal condition holds, so "once per Stealth activation" is kept in unit memory. The alternative is to reveal the Rogue after any Assault.
- **A7-04 under R19**: a commander may donate with Shared wounds only while it keeps at least 1 toughness (a donor at 1 would die and lose the game). The alternative is to allow it.
- **R14**: Julio Vernification and Smite may target own units but not the caster itself (`includeSelf: false`).
- **R25 (Q101)**: Smite's splash hits every unit next to the target, so an Emissary that Smites an adjacent unit takes 3 itself.
- **X-28** (a Mad inventor dummy setting off a stealthed Rogue's Assault) can't happen in v1: any square such a dummy can step to next to a Rogue is within 3 of its Artificer, so Mind's Eye reveals the Rogue first. Tall blockers (R36) would make it possible.
- **R45 Cauldron debt**: with costs up to 20 AP, two returns on the opponent's turn can owe more than the next pool. The rest of the debt carries to the following turn (the pool stays at 0 meanwhile). The alternative is to refuse a return whose debt would exceed the next pool.
- **R29 against 2.11**: R29 stops the turn timer for every reaction prompt, but a prompt the other seat can't see must look like an ordinary pause. The session stops the real clock and shows that seat a running one, which is corrected at its next delivery once the prompt ends. The alternative is not to stop the timer for hidden prompts.

## Export reference

Everything `src/index.ts` exports, by module. Types are marked *(type)*; everything else is a runtime value. `ENGINE_VERSION` is the package version string (`'0.1.0'`).

### Core types (`types.ts`)

| Symbol | Meaning |
|---|---|
| `Seat` *(type)*, `SEATS` | `'host' \| 'guest'`, and the list `['host', 'guest']`. |
| `Side` *(type)* | `'south' \| 'north'`. |
| `Square`, `Metric` *(types)* | `{ x, y }`, 0-based; `'manhattan' \| 'chebyshev'`. |
| `Tier` *(type)*, `TIERS` | A unit's grade and default cost, `1 \| 2 \| 5 \| 10 \| 20 \| 50 \| 100`, and the list of them. |
| `RosterUnitId`, `UnitTypeId` *(types)* | The 14 roster ids; the same plus `'commander'` and `'noAcb'`. |
| `CommanderId` *(type)* | `'trill' \| 'kulega' \| 'sabrina' \| 'babaYaga' \| 'ratasius' \| 'queso' \| 'baseline'`. |
| `FactionId`, `BuildingKind`, `ScenarioId`, `Phase` *(types)* | `'empire' \| 'lojrar'`; `'keep' \| 'market'`; `'crossroads' \| 'openField'`; `'lobby' \| 'deployment' \| 'battle' \| 'ended'`. |
| `UnitId`, `MineId`, `AreaId`, `DecisionId`, `AbilityId` *(types)* | Opaque strings. Ability ids read `'<unit or commander>.<ability>'`. |
| `JsonValue` *(type)* | Any JSON value (decision data). |
| `ArmyList`, `MatchSettings` *(types)* | See the Intents table and `DEFAULT_SETTINGS`. |
| `UnitCore` *(type)* | `{ id, type, owner, anchor, toughness, defending, stealthed }`: the fields views and hooks share. |
| `UnitState` *(type)* | The stored unit: `UnitCore` plus `seq, createdBy, permanentToughness, auraToughness, cooldowns, turn, memory`. |
| `UnitTurnState`, `CooldownState` *(types)* | `{ actionsUsed, moves, basicAttack, abilityUses, flags }`; `{ usedOnOwnTurn, readyOnOwnTurn }`. |
| `FallenUnit`, `DeathCause` *(types)* | `{ unit, diedOnTurn, cause }`; `'damage' \| 'sacrifice' \| 'auraLoss' \| 'toughnessLoss'`. |
| `MineState`, `AreaState`, `BuildingState` *(types)* | Stored mines `{ id, owner, square, revealed, seq, placedBy }`, areas `{ id, abilityId, owner, sourceId, squares, createdOnOwnTurn, expiresAtOwnTurn, seq, data }` and buildings `{ kind, anchor, controller }`. |
| `SeatState` *(type)* | `{ name, army, ready, deploymentConfirmed, ap, ownTurns, counters, turnCounters, apDebt, siegeTurns, preferences }`. |
| `TurnState`, `TurnTransition`, `TransitionStep` *(types)* | `{ number, activeSeat }`; the resumable end phase `{ endingSeat, next }`, where `next` is `'damage' \| 'heal' \| 'capture' \| 'expire' \| 'start'`. |
| `DecisionOption`, `PendingDecision` *(types)* | `{ id, label }`; a queued prompt `{ id, seat, abilityId, holderId, kind, prompt, options, defaultOption, alwaysOption, preferenceKey, timeoutSeconds, publicTo, data }`. |
| `TakebackRequest`, `TakebackState`, `LastAction`, `ActionDisclosure`, `DisclosedMine` *(types)* | The open request; `{ request, declined, used }`; `{ seq, seat, intent, seenByOther, disclosure }`, the action a take-back would undo with what each seat saw of it (TB-4, TB-5). |
| `GameResult`, `GameResultReason` *(types)* | `{ winner, reason, turnNumber }` (a null winner is a draw); `'conquest' \| 'domination' \| 'siege' \| 'resignation' \| 'agreement' \| 'simultaneousCommanderDeath'`. |
| `UnitTypeTally`, `MatchStats` *(types)* | `{ damageDealt, damageTaken, kills, losses }`; `Record<Seat, Partial<Record<UnitTypeId, UnitTypeTally>>>`, kept in `GameState.matchStats` (R39). |
| `RngState`, `GameState` *(types)* | `{ s }`, the mulberry32 state of the coin flip; the whole match (see Invariants). |

### Constants (`constants.ts`)

Values as shipped. A type alias in parentheses lists a switch's alternatives.

| Constants | Value | Rule |
|---|---|---|
| `SCHEMA_VERSION`, `RULES_VERSION` | 2, 2 | Stored in every state; the netcode handshake compares the rules version (NC 7.17). Schema 2 added `matchStats`. |
| `BOARD_SIZE` | 25 | 1.1 |
| `CORNER_RULE` (`CornerRule`), `CORNER_RADIUS` | `'A'`, 4 | A1-02 corner cut; rules B, C and D are implemented too. |
| `ADJACENCY`, `MOVE_DIRECTIONS` (`Neighbourhood`) | `'ORTHO_4'`, `'ORTHO_4'` | A1-05, A1-08 (`'KING_8'` is the alternative). |
| `VISION_OCCLUSION` (`VisionOcclusion`) | `'tallBlockers'` | R36 (`'none'`, `'allTerrain'`). |
| `AP_BASE`, `AP_PER_ROUND_INCREMENT`, `AP_MAX` | 10, 1, 20 | R1 curve. |
| `ESCALATION_FROM_ROUND`, `APPROACH_BOOST` | 20, 2 | R28. |
| `apForRound(round)` | function | The R1 curve with R28's escalation, without the boost or bonuses. |
| `FIRST_TURN_AP`, `AP_CARRYOVER`, `AP_PAYMENT` | null, 0, `'perAction'` | R1/R9, A2-03, A2-09. |
| `ABILITY_COST_MODE` (`AbilityCostMode`) | `'replace'` | A2-10 (`'add'`). |
| `ACTIONS_PER_TURN`, `MAX_MOVES_PER_TURN` | 1, `'allowance'` | A2-07, R12. |
| `CHARGE_ENABLED`, `CHARGE_SURCHARGE`, `CHARGE_MIN_MOVEMENT` | true, 1, 2 | R26. |
| `GROUP_MARCH_ENABLED`, `GROUP_MARCH_COST`, `GROUP_MARCH_MAX` | true, 2, 6 | R27. |
| `MOVE_EXACT_DISTANCE`, `COOLDOWN_MODE` | false, `'skipOwnTurns'` | A2-15, A2-22. |
| `DURATION_UNIT`, `DEFAULT_EFFECT_DURATION_OWN_TURNS` | `'ownTurns'`, 1 | A2-23, A2-24. |
| `DAMAGE_ORDER` (`DamageOrder`) | `'subtractThenHalve'` | A3-03 (`'halveThenSubtract'`). |
| `TARGET_REDUCTION_FLOOR`, `WEAKNESS_FLOOR` | 1, 1 | A3-05, R13. |
| `AURA_LOSS_CAN_KILL`, `OVERHEAL`, `SAME_NAME_STACKING` | false, false, false | A3-11, A3-10, A3-15. |
| `SACRIFICE_ENEMIES`, `SACRIFICE_COUNTS_AS_DEATH` | false, true | A3-13. |
| `FRIENDLY_ATTACKS`, `FRIENDLY_SINGLE_TARGET` | false, true | A3-14, R14. |
| `SQUARE_ATTACKS` (`SquareAttacks`), `SQUARE_ATTACK_MIN_RANGE` | `'rangedOnly'`, 2 | A2-18 (`'everyAttack'`). |
| `STEALTH_FAIL_MODE`, `MINDS_EYE_REVEALS_MINES` | `'disableIfVisibleElseFail'`, true | A4-05, A4-11. |
| `SHOW_OPPONENT_AP`, `ATTACKER_GHOST_MARKER`, `LAST_SEEN_MARKERS` | true, false, true | R15, A4-12, A4-16 (last-seen markers are client memory). |
| `BUDGET`, `MUST_SPEND_FULL_BUDGET`, `MIN_ARMY_UNITS` | 200, false, 0 | A5-02, A5-12. |
| `ARMY_UNIT_CAP` | 50 | R2, R10: the commander and units created in play don't count. |
| `NORMAL_ZONE_ROWS`, `EXTENDED_ZONE_ROWS`, `VANGUARD_UNITS` | 5, 2, `['rogue', 'ranger']` | A5-05, A5-04. |
| `COMMANDER_REVEAL` (`CommanderReveal`), `ARMY_LISTS_PUBLIC` | `'lobby'`, true | R16 (`'deploymentStart'`, `'battleStart'`), R33. |
| `CAPTURE_TIMING` (`CaptureTiming`) | `'endOfEveryTurn'` | A6-07 (`'endOfOwnTurn'`). |
| `STEALTH_CAPTURES`, `DUMMIES_CAPTURE` | true, true | A6-08. |
| `KEEP_ENABLED`, `MARKET_ENABLED` | true, true | A6-09 lobby defaults. |
| `KEEP_POWER_BONUS`, `MARKET_AP_BONUS` | 1, 2 | R31. |
| `MARKET_TIER1_ACTION`, `MARKET_EXTRA_ACTIONS`, `MARKET_TIERS` | true, 1, `[1]` | A6-11, R31. |
| `BUILDING_SIZE`, `SIEGE_TURNS`, `SIMULTANEOUS_COMMANDER_DEATH` | 3, 5, `'draw'` | R32, R30, A6-02. |
| `LOJRAR_PROXY_ROSTER`, `COMMANDER_FACTION_LOCK` | false, false | R4, R7. |
| `COMMANDER_BASE_TOUGHNESS`, `COMMANDER_MOVEMENT` | 5, 2 | R8. |
| `TRILL_COMMANDER_TOUGHNESS`, `TRILL_TOUGHNESS_BONUS` | 6, 1 | R8, R23. |
| `QUESO_COMMANDER_TOUGHNESS`, `QUESO_AP`, `QUESO_BEACON_HEAL` | 6, 2, 3 | R8, R17, R24. |
| `QUESO_REVIVE_COST(tier)` | 3, 2 or 1 | R18: tier 100, tier 50, anything else. |
| `QUESO_SELF_HEAL`, `QUESO_MIN_MAX_TOUGHNESS`, `QUESO_BEACON_TIMING` (`QuesoBeaconTiming`) | true, 1, `'endOfOwnTurn'` | A7-15, A7-16 (`'startOfOwnTurn'`). |
| `SABRINA_ARTIFICER_COST`, `SABRINA_ARTIFICER_TIER` | 10, 10 | A7-11. |
| `SABRINA_SURCHARGE`, `SABRINA_SURCHARGE_MIN_TIER` | 120 (percent, rounded up), 20 | A7-11. |
| `BABA_WHITE`, `BABA_VARIANTS` (`BabaVariant`), `BABA_COMMANDER_TOUGHNESS` | `{ faction: 'lojrar' }`, `['mend', 'hex-ward', 'cauldron']`, 6 | R44, R11, R45. |
| `BABA_MEND_COST`, `BABA_MEND_HEAL`, `BABA_MEND_USES_PER_TURN`, `BABA_MEND_MAX_PER_UNIT` | 1, 4, 3, 2 | R11 variant A, retuned by R45. |
| `BABA_HEX_RANGE`, `BABA_HEX_REDUCTION`, `BABA_HEX_TOUGHNESS` | 3, 1, 1 | R11 variant B. |
| `BABA_CAULDRON_COST(tier)`, `BABA_CAULDRON_PER_TURN`, `BABA_CAULDRON_PER_UNIT`, `BABA_CAULDRON_AP_DEBT` | max(1, ceil(tier / 5)), 2, 2, true | R11 variant C, retuned by R45. |
| `KULEGA_ENEMY_DEATHS`, `KULEGA_HEAL_CAP` | true, 4 | A7-10. |
| `RATASIUS_WEAKNESS`, `RATASIUS_WEAKNESS_RANGE`, `RATASIUS_DETECTION_RANGE` | 4, 1, 3 | A7-14. |
| `REACTION_PROMPT_TIMEOUT_S`, `REVIVE_PREFERENCE` (`PreferenceValue`) | 15, `'ask'` | A2-30 (`'ask' \| 'always' \| 'never'`). |
| `MERC_COUNTS_SELF`, `SAVAGERY_WINDOW` | false, `'restOfTurn'` | A8-02, A8-05. |
| `SHARED_WOUNDS_COST`, `SHARED_WOUNDS_ROUNDING`, `SHARED_WOUNDS_RECIPIENT` | `'unit'`, `'ceil'`, `'selfOrAdjacent'` | A8-09, R19. |
| `JULIO_RANGE_ORIGIN`, `JULIO_DAMAGE_CAP` | `'juliomancer'`, 15 | A8-11, R22. |
| `SMITE_SPLASH`, `SCOURGE_AP_BONUS` | 3, 2 | R25. |
| `DUMMY_CAP(n)`, `MINE_CAP(n)` | 3 + floor((n - 1) / 2), 5 + (n - 1) | A8-13, A8-16; n = own Artificers alive. |
| `DUMMY_MOVE`, `DUMMY_SUMMONING_SICKNESS` | 1, false | A8-15, A8-14. |
| `MINE_DAMAGE`, `MINE_LARGE_BONUS`, `MINE_LARGE_MIN_SIZE` | 5, 5, 2 | A8-16. |
| `FORCEFIELD_SHAPE` (`ForcefieldShape`), `FORCEFIELD_DURATION` | `'connected'`, 1 | A8-18 (`'square2x2'`). |
| `PAJAZON_CENTRE_RANGE`, `PAJAZON_DURATION` | 3, 2 | A8-19. |
| `SLAM_FRIENDLY_FIRE`, `FEAST_TOUGHNESS` | true, `'current'` | A8-20, A8-21. |
| `HOLY_BLESSING_SELF`, `HOLY_FERVOR_SURCHARGE` | true, `'everyActionAfterFirst'` | A8-22, A8-24. |
| `COMMAND_AURA_RANGE` | 2 | A8-25. |
| `OWN_MINE_WARNING`, `COMMANDER_MINE_CONFIRMATION` | true, true | A8-17, R34 (client prompts). |
| `TAKEBACKS`, `TAKEBACK_TIMEOUT_S`, `TAKEBACKS_PER_GAME` | true, 30, null | A9-04 (null = unlimited). |
| `TURN_TIMER`, `TIME_BANK`, `TURN_LIMIT` | 90, 60, null | R29 (the session runs the clock); no turn limit. |
| `VIEW_MODE_DEFAULT` | `'top'` | A1-16 (presentation only). |

### Content (`content/*`)

| Symbol | Meaning |
|---|---|
| `UnitDef` *(type)*, `ROSTER`, `ROSTER_IDS`, `unitDef(type)`, `isRosterUnit(id)` | Unit lines (see Content); `unitDef` throws on an unknown type. |
| `COMMANDER_UNIT`, `NO_ACB_UNIT`, `TRIP_MINE` | The base commander, the No-ACB dummy, and the mine object `{ name, damage, largeBonus, largeMinSize }`. |
| `AbilityData`, `AbilityKind` *(types)*, `ABILITY_DATA` | Ability table rows; `'passive' \| 'active' \| 'triggered'`. |
| `abilityData(id)`, `hasAbilityData(id)`, `abilityParam(id, key)`, `abilityText(id)` | Look-ups (`abilityData` and `abilityParam` throw on a typo); `abilityText` fills `{param}` and `{apCost}`. |
| `CommanderDef`, `CommanderStats`, `CommanderVariantDef` *(types)* | A commander row; `{ power, toughness, lov, movement, ap }`; `{ id, name, text, abilities, grants }`. |
| `UnitFilter`, `AbilityGrant`, `TierOverride`, `CostRule` *(types)* | `{ types?, tiers?, factions? }`; `{ ability, filter }` (grants and revokes); `{ type, tier }`; `{ kind: 'fixed', type, cost }` or `{ kind: 'percent', minTier, exceptTypes, percent }`. |
| `COMMANDERS`, `commanderDef(id)`, `isCommanderId(id)`, `groupFaction(group)`, `commanderVariant(id, variant)` | Commander look-ups. `groupFaction` maps group A to the Empire and B to Lojrar; only `COMMANDER_FACTION_LOCK` uses it. |
| `FactionDef` *(type)*, `FACTIONS`, `factionDef(id)`, `availableRoster(id)` | `{ id, name, roster }` (the 7 units whose home faction it is); `availableRoster` is every one of the 14 units, whatever the army's banner (R43). |
| `BuildingDef` *(type)*, `BUILDINGS`, `buildingDef(kind)` | `{ kind, name, size, text, symbol }`. |
| `CAPTURE_RULE_TEXT`, `SIEGE_RULE_TEXT` | Rule texts for the help screen. |
| `ScenarioDef`, `ScenarioBuilding` *(types)*, `SCENARIOS`, `DEFAULT_SCENARIO`, `scenarioDef(id)` | `{ id, name, cornerRule, cornerRadius, blockers, tallBlockers, buildings }`; `{ kind, anchor }`; the default is `'crossroads'`. |
| `BlockerKind` *(type)*, `scenarioBlockers(scenario)` | `'low' \| 'tall'` (R36); every blocker as `{ square, kind }`, low ones first. |
| `tierFor`, `abilitiesFor`, `unitCost`, `commanderStats` | Derived facts (see Content). |

### Geometry (`geometry.ts`)

| Symbol | Meaning |
|---|---|
| `SQUARE_COUNT` | 625 grid squares, cut corners included (`existingSquares()` returns 593 under rule A). |
| `sq(x, y)`, `sameSquare(a, b)`, `squareIndex(s)`, `squareFromIndex(i)` | Build and compare squares; convert to and from `y * 25 + x`. |
| `onGrid(s)`, `squareExists(s, rule?, radius?)`, `existingSquares(rule?, radius?)` | Inside the 25 x 25 grid; still there after the corner cut. |
| `manhattan(a, b)`, `chebyshev(a, b)` | Distances between two squares. |
| `Rect` *(type)*, `footprintRect(anchor, size)`, `pointRect(s)`, `rectDistance(a, b, metric?)` | Inclusive rectangles `{ x0, y0, x1, y1 }` and the distance between their nearest squares (1.4). |
| `footprintSquares(anchor, size)`, `footprintDistance(anchorA, sizeA, anchorB, sizeB, metric?)` | A unit's squares; the distance between two footprints. |
| `adjacencyMetric(mode?)`, `neighbourOffsets(mode)`, `isMovementStep(from, to, mode?)` | The metric and step offsets of a `Neighbourhood`; whether one step is legal. |
| `squaresWithin(anchor, size, range, metric?)`, `squaresAtDistance(anchor, size, d, metric?)` | Existing squares within, or at exactly, a distance from a footprint. |
| `lovSquares(anchor, size, lov)` | The Manhattan LOV diamond without occlusion (the vision code applies tall blockers). |
| `adjacentSquares(anchor, size, mode?)`, `ringSquares(anchor, size)` | 4 squares around a 1x1 and 8 around a 2x2; the Chebyshev-1 ring, 16 squares around a 3x3 building. |
| `area3x3(centre)`, `isOrthogonallyConnected(squares)`, `isSquare2x2(squares)`, `slamSplash(anchor, size, target)` | Ability shapes: Pajazon's area, the Forcefield checks, the Forceful slam splash. |
| `opposite(side)`, `backRowY(side)`, `goalRowY(side)` | Sides and their rows. |
| `zoneRowsY(side, zone)`, `isInZone(side, s, zone)`, `zoneSquares(side, zone)` | Deployment zones (`'normal'` or `'extended'`). |
| `squareName(s)`, `parseSquare(name)` | `{ x: 12, y: 12 }` to `'M13'` and back (`parseSquare` throws on a bad name). |

### Hashing and RNG (`hash.ts`, `rng.ts`)

| Symbol | Meaning |
|---|---|
| `utf8Bytes(text)`, `fnv1a32(text)`, `fnv1a64Hex(text)`, `sha256Hex(text)` | UTF-8 bytes; 32-bit FNV-1a (it seeds the RNG); 64-bit FNV-1a as 16 hex digits; SHA-256 as 64 hex digits. |
| `canonicalJson(value)`, `hashJson(value)` | JSON with keys sorted at every level; its 64-bit FNV-1a. |
| `seedRng(seed)`, `nextUint32(rng)`, `nextInt(rng, n)`, `flipFirstSeat(rng)` | mulberry32 helpers for the coin flip. Each step returns `[value, nextState]`. |
| `commitSecret(nonce)`, `verifySecret(commitment, nonce)`, `combineSecrets(hostNonce, guestNonce)` | The commit-reveal coin flip (R37). |

### Games, commands, armies (`state.ts`, `commands.ts`, `army.ts`, `deployment.ts`, `rejection.ts`)

| Symbol | Meaning |
|---|---|
| `createGame(options)`, `CreateGameOptions` *(type)* | A lobby-phase state from `{ seed, settings?, names? }`. |
| `DEFAULT_SETTINGS` | `{ scenarioId: 'crossroads', budget: 200, keepEnabled: true, marketEnabled: true, takebacks: true, takebacksPerGame: null, turnTimerSeconds: 90, timeBankSeconds: 60, devContent: false }`. |
| `Intent`, `IntentKind`, `ActionIntent`, `MarchDirection` *(types)*, `MARCH_OFFSETS`, `isActionIntent` | See Intents. |
| `validate`, `validateIntent`, `apply`, `checkTarget`, `checkAbilityReady`, `ApplyResult`, `ApplyOptions` *(types)* | See Intents. |
| `Rejection`, `RejectionCode`, `Validation` *(types)* | `{ ok: false, code, message }`; the codes listed under Intents; `{ ok: true } \| Rejection`. |
| `checkArmy(army, settings)`, `ArmyCheck` *(type)* | The army builder's check: `{ ok, cost, unitCount, errors, warnings }`. |
| `armyCost(army)`, `armyUnitCount(army)`, `zoneCapacity(settings)` | Cost under the army's commander; roster units (what `ARMY_UNIT_CAP` counts); free squares `{ normal, extended }` in one side's zones. |
| `allowedZones(type)`, `deploymentSquares(side, type)` | The zones a unit type may use, and their squares (before terrain and occupancy). |

### Views, previews, queries (`view.ts`, `preview.ts`, `query.ts`, `vision.ts`, `events.ts`)

| Symbol | Meaning |
|---|---|
| `projectView`, `filterEvents`, `isVisibleSquare`, `canRequestTakeback(state, seat)` | See PlayerView and the authority loop; `canRequestTakeback` is what `view.takeback.canRequest` holds. |
| `PlayerView`, `UnitView`, `OwnUnitDetails`, `MineView`, `AreaView`, `DecisionView`, `TakebackView`, `TakebackRequestView`, `DisclosedAction` *(types)* | See PlayerView and Take-backs. |
| `EventBody`, `EventType`, `GameEvent`, `VisibleEvent`, `MoveEndReason` *(types)* | See Events. |
| `legalActions`, `reachableSquares`, `bestPath`, `attackTargets`, `chargeTargets`, `targetOptions`, `previewAttack` | See Client helpers. |
| `ActionKind`, `ActionOption`, `ReachableSquare` *(types)* | `'move' \| 'attack' \| 'defend' \| 'charge' \| 'ability'`; a `legalActions` entry; a `reachableSquares` entry. |
| `RulesQuery`, `StatsQuery`, `UnitStats`, `UnitTurnView` *(types)* | See Ability framework. `UnitTurnView` is a read-only `UnitTurnState`. |
| `AreaCore`, `MineCore`, `BuildingCore` *(types)* | What queries return: `{ id, abilityId, owner, squares, expiresAtOwnTurn, data }`; `{ id, owner, square, revealed }`; `{ kind, anchor, controller }`. |
| `StateQuery`, `ViewQuery` | `new StateQuery(state)` reads the authority's truth (`perspective` null); `new ViewQuery(view)` reads one seat's knowledge. |
| `lovContains(q, viewer, square)`, `visionMask(q, seat)` | Whether a square is in a unit's LOV (with R36 occlusion); a seat's vision as a 625-entry `Uint8Array`, 1 = visible. |
| `matchSummary(state)`, `MatchSummary` *(type)* | The `matchSummary` event's payload for a finished state, null while the game runs (R38, R39). |

### Damage (`damage.ts`)

| Symbol | Meaning |
|---|---|
| `runPipeline(input, rules?)`, `PipelineInput`, `PipelineResult`, `Contribution` *(types)* | The pure 3.3 pipeline: `{ base, isAttack, additions, subtractions, reductions, defending }` gives `{ amount, breakdown }`; a contribution is `{ source, amount }`. |
| `PIPELINE_RULES`, `PipelineRules` *(type)* | `{ order: DAMAGE_ORDER, weaknessFloor: WEAKNESS_FLOOR, reductionFloor: TARGET_REDUCTION_FLOOR }`; tests may pass other rules. |
| `collectHit(q, hit)`, `computeHit(q, hit)` | Gathers the hook contributions to one `HitContext`; `computeHit` is `runPipeline(collectHit(q, hit))`. |

### History (`history.ts`)

| Symbol | Meaning |
|---|---|
| `startRecord`, `submit`, `replay`, `replayRecord`, `ReplayError` | See History; `ReplayError` carries the failed entry's `index` and its `rejection`. |
| `MatchRecord`, `LogEntry`, `Frame`, `SubmitResult` *(types)* | `{ initial, log, state, frames }`; `{ seat, intent }`; `{ actionSeq, turnNumber, before }`; `{ ok: true, record, events } \| Rejection`. |
| `hashState`, `serializeState`, `deserializeState`, `serializeRecord`, `restoreRecord` | See History; `deserializeState` checks `schemaVersion`. |

### Ability framework (`abilities/types.ts`, `abilities/registry.ts`)

| Symbol | Meaning |
|---|---|
| `AbilityDefinition`, `ActiveSpec`, `AreaHooks` *(types)* | A definition and its `active` and `area` parts. |
| `StatModifier`, `Detection` *(types)* | What `modifyStats` and `detection` return. |
| `HitContext`, `DamageKind`, `DamageOutcome`, `DamageStep`, `PipelineStep` *(types)* | One damage instance `{ target, kind, base, source, dealer, creditId? }`; `'attack' \| 'ability' \| 'mine' \| 'tick'`; `{ targetId, amount, breakdown, killed }`; one breakdown row; `'base' \| 'addition' \| 'subtraction' \| 'reduction' \| 'defend'`. |
| `SplashSpec` *(type)* | What `ctx.dealSplash` takes: `{ source, dealer, target, damage, squares, splash, friendlyFire }` (Smite R25, Forceful slam A8-20). |
| `StepInfo`, `AdjacencyInfo`, `StepOutcome` *(types)* | `{ mover, from, to, stepIndex }`; `{ step, enemies, holderIsMover, holderStealthed }`; `'continue' \| 'interrupt'`. |
| `DeathInfo` *(type)* | `{ unit, footprint, cause, tier, baseToughness, isCommander }`. |
| `TurnEffects`, `TickDamage`, `TickHeal` *(types)* | `{ damage?, heal? }`, each a list of `{ target, amount }`. |
| `DecisionRequest`, `DecisionCore` *(types)* | What `requestDecision` takes; what `onDecision` receives (`{ id, seat, kind, data }`). |
| `TargetSpec`, `Relation`, `AbilityTarget`, `AttackTarget` *(types)* | One target pick; `'own' \| 'enemy' \| 'any' \| 'harmful'` (R14); a chosen target; a basic-attack target (a unit or a square). |
| `ResolveContext`, `AttackOutcome`, `RevealCause`, `AreaSpec`, `MinePlacement` *(types)* | The mutation API; `{ result: 'hit' \| 'nullified' \| 'mine' \| 'nothing', damage, targetId }`; `'adjacency' \| 'damage' \| 'detection'`; what `createArea` takes; `'placed' \| 'blockedByHiddenMine'`. |
| `getAbility(id)`, `liveAbility(id)`, `registerAbility(def, options?)`, `allAbilityDefinitions()` | The registry: any definition; implemented ones only (what the rules use); add or replace one (tests); every definition. |

### Testing (`testing/dsl.ts`, `testing/fogLeak.ts`)

| Symbol | Meaning |
|---|---|
| `buildBattle`, `act`, `startMatch`, `sqs`, `unitIn`, `findLeaks`, `findEventLeaks` | See Testing. |
| `Battle`, `BattleSpec`, `Placement`, `PlacementSpec`, `MatchStartSpec` *(types)* | See Testing. |
