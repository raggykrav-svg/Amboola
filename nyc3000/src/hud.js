// HUD: bars, ammo, wanted stars, minimap, compass, prompts.
import { WEAPONS } from './models.js';
import { CITY } from './textures.js';
import { roadC } from './city.js';

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
    $('wSlots').innerHTML = WEAPONS.map((w, i) => `<span data-i="${i}">${i + 1} ${w.id.toUpperCase()}</span>`).join('');
    this.frame = 0;
  }
  show(on) { this.el.classList.toggle('show', on); }
  set(id, v, prop = 'textContent') {
    const k = id + prop; if (this.cache[k] === v) return; this.cache[k] = v;
    if (prop === 'width') $(id).style.width = v; else $(id)[prop] = v;
  }
  toast(msg) { const t = $('toast'); t.textContent = msg; t.style.opacity = 1; this.toastT = 2.2; }
  kick(a) { this.spread = Math.min(30, this.spread + a); }
  hitmark() { this.hitT = 0.15; }
  prompt(html) { if (this.cache.prompt === html) return; this.cache.prompt = html; const p = $('prompt'); p.innerHTML = html; p.style.display = html ? 'block' : 'none'; }
  dead(on) { $('dead').classList.toggle('show', on); }

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
      this.set('wName', w.name); this.set('ammoMag', String(a.mag)); this.set('ammoRes', String(a.res));
      $('ammo').classList.toggle('low', a.mag <= Math.ceil(w.mag * 0.25));
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
    // toast
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').style.opacity = 0; }
    // wanted
    const st = g.stars;
    const sk = st + '|' + (g.policeSeen ? 1 : 0);
    if (this.cache.stars !== sk) {
      this.cache.stars = sk;
      $('stars').innerHTML = [0, 1, 2, 3, 4].map(i => `<span class="${i < st ? 'on' : ''}">★</span>`).join('');
      $('stars').classList.toggle('flash', st > 0 && !g.policeSeen);
      $('wantedLabel').textContent = st ? (g.policeSeen ? 'NYPD IN PURSUIT' : 'EVADING…') : '';
    }
    // objective
    const [txt, sub] = g.objectiveText();
    const ot = st > 0 ? 'Escape NYPD pursuit' : txt;
    this.set('objText', ot);
    const tgt = g.objTarget, pp = v ? v.pos : p.pos;
    let dist = '';
    if (st > 0) dist = 'Get out of sight of the police until the stars fade · then: ' + txt;
    else if (tgt) dist = Math.round(Math.hypot(tgt.x - pp.x, tgt.z - pp.z)) + ' m · ' + sub;
    else dist = sub;
    this.set('objDist', dist);
    // compass
    const yaw = v ? v.yaw + g.camState.yawOff : p.yaw;
    const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const W = $('compass').clientWidth;
    this.strip.style.transform = `translateX(${W / 2 - heading * 3}px)`;
    if (tgt) {
      const b = ((Math.atan2(tgt.x - pp.x, -(tgt.z - pp.z)) * 180 / Math.PI) + 360) % 360;
      let rel = b; if (rel - heading > 180) rel -= 360; if (heading - rel > 180) rel += 360;
      this.cObj.style.display = 'block'; this.cObj.style.left = (rel * 3) + 'px';
    } else this.cObj.style.display = 'none';
    // fps
    const f = $('fps'); f.style.display = showFps ? 'block' : 'none';
    if (showFps && this.frame % 10 === 0) f.textContent = fps.toFixed(0) + ' FPS';
    if (this.frame % (g.settings.preset === 'low' ? 2 : 1) === 0) this.minimap(g, pp, yaw);
  }

  minimap(g, pp, yaw) {
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
    // entities
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, z, r / k, 0, 7); c.fill(); };
    for (const v of g.vehicles) {
      if (v === g.player.vehicle) continue;
      let col = v.mode === 'sky' ? 'rgba(160,140,255,.5)' : 'rgba(220,220,240,.6)';
      if (v.mode === 'police' || v.mode === 'policeAir') col = (Math.floor(g.time * 4) % 2) ? '#ff2040' : '#3a7aff';
      if (v.mode === 'parked' || v.mode === 'abandoned') col = v.flying ? '#29f3ff' : '#ffd23a';
      dot(v.pos.x, v.pos.z, 2.6, col);
    }
    for (const e of g.cops) if (e.state !== 'dead') dot(e.pos.x, e.pos.z, 2.4, '#ff2040');
    for (const d of g.drones) if (!d.dead) dot(d.pos.x, d.pos.z, 3, d.police ? '#3a7aff' : '#ff2bd6');
    for (const p of g.pickups) if (p.mesh.visible) dot(p.mesh.position.x, p.mesh.position.z, 2, p.kind === 'health' ? '#3aff7a' : '#ffa43a');
    c.restore();
    // objective marker (clamped to edge)
    const t = g.objTarget;
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
