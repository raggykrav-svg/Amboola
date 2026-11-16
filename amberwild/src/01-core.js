import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

// ---------- small helpers
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const pick = a => a[Math.random() * a.length | 0];
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); }
function fbm(x, y, o = 4) { let s = 0, a = .5, n = 0; for (let i = 0; i < o; i++) { s += vnoise(x, y) * a; n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= .5; } return s / n; }
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// ---------- geometry kit: every model is merged primitives with vertex colours
const V3 = THREE.Vector3;
const _m4 = new THREE.Matrix4(), _v = new V3(), _s = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _ca = new THREE.Color(), _cb = new THREE.Color();
const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  sph: (r, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs),
  cyl: (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s),
  cone: (r, h, s = 8) => new THREE.CylinderGeometry(.002, r, h, s),
  cap: (r, l, s = 8) => new THREE.CapsuleGeometry(r, l, 3, s),
  ico: (r, d = 1) => new THREE.IcosahedronGeometry(r, d),
  tor: (R, r, arc) => new THREE.TorusGeometry(R, r, 5, 12, arc),
};
// col: a hex colour, or fn(x, y, z, normalY, outColor). col2: colour of the underside.
function paint(g, col, col2) {
  const P = g.attributes.position, N = g.attributes.normal, C = new Float32Array(P.count * 3), fn = typeof col === 'function' ? col : null;
  if (!fn) { _ca.set(col); if (col2 !== undefined) _cb.set(col2); }
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (fn) fn(x, y, z, N.getY(i), _c); else if (col2 !== undefined) _c.copy(_cb).lerp(_ca, smooth(-.35, .55, N.getY(i))); else _c.copy(_ca);
    const j = .93 + hash2(x * 131 + z * 71, y * 97) * .14;
    C[i * 3] = _c.r * j; C[i * 3 + 1] = _c.g * j; C[i * 3 + 2] = _c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return g;
}
function part(g, col, p, r, s, col2) {
  if (g.index) { const t = g.toNonIndexed(); g.dispose(); g = t; }
  if (p || r || s !== undefined) {
    _v.set(...(p || [0, 0, 0])); _e.set(...(r || [0, 0, 0])); _q.setFromEuler(_e);
    _s.set(...(s === undefined || s === null ? [1, 1, 1] : typeof s === 'number' ? [s, s, s] : s));
    g.applyMatrix4(_m4.compose(_v, _q, _s));
  }
  return paint(g, col, col2);
}
function merge(parts) {
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { P.set(g.attributes.position.array, o); N.set(g.attributes.normal.array, o); C.set(g.attributes.color.array, o); o += g.attributes.position.count * 3; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return out;
}

// ---------- save
const SAVE_KEY = 'amberwild.save.v1';
const ITEM = { wood: 'Wood', stone: 'Stone', fibre: 'Fibre', hide: 'Hide', bone: 'Bone', feather: 'Feathers', meat: 'Raw meat', cooked: 'Cooked meat', berries: 'Berries', arrows: 'Arrows', bandage: 'Bandages', saddle: 'Saddles' };
const fresh = () => ({
  created: false, look: { body: 1, skin: 2, hair: 2, hairCol: 1, beard: 0, outfit: 0, paint: 0 },
  inv: { wood: 0, stone: 0, fibre: 0, hide: 0, bone: 0, feather: 0, meat: 0, cooked: 0, berries: 0, arrows: 0, bandage: 0, saddle: 0 },
  tools: { axe: 0, spear: 0, bow: 0, armor: 0 }, amber: 250, owned: [], equip: { skin: null, hat: null, bow: null },
  quest: 0, qd: {}, codex: {}, builds: [], pos: null, spawn: null, hp: 100, food: 85, water: 85, time: .32, day: 1, tames: [], flags: {},
  opt: { q: null, sens: 1, vol: .7 },
});
function load() {
  try { const j = JSON.parse(localStorage.getItem(SAVE_KEY)), f = fresh(); if (j && j.inv) return { ...f, ...j, inv: { ...f.inv, ...j.inv }, tools: { ...f.tools, ...j.tools }, look: { ...f.look, ...j.look }, equip: { ...f.equip, ...j.equip }, opt: { ...f.opt, ...j.opt } }; } catch { }
  return fresh();
}
let S = load();
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { } }

// ---------- shared runtime state
let scene, camera, renderer, now = 0, mode = 'boot';   // mode: boot | title | creator | play | panel | dead
const keys = {}, inp = { mx: 0, my: 0, lmb: false, lmbHit: false, jx: 0, jy: 0, locked: false, touch: false };
const dinos = [], npcs = [], fires = [];

// ---------- particles (one Points cloud, pooled)
const PMAX = 420, pP = new Float32Array(PMAX * 3).fill(-999), pC = new Float32Array(PMAX * 3), pV = new Float32Array(PMAX * 4); let pI = 0, pMesh;
function initParticles() {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pP, 3)); g.setAttribute('color', new THREE.BufferAttribute(pC, 3));
  pMesh = new THREE.Points(g, new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, opacity: .95, depthWrite: false }));
  pMesh.frustumCulled = false; scene.add(pMesh);
}
function puff(x, y, z, col, n = 8, spd = 2.5, up = 2, life = .7) {
  _c.set(col);
  for (let k = 0; k < n; k++) {
    const i = pI = (pI + 1) % PMAX; pP[i * 3] = x; pP[i * 3 + 1] = y; pP[i * 3 + 2] = z;
    const j = .75 + Math.random() * .4; pC[i * 3] = _c.r * j; pC[i * 3 + 1] = _c.g * j; pC[i * 3 + 2] = _c.b * j;
    pV[i * 4] = (Math.random() - .5) * spd; pV[i * 4 + 1] = Math.random() * up + .4; pV[i * 4 + 2] = (Math.random() - .5) * spd; pV[i * 4 + 3] = life * (.6 + Math.random() * .6);
  }
}
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    if (pV[i * 4 + 3] <= 0) continue;
    pV[i * 4 + 3] -= dt; pV[i * 4 + 1] -= 5 * dt;
    pP[i * 3] += pV[i * 4] * dt; pP[i * 3 + 1] += pV[i * 4 + 1] * dt; pP[i * 3 + 2] += pV[i * 4 + 2] * dt;
    if (pV[i * 4 + 3] <= 0) pP[i * 3 + 1] = -999;
  }
  pMesh.geometry.attributes.position.needsUpdate = true; pMesh.geometry.attributes.color.needsUpdate = true;
}

// ---------- sound: everything is synthesised
const audio = { ctx: null, out: null, noise: null, wind: null };
function initAudio() {
  if (audio.ctx) return;
  try {
    const C = audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audio.out = C.createGain(); audio.out.gain.value = S.opt.vol; audio.out.connect(C.destination);
    const b = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; audio.noise = b;
    const n = C.createBufferSource(); n.buffer = b; n.loop = true; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = audio.wind = C.createGain(); g.gain.value = .05; n.connect(f).connect(g).connect(audio.out); n.start();
  } catch { audio.ctx = null; }
}
function tone(f0, f1, dur, type = 'sine', vol = .2, delay = 0) {
  const C = audio.ctx; if (!C) return; const t = C.currentTime + delay, o = C.createOscillator(), g = C.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(audio.out); o.start(t); o.stop(t + dur + .02);
}
function hiss(dur, freq, vol = .25, type = 'bandpass', delay = 0, f1) {
  const C = audio.ctx; if (!C) return; const t = C.currentTime + delay, n = C.createBufferSource(), f = C.createBiquadFilter(), g = C.createGain();
  n.buffer = audio.noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); n.connect(f).connect(g).connect(audio.out); n.start(t, Math.random()); n.stop(t + dur + .02);
}
const SFX = {
  click: () => tone(620, 480, .05, 'triangle', .12), pick: () => { tone(520, 780, .09, 'triangle', .16); },
  chop: () => { hiss(.09, 900, .4); tone(160, 70, .1, 'square', .12); }, rock: () => { hiss(.07, 2600, .35); tone(300, 180, .05, 'square', .08); },
  swing: () => hiss(.16, 700, .14, 'bandpass', 0, 1800), hit: () => { hiss(.1, 500, .4, 'lowpass'); tone(120, 50, .14, 'sawtooth', .16); },
  bow: () => { tone(240, 90, .16, 'triangle', .25); hiss(.2, 2400, .12, 'highpass'); }, thunk: () => { tone(170, 60, .09, 'square', .14); hiss(.05, 1200, .2); },
  hurt: () => { tone(220, 90, .22, 'sawtooth', .22); }, eat: () => { hiss(.07, 1400, .2); hiss(.07, 1100, .2, 'bandpass', .14); },
  craft: () => { tone(440, 440, .08, 'triangle', .16); tone(660, 660, .1, 'triangle', .16, .09); tone(880, 880, .16, 'triangle', .14, .19); },
  perfect: () => { tone(880, 1320, .12, 'sine', .2); tone(1320, 1760, .2, 'sine', .16, .08); },
  tame: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .22, 'triangle', .18, i * .12)),
  roar: (v = 1) => { tone(140, 45, 1.1, 'sawtooth', .3 * v); hiss(1.1, 380, .45 * v, 'lowpass', 0, 120); tone(90, 38, 1.2, 'square', .14 * v, .05); },
  screech: (v = 1) => { tone(900, 420, .32, 'sawtooth', .13 * v); hiss(.3, 2200, .12 * v); }, squeak: () => tone(1500, 2100, .09, 'sine', .08),
  bellow: (v = 1) => { tone(110, 70, .7, 'sawtooth', .22 * v); hiss(.6, 260, .25 * v, 'lowpass'); },
  step: () => hiss(.05, 300 + Math.random() * 200, .07, 'lowpass'), splash: () => hiss(.25, 1400, .16, 'bandpass', 0, 500),
  build: () => { tone(200, 140, .07, 'square', .14); hiss(.06, 800, .3); }, deny: () => tone(180, 130, .14, 'square', .1),
  coin: () => { tone(1200, 1200, .06, 'triangle', .14); tone(1600, 1600, .12, 'triangle', .14, .06); },
  win: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f, .3, 'triangle', .2, i * .14)), heart: () => tone(700, 900, .12, 'sine', .12),
};
function sfx(n, a) { if (audio.ctx && SFX[n]) try { SFX[n](a); } catch { } }
// quieter with distance from the player
function sfxAt(n, x, z, range = 60) { const d = dist2(x, z, player.x, player.z); if (d < range) sfx(n, 1 - d / range); }
