# Third-party art assets: licences and attribution

Every file under `apps/web/public/assets/` comes from one of the sources below. Paths here and in `manifest.json` are relative to `apps/web/public/` (the web root). For example, `assets/icons/clean/spears.svg` is served at `<base>/assets/icons/clean/spears.svg`. `manifest.json` lists every file with its source URL, licence, author and intended use. All sources and licences were checked on 2026-10-24.

| Source | Licence | Attribution | Folder |
|---|---|---|---|
| game-icons.net (8 authors) | CC BY 3.0 | **Required** | `assets/icons/` |
| KayKit Medieval Hexagon Pack 1.0 (Kay Lousberg) | CC0 1.0 | Optional (given) | `assets/models/kaykit-medieval-hexagon/` |
| Kenney Castle Kit 2.0 | CC0 1.0 | Optional (given) | `assets/models/kenney-castle-kit/` |
| Kenney Fantasy Town Kit 2.0 | CC0 1.0 | Optional (given) | `assets/models/kenney-fantasy-town-kit/` |
| Kenney Tower Defense Kit 2.1 | CC0 1.0 | Optional (given) | `assets/models/kenney-tower-defense-kit/` |
| Kenney Nature Kit 2.1 | CC0 1.0 | Optional (given) | `assets/models/kenney-nature-kit/` |

## Credits text for the game

The game-icons.net FAQ asks video games to make the credits reachable from a menu. This block covers every file in this folder:

```text
Icons made by Lorc, Delapouite, Skoll, Caro Asercion, Cathelineau, DarkZaitzev, Sbed and Willdabeast, from https://game-icons.net,
licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).
The icons were modified: background removed and recoloured.
3D models by Kay Lousberg / KayKit (www.kaylousberg.com) and Kenney (www.kenney.nl),
CC0 1.0 (credit optional, given with thanks).
```

## 1. game-icons.net

- **Licence:** Creative Commons Attribution 3.0 Unported (CC BY 3.0), https://creativecommons.org/licenses/by/3.0/
- **Source:** https://game-icons.net. Files come from https://github.com/game-icons/icons (`master` branch, raw URL `https://raw.githubusercontent.com/game-icons/icons/master/{author}/{name}.svg`).
- **Licence text in the repo** (`license.txt`), quoted:
  > Icons provided under the Creative Commons 3.0 BY or CC0 if mentioned below.
  >
  > Please, include a mention "Icons made by {author}" in your derivative work.
- The CC0 exception covers only the Viscious Speed and Zeromancer folders. Neither is used here, so every icon is CC BY 3.0.
- **Two copies of each icon:**
  - `assets/icons/game-icons/<author>/<name>.svg`: unmodified originals (a black 512x512 square plus a white glyph).
  - `assets/icons/clean/<name>.svg`: **adapted** copies. The background square path is removed, the glyph fill is set to `currentColor`, and `viewBox="0 0 512 512"` is kept. CC BY 3.0 asks that adaptations say what changed, and the credits text above does that.
- **Author pages** are the links that game-icons.net gives on its own icon pages (`rel="author"`). Skoll, Cathelineau and Caro Asercion have no personal page there, so game-icons.net links them to its home page. Each author's icons are also listed at `https://github.com/game-icons/icons/tree/master/<folder>`.

### Required attribution, one line per author

- Icons made by [Lorc](https://lorcblog.blogspot.com) from [game-icons.net](https://game-icons.net), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Icons made by [Delapouite](https://delapouite.com) from [game-icons.net](https://game-icons.net), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Icons made by [Skoll](https://game-icons.net) from [game-icons.net](https://game-icons.net), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Icons made by [Caro Asercion](https://game-icons.net) from [game-icons.net](https://game-icons.net), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Icons made by [Cathelineau](https://game-icons.net) from [game-icons.net](https://game-icons.net), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Icons made by [DarkZaitzev](http://darkzaitzev.deviantart.com) from [game-icons.net](https://game-icons.net), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Icons made by [Sbed](http://opengameart.org/content/95-game-icons) from [game-icons.net](https://game-icons.net), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Icons made by [Willdabeast](http://wjbstories.blogspot.com) from [game-icons.net](https://game-icons.net), licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

### Files taken, by author

87 icons. Each one is stored as an original and as a cleaned copy, so there are 174 SVG files.

| Author (folder, count) | Author page | Icons (each links to its game-icons.net page) |
|---|---|---|
| Lorc (`lorc/`, 51) | https://lorcblog.blogspot.com | [angel-outfit](https://game-icons.net/1x1/lorc/angel-outfit.html), [angel-wings](https://game-icons.net/1x1/lorc/angel-wings.html), [battle-axe](https://game-icons.net/1x1/lorc/battle-axe.html), [bowman](https://game-icons.net/1x1/lorc/bowman.html), [brain](https://game-icons.net/1x1/lorc/brain.html), [checked-shield](https://game-icons.net/1x1/lorc/checked-shield.html), [cheese-wedge](https://game-icons.net/1x1/lorc/cheese-wedge.html), [cloak-dagger](https://game-icons.net/1x1/lorc/cloak-dagger.html), [crossed-swords](https://game-icons.net/1x1/lorc/crossed-swords.html), [crown-coin](https://game-icons.net/1x1/lorc/crown-coin.html), [crowned-skull](https://game-icons.net/1x1/lorc/crowned-skull.html), [crystal-ball](https://game-icons.net/1x1/lorc/crystal-ball.html), [daggers](https://game-icons.net/1x1/lorc/daggers.html), [eagle-emblem](https://game-icons.net/1x1/lorc/eagle-emblem.html), [energy-shield](https://game-icons.net/1x1/lorc/energy-shield.html), [gear-hammer](https://game-icons.net/1x1/lorc/gear-hammer.html), [heavy-helm](https://game-icons.net/1x1/lorc/heavy-helm.html), [heavy-thorny-triskelion](https://game-icons.net/1x1/lorc/heavy-thorny-triskelion.html), [holy-grail](https://game-icons.net/1x1/lorc/holy-grail.html), [hood](https://game-icons.net/1x1/lorc/hood.html), [hourglass](https://game-icons.net/1x1/lorc/hourglass.html), [land-mine](https://game-icons.net/1x1/lorc/land-mine.html), [laurel-crown](https://game-icons.net/1x1/lorc/laurel-crown.html), [laurels](https://game-icons.net/1x1/lorc/laurels.html), [lightning-helix](https://game-icons.net/1x1/lorc/lightning-helix.html), [magic-shield](https://game-icons.net/1x1/lorc/magic-shield.html), [magnifying-glass](https://game-icons.net/1x1/lorc/magnifying-glass.html), [minotaur](https://game-icons.net/1x1/lorc/minotaur.html), [pointy-hat](https://game-icons.net/1x1/lorc/pointy-hat.html), [pointy-sword](https://game-icons.net/1x1/lorc/pointy-sword.html), [prayer](https://game-icons.net/1x1/lorc/prayer.html), [raven](https://game-icons.net/1x1/lorc/raven.html), [robot-golem](https://game-icons.net/1x1/lorc/robot-golem.html), [rune-stone](https://game-icons.net/1x1/lorc/rune-stone.html), [sacrificial-dagger](https://game-icons.net/1x1/lorc/sacrificial-dagger.html), [scales](https://game-icons.net/1x1/lorc/scales.html), [semi-closed-eye](https://game-icons.net/1x1/lorc/semi-closed-eye.html), [spanner](https://game-icons.net/1x1/lorc/spanner.html), [spears](https://game-icons.net/1x1/lorc/spears.html), [stag-head](https://game-icons.net/1x1/lorc/stag-head.html), [target-dummy](https://game-icons.net/1x1/lorc/target-dummy.html), [tattered-banner](https://game-icons.net/1x1/lorc/tattered-banner.html), [third-eye](https://game-icons.net/1x1/lorc/third-eye.html), [tinker](https://game-icons.net/1x1/lorc/tinker.html), [tripwire](https://game-icons.net/1x1/lorc/tripwire.html), [vintage-robot](https://game-icons.net/1x1/lorc/vintage-robot.html), [visored-helm](https://game-icons.net/1x1/lorc/visored-helm.html), [walking-boot](https://game-icons.net/1x1/lorc/walking-boot.html), [white-tower](https://game-icons.net/1x1/lorc/white-tower.html), [witch-flight](https://game-icons.net/1x1/lorc/witch-flight.html), [wolf-head](https://game-icons.net/1x1/lorc/wolf-head.html) |
| Delapouite (`delapouite/`, 29) | https://delapouite.com | [anticlockwise-rotation](https://game-icons.net/1x1/delapouite/anticlockwise-rotation.html), [bow-arrow](https://game-icons.net/1x1/delapouite/bow-arrow.html), [castle](https://game-icons.net/1x1/delapouite/castle.html), [centurion-helmet](https://game-icons.net/1x1/delapouite/centurion-helmet.html), [cross-shield](https://game-icons.net/1x1/delapouite/cross-shield.html), [enrage](https://game-icons.net/1x1/delapouite/enrage.html), [film-spool](https://game-icons.net/1x1/delapouite/film-spool.html), [flail](https://game-icons.net/1x1/delapouite/flail.html), [fleur-de-lys](https://game-icons.net/1x1/delapouite/fleur-de-lys.html), [griffin-symbol](https://game-icons.net/1x1/delapouite/griffin-symbol.html), [healing](https://game-icons.net/1x1/delapouite/healing.html), [heart-shield](https://game-icons.net/1x1/delapouite/heart-shield.html), [invisible](https://game-icons.net/1x1/delapouite/invisible.html), [knight-banner](https://game-icons.net/1x1/delapouite/knight-banner.html), [knot](https://game-icons.net/1x1/delapouite/knot.html), [laurels-trophy](https://game-icons.net/1x1/delapouite/laurels-trophy.html), [mammoth](https://game-icons.net/1x1/delapouite/mammoth.html), [medieval-pavilion](https://game-icons.net/1x1/delapouite/medieval-pavilion.html), [meeple-king](https://game-icons.net/1x1/delapouite/meeple-king.html), [ogre](https://game-icons.net/1x1/delapouite/ogre.html), [rat](https://game-icons.net/1x1/delapouite/rat.html), [robin-hood-hat](https://game-icons.net/1x1/delapouite/robin-hood-hat.html), [shop](https://game-icons.net/1x1/delapouite/shop.html), [spartan-helmet](https://game-icons.net/1x1/delapouite/spartan-helmet.html), [take-my-money](https://game-icons.net/1x1/delapouite/take-my-money.html), [templar-shield](https://game-icons.net/1x1/delapouite/templar-shield.html), [tower-flag](https://game-icons.net/1x1/delapouite/tower-flag.html), [viking-head](https://game-icons.net/1x1/delapouite/viking-head.html), [wizard-face](https://game-icons.net/1x1/delapouite/wizard-face.html) |
| Skoll (`skoll/`, 2) | https://game-icons.net | [chess-king](https://game-icons.net/1x1/skoll/chess-king.html), [teller-mine](https://game-icons.net/1x1/skoll/teller-mine.html) |
| Caro Asercion (`caro-asercion/`, 1) | https://game-icons.net | [heraldic-sun](https://game-icons.net/1x1/caro-asercion/heraldic-sun.html) |
| Cathelineau (`cathelineau/`, 1) | https://game-icons.net | [boar-ensign](https://game-icons.net/1x1/cathelineau/boar-ensign.html) |
| DarkZaitzev (`darkzaitzev/`, 1) | http://darkzaitzev.deviantart.com | [hooded-assassin](https://game-icons.net/1x1/darkzaitzev/hooded-assassin.html) |
| Sbed (`sbed/`, 1) | http://opengameart.org/content/95-game-icons | [regeneration](https://game-icons.net/1x1/sbed/regeneration.html) |
| Willdabeast (`willdabeast/`, 1) | http://wjbstories.blogspot.com | [round-shield](https://game-icons.net/1x1/willdabeast/round-shield.html) |

### What each icon is for

| File in `assets/icons/clean/` | Author | Intended use |
|---|---|---|
| `spears.svg` | Lorc | unit symbol: Footman (grade 1) - primary (recommended default) |
| `round-shield.svg` | Willdabeast | unit symbol: Footman (grade 1) - alternate 1 |
| `spartan-helmet.svg` | Delapouite | unit symbol: Footman (grade 1) - alternate 2 |
| `crossed-swords.svg` | Lorc | unit symbol: Mercenary (grade 1) - primary (recommended default); also the contested-objective glyph |
| `daggers.svg` | Lorc | unit symbol: Mercenary (grade 1) - alternate 1 |
| `take-my-money.svg` | Delapouite | unit symbol: Mercenary (grade 1) - alternate 2 |
| `visored-helm.svg` | Lorc | unit symbol: Soldier (grade 2) - primary (recommended default) |
| `centurion-helmet.svg` | Delapouite | unit symbol: Soldier (grade 2) - alternate 1 |
| `heavy-helm.svg` | Lorc | unit symbol: Soldier (grade 2) - alternate 2 |
| `bowman.svg` | Lorc | unit symbol: Ranger (grade 2) - primary (recommended default) |
| `bow-arrow.svg` | Delapouite | unit symbol: Ranger (grade 2) - alternate 1 |
| `robin-hood-hat.svg` | Delapouite | unit symbol: Ranger (grade 2) - alternate 2 |
| `battle-axe.svg` | Lorc | unit symbol: Berserker (grade 5) - primary (recommended default) |
| `viking-head.svg` | Delapouite | unit symbol: Berserker (grade 5) - alternate 1 |
| `enrage.svg` | Delapouite | unit symbol: Berserker (grade 5) - alternate 2 |
| `hood.svg` | Lorc | unit symbol: Rogue (grade 5) - primary (recommended default) |
| `cloak-dagger.svg` | Lorc | unit symbol: Rogue (grade 5) - alternate 1 |
| `hooded-assassin.svg` | DarkZaitzev | unit symbol: Rogue (grade 5) - alternate 2 |
| `holy-grail.svg` | Lorc | unit symbol: Priestess (grade 10) - primary (recommended default) |
| `prayer.svg` | Lorc | unit symbol: Priestess (grade 10) - alternate 1 |
| `healing.svg` | Delapouite | unit symbol: Priestess (grade 10) - alternate 2 |
| `third-eye.svg` | Lorc | unit symbol: Juliomancer (grade 10) - primary (recommended default) |
| `sacrificial-dagger.svg` | Lorc | unit symbol: Juliomancer (grade 10) - alternate 1 |
| `crystal-ball.svg` | Lorc | unit symbol: Juliomancer (grade 10) - alternate 2 |
| `templar-shield.svg` | Delapouite | unit symbol: Paladin (grade 20) - primary (recommended default) |
| `knight-banner.svg` | Delapouite | unit symbol: Paladin (grade 20) - alternate 1 |
| `cross-shield.svg` | Delapouite | unit symbol: Paladin (grade 20) - alternate 2 |
| `gear-hammer.svg` | Lorc | unit symbol: Artificer (grade 20) - primary (recommended default); also the 'Mad inventor' badge on the Prototype |
| `tinker.svg` | Lorc | unit symbol: Artificer (grade 20) - alternate 1 |
| `spanner.svg` | Lorc | unit symbol: Artificer (grade 20) - alternate 2 |
| `pointy-hat.svg` | Lorc | unit symbol: Royal Wizard (grade 50) - primary (recommended default) |
| `wizard-face.svg` | Delapouite | unit symbol: Royal Wizard (grade 50) - alternate 1 |
| `magic-shield.svg` | Lorc | unit symbol: Royal Wizard (grade 50) - alternate 2 |
| `minotaur.svg` | Lorc | unit symbol: Beast of Knorund (grade 50) - primary (recommended default) |
| `mammoth.svg` | Delapouite | unit symbol: Beast of Knorund (grade 50) - alternate 1 |
| `ogre.svg` | Delapouite | unit symbol: Beast of Knorund (grade 50) - alternate 2 |
| `angel-wings.svg` | Lorc | unit symbol: Celestial Emissary (grade 100) - primary (recommended default) |
| `angel-outfit.svg` | Lorc | unit symbol: Celestial Emissary (grade 100) - alternate 1 |
| `heraldic-sun.svg` | Caro Asercion | unit symbol: Celestial Emissary (grade 100) - alternate 2 |
| `crowned-skull.svg` | Lorc | unit symbol: Scourge of the Gods (grade 100) - primary (recommended default) |
| `flail.svg` | Delapouite | unit symbol: Scourge of the Gods (grade 100) - alternate 1 |
| `tattered-banner.svg` | Lorc | unit symbol: Scourge of the Gods (grade 100) - alternate 2 |
| `chess-king.svg` | Skoll | commander badge - primary (recommended default) |
| `laurel-crown.svg` | Lorc | commander badge - alternate 1 |
| `meeple-king.svg` | Delapouite | commander badge - alternate 2 |
| `vintage-robot.svg` | Lorc | token symbol: Prototype No-ACB (dummy) - primary (recommended default) |
| `target-dummy.svg` | Lorc | token symbol: Prototype No-ACB (dummy) - alternate 1 |
| `robot-golem.svg` | Lorc | token symbol: Prototype No-ACB (dummy) - alternate 2 |
| `teller-mine.svg` | Skoll | token symbol: Trip Mine - primary (recommended default) |
| `land-mine.svg` | Lorc | token symbol: Trip Mine - alternate 1 |
| `tripwire.svg` | Lorc | token symbol: Trip Mine - alternate 2 |
| `white-tower.svg` | Lorc | objective emblem: Keep - primary (recommended default) |
| `castle.svg` | Delapouite | objective emblem: Keep - alternate 1 |
| `tower-flag.svg` | Delapouite | objective emblem: Keep - alternate 2 |
| `shop.svg` | Delapouite | objective emblem: Market - primary (recommended default) |
| `scales.svg` | Lorc | objective emblem: Market - alternate 1 |
| `medieval-pavilion.svg` | Delapouite | objective emblem: Market - alternate 2 |
| `eagle-emblem.svg` | Lorc | faction emblem: Empire - primary (recommended default) |
| `laurels.svg` | Lorc | faction emblem: Empire - alternate 1 |
| `griffin-symbol.svg` | Delapouite | faction emblem: Empire - alternate 2 |
| `wolf-head.svg` | Lorc | faction emblem: Lojrar - primary (recommended default) |
| `stag-head.svg` | Lorc | faction emblem: Lojrar - alternate 1 |
| `boar-ensign.svg` | Cathelineau | faction emblem: Lojrar - alternate 2 |
| `brain.svg` | Lorc | commander portrait: Trill "The Hydrocephalic" |
| `magnifying-glass.svg` | Lorc | commander portrait: Kulega "The Fine Printer" |
| `film-spool.svg` | Delapouite | commander portrait: Sabrina "The Reelfinisher" |
| `witch-flight.svg` | Lorc | commander portrait: Baba Yaga "The Bwitch" |
| `rat.svg` | Delapouite | commander portrait: Ratasius I "The Great" |
| `cheese-wedge.svg` | Lorc | commander portrait: Queso "The Beacon of hope" |
| `pointy-sword.svg` | Lorc | UI stat icon: Power |
| `heart-shield.svg` | Delapouite | UI stat icon: Toughness |
| `semi-closed-eye.svg` | Lorc | UI stat icon: LOV; also the stealth-revealed badge |
| `walking-boot.svg` | Lorc | UI stat icon: Movement |
| `lightning-helix.svg` | Lorc | UI stat icon: AP |
| `hourglass.svg` | Lorc | UI icon: Cooldown; also the acted/no-actions-left badge |
| `checked-shield.svg` | Lorc | status badge: Defending |
| `invisible.svg` | Delapouite | status badge: Stealthed (owner view) |
| `regeneration.svg` | Sbed | status badge: Regeneration |
| `anticlockwise-rotation.svg` | Delapouite | UI icon: Take-back (research-art.md 4.3 primary; not in icons.json) |
| `laurels-trophy.svg` | Delapouite | UI icon: Achievements (research-art.md 4.3 primary; not in icons.json) |
| `crown-coin.svg` | Lorc | UI icon: Budget (research-art.md 4.3 primary; not in icons.json) |
| `energy-shield.svg` | Lorc | status overlay glyph: Forcefield (research-art.md 6.4; not in icons.json) |
| `fleur-de-lys.svg` | Delapouite | faction emblem: Empire E2 contender (research-art.md 8; not in icons.json) |
| `raven.svg` | Lorc | faction emblem: Lojrar L3 contender (research-art.md 8; not in icons.json) |
| `heavy-thorny-triskelion.svg` | Lorc | faction emblem: Lojrar L3 contender, alternative to raven (research-art.md 8; not in icons.json) |
| `knot.svg` | Delapouite | faction motif: Lojrar L1 knot band (research-art.md 8; not in icons.json) |
| `rune-stone.svg` | Lorc | faction motif: Lojrar L1 rune stone (research-art.md 8; not in icons.json) |

## 2. KayKit - Medieval Hexagon Pack 1.0

- **Author:** Kay Lousberg (KayKit), www.kaylousberg.com
- **Licence:** Creative Commons Zero (CC0 1.0 Universal), https://creativecommons.org/publicdomain/zero/1.0/
- **Licence text** (`LICENSE.txt`, copied here): "This content is free to use in personal, educational and commercial projects. Support me by crediting Kay Lousberg, www.kaylousberg.com (this is not mandatory)"
- **Source:** https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 at commit `84fa4e91af6a88989be7c99e0891cede11f2ca38` (2024-04-26), folder `addons/kaykit_medieval_hexagon_pack/Assets/gltf/buildings/<colour>/`. The official page is https://kaylousberg.itch.io/kaykit-medieval-hexagon. Every file matched its git blob SHA.
- **Attribution required:** no. Credit given: "3D models by Kay Lousberg / KayKit (www.kaylousberg.com), CC0".
- **Layout:** all files sit flat in one folder. Each `.gltf` references its own `.bin` and `hexagons_medieval.png` by bare file name, so no paths were edited. The repo ships 53 byte-identical copies of the atlas, and one copy is kept.
- **Not present in the pack:** `building_wall*`. The pack's walls are the neutral `wall_*` pieces, which were taken as the candidate wall blockers.

Files taken (65; each model is a `.gltf` plus its `.bin`):

| File | Intended use | Nodes / meshes |
|---|---|---|
| `building_castle_blue.gltf` + `building_castle_blue.bin` | Keep model K1/K1b (team colour blue) | 1 / 1 |
| `building_market_blue.gltf` + `building_market_blue.bin` | Market model M1 (team colour blue) | 1 / 1 |
| `building_tower_A_blue.gltf` + `building_tower_A_blue.bin` | candidate blocker / keep alt (tower A, blue) | 2 / 2 |
| `building_tower_B_blue.gltf` + `building_tower_B_blue.bin` | candidate blocker / keep alt (tower B, blue) | 2 / 2 |
| `building_tower_base_blue.gltf` + `building_tower_base_blue.bin` | candidate blocker (tower base, blue) | 1 / 1 |
| `building_tower_catapult_blue.gltf` + `building_tower_catapult_blue.bin` | candidate blocker (catapult tower, blue) | 3 / 3 |
| `building_castle_green.gltf` + `building_castle_green.bin` | Keep model K1/K1b (team colour green) | 1 / 1 |
| `building_market_green.gltf` + `building_market_green.bin` | Market model M1 (team colour green) | 1 / 1 |
| `building_tower_A_green.gltf` + `building_tower_A_green.bin` | candidate blocker / keep alt (tower A, green) | 2 / 2 |
| `building_tower_B_green.gltf` + `building_tower_B_green.bin` | candidate blocker / keep alt (tower B, green) | 2 / 2 |
| `building_tower_base_green.gltf` + `building_tower_base_green.bin` | candidate blocker (tower base, green) | 1 / 1 |
| `building_tower_catapult_green.gltf` + `building_tower_catapult_green.bin` | candidate blocker (catapult tower, green) | 3 / 3 |
| `building_castle_red.gltf` + `building_castle_red.bin` | Keep model K1/K1b (team colour red) | 1 / 1 |
| `building_market_red.gltf` + `building_market_red.bin` | Market model M1 (team colour red) | 1 / 1 |
| `building_tower_A_red.gltf` + `building_tower_A_red.bin` | candidate blocker / keep alt (tower A, red) | 2 / 2 |
| `building_tower_B_red.gltf` + `building_tower_B_red.bin` | candidate blocker / keep alt (tower B, red) | 2 / 2 |
| `building_tower_base_red.gltf` + `building_tower_base_red.bin` | candidate blocker (tower base, red) | 1 / 1 |
| `building_tower_catapult_red.gltf` + `building_tower_catapult_red.bin` | candidate blocker (catapult tower, red) | 3 / 3 |
| `building_castle_yellow.gltf` + `building_castle_yellow.bin` | Keep model K1/K1b (team colour yellow) | 1 / 1 |
| `building_market_yellow.gltf` + `building_market_yellow.bin` | Market model M1 (team colour yellow) | 1 / 1 |
| `building_tower_A_yellow.gltf` + `building_tower_A_yellow.bin` | candidate blocker / keep alt (tower A, yellow) | 2 / 2 |
| `building_tower_B_yellow.gltf` + `building_tower_B_yellow.bin` | candidate blocker / keep alt (tower B, yellow) | 2 / 2 |
| `building_tower_base_yellow.gltf` + `building_tower_base_yellow.bin` | candidate blocker (tower base, yellow) | 1 / 1 |
| `building_tower_catapult_yellow.gltf` + `building_tower_catapult_yellow.bin` | candidate blocker (catapult tower, yellow) | 3 / 3 |
| `wall_straight.gltf` + `wall_straight.bin` | candidate blocker (neutral wall piece) | 1 / 1 |
| `wall_straight_gate.gltf` + `wall_straight_gate.bin` | candidate blocker (neutral wall piece) | 3 / 3 |
| `wall_corner_A_gate.gltf` + `wall_corner_A_gate.bin` | candidate blocker (neutral wall piece) | 3 / 3 |
| `wall_corner_A_inside.gltf` + `wall_corner_A_inside.bin` | candidate blocker (neutral wall piece) | 1 / 1 |
| `wall_corner_A_outside.gltf` + `wall_corner_A_outside.bin` | candidate blocker (neutral wall piece) | 1 / 1 |
| `wall_corner_B_inside.gltf` + `wall_corner_B_inside.bin` | candidate blocker (neutral wall piece) | 1 / 1 |
| `wall_corner_B_outside.gltf` + `wall_corner_B_outside.bin` | candidate blocker (neutral wall piece) | 1 / 1 |
| `hexagons_medieval.png` | shared gradient atlas texture for all KayKit models | |
| `LICENSE.txt` | pack licence (CC0) | |
| `README.md` | pack readme | |

## 3. Kenney - Castle Kit 2.0

- **Author:** Kenney, www.kenney.nl
- **Licence:** Creative Commons Zero (CC0 1.0 Universal), https://creativecommons.org/publicdomain/zero/1.0/
- **Licence text** (`License.txt`, copied here): "Support by crediting 'Kenney' or 'www.kenney.nl' (this is not a requirement)"
- **Source:** https://kenney.nl/assets/castle-kit. Zip: https://kenney.nl/media/pages/assets/castle-kit/a395102d20-1711543616/kenney_castle-kit.zip
- **Attribution required:** no. Credit given: "3D models by Kenney (www.kenney.nl), CC0".
- **Textures:** every GLB references the external `Textures/colormap.png` (it is not embedded). The file is copied from `Models/GLB format/Textures/` to the same relative place.

| File | Zip member | Intended use | Nodes / meshes |
|---|---|---|---|
| `tower-square.glb` | `Models/GLB format/tower-square.glb` | Keep option K2 (4x tower-square in a 2x2 block) | 1 / 1 |
| `flag-banner-long.glb` | `Models/GLB format/flag-banner-long.glb` | Keep option K2 banner | 1 / 1 |
| `flag.glb` | `Models/GLB format/flag.glb` | ownership banner on captured objectives (recolour via colormap) | 1 / 1 |
| `wall.glb` | `Models/GLB format/wall.glb` | candidate blocker (wall segment) | 1 / 1 |
| `rocks-large.glb` | `Models/GLB format/rocks-large.glb` | board B3 blocker (rocks) | 1 / 1 |
| `tree-large.glb` | `Models/GLB format/tree-large.glb` | board B3 blocker (tree) | 1 / 1 |
| `Textures/colormap.png` | `Models/GLB format/Textures/colormap.png` | shared colormap texture referenced by every Castle Kit GLB (Textures/colormap.png) |  |
| `License.txt` | `License.txt` | kit licence (CC0) |  |

## 4. Kenney - Fantasy Town Kit 2.0

- **Author:** Kenney, www.kenney.nl
- **Licence:** Creative Commons Zero (CC0 1.0 Universal), https://creativecommons.org/publicdomain/zero/1.0/
- **Licence text** (`License.txt`, copied here): "Support by crediting 'Kenney' or 'www.kenney.nl' (this is not a requirement)"
- **Source:** https://kenney.nl/assets/fantasy-town-kit. Zip: https://kenney.nl/media/pages/assets/fantasy-town-kit/efe948d309-1754222374/kenney_fantasy-town-kit_2.0.zip
- **Attribution required:** no. Credit given: "3D models by Kenney (www.kenney.nl), CC0".
- **Textures:** every GLB references the external `Textures/colormap.png` (it is not embedded). The file is copied from `Models/GLB format/Textures/` to the same relative place.

| File | Zip member | Intended use | Nodes / meshes |
|---|---|---|---|
| `stall-red.glb` | `Models/GLB format/stall-red.glb` | Market option M2 (market stall, red) | 1 / 1 |
| `stall-green.glb` | `Models/GLB format/stall-green.glb` | Market option M2 (market stall, green) | 1 / 1 |
| `stall.glb` | `Models/GLB format/stall.glb` | Market option M2 (market stall, plain) | 1 / 1 |
| `cart.glb` | `Models/GLB format/cart.glb` | Market option M2 (cart) | 3 / 3 |
| `fountain-round.glb` | `Models/GLB format/fountain-round.glb` | Market option M2 centrepiece (2x2 fountain) | 2 / 2 |
| `Textures/colormap.png` | `Models/GLB format/Textures/colormap.png` | shared colormap texture referenced by every Fantasy Town Kit GLB (Textures/colormap.png) |  |
| `License.txt` | `License.txt` | kit licence (CC0) |  |

## 5. Kenney - Tower Defense Kit 2.1

- **Author:** Kenney, www.kenney.nl
- **Licence:** Creative Commons Zero (CC0 1.0 Universal), https://creativecommons.org/publicdomain/zero/1.0/
- **Licence text** (`License.txt`, copied here): "Support by crediting 'Kenney' or 'www.kenney.nl' (this is not a requirement)"
- **Source:** https://kenney.nl/assets/tower-defense-kit. Zip: https://kenney.nl/media/pages/assets/tower-defense-kit/a402493eaa-1726471567/kenney_tower-defense-kit.zip
- **Attribution required:** no. Credit given: "3D models by Kenney (www.kenney.nl), CC0".
- **Textures:** every GLB references the external `Textures/colormap.png` (it is not embedded). The file is copied from `Models/GLB format/Textures/` to the same relative place.

| File | Zip member | Intended use | Nodes / meshes |
|---|---|---|---|
| `tile.glb` | `Models/GLB format/tile.glb` | board option B2 square 1x1 tile | 1 / 1 |
| `tile-rock.glb` | `Models/GLB format/tile-rock.glb` | board option B2 blocker tile (rock) | 1 / 1 |
| `tile-tree.glb` | `Models/GLB format/tile-tree.glb` | board option B2 blocker tile (tree) | 1 / 1 |
| `Textures/colormap.png` | `Models/GLB format/Textures/colormap.png` | shared colormap texture referenced by every Tower Defense Kit GLB (Textures/colormap.png) |  |
| `License.txt` | `License.txt` | kit licence (CC0) |  |

## 6. Kenney - Nature Kit 2.1

- **Author:** Kenney, www.kenney.nl
- **Licence:** Creative Commons Zero (CC0 1.0 Universal), https://creativecommons.org/publicdomain/zero/1.0/
- **Licence text** (`License.txt`, copied here): "Support us by crediting Kenney or www.kenney.nl (this is not mandatory)"
- **Source:** https://kenney.nl/assets/nature-kit. Zip: https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip
- **Attribution required:** no. Credit given: "3D models by Kenney (www.kenney.nl), CC0".
- **Textures:** none. These GLBs use plain material colours and reference no image files.

| File | Zip member | Intended use | Nodes / meshes |
|---|---|---|---|
| `rock_largeA.glb` | `Models/GLTF format/rock_largeA.glb` | blocker (large rock) | 2 / 1 |
| `rock_tallA.glb` | `Models/GLTF format/rock_tallA.glb` | blocker (tall rock) | 2 / 1 |
| `tree_pineRoundA.glb` | `Models/GLTF format/tree_pineRoundA.glb` | blocker (pine tree) | 2 / 1 |
| `tree_oak.glb` | `Models/GLTF format/tree_oak.glb` | blocker (oak tree) | 2 / 1 |
| `License.txt` | `License.txt` | kit licence (CC0) |  |

## Not included

- `manifest.json` and this file are project metadata, not third-party assets.
- `docs/analysis/research-art.md` also names KayKit `flag_<colour>.gltf`, `trees_A_*`, `rock_single_*` and `hills_*`. They were not copied, because the asset brief limited the KayKit extraction to the castle, market, tower and wall files. They are in the same repo at the same commit if they are wanted later.
