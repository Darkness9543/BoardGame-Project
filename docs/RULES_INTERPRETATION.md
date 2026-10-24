# Rules Interpretation

**Engine baseline v1 for the 1v1 turn-based strategy board game**

| | |
|---|---|
| Status | The authoritative interpretation the rules engine is built from. Where this document differs from an analyst file, this document wins. |
| Date | 2026-10-24 |
| Spec | `GameSpec.pdf` (the owner's original, two-column layout) and `docs/SPEC.md` (Markdown with the roster table restored and the owner's chat rulings appended). **Line references `Lnn` in this document point into `docs/SPEC_ORIGINAL.md`**, the 136-line first paste that the analysts worked from; `docs/SPEC.md` has since been re-laid out, so its line numbers differ. |
| Synthesised from | `docs/analysis/rules-lawyer.md` (**RL**), `docs/analysis/abilities.md` (**AB**), `docs/analysis/balance.md` (**BA**), `docs/analysis/product-ux.md` (**PX**; the brief called it `product.md`, the file on disk is `product-ux.md`). `docs/analysis/research-netcode.md` (**NC**) was consulted for authority, take-back and prompts. |
| Precedence | The owner's answers > `SPEC.md` > this document > the analyst files. |
| Verification | The board shape, zone sizes, LOV counts, Size-2 neighbourhoods, the Forceful slam template and the default map (symmetry, connectivity, path lengths) were re-computed with a script for this document. All figures quoted below match. A completeness review then checked every spec line, and every unit stat digit by digit, against this document; Appendix C maps each spec line to where it is covered. |

**How to read this document**

- `> "..." (Lnn)` quotes the spec.
- A rule the spec states outright is tagged **[SPEC Lnn]**. A rule that is our default carries an assumption ID such as **[A3-04]**. Section 10 lists every assumption with its confidence and the spec text it interprets.
- Confidence: **High** = the text supports it, or it is the only workable reading. **Med** = the most likely intent, cheap to change. **Low** = a placeholder so work isn't blocked; the owner should decide.
- `CONSTANT_NAMES` are tunables or rule switches (Appendix A). Build them as named constants, data, or lobby/dev settings, never as scattered literals.
- **Q**-numbers are owner questions (section 11). **S**-numbers are suggestions (section 12). No rule in this document assumes a suggestion.
- Analyst IDs (for example RL D-C5, AB ROG-5, BA S17, PX BT-29, NC Q12) point to the detailed reasoning in the source files.
- Section 13 covers the spec's screens, presentation and delivery notes, which sit outside the rules engine. Appendix C maps every spec line to the section that covers it.

## OWNER RULINGS (2026-10-24) — these supersede every default below that they touch

The owner answered the first batch of questions in chat. The original spec is a two-column table (`GameSpec.pdf` in the repo root); the Markdown copy had lost the columns. **Implement these rulings; where a later section or Appendix A still shows the old default, the ruling wins.**

| # | Topic | Ruling | Supersedes |
|---|---|---|---|
| R1 | **AP per turn** | **Base 10 AP. Each round every player gets 1 more AP, up to a maximum of 20**: round 1 = 10, round 2 = 11, ..., round 11 onward = 20. Both players receive the same AP in a given round. No first-turn reduction for the first player (the owner did not ask for one). Unspent AP is still lost at end of turn (A2-03 stands). Constants: `AP_BASE = 10`, `AP_PER_ROUND_INCREMENT = 1`, `AP_MAX = 20`, `FIRST_TURN_AP = none`. | At a glance #4, C2, 2.3, Q15, Q16, Q17, A2-01, A2-02, `AP_PER_TURN`, `FIRST_TURN_AP` |
| R2 | **Army size cap** | **At most 50 units may be deployed** (the commander is not counted; units created in play, such as No-ACB dummies, are not counted). Deployability still applies on top. Constant: `ARMY_UNIT_CAP = 50`. | Q21, A5-03, S03, `ARMY_UNIT_CAP` |
| R3 | **Movement** | Orthogonal only, confirmed (Q8 = yes). | — |
| R4 | **Factions and rosters** | The spec lists **one unit per tier per faction**; "each unit has 2 variations" (L5) means one variation per faction. **The Empire:** Footman (1), Soldier (2), Berserker (5), Priestess (10), Paladin (20), Royal wizard (50), Celestial Emissary (100). **Lojrar Clan:** Mercenary (1), Ranger (2), Rogue (5), Juliomancer (10), Artificer (20), Beast of Knorund (50), Scourge of the Gods (100). Both rosters are complete; **there is no missing roster and no proxy**. An army is built from its own faction's 7 units only. Constants: `LOJRAR_PROXY_ROSTER = false`; the content tables carry `faction` per unit. | At a glance #11, C26, 7.2, Q3, Q5, A7-05, `LOJRAR_PROXY_ROSTER` |
| R5 | **Balance stance** | The swarm dominance found by the model is noted; the owner expects human players not to use swarms that effectively and wants to iterate after playtests. R2 answers S03. | S03 |
| R6 | **Baba Yaga** | The owner asked for a buff proposal. See S14 (three options) in section 12. Until ruled, implement the spec text with "units of white" = **tier-1 units** (with the recommended grade palette, tier 1 is Argent/white). Constant: `BABA_WHITE_GRADES = [1]`. | C9, Q53, A7-12, `BABA_WHITE_GRADES` |

| R7 | **Commanders and factions** | **Commanders are not tied to a faction** (on first instance; may change later). Any of the six may lead either faction. Constant: `COMMANDER_FACTION_LOCK = false`. The data keeps the PDF's two groups only as presentation order (group A: Trill, Kulega, Sabrina; group B: Baba Yaga, Ratasius I, Queso). | Q4, A7-06, `COMMANDER_FACTION_LOCK` |
| R8 | **Commander base stats** | The owner adopted S16 and S21: **base commander toughness 5** (Power stays 1) and **commander Movement 2**. AP stays 1, LOV 3. Per-commander overrides: **Trill 10** (spec), **Queso 6** (S16's figure, read as the spec's +2 over the old base of 1 becoming +1 over the new base; see the open note below), the others 5. Constants: `COMMANDER_BASE_TOUGHNESS = 5`, `COMMANDER_MOVEMENT = 2`, `TRILL_COMMANDER_TOUGHNESS = 10`, `QUESO_COMMANDER_TOUGHNESS = 6`. The last-row win is unchanged. | 7.1, 7.3, 7.9, A7-02, S16, S21, Q51 |
| R9 | **First-turn AP** | **Same curve for both players** (10, 11, 12, ... 20). No first-turn reduction. Q95 closed. | R1, Q17 |
| R10 | **Unit cap and created units** | **Created units (No-ACB dummies, revived units) do not count** toward the 50 cap; it is a deployment-time count. Q96 closed. | R2 |
| R11 | **Baba Yaga: three selectable variants** | The spec's regeneration text is **replaced**. When a player picks Baba Yaga they also pick **one of three variants** (stored in the army composition, revealed with the commander at the start of deployment, fixed for the match). Base stats per R8: 1/5, Mv 2, AP 1, LOV 3. "Units of white" = the player's **tier-1 units** (Footman for the Empire, Mercenary for Lojrar). **Variant A, "Mend the swarm"**: each own white unit gains *Regenerate*: 1 AP, restore the unit to its max toughness; not an action; own turn only; no cooldown; at most **3 uses per turn** army-wide. **Variant B, "Hex Ward"**: own white units within **range 3** (Manhattan) of Baba Yaga have **+1 max and current toughness** (an aura: max and current move together; losing it never kills, 3.7) and **take 1 less damage** from every source (a target-side flat reduction added to any others; the usual floor of 1 for a hit of 1 or more). No AP, no action. **Variant C, "Cauldron"**: when an own white unit dies (any cause, sacrifice included), its owner may **return it immediately to a free square adjacent (Manhattan 1) to Baba Yaga**, at full base toughness, statuses cleared, as the same unit, with its action for the current turn already used. Cost **1 AP**; when the death happens during the opponent's turn, the AP is **owed and deducted at the start of the owner's next turn** (AP debt, shown in the HUD). At most **2 returns per turn** (each turn, either player's, has its own counter) and **a given unit at most twice per game**. Decided through the reaction-prompt mechanism used for Queso (15 s then "no"; Ask/Always/Never preference). Returned units are not "created" for the 50 cap (R10) but the death still fires death triggers (Kulega). If no free adjacent square exists, no return. Constants: `BABA_VARIANT` per army ('mend' \| 'hex-ward' \| 'cauldron'), `BABA_MEND_COST = 1`, `BABA_MEND_USES_PER_TURN = 3`, `BABA_HEX_RANGE = 3`, `BABA_HEX_REDUCTION = 1`, `BABA_HEX_TOUGHNESS = 1`, `BABA_CAULDRON_COST = 1`, `BABA_CAULDRON_PER_TURN = 2`, `BABA_CAULDRON_PER_UNIT = 2`, `BABA_CAULDRON_AP_DEBT = true`. | 7.7, C9, C10, Q53, Q54, Q55, A7-12, A7-13, S14, `BABA_*` |

**Second batch (2026-10-24, from the questions page; raw answers in `docs/owner-answers-2026-10-24.md`).** Every question not listed below was answered "default OK", so its section-11 default is now a ruling. Queso's toughness 6 (Q97) and the Cauldron AP debt (Q98) were accepted.

| # | Topic | Ruling | Supersedes |
|---|---|---|---|
| R12 | **Extra actions may be Moves** (Q20 = yes) | A unit's base allowance is one action, and L11's "move once" applies to that base. Each extra action (Market, Command Aura, Holy Fervor) may be a second (or third) Move. `MAX_MOVES_PER_TURN = action allowance`. | At a glance #5, 2.4, A2-08, `MAX_MOVES_PER_TURN` |
| R13 | **Weakness floor** (Q31 = no) | Ratasius' "deal 4 less damage" cannot reduce a hit below 1. `WEAKNESS_FLOOR = 1`. | C4, 3.3, A3-04, `WEAKNESS_FLOOR` |
| R14 | **Friendly single-target harm** (Q37 = yes) | Smite and Julio Vernification may target the caster's own units (the UI asks for confirmation). `FRIENDLY_SINGLE_TARGET = true`. | C16, 3.10, A3-14, `FRIENDLY_SINGLE_TARGET` |
| R15 | **Opponent's AP visible** (Q46 = yes) | Both players always see both AP totals (and the AP debt from a Cauldron return). `SHOW_OPPONENT_AP = true`. | C22, 4.2, A4-02, `SHOW_OPPONENT_AP` |
| R16 | **Commander revealed in the lobby** (Q47) | Each player's commander (and Baba Yaga's variant) is shown to the opponent in the lobby as soon as it is selected, before the encounter. `COMMANDER_REVEAL = lobby`. | C21, 5.5, A5-09, `COMMANDER_REVEAL` |
| R17 | **Queso's AP** (Q57) | Queso's AP cost per action is **2** (the spec's 3 is changed). `QUESO_AP = 2`. | 7.9, A7-03 |
| R18 | **Queso's revive cost by tier** (Q58) | Reviving a unit costs Queso max toughness equal to **3 for a tier-100 unit, 2 for a tier-50 unit, 1 for any other tier** (dummies count as "other"). Queso's max toughness never drops below 1, so with max 6 he can spend 5 in total. `QUESO_REVIVE_COST(tier) = tier >= 100 ? 3 : tier >= 50 ? 2 : 1`. | 7.9, A7-16 |
| R19 | **Shared wounds rounds up** (Q74) | The donor loses **ceil(current toughness / 2)**; a donor at 1 loses 1 and **dies** (a death for every trigger). The recipient heals by the same amount, capped at max. `SHARED_WOUNDS_ROUNDING = ceil`. | 8.7, A8-09, `SHARED_WOUNDS_COST / rounding` |
| R20 | **Berserker 8/2** (S06 adopted, first option) | Power 12 → **8**; Savagery unchanged. | 8.5, content table |
| R21 | **Paladin 10/18, armour 2** (S07 adopted) | Power 12 → **10**, toughness 20 → **18**, Reinforced Armor reduction 3 → **2** (floor 1 unchanged). | 8.9, content table |
| R22 | **Julio Vernification cap** (S12 adopted, first option) | Damage dealt = min(sacrificed unit's current toughness, **15**). `JULIO_DAMAGE_CAP = 15`. | 8.8 |
| R23 | **Trill** (S13 adopted, first option) | Tier 1, 2 and 5 units get **+1 toughness** (was +2). Trill's commander toughness is **6** (this replaces the spec's 10 and R8's "Trill 10"). `TRILL_TOUGHNESS_BONUS = 1`, `TRILL_COMMANDER_TOUGHNESS = 6`. | 7.4, A7-08, R8 |
| R24 | **Queso's beacon heals 3** (S17 adopted, first option) | End of Queso's own turn: own units within range 2 (Queso included) regenerate **3** (was 5). `QUESO_BEACON_HEAL = 3`. | 7.9, A7-15 |
| R25 | **Tier 50 and 100 jobs** (S10 adopted; its three examples implemented literally, see Q101) | **Scourge of the Gods**: while it is alive its owner receives **+2 AP** at the start of each of their turns (added after the R1 cap). **Smite**: 8 damage to the target plus **3 damage to each unit in the target's 4 orthogonal neighbours** (fixed damage, friendly fire on, as with Forceful slam). **Royal wizard** toughness 20 → **24** (10/24). `SCOURGE_AP_BONUS = 2`, `SMITE_SPLASH = 3`. | 8.11, 8.13, 8.14, content table |
| R26 | **Charge** (S18 adopted) | A unit with Movement ≥ 2 may, as **one action costing its AP + 1**, move up to (Movement − 1) squares along a legal path and then make its basic attack from the end square (range as usual). The action counts as that unit's Move for R12's count and as an Attack for Savagery, Assault and reveal purposes; interruptions (mine, Assault, bump) end the charge and the attack does not happen but the AP is spent. Not available to units that cannot attack (dummies). `CHARGE_ENABLED = true`, `CHARGE_SURCHARGE = 1`. | 2.4, S18 |
| R27 | **Group march** (S02 adopted, alongside S01) | A **2 AP** action: choose up to **6 own units** that form one orthogonally connected group and have not acted this turn; each moves **1 square in the same chosen direction**. Each step must be legal (free square or a square vacated by a marching unit ahead; no enemies, no blockers); units are processed front-to-back in the march direction; per-unit interruptions (mine, Assault, bump into a hidden enemy) stop that unit only. Each marcher's action and Move are used. The commander may march. `GROUP_MARCH_ENABLED = true`, `GROUP_MARCH_COST = 2`, `GROUP_MARCH_MAX = 6`. | 2.4, S02 |
| R28 | **Approach boost and late escalation** (S01 adopted; interpretation in Q99) | **Approach boost:** until the end of the round in which any unit of either player first sees an enemy unit ("first contact"; stealthed units count if seen, mines don't), each player's AP for the turn is **double** the R1 curve value (20 on round 1, 22 on round 2 ...). **Late escalation:** from round 20 the R1 cap no longer applies: AP(r) = 20 + (r − 19) for r ≥ 20 (21 at round 20, 22 at round 21 ...). Market's +2 (R31) and the Scourge's +2 (R25) are added on top. `APPROACH_BOOST = 2x`, `ESCALATION_FROM_ROUND = 20`. | R1, 2.3, S01 |
| R29 | **Turn timer** (S04 adopted; bank size in Q103) | A lobby setting, **on by default for online lobbies, off in the sandbox**: **90 s per turn plus a 60 s time bank** per player; when both run out the turn ends (never the game). Reaction prompts (Queso, Cauldron) pause the timer. `TURN_TIMER = 90`, `TIME_BANK = 60`. | 2.12, `TURN_TIMER` |
| R30 | **Building-control win** (S19 adopted) | A third win condition, shown as **"Siege"** (not "domination", which L45 reserves for the last-row win): a player who **controls both the Keep and the Market at the start of 5 consecutive own turns** wins. The count resets when either building is lost; it requires both buildings enabled in the lobby; the HUD shows the counter to both players. `SIEGE_TURNS = 5`. | 6.1, 6.2, S19 |
| R31 | **Keep and Market rework** (S20 adopted, first options; Q105) | **Keep:** the controller's units get **+1 Power** on basic attacks (was +3). **Market:** the controller receives **+2 AP** at the start of each of their turns (added after the cap) **and** the tier-1 extra action is kept. `KEEP_POWER_BONUS = 1`, `MARKET_AP_BONUS = 2`, `MARKET_TIER1_ACTION = true`. | 6.3, A6-10, A6-11 |
| R32 | **3x3 buildings centred on the middle row** (S22 adopted, first option; Q104) | The Keep and the Market each occupy **3x3**, centred on row 13 of 25 (0-indexed row 12), so neither player is nearer. Default columns (0-indexed centres): **Keep (6, 12), Market (18, 12)**, giving 180° symmetry. The capture ring is the **16 squares at Chebyshev distance 1** around the 3x3. The Crossroads blockers are re-laid to keep symmetry and connectivity (verified by test); Open Field changes only the buildings. | 1.3, 6.3, C20, scenarios |
| R33 | **Army lists public at deployment** (S23 adopted) | Once both players have locked their armies, both lists (units, commander, variant) are shown to both players at the start of deployment. `ARMY_LISTS_PUBLIC = true` (at deployment start). | 5.5, A5-08 |
| R34 | **Commander mine confirmation** (S25 adopted) | Moving the commander onto a known mine always asks for confirmation, even when the own-mine warning option is off. | 2.5, 8.16 |
| R35 | **Ability text from data** (S26 adopted) | All in-game ability and unit text is generated from the content tables, with the S26 corrections applied. | S26 |
| R36 | **Tall blockers** (S27 adopted) | A second blocker type, **tall**, blocks vision (flood-fill from each unit within its LOV radius). The v1 scenarios use only low blockers; `VISION_OCCLUSION` becomes per-blocker. | 1.7, 4.1, S27 |
| R37 | **Commit-reveal and audit** (S28 adopted) | Commit-reveal for the first-player coin flip, the armies and the deployments; a post-game audit replay both players can run. | NC 7.15 |
| R38 | **Rules as data, match logging, AI harness** (S05 adopted) | Stats and rules stay in data tables; each finished match is logged locally (armies, commanders, winner, rounds, win condition); an AI-vs-AI harness on the engine for balance runs (dev tooling; a later phase). | S05 |
| R39 | **Watch the Ranger** (S11 adopted) | No rule change; match logs record each unit type's damage and kill share so the Ranger can be reviewed. | S11 |
| R40 | **S24 superseded** | The Lojrar roster exists (R4); the "Warpath" faction rule is parked. | S24 |
| R41 | **Ratasius** (S15 adopted, first option; Q100) | Commander toughness 5 is already R8. Weakness stays at range 1 unless the owner wants the range-2 alternative. | S15 |
| R42 | **Deferred** | S08 (Soldier 2/5) and S09 (cap the Mercenary pack bonus) are "Later": Soldier stays 2/7, the bonus stays uncapped. | S08, S09 |
| R44 | **"Units of white" = Lojrar Clan units** (owner, 2026-10-24 evening) | "White" is the Lojrar Clan's colour, not a grade. Baba Yaga's variants apply to **every Lojrar Clan unit** in the player's army (Mercenary, Ranger, Rogue, Juliomancer, Artificer, Beast of Knorund, Scourge of the Gods, at any tier), in any army that fields them (R43). `BABA_WHITE = { faction: 'lojrar' }` replaces `BABA_WHITE_GRADES`. Because the variants were sized for 1-2-toughness units, the numbers are **retuned as defaults pending the owner (Q108)**: **Mend**: 1 AP restores **4 toughness** (capped at max) instead of a full heal; still not an action, own turn only, no cooldown, 3 uses per turn. **Hex Ward**: unchanged (+1 toughness and 1 less damage for Lojrar units within range 3 of Baba Yaga). **Cauldron**: the return costs **ceil(tier / 10) AP, minimum 1** (tiers 1, 2, 5, 10 → 1 AP; 20 → 2; 50 → 5; 100 → 10), still 2 returns per turn and twice per unit per game, AP debt on the opponent's turn. Rationale: a full heal of a 40-toughness Beast for 1 AP, or a 100-coin Scourge returning for 1 AP, would dominate every other commander. | R6, R11, R43's "white" line, `BABA_*` |
| R43 | **Mixed armies** (owner, 2026-10-24 evening) | **"Each player can choose units from both factions without any restriction."** An army may contain any of the 14 units in any combination; the builder offers all 14 (grouped by faction only as presentation). The single-faction clause of R4 is withdrawn (R4's roster assignment stays, as the units' home faction). `availableRoster()` returns all 14 for every army; `checkArmy` no longer rejects off-faction units. The army's `faction` field becomes a cosmetic **banner** (crest and colours) the player picks in the builder, default Empire (open: Q107, whether to keep the banner choice at all). Consequences: Baba Yaga's "units of white" are defined by R44 (Lojrar Clan units); Sabrina's Artificer rules apply to any army that fields Artificers; Trill, Kulega and all tier-based rules are unchanged. | R4 (single-faction clause), 5.1, 7.2, `availableRoster`, `checkArmy` |

**Still open after these rulings (defaults until answered):**

- **Q99** S01 under the R1 cap: the approach boost doubles the curve value (so it can exceed 20), and the late escalation resumes +1 per round from round 20. Confirm or give the numbers you want.
- **Q100** Ratasius: keep the weakness at range 1 (default) or widen it to range 2 (S15's second option)?
- **Q101** S10's three examples (Scourge +2 AP per turn while alive, Smite splash 3 to the 4 neighbours, Royal wizard 10/24) are implemented literally. Confirm or adjust.
- **Q102** Trill's commander toughness is now 6 per S13, replacing the spec's 10. Confirm.
- **Q103** Turn timer: 90 s per turn plus a 60 s bank, on by default online. Confirm the bank size.
- **Q104** 3x3 buildings: Keep centred at column 7, Market at column 19 (1-indexed), both on row 13. Confirm or move them.
- **Q105** Market: +2 AP per turn and the tier-1 extra action is kept. Confirm, or drop the extra action.
- **Q106** Shared wounds rounds up, so a donor at 1 toughness dies. Confirm this is intended.
- **Q107** With mixed armies (R43), should the player still pick a cosmetic banner (Empire or Lojrar crest and colours) for the army, or should armies have no faction identity at all? Default: a banner, chosen in the builder, default Empire.
- **Q108** Baba Yaga retuning under R44 (variants now cover all Lojrar units, tier 1 to 100): Mend restores 4 toughness per use (instead of a full heal) and the Cauldron return costs ceil(tier/10) AP with a minimum of 1 (so 1 AP up to tier 10, 2 for tier 20, 5 for tier 50, 10 for tier 100). Confirm these numbers, or give yours. Hex Ward is unchanged.

## At a glance: the decisions that shape the engine

| # | Topic | Default | Conf. |
|---|---|---|---|
| 1 | Movement | Orthogonal steps only. L15's "including diagonals" is superseded by L34 (1.5). Confirmed by the owner (R3). | High |
| 2 | Distances | Manhattan distance for range, LOV, adjacency and melee reach. Chebyshev only for "(including corners)" and for shapes the text draws ("3x3", Slam's splash). | Med |
| 3 | Board | 25x25 minus 8 squares per corner (rounded-corner rule A): 593 squares. | Low |
| 4 | AP | **Owner ruling R1:** 10 base, +1 per round, max 20; same for both players; no first-turn reduction; unspent AP is lost. (Previous default: 12 fixed, 6 on the first player's first turn.) | Ruled |
| 5 | Actions | One action per unit per turn: Move, Attack, Defend or an active ability. Never more than one Move, even with extra actions. AP is paid per action; an ability's cost replaces the unit's AP. | High / Med |
| 6 | Damage | Base -> attacker additions -> attacker subtractions (floor 0) -> target flat reductions (floor 1) -> Defend halves, rounding up. | Med |
| 7 | Vision | Manhattan diamonds; nothing blocks sight. Fog hides enemy units, mines, effects, AP and cooldowns. | Med |
| 8 | Size 2 | A 2x2 block with no facing. | Med |
| 9 | Deployment | Simultaneous and hidden. Rogue and Ranger may also use the 2 extended rows. | Med / Low |
| 10 | Buildings | 12-square ring; checked at the end of every turn; only the controller benefits. | Med |
| 11 | Factions | **Owner ruling R4:** one unit per tier per faction. Empire = Footman, Soldier, Berserker, Priestess, Paladin, Royal wizard, Celestial Emissary. Lojrar Clan = Mercenary, Ranger, Rogue, Juliomancer, Artificer, Beast of Knorund, Scourge of the Gods. No roster is missing; no proxy. Commander–faction lock still open (default: unlocked). (Previous default: all 14 units Empire, Lojrar proxy.) | Ruled |
| 12 | Take-back | One action per request (repeatable back to the start of your turn, and End Turn until the opponent acts). The opponent sees what the action revealed, then accepts or declines. | Med |

---

## 0. Where the analysts disagreed, and what we decided

Each row gives the positions, the decision, and why. Smaller per-ability changes are marked inline in section 8 as "(changed from AB ...)".

| # | Topic | Positions | Decision | Why |
|---|---|---|---|---|
| C1 | Meaning of "adjacent", and melee reach | RL: adjacent = 8 squares (Chebyshev), melee = 4. BA, PX: adjacent and melee = 8. AB: everything 4, behind a switch. | **Manhattan distance 1 (4 squares)** for "adjacent", melee reach, "1 square away" and "range 1". Chebyshev only for "(including corners)" and for drawn shapes. Switch `ADJACENCY`. | One metric for movement, LOV, range and adjacency (L34, L37). L45 has to add "(including corners)", so the default excludes corners. A LOV-1 unit then always sees every square adjacent to it, and no unit is "adjacent but unable to hit". The only text that needs 8 neighbours (Slam's "5 opposite adjacent squares", L110) is a drawn shape and gets an explicit template (8.12). The synthesis brief directs Manhattan. |
| C2 | AP per turn | RL, AB: 10. PX: 8. BA: 12 fixed, as round(0.06 x budget); first player 6 on turn 1. | **12 fixed; the first player's first turn 6; no carry-over.** | The brief says to adopt the balance analyst's default. 12 lets 22-30-unit armies act with about a third of themselves per turn (BA 4.2), divides evenly by AP costs 1-4, and scales with the budget. |
| C3 | Order of Defend and flat reductions | RL, BA: subtract, then halve. AB: halve, then subtract. PX: an example halves first but defers to the engine. | **Subtract, then halve (round up).** Switch `DAMAGE_ORDER`. | Two of the three rules analysts. Each spec clause keeps its own floor. BA shows defence is already favoured (D3, D7); halving first deepens that (Berserker vs a defending Paladin: 3 instead of 5). |
| C4 | Can weakness reduce a hit to 0? | RL, AB: yes (floor 0). BA: floor 1, but suggests 0 to strengthen Ratasius (BA S14). | **Floor 0; a 0 hit is no damage at all.** | Every target-side reduction in the spec carries "not below 1"; weakness carries none, and it shrinks the dealer's damage. Two analysts; Ratasius is the second-weakest commander (BA 6). |
| C5 | Losing a toughness aura | RL: can kill (MTG rule). AB, BA: current drops with it but never below 1. | **Never below 1.** Switch `AURA_LOSS_CAN_KILL`. | Two analysts. A unit (including a Strong-aura commander at 1) should not die from taking a step. The leftover exploit is at most +1 once per damage episode (3.7). |
| C6 | Do blockers and buildings block vision? | RL: yes (flood fill). BA, PX: no. AB: assumes no. | **No occlusion in v1.** Switch `VISION_OCCLUSION` for later "tall" blockers. | The spec defines vision purely by distance (L37); simpler, predictable fog; majority. |
| C7 | Corner cut | RL, BA: rule A (8 per corner, 593 squares). PX: rule C (x + y < 4, 585). | **Rule A.** | "Radius" names a circular arc; two analysts; the difference is small (BA 5.1). |
| C8 | Units allowed in the extended zone | RL: type 1-2 units. AB, BA, PX: Rogue and Ranger. | **Rogue and Ranger ("Vanguard").** | Majority. Scouts deploy forward; pushing cheap swarms forward would feed the body-count turtle (BA D1). |
| C9 | Baba Yaga's "units of white" | AB, PX: grade 1. RL: any unit. BA: any non-commander unit. | **Every own unit that has a grade**, until a grade-colour table exists. | No colour table exists, so an art placeholder must not decide a rule. Grade 1 only makes her nearly useless: a Mercenary (toughness 1) can never be damaged and alive, so only a Footman at 1/2 benefits. She is already the weakest commander (BA 6). |
| C10 | Baba Yaga's limits | AB: 2 per turn in total (may be one unit twice), CD 1 per unit. BA: 2 per turn, every other turn. PX: 2 per turn. | **AB's reading.** | Everyone reads a ceiling of 2 per turn. A per-unit cooldown matches "Units ... gain the ability" (each unit owns a copy) and the per-instance cooldown rule (A2-25). The literal alternative (2 units, each twice) is Q54. |
| C11 | Stealth while an unseen enemy watches | RL: allow the attempt, fail visibly. AB, PX: disable the button with a reason. NC: allow, fail, no AP spent. | **Disabled only if the watcher is visible to the player. Otherwise the attempt may fail, spending its 1 AP and the action.** Switch `STEALTH_FAIL_MODE`. | A disabled button, or a free failure, is a free radar every turn. Paying for the probe matches the movement "bump" rule every analyst adopted (the action is spent). |
| C12 | Mind's Eye and mines | AB, BA: it reveals mines. PX: it does not. | **Reveals mines.** Switch `MINDS_EYE_REVEALS_MINES`. | Majority. Otherwise mines only have blind-shot counterplay; the spec calls both "invisible". |
| C13 | Do invisible units capture or contest buildings? | RL, AB, PX: yes. BA: no. | **Yes; a blocked capture is announced as "contested".** | Majority. "At least one unit, without opposition" (L45) is about presence; stealth hides a unit, it doesn't remove it. |
| C14 | Choices during the opponent's turn (Queso) | RL: standing setting, no prompt. AB: prompt, 20 s. PX: prompt, 15 s, Ask/Always/Never. NC: prompt, no timeout. | **Live prompt, 15 s then "no", plus an Ask/Always/Never preference.** | Majority. The preference gives RL's no-pause behaviour to players who want it. |
| C15 | Savagery's window | AB: any time later that turn. PX: until another unit acts. | **Any time later that turn.** | The ability analyst's domain; a simpler engine rule (one per-turn flag). |
| C16 | Smite and Julio Vernification on own units | AB: allowed after confirmation. RL: harmful single-target effects hit enemies only. | **Enemies only.** | No tactical use was found; it removes a class of misclicks. |
| C17 | Order of simultaneous triggers | RL: active player first. AB: non-active player first (APNAP). | **Damage before healing; then the non-active player's triggers first.** | Consistent with reactions interrupting the active player, and with the end-of-turn order (enemy Pajazon damage before your heals). |
| C18 | Take-back scope | RL: back to any point in your latest turn in one request. AB: the last action only, never if it revealed something. PX, NC: one action per request, repeatable; End Turn undoable; reveals disclosed. | **PX/NC.** | Majority, and the netcode design. Consent is the spec's protection, so disclosure beats a hard block; under fog nearly every move reveals squares. |
| C19 | Compensating the second player | RL: the second player picks the edge. BA: the first player plays South (nearer the Market) and has 6 AP on turn 1. PX: none. NC: a rules decision. | **BA.** | Part of the adopted AP default; the default map is built around it (the second player sits nearer the Keep). |
| C20 | Default map | RL: no blockers; Keep F-G rows 12-13, Market S-T rows 13-14. BA: "Crossroads" (21 blockers, Keep G13:H14, Market R12:S13). PX: "Open Field" and "Ruins". | **Crossroads**, plus **Open Field** (same buildings, no blockers) as the test variant. | The only fully checked layout: symmetry, connectivity and path fairness, re-verified for this document. |
| C21 | When commanders are revealed | RL, PX: at the start of deployment. NC: at the start of battle. | **Start of deployment.** | Majority; commander effects become visible within a turn or two anyway (Trill's toughness, Kulega's LOV). |
| C22 | Opponent's remaining AP | RL: hidden. NC: public. | **Hidden.** | AP spent by unseen units (Stealth 1, a mine 2) is itself hidden information. |
| C23 | Attacks from the fog | PX: the attacker stays hidden. NC: a one-shot ghost marker. | **Attacker stays hidden** (Q45). | Vision comes only from LOV (L17); striking from outside the target's sight is part of the Ranger's and Smite's value. |
| C24 | Last-seen markers | RL: none for now. PX: on by default. | **Allowed as client memory; on.** | They show nothing the player didn't see; no engine impact. |
| C25 | Defend followed by another action | RL: the later action cancels Defend. Others: silent. | **Cancels it.** | Stops "Defend first, then act" with extra actions. |
| C26 | Factions | RL: Lojrar only in v1. AB, BA, PX: one shared roster, faction cosmetic, commanders unlocked. | **The 14 units = The Empire. Trill, Kulega, Sabrina = Empire; Baba Yaga, Ratasius I, Queso = Lojrar. Lojrar roster MISSING; proxy = the Empire units. Commanders locked to their faction.** | Directed by the synthesis brief. Sabrina's text needs the Artificers, so she belongs with this roster, and the positional split then puts the first group in the faction listed first. The proxy keeps all six commanders playable. A third reading (PX G-01 (c): each tier's two units split between the two factions, after L5's "each unit has 2 variations") is recorded in 7.2 and Q3. |
| C27 | Forcefield shape | AB: any tetromino. BA: 2x2 only. PX: 4 connected squares. | **Any 4 orthogonally connected squares.** | Majority. "Choose" implies a real choice; "adjacent" means connected. |
| C28 | May melee attacks target a square? | RL: every attack targets a square. AB: only ranged attacks may. | **Only attacks with range 2 or more.** | Under Manhattan adjacency, anything in melee reach is visible (LOV >= 1) or revealed (R1). Mines need a ranged attack by text (L101). |
| C29 | Reaction prompt timeout | AB: 20 s. PX: 15 s. NC: none. | **15 s, then "no".** | The UX analyst's value and its accessibility floor (PX A11Y-09). |
| C30 | Telling the owner that their Rogue was revealed | PX: only if the revealer is visible. Others: silent. | **Always told; the cause only if visible.** | A player must know the true state of their own units. |
| C31 | Assault during the Rogue's own move | AB: it ends the Rogue's move too. | **Adopted.** | Prevents "step in, free hit, step out" on a single Move. |
| C32 | Are mines visible inside vision? | RL's D-F5 lists mines with things that only fog hides. AB, BA, PX: invisible even inside vision. | **Invisible until revealed.** | "Deploy an invisible mine" (L101). |
| C33 | End-of-turn order | PX's ticker lists regeneration before damage (and asks the rules analysis to fix it). RL, AB: damage first. | **Damage first, then healing.** | Two analysts; it also means a heal is never wasted on a full unit that is about to be hit. |

---

## 1. Glossary and geometry

### 1.1 Glossary

| Term | Definition |
|---|---|
| Square | One cell of the grid that exists on the board (1.3). Cut-off corner squares do not exist. |
| Unit | Anything on the board with Power and Toughness: the 14 roster units, No-ACB dummies and the commander. |
| Object | A board thing that is not a unit: Trip Mines, area effects (Forcefield, Pajazon), buildings, blockers. |
| Footprint | The squares a unit occupies: 1 square, or a 2x2 block for Size 2 (1.6). |
| South / North | The two sides. South moves first (2.2). |
| Own / friendly / allied | Controlled by the same player. **Enemy**: controlled by the opponent. |
| Active player | The player whose turn it is; the other is the non-active player. |
| Turn, own turn, round | A **turn** is one player's turn. A **round** is South's turn followed by North's. "Your turn" means the turn of the player who controls the effect. Each player has an own-turn index (1, 2, 3, ...). |
| Action | Move, Attack, Defend, or using an active ability (2.4). |
| Action allowance | How many actions a unit may take this turn: 1 by default. |
| AP pool | The action points a player has left this turn. |
| AP cost | A unit's price per action (the "AP" column of a unit line). |
| Ability cost | The AP price of an active ability (the middle field of `Ability:AbilityCost:Description`). |
| Passive ("P") | Always on; costs nothing; not an action. |
| Active ability | Declared by the player; uses one of the unit's actions; costs its ability cost. |
| Triggered effect | Happens by itself when its condition occurs; free; not an action (Assault, a mine exploding, end-of-turn effects, death triggers). |
| Type / grade / tier | A unit's denomination: 1, 2, 5, 10, 20, 50 or 100. It is also its default cost. The commander and created units have no type. The UI word is "Tier" (PX G-02). |
| Printed / base / max / current toughness | See 3.1. "hp", "health" and "life" all mean current toughness. |
| Damage | Toughness loss that goes through the damage pipeline (3.3). It is either attack damage or ability damage (3.2). |
| Heal, regenerate, gain life, recover | Raise current toughness, capped at max toughness (3.6). |
| Sacrifice | Destroy one of your own non-commander units, as a cost (3.9). |
| LOV, vision | See 4.1. |
| Visible / invisible / revealed | See 4.3. |
| Controller (of a building) | The player who last captured it. "Active" building = a building that has a controller. |
| Ring | The 12 squares around a 2x2 building (6.4). |
| Back row / goal row | Row 1 is South's back row and North's goal row; row 25 is North's back row and South's goal row. |
| Normal / extended zone | The deployment rows (5.2). |
| Vanguard | A unit allowed to deploy in the extended zone (5.3). |
| Scenario | The board data: shape rule, blockers, buildings, zones and goal rows (1.8). |

### 1.2 Coordinates, sides and orientation  [A1-01, A1-15]

- **Columns** A-Y, west to east as South sees the board (engine `x` = 0-24). **Rows** 1-25, south to north (engine `y` = row - 1). A square is named column + row, for example `M13`.
- **South** = the first player: back row 1, normal zone rows 1-5, extended rows 6-7, **goal row 25**. "Forward" means increasing row number.
- **North** = the second player: back row 25, normal zone rows 21-25, extended rows 19-20, **goal row 1**.
- Each client draws its own back row at the bottom; North's view is the board rotated 180 degrees. Square names stay absolute, so `M13` is the same square in both players' logs and chat (PX G-08).

### 1.3 Board shape: which squares exist  [A1-02 - Low]

> "The size of the battlefields are 25x25, where the corners are cut off with a radius of 4." (L30)

**Rule A (adopted).** For a square at column index `x` and row index `y` (both 0-24), let `u = min(x, 24 - x)` (distance to the nearer side edge) and `v = min(y, 24 - y)` (distance to the nearer top or bottom edge). The square **does not exist** when

```
u < 4  and  v < 4  and  (4 - u)^2 + (4 - v)^2 > 16
```

Geometrically: draw a quarter circle of radius 4 squares into each corner, centred 4 squares in from both edges. A square exists only if it lies entirely inside the rounded outline. This removes **8 squares per corner** (4, 2, 1 and 1 on the four outermost rows) and leaves **593 squares**.

| Rows | Columns that exist | Squares per row |
|---|---|---|
| 1 and 25 | E-U (x 4-20) | 17 |
| 2 and 24 | C-W (x 2-22) | 21 |
| 3, 4, 22 and 23 | B-X (x 1-23) | 23 |
| 5-21 | A-Y (x 0-24) | 25 |

The shape is symmetric under a 90-degree turn, so columns follow the same pattern: A and Y exist on rows 5-21 (17 squares), B and X on rows 3-23 (21), C, D, V and W on rows 2-24 (23), and E-U on all 25 rows. Total: 2x17 + 2x21 + 4x23 + 17x25 = **593**.

```
South-west corner ('#' = square exists, '.' = cut off)
row 6   # # # # # #
row 5   # # # # # #
row 4   . # # # # #
row 3   . # # # # #
row 2   . . # # # #
row 1   . . . . # #
        A B C D E F
```

Alternatives behind `CORNER_RULE` (all verified):

| Rule | Square removed when | Removed per corner | Playable | Back row | Rows 1-5 | Rows 6-7 |
|---|---|---|---|---|---|---|
| **A (default)** | u < 4, v < 4, (4-u)^2 + (4-v)^2 > 16 | 8 | 593 | 17 | 109 | 50 |
| B (square centre outside the arc) | u < 4, v < 4, (3.5-u)^2 + (3.5-v)^2 > 16 | 3 | 613 | 21 | 119 | 50 |
| C (45-degree cut, PX's choice) | u + v <= 3 | 10 | 585 | 17 | 105 | 50 |
| D (quarter-circle bite on the corner point) | (u+0.5)^2 + (v+0.5)^2 < 16 | 13 | 573 | 17 | 99 | 50 |

A square that does not exist cannot be entered, deployed on, targeted, or counted in any area. An area template that reaches off the board simply loses those squares.

### 1.4 Distances  [A1-03 to A1-07]

```
manhattan(a, b) = abs(a.x - b.x) + abs(a.y - b.y)
chebyshev(a, b) = max(abs(a.x - b.x), abs(a.y - b.y))
distance(unit A, unit B) = the minimum over every square of A and every square of B
```

| Spec wording | Meaning | Squares around a 1x1 unit |
|---|---|---|
| "range N", "in range of N", "within range N", "in a range of N", "at range N", "at a range of N" | Manhattan distance <= N | 4 / 12 / 24 for N = 1 / 2 / 3 |
| "adjacent", "melee range" (L82), "1 square away" (L81), "range 1" | Manhattan distance = 1 | 4 |
| "in range of 1 (including corners)" (L45) | Chebyshev distance = 1 | 8 |
| LOV N | Manhattan distance <= N (the unit's own squares included) | 2N(N+1) around it: 4, 12, 24, 40, 60, 84 for LOV 1-6 |
| "an area of 3x3" (L107) | Chebyshev distance <= 1 from the centre square | 9 |
| Movement N | up to N orthogonal steps (2.5) | - |

- "Range N" always means **up to** N, never exactly N. There is no minimum range, and distance 0 (the unit's own square) is inside every range [A1-04].
- Ranges are measured on the grid and ignore blockers, buildings and units. There is no separate line-of-fire rule [A1-04, A1-12].
- "Adjacent" never includes the unit's own square(s).
- Shapes that the text draws, the Pajazon "3x3" and Forceful slam's "5 opposite adjacent squares", are templates on the 8-neighbourhood. They are defined exactly where they are used (8.11, 8.12) [A1-07].
- Every listed range fits inside its unit's own LOV (Ranger 2 <= 3, Julio 2 <= 3, Smite 3 <= 4, Pajazon centre 3 <= 3). Since nothing blocks sight, "in range" and "in the unit's own LOV" never disagree in v1.

```
Range 2 / LOV 2 (12 squares)        Adjacent (a) and "including corners" (a + c)
. . 2 . .                           c a c
. 2 1 2 .                           a U a
2 1 U 1 2                           c a c
. 2 1 2 .
. . 2 . .
```

### 1.5 SPEC CONFLICT: movement direction (resolved)  [A1-08 - High]

> "Besides special powers, all units (unless specified) share the actions of movement (1 square by default, including diagonals), ..." (L15)
>
> "Units movement is defined by their movement stat. When a player takes an action to move the unit, that unit moves as many squares as the movement stat. The movement is orthogonal, a movement-piece cannot be diagonal. For instance: A unit with movement 2 can move left then up to complete a diagonal movement." (L34)

**The two lines contradict each other. We adopt L34: movement is orthogonal (Manhattan).** L34 is the later and more detailed passage. It sits in the paragraph that defines the Movement stat and gives a worked example. The rest of the spec agrees with it: L37 builds vision "using this logic", and L45 has to add "(including corners)" to include diagonals. L15's "including diagonals" is treated as superseded; only its "1 square by default" survives (the default Movement is 1). Switch `MOVE_DIRECTIONS = ORTHO_4`. The spec text should be corrected (S26).

Consequence: a diagonal displacement costs 2 movement, so a Movement-1 unit needs two turns to reach a diagonal neighbour square.

### 1.6 Size-2 footprint  [A1-09, A1-10 - Med]

> "Beast of Knorund, 20/40, 2, 2, 2, 3" (L109); "Deals 5 damage + 5 if the unit has a size of 2 or greater." (L101)

- **Footprint.** Size S fills an S x S block. The Beast (the only Size-2 unit) occupies 2x2. Its anchor is its south-west square. It has no facing and never rotates.
- **Distances** to or from it use its nearest square (1.4). It has **8 adjacent squares** (two per side), which are also its melee reach, and **12 squares "including corners"**.
- **Vision** is the union of the diamonds of its 4 squares.
- **Movement.** The block shifts one square orthogonally per step. Every one of its 4 destination squares must exist and be free of blockers, buildings and enemy units at every step. It may overlap own units mid-path, but it must end on 4 empty squares. It cannot pass through a 1-square-wide gap. Its Movement stat counts block steps.
- **Areas and effects.** It is "in" an area, ring or square set if any of its squares is. It is affected **at most once** per effect instance. If it covers both a primary square and splash squares of one effect (Slam), it takes only the primary damage.
- **Mines.** Each newly entered square that holds a mine sets that mine off: 10 damage per mine (5 + 5 for size 2), so one step can trigger two mines.
- **Deployment.** All 4 squares must lie inside a zone it may use (the Beast is not Vanguard, so the normal zone).
- **Fierce attacker** against it can count up to 7 other Mercenaries (8 adjacent squares, one taken by the attacker).

```
c a a c      B = Beast (2x2)
a B B a      a = adjacent squares and melee reach (Manhattan 1): 8
a B B a      a + c = "including corners" (Chebyshev 1): 12
c a a c
```

### 1.7 Terrain  [A1-11 to A1-13]

> "The game takes place in a square grid system. There may be a scenario with blockers." (L13)
> "Each one will occupy a 2x2 square ..." (L45); "The neutral objectives are represented by 3d objects ..." (L46)

| Terrain | Enter | Deploy on | Target | Destroy | Blocks vision or range |
|---|---|---|---|---|---|
| Cut-off square | does not exist | no | no | - | - |
| Blocker (1 square) [A1-11] | no | no | no | no | **no** [A1-12] |
| Building (2x2: Keep, Market) [A1-13] | no | no | no | no | **no** [A1-12] |
| Open square | yes | if in your zone | yes | - | - |

- Scenario blockers are laid out with 180-degree rotational symmetry.
- **No occlusion in v1** [A1-12 - Med]: vision and ranges are pure distance. `VISION_OCCLUSION = none`. The alternative (`floodfill`, RL D-F2: vision spreads by orthogonal steps and stops at blockers and buildings) is kept for a future "tall blocker" type (S27).

### 1.8 Default scenario: "Crossroads"  [A1-14 - Low]

The balance analyst's layout (BA 5.3), re-verified for this document. Legend: `S` South normal zone, `s` South extended zone, `N` North normal zone, `n` North extended zone, `K` Keep, `k` Keep ring, `M` Market, `m` Market ring, `#` blocker, `.` open ground, blank = cut off.

```
      A B C D E F G H I J K L M N O P Q R S T U V W X Y
  25          N N N N N N N N N N N N N N N N N          25
  24      N N N N N N N N N N N N N N N N N N N N N      24
  23    N N N N N N N N N N N N N N N N N N N N N N N    23
  22    N N N N N N N N N N N N N N N N N N N N N N N    22
  21  N N N N N N N N N N N N N N N N N N N N N N N N N  21
  20  n n n n n n n n n n n n n n n n n n n n n n n n n  20
  19  n n n n n n n n n n n n n n n n n n n n n n n n n  19
  18  . . . . . . . . . . . . . . . . . . . . . . . . .  18
  17  . . . . # # . . . . . . . . . . . . . # # . . . .  17
  16  . . . . . . . . . # . . . . . # . . . . . . . . .  16
  15  . . . . . k k k k # . . . . . # . . . . . . . . .  15
  14  . . . . . k K K k . . . # . . . m m m m . . . . .  14
  13  . . . . . k K K k . . # # # . . m M M m . . . . .  13
  12  . . . . . k k k k . . . # . . . m M M m . . . . .  12
  11  . . . . . . . . . # . . . . . # m m m m . . . . .  11
  10  . . . . . . . . . # . . . . . # . . . . . . . . .  10
   9  . . . . # # . . . . . . . . . . . . . # # . . . .   9
   8  . . . . . . . . . . . . . . . . . . . . . . . . .   8
   7  s s s s s s s s s s s s s s s s s s s s s s s s s   7
   6  s s s s s s s s s s s s s s s s s s s s s s s s s   6
   5  S S S S S S S S S S S S S S S S S S S S S S S S S   5
   4    S S S S S S S S S S S S S S S S S S S S S S S     4
   3    S S S S S S S S S S S S S S S S S S S S S S S     3
   2      S S S S S S S S S S S S S S S S S S S S S       2
   1          S S S S S S S S S S S S S S S S S           1
      A B C D E F G H I J K L M N O P Q R S T U V W X Y
```

| Feature | Squares | Engine coordinates |
|---|---|---|
| Keep | G13, H13, G14, H14 | x 6-7, y 12-13 |
| Keep ring | F12:I15 minus the Keep (12 squares) | x 5-8, y 11-14 |
| Market | R12, S12, R13, S13 | x 17-18, y 11-12 |
| Market ring | Q11:T14 minus the Market (12 squares) | x 16-19, y 10-13 |
| Centre cross (5) | L13, M12, M13, M14, N13 | |
| Lane dividers (8) | J10, J11, J15, J16, P10, P11, P15, P16 | |
| Forward rocks, South (4) | E9, F9, T9, U9 | |
| Forward rocks, North (4) | E17, F17, T17, U17 | |

Verified properties:
- 21 blockers, all on open ground outside the zones. The map is identical under a 180-degree rotation, (x, y) -> (24 - x, 24 - y), which maps the Keep onto the Market.
- 564 walkable squares, all connected. A 2x2 Beast can reach both rings and the far back row.
- Shortest orthogonal paths: from South's row 5 to the Keep ring 7 steps and to the Market ring 6; from North's row 21, 6 and 7. From the extended-zone fronts (rows 7 and 19): 5/4 and 4/5. From either normal-zone front to the opposite goal row: 20 steps; from back-row squares M1 or M25, 26 steps (the centre cross forces a detour); from I1 or I25, 24.
- Because the board has an odd number of rows, a 2x2 building can't be equally close to both players. The Keep is one row nearer North and the Market one row nearer South. The first player plays South, so the second player sits nearer the stronger objective (BA 5.2).

**Variant "Open Field"**: the same board and buildings with no blockers, for rules testing. A scenario stores: corner rule and radius, blockers, buildings (type and anchor), zones per side, goal rows, and Vanguard eligibility if a scenario ever overrides it.

---

## 2. Turn structure

### 2.1 Match flow

1. **Lobby.** "Play" in the main menu creates a lobby and shows its invite link (L22; link format NC 7.4). It has exactly two seats, host and guest. v1 has no spectators and no AI opponent (L135, "assume that only another player will play"); a third visitor sees "This game is full" (PX LB-10). The host sets the scenario, Keep on/off, Market on/off, take-backs on/off and the turn timer. The budget is 200 (a dev flag in v1, PX LB-08; 5.1).
2. **Army selection** [A5-10, A5-13]. Both players pick a saved army or build a new one (faction + commander + units) at the same time and in secret, then lock it in. An army built or edited here can be used for this match only or saved to the player's compositions ("Save to my armies", on by default; PX AB-15). Changing the army after Ready un-readies that player (PX AB-16).
3. **First player** [A2-04]. A coin flip (commit-reveal, NC 7.15), announced to both. The first player plays South.
4. **Reveal** [A5-09]. Both commanders' identities become public.
5. **Deployment** (section 5). Simultaneous and hidden.
6. **Battle.** Rounds of turns until a result (section 6).
7. **Result.** The fog lifts; both full armies and the final board are shown (PX RS-02).

### 2.2 Sides, first player and rounds  [A2-04, A2-05]

- The coin flip decides the first player, who plays **South**. The other player plays North.
- Round r = South's turn r, then North's turn r.
- Each player has an own-turn index that cooldowns and durations count (2.9).

### 2.3 AP economy  [A2-01 to A2-03]

> "It's a turn-based game. In each player's turn, that player will receive a number of Action points. The player can use those action costs to use a number of units that fit its budget." (L9)

- **Pool size:** `AP_PER_TURN = round(0.06 x budget)` = **12** at the default budget of 200. It is the same every turn and, in v1, the same for both players; if budgets ever differ per player, each pool uses its own player's budget (A5-14) [A2-01 - Med for the number, High for "fixed"].
- **First turn:** `FIRST_TURN_AP = 6` for South's (the first player's) very first turn only [A2-02 - Low]. North's first turn has the full 12.
- **Refill and loss:** the pool is set to its full value at the start of the player's own turn. Unspent AP is lost (`AP_CARRYOVER = 0`) [A2-03].
- **Spending:** an action's cost is paid when it is declared. An action needs enough AP left. AP never goes negative and can't be borrowed [A2-03].
- **Why 12** (BA 4.2): armies of 22-30 units can act with about a third of themselves each turn, so choosing who acts matters; elite armies act almost completely; 12 divides evenly by AP costs 1, 2, 3 and 4; and a turn stays at about 60-90 seconds of clicking.

Alternatives considered (all are values of the same constants):

| Option | Rule | Source | Why it isn't the default |
|---|---|---|---|
| 8 fixed | 8 per turn | PX BT-01 | Mid-sized armies act with only 20-27% of themselves; very slow approach. |
| 10 fixed | 10 per turn (budget / 20) | RL D-A1, AB G-12 | A close second. 12 divides evenly by every AP cost and gives a little more tempo. |
| Value-scaled | 6 + floor(remaining army value / 40) | BA 4.5 B | Changed nothing in BA's model; adds snowballing and another number on screen. |
| Growing | min(16, 6 + 2 x (round - 1)) | BA 4.5 C | Starves the slowest phase, the approach march. |
| Approach boost + escalation | 24 until first contact; +1 per round from round 20 | BA 4.5 D | The recommended upgrade if playtests feel slow (S01). |

### 2.4 Actions and the action economy  [A2-06 to A2-14]

> "Unless stated otherwise, a single unit can only move once per turn." (L11)
> "A unit can only use one action per turn, unless stated otherwise." (L35)

- **Actions** [A2-06 - High]: **Move**, **Attack**, **Defend**, and using an **active ability**. Each uses one of the unit's actions.
- **Allowance** [A2-07 - High]: 1 action per unit per turn. Extra allowance comes only from:
  - **the Market** (+1 for the controller's type-1 units, 6.6);
  - **Command Aura** (+1 for own units within range 2 of an own Scourge, not the Scourge itself, 8.14);
  - **Holy Fervor** (the Emissary has 2).
  Different sources add up; a same-named source counts once (two Scourges still give +1) [A2-13]. The allowance is computed **when an action is declared**: the action is legal only if the unit's actions used so far this turn are fewer than its allowance at that moment. A unit that leaves Command Aura range, or whose Scourge dies, loses an unused extra action.
- **One Move per turn** [A2-08 - Med]: even with 2 or 3 actions, at most one may be a Move (L11). Move + Attack, Attack + Attack or Ability + Ability are fine; Move + Move is not. Order is free (Attack, then Move is allowed).
- **Interleaving** [A2-14]: units act in any order, and one unit's actions need not be consecutive (A acts, then B, then A's second action).
- **Not actions** [A2-11, A2-12]: passive abilities, auras, triggered effects (Assault, mines, end-of-turn effects, death triggers), **Savagery's extra attack** (paid 2 AP) and **Baba Yaga's regeneration** (paid 2 AP).

| What | Uses an action? | AP cost | Notes |
|---|---|---|---|
| Move | yes | unit's AP cost | at most one per turn (2.5) |
| Attack | yes | unit's AP cost | needs current Power >= 1 (2.6) |
| Defend | yes | unit's AP cost | 2.7 |
| Active ability | yes | its ability cost, **instead of** the unit's AP cost [A2-10] | 2.8 |
| Savagery's extra attack | no | 2 | once per turn, after a basic Attack (8.5) |
| Baba Yaga's regeneration | no | 2 | at most 2 per turn (7.7) |
| Assault | no | 0 | triggered (8.6) |
| Passives, auras, end-of-turn effects, death triggers | no | 0 | |
| Holy Fervor surcharge | - | +1 on every Emissary action after its first that turn | 8.13 |

- **Per-action payment** [A2-09 - Med]: every action is paid when taken, extra actions included. Paying once per unit would make Command Aura very strong (a Beast next to a Scourge would get two actions for 3 AP; RL C-04).
- **"P" with a cost** [A2-11]: "P" means the ability needs no activation and uses no action. An AP amount written in its text is still paid when that optional part is used (Savagery).
- **Abilities with no cost field** [A2-12]: Assault is triggered and free; Mad inventor and Holy Fervor are passive; Shared wounds is active and costs the Priestess's AP (2).
- **AP cost is a fixed stat** [A2-32 - High]: "an action cost, which will scale depending on the relative power of that unit" (L7) explains how the unit lines were priced; it is not a rule that runs during play. A unit's AP cost is the AP field of its unit line (the commander's comes from 7.1) and never follows its current Power or toughness: the Keep, Strong aura, Mad inventor and Sabrina's +2 leave it unchanged. Apart from ability costs (above) and Holy Fervor's surcharge (8.13), nothing changes what an action costs.

### 2.5 The Move action  [A2-15 to A2-17]

**Declaring.**
- A Move goes **1 to N orthogonal steps** (N = current Movement); stopping early is allowed [A2-15 - Med]. The path may turn. L34 literally says the unit "moves as many squares as the movement stat", which could mean exactly N; "up to N" is adopted because exactly N would stop a Paladin (Movement 3) from taking a single step (`MOVE_EXACT_DISTANCE`, Q84).
- The player commits a full path, planned on what they know [A2-17]. The path is checked against the **player's knowledge**, never the hidden truth (A4-14): every step must land on existing squares that are not blockers or buildings and hold no enemy unit the player can see. It may pass through own units [A2-16] and must end on squares that look empty.
- A unit with Movement 0 (a dummy without Mad inventor) can't Move. Nothing in v1 pushes or displaces units.

**Walking: per-step processing, in this fixed order.**
1. **Enter.** The footprint shifts one square.
2. **Mines.** Every live mine on a newly entered square explodes: 5 damage, or 10 for size >= 2, as separate damage instances (3.3). Each mine is then removed.
3. **Assault.** If the mover is still alive: every Stealthed enemy Rogue whose distance to the mover became 1 in this step makes one Assault on the mover (APNAP order, 2.11). If the mover is itself a Stealthed Rogue whose distance to one or more enemy units became 1, it makes one Assault (its controller picks the target if there are several).
4. **Reveals and vision.** State-based reveals apply (R1 adjacency for every Stealthed unit, Mind's Eye, Ratasius; 4.4). Both players' vision is recomputed.
5. **Deaths.** Deaths from steps 2-3 resolve as they happen, with their triggers. If a commander died, the game ends (6.2).
6. **Goal row.** If the mover is a commander standing on its goal row, its player wins (6.3).
7. **Interrupt.** The move ends here if a mine exploded on the mover, an Assault involved the mover (as attacker or target), or the mover died. It also ends if the next square of the path is now seen to hold an enemy unit ("Blocked!"). In that case the mover ends on the last square of the walked path where it may legally end: it backs up over squares occupied by own units, possibly to its starting square.
8. Otherwise the next step follows.

- An interrupted move still counts as the unit's Move, and its full AP cost stays spent [A2-17].
- Because every unit has LOV >= 1 and nothing blocks sight, the mover always sees its next square before entering it. An invisible enemy can never be bumped into: it is revealed (R1) one square earlier.
- **Known mines** (owner's note, L102) [A8-17]: path suggestions never route through a mine the player knows about: their own mines and revealed enemy mines. L102 says "mines" and "a mined square", not "your mines". Moving onto or through one asks for confirmation ("Moving there sets it off: 5 damage, 10 for Size 2"), unless the player has turned the warning off in Options. Unrevealed enemy mines can't be avoided or warned about (4.7).
- **Size 2** moves as a block (1.6).

### 2.6 The Attack action  [A2-18 to A2-20, A3-01]

> "attack (attacking units deals damage to the toughness of a target unit)" (L15)

- **Attack range:** 1 for every unit except the Ranger (2). It is measured footprint to footprint.
- **Melee (range 1):** the target must be a **visible enemy unit** at distance 1 [A2-18].
- **Ranged (range >= 2):** the target is a visible enemy unit in range, **or any existing square in range that holds no own unit** (a "blind shot"). A blind shot hits whatever is there: an invisible unit takes the damage, a mine is set off, and an empty square shows "Nothing there". The AP and the action are spent either way.
- **Power 0 can't attack** [A2-19]: a unit whose current Power is 0 (an unbuffed dummy) can't declare Attack.
- **Damage** = the attacker's current Power through the pipeline (3.3).
- **No hitting back** [A2-20]: only the attacker deals damage.
- **Attacking doesn't reveal the attacker** [A4-12]: the target's owner gets no vision of it.
- Savagery's extra attack and Assault are attacks for every damage rule, but not actions.

### 2.7 The Defend action  [A2-21 - Med]

> "defend (a defending unit receives half the damage rounded up(never less than one))" (L15)

- An action that costs the unit's AP cost. The unit gains the status **Defending** until the start of its controller's next turn.
- While Defending, every damage instance it receives, from any source (attacks, abilities, mines, Pajazon ticks), is halved and rounded up, at pipeline step 5 (3.3).
- If the same unit later in the same turn takes another action or makes an attack (Savagery included), Defend is lost. The UI should warn. Triggered effects (Assault) don't cancel it.
- Defending is shown to the opponent as a status whenever the unit is visible.

### 2.8 Using an active ability

- **Declare:** choose the ability and all its targets together; pay its ability cost; it uses one of the unit's actions; its cooldown starts (2.9). Legality is checked against the player's own knowledge.
- **Resolve:** at once, against the true state. There is no stack and no responses, except the triggered effects of 2.11.
- If a hidden fact makes it fail or change (Stealth seen by an unseen enemy, or placing onto an unseen mine when `MINDS_EYE_REVEALS_MINES` is off), the AP and the action are still spent and the outcome is shown [A4-14].

### 2.9 Cooldowns and durations  [A2-22 to A2-26]

- **Cooldown "CD N"** [A2-22 - Med]: after use on own turn T, the ability is next usable on own turn **T + N + 1**. It can't be used again in turn T either, unless its text says it may be used more than once per turn (Baba Yaga's "Can be applied twice"). So **CD 1 = usable every other own turn.** Implementation: `readyOnOwnTurn = useTurn + N + 1`.
- **"For N turns"** [A2-23 - Low]: counts the controller's own turns, including the turn it is created on. An effect created on own turn T lasts until the start of own turn T + N, so it sees N of its controller's end-of-turn phases and N of the opponent's. (Pajazon: 2 heal ticks and 2 damage ticks.)
- **No duration stated** [A2-24 - Low]: a non-passive effect without a duration (Forcefield) lasts until the start of its controller's next turn, like Defend.
- **Ownership** [A2-25 - High]: each ability on each unit instance has its own cooldown. Two Wizards track theirs separately, and a Wizard's two abilities are independent. A unit revived by Queso keeps its cooldowns.
- **After the source is gone** [A2-26]: created things persist after their creator dies (Forcefield squares, Pajazon areas, dummies, mines). Auras end the moment their source leaves the board (Strong aura, Mad inventor, Command Aura, Kulega's Fine Print, Queso's beacon, Ratasius' detection and weakness).

### 2.10 Turn phases and the fixed start/end order  [A2-27 - Med]

Each turn has three phases: **Start**, **Main** (the active player acts) and **End**.

**End phase of the active player A** (after A presses End Turn, or the timer runs out):

1. **Damage ticks.** Every Pajazon area cast by the opponent B deals 3 ability damage to each of A's units inside it ("At the end of the opponent's turn, enemy units take 3 damage", L107). A unit inside several of B's areas takes one tick. All ticks form one simultaneous event (3.4): compute, apply, resolve all deaths together, then death triggers (Kulega heals, Queso revive prompts) in APNAP order.
2. **Commander check.** If a commander died, the game ends (draw if both).
3. **Heals**, applied together and each capped at max toughness: **Perseverance** +1 on each of A's Soldiers; A's **Pajazon** areas +3 on each of A's units inside (one tick per unit); A's **Queso beacon** +5 on A's units within range 2 of Queso (Queso included). Damage has already been applied, so the order of heals doesn't matter.
4. **Capture check** for each enabled building (6.4).
5. **End-of-turn expiries.** None in v1; the step is reserved for future content.
6. The turn passes.

**Start phase of player B:**

1. **Expire** B's effects that last "until the start of B's next turn": the Defending status of B's units, B's Forcefields, and B's Pajazon areas whose two own turns are over.
2. **Reset** B's per-turn counters: actions used, Move used, Savagery used, Baba Yaga regenerations this turn.
3. **Refill** B's AP pool to `AP_PER_TURN` (or `FIRST_TURN_AP` on South's first turn).
4. **Advance** B's own-turn index; cooldown readiness follows (2.9).
5. **Start-of-turn triggers.** None in v1; reserved.
6. Main phase.

Commander deaths are checked after every damage event and goal rows after every step (6.2, 6.3), so no separate end-of-turn victory check is needed.

### 2.11 Triggers, simultaneity and choices  [A2-28 to A2-30]

- **Immediate** [A2-29]: a trigger resolves fully as soon as its condition occurs, inside the action in progress (for example halfway through a move). Deaths are checked after every damage event.
- **Deaths caused by paying a cost** (a sacrifice for Julio Vernification or Feast) trigger **after** the action's own effect has resolved.
- **Simultaneous effects** [A2-28]: within one resolution step, damage before healing; then the **non-active player's** triggers before the active player's (APNAP); within one player's, in creation order (older objects first; units by deployment or creation number).
- **Simultaneous damage** (an area effect, the end-of-turn ticks): compute every target's damage from the board as it stood before, apply it all, resolve all deaths together, then their triggers (3.4).
- **Reactions on the opponent's turn:** only two exist. **Assault** is automatic. **Queso's revive** is a choice.
- **Pending choice** [A2-30 - Low]: when a choice belongs to the non-active player, the engine enters a pending-decision state and the active player can't act until it resolves. The prompt times out after `REACTION_PROMPT_TIMEOUT_S = 15` s and then defaults to "no". Each player sets a preference (`REVIVE_PREFERENCE`: Ask by default, Always, or Never); Always and Never answer at once with no pause. The active player sees "Opponent is deciding" only if the dying unit was visible to them; otherwise the wait looks like an ordinary animation pause (PX BT-14). The turn timer pauses meanwhile.

### 2.12 Ending turns, timers, resignation and draws  [A2-31 - Low]

- **End Turn** is available at any time, even with AP left or without having acted. The UI warns when AP is left and a unit could still act (PX BT-30).
- **Turn timer:** a lobby option, off by default. When it runs out, the action in progress finishes and the turn ends. The timer pauses during prompts, take-back requests and disconnections.
- **No turn limit** in v1 (see S19 and S01 for stalemate breakers).
- **Resign** is always available, in either player's turn. **Draw by agreement** is available. A draw also happens when both commanders die in the same resolution (A6-02).
- Disconnection and forfeit handling belong to the session layer (PX NET-03, NC Q18). The rules only need the result types in 6.1.

---

## 3. Combat

### 3.1 Stat vocabulary  [A3-09 - Med]

| Term | Meaning |
|---|---|
| Printed toughness | The number in the unit line. |
| Base toughness | Printed toughness + permanent modifiers (Trill's +2; Queso's own max-toughness sacrifices). |
| Max toughness | Base toughness + temporary modifiers (Strong aura). |
| Current toughness | What the unit has now (max minus damage taken, plus healing). "hp", "health" and "life" all mean current toughness; "base hp" (L87) means the healing cap, which is max toughness (3.6). |
| Current Power | Printed Power + Keep +3 + Strong aura +1 + Mad inventor +1 + Sabrina +2 (each when it applies). |

### 3.2 Kinds of damage, and what Power bonuses touch  [A3-01, A3-02]

- **Attack damage** = the attacker's current Power. Sources: the basic Attack (melee, or the Ranger's ranged attack, blind shots included), Savagery's extra attack, and Assault.
- **Ability damage** = a fixed number: Smite 8; Forceful slam 10 on the target square and 3 on the splash; Pajazon 3 per tick; Trip Mine 5, or 10 against size 2; Julio Vernification X (the sacrificed unit's current toughness).
- **Power bonuses** (Keep, Strong aura, Mad inventor, Sabrina) change attack damage only, never ability damage.
- Text about "attack" or "attacking" (Fierce attacker, Savagery, the mine's "ranged attack") refers to attacks only. Text about "damage" (Defend, Line Formation, Reinforced Armor, Forcefield, the Stealth reveal, Ratasius' weakness) covers both kinds.

### 3.3 The damage pipeline  [A3-03 to A3-06]

Computed per target and per damage instance, in this order:

| Step | Applies to | What happens | Floor |
|---|---|---|---|
| 1. Base | all | Attack: the attacker's current Power. Ability: its fixed number. | - |
| 2. Source additions | attacks | Fierce attacker: +1 for each **other** own Mercenary adjacent to the attacked unit (8.2). | - |
| 3. Source subtractions | damage dealt right now by a unit (attacks, Smite, Slam, Julio Vernification) | Ratasius' weakness: -4 if the dealer is within range 1 of an enemy Ratasius when the damage resolves (7.8). Never mines or Pajazon ticks. | **0**. A result of 0 stops here: **no damage event at all**, so no reveal and no trigger [A3-04 - Low]. |
| 4. Target flat reductions | all damage | Subtract the sum of Reinforced Armor 3, Line Formation 2 and Forcefield 8 (each only if it applies). | **1** [A3-05] |
| 5. Defend | all damage | If the target is Defending: x = ceil(x / 2). | at least 1 automatically |
| 6. Apply | | Current toughness -= x. Death check (3.8). | - |

```
x = base
x = x + sourceAdditions            // attacks only
x = max(0, x - sourceSubtractions)
if x == 0: no damage; stop
x = max(1, x - targetFlatReductions)
if target.defending: x = ceil(x / 2)
target.current -= x
```

- **Order (subtract, then halve)** [A3-03 - Med]: switch `DAMAGE_ORDER`. The alternative (halve, then subtract; AB G-26) protects defenders more. See C3.
- The "never less than one" of Defend (L15) is satisfied automatically, because x >= 1 after step 4. A hit that is 0 after step 3 stays 0; Defend never raises 0 to 1 (RL C-11).
- Defend and all target-side reductions apply to every kind of damage: attacks, abilities, mines and Pajazon ticks [A3-06].

Worked examples (more in Appendix B):

| Situation | Steps | Damage |
|---|---|---|
| Berserker (12) hits a defending Paladin | 12 - 3 = 9, ceil(9/2) | **5** |
| Footman (1) hits a Paladin | max(1, 1 - 3) | **1** |
| Mercenary (2) with 3 other Mercenaries next to the target hits a defending Paladin | 2 + 3 = 5, 5 - 3 = 2, ceil(2/2) | **1** |
| Footman (1) standing next to an enemy Ratasius hits anything | 1 - 4 -> 0 | **none** |
| Beast (20) hits a defending Paladin inside a friendly Forcefield | 20 - (3 + 8) = 9, ceil(9/2) | **5** |
| Mine hits a Footman in formation inside a Forcefield | max(1, 5 - (2 + 8)) | **1** |

**Where each modifier sits** (the brief's list):

| Modifier | Source | Pipeline step |
|---|---|---|
| Keep +3 Power | building (controller's units) | 1 (attacks only) |
| Strong aura +1 Power | Priestess | 1 (attacks only); its +1 toughness raises max toughness (3.7) |
| Mad inventor +1 Power | Artificer, for dummies | 1 (attacks only) |
| Sabrina +2 Power | commander | 1 (attacks only) |
| Trill +2 toughness, commander 10 | commander | not in the pipeline: base toughness |
| Fierce attacker +1 per Mercenary | Mercenary | 2 (attacks only) |
| Ratasius' weakness -4 | commander aura | 3 (floor 0) |
| Reinforced Armor -3 | Paladin | 4 (floor 1) |
| Line Formation -2 | Footman | 4 (floor 1) |
| Forcefield -8 | Royal wizard | 4 (floor 1) |
| Defend: half, rounded up | action | 5 |

### 3.4 Area and simultaneous damage  [A3-07 - Med]

Forceful slam, a Pajazon tick, and the end-of-turn ticks resolve in three passes:
1. Compute every target's damage from the board as it stood just before. Line Formation adjacency, Forcefield coverage and Defend are judged then.
2. Apply all of it.
3. Resolve all deaths together, then their triggers (2.11).

A unit is hit at most once per effect instance, even a 2x2 unit covering several affected squares (1.6).

### 3.5 Toughness loss that is not damage  [A3-08 - Med]

These skip the whole pipeline (no Armor, Forcefield or Defend), never reveal a Rogue, and are not "damage received":
- the Shared wounds donor's loss (8.7);
- Queso's max-toughness payment for a revive (7.9);
- losing a toughness aura (3.7).

### 3.6 Healing and caps  [A3-10 - High]

> "Unlike MTG, the units that receive damage do not regenerate or recover toughness at the end of turn, unless some kind of ability or skill is involved." (L19)

- Damage stays on a unit until something heals it.
- "Heal", "regenerate", "gain life" and "recover" all raise current toughness, **capped at max toughness**. Nothing heals above max: no overheal, Feast included (`OVERHEAL = false`).
- A revive sets current toughness to ceil(base toughness / 2) (7.9).
- Dead units can't be healed.

### 3.7 Gaining and losing toughness modifiers  [A3-11 - Med]

- **Permanent** modifiers change base toughness: Trill's +2, and Queso's own max-toughness payments (which clamp current down to the new max; they don't otherwise lower it).
- **Temporary** modifiers change max toughness: Strong aura.
  - **Gaining** +b raises max and current by b.
  - **Losing** it lowers max by b and current by b, but **never below 1** (`AURA_LOSS_CAN_KILL = false`). Example: a commander next to its Priestess is 2/2; it takes 1 damage (2/1); it steps away and becomes 1/1, still alive.
  - The leftover exploit is tiny. Only a unit at exactly 1 current toughness inside the aura gains anything from stepping out and back in: it goes from 1 to 2, once per damage episode, at the cost of two Moves.

### 3.8 Death  [A3-12 - High]

- A unit dies the moment its current toughness is 0 or less: after any damage event, any loss of max toughness, mid-move or during end-of-turn effects.
- It is removed at once, with all its statuses. Death triggers fire (Kulega's Fine Print, Queso's revive prompt). A dummy's cap slot is freed.
- A commander's death ends the game (6.2).

### 3.9 Sacrifice  [A3-13 - Med]

> "Sacrifice half of adjacent unit's (or itself) hp" (L87); "Sacrifice an adjacent unit" (L91, L111); "sacrifice 1 max toughness" (L130)

- "Sacrifice a unit" means destroying one of **your own non-commander units**, never an enemy and never a commander (`SACRIFICE_ENEMIES = false`).
- It is not damage: no reductions, no Defend, no reveal.
- **It counts as dying** for "when ... dies" triggers (Kulega, Queso).
- Values that read the sacrificed unit's toughness use its current toughness immediately before the sacrifice, auras included.
- Death triggers caused by the sacrifice resolve after the action's effect (2.11).
- "Sacrifice half of ... hp" (Shared wounds) and "sacrifice 1 max toughness" (Queso) are non-damage toughness loss (3.5), not unit sacrifices.

### 3.10 Allegiance and friendly fire  [A3-14 - Med]

- "Ally", "allied" and "friendly" = controlled by the same player; "enemy" = controlled by the opponent. Faction never matters for allegiance.
- **Helpful effects** that just say "units" (Keep, Market, Strong aura, Command Aura, Kulega, Queso) mean **your own units**.
- **Harmful area or square effects** hit **every unit** on the affected squares, friend or foe: Forceful slam (target and splash), Trip Mines ("any unit steps on it", L101). Pajazon names its sides explicitly ("allied" heal, "enemy" damage).
- **Basic attacks and harmful single-target effects** (Smite, Julio Vernification's damage) may target **enemy units only** (changed from AB SMI/JUL, which allowed own targets after confirmation; see C16).

### 3.11 Stacking  [A3-15 - Med]

- Effects with **different names** add up (Strong aura + Keep; Pajazon heal + Queso beacon + Perseverance).
- A unit gets **at most one instance of each named effect**: Strong aura, Forcefield, a Pajazon tick (heal or damage), Command Aura, Mad inventor, Ratasius' weakness, Queso's beacon. Two Priestesses still give +1/+1; two Scourges still give +1 action (`SAME_NAME_STACKING = false`).
- Effects defined by counting stack by design: Fierce attacker counts every qualifying Mercenary.
- Extra actions from different sources add up (Market + Command Aura = 3 actions; still one Move).

---

## 4. Vision and hidden information

### 4.1 LOV and vision  [A1-03, A4-01 - High]

> "Each player will only have vision around the vision field of each unit. Everything outside will be in the fog of war." (L17)
> "LOV (Line of Vision) or vision, is also determined using this logic. A LOV of 1 will only show the 4 orthogonal adjacent squares. A LOV of 2, will show 12 squares around the unit, and so on." (L37)

- A unit's **vision area** = every existing square within Manhattan distance <= LOV of any of its squares, its own squares included. LOV 1 shows exactly the 4 orthogonal neighbours, LOV 2 shows 12 (both match L37), LOV 3 shows 24, LOV 4 40, LOV 6 84.
- A **player's vision** = the union of the vision areas of all their units: the commander and No-ACB dummies included.
- Nothing blocks sight in v1: not units, blockers or buildings [A1-12].
- Vision is recomputed after every movement step and every action or event, in both players' turns.
- LOV modifiers: Kulega +1 for all own units; Ratasius' commander LOV is 6.

### 4.2 What each player knows  [A4-02 - Med]

| Category | Contents |
|---|---|
| **Public** | The scenario (board shape, blockers, buildings); who controls each building, and capture or "contested" results; round, active player and the End Turn event; both commanders' identities (from the start of deployment); each player's AP pool size (a constant); the lobby settings. |
| **Your own** | All your units with every stat, status, cooldown and action count; your AP left; your mines; your Stealthed units; your area effects. |
| **Visible enemy units** (inside your vision and not invisible) | Unit type and tier; current and max Power and Toughness; public statuses (Defending, inside a Forcefield, weakened, Keep bonus, Market action). **Not** their cooldowns, actions left or AP spent. |
| **Enemy area effects** | Forcefield squares and Pajazon areas (with turns left), on the squares inside your vision. |
| **Hidden** | Enemy units outside your vision; invisible enemy units; unrevealed enemy mines; revealed enemy mines outside your vision; the opponent's AP left; their cooldowns and action counters; their army list (until the game ends); prompts the opponent is answering. |

- **Last-seen markers** [A4-16]: a client may keep a faded marker where it last saw an enemy unit or a revealed mine (PX BT-22). This is client memory of what the player saw, not engine state.

### 4.3 Visible, invisible, revealed  [A4-03, A4-04 - High]

- A unit or mine is **visible** to a player only if it is inside that player's vision **and** is not invisible to them.
- **Invisible** (a Stealthed unit, an unrevealed mine) means invisible to the **opponent only**. Its owner always sees it.
- **Revealed** removes invisibility; it does not grant vision. A revealed Rogue outside every enemy unit's LOV is still hidden by the fog. A revealed mine is shown to the opponent whenever its square is inside their vision.

### 4.4 Stealth  [A4-05 to A4-10]

> "Stealth:1:Only activate this ability if not inside the LOV of another enemy creature. This unit becomes invisible. It will be revealed when it's 1 square away from an enemy unit, or when receiving damage inside enemy LOV." (L81)

- **Activation check** [A4-05 - Med]. Stealth is checked against the true state: no enemy unit (commander, dummies and invisible units included) may have the Rogue's square inside its LOV.
  - If an enemy unit the player **can see** has the square inside its LOV, the button is disabled with "An enemy can see this unit".
  - Otherwise Stealth may be declared. If an **unseen** enemy sees the square, Stealth **fails**: the 1 AP and the Rogue's action are spent, the Rogue stays visible, and its owner sees "Spotted: an unseen enemy can see this square" (C11).
- **While Stealthed**: invisible to the opponent; can't be the target of unit-targeted actions; still hit by square and area effects and blind shots (2.6); its own vision still counts for its owner; it may Move and Defend without being revealed.
- **Reveal conditions.** Any one ends Stealth, and the Rogue becomes a normal visible unit:
  - **R1, adjacency** [A4-06]: an enemy unit is at distance 1. It is state-based, checked after every step, placement, creation and revive, whoever caused it. (Moving next to an enemy also triggers Assault first, 8.6.)
  - **R2, damage in sight** [A4-07]: the Rogue receives damage (more than 0 after the pipeline) while its square is inside the LOV of at least one enemy unit.
  - **R3, detection** [A4-08]: the Rogue is inside the LOV of an enemy Mind's Eye unit, or within range 3 of an enemy Ratasius.
- A revealed Rogue stays revealed until it uses Stealth again, which needs the activation condition to hold [A4-09].
- **Owner information** [A4-10]: the owner is always told when their unit loses Stealth. The cause is shown only if they can see it ("Revealed" vs "Revealed by the Juliomancer at K14"). A player must know the true state of their own units (C30).
- **Consequences.** A Stealthed unit can never make a basic melee attack: any melee target is at distance 1 and has already revealed it (R1). A Stealthed Rogue can never Assault Ratasius or a Mind's Eye unit: one step changes a distance by at most 1, so any approach passes distance 3 first, where detection reveals it (X-01, X-02).

### 4.5 Mines  [A4-11, A8-16]

> "Deploy an invisible mine in a free adjacent square." (L101)

- A mine is invisible to the opponent, even inside their vision, until it is revealed or explodes. Its owner always sees it.
- **Revealed** by an enemy Mind's Eye unit's LOV or by enemy Ratasius within range 3 [A4-11 - Low]. A revealed mine stays revealed until it explodes and is shown whenever its square is in the opponent's vision. The owner sees that it was revealed.
- Mines don't block movement or placement for the opponent, who doesn't know about them.

### 4.6 Detection: Mind's Eye and Ratasius  [A4-08, A4-11]

| Source | Reveals | Area |
|---|---|---|
| Mind's Eye (Juliomancer, Artificer) | enemy Stealthed units and enemy mines | the unit's LOV: 3, or 4 under Kulega |
| Ratasius I | enemy Stealthed units and enemy mines | Manhattan range 3 from Ratasius |

Both are continuous and state-based: checked after every step, placement and creation, on both players' turns. Two sources don't "stack"; they simply reveal.

### 4.7 Actions that depend on hidden facts  [A4-14 - Med]

**Principle: never refuse an action because of something its player can't see.** The action is checked against what the player knows and resolved against the true state. If the hidden truth makes it fail or stop, its AP and action are still spent and the outcome is shown. The UI may disable an action only for a reason the player can see. Cases:
- a move bumping into a newly seen enemy (2.5);
- Stealth seen by an unseen enemy (4.4);
- a blind shot at an empty square (2.6);
- placing a dummy or mine onto an unseen enemy mine, possible only if `MINDS_EYE_REVEALS_MINES` is off (8.10).

### 4.8 What each player is told

| Event | Acting player | Other player |
|---|---|---|
| A unit moves | every step | only the steps inside their vision; a unit leaving vision fades at the edge |
| An attack or ability hits your unit | - | always the amount and the damaged unit; the attacker only if visible ("took 3 damage from an unseen attacker") [A4-12] |
| Stealth activated (or failed) | yes | nothing |
| A Stealthed unit is revealed | always (cause if visible) [A4-10] | the unit appears if it is inside their vision |
| Mine placed | yes | nothing |
| Mine explodes | the owner is always told | the explosion and damage, if the square is inside their vision |
| Mine revealed by detection | the owner sees it marked revealed | the mine appears if inside their vision |
| Dummy created | yes | it appears if inside their vision |
| Area effect cast | yes | the squares inside their vision show it [A4-13] |
| Capture, hold or "contested" result | public | public |
| A Queso revive prompt | the prompted player | "Opponent is deciding" only if the dying unit was visible to them |
| AP spent | own only | hidden |
| End Turn, take-back requests and answers, resign, draw offers | public | public |

### 4.9 Authority and engine contract  [A4-15 - High that it's needed; Med on where it runs]

- Fog, hidden armies, hidden deployment and invisible units only stay hidden if **one authority** holds the full state and sends each client only its own view, `view(state, seat)`. Clients never receive hidden units, mines or prompts meant for the other player.
- In v1 the authority is the host's browser (NC section 6). The host could inspect the hidden state with developer tools; that is accepted for play between friends. A later server mode runs the same engine and removes it (Q9).
- **Engine:** pure and deterministic, `apply(state, intent) -> (state', events[])`. The only randomness is the first-player coin flip, which is committed and logged. This makes take-backs exact (section 9), and replays and resyncs cheap.
- Every event is tagged with who may see it (4.8). The UI gets ranges, paths, previews and legality from the engine and never computes rules itself (PX R1).

---

## 5. Army building and deployment

### 5.1 Army building  [A5-01 to A5-03, A5-11]

> "... two players, which start with a limited amount of money, and must spend that money to acquire any combination of units that can fit the budget." (L3)
> "The player will have a budget of 200, which can be edited in the future, but for now the default is 200." (L27)

- **Cost** = the unit's type (denomination): a Footman costs 1, a Celestial Emissary 100 [A5-01 - High]. Sabrina changes some prices (7.6). The commander is free [SPEC L32].
- **Budget** 200, the same for both players; the army's cost must be <= the budget [A5-02 - High]. Leftover money is allowed and does nothing [A5-02 - Med]. L3's "must spend that money to acquire any combination of units that can fit the budget" is read as "units are bought with money, within the budget". The literal alternative, that the whole budget must be spent, can always be met (type-1 units cost 1, and no commander changes their price), so it is only a switch: `MUST_SPEND_FULL_BUDGET = false` (Q85). The budget is a dev/lobby setting (`BUDGET`).
- **Budget changes** [A5-14 - Low] ("which can be edited in the future, but for now the default is 200", L27): players can't change it in v1 (PX LB-08). The lobby carries one value for both players. The data model stores it per player so that handicaps stay possible; each player's `AP_PER_TURN` then comes from their own budget (Q93). A saved army records the budget it was built for; in a lobby whose budget it exceeds, it is listed but can't be readied (PX AB-09, AB-10).
- **Minimum army** [A5-12 - Med]: an army with no units besides the commander is legal. The builder warns ("Your army has no units besides the commander"), but the army can be readied (PX AB-08, Q86).
- **An army** = faction + commander + unit counts [A5-11]. A saved army is priced with its own commander, so switching commanders re-prices it (Sabrina). An army over budget can be saved as a draft but can't be readied (PX AB-10).
- **One faction per army**, and the commander must belong to it (7.2).
- **No copy limit and no unit cap** [A5-03 - Med]. The army only has to be **deployable** in the scenario: with the commander taking one normal-zone square,
  - `1 + footprint area of non-Vanguard units <= free normal-zone squares` (109 on Crossroads, so at most 108 one-square non-Vanguard units), and
  - `1 + footprint area of all units <= free normal + extended squares` (159 on Crossroads).
  A Beast counts 4 squares. A design cap of 30-40 units is suggested, not assumed (S03).

### 5.2 Zones  [A5-05 - High]

> "Each player gets a portion of the map, at the edges and usually opposing each other, where they can deploy the units. Some units can be deployed in the extended deployment area, which covers slightly more terrain." (L29)
> "The normal deployment zone covers the first 5 rows closest to the player. The extended deployment zone covers 2 extra rows." (L31)

| Side | Normal zone | Squares (rule A) | Extended zone | Squares |
|---|---|---|---|---|
| South | rows 1-5 | 109 (17 + 21 + 23 + 23 + 25) | rows 6-7 | 50 |
| North | rows 21-25 | 109 | rows 19-20 | 50 |

Eleven open rows (8-18) separate the two extended zones. Crossroads has no blockers or buildings inside any zone.

### 5.3 Extended zone (Vanguard)  [A5-04 - Low]

No unit line says who may use the extended rows. Default: a per-unit data flag `vanguard`, set for the **Rogue** and the **Ranger** (the scout and skirmisher). It is never set for the commander, and dummies are never deployed. A Vanguard unit may deploy in either zone.

### 5.4 Deployment procedure  [A5-06, A5-07 - Med]

- **Simultaneous and hidden.** Both players place their whole army at the same time. Each sees only their own placements plus the public scenario. Placements can be changed freely, and "Confirm" can be withdrawn, until both players have confirmed. The battle then starts. Commit-reveal of each deployment is recommended (NC 7.15).
- **Everything is placed:** every purchased unit must be deployed; Confirm stays disabled until then.
- **Commander:** must be deployed, in the normal zone.
- **Squares:** one unit per square; a 2x2 unit fully inside its zone; no blocker or building squares.
- **Not deployable:** mines and dummies; they are created only during play.
- Hidden placement is safe: the largest vision in the game (Ratasius' LOV 6) from the furthest deployable row (7) reaches row 13, and the enemy's extended zone starts at row 19.

### 5.5 What is revealed before the battle  [A5-08, A5-09]

- **At the start of deployment:** who moves first (and therefore who is South), and both commanders' identities: name and text, not position [A5-09 - Low]. Commander effects change numbers the opponent sees within a turn or two anyway.
- **Army lists stay secret** for the whole battle; a unit is known only when seen [A5-08 - Med]. Both full armies are shown on the result screen.

---

## 6. Objectives

> "The objective of each player is to defeat the commander of each party. ... Another way of winning is if you manage to bring your commander to the opposite side of the board. More specifically, to the last row." (L32)
> "For now, the objectives stand as conquest or domination (Killing enemy commander, reaching the other side of the board)." (L45)

L45 names the same two win conditions [A6-12 - High]: **conquest**, killing the enemy commander (6.2), and **domination**, reaching the other side of the board (6.3). The result screen uses these words (PX RS-01). Holding buildings is neither (S19). "For now" means more objective types may follow; scenarios store their objectives as data (1.8), so a new one is content, not an engine change.

### 6.1 Results

| Result | How |
|---|---|
| Win | The enemy commander dies (6.2); your commander reaches your goal row (6.3); the opponent resigns; the opponent forfeits (session layer). |
| Loss | The mirror of the above. |
| Draw | Both commanders die in the same resolution [A6-02 - Med]; or both players agree. |

Holding buildings never wins the game in v1 (a building-control win is suggestion S19; it would be a third win condition, not the spec's "domination").

### 6.2 Commander kill  [A6-01 - High]

- A player whose commander dies (current toughness <= 0) **loses immediately**, in either player's turn, even mid-move or during end-of-turn effects. There is no successor.
- If both commanders die in the same resolution (a Forceful slam splash, a single tick event), the game is a **draw** [A6-02].
- Commanders can't be sacrificed or revived (7.1). Deaths are checked before the goal row (6.3).

### 6.3 Reaching the last row  [A6-03, A6-04]

- The goal row is the opponent's back row: **row 25 for South, row 1 for North** (17 squares each under rule A) [A6-04 - High].
- **Win instantly** when your commander stands on any goal-row square **after that step's triggers have resolved** (mine, then Assault; 2.5) and it is still alive [A6-03 - Med]. A mine on that square, or an Assault there, can still stop it.
- The shortest trip on Crossroads is 20 steps (row 5 to row 25), so 20 turns at Movement 1; extra actions can't speed it up (one Move per turn). Commander movement is suggestion S21.

### 6.4 Buildings: capture  [A6-05 to A6-09]

> "There will be, however, for now, two optional objectives: The keep, The market. Each one will occupy a 2x2 square and will be conquered when at least one unit, without opposition, is in range of 1(including corners) of that building. One conquered, the building can be reconquered by the same method." (L45)

- **Presence:** the Keep and the Market are each a 2x2 building. Crossroads has one of each. They start **neutral**. The lobby can switch each one off; a switched-off building is removed from the scenario and its squares become open ground [A6-09 - Med for the toggle, Low for the removal]. Holding them never wins the game.
- **"Active" = controlled by a player** [A6-05 - High]. Only the controller's units benefit.
- **Ring:** the 12 squares at Chebyshev distance 1 from the building [A6-06 - High]. A 2x2 unit counts if any of its squares is in the ring.
- **When:** checked at the **end of every turn** (both players' turns), after the end-of-turn damage and healing (2.10 step 4) [A6-07 - Med]. Instant capture would let a player walk in and attack with +3 Power in the same turn.
- **How:** if units of exactly one player are in the ring, that player takes control (or keeps it). If both players or neither have units there, nothing changes. Control persists when the ring empties, and changes hands only by the same method.
- **Who counts** [A6-08 - Low]: any unit, including invisible units, commanders and dummies. Mines don't count. If a capture fails because of an enemy unit the capturing player can't see, the result is announced as "Not captured: contested", a small accepted leak (PX BT-27).
- Control and its changes are public, even through fog.

### 6.5 The Keep  [A6-10 - Med]

> "The keep: While the keep is active, all units receive a bonus of 3 power." (L52)

While a player controls the Keep, **every unit of that player gets +3 Power**, anywhere on the board, the commander and dummies included (a dummy becomes 3/7). It affects attack damage only; fixed ability damage is unchanged (Smite, Slam, Pajazon, mines, Julio Vernification).

### 6.6 The Market  [A6-11 - Med]

> "The market: While the market is active, all type-1 unit have an additional action per turn." (L53)

While a player controls the Market, **each of that player's type-1 units (Footman, Mercenary) has +1 action allowance per turn**. It doesn't apply to the commander or dummies (no type), nor to Sabrina's Artificers (type 10). The extra action costs AP like any other, and a unit still moves only once per turn. Control changes only at the end of a turn, so the bonus never changes mid-turn.

---

## 7. Commanders

### 7.1 The base commander  [A7-01 to A7-04]

> "The commander is by default a 1/1 unit, movement and AP of 1, LOV of 3, and doesn't count from the budget." (L32)

- Each player has **exactly one** commander and must pick one of the six named ones; both players may pick the same one [A7-01 - Med].
- Base stats: **1/1, Size 1, LOV 3, Movement 1, AP cost 1, attack range 1**. No type. It costs nothing.
- It is a **full unit** [A7-02 - Med]: it can Move, Attack (with its Power) and Defend. It receives friendly auras and effects (Strong aura, Keep, Command Aura, Forcefield, Pajazon heal, Holy blessing, Queso's beacon, Kulega's LOV) and suffers enemy effects and own friendly fire (Slam splash, mines). It captures and contests buildings, sets off mines, and reveals Stealthed Rogues; its LOV counts against enemy Stealth. Type-based rules never apply to it (Trill, Market, Kulega's type-20 ability).
- Its **"AP" is its cost per action**, like any unit's; it adds nothing to the pool [A7-03 - Med]. (Queso's AP 3 is a drawback.)
- It can **never be sacrificed**; it may be a Shared wounds donor, because that can't kill it. It can **never be revived** [A7-04 - High].
- Its identity is public from the start of deployment (5.5). Its position is hidden by fog like any unit's; it is never auto-revealed.
- Win and loss: 6.2 and 6.3.

### 7.2 Factions and commander assignment  [A7-05, A7-06 - Low]

> "The game features, for now, 2 clans or factions. It may be possible to add new factions later into the game." (L43)
> "### The Empire" (L59), immediately followed by "### Lojrar Clan" (L60), then all 14 unit lines.
> The commanders come in two groups of three, separated by a blank line: L124-126 and L128-130.

- **The Empire** owns the **14 listed units** (two per denomination, matching "each unit has 2 variations", L5) and the commanders **Trill "The Hydrocephalic"**, **Kulega "The Fine Printer"** and **Sabrina "The Reelfinisher"**.
- **Lojrar Clan** owns the commanders **Baba Yaga "The Bwitch"**, **Ratasius I "The Great"** and **Queso "The Beacon of hope"**.
- **THE LOJRAR CLAN ROSTER IS MISSING.** The spec gives Lojrar no units of its own. Until the owner supplies them, `LOJRAR_PROXY_ROSTER = true`: a Lojrar army fields the Empire's 14 units as a stand-in, so all six commanders are playable in v1. Art may skin the proxy units in Lojrar style. BA section 9 sketches a possible roster direction (S24); it is not adopted.
- **Evidence for this split.** Sabrina's text names Artificers and No-ACBs, which exist only in the listed roster, so she must sit with it; the first group of commanders then matches the faction listed first. **Counter-evidence:** the Markdown literally nests the 14 units under "### Lojrar Clan", and "Ratasius I 'The Great'" reads like an emperor's regnal name. This is Q3 and Q4.
- **A third reading, not adopted** (PX G-01 (c)). "Like coins, each unit has 2 variations" (L5) may mean one variation per faction for each denomination, the way a euro coin has a common face and a national face. Then the 14 listed units are **both** factions' rosters, seven each, one per tier, and **no roster is missing**. The spec doesn't say which unit of each pair belongs where. Listing order would give {Footman, Soldier, Berserker, Priestess, Paladin, Royal wizard, Celestial Emissary} and {Mercenary, Ranger, Rogue, Juliomancer, Artificer, Beast of Knorund, Scourge of the Gods}. Trill, Kulega and Sabrina would then belong to whichever faction gets the Artificer, because Sabrina's text needs it. Under this reading `LOJRAR_PROXY_ROSTER` is dropped and each unit's `faction` field carries the split, which is a data change only. The default above stands until the owner answers Q3.
- **Rules** [A7-06]: an army has exactly one faction; it may include only that faction's units (Lojrar: the proxy roster); its commander must belong to that faction (`COMMANDER_FACTION_LOCK = true`). Mirror matches (same faction, same commander) are allowed. The data model is faction-aware from day one (`UnitDef.faction`, `CommanderDef.faction`, `ArmyDef.faction`), so a real Lojrar roster is a data drop.

### 7.3 Rules shared by all commanders  [A7-07 - High]

- A commander's bonuses apply only to its own player's units.
- They apply for the whole game, from deployment on, including to units created or revived later.
- The army builder shows the modified stats and prices.
- One commander per player; commanders never combine.

### 7.4 Trill "The Hydrocephalic" (Empire)  [A7-08 - High]

> "Trill "The Hydrocephalic": All units of type 1, 2, 5 gain 2 toughness. The commander has toughness 10." (L124)

- Every own unit of type 1, 2 or 5 gets **+2 base toughness** (+2 max and +2 starting current). It is permanent, so it counts for every "base" check (Shared wounds cap, revive amount, Kulega amount).
- The commander's toughness is **10**, replacing the default 1 (not 1 + 10): a 1/10 commander.
- Results: Footman 1/4, Mercenary 2/3, Soldier 2/9, Ranger 3/3, Berserker 12/4, Rogue 7/6. Dummies have no type and get nothing.

### 7.5 Kulega "The Fine Printer" (Empire)  [A7-09, A7-10]

> "Kulega "The Fine Printer": All units gain 1 LOV. All units of type-20 gain the following ability: When a unit of type 1 or 2 dies adjacent to this unit, regenerate toughness equal to that creature toughness, maximum of 4 per instance." (L125)

- **+1 LOV** for every own unit, the commander (LOV 4) and dummies (LOV 2) included [A7-09 - Med]. This also enlarges Mind's Eye coverage, the Forcefield's "in wizards LOV" area, and the squares where enemy Rogues can't Stealth.
- **Fine Print** (a triggered ability given to every own type-20 unit: Paladin, Artificer) [A7-10 - Low]:
  - Trigger: a type-1 or type-2 unit of **either side** dies while adjacent (Manhattan 1) to this unit. Sacrifices count. Adjacency is judged at the moment of death. It works on both players' turns.
  - Effect: this unit heals **min(4, the dead unit's base toughness)**, capped at its own max. Footman 2, Mercenary 1, Soldier 4 (7, capped), Ranger 1; more under the dead unit's own Trill.
  - One instance = one death x one type-20 unit: two type-20 units next to the same death both heal, and deaths in one blast trigger separately. Deaths of dummies, commanders and units of type 5 or more never trigger it.

### 7.6 Sabrina "The Reelfinisher" (Empire)  [A7-11 - Med]

> "Sabrina "The Reelfinisher": Artificers and No-ACBs get 2 additional power. Artificers now are considered type 10. Artificers can no longer use mines. Each other type-20 and above is 20% more expensive to deploy." (L126)

- Own Artificers +2 Power (3/15); own No-ACBs +2 Power (2/7; 3/7 with Mad inventor).
- Artificers are **type 10 for every purpose**, so they **cost 10** and count as type 10 in every type check.
- Artificers lose **Trip Mine B20** (removed from the ability bar).
- Every other unit of type 20 or more costs **x1.2, rounded up**: Paladin 24, Royal wizard 60, Beast 60, Emissary 120, Scourge 120. The surcharge applies to budget cost only, never to AP.
- With 200 budget: up to 20 Artificers, which allows 3 + floor(19/2) = 12 dummies.
- Presentation (art's call): the Artificer token shows tier 10 with a commander badge (PX AB-05).

### 7.7 Baba Yaga "The Bwitch"  [superseded by owner ruling R11]

> **Owner ruling R11 replaces this section.** Baba Yaga now has three player-selected variants (Mend the swarm, Hex Ward, Cauldron), defined in full in the OWNER RULINGS table at the top of this document. The text below records the original reading of the spec for reference only; the spec's regeneration ability is no longer implemented.

> "Baba Yaga "The Bwitch": Units of white gain the ability to regenerate 2 toughness for 2 AP (each instance). Only up to 2 units can regenerate toughness this way per turn. Can be applied twice to the same unit. CD 1" (L128)
> "The color of the token will represent the grade of the unit." (L44)

- **"Units of white"** [A7-12]: no grade-colour table exists, so until the owner defines one, **every own unit that has a grade** qualifies (all roster units; not the commander or dummies). It is stored as a grade filter (`BABA_WHITE_GRADES`), so the answer to Q53 is a data change. (AB and PX proposed grade 1 only; see C9.)
- **Granted ability "Bwitch Regeneration"** [A7-13]:
  - Active; costs **2 AP per use**; **not an action** (otherwise "applied twice" would break the one-action rule); usable only on its owner's turn.
  - Effect: the unit heals 2, capped at max.
  - Army-wide limit: **at most 2 uses per turn**, on two different units or both on the same unit.
  - Cooldown: a unit that used it can't use it on its controller's next turn (CD 1 per unit, 2.9). The second use on the same unit in the same turn is allowed by the text.
  - The literal alternative (2 different units, each up to twice, so 4 uses) is Q54.

### 7.8 Ratasius I "The Great" (Lojrar)  [A7-14 - Med, floor Low]

> "Ratasius I "The Great": This commander has LOV of 6. Reveals all invisible enemies in range of 3. Enemies in range of 1 gain weakness and deal 4 less damage" (L129)

- **Commander LOV 6** (replacing 3); otherwise the default 1/1, Movement 1, AP 1.
- **Detection** (passive aura): every enemy Stealthed unit and enemy mine within range 3 is revealed (4.6).
- **Weakness** (passive aura): an enemy unit within range 1 (orthogonally adjacent) deals 4 less damage per damage instance, at pipeline step 3, floored at **0**.
  - It is an aura only: it lasts exactly while the enemy stays adjacent, with no lingering status.
  - It cuts that unit's damage against **every** target, not only Ratasius.
  - It applies to attacks (Assault included) and to instant ability damage the unit deals (Smite, Slam, Julio Vernification), judged by the dealer's position when the damage resolves. It never applies to mines or Pajazon ticks.
  - With floor 0, Ratasius takes no damage from adjacent attackers with 4 Power or less. A Ranger at distance 2 or Smite at distance 2-3 are the natural counters.

### 7.9 Queso "The Beacon of hope" (Lojrar)  [A7-15, A7-16]

> "Queso "The Beacon of hope": This commander's AP is 3, and 3 toughness. Nearby units in range of 2 regenerate 5 health each player turn (not the opponent's turn). When a unit in that area dies you can choose to sacrifice 1 max toughness to revive that unit with half of its base toughness rounded up" (L130)

- **Commander stats: 1/3, AP cost 3** (every commander action costs 3 AP). Movement 1 and LOV 3 stay [A7-15 - Med].
- **Beacon** (triggered): at the **end of each of its controller's turns** (2.10 step 3), every own unit within range 2 of Queso, **Queso included**, heals 5, capped [A7-15 - Low for the self-heal]. The spec says only "each player turn (not the opponent's turn)". The end of the turn is chosen so that every own heal happens in one step, as with Perseverance ("at the end of the turn (Your turn)", L71) and Pajazon. The start of Queso's turn is the alternative (`QUESO_BEACON_TIMING`, Q89).
- **Revive** (triggered, optional) [A7-16 - Low]:
  - Trigger: an own **non-commander** unit dies while within range 2 of Queso, on either player's turn. Sacrifices count. The area is judged at the moment of death. Enemy units are never revived.
  - Choice: its controller may accept or decline (the prompt rules of 2.11).
  - Cost: **Queso's own max toughness -1, permanently**; current toughness is clamped to the new max. It is offered only while Queso's max toughness is at least 2, so **at most 2 revives per game** (3 -> 2 -> 1).
  - Effect: the unit returns on the square(s) where it died, as the **same instance**, with current toughness ceil(base toughness / 2). It keeps its cooldowns, cap slot (dummies) and actions used this turn; it loses temporary statuses (Stealth, Defending). The squares are always free, since the unit just left them. If a future effect ever fills them first, the unit appears on the nearest free square(s) within range 2 of Queso, chosen by its controller.
  - A unit dying in the same resolution as Queso can't be revived: the game is over. A revived unit next to a Stealthed enemy Rogue reveals it but doesn't trigger Assault.
  - Revive amounts, ceil(base / 2), for every unit: Footman, Mercenary, Ranger, Berserker 1; Rogue 2; Soldier 4; Priestess, Juliomancer, Artificer 8; Paladin, Royal wizard 10; Scourge 17; Beast 20; Emissary 25; dummy 4.

### 7.10 Commander summary

| Commander | Faction | P/T | Mv | LOV | AP cost | Effect on the army |
|---|---|---|---|---|---|---|
| (base) | - | 1/1 | 1 | 3 | 1 | - |
| Trill | Empire | 1/10 | 1 | 3 | 1 | Types 1, 2, 5: +2 toughness |
| Kulega | Empire | 1/1 | 1 | 4 (own +1) | 1 | All own units +1 LOV; type-20 units gain Fine Print |
| Sabrina | Empire | 1/1 | 1 | 3 | 1 | Artificers and No-ACBs +2 Power; Artificers type 10, cost 10, no mines; other type >= 20 cost x1.2 |
| Baba Yaga | Lojrar | 1/1 | 1 | 3 | 1 | Graded units may regenerate 2 for 2 AP; 2 per turn; CD 1 per unit |
| Ratasius I | Lojrar | 1/1 | 1 | 6 | 1 | Reveals invisible enemies and mines in range 3; adjacent enemies deal 4 less |
| Queso | Lojrar | 1/3 | 1 | 3 | 3 | +5 heal in range 2 at the end of own turn; revive for 1 max toughness (2 per game) |

---

## 8. Units and abilities

Imported from AB section 2 and brought in line with the decisions above. Rulings keep AB's IDs (FTM-1, ROG-5, ...) so tickets and tests can cite them. "(changed from AB ...)" marks a ruling this synthesis altered.

### 8.0 Data sheet and conventions

Spec format: "Name, Power/Toughness, Size, LOV, Movement, AP" (L57). The roster belongs to The Empire, and Lojrar uses it as a proxy (7.2).

| Type (cost) | Unit | P/T | Size | LOV | Mv | AP | Range | Vanguard | Abilities (kind, AP cost) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Footman | 1/2 | 1 | 1 | 1 | 1 | 1 | - | Line Formation (passive) |
| 1 | Mercenary | 2/1 | 1 | 1 | 1 | 1 | 1 | - | Fierce attacker (passive) |
| 2 | Soldier | 2/7 | 1 | 2 | 1 | 1 | 1 | - | Perseverance (triggered, end of own turn) |
| 2 | Ranger | 3/1 | 1 | 3 | 1 | 1 | **2** | yes | Ranged attack (passive) |
| 5 | Berserker | 12/2 | 1 | 2 | 1 | 1 | 1 | - | Savagery (passive; extra attack 2) |
| 5 | Rogue | 7/4 | 1 | 3 | 2 | 2 | 1 | yes | Stealth (active, 1); Assault (triggered, free) |
| 10 | Priestess | 3/15 | 1 | 2 | 2 | 2 | 1 | - | Strong aura (passive); Shared wounds (active, 2) |
| 10 | Juliomancer | 3/15 | 1 | 3 | 1 | 2 | 1 | - | Mind's Eye (passive); Julio Vernification (active, 2) |
| 20 | Paladin | 12/20 | 1 | 2 | 3 | 2 | 1 | - | Reinforced Armor (passive) |
| 20 | Artificer | 1/15 | 1 | 3 | 2 | 1 | 1 | - | Mind's Eye (passive); Prototype No-ACB (active, 2); Mad inventor (passive); Trip Mine B20 (active, 2) |
| 50 | Royal wizard | 10/20 | 1 | 3 | 1 | 3 | 1 | - | Forcefield (active, 2, CD 1); Pajazon (active, 3, CD 1) |
| 50 | Beast of Knorund | 20/40 | **2** | 2 | 2 | 3 | 1 | - | Forceful slam (active, 4, CD 1); Feast (active, 2) |
| 100 | Celestial Emissary | 15/50 | 1 | 4 | 2 | 4 | 1 | - | Holy blessing (active, 3); Smite (active, 3); Holy Fervor (passive) |
| 100 | Scourge of the Gods | 15/33 | 1 | 3 | 2 | 3 | 1 | - | Command Aura (passive) |
| - | No-ACB dummy (created) | 0/7 | 1 | 1 | 0 | 1 | 1 | n/a | none (Mad inventor: Mv 1, +1 Power) |
| - | Commander (base) | 1/1 | 1 | 3 | 1 | 1 | 1 | never | set by the named commander (7.10) |

Conventions for every ability:
- **Passive** abilities are always on, cost nothing and are not actions. **Active** abilities use one of the unit's actions and cost their ability cost instead of the unit's AP cost (2.4). **Triggered** abilities fire by themselves and are free.
- Targets are chosen when the ability is declared; legality uses the player's knowledge; resolution uses the true state (2.8, 4.7).
- "Adjacent" = Manhattan distance 1; "range N" = Manhattan <= N (1.4).
- Parse "Paladin: 12/20, ..." (L94, a colon instead of a comma) as a normal unit line. The roster lives in a data file rather than being parsed from prose (AB 0.15).

### 8.1 Footman (type 1)

> "Footman, 1/2, 1, 1, 1, 1" (L63)
> "Line Formation:P:If there's another 2 adjacent Footmen, reduce the incoming damage by 2 (not below 1)." (L64)

**Line Formation** [A8-01 - Med]: passive. For each damage instance this Footman receives, if **at least 2 other own Footmen** are adjacent to it at that moment, subtract 2 at pipeline step 4 (floor 1). It applies to all damage (attacks, abilities, mines, Pajazon ticks), on both players' turns, but not to toughness loss that isn't damage. It is on or off: 3 or 4 neighbouring Footmen still give only -2.

- **FTM-1** "another 2" means at least two others.
- **FTM-2** Only own Footmen count; an enemy Footman next to mine doesn't help.
- **FTM-3** Shapes under orthogonal adjacency: in a 1-wide line of 3, only the middle Footman qualifies; in an L of 3, only the corner; in a plus, the centre. **In a 2x2 block all four qualify** (each has two orthogonal Footman neighbours), and so does every Footman in any block 2 or more deep. (Corrects AB FTM-3, which implied a 2x2 block needs 8-adjacency.)
- **FTM-4** Under area damage, adjacency is judged on the board before the blast (3.4).
- **FTM-5** Dummies, Mercenaries and other units are never Footmen; revived Footmen count.
- **FTM-6** Berserker (12) against a defending Footman in formation: 12 - 2 = 10, ceil(10/2) = **5**. (Changed from AB's 4 by the pipeline order, C3.)
- **FTM-7** With a Forcefield: -10 in total, but at least 1.
- **FTM-8** Under Trill a Footman is 1/4: a Pajazon tick deals 3 - 2 = 1 to one in formation. With the Market it has 2 actions, still one Move.
- **FTM-9** Under Baba Yaga's default it may regenerate (7.7).

### 8.2 Mercenary (type 1)

> "Mercenary, 2/1, 1, 1, 1, 1" (L66)
> "Fierce attacker:P:Deal 1 extra damage for each Mercenary that is adjacent to the attacked unit" (L67)

**Fierce attacker** [A8-02 - Med]: passive. Each attack **this Mercenary** makes gets +1 at pipeline step 2 for each **other own** Mercenary adjacent to the attacked unit at the moment of the attack.

- **MER-1** The attacker doesn't count itself. (Read literally, a melee Mercenary is always adjacent to its target, so the clause would just be a 3-Power stat.)
- **MER-2** Only the attacking player's Mercenaries count, never the target's.
- **MER-3** Maximum bonus: a 1x1 target has 4 adjacent squares (one taken by the attacker), so **+3** (5 damage). A 2x2 Beast has 8, so **+7** (9 damage). Orthogonal adjacency already halves BA's worst case (+7 and +11 under 8-adjacency, BA D8).
- **MER-4** Only the Mercenary's own attacks get it; a Footman attacking a surrounded target gets nothing.
- **MER-5** The bonus is added before Defend and flat reductions: with +3 against a defending Paladin, 5 - 3 = 2, ceil(2/2) = 1.
- **MER-6** The Keep raises its Power to 5 before the bonus. Ratasius' weakness takes 4 from (Power + bonus), floor 0.
- **MER-7** Dummies are never Mercenaries; a revived Mercenary counts again.
- **MER-8** The Market's extra action lets a Mercenary move in and strike in the same turn.

### 8.3 Soldier (type 2)

> "Soldier, 2/7, 1, 2, 1, 1" (L70)
> "Perseverance:P: Regenerate 1 toughness at the end of the turn (Your turn)" (L71)

**Perseverance** [A8-03 - High]: at the end of each of its controller's turns (2.10 step 3), the Soldier heals 1, capped. Never at the end of the opponent's turn.

- **SOL-1** It fires every own turn, whether or not the Soldier acted or was damaged.
- **SOL-2** Dead units don't regenerate.
- **SOL-3** An enemy Pajazon ticks at the end of the Soldier's own turn, and damage comes first (2.10): a Soldier at 3 inside it goes to 0 and dies; at 4 it goes to 1, then regenerates to 2.
- **SOL-4** It stacks with Queso's beacon and an own Pajazon (different names).
- **SOL-5** Under Trill it is 2/9. Under Kulega, a Soldier dying next to an own type-20 unit heals that unit 4.

### 8.4 Ranger (type 2)

> "Ranger, 3/1, 1, 3, 1, 1" (L73)
> "Ranged attack:P: This unit's attack has a range of 2." (L74)

**Ranged attack** [A8-04 - Med]: passive. The Ranger's attack range is 2 (Manhattan; 12 squares, diagonal neighbours included). It may target a visible enemy unit in range, or any square in range that holds no own unit (a blind shot, 2.6). It is the **only "ranged attack" in v1** for mines (L101).

- **RNG-1** No minimum range: it can shoot adjacent units.
- **RNG-2** No line-of-fire check (nothing blocks sight in v1).
- **RNG-3** Smite targets "a unit", so it is not a ranged attack in the mine's sense.
- **RNG-4** A blind shot hits whatever stands there, including an invisible Rogue (revealed by R2, since the square is inside the Ranger's LOV 3); sets off a mine there, whoever owns it; or shows "Nothing there". The AP and the action are spent.
- **RNG-5** A mine set off by a shot is shown as an explosion to every player who sees the square; its owner is always told.
- **RNG-6** Shooting Ratasius from distance 2 isn't weakened (weakness reaches distance 1 only), so Rangers are the natural counter to him.
- **RNG-7** Under Trill it is 3/3. Under Kulega it has LOV 4; its range stays 2.

### 8.5 Berserker (type 5)

> "Berserker, 12/2, 1, 2, 1, 1" (L77)
> "Savagery:P: After attacking with the berserker, you can spend 2 AP to attack an additional time. Only once per turn." (L78)

**Savagery** [A8-05 - Med]: a passive permission. Once the Berserker's **basic Attack** has resolved this turn, its controller may pay **2 AP** for one more attack by the Berserker, **at any time later in the same turn** while it lives (changed from PX BT-13's "until another unit acts", C15). Once per turn. It is not an action. The target may be any legal attack target at that time.

- **BER-1** Yes, a Berserker can attack twice with one action: 1 + 2 = 3 AP for 2 x 12 damage.
- **BER-2** The UI keeps a "Savagery (2 AP)" button on the Berserker until the end of the turn.
- **BER-3** Only a basic Attack enables it (not Defend, not another Savagery).
- **BER-4** If the first attack killed its target, Savagery may hit another unit in range.
- **BER-5** With Command Aura (2 actions): Attack, Savagery, Attack (1 + 2 + 1 AP) or Move, Attack, Savagery. At most 3 attacks per turn, since Savagery stays once per turn.
- **BER-6** Each attack has its own pipeline: 15 + 15 with the Keep; 8 + 8 next to Ratasius.
- **BER-7** Under Trill it is 12/4. The Market doesn't apply (type 5).
- **BER-8** Savagery is an attack, so it cancels the Berserker's own Defend (2.7).

### 8.6 Rogue (type 5)

> "Rogue, 7/4, 1, 3, 2, 2" (L80)
> "Stealth:1:Only activate this ability if not inside the LOV of another enemy creature. This unit becomes invisible. It will be revealed when it's 1 square away from an enemy unit, or when receiving damage inside enemy LOV." (L81)
> "Assault: When an enemy unit comes into the melee range of this unit, if this unit is in stealth, perform an automatic attack without spending AP to the entering unit. (This can also occur in opponents turn)" (L82)

**Stealth** [A8-06 - Med]: active, **1 AP**, uses the Rogue's action. Activation, failure, the Stealthed state and reveals follow 4.4. It lasts until revealed; no cooldown; it can't be used while already Stealthed.

**Assault** [A8-07 - Med]: triggered, free ("without spending AP"), not an action.
- **Trigger:** the Rogue is Stealthed, and an enemy unit's distance to it **becomes 1 because of a movement step**: the enemy steps in (on the opponent's turn), or the Rogue steps in (on its own turn; the only way the trigger can happen on your own turn).
- **Effect:** one attack on that unit, with normal attack damage (Power 7 plus modifiers) through the full pipeline.
- **Order within the step:** mine, then **Assault, then the reveal (R1)**, then the move is interrupted (2.5). If R1 came first, Assault could never fire.

- **ROG-1** Stealth is the Rogue's action, so it can't Stealth and move in the same turn without an extra action. Typical pattern: turn A, Stealth (1 AP); turn B, move up to 2 squares (2 AP) next to an enemy, Assault for 7, revealed.
- **ROG-2** Activation depends on the true state. A visible watcher disables the button; an unseen watcher makes the attempt fail with its AP and action spent (changed from AB, C11).
- **ROG-3** Stealth can be used again after a reveal, once the condition holds.
- **ROG-4** An enemy unit **created or revived** next to a Stealthed Rogue reveals it (R1) but doesn't trigger Assault: nothing "came into" range by moving.
- **ROG-5** If the Rogue's own step makes it adjacent to several enemies, it makes one Assault and its controller picks the target. On the opponent's turn only one unit moves at a time, so there is exactly one entering unit.
- **ROG-6** Two Stealthed enemy Rogues becoming adjacent: both Assaults trigger; the stationary (non-active player's) Rogue's resolves first, then the mover's if it is still alive; then both are revealed.
- **ROG-7** If the entering unit dies to the Assault, its move ends. If it was the enemy commander, the game is won.
- **ROG-8** Assault uses the full pipeline: Defend halves it; the Paladin subtracts 3; Line Formation and Forcefield apply. (AB's Ratasius case can't occur: a Stealthed Rogue is always revealed at distance 3 first, see 4.4.)
- **ROG-9** On its own turn the Assault costs nothing extra; the Move already used the action. With an extra action (Command Aura) the Rogue may still Attack afterwards.
- **ROG-10** At most one Assault per Stealth, since the reveal always follows.
- **ROG-11** Damage taken where no enemy unit sees it doesn't reveal the Rogue: for example an enemy mine on an unwatched square, or a Pajazon tick on the area's outer ring at distance 4-5 from a Wizard with LOV 3 and no other watcher.
- **ROG-12** A Stealthed Rogue stepping on a hidden enemy mine takes 5; it is revealed only if that square is inside enemy LOV (R2).
- **ROG-13** An invisible Rogue still occupies its square, but no unit can ever try to enter it: any enemy reaching a neighbouring square reveals it first.
- **ROG-14** Mind's Eye or Ratasius detection breaks Stealth; inside detection it can't be reactivated (the Rogue is in enemy LOV).
- **ROG-15** An invisible Rogue still captures and contests buildings (6.4).
- **ROG-16** Bigger enemy LOV (Kulega, Ratasius' 6) leaves fewer squares where Stealth can be activated. Intended.
- **ROG-17** Assault also triggers on enemy dummies moving under Mad inventor, and on any enemy whose path passes next to the Rogue. It fires at the first adjacent step and ends that move.
- **ROG-18** The owner sees their Stealthed Rogue semi-transparent; the opponent sees nothing. A reveal is shown as an event (4.8).
- **ROG-19** Under Trill it is 7/6. Under the Keep, Assault deals 10.

### 8.7 Priestess (type 10)

> "Priestess, 3/15, 1, 2, 2, 2" (L85)
> "Strong aura:P: units adjacent to priestess, gain additional 1 power and 1 toughness" (L86)
> "Shared wounds: Sacrifice half of adjacent unit's (or itself) hp. Heal other unit (including itself) hp by that number, but no more than units base hp." (L87)

**Strong aura** [A8-08 - Med]: passive aura. Own units adjacent to the Priestess (not herself) get +1 Power and +1 toughness (3.7). It is re-evaluated continuously. It doesn't stack: two Priestesses still give +1/+1.

**Shared wounds** [A8-09 - Med]: active. No cost is listed, so it costs the Priestess's AP, **2**. It uses her action. Both targets are chosen together:
- **Donor D:** the Priestess herself or an own unit adjacent to her, with current toughness of at least 2.
- **Recipient R:** a different own unit that is the Priestess or adjacent to her.
- **Effect:** A = floor(D's current toughness / 2). D loses A (not damage: no reductions, no reveal). R heals min(A, R's max - R's current). The rest is wasted.
- No cooldown; instant.

- **PRI-1** The aura buffs dummies (1/8) and the commander (2/2).
- **PRI-2** Two adjacent Priestesses buff each other (4/16 each).
- **PRI-3** A Beast is buffed if any of its squares is adjacent.
- **PRI-4** Leaving the aura never kills (3.7).
- **PRI-5** Rounding down means the donor keeps ceil(current / 2) >= 1, so it can never die; a donor at 1 would give 0 and isn't legal.
- **PRI-6** Overflow is wasted, as written ("Sacrifice half"); the UI previews the waste.
- **PRI-7** "No more than units base hp" is read as the recipient's max toughness, auras and Trill included.
- **PRI-8** Enemy donors are not allowed (it would be a 2-AP "halve any adjacent enemy").
- **PRI-9** Recipient range: the Priestess or a unit adjacent to her (Q75).
- **PRI-10** The commander may be the donor or the recipient.
- **PRI-11** An own Stealthed Rogue can be either; it isn't revealed.
- **PRI-12** Donor and recipient must differ. With extra actions it can be used twice in a turn.

### 8.8 Juliomancer (type 10)

> "Juliomancer, 3/15, 1, 3, 1, 2" (L89)
> "Mind's Eye:P: This unit reveals invisible units in its LOV" (L90)
> "Julio Vernification:2: Sacrifice an adjacent unit. Deal damage equal to its current toughness to a unit in range 2." (L91)

**Mind's Eye** [A8-10 - High; mines Low]: passive detection. Every enemy Stealthed unit and enemy mine inside the Juliomancer's LOV (3; 4 under Kulega) is revealed (4.6). Continuous, on both players' turns.

**Julio Vernification** [A8-11 - Med]: active, **2 AP**, uses the action. Both targets are chosen together:
- **S (sacrifice):** an own, non-commander unit adjacent to the Juliomancer, not itself.
- **T (target):** a **visible enemy unit** within range 2 of the Juliomancer (changed from AB, which allowed own units after confirmation; C16).
- **Effect:** X = S's current toughness, auras included. S is sacrificed (3.9). T takes X ability damage through the full pipeline; the Juliomancer is the dealer for Ratasius' weakness.

- **JUL-1** Two Juliomancers' Mind's Eye don't "stack"; they reveal. A revealed mine stays revealed after they move away.
- **JUL-2** It can't sacrifice itself, an enemy, or a commander.
- **JUL-3** T is a unit, not a square, so it can't set off mines. Any enemy Rogue within reach is already revealed by Mind's Eye (range 2 is inside LOV 3).
- **JUL-4** S's death triggers (Kulega, Queso's revive prompt) resolve after T's damage (2.11).
- **JUL-5** Fodder: a dummy deals 7 (8 with Strong aura); a Soldier at full toughness 7; a Paladin 20; **a Beast 40**. Uncapped as written; a cap is suggestion S12.
- **JUL-6** Defend, Reinforced Armor, Line Formation and Forcefield reduce it normally. If the Juliomancer is adjacent to Ratasius, the damage is X - 4.
- **JUL-7** A sacrifice is a death, so Kulega and Queso triggers apply.
- **JUL-8** Sacrificing a Beast is legal if any of its squares is adjacent.
- **JUL-9** "A unit in range 2" is measured from the Juliomancer, the unit using the ability, like every other range in the spec. Measured from the sacrificed unit, it would reach distance 3 from the Juliomancer (`JULIO_RANGE_ORIGIN`, Q88).

### 8.9 Paladin (type 20)

> "Paladin: 12/20, 1, 2, 3, 2" (L94)
> "Reinforced Armor:P: Reduce all damage dealt to this unit by 3 (can't be less than 1)" (L95)

**Reinforced Armor** [A8-12 - High]: passive. -3 on every damage instance the Paladin receives, at pipeline step 4, floor 1. "All damage": attacks, Smite, Slam, Julio Vernification, Pajazon ticks and mines. Not sacrifice or other non-damage loss.

- **PAL-1** Order with Defend: subtract, then halve. A defending Paladin hit by the Beast (20): 20 - 3 = 17, ceil(17/2) = **9**. (Changed from AB's 7, C3.) A Footman's 1 still lands as 1.
- **PAL-2** It stacks with Forcefield (-11 in total, floor 1) and with Strong aura (+1 toughness).
- **PAL-3** A Pajazon tick (3) deals 1 to it; a mine (5) deals 2.
- **PAL-4** Under Kulega it is type 20, so it gains Fine Print. Under Sabrina it costs 24.
- **PAL-5** Movement 3 makes it the fastest unit, which matters for objective races, Assault and mine encounters.

### 8.10 Artificer (type 20)

> "Artificer, 1/15, 1, 3, 2, 1" (L97)
> "Mind's Eye:P: This unit reveals invisible units in its LOV." (L98)
> "Prototype No-ACB:2: Create a dummy unit in a free adjacent square. It's a 0/7 unit, it cannot move and has a LOV of 1 and AP 1. A maximum of 3 dummies can be active at the same time. (All artificers; Every two artificers beyond the first one increase this limit by 1)" (L99)
> "Mad inventor: Prototypes NO-ACB can move when adjacent to any allied artificer and gain 1 power. (This effect disappears when the artificer steps out of range)." (L100)
> "Trip Mine B20:2: Deploy an invisible mine in a free adjacent square. It explodes when any unit steps on it. Deals 5 damage + 5 if the unit has a size of 2 or greater. A maximum of 5 mines can be active at the same time (All artificers; Each artificer beyond the first one increases this limit by 1), Mines can be triggered from distance by attacking the square with a ranged attack." (L101)

**Mind's Eye**: as for the Juliomancer (8.8), using the Artificer's LOV 3.

**Prototype No-ACB** [A8-13 - Med]: active, **2 AP**, uses the action.
- **Target:** one **free** square adjacent to the Artificer. Free = exists; not a blocker or building; no unit on it, visible or invisible; no own mine on it.
- **Effect:** creates a No-ACB dummy (8.15) controlled by the Artificer's player.
- **Shared cap:** `DUMMY_CAP(n) = 3 + floor((n - 1) / 2)`, where n = the player's Artificers currently alive (n >= 1, since creating needs one).

**Mad inventor** [A8-15 - Low]: passive aura. Each own dummy adjacent to at least one own Artificer may take the Move action with **Movement 1** and has **+1 Power**. "Range" in "steps out of range" means adjacency. Two adjacent Artificers still give +1.

**Trip Mine B20** [A8-16 - Med]: active, **2 AP**, uses the action.
- **Target:** one free adjacent square (as above). A square holds at most one mine.
- **Effect:** creates a Trip Mine (8.16).
- **Shared cap:** `MINE_CAP(n) = 5 + (n - 1)`.

| Artificers alive (n) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Max dummies, 3 + floor((n-1)/2) | 3 | 3 | 4 | 4 | 5 | 5 | 6 | 6 | 7 | 7 |
| Max mines, 5 + (n-1) | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |

With a budget of 200, at most 10 Artificers fit (20 each); under Sabrina 20 fit (10 each), allowing 12 dummies and no mines.

- **ART-1** The two caps grow differently (+1 per two extra Artificers vs +1 per extra Artificer). Implemented exactly as written; Q76 asks whether it's intended.
- **ART-2** n counts Artificers alive now. If n drops below what the existing dummies or mines need, nothing is destroyed; new ones can't be created until the count is under the cap again.
- **ART-3** "(All artificers;" means one cap shared by the whole army. A destroyed dummy or an exploded mine frees its slot at once.
- **ART-4** Dummies and mines outlive the Artificer that made them and keep counting toward the cap.
- **ART-5** A new dummy may act on the turn it is created (no summoning sickness). It is adjacent to its creator, so Mad inventor already applies.
- **ART-6** Mad inventor is checked when the dummy declares its Move; the dummy may end that move away from every Artificer, after which it can't move again. The +1 Power is checked at attack time.
- **ART-7** Only own Artificers enable Mad inventor.
- **ART-8** The Artificer's own Mind's Eye (LOV 3) covers all four adjacent squares, so it always sees enemy mines on its target squares and never places onto one. If `MINDS_EYE_REVEALS_MINES` is off: a dummy created on an unseen enemy mine sets it off (the dummy "enters" the square), and a mine placed onto one is not placed, the enemy mine is revealed, and the AP and action are spent (4.7).
- **ART-9** With Command Aura, an Artificer can create twice in one turn (a dummy and a mine, or two of either).
- **ART-10** Under Sabrina: no Trip Mine, type 10 (cost 10), +2 Power. Under Kulega: type 20, Fine Print.

### 8.11 Royal wizard (type 50)

> "Royal wizard, 10/20, 1, 3, 1, 3" (L105)
> "Forcefield:2: Choose 4 adjacent squares in wizards LOV. Damage received to friendly units inside the forcefield reduced by 8. CD 1 turn" (L106)
> "Pajazon:3: Create an area of 3x3, with center at range 3, for 2 turns. At the end of your turn, allied units in the area regenerate 3 toughness; At the end of the opponent's turn, enemy units take 3 damage. CD 1 turn" (L107)

**Forcefield** [A8-18 - Med]: active, **2 AP**, uses the action, **CD 1** (usable every other own turn).
- **Target:** 4 squares forming **one orthogonally connected group** (any tetromino: I, O, T, L, J, S, Z), each inside the Wizard's LOV (3; 4 under Kulega). The Wizard's own square may be one of them. Squares may be occupied or blockers, but must exist. (BA's 2x2-only reading is the alternative, Q64.)
- **Effect:** while it lasts, every damage instance received by an **own** unit standing on one of the 4 squares is reduced by 8 (pipeline step 4, floor 1). Enemy units standing there get nothing.
- **Duration:** until the start of the Wizard controller's next turn (no duration is stated, A2-24). So it protects through the opponent's turn and against end-of-turn ticks.

```
O: F F    I: F F F F    T: F F F    L: F .    S: . F F
   F F                     . F .       F .       F F .
                                       F F
```

**Pajazon** [A8-19 - Med]: active, **3 AP**, uses the action, **CD 1**.
- **Target:** a centre square within range 3 of the Wizard, its own square included. The area is the 3x3 block around the centre (Chebyshev <= 1); squares off the board are ignored.
- **Duration:** two of the caster's own turns (A2-23). Cast on own turn T, it is removed at the start of own turn T + 2.
- **Ticks:** at the end of each own turn while it lasts, each own unit in the area heals 3 (capped). At the end of each opponent turn while it lasts, each enemy unit in the area takes 3 ability damage. Positions are read at tick time. Altogether: 2 heal ticks (the first at the end of the casting turn) and 2 damage ticks.

```
y=4  . a a a .
y=3  . a C a .      W = Wizard, C = centre (here at distance 3), a = area
y=2  . a a a .
y=1  . . . . .
y=0  . . W . .
```

- **WIZ-1** "4 adjacent squares" is read as 4 connected squares. Rejected: "the 4 squares adjacent to the Wizard" (there would be nothing to choose, and "in wizards LOV" would be redundant).
- **WIZ-2** With this duration a Wizard can alternate: Pajazon stays up all the time (WIZ-6) and Forcefield covers every other opponent turn.
- **WIZ-3** Forcefield squares are fixed; they don't move with the Wizard or the units.
- **WIZ-4** Forcefields don't stack (a unit inside two gets -8). The floor of 1 means a Forcefield never makes a unit immune.
- **WIZ-5** A Beast is protected if any of its squares is inside. It protects against all damage, mines and Pajazon ticks included.
- **WIZ-6** With CD 1 the Wizard can recast Pajazon exactly when the old area expires, so one Pajazon per Wizard can be up all the time.
- **WIZ-7** Two Wizards' overlapping Pajazons don't stack: at most 3 per tick per unit.
- **WIZ-8** Pajazon hits invisible enemies. A Stealthed Rogue hit by a tick is revealed only if its square is in enemy LOV (R2); the area's outer squares can lie at distance 4 or 5 (centre at 3, corner squares 2 further), outside the Wizard's LOV 3.
- **WIZ-9** At the end of the opponent's turn, Pajazon damage comes before their own heals (2.10).
- **WIZ-10** Ratasius' weakness never affects Pajazon ticks (delayed damage).
- **WIZ-11** Both effects persist if the Wizard dies. Both are visible to the opponent on the squares inside their vision.
- **WIZ-12** An enemy 1/1 commander that ends its turn inside a Pajazon dies; an own commander inside is healed.
- **WIZ-13** Casting both in one turn needs 2 actions (Command Aura): 2 + 3 = 5 AP. The two cooldowns are separate.

### 8.12 Beast of Knorund (type 50, Size 2)

> "Beast of Knorund, 20/40, 2, 2, 2, 3" (L109)
> "Forceful slam:4: Deal 10 damage to an adjacent square, and 3 damage to the 5 opposite adjacent squares of the target. CD 1 turn" (L110)
> "Feast:2: Sacrifice an adjacent unit: Gain life equal to its toughness" (L111)

The Beast occupies a 2x2 footprint (1.6).

**Forceful slam** [A8-20 - Med]: active, **4 AP**, uses the action, **CD 1**.
- **Target:** one existing square T adjacent to the footprint (8 choices). T may be empty or hold any unit; the UI asks for confirmation if an own unit would be hit.
- **Splash geometry (exact):** let `d` be the unit vector from the footprint square touching T to T (always orthogonal). The splash is `S = { T + v : v in the 8 neighbour offsets, dot(v, d) >= 0 }`: always **5 squares**, the 3 beyond T and the 2 beside it (verified for all 8 choices of T). The Beast's own squares are never in S.
- **Effect:** 10 ability damage to the unit on T; 3 ability damage to each unit on the S squares. **Friendly fire applies to both.** A unit covering T and some S squares takes only the 10; a unit covering several S squares takes 3 once. Resolution is simultaneous (3.4).

```
Case 1: T north of the left column     Case 2: T north of the right column
x:  -1  0  1  2                        x:  -1  0  1  2
y3   s  s  s  .                        y3   .  s  s  s
y2   s  T  s  .                        y2   .  s  T  s
y1   .  B  B  .                        y1   .  B  B  .
y0   .  B  B  .                        y0   .  B  B  .
```

**Feast** [A8-21 - Med]: active, **2 AP**, uses the action. The target is an own, non-commander unit adjacent to the footprint. It is sacrificed (3.9), and the Beast heals by its current toughness just before the sacrifice, capped at max (no overheal; all analysts agree).

- **BEA-1** "The 5 opposite adjacent squares of the target" = the target's neighbours on the side away from the Beast; the only symmetric 5-square reading that works for every T.
- **BEA-2** In case 1, S includes (1, 2), a square also adjacent to the Beast. Intended.
- **BEA-3** Friendly fire is on, as written ("to an adjacent square"). "Enemies only" is the alternative (Q66).
- **BEA-4** Slam doesn't set off mines on T or S (it isn't a ranged attack). Blocker squares absorb nothing. S squares off the board are ignored.
- **BEA-5** Slam hits invisible units. A Rogue on T is adjacent to the Beast, so already revealed. A Rogue on an S square (distance 2) is revealed by the damage, since it is inside the Beast's LOV 2.
- **BEA-6** If the Beast is adjacent to Ratasius, both numbers drop by 4: 6 on T and 0 on the splash (no damage there at all).
- **BEA-7** Slam is ability damage: the Keep doesn't raise it; Defend, Armor, Line Formation and Forcefield reduce it.
- **BEA-8** Feast targets own units only; eating an adjacent enemy would be a 2-AP instant kill of anything.
- **BEA-9** Feasting at full toughness wastes the unit; the UI asks for confirmation.
- **BEA-10** Feast triggers Kulega and Queso like any death. Feasting on a dummy heals 7.
- **BEA-11** Mines deal it 10 each, and one step can enter two mines.
- **BEA-12** "Gain life equal to its toughness" uses the eaten unit's **current** toughness, which Julio Vernification states outright (L91). Kulega's "that creature toughness" is read as base toughness only because a dead unit's current toughness is 0 or less. The alternative for Feast, base or max toughness so that a damaged unit still gives full value, is `FEAST_TOUGHNESS` (Q87).

### 8.13 Celestial Emissary (type 100)

> "Celestial Emissary, 15/50, 1, 4, 2, 4" (L114)
> "Holy blessing:3: Heal ally units in a range of 2 by 5" (L115)
> "Smite:3: Deal 8 damage to a unit, at a range of 3." (L116)
> "Holy Fervor: This unit can take 2 actions per turn. The second action costs 1 extra AP" (L117)

**Holy blessing** [A8-22 - Med; self-heal Low]: active, **3 AP**, uses the action, no target choice. Every own unit within range 2 of the Emissary, **the Emissary included**, heals 5, capped. No cooldown.

**Smite** [A8-23 - Med]: active, **3 AP**, uses the action. Target: one **visible enemy unit** within range 3 (up to 3). Effect: 8 ability damage through the full pipeline. No cooldown. It targets a unit, so it is not a "ranged attack" for mines.

**Holy Fervor** [A8-24 - Med]: passive. The Emissary has an allowance of 2 actions per turn. **Every action after its first that turn costs its normal cost + 1 AP**, whatever it is. Still only one Move.

- **CEL-1** Holy blessing heals the Emissary: the Scourge's text has to say "Doesn't include this unit", which implies "units in range" includes the source by default.
- **CEL-2** It heals own Stealthed units without revealing them.
- **CEL-3** Smite can't set off mines.
- **CEL-4** Holy Fervor never allows two Moves.
- **CEL-5** The same ability twice is legal (no cooldowns): Smite + Smite = 3 + 4 = **7 AP for 16 damage**; Holy blessing twice = 7 AP for +10 to everyone in range.
- **CEL-6** Order doesn't change the total: Move (4) then Smite (3 + 1) = 8 AP; Smite (3) then Move (4 + 1) = 8 AP.
- **CEL-7** With Command Aura the Emissary has 3 actions, and the second and the third each cost +1 (a literal "only the second" would make the third cheaper; rejected).
- **CEL-8** Next to Ratasius, Smite deals 4.

### 8.14 Scourge of the Gods (type 100)

> "Scourge of the Gods, 15/33, 1, 3, 2, 3" (L119)
> "Command Aura:P: Units within range 2 of this unit can take an additional action each turn. Doesn't include this unit." (L120)

**Command Aura** [A8-25 - Med]: passive aura. Own units within range 2 of the Scourge, not the Scourge itself, get +1 action allowance. It grants **no AP**: the extra action is paid normally.

- **SCO-1** It is checked when a unit declares an action beyond its normal allowance: the unit must be within range 2 at that moment. A unit that moves into range with its first action may take a second; one that moves out of range may not.
- **SCO-2** Two Scourges still give +1. It adds to the Market and to Holy Fervor (different sources): a Footman in both the Market and Command Aura has 3 actions, still one Move.
- **SCO-3** An ability on cooldown can't be used twice in one turn; Savagery stays once per turn.
- **SCO-4** It includes dummies and the commander: a commander with 2 actions can Move then Attack, or Attack then Defend (Defend last, 2.7).
- **SCO-5** If the Scourge dies mid-turn, actions already taken stand; units lose their unused extra action at once.
- **SCO-6** Enemy units within range 2 never benefit.
- **SCO-7** A Beast is in range if any of its squares is.
- **SCO-8** Balance note: Berserker + Scourge = 3 attacks for 4 AP; Wizard + Scourge = Forcefield and Pajazon in one turn.

### 8.15 Prototype No-ACB (created dummy unit)  [A8-14 - Med]

Stats: **0/7, Size 1, LOV 1, Movement 0** (1 while Mad inventor applies), **AP 1**, attack range 1. No type, no cost, no abilities.

- **DUM-1** It is a full unit: it blocks movement, provides vision (LOV 1), can Defend for 1 AP, and can be healed, buffed, targeted, attacked and sacrificed.
- **DUM-2** It can't Attack while its Power is 0. It can once its Power is above 0: Strong aura +1, Mad inventor +1, Sabrina +2, Keep +3.
- **DUM-3** For enemy Rogues it is an enemy unit: its LOV 1 blocks Stealth activation on its adjacent squares, it reveals a Rogue by adjacency, and when it moves next to a Stealthed Rogue (under Mad inventor) it triggers Assault, which makes it a cheap Rogue detector.
- **DUM-4** It sets off mines when it moves onto one.
- **DUM-5** No type: no Trill bonus, no Kulega trigger when it dies, no Market action. It does get Kulega's +1 LOV and Command Aura's extra action, which apply to "units".
- **DUM-6** Queso may revive it; it is the same instance, so its cap slot doesn't change.
- **DUM-7** It captures and contests buildings [A6-08 - Low].
- **DUM-8** Fodder: Julio Vernification deals 7 with it; Feast heals 7.
- **DUM-9** "It cannot move" only restricts the Move action; nothing in v1 displaces units.
- **DUM-10** It may act on the turn it is created (ART-5).

### 8.16 Trip Mine B20 (created hidden object)  [A8-16, A8-17]

- **What:** a board object owned by a player, not a unit. It can't be attacked as a unit, healed, buffed or sacrificed, and it never counts for adjacency effects or capture.
- **Visibility:** invisible to the opponent until revealed (4.5); always visible to its owner.
- **Trigger:** **any unit**, own or enemy, entering its square: the commander and dummies included, a unit passing *through* the square mid-path, and a unit created on it. The owner's pathing note (L102) confirms that own units set off own mines.
- **Effect:** it explodes once. The unit entering takes **5 ability damage, or 10 if its size is 2 or more**. Then the mine is removed.
- **Remote detonation:** an attack with range >= 2 (the Ranger's) aimed at the mine's square sets it off (2.6). A live mine's square is never occupied, so a remote detonation simply destroys it: no damage, no splash.

- **TMN-1** The move is interrupted: a surviving unit stops on the mine's square (2.5).
- **TMN-2** A Beast sets off a mine when any of its squares enters the mine's square; one step onto two mines sets off both (10 + 10, separate instances).
- **TMN-3** Mines are not set off by area effects (Slam, Pajazon), melee attacks, Smite (unit-targeted) or units merely adjacent.
- **TMN-4** Mines don't block movement or placement for the opponent. A square with an own mine is not "free" for its owner's placements.
- **TMN-5** Mine damage is dealt by no unit, so Ratasius' weakness and the Keep never change it. Target-side reductions apply: Paladin 2; Forcefield 1; Defend 3; Line Formation 3.
- **TMN-6** Own mines are deadly to an own 1/1 commander. The confirmation dialog applies to it too; making it mandatory for the commander is suggestion S25.
- **TMN-7** Flying units don't exist. If added later, give them an `ignoresMines` keyword.
- **TMN-8** A revealed mine shows a marker to the opponent, who can route around it or shoot it. A mine going off in the fog shows its explosion to whoever sees the square; its owner is always told.
- **TMN-9** Mines are only created during play, by an Artificer standing next to the square, never at deployment.
- **Mine-aware pathing** [A8-17 - High for own mines, Med for revealed enemy mines] (L102, which the owner asked not to put in the unit text): path suggestions never route own units through a mine the player knows about, whether their own or a revealed enemy one. L102 says "mines" and "a mined square", not "your mines". Moving onto or through one asks the player first. The player can turn the warning off in Options; path suggestions still prefer mine-free routes. Unrevealed enemy mines are unknown to the player, so nothing can warn about them (4.7).

### 8.17 Interaction rulings (one test per row)

| # | Interaction | Ruling under these defaults |
|---|---|---|
| X-01 | Stealthed Rogue vs a Mind's Eye unit | It can never Assault it: any approach passes distance 3, where it is revealed. Holds because nothing blocks sight (A1-12). |
| X-02 | Stealthed Rogue vs Ratasius | Never Assaultable (detection at range 3). A revealed Rogue's normal attack deals 7 - 4 = 3, which kills a 1/1 Ratasius. |
| X-03 | Kulega or Ratasius LOV vs Stealth | Fewer squares where Stealth can be activated. |
| X-04 | Mine or Assault vs a commander stepping onto its goal row | The step's triggers resolve first; it wins only if it is still alive there. |
| X-05 | Juliomancer + Artificer dummy | 2 AP (create) + 2 AP (sacrifice) = 7 damage at range 2, or 8 with Strong aura. |
| X-06 | Julio Vernification with a Beast or Paladin as fodder | 40 or 20 damage; legal; a cap is suggested (S12). |
| X-07 | Queso + Julio or Feast fodder | The fodder can be revived at ceil(base / 2); at most 2 revives per game. |
| X-08 | Kulega + Feast on a Soldier next to a Paladin | The Beast heals 7 (capped at max); the Paladin heals 4. |
| X-09 | Defending Paladin inside a Forcefield, hit for 20 | 20 - 11 = 9, halved and rounded up = **5** (changed from AB's 1, C3). |
| X-10 | Enemy Pajazon vs my Soldier at the end of my turn | Damage first, then Perseverance: at 3 it dies; at 4 it ends at 2. |
| X-11 | Two Wizards: overlapping Pajazons or Forcefields | No stacking: 3 per tick, -8 per hit. |
| X-12 | Scourge + Celestial Emissary | 3 actions; the second and third each cost +1 AP; still one Move. |
| X-13 | Scourge + Berserker | Attack (1) + Savagery (2) + Attack (1): 3 attacks for 4 AP. |
| X-14 | Scourge + Market + Footman or Mercenary | 3 actions, one Move: Move, Attack, Attack. |
| X-15 | Keep +3 Power | Attacks only: Berserker 15, Assault 10, Mercenary 5 + bonus. Not Smite, Slam, Pajazon, mines or Julio Vernification. |
| X-16 | Sabrina + many Artificers | 10 coins each; up to 12 dummies at 2 Power (3 with Mad inventor); no mines. |
| X-17 | Own mine vs own commander | A 1/1 commander dies; the confirmation dialog appears unless the player turned it off (S25). |
| X-18 | Forceful slam next to own units | Friendly fire; the UI previews every unit that would be hit. |
| X-19 | Slam splash catching both commanders | Both die in the same resolution: draw. |
| X-20 | Strong aura on the commander | 2/2; leaving the aura can't kill it (current stays at least 1). |
| X-21 | Trill Footmen in formation | A 1/4 Footman takes 1 per Pajazon tick and 3 per mine. |
| X-22 | Ratasius' weakness vs Pajazon or mines | Not weakened (delayed, or not dealt by a unit). |
| X-23 | Ranger blind shot at a suspected Rogue square | Hits it if it's there; reveals it (the square is inside the Ranger's LOV). |
| X-24 | Ranger shooting an own mine | Sets it off (mine clearing); no damage. |
| X-25 | Holy blessing, Queso and Pajazon heals at one end of turn | All capped; order irrelevant. |
| X-26 | Queso revive vs a death at the end of a turn (Pajazon) | The prompt appears at that moment; the game waits for it or its timeout. |
| X-27 | Command Aura and moving out of range | The second action is legal only if the unit is still within range 2 when declaring it. |
| X-28 | Mad inventor dummy walking next to a Stealthed Rogue | Triggers Assault (the dummy is a unit): a cheap Rogue probe. |
| X-29 | 2x2 block of Footmen | All four have Line Formation (each has 2 orthogonal Footman neighbours). |
| X-30 | Defend, then another action by the same unit | Defend is lost. |
| X-31 | Stealth while an unseen enemy Emissary (LOV 4) watches the square | The attempt fails; 1 AP and the action are spent; "Spotted". |
| X-32 | Slam by a Beast adjacent to Ratasius | 6 on the target square; 0 on the splash (no damage, no reveal). |
| X-33 | A Rogue's own step makes it adjacent to two enemies | One Assault; its controller picks the target; its move ends. |
| X-34 | A Beast's step enters two mines | Two separate 10-damage instances (each halved if it is Defending). |

---

## 9. Take-back

> "There will be a take back option for each player. The opponent player has to accept the take back." (L39)

The design follows PX BT-29 and NC 7.13, with RL's disclosure rule (C18).

- **TB-1 Availability.** Lobby setting `TAKEBACKS`: on (the default) or off [A9-04].
- **TB-2 What one request undoes** [A9-01 - Med]: one **action** (one intent: a Move with its whole path, an Attack, a Defend, an ability use, a Savagery attack, a Baba Yaga regeneration, or End Turn), together with **everything it caused**: mines set off, Assaults, deaths, death triggers, revive prompts already answered, captures and reveals.
- **TB-3 Scope.** A player may ask to undo **their own most recent action of their current turn**. After an accepted undo, they may ask for the one before, step by step, back to the start of their turn. After ending their turn, they may ask to undo the End Turn (and then go on step by step) **until the opponent takes their first action**. Nothing that precedes an opponent's action can be undone. Deployment needs no take-back (it is freely editable until both confirm). There is no take-back once the game has ended [A9-05 - Low].
- **TB-4 Flow.** The requester asks ("Request to take back: Paladin 2 moved E5 -> E8?"). The opponent gets Accept / Decline, which **auto-declines after 30 s** (`TAKEBACK_TIMEOUT_S`). While a request is pending the requester can't act, and the turn timer pauses. A request can't be made while a reaction prompt is pending.
- **TB-5 Disclosure** [A9-03 - Med]: the decider's dialog shows the action and lists what it revealed to the requester about the decider's side ("It revealed your Soldier 3 at E9", "It set off your mine at H9", "Your Rogue's Assault fired", "You answered a revive prompt"). This concerns the decider's own units, so showing it leaks nothing new. Actions that revealed hidden information **may** be undone, but only with this informed consent. (AB G-44 would block them outright; under fog nearly every move reveals squares, so that would remove most take-backs.)
- **TB-6 Restore** [A9-02 - High]: an accepted take-back restores the **exact** earlier state: positions, toughness, AP, action counters, cooldowns, statuses, created and destroyed units and mines, building control and vision. The engine is deterministic, so the authority keeps a snapshot at each turn start and replays the log up to the undone action (NC 7.13). Both clients then resync.
- **TB-7 Limits** [A9-04 - Low]: one pending request at a time; a declined action can't be requested again; no per-game limit by default (lobby option `TAKEBACKS_PER_GAME`: unlimited, 3, 1 or 0).
- **TB-8 What can't be undone:** what the requester saw. The UI removes any last-seen markers created by the undone action. Achievement and stat progress from it is rolled back too (PX 9.2).
- **TB-9 Only your own actions.** A player can never ask to undo the opponent's actions. The opponent's reactions that happened inside your action (their Assault, their revive answer) are undone with it.

---

## 10. Assumptions table

Every default this document chose, with its confidence and the spec text it interprets. "(spec silent)" means no line addresses it; the nearest line is quoted.

### 10.1 Geometry and board

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A1-01 | Columns A-Y (x 0-24) west to east, rows 1-25 (y 0-24) south to north. South = first player: back row 1, goal row 25. North: back row 25, goal row 1. | High | "Each player gets a portion of the map, at the edges and usually opposing each other" (L29) |
| A1-02 | Board shape rule A: a square is removed when u < 4, v < 4 and (4-u)^2 + (4-v)^2 > 16; 8 per corner, 593 squares. | Low | "The size of the battlefields are 25x25, where the corners are cut off with a radius of 4." (L30) |
| A1-03 | LOV and vision use Manhattan distance (a diamond of 2N(N+1) squares). | High | "A LOV of 1 will only show the 4 orthogonal adjacent squares. A LOV of 2, will show 12 squares around the unit" (L37) |
| A1-04 | "Range N" = Manhattan distance <= N between nearest squares; no minimum; ignores terrain and units. | Med | "This unit's attack has a range of 2." (L74); "with center at range 3" (L107) |
| A1-05 | "Adjacent", "melee range", "1 square away" and "range 1" = Manhattan distance 1 (4 squares around a 1x1, 8 around a 2x2). | Med | "in range of 1(including corners)" (L45); "the 4 orthogonal adjacent squares" (L37) |
| A1-06 | "(Including corners)" = Chebyshev distance 1 (8 around a 1x1, 12 around a 2x2). | High | "in range of 1(including corners) of that building" (L45) |
| A1-07 | Shapes the text draws ("3x3", Slam's 5 squares) are templates on the 8-neighbourhood. | Med | "Create an area of 3x3" (L107); "the 5 opposite adjacent squares of the target" (L110) |
| A1-08 | Movement is orthogonal only; L34 supersedes L15's "including diagonals". | High | "(1 square by default, including diagonals)" (L15) vs "The movement is orthogonal, a movement-piece cannot be diagonal." (L34) |
| A1-09 | Size S = an S x S block with no facing or rotation. | Med | "Beast of Knorund, 20/40, 2, 2, 2, 3" (L109); "Each one will occupy a 2x2 square" (L45) |
| A1-10 | Size-2 handling: moves as a block; nearest-square distances; hit once per effect; any square counts; per-square mine triggers; fully inside its zone. | Med | "Deals 5 damage + 5 if the unit has a size of 2 or greater" (L101) |
| A1-11 | Blockers are whole squares: impassable, not deployable, not targetable, indestructible; laid out with 180-degree symmetry. | Med | "There may be a scenario with blockers." (L13) |
| A1-12 | Blockers and buildings block neither vision nor ranges (no occlusion). | Med | L13; "LOV ... is also determined using this logic" (L37) |
| A1-13 | Buildings are 2x2 terrain: impassable, not deployable, not targetable, indestructible. | Med | "Each one will occupy a 2x2 square" (L45); "represented by 3d objects" (L46) |
| A1-14 | Default scenario "Crossroads" (21 blockers, Keep G13:H14, Market R12:S13); test variant "Open Field" without blockers. | Low | "The encounter takes place in a battlefield called scenario." (L17) |
| A1-15 | Each client draws its own back row at the bottom (North's view rotated 180 degrees); square names are absolute. | High | "at the edges and usually opposing each other" (L29); PX G-08 |
| A1-16 | The camera switches between top view (the default) and isometric. It is presentation only: both views draw the same `view(state, seat)`, pick the same square under the cursor and keep the A1-15 orientation; the choice is a per-player preference (13.6). | High | "The view can switch from top to isometric. Top by default." (L48) |

### 10.2 Turn structure and actions

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A2-01 | AP per turn = round(0.06 x budget) = 12 at budget 200, the same every turn. | Med | "In each player's turn, that player will receive a number of Action points." (L9) |
| A2-02 | The first player's first turn has 6 AP. | Low | (spec silent) L9 |
| A2-03 | The pool refills at the start of your turn; unspent AP is lost; it can't go negative or be borrowed. | Med | "The player can use those action costs to use a number of units that fit its budget." (L9) |
| A2-04 | The first player is chosen by a coin flip announced at the start of deployment and plays South. | Med | (spec silent) "It's a turn-based game." (L9) |
| A2-05 | A turn is one player's turn; a round is both; "your turn" is the controller's turn. | Med | "at the end of the turn (Your turn)" (L71); "each player turn (not the opponent's turn)" (L130) |
| A2-06 | The actions are Move, Attack, Defend and active abilities; each uses one of the unit's actions. | High | "Besides special powers, all units (unless specified) share the actions of movement ..., attack ... and defend" (L15) |
| A2-07 | One action per unit per turn by default. | High | "A unit can only use one action per turn, unless stated otherwise." (L35) |
| A2-08 | At most one Move per unit per turn, even with extra actions. | Med | "Unless stated otherwise, a single unit can only move once per turn." (L11) |
| A2-09 | AP is paid per action; extra actions are paid again. | Med | "each unit has an action cost" (L7); "The second action costs 1 extra AP" (L117) |
| A2-10 | An active ability costs its listed AP instead of the unit's AP. | Med | "Ability:AbilityCost:Description" (L57) |
| A2-11 | "P" = passive: no action and no activation; an AP amount in its text is still paid. | Med | "Savagery:P: After attacking with the berserker, you can spend 2 AP" (L78) |
| A2-12 | Abilities with no cost field: Assault triggered and free; Mad inventor and Holy Fervor passive; Shared wounds active at the Priestess's AP (2). | Med | L82; L87; L100; L117 |
| A2-13 | Extra actions from different sources add; a same-named source counts once; the allowance is computed when an action is declared. | Med | "an additional action per turn" (L53); "can take an additional action each turn" (L120) |
| A2-14 | Units may act in any order, and one unit's actions need not be consecutive. | Med | "use a number of units that fit its budget" (L9) |
| A2-15 | A Move goes 1 to N steps; stopping early is allowed. The literal text could mean exactly N (Q84). | Med | "that unit moves as many squares as the movement stat" (L34) |
| A2-16 | A path may pass through own units but not enemy units, blockers, buildings or missing squares, and must end on empty squares. | Med | (spec silent) L34 |
| A2-17 | A Move is a committed path walked step by step with a fixed per-step order; mines, Assault, death or a newly seen enemy interrupt it; its AP is spent anyway. | Med | "It explodes when any unit steps on it" (L101); "When an enemy unit comes into the melee range" (L82) |
| A2-18 | Melee attacks target a visible enemy unit; attacks with range >= 2 may target any square in range without an own unit. | Med | "attacking units deals damage to the toughness of a target unit" (L15); "attacking the square with a ranged attack" (L101) |
| A2-19 | A unit with current Power 0 can't Attack. | Med | "attacking units deals damage" (L15) |
| A2-20 | The target never hits back. | Med | "attack (attacking units deals damage to the toughness of a target unit)" (L15) |
| A2-21 | Defend: an action at the unit's AP cost; lasts until the start of its controller's next turn; halves every damage instance; lost if the unit acts or attacks again that turn. | Med | "defend (a defending unit receives half the damage rounded up(never less than one))" (L15) |
| A2-22 | CD N: after use on own turn T, next usable on own turn T + N + 1, and not again in turn T unless its text allows. | Med | "CD 1 turn" (L106, L107, L110); "CD 1" (L128) |
| A2-23 | "For N turns" = N of the controller's own turns including the creation turn; it ends at the start of own turn T + N. | Low | "for 2 turns" (L107) |
| A2-24 | A non-passive effect with no stated duration lasts until the start of its controller's next turn. | Low | "Choose 4 adjacent squares in wizards LOV. Damage received ... reduced by 8. CD 1 turn" (L106) |
| A2-25 | Each ability on each unit instance has its own cooldown, kept through a revive. | High | L106-L107 |
| A2-26 | Created things outlive their creator; auras end the moment their source leaves the board. | Med | "(This effect disappears when the artificer steps out of range)" (L100) |
| A2-27 | Fixed end-of-turn order: damage ticks, commander check, heals, capture, expiries; then the start-of-turn resets. | Med | L71; L107; L130 |
| A2-28 | Simultaneous effects: damage before healing; the non-active player's triggers before the active player's; then creation order. | Med | (spec silent) L107 |
| A2-29 | Triggers resolve at once, inside the action in progress; deaths from a paid cost trigger after the action's effect. | Med | "(This can also occur in opponents turn)" (L82) |
| A2-30 | Choices on the opponent's turn (Queso): a live prompt, 15 s, then "no"; with an Ask/Always/Never preference. | Low | "you can choose to sacrifice 1 max toughness to revive that unit" (L130) |
| A2-31 | End Turn is available at any time; no turn limit; optional turn timer (off); resign; draw by agreement. | Low | (spec silent) |
| A2-32 | A unit's AP cost is the fixed AP field of its unit line; changes to its Power or toughness never change it. | High | "each unit has an action cost, which will scale depending on the relative power of that unit" (L7) |

### 10.3 Combat

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A3-01 | Attack damage = the attacker's current Power. | High | "attacking units deals damage to the toughness of a target unit" (L15) |
| A3-02 | Power bonuses (Keep, Strong aura, Mad inventor, Sabrina) change attack damage only, never fixed ability damage. | Med | "a bonus of 3 power" (L52); "Deal 8 damage to a unit" (L116) |
| A3-03 | Pipeline: base, source additions, source subtractions (floor 0), target flat reductions (floor 1), Defend ceil(x / 2). | Med | L15; "reduce the incoming damage by 2 (not below 1)" (L64); L95; L106; L129 |
| A3-04 | A hit brought to 0 by source-side modifiers deals no damage at all (no reveal, no trigger); weakness floors at 0. | Low | "deal 4 less damage" (L129); "(never less than one)" (L15) |
| A3-05 | Every target-side reduction, Forcefield included, leaves at least 1. | Med | "(not below 1)" (L64); "(can't be less than 1)" (L95); "reduced by 8" (L106) |
| A3-06 | Defend and target-side reductions apply to every kind of damage. | Med | "Reduce all damage dealt to this unit by 3" (L95) |
| A3-07 | Area and tick damage is simultaneous: compute, apply, then resolve deaths together. | Med | "and 3 damage to the 5 opposite adjacent squares of the target" (L110) |
| A3-08 | Toughness loss that isn't damage (Shared wounds donor, Queso's payment, aura loss) skips reductions and Defend and reveals nothing. | Med | "Sacrifice half of adjacent unit's (or itself) hp" (L87) |
| A3-09 | Toughness terms: printed, base (+ permanent), max (+ auras), current; hp = health = life = current. | Med | "hp" (L87); "Gain life" (L111); "regenerate 5 health" (L130) |
| A3-10 | Damage persists; every heal is capped at max toughness; no overheal. | High | "do not regenerate or recover toughness at the end of turn" (L19); "no more than units base hp" (L87) |
| A3-11 | Gaining +b toughness raises max and current; losing it lowers both, but current never below 1. | Med | "gain additional 1 power and 1 toughness" (L86) |
| A3-12 | A unit dies the moment its current toughness is <= 0, is removed, and its death triggers fire. | High | L19 |
| A3-13 | A sacrifice destroys one of your own non-commander units; it is not damage and counts as a death. | Med | "Sacrifice an adjacent unit" (L91, L111) |
| A3-14 | Unqualified "units": helpful effects mean your units; harmful area or square effects hit every unit there; basic attacks and harmful single-target effects target enemies only. | Med | "all units receive a bonus" (L52); "when any unit steps on it" (L101); "Deal 8 damage to a unit" (L116) |
| A3-15 | A same-named effect applies once per unit; differently named effects add; "for each" counts every source. | Med | "for each Mercenary" (L67); "units adjacent to priestess" (L86) |

### 10.4 Vision and hidden information

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A4-01 | A player's vision is the union of all own units' LOV, the commander and dummies included, recomputed after every step and event in both turns. | High | "Each player will only have vision around the vision field of each unit." (L17) |
| A4-02 | Public: scenario, building control, turn, commander identities. Hidden: enemy units and mines not visible, the opponent's AP left, their cooldowns and action counters, army lists. | Med | "Everything outside will be in the fog of war." (L17) |
| A4-03 | Visible = inside your vision and not invisible; being revealed removes invisibility but gives no vision. | High | "This unit becomes invisible." (L81) |
| A4-04 | A player always sees their own invisible units and mines. | High | "Ask the player if he wants a unit to go to a mined square." (L102) |
| A4-05 | Stealth is checked against the true state: disabled if a visible enemy sees the Rogue; otherwise it may fail, spending its AP and the action. | Med | "Only activate this ability if not inside the LOV of another enemy creature." (L81) |
| A4-06 | Reveal R1: an enemy unit at distance 1, from any cause. | Med | "It will be revealed when it's 1 square away from an enemy unit" (L81) |
| A4-07 | Reveal R2: receiving damage above 0 while inside the LOV of any enemy unit. | High | "or when receiving damage inside enemy LOV" (L81) |
| A4-08 | Reveal R3: inside the LOV of an enemy Mind's Eye unit, or within range 3 of an enemy Ratasius. | High | "This unit reveals invisible units in its LOV" (L90, L98); "Reveals all invisible enemies in range of 3" (L129) |
| A4-09 | A revealed unit stays revealed until it uses Stealth again. | Med | L81 |
| A4-10 | The owner is always told their unit lost Stealth; the cause only if they can see it. | Med | (spec silent) L81 |
| A4-11 | Mind's Eye and Ratasius also reveal mines; a revealed mine stays revealed until it explodes. | Low | "reveals invisible units in its LOV" (L90); "Deploy an invisible mine" (L101) |
| A4-12 | Attacking doesn't reveal the attacker to the target's owner. | Low | L17 |
| A4-13 | Enemy area effects are shown on the squares inside your vision. | Med | L17 |
| A4-14 | No action is refused because of something its player can't see: it resolves, and fails or stops visibly with its AP spent. | Med | L81; L17 |
| A4-15 | One authority holds the full state and sends each client only its view; in v1 the authority is the host's browser. | High | L17; "This should be done in a way that requires the least setup." (L135) |
| A4-16 | Last-seen markers are client-side memory and allowed. | Med | (spec silent) |

### 10.5 Army building and deployment

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A5-01 | A unit's cost = its type (denomination). | High | "Each unit represents a coin" (L5) |
| A5-02 | Budget 200 for both players; army cost <= budget (High). Leftover money is allowed and does nothing (Med: "must spend" could mean the whole budget, Q85). | High / Med | "must spend that money to acquire any combination of units that can fit the budget" (L3); "a budget of 200" (L27) |
| A5-03 | No copy limit and no unit cap; the army only has to be deployable. | Med | L3; "The normal deployment zone covers the first 5 rows closest to the player." (L31) |
| A5-04 | Vanguard (extended zone): Rogue and Ranger; never the commander. | Low | "Some units can be deployed in the extended deployment area" (L29) |
| A5-05 | Zones: South rows 1-5 plus 6-7; North rows 21-25 plus 19-20. | High | "The extended deployment zone covers 2 extra rows." (L31) |
| A5-06 | Deployment is simultaneous and hidden, editable until both confirm. | Med | "After that follows a deployment phase" (L29) |
| A5-07 | Every unit must be deployed; the commander in the normal zone; a 2x2 fully inside its zone; no mines or dummies at deployment. | Med | L29; L32 |
| A5-08 | Army lists are secret until units are seen; both are shown at game end. | Med | (spec silent) |
| A5-09 | Commander identities are revealed when deployment starts. | Low | "each player can choose a commander" (L3) |
| A5-10 | Armies are picked simultaneously and secretly in the lobby, then locked. | Med | "If a player wants to create a new one when a game starts, he can do so there aswell." (L26) |
| A5-11 | A saved army = faction + commander + units, priced with that commander. | High | "Each other type-20 and above is 20% more expensive to deploy." (L126) |
| A5-12 | An army with no units besides the commander is legal (the builder warns). | Med | "acquire any combination of units that can fit the budget" (L3) |
| A5-13 | Armies are created and edited from the main menu and in the lobby; one made in the lobby can be saved (on by default); changing the army after Ready un-readies the player. | Med | "Create or edit army compositions" (L23); "If a player wants to create a new one when a game starts, he can do so there aswell." (L26) |
| A5-14 | Players can't change the budget in v1 (a dev flag only); one lobby value for both players, stored per player; each player's AP comes from their own budget; a saved army over a lobby's budget can't be readied. | Low | "The player will have a budget of 200, which can be edited in the future, but for now the default is 200." (L27) |

### 10.6 Objectives

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A6-01 | A player whose commander dies loses at once. | High | "The objective of each player is to defeat the commander of each party." (L32) |
| A6-02 | Both commanders dying in the same resolution is a draw. | Med | (spec silent) |
| A6-03 | Last-row win: instantly, when the commander stands on its goal row after that step's triggers, if still alive. | Med | "bring your commander to the opposite side of the board. More specifically, to the last row." (L32) |
| A6-04 | The goal row is the opponent's back row (South: row 25; North: row 1). | High | L32 |
| A6-05 | "Active" = controlled by a player; only the controller's units benefit. | High | "While the keep is active, all units receive a bonus of 3 power." (L52) |
| A6-06 | The capture ring is the 12 squares at Chebyshev distance 1 from the 2x2. | High | "in range of 1(including corners) of that building" (L45) |
| A6-07 | Capture is checked at the end of every turn after damage and healing; if exactly one side is present it takes or keeps control; control persists when the ring empties. | Med | "will be conquered when at least one unit, without opposition, is in range of 1 ... One conquered, the building can be reconquered by the same method." (L45) |
| A6-08 | Presence counts invisible units, commanders and dummies; mines don't; a blocked capture is announced as "contested". | Low | "at least one unit, without opposition" (L45) |
| A6-09 | Buildings start neutral; the lobby can switch each off (it is then removed); holding them never wins the game. | Med | "two optional objectives: The keep, The market" (L45) |
| A6-10 | Keep: +3 Power to every unit of the controller, commander and dummies included; attacks only. | Med | L52 |
| A6-11 | Market: +1 action per turn for the controller's type-1 units only; the action costs AP; still one Move. | Med | "all type-1 unit have an additional action per turn" (L53) |
| A6-12 | "Conquest" = killing the enemy commander; "domination" = reaching the last row. Holding buildings is neither. | High | "For now, the objectives stand as conquest or domination (Killing enemy commander, reaching the other side of the board)." (L45) |

### 10.7 Commanders and factions

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A7-01 | Each player has exactly one of the six commanders; both may pick the same one. | Med | "each player can choose a commander" (L3) |
| A7-02 | The commander is a full Size-1 unit (attack, defend, buffs, capture, mines, reveals) with no type, costing nothing. | Med | "The commander is by default a 1/1 unit, movement and AP of 1, LOV of 3, and doesn't count from the budget." (L32) |
| A7-03 | A commander's AP is its cost per action; it adds nothing to the pool. | Med | L32; "This commander's AP is 3" (L130) |
| A7-04 | Commanders can never be sacrificed or revived. | High | "When a unit in that area dies you can choose ... to revive that unit" (L130) |
| A7-05 | The 14 listed units are The Empire's. Trill, Kulega, Sabrina = Empire; Baba Yaga, Ratasius I, Queso = Lojrar Clan. The Lojrar roster is missing; Lojrar armies use the Empire units as a proxy. | Low | "for now, 2 clans or factions" (L43); "### The Empire" / "### Lojrar Clan" (L59-60) |
| A7-06 | An army has one faction; its commander must belong to it; mirror matches are allowed. | Low | the blank line between L126 and L128 |
| A7-07 | Commander bonuses affect only their own player's units, for the whole game, created and revived units included. | High | "which will give bonuses to units or strategies" (L3) |
| A7-08 | Trill: own type 1, 2 and 5 units +2 base toughness; commander toughness 10 (replacing 1). | High | "All units of type 1, 2, 5 gain 2 toughness. The commander has toughness 10." (L124) |
| A7-09 | Kulega: +1 LOV for every own unit, the commander and dummies included. | Med | "All units gain 1 LOV." (L125) |
| A7-10 | Kulega's Fine Print: a type-1 or type-2 unit of either side dies adjacent; heal min(4, its base toughness). | Low | "When a unit of type 1 or 2 dies adjacent to this unit, regenerate toughness equal to that creature toughness, maximum of 4 per instance." (L125) |
| A7-11 | Sabrina: Artificers and No-ACBs +2 Power; Artificers are type 10 and cost 10; no Trip Mine; other type >= 20 cost x1.2, rounded up. | Med | "Artificers now are considered type 10. Artificers can no longer use mines. Each other type-20 and above is 20% more expensive to deploy." (L126) |
| A7-12 | Baba Yaga's "units of white" = every own unit with a grade, until a grade-colour table exists. | Low | "Units of white gain the ability" (L128); "The color of the token will represent the grade of the unit." (L44) |
| A7-13 | Baba Yaga's regeneration: 2 AP each, +2 toughness, not an action, own turn only, at most 2 per turn army-wide (both may go to one unit), CD 1 per unit. | Low | "Only up to 2 units can regenerate toughness this way per turn. Can be applied twice to the same unit. CD 1" (L128) |
| A7-14 | Ratasius: LOV 6; reveals invisible enemies and mines within range 3; enemies within range 1 deal 4 less (an aura; every target; instant damage they deal; floor 0). | Med | "This commander has LOV of 6. Reveals all invisible enemies in range of 3. Enemies in range of 1 gain weakness and deal 4 less damage" (L129) |
| A7-15 | Queso: commander 1/3 with AP cost 3; at the end of each own turn (not the start, Q89), own units within range 2 (Queso included) heal 5. | Med | "This commander's AP is 3, and 3 toughness. Nearby units in range of 2 regenerate 5 health each player turn (not the opponent's turn)." (L130) |
| A7-16 | Queso's revive: an own non-commander unit dies within range 2 (either turn); pay 1 of Queso's max toughness (never below 1); it returns on the same square(s) as the same unit at ceil(base / 2), statuses cleared. | Low | "sacrifice 1 max toughness to revive that unit with half of its base toughness rounded up" (L130) |

### 10.8 Units and abilities

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A8-01 | Line Formation: at least 2 other own Footmen adjacent; -2 per damage instance (floor 1); all damage. | Med | "If there's another 2 adjacent Footmen, reduce the incoming damage by 2 (not below 1)." (L64) |
| A8-02 | Fierce attacker: +1 per other own Mercenary adjacent to the target; the attacker excluded; this Mercenary's attacks only. | Med | "Deal 1 extra damage for each Mercenary that is adjacent to the attacked unit" (L67) |
| A8-03 | Perseverance: +1 at the end of each own turn, capped. | High | "Regenerate 1 toughness at the end of the turn (Your turn)" (L71) |
| A8-04 | Ranged attack: range 2; may target squares; the only "ranged attack" in v1. | Med | "This unit's attack has a range of 2." (L74); "attacking the square with a ranged attack" (L101) |
| A8-05 | Savagery: after the Berserker's basic Attack, pay 2 AP for one more attack any time later that turn; once per turn; not an action. | Med | "After attacking with the berserker, you can spend 2 AP to attack an additional time. Only once per turn." (L78) |
| A8-06 | Stealth: 1 AP; uses the Rogue's action; lasts until revealed. | Med | "Stealth:1:" (L81) |
| A8-07 | Assault: free, not an action; fires when the distance becomes 1 through a movement step (either unit moving); before the reveal; ends the move; once per Stealth. | Med | "When an enemy unit comes into the melee range of this unit, if this unit is in stealth, perform an automatic attack without spending AP to the entering unit." (L82) |
| A8-08 | Strong aura: own units adjacent to the Priestess (not herself) +1 Power and +1 toughness; no stacking. | Med | "units adjacent to priestess, gain additional 1 power and 1 toughness" (L86) |
| A8-09 | Shared wounds: 2 AP; donor = the Priestess or an adjacent own unit with at least 2 current; amount floor(current / 2); recipient = a different own unit, the Priestess or adjacent; heal capped; overflow lost. | Med | "Sacrifice half of adjacent unit's (or itself) hp. Heal other unit (including itself) hp by that number, but no more than units base hp." (L87) |
| A8-10 | Mind's Eye: reveals enemy invisible units (and mines, A4-11) inside the unit's LOV. | High | "This unit reveals invisible units in its LOV" (L90, L98) |
| A8-11 | Julio Vernification: 2 AP; sacrifice an adjacent own non-commander unit; its current toughness becomes ability damage to a visible enemy unit within range 2 of the Juliomancer (not of the sacrificed unit, Q88). | Med | "Sacrifice an adjacent unit. Deal damage equal to its current toughness to a unit in range 2." (L91) |
| A8-12 | Reinforced Armor: -3 per damage instance, floor 1. | High | "Reduce all damage dealt to this unit by 3 (can't be less than 1)" (L95) |
| A8-13 | Prototype No-ACB: 2 AP; a free adjacent square; cap 3 + floor((n - 1) / 2) with n = own Artificers alive. | Med | "A maximum of 3 dummies ... (All artificers; Every two artificers beyond the first one increase this limit by 1)" (L99) |
| A8-14 | Dummy: 0/7, LOV 1, Mv 0, AP 1, range 1, no type; a full unit; may act on the turn it's created; captures buildings. | Med | "It's a 0/7 unit, it cannot move and has a LOV of 1 and AP 1." (L99) |
| A8-15 | Mad inventor: a dummy adjacent to an own Artificer may Move 1 square and has +1 Power. | Low | "Prototypes NO-ACB can move when adjacent to any allied artificer and gain 1 power." (L100) |
| A8-16 | Trip Mine B20: 2 AP; a free adjacent square; cap 5 + (n - 1); any unit entering sets it off (also passing through or being created on it); 5, or 10 for size >= 2; then removed; a ranged attack on the square sets it off. | Med | "It explodes when any unit steps on it. ... Mines can be triggered from distance by attacking the square with a ranged attack." (L101) |
| A8-17 | Known mines (own, and revealed enemy mines): path suggestions never route through them; entering one asks first; the player can turn the warning off. | High (own) / Med (revealed enemy) | "when pathfinding, ally units will not go though mines automatically. Ask the player ... The player can deactivate this warning from options" (L102) |
| A8-18 | Forcefield: 2 AP, CD 1; 4 orthogonally connected squares inside the Wizard's LOV; own units on them -8 per damage instance (floor 1); until the start of the Wizard's next turn. | Med | "Choose 4 adjacent squares in wizards LOV. Damage received to friendly units inside the forcefield reduced by 8." (L106) |
| A8-19 | Pajazon: 3 AP, CD 1; centre within range 3; a 3x3 area for two own turns; +3 to own units at your turn ends; 3 damage to enemy units at the opponent's turn ends. | Med | "Create an area of 3x3, with center at range 3, for 2 turns." (L107) |
| A8-20 | Forceful slam: 4 AP, CD 1; a square adjacent to the Beast takes 10; the 5 squares beyond and beside it take 3; hits any unit; doesn't set off mines. | Med | "Deal 10 damage to an adjacent square, and 3 damage to the 5 opposite adjacent squares of the target." (L110) |
| A8-21 | Feast: 2 AP; sacrifice an adjacent own non-commander unit; heal its current toughness (not its base, Q87), capped. | Med | "Sacrifice an adjacent unit: Gain life equal to its toughness" (L111) |
| A8-22 | Holy blessing: 3 AP; own units within range 2, the Emissary included, heal 5, capped. | Med | "Heal ally units in a range of 2 by 5" (L115) |
| A8-23 | Smite: 3 AP; a visible enemy unit within range 3; 8 ability damage; can't set off mines. | Med | "Deal 8 damage to a unit, at a range of 3." (L116) |
| A8-24 | Holy Fervor: 2 actions per turn; every action after the first costs +1 AP; still one Move. | Med | "This unit can take 2 actions per turn. The second action costs 1 extra AP" (L117) |
| A8-25 | Command Aura: own units within range 2, not the Scourge, +1 action (checked when declared); no AP; no stacking. | Med | "Units within range 2 of this unit can take an additional action each turn. Doesn't include this unit." (L120) |

### 10.9 Take-back

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A9-01 | A take-back undoes one action and everything it caused; it can be repeated back to the start of your turn; End Turn can be undone until the opponent acts. | Med | "There will be a take back option for each player." (L39) |
| A9-02 | An accepted take-back restores the exact earlier state. | High | L39 |
| A9-03 | Actions that revealed hidden information can be undone; the opponent is first shown what was revealed. | Med | "The opponent player has to accept the take back." (L39) |
| A9-04 | One pending request; 30 s auto-decline; a declined action can't be re-requested; unlimited per game; lobby on/off. | Low | L39 |
| A9-05 | No take-back once the game has ended. | Low | L39 |

### 10.10 Spec features outside the rules engine

| ID | Default | Conf. | Spec text interpreted |
|---|---|---|---|
| A13-01 | The main menu offers Play (a lobby plus an invite link), Army compositions and Achievements, plus Options (which L102 requires) and a codex. Options are per player and never change a rule. | High | L21-L24; "The player can deactivate this warning from options" (L102) |
| A13-02 | Two human players, each in their own browser; local profiles, no accounts; no spectators, AI opponent, matchmaking or hot-seat play in v1; the engine is two-seat. | High | "For now, assume that only another player will play." (L135) |
| A13-03 | Achievements: PX 9.1's 15 by default; stored locally; computed from the per-seat event stream; rolled back by take-backs. | Low | "Check his achivements" (L24) |
| A13-04 | Token colour = grade, symbol = unit; ownership is shown by a cue that isn't hue (the base ring); tokens without a grade get their own look; buildings are 3D objects with a symbol, their controller shown. | Med | L44; L46 |
| A13-05 | Every art decision in this document is a proposal until it is on the mock page with its contenders and justification. | High | L136 |

---

## 11. Open questions for the owner

Deduplicated across all four analysts (plus the netcode research where it touches rules). They are **ranked by how much code and design would move if your answer differs from our default**, not by balance impact. Work continues on every default until you answer. Answers to most questions in tiers 2-5 are a constant or data change (Appendix A); tier 1 answers reshape the engine or the content, so they come first.

### Tier 1: engine architecture, core loop and content scope (please answer first)

| # | Question | Our current default | Conf. | Changes if you differ | Raised by |
|---|---|---|---|---|---|
| Q1 | Can a unit move and attack (or use an ability) in the same turn, or does each unit get exactly one action per turn? | Exactly one: Move **or** Attack **or** Defend **or** an ability [A2-07] | High (text) | The action model, UI flow, AP accounting, AI and every balance figure. BA expects slow, defensive games as written; S18 "Charge" is a middle way. | RL Q2, BA Q3, PX BT-05 |
| Q2 | Is AP paid for every action a unit takes, or once per unit per turn when you "use" it? | Every action, extra actions included [A2-09] | Med | The core turn loop and the value of the Market, Command Aura and Holy Fervor. | RL C-04, AB G-15, BA Q6 |
| Q3 | Which faction owns the 14 listed units? Or, since "like coins, each unit has 2 variations" (L5), are they both factions' units, one per tier each, and if so which unit of each tier belongs to which faction? | The Empire; the Lojrar Clan roster is missing [A7-05]. (The Markdown actually nests the units under "### Lojrar Clan".) The split reading is set out in 7.2. | Low | Content scope (14 more units, or none), the builder and the art. | RL C-10, AB Q-01, BA Q30, PX G-01 |
| Q4 | Which three commanders belong to each faction, and must a commander match its army's faction? | Trill, Kulega, Sabrina = Empire; Baba Yaga, Ratasius I, Queso = Lojrar; must match [A7-05, A7-06] | Low | The builder's commander list and future balance. | RL C-10, AB FAC-2, PX G-01 |
| Q5 | Until the Lojrar Clan roster exists, may Lojrar armies field the Empire's 14 units? | Yes, as a temporary proxy, so all six commanders are playable in v1 [A7-05] | Low | Whether three commanders are playable in v1. | (this synthesis) |
| Q6 | What does a Size-2 unit occupy: a 2x2 block, a 1x2 piece that can rotate, or one square marked "large"? | A 2x2 block with no facing [A1-09] | Med | Occupancy, pathfinding, vision, targeting and deployment. | RL Q4, AB Q-13, BA Q13, PX DP-07 |
| Q7 | Does "adjacent" include the four diagonal squares? | No: the 4 orthogonal squares, and melee reach follows it [A1-05] | Med | Every adjacency ability (Line Formation, Fierce attacker, Strong aura, sacrifices, placements, Rogue reveal and Assault, Kulega, Ratasius, Feast, Slam targets). One switch, but every balance number moves. | RL C-02, AB Q-04, BA Q11, PX BT-09 |
| Q8 | Can you confirm that movement is orthogonal only, so "including diagonals" in line 15 is obsolete? | Yes, L34 wins (1.5) [A1-08] | High | Pathfinding and every reach calculation. | RL C-01, AB Q-04, BA Q10, PX BT-08 |
| Q9 | Must fog of war be cheat-proof from the first release, or is it acceptable that the hosting player's browser holds the full game? | Host-browser authority, with a server mode later [A4-15] | Med | Networking only; the engine is the same either way. | RL Q1, NC Q1, PX NET-05 |
| Q10 | Do blockers and buildings block vision? | No [A1-12] | Med | The vision algorithm and the Stealth/Assault geometry. | RL C-15 and Q7, BA Q35, PX BT-21 |
| Q11 | How much should one take-back request undo? | Your last action with its consequences, repeatable back to the start of your turn; End Turn can be undone until the opponent acts [A9-01] | Med | How history is stored, and the UI. | RL Q8, AB Q-29, PX BT-29, NC Q14 |
| Q12 | May an action that revealed the opponent's hidden units or mines be taken back, if the opponent accepts after being shown what it revealed? | Yes [A9-03] | Med | The take-back check and its dialog. | AB G-44, RL D-R3, NC 7.13 |
| Q13 | When a choice arises during the opponent's turn (Queso's revive), should play pause for a live prompt? | Yes: 15 s, then "no", with an Ask/Always/Never preference [A2-30] | Low | The network flow and the pending-decision state. | RL D-T11, AB G-11, PX BT-14, NC Q16 |
| Q14 | Does using an active ability cost its listed AP instead of the unit's AP, or on top of it? | Instead of [A2-10] | Med | One switch, large balance effect (Slam 4 vs 7, Smite 3 vs 7). | RL U-03, AB Q-03, BA Q4 |

### Tier 2: economy, pace, board and deployment (constants and data)

| # | Question | Our current default | Conf. | Raised by |
|---|---|---|---|---|
| Q15 | How many AP does each player receive per turn? | 12, fixed [A2-01] | Med | BA Q1, RL Q3, AB Q-02, PX BT-01 |
| Q16 | Should the AP per turn scale with the budget, as round(0.06 x budget)? | Yes [A2-01] | Med | RL Q18, BA 4.5 |
| Q17 | Should the first player receive fewer AP on their very first turn? | Yes: 6 instead of 12 [A2-02] | Low | BA Q46, PX LB-05, NC Q7 |
| Q18 | Who moves first? | A coin flip at the start of deployment; the first player plays South [A2-04] | Med | RL D-T1, PX LB-05, NC Q7 |
| Q19 | Should unspent AP carry over to the next turn? | No [A2-03] | Med | RL Q3, AB Q-02, BA 4.5 |
| Q20 | With an extra action (Market, Command Aura, Holy Fervor), may a unit move twice in one turn? | No [A2-08] | Med | RL C-03, AB Q-03, PX BT-05 |
| Q21 | Should an army have a maximum number of units beyond what fits its deployment zone? | No; it only has to be deployable (S03 proposes 30-40) [A5-03] | Med | RL U-18, BA Q26 and S3, PX AB-06 |
| Q22 | Which units may deploy in the extended zone? | Rogue and Ranger [A5-04] | Low | RL D-P2, AB Q-12, BA Q27, PX DP-04 |
| Q23 | Which squares does "corners cut off with a radius of 4" remove? | Rule A: 8 per corner, 593 squares [A1-02] | Low | RL Q13, BA Q12, PX DP-06 |
| Q24 | Should deployment be simultaneous and hidden? | Yes [A5-06] | Med | RL Q10, PX DP-01, NC Q6 |
| Q25 | Must every purchased unit be deployed? | Yes [A5-07] | Med | RL Q10, PX DP-03 |
| Q26 | Must the commander deploy in the normal zone? | Yes [A5-07] | Med | RL D-P4, PX DP-05, BA Q37 |
| Q27 | Does "CD 1 turn" mean the ability can't be used on your next turn, so every other turn? | Yes [A2-22] | Med | RL D-T7, AB Q-05, BA Q7 |
| Q28 | Does Pajazon's "for 2 turns" mean two of the caster's own turns (two heals and two damage ticks)? | Yes [A2-23] | Low | AB Q-06, BA Q44, RL D-T8 |
| Q29 | How long does a Forcefield last? | Until the start of the Wizard's next turn [A2-24] | Low | AB Q-06, BA Q43 |
| Q84 | L34 says a moving unit "moves as many squares as the movement stat". May it stop earlier, or must it use its full Movement? | It may stop after any number of steps from 1 to N [A2-15] | Med | (completeness review) |
| Q85 | L3 says players "must spend that money". Must an army spend the whole budget, or may money be left over? | Leftover money is allowed and does nothing [A5-02] | Med | (completeness review), PX AB-07 |
| Q86 | Is an army with no units besides the commander legal? | Yes, with a warning [A5-12] | Med | PX AB-08 |

### Tier 3: combat math and unit state (small code changes, big balance effects)

| # | Question | Our current default | Conf. | Raised by |
|---|---|---|---|---|
| Q30 | When a defending unit also has flat reductions (armor, Line Formation, Forcefield), are they subtracted before Defend halves the damage? | Yes: subtract, then halve [A3-03] | Med | RL Q14, AB Q-11, BA Q9, PX BT-10 |
| Q31 | Can Ratasius' "deal 4 less damage" reduce a hit to 0? | Yes [A3-04] | Low | AB Q-11, BA Q24 |
| Q32 | Can stepping away from a Priestess (losing her +1 toughness) kill a unit? | No; current toughness stays at least 1 [A3-11] | Med | RL Q9, AB G-30, BA Q16 |
| Q33 | Can any healing raise a unit above its max toughness, in particular Feast's "gain life"? | No [A3-10] | Med | AB Q-14, BA Q17 |
| Q34 | Do two copies of the same aura or effect stack on one unit (two Priestesses, two Forcefields, two Pajazons, two Scourges)? | No [A3-15] | Med | AB Q-16, RL D-C8, BA D14 |
| Q35 | Can Julio Vernification, Feast and Shared wounds use enemy units? | No; own non-commander units only [A3-13] | Med | AB Q-07, BA Q17 |
| Q36 | Does a sacrificed unit count as "dying" for Kulega and Queso? | Yes [A3-13] | Med | AB Q-07, RL D-H5 |
| Q37 | May Smite and Julio Vernification target your own units? | No [A3-14] | Med | AB 2.8 and 2.15, RL D-I1 |
| Q38 | Do helpful effects that just say "units" (Keep, Market, Strong aura, Command Aura, Kulega) apply only to your own units? | Yes [A3-14] | High | RL Q21, AB G-03 |
| Q39 | Does the Keep's +3 Power also raise fixed ability damage (Smite, Slam, Pajazon, mines, Julio Vernification)? | No [A6-10] | Med | BA 5.4, AB X-15 |

### Tier 4: objectives, hidden information and match flow

| # | Question | Our current default | Conf. | Raised by |
|---|---|---|---|---|
| Q40 | Is a building captured at the end of a turn, or the moment the condition is met? | At the end of every turn, both players' [A6-07] | Med | RL Q12, BA Q33, PX BT-27 |
| Q41 | Do invisible (Stealthed) units capture buildings and block captures? | Yes [A6-08] | Low | RL D-O5, AB ROG-15, BA Q34, PX BT-27 |
| Q42 | Does "optional" mean the lobby can switch the Keep and the Market off? | Yes; both on by default [A6-09] | Med | RL C-12, BA Q36, PX LB-07 |
| Q43 | Do Mind's Eye and Ratasius also reveal enemy mines? | Yes [A4-11] | Low | AB Q-10, BA Q18, PX BT-25 |
| Q44 | If a Rogue tries to Stealth while an enemy it can't see is watching, should the attempt fail with its AP spent? | Yes; the button is disabled instead if the watcher is visible [A4-05] | Med | RL D-F8, AB Q-30, PX BT-24, NC Q12 |
| Q45 | When a unit is hit by an attacker its owner can't see, should the owner learn where the attack came from? | No [A4-12] | Low | PX BT-23, NC Q10 |
| Q46 | Should the opponent's remaining AP be visible during their turn? | No [A4-02] | Low | RL D-F9, NC Q9 |
| Q47 | When is each player's commander revealed to the opponent? | At the start of deployment [A5-09] | Low | RL Q11, PX DP-11, NC Q5 |
| Q48 | Should army lists stay secret until each unit is seen? | Yes; both are shown at game end [A5-08] | Med | RL D-B9, PX LB-03, NC Q4, BA S22 |
| Q49 | If both commanders die at the same moment, is the game a draw? | Yes [A6-02] | Med | RL D-K4, AB Q-28 |
| Q50 | Should there be a turn limit or another rule that ends stalemates? | None; resign or agree a draw [A2-31] | Low | RL Q16, BA Q38, PX BT-35 |
| Q51 | Is the commander a full unit (it can attack, defend, be buffed, capture buildings and set off mines)? | Yes [A7-02] | Med | RL Q11, BA Q20 |
| Q52 | Must each player pick exactly one of the six named commanders? | Yes; both may pick the same one [A7-01] | Med | RL C-06 and Q11 |

### Tier 5: readings of individual abilities and commanders

| # | Question | Our current default | Conf. | Raised by |
|---|---|---|---|---|
| Q53 | Which units are Baba Yaga's "units of white" (and what colour is each grade)? | Every own unit that has a grade, until a grade-colour table exists [A7-12] | Low | all four |
| Q54 | Does Baba Yaga allow 2 regenerations per turn in total, or 2 different units regenerating up to twice each? | 2 in total; both may go to the same unit [A7-13] | Low | AB BAB-1, BA 6 |
| Q55 | Does Baba Yaga's "CD 1" apply to each unit separately? | Yes [A7-13] | Low | AB BAB-4, BA 6 |
| Q56 | Under Sabrina, does an Artificer "considered type 10" also cost 10? | Yes [A7-11] | Med | RL Q19, BA Q22, PX AB-05 |
| Q57 | Is Queso's "AP is 3" the commander's AP cost per action? | Yes [A7-03] | Med | RL D-K3, AB Q-17, BA Q25, PX AB-13 |
| Q58 | Does Queso's revive spend Queso's own max toughness, never below 1? With Queso at 6 toughness (R8) that allows up to five revives per game (it was two under the spec's 3). Is five acceptable, or should revives be capped separately? | Yes, max toughness, floor 1; no separate cap [A7-16] | Low | RL 2.14, AB QUE-5, BA Q25, R8 |
| Q59 | Does Queso's beacon heal Queso himself? | Yes [A7-15] | Low | AB QUE-3, BA Q25 |
| Q60 | Does a revived unit return on the square where it died? | Yes, as the same unit with its statuses cleared [A7-16] | Med | RL 2.14, AB QUE-6 and QUE-7 |
| Q61 | Does Kulega's type-20 heal also trigger when an enemy type-1 or type-2 unit dies next to it? | Yes [A7-10] | Low | AB Q-19, BA Q21 |
| Q62 | Does Ratasius' weakness last only while the enemy stays adjacent to him? | Yes, an aura with no lingering status [A7-14] | Med | AB Q-20 |
| Q63 | Does the weakness cut the weakened unit's damage against every target, not only against Ratasius? | Yes [A7-14] | Med | AB Q-20, BA Q24 |
| Q64 | What shape may the Forcefield's "4 adjacent squares" take? | Any 4 orthogonally connected squares inside the Wizard's LOV [A8-18] | Med | AB Q-18, BA Q43 |
| Q65 | Is Forceful slam's splash the 3 squares beyond the target plus the 2 beside it? | Yes [A8-20] | Med | AB Q-13 |
| Q66 | Does Forceful slam damage your own units? | Yes [A8-20] | Med | AB Q-13, BA Q45, PX BT-12 |
| Q67 | Does a Rogue's Assault also fire when the Rogue itself moves next to an enemy on its own turn? | Yes [A8-07] | Med | AB Q-09 |
| Q68 | Does an Assault stop the movement of the unit that triggered it? | Yes, the Rogue's own move included [A8-07] | Med | AB Q-09, RL D-M4 |
| Q69 | Does the attacking Mercenary count itself for Fierce attacker? | No [A8-02] | Med | AB Q-26, BA Q14 |
| Q70 | May Savagery's extra attack be used later in the turn, after other units have acted? | Yes [A8-05] | Med | AB Q-23, PX BT-13 |
| Q71 | Does Holy blessing also heal the Emissary? | Yes [A8-22] | Low | AB Q-22, BA Q40 |
| Q72 | If the Emissary gets a third action (Command Aura), does that action also cost +1 AP? | Yes; every action after the first [A8-24] | Low | AB CEL-7 |
| Q73 | What does Shared wounds cost? | 2 AP, the Priestess's AP [A8-09] | Med | AB Q-25, BA Q5 |
| Q74 | Is the donor's "half" rounded down, so the donor can never die? | Yes [A8-09] | Med | AB PRI-5, BA Q5 |
| Q75 | Which units may receive Shared wounds' healing? | The Priestess or an own unit adjacent to her [A8-09] | Low | AB PRI-9, PX BT-12 |
| Q76 | Is it intended that the dummy cap grows by 1 per two extra Artificers, but the mine cap by 1 per extra Artificer? | Implemented as written [A8-13, A8-16] | Med | AB Q-15 |
| Q77 | How far can a No-ACB dummy move when Mad inventor applies? | 1 square [A8-15] | Low | AB Q-24 |
| Q78 | Can No-ACB dummies capture and contest buildings? | Yes [A6-08] | Low | AB DUM-7, BA Q18 |
| Q79 | Can a ranged unit attack a square that looks empty, to hit a hidden unit or set off a suspected mine? | Yes [A2-18] | Med | AB Q-10, BA Q19, RL D-C3 |
| Q80 | Does Smite count as a "ranged attack" that can set off mines? | No [A8-23] | Med | AB Q-10 |
| Q81 | Does a defending unit lose Defend if it acts again later in the same turn? | Yes [A2-21] | Med | RL D-C4 |
| Q82 | Can units move through squares occupied by their own units? | Yes, but not through enemies [A2-16] | Med | RL D-M3, BA Q39, PX BT-08 |
| Q83 | Can a take-back be requested after the game has ended? | No [A9-05] | Low | (this synthesis) |
| Q87 | Does Feast's "Gain life equal to its toughness" use the eaten unit's current toughness (which Julio Vernification names outright), or its base or max toughness? | Current toughness [A8-21] | Med | (completeness review) |
| Q88 | Is Julio Vernification's "a unit in range 2" measured from the Juliomancer or from the sacrificed unit? | From the Juliomancer [A8-11] | Med | (completeness review) |
| Q89 | Does Queso's beacon ("each player turn (not the opponent's turn)") heal at the end or at the start of Queso's own turn? | At the end, together with Perseverance and Pajazon [A7-15] | Med | (completeness review) |
| Q90 | Does the pathing note (L102) cover every mine the player knows about, their own and revealed enemy mines, or only their own? | Every known mine [A8-17] | Med | (completeness review) |

### Tier 6: screens and presentation (no engine change)

| # | Question | Our current default | Conf. | Raised by |
|---|---|---|---|---|
| Q91 | Which achievements should the game have? L24 names the screen only. | PX 9.1's 15 (10 Core, 5 Extended), stored locally, none hidden [A13-03] | Low | PX 9.1 |
| Q92 | Should an army created when a game starts (L26) be saved to the player's compositions? | Yes, unless the player unticks "Save to my armies" [A5-13] | Med | PX AB-15 |
| Q93 | When the budget becomes editable (L27), will both players always share one budget, or may each have their own (a handicap)? | One lobby value in v1, stored per player; each player's AP comes from their own budget [A5-14] | Low | (completeness review), PX LB-08 |
| Q94 | Token colour already shows the grade (L44). How should a player tell their own tokens from the opponent's, especially in a mirror match? | The team is shown by the base ring's shape and pattern, never by hue alone [A13-04] | Med | PX BT-17, A11Y-01 |

---

## 12. Suggestions

These are design changes for the owner to consider. **No rule in this document assumes any of them**, and none of them is a question about what the spec means (those are in section 11). Most come from the balance analysis (BA section 8), whose numbers came from a simple attrition model; treat them as direction, not exact values.

**A note on our own defaults.** BA measured its figures with 8-square adjacency (its damage order, subtract-then-halve, matches C3). One of our decisions softens the advantages it flagged: orthogonal adjacency allows only 4 melee attackers on a 1x1 target (8 on the Beast) and caps the Mercenary bonus at +3 against a 1x1 target. The owner's rulings R1 (AP curve), R2 (50-unit cap), R4 (single-faction armies) and R8 (commander 1/5, Movement 2) also invalidate several of BA's model armies (100 Soldiers, 108 Footmen, the mixed-faction lists). Re-run BA's model under the current rules (S05) before changing unit stats.

### Economy and pace

| # | Suggestion | Why | Priority | Source |
|---|---|---|---|---|
| S01 | **Approach boost and late escalation:** both players get double AP until the end of the round in which any unit first sees an enemy unit; from round 20, +1 AP per round. | Fixes the slow march (moving a 30-unit army 6 rows costs about 179 AP, 15 turns at 12 AP) and breaks stalemates; both parts switch off on their own. | High (playtest) | BA S1, 4.5 D |
| S02 | **Group march:** for 2 AP, up to 6 connected units that haven't acted each move 1 square in the same direction (their Move and their action). | The alternative to S01: infantry advances as a block (Mixed-30: about 95 AP instead of 179 for 6 rows). | Medium (pick S01 or S02) | BA S2 |
| S03 | **Unit cap of 30 per army** (or 40), created units not counted. | The strongest single lever against "AP saturation", where cheap bodies dominate (100 Soldiers won 88-100% in BA's model at every AP level). Halves turn length and clutter. Needs S07, or the Paladin takes over. | High | BA S3, PX AB-06 |
| S04 | **Turn timer for online play**, e.g. 90 s plus a small time bank. | Keeps 24-40-turn games inside about 45 minutes. | Medium | BA S4, PX BT-31 |
| S05 | **Rules and stats as data, plus match logging** (army, commander, winner, rounds, win condition), and an AI-vs-AI harness on the real engine. | Tuning without code changes; real win rates replace the model. | High (cheap) | BA S5 |

### Unit tuning

| # | Suggestion | Why | Priority | Source |
|---|---|---|---|---|
| S06 | **Berserker 8/2** (Savagery unchanged); or keep 12/2 with AP 2 and Savagery at 3 AP; or Savagery only after a kill. | Best power per coin (2.4) and damage per AP (12) in the game; 40 Berserkers kill both Emissaries in one turn. 8 still one-shots every cheap unit. | High | BA S6, D2 |
| S07 | **Paladin 10/18, armour 2.** | Armour 3 with the floor of 1 means any attacker with Power <= 4 needs 20 hits; capped Paladin cores won 93% in the model. | High if S03 | BA S7, D3 |
| S08 | **Soldier 2/5** (regeneration unchanged). | Best toughness per coin (3.5) plus regeneration; the core of the body-count turtle. Only needed without S03. | Medium | BA S8, D1 |
| S09 | **Cap the Mercenary pack bonus at +3** against every target. | Under our orthogonal adjacency it is already +3 against a 1x1 target; the cap would also limit the +7 (9-damage hits) against the Beast. | Low | BA S9, D8 |
| S10 | **Give the 50 and 100 tiers jobs that matter under a fixed AP pool**, for example Scourge "+2 AP per turn while alive", Smite splashing 3 to the target's 4 neighbours, Royal wizard 10/24. | Under AP saturation, single-target elites lose to bodies (BA 2.3); elites that generate AP or hit areas compete on their own terms. | High (after the first playtest) | BA S10 |
| S11 | **Watch the Ranger;** if it dominates open maps, try 2/1 or LOV 2. | Out-ranging melee under one action per turn isn't captured by the model. | Low (watch) | BA S11 |
| S12 | **Cap Julio Vernification's damage** (for example at 15), or use half the sacrificed toughness. | Sacrificing a Beast deals 40; Queso can bring the fodder back. | Medium | AB JUL-5, Q-21 |

### Commanders

| # | Suggestion | Why | Priority | Source |
|---|---|---|---|---|
| S13 | **Trill:** +1 toughness for types 1, 2 and 5 (or +2 for types 1-2 only); commander toughness 6. | By far the strongest commander (Mixed-30 rose from 62% to 88% in the model); Footmen and Berserkers rise above the 3-damage area attacks. | High | BA S12, D4 |
| S14 | **Baba Yaga buff (owner asked for a proposal, R6).** Why the text fails: "units of white" are the tier-1 units (Footman 1/2, Mercenary 2/1). A Mercenary can never regenerate (any hit kills it); a Footman can only after a hit reduced to exactly 1 by Line Formation. 2 AP for at most 2 toughness is the worst rate in the game (Holy blessing heals every ally in range 2 by 5 for 3 AP). **Three options, one to pick:** **S14a "Mend the swarm"** (smallest change): units of white regenerate to full toughness for 1 AP, up to 3 units per turn, no cooldown. Cheap to build, still minor. **S14b "Hex Ward"**: units of white within range 3 of Baba Yaga take 1 less damage (not below 1) and gain +1 toughness; Baba Yaga has toughness 5. A local version of Trill that makes Footman walls and Mercenary packs survive area damage. **S14c "Cauldron" (recommended)**: when one of your units of white dies, you may pay 1 AP to return it at full toughness to a free square adjacent to Baba Yaga; at most 2 returns per turn, and a given unit may return at most twice per game; Baba Yaga has toughness 5. It keeps the owner's own limits ("up to 2 units per turn", "twice to the same unit", a regeneration flavour) and the witch theme, rewards the cheap-unit identity the commander already has, and has clear counterplay (kill or isolate Baba Yaga). Bounded: 2 AP per turn buys back at most 2 one-coin units next to the commander; no sacrifice loop, because the Lojrar white unit (Mercenary) has 1 toughness, so Julio Vernification or Feast on it gain 1. | The weakest commander by a wide margin, and the only one whose text does nothing for one of its two possible units. | High (owner request) | BA S13, R6 |
| S15 | **Ratasius I:** commander toughness 4-5, or weakness at range 2. (Letting weakness reach 0 is already our default.) | His defensive aura can't save a 1/1 commander. | Medium | BA S14 |
| S16 | **Base commander toughness 5** (Queso 6, Trill 10-12). | Ends one-shot snipes by Rangers and weak units, while real threats (Smite, Rogue, Berserker, Paladin) still kill in one action; fewer abrupt endings and less incentive to bury the commander. | High | BA S15, D6 |
| S17 | **Queso:** regenerate 3 instead of 5, or 5 for only the 4 most damaged units. | Up to 60 free healing per turn feeds a regeneration turtle. | Low-medium | BA S16, D12 |

### Rules

| # | Suggestion | Why | Priority | Source |
|---|---|---|---|---|
| S18 | **Charge:** a unit with Movement 2 or more may move up to (Movement - 1) squares and then attack, as one action costing its AP + 1. | Reduces the defender's advantage (whoever steps into contact gets hit first; in the model the first striker won every mirror) while keeping "one action per turn". | High | BA S17, D7 |
| S19 | **Building-control win:** control both the Keep and the Market at the start of 5 of your consecutive turns. | A real reason to leave a turtle. It would be a **new, third** win condition: the spec's "conquest or domination" (L45) already names the two existing ones ("Killing enemy commander, reaching the other side of the board"; section 6, A6-12), so the UI must not call this one "domination". | High | BA S18 |
| S20 | **Keep:** +1 Power to all your units, or +3 only within range 3 of the Keep. **Market:** +2 AP per turn, with or without the type-1 extra action. | Today both buildings reward swarms (a flat +3 is +300% for a Footman, +20% for an Emissary); this pulls them toward different armies. | Medium | BA S19, D5 |
| S21 | **Commander run:** commander Movement 2; or win by ending your turn with your commander in the enemy's normal zone and surviving their next turn. | As written the run takes at least 20 turns and a 1/1 commander dies to the first enemy that sees it, so it is a clean-up rule, not a threat. | Medium | BA S21, 4.7 |
| S22 | **3x3 (or 2-wide by 3-tall) buildings centred on row 13**, or an even-sized board (24 or 26). | Removes the one-row tilt that a 2x2 building has on a 25-row board. | Low (the default works) | BA S20, RL U-21 |
| S23 | **Show both army lists after selection, before deployment.** | The roster has hard counters (Pajazon vs swarms, Rangers vs Berserkers, armour vs cheap units); blind picks become rock-paper-scissors. | Medium | BA S22 |
| S24 | **A distinct Lojrar Clan roster.** BA section 9 sketches one: a feral warband built around a "Warpath" rule (Movement-1 units move 2 while no enemy is in their LOV), with sample units and design guardrails. | The roster is missing (7.2); this gives the second faction its own identity instead of a proxy. | Owner's roadmap | BA S23, section 9 |
| S25 | **Make the own-mine confirmation mandatory for the commander,** even when the player has turned the warning off. | One step onto an own mine kills a 1/1 commander and ends the game. | Low | AB TMN-6 |
| S26 | **Correct the spec text:** remove "including diagonals" (L15); "Paladin:" -> "Paladin," (L94, breaks comma parsing); add the missing cost fields (Assault, Shared wounds, Mad inventor, Holy Fervor); mark Savagery's cost; remove the extra colon in Feast (L111); "One conquered" -> "Once conquered" (L45); define the grade colours (L44, L128); one cooldown notation ("CD 1" vs "CD 1 turn"); "creature" -> "unit"; "hp / health / life" -> "toughness"; "opponents turn" -> "opponent's turn" (L82); "units base hp" -> "the unit's base toughness" (L87); "Prototypes NO-ACB" -> "No-ACB prototypes" (L100, which also spells "No-ACB" differently from L99); "wizards LOV" -> "the Wizard's LOV" (L106); the menu label "achivements" -> "Achievements" (L24). Generate in-game ability text from the same data the engine reads. | Players read these texts on every card; RL section 3 lists every typo. | High (cheap) | RL 3, PX G-03 |
| S27 | **A "tall" blocker type that also blocks vision**, for ambush maps later (the flood-fill vision rule is ready as a switch). | Adds terrain play without changing the v1 rule. | Low | RL D-F2, BA 5.3 |
| S28 | **Commit-reveal for the coin flip, the armies and the deployments, plus a post-game audit replay.** | With host authority, the host could otherwise counter-pick or bias the flip; about 40 lines of code. | Medium (cheap) | NC 7.15 |

---

## 13. Spec features outside the rules engine

The spec also describes screens, presentation and delivery. None of it changes a rule, but each item either puts a requirement on the engine or must not get lost between documents. The product analysis (PX), the art research (`docs/analysis/research-art.md`) and the netcode research (NC) hold the details. This section records what the engine must provide and the defaults that touch the rules. Assumptions A13-01 to A13-05 are in 10.10.

### 13.1 Main menu, screens and Options  [A13-01 - High]

> "The game will feature a main menu where the player can either:
> - Choose to play, in which case he will create a lobby and will have a link to invite another player.
> - Create or edit army compositions
> - Check his achivements" (L21-L24)
>
> "The player can deactivate this warning from options" (L102)

- The main menu offers **Play** (it creates a lobby and shows the invite link at once), **Army compositions** and **Achievements**. It also needs **Options**, which L102 requires although L21-L24 don't list it, and a rules and unit codex (PX S02, MM-02, S11). An invite link skips the menu and opens the lobby as guest (PX MM-01); NC 7.4 defines the link.
- Other screens the spec implies: the lobby (2.1), the army builder (13.3), deployment (5.4), the battle with its camera switch (13.6), the take-back dialog (9) and the result screen (2.1 step 7).
- **Options** are per player and never change a rule. Apart from developer flags, the lobby settings (2.1) are the only per-match rule switches. Options hold at least the mine warning (`OWN_MINE_WARNING`, 2.5), the revive preference (`REVIVE_PREFERENCE`, 2.11), the default camera view (`VIEW_MODE_DEFAULT`, 13.6) and last-seen markers (4.2).

### 13.2 Players and connection  [A13-02 - High]

> "The game, preferably, should be made for the browser, with a way to connect with another player. This should be done in a way that requires the least setup. For now, assume that only another player will play." (L135)

- Two human players, each in their own browser, one per seat. There are no accounts: each player has a local profile (a display name and a random ID) in browser storage (PX G-05, G-06).
- Not in v1: spectators, an AI opponent, matchmaking and accounts (PX section 14). Hot-seat play on one screen isn't offered either, because both players would see each other's fog.
- The engine stays strictly two-seat (`view(state, seat)` for South and North), so none of these is blocked later. Authority and fog: 4.9.

### 13.3 Army compositions  [A5-13 - Med]

> "Create or edit army compositions" (L23)
> "Army compositions don't have to be made only from the menu option. If a player wants to create a new one when a game starts, he can do so there aswell." (L26)

- A composition = faction + commander + unit counts (5.1). It has a name, is stored with the local profile (PX G-06) and is re-validated against the current unit data whenever it is loaded (PX AB-17).
- The same builder opens from the main menu and from the lobby. In the lobby, a new or edited army can be used for this match only or saved ("Save to my armies", on by default; PX AB-15, Q92). Changing the army after Ready un-readies the player (PX AB-16).
- The engine's part: **one validation function**, shared by the builder and the authority (cost <= budget after the commander's price changes, the faction lock, deployability; 5.1), so an army the builder accepts is never refused at lock-in.

### 13.4 Budget  [A5-14 - Low]

> "The player will have a budget of 200, which can be edited in the future, but for now the default is 200." (L27)

The rules are in 5.1. The budget lives in one place (`BUDGET`, carried by the lobby protocol), and everything derived from it reads that value: army validation, `AP_PER_TURN` (2.3), and the figures this document quotes "with a budget of 200" (the Artificer counts in 7.6 and 8.10). Deployability limits depend on the scenario, not the budget.

### 13.5 Achievements  [A13-03 - Low]

> "Check his achivements" (L24)

- The spec names the screen but no achievements. Default: the 15 that PX section 9.1 proposes (10 Core, 5 Extended), stored with the local profile, none hidden (PX AC-01 to AC-04). Q91 asks the owner for the list.
- The engine's part: the stream of resolved events it already produces for the log and the animations (PX 9.2: GameStarted, DamageApplied with the amount prevented and by what, UnitDefeated with its cause, ObjectiveCaptured, TurnEnded, TakebackResolved, GameEnded with reason and rounds), **filtered by `view(state, seat)`**, so an achievement can never use hidden information.
- Progress from an action that is taken back is rolled back with it (TB-8). Only completed matches count, and a win needs at least 3 full rounds, so instant resignations can't farm wins (PX AC-01).

### 13.6 Camera: top and isometric  [A1-16 - High]

> "The view can switch from top to isometric. Top by default." (L48)

- **Top view is the default** (`VIEW_MODE_DEFAULT = top`). A toggle (a button and a key) switches to isometric, and the choice is remembered per player (PX BT-33).
- **Presentation only.** Both views draw the same `view(state, seat)` and show exactly the same information: fog, statuses, previews, legal squares. Both pick the same square under the cursor and keep the A1-15 orientation, with your back row nearest you. The engine never knows which view is active.
- In isometric view, the 3D buildings (L46) and other tall pieces must not hide units or squares: they fade when they cover a unit or the hovered square, and unit symbols stand upright (PX BT-33, A11Y-10; art research 10.3).

### 13.7 Tokens, factions and buildings on screen  [A13-04 - Med]

> "Despite being inspired in the euro distribution, each unit will be represented by a token. The color of the token will represent the grade of the unit. The symbol on top of the token will represent the particular unit that token represents." (L44)
> "The neutral objectives are represented by 3d objects and a symbol in the middle that represents this building." (L46)
> "The style of the graphics is stylized." (L47)

- **Colour = grade, symbol = unit.** The grade-colour table is rules data as well as art, because Baba Yaga's "units of white" reads it (7.7, Q53).
- **Ownership needs a cue of its own.** Hue already means grade, and mirror matches are allowed (7.2), so neither colour nor faction style can tell your tokens from the opponent's. Default: the team is shown by the token's base ring, by shape and pattern rather than by hue alone (PX BT-17, A11Y-01; contenders in art research 6.3; Q94).
- **Tokens without a grade** need a look that no grade colour uses: the commander (a crown, PX BT-17), the No-ACB dummy, mines (seen by their owner, or once revealed) and area markers (Forcefield, Pajazon).
- **Changed grades** are drawn as the grade the rules use: under Sabrina, the Artificer shows tier 10 (7.6).
- **Buildings** are 3D objects with their symbol in the middle (L46), and their controller is shown in both views (art research 9.2, 9.3). Control is public (6.4), so this leaks nothing.
- **Style:** stylized (L47). Art direction belongs to the art research; this document makes no art decision.

### 13.8 Delivery notes  [A13-05 - High]

> "Any question about the system, or perceived ambiguity, as well as suggestions, can be proposed now and anytime in the future when convenient." (L134)
> "Any framework may be used. For the artstyle and graphics, references and/or free asset packs may be used if suitable; otherwise design the graphics. Any artistic decision will show a quick mock in a page, as well as justification for the use. If there are several contenders, all should be represented and justified." (L136)

- Questions are in section 11 and suggestions in section 12; both lists stay open as the owner answers.
- **Every art decision goes through the mock page.** Each presentation note in this document is a proposal until it appears on the mock page with its contenders and the reasons for the choice (art research section 13): the Artificer's tier-10 token (7.6), skinning the Lojrar proxy units (7.2), the ownership cue and the tokens without a grade (13.7), and fading in isometric view (13.6).
- The framework choice is in `docs/analysis/research-framework.md`; the engine contract (4.9) doesn't depend on it.

---

## Appendix A. Constants and rule switches

Every default that a playtest or an owner answer may change. Build each as a named constant, data, or a lobby/dev setting. **The OWNER RULINGS table at the top of this document (R1–R42) overrides any row below that still shows an older default**; the rulings name the constants they set (for example `MAX_MOVES_PER_TURN`, `WEAKNESS_FLOOR`, `FRIENDLY_SINGLE_TARGET`, `SHOW_OPPONENT_AP`, `COMMANDER_REVEAL`, `ARMY_LISTS_PUBLIC`, `TURN_TIMER`, `KEEP_POWER_BONUS`, `MARKET_AP_BONUS`, the Charge, Group march, approach-boost, Siege and 3x3-building constants, and the changed unit and commander stats).

| Constant or switch | Default | Section | Alternatives |
|---|---|---|---|
| `CORNER_RULE` / `CORNER_RADIUS` | A / 4 | 1.3 | B, C, D |
| `ADJACENCY` (also sets melee reach) | `ORTHO_4` (Manhattan 1) | 1.4 | `KING_8` |
| `MOVE_DIRECTIONS` | `ORTHO_4` | 1.5 | `KING_8` |
| `VISION_OCCLUSION` | none | 1.7, 4.1 | `floodfill` (blockers and buildings stop sight) |
| `AP_BASE` / `AP_PER_ROUND_INCREMENT` / `AP_MAX` | **10 / 1 / 20 (owner ruling R1)**: AP(round) = min(AP_BASE + (round - 1) x AP_PER_ROUND_INCREMENT, AP_MAX) | R1, 2.3 | the old fixed 12 (`AP_PER_TURN`) is withdrawn |
| `FIRST_TURN_AP` | **none (owner ruling R1)** | R1, 2.3 | 6 (the old default) |
| `AP_CARRYOVER` | 0 | 2.3 | up to 4 |
| `AP_PAYMENT` | per action | 2.4 | once per unit per turn |
| `ABILITY_COST_MODE` | replaces the unit's AP | 2.4 | adds to it |
| `MAX_MOVES_PER_TURN` | 1 | 2.4 | equal to the action allowance |
| `MOVE_EXACT_DISTANCE` | false (a Move may stop early) | 2.5 | true (Q84) |
| `COOLDOWN_MODE` | skip N own turns | 2.9 | once per turn |
| `DURATION_UNIT` | own turns | 2.9 | half-turns |
| `DAMAGE_ORDER` | subtract, then halve | 3.3 | halve, then subtract |
| `TARGET_REDUCTION_FLOOR` / `WEAKNESS_FLOOR` | 1 / 0 | 3.3 | 0 / 1 |
| `AURA_LOSS_CAN_KILL` | false (current stays >= 1) | 3.7 | true |
| `OVERHEAL` | false | 3.6 | true |
| `SAME_NAME_STACKING` | false | 3.11 | true |
| `SACRIFICE_ENEMIES` / `SACRIFICE_COUNTS_AS_DEATH` | false / true | 3.9 | true / false |
| `FRIENDLY_SINGLE_TARGET` | false | 3.10 | true |
| `SQUARE_ATTACKS` | attacks with range >= 2 | 2.6 | every attack |
| `STEALTH_FAIL_MODE` | disabled if the watcher is visible, otherwise fail with AP spent | 4.4 | always disabled; fail with no AP spent |
| `MINDS_EYE_REVEALS_MINES` (also Ratasius) | true | 4.5, 4.6 | false |
| `SHOW_OPPONENT_AP` | false | 4.2 | true |
| `ATTACKER_GHOST_MARKER` | false | 4.8 | true (one-turn "muzzle flash") |
| `LAST_SEEN_MARKERS` | on (client side) | 4.2 | off |
| `BUDGET` | 200 (dev flag in v1; one lobby value, stored per player) | 5.1, 13.4 | lobby setting; per-player budgets (Q93) |
| `MUST_SPEND_FULL_BUDGET` | false | 5.1 | true (Q85) |
| `MIN_ARMY_UNITS` | 0 (a commander-only army is allowed, with a warning) | 5.1 | 1 (Q86) |
| `ARMY_UNIT_CAP` | **50 at deployment (owner ruling R2)**; commander and created units not counted; deployability still applies | R2, 5.1 | 30, 40 |
| `VANGUARD_UNITS` | Rogue, Ranger | 5.3 | types 1-2; none |
| `COMMANDER_REVEAL` | start of deployment | 5.5 | start of battle; never |
| `ARMY_LISTS_PUBLIC` | false | 5.5 | true (S23) |
| `CAPTURE_TIMING` | end of every turn | 6.4 | instant; end of the capturer's turn |
| `STEALTH_CAPTURES` / `DUMMIES_CAPTURE` | true / true | 6.4 | false |
| `KEEP_ENABLED` / `MARKET_ENABLED` | true / true | 6.4 | false |
| `SIMULTANEOUS_COMMANDER_DEATH` | draw | 6.2 | - |
| `LOJRAR_PROXY_ROSTER` | **false (owner ruling R4: both rosters exist, 7 units each)** | R4, 7.2 | - |
| `COMMANDER_FACTION_LOCK` | **false (owner ruling R7)** | R7, 7.2 | true, with group A = Empire and group B = Lojrar |
| `COMMANDER_BASE_TOUGHNESS` / `COMMANDER_MOVEMENT` | **5 / 2 (owner ruling R8; S16 and S21 adopted)**; Power 1, AP 1, LOV 3 unchanged | R8, 7.1 | 1 / 1 (the spec's literal values) |
| `TRILL_COMMANDER_TOUGHNESS` / `QUESO_COMMANDER_TOUGHNESS` | **10 / 6 (R8)** | R8, 7.3, 7.9 | Queso 3 (literal) or 7 (+2 over base) |
| `SABRINA_ARTIFICER_COST` / `SABRINA_SURCHARGE` | 10 / x1.2, rounded up | 7.6 | 20 / - |
| `BABA_WHITE_GRADES` | **[1] (owner ruling R6: tier 1 is Argent/white in the recommended palette)** | R6, 7.7 | every grade (old default); per the final colour table |
| `BABA_VARIANT` (per army) and the `BABA_MEND_*`, `BABA_HEX_*`, `BABA_CAULDRON_*` constants | **owner ruling R11**: 'mend' (1 AP, full heal, 3 uses per turn) / 'hex-ward' (range 3, +1 toughness, -1 damage) / 'cauldron' (1 AP, return adjacent to Baba Yaga, 2 per turn, twice per unit, AP debt on the opponent's turn) | R11 | Cauldron cost: free, or 1 Baba Yaga toughness (Q98) |
| `BABA_USES_PER_TURN` / `BABA_CD_SCOPE` | withdrawn (the spec's regeneration text is replaced by R11) | 7.7 | - |
| `KULEGA_ENEMY_DEATHS` / `KULEGA_HEAL_CAP` | true / 4 | 7.5 | false / - |
| `RATASIUS_WEAKNESS` | -4, range 1, aura, every target, instant damage only | 7.8 | a lingering status |
| `QUESO_SELF_HEAL` / `QUESO_MIN_MAX_TOUGHNESS` | true / 1 | 7.9 | false / 0 |
| `QUESO_BEACON_TIMING` | end of own turn | 7.9 | start of own turn (Q89) |
| `REACTION_PROMPT_TIMEOUT_S` / `REVIVE_PREFERENCE` | 15 (then "no") / Ask | 2.11 | 20, none / Always, Never |
| `MERC_COUNTS_SELF` | false | 8.2 | true |
| `SAVAGERY_WINDOW` | the rest of the turn | 8.5 | immediately |
| `SHARED_WOUNDS_COST` / rounding / recipient | 2 / floor / the Priestess or adjacent | 8.7 | - / - / any own unit in her LOV |
| `JULIO_RANGE_ORIGIN` | the Juliomancer | 8.8 | the sacrificed unit (Q88) |
| `DUMMY_CAP(n)` / `MINE_CAP(n)` | 3 + floor((n-1)/2) / 5 + (n-1), n = own Artificers alive | 8.10 | n = Artificers deployed |
| `DUMMY_MOVE` / `DUMMY_SUMMONING_SICKNESS` | 1 / none | 8.15 | - / one turn |
| `FORCEFIELD_SHAPE` / `FORCEFIELD_DURATION` | any connected tetromino / until own next turn | 8.11 | 2x2 only / 2 turns |
| `PAJAZON_CENTRE_RANGE` / `PAJAZON_DURATION` | up to 3 / 2 own turns | 8.11 | exactly 3 / half-turns |
| `SLAM_FRIENDLY_FIRE` | true | 8.12 | false |
| `FEAST_TOUGHNESS` | current | 8.12 | base; max (Q87) |
| `HOLY_BLESSING_SELF` | true | 8.13 | false |
| `HOLY_FERVOR_SURCHARGE` | +1 on every action after the first | 8.13 | the second action only |
| `COMMAND_AURA_RANGE` | 2, checked when an action is declared | 8.14 | - |
| `OWN_MINE_WARNING` (own and revealed enemy mines) | on (player option) | 2.5, 8.16 | off; own mines only (Q90); mandatory for the commander (S25) |
| `TAKEBACKS` / `TAKEBACK_TIMEOUT_S` / `TAKEBACKS_PER_GAME` | on / 30 / unlimited | 9 | off / - / 3, 1, 0 |
| `TURN_TIMER` / `TURN_LIMIT` | off / none | 2.12 | 60, 120, 300 s / N rounds with a tie-break |
| `VIEW_MODE_DEFAULT` | top (player option) | 13.6 | isometric |

## Appendix B. Damage and toughness test vectors

Expected engine results under the defaults. Each row should become a unit test.

| # | Situation | Computation | Result |
|---|---|---|---|
| B1 | Berserker (12) attacks a Paladin | 12 - 3 | 9 |
| B2 | Berserker (12) attacks a defending Paladin | 12 - 3 = 9, ceil(9/2) | 5 |
| B3 | Footman (1) attacks a Paladin | max(1, 1 - 3) | 1 |
| B4 | Footman (1) attacks a defending Paladin | 1, ceil(1/2) | 1 |
| B5 | Keep-buffed Footman (4) attacks a Paladin | max(1, 4 - 3) | 1 |
| B6 | Mercenary (2) with 3 other own Mercenaries next to the target attacks a defending Paladin | 2 + 3 = 5, 5 - 3 = 2, ceil(2/2) | 1 |
| B7 | Mercenary (2) +3 attacks a Footman in formation | 5 - 2 | 3 |
| B8 | Footman (1) next to an enemy Ratasius attacks anything | 1 - 4 -> 0 | no damage (no reveal, no trigger) |
| B9 | Revealed Rogue (7) next to Ratasius attacks him | 7 - 4 | 3 (kills a 1/1 Ratasius) |
| B10 | Smite (8) on a defending Emissary | 8, ceil(8/2) | 4 |
| B11 | Smite (8) from an Emissary next to an enemy Ratasius | 8 - 4 | 4 |
| B12 | Slam (10) on a Paladin inside a friendly Forcefield | max(1, 10 - 11) | 1 |
| B13 | Beast (20) attacks a defending Paladin inside a friendly Forcefield | 20 - 11 = 9, ceil(9/2) | 5 |
| B14 | Slam splash (3) on a Footman in formation | 3 - 2 | 1 |
| B15 | Slam from a Beast next to an enemy Ratasius | 10 - 4 on the target; 3 - 4 -> 0 on the splash | 6 / no damage |
| B16 | Mine on a Beast | 5 + 5 | 10 |
| B17 | Mine on a defending Beast | ceil(10/2) | 5 |
| B18 | Mine on a Paladin | 5 - 3 | 2 |
| B19 | Mine on a Footman in formation inside a Forcefield | max(1, 5 - 10) | 1 |
| B20 | Pajazon tick (3) on a Trill Footman (1/4) in formation | 3 - 2 | 1 |
| B21 | Pajazon tick (3) on a unit next to an enemy Ratasius | weakness never applies to ticks | 3 |
| B22 | Julio Vernification sacrificing a full Beast (40), on an enemy Emissary | 40 | 40 (10 left) |
| B23 | Julio Vernification by a Juliomancer next to an enemy Ratasius, sacrificing a dummy (7) | 7 - 4 | 3 |
| B24 | Dummy under Sabrina, next to an own Artificer, with the Keep, attacks a Footman | Power 0 + 2 + 1 + 3 = 6 | 6 |
| B25 | Berserker with the Keep, next to an own Priestess, attacks an Emissary | Power 12 + 3 + 1 = 16 | 16 |
| B26 | Assault with the Keep (10) on a defending Soldier | 10, ceil(10/2) | 5 |
| B27 | Berserker (12) attacks a defending Footman in formation | 12 - 2 = 10, ceil(10/2) | 5 |
| B28 | Beast (20) attacks a defending Paladin | 20 - 3 = 17, ceil(17/2) | 9 |

| # | Toughness situation | Expected |
|---|---|---|
| T1 | Commander 1/1 next to its own Priestess | 2/2 |
| T2 | That commander takes 1 damage, then steps away | 1/1, alive (current floored at 1) |
| T3 | Footman 1/2 inside a Strong aura (max 3) at current 1; the Priestess walks away | max 2, current 1 |
| T4 | Queso revives a Paladin | the Paladin returns at 10 (of 20); Queso's max toughness 3 -> 2 |
| T5 | Kulega: an enemy Soldier dies next to my Paladin | my Paladin heals 4 (capped at max) |
| T6 | Shared wounds: donor Soldier at 7, recipient Footman at 1/2 | donor loses 3 (to 4); recipient heals 1 (to 2); 2 wasted |
| T7 | Feast on a dummy (7) by a Beast at 30/40 | the dummy dies; the Beast goes to 37 |
| T8 | Feast on a Soldier (7) by a Beast at 38/40, next to an own Paladin, under Kulega | the Beast goes to 40 (capped); the Paladin heals 4 |
| T9 | Soldier at 3 inside an enemy Pajazon at the end of its own turn | 3 - 3 = 0: it dies before Perseverance |
| T10 | Soldier at 4 inside an enemy Pajazon at the end of its own turn | 4 - 3 = 1, then +1 = 2 |

## Appendix C. Spec coverage map

Every line of `SPEC.md` that has content, and where this document covers it. The unit lines were checked digit by digit (Power/Toughness, Size, LOV, Movement, AP) against the 8.0 table and the quotes in 8.1-8.14. All 14 match, and so do the dummy (L99) and the base commander (L32). So do the derived figures re-checked in the same pass: the board (593 squares), the zones (109 + 50), LOV areas 2N(N+1), the dummy and mine caps, Trill's, Sabrina's and Queso's numbers, and test vectors B1-B28 and T1-T10.

| Spec | What it says | Covered in |
|---|---|---|
| L3 | A duel; money buys any combination of units within the budget; each player chooses a commander | 5.1 (A5-02, A5-12), 7 |
| L5 | Euro denominations 1-100; each unit is a coin and "has 2 variations" | 1.1 (type), 5.1 (cost = type), 7.2 (both readings of "2 variations"), Q3 |
| L7 | Power and Toughness as in MTG; an action cost that scales with the unit's power | 3.1; 2.4 (A2-32: a fixed stat) |
| L9 | AP every turn, spent to use units | 2.3 |
| L11 | One Move per unit per turn | 2.4 (A2-08) |
| L13 | Square grid; scenarios may have blockers | 1.7, 1.8 |
| L15 | Shared actions: movement (1 square, "including diagonals"), attack, defend (half, rounded up, never less than one) | 1.5 (diagonals superseded), 2.5-2.7, 3.3 |
| L17 | The scenario; vision from units; fog | 1.8, 4 |
| L19 | No regeneration unless an ability says so | 3.6 |
| L21-L24 | Main menu: Play (lobby and invite link), army compositions, achievements | 2.1, 13.1, 13.3, 13.5 |
| L26 | Armies can also be created when a game starts | 2.1, 13.3 (A5-10, A5-13) |
| L27 | Budget 200, editable in the future | 5.1, 13.4 (A5-02, A5-14) |
| L28 | Units are chosen first | 2.1 |
| L29 | Deployment phase; zones at the edges; some units may use the extended area | 5.2-5.4 |
| L30 | 25x25, corners cut off with a radius of 4 | 1.3 |
| L31 | Normal zone 5 rows; extended zone 2 more | 5.2, 5.3 |
| L32 | Kill the commander or reach the last row; commander 1/1, Movement 1, AP 1, LOV 3, free | 6.2, 6.3, 7.1 |
| L34 | The Movement stat; orthogonal steps; the worked example | 1.5, 2.5 (A2-15, Q84) |
| L35 | One action per turn unless stated otherwise | 2.4 |
| L37 | LOV: 4 squares at 1, 12 at 2, and so on | 1.4, 4.1 |
| L39 | A take-back for each player; the opponent must accept | 9 |
| L43 | Two factions for now, more later | 7.2 |
| L44 | Tokens: colour = grade, symbol = unit | 13.7; 7.7 (Baba Yaga reads the colour) |
| L45 | Conquest or domination; the Keep and the Market: 2x2, taken by unopposed presence within range 1 including corners, retakable | 6 (intro, A6-12), 6.4 |
| L46 | Objectives drawn as 3D objects with a symbol | 13.7, 1.7 |
| L47 | Stylized graphics | 13.7, 13.8 |
| L48 | Top or isometric view; top by default | 13.6 (A1-16) |
| L52 | Keep: +3 Power | 6.5 |
| L53 | Market: type-1 units get an extra action | 6.6 |
| L57 | The unit line format | 8.0 |
| L59-L60 | "### The Empire", then "### Lojrar Clan" | 7.2 |
| L63-L64 | Footman 1/2, 1, 1, 1, 1; Line Formation | 8.0, 8.1 |
| L66-L67 | Mercenary 2/1, 1, 1, 1, 1; Fierce attacker | 8.0, 8.2 |
| L70-L71 | Soldier 2/7, 1, 2, 1, 1; Perseverance | 8.0, 8.3 |
| L73-L74 | Ranger 3/1, 1, 3, 1, 1; Ranged attack | 8.0, 8.4 |
| L77-L78 | Berserker 12/2, 1, 2, 1, 1; Savagery ("Only once per turn") | 8.0, 8.5 |
| L80-L82 | Rogue 7/4, 1, 3, 2, 2; Stealth; Assault ("This can also occur in opponents turn") | 8.0, 8.6, 4.4 |
| L85-L87 | Priestess 3/15, 1, 2, 2, 2; Strong aura; Shared wounds | 8.0, 8.7 |
| L89-L91 | Juliomancer 3/15, 1, 3, 1, 2; Mind's Eye; Julio Vernification | 8.0, 8.8 |
| L94-L95 | Paladin 12/20, 1, 2, 3, 2; Reinforced Armor | 8.0, 8.9 |
| L97-L101 | Artificer 1/15, 1, 3, 2, 1; Mind's Eye; Prototype No-ACB (0/7, LOV 1, AP 1, cap 3); Mad inventor; Trip Mine B20 (5, +5 for size 2 or more, cap 5, ranged detonation) | 8.0, 8.10, 8.15, 8.16 |
| L102 | Pathing note: don't route through mines, ask first, the warning can be turned off in Options | 2.5, 8.16 (A8-17, Q90), 13.1 |
| L105-L107 | Royal wizard 10/20, 1, 3, 1, 3; Forcefield; Pajazon | 8.0, 8.11 |
| L109-L111 | Beast of Knorund 20/40, 2, 2, 2, 3; Forceful slam; Feast | 8.0, 8.12, 1.6 |
| L114-L117 | Celestial Emissary 15/50, 1, 4, 2, 4; Holy blessing; Smite; Holy Fervor | 8.0, 8.13 |
| L119-L120 | Scourge of the Gods 15/33, 1, 3, 2, 3; Command Aura | 8.0, 8.14 |
| L124 | Trill "The Hydrocephalic" | 7.4 |
| L125 | Kulega "The Fine Printer" | 7.5 |
| L126 | Sabrina "The Reelfinisher" | 7.6 |
| L128 | Baba Yaga "The Bwitch" | 7.7 |
| L129 | Ratasius I "The Great" | 7.8 |
| L130 | Queso "The Beacon of hope" | 7.9 |
| L134 | Questions and suggestions are welcome at any time | 11, 12, 13.8 |
| L135 | Browser; least setup; only one other player | 4.9, 13.2 |
| L136 | Any framework; references or free asset packs; every art decision shown on a mock page with its justification and all contenders | 13.8 |

**Changes made by the completeness review (2026-10-24).** Added section 13 and its assumptions (10.10), this appendix, A1-16, A2-32, A5-12 to A5-14 and A6-12, questions Q84 to Q94 (with a new Tier 6), and the matching constants. Extended the L102 pathing rule to revealed enemy mines (2.5, 8.16, A8-17). Lowered A2-15 (stopping early) and the leftover-money part of A5-02 from High to Med, because the literal text reads the other way. Recorded the "one variation per faction" reading of L5 (7.2, C26, Q3). Corrected S19, which had called a building-control win the spec's "domination". Quoted L45's win-condition sentence in section 6. Completed the Queso revive table. Re-pointed A1-15 to L29. Added Julio Vernification's range origin (JUL-9) and Feast's toughness reading (BEA-12). Added the missing in-game typos to S26.
