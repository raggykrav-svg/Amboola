---
name: run-sumer
description: Run, screenshot or test Sumer, the Limassol walking game in sumer/ (Three.js, separate from Amboola). Use when asked to run Sumer, take pictures of Limassol in the game, check a change to sumer/js/*.js works in the real page, or rebuild the city data (sumer/data/limassol.bin.gz).
---

Sumer is a static page: `sumer/index.html` loads ES modules from `sumer/js/` and the city file `sumer/data/limassol.bin.gz`. Three.js 0.169.0 and earcut 3.0.1 come from jsDelivr through an import map. There is no build step. All paths here are relative to the repo root.

## Run it headless (agent path)

```bash
node .claude/skills/run-sumer/driver.mjs /tmp/sumer-shots
```

- About 1 to 2 minutes. It prints `title after N s`, one `eval {...}` line per step and `shot <file>` per picture, then `no page errors` (exit 0) or the errors (exit 1).
- The default steps take: `title`, `molos` (with people), a walk and a run, `third` (third person), `sunset`, `night`, `drone` (Dasoudi beach) and `map`. Look at the PNGs.
- The first run fetches three and earcut with `npm pack` into `/tmp/sumer-cache` (`SUMER_CACHE` to change it). Google Fonts are skipped, so the page uses system fonts.
- `Q=low|medium|high|ultra` picks the graphics level (default medium). `DPR=2` gives sharp pictures for people to see (slower). `TOUCH=1` with `390 844` as the last two arguments gives the phone layout.

Custom steps: pass a JSON list as the 2nd argument. Each step can have `eval` (JS or `@file.js`; the value is printed), `press` (a key), `wait` (ms, default 300) and `shot` (file name). The helpers from `helpers.js` are already loaded:

| helper | what it does |
|---|---|
| `__go(x, z, yaw, pitch, mode)` | start playing if needed, teleport to x, z (metres; origin near the castle, x east, z south; yaw 0 faces north, -0.785 faces north-east), build the area, render. `mode` is `first` or `third`. Returns the street and district names, triangles, draw calls. |
| `__walk(['KeyW', 'ShiftLeft'], secs)` | hold keys for game seconds; returns the distance moved, `swim`, the street |
| `__live(secs)` | let people, cars and trees update; returns their counts |
| `__drone(x, y, z, yaw, pitch)` | drone camera |
| `__click('tMenu')` | press a button by id and return which panels are open (Playwright `page.click` times out under SwiftShader) |
| `__tris()` | triangles per kind of object |

Good spots: the Molos `352, 196, -0.785`; Agia Napa Cathedral `230, 170, 0, 0.18`; the beach under the ONE tower `1990, -1180, -0.75, 0.42`; Dasoudi beach `3990, -1930, -2.0`; old town street at night `46, -277, 0` with `sumer.setTime('night')`.

### How the driver works

- `window.__manualFrames = true` stops the page's own frame loop, because SwiftShader renders slowly. The helpers call `sumer.step(dt)` (game logic) and `sumer.render()`.
- Screenshots get a 180 s timeout. Ultra with `DPR=2` frames take several seconds each in SwiftShader.
- `window.sumer` exposes `city`, `player`, `env`, `forest`, `life`, `scene`, `camera`, `renderer`, `setTime(k)`, `startPlay(x, z, yaw)`, `openMap()`, `bigmap()`, `landmarks()`, `found`, `stats`, `state()`, `step(dt)`, `render()`, `hud()` and `warm()`.

## Run it yourself (human path)

`npx http-server -p 8080 .` in the repo and open <http://localhost:8080/sumer/>. Opening the file directly does not work, because the browser blocks `fetch` of the data file from `file://`.

## Things that broke before (check them after changes)

- **The flat ground does not write depth.** Ground, markings, the sea, the far land, the sky and the stars are drawn in order (`renderOrder`), so anything transparent drawn after them shows on top of the ground. The stars must stay opaque.
- **Big triangles lose precision.** The sea is a ring mesh centred on the camera. A single 240 km plane gave a grey sea.
- **The sky is a full-screen quad, not three's sky box** (`screenSpaceSky` in `env.js`). The box's faces crossed behind the camera and SwiftShader drew one of them as a big flat white triangle in the sky.
- **Things placed per chunk must stay inside their chunk.** Garden trees that landed past the chunk edge floated in the sea.
- **Face winding.** `quad3(a, b, c, d)` uses the normal (b - a) x (d - a), so check new faces from both sides.

## Rebuilding the city data

See `sumer/README.md` → *Rebuilding the city data*. The Python tools are in `sumer/tools/`: `extract.py`, then `build_data.py`, then `pack.py`; the places to find are in `landmarks.json`. The OSM extract of Cyprus from geo2day.com works from the cloud container (Geofabrik and overpass-api.de were blocked there).
