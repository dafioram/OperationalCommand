# Operational Command

A turn-based war-room strategy game for the phone. You're the Commander: read the morning debrief, weigh the odds, send squads out, and keep the base standing. You never fight a gunfight by hand.

It's a static web app (plain HTML, CSS and JavaScript, no build step and no runtime dependencies), so it runs anywhere that serves files, including GitHub Pages.

## Play

- **Online:** after you enable GitHub Pages (see [Deploy](#deploy-to-github-pages)), the game is at `https://dafioram.github.io/OperationalCommand/`.
- **Locally:** `npm start`, then open <http://localhost:8080>. Opening `index.html` straight from disk also works.

Progress saves to the browser's localStorage after every action, with two start-of-day restore points under **Saves**.

## How the game works

Each day you plan, then press **End Day** and everything resolves overnight.

- **Deploy:** pick a mission, a squad and a stance (Cautious, Standard, Aggressive). The odds are always shown before you commit. Each mission type has a squad size, and every missing troop costs −1 power.
- **Debrief:** every mission, raid and artillery strike comes back as a card with a timestamped log.
- **Base:** War Clock, base integrity, known threats, Home Guard, Training, buildings, research.
- **Roster:** levels, classes (chosen at Level 3), gear and injuries.

**Goal (prototype):** take all five outposts in Sector 1 before the War Clock and the raids grind your base down. No day limit, but the enemy grows stronger every day.

Key systems:

| System | In short |
| --- | --- |
| Outpost types | Garrison, Artillery, Supply hub, Radar station, Army depot, each with an effect until it falls |
| Zone Alert | Attacking the same zone draws reinforcements; quiet zones cool down |
| War Clock | Rises daily and when raids hurt you; each stage adds 1 threat to every enemy |
| Missions | Scout, Resource, Rescue, Recovery, Siege, Intercept, Sabotage, Hold, Extraction |
| Mission chains | Some wins unlock a follow-up: a cache, a fort's weak spot, or an ambush on the next army |
| Artillery | Research unlock. Shell an army or outpost in range for 15 Materials; Intel improves accuracy |
| Comms jamming | Research unlock. Freeze an army for a night for 2 Intel; recharges in 3 days |
| Training | Troops left at base earn 5 XP a night, no limit |
| Difficulty | Easy, Medium, Hard, chosen at campaign start |

The full design, including the planned three-sector campaign, is in [docs/DESIGN.md](docs/DESIGN.md).

## Project layout

```
index.html            The page shell
css/style.css         All styles (light and dark themes)
js/game.js            Game rules and state. No DOM, so it runs in Node for tests
js/app.js             UI: renders the state and handles taps
tests/unit/           Rule tests and a simulation test that plays hundreds of campaigns
tests/e2e/            Playwright smoke tests in a real browser (phone and desktop)
tools/serve.js        Tiny static server for local play and the browser tests
tools/policies.js     Automated players used by the simulator and the tests
tools/sim.js          Balance simulator: win rates per difficulty
tools/bundle.js       Builds a single-file version in dist/
docs/DESIGN.md        Game design document
.github/workflows/    CI and GitHub Pages deployment
```

## Development

Requires Node 20 or newer.

```sh
npm install          # installs Playwright (only needed for browser tests)
npm start            # play at http://localhost:8080
npm test             # rule and simulation tests (about 5 seconds)
npm run test:e2e     # browser smoke tests (first run: npx playwright install chromium)
npm run sim          # balance report: 1000 automated campaigns per difficulty
npm run sim -- 300 random   # stress the rules with a chaotic random player
npm run bundle       # single-file build at dist/operational-command.html
```

Game randomness is seeded, so the same seed and the same orders always replay the same campaign. That keeps tests deterministic and makes "Replay Day" in the Saves panel honest.

When you change a rule, run `npm test` and `npm run sim`. The simulation test fails if any of these break:

- No negative resources, no troop with two jobs, no mission over the slot limit.
- No outpost disappears from the game.
- Saves stay valid JSON.
- Medium stays winnable but not trivial.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

1. **Rules and simulation tests** on Node 20 and 22, plus a balance report in the job summary.
2. **Browser smoke tests** with Playwright on a phone and a desktop viewport. On failure, the report and traces are uploaded as an artifact.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow by hand).

The workflow runs the tests, copies `index.html`, `css/` and `js/` into the site, and publishes it.

## Saves and versions

Saves carry a version number. Older saves are upgraded automatically when you load the game (see `migrate` in `js/game.js`). If you change the save format, bump `SAVE_VERSION` and add a step to `migrate`. The test suite checks that old saves keep working.

## License

MIT. See [LICENSE](LICENSE).
