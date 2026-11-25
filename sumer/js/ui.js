// Minimap, the big map with fast travel, and map drawing shared by both.
import { chunk } from './data.js';

const MC = {
  sea: '#8fd0ea', LAND: '#f3eee3', FARM: '#ebe3c4', INDUSTRIAL: '#e6e2dc', INST: '#efe6d6', DIRT: '#eadfc6', CEMETERY: '#cfe0bd', SCRUB: '#dfe2bf',
  GRASS: '#bfe0a0', WOOD: '#a9d38f', SAND: '#f8e8b8', PITCHGRASS: '#a6d88c', PITCHHARD: '#a9c7d6', PITCHCLAY: '#e6b49b', TRACK: '#e6a58f', PLAYGROUND: '#f0c7b2',
  PARKING: '#e4e1dc', WATER: '#8fd0ea', POOL: '#9fe0f4', PAVING: '#efe8dc', TRACKDIRT: '#e8dcc1', ASPHALT: '#ffffff', CYCLE: '#f3c3b6', FOOTPATH: '#f8f4ec',
  SIDEWALK: '#ece6da', PIER: '#e2d8c4', BREAKWATER: '#cfc9be', bld: '#dcd1c1', bldLine: '#c4b8a5',
};

function poly(ctx, rings, s, ox, oz) {
  ctx.beginPath();
  for (const r of rings) {
    ctx.moveTo((r[0] - ox) * s, (r[1] - oz) * s);
    for (let i = 2; i < r.length; i += 2) ctx.lineTo((r[i] - ox) * s, (r[i + 1] - oz) * s);
    ctx.closePath();
  }
  ctx.fill('evenodd');
}

export class MapPainter {
  constructor(city) {
    this.city = city; this.data = city.data;
    this.cls = city.h.cls;
    this.tiles = new Map(); this.TP = 320;
  }
  tile(ci) {
    let t = this.tiles.get(ci);
    if (t) { this.tiles.delete(ci); this.tiles.set(ci, t); return t; }
    const g = this.city.g, P = this.TP, s = P / g.cs;
    const cv = document.createElement('canvas'); cv.width = cv.height = P;
    const ctx = cv.getContext('2d');
    const c = chunk(this.data, ci);
    ctx.fillStyle = MC.sea; ctx.fillRect(0, 0, P, P);
    const list = c.ground.slice().sort((a, b) => a.cls - b.cls);
    for (const gp of list) { ctx.fillStyle = MC[this.cls[gp.cls]] || '#f00'; poly(ctx, gp.rings, s, c.ox, c.oz); }
    // buildings from this chunk and neighbours that overlap
    const ix = ci % g.nx, iz = Math.floor(ci / g.nx);
    ctx.lineWidth = 1; ctx.strokeStyle = MC.bldLine;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= g.nx || jz >= g.nz) continue;
      const cc = chunk(this.data, jz * g.nx + jx);
      for (const b of cc.buildings) {
        const bb = b.bb; if (!bb || bb[2] < c.ox || bb[0] > c.ox + g.cs || bb[3] < c.oz || bb[1] > c.oz + g.cs) continue;
        ctx.fillStyle = b.style === 5 ? '#e9c9a3' : b.style === 8 ? '#d6b98f' : MC.bld;
        poly(ctx, b.rings, s, c.ox, c.oz); ctx.stroke();
      }
    }
    t = cv; this.tiles.set(ci, t);
    if (this.tiles.size > 48) this.tiles.delete(this.tiles.keys().next().value);
    return t;
  }

  // whole-city overview image (built once, in slices)
  *worldGen(mpp) {
    const A = this.city.h.area, g = this.city.g;
    const W = Math.ceil((A[2] - A[0]) / mpp), H = Math.ceil((A[3] - A[1]) / mpp);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); const s = 1 / mpp;
    ctx.fillStyle = MC.sea; ctx.fillRect(0, 0, W, H);
    const n = g.nx * g.nz;
    for (let ci = 0; ci < n; ci++) {
      const c = chunk(this.data, ci);
      const list = c.ground.slice().sort((a, b) => a.cls - b.cls);
      for (const gp of list) {
        const name = this.cls[gp.cls];
        if (name === 'SIDEWALK' || name === 'FOOTPATH' || name === 'ASPHALT') continue;
        ctx.fillStyle = MC[name]; poly(ctx, gp.rings, s, A[0], A[1]);
      }
      if (ci % 200 === 0) yield ci / n * 0.5;
    }
    ctx.fillStyle = '#ddd2c2';
    for (let ci = 0; ci < n; ci++) {
      const c = chunk(this.data, ci);
      for (const b of c.buildings) poly(ctx, b.rings, s, A[0], A[1]);
      if (ci % 300 === 0) yield 0.5 + ci / n * 0.2;
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      for (let ci = 0; ci < n; ci++) {
        const c = chunk(this.data, ci);
        for (const rd of c.roads) {
          if (rd.path && rd.cls !== 10) continue;
          const major = rd.cls <= 4 || rd.cls === 9;
          if (pass === 0) { ctx.strokeStyle = major ? '#e3b15a' : '#d4cbbb'; ctx.lineWidth = Math.max(1, (rd.w + 2.5) * s); }
          else { ctx.strokeStyle = major ? '#ffd98a' : '#ffffff'; ctx.lineWidth = Math.max(0.7, rd.w * s); }
          const p = rd.pts; ctx.beginPath(); ctx.moveTo((p[0] - A[0]) * s, (p[1] - A[1]) * s);
          for (let i = 2; i < p.length; i += 2) ctx.lineTo((p[i] - A[0]) * s, (p[i + 1] - A[1]) * s);
          ctx.stroke();
        }
        if (ci % 400 === 0) yield 0.7 + pass * 0.15 + ci / n * 0.15;
      }
    }
    this.world = { cv, mpp };
    yield 1;
  }
}

export class Minimap {
  constructor(canvas, painter, north) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.p = painter; this.north = north;
    this.range = 120; // metres from centre to edge
  }
  draw(x, z, yaw, landmarks, found, target) {
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height, cx = W / 2, cy = H / 2;
    const g = this.p.city.g, s = (W / 2) / this.range;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = MC.sea; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(yaw); ctx.scale(s, s); ctx.translate(-x, -z);
    const R = this.range * 1.45;
    const ix0 = Math.floor((x - R - g.x0) / g.cs), ix1 = Math.floor((x + R - g.x0) / g.cs), iz0 = Math.floor((z - R - g.z0) / g.cs), iz1 = Math.floor((z + R - g.z0) / g.cs);
    ctx.imageSmoothingEnabled = true;
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz) continue;
      const t = this.p.tile(iz * g.nx + ix);
      ctx.drawImage(t, g.x0 + ix * g.cs, g.z0 + iz * g.cs, g.cs + 0.4, g.cs + 0.4);
    }
    ctx.restore();
    // landmarks (upright icons)
    ctx.font = `${Math.round(W * 0.07)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (const L of landmarks) {
      const dx = (L.x - x) * s, dz = (L.z - z) * s;
      let px = dx * c - dz * sn, py = dx * sn + dz * c;
      const d = Math.hypot(px, py), lim = W / 2 - W * 0.06;
      const isT = target && target.id === L.id;
      if (d > lim) { if (!isT) continue; px *= lim / d; py *= lim / d; }
      ctx.globalAlpha = found.has(L.id) ? 0.55 : 1;
      if (isT) { ctx.fillStyle = 'rgba(255,181,61,.9)'; ctx.beginPath(); ctx.arc(cx + px, cy + py, W * 0.055, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillText(L.i, cx + px, cy + py);
      ctx.globalAlpha = 1;
    }
    // player arrow
    ctx.fillStyle = '#e8453c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = W * 0.012;
    ctx.beginPath(); ctx.moveTo(cx, cy - W * 0.05); ctx.lineTo(cx + W * 0.032, cy + W * 0.035); ctx.lineTo(cx, cy + W * 0.018); ctx.lineTo(cx - W * 0.032, cy + W * 0.035); ctx.closePath(); ctx.fill(); ctx.stroke();
    // north marker on the rim
    const r = 42;
    this.north.style.left = (50 + Math.sin(yaw) * r) + '%';
    this.north.style.top = (50 - Math.cos(yaw) * r) + '%';
  }
}

export class BigMap {
  constructor(root, canvas, painter, landmarks, opts) {
    this.root = root; this.cv = canvas; this.ctx = canvas.getContext('2d'); this.p = painter; this.L = landmarks; this.o = opts;
    this.cx = 0; this.cz = 0; this.mpp = 6; this.sel = null; this.open = false;
    const A = painter.city.h.area; this.A = A;
    let drag = null, pinch = null, moved = 0;
    const pt = (e) => { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    this.cv.addEventListener('pointerdown', (e) => { this.cv.setPointerCapture(e.pointerId); drag = { p: pt(e), cx: this.cx, cz: this.cz, id: e.pointerId }; moved = 0; });
    this.cv.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = pt(e); const dx = p[0] - drag.p[0], dy = p[1] - drag.p[1]; moved = Math.max(moved, Math.hypot(dx, dy));
      this.cx = drag.cx - dx * this.mpp; this.cz = drag.cz - dy * this.mpp; this.clamp(); this.draw();
    });
    this.cv.addEventListener('pointerup', (e) => {
      if (drag && moved < 6) { const p = pt(e); const [wx, wz] = this.toWorld(p[0], p[1]); this.select({ x: wx, z: wz, n: null }); }
      drag = null;
    });
    this.cv.addEventListener('wheel', (e) => {
      e.preventDefault(); const p = pt(e); const [wx, wz] = this.toWorld(p[0], p[1]);
      this.mpp = Math.min(14, Math.max(0.35, this.mpp * Math.exp(e.deltaY * 0.0015)));
      const [nx, nz] = this.toWorld(p[0], p[1]); this.cx += wx - nx; this.cz += wz - nz; this.clamp(); this.draw();
    }, { passive: false });
    // pinch zoom
    const touches = new Map();
    this.cv.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]); if (touches.size === 2) { const v = [...touches.values()]; pinch = { d: Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]), mpp: this.mpp }; drag = null; } }, { passive: true });
    this.cv.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) touches.set(t.identifier, [t.clientX, t.clientY]); if (pinch && touches.size === 2) { const v = [...touches.values()]; const d = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); this.mpp = Math.min(14, Math.max(0.35, pinch.mpp * pinch.d / Math.max(20, d))); this.clamp(); this.draw(); } }, { passive: true });
    this.cv.addEventListener('touchend', (e) => { for (const t of e.changedTouches) touches.delete(t.identifier); if (touches.size < 2) pinch = null; }, { passive: true });
    window.addEventListener('resize', () => { if (this.open) { this.fit(); this.draw(); } });
  }
  clamp() { const A = this.A; this.cx = Math.min(A[2], Math.max(A[0], this.cx)); this.cz = Math.min(A[3], Math.max(A[1], this.cz)); }
  fit() { const r = this.cv.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1); this.dpr = dpr; this.cv.width = Math.max(10, r.width * dpr); this.cv.height = Math.max(10, r.height * dpr); this.W = r.width; this.H = r.height; }
  toWorld(px, py) { return [this.cx + (px - this.W / 2) * this.mpp, this.cz + (py - this.H / 2) * this.mpp]; }
  toScreen(x, z) { return [(x - this.cx) / this.mpp + this.W / 2, (z - this.cz) / this.mpp + this.H / 2]; }
  show(px, pz, found) {
    this.open = true; this.found = found; this.root.classList.remove('hide');
    this.fit(); this.cx = px; this.cz = pz; this.mpp = 2.2; this.px = px; this.pz = pz; this.sel = null;
    this.o.goBtn.classList.add('hide');
    this.list(); this.draw();
  }
  hide() { this.open = false; this.root.classList.add('hide'); }
  list() {
    const el = this.o.listEl; el.innerHTML = '';
    const nf = this.L.filter((l) => this.found.has(l.id)).length;
    const head = document.createElement('div'); head.style.cssText = 'font-weight:800;margin:-2px 0 8px;opacity:.75'; head.textContent = `Found ${nf} of ${this.L.length}`; el.appendChild(head);
    for (const l of this.L) {
      const d = document.createElement('div'); d.className = 'lm' + (this.sel && this.sel.id === l.id ? ' sel' : '');
      const km = Math.hypot(l.x - this.px, l.z - this.pz);
      d.innerHTML = `<span class="i">${l.i}</span><span class="t">${l.n}<small>${km < 1000 ? Math.round(km / 10) * 10 + ' m' : (km / 1000).toFixed(1) + ' km'} away</small></span>${this.found.has(l.id) ? '<span class="ok">✔</span>' : ''}`;
      d.onclick = () => { this.cx = l.x; this.cz = l.z; this.mpp = Math.min(this.mpp, 1.6); this.select(l); };
      el.appendChild(d);
    }
  }
  select(s) { this.sel = s; this.o.goBtn.classList.remove('hide'); this.o.goBtn.textContent = s.n ? `🚶 Go to ${s.n}` : '🚶 Go here'; this.list(); this.draw(); }
  draw() {
    if (!this.open) return;
    const ctx = this.ctx, dpr = this.dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = MC.sea; ctx.fillRect(0, 0, this.W, this.H);
    const A = this.A, w = this.p.world;
    if (w) {
      const [sx, sy] = this.toScreen(A[0], A[1]);
      ctx.imageSmoothingEnabled = this.mpp > w.mpp * 0.6;
      ctx.drawImage(w.cv, sx, sy, (A[2] - A[0]) / this.mpp, (A[3] - A[1]) / this.mpp);
    }
    if (this.mpp < 2.6 || !w) { // detailed tiles
      const g = this.p.city.g;
      const [x0, z0] = this.toWorld(0, 0), [x1, z1] = this.toWorld(this.W, this.H);
      const ix0 = Math.floor((x0 - g.x0) / g.cs), ix1 = Math.floor((x1 - g.x0) / g.cs), iz0 = Math.floor((z0 - g.z0) / g.cs), iz1 = Math.floor((z1 - g.z0) / g.cs);
      if ((ix1 - ix0 + 1) * (iz1 - iz0 + 1) <= 64) {
        for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
          if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz) continue;
          const [sx, sy] = this.toScreen(g.x0 + ix * g.cs, g.z0 + iz * g.cs);
          ctx.drawImage(this.p.tile(iz * g.nx + ix), sx, sy, g.cs / this.mpp + 0.6, g.cs / this.mpp + 0.6);
        }
      }
    }
    // landmarks: icons always, names only where they do not overlap (the selected one first)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const order = this.L.slice().sort((a, b) => (this.sel && b.id === this.sel.id) - (this.sel && a.id === this.sel.id));
    for (const l of this.L) {
      const [sx, sy] = this.toScreen(l.x, l.z);
      const f = this.found.has(l.id);
      ctx.fillStyle = this.sel && this.sel.id === l.id ? '#ffb53d' : f ? 'rgba(255,255,255,.95)' : 'rgba(14,36,51,.85)';
      ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
      ctx.font = '17px system-ui, sans-serif'; ctx.fillText(l.i, sx, sy + 1);
    }
    const boxes = this.L.map((l) => { const [sx, sy] = this.toScreen(l.x, l.z); return [sx - 15, sy - 15, sx + 15, sy + 15]; });
    ctx.font = '800 12px Nunito, system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)';
    for (const l of order) {
      const isSel = this.sel && this.sel.id === l.id;
      if (this.mpp >= 4 && !isSel) continue;
      const [sx, sy] = this.toScreen(l.x, l.z);
      const w = ctx.measureText(l.n).width;
      const r = [sx - w / 2 - 2, sy + 18, sx + w / 2 + 2, sy + 32];
      const hit = !isSel && boxes.some((b) => b !== null && !(r[2] < b[0] || r[0] > b[2] || r[3] < b[1] || r[1] > b[3]) && !(b[0] === sx - 15 && b[1] === sy - 15));
      if (hit) continue;
      boxes.push(r);
      ctx.strokeText(l.n, sx, sy + 25); ctx.fillStyle = '#0e2433'; ctx.fillText(l.n, sx, sy + 25);
    }
    // district names, where they do not cover a place
    if (this.mpp > 2.5) {
      ctx.font = '700 13px Nunito, system-ui, sans-serif';
      for (const pl of this.p.city.h.places) {
        if (pl.k !== 'suburb' && pl.k !== 'town' && pl.k !== 'village' && this.mpp > 5) continue;
        const [sx, sy] = this.toScreen(pl.x, pl.z);
        const w = ctx.measureText(pl.n).width;
        const r = [sx - w / 2 - 2, sy - 9, sx + w / 2 + 2, sy + 9];
        if (boxes.some((b) => !(r[2] < b[0] || r[0] > b[2] || r[3] < b[1] || r[1] > b[3]))) continue;
        boxes.push(r);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.strokeText(pl.n, sx, sy); ctx.fillStyle = '#5b4f42'; ctx.fillText(pl.n, sx, sy);
      }
    }
    // selection pin
    if (this.sel && !this.sel.id) {
      const [sx, sy] = this.toScreen(this.sel.x, this.sel.z);
      ctx.fillStyle = '#e8453c'; ctx.beginPath(); ctx.arc(sx, sy - 16, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - 7, sy - 12); ctx.lineTo(sx + 7, sy - 12); ctx.lineTo(sx, sy); ctx.fill();
    }
    // you
    const [px, py] = this.toScreen(this.px, this.pz);
    ctx.fillStyle = '#e8453c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // scale bar
    const m = this.mpp * 120; const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((v) => v >= m * 0.5) || 5000;
    ctx.fillStyle = '#0e2433'; ctx.fillRect(this.W - 30 - nice / this.mpp, this.H - 28, nice / this.mpp, 4);
    ctx.font = '800 12px Nunito, system-ui'; ctx.textAlign = 'right'; ctx.fillText(nice >= 1000 ? nice / 1000 + ' km' : nice + ' m', this.W - 30, this.H - 40);
  }
}
