// Side challenges in the spirit of Cyberpunk 2077's gigs and NCPD hustles: street races,
// sky races, gang hideouts, cyberpsychos, deliveries, drone nests, missing people to find,
// bounties on wanted bad guys and crimes in progress. Each pays cash and Street Cred;
// Street Cred levels unlock cars and guns in the pause-menu shop.
import * as THREE from 'three';
import { roadC, LANE } from './city.js';
import { makePickup, Humanoid, pedKindFor } from './models.js';
import { COMBAT, Friend, FACTIONS, makeDog } from './ai.js';
import { thumbnail } from './thumbs.js';
import { CITY } from './textures.js';

const { CELL, ROAD, HALF } = CITY;
export const CRED_LEVELS = [0, 150, 400, 750, 1200, 1800, 2600, 3600, 4800, 6200];
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
  find: { label: 'FIND SOMEONE', color: '#b98cff', icon: '🔍' },
  bounty: { label: 'BOUNTY', color: '#e8ecff', icon: '🎯' },
  crime: { label: 'CRIME IN PROGRESS', color: '#4aa0ff', icon: '🚨' },
  brawl: { label: 'FIST FIGHT', color: '#ff8a5a', icon: '👊' },
  shooting: { label: 'SHOOTING GALLERY', color: '#9fff3a', icon: '🎯' },
};
// positions are road crossings (i, j) on the 0..10 road grid
export const CHALLENGES = [
  { id: 'race1', type: 'race', name: 'MIDTOWN SPRINT', path: [[6, 4], [6, 2], [8, 2], [8, 6], [6, 6], [6, 4]], cash: 600, cred: 150 },
  { id: 'race2', type: 'race', name: 'HARBOR RUN', path: [[1, 7], [1, 9], [4, 9], [4, 6], [2, 6], [2, 7]], cash: 700, cred: 170 },
  { id: 'race3', type: 'race', name: 'CROSSTOWN DASH', path: [[9, 8], [9, 3], [7, 3], [7, 8], [9, 8]], cash: 800, cred: 200, prize: 'super' },
  { id: 'race4', type: 'race', vehicle: 'bike', name: 'NEON BIKE DASH', path: [[1, 10], [1, 8], [5, 8], [5, 10], [1, 10]], cash: 750, cred: 190, prize: 'chopper' },
  { id: 'sky1', type: 'sky', name: 'SPIRE HOPPER', path: [[3, 7], [3, 3], [7, 3], [7, 7], [3, 7]], alt: 120, cash: 900, cred: 220 },
  { id: 'sky2', type: 'sky', name: 'SKYLANE LOOP', path: [[1, 1], [1, 5], [5, 5], [5, 9], [9, 9], [9, 1], [1, 1]], alt: 160, cash: 1200, cred: 280 },
  { id: 'sky3', type: 'sky', name: 'TOWER TOP GRAND PRIX', path: [[2, 2], [2, 8], [8, 8], [8, 2], [2, 2]], alt: 210, cash: 1500, cred: 320, prize: 'flypolice' },
  { id: 'gang1', type: 'gang', name: 'CHROME SKULLS HIDEOUT', at: [2, 8], n: 6, faction: 'skulls', cash: 700, cred: 200 },
  { id: 'gang2', type: 'gang', name: 'NEON VIPERS DEN', at: [8, 1], n: 7, faction: 'vipers', cash: 800, cred: 230 },
  { id: 'gang3', type: 'gang', name: 'DATA RATS NEST', at: [5, 9], n: 5, faction: 'rats', cash: 600, cred: 180 },
  { id: 'psycho1', type: 'psycho', name: 'CYBERPSYCHO: IRON MAW', at: [8, 8], cash: 1500, cred: 400 },
  { id: 'psycho2', type: 'psycho', name: 'CYBERPSYCHO: GHOST-9', at: [1, 3], cash: 1800, cred: 450 },
  { id: 'deliv1', type: 'delivery', name: 'HOT NOODLES', at: [4, 2], to: [9, 6], time: 70, cash: 500, cred: 120 },
  { id: 'deliv2', type: 'delivery', name: 'THE SECRET CHIP', at: [2, 4], to: [7, 9], time: 80, cash: 650, cred: 160 },
  { id: 'drones1', type: 'drones', name: 'ROGUE DRONE NEST', at: [6, 8], n: 8, cash: 700, cred: 200 },
  // ---- find someone ----
  { id: 'find1', type: 'find', who: 'missing', name: 'MISSING: DR. MAYA ORTIZ', person: 'Dr. Maya Ortiz', look: 7, at: [4, 4], area: [1, 2], r: 50, to: [5, 6], toName: 'Liberty Med Center', guards: 3, faction: 'rats', cash: 900, cred: 240,
    intro: 'The Data Rats grabbed Dr. Maya Ortiz. Find her in the purple circle and take her to Liberty Med Center.' },
  { id: 'find2', type: 'find', who: 'dog', name: 'LOST ROBOT DOG: BOLT', person: 'Bolt', at: [4, 8], area: [4, 9], r: 45, to: [4, 8], toName: 'Lily', cash: 600, cred: 160,
    intro: 'Lily lost her robot dog Bolt. Find him in the purple circle and bring him home to her.' },
  { id: 'find3', type: 'find', who: 'informant', name: 'CATCH THE INFORMANT: GLITCH', person: 'Glitch', look: 11, at: [0, 5], area: [2, 5], r: 42, cash: 800, cred: 220,
    intro: 'Glitch knows where the gangs hide. He is near the night market and runs when he sees you. Catch him, but don\'t shoot him!' },
  // ---- bounties: take down a wanted bad guy (knock them out quietly for a bonus) ----
  { id: 'bounty1', type: 'bounty', name: 'WANTED: RAZOR ROOK', at: [3, 5], bosses: ['Razor Rook'], guards: 4, faction: 'skulls', car: true, cash: 1200, cred: 320 },
  { id: 'bounty2', type: 'bounty', name: 'WANTED: NOVA & VEX', at: [7, 3], bosses: ['Nova', 'Vex'], guards: 3, faction: 'vipers', cash: 1400, cred: 360 },
  { id: 'bounty3', type: 'bounty', name: 'WANTED: MAMA KILOWATT', at: [8, 5], bosses: ['Mama Kilowatt'], guards: 5, faction: 'volts', car: true, cash: 1600, cred: 420 },
  // ---- crimes in progress: stop the bad guys, keep the victim safe ----
  { id: 'crime1', type: 'crime', name: 'ROBBERY IN PROGRESS', at: [5, 1], thugs: 3, faction: 'skulls', victim: 'Delivery driver', cash: 500, cred: 140 },
  { id: 'crime2', type: 'crime', name: 'CARJACKING ON 2ND AVE', at: [2, 6], thugs: 2, faction: 'rats', victim: 'Driver', car: true, cash: 450, cred: 130 },
  { id: 'crime3', type: 'crime', name: 'HOLD-UP AT ARCADE 9', at: [7, 7], thugs: 4, faction: 'vipers', victim: 'Shop owner', cash: 600, cred: 170 },
  // ---- fist fights: no guns, beat three fighters one after the other ----
  { id: 'brawl1', type: 'brawl', name: 'FIGHT NIGHT AT THE DOCKS', at: [10, 6], foes: [['Iron Ike', 70], ['Big Mo', 100], ['Champion Rex', 140]], cash: 900, cred: 250 },
  { id: 'brawl2', type: 'brawl', name: 'ROOFTOP RUMBLE', at: [6, 10], foes: [['Spike', 80], ['Tank Tanaka', 130]], cash: 700, cred: 200 },
  // ---- shooting galleries: hit as many hologram targets as you can ----
  { id: 'shoot1', type: 'shooting', name: 'NEON RANGE', at: [2, 0], time: 40, need: 15, cash: 600, cred: 160 },
  { id: 'shoot2', type: 'shooting', name: 'SKY TARGETS', at: [10, 2], time: 40, need: 18, cash: 800, cred: 200 },
];
const STARTS_WITH_E = new Set(['race', 'sky', 'delivery', 'find', 'brawl', 'shooting']);
const AUTO_RANGE = { gang: 95, psycho: 60, drones: 80, bounty: 95, crime: 90 };

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
export const startOf = def => {
  const [i, j] = def.path ? def.path[0] : def.at;
  return new THREE.Vector3(R(i), 0, R(j));
};
const crossing = ([i, j]) => new THREE.Vector3(R(i), 0, R(j));

const ringGeo = new THREE.TorusGeometry(6, 0.35, 6, 32);
const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 300, 12, 1, true).translate(0, 150, 0);
const markGeo = new THREE.OctahedronGeometry(1.1, 0);

export class Challenges {
  constructor(game) {
    this.g = game;
    this.done = new Set();
    this.active = null;
    this.tracked = null;
    this.leftovers = [];
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
    // the purple search circle for "find someone"
    const wall = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0);
    this.area = new THREE.Group();
    this.area.add(new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ color: 0xb98cff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
    const edge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.004, 4, 96), new THREE.MeshBasicMaterial({ color: 0xb98cff, toneMapped: false }));
    edge.rotation.x = Math.PI / 2; edge.position.y = 0.15; this.area.add(edge);
    this.area.visible = false; game.scene.add(this.area);
    // the fight ring and the hologram targets
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.12, 4, 48), new THREE.MeshBasicMaterial({ color: 0xff8a5a, toneMapped: false }));
    this.ring.rotation.x = Math.PI / 2; this.ring.visible = false; game.scene.add(this.ring);
    this.targetGeo = new THREE.RingGeometry(0.25, 0.9, 24);
    this.targetMat = new THREE.MeshBasicMaterial({ color: 0x9fff3a, side: THREE.DoubleSide, toneMapped: false, transparent: true, opacity: 0.9 });
  }

  reset(save) {
    this.cancel(true);
    for (const l of this.leftovers) l.obj.dispose();
    this.leftovers.length = 0;
    this.done = new Set((save && save.done) || []);
    this.tracked = null;
  }
  def(id) { return CHALLENGES.find(c => c.id === id); }
  available(def) { return !this.done.has(def.id); }
  // is an unfinished challenge starting within r metres? (street gangs keep away from them)
  nearStart(x, z, r) { return CHALLENGES.some(d => this.available(d) && startOf(d).distanceTo(new THREE.Vector3(x, 0, z)) < r); }

  // challenges for the pause menu list
  list() {
    const p = this.g.wpos();
    return CHALLENGES.map(def => ({ def, type: TYPES[def.type], done: this.done.has(def.id), active: this.active && this.active.def === def,
      tracked: this.tracked === def.id, dist: Math.round(startOf(def).distanceTo(new THREE.Vector3(p.x, 0, p.z))) }));
  }
  track(id) {
    this.tracked = this.tracked === id ? null : id;
    // tracking a challenge also sets the GPS line to its marker
    const def = this.def(id);
    if (this.tracked) this.g.gps.set(startOf(def), `${TYPES[def.type].label}: ${def.name}`);
    else if (this.g.gps.dest) this.g.gps.clear();
  }

  // the start marker the player is standing at (races, deliveries and searches start with E)
  _startHere() {
    const g = this.g, p = g.wpos(), v = g.player.vehicle;
    if (this.active || !g.player.alive || g.interior) return null;
    for (const def of CHALLENGES) {
      if (!this.available(def) || !STARTS_WITH_E.has(def.type)) continue;
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

  // a photo of the person (or dog) you're looking for
  photo(def) {
    const g = this.g;
    if (!g.renderer) return null;
    try {
      return thumbnail({ renderer: g.renderer, scene: g.scene }, 'who-' + def.id, () => {
        if (def.who === 'dog') return makeDog();
        const h = new Humanoid(pedKindFor(def.look || 3)); h.animate(0, 0, {}); return h.root;
      }, def.who === 'dog' ? [-0.8, 0.35, -1] : [-0.35, 0.18, -1]);
    } catch { return null; }
  }

  start(def) {
    const g = this.g, p = g.player;
    const a = { def, t: 0, step: 0 };
    if (def.type === 'race' || def.type === 'sky') {
      const flying = def.type === 'sky';
      // no car (or the wrong kind)? one gets delivered and you hop in
      if (!p.vehicle || p.vehicle.flying !== flying || (def.vehicle && p.vehicle.type !== def.vehicle && p.vehicle.type !== 'chopper')) {
        if (p.vehicle) g.exitVehicle(true);
        const v = g.deliverCar(def.vehicle || (flying ? 'hover' : 'muscle'), true);
        v.raceCar = true;
        g.enterVehicle(v);
      }
      if (flying) p.vehicle.pos.y = Math.max(p.vehicle.pos.y, 3);
      a.cps = checkpoints(def);
      // face the first checkpoint
      const s0 = startOf(def), c0 = a.cps[0];
      p.vehicle.yaw = Math.atan2(-(c0.x - s0.x), -(c0.z - s0.z)); p.vehicle.speed = 0;
      a.limit = Math.round(a.cps.length * (flying ? 7.5 : 6.5) + 12);
      a.countdown = 3.2;
      this._rivals(def, a);
      g.hud.toast(`${def.name} · ${a.cps.length} CHECKPOINTS · BEAT 3 RIVALS!`);
    } else if (def.type === 'delivery') {
      const [i, j] = def.to;
      a.dest = new THREE.Vector3(R(i), 0, R(j)); a.left = def.time;
      g.hud.toast(`${def.name} · DELIVER IT IN ${def.time} SECONDS!`);
    } else if (def.type === 'gang') {
      // two groups: one chatting at the crossing, one standing guard further down the street
      const s = startOf(def), F = def.faction || 'skulls';
      const a1 = g.ai.squad(s.x + 6, s.z + 6, Math.ceil(def.n / 2), { faction: F, activity: 'chat', target: true, spread: 3 });
      const a2 = g.ai.squad(s.x - 14, s.z + 2, def.n - a1.length, { faction: F, activity: 'guard', target: true, spread: 4, join: a1[0] && a1[0].squad });
      a.enemies = [...a1, ...a2];
      g.hud.toast(`${def.name} · THEY HAVEN'T SEEN YOU YET`);
      g.hud.say('FIXER', 'Gang hideout ahead. Sneak up for quiet takedowns, or go in loud.', '#ffd23a');
    } else if (def.type === 'psycho') {
      const s = startOf(def);
      a.enemies = g.ai.squad(s.x, s.z, 1, { kinds: ['psycho'], faction: 'psycho', alert: COMBAT, target: true, spread: 0 });
      a.boss = a.enemies[0];
      g.hud.toast(`${def.name} · TAKE THEM DOWN`);
    } else if (def.type === 'drones') {
      const s = startOf(def);
      a.enemies = [];
      for (let k = 0; k < def.n; k++) {
        const d = g.spawnChallengeDrone(s.x + Math.cos(k) * 20, 18 + (k % 3) * 6, s.z + Math.sin(k) * 20);
        d.home = { x: s.x, z: s.z }; a.enemies.push(d);
      }
      g.hud.toast(`${def.name} · DESTROY ${def.n} DRONES`);
    } else if (def.type === 'find') this._startFind(def, a);
    else if (def.type === 'bounty') this._startBounty(def, a);
    else if (def.type === 'crime') this._startCrime(def, a);
    else if (def.type === 'brawl') {
      if (p.vehicle) g.exitVehicle(true);
      a.spot = startOf(def); a.round = 0;
      p.fists = true; p.h.holdGun(null); p.punchT = 0;
      this.ring.visible = true; this.ring.position.set(a.spot.x, 0.12, a.spot.z);
      g.hud.say('REFEREE', 'No guns in the ring! Left click to punch. Beat them all!', '#ff8a5a', 5);
      this._nextFoe(a);
    } else if (def.type === 'shooting') {
      if (p.vehicle) g.exitVehicle(true);
      a.spot = startOf(def); a.left = def.time; a.score = 0; a.targets = []; a.spawnT = 0;
      g.hud.say('RANGE MASTER', `Shoot the hologram targets! ${def.need} hits to win, every extra hit pays more.`, '#9fff3a', 5);
    }
    this.active = a;
    this.tracked = def.id;
    g.audio.play('objective');
  }

  // three rivals line up next to you; they fly or drive from checkpoint to checkpoint
  _rivals(def, a) {
    const g = this.g, v = g.player.vehicle, sky = def.type === 'sky';
    const types = sky ? ['hover', 'taxi', 'hover'] : def.vehicle === 'bike' ? ['bike', 'chopper', 'bike'] : ['super', 'muscle', 'sedan'];
    const f = v.fwd, rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
    a.rivals = types.map((t, k) => {
      const side = [-4.5, 4.5, -9][k], back = k === 2 ? 3 : 0;
      const r = g._addVehicle(t, v.pos.x + rx * side - f.x * back, v.pos.z + rz * side - f.z * back, v.yaw, 'racer');
      r.pos.y = v.pos.y; r.keep = true; r.hasDriver = true;
      r.race = { step: 0, skill: [0.8, 0.86, 0.92][k] * (sky ? 0.72 : 1), done: false };
      if (r.def.bike) { // a rider on the rival bikes
        const h = new Humanoid(pedKindFor(k * 3 + 1)), seat = r.mesh.userData.seat || new THREE.Vector3(0, 0.9, 0.3);
        r.body.add(h.root); h.root.position.set(seat.x, seat.y - 0.93, seat.z); h.animate(0, 0, { ride: t === 'bike' ? 'sport' : 'chopper' });
      }
      return r;
    });
  }
  _updateRivals(dt, a) {
    const g = this.g, sky = a.def.type === 'sky', p = g.player, pv = p.vehicle;
    const prog = (step, pos) => { const c = a.cps[Math.min(step, a.cps.length - 1)]; return step * 1000 - (step >= a.cps.length ? 0 : (sky ? pos.distanceTo(c) : Math.hypot(pos.x - c.x, pos.z - c.z))); };
    const mine = prog(a.step, pv ? pv.pos : p.pos);
    let place = 1;
    for (const r of a.rivals) {
      const R = r.race;
      if (r.mode === 'wreck') continue;
      if (!R.done) {
        const c = a.cps[R.step], dx = c.x - r.pos.x, dz = c.z - r.pos.z, dy = (sky ? c.y : r.pos.y) - r.pos.y;
        const d = Math.hypot(dx, dz), want = Math.atan2(-dx, -dz);
        let diff = want - r.yaw; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
        r.yaw += Math.max(-1, Math.min(1, diff)) * Math.min(1, dt * (sky ? 2 : 3));
        // fast on the straights, slower in the corners, and they wait a bit for you (or speed up)
        const mineGap = prog(R.step, r.pos) - mine;
        let top = r.def.maxSpeed * R.skill * (mineGap > 600 ? 0.82 : mineGap < -600 ? 1.08 : 1);
        if (!sky && Math.abs(diff) > 0.45) top = Math.min(top, 16);
        r.speed += Math.max(-30 * dt, Math.min(r.def.accel * dt, top - r.speed));
        r.pos.addScaledVector(r.fwd, r.speed * dt);
        if (sky) { r.pos.y += Math.max(-30 * dt, Math.min(30 * dt, dy)); r.bob += dt * 2; r.roll = -Math.max(-0.4, Math.min(0.4, diff)) * 0.6; }
        else { g._groundY(r, dt, false); g._vehCollide(r, dt, false); r.roll = -Math.max(-0.4, Math.min(0.4, diff)) * (r.def.bike ? 0.8 : 0.1); }
        if ((sky ? r.pos.distanceTo(c) : d) < 12) { R.step++; if (R.step >= a.cps.length) { R.done = true; R.place = 1 + a.rivals.filter(o => o.race.done && o !== r).length; } }
      } else { r.speed *= Math.exp(-dt * 1.5); r.pos.addScaledVector(r.fwd, r.speed * dt); if (!sky) g._groundY(r, dt, false); }
      if (R.done || prog(R.step, r.pos) > mine) place++;
    }
    a.place = place;
  }

  // a free sidewalk spot near the crossing at c (corners first)
  _corner(c, k = 0) {
    const g = this.g, e = ROAD / 2 + 2.6;
    const opts = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (let q = 0; q < 4; q++) {
      const [sx, sz] = opts[(q + k) % 4], x = c.x + sx * e, z = c.z + sz * e;
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
      if (!g.city.collide(x, z, 1.2, 0.3, 1.8).hit) return { x, z, sx, sz };
    }
    return { x: c.x + e, z: c.z + e, sx: 1, sz: 1 };
  }
  // a parked car at the curb next to a crossing, pointing away from it
  _curbCar(c, sz, type) {
    const g = this.g, dx = sz, x = c.x + dx * 18, z = c.z + dx * LANE;
    const v = g._addVehicle(type, x, z, Math.atan2(-dx, 0), 'parked');
    v.hasDriver = false; v.h = dx > 0 ? 0 : 2; v.ti = Math.round((c.x + HALF) / CELL) + dx; v.tj = Math.round((c.z + HALF) / CELL);
    v.keep = true;
    return v;
  }
  _addFriend(kind, opts) {
    const f = new Friend(this.g, kind, opts);
    this.g.ai.friends.push(f);
    return f;
  }

  _startFind(def, a) {
    const g = this.g, c = crossing(def.area);
    a.areaC = c; a.r = def.r;
    // somewhere on a sidewalk around the area (away from the middle of the road)
    let spot = null;
    for (let k = 0; k < 40 && !spot; k++) {
      const bi = Math.floor((c.x + HALF) / CELL) - (Math.random() < 0.5 ? 1 : 0), bj = Math.floor((c.z + HALF) / CELL) - (Math.random() < 0.5 ? 1 : 0);
      if (bi < 0 || bj < 0 || bi > 9 || bj > 9) continue;
      const q = g._loopPos(R(bi) + ROAD / 2, R(bj) + ROAD / 2, Math.random() * 240, new THREE.Vector3());
      if (q.distanceTo(c) > def.r * 0.9 || g.city.collide(q.x, q.z, 0.6, 0.3, 1.8).hit) continue;
      spot = q;
    }
    if (!spot) spot = new THREE.Vector3(c.x + 13, 0, c.z + 13);
    const f = this._addFriend(def.who, { name: def.person, seed: def.look, area: { x: c.x, z: c.z, r: def.r } });
    f.place(spot.x, spot.z); f.yaw = Math.random() * 6;
    f.onDeath = () => this.fail(def.who === 'informant' ? 'WE NEEDED GLITCH IN ONE PIECE!' : def.who === 'dog' ? 'BOLT GOT BROKEN' : `${def.person.toUpperCase()} GOT HURT`);
    a.friend = f;
    a.photo = this.photo(def);
    if (def.who === 'missing') {
      // the kidnappers hang around her
      a.enemies = g.ai.squad(spot.x, spot.z, def.guards, { faction: def.faction, activity: 'chat', target: true, spread: 4 });
      f.onTalk = () => { f.state = 'follow'; a.found = true; g.audio.play('pickup'); g.hud.say(def.person.toUpperCase(), 'You came for me! Please get me to Liberty Med Center.', '#3aff9a'); };
    } else if (def.who === 'dog') {
      f.onTalk = () => { f.state = 'follow'; a.found = true; g.audio.play('woof'); g.hud.say('BOLT', 'Woof! Woof!', '#29f3ff'); };
      // Lily waits at home
      const lily = this._addFriend('npc', { name: 'Lily', seed: 2 });
      const home = crossing(def.to), cn = this._corner(home);
      lily.place(cn.x, cn.z); lily.yaw = Math.atan2(-(home.x - cn.x), -(home.z - cn.z));
      a.lily = lily;
    } else if (def.who === 'informant') {
      f.onTalk = () => {
        f.state = 'done'; g.audio.play('pickup');
        g.hud.say('GLITCH', 'OK, OK! You got me! The gangs meet under the highways. Here, take this.', '#b98cff');
        this.complete();
      };
    }
    g.hud.toast(def.name);
    g.hud.say('FIXER', def.intro, '#ffd23a', 6);
  }

  _startBounty(def, a) {
    const g = this.g, c = startOf(def), cn = this._corner(c);
    const names = def.bosses;
    const members = g.ai.squad(cn.x, cn.z, names.length + def.guards, {
      faction: def.faction, activity: 'chat', target: true, spread: 3.5,
      kinds: [...names.map(() => 'boss')], names: [...names],
    });
    a.enemies = members; a.bosses = members.filter(e => e.kind === 'boss');
    for (const b of a.bosses) b.maxHealth = b.health = 260;
    a.boss = a.bosses[0];
    if (def.car && a.boss) {
      const car = this._curbCar(c, cn.sz, 'muscle');
      a.car = car;
      const boss = a.boss;
      // when the boss notices you, he runs for his car and drives off
      boss.onAlert = e => {
        if (!a.car || g.player.vehicle === a.car || a.car.mode === 'wreck') return;
        e.fleeTo = a.car.pos;
        g.hud.say(e.name.toUpperCase(), 'You will never take me alive!', '#e8ecff');
      };
      boss.onReachCar = e => {
        const v = a.car;
        e.fleeTo = null;
        if (!v || v.mode === 'wreck' || g.player.vehicle === v) return;
        e.ride = v; e.root.visible = false;
        v.mode = 'escape'; v.hasDriver = true; v.speed = 4; g._resnap(v);
        g.hud.toast(`${e.name.toUpperCase()} IS GETTING AWAY! STOP THAT CAR!`);
        g.audio.play('alarm');
        v.escape = {
          stuck: 0,
          update: (vv, dt) => { if (Math.abs(vv.speed) < 1.5) this._bail(a, (vv.escape.stuck += dt) > 3); else vv.escape.stuck = 0; },
          onHit: vv => { if (vv.health < vv.maxHealth * 0.45) this._bail(a, true); },
          onStolen: () => this._bail(a, true),
        };
      };
    }
    g.hud.toast(`${def.name} · ${a.bosses.length > 1 ? 'THEY ARE' : 'HE IS'} AROUND HERE`);
    g.hud.say('NYPD BOUNTY', `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} wanted. Sneak up for a quiet takedown (+$300 bonus) or fight!`, '#e8ecff', 6);
  }
  // the bounty jumps out of the getaway car and fights
  _bail(a, now) {
    if (!now || !a.car) return;
    const g = this.g, v = a.car, e = a.boss;
    if (e && e.ride === v) {
      e.ride = null; e.root.visible = true;
      const rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
      const c = g.city.collide(v.pos.x - rx * 2.4, v.pos.z - rz * 2.4, 0.5, 0.3, 1.8);
      e.pos.set(c.x, g.city.groundAt(c.x, c.z, v.pos.y + 1), c.z);
      g.ai.combat(e, g.wpos());
      g.hud.say(e.name.toUpperCase(), 'Fine! I will fight you myself!', '#e8ecff');
    }
    if (e) e.fleeTo = null;
    v.escape = null; v.keep = false;
    if (v.mode === 'escape') { v.mode = 'abandoned'; v.hasDriver = false; }
    a.car = null;
  }

  _startCrime(def, a) {
    const g = this.g, c = startOf(def), cn = this._corner(c);
    const victim = this._addFriend('hostage', { name: def.victim, seed: 5 + def.thugs });
    victim.place(cn.x, cn.z);
    a.friend = victim; a.victim = victim;
    victim.onDeath = () => this.fail(`THE ${def.victim.toUpperCase()} GOT HURT`);
    if (def.car) this._curbCar(c, cn.sz, 'sedan');
    // the robbers stand around the victim, busy with them
    a.enemies = g.ai.squad(cn.x, cn.z, def.thugs, { faction: def.faction, activity: 'chat', target: true, spread: 3 });
    for (const e of a.enemies) { e.postYaw = Math.atan2(-(cn.x - e.pos.x), -(cn.z - e.pos.z)); e.yaw = e.postYaw; }
    victim.yaw = a.enemies.length ? Math.atan2(-(a.enemies[0].pos.x - cn.x), -(a.enemies[0].pos.z - cn.z)) : 0;
    g.hud.toast(`${def.name} · STOP THEM!`);
    g.hud.say('NYPD DISPATCH', `${def.victim} in trouble. Stop the ${FACTIONS[def.faction].name}, and be careful not to hit the victim!`, '#4aa0ff', 6);
  }

  // ---------- fist fights ----------
  _nextFoe(a) {
    const g = this.g, [name, hp] = a.def.foes[a.round];
    if (a.foe) a.foe.dispose();
    const e = g.newPerson('ped'); e.health = e.maxHealth = hp; e.name = name;
    const ang = Math.random() * Math.PI * 2; e.pos.set(a.spot.x + Math.cos(ang) * 4, 0, a.spot.z + Math.sin(ang) * 4);
    e.punchT = 1.2; e.cool = 1.5; e.side = false;
    a.foe = e; a.boss = e;
    g.hud.toast(`ROUND ${a.round + 1}: ${name.toUpperCase()}`); g.audio.play('alarm');
  }
  // the player's punch lands (called halfway through the swing)
  punch() {
    const a = this.active, g = this.g, p = g.player;
    if (!a || !a.foe || a.foe.state === 'dead') return;
    const e = a.foe, dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    if (d > 2.3 || (dx * fx + dz * fz) / Math.max(d, 1e-3) < 0.35) { g.audio.play('empty'); return; }
    e.health -= (12 + Math.random() * 6) * (1 + 0.4 * g.prog.rank('brawler')); e.hurtT = 0.25;
    e.pos.x += dx / d * 0.6; e.pos.z += dz / d * 0.6;
    g.audio.play('punch'); g.hud.hitmark(); g.hud.kick(3);
    if (e.health <= 0) {
      e.state = 'dead'; e.t = 6; e.fallT = 0; e.vel.set(dx / d * 2, 2, dz / d * 2);
      g.audio.play('yell');
      a.round++;
      if (a.round >= a.def.foes.length) { g.hud.say('REFEREE', 'And the winner is… YOU!', '#ff8a5a'); this.complete(); }
      else { a.waitT = 2.5; g.hud.toast(`${e.name.toUpperCase()} IS DOWN!`); }
    }
  }
  _updateBrawl(dt, a) {
    const g = this.g, p = g.player, e = a.foe;
    if (Math.hypot(p.pos.x - a.spot.x, p.pos.z - a.spot.z) > 22) { this.fail('YOU LEFT THE RING'); return; }
    if (a.waitT > 0) { a.waitT -= dt; if (e) g._personPhysics(e, dt); if (a.waitT <= 0) this._nextFoe(a); return; }
    if (!e || e.state === 'dead') return;
    const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1;
    e.yaw = Math.atan2(-dx, -dz);
    let sp = 0;
    if (d > 1.5) { sp = 3.4; e.pos.x += dx / d * sp * dt; e.pos.z += dz / d * sp * dt; }
    else if (d < 1.0) { e.pos.x -= dx / d * 1.5 * dt; e.pos.z -= dz / d * 1.5 * dt; }
    const c = g.city.collide(e.pos.x, e.pos.z, 0.45, 0.3, 1.8); e.pos.x = c.x; e.pos.z = c.z;
    // wind up, swing, hit if you're still in front
    e.cool -= dt;
    if (e.cool <= 0 && d < 2.0 && e.punchT <= 0) { e.punchT = 0.45; e.side = !e.side; }
    if (e.punchT > 0) {
      const before = e.punchT; e.punchT -= dt;
      if (before > 0.18 && e.punchT <= 0.18 && d < 2.0) {
        g.audio.play('punch'); g.hud.kick(6);
        if (p.health - 7 < 12) { p.health = 50; g.hud.say('REFEREE', "You're down! Better luck next time.", '#ff8a5a'); this.fail('KNOCKED DOWN'); return; }
        g.damagePlayer(7);
      }
      if (e.punchT <= 0) e.cool = 0.9 + Math.random() * 0.6;
    }
    const ext = e.punchT > 0 ? Math.sin(Math.min(1, 1 - e.punchT / 0.45) * Math.PI) : 0;
    e.h.animate(dt, sp, { fists: true, punchR: e.side ? ext : 0, punchL: e.side ? 0 : ext });
    e.root.position.copy(e.pos); e.root.rotation.set(e.hurtT > 0 ? -0.2 : 0, e.yaw, 0);
    e.hurtT = (e.hurtT || 0) - dt;
  }
  // ---------- shooting gallery ----------
  boltHit(a0, b0) {
    const a = this.active; if (!a || !a.targets) return null;
    for (const t of a.targets) {
      const c = t.mesh.position, d = new THREE.Vector3().subVectors(b0, a0), l = d.length(); if (l < 1e-4) continue;
      d.divideScalar(l);
      const tt = Math.max(0, Math.min(l, new THREE.Vector3().subVectors(c, a0).dot(d)));
      const q = a0.clone().addScaledVector(d, tt);
      if (q.distanceTo(c) < 1.0) {
        a.score++; t.life = -1; this.g.audio.play('pickup'); this.g.fx.sparks(c.clone(), 0x9fff3a, 14, 5);
        return q;
      }
    }
    return null;
  }
  _updateShooting(dt, a) {
    const g = this.g, p = g.player, def = a.def;
    if (Math.hypot(p.pos.x - a.spot.x, p.pos.z - a.spot.z) > 30) { this.fail('YOU LEFT THE RANGE'); return; }
    a.left -= dt; a.spawnT -= dt;
    if (a.spawnT <= 0 && a.targets.length < 3) {
      a.spawnT = 0.6;
      for (let k = 0; k < 10; k++) {
        const ang = Math.random() * Math.PI * 2, r = 10 + Math.random() * 18, x = a.spot.x + Math.cos(ang) * r, z = a.spot.z + Math.sin(ang) * r, y = 2 + Math.random() * 9;
        if (g.city.inside(x, y, z) || g.city.inside(x, 1, z)) continue;
        const m = new THREE.Mesh(this.targetGeo, this.targetMat); m.position.set(x, y, z); g.scene.add(m);
        a.targets.push({ mesh: m, life: 3.2 }); break;
      }
    }
    for (let i = a.targets.length - 1; i >= 0; i--) {
      const t = a.targets[i]; t.life -= dt;
      t.mesh.lookAt(g.camera.position); t.mesh.scale.setScalar(Math.min(1, (3.2 - t.life) * 4) * (t.life < 0.4 ? t.life / 0.4 : 1) + 0.001);
      if (t.life <= 0) { g.scene.remove(t.mesh); a.targets.splice(i, 1); }
    }
    if (a.left <= 0) {
      for (const t of a.targets) g.scene.remove(t.mesh);
      a.targets = [];
      if (a.score >= def.need) { g.hud.say('RANGE MASTER', `${a.score} hits! Great shooting!`, '#9fff3a'); this.complete(Math.min(500, (a.score - def.need) * 25)); }
      else this.fail(`ONLY ${a.score} OF ${def.need} HITS`);
    }
  }

  cancel(silent) {
    const a = this.active; if (!a) return;
    const g = this.g;
    if (a.foe) { a.foe.dispose(); a.foe = null; }
    if (a.rivals) { for (const r of a.rivals) { const i = g.vehicles.indexOf(r); if (i >= 0) g.vehicles.splice(i, 1); r.dispose(); } a.rivals = null; }
    if (a.targets) { for (const t of a.targets) g.scene.remove(t.mesh); a.targets = null; }
    if (a.def.type === 'brawl') { const p = g.player; p.fists = false; g.selectWeapon(p.wi, true); this.ring.visible = false; }
    if (a.enemies) for (const e of a.enemies) {
      if (e.mesh) { if (!e.dead) { e.dead = true; e.fallV = 0; } continue; } // drones drop out of the sky
      if (e.state !== 'dead') { const i = g.gang.indexOf(e); if (i >= 0) g.gang.splice(i, 1); e.dispose(); }
    }
    for (const f of [a.friend, a.lily]) {
      if (!f) continue;
      const i = g.ai.friends.indexOf(f);
      if (f.state === 'done' && i >= 0) { this.leftovers.push({ obj: f, t: g.time + 10 }); continue; }
      if (i >= 0) g.ai.friends.splice(i, 1);
      f.dispose();
    }
    if (a.car) { a.car.keep = false; a.car.escape = null; if (a.car.mode === 'escape') { a.car.mode = 'abandoned'; a.car.hasDriver = false; } }
    if (a.pkg) { g.scene.remove(a.pkg); }
    this.active = null;
    this.rings.forEach(r => (r.visible = false));
    this.goalBeam.visible = false; this.area.visible = false;
    if (!silent) g.hud.toast('CHALLENGE FAILED · TRY AGAIN AT THE MARKER');
  }
  fail(reason) {
    if (!this.active) return;
    this.g.audio.play('star');
    this.cancel(true);
    this.g.hud.toast(`CHALLENGE FAILED · ${reason}`);
  }
  complete(bonus = 0) {
    const g = this.g, a = this.active, def = a.def;
    const before = credLevel(g.cred);
    const pay = g.prog.cash(def.cash + bonus);
    g.cash += pay; g.cred += def.cred;
    this.done.add(def.id);
    g.prog.addXP(def.cred, 'CHALLENGE');
    if (def.prize && !g.garage.has(def.prize)) { g.garage.add(def.prize); setTimeout(() => g.hud.say('PRIZE', `You won a car! It's in your garage: SHOP → CARS → DELIVER (FREE).`, '#ffd23a', 6), 2500); }
    if (def.type === 'race' || def.type === 'sky') { g.prog.medal('race'); if (CHALLENGES.every(c => (c.type !== 'race' && c.type !== 'sky') || this.done.has(c.id))) g.prog.medal('champ'); }
    for (const f of [a.friend, a.lily]) if (f && f.alive) f.state = 'done';
    this.cancel(true);
    if (this.tracked === def.id) this.tracked = null;
    g.audio.play('objective'); g.audio.play('cash');
    const lvl = credLevel(g.cred), money = `+$${pay}${bonus ? ` (INCL. $${bonus} BONUS)` : ''}`;
    g.hud.toast(lvl > before ? `CHALLENGE COMPLETE · ${money} · STREET CRED ${lvl}! NEW SHOP ITEMS` : `CHALLENGE COMPLETE · ${money} · +${def.cred} STREET CRED`);
  }
  onKill(e) {
    const a = this.active;
    if (!a) return;
    const def = a.def;
    if (def.type === 'bounty') {
      if (a.bosses && a.bosses.includes(e) && a.bosses.every(b => b.state === 'dead')) {
        const quiet = a.bosses.every(b => b.knocked);
        if (quiet) this.g.hud.say('NYPD BOUNTY', 'Captured alive! Nice and quiet. Here is your bonus.', '#e8ecff');
        this.complete(quiet ? 300 : 0);
      }
      return;
    }
    if (!a.enemies || !a.enemies.includes(e)) return;
    if (def.type === 'find') return; // the kidnappers don't have to go down
    if (a.enemies.every(x => x.state === 'dead' || x.dead)) {
      if (def.type === 'crime' && a.victim && a.victim.alive) this.g.hud.say(def.victim.toUpperCase(), pickThanks(), '#3aff9a');
      this.complete();
    }
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
    if (a.cps) return { title: def.name, sub: a.countdown > 0 ? 'Get ready…' : `POSITION ${a.place || 1}/${(a.rivals ? a.rivals.length : 0) + 1} · checkpoint ${a.step + 1}/${a.cps.length}`, target: a.cps[a.step] };
    if (def.type === 'delivery') return { title: def.name, sub: `Deliver the package to the green marker${tl}`, target: a.dest };
    if (def.type === 'find') {
      const f = a.friend;
      if (def.who === 'informant') return f.state === 'flee' ? { title: def.name, sub: 'He is running! Sprint after him (Shift) and grab him with E', target: f.pos, photo: a.photo }
        : { title: def.name, sub: 'Search the purple circle · hold Q to scan people', target: a.areaC, photo: a.photo };
      if (a.found) return { title: def.name, sub: `Bring ${def.person} to ${def.toName}`, target: crossing(def.to), photo: a.photo };
      return { title: def.name, sub: 'Search the purple circle · hold Q to scan people', target: a.areaC, photo: a.photo };
    }
    if (def.type === 'bounty') {
      const left = a.bosses.filter(b => b.state !== 'dead');
      const b = left[0], away = b && b.ride;
      return { title: def.name, sub: away ? 'Stop the getaway car! Shoot it or ram it' : `Take down ${left.map(x => x.name).join(' and ')} · a quiet takedown pays a bonus`, target: b ? b.pos : startOf(def), boss: b && b.alert === COMBAT ? b : null };
    }
    if (def.type === 'brawl') return { title: def.name, sub: a.foe && a.foe.state !== 'dead' ? `Round ${a.round + 1}/${def.foes.length}: ${a.foe.name} · left click to punch` : 'Next fighter coming…', target: a.spot, boss: a.foe && a.foe.state !== 'dead' ? a.foe : null };
    if (def.type === 'shooting') return { title: def.name, sub: `Hits: ${a.score}/${def.need} · ${Math.max(0, Math.ceil(a.left))} s`, target: a.spot };
    if (def.type === 'crime') {
      const left = a.enemies.filter(e => e.state !== 'dead').length;
      return { title: def.name, sub: `Robbers left: ${left} · don't hit the ${def.victim.toLowerCase()}!`, target: startOf(def) };
    }
    const left = a.enemies.filter(e => !(e.state === 'dead' || e.dead)).length;
    return { title: def.name, sub: def.type === 'drones' ? `Drones left: ${left}` : def.type === 'psycho' ? 'Defeat the cyberpsycho' : `Gang members left: ${left}`, target: startOf(def), boss: a.boss };
  }

  update(dt) {
    const g = this.g, p = g.player, wp = g.wpos(), t = g.time;
    // the people you saved hang around for a bit, happy
    for (let i = this.leftovers.length - 1; i >= 0; i--) {
      const l = this.leftovers[i];
      if (t > l.t) { const k = g.ai.friends.indexOf(l.obj); if (k >= 0) g.ai.friends.splice(k, 1); l.obj.dispose(); this.leftovers.splice(i, 1); }
    }
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
        const range = AUTO_RANGE[def.type];
        if (!this.available(def) || !range) continue;
        const s = startOf(def);
        if (Math.hypot(wp.x - s.x, wp.z - s.z) < range && wp.y < 40) { this.start(def); break; }
      }
    }
    const a = this.active;
    this.rings.forEach(r => (r.visible = false));
    this.goalBeam.visible = false; this.area.visible = false;
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
        this._updateRivals(dt, a);
        if (!v || (def.type === 'sky') !== v.flying) { a.away = (a.away || 0) + dt; if (a.away > 6) { this.fail('YOU LEFT YOUR RIDE'); return; } } else a.away = 0;
        const cp = a.cps[a.step], pos = v ? v.pos : p.pos;
        const d = def.type === 'sky' ? pos.distanceTo(cp) : Math.hypot(pos.x - cp.x, pos.z - cp.z);
        if (d < (def.type === 'sky' ? 11 : 10)) {
          a.step++; g.audio.play('pickup');
          if (a.step >= a.cps.length) {
            const place = 1 + a.rivals.filter(r => r.race.done).length;
            if (place === 1) { g.hud.say('RACE', 'FIRST PLACE! You won the race!', '#ffd23a'); this.complete(); }
            else { const c = g.prog.cash(100 * (4 - place)); g.cash += c; this.fail(`YOU CAME ${place === 2 ? '2ND' : place === 3 ? '3RD' : '4TH'} (+$${c}) · WIN TO GET THE PRIZE`); }
            return;
          }
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
    } else if (def.type === 'find') {
      const f = a.friend;
      if (!a.found && f.state !== 'flee' && f.state !== 'done') {
        this.area.visible = true; this.area.position.set(a.areaC.x, 0, a.areaC.z); this.area.scale.set(a.r, 26, a.r);
      }
      if (def.who === 'informant') {
        if (f.state === 'flee' && f.pos.distanceTo(wp) > 95) { this.fail('GLITCH GOT AWAY'); return; }
      } else if (a.found) {
        const dest = crossing(def.to);
        this.goalBeam.visible = true; this.goalBeam.position.copy(dest); this.goalBeam.material.color.set('#3aff9a');
        if (f.state !== 'car' && Math.hypot(f.pos.x - dest.x, f.pos.z - dest.z) < 12 && Math.hypot(wp.x - dest.x, wp.z - dest.z) < 16) {
          g.hud.say(def.who === 'dog' ? 'LILY' : def.person.toUpperCase(), def.who === 'dog' ? 'BOLT! You found him! Thank you, thank you!' : 'We made it! Thank you so much!', '#3aff9a');
          if (def.who === 'dog') g.audio.play('woof');
          this.complete();
          return;
        }
      }
      if (Math.hypot(wp.x - a.areaC.x, wp.z - a.areaC.z) > 650) { this.fail('YOU WENT TOO FAR AWAY'); return; }
    } else if (def.type === 'brawl') { this._updateBrawl(dt, a); return;
    } else if (def.type === 'shooting') { this._updateShooting(dt, a); return;
    } else if (def.type === 'bounty') {
      const b = a.bosses.find(x => x.state !== 'dead');
      if (b && b.ride && b.pos.distanceTo(wp) > 260) { this.fail(`${b.name.toUpperCase()} GOT AWAY`); return; }
      if (b && !b.ride && Math.hypot(wp.x - b.pos.x, wp.z - b.pos.z) > 330) { this.fail('YOU LEFT THE AREA'); return; }
    } else {
      // fights: walking away for too long calls it off
      const s = startOf(def);
      if (Math.hypot(wp.x - s.x, wp.z - s.z) > 300) { this.fail('YOU LEFT THE AREA'); return; }
    }
  }
}
function pickThanks() { const l = ['Thank you! You saved me!', 'Wow, thanks! Here, take this!', 'My hero! Thank you!']; return l[Math.floor(Math.random() * l.length)]; }

export { makePickup };
