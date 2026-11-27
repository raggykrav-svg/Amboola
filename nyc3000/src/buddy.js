// SPARKY, your robot dog (buy him in the shop: HOME & PETS).
// He follows you around, rides along in your car, runs at bad guys who fight you and bites
// them, and fetches ammo, health and cash lying around. He barks when bad guys are near.
import * as THREE from 'three';
import { makeDog, COMBAT } from './ai.js';

const V3 = THREE.Vector3;
const tmp = new V3();
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Buddy {
  constructor(game) {
    this.g = game; this.root = null; this.pos = new V3(); this.yaw = 0; this.vy = 0;
    this.state = 'follow'; this.target = null; this.carry = null; this.biteT = 0; this.barkT = 0; this.phase = 0; this.name = 'SPARKY';
  }
  get owned() { return !!this.root; }
  adopt(silent) {
    if (this.root) return;
    this.root = makeDog(); this.root.scale.setScalar(1.05);
    // a glowing collar so you know he's yours
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 16), new THREE.MeshBasicMaterial({ color: 0x3aff9a, toneMapped: false }));
    collar.position.set(0, 0.86, -0.42); this.root.add(collar);
    this.g.scene.add(this.root);
    const p = this.g.player.pos; this.pos.set(p.x + 1.5, p.y, p.z + 1.5);
    if (!silent) { this.g.hud.say('SPARKY', 'WOOF! WOOF! (Sparky is your new best friend!)', '#3aff9a', 5); this.g.audio.play('woof'); this.g.prog.medal('dog'); }
  }
  remove() { if (this.root) { this.g.scene.remove(this.root); this.root = null; } this._drop(); }
  _drop() { if (this.carry) { this.carry.carried = false; this.carry = null; } }

  update(dt) {
    if (!this.root) return;
    const g = this.g, p = g.player, t = g.time;
    // in a car or inside a building: he comes along (hidden), and hops out with you
    const away = !!p.vehicle || !!g.interior || !p.alive;
    this.root.visible = !away;
    if (away) { this._drop(); this.state = 'follow'; this.pos.set(p.pos.x + 1.2, p.pos.y, p.pos.z + 1.2); return; }
    const pp = p.pos;
    if (this.pos.distanceTo(pp) > 45) { this.pos.set(pp.x - Math.sin(p.yaw) * 2, pp.y, pp.z - Math.cos(p.yaw) * 2); this._drop(); this.state = 'follow'; }
    // ---- what to do ----
    this.biteT -= dt; this.barkT -= dt;
    const foe = this._foe();
    if (foe) { this._drop(); this.state = 'attack'; this.target = foe; }
    else if (this.state === 'attack') this.state = 'follow';
    if (this.state === 'follow' && !this.carry) {
      const k = this._fetchable();
      if (k) { this.state = 'fetch'; this.target = k; }
    }
    let goal, speed = 7;
    if (this.state === 'attack') {
      const e = this.target; goal = e.pos; speed = 11;
      if (this.pos.distanceTo(e.pos) < 1.5 && this.biteT <= 0) {
        this.biteT = 0.6; g.damagePerson(e, 12); g.audio.play('woof', this.pos.distanceTo(g.camera.position));
        g.fx.sparks(e.pos.clone().setY(1), 0x3aff9a, 6, 3);
      }
      if (this.barkT <= 0) { this.barkT = 8; g.hud.say('SPARKY', 'GRRR… WOOF WOOF! (Sparky is fighting the bad guys!)', '#3aff9a', 2.5); }
    } else if (this.state === 'fetch') {
      const k = this.target;
      if (!g.pickups.includes(k) || k.respawn > 0) { this.state = 'follow'; }
      else if (!this.carry) {
        goal = k.mesh.position; speed = 10;
        if (Math.hypot(this.pos.x - goal.x, this.pos.z - goal.z) < 1.0) { this.carry = k; k.carried = true; g.audio.play('woof', this.pos.distanceTo(g.camera.position)); }
      }
      if (this.carry) {
        goal = pp; speed = 10;
        this.carry.mesh.position.copy(this.root.localToWorld(tmp.set(0, 0.9, -0.95)));
        if (this.pos.distanceTo(pp) < 1.8) { // drop it at your feet: you pick it up
          this.carry.mesh.position.set(pp.x, pp.y + 0.6, pp.z); this._drop(); this.state = 'follow';
        }
      }
    }
    if (!goal) { // follow: stay a little behind you
      goal = tmp.set(pp.x + Math.sin(p.yaw) * 2.2 + Math.cos(p.yaw) * 1.1, pp.y, pp.z + Math.cos(p.yaw) * 2.2 - Math.sin(p.yaw) * 1.1);
      const d = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z);
      speed = d > 8 ? 12 : d > 2 ? 7 : 0;
    }
    // ---- move ----
    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z, d = Math.hypot(dx, dz);
    let v = 0;
    if (d > 0.6 && speed > 0) {
      this.yaw += angDiff(this.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 8);
      v = Math.min(speed, d * 4);
      const nx = this.pos.x - Math.sin(this.yaw) * v * dt, nz = this.pos.z - Math.cos(this.yaw) * v * dt;
      const c = g.city.collide(nx, nz, 0.35, this.pos.y + 0.2, this.pos.y + 1);
      this.pos.x = c.x; this.pos.z = c.z;
    } else if (this.state === 'follow') this.yaw += angDiff(this.yaw, p.yaw) * Math.min(1, dt * 2);
    // jump up and down kerbs and roofs like you do
    const gy = g.city.groundAt(this.pos.x, this.pos.z, this.pos.y + 1.2);
    if (gy > this.pos.y + 1.2) { this.pos.y = gy; } // hop up (you grappled up there, so can he)
    this.vy -= 22 * dt; this.pos.y += this.vy * dt;
    if (this.pos.y <= gy) { this.pos.y = gy; this.vy = 0; }
    if (Math.abs(pp.y - this.pos.y) > 6 && this.pos.distanceTo(pp) > 6) this.pos.set(pp.x + 1, pp.y, pp.z + 1); // you went up a building: he follows
    // ---- animate ----
    this.phase += dt * (v * 1.6 + 1);
    const legs = this.root.userData.legs, sw = Math.min(0.7, v * 0.08);
    legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * sw));
    this.root.userData.tail.rotation.y = Math.sin(t * (this.state === 'follow' ? 14 : 22)) * 0.6;
    this.root.position.set(this.pos.x, this.pos.y + Math.abs(Math.sin(this.phase)) * Math.min(0.08, v * 0.01), this.pos.z);
    this.root.rotation.y = this.yaw;
  }
  // the closest bad guy fighting you
  _foe() {
    const g = this.g, pp = g.player.pos;
    let best = null, bd = 28;
    for (const e of g.gang) {
      if (e.state === 'dead' || e.ride || e.alert !== COMBAT || e.neutral && e.alert !== COMBAT) continue;
      const d = e.pos.distanceTo(pp); if (d < bd && Math.abs(e.pos.y - this.pos.y) < 3) { bd = d; best = e; }
    }
    return best;
  }
  // something lying around he can bring you
  _fetchable() {
    const g = this.g, pp = g.player.pos;
    let best = null, bd = 25;
    for (const k of g.pickups) {
      if (k.fixed || k.respawn > 0 || k.carried || k.flat !== undefined) continue;
      const d = Math.hypot(k.mesh.position.x - pp.x, k.mesh.position.z - pp.z);
      if (d > 3 && d < bd && Math.abs(k.mesh.position.y - pp.y) < 3) { bd = d; best = k; }
    }
    return best;
  }
}
