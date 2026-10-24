# VFX and motion research: impact style, UI motion, per-event effects, animation queue

Research step for visual effects, animation and sound cues. It builds on the adopted art defaults (`docs/analysis/research-art.md` §0: S1 toy-diorama low-poly world, T2 3D coins carrying the T1 face, palette D "Heraldic euro", B3 sand-table slabs, F3-lite fog, orthographic top view by default with a true-isometric toggle) and on the engine's event stream (`packages/engine/README.md`, *Events* and *Intents*). Rules come from `docs/RULES_INTERPRETATION.md`, with the owner rulings R1-R42 first.

- **Date:** 2026-10-24. Library facts were checked in this repository's `node_modules` (three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, maath 0.10.8, zustand 5.0.16). Audio licences were checked on kenney.nl today.
- **Evidence tags:** **(verified)** = checked today against a source in §10 or against code; **(memory)** = the author's knowledge of a game, not re-checked today. Confidence uses **High / Medium / Low**, as in the sister documents.
- **The mock page the owner's rule asks for** ("Any artistic decision will show a quick mock in a page, as well as justification for the use. If there are several contenders, all should be represented and justified."): `docs/art-direction/vfx.html`. It plays the same event script in the three contender styles and in the recommended hybrid, side by side. It also carries the effect library, the signal colours, the motion and HUD demos and the queue timeline. It needs only the three.js CDN and opens straight from disk.

**Supporting files** (in `docs/analysis/research-vfx/`, next to this document):

| File | What it holds |
|---|---|
| `signal_check.py` | Re-runs the colour check of §3 (`python signal_check.py signal-palette.json`). It imports the maths of `../research-art/cvd_check.py`, so both documents use one method |
| `signal-palette.json` | The signal colours with L*, contrast on ink and on sand, simulated deutan/protan/tritan/grey hexes, the nearest grade of palettes D and C, and the worst signal pairs |

---

## 0. Recommended defaults at a glance

Every row is a default, so implementation can start now. The mock page shows every contender.

| # | Decision | Recommended default | Other contenders (shown in the mock) | Confidence |
|---|---|---|---|---|
| 1 | Effect style | **"Struck metal, inked"**: style A (restrained physical impacts on metal coins) plus style B's readability devices (keylined numerals, breakdown chips, tile-exact area outlines, direction marks, interruption plaques) | A alone; B "Ink and impact" alone; C "Ember and smoke" (rejected; kept only as capped accents) | Medium-high |
| 2 | Effect colours | **"Mint & forge" signal set**: EMBER `#F24E1E` damage, MINT `#96DDB4` heal, STEEL `#86A6CF` damage prevented, GILT `#F6EC93` buff, TARNISH `#A27CFA` debuff or cost, ASSAY `#4FE3F5` vision and reveal, IVORY `#F3EAD2` system. Always drawn with an INK `#1B1410` keyline and a shape code | Textbook red, green, gold, violet and cyan, which collide with the grades Or, Vert and Purpure | Medium |
| 3 | Impact ladder | By final damage A: hit-stop 0 / 60 / 75 / 90 ms (120 ms for a commander kill); camera shake 0 / 2 / 4 / 6 px (cap 6); jolt 0.04 → 0.14 tile; sparks 3 → 16; chips 2 → 12 | One impact for every hit; impact by attacker tier only | Medium |
| 4 | Death | The coin **cracks and shatters into 5-10 wedge shards**, which clatter on the sand and sink after 1.2 s; a scuff decal stays for 2 own turns | The coin bends and topples flat; the coin is "defaced" (struck through) and fades | Medium |
| 5 | Motion scale | **90 / 150 / 240 / 400 ms** (`snap / quick / base / slow`), four easings (`enter`, `exit`, `move`, `strike`) and one damped spring (overshoot ≤ 8 %). No elastic or bouncy UI | n/a | High |
| 6 | Queue | Engine order, grouped into **beats**. Independent beats overlap at each beat's **settle point**; cosmetic tails always overlap | Strictly sequential; everything in parallel | Medium-high |
| 7 | Input during animations | **"Settle, then send"**: inspect and select freely during animations (computed from the new view). Confirming an intent snaps the queue to its settle state and sends it at once. Interruption plaques always stay up for their full hold | Intents wait until animations end; free input with effects trailing behind | Medium-high |
| 8 | Opponent's turn | Visible events animate live at the player's speed, never faster than Fast, with 2× catch-up. **"Replay last turn"** plays the stored per-turn log at 2×. No auto-pan: edge arrows and toasts instead | Auto-follow camera | Medium |
| 9 | Reduced motion | Same information without travel, shake, hit-stop or particles: crossfades of 150 ms or less, dotted path traces, static rings, numbers in place | Fully instant (loses "what moved where") | High |
| 10 | Sound | Foley first (coin, iron, wood, sand, cloth), short cues, no voices or narrator; stable cue ids `family.subject.variant`; Kenney CC0 packs as the first source | Synth or arcade cues; orchestral stingers | Medium |
| 11 | Tech | No custom GLSL and no post-processing. One `Points` (vertex alpha) for sparks, one `InstancedMesh` for chips, a pooled `Sprite` set for dust, one board-sized `CanvasTexture` "scar layer" for decals, wedge `CylinderGeometry` shards. An effect clock carries the hit-stop; an animation lease switches `frameloop` between `demand` and `always` | drei `Sparkles`/`Trail` (they ship their own ShaderMaterials, §8.6); a bloom pass | High |

---

## 1. The owner's direction and what it means on this board

> "Sound effects are in scope. The feel has have a grit and viscerality to it, while staying readable and not too exagerated." (owner, 2026-10-24; `docs/SPEC.md` records it as: Visual effects and animations should have "a grit and viscerality to it, while staying readable and not too exaggerated.")

**Reading.**
- **Grit and viscerality** come from four things:
  - **weight:** a beat of stillness at contact, a heavy body that jolts and recoils;
  - **material:** metal coins that clang, chip and spark, and sand that puffs;
  - **consequence:** scuffs and scorch marks that stay for a while;
  - **sound.**
- **Readability** comes from effects that are shape- and colour-coded, anchored to tiles, short, and never cover the board.
- **"Not too exaggerated"** rules out cartoon squash and stretch, slow motion, zoom punches, screen flashes, bloom and long particle tails.

### 1.1 Constraints from the game itself

- **A 25×25 board seen whole.** At 1080p the full board gives about 36 px per tile (research-art §4.1), so a token is about 30 px across.
  - An effect larger than about 1.5 tiles covers the neighbours.
  - An effect that lingers past about 1 s overlaps the next action.
- **Coins, not creatures.** Units are metal tokens (a T2 coin with an enamel or metal face). Their natural responses are physical: slide, tap, jolt, ring, chip, crack. Blood and body parts don't fit the fiction; metal flakes, sparks and dust do.
- **Fog of war and hidden information** (rules §4; engine invariant 4). Effects must not leak.
  - A projectile, tether, streak or shake pointing toward an unseen dealer would tell the player where it is.
  - So any directional effect is drawn only between two endpoints the viewer can see (§1.4).
- **Big swarms.** Armies of 30-50 units per side are legal (R2), and Group march moves up to 6 units at once (R27). Per-unit effects must batch.
- **Both cameras.** Top view (the default) foreshortens nothing; iso shows coin thickness and tilts. Every effect must read in top view first.

### 1.2 Principles (the checklist for every effect)

1. **Three reads.** This follows Zach Gage's "Three Reads" model (GDC 2018), which used Into the Breach screens to explain information hierarchy (verified, §10).
   - Within 150 ms the eye gets **what** happened: shape and colour at the token.
   - By 300 ms it gets **how much**: the numeral.
   - By 600 ms it gets **why**: the breakdown chips. The log line is permanent.
2. **One focus per beat.** At most one strong effect plays at a time; everything else in the same beat is a lighter variant. Splash hits use the light ladder, and a beat has one shake and one hit-stop.
3. **Short.** Impacts last at most 400 ms, numerals 900 ms, plaques 1.0 s, and deaths 1.6 s including the cosmetic tail. Only areas and statuses persist, and they stay quiet: washes of 35 % opacity or less, plus a pattern.
4. **Never hide a token face** for more than 150 ms. The hit flash lasts 60 ms and tints only the rim. Numerals sit above the token, never on it.
5. **Colour plus shape.** Every signal colour comes with a glyph or a shape (§3). Nothing is told by colour alone (product-ux A11Y-02, A11Y-07).
6. **Keylines.** Every signal glyph, numeral and ring carries a 2 px INK keyline, so it reads on light sand, dark fog and the walnut table alike. The signal colours alone reach only 1.0-2.0:1 on sand (§3.2).
7. **Scale by consequence, not by spectacle.**
   - The target's reaction scales with the damage actually dealt.
   - The swing scales with the attacker's weight.
   - So a Berserker's heavy swing into a Paladin's armour still lands as a small "clank".
8. **Consequence stays, spectacle doesn't.** Scuffs, scorch marks and cracks persist for a short while (decals). Sparks, flashes and dust are gone in under 0.5 s.
9. **Physics is display-only.** Jolts, tilts and shards are offsets on the display transform; the logical square never moves (§8.1).
10. **Same information under reduced motion.** Every effect has a still variant that carries the same facts (§5.5).

### 1.3 Grit versus exaggeration

| Do (grit, weight) | Don't (exaggeration) |
|---|---|
| A 60-90 ms freeze at contact (hit-stop) | Slow motion, freeze frames over 120 ms, bullet time |
| The coin jolts 0.04-0.14 tile and recoils on a damped spring | Squash and stretch, rubber-band overshoot over 10 % |
| Metal chips, short sparks, a sand puff | Particle showers, confetti, smoke columns that fill tiles |
| Camera shake of 6 px or less, mostly along the hit direction | Shakes over 6 px, zoom punches, screen flashes, chromatic aberration |
| Scuffs and scorch marks that fade over 2 turns | Permanent gore, blood pools |
| Clang, scrape, thud, crunch, sand patter | Cartoon boings, a whoosh on every move, shouted voices |
| Numerals of 16-26 px with a dark keyline | Numerals bigger than a tile, rainbow "CRIT!!" text |
| Light only where the fiction demands it (Smite, Holy blessing), for 150 ms or less | Bloom, glows on everything, emissive auras that never stop |

### 1.4 Leak-safety rules for effects (hidden information)

These follow engine invariant 4, the event audiences and research-ux-conventions §15.1.

| # | Rule | Engine fact it follows |
|---|---|---|
| L1 | Draw a projectile, tether, streak, scan line or directional shake **only between two endpoints the viewer can see**. A hit with `dealerId: null` gets a radial impact "from above", a vertical shake and a pulsing "?" **on the struck token** until the end of the turn. The client can't place it at an origin it doesn't know | `unitDamaged.dealerId` is null for a seat that can't see the dealer (A4-12) |
| L2 | An `abilityUsed` with `targets: []` plays only the caster's flourish | The opponent gets `targets: []` (README, Events) |
| L3 | Areas are drawn only on the squares received. Edges that border unseen squares fade out instead of closing the outline, so the shape outside vision isn't implied | `areaCreated` for the opponent lists only the squares in its vision (A4-13) |
| L4 | No effect, sound or camera move for anything not delivered. Stealth and Trip Mine send the opponent **nothing**, not even `abilityUsed` | `secret: true` on `rogue.stealth` and `artificer.tripMine` (verified in code) |
| L5 | A wait caused by a hidden decision looks exactly like network latency: the generic "Resolving…" hint and no distinct animation | `DECISION_PENDING` "should queue the intent and show a normal waiting animation" (README, authority loop) |
| L6 | The owner of a revealed unit sees who revealed it only if `byId` is present | `unitRevealed.byId` (A4-10) |
| L7 | Sounds play only for delivered events. The hit sound for "your unit was hit from the fog" is allowed, since you own the unit | S-15.6 |

---

## 2. Three contender effect styles

All three were mocked on the same 7×5 board with the same script: a move, a melee kill, a ranged shot into armour, a Smite with splash, a mine, a heal and a reveal (`vfx.html` §1). The scores in §2.4 are judgement calls (Low-Medium confidence) that make the trade-offs explicit.

### 2.1 A: "Struck metal" (restrained physical)

**What it looks like.**
- **Melee:**
  - The attacker pulls back 0.05-0.08 tile (60-90 ms) and lunges 0.28-0.32 tile (90 ms, accelerating).
  - **Contact freezes the effect clock for 60-90 ms.**
  - The target jolts 0.04-0.14 tile away and recoils on a damped spring (150 ms, overshoot ≤ 8 %). Its rim flashes white for 60 ms.
  - 2-12 metal chips (brass for your bezel, iron for the opponent's) and 3-16 sparks fly in a 70° cone away from the attacker and land on the sand within 0.6 tile.
  - A sand puff rises at the base. From 5 damage up, a scratch decal stays on the tile. The camera shakes only from 5 damage up (2-6 px).
- **Ranged:** an arrow (a dark shaft) arcs, thunks into the rim and sticks for 400 ms.
- **Death:** the face cracks and the coin shatters into wedge shards. They bounce once, clatter flat, then sink; a scuff stays.
- **Areas:** physical props only, such as a hex pattern rising from the slabs for Forcefield or scorched sand for a mine.

**References and why.**
- *Battle Brothers* (Overhype, 2017) (memory): pieces on a tactical board lunge and recoil, blood splatter and fallen bodies stay on the battlefield for the rest of the fight, and the camera barely moves. The grit comes from consequence, not spectacle.
- *Darkest Dungeon* (Red Hook, 2016): each hit lands with a held beat and harsh, meaty foley. Its combat camera zooms in on melee hits, ranged hits and skills, and a community mod removes that zoom except on crits (verified, §10). We take the held beat and the foley, **not** the zoom, which would hide a 25×25 board.
- Masahiro Sakurai, "Hitstop" (*Masahiro Sakurai on Creating Games*, 2022) (verified): a brief freeze on contact is what makes a hit feel heavy, in any genre.
- Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras With Math", GDC 2016 (verified through implementations that cite it): shake driven by a decaying "trauma" value, squared, noise-based and capped, so small hits barely register.
- *Inscryption* (Daniel Mullins Games, 2021) (memory): tactile pieces on a table with weight and grit in a confined diorama, close to our sand-table fiction.

**Pros against the direction.**
- Weight and grit without exaggeration.
- Fits metal coins and the toy-diorama world (research-art S1).
- Cheap: no post-processing.
- Effects stay within about 1 tile and under 0.4 s.
- Works in both cameras.

**Cons.**
- Physical cues alone don't say *why* (was it halved by Defend, cut by armour, cut by a Forcefield?).
- They don't show splash shapes or a direction from the fog.
- Small chips have low contrast on sand at full-board zoom, and a tired eye misses a 0.06-tile jolt.

**Verdict.** **Recommended as the base.** Add B's devices for the "why" and the "where".

### 2.2 B: "Ink and impact" (stylised flat shapes)

**What it looks like.**
- Flat, high-contrast, inked 2D shapes lying on the board plane:
  - an impact burst star and a ring on each hit, and a slash stroke across the target;
  - a directional streak (speed lines) behind charges and arrows;
  - big stamped numerals with an ink outline, plus breakdown chips;
  - area outlines inked around the exact squares in 240 ms;
  - a stamped plaque for interruptions ("Blocked!", "Mine!", "Ambushed!").
- Tokens don't move when hit. A death is an ink "X" stamp and a fade.

**References and why.**
- *Into the Breach* (Subset Games, 2018) (memory; the GDC 2019 design postmortem is listed in §10): flat icons, arrows and tile overlays sit on top of the art, the board is never hidden, and every effect is anchored to a tile.
- Zach Gage, "Three Reads", GDC 2018 (verified coverage): what, how much and why, at a glance.
- *Mark of the Ninja* (Klei, 2012) (memory): sound is drawn as rings, which makes invisible information visible as a shape. Our area and blast outlines do the same for splash shapes.
- *Darkest Dungeon* (memory): inked blood splatter and stamped numbers. *Slay the Spire* (memory): flat slash marks and popping numbers.

**Pros.**
- Maximum readability, and shape-coded by nature.
- Direction and area shapes are explicit.
- Deterministic and cheap.
- The still frame already carries the information, so reduced motion is trivial.

**Cons.**
- On its own it reads as UI, not as a body being struck: there is no weight.
- Speed lines and stamps slide easily into comic-book exaggeration, which the owner ruled out.
- Flat decals over a lit 3D diorama clash unless they are thin and brief.

**Verdict.** **Adopt the devices, not the look:** keylined numerals and breakdown chips, tile-exact outlines for areas and splashes, direction marks for ranged shots and charges, the "?" for unseen dealers, and the interruption plaques.

### 2.3 C: "Ember and smoke" (particle-forward)

**What it looks like.** Additive glows and bloom, ember particles drifting after hits, smoke plumes from blasts and deaths, light flashes for abilities, and glowing auras on buffed units.

**References.**
- *Diablo III* and *Diablo IV* (memory): light- and particle-forward combat.
- *Hades* (memory): heavy bloom, kept readable by large silhouettes.
- *Divinity: Original Sin 2* (memory): glowing elemental surfaces.
- *Hearthstone* (memory): bloom, particles and a board shake that grows with a minion's cost. Scaling by value is a good idea, here in an exaggerated package.
- *Total War: Warhammer III* (memory): spell effects.

**Pros.** Spectacle and atmosphere; magic feels magical.

**Cons.**
- It covers tokens and numerals on a board with about 36 px per tile.
- Bloom washes out the light grades (Argent, Or) and the sand. In the mock, the Argent Footman loses its edge.
- Embers and smoke linger past the beat, so the board is ambiguous when the next action starts.
- It needs a post-processing pass (`EffectComposer` with `UnrealBloomPass`, or `@react-three/postprocessing`, whose peer range caps three below r187; research-framework §2) and costs GPU time on laptops.
- It is led by colour, so it is hard to shape-code.
- It is the opposite of "not too exaggerated".

**Verdict.** **Rejected as a style.** Kept only as capped accents inside A:
- additive sparks (no bloom);
- one light shaft of 150 ms or less for Smite, Holy blessing and Queso's beacon;
- a short smoke puff on mine blasts only.

### 2.4 Comparison

Scores are 1-5 (judgement, Low-Medium confidence); the weights reflect the direction.

| Criterion (weight) | A Struck metal | B Ink and impact | C Ember and smoke | **A + B devices** |
|---|---|---|---|---|
| Readability on a 25×25 board (30) | 3 | 5 | 2 | **5** |
| Weight, grit, viscerality (25) | 5 | 2 | 3 | **5** |
| Restraint: not exaggerated (15) | 5 | 3 | 1 | **4** |
| Fit with coins and the S1 diorama (10) | 5 | 3 | 2 | **5** |
| Cost: no GLSL, no post-processing, laptop GPUs (10) | 4 | 5 | 2 | **4** |
| Accessibility: CVD, reduced motion (10) | 3 | 5 | 2 | **5** |
| **Weighted score out of 100** | 82 | 75 | 42 | **95** |

### 2.5 The recommendation: "Struck metal, inked"

A's physics carry the weight, B's devices carry the explanation, and C contributes a few capped accents.

| From | Kept | Dropped |
|---|---|---|
| A | Hit-stop, lunge and jolt, damped recoil, rim flash, metal chips, short sparks, sand puffs, scuff/crack/scorch decals, wedge shatter, capped shake, metallic foley | Physics that would hide information: shards stay within 0.6 tile of their square and sink after 1.2 s |
| B | Keylined numerals and breakdown chips; tile-exact outlines for areas, splashes and blast radii; arrows and speed lines for ranged shots and charges only; "?" for unseen dealers; interruption plaques; the inked area outline | A slash stroke on every hit, comic stamps on hits, "X" deaths |
| C | Additive sparks; one light shaft of 150 ms or less (Smite, Holy blessing, Queso's beacon); a 500 ms smoke puff on mine blasts | Bloom, drifting embers, lingering smoke, glows on statuses |

---

## 3. Signal colours: "Mint & forge"

Palette D already uses white, gold, black, red, blue, purple and green for the grades. A textbook effect set (red damage, green heal, gold buff, violet debuff) therefore collides with Gules, Vert, Or and Purpure.

The set below came from a constrained search in OKLCH, then rounded by hand (Appendix B):
- one hue window per meaning, lightness 0.58-0.96;
- maximising the CIEDE2000 distance to the grades and between the signals, in normal vision and under simulated deutan, protan and tritan vision.

The names follow the coin theme.

### 3.1 The set

| Name | Hex | Meaning (where used) | Shape code (always drawn with it) | Nearest grade of palette D, ΔE00 normal / deutan / protan / tritan |
|---|---|---|---|---|
| **EMBER** | `#F24E1E` | Damage: numerals, spark tint, blast flash, the attack-reach wash (consistent with research-art's `#E4572E` hatch) | "−N" numeral; burst star; sparks | Gules 22.8 / Vert 11.3 / Vert 14.9 / Gules 15.5 |
| **MINT** | `#96DDB4` | Heal, regeneration, revive ("re-minted") | "+N"; rising motes; plus marks; contracting ring | Vert 18.8 / Argent 13.4 / Argent 15.6 / Vert 17.1 |
| **STEEL** | `#86A6CF` | Damage prevented: Defend, Reinforced Armor, Line Formation, Forcefield, Hex Ward | shield-glyph chip ("−2", "½"); bracket arc on the struck side; hex cells | Argent 22.9 / Purpure 14.0 / Purpure 19.7 / Vert 11.0 |
| **GILT** | `#F6EC93` | Buff gained: Keep Power, Strong Aura, an extra action (Market, Command Aura, Holy Fervor), Mad inventor, Tribute and Market AP | up-chevron ▲; "+1" chip | Or 15.7 / Or 12.2 / Or 13.9 / Argent 14.5 |
| **TARNISH** | `#A27CFA` | Debuff or cost: Ratasius' weakness, sacrifice, toughness lost (Shared wounds donor), Queso's max-toughness cost, Cauldron AP debt | down-chevron ▼; hairline crack; "−4" chip | Purpure 14.0 / Purpure 11.2 / Purpure 13.2 / Purpure 22.7 |
| **ASSAY** | `#4FE3F5` | Vision and detection: reveal, Mind's Eye, Ratasius' detection, a revealed mine, the LOV preview outline ("assay" = testing a coin's true metal) | iris ring (a ring with a pupil); dashed ring; eye glyph | Argent 23.0 / Argent 15.9 / Argent 10.6 / Vert 20.3 |
| **IVORY** | `#F3EAD2` | System and neutral: "Blocked!", "Nothing there", banners, the dotted path trace | notched plaque; dotted line | Argent 11.9 / 12.6 / 11.7 / 10.8 (never used on or next to a coin face) |
| INK | `#1B1410` | The keyline under every signal shape (2 px at 1080p, at least 1.5 px), the numeral outline, the plaque plate (88 %) | n/a | n/a |

The owner tones stay as in research-art §6.3: brass `#C9A23A` / ivory `#F1E6C8` for you, blackened iron `#2A2622` / `#6B625A` for the opponent. They mark ownership in banners, capture rings and the board frame; they never carry a meaning.

### 3.2 Measurements (`research-vfx/signal_check.py`)

- **Against the palette D grades:**
  - Normal vision: minimum ΔE00 14.0 (TARNISH vs Purpure).
  - Simulated CVD: 10.6-15.9. The worst pairs are ASSAY vs Argent (protan 10.6), STEEL vs Vert (tritan 11.0), TARNISH vs Purpure (deutan 11.2) and EMBER vs Vert (deutan 11.3).
  - A textbook gold (`#FFC94D`) scored only 3.7-5.3 against Or in every vision type, which is why GILT is pale (L* 92).
  - TARNISH is the pair closest to a grade (Purpure, 11.2-14.0): a violet can't get far from Purpure and stay violet. Its down-chevron and the rule that it never touches a coin face carry it.
- **Between the signals:**
  - Normal vision: 15.4 or more (STEEL-TARNISH is the closest).
  - Deutan: 11.1 or more (STEEL-ASSAY). Protan: 12.6 or more (MINT-GILT).
  - Tritan: MINT-ASSAY at 8.3. Greyscale: MINT ≈ ASSAY (0.5).
  - The shape codes carry those last pairs: MINT always rises (motes, "+N") and ASSAY always rings (iris).
- **Contrast:**
  - 5.1-15.0:1 on INK, so numerals with an ink outline read everywhere.
  - Only 1.0-2.0:1 on the sand slabs. Hence principle 6: no signal colour is ever drawn without its keyline.
- **Clarity mode (palette C):**
  - GILT is close to C's pale-gold grade 100 (ΔE 5.7), and ASSAY to C's ice grade 50 (deutan 0.7).
  - So Clarity mode turns on the glyph plate for every signal (icon plus text, no colour-only pulses) and doubles the keyline width.
  - The hexes don't change, so the meanings stay stable across modes.

### 3.3 Usage rules

1. A signal colour never fills more than 0.25 tile. Larger areas are washes of 35 % or less with a pattern (hex cells, hatching, dots) and an inked outline, as research-art §10.2 does for range overlays.
2. Signals never tint a coin face. The only change to a coin is the 60 ms white rim flash.
3. Numerals use Barlow Semi Condensed 800 in the signal colour with a 3 px INK outline. Sizes are 16 / 20 / 26 px at 100 % UI scale, clamped to 0.75 tile height or less when zoomed out.
4. A meaning keeps its colour everywhere: the HUD, the log icons and the board.
5. **Proposed amendment to research-art §6.4:** the *revealed* state ring changes from violet `#B07CFF` to ASSAY, so violet means only "debuff or cost". This is owner question 7 (§9).

---

## 4. Impact grammar (the shared building blocks)

### 4.1 Strike anatomy

| Phase | Light melee (tier 1-5, commander, dummy) | Heavy melee (tier 10-100) | Beast (size 2) | Ranged (Ranger) |
|---|---|---|---|---|
| Wind-up | pull back 0.05 tile, 60 ms, `ease.exit` | pull back 0.08 tile and lift 0.04, 90 ms | lift 0.12 tile, 150 ms | turn toward the target (iso only), 90 ms |
| Strike | lunge 0.28 tile, 90 ms, `ease.strike` | lunge 0.32 tile, 90 ms | drop and lunge 0.2 tile, 90 ms | arrow flight, 240 ms: linear across, parabolic up to an apex of 0.35 tile (range 1) or 0.6 tile (range 2) |
| Contact | hit-stop by final damage (§4.2) | same | same, plus a dust ring of 1.1 tile | the arrow sticks in the rim for 400 ms |
| Return | 150 ms, `ease.enter` | 240 ms | 240 ms | n/a |
| Swing sound | `atk.swing.light` | `atk.swing.heavy` | `atk.swing.beast` | `shot.bow.release` |

The swing scales with the attacker; the reaction (§4.2) scales with the damage actually dealt. A heavy swing that the target's armour cuts to 1 shows a heavy wind-up and a light reaction, with a STEEL chip and `ward.armor.clank`.

### 4.2 Damage ladder (final amount A after the pipeline)

| Class | A | Hit-stop | Target jolt (tile) | Sparks | Chips | Dust and decal | Shake | Numeral | Hit sound |
|---|---|---|---|---|---|---|---|---|---|
| Chip | 1-2 | 0 | 0.04 | 3 | 2 | none | none | 16 px | `hit.metal.light` |
| Light | 3-4 | 60 ms | 0.06 | 5 | 3 | 1 puff | none | 16 px | `hit.metal.light` |
| Medium | 5-9 | 60 ms | 0.08 | 8 | 5 | 1 puff + scratch decal | 2 px, 120 ms | 20 px | `hit.metal.heavy` |
| Heavy | 10-19 | 75 ms | 0.11 | 12 | 8 | 2 puffs + scratch | 4 px, 180 ms | 20 px (26 px from 15) | `hit.metal.heavy` |
| Crushing | 20 or more | 90 ms | 0.14 | 16 | 12 | 2 puffs + dust ring + crack decal | 6 px, 240 ms | 26 px | `hit.metal.crush` |

- **Killing blow:** adds 15 ms of hit-stop (capped at 90 ms). A commander kill gets 120 ms, the longest freeze in the game.
- **One freeze and one shake per beat.** Simultaneous hits (a splash, the end-of-turn ticks) use the largest single value, never a sum.
- **Jolt:**
  - Direction: away from the dealer. When the dealer is unseen, a straight-down press of 0.02 tile instead (L1).
  - Up to 10° of tilt in iso; the return uses the recoil spring (§5.1).
- **Rim flash:** the bezel goes to `#FFF8E7` for 60 ms and back over 90 ms. Faces never tint.
- **Sparks:** additive points that live 180-260 ms. They fly in a 70° cone away from the dealer (radially if the dealer is unseen) and fall to the sand within 0.6 tile.
- **Chips:** flat metal flakes in the target's bezel metal (brass for yours, iron for the opponent's). They tumble and lie on the sand until they sink at 1.2 s.
- **Numeral:**
  - Motion: pops 1.15 → 1.0 in 90 ms, rises 0.35 tile over 900 ms (`ease.enter`) and fades over its last 240 ms.
  - Stacking: numerals that start within 300 ms of each other stack upward 0.3 tile apart.

### 4.3 Breakdown chips (from `unitDamaged.breakdown`)

The engine lists the pipeline steps as `{ step: base|addition|subtraction|reduction|defend, source, delta, total }`.
- Each non-base step becomes a chip under the numeral: an INK plate with the source glyph and the delta.
- Chips appear 60 ms apart and stay for 700 ms.
- At most three are shown; more collapse into "+2 more" (the log has them all).

| Step | Colour | Example chips (source → glyph) |
|---|---|---|
| `addition` | GILT | "+1" Keep (`white-tower`), "+2" Fierce attacker (`crossed-swords`), "+1" Strong aura (`holy-grail`) |
| `subtraction` | TARNISH | "−4" Ratasius' weakness (`rat`) |
| `reduction` | STEEL | "−2" Reinforced Armor (`templar-shield`), "−2" Line Formation (`spears`), "−8" Forcefield (`energy-shield`), "−1" Hex Ward (`witch-flight`) |
| `defend` | STEEL | "½" (`checked-shield`). The target's Defend badge flashes and a STEEL bracket arc shows on the struck side for 240 ms; `ward.defend.block` is layered in |

### 4.4 Death anatomy

| Phase | Time from the killing contact | What happens |
|---|---|---|
| Crack | 0-60 ms (during the hit-stop) | 3-5 INK crack lines across the face |
| Burst | 60-700 ms | The coin splits into wedge shards: 5 for tiers 1-5 and dummies, 6 for 10-20, 8 for 50-100, 9 plus the crest for a commander, 10 for the Beast. Each shard pops up 0.15-0.35 tile with spin, flies outward at 0.6-1.2 tile/s, falls, bounces once (restitution 0.3) and slides to rest within 0.6 tile |
| Rest | 700-1200 ms | The shards lie on the sand. The square is already free (the logical state changed at contact) |
| Sink | 1200-1600 ms | The shards desaturate, flatten and sink into the sand |
| Scar | until 2 own turns later | A scuff or scorch decal (INK 20-24 %, 0.7-0.9 tile) stays and fades in steps at each turn start |

The death beat's **settle point** is at 300 ms, when the coin is visibly gone; the next beat may start then (§7.2).

### 4.5 Scars (persistent decals)

- **Kinds:**
  - scratch: A of 5-14; 0.45 tile at 14 % opacity;
  - crack: A of 15 or more, Slam's target square and Smite's cross; 0.8 tile at 22 %;
  - scorch: mines and deaths; 0.8-0.9 tile at 24 %.
- **Life:** 100 % → 60 % → 25 % → gone, stepping down at each of the viewer's next three turn starts. At most 24 are on the board; the oldest goes first.
- **Placement:** decals lie on the slab, under tokens. They show once the square is empty, or at the token's edge in iso; they never cover a live token's face.

---

## 5. Motion language for the UI

### 5.1 Tokens

| Token | Value | Use |
|---|---|---|
| `t.snap` | **90 ms** | press feedback, hit flash, numeral pop, stamp-in, toggles |
| `t.quick` | **150 ms** | hovers, fades, vision tile fades, small slides (12 px or less), recoil return |
| `t.base` | **240 ms** | banners and cards in and out, panel swaps, area outlines inking on, emblem flip |
| `t.slow` | **400 ms** | screen transitions, the view switch (top ↔ iso), rewinds, the fog lift |
| `ease.enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | anything arriving or settling (close to an exponential ease-out) |
| `ease.exit` | `cubic-bezier(0.7, 0, 0.84, 0)` | anything leaving; wind-ups |
| `ease.move` | `cubic-bezier(0.65, 0, 0.35, 1)` | token travel, the camera, the view switch |
| `ease.strike` | `cubic-bezier(0.55, 0, 1, 0.45)` | accelerating into contact |
| `spring.recoil` | damping ratio 0.63 at 6 Hz (overshoot 7.8 %, settles in about 170 ms) | jolt return, a coin landing |
| `linear` | n/a | timers and progress bars only |
| Holds | numeral 900 ms; plaque 700 ms; banner 900 ms | how long things are displayed, not transitions |
| Steps | 160 ms per square (Charge: 110 ms) | token travel |

- **No elastic or bounce easing in the UI.** Physical bounce exists only for falling objects (a placed coin, shards, a created dummy): at most 2 bounces, with restitution of 0.3 or less.
- The view switch was 300 ms in research-art §10.3 and 350 ms in research-ux S-7.2. Both become `t.slow` (400 ms) with `ease.move`.

### 5.2 What moves and what doesn't

| Moves | Doesn't move |
|---|---|
| Tokens (travel, lift, jolt, tilt), effects, numerals, plaques | The board and terrain (except a 0.02 tile slab dip under Forceful slam) |
| AP pips, timer rings, the Siege track | The HUD layout and panel sizes. The log only fades new lines in (150 ms); it never slides |
| Banners: 12 px of travel or less, plus a fade | Text size (no scaling except the numeral pop and the stamp-in) |
| The camera: only on the player's command, plus shake of 6 px or less | The camera never auto-pans for the opponent's actions; edge arrows and toasts do that job (S-19.2) |
| End Turn: an opacity glow only | Nothing loops forever. The End Turn breathing stops after 3 cycles; only the Pajazon swirl turns, slowly (one turn per 12 s) |

### 5.3 Screen transitions

| From → to | Transition | Sound |
|---|---|---|
| Menu ↔ Army list ↔ Army builder | Shared axis along X. The outgoing screen moves −24 px and fades (`t.quick`, `ease.exit`); the incoming one arrives from +24 px (`t.base`, `ease.enter`). Back reverses it | `ui.nav` (soft paper) |
| Lobby → builder drawer | The drawer slides in from the right (`t.base`) while a scrim fades in (`t.quick`) | `ui.drawer` |
| Menu → Lobby; Result → Menu | Fade-through: out in 90 ms, in over 240 ms with an 8 px rise | `ui.nav` |
| Lobby (both ready) → Deployment | 1. A 3 s countdown; each digit stamps in (`ui.countdown.tick`).<br>2. **The coin flip** (`coinFlipped`, 1.4 s).<br>3. The HUD fades out and the board fades in while the camera settles from 1.08× to 1.0× zoom (`t.slow`, `ease.move`).<br>4. The deployment washes fade in (`t.base`) | `coin.flip.toss`, `coin.flip.land` |
| Deployment → Battle | 1. `battleStarted`: the washes fade (`t.base`).<br>2. The fog closes in from the board edge toward your units (400 ms, staggered by distance).<br>3. A "Battle" banner: both commander crests slide together and clink (`t.base`).<br>4. The first turn banner | `match.battleStart` |
| Battle → Result | 1. The deciding beat, with its 120 ms commander hit-stop.<br>2. A 600 ms hold.<br>3. The fog lifts in a radial wipe from the deciding square (600 ms).<br>4. The result panel rises 24 px and fades in over a 40 % scrim (`t.slow`); the final board stays visible above it | `match.victory` / `match.defeat` / `match.draw` |
| Result → Lobby (rematch) | Fade-through | `ui.nav` |

### 5.4 HUD moments

**AP widget** (research-ux §11; R1, R15, R28, R11)
- **Spend** (your own `apChanged` with a negative delta):
  - The pips drain from the right one at a time, 30 ms apart (240 ms or less in all). Each shrinks to 60 % and fades.
  - The number counts down in step, with tabular numerals and no slide.
  - One `ui.ap.spend` tick per action, not per pip.
- **Cost preview** (hovering or locking an action):
  - The pips the action would spend turn hollow with a brass outline, and "→ 3 left" appears. It is static, with no pulse.
  - If the action is unaffordable, the number flashes EMBER twice (2 × `t.quick`) and the button shows the shortfall.
- **Refill** (turn start): the engine sends `apChanged` just before `turnStarted`, so the director plays both as one beat.
  - The pips fill left to right in 300 ms, with `ui.ap.refill`.
  - Bonus chips slide in under the widget and merge into the count, in GILT: "+2 Market" (`shop`) and "+2 Tribute" (`crowned-skull`), with `ap.tribute` (two coin clinks).
- **Approach boost** (R28):
  - A brass "×2" tag with a boot glyph sits on the widget while the boost runs.
  - When `view.firstContactRound` becomes set, a banner reads "First contact: the AP boost ends after this round" (IVORY, `ui.firstContact`, a short low drum). The tag gets an amber "last round" ribbon.
  - At the next round's start the tag twists −20° and fades (`t.base`).
  - The banner shows no location, unless your own unit made the sighting (then its reveal plays as usual).
- **AP debt** (Cauldron, R11): a TARNISH hatched pip, "−1 owed", waits at the end of the row. At your turn start it cracks one refilled pip (`t.base`).
- **Opponent's AP** (R15, public): a number in the top bar. Changes crossfade (`t.quick`), with no pips and no sound.

**End Turn** (research-ux §12)
- *Nothing affordable left:* the button breathes (glow opacity 0.35 ↔ 0.9 over 1.6 s) for 3 cycles, then holds at 0.9.
- *Armed (the two-stage confirm):* amber, with a 4 s linear depletion bar, the label "Confirm end turn? 6 AP will be lost" and `ui.button.arm`.
- *Ending…:* disabled, then the end-of-turn ticker (§6.2).
- *Reduced motion:* the glow is static, and the armed state shows a text countdown.

**Turn change**
- **Your turn** (`turnStarted` for you):
  - The banner "Your turn · Round 4" drops 12 px while fading in (`t.quick`, `ease.enter`), holds for 900 ms and fades out (`t.base`).
  - The board frame crossfades to brass (`t.base`) and the AP refill plays.
  - Sound: `ui.turn.yours` (a two-note brass bell, 600 ms). Clicks pass through the banner.
- **Opponent's turn:**
  - A smaller, iron-toned banner "Friend's turn"; the frame turns iron.
  - End Turn becomes "Waiting for Friend… 0:00". Sound: `ui.turn.theirs` (a soft low knock).
- Both finish within 1.3 s and never block input.

**Turn timer** (R29: 90 s plus a 60 s bank)

| Remaining | Visual | Sound |
|---|---|---|
| More than 15 s of turn time | the number only | none |
| 15 s or less | the number turns amber; a ring around it drains linearly | none |
| 10 s or less | the ring turns EMBER | `ui.timer.tick` each second (an Options toggle, on by default) |
| Bank in use | the label "Bank 0:45" in brass | none |
| 5 s or less of bank | EMBER numerals; the timer chip's border pulses at 1 Hz (opacity only) | the tick continues |
| Paused (prompt, take-back) | the ring greys out, with a pause glyph | none |

No screen flash, no shake. The opponent's timer looks the same and makes no sound.

**Interruption plaques** ("Blocked!", "Mine!", "Ambushed!", "Spotted!", "Charge broken", "Contested", "Nothing there", "Defend lost")
- **Shape:** a notched INK plate (88 %) with the glyph and the word (Barlow Semi Condensed 800, caps), anchored 0.45 tile above the token.
- **Timing:** stamps in (scale 1.12 → 1.0 with a fade, `t.snap`), holds for 700 ms, fades out (`t.base`). Several stack 0.35 tile apart.
- **Colours and glyphs:**
  - Blocked!: IVORY, a stop glyph;
  - Mine!: EMBER, `teller-mine`;
  - Ambushed!: EMBER, `hood`;
  - Spotted!: ASSAY, `semi-closed-eye`;
  - Charge broken: IVORY, `walking-boot`;
  - Contested: IVORY, `crossed-swords`;
  - Nothing there: IVORY, a dot;
  - Defend lost: TARNISH, `checked-shield`.
- **Off screen:** an edge arrow in the plaque's colour plus a toast such as "Mine! Footman at K12 [Show]" (S-15.5).
- Skipping never removes a plaque early (§7.4).

**Take-back** (rules §9; research-ux §25)
- **Requester:** a banner card "Waiting for Friend to approve ↶ Paladin E5 → E8" with a 30 s linear bar. The tokens of the action being undone show a faint dashed ghost.
- **Decider:** the card drops in from the banner slot (`t.base`) with `ui.prompt.open`. Buttons only, no keyboard shortcut.
- **Accepted:** the rewind plays (§7.7) with `ui.takeback.rewind`, and the log line is struck through (a 150 ms line draw).
- **Declined:** the card stamps "Declined" (`t.quick`) and leaves, with `ui.prompt.declined`.

**Reaction prompts** (Queso's revive, the Cauldron, the Assault target pick; 15 s, rules 2.11)
- The decider's card carries a 15 s ring timer. The dying coin holds its cracked frame (desaturated, 60 % opacity) until `decisionResolved`.
- The active player sees "Friend is deciding…" only if `view.opponentDeciding` is true. Otherwise they see only the generic "Resolving…" hint (L5).

**Siege counter** (R30; public)
- A track of 5 brass segments per player sits next to the building status, shown to both players.
- When a seat's `siegeTurns` rises at its turn start, the next segment stamps in (scale 1.15 → 1, `t.snap`) with `objective.siege.tick` (a low drum).
- At 4 of 5, the track's border turns EMBER and reads "1 turn to Siege", with `objective.siege.warn` (a heavier drum and a bell), for both players.
- On a reset (a building lost), the segments crack and drain right to left (`t.base`) with `objective.siege.reset` (a stone crack).

### 5.5 Reduced motion

`prefers-reduced-motion: reduce`, or Options "Reduce motion: On", keeps every fact and drops every travel:
- **Movement:** tokens appear at their destination with a 150 ms crossfade. A dotted IVORY path trace with an arrowhead stays for 600 ms along the squares walked, so "what moved where" survives.
- **Hits and deaths:**
  - No shake, hit-stop, jolt, particles or shards.
  - A hit shows an EMBER ring outline on the token for 400 ms.
  - A death desaturates the coin, draws its crack decal and fades it (`t.base`).
- **Numerals and plaques:**
  - Numerals and chips appear in place (no pop, no rise) and fade after 900 ms.
  - Plaques appear without the stamp scale.
- **Areas and HUD:**
  - Area outlines appear whole (no inking on), and the Pajazon swirl is static.
  - The End Turn glow is static, and the timer shows the number without the ring sweep.
- **Transitions:**
  - Banners only fade (`t.quick`), with no travel; screen transitions are crossfades.
  - The fog lifts at once, and the coin flip shows its result face.
- **Sound:** unchanged (it isn't motion), within the volume settings.

---

## 6. Per-event effect spec

### 6.1 Conventions

- **Rows:** one per engine event (`VisibleEvent.type`) or variant. "A" is the event's `amount`. A beat's "settle point" is defined in §7.1.
- **Colours** as §3. **Durations** at Normal speed.
- **Camera:** "none" means no movement; shake values come from §4.2. Focus is never automatic (edge arrows instead).
- **Sound ids** follow `family.subject[.variant]`; the registry is §6.13.
- **RM** is what reduced motion shows instead.

### 6.2 Match flow and turns

| Event | Effect (shape) | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| `coinFlipped` | A large coin in the transition overlay is tossed: it rises with 8 slowing half-turns (400 ms, `ease.enter`), falls (300 ms, `ease.exit`), lands and wobbles down like a real spinning coin settling (500 ms). It then shows "You play South (you move first)" or "Friend plays South" | owner tones on the two faces (your emblem in brass, theirs in iron) | 1.4 s | none (overlay) | `coin.flip.toss`, `coin.flip.land` (a ring decaying with the wobble) | The result face fades in with the text |
| `armyChosen`, `readyChanged`, `settingsChanged`, `deploymentStarted` | Lobby UI only: ready ticks stamp in (`t.snap`); a changed setting flashes its row (`t.quick`) | IVORY / brass | `t.quick` | n/a | `ui.ready`, `ui.settings` | Instant |
| `unitPlaced` | The coin drops 0.25 tile onto the square with one small bounce and a sand puff | n/a | 240 ms | none | `deploy.place` (a coin set on wood) | Appears |
| `unitUnplaced` | The coin lifts 0.15 tile, its shadow grows, and it returns to the tray | n/a | 150 ms | none | `deploy.lift` | Disappears |
| `deploymentConfirmed` | Your zone border stamps brass; the opponent's "Confirmed" tick stamps into the top bar | brass | `t.snap` | none | `deploy.confirm` | Instant |
| `battleStarted` | The zone washes fade, the fog closes in from the edge, and the "Battle" banner shows both crests clinking | IVORY banner, owner tones | 400 ms + banner | none | `match.battleStart` (a deep drum and a metal hit) | The fog appears; the banner fades |
| `turnEnded` (either player) | End Turn shows "Ending…", then the **end-of-turn ticker** runs in rules 2.10 order:<br>1. damage ticks: one beat, all at once, shake 2 px at most;<br>2. the commander check;<br>3. heals: one beat;<br>4. captures: one beat per building;<br>5. expiries;<br>6. the next player's banner.<br>Target 1.5 s or less at Normal; Space skips (S-12.6) | per effect | 1.5 s or less | none | per effect | Numbers in place, as one beat |
| `turnStarted` (you) | The your-turn banner and the brass frame. The AP refill plays (merged with the `apChanged` that precedes it). Your units' Defend badges fade (`defendChanged` expired) and your expired areas fade | brass, GILT chips | 1.3 s (non-blocking) | none | `ui.turn.yours`, `ui.ap.refill` | The banner fades; the pips are set |
| `turnStarted` (opponent) | The iron banner and frame; "Waiting for Friend…" | iron | 1.0 s | none | `ui.turn.theirs` | The banner fades |
| `apChanged` | The AP widget, §5.4 (yours: pips; the opponent's: a number) | n/a | 300 ms or less | none | `ui.ap.spend` / `ui.ap.refill` | Set at once |
| `gameEnded`, conquest | 1. The killing blow with a 120 ms hit-stop; the enemy commander shatters (9 shards and the crest) with a 6 px shake.<br>2. A 600 ms hold, then the radial fog lift.<br>3. "Victory · Commander defeated · Round 12" (brass, Cinzel), or "Defeat" (iron) with the board desaturating by 30 % | brass / iron | about 3 s to the panel | 6 px shake | `unit.death.commander`, then `match.victory` / `match.defeat` (stings of 2.5 s or less, no fanfare) | The fog lifts at once; the banner fades |
| `gameEnded`, domination | The commander lifts 0.1 tile on the goal row, and the gold dashed goal line lights in a sweep outward from it (400 ms) | GILT line | 1 s + panel | none | `match.domination` (a bell), then the sting | The line is lit at once |
| `gameEnded`, siege | Both buildings' banners rise to full height, and both capture rings light up in the winner's tone together (400 ms) | owner tone | 1 s + panel | none | `objective.siege.win`, then the sting | Instant |
| `gameEnded`, draw (`simultaneousCommanderDeath`, `agreement`) | Both commanders shatter in one beat (if it was a death), then the "Draw" banner | IVORY | as conquest | 6 px, once | `match.draw` (two neutral bells) | Instant |
| `gameEnded`, resignation | Banner only ("Friend resigned") | owner tone | banner | none | the sting | The banner fades |
| `matchSummary` | The result screen's counters tick up over 400 ms (tabular numerals) | n/a | 400 ms | n/a | `ui.tally` (a soft coin pour, one per section) | The numbers are set |

### 6.3 Movement

| Event | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| `unitMoved` (walk, one event per step) | The director joins one unit's consecutive steps into one path. The coin lifts 0.03 tile and glides square to square at 160 ms per square (`ease.move` over the whole path). At each square centre it taps down (a 0.01 tile dip) with a small sand puff (2 sprites, 300 ms). Size 2 lifts 0.05 tile and puffs 4 sprites | sand dust `#CDBB8E` at 40 % | 160 ms per step | none | `move.step.coin` per square (pitch by tier, §6.13); `move.step.beast` for size 2 | Crossfade at the end square, plus the dotted IVORY trace for 600 ms |
| `unitMoved` into or out of fog (an opponent's unit) | The token fades out over the step on which it leaves your vision, and fades in over the step on which it enters. A last-seen ghost marker stays (research-ux §13.3) | n/a | 160 ms | none | none for unseen steps | Appears / disappears |
| Vision change (your move) | Newly seen tiles lift out of the fog and newly unseen tiles dim (`t.quick` per tile) | n/a | 150 ms | none | none | Instant |
| Charge (R26: `unitMoved` steps followed by `unitAttacked{source:'charge'}` for the same unit in the batch) | A run-up at 110 ms per square with 4-5 dust sprites per square, 2-3 INK speed lines (40 %, 0.6 tile) trailing behind and a 6° forward lean in iso. The last step flows into the strike with no wind-up; the hit's shake uses the next damage class up | INK lines | 110 ms per step + strike | per hit, one class up | `move.charge.run` (accelerating steps), then the hit | Crossfade and trace, then the hit |
| Charge interrupted (a `moveEnded` other than `completed`, and no `unitAttacked`) | The coin skids 0.1 tile in a spray of dust; "Charge broken" plaque | IVORY | 240 ms + plaque | none | `move.charge.skid` | Plaque |
| Group march (R27: the batch's `unitMoved` steps of 2-6 units) | One beat: all marchers step together, front to back with a 30 ms stagger. An IVORY ▲ direction chevron (0.3 tile) flashes under the group's leading edge | IVORY chevron | 160 ms + 30 ms per extra unit | none | one `move.march` (boots and a drum hit) plus up to 3 random `move.step.coin` | All crossfade, plus the chevron |
| `moveEnded`, `completed` | The last tap settles (`t.snap`) | n/a | 90 ms | none | (the last step) | n/a |
| `moveEnded`, `blocked` | A bump: the coin lunges 0.18 tile toward the blocked square (90 ms) and recoils (150 ms). The enemy now seen there fades in inside an ASSAY iris ring. "Blocked!" plaque. If the mover backs up over own units, it slides back along its path (150 ms per square) | IVORY plaque, ASSAY ring | 240 ms + plaque | none | `move.blocked.bump` (a dull wooden knock), `reveal.detect` | The plaque, and the enemy appears |
| `moveEnded`, `mine` | See `mineExploded`; "Mine!" plaque | EMBER | blast + plaque | the blast's shake | (the blast) | Plaque, scorch |
| `moveEnded`, `reaction` | See Assault (§6.6); "Ambushed!" plaque | EMBER | as Assault | per hit | `stinger.ambush` | Plaque |
| `moveEnded`, `died` | The mover's death plays on its square (§4.4); no extra plaque | n/a | death | per hit | (the death) | The death's RM |

### 6.4 Attacks and damage

| Event | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| `unitAttacked`, light melee (tier 1-5, commander, dummy) | §4.1, light column; in iso the attacker tilts 8° into the strike | n/a | 60 + 90 ms + hit-stop + 150 ms | none (the hit decides) | `atk.swing.light` | No travel; the hit's RM plays |
| `unitAttacked`, heavy melee (tier 10-100) | §4.1, heavy column | n/a | 90 + 90 ms + hit-stop + 240 ms | none | `atk.swing.heavy` | as above |
| `unitAttacked`, Beast (size 2) | §4.1, Beast column, with a 1.1 tile dust ring at contact | sand | 150 + 90 ms + hit-stop + 240 ms | none | `atk.swing.beast` | as above |
| `unitAttacked`, ranged (Ranger) | An INK arrow (a 0.28 tile shaft with fletching) flies the §4.1 arc with a faint 0.4 tile INK trail and sticks in the rim for 400 ms. A blind shot at a square flies to the square's centre | INK | 90 + 240 ms | none | `shot.bow.release` | A dotted INK line from shooter to target for 400 ms |
| `attackMissed` (a blind shot; the attacker's seat only) | The arrow sticks in the sand with a puff; a small "Nothing there" plaque | IVORY | 240 ms + plaque | none | `shot.arrow.ground` (a thunk in sand) | Plaque |
| `unitAttacked`, Savagery's second strike (`source: 'berserker.savagery'`, after its `abilityUsed`) | The backswing comes from the other side (a lunge offset by 30°), and the Berserker's rim flickers EMBER for 90 ms; the hit-stop is 15 ms longer | EMBER rim flicker | as a heavy strike | per hit | `ability.savagery` (a rough scrape) plus the swing | The hit's RM |
| `unitAttacked`, Assault (`source: 'rogue.assault'`) | For the Rogue's owner: its coin, at 45 % opacity, darts 0.35 tile in 90 ms. Then the Assault composite (§6.6) | n/a | 90 ms + hit | per hit | `atk.swing.light` | The hit's RM |
| `unitDamaged`, kind `attack` | The §4.2 ladder and the §4.3 chips. If the dealer is unseen (`dealerId: null`): radial sparks, a 0.02 tile press, a vertical-only shake, and a pulsing "?" on the struck token until the turn ends (L1) | EMBER numeral; chips as §4.3 | hit-stop + 900 ms numeral | §4.2 | `hit.metal.light`, `.heavy` or `.crush` by A; when the breakdown has the matching step, layer `ward.armor.clank`, `ward.line.lock`, `ward.forcefield.absorb` or `ward.defend.block` | An EMBER ring for 400 ms, with the numeral and chips in place |
| `unitDamaged`, kind `ability` | The ability's own impact (§6.9) plus the §4.2 reaction for A | EMBER | per ability | §4.2 | the ability's impact plus a metal layer | as above |
| `unitDamaged`, kind `mine` | See `mineExploded` | EMBER | the blast | the blast | `mine.explode` | as above |
| `unitDamaged`, kind `tick` (Pajazon) | Three short EMBER thorns jab up from the tile under the unit (150 ms), with the §4.2 light reaction but no hit-stop. All ticks of one turn end form one beat | EMBER | 150 ms + numeral | 2 px at most for the beat | `tick.pajazon.harm` (once per beat) | Numerals in place |
| A hit reduced to the floor (A = 1 against a big swing) | A heavy wind-up and a light reaction; the STEEL chips explain it. Fewer sparks, and white ones (a deflection) | STEEL chips | as the ladder | none | `ward.armor.clank` instead of the heavy hit | Chips in place |
| A hit while Defending | The Defend badge flashes and a STEEL bracket arc shows on the struck side for 240 ms; "½" chip | STEEL | 240 ms | as the ladder | `ward.defend.block`, layered | The chip in place |
| A hit inside a Forcefield | The hex cells within 0.8 tile of the impact flash to 45 % for 150 ms; "−8" chip | STEEL | 150 ms | as the ladder | `ward.forcefield.absorb` | The chip |
| A hit on a Footman in Line Formation | Its two neighbouring Footmen tick 0.02 tile toward it (shields locking, 90 ms); "−2" chip | STEEL | 90 ms | as the ladder | `ward.line.lock` | The chip |

### 6.5 Toughness, death, revival, creation

| Event | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| `unitHealed` | 6-10 soft motes rise 0.4 tile around the coin (600 ms). A thin ring contracts from 0.7 to 0.45 tile onto it (`t.base`), "+N" rises 0.25 tile, and the toughness bar fills (`t.base`) | MINT | 900 ms | none | by source: `heal.tick.soft` (Perseverance), `tick.pajazon.heal`, `heal.beacon` (Queso), `ability.blessing`, `heal.transfer` (Shared wounds), the tail of `ability.feast.crunch`, `heal.finePrint.quill` (Kulega), `ability.mend` (Baba Yaga) | "+N" with a static ring for 400 ms |
| `toughnessLost` (the Shared wounds donor; aura loss) | "−N" in TARNISH, not EMBER, because it isn't damage; a hairline crack draws on the rim; no jolt, no sparks. Aura loss: a small "−1", and the aura chevron fades | TARNISH | 600 ms | none | `ability.sharedWounds` on the donor; aura loss is silent | Numeral |
| `maxToughnessChanged` | Queso's revive cost: a "−1 max" (−2, −3) chip, and one permanent hairline crack on Queso's rim per point spent, so his rim shows how many revives are left. Aura gains (Strong aura, Hex Ward): a "+1 max" GILT chip on gain, TARNISH on loss | TARNISH / GILT | 600 ms | none | `debuff.maxToughness` (a dull crack); gains are silent | Chip |
| `unitDied`, cause `damage` | The §4.4 shatter and a scar decal | n/a (the shards keep the face) | 1.6 s (settles at 300 ms) | inherits the killing blow; 2 px more for size 2 | `unit.death.shatter.light` (tier 1-5, dummy), `unit.death.shatter.heavy` (tier 10+), `unit.death.commander` | The coin desaturates, its crack decal draws, and it fades (`t.base`) |
| `unitDied`, cause `sacrifice` (Julio Vernification, Feast) | Not a shatter. For Julio, the coin dissolves into TARNISH motes drawn into the Juliomancer (300 ms). For Feast, it slides under the Beast's rim and is crushed (240 ms, 3-4 crumbs) | TARNISH | 300 ms | none | `unit.sacrifice.dissolve` / `ability.feast.crunch` | A fade and a chip |
| `unitDied`, cause `toughnessLoss` (a Shared wounds donor at 1, R19) | The coin greys from the rim inward (`t.base`), then shatters lightly | TARNISH, then the shatter | 240 ms + shatter | none | `unit.death.shatter.light` | Fade |
| `unitDied` with a reaction pending for you (Queso, Cauldron) | The death holds on its cracked frame (cracks drawn, desaturated, 60 % opacity) until `decisionResolved`. "Yes" leads to the revive below; "no" lets the shatter continue | n/a | until answered (15 s or less) | none | `ui.prompt.open` | A cracked still |
| `unitRevived`, Queso (`queso.revive`) | 1. A thin GILT-white thread runs from Queso to the square (`t.base`).<br>2. The shards fly back together: the shatter in reverse, 400 ms.<br>3. The coin re-forms with a MINT ring and "+N" (half its base toughness). A faint seam ring stays on its rim ("re-minted").<br>4. Queso's `maxToughnessChanged` chip follows | GILT thread, MINT | 650 ms | none | `unit.revive.queso` (a rising bell and a ring) | The coin fades in, with "+N" |
| `unitRevived`, Cauldron (`babaYaga.cauldron`; on a free square next to Baba Yaga) | 1. A dark green-violet liquid ring spreads on the tile (`t.base`), and 6-8 bubbles rise and pop.<br>2. The coin rises out of the slab from below (−0.12 → 0 tile, 400 ms, `ease.enter`), shedding 2-3 drops; "+N" at full toughness.<br>3. The remains on the old square sink. The AP debt chip appears if the AP is owed | MINT, TARNISH ring | 640 ms | none | `unit.revive.cauldron` (bubbling and a glug) | The coin fades in; chips |
| `unitCreated` (a No-ACB dummy) | 1. The Artificer's gear glyph turns once (`t.base`), and 4-6 welding sparks fly at the square.<br>2. A blank planchet drops from 0.4 tile and lands with a heavy clank (1 bounce, restitution 0.2).<br>3. A puff of steam (2 grey sprites) | EMBER-white sparks | 600 ms | none | `unit.create.prototype` (a ratchet and a clank) | Fades in with a "+" glyph |

### 6.6 Statuses and hidden information

| Event | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| `defendChanged` to true (`action`) | A STEEL shield-bracket ring tightens around the coin (scale 1.15 → 1.0, `t.quick`), and the `checked-shield` badge stamps in (`t.snap`) | STEEL | 150 ms | none | `status.defend.raise` (leather and a clasp) | The badge |
| `defendChanged` to false (`expired`, at the turn start) | The badge fades (`t.quick`) | n/a | 150 ms | none | none | The badge is removed |
| `defendChanged` to false (`acted`: another action cancelled it) | The badge cracks and drops away (`t.base`); "Defend lost" plaque | TARNISH | 240 ms + plaque | none | `status.defend.drop` | Plaque |
| `stealthChanged` to true (owner only) | An INK wash ring contracts onto the coin (`t.base`). The coin fades to 45 %, its bezel turns dashed, and the `invisible` badge stamps in | INK at 30 % | 240 ms | none | `status.stealth.on` (a cloth swish) | Opacity set; the badge |
| Stealth failed (`abilityNote` "Spotted…", owner only) | "Spotted!" plaque on the Rogue; the coin doesn't fade | ASSAY | plaque | none | `stinger.spotted` (a glass tink) | Plaque |
| `unitRevealed`, your own unit | The dashed bezel snaps solid and the opacity returns (`t.quick`). One ASSAY ring expands from 0.5 to 0.9 tile (400 ms); "Revealed!" plaque. If `byId` is present, an ASSAY dashed line runs from the revealer to your unit for 400 ms | ASSAY | 400 ms + plaque | none | `reveal.exposed` | The plaque and a static ring |
| `unitRevealed`, an enemy unit you now see, cause `detection` | An ASSAY scan line runs from your detector (Juliomancer, Artificer, Ratasius) to the square (`t.base`). Then the enemy coin decloaks: it fades in while an iris ring contracts onto it (`t.base`) | ASSAY | 480 ms | none | `reveal.detect` (a glass shimmer) | It appears, with a static ring |
| `unitRevealed`, cause `adjacency` | The decloak with the iris ring only (no scan line) | ASSAY | 240 ms | none | `reveal.detect` | as above |
| `unitRevealed`, cause `damage` | The hit plays first, then the decloak on the same square | ASSAY | 240 ms after the hit | per hit | `reveal.detect` | as above |
| **Assault** (composite: the mover's step → `unitAttacked{source:'rogue.assault'}` for the Rogue's owner → `unitDamaged` → `unitRevealed` → `moveEnded{reaction}`) | One beat:<br>1. The step lands.<br>2. The Rogue's owner sees the faded Rogue dart in; the victim's owner sees a radial hit from nowhere, with the "?".<br>3. A 75 ms hit-stop.<br>4. The numeral.<br>5. The Rogue decloaks (victim's view), and an INK tick line flicks from the Rogue to the victim, now that both are visible.<br>6. "Ambushed!" plaque on the victim; the move stops | EMBER plaque, ASSAY decloak | about 900 ms | per hit | `stinger.ambush` (a short metal scrape and a low hit), once | Numeral, decloak, plaque |
| `minePlaced` (owner only) | The Artificer flicks a hex-nut mine 0.2 tile onto the square (`t.quick`). The mine blinks EMBER twice as it arms (2 × `t.snap`), then takes its owner-only look (55 %, dashed) | EMBER blink | 330 ms | none | `mine.place` (a ratchet click-clack) | It appears with its badge |
| `mineRevealed` (you detect an enemy mine) | The mine fades in inside an ASSAY iris ring; a "!" warning glyph pulses twice, then stays static | ASSAY | 400 ms | none | `mine.reveal` | It appears, with the glyph |
| `mineRevealed` (your mine was detected) | Its look gains an eye badge | ASSAY | `t.quick` | none | none | The badge |

### 6.7 Mines

| Event | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| `mineExploded`, `trigger: 'entered'` | 1. A 90 ms hit-stop and a flat additive flash disc of 0.9 tile (60 ms).<br>2. A dust ring spreading to 1.1 tile (300 ms), with an inked 1-tile blast outline for 400 ms.<br>3. 10-16 sparks and 6-10 sand clods thrown up, plus one short dark smoke puff (2-3 sprites rising 0.3 tile, 500 ms): the only smoke in the game.<br>4. A scorch decal; the victim jolts up 0.12 tile and drops.<br>5. Then `unitDamaged{kind:'mine'}` and "Mine!" | EMBER-white flash, EMBER numeral | 600 ms (settles at 150 ms) | 4 px (6 px for size 2) | `mine.explode` (a sharp crack, a low boom, debris patter) | The scorch decal, a static burst glyph for 400 ms, the numeral, the plaque |
| `mineExploded`, `trigger: 'shot'` (remote detonation) | The same blast, smaller and with no victim; a "Mine cleared" plaque for the shooter | EMBER | 500 ms | 2 px | `mine.explode.shot` | The scorch and the plaque |
| Your mine goes off where you can't see | The owner is always told. A muted ring pulses on the fogged square, a toast says "Your mine at K12 went off", and an edge arrow shows if it is off screen. No victim detail beyond the payload | EMBER outline | 400 ms | none | `mine.explode.far` (muffled) | The toast |

### 6.8 Areas

| Event | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| `areaCreated`, Forcefield (4 connected squares) | 1. The outline inks around the tetromino (2 px INK plus a 1 px STEEL inner line). It is drawn as a stroke starting from the square nearest the Wizard (`t.base`).<br>2. Hex cells (6 per tile) pop up from the slabs, 20 ms apart (`t.base` or less).<br>3. Then a steady 18 % hex wash and one `energy-shield` corner glyph | STEEL | 480 ms | none | `area.forcefield.raise` (a low hum and a glassy click) | The outline and wash appear whole |
| Forcefield active | A static wash; hits inside flash the nearby cells (§6.4) | STEEL | persistent | none | none | Static |
| `areaExpired`, Forcefield (at its owner's next turn start) | The cells fall as flakes and fade (`t.quick`) | STEEL | 150 ms | none | `area.forcefield.expire` (a soft shatter) | Removed |
| `areaCreated`, Pajazon (3×3) | A dashed INK square outline inks on (`t.base`). A slow swirl pattern (IVORY, 16 %) fills the 9 squares, and a counter disc "2" with an INK keyline sits at the centre | IVORY swirl, INK outline | 240 ms | none | `area.pajazon.cast` | The outline, a static swirl, the counter |
| Pajazon heal tick (end of the caster's turn; `unitHealed` with the Pajazon source) | MINT motes rise from each own unit inside, with "+3"; one beat for all | MINT | 600 ms | none | `tick.pajazon.heal` (once) | Numerals |
| Pajazon damage tick (end of the opponent's turn; `unitDamaged{kind:'tick'}`) | Thorns as in §6.4, with "−3"; one beat | EMBER | 600 ms | 2 px at most | `tick.pajazon.harm` (once) | Numerals |
| `areaExpired`, Pajazon | The swirl unwinds and fades; the counter flips to "0" and fades (`t.slow`) | IVORY | 400 ms | none | `area.pajazon.expire` | Removed |
| The opponent's partial view of an area (A4-13) | Only the squares received are drawn. Edges that border unseen squares fade out instead of closing the outline (L3) | as above | as above | none | as above | as above |

### 6.9 Abilities (`abilityUsed` and what follows it)

Every active ability starts with a **cast flourish** on the user: its icon glints and the coin lifts 0.04 tile for `t.quick`. The rows below describe what follows. An opponent who can see the user but receives `targets: []` sees only the flourish, plus whatever damage, heal or reveal events reach it (L2).

| Ability (id) | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| Savagery (`berserker.savagery`) | The second strike as in §6.4: the lunge from the other side, the EMBER rim flicker, 15 ms more hit-stop | EMBER | as a heavy strike | per hit | `ability.savagery` | The hit's RM |
| Shared wounds (`priestess.sharedWounds`) | 1. The donor shows TARNISH "−N" and a rim crack.<br>2. A thin ribbon arcs from the donor over the Priestess to the recipient, turning from TARNISH to MINT (400 ms).<br>3. The recipient gets the MINT heal, and the Priestess's grail glyph glints | TARNISH → MINT | 400 ms + heal | none | `ability.sharedWounds`, then `heal.transfer` | Both numerals; a static dotted ribbon for 400 ms |
| Julio Vernification (`juliomancer.julioVernification`) | 1. The sacrificed unit dissolves into TARNISH motes drawn into the Juliomancer (300 ms).<br>2. The third-eye glyph flares.<br>3. A straight lance (INK core, TARNISH edges) shoots to the target in 150 ms.<br>4. The hit, by A.<br>If you can't see the target, only steps 1 and 2 play | TARNISH lance, EMBER hit | 450 ms + hit | per hit | `unit.sacrifice.dissolve`, `ability.julio.bolt`, the hit | Fade, a dotted line, the numeral |
| Mind's Eye (`juliomancer.mindsEye`, `artificer.mindsEye`; passive) | Reveals arrive as `unitRevealed{cause:'detection'}` or `mineRevealed` and play as §6.6, with the scan line from the detector | ASSAY | 480 ms | none | `reveal.detect` | as §6.6 |
| Prototype No-ACB (`artificer.prototypeNoAcb`) | `unitCreated` as §6.5 | EMBER-white sparks | 600 ms | none | `unit.create.prototype` | Fade-in |
| Mad inventor (`artificer.madInventor`; an aura with no event, derived from the view) | While a dummy is adjacent to an own Artificer, a 2 px brass linkage line (GILT with an INK keyline) joins them. The dummy shows a gear badge and "+1" Power on its plate. Gaining the aura clicks the link in (`t.snap`); losing it snaps the link apart (two halves recoil, `t.quick`) | GILT | 90 / 150 ms | none | `aura.madInventor.link` (a small click) on gain | The link is shown or hidden |
| Trip Mine (`artificer.tripMine`) | `minePlaced` as §6.6 (owner only; secret to the opponent) | EMBER blink | 330 ms | none | `mine.place` | Appears |
| Forcefield (`royalWizard.forcefield`) | `areaCreated` as §6.8 | STEEL | 480 ms | none | `area.forcefield.raise` | Whole |
| Pajazon (`royalWizard.pajazon`) | `areaCreated` as §6.8 | IVORY / INK | 240 ms | none | `area.pajazon.cast` | Whole |
| Forceful slam (`beast.forcefulSlam`, target square T) | 1. Wind-up: the Beast lifts 0.12 tile and leans toward T (150 ms).<br>2. Slam: it drops and lunges 0.2 tile (90 ms), then a 90 ms hit-stop.<br>3. On T: a crack decal and the 10-damage hit.<br>4. On the 5 splash squares (the 3 beyond T and the 2 beside it, rules 8.12): each slab dips 0.02 tile and rebounds (`t.quick`); a dust jet on each square points away from the Beast (the fan is the shape code); the 3-damage hits jolt away from T.<br>5. An INK outline of T plus the fan holds for 400 ms | EMBER hits, INK fan outline | about 700 ms | 6 px along the slam direction | `ability.slam.windup`, `ability.slam.impact` (a deep thud and rubble), up to 3 hit layers | The fan outline and the numerals in place |
| Feast (`beast.feast`) | The eaten own unit slides under the Beast's rim and is crushed (240 ms, 3-4 TARNISH crumbs), then the Beast's MINT heal "+N" | TARNISH → MINT | 240 ms + heal | none | `ability.feast.crunch` | Fade and numerals |
| Holy blessing (`emissary.holyBlessing`) | A GILT-white **diamond** outline (the exact Manhattan range 2, tile-exact) expands from the Emissary over 400 ms. Each healed unit gets its MINT heal as the diamond passes it (80 ms per ring of distance). One soft 150 ms light shaft falls on the Emissary | GILT diamond, MINT | 400 ms + heals | none | `ability.blessing` (a warm bell swell) | The diamond outline for 400 ms, and the numerals |
| Smite (`emissary.smite`) | 1. A narrow GILT-white light shaft (0.3 tile) strikes the target for 150 ms (in top view: a bright disc with radial rays).<br>2. A 75 ms hit-stop, then the 8-damage hit.<br>3. A **plus-shaped** crack decal on the target's tile reaching into its 4 neighbours (the shape code). The 3-damage splash hits there (friendly fire included, R25) jolt away from the centre.<br>4. An INK plus outline holds for 400 ms | GILT shaft, EMBER hits | about 600 ms | 4 px, mostly vertical | `ability.smite` (a thunder-crack with a metal ring tail) | The plus outline and the numerals |
| Holy Fervor (`emissary.holyFervor`; passive) | On the Emissary's second action of the turn, a GILT halo ring shows on its coin (`t.base`). The action button showed "+1" (research-ux S-11.6) | GILT | 240 ms | none | `ability.fervor.second` (a soft chime) | The ring for 400 ms |
| Command Aura (`scourge.commandAura`; passive) | When a unit within range 2 takes the extra action the aura grants, a GILT ▲ flicks on that unit, with a faint iron line to the Scourge if it is visible (`t.base`). Selecting or hovering the Scourge shows its range-2 diamond as a dashed iron outline | GILT | 240 ms | none | `aura.command.extra` (a single drum tap) | The chevron |
| Tribute (`scourge.tribute`) | "+2 Tribute" in the AP refill at your turn start (§5.4) | GILT | 300 ms | none | `ap.tribute` | The chip |

### 6.10 Commanders

| Commander (id) | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| Trill (`trill.hydrocephalic`), Sabrina (`sabrina.reelfinisher`), Kulega's +1 LOV (`kulega.finePrinter`) | Static, with no runtime effect. The changed numbers are baked into plates and cards. The commander badge appears in tooltips, and in the damage breakdown when it contributes | n/a | n/a | n/a | none | n/a |
| Kulega's Fine Print (`kulega.finePrint`) | When a type-1 or type-2 unit dies next to an own type-20 unit, 1-4 MINT motes fly from the shards to each such unit (300 ms), then its MINT "+N" | MINT | 300 ms + heal | none | `heal.finePrint.quill` (a quill scratch and a soft chime) | Numerals |
| Ratasius, weakness (`ratasius.great`) | On a hit whose breakdown has this subtraction: the TARNISH "−4" chip, and a TARNISH ▼ flicker on the attacker (`t.base`) | TARNISH | 240 ms | none | `debuff.weakness` (a muffled thunk) | The chip |
| Ratasius, detection | Reveals within range 3 play as §6.6, with the scan line from Ratasius | ASSAY | 480 ms | none | `reveal.detect` | as §6.6 |
| Queso, beacon (`queso.beacon`, at the end of his own turn) | A thin GILT-white beam sweeps once around Queso (400 ms), lighting the outline of his range-2 diamond. Then MINT "+3" on the units healed, in one beat | GILT, MINT | 400 ms + heals | none | `heal.beacon` (a soft bell) | The diamond outline and the numerals |
| Queso, revive (`queso.revive`) | §6.5 | GILT, MINT, TARNISH | 650 ms | none | `unit.revive.queso` | as §6.5 |
| Baba Yaga, Mend (`babaYaga.mend`; not an action) | A MINT heal to max with a curl of dark green-violet "witch smoke" (2 sprites, 300 ms) | MINT | 600 ms | none | `ability.mend` (a bubbling hiss) | The numeral |
| Baba Yaga, Hex Ward (`babaYaga.hexWard`; an aura) | On hits, the STEEL "−1" chip (`witch-flight`). On gaining or losing the aura, tiny "+1 max" GILT or "−1" TARNISH chips. Selecting Baba Yaga shows her range-3 diamond | STEEL / GILT / TARNISH | 240 ms | none | `ward.hex` (a hiss) on hits | Chips |
| Baba Yaga, Cauldron (`babaYaga.cauldron`) | §6.5, plus the AP debt chip (§5.4) | MINT, TARNISH | 640 ms | none | `unit.revive.cauldron` | as §6.5 |

### 6.11 Objectives

| Event | Effect | Colour | Duration | Camera | Sound | RM |
|---|---|---|---|---|---|---|
| `buildingCaptured` | 1. The banner (the KayKit flag) drops from 0.6 tile above the roof and flutters twice (400 ms).<br>2. The emblem disc flips (rotation 180°, `t.slow`, `ease.move`) to the new owner's ring tone (research-art §9.3).<br>3. The 16-square capture ring traces solid in that tone (400 ms around), with a dust puff around the base; plaque "Keep captured" / "Market captured".<br>4. Keep: the controller's tokens get a brief GILT "+1" glint. Market: "+2 Market" appears in the next refill | owner tone, GILT | 400 ms + plaque | none | `objective.captured.yours` (a bright bell and a flag flap) / `objective.captured.theirs` (a low iron bell and a flap) | The swap and the plaque |
| `buildingContested` | Two `crossed-swords` glyphs appear on the ring edge facing each side's units, the dashed ring pulses twice (opacity), and a "Contested" plaque shows | IVORY | 480 ms + plaque | none | `objective.contested` (two short blade clashes) | Glyphs and the plaque |
| `buildingHeld` | The emblem glints once (a 240 ms sheen) | owner tone | 240 ms | none | none | none |
| Siege counter change (`view.siegeTurns`, at `turnStarted`) | The Siege track, §5.4 | brass; EMBER at 4 | `t.snap` | none | `objective.siege.tick` / `.warn` / `.reset` | The segments are set |
| Siege win | `gameEnded` for siege (§6.2) | owner tone | 1 s + panel | none | `objective.siege.win` | Instant |

### 6.12 Session events (prompts, take-backs, draws)

| Event | Effect | Sound |
|---|---|---|
| `decisionRequested` (you decide) | A prompt card in the banner slot with a 15 s ring; the subject holds its cracked frame (§6.5) | `ui.prompt.open` |
| `decisionRequested` (the opponent decides and `view.opponentDeciding` is true) | A "Friend is deciding…" banner with the 15 s ring. Otherwise nothing distinct shows (L5) | none |
| `decisionResolved` | The card stamps the choice and leaves (`t.quick`). An `automatic` answer (a preference or a timeout) shows a small "auto" tag | `ui.prompt.close` |
| `takebackRequested` | The take-back cards of §5.4 | `ui.prompt.open` |
| `takebackApplied` | The rewind, §7.7 | `ui.takeback.rewind` |
| `takebackDeclined` | The card stamps "Declined" and leaves | `ui.prompt.declined` |
| `drawOffered` / `drawDeclined` | A banner card with Accept and Decline / a "Declined" stamp | `ui.prompt.open` / `ui.prompt.declined` |
| `preferenceChanged` | Options UI only | none |
| `abilityNote` | A small IVORY toast with the note (for example a failed revive), or a plaque where §6 names one ("Spotted!") | `ui.note` |

### 6.13 Sound cue registry

**Ids:** `family.subject[.variant]`, lowercase with camelCase segments.

**Playback rules:**
- Each cue has 3-5 takes, played round robin, with ±4 % pitch and ±1.5 dB gain randomisation.
- Each family may play 3 voices at once (12 in all).
- Priorities decide stealing and skipping: **1** match end, **2** deaths, **3** interruption stingers, **4** hits and blasts, **5** abilities, **6** reveals, **7** heals and wards, **8** movement and UI.

**Tier pitch** for `move.step.coin`, `atk.*` and `hit.*`: tier 1 +8 %, 2 +5 %, 5 +2 %, 10 0, 20 −3 %, 50 −6 %, 100 −9 %, the commander 0. Size 2 uses separate "beast" takes.

**Levels:** normalise every cue to −1 dBFS true peak, and mix UI cues 6 dB under the effects.

| Family | Cues | Character | First source to try (CC0 unless noted) |
|---|---|---|---|
| `move` | `step.coin`, `step.beast`, `charge.run`, `charge.skid`, `march`, `blocked.bump` | a coin set on sand or wood, short; boots and a drum for the march | Kenney Casino Audio (chips, dice), Kenney Impact Sounds |
| `atk`, `shot` | `swing.light`, `swing.heavy`, `swing.beast`; `bow.release`, `arrow.ground` | short air and leather, no cartoon whoosh tails | Kenney RPG Audio (weapons), Kenney Impact Sounds |
| `hit` | `metal.light`, `metal.heavy`, `metal.crush` | a struck coin: a clang with a short ring, plus a body thud for heavy hits | Kenney Impact Sounds (metal), Kenney Casino Audio (coin rings) |
| `ward` | `defend.block`, `armor.clank`, `line.lock`, `forcefield.absorb`, `hex` | a muted shield thud; a bright deflection clank; a glassy hum | Kenney Impact Sounds; the Sonniss GDC bundles (royalty-free; check each year's licence) |
| `heal`, `tick` | `tick.soft`, `beacon`, `transfer`, `finePrint.quill`; `pajazon.heal`, `pajazon.harm` | soft bells and chimes, never sparkly | freesound.org filtered to CC0; Sonniss |
| `unit` | `death.shatter.light`, `death.shatter.heavy`, `death.commander`, `sacrifice.dissolve`, `revive.queso`, `revive.cauldron`, `create.prototype` | a crack plus coin clatter (several pings slowing, like a dropped coin) | Kenney Casino Audio (chips), Kenney Impact Sounds |
| `status`, `reveal`, `stinger` | `defend.raise`, `defend.drop`, `stealth.on`; `detect`, `exposed`; `spotted`, `ambush` | cloth, a clasp, a glass tink, a short tense scrape | Kenney RPG Audio, Kenney Interface Sounds |
| `mine` | `place`, `reveal`, `explode`, `explode.shot`, `explode.far` | a ratchet click; a sharp crack, a low boom, debris patter | Kenney Impact Sounds; Sonniss |
| `area` | `forcefield.raise`, `forcefield.expire`, `pajazon.cast`, `pajazon.expire` | a low hum, a glassy click, a soft shatter | Sonniss; freesound CC0 |
| `ability`, `aura`, `debuff`, `ap` | `savagery`, `sharedWounds`, `julio.bolt`, `slam.windup`, `slam.impact`, `feast.crunch`, `blessing`, `smite`, `fervor.second`, `mend`; `command.extra`, `madInventor.link`; `weakness`, `maxToughness`; `tribute` | foley first, with at most one tonal layer | mixed |
| `objective` | `captured.yours`, `captured.theirs`, `contested`, `siege.tick`, `siege.warn`, `siege.reset`, `siege.win` | bells (brass for yours, iron for theirs), a flag flap, a blade clash, a drum | Sonniss; freesound CC0 |
| `coin`, `deploy`, `match` | `flip.toss`, `flip.land`; `place`, `lift`, `confirm`; `battleStart`, `domination`, `victory`, `defeat`, `draw` | a real coin toss and ring-down; short stings of 2.5 s or less | Kenney Casino Audio; Sonniss |
| `ui` | `nav`, `drawer`, `ready`, `settings`, `countdown.tick`, `turn.yours`, `turn.theirs`, `ap.spend`, `ap.refill`, `timer.tick`, `button.arm`, `prompt.open`, `prompt.close`, `prompt.declined`, `takeback.rewind`, `firstContact`, `tally`, `note` | paper, wood ticks, soft brass | Kenney Interface Sounds |

- The Kenney packs were verified on kenney.nl on 2026-10-24, all "Creative Commons CC0":

  | Pack | Files | Tags |
  |---|---|---|
  | Impact Sounds | 130 | impact, foley |
  | Casino Audio | 50 | chip, dice, card |
  | RPG Audio | 50 | footstep, weapon |
  | Interface Sounds | 100 | interface, click, button |

- Ambience (room tone, a distant camp, wind over sand) at −24 dB under the table is optional.
- Music is an open question (Q5).

---

## 7. Animation queue policy

### 7.1 Batches, beats and settle points

- **Batch:** the `VisibleEvent[]` that arrives with one `submit` (one intent), together with the new `PlayerView`. The view is the truth (README); events drive the animations, the log and achievements.
- **Beat:** one readable moment, such as a path, a strike with its damage, a death, a blast, an area cast, one end-of-turn tick or a reveal. The **director**, a pure function (§8.1), turns a batch into a **timeline of beats**.
- **Settle point:** the moment a beat's information is on screen. Typical settle points:
  - move: the last landing;
  - strike: contact, plus the hit-stop, plus 120 ms;
  - death: 300 ms;
  - blast: 150 ms;
  - area: the outline complete;
  - heal: the numeral up.
- **Cosmetic tail:** whatever follows a beat's settle point (the numeral's rise and fade, particles, shards sinking, the decal fading in). Tails never block anything.

### 7.2 Ordering and overlap

1. **Engine order.** Beats play in the order the engine emitted them. The order means something: mine, then Assault, then reveal, then interruption (rules 2.5); damage before healing; the non-active player's triggers first (rules 2.11).
2. **Grouping into one beat:**
   - one unit's consecutive `unitMoved` steps;
   - `unitAttacked` with its `unitDamaged` (and breakdown);
   - an `abilityUsed` with its direct results;
   - every hit of one simultaneous effect (`dealSplash`, the end-of-turn ticks, Holy blessing's heals);
   - all the first steps of a Group march;
   - `apChanged` with `turnStarted`.
3. **Overlap:** the next beat may start at the previous beat's settle point if they touch different tokens and the next one doesn't depend on it. Cosmetic tails always overlap.
4. **Never overlap:**
   - two beats on the same token;
   - a cause and its effect (blast → damage → death);
   - a death and that unit's revive;
   - anything after a `decisionRequested` for you: the queue holds until `decisionResolved`.
5. **Display state vs view.** The logical state applies at once: HUD logic, legal actions, previews and picking all use the new view. The board's display state trails it through the timeline. When the queue empties, display and view are equal; a development assertion checks it.

### 7.3 Input gating: "settle, then send" (recommended)

| Option | What it does | Verdict |
|---|---|---|
| **Settle, then send** (recommended) | The player may hover, select, open targeting and see previews at any time during animations, all computed from the new view. Confirming an intent while beats remain **snaps the queue to the batch's last settle point**: the remaining beats jump to their end state, the tails keep playing, and the intent is sent in the same frame | **Adopt** |
| Intents wait | Confirm is disabled until the queue is empty | Rejected: experts wait 1-2 s per action, and 30-50-unit armies suffer most |
| Free input, effects trailing | Intents go at once; animations keep playing behind, possibly several actions late | Rejected: what you see is not the state you act on |

Reasons for the recommendation:
1. **The view is already final**, so planning on it is safe and costs nothing. "The UI never infers anything that isn't in an event" (research-ux §27.4) still holds.
2. **Fog makes interruptions the key information** (Blocked!, Mine!, Ambushed!, Spotted!).
   - Snapping to the settle point means the player always *sees* the final state the commit is based on.
   - Plaques are sticky (below), so an ambush can't scroll past unseen.
3. **Take-backs need the opponent's consent** (spec: the opponent has to accept), so preventing a misread beats undoing it.
4. **No hidden timing.** Input is never held longer because of something hidden, which keeps L5 true.
5. **The display never drifts.** At most one batch is ever in flight, so no token is drawn far from its logical square when the player clicks.

Rules that go with it:
- **Sticky plaques:** a plaque (and its log line) stays for its full hold, even when its beat is skipped. Skipping moves time; it doesn't hide facts.
- **Picking uses logical squares:** clicking a square selects what the view says is there. A token in mid-travel snaps to its square when clicked.
- **The command gate** (research-ux §23.1) still closes for take-back requests, reaction prompts and the opponent's turn. The queue never closes it by itself.

### 7.4 Skip, fast-forward, speed and intensity

| Control | Effect |
|---|---|
| **Space**, or a click on empty board | Skips the current beat to its end state |
| Space twice within 300 ms | Skips every remaining beat of the batch (plaques stay) |
| Holding **Shift** (or the ⏩ button) | 3× while held |
| Options "Animation speed: Normal / Fast / Instant" (BT-38) | **Normal:** 1×.<br>**Fast:** 2× for travel and tails, with hit-stop, shake and particle counts halved.<br>**Instant:** no travel or impact animation; numerals and plaques still show for their hold |
| Options "Effects intensity: Full / Subtle / Off" | **Full:** the default.<br>**Subtle:** no shake, half the particles, decals at 50 %.<br>**Off:** numerals, chips, plaques and rings only. Independent of reduced motion |
| The opponent's actions | Never faster than Fast (BT-38), except while catching up (§7.5) |
| Audio when skipping | Skipped beats play no sound. Instead, one summary cue plays: the highest priority among them (death > blast > hit > reveal > move), so the ear agrees with the board |
| Audio at Fast | Only the highest-priority cue of each beat |

### 7.5 The opponent's turn

- **Live:**
  - Each opponent action arrives as a batch holding only what you can see. It plays at your speed, never faster than Fast.
  - A backlog of more than one batch plays at 2× until it has caught up (S-19.2).
  - After an absence (research-ux §20.3), up to 10 waiting events play at 3× under a "Catching up…" chip. With more than 10, the board snaps to the view, and a toast says "While you were away: 3 visible events [View]".
- **Camera:** never moves on its own (S-19.2).
  - Off-screen events get an edge arrow in the event's signal colour and a toast with [Show]; hits on your units pulse the arrow EMBER.
  - An Option "Follow visible enemy actions" exists, off by default.
- **Replay last turn** (S-19.5):
  - The client stores `{ viewAtStart, batches: [{ events, viewAfter }] }` for each of the last two opponent turns. This is its own filtered data, so a replay can't leak.
  - "Replay Friend's turn 8" swaps the board to a replay display (an IVORY dashed frame and "Replay · Esc to exit"). It restores `viewAtStart` and plays the batches at 2× through the same director; Space and Shift work as live.
  - It is available from the opponent's End Turn until the end of your next turn. Any commit, or a new batch, exits the replay instantly.
- **Hidden waits** look like latency (L5).

### 7.6 Group march batching

A `groupMarch` batch carries each marcher's `unitMoved` and `moveEnded`, front to back. The director makes:
- **one beat for all the first steps:** a 30 ms stagger front to back, one `move.march` cue and the direction chevron;
- **one beat per interruption**, in engine order (a mine under the third marcher, an Assault on the fifth). Each plays at its unit's position while the others are already settled.

Up to 3 random step taps play, never one per unit.

### 7.7 Take-back rewinds

An accepted take-back arrives as `takebackApplied` plus a restored view, with no reversed events. The director builds the rewind from the difference between the current display state and the restored view, using the undone batch from its log where it can.

- **Movement and deaths:**
  - Moved tokens slide back along the reversed path (or straight, if the path is unknown): 400 ms in all at Normal.
  - Units that died un-shatter (the shatter in reverse, 400 ms); sacrificed units re-condense.
  - Created dummies dissolve back into their Artificer (`t.base`), and areas created by the undone action fade (`t.quick`).
- **Mines and memory:**
  - The owner's mine reappears.
  - For the requester, an enemy mine that the undone action had revealed disappears and leaves a "remembered hazard" marker (IVORY, dashed; research-ux §25.5).
  - An enemy Rogue that ambushed leaves a "seen here" ghost.
- **State:** AP refunds tick up, captured buildings flip back (when an End Turn is undone), and fog tiles revert (`t.quick`).
- **Signals:** a ↶ plaque on the restored unit, the log line struck through, and `ui.takeback.rewind` (a short reversed ratchet).
- **Reduced motion:** a 150 ms crossfade to the restored state, plus the plaque.

### 7.8 Reaction prompts

- **The decider:** when a `decisionRequested` for you arrives mid-batch, the queue plays up to it and holds. Later beats wait for `decisionResolved`; they arrive in a later batch anyway.
- **The active player:** their queue simply ends. The "Friend is deciding…" banner appears only if `view.opponentDeciding` is true.

### 7.9 Determinism and tests

- `buildTimeline(batch, viewBefore, viewAfter, settings, seed)` is pure.
  - Random variation (spark directions, shard spins, sound takes) comes from a small seeded RNG keyed on the batch's sequence number.
  - So a replay looks and sounds the same.
- Unit tests (vitest, no WebGL) build batches with the engine DSL (`buildBattle`, `act`) and assert:
  - beat grouping and order;
  - that no directional element is created when `dealerId` is null or `targets` is empty (L1, L2);
  - partial-area drawing (L3);
  - the reduced-motion variants;
  - settle points and skip semantics (plaques are sticky).

---

## 8. Implementation notes: three.js r186 + R3F 9.8 + drei 10.7, no custom GLSL

The framework research rules out raw GLSL so the R3F v10 / WebGPU migration stays painless (research-framework §0.5). Everything below uses stock materials, `CanvasTexture` and CPU-side updates.

### 8.1 Architecture

```
events + view ──► director (pure TS) ──► timeline of beats ──► FX layer (R3F, useFrame)
                                                      ├─► display store: per-token offsets {dx, dy, dz, tiltX, tiltZ, scale, opacity}
                                                      ├─► effect pools: sparks, chips, dust, numerals/plaques, scars, areas, lines, shards
                                                      ├─► camera shake offset, hit-stop
                                                      ├─► HUD signals (zustand): AP ticks, banners, plaques, Siege track
                                                      └─► audio engine (cue ids)
```

- Tokens render at their logical square plus a display offset. The FX layer mutates `Object3D`s through refs inside `useFrame`; it never sets React state per frame.
- A `zustand` slice holds the queue state (`beats`, `speed`, `motion: 'full' | 'reduced'`, `intensity`, the `lease` count). The HUD subscribes to discrete signals only (a banner shown, the plaque list).
- Suggested files for the renderer agents (not created here): `render/fx/director.ts`, `timeline.ts`, `fxClock.ts`, `tween.ts`, `pools/*.ts`, `shake.ts`, `audio/engine.ts`, `audio/cues.ts`.

### 8.2 Effect clock and hit-stop

One `useFrame` at a high priority advances the effect clock:

```ts
// fxClock.ts
let t = 0, hitStop = 0
export function advance(delta: number, speed: number) {
  const dt = Math.min(delta, 1 / 20) * speed     // clamp tab-switch spikes
  if (hitStop > 0) { hitStop -= delta; return 0 } // freeze the effects, not the app
  t += dt
  return dt
}
export const freeze = (ms: number) => { hitStop = Math.max(hitStop, ms / 1000) }
```

The hit-stop freezes tweens, particles, shards and token offsets. Rendering, hover, the HUD and audio carry on: the clang rings through the freeze, and that is what sells the weight.

### 8.3 Tweens

- **A tiny custom tweener** (about 80 lines) driven by the effect clock:
  - `tween(target, key, to, ms, ease, delay)`, using the cubic-bezier easings of §5.1 (a 15-line bezier solver);
  - a promise-style `onDone`, so beats can be written as sequences.
- **`maath`** (0.10.8, already installed as a drei dependency) covers springs and curves. Verified in `maath/dist/declarations/src/easing.d.ts`:
  - `easing.damp(obj, 'x', target, smoothTime, delta)`, `damp3`, `dampE`, `dampC` and `dampQ` return `true` while still moving, which plugs straight into the animation lease (§8.7);
  - its curves are `easing.cubic`, `quart`, `quint`, `expo`, `circ` and `sine`, each with `in`, `out` and `inOut`.

### 8.4 Primitives

| Primitive | three.js building block | Draw calls | Notes |
|---|---|---|---|
| Sparks | One `THREE.Points` with a 512-slot `BufferGeometry` (`position` with 3 components, `color` with **4**) and `PointsMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: false, map: softDot })` | 1 | three r186 enables per-vertex alpha when `vertexColors` is on and the colour attribute has 4 components (`vertexAlphas` in `WebGLPrograms.js`, verified). Integrate on the CPU and use `setDrawRange(0, live)` |
| Metal chips | One `InstancedMesh(PlaneGeometry(0.035, 0.02), MeshStandardMaterial({ metalness: 0.7, roughness: 0.4 }), 256)` with `instanceColor` set to brass or iron | 1 | Per-instance alpha needs a shader, so chips never fade: they lie on the sand and sink (scale y → 0) at 1.2 s, which suits metal |
| Dust and smoke | A pool of up to 24 `THREE.Sprite`s with `SpriteMaterial({ map: softBlob, depthWrite: false, transparent: true })`; opacity and scale are tweened per sprite | up to 24 | Sand `#CDBB8E`, smoke `#3B3530` |
| Numerals and plaques | `Sprite`s with `CanvasTexture`s, cached by (text, style) in an LRU of 64. They are drawn with the HUD fonts after `document.fonts.load('800 48px "Barlow Semi Condensed"')`, use `depthTest: false` and a high `renderOrder`, and are sized in screen pixels | up to 12 | Alternatives: drei `<Html>` (DOM, crisp) for a few plaques; drei `Text` (troika SDF) adds about 42 KB gzip (research-framework §3.2) |
| Scars (decals) | **One board-sized `CanvasTexture` "scar layer"** (1024², about 41 px per tile, 4 MB) on a single plane just above the slabs. Decals are painted with 2D canvas operations, and the layer is repainted with lower alpha at turn starts | 1 | Any number of decals for one draw call, with no z-fighting between decals. Upload only on change (a few times per turn) |
| Area overlays | For each area, a group of tile planes with `CanvasTexture` patterns (hex cells, swirl) and a quad-strip outline | 2-3 per area | Clip to the squares received (L3) |
| Lines (outlines, scan lines, tethers, arrow trails) | Quad strips (`PlaneGeometry` or thin `BoxGeometry` segments, like the art page's zone outlines) with `MeshBasicMaterial` | 1 per line | `LineBasicMaterial` draws 1 px only, and drei `<Line>` uses `LineMaterial`, a ShaderMaterial from three's examples |
| Shards | For each death, N wedges of `CylinderGeometry(r, r, h, segs, 1, false, θ0, Δθ)` sharing the token's materials, moved on the CPU with ballistic motion and one bounce | N per death (at most 4 deaths shatter at once; later ones fade) | Cylinder caps map UVs by absolute angle (`uv.x = cosθ·0.5 + 0.5`, verified in `CylinderGeometry.js`), so each wedge keeps its slice of the face. The cut sides are open, so render with `side: DoubleSide` |
| Rings and flashes | `RingGeometry` / `CircleGeometry` planes with `MeshBasicMaterial` (additive for flashes) | 1 each | Iris rings, impact rings, the blast flash |

### 8.5 Camera shake

- **Offset the world, not the camera.** A controller offset on the camera works too, but it fights the camera controls each frame. Instead, apply the offset to the root group of the board each frame.
  - Convert pixels with `worldPerPx = (camera.top - camera.bottom) / (camera.zoom * viewportHeightPx)`.
  - Apply the result along the camera's right and up vectors.
- **Model:** a damped sine with a little noise, `A · e^(−5t/D) · sin(2π · 16 Hz · t + φ)`.
  - The first 60 ms follow the projected hit direction.
  - The amplitude A and duration D come from §4.2; within a beat the largest wins.
  - For several beats in quick succession, accumulate Eiserloh-style trauma (displacement ∝ trauma², linear decay), capped at 6 px.
- **Off** under reduced motion and when "Effects intensity" is Subtle or Off.

### 8.6 drei helpers: what fits

- **`Billboard`:** for iso-view plaques and numerals that must face the camera. Top view needs nothing.
- **`Trail` and `Sparkles` are shaders by another name.** Verified in `node_modules/@react-three/drei/core`:
  - drei 10.7.9's `Trail` uses `meshline`'s `MeshLineMaterial`;
  - `Sparkles` defines its own `SparklesImplMaterial extends ShaderMaterial`.

  Both work on R3F 9 with WebGL, but they carry the same WebGPU-migration risk as custom GLSL. If used at all, put them behind the effects adapter: `Sparkles` (count 12 or less, 600 ms) as the Emissary's optional shimmer, `Trail` for the arrow. The defaults above need neither.
- **No post-processing** (`EffectComposer`, bloom): style C is rejected, and `@react-three/postprocessing` would cap three below r187.

### 8.7 Render on demand

The board uses `<Canvas frameloop="demand">` (research-framework §4.9). The FX layer holds an **animation lease**: a counter of live beats, tweens, particles, shards and shake.

```ts
const setFrameloop = useThree((s) => s.setFrameloop)     // R3F 9.8 RootState (verified)
function acquire() { if (lease++ === 0) setFrameloop('always') }
function release() { if (--lease === 0) { setFrameloop('demand'); invalidate() } } // one last frame
```

- Outside animations, hover and selection keep calling `invalidate()` as they do today.
- When the tab is hidden, the queue jumps to the end state (so there is no burst of stale animation on return) and the lease drops.
- Alternative: stay on `demand` and call `invalidate()` from the FX `useFrame` while anything is alive. It is easier to get wrong, so the lease is preferred.

### 8.8 Budget (mid-range laptop, 1080p, integrated GPU)

| Item | Typical | Peak (cap) |
|---|---|---|
| Extra draw calls from effects | 20 or less | 60 or less (a Slam that kills two units: 2 × 6-10 shards, plus dust, numerals and outlines) |
| Sparks alive | 60 or less | 512 |
| Metal chips alive | 40 or less | 256 |
| Dust and smoke sprites | 8 or less | 24 |
| Numerals and plaques | 4 or less | 12 |
| Shard meshes | 0-10 | 40 (4 shattering deaths; further deaths in the same beat use the fade variant) |
| Effect CPU per frame | 0.5 ms or less | 1.5 ms |
| Texture memory for effects | about 6 MB | 12 MB (the 4 MB scar layer plus caches) |
| Shadows | Effects cast no shadows (`castShadow = false`) | n/a |
| Post-processing | none | none |

### 8.9 Audio engine

- **Context and buses:** the Web Audio API with one `AudioContext`, created or resumed on the first user gesture (autoplay rules).
  - Buses: master → effects / UI / ambience, plus music if adopted.
  - The Options volumes are master 80, effects 80, music 50 (product-ux Options table, G-11).
- **Cue registry:** `{ id, takes[], gainDb, pitchVar, priority, family, maxVoices }`, decoded at load.
  - A voice pool enforces the family limits and steals by priority.
  - The same cue requested twice within 40 ms merges (Group march, splash).
- **Files:** `.webm` (Opus), with an `.mp3` fallback chosen through `canPlayType`; about 2-3 MB for v1.
- **When cues play:** only for events the player received (L7), and every cue has a visual twin (A11Y-07).

### 8.10 Testing

- **The director:** vitest with engine DSL fixtures (§7.9).
- **The FX layer:** `@react-three/test-renderer` (9.1.1, research-framework §2) for scene-graph assertions without WebGL: pools reset, the lease returns to 0, and display equals view after the queue.
- **Visual checks:** the mock page doubles as a manual test bench. A Playwright screenshot of each library effect at its settle point catches regressions.

---

## 9. Open questions for the owner

1. **Blood or not?** Coins don't bleed, so the default is metal chips, sparks and scorch marks only. Do you want some ink blood for "living" units?
2. **How long should battle scars last?** The default is that they fade over 2 own turns. The alternatives: they stay all match (a record of the fight, as in Battle Brothers), or there are none.
3. **Death:** the coin shatters (default), bends and topples flat like a spent coin, or is "defaced" (struck through) and fades. Which feels right?
4. **Voices:** none by default (foley only). Do you want unit barks or a narrator later, in the spirit of Darkest Dungeon?
5. **Music:** you said sound effects are in scope. Is music? The default is no battle music, a quiet room-tone ambience, and short stings at the start and end of a match.
6. **Shake and intensity:** subtle shake (6 px or less) on by default, plus "Effects intensity: Full / Subtle / Off", separate from reduced motion. OK?
7. **Revealed ring colour:** the art direction uses violet `#B07CFF` for a revealed unit. This spec proposes ASSAY cyan, so violet always means "debuff or cost". Accept?
8. **Speed of the opponent's turn:** live at your own speed (default), or always Fast?

---

## 10. Sources

Verified on 2026-10-24 unless marked.

**Engine and rules**
- `packages/engine/README.md` (Events, Intents, the authority loop).
- `packages/engine/src/`: `events.ts`, `commands.ts`, `resolve.ts`, `turn.ts`, and the ability files `abilities/units/rogue.ts`, `abilities/units/artificer.ts`, `abilities/commanders/queso.ts`, `abilities/commanders/babaYaga.ts`. These gave the event payloads, the `secret` abilities, the decision kinds and the turn-start order.
- `docs/RULES_INTERPRETATION.md` (R1-R42, §2, §6, §7, §8, §9).

**Art and UX**
- `docs/analysis/research-art.md` (§0, §5, §6, §9.3, §10, §11) and `docs/analysis/research-art/palettes.json`.
- `docs/art-direction/index.html` (the token builder, bezel and side data).
- `docs/analysis/product-ux.md` (G-11, BT-03, BT-29 to BT-31, BT-38, A11Y-02, A11Y-05, A11Y-07, the Options table).
- `docs/analysis/research-ux-conventions.md` (§5, §11, §12, §13, §15, §19, §20, §23, §25-27).
- `docs/analysis/research-framework.md` (§0, §2, §3.2, §4.9).

**Libraries** (in `node_modules`)
- three 0.186.1: `src/renderers/webgl/WebGLPrograms.js` (vertex alphas), `src/geometries/CylinderGeometry.js` (cap UVs).
- @react-three/fiber 9.8.2: `setFrameloop` and `invalidate` in `dist/declarations/src/core/store.d.ts` and `loop.d.ts`.
- @react-three/drei 10.7.9: `core/Trail.js` uses meshline's `MeshLineMaterial`; `core/Sparkles.js` defines `SparklesImplMaterial extends ShaderMaterial`.
- maath 0.10.8: `easing.d.ts`.

**Audio**
- The kenney.nl pages for Impact Sounds, Casino Audio, RPG Audio and Interface Sounds: licence "Creative Commons CC0"; 130, 50, 50 and 100 files.
- The Sonniss GDC Game Audio Bundle: royalty-free, commercial use and no attribution, according to coverage of the 2018-2026 bundles (gamefromscratch.com, rekkerd.org). Check the current licence text on sonniss.com before use.

**Talks and articles**
- Masahiro Sakurai, "Hitstop", *Masahiro Sakurai on Creating Games* (YouTube; the channel launched on 2022-08-23). Coverage: Anime News Network, Nintendo Wire.
- Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras With Math", GDC 2016 (gamedeveloper.com, "Video: Sprucing up cameras with math"). Its trauma model as implemented in Bevy's 2D screen-shake example and cited by a three.js forum implementation.
- Matthew Davis, "'Into the Breach' Design Postmortem", GDC 2019 (gdcvault.com/play/1025772).
- Zach Gage's GDC 2018 talk on games readable at a glance and the "Three Reads" model, illustrated with Into the Breach screens (Gigazine, 2018-05-01).
- Darkest Dungeon's combat zoom on melee hits, ranged hits and skills, and a community mod that removes it except on crits (Steam community discussion for app 262060).

**From memory, not re-checked today**
- Battle Brothers: pieces that lunge and recoil; blood and bodies that stay on the battlefield.
- Inscryption: the tactile table.
- Into the Breach: tile-anchored effects.
- Mark of the Ninja: sound drawn as rings.
- Slay the Spire: slash marks.
- The particle and bloom styles of Diablo III and IV, Hades, Divinity: Original Sin 2, Hearthstone (a board shake scaled by cost) and Total War: Warhammer III.
- Vlambeer's "The Art of Screenshake" and Jonasson and Purho's "Juice it or lose it" (2012), as the outer bound of "juice" that this spec stays well inside.

---

## Appendix A. Tokens ready to paste

```css
:root {
  --t-snap: 90ms; --t-quick: 150ms; --t-base: 240ms; --t-slow: 400ms;
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-move: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-strike: cubic-bezier(0.55, 0, 1, 0.45);
  --sig-ember: #F24E1E; --sig-mint: #96DDB4; --sig-steel: #86A6CF; --sig-gilt: #F6EC93;
  --sig-tarnish: #A27CFA; --sig-assay: #4FE3F5; --sig-ivory: #F3EAD2; --sig-ink: #1B1410;
}
@media (prefers-reduced-motion: reduce) {
  :root { --t-snap: 0ms; --t-quick: 150ms; --t-base: 150ms; --t-slow: 150ms; }
}
```

```ts
export const MOTION = { snap: 90, quick: 150, base: 240, slow: 400, step: 160, chargeStep: 110 } as const
export const HOLD = { numeral: 900, plaque: 700, banner: 900 } as const
export const SPRING_RECOIL = { damping: 0.63, hz: 6 } as const
export const IMPACT = [ // by final damage A
  { maxA: 2,  hitStopMs: 0,  jolt: 0.04, sparks: 3,  chips: 2,  shakePx: 0, shakeMs: 0,   numeralPx: 16, cue: 'hit.metal.light' },
  { maxA: 4,  hitStopMs: 60, jolt: 0.06, sparks: 5,  chips: 3,  shakePx: 0, shakeMs: 0,   numeralPx: 16, cue: 'hit.metal.light' },
  { maxA: 9,  hitStopMs: 60, jolt: 0.08, sparks: 8,  chips: 5,  shakePx: 2, shakeMs: 120, numeralPx: 20, cue: 'hit.metal.heavy' },
  { maxA: 19, hitStopMs: 75, jolt: 0.11, sparks: 12, chips: 8,  shakePx: 4, shakeMs: 180, numeralPx: 20, cue: 'hit.metal.heavy' },
  { maxA: Infinity, hitStopMs: 90, jolt: 0.14, sparks: 16, chips: 12, shakePx: 6, shakeMs: 240, numeralPx: 26, cue: 'hit.metal.crush' },
] as const
export const KILL_HITSTOP_BONUS_MS = 15, COMMANDER_KILL_HITSTOP_MS = 120, SHAKE_CAP_PX = 6
export const SIGNAL = { ember: '#F24E1E', mint: '#96DDB4', steel: '#86A6CF', gilt: '#F6EC93', tarnish: '#A27CFA', assay: '#4FE3F5', ivory: '#F3EAD2', ink: '#1B1410' } as const
```

Under reduced motion the CSS durations drop to 150 ms rather than 0, so fades stay perceptible. The components remove travel (they switch to crossfades); the tokens don't.

## Appendix B. How the colour check was run

1. **Simulation and distance.** `signal_check.py` takes each signal hex and simulates deuteranopia, protanopia and tritanopia (Machado, Oliveira & Fernandes 2009, severity 1.0) and greyscale, exactly as `research-art/cvd_check.py` does. It converts to CIELAB (D65) and computes CIEDE2000 against the seven grades of palettes D and C, and between the signals.
2. **Search.** The candidates came from a grid search in OKLCH, with one hue window per meaning:

   | Meaning | Hue window |
   |---|---|
   | Damage | 25-45° |
   | Heal | 155-185° |
   | Ward | 235-265° |
   | Reveal | 195-225° |
   | Debuff | 290-320° |
   | Buff | 80-105° |

   Lightness ran from 0.58 to 0.96, with chroma floors so each colour still reads as its meaning. The search maximised the minimum distance, weighting CVD distances 1.35×, and required at least 4.5:1 contrast on INK.
3. **Rounding.** The search output was rounded by hand to the hexes above and measured again.
