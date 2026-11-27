---
name: run-villa
description: Run, screenshot, drive or test Villa Oliva (villa/index.html), the separate Three.js house walk-through game (not the Amboola racing game). Use when asked to run the villa / house game, take screenshots of its rooms or garden, or check that a change to it works.
---

Villa Oliva is a single-file Three.js r169 game: `villa/index.html` (no build step). It is separate from the racing game (`index.html`); never edit the racing game for villa work. Everything is procedural: textures are baked on the GPU at load, trees and furniture are generated in code, sound is synthesised. Only Three.js (jsdelivr, via an importmap) and Google Fonts load from the network.

## Run and screenshot (agent path)

```bash
node .claude/skills/run-villa/driver.mjs /tmp/villa-shots
```

Default flow: title, living room, covered terrace, aerial by day and at night. It prints `loaded in N s: Ready`, one line per shot (render time and draw stats) and `no page errors`. Look at the PNGs.

Custom steps (JSON, 3rd argument), each processed in the order place → time → look → drone → eval → frames → shot:

```bash
VILLA_Q=ultra node .claude/skills/run-villa/driver.mjs /tmp/villa-shots '[{"place":0,"shot":"living"},{"place":7,"time":22.3,"shot":"lap-night"},{"drone":{"yaw":0.55,"pitch":0.6,"dist":118},"shot":"aerial"}]'
```

| step | effect |
|---|---|
| `place: i` | teleport to `PLACES[i]` in walk mode: 0 living room, 1 kitchen, 2 atrium, 3 master bedroom, 4 bathroom, 5 roof terrace, 6 covered terrace, 7 lap pool, 8 citrus walk, 9 pond, 10 play garden, 11 dining deck, 12 guest house, 13 parking, 14 tennis and chess, 15 greenhouse and swing, 16 main gate |
| `time: h` | time of day (5–24); refreshes sky light, shadows and the indoor probe |
| `look: [yaw, pitch]` | point the camera (yaw 0 looks north, π south) |
| `drone: {yaw, pitch, dist}` | aerial orbit around the estate |
| `eval: "js"` / `"@file.js"` | run JS in the page; `window.villa` is the debug handle |
| `frames: n` | simulate n frames of 1/30 s first (default 3) |
| `shot: "name"` | render and save `<outDir>/name.png` |

Env: `VILLA_Q` (low/medium/high/ultra, default high), `VILLA_VIEWPORT=1280x720`, `VILLA_TIME=17.8`, `VILLA_MOBILE=1` (touch phone: joystick and touch buttons; use with `VILLA_VIEWPORT=390x844`). Hide the HUD for clean pictures with an eval: `document.getElementById("hud").classList.add("hidden")`.

Timing in SwiftShader: load 10–25 s, a High frame 8–15 s, an Ultra frame 20–70 s. In `?test=1` mode the page's own animation loop is paused; the driver calls `villa.step(dt, n)` and `villa.render()`. If the loop ran, every Playwright call would wait behind multi-second frames and time out.

## Human path

`npx http-server -p 8765 .` and open `http://localhost:8765/villa/`. Add `?q=low|medium|high|ultra` to force a preset and `&t=21.5` for a start time. Double-clicking `villa/index.html` also works (it is one file).

## `window.villa` (debug handle)

`scene, camera, renderer, player, PLACES, SEATS, mode` (`'title' | 'walk' | 'drone' | 'fly'`), `teleport(i)`, `goPlace(i)`, `setTime(h)`, `refresh()`, `setQuality(name)`, `enterDrone()`, `beginGame(droneFirst)`, `look(yaw, pitch)`, `keys` (a Set of `KeyboardEvent.code`: add `'KeyW'` and step frames to walk), `input` (touch joystick `jx, jy`), `step(dt, n)`, `render()`, `stats()`, `zoneAt(x, y, z)`, `groundAt(x, z, maxY)`, `QUAL` and `setupPipeline()` (toggle passes), `dbg` (`env()`, `probe()`, `TEX`, `WATER_MESHES`, `M`).

Walking test pattern (pure logic, no rendering, about 1 s):

```js
const V = villa, P = V.player; V.mode = 'walk'; V.teleport(0);
P.pos.set(-34.35, 1.05, -23.2); P.yaw = 0; V.keys.add('KeyW'); V.step(1/30, 22); V.keys.delete('KeyW');
P.yaw = -Math.PI / 2; V.keys.add('KeyW'); V.step(1/30, 135); V.keys.delete('KeyW');   // up the stairs: P.pos.y → 4.55
```

## How the file is organised (search for the banner comments)

1. Constants: `U` (upper terrace +1.05), `F1` (+4.55), `RF` (+7.75); footprints `PLAT`, `HOUSE`, `ATR`, `LAP`, `PLUNGE`, `EST`. Metres, x east, z south.
2. Renderer and post: `QUAL` presets, `MAX_PIXELS` cap, `setupPipeline()` (RenderPass → GTAO on Ultra → bloom → OutputPass → grade → FXAA on Low/Medium). GTAO hides transparent, alpha-tested and `userData.noAO` objects (`patchGTAO`).
3. Sky: three's `Sky` with clouds, stars and moon patched into its shader. `updateEnv()` renders the sky (no sun disc) plus a lit ground dome into a cube and PMREMs it into `scene.environment`. `applyTime(h)` moves sun/moon, fog, exposure, lamp level `G.uLamp`, and calls `fitShadow()` (one static 4096 shadow map over the whole estate; `renderer.shadowMap.autoUpdate` is off).
4. Textures: `SURF` holds one GLSL function per material (world size, texture size, bump depth). `bakeOne` renders albedo (sRGB target), normal and ORM maps. Leaves are canvas-painted with a separate alpha mask (`leafTextures`).
5. Materials: `pbr()` sets `userData.uv` = 1/world size, used by `batchStatic()` to compute world-space box-projected UVs. Materials in `INTERIOR` get the indoor probe as `envMap`. `LAMPS` are emissive materials driven by `G.uLamp`.
6. Collision: `solidBox / solidOBB / solidSeg / solidCyl` with a y range; `baseGround(x, z)` is the terrain (0, +1.05, pools and pond dug in). The top of any solid is walkable; `STEP` 0.42 (1.5 while swimming).
7. Builders: `blk`, `addMesh`, `Piece` (furniture in a local frame), `wall()` with openings (`glass`, `slide` folded doors, `frame`). Static meshes go to `STATIC` and are merged per material and 24 m cell.
8. Ground: a painted splat canvas (red gravel, green sand, blue paving, black lawn) drives the ground shader, the 3D grass mask and footstep sounds (`surfaceAt`).
9. House (`buildHouse`), furniture (`buildInterior`), gardens (`buildGardens`), vegetation (`buildVegetation`: instanced olive, cypress, citrus, palm, shrubs, hedges, climbers), grass (`buildGrass`: two camera-following patches of blades), water (`buildWater`, `renderReflection` planar mirror on High/Ultra, caustics patched into the mosaic and pond-bed materials).
10. Night: `buildLights` (point lights by preset tier), bollard glow decals, `buildPortals` (RectAreaLights in big openings carry daylight indoors), fire. Indoor probe: `updateProbe()` (full) and `startProbe/stepProbe` (one cube face per frame when the time changes).
11. Player, input (pointer lock or drag; touch joystick), seats and the swing, drone, sound, UI, main loop, `boot()`.

## Gotchas found while building it

- **Speckles of random colour on floors and paving** were grass blades: off-lawn blades collapsed to a near-zero size still lit single pixels. Blades now move to one point far below ground (`if (bh < 0.012)`). If speckles come back, hide `GRASS` meshes first before suspecting textures or the environment map.
- **The countryside terrain must stay below the pond** (`terrainH` sinks 2.8 m inside the walls). At −0.06 it covered the pond's water (−0.16).
- **Walls built with `wall()`**: the left side of a→b gets `matL`. Exterior walls have two half-thickness skins so the inside can use the probe-lit interior plaster.
- **Stairs need a way on**: the balustrade starts at the fifth tread because the bottom step is against the study wall.
- Tree lists hold `[x, y, z, scale]`; cypress lists hold a height in the 4th slot (`sy`/`sxz` in `instanced()`).
