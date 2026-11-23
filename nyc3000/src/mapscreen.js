// The big map (Tab, or MAP in the pause menu): the whole city with shops, gun shops, hotels,
// challenges and your cars. Click anywhere, then SET DESTINATION, and the GPS paints a line of
// arrows on the roads to get you there. Mouse wheel zooms, dragging moves the map.
import { CITY } from './textures.js';
import { HIGHWAYS } from './highway.js';
import { GUN_SHOPS } from './city.js';
import { CHALLENGES, TYPES } from './challenges.js';

const { CELL, ROAD, N, HALF } = CITY;
const roadC = i => -HALF + i * CELL;
const $ = id => document.getElementById(id);

export class MapScreen {
  constructor() {
    this.cv = $('mapCanvas'); this.c = this.cv.getContext('2d');
    this.zoom = 1; this.cx = 0; this.cz = 0; this.pick = null; this.game = null;
    let drag = null;
    this.cv.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz, moved: false }; });
    addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      const k = this._scale();
      this.cx = drag.cx - dx / k; this.cz = drag.cz - dy / k; this.draw();
    });
    addEventListener('mouseup', e => {
      if (!drag) return;
      const moved = drag.moved; drag = null;
      if (!moved && e.target === this.cv) { const r = this.cv.getBoundingClientRect(); this.select(this._toWorld(e.clientX - r.left, e.clientY - r.top)); }
    });
    this.cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.max(0.7, Math.min(5, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); this.draw(); }, { passive: false });
    $('mapGo').onclick = () => { if (this.pick && this.game) { this.game.gps.set(this.pick, this.pick.label); this.draw(); this._info(); } };
    $('mapClear').onclick = () => { if (this.game) { this.game.gps.clear(); this.pick = null; this.draw(); this._info(); } };
    document.querySelectorAll('#mapQuick button').forEach(b => { b.onclick = () => this.quick(b.dataset.q); });
  }
  _scale() { return (this.cv.height / (2 * HALF + 80)) * this.zoom; }
  _toWorld(px, py) { const k = this._scale(); return { x: this.cx + (px - this.cv.width / 2) / k, z: this.cz + (py - this.cv.height / 2) / k }; }
  _toPx(x, z) { const k = this._scale(); return [this.cv.width / 2 + (x - this.cx) * k, this.cv.height / 2 + (z - this.cz) * k]; }

  open(game) {
    this.game = game;
    const r = this.cv.parentElement.getBoundingClientRect();
    this.cv.width = Math.max(300, Math.floor(r.width)); this.cv.height = Math.max(260, Math.floor(r.height));
    const p = game.wpos(); this.cx = Math.max(-HALF, Math.min(HALF, p.x)); this.cz = Math.max(-HALF, Math.min(HALF, p.z));
    this.zoom = 1.6; this.pick = null;
    this.draw(); this._info();
  }
  // what is near a clicked point (a door, a challenge), so the destination gets a name
  select(w) {
    const g = this.game; if (!g) return;
    let best = null, bd = 40 / Math.max(1, this.zoom * 0.7);
    for (const d of g.city.doors) {
      if (d.kind === 'flat') continue;
      const dd = Math.hypot(d.x - w.x, d.z - w.z);
      if (dd < bd) { bd = dd; best = { x: d.x + d.nx * 2, z: d.z + d.nz * 2, label: d.kind === 'hotel' ? d.name : GUN_SHOPS.has(d.name) ? `GUN SHOP: ${d.name}` : `SHOP: ${d.name}` }; }
    }
    for (const def of CHALLENGES) {
      if (g.ch.done.has(def.id)) continue;
      const [i, j] = def.path ? def.path[0] : def.at, x = roadC(i), z = roadC(j), dd = Math.hypot(x - w.x, z - w.z);
      if (dd < bd) { bd = dd; best = { x, z, label: `${TYPES[def.type].label}: ${def.name}` }; }
    }
    this.pick = best || { x: Math.max(-HALF, Math.min(HALF, w.x)), z: Math.max(-HALF, Math.min(HALF, w.z)), label: 'MAP MARKER' };
    this.game.audio.play('ui');
    this.draw(); this._info();
  }
  quick(q) {
    const g = this.game, p = g.wpos();
    let best = null, bd = Infinity;
    const consider = (x, z, label) => { const d = Math.hypot(x - p.x, z - p.z); if (d < bd && d > 25) { bd = d; best = { x, z, label }; } };
    if (q === 'challenge') {
      for (const def of CHALLENGES) if (!g.ch.done.has(def.id)) { const [i, j] = def.path ? def.path[0] : def.at; consider(roadC(i), roadC(j), `${TYPES[def.type].label}: ${def.name}`); }
    } else for (const d of g.city.doors) {
      const ok = q === 'hotel' ? d.kind === 'hotel' : q === 'guns' ? d.kind === 'shop' && GUN_SHOPS.has(d.name) : d.kind === 'shop' && !GUN_SHOPS.has(d.name);
      if (ok) consider(d.x + d.nx * 2, d.z + d.nz * 2, q === 'hotel' ? d.name : q === 'guns' ? `GUN SHOP: ${d.name}` : `SHOP: ${d.name}`);
    }
    if (!best) return;
    this.pick = best; this.cx = best.x; this.cz = best.z;
    this.draw(); this._info(); g.audio.play('ui');
  }
  _info() {
    const g = this.game, cur = g && g.gps.dest;
    $('mapPick').textContent = this.pick ? this.pick.label : 'Click on the map to choose where to go';
    $('mapDist').textContent = this.pick ? `${Math.round(Math.hypot(this.pick.x - g.wpos().x, this.pick.z - g.wpos().z))} m away` : '';
    $('mapGo').disabled = !this.pick;
    $('mapClear').style.display = cur ? '' : 'none';
    $('mapCur').textContent = cur ? `GPS: ${g.gps.label}` : '';
  }

  draw() {
    const g = this.game; if (!g) return;
    const c = this.c, W = this.cv.width, H = this.cv.height, k = this._scale();
    c.fillStyle = '#070816'; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-this.cx, -this.cz);
    // blocks and roads
    c.fillStyle = '#121532'; c.fillRect(-HALF - 40, -HALF - 40, 2 * HALF + 80, 2 * HALF + 80);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { c.fillStyle = '#26205a'; c.fillRect(roadC(i) + ROAD / 2, roadC(j) + ROAD / 2, CELL - ROAD, CELL - ROAD); }
    for (const l of g.city.lots) {
      c.fillStyle = l.style === 'corp' ? '#3a2f80' : l.style === 'mega' ? '#332a6e' : l.style === 'low' ? '#2c2450' : '#30286a';
      c.fillRect(l.bx - l.lw / 2, l.bz - l.ld / 2, l.lw, l.ld);
    }
    if (g.city.plaza) { const P = g.city.plaza; c.fillStyle = '#0f3a4a'; c.fillRect(P.x - P.size / 2, P.z - P.size / 2, P.size, P.size); }
    c.strokeStyle = 'rgba(41,243,255,.28)'; c.lineWidth = 1.2 / k;
    for (let i = 0; i <= N; i++) { c.beginPath(); c.moveTo(roadC(i), -HALF); c.lineTo(roadC(i), HALF); c.stroke(); c.beginPath(); c.moveTo(-HALF, roadC(i)); c.lineTo(HALF, roadC(i)); c.stroke(); }
    c.strokeStyle = 'rgba(255,164,58,.45)'; c.lineWidth = 14;
    for (const Hh of HIGHWAYS) { c.beginPath(); if (Hh.axis === 'z') { c.moveTo(Hh.c, -HALF + 12); c.lineTo(Hh.c, HALF - 12); } else { c.moveTo(-HALF + 12, Hh.c); c.lineTo(HALF - 12, Hh.c); } c.stroke(); }
    // the GPS route
    const r = g.gps.route;
    if (g.gps.dest && r.length > 1) {
      c.strokeStyle = '#ffd23a'; c.lineWidth = 5 / k; c.lineJoin = 'round'; c.beginPath(); c.moveTo(r[0].x, r[0].z);
      for (const pt of r) c.lineTo(pt.x, pt.z); c.stroke();
    }
    c.restore();
    // icons (fixed size on screen)
    const icon = (x, z, col, r2, sq) => { const [px, py] = this._toPx(x, z); if (px < -10 || py < -10 || px > W + 10 || py > H + 10) return; c.fillStyle = col; c.beginPath(); if (sq) c.rect(px - r2, py - r2, r2 * 2, r2 * 2); else c.arc(px, py, r2, 0, 7); c.fill(); };
    const showDoors = this.zoom > 1.3;
    for (const d of g.city.doors) {
      if (d.kind === 'hotel') icon(d.x, d.z, '#ffd27a', 4);
      else if (d.kind === 'shop' && GUN_SHOPS.has(d.name)) icon(d.x, d.z, '#ff7a2a', 4);
      else if (d.kind === 'shop' && showDoors) icon(d.x, d.z, '#3aff9a', 2.2);
    }
    for (const def of CHALLENGES) { if (g.ch.done.has(def.id)) continue; const [i, j] = def.path ? def.path[0] : def.at; icon(roadC(i), roadC(j), TYPES[def.type].color, 6, true); }
    for (const v of g.vehicles) if (v.owned) icon(v.pos.x, v.pos.z, '#3aff9a', 5, true);
    // destination and the spot you clicked
    const pin = (pt, col) => { const [px, py] = this._toPx(pt.x, pt.z); c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(px - 8, py - 16); c.arc(px, py - 18, 8, Math.PI * 0.85, Math.PI * 0.15); c.closePath(); c.fill(); c.stroke(); };
    if (g.gps.dest) pin(g.gps.dest, '#ffd23a');
    if (this.pick) pin(this.pick, '#29f3ff');
    // you
    const p = g.wpos(), [px, py] = this._toPx(p.x, p.z), yaw = g.player.vehicle ? g.player.vehicle.yaw : g.player.yaw;
    c.save(); c.translate(px, py); c.rotate(-yaw);
    c.fillStyle = '#fff'; c.strokeStyle = '#29f3ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -11); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
}
