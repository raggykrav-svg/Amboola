// Things to do around town, in the spirit of Cyberpunk 2077's side activities (with our own
// names and designs):
//  - CYBER CLINICS: buy implants that give you powers (double jump, slow motion, tougher skin,
//    healing, sneaking, seeing enemies through walls)
//  - CODE HACK: hack the street ATMs with a code-matrix puzzle for cash
//  - NEON TAGS: 24 glowing graffiti tags hidden on walls around the city to collect
//  - STREET FOOD: eat at the night-market stalls to heal
import * as THREE from 'three';
import { CITY } from './textures.js';

const { HALF } = CITY;
const $ = id => document.getElementById(id);

// ---------------- cyberware ----------------
export const IMPLANTS = [
  { id: 'leap', name: 'LEAP SPRINGS', slot: 'LEGS', text: 'Jump again in the air (double jump)', price: 1200, cred: 0, color: '#3aff9a' },
  { id: 'skin', name: 'TITAN SKIN', slot: 'SKIN', text: 'Take a third less damage', price: 1500, cred: 1, color: '#ffa43a' },
  { id: 'regen', name: 'BIO REGEN', slot: 'HEART', text: 'Health slowly heals by itself', price: 1800, cred: 1, color: '#ff2bd6' },
  { id: 'cat', name: 'CAT FEET', slot: 'LEGS', text: 'Sneak: enemies notice you half as fast', price: 900, cred: 0, color: '#b98cff' },
  { id: 'hawk', name: 'HAWK EYES', slot: 'EYES', text: 'Every bad guy nearby shows on the minimap, longer scanner range', price: 1000, cred: 0, color: '#29f3ff' },
  { id: 'dilator', name: 'TIME DILATOR', slot: 'BRAIN', text: 'Press V: slow motion for 5 seconds (recharges in 20)', price: 2500, cred: 2, color: '#ffd23a' },
];

// ---------------- code hack puzzle ----------------
const CODES = ['1C', '55', 'BD', 'E9', '7A', 'FF'];
class CodeHack {
  constructor(game) {
    this.g = game; this.el = $('hack'); this.on = false;
    this.el.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b && this.on) this.pick(+b.dataset.r, +b.dataset.c); });
    $('hackQuit').onclick = () => this.finish(true);
  }
  start(atm) {
    this.atm = atm; this.on = true;
    const n = 5, grid = [];
    for (let r = 0; r < n; r++) { grid.push([]); for (let c = 0; c < n; c++) grid[r].push(CODES[Math.floor(Math.random() * CODES.length)]); }
    // walk a valid path (row, column, row, ...) so the targets can always be done
    let r = 0, c = Math.floor(Math.random() * n); const path = [];
    const used = new Set();
    for (let k = 0; k < 6; k++) {
      if (k % 2 === 0) { let tries = 0; do { c = Math.floor(Math.random() * n); } while (used.has(r * n + c) && tries++ < 20); }
      else { let tries = 0; do { r = Math.floor(Math.random() * n); } while (used.has(r * n + c) && tries++ < 20); }
      used.add(r * n + c); path.push(grid[r][c]);
    }
    this.grid = grid; this.buffer = []; this.size = 6; this.row = 0; this.col = -1; this.vertical = false; this.used = new Set();
    this.targets = [{ seq: path.slice(1, 3), cash: 150, done: false }, { seq: path.slice(2, 5), cash: 450, done: false }];
    this.time = 25; this.started = false;
    this.el.classList.add('on'); this.g.freeMouse(true);
    this.render();
  }
  pick(r, c) {
    if (this.used.has(r * 5 + c)) return;
    if (this.vertical ? c !== this.col : r !== this.row) return;
    this.started = true; this.used.add(r * 5 + c);
    this.buffer.push(this.grid[r][c]); this.g.audio.play('ui');
    this.row = r; this.col = c; this.vertical = !this.vertical;
    const s = this.buffer.join(' ');
    for (const t of this.targets) if (!t.done && s.includes(t.seq.join(' '))) { t.done = true; this.g.audio.play('pickup'); }
    if (this.buffer.length >= this.size || this.targets.every(t => t.done)) { this.finish(false); return; }
    this.render();
  }
  update(dt) {
    if (!this.on) return;
    if (this.started) { this.time -= dt; if (this.time <= 0) { this.finish(false); return; } }
    $('hackTime').textContent = this.started ? Math.ceil(this.time) + ' s' : 'the clock starts with your first pick';
  }
  finish(quit) {
    if (!this.on) return;
    this.on = false; this.el.classList.remove('on'); this.g.freeMouse(false);
    const won = this.targets.filter(t => t.done); let cash = won.reduce((a, t) => a + t.cash, 0);
    this.atm.hacked = true;
    if (quit && !won.length) { this.atm.hacked = false; return; }
    if (cash) { cash = this.g.prog.cash(cash); this.g.prog.addXP(40, 'HACK'); this.g.cash += cash; this.g.audio.play('cash'); this.g.hud.toast(`HACK SUCCESS · THE ATM PAID $${cash}`); this.g.acts.stats.hacks++; }
    else { this.g.audio.play('alarm'); this.g.hud.toast('HACK FAILED · THE ATM LOCKED UP'); }
  }
  render() {
    let h = '<div class="hack-grid">';
    this.grid.forEach((row, r) => row.forEach((code, c) => {
      const used = this.used.has(r * 5 + c), ok = !used && (this.vertical ? c === this.col : r === this.row);
      h += `<button data-r="${r}" data-c="${c}" class="${used ? 'used' : ''} ${ok ? 'ok' : ''}">${used ? '[ ]' : code}</button>`;
    }));
    h += '</div>';
    $('hackGrid').innerHTML = h;
    $('hackBuf').innerHTML = Array.from({ length: this.size }, (_, k) => `<span>${this.buffer[k] || ''}</span>`).join('');
    $('hackTargets').innerHTML = this.targets.map(t => `<div class="${t.done ? 'done' : ''}">${t.seq.join(' ')} <b>$${t.cash}</b>${t.done ? ' ✔' : ''}</div>`).join('');
  }
}

// a neon tag (graffiti): a grinning robot with a lightning bolt, drawn once
function tagTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.shadowColor = '#ff2bd6'; g.shadowBlur = 14; g.strokeStyle = '#ff2bd6'; g.lineWidth = 7;
  g.beginPath(); g.roundRect(22, 26, 84, 70, 16); g.stroke();
  g.shadowColor = '#29f3ff'; g.strokeStyle = '#29f3ff'; g.lineWidth = 6;
  g.beginPath(); g.arc(48, 56, 9, 0, 7); g.stroke(); g.beginPath(); g.arc(80, 56, 9, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(42, 78); g.quadraticCurveTo(64, 92, 86, 78); g.stroke();
  g.fillStyle = '#ffd23a'; g.shadowColor = '#ffd23a';
  g.beginPath(); g.moveTo(70, 4); g.lineTo(54, 30); g.lineTo(66, 30); g.lineTo(56, 50); g.lineTo(78, 22); g.lineTo(66, 22); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Activities {
  constructor(game) {
    this.g = game; const city = game.city;
    this.hack = new CodeHack(game);
    this.stats = { hacks: 0 };
    this.slowT = 0; this.slowCD = 0;
    // ATMs beside some shop doors
    this.atms = [];
    const atmParts = [], screens = [];
    const shops = city.doors.filter(d => d.kind === 'shop');
    for (let k = 0; k < shops.length; k += 5) {
      const d = shops[k], ax = d.nz ? 1 : 0, az = d.nx ? 1 : 0;
      let x = 0, z = 0, ok = false;
      for (const off of [3.0, -3.0]) {
        x = d.x - d.nx * 0.05 + ax * off; z = d.z - d.nz * 0.05 + az * off;
        if (!city.doorNear(x + d.nx * 0.9, z + d.nz * 0.9, 2.4) && !city.collide(x + d.nx * 0.9, z + d.nz * 0.9, 0.4, 0.3, 1.8).hit) { ok = true; break; }
      }
      if (!ok) continue;
      this.atms.push({ x, z, nx: d.nx, nz: d.nz, hacked: false });
      const rot = Math.atan2(d.nx, d.nz);
      const box = new THREE.BoxGeometry(0.7, 1.6, 0.45); box.rotateY(rot); box.translate(x, 0.8, z); atmParts.push(box);
      const scr = new THREE.PlaneGeometry(0.42, 0.3); scr.rotateY(rot); scr.translate(x + d.nx * 0.235, 1.2, z + d.nz * 0.235); screens.push(scr);
    }
    if (atmParts.length) {
      const merge = list => { const g = new THREE.BufferGeometry(); const parts = list.map(p => p.toNonIndexed()); let n = 0; for (const p of parts) n += p.attributes.position.count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
        for (const p of parts) { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return g; };
      game.scene.add(new THREE.Mesh(merge(atmParts), new THREE.MeshLambertMaterial({ color: 0x30364a })));
      game.scene.add(new THREE.Mesh(merge(screens), new THREE.MeshBasicMaterial({ color: 0x3aff9a, toneMapped: false })));
    }
    // neon tags on walls, spread over the city
    this.tags = [];
    const flats = city.doors.filter(d => d.kind === 'flat');
    for (let k = 0; k < flats.length && this.tags.length < 24; k += Math.max(1, Math.floor(flats.length / 30))) {
      const d = flats[k], ax = d.nz ? 1 : 0, az = d.nx ? 1 : 0;
      const p = { x: d.x - d.nx * 0.27 - ax * 2.2, z: d.z - d.nz * 0.27 - az * 2.2, nx: d.nx, nz: d.nz };
      if (this.tags.some(t => Math.hypot(t.x - p.x, t.z - p.z) < 90)) continue;
      this.tags.push(p);
    }
    this.tagMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: tagTexture(), transparent: true, toneMapped: false, depthWrite: false }), this.tags.length);
    this.tagMesh.frustumCulled = false; game.scene.add(this.tagMesh);
    this.found = new Set();
    this._placeTags();
  }
  _placeTags() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    this.tags.forEach((t, i) => {
      q.setFromAxisAngle(up, Math.atan2(t.nx, t.nz));
      this.tagMesh.setMatrixAt(i, m.compose(p.set(t.x, 2.3, t.z), q, s.setScalar(this.found.has(i) ? 0 : 1)));
    });
    this.tagMesh.instanceMatrix.needsUpdate = true;
  }
  reset(save) {
    this.found = new Set((save && save.tags) || []);
    this.g.implants = new Set((save && save.implants) || []);
    for (const a of this.atms) a.hacked = false;
    this.slowT = 0; this.slowCD = 0;
    this._placeTags();
  }
  save() { return { tags: [...this.found], implants: [...this.g.implants] }; }
  // world speed (slow motion from the TIME DILATOR)
  get timeScale() { return this.slowT > 0 ? 0.35 : 1; }

  buyImplant(id) {
    const g = this.g, it = IMPLANTS.find(i => i.id === id);
    if (g.implants.has(id)) return 'owned';
    if (!g.atClinic) return 'clinic';
    if (g.credLevel < it.cred) return 'locked';
    if (g.cash < it.price) return 'cash';
    g.cash -= it.price; g.implants.add(id); g.audio.play('objective');
    return 'ok';
  }

  // prompts and keys on foot, outside
  prompt() {
    const g = this.g, p = g.player;
    if (!p.alive || p.vehicle || g.interior || this.hack.on) return '';
    for (const a of this.atms) if (Math.hypot(a.x + a.nx * 0.9 - p.pos.x, a.z + a.nz * 0.9 - p.pos.z) < 1.6) {
      if (a.hacked) return 'ATM: already hacked';
      if (g.input.pressed('KeyE')) this.hack.start(a);
      return '<kbd>E</kbd> Hack the ATM (code puzzle)';
    }
    for (const s of g.city.stalls) if (Math.hypot(s.x + s.nx * 1.2 - p.pos.x, s.z + s.nz * 1.2 - p.pos.z) < 2.0) {
      if (s.label === 'ROBO PARTS') return '';
      if (g.input.pressed('KeyE')) {
        if (g.cash < 15) { g.hud.toast('NOT ENOUGH CASH'); return ''; }
        if (p.health >= 100) { g.hud.toast("YOU'RE NOT HUNGRY"); return ''; }
        g.cash -= 15; p.health = Math.min(100, p.health + 40); g.audio.play('pickup'); g.hud.toast(`YUM! ${s.label} · +40 HEALTH`);
      }
      return `<kbd>E</kbd> Eat ${s.label.toLowerCase()} $15 (+40 health)`;
    }
    return '';
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.hack.update(dt);
    // the time dilator runs on real time
    if (this.slowT > 0) { this.slowT -= dt / 0.35; if (this.slowT <= 0) document.body.classList.remove('slowmo'); }
    this.slowCD -= dt;
    if (g.implants.has('dilator') && g.input.pressed('KeyV') && p.alive && !g.interior) {
      if (this.slowCD > 0) g.hud.toast(`TIME DILATOR RECHARGING · ${Math.ceil(this.slowCD)} s`);
      else { this.slowT = 5; this.slowCD = 20 + 5; document.body.classList.add('slowmo'); g.audio.play('scan'); g.hud.toast('TIME DILATOR'); }
    }
    // healing implant
    if (g.implants.has('regen') && p.alive && p.shieldDelay < 1 && p.health < 100) p.health = Math.min(100, p.health + dt * 3);
    // neon tags
    if (p.alive && !g.interior) {
      const wp = g.wpos();
      this.tags.forEach((t, i) => {
        if (this.found.has(i) || Math.hypot(t.x - wp.x, t.z - wp.z) > 4 || wp.y > 6) return;
        this.found.add(i); this._placeTags();
        const n = this.found.size, bonus = n === 8 ? 500 : n === 16 ? 1000 : n === this.tags.length ? 2500 : 0;
        g.cash += g.prog.cash(50 + bonus); g.prog.addXP(25, 'NEON TAG'); g.audio.play('cash');
        g.hud.toast(bonus ? `ALL ${n === this.tags.length ? '' : n + ' '}NEON TAGS! BONUS $${bonus}` : `NEON TAG ${n}/${this.tags.length} · +$50`);
      });
    }
  }
}
