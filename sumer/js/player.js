// The walker: movement, collisions with buildings/trees/cars, sidewalks, swimming, camera modes
// (first person, third person with a little character, drone view).
import * as THREE from 'three';

const R = 0.32;           // body radius
const EYE = 1.62;
const WATER = -0.32;
const SWIM_FEET = WATER - 1.22;

export class Player {
  constructor(city, forest, camera, scene) {
    this.city = city; this.forest = forest; this.cam = camera; this.scene = scene;
    this.pos = new THREE.Vector3(500, 0, -10);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.feet = 0; this.vy = 0; this.onGround = true;
    this.mode = 'first';      // first | third | drone
    this.swim = false; this.surface = 1;
    this.phase = 0; this.walked = 0; this.speed = 0;
    this.drone = new THREE.Vector3();
    this.onStep = null;       // callback(surface, running)
    this.bob = 0;
    this.body = makeWalker(); this.body.visible = false; scene.add(this.body);
    this.camDist = 3.4;
  }

  ground(x, z) {
    const s = this.city.surfaceAt(x, z);
    switch (s) {
      case 7: return 0.12;
      case 10: return 0.55;
      case 11: return 0.9;
      case 0: case 8: return null;
      default: return 0;
    }
  }

  teleport(x, z, yaw) {
    // find a free spot near (x,z): not inside a building, on land
    const A = this.city.h.area;
    let best = null;
    for (let r = 0; r < 60 && !best; r += 1.5) {
      for (let a = 0; a < Math.PI * 2; a += r > 0 ? Math.max(0.15, 1.5 / r) : 7) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const s = this.city.surfaceAt(px, pz);
        if (s !== 12 && s !== 0 && s !== 8 && !this.blocked(px, pz)) { best = [px, pz]; break; }
      }
    }
    if (!best) best = [x, z];
    this.pos.set(Math.min(A[2] - 5, Math.max(A[0] + 5, best[0])), 0, Math.min(A[3] - 5, Math.max(A[1] + 5, best[1])));
    const g = this.ground(this.pos.x, this.pos.z);
    this.feet = g === null ? SWIM_FEET : g; this.pos.y = this.feet; this.vy = 0;
    if (yaw !== undefined) this.yaw = yaw;
    this.vel.set(0, 0, 0);
  }

  blocked(x, z) {
    let hit = false;
    this.city.edgesNear(x, z, R + 0.1, (x1, z1, x2, z2) => { if (!hit && segDist(x, z, x1, z1, x2, z2) < R) hit = true; });
    return hit;
  }

  // push the body circle out of walls, trunks and parked cars
  collide(p) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      this.city.edgesNear(p.x, p.z, R + 0.6, (x1, z1, x2, z2) => {
        const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz; if (l2 < 1e-6) return;
        const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.z - z1) * dz) / l2));
        const cx = x1 + dx * t, cz = z1 + dz * t;
        let ex = p.x - cx, ez = p.z - cz; const d = Math.hypot(ex, ez);
        if (d < R) {
          if (d < 1e-5) { const l = Math.sqrt(l2); ex = dz / l; ez = -dx / l; } else { ex /= d; ez /= d; }
          p.x = cx + ex * R; p.z = cz + ez * R; moved = true;
        }
      });
      const circle = (tx, tz, r) => {
        const ex = p.x - tx, ez = p.z - tz, d = Math.hypot(ex, ez), m = r + R;
        if (d < m && d > 1e-4) { p.x = tx + ex / d * m; p.z = tz + ez / d * m; moved = true; }
      };
      if (this.forest) this.forest.trunksNear(p.x, p.z, circle);
      if (this.life) this.life.colliders(p.x, p.z, circle);
      const rs = this.city.rasters;
      for (const Rr of rs.values()) {
        if (!Rr.colliders) continue;
        if (p.x < Rr.ox - 3 || p.x > Rr.ox + 253 || p.z < Rr.oz - 3 || p.z > Rr.oz + 253) continue;
        const c = Rr.colliders;
        for (let i = 0; i < c.length; i += 3) if (Math.abs(c[i] - p.x) < 2 && Math.abs(c[i + 1] - p.z) < 2) circle(c[i], c[i + 1], c[i + 2]);
      }
      if (!moved) break;
    }
  }

  update(dt, inp) {
    dt = Math.min(dt, 0.05);
    this.yaw -= inp.lookX; this.pitch -= inp.lookY;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    if (this.mode === 'drone') return this.updateDrone(dt, inp);
    const fwd = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    const right = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
    let mx = right.x * inp.x + fwd.x * inp.y, mz = right.y * inp.x + fwd.y * inp.y;
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const run = inp.run;
    const top = this.swim ? (run ? 2.2 : 1.3) : (run ? 6.2 : 2.1);
    const tx = mx * top, tz = mz * top;
    const acc = this.onGround || this.swim ? 12 : 3;
    this.vel.x += (tx - this.vel.x) * Math.min(1, acc * dt);
    this.vel.z += (tz - this.vel.z) * Math.min(1, acc * dt);
    const old = this.pos.clone();
    const np = this.pos.clone(); np.x += this.vel.x * dt; np.z += this.vel.z * dt;
    const A = this.city.h.area;
    np.x = Math.min(A[2] - 5, Math.max(A[0] + 5, np.x)); np.z = Math.min(A[3] - 5, Math.max(A[1] + 5, np.z));
    this.collide(np);
    // ground / steps
    let g = this.ground(np.x, np.z);
    const feet = this.feet;
    const gy = g === null ? SWIM_FEET : g;
    if (g !== null && gy > feet + (this.swim ? 1.8 : 1.0) && this.onGround) { np.x = old.x; np.z = old.z; g = this.ground(np.x, np.z); }
    this.pos.x = np.x; this.pos.z = np.z;
    const target = g === null ? SWIM_FEET : g;
    this.swim = g === null && this.feet < WATER - 0.6;
    // vertical
    if (inp.jump && this.onGround && !this.swim) { this.vy = 4.6; this.onGround = false; this.jumped = true; }
    if (!this.onGround) {
      this.vy -= 13 * dt; this.feet += this.vy * dt;
      if (this.feet <= target) { this.feet = target; this.onGround = true; this.vy = 0; if (this.jumped) { this.jumped = false; this.onLand && this.onLand(); } }
    } else if (target > this.feet) {
      this.feet = Math.min(target, this.feet + dt * (g === null ? 1 : 6));
    } else if (target < this.feet) {
      if (g === null) this.feet = Math.max(target, this.feet - dt * 0.9);   // wading into the sea
      else if (this.feet - target > 0.5) { this.onGround = false; this.vy = 0; } // falling off a pier
      else this.feet = Math.max(target, this.feet - dt * 3);
    }
    this.pos.y = this.feet;
    // steps & bob
    const sp = Math.hypot(this.pos.x - old.x, this.pos.z - old.z);
    this.speed = sp / dt; this.walked += sp;
    if (this.onGround || this.swim) {
      const stepLen = this.swim ? 1.6 : run ? 1.25 : 0.78;
      const before = Math.floor(this.phase / Math.PI);
      this.phase += sp / stepLen * Math.PI;
      if (Math.floor(this.phase / Math.PI) !== before && this.onStep) this.onStep(this.swim ? 0 : this.city.surfaceAt(this.pos.x, this.pos.z), run);
    }
    this.surface = this.swim ? 0 : this.city.surfaceAt(this.pos.x, this.pos.z);
    this.updateCamera(dt);
  }

  updateDrone(dt, inp) {
    const sp = inp.run ? 70 : 22;
    const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.drone.addScaledVector(f, inp.y * sp * dt).addScaledVector(r, inp.x * sp * dt);
    this.drone.y += ((inp.up ? 1 : 0) - (inp.down ? 1 : 0)) * sp * dt;
    const A = this.city.h.area;
    this.drone.x = Math.min(A[2] + 2000, Math.max(A[0] - 2000, this.drone.x));
    this.drone.z = Math.min(A[3] + 3000, Math.max(A[1] - 2000, this.drone.z));
    this.drone.y = Math.min(1800, Math.max(2, this.drone.y));
    this.cam.position.copy(this.drone);
    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.body.visible = false;
    this.speed = 0;
  }

  setMode(m) {
    if (m === 'drone') { this.drone.set(this.pos.x, this.feet + 60, this.pos.z + 70); this.pitch = -0.55; }
    if (this.mode === 'drone' && m !== 'drone') {
      // land under the drone if possible
      const s = this.city.surfaceAt(this.drone.x, this.drone.z);
      if (s !== 12 && s !== 0 && s !== 8) this.teleport(this.drone.x, this.drone.z);
      this.pitch = 0;
    }
    this.mode = m;
  }

  updateCamera(dt) {
    const bobA = this.swim ? 0.05 : Math.min(1, this.speed / 2.5) * 0.04;
    const bob = Math.sin(this.phase * 2) * bobA * (this.onGround || this.swim ? 1 : 0);
    const swimBob = this.swim ? Math.sin(performance.now() / 600) * 0.05 : 0;
    const head = new THREE.Vector3(this.pos.x, this.feet + EYE + bob + swimBob, this.pos.z);
    if (this.mode === 'first') {
      this.cam.position.copy(head);
      this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.body.visible = false;
    } else {
      // third person: orbit behind, pull in if a wall is in the way
      const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const tgt = new THREE.Vector3(this.pos.x, this.feet + 1.55, this.pos.z);
      let D = this.camDist;
      for (let d = 0.6; d <= this.camDist; d += 0.3) {
        const px = tgt.x - f.x * d, pz = tgt.z - f.z * d, py = tgt.y - f.y * d;
        const s = this.city.surfaceAt(px, pz);
        if (s === 12 && py < 40) { D = Math.max(0.6, d - 0.4); break; }
      }
      this.cam.position.set(tgt.x - f.x * D, Math.max(this.feet + 0.3, tgt.y - f.y * D + 0.25), tgt.z - f.z * D);
      this.cam.lookAt(tgt.x + f.x * 2, tgt.y + f.y * 2 + 0.1, tgt.z + f.z * 2);
      this.body.visible = true;
      this.body.position.set(this.pos.x, this.feet + (this.swim ? 0.9 : 0), this.pos.z);
      const vh = Math.hypot(this.vel.x, this.vel.z);
      if (vh > 0.2) this.faceYaw = Math.atan2(-this.vel.x, -this.vel.z);
      if (this.faceYaw !== undefined) {
        let d = this.faceYaw - this.body.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        this.body.rotation.y += d * Math.min(1, dt * 10);
      }
      animateWalker(this.body, this.phase, Math.min(1, this.speed / 2), this.swim, !this.onGround && !this.swim);
    }
  }
}

function segDist(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / l2));
  return Math.hypot(px - x1 - dx * t, pz - z1 - dz * t);
}

// a small summer walker: t-shirt, shorts, sun hat
function makeWalker() {
  const g = new THREE.Group();
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const skin = M(0xd9a27c), shirt = M(0x2f8fb8), shorts = M(0xe8dcc0), hat = M(0xf2e6c4), shoe = M(0xf4f4f4), hair = M(0x3b2a1e);
  const part = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const torso = part(new THREE.BoxGeometry(0.42, 0.56, 0.24), shirt, 0, 1.2, 0);
  part(new THREE.BoxGeometry(0.4, 0.22, 0.25), shorts, 0, 0.86, 0);
  const head = part(new THREE.SphereGeometry(0.13, 12, 10), skin, 0, 1.62, 0);
  part(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 1.64, 0.01);
  part(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 16), hat, 0, 1.74, 0);
  part(new THREE.CylinderGeometry(0.13, 0.14, 0.12, 14), hat, 0, 1.8, 0);
  const limb = (w, h, mat, x, y) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); g.add(pivot);
    part(new THREE.BoxGeometry(w, h, w), mat, 0, -h / 2, 0, pivot);
    return pivot;
  };
  const legL = limb(0.15, 0.82, skin, -0.11, 0.86), legR = limb(0.15, 0.82, skin, 0.11, 0.86);
  part(new THREE.BoxGeometry(0.16, 0.08, 0.26), shoe, 0, -0.8, -0.04, legL); part(new THREE.BoxGeometry(0.16, 0.08, 0.26), shoe, 0, -0.8, -0.04, legR);
  const armL = limb(0.11, 0.6, skin, -0.28, 1.45), armR = limb(0.11, 0.6, skin, 0.28, 1.45);
  part(new THREE.BoxGeometry(0.13, 0.2, 0.13), shirt, 0, -0.08, 0, armL); part(new THREE.BoxGeometry(0.13, 0.2, 0.13), shirt, 0, -0.08, 0, armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}
function animateWalker(g, phase, k, swim, air) {
  const u = g.userData; const s = Math.sin(phase) * 0.6 * k;
  if (swim) {
    const t = performance.now() / 300;
    u.armL.rotation.x = Math.sin(t) * 1.6 - 1.2; u.armR.rotation.x = Math.sin(t + Math.PI) * 1.6 - 1.2;
    u.legL.rotation.x = Math.sin(t * 2) * 0.3 + 0.9; u.legR.rotation.x = Math.sin(t * 2 + 1) * 0.3 + 0.9;
    return;
  }
  if (air) { u.legL.rotation.x = -0.5; u.legR.rotation.x = 0.3; u.armL.rotation.x = -0.9; u.armR.rotation.x = -0.9; return; }
  u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = s * 0.8;
}
