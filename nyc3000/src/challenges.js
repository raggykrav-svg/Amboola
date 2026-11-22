// Side challenges in the spirit of Cyberpunk 2077's gigs and NCPD hustles: street races,
// sky races, gang hideouts, cyberpsychos, deliveries and drone nests. Each pays cash and
// Street Cred; Street Cred levels unlock cars and guns in the pause-menu shop.
import * as THREE from 'three';
import { roadC } from './city.js';
import { makePickup } from './models.js';

export const CRED_LEVELS = [0, 150, 400, 750, 1200, 1800, 2600, 3600];
export function credLevel(xp) {
  let l = 0;
  while (l + 1 < CRED_LEVELS.length && xp >= CRED_LEVELS[l + 1]) l++;
  return l;
}

const R = i => roadC(i);
export const TYPES = {
  race: { label: 'STREET RACE', color: '#ffd23a', icon: '🏁' },
  sky: { label: 'SKY RACE', color: '#29f3ff', icon: '✈' },
  gang: { label: 'GANG HIDEOUT', color: '#ff2040', icon: '☠' },
  psycho: { label: 'CYBERPSYCHO', color: '#ff2bd6', icon: '⚠' },
  delivery: { label: 'DELIVERY', color: '#3aff9a', icon: '📦' },
  drones: { label: 'DRONE NEST', color: '#ffa43a', icon: '◎' },
};
// positions are road crossings (i, j) on the 0..10 road grid
export const CHALLENGES = [
  { id: 'race1', type: 'race', name: 'MIDTOWN SPRINT', path: [[6, 4], [6, 2], [8, 2], [8, 6], [6, 6], [6, 4]], cash: 600, cred: 150 },
  { id: 'race2', type: 'race', name: 'HARBOR RUN', path: [[1, 7], [1, 9], [4, 9], [4, 6], [2, 6], [2, 7]], cash: 700, cred: 170 },
  { id: 'race3', type: 'race', name: 'CROSSTOWN DASH', path: [[9, 8], [9, 3], [7, 3], [7, 8], [9, 8]], cash: 800, cred: 200 },
  { id: 'sky1', type: 'sky', name: 'SPIRE HOPPER', path: [[3, 7], [3, 3], [7, 3], [7, 7], [3, 7]], alt: 120, cash: 900, cred: 220 },
  { id: 'sky2', type: 'sky', name: 'SKYLANE LOOP', path: [[1, 1], [1, 5], [5, 5], [5, 9], [9, 9], [9, 1], [1, 1]], alt: 160, cash: 1200, cred: 280 },
  { id: 'gang1', type: 'gang', name: 'CHROME SKULLS HIDEOUT', at: [2, 8], n: 6, cash: 700, cred: 200 },
  { id: 'gang2', type: 'gang', name: 'NEON VIPERS DEN', at: [8, 1], n: 7, cash: 800, cred: 230 },
  { id: 'gang3', type: 'gang', name: 'DATA RATS NEST', at: [5, 9], n: 5, cash: 600, cred: 180 },
  { id: 'psycho1', type: 'psycho', name: 'CYBERPSYCHO: IRON MAW', at: [8, 8], cash: 1500, cred: 400 },
  { id: 'psycho2', type: 'psycho', name: 'CYBERPSYCHO: GHOST-9', at: [1, 3], cash: 1800, cred: 450 },
  { id: 'deliv1', type: 'delivery', name: 'HOT NOODLES', at: [4, 2], to: [9, 6], time: 70, cash: 500, cred: 120 },
  { id: 'deliv2', type: 'delivery', name: 'THE SECRET CHIP', at: [2, 4], to: [7, 9], time: 80, cash: 650, cred: 160 },
  { id: 'drones1', type: 'drones', name: 'ROGUE DRONE NEST', at: [6, 8], n: 8, cash: 700, cred: 200 },
];

// checkpoints along a route of road crossings: one at every crossing on the way
function checkpoints(def) {
  const pts = [];
  const p = def.path;
  for (let k = 0; k + 1 < p.length; k++) {
    const [i0, j0] = p[k], [i1, j1] = p[k + 1];
    const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0));
    for (let s = 1; s <= n; s++) {
      const i = i0 + Math.sign(i1 - i0) * s, j = j0 + Math.sign(j1 - j0) * s;
      const y = def.type === 'sky' ? def.alt + Math.sin(pts.length * 1.3) * 25 : 0;
      pts.push(new THREE.Vector3(R(i), y, R(j)));
    }
  }
  return pts;
}
const startOf = def => {
  const [i, j] = def.path ? def.path[0] : def.at;
  return new THREE.Vector3(R(i), def.type === 'sky' ? 0 : 0, R(j));
};

const ringGeo = new THREE.TorusGeometry(6, 0.35, 6, 32);
const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 300, 12, 1, true).translate(0, 150, 0);
const markGeo = new THREE.OctahedronGeometry(1.1, 0);

export class Challenges {
  constructor(game) {
    this.g = game;
    this.done = new Set();
    this.active = null;
    this.tracked = null;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    // a spinning hologram over every challenge start (one instanced draw call),
    // and a tall beam over the one you track
    this.marks = new THREE.InstancedMesh(markGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), CHALLENGES.length);
    CHALLENGES.forEach((def, i) => this.marks.setColorAt(i, new THREE.Color(TYPES[def.type].color)));
    this.marks.frustumCulled = false;
    this.group.add(this.marks);
    this.trackBeam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.trackBeam.visible = false;
    this.group.add(this.trackBeam);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    // race rings: the next checkpoint and the one after it
    this.rings = [0, 1].map(k => {
      const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: k ? 0x6a5a10 : 0xffd23a, toneMapped: false, transparent: true, opacity: k ? 0.5 : 1 }));
      r.visible = false; game.scene.add(r); return r;
    });
    this.goalBeam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.goalBeam.visible = false; game.scene.add(this.goalBeam);
  }

  reset(save) {
    this.cancel(true);
    this.done = new Set((save && save.done) || []);
    this.tracked = null;
  }
  def(id) { return CHALLENGES.find(c => c.id === id); }
  available(def) { return !this.done.has(def.id); }

  // challenges for the pause menu list
  list() {
    const p = this.g.wpos();
    return CHALLENGES.map(def => ({ def, type: TYPES[def.type], done: this.done.has(def.id), active: this.active && this.active.def === def,
      tracked: this.tracked === def.id, dist: Math.round(startOf(def).distanceTo(new THREE.Vector3(p.x, 0, p.z))) }));
  }
  track(id) { this.tracked = this.tracked === id ? null : id; }

  // the start marker the player is standing at (races and deliveries start with E)
  _startHere() {
    const g = this.g, p = g.wpos(), v = g.player.vehicle;
    if (this.active || !g.player.alive || g.interior) return null;
    for (const def of CHALLENGES) {
      if (!this.available(def) || def.type === 'gang' || def.type === 'psycho' || def.type === 'drones') continue;
      const s = startOf(def);
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < (v ? 12 : 7) && (!v || v.pos.y < 30)) return def;
    }
    return null;
  }
  prompt() {
    const def = this._startHere();
    if (!def) return '';
    return `<kbd>E</kbd> Start ${TYPES[def.type].label}: ${def.name} · $${def.cash}`;
  }

  start(def) {
    const g = this.g, p = g.player;
    const a = { def, t: 0, step: 0 };
    if (def.type === 'race' || def.type === 'sky') {
      const flying = def.type === 'sky';
      // no car (or the wrong kind)? one gets delivered and you hop in
      if (!p.vehicle || p.vehicle.flying !== flying) {
        if (p.vehicle) g.exitVehicle(true);
        const v = g.deliverCar(flying ? 'hover' : 'muscle', true);
        v.raceCar = true;
        g.enterVehicle(v);
      }
      if (flying) p.vehicle.pos.y = Math.max(p.vehicle.pos.y, 3);
      a.cps = checkpoints(def);
      // face the first checkpoint
      const s0 = startOf(def), c0 = a.cps[0];
      p.vehicle.yaw = Math.atan2(-(c0.x - s0.x), -(c0.z - s0.z)); p.vehicle.speed = 0;
      a.limit = Math.round(a.cps.length * (flying ? 7.5 : 6.5) + 12);
      a.left = a.limit; a.countdown = 3.2;
      g.hud.toast(`${def.name} · ${a.cps.length} CHECKPOINTS`);
    } else if (def.type === 'delivery') {
      const [i, j] = def.to;
      a.dest = new THREE.Vector3(R(i), 0, R(j)); a.left = def.time;
      g.hud.toast(`${def.name} · DELIVER IT IN ${def.time} SECONDS!`);
    } else if (def.type === 'gang' || def.type === 'psycho') {
      const s = startOf(def);
      a.enemies = g.spawnGang(s.x, s.z, def.type === 'psycho' ? 1 : def.n, def.type);
      if (def.type === 'psycho') a.boss = a.enemies[0];
      g.hud.toast(def.type === 'psycho' ? `${def.name} · TAKE THEM DOWN` : `${def.name} · CLEAR OUT THE GANG`);
    } else if (def.type === 'drones') {
      const s = startOf(def);
      a.enemies = [];
      for (let k = 0; k < def.n; k++) {
        const d = g.spawnChallengeDrone(s.x + Math.cos(k) * 20, 18 + (k % 3) * 6, s.z + Math.sin(k) * 20);
        d.home = { x: s.x, z: s.z }; a.enemies.push(d);
      }
      g.hud.toast(`${def.name} · DESTROY ${def.n} DRONES`);
    }
    this.active = a;
    this.tracked = def.id;
    g.audio.play('objective');
  }

  cancel(silent) {
    const a = this.active; if (!a) return;
    if (a.enemies) for (const e of a.enemies) {
      if (e.mesh) { if (!e.dead) { e.dead = true; e.fallV = 0; } continue; } // drones drop out of the sky
      if (e.state !== 'dead') { const i = this.g.gang.indexOf(e); if (i >= 0) this.g.gang.splice(i, 1); e.dispose(); }
    }
    if (a.pkg) { this.g.scene.remove(a.pkg); }
    this.active = null;
    this.rings.forEach(r => (r.visible = false));
    this.goalBeam.visible = false;
    if (!silent) this.g.hud.toast('CHALLENGE FAILED · TRY AGAIN AT THE MARKER');
  }
  fail(reason) {
    if (!this.active) return;
    this.g.audio.play('star');
    this.cancel(true);
    this.g.hud.toast(`CHALLENGE FAILED · ${reason}`);
  }
  complete() {
    const g = this.g, def = this.active.def;
    const before = credLevel(g.cred);
    g.cash += def.cash; g.cred += def.cred;
    this.done.add(def.id);
    this.cancel(true);
    if (this.tracked === def.id) this.tracked = null;
    g.audio.play('objective'); g.audio.play('cash');
    const lvl = credLevel(g.cred);
    g.hud.toast(lvl > before ? `CHALLENGE COMPLETE · +$${def.cash} · STREET CRED ${lvl}! NEW SHOP ITEMS` : `CHALLENGE COMPLETE · +$${def.cash} · +${def.cred} STREET CRED`);
  }
  onKill(e) {
    const a = this.active;
    if (!a || !a.enemies || !a.enemies.includes(e)) return;
    if (a.enemies.every(x => x.state === 'dead' || x.dead)) this.complete();
  }
  onPlayerDeath() { if (this.active) this.fail('YOU FLATLINED'); }

  // what the HUD shows while a challenge is on (or where the tracked one is)
  hud() {
    const a = this.active;
    if (!a) {
      const def = this.tracked && this.def(this.tracked);
      return def && !this.done.has(def.id) ? { title: `${TYPES[def.type].label}: ${def.name}`, sub: `Go to the marker · reward $${def.cash}`, target: startOf(def) } : null;
    }
    const def = a.def, tl = a.left !== undefined ? ` · ${Math.max(0, Math.ceil(a.left))} s` : '';
    if (a.cps) return { title: def.name, sub: a.countdown > 0 ? 'Get ready…' : `Checkpoint ${a.step + 1}/${a.cps.length}${tl}`, target: a.cps[a.step] };
    if (def.type === 'delivery') return { title: def.name, sub: `Deliver the package to the green marker${tl}`, target: a.dest };
    const left = a.enemies.filter(e => !(e.state === 'dead' || e.dead)).length;
    return { title: def.name, sub: def.type === 'drones' ? `Drones left: ${left}` : def.type === 'psycho' ? 'Defeat the cyberpsycho' : `Gang members left: ${left}`, target: startOf(def), boss: a.boss };
  }

  update(dt) {
    const g = this.g, p = g.player, wp = g.wpos(), t = g.time;
    // start markers
    this.trackBeam.visible = false;
    CHALLENGES.forEach((def, i) => {
      const at = startOf(def), show = this.available(def) && !(this.active && this.active.def === def);
      const near = show && Math.hypot(at.x - wp.x, at.z - wp.z) < 300;
      this._p.set(at.x, 4 + Math.sin(t * 2 + at.x) * 0.4, at.z);
      this._q.setFromAxisAngle(this._s.set(0, 1, 0), t * 1.5);
      this.marks.setMatrixAt(i, this._m.compose(this._p, this._q, this._s.setScalar(near ? 1 : 0)));
      if (show && this.tracked === def.id && !this.active) {
        this.trackBeam.visible = true; this.trackBeam.position.set(at.x, 0, at.z);
        this.trackBeam.material.color.set(TYPES[def.type].color);
      }
    });
    this.marks.instanceMatrix.needsUpdate = true;
    if (!this.active && g.input.pressed('KeyE')) { const def = this._startHere(); if (def) this.start(def); }
    // fights start when you walk (or drive) up to them
    if (!this.active && p.alive && !g.interior) {
      for (const def of CHALLENGES) {
        if (!this.available(def) || !(def.type === 'gang' || def.type === 'psycho' || def.type === 'drones')) continue;
        const s = startOf(def);
        if (Math.hypot(wp.x - s.x, wp.z - s.z) < (def.type === 'drones' ? 80 : 60) && wp.y < 40) { this.start(def); break; }
      }
    }
    const a = this.active;
    this.rings.forEach(r => (r.visible = false));
    this.goalBeam.visible = false;
    if (!a) return;
    a.t += dt;
    const def = a.def;
    if (a.cps) {
      const v = p.vehicle;
      if (a.countdown > 0) {
        const before = Math.ceil(a.countdown);
        a.countdown -= dt;
        if (v) v.speed *= Math.exp(-dt * 4);
        const now = Math.ceil(a.countdown);
        if (now !== before) { g.hud.toast(now > 0 ? String(now) : 'GO!'); g.audio.play(now > 0 ? 'switch' : 'objective'); }
      } else {
        a.left -= dt;
        if (a.left <= 0) { this.fail('OUT OF TIME'); return; }
        if (!v || (def.type === 'sky') !== v.flying) { a.away = (a.away || 0) + dt; if (a.away > 6) { this.fail('YOU LEFT YOUR RIDE'); return; } } else a.away = 0;
        const cp = a.cps[a.step], pos = v ? v.pos : p.pos;
        const d = def.type === 'sky' ? pos.distanceTo(cp) : Math.hypot(pos.x - cp.x, pos.z - cp.z);
        if (d < (def.type === 'sky' ? 11 : 10)) {
          a.step++; a.left += 2; g.audio.play('pickup');
          if (a.step >= a.cps.length) { this.complete(); return; }
        }
      }
      // rings: upright, facing along the route
      for (let k = 0; k < 2; k++) {
        const i = a.step + k; if (i >= a.cps.length) break;
        const r = this.rings[k], c = a.cps[i], prev = a.cps[i - 1] || startOf(def);
        r.visible = true;
        r.position.set(c.x, def.type === 'sky' ? c.y : 5.5, c.z);
        r.rotation.set(0, Math.atan2(c.x - prev.x, c.z - prev.z), 0);
        r.scale.setScalar(k ? 0.8 : 1 + Math.sin(t * 6) * 0.04);
      }
      const nx = a.cps[a.step];
      this.goalBeam.visible = true; this.goalBeam.position.set(nx.x, 0, nx.z);
    } else if (def.type === 'delivery') {
      a.left -= dt;
      if (a.left <= 0) { this.fail('THE PACKAGE WAS LATE'); return; }
      this.goalBeam.visible = true; this.goalBeam.position.copy(a.dest);
      this.goalBeam.material.color.set('#3aff9a');
      if (Math.hypot(wp.x - a.dest.x, wp.z - a.dest.z) < 9) { this.goalBeam.material.color.set('#ffd23a'); this.complete(); }
    } else {
      // fights: walking away for too long calls it off
      const s = startOf(def);
      if (Math.hypot(wp.x - s.x, wp.z - s.z) > 260) { this.fail('YOU LEFT THE AREA'); return; }
    }
  }
}

export { makePickup };
