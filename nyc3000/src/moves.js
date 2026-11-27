// Grappling hook and wall-running.
// G shoots the hook where you aim. It pulls you to that spot; aim near the top of a building
// and it pulls you right up onto the roof. Space while flying on the rope lets go with a jump.
// Wall-running: jump next to a wall while sprinting forward (Shift + W) and you run along it.
// Space jumps off the wall, and you can jump from wall to wall.
import * as THREE from 'three';

const V3 = THREE.Vector3;
const tmp = new V3(), tmp2 = new V3();

export class Moves {
  constructor(game) {
    this.g = game;
    this.mode = null; // 'shoot' | 'pull' | 'wall'
    this.hook = new V3(); this.target = new V3(); this.mantle = false;
    this.cd = 0; this.t = 0; this.wallT = 0; this.wallSide = 0; this.lastWall = 0; this.fling = 0;
    // the rope and the hook head
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9ff8ff, toneMapped: false }));
    this.rope.frustumCulled = false; this.rope.visible = false;
    this.head = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0x29f3ff, toneMapped: false }));
    this.head.visible = false;
    game.scene.add(this.rope, this.head);
  }
  get range() { return 48 + 16 * this.g.prog.rank('grapple'); }
  reset() { this.mode = null; this.rope.visible = this.head.visible = false; this.fling = 0; }

  // where the hook would land if you shot it now (or null)
  aim() {
    const g = this.g, cam = g.camera;
    cam.getWorldDirection(tmp2);
    const o = cam.position, t = g.city.raycast(o, tmp2, this.range + 6);
    if (t >= this.range + 6 || o.y + tmp2.y * t < 0.3) return null;
    const hit = new V3().copy(o).addScaledVector(tmp2, t);
    if (hit.distanceTo(g.player.pos) > this.range) return null;
    return { hit, dir: tmp2.clone() };
  }

  // returns 'pull' (the hook moves you), 'wall' (wall-running), or null (normal walking)
  update(dt, mx, mz, sprint) {
    const g = this.g, p = g.player, inp = g.input;
    this.cd -= dt; this.fling = Math.max(0, this.fling - dt);
    const canHook = !g.interior && !g.acts.hack.on && p.alive;
    if (canHook && inp.pressed('KeyG') && this.cd <= 0 && this.mode !== 'shoot' && this.mode !== 'pull') {
      if (this.mode === 'hang') this.mode = null;
      const a = this.aim();
      if (!a) { g.hud.toast('NOTHING TO HOOK ONTO · AIM AT A BUILDING'); g.audio.play('empty'); this.cd = 0.3; }
      else {
        this.hook.copy(a.hit); this.target.copy(a.hit); this.mantle = false;
        // close to the top of the building? then pull right up onto the roof
        const ix = a.hit.x + a.dir.x * 0.8, iz = a.hit.z + a.dir.z * 0.8, top = g.city.roofAt(ix, iz);
        if (top > a.hit.y - 0.5 && top - a.hit.y < 30 && top > p.pos.y + 1) { this.target.set(ix, top + 0.05, iz); this.mantle = true; }
        else this.target.addScaledVector(a.dir, -0.6); // stop just in front of the wall
        this.mode = 'shoot'; this.t = 0; this.cd = 0.6;
        g.audio.play('switch'); g.prog.stat('hooks');
      }
    }
    const hand = tmp.set(p.pos.x, p.pos.y + 1.45, p.pos.z);
    if (this.mode === 'shoot') {
      // the hook flies out
      this.t += dt;
      const k = Math.min(1, this.t / 0.14);
      this._draw(hand, tmp2.lerpVectors(hand, this.hook, k));
      if (k >= 1) { this.mode = 'pull'; this.t = 0; this.best = Infinity; g.audio.play('hit'); g.fx.sparks(this.hook.clone(), 0x29f3ff, 10, 4); }
      return 'pull';
    }
    if (this.mode === 'pull') {
      this.t += dt;
      const to = tmp2.subVectors(this.target, p.pos), d = to.length();
      const speed = Math.min(30 + 6 * g.prog.rank('grapple'), 8 + this.t * 60);
      if (d < 1.2 || this.t > 4) return this._arrive(to);
      to.normalize();
      p.vel.copy(to).multiplyScalar(speed);
      p.pos.addScaledVector(p.vel, dt); p.vy = 0;
      // stuck against something on the way?
      if (d < this.best - 0.05) { this.best = d; this.stuck = 0; } else if ((this.stuck = (this.stuck || 0) + dt) > 0.5) return this._release(false);
      if (inp.pressed('Space')) return this._release(true);
      this._draw(hand.set(p.pos.x, p.pos.y + 1.45, p.pos.z), this.hook);
      p.onGround = false;
      return 'pull';
    }
    if (this.mode === 'hang') {
      // hanging on the rope at the wall: hook again (G) to go higher, Space to jump off
      this.t += dt; p.vy = 0; p.vel.set(0, 0, 0); p.onGround = false;
      this._draw(hand, this.hook);
      if (inp.pressed('Space')) { this.mode = null; p.vy = 7; this.fling = 0.8; this.rope.visible = this.head.visible = false; return 'pull'; }
      if (this.t > 3) { this.mode = null; this.rope.visible = this.head.visible = false; }
      return 'pull';
    }
    this.rope.visible = this.head.visible = false;
    // ---- wall-running ----
    const ground = g.city.groundAt(p.pos.x, p.pos.z, p.pos.y);
    if (this.mode === 'wall') {
      this.wallT += dt; g.prog.stat('wall', dt);
      const side = this._wallAt(this.wallSide);
      if (!side || p.onGround || this.wallT > 2.4 || !sprint || mz >= 0) { this.mode = null; this.lastWall = g.time; return null; }
      // run along the wall: keep the speed, slide down slowly
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const nx = side.x, nz = side.z; // points into the wall
      let tx = fx - nx * (fx * nx + fz * nz), tz = fz - nz * (fx * nx + fz * nz);
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      p.vel.x = tx * 10.5; p.vel.z = tz * 10.5;
      p.vy = 1.6 - this.wallT * 1.6;
      p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; p.pos.y += p.vy * dt;
      if (inp.pressed('Space')) { // kick off the wall
        p.vy = 8.2; p.vel.x = tx * 8 - nx * 6.5; p.vel.z = tz * 8 - nz * 6.5;
        this.mode = null; this.lastWall = g.time; this.fling = 0.6; this.lastSide = this.wallSide; this.wallSideAt = g.time;
        g.audio.play('switch');
        return null;
      }
      if (p.pos.y <= ground) { p.pos.y = ground; this.mode = null; }
      return 'wall';
    }
    if (!p.onGround && sprint && mz < 0 && p.pos.y - ground > 1.0 && p.vy < 5 && g.time - this.lastWall > 0.25 && !g.interior) {
      for (const s of [1, -1]) {
        if (s === this.lastSide && g.time - (this.wallSideAt || 0) < 0.5) continue; // jump to the other wall
        if (this._wallAt(s)) { this.mode = 'wall'; this.wallSide = s; this.wallT = 0; g.audio.play('slide'); return 'wall'; }
      }
    }
    return null;
  }
  // is there a wall right next to you on this side? (1 = right, -1 = left); returns the direction into it
  _wallAt(s) {
    const p = this.g.player, c = this.g.city;
    const rx = Math.cos(p.yaw) * s, rz = -Math.sin(p.yaw) * s;
    for (const y of [0.9, 1.5]) if (c.inside(p.pos.x + rx * 0.95, p.pos.y + y, p.pos.z + rz * 0.95)) return { x: rx, z: rz };
    return null;
  }
  _arrive(to) {
    const p = this.g.player;
    if (this.mantle) { p.pos.copy(this.target); p.vy = 2.5; p.vel.set(0, 0, 0); p.onGround = true; this.g.audio.play('slide'); }
    else { p.vel.set(0, 0, 0); p.vy = 0; this.mode = 'hang'; this.t = 0; this.g.hud.toast('HANGING ON · G = HOOK HIGHER · SPACE = JUMP'); return 'pull'; }
    return this._release(false, true);
  }
  _release(jump, arrived) {
    const p = this.g.player;
    if (jump) { p.vy = 9; this.fling = 1.2; }
    else if (!arrived) { p.vel.multiplyScalar(0.5); this.fling = 0.6; }
    this.mode = null; this.rope.visible = this.head.visible = false;
    return 'pull';
  }
  _draw(a, b) {
    const pos = this.rope.geometry.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true;
    this.rope.visible = true; this.head.visible = true; this.head.position.copy(b);
    this.head.rotation.y += 0.3;
  }
}
