# Board renderer (`apps/web/src/render`)

The 3D board: `@react-three/fiber` + drei over three.js, orthographic, render-on-demand. It implements
`BoardRendererProps` from `../contracts.ts`, draws only what the `PlayerView` holds, and reports pointer input. It
never decides what a click means and never computes rules: reach, paths, targets and forecasts come from the UI
(which asks the engine's preview helpers), and everything else is read from the view.

```tsx
import { BoardRenderer, type BoardRendererHandle } from './render'

const board = useRef<BoardRendererHandle>(null)

<BoardRenderer
  ref={board}
  view={session.view}
  mySeat={session.seat}
  selection={{ unitId: selected, square: null }}
  overlays={{ reachable, path, attackRange, abilityTargets, deploymentZones }}
  cameraMode={settings.defaultView}
  showExtendedZone={placingVanguard}
  onSquareHover={setHover} onSquareClick={onSquareClick}
  onUnitHover={setHoverUnit} onUnitClick={onUnitClick}
  // optional extras (contract gaps, see below)
  events={session.events} eventsKey={batchSeq}
  ghosts={ghosts} forecasts={forecasts}
  clarity={settings.clarityMode} reducedMotion={reduced} animationSpeed={settings.animationSpeed}
  followEvents={settings.followEnemyActions && !myTurn} showCoordinates={settings.coordinates}
  highlightReady={settings.highlightReady}
/>
// keyboard: board.current?.focus(unit.anchor), fit(), zoomBy(1.25), panBy(0, 2), rotate(1)
```

`RenderDemo.tsx` is a self-contained page for `#/dev/render`: a real engine battle on Crossroads (a `buildBattle`
record in a sandbox session, `createSession({ mode: 'local' })`, so the page reads only each seat's `PlayerView`)
wired the way the game UI would wire it (select, preview, act, animations, hot-seat, ghosts, deployment zones,
area preview, danger zone, palettes, every camera command). `App.tsx` loads it lazily, so it stays out of the
game bundle.

## Props

### Contract props (`BoardRendererProps`)

| Prop | Behaviour |
|---|---|
| `view` | The truth. Terrain comes from `scenarioDef(view.settings.scenarioId)`; units, mines, areas, buildings and `visibility` from the view. Fog is drawn in `battle` only (the map is public; lobby and deployment show the whole board; `ended` lifts it). Undeployed units (`anchor === null`) are not drawn. |
| `mySeat` | Owner cue (brass vs iron), acted/ready states, own-only drawings (stealthed units, own mines). `view.side` decides the orientation: the board group turns 180 degrees for North (A1-15), so each seat's back row is at the bottom. A change of seat (hot seat) drops every animation in flight, so nothing of the previous seat's knowledge animates out. |
| `selection` | `unitId`: lifted token with a glow ring, its move arrow starts there. `square`: a thick selection frame (deployment target, ability pick). |
| `overlays.reachable` | Blue tiles with a dot; a reachable square holding a known mine becomes an amber "!" hazard tile (A8-17). |
| `overlays.path` | The move arrow from the selected unit (anchors, start excluded, as `bestPath` returns): solid on seen ground, dashed and lighter into fog, amber over a known mine, arrowhead and a `steps/movement` chip. |
| `overlays.attackRange` | Red-orange hatched tiles with an inner border; each visible enemy covering one of them gets a dashed target ring. |
| `overlays.abilityTargets` | Violet tiles with a diamond. |
| `overlays.deploymentZones` | `normal` washed in my bezel tone; `extended` hatched with a dashed outline when `showExtendedZone`. During deployment the opponent's normal zone is washed dark (A5-05). |
| `cameraMode` | `'top'` (default) or `'iso'`, eased over 350 ms (instant under reduced motion). Presentation only (A1-16): both views pick the same squares. |
| `showExtendedZone` | See `deploymentZones`. |
| `onSquareHover` | The square under the pointer (ground-plane raycast; over a token, the token's square), `null` when the pointer leaves the board or the canvas. Called once per change. |
| `onSquareClick` | A click on a square with no unit. `'secondary'` = right click, or a touch long-press (520 ms). |
| `onUnitHover` | The unit under the pointer: the token hit, or the unit covering the hovered square. Called once per change. |
| `onUnitClick` | A click on a token, or on any square a unit covers (priority: unit, then square, so a click fires exactly one callback). Last-seen ghosts and departing tokens are not clickable; clicks on them reach the square. |

A press that moves more than 6 px is a drag (pan) and never a click.

### Extras (`BoardRendererExtras`, all optional)

`contracts.ts` has no slot for these, so the renderer accepts them as optional props (`BoardViewProps = BoardRendererProps & BoardRendererExtras`). A caller that only knows the contract still gets a complete board.

| Prop | Meaning |
|---|---|
| `events`, `eventsKey` | The batch that produced `view` (`Session.events`) and a key that changes per batch (defaults to the array identity). Each batch plays once: steps square by square, attack lunges, hit flashes, deaths, mine bursts, floating numbers and words (Blocked!, Ambushed!, Mine!, Revealed!, Hidden, Defending, Captured!, Contested, Revived, Nothing there). Without events, moved units still slide, new ones fade in and departed ones fade out. |
| `ghosts` | Last-seen enemies (`GhostMarker`: the `UnitView` as last seen, `seenRound`, `vanished`), drawn greyscale at 38 % with an "R6" badge (a `?` badge when it vanished in plain sight). The UI keeps them as client memory (A4-16, C24) with `store/ghosts.ts` (`updateGhosts`, which also drops a ghost a take-back created, TB-8); a unit seen walking into the fog is remembered on the last square it stepped onto. A ghost is hidden while a live unit stands on its squares. |
| `forecasts` | `{ unitId, amount, uncertain? }` per target (from `previewAttack`, or an ability preview): the toughness arc shows the part that would go (red when lethal, plus a skull badge) and the plate reads `-8 -> 4` or `-12 LETHAL` (`~` when uncertain). |
| `movePreviews` | Extra move arrows `{ unitId, path }` (Group march, R27). |
| `areaPreview` | `{ primary, secondary }` squares under the cursor (Pajazon's 3x3, Forceful slam, Smite's splash). |
| `threat` | Danger-zone squares (red hatch). |
| `cursor` | Keyboard cursor square, framed in the selection colour; hover previews follow it. |
| `clarity` | Palette C (warm/cool zig-zag) with rank pips instead of the heraldic hatching: the colour-blind mode. |
| `reducedMotion` | Defaults to `prefers-reduced-motion`. No travel, lunges or camera tweens; fades, flashes and numbers stay. |
| `animationSpeed` | `'normal' \| 'fast' \| 'instant'` (the UI setting's values). Instant keeps only the numbers. |
| `followEvents` | Pans to the first visible action of each new batch when it is off screen (camera focus on the acting unit). |
| `showCoordinates` | Column letters and row numbers along the viewer's edges, absolute (default on). |
| `highlightReady` | A faint ring under own units that can still act during my turn (default on). |
| `isoStyle` | `'true'` (35.264 degrees, default) or `'dimetric'` (30 degrees). |
| `floaters` | `{ id, square, text, tone }` from a UI that runs its own playback instead of passing `events`; each shows once, stacked per square. |
| `strikes` | `{ id, from, to }` attacks of such a playback: the unit on `from` lunges at `to` and whatever stands there flashes; each id plays once. |
| `focus` | A square to bring into view when it changes (the acting unit, the unit the player jumped to); the camera moves only if it is off screen. |
| `hazards` | Extra amber hazard tiles (known mines on the previewed path, A8-17). |
| `picked` | Squares already picked in a multi-step action (Forcefield painting, march group), framed in the selection colour. |
| `highlight` | Squares a hovered log line or toast refers to, framed in gold. |
| `captureRing` | A capture ring to outline (for example while a building card is hovered). |
| `visionPreview` | The vision the moving unit would have at the previewed destination, dashed. |
| `chips` | `{ square, text, tone }` forecast or result chips (`'enemy' \| 'ally' \| 'heal' \| 'lethal' \| 'win' \| 'info'`). |
| `readyUnits` | The exact set of own units that can still act; the others are drawn as acted during my turn. Without it the renderer estimates from the view (actions left and AP left). |
| `ref` | `BoardRendererHandle`: `focus(square)`, `fit()`, `zoomBy(factor)`, `panBy(dx, dy)` (screen-relative board units), `rotate(steps)` (iso, 90-degree steps), `isOnScreen(square)`. For F (focus), Home (fit), +/- , WASD, Q/E and "show me" toasts. |

**Replaying the opponent's turn:** pass the view you had at the start of their turn, then the current view together with the turn's events under a new `eventsKey`. A UI that animates by feeding intermediate views instead (one per step) gets smooth glides: every slide starts from where the token is drawn and replaces one still under way.

### With the UI's renderer registry

`ui/board/registry.ts` lists the renderers as `ComponentType<BoardRendererProps>` (this 3D board, the default, and the light 2D SVG board; Options › Board picks one) and `BoardStage` hands everything else through `useBoardExtras()` (`ui/board/extras.ts`). `ExtrasBoard` is the 3D entry, loaded on first use by `ui/board/Board3D.tsx` (`React.lazy`), so three.js stays out of the menu bundle. It maps the context onto the props above:

| `BoardExtras` | Renderer prop |
|---|---|
| `ghosts` (`Ghost`) | `ghosts` (`GhostMarker`; LOV, movement and range filled from `unitDef`) |
| `floaters` (tones `damage`, `heal`, `word`, `warn`) | `floaters` (`damage`, `heal`, `status`, `warning`) |
| `flashes` | `strikes` |
| `focus`, `hazards`, `picked`, `highlight`, `chips`, `captureRing`, `visionPreview`, `threat`, `clarity` | same names |
| `area` | `areaPreview.primary` |
| `hover` | `cursor` |
| `ready` (always the exact set during my turn), `highlightReady` (the option) | `readyUnits`, `highlightReady` |
| `coordinates`, `reducedMotion`, `animationSpeed` | `showCoordinates`, `reducedMotion`, `animationSpeed` |

## What the board shows

- **Coins** (research-art 6): a T2 cylinder carrying the T1 face drawn on a canvas. Face = grade colour (palette D Heraldic by default, `unit.tier`, so Sabrina's tier-10 Artificer shows as tier 10), the unit symbol, the numeral cartouche at 12 o'clock and, on palette D, the Petra Sancta hatching on the bezel. Owner cue: light brass bezel, smooth outline and brass rim for you; dark iron bezel, milled teeth and a reeded rim for the opponent. Empire coins carry 24 pearls on the bezel, Lojrar ones 3 rune notches. Size ladder 0.76 to 0.94 tiles, thickness ladder 0.10 to 0.17 (visible in iso). The face turns with the camera, so symbols stay upright in both views and for both seats.
- **Special coins**: the commander (ivory face, its portrait, a crown instead of the numeral, a gold rim), Size-2 units (one 1.84 coin over the 2x2), the No-ACB dummy (a steel planchet), mines (hex nuts: mine own at 55 % with a dashed outline, revealed enemy mines with a red ring, an eye badge on my mine once the opponent knows it).
- **States**: selected (lift and glow ring), hovered (small lift, ring, stat plate), ready (faint ring), acted (desaturated face plus hourglass badge), defending (shield badge), stealthed (own only: 45 % and an eye-slash badge, plus a dotted adjacency ring on hover), toughness arc when damaged, hovered, selected or forecast, action pips for units with more than one action.
- **Board**: 593 instanced sand slabs (two tones, a little per-square variation) whose gaps show a darker underlay as the grid; fogged slabs are dimmed and desaturated per instance with a crisp ink line on the exact vision boundary (F3-lite); the war table underneath; the goal row dashed in gold (brighter while my commander is selected).
- **Blockers** (R36): low stone blocks; tall blockers as tall pillars, which also occlude in iso. Kenney rock models replace them when the manifest lists them. Blockers wholly in fog are darkened.
- **Buildings** (R32, 3x3): stone plinth, KayKit model in the controller's colour variant (castle squashed to 1.5 tiles), a banner when controlled, a camera-facing emblem badge, and the 16-square capture ring outline (dashed gold while neutral, solid in the controller's tone, brighter on hover). In iso they turn to x-ray while they hide any unit, the hovered square or the path's end (RULES 13.6).
- **Areas** (A4-13): Forcefield and Pajazon decals in the owner's tint with a glyph chip and the turns left.
- **Hover previews**: the hovered unit's vision outline (with R36 occlusion through `lovContains`), its stat plate (power, toughness, max), the hovered building's capture ring.

Layer order bottom to top (research-ux-conventions 6.3): areas, zones and danger zone, square fills, area previews, path, outlines (fog line, vision, goal row, capture rings), frames, tokens, badges, emblems, DOM text.

## Asset lookup table

Symbols are art direction, so their names live in `../theme/theme.ts`; files are under `public/assets` and listed in `public/assets/manifest.json`. `assets.ts` builds the URLs (relative to Vite's `BASE_URL`). Icons are game-icons.net, CC BY 3.0: the credits screen must name Lorc, Delapouite, Skoll and Sbed (`public/assets/ATTRIBUTION.md`). Models are CC0 (KayKit, Kenney).

| Thing | Key | File (`assets/...`) | Fallback |
|---|---|---|---|
| Footman / Mercenary | `footman` / `mercenary` | `icons/clean/spears.svg` / `crossed-swords.svg` | initials glyph ("F", "M") |
| Soldier / Ranger | `soldier` / `ranger` | `visored-helm.svg` / `bowman.svg` | glyph |
| Berserker / Rogue | `berserker` / `rogue` | `battle-axe.svg` / `hood.svg` | glyph |
| Priestess / Juliomancer | `priestess` / `juliomancer` | `holy-grail.svg` / `third-eye.svg` | glyph |
| Paladin / Artificer | `paladin` / `artificer` | `templar-shield.svg` / `gear-hammer.svg` | glyph |
| Royal Wizard / Beast of Knorund | `royalWizard` / `beast` | `pointy-hat.svg` / `minotaur.svg` | glyph ("RW", "BK") |
| Celestial Emissary / Scourge of the Gods | `emissary` / `scourge` | `angel-wings.svg` / `crowned-skull.svg` | glyph |
| Commander (portrait by commander) | `trill`, `kulega`, `sabrina`, `babaYaga`, `ratasius`, `queso`, `baseline` | `brain`, `magnifying-glass`, `film-spool`, `witch-flight`, `rat`, `cheese-wedge`, `chess-king` | glyph "C" |
| Prototype No-ACB | `noAcb` | `vintage-robot.svg` | glyph "PN" |
| Trip Mine | `MINE_SYMBOL` | `teller-mine.svg` | "!" |
| Badges: defending, stealthed, acted, revealed | `BADGE_SYMBOLS` | `checked-shield`, `invisible`, `hourglass`, `semi-closed-eye` | first letter; the lethal skull and the ghost's "?" are drawn |
| Stat plate icons | `STAT_SYMBOLS` | `pointy-sword`, `heart-shield` | (CSS mask, nothing if missing) |
| Keep / Market emblem | `BUILDING_SYMBOLS` | `white-tower.svg` / `shop.svg` | "K" / "M" |
| Area glyphs | `AREA_SYMBOLS` | Forcefield `energy-shield`, Pajazon `regeneration`, others `rune-stone` | dot |
| Keep model | `buildingModelPath('keep', colour)` | `models/kaykit-medieval-hexagon/building_castle_<blue\|red\|green>.gltf` (mine, opponent's, neutral) | procedural towers round a hall |
| Market model | `buildingModelPath('market', colour)` | `models/kaykit-medieval-hexagon/building_market_<colour>.gltf` | procedural stalls round a well |
| Low blocker | `BLOCKER_MODEL_PATHS.low` | `models/kenney-castle-kit/rocks-large.glb` | instanced stone block with a cap stone |
| Tall blocker (R36) | `BLOCKER_MODEL_PATHS.tall` | `models/kenney-nature-kit/rock_tallA.glb` | instanced 1.25-tile pillar |

A model is loaded only when the manifest lists it (`useAssetManifest`), with `useGLTF(url, false, false)` (no Draco or Meshopt decoder, so nothing comes from a CDN); the procedural piece shows while it loads and stays if it fails (`WithModel` error boundary). A missing or broken icon resolves to its glyph; a dev server's HTML fallback is detected and ignored. Canvas text redraws once the theme fonts load.

## Theme

`../theme/theme.ts` holds every art-direction default (research-art section 0, pending the owner's choice): both grade palettes, the owner cue, special faces, board, fog and overlay colours, token metrics, building looks, fonts and symbols. `ensureThemeFonts()` adds the Google Fonts stylesheet once unless the page already links fonts (production should self-host them, research-art 12); `themeCssVariables(clarity)` publishes the tokens as CSS custom properties with the same names as `ui/theme.ts`.

## Camera and input

- One orthographic camera; a pose is an elevation and azimuth around a ground target (`cameraMath.ts`). Top = 90 degrees, iso = 35.264 or 30 degrees at 45 degrees azimuth plus 90-degree steps. Fit-to-board follows resizes until the player zooms or pans; `fit()` restores it.
- Wheel or trackpad pinch zooms towards the cursor; drag with any button pans (the grabbed point stays under the pointer); two fingers pinch and pan. Pan is clamped to the board.
- Lights are fixed in world space outside the board group, so both seats see the same light.

## Performance

`frameloop="demand"`: frames render only on prop changes, texture updates (`onTexturesChanged`), camera tweens and while the director animates (`DirectorTicker`). Slabs, underlay, stones and every square overlay layer are instanced; coin geometries and textures are cached per look. DPR is clamped to [1, 2].

## Files

| File | Role |
|---|---|
| `BoardRenderer.tsx` | The component: canvas, reduced-motion detection, the imperative handle. |
| `ExtrasBoard.tsx` | The registry adapter: contract props plus the UI's `useBoardExtras()`. |
| `types.ts` | `BoardRendererExtras`, `BoardViewProps`, `BoardRendererHandle`, `GhostMarker`, `DamageForecast`, `MovePreview`, `AreaPreview`. |
| `coords.ts`, `cameraMath.ts`, `outline.ts`, `pathArrow.ts` | Pure maths: square <-> board <-> world, poses, fit, zoom and pan, x-ray occlusion, region outlines, path runs. |
| `timeline.ts`, `director.ts` | Pure animation: events -> timed cues; the director diffs views and samples token positions, fades, lunges and flashes. |

| `assets.ts` | URLs, model paths, manifest loading, icon and glyph look-ups. |
| `textures/` | Canvas textures: coin faces, badges, labels, overlay tiles, emblems, mines, the milled side. |
| `scene/` | The R3F layers: `Scene`, `CameraRig`, `Lighting`, `BoardSurface`, `Blockers`, `Buildings`, `Overlays`, `Tokens` / `Token`, `Effects`, glTF helpers. |
| `render.css` | Floating text and stat plate (layout and motion; colours come from the theme). |
| `RenderDemo.tsx` | The `#/dev/render` page. |

Tests (`*.test.ts`, vitest, Node): coordinates and the North turn, camera bases (checked against a three.js camera), true-isometric foreshortening, fit, zoom-to-cursor and drag-pan invariants, x-ray, outlines and the fog line, path runs, the timeline at every speed and under reduced motion, the director; `../theme/theme.test.ts` checks ink contrast for both palettes and the colour helpers.
