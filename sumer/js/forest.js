// Trees around the player: OSM trees + park/street trees from the data, plus garden trees placed
// in yards next to houses (like the satellite view). Instanced, rebuilt as the player walks.
import * as THREE from 'three';
import { makeTreeGeometries, NTYPES, TREE, TRUNK_R } from './trees.js';
import { makeLeafyTrees } from './leafy.js';
import { chunk, chunkIndex } from './data.js';

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(x, z) { let n = Math.floor(x * 10) * 374761393 + Math.floor(z * 10) * 668265263; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

const GARDEN_TYPES = [TREE.FICUS, TREE.BROAD, TREE.CITRUS, TREE.OLIVE, TREE.PALM, TREE.CYPRESS, TREE.PINE];
const GARDEN_W = [22, 20, 18, 12, 11, 11, 6];

export class Forest {
  constructor(scene, mats, city, q) {
    this.scene = scene; this.city = city; this.data = city.data; this.q = q;
    const leafy = !!(q.leafy && mats.leaf);
    const { near, far } = leafy ? makeLeafyTrees() : makeTreeGeometries();
    const mat = leafy ? mats.leaf : mats.tree;
    const dyn = (m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; scene.add(m); return m; };
    this.near = near.map((g) => { const m = dyn(new THREE.InstancedMesh(g, mat, q.treeCapNear)); m.castShadow = q.shadows > 0; m.receiveShadow = true; if (leafy) m.customDepthMaterial = mats.leafDepth; return m; });
    // near trees outside the sun's shadow box do not need to be drawn into the shadow map
    this.nearNS = near.map((g) => { const m = dyn(new THREE.InstancedMesh(g, mat, q.treeCapNear)); m.castShadow = false; m.receiveShadow = true; return m; });
    this.shadowR = q.shadows > 0 ? (q.shadowSize || 90) * 1.2 : 0;
    this.far = far.map((g) => { const m = dyn(new THREE.InstancedMesh(g, mat, q.treeCapFar)); m.receiveShadow = false; return m; });
    for (const m of [...this.near, ...this.nearNS, ...this.far]) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    this.garden = new Map();
    this.lastX = 1e9; this.lastZ = 1e9;
    this.wsum = GARDEN_W.reduce((a, b) => a + b, 0);
  }

  gardenTrees(ci) {
    let g = this.garden.get(ci);
    if (g) return g;
    const city = this.city, W = city.g.cs;
    const R = city.raster(ci);
    const rng = mulberry(ci * 9973 + 17);
    const at = (x, z) => (x < 0 || z < 0 || x >= W || z >= W) ? 1 : R.ras[z * W + x];
    const out = [];
    const step = this.q.gardenStep;
    for (let gz = 0; gz < W; gz += step) for (let gx = 0; gx < W; gx += step) {
      const x = gx + rng() * step, z = gz + rng() * step;
      const cx = Math.floor(x), cz = Math.floor(z);
      if (cx >= W || cz >= W || at(cx, cz) !== 1) { rng(); rng(); continue; }
      let ok = true;
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1]]) { const v = at(cx + dx, cz + dz); if (v === 12 || v === 5 || v === 7 || v === 0 || v === 8 || v === 6 || v === 9) { ok = false; break; } }
      if (!ok) { rng(); rng(); continue; }
      let near = false;
      for (const [dx, dz] of [[9, 0], [-9, 0], [0, 9], [0, -9], [6, 6], [-6, 6], [6, -6], [-6, -6], [15, 0], [-15, 0], [0, 15], [0, -15]]) if (at(cx + dx, cz + dz) === 12) { near = true; break; }
      const r = rng();
      if (!near && r > 0.12) { rng(); continue; }
      if (r > 0.6) { rng(); continue; }
      let w = rng() * this.wsum, t = 0;
      while (t < GARDEN_W.length - 1 && w > GARDEN_W[t]) { w -= GARDEN_W[t]; t++; }
      out.push(R.ox + x, R.oz + z, GARDEN_TYPES[t], 0.7 + rng() * 0.45);
    }
    g = new Float32Array(out);
    this.garden.set(ci, g);
    if (this.garden.size > 220) this.garden.delete(this.garden.keys().next().value);
    return g;
  }

  // visit trees (x, z, type, scale) of a chunk
  forChunk(ci, fn, withGarden) {
    const c = chunk(this.data, ci);
    const t = c.trees;
    for (let i = 0; i < t.length; i += 4) fn(t[i], t[i + 1], t[i + 2], t[i + 3]);
    if (withGarden) { const g = this.gardenTrees(ci); for (let i = 0; i < g.length; i += 4) fn(g[i], g[i + 1], g[i + 2], g[i + 3]); }
  }

  update(x, z, force = false, budget = 1e9) {
    if (!force && Math.hypot(x - this.lastX, z - this.lastZ) < 24) return;
    this.lastX = x; this.lastZ = z;
    const R = this.q.treeDist, RN = this.q.treeNear, RG = this.q.gardenDist;
    const g = this.city.g;
    const ix0 = Math.floor((x - R - g.x0) / g.cs), ix1 = Math.floor((x + R - g.x0) / g.cs);
    const iz0 = Math.floor((z - R - g.z0) / g.cs), iz1 = Math.floor((z + R - g.z0) / g.cs);
    const nN = new Array(NTYPES).fill(0), nS = new Array(NTYPES).fill(0), nF = new Array(NTYPES).fill(0);
    const RS = this.shadowR;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const capN = this.q.treeCapNear, capF = this.q.treeCapFar;
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz) continue;
      const cx = g.x0 + (ix + 0.5) * g.cs, cz = g.z0 + (iz + 0.5) * g.cs;
      const dch = Math.hypot(cx - x, cz - z) - g.cs * 0.71;
      if (dch > R) continue;
      const ci = iz * g.nx + ix;
      this.forChunk(ci, (tx, tz, ty, sc) => {
        const d = Math.hypot(tx - x, tz - z);
        if (d > R) return;
        const hh = h2(tx, tz);
        const near = d < RN, cast = near && d < RS;
        const arr = cast ? nN : near ? nS : nF;
        if (arr[ty] >= (near ? capN : capF)) return;
        const mesh = (cast ? this.near : near ? this.nearNS : this.far)[ty];
        let k = sc * (0.85 + 0.3 * hh);
        if (ty === TREE.PALM) k *= 0.8 + 0.5 * h2(tz, tx);
        q.setFromAxisAngle(up, hh * Math.PI * 2);
        s.set(k, k * (ty === TREE.CYPRESS ? 0.8 + 0.4 * hh : 1), k);
        p.set(tx, 0, tz);
        m.compose(p, q, s);
        mesh.setMatrixAt(arr[ty], m);
        const v = 0.85 + 0.3 * h2(tx + 1, tz);
        col.setRGB(v * (0.95 + 0.1 * hh), v, v * (0.95 + 0.08 * (1 - hh)));
        mesh.setColorAt(arr[ty], col);
        arr[ty]++;
      }, dch < RG);
    }
    for (let t = 0; t < NTYPES; t++) {
      this.near[t].count = nN[t]; this.nearNS[t].count = nS[t]; this.far[t].count = nF[t];
      for (const mm of [this.near[t], this.nearNS[t], this.far[t]]) { mm.instanceMatrix.needsUpdate = true; mm.instanceColor.needsUpdate = true; }
    }
  }

  // trunk collisions near (x,z)
  trunksNear(x, z, fn) {
    const g = this.city.g;
    const ci = chunkIndex(this.data, x, z); if (ci < 0) return;
    const ix = ci % g.nx, iz = Math.floor(ci / g.nx);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= g.nx || jz >= g.nz) continue;
      const cx0 = g.x0 + jx * g.cs, cz0 = g.z0 + jz * g.cs;
      if (x < cx0 - 3 || x > cx0 + g.cs + 3 || z < cz0 - 3 || z > cz0 + g.cs + 3) continue;
      this.forChunk(jz * g.nx + jx, (tx, tz, ty, sc) => {
        if (Math.abs(tx - x) > 2 || Math.abs(tz - z) > 2) return;
        const r = TRUNK_R[ty] * sc; if (r > 0) fn(tx, tz, r);
      }, true);
    }
  }
}
