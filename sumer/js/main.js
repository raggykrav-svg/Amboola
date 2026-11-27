// SUMER — walk the real streets of Limassol. Main loop, menus, input, progress.
import * as THREE from 'three';
import { loadCity, chunk, chunkIndex, shoreAt } from './data.js';
import { makeFacadeAtlas, makeGroundAtlas, makeGlow, makeLeafAtlas } from './textures.js';
import { Environment, TIMES, TIME_ORDER } from './env.js';
import { City } from './city.js';
import { makeMaterials } from './materials.js';
import { makeProps, bigShip } from './props.js';
import { Forest } from './forest.js';
import { Player } from './player.js';
import { Sound } from './audio.js';
import { MapPainter, Minimap, BigMap } from './ui.js';
import { Life } from './life.js';
import { Post, postSupported } from './post.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('sumer.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sumer.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

const QUALITY = {
  low: { post: false, ao: false, msaa: 0, leafy: false, pixelRatio: 1, shadows: 0, shadowSize: 0, viewDist: 1700, detailDist: 250, treeDist: 240, treeNear: 90, gardenDist: 170, gardenStep: 11, treeCapNear: 2500, treeCapFar: 5000, balconies: false, roofProps: false, cars: true, fog: 1.7, people: 25, traffic: 10, peopleDist: 110, trafficDist: 200 },
  medium: { post: true, ao: true, aoScale: 0.5, aoSamples: 8, msaa: 2, leafy: true, pixelRatio: 1, shadows: 1024, shadowSize: 70, viewDist: 2600, detailDist: 380, treeDist: 380, treeNear: 130, gardenDist: 270, gardenStep: 9, treeCapNear: 5000, treeCapFar: 9000, balconies: true, roofProps: true, cars: true, fog: 1.2, people: 60, traffic: 24, peopleDist: 130, trafficDist: 240 },
  high: { post: true, ao: true, aoScale: 0.5, aoSamples: 12, msaa: 4, leafy: true, pixelRatio: 1.25, shadows: 2048, shadowSize: 95, viewDist: 3800, detailDist: 520, treeDist: 540, treeNear: 170, gardenDist: 380, gardenStep: 8, treeCapNear: 8000, treeCapFar: 15000, balconies: true, roofProps: true, cars: true, fog: 1.0, people: 110, traffic: 40, peopleDist: 150, trafficDist: 280 },
  ultra: { post: true, ao: true, aoScale: 0.75, aoSamples: 16, msaa: 4, leafy: true, pixelRatio: 1.5, shadows: 4096, shadowSize: 130, viewDist: 5600, detailDist: 760, treeDist: 720, treeNear: 230, gardenDist: 520, gardenStep: 7, treeCapNear: 12000, treeCapFar: 22000, balconies: true, roofProps: true, cars: true, fog: 0.8, people: 160, traffic: 60, peopleDist: 170, trafficDist: 320 },
};
const settings = Object.assign({ quality: isTouch ? 'low' : 'high', sound: true, vol: 0.8, sens: 1, invert: false, fov: 72, fps: false }, store.get('settings', {}));
if (params.get('q') && QUALITY[params.get('q')]) settings.quality = params.get('q');
const Q = QUALITY[settings.quality] || QUALITY.high;

// ---------------------------------------------------------------- renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.quality !== 'low' && !Q.post, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shots') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.info.autoReset = false;
// post-processing (Medium and up) when the GPU can render to half-float images
if (Q.post && !postSupported(renderer)) { Q.post = false; Q.ao = false; Q.msaa = 0; }
if (Q.post) renderer.toneMapping = THREE.NeutralToneMapping;
let post = null;
function draw() {
  renderer.info.reset();
  if (post) post.render(); else renderer.render(scene, camera);
}
renderer.shadowMap.enabled = Q.shadows > 0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.2, 60000);
scene.add(camera);
scene.userData.camera = camera;

let data, city, env, mats, forest, player, painter, minimap, bigmap, props, life;
const sound = new Sound(); sound.on = settings.sound; sound.vol = settings.vol;
let state = 'loading';  // loading | title | play | menu | map
let landmarks = [];
const found = new Set(store.get('found', []));
const stats = Object.assign({ walked: 0, swims: 0, played: 0 }, store.get('stats', {}));
let timeKey = store.get('time', 'day');
if (params.get('time') && TIMES[params.get('time')]) timeKey = params.get('time');

function setLoad(f, txt) { $('loadbar').firstElementChild.style.width = Math.round(f * 100) + '%'; if (txt) $('loadtxt').textContent = txt; }
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---------------------------------------------------------------- boot
async function boot() {
  try {
    setLoad(0.02, 'Loading Limassol…');
    data = await loadCity(window.SUMER_DATA || 'data/limassol.bin.gz', (f) => setLoad(0.03 + f * 0.47, `Downloading the city… ${Math.round(f * 100)}%`));
    landmarks = data.header.landmarks || [];
    setLoad(0.52, 'Painting the buildings…'); await frame();
    const facade = makeFacadeAtlas(renderer), groundTex = makeGroundAtlas(renderer), glowTex = makeGlow();
    mats = makeMaterials(facade, groundTex, glowTex, Q.leafy ? makeLeafAtlas(renderer) : null, Q.post ? Q.msaa : 0);
    if (Q.post) post = new Post(renderer, scene, camera, Q);
    setLoad(0.6, 'Reading 31,500 buildings…'); await frame();
    city = new City(data, scene, mats, Q);
    city.parseAll();
    props = makeProps(); city.props = props;
    env = new Environment(renderer, scene, data, Q);
    env.fogScale = Q.fog;
    env.neutral = !!Q.post;
    forest = new Forest(scene, mats, city, Q);
    player = new Player(city, forest, camera, scene);
    player.onStep = (s, run) => sound.step(s, run);
    player.onLand = () => sound.land();
    life = new Life(scene, city, data, mats, props, Q);
    player.life = life;
    painter = new MapPainter(city);
    minimap = new Minimap($('mini'), painter, $('north'));
    bigmap = new BigMap($('mapui'), $('mapc'), painter, landmarks, { goBtn: $('mapgo'), listEl: $('lmlist'), onGo: (s) => goTo(s) });
    addShips();
    setTime(timeKey);
    // build around the title view
    setLoad(0.66, 'Building the streets…');
    const t0 = performance.now();
    for (let i = 0; i < 400; i++) {
      const built = city.update(TITLE.cx, TITLE.cz, 60);
      setLoad(0.66 + Math.min(0.3, i * 0.012), `Building the streets… ${city.supers.size} km²`);
      await frame();
      if (!built || city.pending <= 0 || performance.now() - t0 > 20000) break;
    }
    forest.update(TITLE.cx, TITLE.cz, true);
    setLoad(1, 'Ready!');
    showTitle();
    $('loading').classList.add('hide');
    // the big map picture is drawn in the background
    const gen = painter.worldGen(6);
    const step = () => { const t = performance.now(); let r; do { r = gen.next(); } while (!r.done && performance.now() - t < 12); if (!r.done) setTimeout(step, 30); else if (bigmap.open) bigmap.draw(); };
    setTimeout(step, 1500);
  } catch (e) {
    console.error(e);
    setLoad(1, 'Sorry, something went wrong: ' + e.message);
  }
}

function addShips() {
  const ships = [[2600, 3300, 0.4, 210, 0x2a3f5a], [5600, 2600, 2.1, 160, 0x7a2a22], [-1500, 4100, 1.2, 190, 0x23303d], [8800, 1700, 2.9, 140, 0x3c4a2a], [-4200, 4200, 0.2, 230, 0x2f3a46]];
  for (const [x, z, ry, len, col] of ships) {
    if (shoreAt(data, x, z) < 300) continue;
    const m = new THREE.Mesh(bigShip(len, col), props.mat);
    m.position.set(x, -0.32, z); m.rotation.y = ry; m.castShadow = false; m.receiveShadow = false;
    scene.add(m);
  }
}

// ---------------------------------------------------------------- time of day
function setTime(k) {
  timeKey = k; store.set('time', k);
  env.setTime(k);
  if (post) post.setNight(env.night);
  const night = env.night;
  mats.U.uNight.value = night >= 1 ? 1 : night > 0.3 ? 0.35 : 0;
  props.headMat.emissiveIntensity = night >= 1 ? 3.5 : night > 0.3 ? 1.2 : 0;
  mats.glow.userData.on = night > 0.3;
  mats.glow.opacity = night >= 1 ? 1 : 0.55;
  scene.traverse((o) => { if (o.userData.isGlow) o.visible = mats.glow.userData.on; });
  const T = TIMES[k];
  $('tTime').firstChild.textContent = { morning: '🌄', day: '☀️', sunset: '🌅', night: '🌙' }[k];
  flash(T.label);
}

// ---------------------------------------------------------------- title
const TITLE = { cx: 40, cz: 260, r: 360, h: 150, a: 0.6 };
function showTitle() {
  state = 'title';
  placeTitleCamera();
  $('title').classList.remove('hide'); $('hud').classList.add('hide'); $('touch').classList.add('hide');
  const nf = found.size;
  $('tstats').textContent = nf || stats.walked > 50 ? `Found ${nf} of ${landmarks.length} places · walked ${(stats.walked / 1000).toFixed(1)} km` : '';
  if (document.pointerLockElement) document.exitPointerLock();
}
function startPlay(atX, atZ, yaw) {
  sound.start(); sound.click();
  $('title').classList.add('hide'); $('loading').classList.add('hide');
  hidePanels();
  const saved = store.get('pos', null);
  if (atX !== undefined) player.teleport(atX, atZ, yaw);
  else if (saved && !player.started) player.teleport(saved.x, saved.z, saved.yaw);
  else if (!player.started) player.teleport(352, 196, -Math.PI / 4); // the Molos, looking along the sea front
  player.started = true;
  player.pitch = 0;
  life.clear();
  warmUp();
  state = 'play';
  $('hud').classList.remove('hide');
  if (isTouch) $('touch').classList.remove('hide');
  if (isTouch) $('hint').innerHTML = 'Drag on the right to look · use the stick to walk · 🏃 run · ⤒ jump';
  $('hint').style.opacity = 1; clearTimeout(hintT); hintT = setTimeout(() => { $('hint').style.opacity = 0; }, 9000);
  if (!isTouch) lockPointer();
}
let hintT = 0;
function warmUp() {
  // build what is around the player right away
  const t0 = performance.now();
  while (performance.now() - t0 < 1200) { if (!city.update(player.pos.x, player.pos.z, 120, player.pos.x, player.pos.z)) break; }
  forest.update(player.pos.x, player.pos.z, true);
}

// ---------------------------------------------------------------- panels
function hidePanels() { for (const id of ['pause', 'settings', 'help']) $(id).classList.add('hide'); }
function pause() {
  if (state !== 'play') return;
  state = 'menu';
  const t = $('pstats');
  t.innerHTML = `<tr><td>Places found</td><td>${found.size} of ${landmarks.length}</td></tr><tr><td>Walked</td><td>${(stats.walked / 1000).toFixed(2)} km</td></tr><tr><td>Swims in the sea</td><td>${stats.swims}</td></tr><tr><td>Where you are</td><td>${$('street').textContent}${$('district').textContent ? ', ' + $('district').textContent : ''}</td></tr>`;
  $('pause').classList.remove('hide');
  if (document.pointerLockElement) document.exitPointerLock();
}
function resume() { hidePanels(); bigmap.hide(); state = 'play'; if (!isTouch) lockPointer(); }
function openMap() {
  if (state !== 'play' && state !== 'menu' && state !== 'title') return;
  const from = state; state = 'map'; hidePanels();
  if (document.pointerLockElement) document.exitPointerLock();
  const px = player.started ? player.pos.x : 352, pz = player.started ? player.pos.z : 196;
  bigmap.from = from;
  bigmap.show(px, pz, found);
}
function closeMap() {
  bigmap.hide();
  if (bigmap.from === 'title') { state = 'title'; return; }
  resume();
}
$('mapclose').onclick = closeMap;
$('mapgo').onclick = () => goTo(bigmap.sel);
function goTo(s) {
  if (!s) return;
  bigmap.hide();
  // places: stand a little to the south-east, looking at the place
  const off = s.id && s.r ? Math.min(s.r * 0.5, 25) : 0;
  const tx = s.x + off, tz = s.z + off;
  const yaw = s.id ? Math.atan2(-(s.x - tx), -(s.z - tz)) : undefined;
  startPlay(tx, tz, yaw);
  flash(s.n ? `${s.n}` : 'Here you are!');
}
$('bPlay').onclick = () => startPlay();
$('bPlaces').onclick = () => { sound.start(); openMap(); };
$('bSet').onclick = () => openSettings();
$('bHelp').onclick = () => $('help').classList.remove('hide');
$('hClose').onclick = () => { $('help').classList.add('hide'); if (state === 'menu') $('pause').classList.remove('hide'); };
$('pResume').onclick = resume;
$('pMap').onclick = openMap;
$('pSet').onclick = () => { $('pause').classList.add('hide'); openSettings(); };
$('pHelp').onclick = () => { $('pause').classList.add('hide'); $('help').classList.remove('hide'); };
$('pTitle').onclick = () => { hidePanels(); savePos(); showTitle(); };
$('tMap').onclick = openMap;
$('miniwrap').style.pointerEvents = 'auto'; $('miniwrap').style.cursor = 'pointer'; $('miniwrap').onclick = openMap; $('tMenu').onclick = pause;
$('tCam').onclick = () => cycleView();
$('tTime').onclick = () => setTime(TIME_ORDER[(TIME_ORDER.indexOf(timeKey) + 1) % TIME_ORDER.length]);

function openSettings() {
  const panel = $('settings'); panel.classList.remove('hide');
  const seg = (id, v, fn) => { const el = $(id); for (const b of el.children) { b.classList.toggle('on', b.dataset.v === String(v)); b.onclick = () => { fn(b.dataset.v); for (const c of el.children) c.classList.toggle('on', c === b); saveSettings(); }; } };
  seg('sQ', settings.quality, (v) => { if (v !== settings.quality) { settings.quality = v; saveSettings(); savePos(); location.reload(); } });
  seg('sSnd', settings.sound ? 1 : 0, (v) => { settings.sound = v === '1'; sound.setOn(settings.sound); });
  seg('sInv', settings.invert ? 1 : 0, (v) => { settings.invert = v === '1'; });
  seg('sFps', settings.fps ? 1 : 0, (v) => { settings.fps = v === '1'; $('fps').classList.toggle('hide', !settings.fps); });
  $('sVol').value = settings.vol; $('sVol').oninput = (e) => { settings.vol = +e.target.value; sound.setVol(settings.vol); saveSettings(); };
  $('sSens').value = settings.sens; $('sSens').oninput = (e) => { settings.sens = +e.target.value; saveSettings(); };
  $('sFov').value = settings.fov; $('sFov').oninput = (e) => { settings.fov = +e.target.value; camera.fov = settings.fov; camera.updateProjectionMatrix(); saveSettings(); };
  $('sReset').onclick = () => { found.clear(); store.set('found', []); flash('Found places reset'); };
  $('sClose').onclick = () => { panel.classList.add('hide'); if (state === 'menu') $('pause').classList.remove('hide'); };
}
function saveSettings() { store.set('settings', settings); }
function savePos() { if (player && player.started && player.mode !== 'drone') store.set('pos', { x: player.pos.x, z: player.pos.z, yaw: player.yaw }); store.set('stats', stats); }
setInterval(() => { if (state === 'play') savePos(); }, 5000);
window.addEventListener('beforeunload', savePos);

let flashT = 0;
function flash(txt) { const m = $('msg'); m.textContent = txt; m.style.opacity = 1; clearTimeout(flashT); flashT = setTimeout(() => { m.style.opacity = 0; }, 1800); }

// ---------------------------------------------------------------- input
const keys = new Set();
let mouseDX = 0, mouseDY = 0;
const touchIn = { x: 0, y: 0, run: false, jump: false, lookX: 0, lookY: 0 };
function lockPointer() { if (!isTouch && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ } } }
canvas.addEventListener('click', () => { if (state === 'play' && !document.pointerLockElement) lockPointer(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state === 'play' && !isTouch) pause(); });
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas) { mouseDX += e.movementX; mouseDY += e.movementY; } });
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) { startPlay(); return; }
  if (state === 'map' && (e.code === 'Escape' || e.code === 'KeyM')) { closeMap(); return; }
  if (state === 'menu' && e.code === 'Escape') { resume(); return; }
  if (state !== 'play') return;
  if (e.code === 'KeyC') cycleView();
  if (e.code === 'KeyF') { player.setMode(player.mode === 'drone' ? 'first' : 'drone'); flash(player.mode === 'drone' ? 'Drone view: fly with WASD, E up, Q down' : 'Walking'); }
  if (e.code === 'KeyM') openMap();
  if (e.code === 'KeyT') $('tTime').onclick();
  if (e.code === 'KeyH') { const h = $('hud'); h.style.visibility = h.style.visibility === 'hidden' ? '' : 'hidden'; }
  if (e.code === 'Escape') pause();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function cycleView() {
  if (player.mode === 'drone') player.setMode('first');
  else player.setMode(player.mode === 'first' ? 'third' : 'first');
  flash(player.mode === 'first' ? 'Your eyes' : 'Behind you');
}

// touch: stick on the left, look by dragging elsewhere
(() => {
  const stick = $('stick'), knob = $('knob');
  let sid = null, sx = 0, sy = 0, lid = null, lx = 0, ly = 0;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; e.preventDefault(); });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy), m = 55;
    if (d > m) { dx *= m / d; dy *= m / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    touchIn.x = dx / m; touchIn.y = -dy / m;
  });
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; touchIn.x = touchIn.y = 0; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' || state !== 'play') return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; touchIn.lookX += e.clientX - lx; touchIn.lookY += e.clientY - ly; lx = e.clientX; ly = e.clientY; });
  const lend = (e) => { if (e.pointerId === lid) lid = null; };
  canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend);
  $('tRun').addEventListener('pointerdown', (e) => { touchIn.run = !touchIn.run; $('tRun').classList.toggle('on', touchIn.run); e.preventDefault(); });
  $('tJump').addEventListener('pointerdown', (e) => { touchIn.jump = true; e.preventDefault(); });
})();

let padPrev = [];
function readInput(dt) {
  const k = (c) => keys.has(c);
  let x = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  let y = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  let run = k('ShiftLeft') || k('ShiftRight') || touchIn.run;
  let jump = k('Space') || touchIn.jump; touchIn.jump = false;
  const sens = settings.sens, inv = settings.invert ? -1 : 1;
  let lookX = mouseDX * 0.0022 * sens + touchIn.lookX * 0.006 * sens;
  let lookY = (mouseDY * 0.0022 * sens + touchIn.lookY * 0.006 * sens) * inv;
  mouseDX = mouseDY = 0; touchIn.lookX = touchIn.lookY = 0;
  x += touchIn.x; y += touchIn.y;
  let up = k('KeyE') || k('PageUp'), down = k('KeyQ') || k('PageDown') || k('ControlLeft');
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const dz = (v) => Math.abs(v) < 0.15 ? 0 : v;
    x += dz(p.axes[0]); y -= dz(p.axes[1]);
    lookX += dz(p.axes[2] || 0) * 2.6 * dt * sens; lookY += dz(p.axes[3] || 0) * 2.0 * dt * sens * inv;
    const b = (i) => p.buttons[i] && p.buttons[i].pressed;
    if (b(0)) jump = true; if (b(1) || b(10)) run = true; if (b(5)) up = true; if (b(4)) down = true;
    const press = (i) => b(i) && !padPrev[i];
    if (press(3)) cycleView(); if (press(2)) openMap(); if (press(9)) pause(); if (press(8)) $('tTime').onclick();
    padPrev = p.buttons.map((q) => q.pressed);
  }
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  return { x, y, run, jump, lookX, lookY, up, down };
}

// ---------------------------------------------------------------- HUD logic
let hudT = 0, streetT = 0, lastSwim = false, fpsN = 0, fpsT = 0;
function nearestStreet(x, z) {
  const ci = chunkIndex(data, x, z); if (ci < 0) return null;
  const g = data.grid; const ix = ci % g.nx, iz = Math.floor(ci / g.nx);
  let best = null, bd = 28;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= g.nx || jz >= g.nz) continue;
    for (const rd of chunk(data, jz * g.nx + jx).roads) {
      if (!rd.name) continue;
      const p = rd.pts;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
        const ddx = bx - ax, ddz = bz - az, l2 = ddx * ddx + ddz * ddz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * ddx + (z - az) * ddz) / l2));
        const d = Math.hypot(x - ax - ddx * t, z - az - ddz * t) - rd.w / 2;
        if (d < bd) { bd = d; best = rd.name; }
      }
    }
  }
  return best;
}
function nearestPlace(x, z) {
  let best = null, bd = 1e9;
  for (const p of data.header.places) { const d = Math.hypot(p.x - x, p.z - z) * (p.k === 'quarter' || p.k === 'neighbourhood' ? 1 : 1.25); if (d < bd) { bd = d; best = p; } }
  return best && bd < 2600 ? best.n : 'Limassol';
}
function targetLandmark() {
  let best = null, bd = 1e9;
  for (const L of landmarks) { if (found.has(L.id)) continue; const d = Math.hypot(L.x - player.pos.x, L.z - player.pos.z); if (d < bd) { bd = d; best = L; } }
  return best;
}
function updateHud(dt) {
  hudT -= dt; streetT -= dt;
  const px = player.mode === 'drone' ? player.drone.x : player.pos.x, pz = player.mode === 'drone' ? player.drone.z : player.pos.z;
  if (streetT <= 0) {
    streetT = 0.5;
    const surf = player.surface;
    let st = player.mode === 'drone' ? 'Flying over Limassol' : player.swim ? 'Swimming in the sea' : surf === 10 ? 'On the pier' : surf === 11 ? 'On the rocks' : nearestStreet(px, pz);
    if (!st) st = surf === 4 ? 'On the beach' : surf === 10 ? 'On the pier' : surf === 3 ? 'In the park' : surf === 11 ? 'On the rocks' : 'Limassol';
    $('street').textContent = st;
    $('district').textContent = nearestPlace(px, pz);
  }
  if (hudT <= 0) {
    hudT = 0.2;
    // discoveries
    if (player.mode !== 'drone') {
      for (const L of landmarks) {
        if (found.has(L.id)) continue;
        if (Math.hypot(L.x - player.pos.x, L.z - player.pos.z) < (L.r || 40)) discover(L);
      }
    }
    const T = targetLandmark();
    $('gcount').textContent = `${found.size}/${landmarks.length}`;
    if (T) {
      const d = Math.hypot(T.x - px, T.z - pz);
      $('gtext').textContent = `${T.i} ${T.n} · ${d < 1000 ? Math.round(d / 5) * 5 + ' m' : (d / 1000).toFixed(1) + ' km'}`;
      const bearing = Math.atan2(T.x - px, -(T.z - pz));
      $('garrow').style.transform = `rotate(${(bearing + player.yaw - Math.PI / 2)}rad)`;
    } else { $('gtext').textContent = 'You found every place! 🎉'; $('garrow').style.transform = ''; }
    // swims
    if (player.swim && !lastSwim) { stats.swims++; sound.splash(); if (stats.swims === 1) flash('You are swimming in the Mediterranean! 🌊'); }
    lastSwim = player.swim;
    // ambience
    let trees = 0;
    forest.forChunk(Math.max(0, chunkIndex(data, px, pz)), (tx, tz) => { if (Math.abs(tx - px) < 30 && Math.abs(tz - pz) < 30) trees++; }, true);
    const sea = shoreAt(data, px, pz);
    sound.update(0.2, { sea: sea < 0 ? -sea : 0, trees: Math.min(1, trees / 10), night: env.night >= 1 ? 1 : 0, city: sea < -150 ? 1 : 0.4, swim: player.swim, drone: player.mode === 'drone' });
    minimap.range = player.mode === 'drone' ? 420 : 120;
  }
  minimap.draw(px, pz, player.yaw, landmarks, found, targetLandmark());
}
let toastT = 0;
function discover(L) {
  found.add(L.id); store.set('found', [...found]);
  sound.chime();
  $('tic').textContent = L.i; $('tname').textContent = L.n; $('tdesc').textContent = L.d;
  const t = $('toast'); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 6500);
  if (found.size === landmarks.length) setTimeout(() => flash('You found all the places of Limassol! 🎉'), 7000);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let titleA = TITLE.a;
function placeTitleCamera() {
  camera.position.set(TITLE.cx + Math.cos(titleA) * TITLE.r, TITLE.h, TITLE.cz + Math.sin(titleA) * TITLE.r);
  camera.lookAt(TITLE.cx, 12, TITLE.cz);
}
function tick(dt) {
  mats.U.uTime.value += dt;
  if (state === 'title' || (state === 'map' && bigmap.from === 'title')) {
    titleA += dt * 0.035;
    placeTitleCamera();
    city.update(TITLE.cx, TITLE.cz, 5);
    env.update(dt, camera, { x: TITLE.cx, z: TITLE.cz });
    return;
  }
  if (state === 'play') {
    const inp = readInput(dt);
    const before = player.walked;
    player.update(dt, inp);
    stats.walked += player.walked - before;
    life.update(dt, player.pos.x, player.pos.z, player.mode !== 'drone');
    stats.played += dt;
    updateHud(dt);
  } else { mouseDX = mouseDY = 0; }
  const cx = camera.position.x, cz = camera.position.z;
  city.update(cx, cz, state === 'play' ? 7 : 3, player.mode === 'drone' ? cx : player.pos.x, player.mode === 'drone' ? cz : player.pos.z);
  if (player.mode === 'drone') forest.update(cx, cz); else forest.update(player.pos.x, player.pos.z);
  env.update(dt, camera, player.mode === 'drone' ? { x: cx, z: cz } : player.pos);
}
function loop() {
  requestAnimationFrame(loop);
  if (window.__manualFrames) return;
  const dt = Math.min(0.1, clock.getDelta());
  if (state === 'loading') return;
  tick(dt);
  draw();
  if (settings.fps) { fpsN++; fpsT += dt; if (fpsT > 0.5) { $('fps').textContent = `${Math.round(fpsN / fpsT)} fps · ${renderer.info.render.triangles.toLocaleString()} tris · ${renderer.info.render.calls} calls`; fpsN = 0; fpsT = 0; } }
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (post) post.setSize(); });
if (settings.fps) $('fps').classList.remove('hide');

// debug / test handle
window.sumer = {
  get city() { return city; }, get player() { return player; }, get life() { return life; }, get env() { return env; }, get forest() { return forest; },
  scene, camera, renderer, setTime, startPlay, openMap, closeMap, pause, resume, found, stats,
  state: () => state, tick: (dt) => { tick(dt); draw(); }, step: (dt) => tick(dt), render: () => draw(), get post() { return post; },
  hud: () => { streetT = 0; hudT = 0; updateHud(0.01); },
  warm: () => warmUp(), bigmap: () => bigmap, landmarks: () => landmarks,
};
boot();
requestAnimationFrame(loop);
