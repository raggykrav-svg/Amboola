// Driving: get into a parked car (E), drive it with arcade handling, handbrake drifts, collisions with
// buildings, trees, cars and people, a chase camera or the driver's seat (on the right: Cyprus drives on
// the left), and get out again. Cars you leave stay where you parked them.
import * as THREE from 'three';
import { CAR_TYPES, buildCar, makeCarMaterial, carCircles } from './cars.js';
import { chunkIndex } from './data.js';

// top speed (m/s), acceleration (m/s²) per kind of car
const SPEC = [{ vmax: 46, acc: 5.0 }, { vmax: 54, acc: 5.6 }, { vmax: 50, acc: 5.2 }, { vmax: 45, acc: 4.6 }, { vmax: 41, acc: 4.0 }];
const KEEP_LEFT = 6; // cars you leave behind stay (the oldest goes when you leave more)

export { SPEC };
export class Driving {
  constructor(scene, city, cars, life, forest, U, sound) {
    this.scene = scene; this.city = city; this.cars = cars; this.life = life; this.forest = forest; this.U = U; this.sound = sound;
    this.geo = new Map();
    this.car = null;          // the car you drive: {t, c, x, z, ry, vx, vz, steer, y, mesh, ...}
    this.left = [];           // cars you got out of
    this.view = 'chase';      // chase | seat
    this.orbit = 0; this.orbitT = 0; this.shake = 0;
    this.camPos = new THREE.Vector3(); this.camYaw = 0;
  }

  geometry(t) { let g = this.geo.get(t); if (!g) { g = buildCar(CAR_TYPES[t], false); this.geo.set(t, g); } return g; }
  makeMesh(t, colour) {
    const m = new THREE.Mesh(this.geometry(t), makeCarMaterial(this.U, true));
    m.material.color.set(colour);
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  // the nearest car you can get into, within 3.5 m of its side
  findCar(px, pz) {
    let best = null, bd = 4.2;
    const consider = (o, src) => {
      const T = CAR_TYPES[o.t], fx = Math.cos(o.ry), fz = -Math.sin(o.ry);
      const dx = px - o.x, dz = pz - o.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      const d = Math.max(0, Math.abs(along) - T.L / 2) + Math.max(0, side - T.W / 2);
      if (d < bd) { bd = d; best = { src, o }; }
    };
    for (const o of this.left) consider(o, 'left');
    for (const grp of this.city.details.values()) for (const o of (grp.userData.parked || [])) if (Math.abs(o.x - px) < 8 && Math.abs(o.z - pz) < 8) consider(o, 'parked');
    return best;
  }

  // take a car: from the street, one you left, or a new one given by a job
  enter(found, player) {
    let o = found.o;
    if (found.src === 'parked') {
      for (const grp of this.city.details.values()) {
        const list = grp.userData.parked; if (!list) continue;
        const i = list.indexOf(o); if (i >= 0) { list.splice(i, 1); break; }
      }
      this.removeColliders(o);
      this.city.detailVersion++;
      o = { t: o.t, c: o.c, x: o.x, z: o.z, ry: o.ry };
    } else if (found.src === 'left') {
      this.left.splice(this.left.indexOf(o), 1);
    }
    const mesh = o.mesh || this.makeMesh(o.t, o.c);
    this.car = { t: o.t, c: o.c, x: o.x, z: o.z, ry: o.ry, vx: 0, vz: 0, vF: 0, steer: 0, y: 0, pitch: 0, roll: 0, mesh, slip: 0, job: o.job || null };
    this.camYaw = o.ry; this.camD = 0; this.orbit = 0; this.camPos.set(o.x - Math.cos(o.ry) * 7, 3, o.z + Math.sin(o.ry) * 7);
    player.body.visible = false;
    this.sound.door(); this.sound.engineOn();
    mesh.position.set(o.x, 0, o.z); mesh.rotation.set(0, o.ry, 0, 'YXZ');
  }
  // a brand-new car (jobs)
  spawn(t, colour, x, z, ry, player, job = null) {
    if (this.car) this.exit(player, true);
    this.enter({ src: 'new', o: { t, c: colour, x, z, ry, job } }, player);
  }

  exit(player, silent = false) {
    const c = this.car; if (!c) return;
    const T = CAR_TYPES[c.t], fx = Math.cos(c.ry), fz = -Math.sin(c.ry), rx = -fz, rz = fx;
    // get out on the driver's side (right), else the other side, the back or the front
    const tries = [[rx, rz, T.W / 2 + 0.7], [-rx, -rz, T.W / 2 + 0.7], [-fx, -fz, T.L / 2 + 0.8], [fx, fz, T.L / 2 + 0.8]];
    let spot = null;
    for (const [dx, dz, d] of tries) {
      const x = c.x + dx * d, z = c.z + dz * d, s = this.city.surfaceAt(x, z);
      if (s !== 12 && s !== 0 && s !== 8 && !player.blocked(x, z)) { spot = [x, z]; break; }
    }
    if (!spot) spot = [c.x + rx * (T.W / 2 + 0.7), c.z + rz * (T.W / 2 + 0.7)];
    c.vx = c.vz = 0;
    this.left.push({ t: c.t, c: c.c, x: c.x, z: c.z, ry: c.ry, mesh: c.mesh });
    if (this.left.length > KEEP_LEFT) { const old = this.left.shift(); this.scene.remove(old.mesh); old.mesh.material.dispose(); }
    this.car = null;
    player.teleport(spot[0], spot[1], c.ry - Math.PI / 2);
    player.body.visible = player.mode === 'third';
    if (!silent) this.sound.door();
    this.sound.engineOff();
  }

  removeColliders(o) {
    const ci = chunkIndex(this.city.data, o.x, o.z); if (ci < 0) return;
    const R = this.city.rasters.get(ci); if (!R || !R.colliders) return;
    const cc = carCircles(o.t), fx = Math.cos(o.ry), fz = -Math.sin(o.ry);
    const ax = o.x + fx * cc.off, az = o.z + fz * cc.off, bx = o.x - fx * cc.off, bz = o.z - fz * cc.off;
    const C = R.colliders;
    for (let i = C.length - 3; i >= 0; i -= 3) {
      if ((Math.abs(C[i] - ax) < 0.05 && Math.abs(C[i + 1] - az) < 0.05) || (Math.abs(C[i] - bx) < 0.05 && Math.abs(C[i + 1] - bz) < 0.05)) C.splice(i, 3);
    }
  }

  // circles of the cars you left (for walking and driving collisions)
  leftColliders(x, z, fn) {
    for (const o of this.left) {
      if (Math.abs(o.x - x) > 6 || Math.abs(o.z - z) > 6) continue;
      const cc = carCircles(o.t), fx = Math.cos(o.ry), fz = -Math.sin(o.ry);
      fn(o.x + fx * cc.off, o.z + fz * cc.off, cc.r); fn(o.x - fx * cc.off, o.z - fz * cc.off, cc.r);
    }
  }

  // push one circle out of everything solid; returns the push and the hardest normal (and what it was)
  push(cx, cz, r, acc, extra, people = true, ghost = false) {
    let px = 0, pz = 0;
    const add = (dx, dz, pen, kind) => { px += dx * pen; pz += dz * pen; if (pen > acc.pen) { acc.pen = pen; acc.nx = dx; acc.nz = dz; acc.kind = kind; } };
    this.city.edgesNear(cx, cz, r + 0.5, (x1, z1, x2, z2) => {
      const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz; if (l2 < 1e-6) return;
      const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cz - z1) * dz) / l2));
      const qx = x1 + dx * t, qz = z1 + dz * t; let ex = cx - qx, ez = cz - qz; const d = Math.hypot(ex, ez);
      if (d < r && d > 1e-5) add(ex / d, ez / d, r - d, 'wall');
    });
    const circle = (tx, tz, rr, kind = 'car') => {
      if (kind === 'person' && !people) return;
      const ex = cx - tx, ez = cz - tz, d = Math.hypot(ex, ez), m = rr + r; if (d < m && d > 1e-4) add(ex / d, ez / d, m - d, kind);
    };
    if (extra) extra(cx, cz, circle);
    if (ghost) return [px, pz];               // squeezing past: only walls (and the extra circles) count
    this.forest.trunksNear(cx, cz, (x, z, rr) => circle(x, z, rr, 'tree'));
    this.leftColliders(cx, cz, circle);
    for (const R of this.city.rasters.values()) {
      if (!R.colliders || cx < R.ox - 4 || cx > R.ox + 254 || cz < R.oz - 4 || cz > R.oz + 254) continue;
      const C = R.colliders;
      for (let i = 0; i < C.length; i += 3) if (Math.abs(C[i] - cx) < 3 && Math.abs(C[i + 1] - cz) < 3) circle(C[i], C[i + 1], C[i + 2], 'car');
    }
    if (this.life) this.life.colliders(cx, cz, circle);
    return [px, pz];
  }

  // one physics step for any car (yours or a police car). inp: {x steer right +, y throttle + / brake -, jump handbrake}.
  // Returns the hardest hit: {impact m/s, kind 'wall' | 'tree' | 'car' | 'person' | 'police' | 'player'}
  step(c, inp, dt, extra, people = true, ghost = false) {
    const T = CAR_TYPES[c.t], S = c.spec || SPEC[c.t], wb = T.L - T.fo - T.ro;
    // steering: less at speed; the heading turns with the front wheels
    const sp = Math.hypot(c.vx, c.vz);
    const target = -inp.x * 0.6 / (1 + sp / 13);
    c.steer += (target - c.steer) * Math.min(1, dt * 7);
    const hand = !!inp.jump;
    c.ry += c.vF / wb * Math.tan(c.steer) * dt * (hand ? 1.3 : 1);
    // velocity in the car's frame
    const fx = Math.cos(c.ry), fz = -Math.sin(c.ry), rx = -fz, rz = fx;
    let vF = c.vx * fx + c.vz * fz, vR = c.vx * rx + c.vz * rz;
    const thr = Math.max(0, inp.y), brk = Math.max(0, -inp.y);
    if (thr > 0) vF += vF < -0.3 ? 14 * thr * dt : S.acc * thr * Math.max(0, 1 - Math.max(0, vF) / S.vmax) * dt;
    if (brk > 0) vF -= vF > 0.3 ? 13 * brk * dt : 4.5 * brk * dt;
    vF = Math.max(-S.vmax * 0.18, vF); // reverse is slow
    vF -= vF * (0.05 + 0.0011 * Math.abs(vF)) * dt;              // air and rolling
    if (!thr && !brk) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 1.4 * dt); // engine braking
    if (hand) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 4 * dt);
    vR *= Math.exp(-(hand ? 1.5 : 10) * dt);                      // grip (low with the handbrake: drift)
    const accel = (vF - c.vF) / dt; c.vF = vF; c.slip = Math.abs(vR);
    c.vx = fx * vF + rx * vR; c.vz = fz * vF + rz * vR;
    // move, then push the car's three circles out of walls, trees, cars and people
    const ox = c.x, oz = c.z;
    c.x += c.vx * dt; c.z += c.vz * dt;
    const cc = carCircles(c.t), r = T.W / 2 + 0.04;
    const acc = { pen: 0, nx: 0, nz: 0, kind: null };
    for (let it = 0; it < 3; it++) {
      let sx = 0, sz = 0, n = 0;
      for (const k of [-1, 0, 1]) {
        const [px, pz] = this.push(c.x + fx * cc.off * k, c.z + fz * cc.off * k, r, acc, extra, people, ghost);
        if (px || pz) { sx += px; sz += pz; n++; }
      }
      if (!n) break;
      c.x += sx / n; c.z += sz / n;
    }
    // the sea, ponds, piers and rocks stop the car
    for (const k of [1, 0, -1]) {
      const s = this.city.surfaceAt(c.x + fx * (T.L / 2) * k, c.z + fz * (T.L / 2) * k);
      if (s === 0 || s === 8 || s === 10 || s === 11) { c.x = ox; c.z = oz; acc.pen = 1; acc.nx = -Math.sign(c.vF) * fx; acc.nz = -Math.sign(c.vF) * fz; acc.kind = 'wall'; break; }
    }
    const A = this.city.h.area;
    c.x = Math.min(A[2] - 5, Math.max(A[0] + 5, c.x)); c.z = Math.min(A[3] - 5, Math.max(A[1] + 5, c.z));
    let impact = 0;
    if (acc.pen > 0) { // lose the speed that went into the obstacle
      const vn = c.vx * acc.nx + c.vz * acc.nz;
      if (vn < 0) {
        c.vx -= acc.nx * vn * 1.25; c.vz -= acc.nz * vn * 1.25;
        impact = -vn;
        c.vF = c.vx * fx + c.vz * fz;
      }
    }
    // ride height (kerbs), body pitch and roll
    const s0 = this.city.surfaceAt(c.x, c.z);
    c.y += ((s0 === 7 ? 0.12 : 0) - c.y) * Math.min(1, dt * 10);
    c.pitch += (Math.max(-0.05, Math.min(0.05, accel * 0.0045)) - c.pitch) * Math.min(1, dt * 6); // nose up when speeding up, down when braking
    c.roll += (Math.max(-0.06, Math.min(0.06, c.vF * c.vF / wb * Math.tan(c.steer) * 0.0035)) - c.roll) * Math.min(1, dt * 6);
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.rotation.set(c.roll, c.ry, c.pitch, 'YXZ');
    return { impact, kind: acc.kind };
  }

  update(dt, inp, player, camera) {
    const c = this.car; if (!c) return;
    dt = Math.min(dt, 0.05);
    const hit = this.step(c, inp, dt, this.extra);
    if (hit.impact > 3) { this.sound.crash(Math.min(1, hit.impact / 18)); this.shake = Math.min(1, hit.impact / 15); }
    if (hit.impact > 0 && this.onHit) this.onHit(hit);
    // the walker rides along (minimap, places, sounds use the player position)
    player.pos.set(c.x, c.y, c.z); player.feet = c.y; player.yaw = this.camYaw - Math.PI / 2; player.speed = Math.abs(c.vF);
    this.sound.engine(Math.abs(c.vF), Math.max(0, inp.y), c.slip, SPEC[c.t].vmax);
    this.camera(dt, inp, camera);
  }

  // the police keep the car (busted)
  impound(player) {
    const c = this.car; if (!c) return;
    this.scene.remove(c.mesh); c.mesh.material.dispose();
    this.car = null;
    this.sound.engineOff();
    player.body.visible = player.mode === 'third';
  }

  // circles of the car you drive (police cars bump into it)
  carColliders(x, z, fn) {
    const c = this.car; if (!c || Math.abs(c.x - x) > 7 || Math.abs(c.z - z) > 7) return;
    const cc = carCircles(c.t), fx = Math.cos(c.ry), fz = -Math.sin(c.ry);
    for (const k of [-1, 0, 1]) fn(c.x + fx * cc.off * k, c.z + fz * cc.off * k, CAR_TYPES[c.t].W / 2, 'player');
  }

  camera(dt, inp, cam) {
    const c = this.car, T = CAR_TYPES[c.t];
    const fx = Math.cos(c.ry), fz = -Math.sin(c.ry);
    this.shake *= Math.exp(-dt * 6);
    const sh = this.shake * 0.25;
    if (this.view === 'seat') {
      // right-hand drive: the driver sits on the right
      const rx = -fz, rz = fx;
      cam.position.set(c.x + fx * (0.05 - T.L * 0.02) + rx * 0.36, c.y + T.bh + 0.3, c.z + fz * (0.05 - T.L * 0.02) + rz * 0.36);
      this.orbit += inp.lookX * -1; this.orbit = Math.max(-2.2, Math.min(2.2, this.orbit));
      if (!inp.lookX) this.orbit *= Math.exp(-dt * 1.5);
      this.orbitT = Math.max(-0.5, Math.min(0.4, (this.orbitT || 0) - inp.lookY));
      cam.rotation.set(this.orbitT + c.pitch, c.ry - Math.PI / 2 + this.orbit, -c.roll, 'YXZ');
      this.camYaw = c.ry;
      return;
    }
    // chase: behind the car, turning with it a little late; the mouse swings it around
    const sp = Math.hypot(c.vx, c.vz);
    const head = sp > 2 && c.vF > 0 ? Math.atan2(-c.vz, c.vx) : c.ry;
    let d = head - this.camYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    this.camYaw += d * Math.min(1, dt * 3.2);
    this.orbit -= inp.lookX; if (!inp.lookX) this.orbit *= Math.exp(-dt * 0.8);
    this.orbitT = Math.max(-0.3, Math.min(0.6, (this.orbitT || 0.12) - inp.lookY));
    const yaw = this.camYaw + this.orbit + (inp.back ? Math.PI : 0); // hold B: look back
    const dist = 5.4 + T.L * 0.35 + Math.min(2.5, sp * 0.05), hgt = 1.6 + T.H * 0.55 + this.orbitT * 4;
    // the camera stays on an arc behind the car (never a straight cut through a corner); a wall in the
    // way shortens the arm at once, and it grows back slowly when the way is clear
    const bx = -Math.cos(yaw), bz = Math.sin(yaw), px = -bz, pz = bx;
    let D = dist;
    for (let k = T.L / 2; k <= dist + 0.6; k += 0.35) {
      let hit = false;
      for (const o of [0, -0.45, 0.45]) if (this.city.surfaceAt(c.x + bx * k + px * o, c.z + bz * k + pz * o) === 12) { hit = true; break; }
      if (hit) { D = Math.max(1.2, k - 0.8); break; }
    }
    this.camD = Math.min(D, (this.camD || D) + dt * 4);
    const lift = Math.max(0, 3.2 - this.camD) * 0.55; // look over the car when the arm is short
    this.camPos.set(c.x + bx * this.camD, c.y + hgt + lift, c.z + bz * this.camD);
    cam.position.copy(this.camPos);
    cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh;
    const ls = inp.back ? -1 : 1;
    cam.lookAt(c.x + fx * 2.5 * ls, c.y + 1.1 + T.H * 0.2, c.z + fz * 2.5 * ls);
  }

  speedKmh() { return this.car ? Math.abs(this.car.vF) * 3.6 : 0; }
  clearLeft() { for (const o of this.left) { this.scene.remove(o.mesh); o.mesh.material.dispose(); } this.left.length = 0; }
}
