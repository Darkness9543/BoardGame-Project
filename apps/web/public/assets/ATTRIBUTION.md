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
| Sound effects: Kenney audio packs (4), rubberduck and artisticdude (OpenGameArt), BigSoundBank (6 authors), Freesound (21 authors) | CC0 1.0 | Optional (given) | `assets/audio/` |

## Credits text for the game

The game-icons.net FAQ asks video games to make the credits reachable from a menu. This block covers every file in this folder:

```text
Icons made by Lorc, Delapouite, Skoll, Caro Asercion, Cathelineau, DarkZaitzev, Sbed and Willdabeast, from https://game-icons.net,
licensed under CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/).
The icons were modified: background removed and recoloured.
3D models by Kay Lousberg / KayKit (www.kaylousberg.com) and Kenney (www.kenney.nl),
CC0 1.0 (credit optional, given with thanks).
Sound effects by Kenney (www.kenney.nl); rubberduck and artisticdude (opengameart.org);
BigSoundBank.com (DavidGreck, DenisChardonnet, GlaneurDeSons, Joseph SARDIN, Pablo BERGEL, Pierre SIBANARCO);
and Freesound.org users Ambient-X, aoristos, clif_creates, daytripper, DeqstersLab, DeVern, dhallcomposer, EminYILDIRIM, JohnBuhr, magnuswaker, mh2o, michorvath, nicoproson, PaceHeart, qubodup, Raventhornn, saturdaysoundguy, Sclolex, seanhealey, spycrah, zachrau;
all CC0 1.0 (credit optional, given with thanks). The sounds were edited, layered and remixed.
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

## 7. Sound effects (`assets/audio/`)

- **Licence:** every source sound is Creative Commons Zero (CC0 1.0 Universal), https://creativecommons.org/publicdomain/zero/1.0/. All checked on 2026-10-24.
- **Attribution required:** no. Credit given anyway (see the credits text above).
- **Formats:** each cue ships as Ogg Vorbis (`.ogg`, preferred) and MP3 (`.mp3`, Safari fallback), 44.1 kHz, mono except `lose`, `draw` and the two ambience loops (stereo; the `win` source is mono). Files are edited (trimmed, layered, filtered, some pitch-shifted, one reversed), mixed and peak-normalised to about -3 dBFS; the table says what was done to each.
- **Freesound files** are the site's HQ OGG previews (the original download needs a login); the licence applies to the sound, so the preview is CC0 too. The table names each sound page.
- **`cues.json`** (same folder) maps every cue id to its files, gain, variations, sources and engine events. It is project metadata, like this file.

| Source | Licence evidence | Page | Files using it |
|---|---|---|---|
| BigSoundBank | Each sound page says "CC0 (public domain): Free and royalty-free"; the site licence page: "Creative Commons CC0 1.0 Universal ... Use, including for commercial purposes. Without any restrictions. Without asking permission." (https://bigsoundbank.com/licenses.html) | https://bigsoundbank.com | 55 layer uses |
| Freesound | Each sound page links "Creative Commons 0" (http://creativecommons.org/publicdomain/zero/1.0/); checked page by page | https://freesound.org | 32 layer uses |
| Kenney - Casino Audio 1.1 | "License: (Creative Commons Zero, CC0) ... This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)" (Impact Sounds and Interface Sounds `License.txt`; UI Audio, RPG Audio, Casino Audio and Music Jingles say "Credit (Kenney or www.kenney.nl) would be nice but is not mandatory") | https://kenney.nl/assets/casino-audio | 3 layer uses |
| Kenney - Impact Sounds 1.0 | "License: (Creative Commons Zero, CC0) ... This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)" (Impact Sounds and Interface Sounds `License.txt`; UI Audio, RPG Audio, Casino Audio and Music Jingles say "Credit (Kenney or www.kenney.nl) would be nice but is not mandatory") | https://kenney.nl/assets/impact-sounds | 14 layer uses |
| Kenney - RPG Audio 1.0 | "License: (Creative Commons Zero, CC0) ... This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)" (Impact Sounds and Interface Sounds `License.txt`; UI Audio, RPG Audio, Casino Audio and Music Jingles say "Credit (Kenney or www.kenney.nl) would be nice but is not mandatory") | https://kenney.nl/assets/rpg-audio | 6 layer uses |
| Kenney - UI Audio 1.0 | "License: (Creative Commons Zero, CC0) ... This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)" (Impact Sounds and Interface Sounds `License.txt`; UI Audio, RPG Audio, Casino Audio and Music Jingles say "Credit (Kenney or www.kenney.nl) would be nice but is not mandatory") | https://kenney.nl/assets/ui-audio | 1 layer use |
| artisticdude - RPG Sound Pack | OpenGameArt pages list "License(s): CC0" for each pack (checked on the pack pages) | https://opengameart.org/content/rpg-sound-pack | 1 layer use |
| artisticdude - Swishes Sound Pack | OpenGameArt pages list "License(s): CC0" for each pack (checked on the pack pages) | https://opengameart.org/content/swishes-sound-pack | 1 layer use |
| rubberduck - 100 CC0 SFX | OpenGameArt pages list "License(s): CC0" for each pack (checked on the pack pages) | https://opengameart.org/content/100-cc0-sfx | 1 layer use |
| rubberduck - 100 CC0 metal and wood SFX | OpenGameArt pages list "License(s): CC0" for each pack (checked on the pack pages) | https://opengameart.org/content/100-cc0-metal-and-wood-sfx | 4 layer uses |
| rubberduck - 40 CC0 water / splash / slime SFX | OpenGameArt pages list "License(s): CC0" for each pack (checked on the pack pages) | https://opengameart.org/content/40-cc0-water-splash-slime-sfx | 1 layer use |
| rubberduck - 75 CC0 breaking / falling / hit sfx | OpenGameArt pages list "License(s): CC0" for each pack (checked on the pack pages) | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | 4 layer uses |
| rubberduck - 80 CC0 RPG SFX | OpenGameArt pages list "License(s): CC0" for each pack (checked on the pack pages) | https://opengameart.org/content/80-cc0-rpg-sfx | 1 layer use |

| Files (`.ogg` + `.mp3`) | Layers: source file, author, edit |
|---|---|
| `ui.hover` | Freesound [Moving piece on a boardgame](https://freesound.org/people/zachrau/sounds/556387/), zachrau: from 0.350 s for 0.09 s, low-pass 3500 Hz |
| `ui.click` | Freesound [chess_move_on_alabaster.wav](https://freesound.org/people/mh2o/sounds/351518/), mh2o: whole file |
| `ui.confirm` | `Audio/chip-lay-3.ogg` ([Kenney - Casino Audio 1.1](https://kenney.nl/assets/casino-audio)), Kenney (www.kenney.nl): whole file |
| `ui.cancel` | `Audio/card-slide-1.ogg` ([Kenney - Casino Audio 1.1](https://kenney.nl/assets/casino-audio)), Kenney (www.kenney.nl): from 0.080 s for 0.26 s |
| `ui.error` | `lock_02.ogg` ([rubberduck - 80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx)), rubberduck (OpenGameArt): from 0.020 s for 0.30 s, pitch -2 st<br>`Audio/impactWood_medium_002.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): -6 dB |
| `ui.toggle` | `Audio/switch17.ogg` ([Kenney - UI Audio 1.0](https://kenney.nl/assets/ui-audio)), Kenney (www.kenney.nl): from 0.080 s |
| `ui.open` | BigSoundBank [Road map #2 (#2797)](https://bigsoundbank.com/road-map-2-s2797.html), Joseph SARDIN: from 0.260 s for 0.55 s |
| `ui.close` | BigSoundBank [Closed book #2 (#1411)](https://bigsoundbank.com/closed-book-2-s1411.html), Joseph SARDIN: from 0.200 s for 0.26 s |
| `lobby.joined` | BigSoundBank [Small Bell #3 (#0294)](https://bigsoundbank.com/small-bell-3-s0294.html), GlaneurDeSons: from 0.030 s for 1.40 s |
| `lobby.ready` | BigSoundBank [Coin in cup #2 (#0340)](https://bigsoundbank.com/coin-in-cup-2-s0340.html), DavidGreck: from 0.060 s for 0.40 s |
| `turn.start.own` | BigSoundBank [Bronze bell #1 (#2703)](https://bigsoundbank.com/bronze-bell-1-s2703.html), Pierre SIBANARCO: from 0.020 s for 1.50 s |
| `turn.start.opponent` | BigSoundBank [Bass Tom, #1 (#2338)](https://bigsoundbank.com/bass-tom-1-s2338.html), Joseph SARDIN: from 0.020 s for 0.65 s, pitch -2 st |
| `turn.end` | `wood_hit_07.ogg` ([rubberduck - 100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx)), rubberduck (OpenGameArt): from 0.000 s for 0.20 s<br>`wood_hit_07.ogg` ([rubberduck - 100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx)), rubberduck (OpenGameArt): from 0.000 s for 0.20 s, pitch -1 st, -3 dB, at +120 ms |
| `timer.warning` | BigSoundBank [Tic Tac Mechanical Alarm Clock #3 (#2656)](https://bigsoundbank.com/tic-tac-mechanical-alarm-clock-3-s2656.html), Joseph SARDIN: from 0.425 s for 0.44 s |
| `boost.active` | BigSoundBank [Horn #1 (#2520)](https://bigsoundbank.com/horn-1-s2520.html), Joseph SARDIN: from 0.000 s for 1.75 s |
| `unit.select-1` | BigSoundBank [Coin spinning on a table #4 (#2700)](https://bigsoundbank.com/coin-spinning-on-a-table-4-s2700.html), Pierre SIBANARCO: from 2.880 s for 0.22 s, pitch +1 st |
| `unit.select-2` | BigSoundBank [Coin spinning on a table #5 (#2701)](https://bigsoundbank.com/coin-spinning-on-a-table-5-s2701.html), Pierre SIBANARCO: from 3.825 s for 0.22 s, pitch +1 st |
| `unit.deselect-1` | BigSoundBank [Coin spinning on a table #2 (#2698)](https://bigsoundbank.com/coin-spinning-on-a-table-2-s2698.html), Pierre SIBANARCO: from 2.660 s for 0.20 s, pitch -2 st |
| `unit.deselect-2` | BigSoundBank [Coin spinning on a table #2 (#2698)](https://bigsoundbank.com/coin-spinning-on-a-table-2-s2698.html), Pierre SIBANARCO: from 2.135 s for 0.20 s, pitch -2 st |
| `unit.move.step-1` | Freesound [coin sliding on table.wav](https://freesound.org/people/seanhealey/sounds/517749/), seanhealey: from 1.950 s for 0.34 s, high-pass 120 Hz |
| `unit.move.step-2` | Freesound [coin sliding on table.wav](https://freesound.org/people/seanhealey/sounds/517749/), seanhealey: from 3.920 s for 0.34 s, high-pass 120 Hz |
| `unit.move.step-3` | Freesound [coin sliding on table.wav](https://freesound.org/people/seanhealey/sounds/517749/), seanhealey: from 7.450 s for 0.34 s, high-pass 120 Hz |
| `unit.move.step-4` | Freesound [coin sliding on table.wav](https://freesound.org/people/seanhealey/sounds/517749/), seanhealey: from 9.300 s for 0.34 s, high-pass 120 Hz |
| `unit.move.charge` | Freesound [coin sliding on table.wav](https://freesound.org/people/seanhealey/sounds/517749/), seanhealey: from 1.950 s for 0.48 s, high-pass 120 Hz<br>BigSoundBank [Whoosh #8 (#1801)](https://bigsoundbank.com/whoosh-8-s1801.html), Joseph SARDIN: from 0.200 s for 0.42 s, high-pass 150 Hz, -3 dB |
| `march.step-1` | Freesound [several coins on wood top](https://freesound.org/people/nicoproson/sounds/776505/), nicoproson: from 0.860 s for 0.30 s |
| `march.step-2` | Freesound [several coins on wood top](https://freesound.org/people/nicoproson/sounds/776505/), nicoproson: from 2.420 s for 0.32 s |
| `march.step-3` | Freesound [several coins on wood top](https://freesound.org/people/nicoproson/sounds/776505/), nicoproson: from 8.560 s for 0.32 s |
| `unit.defend` | BigSoundBank [Dumbbell, placed #2 (#3296)](https://bigsoundbank.com/dumbbell-placed-2-s3296.html), Joseph SARDIN: from 0.090 s for 0.34 s<br>`Audio/impactPlate_light_003.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): -8 dB, at +5 ms |
| `attack.swing.light-1` | Freesound [Combat Whooshes](https://freesound.org/people/EminYILDIRIM/sounds/535359/), EminYILDIRIM: from 0.660 s for 0.26 s, high-pass 110 Hz |
| `attack.swing.light-2` | Freesound [Combat Whooshes](https://freesound.org/people/EminYILDIRIM/sounds/535359/), EminYILDIRIM: from 1.790 s for 0.26 s, high-pass 110 Hz |
| `attack.swing.light-3` | Freesound [Combat Whooshes](https://freesound.org/people/EminYILDIRIM/sounds/535359/), EminYILDIRIM: from 3.660 s for 0.24 s, high-pass 110 Hz |
| `attack.swing.heavy-1` | BigSoundBank [Whoosh #10 (#1798)](https://bigsoundbank.com/whoosh-10-s1798.html), Joseph SARDIN: from 0.120 s for 0.34 s, pitch -2 st, high-pass 80 Hz |
| `attack.swing.heavy-2` | BigSoundBank [Whoosh #5 (#1797)](https://bigsoundbank.com/whoosh-5-s1797.html), Joseph SARDIN: from 0.150 s for 0.30 s, pitch -2 st, high-pass 80 Hz |
| `attack.swing.heavy-3` | BigSoundBank [Whoosh #8 (#1801)](https://bigsoundbank.com/whoosh-8-s1801.html), Joseph SARDIN: from 0.180 s for 0.45 s, pitch -2 st, high-pass 80 Hz |
| `attack.ranged.shot` | Freesound [Arrow Loose and Flyby](https://freesound.org/people/saturdaysoundguy/sounds/394180/), saturdaysoundguy: whole file |
| `hit.metal.light-1` | `bfh1_metal_hit_04.ogg` ([rubberduck - 75 CC0 breaking / falling / hit sfx](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx)), rubberduck (OpenGameArt): whole file |
| `hit.metal.light-2` | `bfh1_metal_hit_06.ogg` ([rubberduck - 75 CC0 breaking / falling / hit sfx](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx)), rubberduck (OpenGameArt): whole file |
| `hit.metal.light-3` | `metal_hit_03.ogg` ([rubberduck - 100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx)), rubberduck (OpenGameArt): whole file |
| `hit.metal.heavy-1` | BigSoundBank [Anvil #2 (#3590)](https://bigsoundbank.com/anvil-2-s3590.html), Pablo BERGEL: from 1.205 s for 0.55 s, pitch -2 st, high-pass 90 Hz<br>`Audio/impactPunch_heavy_001.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): from 0.000 s for 0.25 s, high-pass 70 Hz, -6 dB |
| `hit.metal.heavy-2` | BigSoundBank [Anvil #2 (#3590)](https://bigsoundbank.com/anvil-2-s3590.html), Pablo BERGEL: from 2.250 s for 0.55 s, pitch -2 st, high-pass 90 Hz<br>`Audio/impactPunch_heavy_003.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): from 0.000 s for 0.25 s, high-pass 70 Hz, -6 dB |
| `hit.metal.heavy-3` | BigSoundBank [Anvil #1 (#3589)](https://bigsoundbank.com/anvil-1-s3589.html), Pablo BERGEL: from 2.418 s for 0.55 s, pitch -2 st, high-pass 90 Hz<br>`Audio/impactPunch_heavy_000.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): from 0.000 s for 0.25 s, high-pass 70 Hz, -6 dB |
| `hit.blocked-1` | Freesound [Sword_Clash (7).wav](https://freesound.org/people/JohnBuhr/sounds/326868/), JohnBuhr: from 0.000 s for 0.30 s |
| `hit.blocked-2` | Freesound [Sword Hit](https://freesound.org/people/qubodup/sounds/442769/), qubodup: from 0.000 s for 0.34 s, pitch +1 st |
| `hit.defended-1` | `Audio/impactPlate_heavy_000.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): whole file<br>BigSoundBank [Dumbbell, placed #3 (#3297)](https://bigsoundbank.com/dumbbell-placed-3-s3297.html), Joseph SARDIN: from 0.110 s for 0.19 s, -6 dB |
| `hit.defended-2` | `Audio/impactPlate_heavy_004.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): whole file<br>BigSoundBank [Dumbbell, placed #2 (#3296)](https://bigsoundbank.com/dumbbell-placed-2-s3296.html), Joseph SARDIN: from 0.090 s for 0.32 s, -6 dB |
| `unit.death-1` | BigSoundBank [Coin spinning on a table #1 (#2697)](https://bigsoundbank.com/coin-spinning-on-a-table-1-s2697.html), Pierre SIBANARCO: from 10.740 s for 0.78 s, high-pass 150 Hz |
| `unit.death-2` | BigSoundBank [Coin spinning on a table #4 (#2700)](https://bigsoundbank.com/coin-spinning-on-a-table-4-s2700.html), Pierre SIBANARCO: from 12.990 s for 0.78 s, high-pass 150 Hz |
| `unit.death-3` | BigSoundBank [Coin spinning on a table #6 (#2702)](https://bigsoundbank.com/coin-spinning-on-a-table-6-s2702.html), Pierre SIBANARCO: from 13.500 s for 0.78 s, high-pass 150 Hz |
| `unit.death.big-1` | BigSoundBank [Falling sheet steel bar #2 (#1772)](https://bigsoundbank.com/falling-sheet-steel-bar-2-s1772.html), Joseph SARDIN: from 0.080 s for 0.78 s<br>BigSoundBank [Coin spinning on a table #5 (#2701)](https://bigsoundbank.com/coin-spinning-on-a-table-5-s2701.html), Pierre SIBANARCO: from 16.900 s for 0.82 s, pitch -3 st, high-pass 120 Hz, -3 dB, at +220 ms |
| `unit.death.big-2` | BigSoundBank [Falling sheet steel bar #4 (#1774)](https://bigsoundbank.com/falling-sheet-steel-bar-4-s1774.html), Joseph SARDIN: from 0.110 s for 0.80 s<br>BigSoundBank [Coin spinning on a table #3 (#2699)](https://bigsoundbank.com/coin-spinning-on-a-table-3-s2699.html), Pierre SIBANARCO: from 18.600 s for 0.82 s, pitch -3 st, high-pass 120 Hz, -3 dB, at +220 ms |
| `heal` | BigSoundBank [Finger Cymbals #1 (#2274)](https://bigsoundbank.com/finger-cymbals-1-s2274.html), Joseph SARDIN: from 0.040 s for 1.00 s, low-pass 9000 Hz |
| `buff` | BigSoundBank [Knife blade #1 (#2574)](https://bigsoundbank.com/knife-blade-1-s2574.html), Joseph SARDIN: from 0.030 s for 0.36 s |
| `debuff` | BigSoundBank [Small chain #1 (#0355)](https://bigsoundbank.com/small-chain-1-s0355.html), DenisChardonnet: from 0.080 s for 0.62 s, pitch -2 st |
| `reveal` | BigSoundBank [Flag #2 (#1788)](https://bigsoundbank.com/flag-2-s1788.html), Joseph SARDIN: from 0.100 s for 0.32 s<br>`Audio/impactMetal_light_001.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): -8 dB, at +50 ms |
| `stealth.on` | `Audio/cloth2.ogg` ([Kenney - RPG Audio 1.0](https://kenney.nl/assets/rpg-audio)), Kenney (www.kenney.nl): from 0.040 s for 0.32 s |
| `stealth.off` | `Audio/cloth1.ogg` ([Kenney - RPG Audio 1.0](https://kenney.nl/assets/rpg-audio)), Kenney (www.kenney.nl): from 0.050 s for 0.52 s |
| `assault-1` | `Audio/knifeSlice.ogg` ([Kenney - RPG Audio 1.0](https://kenney.nl/assets/rpg-audio)), Kenney (www.kenney.nl): from 0.060 s for 0.36 s |
| `assault-2` | `Audio/knifeSlice2.ogg` ([Kenney - RPG Audio 1.0](https://kenney.nl/assets/rpg-audio)), Kenney (www.kenney.nl): from 0.000 s for 0.42 s |
| `mine.place` | `metal_spring_02.ogg` ([rubberduck - 100 CC0 metal and wood SFX](https://opengameart.org/content/100-cc0-metal-and-wood-sfx)), rubberduck (OpenGameArt): whole file<br>`Audio/metalLatch.ogg` ([Kenney - RPG Audio 1.0](https://kenney.nl/assets/rpg-audio)), Kenney (www.kenney.nl): -2 dB, at +200 ms |
| `mine.explode` | Freesound [Explosion 1](https://freesound.org/people/magnuswaker/sounds/523089/), magnuswaker: whole file<br>`bfh1_rock_falling_03.ogg` ([rubberduck - 75 CC0 breaking / falling / hit sfx](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx)), rubberduck (OpenGameArt): -8 dB, at +300 ms |
| `prototype.create` | BigSoundBank [Winder #7 (#2668)](https://bigsoundbank.com/winder-7-s2668.html), Joseph SARDIN: from 0.150 s for 1.05 s<br>`Audio/impactPlate_light_002.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): -2 dB, at +1080 ms |
| `forcefield.on` | BigSoundBank [Tibetan bowl struck #3 (#2554)](https://bigsoundbank.com/tibetan-bowl-struck-3-s2554.html), Joseph SARDIN: from 0.000 s for 2.00 s |
| `forcefield.off` | BigSoundBank [Triangle muffled #1 (#1690)](https://bigsoundbank.com/triangle-muffled-1-s1690.html), Joseph SARDIN: from 0.030 s for 0.60 s, pitch -5 st |
| `pajazon.cast` | BigSoundBank [Whoosh #2 (#0573)](https://bigsoundbank.com/whoosh-2-s0573.html), Joseph SARDIN: from 8.120 s for 0.40 s, -4 dB<br>BigSoundBank [Gong, strong #1 (#1483)](https://bigsoundbank.com/gong-strong-1-s1483.html), Joseph SARDIN: from 0.120 s for 2.20 s, low-pass 7000 Hz, at +260 ms |
| `pajazon.heal` | BigSoundBank [Chimes "butterfly" #1 (#2087)](https://bigsoundbank.com/chimes-butterfly-1-s2087.html), Joseph SARDIN: from 1.380 s for 0.56 s |
| `pajazon.damage` | BigSoundBank [Quenching, cooling #4 (#1697)](https://bigsoundbank.com/quenching-cooling-4-s1697.html), Joseph SARDIN: from 0.000 s for 0.27 s |
| `slam.impact` | Freesound [big stone door suddenly slamming shut](https://freesound.org/people/PaceHeart/sounds/465807/), PaceHeart: whole file<br>`bfh1_rock_breaking_02.ogg` ([rubberduck - 75 CC0 breaking / falling / hit sfx](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx)), rubberduck (OpenGameArt): -6 dB, at +40 ms<br>`Audio/impactMining_000.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): -6 dB |
| `feast` | Freesound [Hard Candy / Bone Crunch](https://freesound.org/people/clif_creates/sounds/392883/), clif_creates: from 0.000 s for 0.75 s |
| `smite` | Freesound [TollBell.wav](https://freesound.org/people/daytripper/sounds/73678/), daytripper: from 0.000 s for 2.20 s<br>`Audio/impactPunch_heavy_001.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): -3 dB<br>BigSoundBank [Explosion #2 (#1808)](https://bigsoundbank.com/explosion-2-s1808.html), Joseph SARDIN: -10 dB |
| `blessing` | BigSoundBank [Chimes "Dream" #1 (#2079)](https://bigsoundbank.com/chimes-dream-1-s2079.html), Joseph SARDIN: from 0.080 s for 1.90 s |
| `savagery` | Freesound [Swing grunt.mp3](https://freesound.org/people/DeqstersLab/sounds/661242/), DeqstersLab: from 0.050 s for 0.67 s<br>`swishes/swish-7.wav` ([artisticdude - Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack)), artisticdude (OpenGameArt): -5 dB, at +180 ms |
| `shared.wounds` | Freesound [Heart Beating](https://freesound.org/people/michorvath/sounds/273150/), michorvath: from 0.300 s for 0.65 s, high-pass 35 Hz, saturation 10 dB<br>BigSoundBank [Tibetan Bowl Struck #1 (#1110)](https://bigsoundbank.com/tibetan-bowl-struck-s1110.html), Joseph SARDIN: from 0.080 s for 0.90 s, -12 dB, at +50 ms |
| `julio` | Freesound [Dark Magic Loop](https://freesound.org/people/qubodup/sounds/442825/), qubodup: from 0.000 s for 1.20 s<br>BigSoundBank [Bones cracking #2 (#1408)](https://bigsoundbank.com/bones-cracking-2-s1408.html), Joseph SARDIN: from 0.220 s for 0.18 s, -4 dB, at +120 ms |
| `command.aura` | Freesound [warriordrums.wav](https://freesound.org/people/Sclolex/sounds/209546/), Sclolex: from 0.290 s for 0.62 s |
| `mend` | `Audio/cloth3.ogg` ([Kenney - RPG Audio 1.0](https://kenney.nl/assets/rpg-audio)), Kenney (www.kenney.nl): from 0.000 s for 0.30 s, -4 dB<br>`Audio/impactMetal_light_002.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): -6 dB, at +220 ms |
| `hexward` | `RPG Sound Pack/inventory/beads.wav` ([artisticdude - RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack)), artisticdude (OpenGameArt): from 0.000 s for 0.32 s<br>BigSoundBank [Tibetan Bowl Struck #1 (#1110)](https://bigsoundbank.com/tibetan-bowl-struck-s1110.html), Joseph SARDIN: from 0.080 s for 1.00 s, pitch -3 st, -10 dB |
| `cauldron.return` | `bubble_02.ogg` ([rubberduck - 40 CC0 water / splash / slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx)), rubberduck (OpenGameArt): from 0.020 s for 0.28 s<br>`plop_02.ogg` ([rubberduck - 100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx)), rubberduck (OpenGameArt): at +220 ms<br>BigSoundBank [Coin spinning on a table #5 (#2701)](https://bigsoundbank.com/coin-spinning-on-a-table-5-s2701.html), Pierre SIBANARCO: from 3.825 s for 0.20 s, -4 dB, at +420 ms |
| `revive` | BigSoundBank [Coin spinning on a table #5 (#2701)](https://bigsoundbank.com/coin-spinning-on-a-table-5-s2701.html), Pierre SIBANARCO: from 16.700 s for 1.05 s, reversed, high-pass 150 Hz<br>BigSoundBank [Bronze bell #5 (#2707)](https://bigsoundbank.com/bronze-bell-5-s2707.html), Pierre SIBANARCO: from 0.030 s for 0.40 s, -6 dB, at +550 ms |
| `weakness` | BigSoundBank [Medium Chain #1 (#0360)](https://bigsoundbank.com/medium-chain-1-s0360.html), DenisChardonnet: from 0.140 s for 0.90 s, pitch -2 st, low-pass 7000 Hz |
| `capture.keep` | BigSoundBank [Metal barrier: Closure #1 (#2358)](https://bigsoundbank.com/grinding-metal-barrier-closure-1-s2358.html), Joseph SARDIN: from 1.600 s for 1.25 s |
| `capture.market` | BigSoundBank [Coins #2 (#0194)](https://bigsoundbank.com/coins-2-s0194.html), Joseph SARDIN: from 2.920 s for 0.95 s |
| `building.contested` | Freesound [Sword clash 1.wav](https://freesound.org/people/spycrah/sounds/471095/), spycrah: from 0.970 s for 0.78 s |
| `siege.tick` | BigSoundBank [Grandfather clock, hour #1 (#1569)](https://bigsoundbank.com/grandfather-clock-hour-1-s1569.html), Joseph SARDIN: from 1.830 s for 1.20 s |
| `win` | Freesound [Real Trumpet Fanfare 2](https://freesound.org/people/qubodup/sounds/855458/), qubodup: whole file |
| `lose` | Freesound [funeral bell-cloche funèbre.wav](https://freesound.org/people/aoristos/sounds/329324/), aoristos: from 0.400 s for 6.00 s |
| `draw` | Freesound [Distant War Horn.wav](https://freesound.org/people/DeVern/sounds/512490/), DeVern: from 0.100 s for 4.80 s |
| `takeback.request` | BigSoundBank [Great Page that Turns #1 (#0362)](https://bigsoundbank.com/great-page-that-turns-1-s0362.html), DenisChardonnet: from 0.030 s for 0.95 s |
| `takeback.accept` | BigSoundBank [Great page that turns #1 (#0363)](https://bigsoundbank.com/great-page-that-turns-1-s0363.html), DenisChardonnet: from 0.100 s for 0.65 s<br>`Audio/chip-lay-3.ogg` ([Kenney - Casino Audio 1.1](https://kenney.nl/assets/casino-audio)), Kenney (www.kenney.nl): -3 dB, at +450 ms |
| `decision.prompt` | BigSoundBank [Small Bell #1 (#0292)](https://bigsoundbank.com/small-bell-1-s0292.html), GlaneurDeSons: from 0.040 s for 1.00 s |
| `coin.flip` | Freesound [coin flip.wav](https://freesound.org/people/Raventhornn/sounds/181189/), Raventhornn: from 0.050 s for 1.10 s |
| `battle.start` | Freesound [warriordrums.wav](https://freesound.org/people/Sclolex/sounds/209546/), Sclolex: from 0.000 s for 2.30 s |
| `attack.miss` | `Audio/footstep_snow_000.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): from 0.000 s for 0.22 s<br>`Audio/impactSoft_medium_002.ogg` ([Kenney - Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds)), Kenney (www.kenney.nl): -6 dB |
| `ambient.wind` | Freesound [Looping Gentle Wind Ambience on an Open Desert Plain.wav](https://freesound.org/people/dhallcomposer/sounds/697217/), dhallcomposer: from 2.000 s for 33.00 s, high-pass 60 Hz |
| `ambient.camp` | Freesound [Campfire deer camp - adding kindling - med wind - part 4.wav](https://freesound.org/people/Ambient-X/sounds/660298/), Ambient-X: from 26.000 s for 33.00 s, high-pass 60 Hz, low-pass 9000 Hz |

## Not included

- `manifest.json` and this file are project metadata, not third-party assets. So is `assets/audio/cues.json`.
- The sound contenders that were rendered for comparison but not chosen live only in `docs/audio-direction/audio/` (for the mock page) and are not shipped. Their sources are listed in `docs/analysis/research-audio.md`.
- `docs/analysis/research-art.md` also names KayKit `flag_<colour>.gltf`, `trees_A_*`, `rock_single_*` and `hills_*`. They were not copied, because the asset brief limited the KayKit extraction to the castle, market, tower and wall files. They are in the same repo at the same commit if they are wanted later.
