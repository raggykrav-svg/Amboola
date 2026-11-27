// Enemies that notice you, the way they do in Cyberpunk 2077: gang members stand around calm
// until they hear gunfire, get shot at, see a friend go down or spot you sneaking around.
// Then they shout to each other and fight back. Also: street gangs hanging out around town
// (they leave you alone until you shoot near them or point a gun at them), silent takedowns
// from behind, little speech lines, and the people you rescue, find or chase in challenges.
import * as THREE from 'three';
import { Humanoid, pedKindFor } from './people.js';
import { CITY } from './textures.js';
import { Parts } from './parts.js';

const V3 = THREE.Vector3;
const { CELL, ROAD, N, HALF } = CITY;
const roadC = i => -HALF + i * CELL;
export const CALM = 0, SUSPICIOUS = 1, COMBAT = 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const yawOf = (dx, dz) => Math.atan2(-dx, -dz);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const tmp = new V3(), tmp2 = new V3(), tmp3 = new V3();

export const FACTIONS = {
  skulls: { name: 'CHROME SKULLS', one: 'CHROME SKULL', color: '#ff2040' },
  vipers: { name: 'NEON VIPERS', one: 'NEON VIPER', color: '#3aff9a' },
  rats: { name: 'DATA RATS', one: 'DATA RAT', color: '#b98cff' },
  volts: { name: 'VOLT KINGS', one: 'VOLT KING', color: '#ffd23a' },
  crown: { name: 'CHROME CROWN', one: 'CROWN BOT', color: '#ff7a1a' },
  psycho: { name: 'CYBERPSYCHO', one: 'CYBERPSYCHO', color: '#ff2bd6' },
};
const LINES = {
  hear: ['Huh? Was that a gunshot?', 'Did you hear that?', 'Someone is shooting!', 'What was that noise?'],
  spot: ['Hey! Who is there?', 'I see something…', 'What are you doing here?', 'Hold on… who is that?'],
  combat: ['There! Get them!', 'We have company!', 'Open fire!', 'Intruder!', 'Take them down!', 'Over there!'],
  ally: ['Man down!', 'They got one of us!', 'Watch out, they are here!'],
  lost: ['Where did they go?', 'Keep looking!', 'They are hiding somewhere…'],
  calm: ['Must have been nothing.', 'All clear.', 'Back to work.', 'Probably just a cat.'],
  angry: ['Put that gun down!', 'You looking for trouble?', 'Back off!'],
};

// ---------- icons over heads ----------
const ICONS = {};
function icon(kind) {
  if (ICONS[kind]) return ICONS[kind];
  const [ch, col] = { mark: ['◆', '#ff2040'], sus: ['?', '#ffd23a'], hostile: ['!', '#ff2040'], ko: ['Z', '#9fe9ff'], boss: ['★', '#ffd27a'], friend: ['●', '#3aff9a'] }[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '900 52px Orbitron, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(ch, 32, 35);
  g.shadowColor = col; g.shadowBlur = 10; g.fillStyle = col; g.fillText(ch, 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (ICONS[kind] = new THREE.SpriteMaterial({ map: t, sizeAttenuation: false, depthTest: kind === 'mark' || kind === 'ko' || kind === 'friend', transparent: true, toneMapped: false }));
}
const bandMats = {};
const bandGeo = new THREE.TorusGeometry(0.13, 0.022, 4, 18);

const NAMES1 = ['Jax', 'Mira', 'Dex', 'Kai', 'Nova', 'Rook', 'Zed', 'Lux', 'Ivy', 'Ozzy', 'Pix', 'Tank', 'Echo', 'Rex', 'Suki', 'Bolt', 'Vega', 'Milo', 'Juno', 'Kip'];
const NAMES2 = ['Chen', 'Vargas', 'Okafor', 'Novak', 'Reyes', 'Kim', 'Moreau', 'Silva', 'Haddad', 'Ito', 'Brooks', 'Petrov', 'Diaz', 'Larsen', 'Mbeki', 'Romano'];
export const randomName = () => `${pick(NAMES1)} ${pick(NAMES2)}`;

// ---------------- a robot dog ----------------
export function makeDog() {
  const P = new Parts();
  P.box(0.42, 0.34, 0.9, '#cfd8e8', 0, 0.62, 0);
  P.box(0.44, 0.08, 0.92, '#29f3ff', 0, 0.8, 0);
  P.box(0.34, 0.3, 0.36, '#cfd8e8', 0, 0.86, -0.56);
  P.box(0.3, 0.14, 0.22, '#9aa4b8', 0, 0.78, -0.78);
  P.box(0.08, 0.2, 0.06, '#9aa4b8', -0.12, 1.08, -0.5, 0, 0, 0.2); P.box(0.08, 0.2, 0.06, '#9aa4b8', 0.12, 1.08, -0.5, 0, 0, -0.2);
  P.box(0.06, 0.06, 0.02, '#3aff9a', -0.08, 0.9, -0.745); P.box(0.06, 0.06, 0.02, '#3aff9a', 0.08, 0.9, -0.745);
  const body = new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }));
  body.castShadow = true;
  const g = new THREE.Group(); g.add(body);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6a7488, roughness: 0.5, metalness: 0.6 });
  const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1); legGeo.translate(0, -0.25, 0);
  g.userData.legs = [[-0.15, -0.32], [0.15, -0.32], [-0.15, 0.32], [0.15, 0.32]].map(([x, z]) => { const l = new THREE.Mesh(legGeo, legMat); l.position.set(x, 0.5, z); g.add(l); return l; });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.36), new THREE.MeshBasicMaterial({ color: 0x29f3ff, toneMapped: false }));
  tail.position.set(0, 0.8, 0.55); tail.geometry.translate(0, 0, 0.16); g.add(tail); g.userData.tail = tail;
  return g;
}

// ---------------- people you rescue, find or chase ----------------
// kind: 'missing' (follows you once you talk to them), 'hostage' (hands up until saved),
// 'dog' (wanders until found, then follows), 'informant' (runs away when he sees you)
export class Friend {
  constructor(game, kind, opts = {}) {
    this.g = game; this.kind = kind; this.name = opts.name || randomName();
    this.pos = new V3(); this.yaw = 0; this.vel = new V3(); this.state = 'wait'; this.health = opts.health || 60; this.t = 0;
    if (kind === 'dog') { this.root = makeDog(); this.dog = true; this.phase = 0; }
    else { this.h = new Humanoid(opts.look || pedKindFor(opts.seed || 3)); this.root = this.h.root; }
    this.icon = new THREE.Sprite(icon('friend')); this.icon.scale.setScalar(0.03); this.icon.position.y = this.dog ? 1.5 : 2.3;
    this.root.add(this.icon); this.icon.visible = false;
    game.scene.add(this.root);
    this.area = opts.area || null; this.home = new V3();
  }
  dispose() { this.g.scene.remove(this.root); }
  get alive() { return this.state !== 'dead'; }
  place(x, z) { this.pos.set(x, this.g.city.groundAt(x, z, 1), z); this.home.copy(this.pos); this.root.position.copy(this.pos); }
  hurt(dmg) {
    if (!this.alive) return;
    this.health -= dmg;
    if (this.health <= 0) { this.state = 'dead'; this.t = 0; if (this.onDeath) this.onDeath(this); }
    else if (this.kind === 'informant' && this.state === 'wait') this.state = 'flee';
  }
  update(dt) {
    const g = this.g, p = g.player, pp = g.wpos(), city = g.city;
    this.t += dt;
    if (this.state === 'dead') {
      this.root.rotation.x = Math.max(-Math.PI / 2, this.root.rotation.x - dt * 4);
      if (this.h) this.h.animate(0, 0, {});
      return;
    }
    let speed = 0, opts = {};
    const dx = pp.x - this.pos.x, dz = pp.z - this.pos.z, d = Math.hypot(dx, dz);
    if (this.state === 'follow' || this.state === 'car') {
      const v = p.vehicle;
      if (v && d < 9 && !g.interior) {
        if (this.state !== 'car') { this.state = 'car'; this.root.visible = false; g.hud.toast(`${this.name.toUpperCase()} GOT IN YOUR CAR`); }
        this.pos.copy(v.pos);
      } else if (this.state === 'car') {
        if (!v) { // you got out: so do they
          const r = tmp.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
          const c = city.collide(p.pos.x + r.x * 1.8, p.pos.z + r.z * 1.8, 0.4, p.pos.y + 0.3, p.pos.y + 1.8);
          this.pos.set(c.x, city.groundAt(c.x, c.z, p.pos.y + 1), c.z);
          this.state = 'follow'; this.root.visible = true;
        } else this.pos.copy(v.pos); // a car far away (flying off without them?) - keep them in it
      } else if (d > 2.4 && !g.interior) {
        speed = d > 7 ? (this.dog ? 8.5 : 6.5) : (this.dog ? 4 : 3.2);
        this._move(dx / d, dz / d, speed, dt);
      } else this.yaw += angDiff(this.yaw, yawOf(dx, dz)) * Math.min(1, dt * 4);
      if (d > 120 && this.state === 'follow' && !g.interior) this._teleportNear(pp);
    } else if (this.state === 'flee') {
      // the informant runs around the block, away from you
      if (!this.loop) {
        const bi = clamp(Math.floor((this.pos.x + HALF) / CELL), 0, N - 1), bj = clamp(Math.floor((this.pos.z + HALF) / CELL), 0, N - 1);
        this.loop = { bx0: roadC(bi) + ROAD / 2, bz0: roadC(bj) + ROAD / 2, s: 0, dir: 1 };
        // start at the closest point of the walk around the block
        let best = 0, bd = 1e9;
        for (let s = 0; s < 240; s += 2) { const q = g._loopPos(this.loop.bx0, this.loop.bz0, s, tmp2); const dd = q.distanceTo(this.pos); if (dd < bd) { bd = dd; best = s; } }
        this.loop.s = best;
        const ahead = g._loopPos(this.loop.bx0, this.loop.bz0, best + 3, tmp2), back = g._loopPos(this.loop.bx0, this.loop.bz0, best - 3, tmp3);
        this.loop.dir = ahead.distanceTo(pp) > back.distanceTo(pp) ? 1 : -1;
      }
      speed = 6.9;
      this.loop.s += this.loop.dir * speed * dt;
      const q = g._loopPos(this.loop.bx0, this.loop.bz0, this.loop.s, tmp2);
      if (q.distanceTo(this.pos) > 1e-3) this.yaw = yawOf(q.x - this.pos.x, q.z - this.pos.z);
      this.pos.x = q.x; this.pos.z = q.z;
      // you're catching up from the front: turn around
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      if (d < 9 && (dx * fx + dz * fz) / Math.max(d, 1e-3) > 0.5 && (this._turnT = (this._turnT || 0) - dt) < 0) { this.loop.dir *= -1; this._turnT = 2; }
      opts = { flail: true };
    } else if (this.state === 'done') {
      opts = { dance: true }; // saved!
      this.yaw += angDiff(this.yaw, yawOf(dx, dz)) * Math.min(1, dt * 2);
    } else if (this.state === 'wait') {
      if (this.kind === 'hostage' || this.kind === 'missing') opts = { handsUp: true };
      if (this.dog && this.area) { // sniff around the area
        if (!this.wander || this.pos.distanceTo(this.wander) < 1) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * this.area.r * 0.8;
          this.wander = new V3(this.area.x + Math.cos(a) * r, 0, this.area.z + Math.sin(a) * r);
          this.pauseT = rand(0.5, 3);
        }
        if ((this.pauseT -= dt) < 0) { const w = tmp.subVectors(this.wander, this.pos).setY(0); const l = w.length(); if (l > 0.01) { speed = 2.6; if (!this._move(w.x / l, w.z / l, speed, dt)) this.wander = null; } }
      }
      if (this.kind === 'informant' && d < 14 && p.alive && !g.interior) {
        const eye = tmp.set(this.pos.x, this.pos.y + 1.6, this.pos.z), dir = tmp2.set(dx, pp.y + 1.2 - eye.y, dz), l = dir.length();
        if (city.raycast(eye, dir.divideScalar(l), l) >= l - 1) { this.state = 'flee'; g.hud.say(this.name.toUpperCase(), pick(['Uh-oh. Gotta go!', 'Not today!', 'You will never catch me!']), '#b98cff'); }
      }
    }
    if (this.dog) {
      this.phase += dt * (2 + speed * 3);
      const legs = this.root.userData.legs;
      legs.forEach((l, k) => { l.rotation.x = speed > 0.1 ? Math.sin(this.phase + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.6 : 0; });
      this.root.userData.tail.rotation.y = Math.sin(this.t * (this.state === 'wait' ? 4 : 14)) * 0.6;
      if (this.state === 'done') this.root.position.y = this.pos.y + Math.abs(Math.sin(this.t * 6)) * 0.25; // happy hops
    } else this.h.animate(dt, speed, opts);
    if (!(this.dog && this.state === 'done')) this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    this.icon.visible = this.kind !== 'npc' && (this.state === 'follow' || (this.state === 'wait' && d < 40 && this.kind !== 'informant'));
  }
  _move(nx, nz, speed, dt) {
    const city = this.g.city;
    const x = this.pos.x + nx * speed * dt, z = this.pos.z + nz * speed * dt;
    const c = city.collide(x, z, 0.4, this.pos.y + 0.3, this.pos.y + 1.6);
    const moved = Math.hypot(c.x - this.pos.x, c.z - this.pos.z) > speed * dt * 0.3;
    this.pos.x = c.x; this.pos.z = c.z;
    const g = city.groundAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y += (g - this.pos.y) * Math.min(1, dt * 12);
    this.yaw += angDiff(this.yaw, yawOf(nx, nz)) * Math.min(1, dt * 8);
    return moved;
  }
  _teleportNear(pp) {
    const c = this.g.city.collide(pp.x + 2, pp.z + 2, 0.5, 0.3, 1.8);
    this.pos.set(c.x, this.g.city.groundAt(c.x, c.z, pp.y + 1), c.z);
  }
}

// ---------------- the enemy brain ----------------
export class EnemyAI {
  constructor(game) {
    this.g = game; this.barkT = 0; this.alertT = 0; this.detect = 0;
    this.friends = [];
    this.street = new StreetGangs(game, this);
  }
  clear() {
    for (const f of this.friends) f.dispose();
    this.friends.length = 0;
    this.street.reset();
  }
  // a group of enemies around (x, z); returns the members
  squad(x, z, n, o = {}) {
    const g = this.g, out = [];
    const sq = o.join || { members: [], faction: o.faction || 'skulls', id: Math.random() };
    for (let k = 0; k < n * 6 && out.length < n; k++) {
      const a = (out.length / n) * Math.PI * 2 + rand(-0.4, 0.4), r = o.spread !== undefined ? o.spread * (0.4 + Math.random() * 0.6) : rand(3, 9);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const c = g.city.collide(px, pz, 0.6, 0.3, 1.8);
      if (c.hit || g.city.groundAt(c.x, c.z, 1) > 0.5 || Math.abs(c.x) > HALF + 4 || Math.abs(c.z) > HALF + 4) continue;
      const kind = o.kinds ? o.kinds[out.length] || 'gang' : 'gang';
      const e = g.newPerson(kind);
      e.pos.set(c.x, 0, c.z); e.root.position.copy(e.pos);
      this.setup(e, { ...o, squad: sq, name: o.names ? o.names[out.length] : undefined });
      // chatting groups face the middle; guards look outward
      e.yaw = o.activity === 'guard' ? yawOf(c.x - x, c.z - z) : yawOf(x - c.x, z - c.z);
      e.post.set(c.x, 0, c.z); e.postYaw = e.yaw;
      g.gang.push(e); out.push(e); sq.members.push(e);
    }
    return out;
  }
  setup(e, o) {
    e.alert = o.alert ?? CALM; e.aware = 0; e.heard = new V3(); e.lastPos = new V3(); e.lastSeen = -99;
    e.post = new V3().copy(e.pos); e.postYaw = e.yaw; e.searchT = 0; e.reactT = 0.5;
    e.squad = o.squad || null; e.faction = o.faction || 'skulls'; e.neutral = !!o.neutral; e.target = !!o.target;
    e.activity = o.activity || 'chat'; e.name = o.name || null; e.isBoss = e.kind === 'boss';
    if (o.health) { e.health = e.maxHealth = o.health; }
    const F = FACTIONS[e.faction] || FACTIONS.skulls;
    // a glowing headband in the gang's colour
    if (e.kind !== 'psycho') {
      if (!bandMats[F.color]) bandMats[F.color] = new THREE.MeshBasicMaterial({ color: new THREE.Color(F.color).multiplyScalar(1.4), toneMapped: false });
      const band = new THREE.Mesh(bandGeo, bandMats[F.color]); band.rotation.x = Math.PI / 2; band.position.y = 0.2;
      if (e.isBoss) band.scale.set(1.08, 1.08, 2.2);
      e.h.b.head.add(band);
    }
    e.icon = new THREE.Sprite(icon('mark')); e.icon.scale.setScalar(0.028); e.icon.position.y = 2.3; e.root.add(e.icon);
    if (e.mark) e.mark.visible = false;
    if (e.alert === COMBAT) { e.lastPos.copy(this.g.wpos()); e.lastSeen = this.g.time; }
  }

  // ---------- events ----------
  bark(e, kind, force) {
    if (!force && (this.barkT > 0 || e.kind === 'psycho')) return;
    const g = this.g, pp = g.wpos();
    if (Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z) > 70) return;
    this.barkT = 2.6;
    const F = FACTIONS[e.faction] || FACTIONS.skulls;
    g.hud.say(e.name ? e.name.toUpperCase() : F.one, pick(LINES[kind] || LINES.combat), F.color);
  }
  suspicious(e, pos, why) {
    if (e.state === 'dead' || e.alert === COMBAT) return;
    e.heard.copy(pos); e.heard.y = 0;
    if (e.alert === CALM) { e.alert = SUSPICIOUS; e.aware = Math.max(e.aware, 0.5); this.bark(e, why || 'hear'); }
    e.searchT = rand(9, 13);
  }
  combat(e, pos, why) {
    if (e.state === 'dead' || e.alert === COMBAT) return;
    const first = this.alertT <= 0;
    e.alert = COMBAT; e.aware = 1; e.reactT = rand(0.35, 0.85);
    e.lastPos.copy(pos); e.lastSeen = this.g.time; e.pendingCombat = undefined;
    this.bark(e, why || 'combat');
    if (first) { this.g.audio.play('alert'); this.alertT = 3; }
    if (e.onAlert) e.onAlert(e);
  }
  squadAlert(e, level, pos) {
    if (!e.squad) return;
    for (const m of e.squad.members) {
      if (m === e || m.state === 'dead' || m.alert === COMBAT) continue;
      if (level === COMBAT && m.pos.distanceTo(e.pos) < 55) { if (m.pendingCombat === undefined) m.pendingCombat = rand(0.25, 0.8); }
      else this.suspicious(m, pos, 'hear');
    }
  }
  // a gunshot (or explosion) at pos: everyone close by "feels" it
  noise(pos, radius, src) {
    const g = this.g, pp = g.wpos();
    for (const e of g.gang) {
      if (e === src || e.state === 'dead' || e.alert === COMBAT) continue;
      const d = e.pos.distanceTo(pos);
      if (d > radius) continue;
      if (src && e.squad && src.squad !== e.squad && e.neutral && d > 25) { this.suspicious(e, pos, 'hear'); continue; }
      if (d < radius * 0.45 || (src && src.squad === e.squad)) { this.combat(e, pp, 'hear'); this.squadAlert(e, COMBAT, pp); }
      else { this.suspicious(e, pos, 'hear'); this.squadAlert(e, SUSPICIOUS, pos); }
    }
  }
  // you shot them, or a bullet flew right past them
  hit(e) {
    if (e.alert !== COMBAT) { this.combat(e, this.g.wpos()); }
    this.squadAlert(e, COMBAT, this.g.wpos());
  }
  killed(e) {
    const g = this.g, pp = g.wpos();
    let said = false;
    for (const m of g.gang) {
      if (m === e || m.state === 'dead') continue;
      const d = m.pos.distanceTo(e.pos);
      if ((e.squad && m.squad === e.squad && d < 45) || (d < 22 && this._los(m, e.pos))) {
        if (m.alert !== COMBAT) { if (!said) { this.bark(m, 'ally', true); said = true; } m.pendingCombat = rand(0.2, 0.6); m.lastPos.copy(pp); }
      }
    }
  }
  nearMiss(a, b) {
    // closest approach of the bolt segment a->b to each enemy that isn't fighting yet
    for (const e of this.g.gang) {
      if (e.state === 'dead' || e.alert === COMBAT) continue;
      const sx = b.x - a.x, sz = b.z - a.z, l2 = sx * sx + sz * sz || 1e-6;
      const t = clamp(((e.pos.x - a.x) * sx + (e.pos.z - a.z) * sz) / l2, 0, 1);
      const cx = a.x + sx * t - e.pos.x, cz = a.z + sz * t - e.pos.z, cy = a.y + (b.y - a.y) * t - e.pos.y;
      if (cx * cx + cz * cz < 9 && cy > -1 && cy < 3.5) this.hit(e);
    }
  }
  _los(e, pos) {
    const eye = tmp3.set(e.pos.x, e.pos.y + 1.6, e.pos.z), dir = tmp2.set(pos.x - eye.x, pos.y + 1.0 - eye.y, pos.z - eye.z), l = dir.length();
    if (l < 0.5) return true;
    return this.g.city.raycast(eye, dir.divideScalar(l), l) >= l - 1.2;
  }
  _canSee(e, tp, dist, to) {
    const range = e.alert === COMBAT ? 75 : e.alert === SUSPICIOUS ? 44 : e.neutral ? 22 : 32;
    if (dist > range) return false;
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), cos = fx * to.x + fz * to.z;
    if (e.alert !== COMBAT && dist > 3.5 && cos < (e.alert === SUSPICIOUS ? 0.15 : 0.4)) return false;
    return this._los(e, tp);
  }
  // is the player pointing a gun at this person (right mouse, close by)?
  _aimedAt(e, dist) {
    const g = this.g;
    if (!g.input.mouseRight || g.player.vehicle || dist > 22) return false;
    const cam = g.camera; cam.getWorldDirection(tmp2);
    tmp.set(e.pos.x - cam.position.x, e.pos.y + 1.2 - cam.position.y, e.pos.z - cam.position.z);
    const t = tmp.dot(tmp2); if (t < 0) return false;
    return tmp.addScaledVector(tmp2, -t).length() < 1.6;
  }

  // ---------- takedowns ----------
  takedownTarget() {
    const g = this.g, p = g.player;
    if (!p.alive || p.vehicle || g.interior) return null;
    let best = null, bd = 1.9;
    for (const e of g.gang) {
      if (e.state === 'dead' || e.alert === COMBAT || e.kind === 'psycho' || e.ride) continue;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(p.pos.y - e.pos.y) > 1) continue;
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
      if ((dx * fx + dz * fz) / Math.max(d, 1e-3) > -0.1 && e.sees) continue; // they're looking at you
      best = e; bd = d;
    }
    return best;
  }
  takedown(e) {
    const g = this.g;
    e.state = 'dead'; e.knocked = true; e.t = 40; e.fallT = 0; e.health = 0;
    e.vel.set(-Math.sin(e.yaw) * 1.2, 1.2, -Math.cos(e.yaw) * 1.2);
    e.icon.material = icon('ko'); e.icon.visible = true;
    g.audio.play('punch'); g.hud.toast(e.isBoss ? `${(e.name || 'TARGET').toUpperCase()} KNOCKED OUT` : 'TAKEDOWN');
    g.hud.kick(4);
    // anyone who saw it?
    for (const m of g.gang) {
      if (m === e || m.state === 'dead' || m.alert === COMBAT) continue;
      const d = m.pos.distanceTo(e.pos);
      if (d < 20) {
        const to = tmp.subVectors(e.pos, m.pos).setY(0).normalize(), fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
        if (fx * to.x + fz * to.z > 0.3 && this._los(m, e.pos)) { this.combat(m, g.wpos(), 'ally'); this.squadAlert(m, COMBAT, g.wpos()); }
      }
    }
    g.killed(e);
  }

  // the key E near someone you rescue / find: returns a prompt line and handles the key
  friendPrompt() {
    const g = this.g, p = g.player;
    if (!p.alive || p.vehicle || g.interior) return '';
    for (const f of this.friends) {
      if (!f.alive || f.kind === 'npc' || f.state === 'follow' || f.state === 'car' || f.state === 'done') continue;
      const d = Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z);
      if (d > 2.6) continue;
      const text = f.kind === 'informant' ? `Grab ${f.name}` : f.kind === 'dog' ? `Pat ${f.name} and take him home` : f.kind === 'hostage' ? '' : `Talk to ${f.name}`;
      if (!text) continue;
      if (g.input.pressed('KeyE') && f.onTalk) f.onTalk(f);
      return `<kbd>E</kbd> ${text}`;
    }
    return '';
  }

  // ---------- every frame ----------
  update(dt) {
    const g = this.g, p = g.player, tp = g.wpos(), city = g.city;
    this.barkT -= dt; this.alertT -= dt;
    const visible = p.alive && !g.interior;
    const inCar = !!p.vehicle, running = !inCar && Math.hypot(p.vel.x, p.vel.z) > 6;
    let detect = 0;
    this.street.update(dt);
    for (let i = g.gang.length - 1; i >= 0; i--) {
      const e = g.gang[i];
      if (e.state === 'dead') {
        g._personPhysics(e, dt); e.t -= dt; e.root.position.copy(e.pos);
        if (e.icon && !e.knocked) e.icon.visible = false;
        if (e.t <= 0) { e.dispose(); g.gang.splice(i, 1); }
        continue;
      }
      if (e.ride) { // driving away in a car (bounty targets): ride along, hidden
        e.pos.copy(e.ride.pos); e.root.visible = false;
        continue;
      }
      const to = tmp.subVectors(tp, e.pos).setY(0), dist = to.length();
      if (dist > 1e-3) to.divideScalar(dist);
      e.senseT = (e.senseT || 0) - dt;
      if (e.senseT <= 0) { e.senseT = 0.12 + Math.random() * 0.12; e.sees = visible && this._canSee(e, tp, dist, to); }
      if (e.pendingCombat !== undefined) { e.pendingCombat -= dt; if (e.pendingCombat <= 0) { e.pendingCombat = undefined; this.combat(e, tp); } }
      let mv = 0, aim = -0.75, anim = 0;
      const boss = e.kind === 'psycho';
      if (e.alert === COMBAT && e.fleeTo) {
        // running for the getaway car
        const fx = e.fleeTo.x - e.pos.x, fz = e.fleeTo.z - e.pos.z, fd = Math.hypot(fx, fz) || 1;
        if (fd < 2.8 && e.onReachCar) { e.onReachCar(e); if (e.ride) continue; }
        mv = 6.4; anim = mv; aim = -0.6;
        e.yaw += angDiff(e.yaw, yawOf(fx, fz)) * Math.min(1, dt * 10);
        e.pos.x += fx / fd * mv * dt; e.pos.z += fz / fd * mv * dt;
      } else if (e.alert === COMBAT) {
        if (e.sees) { e.lastSeen = g.time; e.lastPos.copy(tp); }
        const lost = g.time - e.lastSeen;
        if (!boss && !e.isBoss && lost > 12) { e.alert = CALM; this.suspicious(e, e.lastPos, 'lost'); }
        const tgt = e.sees ? tp : e.lastPos;
        const tx = tgt.x - e.pos.x, tz = tgt.z - e.pos.z, td = Math.hypot(tx, tz) || 1;
        e.yaw += angDiff(e.yaw, yawOf(tx, tz)) * Math.min(1, dt * 8);
        if (e.sees) {
          if (td > (boss ? 6 : 20)) mv = boss ? 6.5 : 4.5; else if (td < (boss ? 3 : 8)) mv = -2.5;
          e.strafe = e.strafe || (Math.random() < 0.5 ? -1 : 1);
          if (Math.random() < dt * 0.4) e.strafe *= -1;
          e.pos.x += (tx / td) * mv * dt - (tz / td) * e.strafe * (boss ? 2.5 : 1.7) * dt;
          e.pos.z += (tz / td) * mv * dt + (tx / td) * e.strafe * (boss ? 2.5 : 1.7) * dt;
          anim = Math.abs(mv) + 1.5;
        } else if (td > 3) { mv = 4.2; e.pos.x += tx / td * mv * dt; e.pos.z += tz / td * mv * dt; anim = mv; } // go where they last saw you
        aim = Math.atan2(tgt.y + 1.2 - (e.pos.y + 1.5), Math.max(1, td));
        e.reactT -= dt; e.shootT -= dt;
        if (e.reactT <= 0 && e.shootT <= 0 && e.sees && dist < 58 && visible) {
          e.shootT = boss ? rand(0.5, 0.9) : e.isBoss ? rand(0.6, 1.1) : rand(0.9, 1.7);
          const eye = tmp2.set(e.pos.x, e.pos.y + 1.5 * e.root.scale.x, e.pos.z);
          const aimAt = tmp3.set(tp.x, tp.y + (p.vehicle ? 0.8 : 1.2), tp.z);
          const muzzle = e.gun ? e.gun.userData.muzzle.getWorldPosition(new V3()) : eye.clone();
          const n = boss ? 3 : e.isBoss ? 2 : 1;
          for (let k = 0; k < n; k++) g.enemyShoot(muzzle, aimAt, (boss ? 0.09 : 0.08) + dist * 0.002, boss ? 7 : e.isBoss ? 6 : 5, boss ? 0xff2a2a : 0xffa43a);
          this.noise(e.pos, 40, e); // gunfire wakes up the rest
        }
      } else {
        // noticing the player: a meter that fills while they can see you
        let rate = 0;
        if (e.sees) {
          if (e.neutral) rate = this._aimedAt(e, dist) ? 0.8 : dist < 2.0 ? 0.3 : 0;
          else rate = (dist < 6 ? 2.4 : dist < 14 ? 1.1 : 0.55) * (e.alert === SUSPICIOUS ? 1.7 : 1) * (inCar ? 0.6 : 1) * (running ? 1.3 : 1) * (g.implants && g.implants.has('cat') ? 0.5 : 1);
        }
        if (rate > 0) e.aware = Math.min(1, e.aware + rate * dt);
        else e.aware = Math.max(0, e.aware - dt * (e.alert === SUSPICIOUS ? 0.05 : 0.22));
        if (e.aware >= 1) {
          if (e.neutral && e.alert === CALM && !e.warned) { e.warned = true; e.aware = 0.6; this.bark(e, 'angry', true); }
          else { this.combat(e, tp); this.squadAlert(e, COMBAT, tp); }
        } else if (e.aware > 0.5 && e.alert === CALM && !e.neutral) this.suspicious(e, tp, 'spot');
        if (!e.neutral || e.aware > 0.3) detect = Math.max(detect, e.aware * (e.sees ? 1 : 0.6));
        if (e.alert === SUSPICIOUS) {
          e.searchT -= dt;
          if (e.sees && e.aware > 0.5) e.heard.copy(tp);
          const hx = e.heard.x - e.pos.x, hz = e.heard.z - e.pos.z, hd = Math.hypot(hx, hz);
          if (hd > 4) { mv = 2.3; e.yaw += angDiff(e.yaw, yawOf(hx, hz)) * Math.min(1, dt * 5); e.pos.x += hx / hd * mv * dt; e.pos.z += hz / hd * mv * dt; anim = mv; }
          else e.yaw += Math.sin(g.time * 1.3 + e.post.x) * dt * 1.6; // look around
          aim = -0.1;
          if (e.searchT <= 0) { e.alert = CALM; e.aware = 0; this.bark(e, 'calm'); }
        } else {
          // calm: chat, stand guard or walk back to their spot
          const px = e.post.x - e.pos.x, pz = e.post.z - e.pos.z, pd = Math.hypot(px, pz);
          if (pd > 1.2) { mv = 1.4; e.yaw += angDiff(e.yaw, yawOf(px, pz)) * Math.min(1, dt * 5); e.pos.x += px / pd * mv * dt; e.pos.z += pz / pd * mv * dt; anim = mv; }
          else {
            const sway = e.activity === 'guard' ? Math.sin(g.time * 0.4 + e.post.z) * 0.8 : Math.sin(g.time * 0.9 + e.post.x) * 0.25;
            e.yaw += angDiff(e.yaw, e.postYaw + sway) * Math.min(1, dt * 2);
          }
        }
      }
      const col = city.collide(e.pos.x, e.pos.z, 0.45, e.pos.y + 0.3, e.pos.y + 1.8); e.pos.x = col.x; e.pos.z = col.z;
      e.pos.y = city.groundAt(e.pos.x, e.pos.z, e.pos.y);
      e.h.animate(dt, anim, { aim });
      e.root.position.copy(e.pos); e.root.rotation.y = e.yaw; e.root.visible = true;
      // the sign over their head
      const ic = e.icon;
      if (ic) {
        let m = null, sc = 0.028;
        if (e.alert === COMBAT) m = icon('hostile');
        else if (e.alert === SUSPICIOUS || e.aware > 0.12) { m = icon('sus'); sc = 0.02 + 0.014 * e.aware; }
        else if (e.target) m = icon(e.isBoss ? 'boss' : 'mark');
        ic.visible = !!m; if (m) { ic.material = m; ic.scale.setScalar(sc); ic.position.y = 2.3 + Math.sin(g.time * 4 + i) * 0.05; }
      }
    }
    this.detect = detect;
    for (const f of this.friends) f.update(dt);
  }
}

// ---------------- street gangs hanging out around the city ----------------
class StreetGangs {
  constructor(game, ai) {
    this.g = game; this.ai = ai; this.spots = [];
    const facs = ['skulls', 'vipers', 'rats', 'volts'];
    // corners of some blocks (on the sidewalk)
    const picks = [[0, 1], [3, 1], [6, 0], [9, 2], [1, 4], [8, 3], [3, 5], [6, 5], [0, 7], [4, 6], [7, 6], [9, 8], [2, 9], [6, 9], [8, 9], [5, 3]];
    picks.forEach(([bi, bj], k) => {
      const bx0 = roadC(bi) + ROAD / 2, bz0 = roadC(bj) + ROAD / 2, s = k % 4;
      const x = s % 2 ? bx0 + CELL - ROAD - 3 : bx0 + 3, z = s < 2 ? bz0 + 3 : bz0 + CELL - ROAD - 3;
      const fac = facs[(bi + bj * 3) % 4];
      this.spots.push({ x, z, fac, members: null, cool: 0 });
    });
  }
  reset() {
    for (const s of this.spots) { if (s.members) this._despawn(s); s.cool = 0; }
  }
  _despawn(s) {
    const g = this.g;
    for (const e of s.members) { const i = g.gang.indexOf(e); if (i >= 0) g.gang.splice(i, 1); e.dispose(); }
    s.members = null;
  }
  update(dt) {
    const g = this.g, pp = g.wpos(), t = g.time;
    const maxActive = [0, 1, 2, 3][g.settings.crowd] || 1;
    let active = this.spots.filter(s => s.members).length;
    for (const s of this.spots) {
      const d = Math.hypot(s.x - pp.x, s.z - pp.z);
      if (s.members) {
        const alive = s.members.filter(e => e.state !== 'dead');
        if (!alive.length) { if (s.members.every(e => !g.gang.includes(e))) { s.members = null; s.cool = t + 150; active--; } continue; }
        if (d > 180 && alive.every(e => e.alert !== COMBAT)) { this._despawn(s); active--; }
        continue;
      }
      if (active >= maxActive || t < s.cool || d > 125 || d < 55 || !g.player.alive) continue;
      if (Math.hypot(s.x - 13, s.z + 22) < 90 && t < 60) continue; // not right next to the start
      if (g.ch && g.ch.nearStart(s.x, s.z, 90)) continue; // leave challenge spots alone
      const n = 2 + Math.floor(Math.random() * 3);
      s.members = this.ai.squad(s.x, s.z, n, { faction: s.fac, neutral: true, activity: 'chat', spread: 2.6 });
      if (s.members.length) active++; else { s.members = null; s.cool = t + 30; }
    }
  }
}
