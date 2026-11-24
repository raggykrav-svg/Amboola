// Small models placed many times: solar water heaters, street lamps, parked cars, beach umbrellas,
// sunbeds, yachts, sailboats, and the big ships waiting off Limassol.
import * as THREE from 'three';

class PB {
  constructor() { this.p = []; this.n = []; this.c = []; }
  tri(a, b, c, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    for (const v of [a, b, c]) { this.p.push(...v); this.n.push(nx / l, ny / l, nz / l); this.c.push(col.r, col.g, col.b); }
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); }
  // axis-aligned box (optionally rotated about z by tilt around its bottom-back edge is not needed)
  box(x0, y0, z0, x1, y1, z1, col, colTop = null, bottom = false) {
    const C = col, T = colTop || col;
    const p = (x, y, z) => [x, y, z];
    this.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), C); // +z
    this.quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), C); // -z
    this.quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), C); // +x
    this.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), C); // -x
    this.quad(p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0), T); // top
    if (bottom) this.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), C); // bottom
  }
  // cylinder along an axis: 'y' (vertical) or 'x'/'z'
  cyl(cx, cy, cz, r0, r1, h, seg, col, axis = 'y', cap = true) {
    const P = (a, r, t) => {
      const c = Math.cos(a) * r, s = Math.sin(a) * r;
      if (axis === 'y') return [cx + c, cy + t, cz + s];
      if (axis === 'x') return [cx + t, cy + c, cz + s];
      return [cx + c, cy + s, cz + t];
    };
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      if (axis === 'y') this.quad(P(a0, r0, 0), P(a0, r1, h), P(a1, r1, h), P(a1, r0, 0), col);
      else this.quad(P(a0, r0, 0), P(a1, r0, 0), P(a1, r1, h), P(a0, r1, h), col);
      if (cap) {
        if (axis === 'y') this.tri(P(0, 0, h), P(a1, r1, h), P(a0, r1, h), col);
        else { this.tri(P(0, 0, h), P(a0, r1, h), P(a1, r1, h), col); this.tri(P(0, 0, 0), P(a1, r0, 0), P(a0, r0, 0), col); }
      }
    }
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const C = (h) => new THREE.Color(h);

function swh() { // solar water heater: two tilted collectors facing south (+z) and a white tank behind
  const b = new PB();
  const frame = C(0xaab0b5), panel = C(0x1f3150), tank = C(0xeeece6);
  const tilt = 0.7, L = 1.95, W = 2.0, x0 = -1.0;
  const zf = 0.75, yb = 0.25, zt = zf - Math.cos(tilt) * L, yt = yb + Math.sin(tilt) * L;
  b.quad([x0, yb, zf], [x0 + W, yb, zf], [x0 + W, yt, zt], [x0, yt, zt], panel);
  b.quad([x0, yb - 0.04, zf], [x0, yt - 0.04, zt], [x0 + W, yt - 0.04, zt], [x0 + W, yb - 0.04, zf], frame);
  b.quad([-0.02, yb + 0.01, zf + 0.001], [0.02, yb + 0.01, zf + 0.001], [0.02, yt + 0.01, zt + 0.001], [-0.02, yt + 0.01, zt + 0.001], frame);
  for (const x of [-1.0, 0.97]) { b.quad([x, 0, -0.72], [x + 0.03, 0, -0.72], [x + 0.03, 1.45, -0.72], [x, 1.45, -0.72], frame); b.quad([x + 0.03, 0, -0.72], [x, 0, -0.72], [x, 1.45, -0.72], [x + 0.03, 1.45, -0.72], frame); }
  b.cyl(-1.05, 1.62, -0.78, 0.3, 0.3, 2.1, 6, tank, 'x', false);
  return b.geo();
}
function lamp() {
  const b = new PB(); const g = C(0x7d848b);
  b.cyl(0, 0, 0, 0.09, 0.06, 7.0, 5, g, 'y', false);
  b.box(0, 6.9, -0.04, 1.3, 6.98, 0.04, g);
  b.box(0.95, 6.86, -0.13, 1.55, 7.02, 0.13, g);
  return b.geo();
}
function lampHead() { const b = new PB(); b.quad([1.0, 6.85, -0.1], [1.0, 6.85, 0.1], [1.5, 6.85, 0.1], [1.5, 6.85, -0.1], C(0xffffff)); return b.geo(); }
function car() {
  const b = new PB();
  const body = C(0xffffff), glass = C(0x202830), tyre = C(0x161616), light = C(0xf4f1e0), rear = C(0xa8261e);
  b.box(-2.15, 0.32, -0.88, 2.15, 0.98, 0.88, body);
  const y0 = 0.98, y1 = 1.46;
  const fb = [-1.2, 1.05], tb = [-0.95, 0.55], w0 = 0.82, w1 = 0.68;
  const R = (a, b2, c, d, col) => b.quad(a, d, c, b2, col);
  R([fb[1], y0, w0], [tb[1], y1, w1], [tb[1], y1, -w1], [fb[1], y0, -w0], glass);
  R([fb[0], y0, -w0], [tb[0], y1, -w1], [tb[0], y1, w1], [fb[0], y0, w0], glass);
  R([fb[0], y0, w0], [tb[0], y1, w1], [tb[1], y1, w1], [fb[1], y0, w0], glass);
  R([fb[1], y0, -w0], [tb[1], y1, -w1], [tb[0], y1, -w1], [fb[0], y0, -w0], glass);
  R([tb[0], y1, w1], [tb[0], y1, -w1], [tb[1], y1, -w1], [tb[1], y1, w1], body);
  for (const [x, z] of [[1.35, 0.7], [-1.35, 0.7], [1.35, -0.92], [-1.35, -0.92]]) b.cyl(x, 0.33, z, 0.33, 0.33, 0.22, 6, tyre, 'z', false);
  b.quad([2.151, 0.7, 0.45], [2.151, 0.7, 0.8], [2.151, 0.84, 0.8], [2.151, 0.84, 0.45], light);
  b.quad([2.151, 0.7, -0.8], [2.151, 0.7, -0.45], [2.151, 0.84, -0.45], [2.151, 0.84, -0.8], light);
  b.quad([-2.151, 0.72, 0.8], [-2.151, 0.72, 0.5], [-2.151, 0.86, 0.5], [-2.151, 0.86, 0.8], rear);
  b.quad([-2.151, 0.72, -0.5], [-2.151, 0.72, -0.8], [-2.151, 0.86, -0.8], [-2.151, 0.86, -0.5], rear);
  return b.geo();
}
function umbrella() {
  const b = new PB(); const pole = C(0xe8e4da), can = C(0xffffff);
  b.cyl(0, 0, 0, 0.03, 0.03, 2.3, 5, pole, 'y', false);
  const seg = 8, r = 1.35;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
    const p0 = [Math.cos(a0) * r, 2.0, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, 2.0, Math.sin(a1) * r], t = [0, 2.5, 0];
    b.tri(t, p1, p0, can); b.tri(t, p0, p1, can.clone().multiplyScalar(0.8));
  }
  return b.geo();
}
function sunbed() {
  const b = new PB(); const w = C(0xf2f0ea), f = C(0x9a9ea2);
  b.box(-0.32, 0.28, -0.95, 0.32, 0.34, 0.45, w);
  b.quad([-0.32, 0.34, 0.45], [0.32, 0.34, 0.45], [0.32, 0.82, 0.95], [-0.32, 0.82, 0.95], w);
  b.quad([0.32, 0.31, 0.45], [-0.32, 0.31, 0.45], [-0.32, 0.79, 0.95], [0.32, 0.79, 0.95], w);
  for (const [x, z] of [[-0.28, -0.9], [0.28, -0.9], [-0.28, 0.4], [0.28, 0.4]]) b.box(x - 0.025, 0, z - 0.025, x + 0.025, 0.3, z + 0.025, f);
  return b.geo();
}
function hull(b, L, B, H, col, stripe) {
  // pointed bow at +x, transom at -x; from y=0 (water) to H
  const half = L / 2, bow = half, sh = half * 0.45;
  const top = [[-half, H, -B / 2], [sh, H, -B / 2], [bow, H + 0.25, 0], [sh, H, B / 2], [-half, H, B / 2]];
  const bot = [[-half * 0.95, -0.3, -B * 0.38], [sh * 0.9, -0.3, -B * 0.3], [bow * 0.92, 0.1, 0], [sh * 0.9, -0.3, B * 0.3], [-half * 0.95, -0.3, B * 0.38]];
  for (let i = 0; i < 4; i++) b.quad(bot[i], top[i], top[i + 1], bot[i + 1], col);
  b.quad(bot[4], top[4], top[0], bot[0], col);
  const deck = C(0xe8e2d4);
  b.tri(top[0], top[4], top[1], deck); b.tri(top[1], top[4], top[3], deck); b.tri(top[1], top[3], top[2], deck);
  // a coloured stripe
  if (stripe) b.quad([-half, H - 0.35, B / 2 + 0.01], [sh, H - 0.35, B / 2 + 0.01], [sh, H - 0.15, B / 2 + 0.01], [-half, H - 0.15, B / 2 + 0.01], stripe);
}
function yacht() {
  const b = new PB();
  hull(b, 12, 3.8, 1.2, C(0xf6f6f4), C(0x1d3557));
  b.box(-3.6, 1.2, -1.35, 2.0, 2.1, 1.35, C(0xf7f7f5), C(0xeeeeec));
  b.box(-3.3, 1.5, -1.37, 1.7, 1.9, 1.37, C(0x26313d));
  b.box(-2.8, 2.1, -1.0, 0.2, 2.55, 1.0, C(0xf0f0ee));
  b.box(1.0, 2.1, -0.04, 1.08, 3.1, 0.04, C(0xc8ccd0));
  return b.geo();
}
function sailboat() {
  const b = new PB();
  hull(b, 12, 3.6, 1.2, C(0xf2f2f0), C(0x7a1f1f));
  b.box(-2.5, 1.2, -1.1, 1.5, 1.85, 1.1, C(0xf0f0ee));
  b.box(-2.3, 1.45, -1.12, 1.2, 1.65, 1.12, C(0x2a3440));
  b.cyl(1.0, 1.2, 0, 0.09, 0.06, 15, 6, C(0xd0d4d8));
  b.box(-3.0, 2.6, -0.06, 1.0, 2.75, 0.06, C(0xc0c4c8));
  b.box(-2.8, 2.75, -0.25, 0.9, 3.0, 0.25, C(0x1d3557)); // furled sail cover
  return b.geo();
}
export function bigShip(len, colHull, colBox) {
  const b = new PB();
  hull(b, len, len * 0.15, len * 0.09, C(colHull), C(0xb33a2c));
  // superstructure at the stern
  const H = len * 0.09;
  b.box(-len * 0.45, H, -len * 0.06, -len * 0.33, H + len * 0.1, len * 0.06, C(0xf2f0ea));
  b.box(-len * 0.44, H + len * 0.07, -len * 0.061, -len * 0.34, H + len * 0.08, len * 0.061, C(0x22303c));
  b.cyl(-len * 0.4, H + len * 0.1, 0, len * 0.012, len * 0.012, len * 0.035, 8, C(0x9b2a22));
  // containers
  const cols = [0xb5432c, 0x2d6a8a, 0x3f7a3d, 0xd2a232, 0x8a8f94, 0x6a3a66, 0x2a3a5c];
  let k = 0;
  for (let x = -len * 0.3; x < len * 0.36; x += len * 0.062) {
    const rows = 2 + (k % 3);
    for (let r = 0; r < rows; r++) b.box(x, H + r * len * 0.016, -len * 0.06, x + len * 0.058, H + (r + 1) * len * 0.016 - 0.2, len * 0.06, C(cols[(k * 3 + r) % cols.length]));
    k++;
  }
  return b.geo();
}

export function makeProps(nightRef) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffcf8a, emissiveIntensity: 0, roughness: 0.4 });
  const P = {
    swh: { geo: swh(), mat },
    lamp: { geo: lamp(), mat, geo2: lampHead(), mat2: headMat },
    car: { geo: car(), mat },
    umb: { geo: umbrella(), mat },
    bed: { geo: sunbed(), mat },
    yacht: { geo: yacht(), mat },
    sail: { geo: sailboat(), mat },
  };
  P.headMat = headMat; P.mat = mat;
  return P;
}
