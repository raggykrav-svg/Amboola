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
| `press: "KeyC"` | tap one key (C camera, T time of day, Y weather, M gearbox, R reset, Escape pause, H help) |
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
- **Stats and missions:** `ST` (`amboola.stats`) counts `dragWins`, `raceWins`, `fares`, `arrests`, `stashed`, `driftBest`, `bosses`, and `done` (finished mission ids). `bump()` and `best()` update it and call `checkMissions()`, which pays each of the 16 `MISSIONS` once (`ST.visited` holds the new areas reached) and queues the `#achv` banner.
- **Daily bonus:** `checkDaily()` runs at boot (`amboola.daily` = {last, streak}). The first visit only records the day, so fresh driver contexts never see the popup.
- **Drag bosses:** they are the `DRAG_EVENTS` entries with `boss`, unlocked in order via `ST.bosses`.
- **Selling:** `sellCar()` pays `sellValue()` = 60% of the price + 50% of upgrade spend.
- **Testing:** the driver always starts from a fresh context, so pick `{"car":54}` (the GR86) or call `window.amboola.earn(n)` and then `updateMenu()` before `garageGo()`. Otherwise DRIVE/RACES/TAXI do nothing on locked cars.

## Garage search

- `#carq` (in `#carsearch`, above `#carlist`) filters the list. `buildMenu` gives every `.caritem` a `data-q` (name, brand, category, its heading, description, `jp`, id, plus `electric ev` and `plane fly`, all through `carText`: no accents, lower case). `carFilter()` hides items unless every typed word matches, hides empty `.cat` headings, shows `#carqn` when nothing matches, and returns the first match.
- Keys: Enter selects that first match, Esc clears, and **/** focuses the box in the garage. The box's keydown stops propagation, so typing doesn't drive the garage's arrow and Enter keys.
- Test: set `#carq`'s value, dispatch an `input` event, then read the visible `.caritem b` texts.

## Customizing

- **Data:** `custOf(id)` / `saveCust(id, c)` keep `{rim, cal, tint, decal, dcol}` (indices into `RIMS`, `CALIPERS`, `TINTS`, `DECALS`, `DCOLS`; 0 = stock) in `amboola.custom.<id>`. Bad or old values fall back to stock. `sellCar()` clears them.
- **Applying:** `applyCustom(car, id)` runs on the garage car (`showGarageCar`) and the player car (`Player`) only, never on traffic or rivals. Rim and caliper materials are tagged with `userData.kind = 'rim' | 'cal'` in both `buildWheel` and `buildModelCar`. The shared `glassMat` (dark glass of procedural cars and closed glass pods) is swapped for an opaque `tintMat(i)`; the see-through `clearMat` of the Blender cars for `tintClear(i)`, the same tint made transparent.
- **Decals:** `decalPaint()` patches the car's own paint material (`onBeforeCompile`, `customProgramCacheKey 'amboola-decal'`). It projects the car-space position (via `uCarInv`, which each paint mesh's `onBeforeRender` refreshes) onto a 2048×1024 side canvas (top half = left side, bottom half = right side, text drawn mirrored there) and a 1024×512 top canvas. Both fade with the surface normal. `carGeom()` measures the paint bounds and wheel positions, so the designs are drawn in metres. `decalTex()` keeps an LRU of 8 texture pairs.
- **UI:** `#custBtn` opens `#custPanel` (left side, a bottom sheet on phones), and `#menu.customizing` hides the car list. `renderCust()` builds the swatches. `closeCust()` runs on car change and on DRIVE.
- **Testing:** own the car and preset the save with an `eval` step, e.g. `localStorage.setItem('amboola.custom.taycangt', JSON.stringify({rim:6,cal:3,tint:3,decal:4,dcol:2}))`, then pick the car. `AMBOOLA_VIEWPORT=390x844` runs the driver at phone size.

## AMBOOLA Mega Taxi

- **The car:** `amboolataxi` (CARS index 59, cat `AMBOOLA`, paint 35 'Amboola Sky'), built by `models/blender/amboola.py`. `CUST_DEFAULT` gives it the `Amboola tiger` decal (DECALS 8) in red, and `saveCust` and RESET compare against `custBase(id)`.
- **Taxi mode:** when `player.spec.id === 'amboolataxi'`, `startTaxi()` sets `taxi.mega`, and `newMegaJob` / `updateMegaStop` take over:
  - a crowd of `MEGA_SEATS` (20) boards one every 0.12 s while you are stopped;
  - then come `MEGA_STOPS` (4) drop-offs, paying `MEGA_PAY` ($10,000) per person.
- **Testing:** `window.__taxi()` returns the current taxi state. Hold the handbrake, not the brake, to stay stopped in a `simStep` loop, because brake at a standstill engages reverse.

- **AMBOOLA Sport:** 20 concept cars at CARS indices 60–79 (ids `tora` … `torazero`, bodies `amb_<id>`, models from `amboola_concepts.py`; their stripes are a fixed `Stripe` material baked into the model). Grip goes up to 2.2 (Tora Zero), the highest in the game. The `zero` values come from `driver.mjs bench`.

## Countries and the jet

- **Countries:** `COUNTRIES` (six of them, see below) are generic areas: a 20 km `Route` (built in 1 km chunks that `updateCountryCulling` hides past 7.5 km) plus a `Pad` town. Their gates are on the south edge at `rc(3)`, `rc(10)` and `rc(17)`. The city edge walls (`edgeWall`) have gaps at every gate. The north wall used to block the Snow Pass gate, and that is now fixed.
- **Overlapping areas:** `areaAt` picks the nearest area when area boxes overlap (the Dubai bridge runs inside the Wangan box).
- **The jet:** `amboolajet` (CARS index 80, `jet: true`):
  - `startDrive()` hands it to `startFlight()` and `state = 'fly'`; `updateFlight` runs the jet, the HUD (`#flyhud`) and the minimap;
  - `landJet()` / `finishLanding()` put you in `lastCarIdx()` at the airport;
  - the autopilot caps speed for turns and approaches, because at Mach 16 the turning circle is about 25 km;
  - `driver.mjs bench` skips the jet.
- **Testing:** `window.amboola.flyStep(dt)` steps the flight without rendering (rendering every frame in SwiftShader is far too slow for whole flights). `COUNTRIES[i].R.place()` puts a car on a bridge.

## Car commercials

- `playAd(c, 'boot'|'buy'|'show')` is a single-car ad; `nextAdCar()` now goes through every car (not only Lambos). `playAllAd()` is the ALL CARS montage (`ad.mode === 'all'`, `updateAllAd`, 1.6 s a car, waits up to 2.5 s for a model still loading). In tests, step it with `tick(1/3)`: at small steps SwiftShader takes many minutes.

- **What plays:** `playAd(car, 'boot'|'buy', done)` runs a 13 s ad in `state = 'ad'`; `tick` calls `updateAd(dt)`. The shot times are `AD_T`:
  - studio shots in `gScene`/`gCamera`, sweeping the existing spotlights;
  - street shots in `scene`/`camera`, with night and rain forced on, traffic and the player's car hidden, and `updateWeather` driven by the ad car.
- **When it plays:** `bootAd()` runs after loading and rotates the Lamborghinis (`amboola.adi`). `garageGo()` plays a `'buy'` ad after a purchase.
- **Ending it:** `endAd()` restores the time, weather, lights and car visibility, then calls `enterGarage()`. `AD_BRAND` holds the brand names, taglines and accent colours.
- **Driver:** it sets `localStorage['amboola.noad']='1'` (no ads at all) unless you run it with `AMBOOLA_AD=1`, and `trailer.mjs` always sets it.
- **Capturing frames:** set `window.__manualFrames = true` and step with `amboola.tick(1/30)` while `amboola.ad` exists. Set `__manualFrames` back to false afterwards, otherwise the canvas keeps showing the last ad frame.

## Weather and the new areas

- **Weather:** `weather` is `'clear'` or `'rain'` (`amboola.weather`); `setWeather()` / `cycleWeather()` (key Y). `weatherLook(T)` runs at the end of `applyTime()` and greys the sky/fog. `updateWeather(dt, p)` runs every driving frame:
  - it ramps `WX.wet` and sets `surfGrip`, which `Player.update` multiplies into every `s.grip` (wet ×0.82, snow ×0.8);
  - it moves the rain (`LineSegments` on layer 1, so the reflection camera skips it) and the snow (`Points`);
  - it fires lightning and calls `audio.weather()` / `audio.thunder()`.
- **Wet film:** `buildWetFilm()` lays a 720 m film at y 0.075 that follows the camera. On Medium and up it is a `Reflector` with `WET_SHADER`: a vertical smear, raindrop ripples and puddle noise, discarded over the sea (`uShore`) except the beach town rectangle (`uIsland`). On Low it is a plain sheen. It is rebuilt when the quality changes (`WX.filmQ`). `WX.roads` materials (highway, mountain roads) get lower roughness when wet.
- **Areas:**
  - `Route` (ribbon road: samples, `near`, `collide` with rails/median, `place`) and `Pad` (union of flat rectangles with box colliders, edge walls except at route `mouths`) are generic.
  - `AREAS` = `wangan` (`WANGAN` route + `BEACH_PAD`) and `snow` (`SNOW_ROUTE` + `SNOW_PAD`, terrain `snowHeight`).
  - `collideWorld` calls `areaCollide(p)` for anything outside the city box, and `atGate(p)` lets cars through the edge wall at each gate.
  - `HwyTraffic` drives the highway cars and recycles them out of sight. `updateAreas()` animates the Ferris wheel, lighthouse, chairlift and onsen steam.
  - The GPS treats each area (and Mt. Amboola) as a zone with a gate: `zoneAt`, `ZONES`, `navRoute`.
- **Testing:** `window.amboola` exposes `AREAS`, `WANGAN`, `SNOW_ROUTE`, `SNOW`, `BEACH`, `WX`, `setWeather` and `hwyTraffic`. `WANGAN.place(player, i, -1)` puts the car on the highway at sample `i`. To check a route end to end, drive it with an autopilot `eval` that calls `simStep` with steering toward the sample about 12 ahead. Both routes were run both ways like this.

## Stunts, damage, speed cameras, night meets, desert

- **Flying:** `Player` has `vy`, `air`, `ap`/`ar` (pitch/roll in the air), `loop`, `wreckT`, `surf`, `gx`/`gz` (ground slope) and `terrain`.
  - `collideWorld` sets `p.surf`: `city`, `pad` (a pad with `air: true`, i.e. country towns and the desert), `glue` (other pads), `route`, `mtn`, `track`, `drag`.
  - `stuntStep(p, dt, px, pz, yPrev, inp)` runs after `collideWorld` in every `simStep` sub-step. On `city`/`pad` ground it adds ramp heights, makes too-tall faces into walls, and integrates `vy`. The car takes off when the ground drops faster than gravity (a lip: `yBall > G + .06`; a crest: `(vyG - vy)/dt < -12.5`).
  - Everywhere else the car stays glued to the road as before.
  - `takeoff` splits the along-ramp speed into horizontal and vertical (no free energy). `landCar` checks the up vector against the ground: if `up < .4` it is a `wipeout`, otherwise `scoreJump`.
  - `Player.airUpdate` handles the air controls. Throttle/brake/steer held at take-off are "armed" only after release.
- **Ramps and loops:** in `STUNTS` (`addRamp` with profiles `kick`/`land`/`wedge`/`table`, `addLoop`).
  - `buildStuntPark()` uses city blocks (9,11) and (8,11). They are flagged `'stunt'` in `special`: generated normally and then dropped (`genSnap`/`genDrop`, `colMute`), so the random city stays identical.
  - `buildCountryStunts(C)` places ramps on the country streets.
  - A loop is ridden on rails by `loopStep` (energy along the ring; it drops off when `v²/R + g·cos θ < 0`), and the camera watches from the side (`L.cam`).
  - `window.amboola.STUNTS`. Test with physics-only `simStep` loops: put the car 40 m before a ramp, heading `S.ry`, at 26 m/s.
- **Damage:** `carHit(p, dvx, dvz, hit, zone)` gets the velocity change from `simStep`, traffic, the race AI and stunt crashes.
  - It adds a dent `[x, y, z, r, depth, zone]` in car space (+Z front, +X = the car's left) to `DMG[id]` (`amboola.damage`).
  - `dentCar(car, dents)` clones the body geometry once, then rebuilds positions and normals from the originals for every dent. Trim gets 86% of the push so it stays on top of the paint, and the paint gets vertex-colour scuffs.
  - `dmgZones`, `repairCost`, `repairCar`; `#repairBtn` in the garage; `#dmgHud` in the HUD.
- **Speed cameras:** `SPEEDCAMS` (`buildSpeedCams`, 7 gantries).
  - `updateSpeedCams` triggers 24 m before the gantry when `areaNow.R` is that bridge.
  - `snapCam` updates `camBoard` (`amboola.speedcams`: top runs plus the best photo as a JPEG data URL), pays out, and sets `camPhotoReq`.
  - `takeCamPhoto()` runs right after `composer.render` in `tick`: one plain `renderer.render(scene, photoCam)` to the canvas, then `drawImage` into a 480×270 card (the flash overlay hides that frame).
  - The leaderboard is `#camPanel` (`openCamPanel`).
- **Night meets:** `MEETS` (stunt park and the harbour lot, block (12,19) via `buildMeetLot`), with racers from `NEON_CREW`.
  - `updateMeets` shows the parked neon cars only when `timeName === 'night'`, and sets `meetNear` → `#meetprompt` → `openMeet`.
  - `startMeetRace` builds `streetPath` (the `taxiRoute` corners, rounded and shifted 3.9 m left) for a `StreetRacer` (curvature speed limits plus a rubber band) and sets the GPS to the finish. `updateMeetRace` runs in `simStep`, and `endMeetRace` hands over the car (owned, nearest paint, `cust.glow`) or takes the stake.
  - Beaten racers go to `amboola.meet.beaten`.
  - Underglow is `addUnderglow(car, col)`, also a customize option (`GLOWS`, `cust.glow`).
- **Desert:** `DESERT` east of Dubai is an extra rectangle on Dubai's pad.
  - `C.P.y = duneH`, `C.P.grad = duneGrad`, `C.P.terrain` returns `'sand'` or `'water'` (the oasis). `Player.update` uses `offroadOf(spec)` for grip and sand drag.
  - `buildDesert` builds a 5 m-grid mesh with ripple texture and vertex colours, the oasis, rocks, camels (`MODELS.camel` from `models/camel.glb.js`, made by `models/blender/camel.py` with the Skin modifier), and the rally gates.
  - `updateRally` and `finishRally` use `RALLY_PTS` (index 0 is the start/finish arch); the best time is in `amboola.rally`.
  - Test with `travelTo(PLACES.find(q => q.n === 'Dubai Desert'))` and an autopilot to `RALLY_PTS[rally.i]`. The Yuki finishes in about 1:20 (shift manual cars like the GR86 yourself, or they stay in 1st).
- **Skill chains** are capped at ×5 and $20,000 a chain, and sliding on sand scores at a quarter of the rate. A long desert drift once banked $540k.

## The big update: countries, Fuji, ferry, bus, HQ, secrets, story, seasons

- **Six countries:** `COUNTRY_DEFS` holds Cyprus, Italy, Dubai, Paris (`rc(6)`), New York (`rc(13)`) and the Swiss Alps (`rc(1)`, `snowy: true`, so `inSnow` is true there). The builders are `buildParis`, `buildNewYork` and `buildAlps`.
- **Activities:** `ACTS` / `addAct({x, z, r, col, title, sub, sign, go})` are the rings you stop in and press Enter. `busyAct()` blocks them during a job, and `endActs()` ends every job. Countries have `startCRace`, `startDeliv` and `startWorldRace`, the `PATROLS` police (`chase`, `endChase`) and `BridgeTraffic`.
- **Mt. Fuji:** `FUJI`, `FUJI_ROUTE` (from the west gate `[-HALF, rc(3)]`) and `FUJI_PAD` form an area in `AREAS` (zone `'fuji'` in `ZONES`). `buildFujiArea` builds it and `updateFujiArea` makes the mountain opaque within 7.5 km. The jet destination is `'Mt. Fuji'` in `flyDests()`.
  - **ConeGeometry bug:** in this three.js, a `ConeGeometry` with more than one height segment drops half its triangles, which shows as a checker pattern. Use `CylinderGeometry(.01, r, h, …)` instead.
- **Ferry:** `ferryDock(id)` gives the quay, the drive-off spot and the ring. `openFerry(from)` → `startFerry(from, to)` sets `state = 'ferry'`, and `updateFerry` runs a cinematic in phases `board` → `go` → `arrive` → `off`. `endFerry()` puts you at `D.out`. Test it with manual `tick()`s, or call `startFerry` and then `endFerry()`.
- **Bus:** car `amboolabus` (appended at the end of `CARS`, so saved indices stay valid; the model is `models/blender/bus.py`). `busStops()` lists the stops, and `openBus`, `startBus`, `updateBus` (called from `updateActs`, not from `simStep`) and `endBus` run the job. `busCrash` drops passengers on hard hits.
- **HQ:** `HQ` is block (11,11), a `'stunt'` special block, so the random city is unchanged. `buildHQ` and `updateHQ` (best owned cars on `HQ.slots`, cups = `ST.done.length`). `openTrophies()` reuses `#meetPanel`.
- **Secret cars:** `SECRETS` (one per country and one at Fuji). Progress is in `amboola.secrets`, and `updateSecrets` claims a car within 7 m below 8 m/s.
- **Story:** `STORY` chapters, with progress in `ST.story`. `updateStory` (once a second) writes `#storyhud` and pays rewards, and `openStory()` shows the chapters.
- **Seasons:** `season` (`amboola.season`, default from the month), `applySeason()` (city tree crowns via `seasonLook.trees`, grass, ground, land, Fuji sakura) and `cycleSeason()` (key U). Winter makes `WX.snowy` true in the city (snow, grip 0.8). Spring and autumn reuse the snow particles with `uCol` for petals and leaves.

## Rebuild the Blender car models

All 14 Porsches are Blender models:
- **Building blocks:** `models/blender/carkit.py` holds them (loft, booleans, ray-cast decals, lights, wings, wheels, export, Cycles renders, contact sheets).
- **Lamps:** `Car.lamp(c, f, w, h, style)` builds a gloss housing with a chrome reflector and `'quad'` (4 LED pads: Taycan, Cayenne, Macan), `'tesla'` (eyebrow strip + 2 projectors) or `'strip'` lights. `Car.curtain()` cuts the vertical air curtains at the bumper corners.
- **Car definitions:** `models/blender/porsches.py` has one function per car id, plus the `CARS` registry. A new car is a new function and a registry entry.
- **Game loading:** `index.html` has one `<script src="models/<id>.glb.js">` tag per model. Each is a base64 copy of `models/<id>.glb`, so file:// works.
- **Building:** at boot `loadCarModels()` decodes the models (Draco, decoder from the three CDN). `buildCar()` then clones the model for any car id in `MODELS`, and falls back to the procedural body if a model fails to load.

The Lamborghinis and Ferraris (car indices 21–33) live in `models/blender/supercars.py`. It uses the same kit with sharp creases (`SHARP`) or soft ones (`SOFT`), and `remap()` reuses a station table on a car of another size. The McLarens and Bugattis (indices 34–46) live in `models/blender/hypercars.py`, which remaps `supercars.TFER` to each body. The Teslas (indices 14–20) live in `models/blender/teslas.py`. The Cybertruck uses `loft(crease_all=1.0, levels=1)` to get flat panels. All four scripts use the shared command line, `carkit.main()`, and every car has a model. Koenigsegg (indices 47–52) and Toyota (53–58) are in `koenigsegg.py` and `toyota.py`, appended after the Bugattis so saved garage indices stay valid.

Mercedes-AMG and Rolls-Royce (indices 90–96) are in `models/blender/merc_rolls.py` (`panamericana()`/`star()`, `pantheon()` with the Spirit of Ecstasy, and a hand-made brick table `TG` for the G 63). Tall bodies set `roofY` after the `roofY` loop so the chase camera sits high enough. BMW, Audi and the Devel Sixteen (car indices 81–89, after the jet) are in `models/blender/bmw_audi.py`. It reuses `toyota.gt_coupe` and `toyota.hatch`, the Taycan sedan table and the mid-engine table, and its faces are `kidneys()` (BMW) and `singleframe()` (Audi). Inside one `Object.assign(BODIES, {...})` block, a body can only spread a body from an *earlier* block (`BODIES.koenigsegg` is undefined inside its own block, which stopped the game loading). `driver.mjs` prints page-error stacks with `AMBOOLA_STACK=1`.

There is no Blender in the container by default:

```bash
mkdir -p /tmp/blender && curl -sSL https://download.blender.org/release/Blender4.2/blender-4.2.3-linux-x64.tar.xz | tar xJ -C /tmp/blender
B=/tmp/blender/blender-4.2.3-linux-x64/blender
$B -b --factory-startup --python models/blender/porsches.py -- --car gt3rs,918          # export (~8 s per car)
$B -b --factory-startup --python models/blender/porsches.py -- --car 918 --renders /tmp/r --samples 8 --sheet --views front34,rear34,side --no-export
```

`--sheet` tiles the views at 640x360 into `/tmp/r/<id>-sheet.png`, about 15 s per car. It's the fast way to check a shape change, so look at it before exporting. To check them in the game, look at every car in the garage with `{"car":N}` steps (indices 0–13 are the Porsches).

Contract with the game: objects `Body`, `Wheel_FL/FR/RL/RR` and `Caliper_*`, each with its origin at the hub; material names `Paint`, `Glass`, `Headlight`, `Taillight`, `Rim`, `Caliper` and so on, which `buildModelCar()` swaps for game materials. The car is modelled front = +X; export turns it to glTF +Z.

Forza finish (added by `join()` to every car except `lite` traffic and open-top cars, after `details()`):
- `number_plates()` puts a 330x165 mm `Plate` slab with a `GlossBlack` frame on the nose and the tail. It scans for the flattest upright patch near the usual height (6 rays must hit with `|n.x| > .6` within 6 cm of each other) and skips spots near `badge`/`exhaust` parts or `Headlight`/`Taillight`/`Titanium` vertices. In the game `paintPlates(body, id)` finds the `plateMat` meshes, splits them by the sign of glTF z (front/rear) and lays a `PlaneGeometry` with a canvas plate on each (`plateNumber(id)`: town, class, hiragana, number, from a hash of the id).
- `open_cabin()` makes see-through glass. Every `Glass` patch with an open outline (closed glass pods stay dark) becomes `GlassClear`, and `frame_ring()` slides its outer ring of cells into a black frit band (`FRIT`: 4.5 cm windscreen, 4 cm rear, 2 cm sides). The inner part, thickened by `block()` (each vertex stops short of the shell's far side, measured with `reach()`), is boolean-cut out of the skin with a `Cutter` material whose faces are then deleted. Every cut is checked: if the skin loses far more or far less than the window's area, the body is put back and the cut retried shallower, then with `use_self`, `use_hole_tolerant` and the `FAST` solver; if all fail, that window stays dark `Glass` (the M2 and GR Corolla needed retries). Afterwards any skin face with clear glass within 3 cm along its normal is deleted too (folded shells like the Supra keep a second layer the boolean misses). Glass cells within 5 cm of another window, or bent more than ~44° from the patch's mean normal, stay black (pillars). The `ws_trim`/`rw_trim`/`dlo_trim` patches (tagged with `['grow']`) shrink to rings that tuck under the frit. The shell round the glass is copied 2 cm inwards, turned inside out and decimated as the `Cabin` lining (back-facing from outside, so it never shows there). The old closed `cabin` tub and seats go; new `Leather`/`Alcantara` seats, a `Dash` (as wide as the narrowest of six width rays, so it never pokes through the doors) with `Screen`s, a wheel on the right (-Y). `k.no_wheel` makes a robotaxi cabin (no wheel, dials or gear lever, one big middle screen) and `k.two_seats` drops the back rows; the Cybercab sets both, and the plain cockpit hides its wheel, hands and dials for `spec.robotaxi` and a console are placed from the windscreen and rays fired inside the shell (roof, floor, width). Long glasshouses get rows of benches.
- In the game `GlassClear` is `clearMat` (transparent .42, `DoubleSide`, no depth write) and window tints become `tintClear(i)`. `cabinMats` (`Cabin`, `Leather`, `Alcantara`, `Dash`, `Screen`) carry `userData.cabin`, so `buildCockpit` hides them (and the double-sided glass) when you sit inside.
- Mirrors: `mirrors()` builds a rounded-rectangle housing, a `Chrome` glass and a `GlossBlack` arm ray-cast to the door below the window line (`mirrorbase`).

Real-car shapes: `models/blender/carshape.py` builds a station table from a dict of real measurements and outline points (`L, W, H, WB, fo` plus `top`, `belt`, `plan`, `roof` as `[(x, value)]` and `cab = (windscreen base x, windscreen top x, rear glass top x, rear glass base x)`; axles at `+-WB/2`). `build(k, P, F, R, crease)` lofts it, cuts the arches and adds windscreen, rear window, side glass, door lines, mirrors and the cabin tub, and returns a `Shape` (`S.nose`, `S.tail`, `S.top(x)`, `S.belt(x)`, `S.plan(x)`, `S.roofw(x)`, `S.zb(x)` for placing details). `scaled(P, L=, W=, H=, WB=, fo=, **over)` stretches one car's outline to another's size (nose, wheelbase and tail separately). Every brand script except the Porsches, the AMBOOLA cars, the G 63 brick, the Cybertruck/Cybercab and the 2008 Roadster uses it. The old remap helpers (`supercars.remap` + `TFER`/`TFGT`, `toyota.gt_coupe`/`hatch`, `hypercars.glasshouse`, `teslas.glass`) remain for the AMBOOLA cars and traffic.

`side_glass()` lowers the top outline wherever a side ray hits a surface with `|n.y| < 0.42`: a window drawn up onto the roof skin would otherwise make `open_cabin()` cut the roof away (that is what turned the remapped mid-engine cars into "convertibles").

911 shape: `T911` in `porsches.py` was traced from a 1:25 side/top/front/rear drawing of the 992 GT3 RS (scale checked: the hub spacing comes out at the real 2.457 m wheelbase). `body_911()` owns everything the seven 911s share (glasshouse, round domed headlights via `headlight_911(..., bowl='Gloss', dome=.045)`, mirrors, light bar); the variants only add bumpers, vents, wings and wheels. To check a shape against a drawing, render the model's silhouette with an orthographic camera per view (Cycles, 1 sample, transparent film; Workbench needs a GPU) and lay it over the drawing at the drawing's scale.

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

## HD photos of the cars (Blender)

`models/blender/photo.py` takes 1920×1080 Cycles photos of any car. It runs from any car script's command line; a `--photo` run never exports the model:

```bash
B=/tmp/blender/blender-4.2.3-linux-x64/blender
$B -b --factory-startup --python models/blender/supercars.py -- --car sf90 --photo /tmp/p --looks studio,sunset,neon --views front34,rear34
$B -b ... -- --car sf90 --photo /tmp/p --looks sunset --samples 16 --size 960x540     # ~20 s preview: check the look before a full render
```

- **Speed:** a full frame (128 samples, adaptive, OIDN denoise) takes about 7–8 minutes on this container's 4 CPUs. Preview at `--samples 16 --size 960x540` while changing a set.
- `shoot(k, folder, looks, views, samples, size)` is called by `carkit.main()` after the builder. It deletes carkit's own preview set, then:
  - `upgrade_materials()` rebuilds the game materials by name. Paint, Livery, Stripe and AmbAccent become a metallic base with Voronoi flakes in the base normal under a 0.012-rough clear coat. `GlassClear` becomes Transparent mixed with Glossy by Layer Weight Fresnel, so the cabin shows. Carbon becomes a checker twill that drives the anisotropy rotation. Lamps are emissive. Tyres get a rubber micro-bump.
  - `steer()` turns `Wheel_FL/FR` and `Caliper_FL/FR` about their hubs: +16° for front views, −10° for rear ones.
  - `paint_plates(id)` puts green lettering on the outer face of each `Plate` slab, using Blender's own `Noto Sans CJK Regular.woff2` and `plate_number()`, a port of the game's `plateNumber()`. Each line is measured and stretched to fit its box.
  - `frame_camera()` fits the camera to a sample of the car's real vertices, not the bounding box: 76% of the width or 62% of the height. It centres the car with lens shift (slightly low in the frame), sets DOF f/5.6 focused at the 20th-percentile depth, and uses `clip_end` 20 km so the mountains show.
- **Looks** (each set is built round the camera direction):
  - `studio`: a curved cyclorama, a 2000 W softbox overhead (spread 100°), strip lights along the flanks (spread 45°, so the floor doesn't mirror them), cool and warm rim lights, a spot that makes the backdrop glow, exposure −0.35.
  - `sunset`: a painted world (a Generated-Z colour ramp plus a sun glow and disc from the dot product with the sun direction). Nishita looked olive at a 3° sun. The sun sits 9° off the view axis so it is in the picture; a warm Sun lamp and a soft fill from the camera side. A road with markings over a desert plane, and two rings of emissive haze mountains (5.2 km and 3 km out).
  - `neon`: a wet street (`wet_ground`, puddles = mirror patches where the noise peaks), a wall with pink and blue tubes, blue key and pink rim area lights.
- **Exposure:** the exposure is per look; light paints (luminance over 0.35) get `1.2 × (lum − 0.35)` less, so white cars keep their shading.
- **Lens:** the compositor adds Fog Glow (threshold 1.2), Lens Distortion dispersion 0.012 and a blurred-ellipse vignette. The view transform is AgX Punchy.
- **Views** (`VIEWS`): `front34`, `rear34`, `side`, `low` (40 mm at 0.42 m), `front`, `top`.
- **In the garage:** `HD_PHOTOS` (after `CARS` in index.html) lists each car's sets. `hdStrip(c)` (called from `updateMenu`) fills `#hdStrip` with `media/hd-cars/thumbs/` thumbnails (384×216) and a button. `hdOpen(i)` / `hdShow()` drive the full-screen viewer `#hdView` over `hdList()` (every photo in `CARS` order); `#hdGo` calls `selectCar`. A capture-phase keydown listener gives the viewer ← → and Esc before the garage sees them. A new photo needs its JPG, its thumbnail and an `HD_PHOTOS` entry. To test it headless, hide `#gl` first (`display:none`) and set `__manualFrames`, or page screenshots time out on the WebGL canvas.
- **Every garage car** (125) has a photo. The batch used the game's default paint for each car: `--paint`, `--key ed_<cid>` for special editions on their `MODEL_ALIAS` base, and `--livery`/`--helmet` for the F1 teams on `f1.py`. Sets cycled studio → sunset → neon, with paints darker than luminance 0.03 always in the studio. It ran at `--samples 64` (4–6 min a photo; 64 is as clean as 128 after OIDN).
- **Not carkit:** `photo.py` runs standalone for these. `--heli` builds `heli.py` (nose −Y, turned to +X). `--glb FILE --key ID` imports a glTF with its nose along glTF +Z. `PARTS = ('',)` frames every mesh. The jet (three.js only) is exported from the game with `jet-export.js` (an `eval` step: it selects the jet, names the paint/glass/accent materials, hides the flames and returns a base64 GLB), then shot on `sunset`, because the studio lights are sized for cars. The studio backdrop and neon wall move back to `max(L, W)/2 + 4` (+3) for big vehicles.
- **`buildJet` fix:** the fuselage lathe was rotated twice (`rotateX(π/2).rotateX(π)`), which put the needle nose at the back inside the nozzles. It is now `rotateX(π/2)` only.
- `hd-photos.py` rebuilds `HD_PHOTOS` in index.html from `media/hd-cars/*.jpg` and fails if a thumbnail is missing.
- **Pictures:** the finished ones are in `media/hd-cars/<id>-<look>.jpg` (JPEG q90), plus the contact sheet `media/hd-cars.jpg`.

## Car kit details pass

`Car.join()` calls `Car.details()` before it merges the parts.
- It adds wipers along the bottom of the `windscreen` patch, chrome door handles just ahead of each `doorline`, a gloss-black `sill` decal, front and rear `badge` ovals, an `antenna` shark fin (skipped on open tops, which `cut_box` flags), `hoodline` shut lines, and a `grillemesh` of raised diamonds over black `grille`/`intake`/`mouth` patches.
- Each detail is skipped when a part with that name already exists. Set `k.no_details = True` to turn the whole pass off.
- `_wheel` now adds `spokeface` (RimLip) strips, a `drill` pattern on the disc, `letter` blocks (TireLetter) on the sidewall, and curved `Caliper_*` arcs with a `Logo` strip.
- New material names (`TireLetter`, `Logo`, `Accent`) are not in the game's `MAT` table, so they keep their glTF colours.
- `Car.sculpt(wheels)` (called at the start of `arches`) deforms the subdivided shell. It adds fender flares (`flare_amt`, default 0.045 m, ×0.4 for bodies longer than 5.6 m), a dished bonnet between the front wheels, undercut nose and tail below 30 % of the height, and a 3.5 % plan taper over the last 12 %. `loft` also forces creases of at least 0.5 on the shoulder and beltline edges, and at least 0.6/0.8 on the nose and tail rings.
- `details()` also adds a `splitter` (Carbon) under the lowest point of the nose and four `difffin`s (plus a `diffuser` plate if the car has none).

## Traffic models

- `models/blender/traffic.py` builds `tr_kei`, `tr_taxi`, `tr_sedan`, `tr_van`, `tr_truck` and `tr_police` with `k.lite = True` and `loft(levels=2)`. Lite wheels have a 28-segment tyre without grooves or letters, 24-segment rims/discs, no `spokeface`, `drill` or calipers; `details()` skips the grille mesh. That is 11–22k triangles a car. The sedan and police car remap the Taycan table (`TTAY`) and the taxi the Cayenne SUV table (`TCAY_SUV`), using the Teslas' `glass()` helper. Kei, van and truck have their own station tables. `two_tone(k, z, nose_x, drop)` bisects the police shell and paints the lower half `GlossBlack`.
- In `index.html`, `TRAFFIC_MODELS` load before the game starts on desktop and first in `loadAllModels` everywhere. `trafficKit(id)` merges a model into one geometry per material (Paint stays per car; lamps use `tHeadM`/`tTailM`, which `applyTime` dims with `userData.k`). `buildTrafficCar(T)` builds the box car as `userData.lo` and `dressTraffic(g)` wraps it with the model in a `THREE.LOD` (switch at `TRAFFIC_LOD`, 70 m, 45 m on touch). Cars built before their model arrives wait in `trafficWaiting` and are dressed by `trafficModelIn(id)` from `loadModel`. `buildPoliceCar()` uses `POLICE_T` (`n: 'police'`) and moves its light bar to `kit.top`.
- Check: every `traffic.cars[i].mesh` should have exactly one child, a `THREE.LOD`. Cameras close to traffic go through `window.__camHook`. The player's headlights blow out a white car parked right in front of them at night, so frame traffic from the side.

## Tokyo (Blender)

- **Records:** `buildWorld` records every block building in `TOKYO.b`:
  - kinds `bld` (`fi`, `y0`, `podium` / `top`), `house` (`rise`, `col`, `rcol`) and `ware`.
  - It draws them into separate `tk*` GBs, so `TOKYO.meshes` can be hidden. The stunt-block rollback (`genSnap`) includes them.
  - `TOKYO.lm.tower` / `.temple` are the landmark groups. `buildTemple` now has its own meshes.
  - `TOKYO.trees` / `.vend` are the tree and vending-machine InstancedMeshes.
- **Model:** `city_tokyo.py` builds:
  - families 0–4, the same as `FACADES`, in sizes `n` (18 m) and `w` (36 m) as `G` (5 m), `U` (3.6 m), `S` (4×3.6 m) and `R`; `Q` is the podium roof;
  - houses `H`/`HR` (8.5 m, 6 m + 2 m rise) and warehouses `W`/`WR` (26 m, 11 m);
  - `T_trunk`/`T_crown`, `V_body`/`V_glow`, `L_tower`, `L_temple`;
  - an `l`-suffixed plain twin of each building module.
- **Rules:**
  - Keep rooftop plant in the corners: `heliJob` puts its people in the middle of a roof.
  - Keep wall details shallow (under about 1.4 m), or the facade billboards sink into them.
- **Game:** `upgradeTokyo()` runs after `buildWorld` (desktop preloads `city_tokyo` with the traffic) or when the model arrives.
  - It stacks modules to each record's exact height: `F = round(rest / 3.6)` floors, `S` for each group of four, `U` for the rest, stretched by `rest / (F × 3.6)`.
  - It makes one InstancedMesh per module part for the whole city (shared bounding sphere).
  - `updateTokyoLOD` (from `updateCountryCulling`) refills them when the camera has moved 25 m: buildings within `TOKYO_NEAR` (240 m, 150 m on touch, 0 on Graphics LOW) get the detailed modules and the rest get the `l` twins. Empty meshes are hidden.
  - Trees and vending machines only get new geometry, so the seasons' crown colours and the machine colours stay.
- **Check:**
  - `window.amboola.TOKYO.city` exists and every `TOKYO.meshes` is hidden.
  - At the start position, about 2.3 M triangles and 1,290 draw calls a frame, against 1.57 M and 1,014 for the old boxes.

## Real-looking buildings

- `cityParts()` passes each part's material through `cityLook(mat, kind)`. It patches each material once, and `CITY_KIND` covers wall 1, roof 2, glass 3 and win 4.
- `cityShader` (`onBeforeCompile`, `customProgramCacheKey 'city-k'`) works in world space. `vCW`/`vCN` come from `modelMatrix * instanceMatrix`, so instanced Tokyo modules and country towns all get it without UVs.
  - **Walls:** grain on the colour and the bump at 1.7, 7 and 30 per metre; long thin rain streaks on vertical faces; grime below 3.5 m.
  - **Roofs:** gravel.
  - **Glass and windows:** roughness 0.02–0.12 per pane, metalness .85, and the colour lerped 55% toward (.36, .44, .54) so they mirror the sky.
  - **Rooms at night:** `cPane()` hashes a 3.2 m × one-storey room cell (storeys counted from 5 m). It gives each pane a little tilt, and it scales the windows' emissive: about 28% dark, the rest bright or dim, warm or cool.
- `cfade` fades out any detail finer than about a pixel.

## Country towns (Blender)

- **Build:** `blender -b --factory-startup --python models/blender/cities.py -- --city <id>|all [--render DIR]`. It writes `models/city_<id>.glb(.js)`. `--render` makes `<id>-street.png` and `<id>-landmarks.png` test renders. Each country lives in `models/blender/city_<id>.py` (`build()`). The shared kit is `citykit.py`:
  - `Node`: one object, with a material index per face. `build_all()` finishes every node.
  - Primitives: `box`, `cyl`, `lathe`, `prism`, `extrude`, `tube`, `blob` (metaball), `arch`.
  - `Face`/`Frame3` give facade coordinates `(u, v, w)`. `window`, `door`, `storey`, `shopfront`, `arch_wall` build on them.
  - Roofs: `gable`, `hip`, `mansard`, `flat_roof`. `at=(x, y)` moves a roof off centre.
  - Trees: `tree_palm`, `tree_round`, `tree_cypress`, `tree_fir`.
- **Node names (the contract with the game):**
  - `G<k>` / `U<k>` / `B<k>` / `R<k>`: family k's ground storey, upper storey, balcony storey and roof. Each has custom props `W`, `D`, `H` (exported as extras → `userData`). The same name plus `l` is the plain far-away twin.
  - `T_<kind>`: trees.
  - `L_<key>`: a landmark modelled around its game anchor. Blender Y = game −z.
  - `P_<key>`: a prop placed many times.
  - `L_eye_wheel`: the London Eye wheel. Its axle runs along Blender Y; the game puts it in a group turned π/2, 10 m out from the legs, 68 m up, and `C.eye.rotateZ` spins it.
- **Materials:**
  - `Wall` and `Roof` are white and tinted per house with `instanceColor` from the country's `S.walls` / `S.roofs`.
  - `Window` glows at night (`cityMats.win`, in `dynMats.windows`). `Glow` uses `dynMats.lamps`. `Glass` keeps its glTF material.
  - Every other material is baked into vertex colours (`misc`).
- **Game:**
  - `countryTown` stores `C.town = { S, b, meshes }`. `countryTrees(C, g, list, fn)` keeps each tree list. `lmGroup(C, g, key, x, z, tilt)` holds each procedural landmark.
  - `C.props[key]` lists `[x, z, ry, scale]`.
  - `updateCountryCulling` asks for `city_<id>` within 9 km. `upgradeCity(C)` then:
    - stacks the modules on every plot in 400 m cells: `F = 1 + round((h − G.H) / U.H)` storeys, `B` on the second and top floor, scaled to the plot, turned by a multiple of 90°;
    - hides the boxes, trees and landmark groups it replaces.
  - Cells show the detailed modules within `CITY_NEAR` (500 m, 300 m on touch, 0 on Graphics LOW) and the plain ones out to 1.7 km. Tree cells show to 1.3 km.
  - `CITY_MODELS` are left out of `loadAllModels`.
- **Check:**
  - After `travelTo({kind:'area', zone:id, idx:C.R.n-1, end:[mx, C.z0+70]})`, wait for `C.city`.
  - Every `C.lm[key].visible` should be `false` and `C.town.meshes` hidden.
  - SwiftShader takes about 0.3–0.5 s a frame in a town, so wait a few frames before reading `renderer.info`. The `LOW FPS` toast in headless runs is expected.
  - About 0.4–0.85 M triangles a frame in a town, roughly 2× the old boxes, and about 450 draw calls.

## Cybercab (self-driving)

- **Flow:** `startDrive` with a `robotaxi` car calls `cabAsk()` → `openMap()`. `selectPlace` shows `#bmAuto` → `cabChooseSpeed(d)` (`#cabSpeed`, steps up to `spec.vmax`) → `cabStart(d, kmh)` sets the GPS (`setNav`) and `cab`. `#cabhud` (`cabHud()`, rebuilt only when its text changes) has −/+/STOP or WHERE NEXT.
- **Driving:** `tick` runs `cabInput(dt, readInput())`. Brake, steer (>0.3) or handbrake hands back the wheel. `cabDrive` keeps its own route copy (planned from just ahead of the car; a fresh route that starts behind it does not replace one still leading on), tidies it, shifts it left into the lane with mitred corners (city `cab.lane` 2.1 m or 5.7 m when overtaking; zones 2.2 m, or `w/4` on median highways, on whichever side of the wall the car is), then does pure pursuit plus corner/traffic/arrival speed limits, crossing-traffic prediction, a creep-past after 4 s of mutual waiting, and backing out when stuck. `cab.dbg` holds the last plan for tests.
- **Races:** `startRace` calls `cabRaceStart`: `race.auto = 'ghost'` replays the saved ghost (any car; `race.cabG`) kinematically from `cabRacePose` in `simStep`, easing off the grid slot in 2 s; `'line'` drives a RaceAI-style line (`race.cabL`). A ghost replay never overwrites the ghost.
- **Race mode:** `cabRaceStart` times every rival with `lineTime` (the RaceAI line from `lineSpeed`, /1.05 for their catch-up boost), aims 3% under the fastest and sets `race.cabK` ≥ 1: the ghost plays at `t × cabK`, the line advances `v × cabK`. Checked P1 on all six tracks in both modes and against the Shadow King.
- **Launch control:** `spec.launchG` (2.45 g) raises only the longitudinal traction in `Player.update`; bench shows 0-100 1.21 s.
- **Test:** buy it (`{"car":21}` then click `#drive` twice), `closeMap()`, then loop `simStep(1/30, cabInput(1/30, idle))` until `cab.arrived`. Set `window.amboola.fuel = 1` before long trips (the battery runs out on the way to Paris otherwise; the autopilot then stops with "BATTERY EMPTY").
- The boat ramp moved to road `rc(4)`: on `rc(6)` it sat on the Paris bridge entrance and turned cars into boats.

## Flying Roadster

- `spec.fly` (km/h, 500 on `roadster2`). `startFlyCar()` (V key or `#flyBtn`, shown by `flyHud()` when `canFly()`) reuses the helicopter: `heli = { flyCar: true, car: player.car, flames, liftT }`, `state = 'heli'`. `updateHeli` uses `spec.fly / 3.6` top speed, 80 m/s² push, 25 m/s climb, keeps the velocity along the nose, scales the four thruster cones, and uses a closer camera. Touching a street (`heliGround < .5`) calls `flyLand()`: back to `state = 'drive'` with the flight velocity (off the map over the sea: `resetToRoad`). `endHeli` only removes the flames for the flying car. The heli state now also runs `updateCountryCulling`.
- **Test:** `window.amboola.heliStep(dt)` steps the flight without rendering; set `window.amboola.keys.Space/KeyW/ShiftLeft` to steer. Full forward reaches 500 km/h in about 10 s.

## Smashable things

- `regBreak(x, y, z, r, kind, refs)` puts a breakable into `BRK.grid` (24 m cells); `refs` are `[instancedMesh, index, falls]`. Registered: Tokyo street trees and sakura, lamps (pole/head fall, light pool just hides), vending machines, every `palmTrees`/`roundTrees`/`cypressTrees` list (they return their entries), and the countries' Blender trees in `upgradeCity` (the old entries collected by `countryTrees` via `BRK.collect` are marked `dead`).
- `smashCheck(player)` (in `simStep`, not in races or the boat) breaks anything touching the car's footprint faster than its kind's `min` speed. `smash()` handles refs in two ways:
  - Instanced refs are zero-scaled.
  - Plain `Mesh` refs (`[mesh, null, falls]`, e.g. phone boxes and poles) are hidden, and a clone flies instead.

  Each `BRK_KIND` has:
  - `keep`: the share of speed kept;
  - `min`: the slowest speed that breaks it;
  - `fly`: 0 tips over round the foot like a tree, more than 0 is thrown along the car's velocity, tumbling and bouncing (`L.air`), then settles on its side;
  - `snd` (`smashSound`): `wood`, `metal`, `glass` or `rubber`;
  - bit colours and the shout.

  `updateBreak(dt)` (drive tick) animates them, sinks them after 10 s and restores them 40 s later when the player is 200 m away.
- **Colliders that break:** `addCol` and `Pad.addCol` return their box. In `collideWorld` and `Pad.collide`, `brkHit(b, p)` links a small box (at most 3.4 m) to the breakable standing in it on first touch (`brkFor`, which prefers live entries and re-links when its entry dies, e.g. procedural trees or phone boxes swapped for Blender ones). Broken: the car passes. Faster than `min`: `smash()` and the car passes without bouncing. Slower: a normal bump.
  - Registered in `buildLamps` (every area's lamps), beach palms and umbrellas, volleyball poles, London phone boxes (and the Blender `P_phone` / `P_cafe` props via `PROP_BRK`), Paris café umbrellas, stunt park tyres, night meet poles, snow village lanterns, Fuji cedars and sakura, and the Alps' procedural firs.
  - Still solid on purpose: buildings, expressway pillars, arches, gas pumps, ferry bollards, desert rocks, Cyprus columns and camels.
- `crashFx(p, hit, vx, vz)` runs on every hard hit (`hit > 3` in `simStep`): glowing spark bits (`b.spark`, 0.7 s), dust, and shake.
- **Audit:** loop over `colGrid` and every `AREAS[].pads[].grid` box at most 3.4 m and call `brkFor(b)`; the unlinked ones are the solid things above.
- Traffic: `Traffic.collide` calls `wreckTraffic` above 9 m/s closing speed; `stepWreck` flies/tumbles the mesh (bouncing off `colGrid` buildings), settles it on the nearest quarter turn and returns true to respawn after 14 s and 70 m away.
- **Test:** `window.amboola.BRK`, `smash`, `smashCheck`; aim the player at an entry and run `simStep` until `e.broken`.
- Particles (`Smoke`) dim with the time of day (`Smoke.light`); damage smoke is `dmgSmoke` (dark, only below dmgK .92 and above 4 m/s).
- Car damage is off: `NO_DAMAGE = true` makes `carHit` return early and `dentsOf` return `[]` (so `dmgK` = 1, no repair cost, no damage HUD). Saved dents stay in `amboola.damage` for when it is switched back on.

## Horizon look (graphics)

- **Pass order:** Render → bloom → `OutputPass` → `hzPass` (`HZ_SHADER`, made by `makeHorizonPass`) → SMAA. `hzUniforms()` runs inside the pass's `render`: it sets the grade from `HZ` (`hzSet(T.g, rain)` in `applyTime`), projects the sun (`camera.position + sunDir·3000`), and drifts the clouds (`skyUniforms.time`). The shader checks the brightness at the sun's screen spot to hide the flare and rays behind buildings and clouds. Low: no sharpening, rays or speed blur.
- **Clouds** live in the sky shader (fbm on `d.xz / (h + .12)`): uniforms `cloudCov`, `cloudAmt`, `cloudLit`, `cloudDark`, per time of day in `TIMES[t].cl`; `weatherLook` makes them overcast in rain.
- **Speed blur:** `HZ.blur` is set in the drive tick from 150 km/h (drive state only).
- **Car reflections:** `carReflect()` (after `updateCamera`) renders one face of `CAR_ENV.rt` (cube camera at the car, 128 px on High every 2nd frame, 256 px on Ultra every frame; shadow-map updates, the car, rain, wet film and particles skipped). After a full turn, `needsPMREMUpdate` is set, and the player car's Standard/Physical materials get it as `envMap` (`carEnvApply`); `carEnvRelease` on Low and in the garage. In a headless test, step `window.amboola.tick(1/30)` about 16 times (with `__manualFrames`) before `CAR_ENV.ready`.
- `window.amboola.HZ`, `skyUniforms` and `CAR_ENV` are exposed for tests.
- **HD graphics** (`quality === 'hd'`, the top setting; `qUltra()` is true for Ultra and HD, so HD gets everything Ultra has):
  - `qualityPR()` renders at `clamp(max(devicePixelRatio, 1.5), …, 2)`, so a 1× screen is supersampled 1.5×; 4× MSAA + SMAA like Ultra.
  - The composer's targets get a `DepthTexture`, and `AOPass` (after the render pass, before bloom) does ambient occlusion from that depth: a half-size pass (position from `invProj`, normal from the nearer of the left/right and up/down depth neighbours, 12 golden-angle spiral taps, radius `AO.radius` m, scaled by `AO.power`, fades out by `AO.fade` m) writes `(ao, viewZ)`, then a full-size 4×4 depth-weighted blur multiplies the colour by it (`AO.strength`), skipping the sky and bright (lum > 1) pixels. It uses `renderPass.camera`, so it works in the garage and on the title too.
  - The car reflection is 512 px every frame, the wet film 0.7× the screen, `TOKYO_NEAR` ×1.6 and `CITY_NEAR` ×1.5.
  - Test: `window.amboola.setQuality('hd')`, then `AO` and `aoPass` (`aoPass.mixMat`: swap its last line for `gl_FragColor = vec4(vec3(ao), 1.)` to see the AO alone). A 1280×720 viewport renders 1920×1080, about 20 s a frame in SwiftShader.
- **Paint shine:** `buildCar`'s clear-coated paint gets `shinyPaint()` (`paintShine` in `onBeforeCompile`, key `paint-shine`; the decal shader calls `paintShine` too, key `amboola-decal-shine`). It boosts the clear coat's indirect and direct light (`SHINE.ind` 1.75, `SHINE.dir` 1.6) and tilts the base-coat normal by object-space flakes (`SHINE.flake` × metalness, faded by `fwidth` so far-away flakes don't turn into noise). Traffic paint stays `MeshStandardMaterial` (roughness .22) for speed. In a slow headless run, grab frames with `canvas.toDataURL` straight after `tick()`, because `page.screenshot` can hit its 30 s timeout.

## South Africa jungle

- `COUNTRY_DEFS` entry `southafrica` (`jungle: true`, gate `rc(16)`, rect `[10200, 18600, 11800, 20000]`), built by `buildJungle(C, g)`: dirt trail quads on the `cStreets` grid (so races, deliveries, patrols and the GPS work unchanged), 46 mud puddles (`JG.puddles` = `[x, z, r]`), The Giant Tree, and palms / jungle trunks / ferns / vines / canopy crowns in 400 m cells (`JG.cells`, culled by distance in `updateJungle`). Two `alphaTest` leaf-roof layers (y 19 and 15.5, `LEAF_TEX`) hide the sky everywhere except the camp clearing (`JG.camp` = z0 + 95).
- `updateJungle(dt)` (drive tick): `JG.in` / damped `JG.k` turn the fog green and ~4× thicker (`JG.baseFog` is the time-of-day fog colour saved by `applyTime`), spray mud off the wheels (`mudFx`, a brown `Smoke`), splash in puddles (`dirt += .12`, toast, `JG.splat`), and fade the `#mudFx` screen overlay from `JG.splat`.
- Dirt: `updateFuel` adds `.035/s` while `JG.in`; `applyDirt` lerps the paint to mud brown and dulls `clearcoat` / `clearcoatRoughness` (saved as `userData.cc0` / `ccr0`).
- Car washes: `makeWash(x, z, parent, label)` pushes to `WASHES`; `WASHES[0]` is the Tokyo one (`CARWASH` points at the active wash), `WASHES[1]` the Jungle Car Wash at the camp. `startWash(W)` costs $50 and runs 4 s.
- **Test:** `window.amboola.JG`, `WASHES`, `dirtLevel` (get/set), `applyDirt`. Put the player on a trail (`cStreets` xs from `x0 + 90` every 170 m), or `travelTo` the *South Africa* place for the camp; set `dirtLevel = .95`, `applyDirt(player.car)`, then `startWash(WASHES[1])` and tick ~4.5 s.
- On a slow headless run, `{"click":"#drive"}` can hit Playwright's 30 s click timeout (the click works, but `startDrive`'s PMREM sky render blocks the page). `{"eval":"window.amboola.startDrive(); 1"}` does the same without the timeout.

## Troodos Mountains (Cyprus)

- `TRO` (centre `cx, cz` = -12560, 14450, `R` 750, ellipse `ex` 1.12 / `ez` .9, `top` 520 m, `rect` = the Cyprus pad rect it adds). `TRO_KN` is the radius → height profile (monotone cubic, `troProf`), `troNatural` adds ridges. `prepTroodos()` lays the trail `TRO.T` (2 m samples: `n x z y tx tz s g L`; grade capped at .84 = 40° up), `TRO.rocks`, `TRO.gates` (every 300 m, the last = the finish at `n - 6` under the finish arch). `troCarve` cuts a ±6.5 m bench into the slope, `troBumps` adds the stones, `troY` / `troGrad` / `troTerrain` (`'trail'` within 6 m of the trail, `'dirt'` elsewhere on the mountain) are the Cyprus pad's `y` / `grad` / `terrain`.
- Physics on `'trail'` and `'dirt'` (`earth` in `Player.update`): gravity uses the true sine of the slope, loose-dirt drag scales with `offroadOf` (the `crawler` profile is 1), and above 14 m/s a rock drag (`(|v| - 14) × .4`) keeps everyone near 80 km/h. `areaGround` includes `troY`, so the camera stays above the mountain.
- `buildTroodos(C)` (from `buildCountries`): a 6 m height-field (8 m on touch) lowered .45 m under the trail ribbon, the ribbon with skirts, rocks, boulders (colliders), pines (smashable), the summit (domes, mast, flag, sign), the start and finish arches (`troArch`), gate posts with flags and beams (`TRO.beams`).
- **Race:** `updateTroodos(dt, p)` (from `updateAreas` while driving) opens `troOpen()` when you stop in the ring at `T.x[6]`. `troGo('race' | 'truck' | 'own')`: the loan truck is `troSwap(true)` (keeps `tro.loan` = your car/paint), the race builds 5 kinematic rivals (`troAI`: speed from grade, bends and `skill` = `DIFF().ai × [.57 … .69]`, they follow / pass each other and push the player). States `count` → `run` → `done`; finished rivals get `a.park` spots in two rows past the trail end. `troFinish` pays `TRO_PRIZE[pos - 1]` (+$5,000 for a record in `amboola.troodos`); the first win adds `troodos` to `wallet.owned` and keeps you in it. Leaving the mountain (`onMtn`) or the garage ends it and returns a loaned truck.
- **Asphalt road and Platres:** `prepTroodosRoad()` lays `TRO.Rd` (same sample layout as the trail, plus `hash`/`key` for `troNearIn(TRO.Rd, x, z, rad)`; ~4 km, `n` ≈ 2012) from (-11680, 14260), the west end of Cyprus street `zs[1]`: legs along the slope at grade .11 between angles 2.6 and 5.95, 10 m hairpins round the uphill side, then straight onto the summit; heights smoothed ±8 samples and clamped to 20 %. `TRO.platI` is the first sample at 80 m and `TRO.plat` its square on the downhill side. `troCarve` blends the terrain onto the road (6 m flat + 18 m blend) and the square; `troTerrain` is asphalt (`null`) there. `buildTroodosRoad(g, C)` builds the ribbon, gravel shoulders, posts every 14 m and a steel crash barrier on the drop side (one 0.6 m collider in `C.P` per 2 m sample, the side voted over ±5 samples; it skips Platres' square and where the trail is within 14 m), then `buildPlatres` (houses on plinths, church, fountain, café, people; `TRO.village` circles keep the ~10.8k pines away). GPS: `navRoute` takes the road for `troPath: 'platres'` and for `'top'` unless you are on the trail; from the town it goes along the streets (`townRoute`) to the foot.
- **Test:** `window.amboola.TRO`, `troY`, `troNear(x, z, rad)` → `{ i, lat, d, y, s }`, `troPlace(player, i, lat)`, `troGo`, `troOpen`, `tro`, `troSwap`, `updateTroodos`, `troEnd`. `loadModel('troodos')` first, `troPlace(player, 6, 0)` puts you in the ring (the panel opens after a frame), then `{"click":"button[data-k=race]"}`. A test autopilot: steer at `T.x[i + 7], T.z[i + 7]` with `simStep` + `updateTroodos` every 1/60 s finishes in ~150 s; the rivals take ~145-175 s on Medium.

## Challenges

- `CHALS` (20 defs: `id cid n ico col d at(C) start(C, def) update(S, dt, p, C, c) stop(S)`, optional `ay(x, z)` ring height and `leash`). `buildChallenges()` (after `buildActs`) builds what they need (Cyprus `C.aphro` kick ramp, `C.eiffel`, `C.ben`, `alpsLake(C)` = a snowy rect west of the town with a 95 m ice disc and `C.P.terrain` → `'ice'`, `egyptDesert(C)` = the causeway rect at the last x street `C.causeway` and the desert rect with pyramid colliders, `C.riddleSpots`), then one `addAct` ring per def (`chal: def`, the prompt shows its stars).
- `chalStart(def)` (refuses while driving something else; ends a Taiyō hunt) → `chal = { def, C, S, t, x, z }`. `updateChal(dt)` runs from the drive tick and the heli tick, ends it 3 km from the ring, and `chalEnd(r)` pays `CHAL_PAY[stars]`, saves the best in `localStorage['amboola.chal']` (`chalBest`) and calls `chalTrophy(cid)`: both done → `trophy_<cid>`, $25,000 and the edition car `ed_<cid>` (`MODEL_ALIAS` reuses the base car's model in `loadModel`). Enter the garage or travel and it stops. `carHit` calls `chal.S.onHit(hit)` (the pizza tower).
- Helpers: `chalNote(html)` (`#chalNote`), `actHud`, `chalNav(C, name, x, z)` (country GPS with `keep`), `chalMarker`, `chalLabel`, `chalPath(pts)` (`L`, `at(s)`, `proj(x, z)`), `chalLine`, `chalRandomStreet` (skips `streetFree` failures: landmarks, stunt ramps and loops), `chalCrash(J)` (the free lane beside a crash).
- Physics: `terrain === 'ice'` multiplies grip by .3, halves the lateral damping and lets the car rotate 3× harder, so it slides (`player.vr` is the sideways speed the ice drift scores).
- Town GPS: `townGraph(C)` (cached `C.tg`) marks each stretch of street between crossroads that a big collider (> 3 m both ways) or a stunt loop stands on; `townRoute(C, ax, az, bx, bz)` is a Dijkstra over the crossroads that also uses the street ends out to the town's edge; `townWay` adds Egypt's causeway. `navRoute` uses it whenever the destination is in a country town (not the jungle).
- `openChalBoard()` (pause menu `#bChal`) lists them by country with stars and GO.
- **Test:** `window.amboola.CHALS`, `chal`, `chalBest`, `chalStart`, `chalEnd(r)` (with `{ stars, msg }` to fake a finish), `updateChal`, `openChalBoard`, `townRoute`, `townWay`, `footCollide`. Put the car on `def.ring`, `chalStart(def)`, then loop `simStep(1/60, input)` + `updateChal(1/60)` (+ `updateJams` for the jam hero). Set `player.manual = false` first: the default GR86 is a manual and the autopilot never shifts. Every challenge was won by a test autopilot (most 2-3 ⭐); the times and point targets are tuned to that.

## Hotels, walking, crowds and traffic jams

- **People:** `PERSON` holds the shared part geometries (`torso head hair leg arm`, vertex colours mark shoes/belt/eyes) and colour lists. `posePerson(out, x, y, z, h, ph, amp, sit, up)` fills 7 part matrices (+ `out[7]` scratch; make them with `poseMats()`): torso, head, hair, left/right leg, left/right arm. `makeWalker(cols)` builds a mesh person (`poseWalker(g, ...)`), used for you and the receptionists.
- **Hotels:** `HOTELS` (10: `tokyo` + every country, `southafrica` is the Jungle Lodge). `newHotel(id, x, z, ry, C)`: the hotel's frame has the door at (0, 0), the car park to z +26, the building back to z -22; `hW(H, lx, lz)` / `hL(H, x, z)` convert, `hBox` gives a world AABB. Country plots come from `hotelPlot` inside `countryTown` (kept clear of landmarks with `keep`, lamps/trees skip `hotelHit`); Tokyo's is block (10, 12) (a `'stunt'` special block) via `tokyoHotel()`; the jungle's sits in the camp clearing. `buildHotel(H, parent)`: walls and parked-car bays are world colliders (`addCol` / `C.P.addCol`), furniture is `H.walk` (walker only); `H.spots` are the sofa, tub and desk places; the GO OUT ring is an `addAct` with `hotel: H` (the prompt says GO OUT). `updateHotels(dt, x, z)` fills the car park (`hotelCars`, 12 random loaded `MODELS`, 7 on touch; removed past 650 m), slides the doors, bubbles the tub and waves the receptionist.
- **Walking:** `foot` (null while driving). `footStart(H)` (the ring), `footEnd()` (SIT); `tick` feeds `FOOT_HOLD` to `simStep` (the car stays put) and `readInput()` to `updateFoot`, draws `footCamera` and centres the minimap on you; `audio.off` mutes the engine. `foot.near` is the button (`{ t, s, col, go }`: SIT, RELAX, hot tub, SLEEP, GET UP) shown in `#actprompt` (Enter or tap). `footSit(spot)` → 6 s → `hotelRested` (fuel, wash, $500, `bump('relax')`); `hotelSleep()` fades `#sleepFx` and sets the time to day. `enterGarage`, `travelTo` and races end the walk.
- **Crowds:** `CROWD` (170 people, 64 on touch) as one `InstancedMesh` per part (`instanceColor` = shirt/skin/hair/trousers). Each walks round a block's pavement (`crowdPath`: Tokyo 10.4 m in from the road centres, country towns 10 m) within 280 m of you; `updateCrowd(dt, x, z)` makes them hop clear of a car coming at them and never lets them under a car.
- **Traffic jams:** `JAMS` (at most 2, Tokyo only; a new one every 60-120 s, out of sight). A jam is `{ axis, line, dir, s0, kind: 'crash' | 'works', count, max ≤ 50, slots, state: 'jam' | 'go' }`; `jamSlots` lines the queue up in both lanes and skips crossroads; `jamProps` builds the scene and a collider over the closed lanes (`removeCol` takes it away). `updateJams(dt, p)` grows the queue, says so when you drive up, clears it after `life` seconds and drives the cars off, and shows the nearest jam with the `JAM.pool` traffic cars. `jamTraffic` (in `Traffic.update`) makes city cars stop behind the tail and join it. `taxiRoute` checks `routeJammed` and takes `jamDetour` (both Ls, or an L through a nearby crossroads); `drawJamsMap` draws them on both maps.
- **Test:** `window.amboola.HOTELS`, `hW`, `hL`, `footStart`, `footEnd`, `footSit`, `updateFoot`, `updateHotels`, `foot`, `CROWD`, `updateCrowd`, `crowdPath`, `JAMS`, `startJam(px, pz)` (makes one away from that point), `endJam`, `updateJams`, `jamPos`, `jamTail`, `routeJammed`. Walk with `updateFoot(1/60, { throttle, brake, steer, handbrake, nitro })` steered at a point; `#actprompt` is the button to click.

## Jungle animals and the Taiyō Hunt

- **Models:** `models/blender/jungle_animals.py` writes `lion` and `monkey` (both in `MODEL_FILES`). Every moving part is a top-level node with its origin at the joint (lion: `Body Mane Jaw LegFL LegFR LegBL LegBR Tail`; monkey: `Body ArmL ArmR LegL LegR Tail`). `animalTemplate(id)` merges each part's subtree into one vertex-coloured mesh (`ANIMAL_MAT`), so an animal is 6-8 draw calls.
- **Animals:** `buildAnimals()` (when you get within 2.6 km of the jungle and both models are in) puts 7 prides of 3 lions and 12 troops of 4 monkeys a little way down a trail from shuffled crossings. `JA.list` entries have `st`: `idle sit walk home flee rest chase ride`. `updateAnimals` (from `updateJungle`) only thinks/poses animals within 320 m (or chasing/riding). `animalThink` moves and turns them (`AN` speeds), dodges the car (`flee` with a hop), keeps them out of the camp; `animalPose` swings the legs (walk/gallop/bound), sits, pounces, opens the lion's jaw (`roarK`) and waves the riding monkey's arms. Groups use rotation order `YXZ`.
- **Hunt:** `startHunt(C)` runs when you enter the South Africa rect (`JG.wasIn` edge) without owning the Taiyō, or from the camp ring. `huntSpots` picks 2 crossings 520 m+ from the camp and 500 m+ apart; `huntNav` sets the GPS with `keep: true` (no auto-arrive) and `hunt: true`. `updateHunt` (from `updateActs`): pick up within 8 m, `huntRecruit` keeps `2 + got` lions and monkeys chasing (nearby ones first, otherwise an ambush 85-130 m ahead along `nav.route` via `huntAhead`, 18 m to the side), `lionCatch` (catch radius 3.1 m, 2.5 s immunity, 3 lives), `monkeyJump` → `monkeyRide` (on the roof, throttle × .55 via `huntInput` in `simStep`, banana splat `#banFx`, 5 steering flips or 7 s to get it off). `endHunt('won' | 'lost' | null, quiet)`: won → `wallet.owned.add('taiyo')` and a swap into it after 2.5 s (or $100,000 if owned); lost → back to the camp.
- **GPS in the jungle:** `navRoute` uses `jungleRoute(C, px, pz, tx, tz)` (Dijkstra over the `cStreets` crossings, the camp road first from the camp) instead of a straight line through the trees.
- **Garage:** the Taiyō has `prize`: `buyCar` refuses it and the garage shows the prize text instead of a price.
- **Test:** `window.amboola.JA`, `AN`, `hunt`, `startHunt`, `endHunt`, `jungleRoute`, `huntAhead`. Use `window.__autoInput = () => ({ throttle, brake, steer, handbrake, nitro })` to drive from a test; place a lion near the car with `st: 'chase'` and tick to see a catch.

## Inside camera (cockpit)

- `CAM_NAMES` is `CHASE, FAR CHASE, INSIDE, HOOD, BUMPER` (`CAM_INSIDE` = 2; hood is now 3, bumper 4). `nextCam()` (C key, gamepad button 3, touch `#tcam`) cycles them.
- `buildCockpit(car, spec)` (made the first time you go inside, kept on `car.cockpit`) measures the car with `carGeom` and the paint vertices near the roof top (the eye goes just under the roof's highest part, on the right side): `E` is the eye in `car.group` space (+z forward, +x left). It adds a dash, a dial hood, a canvas speedo (`updateCockpit` redraws it at most ~14 times a second), a middle screen, a steering wheel (`spin` turns by `-steer × 2.3` about its axis, which points at the driver), A-pillars, a header bar, roof lining, mirror, doors, B-pillars, console and the passenger seat. `cockpit.hide` lists the meshes using `modelMats.black`, a `userData.cabin` material (the Blender model's own lining, seats, dash and wheel) or a two-sided material (the glass), hidden while inside along with the pet.
- `updateCamera` calls `cockpitView(p, camMode === CAM_INSIDE)`; the camera sits at `E` (via `car.group.matrixWorld`, so it pitches and rolls with the car) with `near` .1, fov 70-80 and a third of the usual shake. `tick` switches the cockpit off in states that show the car from outside (photo, ferry, heli, garage...).
- **Test:** `window.amboola.camMode = window.amboola.CAM_INSIDE`, tick a few frames, grab a frame; `player.car.cockpit` has `E`, `on`, `hide`.
- Pets: the cat is sized to the car's height (`clamp(H * 1.3, .9, 1.6)`); a saved cat pet was switched off once (`amboola.catOff`).
- **Brand interiors:** `models/blender/interiors.py` writes `int_<key>.glb(.js)` for the 19 keys in `INTERIORS` (Nissan and AMBOOLA included; AMBOOLA's `AmbAccent` material is tinted to the car's paint in `buildInterior`, and its `holo` dials are drawn see-through with additive blending) (brand → key; Porsches have no `brand` and count as Porsche). Interior space: the origin is the car's centre line at the eye height and eye position, the eye at x = -0.40 (right-hand drive), forward +z, nominal width 2.0 m. Nodes: `Wheel` (an empty; its axis is its local z), `Gauge` and `Screen` (planes with UVs). The script's `--render DIR` writes a driver's-eye picture per brand.
- `INTERIOR_MODELS` are in `MODEL_FILES` but left out of the background loading: `buildCockpit` loads the brand's model the first time you go inside (the plain cockpit, `proc: true`, shows until then and is swapped out when it arrives). `buildInterior` clones it, stretches x by `clamp(xh, .85, 1.15)` (the wheel is scaled back so it stays round), places it at `E = (-0.4·sx, ey, ez)`, gives `Gauge`/`Screen` canvas materials (`planeCanvas`, `flipY` false for glTF UVs) and turns the wheel by `q0 · rotZ(-steer × 2.3)`. `drawDials(G, p, DIALS[key])` draws the brand's layout: `five`, `round`, `twin`, `hex`, `watch`, `analog`, `tesla`, `jet` or `bar`. The Cybercab hides the wheel and dials. `PLAIN_DIALS` is the style of the plain cockpit that shows while a brand's model loads.
- **HD cockpit kit** (`interiors.py`):
  - `chaikin()` rounds a profile, and `sweep()` sweeps it across the car, bent by `wrap()` (`WRAP` bow .035, droop .015), for the dash, trim band and ambient line. A part fixed to the dash near its ends must use `wrap(x, y, z)` too, or it sinks in; see the Rolls-Royce fascia stars.
  - `dashes()` makes stitching that lies on a surface facing `normal`, in the brand's `accent` material (an `INT_STITCH` name, so the stitch colour in Customize still works).
  - `vent_slots()` makes rectangular vents. `box(..., bevel=)` now rounds with 3 segments and hardened normals.
  - Brand dict options: `amb` (ambient light colour), `buttons`, `paddles`, `seatshell`, `doorinsert`, `visor`, `paddlemat`.
  - `--no-export` together with `--render DIR` previews without touching `models/` (`SIZE=WxH SAMPLES=n` env).
- **In the game:**
  - `interiorLook(g)` (in `buildInterior`, before `interiorCustom`) swaps the cockpit's materials, by name via `INT_LOOK`, for `MeshPhysicalMaterial`: leather sheen, fabric sheen, carbon or gloss clear coat. Near-black leather and fabric are lifted to luminance 0.014.
  - `intDetail` (`onBeforeCompile`, `INT_KIND` 1–4 and `customProgramCacheKey 'int-detail-k'`) adds object-space detail with `vIP`/`vIN`: leather grain, fabric fuzz, the carbon 2×2 twill (albedo and bump) and brushed metal. Bump uses `iBump` (a copy of `perturbNormalArb`), and `iFade` fades it out below about 2 px per cell.
  - `ck.fill` is a `PointLight` in the cabin. `updateCockpit` sets it to `hemi × .45 + sun × .05`, tinted by the hemisphere colour.
  - `carEnvApply` runs again when the cockpit is built, so it gets the live reflections.
  - On Ultra and HD, `planeCanvas` makes the gauge and screen canvases twice as big, with anisotropic filtering.
- **Testing:** test the inside view with a capture script that owns the car, `selectCar`, `startDrive`, sets `camMode = CAM_INSIDE`, ticks until `player.car.cockpit` exists and isn't `proc`, then calls `toDataURL`. Between cars, click `#bGarage`, because `enterGarage` isn't exported. One early capture showed a big black block that a raycast never found again: a timing glitch, not a model fault.

## Race music

- `SONGS` (19): `{ n, bpm, key (MIDI), prog (8 chords: scale steps, or 'b7'/'b6' major chords), drums, bass, chords, lead, mel, swing? }`. `mel` is 8 bars of eighth-note tokens: a scale step `1`-`7` with `+`/`-` octaves and `b`/`#`, `_` holds, `.` rests, `a~b` two sixteenths. `prepSong` turns it into `S.at` (notes by sixteenth) and `S.ch` (chords).
- `raceSong()` picks the song: `TRACK_SONG[race.T.id]`, `champion` for the boss, `candykart` in crazy mode, `COUNTRY_SONG[cRace.C.id]`, `world`, `nitro` (drag), `neon` (meet), `matsuri` (lantern), `desert` (rally), `pixel` (built track); `live` is false during the countdown (drums and bass only). `updateMusic()` runs with the radio in the drive tick and schedules sixteenths 0.2 s ahead (`musicStep`); `updateRadio` is quiet while `music.id` is set and `#radiohud` shows the song. `musicFanfare(won)` plays on its own bus (`music.fan`) from the win spots. `music.mode` (`songs` plays these) is saved in `amboola.racemusic`; the pause menu's `#bMusic` cycles AMBOOLA songs → Spotify → off. The pause menu is a two-column grid so all its buttons fit on a 720 px screen.
- **Test:** check `window.amboola.music.id` after `startRace(TRACKS[0])` and a few ticks (the audio context must be running). To hear a song without speakers, swap `audio.ctx`/`audio.master` for an `OfflineAudioContext`, set `music.out = null`, call `musicInit()`, schedule `musicStep(S, t, sp, step, true)` for every sixteenth and render. Restore the fields afterwards.
- **My Spotify / Scorpions race mix:** `music.mode` is `'songs'`, `'spotify'` or `'off'` (saved in `amboola.racemusic` as `'1'`, `'spotify'`, `'0'`). `spot.uri` is your pasted link (`spotUri(link)` takes playlist, album, track or artist links; saved in `amboola.spotify`) or `SCORPIONS`, which means the race mix: `SCORP` holds `[name, Spotify track id]`, `SCORP_RACE` maps each `raceSong()` id to a song, and `SCORP_NEXT` is the order when a song ends mid-race. `updateSpotify()` runs every frame from `tick`. When a race starts (`raceSong().o` is a new race object) it queues `spot.cmd = 'load'` for the mix song, or `'play'`/`'resume'` for your playlist. Pause → `pause()`, back → `'resume'`. Commands wait for the controller's `ready` event (`spot.readyN >= spot.waitN`, or 5 s): `load` calls `loadUri` and then `play` after the next `ready`. `playback_update` starts the next mix song when `position` reaches `duration` (it stays "playing" at the end), and pauses any song that started after the race was over. If the script fails or no controller arrives in 15 s, `spotFail()` sets `spot.failed` and `updateMusic` plays the AMBOOLA songs instead. The track ids were read from Spotify's album embeds (`open.spotify.com/embed/album/<id>`, `__NEXT_DATA__` → `entity.trackList`); MusicBrainz release pages link each album to Spotify.
- **Spotify in the headless browser:** this container's Chromium can't check TLS certificates, so every https request fails there. Run the driver with `AMBOOLA_NET=1` to fetch https requests in Node and hand them to the page (it also sets the `en-US` locale, which Spotify's embed needs). Without it, `spotFail()` kicks in and the AMBOOLA songs play, which is also a good fallback test. Test: set `music.mode = 'spotify'`, `startRace(TRACKS[0])`, wait about 15 s, then `spot.cur` is `'hurricane'` and `spot.playing` is its track uri; `spot.ctl.seek(27)` near the end of a 30-second preview moves on to the next mix song.

## Title screen, settings, challenges

- After loading the game opens on `state = 'title'` (`buildTitle()` then `enterTitle()`). The driver presses PLAY for you (`titlePlay()`) so every flow still starts in the garage; set `AMBOOLA_TITLE=1` to stay on the title. `trailer.mjs` presses PLAY too.
- The stage is `models/title.glb(.js)` from `models/blender/title_screen.py` (Orbitron Black font in `models/blender/fonts/`, SIL Open Font License). `buildTitle` puts it in its own scene (`TITLE.scene`, `TITLE.cam`) with a vertex-coloured sky dome, stars, fog and lights. It scales the Blender glow strengths by 0.25, swaps the `Beam` cones for additive fading cylinders, and keeps `Turntable`, `BeamL`/`BeamR` and `FlagL`/`FlagR` to animate in `updateTitle`. `titleCar()` puts the selected car on the turntable. On narrow screens the camera steps back until the logo fits. Without the model, `#tiLogo` shows the name in letters.
- `titlePlay()` goes to the garage; the first time it also plays the start-up commercial and the daily bonus (they used to run at load). Garage → Save & Quit → `#savedTitle` calls `enterTitle()`.
- Settings: `setQuality(v)` (also used by the garage's graphics buttons; it re-points the render pass at the title scene), `diff` in `amboola.diff` (`DIFFS.easy/medium/hard`: `ai` multiplies `RaceAI` and `StreetRacer` target speeds, `react` is added to drag rivals' launch delay, `animal` multiplies the chase speed of lions and monkeys). With the same seeded rivals on the GP circuit, rivals cover about 6% less ground on Easy and 2.5% more on Hard than on Medium.
- Challenges: `challengeLists()` gathers `MISSIONS` (`ST.done`), `STORY` (`ST.story`), `BADGES` (`LVL.badges`) and `SECRETS` (`secretFound`), and `renderChallenges()` draws the tab in `TITLE.tab`.
- Rebuild the stage: `blender -b --factory-startup --python models/blender/title_screen.py -- [--render FILE]` (about 1.5 minutes with a Cycles render).

## The sea

- `SEA` holds the numbers: water `-1.2`, floor `-12`, `time` 50 s, `maxV` 12 m/s underwater, `quay` (Tokyo's harbour edge, `HALF + 40`), `shore` 160 m. `swim` is the dive in progress (`t` seconds left, `y`, `fall`/`float` phases, `leap`, `area`), or `null`.
- **Ocean:** `buildOcean()` is one round grid (`r = 1.5 · 1.05^i` out to 30 km) moved to the drawing camera in `onBeforeRender`. The vertex shader adds 4 Gerstner `WAVES` (fading out 250–900 m from the camera), and the fragment shader discards north of `uSeaQuay` (that is land). Near the camera it is see-through, there is foam on the crests, and far away the roughness rises so the distance doesn't sparkle. `seaY(x, z)` is the same height in JS (boat and buoys ride it; the underwater test uses it). `buildSeaFloor()` adds the sand at `SEA.floor` with an animated caustics emissive map, plus the quay face.
- **Getting in:**
  - Tokyo: the south harbour edge has no wall now. `areaAt` treats the quay strip between the bridges as city, and `collideWorld` calls `seaEnter(p, null)` past `SEA.quay`.
  - Islands: every country pad is `P.sea` with a beach `P.flat[i]` metres wide (40 round towns, 0 round the Dubai desert). Outside the rects `Pad.collide` follows `P.shoreAt()` (the same `shoreDrop()` profile that `countryGround` and `buildDesert` use for the ground meshes) and calls `seaEnter(p, P)` once the ground is 0.6 m under the water.
  - `areaCollide` picks the sea pad for beach points that aren't on the bridge, and country area boxes are widened by 220 m round their rects.
- **In the sea:** `collideWorld` hands over to `seaCollide()` first:
  - teleport detection (more than 30 m in one step ends the dive);
  - the Tokyo quay leap (drive north at it within ±(HALF−4));
  - a wall elsewhere, plus walls round `ISLAND` and `VOLC`;
  - `seaFloorAt()` (island beach slopes, else the floor);
  - out when the floor is within 0.45 m of the surface;
  - the 12 m/s speed cap.

  Terrain `'sea'` gives sand-like grip and drag.
- **Each step:** `updateSea(dt, p)` runs from `simStep`. It handles the fall, float and sink, the timer (beeps from 10 s, `seaRescue` at 0), the exit arrow (`seaExit`), bubbles (`SEA.bub`, a small `Smoke`), and seaweed and rocks (`seaLifePlace`, hashed 10 m cells around a 40 m snapped centre). Fish are 3 schools of instanced fish. When you're not in the sea it runs `seaDrip` instead, which places wet patches for 25 s after a dive.
- **Each frame:** `seaView()` runs after the camera moves. It keeps the camera under the surface while the car is under, and toggles `SEA.under`: `#seaFx` overlay, blue fog, muffled audio, no sun flare.
- `seaRescue(p)` puts you on the country's bridge road inside its town (`A.R.place(p, n - 12)`), or on the Tokyo harbour road. `resetToRoad()` (R) does the same while you're in the sea. `bump('seaDives')` gives the `diver` badge.
- **Test:** drive `simStep` with throttle off the quay at `x: -400, z: 812, heading: 0` (between the boat ramp and the Paris bridge); within about 4 s `swim` is set. Then it sinks to -12 in about 9 s, and heading north at full throttle leaps out at `z ≈ 841`. Dubai's beach: start at `x: 16440, z: 14520, heading: π/2`. Set `swim.t = .4` to see the rescue.
