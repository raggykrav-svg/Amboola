// Elevated highways on big concrete pillars: one runs north-south above road 8 and one
// east-west above road 2. Each has ramps at both ends (drive up them!), they meet on a shared
// deck, and they carry their own traffic (instanced: two draw calls for every car on them).
// The decks are solid: drive on them, walk on them or land a flying car on them.
import * as THREE from 'three';
import { CITY } from './textures.js';
import { beam } from './megacity.js';

const { CELL, ROAD, N, HALF } = CITY;
const roadC = i => -HALF + i * CELL;
export const HW_Y = 13;               // deck top
const W = 16, TH = 1.4;               // deck width and thickness
const R0 = HALF - ROAD / 2 - 2;       // |u| where a ramp meets the street (408)
const R1 = HALF - CELL + ROAD / 2;    // |u| where a ramp reaches the deck (346)
export const HIGHWAYS = [
  { axis: 'z', road: 8, c: roadC(8), signs: ['SKYWAY 8 · UPTOWN', 'SKYWAY 8 · DOWNTOWN'], neon: '#ffa43a' },
  { axis: 'x', road: 2, c: roadC(2), signs: ['SKYWAY 2 · EAST SIDE', 'SKYWAY 2 · WEST SIDE'], neon: '#29f3ff' },
];
// the two highways cross here (u along each)
HIGHWAYS[0].cross = HIGHWAYS[1].c; HIGHWAYS[1].cross = HIGHWAYS[0].c;

export function hwHeight(u) {
  const a = Math.abs(u);
  if (a <= R1) return HW_Y;
  if (a >= R0) return 0;
  return HW_Y * (R0 - a) / (R0 - R1);
}
// world position of (u along, s across) on highway H
const wx = (H, u, s) => (H.axis === 'z' ? H.c + s : u);
const wz = (H, u, s) => (H.axis === 'z' ? u : H.c + s);

// road segments under the ramps: ground traffic must not drive into them
export function rampSegments() {
  const out = [];
  for (const H of HIGHWAYS) for (const [a, b] of [[0, 1], [N - 1, N]]) out.push(H.axis === 'z' ? [H.road, a, H.road, b] : [a, H.road, b, H.road]);
  return out;
}

export function buildHighways(city, chunkOf) {
  const chunkAt = (x, z) => chunkOf(Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL));
  // a box on highway H: centre (u, s), sizes along / across / up
  const hbox = (P, H, u, s, y, la, ls, h, color, rx = 0) => {
    if (H.axis === 'z') P.add(new THREE.BoxGeometry(ls, h, la), color, wx(H, u, s), y, wz(H, u, s), rx, 0, 0);
    else P.add(new THREE.BoxGeometry(la, h, ls), color, wx(H, u, s), y, wz(H, u, s), 0, 0, -rx);
  };
  const col = (H, u0, u1, s0, s1, y0, y1, low = false) => {
    const a = Math.min(u0, u1), b = Math.max(u0, u1);
    city.addBox(H.axis === 'z' ? { x0: H.c + s0, x1: H.c + s1, z0: a, z1: b, y0, y1, low } : { x0: a, x1: b, z0: H.c + s0, z1: H.c + s1, y0, y1, low });
  };
  HIGHWAYS.forEach((H, hi) => {
    const other = HIGHWAYS[1 - hi];
    const nearCross = (u, m) => Math.abs(u - H.cross) < W / 2 + m;
    // ---- deck: pieces between block lines so every piece lands in the right chunk ----
    const cuts = [-R1];
    for (let k = 0; k <= N; k++) { const u = roadC(k) + CELL / 2; if (u > -R1 && u < R1) cuts.push(u); }
    cuts.push(R1);
    for (let k = 0; k + 1 < cuts.length; k++) {
      let a = cuts[k], b = cuts[k + 1];
      const pieces = [];
      // the second highway leaves a gap where it meets the first (that deck is shared)
      if (hi === 1 && H.cross > a && H.cross < b) { pieces.push([a, H.cross - W / 2], [H.cross + W / 2, b]); } else pieces.push([a, b]);
      for (const [p0, p1] of pieces) {
        if (p1 - p0 < 0.5) continue;
        const um = (p0 + p1) / 2, L = p1 - p0, ch = chunkAt(wx(H, um, 0), wz(H, um, 0));
        const D = ch.details, T = ch.trims;
        hbox(D, H, um, 0, HW_Y - TH / 2, L, W, TH, '#3c3f4a');
        hbox(T, H, um, 0, HW_Y - TH - 0.03, L, 1.0, 0.06, new THREE.Color(H.neon).multiplyScalar(0.7)); // glow under the deck
        col(H, p0, p1, -W / 2, W / 2, HW_Y - TH, HW_Y);
      }
    }
    // ---- barriers, centre divider, lane lines: cut open where the highways meet ----
    const runs = [];
    if (H.cross > -R1 && H.cross < R1) runs.push([-R1, H.cross - W / 2], [H.cross + W / 2, R1]); else runs.push([-R1, R1]);
    for (const [r0, r1] of runs) {
      const cutsR = [r0];
      for (let k = 0; k <= N; k++) { const u = roadC(k) + CELL / 2; if (u > r0 && u < r1) cutsR.push(u); }
      cutsR.push(r1);
      for (let k = 0; k + 1 < cutsR.length; k++) {
        const a = cutsR[k], b = cutsR[k + 1], um = (a + b) / 2, L = b - a;
        const ch = chunkAt(wx(H, um, 0), wz(H, um, 0)), D = ch.details, T = ch.trims;
        for (const s of [-1, 1]) {
          hbox(D, H, um, s * (W / 2 - 0.2), HW_Y + 0.5, L, 0.4, 1.0, '#4a4d58');
          hbox(T, H, um, s * (W / 2 - 0.2), HW_Y + 1.04, L, 0.42, 0.08, H.neon);
          hbox(T, H, um, s * 3.9, HW_Y + 0.02, L, 0.12, 0.03, '#6a7088');
          col(H, a, b, s > 0 ? W / 2 - 0.45 : -W / 2, s > 0 ? W / 2 : -W / 2 + 0.45, HW_Y, HW_Y + 1.0);
        }
        // the divider stops short of the crossing so you can turn onto the other highway
        const d0 = nearCross(a, 2) ? H.cross + (a < H.cross ? -1 : 1) * (W / 2 + 2) : a, d1 = nearCross(b, 2) ? H.cross + (b < H.cross ? -1 : 1) * (W / 2 + 2) : b;
        if (d1 - d0 > 1) {
          const dm = (d0 + d1) / 2;
          hbox(D, H, dm, 0, HW_Y + 0.4, d1 - d0, 0.5, 0.8, '#5a5d68');
          hbox(T, H, dm, 0, HW_Y + 0.82, d1 - d0, 0.52, 0.06, '#ffd23a');
          col(H, d0, d1, -0.25, 0.25, HW_Y, HW_Y + 0.8);
        }
      }
    }
    // ---- pillars ----
    for (let u = -R1 + 16; u < R1 - 8; u += 28) {
      let skip = false;
      for (let k = 0; k <= N; k++) if (Math.abs(u - roadC(k)) < ROAD / 2 + 4) skip = true;
      if (skip) continue;
      const ch = chunkAt(wx(H, u, 0), wz(H, u, 0)), D = ch.details, T = ch.trims, ph = HW_Y - TH;
      hbox(D, H, u, 0, ph / 2, 2.2, 2.2, ph, '#4a4d58');
      hbox(D, H, u, 0, ph - 0.55, 2.6, W - 2, 1.1, '#43464f');
      hbox(T, H, u, 0, 3.0, 2.32, 2.32, 0.16, H.neon);
      hbox(T, H, u, 0, 3.4, 2.32, 2.32, 0.06, H.neon);
      col(H, u - 1.1, u + 1.1, -1.1, 1.1, 0, ph);
      city.addPole(wx(H, u, 0), wz(H, u, 0));
    }
    // ---- lamps on the deck ----
    for (let u = -R1 + 20; u < R1; u += 42) {
      if (nearCross(u, 4)) continue;
      const ch = chunkAt(wx(H, u, 0), wz(H, u, 0)), D = ch.details, T = ch.trims;
      for (const s of [-1, 1]) {
        hbox(D, H, u, s * (W / 2 - 0.2), HW_Y + 4, 0.2, 0.2, 6, '#2a2d3a');
        hbox(D, H, u, s * (W / 2 - 1.1), HW_Y + 7, 0.15, 1.8, 0.15, '#2a2d3a');
        hbox(T, H, u, s * (W / 2 - 1.9), HW_Y + 6.9, 0.9, 0.5, 0.15, '#fff2d0');
      }
    }
    // ---- sign gantries ----
    [-0.55, 0.15, 0.6].forEach((f, k) => {
      const u = f * R1;
      if (nearCross(u, 10)) return;
      const ch = chunkAt(wx(H, u, 0), wz(H, u, 0)), D = ch.details;
      for (const s of [-1, 1]) { hbox(D, H, u, s * (W / 2 + 0.3), HW_Y + 3.6, 0.4, 0.4, 7.2, '#2a2d3a'); col(H, u - 0.25, u + 0.25, s * (W / 2 + 0.3) - 0.25, s * (W / 2 + 0.3) + 0.25, HW_Y, HW_Y + 7.2); }
      hbox(D, H, u, 0, HW_Y + 7.4, 0.5, W + 1.2, 0.5, '#2a2d3a');
      // one sign for each direction of travel
      for (const dir of [1, -1]) {
        const text = H.signs[dir > 0 ? 0 : 1], s = H.axis === 'z' ? -dir * 3.9 : dir * 3.9;
        const rot = H.axis === 'z' ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        city._sign(text, k === 1 ? '#3aff9a' : '#29f3ff', wx(H, u - dir * 0.3, s), HW_Y + 6.2, wz(H, u - dir * 0.3, s), rot, 7.4, 1.8);
      }
    });
    // ---- screens on the buildings beside the highway, facing the drivers ----
    let shown = 0;
    for (let u = -R1 + 30; u < R1 - 30 && shown < 4; u += 37) {
      if (nearCross(u, 20)) continue;
      const s = (Math.floor(u / 37) % 2 ? 1 : -1) * (ROAD / 2 + 5);
      if (city.roofAt(wx(H, u, s * 1.07), wz(H, u, s * 1.07)) < HW_Y + 16) continue;
      const ch = chunkAt(wx(H, u, s), wz(H, u, s)), sg = Math.sign(s);
      const rot = H.axis === 'z' ? (sg > 0 ? -Math.PI / 2 : Math.PI / 2) : (sg > 0 ? Math.PI : 0);
      city.ad(ch, wx(H, u, s - sg * 0.6), HW_Y + 6.5, wz(H, u, s - sg * 0.6), rot, 12, 6);
      shown++;
    }
    // ---- ramps: a solid wedge from the street up to the deck at both ends ----
    for (const side of [-1, 1]) {
      const ua = side * R1, ub = side * R0, um = (ua + ub) / 2, L = Math.abs(ub - ua);
      const ch = chunkAt(wx(H, um, 0), wz(H, um, 0)), D = ch.details, T = ch.trims;
      D.list.push(wedge(H, ua, ub, -W / 2, W / 2, 0, '#3c3f4a'));
      for (const s of [-1, 1]) {
        D.list.push(wedge(H, ua, ub, s * (W / 2 - 0.4), s * W / 2, 1.0, '#4a4d58'));
        beam(T, wx(H, ua, s * (W / 2 - 0.2)), HW_Y + 1.04, wz(H, ua, s * (W / 2 - 0.2)), wx(H, ub, s * (W / 2 - 0.2)), 1.04, wz(H, ub, s * (W / 2 - 0.2)), 0.42, 0.08, H.neon);
        beam(T, wx(H, ua, s * 3.9), HW_Y + 0.03, wz(H, ua, s * 3.9), wx(H, ub, s * 3.9), 0.03, wz(H, ub, s * 3.9), 0.12, 0.03, '#6a7088');
      }
      beam(T, wx(H, ua, 0), HW_Y + 0.03, wz(H, ua, 0), wx(H, ub, 0), 0.03, wz(H, ub, 0), 0.2, 0.03, '#ffd23a');
      // collision: side walls (block cars from the sides) and low steps inside (for bullets)
      const steps = 8;
      for (let k = 0; k < steps; k++) {
        const a = ua + (ub - ua) * k / steps, b = ua + (ub - ua) * (k + 1) / steps;
        const hi = Math.max(hwHeight(a), hwHeight(b)), lo = Math.min(hwHeight(a), hwHeight(b));
        col(H, a, b, -W / 2, -W / 2 + 0.5, 0, hi + 1.0);
        col(H, a, b, W / 2 - 0.5, W / 2, 0, hi + 1.0);
        if (lo > 0.3) col(H, a, b, -W / 2 + 0.5, W / 2 - 0.5, 0, lo - 0.05, true);
      }
      city.ramps.push({ axis: H.axis, c: H.c, half: W / 2 - 0.3, ua, ub, ha: HW_Y, hb: 0 });
    }
  });
}

// a solid wedge on highway H between u = ua (deck height) and u = ub (street level),
// across s0..s1; the top follows the ramp (+ extra)
function wedge(H, ua, ub, s0, s1, extra, color) {
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const p = g.attributes.position, um = (ua + ub) / 2, L = Math.abs(ub - ua), sm = (s0 + s1) / 2, sw = s1 - s0;
  for (let i = 0; i < p.count; i++) {
    // box coords: along = z (axis z) or x (axis x); across = the other one
    const bx = p.getX(i), by = p.getY(i), bz = p.getZ(i);
    const along = H.axis === 'z' ? bz : bx, across = H.axis === 'z' ? bx : bz;
    const u = um + along * L, s = sm + across * sw; // both increase with the box axes: no mirrored faces
    const top = hwHeight(u) + extra;
    const y = by > 0 ? top : 0;
    p.setXYZ(i, wx(H, u, s), y, wz(H, u, s));
  }
  g.computeVertexNormals();
  const n = p.count, colArr = new Float32Array(n * 3), c = new THREE.Color(color);
  for (let i = 0; i < n; i++) { colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  g.deleteAttribute('uv');
  return g;
}

// ---------------- traffic ----------------
const LANES = [[1, 2.0], [1, 5.8], [-1, 2.0], [-1, 5.8]]; // [direction, distance from the middle]
const PER_LANE = 9, MAXC = HIGHWAYS.length * LANES.length * PER_LANE;
const PAINT = ['#d8d8e0', '#1a6bd8', '#c01848', '#d8c21a', '#121318', '#2aa87a', '#7a3ab0', '#e86a1a', '#9aa4b8'];

function carGeos() {
  const body = [], lights = [];
  const add = (list, w, h, d, x, y, z, c) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); g.deleteAttribute('uv');
    const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c);
    for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g);
  };
  // the car faces -z like the game's own cars
  add(body, 1.95, 0.55, 4.3, 0, 0.55, 0, '#ffffff');
  add(body, 1.62, 0.48, 2.2, 0, 1.06, 0.25, '#2a3040');
  add(body, 1.9, 0.08, 0.5, 0, 1.31, 0.3, '#ffffff');
  add(body, 2.0, 0.3, 4.0, 0, 0.3, 0, '#15161c');
  add(lights, 0.42, 0.13, 0.05, -0.62, 0.62, -2.17, '#fff4d8');
  add(lights, 0.42, 0.13, 0.05, 0.62, 0.62, -2.17, '#fff4d8');
  add(lights, 1.7, 0.1, 0.05, 0, 0.66, 2.17, '#ff2040');
  add(lights, 0.04, 0.04, 3.4, -1.0, 0.3, 0, '#29f3ff');
  add(lights, 0.04, 0.04, 3.4, 1.0, 0.3, 0, '#29f3ff');
  const merge = list => { const g = new THREE.BufferGeometry(); const parts = list; let n = 0; for (const p of parts) n += p.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); col.set(p.attributes.color.array, o * 3); o += p.attributes.position.count; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g; };
  return [merge(body), merge(lights)];
}

export class HighwayTraffic {
  constructor(scene) {
    const [bg, lg] = carGeos();
    this.body = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ vertexColors: true }), MAXC);
    this.lights = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), MAXC);
    for (const m of [this.body, this.lights]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this.body.castShadow = false;
    this.cars = [];
    let idx = 0;
    HIGHWAYS.forEach((H, hi) => LANES.forEach(([dir, k], li) => {
      const s = H.axis === 'z' ? -dir * k : dir * k;
      for (let q = 0; q < PER_LANE; q++) {
        const car = { hi, li, dir, s, u: -dir * R0 + dir * (q + Math.random() * 0.5) * (2 * R0 / PER_LANE), speed: 22, want: 20 + Math.random() * 10 + (k > 4 ? 0 : 4), idx: idx++ };
        this.body.setColorAt(car.idx, new THREE.Color(PAINT[Math.floor(Math.random() * PAINT.length)]));
        this.cars.push(car);
      }
    }));
    this.body.instanceColor.needsUpdate = true;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  // obstacles: the player (on foot or driving) and any car standing on a deck
  update(dt, game) {
    const obs = [];
    const pv = game.player.vehicle, pp = game.wpos();
    if (game.player.alive && pp.y > HW_Y - 3 && pp.y < HW_Y + 6 && !(pv && pv.flying && pp.y > HW_Y + 3)) obs.push({ x: pp.x, z: pp.z, r: pv ? 2.2 : 0.7, v: pv || null });
    for (const v of game.vehicles) if (v !== pv && v.pos.y > HW_Y - 3 && v.pos.y < HW_Y + 4 && v.mode !== 'sky') obs.push({ x: v.pos.x, z: v.pos.z, r: 2.2, v });
    // which cars are in the shared crossing deck
    const inCross = [0, 0];
    for (const c of this.cars) if (Math.abs(c.u - HIGHWAYS[c.hi].cross) < W / 2 + 2.5) inCross[c.hi]++;
    // lanes: cars sorted front to back
    const lanes = new Map();
    for (const c of this.cars) { const k = c.hi * 4 + c.li; if (!lanes.has(k)) lanes.set(k, []); lanes.get(k).push(c); }
    for (const list of lanes.values()) {
      list.sort((a, b) => (b.u - a.u) * a.dir);
      for (let i = 0; i < list.length; i++) {
        const c = list[i], H = HIGHWAYS[c.hi];
        let limit = c.want;
        if (i > 0) { const gap = (list[i - 1].u - c.u) * c.dir; if (gap > 0) limit = Math.min(limit, Math.max(0, (gap - 9) * 1.1)); }
        for (const o of obs) {
          const ou = H.axis === 'z' ? o.z : o.x, os = H.axis === 'z' ? o.x - H.c : o.z - H.c;
          if (Math.abs(os - c.s) > 1.2 + o.r || Math.abs(ou) > R0 + 2) continue;
          const gap = (ou - c.u) * c.dir;
          if (gap > -1 && gap < 30) limit = Math.min(limit, Math.max(0, (gap - 4 - o.r) * 1.2));
        }
        // give way at the crossing if a car of the other highway is in it
        const toX = (H.cross - c.u) * c.dir;
        if (toX > W / 2 + 2 && toX < W / 2 + 22 && inCross[1 - c.hi] > 0) limit = Math.min(limit, Math.max(0, (toX - W / 2 - 4) * 1.2));
        c.speed += Math.max(-24 * dt, Math.min(7 * dt, limit - c.speed));
        if (c.speed < 0) c.speed = 0;
        c.u += c.speed * c.dir * dt;
        if (c.u * c.dir > R0 + 6) {
          // off the far ramp: come back at the start if there's room
          const last = list[list.length - 1];
          if (last === c || (last.u * c.dir) > -R0 + 30) { c.u = -c.dir * (R0 + 4); c.speed = 14; }
        }
      }
    }
    // the player's car bumps into highway cars
    if (pv && !pv.flying && pv.pos.y > HW_Y - 1) {
      for (const c of this.cars) {
        const H = HIGHWAYS[c.hi], x = wx(H, c.u, c.s), z = wz(H, c.u, c.s);
        const dx = pv.pos.x - x, dz = pv.pos.z - z, d = Math.hypot(dx, dz);
        if (d < 3.6 && d > 1e-3 && Math.abs(pv.pos.y - hwHeight(c.u)) < 2) {
          const push = (3.6 - d) / d; pv.pos.x += dx * push; pv.pos.z += dz * push;
          if (Math.abs(pv.speed) > 8) { game.audio.play('crash'); game.hud.kick(6); }
          pv.speed *= 0.6;
        }
      }
    }
    // instance matrices
    for (const c of this.cars) {
      const H = HIGHWAYS[c.hi];
      if (Math.abs(c.u) > R0 + 3) { this.body.setMatrixAt(c.idx, this.zero); this.lights.setMatrixAt(c.idx, this.zero); continue; }
      const h = hwHeight(c.u), h2 = hwHeight(c.u + c.dir * 1.5);
      this._p.set(wx(H, c.u, c.s), h, wz(H, c.u, c.s));
      const fx = H.axis === 'z' ? 0 : c.dir, fz = H.axis === 'z' ? c.dir : 0;
      this._e.set(Math.atan2(h2 - h, 1.5), Math.atan2(-fx, -fz), 0);
      this._m.compose(this._p, this._q.setFromEuler(this._e), this._s);
      this.body.setMatrixAt(c.idx, this._m); this.lights.setMatrixAt(c.idx, this._m);
    }
    this.body.instanceMatrix.needsUpdate = true; this.lights.instanceMatrix.needsUpdate = true;
  }
  // for the minimap
  positions(out = []) {
    out.length = 0;
    for (const c of this.cars) { if (Math.abs(c.u) > R0) continue; const H = HIGHWAYS[c.hi]; out.push(wx(H, c.u, c.s), wz(H, c.u, c.s)); }
    return out;
  }
}
