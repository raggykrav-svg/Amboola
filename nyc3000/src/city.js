// Procedural neon city: buildings, ground, signs, billboards, lamps, sky lanes + collision.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY, windowTexture, groundTexture, signTexture, Billboard, glowTexture, skyTexture } from './textures.js';
import { Parts } from './models.js';

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
  ['SYNTH CITY', '#29f3ff'], ['ROBO TAXI', '#ffd23a'], ['HOTEL 3000', '#ff1e3c'], ['QUANTUM BURGER', '#ffa43a'],
  ['CHROME DOLLS', '#ff2bd6'], ['NEURAL LINK BAR', '#3aff9a'], ['24/7 HOLOSHOW', '#29f3ff'], ['CYBER DELI', '#ff1e3c'],
  ['ARCADE 9', '#3aff9a'], ['NOODLE BOTS', '#ffa43a'], ['PLASMA PIZZA', '#ff2bd6'], ['NYC 3000', '#29f3ff'],
];
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
    this.trimMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.signGeos = new Map(); // key -> {tex, geos[]}
    this.decals = [];
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
    for (let i = 0; i < nCh * nCh; i++) chunkData.push({ bodies: [[], [], []], trims: new Parts(), cx: 0, cz: 0 });
    for (let bi = 0; bi < N; bi++) for (let bj = 0; bj < N; bj++) {
      const ch = chunkData[Math.floor(bi / CH) * nCh + Math.floor(bj / CH)];
      this._block(bi, bj, ch, r);
    }
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
      this.root.add(g);
      this.chunks.push({ group: g, x: ch.cx, z: ch.cz, r: CELL * CH * 0.75 });
    });
    this._outerRing(r);
    this._lamps();
    this._finishSigns();
    this._timesSquare();
    this._skyLanes();
    this._decalsMesh();
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
    const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.25 });
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
    const pat = r();
    let lots;
    const G = 3;
    if (ts || pat < 0.15) lots = [[0, 0, S, S]];
    else if (pat < 0.35) lots = [[0, 0, S / 2 - G / 2, S], [S / 2 + G / 2, 0, S / 2 - G / 2, S]];
    else if (pat < 0.5) lots = [[0, 0, S, S / 2 - G / 2], [0, S / 2 + G / 2, S, S / 2 - G / 2]];
    else {
      const h = S / 2 - G / 2, o = S / 2 + G / 2;
      lots = [[0, 0, h, h], [o, 0, h, h], [0, o, h, h], [o, o, h, h]];
    }
    for (const [lx, lz, lw, ld] of lots) {
      let h = (40 + (1 - dCenter) * 140) * (0.45 + r() * 1.1);
      if (ts) h = 120 + r() * 60;
      if (r() < 0.06) h = 220 + r() * 60;
      h = Math.max(18, Math.min(290, Math.round(h / 4) * 4));
      const m = Math.floor(r() * 3);
      const tint = new THREE.Color().setHSL(0.6 + r() * 0.3, 0.2, 0.55 + r() * 0.35);
      const bx = x0 + lx + lw / 2, bz = z0 + lz + ld / 2;
      ch.bodies[m].push(this._uvBox(lw, h, ld, bx, h / 2, bz, tint));
      this.addBox({ x0: bx - lw / 2, x1: bx + lw / 2, z0: bz - ld / 2, z1: bz + ld / 2, y0: 0, y1: h });
      let topH = h, tw = lw, td = ld;
      // setback tiers
      if (h > 60 && r() < 0.6) {
        tw = lw * (0.55 + r() * 0.25); td = ld * (0.55 + r() * 0.25);
        const h2 = Math.round(h * (0.2 + r() * 0.35) / 4) * 4;
        ch.bodies[(m + 1) % 3].push(this._uvBox(tw, h2, td, bx, h + h2 / 2, bz, tint));
        this.addBox({ x0: bx - tw / 2, x1: bx + tw / 2, z0: bz - td / 2, z1: bz + td / 2, y0: h, y1: h + h2 });
        topH = h + h2;
      }
      // neon trims on corners
      const tc = ['#29f3ff', '#ff2bd6', '#8a4dff', '#ffa43a', '#ff1e3c'][Math.floor(r() * 5)];
      if (r() < 0.55) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ch.trims.box(0.35, h, 0.35, tc, bx + sx * (lw / 2 + 0.1), h / 2, bz + sz * (ld / 2 + 0.1));
      }
      // roof outline
      if (r() < 0.6) {
        ch.trims.box(tw + 0.4, 0.4, 0.3, tc, bx, topH + 0.2, bz - td / 2); ch.trims.box(tw + 0.4, 0.4, 0.3, tc, bx, topH + 0.2, bz + td / 2);
        ch.trims.box(0.3, 0.4, td + 0.4, tc, bx - tw / 2, topH + 0.2, bz); ch.trims.box(0.3, 0.4, td + 0.4, tc, bx + tw / 2, topH + 0.2, bz);
      }
      // horizontal light bands
      if (r() < 0.3) for (let y = 20; y < h - 10; y += 24 + Math.floor(r() * 3) * 8) {
        ch.trims.box(lw + 0.3, 0.3, 0.3, tc, bx, y, bz - ld / 2 - 0.1); ch.trims.box(lw + 0.3, 0.3, 0.3, tc, bx, y, bz + ld / 2 + 0.1);
      }
      // antenna
      if (topH > 100 && r() < 0.5) {
        const ah = 10 + r() * 25;
        ch.trims.box(0.4, ah, 0.4, '#30364a', bx, topH + ah / 2, bz);
        ch.trims.box(1.0, 1.0, 1.0, '#ff1030', bx, topH + ah, bz);
      }
      // street-facing signs
      this._lotSigns(bx, bz, lw, ld, h, bx0, bz0, BS, r);
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
    const lists = [[], [], []];
    for (let k = 0; k < 160; k++) {
      const a = r() * Math.PI * 2, d = HALF + 70 + r() * 420;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.abs(x) < HALF + 40 && Math.abs(z) < HALF + 40) continue;
      const w = 20 + r() * 40, h = 40 + r() * 220;
      lists[k % 3].push(this._uvBox(w, h, w, x, h / 2, z, new THREE.Color(0.6, 0.6, 0.7)));
      this.addBox({ x0: x - w / 2, x1: x + w / 2, z0: z - w / 2, z1: z + w / 2, y0: 0, y1: h });
    }
    lists.forEach((l, m) => { if (l.length) this.root.add(new THREE.Mesh(mergeGeometries(l), this.windowMats[m])); });
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
