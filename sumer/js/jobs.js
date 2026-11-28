// Jobs that pay euros: Taxi (Old Port rank), Souvlaki delivery (old town) and the Seafront race.
// Glowing markers in the city start them; the GPS route shows the way. Also the city's real speed
// cameras (from the map): drive past one too fast and it flashes and fines you.
import * as THREE from 'three';
import { chunk, chunkIndex } from './data.js';
import { routeLength, distToRoute } from './route.js';

const COL = { taxi: 0xffc23d, food: 0xff7a45, race: 0x58d3ff, goal: 0xffe14d, check: 0x58d3ff };

export class Jobs {
  constructor(o) {
    Object.assign(this, o); // scene, city, router, driving, player, sound, wallet, ui
    this.data = this.city.data;
    this.job = null; this.target = null; this.route = null; this.routeT = 0;
    this.best = this.store.get('raceBest', null);
    // where jobs start: on a street close to these places
    const spot = (x, z) => this.roadPoint(x, z, 120) || { x, z, ry: 0, name: '' };
    this.givers = [
      { id: 'taxi', n: 'Taxi rank', i: '🚕', ...spot(120, 420), d: 'Drive people around Limassol. Pick them up, take them where they want to go.' },
      { id: 'food', n: 'Souvlaki to go', i: '🥙', ...spot(150, -70), d: 'Deliver hot souvlaki before it gets cold. Faster = bigger tips.' },
      { id: 'race', n: 'Seafront race', i: '🏁', ...spot(420, 60), d: 'Race along the sea to the ONE tower through every checkpoint.' },
    ];
    this.beams = this.givers.map((g) => this.beam(g.x, g.z, COL[g.id], 2.2, 26));
    this.goalBeam = this.beam(0, 0, COL.goal, 3.2, 40); this.goalBeam.visible = false;
    this.checkBeams = [];
    // speed cameras
    this.cams = [];
    const g = this.city.g;
    for (let ci = 0; ci < g.nx * g.nz; ci++) { const p = chunk(this.data, ci).points; for (let i = 0; i < p.length; i += 3) if (p[i + 2] === 7) this.cams.push({ x: p[i], z: p[i + 1], cool: 0 }); }
  }

  // ---------------------------------------------------------------- helpers
  beam(x, z, col, r, h) {
    const grp = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, true), m); cyl.position.y = h / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    ring.position.y = 0.2;
    grp.add(cyl, ring); grp.position.set(x, 0, z); grp.renderOrder = 6;
    this.scene.add(grp);
    return grp;
  }
  // the nearest point on a car road (not a footpath) to (x, z), with the road direction and name
  roadPoint(x, z, maxD) {
    const g = this.city.g, ci = chunkIndex(this.data, x, z); if (ci < 0) return null;
    const ix = ci % g.nx, iz = Math.floor(ci / g.nx);
    let best = null, bd = maxD;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= g.nx || jz >= g.nz) continue;
      for (const rd of chunk(this.data, jz * g.nx + jx).roads) {
        if (rd.path || rd.cls < 3 || rd.cls > 8 || rd.w < 4.5) continue;
        const p = rd.pts;
        for (let i = 0; i + 3 < p.length; i += 2) {
          const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3], ddx = bx - ax, ddz = bz - az, l2 = ddx * ddx + ddz * ddz || 1;
          const t = Math.max(0, Math.min(1, ((x - ax) * ddx + (z - az) * ddz) / l2));
          const qx = ax + ddx * t, qz = az + ddz * t, d = Math.hypot(x - qx, z - qz);
          if (d < bd) { bd = d; const L = Math.sqrt(l2); best = { x: qx, z: qz, ry: Math.atan2(-ddz, ddx), name: rd.name, w: rd.w, ux: ddx / L, uz: ddz / L }; }
        }
      }
    }
    return best;
  }
  // a random kerb spot dmin..dmax metres from (x, z) that the GPS can reach
  randomSpot(x, z, dmin, dmax) {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, d = dmin + Math.random() * (dmax - dmin);
      const p = this.roadPoint(x + Math.cos(a) * d, z + Math.sin(a) * d, 60);
      if (!p || Math.hypot(p.x - x, p.z - z) < dmin * 0.7) continue;
      const side = Math.random() < 0.5 ? 1 : -1, off = Math.max(0, p.w / 2 - 1.2);
      p.x += -p.uz * off * side; p.z += p.ux * off * side;
      const s = this.city.surfaceAt(p.x, p.z);
      if (s === 12 || s === 0 || s === 8) continue;
      return p;
    }
    return null;
  }
  setTarget(p, label) {
    this.target = p ? { x: p.x, z: p.z, label } : null;
    this.route = null; this.routeT = 0;
    this.goalBeam.visible = !!p;
    if (p) this.goalBeam.position.set(p.x, 0, p.z);
  }
  pos() { return this.player.pos; }
  speed() { return this.driving.car ? Math.abs(this.driving.car.vF) : 0; }
  inCar() { return !!this.driving.car; }
  needCar(t, colour, g) {
    if (this.inCar()) return;
    // a car waits on the street next to the marker
    this.driving.spawn(t, colour, g.x, g.z, g.ry, this.player, g.id);
  }

  // ---------------------------------------------------------------- starting and stopping
  giverNear() {
    if (this.job) return null;
    const p = this.pos();
    return this.givers.find((g) => Math.hypot(g.x - p.x, g.z - p.z) < 6) || null;
  }
  start(g) {
    this.ui.toast(g.i, 'JOB', g.n, g.d);
    if (g.id === 'taxi') { this.needCar(1, 0x1b1c1e, g); this.taxiSign(); this.job = { id: 'taxi', n: 'Taxi', step: 'pickup', fares: 0, earned: 0 }; this.nextFare(); }
    if (g.id === 'food') { this.needCar(0, 0xf4f4f2, g); this.job = { id: 'food', n: 'Souvlaki delivery', shop: g, step: 'deliver', done: 0, earned: 0 }; this.nextDelivery(); }
    if (g.id === 'race') { this.needCar(1, 0xb3151a, g); this.startRace(g); }
    this.sound.ding();
  }
  stop(msg) {
    if (!this.job) return;
    const j = this.job; this.job = null;
    this.setTarget(null);
    for (const b of this.checkBeams) this.scene.remove(b); this.checkBeams = [];
    this.ui.flash(msg || `${j.n} finished${j.earned ? ` · earned €${j.earned}` : ''}`);
  }

  // ---------------------------------------------------------------- taxi
  taxiSign() {
    const c = this.driving.car; if (!c || c.mesh.userData.taxi) return;
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
    const x = cv.getContext('2d'); x.fillStyle = '#ffc93d'; x.fillRect(0, 0, 128, 32);
    x.fillStyle = '#1b1c1e'; x.font = 'bold 24px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TAXI', 64, 17);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const side = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffd36a, emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.5 });
    const plain = new THREE.MeshStandardMaterial({ color: 0xffc93d, emissive: 0xffc93d, emissiveIntensity: 0.3 });
    const H = [1.48, 1.45, 1.68, 1.8, 1.95][c.t] || 1.45;
    // a bar across the roof; "TAXI" reads from the front and the back (box faces +x, -x)
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.7), [side, side, plain, plain, plain, plain]);
    sign.position.set(0.05, H + 0.11, 0); sign.castShadow = true;
    c.mesh.add(sign); c.mesh.userData.taxi = sign;
  }
  nextFare() {
    const j = this.job, p = this.pos();
    const s = this.randomSpot(p.x, p.z, 250, 800);
    if (!s) return this.stop('No passengers right now');
    j.step = 'pickup'; j.pick = s; j.t0 = 0;
    this.setTarget(s, `Pick up the passenger${s.name ? ' on ' + s.name : ''}`);
  }
  // ---------------------------------------------------------------- souvlaki
  nextDelivery() {
    const j = this.job, sh = j.shop;
    const s = this.randomSpot(sh.x, sh.z, 450, 1500);
    if (!s) return this.stop('No orders right now');
    const r = this.router.route(sh.x, sh.z, s.x, s.z);
    const L = r ? routeLength(r) : Math.hypot(s.x - sh.x, s.z - sh.z) * 1.4;
    j.step = this.inCar() && Math.hypot(this.pos().x - sh.x, this.pos().z - sh.z) < 40 ? 'deliver' : 'shop';
    j.dest = s; j.limit = Math.round(L / 8.5 + 30); j.left = j.limit;
    if (j.step === 'shop') this.setTarget(sh, 'Pick up the souvlaki at the shop');
    else this.setTarget(s, `Deliver to ${s.name || 'the address'}`);
  }
  // ---------------------------------------------------------------- race
  startRace(g) {
    const fin = this.roadPoint(2010, -1250, 150);
    const r = fin && this.router.route(g.x, g.z, fin.x, fin.z);
    if (!r) return this.ui.flash('The race road is closed today');
    const L = routeLength(r);
    const cps = [];
    let acc = 0;
    for (let i = 1; i < r.length; i++) {
      const seg = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
      for (let d = 230 - acc; d < seg; d += 230) { const t = d / seg; cps.push({ x: r[i - 1][0] + (r[i][0] - r[i - 1][0]) * t, z: r[i - 1][1] + (r[i][1] - r[i - 1][1]) * t }); }
      acc = (acc + seg) % 230;
    }
    cps.push({ x: fin.x, z: fin.z });
    this.checkBeams = cps.map((c, i) => this.beam(c.x, c.z, i === cps.length - 1 ? 0xffffff : COL.check, 4.5, 30));
    this.job = { id: 'race', n: 'Seafront race', cps, k: 0, t: 0, count: 3.2, par: Math.round(L / 20), earned: 0 };
    this.setTarget(cps[0], 'Get ready…');
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    const p = this.pos();
    // markers pulse
    const tt = performance.now() / 1000;
    for (const b of [...this.beams, this.goalBeam, ...this.checkBeams]) b.children[0].material.opacity = 0.22 + 0.12 * Math.sin(tt * 3 + b.position.x);
    this.beams.forEach((b) => { b.visible = !this.job; });
    // speed cameras: 70 km/h and up
    // (cameras often come in pairs, one for each direction: one pass, one fine)
    this.camCool = Math.max(0, (this.camCool || 0) - dt);
    if (this.inCar() && !this.camCool) for (const c of this.cams) {
      if (Math.abs(c.x - p.x) > 22 || Math.abs(c.z - p.z) > 22 || Math.hypot(c.x - p.x, c.z - p.z) > 22) continue;
      const kmh = this.speed() * 3.6;
      if (kmh > 70) { this.camCool = 8; const fine = kmh > 100 ? 60 : 30; this.wallet.add(-fine, 'fine'); this.ui.cameraFlash(); this.sound.shutter(); this.ui.flash(`📸 Speed camera: ${Math.round(kmh)} km/h · fine €${fine}`); }
      break;
    }
    const j = this.job; if (!j) { this.updateRoute(dt); return; }
    // leaving the car for long ends a driving job
    if (!this.inCar()) { j.out = (j.out || 0) + dt; if (j.out > 12) return this.stop(`${j.n} stopped: you left the car`); } else j.out = 0;
    const near = (q, r) => Math.hypot(q.x - p.x, q.z - p.z) < r;
    const stopped = this.inCar() && this.speed() < 2.5;
    if (j.id === 'taxi') {
      if (j.step === 'pickup' && near(j.pick, 8) && stopped) {
        const d = this.randomSpot(p.x, p.z, 800, 2400);
        if (!d) return this.nextFare();
        const r = this.router.route(p.x, p.z, d.x, d.z);
        j.step = 'drop'; j.dest = d; j.len = r ? routeLength(r) : Math.hypot(d.x - p.x, d.z - p.z) * 1.4; j.t0 = 0;
        this.sound.door(); this.ui.flash('Passenger in. Let’s go!');
        this.setTarget(d, `Take the passenger to ${d.name || 'the address'}`);
      } else if (j.step === 'drop') {
        j.t0 += dt;
        if (near(j.dest, 8) && stopped) {
          const fare = Math.round(4 + j.len / 1000 * 3.2 + Math.max(0, j.len / 11 - j.t0) * 0.08);
          j.fares++; j.earned += fare; this.wallet.add(fare, 'Taxi fare'); this.sound.door();
          if (j.fares >= 5) { this.wallet.add(20, 'Shift bonus'); j.earned += 20; return this.stop(`Taxi shift done! 5 fares · €${j.earned}`); }
          this.nextFare();
        }
      }
    } else if (j.id === 'food') {
      if (j.step === 'shop' && near(j.shop, 10) && stopped) { j.step = 'deliver'; j.left = j.limit; this.sound.ding(); this.ui.flash('Hot souvlaki in the car. Go!'); this.setTarget(j.dest, `Deliver to ${j.dest.name || 'the address'}`); }
      else if (j.step === 'deliver') {
        j.left -= dt;
        if (near(j.dest, 9) && stopped) {
          const tip = j.left > 0 ? Math.round(2 + 8 * j.left / j.limit) : 0;
          const pay = 5 + tip; j.done++; j.earned += pay;
          this.wallet.add(pay, tip ? `Delivery + €${tip} tip` : 'Delivery (cold, no tip)');
          if (j.done >= 4) return this.stop(`Deliveries done! €${j.earned}`);
          this.nextDelivery();
        }
      }
    } else if (j.id === 'race') {
      if (j.count > 0) {
        const before = Math.ceil(j.count); j.count -= dt; const after = Math.ceil(j.count);
        if (this.driving.car) { this.driving.car.vx = this.driving.car.vz = this.driving.car.vF = 0; }
        if (after !== before) { this.sound.beep(after <= 0); this.ui.flash(after > 0 ? String(after) : 'GO!'); }
        if (j.count <= 0) this.setTarget(j.cps[0], 'Checkpoint 1');
      } else {
        j.t += dt;
        const c = j.cps[j.k];
        if (this.inCar() && near(c, 14)) {
          this.scene.remove(this.checkBeams[j.k]); j.k++;
          if (j.k >= j.cps.length) {
            const t = j.t, beat = t <= j.par, prize = beat ? 60 + Math.round(j.par - t) : 15;
            const rec = !this.best || t < this.best; if (rec) { this.best = t; this.store.set('raceBest', t); }
            this.wallet.add(prize, beat ? 'Race won' : 'Race finished');
            return this.stop(`Finished in ${t.toFixed(1)} s${rec ? ' · new record!' : ''} · €${prize}`);
          }
          this.sound.ding();
          this.setTarget(j.cps[j.k], `Checkpoint ${j.k + 1} of ${j.cps.length}`);
        }
      }
    }
    this.updateRoute(dt);
  }

  // keep the GPS route fresh (only while driving or on a job)
  updateRoute(dt) {
    this.routeT -= dt;
    const tg = this.target; if (!tg) { this.route = null; return; }
    const p = this.pos();
    const off = this.route ? distToRoute(this.route, p.x, p.z) : 1e9;
    if (this.routeT <= 0 && (off > 25 || !this.route || this.routeT < -6)) {
      this.routeT = 2;
      this.route = this.router.route(p.x, p.z, tg.x, tg.z, this.inCar() ? 1 : 3) || [[p.x, p.z], [tg.x, tg.z]];
    }
  }

  // the line shown on the job panel
  status() {
    const j = this.job; if (!j) return null;
    const p = this.pos(), tg = this.target;
    const dist = tg ? Math.hypot(tg.x - p.x, tg.z - p.z) : 0;
    const dtxt = dist < 1000 ? `${Math.round(dist / 10) * 10} m` : `${(dist / 1000).toFixed(1)} km`;
    if (j.id === 'taxi') return { title: `🚕 Taxi · fare ${j.fares + 1} of 5`, text: tg ? `${tg.label} · ${dtxt}` : '', right: `€${j.earned}` };
    if (j.id === 'food') return { title: `🥙 Souvlaki · order ${j.done + 1} of 4`, text: tg ? `${tg.label} · ${dtxt}` : '', right: j.step === 'deliver' ? `⏱ ${Math.max(0, Math.ceil(j.left))} s` : '' };
    if (j.id === 'race') return { title: `🏁 Seafront race · par ${j.par} s${this.best ? ` · best ${this.best.toFixed(1)} s` : ''}`, text: j.count > 0 ? 'Get ready…' : `${tg ? tg.label : ''} · ${dtxt}`, right: `⏱ ${j.t.toFixed(1)} s` };
    return null;
  }
}
