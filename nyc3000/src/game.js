// Gameplay: player, weapons, NPCs, vehicles, police, objectives.
import * as THREE from 'three';
import { CITY } from './textures.js';
import { roadC, LANE, BOUNDS } from './city.js';
import { Challenges, credLevel } from './challenges.js';
import { EnemyAI, COMBAT } from './ai.js';
import { SlidingDoors } from './doors.js';
import { GPS } from './gps.js';
import { Activities } from './activities.js';
import { Progress } from './progress.js';
import { Moves } from './moves.js';
import { Story } from './story.js';
import { CityEvents } from './events.js';
import { Buddy } from './buddy.js';
import { Home } from './home.js';
import { newUpgrades, applyToCar, magSize } from './upgrades.js';
import { DAY_LENGTH } from './daynight.js';
import { Humanoid, makeGun, WEAPONS, makeVehicleMesh, VEHICLE_TYPES, PAINTS, makeDrone, makePickup, flashSirens, pedKindFor } from './models.js';

const { CELL, ROAD, N, HALF } = CITY;
const V3 = THREE.Vector3;
const tmp = new V3(), tmp2 = new V3(), tmp3 = new V3();
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const yawOf = (dx, dz) => Math.atan2(-dx, -dz);
export const SPAWN = { x: 13, z: -22, yaw: Math.PI * 0.85 };
export const PRICES = { ammo: 100, medkit: 150 };

// ---------------- VEHICLE ----------------
class Vehicle {
  constructor(game, type, x, z, yaw, mode) {
    this.game = game; this.type = type; this.def = VEHICLE_TYPES[type];
    this.flying = this.def.flying;
    this.mesh = makeVehicleMesh(type, PAINTS[Math.floor(Math.random() * PAINTS.length)]);
    this.body = this.mesh.userData.body;
    this.pos = new V3(x, this.flying ? 0.7 : 0, z);
    this.vel = new V3();
    this.yaw = yaw; this.speed = 0; this.steer = 0;
    this.mode = mode; this.hasDriver = mode !== 'abandoned';
    this.health = this.def.armor; this.maxHealth = this.def.armor;
    this.roll = 0; this.pitch = 0; this.bob = Math.random() * 6;
    this.h = 0; this.target = new V3(); this.ti = 0; this.tj = 0;
    this.stopT = 0; this.shootT = rand(1, 2); this.copsDropped = false;
    this.wreckT = 0; this.honkT = 0;
    this.radius = this.flying ? 2.4 : 2.3;
    game.scene.add(this.mesh);
    this.sync();
  }
  get fwd() { return (this._f || (this._f = new V3())).set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  sync() {
    this.mesh.position.copy(this.pos);
    if (this.flying) this.mesh.position.y += Math.sin(this.bob) * 0.08;
    this.mesh.rotation.set(0, this.yaw, 0);
    this.body.rotation.set(this.pitch, 0, this.roll);
  }
  dispose() { this.game.scene.remove(this.mesh); }
}

// ---------------- PEOPLE ----------------
const haloMat = new THREE.MeshBasicMaterial({ color: 0xff1030, toneMapped: false });
export class Person {
  constructor(game, kind) {
    this.game = game; this.kind = kind;
    this.h = new Humanoid(kind === 'cop' ? 'cop' : 'ped');
    this.root = this.h.root;
    this.pos = new V3(); this.vel = new V3(); this.yaw = 0;
    this.state = 'walk'; this.t = 0; this.health = kind === 'cop' ? 70 : kind === 'gang' ? 60 : kind === 'psycho' ? 700 : kind === 'boss' ? 260 : 30;
    this.maxHealth = this.health;
    this.speed = 0;
    game.scene.add(this.root);
    if (kind === 'cop') { this.gun = makeGun('pistol'); this.h.holdGun(this.gun); this.shootT = rand(1, 2); }
    if (kind === 'gang' || kind === 'psycho' || kind === 'boss') {
      // armed bad guys: the enemy AI (ai.js) decides when they notice you and fight
      this.gun = makeGun(kind === 'psycho' ? 'shotgun' : kind === 'boss' ? 'rifle' : Math.random() < 0.5 ? 'rifle' : 'pistol'); this.h.holdGun(this.gun);
      this.shootT = rand(1, 2.5); this.state = 'alive';
      if (kind === 'boss') this.root.scale.setScalar(1.1);
      if (kind === 'psycho') {
        this.root.scale.setScalar(1.35);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 4, 20), haloMat); halo.rotation.x = Math.PI / 2; halo.position.y = 2.0; this.root.add(halo);
      }
    }
  }
  dispose() { this.game.scene.remove(this.root); }
}

// ---------------- DRONE ----------------
class Drone {
  constructor(game, x, y, z, police) {
    this.game = game; this.police = police;
    this.mesh = makeDrone(police);
    this.pos = new V3(x, y, z); this.vel = new V3();
    this.health = 45; this.shootT = rand(1, 2.5); this.ang = Math.random() * 6; this.dead = false; this.fallV = 0;
    this.rogue = !police;
    game.scene.add(this.mesh);
  }
  dispose() { this.game.scene.remove(this.mesh); this.mesh.userData.glowMat.dispose(); }
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, camera, city, fx, audio, settings, hud, input
    this.time = 0; this.clock = 19;
    this.player = null;
    this.vehicles = []; this.peds = []; this.cops = []; this.drones = []; this.pickups = []; this.runners = [];
    this.targets = []; // extra things bullets can hit (the boss mech, the story's jammer…)
    this.wanted = 0; this.evadeT = 0; this.seenT = 0;
    this.objective = 0; this.objCount = 0; this.wave = 1;
    this.active = false;
    this.camState = { yawOff: 0, pitchOff: 0, idle: 0, pos: new V3(), init: false };
    this.aimZoom = 0;
    // doors, shops and flats
    this.cash = 0; this.interior = null; this.rooms = null; this.onSave = null;
    this.shops = new Map(); this.looted = new Set(); this._firedT = -9;
    // pause-menu shop and challenges
    this.garage = new Set(); this.cred = 0; this.gang = [];
    this.ch = new Challenges(this);
    this.ai = new EnemyAI(this); // gang members that notice gunfire, street gangs, people to rescue
    this.slide = new SlidingDoors(this.scene); // Cyberpunk-style doors that slide open
    this.gps = new GPS(this); // pick a destination on the map, follow the arrows
    this.implants = new Set();
    this.acts = new Activities(this); // cyberware, ATM hacking, neon tags, street food
    this.prog = new Progress(this); // XP, levels, skills, medals, golden robot statues
    this.moves = new Moves(this); // grappling hook and wall-running
    this.story = new Story(this); // Juno, Overlord Zero and the giant mech
    this.events = new CityEvents(this); // surprise events around the city
    this.buddy = new Buddy(this); // Sparky the robot dog
    this.home = new Home(this); // your apartment
    this.upg = newUpgrades(null); // car and gun upgrades
    this._buildPlayer();
    // tall light beam that marks the objective in the world
    const bg = new THREE.CylinderGeometry(1.4, 1.4, 400, 16, 1, true); bg.translate(0, 200, 0);
    this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffa43a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.beam.visible = false; this.scene.add(this.beam);
  }

  // ---------- setup ----------
  _buildPlayer() {
    const h = new Humanoid('soldier');
    this.scene.add(h.root);
    this.guns = WEAPONS.map(w => makeGun(w.id));
    this.player = {
      h, pos: new V3(), vy: 0, yaw: 0, pitch: 0, onGround: true, vel: new V3(),
      health: 100, shield: 100, shieldDelay: 0,
      ammo: WEAPONS.map(w => ({ mag: w.mag, res: w.reserve })), wi: 0, owned: WEAPONS.map(w => !w.price),
      reloadT: 0, fireCD: 0, alive: true, vehicle: null, deadT: 0, pendingExit: false, hurtT: 0, cannon: 100,
    };
    h.holdGun(this.guns[0]);
  }

  start(save) {
    this.clearWorld();
    const p = this.player;
    p.alive = true; p.vehicle = null; p.pendingExit = false; p.vy = 0; p.vel.set(0, 0, 0);
    if (p.h.root.parent !== this.scene) this.scene.add(p.h.root); // still sitting on a bike from last time
    p.h.root.visible = true; p.h.root.rotation.set(0, 0, 0);
    if (save) {
      p.pos.set(save.pos[0], 0, save.pos[2]); p.pos.y = this.city.groundAt(p.pos.x, p.pos.z, 1);
      p.yaw = save.yaw || 0; p.health = save.health ?? 100; p.shield = save.shield ?? 100;
      p.ammo = WEAPONS.map((w, i) => ({ mag: save.ammo?.[i]?.mag ?? w.mag, res: save.ammo?.[i]?.res ?? w.reserve }));
      p.wi = save.wi || 0; this.objective = save.objective || 0; this.wave = save.wave || 1;
      this.cash = save.cash ?? 200; this.looted = new Set(save.looted || []);
      p.owned = WEAPONS.map(w => !w.price || (save.guns || []).includes(w.id));
      this.garage = new Set(save.garage || []); this.cred = save.cred || 0;
    } else {
      p.pos.set(SPAWN.x, 0, SPAWN.z); p.yaw = SPAWN.yaw; p.health = 100; p.shield = 100;
      p.ammo = WEAPONS.map(w => ({ mag: w.mag, res: w.reserve })); p.wi = 0; this.objective = 0; this.wave = 1;
      this.cash = 200; this.looted = new Set();
      p.owned = WEAPONS.map(w => !w.price); this.garage = new Set(); this.cred = 0;
    }
    if (!p.owned[p.wi]) p.wi = 0;
    this.ch.reset(save);
    this.acts.reset(save);
    this.prog.reset(save); this.prog.build(this.city); this.moves.reset();
    this.story.reset(save); this.story.waitT = 3;
    this.events.reset();
    this.upg = newUpgrades(save);
    this.home.reset(save);
    this.buddy.remove(); if (save && save.dog) this.buddy.adopt(true);
    this.clock = save && save.clock !== undefined ? save.clock : 19; // a new game starts at sunset
    this._leaveInterior(); this.shops.clear();
    p.pitch = 0;
    this.selectWeapon(p.wi, true);
    this.wanted = 0; this.evadeT = 0;
    this.camState.init = false;
    this._spawnParked();
    this._startObjective(this.objective);
    // fixed pickups around Times Square
    for (const [x, z, k] of [[14, 14, 'ammo'], [-14, 14, 'health'], [-14, -14, 'ammo'], [80, -12, 'health'], [-12, 90, 'ammo']]) this._pickup(x, z, k, true);
    this.active = true;
  }

  newPerson(kind) { return new Person(this, kind); }
  clearWorld() {
    if (this.ch) this.ch.cancel(true);
    if (this.story) { this.story.cleanup(); this.story.ending = null; }
    if (this.events) this.events.end(true);
    if (this.ai) this.ai.clear();
    if (this.gps) this.gps.clear();
    for (const a of [this.vehicles, this.peds, this.cops, this.drones, this.runners, this.gang]) { a.forEach(e => e.dispose()); a.length = 0; }
    this.pickups.forEach(p => this.scene.remove(p.mesh)); this.pickups.length = 0;
    this.fx.clear();
    if (this.beam) this.beam.visible = false;
  }

  saveData() {
    const p = this.player, v = p.vehicle;
    let x = v ? v.pos.x : p.pos.x, z = v ? v.pos.z : p.pos.z;
    if (this.interior) { x = this.interior.outside.x; z = this.interior.outside.z; } // saved inside: load at the door
    if (v || this.city.inside(x, 1, z)) {
      // saved from a car (maybe above a roof): load on the nearest street instead
      const rx = roadC(clamp(Math.round((x + HALF) / CELL), 0, N)), rz = roadC(clamp(Math.round((z + HALF) / CELL), 0, N));
      if (Math.abs(x - rx) < Math.abs(z - rz)) x = rx; else z = rz;
    }
    return { v: 1, pos: [x, 0, z], yaw: v ? v.yaw : p.yaw, health: Math.round(p.health), shield: Math.round(p.shield), ammo: p.ammo.map(a => ({ ...a })), wi: p.wi, objective: this.objective < 0 ? this._objNext : this.objective, wave: this.wave, cash: this.cash, looted: [...this.looted],
      guns: WEAPONS.filter((w, i) => p.owned[i] && w.price).map(w => w.id), garage: [...this.garage], cred: this.cred, done: [...this.ch.done], ...this.acts.save(), ...this.prog.save(), ...this.story.save(), ...this.home.save(), upg: this.upg, dog: this.buddy.owned, clock: this.clock, time: Date.now() };
  }

  // where the player is in the city: inside a shop or flat that's the street door they used
  wpos() {
    const p = this.player;
    if (this.interior) return this.interior.outside;
    return p.vehicle ? p.vehicle.pos : p.pos;
  }

  // ---------- objectives ----------
  _startObjective(i) {
    this.objective = i; this.objCount = 0;
    const ts = this.city.plaza;
    if (i === 0) {
      for (let k = 0; k < 4; k++) this.drones.push(new Drone(this, rand(-30, 30), rand(10, 18), rand(-30, 30), false));
      this.objTarget = new V3(0, 0, 0);
    } else if (i >= 4 && !this.story.done) { this.objTarget = null; return; // the story missions take over
    } else if (i === 1) this.objTarget = null;
    else if (i === 2) this.objTarget = new V3(ts.x, 0, ts.z);
    else if (i === 3) this.objTarget = new V3(roadC(9), 90, 0);
    else {
      const n = 3 + this.wave * 2;
      const p = this.wpos();
      for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.28, d = rand(40, 70);
        this.drones.push(new Drone(this, p.x + Math.cos(a) * d, rand(14, 30) + (this.player.vehicle?.flying ? p.y : 0), p.z + Math.sin(a) * d, false));
      }
      this.objTarget = null;
    }
  }
  objectiveText() {
    const i = this.objective;
    if (i < 0) return ['Objective complete!', 'Next objective incoming…'];
    if (i >= 4 && !this.story.done) return this.story.text() || ['', ''];
    if (i === 0) return [`Destroy the rogue drones over Times Square (${this.objCount}/4)`, 'Shoot them with your plasma rifle'];
    if (i === 1) return ['Steal a car: walk up to one and press F', 'Ground cars drive on the roads'];
    if (i === 2) return ['Steal a flying car at Hover Pad 06', 'Space = up, Shift = down'];
    if (i === 3) return ['Fly through the SKYLANE A5 gate', 'Follow the orange marker'];
    const n = 3 + this.wave * 2;
    return [`Drone wave ${this.wave}: destroy the rogue drones (${this.objCount}/${n})`, 'Free roam: cause chaos, escape the cops'];
  }
  _completeObjective() {
    const cur = this.objective;
    this.audio.play('objective');
    this.hud.toast('OBJECTIVE COMPLETE');
    if (cur >= 4) this.wave++;
    this._objNext = Math.min(4, cur + 1);
    this.objective = -1; this.objTarget = null; this._objTimer = 1.6;
  }

  // ---------- spawning ----------
  _spawnParked() {
    const pl = this.city.plaza;
    // flying cars on the hover pad (with drivers) and a couple next to spawn
    const padTypes = ['hover', 'taxi', 'hover', 'taxi'];
    this.city.padSpots.forEach((s, i) => { const v = this._addVehicle(padTypes[i], s.x, s.z, i * 1.3, 'parked'); v.pos.y = 0.3 + 0.7; v.home = s; });
    // ground cars parked at the curb near spawn
    this._addVehicle('muscle', 8.2, -40, 0, 'parked');
    this._addVehicle('hover', -8.2, -34, Math.PI, 'parked');
    this._addVehicle('sedan', 40, 8.2, -Math.PI / 2, 'parked');
    this._addVehicle('super', 8.2, -58, 0, 'parked');
    this._addVehicle('compact', 52, -8.2, Math.PI / 2, 'parked');
    this._addVehicle('van', -8.2, -64, Math.PI, 'parked');
    this._addVehicle('bike', 9.0, -24, 0.3, 'parked');
    this._addVehicle('chopper', 9.2, -30, 0.3, 'parked');
    void pl;
  }
  _addVehicle(type, x, z, yaw, mode) { const v = new Vehicle(this, type, x, z, yaw, mode); this.vehicles.push(v); return v; }

  _spawnTraffic(px, pz, police = false) {
    for (let tries = 0; tries < 12; tries++) {
      const i = Math.floor(Math.random() * (N + 1)), j = Math.floor(Math.random() * (N + 1));
      const h = Math.floor(Math.random() * 4), [dx, dz] = DIRS[h];
      const ni = i + dx, nj = j + dz;
      if (ni < 0 || ni > N || nj < 0 || nj > N) continue;
      if (this.city.segBlocked(i, j, ni, nj)) continue;
      const t = rand(0.2, 0.7);
      const rx = -dz, rz = dx;
      const x = roadC(i) + dx * CELL * t + rx * LANE, z = roadC(j) + dz * CELL * t + rz * LANE;
      const d = Math.hypot(x - px, z - pz);
      if (d < (police ? 110 : 70) || d > (police ? 230 : 260)) continue;
      if (this.vehicles.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 10)) continue;
      const type = police ? 'police' : ['sedan', 'sedan', 'muscle', 'compact', 'compact', 'van', 'super'][Math.floor(Math.random() * 7)];
      const v = this._addVehicle(type, x, z, yawOf(dx, dz), police ? 'police' : 'traffic');
      v.h = h; v.ti = ni; v.tj = nj; v.speed = police ? 20 : 10;
      this._laneTarget(v);
      return v;
    }
    return null;
  }
  _laneTarget(v) { const [dx, dz] = DIRS[v.h]; v.target.set(roadC(v.ti) - dz * LANE, 0, roadC(v.tj) + dx * LANE); }

  _spawnSky(px, pz) {
    const lanes = this.city.skyLanes;
    const L = lanes[Math.floor(Math.random() * lanes.length)];
    const along = clamp((L.axis === 'z' ? pz : px) + rand(-300, 300), -HALF, HALF);
    const x = L.axis === 'z' ? L.c : along, z = L.axis === 'z' ? along : L.c;
    if (Math.hypot(x - px, z - pz) > 420) return;
    const type = Math.random() < 0.15 ? 'flypolice' : Math.random() < 0.5 ? 'taxi' : 'hover';
    const v = this._addVehicle(type, x, z, L.axis === 'z' ? yawOf(0, L.dir) : yawOf(L.dir, 0), 'sky');
    v.pos.y = L.y + rand(-3, 3); v.lane = L; v.speed = rand(30, 55);
  }

  _spawnPed(px, pz, near = false) {
    for (let tries = 0; tries < 10; tries++) {
      const bi = Math.floor(Math.random() * N), bj = Math.floor(Math.random() * N);
      const bx0 = roadC(bi) + ROAD / 2, bz0 = roadC(bj) + ROAD / 2;
      const per = (CELL - ROAD - 4) * 4, s = Math.random() * per;
      const p = this._loopPos(bx0, bz0, s, tmp);
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d > (near ? 90 : 140) || d < 25) continue;
      const ped = new Person(this, 'ped');
      ped.bx0 = bx0; ped.bz0 = bz0; ped.s = s; ped.dir = Math.random() < 0.5 ? 1 : -1; ped.walk = rand(1.1, 1.6);
      ped.pos.copy(p); this.peds.push(ped);
      return ped;
    }
  }
  _loopPos(bx0, bz0, s, out) {
    const L = CELL - ROAD - 4, o = 2; // side length 60, inset 2
    const per = L * 4; s = ((s % per) + per) % per;
    const side = Math.floor(s / L), f = s - side * L;
    if (side === 0) out.set(bx0 + o + f, 0, bz0 + o);
    else if (side === 1) out.set(bx0 + o + L, 0, bz0 + o + f);
    else if (side === 2) out.set(bx0 + o + L - f, 0, bz0 + o + L);
    else out.set(bx0 + o, 0, bz0 + o + L - f);
    return out;
  }

  _pickup(x, z, kind, fixed = false) {
    const m = makePickup(kind); m.position.set(x, 0.6, z); this.scene.add(m);
    this.pickups.push({ mesh: m, kind, fixed, t: 0, respawn: 0 });
  }

  // ---------- crimes / wanted ----------
  crime(amount, msg) {
    const before = Math.floor(this.wanted);
    this.wanted = clamp(this.wanted + amount, 0, 5.99);
    this.evadeT = 0;
    if (Math.floor(this.wanted) > before) { this.audio.play('star'); this.hud.toast(msg || 'WANTED LEVEL UP'); }
  }
  get stars() { return Math.floor(this.wanted); }

  // ---------- weapons ----------
  selectWeapon(i, silent) {
    const p = this.player; i = (i + WEAPONS.length) % WEAPONS.length;
    if (p.fists) return; // no guns in the ring
    if (!p.owned[i]) return;
    if (p.wi === i && !silent) return;
    p.wi = i; p.reloadT = 0; p.fireCD = 0.2;
    p.h.holdGun(this.guns[i]);
    if (!silent) this.audio.play('switch');
  }
  cycleWeapon(dir) {
    const p = this.player;
    for (let k = 1; k <= WEAPONS.length; k++) { const i = (p.wi + dir * k + WEAPONS.length * 2) % WEAPONS.length; if (p.owned[i]) { this.selectWeapon(i); return; } }
  }
  reload() {
    const p = this.player, w = WEAPONS[p.wi], a = p.ammo[p.wi];
    if (p.reloadT > 0 || a.mag >= magSize(this, p.wi) || a.res <= 0) return;
    p.reloadT = w.reload; this.audio.play('reload');
  }
  // camera ray -> world aim point
  aimPoint(out, ignore) {
    const cam = this.camera; cam.getWorldDirection(tmp2);
    let best = this.city.raycast(cam.position, tmp2, 300);
    const test = (pos, r, y0, y1) => {
      // ray vs vertical cylinder approx: closest approach
      tmp.subVectors(pos, cam.position); const t = tmp.dot(tmp2); if (t < 1 || t > best) return;
      const px = cam.position.x + tmp2.x * t - pos.x, pz = cam.position.z + tmp2.z * t - pos.z, py = cam.position.y + tmp2.y * t;
      if (px * px + pz * pz < r * r && py > y0 && py < y1) best = t;
    };
    for (const e of this.peds) if (e.state !== 'gone') test(e.pos, 0.5, e.pos.y, e.pos.y + 1.9);
    for (const e of this.cops) test(e.pos, 0.5, e.pos.y, e.pos.y + 1.9);
    for (const e of this.gang) if (e.state !== 'dead' && !e.ride) test(e.pos, 0.5 * e.root.scale.x, e.pos.y, e.pos.y + 1.9 * e.root.scale.x);
    for (const f of this.ai.friends) if (f.alive && f.state !== 'car') test(f.pos, 0.45, f.pos.y, f.pos.y + (f.dog ? 1.1 : 1.9));
    for (const d of this.drones) if (!d.dead) test(d.pos, 1.0, d.pos.y - 0.8, d.pos.y + 0.8);
    for (const v of this.vehicles) if (v !== ignore) test(v.pos, 2.2, v.pos.y, v.pos.y + 1.7);
    for (const t of this.targets) if (t.aimTest) t.aimTest(test);
    return out.copy(cam.position).addScaledVector(tmp2, best);
  }
  firePlayer(dt) {
    const p = this.player, w = WEAPONS[p.wi], a = p.ammo[p.wi], inp = this.input;
    p.fireCD -= dt;
    if (this.acts.hack.on) return;
    if (p.fists) { // fist fight: left click punches, left and right
      const before = p.punchT || 0;
      p.punchT = before - dt;
      if (before > 0.16 && p.punchT <= 0.16) this.ch.punch();
      if (this.input.mouseClicked && p.punchT <= 0) { p.punchT = 0.32; p.punchSide = !p.punchSide; this.audio.play('switch'); }
      return;
    }
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) { const need = magSize(this, p.wi) - a.mag, take = Math.min(need, a.res); a.mag += take; a.res -= take; }
      return;
    }
    const want = w.auto ? inp.mouseDown : inp.mouseClicked;
    if (!want || p.fireCD > 0) return;
    if (a.mag <= 0) { this.audio.play('empty'); p.fireCD = 0.3; if (a.res > 0) this.reload(); return; }
    a.mag--; p.fireCD = w.rate; this._firedT = this.time;
    const muzzle = this.guns[p.wi].userData.muzzle.getWorldPosition(new V3());
    const aim = this.aimPoint(new V3());
    const dir = aim.sub(muzzle).normalize();
    for (let k = 0; k < w.pellets; k++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * w.spread * 2; d.y += (Math.random() - 0.5) * w.spread * 2; d.z += (Math.random() - 0.5) * w.spread * 2; d.normalize();
      const b = this.fx.bolt(muzzle, d, w.speed, w.color, 'player', w.dmg * this.gunMult(p.wi));
      if (w.explode) b.explode = w.explode;
    }
    this.fx.muzzle(muzzle, w.color, this.settings.preset !== 'low');
    this.audio.play(w.sound);
    this.hud.kick(w.id === 'shotgun' ? 14 : 6);
    p.recoil = (p.recoil || 0) + (w.id === 'shotgun' ? 0.05 : 0.012);
    if (a.mag === 0 && a.res > 0) setTimeout(() => this.reload(), 200);
    // gunfire scares nearby pedestrians, and every gang member around hears it
    for (const e of this.peds) if (e.state === 'walk' && e.pos.distanceTo(p.pos) < 35) { e.state = 'flee'; e.t = rand(6, 10); }
    this.ai.noise(p.pos, w.noise || 50);
  }
  // how hard a gun hits: SHARPSHOOTER skill and gun upgrades
  gunMult(wi) { return (1 + 0.12 * this.prog.rank('gunner')) * (1 + 0.15 * ((this.upg && this.upg.gun[WEAPONS[wi].id]?.dmg) || 0)); }
  fireCannon(dt) {
    const p = this.player, v = p.vehicle;
    p.cannonCD = (p.cannonCD || 0) - dt;
    p.cannon = Math.min(100, p.cannon + dt * 18);
    if (!this.input.mouseDown || p.cannonCD > 0 || p.cannon < 8) return;
    p.cannon -= 8; p.cannonCD = 0.16;
    const aim = this.aimPoint(new V3(), v);
    const f = v.fwd.clone(), r = new V3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    for (const s of [-1, 1]) {
      const o = v.pos.clone().addScaledVector(f, 2.8).addScaledVector(r, s * 1.1); o.y += 0.6;
      const d = aim.clone().sub(o).normalize();
      if (d.dot(f) < 0.3) d.copy(f);
      this.fx.bolt(o, d, 220, 0xff2bd6, 'player', 30);
      this.fx.flash(o, 0xff2bd6, 1.4, 0.05);
    }
    this.audio.play('cannon');
    this.ai.noise(v.pos, 60);
  }
  enemyShoot(from, target, spread, dmg, color = 0xff2040) {
    const d = tmp.subVectors(target, from).normalize().clone();
    d.x += (Math.random() - 0.5) * spread; d.y += (Math.random() - 0.5) * spread; d.z += (Math.random() - 0.5) * spread; d.normalize();
    this.fx.bolt(from, d, 90, color, 'enemy', dmg);
    this.fx.flash(from, color, 0.9, 0.05);
    this.audio.play('enemy', from.distanceTo(this.camera.position));
  }

  updateBolts(dt) {
    const B = this.fx.bolts, p = this.player;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      const prev = b.pos.clone();
      b.pos.addScaledVector(b.vel, dt); b.life -= dt;
      b.m.position.copy(b.pos);
      let hit = null;
      // buildings / ground (sub-steps)
      const len = prev.distanceTo(b.pos), steps = Math.ceil(len / 1.5);
      for (let s = 1; s <= steps && !hit; s++) {
        tmp.lerpVectors(prev, b.pos, s / steps);
        if (tmp.y < 0.02 || this.city.inside(tmp.x, tmp.y, tmp.z)) hit = { pos: tmp.clone(), wall: true };
      }
      const segHit = (pos, r, y0, y1) => {
        // closest point on segment prev->b.pos to vertical axis at pos (xz)
        const sx = b.pos.x - prev.x, sz = b.pos.z - prev.z, l2 = sx * sx + sz * sz || 1e-6;
        const t = clamp(((pos.x - prev.x) * sx + (pos.z - prev.z) * sz) / l2, 0, 1);
        const cx = prev.x + sx * t - pos.x, cz = prev.z + sz * t - pos.z, cy = prev.y + (b.pos.y - prev.y) * t;
        return (cx * cx + cz * cz < r * r && cy > y0 && cy < y1) ? new V3(prev.x + sx * t, cy, prev.z + sz * t) : null;
      };
      if (b.owner === 'player') {
        this.ai.nearMiss(prev, b.pos);
        if (!hit) { const th = this.ch.boltHit(prev, b.pos); if (th) hit = { pos: th }; }
        for (const t of this.targets) { if (hit) break; const h = t.boltHit(prev, b.pos, b.dmg, segHit); if (h) hit = { pos: h }; }
        for (const f of this.ai.friends) { if (hit) break; if (!f.alive || f.state === 'car') continue; const h = segHit(f.pos, 0.45, f.pos.y, f.pos.y + (f.dog ? 1.1 : 1.9)); if (h) { hit = { pos: h }; f.hurt(b.dmg); } }
        for (const e of this.peds) { if (hit) break; if (e.state === 'gone' || e.state === 'dead') continue; const h = segHit(e.pos, 0.45, e.pos.y, e.pos.y + 1.9); if (h) { hit = { pos: h }; this.damagePerson(e, b.dmg, b.vel); } }
        for (const e of this.cops) { if (hit) break; if (e.state === 'dead') continue; const h = segHit(e.pos, 0.5, e.pos.y, e.pos.y + 1.9); if (h) { hit = { pos: h }; this.damagePerson(e, b.dmg, b.vel); } }
        for (const e of this.gang) { if (hit) break; if (e.state === 'dead' || e.ride) continue; const sc = e.root.scale.x; const h = segHit(e.pos, 0.5 * sc, e.pos.y, e.pos.y + 1.9 * sc); if (h) { hit = { pos: h }; this.damagePerson(e, b.dmg, b.vel); } }
        for (const d of this.drones) { if (hit) break; if (d.dead) continue; const h = segHit(d.pos, 1.0, d.pos.y - 0.7, d.pos.y + 0.7); if (h) { hit = { pos: h }; this.damageDrone(d, b.dmg); } }
        for (const v of this.vehicles) { if (hit) break; if (v === p.vehicle || v.mode === 'wreck') continue; const h = segHit(v.pos, 2.0, v.pos.y, v.pos.y + 1.6); if (h) { hit = { pos: h }; this.damageVehicle(v, b.dmg, true); } }
        if (hit && !hit.wall) this.hud.hitmark();
      } else if (b.owner === 'enemy') {
        const target = p.vehicle ? p.vehicle.pos : p.pos;
        const r = p.vehicle ? 2.2 : 0.55, y1 = p.vehicle ? 1.8 : 1.9;
        const h = p.alive && segHit(target, r, target.y, target.y + y1);
        if (h) { hit = { pos: h }; if (p.vehicle) this.damageVehicle(p.vehicle, b.dmg * 0.8, false); else this.damagePlayer(b.dmg); }
      }
      if (hit && b.explode) this.blast(hit.pos, b.explode, b.dmg);
      if (hit) {
        this.fx.sparks(hit.pos, b.color, hit.wall ? 8 : 14, 5);
        this.fx.flash(hit.pos, b.color, 1.6, 0.08);
        if (!hit.wall) this.audio.play('hit', hit.pos.distanceTo(this.camera.position));
        this.fx.removeBolt(i);
      } else if (b.life <= 0) this.fx.removeBolt(i);
    }
  }

  // ---------- damage ----------
  damagePlayer(dmg) {
    const p = this.player; if (!p.alive) return;
    if (this.implants.has('skin')) dmg *= 0.66; // TITAN SKIN
    dmg *= 1 - 0.12 * this.prog.rank('tough'); // TOUGH AS STEEL
    p.shieldDelay = 4;
    const s = Math.min(p.shield, dmg * 0.7); p.shield -= s; dmg -= s;
    p.health -= dmg; p.hurtT = 0.4;
    this.audio.play('hurt');
    if (p.health <= 0) this.killPlayer();
  }
  // plasma launcher blast: hurts everything around it (but not you)
  blast(pos, radius, dmg) {
    this.fx.explosion(pos.clone()); this.audio.play('explode', pos.distanceTo(this.camera.position));
    this.ai.noise(pos, 80);
    for (const f of this.ai.friends) if (f.alive && f.state !== 'car' && f.pos.distanceTo(pos) < radius) f.hurt(dmg * 2);
    const hurt = (e, k = 1) => { const d = e.pos.distanceTo(pos); if (d < radius) this.damagePerson(e, dmg * 2 * k * (1 - d / radius) + 20, tmp.subVectors(e.pos, pos)); };
    for (const e of [...this.peds, ...this.cops, ...this.gang]) if (e.state !== 'dead' && e.state !== 'gone') hurt(e);
    for (const d of this.drones) if (!d.dead && d.pos.distanceTo(pos) < radius) this.damageDrone(d, dmg * 2);
    for (const t of this.targets) if (t.blast) t.blast(pos, radius, dmg);
    for (const v of this.vehicles) if (v !== this.player.vehicle && v.mode !== 'wreck' && v.pos.distanceTo(pos) < radius + 1.5) this.damageVehicle(v, dmg * 2.5, true);
  }
  killPlayer() {
    const p = this.player; p.health = 0; p.alive = false; p.deadT = 3.2;
    this.ch.onPlayerDeath();
    this.story.onPlayerDeath();
    if (p.vehicle) this.exitVehicle(true);
    this.hud.dead(true);
  }
  respawn() {
    const p = this.player;
    this._leaveInterior();
    p.alive = true; p.health = 100; p.shield = 100;
    p.pos.set(SPAWN.x, 0, SPAWN.z); p.yaw = SPAWN.yaw; p.vy = 0;
    p.h.root.rotation.set(0, 0, 0);
    p.ammo.forEach((a, i) => { a.mag = WEAPONS[i].mag; a.res = Math.max(a.res, WEAPONS[i].reserve); });
    this.wanted = 0; this._calmPolice();
    this.hud.dead(false);
    this.camState.init = false;
  }
  damagePerson(e, dmg, vel) {
    if (e.state === 'dead') return;
    e.health -= dmg;
    if (e.kind === 'cop') { this.crime(0.12); e.aggro = true; }
    const bad = e.kind === 'gang' || e.kind === 'psycho' || e.kind === 'boss';
    if (bad && e.health > 0) this.ai.hit(e);
    if (e.health <= 0) {
      e.state = 'dead'; e.t = 12; e.fallT = 0;
      if (bad) {
        e.vel.copy(vel ? vel.clone().setY(0).normalize().multiplyScalar(3) : new V3()); e.vel.y = 2.5;
        this.audio.play('yell', e.pos.distanceTo(this.camera.position));
        if (e.ride) { e.ride = null; e.root.visible = true; }
        this.ai.killed(e);
        // street gangs sometimes drop a bit of cash
        if (e.neutral && Math.random() < 0.6) { const m = makePickup('cash'); m.position.set(e.pos.x, 0.6, e.pos.z); this.scene.add(m); this.pickups.push({ mesh: m, kind: 'cash', fixed: false, t: 0, respawn: 0, cash: 20 + Math.floor(Math.random() * 5) * 10 }); }
        this.killed(e);
        return;
      }
      e.vel.copy(vel ? vel.clone().setY(0).normalize().multiplyScalar(3) : new V3()); e.vel.y = 2.5;
      if (e.kind === 'cop') { this.crime(1, 'COP DOWN · WANTED LEVEL UP'); if (Math.random() < 0.6) this._pickup(e.pos.x, e.pos.z, Math.random() < 0.6 ? 'ammo' : 'health'); }
      else { this.crime(1, 'CIVILIAN DOWN · WANTED LEVEL UP'); this.audio.play('yell', e.pos.distanceTo(this.camera.position)); }
      for (const o of this.peds) if (o !== e && o.state === 'walk' && o.pos.distanceTo(e.pos) < 40) { o.state = 'flee'; o.t = 10; }
    } else if (e.kind === 'ped') { e.state = 'flee'; e.t = 10; }
  }
  // a bad guy (or a challenge/story drone) is down: tell everyone who cares
  killed(e) {
    this.ch.onKill(e);
    if (this.story) this.story.onKill(e);
    if (this.events) this.events.onKill(e);
    if (!e.mesh) { this.prog.stat('kills'); this.prog.addXP(e.isBoss ? 60 : 15); }
  }
  damageDrone(d, dmg) {
    d.health -= dmg;
    if (d.health <= 0 && !d.dead) {
      d.dead = true; d.fallV = 0;
      if (!d.police) this.prog.addXP(10);
      this.fx.explosion(d.pos.clone()); this.audio.play('explode', d.pos.distanceTo(this.camera.position));
      if (d.police) this.crime(0.6);
      if (d.challenge) this.killed(d);
      if (d.rogue && (this.objective === 0 || this.objective === 4)) {
        this.objCount++;
        const need = this.objective === 0 ? 4 : 3 + this.wave * 2;
        if (this.objCount >= need) this._completeObjective();
      }
      if (Math.random() < 0.35) this._pickup(d.pos.x, d.pos.z, 'ammo');
    }
  }
  damageVehicle(v, dmg, byPlayer) {
    if (v.mode === 'wreck') return;
    v.health -= dmg;
    if (byPlayer && v.def.police) this.crime(0.15);
    if (byPlayer && v.mode === 'traffic' && v.hasDriver) { v.mode = 'flee'; v.fleeT = 8; }
    if (v.escape && v.escape.onHit) v.escape.onHit(v);
    if (v.health <= 0) this.explodeVehicle(v, byPlayer);
  }
  explodeVehicle(v, byPlayer) {
    if (v.escape && v.escape.onStolen) v.escape.onStolen(v); // a bounty jumps out of his burning getaway car
    v.mode = 'wreck'; v.wreckT = 20; v.hasDriver = false; v.speed = 0;
    this.fx.explosion(v.pos.clone().setY(v.pos.y + 1)); this.audio.play('explode', v.pos.distanceTo(this.camera.position));
    v.mesh.traverse(o => { if (o.isMesh) { o.material = wreckMat; } });
    if (this.player.vehicle === v) { this.exitVehicle(true); this.damagePlayer(45); }
    if (byPlayer && !v.escape) this.crime(v.def.police ? 1 : 0.5, v.def.police ? 'POLICE VEHICLE DESTROYED' : undefined);
    this.ai.noise(v.pos, 80);
    for (const f of this.ai.friends) if (f.alive && f.pos.distanceTo(v.pos) < 7) f.hurt(100);
    // splash damage
    const p = this.player;
    if (!p.vehicle && p.pos.distanceTo(v.pos) < 7) this.damagePlayer(30);
    for (const e of [...this.peds, ...this.cops, ...this.gang]) if (e.pos.distanceTo(v.pos) < 7) this.damagePerson(e, 100, tmp.subVectors(e.pos, v.pos));
    if (v.flying && v.pos.y > 2) v.falling = true;
  }

  // ---------- pause-menu shop ----------
  get credLevel() { return credLevel(this.cred); }
  buyGun(i) {
    const w = WEAPONS[i], p = this.player;
    if (p.owned[i]) return 'owned';
    if (this.credLevel < (w.cred || 0)) return 'locked';
    if (this.cash < w.price) return 'cash';
    this.cash -= w.price; p.owned[i] = true; p.ammo[i] = { mag: w.mag, res: w.reserve };
    this.selectWeapon(i, true); this.audio.play('cash');
    return 'ok';
  }
  buyCar(type, price, cred) {
    if (this.garage.has(type)) { this.deliverCar(type); return 'delivered'; }
    if (this.credLevel < cred) return 'locked';
    if (this.cash < price) return 'cash';
    this.cash -= price; this.garage.add(type); this.deliverCar(type); this.audio.play('cash');
    return 'ok';
  }
  buySupply(what) {
    const p = this.player, price = PRICES[what];
    if (this.cash < price) return 'cash';
    if (what === 'ammo') {
      if (p.ammo.every((a, j) => !p.owned[j] || a.res >= WEAPONS[j].reserve * 2)) return 'full';
      p.ammo.forEach((a, j) => { a.res = Math.min(WEAPONS[j].reserve * 2, a.res + WEAPONS[j].reserve); });
    } else {
      if (p.health >= 100 && p.shield >= 100) return 'full';
      p.health = 100; p.shield = 100;
    }
    this.cash -= price; this.audio.play('cash');
    return 'ok';
  }
  // park one of your cars next to you (or outside the door when you're indoors)
  deliverCar(type, temp = false) {
    const p = this.player, base = this.wpos();
    if (!temp) for (let i = this.vehicles.length - 1; i >= 0; i--) { const v = this.vehicles[i]; if (v.owned === type && v !== p.vehicle) { v.dispose(); this.vehicles.splice(i, 1); } }
    let spot = null;
    const yaw0 = this.interior ? yawOf(this.interior.door.nx, this.interior.door.nz) : p.vehicle ? p.vehicle.yaw : p.yaw;
    for (let k = 0; k < 24 && !spot; k++) {
      const a = yaw0 + [1.2, -1.2, 0.6, -0.6, 2.2, -2.2, 0, Math.PI][k % 8], r = 5 + Math.floor(k / 8) * 3;
      const x = base.x - Math.sin(a) * r, z = base.z - Math.cos(a) * r;
      if (Math.abs(x) > BOUNDS - 3 || Math.abs(z) > BOUNDS - 3) continue;
      if (this.city.collide(x, z, 2.6, 0.2, 1.8).hit || this.city.inside(x, 1, z)) continue;
      if (this.vehicles.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 5.5)) continue;
      spot = [x, z];
    }
    if (!spot) spot = [base.x + 4, base.z + 4];
    const v = this._addVehicle(type, spot[0], spot[1], yaw0, 'parked');
    v.owned = temp ? false : type; v.hasDriver = false;
    if (v.flying) v.pos.y = this.city.groundAt(v.pos.x, v.pos.z, 1) + 0.7;
    v.sync();
    this.fx.flash(v.pos.clone().setY(v.pos.y + 1), 0x3aff9a, 6, 0.4);
    return v;
  }
  // a vehicle the story moves by itself (the courier)
  spawnStoryVehicle(type, x, y, z) { const v = this._addVehicle(type, x, z, 0, 'courier'); v.pos.y = y; return v; }
  spawnChallengeDrone(x, y, z) {
    const d = new Drone(this, x, y, z, false);
    d.rogue = false; d.challenge = true;
    this.drones.push(d);
    return d;
  }

  // ---------- street doors: shops and flats ----------
  doorLocked(d) { return d.kind === 'shop' && this._shop(d).robbedUntil > this.time; }
  enterDoor(d) {
    if (this.doorLocked(d)) { this.hud.toast('LOCKED · THEY REMEMBER YOU ROBBED THEM'); this.audio.play('empty'); return; }
    const R = this.rooms && (d.isHome && this.rooms.flat_penthouse ? this.rooms.flat_penthouse : this.rooms.forDoor(d));
    if (!R) { this.hud.toast(d.kind === 'shop' ? 'CLOSED' : 'NOBODY HOME'); return; }
    const p = this.player;
    this.interior = { door: d, kind: R.kind, room: R, outside: new V3(d.x + d.nx * 1.2, 0, d.z + d.nz * 1.2), mood: 'idle', rob: 0, calmT: 0, items: [] };
    p.pos.copy(R.spawn); p.pos.y = 0; p.yaw = 0; p.pitch = -0.05; p.vel.set(0, 0, 0); p.vy = 0; p.onGround = true;
    this.camState.init = false;
    this.audio.play('door'); this.hud.fade(0.35);
    this.city.ground.visible = false;
    this.rooms.show(R.key);
    R.setMood(d.id);
    if (d.isHome) { if (this.gps.label === 'YOUR APARTMENT') this.gps.clear(); this.interior.home = true; R.setChannel(5); this.home.furnish(R); this.hud.toast('HOME SWEET HOME'); return; }
    if (R.kind === 'shop') this._openShop(d); else if (R.kind === 'hotel') this._openHotel(d); else this._openFlat(d);
  }
  _leaveInterior() {
    const I = this.interior; if (!I) return;
    if (this.liftOpen) this.closeLift();
    for (const o of I.items) this.scene.remove(o);
    for (let i = this.pickups.length - 1; i >= 0; i--) if (this.pickups[i].room) { this.scene.remove(this.pickups[i].mesh); this.pickups.splice(i, 1); }
    this.interior = null;
    this.city.ground.visible = true;
    if (this.rooms) this.rooms.show(null);
    this.hud.robBar(-1);
  }
  // ---------- hotels: a lobby with a receptionist and a lift up to the rooms ----------
  _openHotel(d) {
    const I = this.interior, R = I.room;
    R.setSign(d.name, d.color);
    const h = new Humanoid(pedKindFor(d.id + 3));
    h.root.position.copy(R.clerk); h.root.rotation.y = R.clerkYaw;
    this.scene.add(h.root); I.items.push(h.root); I.clerk = h;
    this.hud.toast(`WELCOME TO ${d.name}`);
  }
  _updateHotel(dt, lines, near) {
    const I = this.interior, R = I.room, p = this.player;
    if (I.clerk) { const want = yawOf(p.pos.x - R.clerk.x, p.pos.z - R.clerk.z); I.clerk.root.rotation.y += angDiff(I.clerk.root.rotation.y, want) * Math.min(1, dt * 3); I.clerk.animate(dt, 0, {}); }
    if (near(R.counter, 1.6)) lines.push('“Welcome! The lifts are behind you, at the back.”');
    if (!near(R.lift, 2.2)) { if (this.liftOpen) this.closeLift(); return; }
    if (!this.liftOpen) {
      lines.push('<kbd>E</kbd> Call the lift');
      if (this.input.pressed('KeyE')) this.openLift();
      return;
    }
    for (let k = 1; k <= 10; k++) if (this.input.pressed('Digit' + (k % 10))) { this.goFloor(k); return; }
  }
  get atClinic() { return !!(this.interior && this.interior.room.props.cyber); }
  // let the mouse go (lift panel, hacking puzzle) and take it back
  freeMouse(on) { if (this.onLift) this.onLift(on); }
  openLift() { this.liftOpen = true; this.audio.play('ding'); this.hud.lift(true); if (this.onLift) this.onLift(true); }
  closeLift() { this.liftOpen = false; this.hud.lift(false); if (this.onLift) this.onLift(false); }
  // ride the lift up and walk into your room on that floor
  goFloor(n) {
    const I = this.interior; if (!I || I.kind !== 'hotel') return;
    this.closeLift();
    const d = I.door, fd = { id: 60000 + d.id * 16 + n, kind: 'flat', hotelFloor: n, x: d.x, z: d.z, nx: d.nx, nz: d.nz, name: '' };
    const R2 = this.rooms.forDoor(fd); if (!R2) return;
    const outside = I.outside, lobby = { door: d, room: I.room };
    this._leaveInterior();
    const p = this.player;
    this.interior = { door: fd, kind: 'flat', room: R2, outside, mood: 'idle', rob: 0, calmT: 0, items: [], hotel: lobby, floor: n };
    p.pos.copy(R2.spawn); p.pos.y = 0; p.yaw = 0; p.pitch = -0.05; p.vel.set(0, 0, 0); p.vy = 0;
    this.camState.init = false;
    this.city.ground.visible = false;
    this.rooms.show(R2.key); R2.setMood(fd.id);
    this.audio.play('ding'); this.hud.fade(1.0);
    this._openFlat(fd);
  }
  exitDoor() {
    const I = this.interior; if (!I) return;
    const p = this.player, d = I.door;
    if (I.hotel) { // leaving a hotel room: back down in the lift to the lobby
      const L = I.hotel; this._leaveInterior();
      this.interior = { door: L.door, kind: 'hotel', room: L.room, outside: I.outside, mood: 'idle', rob: 0, calmT: 0, items: [] };
      this.city.ground.visible = false; this.rooms.show(L.room.key); L.room.setMood(L.door.id);
      this._openHotel(L.door);
      p.pos.set(L.room.lift.x, 0, L.room.lift.z + 0.4); p.yaw = Math.PI; p.pitch = 0; p.vel.set(0, 0, 0);
      this.camState.init = false; this.audio.play('ding'); this.hud.fade(0.8);
      return;
    }
    this._leaveInterior();
    p.pos.set(I.outside.x, 0, I.outside.z); p.yaw = yawOf(d.nx, d.nz); p.pitch = 0; p.vel.set(0, 0, 0);
    this.camState.init = false;
    this.audio.play('door'); this.hud.fade(0.35);
  }
  _shop(d) { let st = this.shops.get(d.id); if (!st) this.shops.set(d.id, st = { robbedUntil: -1 }); return st; }
  _openShop(d) {
    const I = this.interior, R = I.room;
    R.setSign(d.name, d.color);
    const h = new Humanoid(pedKindFor(d.id));
    h.root.position.copy(R.clerk); h.root.rotation.y = R.clerkYaw;
    this.scene.add(h.root); I.items.push(h.root); I.clerk = h;
    const robbed = this._shop(d).robbedUntil > this.time;
    I.mood = robbed ? 'robbed' : 'idle';
    this.hud.toast(robbed ? 'THE CLERK REMEMBERS YOU…' : d.name);
  }
  _openFlat(d) {
    const R = this.interior.room;
    R.setChannel(d.id);
    // every flat may hide one stash (cash, ammo or a medkit) that you can find once
    const hsh = Math.imul(d.id + 1, 2654435761) >>> 0;
    if (!this.looted.has(d.id) && hsh % 100 < 70 && R.loot.length) {
      const kind = ['cash', 'cash', 'ammo', 'health'][hsh % 4], spot = R.loot[(hsh >>> 4) % R.loot.length];
      const m = makePickup(kind); m.scale.setScalar(0.6); m.position.copy(spot); this.scene.add(m);
      this.pickups.push({ mesh: m, kind, fixed: false, t: 0, respawn: 0, flat: d.id, room: true, baseY: spot.y + 0.2, cash: 40 + (hsh >>> 8) % 161 });
    }
    this.hud.toast(d.hotelFloor ? `${d.hotelFloor >= 7 ? 'KING SUITE' : 'HOTEL ROOM'} ${d.hotelFloor}${String(1 + (d.id >> 4) % 20).padStart(2, '0')}` : `${{ penthouse: 'PENTHOUSE', loft: 'LOFT', gamer: 'FLAT' }[R.type] || 'FLAT'} ${1 + d.id % 40}${'ABCD'[d.id % 4]}`);
  }
  // is the crosshair on a person standing at pos?
  _aimAt(pos, r, y0, y1) {
    const cam = this.camera; cam.getWorldDirection(tmp2);
    tmp.subVectors(pos, cam.position); const t = tmp.dot(tmp2);
    if (t < 0.5 || t > 14) return false;
    const px = cam.position.x + tmp2.x * t - pos.x, pz = cam.position.z + tmp2.z * t - pos.z, py = cam.position.y + tmp2.y * t - pos.y;
    return px * px + pz * pz < r * r && py > y0 && py < y1;
  }
  updateInterior(dt) {
    const I = this.interior, R = I.room, p = this.player;
    if (I.home) this.home.updateInside(dt);
    const near = (q, r) => q && Math.hypot(p.pos.x - q.x, p.pos.z - q.z) < r;
    const lines = [];
    if (near(R.exit, 1.7)) {
      lines.push('<kbd>E</kbd> Leave');
      if (this.input.pressed('KeyE')) { this.exitDoor(); this.hud.prompt(''); return; }
    }
    if (I.kind === 'shop') this._updateShop(dt, lines, near);
    else if (I.kind === 'hotel') this._updateHotel(dt, lines, near);
    else this._updateFlat(dt, lines, near);
    this.hud.prompt(lines.join(' &nbsp; '));
  }
  _updateShop(dt, lines, near) {
    const I = this.interior, R = I.room, p = this.player, inp = this.input, st = this._shop(I.door);
    const robbed = st.robbedUntil > this.time;
    // "showing the gun": aiming (right mouse) at the clerk, or firing a shot in the shop
    const aimed = inp.mouseRight && this._aimAt(R.clerk, 0.6, 0.3, 2.0);
    const fired = this.time - this._firedT < 1e-6;
    if (!robbed && (aimed || fired)) {
      if (I.mood !== 'scared') { I.mood = 'scared'; this.hud.toast('HANDS UP! KEEP AIMING…'); this.audio.play('yell'); }
      I.calmT = 0;
      I.rob = Math.min(1, I.rob + dt / 2.5 + (fired ? 0.3 : 0));
      if (I.rob >= 1) this._payout();
    } else if (I.mood === 'scared') {
      I.calmT += dt; I.rob = Math.max(0, I.rob - dt * 0.1);
      if (I.calmT > 5) { I.mood = 'idle'; I.rob = 0; this.hud.toast('THE CLERK CALMED DOWN'); }
    }
    this.hud.robBar(I.mood === 'scared' ? I.rob : -1);
    // the clerk watches you; hands up while scared and after handing over the money
    const h = I.clerk, want = yawOf(p.pos.x - R.clerk.x, p.pos.z - R.clerk.z);
    h.root.rotation.y += angDiff(h.root.rotation.y, want) * Math.min(1, dt * 4);
    h.animate(dt, 0, { handsUp: I.mood === 'scared' || I.mood === 'robbed' });
    if (near(R.counter, 1.9)) {
      if (robbed) lines.push('“Take it and go!”');
      else if (R.props.sells) {
        if (R.props.guns) { lines.push('<kbd>E</kbd> Look at the guns'); if (inp.pressed('KeyE') && this.onGunShop) this.onGunShop(); }
        if (R.props.cyber) { lines.push('<kbd>E</kbd> See the implants'); if (inp.pressed('KeyE') && this.onClinic) this.onClinic(); }
        lines.push(`<kbd>B</kbd> Ammo $${PRICES.ammo}`, `<kbd>H</kbd> Medkit $${PRICES.medkit}`);
        if (inp.pressed('KeyB')) this._buy('ammo');
        if (inp.pressed('KeyH')) this._buy('medkit');
      }
    }
    if (!robbed && I.mood === 'idle') lines.push(R.props.teller ? '<kbd>Right mouse</kbd> aim at the teller to rob the bank' : '<kbd>Right mouse</kbd> aim at the clerk to rob the shop');
  }
  _payout() {
    const I = this.interior, R = I.room, st = this._shop(I.door);
    const lo = R.props.payout_min || 150, hi = R.props.payout_max || 500;
    const amount = Math.round((lo + Math.random() * (hi - lo)) / 10) * 10;
    st.robbedUntil = this.time + 240; I.mood = 'robbed'; I.rob = 0;
    this.crime(R.props.stars || 2, R.props.teller ? 'BANK ROBBED · WANTED LEVEL UP' : 'SHOP ROBBED · WANTED LEVEL UP');
    this.hud.toast(`${R.props.teller ? 'THE TELLER' : 'THE CLERK'} GAVE YOU $${amount} · GRAB THE BAG!`);
    this.audio.play('alarm');
    // the money bag lands on the counter: walk up to it to take it
    const m = makePickup('cash'); m.scale.setScalar(0.6); m.position.copy(R.cash); this.scene.add(m);
    this.pickups.push({ mesh: m, kind: 'cash', fixed: false, t: 0, respawn: 0, room: true, baseY: R.cash.y + 0.12, cash: amount });
  }
  _buy(what) {
    const price = PRICES[what], p = this.player;
    if (this.cash < price) { this.hud.toast('NOT ENOUGH CASH'); this.audio.play('empty'); return; }
    if (what === 'ammo') {
      if (p.ammo.every((a, j) => a.res >= WEAPONS[j].reserve * 2)) { this.hud.toast('AMMO FULL'); return; }
      p.ammo.forEach((a, j) => { a.res = Math.min(WEAPONS[j].reserve * 2, a.res + WEAPONS[j].reserve); });
    } else {
      if (p.health >= 100 && p.shield >= 100) { this.hud.toast('YOU ARE ALREADY HEALTHY'); return; }
      p.health = 100; p.shield = 100;
    }
    this.cash -= price;
    this.audio.play('cash');
    this.hud.toast(what === 'ammo' ? `+ AMMO · -$${price}` : `+ HEALTH · -$${price}`);
  }
  _updateFlat(dt, lines, near) {
    const R = this.interior.room;
    if (near(R.bed, 2.0)) {
      lines.push('<kbd>E</kbd> Sleep: save the game and heal');
      if (this.input.pressed('KeyE')) this._sleep();
    }
  }
  _sleep() {
    const p = this.player;
    p.health = 100; p.shield = 100;
    if (this.stars) { this.wanted = 0; this.evadeT = 0; this._calmPolice(); }
    this.hud.fade(1.4);
    this.audio.play('sleep');
    const saved = this.onSave ? this.onSave() : false;
    this.hud.toast(saved ? 'GOOD MORNING · GAME SAVED' : 'GOOD MORNING');
  }

  // ---------- vehicles: enter / exit ----------
  nearestVehicle(maxD) {
    let best = null, bd = maxD; const p = this.player.pos;
    for (const v of this.vehicles) {
      if (v.mode === 'wreck' || v.mode === 'sky') continue;
      const d = Math.hypot(v.pos.x - p.x, v.pos.z - p.z);
      if (d < bd && Math.abs(v.pos.y - p.y) < 3) { bd = d; best = v; }
    }
    return best;
  }
  enterVehicle(v) {
    const p = this.player;
    const right = new V3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    if (v.escape && v.escape.onStolen) v.escape.onStolen(v); // a bounty's getaway car: the boss jumps out
    if (v.hasDriver) {
      // throw the driver out
      const d = new Person(this, v.def.police ? 'cop' : 'ped');
      if (d.gun) { d.h.holdGun(null); d.gun = null; }
      d.pos.copy(v.pos).addScaledVector(right, -1.5); d.pos.y = v.pos.y + 0.4;
      d.vel.copy(right).multiplyScalar(-5.5).add(new V3(rand(-1, 1), 4.5, rand(-1, 1)));
      d.state = 'tumble'; d.t = 0; d.spin = rand(6, 10) * (Math.random() < 0.5 ? -1 : 1);
      this.runners.push(d);
      this.audio.play('yell', 0);
      this.crime(v.def.police ? 1.3 : 1, v.def.police ? 'POLICE CAR STOLEN' : 'CAR JACKED · WANTED LEVEL UP');
      v.hasDriver = false;
    }
    this.audio.play('door');
    p.vehicle = v; v.mode = 'player'; v.lane = null;
    applyToCar(this, v);
    p.h.root.visible = false; p.reloadT = 0;
    if (v.def.bike) { // you sit on a motorbike, so you stay visible
      const seat = v.mesh.userData.seat || new V3(0, 0.9, 0.3);
      p.h.holdGun(null); v.body.add(p.h.root);
      p.h.root.position.set(seat.x, seat.y - 0.93, seat.z); p.h.root.rotation.set(0, 0, 0); p.h.root.visible = true;
    }
    p.cannon = 100;
    this.camState.init = false; this.camState.yawOff = 0; this.camState.pitchOff = 0;
    this.hud.toast(v.def.name);
    if (this.objective === 1 && !v.flying) this._completeObjective();
    if (this.objective === 2 && v.flying) this._completeObjective();
  }
  exitVehicle(force) {
    const p = this.player, v = p.vehicle; if (!v) return;
    const right = new V3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    let pos = v.pos.clone().addScaledVector(right, -2.2);
    let c = this.city.collide(pos.x, pos.z, 0.5, 0, 1.8);
    if (c.hit) { pos = v.pos.clone().addScaledVector(right, 2.2); c = this.city.collide(pos.x, pos.z, 0.5, 0, 1.8); }
    p.pos.set(c.x, Math.max(0, v.pos.y - 0.6), c.z);
    p.pos.y = Math.max(p.pos.y, this.city.groundAt(p.pos.x, p.pos.z, p.pos.y + 1));
    p.vy = 0; p.yaw = v.yaw;
    p.vehicle = null; p.pendingExit = false;
    if (v.mode !== 'wreck') { v.mode = 'abandoned'; v.speed *= force ? 1 : 0.3; }
    if (p.h.root.parent !== this.scene) { this.scene.add(p.h.root); p.h.root.rotation.set(0, 0, 0); this.selectWeapon(p.wi, true); }
    p.h.root.visible = true;
    this.audio.play('door');
    this.audio.setEngine(false, 0, false);
    this.camState.init = false;
  }

  // ---------- main update ----------
  update(dt) {
    if (!this.active) return;
    this.time += dt;
    // the clock: 24 game hours in 20 minutes
    const mode = this.settings.daytime || 'cycle', before = this.clock;
    if (mode === 'day') this.clock = 13; else if (mode === 'night') this.clock = 22;
    else this.clock = (this.clock + dt * 24 / DAY_LENGTH) % 24;
    if (mode === 'cycle' && before > 23.5 && this.clock < 0.5) this.prog.medal('night');
    if (mode === 'cycle' && before < 6.5 && this.clock >= 6.5) this.prog.medal('sunrise');
    const p = this.player, inp = this.input;
    flashSirens(this.time);
    if (!p.alive) {
      p.deadT -= dt;
      p.h.root.rotation.x = Math.max(-Math.PI / 2, p.h.root.rotation.x - dt * 4);
      if (p.deadT <= 0) this.respawn();
    } else if (p.vehicle) this.updateDriving(dt);
    else this.updateOnFoot(dt);

    // actions
    if (p.alive && inp.pressed('KeyF')) {
      if (p.vehicle) {
        const v = p.vehicle;
        const alt = v.pos.y - this.city.groundAt(v.pos.x, v.pos.z, v.pos.y);
        if ((v.flying && alt > 3) || Math.abs(v.speed) > 8) { p.pendingExit = true; this.hud.toast(v.flying && alt > 3 ? 'LANDING…' : 'STOPPING…'); }
        else this.exitVehicle();
      } else {
        const v = this.nearestVehicle(4.2);
        if (v) this.enterVehicle(v);
      }
    }

    this.ch.update(dt);
    this.story.update(dt);
    this.events.update(dt);
    this.buddy.update(dt);
    this.home.updateGarage();
    if (this.city.hwTraffic) this.city.hwTraffic.update(dt, this);
    this.updateVehicles(dt);
    this.updatePeople(dt);
    this.ai.update(dt);
    this.slide.update(dt, this);
    this.gps.update(dt);
    this.acts.update(dt);
    this.prog.update(dt);
    this.updateDrones(dt);
    this.updateBolts(dt);
    this.updatePolice(dt);
    this.updatePickups(dt);
    this.updateCamera(dt);
    this.fx.update(dt);

    if (this._objTimer > 0) { this._objTimer -= dt; if (this._objTimer <= 0) this._startObjective(this._objNext); }
    const t = this.objTarget;
    this.beam.visible = !!t && this.stars === 0;
    if (t) { this.beam.position.set(t.x, 0, t.z); this.beam.material.opacity = 0.16 + Math.sin(this.time * 4) * 0.06; }
    // audio
    let sir = 0;
    for (const v of this.vehicles) if (v.mode === 'police' || v.mode === 'policeAir') sir = Math.max(sir, 1 - v.pos.distanceTo(this.camera.position) / 150);
    this.audio.setSiren(Math.max(0, sir), dt);
  }

  updateOnFoot(dt) {
    const p = this.player, inp = this.input, s = this.settings;
    // look (slower while zoomed in)
    const zs = Math.min(1, this.camera.fov / 70);
    p.yaw -= inp.dx * 0.0022 * s.sensitivity * zs;
    p.pitch -= inp.dy * 0.0022 * s.sensitivity * zs * (s.invertY ? -1 : 1);
    p.recoil = (p.recoil || 0) * Math.exp(-dt * 10);
    p.pitch = clamp(p.pitch + (p.recoil || 0) * dt * 8, -1.2, 1.25);
    // move
    let mx = 0, mz = 0;
    if (!this.acts.hack.on) {
    if (inp.down('KeyW')) mz -= 1; if (inp.down('KeyS')) mz += 1;
    if (inp.down('KeyA')) mx -= 1; if (inp.down('KeyD')) mx += 1;
    }
    const sprint = inp.down('ShiftLeft') || inp.down('ShiftRight');
    // grappling hook and wall-running take over the movement while they're on
    const mv = this.moves.update(dt, mx, mz, sprint);
    if (!mv) {
      const len = Math.hypot(mx, mz) || 1;
      const sp = (sprint && mz < 0 ? 8.5 : 4.6) * (inp.mouseRight ? 0.6 : 1) * (1 + 0.1 * this.prog.rank('runner'));
      const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
      const wx = (mx * cy + mz * sy) / len * sp, wz = (-mx * sy + mz * cy) / len * sp;
      const k = 1 - Math.exp(-dt * (p.onGround ? 14 : this.moves.fling > 0 ? 0.8 : 3));
      const keep = this.moves.fling > 0 && !(mx || mz); // flying off the rope or a wall: keep going
      if (!keep) { p.vel.x += (wx * (mx || mz ? 1 : 0) - p.vel.x) * k; p.vel.z += (wz * (mx || mz ? 1 : 0) - p.vel.z) * k; }
      p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
    }
    // jump / gravity
    const g = this.city.groundAt(p.pos.x, p.pos.z, p.pos.y);
    if (!mv) {
      if (p.onGround) p.dj = false;
      if (p.onGround && inp.pressed('Space')) { p.vy = 7.5; p.onGround = false; }
      else if (!p.onGround && !p.dj && inp.pressed('Space') && this.implants.has('leap')) { p.vy = 8.5; p.dj = true; this.audio.play('switch'); } // LEAP SPRINGS
      p.vy -= 22 * dt; p.pos.y += p.vy * dt;
    }
    if (p.pos.y <= g) { p.pos.y = g; p.vy = 0; p.onGround = true; } else if (p.pos.y > g + 0.05) p.onGround = false;
    // collisions
    const c = this.city.collide(p.pos.x, p.pos.z, 0.45, p.pos.y + 0.3, p.pos.y + 1.8);
    p.pos.x = c.x; p.pos.z = c.z;
    if (p.pos.y < 6) { const pc = this.city.pushPoles(p.pos.x, p.pos.z, 0.4); p.pos.x = pc.x; p.pos.z = pc.z; }
    // bump into pedestrians instead of walking through them
    for (const e of this.peds) {
      if (e.state === 'dead') continue;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.64 && d2 > 1e-6 && Math.abs(e.pos.y - p.pos.y) < 1.5) { const d = Math.sqrt(d2); p.pos.x = e.pos.x + dx / d * 0.8; p.pos.z = e.pos.z + dz / d * 0.8; }
    }
    for (const v of this.vehicles) {
      if (v.mode === 'sky') continue;
      if (Math.abs(v.pos.y - p.pos.y) > 2.5) continue;
      const f = v.fwd;
      for (const o of [-1.3, 1.3]) {
        const cx = v.pos.x + f.x * o, cz = v.pos.z + f.z * o;
        const dx = p.pos.x - cx, dz = p.pos.z - cz, d = Math.hypot(dx, dz), r = 1.55;
        if (d < r && d > 1e-4) { p.pos.x = cx + dx / d * r; p.pos.z = cz + dz / d * r; }
      }
    }
    if (!this.interior) { p.pos.x = clamp(p.pos.x, -BOUNDS, BOUNDS); p.pos.z = clamp(p.pos.z, -BOUNDS, BOUNDS); }
    if (p.pos.y < 0) p.pos.y = 0;
    // weapons
    if (!this.liftOpen) for (let k = 0; k < WEAPONS.length; k++) if (inp.pressed('Digit' + (k + 1))) this.selectWeapon(k);
    if (inp.wheel) this.cycleWeapon(inp.wheel > 0 ? 1 : -1);
    if (inp.pressed('KeyR')) this.reload();
    this.firePlayer(dt);
    // shield regen
    p.shieldDelay -= dt;
    if (p.shieldDelay <= 0) p.shield = Math.min(100, p.shield + dt * 15);
    // model
    const h = p.h;
    h.root.position.copy(p.pos);
    h.root.rotation.y = p.yaw;
    if (p.fists) {
      const k = Math.max(0, p.punchT || 0) / 0.32, ext = Math.sin(Math.min(1, 1 - k) * Math.PI);
      h.animate(dt, Math.hypot(p.vel.x, p.vel.z), { fists: true, air: !p.onGround, punchR: p.punchSide ? ext : 0, punchL: p.punchSide ? 0 : ext });
    } else h.animate(dt, Math.hypot(p.vel.x, p.vel.z), { aim: p.pitch * 0.85, air: !p.onGround && this.moves.mode !== 'wall' });
    h.root.rotation.z = this.moves.mode === 'wall' ? this.moves.wallSide * -0.35 : h.root.rotation.z * 0.8;
    // prompts: cars, street doors, things inside rooms
    if (this.interior) { this.updateInterior(dt); return; }
    const tk = this.ai.takedownTarget(), fr = tk ? '' : this.ai.friendPrompt();
    const nv = this.nearestVehicle(4.2), door = p.onGround && !tk && !fr ? this.city.doorNear(p.pos.x, p.pos.z, 2.1) : null;
    const lines = [];
    if (tk) { lines.push('<kbd>E</kbd> Takedown (quiet knock-out)'); if (this.input.pressed('KeyE')) { this.ai.takedown(tk); this.hud.prompt(''); return; } }
    if (fr) lines.push(fr);
    if (door) lines.push(`<kbd>E</kbd> ${door.isHome ? 'Go home' : door.kind === 'shop' ? 'Go into ' + door.name : 'Go into the flat'}`);
    if (nv) lines.push(`<kbd>F</kbd> ${nv.hasDriver ? 'Jack' : 'Enter'} ${nv.def.name}`);
    const cp = !door && !tk && !fr && this.ch.prompt(); if (cp) lines.push(cp);
    const ap = !door && !tk && !fr && !cp && this.acts.prompt(); if (ap) lines.push(ap);
    this.hud.prompt(lines.join(' &nbsp; '));
    if (door && this.input.pressed('KeyE')) this.enterDoor(door);
  }

  // top speed: SPEED DEMON skill, engine upgrade and nitro
  topSpeed(v) { return v.def.maxSpeed * (1 + 0.07 * this.prog.rank('driver')) * (1 + 0.1 * ((this.upg && this.upg.engine) || 0)) * (v.nitro > 0 ? 1.35 : 1); }
  updateDriving(dt) {
    const p = this.player, v = p.vehicle, inp = this.input;
    // NITRO: Shift in a car or on a bike, N in a flying car
    p.nitro = Math.min(100, (p.nitro ?? 100) + dt * 12);
    const boost = this.upg.nitro && p.nitro > 2 && (inp.down('KeyN') || (!v.flying && (inp.down('ShiftLeft') || inp.down('ShiftRight'))));
    v.nitro = boost ? 0.1 : 0;
    if (boost) { p.nitro -= dt * 34; v.speed += v.def.accel * dt * 1.2; if (Math.random() < dt * 30) this.fx.sparks(v.pos.clone().addScaledVector(v.fwd, -2.6).setY(v.pos.y + 0.5), 0x29f3ff, 2, 2); }
    this.hud.prompt(this.ch.prompt() || '');
    const def = v.def;
    let thr = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
    let steer = (inp.down('KeyA') ? 1 : 0) - (inp.down('KeyD') ? 1 : 0);
    if (p.pendingExit) { thr = 0; steer = 0; }
    const f = v.fwd.clone();
    const prevSpeed = v.speed;
    if (!v.flying) {
      const hb = inp.down('Space');
      if (thr > 0) v.speed += def.accel * dt * (v.speed < 0 ? 2.5 : 1);
      else if (thr < 0) v.speed -= (v.speed > 0 ? 30 : def.accel * 0.6) * dt;
      else v.speed *= Math.exp(-dt * 0.5);
      if (p.pendingExit || hb) v.speed *= Math.exp(-dt * (hb ? 1.6 : 3));
      v.speed = clamp(v.speed, -14, this.topSpeed(v));
      const maxSteer = (def.bike ? 0.7 : 0.55) / (1 + Math.abs(v.speed) / (def.bike ? 32 : 25));
      v.steer += (steer * maxSteer - v.steer) * (1 - Math.exp(-dt * 8));
      v.yaw += v.speed / 2.8 * Math.tan(v.steer) * dt * (hb ? 1.7 : 1);
      v.pos.addScaledVector(f, v.speed * dt);
      v.roll += (-v.steer * Math.min(1, Math.abs(v.speed) / 30) * (def.bike ? 1.1 : 0.12) - v.roll) * (1 - Math.exp(-dt * 6));
      if (def.bike) p.h.animate(dt, 0, { ride: v.type === 'bike' ? 'sport' : 'chopper' });
      v.pitch += (clamp((prevSpeed - v.speed) / dt * 0.004, -0.06, 0.06) - v.pitch) * (1 - Math.exp(-dt * 6));
      this._groundY(v, dt, true);
      this._vehCollide(v, dt, true);
      if (p.pendingExit && Math.abs(v.speed) < 2) this.exitVehicle();
      this.audio.setEngine(true, Math.abs(v.speed) / def.maxSpeed, false);
    } else {
      let up = (inp.down('Space') ? 1 : 0) - (inp.down('ShiftLeft') || inp.down('ShiftRight') ? 1 : 0);
      const gnd = this.city.groundAt(v.pos.x, v.pos.z, v.pos.y) + 0.7;
      if (p.pendingExit) { up = -1; thr = 0; }
      if (thr > 0) v.speed += def.accel * dt; else if (thr < 0) v.speed -= def.accel * 1.4 * dt; else v.speed *= Math.exp(-dt * 0.6);
      v.speed = clamp(v.speed, -20, this.topSpeed(v));
      v.steer += (steer - v.steer) * (1 - Math.exp(-dt * 5));
      v.yaw += v.steer * 1.5 * dt;
      v.vel.y += (up * 20 - v.vel.y) * (1 - Math.exp(-dt * 3));
      v.pos.addScaledVector(f, v.speed * dt);
      v.pos.y += v.vel.y * dt;
      if (v.pos.y < gnd) { v.pos.y = gnd; v.vel.y = Math.max(0, v.vel.y); }
      v.pos.y = Math.min(v.pos.y, 420);
      v.bob += dt * 3;
      v.roll += (-v.steer * 0.35 * Math.min(1, Math.abs(v.speed) / 20 + 0.2) - v.roll) * (1 - Math.exp(-dt * 4));
      v.pitch += (clamp(-v.vel.y * 0.012 + (v.speed - prevSpeed) / dt * -0.004, -0.25, 0.25) - v.pitch) * (1 - Math.exp(-dt * 4));
      this._vehCollide(v, dt, true);
      if (p.pendingExit && v.pos.y - gnd < 0.5) { v.speed = 0; this.exitVehicle(); }
      this.audio.setEngine(true, Math.abs(v.speed) / def.maxSpeed, true);
    }
    v.pos.x = clamp(v.pos.x, -BOUNDS - 60, BOUNDS + 60); v.pos.z = clamp(v.pos.z, -BOUNDS - 60, BOUNDS + 60);
    if (!v.flying) { v.pos.x = clamp(v.pos.x, -BOUNDS, BOUNDS); v.pos.z = clamp(v.pos.z, -BOUNDS, BOUNDS); }
    if (p.vehicle === v) {
      v.sync();
      if (def.cannon) this.fireCannon(dt);
      p.pos.copy(v.pos);
      p.shieldDelay -= dt; if (p.shieldDelay <= 0) p.shield = Math.min(100, p.shield + dt * 15);
      if (p.vehicle && inp.wheel) { /* ignore */ }
      // run over people
      if (Math.abs(v.speed) > 5) for (const e of this.peds) {
        if (e.state === 'dead' || e.state === 'gone') continue;
        if (Math.abs(e.pos.y - v.pos.y) < 2 && Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z) < 2.2) {
          this.damagePerson(e, 100, f.clone().multiplyScalar(v.speed)); e.vel.copy(f).multiplyScalar(Math.abs(v.speed) * 0.5); e.vel.y = 5;
        }
      }
      for (const f of this.ai.friends) if (f.alive && f.state !== 'car' && Math.abs(v.speed) > 5 && Math.abs(f.pos.y - v.pos.y) < 2 && Math.hypot(f.pos.x - v.pos.x, f.pos.z - v.pos.z) < 2.2) f.hurt(100);
      for (const e of [...this.cops, ...this.gang]) {
        if (e.state === 'dead' || e.ride) continue;
        if (Math.abs(v.speed) > 5 && Math.abs(e.pos.y - v.pos.y) < 2 && Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z) < 2.2) { this.damagePerson(e, 100, f.clone().multiplyScalar(v.speed)); e.vel.copy(f).multiplyScalar(Math.abs(v.speed) * 0.5); e.vel.y = 5; }
      }
      // objective: skylane gate
      if (this.objective === 3 && v.flying && this.objTarget && v.pos.distanceTo(this.objTarget) < 18) this._completeObjective();
    }
  }

  // ground cars follow the ground (ramps, highway decks) and fall when they drive off an edge
  _groundY(v, dt, isPlayer) {
    const g = this.city.groundAt(v.pos.x, v.pos.z, v.pos.y);
    if (v.pos.y > g + 0.05) {
      v.vel.y -= 25 * dt; v.pos.y += v.vel.y * dt;
      if (v.pos.y <= g) {
        if (isPlayer && v.vel.y < -9) { this.audio.play('crash'); this.hud.kick(10); this.damageVehicle(v, Math.min(v.maxHealth * 0.25, -v.vel.y * 1.5), false); }
        v.pos.y = g; v.vel.y = 0;
      }
    } else { v.pos.y = g; v.vel.y = 0; }
  }
  _vehCollide(v, dt, isPlayer) {
    const f = v.fwd;
    const y0 = v.pos.y + 0.3, y1 = v.pos.y + 1.5;
    let hit = false, cx = 0, cz = 0;
    const bike = v.def.bike;
    for (const o of bike ? [-0.7, 0.7] : [-1.3, 1.3]) {
      const x = v.pos.x + f.x * o, z = v.pos.z + f.z * o;
      const c = this.city.collide(x, z, bike ? 0.55 : 1.15, y0, y1);
      if (c.hit) { hit = true; cx += c.x - x; cz += c.z - z; }
      if (v.pos.y < 6.5) { // lamp poles
        const pc = this.city.pushPoles(x, z, 1.0);
        if (pc.hit) { hit = true; cx += pc.x - x; cz += pc.z - z; }
      }
    }
    if (hit) {
      v.pos.x += cx; v.pos.z += cz;
      const impact = Math.abs(v.speed);
      if (impact > 6) {
        if (isPlayer) { this.audio.play('crash'); this.hud.kick(impact * 0.6); }
        // kid-friendly crashes: a hard hit costs at most 30% of the car's armor
        this.damageVehicle(v, Math.min(v.maxHealth * 0.3, Math.max(0, impact - 10) * 0.6), false);
        this.fx.sparks(v.pos.clone().addScaledVector(f, 2).setY(v.pos.y + 0.6), 0xffa43a, 10, 6);
      }
      v.speed *= v.flying ? 0.5 : 0.35;
    }
    // vehicle vs vehicle
    for (const o of this.vehicles) {
      if (o === v || o.mode === 'sky' && Math.abs(o.pos.y - v.pos.y) > 4) continue;
      if (Math.abs(o.pos.y - v.pos.y) > 2.5) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z, d = Math.hypot(dx, dz), R = (v.def.bike || o.def.bike) ? 2.7 : 3.6;
      if (d < R && d > 1e-3) {
        const push = (R - d) / d * 0.5;
        v.pos.x -= dx * push; v.pos.z -= dz * push;
        if (o.mode !== 'sky') { o.pos.x += dx * push; o.pos.z += dz * push; }
        const impact = Math.abs(v.speed - o.speed * f.dot(o.fwd));
        if (impact > 5 && isPlayer) {
          this.audio.play('crash'); this.damageVehicle(v, impact * 0.6, false); this.damageVehicle(o, impact * 0.8, true);
          if (o.mode === 'traffic') { o.mode = 'flee'; o.fleeT = 6; }
        }
        v.speed *= 0.6;
      }
    }
  }

  updateVehicles(dt) {
    const p = this.player, pp = this.wpos();
    const crowd = this.settings.crowd;
    const wantTraffic = [0, 13, 22, 32][crowd], wantSky = [0, 10, 18, 28][crowd];
    let nT = 0, nS = 0;
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const d = Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z);
      if (v.mode === 'traffic' || v.mode === 'flee') nT++;
      if (v.mode === 'sky') nS++;
      // despawn far vehicles (not parked set pieces)
      const far = v.mode === 'sky' ? 480 : 300;
      if (v !== p.vehicle && !v.home && !v.owned && !v.keep && d > far && v.mode !== 'parked') { v.dispose(); this.vehicles.splice(i, 1); continue; }
      if (v.home && d > 300 && v.mode !== 'parked' && v !== p.vehicle) { // reset pad cars when far away
        v.dispose(); this.vehicles.splice(i, 1);
        const nv = this._addVehicle(v.type, v.home.x, v.home.z, Math.random() * 6, 'parked'); nv.pos.y = 1.0; nv.home = v.home;
        continue;
      }
      if (v === p.vehicle) continue;
      v.mesh.visible = d < this.settings.viewDist + 50;
      switch (v.mode) {
        case 'traffic': case 'flee':
          this._trafficAI(v, dt, false);
          if (v.remove) { v.dispose(); this.vehicles.splice(i, 1); continue; }
          break;
        case 'police': this._policeAI(v, dt); if (!v.flying) this._groundY(v, dt); break;
        case 'escape': this._trafficAI(v, dt, false); this._vehCollide(v, dt, false); this._groundY(v, dt); if (v.escape && v.escape.update) v.escape.update(v, dt); break;
        case 'policeAir': this._policeAirAI(v, dt); break;
        case 'sky': this._skyAI(v, dt); break;
        case 'parked': case 'abandoned':
          v.speed *= Math.exp(-dt * 2);
          if (Math.abs(v.speed) > 0.1) { v.pos.addScaledVector(v.fwd, v.speed * dt); this._vehCollide(v, dt, false); }
          if (!v.flying) this._groundY(v, dt);
          if (v.flying) { v.bob += dt * 2; const g = this.city.groundAt(v.pos.x, v.pos.z, v.pos.y + 1) + 0.7; v.pos.y += (g - v.pos.y) * (1 - Math.exp(-dt * 2)); }
          v.roll *= 0.9; v.pitch *= 0.9;
          break;
        case 'wreck':
          v.wreckT -= dt;
          if (v.falling) { v.vel.y -= 20 * dt; v.pos.y += v.vel.y * dt; v.pos.addScaledVector(v.fwd, v.speed * dt); const g = this.city.groundAt(v.pos.x, v.pos.z, v.pos.y); if (v.pos.y <= g) { v.pos.y = g; v.falling = false; this.fx.explosion(v.pos.clone()); } }
          if (Math.random() < dt * 8) this.fx.sparks(v.pos.clone().setY(v.pos.y + 1.2), 0xff6a1a, 2, 2);
          if (v.wreckT <= 0 && d > 40) { v.dispose(); this.vehicles.splice(i, 1); continue; }
          break;
      }
      v.sync();
    }
    // spawn
    if (nT < wantTraffic && Math.random() < 0.3) this._spawnTraffic(pp.x, pp.z);
    if (nS < wantSky && Math.random() < 0.3) this._spawnSky(pp.x, pp.z);
  }

  _obstacleAhead(v, range) {
    const f = v.fwd, p = this.player;
    const check = (pos, r) => {
      const dx = pos.x - v.pos.x, dz = pos.z - v.pos.z;
      const a = dx * f.x + dz * f.z; if (a < 0 || a > range) return false;
      const lat = Math.abs(dx * f.z - dz * f.x);
      return lat < r;
    };
    if (p.alive && !p.vehicle && check(p.pos, 2.0)) return 'player';
    for (const o of this.vehicles) {
      if (o === v || o.mode === 'sky' || Math.abs(o.pos.y - v.pos.y) > 3) continue;
      if (check(o.pos, 2.4)) return o === p.vehicle ? 'player' : 'car';
    }
    for (const e of this.peds) if (e.state !== 'dead' && e.pos.y < 1 && check(e.pos, 1.6)) return 'ped';
    return false;
  }

  _trafficAI(v, dt, police) {
    const [dx, dz] = DIRS[v.h];
    const along = (v.target.x - v.pos.x) * dx + (v.target.z - v.pos.z) * dz;
    if (along < 5) {
      // choose next heading at intersection
      const opts = [];
      for (const [h, w] of [[v.h, 3], [(v.h + 1) % 4, 1], [(v.h + 3) % 4, 1]]) {
        const ni = v.ti + DIRS[h][0], nj = v.tj + DIRS[h][1];
        if (ni < 0 || ni > N || nj < 0 || nj > N) continue;
        if (this.city.segBlocked(v.ti, v.tj, ni, nj)) continue;
        let weight = w;
        if (police || v.mode === 'escape') { // police head toward the player, getaway cars away from them
          const tp = this.wpos();
          const dNow = Math.hypot(roadC(v.ti) - tp.x, roadC(v.tj) - tp.z), dNext = Math.hypot(roadC(ni) - tp.x, roadC(nj) - tp.z);
          weight = (dNext < dNow) === !!police ? 10 : 0.5;
        }
        opts.push([h, weight]);
      }
      if (!opts.length) { const h = (v.h + 2) % 4; opts.push([h, 1]); }
      let tot = opts.reduce((a, o) => a + o[1], 0), r = Math.random() * tot, pick = opts[0][0];
      for (const [h, w] of opts) { r -= w; if (r <= 0) { pick = h; break; } }
      v.h = pick; v.ti += DIRS[pick][0]; v.tj += DIRS[pick][1];
      if (v.ti < 0 || v.ti > N || v.tj < 0 || v.tj > N) { v.ti = clamp(v.ti, 0, N); v.tj = clamp(v.tj, 0, N); }
      this._laneTarget(v);
    }
    const [hx, hz] = DIRS[v.h];
    const al = (v.target.x - v.pos.x) * hx + (v.target.z - v.pos.z) * hz;
    const look = Math.max(0, al - 14);
    const lx = v.target.x - hx * look, lz = v.target.z - hz * look;
    const desired = yawOf(lx - v.pos.x, lz - v.pos.z);
    const diff = angDiff(v.yaw, desired);
    v.yaw += clamp(diff, -1, 1) * Math.min(1, dt * 3.5);
    let cruise = police ? 30 : v.mode === 'escape' ? 29 : (v.mode === 'flee' ? 26 : 13);
    if (Math.abs(diff) > 0.35) cruise = Math.min(cruise, police ? 16 : 8);
    const obs = this._obstacleAhead(v, police ? 10 : 14);
    if (obs && !(police && obs === 'player')) {
      cruise = 0;
      if (obs === 'player' && (v.honkT -= dt) < 0) { v.honkT = 3; }
    }
    // stuck behind a parked/abandoned car for a long time: quietly remove it when the player can't see
    v.waitT = obs === 'car' && v.speed < 1 ? (v.waitT || 0) + dt : 0;
    if (v.waitT > 6 && !police) {
      const c = this.camera.position, dx = v.pos.x - c.x, dz = v.pos.z - c.z;
      this.camera.getWorldDirection(tmp2);
      if (dx * tmp2.x + dz * tmp2.z < 0 || dx * dx + dz * dz > 3600) v.remove = true;
    }
    if (v.mode === 'flee') { v.fleeT -= dt; if (v.fleeT < 0) v.mode = 'traffic'; }
    v.speed += clamp(cruise - v.speed, -25 * dt, 9 * dt);
    v.pos.addScaledVector(v.fwd, v.speed * dt);
    v.roll = -clamp(diff, -0.5, 0.5) * 0.08;
  }

  // put a car that left its lane back onto the road grid
  _resnap(v) {
    const f = v.fwd; let best = 0, bd = -2;
    DIRS.forEach(([dx, dz], h) => { const d = dx * f.x + dz * f.z; if (d > bd) { bd = d; best = h; } });
    v.h = best; const [dx, dz] = DIRS[best];
    const gi = (v.pos.x + HALF) / CELL, gj = (v.pos.z + HALF) / CELL;
    v.ti = clamp(dx > 0 ? Math.ceil(gi + 0.1) : dx < 0 ? Math.floor(gi - 0.1) : Math.round(gi), 0, N);
    v.tj = clamp(dz > 0 ? Math.ceil(gj + 0.1) : dz < 0 ? Math.floor(gj - 0.1) : Math.round(gj), 0, N);
    this._laneTarget(v);
  }

  _skyAI(v, dt) {
    const L = v.lane;
    if (L.axis === 'z') { v.pos.x += (L.c - v.pos.x) * dt; v.pos.z += L.dir * v.speed * dt; if (Math.abs(v.pos.z) > HALF + 150) v.pos.z = -Math.sign(v.pos.z) * (HALF + 140); }
    else { v.pos.z += (L.c - v.pos.z) * dt; v.pos.x += L.dir * v.speed * dt; if (Math.abs(v.pos.x) > HALF + 150) v.pos.x = -Math.sign(v.pos.x) * (HALF + 140); }
    v.pos.y += (L.y - v.pos.y) * dt * 0.5;
    v.bob += dt * 2;
    // the player's car blocks the lane -> slow down
    const pv = this.player.vehicle;
    if (pv && pv.flying && v.pos.distanceTo(pv.pos) < 12) v.speed = Math.max(5, v.speed - dt * 40); else v.speed = Math.min(v.speed + dt * 10, 50);
  }

  _policeAI(v, dt) {
    const p = this.player, tp = this.wpos();
    const d = Math.hypot(tp.x - v.pos.x, tp.z - v.pos.z);
    if (this.stars === 0) { v.mode = 'traffic'; if (v.direct) { v.direct = false; this._resnap(v); } return; }
    if (p.vehicle && p.vehicle.flying && tp.y > 15) {
      // can't follow into the sky: circle below
      this._trafficAI(v, dt, true);
    } else if (d < 45) {
      v.direct = true;
      // direct pursuit
      const desired = yawOf(tp.x - v.pos.x, tp.z - v.pos.z);
      const diff = angDiff(v.yaw, desired);
      v.yaw += clamp(diff, -1, 1) * Math.min(1, dt * 2.5);
      let want = p.vehicle ? 34 : (d < 16 ? 0 : 18);
      if (Math.abs(diff) > 1.2) want = 8;
      v.speed += clamp(want - v.speed, -30 * dt, 12 * dt);
      v.pos.addScaledVector(v.fwd, v.speed * dt);
      this._vehCollide(v, dt, false);
      // cops get out when the player is on foot
      if (!p.vehicle && d < 22 && !v.copsDropped && Math.abs(v.speed) < 4 && this.cops.filter(c => c.state !== 'dead').length < this.stars * 2 + 1) {
        v.copsDropped = true;
        const r = new V3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
        for (const s of [-1, 1]) {
          const c = new Person(this, 'cop'); c.pos.copy(v.pos).addScaledVector(r, s * 2); c.state = 'fight'; c.aggro = true;
          this.cops.push(c);
        }
        v.mode = 'parked'; v.hasDriver = false;
      }
      // shoot from the window at the player's car
      if (p.vehicle && d < 40) {
        v.shootT -= dt;
        if (v.shootT <= 0) { v.shootT = rand(0.9, 1.6); this.enemyShoot(v.pos.clone().setY(v.pos.y + 1.5), tp.clone().setY(tp.y + 0.8), 0.08, 5); }
      }
    } else {
      // route toward player using the road grid
      if (v.direct) { v.direct = false; this._resnap(v); }
      this._trafficAI(v, dt, true);
      this._vehCollide(v, dt, false);
    }
  }

  _policeAirAI(v, dt) {
    const p = this.player, tp = this.wpos();
    if (this.stars === 0) { v.mode = 'sky'; v.lane = this.city.skyLanes[0]; return; }
    const target = tmp.copy(tp); target.y = Math.max(tp.y + 6, 14);
    const to = tmp2.subVectors(target, v.pos); const d = to.length();
    const desired = yawOf(to.x, to.z);
    const diff = angDiff(v.yaw, desired);
    v.yaw += clamp(diff, -1, 1) * Math.min(1, dt * 2);
    const want = d > 40 ? 70 : d > 20 ? 30 : 5;
    v.speed += clamp(want - v.speed, -40 * dt, 20 * dt);
    v.pos.addScaledVector(v.fwd, v.speed * dt);
    // climb over buildings ahead
    const ahead = this.city.roofAt(v.pos.x + v.fwd.x * 25, v.pos.z + v.fwd.z * 25);
    const wantY = Math.max(target.y, ahead + 8);
    v.vel.y += (clamp((wantY - v.pos.y) * 1.2, -20, 25) - v.vel.y) * (1 - Math.exp(-dt * 3));
    v.pos.y += v.vel.y * dt;
    v.pos.y = Math.max(v.pos.y, this.city.groundAt(v.pos.x, v.pos.z, v.pos.y) + 0.8);
    v.bob += dt * 3;
    v.roll = -clamp(diff, -0.6, 0.6) * 0.4;
    this._vehCollide(v, dt, false);
    if (d < 70 && !this.interior) {
      v.shootT -= dt;
      if (v.shootT <= 0) {
        v.shootT = rand(0.8, 1.4);
        const from = v.pos.clone().addScaledVector(v.fwd, 2.5); from.y += 0.5;
        if (this.city.raycast(from, tmp3.subVectors(tp, from).normalize(), d) >= d - 2) this.enemyShoot(from, tp.clone().setY(tp.y + 0.8), 0.06, 6, 0x4aa0ff);
      }
    }
  }

  // ---------- people ----------
  updatePeople(dt) {
    const p = this.player, pp = this.wpos();
    const want = [0, 14, 26, 40][this.settings.crowd];
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const e = this.peds[i];
      const d = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
      if (e.state === 'dead') e.t -= dt;
      if (d > 170 || (e.state === 'dead' && e.t <= 0)) { e.dispose(); this.peds.splice(i, 1); continue; }
      e.root.visible = d < Math.min(150, this.settings.viewDist);
      this._personPhysics(e, dt);
      if (e.state === 'walk' || e.state === 'flee') {
        const spd = e.state === 'flee' ? 5.2 : e.walk;
        e.s += e.dir * spd * dt;
        if (e.state === 'flee') { e.t -= dt; if (e.t <= 0) e.state = 'walk'; }
        const np = this._loopPos(e.bx0, e.bz0, e.s, tmp);
        const dx = np.x - e.pos.x, dz = np.z - e.pos.z;
        if (dx * dx + dz * dz > 1e-6) e.yaw = yawOf(dx, dz);
        e.pos.x = np.x; e.pos.z = np.z;
        e.h.animate(dt, spd, { flail: e.state === 'flee' });
      }
      e.root.position.copy(e.pos); e.root.rotation.y = e.yaw;
    }
    if (this.peds.length < want) this._spawnPed(pp.x, pp.z, this.peds.length < want / 2);

    // runners (thrown-out drivers)
    for (let i = this.runners.length - 1; i >= 0; i--) {
      const e = this.runners[i];
      e.t += dt;
      if (e.state === 'tumble') {
        e.vel.y -= 20 * dt; e.pos.addScaledVector(e.vel, dt);
        e.root.rotation.z += e.spin * dt * 0.5; e.root.rotation.x += e.spin * dt * 0.3;
        const c = this.city.collide(e.pos.x, e.pos.z, 0.4, e.pos.y, e.pos.y + 1.8); e.pos.x = c.x; e.pos.z = c.z;
        const g = this.city.groundAt(e.pos.x, e.pos.z, e.pos.y);
        if (e.pos.y <= g && e.vel.y < 0) { e.pos.y = g; e.state = 'getup'; e.t = 0; e.vel.set(0, 0, 0); }
        e.h.animate(dt, 0, { flail: true });
      } else if (e.state === 'getup') {
        e.root.rotation.x *= 0.8; e.root.rotation.z *= 0.8;
        if (e.t > 0.6) { e.state = 'run'; e.t = 0; e.root.rotation.set(0, e.yaw, 0); }
      } else if (e.state === 'run') {
        const away = tmp.subVectors(e.pos, pp).setY(0); if (away.lengthSq() < 0.01) away.set(1, 0, 0);
        away.normalize();
        e.yaw = yawOf(away.x, away.z);
        e.pos.addScaledVector(away, 6.5 * dt);
        const c = this.city.collide(e.pos.x, e.pos.z, 0.4, 0.2, 1.8); e.pos.x = c.x; e.pos.z = c.z;
        e.pos.y = this.city.groundAt(e.pos.x, e.pos.z, e.pos.y);
        e.h.animate(dt, 6.5, { flail: true });
        e.root.rotation.set(0, e.yaw, 0);
        if (e.t > 14 || Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z) > 90) { e.dispose(); this.runners.splice(i, 1); continue; }
      } else if (e.state === 'dead') { this._personPhysics(e, dt); e.t -= dt; if (e.t <= 0) { e.dispose(); this.runners.splice(i, 1); continue; } }
      e.root.position.copy(e.pos);
      if (e.state === 'run') e.root.rotation.y = e.yaw;
    }

    // cops
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      const d = Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z);
      if (c.state === 'dead') { this._personPhysics(c, dt); c.t -= dt; c.root.position.copy(c.pos); if (c.t <= 0 || d > 160) { c.dispose(); this.cops.splice(i, 1); } continue; }
      if (this.stars === 0 && d > 50) { c.dispose(); this.cops.splice(i, 1); continue; }
      if (d > 200) { c.dispose(); this.cops.splice(i, 1); continue; }
      const tp = pp;
      const to = tmp.subVectors(tp, c.pos).setY(0); const dist = to.length(); to.normalize();
      c.yaw = yawOf(to.x, to.z);
      let mv = 0;
      if (this.stars > 0 || c.aggro) {
        if (dist > 22) mv = 5.5; else if (dist < 9) mv = -2.5;
        c.strafe = c.strafe || (Math.random() < 0.5 ? -1 : 1);
        const r = new V3(-to.z, 0, to.x).multiplyScalar(c.strafe * 1.8);
        c.pos.addScaledVector(to, mv * dt).addScaledVector(r, dt);
        if (Math.random() < dt * 0.3) c.strafe *= -1;
        const col = this.city.collide(c.pos.x, c.pos.z, 0.45, 0.3, 1.8); c.pos.x = col.x; c.pos.z = col.z;
        c.shootT -= dt;
        const eye = c.pos.clone().setY(c.pos.y + 1.5);
        const tgt = tp.clone().setY(tp.y + (p.vehicle ? 0.8 : 1.2));
        if (c.shootT <= 0 && dist < 60 && p.alive && !this.interior) {
          c.shootT = rand(0.8, 1.5);
          const dir = tmp2.subVectors(tgt, eye).normalize();
          if (this.city.raycast(eye, dir, dist) >= dist - 1.5) {
            const muzzle = c.gun ? c.gun.userData.muzzle.getWorldPosition(new V3()) : eye;
            this.enemyShoot(muzzle, tgt, 0.07 + dist * 0.002, 7);
          }
        }
      }
      c.pos.y = this.city.groundAt(c.pos.x, c.pos.z, c.pos.y);
      const pitch = Math.atan2(tp.y + 1.2 - (c.pos.y + 1.5), Math.max(1, dist));
      c.h.animate(dt, Math.abs(mv) + 1.5, { aim: pitch });
      c.root.position.copy(c.pos); c.root.rotation.y = c.yaw;
    }
  }
  _personPhysics(e, dt) {
    if (e.state !== 'dead') return;
    e.fallT = (e.fallT || 0) + dt;
    e.vel.y -= 20 * dt; e.pos.addScaledVector(e.vel, dt);
    const g = this.city.groundAt(e.pos.x, e.pos.z, e.pos.y);
    if (e.pos.y <= g) { e.pos.y = g; e.vel.multiplyScalar(0.5); e.vel.y = 0; }
    const c = this.city.collide(e.pos.x, e.pos.z, 0.4, e.pos.y + 0.1, e.pos.y + 1); e.pos.x = c.x; e.pos.z = c.z;
    e.root.rotation.x = Math.max(-Math.PI / 2, -e.fallT * 5);
    e.h.animate(0, 0, {});
    e.root.position.copy(e.pos);
  }

  updateDrones(dt) {
    const p = this.player, tp = this.wpos();
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      if (d.dead) {
        d.fallV -= 20 * dt; d.pos.y += d.fallV * dt; d.mesh.rotation.x += dt * 4;
        d.mesh.position.copy(d.pos);
        if (d.pos.y < 0.3) { this.fx.explosion(d.pos.clone()); d.dispose(); this.drones.splice(i, 1); }
        continue;
      }
      if (d.police && this.stars === 0) { d.pos.y += dt * 15; d.mesh.position.copy(d.pos); if (d.pos.y > 150) { d.dispose(); this.drones.splice(i, 1); } continue; }
      const dist = Math.hypot(tp.x - d.pos.x, tp.z - d.pos.z);
      const engage = d.police || dist < 70 || this.objective === 4;
      d.ang += dt * 0.5;
      const R = 16;
      const target = engage ? tmp.set(tp.x + Math.cos(d.ang) * R, Math.max(tp.y + 7, 9), tp.z + Math.sin(d.ang) * R)
        : tmp.set(Math.cos(d.ang) * 25 + (d.home?.x || 0), 14, Math.sin(d.ang) * 25 + (d.home?.z || 0));
      const roof = this.city.roofAt(target.x, target.z);
      if (target.y < roof + 4) target.y = roof + 4;
      tmp2.subVectors(target, d.pos);
      const sp = Math.min(engage ? 22 : 8, tmp2.length() * 1.2);
      d.vel.lerp(tmp2.normalize().multiplyScalar(sp), 1 - Math.exp(-dt * 2));
      d.pos.addScaledVector(d.vel, dt);
      if (this.city.inside(d.pos.x, d.pos.y, d.pos.z)) d.pos.y += 25 * dt;
      d.mesh.position.copy(d.pos); d.mesh.position.y += Math.sin(this.time * 3 + i) * 0.2;
      d.mesh.rotation.y = yawOf(tp.x - d.pos.x, tp.z - d.pos.z);
      d.mesh.rotation.z = clamp(-d.vel.x * 0.02, -0.3, 0.3);
      if (engage && p.alive && !this.interior) {
        d.shootT -= dt;
        const dd = d.pos.distanceTo(tp);
        if (d.shootT <= 0 && dd < 60) {
          d.shootT = rand(1.0, 1.8);
          const from = d.pos.clone().add(new V3(0, -0.3, 0));
          const tgt = tp.clone().setY(tp.y + 1.1);
          if (this.city.raycast(from, tmp3.subVectors(tgt, from).normalize(), dd) >= dd - 2) this.enemyShoot(from, tgt, 0.08, d.police ? 6 : 5, d.police ? 0x4aa0ff : 0xff2040);
        }
      }
    }
    if (this.objective === 0 && !this.drones.some(d => d.rogue && !d.dead) && this.objCount < 4) {
      for (let k = this.objCount; k < 4; k++) this.drones.push(new Drone(this, rand(-30, 30), 16, rand(-30, 30), false));
    }
  }

  updatePolice(dt) {
    const p = this.player, tp = this.wpos(), stars = this.stars;
    // evasion: no police unit near for a while -> lose a star
    let seen = false;
    for (const v of this.vehicles) if ((v.mode === 'police' || v.mode === 'policeAir') && v.pos.distanceTo(tp) < 75) seen = true;
    for (const c of this.cops) if (c.state !== 'dead' && c.pos.distanceTo(tp) < 55) seen = true;
    for (const d of this.drones) if (d.police && !d.dead && d.pos.distanceTo(tp) < 60) seen = true;
    this.policeSeen = seen;
    if (stars > 0) {
      if (!seen) {
        this.evadeT += dt;
        if (this.evadeT > 9) { this.evadeT = 0; this.wanted = Math.max(0, stars - 1); this.hud.toast(this.stars ? 'WANTED LEVEL DOWN' : 'YOU LOST THE COPS'); if (!this.stars) this._calmPolice(); }
      } else this.evadeT = Math.max(0, this.evadeT - dt * 2);
    }
    // spawn police units
    if (stars > 0) {
      const ground = this.vehicles.filter(v => v.mode === 'police').length + Math.floor(this.cops.filter(c => c.state !== 'dead').length / 2);
      const air = this.vehicles.filter(v => v.mode === 'policeAir').length;
      const drones = this.drones.filter(d => d.police && !d.dead).length;
      const wantGround = [0, 1, 2, 3, 4, 5][stars], wantAir = stars >= 2 || (p.vehicle?.flying) ? stars - (p.vehicle?.flying ? 0 : 1) : 0, wantDr = stars >= 3 ? stars - 2 : 0;
      this._polT = (this._polT || 0) - dt;
      if (this._polT <= 0) {
        this._polT = 2.5;
        if (ground < wantGround) this._spawnTraffic(tp.x, tp.z, true);
        else if (air < wantAir) {
          const a = Math.random() * 6.28, v = this._addVehicle('flypolice', tp.x + Math.cos(a) * 160, tp.z + Math.sin(a) * 160, 0, 'policeAir');
          v.pos.y = 80; v.speed = 40;
        } else if (drones < wantDr) {
          const a = Math.random() * 6.28; this.drones.push(new Drone(this, tp.x + Math.cos(a) * 80, 40, tp.z + Math.sin(a) * 80, true));
        }
      }
      // cops on foot for high wanted levels
      if (stars >= 2 && !p.vehicle && this.cops.filter(c => c.state !== 'dead').length < stars && Math.random() < dt * 0.3) {
        const ped = { pos: new V3() };
        const a = Math.random() * 6.28; ped.pos.set(tp.x + Math.cos(a) * 45, 0, tp.z + Math.sin(a) * 45);
        const col = this.city.collide(ped.pos.x, ped.pos.z, 0.5, 0.3, 1.8);
        if (!col.hit) { const c = new Person(this, 'cop'); c.pos.set(col.x, 0, col.z); c.aggro = true; this.cops.push(c); }
      }
    }
  }
  _calmPolice() {
    for (const v of this.vehicles) { if (v.mode === 'police') { v.mode = 'traffic'; v.direct = false; this._resnap(v); } if (v.mode === 'policeAir') { v.mode = 'sky'; v.lane = this.city.skyLanes[Math.floor(Math.random() * this.city.skyLanes.length)]; } }
    for (const c of this.cops) c.aggro = false;
  }

  updatePickups(dt) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      if (k.respawn > 0) { k.respawn -= dt; k.mesh.visible = k.respawn <= 0; continue; }
      if (k.carried) continue; // Sparky has it in his mouth
      k.t += dt; k.mesh.rotation.y += dt * 1.5; k.mesh.position.y = (k.baseY ?? 0.6) + Math.sin(k.t * 3) * 0.12;
      if (!p.vehicle && p.alive && Math.hypot(p.pos.x - k.mesh.position.x, p.pos.z - k.mesh.position.z) < 1.6 && Math.abs(p.pos.y - k.mesh.position.y) < 2) {
        if (k.kind === 'ammo') { p.ammo.forEach((a, j) => { a.res = Math.min(WEAPONS[j].reserve * 2, a.res + Math.ceil(WEAPONS[j].reserve * 0.5)); }); this.hud.toast('+ AMMO'); }
        else if (k.kind === 'cash') { const c = this.prog.cash(k.cash || 50); this.cash += c; this.hud.toast(`+ $${c}`); this.audio.play('cash'); }
        else { p.health = Math.min(100, p.health + 40); p.shield = 100; this.hud.toast('+ HEALTH'); }
        if (k.flat !== undefined) this.looted.add(k.flat);
        this.audio.play('pickup');
        if (k.fixed) { k.respawn = 30; k.mesh.visible = false; } else { this.scene.remove(k.mesh); this.pickups.splice(i, 1); }
      }
    }
  }

  // ---------- camera ----------
  updateCamera(dt) {
    const cam = this.camera, p = this.player, inp = this.input, s = this.settings, cs = this.camState;
    if (p.vehicle) {
      const v = p.vehicle;
      if (Math.abs(inp.dx) + Math.abs(inp.dy) > 0) cs.idle = 0; else cs.idle += dt;
      cs.yawOff -= inp.dx * 0.003 * s.sensitivity;
      cs.pitchOff = clamp(cs.pitchOff - inp.dy * 0.003 * s.sensitivity * (s.invertY ? -1 : 1), -0.5, 0.9);
      if (cs.idle > 1.5) { cs.yawOff *= Math.exp(-dt * 2); cs.pitchOff *= Math.exp(-dt * 2); }
      const dist = v.flying ? 11 : v.def.bike ? 5.8 : 8.5, h = v.flying ? 3.5 : v.def.bike ? 2.2 : 3.0;
      const yaw = v.yaw + cs.yawOff, pitch = 0.18 + cs.pitchOff + (v.flying ? -v.pitch * 0.5 : 0);
      const fx = -Math.sin(yaw) * Math.cos(pitch), fz = -Math.cos(yaw) * Math.cos(pitch), fy = Math.sin(pitch);
      const pivot = tmp.copy(v.pos); pivot.y += 1.6;
      const want = tmp2.set(pivot.x - fx * dist, pivot.y + fy * dist + h * 0.3, pivot.z - fz * dist);
      this._camCollide(pivot, want);
      if (!cs.init) { cs.pos.copy(want); cs.init = true; }
      cs.pos.lerp(want, 1 - Math.exp(-dt * 10));
      if (cs.pos.y < 0.5) cs.pos.y = 0.5;
      if (cs.pos.y < 7.5) { const pc = this.city.pushPoles(cs.pos.x, cs.pos.z, 0.7); cs.pos.x = pc.x; cs.pos.z = pc.z; }
      cam.position.copy(cs.pos);
      cam.lookAt(pivot.x + fx * 6, pivot.y + 0.8 - Math.min(0, fy) * 0, pivot.z + fz * 6);
      const spd = Math.abs(v.speed);
      cam.fov += (68 + Math.min(18, spd * 0.2) - cam.fov) * (1 - Math.exp(-dt * 4));
    } else {
      const aiming = inp.mouseRight && p.alive;
      this.aimZoom += ((aiming ? 1 : 0) - this.aimZoom) * (1 - Math.exp(-dt * 12));
      const dist = 3.3 - this.aimZoom * 1.5, side = 1.05 - this.aimZoom * 0.15;
      const yaw = p.yaw, pitch = p.pitch;
      const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const pivot = tmp.set(p.pos.x + rx * side, p.pos.y + 1.75, p.pos.z + rz * side);
      const base = tmp3.set(p.pos.x, p.pos.y + 1.62, p.pos.z);
      // shoulder point must not be inside a wall either
      const sideHit = this._camCollide(base, pivot);
      void sideHit;
      const want = tmp2.set(pivot.x - fx * dist, pivot.y - fy * dist + 0.25, pivot.z - fz * dist);
      this._camCollide(pivot, want);
      if (want.y < 0.35) want.y = 0.35;
      if (want.y < 7.5) { const pc = this.city.pushPoles(want.x, want.z, 0.5); want.x = pc.x; want.z = pc.z; }
      cam.position.copy(want);
      // camera squeezed against a wall: hide the body so it doesn't fill the screen
      p.h.root.visible = p.alive ? want.distanceTo(pivot) > 1.1 : true;
      cam.rotation.set(0, 0, 0); cam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      cam.fov += (70 - this.aimZoom * (WEAPONS[p.wi].zoom ? 50 : 18) - cam.fov) * (1 - Math.exp(-dt * 12));
    }
    // shake (the mech's footsteps, explosions)
    const sh = this.camState.shake || 0;
    if (sh > 0) { cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh; cam.position.z += (Math.random() - 0.5) * sh; this.camState.shake = Math.max(0, sh - dt * 1.5); }
    cam.updateProjectionMatrix();
  }
  _camCollide(from, to) {
    const d = (this._ccd || (this._ccd = new V3())).copy(to).sub(from); const len = d.length(); if (len < 1e-4) return false;
    d.divideScalar(len);
    const hit = this.city.raycast(from, d, len + 0.4);
    if (hit < len + 0.4) { const k = Math.max(0.2, hit - 0.4); to.copy(from).addScaledVector(d, k); return true; }
    return false;
  }
}

const wreckMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, flatShading: true });
