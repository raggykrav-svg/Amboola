// Cars of Limassol: smooth bodies built from cross-sections, glossy clear-coated paint, dark glass,
// alloy wheels, lights (on at night for cars that drive), black grille, Cyprus plates (white front,
// yellow back), mirrors and door handles. Five kinds seen everywhere in the city: small hatchbacks,
// saloons, SUVs, double-cab pickups and vans. Parked cars near you use the detailed model, the rest
// a light one.
import * as THREE from 'three';

const K = { PAINT: 0, GLASS: 1, TRIM: 2, CHROME: 3, TYRE: 4, HEAD: 5, TAIL: 6, PLATE_W: 7, PLATE_Y: 8, GRILLE: 9 };

// L length, W width, H roof height, fo/ro overhangs, r wheel radius, gc ground clearance, hh hood height at
// the nose, bh belt line, th top at the tail; dWs/dRs/dRe/dBk: distance from the nose to the windshield
// base, roof start, roof end and the bottom of the rear window; gb: thickness of the rear pillar;
// glassLen: side glass only this far behind the windshield (vans); share: how common it is
export const CAR_TYPES = [
  { id: 'hatch', L: 3.95, W: 1.72, H: 1.48, fo: 0.78, ro: 0.62, r: 0.3, gc: 0.15, hh: 0.8, bh: 0.98, th: 0.98, dWs: 1.05, dRs: 1.9, dRe: 3.5, dBk: 3.82, tumble: 0.2, gb: 0.3, share: 30 },
  { id: 'sedan', L: 4.62, W: 1.79, H: 1.45, fo: 0.92, ro: 1.0, r: 0.31, gc: 0.14, hh: 0.76, bh: 0.97, th: 0.95, dWs: 1.3, dRs: 2.1, dRe: 3.45, dBk: 3.98, tumble: 0.22, gb: 0.12, share: 26 },
  { id: 'suv', L: 4.5, W: 1.85, H: 1.68, fo: 0.88, ro: 0.94, r: 0.35, gc: 0.2, hh: 0.95, bh: 1.1, th: 1.08, dWs: 1.2, dRs: 1.95, dRe: 4.05, dBk: 4.38, tumble: 0.2, gb: 0.28, clad: true, rails: true, share: 26 },
  { id: 'pickup', L: 5.3, W: 1.86, H: 1.8, fo: 0.92, ro: 1.3, r: 0.37, gc: 0.25, hh: 1.02, bh: 1.14, th: 1.12, dWs: 1.45, dRs: 2.2, dRe: 3.35, dBk: 3.48, tumble: 0.18, gb: 0.1, clad: true, bed: true, share: 11 },
  { id: 'van', L: 4.95, W: 1.98, H: 1.95, fo: 0.95, ro: 1.05, r: 0.33, gc: 0.18, hh: 0.95, bh: 1.05, th: 1.05, dWs: 0.75, dRs: 1.3, dRe: 4.85, dBk: 4.92, tumble: 0.12, gb: 0.1, glassLen: 1.05, share: 7 },
];
const SHARE = CAR_TYPES.reduce((a, t) => a + t.share, 0);
export function pickCarType(r) { let w = r * SHARE; for (let i = 0; i < CAR_TYPES.length; i++) { if (w < CAR_TYPES[i].share) return i; w -= CAR_TYPES[i].share; } return 0; }
// colliders: two circles along the car
export function carCircles(t) { const T = CAR_TYPES[t]; return { off: T.L / 2 - T.W / 2, r: T.W / 2 + 0.08 }; }
// colours people really drive in Cyprus: lots of white, silver, grey and black
export const CAR_COLOURS = [0xf4f4f2, 0xf4f4f2, 0xeeeeec, 0xc6c9cc, 0xb3b7bb, 0x8d9297, 0x55595e, 0x26282b, 0x1b1c1e, 0x23406e, 0x8e1c1c, 0xb8a07a, 0x3f6f9e, 0x5f6b4f];

const smooth01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

class GB {
  constructor() { this.p = []; this.n = []; this.k = []; }
  tri(a, b, c, na, nb, nc, kind) {
    const fx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y), fy = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z), fz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const sx = na.x + nb.x + nc.x, sy = na.y + nb.y + nc.y, sz = na.z + nb.z + nc.z;
    if (fx * sx + fy * sy + fz * sz < 0) { const t = b; b = c; c = t; const u = nb; nb = nc; nc = u; }
    for (const [p, n] of [[a, na], [b, nb], [c, nc]]) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.k.push(kind); }
  }
  quad(a, b, c, d, na, nb, nc, nd, kind) { this.tri(a, b, c, na, nb, nc, kind); this.tri(a, c, d, na, nc, nd, kind); }
  // axis-aligned box (car space), no bottom face
  box(cx, cy, cz, sx, sy, sz, kind) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const f = (a, b, c, d, n) => this.quad(a, b, c, d, n, n, n, n, kind);
    f(V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), V(x1, y0, z1), V(1, 0, 0));
    f(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), V(-1, 0, 0));
    f(V(x0, y1, z0), V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(0, 1, 0));
    f(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), V(0, 0, 1));
    f(V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), V(x1, y0, z0), V(0, 0, -1));
  }
  // a grid of points G[i][j] (i along the car, j around the section); kind(i, j) per quad
  loft(G, closed, kind, centre) {
    const ni = G.length, nj = G[0].length;
    const N = G.map((row, i) => row.map((p, j) => {
      const a = G[Math.min(ni - 1, i + 1)][j], b = G[Math.max(0, i - 1)][j];
      const jn = closed ? (j + 1) % nj : Math.min(nj - 1, j + 1), jp = closed ? (j - 1 + nj) % nj : Math.max(0, j - 1);
      const c = G[i][jn], d = G[i][jp];
      const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(c, d), new THREE.Vector3().subVectors(a, b));
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0);
      n.normalize();
      const o = new THREE.Vector3().subVectors(p, centre(i, p));
      if (n.dot(o) < 0) n.negate();
      return n;
    }));
    const jm = closed ? nj : nj - 1;
    for (let i = 0; i + 1 < ni; i++) for (let j = 0; j < jm; j++) {
      const j2 = (j + 1) % nj;
      const k = kind(i, j); if (k < 0) continue;
      this.quad(G[i][j], G[i + 1][j], G[i + 1][j2], G[i][j2], N[i][j], N[i + 1][j], N[i + 1][j2], N[i][j2], k);
    }
    return N;
  }
  cap(ring, nx, kind) { // flat end cap, fan from the centre, normal along x
    const c = new THREE.Vector3(); for (const p of ring) c.add(p); c.multiplyScalar(1 / ring.length);
    const n = V(nx, 0, 0);
    for (let j = 0; j < ring.length; j++) this.tri(c, ring[j], ring[(j + 1) % ring.length], n, n, n, kind);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.p.length).fill(1), 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.k, 1));
    g.computeBoundingSphere();
    return g;
  }
}

export function buildCar(T, low) {
  const b = new GB();
  const L = T.L, W = T.W, xn = L / 2;
  const xf = xn - T.fo, xr = -xn + T.ro, R = T.r + 0.06;
  const xws = xn - T.dWs, xrs = xn - T.dRs, xre = xn - T.dRe, xbk = xn - T.dBk;
  // half width, body top and bottom along the car
  const half = (x) => { const e = Math.min(smooth01((xn - x) / 0.18), smooth01((x + xn) / 0.18)); return W / 2 * (0.93 + 0.07 * e); };
  const top = (x) => {
    let y = x > xws ? T.bh + (T.hh - T.bh) * Math.pow((x - xws) / (xn - xws), 1.3) : T.bh;
    const dt = x + xn; if (dt < 0.7) y = T.th + (y - T.th) * smooth01(dt / 0.7);
    const e = Math.min(smooth01((xn - x) / 0.32), smooth01((x + xn) / 0.32));
    return y - (1 - e) * 0.1;
  };
  const bottom = (x) => {
    const e = Math.min(smooth01((xn - x) / 0.32), smooth01((x + xn) / 0.32));
    let y = T.gc + 0.05 + (1 - e) * 0.16;
    if (!low) for (const xc of [xr, xf]) { const d = x - xc; if (Math.abs(d) < R) y = Math.max(y, T.r + Math.sqrt(R * R - d * d) * 0.98); }
    return Math.min(y, top(x) - 0.12);
  };
  // stations along the car
  let xs;
  if (low) xs = [-xn, -xn + 0.25, 0, xws, xn - 0.25, xn].concat(T.bed ? [xbk - 0.06, -xn + 0.14] : []);
  else {
    xs = [-xn, -xn + 0.05, -xn + 0.14, -xn + 0.3, xn - 0.3, xn - 0.14, xn - 0.05, xn, xws];
    for (const xc of [xr, xf]) for (const f of [-1.12, -1, -0.8, -0.5, 0, 0.5, 0.8, 1, 1.12]) xs.push(xc + f * R);
    for (let x = -xn + 0.3; x < xn - 0.3; x += 0.42) xs.push(x);
    if (T.bed) xs.push(xbk - 0.06, -xn + 0.14);
  }
  xs = xs.filter((x) => x >= -xn - 1e-6 && x <= xn + 1e-6).sort((a, c) => a - c).filter((x, i, a) => i === 0 || x - a[i - 1] > 0.025);
  // section profile (z factor, height factor), right half from the top centre down to the bottom centre
  const PR = low ? [[0, 1.02], [0.85, 0.97], [1.0, 0.55], [0.92, 0], [0, 0]]
    : [[0, 1.02], [0.4, 1.015], [0.72, 0.995], [0.9, 0.955], [0.98, 0.86], [1.0, 0.66], [1.0, 0.38], [0.985, 0.14], [0.93, 0.03], [0.8, 0], [0, 0]];
  const ring = PR.concat(PR.slice(1, -1).reverse().map(([z, y]) => [-z, y]));
  const G = xs.map((x) => { const w = half(x), yb = bottom(x), yt = top(x); return ring.map(([zf, yf]) => V(x, yb + (yt - yb) * yf, w * zf)); });
  const centre = (i) => V(xs[i], (bottom(xs[i]) + top(xs[i])) / 2, 0);
  const bedFrom = -xn + 0.13, bedTo = xbk - 0.07;
  b.loft(G, true, (i, j) => {
    const xm = (xs[i] + xs[i + 1]) / 2, a = ring[j], c = ring[(j + 1) % ring.length];
    const yf = (a[1] + c[1]) / 2, zf = Math.max(Math.abs(a[0]), Math.abs(c[0]));
    if (T.bed && xm > bedFrom && xm < bedTo && yf > 0.97 && zf < 0.95) return K.TRIM;        // open load bed
    if (yf < 0.02) return K.TRIM;                                                            // underside and wheel wells
    if (T.clad && yf < 0.3) return K.TRIM;                                                   // black plastic cladding
    if ((xn - xm < 0.2 || xm + xn < 0.2) && yf < 0.3) return K.TRIM;                         // bumper lips
    return K.PAINT;
  }, centre);
  b.cap(G[0], -1, K.PAINT); b.cap(G[G.length - 1], 1, K.PAINT);

  // cabin (glasshouse): open section over the roof, from the rear window base to the windshield base
  let cs = [xbk, xws, xrs, xre];
  const xg1 = xws - 0.08, xg0 = T.glassLen ? xws - T.glassLen : Math.max(xbk + 0.06, xre - T.gb);
  const xb = T.glassLen ? null : xg0 + (xg1 - xg0) * 0.52;
  if (!low) { cs.push(xg0, xg1); if (xb !== null) cs.push(xb - 0.05, xb + 0.05); }
  if (!low) for (let x = xbk; x < xws; x += 0.14) cs.push(x);
  cs = cs.filter((x) => x >= xbk - 1e-6 && x <= xws + 1e-6).sort((a, c) => a - c).filter((x, i, a) => i === 0 || x - a[i - 1] > 0.02);
  const roofAt = (x) => {
    const yb = top(x) - 0.03;
    if (x >= xrs) return yb + (T.H - yb) * Math.pow(Math.min(1, Math.max(0, (xws - x) / (xws - xrs))), 0.8);
    if (x <= xre) return yb + (T.H - yb) * Math.pow(Math.min(1, Math.max(0, (x - xbk) / Math.max(0.01, xre - xbk))), 0.6);
    return T.H + 0.025 * Math.sin(Math.PI * (x - xre) / (xrs - xre));
  };
  const C = cs.map((x) => {
    const yb = top(x) - 0.12, yt = Math.max(top(x) - 0.03, roofAt(x)), wb = half(x) - 0.03, wt = half(x) - T.tumble; // bottom tucked into the body
    const ye = Math.max(yb, yt - 0.07);
    if (low) return [V(x, yb, -wb), V(x, ye, -wt), V(x, yt, 0), V(x, ye, wt), V(x, yb, wb)];
    return [V(x, yb, -wb), V(x, ye, -wt), V(x, Math.max(yb, yt - 0.01), -wt * 0.85), V(x, yt + 0.012, 0), V(x, Math.max(yb, yt - 0.01), wt * 0.85), V(x, ye, wt), V(x, yb, wb)];
  });
  b.loft(C, false, (i, jj) => {
    const xm = (cs[i] + cs[i + 1]) / 2;
    const j = low ? [0, 2, 3, 5][jj] : jj;  // far model: sides and roof only
    if (j === 0 || j === 5) { // sides
      if (xb !== null && Math.abs(xm - xb) < 0.05) return K.TRIM;    // B pillar
      return xm > xg0 && xm < xg1 ? K.GLASS : K.PAINT;
    }
    if (j === 2 || j === 3) { // roof centre
      if (xm > xrs - 0.01) return K.GLASS;                           // windshield
      if (xm < xre + 0.01) return K.GLASS;                           // rear window
      return K.PAINT;
    }
    return K.PAINT;                                                  // roof edges and pillars
  }, (i, p) => V(cs[i], top(cs[i]) - 0.3, 0));

  // wheels
  const tw = 0.62 * T.r + 0.02, segs = low ? 6 : 14;
  for (const xc of [xr, xf]) for (const side of [-1, 1]) {
    const cz = side * (half(xc) - tw / 2 - 0.03), cy = T.r, r = T.r;
    const prof = low ? [[r, -tw / 2, 1, 0], [r, tw / 2, 1, 0]]
      : [[r * 0.64, -tw / 2, 0, -1], [r - 0.04, -tw / 2, 0.3, -0.95], [r, -tw / 2 + 0.04, 0.95, -0.3], [r, tw / 2 - 0.04, 0.95, 0.3], [r - 0.04, tw / 2, 0.3, 0.95], [r * 0.64, tw / 2, 0, 1]];
    const P = (rho, a, th) => V(xc + rho * Math.cos(th), cy + rho * Math.sin(th), cz + a * side);
    const Nn = (nr, na, th) => V(nr * Math.cos(th), nr * Math.sin(th), na * side).normalize();
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs * Math.PI * 2, t1 = (s + 1) / segs * Math.PI * 2;
      for (let k = 0; k + 1 < prof.length; k++) {
        const A = prof[k], B = prof[k + 1];
        b.quad(P(A[0], A[1], t0), P(B[0], B[1], t0), P(B[0], B[1], t1), P(A[0], A[1], t1), Nn(A[2], A[3], t0), Nn(B[2], B[3], t0), Nn(B[2], B[3], t1), Nn(A[2], A[3], t1), K.TYRE);
      }
      // alloy rim: a shallow dish
      const n0 = V(0, 0, side);
      if (low) { b.tri(P(0, tw / 2, 0), P(r, tw / 2, t0), P(r, tw / 2, t1), n0, n0, n0, K.TYRE); continue; }
      const rr = r * 0.64, aOut = tw / 2 - 0.01, aIn = tw / 2 - 0.05;
      b.tri(P(0, aIn, 0), P(rr, aOut, t0), P(rr, aOut, t1), n0, n0, n0, K.CHROME);
    }
    if (!low) { // five dark openings between the spokes, and the centre cap
      const rr = r * 0.64, aAt = (rho) => tw / 2 - 0.05 + 0.04 * (rho / rr) + 0.004;
      for (let s = 0; s < 5; s++) {
        const a0 = s / 5 * Math.PI * 2 + 0.2, a1 = a0 + Math.PI * 2 / 5 * 0.62;
        const r0 = rr * 0.3, r1 = rr * 0.88, n0 = V(0, 0, side);
        b.quad(P(r0, aAt(r0), a0), P(r1, aAt(r1), a0), P(r1, aAt(r1), a1), P(r0, aAt(r0), a1), n0, n0, n0, n0, K.GRILLE);
      }
      b.box(xc, cy, cz + side * (tw / 2 - 0.035), 0.09, 0.09, 0.02, K.CHROME);
    }
  }

  // lights, grille, plates
  const hhN = top(xn), ybN = bottom(xn), thT = top(-xn), ybT = bottom(-xn);
  if (low) return b.geometry();
  for (const s of [-1, 1]) {
    b.box(xn - 0.06, hhN - 0.09, s * W / 2 * 0.62, 0.14, 0.11, W / 2 * 0.36, K.HEAD);
    b.box(-xn + 0.05, thT - 0.11, s * W / 2 * 0.68, 0.12, 0.13, W / 2 * 0.32, K.TAIL);
  }
  b.box(xn + 0.004, (ybN + hhN) / 2 - 0.02, 0, 0.02, Math.max(0.08, (hhN - ybN) * 0.35), W / 2 * 0.78, K.GRILLE);
  b.box(xn + 0.014, ybN + 0.1, 0, 0.012, 0.11, 0.5, K.PLATE_W);
  b.box(-xn - 0.014, (ybT + thT) / 2 - 0.04, 0, 0.012, 0.11, 0.5, K.PLATE_Y);
  if (!low) {
    // mirrors and door handles
    for (const s of [-1, 1]) {
      const mx = xws - 0.16, mz = half(mx) - 0.035;
      b.box(mx, T.bh + 0.09, s * (mz + 0.06), 0.14, 0.11, 0.17, K.PAINT);
      b.box(mx - 0.071, T.bh + 0.09, s * (mz + 0.07), 0.004, 0.08, 0.13, K.TRIM);
      const hy = T.bh - 0.1;
      const handles = xb !== null ? [xb + 0.42, xb - 0.42] : [xws - 0.55];
      for (const hx of handles) b.box(hx, hy, s * (half(hx) * 0.985), 0.16, 0.03, 0.03, K.CHROME);
    }
    if (T.rails) for (const s of [-1, 1]) b.box((xre + xrs) / 2, T.H + 0.05, s * (half((xre + xrs) / 2) - T.tumble) * 0.78, (xrs - xre) * 0.9, 0.04, 0.05, K.TRIM);
  }
  return b.geometry();
}

// one material for all cars: paint (instance colour) with clear coat, other parts by kind
export function makeCarMaterial(U, lightsOn) {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.07 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.uNight; sh.uniforms.uLights = { value: lightsOn ? 1 : 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind; flat varying float vKind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKind = aKind;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nflat varying float vKind; uniform float uNight, uLights;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        int kk = int(vKind + 0.5);
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float kR = 0.38, kM = lum > 0.6 ? 0.05 : 0.45, kC = 1.0; vec3 kE = vec3(0.0);
        if (kk == 1) { diffuseColor.rgb = vec3(0.012, 0.016, 0.02); kR = 0.04; kM = 0.0; }
        else if (kk == 2) { diffuseColor.rgb = vec3(0.03); kR = 0.62; kM = 0.0; kC = 0.0; }
        else if (kk == 3) { diffuseColor.rgb = vec3(0.78, 0.79, 0.8); kR = 0.24; kM = 1.0; kC = 0.0; }
        else if (kk == 4) { diffuseColor.rgb = vec3(0.028); kR = 0.85; kM = 0.0; kC = 0.0; }
        else if (kk == 5) { diffuseColor.rgb = vec3(0.86, 0.88, 0.9); kR = 0.05; kM = 0.0; kE = vec3(1.0, 0.93, 0.8) * uNight * uLights * 5.0; }
        else if (kk == 6) { diffuseColor.rgb = vec3(0.42, 0.02, 0.02); kR = 0.1; kM = 0.0; kE = vec3(1.0, 0.05, 0.03) * (0.1 + uNight * 1.8) * uLights; }
        else if (kk == 7) { diffuseColor.rgb = vec3(0.9); kR = 0.5; kM = 0.0; kC = 0.0; }
        else if (kk == 8) { diffuseColor.rgb = vec3(0.95, 0.74, 0.06); kR = 0.5; kM = 0.0; kC = 0.0; }
        else if (kk == 9) { diffuseColor.rgb = vec3(0.022); kR = 0.45; kM = 0.2; kC = 0.0; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = kR;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = kM;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  #ifdef USE_CLEARCOAT\n    material.clearcoat *= kC;\n  #endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += kE;');
  };
  m.customProgramCacheKey = () => 'sumer-car-' + (lightsOn ? 1 : 0);
  return m;
}

// parked cars of all built street pieces, with detailed models near the walker
export class CarField {
  constructor(scene, city, U, q) {
    this.city = city; this.q = q;
    this.mat = makeCarMaterial(U, false);
    const geoN = CAR_TYPES.map((t) => buildCar(t, false)), geoF = CAR_TYPES.map((t) => buildCar(t, true));
    const mk = (g, cap) => {
      const m = new THREE.InstancedMesh(g, this.mat, cap);
      m.count = 0; m.castShadow = q.shadows > 0; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      scene.add(m); return m;
    };
    this.near = geoN.map((g) => mk(g, q.carCapNear || 400));
    this.far = geoF.map((g) => { const m = mk(g, q.carCapFar || 2500); m.castShadow = false; return m; });
    this.lx = 1e9; this.lz = 1e9; this.ver = -1;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
  }
  update(px, pz, force = false) {
    if (!force && this.ver === this.city.detailVersion && Math.hypot(px - this.lx, pz - this.lz) < 10) return;
    this.ver = this.city.detailVersion; this.lx = px; this.lz = pz;
    const RN = this.q.carNear || 0, RF = this.q.carFar || 250, n = CAR_TYPES.length;
    const cN = new Array(n).fill(0), cF = new Array(n).fill(0);
    const { _m: m, _q: q, _e: e, _v: v, _s: s, _c: col } = this;
    for (const grp of this.city.details.values()) {
      const list = grp.userData.parked; if (!list) continue;
      for (const c of list) {
        const d = Math.hypot(c.x - px, c.z - pz); if (d > RF) continue;
        const near = d < RN;
        const cnt = near ? cN : cF, mesh = (near ? this.near : this.far)[c.t];
        if (cnt[c.t] >= mesh.instanceMatrix.count) continue;
        e.set(0, c.ry, 0); q.setFromEuler(e); v.set(c.x, 0, c.z);
        m.compose(v, q, s); mesh.setMatrixAt(cnt[c.t], m);
        col.set(c.c); mesh.setColorAt(cnt[c.t], col);
        cnt[c.t]++;
      }
    }
    for (let t = 0; t < n; t++) for (const [mesh, k] of [[this.near[t], cN[t]], [this.far[t], cF[t]]]) {
      mesh.count = k; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      if (k) mesh.computeBoundingSphere();
    }
  }
}
