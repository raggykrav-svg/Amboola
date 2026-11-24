// HUD: bars, ammo, wanted stars, minimap, compass, prompts.
import { WEAPONS } from './models.js';
import { TYPES, CHALLENGES } from './challenges.js';
import { CITY } from './textures.js';
import { roadC, GUN_SHOPS, CLINICS } from './city.js';
import { HIGHWAYS } from './highway.js';
import { FACTIONS, randomName } from './ai.js';

const $ = id => document.getElementById(id);
const { CELL, ROAD, N, HALF } = CITY;

export class HUD {
  constructor() {
    this.el = $('hud');
    this.cache = {};
    this.spread = 6;
    this.mm = $('minimap').getContext('2d');
    this.toastT = 0;
    this.hitT = 0;
    // compass labels
    const strip = $('compassStrip');
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    let html = '';
    for (let d = -360; d <= 720; d += 15) {
      const n = ((d % 360) + 360) % 360;
      if (names[n] !== undefined) html += `<span class="c" style="left:${d * 3}px">${names[n]}</span>`;
      else html += `<span class="t" style="left:${d * 3}px">|</span>`;
    }
    strip.innerHTML = html + '<span class="obj" id="compassObj">◆</span>';
    this.strip = strip; this.cObj = $('compassObj');
    this.slots = '';
    this.frame = 0;
  }
  show(on) { this.el.classList.toggle('show', on); }
  set(id, v, prop = 'textContent') {
    const k = id + prop; if (this.cache[k] === v) return; this.cache[k] = v;
    if (prop === 'width') $(id).style.width = v; else $(id)[prop] = v;
  }
  // a speech line at the bottom of the screen: who says what
  say(name, text, color = '#29f3ff', sec = 3.6) {
    const el = $('say'); el.innerHTML = ''; const b = document.createElement('b'); b.textContent = name + ':'; b.style.color = color;
    el.appendChild(b); el.appendChild(document.createTextNode(' ' + text)); el.style.opacity = 1; this.sayT = sec;
  }
  lift(on) {
    const el = $('lift');
    if (on && !this._liftBuilt) {
      this._liftBuilt = true;
      for (const n of [9, 10, 7, 8, 5, 6, 3, 4, 1, 2]) {
        const b = document.createElement('button'); b.textContent = n;
        b.onclick = () => this.onFloor && this.onFloor(n);
        $('liftBtns').appendChild(b);
      }
    }
    el.classList.toggle('on', on);
  }
  toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; this.toastT = 2.2; }
  kick(a) { this.spread = Math.min(30, this.spread + a); }
  hitmark() { this.hitT = 0.15; }
  prompt(html) { if (this.cache.prompt === html) return; this.cache.prompt = html; const p = $('prompt'); p.innerHTML = html; p.style.display = html ? 'block' : 'none'; }
  dead(on) { $('dead').classList.toggle('show', on); }
  // black flash when going through a door or sleeping
  fade(sec = 0.4) {
    const f = $('fade'); f.style.transition = 'none'; f.style.opacity = 1;
    clearTimeout(this._fadeT);
    this._fadeT = setTimeout(() => { f.style.transition = `opacity ${sec}s`; f.style.opacity = 0; }, sec * 400);
  }
  // shop robbery progress (v < 0 hides it)
  robBar(v) {
    const k = v < 0 ? -1 : Math.round(v * 100);
    if (this.cache.rob === k) return; this.cache.rob = k;
    $('robBar').style.display = k < 0 ? 'none' : 'block';
    if (k >= 0) $('robFill').style.width = k + '%';
  }

  update(g, dt, showFps, fps) {
    this.frame++;
    const p = g.player, v = p.vehicle;
    this.el.classList.toggle('driving', !!v);
    this.el.classList.toggle('cannon', !!(v && v.def.cannon));
    // bars
    this.set('hpFill', Math.max(0, p.health) + '%', 'width'); this.set('hpNum', String(Math.max(0, Math.ceil(p.health))));
    this.set('shFill', Math.max(0, p.shield) + '%', 'width'); this.set('shNum', String(Math.ceil(p.shield)));
    $('vignette').style.opacity = p.hurtT > 0 ? 1 : (p.health < 30 ? 0.45 + Math.sin(g.time * 6) * 0.15 : 0);
    p.hurtT -= dt;
    if (!v) {
      const w = WEAPONS[p.wi], a = p.ammo[p.wi];
      this.set('wName', p.fists ? 'FISTS' : w.name); this.set('ammoMag', String(a.mag)); this.set('ammoRes', String(a.res));
      $('ammo').classList.toggle('low', a.mag <= Math.ceil(w.mag * 0.25));
      // slots for the guns you own (bought guns get keys 4-6)
      const own = p.owned.map(o => (o ? 1 : 0)).join('');
      if (this.slots !== own) { this.slots = own; this.cache.wi = -1; $('wSlots').innerHTML = WEAPONS.map((w, i) => (p.owned[i] ? `<span data-i="${i}">${i + 1} ${w.id.toUpperCase()}</span>` : '')).join(''); }
      if (this.cache.wi !== p.wi) { this.cache.wi = p.wi; document.querySelectorAll('#wSlots span').forEach(s => s.classList.toggle('on', +s.dataset.i === p.wi)); }
      const rb = $('reloadBar');
      rb.style.visibility = p.reloadT > 0 ? 'visible' : 'hidden';
      if (p.reloadT > 0) $('reloadFill').style.width = (100 - p.reloadT / w.reload * 100) + '%';
    } else {
      this.set('vName', v.def.name);
      const kmh = Math.round(Math.abs(v.speed) * 3.6 * (v.flying ? 1.4 : 1));
      this.set('speed', String(kmh));
      $('altRow').style.display = v.flying ? 'block' : 'none';
      this.set('alt', String(Math.round(v.pos.y)));
      this.set('viFill', Math.max(0, v.health / v.maxHealth * 100) + '%', 'width');
      $('cannonRow').style.display = v.def.cannon ? 'flex' : 'none';
      this.set('enFill', p.cannon + '%', 'width');
    }
    // crosshair spread
    this.spread += (6 - this.spread) * (1 - Math.exp(-dt * 10));
    document.getElementById('crosshair').style.setProperty('--g', (this.spread * (g.input.mouseRight ? 0.6 : 1)).toFixed(1) + 'px');
    this.hitT -= dt; $('hitmark').style.opacity = this.hitT > 0 ? 1 : 0;
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) $('say').style.opacity = 0; }
    // detection: someone is noticing you (yellow) or you've been spotted (red)
    const fighting = g.gang.some(e => e.state !== 'dead' && e.alert === 2 && e.sees && !e.neutral);
    const det = g.ai.detect, dk = fighting ? 'S' : det > 0.04 ? Math.round(det * 20) : -1;
    if (this.cache.det !== dk) {
      this.cache.det = dk; const d = $('detect');
      d.style.display = dk === -1 ? 'none' : 'block'; d.classList.toggle('spotted', fighting);
      $('detectText').textContent = fighting ? '! SPOTTED !' : det > 0.5 ? '? SEARCHING' : '? NOTICING YOU';
      $('detectFill').style.width = (fighting ? 100 : det * 100) + '%';
    }
    // toast
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').style.opacity = 0; }
    // cash
    if (this.cache.cash !== g.cash) {
      const up = this.cache.cash !== undefined && g.cash > this.cache.cash;
      this.cache.cash = g.cash; $('cash').textContent = '$ ' + Math.floor(g.cash).toLocaleString('en-US');
      $('credLabel').textContent = 'STREET CRED ' + g.credLevel;
      if (up) { const c = $('cash'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    }
    // wanted
    const st = g.stars;
    const sk = st + '|' + (g.policeSeen ? 1 : 0);
    if (this.cache.stars !== sk) {
      this.cache.stars = sk;
      $('stars').innerHTML = [0, 1, 2, 3, 4].map(i => `<span class="${i < st ? 'on' : ''}">★</span>`).join('');
      $('stars').classList.toggle('flash', st > 0 && !g.policeSeen);
      $('wantedLabel').textContent = st ? (g.policeSeen ? 'NYPD IN PURSUIT' : 'EVADING…') : '';
    }
    // objective (an active or tracked challenge takes over the box)
    const [txt, sub] = g.objectiveText();
    let chi = g.ch.hud();
    if (g.gps.dest && !(chi && g.ch.active)) chi = { title: `GPS: ${g.gps.label}`, sub: 'Follow the arrows on the road', target: g.gps.dest };
    const tgt = chi ? chi.target : g.objTarget, pp = g.wpos();
    let ot = st > 0 ? 'Escape NYPD pursuit' : txt, dist = '';
    if (chi) { ot = chi.title; dist = (tgt ? Math.round(Math.hypot(tgt.x - pp.x, tgt.z - pp.z)) + ' m · ' : '') + chi.sub; }
    else if (st > 0) dist = 'Get out of sight of the police until the stars fade · then: ' + txt;
    else if (tgt) dist = Math.round(Math.hypot(tgt.x - pp.x, tgt.z - pp.z)) + ' m · ' + sub;
    else dist = sub;
    $('objective').classList.toggle('challenge', !!chi);
    const ph = chi && chi.photo;
    if (this.cache.photo !== ph) { this.cache.photo = ph; if (ph) $('objPhoto').src = ph; $('objective').classList.toggle('photo', !!ph); }
    this.set('objText', ot);
    this.set('objDist', dist);
    // boss health
    const boss = chi && chi.boss;
    $('bossBar').style.display = boss && boss.state !== 'dead' ? 'block' : 'none';
    if (boss) { this.set('bossName', chi.title); this.set('bossFill', Math.max(0, boss.health / boss.maxHealth * 100) + '%', 'width'); }
    // compass
    const yaw = v ? v.yaw + g.camState.yawOff : p.yaw;
    const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const W = $('compass').clientWidth;
    this.strip.style.transform = `translateX(${W / 2 - heading * 3}px)`;
    if (tgt) {
      const b = ((Math.atan2(tgt.x - pp.x, -(tgt.z - pp.z)) * 180 / Math.PI) + 360) % 360;
      let rel = b; if (rel - heading > 180) rel -= 360; if (heading - rel > 180) rel += 360;
      this.cObj.style.display = 'block'; this.cObj.style.left = (rel * 3) + 'px'; this.cObj.style.color = chi ? '#ffd23a' : '';
    } else this.cObj.style.display = 'none';
    // fps
    const f = $('fps'); f.style.display = showFps ? 'block' : 'none';
    if (showFps && this.frame % 10 === 0) f.textContent = fps.toFixed(0) + ' FPS';
    if (this.frame % (g.settings.preset === 'low' ? 2 : 1) === 0) this.minimap(g, pp, yaw, tgt);
  }

  minimap(g, pp, yaw, target) {
    const c = this.mm, S = 200, R = S / 2;
    const range = g.player.vehicle ? (g.player.vehicle.flying ? 320 : 220) : 140;
    const k = R / range;
    c.save();
    c.clearRect(0, 0, S, S);
    c.beginPath(); c.arc(R, R, R - 1, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(8,10,28,.92)'; c.fillRect(0, 0, S, S);
    c.translate(R, R); c.rotate(yaw); c.scale(k, k); c.translate(-pp.x, -pp.z);
    // blocks
    c.fillStyle = '#1c1640';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = roadC(i) + ROAD / 2, z = roadC(j) + ROAD / 2;
      if (Math.abs(x + CELL / 2 - pp.x) > range + CELL || Math.abs(z + CELL / 2 - pp.z) > range + CELL) continue;
      c.fillRect(x, z, CELL - ROAD, CELL - ROAD);
    }
    if (g.city.plaza) { const P = g.city.plaza; c.fillStyle = '#0f3a4a'; c.fillRect(P.x - P.size / 2, P.z - P.size / 2, P.size, P.size); }
    // roads glow edges
    c.strokeStyle = 'rgba(41,243,255,.25)'; c.lineWidth = 1 / k;
    for (let i = 0; i <= N; i++) { c.beginPath(); c.moveTo(roadC(i), -HALF); c.lineTo(roadC(i), HALF); c.stroke(); c.beginPath(); c.moveTo(-HALF, roadC(i)); c.lineTo(HALF, roadC(i)); c.stroke(); }
    // elevated highways
    c.strokeStyle = 'rgba(255,164,58,.32)'; c.lineWidth = 16;
    for (const H of HIGHWAYS) { c.beginPath(); if (H.axis === 'z') { c.moveTo(H.c, -HALF + 12); c.lineTo(H.c, HALF - 12); } else { c.moveTo(-HALF + 12, H.c); c.lineTo(HALF - 12, H.c); } c.stroke(); }
    // entities
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, z, r / k, 0, 7); c.fill(); };
    for (const v of g.vehicles) {
      if (v === g.player.vehicle) continue;
      let col = v.mode === 'sky' ? 'rgba(160,140,255,.5)' : 'rgba(220,220,240,.6)';
      if (v.mode === 'police' || v.mode === 'policeAir') col = (Math.floor(g.time * 4) % 2) ? '#ff2040' : '#3a7aff';
      if (v.mode === 'parked' || v.mode === 'abandoned') col = v.flying ? '#29f3ff' : '#ffd23a';
      if (v.owned) col = '#3aff9a';
      dot(v.pos.x, v.pos.z, 2.6, col);
    }
    const rt = g.gps.route;
    if (g.gps.dest && rt.length > 1) { c.strokeStyle = '#ffd23a'; c.lineWidth = 4 / k; c.lineJoin = 'round'; c.beginPath(); c.moveTo(rt[0].x, rt[0].z); for (const q of rt) c.lineTo(q.x, q.z); c.stroke(); }
    for (const e of g.cops) if (e.state !== 'dead') dot(e.pos.x, e.pos.z, 2.4, '#ff2040');
    for (const d of g.drones) if (!d.dead) dot(d.pos.x, d.pos.z, 3, d.police ? '#3a7aff' : '#ff2bd6');
    for (const p of g.pickups) if (p.mesh.visible && !p.room) dot(p.mesh.position.x, p.mesh.position.z, 2, p.kind === 'health' ? '#3aff7a' : '#ffa43a');
    // challenges (coloured squares) and gang members (red)
    for (const def of CHALLENGES) {
      if (g.ch.done.has(def.id)) continue;
      const [i, j] = def.path ? def.path[0] : def.at, x = roadC(i), z = roadC(j);
      if (Math.abs(x - pp.x) > range || Math.abs(z - pp.z) > range) continue;
      c.fillStyle = TYPES[def.type].color; c.fillRect(x - 5 / k, z - 5 / k, 10 / k, 10 / k);
    }
    for (const e of g.gang) if (e.state !== 'dead' && (!e.neutral || e.alert === 2 || g.implants.has('hawk') || g.time - (e.scannedT || -99) < 20)) dot(e.pos.x, e.pos.z, 2.6, e.alert === 2 ? '#ff2040' : '#ffa43a');
    for (const f of g.ai.friends) if (f.alive && f.state !== 'car' && f.kind !== 'npc') dot(f.pos.x, f.pos.z, 2.6, '#3aff9a');
    const A = g.ch.active;
    if (A && A.areaC && !A.found && A.friend && A.friend.state === 'wait') { c.strokeStyle = 'rgba(185,140,255,.8)'; c.lineWidth = 2 / k; c.fillStyle = 'rgba(185,140,255,.15)'; c.beginPath(); c.arc(A.areaC.x, A.areaC.z, A.r, 0, 7); c.fill(); c.stroke(); }
    // shops you can go into (green)
    for (const d of g.city.doors) if (d.kind === 'hotel' && Math.abs(d.x - pp.x) < range && Math.abs(d.z - pp.z) < range) dot(d.x, d.z, 3.2, '#ffd27a');
    for (const d of g.city.doors) if (d.kind === 'shop' && Math.abs(d.x - pp.x) < range && Math.abs(d.z - pp.z) < range) { const gun = GUN_SHOPS.has(d.name), doc = CLINICS.has(d.name); dot(d.x, d.z, gun || doc ? 3.4 : 2.2, gun ? '#ff7a2a' : doc ? '#ffffff' : '#3aff9a'); }
    c.restore();
    // objective / challenge marker (clamped to edge)
    const t = target;
    if (t) {
      const dx = t.x - pp.x, dz = t.z - pp.z;
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      let mx = (dx * cs - dz * sn) * k, mz = (dx * sn + dz * cs) * k;
      const L = Math.hypot(mx, mz); if (L > R - 10) { mx *= (R - 10) / L; mz *= (R - 10) / L; }
      c.fillStyle = '#ffa43a'; c.strokeStyle = '#000'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(R + mx, R + mz - 7); c.lineTo(R + mx + 6, R + mz); c.lineTo(R + mx, R + mz + 7); c.lineTo(R + mx - 6, R + mz); c.closePath(); c.fill(); c.stroke();
    }
    // player arrow
    c.fillStyle = '#fff'; c.strokeStyle = '#29f3ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(R, R - 9); c.lineTo(R + 6, R + 6); c.lineTo(R, R + 3); c.lineTo(R - 6, R + 6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#29f3ff'; c.font = 'bold 12px Orbitron, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', R + Math.sin(yaw) * (R - 12), R - Math.cos(yaw) * (R - 12));
  }
}

// ---- the scanner (hold Q): names and info over the people in front of you ----
const pool = [];
const _v = { x: 0, y: 0, z: 0 };
export function updateScanner(g, camera, on) {
  const box = $('scan');
  box.classList.toggle('on', on);
  if (!on) return;
  const W = innerWidth, H = innerHeight, cam = camera.position;
  const list = [];
  const add = (pos, h, name, sub, color, hp, ref) => {
    const dx = pos.x - cam.x, dz = pos.z - cam.z, d = Math.hypot(dx, dz);
    if (d > (g.implants.has('hawk') ? 100 : 65)) return;
    const p = camera.position.clone ? null : null; void p;
    const v = pos.clone().setY(pos.y + h + 0.35).project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return;
    list.push({ x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, d, name, sub, color, hp, ref });
  };
  for (const e of g.peds) if (e.state !== 'dead' && e.state !== 'gone') add(e.pos, 1.9, e.scanName || (e.scanName = randomName()), 'CIVILIAN', '#e8f6ff');
  for (const e of g.cops) if (e.state !== 'dead') add(e.pos, 1.9, 'NYPD OFFICER', 'POLICE', '#4aa0ff');
  for (const e of g.gang) {
    if (e.state === 'dead' || e.ride) continue;
    e.scannedT = g.time;
    const F = FACTIONS[e.faction] || FACTIONS.skulls, st = e.alert === 2 ? 'HOSTILE' : e.alert === 1 ? 'SEARCHING' : 'UNAWARE';
    add(e.pos, 1.9 * e.root.scale.x, e.isBoss ? `★ BOUNTY: ${e.name}` : e.kind === 'psycho' ? 'CYBERPSYCHO' : (e.name || F.one), `${F.name} · ${st}${e.neutral && e.alert < 2 ? ' · LEAVES YOU ALONE' : ''}`, e.isBoss ? '#ffd27a' : F.color, e.health / e.maxHealth);
  }
  for (const f of g.ai.friends) if (f.alive && f.state !== 'car') add(f.pos, f.dog ? 1.0 : 1.9, f.name.toUpperCase(), { missing: 'MISSING PERSON · TALK TO THEM (E)', dog: 'LOST ROBOT DOG · PAT HIM (E)', informant: 'INFORMANT · CATCH HIM!', hostage: 'VICTIM · KEEP THEM SAFE', npc: 'WAITING FOR BOLT' }[f.kind] || '', '#3aff9a');
  list.sort((a, b) => a.d - b.d);
  const shown = list.slice(0, 14);
  // push labels apart so a crowd stays readable (nearest stays in place)
  for (let i = 1; i < shown.length; i++) for (let k = 0; k < 8; k++) {
    if (!shown.slice(0, i).some(o => Math.abs(o.x - shown[i].x) < 150 && Math.abs(o.y - shown[i].y) < 36)) break;
    shown[i].y -= 36;
  }
  let focus = null, fd = 90;
  for (const l of shown) { const d = Math.hypot(l.x - W / 2, l.y - H / 2); if (d < fd) { fd = d; focus = l; } }
  const wrap = $('scanLabels');
  while (pool.length < shown.length) { const el = document.createElement('div'); el.className = 'scan-label'; wrap.appendChild(el); pool.push(el); }
  pool.forEach((el, i) => {
    const l = shown[i];
    if (!l) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.style.left = l.x + 'px'; el.style.top = l.y + 'px';
    el.style.borderLeftColor = l.color; el.style.color = l.color;
    el.classList.toggle('focus', l === focus);
    const key = l.name + l.sub + (l === focus) + (l.hp !== undefined ? Math.round(l.hp * 20) : '');
    if (el._k !== key) {
      el._k = key;
      el.innerHTML = '';
      el.appendChild(document.createTextNode(l.name));
      const sm = document.createElement('small'); sm.textContent = l === focus || !l.sub.startsWith('CIVILIAN') ? l.sub : ''; el.appendChild(sm);
      if (l === focus && l.hp !== undefined) { const hp = document.createElement('div'); hp.className = 'hp'; const i2 = document.createElement('i'); i2.style.width = Math.max(0, l.hp * 100) + '%'; hp.appendChild(i2); el.appendChild(hp); }
    }
  });
}
