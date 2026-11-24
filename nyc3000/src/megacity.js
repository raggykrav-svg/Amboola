// Night-City-style structures for the procedural city: megabuildings that fill whole blocks,
// very tall corporate towers downtown, jumbled stacked towers that overhang the sidewalk,
// night-market blocks with food stalls, and cables with lanterns strung across the streets.
// Everything is merged into the city chunks (no extra draw calls except two facade materials).
import * as THREE from 'three';
import { CITY } from './textures.js';

const { CELL, ROAD, N, HALF } = CITY;
const roadC = i => -HALF + i * CELL;
export const MAT_MEGA = 4, MAT_CORP = 5;
const NEON = ['#29f3ff', '#ff2bd6', '#8a4dff', '#ffa43a', '#ff1e3c', '#3aff9a', '#ffd23a'];
const pick = (r, a) => a[Math.floor(r() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const key = (i, j) => i * 16 + j;

// ---------- zoning ----------
export const CORPS = [
  { name: 'LIBERTY CORP', color: '#ff1e3c', style: 'needle', h: 400 },
  { name: 'HELIX DYNAMICS', color: '#29f3ff', style: 'twin', h: 352 },
  { name: 'AURELION', color: '#ffd27a', style: 'blade', h: 330 },
  { name: 'KAIROS SYSTEMS', color: '#3aff9a', style: 'cantilever', h: 364 },
];
const CORP_SITES = new Map([[key(3, 3), 0], [key(6, 3), 1], [key(3, 6), 2], [key(6, 6), 3]]);
const MEGA_SITES = new Map([[key(1, 1), 'twin'], [key(7, 1), 'quad'], [key(2, 7), 'u'], [key(8, 7), 'zig'], [key(0, 4), 'twin'], [key(9, 5), 'u'], [key(4, 8), 'quad']]);
const MARKET = new Set([key(2, 4), key(2, 5), key(1, 5), key(7, 5), key(8, 4), key(4, 1), key(5, 2), key(5, 8), key(6, 8)]);
export function zoneOf(bi, bj) {
  const k = key(bi, bj);
  if (CORP_SITES.has(k)) return 'corp';
  if (MEGA_SITES.has(k)) return 'mega';
  if (MARKET.has(k)) return 'market';
  return 'city';
}

// ---------- little helpers (P = a Parts list) ----------
// neon line around a rectangle at height y
export function ring(P, x, z, w, d, y, color, t = 0.25) {
  P.box(w + t, t, t, color, x, y, z - d / 2); P.box(w + t, t, t, color, x, y, z + d / 2);
  P.box(t, t, d + t, color, x - w / 2, y, z); P.box(t, t, d + t, color, x + w / 2, y, z);
}
// vertical neon lines at the four corners
function corners(P, x, z, w, d, y0, y1, color, t = 0.3) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.box(t, y1 - y0, t, color, x + sx * (w / 2 + 0.05), (y0 + y1) / 2, z + sz * (d / 2 + 0.05));
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1);
const X = new THREE.Vector3(1, 0, 0);
const beamGeo = new THREE.BoxGeometry(1, 1, 1);
// a thin box from point a to point b (cables, sloped lines)
export function beam(P, ax, ay, az, bx, by, bz, w, h, color) {
  _a.set(ax, ay, az); _b.set(bx, by, bz); _d.subVectors(_b, _a);
  const len = _d.length(); if (len < 1e-3) return;
  _q.setFromUnitVectors(X, _d.divideScalar(len));
  _m.compose(_a.add(_b).multiplyScalar(0.5), _q, _s.set(len, h, w));
  P.addColored(beamGeo, _m, color);
}
// AC unit stuck on a facade with outward normal (fx, fz)
function acUnit(D, x, y, z, fx, fz) {
  if (fx) D.box(0.8, 0.9, 1.4, '#7c808c', x + fx * 0.4, y, z); else D.box(1.4, 0.9, 0.8, '#7c808c', x, y, z + fz * 0.4);
}
const FACES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const rotFor = (fx, fz) => Math.atan2(fx, fz);

// ---------- MEGABUILDINGS ----------
// o: { bi, bj, cx, cz, S, bx0, bz0, BS }. A podium with shops and flats fills the block; on top
// stand slab towers joined by skybridges, with neon decks, AC units, ad screens and a name.
let megaCount = 0;
export function megablock(c, ch, r, o) {
  const variant = MEGA_SITES.get(key(o.bi, o.bj)) || 'twin';
  const { cx, cz, S } = o;
  const T = ch.trims, D = ch.details;
  const tc = pick(r, NEON), tc2 = pick(r, NEON);
  const tint = new THREE.Color().setHSL(0.58 + r() * 0.12, 0.08, 0.8 + r() * 0.18);
  const num = String(++megaCount).padStart(2, '0');
  const zig = variant === 'zig';
  const podH = zig ? 24 : 16 + Math.floor(r() * 3) * 4;
  const box = (w, h, d, x, y0, z, m = MAT_MEGA) => {
    ch.bodies[m].push(c._uvBox(w, h, d, x, y0 + h / 2, z, tint));
    c.addBox({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0, y1: y0 + h });
  };
  box(S, podH, S, cx, 0, cz);
  ring(T, cx, cz, S + 0.3, S + 0.3, podH + 0.2, tc, 0.35);
  // podium roof clutter
  for (let k = 0; k < 6; k++) acUnit(D, cx + (r() - 0.5) * (S - 8), podH + 0.45, cz + (r() - 0.5) * (S - 8), 0, 0);

  const rot = r() < 0.5; // swap the layout's axes
  const P = (u, v) => (rot ? [cx + v, cz + u] : [cx + u, cz + v]);
  const dims = (lu, lv) => (rot ? [lv, lu] : [lu, lv]);
  const towers = [], bridges = [];
  const H = () => 120 + Math.floor(r() * 22) * 4;
  if (variant === 'twin') {
    const h1 = H(), h2 = clamp(h1 + Math.round((r() - 0.5) * 60 / 4) * 4, 108, 216);
    towers.push({ u: 0, v: -19.5, lu: S, lv: 15, h: h1 }, { u: 0, v: 19.5, lu: S, lv: 15, h: h2 });
    const nb = 3 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < nb; k++) bridges.push({ u: -18 + r() * 36, v: 0, lu: 7, lv: 24, y: podH + 14 + k * ((Math.min(h1, h2) - podH - 30) / nb) + r() * 6 });
    c.holoSpots.push({ x: cx, y: podH, z: cz, kind: 'court', size: 22 });
  } else if (variant === 'quad') {
    for (const [su, sv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) towers.push({ u: su * 17, v: sv * 17, lu: 20, lv: 20, h: 96 + Math.floor(r() * 24) * 4 });
    const lowest = Math.min(...towers.map(t => t.h));
    for (let k = 0; k < 4; k++) {
      const y = podH + 12 + r() * (lowest - podH - 30);
      if (k % 2) bridges.push({ u: 0, v: (r() < 0.5 ? -17 : 17), lu: 14, lv: 7, y });
      else bridges.push({ u: (r() < 0.5 ? -17 : 17), v: 0, lu: 7, lv: 14, y });
    }
    c.holoSpots.push({ x: cx, y: podH, z: cz, kind: 'court', size: 14 });
  } else if (variant === 'u') {
    const hs = H();
    towers.push({ u: -19.5, v: 0, lu: 15, lv: S, h: hs }, { u: 19.5, v: 0, lu: 15, lv: S, h: clamp(hs + 24 - Math.floor(r() * 12) * 4, 108, 216) },
      { u: 0, v: -19.5, lu: 24, lv: 15, h: clamp(hs - 20 + Math.floor(r() * 10) * 4, 100, 200) });
    for (let k = 0; k < 2; k++) bridges.push({ u: 0, v: 8 + r() * 14, lu: 24, lv: 6, y: podH + 20 + k * 34 + r() * 8 });
    c.holoSpots.push({ x: P(0, 8)[0], y: podH, z: P(0, 8)[1], kind: 'court', size: 18 });
  } else { // ziggurat: stepped terraces and a tower on top
    let y = podH;
    for (const w of [46, 38, 30]) {
      const h = 24 + Math.floor(r() * 2) * 4;
      box(w, h, w, cx, y, cz);
      ring(T, cx, cz, w + 0.3, w + 0.3, y + h + 0.2, k3(w), 0.35);
      // planters along the terrace edge (glowing green beds)
      for (const [fx, fz] of FACES) T.box(fx ? 0.8 : w - 4, 0.5, fx ? w - 4 : 0.8, '#1f8a4a', cx + fx * (w / 2 + 2.2), y + 0.25, cz + fz * (w / 2 + 2.2));
      y += h;
    }
    towers.push({ u: 0, v: 0, lu: 18, lv: 18, h: y + 72 + Math.floor(r() * 10) * 4, y0: y });
    c.holoSpots.push({ x: cx + 11, y, z: cz + 11, kind: 'terrace', size: 6 });
  }
  function k3(w) { return w === 46 ? tc : w === 38 ? tc2 : tc; }

  let top = podH;
  for (const t of towers) {
    const [x, z] = P(t.u, t.v), [w, d] = dims(t.lu, t.lv), y0 = t.y0 ?? podH;
    box(w, t.h - y0, d, x, y0, z);
    top = Math.max(top, t.h);
    // neon decks every few floors, corner strips, roof parapet glow
    if (r() < 0.75) for (let y = y0 + 20 + Math.floor(r() * 3) * 4; y < t.h - 8; y += 24 + Math.floor(r() * 3) * 8) ring(T, x, z, w + 0.3, d + 0.3, y, r() < 0.7 ? tc : tc2, 0.22);
    if (r() < 0.5) corners(T, x, z, w, d, y0 + 2, t.h, tc2, 0.28);
    ring(T, x, z, w + 0.3, d + 0.3, t.h + 0.15, tc, 0.3);
    // service cores and AC units on the facades
    for (const [fx, fz] of FACES) {
      const span = fx ? d : w;
      if (span > 18 && r() < 0.5) {
        const off = (r() - 0.5) * (span - 8);
        if (fx) D.box(2.4, t.h - y0 - 4, 4, x + fx * (w / 2 + 1.2), y0 + (t.h - y0 - 4) / 2, z + off, 0, 0, 0);
        else D.box(4, t.h - y0 - 4, 2.4, x + off, y0 + (t.h - y0 - 4) / 2, z + fz * (d / 2 + 1.2));
      }
      for (let k = 0; k < 5; k++) {
        const off = (r() - 0.5) * (span - 3), y = y0 + 4 + r() * (t.h - y0 - 10);
        acUnit(D, x + (fx ? fx * w / 2 : off), y, z + (fz ? fz * d / 2 : off), fx, fz);
      }
    }
    // rooftop: mast with a red beacon, water tanks
    const mh = 8 + r() * 14;
    D.box(0.5, mh, 0.5, '#30364a', x + (r() - 0.5) * (w - 4), t.h + mh / 2, z + (r() - 0.5) * (d - 4));
    T.box(0.9, 0.9, 0.9, '#ff1030', x, t.h + 1.5 + r() * 2, z);
    D.cyl(1.6, 1.6, 3.2, 10, '#4a4e5a', x + (r() < 0.5 ? -1 : 1) * Math.max(0, w / 2 - 3), t.h + 1.6, z + (r() < 0.5 ? -1 : 1) * Math.max(0, d / 2 - 3));
  }
  // skybridges between the towers
  for (const b of bridges) {
    const [x, z] = P(b.u, b.v), [w, d] = dims(b.lu, b.lv);
    D.box(w, 4.4, d, '#141a2c', x, b.y + 2.2, z);
    const along = w > d;
    for (const s of [-1, 1]) T.box(along ? w : 0.12, 0.9, along ? 0.12 : d, '#9fe9ff', x + (along ? 0 : s * (w / 2 + 0.02)), b.y + 2.4, z + (along ? s * (d / 2 + 0.02) : 0));
    T.box(along ? w : 0.2, 0.2, along ? 0.2 : d, tc, x, b.y + 4.5, z);
    c.addBox({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: b.y, y1: b.y + 4.4 });
  }
  // ad screens and the building's name on the outer faces
  let ads = 0;
  for (const t of [...towers].sort(() => r() - 0.5)) {
    if (ads >= 2) break;
    const [x, z] = P(t.u, t.v), [w, d] = dims(t.lu, t.lv), y0 = t.y0 ?? podH;
    for (const [fx, fz] of FACES) {
      // only faces that look out of the block
      const fxPos = x + fx * w / 2, fzPos = z + fz * d / 2;
      if (fx && Math.abs(fxPos - cx) < S / 2 - 1) continue;
      if (fz && Math.abs(fzPos - cz) < S / 2 - 1) continue;
      const span = fx ? d : w; if (span < 16) continue;
      const aw = Math.min(span - 4, 18 + Math.floor(r() * 3) * 2), ah = aw / 2;
      const y = y0 + 16 + r() * Math.max(0, t.h - y0 - 40);
      c.ad(ch, fxPos + fx * 0.6, y, fzPos + fz * 0.6, rotFor(fx, fz), aw, ah);
      if (++ads >= 2) break;
    }
  }
  {
    const t = towers.reduce((a, b) => (b.h > a.h ? b : a)), [x, z] = P(t.u, t.v), [w, d] = dims(t.lu, t.lv);
    const [fx, fz] = w >= d ? [0, cz < 0 ? -1 : 1] : [cx < 0 ? -1 : 1, 0];
    c._sign('MEGABLOCK ' + num, tc, x + fx * (w / 2 + 0.4), t.h - 6, z + fz * (d / 2 + 0.4), rotFor(fx, fz), 14, 3.5);
  }
  const lot = { bi: o.bi, bj: o.bj, bx: cx, bz: cz, lw: S, ld: S, h: podH, ts: false, faces: FACES.map(f => [...f]), bx0: o.bx0, bz0: o.bz0, BS: o.BS };
  c._storefronts(ch, r, lot, 'box');
  c._lotSigns(cx, cz, S, S, podH, o.bx0, o.bz0, o.BS, r);
  c.lots.push({ ...lot, style: 'mega', topH: top });
  c.megas.push({ x: cx, z: cz, top, name: 'MEGABLOCK ' + num });
}

// ---------- CORPORATE TOWERS ----------
export function corpTower(c, ch, r, o) {
  const C = CORPS[CORP_SITES.get(key(o.bi, o.bj)) || 0];
  const { cx, cz, S } = o;
  const T = ch.trims, D = ch.details;
  const tint = new THREE.Color().setHSL(0.6, 0.12, 0.86 + r() * 0.12);
  const H = C.h, col = C.color, podH = 12;
  const box = (w, h, d, x, y0, z, m = MAT_CORP) => {
    ch.bodies[m].push(c._uvBox(w, h, d, x, y0 + h / 2, z, tint));
    c.addBox({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0, y1: y0 + h });
  };
  const section = (w, d, x, z, y0, y1, edges = true) => {
    box(w, y1 - y0, d, x, y0, z);
    ring(T, x, z, w + 0.3, d + 0.3, y1 + 0.15, col, 0.35);
    if (edges) corners(T, x, z, w, d, y0 + 1, y1, col, 0.3);
  };
  const logos = (w, d, x, z, y, lw = 20, lh = 5) => {
    for (const [fx, fz] of FACES) c._sign(C.name, col, x + fx * (w / 2 + 0.35), y, z + fz * (d / 2 + 0.35), rotFor(fx, fz), Math.min(lw, (fx ? d : w) - 2), lh);
  };
  const beacon = (x, y, z) => T.sphere(0.9, '#ff1030', x, y, z);
  section(S, S, cx, cz, 0, podH, false); // lobby podium with the shops
  if (C.style === 'needle') {
    const secs = [[34, podH, H * 0.45], [28, H * 0.45, H * 0.72], [22, H * 0.72, H * 0.9], [15, H * 0.9, H]];
    for (const [w, y0, y1] of secs) section(w, w, cx, cz, y0, y1);
    D.add(new THREE.ConeGeometry(3.2, 46, 8), '#3a4152', cx, H + 23, cz);
    beacon(cx, H + 46, cz);
    T.add(new THREE.TorusGeometry(24, 0.7, 6, 48), col, cx, H * 0.8, cz, Math.PI / 2);
    T.add(new THREE.TorusGeometry(19, 0.45, 6, 48), col, cx, H * 0.8 + 6, cz, Math.PI / 2);
    logos(22, 22, cx, cz, H * 0.86, 20, 5);
    c.holoSpots.push({ x: cx, y: H * 0.68, z: cz, kind: 'orbit', r: 70, tower: C.name });
  } else if (C.style === 'twin') {
    const sep = 14;
    const along = r() < 0.5;
    const pos = s => (along ? [cx + s * sep, cz] : [cx, cz + s * sep]);
    [[H, -1], [H * 0.86, 1]].forEach(([h, s]) => {
      const [x, z] = pos(s);
      section(20, 20, x, z, podH, h * 0.88);
      section(15, 15, x, z, h * 0.88, h);
      D.add(new THREE.ConeGeometry(2.4, 26, 8), '#3a4152', x, h + 13, z);
      beacon(x, h + 26, z);
      logos(15, 15, x, z, h * 0.94, 13, 3.4);
    });
    for (const f of [0.32, 0.54, 0.72]) {
      const y = H * 0.86 * f;
      if (along) { D.box(8.2, 6, 10, '#121a2e', cx, y + 3, cz); T.box(8.2, 0.25, 10.2, col, cx, y + 6.1, cz); c.addBox({ x0: cx - 4.1, x1: cx + 4.1, z0: cz - 5, z1: cz + 5, y0: y, y1: y + 6 }); }
      else { D.box(10, 6, 8.2, '#121a2e', cx, y + 3, cz); T.box(10.2, 0.25, 8.2, col, cx, y + 6.1, cz); c.addBox({ x0: cx - 5, x1: cx + 5, z0: cz - 4.1, z1: cz + 4.1, y0: y, y1: y + 6 }); }
      for (const s of [-1, 1]) T.box(along ? 8.2 : 0.1, 1.2, along ? 0.1 : 8.2, '#9fe9ff', cx + (along ? 0 : s * 5.05), y + 3, cz + (along ? s * 5.05 : 0));
    }
    c.holoSpots.push({ x: cx, y: H * 0.68, z: cz, kind: 'orbit', r: 60, tower: C.name });
  } else if (C.style === 'blade') {
    const along = r() < 0.5, L = 44, Dp = 16;
    const wd = (l, dd) => (along ? [l, dd] : [dd, l]);
    const steps = [[L, podH, H * 0.8], [L - 10, H * 0.8, H * 0.9], [L - 20, H * 0.9, H]];
    for (const [l, y0, y1] of steps) { const [w, d] = wd(l, Dp); section(w, d, cx, cz, y0, y1, false); }
    // a glowing line down the middle of both broad faces, and the name standing upright
    for (const s of [-1, 1]) {
      const [w, d] = wd(L, Dp);
      if (along) T.box(0.6, H * 0.8 - podH, 0.2, col, cx, (H * 0.8 + podH) / 2, cz + s * (d / 2 + 0.12));
      else T.box(0.2, H * 0.8 - podH, 0.6, col, cx + s * (w / 2 + 0.12), (H * 0.8 + podH) / 2, cz);
      const fx = along ? 0 : s, fz = along ? s : 0;
      c._sign(C.name, col, cx + fx * (w / 2 + 0.4) + (along ? 12 : 0), H * 0.62, cz + fz * (d / 2 + 0.4) + (along ? 0 : 12), rotFor(fx, fz), 5, 36, false, true);
    }
    corners(T, cx, cz, ...wd(L, Dp), podH, H * 0.8, col, 0.3);
    D.box(0.6, 30, 0.6, '#30364a', cx, H + 15, cz); beacon(cx, H + 30, cz);
    c.holoSpots.push({ x: cx, y: H * 0.68, z: cz, kind: 'orbit', r: 62, tower: C.name });
  } else { // cantilever: a slim shaft and a much wider head with a glowing underside
    const y1 = H * 0.68, y2 = H * 0.86;
    section(26, 26, cx, cz, podH, y1);
    section(42, 42, cx, cz, y1, y2);
    section(30, 30, cx, cz, y2, H);
    // the underside of the head: dark panels with lines of light
    D.box(41.6, 0.3, 41.6, '#151a26', cx, y1 - 0.15, cz);
    for (let k = -2; k <= 2; k++) { T.box(40, 0.08, 0.35, col, cx, y1 - 0.34, cz + k * 8); T.box(0.35, 0.08, 40, col, cx + k * 8, y1 - 0.34, cz); }
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; D.box(1.2, 10, 1.2, '#2a3040', cx + Math.cos(a) * 12, H + 5, cz + Math.sin(a) * 12); beacon(cx + Math.cos(a) * 12, H + 10.6, cz + Math.sin(a) * 12); }
    logos(42, 42, cx, cz, (y1 + y2) / 2, 30, 7.5);
    c.holoSpots.push({ x: cx, y: H * 0.68, z: cz, kind: 'orbit', r: 76, tower: C.name });
  }
  const lot = { bi: o.bi, bj: o.bj, bx: cx, bz: cz, lw: S, ld: S, h: podH, ts: false, faces: FACES.map(f => [...f]), bx0: o.bx0, bz0: o.bz0, BS: o.BS };
  c._storefronts(ch, r, lot, 'box');
  c.lots.push({ ...lot, style: 'corp', topH: H });
  c.corps.push({ x: cx, z: cz, h: H, name: C.name, color: col });
  // a big screen on the podium roof edge facing the widest street
  const [fx, fz] = Math.abs(cx) > Math.abs(cz) ? [cx < 0 ? 1 : -1, 0] : [0, cz < 0 ? 1 : -1];
  c.ad(ch, cx + fx * (S / 2 - 1), podH + 7, cz + fz * (S / 2 - 1), rotFor(fx, fz), 16, 8, { stand: true });
}

// ---------- STACKED TOWERS ----------
// boxes piled on top of each other, each one shifted and resized, overhanging the sidewalk
export function stackTower(c, ch, r, o) {
  const { bx, bz, lw, ld, h, faces } = o;
  const T = ch.trims, D = ch.details;
  const tint = new THREE.Color().setHSL(0.6 + r() * 0.3, 0.15, 0.6 + r() * 0.3);
  const tc = pick(r, NEON);
  const has = (fx, fz) => faces.some(f => f[0] === fx && f[1] === fz);
  // how far each side may reach: over the sidewalk on street sides, the lot edge elsewhere
  const lim = {
    x0: has(-1, 0) ? o.bx0 + 1.5 : bx - lw / 2, x1: has(1, 0) ? o.bx0 + o.BS - 1.5 : bx + lw / 2,
    z0: has(0, -1) ? o.bz0 + 1.5 : bz - ld / 2, z1: has(0, 1) ? o.bz0 + o.BS - 1.5 : bz + ld / 2,
  };
  let y = 0, k = 0, prev = null;
  while (y < h - 6 && k < 8) {
    let w, d, x, z, sh;
    if (k === 0) { w = lw; d = ld; x = bx; z = bz; sh = 12 + Math.floor(r() * 3) * 4; }
    else {
      sh = 14 + Math.floor(r() * 5) * 4;
      w = clamp(lw * (0.55 + r() * 0.65), 10, lim.x1 - lim.x0); d = clamp(ld * (0.55 + r() * 0.65), 10, lim.z1 - lim.z0);
      x = clamp(bx + (r() - 0.5) * (lw + 8 - w), lim.x0 + w / 2, lim.x1 - w / 2);
      z = clamp(bz + (r() - 0.5) * (ld + 8 - d), lim.z0 + d / 2, lim.z1 - d / 2);
    }
    if (y + sh > h) sh = Math.max(8, Math.round((h - y) / 4) * 4);
    const m = k === 0 ? Math.floor(r() * 3) : pick(r, [0, 1, 2, MAT_MEGA, MAT_MEGA]);
    ch.bodies[m].push(c._uvBox(w, sh, d, x, y + sh / 2, z, tint));
    c.addBox({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: y, y1: y + sh });
    if (prev && (x - w / 2 < prev.x - prev.w / 2 - 0.5 || x + w / 2 > prev.x + prev.w / 2 + 0.5 || z - d / 2 < prev.z - prev.d / 2 - 0.5 || z + d / 2 > prev.z + prev.d / 2 + 0.5)) {
      // where it overhangs: a neon rim under the edge and a row of little downlights
      const nc = pick(r, NEON);
      ring(T, x, z, w - 0.2, d - 0.2, y - 0.1, nc, 0.18);
      for (let q = 0; q < 6; q++) T.box(0.5, 0.06, 0.5, '#fff2d0', x + (r() - 0.5) * (w - 2), y - 0.05, z + (r() - 0.5) * (d - 2));
    }
    if (r() < 0.65) ring(T, x, z, w + 0.3, d + 0.3, y + sh + 0.15, r() < 0.6 ? tc : pick(r, NEON), 0.25);
    if (k > 0 && r() < 0.5) for (let q = 0; q < 3; q++) { const [fx, fz] = pick(r, FACES); acUnit(D, x + (fx ? fx * w / 2 : (r() - 0.5) * (w - 2)), y + 2 + r() * (sh - 4), z + (fz ? fz * d / 2 : (r() - 0.5) * (d - 2)), fx, fz); }
    prev = { w, d, x, z }; y += sh; k++;
  }
  // roof: a mast with a beacon
  const mh = 6 + r() * 16;
  D.box(0.45, mh, 0.45, '#30364a', prev.x, y + mh / 2, prev.z);
  T.box(0.8, 0.8, 0.8, '#ff1030', prev.x, y + mh, prev.z);
  c._storefronts(ch, r, o, 'box');
  c._lotSigns(bx, bz, lw, ld, Math.min(h, 40), o.bx0, o.bz0, o.BS, r);
  c.lots.push({ ...o, style: 'stack', topH: y });
}

// ---------- NIGHT MARKETS ----------
// a block split into 6 small lots (each one still reaches a street)
export function marketLots(r, S) {
  const G = 2.5, xs = [0], zs = [0];
  const a = S * (0.28 + r() * 0.1), b = S * (0.62 + r() * 0.1);
  xs.push(a, b); const zc = S * (0.42 + r() * 0.16);
  const lots = [];
  const xb = [0, a, b, S];
  for (let i = 0; i < 3; i++) {
    const lx = xb[i] + (i ? G / 2 : 0), lw = xb[i + 1] - xb[i] - (i ? G / 2 : 0) - (i < 2 ? G / 2 : 0);
    lots.push([lx, 0, lw, zc - G / 2], [lx, zc + G / 2, lw, S - zc - G / 2]);
  }
  void zs;
  return lots;
}
const STALLS = [['RAMEN', '#ff2bd6'], ['NOODLES', '#ffa43a'], ['TACOS', '#3aff9a'], ['SUSHI', '#29f3ff'], ['DUMPLINGS', '#ffd23a'], ['BAO', '#ff1e3c'], ['ROBO PARTS', '#8a4dff'], ['SODA', '#29f3ff']];
// food stalls on the sidewalk and strings of lights
export function marketStreet(c, ch, r, bx0, bz0, BS) {
  const T = ch.trims, D = ch.details;
  const n = 3 + Math.floor(r() * 2);
  let placed = 0;
  for (let k = 0; k < n * 4 && placed < n; k++) {
    const [fx, fz] = pick(r, FACES);
    const t = (r() - 0.5) * (BS - 20);
    // 3.6 m from the block edge: between the walking path and the shop fronts
    const x = fx ? (fx < 0 ? bx0 + 3.6 : bx0 + BS - 3.6) : bx0 + BS / 2 + t;
    const z = fz ? (fz < 0 ? bz0 + 3.6 : bz0 + BS - 3.6) : bz0 + BS / 2 + t;
    if (c.doorNear(x, z, 3.0)) continue; // keep the doors free
    placed++;
    const nx = fx ? -fx : 0, nz = fz ? -fz : 0; // the stall faces the street (away from the wall)
    const ry = fx ? Math.PI / 2 : 0;
    const [label, col] = pick(r, STALLS);
    D.add(new THREE.BoxGeometry(2.6, 1.0, 1.0), '#3a2c26', x, 0.5, z, 0, ry, 0);
    T.add(new THREE.BoxGeometry(2.62, 0.08, 1.02), col, x, 1.02, z, 0, ry, 0);
    for (const s of [-1, 1]) D.add(new THREE.BoxGeometry(0.08, 2.4, 0.08), '#22252e', x + (fx ? 0 : s * 1.2), 1.2, z + (fx ? s * 1.2 : 0));
    D.add(new THREE.BoxGeometry(3.0, 0.12, 1.6), pick(r, ['#b02238', '#2a5aa8', '#228a70', '#b0701a', '#7a3ab0']), x + nx * 0.2, 2.45, z + nz * 0.2, fz ? -fz * 0.18 : 0, ry, fx ? fx * 0.18 : 0);
    for (let q = 0; q < 4; q++) T.add(new THREE.BoxGeometry(0.22, 0.3, 0.22), q % 2 ? '#ffb35a' : '#ff4a4a', x + (fx ? 0 : -1.1 + q * 0.73) + nx * 0.8, 2.15, z + (fx ? -1.1 + q * 0.73 : 0) + nz * 0.8);
    c._sign(label, col, x + nx * 0.52, 1.55, z + nz * 0.52, rotFor(nx, nz), 1.8, 0.45);
    c.stalls.push({ x, z, nx, nz, label });
    c.addBox({ x0: x - (fx ? 0.5 : 1.3), x1: x + (fx ? 0.5 : 1.3), z0: z - (fx ? 1.3 : 0.5), z1: z + (fx ? 1.3 : 0.5), y0: 0, y1: 1.1 });
    c.decals.push([x + nx * 1.5, z + nz * 1.5, 3.5, new THREE.Color(col).multiplyScalar(0.5)]);
  }
}
// a billboard on a little steel frame at the roof edge of a low building
export function roofBillboard(c, ch, r, lot, topH) {
  const { bx, bz, lw, ld, faces } = lot;
  if (!faces.length) return;
  const [fx, fz] = pick(r, faces);
  const span = fx ? ld : lw; if (span < 10) return;
  const w = Math.min(span - 2, 8 + Math.floor(r() * 3) * 2), h = w / 2;
  const x = bx + fx * (lw / 2 - 1.2), z = bz + fz * (ld / 2 - 1.2), y = topH + 1.4 + h / 2;
  const D = ch.details, ax = fz ? 1 : 0, az = fx ? 1 : 0;
  for (const s of [-0.4, 0.4]) D.box(0.25, y - topH + h / 2, 0.25, '#2a2d36', x + ax * s * w - fx * 0.6, topH + (y - topH + h / 2) / 2, z + az * s * w - fz * 0.6);
  D.box(fx ? 0.15 : w, 0.15, fx ? w : 0.15, '#2a2d36', x - fx * 0.6, topH + 1.2, z - fz * 0.6);
  c.ad(ch, x, y, z, rotFor(fx, fz), w, h, { lamps: true });
}

// ---------- CABLES ACROSS THE STREETS ----------
export function streetCables(c, chunkOf, r, skipRoads) {
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    for (const axis of ['z', 'x']) {
      // road `i` running along `axis`, segment between crossings j and j+1
      if (skipRoads.has(axis + i)) continue;
      const nearMarket = [[i - 1, j], [i, j]].some(([a, b]) => (axis === 'z' ? MARKET.has(key(a, b)) : MARKET.has(key(b, a))));
      if (r() > (nearMarket ? 0.85 : 0.28)) continue;
      const rc = roadC(i), a = roadC(j) + ROAD / 2 + 6, b = roadC(j + 1) - ROAD / 2 - 6;
      const n = nearMarket ? 2 + Math.floor(r() * 2) : 1;
      for (let k = 0; k < n; k++) {
        const t = a + r() * (b - a);
        const y1 = 7 + r() * 12, y2 = Math.max(6, y1 + (r() - 0.5) * 6), sag = 1.2 + r() * 2.5;
        const e = ROAD / 2 + 5; // building faces
        const P1 = axis === 'z' ? [rc - e, t] : [t, rc - e], P2 = axis === 'z' ? [rc + e, t] : [t, rc + e];
        if (c.roofAt(P1[0] + (axis === 'z' ? -1 : 0), P1[1] + (axis === 'z' ? 0 : -1)) < y1 + 2) continue;
        if (c.roofAt(P2[0] + (axis === 'z' ? 1 : 0), P2[1] + (axis === 'z' ? 0 : 1)) < y2 + 2) continue;
        const ch = axis === 'z' ? chunkOf(i, j) : chunkOf(j, i);
        const pts = [];
        for (let s = 0; s <= 8; s++) {
          const f = s / 8;
          pts.push([P1[0] + (P2[0] - P1[0]) * f, y1 + (y2 - y1) * f - sag * 4 * f * (1 - f), P1[1] + (P2[1] - P1[1]) * f]);
        }
        for (let s = 0; s < 8; s++) beam(ch.details, ...pts[s], ...pts[s + 1], 0.07, 0.07, '#15161c');
        if (nearMarket || r() < 0.3) {
          const lc = pick(r, [['#ff4a4a', '#ffb35a'], ['#ff2bd6', '#29f3ff'], ['#ffd23a', '#ffd23a']]);
          for (let s = 1; s < 8; s++) { const p = pts[s]; ch.trims.box(0.32, 0.42, 0.32, lc[s % 2], p[0], p[1] - 0.3, p[2]); }
        }
      }
    }
  }
}
