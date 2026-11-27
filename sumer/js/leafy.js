// Leafy trees (Medium graphics and up): trunks and branches, crowns made of many small cards that
// carry the painted leaf atlas (alpha-tested), with soft round-crown normals and darker insides.
// Same tree types and sizes as trees.js, so the forest data and collisions stay the same.
import * as THREE from 'three';
import { TREE, NTYPES } from './trees.js';
import { leafCell, WHITE_UV } from './textures.js';

function rnd(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const C = (h) => new THREE.Color(h);
const LEAF = { OLIVE: 0, BROAD: 1, NEEDLE: 2, FROND: 3 };

class LB {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.i = []; this.count = 0; }
  v(x, y, z, nx, ny, nz, col, u, w) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); this.uv.push(u, w); return this.count++; }
  tri(a, b, c) { this.i.push(a, b, c); }

  // a tapered tube from point a to point b (smooth normals), sampling the white block of the atlas
  tube(a, b, r0, r1, sides, col, col2 = null, rings = 1) {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = d.length(); d.normalize();
    const t = Math.abs(d.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(d, t).normalize(), w = new THREE.Vector3().crossVectors(d, u);
    const base = this.count;
    for (let k = 0; k <= rings; k++) {
      const f = k / rings, r = r0 + (r1 - r0) * f, cc = col2 && k % 2 ? col2 : col;
      for (let i = 0; i < sides; i++) {
        const an = i / sides * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an);
        const nx = u.x * ca + w.x * sa, ny = u.y * ca + w.y * sa, nz = u.z * ca + w.z * sa;
        this.v(a[0] + d.x * L * f + nx * r, a[1] + d.y * L * f + ny * r, a[2] + d.z * L * f + nz * r, nx, ny, nz, cc, WHITE_UV[0], WHITE_UV[1]);
      }
    }
    for (let k = 0; k < rings; k++) for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides, p0 = base + k * sides + i, p1 = base + k * sides + j, q0 = p0 + sides, q1 = p1 + sides;
      this.tri(p0, q1, p1); this.tri(p0, q0, q1);
    }
  }
  // a curved trunk made of a few tubes; returns the top point
  trunk(h, r0, r1, bend, sides, segs, col, col2 = null, lean = 0) {
    let prev = [0, 0, 0];
    for (let s = 1; s <= segs; s++) {
      const f = s / segs;
      const cur = [bend * f * f, h * f, lean * f * f];
      this.tube(prev, cur, r0 + (r1 - r0) * (s - 1) / segs, r0 + (r1 - r0) * f, sides, col, col2, 1);
      prev = cur;
    }
    return prev;
  }
  // crown of leaf cards inside an ellipsoid
  crown(cx, cy, cz, rx, ry, rz, n, size, cell, dark, light, seed, shell = 0.5) {
    const R = rnd(seed * 7919 + 17), uv = leafCell(cell);
    const nv = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3(), ax = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      let dx, dy, dz, l2;
      do { dx = R() * 2 - 1; dy = R() * 2 - 1; dz = R() * 2 - 1; l2 = dx * dx + dy * dy + dz * dz; } while (l2 > 1 || l2 < 0.02);
      const l = Math.sqrt(l2); dx /= l; dy /= l; dz /= l;
      const rr = shell + (1 - shell) * Math.sqrt(R());
      const px = cx + dx * rx * rr, py = cy + dy * ry * rr, pz = cz + dz * rz * rr;
      nv.set(dx + (R() - 0.5) * 1.1, dy + (R() - 0.5) * 1.1 + 0.25, dz + (R() - 0.5) * 1.1).normalize();
      ax.set(Math.abs(nv.y) < 0.9 ? 0 : 1, Math.abs(nv.y) < 0.9 ? 1 : 0, 0);
      t.crossVectors(ax, nv).normalize(); b.crossVectors(nv, t);
      const an = R() * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an);
      const tx = t.x * ca + b.x * sa, ty = t.y * ca + b.y * sa, tz = t.z * ca + b.z * sa;
      const bx = -t.x * sa + b.x * ca, by = -t.y * sa + b.y * ca, bz = -t.z * sa + b.z * ca;
      const s = size * (0.75 + R() * 0.5) / 2;
      const shade = Math.min(1, Math.max(0, 0.2 + 0.8 * rr * (0.55 + 0.45 * (dy * 0.5 + 0.5))));
      col.copy(dark).lerp(light, shade).multiplyScalar(0.92 + R() * 0.16);
      const flip = R() < 0.5;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      const base = this.count;
      for (const [cu, cvv] of corners) {
        const x = px + tx * s * cu + bx * s * cvv, y = py + ty * s * cu + by * s * cvv, z = pz + tz * s * cu + bz * s * cvv;
        // soft "round crown" normal: from the crown centre through this corner, a little of the card normal
        let nx = (x - cx) / rx, ny = (y - cy) / ry, nz = (z - cz) / rz;
        const nl = Math.hypot(nx, ny, nz) || 1; nx = nx / nl * 0.8 + nv.x * 0.2; ny = ny / nl * 0.8 + nv.y * 0.2 + 0.45; nz = nz / nl * 0.8 + nv.z * 0.2; // tilted up: undersides still see the sky
        const ml = Math.hypot(nx, ny, nz) || 1;
        const u = (cu < 0) !== flip ? uv.u0 : uv.u1, w = cvv < 0 ? uv.v0 : uv.v1;
        this.v(x, y, z, nx / ml, ny / ml, nz / ml, col, u, w);
      }
      this.tri(base, base + 1, base + 2); this.tri(base, base + 2, base + 3);
    }
  }
  // palm frond: an arched strip with a V cross-section, textured with the frond cell
  frond(baseY, ang, len, width, droop, segs, colA, colB, ox = 0) {
    const uv = leafCell(LEAF.FROND), um = (uv.u0 + uv.u1) / 2;
    const dx = Math.cos(ang), dz = Math.sin(ang), sx = -dz, sz = dx;
    const base = this.count, col = new THREE.Color();
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, d = len * t;
      const y = baseY + Math.sin(t * Math.PI * 0.55) * len * 0.3 - droop * t * t * len;
      const w = width * (1 - 0.45 * t) / 2;
      const cx = ox + dx * d, cz = dz * d;
      col.copy(colA).lerp(colB, t);
      const v = uv.v0 + (uv.v1 - uv.v0) * t;
      const ny = 0.85, nx = dx * 0.3, nz = dz * 0.3;
      this.v(cx + sx * w, y - w * 0.35, cz + sz * w, nx + sx * 0.3, ny, nz + sz * 0.3, col, uv.u0, v);
      this.v(cx, y + 0.04, cz, nx, 1, nz, col, um, v);
      this.v(cx - sx * w, y - w * 0.35, cz - sz * w, nx - sx * 0.3, ny, nz - sz * 0.3, col, uv.u1, v);
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 3, b = a + 3;
      this.tri(a, b, a + 1); this.tri(a + 1, b, b + 1); this.tri(a + 1, b + 1, a + 2); this.tri(a + 2, b + 1, b + 2);
    }
  }
  // tiny fruit (white texel, coloured by the vertex colour)
  fruit(x, y, z, r, col) {
    const g = new THREE.OctahedronGeometry(r, 0), p = g.attributes.position;
    const base = this.count;
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const l = Math.hypot(vx, vy, vz) || 1; this.v(x + vx, y + vy, z + vz, vx / l, vy / l, vz / l, col, WHITE_UV[0], WHITE_UV[1]); }
    for (let i = 0; i < p.count; i += 3) this.tri(base + i, base + i + 1, base + i + 2);
    g.dispose();
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// shade multipliers over the painted leaf colours: [inside/bottom, outside/top]
const SH = {
  olive: [C(0x8a8e80), C(0xffffff)], broad: [C(0x7a866c), C(0xffffff)], ficus: [C(0x66755c), C(0xf6fff0)],
  pine: [C(0x6e7a62), C(0xffffff)], cypress: [C(0x55624e), C(0xdce6d2)], bush: [C(0x8a8c70), C(0xfff8dc)], citrus: [C(0x6a7c60), C(0xf6fff0)],
};

export function makeLeafyTrees() {
  const near = [], far = [];
  for (let ty = 0; ty < NTYPES; ty++) {
    for (const lod of [0, 1]) {
      const b = new LB();
      const F = lod ? 0.33 : 1;            // fewer cards far away...
      const Z = lod ? 1.65 : 1;            // ...but bigger
      const sides = lod ? 4 : 7;
      switch (ty) {
        case TREE.PALM: {
          const bark = C(0xa09482), bark2 = C(0x8c806c);
          const top = b.trunk(9.5, 0.32, 0.22, 0.6, lod ? 5 : 8, lod ? 2 : 5, bark, bark2);
          if (!lod) b.tube([top[0], top[1] - 1.0, 0], [top[0], top[1] + 0.2, 0], 0.5, 0.32, 8, C(0x9a8660));
          const nf = lod ? 8 : 15;
          for (let i = 0; i < nf; i++) {
            const a = i / nf * Math.PI * 2 + (i % 2) * 0.21;
            b.frond(top[1], a, 3.3 + (i % 3) * 0.4, 1.35, 0.75 + (i % 2) * 0.45, lod ? 2 : 5, C(0xd8e8c4), C(0xffffff), top[0]);
          }
          if (!lod) for (let i = 0; i < 6; i++) b.frond(top[1] - 0.5, i * 1.05 + 0.3, 2.2, 0.9, 2.6, 3, C(0xb09a6a), C(0x8a7350), top[0]); // dry skirt
          break;
        }
        case TREE.PINE: { // Aleppo pine: leaning trunk, a few flat umbrella clusters of needles
          const top = b.trunk(6.2, 0.26, 0.13, 0.9, sides, lod ? 2 : 4, C(0x6e5644), null, 0.2);
          const cl = [[0.9, 6.5, 0.2, 2.6, 1.15, 2.4], [-0.5, 5.6, 0.9, 1.9, 0.95, 1.8], [1.7, 5.2, -1.0, 1.7, 0.85, 1.6], [0.2, 7.2, -0.6, 1.5, 0.7, 1.4]];
          cl.forEach((k, i) => {
            if (lod && i > 1) return;
            if (!lod) b.tube([top[0] * 0.8, top[1] - 1.2, top[2] * 0.8], [k[0], k[1] - 0.2, k[2]], 0.1, 0.05, 4, C(0x6e5644));
            b.crown(k[0], k[1], k[2], k[3], k[4], k[5], Math.round(30 * F) + 2, 1.7 * Z, LEAF.NEEDLE, SH.pine[0], SH.pine[1], 11 + i + lod * 50, 0.35);
          });
          break;
        }
        case TREE.BROAD: { // carob / eucalyptus
          const top = b.trunk(3.1, 0.21, 0.13, 0.25, sides, lod ? 1 : 3, C(0x6e5a48));
          if (!lod) for (let i = 0; i < 3; i++) { const a = i * 2.1; b.tube(top, [Math.cos(a) * 1.3, 4.3, Math.sin(a) * 1.3], 0.1, 0.05, 4, C(0x6e5a48)); }
          b.crown(0, 4.6, 0, 2.6, 2.0, 2.5, Math.round(56 * F) + 3, 1.5 * Z, LEAF.BROAD, SH.broad[0], SH.broad[1], 21 + lod * 50);
          if (!lod) b.crown(0.9, 5.5, 0.5, 1.6, 1.3, 1.6, 18, 1.3, LEAF.BROAD, SH.broad[0], SH.broad[1], 22);
          break;
        }
        case TREE.CYPRESS: {
          b.trunk(1.2, 0.15, 0.1, 0, sides, 1, C(0x5b4a3c));
          b.crown(0, 5.2, 0, 0.95, 4.6, 0.95, Math.round(48 * F) + 3, 1.15 * Z, LEAF.NEEDLE, SH.cypress[0], SH.cypress[1], 31 + lod * 50, 0.3);
          break;
        }
        case TREE.OLIVE: { // gnarled trunk, silvery spray
          const top = b.trunk(1.6, 0.24, 0.15, 0.35, sides, lod ? 1 : 3, C(0x645a4e));
          if (!lod) for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; b.tube(top, [0.3 + Math.cos(a) * 1.2, 2.6 + (i % 2) * 0.4, Math.sin(a) * 1.2], 0.1, 0.05, 4, C(0x645a4e)); }
          b.crown(0.3, 2.9, 0, 2.1, 1.4, 2.0, Math.round(48 * F) + 3, 1.35 * Z, LEAF.OLIVE, SH.olive[0], SH.olive[1], 41 + lod * 50);
          if (!lod) b.crown(-0.6, 2.6, 0.6, 1.3, 1.0, 1.3, 14, 1.2, LEAF.OLIVE, SH.olive[0], SH.olive[1], 42);
          break;
        }
        case TREE.BUSH: {
          b.crown(0, 0.6, 0, 1.0, 0.65, 0.95, Math.round(16 * F) + 2, 0.95 * Z, LEAF.BROAD, SH.bush[0], SH.bush[1], 51 + lod * 50, 0.3);
          break;
        }
        case TREE.CITRUS: {
          b.trunk(1.0, 0.1, 0.07, 0, sides, 1, C(0x5c4a3a));
          b.crown(0, 1.9, 0, 1.4, 1.2, 1.4, Math.round(34 * F) + 3, 0.95 * Z, LEAF.BROAD, SH.citrus[0], SH.citrus[1], 61 + lod * 50);
          if (!lod) for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 1.2; b.fruit(Math.cos(a) * r, 1.5 + (i % 3) * 0.4, Math.sin(a) * r, 0.09, C(0xf0a020)); }
          break;
        }
        case TREE.FICUS: { // Indian laurel street tree: pale trunk, dense dark crown
          const top = b.trunk(2.4, 0.26, 0.18, 0, sides, lod ? 1 : 2, C(0x8a8378));
          if (!lod) for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.3; b.tube(top, [Math.cos(a) * 1.5, 3.6, Math.sin(a) * 1.5], 0.12, 0.06, 4, C(0x8a8378)); }
          b.crown(0, 4.2, 0, 3.0, 2.4, 3.0, Math.round(78 * F) + 4, 1.6 * Z, LEAF.BROAD, SH.ficus[0], SH.ficus[1], 71 + lod * 50);
          if (!lod) b.crown(0.6, 5.2, -0.4, 2.0, 1.6, 2.0, 22, 1.4, LEAF.BROAD, SH.ficus[0], SH.ficus[1], 72);
          break;
        }
      }
      (lod ? far : near).push(b.geometry());
    }
  }
  return { near, far };
}
