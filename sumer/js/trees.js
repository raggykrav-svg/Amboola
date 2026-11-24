// Low-poly tree models of Limassol: Washingtonia/date palms, Aleppo pines, ficus street trees,
// cypresses, olives, citrus and scrub bushes. Each type has a near and a far (cheaper) version.
import * as THREE from 'three';

export const TREE = { PALM: 0, PINE: 1, BROAD: 2, CYPRESS: 3, OLIVE: 4, BUSH: 5, CITRUS: 6, FICUS: 7 };
export const NTYPES = 8;

function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; }
  tri(a, b, c, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const v of [a, b, c]) { this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
  }
  // tapered (optionally curved) cylinder
  trunk(r0, r1, h, sides, segs, col, bend = 0, col2 = null) {
    const ring = (t) => { const r = r0 + (r1 - r0) * t, y = h * t, ox = bend * t * t; const out = []; for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2; out.push([ox + Math.cos(a) * r, y, Math.sin(a) * r]); } return out; };
    let prev = ring(0);
    for (let s = 1; s <= segs; s++) {
      const cur = ring(s / segs);
      const cc = col2 && s % 2 ? col2 : col;
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        this.tri(prev[i], cur[j], prev[j], cc); this.tri(prev[i], cur[i], cur[j], cc);
      }
      prev = cur;
    }
    return [bend, h];
  }
  // jittered ellipsoid blob from an icosahedron (smooth-ish shading via averaged normals)
  blob(cx, cy, cz, rx, ry, rz, detail, col, seed, jit = 0.18, colTop = null) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const pos = g.attributes.position; const R = rnd(seed * 7919 + 13);
    const map = new Map(); const pts = [];
    for (let i = 0; i < pos.count; i++) {
      const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!map.has(k)) map.set(k, 1 + (R() - 0.5) * 2 * jit);
      const s = map.get(k);
      pts.push([cx + pos.getX(i) * rx * s, cy + pos.getY(i) * ry * s, cz + pos.getZ(i) * rz * s, pos.getX(i), pos.getY(i), pos.getZ(i)]);
    }
    for (let i = 0; i < pts.length; i += 3) {
      const a = pts[i], b = pts[i + 1], c = pts[i + 2];
      const yy = (a[4] + b[4] + c[4]) / 3;
      const cc = colTop ? col.clone().lerp(colTop, Math.max(0, yy) * 0.9) : col.clone();
      cc.multiplyScalar(0.82 + 0.25 * (yy * 0.5 + 0.5));
      // outward normals = direction from centre (soft look)
      for (const v of [a, b, c]) {
        this.p.push(v[0], v[1], v[2]);
        const nx = v[3] / rx, ny = v[4] / ry, nz = v[5] / rz, l = Math.hypot(nx, ny, nz);
        this.n.push(nx / l, ny / l, nz / l); this.c.push(cc.r, cc.g, cc.b);
      }
    }
    g.dispose();
  }
  // palm frond: a bent strip, both sides
  frond(baseY, ang, len, width, droop, col, colTip, segs, ox = 0) {
    const dir = [Math.cos(ang), Math.sin(ang)];
    const side = [-dir[1], dir[0]];
    const pts = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const d = len * t;
      const y = baseY + Math.sin(t * Math.PI * 0.55) * len * 0.32 - droop * t * t * len;
      const w = width * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (1 - t * 0.35) + 0.02;
      const cx = ox + dir[0] * d, cz = dir[1] * d;
      pts.push([[cx + side[0] * w, y - w * 0.25, cz + side[1] * w], [cx, y + 0.05, cz], [cx - side[0] * w, y - w * 0.25, cz - side[1] * w]]);
    }
    for (let s = 0; s < segs; s++) {
      const a = pts[s], b = pts[s + 1];
      const cc = col.clone().lerp(colTip, s / segs);
      for (const [p0, p1, q0, q1] of [[a[0], a[1], b[0], b[1]], [a[1], a[2], b[1], b[2]]]) {
        this.tri(p0, q0, q1, cc); this.tri(p0, q1, p1, cc);
        this.tri(p0, q1, q0, cc); this.tri(p0, p1, q1, cc);
      }
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const C = (h) => new THREE.Color(h);

// heights are real-world metres for scale 1
export function makeTreeGeometries() {
  const near = [], far = [];
  for (let t = 0; t < NTYPES; t++) {
    for (const lod of [0, 1]) {
      const b = new Builder();
      const d = lod ? 0 : 1;
      switch (t) {
        case TREE.PALM: {
          const h = 9.5;
          b.trunk(0.32, 0.22, h, lod ? 5 : 7, lod ? 2 : 5, C(0x7d6a55), 0.6, C(0x6c5a47));
          const nf = lod ? 7 : 12;
          for (let i = 0; i < nf; i++) {
            const a = i / nf * Math.PI * 2 + (i % 2) * 0.2;
            b.frond(h - 0.1, a, 3.1 + (i % 3) * 0.35, 0.55, 0.9 + (i % 2) * 0.4, C(0x4f8a34), C(0x98b856), lod ? 2 : 4, 0.6);
          }
          // dead frond skirt
          if (!lod) b.trunk(0.55, 0.3, 1.2, 7, 1, C(0x9c8463));
          break;
        }
        case TREE.PINE: { // Aleppo pine: leaning trunk, umbrella of dark blobs
          b.trunk(0.25, 0.12, 6.5, 5, 3, C(0x6b4f3a), 0.8);
          const g = C(0x4f6b3a), gt = C(0x7a9455);
          b.blob(0.9, 6.4, 0, 2.6, 1.25, 2.4, d, g, 1, 0.22, gt);
          b.blob(-0.4, 5.4, 0.9, 1.9, 1.0, 1.8, d, g, 2, 0.22, gt);
          if (!lod) b.blob(1.6, 5.1, -1.2, 1.6, 0.9, 1.5, d, g, 3, 0.22, gt);
          break;
        }
        case TREE.BROAD: { // carob / eucalyptus-like
          b.trunk(0.2, 0.12, 3.2, 5, 2, C(0x6e5a48), 0.2);
          const g = C(0x5c8a3c), gt = C(0x93b85f);
          b.blob(0, 4.6, 0, 2.5, 2.1, 2.4, d, g, 4, 0.2, gt);
          if (!lod) b.blob(0.9, 5.4, 0.5, 1.6, 1.4, 1.6, d, g, 5, 0.2, gt);
          break;
        }
        case TREE.CYPRESS: {
          b.trunk(0.15, 0.1, 1.2, 4, 1, C(0x5b4a3c));
          b.blob(0, 5.2, 0, 0.95, 4.6, 0.95, d, C(0x3d6536), 6, 0.12, C(0x5a8248));
          break;
        }
        case TREE.OLIVE: {
          b.trunk(0.22, 0.14, 1.6, 5, 2, C(0x5f564b), 0.35);
          const g = C(0x8a9a6c), gt = C(0xb5c094);
          b.blob(0.3, 2.9, 0, 2.0, 1.4, 1.9, d, g, 7, 0.25, gt);
          if (!lod) b.blob(-0.7, 2.6, 0.6, 1.3, 1.0, 1.3, d, g, 8, 0.25, gt);
          break;
        }
        case TREE.BUSH: {
          b.blob(0, 0.55, 0, 1.0, 0.65, 0.95, d, C(0x7f8650), 9, 0.25, C(0xa1a56a));
          break;
        }
        case TREE.CITRUS: {
          b.trunk(0.1, 0.07, 1.0, 4, 1, C(0x5c4a3a));
          b.blob(0, 1.9, 0, 1.4, 1.2, 1.4, d, C(0x3f7532), 10, 0.14, C(0x67a048));
          if (!lod) for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 1.25; b.blob(Math.cos(a) * r, 1.6 + (i % 3) * 0.35, Math.sin(a) * r, 0.11, 0.11, 0.11, 0, C(0xf0a020), 20 + i, 0); }
          break;
        }
        case TREE.FICUS: { // Indian laurel: dense, dark, round
          b.trunk(0.25, 0.18, 2.4, 6, 2, C(0x8a8378));
          const g = C(0x3c6f30), gt = C(0x6aa04a);
          b.blob(0, 4.2, 0, 3.0, 2.4, 3.0, d, g, 11, 0.16, gt);
          if (!lod) b.blob(0.6, 5.2, -0.4, 2.0, 1.6, 2.0, d, g, 12, 0.16, gt);
          break;
        }
      }
      (lod ? far : near).push(b.geometry());
    }
  }
  return { near, far };
}

// trunk radius for walking collision (metres, scale 1)
export const TRUNK_R = [0.35, 0.3, 0.25, 0.25, 0.3, 0, 0.12, 0.35];
