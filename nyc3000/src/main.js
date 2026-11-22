import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/700.css';
import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { loadSettings, saveSettings, PRESETS, OPTION_DEFS, GRAPHICS_KEYS, storage } from './settings.js';
import { Audio } from './audio.js';
import { City } from './city.js';
import { Rain, Effects } from './effects.js';
import { Game } from './game.js';
import { HUD } from './hud.js';
import { buildTitleScene } from './title.js';
import { Humanoid, makeGun, makeVehicleMesh } from './models.js';
import { loadModels } from './assets.js';
import { buildRooms } from './interiors.js';
import { renderShop, renderChallenges } from './shop.js';
import * as MODELS from './models.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'nyc3000.save';
const settings = loadSettings();
const audio = new Audio();
audio.volume = settings.volume;

// ---------- renderer ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x24123f, 0.003);
const camera = new THREE.PerspectiveCamera(70, 1, 0.2, 800);
scene.add(new THREE.HemisphereLight(0x6a5aff, 0x2a1030, 1.1));
scene.add(new THREE.AmbientLight(0x30284a, 0.6));
const moon = new THREE.DirectionalLight(0xa89aff, 1.1);
moon.shadow.camera.left = -55; moon.shadow.camera.right = 55; moon.shadow.camera.top = 55; moon.shadow.camera.bottom = -55;
moon.shadow.camera.near = 1; moon.shadow.camera.far = 400;
moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.06;
scene.add(moon); scene.add(moon.target);
const playerLight = new THREE.PointLight(0x9fe9ff, 18, 12, 1.6); scene.add(playerLight);

// Neon reflection environment (makes car paint, armor and wet ground pick up colored light)
function makeEnvironment() {
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y;
      vec3 c = mix(vec3(0.16,0.07,0.28), vec3(0.02,0.02,0.06), smoothstep(0.0, 0.6, h));
      c = mix(c, vec3(0.05,0.03,0.06), smoothstep(0.0, -0.4, h));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  env.add(sky);
  const cols = [0x29f3ff, 0xff2bd6, 0xffa43a, 0x8a4dff, 0x29f3ff, 0xff2bd6, 0x3aff9a, 0xff1e3c];
  cols.forEach((c, i) => {
    const a = i / cols.length * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(6 + (i % 3) * 4, 3 + (i % 2) * 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.5), side: THREE.DoubleSide }));
    p.position.set(Math.cos(a) * 30, 4 + (i % 4) * 5, Math.sin(a) * 30); p.lookAt(0, 6, 0); env.add(p);
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3a2a6a).multiplyScalar(0.8), side: THREE.DoubleSide }));
  top.position.y = 40; top.rotation.x = Math.PI / 2; env.add(top);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}
scene.environment = makeEnvironment();

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.62);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());

const title = buildTitleScene();
const rain = new Rain(scene);
let city, fx, game, hud;

// ---------- input ----------
const input = {
  keys: new Set(), pressedSet: new Set(), dx: 0, dy: 0, wheel: 0,
  mouseDown: false, mouseClicked: false, mouseRight: false,
  down(c) { return this.keys.has(c); },
  pressed(c) { return this.pressedSet.has(c); },
  endFrame() { this.pressedSet.clear(); this.dx = 0; this.dy = 0; this.wheel = 0; this.mouseClicked = false; },
  reset() { this.keys.clear(); this.mouseDown = false; this.mouseRight = false; },
};
addEventListener('keydown', e => {
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!e.repeat) input.pressedSet.add(e.code);
  input.keys.add(e.code);
  onKey(e);
});
addEventListener('keyup', e => input.keys.delete(e.code));
addEventListener('blur', () => input.reset());
let lockFailed = false;
addEventListener('mousemove', e => {
  if (state !== 'play') return;
  // pointer lock normally; if the browser refuses it (e.g. an embedded frame) plain mouse movement still steers
  if (!document.pointerLockElement && !lockFailed) return;
  const mx = e.movementX || 0, my = e.movementY || 0;
  if (Math.abs(mx) > 250 || Math.abs(my) > 250) return; // ignore browser spikes
  input.dx += mx; input.dy += my;
});
document.addEventListener('pointerlockerror', () => { lockFailed = true; });
canvas.addEventListener('mousedown', e => {
  if (state !== 'play') return;
  if (!document.pointerLockElement) lockPointer();
  if (e.button === 0) { input.mouseDown = true; input.mouseClicked = true; }
  if (e.button === 2) input.mouseRight = true;
});
addEventListener('mouseup', e => { if (e.button === 0) input.mouseDown = false; if (e.button === 2) input.mouseRight = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (state === 'play') input.wheel += Math.sign(e.deltaY); }, { passive: true });

function lockPointer() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => { lockFailed = true; });
  } catch { lockFailed = true; }
  // some embedded pages silently refuse pointer lock: fall back to plain mouse movement
  setTimeout(() => { if (state === 'play' && !document.pointerLockElement) lockFailed = true; }, 900);
}
let wantLock = false;
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'play' && wantLock) openPause();
});

// ---------- screens ----------
let state = 'loading', optionsReturn = 'menu';
function showScreen(id) {
  for (const s of ['loading', 'title', 'menu', 'options', 'controls', 'pause', 'shop', 'challenges']) $(s).classList.toggle('show', s === id);
}
function setState(s) {
  state = s;
  hud && hud.show(s === 'play' || s === 'pause');
  audio.setMusic(s === 'title' || s === 'menu' || s === 'options' && optionsReturn === 'menu' || s === 'controls' && optionsReturn === 'menu');
}

function onKey(e) {
  audio.init();
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) goMenu();
  else if (state === 'play' && e.code === 'Escape') openPause();
  else if (state === 'pause' && e.code === 'Escape' && performance.now() - pausedAt > 400) resume();
  else if ((state === 'options' || state === 'controls') && e.code === 'Escape') backFromOptions();
  else if ((state === 'shop' || state === 'challenges') && e.code === 'Escape') backToPause();
  if (e.code === 'KeyM') { const m = audio.toggleMute(); hud && hud.toast(m ? 'SOUND OFF' : 'SOUND ON'); }
}

function goTitle() { showScreen('title'); setState('title'); }
function goMenu() {
  audio.init(); audio.play('start');
  showScreen('menu'); setState('menu'); refreshContinue();
  setupMenuScene();
}
function refreshContinue() {
  const sv = readSave();
  $('bContinue').disabled = !sv;
  $('saveInfo').textContent = sv ? 'Saved ' + new Date(sv.time).toLocaleString() : 'No saved game yet';
}
function readSave() { try { const s = JSON.parse(storage.get(SAVE_KEY)); return s && s.pos ? s : null; } catch { return null; } }

function startGame(save) {
  audio.init();
  teardownMenuScene();
  game.start(save);
  showScreen(null); setState('play');
  hud.toast(save ? 'GAME LOADED' : 'WELCOME TO NYC 3000');
  wantLock = true; lockPointer(); input.endFrame();
}
let pausedAt = 0;
function openPause() {
  if (state !== 'play') return;
  pausedAt = performance.now();
  wantLock = false;
  if (document.pointerLockElement) document.exitPointerLock();
  input.reset();
  $('pauseMsg').textContent = '';
  showScreen('pause'); setState('pause');
  audio.setEngine(false, 0, false);
}
function resume() {
  showScreen(null); setState('play');
  wantLock = true; lockPointer();
  last = performance.now();
}
function openOptions(from) { optionsReturn = from; buildOptions(); showScreen('options'); setState('options'); }
function openControls(from) { optionsReturn = from; showScreen('controls'); setState('controls'); }
function backFromOptions() {
  if (optionsReturn === 'pause') { showScreen('pause'); setState('pause'); }
  else { showScreen('menu'); setState('menu'); }
}

$('pressStart').onclick = () => goMenu();
$('title').addEventListener('click', e => { if (e.target === $('title')) goMenu(); });
$('bNew').onclick = () => startGame(null);
$('bContinue').onclick = () => { const s = readSave(); if (s) startGame(s); };
$('bOptions').onclick = () => openOptions('menu');
$('bControls').onclick = () => openControls('menu');
$('bOptBack').onclick = backFromOptions;
$('bCtrlBack').onclick = backFromOptions;
$('bResume').onclick = resume;
// pause-menu shop and challenges
let shopTab = 'cars';
const menuCtx = () => ({ game, renderer, scene, audio });
function openShop() { renderShop(menuCtx(), shopTab); $('shopMsg').textContent = ''; showScreen('shop'); setState('shop'); }
function openChallenges() { renderChallenges(menuCtx()); showScreen('challenges'); setState('challenges'); }
function backToPause() { showScreen('pause'); setState('pause'); }
$('bShop').onclick = openShop;
$('bChallenges').onclick = openChallenges;
$('bShopBack').onclick = backToPause;
$('bChBack').onclick = backToPause;
document.querySelectorAll('#shopTabs button').forEach(b => { b.onclick = () => { shopTab = b.dataset.tab; $('shopMsg').textContent = ''; renderShop(menuCtx(), shopTab); audio.play('ui'); }; });
$('bPOptions').onclick = () => openOptions('pause');
$('bPControls').onclick = () => openControls('pause');
$('bSave').onclick = () => {
  storage.set(SAVE_KEY, JSON.stringify(game.saveData()));
  $('pauseMsg').textContent = readSave() ? '✔ Game saved' : 'Could not save (storage blocked)';
  audio.play('pickup');
};
$('bQuit').onclick = () => { game.active = false; game._leaveInterior(); game.clearWorld(); game.player.h.root.visible = false; goMenu(); };
document.querySelectorAll('button').forEach(b => b.addEventListener('mouseenter', () => audio.play('ui')));

// ---------- options ----------
function buildOptions() {
  const grid = $('optGrid'); grid.innerHTML = '';
  for (const d of OPTION_DEFS) {
    const lab = document.createElement('label'); lab.textContent = d.label; grid.appendChild(lab);
    const box = document.createElement('div');
    if (d.type === 'seg') {
      box.className = 'seg';
      for (const [val, txt] of d.options) {
        const b = document.createElement('button'); b.textContent = txt;
        b.classList.toggle('on', settings[d.key] === val);
        b.onclick = () => { setOption(d.key, val); buildOptions(); };
        box.appendChild(b);
      }
    } else {
      box.className = 'rng';
      const r = document.createElement('input'); r.type = 'range'; r.min = d.min; r.max = d.max; r.step = d.step; r.value = settings[d.key];
      const o = document.createElement('output'); o.textContent = d.fmt(settings[d.key]);
      r.oninput = () => { setOption(d.key, parseFloat(r.value)); o.textContent = d.fmt(settings[d.key]); markPreset(); };
      box.appendChild(r); box.appendChild(o);
    }
    box.dataset.key = d.key;
    grid.appendChild(box);
    if (d.hint) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = d.hint; grid.appendChild(h); }
  }
}
function markPreset() {
  const box = document.querySelector('[data-key="preset"]'); if (!box) return;
  [...box.children].forEach((b, i) => b.classList.toggle('on', OPTION_DEFS[0].options[i][0] === settings.preset));
}
function setOption(key, val) {
  if (key === 'preset') {
    settings.preset = val;
    if (PRESETS[val]) Object.assign(settings, PRESETS[val]);
  } else {
    settings[key] = val;
    if (GRAPHICS_KEYS.includes(key)) settings.preset = 'custom';
  }
  saveSettings(settings);
  applySettings();
}

let shadowsOn = null;
function applySettings() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr * settings.resScale);
  composer.setPixelRatio(dpr * settings.resScale);
  resize();
  if (shadowsOn !== settings.shadows) {
    shadowsOn = settings.shadows;
    renderer.shadowMap.enabled = settings.shadows;
    moon.castShadow = settings.shadows;
    const sz = settings.preset === 'high' ? 2048 : 1024;
    moon.shadow.mapSize.set(sz, sz);
    if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  }
  const vd = settings.viewDist;
  camera.far = vd + 150; camera.updateProjectionMatrix();
  scene.fog.density = 2.1 / vd;
  if (city) city.sky.scale.setScalar(camera.far * 0.9);
  rain.setLevel(state === 'loading' ? 0 : settings.rain);
  audio.setVolume(settings.volume);
  audio.setRain && audio.setRain(settings.rain);
  if (city) city.bbInterval = settings.preset === 'low' ? 0.5 : 0.12;
  fpsInterval = settings.fpsCap ? 1000 / settings.fpsCap : 0;
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  title.camera.aspect = w / h; title.camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- menu scene (concept5: soldier & hover car on a rooftop) ----------
let menuProps = null;
function setupMenuScene() {
  if (menuProps) return;
  // find a tall, open rooftop near the middle of town with a view to the north
  let roof = null, bestScore = -1e9;
  for (const b of city.boxes) {
    if (b.low || b.y0 !== 0) continue;
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (w < 20 || d < 20 || b.y1 < 110 || b.y1 > 240 || Math.abs(cx) > 300 || cz < 0) continue;
    if (city.boxes.some(o => o !== b && o.y0 >= b.y1 - 0.1 && o.x0 < b.x1 && o.x1 > b.x0 && o.z0 < b.z1 && o.z1 > b.z0)) continue;
    // how open is the view to the north (-z)?
    let block = 0;
    for (let k = 1; k <= 6; k++) block += Math.max(0, city.roofAt(cx, b.z0 - 25 * k) - b.y1 + 10);
    const score = -block * 3 - Math.abs(cx) * 0.1 - cz * 0.05;
    if (score > bestScore) { bestScore = score; roof = b; }
  }
  if (!roof) roof = { x0: -20, x1: 20, z0: 140, z1: 180, y1: 0 };
  const cx = (roof.x0 + roof.x1) / 2, cz = (roof.z0 + roof.z1) / 2, y = roof.y1;
  const g = new THREE.Group();
  const s = new Humanoid('soldier'); s.holdGun(makeGun('rifle'));
  s.root.position.set(cx + 2.5, y, roof.z0 + 3); s.root.rotation.y = -0.35;
  s.animate(0, 0, { aim: -0.5 });
  g.add(s.root);
  const car = makeVehicleMesh('hover', '#c01848'); car.position.set(cx + 6.2, y + 0.6, roof.z0 + 2.2); car.rotation.y = 0.9; g.add(car);
  const lt = new THREE.PointLight(0xffa43a, 50, 22, 1.5); lt.position.set(cx + 1, y + 4, roof.z0 + 10); g.add(lt);
  const lt2 = new THREE.PointLight(0x29f3ff, 80, 20, 1.5); lt2.position.set(cx + 4, y + 3, roof.z0 + 0.5); g.add(lt2);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(roof.x1 - roof.x0 - 0.5, 0.3, roof.z1 - roof.z0 - 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1d2a, roughness: 0.6, metalness: 0.4 }));
  pad.position.set(cx, y + 0.15, cz); g.add(pad);
  s.root.position.y += 0.3; car.position.y += 0.3;
  scene.add(g);
  menuProps = { g, cx, z0: roof.z0, y: y + 0.3, t: 0, s };
  game.player.h.root.visible = false;
  rain.setLevel(settings.rain);
}
function teardownMenuScene() { if (menuProps) { scene.remove(menuProps.g); menuProps = null; } }
function updateMenuCam(dt) {
  const m = menuProps; if (!m) return;
  m.t += dt;
  const sw = Math.sin(m.t * 0.07);
  camera.position.set(m.cx - 0.5 + sw * 1.2, m.y + 2.1 + Math.sin(m.t * 0.2) * 0.15, m.z0 + 12.5);
  camera.lookAt(m.cx + 7 + sw * 2, m.y - 2, m.z0 - 70);
  camera.fov = 55; camera.updateProjectionMatrix();
}

// ---------- optional concept-art backgrounds ----------
function tryBg(file, el, cls) {
  const img = new Image();
  img.onload = () => { $(el).style.backgroundImage = `url(${file})`; $(el).classList.add(cls); bgFlags[el] = true; };
  img.src = file;
}
const bgFlags = {};
tryBg('title-bg.jpg', 'title', 'has-img');
tryBg('menu-bg.jpg', 'menu', 'has-img');

// Shadow camera follows the player, snapped to whole shadow-map texels so shadows don't shimmer.
const moonOff = new THREE.Vector3(60, 140, 50);
const lightRot = new THREE.Matrix4().lookAt(moonOff, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
const lightRotInv = lightRot.clone().invert();
const _lp = new THREE.Vector3();
function placeMoon(focus) {
  const texel = 110 / moon.shadow.mapSize.x;
  _lp.copy(focus).applyMatrix4(lightRotInv);
  _lp.x = Math.round(_lp.x / texel) * texel; _lp.y = Math.round(_lp.y / texel) * texel;
  _lp.applyMatrix4(lightRot);
  moon.target.position.copy(_lp);
  moon.position.copy(_lp).add(moonOff);
  moon.target.updateMatrixWorld();
}

// ---------- loop ----------
let last = performance.now(), fpsInterval = 0, lastFrame = 0, fpsSm = 60;
function frame(now) {
  requestAnimationFrame(frame);
  if (fpsInterval && now - lastFrame < fpsInterval - 1.5) return;
  lastFrame = now;
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (dt <= 0) dt = 0.016;
  fpsSm += (1 / dt - fpsSm) * 0.05;
  audio.tickMusic();
  const useBloom = settings.bloom;
  if (state === 'title') {
    if (bgFlags.title) { renderer.setClearColor(0x000000); renderer.clear(); return; }
    title.update(dt);
    if (useBloom) { renderPass.scene = title.scene; renderPass.camera = title.camera; composer.render(dt); }
    else renderer.render(title.scene, title.camera);
    return;
  }
  if (state === 'loading') return;
  const inMenu = state === 'menu' || ((state === 'options' || state === 'controls') && optionsReturn === 'menu');
  if (state === 'play') {
    game.update(dt);
    hud.update(game, dt, settings.showFps, fpsSm);
  } else if (inMenu) updateMenuCam(dt);
  input.endFrame();
  // world updates
  const focus = state === 'play' || state === 'pause' ? (game.player.vehicle ? game.player.vehicle.pos : game.player.pos) : camera.position;
  placeMoon(focus);
  playerLight.position.set(focus.x, focus.y + 3, focus.z);
  playerLight.intensity = state === 'play' || state === 'pause' ? (game.player.vehicle ? 6 : game.interior ? 4 : 18) : 0;
  city.sky.position.copy(camera.position);
  if (state !== 'pause') {
    city.update(dt, camera.position, settings.viewDist, performance.now() / 1000);
    rain.update(dt, camera.position);
  }
  if (rain.mesh) rain.mesh.visible = !(game && game.interior); // no rain indoors
  if (bgFlags.menu && inMenu) { renderer.setClearColor(0x000000); renderer.clear(); return; }
  if (useBloom) { renderPass.scene = scene; renderPass.camera = camera; composer.render(dt); }
  else renderer.render(scene, camera);
}

// ---------- boot ----------
async function boot() {
  const step = (p, t) => { $('loadFill').style.width = (p * 100) + '%'; $('loadText').textContent = t; return new Promise(r => setTimeout(r, 30)); };
  await step(0.05, 'Loading fonts…');
  try { await Promise.race([document.fonts.load('900 40px Orbitron'), new Promise(r => setTimeout(r, 1500))]); } catch { /* ignore */ }
  await step(0.08, 'Loading Blender models…');
  await loadModels(['cars', 'people', 'buildings', 'interiors'], p => { $('loadFill').style.width = (8 + p * 7) + '%'; });
  await step(0.15, 'Building Manhattan 3000…');
  city = new City(scene);
  city.build();
  await step(0.7, 'Spawning traffic & neon…');
  fx = new Effects(scene, city.glowTex);
  hud = new HUD();
  game = new Game({ scene, camera, city, fx, audio, settings, hud, input });
  game.player.h.root.visible = false;
  game.rooms = buildRooms(scene, city); // shop and flat interiors behind the street doors
  game.onSave = () => { storage.set(SAVE_KEY, JSON.stringify(game.saveData())); return !!readSave(); };
  applySettings();
  resize();
  await step(0.9, 'Compiling shaders…');
  // warm up shaders for both scenes
  camera.position.set(0, 60, 200); camera.lookAt(0, 30, 0);
  renderer.compile(scene, camera);
  renderer.compile(title.scene, title.camera);
  await step(1, 'Ready');
  $('loading').classList.remove('show');
  goTitle();
  requestAnimationFrame(frame);
}
boot();

// debug / automation handle
// headless testing helper: advance the game without rendering
function sim(seconds, step = 1 / 30) {
  for (let t = 0; t < seconds; t += step) { game.update(step); input.pressedSet.clear(); input.mouseClicked = false; input.dx = input.dy = 0; }
  hud.update(game, 0.016, settings.showFps, fpsSm);
}
window.nyc = { sim, models: MODELS, THREE, get game() { return game; }, get city() { return city; }, settings, setOption, startGame, goMenu, openPause, resume, renderer, camera, scene, input, get state() { return state; } };
