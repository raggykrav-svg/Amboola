// Procedural people: one skinned mesh per character (one draw call), 17 bones,
// knees and elbows, two-bone arm IK so the hands really hold the gun, and a
// dozen pedestrian looks (hair, hoods, caps, coats, neon trims, umbrellas).
import * as THREE from 'three';
import { Parts, MAT } from './parts.js';
import { modelNode, modelNames, flatten } from './assets.js';

// ---- skeleton (rest pose, metres, character faces -Z) ----
const BONES = [
  // name, parent, local offset
  ['root', -1, [0, 0, 0]],
  ['hips', 0, [0, 0.95, 0]],
  ['spine', 1, [0, 0.1, 0]],
  ['chest', 2, [0, 0.2, 0]],
  ['head', 3, [0, 0.31, 0]],
  ['uaL', 3, [-0.21, 0.22, 0]], ['faL', 5, [0, -0.3, 0]], ['hdL', 6, [0, -0.27, 0]],
  ['uaR', 3, [0.21, 0.22, 0]], ['faR', 8, [0, -0.3, 0]], ['hdR', 9, [0, -0.27, 0]],
  ['thL', 1, [-0.1, -0.02, 0]], ['shL', 11, [0, -0.43, 0]], ['ftL', 12, [0, -0.44, 0]],
  ['thR', 1, [0.1, -0.02, 0]], ['shR', 14, [0, -0.43, 0]], ['ftR', 15, [0, -0.44, 0]],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const REST = []; // world-space rest offsets
BONES.forEach(([, p, o], i) => { REST[i] = p < 0 ? new THREE.Vector3(...o) : REST[p].clone().add(new THREE.Vector3(...o)); });
const UA = 0.3, FA = 0.27; // upper arm, forearm lengths

function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];

// Part builder bound to bones: on(boneName) then add parts in that bone's local space.
function rig() {
  const P = new Parts({ glow: true, bones: true });
  const m = new THREE.Matrix4();
  P.on = name => { const i = BI[name]; m.makeTranslation(REST[i].x, REST[i].y, REST[i].z); P.bone(i, m.clone()); P.lit(); return P; };
  return P;
}

// ---------- body builders ----------
function limbs(P, c) {
  // c: { upper, lower, glove, thigh, shin, boot, glow, armor, plates }
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? -1 : 1;
    P.on('ua' + s).capsule(0.066, 0.17, c.upper, 0, -0.15, 0);
    if (c.plates) P.slab(0.15, 0.16, 0.15, c.armor, sx * 0.01, -0.08, 0, 0, 0, sx * 0.12);
    P.on('fa' + s).capsule(0.058, 0.15, c.lower, 0, -0.13, 0);
    if (c.plates) { P.slab(0.135, 0.16, 0.135, c.armor, 0, -0.16, 0); P.glow().box(0.14, 0.022, 0.14, c.glow, 0, -0.09, 0).lit(); }
    else if (c.cuff) P.glow().box(0.125, 0.025, 0.125, c.cuff, 0, -0.22, 0).lit();
    P.on('hd' + s).box(0.085, 0.11, 0.07, c.glove, 0, -0.05, 0);
    P.box(0.03, 0.06, 0.03, c.glove, sx * -0.045, -0.04, -0.03);
    P.on('th' + s).capsule(0.086, 0.27, c.thigh, 0, -0.22, 0);
    if (c.plates) P.slab(0.17, 0.2, 0.08, c.armor, 0, -0.18, -0.07);
    P.on('sh' + s).capsule(0.07, 0.29, c.shin, 0, -0.22, 0);
    if (c.plates) { P.slab(0.13, 0.26, 0.07, c.armor, 0, -0.2, -0.065); P.glow().box(0.025, 0.16, 0.02, c.glow, 0, -0.2, -0.105).lit(); }
    P.on('ft' + s).slab(0.13, 0.11, 0.27, c.boot, 0, -0.01, -0.05);
    P.box(0.135, 0.03, 0.28, '#0b0c10', 0, -0.06, -0.05);
  }
}

function buildSoldier(cop) {
  const P = rig();
  const armor = cop ? '#2a4ab0' : '#7f8ca8', under = cop ? '#16203f' : '#2b3244', dark = '#1a1d26';
  const glow = cop ? '#ff2a3c' : '#29f3ff', accent = cop ? '#4aa0ff' : '#29f3ff';
  limbs(P, { upper: under, lower: under, glove: dark, thigh: under, shin: under, boot: '#15171d', glow, armor, plates: true });
  P.on('hips').slab(0.36, 0.2, 0.24, under, 0, 0.02, 0);
  P.box(0.4, 0.07, 0.27, '#14161c', 0, 0.1, 0);
  P.glow().box(0.08, 0.05, 0.02, glow, 0, 0.1, -0.14).lit();
  P.box(0.1, 0.12, 0.08, dark, -0.17, -0.02, -0.04); P.box(0.1, 0.12, 0.08, dark, 0.17, -0.02, -0.04);
  P.on('spine').slab(0.33, 0.24, 0.22, under, 0, 0.1, 0);
  P.slab(0.3, 0.16, 0.06, armor, 0, 0.1, -0.1);
  P.on('chest').slab(0.46, 0.36, 0.28, under, 0, 0.13, 0);
  P.slab(0.48, 0.27, 0.1, armor, 0, 0.17, -0.12);
  P.slab(0.42, 0.24, 0.08, armor, 0, 0.16, 0.13);
  P.glow().box(0.03, 0.18, 0.02, glow, -0.12, 0.17, -0.175).box(0.03, 0.18, 0.02, glow, 0.12, 0.17, -0.175).box(0.14, 0.03, 0.02, accent, 0, 0.06, -0.175).lit();
  P.slab(0.22, 0.13, 0.28, armor, -0.29, 0.25, 0, 0, 0, 0.35); P.slab(0.22, 0.13, 0.28, armor, 0.29, 0.25, 0, 0, 0, -0.35);
  P.glow().box(0.16, 0.025, 0.02, glow, -0.29, 0.255, -0.145, 0, 0, 0.35).box(0.16, 0.025, 0.02, glow, 0.29, 0.255, -0.145, 0, 0, -0.35).lit();
  P.slab(0.36, 0.42, 0.17, cop ? '#1c2a55' : '#323a4c', 0, 0.12, 0.23);
  P.glow().box(0.26, 0.03, 0.02, glow, 0, 0.26, 0.32).box(0.26, 0.03, 0.02, glow, 0, 0.2, 0.32).lit();
  P.cyl(0.012, 0.012, 0.3, 4, '#222', 0.13, 0.42, 0.25); P.glow().sphere(0.025, cop ? '#ff2a3c' : '#ff2bd6', 0.13, 0.58, 0.25).lit();
  P.cyl(0.13, 0.15, 0.06, 8, dark, 0, 0.3, 0);
  if (cop) { P.glow().box(0.09, 0.07, 0.02, '#ffd23a', -0.14, 0.24, -0.175).lit(); P.glow().sphere(0.035, '#2060ff', -0.31, 0.33, 0).sphere(0.035, '#ff1030', 0.31, 0.33, 0).lit(); }
  P.on('head').cyl(0.065, 0.075, 0.1, 8, dark, 0, 0.04, 0);
  P.sphere(0.145, armor, 0, 0.16, 0.01, 1, 1.08, 1.12, 10, 8);
  P.box(0.27, 0.075, 0.12, dark, 0, 0.15, -0.1);
  P.glow().box(0.25, 0.05, 0.03, glow, 0, 0.155, -0.155).lit();
  P.slab(0.2, 0.09, 0.12, dark, 0, 0.06, -0.08);
  P.box(0.04, 0.05, 0.26, armor, 0, 0.31, 0.02);
  P.box(0.04, 0.09, 0.09, dark, -0.15, 0.15, 0.02); P.box(0.04, 0.09, 0.09, dark, 0.15, 0.15, 0.02);
  if (!cop) P.glow().box(0.045, 0.012, 0.045, accent, -0.172, 0.15, 0.02).lit();
  return P.build();
}

const SKIN = ['#f1c7a5', '#e0ac85', '#c48a62', '#a06a45', '#7a4c30', '#5a3624'];
const HAIR = ['#15110f', '#2e1d12', '#5b3a22', '#b98a48', '#d9d9df', '#e23a9c', '#2ab8ff', '#7a3bff'];
const TOP = ['#2a2f45', '#5a1d3a', '#1d4a5a', '#3b3b42', '#4a2a8a', '#9a2b30', '#16695a', '#b8862a', '#d9d9e2', '#1f1f24'];
const PANTS = ['#1b1d26', '#25252e', '#343a52', '#3e3226', '#121214', '#3a2a3e'];
const NEON = ['#ff2bd6', '#29f3ff', '#ffa43a', '#3aff9a', '#8a4dff', '#ff3a4a'];

function buildPed(seed) {
  const r = rng(seed * 7919 + 13);
  const skin = pick(r, SKIN), hair = pick(r, HAIR), top = pick(r, TOP), pants = pick(r, PANTS), neon = pick(r, NEON);
  const coat = r() < 0.3, hood = r() < 0.2, cap = !hood && r() < 0.2, visor = r() < 0.3, umbrella = r() < 0.28, pack = !umbrella && r() < 0.25;
  const long = !hood && !cap && r() < 0.35, mohawk = !hood && !cap && !long && r() < 0.15;
  const female = r() < 0.5;
  const P = rig();
  limbs(P, { upper: top, lower: coat ? top : (r() < 0.5 ? top : skin), glove: skin, thigh: pants, shin: pants, boot: pick(r, ['#111', '#2a1c14', '#e8e8ee', '#3a3a44']), cuff: r() < 0.5 ? neon : null });
  P.on('hips').slab(female ? 0.34 : 0.32, 0.2, 0.22, pants, 0, 0.02, 0);
  P.box(0.34, 0.05, 0.23, '#151518', 0, 0.1, 0);
  if (coat) { P.slab(0.38, 0.32, 0.26, top, 0, -0.08, 0); P.glow().box(0.02, 0.3, 0.02, neon, 0, -0.08, -0.135).lit(); }
  P.on('spine').slab(female ? 0.3 : 0.32, 0.24, 0.2, top, 0, 0.1, 0);
  P.on('chest').slab(female ? 0.4 : 0.44, 0.34, 0.25, top, 0, 0.13, 0);
  if (r() < 0.6) P.glow().box(0.02, 0.28, 0.02, neon, -0.1, 0.13, -0.128).box(0.02, 0.28, 0.02, neon, 0.1, 0.13, -0.128).lit();
  else P.glow().box(0.42, 0.025, 0.02, neon, 0, 0.2, -0.128).lit();
  if (coat) P.slab(0.46, 0.08, 0.27, top, 0, 0.28, 0);
  if (pack) { P.slab(0.3, 0.34, 0.13, pick(r, ['#222', '#3a3f55', '#5a1d3a']), 0, 0.12, 0.19); P.glow().box(0.2, 0.02, 0.02, neon, 0, 0.22, 0.26).lit(); }
  P.on('head').cyl(0.05, 0.055, 0.1, 6, skin, 0, 0.04, 0);
  P.sphere(0.115, skin, 0, 0.16, 0, 0.95, 1.12, 1.02, 10, 8);
  P.box(0.03, 0.05, 0.04, skin, 0, 0.13, -0.12);
  if (visor) P.glow().box(0.22, 0.04, 0.04, neon, 0, 0.18, -0.105).lit();
  else { P.box(0.04, 0.02, 0.02, '#111', -0.045, 0.19, -0.11); P.box(0.04, 0.02, 0.02, '#111', 0.045, 0.19, -0.11); }
  if (hood) { P.sphere(0.15, top, 0, 0.17, 0.02, 1.05, 1.12, 1.1, 10, 8); P.glow().box(0.2, 0.02, 0.02, neon, 0, 0.27, -0.13).lit(); P.box(0.24, 0.26, 0.04, '#000', 0, 0.14, -0.135); P.sphere(0.115, skin, 0, 0.15, -0.02, 0.9, 1.0, 0.9, 10, 8); }
  else if (cap) { P.sphere(0.125, pick(r, ['#c0393b', '#222', '#1d4a5a', '#e8e8ee']), 0, 0.22, 0, 1, 0.6, 1, 10, 6); P.box(0.2, 0.025, 0.14, '#111', 0, 0.21, -0.12); }
  else {
    P.sphere(0.12, hair, 0, 0.21, 0.015, 1.0, 0.75, 1.05, 10, 6);
    if (long) P.box(0.2, 0.3, 0.06, hair, 0, 0.06, 0.09);
    if (mohawk) P.glow().box(0.04, 0.12, 0.24, neon, 0, 0.32, 0.02).lit();
    if (female && !long && r() < 0.5) P.sphere(0.06, hair, 0, 0.26, 0.11);
  }
  if (umbrella) {
    // umbrella in the left hand; the hand bone is counter-rotated so the shaft stays upright
    P.on('hdL').cyl(0.012, 0.012, 1.0, 5, '#222', 0, 0.42, 0);
    const c = pick(r, NEON);
    P.add(new THREE.ConeGeometry(0.62, 0.26, 10, 1, true), '#14141c', 0, 0.98, 0);
    P.add(new THREE.ConeGeometry(0.6, 0.25, 10, 1, true), '#20202c', 0, 0.965, 0, Math.PI, 0, 0, 1, -1, 1);
    P.glow().add(new THREE.TorusGeometry(0.62, 0.015, 4, 20), c, 0, 0.85, 0, Math.PI / 2).lit();
    P.glow().sphere(0.03, c, 0, 1.12, 0).lit();
  }
  return { geo: P.build(), umbrella, scale: female ? 0.94 + r() * 0.06 : 0.98 + r() * 0.08 };
}

// ---------- Blender people (public/models/people.glb) ----------
// Skinned to the same bone names, bound in an A-pose (keep in sync with blender/people.py).
const ARM_A = 0.62, LEG_B = 0.10;
const allDetail = () => 'det';
function blenderVariant(kind) {
  const node = modelNode('people', 'p_' + kind);
  if (!node) return null;
  const hi = flatten(node, allDetail, { glow: true, bones: BI });
  const low = modelNode('people', 'p_' + kind + '_lod1');
  const lo = low ? flatten(low, allDetail, { glow: true, bones: BI }) : hi;
  return { blender: true, geo: hi.det, geo1: lo.det, scale: node.userData.scale || 1, umbrella: !!node.userData.umbrella };
}

const cache = {};
function variant(kind) {
  if (cache[kind]) return cache[kind];
  let v = blenderVariant(kind);
  if (!v) {
    if (kind === 'soldier') v = { geo: buildSoldier(false), scale: 1 };
    else if (kind === 'cop') v = { geo: buildSoldier(true), scale: 1.02 };
    else v = buildPed(parseInt(kind.slice(3), 10) || 0);
  }
  cache[kind] = v;
  return v;
}
export const PED_VARIANTS = 14;
// a pedestrian look for number n, skipping the ones that carry an umbrella (shop clerks)
export function pedKindFor(n) {
  const count = pedVariants();
  for (let k = 0; k < count; k++) {
    const kind = 'ped' + ((n + k) % count);
    if (!variant(kind).umbrella) return kind;
  }
  return 'ped0';
}
let pedCount = 0;
function pedVariants() {
  if (!pedCount) pedCount = modelNames('people', 'p_ped').filter(n => !n.endsWith('_lod1')).length || PED_VARIANTS;
  return pedCount;
}

// ---------- IK ----------
const _t = new THREE.Vector3();
// Aim the arm (upper arm bone with rotation order YXZ, forearm bends about X) so the wrist reaches `target` (chest space).
function reach(ua, fa, shoulder, target, elbowOut = 0) {
  _t.subVectors(target, shoulder);
  const f = Math.hypot(_t.x, _t.z), u = _t.y;
  const d = Math.min(Math.max(_t.length(), 0.08), UA + FA - 0.002);
  const yaw = Math.atan2(-_t.x, -_t.z);
  const alpha = Math.atan2(f, -u);
  const beta = Math.acos(THREE.MathUtils.clamp((UA * UA + d * d - FA * FA) / (2 * UA * d), -1, 1));
  const gamma = Math.acos(THREE.MathUtils.clamp((UA * UA + FA * FA - d * d) / (2 * UA * FA), -1, 1));
  ua.rotation.set(alpha - beta, yaw, elbowOut);
  fa.rotation.set(Math.PI - gamma, 0, 0);
}

const SHOULDER_L = new THREE.Vector3(-0.21, 0.22, 0), SHOULDER_R = new THREE.Vector3(0.21, 0.22, 0);
const _g = new THREE.Vector3(), _f = new THREE.Vector3(), _inv = new THREE.Matrix4();
const BLADE = -0.5; // rifle stance: chest turned so the left shoulder leads

export class Humanoid {
  constructor(kind = 'ped') {
    if (kind === 'ped') kind = 'ped' + Math.floor(Math.random() * pedVariants());
    this.kind = kind;
    const v = variant(kind);
    this.umbrella = !!v.umbrella;
    this.armOut = v.blender ? 0.14 : 0.08; // smooth bodies need the arms a little further out
    this.root = new THREE.Group();
    const bones = BONES.map(([name]) => { const b = new THREE.Bone(); b.name = name; return b; });
    BONES.forEach(([, p, o], i) => { bones[i].position.set(...o); if (p >= 0) bones[p].add(bones[i]); });
    const mat = v.blender ? MAT.skinRM : MAT.skin;
    const m = this.mesh = new THREE.SkinnedMesh(v.geo, mat);
    m.castShadow = true;
    m.add(bones[0]);
    if (v.blender) { // bind in the A-pose the Blender mesh was modelled in
      bones[BI.uaL].rotation.z = -ARM_A; bones[BI.uaR].rotation.z = ARM_A;
      bones[BI.thL].rotation.z = -LEG_B; bones[BI.thR].rotation.z = LEG_B;
    }
    const skel = new THREE.Skeleton(bones);
    m.bind(skel);
    if (v.blender && v.geo1 && v.geo1 !== v.geo) {
      // far away: a lighter mesh on the same skeleton
      const m1 = new THREE.SkinnedMesh(v.geo1, mat);
      m1.castShadow = true;
      m1.bind(skel, m.bindMatrix);
      const lod = new THREE.LOD(); lod.addLevel(m, 0); lod.addLevel(m1, 24);
      this.root.add(lod);
    } else this.root.add(m);
    this.root.scale.setScalar(v.scale || 1);
    this.b = Object.fromEntries(BONES.map(([name], i) => [name, bones[i]]));
    for (const s of ['L', 'R']) this.b['ua' + s].rotation.order = 'YXZ';
    this.phase = Math.random() * 6;
    this.gun = null; this.gunPivot = null;
    this.animate(0, 0, {});
  }
  holdGun(gun) {
    // the gun hangs off the spine (not the twisting chest) at the right shoulder pocket
    if (!this.gunPivot) { this.gunPivot = new THREE.Group(); this.gunPivot.position.set(0.15, 0.38, 0.0); this.b.spine.add(this.gunPivot); }
    if (this.gun) this.gunPivot.remove(this.gun);
    this.gun = gun;
    if (gun) {
      const sc = 1;
      gun.scale.setScalar(sc);
      // gun origin sits in front of the shoulder pocket
      gun.position.set(0, 0, -(gun.userData.stock || 0.3) * sc);
      this.gunPivot.add(gun);
    }
  }
  // speed in m/s. opts: aim (rad, when holding a gun), air (jumping), flail (panic)
  animate(dt, speed, opts = {}) {
    const b = this.b;
    const run = Math.min(1, Math.max(0, (speed - 3) / 4));
    this.phase += dt * (1.6 + speed * 1.45);
    const s = Math.min(1, speed / 2.5), ph = this.phase;
    // legs: thigh swing + knee bend while the leg swings forward
    const amp = 0.45 + run * 0.4;
    const legs = (side, p) => {
      b['th' + side].rotation.set(Math.sin(p) * amp * s, 0, 0);
      b['sh' + side].rotation.set(-Math.max(0, Math.cos(p)) * (0.6 + run * 0.7) * s - 0.05, 0, 0);
      b['ft' + side].rotation.set(Math.max(0, -Math.sin(p)) * 0.3 * s, 0, 0);
    };
    legs('L', ph); legs('R', ph + Math.PI);
    b.hips.position.y = 0.95 - 0.03 * s + Math.abs(Math.cos(ph)) * (0.035 + run * 0.04) * s;
    b.hips.rotation.set(0, Math.sin(ph) * 0.12 * s, 0);
    b.spine.rotation.set(-run * 0.22, -Math.sin(ph) * 0.1 * s, 0);
    b.chest.rotation.set(0, 0, 0);
    b.head.rotation.set(run * 0.15, 0, 0);
    if (opts.air) {
      b.thL.rotation.x = 0.9; b.shL.rotation.x = -1.3; b.thR.rotation.x = 0.2; b.shR.rotation.x = -0.5;
    }
    if (this.gun && opts.aim !== undefined) {
      // two-handed gun: chest leans with the aim, hands on the grip and the foregrip
      const aim = opts.aim, lean = run * 0.15;
      b.spine.rotation.set(-lean, 0, 0);
      b.chest.rotation.set(aim * 0.3, BLADE, 0, 'YXZ');
      b.head.rotation.set(aim * 0.3, -BLADE, 0, 'YXZ');
      const gp = this.gunPivot, gun = this.gun, sc = gun.scale.x;
      gp.rotation.set(aim + lean, 0, 0);
      gp.updateMatrix(); b.chest.updateMatrix();
      _inv.copy(b.chest.matrix).invert();
      // wrist targets: just above the grip and the fore-grip, in chest space
      _g.copy(gun.userData.grip).multiplyScalar(sc).add(gun.position).applyMatrix4(gp.matrix).applyMatrix4(_inv); _g.y += 0.055;
      _f.copy(gun.userData.fore).multiplyScalar(sc).add(gun.position).applyMatrix4(gp.matrix).applyMatrix4(_inv); _f.y += 0.05;
      reach(b.uaR, b.faR, SHOULDER_R, _g, 0.25);
      reach(b.uaL, b.faL, SHOULDER_L, _f, -0.35);
      b.hdR.rotation.set(0, 0, 0); b.hdL.rotation.set(0, 0, 0);
    } else if (opts.handsUp) {
      // hold-up: both hands in the air, a little shaky
      const sh = Math.sin(this.phase * 9) * 0.05;
      b.uaL.rotation.set(0.1, 0, -1.98 + sh); b.faL.rotation.set(0, 0, -1.16 - sh);
      b.uaR.rotation.set(0.1, 0, 1.98 - sh); b.faR.rotation.set(0, 0, 1.16 + sh);
      b.hdL.rotation.set(0, 0, 0); b.hdR.rotation.set(0, 0, 0);
      b.head.rotation.set(-0.15, 0, 0);
    } else if (opts.dance) {
      // hands in the air, bouncing knees, swaying hips (the giant holograms)
      const t = this.phase * 5, beat = Math.sin(t), slow = Math.sin(t * 0.5), up = Math.max(0, beat), dn = Math.max(0, -beat);
      b.hips.position.y = 0.95 - 0.07 * Math.abs(beat);
      b.hips.rotation.set(0, slow * 0.35, beat * 0.07);
      b.spine.rotation.set(0.06, -slow * 0.25, -beat * 0.08);
      b.chest.rotation.set(0, 0, beat * 0.05);
      b.head.rotation.set(0.12 * Math.abs(beat), slow * 0.3, 0);
      b.uaL.rotation.set(0, 0, -2.25 - 0.45 * up); b.faL.rotation.set(0, 0, -0.85 + 0.6 * dn);
      b.uaR.rotation.set(0, 0, 2.25 + 0.45 * dn); b.faR.rotation.set(0, 0, 0.85 - 0.6 * up);
      b.hdL.rotation.set(0, 0, 0); b.hdR.rotation.set(0, 0, 0);
      b.thL.rotation.set(0.4 * up, 0, -0.06); b.shL.rotation.set(-0.8 * up, 0, 0);
      b.thR.rotation.set(0.4 * dn, 0, 0.06); b.shR.rotation.set(-0.8 * dn, 0, 0);
    } else if (opts.flail) {
      b.uaL.rotation.set(2.4 + Math.sin(ph * 2) * 0.6, 0.3, -0.3); b.faL.rotation.set(0.6, 0, 0);
      b.uaR.rotation.set(2.4 + Math.cos(ph * 2) * 0.6, -0.3, 0.3); b.faR.rotation.set(0.6, 0, 0);
      b.hdL.rotation.set(0, 0, 0); b.hdR.rotation.set(0, 0, 0);
    } else {
      const aswing = (0.35 + run * 0.5) * s;
      b.uaR.rotation.set(-Math.sin(ph) * aswing * 0.9 + 0.05, 0, this.armOut);
      b.faR.rotation.set(0.25 + run * 1.0 + Math.max(0, -Math.sin(ph)) * 0.3 * s, 0, 0);
      b.hdR.rotation.set(0, 0, 0);
      if (this.umbrella) {
        b.uaL.rotation.set(0.35, 0.25, -0.15); b.faL.rotation.set(1.3, 0, 0);
        b.hdL.rotation.set(-1.65, -0.25, 0.15); // keep the umbrella upright
      } else {
        b.uaL.rotation.set(Math.sin(ph) * aswing * 0.9 + 0.05, 0, -this.armOut);
        b.faL.rotation.set(0.25 + run * 1.0 + Math.max(0, Math.sin(ph)) * 0.3 * s, 0, 0);
        b.hdL.rotation.set(0, 0, 0);
      }
    }
  }
}
