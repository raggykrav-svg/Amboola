// TITAN-0: Overlord Zero's giant mech, the boss at the end of the story.
// A 14 m walking robot with a gatling arm, a rocket arm and shoulder missile pods. Its glowing
// reactor core takes double damage (triple once its chest armour opens at 1/3 health).
// Phase 1: gatling bursts and rockets. Phase 2 (2/3 health): it calls drones and stomps
// (jump to dodge the shockwave!). Phase 3 (1/3 health): the core is open and it gets angry.
import * as THREE from 'three';
import { Parts } from './parts.js';

const V3 = THREE.Vector3;
const S = 1.6; // the whole mech is scaled up: about 19 m tall
const tmp = new V3(), tmp2 = new V3();
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

const ARMOR = '#3a3e4a', DARK = '#1c1e26', TRIM = '#ff7a1a', STEEL = '#8a909e';
const metal = () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.38 });
const glowMat = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6), toneMapped: false });

function build() {
  const root = new THREE.Group(), M = metal();
  const mesh = (P, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(P.build(), M); m.position.set(x, y, z); m.castShadow = true; return m; };
  // hips and legs (each leg is a group so it can step)
  const hips = new THREE.Group(); hips.position.y = 6.2; root.add(hips);
  const hp = new Parts(); hp.box(3.4, 1.2, 2.2, DARK, 0, 0, 0); hp.box(3.6, 0.3, 2.4, TRIM, 0, 0.65, 0);
  hips.add(mesh(hp));
  const legs = [-1, 1].map(s => {
    const leg = new THREE.Group(); leg.position.set(s * 1.55, 0, 0); hips.add(leg);
    const P = new Parts();
    P.box(1.1, 3.0, 1.3, ARMOR, 0, -1.5, 0); P.box(1.2, 0.5, 1.4, TRIM, 0, -0.2, 0); // thigh
    P.sphere(0.7, STEEL, 0, -3.1, 0);                                               // knee
    P.box(1.0, 2.6, 1.1, ARMOR, 0, -4.4, 0.15); P.box(0.4, 1.8, 0.3, DARK, 0, -4.4, -0.55); // shin
    P.box(1.8, 0.5, 2.6, DARK, 0, -5.9, -0.3); P.box(1.9, 0.18, 2.7, TRIM, 0, -5.62, -0.3);   // foot
    leg.add(mesh(P));
    return leg;
  });
  // torso (turns to face you) with the cockpit and the core
  const torso = new THREE.Group(); torso.position.y = 7.2; root.add(torso);
  const T = new Parts();
  T.box(4.6, 3.6, 3.2, ARMOR, 0, 1.8, 0);
  T.box(5.0, 0.35, 3.4, TRIM, 0, 3.7, 0);
  T.box(3.0, 1.2, 1.0, DARK, 0, 0.5, -1.7);
  T.box(2.2, 1.4, 2.0, DARK, 0, 4.4, 0.1);            // neck/cockpit base
  T.box(1.2, 2.6, 2.2, STEEL, -2.9, 2.6, 0); T.box(1.2, 2.6, 2.2, STEEL, 2.9, 2.6, 0); // shoulders
  T.box(1.4, 1.2, 1.8, DARK, -2.9, 4.4, 0.2); T.box(1.4, 1.2, 1.8, DARK, 2.9, 4.4, 0.2); // missile pods
  T.box(0.3, 2.4, 0.3, TRIM, -2.3, 1.6, -1.65); T.box(0.3, 2.4, 0.3, TRIM, 2.3, 1.6, -1.65);
  torso.add(mesh(T));
  // the cockpit glass and eyes
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.2), glowMat('#ff7a1a')); glass.position.set(0, 4.6, -0.95); torso.add(glass);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), glowMat('#ffd23a')); m.position.set(s * (2.55 + (k % 2) * 0.5), 4.6 + (k > 1 ? 0.3 : 0), -0.75); torso.add(m); }
  // the reactor core, behind two armour doors
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), glowMat('#29f3ff')); core.position.set(0, 2.0, -1.55); torso.add(core);
  const doors = [-1, 1].map(s => { const d = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.3), M); d.geometry.translate(s * 0.5, 0, 0); d.position.set(s * 0.02, 2.0, -1.78); applyColor(d.geometry, '#4a4e5a'); torso.add(d); return d; });
  // arms: gatling (left) and rocket launcher (right)
  const arms = [-1, 1].map(s => {
    const arm = new THREE.Group(); arm.position.set(s * 2.9, 2.4, 0); torso.add(arm);
    const P = new Parts();
    P.box(1.0, 2.4, 1.0, ARMOR, 0, -1.4, 0);
    if (s < 0) { P.cyl(0.55, 0.55, 2.6, 10, DARK, 0, -2.6, -1.0, Math.PI / 2, 0, 0); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P.cyl(0.1, 0.1, 1.2, 6, STEEL, Math.cos(a) * 0.32, -2.6 + Math.sin(a) * 0.32, -2.9, Math.PI / 2, 0, 0); } }
    else { P.box(1.3, 1.3, 2.8, DARK, 0, -2.6, -0.9); for (let k = 0; k < 4; k++) P.cyl(0.18, 0.18, 0.2, 8, TRIM, (k % 2 - 0.5) * 0.6, -2.6 + (Math.floor(k / 2) - 0.5) * 0.6, -2.32, Math.PI / 2, 0, 0); }
    arm.add(mesh(P));
    return arm;
  });
  return { root, hips, legs, torso, core, doors, arms };
}
function applyColor(geo, c) {
  const col = new THREE.Color(c), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
}

export class Mech {
  constructor(game, x, z) {
    this.g = game;
    Object.assign(this, build());
    this.pos = new V3(x, 0, z); this.home = new V3(x, 0, z); this.yaw = 0; this.aimYaw = 0;
    this.health = this.maxHealth = 3600; this.state = 'alive'; this.name = 'TITAN-0';
    this.phase = 1; this.walkT = 0; this.atkT = 2.5; this.burst = 0; this.burstT = 0; this.rockets = []; this.stompT = 0; this.deadT = 0;
    this.dest = new V3(x, 0, z); this.flash = 0;
    this.root.position.copy(this.pos); this.root.scale.setScalar(S);
    game.scene.add(this.root);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), this.ringMat); this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false;
    game.scene.add(this.ring);
    this.rocketGeo = new THREE.SphereGeometry(0.45, 8, 6);
    this.rocketMat = glowMat('#ff7a1a');
    // places bullets can hit (checked by the game for every player bolt)
    this.target = { mech: this, aimTest: test => this._parts((p, r, y0, y1) => test(p, r, y0, y1)), boltHit: (a, b, dmg, segHit) => this.rocketHit(a, b, segHit) || this._boltHit(a, b, dmg, segHit), blast: (pos, r, dmg) => { if (pos.distanceTo(tmp.set(this.pos.x, 8 * S, this.pos.z)) < r + 5 * S) this.damage(dmg * 2.5); } };
    game.targets.push(this.target);
  }
  dispose() {
    const g = this.g, i = g.targets.indexOf(this.target); if (i >= 0) g.targets.splice(i, 1);
    g.scene.remove(this.root, this.ring);
    for (const r of this.rockets) g.scene.remove(r.m);
    this.rockets.length = 0;
  }
  // the hit cylinders: legs, body, and the core (y in world space)
  _parts(fn) {
    const p = this.pos, f = tmp2.set(-Math.sin(this.aimYaw), 0, -Math.cos(this.aimYaw));
    fn(p, 3.2 * S, 6 * S, 13 * S);                      // body
    fn(tmp.set(p.x + Math.cos(this.yaw) * 1.6 * S, 0, p.z - Math.sin(this.yaw) * 1.6 * S), 1.1 * S, 0, 6.5 * S); // legs
    fn(tmp.set(p.x - Math.cos(this.yaw) * 1.6 * S, 0, p.z + Math.sin(this.yaw) * 1.6 * S), 1.1 * S, 0, 6.5 * S);
    return f;
  }
  _boltHit(a, b, dmg, segHit) {
    if (this.state !== 'alive') return null;
    // the core first (it sits on the front of the chest)
    const f = tmp2.set(-Math.sin(this.aimYaw), 0, -Math.cos(this.aimYaw));
    const cp = new V3(this.pos.x + f.x * 1.9 * S, 9.2 * S, this.pos.z + f.z * 1.9 * S);
    const hc = segHit(cp, 1.15 * S, 8.1 * S, 10.3 * S);
    if (hc) { this.damage(dmg * (this.phase >= 3 ? 3 : 2), true); return hc; }
    let hit = null;
    this._parts((p, r, y0, y1) => { if (!hit) { const h = segHit(p, r, y0, y1); if (h) hit = h; } });
    if (hit) this.damage(dmg);
    return hit;
  }
  damage(dmg, crit) {
    if (this.state !== 'alive') return;
    this.health -= dmg; this.flash = 0.08;
    if (crit) { this.g.hud.toast('CORE HIT! ×' + (this.phase >= 3 ? 3 : 2)); this.g.fx.sparks(this.core.getWorldPosition(new V3()), 0x29f3ff, 12, 6); }
    const g = this.g, h = this.health / this.maxHealth;
    if (this.phase === 1 && h < 0.66) {
      this.phase = 2;
      g.hud.say('OVERLORD ZERO', 'You scratched my paint! DRONES, ATTACK!', '#ff7a1a', 4);
      this.callDrones(4);
    } else if (this.phase === 2 && h < 0.33) {
      this.phase = 3;
      g.hud.say('JUNO', 'Its chest armour broke open! Shoot the BLUE CORE for triple damage!', '#ff2bd6', 5);
      this.callDrones(3);
    }
    if (this.health <= 0) { this.health = 0; this.state = 'dying'; this.deadT = 0; g.audio.play('explode'); }
  }
  callDrones(n) {
    const g = this.g;
    for (let k = 0; k < n; k++) { const d = g.spawnChallengeDrone(this.pos.x + Math.cos(k * 1.7) * 18, 22, this.pos.z + Math.sin(k * 1.7) * 18); d.story = true; d.home = { x: this.pos.x, z: this.pos.z }; }
  }
  get chest() { return new V3(this.pos.x, 9.5 * S, this.pos.z); }

  update(dt) {
    const g = this.g, p = g.player, tp = g.wpos(), t = g.time;
    this._updateRockets(dt);
    if (this.flash > 0) { this.flash -= dt; this.core.scale.setScalar(1.3); } else this.core.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
    if (this.state === 'dying') return this._die(dt);
    if (this.state !== 'alive') return;
    // turn to face you, walk around the square, keep 22-45 m away
    const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z, d = Math.hypot(dx, dz);
    this.aimYaw += angDiff(this.aimYaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * (this.phase >= 3 ? 2.2 : 1.5));
    if (this.pos.distanceTo(this.dest) < 3 || Math.random() < dt * 0.15) {
      const a = Math.random() * Math.PI * 2, R = rand(10, 40);
      this.dest.set(this.home.x + Math.cos(a) * R, 0, this.home.z + Math.sin(a) * R);
      if (d < 26) this.dest.set(this.pos.x - dx / d * 14, 0, this.pos.z - dz / d * 14);
    }
    const mx = this.dest.x - this.pos.x, mz = this.dest.z - this.pos.z, md = Math.hypot(mx, mz);
    const speed = this.stompT > 0 ? 0 : (this.phase >= 3 ? 5.5 : 4.0);
    if (md > 1) {
      this.yaw += angDiff(this.yaw, Math.atan2(-mx, -mz)) * Math.min(1, dt * 1.2);
      const c = g.city.collide(this.pos.x + mx / md * speed * dt, this.pos.z + mz / md * speed * dt, 3 * S, 0.5, 6);
      this.pos.x = c.x; this.pos.z = c.z;
      this.walkT += dt * speed * 0.4;
    }
    // walking animation: legs swing, hips bob; a thud when a foot lands
    const sw = Math.sin(this.walkT) * (speed > 0 && md > 1 ? 0.45 : 0);
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    const bob = Math.abs(Math.cos(this.walkT)) * 0.35;
    if (Math.cos(this.walkT) * Math.cos(this.walkT - dt * speed * 0.4) < 0 && speed > 0) { g.audio.play('explode', Math.max(20, d)); g.camState.shake = Math.max(g.camState.shake || 0, d < 40 ? 0.25 : 0.08); }
    this.root.position.set(this.pos.x, this.stompT > 0 ? this._stompY() * S : 0, this.pos.z);
    this.root.rotation.y = this.yaw;
    this.hips.position.y = 6.2 - bob * 0.5;
    this.torso.position.y = 7.2 - bob * 0.5;
    this.torso.rotation.y = angDiff(this.yaw, this.aimYaw);
    this.arms[0].rotation.x = this.arms[1].rotation.x = -0.15 + Math.max(-0.5, Math.min(0.5, Math.atan2(tp.y + 1 - 9 * S, d)));
    // the core doors open in phase 3
    const open = this.phase >= 3 ? 1 : 0;
    this.doors.forEach((dd, i) => { dd.rotation.y += ((i ? -1 : 1) * open * 1.6 - dd.rotation.y) * Math.min(1, dt * 3); });
    if (!p.alive || g.interior) return;
    // ---- attacks ----
    if (this.stompT > 0) { this._stomp(dt); return; }
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstT = 0.09; this.burst--;
        const from = this.arms[0].localToWorld(new V3(0, -2.6, -3.4));
        g.enemyShoot(from, tmp.set(tp.x, tp.y + 1.1, tp.z), 0.09, 5, 0xffa43a);
      }
      return;
    }
    this.atkT -= dt;
    if (this.atkT > 0) return;
    const r = Math.random();
    if (this.phase >= 2 && d < 26 && r < 0.45) this._startStomp();
    else if (r < 0.55) { this.burst = this.phase >= 3 ? 16 : 10; this.burstT = 0.3; this.atkT = rand(2.2, 3.2) / (this.phase >= 3 ? 1.4 : 1); }
    else { this._fireRockets(this.phase >= 3 ? 6 : 4); this.atkT = rand(2.8, 3.8) / (this.phase >= 3 ? 1.4 : 1); }
  }
  // ---- rockets: slow orange balls that curve toward you; shoot them down or run! ----
  _fireRockets(n) {
    const g = this.g;
    for (let k = 0; k < n; k++) {
      const from = (k % 2 ? this.arms[1] : this.torso).localToWorld(k % 2 ? new V3(0, -2.6, -2.4) : new V3((k % 4 < 2 ? -1 : 1) * 2.9, 5.2, 0));
      const m = new THREE.Mesh(this.rocketGeo, this.rocketMat); m.position.copy(from); g.scene.add(m);
      const v = new V3(rand(-6, 6), rand(8, 14), rand(-6, 6)).add(tmp.subVectors(g.wpos(), from).setY(0).normalize().multiplyScalar(10));
      this.rockets.push({ m, pos: from.clone(), vel: v, t: 0, hp: 10 });
    }
    g.audio.play('cannon', this.pos.distanceTo(g.camera.position));
    g.hud.toast('ROCKETS INCOMING! RUN OR SHOOT THEM!');
  }
  _updateRockets(dt) {
    const g = this.g, tp = g.wpos();
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.t += dt;
      const want = tmp.set(tp.x, tp.y + 1, tp.z).sub(r.pos).normalize().multiplyScalar(r.t < 0.7 ? 6 : 19);
      r.vel.lerp(want, 1 - Math.exp(-dt * (r.t < 0.7 ? 0.5 : 1.6)));
      r.pos.addScaledVector(r.vel, dt); r.m.position.copy(r.pos);
      if (Math.random() < dt * 30) g.fx.sparks(r.pos.clone(), 0xff7a1a, 1, 1);
      const hitP = r.pos.distanceTo(tmp.set(tp.x, tp.y + 1, tp.z)) < 1.6;
      if (hitP || r.pos.y < g.city.groundAt(r.pos.x, r.pos.z, r.pos.y) + 0.3 || g.city.inside(r.pos.x, r.pos.y, r.pos.z) || r.t > 7 || r.hp <= 0) {
        g.fx.explosion(r.pos.clone()); g.audio.play('explode', r.pos.distanceTo(g.camera.position));
        const dd = r.pos.distanceTo(tmp.set(tp.x, tp.y + 1, tp.z));
        if (r.hp > 0 && dd < 5) { if (g.player.vehicle) g.damageVehicle(g.player.vehicle, 40 * (1 - dd / 5), false); else g.damagePlayer(22 * (1 - dd / 6)); }
        g.scene.remove(r.m); this.rockets.splice(i, 1);
      }
    }
  }
  // player bolts can shoot rockets down
  rocketHit(a, b, segHit) {
    for (const r of this.rockets) { const h = segHit(r.pos, 0.9, r.pos.y - 0.9, r.pos.y + 0.9); if (h) { r.hp = 0; return h; } }
    return null;
  }
  // ---- stomp: it jumps and slams the ground; jump at the right time to dodge the shockwave ----
  _startStomp() { this.stompT = 1.6; this.waveDone = false; this.g.hud.toast('STOMP! JUMP OVER THE SHOCKWAVE! (SPACE)'); }
  _stompY() { const k = 1.6 - this.stompT; return k < 0.9 ? Math.sin(k / 0.9 * Math.PI) * 3.5 : 0; }
  _stomp(dt) {
    const g = this.g, p = g.player;
    this.stompT -= dt;
    const k = 1.6 - this.stompT;
    if (k >= 0.9 && !this.landed) { this.landed = true; g.audio.play('explode'); g.camState.shake = 0.6; g.fx.explosion(this.pos.clone()); this.waveR = 2; }
    if (this.landed) {
      this.waveR += dt * 26;
      this.ring.visible = true; this.ring.position.set(this.pos.x, 0.2, this.pos.z); this.ring.scale.setScalar(this.waveR); this.ringMat.opacity = Math.max(0, 0.9 - this.waveR / 34);
      const pd = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (!this.waveDone && Math.abs(pd - this.waveR) < 1.6 && p.pos.y < g.city.groundAt(p.pos.x, p.pos.z, p.pos.y) + 0.6 && !p.vehicle) { this.waveDone = true; g.damagePlayer(25); p.vy = 6; }
      if (this.waveR > 32) this.waveDone = true;
    }
    if (this.stompT <= 0) { this.stompT = 0; this.landed = false; this.ring.visible = false; this.atkT = rand(1.5, 2.5); }
  }
  // ---- defeated: explosions, then it falls over ----
  _die(dt) {
    const g = this.g;
    this.deadT += dt;
    if (Math.random() < dt * 8) {
      const p = new V3(this.pos.x + rand(-3, 3) * S, rand(3, 12) * S, this.pos.z + rand(-3, 3) * S);
      g.fx.explosion(p); g.audio.play('explode', p.distanceTo(g.camera.position));
    }
    const k = Math.min(1, Math.max(0, (this.deadT - 2) / 1.5));
    this.root.rotation.x = -k * 1.35; this.root.position.y = -k * 1.5;
    if (this.deadT > 2 && !this.fell) { this.fell = true; g.camState.shake = 0.8; }
    if (this.deadT > 4) this.state = 'dead';
  }
}
