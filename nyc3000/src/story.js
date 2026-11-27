// The story: OVERLORD ZERO and his robot gang, the CHROME CROWN, have taken over the city.
// JUNO, a hacker, needs your help. Five missions, then the boss fight against Zero's giant
// mech TITAN-0 in Times Square, and an ending with fireworks. It starts after the first
// steps (drones, a car, a flying car, the skylane gate).
import * as THREE from 'three';
import { Friend, COMBAT } from './ai.js';
import { Mech } from './mech.js';
import { CITY } from './textures.js';
import { makePickup } from './models.js';

const V3 = THREE.Vector3;
const { HALF } = CITY;
const R = i => -HALF + i * 84;
const at = (i, j) => new V3(R(i), 0, R(j));
const JUNO = '#ff2bd6', ZERO = '#ff7a1a';

export const MISSIONS = [
  { name: 'THE SIGNAL', short: 'Destroy the Chrome Crown jammer' },
  { name: 'DATA HEIST', short: 'Steal Zero\'s data chip' },
  { name: 'FREE THE ENGINEER', short: 'Rescue Dr. Tess Volta' },
  { name: 'SKY CHASE', short: 'Shoot down the courier' },
  { name: 'TOWER TOP', short: 'Reach Zero\'s rooftop' },
  { name: 'TITAN-0', short: 'Defeat the giant mech' },
];
const HIDEOUT = [0, 7];

export class Story {
  constructor(game) { this.g = game; this.step = 0; this.m = null; this.things = []; }
  get done() { return this.step >= MISSIONS.length; }
  get active() { return !!this.m; }
  reset(save) { this.cleanup(); this.step = (save && save.story) || 0; this.waitT = 0; this.ending = null; }
  save() { return { story: this.step }; }

  // ---------- the HUD box ----------
  text() {
    const m = this.m, M = MISSIONS[this.step];
    if (!M) return null;
    if (!m) return [`STORY ${this.step + 1}/6: ${M.name}`, 'Juno is calling…'];
    return [`STORY ${this.step + 1}/6: ${M.name}`, m.sub || M.short];
  }
  get boss() { return this.m && this.m.mech && this.m.mech.state === 'alive' ? this.m.mech : null; }

  // ---------- missions ----------
  begin() {
    if (this.done || this.m) return;
    const g = this.g, k = this.step;
    this.m = { t: 0, phase: 0 };
    const say = (n, t, c, s = 6) => g.hud.say(n, t, c, s);
    g.audio.play('objective');
    if (k === 0) {
      say('JUNO', 'Hi! I\'m Juno. OVERLORD ZERO and his robot gang, the CHROME CROWN, took over the city screens. Their jammer is down the street. Smash it!', JUNO, 8);
      const c = this._spot(4, 7);
      this.m.jammer = this._jammer(c.x, c.z);
      const s0 = at(4, 7); this.m.enemies = g.ai.squad(s0.x, s0.z, 5, { faction: 'crown', activity: 'guard', target: true, spread: 8 });
      this._target(c, 'Shoot the jammer tower (the guards will fight back)');
    } else if (k === 1) {
      say('JUNO', 'That jammer was just the start. Zero keeps his plans on a DATA CHIP. His guards have it on the east side. Grab it and bring it to my hideout!', JUNO, 8);
      const c = this._spot(10, 4);
      const s1 = at(10, 4); this.m.enemies = g.ai.squad(s1.x, s1.z, 4, { faction: 'crown', activity: 'chat', target: true, spread: 6 });
      this.m.chip = this._chip(c.x, c.z);
      this._target(c, 'Grab the glowing data chip (walk over it)');
    } else if (k === 2) {
      say('JUNO', 'The chip says Zero kidnapped DR. TESS VOLTA, the engineer who built his robots. She\'s in the south-east. Get her out of there!', JUNO, 8);
      const c = this._spot(9, 10);
      const f = new Friend(g, 'missing', { name: 'Dr. Tess Volta', seed: 9 });
      g.ai.friends.push(f); f.place(c.x, c.z); f.yaw = 1;
      this.m.friend = f;
      const s2 = at(9, 10); this.m.enemies = g.ai.squad(s2.x, s2.z, 4, { faction: 'crown', activity: 'guard', target: true, spread: 7 });
      f.onTalk = () => { f.state = 'follow'; this.m.found = true; g.audio.play('pickup'); say('DR. TESS VOLTA', 'Thank you! Take me to Juno\'s hideout. I know how to stop Zero\'s mech!', '#3aff9a'); this._target(at(...HIDEOUT), 'Bring Tess to Juno\'s hideout (she can ride in your car)'); };
      f.onDeath = () => this.fail('TESS GOT HURT');
      this._target(c, 'Find Dr. Tess Volta and talk to her (E)');
    } else if (k === 3) {
      say('DR. TESS VOLTA', 'Zero\'s courier is flying the mech\'s POWER CORE across the sky! I called you a flying car. Chase the courier and shoot it down!', '#3aff9a', 8);
      const v = g.deliverCar('hover', true); v.keep = true; this.m.myCar = v;
      const c = g.wpos();
      const cv = g.spawnStoryVehicle('hover', c.x + 60, 80, c.z + 60);
      cv.health = cv.maxHealth = 420; cv.keep = true; cv.mode = 'courier'; cv.hasDriver = true; cv.escape = {}; // no wanted level for this one
      this.m.courier = cv; this.m.ang = 0;
      this._target(null, 'Get in the flying car (F) and shoot down the courier');
    } else if (k === 4) {
      say('JUNO', 'Without the core, Zero is hiding on top of his tower. Fly up there or use your grappling hook (G). Watch out for his drones!', JUNO, 8);
      const L = this._tower();
      if (!(g.player.vehicle && g.player.vehicle.flying)) { const v = g.deliverCar('hover', true); v.keep = true; this.m.myCar = v; }
      this.m.roof = L;
      this.m.drones = [];
      for (let n = 0; n < 6; n++) { const d = g.spawnChallengeDrone(L.x + Math.cos(n) * 12, L.y + 8, L.z + Math.sin(n) * 12); d.story = true; d.home = { x: L.x, z: L.z }; this.m.drones.push(d); }
      this._target(new V3(L.x, L.y, L.z), `Get to the roof of ${L.name} (${Math.round(L.y)} m up)`);
    } else if (k === 5) {
      say('OVERLORD ZERO', 'So, you found my tower. Too bad! Meet TITAN-0, my GIANT MECH! See you in Times Square!', ZERO, 7);
      const P = g.city.plaza;
      this.m.arena = new V3(P.x, 0, P.z);
      this._target(this.m.arena, 'Go to Times Square and face TITAN-0');
    }
  }
  cleanup() {
    const g = this.g, m = this.m; if (!m) return;
    for (const e of m.enemies || []) if (e.state !== 'dead') { const i = g.gang.indexOf(e); if (i >= 0) g.gang.splice(i, 1); e.dispose(); }
    if (m.friend) { const i = g.ai.friends.indexOf(m.friend); if (i >= 0) g.ai.friends.splice(i, 1); m.friend.dispose(); }
    for (const d of m.drones || []) if (!d.dead) { d.dead = true; d.fallV = 0; }
    for (const d of g.drones) if (d.story && !d.dead) { d.dead = true; d.fallV = 0; }
    if (m.courier) { const i = g.vehicles.indexOf(m.courier); if (i >= 0 && m.courier !== g.player.vehicle) { m.courier.dispose(); g.vehicles.splice(i, 1); } }
    if (m.myCar) m.myCar.keep = false;
    if (m.mech) m.mech.dispose();
    if (m.zero) m.zero.dispose();
    for (const o of this.things) { g.scene.remove(o); const i = g.targets.indexOf(o.userData.target); if (i >= 0) g.targets.splice(i, 1); }
    this.things.length = 0;
    this.m = null; g.objTarget = null;
  }
  fail(why) {
    if (!this.m) return;
    this.g.hud.toast(`MISSION FAILED · ${why} · TRY AGAIN`); this.g.audio.play('star');
    this.cleanup(); this.waitT = 4;
  }
  complete(text) {
    const g = this.g, k = this.step;
    this.cleanup();
    this.step++;
    const cash = g.prog.cash([500, 800, 1000, 1200, 1500, 0][k]);
    g.cash += cash; g.audio.play('cash');
    g.prog.addXP(250, 'STORY');
    if (k === 0) g.prog.medal('story1');
    g.hud.toast(`MISSION COMPLETE: ${MISSIONS[k].name}${cash ? ` · +$${cash}` : ''}`);
    if (text) g.hud.say(text[0], text[1], text[2], 6);
    this.waitT = 7;
    if (this.onSave) this.onSave();
  }
  onKill(e) {
    const m = this.m; if (!m) return;
    if (this.step === 4 && m.drones && m.drones.every(d => d.dead)) { m.dronesDown = true; }
  }
  onPlayerDeath() { if (this.m && !this.ending) this.fail('YOU WERE KNOCKED OUT'); }

  // ---------- every frame ----------
  update(dt) {
    const g = this.g;
    if (this.ending) return this._updateEnding(dt);
    if (g.objective < 4) return; // the first steps come first
    if (!this.m) {
      if (this.done) return;
      if ((this.waitT -= dt) <= 0 && g.player.alive && !g.interior) this.begin();
      return;
    }
    const m = this.m, wp = g.wpos(), p = g.player;
    m.t += dt;
    const k = this.step;
    if (k === 0) {
      if (m.jammer.userData.hp <= 0) this.complete(['JUNO', 'The screens are back! Nice work! Now let\'s find out what Zero is planning.', JUNO]);
    } else if (k === 1) {
      const c = m.chip;
      if (!m.got) {
        c.rotation.y += dt * 2; c.position.y = 1 + Math.sin(g.time * 3) * 0.15;
        if (Math.hypot(wp.x - c.position.x, wp.z - c.position.z) < 2.2 && wp.y < 4) {
          m.got = true; g.scene.remove(c); g.audio.play('pickup');
          g.hud.say('JUNO', 'You got it! Zero sent drones after you. Get to my hideout in the west, fast!', JUNO);
          this._target(at(...HIDEOUT), 'Bring the chip to Juno\'s hideout (drones are chasing you!)');
          m.drones = [];
          for (let n = 0; n < 3; n++) { const d = g.spawnChallengeDrone(wp.x + Math.cos(n * 2) * 30, 20, wp.z + Math.sin(n * 2) * 30); d.story = true; m.drones.push(d); }
        }
      } else if (Math.hypot(wp.x - R(HIDEOUT[0]), wp.z - R(HIDEOUT[1])) < 14) this.complete(['JUNO', 'The chip is safe. Let\'s see what\'s on it…', JUNO]);
    } else if (k === 2) {
      const f = m.friend, h = at(...HIDEOUT);
      if (m.found && f.state !== 'car' && Math.hypot(f.pos.x - h.x, f.pos.z - h.z) < 14 && Math.hypot(wp.x - h.x, wp.z - h.z) < 18) {
        f.state = 'done';
        this.complete(['DR. TESS VOLTA', 'Safe at last! Zero\'s mech needs a power core. If we take the core, he\'s in trouble!', '#3aff9a']);
      }
    } else if (k === 3) {
      const cv = m.courier;
      if (cv.mode === 'wreck' || cv.health <= 0) {
        if (!m.core) {
          m.core = makePickup('ammo'); m.core.scale.setScalar(2.2);
          m.core.position.set(cv.pos.x, g.city.groundAt(cv.pos.x, cv.pos.z, cv.pos.y) + 1.2, cv.pos.z);
          g.scene.add(m.core); this.things.push(m.core);
          g.hud.say('DR. TESS VOLTA', 'You got it! The power core fell down. Pick it up!', '#3aff9a');
          this._target(m.core.position.clone(), 'Pick up the power core where the courier crashed');
        }
        m.core.rotation.y += dt * 2;
        if (Math.hypot(wp.x - m.core.position.x, wp.z - m.core.position.z) < 3 && Math.abs(wp.y - m.core.position.y) < 4) this.complete(['JUNO', 'The core is ours! Now Zero has only one place left to hide…', JUNO]);
      } else {
        // the courier flies a big loop over the city and shoots back
        m.ang += dt * 0.055 * (p.vehicle && p.vehicle.flying ? 1 : 0.5);
        const tx = Math.cos(m.ang) * 230, tz = Math.sin(m.ang * 1.3) * 200, ty = 75 + Math.sin(m.ang * 3) * 20;
        const to = new V3(tx - cv.pos.x, ty - cv.pos.y, tz - cv.pos.z);
        const sp = Math.min(34, to.length() * 0.8);
        cv.pos.addScaledVector(to.normalize(), sp * dt);
        cv.yaw = Math.atan2(-to.x, -to.z); cv.bob += dt * 2; cv.roll = Math.sin(g.time) * 0.2;
        this.objTarget = cv.pos; g.objTarget = cv.pos;
        m.shootT = (m.shootT || 2) - dt;
        if (m.shootT <= 0 && cv.pos.distanceTo(wp) < 70) { m.shootT = 1.4; g.enemyShoot(cv.pos.clone(), new V3(wp.x, wp.y + 1, wp.z), 0.1, 5, 0xff7a1a); }
        m.sub = `Shoot down the courier · courier armour ${Math.max(0, Math.round(cv.health / cv.maxHealth * 100))}%`;
      }
    } else if (k === 4) {
      const L = m.roof, onRoof = Math.abs(wp.x - L.x) < L.w / 2 + 1 && Math.abs(wp.z - L.z) < L.d / 2 + 1 && wp.y > L.y - 2;
      if (onRoof) {
        if (!m.zeroSaid) { m.zeroSaid = true; g.hud.say('OVERLORD ZERO', 'How did you get up here?! Fine… TITAN-0, WAKE UP! Meet me in Times Square!', ZERO, 6); }
        if (m.drones.every(d => d.dead)) this.complete(['JUNO', 'Zero ran away to Times Square! This is it… the final fight. Get some ammo and go!', JUNO]);
        else m.sub = `Destroy Zero's drones on the roof (${m.drones.filter(d => !d.dead).length} left)`;
      }
    } else if (k === 5) {
      if (!m.mech) {
        if (Math.hypot(wp.x - m.arena.x, wp.z - m.arena.z) < 120) {
          m.mech = new Mech(g, m.arena.x + 20, m.arena.z - 30);
          g.audio.play('alert'); g.camState.shake = 0.8;
          g.hud.say('OVERLORD ZERO', 'HA HA HA! TITAN-0 IS UNBEATABLE!', ZERO, 4);
          setTimeout(() => g.hud.say('JUNO', 'Shoot the glowing BLUE CORE on its chest for double damage! Jump over the stomp shockwaves!', JUNO, 6), 4200);
          m.sub = 'Defeat TITAN-0 · aim for the blue core';
        }
        return;
      }
      m.mech.update(dt);
      g.objTarget = m.mech.pos;
      if (m.mech.state === 'dead' && !this.ending) this._startEnding();
    }
  }

  // ---------- the ending ----------
  _startEnding() {
    const g = this.g, m = this.m;
    // Zero climbs out of the wreck and gives up
    const z = g.newPerson('boss'); z.state = 'surrender'; z.pos.set(m.mech.pos.x + 4, 0, m.mech.pos.z + 4); z.root.position.copy(z.pos);
    if (z.gun) z.h.holdGun(null);
    m.zero = z;
    this.ending = { t: 0, fw: 0 };
    for (const d of g.drones) if (d.story && !d.dead) { d.dead = true; d.fallV = 0; }
    g.hud.say('OVERLORD ZERO', 'NOOO! My beautiful mech! OK, OK… I give up! The city is yours!', ZERO, 6);
    g.prog.medal('mech'); g.prog.addXP(1000, 'BOSS');
    const cash = g.prog.cash(10000); g.cash += cash; g.audio.play('cash');
    g.wanted = 0;
  }
  _updateEnding(dt) {
    const g = this.g, e = this.ending, m = this.m;
    e.t += dt;
    if (m && m.zero) { m.zero.h.animate(dt, 0, { handsUp: true }); m.zero.root.rotation.y += dt * 0.5; }
    if (m && m.mech) m.mech.update(dt);
    // fireworks over Times Square
    e.fw -= dt;
    if (e.fw <= 0 && e.t < 30) {
      e.fw = 0.35;
      const P = g.city.plaza, cols = [0xff2bd6, 0x29f3ff, 0xffd23a, 0x3aff9a, 0xff5a4e, 0xb98cff];
      const pos = new V3(P.x + (Math.random() - 0.5) * 120, 60 + Math.random() * 50, P.z + (Math.random() - 0.5) * 120);
      g.fx.sparks(pos, cols[Math.floor(Math.random() * cols.length)], 60, 14);
      g.fx.flash(pos, cols[Math.floor(Math.random() * cols.length)], 8, 0.25);
      g.audio.play('explode', 120);
    }
    if (e.t > 3 && !e.shown) {
      e.shown = true;
      g.hud.say('JUNO', 'YOU DID IT! The Chrome Crown is finished and NYC 3000 is free! You\'re a hero!', JUNO, 8);
      if (this.onEnding) this.onEnding();
    }
    if (e.t > 30) {
      this.ending = null; this.cleanup(); this.step = MISSIONS.length;
      g._startObjective(4); // free roam: drone waves again
      if (this.onSave) this.onSave();
    }
  }

  // ---------- helpers ----------
  _spot(i, j) { const c = at(i, j), cn = this.g.ch._corner(c); return new V3(cn.x, 0, cn.z); }
  _target(pos, sub) { this.g.objTarget = pos ? pos.clone() : null; if (this.m) this.m.sub = sub; }
  _jammer(x, z) {
    const g = this.g, grp = new THREE.Group();
    const M = new THREE.MeshStandardMaterial({ color: 0x2a2c36, metalness: 0.7, roughness: 0.4 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.6), M); base.position.y = 0.5; grp.add(base);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 6, 8), M); mast.position.y = 4; grp.add(mast);
    for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(new THREE.TorusGeometry(0.7 - k * 0.15, 0.06, 6, 20), new THREE.MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false })); d.position.y = 3 + k * 1.3; d.rotation.x = Math.PI / 2; grp.add(d); }
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2040, toneMapped: false })); light.position.y = 7.2; grp.add(light);
    grp.position.set(x, 0, z); g.scene.add(grp); this.things.push(grp);
    grp.userData.hp = 160;
    const t = { boltHit: (a, b, dmg, segHit) => { if (grp.userData.hp <= 0) return null; const h = segHit(grp.position, 0.9, 0, 7.5); if (h) { grp.userData.hp -= dmg; if (grp.userData.hp <= 0) { g.fx.explosion(new V3(x, 4, z)); g.audio.play('explode'); grp.visible = false; } } return h; },
      aimTest: test => { if (grp.userData.hp > 0) test(grp.position, 0.9, 0, 7.5); } };
    grp.userData.target = t; g.targets.push(t);
    return grp;
  }
  _chip(x, z) {
    const g = this.g;
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.4), new THREE.MeshBasicMaterial({ color: 0x3aff9a, toneMapped: false }));
    c.position.set(x, 1, z); g.scene.add(c); this.things.push(c);
    return c;
  }
  // a tall tower to climb (not the tallest: a flying car or the hook can reach the top)
  _tower() {
    const g = this.g, P = g.city.plaza;
    let best = null;
    for (const l of g.city.lots) {
      const h = l.topH || 0; if (h < 70 || h > 150) continue;
      const d = Math.hypot(l.bx - P.x - 150, l.bz - P.z + 150);
      if (!best || d < best.d) best = { d, l };
    }
    const l = best ? best.l : g.city.lots[0];
    const y = g.city.roofAt(l.bx, l.bz);
    return { x: l.bx, z: l.bz, y, w: l.lw, d: l.ld, name: l.tower || 'ZERO TOWER' };
  }
}
