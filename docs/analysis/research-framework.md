# Technology & Architecture Research ("framework")

| | |
|---|---|
| **Project** | Browser-based 1v1 turn-based strategy board game (no title yet) |
| **Document** | `docs/analysis/research-framework.md` |
| **Date** | 2026-10-24. Every version and "current status" claim was checked on this date |
| **Status** | Proposal for owner review |
| **Input** | `docs/SPEC.md`, cited as **L*n*** (line *n* of that file), quoted verbatim |
| **Scope** | (1) Compare rendering/UI stacks and recommend one. (2) A renderer-agnostic architecture: engine, UI, renderer and net layers, folder layout, key TypeScript types, test strategy. (3) Every technology-relevant ambiguity, with a default so work can start |
| **Sibling analyses** | `rules-lawyer.md` (rules defaults, cited as **D-xx**), `research-netcode.md` (transport and protocol, cited as **netcode §x**), `research-art/` (visual mocks, in progress). This document defers to them on their topics and says so where it does (Appendix D) |

**Confidence legend.** Every default and recommendation is tagged:
- **High:** verified (registry, source code, live probe, measurement) or standard practice.
- **Medium:** a reasoned default, or backed only by secondary sources.
- **Low:** a judgement call the owner should confirm.

---

## 0. TL;DR

### 0.1 Recommendation (High)

**Stack A1: Three.js through React Three Fiber (R3F) for the board, React DOM for everything else, on a pure TypeScript rules engine, with host-authoritative peer-to-peer networking.**

| Layer | Pick | Exact version (npm registry, 2026-10-24) |
|---|---|---|
| 3D renderer | `three` | 0.186.1 (r186) |
| React binding for three | `@react-three/fiber` | 9.8.2 |
| Helpers (camera controls, outlines, billboards, glTF loading) | `@react-three/drei` | 10.7.9 |
| UI | `react` / `react-dom` | 19.3.1 (pinned below 19.4 because of R3F's peer range) |
| Client state | `zustand` | 5.0.16 |
| Engine immutability / input validation at trust boundaries | `immer` / `zod` (`zod/mini`) | 11.2.9 / 4.6.7 |
| Networking (per netcode §6) | `trystero`, default Nostr signalling | 0.26.0. PeerJS 1.5.5 is plan C: its built-in TURN hostnames no longer resolve (verified independently, §2.4) |
| Build and dev server | `vite` + `@vitejs/plugin-react` | 8.3.5 + 6.1.2 |
| Tests | `vitest` / `fast-check` / `@playwright/test` | 5.0.5 / 4.10.2 / 1.64.1 |
| Language | `typescript` | **6.0.3 for now.** 7.0.2 is out, but typescript-eslint doesn't support it yet (§2.4) |
| Monorepo | `pnpm` workspaces | 12.15.0 (not installed yet; npm 12.0.2 is) |
| Hosting | Static `dist/` on GitHub Pages, hash routing | n/a |

### 0.2 Scores (weighted, out of 100; details in §3)

| Rank | Candidate | Score |
|---|---|---|
| 1 | **A1** Three.js + `@react-three/fiber` + React | **91.4** |
| 2 | **D** Babylon.js 9 + React DOM overlay | 86.4 |
| 3 | **A2** Three.js as an imperative renderer class + React | 85.8 |
| 4 | **E** Canvas2D/SVG (+ CSS 3D transforms) + React | 76.4 |
| 5 | **C** PixiJS 8 + `@pixi/react` | 67.9 |
| 6 | **B** Phaser 4 (2D, fake isometric) + React DOM overlay | 58.2 |

### 0.3 Why A1

- **The spec asks for 3D objects and a camera switch.** L46 says "The neutral objectives are represented by 3d objects and a symbol in the middle that represents this building." L48 says "The view can switch from top to isometric. Top by default."
  - One 3D scene with one orthographic camera in two poses meets both natively, and can animate between them.
  - The 2D candidates (B, C, E) need a second, isometric art set for every building and token, and they swap sprites instead of turning the view.
- **The UI is large.** L21–L26 list a main menu, a lobby with an invite link, an army builder (also reachable at game start) and achievements. On top of that come the HUD, unit cards, logs and dialogs.
  - With R3F the board is just another React subtree. It reads the same zustand store as the DOM HUD.
- **The bundle cost is measured, not guessed** (§3.2). The initial JS for React + R3F + the drei helpers we'd use is **344 KB gzip**. The 3D part (about 276 KB gzip) can be lazy-loaded after a menu shell of roughly 110–160 KB gzip.
- **The ecosystem is the healthiest of the 3D options.** three has 15.2 M weekly downloads, R3F 4.25 M. Both shipped several releases in 2026 (three r183–r186; R3F 9.6–9.8).

### 0.4 Architecture in one paragraph

There are four packages.
- **`engine`** is a pure, deterministic rules machine: `apply(state, player, intent) → { state, events }`. State is JSON only, all maths is integer, the RNG is seeded, and the package compiles without DOM types.
- **`content`** holds units, abilities, commanders, buildings, scenarios and every rules switch as declarative tables. Rules that don't fit the data vocabulary name a coded handler.
- **`net`** runs the host-authoritative session from netcode §7. The lobby creator's browser holds the full state and the intent log. It sends each player only `project(state, player)`, so fog of war is enforced on the data, not just painted over it, plus that player's filtered events.
- **`apps/web`** holds the UI and the R3F renderer. Both read the same `PlayerView`.

The intent log plus `replay()` gives take-back (L39), reconnection, saved games, replays and golden regression tests, all from one mechanism.

### 0.5 Biggest risks

| Risk | Mitigation |
|---|---|
| R3F v10 makes WebGPU the default (alpha since 2026-01-17; alpha.6 on 2026-10-17) | Stay on 9.8.x. Write no raw GLSL: stock materials and textures only (§4.5). The renderer sits behind a contract (§5.11) |
| R3F's peer range is `react >=19 <19.4` | Pin React `~19.3.1`. Upgrade React and R3F together |
| Free public signalling and TURN infrastructure is fragile (PeerJS TURN dead, Open Relay retired; netcode §3.1) | `Transport` interface with Trystero primary, PeerJS adapter possible, Cloudflare Durable Object relay as fallback (netcode §6) |
| The host's machine holds hidden information | Accepted for friendly games (netcode §6.3). Server authority later runs the same engine unchanged |
| TypeScript 7 tooling churn | TS 6.0.3 now. Moving to 7.1 is a version bump once typescript-eslint supports it |

### 0.6 Owner decisions that most affect the build

Defaults are in §10, so work can start without waiting for these.
1. Corner-cut shape (L30). The rules doc's Rule A leaves 593 squares (Appendix A).
2. AP per turn (L9). Rules default: 10.
3. Distance metrics: L15 vs L34 vs L45.
4. Off-turn choices (L130): prompts or standing settings.
5. Isometric flavour (L48): true isometric or 2:1 dimetric.

---

## 1. What the spec demands technically

| Spec (verbatim) | Technical consequence | Handled in |
|---|---|---|
| L135 "The game, preferably, should be made for the browser, with a way to connect with another player. This should be done in a way that requires the least setup." | Static single-page app. Peer-to-peer WebRTC through public signalling. No accounts, no server of our own | §5.9, netcode |
| L22 "he will create a lobby and will have a link to invite another player." | The client creates rooms. The invite URL carries the room identity in the `#fragment` | netcode §7.4 |
| L30 "The size of the battlefields are 25x25, where the corners are cut off with a radius of 4." | The board is a 25×25 mask held as data. With at most 625 squares, every algorithm is trivial (BFS and vision take well under 1 ms) | §5.2, App. A |
| L48 "The view can switch from top to isometric. Top by default." | A camera rig with two poses and an animated transition. Picking must work in both | §4.2 |
| L46 "The neutral objectives are represented by 3d objects and a symbol in the middle that represents this building." | Real 3D models (glTF) or pre-rendered sprites per view. The symbol must read in both views | §4.4 |
| L44 "each unit will be represented by a token. The color of the token will represent the grade of the unit. The symbol on top of the token will represent the particular unit that token represents." | A coin-shaped token: grade-coloured body, symbol texture on top. Ownership needs another visual channel | §4.3, T-34 |
| L47 "The style of the graphics is stylized." | Toon or flat shading, outlines, low-poly models. No PBR realism, so assets are cheaper | §4.10 |
| L17 "Each player will only have vision around the vision field of each unit. Everything outside will be in the fog of war." | Per-player visibility. Hidden data must never reach the other client: fog is a data filter, not a visual effect | §5.5 |
| L81 "This unit becomes invisible." / L101 "Deploy an invisible mine" / L90 "This unit reveals invisible units in its LOV" | Invisibility sits on top of fog. Reveal rules are part of the projection | §5.5 |
| L82 "When an enemy unit comes into the melee range of this unit ... (This can also occur in opponents turn)" | Reactions fire inside the other player's action, so movement must be resolved step by step | §5.3 |
| L101 "It explodes when any unit steps on it." / L102 "Ask the player if he wants a unit to go to a mined square." | The move intent carries an explicit path. The mine warning is client-side UX | §5.3, R-20 |
| L130 "When a unit in that area dies you can choose to sacrifice 1 max toughness to revive that unit" | A choice can fall to the non-active player during the other player's turn | §5.3, R-11 |
| L39 "There will be a take back option for each player. The opponent player has to accept the take back." | Deterministic engine + intent log, so undo works by replay. Plus a request/accept handshake | §5.6 |
| L21–L26 (main menu, lobby, army compositions, achievements) | Lots of conventional UI: a DOM framework (React) beats canvas-drawn UI | §5.10 |
| L43 "It may be possible to add new factions later into the game." | Units, abilities and factions are data. The engine never hard-codes a faction | §5.8 |
| L27 "The player will have a budget of 200, which can be edited in the future" | Rules config, set per match in the lobby | §5.8, T-09 |
| L136 "Any artistic decision will show a quick mock in a page, as well as justification for the use. If there are several contenders, all should be represented and justified." | The renderer must make quick mocks cheap. The M0 spike doubles as the camera and fog mock page | §12 |

---

## 2. Ecosystem snapshot (late October 2026)

### 2.1 Method (High)

1. **npm registry.** Queried `registry.npmjs.org/<package>` and the npm downloads API on 2026-10-24 for dist-tags, publish dates and peer dependencies.
2. **WebSearch cross-check** for the seven packages the task named (sources at the end). Where search and registry disagree, the registry wins. Search indexes lagged by weeks:
   - Search reported zustand 5.0.14; the registry has 5.0.16.
   - Search found no Vitest 5 release, but 5.0.0 was published on 2026-09-03.
3. **Local bundling.** Installed the candidate packages into an isolated scratch folder with lifecycle scripts disabled. Bundled small, realistic entry files with esbuild 0.28.2 (§3.2, Appendix C).
4. **Source checks.** Confirmed capability claims in the installed sources and type definitions:
   - R3F calls `extend(THREE)`.
   - Babylon ships `NullEngine`.
   - Pixi ships `PerspectiveMesh`.
   - Phaser 4 has `ISOMETRIC` tilemaps and a `Mesh` game object.
   - three's `WebGPURenderer` has `forceWebGL`.
5. **Live probes.**
   - `https://0.peerjs.com/` answered HTTP 200 (location "EU") and issued a peer id.
   - DNS lookups for PeerJS's TURN hosts returned no records (§2.4).

### 2.2 The seven packages the task asked about

| Package | Exact latest | Published | Current major since | WebSearch finding | Notes |
|---|---|---|---|---|---|
| `three` | **0.186.1** | 2026-09-24 | 0.x line; r186.0 on 2026-09-08 | r186 shipped in September 2026 with a native GaussianSplat renderer (WebGPU-only) and `Object3D.dispose()` / `intersectsFrustum()` | 15.2 M downloads/week. 2026 cadence: r183 Feb, r184 Apr, r185 Jun, r186 Sep. **Not semver:** every minor can break, so pin `~0.186.1` |
| `@react-three/fiber` | **9.8.2** | 2026-10-14 | 9.0.0 on 2025-02-19 | v10.0.0-alpha.6 makes WebGPU the default renderer. Custom-GLSL users switch to `@react-three/fiber/legacy` | 4.25 M/week. v10 alphas since 2026-01-17. Peers: `react >=19 <19.4`, `three >=0.156` |
| `vite` | **8.3.5** | 2026-10-21 | 8.0.0 on 2026-03-12 | Vite 8 stable on 2026-03-12, with Rolldown as the single bundler | 127 M/week. 7.3.x and 6.4.x still received patches in October 2026 |
| `react` | **19.3.1** | 2026-10-14 | 19.0.0 on 2024-12-05 | 19.3.0 released 2026-09-09 | 124 M/week. 19.1.x backports continue (`backport` tag 19.1.10) |
| `zustand` | **5.0.16** | 2026-10-22 | 5.0.0 on 2024-10-14 | Search found 5.0.14 (May 2026), a stale index | 40.5 M/week |
| `vitest` | **5.0.5** | 2026-10-15 | 5.0.0 on 2026-09-03 | Search found only 4.0 (2025-10-22) and 5.0 betas. The GitHub v5.0.0 notes say: "Require Node.js 22 and Vite 6.4"; mocks are cleared before each test; an unawaited async assertion fails the test | 83.7 M/week. The v4 line continues at 4.1.12 |
| `peerjs` | **1.5.5** | 2025-06-07 | 1.0.0 on 2019-04-10 | 1.5.5 is current. The docs say you "can also run your own PeerServer if you don't like the cloud" | 70.6 k/week, 13.5 k stars, 184 open issues, 22 open PRs. **No release in 16 months.** Broker alive, built-in TURN dead (§2.4) |

### 2.3 Other versions that matter

| Package | Version | Published | Why it matters |
|---|---|---|---|
| `typescript` | 7.0.2 latest; 6.0.3 | 2026-07-08 / 2026-04-16 | 7.0 is the Go-native compiler. Its stable programmatic API is expected in 7.1 (7.1.0-beta on 2026-10-20) |
| `typescript-eslint` | 8.72.0 | 2026-10-19 | Peer `typescript >=4.8.4 <6.1.0`, so it can't type-check-lint with TS 7 yet |
| `@typescript/typescript6` | 6.0.2 | 2026-07-06 | Microsoft's compatibility package (`tsc6` plus the 6.0 API) for mixed setups |
| `@react-three/drei` | 10.7.9 (11.0.0-alpha.7) | 2026-09-25 | Peers `@react-three/fiber ^9` |
| `@react-three/test-renderer` | 9.1.1 | 2026-07-31 | Scene-graph tests without WebGL |
| `@react-three/postprocessing` / `postprocessing` | 3.2.2 / 6.39.5 | 2026-10-21 / 2026-09-09 | postprocessing's peer is `three >=0.168.0 <0.187.0`: **if adopted, it caps three at r186** |
| `@types/three` | 0.186.0 | 2026-09-11 | |
| `@vitejs/plugin-react` | 6.1.2 | 2026-10-05 | Requires `vite ^8` |
| `phaser` | 4.2.1 | 2026-07-09 | 4.0.0 "Caladan" on 2026-04-10 |
| `pixi.js` / `@pixi/react` | 8.22.0 / 8.0.5 | 2026-10-01 / 2025-12-01 | `@pixi/react` hasn't released for 11 months |
| `@babylonjs/core` / `react-babylonjs` | 9.32.0 / 4.0.2 | 2026-10-22 / 2026-06-02 | Babylon 9.0.0 on 2026-03-26, near-weekly releases. `react-babylonjs` has 2.8 k downloads/week |
| `playcanvas` / `@playcanvas/react` | 2.23.3 / 0.11.7 | 2026-10-15 / 2026-09-25 | React bindings are pre-1.0 (4.9 k/week) |
| `trystero` | 0.26.0 | 2026-10-04 | Default strategy Nostr. Subpaths `torrent`, `mqtt`, `supabase`, `firebase`, `ipfs` |
| `boardgame.io` | 0.50.2 | **2022-11-10** | Stale |
| `colyseus` / `partyserver` / `partysocket` | 0.18.10 / 0.5.10 / 1.3.0 | 2026-10-22 / 2026-08-03 / 2026-06-23 | Server-side options; all need a deploy |
| `immer` / `mutative` | 11.2.9 / 2.0.0 | 2026-10-22 / 2026-10-12 | |
| `zod` / `valibot` | 4.6.7 / 1.5.0 | 2026-10-12 / 2026-09-09 | Both about 5 KB gzip in our measurement |
| `fast-check` | 4.10.2 | 2026-09-19 | Property-based tests |
| `@playwright/test` | 1.64.1 | 2026-10-14 | End-to-end and visual tests |
| `happy-dom` / `jsdom` | 21.0.4 / 30.1.3 | 2026-10-20 / 2026-10-15 | DOM environments for UI tests |
| `@testing-library/react` | 16.3.3 | 2026-08-27 | |
| `pnpm` | 12.15.0 | 2026-10-21 | Not on this machine (npm 12.0.2 is) |
| `eslint` / `oxlint` | 10.13.0 / 1.89.0 | 2026-10-16 / 2026-10-19 | |
| `dependency-cruiser` | 18.7.0 | 2026-10-19 | Layer-boundary checks |
| `wouter` / `react-router` | 3.13.0 / 8.5.0 | 2026-09-30 / 2026-10-19 | |
| `radix-ui` | 1.8.1 | 2026-10-12 | Accessible dialog, tooltip and popover primitives |
| `idb-keyval` | 6.3.0 | 2026-07-08 | IndexedDB persistence |
| `camera-controls` | 3.1.2 | 2025-11-17 | Used by drei's `<CameraControls>` |
| `@gltf-transform/cli` / `gltfjsx` | 4.5.1 / 6.5.3 | 2026-09-28 / 2024-11-04 | glTF optimisation / JSX code generation |
| Node.js (installed) | 24.21.0 | | Meets Vite 8 (`^20.19 \|\| >=22.12`) and Vitest 5 (≥ 22) |

### 2.4 Consequences for this project

1. **Pin React to `~19.3.1`** until R3F widens its peer range (`>=19 <19.4`). (High)
2. **Stay on R3F 9.8.x (WebGL renderer) and prepare for v10 (WebGPU default).** (High)
   - Write no raw GLSL (`ShaderMaterial`, `onBeforeCompile`). Use stock materials and textures, and TSL if a custom shader is ever unavoidable.
   - three's manual says `WebGPURenderer` "can automatically fall back to using a WebGL 2 backend".
   - One third-party migration report saw a black canvas on Linux Firefox, so test both backends (`forceWebGL: true`) before switching.
3. **Pin `three` with `~0.186.1`** (patch updates only). If `@react-three/postprocessing` is used, three is capped below 0.187 until `postprocessing` widens its peer range. (High)
4. **TypeScript 6.0.3 now.** (High)
   - TS 7.0's Go compiler lacks the stable programmatic API that typescript-eslint needs. That API is expected in 7.1; the beta shipped 2026-10-20.
   - Vite and Vitest don't use `tsc` for transpiling, so they're unaffected.
   - Moving to 7.1 later is a version bump.
5. **PeerJS's built-in TURN is dead (verified).** (High)
   - PeerJS 1.5.5's `DEFAULT_CONFIG` still lists `turn:eu-0.turn.peerjs.com:3478` and `turn:us-0.turn.peerjs.com:3478`, with user `peerjs` and password `peerjsp`.
   - Today both names return `ENODATA` for A, AAAA and CNAME records.
   - So out of the box PeerJS is STUN-only, the same as Trystero. Its broker is alive but volunteer-run, and the library hasn't released for 16 months.
   - This matches netcode §3.1/§4.1, which makes Trystero primary and PeerJS plan C. This document adopts that.
6. **Vitest 5** needs Node ≥ 22 (24.21.0 is installed). Configure monorepo projects with `test.projects`; inline projects extend the root config by default. (High)

---

## 3. Candidate evaluation

### 3.1 Criteria and weights

| Criterion | Weight | Why this weight |
|---|---|---|
| Top ↔ isometric toggle fidelity | 15 | Explicit requirement (L48), visible on every frame of the game |
| 3D objectives | 13 | Explicit requirement (L46) |
| Token rendering and picking | 10 | Core interaction: coin tokens with symbols (L44), hover, select, target |
| Fog-of-war rendering | 8 | Required (L17). The *security* side is engine work, identical for all candidates; this scores only the visuals |
| Performance | 3 | Trivial here: at most 625 squares and a few hundred tokens |
| Development speed | 15 | One developer, a big rules surface, many UI screens |
| UI integration | 8 | Menus, army builder, lobby, HUD, cards, logs (L21–L26) must coexist with the board |
| Bundle size | 5 | Matters for the first load only; the game is static-hosted and cacheable |
| Ecosystem health (late 2026) | 13 | Bus factor, docs, examples, release cadence, TypeScript support |
| Testability | 10 | Rules are pure TypeScript for every candidate; this scores the rendering/UI layer |
| **Total** | **100** | Static hosting is a pass/fail gate, and **all candidates pass** |

### 3.2 Measured bundle sizes (High for the numbers; method in Appendix C)

Setup: esbuild 0.28.2 with `--bundle --minify --format=esm --splitting --target=es2022`. Sizes are gzip -9. "Initial" is the entry chunk; split chunks load only on demand. App code isn't included. Vite 8 (Rolldown) output will differ by a few percent.

| Variant (what the entry imports) | Initial JS (gzip) | All emitted JS (gzip) | Minified, all chunks | Notes |
|---|---|---|---|---|
| E: React 19.3.1 + react-dom + zustand | **67.8 KB** | 67.8 KB | 218.9 KB | Baseline UI shell |
| A2: React + zustand + three subset + `GLTFLoader` (imperative) | **221.2 KB** | 221.2 KB | 824.6 KB | three alone, tree-shaken to a typical subset: 153.6 KB |
| A1: React + R3F 9.8.2 + zustand | **310.8 KB** | 310.8 KB | 1,124.7 KB | R3F pulls in all of three (185.9 KB on its own): see below |
| A1 + drei 10.7.9 (`OrthographicCamera`, `CameraControls`, `Outlines`, `Billboard`, `useGLTF`) | **344.3 KB** | 564.5 KB | 1,955.0 KB | The extra "all emitted" is lazy chunks that never load unless used |
| A1 + drei `Text` (troika) as well | 386.3 KB | 606.5 KB | 2,069.9 KB | SDF text; DOM labels via `<Html>` avoid this cost |
| B: Phaser 4.2.1, no UI framework | **362.2 KB** | 362.2 KB | 1,362.1 KB | Not tree-shakeable. Adding React for the DOM UI makes it about 430 KB |
| C1: pixi.js 8.22.0 subset | 10.5 KB, plus renderer chunks at `init` | 172.9 KB (23 chunks) | 567.1 KB | WebGL and WebGPU renderers are split. A WebGL-only session loads a subset, estimated at 90–120 KB |
| C2: React + `@pixi/react` 8.0.5 + pixi + zustand | 110.3 KB, plus renderer chunks | 272.6 KB | 891.6 KB | |
| D1: Babylon 9.32.0 deep imports + glTF loader | **256.8 KB** | 911.6 KB (269 chunks) | 3,593.9 KB | Shaders and loaders load lazily. Estimated real initial with shaders: 290–340 KB, plus React |
| D2: Babylon barrel import (`from '@babylonjs/core'`) | **968.5 KB** | 1,856.9 KB (1,051 chunks) | 7,325.2 KB | Never do this; enforce deep imports with a lint rule |
| net: `peerjs` 1.5.5 | 23.5 KB | | 86.0 KB | |
| net: `trystero` 0.26.0 (Nostr) | 26.9 KB | | 73.4 KB | |
| engine libs: `immer` 11 + `valibot` 1.5 | 4.9 KB | | 12.7 KB | |
| engine libs: `zod` 4.6 (`zod/mini`) | 5.1 KB | | 14.6 KB | |

**Findings.**
- **R3F can't tree-shake three.**
  - R3F 9's `<Canvas>` runs `React.useMemo(() => extend(THREE), [])` on `import * as THREE from 'three'`. Verified at line 40 of `@react-three/fiber/dist/react-three-fiber.esm.js`.
  - So the whole three namespace ships: 185.9 KB, against 153.6 KB for a hand-picked subset.
  - Net premium of R3F over an imperative three renderer: **about 90 KB gzip** (310.8 vs 221.2, React included in both).
- **drei is cheap at first load.** Importing from the drei barrel costs only about 15–35 KB of initial JS for the helpers we'd use.
  - The bundler also emits lazy chunks for `hls.js` (571.5 KB minified) and `@mediapipe/tasks-vision` (134.4 KB minified). Those load only if the video and face-tracking helpers are rendered.
  - They inflate "all emitted" but not download size.
- **Babylon requires deep imports.** A barrel import costs about 969 KB gzip up front.
- **Plan for A1:**
  - Menu shell (React, zustand, UI, engine, content): about 110–160 KB gzip (estimate).
  - Board chunk (three + R3F + drei): about 276 KB gzip, lazy-loaded when entering the lobby and prefetched when the pointer hovers "Play".
  - CI size budget in §9.

### 3.3 Candidate notes

#### A1. Three.js + @react-three/fiber + React (recommended)

- **Toggle.**
  - One `OrthographicCamera`. The "top" pose looks straight down; the "iso" pose sits at 35.264° elevation and 45° azimuth.
  - The transition takes about 350 ms through drei `<CameraControls>` or a small custom damped tween.
  - Every mesh serves both views, with no re-layout.
  - 90° iso rotation steps, zoom and pan come for free. A perspective tilt is one flag if ever wanted.
- **3D objectives.** Low-poly glTF models (CC0 packs) or procedural blocks. Toon materials plus drei `<Outlines>`. The symbol is a floating `<Billboard>` disc.
- **Tokens and picking.**
  - Coin geometry with a symbol texture on the face.
  - R3F's built-in pointer events raycast meshes.
  - The ground plane converts any pointer to a square.
  - drei `<Html>` gives crisp DOM labels and damage numbers.
- **Fog.** A visibility `DataTexture` used as the `alphaMap` of a dark overlay plane. No custom shader is needed, so it is portable to WebGPU (§4.5).
- **Development speed.**
  - The scene graph is declarative and mirrors the `PlayerView`. Hot reload works.
  - The example corpus is the largest in WebGL.
  - Pitfalls to avoid: React state updates per frame (use refs and `useFrame`) and too-wide store subscriptions.
- **UI integration.** One React tree and one store for HUD and board. Suspense handles asset loading, and `React.lazy` splits the 3D chunk.
- **Bundle.** 311 KB (core) to 344 KB (with drei helpers) initial. That is the price of convenience: about +90 KB over A2.
- **Ecosystem.** Excellent (§2.2). Watch R3F v10 (WebGPU default) and the React peer range.
- **Testability.** The engine is separate anyway.
  - Scene-graph assertions work without WebGL through `@react-three/test-renderer` 9.1.1.
  - Visual regressions are caught by Playwright screenshots under SwiftShader (§8.8).

#### A2. Three.js as an imperative renderer class + React UI

- **Same capabilities as A1.** The board is a `BoardRenderer` class fed with `(PlayerView, overlay, events)`. It diffs meshes by hand, wires its own raycasting and events, and handles its own disposal.
- **Smaller bundle:** 221 KB initial, and three gets tree-shaken.
- **Slower to build**, because every scene update, hover and click plumbing step is hand-written.
- **Role:** the fallback if R3F's v10 transition causes friction. The renderer contract (§5.11) keeps such a swap inside `apps/web/src/render/`.

#### B. Phaser 4 (2D, fake isometric) + React DOM overlay

- **Toggle.**
  - A separate projection and separate isometric art for tiles, buildings and token edges.
  - Switching views means swapping sprite sets and repositioning. Sprites can't turn their viewpoint, so a smooth animation is impossible.
  - Isometric tilemaps (`Tilemaps.Orientation.ISOMETRIC`, present in 4.2.1) help with the ground only.
- **3D objectives.** Pre-rendered sprites (render the models from two angles in Blender). Phaser 4 keeps a `Mesh` game object for vertex meshes, but there is no 3D scene graph, camera rig or lighting.
- **Strengths.** Mature 2D game tooling: scenes, tweens, input, audio, loader, RenderTexture fog, and the new renderer and filters in 4.0. Commercial backing.
- **Weaknesses.**
  - Heavy screens belong in the DOM, which means two paradigms joined by an event bus.
  - 362 KB gzip, not tree-shakeable.
  - v4 is six months old, so v4-specific examples and plugins are thinner.
  - Scenes need a canvas, which makes them awkward to test.

#### C. PixiJS 8 + @pixi/react 8

- **Toggle.**
  - A 2D affine transform on the board container (rotate 45°, then scale Y by about 0.58 for true isometric) can **smoothly morph a flat top view into an isometric one**. That's a nice trick for flat layers.
  - Tokens and buildings must be counter-rotated upright sprites with their own isometric art.
  - `PerspectiveMesh` (present in v8) fakes perspective planes, not models.
- **3D objectives.** None first-party, so sprites.
- **Strengths.**
  - Fast renderer, good events and text, filters for fog.
  - JSX bindings (`@pixi/react` 8, with `extend()` and `pixiContainer` intrinsics) in the same React tree.
  - Small initial size: 110 KB with React.
- **Weaknesses.**
  - Same dual-art problem as Phaser.
  - `@pixi/react` hasn't released since 2025-12-01.

#### D. Babylon.js 9 + React DOM overlay (strong runner-up)

- **Toggle and 3D.** A full 3D engine written in TypeScript.
  - `ArcRotateCamera` with `Camera.ORTHOGRAPHIC_CAMERA`, glTF loader.
  - `HighlightLayer` and `GlowLayer` for selection, `scene.pick`.
  - GUI, the Node Material Editor and the Inspector all included.
- **Testability.** `NullEngine` (present in 9.32.0) runs scenes headless in Node.
- **Weaknesses.**
  - React integration is thin: `react-babylonjs` has 2.8 k downloads/week. In practice you hand-write a bridge between the store and an imperative scene.
  - The deep-import discipline is mandatory. Initial size is comparable to A1 only with deep imports.
  - Fewer stylized board-game examples than three.
- **When to choose it:** if the owner prefers a batteries-included engine and an imperative style over React-for-everything.

#### E. Canvas2D/SVG + React (+ CSS 3D transforms)

- **Toggle.**
  - The board is a DOM/SVG grid. `transform: rotateX(54.7deg) rotateZ(45deg)` with CSS transitions gives a **genuinely smooth isometric tilt of the flat board**.
  - Tokens can be billboarded by counter-transform.
  - Buildings become CSS boxes or isometric SVG drawings (two art variants). There's no lighting, and the 3D look is weak.
- **Strengths.**
  - Smallest bundle (68 KB).
  - Native DOM events, focus and accessibility; crisp vector symbols.
  - The easiest tests: Testing Library works on the board itself.
- **Weakness.** It misses the spirit of L46 ("3d objects") and makes the iso view look flat.
- **Still useful:** as a 200-line **debug renderer** behind the same contract (§11 S-8).

### 3.4 Score matrix (0–5 per criterion; weighted total out of 100)

| Criterion (weight) | A1 R3F | A2 three + React | B Phaser 4 | C Pixi 8 | D Babylon 9 | E DOM/SVG |
|---|---|---|---|---|---|---|
| Top/iso toggle (15) | 5 | 5 | 2 | 2.5 | 5 | 2.5 |
| 3D objectives (13) | 5 | 5 | 1 | 1.5 | 5 | 1.5 |
| Tokens and picking (10) | 5 | 4 | 4 | 4 | 5 | 4.5 |
| Fog rendering (8) | 4 | 4 | 4 | 4 | 4.5 | 3.5 |
| Performance (3) | 5 | 5 | 5 | 5 | 4.5 | 4 |
| Development speed (15) | 4 | 3 | 3 | 3.5 | 3.5 | 4 |
| UI integration (8) | 5 | 4 | 3 | 4.5 | 3 | 5 |
| Bundle size (5) | 3 | 4 | 2 | 4 | 2.5 | 5 |
| Ecosystem health (13) | 5 | 5 | 4 | 4 | 4.5 | 5 |
| Testability (10) | 4 | 4 | 3 | 3.5 | 4.5 | 5 |
| **Weighted total** | **91.4** | **85.8** | **58.2** | **67.9** | **86.4** | **76.4** |

Notes on scores that need a reason:
- **Fog 4 (not 5) for A1/A2.** Fancy fog (animated clouds, soft volumetrics) needs shader work, and raw GLSL is a liability with WebGPU coming. The plain approach in §4.5 is enough.
- **Babylon bundle 2.5.** Babylon is comparable to A1 *only* with deep imports, and initial size grows with each lazily loaded shader.
- **E testability 5.** The board itself is DOM.

### 3.5 Sensitivity

| Scenario | A1 | D | A2 | E | C | B |
|---|---|---|---|---|---|---|
| Weights as above | **91.4** | 86.4 | 85.8 | 76.4 | 67.9 | 58.2 |
| 3D criteria (toggle, objectives) halved, freed weight spread over the rest | **89.7** | 83.8 | 83.0 | 83.3 | 73.2 | 63.5 |
| 3D criteria dropped entirely (owner removes L46/L48) | 88.1 | 81.1 | 80.3 | **90.3** | 78.5 | 68.9 |

- A1 stays first unless the owner drops the 3D objects and the isometric view altogether.
- In that case DOM/SVG (E) becomes the better choice. That's worth knowing before committing art budget.

### 3.6 Also considered and rejected

| Option | Version checked | Why not |
|---|---|---|
| Godot 4 (web export) | n/a | Excellent editor and 3D, but no TypeScript. Large WebAssembly payload. UI would live in Godot's own UI system, away from the web ecosystem |
| Unity (WebGL build) | n/a | Heavy payloads, C#, licence terms; no TypeScript |
| PlayCanvas + `@playcanvas/react` | 2.23.3 / 0.11.7 | Capable 3D, but the React bindings are pre-1.0 and small (4.9 k/week); smaller community than R3F |
| Excalibur | 0.32.0 | 2D TypeScript engine, pre-1.0, small community; same dual-art problem as B and C |
| Threlte (Svelte) / TresJS (Vue) | not checked | Equivalent to R3F *if* the owner prefers Svelte or Vue. React wins on ecosystem size |
| boardgame.io as the engine framework | 0.50.2 (2022-11-10) | Right ideas (moves, phases, `playerView` for secret state, P2P transport), but **unmaintained**. Borrow the ideas, not the dependency |
| Colyseus, or Cloudflare Durable Objects with `partyserver` | 0.18.10 / 0.5.10 | Server-authoritative designs remove host peeking but need a deploy, against L135 "least setup". Durable Objects are netcode's Phase 2/3 path; the same engine runs there unchanged. (Netcode §0 reports that *hosted* PartyKit shut down on 2026-10-23; the `partyserver` library runs on your own Cloudflare account) |

### 3.7 Risk register for the recommended stack

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| K1 | R3F v10 / WebGPU migration breaks custom rendering | Medium (2026–27) | Medium | No raw GLSL; stock materials and textures; renderer contract; stay on 9.8.x until v10 and drei 11 are stable |
| K2 | React upgrade blocked by R3F's peer range | High | Low | Pin `~19.3.1`; upgrade in lockstep |
| K3 | three minor releases break APIs | Medium | Low | `~0.186.1`; upgrade on purpose, with visual tests |
| K4 | Public signalling or TURN unreliable | Medium | High (can't play) | Netcode §6: Trystero with redundant Nostr relays, optional Metered TURN key, Cloudflare Durable Object relay as fallback; PeerJS adapter as plan C |
| K5 | Host peeks through fog | Low (friends) | Medium | Accepted; commit-reveal plus post-game audit make tampering detectable (netcode §7.15); server mode later |
| K6 | 3D art takes too long | Medium | Medium | CC0 low-poly packs; procedural coins; toon shading hides low detail; art direction defined by `research-art/` |
| K7 | Bundle grows past budget | Low | Low | Lazy 3D chunk; CI size gate (§9) |
| K8 | WebGL unavailable in CI | Medium | Low | SwiftShader flags (§8.8); keep visual tests few |

---

## 4. Rendering design for the recommended stack

### 4.1 Coordinates and board mesh

- **Engine squares.**
  - `Square { x, y }` is 0-based: x is the column from P1's left, y is the row with 0 = P1's back row.
  - The UI shows them as columns **A–Y** and rows **1–25**, per D-G1 ("P1 back row = 1").
- **World coordinates (Y up), for N = 25:**
  - `X = x − 12` and `Z = 12 − y` (square centres).
  - Inverse: `x = round(X + 12)` and `y = round(12 − Z)`.
  - The centre of a 2×2 unit is its anchor + (0.5, 0.5) in square units.
- **Board mesh.**
  - One merged geometry of square tiles built from the scenario mask: 593 tiles with the default Rule A (Appendix A). A small gap or bevel gives a tiled look.
  - A subtle checker tint helps counting squares.
  - Deployment zones and capture rings are overlay layers.
- **The renderer never hard-codes the corner shape.** It reads `board.mask`.

### 4.2 Camera rig (L48 "The view can switch from top to isometric. Top by default.")

- **One orthographic camera for both views.**
  - Isometric is a parallel projection by definition.
  - Board games read best without perspective.
- **Poses.** Target = board centre; d = distance. Position = target + d·(cos e·sin a, sin e, cos e·cos a).
  - **Top:** elevation e = 90° and azimuth a = 0° for P1, 180° for P2, so each player has their own side at the bottom (T-33). Use a polar angle of 1e-4 rad, or `camera.up = (0, 0, −1)`, to avoid the look-at singularity.
  - **Iso (true isometric, default; T-32):** e = 35.264° (= atan(1/√2)) and a = 45° + 90°·k (+180° for P2), where k = 0–3 is the rotation step (Q/E keys).
  - **Iso (2:1 dimetric, setting):** e = 30°.
- **Transition.**
  - Tween (e, a, zoom) over about 350 ms with ease-in-out.
  - With drei `<CameraControls>`: `rotateTo(azimuth, polar, true)` plus `zoomTo(z, true)`. A 30-line custom damped tween in `useFrame` works too.
- **Zoom to fit:** zoom = min(viewportW / projectedW, viewportH / projectedH), with margins.
  - Top: 25 × 25.
  - Iso: width 25√2 ≈ 35.36; height 35.36·sin e + h·cos e, where h is the tallest object (20.41 for true iso, 17.68 for dimetric, before h).
  - The cut corners trim the diamond's tips; fit to the mask's actual extremes.
- **Controls.** Wheel or pinch to zoom. Right-drag or two fingers to pan, clamped to the board. Q/E rotate in iso. T toggles the view. Home resets.
  - Free orbiting is off; only the 90° steps are allowed, which keeps the board readable.

### 4.3 Tokens (L44)

- **Geometry.**
  - A coin: either `LatheGeometry` with a raised-rim profile, or `CylinderGeometry(0.42, 0.42, 0.12, 48)` with three material groups (rim, face, back).
  - Size-2 units (L109 "Beast of Knorund, 20/40, 2, ...") use a radius of about 0.9, centred on the 2×2 footprint.
- **Materials.**
  - The body is the grade colour. The unit symbol sits on the face, from an SVG rasterised to a 256 px texture, or a single atlas.
  - Ownership: player colour as a ring on the board under the token, plus a band on the rim (T-34).
  - Toon or flat-Lambert shading. Selection uses drei `<Outlines>`.
- **Readability.** The top view shows the face, which is ideal for symbols. The iso view shows face plus rim, the "coin" feel. Keep tokens low so neighbours aren't hidden.
- **Decorations.**
  - A health arc ringing the face, readable from above.
  - Status badges as `<Billboard>` sprites: defending, stealthed (own units only), cooldown.
  - Floating damage numbers through drei `<Html>`: DOM, crisp and translatable.
- **Count.** Worst case is about 160 units per side: the default zones hold 109 + 50 squares, and every unit must be deployed (D-B3). Add summons and that's about 350 meshes, which is trivial. Use drei `<Instances>` only if profiling says so.

### 4.4 Neutral objectives (L45, L46)

- **Models.** 2×2 low-poly glTF keep and market.
  - Source: CC0 packs (Kenney, KayKit, Quaternius; references in `research-art/`) or procedural blocks for M0.
  - Optimise with gltf-transform (meshopt + WebP) and load with `useGLTF`.
- **"A symbol in the middle"** (L46):
  - A floating emblem disc (`<Billboard>`) above the centre, readable in both views.
  - Plus a roof decal for the top view.
  - Tinted by controller: neutral grey, P1 colour or P2 colour (T-35).
- **Capture zone.** The 12-square ring (D-O4) is highlighted on hover.
- **In fog**, buildings are always drawn, because the map is public (D-F5), and darkened when outside vision. Control is public.

### 4.5 Fog-of-war rendering (L17)

- **The renderer never hides secrets.** Enemy units outside vision are simply absent from `PlayerView` (§5.5). Fog is visual feedback only.
- **No custom shader** (portable to WebGPU):
  - Build a 100×100 single-channel `DataTexture` from `view.visible`: 4× upsampling plus a 3×3 box blur on the CPU, 10,000 texels, microseconds.
  - Use it as the `alphaMap` of a dark, transparent plane just above the tiles (`MeshBasicMaterial`, `depthWrite: false`).
- **Optional stylized drift.** A tiling cloud texture as `map` with an animated UV offset. Only when enabled, because it forces continuous rendering.
- **Buildings and blockers outside vision** are darkened through the same visibility lookup.
- **No last-seen markers** (D-F5). Mines and stealth indicators are drawn only for their owner; they aren't in the opponent's view anyway.

### 4.6 Picking and input

- **Tokens and buildings:** R3F pointer events (raycasting meshes) for hover, select and tooltips.
- **Squares:** an invisible ground plane. `onPointerMove` gives `event.point`, which converts to a square. This works the same in both views because both cast parallel orthographic rays.
- **Priority:** unit under the pointer, then building, then square. In iso, a tall building can hide squares behind it: rotate the view (Q/E) or use the keyboard cursor.
- **Keyboard cursor** (arrows, Enter, Esc) for accessibility and deterministic end-to-end tests.
- **Touch:** tap to select, tap to target, long-press for info.
- **The renderer only emits intents** (§5.11). The UI controller decides what they mean.

### 4.7 Overlays

- Instanced square highlights:
  - reachable squares (`engine.reachable` on the `PlayerView`);
  - attack and ability ranges;
  - deployment zones (normal and extended);
  - area previews: Pajazon 3×3 (L107), Forcefield's 4 squares (L106), Forceful slam's pattern (L110).
- A path preview line.
- A warning glyph where the planned path crosses one of your own mines (L102).

### 4.8 Animation driven by events

1. An `update` arrives carrying `events` and the new view.
2. The scene keeps showing the previous view and plays the events in order:
   - `unitStepped`: step tween.
   - `attacked`: bump and flash.
   - `damaged`: number pop.
   - `died`: dissolve.
   - `unitAppeared` / `unitVanished`: fade.
3. Then it snaps to the new view.

Input is locked while animating; animations are skippable and have a speed setting. If animations and snapshot ever disagree, the **snapshot wins**, so there's no desync.

### 4.9 Render on demand

- `<Canvas frameloop="demand">`, calling `invalidate()` on store changes and during tweens. A turn-based board is mostly still, so the GPU idles between moves (good for laptops and phones).
- Device-pixel ratio clamped to [1, 2]; antialiasing on.
- Shadows optional: contact shadows or baked ambient occlusion under buildings.

### 4.10 Assets and licences

- **Models.** CC0 packs (Kenney, KayKit, Quaternius) suit "stylized" (L47). Verify each pack's licence at download and record it in `apps/web/public/CREDITS.md`.
- **Symbols.** Custom SVG, or game-icons.net (CC BY 3.0, so **attribution is required**). Candidates are evaluated in `research-art/icons.json`.
- **Pipeline.** `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp` (CLI 4.5.1). Optionally `gltfjsx` (6.5.3) to generate typed JSX components.

---

## 5. Architecture

### 5.1 Layers and dependency rules

```
+------------------------------------ apps/web (browser) -------------------------------------+
|  UI layer (React DOM)                          Renderer layer (R3F / three)                 |
|  screens, HUD, unit cards, logs, dialogs  <->  <BoardScene view overlay events onIntent/>   |
|          ^                                                    |                             |
|          |  zustand stores: session | match | ui | settings | collection                    |
|          |  controller (pure reducer): renderer intents -> engine intents                   |
|  MatchClient  (same API for host and guest)                                                  |
+----------|-----------------------------------------------------------------------------------+
           | intents  /  PlayerView + VisibleEvents
+----------v------------------------------ packages/net ---------------------------------------+
|  HostSession (authority: GameState + intent log + persistence)  |  GuestSession              |
|  Transport: trystero (p2p) | relay (Cloudflare DO, phase 2) | loopback | tabs | peerjs (C)   |
+----------|-----------------------------------------------------------------------------------+
           | createMatch / check / apply / project / projectEvents / replay
+----------v------------------------- packages/engine (pure TS) ------------------------------+
|  board (mask, metrics, pathing, vision)  rules  effects  triggers  view  log  rng  serialize |
+----------^-----------------------------------------------------------------------------------+
           | ContentPack (data)
+----------+------------------------ packages/content (declarative tables) -------------------+
|  factions/units/abilities  commanders  buildings  scenarios  rules config  i18n             |
+----------------------------------------------------------------------------------------------+
```

| Package or folder | May import | Must not import | Enforced by |
|---|---|---|---|
| `packages/engine` | nothing at runtime except `immer` | content, net, React, three, DOM, Node | `tsconfig` with `"lib": ["ES2023"]` and `"types": []` (no DOM or Node globals compile); pnpm strict `node_modules`; dependency-cruiser rule |
| `packages/content` | engine (types and `define*` helpers) | net, React, three | same |
| `packages/net` | engine, content (rules version), `zod`, transport libraries | React, three | same |
| `apps/web/src/(ui)` | engine (helpers and types), content, net, React, zustand | three internals except through `render/` | lint rule |
| `apps/web/src/render` | engine *types* and `board/geometry` helpers, three, R3F, drei | engine `rules/`, `effects/`, `log/`; net | dependency-cruiser |

### 5.2 Engine principles (the contract every rule follows)

1. **Pure.** `(state, input) → (state', events)`. No I/O, no globals, no time, no randomness except the seeded RNG streams in the state.
2. **JSON-only state.** Plain objects, arrays, strings, numbers, booleans and `null`. No `Map`, `Set`, `Date`, class instances, `undefined` or `NaN`. A round-trip test enforces this.
3. **Integers only.** Stats, damage, costs and AP are integers, with explicit rounding helpers (`ceilDiv`, `percentCeil`). For example, Sabrina's ×1.2 gives 24/60/120 (D-B4).
4. **Deterministic order.** Simultaneous things resolve active player first, then by creation order (D-T10). Collections are sorted by stable keys before iteration. Object key order and `Array.prototype.sort` are deterministic in modern JavaScript.
5. **Intents in, events out.**
   - `check` never mutates.
   - Resolvers emit events, and a reducer applies each event to an Immer draft.
   - The same intent on the same state always produces the same events.
6. **Judge legality on the actor's knowledge** (D-F8, netcode §7.2). `check` uses only what the acting player can see. A conflict with hidden state is **resolved as an event, never a rejection**. Otherwise the rejection itself leaks information. Example: a path that bumps an unseen unit stops there and still spends the AP (D-M4).
7. **Derive, don't store.** Effective stats, auras, building bonuses and visibility are computed from content plus state when needed. Only facts are stored: positions, damage taken, statuses with expiry, cooldowns, per-turn usage.
8. **Content is injected.** `createEngine(contentPack)`; the engine imports no real content. Tests use tiny synthetic packs.
9. **Hidden information is a projection concern.** The engine always has full state. `project(state, p)` produces what p may know. During a networked match, no `GameState` leaves the host.
10. **Every rules default is data.** Each default in §10.2 is a `RulesConfig` field or a content field, never an inline constant. When the owner answers a question, the change is a data edit plus a test update.
11. **Players, not seats.** The engine speaks of `PlayerId = 'p1' | 'p2'`, as the rules doc does. The session maps host and guest to P1 and P2.
    - Netcode §7.2 types its engine sketch by `Seat`. The mapping keeps the engine usable for hot-seat play, AI and server mode, where "host" means nothing.

### 5.3 Intent lifecycle

```
intent ─► gate ─► check ─► resolve ───────────────────────────► settle ────────────► { state', events[] }
           │        │        │                                    │
   phase/turn/   rules on   emit(event) reduces it into the     state-based loop until stable:
   player gate   actor's    draft and queues matching triggers  deaths → victory → capture (when due)
                 knowledge  (FIFO, depth guard 64); movement     → stealth/reveal → vision;
                            resolved step by step               choices queued as PendingPrompt
```

- **Gate.**
  - Battle intents come only from the active player.
  - Setup intents come from either player while the phase allows them.
  - `decide` comes only from the addressed player.
  - Nothing is accepted after `result` is set.
- **Check** returns `{ ok: true }` or a `RuleViolation { code, message, details }`.
  - The UI calls the same function on the `PlayerView` to grey out buttons and explain why: "Not enough AP: needs 3, has 2".
- **Resolve.** Each intent kind has a resolver that gets a `ResolveCtx` with `emit`, `damage`, `heal`, `step`, `summon`, `prompt`, `rng` and `query`.
- **Movement is resolved one step at a time**, because three rules depend on the path:
  - L101: a mine "explodes when any unit steps on it".
  - L81: stealth breaks "when it's 1 square away from an enemy unit".
  - L82: Assault fires "When an enemy unit comes into the melee range".

  Each step emits `unitStepped`, then mine triggers on the entered square, then reactions. Movement stops early on death, damage or bumping an unseen unit, with `movementInterrupted { reason }`; the full AP stays spent (D-M4).
- **Choices.** Netcode §7.14 builds prompts; D-T11 prefers standing settings. The engine supports both:
  - **Standing choices** (default, per D-T11) live in `PlayerState.preferences`, e.g. "Queso: auto-revive". They are set during army selection or at any time with a `set_preference` intent.
  - **Prompts** are used only when no standing choice applies. The engine parks the subject explicitly (for example a `dying` status), finishes the intent, and appends a `PendingPrompt` to `state.pending`. No closures are stored, so the state stays serialisable.
  - While a prompt is pending, only `decide` from the addressed player is accepted, and that may be the non-active player.
  - Every answer is logged like any intent, which keeps replays exact. Netcode's `resolvePrompt` is sugar for `apply(state, p, { k: 'decide', ... })`.
- **Settle.** Follows D-T9 and D-H4:
  - Deaths are checked after every effect.
  - End of turn runs damage → healing → capture → expiries → victory → next turn.
  - Commander death means an immediate loss; both in the same event is a draw (D-K4).
  - A goal-row win counts after the action fully resolves, deaths first (D-K5).

### 5.4 Effective stats, toughness and the damage pipeline

**Effective stats.** `effectiveStats(state, unit)` applies layers in a fixed order:
1. base stats (content);
2. commander modifiers (L124–L130);
3. building modifiers for the controller (L52 Keep +3 power, L53 Market +1 action for type 1);
4. auras (L86 Priestess, L120 Command Aura, L129 Ratasius);
5. temporary statuses.

Within a layer, `set` applies before `add`, and `add` before `mulPercent`. Same-named auras count once (D-C8).

**Toughness.**
- Store `damage` (persistent, per L19) and `maxToughnessDelta` (permanent changes such as L130 Queso's revive cost).
- Current = effective max − damage.
- Toughness bonuses raise max and current together, and losing a bonus can kill (D-H3).
- Healing caps at the effective max, or at "base" where the text says so (L87 "but no more than units base hp").

**Damage pipeline.** One ordered list in `RulesConfig.damagePipeline`, following D-C5 and D-C6. Every modifier declares its stage:

| Stage | Effect | Examples |
|---|---|---|
| `base` | Attacker's current power for attacks; the fixed amount for ability damage. Power bonuses don't raise fixed damage (D-C7) | L116 Smite 8, L110 slam 10/3 |
| `attackerBonus` | + extra damage | L67 Fierce attacker |
| `attackerPenalty` | − attacker-side penalties, floor 0 | L129 Ratasius weakness −4 |
| `targetReduction` | − target-side reductions (per-modifier floors such as "not below 1") | L64 Line Formation −2, L95 Reinforced Armor −3, L106 Forcefield −8 |
| `defend` | Halve, rounding up | L15 "half the damage rounded up" |
| `minimum` | At least 1 if the result after the attacker-side stages was ≥ 1; 0 stays 0 | L15 "(never less than one)", D-C6 |

The order is a rules default (D-C5, Medium) and changing it is a one-line config edit (§8.2 shows the test that pins it). Every `damaged` event carries the `breakdown` (stage, source, delta). The log and tooltips show it, so players learn the rules and developers can debug them.

### 5.5 Fog of war: data, not paint (L17)

- **Vision.** `visibleSquares(state, p)` is the union, over each of p's units (commander and summons included, D-F4), of a **Manhattan flood fill** of radius LOV from every footprint square.
  - Blocker and building squares are seen, but the fill doesn't pass through them (D-F2).
  - Units don't block vision (D-F3).
  - In open ground, LOV N covers 2N(N+1) squares: 4, 12, 24, 40, 60, 84 for N = 1–6. That matches L37: "A LOV of 1 will only show the 4 orthogonal adjacent squares. A LOV of 2, will show 12 squares around the unit".
- **Seeing an entity.** Its footprint must touch p's vision, **and** it must not be invisible unless something reveals it (D-F7). Reveals: L90/L98 Mind's Eye in LOV, L129 Ratasius within 3, and L81's stealth-break conditions.
- **`project(state, p)`** returns a `PlayerView` with:
  - the public map, blockers, buildings and their control (D-F5);
  - p's own units, mines, zones and preferences in full;
  - enemy units only when visible, and then only their public fields (no cooldowns, per-turn usage or hidden statuses);
  - enemy mines only when revealed;
  - zones only where they touch visible squares;
  - **no opponent AP** (D-F9);
  - no opponent army list until the game ends; commanders are revealed when deployment starts (D-B9);
  - prompts only if addressed to p.
- **Events per player.** `projectEvents(events, p, before, after)` filters with an audience hint each event carries from emit time:
  - `all`: turn boundaries, building control, game over.
  - `player`: private to one side.
  - `squares`: visible to the opponent only if one of those squares was visible to them.

  Enemy moves are cut at the vision boundary into `unitAppeared` / `unitVanished`. The log and animations then make sense without revealing the hidden part of a path.
- **The snapshot is the truth.** Updates carry the view (or a patch plus `viewHash`, per netcode §7.9); events only drive animations and the log. A filtering bug can at worst produce a wrong animation, never a desync. Views are about 10–30 KB of JSON at this board size.
- **Identity under fog** (T-40). Unit ids are opaque, drawn from a dedicated seeded stream rather than `u1, u2, ...`. Seeing an enemy id therefore reveals nothing about army size or summons. Stable ids do reveal that a unit seen twice is the same unit; accepted for v1.
- **Host honesty.** The host's machine holds `GameState`, but its UI only renders `project(state, host)`. Peeking needs devtools. Accepted (netcode §6.3).

### 5.6 Intent log, replay, take-back and reconnection

- **Record.** `MatchRecord = { setup, log: LoggedIntent[] }`, where `LoggedIntent = { seq, by, intent, hashAfter }`.
  - `by` can be `'system'` for session-supplied facts such as the commit-reveal coin flip result (netcode §7.15).
  - `replay(setup, log)` folds `apply`. Because the engine is deterministic and the RNG lives in the state, replay reproduces the exact state, and `hashAfter` (FNV-1a over canonical JSON) proves it.
- **Cost.** A 300-intent game replays in milliseconds. The host also keeps an in-memory snapshot at each turn start, so take-back only replays the current turn.
- **Take-back (L39).** Defaults per D-R1–D-R4 and netcode §7.13:
  - A player may undo their own actions back to any point in their latest turn, until the opponent acts. That includes `end_turn` if the opponent hasn't acted yet.
  - One request at a time.
  - The opponent sees what the undone actions revealed about their side and may decline.
  - On acceptance the host truncates the log and replays, and both sides get a fresh snapshot.
  - `RulesConfig.takeback` holds the scope and the lobby limit.
- **Reconnection.** The host saves `MatchRecord` to IndexedDB after every intent (it's tiny), so a reload restores by replay. The guest reconnects with backoff and receives a snapshot (netcode §7.11).
- **Free features:** saved games, post-game full-information replays (netcode §7.16), golden regression tests (§8.4), and reproducible bug reports ("copy match file").

### 5.7 Serialisation and versioning

- **Wire format: plain JSON.** Trystero serialises objects itself. Binary formats aren't needed at this size.
- **Canonical JSON** (sorted keys) for hashes.
- **Versions.**
  - `GameState.schemaVersion` describes the data shape.
  - `RULES_VERSION` is an integer bumped on any rules change. The `hello` handshake carries it with the build's git SHA (netcode §7.17).
  - **CI guard:** a test hashes the content pack and `RulesConfig`, and fails if that hash changed without a `RULES_VERSION` bump. This keeps the integer honest.
- **Saved games and replays** carry the build and `RULES_VERSION`. A mismatch on load means "replay with a warning". v1 has no migrations.
- **Every input from outside is parsed with `zod/mini` at the boundary:** network messages, imported army codes, saved files. The engine re-checks intents anyway.

### 5.8 Content as declarative tables

- **Format.** TypeScript modules exporting plain objects through `defineUnit`, `defineAbility`, `defineCommander`, `defineBuilding` and `defineScenario`. They're type-checked, autocompleted and commentable, and can be exported to JSON for modding later.
- **Units** keep the stats in L57's order ("Name, Power/Toughness, Size, LOV, Movement, AP").
  - They add `grade`, `variant` (L5 "each unit has 2 variations"), `faction`, `cost` (defaults to grade, D-B1) and `deployment` (`normal` or `extended`; extended is on for types 1–2 per D-P2).
  - Plus an attack profile (default reach: Manhattan 1, the 4 orthogonal squares, D-G4), abilities and a symbol.
- **Abilities** are passive (modifiers and triggers) or active (AP cost, cooldown, requirements, targeting, effects).
  - The effect vocabulary is small: `damage`, `heal`, `applyStatus`, `removeStatus`, `summon`, `placeMine`, `createZone`, `sacrifice`, `reveal`, `grantAction`, `grantExtraAttack`, `freeAttack`.
  - Anything that doesn't fit names a coded handler, for example `{ handler: 'forcefulSlam' }` for L110 "3 damage to the 5 opposite adjacent squares of the target". Handlers live in `engine/src/effects/handlers/`, each with its own tests.
- **Limits** are data:
  - L99 "A maximum of 3 dummies ... Every two artificers beyond the first one increase this limit by 1" becomes `{ base: 3, perExtra: { type: 'lojrar.artificer', beyond: 1, every: 2, add: 1 } }`, which is 3 + floor(max(0, n−1)/2).
  - L101's mines: 5 + max(0, n−1).
- **Commanders.**
  - The base is L32's commander: "a 1/1 unit, movement and AP of 1, LOV of 3, and doesn't count from the budget".
  - Each commander adds stat overrides (Trill toughness 10; Ratasius LOV 6; Queso AP 3 and toughness 3), global modifiers, ability grants and revocations (Sabrina: no mines), and cost modifiers (Sabrina ×1.2).
- **Factions.** Just a field. Adding one (L43) means a new module plus art, with no engine change. v1 ships Lojrar only (D-B6).
- **A content test** schema-checks every definition. It also checks that references resolve, ids are unique and translation keys exist, and that every ability is tagged in at least one test (§8.5).

```ts
// packages/content/src/factions/lojrar.ts (excerpt; values from SPEC.md)
export const footman = defineUnit({
  id: 'lojrar.footman', faction: 'lojrar', grade: 1, variant: 'a',
  stats: { power: 1, toughness: 2, size: 1, lov: 1, movement: 1, ap: 1 },          // L63
  deployment: 'extended', abilities: ['lineFormation'], symbol: 'footman',         // D-P2: types 1–2
});
export const lineFormation = defineAbility({                                       // L64
  id: 'lineFormation', kind: 'passive',
  modifiers: [{
    selector: { kind: 'self' }, stat: 'incomingDamage', op: 'add', value: -2, stage: 'targetReduction', floor: 1,
    condition: { kind: 'count', atLeast: 2,
      of: { around: 'self', range: 1, metric: 'chebyshev' /* "adjacent" = 8 squares, D-G3 */,
            relation: 'ally', filter: { typeIds: ['lojrar.footman'] }, includeSelf: false } },
  }],
});
export const ranger = defineUnit({
  id: 'lojrar.ranger', faction: 'lojrar', grade: 2, variant: 'b',
  stats: { power: 3, toughness: 1, size: 1, lov: 3, movement: 1, ap: 1 },          // L73
  attack: { range: 2, metric: 'manhattan', ranged: true },                          // L74, D-G2
  deployment: 'extended', abilities: ['rangedAttack'], symbol: 'ranger',
});
export const perseverance = defineAbility({                                        // L71
  id: 'perseverance', kind: 'passive',
  triggers: [{ on: 'turnEnded', whose: 'owner', effects: [{ kind: 'heal', amount: 1, target: 'self', cap: 'max' }] }],
});
export const stealth = defineAbility({                                             // L81
  id: 'stealth', kind: 'active', apCost: 1,
  requires: { kind: 'not', c: { kind: 'inEnemyVision' } },
  targeting: { kind: 'none' },
  effects: [{ kind: 'applyStatus', status: 'stealth', target: 'self', duration: { until: 'removed' } }],
  // Break conditions live with the status in engine/src/rules/stealth.ts.
});
export const assault = defineAbility({                                             // L82
  id: 'assault', kind: 'passive',
  triggers: [{ on: 'enemyEnteredRange', range: 1, metric: 'manhattan' /* melee reach, D-G4 */, whose: 'any',
               condition: { kind: 'hasStatus', status: 'stealth' },
               effects: [{ kind: 'freeAttack', target: 'triggeringUnit' }] }],
});
export const commandAura = defineAbility({                                         // L120
  id: 'commandAura', kind: 'passive',
  modifiers: [{ selector: { kind: 'aura', range: 2, metric: 'manhattan', relation: 'ally', includeSelf: false },
                stat: 'actionsPerTurn', op: 'add', value: 1 }],                     // still 1 Move (D-T5)
});
export const forcefulSlam = defineAbility({                                        // L110: coded handler
  id: 'forcefulSlam', kind: 'active', apCost: 4, cooldown: 1,
  targeting: { kind: 'square', range: 1, metric: 'chebyshev' },
  effects: { handler: 'forcefulSlam' },
});

// packages/content/src/buildings.ts
export const keep = defineBuilding({ id: 'keep', footprint: 2, model: 'keep.glb', symbol: 'keep',       // L52
  controllerModifiers: [{ selector: { kind: 'global', relation: 'ally' }, stat: 'power', op: 'add', value: 3 }] });
export const market = defineBuilding({ id: 'market', footprint: 2, model: 'market.glb', symbol: 'market', // L53
  controllerModifiers: [{ selector: { kind: 'global', relation: 'ally', filter: { grades: [1] } },
                          stat: 'actionsPerTurn', op: 'add', value: 1 }] });

// packages/content/src/commanders.ts
export const trill = defineCommander({ id: 'trill', statOverrides: { toughness: 10 },                     // L124
  modifiers: [{ selector: { kind: 'global', relation: 'ally', filter: { grades: [1, 2, 5] } },
                stat: 'toughness', op: 'add', value: 2 }] });
```

### 5.9 Net layer (aligned with research-netcode.md)

The netcode analysis owns transports, the protocol, NAT traversal and the session lifecycle. This section only fixes what the architecture needs.

- **Topology.**
  - Host-authoritative, with exactly two seats (L135 "assume that only another player will play").
  - The lobby creator runs `HostSession`: engine, intent log, persistence, take-back, prompts.
  - **Both UIs talk to one `MatchClient` interface.** The host's UI connects to `HostSession` through the `loopback` transport, so host and guest run the same client code paths.
- **Transports** (netcode §7.3):
  - `p2p`: Trystero 0.26.x with Nostr signalling. Primary.
  - `relay`: a Cloudflare Worker + Durable Object. Phase 2 fallback, and later the server-authority path.
  - `loopback`: host UI ↔ host session, and unit tests.
  - `tabs`: BroadcastChannel between two tabs, for local development and end-to-end tests.
  - A PeerJS adapter stays possible as plan C.
- **Development tip** (netcode §0): plain `http://192.168.x.x` isn't a secure context, so `crypto.subtle` is missing and Trystero fails there. Develop on `localhost`, or use the `tabs` transport.
- **TURN** (netcode §3.1): an optional Metered free key, or Cloudflare TURN once a Worker exists. The game's traffic is tiny.
- **Invite link** (netcode §7.4): `#/join/<roomId>/<secret>`. The fragment never reaches the HTTP server, and hash routing works on GitHub Pages without rewrites.
- **Messages** (netcode §7.6): `hello`, `welcome`, `intent`, `intent_result`, `update` (events + view patch + `viewHash`), `snapshot`, `prompt` / `prompt_reply`, `takeback_req` / `takeback_res`, `commit` / `coin_reveal`, `game_over`, `audit`, `ping` / `pong`.
  - Every inbound message is validated with zod and size-capped.
  - `by` comes from the channel's seat, never from the payload.
  - Player names are plain text.
- **Engine functions the session uses:** `createMatch`, `check`, `apply`, `project`, `projectEvents`, `replay`, `hash`. They match netcode §7.2, with `resolvePrompt` = `apply` with `decide`.
- **Privacy.** WebRTC reveals each player's IP address to the other, which is normal for P2P. The relay transport hides it.

### 5.10 UI layer

**Screens** (L21–L26 plus the match):

| Screen | Contents |
|---|---|
| Main menu | Play (create lobby), Join (paste link or code), Armies, Achievements, Settings, Codex, Sandbox |
| Lobby | Invite link (copy, Web Share, optional QR); seats and connection badge; host settings: budget (L27), take-back policy, scenario; version check; "Keep this tab open" notice |
| Army selection | Pick a saved army, or **New army**, which opens the same ArmyBuilder component as the menu (L26). Budget meter priced with the chosen commander (Sabrina's ×1.2). Validation messages, including "army doesn't fit the zones" (D-B3). Standing preferences. Ready toggle |
| Deployment | Normal and extended zone highlights. Place, move or remove units; unplaced list; confirm (simultaneous and hidden, D-P3) |
| Match | Board plus HUD: turn banner, AP meter (own AP only, D-F9), End Turn; selected unit card with effective stats and breakdown tooltips; action bar (Move, Attack, Defend, abilities with AP costs and disabled reasons from `check`); event log; take-back request and answer dialogs; prompts; mine warning; resign |
| Post-game | Result, stats, full replay viewer, achievements unlocked, rematch, save match file |
| Achievements, Settings, Codex | Settings: default camera, iso style, animation speed, mine warning, connection mode, language. Codex: unit cards generated from the content tables |

**Stores** (zustand 5):

| Store | Holds | Persistence |
|---|---|---|
| `session` | Transport status, seat, room, round-trip time, errors | none |
| `match` | Current and previous view, event and animation queue, take-back state | none (the host session persists) |
| `ui` | Selection, hover, targeting mode, panels | none |
| `settings` | Camera, isometric style, mine warning, animation speed, language | `persist` to localStorage |
| `collection` | Saved armies, match files, achievement progress | IndexedDB via `idb-keyval` |

**Other parts.**
- **Controller.** `apps/web/src/controller/` is a pure reducer (idle → unit selected → targeting(action) → confirm). It turns renderer intents into engine intents using engine helpers on the `PlayerView` (`reachable`, `legalActions`, `previewDamage`), and is unit-tested in Node.
  - The L102 mine warning lives here: the path planner avoids your own known mines, and crossing one asks for confirmation, unless `settings.warnOnOwnMines` is off.
- **Routing.** wouter 3.13 with hash location: `#/`, `#/armies`, `#/join/:room/:secret`, `#/host/:room`, `#/match`.
- **Styling.** CSS Modules plus CSS custom properties as design tokens (palette from `research-art/palettes.json`). `radix-ui` primitives for dialogs, popovers, tooltips, tabs and toasts, for focus management and accessibility.
- **Translations.** Every string is a key in `content/i18n/en.ts` from day one.
- **Achievements** (L24) are defined as data, evaluated after each game over the full replay, and stored locally (T-07).

### 5.11 Renderer contract

```ts
// apps/web/src/render/contract.ts
export interface BoardSceneProps {
  view: PlayerView;                       // the truth to show once animations settle
  prevView: PlayerView | null;            // where animations start
  events: readonly VisibleEvent[];        // what happened between prevView and view
  overlay: {
    selected: UnitId | null;
    hover: Square | null;
    highlights: readonly { squares: readonly Square[]; style: 'move' | 'attack' | 'ability' | 'deploy' | 'danger' }[];
    pathPreview: readonly Square[] | null;
    areaPreview: readonly Square[] | null;
  };
  camera: { mode: 'top' | 'iso'; isoStyle: 'true' | 'dimetric'; rotation: 0 | 1 | 2 | 3 };
  onIntent(i: RenderIntent): void;
}
export type RenderIntent =
  | { kind: 'hoverSquare'; square: Square | null }
  | { kind: 'clickSquare'; square: Square; button: 'primary' | 'secondary' }
  | { kind: 'clickUnit'; unit: UnitId; button: 'primary' | 'secondary' }
  | { kind: 'animationsSettled'; seq: number };
```

- The renderer imports engine **types** and `board/geometry` helpers (square ↔ world, footprints) only. It never resolves rules or talks to the network.
- Anything implementing this contract can replace the R3F scene: A2's imperative three class, or an SVG debug renderer (§11 S-8).

---

## 6. Folder layout

```
BoardGame Project/
├─ package.json                  # pnpm workspaces; scripts: dev, build, test, e2e, lint, typecheck, size
├─ pnpm-workspace.yaml
├─ tsconfig.base.json            # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├─ vitest.config.ts              # test.projects (engine, content, net, web)
├─ playwright.config.ts          # SwiftShader launch flags for WebGL
├─ eslint.config.js              # determinism bans in packages/engine (§9)
├─ .dependency-cruiser.cjs       # layer rules from §5.1
├─ .github/workflows/ci.yml      # typecheck, lint, test+coverage, build, size gate, e2e, deploy Pages
├─ docs/
│  ├─ SPEC.md
│  └─ analysis/                  # rules-lawyer.md, research-netcode.md, research-art/, research-framework.md
├─ packages/
│  ├─ engine/                    # @game/engine: pure, deterministic, no DOM
│  │  ├─ package.json            # runtime dependency: immer only
│  │  ├─ tsconfig.json           # "lib": ["ES2023"], "types": []
│  │  ├─ src/
│  │  │  ├─ index.ts             # createEngine + public types
│  │  │  ├─ types/               # core, content, rules, state, intents, events, view
│  │  │  ├─ board/               # geometry.ts (mask, metrics, footprints), pathing.ts (BFS), vision.ts (flood fill)
│  │  │  ├─ rules/               # gate, check/*, resolve/* (move, attack, defend, ability, endTurn, army, deploy),
│  │  │  │                       #   stats, damage, triggers, statuses, stealth, objectives, victory, prompts, turn
│  │  │  ├─ effects/             # primitives.ts + handlers/ (forcefulSlam, sharedWounds, julioVernification, ...)
│  │  │  ├─ view/                # project.ts, projectEvents.ts, query.ts (WorldQuery over state or view)
│  │  │  ├─ log/                 # replay.ts, snapshots.ts, takeback.ts, summary.ts
│  │  │  ├─ rng.ts               # sfc32; separate streams for game and ids
│  │  │  └─ serialize.ts         # canonical JSON, FNV-1a hash, schemaVersion
│  │  └─ test/
│  │     ├─ dsl.ts               # scenario(), intent builders, custom matchers
│  │     ├─ board/  rules/  abilities/  commanders/  objectives/  view/  log/
│  │     ├─ properties/          # fast-check invariants and random playouts
│  │     └─ golden/              # *.replay.json + golden.test.ts
│  ├─ content/                   # @game/content: declarative tables
│  │  └─ src/
│  │     ├─ index.ts             # contentPack, RULES_VERSION
│  │     ├─ rules.ts             # defaultRules: RulesConfig (every §10.2 default lives here)
│  │     ├─ factions/lojrar.ts   # 14 units + their abilities (L62–L120)
│  │     ├─ factions/empire.ts   # placeholder until the roster exists (L59)
│  │     ├─ commanders.ts        # six commanders (L124–L130)
│  │     ├─ buildings.ts         # keep, market (L52–L53)
│  │     ├─ scenarios/standard.ts# Rule A mask, zones, Keep/Market placement (D-O6)
│  │     ├─ i18n/en.ts           # names, ability texts, log templates
│  │     └─ content.test.ts
│  └─ net/                       # @game/net: sessions, protocol, transports (no React)
│     └─ src/
│        ├─ protocol.ts          # message types + zod schemas (netcode §7.6)
│        ├─ transport/           # types.ts, trystero.ts, relay.ts (phase 2), loopback.ts, tabs.ts, peerjs.ts (plan C)
│        ├─ session/             # host.ts (authority), guest.ts, client.ts (MatchClient), takeback.ts, commitReveal.ts
│        ├─ persistence.ts       # MatchRecord save/restore (storage injected; IndexedDB in the app)
│        └─ *.test.ts
├─ apps/
│  └─ web/                       # Vite 8 + React 19: UI layer + renderer layer
│     ├─ index.html
│     ├─ vite.config.ts          # base './', lazy board chunk, build SHA define
│     ├─ public/
│     │  ├─ models/              # keep.glb, market.glb (gltf-transform optimised)
│     │  ├─ icons/               # unit and building symbols (SVG)
│     │  └─ CREDITS.md           # asset licences and attributions
│     └─ src/
│        ├─ main.tsx  App.tsx  routes.tsx       # wouter + hash location
│        ├─ state/               # zustand: session, match, ui, settings, collection
│        ├─ controller/          # pure interaction reducer: render intents -> engine intents
│        ├─ screens/             # MainMenu, Armies, ArmyBuilder, Lobby, Deployment, Match, PostGame,
│        │                       #   Achievements, Settings, Codex, Sandbox
│        ├─ components/          # UnitCard, ActionBar, ApMeter, TurnBanner, EventLog, TakebackDialog,
│        │                       #   PromptDialog, MineWarning, InviteLink, ConnectionBadge, Toasts
│        ├─ render/
│        │  ├─ contract.ts
│        │  ├─ r3f/              # BoardScene, CameraRig, BoardMesh, FogLayer, Tokens, Token, Buildings,
│        │  │                    #   Highlights, Zones, Effects, picking.ts, animation/
│        │  └─ debug-svg/        # optional 2D renderer on the same contract (§11 S-8)
│        ├─ achievements/        # definitions + evaluator over GameSummary
│        ├─ i18n/                # t() and locale loading
│        └─ styles/              # tokens.css, *.module.css
└─ e2e/
   ├─ two-players.spec.ts        # host and guest pages, tabs transport
   └─ visual.spec.ts             # top and iso screenshots of a fixed scenario
```

The project folder is not a git repository yet. `git init` and a GitHub repository are step 1 of M0, because GitHub Pages and CI depend on them.

---

## 7. Key TypeScript types (sketch)

These are sketches: they compile in spirit, and names may change during M1.

### 7.1 Identifiers and geometry

```ts
// packages/engine/src/types/core.ts
export type PlayerId = 'p1' | 'p2';                       // rules terms (D-G1); the session maps host/guest
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };
export type UnitId      = Brand<string, 'UnitId'>;        // opaque, from the seeded id stream
export type EntityId    = Brand<string, 'EntityId'>;      // mines, zones
export type UnitTypeId  = Brand<string, 'UnitTypeId'>;    // 'lojrar.footman'
export type AbilityId   = Brand<string, 'AbilityId'>;     // 'lineFormation'
export type CommanderId = Brand<string, 'CommanderId'>;   // 'trill'
export type FactionId   = Brand<string, 'FactionId'>;     // 'lojrar'
export type BuildingId  = Brand<string, 'BuildingId'>;    // 'keep' | 'market'
export type HandlerId   = Brand<string, 'HandlerId'>;     // coded effect handler
export type PromptId    = Brand<string, 'PromptId'>;

/** 0-based. x = column from P1's left (A = 0), y = row from P1's back row (row 1 = 0). */
export interface Square { readonly x: number; readonly y: number }
export type Metric = 'manhattan' | 'chebyshev';
export type Grade = 1 | 2 | 5 | 10 | 20 | 50 | 100;      // L5 "1, 2, 5, 10, 20, 50, 100"
```

### 7.2 Content and rules configuration

```ts
// packages/engine/src/types/content.ts
export interface UnitStats {                               // L57 order
  readonly power: number; readonly toughness: number; readonly size: 1 | 2;
  readonly lov: number; readonly movement: number; readonly ap: number;
}
export interface AttackProfile { readonly range: number; readonly metric: Metric; readonly ranged: boolean }

export interface UnitDef {
  readonly id: UnitTypeId; readonly faction: FactionId;
  readonly grade: Grade;                    // type = denomination = default cost (D-B1)
  readonly variant: 'a' | 'b';              // L5 "each unit has 2 variations"
  readonly cost?: number;                   // only when it differs from grade
  readonly stats: UnitStats;
  readonly attack?: AttackProfile;          // default { range: 1, metric: 'manhattan', ranged: false } (D-G4)
  readonly deployment: 'normal' | 'extended' | 'never';   // 'never' for created units (No-ACB)
  readonly abilities: readonly AbilityId[];
  readonly tags?: readonly string[];        // 'created', 'immobile', 'white' (D-B8), ...
  readonly symbol: string;                  // asset key for the token face
}

export type Relation = 'ally' | 'enemy' | 'any';
export interface UnitFilter {
  readonly typeIds?: readonly UnitTypeId[]; readonly excludeTypeIds?: readonly UnitTypeId[];
  readonly grades?: readonly Grade[]; readonly minGrade?: Grade; readonly tags?: readonly string[];
}
export type Selector =
  | { readonly kind: 'self' }
  | { readonly kind: 'aura'; readonly range: number; readonly metric: Metric; readonly relation: Relation;
      readonly includeSelf: boolean; readonly filter?: UnitFilter }
  | { readonly kind: 'global'; readonly relation: Relation; readonly filter?: UnitFilter };

export type StatKey = keyof UnitStats | 'actionsPerTurn' | 'movesPerTurn' | 'attackRange' | 'cost' | 'grade'
  | 'incomingDamage' | 'outgoingDamage' | 'actionApSurcharge';
export type DamageStage = 'base' | 'attackerBonus' | 'attackerPenalty' | 'targetReduction' | 'defend' | 'minimum';

export interface CountSpec {
  readonly around: 'self' | 'target'; readonly range: number; readonly metric: Metric;
  readonly relation: Relation; readonly filter?: UnitFilter; readonly includeSelf: boolean;
}
export type Amount = number | { readonly count: CountSpec; readonly times: number };
export type ConditionSpec =
  | { readonly kind: 'count'; readonly of: CountSpec; readonly atLeast: number }
  | { readonly kind: 'hasStatus'; readonly status: StatusKind }
  | { readonly kind: 'inEnemyVision' }
  | { readonly kind: 'actionIndexAtLeast'; readonly n: number }     // L117 Holy Fervor surcharge
  | { readonly kind: 'not'; readonly c: ConditionSpec }
  | { readonly kind: 'all' | 'any'; readonly cs: readonly ConditionSpec[] };

export interface ModifierSpec {
  readonly selector: Selector; readonly stat: StatKey;
  readonly op: 'add' | 'set' | 'mulPercent'; readonly value: Amount;
  readonly stage?: DamageStage;              // required for incoming/outgoingDamage
  readonly floor?: number;                   // "not below 1"
  readonly rounding?: 'ceil' | 'floor';      // for mulPercent
  readonly condition?: ConditionSpec;
}

export type TriggerOn = 'turnStarted' | 'turnEnded' | 'unitStepped' | 'enemyEnteredRange'
  | 'damageTaken' | 'unitDied' | 'unitCreated';
export interface TriggerSpec {
  readonly on: TriggerOn; readonly whose?: 'owner' | 'opponent' | 'any';
  readonly range?: number; readonly metric?: Metric;
  readonly condition?: ConditionSpec;
  readonly effects: readonly EffectSpec[] | { readonly handler: HandlerId };
}

export type EffectTarget = 'self' | 'chosen' | 'triggeringUnit' | { readonly area: Selector };
export type Duration =
  | { readonly until: 'removed' | 'endOfTurn' | 'ownerNextTurnStart' }
  | { readonly until: 'turns'; readonly n: number };                 // D-T8
export interface LimitSpec {
  readonly base: number;
  readonly perExtra?: { readonly type: UnitTypeId; readonly beyond: number; readonly every: number; readonly add: number };
}
export type EffectSpec =
  | { readonly kind: 'damage'; readonly amount: Amount; readonly target: EffectTarget }
  | { readonly kind: 'heal'; readonly amount: Amount; readonly target: EffectTarget; readonly cap: 'max' | 'base' }
  | { readonly kind: 'applyStatus'; readonly status: StatusKind; readonly duration: Duration; readonly target: EffectTarget }
  | { readonly kind: 'removeStatus'; readonly status: StatusKind; readonly target: EffectTarget }
  | { readonly kind: 'summon'; readonly unit: UnitTypeId; readonly limit?: LimitSpec }
  | { readonly kind: 'placeMine'; readonly damage: number; readonly bonusIfSizeAtLeast2: number; readonly limit?: LimitSpec }
  | { readonly kind: 'createZone'; readonly w: number; readonly h: number; readonly duration: Duration;
      readonly triggers: readonly TriggerSpec[] }
  | { readonly kind: 'sacrifice'; readonly target: EffectTarget }
  | { readonly kind: 'reveal'; readonly area: Selector }
  | { readonly kind: 'grantAction'; readonly target: EffectTarget }
  | { readonly kind: 'grantExtraAttack'; readonly apCost: number; readonly oncePerTurn: boolean }   // L78 Savagery
  | { readonly kind: 'freeAttack'; readonly target: EffectTarget };

export type TargetingSpec =
  | { readonly kind: 'none' }
  | { readonly kind: 'square'; readonly range: number; readonly metric: Metric; readonly mustBeEmpty?: boolean }
  | { readonly kind: 'unit'; readonly range: number; readonly metric: Metric; readonly relation: Relation }
  | { readonly kind: 'squares'; readonly count: number; readonly shape: 'connected'; readonly within: 'lov' };  // L106

interface AbilityBase { readonly id: AbilityId }
export interface PassiveAbilityDef extends AbilityBase {
  readonly kind: 'passive'; readonly modifiers?: readonly ModifierSpec[]; readonly triggers?: readonly TriggerSpec[];
}
export interface ActiveAbilityDef extends AbilityBase {
  readonly kind: 'active';
  readonly apCost: number;                   // replaces the unit's AP for this action (D-A4)
  readonly cooldown?: number;                // "can't be used on your next N turns" (D-T7)
  readonly requires?: ConditionSpec;
  readonly targeting: TargetingSpec;
  readonly effects: readonly EffectSpec[] | { readonly handler: HandlerId };
}
export type AbilityDef = PassiveAbilityDef | ActiveAbilityDef;

export interface CommanderDef {
  readonly id: CommanderId;
  readonly statOverrides?: Partial<UnitStats>;                    // on top of rules.commanderBase (L32)
  readonly modifiers?: readonly ModifierSpec[];
  readonly abilities?: readonly AbilityId[];
  readonly grants?: readonly { readonly to: UnitFilter; readonly ability: AbilityId }[];   // Kulega, Baba Yaga
  readonly revokes?: readonly { readonly from: UnitFilter; readonly ability: AbilityId }[]; // Sabrina: no mines
}
export interface BuildingDef {
  readonly id: BuildingId; readonly footprint: 2; readonly model: string; readonly symbol: string;
  readonly controllerModifiers: readonly ModifierSpec[];
}
export interface CornerCut { readonly radius: number; readonly mode: 'ruleA' | 'chamfer' | 'disc' | 'fillet' }
export interface ScenarioDef {
  readonly id: string;
  readonly board: { readonly size: number; readonly cornerCut: CornerCut };
  readonly blockers: readonly Square[];
  readonly buildings: readonly { readonly id: BuildingId; readonly anchor: Square }[];
  readonly deployment: Readonly<Record<PlayerId, { readonly normalRows: readonly number[]; readonly extendedRows: readonly number[] }>>;
  readonly goalRow: Readonly<Record<PlayerId, number>>;             // row a commander must reach (L32)
}
export interface RulesConfig {
  readonly budget: number;                                         // L27: 200
  readonly apPerTurn: number;                                      // D-A1: 10
  readonly apCarryOver: boolean;                                   // D-A1: false
  readonly movementMetric: Metric;                                 // D-M1: 'manhattan' (orthogonal steps)
  readonly visionMetric: Metric;                                   // D-F1: 'manhattan' (flood fill)
  readonly adjacencyMetric: Metric;                                // D-G3: 'chebyshev' (8 squares)
  readonly rangeMetric: Metric;                                    // D-G2: 'manhattan'
  readonly blockersBlockVision: boolean;                           // D-F2: true
  readonly actionsPerUnitPerTurn: number;                          // D-T4: 1
  readonly movesPerUnitPerTurn: number;                            // D-T5: 1
  readonly defend: { readonly rounding: 'ceil'; readonly lasts: 'ownerNextTurnStart'; readonly cancelledByAction: boolean };
  readonly damagePipeline: readonly DamageStage[];                 // D-C5
  readonly capture: { readonly range: 1; readonly metric: Metric; readonly evaluate: 'endOfEachTurn' };  // D-O3/O4
  readonly commanderBase: UnitStats;                               // L32: 1/1, size 1, LOV 3, movement 1, AP 1
  readonly takeback: { readonly scope: 'latestOwnTurnUntilOpponentActs'; readonly enabled: boolean; readonly perGame: number | null };
  readonly prompts: 'standingSettings' | 'prompt';                 // D-T11 vs netcode §7.14
  readonly hiddenInfo: { readonly opponentApVisible: boolean; readonly lastSeenMarkers: boolean };     // D-F9, D-F5
}
export interface ContentPack {
  readonly rulesVersion: number;
  readonly units: readonly UnitDef[]; readonly abilities: readonly AbilityDef[];
  readonly commanders: readonly CommanderDef[]; readonly buildings: readonly BuildingDef[];
  readonly scenarios: readonly ScenarioDef[]; readonly rules: RulesConfig;
}
```

### 7.3 State

```ts
// packages/engine/src/types/state.ts
export type Phase = 'armySelection' | 'deployment' | 'battle' | 'finished';
export interface MatchSetup {
  readonly seed: string;                       // host-generated; revealed only in the post-game audit
  readonly scenarioId: string;
  readonly players: Readonly<Record<PlayerId, { readonly name: string }>>;
  readonly rulesOverrides?: Partial<RulesConfig>;   // lobby settings, e.g. budget, take-back limit
}
export interface GameState {
  readonly schemaVersion: 1;
  readonly rulesVersion: number;
  readonly rules: RulesConfig;                 // resolved: pack rules + overrides
  readonly board: BoardState;
  readonly phase: Phase;
  readonly turn: { readonly number: number; readonly active: PlayerId; readonly apRemaining: number; readonly first: PlayerId | null };
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly units: Readonly<Record<string, UnitState>>;       // keyed by UnitId
  readonly mines: Readonly<Record<string, MineState>>;
  readonly zones: Readonly<Record<string, ZoneState>>;
  readonly buildings: Readonly<Record<string, BuildingState>>;
  readonly pending: readonly PendingPrompt[];
  readonly rng: { readonly game: RngState; readonly ids: RngState };
  readonly seq: number;                        // intents applied
  readonly result: MatchResult | null;
}
export interface BoardState { readonly size: number; readonly mask: string; readonly blockers: readonly Square[] }  // mask: '0'/'1' row-major from y = 0
export interface PlayerState {
  readonly army: ArmyList | null;              // secret until the game ends (D-B9)
  readonly deployed: boolean;
  readonly preferences: Readonly<Record<string, boolean>>;   // standing choices (D-T11)
  readonly takebacksUsed: number;
}
export interface UnitState {
  readonly id: UnitId; readonly type: UnitTypeId; readonly owner: PlayerId; readonly isCommander: boolean;
  readonly anchor: Square;                     // lowest x/y square of the size × size footprint (D-G6)
  readonly damage: number;                     // persists (L19)
  readonly maxToughnessDelta: number;          // permanent changes (L130)
  readonly statuses: readonly StatusInstance[];
  readonly cooldowns: Readonly<Record<string, number>>;     // AbilityId -> own turns left
  readonly usage: { readonly actions: number; readonly moves: number; readonly extraAttackUsed: boolean };
  readonly createdSeq: number;                 // deterministic tie-break order
  readonly createdBy: UnitId | null;
}
export type StatusKind = 'defending' | 'stealth' | 'forcefield' | 'weakness' | 'dying';
export interface StatusInstance { readonly kind: StatusKind; readonly source: string; readonly duration: Duration; readonly sinceTurn: number; readonly magnitude?: number }
export interface MineState { readonly id: EntityId; readonly owner: PlayerId; readonly square: Square; readonly placedBy: UnitId; readonly revealedTo: readonly PlayerId[] }
export interface ZoneState { readonly id: EntityId; readonly owner: PlayerId; readonly kind: string; readonly squares: readonly Square[]; readonly expiresAtTurn: number; readonly source: UnitId }
export interface BuildingState { readonly id: BuildingId; readonly anchor: Square; readonly controller: PlayerId | null }
export interface PendingPrompt { readonly id: PromptId; readonly player: PlayerId; readonly kind: string; readonly subject: string; readonly options: readonly string[]; readonly fallback: string }
export interface MatchResult { readonly winner: PlayerId | null; readonly reason: 'commanderKilled' | 'commanderReachedGoalRow' | 'concede' | 'abandon' | 'draw' }
export interface RngState { readonly s: readonly [number, number, number, number] }   // sfc32 state
```

### 7.4 Intents, results and the log

These are aligned with the intent part of netcode §7.6. Attacks and abilities target **squares**, so fogged or mined squares can be attacked (L101 "Mines can be triggered from distance by attacking the square with a ranged attack"; D-C3).

```ts
// packages/engine/src/types/intents.ts
export interface ArmyList {
  readonly faction: FactionId; readonly commander: CommanderId;
  readonly units: readonly { readonly type: UnitTypeId; readonly count: number }[];
}
export interface Placement { readonly slot: number; readonly anchor: Square }   // slot = index in the expanded army
export type PreferenceKey = 'quesoAutoRevive' | (string & {});

export type Intent =
  | { readonly k: 'submit_army'; readonly army: ArmyList }
  | { readonly k: 'submit_deployment'; readonly placements: readonly Placement[] }
  | { readonly k: 'set_preference'; readonly key: PreferenceKey; readonly value: boolean }
  | { readonly k: 'move'; readonly unit: UnitId; readonly path: readonly Square[] }   // explicit orthogonal path
  | { readonly k: 'attack'; readonly unit: UnitId; readonly target: Square }
  | { readonly k: 'defend'; readonly unit: UnitId }
  | { readonly k: 'ability'; readonly unit: UnitId; readonly ability: AbilityId; readonly targets?: readonly Square[] }
  | { readonly k: 'end_turn' }
  | { readonly k: 'decide'; readonly prompt: PromptId; readonly choice: string }    // netcode prompt_reply
  | { readonly k: 'concede' };
/** Facts supplied by the session, never by a player, e.g. the commit-reveal coin flip (netcode §7.15). */
export type SystemIntent = { readonly k: 'first_player'; readonly player: PlayerId };

export interface LoggedIntent {
  readonly seq: number; readonly by: PlayerId | 'system';
  readonly intent: Intent | SystemIntent; readonly hashAfter: string;
}
export type RejectCode = 'WRONG_PHASE' | 'NOT_YOUR_TURN' | 'PROMPT_PENDING' | 'NOT_YOUR_UNIT' | 'UNKNOWN_UNIT'
  | 'NO_ACTIONS_LEFT' | 'ALREADY_MOVED' | 'INSUFFICIENT_AP' | 'ON_COOLDOWN' | 'OUT_OF_RANGE' | 'NOT_VISIBLE'
  | 'INVALID_PATH' | 'SQUARE_OCCUPIED' | 'OUTSIDE_BOARD' | 'OUTSIDE_ZONE' | 'OVER_BUDGET' | 'ARMY_DOES_NOT_FIT'
  | 'REQUIREMENT_NOT_MET' | 'LIMIT_REACHED' | 'INVALID_TARGET';
export interface RuleViolation { readonly code: RejectCode; readonly message: string; readonly details?: Readonly<Record<string, number | string>> }
export type CheckResult = { readonly ok: true } | { readonly ok: false; readonly error: RuleViolation };
export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[]; readonly prompt?: PendingPrompt }
  | { readonly ok: false; readonly error: RuleViolation };
```

### 7.5 Events and views

```ts
// packages/engine/src/types/events.ts
export type Audience =
  | { readonly to: 'all' }
  | { readonly to: 'player'; readonly player: PlayerId }
  | { readonly to: 'squares'; readonly owner: PlayerId; readonly squares: readonly number[] };   // square indices
export interface DamageStep { readonly stage: DamageStage; readonly source: string; readonly delta: number; readonly after: number }
type Ev<T extends string, P extends object> = { readonly t: T; readonly aud: Audience } & Readonly<P>;

export type GameEvent =
  | Ev<'phaseChanged', { phase: Phase }>
  | Ev<'turnStarted', { player: PlayerId; turn: number; ap: number }>
  | Ev<'apSpent', { player: PlayerId; amount: number; left: number }>
  | Ev<'unitDeployed', { unit: UnitView }>
  | Ev<'unitStepped', { unit: UnitId; from: Square; to: Square }>
  | Ev<'movementInterrupted', { unit: UnitId; at: Square; reason: 'hiddenUnit' | 'mine' | 'reaction' | 'damage' | 'death' }>
  | Ev<'attacked', { attacker: UnitId; target: Square }>
  | Ev<'damaged', { unit: UnitId; amount: number; source: string; breakdown: readonly DamageStep[] }>
  | Ev<'healed', { unit: UnitId; amount: number; source: string }>
  | Ev<'died', { unit: UnitId; at: Square; cause: string }>
  | Ev<'statusChanged', { unit: UnitId; status: StatusKind; on: boolean }>
  | Ev<'unitCreated', { unit: UnitView; by: UnitId }>
  | Ev<'minePlaced', { mine: EntityId; square: Square }>
  | Ev<'mineExploded', { mine: EntityId; square: Square; victim: UnitId | null }>
  | Ev<'zoneCreated', { zone: EntityId; squares: readonly Square[]; kind: string }>
  | Ev<'zoneExpired', { zone: EntityId }>
  | Ev<'buildingControl', { building: BuildingId; controller: PlayerId | null }>
  | Ev<'promptRaised', { prompt: PendingPrompt }>
  | Ev<'turnEnded', { player: PlayerId }>
  | Ev<'gameOver', { result: MatchResult }>;
/** Produced only by projectEvents, never by resolvers. */
export type VisibleEvent = GameEvent
  | Ev<'unitAppeared', { unit: UnitView; at: Square }>
  | Ev<'unitVanished', { unit: UnitId; lastSeen: Square }>;

// packages/engine/src/types/view.ts
export interface UnitView {
  readonly id: UnitId; readonly type: UnitTypeId; readonly owner: PlayerId; readonly isCommander: boolean;
  readonly anchor: Square; readonly damage: number; readonly statuses: readonly StatusKind[];   // public ones for enemies
  readonly own?: { readonly cooldowns: Readonly<Record<string, number>>; readonly usage: UnitState['usage']; readonly hidden: boolean };
}
export interface PlayerView {
  readonly me: PlayerId; readonly seq: number; readonly rulesVersion: number; readonly phase: Phase;
  readonly turn: { readonly number: number; readonly active: PlayerId; readonly myAp: number | null };   // no opponent AP (D-F9)
  readonly board: BoardState;
  readonly visible: string;                    // '0'/'1' per square, same indexing as board.mask
  readonly units: readonly UnitView[];         // own units + currently visible enemy units
  readonly mines: readonly { readonly id: EntityId; readonly owner: PlayerId; readonly square: Square }[];
  readonly zones: readonly { readonly id: EntityId; readonly owner: PlayerId; readonly kind: string; readonly squares: readonly Square[]; readonly expiresAtTurn: number }[];
  readonly buildings: readonly BuildingState[];  // public, with control
  readonly players: Readonly<Record<PlayerId, { readonly name: string; readonly commander: CommanderId | null; readonly ready: boolean }>>;
  readonly myArmy: ArmyList | null;
  readonly myPreferences: Readonly<Record<string, boolean>>;
  readonly prompt: PendingPrompt | null;       // only if addressed to me
  readonly result: MatchResult | null;
}
```

### 7.6 Engine API

```ts
// packages/engine/src/index.ts
export interface WorldQuery {                  // implemented over GameState (host) and PlayerView (client)
  readonly board: BoardState; readonly rules: RulesConfig; readonly me: PlayerId;
  unitAt(s: Square): UnitView | null;          // only what `me` may know
  unit(id: UnitId): UnitView | null;
  stats(id: UnitId): UnitStats & { readonly actionsPerTurn: number; readonly attackRange: number };
  isVisible(s: Square): boolean;
}
export interface Engine {
  readonly rulesVersion: number;
  readonly contentHash: string;                // CI guard for RULES_VERSION bumps (§5.7)
  createMatch(setup: MatchSetup): GameState;
  check(state: GameState, by: PlayerId, intent: Intent): CheckResult;            // judged on by's knowledge
  apply(state: GameState, by: PlayerId | 'system', intent: Intent | SystemIntent): ApplyResult;
  project(state: GameState, p: PlayerId): PlayerView;
  projectEvents(events: readonly GameEvent[], p: PlayerId, before: GameState, after: GameState): readonly VisibleEvent[];
  resolvePrompt(state: GameState, by: PlayerId, prompt: PromptId, choice: string): ApplyResult;  // = apply(decide)
  replay(setup: MatchSetup, log: readonly LoggedIntent[]): GameState;
  hash(state: GameState): string;
  // Client-safe helpers: they work on a PlayerView as well as on full state.
  query(src: GameState | PlayerView, me: PlayerId): WorldQuery;
  reachable(q: WorldQuery, unit: UnitId): ReadonlyMap<number, readonly Square[]>;   // square index -> path
  legalActions(q: WorldQuery, unit: UnitId): LegalActions;
  previewDamage(q: WorldQuery, attacker: UnitId, target: Square): readonly DamageStep[];
  summarize(setup: MatchSetup, log: readonly LoggedIntent[]): GameSummary;           // achievements, post-game stats
}
export declare function createEngine(pack: ContentPack, handlers?: HandlerRegistry): Engine;
```

### 7.7 Client-facing session API

The wire messages are netcode §7.6; this is what the UI sees.

```ts
// packages/net/src/session/client.ts
export interface MatchClient {                 // identical for host (loopback) and guest
  readonly me: PlayerId;
  subscribe(cb: (u: { view: PlayerView; events: readonly VisibleEvent[]; why: 'update' | 'snapshot' }) => void): () => void;
  send(intent: Intent): Promise<CheckResult>;
  requestTakeback(toSeq: number): void;
  answerTakeback(reqId: string, accept: boolean): void;
  connection(): 'connecting' | 'connected' | 'unstable' | 'lost';      // netcode §7.5
}
```

---

## 8. Test strategy

### 8.1 Pyramid and targets

| Layer | Tool | Environment | Count (v1, rough) | Gate |
|---|---|---|---|---|
| Engine rules and abilities | Vitest 5 | `node` | 300–600 | ≥ 90 % lines, ≥ 85 % branches in `packages/engine` |
| Engine properties and fuzzing | fast-check 4 | `node` | 10–20 properties, 300 runs each | Must pass |
| Golden replays | Vitest | `node` | 10–30 recorded games | Hash-exact |
| Content tables | Vitest | `node` | 1 schema suite + coverage map | Every ability tagged in ≥ 1 test |
| Net sessions and protocol | Vitest + loopback transport | `node` | 40–80 | Must pass |
| UI components and controller | Vitest + Testing Library | `happy-dom` | 50–100 | Must pass |
| Renderer | `@react-three/test-renderer` + pure maths | `node` | 10–30 | Must pass |
| End-to-end | Playwright 1.64 | Chromium (+ Firefox weekly) | 5–10 | Smoke on every PR |
| Visual | Playwright screenshots | Chromium + SwiftShader | 2–4 (top, iso) | Reviewed diffs |

### 8.2 Engine unit tests: a scenario DSL with tests as an executable rules spec

- **Maps are drawn in ASCII** from P1's point of view: the top line is the highest row. The `scenario()` builder places the snippet on a real board and fills the rest of the state with defaults: active player, AP, commanders, rule overrides.
- **One `describe` per rule or ability**, tagged with its id and spec line. Table-driven with `it.each`.
- **Custom matchers:** `toBeOk()`, `toBeRejectedWith(code)`, `toContainEvent(partial)`.

```ts
// packages/engine/test/abilities/paladin.test.ts
import { describe, it, expect } from 'vitest';
import { scenario, attack } from '../dsl';

describe('ability:reinforcedArmor (L95 "Reduce all damage dealt to this unit by 3 (can\'t be less than 1)")', () => {
  it.each([
    { attacker: 'lojrar.footman',   expected: 1 },   // 1 - 3 -> floor 1
    { attacker: 'lojrar.ranger',    expected: 1 },   // 3 - 3 -> 0 -> floor 1
    { attacker: 'lojrar.berserker', expected: 9 },   // 12 - 3
  ])('$attacker deals $expected to a Paladin', ({ attacker, expected }) => {
    const s = scenario({
      map: `
        . A .
        . P .
      `,
      legend: { A: { type: attacker, owner: 'p2' }, P: { type: 'lojrar.paladin', owner: 'p1' } },
      active: 'p2',
    });
    const r = s.apply('p2', attack(s.unit('A'), s.square('P')));
    expect(r).toBeOk();
    expect(r).toContainEvent({ t: 'damaged', unit: s.unit('P'), amount: expected });
  });
});

describe('rules:damagePipeline order (D-C5, RulesConfig.damagePipeline)', () => {
  const base = {
    map: `
      . B .
      . P .
    `,
    legend: { B: { type: 'lojrar.berserker', owner: 'p2' }, P: { type: 'lojrar.paladin', owner: 'p1', statuses: ['defending'] } },
    active: 'p2' as const,
  };
  it('default order: (12 - 3) then halved, rounded up = 5', () => {
    const s = scenario(base);
    expect(s.apply('p2', attack(s.unit('B'), s.square('P')))).toContainEvent({ t: 'damaged', amount: 5 });
  });
  it('if the owner prefers "halve first": ceil(12 / 2) - 3 = 3', () => {
    const s = scenario({ ...base, rules: { damagePipeline: ['base', 'attackerBonus', 'attackerPenalty', 'defend', 'targetReduction', 'minimum'] } });
    expect(s.apply('p2', attack(s.unit('B'), s.square('P')))).toContainEvent({ t: 'damaged', amount: 3 });
  });
});
```

**What gets unit-tested, at minimum:**
- **Geometry.**
  - Rule A mask (593 squares, 8 removed per corner), plus the alternative modes.
  - Zone sizes (109 + 50).
  - The 2N(N+1) vision counts, and flood fill around blockers.
  - Footprints of size-2 units.
- **Movement.**
  - Orthogonal BFS; the path must not cross enemies, blockers or buildings; it may pass friends.
  - Size-2 block movement.
  - Interruption on unseen units and mines (D-M3–D-M5).
- **Turn and AP.** Refill, one action and one move per unit, extra actions (Market, Command Aura, Holy Fervor surcharge), cooldowns (D-T7), durations (D-T8), end-of-turn order (D-T9).
- **Combat.** Each pipeline stage, Defend lifetime and cancellation, attacking empty squares and mines.
- **Each ability and commander:** one `describe` each, 14 units and 6 commanders.
- **Buildings.** Capture rules: opposition, contested, end-of-turn timing.
- **Victory.** Commander death, goal row, simultaneous deaths → draw.
- **Army and deployment.** Budget, Sabrina pricing, "doesn't fit", hidden simultaneous deployment.
- **Projection.** `project` / `projectEvents` on hand-built fog cases: stealth, Mind's Eye, mines, boundary transforms.
- **Log.** Take-back eligibility and replay equivalence.

### 8.3 Property-based tests and fuzzing (fast-check)

Random legal playouts are driven by an array of *choice indices*. At each step, the index picks among the legal intents. fast-check shrinks failures to the shortest failing game.

```ts
// packages/engine/test/properties/invariants.test.ts
import fc from 'fast-check';
import { test, expect } from 'vitest';
import { engine, randomSetup, playout, assertNoLeak, assertInvariants } from '../helpers';

test('determinism, replay, JSON safety, fog safety and invariants hold for random legal games', () => {
  fc.assert(
    fc.property(fc.string({ minLength: 8, maxLength: 8 }), fc.array(fc.nat(), { maxLength: 300 }), (seed, choices) => {
      const setup = randomSetup(seed);                              // random legal armies and deployments
      const { states, log } = playout(engine, setup, choices);      // choice i -> legal[i % legal.length]
      const last = states.at(-1)!;
      expect(engine.hash(engine.replay(setup, log))).toBe(engine.hash(last));   // replay equals live play
      expect(JSON.parse(JSON.stringify(last))).toEqual(last);                    // JSON-safe state
      for (const s of states) {
        assertInvariants(s);           // no overlap, inside mask, AP >= 0, damage >= 0, one commander each...
        for (const p of ['p1', 'p2'] as const) assertNoLeak(s, engine.project(s, p), p);   // fog safety
      }
    }),
    { numRuns: 300 },
  );
});
```

**Further properties:**
- Take-back of the last k own intents equals the state before them.
- `check(...).ok === false` implies `apply` changes nothing.
- `check` gives the same answer on the full state and on the actor's `PlayerView`. This is the "no rejection oracle" rule, D-F8.
- Projected events never mention an enemy id that is absent from both the before and after views.
- Serialising a view and parsing it back is lossless.

### 8.4 Golden replays

- `test/golden/*.replay.json` holds `{ setup, log }` with `hashAfter` per intent, recorded from sandbox games and real playtests.
- The test replays each file and compares every hash.
- When rules change on purpose, `UPDATE_GOLDEN=1 pnpm test` rewrites the hashes and writes an event-log diff. Review that diff in the pull request to see exactly which games played out differently.

### 8.5 Content tests

- Every definition passes its schema; ids are unique; references resolve; translation keys exist.
- `cost` equals `grade` unless overridden. Commander-adjusted prices match D-B4: 24, 60, 120, and Artificer 10.
- **Ability coverage map.** Each `AbilityId` must appear as a `describe('ability:<id>')` tag somewhere in the engine tests. A meta-test reads the test sources through Vite's `import.meta.glob`.
- **Rules-version guard** (§5.7): the content hash changed without a `RULES_VERSION` bump → fail.
- A snapshot of the generated codex, so stat changes show up in review.

### 8.6 Net tests

Two sessions are connected through the `loopback` transport, with latency, reordering and drop injection. Cases:
- the handshake;
- version mismatch;
- a rejected intent;
- reconnection after an unclean drop;
- take-back accepted and declined;
- a prompt answered by the non-active player;
- commit-reveal verification;
- the post-game audit.

**Leak test:** a spy on the guest's inbound channel runs `assertNoLeak` on every message during random playouts.

### 8.7 UI tests (happy-dom + Testing Library)

- The ArmyBuilder: budget meter, commander pricing, validation.
- ActionBar disabled states with their reasons.
- EventLog formatting, including the damage breakdown.
- Take-back and prompt dialogs.
- The controller reducer (pure, no DOM needed).

### 8.8 Renderer tests

- **Pure maths in Node:** square ↔ world conversion, camera poses, zoom-to-fit, the fog-texture builder, picking maths.
- **Scene graph with `@react-three/test-renderer` 9.1.1:** one token per visible unit; no mesh for units absent from the view; highlights match the overlay.
- **Visual regression with Playwright:** a fixed scenario in top and iso views.
  - Chromium needs `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader` because automatic SwiftShader fallback is deprecated. Verify the flags against the CI Chromium version.
  - Keep visual tests few; they're brittle.

### 8.9 End-to-end tests

- Two pages in **one** browser context, using the `tabs` (BroadcastChannel) transport, on `localhost`, which is a secure context:
  1. The host creates a lobby and the test reads the invite link from the DOM.
  2. The guest opens it.
  3. Both submit preset armies and deploy through a test-only hook (`window.__test`, compiled only in test builds).
  4. They play scripted turns and the test checks the outcomes.
- **Nightly** (not gating): the same flow over real Trystero signalling.

### 8.10 Vitest configuration sketch

```ts
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'engine',  include: ['packages/engine/**/*.test.ts'],  environment: 'node' } },
      { test: { name: 'content', include: ['packages/content/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'net',     include: ['packages/net/**/*.test.ts'],     environment: 'node' } },
      { test: { name: 'web',     include: ['apps/web/**/*.test.{ts,tsx}'],   environment: 'happy-dom' } },
    ],
    coverage: { provider: 'v8', thresholds: { 'packages/engine/src/**': { lines: 90, branches: 85 } } },
  },
});
```

Vitest 5 changes to keep in mind: mocks are cleared before each test by default; an unawaited async assertion fails the test; reports go to `.vitest/`.

---

## 9. Tooling, build, CI and hosting

- **Node 24** (24.21.0 installed) and **pnpm 12** workspaces. Install once with `npm i -g pnpm@12`.
  - pnpm's strict `node_modules` stops `engine` from importing packages it doesn't declare. npm workspaces hoist dependencies, so such imports would silently work there. (Medium–High)
- **TypeScript 6.0.3** (§2.4).
  - Base: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
  - Engine: `"lib": ["ES2023"]` and `"types": []`, so any `window`, `document`, `setTimeout` or `process` fails to compile.
- **Linting.** ESLint 10 + typescript-eslint 8.72.
  - In `packages/engine`, `no-restricted-properties` and `no-restricted-globals` ban `Math.random`, `Date`, `performance`, `crypto` and timers (determinism, §5.2).
  - dependency-cruiser 18.7 enforces the §5.1 layer table.
  - Oxlint 1.89 is a faster optional pre-pass.
- **Vite 8 configuration.**
  - `base: './'`, so the site works under any GitHub Pages sub-path.
  - `build.target: 'es2022'`.
  - The board is lazy-loaded with `React.lazy(() => import('./screens/Match'))`, and three + R3F go into one long-cached vendor chunk.
  - The build SHA is injected through `define` for the version handshake.
  - **No service worker in v1** (netcode §7.17).
- **CI (GitHub Actions).** Install with the frozen lockfile → typecheck → lint → unit and property tests with coverage → build → **size gate** → Playwright smoke and visual tests → on `main`, deploy `apps/web/dist` to GitHub Pages.
  - Size gate: shell ≤ 200 KB gzip before the lobby, total JS ≤ 550 KB gzip.
- **Hosting.** GitHub Pages: free, no server rewrites needed thanks to hash routing (netcode §8.2).
  - On GitHub's free plan the repository must be public for Pages; private repositories need a paid plan.
  - Alternatives that also take private repositories: Cloudflare (third-party write-ups say Workers static assets is now preferred over Pages for new projects) and Netlify.
- **Assets.** `@gltf-transform/cli` 4.5.1 in an `assets:build` script. Licences recorded in `public/CREDITS.md`.
- **Developer experience.**
  - `pnpm dev` with a **Sandbox** screen (S-1).
  - `?transport=tabs` to play both seats in two tabs.
  - `leva` (0.10.1, optional, dev-only) for live-tuning camera and fog parameters.

---

## 10. Ambiguities, questions and defaults

Each item quotes the spec, states the question, and gives a default so implementation can proceed, with a confidence tag and the place the default lives.
- §10.1 covers technology and platform questions owned by this document.
- §10.2 covers rules questions that **shape the engine's design**. Their defaults come from `rules-lawyer.md` (the rules source of truth) and are repeated here only to show how the engine represents them.

### 10.1 Technology and platform

IDs are stable labels. The gaps in the T-numbers are intentional: rules items moved to §10.2 to follow `rules-lawyer.md`.

| ID | Spec says | Question | Default | Conf. | Lives in |
|---|---|---|---|---|---|
| T-01 | L135 "with a way to connect with another player. This should be done in a way that requires the least setup." | Which connection technology? Accounts? A server? | Browser-to-browser WebRTC with Trystero (public Nostr signalling); no accounts, no server of ours. Optional free Metered TURN key; Cloudflare relay as fallback (netcode §6) | High | `net/transport/*` |
| T-02 | L22 "he will create a lobby and will have a link to invite another player." | Link format and lifetime | `#/join/<roomId>/<secret>`, valid for the room's lifetime including rematches; "Keep this tab open" notice (netcode §7.4) | High | `net/session/host.ts`, `screens/Lobby` |
| T-03 | L135 "For now, assume that only another player will play." | Spectators? More seats? | Exactly two seats, no spectators. An observer projection could be added later | High | `LobbyState` |
| T-04 | L17 "Each player will only have vision around the vision field of each unit. Everything outside will be in the fog of war." | Without a neutral referee, who holds hidden information? | Host-authoritative; the guest only ever receives its own view. The host could peek with devtools: accepted for friends, detectable tampering through commit-reveal + audit (netcode §6.3, §7.15) | Med–High | `net/session/host.ts` |
| T-05 | L39 "There will be a take back option for each player. The opponent player has to accept the take back." | How is it implemented? | Log truncation + deterministic replay from the turn-start snapshot; the scope and limits are rules defaults (R-15) | High | `engine/log/takeback.ts` |
| T-06 | (not covered) | Disconnects, reloads, abandonment | Game pauses; the host persists after every intent and restores on reload; the guest reconnects with backoff (netcode §7.11). No forfeit timer in v1; either player can concede | Med | `net/persistence.ts` |
| T-07 | L24 "Check his achivements" | Where do achievements live? Which ones? | Local (IndexedDB), evaluated after each game over the full replay. The owner defines the list; definitions are data. Not tamper-proof without a server | Med | `apps/web/src/achievements` |
| T-08 | L23 "Create or edit army compositions" / L26 "If a player wants to create a new one when a game starts, he can do so there aswell." | Storage and portability | IndexedDB; one ArmyBuilder component used from the menu and the lobby; export/import as a short share code (base64url JSON, zod-validated) | High | `state/collection.ts` |
| T-09 | L27 "The player will have a budget of 200, which can be edited in the future" | Who edits it, and per player or per match? | Per match, set by the host in the lobby (default 200), the same for both, shown before army selection (D-B2) | High | `RulesConfig.budget` via `rulesOverrides` |
| T-10 | (not covered) | Peers running different versions | Handshake compares build SHA + `RULES_VERSION`; mismatch → "both reload" (netcode §7.17); CI guard keeps `RULES_VERSION` honest (§5.7) | High | `net/protocol.ts`, `content/index.ts` |
| T-11 | (not covered) | Turn timer? | Off in v1 (D-T3). If enabled, prompts fall back to their default after 60 s (netcode §7.14) | Med | lobby settings |
| T-12 | L48 "The view can switch from top to isometric. Top by default." | Rendering technology | One orthographic camera with animated poses in a 3D scene (§4.2) | High | `render/r3f/CameraRig` |
| T-32 | L48 (same) | True isometric or 2:1 "game" isometric? Can the iso view rotate? | True isometric (35.264° elevation, 45° azimuth) by default; 2:1 dimetric (30°) as a setting; rotation in 90° steps (Q/E); zoom and pan in both. The art mock (`research-art/`) may pick otherwise; any elevation is one number | Med | `settings.isoStyle` |
| T-33 | L29 "usually opposing each other" + L48 | Which side sits at the bottom of the screen? | Each player sees their own deployment zone at the bottom (camera turned 180° for P2) | Med–High | `render/r3f/CameraRig` |
| T-34 | L44 "The color of the token will represent the grade of the unit." | Then how is ownership shown? | Player colour as a ring or base under the token plus a band on its rim; grade colour for the body; symbol on the face. Palette from `research-art/` | Med | `render/r3f/Token` |
| T-35 | L46 "a symbol in the middle that represents this building." | Where does the symbol go so it reads in both views? | A floating, camera-facing emblem over the centre (plus a roof decal), tinted by the controller | Med | `render/r3f/Buildings` |
| T-36 | L47 "The style of the graphics is stylized." | Rendering style | Flat or toon shading with outlines, low-poly models, no PBR realism; final look from the art mock (L136) | Med | `render/r3f` materials |
| T-37 | (not covered) | Devices and browsers | Desktop first (mouse and keyboard), usable on touch; current Chrome, Edge, Firefox and Safari with WebGL 2 | High | n/a |
| T-38 | (not covered) | Language | English UI; every string in a dictionary from day one | Med | `content/i18n` |
| T-40 | L17 (fog) | Unit identity under fog | Opaque ids from a dedicated seeded stream: they reveal nothing about army size or summons, but do reveal "same unit as before". Accepted | Med | `engine/rng.ts` |
| T-41 | (not covered) | Should the engine know about host and guest? | No. It uses P1/P2 (rules terms); the session maps seats. This keeps hot-seat, AI and server mode possible | High | `net/session/*` |
| T-42 | (not covered) | When to move to WebGPU? | Not until R3F v10 and drei 11 are stable and both backends pass the visual tests; no raw GLSL meanwhile | High | `apps/web` dependencies |
| T-43 | L136 "free asset packs may be used if suitable" | Licences | CC0 packs preferred; CC BY needs an attribution screen; every asset listed in `CREDITS.md` | High | `public/CREDITS.md` |
| T-44 | (not covered) | Coordinate display | Internal 0-based `{x, y}`; shown as A–Y / 1–25 with P1's back row = 1 (D-G1) | High | `render`, `i18n` |

### 10.2 Rules questions that shape the engine (defaults from rules-lawyer.md)

| ID | Spec says | Engine-relevant question | Default | Conf. | Lives in |
|---|---|---|---|---|---|
| R-01 | L30 "The size of the battlefields are 25x25, where the corners are cut off with a radius of 4." | Exact shape (Appendix A) | Rule A: square removed if u < 4, v < 4 and (4−u)² + (4−v)² > 16, which leaves **593 squares** (D-G7). The mask generator also supports `chamfer` (585), `disc` (573) and `fillet` (613). Confirm with the pictures | Low | `ScenarioDef.board.cornerCut` |
| R-02 | L31 "The normal deployment zone covers the first 5 rows closest to the player. The extended deployment zone covers 2 extra rows." / L29 "Some units can be deployed in the extended deployment area" | Which rows and which units? | P1 rows 1–5 (+6–7), P2 rows 21–25 (+19–20): 109 + 50 squares under Rule A. Extended allowed for types 1–2 and never for the commander (D-P1, D-P2) | High / Low | `ScenarioDef.deployment`, `UnitDef.deployment` |
| R-03 | L15 "movement (1 square by default, including diagonals)" vs L34 "The movement is orthogonal, a movement-piece cannot be diagonal." | Contradiction: diagonal steps? | Orthogonal only; a diagonal costs 2 (D-M1) | High | `RulesConfig.movementMetric` |
| R-04 | L45 "in range of 1(including corners)" / L37 "A LOV of 1 will only show the 4 orthogonal adjacent squares" / L110 "the 5 opposite adjacent squares of the target" | Which metric for "adjacent", reach and ranges? | "Adjacent" = 8 squares (Chebyshev); basic attack reach = the 4 orthogonal squares; "range N" = Manhattan (D-G2–D-G5). Every ability can override | Med | `RulesConfig.*Metric`, per-ability `metric` |
| R-05 | L13 "There may be a scenario with blockers." | Blockers and vision; buildings and vision | Blockers and building squares can't be entered and block vision through a flood fill: seen themselves, but nothing behind them (D-G8, D-F2, D-O7) | Med | `RulesConfig.blockersBlockVision`, `board/vision.ts` |
| R-06 | L57 "Name, Power/Toughness, Size, LOV, Movement, AP" (L109 Beast: Size 2) | What does size 2 occupy? | A 2×2 block anchored at its lowest x/y square; moves as a block; distances from the nearest square; a mine triggers on any of its squares (D-G6, D-M5) | Med | `board/geometry.ts` |
| R-07 | L9 "In each player's turn, that player will receive a number of Action points." | How many? Carry-over? | 10 AP per turn, refilled at turn start, no carry-over (D-A1) | Low | `RulesConfig.apPerTurn` |
| R-08 | L7 "each unit has an action cost" / L57 "Ability:AbilityCost:Description" | Ability cost instead of, or on top of, the unit's AP? | Instead of (D-A4). Move, attack and defend cost the unit's AP; passives cost nothing | Low | engine `check` |
| R-09 | L35 "A unit can only use one action per turn, unless stated otherwise." / L11 "a single unit can only move once per turn." | Do extra actions allow a second move? | No; at most one Move even with extra actions (D-T5, D-O8) | Med | `RulesConfig.movesPerUnitPerTurn` |
| R-10 | L15 "defend (a defending unit receives half the damage rounded up(never less than one))" and L64 / L95 / L106 / L129 reductions | Defend lifetime and modifier order | Defend lasts until your next turn starts and is cancelled by a later action (D-C4). Order: base → attacker bonuses → attacker penalties (≥ 0) → target reductions → Defend halving → minimum 1 if ≥ 1 before (D-C5, D-C6) | Med | `RulesConfig.defend`, `damagePipeline` |
| R-11 | L82 "(This can also occur in opponents turn)" / L130 "you can choose to sacrifice 1 max toughness to revive that unit" | Reactions and choices outside your own turn | Automatic reactions resolve inside `apply` (both docs agree). Optional choices: standing settings by default (D-T11), with the prompt machinery from netcode §7.14 kept available. The rules doc marks this Low | Low (default) / High (architecture) | `RulesConfig.prompts`, `PlayerState.preferences` |
| R-12 | L28 "The player first chooses the units that wants to have for that encounter." / L29 "After that follows a deployment phase" | Secret and simultaneous? | Both choose and deploy simultaneously and secretly. Army lists stay secret; commanders are revealed when deployment starts (D-P3, D-B9, D-B10). Host-side fairness through commit-reveal (netcode §7.15) | Med | `rules/army.ts`, `rules/deploy.ts`, `view/project.ts` |
| R-13 | (not covered) | Who moves first? | Coin flip announced when deployment starts (D-T1), made with commit-reveal (netcode §7.15) and fed to the engine as `SystemIntent first_player` | Med–High | `net/session/commitReveal.ts` |
| R-14 | L45 "conquered when at least one unit, without opposition, is in range of 1(including corners) of that building." | When is control evaluated? Is it public? | End of every turn, after damage and healing; the 12-square ring; any enemy unit opposes; control is public (D-O3–D-O5) | Med | `RulesConfig.capture`, `rules/objectives.ts` |
| R-15 | L39 "There will be a take back option for each player. The opponent player has to accept the take back." | Scope and limits | Back to any point in your latest turn, until the opponent acts; one request at a time; the opponent sees what the undone actions revealed; on by default (D-R1–D-R4, netcode §7.13) | Low–Med | `RulesConfig.takeback` |
| R-16 | L32 "bring your commander to the opposite side of the board. More specifically, to the last row." | When does it count? | Instant win when the commander stands on the goal row after an action fully resolves, with deaths checked first (D-K5) | Med | `ScenarioDef.goalRow`, `rules/victory.ts` |
| R-17 | L17 (fog) | Is the opponent's AP visible? Last-seen markers? | Opponent AP hidden (D-F9); no last-seen markers (D-F5) | Low / Med | `RulesConfig.hiddenInfo` |
| R-18 | L59 "### The Empire" (empty) / L60 "### Lojrar Clan" | Which units belong to The Empire? | All 14 listed units are Lojrar; v1 ships Lojrar only, mirror matches allowed (D-B6, D-B7) | Low | `content/factions/*` |
| R-19 | L3 "acquire any combination of units that can fit the budget" + L31 | Can an army hold more units than its zones? | No; the army must fit its zones and every unit must be deployed (D-B3), so the builder validates against the scenario | Med | `rules/army.ts` |
| R-20 | L102 "Ask the player if he wants a unit to go to a mined square. The player can deactivate this warning from options" | Rules or UI? | Pure client UX: the planner avoids your own known mines, crossing one asks for confirmation, toggle in Settings (default on). Enemy mines are invisible and can't be warned about | High | `apps/web/src/controller`, `settings.warnOnOwnMines` |

---

## 11. Suggestions (beyond the spec)

| # | Suggestion | Why | Cost |
|---|---|---|---|
| S-1 | **Sandbox / hot-seat mode:** both seats on one screen, a fog toggle, and a "god view" that exists only in the sandbox | The owner can playtest balance alone; developers debug rules without a network. Uses the `loopback` transport | Low |
| S-2 | **Make M0's spike the L136 mock page:** board, coin tokens, keep and market placeholders, the top/iso toggle in both styles, and fog variants side by side | L136 asks that "If there are several contenders, all should be represented and justified" | Low (it's the spike anyway) |
| S-3 | **Post-game full replay:** step through every intent with full information; export and import match files | Free with the intent log; great for learning and bug reports | Low |
| S-4 | **Codex generated from the content tables:** the same UnitCard as in game | One source of truth; no stale rules text | Low |
| S-5 | **Damage preview on hover + breakdown in the log** | Players learn the rules; testers spot rule bugs | Low (engine `previewDamage`) |
| S-6 | **Army share codes** | Players swap and discuss armies | Low |
| S-7 | **Accessibility:** colour-blind-safe grade palette with the grade numeral on the coin rim (see `research-art/palettes-cvd.png`); ownership by shape *and* colour; keyboard play; reduced-motion setting | Colour is overloaded: grade by L44, plus ownership | Low–Med |
| S-8 | **SVG debug renderer** on the same contract | Rules debugging and WebGL-free end-to-end tests; insurance if 3D work stalls | Low (about 200 lines) |
| S-9 | **"Copy match file" in bug reports** | Setup + log reproduce any bug exactly | Very low |
| S-10 | **Later:** server authority on a Cloudflare Durable Object (same engine); an AI opponent built on `legalActions` + playouts; spectators through an observer projection | The pure engine makes each of these additive | Med each |
| S-11 | **No analytics and no personal data** by default | Nothing to disclose; simplest privacy story | None |

---

## 12. Proposed milestones (rough, one developer)

| Milestone | Content | Exit criteria |
|---|---|---|
| **M0 Spike + mock** (2–3 days) | `git init` + GitHub; pnpm workspace; Vite 8 + React 19.3 + R3F 9.8; Rule A board; coin tokens with symbols; placeholder keep and market glTF; animated top/iso toggle (both styles); fog overlay variants; picking; deploy to Pages | Owner reviews the mock page (S-2); bundle measured against §3.2 |
| **M1 Engine core** (1–2 weeks) | Geometry, pathing, vision; turn and AP; move, attack, defend; army and budget; deployment; commander and victory; log, replay, take-back; projection; DSL; property tests | Coverage gate; replay and fog properties green |
| **M2 Sandbox UI** (about 1 week) | Match screen, HUD, unit cards, action bar, event log, deployment UI, ArmyBuilder; hot-seat | The owner can play a full game alone |
| **M3 Networking** (about 1 week; netcode §11's half-day connectivity spike can run alongside M0) | Trystero transport; lobby and invite link; host/guest sessions; reconnection; take-back; commit-reveal; end-to-end over `tabs` | Two machines finish a game over the internet |
| **M4 Content** (1–2 weeks) | All 14 Lojrar units, 6 commanders, keep and market; coded handlers; golden replays | Ability coverage map 100 % |
| **M5 Polish** (ongoing) | Art pass per `research-art/`, sound, achievements, settings, accessibility, size budget, Firefox and Safari checks | Release candidate |

---

## Appendix A. Board geometry for L30 "corners are cut off with a radius of 4"

The mask generator implements four readings. **Rule A is the default** (D-G7).

| Mode | Removal rule (per corner; u, v = squares from the nearest edges) | Removed per corner | Playable | Normal zone per side | Back row |
|---|---|---|---|---|---|
| `ruleA` (default) | u < 4, v < 4 and (4−u)² + (4−v)² > 16 | 8 | **593** | 109 | 17 |
| `chamfer` | u + v < 4 (staircase triangle) | 10 | 585 | 105 | 17 |
| `disc` | square centre closer than 4 to the board's corner point | 13 | 573 | 99 | 17 |
| `fillet` | square centre outside a rounded-rectangle arc of radius 4 | 3 | 613 | 119 | 21 |

The extended zone adds 50 squares per side in every mode. Corner close-ups (bottom-left, rows 5 down to 1, `#` = removed):

```
ruleA      chamfer    disc       fillet
......     ......     ......     ......
#.....     #.....     ##....     ......
#.....     ##....     ###...     ......
##....     ###...     ####..     #.....
####..     ####..     ####..     ##....
```

Default board (Rule A) with deployment zones. `a`/`A` = normal zone, `b`/`B` = extended rows, `#` = removed. P1 is at the bottom.

```
25 # # # # A A A A A A A A A A A A A A A A A # # # #
24 # # A A A A A A A A A A A A A A A A A A A A A # #
23 # A A A A A A A A A A A A A A A A A A A A A A A #
22 # A A A A A A A A A A A A A A A A A A A A A A A #
21 A A A A A A A A A A A A A A A A A A A A A A A A A
20 B B B B B B B B B B B B B B B B B B B B B B B B B
19 B B B B B B B B B B B B B B B B B B B B B B B B B
18 . . . . . . . . . . . . . . . . . . . . . . . . .
17 . . . . . . . . . . . . . . . . . . . . . . . . .
16 . . . . . . . . . . . . . . . . . . . . . . . . .
15 . . . . . . . . . . . . . . . . . . . . . . . . .
14 . . . . . . . . . . . . . . . . . . . . . . . . .
13 . . . . . . . . . . . . . . . . . . . . . . . . .
12 . . . . . . . . . . . . . . . . . . . . . . . . .
11 . . . . . . . . . . . . . . . . . . . . . . . . .
10 . . . . . . . . . . . . . . . . . . . . . . . . .
 9 . . . . . . . . . . . . . . . . . . . . . . . . .
 8 . . . . . . . . . . . . . . . . . . . . . . . . .
 7 b b b b b b b b b b b b b b b b b b b b b b b b b
 6 b b b b b b b b b b b b b b b b b b b b b b b b b
 5 a a a a a a a a a a a a a a a a a a a a a a a a a
 4 # a a a a a a a a a a a a a a a a a a a a a a a #
 3 # a a a a a a a a a a a a a a a a a a a a a a a #
 2 # # a a a a a a a a a a a a a a a a a a a a a # #
 1 # # # # a a a a a a a a a a a a a a a a a # # # #
   A B C D E F G H I J K L M N O P Q R S T U V W X Y
```

Other verified numbers:
- Vision in open ground covers 2N(N+1) squares: 4, 12, 24, 40, 60, 84 for N = 1–6. That matches L37's 4 and 12.
- The capture ring around a 2×2 building at "range of 1 (including corners)" has 12 squares (D-O4).

## Appendix B. Camera maths

- **Isometric elevation** = atan(1/√2) = 35.264°. On screen, a square's height-to-width ratio is sin e: 0.577 for true isometric, 0.5 for 2:1 dimetric (e = 30°).
- **Projected board extent**, 25 × 25 with the board diagonal horizontal: width 25√2 ≈ 35.36 world units; height 35.36·sin e: 20.41 (true isometric) or 17.68 (dimetric), plus the tallest object's height × cos e.
- **Pose** (Y up): position = target + d·(cos e·sin a, sin e, cos e·cos a).
  - Top: e = 90°, a = 0° for P1, 180° for P2.
  - Iso: a = 45° + 90°·k (+180° for P2).
- **Orthographic zoom** (R3F's default frustum is measured in pixels): zoom = min(canvasW / (W + 2m), canvasH / (H + 2m)), where m is the margin in world units.
- **Picking:** with an orthographic camera every ray is parallel to the view direction. Intersect with y = 0 and convert with x = round(X + 12), y = round(12 − Z).

## Appendix C. Measurement method and raw data

- **Installation.** Packages were installed with `npm install --ignore-scripts` into a fresh scratch folder:
  - three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, react and react-dom 19.3.1, zustand 5.0.16;
  - phaser 4.2.1, pixi.js 8.22.0, @pixi/react 8.0.5, @babylonjs/core and @babylonjs/loaders 9.32.0;
  - peerjs 1.5.5, trystero 0.26.0, immer 11.2.9, valibot 1.5.0, zod 4.6.7;
  - esbuild 0.28.2.
- **Entry files** lived in a separate folder. Each imported what that stack would really use, for example `OrthographicCamera`, a cylinder token, a `DataTexture` fog texture, `GLTFLoader`, `Raycaster` and lights for three, and a minimal `<Canvas>` scene for R3F.
- **Bundling.** `esbuild <entry> --bundle --minify --format=esm --splitting --platform=browser --target=es2022 --jsx=automatic --define:process.env.NODE_ENV="production"`, resolving through `NODE_PATH`.
- **Sizes.** Gzip at level 9 and Brotli at quality 11, with Node's `zlib`.

| Entry | Chunks | Minified KB | Gzip KB | Brotli KB | Entry-chunk gzip KB |
|---|---|---|---|---|---|
| e-react-zustand | 1 | 218.9 | 67.8 | 58.2 | 67.8 |
| a-three-vanilla (no React) | 1 | 605.8 | 153.6 | 126.3 | 153.6 |
| three full namespace (no React) | 1 | 725.4 | 185.9 | 151.3 | 185.9 |
| react-plus-three-subset | 1 | 824.6 | 221.2 | 184.5 | 221.2 |
| a-r3f-core | 1 | 1,124.7 | 310.8 | 248.9 | 310.8 |
| a-r3f-drei | 4 | 1,955.0 | 564.5 | 458.7 | 344.3 |
| r3f-drei-no-gltf (R3F `useLoader` instead of drei `useGLTF`) | 4 | 1,883.2 | 546.3 | 443.5 | 326.1 |
| a-r3f-drei-text | 4 | 2,069.9 | 606.5 | 493.9 | 386.3 |
| b-phaser | 1 | 1,362.1 | 362.2 | 290.2 | 362.2 |
| c-pixi | 23 | 567.1 | 172.9 | 154.7 | 10.5 |
| c-pixi-react | 23 | 891.6 | 272.6 | 233.2 | 110.3 |
| d-babylon-deep | 269 | 3,593.9 | 911.6 | 783.2 | 256.8 |
| d-babylon-index | 1,051 | 7,325.2 | 1,856.9 | 1,504.8 | 968.5 |
| n-peerjs | 1 | 86.0 | 23.5 | 20.9 | 23.5 |
| n-trystero | 1 | 73.4 | 26.9 | 24.3 | 26.9 |
| x-immer-valibot | 1 | 12.7 | 4.9 | 4.5 | 4.9 |
| x-zod-mini | 1 | 14.6 | 5.1 | 4.7 | 5.1 |

Composition of `r3f-drei-no-gltf`, from the esbuild metafile (minified bytes by package):

| Package | KB |
|---|---|
| three | 770.5 |
| hls.js (lazy chunk) | 571.5 |
| react-dom | 205.1 |
| @react-three/fiber | 167.3 |
| @mediapipe/tasks-vision (lazy chunk) | 134.4 |
| react | 8.3 |
| @react-three/drei itself | 5.7 |

## Appendix D. Cross-document alignment

| Topic | rules-lawyer.md | research-netcode.md | This document |
|---|---|---|---|
| Transport | – | Trystero primary, Durable Object relay fallback, PeerJS plan C | **Adopted**; PeerJS's dead TURN independently re-verified (DNS) |
| Engine contract | `apply(state, action) → (state, events)` | `createMatch` / `check` / `apply` / `project` / `projectEvents` / `resolvePrompt` | **Same names**; `resolvePrompt` = `apply(decide)`; the engine uses P1/P2, and the session maps host/guest (T-41) |
| Intent shape | Explicit path; attacks target squares (D-C3, D-M4) | `{ k: 'move', path }`, `{ k: 'attack', target: Square }` | **Same**, plus setup, preference, decide and system intents |
| Off-turn choices | D-T11: standing settings, no prompts (Low) | §7.14: prompts | **Both supported**; default follows the rules doc (R-11) |
| Take-back | D-R1–D-R4 | §7.13 | **Same**; implemented as replay from the turn-start snapshot |
| First player | D-T1: coin flip at deployment | §7.15: commit-reveal | **Commit-reveal → `SystemIntent`** |
| Versioning | – | build SHA + `rules` integer | **Same**, plus a CI content-hash guard |
| Board shape | D-G7 Rule A, 593 squares | – | **Rule A default**; three other modes supported |
| Damage order | D-C5 / D-C6 | – | **Adopted as `damagePipeline`**, pinned by tests |
| Hosting | – | GitHub Pages | **Same** |

---

## Sources

**Primary data gathered for this document (2026-10-24):**
- npm registry JSON (`https://registry.npmjs.org/<package>`) and the downloads API (`https://api.npmjs.org/downloads/point/last-week/<package>`) for every version, date and download count above.
- Live probe of `https://0.peerjs.com/` (HTTP 200, "location":"EU") and DNS lookups of `eu-0.turn.peerjs.com` and `us-0.turn.peerjs.com` (no A, AAAA or CNAME records).
- Installed-source checks: `@react-three/fiber/dist/react-three-fiber.esm.js` (`extend(THREE)`), `@babylonjs/core/Engines/nullEngine.js`, `pixi.js/lib/scene/mesh-perspective/PerspectiveMesh.d.ts`, `phaser/types/phaser.d.ts` (`ISOMETRIC`, `class Mesh`), `three/src/renderers/webgpu/WebGPURenderer.js` (`forceWebGL`).

**Web sources:**
- three.js r186: [radiancefields.com](https://radiancefields.com/three.js-ships-its-native-gaussian-splat-renderer-and-splat-raycasting-in-r186), [cgworld.jp](https://cgworld.jp/flashnews/01-202610-Threejs-r186.html), [oflight.co.jp](https://www.oflight.co.jp/en/columns/threejs-r186-native-gaussian-splatting-guide-2026)
- R3F v10 alpha: [newreleases.io: @react-three/fiber 10.0.0-alpha.6](https://newreleases.io/project/npm/@react-three/fiber/release/10.0.0-alpha.6); [R3F v9 migration guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)
- Vite 8: [vite.dev: Announcing Vite 8](https://vite.dev/blog/announcing-vite8), [The Register, 2026-03-16](https://theregister.com/2026/03/16/vite_8_rolldown)
- React 19.3: [GitClear: react v19.3.0](https://www.gitclear.com/open_repos/facebook/react/release/v19.3.0?page=1)
- zustand: [releasebot.io](https://releasebot.io/updates/pmndrs/zustand) (search result lagging the registry)
- Vitest 5: [GitHub release v5.0.0](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0); Vitest 4 date from [cn.vitest.dev/blog](https://cn.vitest.dev/blog)
- PeerJS: [peerjs.com/docs](https://peerjs.com/docs), [lib/util.ts (DEFAULT_CONFIG, CLOUD_HOST)](https://raw.githubusercontent.com/peers/peerjs/master/lib/util.ts), [GitHub repository](https://github.com/peers/peerjs)
- Trystero: [GitHub README](https://github.com/dmotz/trystero)
- Phaser 4: [phaser.io/download/stable](https://phaser.io/download/stable)
- three.js WebGPU fallback: [threejs.org manual: WebGPURenderer](https://threejs.org/manual/en/webgpurenderer); Firefox caveat: [buildmvpfast.com](https://www.buildmvpfast.com/blog/threejs-webgl-to-webgpu-renderer-migration-2026)
- TypeScript 7: [InfoQ](https://infoq.com/news/2026/08/typescript-7-released/), [ecorpit.com: migration readiness](https://ecorpit.com/typescript-7-migration-readiness-eslint-astro-blockers-2026/)
- Cloudflare TURN pricing: [developers.cloudflare.com/realtime/pricing](https://developers.cloudflare.com/realtime/pricing/)
- Cloudflare Pages vs Workers (third-party): [mecanik.dev](https://mecanik.dev/en/posts/cloudflare-pages-vs-workers-which-to-use-in-2026/), [bejamas.com](https://bejamas.com/stack/hosting/cloudflare)
- SwiftShader deprecation and flags: [Chromium docs: Using Chromium with SwiftShader](https://chromium.googlesource.com/chromium/src/+/798e59c5275d4131797e8ea2e96e6c6000256b58/docs/gpu/swiftshader.md)

**Sibling analyses:** `docs/analysis/rules-lawyer.md` (§4 defaults table), `docs/analysis/research-netcode.md` (§3, §6, §7), `docs/analysis/research-art/` (palettes, icons, objective mocks; in progress).
