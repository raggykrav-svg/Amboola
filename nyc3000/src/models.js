// Low-poly procedural models: people, guns, vehicles, drones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
// Collect primitive parts with vertex colors, merge into one geometry.
export class Parts {
  constructor() { this.list = []; }
  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    _c.set(color);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(g);
    return this;
  }
  box(w, h, d, color, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz); }
  build() { const g = this.list.length ? mergeGeometries(this.list) : new THREE.BufferGeometry(); g.computeBoundingSphere(); return g; }
}

export const MAT = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  paint: {},
};
export function paintMat(hex) {
  if (!MAT.paint[hex]) MAT.paint[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.3, metalness: 0.6, flatShading: true });
  return MAT.paint[hex];
}

function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = false; return m; }

// ---------- HUMANOIDS ----------
const humanGeoCache = {};
function humanGeos(kind) {
  if (humanGeoCache[kind]) return humanGeoCache[kind];
  const P = {
    soldier: { skin: '#4a5468', torso: '#5a6782', legs: '#3a4256', arm: '#5a6782', glow: '#29f3ff', head: '#3a4256' },
    cop: { skin: '#2c3a66', torso: '#2a4290', legs: '#1c2a5a', arm: '#2a4290', glow: '#ff2040', head: '#1c2a5a' },
    ped: { skin: '#c99a7a', torso: '#555', legs: '#2a2a35', arm: '#555', glow: '#ff2bd6', head: '#c99a7a' },
  }[kind];
  const parts = {};
  // torso (pivot at hips y=1.0)
  let b = new Parts(), gl = new Parts();
  b.box(0.56, 0.62, 0.32, P.torso, 0, 0.33, 0);
  if (kind !== 'ped') {
    b.box(0.6, 0.34, 0.36, kind === 'cop' ? '#3a5ab0' : '#7c8aa6', 0, 0.48, 0); // chest plate
    b.box(0.26, 0.16, 0.36, '#8a96b0', -0.38, 0.6, 0, 0, 0, 0.35); // shoulder pads
    b.box(0.26, 0.16, 0.36, '#8a96b0', 0.38, 0.6, 0, 0, 0, -0.35);
    b.box(0.42, 0.46, 0.18, '#3a4256', 0, 0.38, 0.24); // backpack
    gl.box(0.04, 0.26, 0.02, P.glow, -0.14, 0.5, -0.19);
    gl.box(0.04, 0.26, 0.02, P.glow, 0.14, 0.5, -0.19);
    gl.box(0.3, 0.05, 0.02, P.glow, 0, 0.24, 0.335);
    if (kind === 'cop') { gl.box(0.18, 0.08, 0.02, '#4aa0ff', 0, 0.6, -0.19); }
  } else {
    gl.box(0.58, 0.03, 0.34, P.glow, 0, 0.12, 0);
  }
  b.box(0.5, 0.12, 0.3, '#151821', 0, 0.02, 0); // belt
  parts.torso = { b: b.build(), g: gl.build() };
  // head (pivot at neck y=1.66)
  b = new Parts(); gl = new Parts();
  if (kind === 'ped') {
    b.box(0.26, 0.3, 0.27, P.head, 0, 0.17, 0);
    b.box(0.28, 0.1, 0.29, '#1a1410', 0, 0.3, 0.01);
  } else {
    b.box(0.32, 0.34, 0.34, P.head, 0, 0.18, 0);
    b.box(0.34, 0.08, 0.36, '#2c3446', 0, 0.34, 0);
    gl.box(0.28, 0.07, 0.02, P.glow, 0, 0.2, -0.175);
  }
  parts.head = { b: b.build(), g: gl.build() };
  // arm (pivot at shoulder, hangs down -y)
  b = new Parts(); gl = new Parts();
  b.box(0.15, 0.36, 0.16, P.arm, 0, -0.18, 0);
  b.box(0.14, 0.34, 0.15, kind === 'ped' ? P.skin : '#232a38', 0, -0.5, 0);
  if (kind !== 'ped') gl.box(0.155, 0.03, 0.155, P.glow, 0, -0.38, 0);
  parts.arm = { b: b.build(), g: gl.build() };
  // leg (pivot at hip)
  b = new Parts(); gl = new Parts();
  b.box(0.2, 0.5, 0.22, P.legs, 0, -0.25, 0);
  b.box(0.18, 0.42, 0.2, P.legs, 0, -0.7, 0);
  b.box(0.2, 0.1, 0.3, '#0c0d12', 0, -0.95, -0.04);
  if (kind !== 'ped') { b.box(0.21, 0.16, 0.06, '#3a4458', 0, -0.52, -0.12); gl.box(0.03, 0.2, 0.02, P.glow, 0, -0.72, -0.11); }
  parts.leg = { b: b.build(), g: gl.build() };
  humanGeoCache[kind] = parts;
  return parts;
}

const pedColors = ['#7a2b55', '#2b5d7a', '#555a66', '#6b4a2a', '#2a6b4a', '#83306b', '#3c3c88', '#8a7a2a', '#222'];
const pedMats = pedColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true }));

export class Humanoid {
  constructor(kind = 'ped') {
    const P = humanGeos(kind);
    this.kind = kind;
    const root = this.root = new THREE.Group();
    const bodyMat = kind === 'ped' ? null : MAT.body;
    const tint = kind === 'ped' ? pedMats[Math.floor(Math.random() * pedMats.length)] : null;
    const mk = (p, isTorso) => {
      const g = new THREE.Group();
      let mat = bodyMat;
      if (kind === 'ped') mat = isTorso ? tint : MAT.body;
      g.add(mesh(p.b, mat));
      if (p.g.attributes.position) g.add(mesh(p.g, MAT.glow, false));
      return g;
    };
    this.hips = new THREE.Group(); this.hips.position.y = 1.0; root.add(this.hips);
    this.torso = mk(P.torso, true); this.hips.add(this.torso);
    this.head = mk(P.head); this.head.position.y = 0.66; this.torso.add(this.head);
    this.armL = mk(P.arm, true); this.armL.position.set(-0.36, 0.6, 0); this.torso.add(this.armL);
    this.armR = mk(P.arm, true); this.armR.position.set(0.36, 0.6, 0); this.torso.add(this.armR);
    this.armL.rotation.order = 'YXZ'; this.armR.rotation.order = 'YXZ';
    this.legL = mk(P.leg); this.legL.position.set(-0.13, 0, 0); this.hips.add(this.legL);
    this.legR = mk(P.leg); this.legR.position.set(0.13, 0, 0); this.hips.add(this.legR);
    this.phase = Math.random() * 6;
    this.gun = null;
  }
  holdGun(gun) {
    if (!this.gunPivot) { this.gunPivot = new THREE.Group(); this.gunPivot.position.set(0.4, 0.5, -0.12); this.torso.add(this.gunPivot); }
    if (this.gun) this.gunPivot.remove(this.gun);
    this.gun = gun;
    if (gun) { gun.position.set(0, 0, -0.18); gun.scale.setScalar(this.kind === 'soldier' ? 1.25 : 1); this.gunPivot.add(gun); }
  }
  // speed in m/s; aimPitch (rad) when holding a gun
  animate(dt, speed, opts = {}) {
    this.phase += dt * (2 + speed * 1.6);
    const s = Math.min(1, speed / 3);
    const sw = Math.sin(this.phase) * 0.7 * s;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    this.hips.position.y = 1.0 + Math.abs(Math.cos(this.phase)) * 0.06 * s;
    if (opts.air) { this.legL.rotation.x = -0.6; this.legR.rotation.x = 0.3; }
    if (this.gun && opts.aim !== undefined) {
      // rifle stance: torso turned right, arms yawed back onto the aim line so the gun sits at the right shoulder
      const a = opts.aim;
      this.torso.rotation.y = 0;
      this.gunPivot.rotation.x = a;
      this.armR.rotation.set(1.05 + a, -0.1, 0);
      this.armL.rotation.set(Math.PI / 2 - 0.1 + a, -0.85, 0);
    } else if (opts.flail) {
      this.armL.rotation.set(Math.sin(this.phase * 2) * 1.2 + 2, 0, -0.3);
      this.armR.rotation.set(Math.cos(this.phase * 2) * 1.2 + 2, 0, 0.3);
    } else {
      this.armL.rotation.set(-sw * 0.8, 0, -0.06);
      this.armR.rotation.set(sw * 0.8, 0, 0.06);
      this.torso.rotation.y = 0;
    }
  }
}

// ---------- GUNS ----------
export const WEAPONS = [
  { id: 'rifle', name: 'PLASMA RIFLE', mag: 28, reserve: 120, rate: 0.1, dmg: 18, speed: 115, spread: 0.012, auto: true, color: 0x29f3ff, pellets: 1, reload: 1.6, sound: 'rifle' },
  { id: 'pistol', name: 'PULSE PISTOL', mag: 12, reserve: 72, rate: 0.22, dmg: 34, speed: 130, spread: 0.006, auto: false, color: 0xff2bd6, pellets: 1, reload: 1.1, sound: 'pistol' },
  { id: 'shotgun', name: 'SCATTER CANNON', mag: 6, reserve: 30, rate: 0.75, dmg: 13, speed: 100, spread: 0.07, auto: false, color: 0xffa43a, pellets: 8, reload: 2.0, sound: 'shotgun' },
];

export function makeGun(id) {
  const b = new Parts(), g = new Parts();
  const grp = new THREE.Group();
  let muzzleZ = -0.9;
  if (id === 'rifle') {
    b.box(0.1, 0.16, 0.7, '#2b3140', 0, 0.02, -0.25);
    b.box(0.08, 0.08, 0.38, '#3a4152', 0, 0.04, -0.75);
    b.box(0.07, 0.2, 0.1, '#1a1d26', 0, -0.1, -0.05, 0.3);
    b.box(0.08, 0.16, 0.12, '#1a1d26', 0, -0.07, -0.32);
    b.box(0.06, 0.06, 0.2, '#1a1d26', 0, 0.14, -0.25);
    b.box(0.09, 0.12, 0.25, '#2b3140', 0, 0, 0.18);
    g.box(0.11, 0.03, 0.5, '#29f3ff', 0, 0.06, -0.3);
    g.box(0.09, 0.09, 0.04, '#29f3ff', 0, 0.04, -0.6);
    g.box(0.09, 0.09, 0.04, '#29f3ff', 0, 0.04, -0.7);
    g.box(0.05, 0.05, 0.05, '#7dffff', 0, 0.04, -0.95);
    g.box(0.1, 0.1, 0.02, '#29f3ff', 0, 0, 0.31);
    g.box(0.07, 0.03, 0.22, '#7dffff', 0, 0.18, -0.25);
    muzzleZ = -0.98;
  } else if (id === 'pistol') {
    b.box(0.08, 0.13, 0.36, '#2b2a38', 0, 0.04, -0.12);
    b.box(0.07, 0.2, 0.09, '#1a1d26', 0, -0.08, 0.0, 0.25);
    g.box(0.085, 0.03, 0.26, '#ff2bd6', 0, 0.08, -0.14);
    g.box(0.05, 0.05, 0.04, '#ffa0ff', 0, 0.04, -0.31);
    muzzleZ = -0.34;
  } else {
    b.box(0.14, 0.16, 0.6, '#3a2d26', 0, 0.02, -0.2);
    b.box(0.12, 0.12, 0.45, '#4a3a30', 0, 0.06, -0.62);
    b.box(0.08, 0.22, 0.1, '#1a1d26', 0, -0.1, -0.02, 0.3);
    b.box(0.1, 0.14, 0.28, '#2a201b', 0, 0, 0.2);
    g.box(0.145, 0.04, 0.4, '#ffa43a', 0, -0.06, -0.3);
    g.box(0.13, 0.13, 0.03, '#ffd27a', 0, 0.06, -0.85);
    muzzleZ = -0.88;
  }
  grp.add(mesh(b.build(), MAT.body));
  grp.add(mesh(g.build(), MAT.glow, false));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.04, muzzleZ); grp.add(muzzle);
  grp.userData.muzzle = muzzle;
  return grp;
}

// ---------- VEHICLES ----------
// Vehicle front is -Z. Lengths ~4.6m.
function taper(geo, frontY, frontX, zSign = -1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (Math.sign(p.getZ(i)) === zSign) {
      if (p.getY(i) > 0) p.setY(i, p.getY(i) * frontY);
      p.setX(i, p.getX(i) * frontX);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

const vehGeoCache = {};
export const VEHICLE_TYPES = {
  sedan: { name: 'NEO-SEDAN', flying: false, maxSpeed: 52, accel: 14, armor: 100 },
  muscle: { name: 'VOLT RUNNER', flying: false, maxSpeed: 60, accel: 17, armor: 120 },
  police: { name: 'NYPD INTERCEPTOR', flying: false, maxSpeed: 62, accel: 18, armor: 160, police: true },
  hover: { name: 'HOVER SPORTS CAR', flying: true, maxSpeed: 95, accel: 24, armor: 110, cannon: true },
  taxi: { name: 'SKY TAXI', flying: true, maxSpeed: 75, accel: 18, armor: 120, cannon: true },
  flypolice: { name: 'NYPD SKY CRUISER', flying: true, maxSpeed: 100, accel: 26, armor: 180, police: true, cannon: true },
};

function vehicleGeos(type) {
  if (vehGeoCache[type]) return vehGeoCache[type];
  const paint = new Parts(), det = new Parts(), glow = new Parts();
  const flying = VEHICLE_TYPES[type].flying;
  if (!flying) {
    const L = type === 'muscle' ? 4.9 : 4.6, W = 2.0;
    paint.add(taper(new THREE.BoxGeometry(W, 0.62, L, 1, 1, 1), 0.75, 0.96), '#fff', 0, 0.62, 0);
    paint.add(taper(new THREE.BoxGeometry(W * 0.86, 0.55, L * 0.5), 0.6, 0.9, -1), '#fff', 0, 1.18, 0.25);
    det.box(W * 0.88, 0.42, L * 0.38, '#0b1220', 0, 1.15, 0.28); // glass band (slightly inset/out)
    det.box(W * 0.8, 0.02, L * 0.36, '#0b1220', 0, 1.47, 0.28);
    const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    for (const [x, z] of [[-0.95, -1.45], [0.95, -1.45], [-0.95, 1.45], [0.95, 1.45]]) {
      det.add(wheel, '#0a0a0e', x, 0.38, z, 0, 0, Math.PI / 2);
      glow.add(new THREE.CylinderGeometry(0.2, 0.2, 0.31, 8), type === 'police' ? '#4aa0ff' : '#ff2bd6', x, 0.38, z, 0, 0, Math.PI / 2);
    }
    det.box(W * 1.01, 0.14, L * 1.01, '#15161c', 0, 0.36, 0);
    glow.box(0.5, 0.12, 0.05, '#e8f6ff', -0.6, 0.72, -L / 2 - 0.01);
    glow.box(0.5, 0.12, 0.05, '#e8f6ff', 0.6, 0.72, -L / 2 - 0.01);
    glow.box(W * 0.9, 0.08, 0.05, '#ff1e3c', 0, 0.78, L / 2 + 0.01);
    glow.box(0.04, 0.05, L * 0.9, type === 'police' ? '#4aa0ff' : '#29f3ff', -W / 2 - 0.01, 0.46, 0);
    glow.box(0.04, 0.05, L * 0.9, type === 'police' ? '#4aa0ff' : '#29f3ff', W / 2 + 0.01, 0.46, 0);
    if (type === 'police') {
      det.box(1.2, 0.12, 0.4, '#111', 0, 1.53, 0.2);
      det.box(0.02, 0.3, 1.4, '#e8e8f0', -W / 2 - 0.005, 0.66, 0);
      det.box(0.02, 0.3, 1.4, '#e8e8f0', W / 2 + 0.005, 0.66, 0);
    }
    if (type === 'muscle') { det.box(1.6, 0.06, 0.3, '#111', 0, 1.05, L / 2 - 0.15); }
  } else {
    const L = type === 'flypolice' ? 5.2 : 4.8, W = type === 'taxi' ? 2.2 : 2.1;
    paint.add(taper(new THREE.BoxGeometry(W, 0.7, L), 0.45, 0.7), '#fff', 0, 0.55, 0);
    paint.add(taper(new THREE.BoxGeometry(W * 0.7, 0.55, L * 0.5), 0.35, 0.8, -1), '#fff', 0, 1.05, 0.35);
    det.add(taper(new THREE.BoxGeometry(W * 0.72, 0.5, L * 0.46), 0.3, 0.78, -1), '#0a1426', 0, 1.06, 0.3, 0, 0, 0, 1.01, 1.02, 1.0);
    // side thruster pods
    for (const s of [-1, 1]) {
      det.box(0.5, 0.42, 1.6, '#1a1c26', s * (W / 2 + 0.2), 0.45, 0.9);
      det.box(0.5, 0.4, 1.0, '#1a1c26', s * (W / 2 + 0.15), 0.45, -1.2);
      glow.add(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 10), type === 'flypolice' ? '#4aa0ff' : '#29f3ff', s * (W / 2 + 0.2), 0.22, 0.9);
      glow.add(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 10), type === 'flypolice' ? '#4aa0ff' : '#29f3ff', s * (W / 2 + 0.15), 0.23, -1.2);
      glow.box(0.32, 0.26, 0.05, '#ff3a6a', s * (W / 2 + 0.2), 0.45, 1.71);
    }
    glow.box(W * 0.7, 0.06, 0.05, '#ff1e3c', 0, 0.75, L / 2 + 0.01);
    glow.box(W * 0.5, 0.05, 0.05, '#e8f6ff', 0, 0.5, -L / 2 - 0.01);
    glow.box(0.03, 0.03, L * 0.8, type === 'taxi' ? '#ffd23a' : '#ff2bd6', -W / 2 - 0.005, 0.62, 0);
    glow.box(0.03, 0.03, L * 0.8, type === 'taxi' ? '#ffd23a' : '#ff2bd6', W / 2 + 0.005, 0.62, 0);
    if (type === 'flypolice') { det.box(1.2, 0.12, 0.4, '#111', 0, 1.36, 0.4); }
    if (type === 'taxi') { det.box(0.8, 0.22, 0.3, '#111', 0, 1.36, 0.35); glow.box(0.7, 0.16, 0.31, '#ffd23a', 0, 1.36, 0.35); }
  }
  const out = { paint: paint.build(), det: det.build(), glow: glow.build() };
  vehGeoCache[type] = out;
  return out;
}

const sirenGeo = new THREE.BoxGeometry(0.5, 0.12, 0.34);
const sirenRed = new THREE.MeshBasicMaterial({ color: 0xff1030, toneMapped: false });
const sirenBlue = new THREE.MeshBasicMaterial({ color: 0x2060ff, toneMapped: false });
export function flashSirens(t) {
  const a = Math.floor(t * 6) % 2;
  sirenRed.color.setHex(a ? 0xff1030 : 0x200005);
  sirenBlue.color.setHex(a ? 0x050820 : 0x2060ff);
}

export const PAINTS = ['#c01848', '#1a6bd8', '#e8e8f0', '#202028', '#7a2bd8', '#16a08a', '#d86a16', '#8a1010', '#3a3f4a'];
export function makeVehicleMesh(type, paintHex) {
  const G = vehicleGeos(type);
  const grp = new THREE.Group();
  const color = type === 'police' || type === 'flypolice' ? '#14161e' : type === 'taxi' ? '#f2c21a' : paintHex;
  const body = new THREE.Group(); grp.add(body);
  body.add(mesh(G.paint, paintMat(color)));
  body.add(mesh(G.det, MAT.body));
  body.add(mesh(G.glow, MAT.glow, false));
  if (VEHICLE_TYPES[type].police) {
    const y = type === 'police' ? 1.64 : 1.47, z = type === 'police' ? 0.2 : 0.4;
    const r = new THREE.Mesh(sirenGeo, sirenRed); r.position.set(-0.32, y, z); body.add(r);
    const b = new THREE.Mesh(sirenGeo, sirenBlue); b.position.set(0.32, y, z); body.add(b);
  }
  grp.userData.body = body;
  return grp;
}

// ---------- DRONE ----------
let droneGeo = null;
export function makeDrone(police = false) {
  if (!droneGeo) {
    const b = new Parts(), g = new Parts();
    b.add(new THREE.IcosahedronGeometry(0.6, 0), '#1c1f2a', 0, 0, 0, 0, 0, 0, 1, 0.7, 1);
    b.box(1.9, 0.08, 0.16, '#2a2f3d', 0, 0.1, 0, 0, Math.PI / 4);
    b.box(1.9, 0.08, 0.16, '#2a2f3d', 0, 0.1, 0, 0, -Math.PI / 4);
    b.box(0.12, 0.12, 0.5, '#111', -0.3, -0.25, -0.3);
    b.box(0.12, 0.12, 0.5, '#111', 0.3, -0.25, -0.3);
    for (const [x, z] of [[0.67, 0.67], [-0.67, 0.67], [0.67, -0.67], [-0.67, -0.67]]) {
      g.add(new THREE.TorusGeometry(0.28, 0.035, 4, 12), '#ffffff', x, 0.14, z, Math.PI / 2);
    }
    g.add(new THREE.SphereGeometry(0.18, 8, 6), '#ffffff', 0, -0.02, -0.5);
    droneGeo = { b: b.build(), g: g.build() };
  }
  const grp = new THREE.Group();
  grp.add(mesh(droneGeo.b, MAT.body));
  const gm = new THREE.MeshBasicMaterial({ color: police ? 0x4aa0ff : 0xff1e3c, toneMapped: false });
  const gl = mesh(droneGeo.g, gm, false); grp.add(gl);
  grp.userData.glowMat = gm;
  return grp;
}

// Ammo / health pickup crate
const pickupGeo = {};
export function makePickup(kind) {
  const grp = new THREE.Group();
  if (!pickupGeo[kind]) {
    const b = new Parts(), g = new Parts(), c = kind === 'health' ? '#3aff7a' : '#ffa43a';
    b.box(0.7, 0.45, 0.5, '#1d2230', 0, 0, 0);
    g.box(0.72, 0.08, 0.52, c, 0, 0.08, 0);
    g.box(0.2, 0.2, 0.54, c, 0, -0.05, 0);
    if (kind === 'health') g.box(0.54, 0.08, 0.2, c, 0, 0.06, 0); // plus sign on top
    pickupGeo[kind] = { b: b.build(), g: g.build() };
  }
  grp.add(mesh(pickupGeo[kind].b, MAT.body));
  grp.add(mesh(pickupGeo[kind].g, MAT.glow, false));
  return grp;
}
