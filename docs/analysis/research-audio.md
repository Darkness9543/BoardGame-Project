# Sound research: cue list, CC0 sources, chosen files and mixing

Research and asset step for the game's sound effects. Owner direction (2026-10-24, verbatim): "Sound effects are in scope. The feel has have a grit and viscerality to it, while staying readable and not too exagerated."
All licences, URLs, authors and file counts were checked online on **2026-10-24**; the "Verified" column says how. Every shipped sound is **CC0 1.0**.

**Deliverables**

| Path | What it is |
|---|---|
| `apps/web/public/assets/audio/<cue>.ogg` and `.mp3` | 94 chosen sounds for 73 cues, each as Ogg Vorbis (preferred) and MP3 (Safari fallback): 4.10 MB |
| `apps/web/public/assets/audio/cues.json` | Cue id &rarr; files, gain, variations, source, licence, author, bus, engine events, jitter, voices, priority; plus bus levels, ducking, voice limits and the unlock rule |
| `apps/web/public/assets/ATTRIBUTION.md` section 7, `manifest.json` | Per-file credits and one manifest entry per file (188 entries) |
| `docs/audio-direction/local.html` (open from disk) and `index.html` (artifact format) | The mock page: every cue with Play buttons, all contenders with their reasons, a mixer and seven scripted scenes |
| `docs/audio-direction/audio/` | MP3 copies of the chosen files plus the 146 contender renders the page plays (contenders are not shipped) |
| `docs/analysis/research-audio/` | Licence-check records (`licence-checks-*.json`), the build report, waveform/spectrogram sheets of every chosen file (`qa-waveforms-*.jpg`), and the scripts and recipe that rebuild every file (`scripts/`) |

---

## 0. Recommended defaults at a glance

| # | Decision | Recommended default | Contenders on the mock page | Confidence |
|---|---|---|---|---|
| 1 | Palette | **Real recordings of real objects**, one material per kind of event: a coin on wood for units, struck metal for hits, air for swings, stone/clay/paper/wood for the UI, bells and drums for turn signals, one physical gesture per ability | Kenney's clean game libraries and synth UI sounds (shown as contenders where they fit) | Medium |
| 2 | Unit sounds | **One recording family**: a real two-euro coin on a varnished wooden table (BigSoundBank, Pierre Sibanarco) for select, deselect and death, plus a large coin slid across a table (Freesound, seanhealey) for steps | Wooden piece hops, clay chips, a bouncing dropped coin | Medium |
| 3 | Readability code | **Shape-coded hits**: blocked = high, thin ping; defended = low, dull thud; light = short bright tink; heavy = anvil with a body punch. Swings carry no metal | Single generic impact | Medium-high |
| 4 | Length | **No cue longer than 2.4 s** except the three result stingers and the two loops; repeated cues 0.1-0.8 s | | High |
| 5 | Level | Files peak-normalised to **about -3 dBFS**; `gain` in `cues.json` places each cue in the mix (category loudness targets, K-weighted) | | Medium |
| 6 | Variation | 2-4 recorded variations for frequent cues, plus **&plusmn;0.2-0.6 semitone and &plusmn;0.5-1.5 dB** random per play | | High |
| 7 | Mix | Buses with fixed levels; heavy impacts **duck UI -6 dB and ambience -4 dB**; stingers duck everything -10 dB; **16 voices** max with per-cue caps and priorities | | Medium |
| 8 | Player settings | **Master / Effects / Ambience** sliders (defaults 80 / 90 / 50), saved per player; muted icon until the first click or key press | Separate UI slider | High |
| 9 | Formats | **Ogg Vorbis q4 + MP3 VBR**, 44.1 kHz, mono except `lose`, `draw` and the loops | Opus/WebM (not chosen: Safari support uneven) | Medium-high |
| 10 | Results | **Real trumpets** for a win, **one funeral-bell toll** for a loss, **a distant horn** for a draw | Kenney pizzicato jingles; a harpsichord jingle | Medium |
| 11 | Ambience | Optional **gentle wind** loop and a **campfire with wind** loop, 30 s each, roughly 20 dB under the effects at default settings | Gustier real wind, a louder fire | Low-medium |

The researcher cannot listen. Choices come from each recording's own description and rating, its waveform and spectrogram (sheets in `docs/analysis/research-audio/`), measured loudness and onsets, and the cue's meaning in the rules. **The owner should audition the mock page; every contender is one recipe line away** (see section 6).

---

## 1. Spec and rulings that drive the sound

- Owner direction (verbatim above): grit and viscerality, readable, not exaggerated. Interpreted as: impacts with weight but short; real, slightly rough recordings rather than polished library hits; no cartoon whooshes, sparkles or synth zaps; every event recognisable by its material and shape.
- References: *Into the Breach* (one clear, short sound per event, so a board full of effects stays legible); *Darkest Dungeon* and *Battle Brothers* (dry, physical, low-fantasy grit).
- Units are coins (research-art section 0: T2 3D coins, size ladder by tier). Selection, movement and death are therefore coin-on-table sounds; bigger tiers can be pitched down (section 5.6).
- Engine events (`packages/engine/README.md`, Events): one `unitMoved` per step, `unitDamaged` with a damage `breakdown` (base / addition / subtraction / reduction / defend steps), `abilityUsed`, `mineExploded`, `unitRevealed`, `buildingCaptured` / `buildingContested`, `unitRevived`, `decisionRequested`, `turnStarted` / `turnEnded`, `gameEnded`. The "Plays on" column of section 3 maps every cue to these. The breakdown lets the client choose `hit.blocked` (a reduction step from armour, Forcefield or Hex Ward) or `hit.defended` (a defend step) instead of a plain hit.
- Rulings that add cues: R26 Charge (`unit.move.charge`), R27 Group march (`march.step`), R28 approach boost (`boost.active`), R29 turn timer (`timer.warning`), R30 Siege (`siege.tick`), R31 Keep/Market (`capture.*`), R11 Baba Yaga's variants (`mend`, `hexward`, `cauldron.return`), R17/R18 Queso's revive and the reaction prompt (`revive`, `decision.prompt`).

---

## 2. Sources (verified 2026-10-24)

| Source | URL | Licence (exact) | Attribution | Used for | Verified |
|---|---|---|---|---|---|
| **Kenney - Impact Sounds 1.0** (130 files, 2019) | https://kenney.nl/assets/impact-sounds | Page: "License Creative Commons CC0". `License.txt`: "License: (Creative Commons Zero, CC0) ... Support us by crediting Kenney or www.kenney.nl (this is not mandatory)" | No (given) | 14 layers: body punches under the anvil, iron-plate thuds, small metal tinks, a pick strike, a sand crunch | Page, zip, `License.txt`, every file analysed |
| **Kenney - RPG Audio 1.0** (50, 2014) | https://kenney.nl/assets/rpg-audio | Page: CC0. `License.txt`: "Credit (Kenney or www.kenney.nl) would be nice but is not mandatory." | No (given) | Cloth rustles (stealth, mend), knife slices (assault), metal latch (mine) | Same |
| **Kenney - Casino Audio 1.1** (50, 2012) | https://kenney.nl/assets/casino-audio | Same wording | No (given) | Clay chip laid down (confirm, take-back), card slide (cancel) | Same |
| **Kenney - UI Audio 1.0** (50, 2012) | https://kenney.nl/assets/ui-audio | Same wording | No (given) | Mechanical switch (toggle) | Same |
| Kenney - Interface Sounds 1.0 (100, 2020) | https://kenney.nl/assets/interface-sounds | CC0 (page and `License.txt`) | No | **Contenders only**: mostly tonal synth blips (flatness about 0), the "clean/app" reference | Same |
| Kenney - Music Jingles 1.0 (85, 2014) | https://kenney.nl/assets/music-jingles | CC0 | No | **Contenders only**: pizzicato jingles PIZZI02 (rises 8 semitones), PIZZI01 (falls 8), PIZZI03 (level) for win/lose/draw | Same, pitch contour measured |
| Kenney - Boardgame Pack | https://kenney.nl/assets/boardgame-pack | CC0 (`license.txt`) | No | Not used: its `Bonus/` sounds appear to be the Casino Audio chip and card recordings again (same lengths and spectra, lower level) | Page, zip |
| **rubberduck - 100 CC0 metal and wood SFX** | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | "License(s): CC0" | No (given) | Knuckle knock (turn.end), small metal hit, spring (mine) | Page, zip, comments (a 2023 renderhub copy postdates this 2018 upload) |
| **rubberduck - 75 CC0 breaking / falling / hit sfx** | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | "License(s): CC0" ("i made 75 breaking, falling and hit sounds") | No (given) | Metal hits, rubble under the slam and the mine | Page, zip |
| **rubberduck - 80 CC0 RPG SFX** / **100 CC0 SFX** / **40 CC0 water, splash, slime** | https://opengameart.org/content/80-cc0-rpg-sfx, /100-cc0-sfx, /40-cc0-water-splash-slime-sfx | "License(s): CC0" | No (given) | Lock rattle (error), plop and bubble (cauldron) | Pages, zips |
| rubberduck - 25 CC0 bang / firework SFX | https://opengameart.org/content/25-cc0-bang-firework-sfx | CC0 | No | Contender only (cannon for mine.explode) | Page, zip |
| **artisticdude - RPG Sound Pack** / **Swishes Sound Pack** | https://opengameart.org/content/rpg-sound-pack, /swishes-sound-pack | "License(s): CC0" | No (given) | Bead rattle (hexward), heavy swish (savagery) | Pages, zips |
| **BigSoundBank** (Joseph Sardin and contributors) | https://bigsoundbank.com | Each page: "CC0 (public domain): Free and royalty-free". Licence page: "Creative Commons CC0 1.0 Universal ... Use, including for commercial purposes. Without any restrictions. Without asking permission." | No (given: "Additional sounds: Joseph SARDIN - BigSoundBank.com" is suggested) | 46 sounds (55 layer uses): coin taps and spin-downs, anvil, bells, war drum, horn, chains, bowls, gong, clock, winder, quenching hiss, flags, pages, iron gate, coins into a pot | 86 sound pages read; licence, author, sample rate, realism tag recorded in `licence-checks-bigsoundbank.json` |
| **Freesound** (21 authors in the shipped files) | https://freesound.org | Each page links "Creative Commons 0" (http://creativecommons.org/publicdomain/zero/1.0/) | No (given) | 23 sounds (32 layer uses): coin slide, stone chess move, wooden piece tap, combat whooshes, arrow, sword clashes, explosion, stone slam, bone crunch, grunt, heartbeat, dark magic, war drums, toll and funeral bells, trumpets, distant horn, wind and camp loops | 57 sound pages read (`licence-checks-freesound.json`); search filtered to CC0, then each page checked. Derivative works traced upstream (`licence-checks-freesound-upstream.json`) |
| Sonniss GDC Game Audio Bundles | https://sonniss.com/gdc-bundle-license/ | Licence v2.0 (27 Aug 2026): royalty-free, no attribution, but "may not distribute, publish, sub-license or otherwise supply the sound effects as sound effects to any other person ... whether the sound effects are unmodified, modified or re-designed", and AI training is "expressly prohibited" | No | **Rejected**: a web game serves each file individually (and the repo may be public), which is supplying them as sound effects; the bundles are also 20-30 GB | Licence page read |
| OpenGameArt in general | https://opengameart.org | Per asset (CC0, CC-BY, CC-BY-SA, GPL) | Varies | Only CC0 packs used | Pages read |

Rejected individual files: Freesound "Trumpet Fanfare" by bevibeldesign (#350428), labelled CC0 but built from n2p5's "fanfare1.flac" (#49477), which is **CC BY 4.0**; Kenney Sci-Fi Sounds and Digital Audio (off-style). Freesound files are the site's **HQ OGG previews** (88-176 kbps, 48 kHz), because the original download needs a login; the licence covers the sound, so the previews are CC0 too, and an account holder can swap in the originals without a licence change.

---

## 3. The cue list

68 required cues, 3 extra cues tied to engine events the brief did not list (`coin.flip`, `battle.start`, `attack.miss`), and 2 optional ambience loops: **73 cues, all covered**. "Gain" is the value in `cues.json`. Durations are the longest variation.

| Cue | Plays on | Chosen file(s) | Source | Var. | Dur. | Gain | Why it fits “gritty but readable” |
|---|---|---|---|---|---|---|---|
| `ui.hover` | client: pointer enters a button, square or unit (throttle to 1 per 60 ms) | `ui.hover` | Freesound “Moving piece on a boardgame” by zachrau | 1 | 0.09 s | 0.45 | A fingertip tick of a wooden piece on the board, low-passed so it sits under everything; one tiny transient that never tires. |
| `ui.click` | client: any button press without a more specific cue | `ui.click` | Freesound “chess_move_on_alabaster.wav” by mh2o | 1 | 0.09 s | 0.65 | A stone piece set on an alabaster board: a dry, solid tock with no ring, the board-game equivalent of a button press. |
| `ui.confirm` | client: an action is committed (move or target confirmed, confirmDeployment, dialog OK) | `ui.confirm` | Kenney - Casino Audio 1.1: Audio/chip-lay-3.ogg | 1 | 0.26 s | 1.00 | A clay chip laid down firmly: a short, mid-heavy clack that says 'committed' without a musical tone. |
| `ui.cancel` | client: action withdrawn, dialog cancelled, Escape or right-click | `ui.cancel` | Kenney - Casino Audio 1.1: Audio/card-slide-1.ogg | 1 | 0.22 s | 0.70 | A card slid back across felt: softer and lower-energy than confirm, so 'withdraw' is heard as the opposite gesture. |
| `ui.error` | a Rejection from validateIntent / submit for a player action (e.g. NOT_ENOUGH_AP, OUT_OF_RANGE) | `ui.error` | rubberduck - 80 CC0 RPG SFX: lock_02.ogg + Kenney - Impact Sounds 1.0: Audio/impactWood_medium_002.ogg | 1 | 0.33 s | 1.00 | A locked latch that will not give plus a dull knock: the one UI sound with a rattle, so 'not allowed' is unmistakable. |
| `ui.toggle` | client: a switch or segmented control (top / iso camera, settings) | `ui.toggle` | Kenney - UI Audio 1.0: Audio/switch17.ogg | 1 | 0.23 s | 0.82 | A real mechanical switch, short and mid-pitched; distinct from click (stone) and confirm (clay). |
| `ui.open` | client: a panel or dialog opens (unit card, army builder, log) | `ui.open` | BigSoundBank “Road map #2 (#2797)” by Joseph SARDIN | 1 | 0.55 s | 0.79 | A campaign map unfolded on the table: papery, brief, and in keeping with the parchment UI skin. |
| `ui.close` | client: a panel or dialog closes | `ui.close` | BigSoundBank “Closed book #2 (#1411)” by Joseph SARDIN | 1 | 0.23 s | 0.78 | A book shut on the table: a short, soft thump that closes the gesture ui.open started. |
| `lobby.joined` | session: the opponent joins the lobby (netcode layer, not an engine event) | `lobby.joined` | BigSoundBank “Small Bell #3 (#0294)” by GlaneurDeSons | 1 | 1.40 s | 0.43 | A small hand bell like a shop door bell: someone has walked in. |
| `lobby.ready` | readyChanged (ready: true), either seat | `lobby.ready` | BigSoundBank “Coin in cup #2 (#0340)” by DavidGreck | 1 | 0.39 s | 0.86 | A coin dropped into a cup: your stake is in. Keeps the coin motif from the first screen. |
| `turn.start.own` | turnStarted (seat = me) | `turn.start.own` | BigSoundBank “Bronze bell #1 (#2703)” by Pierre SIBANARCO | 1 | 1.41 s | 0.45 | One warm bronze bell strike: bright, short and pleasant, the only 'go' signal that is tonal. |
| `turn.start.opponent` | turnStarted (seat = opponent) | `turn.start.opponent` | BigSoundBank “Bass Tom, #1 (#2338)” by Joseph SARDIN | 1 | 0.65 s | 1.00 | A single low war-drum boom pitched down: ominous and clearly not your bell. |
| `turn.end` | turnEnded (seat = me), or the endTurn intent accepted | `turn.end` | rubberduck - 100 CC0 metal and wood SFX: wood_hit_07.ogg | 1 | 0.33 s | 0.66 | Two knuckle knocks on the table, the gesture players use to pass. |
| `timer.warning` | client turn timer (R29): once per second in the last 10 s of the turn time and again in the last 10 s of the bank | `timer.warning` | BigSoundBank “Tic Tac Mechanical Alarm Clock #3 (#2656)” by Joseph SARDIN | 1 | 0.32 s | 1.00 | One tick-tock of a mechanical clock; play once per second in the last 10 s, never as a loop. |
| `boost.active` | approach boost (R28): the first turnStarted of the battle while AP is doubled, and once more when the view's firstContactRound becomes set (the boost ends with that round) | `boost.active` | BigSoundBank “Horn #1 (#2520)” by Joseph SARDIN | 1 | 1.65 s | 0.72 | One real horn call at first contact: a battlefield signal everyone understands; used once per match. |
| `unit.select` | client: an own unit is selected | `unit.select-1`, `unit.select-2` | BigSoundBank “Coin spinning on a table #4 (#2700)” by Pierre SIBANARCO + BigSoundBank “Coin spinning on a table #5 (#2701)” by Pierre SIBANARCO | 2 | 0.21 s | 0.97 | A two-euro coin tapped on a wooden table (same recording session as the death sounds), nudged up a semitone: picking up your piece. |
| `unit.deselect` | client: selection cleared; unitPlaced / unitUnplaced during deployment (same files) | `unit.deselect-1`, `unit.deselect-2` | BigSoundBank “Coin spinning on a table #2 (#2698)” by Pierre SIBANARCO | 2 | 0.22 s | 0.70 | The same coin set back down, two semitones lower and quieter: the inverse of select. |
| `unit.move.step` | unitMoved (one event per step): space the plays 120-160 ms apart to match the token animation | `unit.move.step-1`, `unit.move.step-2`, `unit.move.step-3`, `unit.move.step-4` | Freesound “coin sliding on table.wav” by seanhealey | 4 | 0.34 s | 0.39 | One short slide of a large coin across a wooden table per square: metal-on-wood grit, under 0.4 s so steps stay countable. |
| `unit.move.charge` | the first unitMoved of a charge intent (R26); its other steps use unit.move.step at -3 dB | `unit.move.charge` | Freesound “coin sliding on table.wav” by seanhealey + BigSoundBank “Whoosh #8 (#1801)” by Joseph SARDIN | 1 | 0.48 s | 0.68 | A longer coin slide with a metal-tube whoosh on top: the move and the intent to strike in one gesture. |
| `march.step` | the unitMoved events of one groupMarch intent (R27): one play per march wave, not one per unit | `march.step-1`, `march.step-2`, `march.step-3` | Freesound “several coins on wood top” by nicoproson | 3 | 0.32 s | 0.60 | Several coins rattling across wood at once: a group step that is obviously plural; one sound per march, not per unit. |
| `unit.defend` | defendChanged (defending: true, reason: action) | `unit.defend` | BigSoundBank “Dumbbell, placed #2 (#3296)” by Joseph SARDIN + Kenney - Impact Sounds 1.0: Audio/impactPlate_light_003.ogg | 1 | 0.48 s | 0.87 | A heavy weight planted on a wooden floor with a faint plate ring: bracing behind a shield, low and short. |
| `attack.swing.light` | unitAttacked, melee, attacker Power below 10 | `attack.swing.light-1`, `attack.swing.light-2`, `attack.swing.light-3` | Freesound “Combat Whooshes” by EminYILDIRIM | 3 | 0.26 s | 0.97 | Short real combat whooshes (Zoom H6 recordings), high-passed: fast air, no metal, so the hit that follows carries the material. |
| `attack.swing.heavy` | unitAttacked, melee, attacker Power 10 or more, or a Size-2 attacker | `attack.swing.heavy-1`, `attack.swing.heavy-2`, `attack.swing.heavy-3` | BigSoundBank “Whoosh #10 (#1798)” by Joseph SARDIN + BigSoundBank “Whoosh #5 (#1797)” by Joseph SARDIN + BigSoundBank “Whoosh #8 (#1801)” by Joseph SARDIN | 3 | 0.49 s | 0.73 | Longer whooshes of a bamboo stick, a long wooden stick and a metal tube, two semitones down: weight you can hear before the blow lands. |
| `attack.ranged.shot` | unitAttacked from range 2 or more (Ranger), including a blind shot at a square | `attack.ranged.shot` | Freesound “Arrow Loose and Flyby” by saturdaysoundguy | 1 | 0.64 s | 1.00 | Arrow release and fly-by in 0.6 s: string snap first, then air, so it reads as a shot even off-screen. |
| `hit.metal.light` | unitDamaged with amount below 8 and no decisive reduction or defend step | `hit.metal.light-1`, `hit.metal.light-2`, `hit.metal.light-3` | rubberduck - 75 CC0 breaking / falling / hit sfx: bfh1_metal_hit_04.ogg + rubberduck - 75 CC0 breaking / falling / hit sfx: bfh1_metal_hit_06.ogg + rubberduck - 100 CC0 metal and wood SFX: metal_hit_03.ogg | 3 | 0.35 s | 0.92 | Real small metal hits from rubberduck's breaking/falling and metal packs: a coin edge chipped, bright but short (under 0.3 s). |
| `hit.metal.heavy` | unitDamaged with amount 8 or more (start the visual hit-stop on this sound) | `hit.metal.heavy-1`, `hit.metal.heavy-2`, `hit.metal.heavy-3` | BigSoundBank “Anvil #2 (#3590)” by Pablo BERGEL + Kenney - Impact Sounds 1.0: Audio/impactPunch_heavy_001.ogg + Kenney - Impact Sounds 1.0: Audio/impactPunch_heavy_003.ogg + BigSoundBank “Anvil #1 (#3589)” by Pablo BERGEL + Kenney - Impact Sounds 1.0: Audio/impactPunch_heavy_000.ogg | 3 | 0.61 s | 0.80 | A blacksmith's hammer on an anvil, pitched down two semitones, over a dull body punch: the forge clang gives grit, the punch gives weight. |
| `hit.blocked` | unitDamaged whose breakdown has a reduction step from Reinforced Armor, Forcefield or Hex Ward | `hit.blocked-1`, `hit.blocked-2` | Freesound “Sword_Clash (7).wav” by JohnBuhr + Freesound “Sword Hit” by qubodup | 2 | 0.31 s | 0.67 | A bright blade-on-blade ping with a fast decay: armour or a forcefield turned the blow (shape cue: high and thin, never low). |
| `hit.defended` | unitDamaged whose breakdown has a defend step | `hit.defended-1`, `hit.defended-2` | Kenney - Impact Sounds 1.0: Audio/impactPlate_heavy_000.ogg + BigSoundBank “Dumbbell, placed #3 (#3297)” by Joseph SARDIN + Kenney - Impact Sounds 1.0: Audio/impactPlate_heavy_004.ogg + BigSoundBank “Dumbbell, placed #2 (#3296)” by Joseph SARDIN | 2 | 0.56 s | 1.00 | A heavy iron-plate thud with a muffled weight under it: the blow landed on a braced shield (low and dull, the opposite of hit.blocked). |
| `unit.death` | unitDied for a unit below tier 50 (dummies included) | `unit.death-1`, `unit.death-2`, `unit.death-3` | BigSoundBank “Coin spinning on a table #1 (#2697)” by Pierre SIBANARCO + BigSoundBank “Coin spinning on a table #4 (#2700)” by Pierre SIBANARCO + BigSoundBank “Coin spinning on a table #6 (#2702)” by Pierre SIBANARCO | 3 | 0.78 s | 1.00 | The last second of a real two-euro coin spinning down on a wooden table: the wobble speeds up and the coin falls flat. A coin dying, not a body. |
| `unit.death.big` | unitDied for tier 50 and 100 units and commanders | `unit.death.big-1`, `unit.death.big-2` | BigSoundBank “Falling sheet steel bar #2 (#1772)” by Joseph SARDIN + BigSoundBank “Coin spinning on a table #5 (#2701)” by Pierre SIBANARCO + BigSoundBank “Falling sheet steel bar #4 (#1774)” by Joseph SARDIN + BigSoundBank “Coin spinning on a table #3 (#2699)” by Pierre SIBANARCO | 2 | 1.20 s | 1.00 | A sheet-steel bar crashing down, then a deeper coin settling three semitones lower: tier 50 and 100 fall like heavy coins. |
| `heal` | unitHealed from a source without its own cue (Queso's beacon, the Shared wounds recipient, Perseverance) | `heal` | BigSoundBank “Finger Cymbals #1 (#2274)” by Joseph SARDIN | 1 | 0.93 s | 0.46 | Finger cymbals: a soft, bright shimmer with a clean decay; the only 'sparkle' in the set, kept short. |
| `buff` | maxToughnessChanged with delta above 0, or a bonus that has no cue of its own | `buff` | BigSoundBank “Knife blade #1 (#2574)” by Joseph SARDIN | 1 | 0.36 s | 0.47 | A knife blade set ringing: steel being sharpened. Rising strength without a synth riser. |
| `debuff` | toughnessLost, or maxToughnessChanged with delta below 0 | `debuff` | BigSoundBank “Small chain #1 (#0355)” by DenisChardonnet | 1 | 0.69 s | 0.46 | A small chain dragged and pitched down: weighed down, shackled. |
| `reveal` | unitRevealed (adjacency, damage or detection); mineRevealed (same files) | `reveal` | BigSoundBank “Flag #2 (#1788)” by Joseph SARDIN + Kenney - Impact Sounds 1.0: Audio/impactMetal_light_001.ogg | 1 | 0.32 s | 1.00 | A cloak snapped away plus a faint metal glint: a hidden coin is suddenly on the table. |
| `stealth.on` | stealthChanged (stealthed: true), owner only | `stealth.on` | Kenney - RPG Audio 1.0: Audio/cloth2.ogg | 1 | 0.31 s | 0.60 | A soft cloth rustle, the quietest effect in the set: the Rogue pulls up the hood. |
| `stealth.off` | stealthChanged (stealthed: false) that is not caused by a reveal | `stealth.off` | Kenney - RPG Audio 1.0: Audio/cloth1.ogg | 1 | 0.51 s | 1.00 | A fuller cloth movement: the hood comes down by choice (reveal is the louder, involuntary version). |
| `assault` | the unitAttacked of rogue.assault (the Rogue's free strike) | `assault-1`, `assault-2` | Kenney - RPG Audio 1.0: Audio/knifeSlice.ogg + Kenney - RPG Audio 1.0: Audio/knifeSlice2.ogg | 2 | 0.42 s | 0.58 | A quick knife slice: the Rogue's free strike when an enemy steps adjacent, short and sharp. |
| `mine.place` | minePlaced (owner only) | `mine.place` | rubberduck - 100 CC0 metal and wood SFX: metal_spring_02.ogg + Kenney - RPG Audio 1.0: Audio/metalLatch.ogg | 1 | 0.45 s | 0.65 | A spring cocked, then a latch clicks: the Trip Mine is armed. Mechanical, quiet, owner-only. |
| `mine.explode` | mineExploded | `mine.explode` | Freesound “Explosion 1” by magnuswaker + rubberduck - 75 CC0 breaking / falling / hit sfx: bfh1_rock_falling_03.ogg | 1 | 1.18 s | 1.00 | A rough analogue explosion with stones falling after it: a dirty bang, 1.2 s, no cinematic tail. |
| `prototype.create` | unitCreated (createdBy: artificer.prototypeNoAcb) | `prototype.create` | BigSoundBank “Winder #7 (#2668)” by Joseph SARDIN + Kenney - Impact Sounds 1.0: Audio/impactPlate_light_002.ogg | 1 | 1.54 s | 1.00 | A clockwork key wound twice, then a plate set down: the Artificer's dummy is built from gears, not magic. |
| `forcefield.on` | areaCreated (abilityId: royalWizard.forcefield) | `forcefield.on` | BigSoundBank “Tibetan bowl struck #3 (#2554)” by Joseph SARDIN | 1 | 1.95 s | 0.90 | A struck Tibetan bowl blooming: a resonant metal hum that reads as a barrier forming, never a sci-fi zap. |
| `forcefield.off` | areaExpired of a Forcefield area | `forcefield.off` | BigSoundBank “Triangle muffled #1 (#1690)” by Joseph SARDIN | 1 | 0.77 s | 0.57 | A muffled triangle pitched down five semitones: a ring choked off, the barrier is gone. |
| `pajazon.cast` | abilityUsed / areaCreated (royalWizard.pajazon) | `pajazon.cast` | BigSoundBank “Whoosh #2 (#0573)” by Joseph SARDIN + BigSoundBank “Gong, strong #1 (#1483)” by Joseph SARDIN | 1 | 2.39 s | 0.54 | A deep sword whoosh into a gong bloom: an area spell lands on a 3x3 patch; the gong's spread reads as 'area'. |
| `pajazon.heal` | unitHealed (source: royalWizard.pajazon): one per unit, 80 ms apart | `pajazon.heal` | BigSoundBank “Chimes "butterfly" #1 (#2087)” by Joseph SARDIN | 1 | 0.51 s | 0.48 | A small chime cluster per healed unit at end of turn: quiet and distinct from the single-target heal cymbal. |
| `pajazon.damage` | unitDamaged (source: royalWizard.pajazon): replaces the hit sound, 80 ms apart | `pajazon.damage` | BigSoundBank “Quenching, cooling #4 (#1697)” by Joseph SARDIN | 1 | 0.27 s | 0.49 | Hot metal quenched in water: a short hiss per damaged enemy, the 'burn' tick. |
| `slam.impact` | abilityUsed (beast.forcefulSlam); its unitDamaged events use hit.metal.light at -6 dB | `slam.impact` | Freesound “big stone door suddenly slamming shut” by PaceHeart + rubberduck - 75 CC0 breaking / falling / hit sfx: bfh1_rock_breaking_02.ogg + Kenney - Impact Sounds 1.0: Audio/impactMining_000.ogg | 1 | 0.90 s | 1.00 | A stone door slammed shut with rubble and a pick strike under it: the Beast hits the ground, low and gritty. |
| `feast` | abilityUsed (beast.feast); the eaten unit's unitDied plays no death sound | `feast` | Freesound “Hard Candy / Bone Crunch” by clif_creates | 1 | 0.75 s | 1.00 | One hard crunch, recorded an inch from the mouth: the Beast eats a unit. Visceral, but a single bite, no gore loop. |
| `smite` | abilityUsed (emissary.smite); the splash hits use hit.metal.light | `smite` | Freesound “TollBell.wav” by daytripper + Kenney - Impact Sounds 1.0: Audio/impactPunch_heavy_001.ogg + BigSoundBank “Explosion #2 (#1808)” by Joseph SARDIN | 1 | 2.15 s | 1.00 | A huge bell struck over a body punch and a crack: holy force arriving, heavy and short (bell tail faded in 2.2 s). |
| `blessing` | abilityUsed (emissary.holyBlessing) | `blessing` | BigSoundBank “Chimes "Dream" #1 (#2079)” by Joseph SARDIN | 1 | 1.86 s | 0.41 | A cluster of dream chimes: bright and airy, the 'holy' counterpart to the heal cymbal. |
| `savagery` | abilityUsed (berserker.savagery), before its swing | `savagery` | Freesound “Swing grunt.mp3” by DeqstersLab + artisticdude - Swishes Sound Pack: swishes/swish-7.wav | 1 | 0.66 s | 0.61 | A warrior's effort grunt with a heavy swish on top: the Berserker's extra attack, human and visceral, under 0.8 s. |
| `shared.wounds` | abilityUsed (priestess.sharedWounds) | `shared.wounds` | Freesound “Heart Beating” by michorvath + BigSoundBank “Tibetan Bowl Struck #1 (#1110)” by Joseph SARDIN | 1 | 0.92 s | 0.62 | Two heartbeats with a faint bowl under them: life passed from one unit to another. Saturated so the beat survives phone speakers. |
| `julio` | abilityUsed (juliomancer.julioVernification) | `julio` | Freesound “Dark Magic Loop” by qubodup + BigSoundBank “Bones cracking #2 (#1408)” by Joseph SARDIN | 1 | 1.20 s | 0.72 | A dark energy pulse with a bone crack in it: the Juliomancer spends an own unit as a weapon. |
| `command.aura` | scourge.commandAura grants its extra action (abilityNote), at most once per turn | `command.aura` | Freesound “warriordrums.wav” by Sclolex | 1 | 0.62 s | 0.67 | Two war-drum hits: the Scourge drives its troops (an extra action), martial and short. |
| `mend` | abilityUsed (babaYaga.mend) | `mend` | Kenney - RPG Audio 1.0: Audio/cloth3.ogg + Kenney - Impact Sounds 1.0: Audio/impactMetal_light_002.ogg | 1 | 0.47 s | 0.81 | A cloth wipe, then a clean tink: Baba Yaga polishes a white coin back to full. |
| `hexward` | a unit gains the babaYaga.hexWard aura (maxToughnessChanged with that source), at most once per turn | `hexward` | artisticdude - RPG Sound Pack: RPG Sound Pack/inventory/beads.wav + BigSoundBank “Tibetan Bowl Struck #1 (#1110)” by Joseph SARDIN | 1 | 1.17 s | 1.00 | A rattle of beads over a low bowl hum: a witch's charm, not an energy shield. |
| `cauldron.return` | unitRevived after a babaYaga.cauldron decision | `cauldron.return` | rubberduck - 40 CC0 water / splash / slime SFX: bubble_02.ogg + rubberduck - 100 CC0 SFX: plop_02.ogg + BigSoundBank “Coin spinning on a table #5 (#2701)” by Pierre SIBANARCO | 1 | 0.60 s | 0.67 | A bubble, a plop and a coin landing: the white unit climbs out of the cauldron next to Baba Yaga. |
| `revive` | unitRevived (queso.revive) | `revive` | BigSoundBank “Coin spinning on a table #5 (#2701)” by Pierre SIBANARCO + BigSoundBank “Bronze bell #5 (#2707)” by Pierre SIBANARCO | 1 | 1.05 s | 0.88 | The coin-death sound played backwards into a bronze bell: the fall is undone. The inverse of unit.death, so it reads instantly. |
| `weakness` | unitDamaged whose breakdown has Ratasius' weakness step (at most once per turn per unit) | `weakness` | BigSoundBank “Medium Chain #1 (#0360)” by DenisChardonnet | 1 | 1.01 s | 0.39 | A heavier chain, pitched down and dulled: Ratasius' aura shackles adjacent enemies (heavier than debuff). |
| `capture.keep` | buildingCaptured (building: keep) | `capture.keep` | BigSoundBank “Metal barrier: Closure #1 (#2358)” by Joseph SARDIN | 1 | 1.16 s | 0.84 | A heavy iron barrier swinging shut with a slam: the Keep's gate is yours. |
| `capture.market` | buildingCaptured (building: market) | `capture.market` | BigSoundBank “Coins #2 (#0194)” by Joseph SARDIN | 1 | 0.74 s | 1.00 | A handful of coins poured into a terracotta pot: the Market pays you. |
| `building.contested` | buildingContested | `building.contested` | Freesound “Sword clash 1.wav” by spycrah | 1 | 0.67 s | 0.34 | Two blades crossing: both sides hold units in the capture ring. |
| `siege.tick` | the view's siegeTurns counter (R30) goes up at the start of an own turn while both buildings are held | `siege.tick` | BigSoundBank “Grandfather clock, hour #1 (#1569)” by Joseph SARDIN | 1 | 1.12 s | 0.91 | One strike of a grandfather clock's hour bell: the Siege counter advances, time is running out. |
| `win` | gameEnded, result: this seat won | `win` | Freesound “Real Trumpet Fanfare 2” by qubodup | 1 | 8.74 s | 1.00 | Real military trumpets (public-domain US Marine Corps footage, cleaned by qubodup): a ceremony, not a chiptune. |
| `lose` | gameEnded, result: this seat lost (also resign) | `lose` | Freesound “funeral bell-cloche funèbre.wav” by aoristos | 1 | 5.77 s | 0.58 | One toll of a mediaeval church's funeral bell: defeat as a fact, without a sad-trombone joke. |
| `draw` | gameEnded, result: draw (accepted draw offer) | `draw` | Freesound “Distant War Horn.wav” by DeVern | 1 | 4.78 s | 0.45 | A distant war horn fading: the armies withdraw, no winner. |
| `takeback.request` | takebackRequested | `takeback.request` | BigSoundBank “Great Page that Turns #1 (#0362)” by DenisChardonnet | 1 | 0.94 s | 0.88 | A large page turned back: asking to rewind one action. |
| `takeback.accept` | takebackApplied | `takeback.accept` | BigSoundBank “Great page that turns #1 (#0363)” by DenisChardonnet + Kenney - Casino Audio 1.1: Audio/chip-lay-3.ogg | 1 | 0.71 s | 1.00 | A page turned and a chip put back on its square: the rewind is granted. |
| `decision.prompt` | decisionRequested (seat = me): Queso revive or Cauldron return prompt | `decision.prompt` | BigSoundBank “Small Bell #1 (#0292)” by GlaneurDeSons | 1 | 0.94 s | 0.48 | A small hand bell: a reaction prompt (Queso revive, Cauldron return) needs an answer within 15 s. |
| `coin.flip` (extra) | coinFlipped (first player) | `coin.flip` | Freesound “coin flip.wav” by Raventhornn | 1 | 1.03 s | 1.00 | A real coin flicked into the air and caught: the first-player coin flip (coinFlipped). |
| `battle.start` (extra) | battleStarted | `battle.start` | Freesound “warriordrums.wav” by Sclolex | 1 | 2.25 s | 0.81 | A roll of war drums when both deployments are confirmed (battleStarted). |
| `attack.miss` (extra) | attackMissed (blind shot at an empty square) | `attack.miss` | Kenney - Impact Sounds 1.0: Audio/footstep_snow_000.ogg + Kenney - Impact Sounds 1.0: Audio/impactSoft_medium_002.ogg | 1 | 0.20 s | 0.78 | A blind shot that lands in empty sand (attackMissed): a dry crunch with no metal. |
| `ambient.wind` (optional) | menus, lobby and battle background (loop) | `ambient.wind` | Freesound “Looping Gentle Wind Ambience on an Open Desert Plain.wav” by dhallcomposer | 1 | 30.00 s | 0.15 | A steady, gentle wind over an open plain, designed to loop: fills silence without gusts that could mask a cue. |
| `ambient.camp` (optional) | battle background under the wind (loop) | `ambient.camp` | Freesound “Campfire deer camp - adding kindling - med wind - part 4.wav” by Ambient-X | 1 | 30.00 s | 1.00 | A campfire with a medium wind, recorded at a hunting camp: the war camp around the sand table. |

Aliases (no extra files): `unitPlaced` / `unitUnplaced` in deployment use `unit.deselect`; `mineRevealed` uses `reveal`; the non-first steps of a Charge use `unit.move.step` at -3 dB; Smite's splash and Forceful slam's hits use `hit.metal.light` (slam at -6 dB); the unit eaten by Feast plays no death sound; draw offers and declines use `ui.open` / `ui.cancel`; resign uses `lose`.

**Highest-risk picks to audition first:** `unit.move.step` (slide vs the wooden hop contender), `unit.death` (a spin-down tail with no impact of its own: it relies on the hit before it), `revive` (a reversed recording), `shared.wounds` (saturated heartbeat), `ambient.camp` (recorded at a hunting camp; check for distant modern noise), `attack.ranged.shot` (a quiet body after a loud release; 4.5 dB under its loudness target even after limiting).

---

## 4. Contenders and why they are not the default

Every contender is rendered and playable on the mock page (letters A and B on each card).

| Cue | Contender | Why it is not the default |
|---|---|---|
| `ui.hover` | A: Kenney UI Audio rollover2 | Clean mechanical tick; reads as a computer UI rather than a table. |
| `ui.hover` | B: Kenney Interface Sounds tick_002 | Shortest and most neutral; slightly digital. |
| `ui.click` | A: Kenney UI Audio click3 | Plastic switch click; precise but generic. |
| `ui.click` | B: Kenney Interface Sounds click_001 | Softer, rounder click; less tactile. |
| `ui.confirm` | A: Kenney UI Audio switch22 | A solid toggle; firm but reads as hardware. |
| `ui.confirm` | B: Kenney Interface Sounds confirmation_001 | Tonal synth blip, kept as the clean/arcade reference; off-style for low fantasy. |
| `ui.cancel` | A: Kenney Interface Sounds back_002 | Short dull tone; clear but synthetic. |
| `ui.cancel` | B: Kenney RPG Audio bookFlip3 | Page flick; tactile but brighter than a cancel should be. |
| `ui.error` | A: Kenney Interface Sounds error_006 | Low tonal bonk; very readable, clearly synthetic. |
| `ui.error` | B: Kenney RPG Audio metalLatch | Bright latch snap alone; readable but close to mine.place. |
| `ui.toggle` | A: Kenney Interface Sounds toggle_002 | Clean and short; slightly digital. |
| `ui.toggle` | B: BigSoundBank thermostat click | Tiny real click; may be too quiet next to other UI. |
| `ui.open` | A: Kenney RPG Audio bookOpen | Book cover opening; tactile but very soft. |
| `ui.open` | B: Kenney Casino Audio cards-pack-open-2 | Card box opening; papery, a little busy. |
| `ui.close` | A: Kenney RPG Audio bookClose | Same idea, punchier and drier. |
| `ui.close` | B: Kenney Interface Sounds close_002 | Airy swoosh; reads as an app. |
| `lobby.joined` | A: BigSoundBank bronze bell #8 | Brighter bronze bell; more ceremonial than 'arrival'. |
| `lobby.joined` | B: Kenney RPG Audio doorOpen_1 | A creaking door; literal, but long and a bit spooky. |
| `lobby.ready` | A: Kenney Casino Audio chips-stack-2 | Chips stacked; tactile, but clay rather than metal. |
| `lobby.ready` | B: BigSoundBank pencil signature | Signing the muster roll; characterful but long and quiet. |
| `turn.start.own` | A: BigSoundBank metallophone G (Idea #1) | Clean single note; clearer but more cartoon. |
| `turn.start.own` | B: Kenney Impact impactBell_heavy_002 | Darker, shorter bell hit; less welcoming. |
| `turn.start.opponent` | A: Freesound warriordrums (two hits) | Two hits of a war drum; more urgent, can feel busy every turn. |
| `turn.start.opponent` | B: Kenney Impact impactPlate_heavy_004 | Iron plate thud; heavier, less musical. |
| `turn.end` | A: Kenney Impact impactWood_medium_000 | Single knock; shorter, less of a gesture. |
| `turn.end` | B: BigSoundBank closed book #1 | Ledger shut; final but close to ui.close. |
| `timer.warning` | A: Kenney Interface Sounds tick_002 + tick_004 | Digital double tick; clean but app-like. |
| `timer.warning` | B: BigSoundBank single tick | Just the louder tick; less recognisable as a clock. |
| `boost.active` | A: Freesound war horn (plastic pipe) | Rougher and longer; more 'ancient', more reverb. |
| `boost.active` | B: Freesound distant war horn | Distant and lonely; better as a mood than a signal. |
| `unit.select` | A: Freesound coin flip ping | Brighter, ringing ping; more 'coin' but more cartoon. |
| `unit.select` | B: Kenney RPG Audio handleCoins2 | Small coin jingle; reads as money, not a piece. |
| `unit.deselect` | A: Kenney Casino Audio chip-lay-1 | Clay chip placed; tactile but not metal. |
| `unit.deselect` | B: Stone piece, pitched down | The ui.click tock lowered; consistent but not a coin. |
| `unit.move.step` | A: BigSoundBank coin pushed on the table | Same session as select/death (most cohesive); grainier 'spin-scrape' rather than a slide. |
| `unit.move.step` | B: Freesound wooden piece hop | A wooden 'tok' per square; the clearest count, but wood rather than metal. |
| `unit.move.charge` | A: Slide + combat whoosh | Punchier swing layer; risks reading as an attack on its own. |
| `unit.move.charge` | B: BigSoundBank metal-tube whoosh alone | Clean rush; loses the coin-on-table identity. |
| `march.step` | A: Freesound pieces falling on a wood table | Denser clatter; heavier, can sound like a spill. |
| `march.step` | B: Kenney Casino Audio chips-handle-3 | Chips shuffled in hand; clay, lighter. |
| `unit.defend` | A: rubberduck metal slam | Louder metal slam; reads as an impact. |
| `unit.defend` | B: Kenney Impact impactPlate_medium_001 | Plate clank alone; thinner. |
| `attack.swing.light` | A: artisticdude swish-11 | Thin stick swish; very short, slightly toy-like. |
| `attack.swing.light` | B: Freesound metallic whoosh | Adds a blade ring to the swing; can blur with the hit. |
| `attack.swing.heavy` | A: artisticdude heavy swishes | Two heavy swishes layered; shorter and duller. |
| `attack.swing.heavy` | B: Combat whoosh pitched down | Same family as light swings; consistent but less distinct. |
| `attack.ranged.shot` | A: Freesound bow release (spatula foley) | Just the release thump; needs a hit to read, low rumble. |
| `attack.ranged.shot` | B: Freesound bow release, second take | Second take of the same foley; rounder. |
| `hit.metal.light` | A: Kenney Impact impactMetal_light_001 | Cleaner, more hi-fi tink; less grit. |
| `hit.metal.light` | B: Freesound metallic hit (Tascam) | Rounder hit with a longer ring. |
| `hit.metal.heavy` | A: Freesound anvil hit 2 (single) | Brighter anvil alone; ringier, less body. |
| `hit.metal.heavy` | B: Kenney metal + plate impacts | Clean game-library clang; punchy but polished. |
| `hit.blocked` | A: Freesound composite sword clash | Fuller clash with a low thump; reads as a hit, not a block. |
| `hit.blocked` | B: Kenney metal tink pitched up | Clean and tiny; less satisfying. |
| `hit.defended` | A: rubberduck wood slam | Wooden shield thump; warmer, less armour. |
| `hit.defended` | B: rubberduck low hit | Very low thud; can vanish on laptop speakers. |
| `unit.death` | A: Freesound coin dropped on table (bounces) | A coin bouncing to rest; lively, more 'dropped' than 'killed', reverby. |
| `unit.death` | B: rubberduck metal falling | Short metal clatter; generic. |
| `unit.death.big` | A: Coin bounce pitched down five semitones | A giant coin bouncing; readable, slightly comic. |
| `unit.death.big` | B: rubberduck metal falling (long) | Long metal clatter without the coin tail. |
| `heal` | A: BigSoundBank small bell #1 | Higher, clearer bell; competes with decision.prompt. |
| `heal` | B: BigSoundBank butterfly chimes | Cluster of chimes; prettier, more magical. |
| `buff` | A: BigSoundBank knife scraped on stone | Whetstone scrape; grittier, less tonal. |
| `buff` | B: artisticdude sword unsheathe | Blade drawn; reads as 'ready', not 'stronger'. |
| `debuff` | A: BigSoundBank medium chain #2 | Heavier chain; overlaps with weakness. |
| `debuff` | B: Kenney Interface Sounds error_005 | Low synth drop; clear, off-style. |
| `reveal` | A: Kenney RPG Audio clothBelt (snap) | Belt and cloth snap; busier. |
| `reveal` | B: Kenney Casino cards-pack-take-out-1 | Card pulled from a pack; papery, too light. |
| `stealth.on` | A: Kenney RPG Audio cloth3 | Duller rustle; can disappear. |
| `stealth.on` | B: BigSoundBank flag #5 (normalised) | Fabric shake; larger than a hood. |
| `stealth.off` | A: artisticdude heavy cloth | Heavier fabric; reads as armour. |
| `stealth.off` | B: BigSoundBank flag #1 snap | Sharper snap; too close to reveal. |
| `assault` | A: Freesound slicing through flesh | Wetter and longer; more visceral than the brief asks. |
| `assault` | B: Freesound deep cut | Compact slash; close to the swing layer. |
| `mine.place` | A: Freesound trap switch | A single trap click; very readable, less character. |
| `mine.place` | B: Kenney RPG Audio metalClick | Double metal click; generic. |
| `mine.explode` | A: BigSoundBank bird-scarer bang + rubble | Real outdoor bang at 10 m; sharper and shorter. |
| `mine.explode` | B: rubberduck cannon | Firework cannon; boomy, reads as artillery. |
| `prototype.create` | A: BigSoundBank manual winch | Bigger ratchet; heavier and slower. |
| `prototype.create` | B: rubberduck tools | Tool rattle; reads as repair. |
| `forcefield.on` | A: Freesound singing bowl strike | Purer tone; more meditative. |
| `forcefield.on` | B: BigSoundBank Tibetan bowl #1 | Larger bowl; longer, busier ring. |
| `forcefield.off` | A: Reversed bowl (inhale) | The forcefield.on bowl reversed; elegant, but swells instead of stopping. |
| `forcefield.off` | B: Kenney Interface Sounds minimize_008 | Synth drop; clear, off-style. |
| `pajazon.cast` | A: Freesound toll bell | Huge single bell; heavier, closer to smite. |
| `pajazon.cast` | B: rubberduck spell_01 | Short designed spell; generic fantasy. |
| `pajazon.heal` | A: BigSoundBank small bell (short) | Bell ping; competes with decision.prompt. |
| `pajazon.heal` | B: Kenney Interface Sounds maximize_007 | Synth up-blip; off-style. |
| `pajazon.damage` | A: BigSoundBank quenching #5 | Longer hiss; busier when many units tick. |
| `pajazon.damage` | B: rubberduck spell_fire_07 | Fire whoosh; reads as a cast. |
| `slam.impact` | A: Kenney mining + punch | Punchier and cleaner; less rubble. |
| `slam.impact` | B: BigSoundBank body fall | A body hitting tiles; human, not monstrous. |
| `feast` | A: Freesound biting on bones | Wetter, more horror. |
| `feast` | B: BigSoundBank celery 'bone' foley | Bone snap; reads as injury, not eating. |
| `smite` | A: BigSoundBank gong + punch | Gong instead of bell; brassier, closer to Pajazon. |
| `smite` | B: Kenney Impact impactBell_heavy_001 | Clean bell hit; small for a tier-100 ability. |
| `blessing` | A: BigSoundBank Nepalese cymbal | Single long shimmer; calmer. |
| `blessing` | B: rubberduck bell_03 | Bright bell; closer to turn.start.own. |
| `savagery` | A: Freesound effort noise + swish | Shorter grunt; less aggressive. |
| `savagery` | B: artisticdude guttural beast | A growl; reads as a monster, not a berserker. |
| `shared.wounds` | A: Freesound single heartbeat (driven) | One beat; mostly sub-bass even after drive. |
| `shared.wounds` | B: Heartbeat without drive | Natural, but nearly inaudible on small speakers. |
| `julio` | A: rubberduck spell_02 | Bright designed spell; less dark. |
| `julio` | B: artisticdude magic1 | Mouth-made magic; charming, a bit cartoon. |
| `command.aura` | A: BigSoundBank bass tom twice | Cleaner drum; less 'war'. |
| `command.aura` | B: Kenney punches twice | Body thumps; reads as hits. |
| `mend` | A: BigSoundBank small bell #3 | Bell alone; reads as heal. |
| `mend` | B: artisticdude light armour | Armour jingle; reads as equip. |
| `hexward` | A: BigSoundBank small chain | Chain rattle; reads as debuff. |
| `hexward` | B: Freesound dark magic loop | Darker energy; overlaps with julio. |
| `cauldron.return` | A: Freesound bubbling | Bubbling only; no 'return' beat. |
| `cauldron.return` | B: Freesound magic cauldron | Bubbling with a magic swell; long. |
| `revive` | A: Dream chimes + coin tap | Pretty and clear, but does not mirror the death. |
| `revive` | B: Kenney Interface Sounds maximize_005 | Synth rise; off-style. |
| `weakness` | A: rubberduck chain_03 | Bright chain; lighter. |
| `weakness` | B: Kenney Interface Sounds error_005 | Synth drop; off-style. |
| `capture.keep` | A: rubberduck metal + wood slam | Shorter door slam; less weight. |
| `capture.keep` | B: Freesound deep metal clang | Deep clang; abstract. |
| `capture.market` | A: Kenney RPG Audio handleCoins | Coins in hand; smaller. |
| `capture.market` | B: Freesound coins on a wood top | Coins scattered on wood; overlaps with march.step. |
| `building.contested` | A: Freesound composite sword clash | Shorter clash with a low thump; also a block contender. |
| `building.contested` | B: BigSoundBank billhook on stone | Scrape; tense but unclear. |
| `siege.tick` | A: Freesound toll bell (short) | Much bigger bell; overlaps with smite. |
| `siege.tick` | B: Kenney Impact impactBell_heavy_000 | Clean bell hit; small. |
| `win` | A: Kenney Music Jingles PIZZI02 (rising) | Short plucked rise; clean, light-hearted. |
| `win` | B: Freesound WinHarpsichord | Courtly harpsichord jingle; elegant, small. |
| `lose` | A: Kenney Music Jingles PIZZI01 (falling) | Short plucked fall; clear, cartoonish. |
| `lose` | B: Freesound distant war horn (second call) | A lonely horn; reads as retreat. |
| `draw` | A: Kenney Music Jingles PIZZI03 (level) | Short plucked phrase without a rise or fall. |
| `draw` | B: BigSoundBank horn #3 pitched down | Close horn, lower; clearer but less 'distance'. |
| `takeback.request` | A: Kenney RPG Audio bookFlip2 | Quick page flick; lighter. |
| `takeback.request` | B: Kenney Casino card-slide-7 | Card slid; reads as cancel. |
| `takeback.accept` | A: Kenney RPG Audio bookPlace1 | Book set down; final but abrupt. |
| `takeback.accept` | B: Kenney Casino card-place-1 | Card placed; light. |
| `decision.prompt` | A: BigSoundBank metallophone G | Clean note; more 'hint' than 'answer me'. |
| `decision.prompt` | B: Kenney Interface Sounds question_001 | Synth question blip; off-style. |
| `coin.flip` | A: Freesound tossed coin | Long ring; very quiet source. |
| `coin.flip` | B: Freesound flip coin (bright) | Bright single ring; more cartoon. |
| `battle.start` | A: Freesound war horn | Horn instead of drums; overlaps with boost.active. |
| `battle.start` | B: BigSoundBank horn #2 + bass tom | Cleaner, shorter. |
| `attack.miss` | A: Kenney grass footstep | Softer crunch. |
| `attack.miss` | B: rubberduck gravel | Small stones; brighter. |
| `ambient.wind` | A: BigSoundBank wind through a window | Real wind with whistles; gustier (14 dB swings), can mask cues. |
| `ambient.wind` | B: BigSoundBank strong wind in a pine | Outdoor and dramatic; too loud a mood for a planning table. |
| `ambient.camp` | A: Freesound fire ambience | Fire only, quiet and steady; less 'camp'. |
| `ambient.camp` | B: BigSoundBank big branching fire | Big crackling fire; louder pops (15 dB range). |

---

## 5. Mixing guidance

### 5.1 Buses, gains and the player's settings

Output level = `gain` (per cue) &times; bus level &times; the player's **Effects** slider (or **Ambience** for the ambient bus) &times; **Master**. Defaults: master 0.8, effects 0.9, ambience 0.5, saved per player (local storage is fine for this convenience). Put a `DynamicsCompressorNode` on the master bus as a safety limiter (threshold -6 dBFS, knee 6, ratio 4, attack 3 ms, release 120 ms) so that a Smite with splash and three deaths cannot clip.

| Bus | Level | Pitch jitter | Level jitter | Voices per cue | Priority | Min. interval |
|---|---|---|---|---|---|---|
| `ui` | 0.80 | &plusmn;0.3 st | &plusmn;1.0 dB | 2 | 20 | 40 ms |
| `turn` | 0.90 | &plusmn;0.0 st | &plusmn;0.0 dB | 1 | 70 | 250 ms |
| `unit` | 0.90 | &plusmn;0.5 st | &plusmn;1.5 dB | 3 | 35 | 50 ms |
| `attack` | 0.90 | &plusmn;0.6 st | &plusmn;1.5 dB | 3 | 50 | 40 ms |
| `hit` | 1.00 | &plusmn;0.5 st | &plusmn;1.5 dB | 4 | 60 | 30 ms |
| `death` | 1.00 | &plusmn;0.4 st | &plusmn;1.0 dB | 3 | 80 | 60 ms |
| `effect` | 0.90 | &plusmn;0.3 st | &plusmn;1.0 dB | 2 | 55 | 60 ms |
| `big` | 1.00 | &plusmn;0.2 st | &plusmn;0.5 dB | 1 | 90 | 150 ms |
| `objective` | 0.90 | &plusmn;0.0 st | &plusmn;0.0 dB | 1 | 75 | 300 ms |
| `stinger` | 0.90 | &plusmn;0.0 st | &plusmn;0.0 dB | 1 | 100 | 1000 ms |
| `ambient` | 0.70 | &plusmn;0.0 st | &plusmn;0.0 dB | 2 | 0 | 0 ms |

Gains come from measured loudness: the maximum 100 ms K-weighted loudness of each file (BS.1770 pre-filter) against a category target: interface -21 to -24 LUFS (hover -29), turn signals -15 to -21, units -19 to -23, attacks -18 to -21, hits -14 (heavy) to -17, deaths -13 to -15, abilities -16 to -23, the mine, Forceful slam and Smite -12, objectives -15 to -16, results -13 to -15; loops use integrated loudness (-34 / -33). Where a file could not reach its target at gain 1.0, a peak limiter (2.5-6 dB) was applied in the build; the remaining shortfalls are 0.5-4.5 dB (listed in `build-report.json`). Treat the numbers as a starting mix to tune in the game.

### 5.2 Ducking

- Heavy impacts (`hit.metal.heavy`, `unit.death.big`, `mine.explode`, `slam.impact`, `smite`) duck the **UI bus -6 dB** and **ambience -4 dB**: attack 10 ms, hold 120 ms, release 350 ms. This keeps a hover tick from stepping on the moment and lets the board breathe.
- Result stingers (`win`, `lose`, `draw`) duck every other bus -10 dB and ambience -8 dB while they play, release 1.2 s.
- Turn signals and the reaction prompt duck ambience -3 dB for about 0.4 s.
- Sync: start the visual hit-stop (40-60 ms) and the small camera shake on the first sample of `hit.metal.heavy`; for `unit.death.big` start the token's fall on the steel crash and the settle on the coin tail at +0.22 s.

### 5.3 Voices, priorities and spacing

- At most **16 voices**. Per-cue caps are `maxVoices` in `cues.json` (for example move steps 3, heavy hits 2, big abilities 1). When full, drop a new play whose `priority` is lower than every playing voice; otherwise stop the oldest lowest-priority voice. Results (100) and big abilities (90) win over hits (60) and UI (10-60).
- `minIntervalMs` drops repeats of one cue that arrive sooner (hover 60 ms, steps 50 ms, aura cues 1.5-2 s).
- Step events arrive as a batch: schedule the step sounds 120-160 ms apart to match the token animation, not all at once. Group march: one `march.step` per wave, not per unit.
- Area effects: Pajazon heals and damage ticks and Smite's splash play per unit but staggered 60-80 ms and capped at 3 voices, so five ticks read as a ripple, not a wall.

### 5.4 Variation per play

Pick variations round-robin with no immediate repeat, then add a random pitch offset (`pitchJitterSemitones`, played as `playbackRate = 2^(semitones/12)` so pitch and speed change together like tape) and a random level offset (`gainJitterDb`). Defaults: hits &plusmn;0.5 st / &plusmn;1.5 dB, swings &plusmn;0.6 st / &plusmn;1.5 dB, coin sounds &plusmn;0.5 st, UI &plusmn;0.3 st, turn signals, objectives and results none.

### 5.5 Unlock, formats and loops

- Browsers start audio suspended. Create one `AudioContext` on load, call `resume()` inside the first `pointerdown` or `keydown`, decode the cue files after that, and show the speaker icon as muted until it runs.
- Pick the `.ogg` list where `canPlayType('audio/ogg; codecs="vorbis"')` is non-empty, else the parallel `.mp3` list (Safari). MP3 can add up to about 25 ms of encoder delay at the start of a file where the decoder ignores the LAME header; harmless for one-shots.
- Loops (`ambient.*`) have a 3 s equal-power crossfade baked in. Play them with `AudioBufferSourceNode.loop = true` and `loopStart = 0`, `loopEnd = 30.0` from `cues.json` (`loop.end`), which also hides any MP3 padding.
- Decode everything up front (about 4 MB in either format) or lazily per screen; the lobby and UI sounds are under 200 KB together.

### 5.6 Option: pitch by tier

The art direction gives coins a size ladder by tier. Mirroring it in sound is cheap and readable: play `unit.select`, `unit.deselect`, `unit.move.step` and `unit.death` at +2 semitones for tier 1, +1 for tier 2, 0 for tiers 5-10, -1 for tier 20 and -2 for tier 50 (`unit.death.big` already covers 50 and 100). Not applied in the files, so it can be switched off.

---

## 6. How the files were made (reproducible)

1. Downloaded every pack zip and every candidate sound into its own folder (`audio-dl/<source>/`), with the scripts kept apart and Python run with `-I`; the downloads were only ever decoded by ffmpeg, never executed.
2. Measured every candidate (`analyze.py`, `onsets.py`, `segments.py`, `pitchtrend.py`) and drew envelope + spectrogram strips (`plot.py`) to find clean takes, onsets and the end of each coin spin.
3. `build.py` renders `recipe.txt` (a plain data file): per cue, the layers with source, start, length, fades, pitch (resampling), filters, saturation and delay; then optional gate or limiter, peak normalisation to -3 dBFS, Ogg Vorbis q4 and MP3 VBR q2 (ambience q5) encoding, a second pass if the codec moved the peak, and loudness measurement. Contenders render the same way to MP3.
4. `gen.py` writes `cues.json`, the manifest entries, the attribution section, the mock page and the tables in this document from the build report and `gen_meta.txt` (events and playback settings).
5. Tools: ffmpeg 9.0.2 (libvorbis, libmp3lame), Python 3.12 with numpy and scipy, Pillow for the sheets.

To swap a contender in: copy its `layers` from the cue's `contenders` list into `variants` in `recipe.txt`, rerun `build.py` then `gen.py`, and copy the outputs. The source URLs are in `cues.json` and `build-report.json`.

---

## 7. Gaps and open questions

1. **Not auditioned by ear.** See section 0. The owner's listening pass on the mock page is the real acceptance test; any pick can be swapped for its contenders.
2. **Freesound previews** rather than original files (section 2). Quality is adequate for game playback; originals need a free account.
3. **Loudness targets are estimates**; tune the bus levels in the running game, with the real board animation.
4. **No music.** The brief covers sound effects; win, lose and draw are short stingers, not tracks.
5. **Passives without their own cue**: Line Formation, Fierce attacker, Perseverance, Strong aura, Mind's Eye, Mad inventor, Holy Fervor, Tribute, Trill's toughness, Kulega's Fine Print, Sabrina's prices and Ratasius' detection reuse `heal`, `buff`, `debuff` or play nothing. Say which of them deserve a signature sound.
6. **Commander death** uses `unit.death.big`, then the result stinger. A dedicated commander-fall cue is possible if the owner wants the end to land harder.
7. **Field-recording noise**: the hunting-camp loop and the funeral-bell toll carry quiet background sound (birds, a distant room tone); they are 30 dB under the effects but worth a listen.
8. **Safari and Ogg**: the MP3 fallback covers Safari; Opus/WebM would halve the size but is not chosen while Safari support stays uneven.
9. **Coin realism**: the coin recordings are a modern two-euro coin and a large coin on a wooden table. On a sand-table board, a slightly drier, grainier slide (sand) is the next thing to try if the owner wants more grit; none of the free CC0 libraries checked had a convincing coin-on-sand recording.
