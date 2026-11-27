// Surprise events: every minute or two, when you're free roaming, something happens nearby.
// You can join in or ignore it:
//  - ARMORED TRUCK ROBBERY: stop the robbers, the cash bags are yours
//  - METEOR: a meteor crashes into the street; grab the space crystal
//  - GANG WAR: two gangs are shooting at each other; stop them both
//  - NEON PARADE: dancers and floats march down a street; walk with them to join the party
//  - FIREWORKS (at night): a fireworks show over Times Square
import * as THREE from 'three';
import { Humanoid, pedKindFor, makePickup } from './models.js';
import { COMBAT } from './ai.js';
import { CITY } from './textures.js';

const V3 = THREE.Vector3;
const { HALF } = CITY;
const R = i => -HALF + i * 84;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const GANGS = ['skulls', 'vipers', 'rats', 'volts'];
const COLS = [0xff2bd6, 0x29f3ff, 0xffd23a, 0x3aff9a, 0xff5a4e, 0xb98cff];

export const EVENT_INFO = {
  truck: { label: 'ARMORED TRUCK ROBBERY', color: '#ffd23a', icon: '💰' },
  meteor: { label: 'METEOR STRIKE', color: '#ff7a1a', icon: '☄' },
  gangwar: { label: 'GANG WAR', color: '#ff2040', icon: '⚔' },
  parade: { label: 'NEON PARADE', color: '#ff2bd6', icon: '🎉' },
  fireworks: { label: 'FIREWORKS SHOW', color: '#29f3ff', icon: '🎆' },
};

export class CityEvents {
  constructor(game) { this.g = game; this.ev = null; this.nextT = 45; this.things = []; this.lastFw = -1; }
  reset() { this.end(true); this.nextT = rand(40, 70); }

  // a crossing 110-220 m away, away from challenge markers
  _spot() {
    const g = this.g, p = g.wpos();
    for (let k = 0; k < 120; k++) {
      const i = Math.floor(rand(1, 10)), j = Math.floor(rand(1, 10)), x = R(i), z = R(j), d = Math.hypot(x - p.x, z - p.z);
      if (d < 90 || d > 260 || g.ch.nearStart(x, z, k < 80 ? 110 : 70)) continue;
      return { i, j, c: new V3(x, 0, z) };
    }
    return null;
  }
  _canStart() {
    const g = this.g;
    return !g.ch.active && !g.story.m && !g.story.ending && !g.interior && g.player.alive && g.stars === 0 && g.objective >= 4;
  }

  start(kind) {
    const g = this.g, night = g.clock >= 20.5 || g.clock < 2;
    if (!kind) kind = night && this.lastFw !== Math.floor(g.time / 600) && Math.random() < 0.5 ? 'fireworks' : pick(['truck', 'meteor', 'gangwar', 'parade']);
    const s = kind === 'fireworks' ? { c: new V3(g.city.plaza.x, 0, g.city.plaza.z) } : this._spot();
    if (!s) return false;
    const e = this.ev = { kind, t: 0, at: s.c, joined: false, info: EVENT_INFO[kind] };
    const cn = g.ch._corner(s.c);
    if (kind === 'truck') {
      const v = g._addVehicle('van', cn.x + 3 * cn.sx, cn.z + 6 * cn.sz, Math.random() * 6, 'parked'); v.hasDriver = false; v.keep = true;
      e.truck = v;
      const F = pick(GANGS);
      e.enemies = g.ai.squad(s.c.x, s.c.z, 3, { faction: F, activity: 'chat', target: true, spread: 6 });
      g.hud.say('POLICE RADIO', 'All units: robbers are breaking into an armored truck! Anyone nearby, please help!', '#4aa0ff', 5);
    } else if (kind === 'meteor') {
      e.land = new V3(s.c.x + rand(-6, 6), 0, s.c.z + rand(-6, 6));
      e.rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: 0xffa43a, toneMapped: false }));
      e.from = new V3(e.land.x - 260, 340, e.land.z - 160); e.rock.position.copy(e.from);
      g.scene.add(e.rock); this.things.push(e.rock);
      g.hud.say('NEWS FLASH', 'Look up! A METEOR is falling on the city! There may be a space crystal in it!', '#ff7a1a', 5);
    } else if (kind === 'gangwar') {
      const A = pick(GANGS); let F2 = pick(GANGS); while (F2 === A) F2 = pick(GANGS);
      e.a = g.ai.squad(s.c.x - 10, s.c.z, 3, { faction: A, activity: 'guard', target: true, spread: 4 });
      e.b = g.ai.squad(s.c.x + 10, s.c.z, 3, { faction: F2, activity: 'guard', target: true, spread: 4 });
      e.enemies = [...e.a, ...e.b];
      for (const m of e.a) m.yaw = Math.PI / 2 * -1; for (const m of e.b) m.yaw = Math.PI / 2;
      g.hud.say('POLICE RADIO', 'Two gangs are fighting in the street! Stop them before someone gets hurt!', '#4aa0ff', 5);
    } else if (kind === 'parade') {
      // walk along a street from one crossing to the next
      const dir = Math.random() < 0.5 ? [1, 0] : [0, 1];
      e.from = new V3(s.c.x - dir[0] * 84, 0, s.c.z - dir[1] * 84); e.to = new V3(s.c.x + dir[0] * 84, 0, s.c.z + dir[1] * 84);
      e.dir = new V3(dir[0], 0, dir[1]); e.yaw = Math.atan2(-dir[0], -dir[1]);
      e.dancers = []; e.floats = [];
      for (let k = 0; k < 10; k++) {
        const h = new Humanoid(pedKindFor(k * 5 + 2)); g.scene.add(h.root); this.things.push(h.root);
        e.dancers.push({ h, off: -k * 3.2, side: (k % 2 ? 1 : -1) * rand(1, 3.5), ph: Math.random() * 6 });
      }
      for (let k = 0; k < 2; k++) {
        const v = g._addVehicle('van', e.from.x, e.from.z, e.yaw, 'parade'); v.keep = true; v.hasDriver = true;
        const bal = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: COLS[k * 2], transparent: true, opacity: 0.8, toneMapped: false }));
        g.scene.add(bal); this.things.push(bal);
        e.floats.push({ v, bal, off: -12 - k * 22 });
      }
      e.prog = 0; e.with = 0;
      g.hud.say('NEWS FLASH', 'The NEON PARADE is coming down the street! Walk along with it to join the party!', '#ff2bd6', 5);
    } else if (kind === 'fireworks') {
      this.lastFw = Math.floor(g.time / 600);
      e.fw = 0; e.watch = 0;
      g.hud.say('NEWS FLASH', 'FIREWORKS over Times Square tonight! Go and watch!', '#29f3ff', 5);
    }
    g.audio.play('alert');
    g.hud.toast(`SURPRISE EVENT: ${e.info.label}`);
    return true;
  }

  end(silent, won) {
    const g = this.g, e = this.ev; if (!e) return;
    for (const m of e.enemies || []) if (m.state !== 'dead') { const i = g.gang.indexOf(m); if (i >= 0) g.gang.splice(i, 1); m.dispose(); }
    if (e.truck) e.truck.keep = false;
    for (const f of e.floats || []) { const i = g.vehicles.indexOf(f.v); if (i >= 0) g.vehicles.splice(i, 1); f.v.dispose(); }
    for (const o of this.things) g.scene.remove(o);
    this.things.length = 0;
    this.ev = null; this.nextT = rand(70, 130);
    if (!silent && !won) g.hud.toast(`${e.info.label} IS OVER`);
  }
  win(cash, xp, text) {
    const g = this.g, e = this.ev;
    const c = g.prog.cash(cash); g.cash += c; g.audio.play('cash'); g.audio.play('objective');
    g.prog.addXP(xp, 'EVENT'); g.prog.stat('events');
    g.hud.toast(`${e.info.label} · DONE! +$${c}`);
    if (text) g.hud.say(text[0], text[1], text[2] || '#3aff9a');
    this.end(true, true);
  }
  onKill(m) {
    const e = this.ev; if (!e || !e.enemies || !e.enemies.includes(m)) return;
    if (e.enemies.every(x => x.state === 'dead')) {
      if (e.kind === 'truck') {
        // the cash bags fall out of the truck
        const g = this.g;
        for (let k = 0; k < 3; k++) { const mm = makePickup('cash'); mm.position.set(e.truck.pos.x + rand(-3, 3), 0.6, e.truck.pos.z + rand(-3, 3)); g.scene.add(mm); g.pickups.push({ mesh: mm, kind: 'cash', fixed: false, t: 0, respawn: 0, cash: 150 }); }
        this.win(300, 150, ['TRUCK DRIVER', 'You stopped them! Keep those cash bags, you earned them!']);
      } else this.win(700, 180, ['POLICE RADIO', 'Gang war stopped. The street is safe again. Thank you!', '#4aa0ff']);
    }
  }
  // what the objective box shows
  hud() {
    const e = this.ev; if (!e) return null;
    const subs = {
      truck: 'Stop the robbers at the armored truck',
      meteor: e.landed ? 'Grab the glowing space crystal!' : 'A meteor is falling… go to the marker',
      gangwar: 'Stop the gang war: beat both gangs',
      parade: `Walk with the parade to join the party (${Math.min(100, Math.round(e.with / 20 * 100))}%)`,
      fireworks: `Watch the fireworks in Times Square (${Math.min(100, Math.round((e.watch || 0) / 12 * 100))}%)`,
    };
    const tgt = e.kind === 'parade' ? (e.head || e.from) : e.kind === 'meteor' ? e.land : e.at;
    return { title: `${e.info.icon} ${e.info.label}`, sub: subs[e.kind], target: tgt, event: true };
  }

  update(dt) {
    const g = this.g, wp = g.wpos();
    if (!this.ev) {
      if (!this._canStart()) return;
      if ((this.nextT -= dt) <= 0) { if (!this.start()) this.nextT = 10; }
      return;
    }
    const e = this.ev;
    e.t += dt;
    const far = Math.hypot(wp.x - e.at.x, wp.z - e.at.z);
    if (far < 60) e.joined = true;
    // ignored for a long time, or you went far away: it ends quietly
    const why = !e.joined && e.t > 150 ? 'ignored' : far > 520 ? 'far' : g.ch.active ? 'challenge' : g.story.m ? 'story' : '';
    if (why) { this.lastEnd = why; this.end(); return; }
    if (e.kind === 'meteor') {
      if (!e.landed) {
        const k = Math.min(1, e.t / 5);
        e.rock.position.lerpVectors(e.from, e.land, k * k);
        e.rock.rotation.x += dt * 3; e.rock.rotation.y += dt * 2;
        if (Math.random() < dt * 40) g.fx.sparks(e.rock.position.clone(), 0xff7a1a, 3, 3);
        if (k >= 1) {
          e.landed = true; g.fx.explosion(e.land.clone()); g.fx.explosion(e.land.clone().setY(2)); g.audio.play('explode'); g.camState.shake = far < 120 ? 0.6 : 0.2;
          g.scene.remove(e.rock);
          const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0x9ff8ff, toneMapped: false }));
          cr.scale.set(1, 1.6, 1); cr.position.set(e.land.x, 1.4, e.land.z); g.scene.add(cr); this.things.push(cr); e.crystal = cr;
          const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 4.5, 24), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2; ring.position.set(e.land.x, 0.08, e.land.z); g.scene.add(ring); this.things.push(ring);
          for (const pd of g.peds) if (pd.state === 'walk' && pd.pos.distanceTo(e.land) < 50) { pd.state = 'flee'; pd.t = 8; }
        }
      } else {
        e.crystal.rotation.y += dt * 2; e.crystal.position.y = 1.4 + Math.sin(g.time * 3) * 0.2;
        if (Math.hypot(wp.x - e.land.x, wp.z - e.land.z) < 2.6 && wp.y < 5) this.win(600, 150, ['NEWS FLASH', 'Someone found the SPACE CRYSTAL! It\'s worth a lot!', '#ff7a1a']);
      }
    } else if (e.kind === 'gangwar') {
      // they shoot at each other until you get close; then they come for you
      if (!e.loud && far < 45) { e.loud = true; for (const m of e.enemies) if (m.state !== 'dead') g.ai.combat(m, wp); }
      if (!e.loud) {
        e.shotT = (e.shotT || 0) - dt;
        if (e.shotT <= 0) {
          e.shotT = rand(0.15, 0.5);
          const A = e.a.filter(m => m.state !== 'dead'), B = e.b.filter(m => m.state !== 'dead');
          if (A.length && B.length) {
            const [s, t] = Math.random() < 0.5 ? [pick(A), pick(B)] : [pick(B), pick(A)];
            const from = s.pos.clone().setY(1.4), to = t.pos.clone().setY(1.2 + rand(-0.6, 0.8));
            g.fx.bolt(from, to.sub(from).normalize(), 90, 0xff2040, 'fx', 0);
            g.fx.flash(from, 0xff2040, 0.8, 0.05);
            if (far < 140) g.audio.play('enemy', far);
          }
        }
      }
    } else if (e.kind === 'parade') {
      e.prog += dt * 1.8;
      const len = e.from.distanceTo(e.to), t = g.time;
      e.head = e.from.clone().addScaledVector(e.dir, Math.min(len, e.prog));
      const side = new V3(e.dir.z, 0, -e.dir.x);
      for (const d of e.dancers) {
        const along = Math.max(0, Math.min(len, e.prog + d.off));
        const x = e.from.x + e.dir.x * along + side.x * d.side, z = e.from.z + e.dir.z * along + side.z * d.side;
        d.h.root.position.set(x, 0, z); d.h.root.rotation.y = e.yaw + Math.sin(t * 2 + d.ph) * 0.6;
        d.h.animate(dt, 0, { dance: true });
      }
      for (const f of e.floats) {
        const along = Math.max(0, Math.min(len, e.prog + f.off));
        f.v.pos.set(e.from.x + e.dir.x * along, 0, e.from.z + e.dir.z * along); f.v.yaw = e.yaw; f.v.speed = 0;
        f.bal.position.set(f.v.pos.x, 7 + Math.sin(t * 1.5 + f.off) * 0.5, f.v.pos.z);
      }
      if (Math.random() < dt * 6) g.fx.sparks(e.head.clone().setY(4 + Math.random() * 3), pick(COLS), 8, 4);
      // you're in the parade if you're close to it
      const near = e.dancers.some(d => d.h.root.position.distanceTo(new V3(wp.x, 0, wp.z)) < 9);
      if (near && !g.player.vehicle) { e.with += dt; e.joined = true; }
      if (e.with >= 20) { this.win(400, 120, ['PARADE', 'Woo-hoo! You\'re the star of the NEON PARADE!', '#ff2bd6']); return; }
      if (e.prog > len + 60) { this.end(); return; }
    } else if (e.kind === 'fireworks') {
      e.fw -= dt;
      if (e.fw <= 0) {
        e.fw = rand(0.25, 0.6);
        const pos = new V3(e.at.x + rand(-60, 60), rand(55, 110), e.at.z + rand(-60, 60));
        g.fx.sparks(pos, pick(COLS), 50, 13); g.fx.flash(pos, pick(COLS), 7, 0.25);
        if (far < 300) g.audio.play('explode', 80 + far * 0.5);
      }
      if (far < 150) { e.watch = (e.watch || 0) + dt; e.joined = true; }
      if (e.watch >= 12) { this.win(150, 100, ['CROWD', 'Ooooh! Aaaah! What a show!', '#29f3ff']); return; }
      if (e.t > 120) this.end();
    }
  }
}
