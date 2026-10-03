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

Custom flow: pass a JSON step list as the 3rd argument. Each step is processed in this order: `car` → `click` → `key`/`ms` → `press` → `eval` → `wait` (default 400 ms) → `shot`.

```bash
node .claude/skills/run-amboola/driver.mjs shots /tmp/amboola-shots '[{"car":12,"wait":2000,"shot":"garage-cayenne"},{"click":"#drive","wait":2000},{"press":"KeyT","wait":1500,"shot":"cayenne-night"}]'
```

| step field | effect |
|---|---|
| `car: N` | select car N in the garage list (index into `CARS` in index.html: 0 = GT3 RS … 12 = Cayenne Turbo GT) |
| `click: "#sel"` | click a DOM element (`#drive`, `#bResume`, `#bGarage`, `#bTime`, `#bMute`) |
| `key: ["KeyW",…], ms` | hold the keys for `ms` |
| `press: "KeyC"` | tap one key (C camera, T time of day, M gearbox, R reset, Escape pause, H help) |
| `eval: "js"` or `"@file.js"` | evaluate JS in the page (value of the last expression is printed as `eval <json>`); use `window.amboola.*` for internals |
| `wait: ms` | sleep before the screenshot |
| `shot: "name"` | save `<outDir>/name.png` |

Physics benchmark, about 15 s. It runs every car at a fixed 1/180 s timestep, so the numbers don't depend on the headless frame rate:

```bash
node .claude/skills/run-amboola/driver.mjs bench
```

Output is one line per car, for example `911 GT3 RS  0-100 3.18s (spec 3.2)  vmax 296 (spec 296)  brake 100-0 24.1m`. Use it after touching `Player.update`, `derive()` or `torqueCurve()`.

Races: from the garage use `{"car":N,"click":"#raceBtn"}` then `{"click":".rcard[data-k=\"0\"]"}` (0 = GP, 1 = Fujimi, 2 = Oval, 3 = Akagi, 4 = Kanto, 5 = Sakura Ring), or `{"eval":"window.amboola.startRace(window.amboola.TRACKS[0])"}` while driving. Real-time racing at about 2 fps is far too slow to finish a race. To simulate one, call `window.amboola.simStep(1/60, {throttle, brake, steer, handbrake})` in an `eval` loop. It runs the same gameplay tick as the frame loop, including physics, AI, laps and results. Steer with `trackNearest(T, x, z, hint)` against `T.x/T.z/T.k`. The results screen appears 1.6 s of *real* time after the finish, so `await` a timeout before reading `#results`.

Taxi: in the garage use `{"car":N,"click":"#taxiBtn"}`, or call `window.amboola.startTaxi()` while driving. State is in `window.amboola.taxi` (`phase` is `'pickup'` or `'dropoff'`; also `spot`, `route` waypoints, `fares`, `earnings`). To simulate a shift, steer toward `taxi.route` in a `simStep` loop and brake to a stop within about 8 m of `taxi.spot`. Park the traffic first (`traffic.update = () => {}` and move the cars away), because a naive autopilot gets stuck nose-to-nose with traffic that stops for it.

`index.html` exposes a debug handle on `window.amboola` (`player`, `traffic`, `CARS`, `scene`, `gScene`, `audio`, `renderer`, `TRACKS`, `race`, `startRace`, `simStep`, `trackNearest`). Use it from `page.evaluate` when a check needs internal state.

## Run (human path)

Double-click `index.html`, or run `npx http-server -p 8765 -s .` and open `http://localhost:8765`. Both need internet, because three.js and Google Fonts come from CDNs.

## Test

There is no test suite. The checks are `driver.mjs shots` (must print `no page errors`) and `driver.mjs bench` (numbers near spec).

## Record the trailer video

```bash
FFMPEG=/path/to/ffmpeg-with-libx264 node .claude/skills/run-amboola/trailer.mjs /tmp/amboola-trailer.mp4
PREVIEW=/tmp/tprev node .claude/skills/run-amboola/trailer.mjs     # ~1.5 min: runs every scene unrendered, screenshots each scene's middle frame
```

**Recording:**
- It takes about 25 minutes for about 1,600 frames at 1280×720, 24 fps.
- It steps the game one frame at a time (`window.__manualFrames` plus `amboola.tick(1/24)`), so SwiftShader's low frame rate doesn't matter.
- The scenes live in `trailer-director.js`, in this order:
  1. drag launch cold open, title
  2. 18-car garage montage
  3. Blender gallery (the `media/*-blender.jpg` pictures)
  4. buy a Supra, upgrade it, drag race it (launch, finish line, results)
  5. city, drift, GP race, outlaw, police, mountain, viewpoint, taxi, map
  6. end card
- `SCENE=i` re-records from scene *i* (also works with `PREVIEW`), and `MAXF=n` stops early.
- **Always run `PREVIEW` first.** It found a NaN-steering crash (a fresh car has no `.speed`) and blank gallery frames before a 25-minute recording.

**Soundtrack:**
- `soundtrack.py` synthesizes the music and sound effects from `window.__timeline()`. The timeline holds each scene's `sfx: [[frame, 'whoosh'|'beep'|'launch'|'impact'|'cash'|'siren']]`, so the sound is frame-exact even for partial re-records.
- The music is 128 BPM, Am F C G, and drops on the title.
- It needs numpy. The recorder uses Blender's bundled python (`/tmp/blender/.../python3.11`) or `$PYTHON`, and without numpy it writes a silent video.
- Headless Chromium's Web Audio output can't be captured, so the game's own engine sounds aren't in the video.

**Recorder notes:**
- Playwright's bundled ffmpeg has only VP8. For H.264, `pip download imageio-ffmpeg --no-deps` and use the static binary inside the wheel.
- Google Fonts are fetched with `curl` in a route handler, because the browser can't reach them through the proxy but curl can.
- The recorder serves real repo files. An earlier version answered every request with `index.html`, which would silently load no car models.

## Money, upgrades, drag races

- **Wallet and ownership:** `wallet` (`amboola.usd`, `amboola.owned` in localStorage) holds the dollars and the owned car ids. A fresh browser starts with $20,000 and owns `gr86`. Old yen saves are converted once at ¥150 = $1.
- **Prices:** every car in `CARS` has a `usd` price.
- **Garage:** `garageGo()` drives an owned car or buys the selected one. The mode buttons are wrapped in `ownedOnly()`.
- **Payouts:** `earn(usd)` pays out from finishRace, the taxi drop-off, the outlaw stash, the police arrest, drag races and banked skill chains.
- **Upgrades:**
  - Levels live in `upg` (`amboola.upg`): `{id: {e, t}}`, engine and tires 0–5.
  - `tunedSpec(car)` is the spec the physics drives: kW ×(1+.07e), vmax ×cbrt, ratios stretched, tpeak raised, grip ×(1+.05t).
  - `simSprint(spec)` runs the real physics headlessly for 0–100 and the quarter mile. The garage stats and the drag rival pick use it.
- **Drag races:**
  - `startDrag(DRAG_EVENTS[i])`, state is in `window.amboola.drag`.
  - States go `tree` → `run` → `done`. The tree is green at `drag.t >= 0`. Throttle during the ambers is a red-light foul.
  - The rival is a headless Player (`drag.r.ghost`).
  - To simulate a run, call `simStep(1/60, …)` with `throttle: 0` until `drag.t >= 0`, then full throttle and steer to `DRAG.z - DRAG.lane`. Set `player.manual = false` first, because the GR86 is a manual.
- **Upgrade kinds:** `UPG_KINDS` lists them, each with its own max: e 5, t 5, b 3, w 3, s 3, n 3. `UPG_FULL` maxes them all.
- **Tuned cars:** `tunedSpec(car, u?)` builds the tuned spec, and drag bosses pass `UPG_FULL`.
- **Nitro:** `inp.nitro` adds 2.6 m/s² after the traction cap while `player.nitro` (seconds) lasts. It is in readInput (Shift/X, the touch `tn` button, gamepad button 1) and shows in the `#nitroBar` HUD.
- **Stats and missions:** `ST` (`amboola.stats`) counts `dragWins`, `raceWins`, `fares`, `arrests`, `stashed`, `driftBest`, `bosses`, and `done` (finished mission ids). `bump()` and `best()` update it and call `checkMissions()`, which pays each of the 14 `MISSIONS` once and queues the `#achv` banner.
- **Daily bonus:** `checkDaily()` runs at boot (`amboola.daily` = {last, streak}). The first visit only records the day, so fresh driver contexts never see the popup.
- **Drag bosses:** they are the `DRAG_EVENTS` entries with `boss`, unlocked in order via `ST.bosses`.
- **Selling:** `sellCar()` pays `sellValue()` = 60% of the price + 50% of upgrade spend.
- **Testing:** the driver always starts from a fresh context, so pick `{"car":54}` (the GR86) or call `window.amboola.earn(n)` and then `updateMenu()` before `garageGo()`. Otherwise DRIVE/RACES/TAXI do nothing on locked cars.

## Customizing

- **Data:** `custOf(id)` / `saveCust(id, c)` keep `{rim, cal, tint, decal, dcol}` (indices into `RIMS`, `CALIPERS`, `TINTS`, `DECALS`, `DCOLS`; 0 = stock) in `amboola.custom.<id>`. Bad or old values fall back to stock. `sellCar()` clears them.
- **Applying:** `applyCustom(car, id)` runs on the garage car (`showGarageCar`) and the player car (`Player`) only, never on traffic or rivals. Rim and caliper materials are tagged with `userData.kind = 'rim' | 'cal'` in both `buildWheel` and `buildModelCar`. The shared `glassMat` is swapped for an opaque `tintMat(i)` (no transparency, so there's no sorting glitch).
- **Decals:** `decalPaint()` patches the car's own paint material (`onBeforeCompile`, `customProgramCacheKey 'amboola-decal'`). It projects the car-space position (via `uCarInv`, which each paint mesh's `onBeforeRender` refreshes) onto a 2048×1024 side canvas (top half = left side, bottom half = right side, text drawn mirrored there) and a 1024×512 top canvas. Both fade with the surface normal. `carGeom()` measures the paint bounds and wheel positions, so the designs are drawn in metres. `decalTex()` keeps an LRU of 8 texture pairs.
- **UI:** `#custBtn` opens `#custPanel` (left side, a bottom sheet on phones), and `#menu.customizing` hides the car list. `renderCust()` builds the swatches. `closeCust()` runs on car change and on DRIVE.
- **Testing:** own the car and preset the save with an `eval` step, e.g. `localStorage.setItem('amboola.custom.taycangt', JSON.stringify({rim:6,cal:3,tint:3,decal:4,dcol:2}))`, then pick the car. `AMBOOLA_VIEWPORT=390x844` runs the driver at phone size.

## Rebuild the Blender car models

All 14 Porsches are Blender models:
- **Building blocks:** `models/blender/carkit.py` holds them (loft, booleans, ray-cast decals, lights, wings, wheels, export, Cycles renders, contact sheets).
- **Lamps:** `Car.lamp(c, f, w, h, style)` builds a gloss housing with a chrome reflector and `'quad'` (4 LED pads: Taycan, Cayenne, Macan), `'tesla'` (eyebrow strip + 2 projectors) or `'strip'` lights. `Car.curtain()` cuts the vertical air curtains at the bumper corners.
- **Car definitions:** `models/blender/porsches.py` has one function per car id, plus the `CARS` registry. A new car is a new function and a registry entry.
- **Game loading:** `index.html` has one `<script src="models/<id>.glb.js">` tag per model. Each is a base64 copy of `models/<id>.glb`, so file:// works.
- **Building:** at boot `loadCarModels()` decodes the models (Draco, decoder from the three CDN). `buildCar()` then clones the model for any car id in `MODELS`, and falls back to the procedural body if a model fails to load.

The Lamborghinis and Ferraris (car indices 21–33) live in `models/blender/supercars.py`. It uses the same kit with sharp creases (`SHARP`) or soft ones (`SOFT`), and `remap()` reuses a station table on a car of another size. The McLarens and Bugattis (indices 34–46) live in `models/blender/hypercars.py`, which remaps `supercars.TFER` to each body. The Teslas (indices 14–20) live in `models/blender/teslas.py`. The Cybertruck uses `loft(crease_all=1.0, levels=1)` to get flat panels. All four scripts use the shared command line, `carkit.main()`, and every car has a model. Koenigsegg (indices 47–52) and Toyota (53–58) are in `koenigsegg.py` and `toyota.py`, appended after the Bugattis so saved garage indices stay valid.

There is no Blender in the container by default:

```bash
mkdir -p /tmp/blender && curl -sSL https://download.blender.org/release/Blender4.2/blender-4.2.3-linux-x64.tar.xz | tar xJ -C /tmp/blender
B=/tmp/blender/blender-4.2.3-linux-x64/blender
$B -b --factory-startup --python models/blender/porsches.py -- --car gt3rs,918          # export (~8 s per car)
$B -b --factory-startup --python models/blender/porsches.py -- --car 918 --renders /tmp/r --samples 8 --sheet --views front34,rear34,side --no-export
```

`--sheet` tiles the views at 640x360 into `/tmp/r/<id>-sheet.png`, about 15 s per car. It's the fast way to check a shape change, so look at it before exporting. To check them in the game, look at every car in the garage with `{"car":N}` steps (indices 0–13 are the Porsches).

Contract with the game: objects `Body`, `Wheel_FL/FR/RL/RR` and `Caliper_*`, each with its origin at the hub; material names `Paint`, `Glass`, `Headlight`, `Taillight`, `Rim`, `Caliper` and so on, which `buildModelCar()` swaps for game materials. The car is modelled front = +X; export turns it to glTF +Z.

Model gotchas:
- If a cross-section's points swap height order, the cage self-intersects and Blender flips all normals. You then see the wheel-well booleans *adding* cylinders, and every decal hidden inside the body. The script now forces outward normals, but keep each station's points ordered.
- Decals (glass, vents, lights) are ray-cast patches. When the rays hit the body at a grazing angle, the patch gets holes, so fan the rays from inside the car (`Car.fan()`) at wrapped corners.
- Decals only land on the body shell (the BVH from `surface()`). An open-top car's windscreen therefore has to be a free-standing `panel()`, and parts added after `surface()` (pods, wings) can't receive decals.
- Raised cars (the Dakar): build at normal height and pass `join(lift=...)`. Its wheel specs give `cz`, the wheel-well centre *before* the lift.

## Gotchas

- **Test on a high-DPI screen too:** `AMBOOLA_DPR=2 node .claude/skills/run-amboola/driver.mjs shots …` emulates a Retina/HiDPI display (deviceScaleFactor 2). One real bug only showed up there. Handing `EffectComposer` a pre-sized render target makes it treat that size as CSS pixels and multiply by the pixel ratio again, so the SMAA and bloom passes came out pr× too large and the 3D picture was squeezed into the top-left corner of users' screens. `setupComposer()` now calls `composer.setPixelRatio(pr)` then `composer.setSize(innerWidth, innerHeight)`. To check it, read `window.amboola.composer.renderTarget1` against `renderer.domElement.width/height`. Ultra at 2× (2560×1440 with MSAA) is too heavy for SwiftShader to click through, so test High at 2×.

- **The CDN fails through the sandbox proxy.** Chromium reports `ERR_CERT_AUTHORITY_INVALID`, or with `ignoreHTTPSErrors` it reports `ERR_TOO_MANY_RETRIES`, and the loading screen sticks on "Starting engine…" forever. The driver routes `cdn.jsdelivr.net/npm/three@X/**` to the local `npm pack` copy and aborts Google Fonts. `curl` to the CDN does work, so don't be misled by it.
- **The driver needs no web server.** It fulfills `http://amboola.test/*` straight from the repo, so there's no port to clean up.
- **SwiftShader renders at about 0.5–2 fps.** Game `dt` is clamped to 1/20 s, so 15 s of held throttle only reaches about 20 km/h. Never judge acceleration or handling from screenshots; use `bench`. Also expect about 600 ms per frame, which is normal.
- **Fonts fall back** (serif titles, missing Japanese glyphs on some signs) because Google Fonts is blocked. This isn't a bug in the game.
- **Audio can't be heard.** You can only check that the Web Audio graph runs: `window.amboola.audio.ctx.state === 'running'` after DRIVE.
- **`renderer.info` resets on every composer pass,** so a plain read shows `calls: 1`. To count per-frame draw calls, set `renderer.info.autoReset = false`, call `reset()`, wait one frame, then read. A normal value is about 400 calls and 600k triangles.
- **Driving Player headlessly in a loop skips collisions,** because `collideWorld()` is called from the frame loop, not `update()`. Such loops can run the car off the map; that's a test artifact.
- **The time of day persists in localStorage** (`amboola.t`) between visits in a normal browser. Every driver run starts from a fresh context, so it always starts at sunset.

## Troubleshooting

- **`game never finished loading` printed by the driver**: a syntax error stops the whole module from running, and the page shows no error. Find it with `node --check` on the extracted module script. One real cause: an inline `//` comment in a one-line statement that swallowed a closing `}`.
- **Garage or scene renders completely black for one car**: a degenerate triangle in an extruded body gave a zero-length normal, which becomes NaN in the shader, and bloom smears NaN over the whole frame. `extrude()` now replaces zero normals. To check a car, scan `normal` attributes for length 0 via `eval`.
- **Loading stuck on "Starting engine…"**: the three.js modules failed to load. Check that `/tmp/amboola-three/package/build/three.module.js` exists, and that the three version in the `index.html` import map matches the cache (delete the cache dir to refetch).
