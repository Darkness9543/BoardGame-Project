# Product / UX Analysis

Lens: Product / UX. Source: `docs/SPEC.md` (owner spec dated 2026-10-24). Status: draft for owner review, written 2026-10-24.

This document maps every screen and flow the spec implies, lists what is underspecified on each screen, and proposes a default for every gap so implementation can proceed without blocking. It also proposes an achievement set and lists product/UX risks.

## How to read this document

- **Quotes.** Each issue quotes the spec line it refers to as a `>` block. "Spec: silent" means the spec does not cover the topic at all.
- **Defaults.** Each issue ends with a **Default** that implementation can build today.
- **Confidence** in each default:
  - **High**: standard genre convention, or clearly implied by the spec. Unlikely to change.
  - **Medium**: a reasonable reading the owner may want differently. Build it as a setting or data flag so it is cheap to change.
  - **Low**: a guess that fills a hole. Owner input needed before polish. Keep it isolated in data/config.
- **Severity** (used in the index, section 16): **Blocker** = a screen cannot be finalized without the answer (the default still lets work start); **High** = visible to every player in every match; **Medium** = affects some flows; **Low** = polish.
- **IDs** are stable for discussion: `G` global, `MM` main menu and profile, `AB` armies and army builder, `LB` lobby, `DP` deployment, `BT` battle, `RS` result, `AC` achievements, `OP` options, `NET` connection, `A11Y` accessibility, `R` risks.
- **Scope.** Rules questions appear here only where the UI has to show them (ranges, previews, prompts, disabled buttons). The rule itself belongs to the rules/engine analysis; this document states what the UI needs and which reading the UI assumes until the owner decides.
- **Comparable games** cited for conventions: Into the Breach (exact, deterministic previews; threat display), Advance Wars (movement arrow; acted units dimmed; fog "Trap!" stop), Battle for Wesnoth (next-unit cycling; unit cards; vision overlays), Hero Academy (one action-point pool per turn shared by all units; friend invites), chess apps such as Lichess and Chess.com (invite links, board flip, take-back requests, confirm-move option, resign/draw offers, clocks).

## 0. Executive summary: the decisions that unblock the most UI work

| # | ID | Decision needed | Proposed default | Confidence |
|---|----|-----------------|------------------|------------|
| 1 | BT-01 | How many AP a player receives per turn (the spec gives no number) | 8 AP per turn, no carry-over, kept as a lobby/dev setting until tuned | Low |
| 2 | G-04 | Grade color table, and what "Units of white" (Baba Yaga) refers to | 7-step ladder: 1 White, 2 Green, 5 Blue, 10 Purple, 20 Orange, 50 Red, 100 Gold; "white" = Tier 1; every token also prints its numeral | Low |
| 3 | G-01 | "The Empire" heading has no units; which units and commanders belong to which faction | v1 uses one shared roster (the 14 listed units) and all 6 commanders for both players; faction is stored as data so it can be enforced later | Low |
| 4 | AB-06 | No unit cap: 200 x 1-cost units is legal but cannot fit the deployment zone | Cap army size at deployment-zone capacity; owner to pick a design cap (40 suggested) | Low |
| 5 | BT-07 | Mis-clicks are expensive because a take-back needs the opponent's consent | Click once to preview, click again (or Enter) to confirm; single-click mode available in Options | Medium |
| 6 | BT-29 | Take-back scope and flow | Undo your most recent action with all its consequences, one action per request, until the opponent acts; the opponent accepts/declines in a modal that auto-declines after 30 s | Medium |
| 7 | DP-01 | Simultaneous hidden deployment or alternating placement | Simultaneous and hidden; free re-arranging until both players confirm | Medium-High |
| 8 | LB-05 | Who moves first | Lobby setting, default Random, shown as a coin flip at the start of deployment; alternates on rematch | Medium |
| 9 | BT-21 | What the fog hides | Fog hides units and mines only; the map, blockers and buildings are always visible; last-seen markers for enemies that leave vision | Medium |
| 10 | A11Y-01 | Color encodes grade, so team identity and colorblind players need other channels | Grade = color + numeral + rim pattern; team = base-ring shape and pattern (not hue alone); colorblind palettes in Options | High |
| 11 | BT-25 | Own-mine path warning (owner's note) | Pathfinding never routes through own mines; moving onto one asks for confirmation; "Warn before moving onto own mines" in Options, default ON | High |
| 12 | BT-14 | Choices that happen during the opponent's turn (Queso revive) | Prompt the non-active player with a 15 s timer that defaults to "No"; per-player preference Ask / Always / Never | Medium |
| 13 | DP-04 | Which units may use the extended deployment zone (no unit is marked) | Per-unit data flag; v1 marks Ranger and Rogue | Low |
| 14 | NET-03 | Opponent disconnects mid-game | Pause, 120 s reconnection window, then "Claim victory" or "Keep waiting" | Medium |
| 15 | G-05 | Identity without accounts | Local profile (display name + random ID) in browser storage; export/import in Options | High |

## 1. Screen map

### 1.1 Flow

```
 S00 Boot / loading
   |-- no local profile --> S01 Choose a name --+
   |                                            |
   +-- profile exists --------------------------+--> S02 Main menu
                                                       |-- Play -----------------> S05 Lobby (as host)
                                                       |-- Join with code -------> S05 Lobby (as guest)
                                                       |-- Army compositions ----> S03 Army list --> S04 Army builder
                                                       |-- Achievements ---------> S09 Achievements and stats
                                                       |-- Options --------------> S10 Options
                                                       +-- How to play / Codex --> S11 Rules and unit codex

 Invite link (#/lobby/CODE) --> S00 --> (S01 if no profile) --> S05 Lobby (as guest)

 S05 Lobby --(pick an army, or build one: S04 opens as a drawer)--> both Ready --> 3 s countdown
   --> S06 Deployment --(both Confirm)--> S07 Battle --(win / loss / draw / resign / forfeit)--> S08 Result

 S08 Result --> Rematch (both accept) --> S05 Lobby (same settings, armies kept, nobody ready)
            --> Change army ------------> S05 Lobby
            --> Main menu --------------> S02 Main menu
```

### 1.2 Screen inventory

| ID | Screen | Entered from | Leads to | Spec basis |
|----|--------|--------------|----------|------------|
| S00 | Boot / loading | Any URL | S01, S02, S05 | Spec: silent |
| S01 | Choose a name (first run) | First visit, or first visit through an invite link | S02, or S05 when arriving by link | Spec: silent (no accounts mentioned) |
| S02 | Main menu | Boot, Back, Result | S03, S05, S09, S10, S11 | "The game will feature a main menu where the player can either:" |
| S03 | Army list | Main menu | S04 | "Create or edit army compositions" |
| S04 | Army builder | S03, or as a drawer in S05 | Back to caller | "Army compositions don't have to be made only from the menu option." |
| S05 | Lobby | Play, invite link, join code, Rematch | S06 | "he will create a lobby and will have a link to invite another player." |
| S06 | Deployment | Lobby countdown | S07 | "After that follows a deployment phase" |
| S07 | Battle | Deployment | S08 | Most of the spec |
| S08 | Result | End of battle | S05, S02 | "The objective of each player is to defeat the commander of each party." |
| S09 | Achievements and stats | Main menu, Result | S02 | "Check his achivements" |
| S10 | Options | Main menu, in-game menu | Back | "The player can deactivate this warning from options" |
| S11 | Rules and unit codex | Main menu, in-game menu, any unit card | Back | Spec: silent (proposal; 14 units, 6 commanders and 2 objectives need a reference) |
| S12 | Sandbox (developer/practice, optional) | Hidden route `#/sandbox` | S08 | Spec: silent (proposal for testing rules and balance) |

### 1.3 Overlays and dialogs (battle unless noted)

| ID | Overlay | Trigger |
|----|---------|---------|
| O1 | In-game menu: Resume, Options, Codex, Offer draw, Resign | Esc or menu button |
| O2 | Take-back request: "pending" toast for the requester, Accept/Decline modal for the opponent | Request take-back (BT-29) |
| O3 | Own-mine confirmation | Move whose destination is one of your mines (BT-25) |
| O4 | Reactive choice for the non-active player (Queso revive) | Event during the opponent's turn (BT-14) |
| O5 | End turn with unspent AP | End turn while AP remains and a unit can still act (BT-30) |
| O6 | Connection: "Reconnecting..." (self) / "Opponent disconnected" (other) | Network events (NET-02, NET-03) |
| O7 | Turn banner and end-of-turn resolution ticker | Turn change (BT-03, BT-30) |
| O8 | Full unit card / codex popover | Right-click, long-press or "i" on any unit |
| O9 | Achievement unlocked toast | Queued, shown on S08 (section 9) |
| O10 | Error pages (all screens): lobby not found, lobby full, lobby closed, version mismatch | Bad or stale link (LB-01, LB-10, G-13) |
| O11 | Rematch request | Result screen (RS-05) |
| O12 | Resign confirmation and draw offer | O1 (BT-34, BT-35) |

### 1.4 URLs

The game should be a static site with hash routes, so an invite link works on any static host and a page refresh lands on the same state:
`#/` main menu, `#/armies`, `#/armies/<id>`, `#/achievements`, `#/options`, `#/codex`, `#/lobby/<CODE>`.
Lobby, deployment, battle and result are states of `#/lobby/<CODE>`, not separate routes, so refreshing the page or reopening the invite link rejoins the same match (NET-04).

### 1.5 Core journeys and target times

| Journey | Steps | Target |
|---------|-------|--------|
| J1 Host a friend | Open site, (name), Play, Copy link, paste into chat | Under 15 s for a returning player |
| J2 Join from a link | Click link, (name), lobby, pick a preset army, Ready | Under 30 s for a first-time guest; this is why preset armies matter (AB-01) |
| J3 First turn | Both ready, deploy with Auto-place or a saved formation, confirm | Under 3 min from the link being opened |
| J4 Build an army offline | Menu, Army compositions, New, commander, units, Save | Under 2 min for a 200 budget |
| J5 Return after a dropped connection | Refresh or reopen the link | Back in the match in under 10 s, no extra clicks |
| J6 Review progress | Menu, Achievements | One click |

## 2. Cross-cutting requirements

### G-01 Factions and roster
> "The game features, for now, 2 clans or factions. It may be possible to add new factions later into the game."
>
> "### The Empire" is followed directly by "### Lojrar Clan": the Empire section is empty.

- **Issue:** all 14 units sit under Lojrar Clan. Unclear whether (a) the Empire roster is still to be written, (b) both factions share these units, or (c) each tier's two variants are split between the factions. The six commanders are listed in two groups of three separated by a blank line, which may mean three commanders per faction. The army builder, the lobby and the token art (faction symbol style) depend on this.
- **Default:** v1 has one roster, the 14 listed units, open to both players (mirror matches allowed). Faction is a data field on every unit, commander and army. All six commanders can be picked by anyone; the builder lists them in the spec's two groups (Trill, Kulega, Sabrina / Baba Yaga, Ratasius I, Queso) without enforcing a faction. The builder has a faction selector from day one, so enforcing factions later is a data change. **Confidence: Low.**

### G-02 One word for "tier"
> "Artificers now are considered type 10." / "All units of type 1, 2, 5 gain 2 toughness." / "The color of the token will represent the grade of the unit." / "Units of white gain..."

- **Issue:** the spec uses type, grade, coin and a color name for the same concept. Players need one word in every label, tooltip and log line.
- **Default:** UI word **Tier**, always with the coin value ("Tier 20"). Tokens print the numeral. "Grade" is used only in art documents. **Confidence: High.**

### G-03 Stat names, icons and ability wording
> "Units here will be described as Name, Power/Toughness, Size, LOV, Movement, AP, Ability:AbilityCost:Description"

- **Issue:** ability texts use hp, life, health and toughness for the same thing ("Sacrifice half of adjacent unit's (or itself) hp", "Gain life equal to its toughness", "regenerate 5 health"). Some abilities have no cost field at all (Assault, Shared wounds, Holy Fervor, Mad inventor).
- **Default:** labels Power, Toughness, Size, Vision, Move, AP cost, each with an icon (sword, heart, square, eye, boot, coin). P/T shown MTG-style as "12/20". Every ability is rewritten into one canonical wording that only says "Toughness", reviewed by the owner, and the in-game text is generated from the same data the rules engine reads. "P" abilities are labelled "Passive". Abilities with no cost are shown as passive or automatic until the rules analysis says otherwise. **Confidence: High** for labels, **Medium** for the no-cost reading.

### G-04 Grade colors and "Units of white"
> "The color of the token will represent the grade of the unit. The symbol on top of the token will represent the particular unit that token represents."
>
> "Baba Yaga "The Bwitch": Units of white gain the ability to regenerate 2 toughness for 2 AP (each instance)."

- **Issue:** no palette is given, yet a rule refers to a color, so the color table is rules data, not only art. Seven grades need seven colors, which are hard to tell apart at token size and impossible for many colorblind players by hue alone.
- **Default:** a rarity ladder that gamers already know: 1 White, 2 Green, 5 Blue, 10 Purple, 20 Orange, 50 Red, 100 Gold. Baba Yaga's ability applies to Tier 1 (Footman, Mercenary). Color is never the only cue (A11Y-01). **Confidence: Low** for the palette and for "white"; **High** for the redundant encoding.
- **Alternative** for the art mock page: euro-coin metals (copper for 1/2/5, brass for 10/20/50, bimetal silver-and-gold for 100). It matches Trill's "type 1, 2, 5" grouping, but gives only three colors, and "white" would then mean the silver of Tier 100.

### G-05 Identity without accounts
> "This should be done in a way that requires the least setup."

Spec: silent on accounts.
- **Default:** a local profile created on first run: a display name (2 to 20 characters: letters, digits, spaces, `-` and `_`), prefilled with a random suggestion such as "Copper Duke"; plus a random profile ID (UUID), never shown, used to recognize the player's seat on reconnect. Stored in browser storage. The name is editable from the main-menu header. Names are not unique; if both players in a lobby share one, the guest is shown as "Name (2)". **Confidence: High.**

### G-06 Local data, versioning and portability
Spec: silent.
- **Issue:** armies, achievements, stats and options live in one browser. Clearing site data, a private window or another device loses them.
- **Default:** one versioned storage key per data type (profile, armies, stats, options) with migrations. Options > Data offers Export (JSON file) and Import. Armies also travel as share codes (AB-03). First run shows one line: "Your armies and achievements are saved in this browser. You can export them from Options." If storage is unavailable, the game still runs and says nothing will be saved. **Confidence: High.**

### G-07 Interaction model
Spec: silent.
- **Default:** one model everywhere: select, preview, confirm. Left-click selects and confirms, right-click or Esc cancels, hover previews. Every mouse action has a keyboard equivalent and a touch equivalent (tap = hover + select, second tap = confirm, long-press = full card). Details in BT-07. **Confidence: Medium.**

### G-08 Board orientation and coordinates
> "Each player gets a portion of the map, at the edges and usually opposing each other"

- **Default:** each player sees their own side at the bottom (chess apps flip the board for Black). Coordinates are absolute: columns A to Y and rows 1 to 25 counted from the host's side. For the guest the labels are drawn flipped, so "M13" names the same square for both players in the log and in chat. **Confidence: High.**

### G-09 Language
Spec: silent. The spec is written in English; several names are jokes worth keeping ("Juliomancer", "Pajazon", "Queso").
- **Default:** English UI with every string in a string table so translation is possible later; unit and commander names are never translated. **Confidence: Medium.**

### G-10 Target platforms
> "The game, preferably, should be made for the browser"

- **Default:** desktop Chrome, Edge, Firefox and Safari (current versions), mouse and keyboard first. Tablets in landscape at 1024 px or wider are supported by touch. On phones the menus, army builder and lobby work; the battle shows "Best on a larger screen" but still runs with pan and zoom. Minimum comfortable battle layout: 1280 x 720. **Confidence: Medium.**

### G-11 Sound
Spec: silent.
- **Default:** short cues for: your turn starts, action confirmed, hit, death, mine explosion, objective changes hands, take-back request. Separate music and effects volumes. Every cue also has a visual equivalent (A11Y-07). **Confidence: Medium.**

### G-12 The UI must not leak hidden information
> "Each player will only have vision around the vision field of each unit. Everything outside will be in the fog of war."

- **Issue:** hidden information leaks through UI details more often than through the board: a disabled button's reason ("an enemy can see this unit"), an objective shown as "Contested" because of a hidden unit, a log line naming an unseen attacker, a "waiting for opponent" message while they answer a hidden prompt, or a network message carrying the full game state.
- **Default:** every disabled reason, log line, status and prompt is tagged public or private in the design, and the checklist in R2 is part of review for each feature. The rules authority sends each client only what that player may know. **Confidence: High.**

### G-13 Version compatibility
Spec: silent.
- **Default:** the lobby shows the game version. If the two clients differ, the joiner sees "Your opponent is running a different version. Refresh to update." and cannot ready up. Saved armies record the rules version they were built with (AB-17). **Confidence: High.**

## 3. Boot, first run, main menu and codex (S00, S01, S02, S11)

**S00 Boot / loading.** Title art and a progress bar. Menu assets load first, battle assets in the background. If the URL carries an invite code it is kept and the player goes to S01 or S05 after loading. Target: interactive menu in under 3 s on broadband.

**S01 Choose a name.** One field prefilled with a random name, a "Re-roll" button and Continue. When arriving by invite, the header reads "<Host name> invited you to a duel" and Continue goes straight into the lobby.

**S02 Main menu.**
> "The game will feature a main menu where the player can either:
> - Choose to play, in which case he will create a lobby and will have a link to invite another player.
> - Create or edit army compositions
> - Check his achivements"

- Buttons in this order: **Play** (primary), Join game, Army compositions, Achievements, Options, How to play / Codex.
- Header: profile name (click to edit) and version number. Footer: Credits and licenses.
- If a match is in progress in this browser (NET-04): banner "Game in progress against <name>: Rejoin / Abandon".

**S11 Rules and unit codex.** Rules summary (turn structure, AP, actions, fog, win conditions, objectives); one page per unit and per commander with the canonical text (G-03); diagrams of Vision 1/2/3 diamonds, adjacency, movement and the objective capture ring. Reachable from the menu, the in-game menu and every unit card ("i"). It is a reference, not a tutorial.

### MM-01 Invite links open the lobby directly
Spec: silent.
- **Default:** the invite link skips the menu: boot, then S01 only if there is no profile, then the lobby as guest. **Confidence: High.**

### MM-02 Options and How to play are not in the spec's menu list
> "The player can deactivate this warning from options"

- **Default:** add Options (the spec already needs it for the mine warning) and How to play / Codex (S11) to the menu. **Confidence: High.**

### MM-03 Joining without the link
> "he will create a lobby and will have a link to invite another player."

- **Issue:** a friend may receive the invite by voice or on another device.
- **Default:** "Join game" accepts either the 6-character room code or a pasted link. The link stays the main path. **Confidence: Medium.**

### MM-04 Play creates a lobby immediately
- **Default:** as the spec says: Play creates a lobby and shows the invite link at once, with no submenu. **Confidence: High.**

### MM-05 Practice / sandbox
> "For now, assume that only another player will play."

- **Default:** no practice mode in the v1 menu. Build a hidden sandbox route (`#/sandbox`) where one person controls both sides with fog on or off, to test rules and balance. The owner can later expose it as "Practice". **Confidence: Medium.**

### MM-06 Credits for asset packs
> "references and/or free asset packs may be used if suitable"

- **Default:** a Credits page lists every third-party asset with its license and author, because free packs (CC-BY and similar) often require attribution. **Confidence: High.**

## 4. Army compositions (S03 Army list, S04 Army builder)

### S03 Army list requirements
- One card per army: name, commander portrait, faction, cost used of budget ("187 / 200"), unit count, status badge (Valid / Over budget / Too many units / Needs update), last edited.
- Actions: New, Edit, Duplicate, Rename, Delete (with an Undo toast), Copy share code, Import from code.
- A "Starter armies" section (read-only presets) above the player's own armies; presets can be used directly or duplicated to edit.
- Sorted by last used.

### AB-01 Starter armies
Spec: silent.
- **Issue:** a first-time guest who arrives by link has no army and must build one before playing; that is the slowest path into a match (J2).
- **Default:** ship one preset per commander (six), each a valid 200-cost army with a one-line description ("Footman wall", "Artificer workshop"). Presets are read-only and appear in the lobby's army picker. The owner approves the lists. **Confidence: High** that presets are needed, **Low** for their contents.

### AB-02 Number of saved armies
- **Default:** no limit (soft warning at 100). **Confidence: High.**

### AB-03 Share codes
Spec: silent.
- **Default:** an army can be copied as a short text code (for example `BG1-` followed by base64url of rules version, commander and unit counts) and pasted to import. The importer validates the code and previews the army before saving. **Confidence: Medium.**

### S04 Army builder requirements
> "The player will have a budget of 200, which can be edited in the future, but for now the default is 200."
>
> "...must spend that money to acquire any combination of units that can fit the budget. Moreover, each player can choose a commander, which will give bonuses to units or strategies."
>
> "The player first chooses the units that wants to have for that encounter."

Desktop layout:

```
+--------------------------------------------------------------------------------+
| Army name [______________]   Faction [Lojrar Clan v]      Spent 187 / 200 (13) |
+-----------------------+-----------------------------------+--------------------+
| 1. COMMANDER          | 2. UNITS (7 tiers x 2 variants)   | 3. YOUR ARMY       |
| [Trill] [Kulega] ...  | Tier 1   [Footman  ] [Mercenary]  | Commander     free |
| effective card:       | Tier 2   [Soldier  ] [Ranger   ]  | Footman   x6     6 |
| 1/10 Move 1 AP 1 ...  | Tier 5   [Berserker] [Rogue    ]  | Paladin   x2    40 |
| effects on army       | Tier 10  [Priestess] [Juliomanc]  | ...                |
|                       | Tier 20  [Paladin  ] [Artificer]  | Units 14 / 94      |
| SUMMARY               | Tier 50  [Royal wiz] [Beast    ]  | AP to use all: 23  |
| AP-cost histogram     | Tier 100 [Celestial] [Scourge  ]  | Problems: none     |
|                       |                                   | [Save] [Save as]   |
+-----------------------+-----------------------------------+--------------------+
```

- **Unit tile:** token art, name, tier, cost (a commander-modified cost shows as "20 -> 24"), P/T, Size, Vision, Move, AP cost, one-line ability summary, and a stepper (- count +) that also accepts typing. Hover or long-press shows the full card with every ability.
- **Budget bar:** spent and remaining; turns red and shows the overage when over budget.
- **Summary:** unit count; "AP to use every unit once" next to the AP received per turn, which shows how much of the army can act in a turn (BT-01); an AP-cost histogram (deck builders show a mana curve; this is the same idea).
- **Problems list:** every validation failure in plain words, each clickable to jump to its cause.
- Changing the commander re-prices the army live and shows a toast summarizing what changed.

### AB-04 Unit cost equals tier value
> "The units available follow the Euro distribution: 1, 2, 5, 10, 20, 50, 100: Each unit represents a coin"

- **Issue:** the spec never states a cost explicitly.
- **Default:** a unit costs its tier value (Footman 1, Celestial Emissary 100). **Confidence: Medium-High.**

### AB-05 Commander first, because commanders change prices and tiers
> "Sabrina "The Reelfinisher": Artificers and No-ACBs get 2 additional power. Artificers now are considered type 10. Artificers can no longer use mines. Each other type-20 and above is 20% more expensive to deploy."
>
> "The commander ... doesn't count from the budget."

- **Issue:** a commander can change costs (under Sabrina, Tier 20 costs 24, Tier 50 costs 60, Tier 100 costs 120) and even a unit's tier, so picking units before the commander leads to surprises.
- **Default:** the commander is step 1, pre-selected to the last one used. Under Sabrina the Artificer costs 10, counts as Tier 10 for every effect, and its token uses the Tier 10 color and numeral with a small commander badge; its mine ability is shown struck through with "Disabled by Sabrina". Switching commander re-prices the army and shows, for example, "Switching to Sabrina: Paladin 20 -> 24 (x2); total 200 -> 208; over budget by 8". The commander costs nothing and appears as a fixed first row of the army list. **Confidence: Medium** (reading "considered type 10" as also changing the cost: **Low**).

### AB-06 Army size and copy limits
Spec: silent. The normal deployment zone holds roughly 95 to 105 squares after the corner cuts (DP-06).
- **Issue:** "any combination of units that can fit the budget" allows 200 Footmen, which cannot all be deployed, would take many minutes to place, and would make every turn tedious.
- **Default:** no per-unit copy limit. Army size (excluding the commander) is capped at the number of normal-zone squares in the smallest scenario, minus one for the commander; the builder shows "Units 34 / 94". The owner is asked to choose a design cap; 40 is suggested. **Confidence: Low.**

### AB-07 Unspent budget
- **Default:** allowed, shown as "Unspent: 3", with no effect in the match. **Confidence: High.**

### AB-08 Commander-only or tiny armies
- **Default:** allowed with a warning in the Problems list ("Your army has no units besides the commander"); it can still be readied. **Confidence: Medium.**

### AB-09 Armies and lobby budgets
> "...which can be edited in the future"

- **Default:** an army stores the budget it was built for. In a lobby, any army whose current cost fits the lobby budget can be used; others are listed but disabled with "Over this lobby's budget (230 / 200)" and an "Edit a copy" shortcut. **Confidence: Medium.**

### AB-10 Invalid drafts and unsaved changes
- **Default:** invalid armies can be saved as drafts (badge "Over budget" or "Too many units") but cannot be readied. Leaving with unsaved changes asks "Discard changes?". **Confidence: High.**

### AB-11 Default names
- **Default:** "<Commander> army 1", "<Commander> army 2", up to 32 characters; duplicate names allowed. **Confidence: High.**

### AB-12 Faction selector
> "### The Empire" (empty) / "### Lojrar Clan"

- **Default:** the faction selector shows Lojrar Clan; The Empire is visible but disabled with "Coming later" (G-01). **Confidence: Low.**

### AB-13 Commander card
> "The commander is by default a 1/1 unit, movement and AP of 1, LOV of 3, and doesn't count from the budget."
>
> "Queso "The Beacon of hope": This commander's AP is 3, and 3 toughness."

- **Default:** the builder shows the commander's effective stats after its own text (Trill 1/10; Ratasius Vision 6; Queso 1/3 with AP cost 3, read as an action cost like every unit's AP stat), plus the list of effects it has on the army. **Confidence: Medium** (the Queso AP reading belongs to the rules analysis).

### AB-14 Commander effects on unit tiles
- **Default:** unit tiles show stats after the commander's static passives, marked with the commander badge and a tooltip ("Vision 3 -> 4, Kulega"). Effects that depend on board position (auras, the Keep) are not shown in the builder. **Confidence: High.**

### AB-15 Building an army from the lobby
> "If a player wants to create a new one when a game starts, he can do so there aswell."

- **Default:** the lobby's army picker has "New army..." and "Edit". The builder opens as a full-height drawer over the lobby while the lobby header (opponent status, ready state) stays visible. "Save and use" closes it and selects the army. A "Save to my armies" checkbox (default on) allows a one-off army. **Confidence: Medium-High.**

### AB-16 Editing after Ready
- **Default:** opening the builder or changing the selected army un-readies you, and the opponent sees "<name> is changing their army". **Confidence: High.**

### AB-17 Saved armies after a rules update
- **Default:** when unit data changes (cost, cap, removed unit), saved armies are re-validated on load; affected armies get a "Needs update" badge and the builder lists what changed. **Confidence: High.**

## 5. Lobby (S05)

> "Choose to play, in which case he will create a lobby and will have a link to invite another player."
>
> "The game, preferably, should be made for the browser, with a way to connect with another player. This should be done in a way that requires the least setup. For now, assume that only another player will play."

```
+--------------------------------------------------------------------------+
| Invite: https://<host>/#/lobby/K7QX2M   [Copy link] [Share]  Code K7QX2M |
+------------------------------------+-------------------------------------+
| YOU (host)              connected  | GUEST                               |
| Army [Footman wall  v] [Edit][New] | Waiting for a player...             |
| Commander: Trill                   |   then: Army selected (hidden)      |
| [ READY ]                          |   then: Ready / Not ready           |
+------------------------------------+-------------------------------------+
| MATCH SETTINGS (host edits, guest reads)                                 |
| Scenario [Ruins v]   Keep [on]   Market [on]   Budget 200                |
| First turn [Random v]   Take-backs [Ask opponent v]   Turn timer [Off v] |
+--------------------------------------------------------------------------+
| Chat (optional)                                          [Leave lobby]   |
+--------------------------------------------------------------------------+
```

Requirements:
- Copy link with "Copied" feedback; Share opens the system share sheet where the browser supports it; the room code is shown for sharing by voice.
- Player slots: name, connection state, army state (Not selected / Selected / Ready). Never the army contents or the commander (LB-03).
- Army picker: starter armies, saved armies (unusable ones disabled with the reason), "New army...", "Edit".
- Settings panel: the host edits, the guest reads. Every change is announced to both ("Host changed the scenario to Ruins").
- Ready toggle. When both are ready, a 3 s countdown that either player cancels by un-readying.
- Leave lobby (the host leaving closes the lobby, LB-01).

### LB-01 Lobby lifetime and link validity
Spec: silent.
- **Default:** the link works while the host's lobby exists. If the host closes the tab, the lobby is kept for 2 minutes (the host may be refreshing), then closed; the guest then sees "The host left. Create your own game?". A link to a closed lobby shows "This game has ended or the link is wrong" (O10). **Confidence: Medium.**

### LB-02 Host and guest roles
- **Default:** only the host changes settings; any settings change un-readies both players, so nobody is readied into a match they did not agree to. **Confidence: High.**

### LB-03 What the opponent sees before the match
> "Each player will only have vision around the vision field of each unit. Everything outside will be in the fog of war."

- **Default:** the opponent sees only that you have selected a valid army and whether you are ready. Army contents stay hidden for the whole match; commanders are revealed when deployment starts (DP-11). **Confidence: Medium.**

### LB-04 Ready and start
- **Default:** both ready, then a 3 s countdown, then deployment. Un-readying during the countdown cancels it. The host has no separate Start button. **Confidence: High.**

### LB-05 Who moves first
Spec: silent.
- **Issue:** the first mover reaches objectives and threatens first, so the order matters and must be visibly fair.
- **Default:** lobby setting "First turn: Random (default) / Host / Guest". The random result is decided when deployment begins and shown with a coin-flip animation (it suits the coin theme), so both players can plan their deployment around it. On rematch the order alternates. Owner question: should the second player get compensation (for example +1 AP on their first turn)? Default: none. **Confidence: Medium** (Random), **Low** (no compensation).

### LB-06 Scenario choice
> "The game takes place in a square grid system. There may be a scenario with blockers."
>
> "The encounter takes place in a battlefield called scenario."

- **Default:** the host picks a scenario from a list showing a thumbnail, its blockers and which objectives it contains, or picks "Random". v1 ships two: "Open Field" (no blockers, no objectives) and "Ruins" (blockers, Keep and Market). **Confidence: Medium.**

### LB-07 Optional objectives
> "There will be, however, for now, two optional objectives: The keep, The market."

- **Issue:** "optional" can mean "a scenario may include them", "the host may switch them off", or "players may ignore them".
- **Default:** scenarios define where the Keep and the Market stand; the host can switch each one off for the match (default on where the scenario has them). **Confidence: Medium.**

### LB-08 Budget
> "The player will have a budget of 200, which can be edited in the future, but for now the default is 200."

- **Default:** v1 shows "Budget 200" as fixed text with the tooltip "Custom budgets are coming later". The data model and the lobby protocol already carry the budget, and a developer flag makes it editable (50 to 1000, step 10) for playtests. **Confidence: Medium.**

### LB-09 Settings the spec does not mention
- **Default:** Take-backs: "Ask opponent" (the spec's behaviour, default) or "Off". Turn timer: Off (default), 60 s, 120 s or 300 s per turn (BT-31). AP per turn: developer flag only (BT-01). Fog cannot be switched off outside the sandbox. **Confidence: Medium.**

### LB-10 Third visitors and duplicate tabs
> "For now, assume that only another player will play."

- **Default:** a third person opening the link sees "This game is full" with "Create your own game". A player opening the same lobby in a second tab takes over their own seat, and the older tab shows "Opened in another tab" (NET-06). No spectators. **Confidence: High.**

### LB-11 Chat
Spec: silent.
- **Default:** a small text chat in the lobby and in battle (200 characters per message, a mute button, no history after the match), mainly to negotiate take-backs and rematches. It can be cut from v1 if the players use voice chat anyway. **Confidence: Low-Medium.**

### LB-12 Rematch
- **Default:** "Rematch" on the result screen asks the opponent; if both accept, both return to the same lobby with the same settings and their armies still selected but not ready, and the first player alternates. **Confidence: Medium.**

## 6. Deployment phase (S06)

> "After that follows a deployment phase: Each player gets a portion of the map, at the edges and usually opposing each other, where they can deploy the units. Some units can be deployed in the extended deployment area, which covers slightly more terrain."
>
> "The size of the battlefields are 25x25, where the corners are cut off with a radius of 4."
>
> "The normal deployment zone covers the first 5 rows closest to the player. The extended deployment zone covers 2 extra rows."

Requirements:
- The board with your zone highlighted: normal zone as a solid tint, extended zone hatched and lit only while an eligible unit is picked up. The rest of the map is visible (terrain, blockers, buildings) but shows no enemy units.
- A tray of undeployed units, grouped by unit type with counts ("Footman x6"). The commander comes first, marked "required".
- Tools: drag and drop; click a tray stack, then click or drag across squares to "paint" one unit per square; right-click a placed unit to return it to the tray; drop a placed unit onto another to swap them; Auto-place remaining; Clear; Save formation; Load formation.
- Information: the first-player result (LB-05), both commanders (DP-11), objective locations and effects, the opponent's back row marked as your commander's goal (BT-28), and the opponent's status ("Deploying" / "Confirmed").
- A Confirm button that shows what is missing ("3 units left to place").

### DP-01 Simultaneous or alternating
- **Issue:** alternating placement shows every placement to the opponent; simultaneous placement is faster.
- **Default:** simultaneous and hidden. The zones are 11 or more rows apart and the largest vision in the spec is 6 (Ratasius), so nothing in the enemy zone could be seen anyway. **Confidence: Medium-High.**

### DP-02 Re-arranging and confirming
- **Default:** free re-arranging until Confirm. "Unconfirm" stays available until the opponent also confirms. When both have confirmed, a 3 s countdown starts the battle. **Confidence: High.**

### DP-03 Must every unit be deployed?
Spec: silent (there is no reserve mechanic).
- **Default:** yes. Confirm is disabled until everything is placed; "Auto-place remaining" fills the frontmost free squares, cheapest units in front. **Confidence: Medium.**

### DP-04 Extended zone eligibility
> "Some units can be deployed in the extended deployment area, which covers slightly more terrain."

- **Issue:** no unit in the spec says it may use the extended zone.
- **Default:** a per-unit data flag. v1 sets it for the Ranger and the Rogue (scout roles). Eligible units show an "Extended deploy" badge in the builder and the tray, and the extended rows light up only while such a unit is held. Owner to confirm the list. **Confidence: Low.**

### DP-05 Where the commander may stand
- **Default:** the commander must be deployed, and only in the normal zone. **Confidence: Medium.**

### DP-06 Zone shape after the corner cuts
> "The size of the battlefields are 25x25, where the corners are cut off with a radius of 4."

- **Issue:** "radius of 4" can be read several ways (a quarter circle, a diagonal cut, a Manhattan radius). The deployment highlight, the goal row and the capacity cap in AB-06 depend on it. The spec measures vision with Manhattan distance ("A LOV of 2, will show 12 squares around the unit"), so a diagonal cut is the consistent reading.
- **Default** (rules analysis to confirm): a square is removed when x + y < 4, counted from its corner. That removes 10 squares per corner, 40 in total (585 playable squares). Each player's first five rows then hold 17 + 19 + 21 + 23 + 25 = 105 squares (normal zone), and rows 6 and 7 add 50 (extended zone). **Confidence: Low.**

```
row 1   XXXX.................XXXX    17 squares
row 2   XXX...................XXX    19
row 3   XX.....................XX    21
row 4   X.......................X    23
row 5   .........................    25    rows 1-5: normal zone (105 squares)
row 6   eeeeeeeeeeeeeeeeeeeeeeeee    25
row 7   eeeeeeeeeeeeeeeeeeeeeeeee    25    rows 6-7: extended zone (50 squares)
        X = cut corner square    e = extended zone
```

### DP-07 Size 2 footprint
> "Beast of Knorund, 20/40, 2, 2, 2, 3"

- **Default:** Size N occupies N x N squares. The placement ghost shows the whole footprint and is valid only if every square is free and inside the zone. The Beast is the only Size 2 unit. **Confidence: Medium.**

### DP-08 Blockers and buildings inside zones
- **Default:** those squares cannot take units; the capacity in AB-06 counts the real free squares of the smallest scenario. **Confidence: High.**

### DP-09 Saved formations
Spec: silent.
- **Default:** "Save formation" stores the layout per army and per scenario. "Load formation" then places everything in one click and skips any square that is blocked. With large armies this is the biggest time saver in the flow. **Confidence: Medium.**

### DP-10 Deployment timer
- **Default:** none, unless the lobby turn timer is on; then deployment lasts 3 minutes, after which the remaining units are auto-placed and the deployment is confirmed. **Confidence: Medium.**

### DP-11 What is revealed when deployment starts
- **Issue:** commander passives change numbers the opponent will see (Trill's +2 toughness, Kulega's +1 vision, Ratasius' weakness), so a commander cannot stay secret for long anyway.
- **Default:** both commanders (name, portrait, passive text) are revealed when deployment starts; armies stay hidden. **Confidence: Medium.**

### DP-12 Touch deployment
- **Default:** tap a tray stack, then tap squares; tap a placed unit to pick it up again. **Confidence: High.**

## 7. Battle (S07)

### 7.1 Layout

```
+--------------------------------------------------------------------------------+
| [=]  Round 4 - YOUR TURN   AP [#####...] 5/8   Keep: You  Market: Neutral  (o) |
+----------------+------------------------------------------------+--------------+
| UNIT CARD      |                                                | LOG  | CHAT  |
| (selected or   |                    BOARD                       | R4 You:      |
|  hovered)      |       top view by default, pan and zoom        | Paladin 2    |
| Paladin 2      |                                                | E5 -> E8     |
| 12/20 ...      |                                                | R4 Opp: ...  |
+----------------+------------------------------------------------+--------------+
| [Move M] [Attack A] [Defend D] [Ability 1] [Ability 2]   [Cancel Esc]          |
|          Units ready 6 [Next Tab]     [Request take-back]       [ END TURN ]   |
+--------------------------------------------------------------------------------+
```

Side panels collapse to icons below 1440 px of width; the board always takes the remaining space. `(o)` is the connection indicator (NET-01).

### 7.2 Turn and AP

#### BT-01 AP per turn
> "It's a turn-based game. In each player's turn, that player will receive a number of Action points. The player can use those action costs to use a number of units that fit its budget."

- **Issue:** the number is never given, yet it drives the HUD (pip count), the army builder summary and the whole balance.
- **Default:** 8 AP per turn for both players, kept in config and exposed as a developer/lobby flag (4 to 20) until playtests settle it. The HUD shows pips plus "5/8"; hovering an action highlights the pips it would spend. **Confidence: Low.**

#### BT-02 Unspent AP
- **Default:** unspent AP is lost at the end of the turn (no carry-over); BT-30 covers the warning. **Confidence: Medium.**

#### BT-03 Turn indicator
- **Default:** a banner "Your turn" / "<Opponent>'s turn" for 1 s at turn start; a persistent label and a colored frame around the board; during the opponent's turn the action bar is replaced by "<Opponent> is playing..."; the browser tab title becomes "(Your turn) <game name>" and a sound plays; optional desktop notification when the tab is hidden (section 10). The counter shows full rounds ("Round 4, your turn"). **Confidence: High.**

### 7.3 Selecting and acting

#### BT-04 Selection and unit cycling
- **Default:** click a unit to select it (its card fills the left panel). Tab / Shift+Tab cycles through your units that can still act (Wesnoth's "next unit"). Units with no actions left are dimmed (Advance Wars). The action bar shows "Units ready 6". Clicking an enemy shows its card without selecting it. **Confidence: High.**

#### BT-05 One action per unit, and extra actions
> "A unit can only use one action per turn, unless stated otherwise."
>
> "Unless stated otherwise, a single unit can only move once per turn."
>
> "The market: While the market is active, all type-1 unit have an additional action per turn."
>
> "Command Aura:P: Units within range 2 of this unit can take an additional action each turn. Doesn't include this unit."
>
> "Holy Fervor: This unit can take 2 actions per turn. The second action costs 1 extra AP"

- **Issue:** a unit may have 1 to 3 actions (Market and Command Aura could stack). Can an extra action be a second Move?
- **Default:** each token shows small action pips, one per available action, consumed as it acts. Extra actions can be anything except a second Move unless the effect says so ("can only move once per turn" stays in force); the Move button then says "Already moved this turn". Holy Fervor's second action shows its +1 AP in the button cost. **Confidence: Low-Medium** for the rule, **High** for the pips.

#### BT-06 Action bar and disabled reasons
- **Default:** buttons Move (M), Attack (A), Defend (D), one button per active ability (1, 2, 3) showing its AP cost and cooldown, and Cancel (Esc). A disabled button always says why, using fixed phrasings tagged public or private (G-12):

| Reason text | Tag |
|---|---|
| "Not enough AP (needs 3, you have 2)" | public |
| "No actions left this turn" / "Already moved this turn" | public |
| "Ready in 1 turn" (cooldown) | public |
| "No target in range" | private: computed only from what you can see |
| "Max 3 dummies active (3/3)" / "Max 5 mines active (5/5)" | private |
| "Disabled by your commander (Sabrina)" | public |
| "Can't hide: an enemy is watching" (Stealth) | leaks hidden information; owner decision in BT-24 |
| "Not your turn" | public |

**Confidence: High.**

#### BT-07 Preview, then confirm
- **Issue:** every action is committed to a live opponent and undoing it needs their consent (BT-29). A slip of the mouse costs far more than in Into the Breach (free undo of a move) or Advance Wars (nothing commits until "Wait").
- **Default:** the first click on a destination or target shows a preview (ghost unit, path, AP cost, damage). A second click on the same square, or Enter / Space, confirms. Clicking elsewhere moves the preview; Esc or right-click cancels. Options: "Confirm actions with a second click", ON by default; when off, a single click executes (Advance Wars feel). **Confidence: Medium.**

#### BT-08 Movement range and path
> "Units movement is defined by their movement stat. When a player takes an action to move the unit, that unit moves as many squares as the movement stat. The movement is orthogonal, a movement-piece cannot be diagonal. For instance: A unit with movement 2 can move left then up to complete a diagonal movement."
>
> "Besides special powers, all units (unless specified) share the actions of movement (1 square by default, including diagonals)..."

- **Issues for the UI:** (a) exactly N squares, or up to N; (b) "including diagonals" contradicts "cannot be diagonal"; (c) can a unit pass through allies, enemies, blockers, buildings; (d) Size 2 pathing; (e) does a mine or an ambush stop the move.
- **Default:** up to N orthogonal steps. Reachable squares are tinted. An arrow follows the mouse from the unit to the hovered square along the shortest path that avoids your own mines (BT-25), and the player can steer it by hovering intermediate squares (the Advance Wars arrow); the AP cost sits at the arrow head. Allies can be passed through but not ended on; visible enemies, blockers and buildings block. Moving into an unseen enemy stops the unit on the last free square with a "Blocked!" marker (Advance Wars' "Trap!") and spends the action. Moves animate square by square so that interruptions (mines, Assault) read naturally. **Confidence: Medium** (up to N, orthogonal), **Low** (passing allies, ambush stop).

#### BT-09 Attack range and adjacency
> "Ranged attack:P: This unit's attack has a range of 2."
>
> "...is in range of 1(including corners) of that building."
>
> "Forceful slam:4: Deal 10 damage to an adjacent square, and 3 damage to the 5 opposite adjacent squares of the target."

- **Issue:** the spec never defines "adjacent" or "range N" for attacks. "Including corners" for objectives suggests ranges are orthogonal by default, while "the 5 opposite adjacent squares" only works if a square has 8 neighbours.
- **Default for the UI** (rules analysis to confirm): "adjacent" and melee reach = the 8 surrounding squares; "range N" = Manhattan distance N, like vision. Because a unit cannot move and attack in the same turn, the attack overlay is always drawn from where the unit stands: enemies in reach get a red target ring the moment the unit is selected. Every attack and ability gets its exact squares from the rules engine, never from UI code. **Confidence: Low.**

#### BT-10 Damage preview
> "attack (attacking units deals damage to the toughness of a target unit) and defend (a defending unit receives half the damage rounded up(never less than one))"

Combat has no dice, so previews can be exact, as in Into the Breach.
- **Default:** hovering a target shows the damage on its toughness bar ("20 -> 8") and a skull when the hit is lethal. A breakdown tooltip lists each step in engine order (for example: Power 12, Keep +3, Priestess aura +1 = 16; defending, half rounded up = 8; Reinforced Armor -3 = 5; minimum 1). If a hidden modifier could apply (a square within aura range of the target is fogged), the preview is marked "~" with "Unseen units may change this". The order of halving and flat reductions is a rules decision; the UI shows whatever order the engine uses. **Confidence: Medium.**

#### BT-11 Defend
- **Default:** a defending unit shows a shield icon, visible to the opponent whenever the token is visible, until the start of its owner's next turn. **Confidence: Medium.**

#### BT-12 Ability targeting modes

| Ability | Targeting mode | UI steps | Open point and UI default |
|---|---|---|---|
| Stealth (Rogue) | Self | Button, then confirm | Availability can leak hidden watchers: BT-24 |
| Shared wounds (Priestess) | Two picks: source (adjacent unit or herself), then recipient | Pick source, then recipient; both toughness bars previewed | Recipient range unstated; default: a unit adjacent to the Priestess, or herself |
| Julio Vernification (Juliomancer) | Two picks: adjacent unit to sacrifice, then a unit within range 2 | Pick the sacrifice, then the target; preview shows the sacrifice's toughness as damage | Can enemies be sacrificed? Default: own units only |
| Prototype No-ACB (Artificer) | Free adjacent square | Valid squares highlighted; click | Counter "Dummies 2/3" on the card |
| Trip Mine B20 (Artificer) | Free adjacent square | Valid squares highlighted; click | Counter "Mines 4/5"; hidden from the opponent |
| Forcefield (Royal wizard) | 4 squares | Click 4 valid squares, then confirm | "4 adjacent squares in wizards LOV" is unclear; default: 4 connected squares inside the wizard's vision; duration unstated, default: until the wizard's next turn |
| Pajazon (Royal wizard) | 3x3 area, center up to range 3 | A 3x3 template follows the mouse; click | "at range 3": default up to 3; the area shows its remaining turns to anyone who can see it |
| Forceful slam (Beast) | Adjacent square plus a 5-square splash beyond it | Hover an adjacent square: main square red, splash orange | Friendly fire unstated; default: the splash hits any unit and the preview warns "hits your Footman 2" |
| Feast (Beast) | Adjacent unit | Click; preview shows life gained | Default: own units only |
| Holy blessing (Celestial Emissary) | Area around self, range 2 | Area shown; confirm | Preview lists each healed unit |
| Smite (Celestial Emissary) | Unit within range 3 | Click the target | Must the target be visible? Default: yes |
| Savagery (Berserker) | Follow-up attack | BT-13 | |
| Baba Yaga regeneration | Self, eligible tier only | Button on eligible units | HUD counter "Regenerations 1/2 this turn" |
| Ranged attack on a square (mines) | Empty square within attack range | Shift+click, or an "Attack square" sub-mode | BT-25 |

#### BT-13 Follow-up actions
> "Savagery:P: After attacking with the berserker, you can spend 2 AP to attack an additional time. Only once per turn."

- **Default:** when the Berserker's attack resolves, a highlighted "Savagery: attack again (2 AP)" button appears next to the unit and in the action bar, with targets already shown. It stays available until you act with another unit or end the turn. **Confidence: Medium-Low.**

#### BT-14 Choices during the opponent's turn
> "When a unit in that area dies you can choose to sacrifice 1 max toughness to revive that unit with half of its base toughness rounded up"
>
> "Assault: When an enemy unit comes into the melee range of this unit, if this unit is in stealth, perform an automatic attack without spending AP to the entering unit. (This can also occur in opponents turn)"

- **Issue:** Queso's revive is a choice that can come up during the opponent's turn, which pauses their turn until it is answered. Automatic effects (Assault, Kulega's regeneration, mines) need no prompt.
- **Default:** the Queso player gets a modal "Your Soldier 2 died near Queso. Revive it for 1 max toughness? [Revive] [Let it fall]" with a 15 s timer that defaults to "Let it fall". The active player sees "Waiting for <opponent>" only if the dead unit was visible to them; otherwise the wait is shown as an ordinary animation pause (G-12). Options: "Queso revive: Ask (default) / Always / Never". **Confidence: Medium.**

### 7.4 Information on units

#### BT-15 Own unit card
- **Default contents:** token art, name and copy number (BT-18), tier, faction; P/T as current over base with modifiers ("Power 16 (12 +3 Keep +1 aura)", "Toughness 8 / 20"); Size, Vision, Move, AP cost; actions left (pips); every ability with cost, cooldown ("Ready in 1 turn") and canonical text; statuses (Defending, Stealthed, Revealed, Weakened by Ratasius, In Forcefield, In Pajazon, Keep bonus, Market action); counters (dummies, mines, Baba Yaga regenerations); an "i" link to the codex. **Confidence: High.**

#### BT-16 Enemy unit card
- **Default:** shows what a visible enemy unit openly displays: type, tier, current and base P/T with public modifiers, visible statuses (Defending, Revealed) and cooldowns. Hidden facts (stealthed units elsewhere, mine counts) never appear. **Confidence: Medium.**

#### BT-17 Tokens
> "each unit will be represented by a token. The color of the token will represent the grade of the unit. The symbol on top of the token will represent the particular unit that token represents."

- **Default:** a coin-like disc; face color = tier color (G-04); unit symbol on the face; tier numeral on the rim; Power badge bottom-left and Toughness badge bottom-right (toughness turns red when damaged, as in Hero Academy and Hearthstone); team shown by the base ring's shape and pattern (A11Y-01); small status icons above the token (shield, eye-slash, revealed eye, action pips); a crown on the commander; dimmed when out of actions. **Confidence: High.**

#### BT-18 Telling copies apart
- **Default:** copies are numbered in deployment order ("Footman 3"). The number appears on hover, on the card and in the log, which also adds the square ("Footman 3 (E7)"). **Confidence: High.**

#### BT-19 Threat overlay
- **Default:** key T toggles a red overlay of every square the visible enemy units could attack on their next turn, using their action counts (a one-action unit can move or attack, not both, so most threats come from where enemies stand now). Fogged enemies are not included, and the legend says so. **Confidence: Medium.**

#### BT-20 Vision preview
> "LOV (Line of Vision) or vision, is also determined using this logic. A LOV of 1 will only show the 4 orthogonal adjacent squares. A LOV of 2, will show 12 squares around the unit, and so on."

- **Default:** while a move is previewed, the destination's vision diamond is outlined and the squares it would newly reveal are brightened. Key L toggles the selected unit's current vision. **Confidence: Medium.**

### 7.5 Fog of war, stealth and mines

#### BT-21 What the fog hides
> "The encounter takes place in a battlefield called scenario. Each player will only have vision around the vision field of each unit. Everything outside will be in the fog of war."

- **Issue:** the spec does not say whether terrain is hidden, whether there is an "explored" state, or whether blockers block vision.
- **Default:** two visual states. Visible squares are full color; fogged squares are desaturated and darker. The scenario itself (terrain, blockers, buildings, objective ownership) is public, so there is no black "unexplored" state; the fog hides only enemy units, enemy mines and enemy area effects. Your vision is the union of all your units' vision diamonds, including the commander and dummies. Blockers do not block vision (the spec defines vision by distance only). **Confidence: Medium** (public map), **Low** (blockers do not block vision).

#### BT-22 Last-seen markers
- **Default:** when an enemy unit leaves your vision, a faded ghost stays on its last known square, labelled "seen Round 4". It disappears when that square is visible again or the unit is seen elsewhere. On by default; toggle in Options. **Confidence: Medium.**

#### BT-23 Opponent actions you can and cannot see
- **Issue:** the opponent acts in real time; what you see of it must follow your vision exactly.
- **Default:** the opponent's actions animate live, but only where you can see them. A unit walking out of the fog appears at the fog edge; a unit walking into it fades out there. A hit from an unseen attacker shows the damage and the log line "Soldier 2 (F9) took 3 damage from an unseen attacker"; the attacker is not revealed. **Confidence: Medium** (live), **Low** (attacker stays hidden; the owner may prefer that attacking reveals the attacker for a turn, a "muzzle flash").

#### BT-24 Invisible units
> "Stealth:1:Only activate this ability if not inside the LOV of another enemy creature. This unit becomes invisible. It will be revealed when it's 1 square away from an enemy unit, or when receiving damage inside enemy LOV."
>
> "Mind's Eye:P: This unit reveals invisible units in its LOV"
>
> "Ratasius I "The Great": This commander has LOV of 6. Reveals all invisible enemies in range of 3."

- **Owner view:** the Rogue is drawn semi-transparent with an eye-slash icon and a dashed outline of its reveal distance ("1 square away"), so the owner knows how close enemies can come.
- **Opponent view:** nothing, unless a Mind's Eye unit or Ratasius reveals it; then the token appears with a "revealed" eye icon and can be targeted.
- **Issue 1:** activation depends on enemy vision, but the owner may not see the enemy that sees the Rogue. Showing "Can't hide: an enemy is watching" tells the owner a hidden enemy is close; letting the attempt fail tells them the same thing after spending AP.
- **Default 1:** disable the button with that reason (friendlier; the leak is the same either way). Owner decision. **Confidence: Low-Medium.**
- **Issue 2:** should the owner be told the Rogue has been revealed? If the revealer is hidden, that leaks its presence.
- **Default 2:** the owner sees "Revealed" only when the revealing unit is visible to them. **Confidence: Medium-Low.**

#### BT-25 Mines and the own-mine warning
> "Trip Mine B20:2: Deploy an invisible mine in a free adjacent square. It explodes when any unit steps on it. Deals 5 damage + 5 if the unit has a size of 2 or greater. ... Mines can be triggered from distance by attacking the square with a ranged attack."
>
> "(NOTE about pathing (dont include this into the description), when pathfinding, ally units will not go though mines automatically. Ask the player if he wants a unit to go to a mined square. The player can deactivate this warning from options)"

- **Owner view:** a mine icon on the square, visible only to its owner, and the team counter "Mines 4/5" on every Artificer card. As the owner asked, the unit description does not mention the pathing behaviour.
- **Pathfinding:** the path arrow never routes through your own mines when another route exists. If the destination is one of your mines, or every route crosses one, confirming the move shows: "This square has your mine. Moving there sets it off: 5 damage (10 for Size 2 or more). [Move anyway] [Cancel]" with "Don't ask again" (re-enable in Options). With the warning off, the dialog is skipped, but pathfinding still prefers mine-free routes.
- **Enemy view:** nothing until it explodes; then an explosion animation, the damage, and the log line "Berserker 1 set off a mine at K12".
- **Issue:** does passing over a mine count as "steps on"; is a mine used up; can Mind's Eye see mines; which attacks count as a "ranged attack" for remote detonation.
- **Default:** passing over a mine also triggers it and stops the unit on that square; a mine disappears after exploding; Mind's Eye does not reveal mines; remote detonation uses the Attack action of a unit with attack range 2 or more (the Ranger) aimed at an empty visible square in range ("Attack square" mode, BT-12); a square without a mine shows "Nothing there" and the action is still spent. **Confidence: High** (warning flow, from the owner's note), **Medium-Low** (the rest).

#### BT-26 Summoned units
> "Prototype No-ACB:2: Create a dummy unit in a free adjacent square. It's a 0/7 unit, it cannot move and has a LOV of 1 and AP 1. A maximum of 3 dummies can be active at the same time."
>
> "Mad inventor: Prototypes NO-ACB can move when adjacent to any allied artificer and gain 1 power."

- **Default:** dummies are full units in the UI (selectable, included in Tab cycling, give vision) with a distinct gear symbol and no tier numeral. Their Move button is enabled only while adjacent to an Artificer, otherwise "Needs an adjacent Artificer". The team counter "Dummies 2/3" appears on Artificer cards. **Confidence: Medium.**

### 7.6 Objectives and winning

#### BT-27 Keep and Market status
> "Each one will occupy a 2x2 square and will be conquered when at least one unit, without opposition, is in range of 1(including corners) of that building. One conquered, the building can be reconquered by the same method."
>
> "The keep: While the keep is active, all units receive a bonus of 3 power."
>
> "The market: While the market is active, all type-1 unit have an additional action per turn."
>
> "The neutral objectives are represented by 3d objects and a symbol in the middle that represents this building."

- **Issue:** when capture is checked (immediately, end of turn, start of turn); whether hidden units count as "opposition"; whether ownership is public; whether "all units" means only the owner's units.
- **Default:** the 12 squares around the building form its capture ring, highlighted when the building is hovered. Capture is checked at the end of every turn: if units of only one side stand in the ring, that side takes the building. Ownership is public, even through fog, because it changes numbers both players see; the top bar shows "Keep: You / Opponent / Neutral" and the building flies the owner's banner. If your units are in the ring and no enemy is visible there, the ring reads "Capturing at end of turn"; if a hidden enemy blocks the capture, the end-of-turn result simply says "Not captured: contested" (a small, accepted leak). Bonuses apply only to the owner's units; affected units show "+3 Keep" in their power breakdown, and the Market adds an action pip to the owner's Tier 1 units. Buildings block movement, not vision. **Confidence: Medium** (public ownership, owner-only bonus), **Low** (end-of-turn timing, hidden units counting as opposition).

#### BT-28 Win conditions on screen
> "The objective of each player is to defeat the commander of each party. ... Another way of winning is if you manage to bring your commander to the opposite side of the board. More specifically, to the last row."

- **Default:** the opponent's back row always carries a subtle goal pattern. Your commander wears a crown and its card shows "Goal: 18 rows away"; the enemy commander also wears a crown when visible. The win triggers the moment a commander enters any square of the far row. **Confidence: Medium.**

### 7.7 Take-backs

#### BT-29 Take-back request and acceptance
> "There will be a take back option for each player. The opponent player has to accept the take back."

- **Issues:** how much is undone (one action or a whole turn); until when it can be asked; how often; what happens to information already revealed (fog, mines, Assault); what the opponent sees in the request.
- **Default:**
  - **Scope:** your most recent action together with everything it caused (a mine going off, an Assault, deaths, captures, reveals). Each accepted request steps back one action; you may then ask for the one before. Only actions of the current turn can be taken back, plus, after you end your turn, your last action and the End Turn itself, as long as the opponent has not acted yet.
  - **Flow:** "Request take-back" (Ctrl+Z) asks "Request to take back: Paladin 2 moved E5 -> E8?". The opponent gets a modal: "<name> asks to take back: Paladin 2 moved E5 -> E8. [Accept] [Decline]". If the action revealed squares to the requester, the modal adds "This action revealed new squares to them." While a request is pending, the requester cannot act. The modal auto-declines after 30 s.
  - **Limits:** one pending request at a time; a declined action cannot be requested again; no count limit by default.
  - **Settings:** lobby "Take-backs: Ask opponent (default) / Off"; Options "Automatically decline take-back requests" (off by default).
  - **Log:** requests, acceptances and refusals are logged for both players.
  - **Confidence: Medium.**

### 7.8 Ending the turn

#### BT-30 End turn and the resolution sequence
> "Perseverance:P: Regenerate 1 toughness at the end of the turn (Your turn)"
>
> "At the end of your turn, allied units in the area regenerate 3 toughness; At the end of the opponent's turn, enemy units take 3 damage."
>
> "Unlike MTG, the units that receive damage do not regenerate or recover toughness at the end of turn, unless some kind of ability or skill is involved."

- **Default:** END TURN is a button or Ctrl+Enter (not Space, to avoid accidents). If AP remains and a unit can still act, a dialog says "You have 3 AP left and 2 units that can still act. End turn?" with "Don't ask again". The end of the turn then plays a short, skippable ticker in a fixed order: regeneration (Soldier, Pajazon, Queso), damage over time (Pajazon), capture checks, cooldowns counting down. Each step shows floating numbers on the affected tokens and writes a log line. Start-of-turn effects work the same way. **Confidence: High** (warning), **Medium** (order, which the rules analysis must fix).

#### BT-31 Turn timer
Spec: silent.
- **Default:** off. If set in the lobby, each turn has a fixed time plus a small reserve that carries over (a chess-clock increment); at zero the turn ends automatically; both players see the timer; it pauses during disconnections and while a take-back or revive prompt is open. **Confidence: Medium.**

### 7.9 Log, camera and menus

#### BT-32 Combat log
- **Default:** entries grouped by round, each with actor, action, target, result and squares ("R4 Paladin 2 (E8) attacked Footman 5 (E9): 12 damage, defeated"). Hovering an entry highlights its squares on the board. Filters: All / Combat / Objectives / System. Private lines (your mines, your stealth) appear only for you; lines about unseen units are worded neutrally (BT-23). "Copy log" exports plain text. After the match the full, unfiltered log is available on the result screen. **Confidence: High.**

#### BT-33 Camera and the top / isometric switch
> "The view can switch from top to isometric. Top by default."

- **Default:** a view toggle button and key V; the choice is remembered per player. Pan by dragging (right or middle mouse), WASD or arrow keys; zoom with the wheel or +/-; F focuses the selected unit; H focuses your commander; the camera can follow visible enemy actions (Options). Isometric uses one fixed angle looking from your side; rotating in 90 degree steps (Q/E) can come later. In isometric, tall buildings fade when they hide a hovered square or a unit, and unit symbols stand upright as small billboards so they stay readable. Both views must pick squares identically under the cursor. **Confidence: Medium.**

#### BT-34 In-game menu and resigning
Spec: silent.
- **Default:** Esc opens Resume, Options (gameplay and display subset), Codex, Offer draw, Resign. Resign asks for confirmation and ends the match as a loss. Closing the tab is not a resignation (NET-03). **Confidence: High.**

#### BT-35 Draws and stalemates
Spec: silent.
- **Default:** "Offer draw" (the opponent accepts or declines; one offer per round). If both commanders fall to the same action, the match is a draw. No turn limit in v1. Owner question: should a long game end after N rounds and be decided by objectives held? **Confidence: Medium** (draw offer), **Low** (simultaneous deaths).

#### BT-36 What you know about the enemy army
- **Default:** the enemy army's size and contents stay hidden. The HUD shows "Enemies defeated: 5" with the types you defeated; the whole army is revealed on the result screen. **Confidence: Medium.**

#### BT-37 During the opponent's turn
- **Default:** you can select and inspect any visible unit, toggle overlays and read the log, but not queue actions (no premoves in v1). Drawing planning arrows on the board, as chess apps allow, can come later. **Confidence: Medium.**

#### BT-38 Animation speed
- **Default:** Options "Animation speed: Normal / Fast / Instant"; any animation can be skipped with a click; the opponent's actions never play faster than Fast, so they are not missed. **Confidence: High.**

## 8. Result screen (S08)

### RS-01 Outcomes and wording
> "For now, the objectives stand as conquest or domination (Killing enemy commander, reaching the other side of the board)."

- **Default:** Victory or Defeat by "Commander defeated" (conquest), "Commander reached the far side" (domination), "Opponent resigned", or "Opponent left the game" (forfeit, NET-03); Draw by "Draw agreed" or "Both commanders fell". The headline names the reason and the round ("Victory by domination, Round 12"). **Confidence: High.**

### RS-02 Reveal
- **Default:** the fog lifts on the final board, and both full armies are listed, including units that never left the fog. A toggle switches between "Full view" and "My view at the end". **Confidence: Medium-High.**

### RS-03 Match summary
- **Default:** rounds played, AP spent, damage dealt and taken, units lost and defeated per type (in tier colors), rounds each objective was held, take-backs requested and accepted, and a "Most valuable unit" (most damage dealt). **Confidence: Medium.**

### RS-04 Achievements
- **Default:** achievements unlocked and progress gained in this match appear here, one card each; they are queued during the battle so they do not distract (AC-03). **Confidence: Medium.**

### RS-05 What next
- **Default:** Rematch (asks the opponent, LB-12), Change army (back to the lobby, settings kept), Copy opponent's army (it is public now; saved as a new composition), Copy log, Main menu. **Confidence: Medium** (copying the opponent's army: **Low-Medium**; the owner may prefer armies to stay private).

### RS-06 Replays
- **Default:** no replay viewer in v1, but the engine records every action so one can be added later. **Confidence: Medium.**

## 9. Achievements and stats (S09)

> "Check his achivements"

Requirements:
- A grid of achievement cards: icon, name, description, a progress bar for counters ("32 / 50"), unlock date. Unlocked first. Summary "7 / 15 unlocked".
- A stats panel: matches played, wins, losses, draws, win rate per commander, most fielded unit, most used army, longest match.
- No hidden achievements in v1, so players know what to aim for.

### AC-01 What counts
- **Default:** only completed matches against a different profile count (a different profile ID; this cannot stop someone playing themselves in two browsers, which is acceptable for local achievements). Win-based achievements need at least 3 full rounds, so instant resignations cannot farm them. Wins by opponent forfeit count. Sandbox games never count. **Confidence: Medium.**

### AC-02 Storage and trust
- **Default:** stored with the profile in browser storage, and exported/imported with it (G-06). The player could edit the values; with no leaderboards that only cheats themselves, so no protection is attempted. **Confidence: High.**

### AC-03 When the player is told
- **Default:** unlocks are queued during the battle and shown on the result screen. Options "Show achievement toasts during battle" (off by default) shows a small toast instead. **Confidence: Medium.**

### AC-04 Adding achievements later
- **Default:** achievements are data (ID, name, description, trigger, target). New ones are evaluated from stored stats where possible, so existing players get credit for past progress. **Confidence: Medium.**

### 9.1 Proposed achievements (15)

The first ten (Core) need only end-of-match data and a few counters. The last five (Extended) need event hooks in the rules engine.

| ID | Name | Unlock condition | Tracking (local) | Set |
|---|---|---|---|---|
| ACH-01 | First Coin | Finish your first match, any result | `stats.matchesCompleted >= 1`, incremented on GameEnded | Core |
| ACH-02 | Regicide | Win by defeating the enemy commander | GameEnded with winner = you and reason = commander defeated | Core |
| ACH-03 | Across the Line | Win by bringing your commander to the far row | GameEnded with reason = commander reached the last row | Core |
| ACH-04 | Small Change | Win with an army made only of Tier 1, 2 and 5 units (at least one unit) | Army snapshot taken at GameStarted, tiers checked at GameEnded | Core |
| ACH-05 | Exact Change | Win with an army that spends exactly the whole budget | Army snapshot: cost equals the lobby budget | Core |
| ACH-06 | Untouchable | Win without your commander losing any toughness | Per-match flag cleared by any DamageApplied to your commander | Core |
| ACH-07 | King of the Hill | Hold the Keep at the end of 5 of your turns in a row, in one match | Per-match streak counter on your TurnEnded; reset when you lose the Keep | Core |
| ACH-08 | Monopoly | Own the Keep and the Market at the same time | On ObjectiveCaptured: both buildings owned by you | Core |
| ACH-09 | Watch Your Step | An enemy unit is defeated by one of your Trip Mines | UnitDefeated with cause = mine and mine owner = you | Core |
| ACH-10 | Shield Wall | Line Formation prevents 50 damage in total, across all matches | `stats.lineFormationPrevented` increased by the prevented amount on each DamageApplied; progress bar | Core |
| ACH-11 | From the Shadows | A Rogue's Assault defeats an enemy during your opponent's turn | UnitDefeated with source = Assault while the opponent is the active player | Extended |
| ACH-12 | David and Goliath | A Tier 1 unit's attack defeats a Tier 100 unit | UnitDefeated with attacker tier 1 and victim tier 100 | Extended |
| ACH-13 | Fair Play | Accept 5 take-back requests from opponents | `stats.takebacksAccepted` on TakebackResolved (accepted, you responded) | Extended |
| ACH-14 | Numismatist | Field each of the 14 units in at least one completed match | `stats.unitsFielded` set of unit IDs, updated on GameEnded; progress "9 / 14" | Extended |
| ACH-15 | Hall of Commanders | Win at least once with each of the 6 commanders | `stats.winsByCommander` map, updated on GameEnded; progress "2 / 6" | Extended |

### 9.2 Tracking design
- **Events.** The rules engine already has to produce a list of resolved events for the log and the animations. Achievements read the same stream, as seen by the local player: GameStarted (army snapshot, commander, budget, settings), DamageApplied (source, target, amount, amount prevented and by what), UnitDefeated (attacker, victim, cause, active player), ObjectiveCaptured, TurnEnded, TakebackResolved, GameEnded (winner, reason, rounds).
- **Evaluation.** Each achievement is a small pure function of (event, per-match scratch state, stored stats) that returns new progress. Per-match scratch state lives in memory and in the reconnection snapshot (NET-04), so a page refresh does not break a streak.
- **Take-backs.** Achievement progress from an action that is taken back is rolled back with it (evaluate on the authoritative event stream after take-backs are applied, or keep per-match progress in the undoable state).
- **Storage.** `profile.v1` in browser storage: `{ profileId, name, createdAt, stats: { matchesCompleted, wins, losses, draws, winsByCommander, unitsFielded, lineFormationPrevented, takebacksAccepted, ... }, achievements: { "ACH-07": { progress: 3, unlockedAt: null }, ... } }`.
- **Perspective.** Every achievement above depends only on facts the local player is entitled to know (their own units, their own mines, public results), so achievements need no hidden information and cannot leak any.

## 10. Options (S10)

> "The player can deactivate this warning from options"

| Group | Setting | Default | Ref |
|---|---|---|---|
| Gameplay | Warn before moving onto your own mines | On (spec) | BT-25, OP-02 |
| Gameplay | Confirm actions with a second click | On | BT-07 |
| Gameplay | Warn when ending the turn with AP left | On | BT-30 |
| Gameplay | Automatically decline take-back requests | Off | BT-29 |
| Gameplay | Queso revive | Ask | BT-14 |
| Gameplay | Show last-seen enemy markers | On | BT-22 |
| Gameplay | Show threat overlay at turn start | Off | BT-19 |
| Gameplay | Camera follows visible enemy actions | On | BT-33 |
| Gameplay | Animation speed | Normal | BT-38 |
| Gameplay | Show achievement toasts during battle | Off | AC-03 |
| Display | Default view | Top (spec) | BT-33 |
| Display | Grid coordinates | On | G-08 |
| Display | Color palette | Default / Red-green safe / Blue-yellow safe / High contrast | A11Y-01 |
| Display | Tier numerals on tokens | On (always on in the color-safe palettes) | A11Y-01 |
| Display | Interface scale | 100% (80 to 150%) | A11Y-03 |
| Display | Reduce motion | Follows the system setting | A11Y-05 |
| Audio | Master / Music / Effects volume | 80 / 50 / 80 | G-11 |
| Audio | "Your turn" sound | On | BT-03 |
| Notifications | Browser notification on your turn while the tab is hidden | Off (asks for permission when switched on) | BT-03 |
| Controls | Keyboard shortcut list (rebinding later) | - | A11Y-04 |
| Data | Export profile, Import profile, Reset achievements, Delete all local data | - | G-06 |
| About | Version, credits and licenses | - | MM-06 |

### OP-01 Where options live
- **Default:** saved per browser profile (the same storage as G-05), applied immediately with no Save button. The in-game menu shows the Gameplay and Display groups only. **Confidence: High.**

### OP-02 Mine warning semantics
> "The player can deactivate this warning from options"

- **Default:** the label is "Warn before moving onto your own mines". Switching it off removes only the confirmation; pathfinding still avoids your mines whenever it can (BT-25). The "Don't ask again" checkbox in the dialog flips this same setting. **Confidence: High.**

### OP-03 Restoring dismissed prompts
- **Default:** a "Reset all 'Don't ask again' choices" button. **Confidence: High.**

## 11. Connection, disconnection and reconnection

> "...with a way to connect with another player. This should be done in a way that requires the least setup."

### NET-01 Connection indicator
- **Default:** a dot in the top bar for you and one next to the opponent's name: green (fine), amber (slow, latency over 300 ms), red (lost). Hover shows the latency. **Confidence: High.**

### NET-02 You lose the connection
- **Default:** a banner "Connection lost. Reconnecting..." with the attempt count. The board stays visible but input is locked. Retries are automatic with backoff. On reconnect the authority re-sends the state and play continues. An action that was never acknowledged is dropped with the toast "Your last action was not sent"; it is never applied twice. **Confidence: High.**

### NET-03 The opponent loses the connection
- **Default:** a non-blocking overlay "<name> disconnected. Waiting for them to return (1:58)". The turn timer pauses. After 120 s you can "Claim victory" (a forfeit win) or "Keep waiting". If they return, play resumes where it stopped. In the lobby or during deployment the wait is the same, but leaving simply cancels the match with no result. **Confidence: Medium.**

### NET-04 Refresh, closed tab, rejoining
- **Default:** the URL `#/lobby/<CODE>` plus the profile ID and a seat token in browser storage let a player rejoin automatically by refreshing or reopening the link; the main menu shows "Rejoin game in progress" (S02). Deployment drafts survive a refresh. **Confidence: High.**

### NET-05 Which side holds the game
- **Issue:** with no server, one browser (normally the host's) must hold the authoritative state. If that tab closes, the match can resume only if the other side holds a copy, and any client that holds the full state can read hidden information with developer tools (R3).
- **Default for UX:** design for matches that survive either player dropping. If the chosen architecture makes the host's tab the only authority, the guest must get an honest message: "The host closed the game. This match cannot continue." The networking analysis should weigh a small relay or authority service, which fixes both problems. **Confidence: Medium.**

### NET-06 Same player in two tabs
- **Default:** the newest tab takes the seat; the older one shows "This game is open in another tab. [Use here]". **Confidence: High.**

### NET-07 How long an abandoned match survives
- **Default:** as long as at least one player's tab stays open, or 24 hours if a relay service stores it; after that the link shows "This game has ended". **Confidence: Low.**

### NET-08 Feedback for slow actions
- **Default:** after an action is confirmed, the token shows a small spinner until the authority accepts it (normally at once). The result is not shown before acceptance, because results can depend on hidden information (mines, Assault). **Confidence: Medium.**

## 12. Accessibility

> "The color of the token will represent the grade of the unit."

### A11Y-01 Tier color is never the only cue, and team must not compete with tier
- **Issue:** seven tier colors are hard for anyone to tell apart at token size, and for colorblind players several pairs in G-04 collapse (green, orange and red under red-green colorblindness; blue and purple for most types). The team must be shown too, and a team hue would clash with the tier hues.
- **Default:**
  - Tier is shown three ways: face color, the numeral on the rim, and a rim pattern that echoes real coin edges (smooth, ridged, notched, scalloped and so on, one per tier).
  - Team is shown by the base ring under the coin: a solid round ring for yours, a toothed ring for the enemy's. If team hues are added on top, they are picked outside the tier palette and must pass a colorblind simulation against all seven tier colors.
  - Options offer palettes tuned for red-green and blue-yellow colorblindness and a high-contrast palette; in those, numerals cannot be turned off.
  - The art mock page (owner's delivery note) shows the full token matrix, 7 tiers x 2 teams x 3 states, in normal vision and in simulated protanopia, deuteranopia, tritanopia and grayscale, at the real in-game size (about 32 px).
  - **Confidence: High.**

### A11Y-02 Overlays and states never rely on color alone
- **Default:** move range = filled tint with a dotted edge; attack reach = red outline with a target icon; ability area = hatching; capture ring = dashed outline; selected = thick outline and a slight lift; acted = dimmed with an "out of actions" icon; defending, stealthed and revealed = icons. **Confidence: High.**

### A11Y-03 Text size
- **Default:** body text at least 14 px at 100% scale, card text 16 px, interface scale 80 to 150% in Options. **Confidence: High.**

### A11Y-04 Keyboard play
- **Default:** the whole game works from the keyboard: arrow keys move a square cursor on the board, Enter selects or confirms, Esc cancels, Tab cycles units, letters trigger actions (BT-06). Menus have visible focus rings and a logical tab order. **Confidence: Medium.**

### A11Y-05 Motion
- **Default:** honor the system "reduce motion" setting: no camera shake, short fades instead of travel animations, no flashing explosions. **Confidence: High.**

### A11Y-06 Screen readers
- **Default:** menus, the army builder, the lobby and Options use proper labels and roles. On the board, the cursor square and unit are announced ("E8, your Paladin 2, 12/20, 1 action left") and the log is a live region. Full non-visual play is not a v1 goal. **Confidence: Medium.**

### A11Y-07 Sound and visuals
- **Default:** every sound cue has a visual equivalent; no information is given by sound alone. **Confidence: High.**

### A11Y-08 No hover-only information
- **Default:** whatever hover shows is also available by click, long-press or the "i" key. **Confidence: High.**

### A11Y-09 Time pressure
- **Default:** no timers unless the lobby enables one; no prompt shorter than 15 s; reactive prompts offer Ask / Always / Never preferences (BT-14). **Confidence: Medium.**

### A11Y-10 Isometric readability
- **Default:** top view stays the default (as the spec says); in isometric, symbols stand upright (BT-33) and buildings fade when they hide units. **Confidence: Medium.**

## 13. Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | **Previews disagree with the rules.** Ranges, paths, damage previews and disabled reasons depend on rules the spec leaves open (adjacency, movement, vision and blockers, damage order, cooldowns, capture timing). If the UI computes them separately from the engine, the two drift and players stop trusting previews. | High | High | The UI asks the rules engine for every range, path, preview and legality check; all defaults from this document live in one config file; the owner answers the Blocker questions in section 16. |
| R2 | **Hidden information leaks through the UI.** Checklist for every feature: (1) disabled-button reasons (Stealth); (2) objective "Contested" states; (3) waits on hidden prompts (Queso); (4) log wording; (5) damage previews that include unseen modifiers; (6) sounds, toasts or achievements fired by unseen events; (7) network messages carrying the full state; (8) timing differences (a turn pausing for a hidden Assault); (9) take-back modal contents; (10) the resync after a reconnect. | High (fog is a core mechanic) | High | Per-player filtering at the authority; public/private tags (G-12); review each feature against this checklist. |
| R3 | **Cheating with developer tools** when a player's browser holds the full state (peer-to-peer with the host as authority). | High for fairness | Medium (friends-only play lowers the motive) | An authority outside both browsers (a small relay service), or an explicit "friendly play" trust model documented for the owner (NET-05). |
| R4 | **Mis-clicks combined with consent-based take-backs** frustrate both players. | Medium | High | Preview-then-confirm (BT-07), exact previews, the path arrow, Esc to cancel. |
| R5 | **Large armies of cheap units** make deployment slow, turns long for the waiting player, and the board cluttered. A cheap swarm is an obvious strategy with a 200 budget. | High | High | Army cap (AB-06), paint deployment and saved formations (DP-09, DP-12), Tab cycling (BT-04). The AP limit caps actions per turn, but not clutter or waiting time. |
| R6 | **Token readability:** 7 tier colors x 14 symbols x 2 teams x statuses on 28 to 40 px squares, worse in isometric view. | High | Medium | Redundant encoding (A11Y-01), zoom, hover cards, testing at real size on the art mock page. |
| R7 | **Reactive prompts stall the active player's turn.** Only Queso today; future content will add more. | Medium | Medium | 15 s timeouts and Always / Never preferences (BT-14); keep reactive choices rare in unit design. |
| R8 | **Disconnections lose matches**, fatally so if only the host's tab holds the state. | High | Medium | NET-02 to NET-05. |
| R9 | **Local data loss** (cleared storage, another device, private window) wipes armies and achievements. | Medium | Medium | Export/import, share codes, first-run notice (G-06). |
| R10 | **Faction ambiguity** forces rework of the builder and the art. | Medium | Medium | Faction as data from day one (G-01, AB-12). |
| R11 | **First-player advantage and turtling** make matches feel unfair or endless. | Medium | Medium | Coin flip and alternation (LB-05), draw offers (BT-35), the sandbox for balance tests (MM-05), an owner decision on a round limit. |
| R12 | **Screen space:** a 25 x 25 board plus side panels needs about 1280 x 720; laptops are cramped and phones impractical. | Medium | High | Collapsible panels, zoom and pan, responsive layout (G-10). |
| R13 | **Scope creep** (chat, replays, extended achievements, practice mode, isometric polish) delays the core game. | High | Medium | v1 scope in section 14; the engine stays view-independent so isometric can follow top view. |
| R14 | **Spec changes** (budget, factions, unit stats) break saved armies and formations. The spec already says the budget and the factions will change. | Medium | High | Versioned data and "Needs update" flows (G-06, AB-17). |
| R15 | **Ability text quality.** The spec text mixes terms (hp, life, health), has typos ("achivements", "though", "aswell", "One conquered"), and some abilities lack a cost, range or duration. Players read these texts on every card. | Medium | High | Canonical rules text written once from the engine data and approved by the owner (G-03). |

## 14. v1 scope proposal

- **Must:** local profile (G-05); main menu with Play, Army compositions, Achievements, Options; army list and builder with validation, save, edit and starter armies; lobby with invite link, army picker, in-lobby building, Ready and coin flip; simultaneous deployment with paint and auto-place; battle with AP, turn indicator, unit cards, actions with disabled reasons, move and attack previews, damage preview, fog, stealth, mines with the own-mine warning, summons, objectives, both win conditions, the take-back flow, end-turn ticker and combat log; top view, then the isometric switch (it is in the spec; it ships once top view works); result screen; Core achievements ACH-01 to ACH-10; the Options in section 10; reconnection NET-01 to NET-04; accessibility A11Y-01, 02, 03, 05, 07, 08.
- **Should:** threat overlay, last-seen markers, saved formations, share codes, chat, Extended achievements ACH-11 to ACH-15, colorblind palettes, full keyboard play, resign and draw offers.
- **Could:** the sandbox exposed as Practice, planning arrows, replays, isometric rotation, desktop notifications, copying the opponent's army.
- **Not in v1:** accounts, matchmaking, spectators, AI opponent, tutorial campaign, leaderboards.

## 15. What this document needs from the other analyses

- **Rules / engine** (each has a UI default above): adjacency and range metric (BT-09); movement exactly or up to N, diagonals, passing units (BT-08); vision and blockers (BT-21); damage modifier order (BT-10); cooldown meaning of "CD 1 turn"; durations of Defend, Forcefield and Pajazon (BT-11, BT-12); capture timing and opposition (BT-27); extra actions and second moves (BT-05); corner-cut geometry (DP-06); Size 2 footprint (DP-07); AP per turn (BT-01); the commander AP stat and Queso's AP 3 (AB-13); friendly fire (BT-12); mine triggering (BT-25); Stealth activation and reveal (BT-24); the cost of Queso's revive (BT-14); Sabrina pricing and tiers (AB-05); simultaneous commander deaths (BT-35); what "white" is (G-04).
- **Engine interface the UI relies on:** legal actions for a unit; reachable squares with paths and AP costs; a preview of any action that returns predicted events plus an "uncertain" flag when hidden information could change them; the per-player visible state; the stream of resolved events (for animations, the log and achievements); undo of the last action with all its consequences (take-backs).
- **Networking:** where the authority lives (NET-05); reconnection and resync (NET-02 to NET-04); per-player filtering (G-12); lobby lifetime (LB-01); version checks (G-13).
- **Art:** tier colors and the token matrix (G-04, A11Y-01); 14 unit symbols plus the dummy and the commander crown; Keep and Market as 3D objects in both views; the fog look; upright symbols in isometric view; the mock page the owner asked for, showing every contender side by side.

## 16. Index of open questions by severity

129 issues in total: 8 Blocker, 23 High, 73 Medium, 25 Low.

### Blocker: a screen cannot be finalized without the answer (defaults let work start)

| ID | Question | Default | Confidence |
|---|---|---|---|
| BT-01 | AP received per turn | 8, no carry-over, configurable | Low |
| G-04 | Tier color palette; what "Units of white" means | White/Green/Blue/Purple/Orange/Red/Gold; white = Tier 1 | Low |
| G-01 | Faction rosters and commanders | One shared roster, all 6 commanders, faction stored as data | Low |
| AB-06 | Army size cap | Deployment-zone capacity; owner to set a design cap (40 suggested) | Low |
| BT-08 | Movement: up to or exactly N; diagonals; passing units | Up to N orthogonal steps; pass allies; blocked by enemies | Medium / Low |
| BT-09 | Meaning of "adjacent" and "range N" | Adjacent = 8 neighbours; range = Manhattan distance | Low |
| DP-06 | Corner cut geometry | Remove squares with x + y < 4 from each corner (10 per corner) | Low |
| DP-04 | Units allowed in the extended zone | Ranger and Rogue, as a per-unit flag | Low |

### High: visible to every player in every match

| ID | Question | Default | Confidence |
|---|---|---|---|
| G-05 | Identity without accounts | Local profile with name and random ID | High |
| G-12 | Hidden-information leaks through the UI | Public/private tags and the R2 checklist | High |
| AB-01 | Starter armies | Six presets, one per commander | High (need) / Low (contents) |
| AB-04 | Unit cost | Equals tier value | Medium-High |
| AB-05 | Commander-dependent pricing (Sabrina) | Commander first; live re-pricing; Artificer becomes Tier 10 and costs 10 | Medium / Low |
| LB-03 | What the opponent sees before battle | Ready state only; armies hidden all match | Medium |
| LB-05 | Who moves first | Random coin flip; alternates on rematch | Medium |
| DP-01 | Deployment order | Simultaneous and hidden | Medium-High |
| DP-11 | Commander reveal | Both commanders revealed at deployment start | Medium |
| BT-05 | Extra actions and second moves | Pips per action; no second Move unless stated | Low-Medium |
| BT-07 | Mis-click protection | Preview, then confirm with a second click | Medium |
| BT-10 | Damage preview | Exact preview with breakdown; "~" when unseen modifiers may apply | Medium |
| BT-14 | Choices in the opponent's turn (Queso) | 15 s prompt defaulting to "No"; Ask / Always / Never | Medium |
| BT-21 | What the fog hides | Units, mines and effects only; the map is public | Medium |
| BT-24 | Stealth activation leak; revealed status | Disable with reason; show "Revealed" only if the revealer is visible | Low-Medium |
| BT-25 | Own-mine pathing warning | Avoid own mines; confirm when moving onto one; toggle in Options | High |
| BT-27 | Objective capture and bonuses | End-of-turn check; public ownership; owner-only bonuses | Medium / Low |
| BT-28 | Win conditions on screen | Goal row marked; instant win on entering it | Medium |
| BT-29 | Take-back scope and flow | Last action with its consequences; one step per request; 30 s auto-decline | Medium |
| BT-30 | End turn and resolution order | Warning on unspent AP; fixed, skippable ticker | High / Medium |
| NET-03 | Opponent disconnects | 120 s wait, then Claim victory or Keep waiting | Medium |
| NET-05 | Where the authoritative state lives | Survive either player dropping; prefer a small relay | Medium |
| A11Y-01 | Color-only tiers; team vs tier | Numeral + rim pattern; team by base ring; colorblind palettes | High |

### Medium

G-02, G-03, G-06, G-07, G-08, G-10, G-13; MM-01, MM-03, MM-05; AB-03, AB-08, AB-09, AB-10, AB-12, AB-13, AB-14, AB-15, AB-16, AB-17; LB-01, LB-02, LB-04, LB-06, LB-07, LB-08, LB-09, LB-10, LB-12; DP-02, DP-03, DP-05, DP-07, DP-08, DP-09, DP-10; BT-02, BT-03, BT-04, BT-06, BT-11, BT-12, BT-13, BT-15, BT-16, BT-17, BT-18, BT-19, BT-20, BT-22, BT-23, BT-26, BT-31, BT-32, BT-33, BT-34, BT-35, BT-36; RS-01, RS-02, RS-05; AC-01; OP-02; NET-01, NET-02, NET-04, NET-06, NET-08; A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-09.

### Low

G-09, G-11; MM-02, MM-04, MM-06; AB-02, AB-07, AB-11; LB-11; DP-12; BT-37, BT-38; RS-03, RS-04, RS-06; AC-02, AC-03, AC-04; OP-01, OP-03; NET-07; A11Y-06, A11Y-07, A11Y-08, A11Y-10.
