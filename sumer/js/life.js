// Life in the streets: people walking on sidewalks, paths and the promenade, and cars driving
// on the main roads (on the left, as in Cyprus). Instanced and kept around the player.
import * as THREE from 'three';
import { chunk, chunkIndex } from './data.js';
import { CAR_TYPES, CAR_COLOURS, buildCar, makeCarMaterial, pickCarType, carCircles } from './cars.js';

function rnd() { return Math.random(); }

// ------------------------------------------------------------------ person model (one mesh, limbs swing in the shader)
function personGeometry() {
  const P = [], N = [], C = [], L = [], T = [];
  const skin = new THREE.Color(0xc99272), hair = new THREE.Color(0x2e2219), pants = new THREE.Color(0x3b4a66), shoe = new THREE.Color(0x2a2a2a), shirt = new THREE.Color(0xffffff);
  const box = (x0, y0, z0, x1, y1, z1, col, limb, tint) => {
    const f = (a, b, c, d, n) => { for (const v of [a, b, c, a, c, d]) { P.push(...v); N.push(...n); C.push(col.r, col.g, col.b); L.push(limb); T.push(tint); } };
    f([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    f([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    f([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    f([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    f([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
  };
  box(-0.16, 0.05, -0.07, -0.03, 0.86, 0.07, pants, 1, 0); box(0.03, 0.05, -0.07, 0.16, 0.86, 0.07, pants, 2, 0);
  box(-0.16, 0, -0.1, -0.03, 0.07, 0.08, shoe, 1, 0); box(0.03, 0, -0.1, 0.16, 0.07, 0.08, shoe, 2, 0);
  box(-0.18, 0.82, -0.1, 0.18, 1.0, 0.1, pants, 0, 0);
  box(-0.19, 1.0, -0.11, 0.19, 1.52, 0.11, shirt, 0, 1);
  box(-0.27, 0.98, -0.05, -0.19, 1.5, 0.05, skin, 3, 0); box(0.19, 0.98, -0.05, 0.27, 1.5, 0.05, skin, 4, 0);
  box(-0.28, 1.3, -0.06, -0.19, 1.52, 0.06, shirt, 3, 1); box(0.19, 1.3, -0.06, 0.28, 1.52, 0.06, shirt, 4, 1);
  box(-0.1, 1.53, -0.1, 0.1, 1.76, 0.1, skin, 0, 0);
  box(-0.11, 1.7, -0.11, 0.11, 1.8, 0.11, hair, 0, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('aLimb', new THREE.Float32BufferAttribute(L, 1));
  g.setAttribute('aTintable', new THREE.Float32BufferAttribute(T, 1));
  g.computeBoundingSphere();
  return g;
}

function personMaterial(U) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aLimb; attribute float aTintable; attribute vec2 aWalk;')
      .replace('#include <color_vertex>', `
        vColor = vec3(color);
        #ifdef USE_INSTANCING_COLOR
          if (aTintable > 0.5) vColor *= instanceColor.xyz;
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float sw = sin(uTime * 7.5 * aWalk.y + aWalk.x) * 0.55 * min(aWalk.y, 1.0);
          float ang = 0.0; float py = 0.0;
          if (aLimb > 0.5 && aLimb < 1.5) { ang = sw; py = 0.86; }
          else if (aLimb > 1.5 && aLimb < 2.5) { ang = -sw; py = 0.86; }
          else if (aLimb > 2.5 && aLimb < 3.5) { ang = -sw * 0.8; py = 1.48; }
          else if (aLimb > 3.5) { ang = sw * 0.8; py = 1.48; }
          if (ang != 0.0) {
            float y = transformed.y - py, z = transformed.z;
            transformed.y = py + y * cos(ang) - z * sin(ang);
            transformed.z = y * sin(ang) + z * cos(ang);
          }
        }`);
  };
  m.customProgramCacheKey = () => 'sumer-person';
  return m;
}

const SHIRTS = [0xffffff, 0xf2f2f2, 0x2f6fb0, 0xd8433b, 0xf0c33c, 0x2c2c2c, 0x3f9a66, 0xe98aa8, 0x8a5ad0, 0xf08a3c, 0x7fc8e8, 0xdedad0];

// a walking route: a polyline the person follows back and forth
function pickRoute(city, data, x, z, R, wantCar) {
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() * Math.PI * 2, d = R * (0.25 + Math.random() * 0.75);
    const ci = chunkIndex(data, x + Math.cos(a) * d, z + Math.sin(a) * d);
    if (ci < 0) continue;
    const c = chunk(data, ci);
    if (!c.roads.length) continue;
    const cands = c.roads.filter((r) => wantCar ? (!r.path && r.cls >= 3 && r.cls <= 6 && r.w >= 5) : (r.path ? (r.cls === 10 || r.cls === 11 || r.cls === 12 || r.cls === 14) : (r.sw > 0.8 && r.cls >= 3 && r.cls <= 7)));
    if (!cands.length) continue;
    const r = cands[Math.floor(Math.random() * cands.length)];
    if (r.pts.length < 4) continue;
    let off = 0;
    if (wantCar) off = (r.flags & 1) ? 0 : r.w / 4;                  // keep left
    else if (!r.path) off = (r.w / 2 + Math.min(r.sw, 2.4) / 2) * (Math.random() < 0.5 ? -1 : 1);
    else off = (Math.random() - 0.5) * Math.min(r.w * 0.6, 3);
    const pts = offsetLine(r.pts, off);
    let len = 0; for (let i = 0; i + 3 < pts.length; i += 2) len += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
    if (len < (wantCar ? 25 : 8)) continue;
    // check the route does not run through buildings (for sidewalks next to houses)
    let bad = 0;
    for (let i = 0; i < pts.length; i += 2) { const s = city.surfaceAt(pts[i], pts[i + 1]); if (s === 12 || s === 0 || s === 8) bad++; }
    if (bad > pts.length / 6) continue;
    return { pts, len, oneway: !!(r.flags & 1), road: r };
  }
  return null;
}
function offsetLine(p, off) {
  if (!off) return Array.from(p);
  const out = []; const n = p.length / 2;
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let dx = p[2 * i1] - p[2 * i0], dz = p[2 * i1 + 1] - p[2 * i0 + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    out.push(p[2 * i] + dz * off, p[2 * i + 1] - dx * off); // (dz,-dx) = left of travel
  }
  return out;
}
function along(route, s) {
  const p = route.pts;
  let acc = 0;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const L = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
    if (acc + L >= s || i + 4 >= p.length) {
      const t = L > 0 ? Math.min(1, Math.max(0, (s - acc) / L)) : 0;
      return [p[i] + (p[i + 2] - p[i]) * t, p[i + 1] + (p[i + 3] - p[i + 1]) * t, p[i + 2] - p[i], p[i + 3] - p[i + 1]];
    }
    acc += L;
  }
  return [p[0], p[1], 1, 0];
}

export class Life {
  constructor(scene, city, data, mats, props, q) {
    this.city = city; this.data = data; this.q = q;
    this.nP = q.people || 0; this.nC = q.traffic || 0;
    this.people = []; this.cars = [];
    if (this.nP) {
      const g = personGeometry();
      this.walk = new THREE.InstancedBufferAttribute(new Float32Array(this.nP * 2), 2); this.walk.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aWalk', this.walk);
      this.pm = new THREE.InstancedMesh(g, personMaterial(mats.U), this.nP);
      this.pm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.pm.castShadow = q.shadows > 0; this.pm.receiveShadow = true; this.pm.frustumCulled = false; this.pm.count = 0;
      const col = new THREE.Color();
      for (let i = 0; i < this.nP; i++) this.pm.setColorAt(i, col.set(SHIRTS[i % SHIRTS.length]));
      scene.add(this.pm);
    }
    if (this.nC) {
      // driving cars: the detailed models, lights on at dusk and night
      const mat = makeCarMaterial(mats.U, true);
      const mk = (t, low) => {
        const im = new THREE.InstancedMesh(buildCar(t, low), mat, this.nC);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.castShadow = !low && q.shadows > 0; im.receiveShadow = true; im.frustumCulled = false; im.count = 0;
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.nC * 3), 3);
        scene.add(im);
        return im;
      };
      this.cms = CAR_TYPES.map((t) => mk(t, false)).concat(CAR_TYPES.map((t) => mk(t, true))); // near models, then far ones
      this.col = new THREE.Color();
    }
    this.m = new THREE.Matrix4(); this.q4 = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3(1, 1, 1);
    this.spawnT = 0;
  }

  update(dt, px, pz, active) {
    if (!this.nP && !this.nC) return;
    this.spawnT -= dt;
    const RP = this.q.peopleDist || 140, RC = this.q.trafficDist || 260;
    // spawn a few per frame
    if (this.spawnT <= 0) {
      this.spawnT = 0.05;
      if (this.people.length < this.nP) { const r = pickRoute(this.city, this.data, px, pz, RP, false); if (r) this.people.push({ r, s: Math.random() * r.len, dir: Math.random() < 0.5 ? 1 : -1, v: 1.05 + Math.random() * 0.5, ph: Math.random() * 6.28, sc: 0.9 + Math.random() * 0.2, wait: 0 }); }
      if (this.cars.length < this.nC) { const r = pickRoute(this.city, this.data, px, pz, RC, true); if (r) { const t = pickCarType(Math.random()); this.cars.push({ r, s: Math.random() * r.len * 0.5, v: 8 + Math.random() * 5, cur: 0, t, c: CAR_COLOURS[Math.floor(Math.random() * CAR_COLOURS.length)], cc: carCircles(t) }); } }
    }
    // people
    let k = 0;
    for (let i = this.people.length - 1; i >= 0; i--) {
      const p = this.people[i];
      const [x, z] = along(p.r, p.s);
      if (Math.hypot(x - px, z - pz) > RP * 1.25) { this.people.splice(i, 1); continue; }
    }
    for (const p of this.people) {
      let [x, z] = along(p.r, p.s);
      const dp = Math.hypot(x - px, z - pz);
      const stop = active && dp < 1.3;
      if (!stop) {
        p.s += p.dir * p.v * dt;
        if (p.s > p.r.len) { p.s = p.r.len; p.dir = -1; } else if (p.s < 0) { p.s = 0; p.dir = 1; }
      }
      const a = along(p.r, p.s); x = a[0]; z = a[1];
      const dx = a[2] * p.dir, dz = a[3] * p.dir;
      const ry = Math.atan2(-dx, -dz);
      this.e.set(0, ry, 0); this.q4.setFromEuler(this.e); this.v.set(x, this.city.surfaceAt(x, z) === 7 ? 0.12 : 0, z); this.sc.setScalar(p.sc);
      this.m.compose(this.v, this.q4, this.sc); this.pm.setMatrixAt(k, this.m);
      this.walk.setXY(k, p.ph, stop ? 0 : p.v / 1.3);
      p.x = x; p.z = z;
      k++;
    }
    if (this.pm) { this.pm.count = k; this.pm.instanceMatrix.needsUpdate = true; this.walk.needsUpdate = true; }
    // cars
    const nT = this.cms ? new Array(this.cms.length).fill(0) : null;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      const a = along(c.r, c.s);
      if (Math.hypot(a[0] - px, a[1] - pz) > RC * 1.3 || c.s >= c.r.len - 0.5) { this.cars.splice(i, 1); continue; }
    }
    for (const c of this.cars) {
      const a = along(c.r, c.s);
      const l = Math.hypot(a[2], a[3]) || 1, ux = a[2] / l, uz = a[3] / l;
      // brake for the walker in front
      const fx = px - a[0], fz = pz - a[1];
      const ahead = fx * ux + fz * uz, side = Math.abs(fx * uz - fz * ux);
      const block = active && ahead > 0 && ahead < 9 && side < 1.8;
      const target = block ? 0 : c.v;
      c.cur += (target - c.cur) * Math.min(1, dt * (block ? 4 : 1.2));
      c.s += c.cur * dt;
      const b = along(c.r, c.s);
      this.e.set(0, Math.atan2(-uz, ux), 0); this.q4.setFromEuler(this.e); this.v.set(b[0], 0, b[1]); this.sc.setScalar(1);
      const slot = c.t + (Math.hypot(b[0] - px, b[1] - pz) < (this.q.carNear || 0) ? 0 : CAR_TYPES.length);
      const im = this.cms[slot], k = nT[slot]++;
      this.m.compose(this.v, this.q4, this.sc); im.setMatrixAt(k, this.m);
      im.setColorAt(k, this.col.set(c.c));
      c.x = b[0]; c.z = b[1]; c.ux = ux; c.uz = uz;
    }
    if (this.cms) this.cms.forEach((im, t) => { im.count = nT[t]; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; });
  }

  // bodies the walker bumps into
  colliders(x, z, fn) {
    for (const p of this.people) if (p.x !== undefined && Math.abs(p.x - x) < 1.5 && Math.abs(p.z - z) < 1.5) fn(p.x, p.z, 0.28);
    for (const c of this.cars) if (c.x !== undefined && Math.abs(c.x - x) < 4.5 && Math.abs(c.z - z) < 4.5) { fn(c.x + c.ux * c.cc.off, c.z + c.uz * c.cc.off, c.cc.r); fn(c.x - c.ux * c.cc.off, c.z - c.uz * c.cc.off, c.cc.r); }
  }
  clear() { this.people.length = 0; this.cars.length = 0; }
}
