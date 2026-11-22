// Advertising, Night-City style but kid-friendly and made-up: animated ad screens on the
// buildings (all of them share one texture atlas and one shader: 2 draw calls for the whole
// city), and a few giant holograms: dancers on megabuilding courtyards, a waving robot cat,
// a spinning soda can and whales that swim around the corporate towers.
import * as THREE from 'three';
import { Humanoid } from './people.js';
import { Parts } from './parts.js';

const HOLO_T = { value: 0 };

// ---------------- the ad atlas ----------------
const FONT = '900 {s}px Orbitron, "Arial Black", sans-serif', FONT2 = '700 {s}px Rajdhani, Arial, sans-serif';
function txt(g, s, x, y, size, color, glow = color, font = FONT, maxW = 0) {
  let sz = size; g.font = font.replace('{s}', sz);
  if (maxW) while (g.measureText(s).width > maxW && sz > 8) { sz -= 2; g.font = font.replace('{s}', sz); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = glow; g.shadowBlur = 18; g.fillStyle = color; g.fillText(s, x, y);
  g.shadowBlur = 0;
}
const circle = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function bolt(g, x, y, s, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x - s * 0.45, y + s * 0.1); g.lineTo(x - s * 0.05, y + s * 0.1); g.lineTo(x - s * 0.25, y + s); g.lineTo(x + s * 0.45, y - s * 0.15); g.lineTo(x + s * 0.05, y - s * 0.15); g.closePath(); g.fill(); }

// 16 wide ads, 2 frames each: [name, background colours, draw(g, frame, W, H)]
const WIDE = [
  ['ZAP COLA', ['#c0102a', '#3a0010'], (g, f, W, H) => {
    if (!f) { rect(g, 22, 18, 48, 92, '#e8e8f0'); rect(g, 22, 34, 48, 58, '#d01030'); bolt(g, 46, 62, 22, '#ffd23a'); txt(g, 'ZAP COLA', 160, 52, 34, '#fff', '#ff3050', FONT, 170); txt(g, 'ICE COLD', 160, 92, 20, '#ffd23a', '#ffd23a', FONT2); }
    else { for (let k = 0; k < 3; k++) bolt(g, 40 + k * 88, 60, 26, '#ffd23a'); txt(g, 'TASTE THE LIGHTNING', 128, 104, 22, '#fff', '#ff3050', FONT, 236); }
  }],
  ['ROBO PUP', ['#0a6a72', '#022a36'], (g, f, W, H) => {
    if (!f) { rect(g, 30, 58, 64, 30, '#cfe8f0'); rect(g, 84, 38, 30, 26, '#cfe8f0'); rect(g, 104, 46, 8, 6, '#29f3ff'); for (const x of [34, 50, 70, 86]) rect(g, x, 86, 7, 22, '#9fb8c4'); rect(g, 24, 54, 12, 5, '#cfe8f0'); rect(g, 92, 28, 4, 12, '#ff2bd6'); txt(g, 'ROBO PUP', 186, 62, 30, '#fff', '#29f3ff', FONT, 130); }
    else { for (let k = 0; k < 4; k++) { circle(g, 40 + k * 56, 40 + (k % 2) * 14, 9, '#29f3ff'); for (let q = 0; q < 3; q++) circle(g, 32 + k * 56 + q * 8, 28 + (k % 2) * 14, 4, '#29f3ff'); } txt(g, 'YOUR NEW BEST FRIEND', 128, 100, 20, '#fff', '#29f3ff', FONT, 236); }
  }],
  ['KAIJU RAMEN', ['#ff6a1a', '#5a0a10'], (g, f, W, H) => {
    if (!f) { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 62, 44, 0, Math.PI); g.fill(); rect(g, 18, 58, 92, 6, '#ffd23a'); for (let k = 0; k < 5; k++) { g.strokeStyle = '#ffe8c0'; g.lineWidth = 2; g.beginPath(); g.moveTo(40 + k * 10, 54); g.bezierCurveTo(30 + k * 10, 36, 50 + k * 10, 30, 42 + k * 10, 14); g.stroke(); } rect(g, 84, 6, 4, 60, '#c08a4a'); rect(g, 94, 8, 4, 58, '#c08a4a'); txt(g, 'KAIJU', 186, 44, 32, '#fff', '#ffd23a', FONT, 130); txt(g, 'RAMEN', 186, 84, 32, '#fff', '#ffd23a', FONT, 130); }
    else { txt(g, 'ラーメン', 128, 52, 44, '#fff', '#ff2bd6', '900 {s}px sans-serif', 230); txt(g, 'SLURP THE MONSTER!', 128, 104, 20, '#ffd23a', '#ffd23a', FONT, 236); }
  }],
  ['SKY TAXI', ['#f2c21a', '#1a1408'], (g, f, W, H) => {
    if (!f) { g.fillStyle = '#ffd23a'; g.beginPath(); g.ellipse(70, 66, 52, 18, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1a2a40'; g.beginPath(); g.ellipse(78, 54, 22, 12, 0, Math.PI, Math.PI * 2); g.fill(); rect(g, 40, 82, 60, 4, '#29f3ff'); txt(g, 'SKY TAXI', 186, 64, 30, '#111', '#fff', FONT, 130); }
    else { txt(g, 'FLY ANYWHERE', 128, 50, 30, '#111', '#fff', FONT, 230); txt(g, 'CALL 3000-TAXI', 128, 98, 22, '#111', '#fff8', FONT2); }
  }],
  ['NEO SNAX', ['#7a1aff', '#1a0640'], (g, f, W, H) => {
    if (!f) { g.fillStyle = '#ff2bd6'; g.beginPath(); g.moveTo(30, 18); g.lineTo(102, 18); g.lineTo(96, 112); g.lineTo(36, 112); g.closePath(); g.fill(); circle(g, 66, 66, 22, '#ffd23a'); txt(g, 'NEO SNAX', 186, 64, 30, '#fff', '#ff2bd6', FONT, 130); }
    else { for (let k = 0; k < 7; k++) circle(g, 24 + k * 34, 36 + Math.sin(k) * 10, 12, '#ffd23a'); txt(g, 'CRUNCH THE FUTURE', 128, 100, 22, '#fff', '#ff2bd6', FONT, 236); }
  }],
  ['HOLO-BANK', ['#0a2a6a', '#021028'], (g, f, W, H) => {
    if (!f) { circle(g, 64, 64, 42, '#29f3ff'); circle(g, 64, 64, 34, '#0a2a6a'); txt(g, 'H', 64, 66, 44, '#29f3ff'); txt(g, 'HOLO-BANK', 186, 64, 28, '#fff', '#29f3ff', FONT, 130); }
    else { txt(g, 'YOUR MONEY', 128, 46, 30, '#fff', '#29f3ff', FONT, 236); txt(g, 'IN THE CLOUD', 128, 92, 30, '#29f3ff', '#29f3ff', FONT, 236); }
  }],
  ['ARCADE 9', ['#ff2bd6', '#1a0a5a'], (g, f, W, H) => {
    if (!f) { rect(g, 30, 74, 70, 30, '#222'); rect(g, 60, 36, 8, 42, '#bbb'); circle(g, 64, 34, 14, '#ff2040'); circle(g, 88, 88, 7, '#29f3ff'); txt(g, 'ARCADE 9', 186, 64, 28, '#fff', '#29f3ff', FONT, 130); }
    else { for (let k = 0; k < 10; k++) rect(g, 12 + k * 24, 20 + (k % 3) * 10, 10, 10, ['#ffd23a', '#29f3ff', '#3aff9a'][k % 3]); txt(g, 'HIGH SCORE CITY', 128, 96, 24, '#fff', '#ff2bd6', FONT, 236); }
  }],
  ['MOON TRIPS', ['#141a4a', '#02030a'], (g, f, W, H) => {
    if (!f) { circle(g, 66, 64, 46, '#e8e4d8'); circle(g, 50, 50, 9, '#c8c4b8'); circle(g, 80, 78, 12, '#c8c4b8'); circle(g, 74, 40, 5, '#c8c4b8'); txt(g, 'MOON TRIPS', 186, 64, 26, '#fff', '#9fe9ff', FONT, 130); }
    else { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(40, 100); g.lineTo(52, 30); g.lineTo(64, 100); g.closePath(); g.fill(); rect(g, 46, 100, 12, 10, '#ff6a1a'); txt(g, 'WEEKEND ON', 156, 46, 26, '#fff', '#9fe9ff', FONT, 180); txt(g, 'THE MOON!', 156, 88, 26, '#ffd23a', '#ffd23a', FONT, 180); }
  }],
  ['QUANTUM BURGER', ['#ffa43a', '#5a1a04'], (g, f, W, H) => {
    if (!f) { g.fillStyle = '#d08a3a'; g.beginPath(); g.arc(64, 60, 40, Math.PI, 0); g.fill(); rect(g, 24, 60, 80, 8, '#3aa83a'); rect(g, 24, 68, 80, 12, '#5a2a14'); rect(g, 24, 80, 80, 6, '#ffd23a'); rect(g, 26, 86, 76, 14, '#d08a3a'); txt(g, 'QUANTUM', 186, 46, 26, '#fff', '#ffd23a', FONT, 130); txt(g, 'BURGER', 186, 84, 26, '#fff', '#ffd23a', FONT, 130); }
    else { txt(g, 'BIGGER ON', 128, 46, 32, '#fff', '#ff6a1a', FONT, 236); txt(g, 'THE INSIDE', 128, 90, 32, '#fff', '#ff6a1a', FONT, 236); }
  }],
  ['TURBO KICKS', ['#1aa86a', '#021a10'], (g, f, W, H) => {
    if (!f) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(20, 90); g.lineTo(28, 50); g.lineTo(60, 56); g.lineTo(104, 80); g.lineTo(108, 96); g.lineTo(20, 96); g.closePath(); g.fill(); rect(g, 20, 96, 90, 8, '#29f3ff'); txt(g, 'TURBO KICKS', 186, 64, 24, '#fff', '#3aff9a', FONT, 130); }
    else { for (let k = 0; k < 6; k++) rect(g, 10 + k * 8, 30 + k * 12, 70 - k * 6, 3, '#3aff9a'); txt(g, 'RUN FASTER', 160, 48, 28, '#fff', '#3aff9a', FONT, 180); txt(g, 'THAN LIGHT', 160, 90, 28, '#fff', '#3aff9a', FONT, 180); }
  }],
  ['PLASMA PIZZA', ['#d01a10', '#3a0a02'], (g, f, W, H) => {
    if (!f) { g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(20, 28); g.lineTo(108, 28); g.lineTo(64, 112); g.closePath(); g.fill(); rect(g, 20, 22, 88, 10, '#c08a4a'); for (const [x, y] of [[48, 46], [76, 50], [62, 76]]) circle(g, x, y, 9, '#b0101a'); txt(g, 'PLASMA', 186, 46, 28, '#fff', '#ffd23a', FONT, 130); txt(g, 'PIZZA', 186, 86, 28, '#fff', '#ffd23a', FONT, 130); }
    else { txt(g, 'HOT IN', 128, 44, 34, '#fff', '#ffd23a', FONT, 236); txt(g, '30 SECONDS', 128, 90, 34, '#ffd23a', '#ff2040', FONT, 236); }
  }],
  ['LIBERTY CORP', ['#2a0006', '#050003'], (g, f, W, H) => {
    if (!f) { circle(g, 64, 64, 44, '#ff1e3c'); circle(g, 64, 64, 38, '#1a0004'); g.fillStyle = '#ff1e3c'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 12 : 30; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.closePath(); g.fill(); txt(g, 'LIBERTY', 186, 46, 28, '#fff', '#ff1e3c', FONT, 130); txt(g, 'CORP', 186, 86, 28, '#fff', '#ff1e3c', FONT, 130); }
    else { txt(g, 'BUILDING', 128, 40, 28, '#fff', '#ff1e3c', FONT, 236); txt(g, 'TOMORROW', 128, 76, 28, '#fff', '#ff1e3c', FONT, 236); txt(g, 'TODAY', 128, 110, 22, '#ff9aa6', '#ff1e3c', FONT, 236); }
  }],
  ['CHROME CARE', ['#3a4a6a', '#0a0e18'], (g, f, W, H) => {
    if (!f) { g.strokeStyle = '#cfd8e8'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(24, 104); g.lineTo(54, 60); g.lineTo(96, 44); g.stroke(); circle(g, 54, 60, 9, '#29f3ff'); circle(g, 100, 42, 10, '#cfd8e8'); txt(g, 'CHROME', 186, 46, 28, '#fff', '#29f3ff', FONT, 130); txt(g, 'CARE', 186, 86, 28, '#fff', '#29f3ff', FONT, 130); }
    else { txt(g, 'CYBERWARE', 128, 44, 30, '#fff', '#29f3ff', FONT, 236); txt(g, 'REPAIR 24/7', 128, 90, 30, '#29f3ff', '#29f3ff', FONT, 236); }
  }],
  ['NEON NIGHTS', ['#ff2bd6', '#2a0040'], (g, f, W, H) => {
    if (!f) { for (let k = 0; k < 3; k++) { circle(g, 32 + k * 30, 92 - k * 10, 10, '#fff'); rect(g, 40 + k * 30, 30 - k * 10, 4, 64, '#fff'); } txt(g, 'NEON', 186, 46, 30, '#fff', '#29f3ff', FONT, 130); txt(g, 'NIGHTS', 186, 86, 30, '#fff', '#29f3ff', FONT, 130); }
    else { txt(g, 'MUSIC FESTIVAL', 128, 46, 26, '#fff', '#29f3ff', FONT, 236); txt(g, 'SATURDAY · TIMES SQ', 128, 92, 20, '#ffd23a', '#ffd23a', FONT, 236); }
  }],
  ['VOLT ENERGY', ['#e8d81a', '#1a3a04'], (g, f, W, H) => {
    if (!f) { rect(g, 34, 26, 56, 84, '#1a1a1a'); rect(g, 52, 18, 20, 10, '#1a1a1a'); rect(g, 40, 70, 44, 34, '#3aff6a'); rect(g, 40, 50, 44, 16, '#3aff6a'); txt(g, 'VOLT', 186, 64, 38, '#111', '#fff', FONT, 130); }
    else { txt(g, 'ENERGY FOR', 128, 46, 30, '#111', '#fff', FONT, 236); txt(g, 'CYBORGS', 128, 90, 34, '#111', '#fff', FONT, 236); }
  }],
  ['SUSHI-BOT', ['#1ab0a8', '#032a30'], (g, f, W, H) => {
    if (!f) { circle(g, 64, 66, 40, '#1a1a1a'); circle(g, 64, 66, 30, '#fff'); circle(g, 64, 66, 16, '#ff6a3a'); txt(g, 'SUSHI-BOT', 186, 64, 26, '#fff', '#29f3ff', FONT, 130); }
    else { rect(g, 30, 30, 60, 50, '#cfe8f0'); rect(g, 42, 46, 10, 10, '#29f3ff'); rect(g, 68, 46, 10, 10, '#29f3ff'); rect(g, 46, 66, 28, 5, '#ff2bd6'); txt(g, 'MADE BY', 172, 46, 26, '#fff', '#29f3ff', FONT, 150); txt(g, 'ROBOTS!', 172, 88, 26, '#fff', '#29f3ff', FONT, 150); }
  }],
];
const TALL = [
  ['ZAP', ['#c0102a', '#2a0008'], (g, f, W, H) => { if (!f) { txt(g, 'Z', 64, 60, 70, '#fff', '#ff3050'); txt(g, 'A', 64, 128, 70, '#fff', '#ff3050'); txt(g, 'P', 64, 196, 70, '#fff', '#ff3050'); } else { rect(g, 34, 40, 60, 170, '#e8e8f0'); rect(g, 34, 70, 60, 110, '#d01030'); bolt(g, 64, 124, 40, '#ffd23a'); } }],
  ['GAME', ['#3a1aff', '#0a0430'], (g, f, W, H) => { if (!f) { txt(g, 'ゲ', 64, 56, 66, '#fff', '#29f3ff', '900 {s}px sans-serif'); txt(g, 'ー', 64, 126, 66, '#fff', '#29f3ff', '900 {s}px sans-serif'); txt(g, 'ム', 64, 196, 66, '#fff', '#29f3ff', '900 {s}px sans-serif'); } else { for (let k = 0; k < 6; k++) rect(g, 30 + (k % 2) * 40, 30 + k * 34, 28, 22, ['#ffd23a', '#29f3ff', '#3aff9a', '#ff2bd6'][k % 4]); } }],
  ['RAMEN', ['#ff6a1a', '#3a0a04'], (g, f, W, H) => { if (!f) { ['ラ', 'ー', 'メ', 'ン'].forEach((ch, k) => txt(g, ch, 64, 36 + k * 58, 52, '#fff', '#ffd23a', '900 {s}px sans-serif')); } else { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 140, 46, 0, Math.PI); g.fill(); for (let k = 0; k < 3; k++) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(44 + k * 20, 124); g.bezierCurveTo(30 + k * 20, 90, 60 + k * 20, 70, 46 + k * 20, 40); g.stroke(); } } }],
  ['OPEN', ['#0a8a4a', '#02200e'], (g, f, W, H) => { if (!f) { ['O', 'P', 'E', 'N'].forEach((ch, k) => txt(g, ch, 64, 36 + k * 58, 54, '#fff', '#3aff9a')); } else { txt(g, '24', 64, 90, 64, '#3aff9a', '#3aff9a'); txt(g, '7', 64, 170, 64, '#3aff9a', '#3aff9a'); } }],
];

function atlas(list, cw, ch, cols, rows) {
  const c = document.createElement('canvas'); c.width = cw * cols; c.height = ch * rows;
  const g = c.getContext('2d');
  list.forEach(([, bg, draw], k) => {
    for (let f = 0; f < 2; f++) {
      const cx = ((k * 2) % cols + f) * cw, cy = Math.floor(k * 2 / cols) * ch;
      g.save(); g.translate(cx, cy); g.beginPath(); g.rect(0, 0, cw, ch); g.clip();
      const grd = g.createLinearGradient(0, 0, cw, ch); grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
      g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
      draw(g, f, cw, ch);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.strokeRect(2, 2, cw - 4, ch - 4);
      g.restore();
    }
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------- ad screens ----------------
function screenMaterial(tex, cols, rows, time) {
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = time; sh.uniforms.uGrid = { value: new THREE.Vector2(cols, rows) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aAd;\nvarying vec3 vAd;\nvarying vec2 vLuv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAd = aAd; vLuv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec2 uGrid;\nvarying vec3 vAd;\nvarying vec2 vLuv;')
      .replace('#include <map_fragment>', `
        float cyc = fract(uTime * 0.085 + vAd.z);
        float hc = fract(cyc * 2.0);
        float frame = step(0.5, cyc);
        float wipe = smoothstep(0.0, 0.06, hc);
        float showNew = step(1.0 - wipe, vLuv.y);
        float fr = mix(1.0 - frame, frame, showNew);
        float gs = fract(sin(floor(uTime * 6.0) * 12.9898 + vAd.z * 78.233) * 43758.5453);
        float tear = step(0.965, gs) * (fract(sin(floor(vLuv.y * 14.0) * 7.13 + floor(uTime * 6.0)) * 91.7) - 0.5) * 0.12;
        vec2 luv = vec2(clamp(vLuv.x + tear, 0.01, 0.99), clamp(vLuv.y, 0.01, 0.99));
        vec4 texel = texture2D(map, (vec2(vAd.x + fr, vAd.y) + luv) / uGrid);
        float scan = 0.84 + 0.16 * sin(vLuv.y * 240.0 - uTime * 7.0);
        float bar = smoothstep(0.02, 0.0, abs(vLuv.y - (1.0 - wipe))) * (1.0 - step(0.999, wipe));
        diffuseColor.rgb *= texel.rgb * scan * 1.3 + vec3(0.6, 0.9, 1.0) * bar;`);
  };
  m.customProgramCacheKey = () => 'adScreen';
  return m;
}

export class AdScreens {
  constructor(scene, spots) {
    this.time = { value: 0 };
    const wide = spots.filter(s => s.h <= s.w * 1.2), tall = spots.filter(s => s.h > s.w * 1.2);
    this.meshes = [];
    if (wide.length) this.meshes.push(this._mesh(scene, wide, atlas(WIDE, 256, 128, 4, 8), 4, 8, WIDE.length));
    if (tall.length) this.meshes.push(this._mesh(scene, tall, atlas(TALL, 128, 256, 4, 2), 4, 2, TALL.length));
    this.count = spots.length;
  }
  _mesh(scene, spots, tex, cols, rows, nAds) {
    const n = spots.length, pos = new Float32Array(n * 12), uv = new Float32Array(n * 8), ad = new Float32Array(n * 12), idx = [];
    spots.forEach((s, i) => {
      const k = s.kind !== undefined ? s.kind % nAds : (i * 7 + Math.floor(s.x * 0.37 + s.z * 0.11)) % nAds;
      const kk = ((k % nAds) + nAds) % nAds;
      const cellX = (kk * 2) % cols, rowTop = Math.floor(kk * 2 / cols), cellY = rows - 1 - rowTop;
      const rx = Math.cos(s.rotY), rz = -Math.sin(s.rotY), hw = s.w / 2, hh = s.h / 2;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      corners.forEach(([a, b], q) => {
        pos.set([s.x + rx * hw * a, s.y + hh * b, s.z + rz * hw * a], i * 12 + q * 3);
        uv.set([(a + 1) / 2, (b + 1) / 2], i * 8 + q * 2);
        ad.set([cellX, cellY, (i * 0.618) % 1], i * 12 + q * 3);
      });
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aAd', new THREE.BufferAttribute(ad, 3));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, screenMaterial(tex, cols, rows, this.time));
    m.renderOrder = 1;
    scene.add(m);
    return m;
  }
  update(t) { this.time.value = t; }
}

// ---------------- holograms ----------------
function holoMat(color, opacity = 0.5, bend = 0) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = HOLO_T;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vHy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + (bend ? `\ntransformed.y += sin(uTime * 1.4 - position.z * 0.16) * ${bend.toFixed(3)} * max(0.0, position.z) * max(0.0, position.z);` : ''))
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHy = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vHy;')
      .replace('#include <opaque_fragment>', `float sl = 0.45 + 0.55 * step(0.45, fract(vHy * 1.6 - uTime * 1.2));
        float fl = 0.88 + 0.12 * sin(uTime * 23.0) * sin(uTime * 7.3);
        outgoingLight *= sl * fl;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'holo' + bend;
  return m;
}

// a robot cat waving one paw (built from simple parts)
function holoCat(color) {
  const P = new Parts();
  P.sphere(1.0, color, 0, 1.3, 0, 1.05, 1.15, 0.9, 16, 12);          // body
  P.sphere(0.85, color, 0, 2.75, 0, 1.1, 0.95, 0.95, 16, 12);        // head
  P.add(new THREE.ConeGeometry(0.32, 0.6, 4), color, -0.55, 3.55, 0, 0, 0, 0.25);
  P.add(new THREE.ConeGeometry(0.32, 0.6, 4), color, 0.55, 3.55, 0, 0, 0, -0.25);
  P.sphere(0.13, '#ffffff', -0.32, 2.85, 0.78); P.sphere(0.13, '#ffffff', 0.32, 2.85, 0.78);
  for (const s of [-1, 1]) for (const k of [-1, 1]) P.box(0.7, 0.03, 0.03, '#ffffff', s * 0.75, 2.55 + k * 0.08, 0.7, 0, 0, s * k * 0.15);
  P.sphere(0.3, color, -0.7, 1.4, 0.6, 1, 1, 1);                     // paw on the belly
  P.sphere(0.32, color, -0.5, 0.25, 0.4); P.sphere(0.32, color, 0.5, 0.25, 0.4);
  P.sphere(0.25, color, 0.2, 0.6, -0.9, 1, 1, 2.6);                  // tail
  const body = new THREE.Mesh(P.build(), holoMat(color, 0.5));
  const arm = new THREE.Group(); arm.position.set(0.85, 2.0, 0.1);
  const A = new Parts(); A.add(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8), color, 0, 0.55, 0); A.sphere(0.3, color, 0, 1.2, 0);
  arm.add(new THREE.Mesh(A.build(), holoMat(color, 0.5)));
  const g = new THREE.Group(); g.add(body, arm);
  g.userData.arm = arm;
  return g;
}
// a can of ZAP COLA
function holoCan() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c0102a'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#e8e8f0'; g.fillRect(0, 0, 512, 24); g.fillRect(0, 232, 512, 24);
  for (const x of [128, 384]) { txt(g, 'ZAP', x, 100, 64, '#fff', '#ff3050'); txt(g, 'COLA', x, 170, 48, '#ffd23a', '#ffd23a'); }
  bolt(g, 256, 128, 60, '#ffd23a');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = holoMat('#ffffff', 0.75); m.map = t;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2.4, 32, 1, true), m);
  const lids = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 2.42, 32, 1, false), holoMat('#ff8090', 0.18));
  const g2 = new THREE.Group(); g2.add(can, lids);
  return g2;
}
// a whale (length along +z from the nose at z = 0; the tail end bends)
function holoWhale(color) {
  const prof = [[0.01, 0], [0.7, 0.4], [1.3, 1.4], [1.75, 3], [1.9, 4.5], [1.75, 6.5], [1.3, 8.5], [0.8, 10.2], [0.45, 11.6], [0.25, 12.6]];
  const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20);
  body.rotateX(Math.PI / 2); // lathe axis y -> z
  body.scale(1.0, 0.82, 1);
  const P = new Parts();
  P.add(body, color);
  const fluke = new THREE.Shape(); fluke.moveTo(0, 0); fluke.quadraticCurveTo(1.6, 0.6, 2.6, 1.6); fluke.quadraticCurveTo(1.2, 1.2, 0, 0.9); fluke.quadraticCurveTo(-1.2, 1.2, -2.6, 1.6); fluke.quadraticCurveTo(-1.6, 0.6, 0, 0);
  const fg = new THREE.ShapeGeometry(fluke); fg.rotateX(Math.PI / 2); fg.translate(0, 0, 12.4);
  P.add(fg, color);
  for (const s of [-1, 1]) P.add(new THREE.BoxGeometry(2.2, 0.08, 0.9), color, s * 2.4, -0.8, 4.2, 0, s * 0.5, s * -0.35);
  for (let k = 0; k < 6; k++) P.box(0.05, 0.05, 6, '#ffffff', -0.5 + k * 0.2, -1.38, 4.5); // throat grooves
  return new THREE.Mesh(P.build(), holoMat(color, 0.42, 0.006));
}

export class Holograms {
  constructor(scene, city) {
    this.items = [];
    const spots = city.holoSpots;
    const courts = spots.filter(s => s.kind === 'court'), terr = spots.filter(s => s.kind === 'terrace'), orbits = spots.filter(s => s.kind === 'orbit');
    const add = (obj, data) => { scene.add(obj); this.items.push({ obj, ...data }); };
    // dancers
    courts.slice(0, 2).forEach((s, k) => {
      const h = new Humanoid('ped' + (k ? 5 : 2));
      const mat = holoMat(k ? '#ff2bd6' : '#29f3ff', 0.55);
      h.root.traverse(o => { if (o.isSkinnedMesh || o.isMesh) { o.material = mat; o.castShadow = false; o.frustumCulled = false; } });
      const sc = Math.min(13, s.size * 0.6);
      h.root.scale.setScalar(sc);
      h.root.position.set(s.x, s.y + 0.2, s.z);
      add(h.root, { kind: 'dancer', h, base: h.root.position.clone(), yaw: k * 2 });
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(sc * 0.55, sc * 0.6, 0.4, 32, 1, true), holoMat(k ? '#ff2bd6' : '#29f3ff', 0.4));
      pad.position.set(s.x, s.y + 0.2, s.z); add(pad, { kind: 'static' });
    });
    // the waving robot cat on a terrace
    const catSpot = terr[0] || courts[2];
    if (catSpot) {
      const cat = holoCat('#ffd23a'); cat.scale.setScalar(4.2);
      cat.position.set(catSpot.x, catSpot.y + 0.2, catSpot.z);
      cat.rotation.y = Math.atan2(-catSpot.x, -catSpot.z); // look at the city centre
      add(cat, { kind: 'cat' });
    }
    // a spinning soda can floating over another courtyard
    const canSpot = courts[2] || courts[0];
    if (canSpot) { const can = holoCan(); can.scale.setScalar(5.5); can.position.set(canSpot.x, canSpot.y + 14, canSpot.z); add(can, { kind: 'can', baseY: canSpot.y + 14 }); }
    // whales swimming around the corporate towers
    orbits.slice(0, 2).forEach((s, k) => {
      const w = holoWhale(k ? '#9a7aff' : '#29f3ff'); w.scale.setScalar(2.6);
      add(w, { kind: 'whale', c: s, a: k * Math.PI, sp: 0.05 + k * 0.012, dir: k ? -1 : 1 });
    });
  }
  update(dt, t, cam, viewDist) {
    HOLO_T.value = t;
    for (const it of this.items) {
      const o = it.obj;
      const far = Math.hypot(o.position.x - cam.x, o.position.z - cam.z) > viewDist + 120;
      o.visible = !far;
      if (far) continue;
      if (it.kind === 'dancer') { it.h.animate(dt, 0, { dance: true }); it.yaw += dt * 0.35; o.rotation.y = it.yaw; }
      else if (it.kind === 'cat') it.obj.userData.arm.rotation.z = -2.3 + Math.sin(t * 3.2) * 0.55;
      else if (it.kind === 'can') { o.rotation.y = t * 0.6; o.position.y = it.baseY + Math.sin(t * 0.9) * 1.5; o.rotation.z = Math.sin(t * 0.5) * 0.15; }
      else if (it.kind === 'whale') {
        it.a += dt * it.sp * it.dir;
        const r = it.c.r, x = it.c.x + Math.cos(it.a) * r, z = it.c.z + Math.sin(it.a) * r, y = it.c.y + Math.sin(t * 0.3 + it.a) * 10;
        o.position.set(x, y, z);
        // swim along the circle (nose first: the model's nose is at z = 0, the tail toward +z)
        const tx = -Math.sin(it.a) * it.dir, tz = Math.cos(it.a) * it.dir;
        o.rotation.set(Math.cos(t * 0.3 + it.a) * 0.08, Math.atan2(-tx, -tz), 0);
      }
    }
  }
}
