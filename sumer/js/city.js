// Builds Limassol in 3D from the decoded map data: ground, streets, sidewalks, markings,
// buildings (with facades, tiled roofs, domes, towers), and streams it in 1 km superchunks.
import * as THREE from 'three';
import earcut from 'earcut';
import { chunk, chunkIndex } from './data.js';
import { CAR_TYPES, CAR_COLOURS, pickCarType, carCircles } from './cars.js';

export const SUP = 4;               // chunks per superchunk side (4 x 250 m = 1 km)
const CURB = 0.12;                  // sidewalk height
const PIER_H = 0.55, BW_H = 0.9, WATER_Y = -0.32;

// style -> facade atlas column, module width (m)
const STYLE_COL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MODW = [3.6, 3.3, 2.9, 3.6, 4.2, 3.6, 3.4, 4.2, 7.5, 3.2, 3.0];

function lin(hex) { return new THREE.Color(hex); }
function hash01(n) { n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }

// ground look per class name
const GSTYLE = {
  LAND: [0xcfc4ac, 3, 9], FARM: [0xbba977, 2, 9.5], INDUSTRIAL: [0xbbb7af, 0, 8], INST: [0xcdc2aa, 3, 8], DIRT: [0xc4a982, 3, 7],
  CEMETERY: [0xa8ae8b, 2, 7], SCRUB: [0xa69d6d, 2, 8], GRASS: [0x7ea34e, 2, 7], WOOD: [0x8f8c5c, 2, 8], SAND: [0xe4d5aa, 3, 6],
  PITCHGRASS: [0x5f9f45, 2, 6], PITCHHARD: [0x4f7f92, 0, 6], PITCHCLAY: [0xb6633f, 3, 5], TRACK: [0xb45441, 0, 6], PLAYGROUND: [0xc3735a, 0, 5],
  PARKING: [0x6d6e70, 0, 6], WATER: [0x3f88a3, 3, 8], POOL: [0x4fc2e0, 3, 5], PAVING: [0xd9cfbd, 1, 4], TRACKDIRT: [0xb89e78, 3, 6],
  ASPHALT: [0x56595d, 0, 6], CYCLE: [0xa2514a, 0, 5], FOOTPATH: [0xd8cebb, 1, 3.2], SIDEWALK: [0xcbc6bc, 1, 3.2], PIER: [0xcbbfa4, 1, 4], BREAKWATER: [0xd9d1c3, 3, 2.5],
};

export class City {
  constructor(data, scene, mats, quality) {
    this.data = data; this.scene = scene; this.mats = mats; this.q = quality;
    const h = data.header; this.h = h;
    this.CL = Object.fromEntries(h.cls.map((c, i) => [c, i]));
    this.gstyle = h.cls.map((c) => { const s = GSTYLE[c] || [0xff00ff, 3, 6]; return { col: lin(s[0]), tile: s[1], scale: s[2] }; });
    this.walls = h.walls.map((c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace));
    this.roofc = h.roofc.map((c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace));
    const g = h.grid; this.g = g;
    this.snx = Math.ceil(g.nx / SUP); this.snz = Math.ceil(g.nz / SUP);
    this.supers = new Map();        // si -> {base: Group, detail: Group|null}
    this.queue = [];
    this.rasters = new Map();
    this.detailVersion = 0;          // bumped when street details are built or dropped (parked cars follow it)
    this.allParsed = false;
  }

  // ---------------------------------------------------------------- parsing & spatial index
  parseAll(onProgress) {
    const n = this.g.nx * this.g.nz;
    const CELL = 20; this.ecell = CELL;
    const A = this.h.area;
    this.ex0 = A[0] - 200; this.ez0 = A[1] - 200;
    this.enx = Math.ceil((A[2] - A[0] + 400) / CELL); this.enz = Math.ceil((A[3] - A[1] + 400) / CELL);
    this.egrid = new Map(); // cell -> array of [x1,z1,x2,z2,...] edges (flat)
    this.bldList = [];
    for (let ci = 0; ci < n; ci++) {
      const c = chunk(this.data, ci);
      for (const b of c.buildings) {
        this.bldList.push(b);
        let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
        for (const r of b.rings) for (let i = 0; i < r.length; i += 2) { minx = Math.min(minx, r[i]); maxx = Math.max(maxx, r[i]); minz = Math.min(minz, r[i + 1]); maxz = Math.max(maxz, r[i + 1]); }
        b.bb = [minx, minz, maxx, maxz];
        if (b.H < 1.2 && b.minH > 0) continue; // canopies: no collision
        if (b.minH > 2.5) continue;            // parts in the air
        for (const r of b.rings) {
          const k = r.length / 2;
          for (let i = 0; i < k; i++) {
            const j = (i + 1) % k;
            const x1 = r[2 * i], z1 = r[2 * i + 1], x2 = r[2 * j], z2 = r[2 * j + 1];
            const cx0 = Math.floor((Math.min(x1, x2) - this.ex0) / CELL), cx1 = Math.floor((Math.max(x1, x2) - this.ex0) / CELL);
            const cz0 = Math.floor((Math.min(z1, z2) - this.ez0) / CELL), cz1 = Math.floor((Math.max(z1, z2) - this.ez0) / CELL);
            for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
              const key = cz * this.enx + cx;
              let a = this.egrid.get(key); if (!a) { a = []; this.egrid.set(key, a); }
              a.push(x1, z1, x2, z2);
            }
          }
        }
      }
      if (onProgress && ci % 300 === 0) onProgress(ci / n);
    }
    this.allParsed = true;
  }

  // building edges near (x,z): calls fn(x1,z1,x2,z2)
  edgesNear(x, z, r, fn) {
    const C = this.ecell;
    const cx0 = Math.floor((x - r - this.ex0) / C), cx1 = Math.floor((x + r - this.ex0) / C);
    const cz0 = Math.floor((z - r - this.ez0) / C), cz1 = Math.floor((z + r - this.ez0) / C);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const a = this.egrid.get(cz * this.enx + cx);
      if (!a) continue;
      for (let i = 0; i < a.length; i += 4) fn(a[i], a[i + 1], a[i + 2], a[i + 3]);
    }
  }

  // ---------------------------------------------------------------- raster (1 m) per chunk: surfaces + buildings
  raster(ci) {
    let R = this.rasters.get(ci);
    if (R) return R;
    const g = this.g, W = g.cs;
    const c = chunk(this.data, ci);
    const ras = new Uint8Array(W * W);
    const CL = this.CL;
    const V = {}; // class -> raster value
    for (const k of ['LAND']) V[CL[k]] = 1;
    for (const k of ['FARM', 'INDUSTRIAL', 'INST', 'DIRT', 'CEMETERY', 'SCRUB', 'WOOD', 'TRACKDIRT']) V[CL[k]] = 2;
    V[CL.GRASS] = 3; V[CL.SAND] = 4;
    for (const k of ['PITCHGRASS', 'PITCHHARD', 'PITCHCLAY', 'TRACK', 'PLAYGROUND']) V[CL[k]] = 9;
    V[CL.PARKING] = 5; V[CL.ASPHALT] = 5; V[CL.WATER] = 8; V[CL.POOL] = 8; V[CL.PAVING] = 6; V[CL.CYCLE] = 6; V[CL.FOOTPATH] = 6;
    V[CL.SIDEWALK] = 7; V[CL.PIER] = 10; V[CL.BREAKWATER] = 11;
    const list = c.ground.slice().sort((a, b) => a.cls - b.cls);
    for (const gp of list) fillRings(ras, W, gp.rings, c.ox, c.oz, V[gp.cls] ?? 1);
    // buildings overlapping this chunk (from the 3x3 neighbourhood)
    const ix = ci % g.nx, iz = Math.floor(ci / g.nx);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= g.nx || jz >= g.nz) continue;
      const cc = chunk(this.data, jz * g.nx + jx);
      for (const b of cc.buildings) {
        const bb = b.bb; if (!bb) continue;
        if (bb[2] < c.ox || bb[0] > c.ox + W || bb[3] < c.oz || bb[1] > c.oz + W) continue;
        if (b.minH > 2.5) continue;
        fillRings(ras, W, b.rings, c.ox, c.oz, 12);
      }
    }
    R = { ras, ox: c.ox, oz: c.oz, colliders: null };
    this.rasters.set(ci, R);
    if (this.rasters.size > 90) { // forget far rasters
      const k = this.rasters.keys().next().value; this.rasters.delete(k);
    }
    return R;
  }

  surfaceAt(x, z) {
    const ci = chunkIndex(this.data, x, z);
    if (ci < 0) return 1;
    const R = this.raster(ci);
    const W = this.g.cs;
    const cx = Math.min(W - 1, Math.max(0, Math.floor(x - R.ox))), cz = Math.min(W - 1, Math.max(0, Math.floor(z - R.oz)));
    return R.ras[cz * W + cx];
  }

  // ---------------------------------------------------------------- streaming
  superOf(x, z) {
    const g = this.g;
    const sx = Math.floor((x - g.x0) / (g.cs * SUP)), sz = Math.floor((z - g.z0) / (g.cs * SUP));
    return [sx, sz];
  }
  superBox(si) {
    const g = this.g, S = g.cs * SUP; const sx = si % this.snx, sz = Math.floor(si / this.snx);
    return [g.x0 + sx * S, g.z0 + sz * S, g.x0 + (sx + 1) * S, g.z0 + (sz + 1) * S];
  }
  superChunks(si) {
    const g = this.g; const sx = si % this.snx, sz = Math.floor(si / this.snx);
    const out = [];
    for (let dz = 0; dz < SUP; dz++) for (let dx = 0; dx < SUP; dx++) {
      const ix = sx * SUP + dx, iz = sz * SUP + dz;
      if (ix < g.nx && iz < g.nz) out.push(iz * g.nx + ix);
    }
    return out;
  }
  distToSuper(si, x, z) {
    const b = this.superBox(si);
    const dx = Math.max(b[0] - x, 0, x - b[2]), dz = Math.max(b[1] - z, 0, z - b[3]);
    return Math.hypot(dx, dz);
  }

  // decide what to build/unload around the camera; build within a time budget (ms)
  update(x, z, budgetMs, detailX = x, detailZ = z) {
    const rB = this.q.viewDist, rD = this.q.detailDist;
    const want = [];
    for (let si = 0; si < this.snx * this.snz; si++) {
      const d = this.distToSuper(si, x, z);
      const s = this.supers.get(si);
      if (d < rB) { if (!s || !s.base) want.push([d, si, 'base']); }
      else if (s && d > rB + 600) this.dropSuper(si);
    }
    // details (balconies, roof heaters, cars, lamps, boats...) per 250 m chunk near the player
    if (!this.details) this.details = new Map();
    const g = this.g;
    const ix0 = Math.floor((detailX - rD - g.x0) / g.cs), ix1 = Math.floor((detailX + rD - g.x0) / g.cs);
    const iz0 = Math.floor((detailZ - rD - g.z0) / g.cs), iz1 = Math.floor((detailZ + rD - g.z0) / g.cs);
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz) continue;
      const ci = iz * g.nx + ix;
      if (this.details.has(ci) || !this.data.len[ci]) continue;
      const dx = Math.max(g.x0 + ix * g.cs - detailX, 0, detailX - g.x0 - (ix + 1) * g.cs), dz = Math.max(g.z0 + iz * g.cs - detailZ, 0, detailZ - g.z0 - (iz + 1) * g.cs);
      const dd = Math.hypot(dx, dz);
      if (dd < rD) want.push([dd + 1, ci, 'detail']);
    }
    for (const [ci, grp] of this.details) {
      const ix = ci % g.nx, iz = Math.floor(ci / g.nx);
      const dx = Math.max(g.x0 + ix * g.cs - detailX, 0, detailX - g.x0 - (ix + 1) * g.cs), dz = Math.max(g.z0 + iz * g.cs - detailZ, 0, detailZ - g.z0 - (iz + 1) * g.cs);
      if (Math.hypot(dx, dz) > rD + 160) this.dropDetail(ci);
    }
    want.sort((a, b) => a[0] - b[0]);
    const t0 = performance.now();
    let built = 0;
    for (const [, id, kind] of want) {
      if (kind === 'base') this.buildBase(id); else this.buildDetail(id);
      built++;
      if (performance.now() - t0 > budgetMs) break;
    }
    this.pending = want.length - built;
    return built;
  }

  dropSuper(si) {
    const s = this.supers.get(si); if (!s) return;
    if (s.base) { this.scene.remove(s.base); disposeGroup(s.base); }
    this.supers.delete(si);
  }
  dropDetail(ci) {
    const grp = this.details.get(ci); if (!grp) return;
    this.scene.remove(grp); disposeGroup(grp); this.details.delete(ci); this.detailVersion++;
    const R = this.rasters.get(ci); if (R) R.colliders = null;
  }

  buildBase(si) {
    let s = this.supers.get(si);
    if (!s) { s = { base: null, detail: null }; this.supers.set(si, s); }
    const grp = new THREE.Group(); grp.name = 'super' + si;
    const chunks = this.superChunks(si);
    const gm = this.buildGround(chunks);
    if (gm.flat) grp.add(gm.flat);
    if (gm.flatDepth) grp.add(gm.flatDepth);
    if (gm.raised) grp.add(gm.raised);
    if (gm.marks) grp.add(gm.marks);
    const bm = this.buildBuildings(chunks);
    if (bm) grp.add(bm);
    s.base = grp;
    this.scene.add(grp);
  }

  // ---------------------------------------------------------------- ground
  buildGround(chunks) {
    const F = new GeoBuf(), Rz = new GeoBuf(), M = new GeoBuf();
    const CL = this.CL, cs = this.g.cs;
    for (const ci of chunks) {
      const c = chunk(this.data, ci);
      const list = c.ground.slice().sort((a, b) => a.cls - b.cls);
      for (const gp of list) {
        const st = this.gstyle[gp.cls];
        const raised = gp.cls === CL.SIDEWALK ? CURB : gp.cls === CL.PIER ? PIER_H : gp.cls === CL.BREAKWATER ? BW_H : null;
        const tgt = raised === null ? F : Rz;
        const y = raised === null ? 0 : raised;
        const vary = 0.94 + 0.12 * hash01(gp.rings[0].length * 131 + ci * 7 + gp.cls);
        const col = st.col.clone().multiplyScalar(gp.cls === CL.LAND || gp.cls === CL.ASPHALT ? 1 : vary);
        addPolygon(tgt, gp.rings, y, col, st.tile, st.scale);
        if (raised !== null) {
          const bottom = gp.cls === CL.SIDEWALK ? 0 : WATER_Y;
          const ccol = gp.cls === CL.SIDEWALK ? lin(0xa9a49b) : col.clone().multiplyScalar(1.05);
          for (const r of gp.rings) addCurb(Rz, r, bottom, y, ccol, c.ox, c.oz, cs, st.tile);
        }
      }
      // road markings
      for (const rd of c.roads) addMarkings(M, rd);
    }
    const out = {};
    if (F.count) {
      out.flat = new THREE.Mesh(F.geometry(), this.mats.ground);
      out.flat.renderOrder = -5; out.flat.receiveShadow = true;
      if (this.q.ao) {
        out.flatDepth = new THREE.Mesh(out.flat.geometry, this.mats.groundDepth);
        out.flatDepth.renderOrder = -4.5; out.flatDepth.userData.sharedGeo = true;
      }
    }
    if (Rz.count) {
      out.raised = new THREE.Mesh(Rz.geometry(), this.mats.raised);
      out.raised.receiveShadow = true; out.raised.castShadow = false;
    }
    if (M.count) {
      out.marks = new THREE.Mesh(M.geometry(), this.mats.marks);
      out.marks.renderOrder = -4; out.marks.receiveShadow = true;
    }
    return out;
  }

  // ---------------------------------------------------------------- buildings
  buildBuildings(chunks) {
    const B = new BBuf();
    for (const ci of chunks) {
      const c = chunk(this.data, ci);
      for (const b of c.buildings) this.addBuilding(B, b, ci);
    }
    if (!B.count) return null;
    const mesh = new THREE.Mesh(B.geometry(), this.mats.building);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  addBuilding(B, b, ci) {
    const seed = hash01(ci * 4099 + b.idx * 7 + 1);
    let style = b.style;
    let col = STYLE_COL[style] ?? 0;
    if (style === 0 && seed < 0.45) col = 11;
    const outer = b.rings[0];
    if (outer.length < 6) return;
    const base = b.minH;
    let H = b.H;
    if (style === 8) H = Math.max(H, 15);
    const lv = Math.max(1, b.lv);
    const canopy = base > 1.5 && H - base < 1.5;   // fuel station roofs etc.
    let fh = (H - base - (lv > 1 ? 0.6 : 0.25)) / lv;
    if ((b.flags & 8) && H > 20) fh = (H - base) / lv;
    fh = Math.min(5.5, Math.max(2.6, fh));
    if (style === 4 && lv === 1) fh = Math.max(fh, H - base);
    const groundRow = base > 0.5 ? 0 : (b.flags & 1) ? 2 : (b.flags & 2) ? 3 : 1;
    const wall = this.walls[b.wall] || this.walls[0];
    const roofCol = this.roofc[b.roofc] || this.roofc[5];
    // pitched roof needs a near-rectangular footprint
    let roof = b.roof;
    let ob = null;
    const area = Math.abs(ringArea(outer));
    if (roof === 1 || roof === 2 || roof === 4 || roof === 3 || style === 5) {
      ob = obb(outer);
      if ((roof === 1 || roof === 2 || roof === 4) && (area / (4 * ob.a * ob.b) < 0.76 || ob.b > 22)) roof = 0;
    }
    const modW = MODW[style] || 3.4;
    // walls
    const wallTop = H;
    for (let ri = 0; ri < b.rings.length; ri++) {
      const r = b.rings[ri]; const k = r.length / 2;
      for (let i = 0; i < k; i++) {
        const j = (i + 1) % k;
        const x1 = r[2 * i], z1 = r[2 * i + 1], x2 = r[2 * j], z2 = r[2 * j + 1];
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.05) continue;
        const nMod = Math.max(1, Math.round(len / modW));
        const blank = len < 1.7 || canopy;
        B.wall(x1, z1, x2, z2, base, wallTop, nMod, fh, wall, col, groundRow, seed, blank ? 3 : 0);
      }
    }
    // roofs
    if (roof === 0 || roof === 5 || roof === 6 || roof === 3) {
      if (roof !== 6) B.flat(b.rings, H, roofCol, canopy ? 3 : 1);
      if (canopy) B.flat(b.rings, base, lin(0xd0d0cc), 3, true);
      if (roof === 3 && ob && style !== 5) B.dome(ob.cx, H, ob.cz, Math.min(ob.a, ob.b) * 0.95, roofCol, 0.75);
    } else {
      B.pitched(ob, H, roof, roofCol, wall);
    }
    // seafront towers: a white balcony band with glass rails on every floor
    if (H > 35 && (style === 3 || style === 6) && base < 1) {
      const white = lin(0xf3f3f0), glassC = lin(0x9fbccb), dep = 1.7;
      const k = outer.length / 2;
      for (let f = 2; f < lv; f++) {
        const y = base + f * fh;
        if (y > H - 2) break;
        for (let i = 0; i < k; i++) {
          const j = (i + 1) % k;
          const x1 = outer[2 * i], z1 = outer[2 * i + 1], x2 = outer[2 * j], z2 = outer[2 * j + 1];
          const L = Math.hypot(x2 - x1, z2 - z1); if (L < 3) continue;
          const nx = (z2 - z1) / L, nz = -(x2 - x1) / L;
          const A0 = [x1, y - 0.25, z1], B0 = [x2, y - 0.25, z2], A1 = [x1, y, z1], B1 = [x2, y, z2];
          const FA0 = [x1 + nx * dep, y - 0.25, z1 + nz * dep], FB0 = [x2 + nx * dep, y - 0.25, z2 + nz * dep];
          const FA1 = [x1 + nx * dep, y, z1 + nz * dep], FB1 = [x2 + nx * dep, y, z2 + nz * dep];
          B.face([A1, B1, FB1, FA1], white, 3);
          B.face([A0, FA0, FB0, B0], white.clone().multiplyScalar(0.8), 3);
          B.face([FA1, FB1, FB0, FA0], white, 3);
          const G0 = FA1, G1 = FB1, G2 = [FB1[0], y + 1.05, FB1[2]], G3 = [FA1[0], y + 1.05, FA1[2]];
          B.face([G3, G2, G1, G0], glassC, 3);
          B.face([G0, G1, G2, G3], glassC, 3);
        }
      }
    }
    // landmarks
    if (style === 8) this.castleTop(B, outer, H, wall);
    if (style === 5 && ob) this.churchExtras(B, b, ob, H, wall, roofCol, seed, roof);
  }

  castleTop(B, r, H, wall) {
    const k = r.length / 2;
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k;
      const x1 = r[2 * i], z1 = r[2 * i + 1], x2 = r[2 * j], z2 = r[2 * j + 1];
      const len = Math.hypot(x2 - x1, z2 - z1); if (len < 1) continue;
      const ux = (x2 - x1) / len, uz = (z2 - z1) / len, nx = uz, nz = -ux;
      for (let t = 0.6; t < len - 0.4; t += 1.9) {
        const cx = x1 + ux * (t + 0.45) - nx * 0.3, cz = z1 + uz * (t + 0.45) - nz * 0.3;
        B.box(cx, H, cz, 0.9, 1.1, 0.6, Math.atan2(uz, ux), wall, 3);
      }
    }
  }

  churchExtras(B, b, ob, H, wall, roofCol, seed, roof) {
    const { cx, cz, ux, uz, a, bb } = { cx: ob.cx, cz: ob.cz, ux: ob.ux, uz: ob.uz, a: ob.a, bb: ob.b };
    const vx = -uz, vz = ux;
    const minSide = Math.min(a, bb) * 2;
    const ridge = roof === 1 || roof === 2 ? Math.min(bb * 0.55, 3.2) : 0;
    const lead = lin(0x8d949a), stone = wall;
    if (b.flags & 16) { // mosque: dome + minaret
      const rd = Math.min(6, Math.max(2.5, minSide * 0.3));
      B.dome(cx, H + 0.2, cz, rd, lead, 1.0);
      const mx = cx + ux * (a - 1.4) + vx * (bb - 1.4), mz = cz + uz * (a - 1.4) + vz * (bb - 1.4);
      const mh = H + 20;
      B.cyl(mx, 0, mz, 1.25, 1.05, mh * 0.78, 12, stone, 3);
      B.cyl(mx, mh * 0.78, mz, 1.8, 1.8, 0.45, 12, stone, 3);
      B.cyl(mx, mh * 0.78 + 0.45, mz, 1.0, 0.95, mh * 0.16, 12, stone, 3);
      B.cyl(mx, mh * 0.94 + 0.45, mz, 1.05, 0.05, 4.2, 12, lead, 3);
      return;
    }
    // orthodox church: drum + dome over the centre, bell tower(s) at the west end
    const rd = Math.min(4.6, Math.max(1.7, minSide * 0.24));
    const dy = H + ridge * 0.7;
    B.cyl(cx, dy - 0.5, cz, rd, rd, 3.0, 16, stone, 0, 5, 1.3);
    const domeCol = (b.flags & 32) ? lin(0xc9c4b8) : (seed < 0.5 ? roofCol : lin(0xb8b2a6));
    B.dome(cx, dy + 2.5, cz, rd * 1.04, domeCol, 1.0);
    B.cyl(cx, dy + 2.5 + rd * 1.0, cz, 0.12, 0.05, 1.6, 6, lin(0xc8a24a), 3); // cross post
    const tw = Math.min(4.2, Math.max(2.2, minSide * 0.25));
    const towers = (b.flags & 32) ? [-1, 1] : [0];
    // west end = the end of the long axis pointing more to the west (-x)
    const sgn = ux < 0 ? 1 : -1;
    for (const side of towers) {
      const off = side === 0 ? 0 : side * (bb - tw / 2);
      const tx = cx + ux * sgn * (a - tw / 2) + vx * off, tz = cz + uz * sgn * (a - tw / 2) + vz * off;
      const th = H + ((b.flags & 32) ? 13 : 9);
      B.tower(tx, tz, tw, th, Math.atan2(uz, ux), stone, 5);
      B.cyl(tx, th, tz, tw * 0.42, tw * 0.42, 1.4, 12, stone, 3);
      B.dome(tx, th + 1.4, tz, tw * 0.45, lin(0xd5d0c6), 1.0);
    }
  }

  // ---------------------------------------------------------------- details (balconies, roof heaters, awnings, props)
  buildDetail(ci) {
    const grp = new THREE.Group(); grp.name = 'detail' + ci;
    this.details.set(ci, grp); this.detailVersion++;
    const D = new GeoBuf(true);
    const P = this.props;
    const inst = { swh: [], lamp: [], car: [], umb: [], bed: [], yacht: [], sail: [], ac: [], tank: [] };
    {
      const c = chunk(this.data, ci);
      const R = this.raster(ci);
      R.colliders = null;
      for (const b of c.buildings) this.buildingDetails(D, inst, b, ci);
      this.streetProps(inst, c, R);
      this.beachProps(inst, c, R);
      this.boatProps(inst, c, R);
    }
    if (D.count) {
      const m = new THREE.Mesh(D.geometry(), this.mats.detail);
      m.castShadow = true; m.receiveShadow = true; grp.add(m);
    }
    grp.userData.parked = inst.car;
    for (const k in inst) {
      const list = inst[k]; if (k === 'car' || !list.length || !P[k]) continue;
      const im = new THREE.InstancedMesh(P[k].geo, P[k].mat, list.length);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
      const color = new THREE.Color();
      let hasCol = false;
      list.forEach((it, i) => {
        e.set(0, it.ry, 0); q.setFromEuler(e); sc.setScalar(it.s || 1); p.set(it.x, it.y || 0, it.z);
        mtx.compose(p, q, sc); im.setMatrixAt(i, mtx);
        if (it.c !== undefined) { color.set(it.c); im.setColorAt(i, color); hasCol = true; }
      });
      if (hasCol) im.instanceColor.needsUpdate = true;
      im.castShadow = k !== 'lamp'; im.receiveShadow = true; im.userData.sharedGeo = true;
      im.computeBoundingSphere();
      grp.add(im);
      if (P[k].geo2) {
        const im2 = new THREE.InstancedMesh(P[k].geo2, P[k].mat2, list.length);
        im2.instanceMatrix.copy(im.instanceMatrix); im2.userData.sharedGeo = true; im2.computeBoundingSphere();
        grp.add(im2);
      }
      if (k === 'lamp') this.addLampGlows(grp, list);
    }
    this.scene.add(grp);
  }

  addLampGlows(grp, list) {
    const n = list.length, p = new Float32Array(n * 3);
    list.forEach((it, i) => { p[i * 3] = it.x + Math.cos(it.ry) * 1.25; p[i * 3 + 1] = 6.8; p[i * 3 + 2] = it.z - Math.sin(it.ry) * 1.25; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, this.mats.glow);
    pts.renderOrder = 5; g.computeBoundingSphere();
    pts.visible = this.mats.glow.userData.on; pts.userData.isGlow = true;
    grp.add(pts);
    // warm light pools on the street below each lamp
    if (!this.poolGeo) { this.poolGeo = new THREE.PlaneGeometry(1, 1); this.poolGeo.rotateX(-Math.PI / 2); }
    const im = new THREE.InstancedMesh(this.poolGeo, this.mats.pool, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m.makeScale(13, 1, 13); m.setPosition(p[i * 3], 0.16, p[i * 3 + 2]); im.setMatrixAt(i, m); }
    im.computeBoundingSphere(); im.renderOrder = 4; im.userData.sharedGeo = true; im.userData.isGlow = true;
    im.visible = this.mats.glow.userData.on;
    grp.add(im);
  }

  buildingDetails(D, inst, b, ci) {
    const seed = hash01(ci * 4099 + b.idx * 7 + 1);
    const outer = b.rings[0]; if (outer.length < 6) return;
    const style = b.style, lv = Math.max(1, b.lv), base = b.minH, H = b.H;
    if (base > 1.5 && H - base < 1.5) return;
    const area = Math.abs(ringArea(outer));
    const wall = this.walls[b.wall] || this.walls[0];
    let fh = (H - base - (lv > 1 ? 0.6 : 0.25)) / lv;
    if ((b.flags & 8) && H > 20) fh = (H - base) / lv;
    fh = Math.min(5.5, Math.max(2.6, fh));
    const k = outer.length / 2;
    // edges sorted by length
    const edges = [];
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k;
      const x1 = outer[2 * i], z1 = outer[2 * i + 1], x2 = outer[2 * j], z2 = outer[2 * j + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      edges.push({ x1, z1, x2, z2, len });
    }
    // balconies: on most sides of a Cypriot apartment block, often wrapping round the corners
    const tower = H > 35 && (style === 3 || style === 6);
    const apt = (style === 0 || style === 6) && (b.flags & 4) && lv >= 2 && !tower;
    if (apt && this.q.balconies) {
      const minLen = style === 6 ? 3 : 4;
      const es = edges.filter((e) => e.len >= minLen).sort((a, b2) => b2.len - a.len).slice(0, style === 6 ? 6 : 4);
      const depth = style === 6 ? 1.8 : 1.35;
      const r = hash01(ci * 7 + b.idx * 13 + 5);
      const railKind = style === 6 ? 2 : r < 0.55 ? 0 : r < 0.8 ? 1 : 2;
      const wrap = style === 6 || seed < 0.4;
      const slabCol = style === 6 ? lin(0xf4f4f2) : wall.clone().multiplyScalar(1.02);
      es.forEach((e, ei) => {
        if (!wrap && ei >= 2 && hash01(ci + b.idx * 3 + ei) < 0.4) return;
        const ux = (e.x2 - e.x1) / e.len, uz = (e.z2 - e.z1) / e.len, nx = uz, nz = -ux;
        const t0 = wrap ? 0 : 0.1 + seed * 0.1, t1 = wrap ? 1 : 0.86 - seed * 0.08;
        const ax = e.x1 + ux * e.len * t0, az = e.z1 + uz * e.len * t0, bx = e.x1 + ux * e.len * t1, bz = e.z1 + uz * e.len * t1;
        for (let f = 1; f < lv; f++) {
          const y = base + f * fh;
          if (y > H - 1.5) break;
          D.slab(ax, az, bx, bz, nx, nz, depth, y - 0.18, y, slabCol);
          if (railKind === 0) D.rail(ax, az, bx, bz, nx, nz, depth, y, 1.0, wall.clone().multiplyScalar(0.98));
          else if (railKind === 1) D.rail(ax, az, bx, bz, nx, nz, depth, y, 1.0, lin(0x4a4d50));
          else D.rail(ax, az, bx, bz, nx, nz, depth, y, 1.05, lin(0xa9c3cf));
        }
      });
    }
    // air-conditioning units under the windows (everywhere in Cyprus)
    if (this.q.balconies && (style === 0 || style === 1 || style === 2 || style === 6 || style === 7) && base < 0.5) {
      let n = 0;
      edges.forEach((e, ei) => {
        if (e.len < 3) return;
        const ux = (e.x2 - e.x1) / e.len, uz = (e.z2 - e.z1) / e.len, nx = uz, nz = -ux;
        for (let f = (b.flags & 3) ? 1 : 0; f < Math.min(lv, 14) && n < 28; f++) {
          const h = hash01(ci * 977 + b.idx * 31 + ei * 7 + f * 3);
          if (h > (style === 1 || style === 2 ? 0.35 : 0.5)) continue;
          const t = 0.15 + 0.7 * hash01(ci + b.idx * 5 + ei * 11 + f * 17);
          inst.ac.push({ x: e.x1 + ux * e.len * t + nx * 0.02, y: base + f * fh + (f ? 0.25 : 2.3), z: e.z1 + uz * e.len * t + nz * 0.02, ry: Math.atan2(nx, nz) });
          n++;
        }
      });
    }
    // shop awnings
    if ((b.flags & 1) && base < 0.5 && this.q.balconies) {
      const pal = [0x8c2d2a, 0x2f5d43, 0x2d4a73, 0xd8c8a0, 0xb8622a, 0x5a3b5e, 0x3a3a3a, 0xe6e2d8];
      edges.forEach((e, i) => {
        if (e.len < 3.5 || hash01(ci * 131 + b.idx * 17 + i) > 0.55) return;
        const ux = (e.x2 - e.x1) / e.len, uz = (e.z2 - e.z1) / e.len, nx = uz, nz = -ux;
        const ax = e.x1 + ux * e.len * 0.08, az = e.z1 + uz * e.len * 0.08, bx = e.x2 - ux * e.len * 0.08, bz = e.z2 - uz * e.len * 0.08;
        D.awning(ax, az, bx, bz, nx, nz, 1.35, 2.95, 2.45, lin(pal[Math.floor(hash01(b.idx * 3 + ci) * pal.length)]));
      });
    }
    // flat roof: parapet + solar water heaters (a Cyprus classic)
    if ((b.roof === 0) && style !== 3 && style !== 5 && style !== 8 && H < 70) {
      if (lv >= 2) for (const r of b.rings) D.parapet(r, H, 0.55, 0.18, wall);
      const isHome = style === 1 || style === 2 || style === 0 || style === 6 || style === 9 || style === 7;
      if (isHome && this.q.roofProps) {
        const n = Math.max(1, Math.min(5, Math.round(area / (style === 1 ? 200 : 110))));
        const ob = obb(outer);
        const pts = [];
        const step = 2.6;
        for (let u = -ob.a + 1.6; u <= ob.a - 1.6 && pts.length < n; u += step) {
          for (let v = -ob.b + 1.4; v <= ob.b - 1.4 && pts.length < n; v += 2.2) {
            const x = ob.cx + ob.ux * u - ob.uz * v, z = ob.cz + ob.uz * u + ob.ux * v;
            if (pointInRing(outer, x, z) && distToRing(outer, x, z) > 1.0) pts.push([x, z]);
          }
        }
        for (const [x, z] of pts) inst.swh.push({ x, y: H, z, ry: (hash01(Math.floor(x * 10) + Math.floor(z * 7)) - 0.5) * 0.3 });
      }
      if (this.q.roofProps && lv >= 3 && (style === 0 || style === 6 || style === 7)) {
        const ob = obb(outer);
        const u = ob.a - 2.0, cx = ob.cx + ob.ux * u, cz = ob.cz + ob.uz * u;
        if (ob.a > 4 && ob.b > 2.6 && pointInRing(outer, cx, cz)) {
          const w = 1.6, d = Math.min(2.0, ob.b - 0.6), vx = -ob.uz, vz = ob.ux;
          const P = (a2, b2) => [cx + ob.ux * a2 + vx * b2, cz + ob.uz * a2 + vz * b2];
          D.prism([P(-w, -d), P(w, -d), P(w, d), P(-w, d)], H, H + 2.7, wall.clone().multiplyScalar(0.97));
          const nt = 1 + Math.floor(hash01(b.idx * 7 + ci) * 3);
          for (let i = 0; i < nt; i++) { const q = P(-w - 0.9, -d + 0.4 + i * 1.15); inst.tank.push({ x: q[0], y: H, z: q[1], ry: 0, c: hash01(i + b.idx) < 0.6 ? 0xeeeeea : 0x2a2a2a }); }
        }
      }
    }
  }

  streetProps(inst, c, R) {
    const W = this.g.cs, ras = R.ras;
    const at = (x, z) => { const cx = Math.floor(x - R.ox), cz = Math.floor(z - R.oz); if (cx < 0 || cz < 0 || cx >= W || cz >= W) return -1; return ras[cz * W + cx]; };
    // OSM street lamps
    for (let i = 0; i < c.points.length; i += 3) if (c.points[i + 2] === 0) inst.lamp.push({ x: c.points[i], z: c.points[i + 1], ry: hash01(i) * 6.28 });
    let li = 0;
    for (const rd of c.roads) {
      if (rd.path) continue;
      const lampRoad = rd.cls >= 3 && rd.cls <= 6;
      const carRoad = (rd.cls === 5 || rd.cls === 6 || rd.cls === 4) && rd.w >= 5.2;
      if (!lampRoad && !carRoad) continue;
      const p = rd.pts; const n = p.length / 2;
      let acc = 0;
      for (let i = 0; i + 1 < n; i++) {
        const x1 = p[2 * i], z1 = p[2 * i + 1], x2 = p[2 * i + 2], z2 = p[2 * i + 3];
        const L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.5) continue;
        const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux;
        // lamps every ~34 m, alternating sides, on the sidewalk
        if (lampRoad && this.q.roofProps) {
          for (let t = (34 - acc % 34) % 34; t < L; t += 34) {
            const side = (li++ % 2) ? 1 : -1;
            const off = rd.w / 2 + (rd.sw > 0.5 ? Math.min(rd.sw * 0.7, 1.4) : 0.6);
            const x = x1 + ux * t + nx * off * side, z = z1 + uz * t + nz * off * side;
            const s = at(x, z);
            if (s === 12 || s === 0 || s === 8) continue;
            inst.lamp.push({ x, z, ry: Math.atan2(-(-nz * side), -nx * side) });
          }
        }
        // parked cars along the kerb
        if (carRoad && this.q.cars) {
          const step = 6.2;
          for (let t = 4 + (acc % step); t < L - 4; t += step) {
            for (const side of [-1, 1]) {
              const hsh = hash01(Math.floor((x1 + ux * t) * 3) * 92821 + Math.floor((z1 + uz * t) * 3) * 68917 + side);
              if (hsh > (rd.cls === 6 ? 0.5 : 0.32)) continue;
              const type = pickCarType(hash01(Math.floor((x1 + ux * t) * 5) * 7919 + Math.floor((z1 + uz * t) * 5) * 104729 + side * 3));
              const T = CAR_TYPES[type], cc = carCircles(type);
              const off = rd.w / 2 - T.W / 2 - 0.08;
              const x = x1 + ux * t + nx * off * side, z = z1 + uz * t + nz * off * side;
              const sA = at(x + ux * (T.L / 2), z + uz * (T.L / 2)), sB = at(x - ux * (T.L / 2), z - uz * (T.L / 2)), sC = at(x, z);
              if (sA !== 5 || sB !== 5 || sC !== 5) continue;
              const ry = Math.atan2(-uz, ux) + (side > 0 ? Math.PI : 0) * (hsh < 0.1 ? 1 : 0);
              inst.car.push({ x, z, ry, t: type, c: CAR_COLOURS[Math.floor(hash01(Math.floor(x * 7) ^ Math.floor(z * 13)) * CAR_COLOURS.length)] });
              R.colliders = R.colliders || [];
              R.colliders.push(x + ux * cc.off, z + uz * cc.off, cc.r, x - ux * cc.off, z - uz * cc.off, cc.r);
            }
          }
        }
        acc += L;
      }
    }
  }

  beachProps(inst, c, R) {
    if (!this.q.roofProps) return;
    const CL = this.CL;
    const W = this.g.cs;
    for (const gp of c.ground) {
      if (gp.cls !== CL.SAND) continue;
      const r = gp.rings[0];
      let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
      for (let i = 0; i < r.length; i += 2) { minx = Math.min(minx, r[i]); maxx = Math.max(maxx, r[i]); minz = Math.min(minz, r[i + 1]); maxz = Math.max(maxz, r[i + 1]); }
      const colA = hash01(Math.floor(minx) * 31 + Math.floor(minz)) < 0.5 ? 0x2a6fb5 : 0xe8742a;
      for (let x = Math.ceil(minx / 6) * 6; x < maxx; x += 6) for (let z = Math.ceil(minz / 7) * 7; z < maxz; z += 7) {
        const h = hash01(Math.floor(x) * 7919 + Math.floor(z) * 104729);
        if (h > 0.42) continue;
        const cx = Math.floor(x - R.ox), cz = Math.floor(z - R.oz);
        if (cx < 2 || cz < 2 || cx >= W - 2 || cz >= W - 2) continue;
        const v = R.ras[cz * W + cx];
        if (v !== 4) continue;
        // keep a few metres from the water
        let wet = false;
        for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) { const xx = cx + dx, zz = cz + dz; if (xx >= 0 && zz >= 0 && xx < W && zz < W && R.ras[zz * W + xx] === 0) wet = true; }
        if (wet) continue;
        const ry = h * 40;
        inst.umb.push({ x, z, ry, c: (h * 100 | 0) % 3 === 0 ? 0xf4f1ea : colA });
        inst.bed.push({ x: x + 0.9, z: z + 0.3, ry: 0.1 }, { x: x - 0.9, z: z + 0.3, ry: -0.05 });
      }
    }
  }

  boatProps(inst, c, R) {
    const CL = this.CL, W = this.g.cs;
    const at = (x, z) => { const cx = Math.floor(x - R.ox), cz = Math.floor(z - R.oz); if (cx < 0 || cz < 0 || cx >= W || cz >= W) return -2; return R.ras[cz * W + cx]; };
    for (const gp of c.ground) {
      if (gp.cls !== CL.PIER) continue;
      for (const r of gp.rings) {
        const k = r.length / 2;
        for (let i = 0; i < k; i++) {
          const j = (i + 1) % k;
          const x1 = r[2 * i], z1 = r[2 * i + 1], x2 = r[2 * j], z2 = r[2 * j + 1];
          const L = Math.hypot(x2 - x1, z2 - z1); if (L < 5) continue;
          const ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = uz, nz = -ux;
          for (let t = 3; t < L - 3; t += 5.2) {
            const h = hash01(Math.floor((x1 + ux * t) * 5) * 7 + Math.floor((z1 + uz * t) * 5) * 13);
            if (h > 0.8) continue;
            const len = 9 + h * 9;
            const bx = x1 + ux * t + nx * (len / 2 + 1.2), bz = z1 + uz * t + nz * (len / 2 + 1.2);
            if (at(bx, bz) !== 0 || at(bx + nx * len * 0.5, bz + nz * len * 0.5) !== 0 || at(bx - nx * len * 0.45, bz - nz * len * 0.45) !== 0) continue;
            const ry = Math.atan2(-nz, nx);
            (h < 0.35 ? inst.sail : inst.yacht).push({ x: bx, y: WATER_Y, z: bz, ry, s: len / 12 });
          }
        }
      }
    }
  }
}

// ======================================================================= geometry helpers
function ringArea(r) { let s = 0; const k = r.length / 2; for (let i = 0; i < k; i++) { const j = (i + 1) % k; s += r[2 * i] * r[2 * j + 1] - r[2 * j] * r[2 * i + 1]; } return s / 2; }
export function pointInRing(r, x, z) {
  let ins = false; const k = r.length / 2;
  for (let i = 0, j = k - 1; i < k; j = i++) {
    const xi = r[2 * i], zi = r[2 * i + 1], xj = r[2 * j], zj = r[2 * j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
function distToRing(r, x, z) {
  let d = 1e9; const k = r.length / 2;
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k; const ax = r[2 * i], az = r[2 * i + 1], bx = r[2 * j], bz = r[2 * j + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return d;
}
// minimum-area oriented box: centre, long axis u, half sizes a >= b
function obb(r) {
  const k = r.length / 2; let best = null;
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k; let ux = r[2 * j] - r[2 * i], uz = r[2 * j + 1] - r[2 * i + 1]; const l = Math.hypot(ux, uz); if (l < 0.5) continue;
    ux /= l; uz /= l; const vx = -uz, vz = ux;
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (let m = 0; m < k; m++) { const pu = r[2 * m] * ux + r[2 * m + 1] * uz, pv = r[2 * m] * vx + r[2 * m + 1] * vz; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ux, uz, vx, vz, u0, u1, v0, v1 };
  }
  if (!best) return { cx: r[0], cz: r[1], ux: 1, uz: 0, a: 1, b: 1 };
  const cu = (best.u0 + best.u1) / 2, cv = (best.v0 + best.v1) / 2;
  let a = (best.u1 - best.u0) / 2, b = (best.v1 - best.v0) / 2, ux = best.ux, uz = best.uz;
  const cx = best.ux * cu + best.vx * cv, cz = best.uz * cu + best.vz * cv;
  if (b > a) { const t = a; a = b; b = t; const nx = best.vx, nz = best.vz; ux = nx; uz = nz; }
  return { cx, cz, ux, uz, a, b };
}

function fillRings(ras, W, rings, ox, oz, val) {
  let zmin = 1e9, zmax = -1e9;
  for (const r of rings) for (let i = 1; i < r.length; i += 2) { zmin = Math.min(zmin, r[i]); zmax = Math.max(zmax, r[i]); }
  const r0 = Math.max(0, Math.ceil(zmin - oz - 0.5)), r1 = Math.min(W - 1, Math.floor(zmax - oz - 0.5));
  const xs = [];
  for (let row = r0; row <= r1; row++) {
    const zc = oz + row + 0.5; xs.length = 0;
    for (const r of rings) {
      const k = r.length / 2;
      for (let i = 0, j = k - 1; i < k; j = i++) {
        const zi = r[2 * i + 1], zj = r[2 * j + 1];
        if ((zi > zc) !== (zj > zc)) { const xi = r[2 * i], xj = r[2 * j]; xs.push(xi + (zc - zi) * (xj - xi) / (zj - zi)); }
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const c0 = Math.max(0, Math.ceil(xs[q] - ox - 0.5)), c1 = Math.min(W - 1, Math.floor(xs[q + 1] - ox - 0.5));
      for (let cc = c0; cc <= c1; cc++) ras[row * W + cc] = val;
    }
  }
}

function addPolygon(G, rings, y, col, tile, scale) {
  const flat = [], holes = [];
  for (let i = 0; i < rings.length; i++) { if (i) holes.push(flat.length / 2); const r = rings[i]; for (let j = 0; j < r.length; j++) flat.push(r[j]); }
  const tri = earcut(flat, holes.length ? holes : null);
  if (!tri.length) return;
  const base = G.count;
  for (let i = 0; i < flat.length; i += 2) G.v(flat[i], y, flat[i + 1], 0, 1, 0, col, tile, scale);
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i], b = tri[i + 1], c = tri[i + 2];
    const cy = (flat[2 * b + 1] - flat[2 * a + 1]) * (flat[2 * c] - flat[2 * a]) - (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]);
    if (cy < 0) G.tri(base + a, base + c, base + b); else G.tri(base + a, base + b, base + c);
  }
}
function addCurb(G, r, y0, y1, col, ox, oz, cs, tile) {
  const k = r.length / 2; const E = 0.06;
  for (let i = 0; i < k; i++) {
    const j = (i + 1) % k;
    const x1 = r[2 * i], z1 = r[2 * i + 1], x2 = r[2 * j], z2 = r[2 * j + 1];
    // skip edges lying on the chunk border (polygons are clipped to chunks)
    if ((Math.abs(x1 - x2) < E && (Math.abs(x1 - ox) < E || Math.abs(x1 - ox - cs) < E)) || (Math.abs(z1 - z2) < E && (Math.abs(z1 - oz) < E || Math.abs(z1 - oz - cs) < E))) continue;
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz); if (L < 0.02) continue;
    const nx = dz / L, nz = -dx / L;
    const b = G.count;
    G.v(x1, y0, z1, nx, 0, nz, col, tile, 2); G.v(x2, y0, z2, nx, 0, nz, col, tile, 2); G.v(x2, y1, z2, nx, 0, nz, col, tile, 2); G.v(x1, y1, z1, nx, 0, nz, col, tile, 2);
    G.tri(b, b + 2, b + 1); G.tri(b, b + 3, b + 2);
  }
}
function addMarkings(M, rd) {
  const p = rd.pts, n = p.length / 2;
  const white = lin(0xf0efe8), yellow = lin(0xe8c23a);
  if (rd.path) {
    if (!(rd.flags & 8)) return;
    // zebra crossing: bars along the road, spaced along the crossing line
    for (let i = 0; i + 1 < n; i++) {
      const x1 = p[2 * i], z1 = p[2 * i + 1], x2 = p[2 * i + 2], z2 = p[2 * i + 3];
      const L = Math.hypot(x2 - x1, z2 - z1); if (L < 2) continue;
      const ux = (x2 - x1) / L, uz = (z2 - z1) / L, vx = uz, vz = -ux;
      for (let t = 1.0; t < L - 0.8; t += 1.0) {
        const cx = x1 + ux * t, cz = z1 + uz * t;
        quad(M, cx - ux * 0.25 - vx * 1.5, cz - uz * 0.25 - vz * 1.5, cx + ux * 0.25 - vx * 1.5, cz + uz * 0.25 - vz * 1.5, cx + ux * 0.25 + vx * 1.5, cz + uz * 0.25 + vz * 1.5, cx - ux * 0.25 + vx * 1.5, cz - uz * 0.25 + vz * 1.5, white);
      }
    }
    return;
  }
  if (rd.cls < 1 || rd.cls > 6) return;
  const center = !(rd.flags & 1) && rd.w >= 5.4;
  const edge = rd.cls >= 3 && rd.cls <= 5;
  let acc = 0;
  for (let i = 0; i + 1 < n; i++) {
    const x1 = p[2 * i], z1 = p[2 * i + 1], x2 = p[2 * i + 2], z2 = p[2 * i + 3];
    const L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.2) continue;
    const ux = (x2 - x1) / L, uz = (z2 - z1) / L, vx = uz, vz = -ux;
    if (center) {
      const DASH = rd.cls <= 3 ? 4 : 3, GAP = rd.cls <= 3 ? 5 : 6, P = DASH + GAP;
      let t = -(acc % P);
      for (; t < L; t += P) {
        const a = Math.max(0, t), b = Math.min(L, t + DASH); if (b - a < 0.3) continue;
        const w = 0.07;
        quad(M, x1 + ux * a - vx * w, z1 + uz * a - vz * w, x1 + ux * b - vx * w, z1 + uz * b - vz * w, x1 + ux * b + vx * w, z1 + uz * b + vz * w, x1 + ux * a + vx * w, z1 + uz * a + vz * w, white);
      }
    }
    if (edge && L > 1) {
      for (const s of [-1, 1]) {
        const o = rd.w / 2 - 0.3;
        const ax = x1 + vx * o * s, az = z1 + vz * o * s, bx = x2 + vx * o * s, bz = z2 + vz * o * s, w = 0.05;
        quad(M, ax - vx * w, az - vz * w, bx - vx * w, bz - vz * w, bx + vx * w, bz + vz * w, ax + vx * w, az + vz * w, yellow);
      }
    }
    acc += L;
  }
}
function quad(M, ax, az, bx, bz, cx, cz, dx, dz, col) {
  const b = M.count, y = 0.012;
  M.v(ax, y, az, 0, 1, 0, col, 0, 6); M.v(bx, y, bz, 0, 1, 0, col, 0, 6); M.v(cx, y, cz, 0, 1, 0, col, 0, 6); M.v(dx, y, dz, 0, 1, 0, col, 0, 6);
  // face up whichever way the quad winds
  const cyv = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
  if (cyv > 0) { M.tri(b, b + 1, b + 2); M.tri(b, b + 2, b + 3); } else { M.tri(b, b + 2, b + 1); M.tri(b, b + 3, b + 2); }
}

// vertex buffer for ground-like meshes (pos, normal, colour, detail(tile, scale))
class GeoBuf {
  constructor(noDet = false) { this.p = []; this.n = []; this.c = []; this.d = []; this.i = []; this.count = 0; this.noDet = noDet; }
  v(x, y, z, nx, ny, nz, col, tile, scale) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); this.d.push(tile, scale); return this.count++; }
  tri(a, b, c) { this.i.push(a, b, c); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (!this.noDet) g.setAttribute('aDet', new THREE.Float32BufferAttribute(this.d, 2));
    g.setIndex(this.count > 65000 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  // a box between two wall points, sticking out along n (balcony slab)
  // balcony slab: top, underside, front and two ends (no back face: it touches the wall)
  slab(ax, az, bx, bz, nx, nz, depth, y0, y1, col) {
    const A = [ax, az], B = [bx, bz], FA = [ax + nx * depth, az + nz * depth], FB = [bx + nx * depth, bz + nz * depth];
    const T = (p, y) => [p[0], y, p[1]];
    this.quad3(T(A, y1), T(B, y1), T(FB, y1), T(FA, y1), col);                                   // top (up)
    this.quad3(T(A, y0), T(FA, y0), T(FB, y0), T(B, y0), col.clone().multiplyScalar(0.75));     // underside
    this.quad3(T(FA, y0), T(FA, y1), T(FB, y1), T(FB, y0), col.clone().multiplyScalar(0.92));   // front (out)
    this.quad3(T(A, y0), T(A, y1), T(FA, y1), T(FA, y0), col.clone().multiplyScalar(0.9));      // end at A
    this.quad3(T(FB, y0), T(FB, y1), T(B, y1), T(B, y0), col.clone().multiplyScalar(0.9));      // end at B
  }
  // balcony railing: a thin panel at the front edge, both faces
  rail(ax, az, bx, bz, nx, nz, depth, y, h, col) {
    const o = depth - 0.03, fa = [ax + nx * o, az + nz * o], fb = [bx + nx * o, bz + nz * o];
    const T = (p, yy) => [p[0], yy, p[1]];
    this.quad3(T(fa, y), T(fa, y + h), T(fb, y + h), T(fb, y), col);                             // outside
    this.quad3(T(fb, y), T(fb, y + h), T(fa, y + h), T(fa, y), col.clone().multiplyScalar(0.85)); // inside
  }
  awning(ax, az, bx, bz, nx, nz, depth, yTop, yLow, col) {
    const L = Math.hypot(bx - ax, bz - az);
    const pA = [ax, yTop, az], pB = [bx, yTop, bz], pC = [bx + nx * depth, yLow, bz + nz * depth], pD = [ax + nx * depth, yLow, az + nz * depth];
    this.quad3(pA, pB, pC, pD, col);
    this.quad3(pA, pD, pC, pB, col.clone().multiplyScalar(0.7)); // underside
    // valance
    const pE = [bx + nx * depth, yLow - 0.25, bz + nz * depth], pF = [ax + nx * depth, yLow - 0.25, az + nz * depth];
    this.quad3(pD, pC, pE, pF, col.clone().multiplyScalar(0.9));
    this.quad3(pD, pF, pE, pC, col.clone().multiplyScalar(0.6));
  }
  parapet(r, H, h, th, col) {
    const k = r.length / 2;
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k;
      const x1 = r[2 * i], z1 = r[2 * i + 1], x2 = r[2 * j], z2 = r[2 * j + 1];
      const L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.3) continue;
      const nx = (z2 - z1) / L, nz = -(x2 - x1) / L;
      // outer face continues the wall, inner face + top cap
      const o1 = [x1, H, z1], o2 = [x2, H, z2], o3 = [x2, H + h, z2], o4 = [x1, H + h, z1];
      const i1 = [x1 - nx * th, H, z1 - nz * th], i2 = [x2 - nx * th, H, z2 - nz * th], i3 = [x2 - nx * th, H + h, z2 - nz * th], i4 = [x1 - nx * th, H + h, z1 - nz * th];
      this.quad3(o1, o4, o3, o2, col);
      this.quad3(i1, i2, i3, i4, col.clone().multiplyScalar(0.92));
      this.quad3(o4, i4, i3, o3, col.clone().multiplyScalar(1.05));
    }
  }
  quad3(a, b, c, d, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    // normal = u x v ... we want front face CCW: use (a,b,c),(a,c,d) and normal from (b-a)x(d-a)
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const s = this.count;
    for (const p of [a, b, c, d]) this.v(p[0], p[1], p[2], nx, ny, nz, col, 0, 1);
    this.tri(s, s + 1, s + 2); this.tri(s, s + 2, s + 3);
  }
  // vertical prism from a footprint quad/polygon (CCW or CW handled)
  prism(pts, y0, y1, col) {
    const k = pts.length;
    let area = 0; for (let i = 0; i < k; i++) { const j = (i + 1) % k; area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
    const P = area < 0 ? pts.slice().reverse() : pts;
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k;
      const a = [P[i][0], y0, P[i][1]], b = [P[j][0], y0, P[j][1]], c = [P[j][0], y1, P[j][1]], d = [P[i][0], y1, P[i][1]];
      this.quad3(a, d, c, b, col);
    }
    // top & bottom (fan)
    const s = this.count;
    for (const p of P) this.v(p[0], y1, p[1], 0, 1, 0, col, 0, 1);
    for (let i = 1; i + 1 < k; i++) this.tri(s, s + i + 1, s + i);
    const t = this.count;
    for (const p of P) this.v(p[0], y0, p[1], 0, -1, 0, col.clone().multiplyScalar(0.8), 0, 1);
    for (let i = 1; i + 1 < k; i++) this.tri(t, t + i, t + i + 1);
  }
}

// vertex buffer for buildings: pos, normal, facade uv, tint, info(style col, ground row, seed, kind)
class BBuf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.t = []; this.f = []; this.i = []; this.count = 0; }
  v(x, y, z, nx, ny, nz, u, w, col, info) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.t.push(col.r, col.g, col.b); this.f.push(info[0], info[1], info[2], info[3]);
    return this.count++;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  wall(x1, z1, x2, z2, y0, y1, nMod, fh, col, scol, grow, seed, kind) {
    const L = Math.hypot(x2 - x1, z2 - z1);
    const nx = (z2 - z1) / L, nz = -(x2 - x1) / L;
    const info = [scol, grow, seed, kind];
    const v0 = 0, v1 = (y1 - y0) / fh;
    const s = this.count;
    this.v(x1, y0, z1, nx, 0, nz, 0, v0, col, info);
    this.v(x2, y0, z2, nx, 0, nz, nMod, v0, col, info);
    this.v(x2, y1, z2, nx, 0, nz, nMod, v1, col, info);
    this.v(x1, y1, z1, nx, 0, nz, 0, v1, col, info);
    this.tri(s, s + 2, s + 1); this.tri(s, s + 3, s + 2);
  }
  flat(rings, y, col, kind, down = false) {
    const flat = [], holes = [];
    for (let i = 0; i < rings.length; i++) { if (i) holes.push(flat.length / 2); for (let j = 0; j < rings[i].length; j++) flat.push(rings[i][j]); }
    const tri = earcut(flat, holes.length ? holes : null);
    if (!tri.length) return;
    const info = [0, 0, 0, kind];
    const s = this.count;
    for (let i = 0; i < flat.length; i += 2) this.v(flat[i], y, flat[i + 1], 0, down ? -1 : 1, 0, 0, 0, col, info);
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], c = tri[i + 2];
      const cy = (flat[2 * b + 1] - flat[2 * a + 1]) * (flat[2 * c] - flat[2 * a]) - (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]);
      if ((cy < 0) !== down) this.tri(s + a, s + c, s + b); else this.tri(s + a, s + b, s + c);
    }
  }
  face(pts, col, kind, info2 = null) { // planar polygon (convex), flat normal computed, CCW seen from outside
    const a = pts[0], b = pts[1], c = pts[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const s = this.count; const info = info2 || [0, 0, 0, kind];
    for (const p of pts) this.v(p[0], p[1], p[2], nx, ny, nz, p[3] || 0, p[4] || 0, col, info);
    for (let i = 1; i + 1 < pts.length; i++) this.tri(s, s + i, s + i + 1);
  }
  pitched(ob, H, roof, rc, wc) {
    const o = 0.35, { cx, cz, ux, uz } = ob; const vx = -uz, vz = ux;
    const a = ob.a + o, b = ob.b + o;
    const rh = Math.min(3.2, Math.max(1.2, ob.b * 0.55));
    const P = (u, v, y) => [cx + ux * u + vx * v, y, cz + uz * u + vz * v];
    const e = H - 0.12;
    const p1 = P(-a, -b, e), p2 = P(a, -b, e), p3 = P(a, b, e), p4 = P(-a, b, e);
    // faces listed CCW when seen from outside/above
    if (roof === 2) { // gable along u
      const r1 = P(-a, 0, H + rh), r2 = P(a, 0, H + rh);
      this.faceOut([p1, p2, r2, r1], rc, 2, cx, cz);
      this.faceOut([p3, p4, r1, r2], rc, 2, cx, cz);
      const g1 = P(-ob.a, -ob.b, H), g2 = P(-ob.a, ob.b, H), g3 = P(-ob.a, 0, H + rh * (ob.b / b));
      const g4 = P(ob.a, -ob.b, H), g5 = P(ob.a, ob.b, H), g6 = P(ob.a, 0, H + rh * (ob.b / b));
      this.faceOut([g1, g2, g3], wc, 3, cx, cz);
      this.faceOut([g4, g5, g6], wc, 3, cx, cz);
    } else if (roof === 1 && a - b > 0.3) { // hip
      const d = b;
      const r1 = P(-a + d, 0, H + rh), r2 = P(a - d, 0, H + rh);
      this.faceOut([p1, p2, r2, r1], rc, 2, cx, cz);
      this.faceOut([p3, p4, r1, r2], rc, 2, cx, cz);
      this.faceOut([p2, p3, r2], rc, 2, cx, cz);
      this.faceOut([p4, p1, r1], rc, 2, cx, cz);
    } else { // pyramid
      const t = P(0, 0, H + rh);
      this.faceOut([p1, p2, t], rc, 2, cx, cz); this.faceOut([p2, p3, t], rc, 2, cx, cz);
      this.faceOut([p3, p4, t], rc, 2, cx, cz); this.faceOut([p4, p1, t], rc, 2, cx, cz);
    }
    // underside of the eaves
    this.faceOut([p4, p3, p2, p1].map((p) => [p[0], p[1] - 0.001, p[2]]), wc.clone().multiplyScalar(0.7), 3, cx, cz, true);
  }
  // add a face, flipping its winding so the normal points away from (cx, cz) / up
  faceOut(pts, col, kind, cx, cz, down = false) {
    const a = pts[0], b = pts[1], c = pts[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    let mx = 0, mz = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; mz += p[2]; } mx /= pts.length; mz /= pts.length;
    let out = (mx - cx) * nx + (mz - cz) * nz;
    if (Math.abs(ny) > 0.3 && Math.abs(out) < 1e-6) out = ny;
    if (down) out = -ny;
    else if (Math.abs(nx) + Math.abs(nz) < 1e-3) out = ny;
    this.face(out >= 0 ? pts : pts.slice().reverse(), col, kind);
  }
  box(cx, y0, cz, w, h, d, ang, col, kind) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = (u, v, y) => [cx + c * u - s * v, y, cz + s * u + c * v];
    const hw = w / 2, hd = d / 2;
    const b = [P(-hw, -hd, y0), P(hw, -hd, y0), P(hw, hd, y0), P(-hw, hd, y0)], t = b.map((p) => [p[0], y0 + h, p[2]]);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.faceOut([b[i], b[j], t[j], t[i]], col, kind, cx, cz); }
    this.faceOut([t[0], t[1], t[2], t[3]], col, kind, cx, cz);
  }
  tower(cx, cz, w, h, ang, col, scol) {
    const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2;
    const P = (u, v) => [cx + c * u - s * v, cz + s * u + c * v];
    const pts = [P(-hw, -hw), P(hw, -hw), P(hw, hw), P(-hw, hw)];
    let area = 0; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
    const R = area < 0 ? pts.slice().reverse() : pts;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.wall(R[i][0], R[i][1], R[j][0], R[j][1], 0, h, 1, 3.6, col, scol, 1, 0.5, 0);
    }
    this.flat([new Float32Array(R.flat())], h, col, 3);
  }
  cyl(cx, y0, cz, r0, r1, h, seg, col, kind, scol = 0, fh = 0) {
    const info = [scol, 0, 0.3, kind];
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const nm = (a0 + a1) / 2; const nx = Math.cos(nm), nz = Math.sin(nm);
      const s = this.count;
      const uw = fh ? 1 : 0, vh = fh ? h / fh : 0;
      this.v(cx + c0 * r0, y0, cz + s0 * r0, nx, 0, nz, 0, 0, col, info);
      this.v(cx + c1 * r0, y0, cz + s1 * r0, nx, 0, nz, uw, 0, col, info);
      this.v(cx + c1 * r1, y0 + h, cz + s1 * r1, nx, 0, nz, uw, vh, col, info);
      this.v(cx + c0 * r1, y0 + h, cz + s0 * r1, nx, 0, nz, 0, vh, col, info);
      this.tri(s, s + 2, s + 1); this.tri(s, s + 3, s + 2);
    }
    // cap
    const s = this.count;
    this.v(cx, y0 + h, cz, 0, 1, 0, 0, 0, col, [0, 0, 0, 3]);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; this.v(cx + Math.cos(a) * r1, y0 + h, cz + Math.sin(a) * r1, 0, 1, 0, 0, 0, col, [0, 0, 0, 3]); }
    for (let i = 0; i < seg; i++) this.tri(s, s + i + 2, s + i + 1);
  }
  dome(cx, y0, cz, r, col, squash) {
    const seg = 16, rings = 6, info = [0, 0, 0, 4];
    const s = this.count;
    for (let j = 0; j <= rings; j++) {
      const ph = j / rings * Math.PI / 2; const y = Math.sin(ph) * r * squash, rr = Math.cos(ph) * r;
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2; const nx = Math.cos(a) * Math.cos(ph), ny = Math.sin(ph), nz = Math.sin(a) * Math.cos(ph);
        this.v(cx + Math.cos(a) * rr, y0 + y, cz + Math.sin(a) * rr, nx, ny, nz, 0, 0, col, info);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = s + j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      this.tri(a, c, b); this.tri(b, c, d);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aFac', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.t, 3));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.f, 4));
    g.setIndex(this.count > 65000 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

function disposeGroup(g) {
  g.traverse((o) => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
}
export { obb, ringArea };
