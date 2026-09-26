---
name: run-amboola
description: Run, start, launch, screenshot, drive or test the Amboola browser game (index.html, Three.js). Use when asked to run the game, take screenshots of the garage/city/cars, check a change works in the real game, or benchmark car physics (0-100, top speed, braking).
---

Amboola is a single-file Three.js game (`index.html`, no build step, no package.json). An agent drives it headlessly with `.claude/skills/run-amboola/driver.mjs`, a Playwright script that loads the game in SwiftShader Chromium. The driver takes screenshots after a list of steps (clicks and key presses), and it has a fixed-timestep physics benchmark for every car. All paths are relative to the repo root.

## Prerequisites

Nothing to install in the Claude Code cloud container. It already has Node 22, a global `playwright` (`npm root -g`), and Chromium at `/opt/pw-browsers`. The driver resolves Playwright from the global npm root. On first run it fetches three.js itself (`npm pack three@<version from index.html>` into `/tmp/amboola-three`, or `$AMBOOLA_CACHE`).

## Run (agent path)

Default flow, about 80 s: garage → DRIVE → full throttle 15 s → throttle+left+handbrake 5 s → hood camera → pause.

```bash
node .claude/skills/run-amboola/driver.mjs shots /tmp/amboola-shots
```

It prints each screenshot path, the final player state (`{"kmh":20.7,"gear":1,...}`) and either `no page errors` (exit 0) or the page errors (exit 1). Screenshots land in `/tmp/amboola-shots/{garage,drive,accel,drift,hood,pause}.png`. Look at them.

Custom flow: pass a JSON step list as the 3rd argument. Each step is processed in this order: `car` → `click` → `key`/`ms` → `press` → `wait` (default 400 ms) → `shot`.

```bash
node .claude/skills/run-amboola/driver.mjs shots /tmp/amboola-shots '[{"car":12,"wait":2000,"shot":"garage-cayenne"},{"click":"#drive","wait":2000},{"press":"KeyT","wait":1500,"shot":"cayenne-night"}]'
```

| step field | effect |
|---|---|
| `car: N` | select car N in the garage list (index into `CARS` in index.html: 0 = GT3 RS … 12 = Cayenne Turbo GT) |
| `click: "#sel"` | click a DOM element (`#drive`, `#bResume`, `#bGarage`, `#bTime`, `#bMute`) |
| `key: ["KeyW",…], ms` | hold the keys for `ms` |
| `press: "KeyC"` | tap one key (C camera, T time of day, M gearbox, R reset, Escape pause, H help) |
| `wait: ms` | sleep before the screenshot |
| `shot: "name"` | save `<outDir>/name.png` |

Physics benchmark, about 15 s. It runs every car at a fixed 1/180 s timestep, so the numbers don't depend on the headless frame rate:

```bash
node .claude/skills/run-amboola/driver.mjs bench
```

Output is one line per car, for example `911 GT3 RS  0-100 3.18s (spec 3.2)  vmax 296 (spec 296)  brake 100-0 24.1m`. Use it after touching `Player.update`, `derive()` or `torqueCurve()`.

`index.html` exposes a debug handle on `window.amboola` (`player`, `traffic`, `CARS`, `scene`, `gScene`, `audio`, `renderer`). Use it from `page.evaluate` when a check needs internal state.

## Run (human path)

Double-click `index.html`, or run `npx http-server -p 8765 -s .` and open `http://localhost:8765`. Both need internet, because three.js and Google Fonts come from CDNs.

## Test

There is no test suite. The checks are `driver.mjs shots` (must print `no page errors`) and `driver.mjs bench` (numbers near spec).

## Gotchas

- **The CDN fails through the sandbox proxy.** Chromium reports `ERR_CERT_AUTHORITY_INVALID`, or with `ignoreHTTPSErrors` it reports `ERR_TOO_MANY_RETRIES`, and the loading screen sticks on "Starting engine…" forever. The driver routes `cdn.jsdelivr.net/npm/three@X/**` to the local `npm pack` copy and aborts Google Fonts. `curl` to the CDN does work, so don't be misled by it.
- **The driver needs no web server.** It fulfills `http://amboola.test/*` straight from the repo, so there's no port to clean up.
- **SwiftShader renders at about 0.5–2 fps.** Game `dt` is clamped to 1/20 s, so 15 s of held throttle only reaches about 20 km/h. Never judge acceleration or handling from screenshots; use `bench`. Also expect about 600 ms per frame, which is normal.
- **Fonts fall back** (serif titles, missing Japanese glyphs on some signs) because Google Fonts is blocked. This isn't a bug in the game.
- **Audio can't be heard.** You can only check that the Web Audio graph runs: `window.amboola.audio.ctx.state === 'running'` after DRIVE.
- **`renderer.info` resets on every composer pass,** so a plain read shows `calls: 1`. To count per-frame draw calls, set `renderer.info.autoReset = false`, call `reset()`, wait one frame, then read. A normal value is about 400 calls and 600k triangles.
- **Driving Player headlessly in a loop skips collisions,** because `collideWorld()` is called from the frame loop, not `update()`. Such loops can run the car off the map; that's a test artifact.
- **The time of day persists in localStorage** (`amboola.t`) between visits in a normal browser. Every driver run starts from a fresh context, so it always starts at sunset.

## Troubleshooting

- **Loading stuck on "Starting engine…"**: the three.js modules failed to load. Check that `/tmp/amboola-three/package/build/three.module.js` exists, and that the three version in the `index.html` import map matches the cache (delete the cache dir to refetch).
