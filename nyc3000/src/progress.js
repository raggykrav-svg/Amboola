// Levels, skills, medals and the hidden golden robot statues.
// Everything you do gives XP. Each level gives a skill point to spend in the pause menu
// (SKILLS & MEDALS). Medals are achievements for cool things, and 20 golden robot statues
// are hidden around the city (rooftops, alleys, the highway…).
import * as THREE from 'three';
import { Parts } from './parts.js';

const V3 = THREE.Vector3;
export const MAX_LEVEL = 30;
export const xpFor = l => Math.round(120 * Math.pow(l, 1.45)); // XP needed to go from level l to l+1

export const SKILLS = [
  { id: 'runner', name: 'RUNNER', icon: '⚡', text: 'Run 10% faster per rank', color: '#29f3ff' },
  { id: 'tough', name: 'TOUGH AS STEEL', icon: '⬢', text: 'Take 12% less damage per rank', color: '#3aff9a' },
  { id: 'gunner', name: 'SHARPSHOOTER', icon: '◎', text: 'Your guns hit 12% harder per rank', color: '#ff8a3a' },
  { id: 'brawler', name: 'BRAWLER', icon: '👊', text: 'Punches hit 40% harder per rank', color: '#ff5a4e' },
  { id: 'driver', name: 'SPEED DEMON', icon: '🏎', text: 'Cars and bikes go 7% faster per rank', color: '#ffd23a' },
  { id: 'grapple', name: 'GRAPPLER', icon: '⚓', text: 'Longer grappling hook, faster pull', color: '#b98cff' },
  { id: 'lucky', name: 'LUCKY', icon: '$', text: '25% more cash from everything per rank', color: '#3aff9a' },
];
export const MAX_RANK = 3;

export const MEDALS = [
  { id: 'first', name: 'FIRST TAKEDOWN', icon: '🥊', text: 'Beat your first bad guy' },
  { id: 'fifty', name: 'CITY DEFENDER', icon: '🛡', text: 'Beat 50 bad guys' },
  { id: 'speed', name: 'SPEED DEMON', icon: '💨', text: 'Drive faster than 200 km/h' },
  { id: 'sky', name: 'SKY HIGH', icon: '☁', text: 'Fly higher than 300 m' },
  { id: 'race', name: 'RACE WINNER', icon: '🏁', text: 'Win a race' },
  { id: 'champ', name: 'CHAMPION', icon: '🏆', text: 'Win every race' },
  { id: 'hook', name: 'HOOKED', icon: '⚓', text: 'Use the grappling hook 10 times' },
  { id: 'wall', name: 'WALL RUNNER', icon: '🧗', text: 'Wall-run for 10 seconds in total' },
  { id: 'gold5', name: 'GOLD HUNTER', icon: '🤖', text: 'Find 5 golden robot statues' },
  { id: 'gold', name: 'GOLD MASTER', icon: '👑', text: 'Find all 20 golden robot statues' },
  { id: 'story1', name: 'JOINED THE FIGHT', icon: '📡', text: 'Finish the first story mission' },
  { id: 'mech', name: 'MECH BREAKER', icon: '🦾', text: 'Defeat the giant mech TITAN-0' },
  { id: 'event', name: 'EVENT HERO', icon: '⭐', text: 'Finish 3 surprise city events' },
  { id: 'dog', name: 'BEST FRIENDS', icon: '🐕', text: 'Get your own robot dog' },
  { id: 'home', name: 'HOME SWEET HOME', icon: '🏠', text: 'Buy your own apartment' },
  { id: 'decor', name: 'INTERIOR DESIGNER', icon: '🛋', text: 'Put 5 things in your apartment' },
  { id: 'tuned', name: 'TUNED UP', icon: '🔧', text: 'Buy a car or gun upgrade' },
  { id: 'night', name: 'NIGHT OWL', icon: '🌙', text: 'Stay out until midnight' },
  { id: 'sunrise', name: 'EARLY BIRD', icon: '🌅', text: 'See the sun come up' },
  { id: 'lvl10', name: 'LEVEL 10', icon: '🔟', text: 'Reach level 10' },
  { id: 'rich', name: 'MONEY BAGS', icon: '💰', text: 'Have $10,000 at once' },
  { id: 'ch10', name: 'GIG MASTER', icon: '📋', text: 'Finish 10 challenges' },
];

// ---------- the golden robot statues ----------
function statueGeometry() {
  const P = new Parts(), G = '#ffcf3a';
  P.box(0.5, 0.18, 0.5, '#b88a1a', 0, 0.09, 0);            // pedestal
  P.box(0.14, 0.34, 0.14, G, -0.1, 0.35, 0); P.box(0.14, 0.34, 0.14, G, 0.1, 0.35, 0); // legs
  P.box(0.42, 0.36, 0.26, G, 0, 0.7, 0);                     // body
  P.box(0.12, 0.3, 0.12, G, -0.28, 0.72, 0, 0, 0, 0.5); P.box(0.12, 0.3, 0.12, G, 0.28, 0.82, 0, 0, 0, -2.4); // waving arm
  P.box(0.32, 0.26, 0.26, G, 0, 1.03, 0);                    // head
  P.box(0.24, 0.06, 0.02, '#fff7c0', 0, 1.05, -0.14);        // eyes
  P.box(0.03, 0.16, 0.03, G, 0, 1.24, 0); P.box(0.08, 0.08, 0.08, '#fff7c0', 0, 1.34, 0); // antenna
  return P.build();
}

export class Progress {
  constructor(game) {
    this.g = game;
    this.reset();
    this.statueMesh = null; this.spots = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new V3(); this._p = new V3();
  }
  reset(save) {
    const s = (save && save.prog) || {};
    this.xp = s.xp || 0; this.level = s.level || 1; this.points = s.points ?? (this.level - 1);
    this.skills = { ...(s.skills || {}) };
    this.medals = new Set(s.medals || []);
    this.statues = new Set(s.statues || []);
    this.stats = { kills: 0, hooks: 0, wall: 0, events: 0, races: [], ...(s.stats || {}) };
    this.queue = [];
  }
  save() { return { prog: { xp: this.xp, level: this.level, points: this.points, skills: this.skills, medals: [...this.medals], statues: [...this.statues], stats: this.stats } }; }
  rank(id) { return this.skills[id] || 0; }

  // ---------- XP ----------
  addXP(n, why) {
    if (this.level >= MAX_LEVEL || n <= 0) return;
    this.xp += Math.round(n);
    this.g.hud.xpPop && this.g.hud.xpPop(Math.round(n), why);
    while (this.level < MAX_LEVEL && this.xp >= xpFor(this.level)) {
      this.xp -= xpFor(this.level); this.level++; this.points++;
      this.g.audio.play('objective');
      this.g.hud.say('LEVEL UP', `You are now LEVEL ${this.level}! Spend your skill point in the pause menu (SKILLS & MEDALS).`, '#ffd23a', 5);
      this.g.fx.explosion && this.g.fx.flash(this.g.wpos().clone().setY(this.g.wpos().y + 2), 0xffd23a, 4, 0.3);
      if (this.level >= 10) this.medal('lvl10');
    }
  }
  buySkill(id) {
    if (this.points <= 0 || this.rank(id) >= MAX_RANK) return false;
    this.skills[id] = this.rank(id) + 1; this.points--;
    return true;
  }
  // cash you earn, with the LUCKY skill
  cash(n) { return Math.round(n * (1 + 0.25 * this.rank('lucky'))); }

  // ---------- medals ----------
  medal(id) {
    if (this.medals.has(id)) return;
    const m = MEDALS.find(x => x.id === id); if (!m) return;
    this.medals.add(id);
    this.queue.push(m);
  }
  stat(key, add = 1) { this.stats[key] = (this.stats[key] || 0) + add; }

  // ---------- statues ----------
  build(city) {
    if (this.statueMesh) return;
    // rooftops of low buildings (grapple up!), plus sidewalks, alleys and the highway deck
    const spots = [];
    const lots = city.lots.filter(l => (l.topH || 0) > 8 && (l.topH || 0) < 40 && l.style !== 'hero');
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 400 && spots.length < 12; k++) {
      const l = lots[Math.floor(rnd() * lots.length)]; if (!l) break;
      const x = l.bx + (rnd() - 0.5) * l.lw * 0.4, z = l.bz + (rnd() - 0.5) * l.ld * 0.4;
      const y = city.groundAt(x, z, 999);
      if (y < 6 || y > 45 || spots.some(s => Math.hypot(s.x - x, s.z - z) < 90)) continue;
      spots.push({ x, y, z });
    }
    const R = i => -420 + 84 * i;
    for (const [i, j, ox, oz] of [[1, 2, 11, 30], [3, 8, -11, 40], [6, 1, 30, 11], [9, 5, 11, -30], [2, 10, 40, -11], [7, 7, -11, -45], [4, 3, 50, 11], [10, 9, -11, 30]]) {
      const x = R(i) + ox, z = R(j) + oz;
      spots.push({ x, y: city.groundAt(x, z, 2), z });
    }
    this.spots = spots.slice(0, 20);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.9, roughness: 0.25, emissive: 0x8a5a00, emissiveIntensity: 0.6 });
    this.statueMesh = new THREE.InstancedMesh(statueGeometry(), mat, this.spots.length);
    this.statueMesh.frustumCulled = false;
    this.g.scene.add(this.statueMesh);
    // a soft golden glow over each one, so you can spot it from a distance
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,90,1)'); gr.addColorStop(1, 'rgba(255,200,60,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.glows = this.spots.map(s => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sp.scale.setScalar(3.2); sp.position.set(s.x, s.y + 0.9, s.z); this.g.scene.add(sp); return sp; });
  }
  update(dt) {
    const g = this.g, t = g.time;
    // show medals one at a time
    if (this.queue.length && !(this.medalT > 0)) {
      const m = this.queue.shift(); this.medalT = 3.4;
      g.hud.medal && g.hud.medal(m);
      g.audio.play('objective');
      this.addXP(60, 'MEDAL');
    }
    this.medalT -= dt;
    // watch for medal-worthy things
    const p = g.player, v = p.vehicle;
    if (v && !v.flying && Math.abs(v.speed) * 3.6 > 200) this.medal('speed');
    if (v && v.flying && v.pos.y > 300) this.medal('sky');
    if (g.cash >= 10000) this.medal('rich');
    if (g.ch.done.size >= 10) this.medal('ch10');
    if (this.stats.kills >= 1) this.medal('first');
    if (this.stats.kills >= 50) this.medal('fifty');
    if (this.stats.hooks >= 10) this.medal('hook');
    if (this.stats.wall >= 10) this.medal('wall');
    if (this.stats.events >= 3) this.medal('event');
    // statues: spin, and pick them up when you get close
    if (!this.statueMesh) return;
    const wp = g.interior ? null : (v ? v.pos : p.pos);
    this.spots.forEach((s, i) => {
      const got = this.statues.has(i);
      this._p.set(s.x, s.y + Math.sin(t * 2 + i) * 0.06, s.z);
      this._q.setFromAxisAngle(this._s.set(0, 1, 0), t * 1.2 + i);
      this.statueMesh.setMatrixAt(i, this._m.compose(this._p, this._q, this._s.setScalar(got ? 0 : 1.3)));
      this.glows[i].visible = !got;
      if (!got && wp && Math.hypot(wp.x - s.x, wp.z - s.z) < 2.2 && Math.abs(wp.y - s.y) < 2.5) {
        this.statues.add(i);
        g.cash += this.cash(250); g.audio.play('cash'); g.audio.play('pickup');
        g.fx.sparks(new V3(s.x, s.y + 1, s.z), 0xffd23a, 30, 6);
        g.hud.toast(`GOLDEN ROBOT ${this.statues.size}/${this.spots.length} · +$${this.cash(250)}`);
        this.addXP(80, 'GOLDEN ROBOT');
        if (this.statues.size >= 5) this.medal('gold5');
        if (this.statues.size >= this.spots.length) this.medal('gold');
      }
    });
    this.statueMesh.instanceMatrix.needsUpdate = true;
  }
}
