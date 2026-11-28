// Police of Limassol: patrol cars drive around; break the rules (very fast past a speed camera, hard
// crashes, hitting a police car, speeding in front of a patrol) and you get wanted stars. Police cars
// with blue lights and sirens then chase you along the real streets (GPS routes), try to box you in and
// stop you. Stay out of their sight long enough to lose them; if they stop you, you are BUSTED: a fine,
// they keep the car, and you walk out of Limassol Central Police station. No weapons.
import * as THREE from 'three';
import { CAR_TYPES, buildCar, makeCarMaterial, carCircles } from './cars.js';
import { makeGlow } from './textures.js';

const T_POLICE = 1;                           // a saloon
const SPEC_POLICE = { vmax: 52, acc: 6.2 };   // a bit quicker off the line than a normal saloon
const STATION = { x: -358, z: -406 };         // Limassol Central Police HQ (OpenStreetMap)

// a point `look` metres further along the route from the point nearest (x, z)
function lookahead(route, x, z, look) {
  let bi = 1, bt = 0, bd = 1e18;
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1], [bx, bz] = route[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const d = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2;
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  let [px, pz] = [route[bi - 1][0] + (route[bi][0] - route[bi - 1][0]) * bt, route[bi - 1][1] + (route[bi][1] - route[bi - 1][1]) * bt];
  let rem = look;
  for (let k = bi; k < route.length; k++) {
    const [qx, qz] = route[k], seg = Math.hypot(qx - px, qz - pz);
    if (seg >= rem) return [px + (qx - px) / seg * rem, pz + (qz - pz) / seg * rem];
    rem -= seg; px = qx; pz = qz;
  }
  return route[route.length - 1];
}

// how far the car must turn to follow the route within the next `dist` metres (largest angle between the
// car's heading and a route segment ahead), so it can brake before a corner instead of hitting it
function turnAhead(route, x, z, fx, fz, dist) {
  let bi = 1, bt = 0, bd = 1e18;
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1], [bx, bz] = route[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const d = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2;
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  let acc = 0, worst = 0;
  for (let k = bi; k < route.length && acc < dist; k++) {
    const [ax, az] = route[k - 1], [bx, bz] = route[k];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.5) continue;
    if (k > bi || bt < 0.98) worst = Math.max(worst, Math.abs(Math.atan2((dx * fz - dz * fx) / L, (dx * fx + dz * fz) / L)));
    acc += k === bi ? L * (1 - bt) : L;
  }
  return worst;
}

export class Police {
  constructor(o) {
    Object.assign(this, o); // scene, city, router, driving, player, sound, wallet, jobs, life, U, q, ui
    this.wanted = 0; this.cars = []; this.t = 0;
    this.lostT = 0; this.chaseT = 0; this.bustT = 0; this.spawnT = 0; this.cool = {};
    this.track = 0; this.last = { x: 0, z: 0 };   // seconds the police still know where you are; where they saw you
    this.seen = false; this.nearest = 1e9;
    this.geo = buildCar(CAR_TYPES[T_POLICE], false);
    this.glowTex = makeGlow();
    this.textTex = this.sideText();
    this.station = this.jobs.roadPoint(STATION.x, STATION.z, 160) || { x: STATION.x + 30, z: STATION.z };
    this.maxCars = o.q.policeMax || 4; this.patrolN = o.q.patrols || 2;
  }

  // ---------------------------------------------------------------- looks
  sideText() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = '#123a9c'; x.font = 'bold 40px system-ui, Arial, sans-serif'; x.textBaseline = 'middle';
    x.textAlign = 'left'; x.fillText('ΑΣΤΥΝΟΜΙΑ', 8, 34);
    x.textAlign = 'right'; x.fillText('POLICE', 504, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  makeMesh() {
    const T = CAR_TYPES[T_POLICE];
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geo, makeCarMaterial(this.U, true));
    body.material.color.set(0xf6f7f9); body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const blue = new THREE.MeshStandardMaterial({ color: 0x1846c8, roughness: 0.35, metalness: 0.1 });
    // the blue stripe along both sides, above the wheel arches
    const sl = T.L - 0.7;
    for (const s of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(sl, 0.11, 0.012), blue);
      st.position.set(-0.02, T.bh - 0.17, s * (T.W / 2 * 0.985 + 0.004)); g.add(st);
      const tx = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.21), new THREE.MeshStandardMaterial({ map: this.textTex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
      tx.position.set(0.05, 0.5, s * (T.W / 2 + 0.006));
      if (s < 0) tx.rotation.y = Math.PI;
      g.add(tx);
    }
    // POLICE on the front and the back
    const band = (w) => {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 40;
      const x = cv.getContext('2d'); x.fillStyle = '#1846c8'; x.fillRect(0, 0, 256, 40);
      x.fillStyle = '#ffffff'; x.font = 'bold 30px system-ui, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLICE', 128, 22);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 40 / 256), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    };
    const fb = band(0.95); fb.position.set(T.L / 2 + 0.006, T.hh - 0.16, 0); fb.rotation.y = Math.PI / 2; g.add(fb);
    const rb = band(1.0); rb.position.set(-T.L / 2 - 0.006, T.th - 0.27, 0); rb.rotation.y = -Math.PI / 2; g.add(rb);
    // light bar: two blue halves that flash in turn
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 1.12), new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.6 }));
    base.position.set(-0.05, T.H + 0.06, 0); g.add(base);
    const lights = [], glows = [];
    for (const s of [-1, 1]) {
      const m = new THREE.MeshStandardMaterial({ color: 0x0d2a8a, emissive: 0x3f7bff, emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.92 });
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.5), m);
      l.position.set(-0.05, T.H + 0.14, s * 0.28); g.add(l); lights.push(m);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x3f74ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.set(-0.05, T.H + 0.2, s * 0.35); sp.scale.setScalar(3); g.add(sp); glows.push(sp);
    }
    g.userData = { lights, glows };
    this.scene.add(g);
    return g;
  }

  // ---------------------------------------------------------------- spawning
  spawn(mode) {
    const P = this.player.pos;
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * Math.PI * 2, d = mode === 'chase' ? 130 + Math.random() * 110 : 200 + Math.random() * 170;
      const p = this.jobs.roadPoint(P.x + Math.cos(a) * d, P.z + Math.sin(a) * d, 60);
      if (!p) continue;
      const dp = Math.hypot(p.x - P.x, p.z - P.z);
      if (dp < (mode === 'chase' ? 90 : 150)) continue;
      if (dp < 170 && this.los(p.x, p.z, P.x, P.z)) continue;        // appear out of sight
      if (this.cars.some((o) => Math.hypot(o.c.x - p.x, o.c.z - p.z) < 10)) continue;
      const s = this.city.surfaceAt(p.x, p.z); if (s === 12 || s === 0 || s === 8) continue;
      const toward = (P.x - p.x) * Math.cos(p.ry) + (P.z - p.z) * -Math.sin(p.ry) > 0;
      const ry = toward ? p.ry : p.ry + Math.PI;
      const c = { t: T_POLICE, x: p.x, z: p.z, ry, vx: 0, vz: 0, vF: 0, steer: 0, y: 0, pitch: 0, roll: 0, slip: 0, spec: SPEC_POLICE, mesh: this.makeMesh() };
      c.mesh.position.set(p.x, 0, p.z); c.mesh.rotation.set(0, ry, 0, 'YXZ');
      const pc = { c, mode, route: null, routeT: 0, dest: null, stuck: 0, rev: 0, losT: Math.random() * 0.3, sees: false, near: 0, best: 1e9, bestT: 0, search: null };
      if (mode === 'patrol') pc.dest = this.jobs.randomSpot(p.x, p.z, 300, 600);
      this.cars.push(pc);
      return pc;
    }
    return null;
  }
  remove(pc) {
    this.scene.remove(pc.c.mesh);
    pc.c.mesh.traverse((o) => {
      if (o.geometry && o.geometry !== this.geo && !o.isSprite) o.geometry.dispose(); // sprites share one built-in quad
      if (o.material) o.material.dispose();
    });
    this.cars.splice(this.cars.indexOf(pc), 1);
  }
  clear() { while (this.cars.length) this.remove(this.cars[0]); }

  // ---------------------------------------------------------------- seeing
  los(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 3);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.city.surfaceAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) === 12) return false; }
    return true;
  }

  // circles of the police cars for any car's physics (skip one: the car being moved)
  colliders(x, z, fn, skip = null) {
    for (const pc of this.cars) {
      const c = pc.c; if (c === skip || Math.abs(c.x - x) > 7 || Math.abs(c.z - z) > 7) continue;
      const cc = carCircles(c.t), fx = Math.cos(c.ry), fz = -Math.sin(c.ry);
      for (const k of [-1, 0, 1]) fn(c.x + fx * cc.off * k, c.z + fz * cc.off * k, CAR_TYPES[c.t].W / 2, 'police');
    }
  }

  // ---------------------------------------------------------------- wanted level
  addWanted(n, why, key = why) {
    if (this.busting || this.player.mode === 'drone') return;
    if (this.cool[key] > this.t) return;
    this.cool[key] = this.t + 8;
    const before = this.wanted;
    this.wanted = Math.min(5, this.wanted + n);
    if (this.wanted === before) return;
    this.lostT = 0; this.chaseT = 0;
    this.track = 10; this.last = { x: this.player.pos.x, z: this.player.pos.z }; // reported: they know where you are for a while
    this.ui.flash(`🚨 ${why}`);
    this.sound.chirp();
    for (const pc of this.cars) if (pc.mode === 'patrol' && Math.hypot(pc.c.x - this.player.pos.x, pc.c.z - this.player.pos.z) < 400) { pc.mode = 'chase'; pc.route = null; }
  }
  // crashes reported by your car's physics
  crash(hit) {
    if (hit.kind === 'police' && hit.impact > 2) this.addWanted(1, 'You hit a police car!', 'hitpolice');
    else if (hit.kind === 'car' && hit.impact > 9) this.addWanted(1, 'Crash reported to the police', 'crash');
  }
  escape() {
    this.wanted = 0; this.bustT = 0;
    this.ui.flash('😎 You lost the police!');
    this.sound.ding();
    for (const pc of this.cars) { pc.mode = 'patrol'; pc.route = null; pc.dest = this.jobs.randomSpot(pc.c.x, pc.c.z, 300, 700); }
  }
  bust() {
    this.fine = Math.min(this.wallet.money, 50 * this.wanted);
    if (this.jobs.job) this.jobs.stop('Job lost: you were arrested');
    if (this.driving.car) this.driving.impound(this.player);
    this.clear();
    this.wanted = 0; this.bustT = 0; this.track = 0;
    this.busting = 1.8; // seconds of the BUSTED screen, then you walk out of the station
    this.ui.busted(this.fine);
  }
  released() {
    const st = this.station;
    this.player.teleport(st.x, st.z, Math.atan2(-(STATION.x - st.x), -(STATION.z - st.z)) + Math.PI);
    if (this.fine) this.wallet.add(-this.fine, 'police fine');
    this.fine = 0;
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    this.t += dt;
    if (this.busting > 0) { this.busting -= dt; if (this.busting <= 0) { this.busting = 0; this.released(); this.afterBust = 1.8; } }
    else if (this.afterBust > 0) this.afterBust -= dt;
    const P = this.player.pos, car = this.driving.car, inCar = !!car;
    const pv = inCar ? { x: car.vx, z: car.vz } : { x: 0, z: 0 };
    const pSpeed = inCar ? Math.abs(car.vF) : 0;
    // spawn and remove
    const chaseWant = this.wanted ? Math.min(this.maxCars, this.wanted + (this.wanted >= 3 ? 1 : 0)) : 0;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.player.mode !== 'drone' && !this.busting) {
      this.spawnT = 0.8;
      const nChase = this.cars.filter((p) => p.mode === 'chase').length, nPatrol = this.cars.length - nChase;
      if (nChase < chaseWant) {
        const pat = this.cars.find((p) => p.mode === 'patrol' && Math.hypot(p.c.x - P.x, p.c.z - P.z) < 450);
        if (pat) { pat.mode = 'chase'; pat.route = null; } else this.spawn('chase');
      } else if (!this.wanted && nPatrol < this.patrolN) this.spawn('patrol');
    }
    for (const pc of [...this.cars]) {
      const d = Math.hypot(pc.c.x - P.x, pc.c.z - P.z);
      if ((pc.mode === 'chase' && d > 520) || (pc.mode === 'patrol' && d > 650 && !pc.sees)) this.remove(pc);
    }
    // each police car: look, think, drive, lights
    let seen = false, nearest = 1e9;
    const blockers = [];
    for (const pc of [...this.cars]) {
      const c = pc.c, d = Math.hypot(c.x - P.x, c.z - P.z);
      pc.losT -= dt;
      if (pc.losT <= 0) { pc.losT = 0.3; pc.sees = d < 95 && this.player.mode !== 'drone' && this.los(c.x, c.z, P.x, P.z); }
      if (pc.mode === 'chase') {
        nearest = Math.min(nearest, d); if (pc.sees) seen = true;
        // a chase car that gets no closer for 15 s (stuck somewhere) is sent away; another one comes
        if (d < pc.best - 15) { pc.best = d; pc.bestT = 0; } else if ((pc.bestT += dt) > 15 && !pc.sees) { this.remove(pc); continue; }
      }
      if (pc.mode === 'patrol' && pc.sees && d < 55 && pSpeed > 22) this.addWanted(1, 'A police car saw you speeding', 'speeding');
      this.drive(pc, dt, P, pv, d);
      this.lights(pc, dt);
      blockers.push({ x: c.x, z: c.z, ux: Math.cos(c.ry), uz: -Math.sin(c.ry), lit: pc.mode === 'chase' && this.wanted > 0 });
    }
    if (this.life) this.life.blockers = blockers;
    this.seen = seen; this.nearest = nearest;
    // they know where you are while they see you (and for a few seconds after); then they search where
    // they saw you last. Get away from that spot without being seen and you lose them.
    if (seen) { this.track = 3; this.last = { x: P.x, z: P.z }; } else this.track = Math.max(0, this.track - dt);
    if (this.wanted) {
      const away = Math.hypot(P.x - this.last.x, P.z - this.last.z) > 60 + 15 * this.wanted;
      if (seen || this.track > 0) { this.lostT = 0; if (seen) { this.chaseT += dt; if (this.chaseT > 45) { this.chaseT = 0; this.addWanted(1, 'More police are coming!', 'more' + this.wanted); } } }
      else if (away) { this.lostT += dt; if (this.lostT > 4 + 2 * this.wanted) this.escape(); }
      // busted: a police car right next to you while you are stopped (or on foot)
      let close = false;
      for (const pc of this.cars) {
        if (pc.mode !== 'chase') continue;
        const d = Math.hypot(pc.c.x - P.x, pc.c.z - P.z);
        if (d < (inCar ? 7.5 : 8.5) || (!inCar && d < 30 && pc.sees && Math.abs(pc.c.vF) < 1.5 && (pc.near += dt) > 6)) close = true;
        if (d > 30 || !pc.sees) pc.near = 0;
      }
      if (close && pSpeed < 2.5) { this.bustT += dt; if (this.bustT > 3) this.bust(); }
      else this.bustT = Math.max(0, this.bustT - dt * 1.5);
    }
    this.sound.siren(this.wanted > 0 && nearest < 420 && !this.busting, nearest);
  }

  // drive a police car: follow a GPS route to you (or to its patrol stop); when it can see you close by,
  // go straight for you; brake for sharp turns; back up when stuck
  drive(pc, dt, P, pv, d) {
    const c = pc.c;
    const chase = pc.mode === 'chase';
    if (!chase && (!pc.dest || Math.hypot(pc.dest.x - c.x, pc.dest.z - c.z) < 20)) { pc.dest = this.jobs.randomSpot(c.x, c.z, 300, 600); pc.route = null; }
    let goal = pc.dest;
    if (chase) {
      if (this.track > 0) { goal = P; pc.search = null; }
      else {
        const L = this.last;
        if (!pc.search || Math.hypot(pc.search.x - c.x, pc.search.z - c.z) < 18) {
          // drive to where they saw you, then look around there
          pc.search = Math.hypot(L.x - c.x, L.z - c.z) > 30 ? { x: L.x, z: L.z } : (this.jobs.randomSpot(L.x, L.z, 40, 140) || { x: L.x, z: L.z });
          pc.route = null;
        }
        goal = pc.search;
      }
    }
    let tx, tz;
    pc.routeT -= dt;
    if (chase && pc.sees && d < 22) { // the last stretch: straight for you
      const lead = Math.min(1, d / 25);
      tx = P.x + pv.x * lead; tz = P.z + pv.z * lead;
    } else if (goal) {
      const end = pc.route && pc.route[pc.route.length - 1];
      if (!pc.route || pc.routeT <= 0 || (chase && Math.hypot(end[0] - goal.x, end[1] - goal.z) > 25)) {
        pc.routeT = chase ? 1.2 + Math.random() * 0.6 : 5;
        pc.route = this.router.route(c.x, c.z, goal.x, goal.z, 1) || [[c.x, c.z], [goal.x, goal.z]];
      }
      [tx, tz] = lookahead(pc.route, c.x, c.z, 6 + Math.abs(c.vF) * 0.45);
      const v = Math.abs(c.vF);
      pc.turnAhead = turnAhead(pc.route, c.x, c.z, Math.cos(c.ry), -Math.sin(c.ry), 10 + v * v / 16); // braking distance and a margin
    } else { tx = c.x + Math.cos(c.ry); tz = c.z - Math.sin(c.ry); }
    const fx = Math.cos(c.ry), fz = -Math.sin(c.ry);
    const dx = tx - c.x, dz = tz - c.z;
    const ang = Math.atan2(dx * fz - dz * fx, dx * fx + dz * fz); // + = the target is to the left
    let steer = Math.max(-1, Math.min(1, ang * 2));
    let vDes = chase ? (this.wanted >= 3 ? 40 : 32) : 12;
    vDes = Math.min(vDes, 5 + 32 / (1 + 2.6 * Math.abs(ang)), 4 + 26 / (1 + 3.2 * (pc.turnAhead || 0))); // slow down before a corner
    if (chase && pc.sees && d < 30) vDes = Math.min(vDes, Math.hypot(pv.x, pv.z) + 6 + d * 0.4);
    let y = c.vF < vDes ? 1 : (c.vF > vDes + 3 ? -0.7 : 0);
    if (Math.abs(ang) > 1.9 && c.vF > 6) y = -1;
    // the target is behind and we are slow: a three-point turn (reverse with the wheels turned the other
    // way until the nose points at it)
    if (!pc.rev && !pc.turn && Math.abs(ang) > 2.0 && Math.abs(c.vF) < 5) pc.turn = 2.6;
    if (pc.turn > 0) {
      pc.turn -= dt;
      if (Math.abs(ang) < 0.9) pc.turn = 0;
      else { y = -1; steer = ang > 0 ? -1 : 1; }
    }
    // stuck: back up with full lock; stuck again soon after: squeeze past parked cars and trees for a moment
    if (pc.rev > 0) { pc.rev -= dt; y = -1; steer = ang > 0 ? -1 : 1; }
    else if (!(pc.turn > 0) && y > 0 && Math.abs(c.vF) < 0.8) {
      pc.stuck += dt;
      if (pc.stuck > 1.2) {
        pc.stuck = 0; pc.rev = 1.3;
        pc.fails = (pc.fails || 0) + 1;
        if (pc.fails >= 2) { pc.ghost = 3; pc.fails = 0; }
        pc.stuckAt = { x: c.x, z: c.z };
      }
    } else pc.stuck = Math.max(0, pc.stuck - dt);
    if (pc.stuckAt && Math.hypot(c.x - pc.stuckAt.x, c.z - pc.stuckAt.z) > 15) { pc.fails = 0; pc.stuckAt = null; }
    // no real progress for 3.5 s (rocking back and forth at a tight corner): squeeze through
    if (!pc.anchor || Math.hypot(c.x - pc.anchor.x, c.z - pc.anchor.z) > 4) { pc.anchor = { x: c.x, z: c.z }; pc.anchorT = 0; }
    else if ((pc.anchorT += dt) > 3.5 && !(chase && d < 9)) { pc.anchorT = 0; pc.ghost = 3; pc.turn = 0; pc.rev = 0; }
    pc.ghost = Math.max(0, (pc.ghost || 0) - dt);
    const solid = pc.ghost > 0 ? (x, z, fn) => this.driving.carColliders(x, z, fn) : (x, z, fn) => { this.colliders(x, z, fn, c); this.driving.carColliders(x, z, fn); };
    const hit = this.driving.step(c, { x: -steer, y, jump: false }, Math.min(dt, 0.05), solid, false, pc.ghost > 0);
    if (hit.impact > 5 && d < 60) this.sound.crash(Math.min(1, hit.impact / 25) * Math.max(0.2, 1 - d / 60));
  }

  lights(pc, dt) {
    const { lights, glows } = pc.c.mesh.userData;
    const on = pc.mode === 'chase' && this.wanted > 0;
    const night = this.U.uNight.value;
    const tt = this.t * 2.4 + pc.c.x * 0.01;
    const side = Math.floor(tt) % 2, flick = (tt * 4) % 1 < 0.55;
    for (let i = 0; i < 2; i++) {
      const lit = on && i === side && flick;
      lights[i].emissiveIntensity = lit ? 10 : 0;
      glows[i].material.opacity = lit ? (night >= 1 ? 1 : 0.95) : 0;
      glows[i].scale.setScalar(night >= 1 ? 6 : 4.2);
    }
  }
}
