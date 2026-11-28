// Procedural neon city: buildings, ground, signs, billboards, lamps, sky lanes + collision.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, windowTexture, groundTexture, signTexture, Billboard, glowTexture, skyTexture, brickTextures, megaTextures, corpTextures, classicTextures } from './textures.js';
import { Parts } from './models.js';
import { modelNode, modelNames, flatten } from './assets.js';
import { zoneOf, megablock, corpTower, stackTower, marketLots, marketStreet, roofBillboard, streetCables, MAT_MEGA } from './megacity.js';
import { buildHighways, rampSegments, HighwayTraffic, HIGHWAYS } from './highway.js';
import { AdScreens, Holograms } from './ads.js';

// ---------- Blender towers and rooftop props (public/models/buildings.glb) ----------
const isGlow = m => m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.001;
const sortBuilding = m => (m.name.startsWith('win') ? 'body' : m.name.startsWith('n_tc') ? 'tc' : isGlow(m) ? 'trim' : 'detail');
let HEROES = null, PROPS = null;
function heroes() {
  if (HEROES) return HEROES;
  HEROES = [];
  for (const name of modelNames('buildings', 'twr_')) {
    if (/_col\d+$/.test(name)) continue;
    const g = flatten(modelNode('buildings', name), sortBuilding, { uv: true });
    if (!g.body) continue;
    const bb = new THREE.Box3();
    for (const k in g) { g[k].computeBoundingBox(); bb.union(g[k].boundingBox); }
    const cols = [];
    for (let k = 0; ; k++) {
      const c = modelNode('buildings', `${name}_col${k}`); if (!c) break;
      cols.push([c.position.x, c.position.y, c.position.z, Math.abs(c.scale.x), Math.abs(c.scale.y), Math.abs(c.scale.z)]);
    }
    // footprint = the base of the facade (towers may overhang a little higher up)
    const fb = new THREE.Box3(), p = g.body.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y < 2) fb.expandByPoint(v); }
    HEROES.push({ name, g, w: fb.max.x - fb.min.x, d: fb.max.z - fb.min.z, top: bb.max.y, cols, used: 0 });
  }
  return HEROES;
}
function props() {
  if (PROPS) return PROPS;
  PROPS = {};
  for (const name of modelNames('buildings', 'prop_')) PROPS[name.slice(5)] = flatten(modelNode('buildings', name), sortBuilding);
  return PROPS;
}
const _M = new THREE.Matrix4();

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const { CELL, ROAD, N, HALF } = CITY;
export const roadC = i => -HALF + i * CELL; // road centre coordinate
export const LANE = 4.5;
export const BOUNDS = HALF + 6;
const SIGN_TEXTS = [
  ['KAIJU RAMEN', '#ff2bd6'], ['HOLO-BANK', '#29f3ff'], ['NEO WALL ST', '#ffa43a'], ['BROOKLYN 3000', '#8a4dff'],
  ['SYNTH CITY', '#29f3ff'], ['ROBO TAXI', '#ffd23a'], ['CLUB 3000', '#ff1e3c'], ['QUANTUM BURGER', '#ffa43a'],
  ['CHROME DOLLS', '#ff2bd6'], ['NEURAL LINK BAR', '#3aff9a'], ['24/7 HOLOSHOW', '#29f3ff'], ['CYBER DELI', '#ff1e3c'],
  ['ARCADE 9', '#3aff9a'], ['NOODLE BOTS', '#ffa43a'], ['PLASMA PIZZA', '#ff2bd6'], ['NYC 3000', '#29f3ff'],
  ['PLASMA ARMS', '#ff7a2a'], ['IRON & NEON GUNS', '#ff7a2a'], ['CHROME CLINIC', '#3aff9a'], ['CYBER DOC', '#3aff9a'],
];
export const GUN_SHOPS = new Set(['PLASMA ARMS', 'IRON & NEON GUNS']);
export const CLINICS = new Set(['CHROME CLINIC', 'CYBER DOC']);
const HOTEL_NAMES = ['HOTEL 3000', 'GRAND NEON HOTEL', 'SKYLINE HOTEL', 'HOTEL AURORA', 'THE MIDTOWN', 'HOTEL LUNA'];
export const DOORS_PER_BUILDING = 5;
const DOOR_W = 1.7;
const VERT_TEXTS = [['ホテル', '#ff2bd6'], ['OPEN', '#3aff9a'], ['BAR', '#29f3ff'], ['ラーメン', '#ffa43a'], ['NEON', '#ff1e3c'], ['CLUB', '#8a4dff']];

export class City {
  constructor(scene, rngSeed = 3000) {
    this.scene = scene;
    this.rng = mulberry32(rngSeed);
    this.boxes = []; // {x0,x1,z0,z1,y0,y1}
    this.grid = new Map();
    this.chunks = [];
    this.billboards = [];
    this.animated = [];
    this.root = new THREE.Group();
    scene.add(this.root);
    this.glowTex = glowTexture();
    this.windowMats = [
      ['#bfe8ff', '#29f3ff', '#6aa8ff', '#ffffff', '#ffd9a0'],
      ['#ff7ae0', '#c58bff', '#ff2bd6', '#ffd0f5', '#7a8bff'],
      ['#ffd27a', '#ffb05a', '#fff2d0', '#ff8a5a', '#9fe9ff'],
    ].map(p => {
      const t = windowTexture(p);
      return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.95, vertexColors: true });
    });
    const [brick, brickE] = brickTextures();
    this.windowMats.push(new THREE.MeshLambertMaterial({ map: brick, emissiveMap: brickE, emissive: 0xffffff, emissiveIntensity: 1.0, vertexColors: true }));
    // 4: megabuilding concrete, 5: corporate glass
    const [mega, megaE] = megaTextures(), [corp, corpE] = corpTextures();
    this.windowMats.push(new THREE.MeshLambertMaterial({ map: mega, emissiveMap: megaE, emissive: 0xffffff, emissiveIntensity: 1.0, vertexColors: true }));
    this.windowMats.push(new THREE.MeshLambertMaterial({ map: corp, emissiveMap: corpE, emissive: 0xffffff, emissiveIntensity: 1.1, vertexColors: true }));
    // 6: classic Manhattan stone (tinted beige / tan / brown / grey per building)
    const [stone, stoneE] = classicTextures();
    this.windowMats.push(new THREE.MeshLambertMaterial({ map: stone, emissiveMap: stoneE, emissive: 0xffffff, emissiveIntensity: 1.0, vertexColors: true }));
    this.trimMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.detailMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.lots = [];
    this.signGeos = new Map(); // key -> {tex, geos[]}
    this.decals = [];
    this.doors = []; this.doorGrid = new Map();
    // Night-City extras: ad screens, hologram spots, megabuildings, corporate towers, highway ramps
    this.stalls = []; // night-market food stalls (activities.js)
    this.adSpots = []; this.holoSpots = []; this.megas = []; this.corps = []; this.ramps = [];
    this.blocked = new Set(); // road segments ground traffic must not use (under the highway ramps)
  }
  segKey(i0, j0, i1, j1) { return i0 < i1 || (i0 === i1 && j0 < j1) ? `${i0},${j0},${i1},${j1}` : `${i1},${j1},${i0},${j0}`; }
  segBlocked(i0, j0, i1, j1) { return this.blocked.has(this.segKey(i0, j0, i1, j1)); }
  // an animated ad screen (drawn by ads.js); its dark frame goes into the chunk
  ad(ch, x, y, z, rotY, w, h, opts = {}) {
    this.adSpots.push({ x, y, z, rotY, w, h, kind: opts.kind });
    const nx = Math.sin(rotY), nz = Math.cos(rotY);
    ch.details.add(new THREE.BoxGeometry(w + 0.7, h + 0.7, 0.35), '#0b0c12', x - nx * 0.22, y, z - nz * 0.22, 0, rotY, 0);
    if (opts.stand) for (const s of [-0.35, 0.35]) ch.details.add(new THREE.BoxGeometry(0.3, y - h / 2 - (opts.base || 0) + 0.5, 0.3), '#2a2d36', x + Math.cos(rotY) * s * w - nx * 0.5, (y - h / 2) / 2 + (opts.base || 0) / 2, z - Math.sin(rotY) * s * w - nz * 0.5);
    if (opts.lamps) for (const s of [-0.3, 0.3]) ch.trims.add(new THREE.BoxGeometry(0.5, 0.18, 0.5), '#fff2d0', x + Math.cos(rotY) * s * w + nx * 0.9, y + h / 2 + 0.6, z - Math.sin(rotY) * s * w + nz * 0.9);
  }

  addBox(b) {
    const i = this.boxes.length; this.boxes.push(b);
    const c0x = Math.floor((b.x0 + 1000) / 21), c1x = Math.floor((b.x1 + 1000) / 21);
    const c0z = Math.floor((b.z0 + 1000) / 21), c1z = Math.floor((b.z1 + 1000) / 21);
    for (let x = c0x; x <= c1x; x++) for (let z = c0z; z <= c1z; z++) {
      const k = x * 4096 + z; let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i);
    }
  }
  addPole(x, z) {
    if (!this.poleGrid) this.poleGrid = new Map();
    const k = Math.floor((x + 1000) / 21) * 4096 + Math.floor((z + 1000) / 21);
    let a = this.poleGrid.get(k); if (!a) this.poleGrid.set(k, a = []); a.push(x, z);
  }
  // Push a circle out of lamp poles (radius 0.2). Returns {x, z, hit}.
  pushPoles(x, z, r) {
    let hit = false;
    if (!this.poleGrid) return { x, z, hit };
    const cx = Math.floor((x + 1000) / 21), cz = Math.floor((z + 1000) / 21), R = r + 0.2;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const a = this.poleGrid.get(i * 4096 + j); if (!a) continue;
      for (let k = 0; k < a.length; k += 2) {
        const dx = x - a[k], dz = z - a[k + 1], d2 = dx * dx + dz * dz;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1e-3; x = a[k] + dx / d * R; z = a[k + 1] + dz / d * R; hit = true; }
      }
    }
    return { x, z, hit };
  }
  cellBoxes(x, z) { return this.grid.get(Math.floor((x + 1000) / 21) * 4096 + Math.floor((z + 1000) / 21)); }

  build(onProgress) {
    const r = this.rng;
    this._ground();
    this._sky();
    // chunks of 2x2 blocks
    const CH = 2, nCh = Math.ceil(N / CH);
    const chunkData = [];
    for (let i = 0; i < nCh * nCh; i++) chunkData.push({ bodies: [[], [], [], [], [], [], []], trims: new Parts(), details: new Parts(), cx: 0, cz: 0 });
    const chunkOf = (bi, bj) => chunkData[Math.floor(Math.min(N - 1, Math.max(0, bi)) / CH) * nCh + Math.floor(Math.min(N - 1, Math.max(0, bj)) / CH)];
    for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) this._block(bi, bj, chunkOf(bi, bj), r);
    this._skybridges(chunkOf, r);
    // elevated highways (their ramps close a few road segments to ground traffic) and cables
    buildHighways(this, chunkOf);
    for (const [i0, j0, i1, j1] of rampSegments()) this.blocked.add(this.segKey(i0, j0, i1, j1));
    streetCables(this, chunkOf, r, new Set(HIGHWAYS.map(H => H.axis + H.road)));
    onProgress && onProgress(0.5);
    chunkData.forEach((ch, idx) => {
      const g = new THREE.Group();
      const ci = Math.floor(idx / nCh), cj = idx % nCh;
      ch.cx = roadC(ci * CH) + CELL * CH / 2; ch.cz = roadC(cj * CH) + CELL * CH / 2;
      ch.bodies.forEach((list, m) => {
        if (!list.length) return;
        const mesh = new THREE.Mesh(mergeGeometries(list), this.windowMats[m]);
        mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
      });
      if (ch.trims.list.length) { const t = new THREE.Mesh(ch.trims.build(), this.trimMat); g.add(t); }
      if (ch.details.list.length) { const d = new THREE.Mesh(ch.details.build(), this.detailMat); d.castShadow = true; d.receiveShadow = true; g.add(d); }
      this.root.add(g);
      this.chunks.push({ group: g, x: ch.cx, z: ch.cz, r: CELL * CH * 0.75 });
    });
    this._outerRing(r);
    this._lamps();
    this._finishSigns();
    this._timesSquare();
    this._skyLanes();
    this._decalsMesh();
    // ad screens and giant holograms
    this.ads = new AdScreens(this.root, this.adSpots);
    this.holos = new Holograms(this.root, this);
    this.hwTraffic = new HighwayTraffic(this.root);
    onProgress && onProgress(1);
  }

  _ground() {
    const tex = groundTexture();
    this.groundTex = tex;
    const S = 3000, x0 = roadC(0) - ROAD / 2, z0 = roadC(0) - ROAD / 2;
    const g = new THREE.BufferGeometry();
    const P = [-S, 0, -S, S, 0, -S, S, 0, S, -S, 0, S];
    const uv = []; for (let i = 0; i < 4; i++) { uv.push((P[i * 3] - x0) / CELL, (P[i * 3 + 2] - z0) / CELL); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.25, envMapIntensity: 0.12 });
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
    this.ground = mesh; this.root.add(mesh);
  }

  _sky() {
    const tex = skyTexture('#05030f', '#1a0f3a', '#3a1a5a');
    const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), m);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
    // Distant holographic "NEW YORK 3000"
    const ny = signTexture('NEW YORK 3000', '#29f3ff', { bg: 'rgba(0,0,0,0)' });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(220, 55), new THREE.MeshBasicMaterial({ map: ny, transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide, opacity: 0.85, blending: THREE.AdditiveBlending }));
    p.position.set(0, 300, -620);
    this.root.add(p); this.holoSky = p;
  }

  _uvBox(w, h, d, x, y, z, color) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv, ou = this.rng() * 8 | 0, ov = this.rng() * 16 | 0;
    // faces: 0 px,1 nx (width d), 2 py,3 ny, 4 pz,5 nz (width w); 4 verts each
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        if (f === 2 || f === 3) { uv.setXY(i, 0.004, 0.004); continue; }
        const fw = (f < 2) ? d : w;
        uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(fw / 4)) / 8 + ou / 8, uv.getY(i) * Math.max(1, Math.round(h / 4)) / 16 + ov / 16);
      }
    }
    g.translate(x, y, z);
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  _block(bi, bj, ch, r) {
    const bx0 = roadC(bi) + ROAD / 2, bz0 = roadC(bj) + ROAD / 2, BS = CELL - ROAD;
    const ins = 5, x0 = bx0 + ins, z0 = bz0 + ins, S = BS - ins * 2; // 54
    const cx = bx0 + BS / 2, cz = bz0 + BS / 2;
    // landing plaza block near spawn
    if (bi === 5 && bj === 6) {
      this.plaza = { x: cx, z: cz, size: BS };
      const pad = new Parts();
      pad.box(S, 0.3, S, '#151a2a', cx, 0.15, cz);
      this.addBox({ x0: cx - S / 2, x1: cx + S / 2, z0: cz - S / 2, z1: cz + S / 2, y0: 0, y1: 0.3, low: true });
      const padMesh = new THREE.Mesh(pad.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }));
      padMesh.receiveShadow = true; this.root.add(padMesh);
      const gl = new Parts();
      for (const [dx, dz] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
        gl.add(new THREE.TorusGeometry(5, 0.12, 4, 32), '#29f3ff', cx + dx, 0.38, cz + dz, Math.PI / 2);
        gl.box(4, 0.06, 0.4, '#ffa43a', cx + dx, 0.36, cz + dz);
        gl.box(0.4, 0.06, 4, '#ffa43a', cx + dx, 0.36, cz + dz);
      }
      gl.box(S, 0.1, 0.3, '#ff2bd6', cx, 0.36, cz - S / 2 + 0.2); gl.box(S, 0.1, 0.3, '#ff2bd6', cx, 0.36, cz + S / 2 - 0.2);
      gl.box(0.3, 0.1, S - 0.7, '#ff2bd6', cx - S / 2 + 0.2, 0.36, cz); gl.box(0.3, 0.1, S - 0.7, '#ff2bd6', cx + S / 2 - 0.2, 0.36, cz);
      this.root.add(new THREE.Mesh(gl.build(), this.trimMat));
      this._sign('HOVER PAD 06', '#29f3ff', cx, 9, cz - S / 2 - 0.5, 0, 14, 3.5, true);
      this.padSpots = [[-12, -12], [12, -12], [-12, 12], [12, 12]].map(([dx, dz]) => ({ x: cx + dx, z: cz + dz }));
      return;
    }
    const dCenter = Math.hypot(cx, cz) / HALF;
    const ts = (bi === 4 || bi === 5) && (bj === 4 || bj === 5);
    const zone = ts ? 'ts' : zoneOf(bi, bj);
    // Night City downtown: corporate towers and megabuildings fill whole blocks
    if (zone === 'corp' || zone === 'mega') {
      const o = { bi, bj, cx, cz, S, bx0, bz0, BS };
      if (zone === 'corp') corpTower(this, ch, r, o); else megablock(this, ch, r, o);
      return;
    }
    const market = zone === 'market';
    const pat = r();
    let lots;
    const G = 3;
    if (market) lots = marketLots(r, S);
    else if (ts || pat < 0.15) lots = [[0, 0, S, S]];
    else if (pat < 0.35) lots = [[0, 0, S / 2 - G / 2, S], [S / 2 + G / 2, 0, S / 2 - G / 2, S]];
    else if (pat < 0.5) lots = [[0, 0, S, S / 2 - G / 2], [0, S / 2 + G / 2, S, S / 2 - G / 2]];
    else {
      const h = S / 2 - G / 2, o = S / 2 + G / 2;
      lots = [[0, 0, h, h], [o, 0, h, h], [0, o, h, h], [o, o, h, h]];
    }
    for (const [lx, lz, lw, ld] of lots) {
      // big height contrast: low-rise squeezed between towers, a few very tall ones
      let h = (36 + (1 - dCenter) * 150) * (0.4 + r() * 1.2);
      if (r() < 0.16) h = 16 + r() * 22;
      if (ts) h = 120 + r() * 60;
      if (r() < 0.07) h = 230 + r() * 70;
      if (market) h = 10 + Math.floor(r() * 7) * 4;
      h = Math.max(market ? 10 : 16, Math.min(300, Math.round(h / 4) * 4));
      const bx = x0 + lx + lw / 2, bz = z0 + lz + ld / 2;
      // which sides face a street (the lot reaches the block edge)
      const faces = [];
      if (bx - lw / 2 < bx0 + 8) faces.push([-1, 0]);
      if (bx + lw / 2 > bx0 + BS - 8) faces.push([1, 0]);
      if (bz - ld / 2 < bz0 + 8) faces.push([0, -1]);
      if (bz + ld / 2 > bz0 + BS - 8) faces.push([0, 1]);
      this._building(ch, r, { bi, bj, bx, bz, lw, ld, h, ts, faces, bx0, bz0, BS, market });
    }
    if (market) marketStreet(this, ch, r, bx0, bz0, BS);
  }

  // ---------- one building on one lot ----------
  _building(ch, r, o) {
    const { bx, bz, lw, ld, h, ts, faces } = o;
    const heroRoll = r();
    if (!ts && h >= 150 && heroRoll < 0.35 && this._heroTower(ch, r, o)) return;
    // jumbled stacks of boxes that overhang the sidewalk
    if (!ts && !o.market && h >= 64 && r() < 0.3) { stackTower(this, ch, r, o); return; }
    const square = Math.abs(lw - ld) < 2;
    let style = 'box';
    if (h <= 44 && !ts) style = 'low';
    else if (!ts && square && lw >= 24 && h >= 90 && r() < 0.4) style = r() < 0.5 ? 'oct' : 'round';
    else if (!ts && h >= 110 && r() < 0.4) style = 'deco';
    else if (!ts && h >= 70 && r() < 0.35) style = 'setback';
    // facades like the real Manhattan: limestone, tan and brown stone, golden or blue glass, and neon windows
    let m = style === 'low' ? (o.market && r() < 0.5 ? MAT_MEGA : 3) : Math.floor(r() * 3);
    let tint = style === 'low' ? new THREE.Color().setHSL(0.05 + r() * 0.05, 0.3, 0.8 + r() * 0.2) : new THREE.Color().setHSL(0.6 + r() * 0.3, 0.2, 0.55 + r() * 0.35);
    if (style !== 'low') {
      const f = r();
      if (f < 0.38) { m = 6; tint = new THREE.Color().setHSL([0.09, 0.08, 0.06, 0.1, 0.6][Math.floor(r() * 5)], 0.25 + r() * 0.25, 0.45 + r() * 0.4); }
      else if (f < 0.55) { m = 5; tint = new THREE.Color().setHSL([0.11, 0.12, 0.55, 0.5][Math.floor(r() * 4)], 0.5, 0.75 + r() * 0.2); }
    }
    const tc = ['#29f3ff', '#ff2bd6', '#8a4dff', '#ffa43a', '#ff1e3c'][Math.floor(r() * 5)];
    const T = ch.trims, D = ch.details;
    let topH = h, tw = lw, td = ld, flatRoof = true;
    if (style === 'oct') {
      this._octagon(ch, m, bx, bz, lw / 2, h, tint, tc, r);
      flatRoof = false;
    } else if (style === 'round') {
      topH = this._round(ch, m, bx, bz, lw / 2, h, tint, tc, r);
      flatRoof = false;
    } else if (style === 'setback') {
      // a "wedding cake": tiers that step back as it rises, with a stone ledge on each one
      let y = 0, w = lw, d = ld;
      const tiers = 3 + Math.floor(r() * 3), first = Math.round(h * (0.35 + r() * 0.15) / 4) * 4;
      const ledge = tint.clone().multiplyScalar(0.7);
      for (let k = 0; k < tiers; k++) {
        const th = k === 0 ? first : Math.max(8, Math.round((h - first) / (tiers - 1) / 4) * 4);
        ch.bodies[m].push(this._uvBox(w, th, d, bx, y + th / 2, bz, tint));
        this.addBox({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2, y0: y, y1: y + th });
        D.box(w + 0.8, 0.7, d + 0.8, ledge, bx, y + th, bz);
        y += th; tw = w; td = d;
        w = Math.max(8, w * (0.74 + r() * 0.1)); d = Math.max(8, d * (0.74 + r() * 0.1));
      }
      topH = y;
    } else {
      ch.bodies[m].push(this._uvBox(lw, h, ld, bx, h / 2, bz, tint));
      this.addBox({ x0: bx - lw / 2, x1: bx + lw / 2, z0: bz - ld / 2, z1: bz + ld / 2, y0: 0, y1: h });
      if (style !== 'low' && h > 60 && r() < 0.6) {
        tw = lw * (0.55 + r() * 0.25); td = ld * (0.55 + r() * 0.25);
        const h2 = Math.round(h * (0.2 + r() * 0.35) / 4) * 4;
        ch.bodies[(m + 1) % 3].push(this._uvBox(tw, h2, td, bx, h + h2 / 2, bz, tint));
        this.addBox({ x0: bx - tw / 2, x1: bx + tw / 2, z0: bz - td / 2, z1: bz + td / 2, y0: h, y1: h + h2 });
        topH = h + h2;
      }
      if (style === 'deco') { topH = this._decoCrown(ch, m, bx, bz, tw, td, topH, tint, r); flatRoof = false; }
    }
    if (style !== 'low' && style !== 'oct' && style !== 'round' && m !== 6) {
      if (r() < 0.55) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.box(0.35, h, 0.35, tc, bx + sx * (lw / 2 + 0.1), h / 2, bz + sz * (ld / 2 + 0.1));
      if (r() < 0.3) for (let y = 20; y < h - 10; y += 24 + Math.floor(r() * 3) * 8) {
        T.box(lw + 0.3, 0.3, 0.3, tc, bx, y, bz - ld / 2 - 0.1); T.box(lw + 0.3, 0.3, 0.3, tc, bx, y, bz + ld / 2 + 0.1);
      }
    }
    if (flatRoof && style !== 'low' && r() < 0.6) {
      T.box(tw + 0.4, 0.4, 0.3, tc, bx, topH + 0.2, bz - td / 2); T.box(tw + 0.4, 0.4, 0.3, tc, bx, topH + 0.2, bz + td / 2);
      T.box(0.3, 0.4, td + 0.4, tc, bx - tw / 2, topH + 0.2, bz); T.box(0.3, 0.4, td + 0.4, tc, bx + tw / 2, topH + 0.2, bz);
    }
    let roofUsed = false;
    // machine room on the roof (lift motors, tanks), like the boxy tops in the photo
    if (flatRoof && style !== 'low' && tw > 14 && td > 14 && r() < 0.55) {
      const mw = tw * (0.3 + r() * 0.2), md = td * (0.3 + r() * 0.2), mh = 4 + Math.floor(r() * 3) * 2;
      const mx = bx + (r() - 0.5) * (tw - mw - 2), mz = bz + (r() - 0.5) * (td - md - 2);
      ch.bodies[m].push(this._uvBox(mw, mh, md, mx, topH + mh / 2, mz, tint.clone().multiplyScalar(0.8)));
      this.addBox({ x0: mx - mw / 2, x1: mx + mw / 2, z0: mz - md / 2, z1: mz + md / 2, y0: topH, y1: topH + mh });
      D.box(mw + 0.4, 0.4, md + 0.4, '#3a3a40', mx, topH + mh + 0.2, mz);
    }
    if (flatRoof && topH >= 140 && tw >= 18 && td >= 18 && r() < 0.55) { this._helipad(D, T, bx, topH, bz, Math.min(tw, td)); roofUsed = true; }
    else if (flatRoof && topH > 100 && r() < 0.5) {
      const ah = 10 + r() * 25;
      D.box(0.5, ah, 0.5, '#30364a', bx, topH + ah / 2, bz);
      D.box(0.2, ah * 0.6, 0.2, '#30364a', bx + 1.2, topH + ah * 0.3, bz + 0.8);
      T.box(1.0, 1.0, 1.0, '#ff1030', bx, topH + ah, bz);
      roofUsed = true;
    }
    if (style === 'low') {
      // cornice ledge, fire escapes, rooftop water tower
      const c = '#2a201c';
      D.box(lw + 1.0, 0.7, 0.6, c, bx, h + 0.15, bz - ld / 2 - 0.2); D.box(lw + 1.0, 0.7, 0.6, c, bx, h + 0.15, bz + ld / 2 + 0.2);
      D.box(0.6, 0.7, ld + 1.0, c, bx - lw / 2 - 0.2, h + 0.15, bz); D.box(0.6, 0.7, ld + 1.0, c, bx + lw / 2 + 0.2, h + 0.15, bz);
      o.fe = [];
      for (const [fx, fz] of faces) if (r() < (o.market || m !== 3 ? 0.25 : 0.7)) {
        o.fe.push([fx, fz]);
        const along = fx ? ld : lw, n = along > 30 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const off = (n === 1 ? 0 : (k ? 1 : -1) * along * 0.25) + (r() - 0.5) * 3;
          this._fireEscape(D, fx, fz, fx ? bx + fx * lw / 2 : bx + off, fz ? bz + fz * ld / 2 : bz + off, h);
        }
      }
    }
    if (flatRoof && !roofUsed && topH <= 90 && r() < (style === 'low' ? 0.7 : 0.35)) {
      const mx = Math.max(0, tw / 2 - 3), mz = Math.max(0, td / 2 - 3);
      this._waterTower(D, bx + (r() - 0.5) * 2 * mx, topH, bz + (r() - 0.5) * 2 * mz, T, r);
    }
    if (flatRoof && !roofUsed && tw > 10) {
      // detailed Blender AC units on the bigger roofs, plain boxes on the little market ones (cheaper)
      const n = 1 + Math.floor(r() * 2), P = props();
      for (let k = 0; k < n; k++) {
        const ux = bx + (r() - 0.5) * (tw - 5), uz = bz + (r() - 0.5) * (td - 5), rot = r() < 0.5 ? 0 : Math.PI / 2;
        if (P.ac && !o.market && style !== 'low') this._prop(D, T, P.ac, ux, topH, uz, rot);
        else {
          D.box(2.4, 1.3, 1.8, '#3a3f4a', ux, topH + 0.65, uz);
          D.cyl(0.55, 0.55, 0.06, 10, '#15171c', ux, topH + 1.33, uz);
        }
      }
      if (P.dish && r() < 0.35) this._prop(D, T, P.dish, bx + (tw / 2 - 2) * (r() < 0.5 ? -1 : 1), topH, bz + (td / 2 - 2) * (r() < 0.5 ? -1 : 1), r() * Math.PI * 2);
    }
    if (style !== 'oct' && style !== 'round') this._storefronts(ch, r, o, style); else this._octDoors(ch, r, o);
    this.lots.push({ ...o, style, topH });
    if (style !== 'oct' && style !== 'round') this._lotSigns(bx, bz, lw, ld, h, o.bx0, o.bz0, o.BS, r);
    if (o.market) {
      // night markets: more signs and billboards on the roofs
      this._lotSigns(bx, bz, lw, ld, h, o.bx0, o.bz0, o.BS, r);
      if (r() < 0.45) roofBillboard(this, ch, r, o, topH);
    } else if (style !== 'low' && h > 56 && faces.length && r() < 0.16) {
      // an ad screen on the facade
      const [fx, fz] = faces[Math.floor(r() * faces.length)], span = fx ? ld : lw;
      if (span >= 14) {
        const tall = r() < 0.3, w = tall ? 5 : Math.min(span - 4, 12), hh = tall ? 13 : w / 2;
        const off = (r() - 0.5) * (span - w - 2), y = 20 + r() * Math.min(40, h - 34);
        this.ad(ch, fx ? bx + fx * (lw / 2 + 0.5) : bx + off, y, fz ? bz + fz * (ld / 2 + 0.5) : bz + off, Math.atan2(fx, fz), w, hh);
      }
    }
  }

  _octagon(ch, m, x, z, a, h, tint, tc, r) {
    const R = a / Math.cos(Math.PI / 8), side = 2 * R * Math.sin(Math.PI / 8);
    const g = new THREE.CylinderGeometry(R, R, h, 8, 1, false, Math.PI / 8);
    const uv = g.attributes.uv, ou = Math.floor(r() * 8), ov = Math.floor(r() * 16);
    const cols = Math.max(1, Math.round(side * 8 / 4)), rows = Math.max(1, Math.round(h / 4));
    for (let i = 0; i < uv.count; i++) {
      if (i < 18) uv.setXY(i, uv.getX(i) * cols / 8 + ou / 8, uv.getY(i) * rows / 16 + ov / 16);
      else uv.setXY(i, 0.004, 0.004);
    }
    g.translate(x, h / 2, z);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ch.bodies[m].push(g);
    const s2 = side / 2, k = (a + s2) / 2;
    this.addBox({ x0: x - a, x1: x + a, z0: z - s2, z1: z + s2, y0: 0, y1: h });
    this.addBox({ x0: x - s2, x1: x + s2, z0: z - a, z1: z + a, y0: 0, y1: h });
    this.addBox({ x0: x - k, x1: x + k, z0: z - k, z1: z + k, y0: 0, y1: h });
    // neon on every other corner, glowing crown ring and a mast
    for (let i = 0; i < 8; i++) {
      const t = Math.PI / 8 + i * Math.PI / 4, cx = x + Math.sin(t) * (R + 0.15), cz = z + Math.cos(t) * (R + 0.15);
      if (i % 2 === 0) ch.trims.box(0.35, h, 0.35, tc, cx, h / 2, cz);
      const t2 = t + Math.PI / 4, mx = x + Math.sin(t + Math.PI / 8) * (a + 0.2), mz = z + Math.cos(t + Math.PI / 8) * (a + 0.2);
      void t2;
      ch.trims.box(side + 0.3, 0.5, 0.3, tc, mx, h + 0.25, mz, 0, t + Math.PI / 8, 0);
      ch.trims.box(side + 0.3, 0.3, 0.3, tc, mx, h * 0.66, mz, 0, t + Math.PI / 8, 0);
    }
    const mh = 14 + r() * 20;
    ch.details.cyl(0.35, 0.6, mh, 6, '#30364a', x, h + mh / 2, z);
    ch.trims.box(0.9, 0.9, 0.9, '#ff1030', x, h + mh, z);
    ch.details.cyl(a * 0.55, a * 0.62, 3, 8, '#1c1f2a', x, h + 1.5, z);
    this.addBox({ x0: x - a * 0.6, x1: x + a * 0.6, z0: z - a * 0.6, z1: z + a * 0.6, y0: h, y1: h + 3 });
  }

  // a round tower (glass or stone drum) with ledges and a smaller drum on top
  _round(ch, m, x, z, a, h, tint, tc, r) {
    const seg = 24, R = a;
    const g = new THREE.CylinderGeometry(R, R, h, seg, 1, true);
    const uv = g.attributes.uv, cols = Math.max(1, Math.round(2 * Math.PI * R / 4)), rows = Math.max(1, Math.round(h / 4));
    const ou = Math.floor(r() * 8), ov = Math.floor(r() * 16);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * cols / 8 + ou / 8, uv.getY(i) * rows / 16 + ov / 16);
    g.translate(x, h / 2, z);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ch.bodies[m].push(g);
    const s2 = a * 0.42, k = a * 0.72;
    this.addBox({ x0: x - a, x1: x + a, z0: z - s2, z1: z + s2, y0: 0, y1: h });
    this.addBox({ x0: x - s2, x1: x + s2, z0: z - a, z1: z + a, y0: 0, y1: h });
    this.addBox({ x0: x - k, x1: x + k, z0: z - k, z1: z + k, y0: 0, y1: h });
    const D = ch.details, ledge = tint.clone().multiplyScalar(0.6);
    for (let y = 30; y < h - 6; y += 30 + Math.floor(r() * 3) * 4) D.cyl(R + 0.35, R + 0.35, 0.5, seg, ledge, x, y, z);
    D.cyl(R + 0.4, R + 0.4, 0.8, seg, ledge, x, h, z); // roof edge (and the roof itself)
    const dh = 8 + Math.floor(r() * 3) * 4, dr = R * 0.6;
    D.cyl(dr, dr, dh, 16, tint.clone().multiplyScalar(0.75), x, h + dh / 2, z);
    D.cyl(dr + 0.3, dr + 0.3, 0.5, 16, ledge, x, h + dh, z);
    ch.trims.add(new THREE.TorusGeometry(dr + 0.35, 0.15, 4, 32), tc, x, h + dh - 1, z, Math.PI / 2);
    this.addBox({ x0: x - dr * 0.8, x1: x + dr * 0.8, z0: z - dr * 0.8, z1: z + dr * 0.8, y0: h, y1: h + dh });
    const mh = 10 + r() * 14;
    D.box(0.5, mh, 0.5, '#30364a', x, h + dh + mh / 2, z); ch.trims.box(0.9, 0.9, 0.9, '#ff1030', x, h + dh + mh, z);
    return h + dh;
  }

  // stepped art-deco crown with golden neon edges and a spire
  _decoCrown(ch, m, bx, bz, w, d, y, tint, r) {
    const gold = r() < 0.5 ? '#ffd27a' : '#ffa43a';
    for (let k = 0; k < 3; k++) {
      w *= 0.76; d *= 0.76;
      const th = 6 + Math.floor(r() * 3) * 2;
      ch.bodies[m].push(this._uvBox(w, th, d, bx, y + th / 2, bz, tint));
      this.addBox({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2, y0: y, y1: y + th });
      const T = ch.trims;
      T.box(w + 0.6, 0.35, 0.35, gold, bx, y + 0.2, bz - d / 2 - 0.15); T.box(w + 0.6, 0.35, 0.35, gold, bx, y + 0.2, bz + d / 2 + 0.15);
      T.box(0.35, 0.35, d + 0.6, gold, bx - w / 2 - 0.15, y + 0.2, bz); T.box(0.35, 0.35, d + 0.6, gold, bx + w / 2 + 0.15, y + 0.2, bz);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.box(0.25, th, 0.25, gold, bx + sx * (w / 2 + 0.08), y + th / 2, bz + sz * (d / 2 + 0.08));
      y += th;
    }
    const sh = 22 + r() * 22, sr = Math.min(w, d) * 0.22;
    ch.details.add(new THREE.ConeGeometry(sr, sh, 8), '#3a4152', bx, y + sh / 2, bz);
    for (const f of [0.3, 0.55, 0.75]) ch.trims.cyl(sr * (1 - f) + 0.15, sr * (1 - f) + 0.15, 0.4, 8, gold, bx, y + sh * f, bz);
    ch.trims.sphere(0.7, '#ff1030', bx, y + sh, bz);
    this.addBox({ x0: bx - sr, x1: bx + sr, z0: bz - sr, z1: bz + sr, y0: y, y1: y + sh * 0.6 });
    return y;
  }

  _helipad(D, T, x, y, z, size) {
    const rad = Math.min(8, size * 0.38);
    D.cyl(rad, rad, 0.3, 24, '#1a1d28', x, y + 0.17, z);
    this.addBox({ x0: x - rad, x1: x + rad, z0: z - rad, z1: z + rad, y0: y, y1: y + 0.32, low: true });
    T.add(new THREE.TorusGeometry(rad * 0.85, 0.12, 4, 32), '#3aff9a', x, y + 0.36, z, Math.PI / 2);
    T.box(0.5, 0.06, rad * 0.9, '#e8f6ff', x - rad * 0.28, y + 0.35, z);
    T.box(0.5, 0.06, rad * 0.9, '#e8f6ff', x + rad * 0.28, y + 0.35, z);
    T.box(rad * 0.56, 0.06, 0.5, '#e8f6ff', x, y + 0.35, z);
    for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4; T.box(0.35, 0.35, 0.35, '#ffa43a', x + Math.cos(t) * (rad - 0.4), y + 0.45, z + Math.sin(t) * (rad - 0.4)); }
  }

  // a Blender prop: solid parts into the details mesh, glowing parts into the neon trims
  _prop(D, T, g, x, y, z, rot = 0) {
    _M.makeRotationY(rot).setPosition(x, y, z);
    if (g.detail) D.addColored(g.detail, _M);
    if (g.trim) T.addColored(g.trim, _M);
  }

  // a Blender landmark tower on a podium that fills the lot. Returns false if none fits.
  _heroTower(ch, r, o) {
    const H = heroes();
    if (!H.length) return false;
    const { bx, bz, lw, ld } = o;
    const fits = [];
    for (const t of H) {
      if (t.used >= 2) continue; // each landmark at most twice
      for (const rot of [0, Math.PI / 2]) {
        const w = rot ? t.d : t.w, d = rot ? t.w : t.d;
        if (w <= lw + 0.6 && d <= ld + 0.6 && (w * d) / (lw * ld) > 0.3) fits.push({ t, rot });
      }
    }
    if (!fits.length) return false;
    const least = Math.min(...fits.map(f => f.t.used));
    const pool = fits.filter(f => f.t.used === least);
    const { t, rot } = pool[Math.floor(r() * pool.length)];
    t.used++;
    const m = Math.floor(r() * 3);
    const tint = new THREE.Color().setHSL(0.58 + r() * 0.3, 0.18, 0.62 + r() * 0.3);
    const tc = ['#29f3ff', '#ff2bd6', '#8a4dff', '#ffa43a', '#ff1e3c'][Math.floor(r() * 5)];
    // podium: keeps the street wall, the shop fronts and the collision at ground level
    const ph = 8;
    ch.bodies[m].push(this._uvBox(lw, ph, ld, bx, ph / 2, bz, tint));
    this.addBox({ x0: bx - lw / 2, x1: bx + lw / 2, z0: bz - ld / 2, z1: bz + ld / 2, y0: 0, y1: ph });
    ch.trims.box(lw + 0.3, 0.3, 0.3, tc, bx, ph + 0.15, bz - ld / 2); ch.trims.box(lw + 0.3, 0.3, 0.3, tc, bx, ph + 0.15, bz + ld / 2);
    ch.trims.box(0.3, 0.3, ld + 0.3, tc, bx - lw / 2, ph + 0.15, bz); ch.trims.box(0.3, 0.3, ld + 0.3, tc, bx + lw / 2, ph + 0.15, bz);
    _M.makeRotationY(rot).setPosition(bx, 0, bz);
    const body = t.g.body.clone().applyMatrix4(_M);
    const col = body.attributes.color, uv = body.attributes.uv;
    for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * tint.r, col.getY(i) * tint.g, col.getZ(i) * tint.b);
    const ou = Math.floor(r() * 8) / 8, ov = Math.floor(r() * 16) / 16;
    for (let i = 0; i < uv.count; i++) if (Math.abs(uv.getX(i) - 0.004) > 1e-4 || Math.abs(uv.getY(i) - 0.004) > 1e-4) uv.setXY(i, uv.getX(i) + ou, uv.getY(i) + ov);
    ch.bodies[m].push(body);
    if (t.g.detail) ch.details.addColored(t.g.detail, _M);
    if (t.g.trim) ch.trims.addColored(t.g.trim, _M);
    if (t.g.tc) ch.trims.addColored(t.g.tc, _M, tc);
    const c = Math.cos(rot), sn = Math.sin(rot);
    for (const [x, y, z, hx, hy, hz] of t.cols) {
      const wx = bx + x * c + z * sn, wz = bz - x * sn + z * c;
      const ex = rot ? hz : hx, ez = rot ? hx : hz;
      this.addBox({ x0: wx - ex, x1: wx + ex, z0: wz - ez, z1: wz + ez, y0: Math.max(0, y - hy), y1: y + hy });
    }
    this._storefronts(ch, r, o, 'box');
    this.lots.push({ ...o, style: 'hero', topH: t.top, tower: t.name });
    return true;
  }

  _waterTower(D, x, y, z, T = null, r = Math.random) {
    const P = props(), wt = (r() < 0.3 && P.watertower_neon) ? P.watertower_neon : P.watertower;
    if (wt && T) {
      this._prop(D, T, wt, x, y, z, Math.floor(r() * 4) * Math.PI / 2);
      this.addBox({ x0: x - 1.7, x1: x + 1.7, z0: z - 1.7, z1: z + 1.7, y0: y, y1: y + 7.5 });
      return;
    }
    const wood = '#5a4434', iron = '#1e1a18';
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) D.box(0.2, 3.4, 0.2, iron, x + sx * 1.15, y + 1.7, z + sz * 1.15);
    D.box(2.6, 0.12, 0.12, iron, x, y + 1.6, z - 1.15); D.box(2.6, 0.12, 0.12, iron, x, y + 1.6, z + 1.15);
    D.box(0.12, 0.12, 2.6, iron, x - 1.15, y + 1.6, z); D.box(0.12, 0.12, 2.6, iron, x + 1.15, y + 1.6, z);
    D.cyl(1.75, 1.75, 0.15, 12, iron, x, y + 3.45, z);
    D.cyl(1.6, 1.6, 2.9, 14, wood, x, y + 4.95, z);
    for (const yy of [3.9, 4.95, 6.0]) D.cyl(1.63, 1.63, 0.1, 14, iron, x, y + yy, z);
    D.add(new THREE.ConeGeometry(1.78, 1.2, 14), '#3a2c22', x, y + 7.0, z);
    D.cyl(0.08, 0.08, 0.5, 4, iron, x, y + 7.8, z);
    this.addBox({ x0: x - 1.7, x1: x + 1.7, z0: z - 1.7, z1: z + 1.7, y0: y, y1: y + 7.5 });
  }

  // zig-zag iron fire escape on a facade: face normal (fx, fz), (wx, wz) = point on the wall
  _fireEscape(D, fx, fz, wx, wz, h) {
    const iron = '#2c2e38', out = 0.65, len = 3.2;
    const ry = fx ? Math.PI / 2 : 0; // platform long axis along the wall
    const px = wx + fx * out, pz = wz + fz * out;
    const ax = fz ? 1 : 0, az = fx ? 1 : 0; // along-wall unit vector
    let dir = 1;
    for (let y = 7; y < h - 3.5; y += 4) {
      D.add(new THREE.BoxGeometry(len, 0.08, 1.2), iron, px, y, pz, 0, ry, 0);
      D.add(new THREE.BoxGeometry(len, 0.05, 0.05), iron, px + fx * 0.58, y + 0.95, pz + fz * 0.58, 0, ry, 0);
      D.add(new THREE.BoxGeometry(len, 0.04, 0.04), iron, px + fx * 0.58, y + 0.5, pz + fz * 0.58, 0, ry, 0);
      for (const e of [-1, 1]) D.box(0.05, 1.0, 0.05, iron, px + fx * 0.58 + ax * e * len / 2, y + 0.5, pz + fz * 0.58 + az * e * len / 2);
      if (y + 4 < h - 3.5) {
        const ang = Math.atan2(4, len - 0.6) * dir;
        D.add(new THREE.BoxGeometry(Math.hypot(4, len - 0.6), 0.07, 0.55), iron, px - fx * 0.2, y + 2, pz - fz * 0.2, 0, ry, ang);
        dir = -dir;
      }
    }
  }

  // lit shop windows and awnings along the street sides at ground level, plus the building's
  // 5 street doors: shops (rob them!) and flats. Door data goes into this.doors for the game.
  _storefronts(ch, r, o, style) {
    const { bx, bz, lw, ld, faces } = o;
    const shop = ['#ffd9a0', '#9fe9ff', '#ff9ae6', '#fff0d0', '#ffb070', '#b9ffd9', '#c8b0ff'];
    const neon = ['#ff2bd6', '#29f3ff', '#ffa43a', '#3aff9a', '#8a4dff', '#ff1e3c'];
    const awn = ['#b02238', '#2a5aa8', '#228a70', '#7a3ab0', '#b0701a', '#3a3f4a'];
    const col = new THREE.Color();
    const segs = [];
    for (const [fx, fz] of faces) {
      const along = fx ? ld : lw, n = Math.max(1, Math.floor(along / 6.5));
      for (let k = 0; k < n; k++) segs.push([fx, fz, along, along / n, k]);
    }
    // which segments get doors, and what kind: 2 shops + 3 flats (brick walk-ups 1 + 4, Times Square 3 + 2)
    const nShops = style === 'low' ? 1 : o.ts ? 3 : 2;
    const kinds = [];
    for (let d = 0; d < DOORS_PER_BUILDING; d++) kinds.push(d < nShops ? 'shop' : 'flat');
    // taller buildings often have a hotel: one of the flat doors becomes the hotel entrance
    if (style !== 'low' && o.h >= 48 && r() < 0.55) kinds[DOORS_PER_BUILDING - 1] = 'hotel';
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    const doorSegs = new Map();
    kinds.forEach((kind, d) => {
      const i = Math.min(segs.length - 1, Math.floor((d + 0.5) * segs.length / kinds.length));
      if (!doorSegs.has(i)) doorSegs.set(i, []);
      doorSegs.get(i).push(kind);
    });
    segs.forEach(([fx, fz, along, seg, k], i) => {
      const wx = bx + fx * lw / 2, wz = bz + fz * ld / 2;
      const ax = fz ? 1 : 0, az = fx ? 1 : 0, ry = fx ? Math.PI / 2 : 0;
      const doors = doorSegs.get(i);
      if (!doors && style !== 'low' && r() < 0.25) return; // some blank lobby walls
      const t = -along / 2 + seg * (k + 0.5);
      const cx = wx + ax * t, cz = wz + az * t;
      // window panes: dim interior light split by dark mullions (the wall shows through the gaps)
      col.set(shop[Math.floor(r() * shop.length)]).multiplyScalar(0.32 + r() * 0.18);
      const pane = (from, to) => {
        const w = to - from; if (w < 0.8) return;
        const panes = w > 4.6 ? 3 : w > 2.6 ? 2 : 1, pw = w / panes;
        for (let q = 0; q < panes; q++) {
          const pt = from + pw * (q + 0.5);
          ch.trims.add(new THREE.BoxGeometry(pw - 0.16, 2.5, 0.1), col, cx + ax * pt + fx * 0.08, 1.85, cz + az * pt + fz * 0.08, 0, ry, 0);
        }
      };
      const half = (seg - 1.0) / 2;
      let hasShop = false;
      if (doors) {
        // doors spread across the segment, shop windows in the gaps
        const slots = doors.map((_, q) => -half + (seg - 1.0) * (q + 0.5) / doors.length);
        let from = -half;
        doors.forEach((kind, q) => {
          const dt = slots[q];
          pane(from, dt - DOOR_W / 2 - 0.45);
          const d = this._door(ch, cx + ax * dt, cz + az * dt, fx, fz, kind, r);
          if (kind === 'shop' || kind === 'hotel') {
            hasShop = true;
            const rotY = fx ? (fx > 0 ? Math.PI / 2 : -Math.PI / 2) : (fz > 0 ? 0 : Math.PI);
            this._sign(d.name, d.color, cx + ax * dt + fx * 0.27, 3.45, cz + az * dt + fz * 0.27, rotY, 2.4, 0.6);
          }
          from = dt + DOOR_W / 2 + 0.45;
        });
        pane(from, half);
      } else pane(-half, half);
      // shop sign strip and dark header
      ch.details.add(new THREE.BoxGeometry(seg - 0.3, 0.55, 0.24), '#101116', cx + fx * 0.12, 3.45, cz + fz * 0.12, 0, ry, 0);
      if (!hasShop && r() < 0.8) ch.trims.add(new THREE.BoxGeometry((seg - 1.2) * (0.5 + r() * 0.5), 0.14, 0.06), neon[Math.floor(r() * neon.length)], cx + fx * 0.26, 3.45, cz + fz * 0.26, 0, ry, 0);
      if (r() < 0.75) {
        // slanted awning: its depth axis points out from the wall
        const tilt = 0.32, g = fx ? new THREE.BoxGeometry(1.6, 0.1, seg - 0.5) : new THREE.BoxGeometry(seg - 0.5, 0.1, 1.6);
        ch.details.add(g, awn[Math.floor(r() * awn.length)], cx + fx * 0.85, 4.05, cz + fz * 0.85, fz ? fz * tilt : 0, 0, fx ? -fx * tilt : 0);
        if (r() < 0.5) {
          const e = fx ? new THREE.BoxGeometry(0.06, 0.06, seg - 0.5) : new THREE.BoxGeometry(seg - 0.5, 0.06, 0.06);
          ch.trims.add(e, neon[Math.floor(r() * neon.length)], cx + fx * 1.6, 3.78, cz + fz * 1.6);
        }
      }
    });
  }

  // one street door on a wall at (cx, cz) facing (fx, fz). Shops: lit glass and a green frame;
  // flats: a metal door with a warm frame, a lamp and an intercom.
  _door(ch, cx, cz, fx, fz, kind, r) {
    // flat panels facing the street (2 triangles each): 1465 doors stay cheap
    const ax = fz ? 1 : 0, az = fx ? 1 : 0, W = DOOR_W;
    const rotY = fx ? (fx > 0 ? Math.PI / 2 : -Math.PI / 2) : (fz > 0 ? 0 : Math.PI);
    const quad = (list, w, h, color, along, y, out) => list.add(new THREE.PlaneGeometry(w, h), color, cx + ax * along + fx * out, y, cz + az * along + fz * out, 0, rotY, 0);
    const isShop = kind === 'shop' || kind === 'hotel', hotel = kind === 'hotel';
    const [name, color] = hotel ? [HOTEL_NAMES[Math.floor(r() * HOTEL_NAMES.length)], '#ffd27a'] : isShop ? SIGN_TEXTS[Math.floor(r() * SIGN_TEXTS.length)] : ['', '#ffc46a'];
    const frame = hotel ? '#ffd27a' : isShop ? '#3aff9a' : '#ffc46a';
    if (isShop) quad(ch.trims, W, 2.6, '#1c5a52', 0, 1.3, 0.06);
    else quad(ch.details, W, 2.6, '#30364a', 0, 1.3, 0.06);
    quad(ch.trims, W + 0.32, 0.13, frame, 0, 2.67, 0.09);
    for (const sd of [-1, 1]) quad(ch.trims, 0.13, 2.67, frame, sd * (W / 2 + 0.09), 1.34, 0.09);
    if (isShop) quad(ch.trims, 0.05, 0.9, '#e8f6ff', 0.55, 1.2, 0.08);
    else {
      quad(ch.trims, 0.6, 0.12, '#fff2d0', 0, 2.98, 0.12);
      quad(ch.trims, 0.16, 0.28, '#29f3ff', W / 2 + 0.45, 1.35, 0.07);
    }
    const d = { id: this.doors.length, kind, name, color, x: cx + fx * 0.3, z: cz + fz * 0.3, nx: fx, nz: fz };
    this.doors.push(d);
    const key = Math.floor((d.x + 1000) / 21) * 4096 + Math.floor((d.z + 1000) / 21);
    if (!this.doorGrid.has(key)) this.doorGrid.set(key, []);
    this.doorGrid.get(key).push(d);
    return d;
  }

  // doors for octagonal towers: on the flat faces that look onto a street
  _octDoors(ch, r, o) {
    const { bx, bz, lw, faces } = o;
    const a = lw / 2;
    const kinds = ['shop', 'shop', 'flat', 'flat', 'flat'];
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
    kinds.forEach((kind, i) => {
      const [fx, fz] = faces[i % faces.length];
      const extra = Math.floor(i / faces.length), n = Math.ceil((kinds.length - (i % faces.length)) / faces.length);
      const off = n > 1 ? (extra - (n - 1) / 2) * 3.6 : 0;
      const ax = fz ? 1 : 0, az = fx ? 1 : 0;
      const d = this._door(ch, bx + fx * a + ax * off, bz + fz * a + az * off, fx, fz, kind, r);
      if (kind === 'shop') this._sign(d.name, d.color, d.x - fx * 0.03 + 0, 3.3, d.z - fz * 0.03, fx ? (fx > 0 ? Math.PI / 2 : -Math.PI / 2) : (fz > 0 ? 0 : Math.PI), 2.4, 0.6);
    });
  }

  // the nearest street door within r metres of (x, z)
  doorNear(x, z, r) {
    let best = null, bd = r;
    const cx = Math.floor((x + 1000) / 21), cz = Math.floor((z + 1000) / 21);
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
      const a = this.doorGrid.get(i * 4096 + j); if (!a) continue;
      for (const d of a) { const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } }
    }
    return best;
  }

  // glowing glass skybridges between towers across a street
  _skybridges(chunkOf, r) {
    let made = 0;
    for (let tries = 0; tries < 400 && made < 14; tries++) {
      const alongX = r() < 0.5; // bridge spans along x (crossing a north-south road)
      const i = 1 + Math.floor(r() * (N - 1)), j = Math.floor(r() * N);
      if (i === 5 || j === 4 || j === 5) continue;
      const road = roadC(i), e0 = road - ROAD / 2 - 5, e1 = road + ROAD / 2 + 5;
      const plain = L => !['oct', 'round', 'setback', 'hero', 'stack', 'mega', 'corp'].includes(L.style);
      const A = this.lots.filter(L => plain(L) && (alongX ? (L.bi === i - 1 && L.bj === j && L.bx + L.lw / 2 > e0 - 0.5) : (L.bj === i - 1 && L.bi === j && L.bz + L.ld / 2 > e0 - 0.5)));
      const B = this.lots.filter(L => plain(L) && (alongX ? (L.bi === i && L.bj === j && L.bx - L.lw / 2 < e1 + 0.5) : (L.bj === i && L.bi === j && L.bz - L.ld / 2 < e1 + 0.5)));
      if (!A.length || !B.length) continue;
      const a = A[Math.floor(r() * A.length)], b = B[Math.floor(r() * B.length)];
      const lo = Math.max(alongX ? a.bz - a.ld / 2 : a.bx - a.lw / 2, alongX ? b.bz - b.ld / 2 : b.bx - b.lw / 2) + 3;
      const hi = Math.min(alongX ? a.bz + a.ld / 2 : a.bx + a.lw / 2, alongX ? b.bz + b.ld / 2 : b.bx + b.lw / 2) - 3;
      const top = Math.min(a.h, b.h) - 6;
      if (hi - lo < 4 || top < 34) continue;
      const y = 30 + r() * Math.min(40, top - 30), c = lo + r() * (hi - lo);
      const len = e1 - e0 + 1, mid = road, W = 4.2, H = 3.6;
      const ch = chunkOf(alongX ? i : j, alongX ? j : i);
      const x = alongX ? mid : c, z = alongX ? c : mid, ry = alongX ? 0 : Math.PI / 2;
      ch.details.add(new THREE.BoxGeometry(len, H, W), '#0d1830', x, y, z, 0, ry, 0);
      const col = ['#29f3ff', '#ff2bd6', '#ffa43a', '#8a4dff'][Math.floor(r() * 4)];
      for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const ox = alongX ? 0 : sz * (W / 2 + 0.05), oz = alongX ? sz * (W / 2 + 0.05) : 0;
        ch.trims.add(new THREE.BoxGeometry(len, 0.18, 0.18), col, x + ox, y + sy * (H / 2 - 0.1), z + oz, 0, ry, 0);
      }
      for (const sz of [-1, 1]) {
        const ox = alongX ? 0 : sz * (W / 2 + 0.06), oz = alongX ? sz * (W / 2 + 0.06) : 0;
        ch.trims.add(new THREE.BoxGeometry(len - 2, 1.0, 0.08), '#9fe9ff', x + ox, y + 0.2, z + oz, 0, ry, 0);
      }
      this.addBox(alongX ? { x0: x - len / 2, x1: x + len / 2, z0: z - W / 2, z1: z + W / 2, y0: y - H / 2, y1: y + H / 2 }
        : { x0: x - W / 2, x1: x + W / 2, z0: z - len / 2, z1: z + len / 2, y0: y - H / 2, y1: y + H / 2 });
      made++;
    }
  }

  _lotSigns(bx, bz, lw, ld, h, bx0, bz0, BS, r) {
    const faces = [];
    if (bx - lw / 2 < bx0 + 8) faces.push([-1, 0]);
    if (bx + lw / 2 > bx0 + BS - 8) faces.push([1, 0]);
    if (bz - ld / 2 < bz0 + 8) faces.push([0, -1]);
    if (bz + ld / 2 > bz0 + BS - 8) faces.push([0, 1]);
    for (const [fx, fz] of faces) {
      if (r() < 0.45) continue;
      const along = fx ? ld : lw;
      const fxPos = bx + fx * (lw / 2 + 0.35), fzPos = bz + fz * (ld / 2 + 0.35);
      const rotY = fx ? (fx > 0 ? Math.PI / 2 : -Math.PI / 2) : (fz > 0 ? 0 : Math.PI);
      const off = (r() - 0.5) * (along - 14);
      const px = fx ? fxPos : bx + off, pz = fz ? fzPos : bz + off;
      if (r() < 0.6) {
        const [t, c] = SIGN_TEXTS[Math.floor(r() * SIGN_TEXTS.length)];
        const y = 6 + r() * Math.min(40, h - 10);
        this._sign(t, c, px, y, pz, rotY, 12, 3, false);
      } else {
        const [t, c] = VERT_TEXTS[Math.floor(r() * VERT_TEXTS.length)];
        // vertical banner sticking out perpendicular to the wall
        const y = 8 + r() * Math.min(30, h - 18);
        const ox = fx * 1.6, oz = fz * 1.6;
        this._sign(t, c, px + ox, y, pz + oz, rotY + Math.PI / 2, 2.4, 9.6, true, true);
      }
      // a ground glow under it
      this.decals.push([px + fx * 3, pz + fz * 3, 7, new THREE.Color(SIGN_TEXTS[Math.floor(r() * SIGN_TEXTS.length)][1])]);
    }
  }

  _sign(text, color, x, y, z, rotY, w, h, double = false, vertical = false) {
    const key = text + '|' + color + '|' + vertical + '|' + double;
    let e = this.signGeos.get(key);
    if (!e) { e = { tex: signTexture(text, color, { vertical }), geos: [], double }; this.signGeos.set(key, e); }
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateY(rotY); g.translate(x, y, z);
    e.geos.push(g);
  }

  _finishSigns() {
    for (const e of this.signGeos.values()) {
      const m = new THREE.Mesh(mergeGeometries(e.geos), new THREE.MeshBasicMaterial({ map: e.tex, toneMapped: false, side: e.double ? THREE.DoubleSide : THREE.FrontSide }));
      this.root.add(m);
    }
  }

  _outerRing(r) {
    const lists = [[], [], [], [], [], []], beacons = new Parts();
    for (let k = 0; k < 190; k++) {
      const a = r() * Math.PI * 2, d = HALF + 70 + r() * 420;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.abs(x) < HALF + 40 && Math.abs(z) < HALF + 40) continue;
      // a skyline of the rest of the city: megabuildings and a few very tall towers
      const big = k % 9 === 0, mega = !big && k % 4 === 0;
      const w = big ? 34 + r() * 20 : mega ? 50 + r() * 30 : 20 + r() * 40, h = big ? 300 + r() * 200 : mega ? 120 + r() * 100 : 40 + r() * 220;
      const m = big ? 5 : mega ? 4 : k % 3;
      lists[m].push(this._uvBox(w, h, mega ? w * 0.5 : w, x, h / 2, z, new THREE.Color(0.6, 0.6, 0.7)));
      this.addBox({ x0: x - w / 2, x1: x + w / 2, z0: z - (mega ? w * 0.25 : w / 2), z1: z + (mega ? w * 0.25 : w / 2), y0: 0, y1: h });
      if (big || h > 200) beacons.box(1.6, 1.6, 1.6, '#ff1030', x, h + 2, z);
      if (big) beacons.box(w + 0.6, 0.6, 0.6, ['#29f3ff', '#ff2bd6', '#ffd27a'][k % 3], x, h - 4, z - w / 2);
    }
    lists.forEach((l, m) => { if (l.length) this.root.add(new THREE.Mesh(mergeGeometries(l), this.windowMats[m])); });
    this.root.add(new THREE.Mesh(beacons.build(), this.trimMat));
  }

  _lamps() {
    const poles = new Parts(), heads = new Parts();
    const pole = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
    for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
      const rc = roadC(i), a = roadC(j) + ROAD / 2, b = roadC(j + 1) - ROAD / 2;
      for (let t = a + 10; t < b - 4; t += 22) {
        for (const s of [-1, 1]) {
          const off = rc + s * (ROAD / 2 + 1.2);
          // lamp along road i (vertical, along z) and along road (horizontal, along x)
          for (const [x, z, ax, az] of [[off, t, -s, 0], [t, off, 0, -s]]) {
            if (Math.abs(x) > HALF + 2 || Math.abs(z) > HALF + 2) continue;
            poles.add(pole, '#2a2d3a', x, 3.5, z);
            this.addPole(x, z);
            poles.box(0.12, 0.12, 2.2, '#2a2d3a', x + ax * 1.0, 6.9, z + az * 1.0, 0, ax ? Math.PI / 2 : 0);
            const col = ((i + j) % 2) ? '#9fe9ff' : '#ff9ae6';
            heads.box(0.5, 0.15, 0.8, col, x + ax * 2.0, 6.82, z + az * 2.0, 0, ax ? Math.PI / 2 : 0);
            (this.lampHeads || (this.lampHeads = [])).push([x + ax * 2.0, 6.75, z + az * 2.0, col]);
            this.decals.push([x + ax * 2.2, z + az * 2.2, 6, new THREE.Color(col).multiplyScalar(0.55)]);
          }
        }
      }
    }
    const pm = new THREE.Mesh(poles.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    pm.castShadow = true; this.root.add(pm);
    this.root.add(new THREE.Mesh(heads.build(), this.trimMat));
  }

  _timesSquare() {
    // giant animated billboards facing the (0,0) intersection
    this.bbTex = [0, 1, 2, 3, 4].map(k => new Billboard(k));
    const add = (k, x, y, z, rotY, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.bbTex[k].tex, toneMapped: false }));
      m.position.set(x, y, z); m.rotation.y = rotY; this.root.add(m);
      // frame
      const f = new THREE.Mesh(new THREE.BoxGeometry(w + 1, h + 1, 0.4), new THREE.MeshLambertMaterial({ color: 0x101218 }));
      f.position.copy(m.position); f.rotation.y = rotY; f.translateZ(-0.3); this.root.add(f);
      if (y < 40) this.decals.push([x + Math.sin(rotY) * 8, z + Math.cos(rotY) * 8, 12, new THREE.Color(['#29f3ff', '#ff2bd6', '#ffa43a', '#29f3ff', '#ff1e3c'][k]).multiplyScalar(0.3)]);
    };
    const e = ROAD / 2 + 5 - 0.75; // building faces are 15 m from the road centre; billboards hang 0.75 m off them
    add(1, -e, 26, 30, Math.PI / 2, 26, 13);
    add(0, e, 30, -32, -Math.PI / 2, 30, 15);
    add(2, 30, 22, e, Math.PI, 26, 13);
    add(4, -32, 34, -e, 0, 30, 15);
    add(0, -e, 60, -32, Math.PI / 2, 30, 15);
    add(3, e, 56, 30, -Math.PI / 2, 26, 13);
    add(1, -30, 64, e, Math.PI, 26, 13);
    add(2, 32, 62, -e, 0, 26, 13);
    // more billboards along the central avenue
    for (let j = 0; j < N; j++) {
      if (j === 4 || j === 5) continue;
      const z = roadC(j) + CELL / 2;
      add(j % 5, -e, 24 + (j % 3) * 8, z, Math.PI / 2, 22, 11);
      if (j !== 6) add((j + 2) % 5, e, 30 + (j % 2) * 10, z + 8, -Math.PI / 2, 22, 11);
    }
    // floating holographic TIMES SQUARE sign above the intersection
    const ts = signTexture('TIMES SQUARE', '#ff2bd6', { bg: 'rgba(10,0,20,0.35)' });
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), new THREE.MeshBasicMaterial({ map: ts, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    holo.position.set(0, 24, 0); this.root.add(holo); this.tsHolo = holo;
    const holo2 = holo.clone(); holo2.rotation.y = Math.PI / 2; holo.add(holo2); holo2.position.set(0, 0, 0);
  }

  _skyLanes() {
    // Sky lanes along some avenues. Lane: {axis:'x'|'z', c (road coordinate), y, dir}
    this.skyLanes = [];
    const gl = new Parts();
    [1, 3, 5, 7, 9].forEach((i, k) => {
      const c = roadC(i), y = 90 + (k % 2) * 40;
      this.skyLanes.push({ axis: 'z', c: c - 6, y, dir: 1 }, { axis: 'z', c: c + 6, y, dir: -1 });
      this.skyLanes.push({ axis: 'x', c: c - 6, y: y + 20, dir: -1 }, { axis: 'x', c: c + 6, y: y + 20, dir: 1 });
      for (let t = -HALF; t <= HALF; t += 24) {
        for (const s of [-12, 12]) {
          gl.box(0.6, 0.6, 2.4, k % 2 ? '#ff2bd6' : '#29f3ff', c + s, y, t);
          gl.box(2.4, 0.6, 0.6, k % 2 ? '#29f3ff' : '#ffa43a', t, y + 20, c + s);
        }
      }
      // lane gates with signs
      for (const t of [-HALF + CELL * 2, 0, HALF - CELL * 2]) {
        gl.box(0.8, 10, 0.8, '#29f3ff', c - 13, y, t); gl.box(0.8, 10, 0.8, '#29f3ff', c + 13, y, t);
        gl.box(26.8, 0.8, 0.8, '#29f3ff', c, y + 5, t);
        this._sign('SKYLANE A' + (k + 1), '#29f3ff', c, y + 8, t, 0, 14, 3.5, true);
      }
    });
    this._finishSkySigns();
    this.root.add(new THREE.Mesh(gl.build(), this.trimMat));
  }
  _finishSkySigns() {
    // _skyLanes adds signs after _finishSigns, so build those separately
    for (const [k, e] of this.signGeos) {
      if (!k.startsWith('SKYLANE') || e.done) continue;
      e.done = true;
      this.root.add(new THREE.Mesh(mergeGeometries(e.geos), new THREE.MeshBasicMaterial({ map: e.tex, toneMapped: false, side: THREE.DoubleSide })));
    }
  }

  _decalsMesh() {
    const geos = this.decals.map(([x, z, s, c]) => {
      const g = new THREE.PlaneGeometry(s * 2, s * 2); g.rotateX(-Math.PI / 2); g.translate(x, 0.03, z);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({
      map: this.glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.45, toneMapped: false,
    }));
    m.renderOrder = 1;
    this.root.add(m);
  }

  // ---------- queries ----------
  // Push a circle (x,z,r) at height range [y0,y1] out of buildings. Returns {x,z,hit}.
  collide(x, z, r, y0 = 0, y1 = 2) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const seen = new Set();
      for (const ox of [-r, r]) for (const oz of [-r, r]) {
        const a = this.cellBoxes(x + ox, z + oz); if (!a) continue;
        for (const i of a) {
          if (seen.has(i)) continue; seen.add(i);
          const b = this.boxes[i];
          if (b.low || y1 < b.y0 || y0 > b.y1) continue;
          const cx = Math.max(b.x0, Math.min(x, b.x1)), cz = Math.max(b.z0, Math.min(z, b.z1));
          const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            hit = true;
            if (d2 > 1e-6) { const d = Math.sqrt(d2), p = (r - d) / d; x += dx * p; z += dz * p; }
            else { // centre inside box: push out along smallest axis
              const l = x - b.x0, rr = b.x1 - x, f = z - b.z0, k = b.z1 - z, mn = Math.min(l, rr, f, k);
              if (mn === l) x = b.x0 - r; else if (mn === rr) x = b.x1 + r; else if (mn === f) z = b.z0 - r; else z = b.z1 + r;
            }
          }
        }
      }
    }
    return { x, z, hit };
  }
  // ground height (top of low boxes such as the hover pad) at x,z
  groundAt(x, z, y = 0) {
    const a = this.cellBoxes(x, z); let g = 0;
    if (a) for (const i of a) { const b = this.boxes[i]; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= y + 0.6) g = Math.max(g, b.y1); }
    // highway ramps: a smooth slope
    for (const R of this.ramps) {
      const along = R.axis === 'z' ? z : x, across = R.axis === 'z' ? x - R.c : z - R.c;
      if (Math.abs(across) > R.half) continue;
      const t = (along - R.ua) / (R.ub - R.ua);
      if (t < 0 || t > 1) continue;
      const h = R.ha + (R.hb - R.ha) * t;
      if (h <= y + 0.6) g = Math.max(g, h);
    }
    return g;
  }
  roofAt(x, z) {
    const a = this.cellBoxes(x, z); let g = 0;
    if (a) for (const i of a) { const b = this.boxes[i]; if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) g = Math.max(g, b.y1); }
    return g;
  }
  inside(x, y, z) {
    const a = this.cellBoxes(x, z); if (!a) return false;
    for (const i of a) { const b = this.boxes[i]; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return true; }
    return false;
  }
  // Ray vs building boxes. Returns distance or maxD.
  raycast(o, d, maxD) {
    let best = maxD; const seen = new Set();
    if (o.y + d.y * maxD < 0 && d.y < 0) best = Math.min(best, -o.y / d.y);
    for (let t = 0; t <= best + 8; t += 8) {
      const x = o.x + d.x * t, z = o.z + d.z * t;
      for (const [ox, oz] of [[0, 0], [4, 4], [-4, -4], [4, -4], [-4, 4]]) {
        const a = this.cellBoxes(x + ox, z + oz); if (!a) continue;
        for (const i of a) {
          if (seen.has(i)) continue; seen.add(i);
          const b = this.boxes[i];
          const h = rayBox(o, d, b);
          if (h >= 0 && h < best) best = h;
        }
      }
    }
    return best;
  }

  update(dt, camPos, viewDist, time) {
    for (const c of this.chunks) {
      const dx = c.x - camPos.x, dz = c.z - camPos.z;
      c.group.visible = Math.hypot(dx, dz) - c.r < viewDist;
    }
    this.sky.position.copy(camPos);
    this._bbT = (this._bbT || 0) + dt;
    if (this._bbT > this.bbInterval) { for (const b of this.bbTex) b.update(this._bbT); this._bbT = 0; }
    if (this.tsHolo) { this.tsHolo.rotation.y = time * 0.3; this.tsHolo.position.y = 24 + Math.sin(time) * 0.5; }
    if (this.ads) this.ads.update(time);
    if (this.holos) this.holos.update(dt, time, camPos, viewDist);
    this.holoSky.material.opacity = 0.65 + Math.sin(time * 1.3) * 0.15;
  }
}
City.prototype.bbInterval = 0.12;

function rayBox(o, d, b) {
  let tmin = -Infinity, tmax = Infinity;
  const ax = [[o.x, d.x, b.x0, b.x1], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.z0, b.z1]];
  for (const [oo, dd, lo, hi] of ax) {
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
    let t1 = (lo - oo) / dd, t2 = (hi - oo) / dd;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (tmax < 0) return -1;
  return tmin >= 0 ? tmin : 0;
}
