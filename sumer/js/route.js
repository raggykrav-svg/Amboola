// GPS: a coarse 8 m grid of the streets (from the map's roads), and A* routes on it.
import { chunk } from './data.js';

const CELL = 8;
const ROAD = 1, PATH = 2;

export class Router {
  constructor(city) {
    const A = city.h.area;
    this.x0 = A[0] - 20; this.z0 = A[1] - 20;
    this.w = Math.ceil((A[2] - A[0] + 40) / CELL); this.h = Math.ceil((A[3] - A[1] + 40) / CELL);
    this.grid = new Uint8Array(this.w * this.h);
    const g = city.g;
    for (let ci = 0; ci < g.nx * g.nz; ci++) {
      for (const rd of chunk(city.data, ci).roads) {
        const bit = rd.path ? PATH : ROAD;
        const rad = rd.path ? 2.5 : Math.max(rd.w / 2 + 1, 4.5);
        const p = rd.pts;
        for (let i = 0; i + 3 < p.length; i += 2) {
          const x1 = p[i], z1 = p[i + 1], x2 = p[i + 2], z2 = p[i + 3];
          const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 3));
          for (let k = 0; k <= n; k++) this.stamp(x1 + (x2 - x1) * k / n, z1 + (z2 - z1) * k / n, rad, bit);
        }
      }
    }
  }
  stamp(x, z, r, bit) {
    const c0 = Math.floor((x - r - this.x0) / CELL), c1 = Math.floor((x + r - this.x0) / CELL);
    const r0 = Math.floor((z - r - this.z0) / CELL), r1 = Math.floor((z + r - this.z0) / CELL);
    for (let rr = Math.max(0, r0); rr <= Math.min(this.h - 1, r1); rr++) for (let cc = Math.max(0, c0); cc <= Math.min(this.w - 1, c1); cc++) {
      const cx = this.x0 + (cc + 0.5) * CELL, cz = this.z0 + (rr + 0.5) * CELL;
      if (Math.hypot(cx - x, cz - z) <= r + CELL * 0.5) this.grid[rr * this.w + cc] |= bit;
    }
  }
  cellOf(x, z) { return [Math.floor((x - this.x0) / CELL), Math.floor((z - this.z0) / CELL)]; }
  // nearest open cell to (x, z) within ~80 m
  snap(x, z, mask) {
    const [c, r] = this.cellOf(x, z);
    for (let d = 0; d <= 10; d++) {
      let best = -1, bd = 1e9;
      for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= this.w || rr >= this.h || !(this.grid[rr * this.w + cc] & mask)) continue;
        const dd = dc * dc + dr * dr; if (dd < bd) { bd = dd; best = rr * this.w + cc; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  // route from (x0,z0) to (x1,z1); mask 1 = car roads, 3 = roads and footpaths. Returns [[x,z],...] or null
  route(x0, z0, x1, z1, mask = ROAD) {
    const s = this.snap(x0, z0, mask), t = this.snap(x1, z1, mask);
    if (s < 0 || t < 0) return null;
    const W = this.w;
    const sc = s % W, sr = Math.floor(s / W), tc = t % W, tr = Math.floor(t / W);
    const D = Math.hypot(tc - sc, tr - sr), m = Math.max(60, Math.round(D * 0.35));
    const bc0 = Math.max(0, Math.min(sc, tc) - m), bc1 = Math.min(W - 1, Math.max(sc, tc) + m);
    const br0 = Math.max(0, Math.min(sr, tr) - m), br1 = Math.min(this.h - 1, Math.max(sr, tr) + m);
    const bw = bc1 - bc0 + 1, bh = br1 - br0 + 1, N = bw * bh;
    const gs = new Float32Array(N).fill(1e30), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const loc = (c, r) => (r - br0) * bw + (c - bc0);
    const heap = new MinHeap(N);
    const si = loc(sc, sr), ti = loc(tc, tr);
    gs[si] = 0; heap.push(si, D * 1.3);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false, iter = 0;
    while (heap.size && iter++ < 3e6) {
      const cur = heap.pop();
      if (cur === ti) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % bw, cr = Math.floor(cur / bw);
      for (const [dc, dr, cost] of dirs) {
        const nc = cc + dc, nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= bw || nr >= bh) continue;
        if (!(this.grid[(nr + br0) * W + nc + bc0] & mask)) continue;
        const ni = nr * bw + nc;
        if (closed[ni]) continue;
        const ng = gs[cur] + cost;
        if (ng < gs[ni]) { gs[ni] = ng; from[ni] = cur; heap.push(ni, ng + Math.hypot(tc - bc0 - nc, tr - br0 - nr) * 1.3); }
      }
    }
    if (!found) return null;
    const pts = [];
    for (let i = ti; i >= 0; i = from[i]) pts.push([this.x0 + (i % bw + bc0 + 0.5) * CELL, this.z0 + (Math.floor(i / bw) + br0 + 0.5) * CELL]);
    pts.reverse();
    pts[0] = [x0, z0]; pts.push([x1, z1]);
    return simplify(pts, 5);
  }
}

export function routeLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
// distance from (x,z) to the route polyline
export function distToRoute(pts, x, z) {
  let d = 1e9;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return d;
}

function simplify(pts, tol) { // Ramer–Douglas–Peucker
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = -1, mi = -1;
    const [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / l; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

class MinHeap {
  constructor(cap) { this.k = new Int32Array(Math.min(cap, 1 << 22)); this.v = new Float32Array(this.k.length); this.size = 0; }
  push(key, val) {
    if (this.size >= this.k.length) { const k = new Int32Array(this.k.length * 2), v = new Float32Array(this.k.length * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; }
    let i = this.size++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.v[p] <= val) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop() {
    const top = this.k[0], lk = this.k[--this.size], lv = this.v[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.size) break;
      if (c + 1 < this.size && this.v[c + 1] < this.v[c]) c++;
      if (this.v[c] >= lv) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = lk; this.v[i] = lv;
    return top;
  }
}
