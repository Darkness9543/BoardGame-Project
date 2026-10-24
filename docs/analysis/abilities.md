# Abilities - Implementable Rules (Ability-Implementer Lens)

Source: `docs/SPEC.md` (owner spec, verbatim, 2026-10-24). This document turns every unit ability, the created objects (No-ACB dummy, Trip Mine), the Commander and all six commanders into precise, implementable rules: trigger, timing, targeting, cost, cooldown, duration, stacking, fog-of-war / invisibility interaction, and edge cases.

Status: PROPOSAL. Nothing here overrides the owner. Wherever the spec is silent or ambiguous, a **Default** is proposed so implementation is not blocked. Each default carries a confidence tag:

- **[H]** high - strongly implied by the spec text; unlikely to change.
- **[M]** medium - the most reasonable reading, but another reading is plausible.
- **[L]** low - a placeholder / design choice; the owner should confirm (the important [L] items reappear in section 5).

Decision IDs (e.g. `G-07`, `ROG-3`) are stable so tickets, tests and code comments can reference them. Spec text is quoted verbatim in `>` blocks; everything else is my proposal.

## Contents

- 0. Global rules every ability relies on (`G-xx`)
- 1. Factions: two factions, one roster (`FAC-xx`)
- 2. Units - one section per unit, plus the No-ACB dummy, the Trip Mine and the Commander
- 3. Commanders - one section per commander
- 4. Cross-ability interaction rulings
- 5. Questions for the owner (ranked by impact)
- Appendix A. Tunable constants

---

## 0. Global rules every ability relies on

Abilities cannot be specified without a few engine-wide rules the spec leaves open. These are stated once here and referenced from the unit sections.

### 0.1 Vocabulary

- **G-01 Grade / type.** "type-N" means the unit's denomination N in {1, 2, 5, 10, 20, 50, 100}. Deploy cost = N budget points. **[H]** ("Each unit represents a coin", budget 200.) Created things (No-ACB dummy, Trip Mine) and the Commander have **no type**: they never satisfy a "type-X" condition and cost nothing. **[M]**
- **G-02 Unit vs object.** A *unit* is anything with Power/Toughness on the board: the 14 roster units, the No-ACB dummy and the Commander. A *Trip Mine is not a unit*: it is a hidden board object with no P/T; it cannot be attacked, healed, buffed or sacrificed and does not count for adjacency effects. **[M]**
- **G-03 Allegiance.** "ally / allied / friendly" = controlled by the same player; "enemy" = controlled by the opponent. Unqualified "units" in a *beneficial* effect means friendly units only. In a *harmful square/area* effect, it means every unit on those squares (friendly fire) unless the text says "enemy". **[M]** This one rule answers most of the "ally or enemy?" questions below.
- **G-04 Active player** = the player whose turn it is; the other player is the *non-active* player.

### 0.2 Distance, range, adjacency

- **G-05 Metric = Manhattan (orthogonal steps). [M]** Evidence: LOV ("A LOV of 1 will only show the 4 orthogonal adjacent squares. A LOV of 2, will show 12 squares around the unit") is exactly a Manhattan radius; movement ("The movement is orthogonal, a movement-piece cannot be diagonal") is Manhattan; the objectives line says "in range of 1(including corners)", which only needs saying if range normally *excludes* corners.
  Conflict to resolve: line 15 says movement is "(1 square by default, including diagonals)". Implement the metric behind one switch, `ADJACENCY = ORTHO_4 | KING_8`, so the owner can flip it without touching ability code.
- **G-06 Range words. [M]** "Adjacent", "melee range" and "1 square away" all mean distance 1 (the 4 orthogonal neighbours). "Range N", "in a range of N", "within N" and "at range N" all mean distance **<= N**, not exactly N. Distance 0 (the unit's own square) is inside every range.

  Range 2 / LOV 2 under the default metric (12 squares, as the spec says):

  ```
  . . 2 . .
  . 2 1 2 .
  2 1 U 1 2
  . 2 1 2 .
  . . 2 . .
  ```

- **G-07 Size 2 = 2x2 footprint. [M]** The distance from or to a multi-square unit is the minimum over its cells. A 2x2 unit's adjacent squares are the 8 orthogonal neighbours of the footprint (diagram below). A 2x2 unit counts as "in" an area or square set if any of its cells is in it, and it is affected **at most once** per effect instance. **[M]**

  ```
  . a a .
  a B B a      B = 2x2 unit, a = its 8 adjacent squares (ORTHO_4)
  a B B a
  . a a .
  ```

- **G-08 Geometric shapes ignore G-05.** Shapes the spec defines geometrically use the 8-neighbourhood: the Pajazon "3x3" area (9 squares) and the Forceful slam splash pattern (section 2.14). **[M]**

### 0.3 Turn structure and timing windows

- **G-09 Turn phases. [M]** A *turn* is one player's turn; a *round* is both players' turns. "Your turn" means the turn of the player who controls the effect. Each turn has three phases:
  1. **Start of turn:** durations that end "at the start of your turn" expire; per-turn counters reset (actions used, Savagery, Baba Yaga uses); cooldown readiness is recomputed.
  2. **Main phase:** the active player spends AP on actions in any order, interleaving units freely.
  3. **End of turn:** end-of-turn triggers fire (Soldier, Pajazon, Queso).
- **G-10 Simultaneous triggers.** The non-active player's effects resolve first, then the active player's (MTG "APNAP" order). Within one player's effects, damage resolves before healing. **[M]** Example: at the end of the opponent's turn, my Pajazon damage hits their units *before* their Soldier regen and Queso heal. Capped heals commute, so their order among themselves never matters.
- **G-11 Reactions during the opponent's turn.** Only two exist: Rogue **Assault** (automatic) and **Queso's revive** (a choice). The server pauses the active player and shows the reacting player a prompt with a timeout (`REACTION_TIMEOUT_S`, default 20 s). On timeout the answer is "decline". **[M]**

### 0.4 Actions and AP

- **G-12 AP income is undefined.** The spec only says "In each player's turn, that player will receive a number of Action points." Placeholder: `AP_PER_TURN = 10`, and unspent AP is lost at end of turn. **[L]** All ability costs below are relative to this number (see Q-02).
- **G-13 One action per unit per turn. [H]** ("A unit can only use one action per turn, unless stated otherwise.") The actions are Move, Attack, Defend, and every non-passive ability. "Besides special powers, all units ... share the actions of movement, attack ... and defend" lists special powers alongside the basic actions, so using an active ability *is* the unit's action.
- **G-14 What an action costs.** Move, Attack and Defend cost the unit's AP stat. An active ability costs its listed AbilityCost **instead of** the unit's AP stat, not on top of it. **[M]** An active ability with no cost listed (Priestess *Shared wounds*) costs the unit's AP stat. **[M]**
  - **"P" means passive:** always on, no AP, not an action, cannot be switched off. **[H]**
  - Cost-less abilities that are clearly triggered or static (Assault, Mad inventor, Holy Fervor) are free and do not use the unit's action. **[M]**
- **G-15 Extra actions grant a permission, not AP. [H]** Market, Command Aura and Holy Fervor let a unit take one more action, and that action is paid normally. Extra actions from *different* sources add up: a Footman in a Market zone and in Command Aura gets 3 actions. **[M]** The *same* named source never counts twice: two Scourges still give +1. **[M]**
- **G-16 "Move once" still applies with extra actions. [H]** ("Unless stated otherwise, a single unit can only move once per turn.") Two actions may be Move+Attack, Attack+Attack or Ability+Ability, but never Move+Move. This sentence only matters *because* extra actions exist, so it must constrain them.
- **G-17 Paying.** An action needs enough unspent AP, and AP never goes negative. **[H]** A unit that has used all its actions still benefits from free effects: passives, reactions, auras. **[H]**
- **G-18 Resolution.** Targets are chosen when the action is declared, and the action resolves immediately. There is no stack and no responses, except the two reactions in G-11, which interrupt movement. **[M]**

### 0.5 Cooldowns and durations

- **G-19 "CD N turn(s)". [M]** If the controller uses the ability on own turn T, they cannot use it during their next N own turns; it is ready again on own turn T+N+1. Implementation: `readyOnOwnTurn = ownTurnIndex + N + 1`. So **"CD 1" = usable every other own turn.**
  - Rejected reading: "CD 1 = once per turn". That only matters for multi-action units. Baba Yaga combines "Can be applied twice to the same unit" with "CD 1", which only makes sense if the cooldown blocks the *next* turn.
- **G-20 Cooldown ownership.** Each ability has its own cooldown, so the Royal Wizard's Forcefield and Pajazon are independent. **[H]** Cooldowns belong to the unit instance, so two Wizards track theirs separately. **[H]** A unit revived by Queso keeps its cooldowns. **[M]**
- **G-21 "for N turns". [M]** N counts the controller's own turns, including the turn the effect is created on. An effect created on own turn T lasts until the start of the controller's own turn T+N. It therefore sees N of the controller's end-of-turn phases and N of the opponent's.
- **G-22 No duration stated.** A non-passive effect with no stated duration (Forcefield) lasts until the start of the controller's next own turn, like Defend. **[L]**
- **G-23 Defend** lasts until the start of the defending unit's controller's next turn. It applies to every damage instance received in that window, from attacks and abilities alike. **[M]**
- **G-24 After the source dies.** Created things persist after their source dies: Forcefield, Pajazon area, dummies, mines. **[M]** Auras end the moment their source leaves the board: Strong aura, Mad inventor, Command Aura, Kulega's granted ability, Queso's beacon, Ratasius' detection and weakness. **[H]**

### 0.6 Damage

- **G-25 Two kinds of damage. [M]**
  - **Attack damage** = the attacker's current Power. Comes from the basic Attack action, the Ranger's ranged attack, the Berserker's Savagery attack and the Rogue's Assault.
  - **Ability damage** = a fixed number: Smite 8, Forceful slam 10 / 3, Pajazon 3, Trip Mine 5 (+5), and Julio Vernification (= the sacrificed unit's toughness).
  - Power buffs (Strong aura, Mad inventor, Sabrina, The Keep's "+3 power") change attack damage only. Text that says "attack"/"attacking" (Fierce attacker, Savagery, the mine's "ranged attack") refers only to attacks. Text that says "damage" (Defend, Line Formation, Reinforced Armor, Forcefield, the Stealth reveal, Ratasius' weakness) covers both kinds.
- **G-26 Damage pipeline,** computed per target and per damage instance, in this order:

  | Step | What happens | Floor |
  |---|---|---|
  | 1. Base | attack: attacker's current Power; ability: the fixed number | - |
  | 2. Source modifiers | + Fierce attacker bonus; - 4 if the source is weakened by Ratasius | clamp at 0; **0 means no damage at all** (no reveal, no trigger) |
  | 3. Defend | `ceil(x / 2)` if the target is defending | min 1 |
  | 4. Flat reductions | subtract the sum of Reinforced Armor 3, Line Formation 2 and Forcefield 8 | min 1 |
  | 5. Apply | subtract from current toughness; at <= 0 the unit dies (G-31) | - |

  - Why the floors: the spec gives a floor for every target-side reduction ("never less than one", "(not below 1)", "(can't be less than 1)"). So **min 1 is a universal floor for target-side reductions, Forcefield included. [M]** Ratasius' weakness is a source-side "deal 4 less damage" with no floor text, so it **floors at 0. [L]**
  - Order (halve, then subtract) is a tuning choice that favours defenders. **[L]**
  - Worked examples:
    - Berserker (12) vs a defending Paladin: 12, halved to 6, minus 3 = **3**.
    - Mine (5) vs a Footman in formation inside a Forcefield: 5 - (2 + 8), floored = **1**.
    - Footman (1) adjacent to Ratasius attacks anything: 1 - 4, clamped = **0** (no damage).
- **G-27 Simultaneous damage. [M]** Area effects (Forceful slam, a Pajazon tick) work in three passes:
  1. Compute every target's damage from the board as it stood before the blast. Line Formation adjacency is judged before anyone dies.
  2. Apply all of the damage.
  3. Resolve all deaths together, then their triggers (G-10 order).
- **G-28 Hp loss that is not damage. [M]** These are not reduced by Defend, Armor or Forcefield, never reveal a Rogue, and are not "damage received":
  - Shared wounds' "Sacrifice half of ... hp"
  - Queso's max-toughness sacrifice
  - losing a toughness aura (G-30)

### 0.7 Healing and toughness

- **G-29 Toughness model. [M]** Every unit tracks `maxToughness` and `currentToughness`.
  - `baseToughness` = printed + permanent commander modifiers (Trill +2).
  - `maxToughness` = baseToughness + active aura modifiers (Strong aura +1).
  - "Heal", "regenerate", "gain life" and "recover" all raise current toughness up to `maxToughness`, never above. There is no overheal unless a text says so. The spec itself treats toughness as a pool with a ceiling: "units that receive damage do not regenerate or recover toughness ... unless some kind of ability or skill is involved".
- **G-30 Gaining or losing a toughness aura. [M]** Gaining +b raises both max and current by b. Losing it lowers both by b, but **losing an aura never takes current toughness below 1**: stepping away from a Priestess never kills. The rule is symmetric, so walking in and out cannot be used as a free heal.

### 0.8 Death, sacrifice, death triggers

- **G-31** A unit dies as soon as its current toughness is <= 0 and is removed from the board (simultaneous cases: G-27). **[H]**
- **G-32 Sacrifice. [M]** "Sacrifice X" means X dies; it is not damage. **A sacrifice counts as dying** for every "when ... dies" trigger: Kulega's type-20 regeneration and Queso's revive. Values that read the sacrificed unit's toughness use its current toughness immediately before the sacrifice. **[H]**
- **G-33 What can be sacrificed.** Only your own units **[M]**. The Commander can never be sacrificed **[H]**, since that would forfeit the game.
- **G-34 Commander death** ends the game immediately; nothing (not even Queso) can revive a commander. **[H]** If both commanders die in the same resolution (a Forceful slam splash can hit both), the game is a **draw**. **[L]**

### 0.9 Vision, invisibility, revealing, targeting

- **G-35 Vision** is the union of the LOV areas of all of a player's units, including the commander and dummies. Whether scenario blockers occlude vision is a core-rules question. Whatever is decided there, ability targeting uses the same occlusion.
- **G-36 Targeting.**
  - **Unit-targeted** actions require the target to be currently visible to the acting player. **[H]** These are: an Attack on a unit, Smite, the damage target of Julio Vernification, and Shared wounds.
  - **Square- and area-targeted** actions only require the square to be in range. **[M]** These are: Forcefield squares, the Pajazon centre, the Forceful slam square, dummy/mine placement, and a ranged attack on a square. Forcefield additionally requires its squares to be in the Wizard's LOV (spec).
  - Square and area effects hit whatever occupies the square, visible or not. **[M]**
- **G-37 Attacking a square. [M]** A unit whose attack range is >= 2 (today only the Ranger) may target any square in range, empty or not. The attack:
  - hits the occupant if there is one, including an invisible Rogue;
  - detonates a mine on that square (2.12).
  Melee attacks (range 1) must target a visible unit. **[M]** They never need blind attacks, because anything adjacent to an enemy is revealed anyway (Rogue reveal rule and Mind's Eye).
- **G-38 "Invisible" means hidden from the opponent only. [H]** The owner always sees its own stealthed units and mines; the owner's pathing note talks about "a mined square" the owner knows about.
- **G-39 "Revealed".** One word, two cases:
  - (a) A revealed **stealthed unit loses Stealth**: it is a normal visible unit until it activates Stealth again. **[M]**
  - (b) A revealed **mine stays visible to the opponent** until it explodes. **[M]**

  Reveal sources:
  - Stealth's own conditions (2.6)
  - Mind's Eye (Juliomancer, Artificer)
  - Ratasius' aura

  **Mind's Eye and Ratasius also reveal mines**: "invisible units" is read as "invisible things". **[L]** Without this, mines have almost no counterplay.
- **G-40 Hidden information stays on the server. [M]** The server never sends hidden units or mines to the opponent's client. Checks that depend on hidden information are evaluated server-side, and the UI may say "not possible now" without saying why. This covers Stealth activation and placing onto a hidden mine. It needs an authoritative host or server; that is a note for the networking lens, since a peer-hosted game would let the host see everything.

### 0.10 Stacking

- **G-41 Same-named effects do not stack on one unit. [M]** A unit is affected by at most one instance of each of:
  - Strong aura
  - Forcefield
  - a Pajazon tick
  - Command Aura
  - Mad inventor
  - Ratasius' weakness
  - Queso's beacon

  Differently named effects do stack: Strong aura + Pajazon + Queso heal all apply. **[H]** Effects defined by counting stack by design: Fierce attacker counts Mercenaries. **[H]**

### 0.11 Movement and interrupts

- **G-42 Moves resolve one square at a time. [M]** After each step the engine checks, in order: (1) mine trigger (2.12), (2) Rogue Assault (2.6), (3) reveals (Stealth adjacency, Mind's Eye, Ratasius), (4) the commander's last-row win check (CMD-6). If a mine explodes or an Assault fires, **the move is interrupted**: the mover stops in that square (if it is still alive), the rest of the path is lost, and the AP stays spent.
- **G-43 Path-finding and own mines. [H]** This is the owner's pathing note. Path-finding never automatically routes a unit through its own known mines. If the player picks a destination, or a path, that crosses an own mine, a confirm dialog appears; an option can turn the warning off. Path-finding may freely route through squares where the player sees nothing. An invisible enemy there is always revealed by adjacency before the mover could enter its square (2.6), so no "bump into an invisible unit" rule is needed.

### 0.12 Take-back

- **G-44 Take-back and hidden information. [M]** ("There will be a take back option for each player. The opponent player has to accept the take back.") Proposal: take-back is limited to the last action, and is **unavailable if that action revealed hidden information to the requester**. That covers fog squares newly seen with enemies in them, a mine or Stealth reveal, an Assault, and a revive prompt. Otherwise a player could scout and then undo for free. Every ability resolution sets a `revealedInfo` flag that the take-back check reads.

### 0.13 A missing ability: extended deployment

- **G-45 Who may use the extended deployment zone?** ("Some units can be deployed in the extended deployment area, which covers slightly more terrain.") No unit line grants this. Implement it as a unit keyword `Vanguard`. Placeholder holders: **Rogue and Ranger** (the scout and skirmisher roles) **[L]**. The owner must assign it (Q-12).

### 0.14 Ability data model (sketch for the engine)

```ts
type AbilityKind = 'passive' | 'active' | 'triggered';

interface AbilityDef {
  id: string;                    // 'rogue.stealth'
  kind: AbilityKind;
  cost?: number | 'unitAP';      // AP; undefined for passive/triggered (G-14)
  usesAction: boolean;           // true for active abilities (G-13); Baba Yaga regen = false
  cooldownOwnTurns?: number;     // G-19: readyOnOwnTurn = useTurn + cd + 1
  perTurnLimit?: number;         // Savagery: 1
  target: TargetSpec;
  trigger?: TriggerSpec;         // for 'triggered'
  effects: EffectSpec[];         // damage / heal / create / status / reveal ...
}

type Allegiance = 'ally' | 'enemy' | 'any';

type TargetSpec =
  | { type: 'none' }                                             // self or no choice
  | { type: 'unit'; range: number; allegiance: Allegiance;
      requiresVisible: true; excludeSelf?: boolean; excludeCommander?: boolean }
  | { type: 'square'; range: number; mustBeFree?: boolean; requiresLOV?: boolean }
  | { type: 'shape'; shape: 'tetromino' | 'square3x3'; centerRange?: number; requiresLOV?: boolean }
  | { type: 'pair'; first: TargetSpec; second: TargetSpec; distinct: true }; // Shared wounds, Julio

type TriggerSpec =
  | { on: 'endOfOwnTurn' | 'endOfOpponentTurn' | 'startOfOwnTurn' }
  | { on: 'enemyBecomesAdjacent'; requiresSelfStatus: 'stealthed' }  // Assault
  | { on: 'unitDies'; filter: { types?: number[]; adjacentToSelf?: boolean; withinRangeOfSelf?: number } }
  | { on: 'unitEntersSquare' };                                      // Trip Mine
```

Static modifiers such as Strong aura, Reinforced Armor, Line Formation and Command Aura are best implemented as *modifier providers* that the damage pipeline (G-26), the toughness model (G-29) and the action-allowance check (G-15) query. They should not be stored as values on units. That keeps auras correct as units move.

### 0.15 Stat reference (parsed from the spec)

Format in the spec: "Name, Power/Toughness, Size, LOV, Movement, AP". Attack range is 1 for every unit except the Ranger (2).

| Grade | Unit | P/T | Size | LOV | Mov | AP | Abilities (AP cost) |
|---|---|---|---|---|---|---|---|
| 1 | Footman | 1/2 | 1 | 1 | 1 | 1 | Line Formation (P) |
| 1 | Mercenary | 2/1 | 1 | 1 | 1 | 1 | Fierce attacker (P) |
| 2 | Soldier | 2/7 | 1 | 2 | 1 | 1 | Perseverance (P) |
| 2 | Ranger | 3/1 | 1 | 3 | 1 | 1 | Ranged attack (P) |
| 5 | Berserker | 12/2 | 1 | 2 | 1 | 1 | Savagery (P; extra attack costs 2) |
| 5 | Rogue | 7/4 | 1 | 3 | 2 | 2 | Stealth (1), Assault (free reaction) |
| 10 | Priestess | 3/15 | 1 | 2 | 2 | 2 | Strong aura (P), Shared wounds (no cost listed; default 2) |
| 10 | Juliomancer | 3/15 | 1 | 3 | 1 | 2 | Mind's Eye (P), Julio Vernification (2) |
| 20 | Paladin | 12/20 | 1 | 2 | 3 | 2 | Reinforced Armor (P) |
| 20 | Artificer | 1/15 | 1 | 3 | 2 | 1 | Mind's Eye (P), Prototype No-ACB (2), Mad inventor (P), Trip Mine B20 (2) |
| 50 | Royal wizard | 10/20 | 1 | 3 | 1 | 3 | Forcefield (2, CD 1), Pajazon (3, CD 1) |
| 50 | Beast of Knorund | 20/40 | 2 | 2 | 2 | 3 | Forceful slam (4, CD 1), Feast (2) |
| 100 | Celestial Emissary | 15/50 | 1 | 4 | 2 | 4 | Holy blessing (3), Smite (3), Holy Fervor (P) |
| 100 | Scourge of the Gods | 15/33 | 1 | 3 | 2 | 3 | Command Aura (P) |
| - | No-ACB dummy (created) | 0/7 | 1 | 1 | 0 (1 under Mad inventor) | 1 | - |
| - | Commander (default) | 1/1 | 1 | 3 | 1 | 1 | bonuses come from the chosen commander |

Parsing note: the Paladin line reads "Paladin: 12/20, ..." with a colon instead of a comma. The parser should accept both, or better, the roster should live in a data file instead of being parsed from prose. **[H]**

---

## 1. Factions: two factions, one roster

> The game features, for now, 2 clans or factions. It may be possible to add new factions later into the game.

> \#\#\# The Empire
> \#\#\# Lojrar Clan
> \#\#\#\# 1
> Footman, ...

**What the spec actually contains.** The heading `### The Empire` is immediately followed by `### Lojrar Clan`, with nothing between them. All 14 units sit under the "Lojrar Clan" heading in the Markdown structure, and The Empire has no units at all. The workflow brief calls them "Empire units". Either way, **only one roster of 14 units exists** (7 grades x 2 units = the "2 variations" per coin). The commanders appear as two paragraphs of three, separated by a blank line, which suggests 3 commanders per faction.

### FAC-1 How to treat the roster

| Option | Reading | Consequence |
|---|---|---|
| **A. Shared roster** | Both factions use all 14 units; faction is cosmetic (token art, palette, names) for now | Nothing blocked; balance identical for both sides |
| B. Roster belongs to Lojrar Clan | Literal Markdown nesting; The Empire's 14 units are missing | Empire unplayable until the owner supplies its roster |
| C. One unit per grade per faction | "each unit has 2 variations" = one variation per faction (like a coin's national side); first-listed unit of each grade = Empire, second = Lojrar | Each faction has 7 units, one per grade |
| D. Roster belongs to The Empire | What the brief assumes; the Lojrar heading was placed early by mistake | Same as B with the factions swapped |

**Default: A. Shared roster.** All 14 units and all 6 commanders are available to both factions; faction = cosmetic skin. The data model is faction-aware from day one: `UnitDef.factions: FactionId[]` and `CommanderDef.factions: FactionId[]`, so a second roster or a split drops in later as data only. Confidence that this *unblocks* implementation: **[H]**. Confidence that it *matches the owner's intent*: **[L]**.

Option C at a glance, if the owner meant it:

| Grade | First-listed (Empire under C) | Second-listed (Lojrar under C) |
|---|---|---|
| 1 | Footman | Mercenary |
| 2 | Soldier | Ranger |
| 5 | Berserker | Rogue |
| 10 | Priestess | Juliomancer |
| 20 | Paladin | Artificer |
| 50 | Royal wizard | Beast of Knorund |
| 100 | Celestial Emissary | Scourge of the Gods |

Consistency check: under C plus the positional commander split (FAC-2), **Sabrina** (an Artificer commander) would be an Empire commander while Artificers would be Lojrar-only. Her bonus would then be dead text. So if C is intended, either Sabrina is Lojrar or the unit split is reversed. This is worth asking explicitly (Q-01).

### FAC-2 Which commanders belong to which faction

The commander list has a blank line after Sabrina, so it reads as two groups of three:

- Group 1: Trill "The Hydrocephalic", Kulega "The Fine Printer", Sabrina "The Reelfinisher"
- Group 2: Baba Yaga "The Bwitch", Ratasius I "The Great", Queso "The Beacon of hope"

The positional mapping follows the order the factions are listed in: **Group 1 = The Empire, Group 2 = Lojrar Clan.** **[L]** Counter-evidence: "Ratasius I 'The Great'" reads like an emperor's regnal name, which points to The Empire.

**Default:** store the positional mapping as `suggestedFaction` metadata but **do not enforce it**: any player may pick any of the 6 commanders. **[M]**

### FAC-3 Other faction rules needed by abilities

- **Mirror matches** are allowed: both players may pick the same faction, and the same commander. **[M]**
- **Mixed armies:** under A, an army may use any of the 14 units. Under B, C or D, armies are locked to their faction. **[M]**
- **Text-only allegiance.** No current ability references a faction by name. Every "ally/enemy" in the abilities means player allegiance (G-03), never faction. **[H]**

---

## 2. Units

Template for every ability: **Kind** (passive / active / triggered) | **Cost** | **Uses the unit's action?** | **Trigger and timing** | **Targeting** (range metric, vision, allegiance) | **Effect** | **Duration** | **Cooldown** | **Stacking** | **Fog / invisibility**. Each unit section ends with "Edge cases & decisions".

### 2.1 Footman (type-1)

> Footman, 1/2, 1, 1, 1, 1
> Line Formation:P:If there's another 2 adjacent Footmen, reduce the incoming damage by 2 (not below 1).

**Line Formation**

- **Kind:** passive damage modifier. **Cost:** none; does not use an action.
- **Condition:** checked each time a damage instance is received. At least 2 *other friendly* Footmen must be adjacent (G-06) to this Footman.
- **Effect:** -2 on that damage instance at pipeline step 4 (G-26), never below 1.
- **Applies to:** all damage: attacks, abilities, mines, Pajazon ticks. Not to hp loss that isn't damage (G-28).
- **Timing:** both players' turns. **Duration / cooldown:** n/a.
- **Stacking:** on/off. Three or four adjacent Footmen still give only -2.

**Edge cases & decisions**

- **FTM-1** "another 2" means *at least* two others, not exactly two. **[H]**
- **FTM-2** Only friendly Footmen count; an enemy Footman standing next to mine does not help me. **[M]**
- **FTM-3** Shapes under orthogonal adjacency (G-05). In a straight line of 3, only the middle Footman qualifies. In an L of 3, only the corner qualifies. In a plus shape, the centre qualifies. Under `KING_8`, all four Footmen of a 2x2 block would qualify.

  ```
  Line:  F F F   -> only the middle F is protected
  L:     F .
         F F     -> only the corner F is protected
  ```

- **FTM-4** Under area damage (Forceful slam splash, Pajazon tick), adjacency is judged on the board as it was before the blast (G-27). A Footman keeps its -2 even if a neighbour dies in the same blast. **[M]**
- **FTM-5** Dummies, Mercenaries and other units are not Footmen, even when adjacent. **[H]** Revived Footmen (Queso) count normally. **[H]**
- **FTM-6** With Defend: Berserker (12) vs a defending Footman in formation: halved to 6, minus 2 = 4. **[M]** (pipeline order, G-26)
- **FTM-7** With Forcefield: total reduction 2 + 8 = 10, but the hit still deals at least 1. **[M]**
- **FTM-8** Under Trill a Footman is 1/4, which makes formations survive a Pajazon tick: 3 - 2 = 1 per tick. Under the Market, a Footman gets 2 actions, but still only one Move (G-16). **[H]**
- **FTM-9** Under the default "white = grade 1", Baba Yaga gives Footmen a regen ability (3.4). **[L]**

### 2.2 Mercenary (type-1)

> Mercenary, 2/1, 1, 1, 1, 1
> Fierce attacker:P:Deal 1 extra damage for each Mercenary that is adjacent to the attacked unit

**Fierce attacker**

- **Kind:** passive attack modifier. **Cost:** none.
- **Trigger:** each attack this Mercenary makes. Not abilities, and not attacks made by other units.
- **Effect:** +1 damage at pipeline step 2 for each *other friendly* Mercenary adjacent to the attacked unit at the moment of the attack.
- **Stacking:** counts every qualifying Mercenary, by design.

**Edge cases & decisions**

- **MER-1** Does the attacker count itself? Read literally, yes: a melee Mercenary is always adjacent to its target, so every attack would deal at least 3, and the clause would add nothing beyond a 3-power stat. **Default: the attacker does not count itself. [M]**
- **MER-2** Only Mercenaries controlled by the attacking player count. The target's own neighbouring Mercenaries do not. **[M]**
- **MER-3** Maximum bonus. A 1x1 target has 4 neighbours: the attacker plus up to 3 others, so +3 (5 damage). A 2x2 Beast has 8 neighbours (G-07): up to 7 others, so +7 (9 damage). **[H]**
- **MER-4** A Footman attacking a target surrounded by Mercenaries gets no bonus: the ability belongs to the attacking Mercenary. **[H]**
- **MER-5** The bonus is added before Defend and flat reductions. Against a defending Paladin, a Mercenary with +3 deals: 5, halved to 3, minus 3, floored = 1. **[M]**
- **MER-6** The Keep raises Power to 5 before the bonus. Ratasius' weakness subtracts 4 from (Power + bonus), floored at 0. **[M]**
- **MER-7** Dummies are never Mercenaries. A revived Mercenary counts again. **[H]**
- **MER-8** Market synergy: 2 actions (Move then Attack) is what makes a Mercenary pack work at all, given "one action per turn". **[H]**

### 2.3 Soldier (type-2)

> Soldier, 2/7, 1, 2, 1, 1
> Perseverance:P: Regenerate 1 toughness at the end of the turn (Your turn)

**Perseverance**

- **Kind:** passive, triggered at the end of each of its controller's turns. **Cost:** none.
- **Effect:** +1 current toughness, capped at max (G-29).
- **Timing:** only the controller's own turn ("(Your turn)"). Never at the end of the opponent's turn.

**Edge cases & decisions**

- **SOL-1** It fires every own turn, whether or not the Soldier acted and whether or not it took damage that turn. **[H]**
- **SOL-2** Dead units do not regenerate: death at <= 0 is immediate (G-31). **[H]**
- **SOL-3** An enemy Pajazon damages its targets at the end of *their* turn, which is this Soldier's own end of turn. Both effects land in the same phase. G-10 says the non-active player's effect (the Pajazon) resolves first. So a Soldier at 3 inside an enemy Pajazon goes 3 - 3 = 0 and dies with no regen. At 4 it goes to 1, then regenerates to 2. **[M]**
- **SOL-4** Regen stacks with Queso's beacon and a friendly Pajazon (different names, G-41). Order does not matter because all of them are capped heals. **[H]**
- **SOL-5** Under Trill a Soldier is 2/9. Under Kulega, a Soldier dying next to a friendly type-20 heals that unit 4 (its toughness 7, capped at 4). **[H]**

### 2.4 Ranger (type-2)

> Ranger, 3/1, 1, 3, 1, 1
> Ranged attack:P: This unit's attack has a range of 2.

**Ranged attack**

- **Kind:** passive; modifies the Ranger's Attack action.
- **Effect:** attack range = 2, i.e. any target at distance <= 2 (Manhattan; 12 squares, see the G-06 diagram).
- **Targeting:** a visible unit (G-36) **or any square** in range (G-37).

**Edge cases & decisions**

- **RNG-1** There is no minimum range: the Ranger can shoot adjacent units. Diagonal neighbours are at distance 2 under ORTHO_4, so they are in range. **[M]**
- **RNG-2** There is no separate line-of-fire check: the target only has to be visible. If the core rules decide that blockers occlude vision, the same occlusion applies to shots. **[M]**
- **RNG-3** The Ranger's attack is a "ranged attack" for Trip Mine purposes ("Mines can be triggered from distance by attacking the square with a ranged attack"). Today it is **the only one**: Smite targets "a unit", not a square. **[M]**
- **RNG-4** **Attacking a square** (G-37):
  - hits whatever stands there, including an invisible Rogue, which is then revealed if its square is inside the Ranger player's LOV (2.6);
  - detonates a mine there, whoever owns it;
  - on a truly empty square, wastes the action, but the player learns "nothing there". **[M]**
- **RNG-5** A mine detonated by a shot is visible to both players as an explosion event (shown where it is in each player's vision). **[M]**
- **RNG-6** A Ranger shooting Ratasius from distance 2 is **not** weakened, because weakness only reaches distance 1. That makes Rangers the natural counter to Ratasius. **[H]**
- **RNG-7** Under Trill a Ranger is 3/3. Under Kulega it is LOV 4, while its range stays 2. **[H]**

### 2.5 Berserker (type-5)

> Berserker, 12/2, 1, 2, 1, 1
> Savagery:P: After attacking with the berserker, you can spend 2 AP to attack an additional time. Only once per turn.

**Savagery**

- **Kind:** passive permission. **Cost:** the extra attack costs 2 AP.
- **Does not** use an action or count as one.
- **Trigger:** after the Berserker has resolved a basic Attack action this turn, its controller may pay 2 AP for one more attack by the Berserker.
- **Limit:** once per turn.
- **Targeting:** any legal attack target at the time: the same unit or a different one.

**Edge cases & decisions**

- **BER-1 (brief's question).** Yes, the Berserker can attack twice in a turn with a single action. The extra attack rides on the Attack action and bypasses the one-action rule, because the ability says so. Cost: 1 AP + 2 AP = **3 AP for 2 x 12 damage**. **[M]**
- **BER-2** Timing: the extra attack may be taken right away or later in the same turn, for example after another unit has acted. The UI keeps a "Savagery (2 AP)" button on the Berserker until the end of turn. **[M]** An alternative is "immediately or never". **[L]**
- **BER-3** Only a basic Attack enables Savagery. Defend does not, and Savagery cannot follow itself. **[H]**
- **BER-4** If the first attack killed its target, Savagery may hit a different unit that is still in range. **[M]**
- **BER-5** With Command Aura (2 actions), the possible sequences are Attack, Savagery, Attack (1 + 2 + 1 AP) or Move, Attack, Savagery (1 + 1 + 2 AP). Either way the cap is **3 attacks per turn**, since Savagery stays once per turn. **[M]**
- **BER-6** Each attack has its own damage pipeline. The Keep makes it 15 + 15. Ratasius adjacent makes it 8 + 8. **[H]**
- **BER-7** Under Trill a Berserker is 12/4. The Market does not apply (it is type-5). **[H]**

### 2.6 Rogue (type-5)

> Rogue, 7/4, 1, 3, 2, 2
> Stealth:1:Only activate this ability if not inside the LOV of another enemy creature. This unit becomes invisible. It will be revealed when it's 1 square away from an enemy unit, or when receiving damage inside enemy LOV.
> Assault: When an enemy unit comes into the melee range of this unit, if this unit is in stealth, perform an automatic attack without spending AP to the entering unit. (This can also occur in opponents turn)

**Stealth**

- **Kind:** active. **Cost:** 1 AP. **Uses the Rogue's action. [M]**
- **Activation condition:** the Rogue's square is not inside the LOV of any enemy unit at the moment of activation. Enemy units include the enemy commander and enemy dummies. "another enemy creature" simply means any enemy unit. **[H]**
- **Effect:** the Rogue gains the status **Stealthed** and becomes invisible to the opponent (G-38). It cannot be the target of unit-targeted actions (G-36), but square and area effects still hit it.
- **Duration:** indefinite, until revealed. **Cooldown:** none.
- **Reveal conditions.** Any one ends Stealth; the Rogue then becomes a normal visible unit (G-39a):
  - **R1 Adjacency:** an enemy unit is at distance 1. This is state-based and checked after every step, placement, creation and revival, whoever moved.
  - **R2 Damage in sight:** the Rogue receives damage (more than 0 after the pipeline) while its square is inside the LOV of at least one enemy unit.
  - **R3 Detection:** the Rogue is inside the LOV of an enemy unit with Mind's Eye, or within distance 3 of an enemy Ratasius. **[M]**
- **While Stealthed** the Rogue may Move and Defend without being revealed. Its own vision still counts for its controller. **[H]**

**Assault**

- **Kind:** triggered reaction. **Cost:** free ("without spending AP"). **Does not** use an action. **[M]**
- **Trigger:** the Rogue is Stealthed, and an enemy unit "comes into" melee range, meaning the distance between them *becomes* 1 as the result of a movement step. Either the enemy moved (on the opponent's turn) or the Rogue moved (on the Rogue's own turn). **[M]** The clause "(This can also occur in opponents turn)" implies a main case on the Rogue's own turn, and the only way an enemy can "come into" range on your own turn is that your Rogue moves next to it.
- **Effect:** the Rogue immediately makes one attack (normal attack damage: Power 7 plus modifiers) against that enemy unit.
- **Ordering, critical:** in the same step, **Assault is checked before reveal R1. [H]** Entering melee range is exactly what triggers R1, so if R1 resolved first, Assault could never fire. Sequence: the step completes, then Assault, then the Rogue is revealed (R1), then the move is interrupted (G-42).

**Edge cases & decisions**

- **ROG-1** Stealth is the Rogue's action, so it cannot Move and Stealth in the same turn without an extra action (Command Aura). The typical pattern:
  - Turn A: Stealth (1 AP).
  - Turn B: Move up to 2 squares (2 AP) next to an enemy, which triggers a free Assault for 7, and the Rogue is revealed.
- **ROG-2 Activation depends on hidden information.** The Rogue's player may not see the enemy that sees the Rogue. The server decides (G-40), and the UI shows Stealth disabled with "You are being watched". This leaks only that *some* enemy sees the Rogue, not where. **[M]** An alternative is to allow the attempt and have it fail with the AP spent. **[L]**
- **ROG-3** Stealth cannot be activated while already Stealthed. It can be activated again after a reveal, once the condition holds. **[H]**
- **ROG-4** An enemy unit *created or revived* adjacent to a Stealthed Rogue (a dummy, a Queso revive) reveals it (R1), but **does not trigger Assault**: nothing "came into" range by moving. **[M]**
- **ROG-5** If several enemies become adjacent in the same step (the Rogue steps between two enemies, or a 2x2 Beast arrives), only **one** Assault happens, and then the Rogue is revealed. The Rogue's controller picks the target. If that happens during the opponent's turn, it uses the reaction prompt (G-11), and the default is the entering unit with the lowest current toughness. **[M]**
- **ROG-6** Two Stealthed Rogues of opposite sides become adjacent: both Assaults trigger. The stationary Rogue's Assault resolves first, then the mover's if it is still alive. Then both are revealed. **[L]**
- **ROG-7** If the entering unit dies to the Assault, its move ends. If it was the enemy commander, the game is won immediately. **[H]**
- **ROG-8** Assault uses the normal pipeline (G-26):
  - **Defend** halves it, for example when the Rogue moves next to an enemy that defended on its last turn.
  - **Paladin** subtracts 3.
  - **Line Formation** and **Forcefield** apply.
  - **Ratasius:** weakness applies when Ratasius is the entering unit, because the Rogue is then within distance 1 of him. 7 - 4 = 3, which still kills a 1/1 Ratasius. **[H]**
- **ROG-9** An Assault on the Rogue's own turn does not consume its action, but its Move already did. With an extra action (Command Aura) it may then also make a normal Attack. **[M]**
- **ROG-10** Assault fires at most once per Stealth activation, since the reveal always follows. **[H]**
- **ROG-11** Damage taken where no enemy sees it does not reveal the Rogue. Examples: an enemy mine on a square no enemy unit sees; a Pajazon tick on its outer ring, which can lie at distance 4 from the Wizard, beyond its LOV 3. **[H]**
- **ROG-12** A Stealthed Rogue stepping on a hidden enemy mine takes 5. It is revealed only if that square is inside enemy LOV (R2). **[H]**
- **ROG-13** An invisible Rogue still occupies its square. No "bump" rule is needed: any enemy reaching a neighbouring square reveals it first (R1). Dummy and mine placement always happens next to the placing Artificer, and so does any Rogue standing on that square, so it is already revealed. Revives return to the square where the unit died. **[H]**
- **ROG-14** Mind's Eye or Ratasius detection breaks Stealth (G-39a). Inside such detection, Stealth cannot be reactivated anyway, because the Rogue is in enemy LOV. **[M]**
- **ROG-15** Objectives: an invisible Rogue still counts as a unit that contests or captures. The capture state may therefore leak its presence; that is for the core-rules lens. **[L]**
- **ROG-16** Bigger enemy LOV makes Stealth harder to activate: Kulega (+1 LOV for all) and Ratasius (commander LOV 6). This is intended counterplay. **[H]**
- **ROG-17** Assault also triggers on enemy dummies moved under Mad inventor, and on any enemy whose path passes next to the Rogue. It fires at the first adjacent step and interrupts that move (G-42). **[M]**
- **ROG-18** An Assault or a reveal blocks take-back for the action that caused it (G-44). **[M]**
- **ROG-19** Presentation: the owner sees their Stealthed Rogue semi-transparent; the opponent sees nothing. On a reveal, both players see a "Rogue revealed" event. **[M]**
- **ROG-20** Under Trill a Rogue is 7/6. Under the Keep, Assault deals 10. **[H]**

### 2.7 Priestess (type-10)

> Priestess, 3/15, 1, 2, 2, 2
> Strong aura:P: units adjacent to priestess, gain additional 1 power and 1 toughness
> Shared wounds: Sacrifice half of adjacent unit's (or itself) hp. Heal other unit (including itself) hp by that number, but no more than units base hp.

**Strong aura**

- **Kind:** passive aura. **Cost:** none.
- **Affects:** friendly units adjacent to the Priestess (G-03). **[M]** She is never adjacent to herself, so she is not buffed by her own aura.
- **Effect:** +1 Power (read at attack time) and +1 toughness, which is gained and lost per G-30.
- **Duration:** continuous; re-evaluated after every step, placement and death.
- **Stacking:** a unit next to two Priestesses still gets +1/+1 (G-41). **[L]** The alternative is +1/+1 per Priestess.

**Shared wounds**

- **Kind:** active. **Cost:** none listed, so the Priestess's AP stat, **2 AP** (G-14). **[M]** **Uses her action.**
- **Targets:** chosen together when declared.
  - **Donor D:** the Priestess herself, or a friendly unit adjacent to her.
  - **Recipient R:** a different friendly unit that is the Priestess or adjacent to her. **[M]**
- **Effect:** A = `floor(D.current / 2)`.
  - D loses A. This is not damage (G-28), so no reductions apply and no reveal happens.
  - R heals `min(A, R.max - R.current)`.
- **Cooldown:** none. **Duration:** instant.

**Edge cases & decisions**

- **PRI-1** The aura buffs dummies (No-ACB becomes 1/8) and **the Commander (2/2)**, which matters a lot for a 1/1 commander. **[M]**
- **PRI-2** Two adjacent Priestesses buff each other: each becomes 4/16. **[H]**
- **PRI-3** For a 2x2 Beast, it is enough that any of its cells is adjacent (G-07). **[H]**
- **PRI-4** Leaving the aura never kills (G-30). A Footman at 3/1 inside the aura that steps out becomes 2/1, not 2/0. **[M]**
- **PRI-5** Rounding is down, so **the donor can never die**: it keeps `ceil(current / 2)`, which is at least 1. A donor at 1 toughness would transfer 0, so it is not a legal donor. **[M]**
- **PRI-6** Overflow is wasted. The donor pays the full A even if R needed less, as written ("Sacrifice half"). The UI previews the waste. **[M]** A friendlier alternative transfers only what R can absorb. **[L]**
- **PRI-7** "no more than units base hp" is read as the recipient's current `maxToughness`, auras and Trill included (G-29). Capping at printed toughness would forbid healing a damaged unit that is standing next to the Priestess, which makes no sense. **[M]**
- **PRI-8** **Enemy donors are not allowed.** "Sacrifice" implies your own units (G-33), and an enemy donor would turn this into a 2-AP "halve any adjacent enemy" attack (25 damage to a full Emissary). **[M]**
- **PRI-9** Recipient range: adjacent to the Priestess, or the Priestess herself, the same as the donor. **[L]** The spec only says "Heal other unit". A plausible alternative is "any friendly unit in her LOV".
- **PRI-10** The Commander may be the donor (it cannot die from it) or the recipient. **[M]**
- **PRI-11** An own Stealthed Rogue can be targeted, because own units are always visible to their owner. The hp loss does not reveal it, since it is not damage. **[H]**
- **PRI-12** Donor and recipient must differ ("Heal other unit"). **[H]** With extra actions (Command Aura), Shared wounds can be used twice in a turn. **[H]**

### 2.8 Juliomancer (type-10)

> Juliomancer, 3/15, 1, 3, 1, 2
> Mind's Eye:P: This unit reveals invisible units in its LOV
> Julio Vernification:2: Sacrifice an adjacent unit. Deal damage equal to its current toughness to a unit in range 2.

**Mind's Eye**

- **Kind:** passive detection aura. **Cost:** none.
- **Effect:** every enemy invisible thing inside the Juliomancer's LOV (3; 4 under Kulega) is revealed to the Juliomancer's controller. That means Stealthed units, which lose Stealth (G-39a), and enemy mines, which stay revealed (G-39b, **[L]**).
- **Timing:** continuous: checked after every step, placement and creation, on both players' turns.

**Julio Vernification**

- **Kind:** active. **Cost:** 2 AP. **Uses the action.**
- **Targets:** chosen together when declared.
  - **S (sacrifice):** a friendly, non-commander unit adjacent to the Juliomancer, other than itself. **[M]**
  - **T (target):** a visible unit at distance <= 2 from the Juliomancer, of any allegiance; the UI asks for confirmation if T is friendly. **[M]** T cannot be S.
- **Effect:** record `X = S.currentToughness`, auras included. S dies (sacrifice, G-32). T takes X ability damage through the full pipeline.
- **Cooldown:** none.

**Edge cases & decisions**

- **JUL-1** Mind's Eye of two Juliomancers does not "stack"; it simply reveals. Revealed mines stay visible even after the Juliomancer moves away (G-39b). **[M]**
- **JUL-2** "Sacrifice an adjacent unit" excludes the Juliomancer itself. **[H]** It also excludes enemies, which would be an instant kill of any adjacent enemy plus free damage. **[M]**
- **JUL-3** T must be a unit, not a square, so Julio Vernification cannot detonate mines. **[H]** Mind's Eye covers distance 3 and T is within distance 2, so any enemy Rogue within reach is already revealed and targetable. **[H]**
- **JUL-4** Death triggers of S (Kulega's regen, Queso's revive prompt) resolve after T's damage. **[M]** This rarely matters.
- **JUL-5** Fodder values:

  | Sacrificed unit | Damage dealt |
  |---|---|
  | No-ACB dummy | 7 (8 with Strong aura) |
  | Soldier at full toughness | 7 |
  | Paladin | 20 |
  | **Beast of Knorund** | **40** |

  Balance suggestion (not a default): cap the damage, for example at 15, or use half the toughness. Julio converts toughness into damage 1:1, and with Queso the fodder can come back (3.6).
- **JUL-6** Defend, Reinforced Armor, Line Formation and Forcefield all reduce the damage normally. If the Juliomancer is within distance 1 of Ratasius, the damage is X - 4. **[M]**
- **JUL-7** A sacrifice is a death: Kulega and Queso triggers apply (G-32). **[M]**
- **JUL-8** Sacrificing a 2x2 Beast is legal if any of its cells is adjacent to the Juliomancer (G-07). **[H]**

### 2.9 Paladin (type-20)

> Paladin: 12/20, 1, 2, 3, 2
> Reinforced Armor:P: Reduce all damage dealt to this unit by 3 (can't be less than 1)

**Reinforced Armor**

- **Kind:** passive damage modifier. **Cost:** none.
- **Effect:** -3 on every damage instance the Paladin receives (pipeline step 4), floored at 1.
- **Applies to:** "all damage": attacks, Smite, Slam, Julio, Pajazon ticks, mines. **[H]** Not to sacrifice or other hp loss (G-28). **[H]**

**Edge cases & decisions**

- **PAL-1** Order with Defend: halve first, then subtract (G-26). A defending Paladin hit by a Beast (20) takes 10 - 3 = 7. A Footman's 1 damage still lands as 1. **[M]**
- **PAL-2** Stacks with Forcefield (-11 in total, floored at 1) and with Strong aura (+1 toughness). **[M]**
- **PAL-3** A Pajazon tick (3) or a mine (5) is reduced to 1 or 2 respectively. **[H]**
- **PAL-4** Under Kulega the Paladin is type-20, so it gains "Fine Print" regen (3.2). Under Sabrina it costs 24 to deploy (3.3). **[H]**
- **PAL-5** With Movement 3, the Paladin is the fastest unit. That is not an ability, but it matters for Assault and mine encounters. **[H]**
- **PAL-6** Parse "Paladin:" (with a colon) the same as "Paladin," (see 0.15). **[H]**

### 2.10 Artificer (type-20)

> Artificer, 1/15, 1, 3, 2, 1
> Mind's Eye:P: This unit reveals invisible units in its LOV.
> Prototype No-ACB:2: Create a dummy unit in a free adjacent square. It's a 0/7 unit, it cannot move and has a LOV of 1 and AP 1. A maximum of 3 dummies can be active at the same time. (All artificers; Every two artificers beyond the first one increase this limit by 1)
> Mad inventor: Prototypes NO-ACB can move when adjacent to any allied artificer and gain 1 power. (This effect disappears when the artificer steps out of range).
> Trip Mine B20:2: Deploy an invisible mine in a free adjacent square. It explodes when any unit steps on it. Deals 5 damage + 5 if the unit has a size of 2 or greater. A maximum of 5 mines can be active at the same time (All artificers; Each artificer beyond the first one increases this limit by 1), Mines can be triggered from distance by attacking the square with a ranged attack.

**Mind's Eye** works exactly as for the Juliomancer (2.8), using the Artificer's LOV of 3.

**Prototype No-ACB**

- **Kind:** active. **Cost:** 2 AP. **Uses the action.**
- **Target:** one free square adjacent to the Artificer. "Free" means:
  - on the board, and not a blocker;
  - no unit on it, visible or invisible;
  - no mine of the player's own.
- **Effect:** creates one No-ACB dummy (2.11), controlled by the Artificer's player.
- **Shared cap:** `maxDummies = 3 + floor((n - 1) / 2)`, where n is the number of that player's Artificers currently alive. **[M]**

**Mad inventor**

- **Kind:** passive aura (no cost listed, and it is clearly static, G-14).
- **Affects:** each friendly dummy adjacent to at least one friendly Artificer.
- **Effect:** the dummy may take the Move action, moving 1 square **[L]**, and has +1 Power. "Range" in "steps out of range" means adjacency. **[M]**
- **Stacking:** two adjacent Artificers still give +1 (G-41). **[M]**

**Trip Mine B20**

- **Kind:** active. **Cost:** 2 AP. **Uses the action.**
- **Target:** one free adjacent square, as defined for Prototype No-ACB. A square holds at most one mine. **[H]**
- **Effect:** creates a Trip Mine (2.12).
- **Shared cap:** `maxMines = 5 + (n - 1)`. **[M]**

Cap formulas, read literally. They differ on purpose, or by mistake; see ART-1.

| Artificers alive (n) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Max dummies: 3 + floor((n-1)/2) | 3 | 3 | 4 | 4 | 5 | 5 | 6 | 6 | 7 | 7 |
| Max mines: 5 + (n-1) | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |

With a 200 budget, at most 10 Artificers fit (20 each), or 20 under Sabrina at 10 each (12 dummies, no mines).

**Edge cases & decisions**

- **ART-1** The two formulas scale differently. Dummies get +1 per **two** extra Artificers; mines get +1 per **each** extra Artificer. Implement exactly as written. The owner should confirm this is intended (Q-15). **[M]**
- **ART-2** n counts Artificers **currently alive** on the board, not those deployed at the start. If n drops and the existing dummies or mines exceed the new cap, nothing is destroyed. New ones simply cannot be created until the count is back under the cap. **[M]**
- **ART-3** "(All artificers;" means the cap is shared by the whole army, not per Artificer. **[H]** A destroyed dummy or an exploded mine frees its slot immediately. **[H]**
- **ART-4** Dummies and mines survive the death of the Artificer that made them (G-24) and keep counting toward the cap. **[M]**
- **ART-5** A newly created dummy can act on the same turn: there is no summoning sickness. **[L]** It is adjacent to its creator, so Mad inventor already applies and it may Move for 1 AP.
- **ART-6** Mad inventor's condition is checked when the dummy declares its Move. The dummy may then end its move away from the Artificer, after which it can no longer move. **[M]** The +1 Power is checked at attack time. **[H]**
- **ART-7** Only friendly Artificers enable Mad inventor; an enemy Artificer next to my dummy does nothing. **[H]**
- **ART-8** The Artificer's own Mind's Eye (LOV 3) reveals enemy mines on or near its target squares (G-39). It can therefore never accidentally place onto a hidden enemy mine. If Mind's Eye is ruled *not* to reveal mines, placing onto a hidden enemy mine detonates it as the dummy "enters" the square, and a mine placed there detonates the old one. **[L]**
- **ART-9** With Command Aura, an Artificer can create twice in one turn: a dummy plus a mine, or two of either. **[H]**
- **ART-10** Under Sabrina, Trip Mine B20 is removed, the Artificer becomes type-10 (cost 10) and gets +2 Power. Under Kulega it is type-20 and gains Fine Print. **[H]**

### 2.11 Prototype No-ACB (created dummy unit)

Stats: 0/7, size 1, LOV 1, Movement 0 (1 while Mad inventor applies, **[L]**), AP 1, attack range 1. **No type** (G-01), costs no budget, has no abilities.

**Edge cases & decisions**

- **DUM-1** It is a full **unit** (G-02):
  - it blocks movement and provides vision (LOV 1);
  - it can Defend for 1 AP;
  - it can be healed, buffed, targeted, attacked and sacrificed. **[H]**
- **DUM-2** It cannot take the Attack action while its Power is 0, so the player cannot waste AP. It can attack once Power exceeds 0: Strong aura +1, Mad inventor +1, Sabrina +2, the Keep +3. **[M]**
- **DUM-3** It counts as an enemy unit for the Rogue:
  - it blocks Stealth activation (its LOV 1 covers the adjacent squares);
  - it reveals a Rogue by adjacency;
  - when it moves (under Mad inventor) next to a Stealthed Rogue, it triggers Assault, which makes it a cheap Rogue detector. **[H]**
- **DUM-4** It triggers mines when it moves onto one (2.12). **[H]**
- **DUM-5** It has no type, so no Trill bonus, no Kulega trigger when it dies, and no Market action. **[H]** It does get Kulega's +1 LOV and Command Aura's extra action, since those apply to "units". **[M]**
- **DUM-6** Queso may revive it. The revived dummy is the same instance, so its cap slot does not change. **[M]**
- **DUM-7** Objectives: a dummy counts as a unit for capturing and contesting, which makes it a cheap objective holder. **[L]** The owner may prefer to exclude created units (Q-24).
- **DUM-8** Fodder: Julio Vernification deals 7 with it, and Feast heals 7 (2.8, 2.14). **[H]**
- **DUM-9** "it cannot move": no current effect displaces units, so "cannot move" only restricts the Move action. **[H]**

### 2.12 Trip Mine B20 (created hidden object)

- **What it is:** a board object owned by a player, not a unit (G-02).
- **Visibility:** invisible to the opponent until revealed (G-39b); always visible to its owner (G-38).
- **Trigger:** **any unit**, friendly or enemy, enters its square. That includes the Commander and dummies, units passing *through* the square mid-path, and a unit being created on it. **[H]** The owner's pathing note, which warns about walking own units onto own mines, confirms that friendly units trigger mines.
- **Effect:** the mine explodes once. The unit on the square takes 5 ability damage, or 10 if its size is 2 or more (the Beast). Then the mine is removed. **[H]**
- **Remote detonation:** a ranged attack (attack range >= 2; today the Ranger) aimed at the mine's square detonates it (G-37). If no unit is on the square, the mine is simply destroyed. There is no splash. **[M]**

**Edge cases & decisions**

- **TMN-1** The move is interrupted: a surviving unit stops on the mine square (G-42). **[M]**
- **TMN-2** A 2x2 Beast triggers a mine when any of its footprint cells enters the mine's square. If one step brings it onto two mines, both explode: 10 + 10. **[M]**
- **TMN-3** Mines are **not** triggered by area effects (Slam splash, Pajazon), melee attacks, Smite (unit-targeted), or units merely adjacent. **[M]**
- **TMN-4** Mines do not block movement or placement for the opponent; they don't know about them. A square with an own mine is not "free" for the owner's own placements. **[M]**
- **TMN-5** Mine damage is not dealt by a unit, so Ratasius' weakness and the Keep never modify it. **[M]** Target-side reductions do apply:
  - Paladin: 5 becomes 2
  - Forcefield: 1
  - Defend: 3
  - Line Formation: 3 **[H]**
- **TMN-6** **Own mines are deadly to one's own 1/1 Commander.** The pathing confirmation (G-43) should be mandatory for the Commander even when the player has turned the warning off. **[L]**
- **TMN-7** Flying units: none exist. If they are added later, give them a keyword `ignoresMines`. Size 2 or more takes +5, per the spec. **[H]**
- **TMN-8** A revealed mine shows a marker to the opponent, who can route around it or shoot it. A mine detonated in fog shows its explosion to whichever player sees that square, and the owner is always told that their mine went off. **[M]**
- **TMN-9** Mines are created only during play, by an Artificer standing next to the square, never during deployment. **[H]**

### 2.13 Royal wizard (type-50)

> Royal wizard, 10/20, 1, 3, 1, 3
> Forcefield:2: Choose 4 adjacent squares in wizards LOV. Damage received to friendly units inside the forcefield reduced by 8. CD 1 turn
> Pajazon:3: Create an area of 3x3, with center at range 3, for 2 turns. At the end of your turn, allied units in the area regenerate 3 toughness; At the end of the opponent's turn, enemy units take 3 damage. CD 1 turn

**Forcefield**

- **Kind:** active. **Cost:** 2 AP. **Uses the action. Cooldown:** 1 (G-19: usable every other own turn).
- **Target:** 4 squares that form **one orthogonally connected group** (any tetromino: I, O, T, L, J, S, Z), each square inside the Wizard's LOV. **[M]** That is distance <= 3, or 4 under Kulega. The Wizard's own square may be part of it.

  ```
  O: F F    I: F F F F    T: F F F    L: F .    S: . F F
     F F                     . F .       F .       F F .
                                         F F
  ```

- **Effect:** while active, every damage instance received by a **friendly** unit standing on one of the 4 squares is reduced by 8 (pipeline step 4, floored at 1).
- **Duration:** until the start of the Wizard controller's next turn. **[L]** No duration is stated, so G-22 applies.

**Pajazon**

- **Kind:** active. **Cost:** 3 AP. **Uses the action. Cooldown:** 1.
- **Target:** a centre square at distance <= 3 from the Wizard **[M]**, including the Wizard's own square. The area is the 3x3 block around the centre (G-08).

  ```
  y=4  . a a a .
  y=3  . a C a .      W = Wizard, C = centre (distance 3), a = area
  y=2  . a a a .
  y=1  . . . . .
  y=0  . . W . .
  ```

- **Duration:** 2 of the caster's own turns (G-21). Cast on own turn T, the area is removed at the start of own turn T+2. **[L]**
- **Ticks:**
  - at the end of each own turn while active, each friendly unit in the area heals 3 (capped);
  - at the end of each opponent turn while active, each enemy unit in the area takes 3 ability damage.
  - Positions are read at tick time.

**Edge cases & decisions**

- **WIZ-1** "Choose 4 adjacent squares" could mean three things:
  - (a) the 4 squares adjacent to the Wizard. Rejected: there would be nothing to "choose" (it has exactly 4 orthogonal neighbours), and "in wizards LOV" would be redundant.
  - (b) a 2x2 block only.
  - (c) **any connected tetromino: the default. [M]**
- **WIZ-2** Duration alternatives: "2 turns like Pajazon", or "until the cooldown ends". With the default, a Wizard can alternate Forcefield and Pajazon every turn. Pajazon stays up permanently (WIZ-6) and Forcefield covers every other opponent turn. **[L]**
- **WIZ-3** The Forcefield squares are fixed: they do not move with the Wizard or the units. Only the Wizard player's units benefit; enemies standing inside get nothing. **[H]**
- **WIZ-4** Forcefields do not stack: a unit inside two Forcefields gets -8, not -16 (G-41). The floor of 1 means a Forcefield never makes a unit immune. **[M]**
- **WIZ-5** A 2x2 Beast is protected if any of its cells is inside (G-07). The Forcefield applies to all damage, mines and Pajazon ticks included. **[M]**
- **WIZ-6** Pajazon "center at range 3" means distance up to 3. **[M]** "2 turns" gives **2 heal ticks and 2 damage ticks**, and the first heal happens at the end of the casting turn. With CD 1 the Wizard can recast exactly when the old area expires, so one Pajazon per Wizard can be up 100% of the time. **[L]**
- **WIZ-7** Two Wizards' Pajazons overlapping do not stack: a unit heals or takes 3 at most per tick (G-41). **[M]** The alternative is that they stack (6 per tick). **[L]**
- **WIZ-8** Pajazon hits invisible enemies. It reveals a Stealthed Rogue if the Rogue's square is in the Wizard player's LOV. The outer ring can lie at distance 4, outside the Wizard's LOV 3; ticks still apply there, out of sight. **[H]**
- **WIZ-9** Order at the end of the opponent's turn: Pajazon damage first, then their own end-of-turn heals (G-10). **[M]**
- **WIZ-10** Ratasius' weakness never affects Pajazon ticks, because they are delayed effects (3.5). **[M]**
- **WIZ-11** Both effects persist if the Wizard dies (G-24). Both are visible to the opponent wherever the opponent has vision; they are not hidden. **[M]**
- **WIZ-12** An enemy 1/1 Commander that ends its turn inside a Pajazon dies. A friendly Commander inside is healed. **[H]**
- **WIZ-13** Casting both in one turn needs 2 actions (Command Aura): 2 + 3 = 5 AP. Each ability's cooldown is separate (G-20). **[H]**
- **WIZ-14** The squares can include blocker or occupied squares, but none outside the board. A Pajazon area that is partly off-board is fine. **[M]**

### 2.14 Beast of Knorund (type-50, size 2)

> Beast of Knorund, 20/40, 2, 2, 2, 3
> Forceful slam:4: Deal 10 damage to an adjacent square, and 3 damage to the 5 opposite adjacent squares of the target. CD 1 turn
> Feast:2: Sacrifice an adjacent unit: Gain life equal to its toughness

The Beast occupies a 2x2 footprint (G-07). Its LOV, attack range and adjacency are all measured from its nearest cell.

**Forceful slam**

- **Kind:** active. **Cost:** 4 AP. **Uses the action. Cooldown:** 1.
- **Target:** one square T adjacent to the footprint (8 choices under ORTHO_4). T may be empty, or may hold a friendly unit (the UI asks for confirmation). **[M]**
- **Geometry (proposed exact rule):** let `d` be the unit vector from the footprint cell touching T toward T. The splash set is `S = { T + v : v in the 8 neighbour offsets, dot(v, d) >= 0 }`, which is always **5 squares**: the 3 behind T and the 2 beside it. **[M]**
- **Effect:**
  - 10 ability damage to the unit on T.
  - 3 ability damage to each unit on the S squares. **Friendly fire applies to both** (G-03: the targets are squares). **[M]**
  - A unit covering T and some S squares (another 2x2) takes only the 10. A unit covering several S squares takes 3 once (G-07).
  - Resolution is simultaneous (G-27).

```
Case 1: T north of the Beast's left column     Case 2: T north of the right column
x:  -1  0  1  2                                x:  -1  0  1  2
y3   s  s  s  .                                y3   .  s  s  s
y2   s  T  s  .                                y2   .  s  T  s
y1   .  B  B  .                                y1   .  B  B  .
y0   .  B  B  .                                y0   .  B  B  .

Case 3 (only if KING_8 is enabled): T diagonal to the NW corner, d = (-1,+1)
x:  -2 -1  0  1
y3   s  s  s  .
y2   s  T  .  .      (0,2) faces the Beast and is NOT splashed
y1   s  .  B  B
y0   .  .  B  B

Same rule for a size-1 attacker A (future units):
 s s s
 s T s
 . A .
```

**Feast**

- **Kind:** active. **Cost:** 2 AP. **Uses the action.**
- **Target:** a friendly, non-commander unit adjacent to the footprint (G-33). **[M]**
- **Effect:** the target is sacrificed (G-32). The Beast heals by the target's current toughness just before the sacrifice, capped at max (40). **[M]**

**Edge cases & decisions**

- **BEA-1** "the 5 opposite adjacent squares of the target" is read as "the target's neighbours on the side away from the Beast". That is the only 5-square reading that is symmetric and works for every T. **[M]**
- **BEA-2** The Beast's own cells are never in S: they lie on the side `dot(v, d) < 0` by construction. In case 1, S includes (1,2), a square that is also adjacent to the Beast; that is intended. **[H]**
- **BEA-3** Friendly fire is on, as written. The alternative "enemies only" is easier to play but contradicts "to an adjacent square". **[M]**
- **BEA-4** Slam does not trigger mines on T or S (TMN-3). Blocker squares absorb nothing. S squares that fall off the board are ignored. T must be on the board. **[M]**
- **BEA-5** Slam hits invisible units in T or S. A Rogue on T is adjacent to the Beast, so it is already revealed. A Rogue on an S square (distance 2) is revealed by the damage, since it is inside the Beast's LOV of 2. **[H]**
- **BEA-6** If the Beast is within distance 1 of Ratasius, both numbers drop by 4: 6 and 0. The 0-damage squares deal nothing (G-26). **[M]**
- **BEA-7** Slam is ability damage, so the Keep's +3 does not apply, while Defend, Armor, Line Formation and Forcefield do. **[M]**
- **BEA-8** **Feast targets allies only.** Eating an adjacent enemy would be a 2-AP instant kill of anything (an Emissary with 50 toughness) plus a full heal. **[M]**
- **BEA-9** "Gain life" is a heal, with no overheal past 40 (G-29). **[M]** The alternative, overheal allowed, is **[L]**. Feasting at full toughness is blocked by the UI so a misclick can't waste a unit. **[M]**
- **BEA-10** Feast triggers Kulega and Queso like any death (G-32). Feasting on a dummy heals 7. **[H]**
- **BEA-11** Size 2 under mines: 5 + 5 = 10 per mine, and one step can enter two mines (TMN-2). **[H]**
- **BEA-12** A 2x2 unit's Move action: the whole footprint shifts one orthogonal step at a time, and every destination cell must be free. This belongs to the core rules; it is listed here because Assault and mine checks run on each step. **[M]**

### 2.15 Celestial Emissary (type-100)

> Celestial Emissary, 15/50, 1, 4, 2, 4
> Holy blessing:3: Heal ally units in a range of 2 by 5
> Smite:3: Deal 8 damage to a unit, at a range of 3.
> Holy Fervor: This unit can take 2 actions per turn. The second action costs 1 extra AP

**Holy blessing**

- **Kind:** active. **Cost:** 3 AP. **Uses the action.** No target choice.
- **Effect:** every friendly unit at distance <= 2 from the Emissary heals 5 (capped). **The Emissary is included. [L]**
- **Cooldown:** none.

**Smite**

- **Kind:** active. **Cost:** 3 AP. **Uses the action.**
- **Target:** one visible unit at distance <= 3 ("at a range of 3" means up to 3, **[M]**). Any allegiance; the UI asks for confirmation if the target is friendly. **[M]**
- **Effect:** 8 ability damage through the full pipeline.
- **Cooldown:** none.

**Holy Fervor**

- **Kind:** passive (no cost listed; a static rule, G-14).
- **Effect:** the Emissary may take 2 actions per turn. Its second action costs its normal cost + 1 AP, whatever that action is: Move, Attack, Defend or an ability.

**Edge cases & decisions**

- **CEL-1** Holy blessing includes the Emissary itself. **[L]** The Scourge's text has to *say* "Doesn't include this unit", which implies that "units in range" includes the source by default. The alternative is to exclude it.
- **CEL-2** Holy blessing affects friendly units only ("ally units"). It heals own Stealthed units without revealing them. Its visual effect is shown to the opponent only where the opponent has vision. **[H]**
- **CEL-3** Smite targets "a unit", not a square, so it cannot detonate mines. It is not a "ranged attack" in the mine's sense (RNG-3). **[M]**
- **CEL-4** Move-once still applies (G-16): Holy Fervor can never mean two Moves. **[H]**
- **CEL-5** The same ability twice is legal, since neither ability has a cooldown. Smite + Smite = 3 + 4 = **7 AP for 16 damage**. Holy blessing twice = 3 + 4 = 7 AP for +10 to everyone in range. **[H]**
- **CEL-6** Order does not change the total: Move (4) then Smite (3+1) = 8 AP; Smite (3) then Move (4+1) = 8 AP. **[H]**
- **CEL-7** With Command Aura, the Emissary has 3 actions. **Every action after the first costs +1** (the second and the third). **[L]** A literal reading would surcharge only the second action, which makes the third cheaper than the second. That is odd, so it is rejected.
- **CEL-8** If the Emissary is within distance 1 of Ratasius, its Smite deals 4. **[M]**

### 2.16 Scourge of the Gods (type-100)

> Scourge of the Gods, 15/33, 1, 3, 2, 3
> Command Aura:P: Units within range 2 of this unit can take an additional action each turn. Doesn't include this unit.

**Command Aura**

- **Kind:** passive aura. **Cost:** none.
- **Affects:** friendly units at distance <= 2 from the Scourge, not the Scourge itself. **[H]**
- **Effect:** +1 action allowance for the turn.
- **Grants no AP. [H]** The extra action is paid at its normal cost (G-15). This answers the brief's question.

**Edge cases & decisions**

- **SCO-1** The check happens when a unit declares an action beyond its normal allowance: the unit must be within distance 2 *at that moment*. **[M]**
  - A unit that moves *into* range with its first action may take a second one.
  - A unit that moves *out of* range with its first action may not.
- **SCO-2** Two Scourges still give +1 (G-41). It stacks with the Market and with Holy Fervor, which are different sources (G-15). A Footman in the Market zone and in Command Aura gets 3 actions, but still only one Move. **[M]**
- **SCO-3** An ability on cooldown cannot be used twice in one turn: the cooldown starts on use. Savagery stays once per turn. **[H]**
- **SCO-4** It includes dummies and the Commander. A Commander with 2 actions can Move then Attack, or Attack then Defend. **[M]**
- **SCO-5** If the Scourge dies mid-turn, actions already taken stand. Units that have not yet used their extra action lose it immediately (G-24). **[M]**
- **SCO-6** Enemy units within distance 2 never benefit. **[H]**
- **SCO-7** A 2x2 Beast is in range if any of its cells is within distance 2 (G-07). **[M]**
- **SCO-8** Balance note: Berserker + Scourge = 3 attacks for 4 AP (BER-5). Wizard + Scourge = Forcefield + Pajazon in one turn (WIZ-13).

### 2.17 Commander (base unit)

> The objective of each player is to defeat the commander of each party. The commander is by default a 1/1 unit, movement and AP of 1, LOV of 3, and doesn't count from the budget. Another way of winning is if you manage to bring your commander to the opposite side of the board. More specifically, to the last row.

- **Stats:** 1/1, size 1, LOV 3, Movement 1, AP 1, attack range 1. No type (G-01), free.
- **Actions:** Move, Attack, Defend. It has no ability of its own; the chosen commander identity (section 3) changes its stats and grants army-wide effects.

**Edge cases & decisions**

- **CMD-1** The Commander can never be sacrificed (Julio, Feast). It may be a Shared wounds donor, because that cannot kill it. **[H]** / **[M]**
- **CMD-2** It receives friendly auras and effects like any unit:
  - Strong aura (becomes 2/2)
  - Forcefield
  - Pajazon heal
  - Holy blessing
  - Command Aura
  - Queso's beacon

  It also suffers enemy area effects, including Forceful slam friendly fire from its *own* Beast. **[M]**
- **CMD-3** Its death ends the game immediately, with no revive (G-34). If both commanders die at the same time, the game is a draw. **[L]**
- **CMD-4** Its LOV counts for enemy Stealth activation checks and for "receiving damage inside enemy LOV". **[H]**
- **CMD-5** Own mines kill a default 1/1 Commander in one step, hence the stricter pathing rule (TMN-6). **[L]**
- **CMD-6** Win by reaching the last row: the check runs after each step's triggers (mine, then Assault) have resolved (G-42). If the Commander is still alive and standing on a square of the opponent's last row, it wins immediately. **[M]** So a mine on that square, or a Stealthed Rogue next to it, can still stop the Commander. (Core-rules item, listed because of the ability interaction.)
- **CMD-7** The Commander is hidden by fog like any unit; it is never auto-revealed. **[M]**

---

## 3. Commanders

General rules for all commanders:

- A commander's bonuses apply only to its own player's units (G-03) **[H]**.
- They apply for the whole game, including to units created later (dummies) and units revived later **[H]**.
- They apply from deployment onward, and the army builder must show the modified stats and prices **[H]**.
- One commander per player; commanders never combine **[H]**.

### 3.1 Trill "The Hydrocephalic"

> Trill "The Hydrocephalic": All units of type 1, 2, 5 gain 2 toughness. The commander has toughness 10.

- **Kind:** static.
- **Effect:**
  - Every friendly unit of type 1, 2 or 5 gets +2 base toughness: +2 max and +2 starting current, a permanent part of `baseToughness` (G-29).
  - The Commander's base toughness is **10** (a 1/10 Commander): the value replaces the default 1, it is not 1 + 10.

Resulting stats:

| Unit | Normal | Trill |
|---|---|---|
| Footman | 1/2 | 1/4 |
| Mercenary | 2/1 | 2/3 |
| Soldier | 2/7 | 2/9 |
| Ranger | 3/1 | 3/3 |
| Berserker | 12/2 | 12/4 |
| Rogue | 7/4 | 7/6 |
| Commander | 1/1 | 1/10 |

**Edge cases & decisions**

- **TRI-1** "gain 2 toughness" is permanent base toughness, not a temporary aura, so it counts for every "base hp" check: the Shared wounds cap, revive amounts and Kulega amounts. **[H]**
- **TRI-2** Higher toughness also raises Julio Vernification damage when these units are sacrificed: a Soldier deals 9. **[H]**
- **TRI-3** Dummies have no type, so no bonus. **[H]**
- **TRI-4** "The commander has toughness 10" is read as **10**, not 1 + 10. **[H]**
- **TRI-5** A 1/10 Commander survives one own-mine step, one Pajazon tick or one Smite, which makes "walk to the last row" far more viable under Trill. Balance note for the owner.

### 3.2 Kulega "The Fine Printer"

> Kulega "The Fine Printer": All units gain 1 LOV. All units of type-20 gain the following ability: When a unit of type 1 or 2 dies adjacent to this unit, regenerate toughness equal to that creature toughness, maximum of 4 per instance.

- **Part 1 (static):** every friendly unit gets +1 LOV, including the Commander (LOV 4) and dummies (LOV 2). **[M]**
- **Part 2 (granted triggered ability "Fine Print")**, given to each friendly type-20 unit (Paladin, Artificer):
  - **Trigger:** a unit of type 1 or 2 dies while adjacent to this unit. Either side's units count. **[L]**
  - **Effect:** this unit heals `min(4, dead unit's baseToughness)`, capped at its own max.

**Edge cases & decisions**

- **KUL-1** "All units gain 1 LOV" means friendly units only, since it is a commander bonus. **[H]** The extra LOV also enlarges:
  - Mind's Eye coverage
  - the Forcefield's "in wizards LOV" area
  - the squares in which enemy Rogues can no longer activate Stealth **[H]**
- **KUL-2** Should enemy deaths count? The text says "a unit of type 1 or 2", unqualified, so **default: either side's. [L]** A Paladin cutting down an adjacent enemy Footman heals 2. The alternative is friendly deaths only (Q-19).
- **KUL-3** "that creature toughness" cannot mean its toughness at death, which is <= 0, so it means its **base toughness** (G-29). **[M]**

  | Dying unit | Kulega heal |
  |---|---|
  | Footman | 2 |
  | Mercenary | 1 |
  | Soldier | 4 (7, capped) |
  | Ranger | 1 |

- **KUL-4** Sacrifices count (G-32). Example: the Beast Feasts on a Soldier next to a Paladin. The Beast heals 7 and the Paladin heals 4. **[M]**
- **KUL-5** One "instance" = one death x one type-20 unit. Two type-20 units adjacent to the same death each heal. Deaths in the same blast each trigger separately. **[M]**
- **KUL-6** Adjacency is judged at the moment of death, before the dead unit is removed. The trigger works on both players' turns. **[H]**
- **KUL-7** Deaths of dummies, commanders or units of type 5 and higher never trigger it. **[H]**

### 3.3 Sabrina "The Reelfinisher"

> Sabrina "The Reelfinisher": Artificers and No-ACBs get 2 additional power. Artificers now are considered type 10. Artificers can no longer use mines. Each other type-20 and above is 20% more expensive to deploy.

- **Effect:**
  - Friendly Artificers +2 Power (becoming 3/15), and friendly No-ACBs +2 Power (becoming 2/7, or 3/7 under Mad inventor).
  - Artificers are **type 10** for every purpose: deploy cost 10 and every type check.
  - Trip Mine B20 is removed from Artificers.
  - Every other unit of type 20 or higher costs x1.2, rounded **up** to an integer.

| Unit | Normal cost | Sabrina cost |
|---|---|---|
| Artificer | 20 | **10** |
| Paladin | 20 | 24 |
| Royal wizard | 50 | 60 |
| Beast of Knorund | 50 | 60 |
| Celestial Emissary | 100 | 120 |
| Scourge of the Gods | 100 | 120 |

**Edge cases & decisions**

- **SAB-1** "type-20 and above" means denomination >= 20: grades 20, 50 and 100. **[H]** "Each other" excludes the Artificers, which are type 10 by then anyway. **[H]**
- **SAB-2** Rounding is irrelevant at today's numbers, since every x1.2 result is an integer. If the budget or costs change, round **up**. **[M]**
- **SAB-3** The surcharge applies to budget cost only, never to AP costs. **[H]**
- **SAB-4** Switching commanders re-prices the army. An army that is legal under another commander may exceed 200 under Sabrina; the builder flags it and blocks Ready. **[H]**
- **SAB-5** "Can no longer use mines" means the ability is removed from the ability bar, not shown greyed out. The mine cap is irrelevant. **[H]**
- **SAB-6** "considered type 10" is also a token-art question: does the token switch to the grade-10 colour? **Default: keep the Artificer's own token and add a "10" badge. [L]**
- **SAB-7** Scaling: up to 20 Artificers (200 / 10) gives up to 3 + floor(19/2) = 12 dummies. Balance note: a dummy wall of 2-power units. **[H]**

### 3.4 Baba Yaga "The Bwitch"

> Baba Yaga "The Bwitch": Units of white gain the ability to regenerate 2 toughness for 2 AP (each instance). Only up to 2 units can regenerate toughness this way per turn. Can be applied twice to the same unit. CD 1

> The color of the token will represent the grade of the unit.

- **Who is "white"?** The spec never maps colours to grades. **Default: white = grade 1 (Footman, Mercenary). [L]**
  - The limit "Only up to 2 units ... per turn" only makes sense if many units are eligible. A 200 budget allows at most two grade-100 units, so a "silver = the 100 coin" reading would make the limit pointless.
  - White is also the conventional colour of the lowest rarity tier.
  - Placeholder palette, so the art lens and this rule agree: 1 white, 2 green, 5 blue, 10 purple, 20 orange, 50 red, 100 gold. The rule keys on **grade**, not on the literal colour, so later art changes do not break it.
- **Granted ability "Bwitch Regeneration"** on each friendly white unit:
  - **Kind:** active. **Cost:** 2 AP per use.
  - **Does not use the unit's action. [L]** "Can be applied twice to the same unit" contradicts the one-action rule otherwise.
  - **Effect:** that unit heals 2, capped.
- **Limits:**
  - at most **2 uses per turn across the whole army**: two different units, or both on the same unit **[L]**;
  - a unit that used it cannot use it during its controller's next own turn (CD 1, G-19) **[L]**.

**Edge cases & decisions**

- **BAB-1** Reading B for the limits: up to 2 *different* units per turn, each up to twice, so up to 4 uses (8 AP) per turn. Rejected as the default because "Can be applied twice to the same unit" reads like a clarification of how the 2 uses may be spent. **[L]**
- **BAB-2** It can be used on the own turn only, since it is paid from the own AP pool. **[H]**
- **BAB-3** With grade-1 units (2 and 1 toughness), one use is a full heal. Max toughness can never be exceeded. **[M]**
- **BAB-4** "CD 1" belongs to the unit, not to the commander. Other white units may still use it, within the per-turn limit. **[L]**
- **BAB-5** Combined with the Market (an extra action for type-1 units), a Footman can Move, Attack and regenerate in one turn. **[M]**
- **BAB-6** If the owner meant "white" to be a *faction* or player colour (white vs black, as in chess), then **all** friendly units would qualify. The 2-per-turn cap would then be the real limiter. Listed for completeness (Q-08).

### 3.5 Ratasius I "The Great"

> Ratasius I "The Great": This commander has LOV of 6. Reveals all invisible enemies in range of 3. Enemies in range of 1 gain weakness and deal 4 less damage

- **Commander stat:** LOV **6**, replacing 3. The other stats stay at the default 1/1, Movement 1, AP 1. **[H]**
- **Detection aura (passive):** every enemy invisible thing within distance 3 of Ratasius is revealed (G-39). That covers Stealthed Rogues, which lose Stealth, and enemy mines **[L]**.
- **Weakness aura (passive):** an enemy unit within distance 1 of Ratasius deals 4 less damage per damage instance (pipeline step 2), floored at **0** **[L]**, against **any** target **[M]**. It applies to attacks (Assault included) and to instant ability damage (Smite, Slam, Julio), based on the dealer's position when the damage resolves. **[M]**

**Edge cases & decisions**

- **RAT-1** "gain weakness" works as an aura only: it lasts exactly while the enemy is within distance 1, with no lingering status. **[M]** The alternative is a status that lasts until the end of that unit's next turn.
- **RAT-2** Weakness affects the unit's damage against everything, not only against Ratasius. **[M]**
- **RAT-3** Delayed or indirect damage is never weakened: mines (not dealt by a unit) and Pajazon ticks. **[M]**
- **RAT-4** The floor decides the matchup. **With floor 0**, Ratasius takes no damage from adjacent attackers with 4 Power or less: Footman, Mercenary (without bonus), Soldier, Ranger at distance 1, Priestess, Juliomancer, Artificer, Commander and dummy. That fits "The Great", and Rangers at distance 2 and Smite at distance 2-3 remain natural counters. With floor 1, every hit still deals at least 1, and his 1 toughness dies to anything. **[L]**
- **RAT-5** A 2x2 Beast is "in range 1" if any of its cells is adjacent. **[M]**
- **RAT-6** **A Stealthed Rogue can never Assault Ratasius. [H]** One orthogonal step changes the distance between two units by at most 1. So any approach, by either unit, passes through distance 3 and then 2, and detection reveals the Rogue there, before the distance can become 1. A *revealed* Rogue can still attack him normally: 7 - 4 = 3, which is lethal to a 1/1 commander. The same logic makes every Mind's Eye unit (LOV 3) immune to Assault (see section 4).
- **RAT-7** The detection range (3) is inside his LOV (6), so detection never needs vision beyond LOV. **[H]**
- **RAT-8** A Mercenary's bonus is weakened as a whole: (2 + bonus) - 4, floored at 0. **[M]**

### 3.6 Queso "The Beacon of hope"

> Queso "The Beacon of hope": This commander's AP is 3, and 3 toughness. Nearby units in range of 2 regenerate 5 health each player turn (not the opponent's turn). When a unit in that area dies you can choose to sacrifice 1 max toughness to revive that unit with half of its base toughness rounded up

- **Commander stats:** **1/3, AP 3**. Each Commander action costs 3 AP; Movement and LOV keep their defaults. **[M]**
- **Beacon (passive, triggered):** at the **end of each of the controller's turns**, every friendly unit within distance 2 of the Commander, **the Commander included** **[L]**, heals 5 (capped). **[M]**
- **Revive (triggered, optional):**
  - **Trigger:** a friendly, non-commander unit dies while within distance 2 of the Commander, on either player's turn.
  - **Prompt:** the controller is asked (G-11).
  - **Cost:** if they accept, the Commander's max toughness drops by 1 permanently, and current is clamped to the new max.
  - **Effect:** the unit returns in the square(s) where it died, with current toughness = `ceil(baseToughness / 2)`. **[M]**

**Edge cases & decisions**

- **QUE-1** "This commander's AP is 3" is read as the Commander's action cost: it is the unit stat the default Commander has as "AP of 1". That makes it a drawback that pays for the strong beacon. **[M]** Reading it as "the player gets 3 AP per turn" is rejected: the default would be 1 AP per turn, too little for any unit with an AP of 2 or more.
- **QUE-2** The heal and the revive both apply to friendly units only. Enemy units within distance 2 are not healed. **[M]**
- **QUE-3** The Commander heals itself. **[L]** By the same logic as CEL-1, the Scourge had to exclude itself explicitly. Combined with 3 toughness, this makes Queso hard to kill without burst damage.
- **QUE-4** Timing is the end of the own turn, the same window as Soldier and Pajazon. **[M]** The alternative is the start of the own turn.
- **QUE-5** **Max toughness can never drop to 0.** A revive is only offered if the Commander's max toughness is at least 2. Queso therefore has at most **2 revives per game** (3 to 2 to 1). **[M]**
- **QUE-6** The revived unit:
  - is the same instance: it keeps cooldowns and cap slots (dummies);
  - loses temporary statuses: Stealth, Defend;
  - keeps its "actions used this turn". If it died on its own turn before acting, it may still act. **[M]**
- **QUE-7** The death square(s) are always free at revival time: the dead unit just vacated them, and a 2x2 Beast gets its 4 cells back. If some future effect occupies them first, the unit appears on the nearest free square(s) within distance 2 of the Commander, chosen by the controller. **[L]**
- **QUE-8** Sacrificed units can be revived (G-32). Julio fodder and Feast fodder can therefore come back once each, at a cost of 1 max toughness per revive. The 2-revive limit (QUE-5) caps the loop. **[M]**
- **QUE-9** A unit that dies in the same resolution as the Commander cannot be revived: the game is already over. **[H]**
- **QUE-10** The area is judged at the moment of death: the dead unit's last position against the Commander's position. **[H]**
- **QUE-11** The max-toughness loss is not damage (G-28): Forcefield and Armor don't apply, and it cannot be Defended. **[H]**
- **QUE-12** A revived unit appearing next to a Stealthed enemy Rogue reveals it, but does not trigger Assault (ROG-4). **[M]**
- **QUE-13** Revive amounts:

  | Unit | Revived at |
  |---|---|
  | Mercenary or Ranger | 1 |
  | Footman | 1 |
  | Soldier | 4 |
  | Priestess | 8 |
  | Paladin | 10 |
  | Beast | 20 |
  | Emissary | 25 |
  | Dummy | 4 |

  **[H]**
- **QUE-14** A revive prompt during the opponent's turn pauses their turn; on timeout the revive is declined (G-11). **[M]**

---

## 4. Cross-ability interaction rulings

Each ruling follows from the defaults above. This list is the basis for an interaction test suite: one test per row.

| # | Interaction | Ruling under the defaults | Refs |
|---|---|---|---|
| X-01 | Rogue vs a Mind's Eye unit (Juliomancer, Artificer) | A Stealthed Rogue can never Assault a Mind's Eye unit. Any approach passes through distance 3, where the Rogue is detected. This assumes blockers do not occlude vision; if they do, an approach from behind a blocker can still Assault. | ROG, JUL, G-42 |
| X-02 | Rogue vs Ratasius | Never Assaultable by an already-Stealthed Rogue (detection range 3); a revealed Rogue's normal attack deals 3 | RAT-6 |
| X-03 | Rogue vs Kulega / Ratasius LOV | Bigger enemy LOV leaves fewer squares where Stealth can be activated | ROG-16, KUL-1 |
| X-04 | Mine or Assault vs a commander stepping onto the last row | The step's triggers (mine, then Assault) resolve first; the commander wins only if it survives on the last-row square | CMD-6, G-42 |
| X-05 | Juliomancer + Artificer dummy | 2 AP (create) + 2 AP (sacrifice) = 7 damage at distance 2, or 8 with Strong aura | JUL-5, DUM-8 |
| X-06 | Juliomancer + Beast or Paladin fodder | 40 or 20 damage. Legal under the defaults; a cap is suggested to the owner | JUL-5, Q-21 |
| X-07 | Queso + Julio / Feast fodder | The fodder can be revived at half base toughness; at most 2 revives per game | QUE-5, QUE-8 |
| X-08 | Kulega + Feast on a type-1/2 unit next to a type-20 | The Beast heals the eaten unit's toughness; the type-20 also heals min(4, base) | KUL-4 |
| X-09 | Defend + Paladin + Forcefield + Line Formation | Halve first, then subtract everything, floored at 1. A defending Paladin in a Forcefield hit for 20 takes 10 - 11, floored = 1 | G-26 |
| X-10 | Enemy Pajazon vs my Soldier at my end of turn | Pajazon damage resolves first, then Soldier regen | SOL-3, G-10 |
| X-11 | Two Wizards: overlapping Pajazons or Forcefields | No stacking: 3 per tick, -8 per hit | WIZ-4, WIZ-7, G-41 |
| X-12 | Scourge + Celestial Emissary | 3 actions; every action after the first costs +1 AP; still one Move | CEL-7, G-16 |
| X-13 | Scourge + Berserker | Up to 3 attacks per turn (Attack, Savagery, Attack = 4 AP) | BER-5 |
| X-14 | Scourge + Market + Footman / Mercenary | 3 actions, one Move: Move, Attack, Attack | G-15, G-16 |
| X-15 | Keep (+3 Power) | Applies to attacks: Berserker 15, Assault 10, Mercenary 5 + bonus. Not to Smite, Slam, Pajazon, mines or Julio | G-25 |
| X-16 | Sabrina + many Artificers | Artificers at 10 each; up to 12 dummies at 2 Power (3 under Mad inventor); no mines | SAB-7, ART caps |
| X-17 | Own mines vs own Commander | A 1/1 Commander dies on its own mine; confirmation always required for the Commander | TMN-6, G-43 |
| X-18 | Forceful slam next to friendly units | Friendly fire; the UI previews every affected unit before confirming | BEA-3 |
| X-19 | Slam splash catching both commanders | Both die at the same time: draw | G-34 |
| X-20 | Strong aura on the Commander | A 2/2 Commander. Leaving the aura cannot kill it (current stays at least 1) | PRI-1, G-30 |
| X-21 | Trill + Line Formation Footmen | A 1/4 Footman in formation takes 1 per Pajazon tick, 3 per mine | FTM-8 |
| X-22 | Ratasius weakness vs Pajazon or mines | Not weakened (delayed or not dealt by a unit) | RAT-3 |
| X-23 | Ranger shooting a suspected Rogue square | Hits it if it is there; reveals it if that square is inside the Ranger player's LOV | RNG-4, ROG R2 |
| X-24 | Ranger shooting own mine | Detonates it (mine clearing); no damage if the square is empty | RNG-4, TMN |
| X-25 | Holy blessing / Queso / Pajazon heals at the same end of turn | All capped heals; order irrelevant | G-10 |
| X-26 | Queso revive vs a death caused at the end of the opponent's turn (Pajazon) | Prompt shown at that moment; game paused until answered or timed out | QUE-14, G-11 |
| X-27 | Command Aura and moving out of range | The second action is only allowed if the unit is still within distance 2 when it declares it | SCO-1 |
| X-28 | Mad inventor dummy walking into a Stealthed Rogue | Triggers the Assault (the dummy is a unit); a cheap Rogue probe | DUM-3 |

---

## 5. Questions for the owner (ranked by impact)

Ranking: **Tier 1** blocks or reshapes the engine and every ability. **Tier 2** changes balance or a unit's identity. **Tier 3** is edge-case polish. Each question names the default implementation will use until the owner answers.

### Tier 1 - engine-wide

1. **Q-01 Factions.** The unit list sits under "### Lojrar Clan", and "### The Empire" is empty. Is the 14-unit roster shared, Lojrar-only, Empire-only, or split one unit per grade per faction? Which 3 commanders belong to which faction?
   - *Default:* shared roster, cosmetic factions, any commander for anyone, with the positional split stored as a hint only (FAC-1, FAC-2).
2. **Q-02 AP income.** "that player will receive a number of Action points": how many per turn? Is the number fixed or does it scale? Does unspent AP carry over?
   - *Default:* 10 per turn, no carry-over (G-12).
3. **Q-03 Action economy.** Does an ability's AP cost **replace** the unit's AP stat or **add** to it? Is using an ability the unit's one action for the turn? And with extra actions (Market, Command Aura, Holy Fervor), does "a single unit can only move once per turn" still hold?
   - *Default:* replaces; yes; yes (G-13, G-14, G-16).
4. **Q-04 Diagonals.** Line 15 says movement is "including diagonals", while line 34 says "The movement is orthogonal". Which is it, and does "adjacent" include diagonals? This decides Line Formation, Fierce attacker, Strong aura, all sacrifice and placement abilities, Rogue reveal and Assault, Kulega and Ratasius.
   - *Default:* orthogonal only, behind a config switch (G-05, G-06).
5. **Q-05 Cooldowns.** Does "CD 1 turn" mean "skip your next turn" or only "once per turn"?
   - *Default:* skip the next own turn (G-19).
6. **Q-06 Durations.** Is Pajazon's "for 2 turns" two of your own turns (2 heal ticks + 2 damage ticks) or two half-turns (1 + 1)? Forcefield states no duration at all.
   - *Default:* 2 own turns; Forcefield lasts until your next turn starts (G-21, G-22, WIZ-2, WIZ-6).
7. **Q-07 Sacrifice.** Can Julio Vernification, Feast and Shared wounds use **enemy** units? Does a sacrificed unit count as "dying" for Kulega and Queso?
   - *Default:* own units only (never the Commander); yes, a sacrifice is a death (G-32, G-33).

### Tier 2 - balance and unit identity

8. **Q-08 Baba Yaga's "white".** Which grade (or faction or player colour) is "white"? Are the limits "2 uses per turn in total" or "2 units, twice each"? Is the regen an action of the unit?
   - *Default:* white = grade 1; 2 uses per turn in total; not an action; CD 1 per unit (3.4).
9. **Q-09 Rogue Assault.**
   - Does it also fire when the Rogue itself moves next to an enemy on its own turn?
   - Does it resolve before the "1 square away" reveal? (It must, or it never works.)
   - Does it stop the enemy's movement?
   - *Default:* yes / yes / yes (2.6).
10. **Q-10 Mines.**
    - Do Mind's Eye and Ratasius reveal mines?
    - Which attacks count as "ranged attack": only the Ranger, or Smite too?
    - May a ranged unit attack an empty square?
    - Please confirm that a player's own units trigger their own mines.
    - *Default:* yes; Ranger only; yes; yes (G-37, G-39, 2.12).
11. **Q-11 Damage math.**
    - Order: Defend halving before flat reductions, or after?
    - Does Forcefield also floor at 1 (no immunity)?
    - Can Ratasius' "deal 4 less damage" reduce a hit to 0?
    - *Default:* halve then subtract; floor 1 for every target-side reduction; weakness floors at 0 (G-26).
12. **Q-12 Extended deployment.** "Some units can be deployed in the extended deployment area": which units? No unit line says so.
    - *Default:* keyword `Vanguard` on Rogue and Ranger (G-45).
13. **Q-13 Beast of Knorund.** Is size 2 a 2x2 footprint? Is the proposed Forceful slam geometry right (the 3 squares behind the target + the 2 beside it)? Does Slam hurt friendly units?
    - *Default:* 2x2; the diagrammed geometry; friendly fire on (2.14).
14. **Q-14 Overheal.** Can any heal exceed max toughness? This matters most for Feast ("Gain life").
    - *Default:* no overheal anywhere (G-29).
15. **Q-15 Artificer caps.** Dummies use "every two artificers beyond the first", mines use "each artificer beyond the first": is the difference intended? Does the cap count living Artificers or deployed ones? Do dummies and mines survive their creator?
    - *Default:* literal formulas; living Artificers; they survive (2.10).
16. **Q-16 Stacking.** Do two Priestesses give +2/+2? Do two Forcefields give -16, two Pajazons 6 per tick, two Scourges +2 actions?
    - *Default:* same-named effects never stack (G-41).
17. **Q-17 Queso.**
    - Is "AP is 3" the Commander's action cost?
    - Does the beacon heal Queso himself?
    - Where and how does a revived unit return?
    - May max toughness reach 0?
    - *Default:* yes / yes / same square, same instance, statuses cleared / no, so at most 2 revives (3.6).
18. **Q-18 Forcefield shape.** "Choose 4 adjacent squares in wizards LOV": any connected 4-square shape, a 2x2 only, or the 4 squares around the Wizard?
    - *Default:* any connected tetromino (WIZ-1).
19. **Q-19 Kulega.** Do *enemy* type-1/2 deaths next to my type-20 units heal them? Is "that creature toughness" its base toughness?
    - *Default:* yes, either side's; base toughness, capped at 4 (3.2).
20. **Q-20 Ratasius' weakness.** Aura only, or a lingering status? Does it reduce the weakened unit's damage against every target, or only against Ratasius?
    - *Default:* aura only; every target (3.5).
21. **Q-21 Julio Vernification ceiling (suggestion).** Sacrificing the Beast deals 40 damage. Should damage be capped (for example at 15) or halved?
    - *Default:* uncapped, as written (JUL-5).

### Tier 3 - polish and edge cases

22. **Q-22 Celestial Emissary.** Does Holy blessing heal the Emissary itself? With Command Aura (3 actions), does the third action also cost +1?
    - *Default:* yes; yes (CEL-1, CEL-7).
23. **Q-23 Savagery timing.** Must the extra attack follow immediately, or may it come later in the same turn?
    - *Default:* any time later that turn (BER-2).
24. **Q-24 No-ACB dummies.** Movement when Mad inventor applies? Can a dummy act on the turn it is created? Can it capture or contest objectives?
    - *Default:* 1 square; yes; yes (2.11).
25. **Q-25 Shared wounds.**
    - Cost (none listed)?
    - Rounding of "half"?
    - Recipient range?
    - Is overflow lost?
    - *Default:* 2 AP; round down (the donor never dies); adjacent recipient; overflow is lost (2.7).
26. **Q-26 Mercenary.** Does the attacking Mercenary count itself for Fierce attacker?
    - *Default:* no (MER-1).
27. **Q-27 Sabrina.** Does an Artificer that is "considered type 10" change its token colour? Rounding rule for future prices?
    - *Default:* badge only; round up (SAB-2, SAB-6).
28. **Q-28 Simultaneous commander deaths** (possible through Forceful slam splash): draw?
    - *Default:* draw (G-34).
29. **Q-29 Take-back and hidden information.** May an action that revealed hidden information be taken back?
    - *Default:* no (G-44).
30. **Q-30 Stealth activation UX.** If an unseen enemy watches the Rogue, should the Stealth button be disabled (leaks "someone sees you") or should the attempt fail with the AP spent?
    - *Default:* disabled with a hint (ROG-2).

---

## Appendix A. Tunable constants (defaults used by this document)

| Constant | Default | Ref |
|---|---|---|
| `ADJACENCY` | `ORTHO_4` (Manhattan) | G-05 |
| `AP_PER_TURN` / `AP_CARRYOVER` | 10 / false | G-12 |
| `ABILITY_COST_MODE` | replaces unit AP | G-14 |
| `COOLDOWN_MODE` | skip N own turns | G-19 |
| `REACTION_TIMEOUT_S` | 20 (timeout = decline) | G-11 |
| `DAMAGE_ORDER` | source mods, then Defend halving, then flat reductions | G-26 |
| `TARGET_REDUCTION_FLOOR` / `WEAKNESS_FLOOR` | 1 / 0 | G-26, RAT-4 |
| `SAME_NAME_STACKING` | false | G-41 |
| `AURA_LOSS_CAN_KILL` | false (current stays at least 1) | G-30 |
| `OVERHEAL` | false | G-29 |
| `SACRIFICE_COUNTS_AS_DEATH` / `SACRIFICE_ENEMIES` | true / false | G-32, G-33 |
| `MIND_EYE_REVEALS_MINES` | true | G-39 |
| `SQUARE_ATTACKS` (ranged) | true | G-37 |
| `MERC_COUNTS_SELF` | false | MER-1 |
| `SAVAGERY_WINDOW` | rest of the turn | BER-2 |
| `SHARED_WOUNDS_COST` / rounding / range | 2 AP / floor / adjacent | 2.7 |
| `DUMMY_CAP(n)` / `MINE_CAP(n)` | 3 + floor((n-1)/2) / 5 + (n-1), n = living Artificers | 2.10 |
| `DUMMY_MOVE` / `DUMMY_SUMMONING_SICKNESS` | 1 / false | 2.11 |
| `FORCEFIELD_SHAPE` / `FORCEFIELD_DURATION` | connected tetromino / until own next turn | WIZ-1, WIZ-2 |
| `PAJAZON_CENTER_RANGE` / `PAJAZON_DURATION` | <= 3 / 2 own turns | WIZ-6 |
| `SLAM_FRIENDLY_FIRE` | true | BEA-3 |
| `HOLY_BLESSING_INCLUDES_SELF` | true | CEL-1 |
| `HOLY_FERVOR_SURCHARGE` | +1 on every action after the first | CEL-7 |
| `COMMAND_AURA_RANGE` | 2, checked when the extra action is declared | SCO-1 |
| `KULEGA_ENEMY_DEATHS` / cap | true / 4 | 3.2 |
| `SABRINA_SURCHARGE` | x1.2, rounded up | 3.3 |
| `BABA_WHITE_GRADES` / uses per turn / per unit | [1] / 2 / 2 | 3.4 |
| `RATASIUS_WEAKNESS` | -4, aura only, all targets, not for delayed damage | 3.5 |
| `QUESO_SELF_HEAL` / timing / min max toughness | true / end of own turn / 1 | 3.6 |
| `VANGUARD_UNITS` | Rogue, Ranger | G-45 |
| `SIMULTANEOUS_COMMANDER_DEATH` | draw | G-34 |
| `TAKEBACK_BLOCKED_ON_REVEAL` | true | G-44 |
| `GRADE_COLORS` (placeholder) | 1 white, 2 green, 5 blue, 10 purple, 20 orange, 50 red, 100 gold | BAB |
