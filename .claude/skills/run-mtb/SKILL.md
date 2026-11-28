---
name: run-mtb
description: Run, screenshot, ride or test Amboola MTB (mtb/index.html), the separate Three.js mountain-bike game (not the Amboola racing game or Villa Oliva). Use when asked to run the bike game, take screenshots of its tracks, crashes or hospital, test jumps, tricks or crash severity, or check that a change to it works.
---

Amboola MTB is a single-file Three.js r169 game: `mtb/index.html` (no build step). It is separate from the racing game (`index.html`) and Villa Oliva (`villa/`); never edit those for MTB work. Everything is procedural: terrain, tracks, bike, rider, crowd, textures (canvas) and sound (Web Audio). Only Three.js (jsdelivr importmap) and Google Fonts load from the network.

## Run and screenshot (agent path)

```bash
node .claude/skills/run-mtb/driver.mjs /tmp/mtb-shots '[{"frames":30,"shot":"title"}]'
```

It prints `loaded in N s: Ready`, one line per step and the page errors at the end (the `toNonIndexed` warnings are harmless; pipe through `grep -v toNonIndexed`). Look at the PNGs.

| step | effect |
|---|---|
| `venue: "forest"` | load another venue (desert, forest, alpine) and go to the title |
| `eval: "js"` / `"@file.js"` | run JS in the page (awaits promises); `window.mtb` is the debug handle |
| `frames: n` | simulate n frames of 1/60 s (game ticks, no rendering) |
| `shot: "name"` | render and save `<outDir>/name.png` |

Env: `MTB_Q` (low/medium/high/ultra, default low), `MTB_VENUE` (desert/forest/alpine), `MTB_VIEWPORT=1280x720`, `MTB_MOBILE=1` (touch phone: joystick and buttons; with `MTB_VIEWPORT=844x390` or `390x844`), `MTB_LOG=1` (echo the page console).

Timing in SwiftShader: load about 1.3 s (all three tracks are built at boot for the menu cards). A Low frame is about 1 s, High 2-5 s, but a High frame inside a loop that renders every few ticks adds up: keep High renders few, and run long ones in the background.

In `?test=1` the page's own loop is paused; `mtb.step(dt, n)` ticks the game and `mtb.render()` draws one frame. DOM timers (callout fades, the hint fade) do not run during a synchronous eval, so old callouts stay on screen in test shots; clear `#callouts` before a picture.

## Test recipes (all physics, no rendering, fast)

```js
mtb.botRun(400)          // the test pilot rides the current track: time, every landing (quality, vn, pitch error), every crash
mtb.calibrate(3)         // ride with the real physics; jumps you cannot reach at their speed get a lower vmax (prints what changed)
mtb.testCrash('otb', 14, 400); mtb.crashUntilCard()   // a forced crash: tier, type, peak impact, injuries
mtb.selectVenue('forest', 'final')   // menus: then mtb.startCountdown(), tick, ride with mtb.RIDE.bot = true
```

`botRun` must report `crashes: []` on all three venues after any track or physics change. Crash severity tiers come from per-body-part impacts: 0 clean bail, 1 scrapes (ride on), 2 sprain (medics; DNF in a final), 3 fracture or concussion (helicopter, hospital, X-ray).

To ride the menus end to end: click `[data-act=finals]`, click a `.card`, wait for `GAME.mode === 'intro'`, `mtb.startCountdown()`, tick until `ride`, set `mtb.RIDE.bot = true`, tick until `GAME.mode === 'results'`.

## `window.mtb` (debug handle)

`B` (bike state: `p v yaw pitch roll wp wy comp con air s u dTrack`), `RIDE` (`bot`, `landLog`, `crashLog`, `lastLand`), `TR` (tricks in the air), `CR` (crash: `phase` fall/card/heli/hosp, `res`), `CAM` (`mode` 0 chase, 1 close, 2 helmet, 3 TV, 9 free for test shots), `GAME` (`mode` title/intro/count/ride/crash/hosp/results/paused, `kind` final/free), `T` (track), `VEN` (venue), `keys` (a Set of `KeyboardEvent.code`; add `'KeyS'` and tick to pull back), `ASSIST.level` (0 off, 1 light, 2 strong), `heightAt(x, z, yq)`, `groundAt`, `tq(x, z, out)` (nearest track point), `trackPoint(s, out)`, `placeOnTrack(s, speed)`, `buildTrack(VEN)`, `toTitle`, `openVenues`, `openSettings`, `goHeli`, `leaveHospitalTo`.

## How the file is organised (search for the banner comments)

1. Utilities, seeded simplex noise, monotone profiles; renderer, `QUAL` presets, post (bloom, grade with speed blur, FXAA), Preetham sky with painted clouds, sun with a shadow box that follows the rider.
2. `VENUES`: per venue a `terrain(x, z)` (the natural mountain), the look, the palette, the track control points `pts` and `feats` (start deck, kicks, drops, rock gardens, roots, finish).
3. Track: Catmull-Rom path resampled every 0.5 m (`X Z RX RZ PSI K`), base `B` (smoothed mountain under the line), surface `P` and under-surface `PD` (ramps and decks), flags `FL`, `BANK`, `HW`, `MG` (side slope width, wider in deep cuts). `heightAt` = natural terrain + shapes (spur ridges, canyon, road bench, finish pad) blended into the track across the corridor.
4. Jumps (`buildFeatures`): the take-off ramp is a constant-curvature transition (at most ~2.5 g); the landing follows the flight paths of every speed in a ±10 % window; the knuckle drop is solved so the landing ends on the mountain line (or `spend` metres below it). Jumps move (±40 m) to the straightest spot away from rocks and climbs. `sim1D` sizes them for the speed you can carry (conservative: real landings lose more than it thinks).
5. World meshes: terrain chunks (sunk 6 m under the ribbon), far ring, the track ribbon (every sample inside jumps), wooden decks with posts, vegetation per 128 m cell with two LODs, rocks, tape or flags, crowds (instanced, waving in the shader), start tent, finish arch, fences, big screen, grandstand, helipad, roads.
6. Rider and bike models: 16 joints, a mesh between each pair (`placeRider`), two-bone IK on pedals and grips (`computePose`), tailwhip rotates `BIKE.rear` about the steering axis.
7. Bike physics (`bikeStep`, 240 Hz): rigid body with pitch dynamics on two sprung wheels; `wheelContact` finds the deepest ground point inside the wheel circle along the heading (robust on lips and knuckles); bottom-out is an impulse, not a stiff spring; grip circle per tyre; yaw follows steering on the ground and is free in the air (riding help finishes spins and flips).
8. Riding (`prepareControls`, `afterStep`, `landing`, `checkCrash`): riding help (steer, brake to the speed window, level in the air), take-off locks for held keys (pedal and steer, not pull-back), landing quality, crash triggers (endo, wall, slide, head, trees).
9. Crashes: verlet ragdoll for rider (16 particles) and bike (5), impacts measured from each particle's own velocity before the links pull on it, `PARTS` with vulnerability (helmet, pads), `evalInjuries` tiers, crash names in `CRASH_INFO`, rescue helicopter with a winch and stretcher, the hospital scene (bed, casts, sling, traction, monitor) and the X-ray SVG.
10. Sound (synthesized), dust particles, game flow (intro, countdown, splits, finish, judges' score, rivals, results, DNF), menus and panels, input (keyboard, gamepad, touch), main loop, test tools, boot.

## Gotchas found while building it

- **A sharp lip launched the bike 60 m up**: the old single-ray wheel took the edge normal for the ground and saw a 30 cm penetration. Keep the wheel-circle contact and the impulse bottom-out.
- **`heightAt` ignores decks unless you pass the height you look from** (`yq`). Meshes, posts, trees and crowds use the default (the ground under a deck); the physics passes the axle height. With the old default the dirt was drawn on top of the start deck and the deck posts were skipped.
- **Jumps must fit the mountain**: a jump whose landing ends far below the line drags the track under the valley floor. The solver fits the knuckle drop to the line; on flat ground a steep kicker cannot fit and is skipped (`console.warn('could not fit ...')`), so check the warnings after editing `feats`.
- **Approach speeds**: `holdSpeed` (speed help and the bot) holds the speed that coasts into the ramp at the target; predicting from 60 m away braked the bike to a stop on steep approaches.
- **Corridor overlaps**: the nearest-point query is discontinuous where two parts of the track are closer than twice the corridor width; keep switchbacks wide.
- Results open from the game clock (`GAME.finishT`), not a `setTimeout`, so tests reach them.
