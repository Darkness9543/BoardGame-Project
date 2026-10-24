# Rules-Lawyer Review: Core Rules

**Source:** `docs/SPEC.md` (the owner's spec, 2026-10-24). `L15` means line 15 of that file.
**Scope:** core rules only: AP economy, turn structure, actions, movement, distance and adjacency, unit size, board shape, deployment, vision and fog, combat math, toughness and death, army building and costs, commander and victory, neutral buildings, take-back and timing. Individual unit and commander abilities belong to another analyst. I cite them only as evidence for a core rule, or where a core rule decides how they work. Section 2.14 lists the ability-level questions I noticed and handed over.
**Method:** a line-by-line read. Every number claimed below was checked with a short script: LOV counts, board square counts, zone sizes, the Forceful slam square count and the Size-2 neighbour counts.

**Confidence scale**
- **High**: the text supports it, or it's the only workable reading.
- **Med**: the most likely intent, but a plausible alternative exists. Safe to build on and cheap to change.
- **Low**: a placeholder so work isn't blocked. The owner should decide.

**IDs:** `C-` contradiction · `U-` undefined/missing · `D-` proposed default · `Q-` question for the owner. Every default mentioned in sections 1–2 also appears in the table in section 4.

## At a glance: the 12 gaps that block a playable first build

| # | Gap | Default we'll build | Conf. | Ask |
|---|---|---|---|---|
| 1 | AP per turn is never stated (L9) | 10 AP per player per turn, refilled each turn, no carry-over | Low | Q3 |
| 2 | Diagonal (L15) vs orthogonal (L34) movement | Orthogonal steps only; a diagonal costs 2 | High | Q5 |
| 3 | "Adjacent" vs "range" | Adjacent = 8 surrounding squares; range = Manhattan distance; melee = the 4 orthogonal squares | Med | Q5 |
| 4 | One action per unit per turn (L35) | Move **or** attack **or** defend **or** ability, not move + attack | High (text) | Q2 |
| 5 | AP per action or per unit; ability cost vs unit AP | Paid per action; an ability's cost replaces the unit's AP | Med / Low | Q3 |
| 6 | Size-2 footprint | 2×2 block, no facing | Med | Q4 |
| 7 | "Corners cut off with a radius of 4" | Rounded-corner rule A: 593 squares, 8 removed per corner | Low | Q13 |
| 8 | The Empire has no units (L59–60) | Lojrar-only v1, mirror matches | Low | Q6 |
| 9 | Fog of war needs someone to keep information hidden | One authority holds the full state; each player gets only their view | High | Q1 |
| 10 | Damage/HP model | MTG-style persistent damage; death at 0, checked immediately | Med | Q9 |
| 11 | Neutral building capture timing | Checked at the end of every turn; bonuses for the controller's units only | Med | Q12 |
| 12 | Take-back scope | Undo within your own latest turn until the opponent acts; opponent must accept | Low | Q8 |

---

## 1. Contradictions

### C-01 · Diagonal vs orthogonal movement
> L15 "all units (unless specified) share the actions of movement (1 square by default, including diagonals)"
> L34 "The movement is orthogonal, a movement-piece cannot be diagonal. For instance: A unit with movement 2 can move left then up to complete a diagonal movement."

L15 lets a Movement-1 unit step diagonally (8 directions). L34 forbids every diagonal step and says a diagonal move needs Movement 2. The rest of the spec sides with L34:
- L37 builds vision "using this logic": LOV 1 = the 4 orthogonal squares.
- L45 has to add "(including corners)" to make the capture zone include diagonals, so a range-1 area normally *excludes* corners.
- L34 is the more detailed rule, with a worked example, in the section that defines the Movement stat.

**Default D-M1:** orthogonal steps only. Each step goes to one of the 4 orthogonal neighbours, and a diagonal displacement costs 2 movement. L15's "including diagonals" is treated as a leftover from an earlier draft. **Confidence: High.**

### C-02 · "Adjacent" seems to mean 8 squares while everything else is 4-directional
> L37 "A LOV of 1 will only show the 4 orthogonal adjacent squares."
> L110 "Deal 10 damage to an adjacent square, and 3 damage to the 5 opposite adjacent squares of the target."
> L45 "in range of 1(including corners) of that building"

Movement, LOV and (by implication) range are 4-directional. But the spec's own use of "adjacent" needs 8 neighbours:
- L37 says "*orthogonal* adjacent", which implies some adjacent squares aren't orthogonal.
- L110's "5 opposite adjacent squares" only works if a square has 8 neighbours: drop the 3 on the attacker's side and 5 remain, whether the target is straight ahead or diagonal. With 4 neighbours you get 3 for a straight target and 2 for a diagonal one (checked by script).

"Adjacent" drives a lot of abilities: Line Formation (L64), Fierce attacker (L67), Strong aura (L86), Shared wounds (L87), Julio Vernification (L91), Prototype and Trip Mine placement (L99, L101), Mad inventor (L100), Forcefield (L106), Forceful slam (L110), Feast (L111) and Kulega (L125).

**Default:** two separate terms, each with its own distance.
- **D-G3:** "adjacent" = the 8 surrounding squares, corners included (Chebyshev distance 1).
- **D-G2:** "range N" = Manhattan distance ≤ N.
- **D-G4:** the default attack reach is range 1, i.e. the 4 orthogonal squares. The Ranger's "range of 2" (L74) implies the default is range 1, and LOV 1 (the minimum, L37) covers exactly those 4 squares.

**Confidence: Med.** Two side effects to accept knowingly. A unit can be diagonally *adjacent* to an enemy it can't melee. And LOV-1 units (Footman, Mercenary) can't see their own diagonal neighbours. The alternative is to make everything 4-directional and give Forceful slam an explicit shape template.

### C-03 · "Move once per turn" vs "one action per turn" once a unit gets extra actions
> L11 "Unless stated otherwise, a single unit can only move once per turn."
> L35 "A unit can only use one action per turn, unless stated otherwise."
> L53 "all type-1 unit have an additional action per turn" · L117 "This unit can take 2 actions per turn." · L120 "Units within range 2 of this unit can take an additional action each turn."

If a unit only has one action, L11 is redundant. The two rules only differ once a unit has 2 or more actions: can an extra action be a second move?

**Default D-T4/D-T5:** two separate limits.
- (a) Each unit has an action allowance per turn: 1 by default, raised by the Market, Command Aura or Holy Fervor.
- (b) At most one of those actions may be a Move, unless an effect says otherwise.

So a Market Footman can move + attack or attack + attack, but not move + move. **Confidence: Med.** This also stops extra actions from becoming double-speed rushes, especially toward the commander's goal row.

### C-04 · Is AP paid per unit "used" or per action?
> L7 "each unit has an action cost, which will scale depending on the relative power of that unit."
> L9 "The player can use those action costs to use a number of units that fit its budget."
> L117 "Holy Fervor: This unit can take 2 actions per turn. The second action costs 1 extra AP"

L9 reads as *pay a unit's AP once to use it this turn*. L7's "action cost" reads as *pay every time it acts*. With one action per unit the two are identical; they split as soon as extra actions exist:

| | Pay once per unit used | Pay per action |
|---|---|---|
| Market or Command Aura extra action | free | costs the unit's AP again |
| Celestial Emissary taking 2 actions (AP 4) | 4 + 1 = **5** | 4 + (4+1) = **9** |

**Default D-A3:** pay per action. Every action is paid when it's taken, extra actions are paid at the unit's AP, and Holy Fervor's second action costs AP + 1. **Confidence: Med.** Paying once per unit would make Command Aura very strong: a Beast within range 2 of a Scourge would get two actions for 3 AP.

### C-05 · Must the whole budget be spent?
> L3 "must spend that money to acquire any combination of units that can fit the budget"

"Must spend" conflicts with "can fit". **Default D-B2:** army cost ≤ budget. Leftover money is allowed and does nothing. **Confidence: High.**

### C-06 · Is the commander optional?
> L3 "each player can choose a commander, which will give bonuses to units or strategies."
> L32 "The objective of each player is to defeat the commander of each party."

If the commander were optional, a player without one couldn't lose the main way. **Default D-K1:** every player has exactly one commander and must pick one of the six named ones ("can choose" means choosing *which*). Both players may pick the same one. **Confidence: Med.**

### C-07 · Attacks target a unit, but mines are set off by attacking a square
> L15 "attack (attacking units deals damage to the toughness of a target unit)"
> L101 "Mines can be triggered from distance by attacking the square with a ranged attack."

**Default D-C3:** an attack targets a **square**. A legal target square is:
- (1) within the attacker's range,
- (2) inside the attacking player's current vision, and
- (3) not occupied by a friendly unit.

Whatever is on the square gets hit: a visible unit, an invisible unit or a mine. Attacking a square that looks empty is allowed and still costs the action and its AP. **Confidence: Med.**

### C-08 · The Keep and Market buff "all units", yet players capture them
> L52 "While the keep is active, all units receive a bonus of 3 power."
> L53 "While the market is active, all type-1 unit have an additional action per turn."

Read literally, "all units" includes the enemy, which would make capturing pointless. **Default D-O2:** "active" means controlled by a player, and the bonus applies only to the controller's units (for the Keep, that includes the commander and created units such as Dummies). **Confidence: High.**

### C-09 · "Usually opposing" deployment vs the "last row" win
> L29 "Each player gets a portion of the map, at the edges and usually opposing each other"
> L32 "bring your commander to the opposite side of the board. More specifically, to the last row."

If deployment zones were ever on adjacent edges, "opposite side" and "last row" would mean nothing. **Default D-P1/D-K5:** v1 scenarios always use opposite edges, and each scenario stores a goal row per player (by default, the opponent's back row). **Confidence: Med.**

### C-10 · Two factions and "2 variations" per coin, but The Empire is empty
> L5 "Each unit represents a coin, and like coins, each unit has 2 variations."
> L43 "The game features, for now, 2 clans or factions."
> L59–60 "### The Empire" followed immediately by "### Lojrar Clan"

All 14 units (two per denomination) sit under Lojrar Clan, and The Empire has none. There are two readings:
- **(a)** "2 variations" means two units per denomination *per faction*, so the Empire's 14 units are missing.
- **(b)** "like coins" refers to a euro coin's shared face and national face, i.e. **one** unit per denomination per faction. The 14 listed units would then be 7 Empire + 7 Lojrar under a misplaced heading.

The commander list is also split 3 + 3 by a blank line (L124–126 and L128–130), which could be a per-faction split; Sabrina only makes sense with Artificers.

**Default D-B6/D-B7:** reading (a). v1 ships Lojrar Clan only and both players use it (mirror matches). Commanders aren't tied to a faction. The data model allows any number of factions × 7 denominations × any number of units. **Confidence: Low.** This is the owner's call.

### C-11 · Defend's "never less than one" turns a 0-damage hit into 1
> L15 "a defending unit receives half the damage rounded up(never less than one)"

For any hit of 1 or more, rounding up already gives at least 1, so the clause only matters for a hit of 0. Read literally, it raises that to 1, so a defending unit would take *more* damage from a 0-power Dummy than an undefended one. **Default D-C6:** halving and the minimum of 1 only apply to hits of 1 or more; a 0 stays 0. **Confidence: High.**

### C-12 · "Objective" means two things, and "optional" isn't explained
> L32 "The objective of each player is to defeat the commander"
> L45 "the objectives stand as conquest or domination (...). There will be, however, for now, two optional objectives: The keep, The market."

"Objective" covers both the win conditions and the capturable buildings. "Optional" could mean "players don't have to go for them" or "they can be switched off". **Default D-O1:** call them *neutral buildings* in code and UI. They're present in the default scenario, the lobby can switch them off, and holding them never wins the game. **Confidence: Med.**

### C-13 · Six words for (probably) two quantities
> L7 "Power and Toughness" · L19 "recover toughness" · L87 "hp … no more than units base hp" · L91 "its current toughness" · L111 "Gain life" · L130 "regenerate 5 health … sacrifice 1 max toughness … half of its base toughness"

**Default D-H1** (vocabulary used throughout the build):
- **Printed toughness:** the number in the unit line.
- **Base toughness:** printed toughness plus permanent modifiers (Trill's +2, Queso's "sacrifice 1 max toughness").
- **Max toughness:** base toughness plus temporary modifiers (auras).
- **Current toughness:** max toughness minus the damage taken. "hp", "health" and "life" all mean current toughness; "base hp" means base toughness.

**Confidence: Med.**

### C-14 · "AP" and "budget" each mean two things
> L9 "that player will receive a number of Action points. The player can use those action costs to use a number of units that fit its budget."
> L27 "The player will have a budget of 200" · L57 "… Movement, AP, …" · L32 "movement and AP of 1"

"AP" is both the player's per-turn pool (L9) and a unit's price per action (L57, L32, L130). "Budget" is both the army money (L27) and the AP pool (L9). **Default:** code and UI use *AP pool* for the player, *AP cost* for a unit and *army budget* for money. **Confidence: High.**

### C-15 · "Line of Vision" suggests sight lines; the definition is a radius
> L37 "LOV (Line of Vision) or vision, is also determined using this logic."

"Line" suggests walls can block sight, but the definition is a pure distance area. This only matters once blockers exist (L13). **Default D-F2:** vision is a flood fill: the squares reachable in ≤ LOV orthogonal steps without passing through blockers, buildings or cut-off squares. In open ground that is exactly the spec's diamond. Near walls, a wall square is seen but nothing behind it is. **Confidence: Med.**

### C-16 · Savagery is marked passive but has a cost
> L57 "Ability:AbilityCost:Description" · L78 "Savagery:P: After attacking with the berserker, you can spend 2 AP to attack an additional time."

"P" sits in the cost slot, yet the ability costs 2 AP. **Default D-I3:** "P" means the ability doesn't use an action and needs no activation. Any AP amount written in its description is still paid when its optional part is used. **Confidence: Med.**

---

## 2. Undefined or missing

### 2.1 AP economy and turn structure

**U-01 · How many AP per turn?**
> L9 "In each player's turn, that player will receive a number of Action points."

There's no number, no growth rule and nothing about unspent AP.

**D-A1:** **10 AP per player per turn**, the same every turn, refilled at the start of that player's turn. Unspent AP is lost. It's a lobby setting. **Confidence: Low** for the number, **Med** for "fixed, no carry-over".

Why 10:
- A mixed 200-point army (e.g. Emissary + Royal wizard + Paladin + Priestess + 2 Berserkers + 2 Rogues) needs 17 AP, plus 1 for the commander, for everything to act. With 10 AP about half the army acts each turn, so choosing who acts matters. That's the point of per-unit AP costs (L7).
- 10 is also the budget ÷ 20, so it can scale if the budget changes (L27).

For reference, 40 Berserkers would need 40 AP (a quarter of them act each turn), while 2 Scourges need 6 + 1 (everything acts). **The pool size is the biggest balance lever between swarm armies and elite armies.**

**U-02 · What counts as an action, and what costs AP?**
**D-A2:** the actions are Move, Attack, Defend and each active (non-"P") ability, and each one costs AP when it's taken. Passive abilities and automatic triggers (L82 "perform an automatic attack without spending AP") cost nothing and don't use an action. **D-A5:** an action needs enough AP left. AP can't go negative and can't be borrowed. **Confidence: High.**

**U-03 · Does an ability's cost replace the unit's AP or add to it?**
> L57 "Ability:AbilityCost:Description"

**D-A4:** using an active ability **is** the unit's action and costs the listed AbilityCost **instead of** the unit's AP. **Confidence: Low.** The evidence points both ways:
- "Instead" makes some abilities cheaper than a basic action (Stealth costs 1 against the Rogue's AP 2; Smite costs 3 against the Emissary's AP 4).
- "In addition" would make Forceful slam and Smite cost 7 each.

In code this is one switch; for balance it matters a lot.

**U-04 · Who goes first?** Not stated.
**D-T1:** a random coin flip, announced when deployment starts. The second player then picks a starting edge (D-O6). There's no other compensation in v1, because armies start 11+ rows apart and moving first matters less. **Confidence: Med.**

**U-05 · Turn phases.** Not stated.
**D-T2:**
1. **Start of turn:** refill your AP, reset your units' action counters, end your units' "until your next turn" statuses (Defend), count down your cooldowns and run start-of-turn effects.
2. **Main:** act with any of your units in any order. Actions of different units can be interleaved (**D-T6**: act with A, then B, then A's second action).
3. **End of turn:** see D-T9.

**Confidence: Med.**

**U-06 · Ending a turn, timers, game length.**
**D-T3:**
- End Turn is available at any time, even with AP left or without having acted.
- There's an optional lobby turn timer, off by default. When it runs out, the turn ends.
- There's no turn limit. Resign is always available, and a draw needs both players to agree.

**Confidence: Low.** Watch for stalemates: one action per unit plus defender-first combat (Q2) rewards waiting, and the only thing forcing players forward is the commander's race to the last row.

**U-07 · What a cooldown means ("CD 1 turn", "CD 1").**
> L106/L107/L110 "CD 1 turn" · L128 "CD 1"

**D-T7:** after you use the ability on your turn T, you can't use it on your next N turns; it's available again on turn T+N+1. So CD 1 means every other turn. **Confidence: Med.** With one action per turn, a CD 1 that ended before your next turn would do nothing.

**U-08 · Durations, and "turn" vs "round".**
> L107 "for 2 turns" · L71 "at the end of the turn (Your turn)" · L130 "each player turn (not the opponent's turn)"

**D-T8:** a "turn" is one player's turn; a "round" is both players' turns. An effect created on your turn T "for N turns" lasts until the start of your turn T+N, so it sees N of your turn ends and N of the opponent's. **Confidence: Low.** Combined with Pajazon's CD 1, this lets exactly one area be kept up at a time, which looks deliberate.

### 2.2 Movement

**U-09 · Exactly N squares or up to N?**
> L34 "that unit moves as many squares as the movement stat."

**D-M2:** a Move goes anywhere from 1 to N steps; stopping early is fine. **Confidence: High.**

**U-10 · Path rules.**
**D-M3:** steps are orthogonal and the path may turn (L34's example). A path may not enter cut-off squares, blockers, building squares or squares holding an enemy unit. It may pass through friendly units but must end on an empty square. **Confidence: Med.** Passing through friends is a choice; L64's formations suggest blocking could matter.

**U-11 · Moving through fog.**
**D-M4:** the player commits a full path, planned on what they can see, and the server walks it one step at a time. After each step it updates vision and checks triggers (mines L101, "comes into the melee range" reactions L82, reveal checks). The move stops early when:
- (a) the next square holds a unit the player couldn't see. The mover stops on the last square it could legally end on, and the blocking unit is shown on its square at that moment.
- (b) the mover takes damage.
- (c) the mover dies.

The full AP cost is spent either way. **Confidence: Med.**

### 2.3 Distance, adjacency and size

**U-12 · Distance terms.** Settled by **D-G2–D-G5** (see C-02):

| Phrase in the spec | Meaning | Squares around a 1×1 unit |
|---|---|---|
| "range N", "in range of N", "within range N" | Manhattan distance ≤ N | 4 / 12 / 24 for N = 1 / 2 / 3 |
| default attack, "melee range" (L82) | range 1 | 4 |
| "adjacent", "in range of 1 (including corners)" | Chebyshev distance 1 | 8 |
| "1 square away" (L81) | adjacent (the abilities analyst may refine this) | 8 |

Range has no minimum, so a Ranger can hit at distance 1 or 2. Range is measured between the nearest squares of the two units and ignores blockers. Blockers only matter through vision, because D-C3 requires the target square to be in your vision. Every listed ability range fits inside its own unit's LOV (Ranger 2 ≤ 3, Juliomancer 2 ≤ 3, Smite 3 ≤ 4, Pajazon 3 ≤ 3). So in open ground, "in your vision" and "in the unit's own LOV" never give different answers.

**U-13 · What does Size 2 mean?**
> L57 "Name, Power/Toughness, Size, …" · L109 "Beast of Knorund, 20/40, 2, 2, 2, 3" · L101 "+ 5 if the unit has a size of 2 or greater"

Size is defined only by its column in the unit lines.

**D-G6:** Size S fills an S×S block (the Beast is 2×2), with no facing or rotation.
- **Moving (D-M5):** the block moves as one piece. Each step shifts all 4 squares one square orthogonally, and every square must be legal at every step, so it can't squeeze through a 1-wide gap.
- **Distances:** range, LOV and adjacency are measured from its nearest square, and its vision is the combined vision of its 4 squares. It's adjacent to 12 squares and has 8 squares in melee range (checked).
- **Area effects:** an effect that covers several of its squares hits it once.
- **Mines:** a mine triggers when any of its squares enters the mine's square.
- **Deployment and capture:** it deploys with all 4 squares inside the zone, and counts as inside a capture zone if any of its squares is.

**Confidence: Med.** The spec already uses "2x2" for buildings (L45). A 1×2 piece would need facing and rotation rules, which the spec never mentions.

### 2.4 Board, deployment, terrain

**U-14 · Which squares exist? ("25x25, where the corners are cut off with a radius of 4", L30)**

**D-G1, coordinates:** columns A–Y (x = 0–24) and rows 1–25 (y = 0–24). Player 1's back row is row 1; Player 2's is row 25.

**D-G7, shape (rule A, rounded corners):** for a square (x, y), let `u = min(x, 24−x)` and `v = min(y, 24−y)`. The square is **removed** when

`u < 4 and v < 4 and (4−u)² + (4−v)² > 16`

i.e. any square that pokes out past a radius-4 arc drawn into each corner. That removes **8 squares per corner** (4, 2, 1 and 1 squares on the four outermost rows) and leaves **593** playable squares. The back rows are 17 squares wide (E–U). **Confidence: Low**, because "radius" can be read several ways:

| Rule | Removed when | Removed per corner (outer rows) | Playable | Back row | Normal zone (rows 1–5) | + extended rows 6–7 |
|---|---|---|---|---|---|---|
| **A (default)** square fully inside a rounded corner | u<4, v<4, (4−u)²+(4−v)²>16 | 8 (4,2,1,1) | 593 | 17 | 109 | 159 |
| B square's centre inside a rounded corner | u<4, v<4, (3.5−u)²+(3.5−v)²>16 | 3 (2,1) | 613 | 21 | 119 | 169 |
| C straight 45° cut ("radius" counted in steps, like LOV) | u+v ≤ 3 | 10 (4,3,2,1) | 585 | 17 | 105 | 155 |
| D quarter-circle bite centred on the corner point | (u+0.5)²+(v+0.5)² < 16 | 13 (4,4,3,2) | 573 | 17 | 99 | 149 |

```
Bottom-left corner of each variant ('#' = square exists, '.' = cut off)

     A            B            C            D
r6  # # # # # #  # # # # # #  # # # # # #  # # # # # #
r5  # # # # # #  # # # # # #  # # # # # #  # # # # # #
r4  . # # # # #  # # # # # #  . # # # # #  . . # # # #
r3  . # # # # #  # # # # # #  . . # # # #  . . . # # #
r2  . . # # # #  . # # # # #  . . . # # #  . . . . # #
r1  . . . . # #  . . # # # #  . . . . # #  . . . . # #
    A B C D E F  A B C D E F  A B C D E F  A B C D E F
```

The full default board (rule A, with the default building placement from D-O6):

```
legend: D normal deployment   e extended rows   K Keep   M Market
        + capture zone        . open ground     (blank) cut off
     A B C D E F G H I J K L M N O P Q R S T U V W X Y
 25          D D D D D D D D D D D D D D D D D
 24      D D D D D D D D D D D D D D D D D D D D D
 23    D D D D D D D D D D D D D D D D D D D D D D D
 22    D D D D D D D D D D D D D D D D D D D D D D D
 21  D D D D D D D D D D D D D D D D D D D D D D D D D
 20  e e e e e e e e e e e e e e e e e e e e e e e e e
 19  e e e e e e e e e e e e e e e e e e e e e e e e e
 18  . . . . . . . . . . . . . . . . . . . . . . . . .
 17  . . . . . . . . . . . . . . . . . . . . . . . . .
 16  . . . . . . . . . . . . . . . . . . . . . . . . .
 15  . . . . . . . . . . . . . . . . . + + + + . . . .
 14  . . . . + + + + . . . . . . . . . + M M + . . . .
 13  . . . . + K K + . . . . . . . . . + M M + . . . .
 12  . . . . + K K + . . . . . . . . . + + + + . . . .
 11  . . . . + + + + . . . . . . . . . . . . . . . . .
 10  . . . . . . . . . . . . . . . . . . . . . . . . .
  9  . . . . . . . . . . . . . . . . . . . . . . . . .
  8  . . . . . . . . . . . . . . . . . . . . . . . . .
  7  e e e e e e e e e e e e e e e e e e e e e e e e e
  6  e e e e e e e e e e e e e e e e e e e e e e e e e
  5  D D D D D D D D D D D D D D D D D D D D D D D D D
  4    D D D D D D D D D D D D D D D D D D D D D D D
  3    D D D D D D D D D D D D D D D D D D D D D D D
  2      D D D D D D D D D D D D D D D D D D D D D
  1          D D D D D D D D D D D D D D D D D
```
Row 1 is P1's back row and P2's goal row; row 25 is P2's back row and P1's goal row.

**U-15 · Deployment zones.**
> L31 "The normal deployment zone covers the first 5 rows closest to the player. The extended deployment zone covers 2 extra rows."

**D-P1:** P1's normal zone is rows 1–5 (109 squares under rule A) and its extended zone rows 6–7 (+50). P2 mirrors this with rows 21–25 and 19–20. Eleven open rows (8–18) separate the two extended zones. **Confidence: High.**

**U-16 · Which units may use the extended rows?**
> L29 "Some units can be deployed in the extended deployment area, which covers slightly more terrain."

No unit or commander text grants it. **D-P2:** a per-unit data flag. It's on by default for type 1 and 2 units (Footman, Mercenary, Soldier, Ranger), on the idea that cheap screening units deploy forward. It's off for everything else and **never** on for the commander. **Confidence: Low.**

**U-17 · How deployment works.** The spec doesn't say whether it's simultaneous or alternating, hidden or open, or whether every unit must be placed.

**D-P3:** simultaneous and hidden.
- Both players place their whole army at once and press Ready; the battle starts when both are ready. Placements can be changed freely until then.
- Squares can't be shared, Size-2 units must sit fully inside the zone, and blocker or building squares can't be used.
- Placements stay hidden anyway. Even the longest sight line (LOV 6) from the furthest deployable row (7) only reaches row 13, and the enemy's zone starts at row 19.

**D-P4:** the commander must be deployed, in the normal zone. **Confidence: Med.**

**U-18 · Army size vs zone space.** The budget allows 200 one-cost units, but the zone only has 109 squares (159 with the extended rows).
**D-B3:** there's no copy limit per unit and no unit cap except "the whole army must fit in its zones", which the army builder checks (taking extended-row eligibility into account). Every purchased unit must be deployed. **Confidence: Med.**

**U-19 · Blockers.**
> L13 "There may be a scenario with blockers."

**D-G8:** a blocker is one whole square of terrain. It can't be entered, deployed on, targeted or destroyed, and it blocks vision (D-F2). Each scenario lists its blocker squares, laid out with 180° rotational symmetry for fairness. The default scenario has none; we ship one optional variant with symmetric blockers for testing. **Confidence: Med.**

**U-20 · Buildings as terrain.**
> L45 "Each one will occupy a 2x2 square" · L46 "represented by 3d objects"

**D-O7:** the 4 building squares can't be entered and they block vision, like blockers. **Confidence: Med.**

**U-21 · Where the buildings go, and fairness.** The spec doesn't say. On a 25-row board a 2×2 building **can't** be the same distance from both players: the middle row is 13, so the building covers rows 12–13 or 13–14.
**D-O6:** one Keep and one Market per scenario, placed with 180° rotational symmetry. The Keep is on F–G, rows 12–13 (one row nearer P1); the Market is on S–T, rows 13–14 (one row nearer P2). To offset this, the player moving second picks which edge to start on, before deployment. **Confidence: Low.** Alternatives: an even-sized board (24 or 26), buildings of 1×1, 3×3 or 2×3, or simply accepting the one-row tilt.

### 2.5 Vision and fog of war

**U-22 · LOV math, checked.**
> L37 "A LOV of 1 will only show the 4 orthogonal adjacent squares. A LOV of 2, will show 12 squares around the unit, and so on."

Counted with Manhattan distance, LOV N shows **2N(N+1)** squares around the unit (2N² + 2N + 1 including its own square):

| LOV | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Manhattan (the spec's logic) | **4** ✓ | **12** ✓ | 24 | 40 | 60 | 84 |
| Euclidean circle (for comparison) | 4 | 12 | 28 | 48 | 80 | 112 |
| Including corners (a square area) | 8 | 24 | 48 | 80 | 120 | 168 |

Both examples in the spec match the Manhattan count. Note that a Euclidean circle *also* gives 4 and 12, so "and so on" is only settled by "using this logic" (orthogonal steps). From LOV 3 onward the two differ (24 vs 28). **D-F1:** Manhattan. **Confidence: High.**

**U-23 · Do blockers or units block vision? How does a 2×2 unit see?**
**D-F2:** flood fill (see C-15). A blocker or building square within reach is seen, but nothing behind it is. **D-F3:** units never block vision, and a 2×2 unit sees from all 4 of its squares. **Confidence: Med** (F2) and **High** (F3).

**U-24 · What the fog hides.**
> L17 "Each player will only have vision around the vision field of each unit. Everything outside will be in the fog of war."

**D-F4:** a player's vision is the combined LOV of all their units, commander and Dummies included.
**D-F5:**
- **Always public:** the board, blockers, buildings and who controls each building (announced when it changes).
- **Hidden** unless currently inside your vision: enemy units, their statuses and their mines. There are no "last seen" markers (an optional UI marker can come later).
- Enemy units you can see show their full stats: power and toughness, current toughness and statuses.

**D-F6:** vision is recomputed after every movement step and every action, in both players' turns. **Confidence: Med/High.**

**U-25 · "Revealed" vs "visible".**
**D-F7:** you can see a unit only if it's inside your vision **and** isn't invisible. Being revealed only removes invisibility; it doesn't give anyone vision. A revealed Rogue outside every enemy unit's LOV is still hidden by the fog. **Confidence: High.**

**U-26 · Rule checks that would leak hidden information.** For example, L81 says "Only activate this ability if not inside the LOV of another enemy creature", but the player may not know they're being watched.
**D-F8:** never refuse an action because of something the player can't see. Let it resolve and fail or stop visibly, as in D-M4. The abilities analyst should apply this to Stealth. **Confidence: Med.**

**U-27 · Opponent actions you can't see.**
**D-F9:** your log only shows what happened inside your vision. How much AP the opponent spent isn't shown. **Confidence: Low.**

**U-28 · Who enforces the fog.** Hidden armies, hidden deployment and invisible units only stay hidden if a single trusted party holds the full game state.
**D-F10:** one authority runs the rules and sends each player only what they can see. Clients never receive hidden units or mines. **Confidence: High** that this is needed; *where* the authority runs is Q1.

### 2.6 Combat and damage

**U-29 · How much damage does an attack deal?**
> L7 "Power and Toughness, similar to MTG" · L15 "attacking units deals damage to the toughness of a target unit"

**D-C1:** the attacker's current Power, including any bonuses. **Confidence: High.**

**U-30 · Does the target hit back?** In MTG, a blocking creature deals damage too.
**D-C2:** no. Only the attacker deals damage, and Defend is the only defensive action. **Confidence: Med.**

**U-31 · Defend: how long, which action, which damage?**
> L15 "defend (a defending unit receives half the damage rounded up(never less than one))"

**D-C4:**
- Defend is an action: it costs the unit's AP and uses its action for the turn.
- It lasts until the start of its controller's next turn. If the unit takes another action later that turn, Defend is cancelled.
- It halves damage from **every** source (attacks, abilities, mines, area effects), after flat reductions (D-C5).
- The opponent sees it as a status.

**Confidence: Med.**

**U-32 · Order of damage modifiers, and the minimum of 1.**
> L64 "reduce the incoming damage by 2 (not below 1)" · L95 "Reduce all damage dealt to this unit by 3 (can't be less than 1)" · L106 "reduced by 8" · L129 "deal 4 less damage"

**D-C5, damage steps:**
1. Start from the attacker's current Power, or the ability's fixed damage.
2. Add attacker-side bonuses (e.g. Fierce attacker's +1 per Mercenary).
3. Subtract attacker-side penalties (e.g. weakness −4), not going below 0.
4. Subtract all of the target's flat reductions, added together (Reinforced Armor 3, Line Formation 2, Forcefield 8 and so on).
5. If the target is defending, halve and round up.
6. **D-C6:** if the amount after step 3 was 1 or more, the final damage is at least 1.

Example: a Berserker (12) hits a defending Paladin. 12 − 3 = 9, halved and rounded up = **5**. Halving first would give 3.
**D-C7:** fixed-damage abilities (Smite 8, mine 5, Pajazon 3) aren't raised by Power bonuses, but the target's reductions and Defend do lower them.

**Confidence: Med.** The spec repeats "not below 1" on every defensive reduction, which suggests a general minimum of 1.

**U-33 · Stacking bonuses.**
> L52 Keep +3 power · L86 Strong aura +1/+1 · L120 Command Aura · L124–126 commander bonuses

**D-C8:**
- Bonuses from different sources add up.
- The same named aura applies only once, even from several sources: two Priestesses give +1/+1, and two Scourges give +1 action.
- "For each" effects count every source (L67).
- Extra actions from different sources add up: Market + Command Aura = 3 actions, still with only one Move.
- The Keep's +3 applies to all your units, including the commander and Dummies (a Dummy becomes 3/7).

**Confidence: Med.**

**U-34 · Friendly fire, and effects that just say "units".**
**D-I1:**
- Helpful effects that just say "units" mean *your* units (L52, L53, L86, L120, L124, L125, L130).
- Harmful **area** effects hit every unit in the area, friend or foe (L101 "any unit", L110).
- Harmful single-target effects and basic attacks target enemies.

**Confidence: Med.** The abilities analyst owns the per-ability details.

### 2.7 Toughness, healing, death

**U-35 · How damage and healing are tracked.**
> L19 "units that receive damage do not regenerate or recover toughness at the end of turn"

**D-H2:** damage stays on a unit until something heals it. Current toughness = max toughness − damage. Healing and regeneration remove damage but never go below 0 damage, so a unit can't be healed above its max. "No more than units base hp" (L87) is read as this same cap. **Confidence: High.**

**U-36 · What happens when a toughness bonus starts or stops?**
**D-H3:** gaining +X toughness raises both max and current toughness by X; losing it lowers both by X. So a unit with 1 current toughness that walks away from a Priestess **dies** (the MTG rule). **Confidence: Med.** The alternative (Hearthstone style, where losing a bonus never kills) lets a unit heal 1 every time it steps into and out of the aura. That's an exploit, which is why it isn't the default.

**U-37 · When does a unit die?**
**D-H4:** the moment its current toughness reaches 0 or less, checked after every damage event and every change to max toughness, including in the middle of a move and during end-of-turn effects. It's removed at once, and death triggers fire immediately. **Confidence: High.**

**U-38 · What "sacrifice" means.**
> L87, L91, L111, L130

**D-H5:** sacrificing means destroying one of **your own** units, never an enemy and never your commander. It isn't damage (no reductions, no Defend), and it counts as a death for triggers such as Kulega's (L125). **Confidence: Med.**

### 2.8 Army building, types, costs

**U-39 · "Type" = denomination = cost.**
> L5 "1, 2, 5, 10, 20, 50, 100" · L53 "type-1" · L124 "type 1, 2, 5" · L125 "type-20" · L126 "considered type 10"

**D-B1:** a unit's type is its denomination, which is also its default cost. "Type-1 units" (Market) are the Footman and the Mercenary. The commander, Dummies and other created units have **no type** and are never affected by type-based rules. **Confidence: High.**

**U-40 · Budget details.**
> L27 "a budget of 200, which can be edited in the future"

**D-B2:** army cost ≤ budget. The budget is 200 by default, the same for both players, and the lobby host can change it. Leftover money does nothing. **Confidence: High.**

**U-41 · Sabrina's "type 10" and the 20% surcharge.**
> L126 "Artificers now are considered type 10. … Each other type-20 and above is 20% more expensive to deploy."

No current rule depends on type 10, so "considered type 10" only does something if it changes the cost. "Each other" leaves Artificers out of the surcharge, which fits that reading.
**D-B4:** with Sabrina, Artificers cost 10 and count as type 10 everywhere. Other units of type 20 and up cost 20% more (24 / 60 / 120), rounded up if the result is ever fractional. **Confidence: Med.**
**D-B5:** because costs depend on the commander, a saved army is commander + units, and it's priced with that commander. **Confidence: High.**

**U-42 · Factions.** See C-10: **D-B6/D-B7**, **Confidence: Low.**

**U-43 · "Units of white".**
> L128 "Units of white gain the ability to regenerate 2 toughness for 2 AP" · L44 "The color of the token will represent the grade of the unit."

There's no table of which colour belongs to which grade. **D-B8:** until one exists, any of your units can use this regeneration (the 2-per-turn cap still limits it). It's stored as a grade filter, so fixing it later is a data change. **Confidence: Low.**

**U-44 · What does the opponent know about your army?**
**D-B9:** army lists are secret; the opponent learns about a unit only by seeing it. Both commanders are **revealed** when deployment starts, because their global effects change stats the opponent sees anyway (a 1/4 Footman means Trill). **Confidence: Low–Med.**

**U-45 · Building an army at game start.**
> L26 "If a player wants to create a new one when a game starts, he can do so there aswell."

**D-B10:** once both players have joined the lobby, each picks a commander and an army at the same time, in secret, and locks in. The match continues when both have locked in. A timer is optional. **Confidence: Med.**

### 2.9 Commander and victory

**U-46 · What kind of unit is the commander?**
> L32 "The commander is by default a 1/1 unit, movement and AP of 1, LOV of 3, and doesn't count from the budget."

**D-K2:** a normal Size-1 unit with 1/1, Movement 1, AP cost 1 and LOV 3. Named commanders change some of these (Trill: toughness 10; Ratasius: LOV 6; Queso: AP cost 3, toughness 3).
- It has the standard actions: move, **attack** with its 1 Power, and defend.
- It counts as a unit for every effect: the Keep, Strong aura, Command Aura, Kulega's +1 LOV, healing, being attacked, setting off mines, capturing buildings and revealing stealthed units.
- It has **no type**, so Trill, the Market and type-20 effects don't apply to it, and it can't be sacrificed.

**D-K3:** its "AP" is its cost per action, like any other unit's (so Queso's AP 3 is a drawback). It does **not** add to the AP pool. **Confidence: Med.**

**U-47 · Losing the commander.**
**D-K4:** when a commander dies, its player loses at once; there's no successor. If both commanders die from the same event, the game is a **draw**. **D-K6:** commanders can't be revived. **Confidence: High** (the loss) and **Med** (the draw).

**U-48 · Reaching the last row.**
> L32 "bring your commander to the opposite side of the board. More specifically, to the last row."

**D-K5:** you win **instantly** when your commander stands on any square of your goal row (row 25 for P1, row 1 for P2; 17 squares under rule A), once the action has fully resolved, mine and reaction triggers included. After each action, commander deaths are checked first, then goal rows. The shortest trip is from row 5 to row 25: 20 moves, i.e. 20 of your turns. **Confidence: Med.**

**U-49 · Choices during the opponent's turn.** For example, L130 "When a unit in that area dies you can choose to sacrifice 1 max toughness to revive" can happen during the opponent's turn.
**D-T11:** the player who isn't taking their turn is never asked anything mid-turn. Choices like this are standing settings picked beforehand ("auto-revive: on/off"). That keeps the network flow simple and avoids pauses that give information away. **Confidence: Low.**

### 2.10 Neutral buildings (Keep, Market)

**U-50 · Capture zone.**
> L45 "conquered when at least one unit, without opposition, is in range of 1(including corners) of that building"

**D-O4:** the 12 squares around the 2×2 building (checked). A Size-2 unit counts if any of its squares is in the zone. **Confidence: High.**

**U-51 · When is capture checked?** "Will be conquered when" gives no timing.
**D-O3:** at the **end of every turn** (both players' turns), after end-of-turn damage and healing. If exactly one player has units in the zone, that player takes (or keeps) control; otherwise nothing changes. Control stays when the zone empties and only changes hands the same way (L45 "reconquered by the same method"). **Confidence: Med.** Instant capture would let a player walk in and attack with +3 Power in the same turn.

**U-52 · What counts as "opposition"?**
**D-O5:** any enemy unit in the zone, including invisible units, Dummies and the commander. Mines don't count. A capture blocked by an unseen unit shows as **"Contested"**, which hints that something is there. **Confidence: Low–Med.**

**U-53 · The Market's extra action.** **D-O8:** it costs AP like any other action (D-A3) and still allows only one Move (D-T5). **Confidence: Med.**

### 2.11 Take-back
> L39 "There will be a take back option for each player. The opponent player has to accept the take back."

The spec doesn't say how far back, what gets restored, what happens to information already seen, or what the limits are.

- **D-R1, scope:** a player may ask to undo back to any point in their own most recent turn, as long as the opponent hasn't acted since. Ending the turn counts as an action, so a turn you just ended can be reopened until the opponent's first action. Only one request can be pending at a time, and the game (including the turn timer) pauses while it is.
- **D-R2, what's restored:** the whole earlier state: positions, toughness, AP, action counters, cooldowns, statuses, created or destroyed units and mines, building control and vision. This is exact because the game has no randomness.
- **D-R3, hidden information:** the request tells the opponent what the undone actions revealed about *their* side (e.g. "revealed your Rogue at K14", "set off your mine at H9", "your Rogue's Assault fired"), so they can decline. What the requester saw can't be unseen; accepting means accepting that.
- **D-R4, limits:** a lobby setting turns take-backs on (default) or off. A declined request can't be repeated in the same turn.

**Confidence: Low–Med.**

### 2.12 Timing and ordering

**U-54 · End-of-turn order.**
> L71 "Regenerate 1 toughness at the end of the turn (Your turn)" · L107 "At the end of your turn, allied units in the area regenerate 3 toughness; At the end of the opponent's turn, enemy units take 3 damage."

At the end of one player's turn, that player's units can be healed (by their own Perseverance or Pajazon) and damaged (by the opponent's Pajazon) at the same moment. The order decides whether a unit with 2 toughness left survives.
**D-T9, end of turn:**
1. Damage effects due now, in the order they were created, checking deaths after each.
2. Healing and regeneration due now, in creation order, capped at max toughness.
3. Building capture check (D-O3).
4. Effects that end now expire.
5. Victory check.
6. The next player's start of turn.

**Confidence: Low–Med.**

**U-55 · Triggers in the middle of an action.**
**D-T10:** a trigger fires as soon as its condition happens (for example, halfway through a move) and fully resolves before the action continues. If several fire at once, the active player's go first, then the opponent's, each in creation order. **Confidence: Med.**

### 2.13 Outside this review, but still undefined
Achievements (L24) have no list. The lobby flow, reconnecting and the budget-editing UI (L22, L27) aren't described. These aren't rules; they're flagged for the product/UX analysis.

### 2.14 Ability questions handed to the abilities analyst
I noticed these but didn't rule on them; the core defaults above only set the frame.
- **Forcefield (L106):** is "4 adjacent squares" a 2×2 block or any 4 connected squares? It has a cooldown but no duration.
- **Pajazon (L107):** "center at range 3" is measured from the wizard, but must the centre be in vision?
- **Stealth / Assault (L81–82):** what counts as "1 square away"? Does Assault interrupt the move (D-M4 says yes, because it deals damage)? Does Assault break stealth?
- **Shared wounds (L87):** what does it cost? Can it target enemies? How is "half" rounded?
- **Feast (L111):** can "gain life" go above max toughness (D-H2 says no)?
- **Mad inventor (L100):** "steps out of range" contradicts its own adjacency condition.
- **Dummy and mine limits (L99, L101):** the "(All artificers; …)" formulas need a worked example.
- **Kulega (L125):** does a sacrificed type-1 or type-2 unit trigger the heal (D-H5 says yes)?
- **Queso (L130):** where does a revived unit come back? Whose max toughness is sacrificed? If it's Queso's own, a 3-toughness commander could kill itself.
- **Baba Yaga (L128):** how do "for 2 AP (each instance)", "Can be applied twice to the same unit" and "CD 1" interact?
- **Holy Fervor + Command Aura (L117, L120):** can an Emissary take 3 actions?

---

## 3. Typos and format problems

| Line | Text | Problem | Suggested fix |
|---|---|---|---|
| L3 | "two players, which start with" | grammar | "who start with" |
| L5 | "1, 2, 5, 10, 20, 50, 100" | not a typo: the real euro coin set also has 200 (€2), which here equals the whole budget | (noted only) |
| L9 | "use those action costs to use a number of units that fit its budget" | "action costs" should be "action points", and "budget" here means AP (C-14) | "spend those action points on units whose AP costs fit the remaining pool" |
| L15 | "attacking units deals damage" | singular/plural mismatch | "an attacking unit deals damage" |
| L15 | "rounded up(never less than one)" | missing space (see also C-11) | "rounded up (never less than one)" |
| L17 | "vision around the vision field of each unit" | says vision twice | "vision = the combined LOV of all friendly units" |
| L24 | "achivements" | spelling | "achievements" |
| L26 | "aswell" | spelling | "as well" |
| L28 | "the units that wants to have" | missing subject | "the units they want" |
| L30 | "The size of the battlefields are 25x25" | singular/plural mismatch | "is 25×25" |
| L32 | "defeat the commander of each party" | literally includes your own commander | "defeat the enemy commander" |
| L32 | "doesn't count from the budget" | wording | "doesn't count toward the budget" |
| L34 | "Units movement" | possessive | "Unit movement" |
| L37 | "A LOV of 2, will show" | stray comma | "A LOV of 2 shows" |
| L39 | "The opponent player" | wording | "The opposing player" |
| L44 | "inspired in" | preposition | "inspired by" |
| L45 | "One conquered" | typo | "Once conquered" |
| L45 | "occupy a 2x2 square" / "range of 1(including corners)" | a 2×2 block, not one square; missing space | "occupy a 2×2 area"; "range of 1 (including corners)" |
| L53 | "all type-1 unit have" | plural | "all type-1 units have" |
| L59–60 | "### The Empire" with nothing under it | empty faction section (C-10) | add the roster or mark it TBD |
| L78 | "Savagery:P: … spend 2 AP" | marked passive but has a cost (C-16) | "Savagery:2:", or document a "P with cost" rule |
| L81 | "another enemy creature" | MTG term "creature" | "enemy unit" |
| L82 | "Assault: When an enemy…" | missing AbilityCost field | "Assault:P:" (triggered, free) |
| L82 | "opponents turn" | apostrophe | "opponent's turn" |
| L86 | "units adjacent to priestess" | unit name in lowercase | "Priestess" |
| L87 | "Shared wounds: Sacrifice…" | missing AbilityCost field on what reads as an active ability | add a cost |
| L87 | "units base hp", "(or itself)" | possessive; "hp" instead of toughness | "the unit's base toughness" |
| **L94** | **"Paladin: 12/20, 1, 2, 3, 2"** | **the only unit line with a colon after the name; a parser splitting on commas would read the name as "Paladin: 12/20"** | **"Paladin, 12/20, 1, 2, 3, 2"** |
| L99 / L100 / L126 | "No-ACB" / "NO-ACB" / "No-ACBs" | inconsistent capitals | "No-ACB" everywhere |
| L100 | "Mad inventor: Prototypes…" | missing AbilityCost field | "Mad inventor:P:" |
| L100 | "steps out of range" | the condition is adjacency, not range | "stops being adjacent" |
| L102 | "dont", "go though mines" | spelling | "don't", "through" |
| L105 | "Royal wizard" | capitals differ from other unit names | "Royal Wizard" |
| L106 | "wizards LOV" | apostrophe | "wizard's LOV" |
| L106/L107/L110 vs L128 | "CD 1 turn" vs "CD 1" | two ways of writing cooldowns | one notation, defined by D-T7 |
| L111 | "Feast:2: Sacrifice an adjacent unit: Gain life…" | a third colon inside the description breaks `Name:Cost:Description` parsing | use ";" or "." |
| L117 | "Holy Fervor: This unit…" | missing AbilityCost field | "Holy Fervor:P:" |
| L124–L130 | commander entries | don't follow the unit format; only the changed stats are given | define each as "base commander (L32) + overrides" |
| L125 | "that creature toughness" | "creature"; missing possessive | "that unit's toughness" |
| L127 | blank line splitting the commanders 3 + 3 | possibly a faction split (C-10) | confirm |
| L128 | "Units of white" | undefined (U-43) | define the grade colour |
| L130 | "health" | yet another word for toughness (C-13) | "toughness" |

---

## 4. Proposed defaults (single source of truth)

Settings marked ⚙ should be named constants or lobby options, so playtests can change them without code changes.

| ID | Rule | Default | Conf. | Basis |
|---|---|---|---|---|
| **AP economy** | | | | |
| D-A1 ⚙ | AP pool | 10 AP per player per turn, refilled at the start of their turn; unspent AP is lost | Low | L9 (no number) |
| D-A2 | What costs AP | Move, Attack, Defend and active abilities; passives and automatic triggers are free and use no action | High | L7, L15, L82 |
| D-A3 ⚙ | Per action or per unit | Per action; extra actions are paid again; Holy Fervor's 2nd action costs AP+1 | Med | C-04 |
| D-A4 ⚙ | Ability cost | Replaces the unit's AP for that action | Low | U-03 |
| D-A5 | Not enough AP | The action isn't allowed; no negative AP, no borrowing | High | L9 |
| **Turn structure and timing** | | | | |
| D-T1 | First player | Random coin flip, announced when deployment starts; the second player picks the starting edge (D-O6) | Med | — |
| D-T2 | Turn phases | Start (refill AP, reset actions, end own Defend, count down own cooldowns, start-of-turn triggers) → Main → End (D-T9) | Med | — |
| D-T3 ⚙ | Ending, timers, game length | End Turn at any time; optional turn timer (off); no turn limit; Resign; draw by agreement | Low | — |
| D-T4 | Actions per unit | 1 per turn: Move **or** Attack **or** Defend **or** an ability | High (text) | L35 |
| D-T5 | Moves per unit | At most 1 Move per turn, even with extra actions; other actions may repeat | Med | L11 + C-03 |
| D-T6 | Interleaving | Units act in any order; a unit's actions don't have to be back to back | Med | — |
| D-T7 | Cooldown N | Can't be used on your next N turns (CD 1 = every other turn) | Med | L106–L110, L128 |
| D-T8 | Duration of N turns | A turn is one player's turn; the effect lasts until the start of your turn T+N | Low | L107 |
| D-T9 | End-of-turn order | Damage → healing → capture → expiries → victory → next turn; deaths checked after each effect | Low–Med | L71, L107 |
| D-T10 | Trigger order | Resolve fully as soon as triggered; simultaneous ones: active player first, then creation order | Med | L82, L101 |
| D-T11 | Choices on the opponent's turn | No mid-turn prompts; standing settings instead | Low | L130 |
| **Movement** | | | | |
| D-M1 ⚙ | Directions | Orthogonal only; a diagonal costs 2 | High | L34, L37 vs L15 |
| D-M2 | Distance | 1 to N steps | High | L34 |
| D-M3 | Path legality | No cut-off, blocker, building or enemy squares; may pass through friends; must end on an empty square | Med | — |
| D-M4 | Moving through fog | Path committed up front and walked step by step; stops on bumping an unseen unit, on taking damage or on death; full AP spent | Med | L82, L101 |
| D-M5 | Size-2 movement | Moves as a block; every square legal at every step; can't use 1-wide gaps | Med | L109 |
| **Geometry and board** | | | | |
| D-G1 | Coordinates | Columns A–Y, rows 1–25; P1 back row = 1, P2 back row = 25 | High | — |
| D-G2 | "Range N" | Manhattan distance ≤ N between the nearest squares; no minimum; ignores blockers | Med | L37, L45, L74 |
| D-G3 ⚙ | "Adjacent" | The 8 surrounding squares (12 around a 2×2) | Med | L37, L110 |
| D-G4 | Basic attack reach | Range 1 = the 4 orthogonal squares (8 around a 2×2) | Med | L74, L37 |
| D-G5 | "Range 1 (including corners)" | Same as adjacent | High | L45 |
| D-G6 | Size S | S×S block, no facing; distances from the nearest square; area effects hit once; a mine triggers on any of its squares | Med | L57, L101, L109 |
| D-G7 ⚙ | Board shape | Rule A: removed if u<4, v<4 and (4−u)²+(4−v)²>16, leaving 593 squares | Low | L30 |
| D-G8 | Blockers | Whole squares; can't be entered, deployed on, targeted or destroyed; block vision; 180° symmetric; none on the default map | Med | L13 |
| **Deployment** | | | | |
| D-P1 | Zones | P1 rows 1–5 (+6–7 extended); P2 rows 21–25 (+19–20); 109 / +50 squares | High | L31 |
| D-P2 ⚙ | Extended rows | Data flag; on for type 1–2 units; never for the commander | Low | L29 |
| D-P3 | Procedure | Simultaneous and hidden, editable until both are Ready; all units placed; 2×2 units fully inside | Med | L29 |
| D-P4 | Commander | Must be deployed, in the normal zone | High | L32 |
| **Vision and fog** | | | | |
| D-F1 | LOV area | The squares within N orthogonal steps: 2N(N+1) of them in open ground | High | L37 |
| D-F2 ⚙ | Blockers and vision | Flood fill; a blocker or building square is seen, but nothing behind it | Med | L13, L37 |
| D-F3 | Units and vision | Units never block vision; a 2×2 sees from all its squares | High | — |
| D-F4 | A player's vision | Combined LOV of all own units (commander and Dummies included) | High | L17 |
| D-F5 | Public vs hidden | Map, blockers, buildings and their control are public; enemy units and mines outside your vision are hidden; no last-seen markers | Med | L17 |
| D-F6 | Updates | After every step and every action, in both players' turns | High | — |
| D-F7 | Seeing a unit | Inside your vision **and** not invisible | High | L81, L90 |
| D-F8 | Rule checks on hidden facts | Never refuse an action over something the player can't see; resolve it and fail visibly | Med | L81 |
| D-F9 | Opponent actions you can't see | Seen only inside your vision; their AP use isn't shown | Low | — |
| D-F10 | Enforcement | One authority holds the full state; each client only gets its own view | High | L17 |
| **Combat** | | | | |
| D-C1 | Attack damage | The attacker's current Power | High | L7, L15 |
| D-C2 | Hitting back | None | Med | L15 |
| D-C3 | Attack target | A square in range and in your vision with no friendly unit; whatever is on it gets hit; empty squares allowed | Med | L15, L101 |
| D-C4 | Defend | An action that costs AP, lasts until your next turn starts, is cancelled by a later action, and halves damage from every source | Med | L15 |
| D-C5 | Damage steps | Power or fixed damage → + attacker bonuses → − attacker penalties (≥ 0) → − target reductions → Defend halving (round up) | Med | L15, L64, L95, L106, L129 |
| D-C6 | Minimum damage | If 1 or more after the attacker-side steps, the final damage is at least 1; 0 stays 0 | Med | L15, L64, L95 |
| D-C7 | Fixed-damage abilities | Not raised by Power bonuses; lowered by reductions and Defend | Med | — |
| D-C8 | Stacking | Different sources add; a same-named aura counts once; "for each" counts every source; extra actions add (still 1 Move) | Med | L52, L67, L86, L120 |
| **Toughness and death** | | | | |
| D-H1 | Vocabulary | printed / base (+ permanent) / max (+ auras) / current (= hp = health = life) | Med | C-13 |
| D-H2 | Damage persists | Healing removes damage, never above max toughness | High | L19, L87 |
| D-H3 | Bonus gained or lost | Max and current toughness move together; losing a bonus can kill | Med | L86 |
| D-H4 | Death | At current toughness ≤ 0, checked after every change; removed at once; death triggers fire | High | — |
| D-H5 | Sacrifice | Your own non-commander unit; not damage; counts as a death | Med | L87, L91, L111 |
| **Army, types, budget** | | | | |
| D-B1 | Type | Type = denomination = default cost; commander and created units have no type | High | L5, L53 |
| D-B2 ⚙ | Budget | Cost ≤ 200 (adjustable in the lobby, the same for both players); leftover money does nothing | High | L3, L27 |
| D-B3 | Copies and army size | No copy limit; the army must fit its zones; all units must be deployed | Med | L3, L31 |
| D-B4 | Sabrina | Artificers cost 10 and are type 10; other type 20+ units cost ×1.2 (24/60/120), rounded up | Med | L126 |
| D-B5 | Saved army | Commander + units, priced with that commander | High | L126 |
| D-B6 | Factions | Lojrar only in v1; Empire once defined; the data supports any number of factions | Low | L43, L59 |
| D-B7 | Mixing factions | One faction per army; commanders not tied to a faction; mirror matches allowed | Low | L43, L127 |
| D-B8 | "Units of white" | Any of your units until grade colours are defined (the 2-per-turn cap still applies) | Low | L44, L128 |
| D-B9 | Hidden information | Army lists secret; commanders revealed when deployment starts | Low–Med | — |
| D-B10 | Picking an army at game start | Simultaneous, secret, then lock-in; optional timer | Med | L26 |
| **Commander and victory** | | | | |
| D-K1 | Choice | Exactly one of the six; both players may pick the same one | Med | L3, L32 |
| D-K2 | Unit status | A full Size-1 unit: can attack, defend, be buffed, capture and set off mines; no type; can't be sacrificed | Med | L32 |
| D-K3 | Commander's "AP" | Its cost per action, not something added to the pool | Med | L32, L130 |
| D-K4 | Commander death | Immediate loss; both dying in the same event → draw | High / Med | L32 |
| D-K5 | Goal row | Instant win when the commander stands on the goal row after an action fully resolves; deaths checked first | Med | L32 |
| D-K6 | Revival | Commanders can't be revived | High | L130 |
| **Neutral buildings** | | | | |
| D-O1 ⚙ | Presence | One Keep and one Market in the default scenario; lobby on/off; holding them never wins the game | Med | L45 |
| D-O2 | Who benefits | Only the controller's units | High | L52, L53 |
| D-O3 | Capture timing | End of every turn, after damage and healing; if exactly one player is present, they get control | Med | L45 |
| D-O4 | Zone | The 12 squares around the 2×2 building | High | L45 |
| D-O5 | Opposition | Any enemy unit, including invisible units, Dummies and the commander; mines don't count; shown as "Contested" | Low–Med | L45 |
| D-O6 | Placement | Keep F–G / rows 12–13, Market S–T / rows 13–14 (180° symmetric); the second player picks the starting edge | Low | — |
| D-O7 | Building squares | Can't be entered; block vision | Med | L45, L46 |
| D-O8 | Market extra action | Costs AP; still only one Move | Med | L53, L11 |
| **Take-back** | | | | |
| D-R1 | Scope | Back to any point in your latest turn, until the opponent acts; one request at a time; game paused | Low–Med | L39 |
| D-R2 | What's restored | The complete earlier state (the game is deterministic) | High | L39 |
| D-R3 | Hidden information | The opponent is told what the undone actions revealed about their side, and can decline | Med | L39, L17 |
| D-R4 ⚙ | Limits | Lobby on/off (on by default); no repeat request in the same turn after a decline | Low | L39 |
| **Reading conventions** | | | | |
| D-I1 | "Units" with no side named | Helpful effect → your units; harmful area effect → everyone in it; harmful single target → enemies | Med | L52, L101, L110 |
| D-I2 | "creature" | Means unit | High | L81, L125 |
| D-I3 | "P" | No action, no activation; an AP amount in the text is still paid | Med | L57, L78 |
| D-I4 | Missing cost field | Assault, Mad inventor and Holy Fervor are passive or triggered; Shared wounds is active, costing the unit's AP until defined | Low | L82, L87, L100, L117 |

---

## 5. Questions for the owner, ranked by how much the answer changes the build

They're ranked by how much code and architecture the answer moves, not by balance. Our default is in brackets, and work continues on it until you answer.

**Q1. Does fog of war have to be cheat-proof?** *(changes the networking design)*
Hidden armies, hidden deployment, invisible units and take-backs all need one trusted place that holds the full game and sends each player only their view (D-F10). Your "least setup" note (L135) points toward a direct browser-to-browser connection, but then the hosting player's browser holds everything and could be used to cheat with the developer tools.
Options:
- (a) a small hosted server is the authority; players still just click a link.
- (b) the host's browser is the authority; nothing to host, but the host could cheat.

[Default: (a). The rules engine is written so it can run in either place.]

**Q2. Can a unit move and attack in the same turn?** *(changes the action model, the UI flow and every balance number)*
L35 gives each unit one action per turn. So a unit spends one turn walking into range, and the target then gets to strike first or Defend. Attacking becomes costly and games may stall.
Options:
- (a) as written: one action;
- (b) an activation = an optional move plus one other action, for the unit's AP;
- (c) no per-unit limit, only the AP pool.

[Default: (a), D-T4, because that's what the text says. We recommend testing (b) early.]

**Q3. How much AP, and how is it charged?** *(changes the core turn loop; the number itself is just a setting)*
- How many AP per turn? Is it fixed, or does it grow each turn? Does unspent AP carry over?
- Is AP paid per action or once per unit per turn (C-04)?
- Does an ability's cost replace the unit's AP or add to it (U-03)?
- Is the commander's "AP of 1" its cost per action, or something it adds to the pool?

[Default: 10, fixed, no carry-over, paid per action, ability cost replaces unit AP, commander AP is a cost.]

**Q4. What does a Size-2 unit occupy?** *(changes occupancy, pathfinding, vision, targeting and deployment)*
[Default: a 2×2 block with no facing (D-G6).] Alternatives: a 1×2 piece that can rotate, or a single square tagged "large".

**Q5. Movement and adjacency.** *(changes every distance check and nearly every ability)*
- Is movement orthogonal only (L34) or 8-directional (L15)?
- Does "adjacent" include diagonals?
- Can melee attacks hit diagonally?

[Default: orthogonal movement, adjacent = 8 squares, melee = the 4 orthogonal squares (C-01, C-02).]

**Q6. Where are The Empire's units, and what does "2 variations" mean?** *(changes the amount of content and the data model)*
- Are 14 Empire units missing, or are the 14 listed units split 7/7 between the factions?
- Do commanders belong to factions (the 3 + 3 split)?
- Can an army mix factions?

[Default: Lojrar-only v1, mirror matches, any commander with any faction (D-B6, D-B7).]

**Q7. Do blockers and buildings block vision, and does a ranged attack need its own line of sight?** *(changes the vision algorithm)*
[Default: flood-fill vision, walls block sight, and ranged attacks only need the target square to be in your vision (D-F2, D-C3).]

**Q8. How far back can a take-back go?** *(changes how history is stored, and the UI)*
Only the last action? The whole turn? After the opponent has moved? What if the undone move revealed hidden units?
[Default: D-R1–D-R4.]

**Q9. Damage model details.** *(changes how unit state is modelled)*
Can losing an aura kill a unit (the MTG way) or not (the Hearthstone way)? Does the target ever hit back?
[Default: persistent damage, losing a bonus can kill, no hitting back (D-H3, D-C2).]

**Q10. Deployment.** *(changes the deployment phase and the army builder's checks)*
- Is deployment simultaneous and hidden?
- Which units can use the extended rows?
- Must every unit be deployed, and is there a maximum army size?

[Default: simultaneous and hidden; type 1–2 units may use the extended rows; everything is deployed; the army must fit its zones (D-P2, D-P3, D-B3).]

**Q11. Commander rules.** *(affects the army builder, the UI and rule checks)*
- Is the commander's identity revealed to the opponent?
- Does it count as a unit for every effect?
- Must a named commander be picked, and can both players pick the same one?

[Default: revealed when deployment starts; a full unit with no type; one of the six is required; the same pick is allowed.]

**Q12. Neutral buildings.** *(affects scenario data and the capture logic)*
- Is capture instant or checked at the end of the turn?
- Do invisible units contest a building?
- How should the one-row placement tilt be handled?
- Do the buildings block movement and vision?
- What does "optional" mean?

[Default: D-O1–D-O8.]

**Q13. Board shape: which corner rule, A–D?** *(one function, but it changes zone sizes and the art)* [Default: A.]

**Q14. Damage math.** *(small code change, big balance impact)*
- Should halving happen before or after flat reductions?
- Is there a general minimum of 1 damage?
- Does Defend also halve ability, mine and area damage?
- When does Defend end?

[Default: D-C4–D-C7.]

**Q15. Cooldowns, durations and the end-of-turn order.** *(small code change; affects many abilities)* [Default: D-T7–D-T9.]

**Q16. Match flow.** *(affects server timers and UX)*
Who goes first, and does the second player get compensation? Is there a turn timer or a turn limit? How do draws and resignation work?
[Default: D-T1, D-T3.]

**Q17. Choices on the opponent's turn (e.g. Queso's revive).** *(affects the network flow)*
Prompt the player mid-turn, or use a setting chosen in advance? [Default: a setting, D-T11.]

**Q18. Editing the budget.** *(affects the lobby)*
Who can change it, within what range, and should AP scale with it (budget ÷ 20)? [Default: the host sets it; AP stays a separate setting.]

**Q19. Sabrina: does "considered type 10" make Artificers cost 10?** *(data only)* [Default: yes, D-B4.]

**Q20. Which grade is "white" (Baba Yaga)?** *(data only)* [Default: no filter until it's defined, D-B8.]

**Q21. Effects that just say "units".** *(a reading rule the abilities analyst will apply)*
Do helpful effects mean only your own units, and do area attacks hit your own units? [Default: D-I1.]

---

## Appendix: build conventions these defaults assume
- **Deterministic rules engine:** `apply(state, action) → (state, events)`. The only randomness is the first-player coin flip, which is seeded and logged. This makes take-back exact (D-R2) and gives replays and reconnecting for free.
- **Per-player views:** the authority (D-F10) sends each player only `visibleState(player)`: no hidden units, no hidden mines and no opponent AP use (D-F5, D-F9).
- **Data-driven content:** units, factions, commanders, grade colours and scenarios (shape rule, blockers, buildings, zones, goal rows, extended-row flags) live in data files. That turns the answers to Q6, Q10, Q12, Q13, Q19 and Q20 into data edits.
- **Rule switches (⚙):** AP per turn, AP per action vs per unit, ability cost mode, adjacency (8 or 4), movement directions (4 or 8), melee reach, corner rule and radius, normal and extended rows, capture timing, take-backs, turn timer and budget.
