// Procedural canvas textures: windows, ground, neon signs, glow sprites.
import * as THREE from 'three';

export const CITY = { CELL: 84, ROAD: 20, N: 10, SIDEWALK: 4 };
CITY.HALF = (CITY.N * CITY.CELL) / 2; // roads at -HALF..HALF step CELL

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rnd(a, b) { return a + Math.random() * (b - a); }

export function windowTexture(palette, seed = 0) {
  // 8 cols x 16 rows of windows, each window cell = 4m x 4m. Texture covers 32m x 64m.
  const c = canvas(256, 512), g = c.getContext('2d');
  g.fillStyle = '#07080f'; g.fillRect(0, 0, 256, 512);
  const cw = 32, ch = 32;
  for (let r = 0; r < 16; r++) {
    // horizontal floor band
    g.fillStyle = '#0d0f1c'; g.fillRect(0, r * ch + ch - 5, 256, 3);
    for (let col = 0; col < 8; col++) {
      const lit = Math.random() < 0.42;
      let color = '#111522';
      if (lit) color = palette[Math.floor(Math.random() * palette.length)];
      g.fillStyle = color;
      g.globalAlpha = lit ? rnd(0.55, 1) : 1;
      g.fillRect(col * cw + 5, r * ch + 6, cw - 10, ch - 14);
      g.globalAlpha = 1;
      if (lit && Math.random() < 0.25) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(col * cw + 5, r * ch + 6, cw - 10, (ch - 14) * rnd(0.3, 0.7)); } // blinds
    }
  }
  // vertical mullions
  g.fillStyle = '#05060b';
  for (let col = 0; col <= 8; col++) g.fillRect(col * cw - 1, 0, 2, 512);
  // dark pixel region at (0..3,0..3) used for roofs
  g.fillStyle = '#06070d'; g.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Brick walk-up facade (classic NYC low-rise): colour map + an emissive map where only lit windows glow.
export function brickTextures() {
  const c = canvas(256, 512), g = c.getContext('2d');
  const e = canvas(256, 512), ge = e.getContext('2d');
  g.fillStyle = '#3e2a26'; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 6) {
    for (let x = ((y / 6) % 2) * 6 - 6; x < 256; x += 12) {
      g.fillStyle = `hsl(${6 + Math.random() * 12}, ${38 + Math.random() * 15}%, ${26 + Math.random() * 12}%)`;
      g.fillRect(x, y, 11, 5);
    }
  }
  ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 512);
  const warm = ['#ffd9a0', '#ffc070', '#fff0d0', '#ff9a6a', '#bfe8ff', '#ff8ad8'];
  for (let r = 0; r < 16; r++) for (let col = 0; col < 8; col++) {
    const x = col * 32 + 9, y = r * 32 + 7, w = 14, h = 19;
    g.fillStyle = '#9c9081'; g.fillRect(x - 2, y - 3, w + 4, 3);
    g.fillStyle = '#857a6d'; g.fillRect(x - 1, y + h, w + 2, 2);
    const lit = Math.random() < 0.45;
    const wc = lit ? warm[Math.floor(Math.random() * warm.length)] : '#141012';
    g.fillStyle = wc; g.fillRect(x, y, w, h);
    g.fillStyle = '#241a17'; g.fillRect(x + w / 2 - 0.5, y, 1, h); g.fillRect(x, y + h / 2, w, 1);
    if (lit) {
      ge.globalAlpha = 0.6 + Math.random() * 0.4; ge.fillStyle = wc; ge.fillRect(x, y, w, h); ge.globalAlpha = 1;
      ge.fillStyle = '#000'; ge.fillRect(x + w / 2 - 0.5, y, 1, h); ge.fillRect(x, y + h / 2, w, 1);
      if (Math.random() < 0.35) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, y, w, h * 0.45); ge.fillStyle = 'rgba(0,0,0,.6)'; ge.fillRect(x, y, w, h * 0.45); }
    }
  }
  // dark roof patches in both bottom-left and top-left corners (roofs sample uv 0.004)
  for (const yy of [0, 508]) { g.fillStyle = '#2c2a2e'; g.fillRect(0, yy, 4, 4); ge.fillStyle = '#000'; ge.fillRect(0, yy, 4, 4); }
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return [mk(c), mk(e)];
}

export function groundTexture() {
  const S = 1024, c = canvas(S, S), g = c.getContext('2d');
  const { CELL, ROAD, SIDEWALK } = CITY, px = S / CELL;
  const m = v => v * px;
  // block interior
  g.fillStyle = '#0e0f17'; g.fillRect(0, 0, S, S);
  // sidewalks
  g.fillStyle = '#23243a';
  g.fillRect(m(ROAD), m(ROAD), m(CELL - ROAD), m(CELL - ROAD));
  g.fillStyle = '#141523';
  g.fillRect(m(ROAD + SIDEWALK), m(ROAD + SIDEWALK), m(CELL - ROAD - 2 * SIDEWALK), m(CELL - ROAD - 2 * SIDEWALK));
  // sidewalk tiles
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
  for (let v = ROAD; v < CELL; v += 2) {
    g.beginPath(); g.moveTo(m(v), m(ROAD)); g.lineTo(m(v), m(ROAD + SIDEWALK)); g.stroke();
    g.beginPath(); g.moveTo(m(v), m(CELL - SIDEWALK)); g.lineTo(m(v), m(CELL)); g.stroke();
    g.beginPath(); g.moveTo(m(ROAD), m(v)); g.lineTo(m(ROAD + SIDEWALK), m(v)); g.stroke();
    g.beginPath(); g.moveTo(m(CELL - SIDEWALK), m(v)); g.lineTo(m(CELL), m(v)); g.stroke();
  }
  // curb glow
  g.fillStyle = '#5a2bff';
  g.fillRect(m(ROAD), m(ROAD), m(CELL - ROAD), 3);
  g.fillRect(m(ROAD), m(ROAD), 3, m(CELL - ROAD));
  g.fillRect(m(ROAD), S - 3, m(CELL - ROAD), 3);
  g.fillRect(S - 3, m(ROAD), 3, m(CELL - ROAD));
  // asphalt roads (x in [0,ROAD] runs along z, z in [0,ROAD] runs along x)
  g.fillStyle = '#16161f';
  g.fillRect(0, 0, m(ROAD), S); g.fillRect(0, 0, S, m(ROAD));
  // asphalt noise / wet patches
  for (let i = 0; i < 900; i++) {
    const a = Math.random() < 0.5;
    const x = a ? rnd(0, m(ROAD)) : rnd(0, S), y = a ? rnd(0, S) : rnd(0, m(ROAD));
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,80,255' : '0,0,0'},${rnd(0.03, 0.08)})`;
    g.beginPath(); g.ellipse(x, y, rnd(4, 26), rnd(2, 10), Math.random() * 3, 0, 7); g.fill();
  }
  // center dashed lines (glowing cyan)
  g.fillStyle = '#25e8ff';
  for (let v = ROAD + 2; v < CELL - 2; v += 6) {
    g.fillRect(m(ROAD / 2) - 2, m(v), 4, m(3));
    g.fillRect(m(v), m(ROAD / 2) - 2, m(3), 4);
  }
  // lane edge lines (magenta)
  g.fillStyle = '#ff2bd6';
  g.fillRect(m(0.8), m(ROAD), 3, m(CELL - ROAD)); g.fillRect(m(ROAD - 0.8) - 3, m(ROAD), 3, m(CELL - ROAD));
  g.fillRect(m(ROAD), m(0.8), m(CELL - ROAD), 3); g.fillRect(m(ROAD), m(ROAD - 0.8) - 3, m(CELL - ROAD), 3);
  // crosswalks
  g.fillStyle = 'rgba(220,230,255,.55)';
  for (let k = 1; k < ROAD - 1; k += 1.6) {
    g.fillRect(m(k), m(ROAD + 0.6), m(0.8), m(2.6));
    g.fillRect(m(k), m(CELL - 3.2), m(0.8), m(2.6));
    g.fillRect(m(ROAD + 0.6), m(k), m(2.6), m(0.8));
    g.fillRect(m(CELL - 3.2), m(k), m(2.6), m(0.8));
  }
  // intersection glow ring
  g.strokeStyle = 'rgba(41,243,255,.35)'; g.lineWidth = 3;
  g.beginPath(); g.arc(m(ROAD / 2), m(ROAD / 2), m(5), 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const signCache = new Map();
// A neon sign: text with glow on dark panel.
export function signTexture(text, color, opts = {}) {
  const key = text + color + JSON.stringify(opts);
  if (signCache.has(key)) return signCache.get(key);
  const vertical = opts.vertical;
  const w = vertical ? 128 : 512, h = vertical ? 512 : 128;
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = opts.bg || 'rgba(5,4,14,0.92)';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = color; g.lineWidth = 6; g.shadowColor = color; g.shadowBlur = 16;
  g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = opts.font || '900 {s}px Orbitron, "Arial Black", sans-serif';
  if (vertical) {
    const chars = text.split('');
    const s = Math.min(78, (h - 40) / chars.length);
    g.font = font.replace('{s}', s);
    chars.forEach((ch, i) => {
      const y = 20 + s * (i + 0.5) + ((h - 40) - s * chars.length) / 2;
      g.shadowBlur = 24; g.fillStyle = color; g.fillText(ch, w / 2, y);
      g.shadowBlur = 4; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(ch, w / 2, y); g.globalAlpha = 1;
    });
  } else {
    let s = 78; g.font = font.replace('{s}', s);
    while (g.measureText(text).width > w - 50 && s > 20) { s -= 4; g.font = font.replace('{s}', s); }
    g.shadowBlur = 28; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4);
    g.shadowBlur = 6; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(text, w / 2, h / 2 + 4); g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  signCache.set(key, t);
  return t;
}

// Animated holographic billboard (redrawn on a timer).
export class Billboard {
  constructor(kind) {
    this.kind = kind;
    this.c = canvas(512, 256); this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.t = Math.random() * 10;
    this.draw();
  }
  draw() {
    const g = this.g, t = this.t, W = 512, H = 256;
    const hue = (t * 40) % 360;
    const grd = g.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, `hsl(${hue},90%,18%)`); grd.addColorStop(1, `hsl(${(hue + 80) % 360},90%,10%)`);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const k = this.kind;
    if (k === 0) { // NYC 3000
      for (let i = 0; i < 12; i++) { g.strokeStyle = `hsla(${(hue + i * 20) % 360},100%,60%,.35)`; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2, 20 + ((t * 60 + i * 30) % 260), 0, 7); g.stroke(); }
      g.font = '900 92px Orbitron, Arial Black'; g.shadowColor = '#29f3ff'; g.shadowBlur = 30; g.fillStyle = '#fff'; g.fillText('NYC 3000', W / 2, H / 2 - 10);
      g.font = '700 26px Orbitron, Arial'; g.shadowBlur = 10; g.fillStyle = '#ff2bd6'; g.fillText('THE CITY NEVER SLEEPS', W / 2, H / 2 + 60);
    } else if (k === 1) { // TIMES SQUARE
      g.font = '900 70px Orbitron, Arial Black'; g.shadowColor = '#ff2bd6'; g.shadowBlur = 30; g.fillStyle = '#fff';
      g.fillText('TIMES', W / 2, H / 2 - 40); g.fillText('SQUARE', W / 2, H / 2 + 40);
      const x = (t * 200) % (W + 200) - 100; g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 0, 60, H);
    } else if (k === 2) { // drink ad
      g.shadowBlur = 0; g.fillStyle = `hsl(${(hue + 180) % 360},100%,55%)`;
      g.beginPath(); g.arc(120, H / 2 + Math.sin(t * 2) * 10, 70, 0, 7); g.fill();
      g.font = '900 60px Orbitron, Arial Black'; g.shadowColor = '#ffa43a'; g.shadowBlur = 20; g.fillStyle = '#fff'; g.fillText('VOLT', 350, H / 2 - 30);
      g.font = '700 28px Rajdhani, Arial'; g.fillStyle = '#ffe0a0'; g.fillText('ENERGY FOR CYBORGS', 350, H / 2 + 30);
    } else if (k === 3) { // skylane
      g.font = '900 64px Orbitron, Arial Black'; g.shadowColor = '#29f3ff'; g.shadowBlur = 24; g.fillStyle = '#e0ffff'; g.fillText('SKYLANE A5', W / 2, H / 2 - 20);
      g.font = '700 26px Orbitron, Arial'; g.fillStyle = '#ffa43a'; g.fillText('▲ ALT 120M  ·  MAX 400 KM/H', W / 2, H / 2 + 50);
    } else { // liberty corp
      g.font = '900 54px Orbitron, Arial Black'; g.shadowColor = '#ff1e3c'; g.shadowBlur = 24; g.fillStyle = '#fff'; g.fillText('LIBERTY CORP', W / 2, H / 2 - 24);
      g.font = '700 26px Rajdhani, Arial'; g.fillStyle = '#ff9aa6'; g.fillText('WE OWN THE SKY. WE OWN YOU.', W / 2, H / 2 + 36);
    }
    // scanlines
    g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,.18)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
    this.tex.needsUpdate = true;
  }
  update(dt) { this.t += dt; this.draw(); }
}

export function glowTexture() {
  const c = canvas(64, 64), g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function skyTexture(top, mid, bottom) {
  const c = canvas(4, 256), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top); grd.addColorStop(0.55, mid); grd.addColorStop(1, bottom);
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
