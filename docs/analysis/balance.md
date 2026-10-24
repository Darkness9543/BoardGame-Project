# Balance and Action-Economy Analysis

**Lens:** game design, unit balance, action economy, pace, map and objectives.
**Source:** `docs/SPEC.md` (the owner's verbatim spec, 2026-10-24). References like (L34) point to line numbers in that file.
**Status:** this is a proposal for the owner. Nothing here changes the spec.

How to read this document:

- **Default** means a reading of an unclear rule that implementation can use now, so nobody is blocked. Each default has a confidence level. All defaults are collected in section 7.
- **Suggestion** means a design change. Suggestions are the owner's call and are **not** assumed by any default. They are collected in section 8.
- Numbers come from small scripts: exact stat arithmetic, board geometry with path-finding, and a simple attrition model. The model and its limits are described in section 1.

---

## 0. Summary: the ten most important findings

1. **The spec never says how many AP a player gets per turn (L9).** Recommended default: **a fixed 12 AP per turn**, written as round(0.06 x budget) so it scales if the budget changes. Unspent AP is lost. The player who moves first gets 6 AP on their first turn. *Confidence: medium on the number, high on "fixed".* AP that scales with army value made no difference to which armies win in the model. AP that grows per turn starves the slowest phase of the game, the approach march.
2. **Structural finding: "AP saturation".** With a fixed pool, an army deals full damage until it has fewer units left than the pool can activate. Extra bodies cost the enemy at least one action each to remove, and cost their owner nothing to keep. So cheap, tough bodies dominate. **100 Soldiers won 88-100% of matchups in the model at every AP pool from 6 to unlimited.** The 50 and 100 tiers lose to almost everything on raw stats.
3. **Pace problem: marching costs AP.** Seven of the 14 units have movement 1, and every step costs AP. At 12 AP, moving a 30-unit mixed army forward 6 rows costs 179 AP, about **15 turns**. 100 Soldiers would need 50 turns. In practice infantry will stay home as a garrison while fast units fight. Strong suggestion: add an approach boost or a group-march rule (section 4).
4. **The defender has the advantage.** Each unit gets one action per turn (L35). A melee unit that steps next to an enemy has used its action, so the enemy strikes first. In the model, the side that strikes first won every mirror match. Combined with point 3, this pushes both players to turtle. The only stalemate-breaker in the spec is the commander reaching the last row, which takes **at least 20 turns** at movement 1 (L32). The owner should look at this.
5. **Unit outliers:**
   - **Berserker** 12/2 for 5 coins: best power per coin (2.4) and best damage per AP (12) in the game. 40 Berserkers kill both Emissaries in one 12-AP turn.
   - **Paladin** 12/20 with armor 3: every attacker with power 4 or less deals 1 damage, so it needs 20 hits. Once units are capped, Paladin-heavy armies win 83-93%.
   - **Soldier** 2/7 with regen: best toughness per coin (3.5).
   - **Mercenary** pack bonus: up to +7 damage, or +11 against the 2x2 Beast.
6. **Commanders:** Trill is by far the strongest. A mixed army's model win rate goes from 62% to 88%, and his toughness-10 commander survives a Smite. Baba Yaga is the weakest, and "units of white" is not defined.
7. **Keep and Market:** default the Keep to "controller's units only". A flat +3 power is +300% for a Footman and +20% for an Emissary, so it mostly amplifies swarms. In the model, the side holding the Keep wins a mixed-army mirror whether it strikes first or second, and in half the rounds. The Market (an extra action for type-1 units) is weak, because extra actions still cost AP.
8. **A 2x2 building cannot sit fairly on a 25-row board.** Proposed default map "Crossroads" (section 5):
   - Keep at G13:H14, one row nearer North.
   - Market at R12:S13, one row nearer South.
   - The board is identical under 180-degree rotation, with 21 blocker cells.
   - The first player plays South: they get the first move, and the second player sits nearer the stronger Keep.
9. **The 1/1 commander dies to any single hit**, and Defend cannot save it, because damage is never below 1. Expect sudden endings. A Ranger can kill it from range 2. An Emissary with Holy Fervor can move 2 and Smite at range 3, a reach of 5 squares in one turn. A Juliomancer kills it at range 2, and a Pajazon or a mine also kills it. Suggestion: base commander toughness 5.
10. **Deployment space is an unstated unit cap.** The normal zone has 109 cells (under the default corner reading), so "200 Footmen" cannot be deployed. A real design cap of 30 (or 40) units is the single strongest balance lever. It is suggested here, not assumed.

---

## 1. Working assumptions behind the numbers

These readings are used for every calculation. Each one also appears in section 7 with a confidence level. If the owner decides differently, most conclusions point the same way.

- **Actions** (L9, L11, L35):
  - A unit takes at most one action per turn: move, attack, defend, or use an ability. Each action costs the unit's AP.
  - An ability's listed cost replaces the unit's AP for that action. It does not add to it.
  - Extra-action effects (Market, Command Aura, Holy Fervor, Savagery) still cost AP. They can never be a second move (L11).
- **Geometry:**
  - Movement is in orthogonal steps. L34 overrides "including diagonals" in L15.
  - "Adjacent" and melee reach mean the 8 surrounding cells. The Beast's Slam hits "the 5 opposite adjacent squares" (L110), which only works with 8 neighbours.
  - Ranges and LOV use Manhattan distance. L37 says LOV 2 shows 12 squares, which is a diamond.
- **Damage:**
  - Order: attacker bonuses (Keep, aura, pack) first, then flat reductions (armor, Line Formation, Forcefield, weakness), then Defend halves the result rounded up, and every hit deals at least 1.
  - Attacks are one-way. There is no counter-damage (L15).
- **Board:**
  - 25x25 with each corner rounded to radius 4. A cell counts only if it lies completely inside the arc, so 8 cells are removed per corner and 593 cells remain.
  - Normal deployment zone: rows 1-5, 109 cells. Extended zone: rows 6-7, 50 more cells.
- **Mercenary bonus:** counts the *other* Mercenaries next to the target, not the attacker.
- **The attrition model** behind the win-rate tables:
  - Armies start in contact and take turns.
  - Each turn a side spends its AP on attacks. It picks the kills that destroy the most enemy value per AP, solved exactly for each target.
  - At most 12 attacks can hit a 1x1 target per turn, 16 against a 2x2.
  - Modeled effects: Paladin armor, Line Formation (while 3 or more Footmen live), Mercenary pack at +2 (a typical line fight), Soldier regen, Savagery, Holy Fervor, Trill, the Keep.
  - **Not modeled:** movement, range and kiting, terrain, fog, Defend, and any ability a player has to activate (Slam, Pajazon, Forcefield, Smite, heals, summons, stealth).
  - So the model **undervalues area-damage units, support units, and Rangers' kiting.** Use it for direction, not exact numbers.

---

## 2. Unit metrics

### 2.1 Stat sheet and derived metrics

Columns follow the spec format (L57): Power/Toughness, Size, LOV, Movement, AP. Derived columns:

- **Dmg per AP:** basic-attack damage per AP spent.
- **AP per coin:** the AP needed to activate each coin of army. A high value means the army is hard to activate fully.
- **Squares per AP:** how cheaply the unit walks.
- **sqrt(PxT) per coin:** a square-law (Lanchester) combat value per coin. A fair roster would keep this inside a narrow band per tier, with abilities explaining the gaps.

| Type (cost) | Unit | P/T | Size | LOV | Mv | AP | Max in 200 | Army P / T at max | P per coin | T per coin | Dmg per AP | AP per coin | Squares per AP | sqrt(PxT) per coin | Flag |
|---:|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Footman | 1/2 | 1 | 1 | 1 | 1 | 200 | 200 / 400 | 1.00 | 2.00 | 1.0 | 1.00 | 1.00 | 1.41 | Wall unit; Line Formation makes it take 1 from any attacker with power <=3. Strong only with Trill. |
| 1 | Mercenary | 2/1 | 1 | 1 | 1 | 1 | 200 | 400 / 200 | 2.00 | 1.00 | 2.0 | 1.00 | 1.00 | 1.41 | Pack bonus is uncapped: up to +7 (8 neighbours), +11 vs a 2x2 target. |
| 2 | Soldier | 2/7 | 1 | 2 | 1 | 1 | 100 | 200 / 700 | 1.00 | 3.50 | 2.0 | 0.50 | 1.00 | 1.87 | OUTLIER: best toughness per coin (3.5) + regen. Core of the body-count turtle. |
| 2 | Ranger | 3/1 | 1 | 3 | 1 | 1 | 100 | 300 / 100 | 1.50 | 0.50 | 3.0 | 0.50 | 1.00 | 0.87 | Only cheap ranged unit; LOV 3 > range 2, so it kites melee under move-or-attack. T1. |
| 5 | Berserker | 12/2 | 1 | 2 | 1 | 1 | 40 | 480 / 80 | 2.40 | 0.40 | 12.0 | 0.20 | 1.00 | 0.98 | OUTLIER: best power per coin (2.4) AND best damage per AP (12). |
| 5 | Rogue | 7/4 | 1 | 3 | 2 | 2 | 40 | 280 / 160 | 1.40 | 0.80 | 3.5 | 0.40 | 1.00 | 1.06 | Roughly fair; AP 2 makes it expensive to act; value is stealth/Assault. |
| 10 | Priestess | 3/15 | 1 | 2 | 2 | 2 | 20 | 60 / 300 | 0.30 | 1.50 | 1.5 | 0.20 | 1.00 | 0.67 | Weak body for 10; value is aura/heal (Shared wounds has no AP cost listed). |
| 10 | Juliomancer | 3/15 | 1 | 3 | 1 | 2 | 20 | 60 / 300 | 0.30 | 1.50 | 1.5 | 0.20 | 0.50 | 0.67 | Weak body; burst via sacrifice (range 2), a commander sniper. |
| 20 | Paladin | 12/20 | 1 | 2 | 3 | 2 | 10 | 120 / 200 | 0.60 | 1.00 | 6.0 | 0.10 | 1.50 | 0.77 | OUTLIER: armor 3 + min-1 floor means power<=4 attackers need 20 hits; mv 3. |
| 20 | Artificer | 1/15 | 1 | 3 | 2 | 1 | 10 | 10 / 150 | 0.05 | 0.75 | 1.0 | 0.05 | 2.00 | 0.19 | Weakest body per coin; value is summons/mines; AP 1 makes it the best walker (2 sq/AP). |
| 50 | Royal Wizard | 10/20 | 1 | 3 | 1 | 3 | 4 | 40 / 80 | 0.20 | 0.40 | 3.3 | 0.06 | 0.33 | 0.28 | Low raw stats; value is Forcefield/Pajazon (the main anti-swarm tool). |
| 50 | Beast of Knorund | 20/40 | 2 | 2 | 2 | 3 | 4 | 80 / 160 | 0.40 | 0.80 | 6.7 | 0.06 | 0.67 | 0.57 | Best raw stats in the 50/100 tiers, still below Paladin per coin; size 2 is a liability. |
| 100 | Celestial Emissary | 15/50 | 1 | 4 | 2 | 4 | 2 | 30 / 100 | 0.15 | 0.50 | 3.8 | 0.04 | 0.50 | 0.27 | Under the curve on stats; Holy Fervor + Smite = threat range 5 assassin. |
| 100 | Scourge of the Gods | 15/33 | 1 | 3 | 2 | 3 | 2 | 30 / 66 | 0.15 | 0.33 | 5.0 | 0.03 | 0.67 | 0.22 | Weakest stats per coin; Command Aura value depends on the AP economy. |
| - | Commander (default) | 1/1 | 1 | 3 | 1 | 1 | free | - | - | - | 1.0 | - | 1.00 | - | Dies to any single hit; Defend cannot save it (min 1). |

What stands out:

- **Berserker** is first in both power per coin (2.40, then Mercenary 2.00 and Ranger 1.50) and damage per AP (12.0, then Beast 6.7 and Paladin 6.0). It kills every type-1, 2 and 5 unit, and every commander including Trill's toughness-10 one, in a single hit.
- **Soldier** has the best toughness per coin (3.50, then Footman 2.00) and also regenerates (L71).
- **Paladin** has armor 3 with a minimum of 1 (L95). Footmen, unpacked Mercenaries, Soldiers, Rangers, Priestesses and commanders all deal it exactly 1 damage. It is also the fastest fighter per AP (1.5 squares per AP).
- **The 50 and 100 tiers** (Wizard 0.28, Emissary 0.27, Scourge 0.22) and the Artificer (0.19) are far below the efficient units (0.77-1.87) on sqrt(PxT) per coin. Abilities have to make up the whole gap.
- **"Max in 200" versus deployment:** 200 Footmen or 200 Mercenaries fit the budget but not the board. The normal zone has 109 cells and the commander takes one (Q26).
- **AP costs grow roughly with the log of the price:** 1 AP for 1-5 coins, 2 AP for 5-20, 3-4 AP for 50-100. So expensive units are 10-30 times cheaper to activate per coin (Footman 1.00 AP per coin, Scourge 0.03). This is "scales depending on the relative power" (L7), but much less than linearly.

### 2.2 Turns-to-kill matrix

Each cell is the number of attacks needed to kill a full-health target. The number in parentheses is for a target that is Defending. "Footman in line" means Line Formation is active. Equivalent rows and columns are merged: Artificer and Priestess are both toughness 15, and the commander attacks like a Footman.

| Attacker (power) | Footman | Footman in line | Merc | Soldier | Ranger | Berserker | Rogue | Priestess, Julio, Artificer | Paladin | Wizard | Beast | Emissary | Scourge | Cmdr 1 | Queso 3 | Trill 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Footman / Commander (1) | 2 | 2 | 1 | 7 | 1 | 2 | 4 | 15 | 20 | 20 | 40 | 50 | 33 | 1 | 3 | 10 |
| Mercenary, alone (2) | 1 (2) | 2 | 1 | 4 (7) | 1 | 1 (2) | 2 (4) | 8 (15) | 20 | 10 (20) | 20 (40) | 25 (50) | 17 (33) | 1 | 2 (3) | 5 (10) |
| Mercenary, 3 others adjacent (5) | 1 | 1 | 1 | 2 (3) | 1 | 1 | 1 (2) | 3 (5) | 10 (20) | 4 (7) | 8 (14) | 10 (17) | 7 (11) | 1 | 1 | 2 (4) |
| Soldier (2) | 1 (2) | 2 | 1 | 4 (7) | 1 | 1 (2) | 2 (4) | 8 (15) | 20 | 10 (20) | 20 (40) | 25 (50) | 17 (33) | 1 | 2 (3) | 5 (10) |
| Ranger / Priestess / Juliomancer (3) | 1 | 2 | 1 | 3 (4) | 1 | 1 | 2 | 5 (8) | 20 | 7 (10) | 14 (20) | 17 (25) | 11 (17) | 1 | 1 (2) | 4 (5) |
| Keep-buffed Footman (4) | 1 | 1 (2) | 1 | 2 (4) | 1 | 1 | 1 (2) | 4 (8) | 20 | 5 (10) | 10 (20) | 13 (25) | 9 (17) | 1 | 1 (2) | 3 (5) |
| Rogue (7) | 1 | 1 | 1 | 1 (2) | 1 | 1 | 1 | 3 (4) | 5 (10) | 3 (5) | 6 (10) | 8 (13) | 5 (9) | 1 | 1 | 2 (3) |
| Smite (ability) (8) | 1 | 1 | 1 | 1 (2) | 1 | 1 | 1 | 2 (4) | 4 (7) | 3 (5) | 5 (10) | 7 (13) | 5 (9) | 1 | 1 | 2 (3) |
| Royal Wizard / Slam primary (10) | 1 | 1 | 1 | 1 (2) | 1 | 1 | 1 | 2 (3) | 3 (5) | 2 (4) | 4 (8) | 5 (10) | 4 (7) | 1 | 1 | 1 (2) |
| Berserker / Paladin (12) | 1 | 1 | 1 | 1 (2) | 1 | 1 | 1 | 2 (3) | 3 (4) | 2 (4) | 4 (7) | 5 (9) | 3 (6) | 1 | 1 | 1 (2) |
| Emissary / Scourge (15) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 (2) | 2 (4) | 2 (3) | 3 (5) | 4 (7) | 3 (5) | 1 | 1 | 1 (2) |
| Beast (20) | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 (2) | 2 (3) | 1 (2) | 2 (4) | 3 (5) | 2 (4) | 1 | 1 | 1 |

Key reads:

- **Against the Paladin, every attacker with power 4 or less needs 20 hits.** That includes a Keep-buffed Footman (4 - 3 = 1). This is the root of the Paladin outlier.
- **The Berserker needs one attack (1 AP) for anything with toughness 12 or less.** It needs 3 on a Paladin or Scourge, 4 on a Beast, and 5 on an Emissary (4 hits = 48, just short of 50).
- **Commanders:**
  - The default 1/1 commander dies to one hit from anything.
  - Queso (toughness 3) dies to one Ranger shot, one Slam splash or one Pajazon tick.
  - Trill (toughness 10) survives a Smite, a mine and three Ranger shots, but not one hit from a Berserker, Paladin or Wizard.
- **Defend does nothing for toughness-1 units** (Mercenary, Ranger, commander), because of the minimum of 1.

### 2.3 AP saturation: the key structural finding

With a fixed pool of X AP and per-unit activation, a side can spend at most X AP per turn, however big its army is. Four things follow.

1. **Damage output stays flat until the army shrinks below about X divided by the average AP per unit.** At 12 AP, 100 Soldiers keep full output until 88 of them have died. Two Emissaries lose half their output with the first death.
2. **Every body costs the enemy at least one action to remove, however cheap it is,** because extra damage is wasted. Cheap bodies work as "AP armor".
3. **Elite single-target damage is mostly wasted against cheap units.** An Emissary's 15-damage attack kills one 1-coin Footman for 4 AP.
4. **The size of the AP pool mostly changes the pace, not the winner.** The ranking of army types barely moves between 6 and 30 AP (table in 2.4).

So **army-composition balance has to be fixed through unit stats, an army rule (a unit cap), or area damage. Tuning the AP number will not fix it.**

### 2.4 Attrition-model results

Uncapped armies, fixed AP. Each cell is the win rate over every pairing and both move orders.

| Army (200 coins) | 6 AP | 10 AP | 12 AP | 30 AP | unlimited |
|---|---:|---:|---:|---:|---:|
| 100 Soldier | 96% | 100% | 100% | 100% | 88% |
| 108 Footman + Trill | 88% | 83% | 83% | 83% | 79% |
| 85 Mercenary + 23 Berserker | 83% | 83% | 83% | 75% | 75% |
| 100 Ranger + Trill | 71% | 71% | 71% | 75% | 67% |
| 100 Ranger | 67% | 67% | 67% | 71% | 62% |
| Mixed-52 | 62% | 62% | 62% | 54% | 50% |
| 40 Berserker + Trill | 54% | 54% | 54% | 58% | 67% |
| 40 Berserker | 46% | 46% | 46% | 50% | 67% |
| 40 Rogue | 25% | 29% | 29% | 33% | 46% |
| 10 Paladin | 33% | 29% | 29% | 21% | 21% |
| Elite-7 | 17% | 17% | 17% | 21% | 21% |
| 4 Beast | 8% | 8% | 8% | 8% | 8% |
| 2 Emissary | 0% | 0% | 0% | 0% | 0% |

Army definitions:
- **Mixed-52:** 1 Beast, 2 Paladin, 1 Priestess, 4 Berserker, 10 Soldier, 10 Ranger, 10 Footman, 10 Mercenary, 4 Rogue.
- **Elite-7:** 1 Emissary, 1 Beast, 1 Paladin, 1 Priestess, 1 Juliomancer, 2 Berserker.
- **108 Footman:** the largest army that fits the normal zone.

Selected duels at 12 AP. "A first" and "B first" show who won and in which round, depending on who strikes first.

| Duel | A first | B first |
|---|---|---|
| 40 Berserker vs 100 Soldier | Soldier, round 4 | Soldier, round 4 |
| 40 Berserker vs 10 Paladin | Berserker, round 3 | Berserker, round 3 |
| 40 Berserker vs 2 Emissary | Berserker, round 1 (both Emissaries die in the first turn) | Berserker, round 1 |
| 40 Berserker vs 4 Beast | Berserker, round 2 | Berserker, round 2 |
| 100 Ranger vs 40 Berserker | Ranger, round 4 (kiting not counted) | Ranger, round 4 |
| 100 Soldier vs 10 Paladin | Soldier, round 17 | Soldier, round 17 |
| 108 Footman + Trill vs 10 Paladin | Footman, round 17 | Footman, round 17 |
| Mixed-52 vs Mixed-52 | **A**, round 10 | **B**, round 10 (the first striker always wins) |
| Mixed-52 vs Elite-7 | Mixed, round 2 | Mixed, round 3 |

With a 30-unit cap (Suggestion S3), stats as written, 12 AP:

| Capped army (at most 30 units) | Win rate |
|---|---:|
| Pal8 core: 8 Paladin, 8 Soldier, 4 Berserker, 2 Ranger | 93% |
| 27 Berserker + 3 Paladin | 71% |
| Mixed-30: 1 Beast, 2 Paladin, 1 Priestess, 6 Berserker, 8 Soldier, 8 Ranger, 4 Rogue | 64% |
| 20 Footman + 2 Beast + 4 Paladin | 57% |
| 26 Soldier + 1 Emissary + 2 Paladin + 1 Rogue | 50% |
| 2 Beast + 4 Paladin + 4 Berserker | 36% |
| 25 Ranger + 1 Emissary + 2 Paladin + 2 Rogue | 29% |
| Elite-7 | 0% |

Tuning changes tested on the same capped field:
- With **Paladin 10/18 armor 2** and **Berserker 8/2**, the Pal8 core drops to 79% and the field tightens to 29-71%.
- With a **40-unit cap** instead: Pal8 core 83%, Mixed-40 75%, Berserker-heavy 58%, Soldier + Emissary 58%, Footman + Beast 50%, Ranger-heavy 25%, Elite-7 0%.

Takeaways:
1. **Uncapped, the army with the most bodies wins.**
2. **Capped, the Paladin wins.**
3. **The 50 and 100 tiers never win on stats.** Their activated abilities (Pajazon, Slam, Forcefield, Holy blessing, Command Aura) must carry them, so they should be playtested first.

### 2.5 Direct comparisons

**Beast of Knorund (50) vs 2.5 Paladins (50 coins of Paladin):**
- Raw stats: the Beast is 20/40, AP 3, movement 2, size 2. Two and a half Paladins total 30/50 with armor 3, cost 5 AP to activate, and move 3.
- Trade: the Beast needs 2 hits (17 each) per Paladin, so 15 AP to kill all 2.5. The Paladins need 4 hits (12 each), 8 AP, to kill the Beast. **The Paladins win the exchange about 2 to 1 in AP.**
- Size 2 is a drawback: 12 cells touch the Beast, which means more attackers and a Mercenary bonus up to +11. Mines deal it double damage (L101), and it cannot pass through 1-wide gaps.
- Verdict: the Beast is about fair for 50 coins. **The Paladin is too cheap.**

**Ranger 3/1, range 2:**
- One shot kills a Berserker, Mercenary, Ranger or commander. With LOV 3 against range 2, it sees a Berserker (LOV 2) before the Berserker sees it.
- Under move-or-attack, a movement-1 melee unit can never hit an alert Ranger first. A Berserker that steps adjacent is shot at range 1 on the Ranger's turn and dies. The model ignores this, so **Rangers are stronger in open terrain than their 67% suggests.**
- Counters: at toughness 1, anything kills a Ranger, including a Pajazon tick or Slam splash (3). With Trill (3/3), those counters stop working.

**Mass Footmen with Trill:**
- A 1/4 Footman in Line Formation takes 1 damage from any attacker with power 3 or less, so it takes 4 hits. Slam splash and Pajazon deal it 1 (3 - 2). **The anti-swarm tools stop working.**
- The 108 deployable Footmen need about 108 enemy actions to clear: 9 full turns of 12 AP spent only on killing. But they deal 1 damage per AP. On its own this is a stall strategy, not a way to win.
- **Add the Keep's +3 and they become 4-power. That combination is the real threat.**

**Berserker 12/2 for 5:**
- 40 Berserkers have 480 total power. The next best is 400, from 200 Mercenaries, who cannot all be deployed.
- At 12 AP they kill 12 cheap units per turn, or both Emissaries in one turn.
- The weakness is real: toughness 2 dies to any 2-power hit, and Rangers kite it. That is why it scores only 46% uncapped. With Trill (12/4) it survives a single Ranger shot, Pajazon tick or Slam splash. With Command Aura it reaches 36 damage for 4 AP (section 3, D11).

---

## 3. Degenerate strategies

Ranked by expected impact on real games. "Fix" points to suggestions in section 8, which are the owner's call.

| ID | Strategy | Severity | Main fix (suggestion) |
|---|---|---|---|
| D1 | Body-count turtle (100 Soldiers, or 108 Trill Footmen, packed around the commander) | Critical | S3 unit cap, S18 domination win, S8 Soldier 2/5 |
| D2 | Berserker spam | High | S6 Berserker 8/2 |
| D3 | Paladin core | High once units are capped, otherwise medium | S7 Paladin 10/18 armor 2 |
| D4 | Trill plus cheap units | High | S12 |
| D5 | Swarm powered by the Keep | Medium-high | S19 |
| D6 | Commander snipe (the "glass king") | High (swingy) | S15 base toughness 5 |
| D7 | Defender's advantage and standoff | High (structural, makes D1 worse) | S17 charge, S18, S1 |
| D8 | Mercenary wolfpack against big units | Medium | S9 cap the bonus at +3 |
| D9 | Endless Feast | Medium if no cap (the default caps it) | default Q17 |
| D10 | Sacrificing enemy units | Critical if allowed (the default forbids it) | default Q17 |
| D11 | Command Aura engine | Medium (good design, watch it) | none needed yet |
| D12 | Queso regen turtle | Medium | S16 |
| D13 | Mine field around a turtle | Low-medium | watch |
| D14 | Stacked Priestess auras | Medium if auras stack (the default says they don't) | default Q16 |

**D1. Body-count turtle (Critical)**
- Spec: "A unit can only use one action per turn, unless stated otherwise." (L35). There is also no stalemate rule.
- How it works:
  - AP saturation (2.3): the swarm deals full damage until it is almost gone.
  - The enemy has to walk in and take the first hit (D7).
  - The turtle never needs to move, so the 600 AP its march would cost never matters.
- Numbers: 100 Soldiers won 88-100% in the model at every AP level. 108 Trill Footmen won 79-88%.
- Counterplay already in the spec:
  - Pajazon: 3 damage across a 3x3 area, twice. It kills Mercenaries, Rangers, Berserkers, and Footmen outside Line Formation. Line Formation cuts it to 1 damage, and under Trill, Footmen and Berserkers survive a tick anyway.
  - Slam splash.
  - The commander run, which takes 20 turns or more.
- Fix: S3 (unit cap), S18 (domination win), S8 (Soldier 2/5).

**D2. Berserker spam (High)**
- Spec: "Berserker, 12/2, 1, 2, 1, 1" (L77). Savagery: "spend 2 AP to attack an additional time" (L78).
- How it works: 2.4 power per coin and 12 damage per AP. Savagery adds another 12 for 2 AP.
- Numbers: both Emissaries die in one turn. 10 Paladins die in 3 rounds. 4 Beasts die in 2.
- Counterplay already in the spec: Rangers out-range it, Pajazon and Slam splash kill it, and any 2-power hit kills it. Trill (12/4) removes most of these answers.
- Fix: S6 (Berserker 8/2, or AP 2).

**D3. Paladin core (High once units are capped)**
- Spec: "Reduce all damage dealt to this unit by 3 (can't be less than 1)" (L95).
- How it works: every attacker with power 4 or less, Keep-buffed Footmen included, needs 20 hits. Fixed-damage abilities are cut too: Smite 8 becomes 5, Slam 10 becomes 7, splash 3 becomes 1, Pajazon 3 becomes 1, a mine's 5 becomes 2.
- Numbers: with a 30-unit cap, Paladin-heavy armies win 93% (83% with a 40-unit cap). Movement 3 lets them reach objectives first.
- Counterplay already in the spec: Berserkers (9 per hit), the Beast (17), the Emissary or Scourge (12).
- Fix: S7 (10/18 armor 2). Together with S6 it brought the Paladin core to 79% in the model.

**D4. Trill plus cheap units (High)**
- Spec: "All units of type 1, 2, 5 gain 2 toughness. The commander has toughness 10." (L124)
- How it works: free toughness on the most cost-efficient half of the roster.
  - Footman 1/4 and Berserker 12/4 now survive the 3-damage area attacks (Slam splash, Pajazon).
  - Ranger 3/3 and Mercenary 2/3 survive single 2-power hits.
  - The commander survives Smite, mines and Rangers.
- Numbers: Mixed-30's win rate goes from 62% to 88% against the capped field.
- Fix: S12.

**D5. Swarm powered by the Keep (Medium-high)**
- Spec: "While the keep is active, all units receive a bonus of 3 power." (L52)
- How it works: a flat bonus is worth far more to weak units.
  - Footman 1 to 4 (+300%), Soldier and Mercenary 2 to 5 (+150%), Ranger 3 to 6 (+100%).
  - Emissary +20%, Beast +15%.
- Numbers, with the Keep held by one side:
  - Mixed-52 mirror: the Keep side wins whether it strikes first or second, in 5-6 rounds. Without the Keep, the first striker wins in 10.
  - Soldier mirror: the Keep side wins in 17 rounds instead of 35.
  - Elite armies gain almost nothing.
- Severity: if the Keep buffed both players and could never be turned off, it would be a permanent rule change that favours swarms.
- Fix: S19.

**D6. Commander snipe, the "glass king" (High, swingy)**
- Spec: "The commander is by default a 1/1 unit" (L32).
- Kill threats:
  - Ranger from 2 squares.
  - Smite at range 3. With Holy Fervor the Emissary moves 2 first: 8 damage from 5 squares away in one turn, from outside the commander's LOV of 3 (the Emissary sees 4).
  - Juliomancer: sacrifice any adjacent ally, deal its current toughness at range 2.
  - A Pajazon area, a mine, a stealthed Rogue's free Assault.
- Defend cannot help, because every hit deals at least 1.
- Consequences: games end suddenly. Players bury the commander three rows deep, which feeds D1.
- Fix: S15.

**D7. Defender's advantage and standoff (High, structural)**
- Spec: one action per turn (L35). Units can "move as many squares as the movement stat" (L34) but cannot also attack.
- How it works:
  - Stepping into contact costs your action, so the enemy hits first.
  - The same holds for ranged units: whoever steps into the other's range is shot first, unless their own range is longer (the Ranger against melee).
  - A stealthed Rogue's free Assault on any unit that comes close (L82) adds to it.
- Numbers: in the model, the side that strikes first won every mirror.
- Effects: rewards waiting. Together with the march cost (4.3) it is the engine behind D1.
- Fix: S17 (charge), S18 (domination win), S1 (approach boost).

**D8. Mercenary wolfpack against big units (Medium)**
- Spec: "Deal 1 extra damage for each Mercenary that is adjacent to the attacked unit" (L67).
- How it works: the bonus has no cap.
  - Eight Mercenaries around a 1x1 target deal 9 each: 72 damage for 8 AP and 8 coins. An Emissary dies in 6 attacks.
  - Twelve around the 2x2 Beast deal 13 each: it dies in 4 attacks. 12 coins kill 50.
- Counterplay already in the spec: one Slam kills up to 6 of them (toughness 1), and Pajazon. They also have to walk in first (D7).
- Fix: S9.

**D9. Endless Feast (Medium if Feast has no cap)**
- Spec: "Feast:2: Sacrifice an adjacent unit: Gain life equal to its toughness" (L111). Unlike Shared wounds (L87), no maximum is stated.
- How it works: an Artificer builds a 0/7 dummy for 2 AP, the Beast eats it for 2 AP. That is +7 toughness for 4 AP, every turn, forever.
- The default (Q17) caps Feast at the Beast's base toughness, which removes this.

**D10. Sacrificing enemy units (Critical if allowed)**
- Spec: "Julio Vernification:2: Sacrifice an adjacent unit." (L91). Feast says the same (L111).
- How it works: if enemies could be sacrificed, the Juliomancer would instantly kill an adjacent Emissary (100 coins) and deal 50 damage at range 2.
- The default (Q17) allows allied, non-commander units only.

**D11. Command Aura engine (Medium, intended)**
- Spec: "Units within range 2 of this unit can take an additional action each turn." (L120)
- How it works:
  - A Berserker in the aura can attack (1 AP), use Savagery (2 AP) and attack again with the aura's extra action (1 AP): 36 damage for 4 AP.
  - Any unit in the aura can move and attack in the same turn, which breaks D7.
- It cannot double-move the commander (L11 still allows one move).
- Good design, because it is the built-in answer to D7. Watch it.

**D12. Queso regen turtle (Medium)**
- Spec: "Nearby units in range of 2 regenerate 5 health each player turn" (L130).
- How it works: up to 12 units heal 5 each turn for 0 AP, 60 toughness per turn. With Holy blessing (+5) and Pajazon (+3), damage that doesn't kill within one turn is wasted.
- Fix: S16.

**D13. Mine field around a turtle (Low-medium)**
- Spec: "A maximum of 5 mines ... Each artificer beyond the first one increases this limit by 1" (L101).
- How it works: 10 Artificers allow 14 invisible mines, 5 damage each (10 against size 2). They also hit your own units.
- Counterplay already in the spec: Mind's Eye, and ranged attacks that set mines off from a distance.

**D14. Stacked Priestess auras (if auras stack)**
- Spec: "units adjacent to priestess, gain additional 1 power and 1 toughness" (L86).
- How it works: if auras stack, k Priestesses around a Berserker give it +k/+k.
- The default (Q16) says auras don't stack.

---

## 4. AP economy proposal

### 4.1 What the spec says, and what it leaves out

> "each unit has an action cost, which will scale depending on the relative power of that unit." (L7)
>
> "In each player's turn, that player will receive a number of Action points. The player can use those action costs to use a number of units that fit its budget." (L9)
>
> "A unit can only use one action per turn, unless stated otherwise." (L35)

The size of the pool is never given. It sets three things:

1. How much of the army can act each turn, which is the core decision every turn.
2. How lethal a turn is, which drives first-strike swings.
3. How fast armies cross the board, which drives game length.

### 4.2 Share of the army that can act each turn

The table shows what fraction of an army's total activation cost one turn's AP can pay for.

| Army | Units | AP to activate every unit once | 8 AP | 10 AP | 12 AP | 15 AP | 20 AP |
|---|---:|---:|---:|---:|---:|---:|---:|
| Elite-7 | 7 | 15 | 53% | 67% | 80% | 100% | 100% |
| Pal8 core | 22 | 30 | 27% | 33% | 40% | 50% | 67% |
| Mixed-30 | 30 | 39 | 21% | 26% | 31% | 38% | 51% |
| 40 Berserker | 40 | 40 | 20% | 25% | 30% | 38% | 50% |
| Mixed-52 | 52 | 61 | 13% | 16% | 20% | 25% | 33% |
| 100 Soldier | 100 | 100 | 8% | 10% | 12% | 15% | 20% |

Target:
- A mid-sized army (20-30 units) should be able to act with about a third of itself per turn. Then "what do I activate?" is a real choice every turn.
- An elite army acts almost completely, and pays for that with fewer bodies.
- 12 AP gives 31-40% for armies of 22-30 units.
- 12 is divisible by 1, 2, 3 and 4, so no AP is left over with these unit costs.
- A turn of up to about 12 activations is roughly 60-90 seconds of clicking.

### 4.3 March cost: the pace problem

Seven of the 14 units have movement 1 (Footman, Mercenary, Soldier, Ranger, Berserker, Juliomancer, Royal Wizard), six have movement 2, and only the Paladin has 3. Every step is a paid action.

Cost to move a whole army forward 6 rows, from the front of the normal zone (row 5) to the edge of the objective rings (rows 11-12). Each unit pays its AP once per move, rounding up (6 divided by its movement):

| Army | AP to advance 6 rows | Turns at 8 AP | at 10 AP | at 12 AP | at 15 AP | at 20 AP |
|---|---:|---:|---:|---:|---:|---:|
| Elite-7 | 55 | 6.9 | 5.5 | 4.6 | 3.7 | 2.8 |
| Pal8 core (22 units) | 116 | 14.5 | 11.6 | 9.7 | 7.7 | 5.8 |
| Mixed-30 | 179 | 22.4 | 17.9 | 14.9 | 11.9 | 8.9 |
| 40 Berserker | 240 | 30.0 | 24.0 | 20.0 | 16.0 | 12.0 |
| Mixed-52 | 311 | 38.9 | 31.1 | 25.9 | 20.7 | 15.6 |
| 100 Soldier | 600 | 75.0 | 60.0 | 50.0 | 40.0 | 30.0 |

**At any sensible pool size, slow infantry cannot advance as a block.** Expected play:
- Fast units fight over the objectives from round 2-3: the Paladin (movement 3), the movement-2 units, and the vanguard deployed in the extended zone.
- Infantry stays home as a garrison.

That is a workable split of roles, but it feeds D1 and D7 and makes the endgame slow. A larger pool helps the march, but it also makes every turn more lethal, so it should not be the only lever.

### 4.4 Target length and the expected timeline at 12 AP

**Target:** 12-20 rounds (24-40 player turns), about 30-45 minutes with 60-90 second turns. A turn timer is suggested for online play (S4).

Expected game at 12 AP with 25-30-unit armies, on the map from section 5:

| Rounds | Phase | Detail |
|---|---|---|
| 1-3 | Contact | Vanguard and fast units reach the objective rings. A vanguard Rogue needs 2 moves to its nearer ring. A Paladin from row 5 needs 2-3 moves (6-7 steps). |
| 3-6 | Skirmishes | Fights at the Keep and Market. Infantry moves up slowly, about 8 AP of steps per turn. |
| 6-12 | Main battle | Once in contact, a 30-unit mirror is wiped in about 6 rounds at 12 AP in the model (9 rounds at 8 AP, 4 at 20 AP). |
| 12-20 | Endgame | Hunting the commander, or breaking a garrison. Without a stalemate-breaker this can last indefinitely (D1). |

The commanders start up to 24 rows apart (row 1 to row 25). Neither commander needs to move for the game to end by commander kill, so in practice game length is set by the armies, not by the commanders.

### 4.5 Alternatives

**A. Fixed pool: 12 AP per turn, or round(0.06 x budget). Recommended default.**
- For:
  - Simplest; one readable constant.
  - No AP left over with 1-4 AP units.
  - Scales automatically if the owner changes the budget (L27): 300 coins gives 18 AP.
  - Fits "receive a number of Action points" (L9).
- Against:
  - The approach is slow (4.3).
  - It doesn't fix army balance, but no pool size does (2.3).

**B. Scales with the army's surviving value: AP = 6 + floor(remaining value / 40).**
- That gives 11 AP at full strength, 8 at half, and never below 6.
- For: losing 100 coins costs the same tempo whether it was one Emissary or 50 Soldiers, which partly counters AP saturation.
- Against:
  - Snowballing: the side that is behind also gets to do less.
  - Another number to show on screen.
  - **It changed nothing in the model:** 100 Soldier still won 100%, and Elite-7 still won 17%.
- Not worth the complexity.

**C. Grows per turn: AP = min(16, 6 + 2 x (round - 1)), so 6, 8, 10, 12, 14, 16.**
- For: quick first turns, a little compensation for moving second, and late escalation that breaks stalemates.
- Against: it starves the slowest phase. Rounds 1-3 would get 6-10 AP exactly when the march needs the most.
- Not recommended as written. Its useful part, late escalation, is in D.

**D. Fixed pool, plus an approach boost, plus late escalation. Recommended upgrade if playtests feel slow.**
- Rules:
  - 12 AP per turn.
  - Both players get double AP (24) until the end of the round in which any unit first sees an enemy unit ("first contact").
  - From round 20, +1 AP per round.
- For: fixes the march exactly where it hurts, switches itself off, and escalation forces a result.
- Against:
  - Two extra rules.
  - Both players learn that first contact happened. That is a small information leak under fog, and acceptable.

**Also considered:**
- **Carry-over** (bank up to 4 unspent AP): makes it worth waiting for one big turn, which strengthens D7. Keep it off by default.
- **AP based on unit count:** rewards swarms even more. Rejected.

**Direct answer to "fixed, scale with army value, or grow per turn?":**
- **Fixed.** Scaling with value adds snowballing without fixing army balance.
- Growing per turn puts the least AP where the game needs the most (the approach). Escalation is useful only late, as a stalemate-breaker.
- If the approach feels slow, add the approach boost (D) or a group-march rule (S2) rather than raising the base pool. Raising the base pool also raises how lethal a turn is, and with it the advantage of striking first.

### 4.6 Recommended default for implementation

| Item | Default | Confidence |
|---|---|---|
| AP per player turn | **12, fixed**. Stored as a config value; formula round(0.06 x budget). | Medium (number), high (fixed) |
| Unspent AP | Lost; no carry-over. | Medium-high |
| First player | Coin flip. The first player deploys **South** and has **6 AP** on their first turn. If playtests favour the second player, who sits nearer the Keep, raise this to 8-12. | Low-medium |
| What costs AP | Every action costs the acting unit's AP: move, attack, defend. An ability's listed cost replaces the unit's AP. Extra actions cost AP as usual (Holy Fervor +1, Savagery 2). | Medium-high |
| Moves per turn | At most one move per unit per turn, even with extra actions (L11). | Medium-high |
| Free effects | Automatic or reactive effects cost 0 AP: Rogue Assault, mines, auras, regeneration, Kulega and Queso triggers. | High |
| Flags to build in from day one | AP per turn, first-turn AP, approach boost on/off, escalation start round, carry-over cap. | n/a |

### 4.7 The commander-run win is very slow

> "Another way of winning is if you manage to bring your commander to the opposite side of the board. More specifically, to the last row." (L32)

- From the front of the normal zone (row 5) to the enemy's last row (row 25) is **20 steps, so 20 turns at movement 1.** From the back row it is 24 steps, or 26 from M1 on the proposed map, where the central blocker forces a detour.
- Extra actions cannot speed it up, because a unit moves only once per turn (L11). Queso makes every step cost 3 AP (L130), so about 60 AP in total.
- A 1/1 commander walking through the enemy half dies to the first enemy unit that sees it.
- **Conclusion: as written, this is a clean-up rule for the endgame** (the enemy has lost its army but is hiding its commander). It is not a strategy, and it will not break stalemates.

Options (owner's call, S21):
- Commander movement 2: about 10 turns.
- Win by ending your turn in the enemy's normal zone (rows 21-25) and surviving the opponent's next turn.
- Keep it as written, and use the domination win (S18) as the real stalemate-breaker.

**Default:** as written. The win happens the moment the commander enters any cell of the opponent's back row (row 25 for South, row 1 for North).

### 4.8 Stalemates

The spec has no turn limit and no tie-breaker. Default: no automatic limit. Resign and draw-by-agreement are available (Q38).

Because of D1 and D7, two careful players can produce games that never end. The suggested remedies, in order of preference:
1. **Objective domination** (S18).
2. **Late AP escalation** (option D).
3. **A hard turn limit with a tie-breaker:** army value destroyed, then objectives held.

---

## 5. Map and objectives proposal

### 5.1 The corner cut

> "The size of the battlefields are 25x25, where the corners are cut off with a radius of 4." (L30)

"Radius" could mean several shapes. All five readings, computed:

| Reading | Cells removed per corner | Playable cells | Last-row width | Normal-zone cells (rows 1-5) |
|---|---:|---:|---:|---:|
| **Rounded corner, keep cells fully inside a radius-4 arc (default)** | 8 | 593 | 17 | 109 |
| Rounded corner, keep cells whose centre is inside the arc | 3 | 613 | 21 | 119 |
| 45-degree cut, 4 cells along each edge (x+y <= 3) | 10 | 585 | 17 | 105 |
| Quarter-circle bite centred on the corner point | 13 | 573 | 17 | 99 |
| 45-degree cut, 5 cells along each edge (x+y <= 4) | 15 | 565 | 15 | 95 |

The default south-west corner (`#` = removed), rows 6 down to 1:

```
row 6   . . . . . .
row 5   . . . . . .
row 4   # . . . . .
row 3   # . . . . .
row 2   # # . . . .
row 1   # # # # . .
        A B C D E F
```

**Default:** the rounded reading with 8 cells per corner. It matches the word "radius", and the cut runs 4 cells along each edge. *Confidence: low (40%).*

The balance impact is small whichever reading wins. It only changes deployment capacity (95-119 cells) and the width of the last row (15-21 cells).

### 5.2 A 2x2 building cannot be placed fairly on 25 rows

A 2x2 building covers 2 rows, but the board has an odd number of rows, with row 13 in the middle. So no 2x2 placement is the same distance from both players, whether the map is mirrored top-to-bottom or rotated 180 degrees. Options:

- **(a) Default:** accept a 1-row offset, and cancel it across the pair. The Keep is one row nearer one player and the Market one row nearer the other, and the whole map is identical under a 180-degree rotation (which swaps Keep and Market). The player who moves second gets the side nearer the Keep, the stronger objective, as compensation.
- **(b)** Make the buildings 3x3, or 2 wide by 3 tall, centred on row 13. That is perfectly fair (S20).
- **(c)** Use an even-sized board (24x24 or 26x26).

### 5.3 Proposed default scenario: "Crossroads"

Columns are A-Y from left to right. Rows are 1-25 from the South player's back row. North is at the top.

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

Legend:

| Symbol | Meaning |
|---|---|
| `S` | South player's normal deployment zone (rows 1-5, 109 cells) |
| `s` | South extended zone (rows 6-7, 50 cells) |
| `N` | North player's normal deployment zone (rows 21-25) |
| `n` | North extended zone (rows 19-20) |
| `K` | The Keep (2x2, impassable) |
| `k` | The Keep's capture ring: the 12 cells within range 1, corners included |
| `M` | The Market |
| `m` | The Market's capture ring |
| `#` | Blocker (impassable) |
| `.` | Open ground |
| blank | Off the board (cut corner) |

Coordinates (0-indexed x,y are given for the engine; x = column, y = row - 1):

| Feature | Cells | 0-indexed |
|---|---|---|
| Keep | G13, H13, G14, H14 (ring F12:I15) | x 6-7, y 12-13 |
| Market | R12, S12, R13, S13 (ring Q11:T14) | x 17-18, y 11-12 |
| Centre cross (5) | L13, M12, M13, M14, N13 | |
| Lane dividers (8) | J10, J11, J15, J16, P10, P11, P15, P16 | |
| Forward rocks, South side (4) | E9, F9, T9, U9 | |
| Forward rocks, North side (4) | E17, F17, T17, U17 | |

That is 21 blocker cells in total.

Design intent:

- **Symmetry:** every blocker maps onto a blocker under a 180-degree rotation, (x,y) to (24-x, 24-y), and the Keep maps onto the Market. Deployment zones contain no blockers. Checked by script.
- **Two objective lanes and a broken centre:**
  - The centre cross stops a straight commander rush down the middle (+2 steps) and gives cover.
  - The J and P dividers split the middle third of the board into lanes, with 3-cell gaps at rows 12-14. Taking an objective is a commitment, but the two sides can still support each other.
- **Forward rocks** break up the first lines of approach and shield the flanks of each deployment zone.
- **Connectivity:** all 564 walkable cells connect. A 2x2 Beast can reach both rings and both back rows.
- **Light terrain:** 21 blockers is 3.5% of the board, so the first playtests measure the units rather than the terrain.
- **Blocker rules (default):** blockers and buildings block **movement only**. They do not block vision or ranged attacks, because the spec has no line-of-sight rule (Q35). A later "tall" blocker type that also blocks LOV would create ambush play.

Fairness check (shortest orthogonal paths, computed):

| From | To Keep ring | To Market ring |
|---|---:|---:|
| South normal-zone front (row 5) | 7 | 6 |
| North normal-zone front (row 21) | 6 | 7 |
| South extended-zone front (row 7) | 5 | 4 |
| North extended-zone front (row 19) | 4 | 5 |

| Other distances | Steps |
|---|---|
| Commander, front of normal zone to enemy last row | 20 (both sides) |
| Commander, back row to enemy last row | 26 from M1 / M25, 24 from I1 / I25 |
| Front of each normal zone to the other | 16 |
| Front of each extended zone to the other | 12 |

The first player plays South: they are nearer the Market and move first. The second player plays North, nearer the Keep. Each player is 6 steps from "their" objective and 7 from the other.

### 5.4 The Keep

> "The keep: While the keep is active, all units receive a bonus of 3 power." (L52)

Open questions:
- Whose units get the bonus?
- Does "active" mean "controlled"?
- Does it include the commander and summoned units?
- Does it change ability damage?

**Default:**
- "Active" means controlled: from the moment a player captures it until the opponent recaptures it.
- **Only the controlling player's units benefit**, including the commander and summons.
- +3 applies to Power: basic attacks and anything defined by Power.
- It does not change fixed-damage abilities: Smite 8, Slam 10/3, Pajazon 3, mines 5, Julio Vernification.
- *Confidence: medium-high for controller-only, medium for the rest.*

**Why not both players:** a bonus for everyone gives nobody a reason to capture it. It would still favour whoever has more cheap units, because they gain the most from a flat +3.

Size of the bonus relative to base power:

| Unit | Bonus |
|---|---|
| Footman, Artificer | +300% |
| Soldier, Mercenary | +150% |
| Ranger, Priestess, Juliomancer | +100% |
| Rogue | +43% |
| Wizard | +30% |
| Berserker, Paladin | +25% |
| Emissary, Scourge | +20% |
| Beast | +15% |
| Dummies | 0 becomes 3 |

Thresholds it moves:
- A Ranger (6) kills a Rogue in 1 hit (was 2) and a Soldier in 2 (was 3).
- A Soldier (5) kills a Soldier in 2 (was 4).
- A Footman (4) kills a Footman in Line Formation in 1 hit (was 2).
- Against a Paladin, a 4-power Footman still deals 1.

Model: Mixed-52 holding the Keep beats Mixed-52 whether it strikes first or second, in 5-6 rounds. Without the Keep, the first striker wins in 10. **The Keep is a swarm amplifier that lasts until someone retakes it.**

### 5.5 The Market

> "The market: While the market is active, all type-1 unit have an additional action per turn." (L53)

**Default:**
- Only the controller's type-1 units: Footman and Mercenary. Not the commander, not dummies, not Sabrina's Artificers.
- The extra action costs AP as usual and can never be a second move (L11).

What it is worth:
- **Tempo, not extra actions.** Under a fixed pool you cannot take more actions in total, but a Mercenary can now walk in and strike in the same turn, which breaks D7, or strike twice.
- **Nothing** for an army without type-1 units.
- Like the Keep, it favours swarms, so **both objectives reward the same kind of army.**

Suggestion S19: make the Market "+2 AP per turn". That is an economy bonus useful to every army, it speeds the game up, and it pulls the two objectives toward different armies.

### 5.6 Capture rules (defaults)

- The ring is the 12 cells within range 1 of the building, corners included (L45).
- Control is checked at the end of every player turn:
  - If exactly one player has at least one unit in the ring, that player controls the building.
  - If both players or neither do, nothing changes.
  - Control stays when units leave.
- Stealthed units neither capture nor contest; they must be revealed first.
- Summoned dummies count. Mines do not.
- Buildings are impassable, but do not block vision or ranged attacks.
- *Confidence: medium; low for the stealth rule.*

---

## 6. Commander notes

| Commander | Tier | One-line reason |
|---|---|---|
| Trill "The Hydrocephalic" | **S** | Free +2 toughness on the most efficient units, and a commander that cheap ranged units and Smite cannot snipe. |
| Queso "The Beacon of hope" | **A-** | Up to 60 free healing per turn around a toughness-3 commander. |
| Sabrina "The Reelfinisher" | **B+** (possibly A) | 10-coin Artificers plus 12 dummies is a fast, tough army. |
| Kulega "The Fine Printer" | **B** | +1 vision matters a lot under fog; the heal suits Paladin cores. |
| Ratasius I "The Great" | **C** | Vision and stealth detection, but still a 1/1 commander. |
| Baba Yaga "The Bwitch" | **D** | At most 4 toughness healed per 4 AP, every other turn; "white" is undefined. |

**Trill (S)**
- Spec: "All units of type 1, 2, 5 gain 2 toughness. The commander has toughness 10." (L124)
- Result: Footman 1/4, Mercenary 2/3, Soldier 2/9, Ranger 3/3, Berserker 12/4, Rogue 7/6.
- Thresholds: Footmen and Berserkers rise above the 3-damage area attacks (Slam splash, Pajazon). A Footman in Line Formation takes 1 from them. A toughness-10 commander survives Smite, mines, three Ranger shots and Julio sacrifices of small units.
- Model: Mixed-30 goes from 62% to 88% against the capped field.
- Suggestion: +1 toughness (or +2 for types 1-2 only), and commander toughness 6 (S12).

**Queso (A-)**
- Spec: commander AP 3 and toughness 3. Units within range 2 regenerate 5 each own turn. A unit that dies in that area can be revived by "sacrific[ing] 1 max toughness" (L130).
- Strength: up to 12 units x 5 = 60 free healing per turn. Any unit with toughness 6 or more near Queso shrugs off chip damage. Two revives.
- Weaknesses:
  - The aura is centred on the commander, who dies to one Ranger shot or one 3-damage splash tick.
  - Moving him costs 3 AP, so a commander run would cost about 60 AP.
- Model: +7 points for Mixed-30. The model kills its targets within one turn, which undervalues healing.
- Ambiguity: whose max toughness is sacrificed? Default: Queso's own, so at most 2 revives. Does the aura include Queso? Default: yes (Q25).
- Suggestion: regen 3, or 5 for at most 4 units (S16).

**Sabrina (B+)**
- Spec: Artificers and dummies get +2 power. Artificers become type 10 and can't lay mines. Every other type-20 or higher unit costs 20% more (L126).
- Costs under Sabrina: Paladin 24, Wizard and Beast 60, Emissary and Scourge 120.
- The army: 20 Artificers (3/15, AP 1, movement 2) raise the dummy limit to 3 + floor(19 / 2) = 12. Dummies are 2/7, or 3/7 and mobile next to an Artificer.
- Model, against the capped field: 25% with no dummies built, 69% with all 12 out. Building them takes about 24 AP, two full turns.
- Artificers are the best walkers in the game (2 squares per AP), so this army avoids the march problem (4.3).
- Watch: dummies as free bodies (AP armor, D1) and as Juliomancer ammunition (7 damage each).

**Kulega (B)**
- Spec: "All units gain 1 LOV. All units of type-20 gain the following ability: When a unit of type 1 or 2 dies adjacent to this unit, regenerate toughness equal to that creature toughness, maximum of 4 per instance." (L125)
- Vision:
  - Footmen and Mercenaries go from LOV 1 to 2, so they can see their diagonal neighbours. With LOV 1 they see only the 4 orthogonal cells, so a diagonal attacker can be invisible to them.
  - Under fog with move-or-attack, seeing one square further than the enemy lets you choose where fights start (D7). That is stronger than it looks.
- Heal: it turns a Paladin ball, already the winner of capped fields, into a self-healing one. Every Soldier death next to a Paladin heals it 4.
- Ambiguity: do enemy deaths trigger it? Default: yes, any unit (Q21).

**Ratasius I (C)**
- Spec: commander LOV 6. Reveals invisible enemies within range 3. Adjacent enemies "deal 4 less damage" (L129).
- He is still 1/1. With the minimum of 1, the weakness never saves him. It only protects allies hit by enemies standing next to him.
- LOV 6 is a real scouting edge, and the reveal shuts down Rogue assassins.
- Suggestion: commander toughness 4-5, weakness range 2, or let the weakness reduce damage to 0 (S14).

**Baba Yaga (D)**
- Spec: "Units of white gain the ability to regenerate 2 toughness for 2 AP (each instance). Only up to 2 units can regenerate toughness this way per turn. Can be applied twice to the same unit. CD 1" (L128).
- Best case: 4 toughness healed for 4 AP, every other turn. For comparison, a Soldier regenerates 1 per turn for free and Queso heals up to 60 per turn for free.
- Ambiguity: "white" is never defined. The token colour shows the grade (L44), but there is no colour table. The tight limits (2 per turn, cooldown) suggest it was meant for a broad group of units.
  - Default: all allied units except the commander (Q23). *Confidence: low.*
- Suggestion: 3 toughness for 1 AP, up to 3 per turn, no cooldown. Or define "white" as one grade and give that grade a bigger bonus (S13).

**Cross-cutting:**
- With a 1/1 base commander, a commander's own body matters more than most of its bonuses. The real snipe defences today are Trill's toughness 10, Queso's toughness 3 (barely), and Ratasius' stealth detection.
- A base toughness of 5 (S15) would make the choice between commanders about strategy rather than survival.

---

## 7. Questions, each with a default

Each row: the spec text, the question, the default implementation can use now, and how confident I am in that default. Rows marked **(B)** change the balance numbers in this document noticeably.

| # | Spec (line) | Question | Default | Confidence |
|---|---|---|---|---|
| Q1 **(B)** | "that player will receive a number of Action points" (L9) | How many AP per turn? | 12, fixed, as round(0.06 x budget). Unspent AP is lost. The first player gets 6 AP on turn 1. | Medium |
| Q2 | "use those action costs to use a number of units" (L9) | What costs the unit's AP? | Each action (move, attack, defend, ability) costs the acting unit's AP. One action per unit per turn (L35). | High |
| Q3 **(B)** | "A unit can only use one action per turn" (L35); "can only move once per turn" (L11) | Can a unit move and attack in the same turn? | No: move, attack, defend or ability. L11 also means an extra action can never be a second move. See S17. | High (literal reading) |
| Q4 | "Ability:AbilityCost:Description" (L57), e.g. "Stealth:1" (L81), "Forceful slam:4" (L110) | Does an ability's cost replace or add to the unit's AP? Is using it the unit's action? | It replaces the unit's AP, and it is the unit's action for the turn. Passive (P) and reactive effects are free. | Medium |
| Q5 | "Shared wounds: Sacrifice half of adjacent unit's (or itself) hp" (L87) | No cost listed. Half of current or max? Rounding? | 2 AP. Half of *current* toughness, rounded down, minimum 1. The source cannot die from it. Healing up to base max. | Medium-low |
| Q6 **(B)** | Holy Fervor (L117), Command Aura (L120), Market (L53), Savagery (L78) | Do extra actions cost AP? | Yes: the unit's AP, plus 1 for Holy Fervor's second action, and 2 for Savagery as written. Never a second move. | Medium-high |
| Q7 | "CD 1 turn" (L106, L107, L110), "CD 1" (L128) | What does cooldown 1 mean? | Used on your turn N: unavailable on N+1, available again on N+2. | Medium |
| Q8 | "defend (a defending unit receives half the damage rounded up(never less than one))" (L15) | How long does Defend last, and what does it cost? | Costs the unit's AP. Lasts until the start of its owner's next turn. | Medium-high |
| Q9 **(B)** | L15, L64, L95, L106, L129 | In what order do modifiers apply? Is there always a minimum of 1? | Power bonuses, then flat reductions, then Defend halves (rounded up), then minimum 1 per hit. The minimum also applies to Forcefield and weakness. A 0-power unit cannot attack. Healing never exceeds max toughness unless the text says so. | Medium |
| Q10 | "movement (1 square by default, including diagonals)" (L15) vs "The movement is orthogonal, a movement-piece cannot be diagonal." (L34) | Can units step diagonally? | No, orthogonal steps only. L34 is the more detailed rule and includes an example. | Medium-high |
| Q11 **(B)** | "the 5 opposite adjacent squares" (L110); "range of 1(including corners)" (L45); "A LOV of 1 will only show the 4 orthogonal adjacent squares" (L37) | What does "adjacent" mean (melee reach, auras, Line Formation, pack bonus, sacrifices)? What does "range N" mean? | Adjacent = the 8 surrounding cells. Range and LOV = Manhattan distance (diamond). | Medium |
| Q12 | "corners are cut off with a radius of 4" (L30) | Which exact cells? | Rounded corner, keep cells fully inside a radius-4 arc: 8 removed per corner (5.1). | Low |
| Q13 | Beast "Size 2" (L109) | Footprint? | 2x2. It is adjacent to the 12 cells around it, cannot pass 1-wide gaps, and takes 4 deployment cells. Mines deal it +5 (L101). | Medium |
| Q14 **(B)** | "Deal 1 extra damage for each Mercenary that is adjacent to the attacked unit" (L67) | Does the attacker count itself? Is there a cap? | Other Mercenaries only. No cap, as written (see S9). | Medium |
| Q15 | "If there's another 2 adjacent Footmen" (L64) | Exactly how many? | At least 2 other Footmen among its 8 neighbours. | Medium |
| Q16 | "units adjacent to priestess, gain additional 1 power and 1 toughness" (L86) | Allies only? Do auras stack? What happens when a unit leaves? | Allies only. No stacking. On leaving, max and current toughness both drop by 1, but never below 1. | Medium |
| Q17 **(B)** | "Sacrifice an adjacent unit" (L91, Julio; L111, Feast) | Can enemies or the commander be sacrificed? Is Feast capped? | Allied, non-commander units only (summons are fine). Feast heals up to the Beast's base max. | High (ally-only), low (cap) |
| Q18 | Dummy limit, mine limit, Mind's Eye (L98-101) | Exact formulas? What are summons? | Dummies: 3 + floor((Artificers - 1) / 2). Mines: 5 + (Artificers - 1). Summons have no type, so no Trill or Market bonus. They don't count toward the budget or a unit cap, but they do count as units for objectives and the Keep. Mind's Eye also reveals mines in LOV. | Medium |
| Q19 | "Mines can be triggered from distance by attacking the square with a ranged attack." (L101) | Can you attack a square you don't know is mined? | Yes. Any ranged unit may attack an empty square in range. | Medium |
| Q20 | Commander rules (L32) and "all units" effects (L52, L125) | Is the commander a "unit" for "all units" effects? Does it have a type? | Yes for "all units" and aura effects (Keep, Kulega LOV, Priestess, Queso). It has no type, so no Trill or Market bonus. | Medium |
| Q21 | "When a unit of type 1 or 2 dies adjacent to this unit" (L125) | Allied deaths only, or enemy deaths too? | Any unit. The heal equals the dead unit's base toughness, at most 4, and never above max. | Low |
| Q22 | "Artificers now are considered type 10" (L126) | Does the cost change too? | Yes: cost 10 and type 10 everywhere. Other type-20+ units cost +20% (24, 60, 120). | High |
| Q23 **(B)** | "Units of white gain the ability..." (L128); "The color of the token will represent the grade" (L44) | Which units are "white"? What is the grade-colour table? | All allied non-commander units, until a colour table exists. | Low |
| Q24 | "Enemies in range of 1 gain weakness and deal 4 less damage" (L129) | Less damage to whom? Is there a floor? | All damage those enemies deal, to any target, with a minimum of 1. | Medium-low |
| Q25 | "This commander's AP is 3, and 3 toughness ... sacrifice 1 max toughness to revive" (L130) | Is AP 3 an action cost or bonus AP? Whose max toughness is sacrificed? Does the aura include Queso? When does it heal? | Action cost 3, not bonus AP. Queso's own max toughness, so at most 2 revives. The aura includes Queso. Healing happens at the end of his owner's turn. | Medium (AP), low (rest) |
| Q26 **(B)** | Deployment zones (L29-31) | Must every purchased unit fit in the deployment zone? | Yes. The army builder rejects armies that can't be deployed: 108 size-1 slots in the normal zone after the commander, plus extended cells for vanguard units. | Medium |
| Q27 **(B)** | "Some units can be deployed in the extended deployment area" (L29) | Which units? | Rogue and Ranger ("Vanguard"). Never the commander. | Low |
| Q28 | "The player first chooses the units..." (L28) | Are armies chosen at the same time, and hidden? | Both players choose at the same time, blind. Armies stay hidden until seen through fog. Deployment is also simultaneous and hidden. | Medium |
| Q29 | "must spend that money" (L3) | What happens to unspent coins? | They are lost: no refund, no bonus. | High |
| Q30 | "### The Empire" then "### Lojrar Clan" (L59-60). The commanders come in two groups of 3 (L124-126, L128-130). | Which faction owns the 14 listed units? Is the commander split by faction? | One shared roster and all 6 commanders available to both factions. Faction is cosmetic for now (section 9). | Low |
| Q31 **(B)** | "While the keep is active, all units receive a bonus of 3 power." (L52) | Whose units? What does "active" mean? | The controller's units only, including commander and summons. "Active" = controlled. +3 to Power, not to fixed-damage abilities (5.4). | Medium-high |
| Q32 | "all type-1 unit have an additional action per turn" (L53) | Whose units? Does it cost AP? | The controller's type-1 units. The extra action costs AP and can't be a second move. | Medium |
| Q33 | "conquered when at least one unit, without opposition, is in range of 1" (L45) | When is capture checked, and how? | At the end of every player turn. If exactly one side is in the ring, that side controls it. Control stays when units leave. | Medium |
| Q34 | L45 and "This unit becomes invisible" (L81) | Can stealthed units capture or contest? | No. They must be revealed first. | Low |
| Q35 | "There may be a scenario with blockers." (L13); buildings (L45-46) | What do blockers and buildings block? | Movement only. Not vision, not ranged attacks. | Medium |
| Q36 | "two optional objectives: The keep, The market" (L45) | Optional in what sense? | On the default map by default, with a lobby toggle to turn them off. They are never required for victory. | Medium-low |
| Q37 | "to the last row" (L32) | Which row, and when does the win count? Where may the commander deploy? | The opponent's back row (row 25 for South, row 1 for North). Win the moment it enters. Commanders deploy in the normal zone only. | High |
| Q38 **(B)** | (no rule) | Is there a turn limit or a stalemate rule? | No automatic limit. Resign and draw-by-agreement exist (4.8, S18). | Medium |
| Q39 | (no rule) | Can units move through other units? | Through allies yes, through enemies no. A unit can't end its move on an occupied cell. | Medium |
| Q40 | Holy blessing (L115), Smite (L116), Julio (L91), Pajazon "center at range 3" (L107) | Does the caster heal itself? Must the target be visible? | Holy blessing includes the Emissary itself. Single targets must be visible (shared vision) and in range. "At range 3" means up to 3. | Medium |
| Q41 | "Only activate this ability if not inside the LOV of another enemy creature" (L81) | When can a Rogue stealth? Does moving break it? | Only when no enemy unit can currently see it. Moving keeps stealth; only the listed conditions reveal it. | Medium |
| Q42 | "When an enemy unit comes into the melee range of this unit, if this unit is in stealth, perform an automatic attack" (L82), and "revealed when it's 1 square away" (L81) | Which happens first, the Assault or the reveal? Does the Assault happen against every unit that comes close? | The Assault resolves first (it's an ambush), then the Rogue is revealed. So once per stealth. | Medium |
| Q43 | "Choose 4 adjacent squares in wizards LOV" (L106) | What shape? For how long? | Any 2x2 block inside the Wizard's LOV. Lasts until the start of your next turn. | Low-medium |
| Q44 | "Create an area of 3x3 ... for 2 turns" (L107) | How many ticks? | 4 ticks: allies +3 at the end of your turn, enemies -3 at the end of the opponent's turn, twice. Heals never exceed max. | Medium-low |
| Q45 | "3 damage to the 5 opposite adjacent squares of the target" (L110) | Does Slam splash hit your own units? | Yes, it hits every unit in those squares. | Low-medium |
| Q46 | Turn order (no rule) | Who moves first, and on which side? | Coin flip. The first player deploys South and has 6 AP on turn 1 (4.6). | Low-medium |

---

## 8. Suggestions (the owner's call; no default assumes any of these)

Ordered by expected value within each group. "Priority" is my recommendation for what to try in the first playtests.

### Economy and pace

| # | Suggestion | Why | Priority |
|---|---|---|---|
| S1 | **Approach boost and late escalation** (option D in 4.5): double AP until first contact; +1 AP per round from round 20. | Fixes the march (4.3) and stalemates (4.8) with two switchable rules. | High |
| S2 | **Group march:** for 2 AP, up to 6 connected units that haven't acted each move 1 square in the same direction. This counts as their move and their action. | The alternative to S1. It lets infantry advance as a block. In Mixed-30, the 22 movement-1 units advance 6 rows for 48 AP instead of 132, and the whole army for about 95 AP instead of 179. | Medium (pick S1 or S2) |
| S3 | **Unit cap of 30 per army**, summons not counted (or 40). | The strongest single lever against body-count dominance (D1). Halves turn length and on-screen clutter. Makes the top tiers worth their slot. Needs S7, or the Paladin takes over (2.4). | High |
| S4 | **Turn timer** for online play, for example 90 seconds plus a small time bank. | Keeps 24-40 turn games inside 45 minutes. | Medium |
| S5 | **Stats as data** (unit and commander definitions in JSON) **plus match logging** (army, commander, winner, rounds, win condition). | Tuning without code changes; real win rates replace this model. | High (cheap) |

### Unit tuning

| # | Suggestion | Why | Priority |
|---|---|---|---|
| S6 | **Berserker 8/2** (Savagery unchanged). Alternatives: keep 12/2 but make it AP 2 with Savagery at 3 AP, or allow Savagery only after a kill. | Brings it to 1.6 power per coin and 8 damage per AP. It still kills every cheap unit in one hit, so its identity stays. | High |
| S7 | **Paladin 10/18, armor 2.** | Armor 2 lets attackers with 4-7 power (Keep-buffed Footmen, pack Mercenaries, Rogues) deal 1-2 more per hit. 18 toughness removes about one hit of margin. Tested together with S6: the capped-field win rate falls from 93% to 79% (2.4). | High if S3 |
| S8 | **Soldier 2/5** (regen unchanged). | Toughness per coin drops from 3.5 to 2.5, in line with the Footman's 2.0 plus Line Formation. Only needed without S3. | Medium |
| S9 | **Cap the Mercenary pack bonus at +3**, or count only orthogonal neighbours. | Keeps the swarm identity but removes the 13-damage hits on the Beast (D8). | Medium |
| S10 | **Give the 50 and 100 tiers jobs that matter under a fixed AP pool.** Scourge: "+2 AP per turn while alive", or the first extra action from Command Aura each turn costs 0 AP. Emissary: Smite also deals 3 to the 4 orthogonal neighbours of its target, or Holy blessing also gives +1 power until your next turn. Royal Wizard: 10/24. | Under AP saturation, single-target elites lose to bodies (2.3). Elites that generate AP or hit areas compete on their own terms. | High (after the first playtest) |
| S11 | **Ranger:** watch first. If it dominates open maps, go to 2/1 or LOV 2. | Kiting under move-or-attack (2.5) isn't captured by the model. | Low (watch) |

### Commanders

| # | Suggestion | Why | Priority |
|---|---|---|---|
| S12 | **Trill:** +1 toughness for types 1, 2 and 5 (or +2 for types 1-2 only); commander toughness 6. | Brings the strongest commander (+26 points in the model) back toward the field. | High |
| S13 | **Baba Yaga:** regenerate 3 toughness for 1 AP, up to 3 times per turn, no cooldown. Or define "white" as one grade and give that grade a bigger bonus. | Right now she is the weakest commander by a wide margin. | Medium |
| S14 | **Ratasius I:** commander toughness 4-5; weakness at range 2, or allowed to reduce damage to 0. | His defensive aura currently cannot save him. | Medium |
| S15 | **Base commander toughness 5.** Adjust the others: Queso 6, Trill 10-12. | Ends one-shot snipes by Rangers and weak units, while real threats (Smite, Rogue, Berserker, Paladin, a Juliomancer using a Soldier) still kill in one action. Fewer abrupt endings. Less need to bury the commander, which weakens D1. | High |
| S16 | **Queso:** regenerate 3 instead of 5, or 5 but only for the 4 most damaged units. | Takes the edge off the regen turtle (D12) and keeps his identity. | Low-medium |

### Rules

| # | Suggestion | Why | Priority |
|---|---|---|---|
| S17 | **Charge:** a unit with movement 2 or more may move up to (movement - 1) squares and then attack, as one action costing its AP + 1. | Directly reduces the defender's advantage (D7) and gives the fast units (Paladin, Rogue, Beast, Emissary) a purpose. Keeps "one action per turn". | High |
| S18 | **Domination win:** control both the Keep and the Market at the start of 5 of your consecutive turns. | A real reason to leave the turtle (D1). Gives objectives teeth without making them mandatory. Matches the spec's own words "conquest or domination" (L45). | High |
| S19 | **Keep:** +1 power to all your units, or +3 only to your units within range 3 of the Keep. **Market:** +2 AP per turn, with or without the type-1 extra action. | Pulls the two objectives toward different armies (the Keep for fighters, the Market for everyone's economy) instead of both rewarding swarms (D5, 5.5). | Medium |
| S20 | Make both buildings 3x3, or 2 wide by 3 tall, centred on row 13. | Perfect symmetry; the cross-offset compensation in 5.2 becomes unnecessary. | Low (the default works) |
| S21 | **Commander run:** commander movement 2, or win by ending your turn in the enemy's normal zone (rows 21-25) and surviving their next turn. | Today the run takes 20 turns or more (4.7). Either version turns it into a real threat that the defender must answer. | Medium |
| S22 | **Show both army lists after selection, before deployment.** | The roster has hard counters: Pajazon against swarms, Rangers against Berserkers, Paladin armor against cheap units. Blind picks turn games into rock-paper-scissors. Seeing the lists moves the skill into deployment. | Medium |
| S23 | **A distinct Lojrar Clan roster** (section 9). | Gives the second faction an identity beyond cosmetics. | Owner's roadmap |

---

## 9. Lojrar Clan roster direction (suggestion S23)

> "### The Empire" / "### Lojrar Clan" (L59-60)

The 14 units are listed straight after an empty Empire heading, under "Lojrar Clan". The default (Q30) treats them as one shared roster until a second roster exists.

If the owner wants a distinct second faction, here is a direction.

**Identity contrast**

- If the existing roster is The Empire's, its theme is armor, formations, healing, wizardry and command auras. It wins long fights and holds ground.
- **Lojrar Clan** would be a feral warband: speed, ambush, sacrifice, beasts and totems. It wins short, violent fights and is weak at holding ground.

**One faction rule, chosen to solve a structural problem rather than add one**

- **"Warpath":** Lojrar units with movement 1 move 2 squares when they start the turn with no enemy unit inside their LOV. Their infantry gets to the fight (4.3), the faction gets a tempo identity, and the rule switches off on contact.
- Alternative: **"Bloodprice":** each enemy unit killed by a Lojrar attack gives +1 AP next turn, at most +3. More aggressive, but it snowballs.

**Guardrails**

- The same 7 grades with 2 units each, and the same budget and AP economy.
- Every unit inside the bands of the tuned Empire roster: sqrt(PxT) per coin no higher than the Footman's 1.41 for types 1-5 (avoid the Soldier's outlier 1.87); basic damage per AP of 8 or less.
- No unconditional free actions.
- Coverage the faction must have:
  - At least one answer to stealth (the Empire has two Mind's Eye units).
  - At least one area attack against swarms.
  - One ranged unit in types 1-5.
  - One AP or tempo engine in types 50/100, so that the top tiers matter under AP saturation (S10).

**Sample roster** (illustrative numbers, same format as L57):

| Type | Unit | P/T, Size, LOV, Mv, AP | Ability | sqrt(PxT) per coin |
|---:|---|---|---|---:|
| 1 | Wolfling | 1/1, 1, 2, 2, 1 | Pack Hunt (P): +1 power if another Wolfling is adjacent to the target (at most +2). | 1.00 |
| 1 | Thrall | 1/2, 1, 1, 1, 1 | Blood Offering (P): when it dies, adjacent allies regenerate 2. | 1.41 |
| 2 | Slinger | 2/2, 1, 3, 1, 1 | Ranged attack (P): range 2; deals 1 less to adjacent targets. | 1.00 |
| 2 | Bog-Warden | 1/5, 1, 2, 1, 1 | Entangle (P): enemies that start their turn adjacent to it have movement 1. | 1.12 |
| 5 | Raider | 5/3, 1, 2, 2, 1 | Hit and Run:1: after attacking, move 1 square. This is its one move for the turn. | 0.77 |
| 5 | Bonecaller | 2/5, 1, 3, 1, 2 | Raise:2: create a 1/2 Thrall on a cell where a unit died since your last turn (at most 2 active). Mind's Eye (P). | 0.63 |
| 10 | Totem Carver | 2/12, 1, 2, 1, 2 | Carve Totem:2: an immobile 0/8 totem; allies adjacent to it get +1 power (at most 2 totems; no stacking). | 0.49 |
| 10 | Skinchanger | 5/10, 1, 3, 2, 2 | Shift:1: Bear form 8/14 with movement 1, or Hawk form 2/6 with movement 3 and LOV 5. Damage taken carries over. | 0.71 |
| 20 | Warchief | 9/18, 1, 2, 2, 2 | Warcry:2, CD 1: allies within range 2 may each move 1 square now, for free. This is their one move for the turn. | 0.64 |
| 20 | Stone Troll | 7/28, 1, 1, 1, 2 | Regrowth (P): regenerate 3 at the end of your turn. | 0.70 |
| 50 | Mammoth Rider | 16/36, 2, 3, 2, 3 | Trample:3, CD 1: move up to 2 squares through size-1 enemies, dealing 4 to each one passed. | 0.48 |
| 50 | Elder Shaman | 6/22, 1, 3, 1, 3 | Storm Call:3, CD 1: 4 damage to every unit in a 1x5 line starting within range 3 (hits allies too). | 0.23 |
| 100 | Avatar of Lojrar | 18/45, 1, 3, 2, 3 | Rampage (P): after it kills a unit, it may attack again for 2 AP (at most 2 extra attacks per turn). | 0.28 |
| 100 | Hunt-Mother | 8/30, 1, 4, 2, 3 | Call of the Hunt (P): allies within range 3 get +1 movement, and you get +2 AP per turn while she lives. | 0.15 |

**Commanders:** the spec lists commanders in two groups of three (L124-126 and L128-130). If that split is meant to be per faction, say so (Q30). If not, Lojrar could get three of its own commanders, built around Warpath, sacrifice and totems.

---

## Appendix A. Method and reproducibility

- The numbers come from throwaway Python scripts in the session scratchpad. They are not part of the repository. They computed:
  - Board geometry under five corner readings, and path lengths (orthogonal BFS, including a 2x2 footprint for the Beast).
  - The map's symmetry and connectivity checks.
  - The unit metric and turns-to-kill tables.
  - The attrition model described in section 1.
- To rebuild the model: write the engine's combat rules as pure functions (damage pipeline, AP spending, end-of-turn effects). Then an AI-vs-AI harness can replace this model with real games, including movement, fog and abilities, and re-run sections 2.4 and 4 on every balance change.
- Every number in this document is under the defaults of section 1 and section 7. If a default changes, the direction of the findings usually stays the same, but the exact figures will move.

