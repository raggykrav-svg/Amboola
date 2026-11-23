// GPS, like the one in Cyberpunk 2077: pick a destination on the big map and a line of glowing
// arrows is painted on the roads all the way there. When you fly, the line goes straight
// through the air to the spot instead.
import * as THREE from 'three';
import { CITY } from './textures.js';

const { CELL, N, HALF } = CITY;
const roadC = i => -HALF + i * CELL;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const clampI = v => Math.max(0, Math.min(N, v));
const TIME = { value: 0 };

function routeMaterial(color) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vR;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvR = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vR;')
      .replace('#include <opaque_fragment>', `
        // arrows (chevrons) sliding toward the destination, and soft glowing edges
        float across = abs(vR.y - 0.5) * 2.0;
        float s = fract(vR.x * 0.28 - uTime * 1.4) - across * 0.22;
        float chev = smoothstep(0.0, 0.05, s) * smoothstep(0.32, 0.26, s);
        float edge = smoothstep(0.72, 1.0, across) * 0.55;
        float fadeStart = smoothstep(0.0, 6.0, vR.x);
        outgoingLight *= (chev * 1.4 + edge) * fadeStart;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'gpsRoute';
  return m;
}

export class GPS {
  constructor(game) {
    this.g = game; this.dest = null; this.label = ''; this.route = []; this.reT = 0;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), routeMaterial(0xffd23a)); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    this.air = new THREE.Mesh(new THREE.BufferGeometry(), routeMaterial(0x29f3ff)); this.air.frustumCulled = false; this.air.renderOrder = 2;
    const bg = new THREE.CylinderGeometry(1.1, 1.1, 300, 12, 1, true); bg.translate(0, 150, 0);
    this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    for (const o of [this.mesh, this.air, this.beam]) { o.visible = false; game.scene.add(o); }
  }
  set(point, label) {
    this.dest = new THREE.Vector3(point.x, 0, point.z); this.label = label || 'DESTINATION';
    this.route = []; this.reT = 0;
    this.g.hud.toast(`GPS: ${this.label}`); this.g.audio.play('switch');
  }
  clear() { this.dest = null; this.route = []; this.mesh.visible = this.air.visible = this.beam.visible = false; }

  // the road crossings at the ends of the street a point is on (or the corners of its block)
  _ends(p) {
    const gi = (p.x + HALF) / CELL, gj = (p.z + HALF) / CELL, ri = Math.round(gi), rj = Math.round(gj);
    const onI = Math.abs(p.x - roadC(ri)) < 12, onJ = Math.abs(p.z - roadC(rj)) < 12;
    if (onI && onJ) return [[clampI(ri), clampI(rj)]];
    if (onI) return [[clampI(ri), clampI(Math.floor(gj))], [clampI(ri), clampI(Math.ceil(gj))]];
    if (onJ) return [[clampI(Math.floor(gi)), clampI(rj)], [clampI(Math.ceil(gi)), clampI(rj)]];
    const a = clampI(Math.floor(gi)), b = clampI(Math.floor(gj));
    return [[a, b], [clampI(a + 1), b], [a, clampI(b + 1)], [clampI(a + 1), clampI(b + 1)]];
  }
  // shortest way along the roads (few turns), avoiding the highway ramps
  _path(from, to) {
    const city = this.g.city, starts = this._ends(from), goals = this._ends(to);
    const key = (i, j, d) => (i * (N + 1) + j) * 5 + d;
    const dist = new Map(), prev = new Map(), open = [];
    for (const [i, j] of starts) { const c = Math.hypot(from.x - roadC(i), from.z - roadC(j)); const k = key(i, j, 4); dist.set(k, c); open.push([c, i, j, 4]); }
    let best = null, bestCost = Infinity;
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]);
      const [c, i, j, d] = open.shift(), k = key(i, j, d);
      if (c > (dist.get(k) ?? Infinity) + 1e-6 || c >= bestCost) continue;
      for (const [gi, gj] of goals) if (gi === i && gj === j) {
        const tot = c + Math.hypot(to.x - roadC(i), to.z - roadC(j));
        if (tot < bestCost) { bestCost = tot; best = k; }
      }
      DIRS.forEach(([dx, dz], nd) => {
        const ni = i + dx, nj = j + dz;
        if (ni < 0 || nj < 0 || ni > N || nj > N || city.segBlocked(i, j, ni, nj)) return;
        const nc = c + CELL + (d !== 4 && d !== nd ? 40 : 0), nk = key(ni, nj, nd);
        if (nc < (dist.get(nk) ?? Infinity)) { dist.set(nk, nc); prev.set(nk, k); open.push([nc, ni, nj, nd]); }
      });
    }
    const pts = [];
    for (let k = best; k !== undefined && k !== null; k = prev.get(k)) { const n = Math.floor(k / 5); pts.push(new THREE.Vector3(roadC(Math.floor(n / (N + 1))), 0, roadC(n % (N + 1)))); }
    pts.reverse();
    return [new THREE.Vector3(from.x, 0, from.z), ...pts, this.dest.clone()];
  }
  // a flat ribbon along points (y comes from each point)
  _ribbon(mesh, pts, width) {
    const n = pts.length; if (n < 2) { mesh.visible = false; return; }
    const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
    let u = 0;
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      if (k > 0) u += pts[k].distanceTo(pts[k - 1]);
      const p = pts[k], w = width / 2;
      pos.set([p.x - tz * w, p.y, p.z + tx * w, p.x + tz * w, p.y, p.z - tx * w], k * 6);
      uv.set([u, 0, u, 1], k * 4);
      if (k < n - 1) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    mesh.geometry.dispose(); mesh.geometry = g; mesh.visible = true;
  }
  // corners of the road route, split into short pieces so the line hugs ramps and decks
  _dense(pts) {
    const out = [];
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / 6));
      for (let s = 0; s < n; s++) out.push(new THREE.Vector3().lerpVectors(a, b, s / n));
    }
    out.push(pts[pts.length - 1].clone());
    for (const p of out) p.y = 0.08;
    return out;
  }
  update(dt) {
    TIME.value += dt;
    const g = this.g, p = g.player;
    if (!this.dest || g.interior || !p.alive) { this.mesh.visible = this.air.visible = false; this.beam.visible = !!this.dest && !g.interior; return; }
    const wp = g.wpos(), v = p.vehicle, flying = v && v.flying && v.pos.y > 4;
    const d = Math.hypot(wp.x - this.dest.x, wp.z - this.dest.z);
    this.beam.visible = true; this.beam.position.copy(this.dest); this.beam.material.opacity = 0.22 + Math.sin(TIME.value * 4) * 0.06;
    if (d < (flying ? 22 : 13)) { g.hud.toast(`YOU HAVE ARRIVED: ${this.label}`); g.audio.play('objective'); this.clear(); return; }
    if (flying) {
      // straight through the air, from just below the car to the destination
      this.mesh.visible = false;
      const a = new THREE.Vector3(wp.x, wp.y - 1.2, wp.z), b = new THREE.Vector3(this.dest.x, Math.min(wp.y - 1.2, 6), this.dest.z);
      const pts = []; for (let s = 0; s <= 12; s++) pts.push(new THREE.Vector3().lerpVectors(a, b, s / 12));
      this._ribbon(this.air, pts, 2.2);
      return;
    }
    this.air.visible = false;
    // re-plan now and then, and when you leave the line
    this.reT -= dt;
    let off = Infinity;
    if (this.route.length) {
      for (let k = 0; k + 1 < this.route.length; k++) {
        const a = this.route[k], b = this.route[k + 1], sx = b.x - a.x, sz = b.z - a.z, l2 = sx * sx + sz * sz || 1;
        const t = Math.max(0, Math.min(1, ((wp.x - a.x) * sx + (wp.z - a.z) * sz) / l2));
        off = Math.min(off, Math.hypot(a.x + sx * t - wp.x, a.z + sz * t - wp.z));
      }
    }
    if (!this.route.length || off > 18 || this.reT <= 0) {
      this.reT = 1.0;
      this.route = this._path(wp, this.dest);
      // drop the start of the line you've already passed
      const r = this.route;
      if (r.length > 2) {
        const a = r[0], b = r[1], c = r[2];
        if ((b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z) < 0 && Math.hypot(c.x - a.x, c.z - a.z) < Math.hypot(c.x - b.x, c.z - b.z)) r.splice(1, 1);
      }
      this._ribbon(this.mesh, this._dense(this.route), 2.6);
    }
  }
}
