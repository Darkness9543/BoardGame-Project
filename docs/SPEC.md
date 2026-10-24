# Game Spec (from the project owner, 2026-10-24)

> Source of truth: `GameSpec.pdf` in the repository root. The owner's first paste lost the two-column unit table (it was exported from a spreadsheet); this Markdown copy restores that layout from the PDF. All other text is verbatim.

This is the spec for a strategy 1v1 board game. The game is based on a duel between two players, which start with a limited amount of money, and must spend that money to acquire any combination of units that can fit the budget. Moreover, each player can choose a commander, which will give bonuses to units or strategies.

The units available follow the Euro distribution: 1, 2, 5, 10, 20, 50, 100: Each unit represents a coin, and like coins, each unit has 2 variations.

Each unit has attributes of Power and Toughness, similar to MTG. Moreover, each unit has an action cost, which will scale depending on the relative power of that unit.

It's a turn-based game. In each player's turn, that player will receive a number of Action points. The player can use those action costs to use a number of units that fit its budget.

Unless stated otherwise, a single unit can only move once per turn.

The game takes place in a square grid system. There may be a scenario with blockers.

Besides special powers, all units (unless specified) share the actions of movement (1 square by default, including diagonals), attack (attacking units deals damage to the toughness of a target unit) and defend (a defending unit receives half the damage rounded up(never less than one)).

The encounter takes place in a battlefield called scenario. Each player will only have vision around the vision field of each unit. Everything outside will be in the fog of war.

Unlike MTG, the units that receive damage do not regenerate or recover toughness at the end of turn, unless some kind of ability or skill is involved.

The game will feature a main menu where the player can either:
- Choose to play, in which case he will create a lobby and will have a link to invite another player.
- Create or edit army compositions
- Check his achivements

Army compositions don't have to be made only from the menu option. If a player wants to create a new one when a game starts, he can do so there aswell.
The player will have a budget of 200, which can be edited in the future, but for now the default is 200.
The player first chooses the units that wants to have for that encounter.
After that follows a deployment phase: Each player gets a portion of the map, at the edges and usually opposing each other, where they can deploy the units. Some units can be deployed in the extended deployment area, which covers slightly more terrain.
The size of the battlefields are 25x25, where the corners are cut off with a radius of 4.
The normal deployment zone covers the first 5 rows closest to the player. The extended deployment zone covers 2 extra rows.
The objective of each player is to defeat the commander of each party. The commander is by default a 1/1 unit, movement and AP of 1, LOV of 3, and doesn't count from the budget. Another way of winning is if you manage to bring your commander to the opposite side of the board. More specifically, to the last row.

Units movement is defined by their movement stat. When a player takes an action to move the unit, that unit moves as many squares as the movement stat. The movement is orthogonal, a movement-piece cannot be diagonal. For instance: A unit with movement 2 can move left then up to complete a diagonal movement.
A unit can only use one action per turn, unless stated otherwise.

LOV (Line of Vision) or vision, is also determined using this logic. A LOV of 1 will only show the 4 orthogonal adjacent squares. A LOV of 2, will show 12 squares around the unit, and so on.

There will be a take back option for each player. The opponent player has to accept the take back.

## About the graphics

The game features, for now, 2 clans or factions. It may be possible to add new factions later into the game.
Despite being inspired in the euro distribution, each unit will be represented by a token. The color of the token will represent the grade of the unit. The symbol on top of the token will represent the particular unit that token represents.
The battlefield will take place in a square grid. For now, the objectives stand as conquest or domination (Killing enemy commander, reaching the other side of the board). There will be, however, for now, two optional objectives: The keep, The market. Each one will occupy a 2x2 square and will be conquered when at least one unit, without opposition, is in range of 1(including corners) of that building. One conquered, the building can be reconquered by the same method.
The neutral objectives are represented by 3d objects and a symbol in the middle that represents this building.
The style of the graphics is stylized.
The view can switch from top to isometric. Top by default.

## Neutral objectives

- The keep: While the keep is active, all units receive a bonus of 3 power.
- The market: While the market is active, all type-1 unit have an additional action per turn.

## Units

Units here will be described as Name, Power/Toughness, Size, LOV, Movement, AP, Ability:AbilityCost:Description

The PDF lays the units out as a two-column table: the left column is **The Empire**, the right column is **Lojrar Clan**. Each tier (coin value) has exactly one unit per faction.

| Tier | The Empire | Lojrar Clan |
|---|---|---|
| 1 | Footman | Mercenary |
| 2 | Soldier | Ranger |
| 5 | Berserker | Rogue |
| 10 | Priestess | Juliomancer |
| 20 | Paladin | Artificer |
| 50 | Royal wizard | Beast of Knorund |
| 100 | Celestial Emissary | Scourge of the Gods |

### Tier 1

**The Empire — Footman, 1/2, 1, 1, 1, 1**
Line Formation:P:If there's another 2 adjacent Footmen, reduce the incoming damage by 2 (not below 1).

**Lojrar Clan — Mercenary, 2/1, 1, 1, 1, 1**
Fierce attacker:P:Deal 1 extra damage for each Mercenary that is adjacent to the attacked unit

### Tier 2

**The Empire — Soldier, 2/7, 1, 2, 1, 1**
Perseverance:P: Regenerate 1 toughness at the end of the turn (Your turn)

**Lojrar Clan — Ranger, 3/1, 1, 3, 1, 1**
Ranged attack:P: This unit's attack has a range of 2.

### Tier 5

**The Empire — Berserker, 12/2, 1, 2, 1, 1**
Savagery:P: After attacking with the berserker, you can spend 2 AP to attack an additional time. Only once per turn.

**Lojrar Clan — Rogue, 7/4, 1, 3, 2, 2**
Stealth:1:Only activate this ability if not inside the LOV of another enemy creature. This unit becomes invisible. It will be revealed when it's 1 square away from an enemy unit, or when receiving damage inside enemy LOV.
Assault: When an enemy unit comes into the melee range of this unit, if this unit is in stealth, perform an automatic attack without spending AP to the entering unit. (This can also occur in opponents turn)

### Tier 10

**The Empire — Priestess, 3/15, 1, 2, 2, 2**
Strong aura:P: units adjacent to priestess, gain additional 1 power and 1 toughness
Shared wounds: Sacrifice half of adjacent unit's (or itself) hp. Heal other unit (including itself) hp by that number, but no more than units base hp.

**Lojrar Clan — Juliomancer, 3/15, 1, 3, 1, 2**
Mind's Eye:P: This unit reveals invisible units in its LOV
Julio Vernification:2: Sacrifice an adjacent unit. Deal damage equal to its current toughness to a unit in range 2.

### Tier 20

**The Empire — Paladin: 12/20, 1, 2, 3, 2**
Reinforced Armor:P: Reduce all damage dealt to this unit by 3 (can't be less than 1)

**Lojrar Clan — Artificer, 1/15, 1, 3, 2, 1**
Mind's Eye:P: This unit reveals invisible units in its LOV.
Prototype No-ACB:2: Create a dummy unit in a free adjacent square. It's a 0/7 unit, it cannot move and has a LOV of 1 and AP 1. A maximum of 3 dummies can be active at the same time. (All artificers; Every two artificers beyond the first one increase this limit by 1)
Mad inventor: Prototypes NO-ACB can move when adjacent to any allied artificer and gain 1 power. (This effect disappears when the artificer steps out of range).
Trip Mine B20:2: Deploy an invisible mine in a free adjacent square. It explodes when any unit steps on it. Deals 5 damage + 5 if the unit has a size of 2 or greater. A maximum of 5 mines can be active at the same time (All artificers; Each artificer beyond the first one increases this limit by 1), Mines can be triggered from distance by attacking the square with a ranged attack.
(NOTE about pathing (dont include this into the description), when pathfinding, ally units will not go though mines automatically. Ask the player if he wants a unit to go to a mined square. The player can deactivate this warning from options)

### Tier 50

**The Empire — Royal wizard, 10/20, 1, 3, 1, 3**
Forcefield:2: Choose 4 adjacent squares in wizards LOV. Damage received to friendly units inside the forcefield reduced by 8. CD 1 turn
Pajazon:3: Create an area of 3x3, with center at range 3, for 2 turns. At the end of your turn, allied units in the area regenerate 3 toughness; At the end of the opponent's turn, enemy units take 3 damage. CD 1 turn

**Lojrar Clan — Beast of Knorund, 20/40, 2, 2, 2, 3**
Forceful slam:4: Deal 10 damage to an adjacent square, and 3 damage to the 5 opposite adjacent squares of the target. CD 1 turn
Feast:2: Sacrifice an adjacent unit: Gain life equal to its toughness

### Tier 100

**The Empire — Celestial Emissary, 15/50, 1, 4, 2, 4**
Holy blessing:3: Heal ally units in a range of 2 by 5
Smite:3: Deal 8 damage to a unit, at a range of 3.
Holy Fervor: This unit can take 2 actions per turn. The second action costs 1 extra AP

**Lojrar Clan — Scourge of the Gods, 15/33, 1, 3, 2, 3**
Command Aura:P: Units within range 2 of this unit can take an additional action each turn. Doesn't include this unit.

## Commanders

The PDF lists the commanders as two groups of three, separated by blank lines, without faction headers.

Trill "The Hydrocephalic": All units of type 1, 2, 5 gain 2 toughness. The commander has toughness 10.
Kulega "The Fine Printer": All units gain 1 LOV. All units of type-20 gain the following ability: When a unit of type 1 or 2 dies adjacent to this unit, regenerate toughness equal to that creature toughness, maximum of 4 per instance.
Sabrina "The Reelfinisher": Artificers and No-ACBs get 2 additional power. Artificers now are considered type 10. Artificers can no longer use mines. Each other type-20 and above is 20% more expensive to deploy.

Baba Yaga "The Bwitch": Units of white gain the ability to regenerate 2 toughness for 2 AP (each instance). Only up to 2 units can regenerate toughness this way per turn. Can be applied twice to the same unit. CD 1
Ratasius I "The Great": This commander has LOV of 6. Reveals all invisible enemies in range of 3. Enemies in range of 1 gain weakness and deal 4 less damage
Queso "The Beacon of hope": This commander's AP is 3, and 3 toughness. Nearby units in range of 2 regenerate 5 health each player turn (not the opponent's turn). When a unit in that area dies you can choose to sacrifice 1 max toughness to revive that unit with half of its base toughness rounded up

## Owner rulings given in chat (2026-10-24)

- AP: base 10 per turn; each round every player gets 1 extra AP, up to a maximum of 20.
- A cap of 50 units at deployment.
- Movement is orthogonal.
- Factions are the two columns above (Empire left, Lojrar Clan right).
- Swarms may be the strongest in the model, but real players don't use them that effectively; iterate on balance later.
- A buff for Baba Yaga may be suggested.
- Commanders are not tied to a faction (on first instance).
- Commander base toughness 5 and movement 2 (the proposed values were accepted).
- The AP curve is the same for both players; no first-turn reduction.
- The 50-unit cap does not count units created during play.
- Baba Yaga: the player chooses one of the three proposed variants (Mend the swarm, Hex Ward, Cauldron) when picking her; the original regeneration text is replaced.
- The UI should be exquisite to use, with as many quality-of-life features (the ones that make sense) of good quality as possible.
- Sound effects are in scope. Visual effects and animations should have "a grit and viscerality to it, while staying readable and not too exaggerated."
- "Each player can choose units from both factions without any restriction." (Armies may mix the two factions' units.)

## Delivery notes from the owner

- Any question about the system, or perceived ambiguity, as well as suggestions, can be proposed now and anytime in the future when convenient.
- The game, preferably, should be made for the browser, with a way to connect with another player. This should be done in a way that requires the least setup. For now, assume that only another player will play.
- Any framework may be used. For the artstyle and graphics, references and/or free asset packs may be used if suitable; otherwise design the graphics. Any artistic decision will show a quick mock in a page, as well as justification for the use. If there are several contenders, all should be represented and justified.
