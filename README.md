# Coin Duel (working title)

A browser 1v1 turn-based strategy board game. Each army is a purse of euro-coin units (tiers 1, 2, 5, 10, 20, 50
and 100), led by a commander that must survive. The board is 25x25 with rounded corners, fog of war, hidden
deployment, stealth and mines, and two 3x3 buildings (the Keep and the Market). You win by killing the enemy
commander, by walking your own commander onto the enemy's back row, or by holding both buildings for five of your
turns (Siege).

- **The owner's spec** is `docs/SPEC.md` (with the original `GameSpec.pdf` in the repo root).
- **The rules as built** are in `docs/RULES_INTERPRETATION.md`. The owner's rulings R1 to R42 at its top override
  everything below them.

Two people play peer to peer: the host's browser runs the authoritative game and sends each player only what that
player may see. Nothing runs on a server: the build is a static site.

## Run it locally

Requires Node.js 22 or newer.

```sh
npm install      # first time only
npm run dev      # http://localhost:5173
```

- `#/` is the main menu: choose a display name, build armies, play online.
- `#/dev/sandbox` is the **hot-seat sandbox**: one browser plays both seats. It covers the whole game: each seat
  picks or builds its army in the lobby (Baba Yaga's variant included), both deploy in secret, then the battle.
  The board follows whoever has to act, and the seat switcher shows either side by hand. Each seat still sees only
  its own fog. There is no turn timer unless the lobby turns one on, and no achievements. *Quick start* skips
  the lobby with two ready-made armies, and *Quick skirmish* starts a small battle already in contact.
- `#/dev/render` is the 3D board's check page (cameras, overlays, animations, palettes).

Build and serve the static site:

```sh
npm run build    # apps/web/dist
npm run preview  # serves the build at http://localhost:4173
```

The build uses relative asset paths (`base: './'`) and hash routes, so `apps/web/dist` works from any static host
and any sub-path (GitHub Pages, itch.io, a folder on a web server) without rewrites. Set `BUILD_ID` (for example
`BUILD_ID=$(git rev-parse --short HEAD) npm run build`) to name the deployed build in version-mismatch messages;
GitHub Actions' `GITHUB_SHA` is used when present.

## Play with a friend

1. Open the game and press **Play**. That creates a lobby with an invite link.
2. Send the link to your friend in any chat. The first person to open it takes the other seat.
3. Keep your tab open: the host's browser is the game. If either of you reloads, the match resumes at the same
   address (rooms are saved in the browser's storage), and the guest can also just open the invite link again.
4. Each of you picks an army and presses Ready. The coin flip, both deployments and the battle follow. The turn
   timer (90 s per turn plus a 60 s bank, R29) is on by default online; the host can change it in the lobby.

Both players need a secure page: **https://** or **http://localhost**. WebRTC's crypto is missing on plain
`http://<LAN-IP>`, so the game says so instead of connecting. To play across the internet, deploy the build to
an https host.

### Getting it online (pick one)

- **GitHub Pages (recommended, permanent).** Push this repository to GitHub, then in the repository's
  *Settings → Pages* set *Source* to **GitHub Actions**. `.github/workflows/deploy.yml` builds and publishes on
  every push to `main`; the game lives at `https://<user>.github.io/<repo>/`. Open it there, press **Play**, and
  send the invite link. Both of you use that address.
- **A tunnel for one evening.** Run `npm run build && npm run preview`, then expose port 4173 over https with a
  tunnel such as `npx localtunnel --port 4173` or `cloudflared tunnel --url http://127.0.0.1:4173`. Open the
  https URL the tunnel prints (not localhost), press **Play**, and send the invite link.
- **Both run it locally.** If your friend can run `npm install && npm run build && npm run preview` too, each of
  you plays on your own `http://localhost:4173`. The invite link's address won't work for them, so send the room
  code shown in the lobby (or the whole link): the **Join** box on the main menu accepts a pasted link, its
  `#/join/...` part, or the `ROOM/SECRET` code. The browsers meet through the public relays regardless of origin.

The browsers find each other through public Nostr relays (Trystero, the SDP encrypted with the invite secret) and
then talk directly over an encrypted WebRTC data channel; game data never touches the relays. About one pair in
six needs a TURN relay (a phone on mobile data, strict corporate networks). TURN is optional: put a free
[Metered](https://www.metered.ca/) key in `apps/web/.env.local` (not committed), or give static credentials:

```sh
VITE_METERED_APP=<your app name>   # https://<name>.metered.live
VITE_METERED_KEY=<api key>
# or
VITE_TURN_URLS=turn:host:3478,turns:host:443
VITE_TURN_USERNAME=<user>
VITE_TURN_CREDENTIAL=<password>
```

Fairness (R37): the coin flip, the armies and the deployments use commit-reveal, so the host can't counter-pick
what the guest chose. After the match, the result screen's *Fairness check* replays the whole game and checks
every view and hash the guest was shown. Cheating stays detectable, not impossible: a modified host could still
peek at the fog.

## Tests and checks

```sh
npm test                                   # every test (vitest): engine, session layer, UI logic, renderer maths
npx vitest run packages/engine/src/ap.test.ts   # a subset
npm run test:watch
npm run typecheck                          # both packages (strict TypeScript)
npm run build                              # the production build
npm run check                              # all three, in that order
```

The engine's property tests play random legal games and check, at every step, that replays are exact, that the
state stays consistent and that neither player's view leaks hidden information (`findLeaks`).
`apps/web/src/store/abilityCasting.test.ts` casts every active ability through the battle UI's state machine and
checks that the real engine accepts the result; `apps/web/src/net/protocol.test.ts` runs host and guest over an
in-memory network (join, reconnect, resync, take-backs, prompts, the turn timer, a cheating host).

## Repository layout

```
docs/                      the spec, the rules interpretation (authoritative), owner answers, analyses, art direction
packages/engine/           @coinduel/engine: the pure TypeScript rules engine (no DOM, clock, network or Math.random)
  src/constants.ts         every tunable and rule switch, named, with its ruling or assumption id
  src/content/             units, abilities (with their card text), commanders, factions, buildings, scenarios
  src/abilities/           one file per unit and commander: the ability rules
  README.md                the engine's API (intents, views, events, helpers, the ability framework)
apps/web/                  @coinduel/web: the game (Vite, React, React Three Fiber, zustand)
  src/net/                 sessions: sandbox, online host and guest (Trystero), commit-reveal, the R29 clock (README.md)
  src/render/              the 3D board (README.md)
  src/ui/                  screens, the battle UI, the army builder, the 2D fallback board
  src/store/               UI state: the command state machine, per-match memory, armies, options, achievements
  src/theme/, src/styles/  art-direction tokens and CSS
  public/assets/           icons, models and sounds, with their licences (ATTRIBUTION.md)
```

The UI only ever receives a `PlayerView` and the events filtered for its seat (`apps/web/src/contracts.ts`); the
full game state lives in the session layer, so the fog can't leak through the screens.

## Where the rules and their assumptions live

- `docs/RULES_INTERPRETATION.md`: the owner's rulings (R1 to R42) at the top, then the full interpretation. Each
  rule that is our default carries an assumption id such as **A2-07**; section 10 lists them with their
  confidence, section 11 holds the owner questions (Q-numbers) and Appendix A the tunables.
- `packages/engine/src/constants.ts` and `packages/engine/src/content/`: every number and switch the document
  names, so an owner answer is usually a one-line change. The card texts are generated from the same data (R35).
- The code cites the ids next to what they implement: search for `A8-11` or `R26` to find the code for a rule.
- Open questions found while building (Rogue's Assault, Shared wounds and the commander, Smite's splash, Queso's
  fallback square, ...) are listed at the end of "Known gaps" in `packages/engine/README.md`.

## Credits

Icons: game-icons.net (Lorc, Delapouite, Skoll, Sbed), CC BY 3.0. 3D models: KayKit and Kenney, CC0. Details in
`apps/web/public/assets/ATTRIBUTION.md`. Fonts load from Google Fonts; a production deployment in the EU should
self-host them (see `docs/analysis/research-art.md`, section 12).
