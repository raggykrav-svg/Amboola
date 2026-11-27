// The big map (Tab, or MAP in the pause menu): the whole city with shops, gun shops, hotels,
// challenges and your cars. Click anywhere, then SET DESTINATION, and the GPS paints a line of
// arrows on the roads to get you there. Mouse wheel zooms, dragging moves the map.
import { CITY } from './textures.js';
import { HIGHWAYS } from './highway.js';
import { GUN_SHOPS, CLINICS } from './city.js';
import { CHALLENGES, TYPES } from './challenges.js';

const { CELL, ROAD, N, HALF } = CITY;
const roadC = i => -HALF + i * CELL;
const $ = id => document.getElementById(id);

export class MapScreen {
  constructor() {
    this.cv = $('mapCanvas'); this.c = this.cv.getContext('2d');
    this.zoom = 1; this.cx = 0; this.cz = 0; this.pick = null; this.game = null;
    this.filters = { shop: true, guns: true, clinic: true, hotel: true, food: true, atm: true, tags: true, cars: true, challenges: true };
    document.querySelectorAll('#mapFilters input').forEach(cb => { cb.onchange = () => { this.filters[cb.dataset.f] = cb.checked; this.draw(); }; });
    this.cv.addEventListener('mousemove', e => { const rr = this.cv.getBoundingClientRect(); this.hover(e.clientX - rr.left, e.clientY - rr.top); });
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
    $('mapGo').onclick = () => { if (this.pick && this.game) { const G = this.game.gps; G.set(this.pick, this.pick.label); G.route = G._path(this.game.wpos(), G.dest); this.draw(); this._info(); } };
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

  // the district a point is in (our own districts of NYC 3000)
  static district(x, z) {
    const bi = Math.floor((x + HALF) / CELL), bj = Math.floor((z + HALF) / CELL);
    const P = MapScreen.plaza;
    if (P ? Math.hypot(x - P.x, z - P.z) < 110 : (bi === 4 || bi === 5) && (bj === 4 || bj === 5)) return 'TIMES SQUARE';
    if (bi >= 3 && bi <= 6 && bj >= 3 && bj <= 6) return 'MIDTOWN SPIRES';
    if (bi <= 2 && bj >= 3 && bj <= 6) return 'NEON MARKET';
    if (bi >= 7 && bj >= 3 && bj <= 6) return 'HARBOR SIDE';
    if (bj <= 2) return 'NORTH YARDS';
    return 'SOUTH BAY';
  }

  draw() {
    const g = this.game; if (!g) return;
    const c = this.c, W = this.cv.width, H = this.cv.height, k = this._scale(), F = this.filters;
    const RED = '#ff5a4e', YEL = '#f6e24a';
    // background: dark teal with a faint grid, like a holo display
    const bg = c.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#0d1a1f'); bg.addColorStop(1, '#05080b');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-this.cx, -this.cz);
    c.strokeStyle = 'rgba(255,90,78,.05)'; c.lineWidth = 1 / k;
    for (let v = -HALF - 120; v <= HALF + 120; v += 21) { c.beginPath(); c.moveTo(v, -HALF - 120); c.lineTo(v, HALF + 120); c.stroke(); c.beginPath(); c.moveTo(-HALF - 120, v); c.lineTo(HALF + 120, v); c.stroke(); }
    // streets
    c.fillStyle = '#0a1013'; c.fillRect(-HALF - 12, -HALF - 12, 2 * HALF + 24, 2 * HALF + 24);
    c.strokeStyle = 'rgba(255,90,78,.35)'; c.lineWidth = 1.3 / k;
    for (let i = 0; i <= N; i++) { c.beginPath(); c.moveTo(roadC(i), -HALF); c.lineTo(roadC(i), HALF); c.stroke(); c.beginPath(); c.moveTo(-HALF, roadC(i)); c.lineTo(HALF, roadC(i)); c.stroke(); }
    c.strokeStyle = 'rgba(246,226,74,.5)'; c.lineWidth = 9;
    for (const Hh of HIGHWAYS) { c.beginPath(); if (Hh.axis === 'z') { c.moveTo(Hh.c, -HALF + 12); c.lineTo(Hh.c, HALF - 12); } else { c.moveTo(-HALF + 12, Hh.c); c.lineTo(HALF - 12, Hh.c); } c.stroke(); }
    // buildings as extruded blocks seen from a tilted camera: back ones first
    const lift = 0.5;
    const lots = [...g.city.lots].sort((a, b) => (a.bz + a.ld / 2) - (b.bz + b.ld / 2));
    for (const l of lots) {
      const x0 = l.bx - l.lw / 2, z0 = l.bz - l.ld / 2, w = l.lw, d = l.ld, h = (l.topH || l.h || 20) * lift;
      const big = l.style === 'corp' || l.style === 'mega';
      const fg = c.createLinearGradient(0, z0 + d - h, 0, z0 + d); fg.addColorStop(0, big ? '#5a1c1c' : '#3a1416'); fg.addColorStop(1, '#0c0608');
      c.fillStyle = fg; c.fillRect(x0, z0 + d - h, w, h); // front face
      c.fillStyle = big ? 'rgba(255,90,78,.32)' : `rgba(255,90,78,${0.1 + Math.min(0.18, h / 400)})`;
      c.fillRect(x0, z0 - h, w, d); // roof
      c.strokeStyle = big ? 'rgba(255,120,100,.95)' : 'rgba(255,90,78,.6)'; c.lineWidth = (big ? 1.6 : 1) / k;
      c.strokeRect(x0, z0 - h, w, d);
      c.beginPath(); c.moveTo(x0, z0 + d - h); c.lineTo(x0, z0 + d); c.lineTo(x0 + w, z0 + d); c.lineTo(x0 + w, z0 + d - h); c.stroke();
    }
    // the GPS route (drawn on top so it is never hidden)
    const r = g.gps.route;
    if (g.gps.dest && r.length > 1) {
      c.strokeStyle = YEL; c.lineWidth = 5 / k; c.lineJoin = 'round'; c.shadowColor = YEL; c.shadowBlur = 8;
      c.beginPath(); c.moveTo(r[0].x, r[0].z); for (const pt of r) c.lineTo(pt.x, pt.z); c.stroke(); c.shadowBlur = 0;
    }
    if (g.city.plaza) { const P = g.city.plaza; c.strokeStyle = 'rgba(41,243,255,.7)'; c.lineWidth = 1.5 / k; c.strokeRect(P.x - P.size / 2, P.z - P.size / 2, P.size, P.size); }
    // district names
    c.font = `900 ${Math.round(9 + 4 * this.zoom)}px Orbitron, Arial Black`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    for (const [name, x, z] of [['TIMES SQUARE', (MapScreen.plaza || { x: 0 }).x, (MapScreen.plaza || { z: 30 }).z], ['MIDTOWN SPIRES', 0, -128], ['NEON MARKET', -330, 40], ['HARBOR SIDE', 300, -40], ['NORTH YARDS', 0, -300], ['SOUTH BAY', 0, 300]]) {
      const [px, py] = this._toPx(x, z);
      c.fillStyle = 'rgba(246,226,74,.3)'; c.fillText(name.split('').join(' '), px, py);
    }
    c.restore();
    c.restore();
    // icons (fixed size on screen), and remember them for the tooltip
    this.icons = [];
    const glyph = (x, z, kind, label, color, big = false) => {
      const [px, py] = this._toPx(x, z); if (px < -12 || py < -12 || px > W + 12 || py > H + 12) return;
      this.icons.push({ px, py, label });
      const s = big ? 10 : 7;
      c.save(); c.translate(px, py);
      c.fillStyle = '#070a0d'; c.strokeStyle = color; c.lineWidth = 2;
      if (kind === 'diamond') { c.beginPath(); c.moveTo(0, -s - 3); c.lineTo(s + 3, 0); c.lineTo(0, s + 3); c.lineTo(-s - 3, 0); c.closePath(); c.fill(); c.stroke(); }
      else { c.beginPath(); c.arc(0, 0, s, 0, 7); c.fill(); c.stroke(); }
      c.fillStyle = color; c.strokeStyle = color; c.lineWidth = 1.8;
      if (kind === 'shop') { c.fillRect(-3.5, -1.5, 7, 5); c.beginPath(); c.arc(0, -1.5, 2.5, Math.PI, 0); c.stroke(); }
      else if (kind === 'gun') { c.beginPath(); c.arc(0, 0, 4, 0, 7); c.stroke(); c.fillRect(-0.8, -7, 1.6, 4); c.fillRect(-0.8, 3, 1.6, 4); c.fillRect(-7, -0.8, 4, 1.6); c.fillRect(3, -0.8, 4, 1.6); }
      else if (kind === 'clinic') { c.fillRect(-1.5, -4.5, 3, 9); c.fillRect(-4.5, -1.5, 9, 3); }
      else if (kind === 'hotel') { c.font = '900 10px Orbitron, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', 0, 1); }
      else if (kind === 'food') { c.beginPath(); c.arc(0, 0, 4, 0, Math.PI); c.fill(); c.fillRect(-1, -5, 1, 4); c.fillRect(1.5, -5, 1, 4); }
      else if (kind === 'atm') { c.font = '900 10px Orbitron, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 0, 1); }
      else if (kind === 'tag') { c.beginPath(); c.arc(-1.8, -1, 1.2, 0, 7); c.arc(1.8, -1, 1.2, 0, 7); c.fill(); c.beginPath(); c.arc(0, 1, 2.5, 0.2, Math.PI - 0.2); c.stroke(); }
      else if (kind === 'home') { c.beginPath(); c.moveTo(0, -6); c.lineTo(6, 0); c.lineTo(-6, 0); c.closePath(); c.fill(); c.fillRect(-4, 0, 8, 5); }
      else if (kind === 'car') { c.fillRect(-4, -1, 8, 3); c.fillRect(-2.5, -3.5, 5, 3); }
      else if (kind === 'diamond') { c.font = '13px "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label.icon, 0, 1); }
      c.restore();
    };
    const zoomed = this.zoom >= 2.8;
    for (const d of g.city.doors) {
      if (d.kind === 'hotel' && F.hotel && this.zoom >= 1.9) glyph(d.x, d.z, 'hotel', d.name, '#ffd27a');
      else if (d.kind === 'shop' && GUN_SHOPS.has(d.name) && F.guns) glyph(d.x, d.z, 'gun', `GUN SHOP: ${d.name}`, '#ff8a3a');
      else if (d.kind === 'shop' && CLINICS.has(d.name) && F.clinic) glyph(d.x, d.z, 'clinic', `CYBER CLINIC: ${d.name}`, '#3aff9a');
      else if (d.kind === 'shop' && !GUN_SHOPS.has(d.name) && !CLINICS.has(d.name) && F.shop && zoomed) glyph(d.x, d.z, 'shop', `SHOP: ${d.name}`, '#29f3ff');
    }
    if (F.food && this.zoom >= 2.3) for (const s of g.city.stalls) if (s.label !== 'ROBO PARTS') glyph(s.x, s.z, 'food', `FOOD: ${s.label}`, '#ff9ad8');
    if (F.atm && zoomed) for (const a of g.acts.atms) if (!a.hacked) glyph(a.x, a.z, 'atm', 'ATM (hack it!)', '#3aff9a');
    if (F.tags) g.acts.tags.forEach((t, i) => { if (g.acts.found.has(i)) glyph(t.x, t.z, 'tag', 'NEON TAG (found)', '#ff2bd6'); });
    if (g.home.owned && g.home.door) glyph(g.home.door.x, g.home.door.z, 'home', 'YOUR APARTMENT', '#ffd23a', true);
    if (F.cars) for (const v of g.vehicles) if (v.owned) glyph(v.pos.x, v.pos.z, 'car', `YOUR ${v.def.name}`, '#3aff9a');
    if (F.challenges) for (const def of CHALLENGES) {
      if (g.ch.done.has(def.id)) continue;
      const [i, j] = def.path ? def.path[0] : def.at, T2 = TYPES[def.type];
      const lab = { icon: T2.icon, toString() { return `${T2.label}: ${def.name} · $${def.cash}`; } };
      glyph(roadC(i), roadC(j), 'diamond', lab, T2.color, true);
    }
    // destination and the spot you clicked
    const pin = (pt, col) => { const [px, py] = this._toPx(pt.x, pt.z); c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(px - 8, py - 16); c.arc(px, py - 18, 8, Math.PI * 0.85, Math.PI * 0.15); c.closePath(); c.fill(); c.stroke(); };
    if (g.gps.dest) pin(g.gps.dest, YEL);
    if (this.pick) pin(this.pick, '#29f3ff');
    // you
    const p = g.wpos(), [px, py] = this._toPx(p.x, p.z), yaw = g.player.vehicle ? g.player.vehicle.yaw : g.player.yaw;
    c.save(); c.translate(px, py); c.rotate(-yaw);
    c.shadowColor = '#29f3ff'; c.shadowBlur = 12;
    c.fillStyle = '#e8fbff'; c.strokeStyle = '#29f3ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // scanlines over everything
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    $('mapDistrict').textContent = MapScreen.district(p.x, p.z);
  }
  // the name under the mouse
  hover(px, py) {
    const tip = $('mapTip'); let best = null, bd = 13;
    for (const ic of this.icons || []) { const d = Math.hypot(ic.px - px, ic.py - py); if (d < bd) { bd = d; best = ic; } }
    if (!best) { tip.style.display = 'none'; return; }
    tip.textContent = String(best.label); tip.style.display = 'block'; tip.style.left = (best.px + 14) + 'px'; tip.style.top = (best.py - 10) + 'px';
  }
}
