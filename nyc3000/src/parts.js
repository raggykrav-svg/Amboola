// Shared building blocks for procedural models: a part merger with vertex colors,
// optional per-vertex glow and bone binding, plus the shared materials.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

// Collect primitive parts, merge into one geometry.
//   new Parts()                       position, normal, color
//   new Parts({ glow: true })         + 'glow' attribute (0 = lit, 1 = neon)
//   new Parts({ glow: true, bones })  + skinIndex / skinWeight (rigid binding)
export class Parts {
  constructor(opts = {}) {
    this.list = [];
    this.useGlow = !!opts.glow;
    this.useBones = !!opts.bones;
    this.curGlow = 0;
    this.curBone = 0;
    this.boneMatrix = null; // part transforms are relative to this (bone rest pose) when set
  }
  glow(v = 1) { this.curGlow = v; return this; }
  lit() { this.curGlow = 0; return this; }
  bone(i, restMatrix) { this.curBone = i; this.boneMatrix = restMatrix || null; return this; }
  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    if (this.boneMatrix) _m.premultiply(this.boneMatrix);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    _c.set(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (this.useGlow) g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(this.curGlow), 1));
    if (this.useBones) {
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = this.curBone; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    }
    this.list.push(g);
    return this;
  }
  // add geometry that already has per-vertex colours (Blender models); color overrides them
  addColored(geo, matrix = null, color = null) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const a of ['uv', 'uv1', 'glow', 'rm', 'skinIndex', 'skinWeight']) if (g.attributes[a]) g.deleteAttribute(a);
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    if (color) {
      _c.set(color);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    if (this.useGlow) g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(this.curGlow), 1));
    this.list.push(g);
    return this;
  }
  box(w, h, d, color, x, y, z, rx, ry, rz) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz); }
  // rounded-ish box: a box with its vertical edges chamfered (8-sided prism)
  slab(w, h, d, color, x, y, z, rx, ry, rz, ch = 0.25) {
    const s = new THREE.Shape(), a = w / 2, b = d / 2, c = Math.min(a, b) * ch;
    s.moveTo(-a + c, -b); s.lineTo(a - c, -b); s.lineTo(a, -b + c); s.lineTo(a, b - c); s.lineTo(a - c, b); s.lineTo(-a + c, b); s.lineTo(-a, b - c); s.lineTo(-a, -b + c); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); g.translate(0, -h / 2, 0);
    return this.add(g, color, x, y, z, rx, ry, rz);
  }
  cyl(rt, rb, h, seg, color, x, y, z, rx, ry, rz) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, rx, ry, rz); }
  capsule(r, len, color, x, y, z, rx, ry, rz, seg = 7) { return this.add(new THREE.CapsuleGeometry(r, len, 2, seg), color, x, y, z, rx, ry, rz); }
  sphere(r, color, x, y, z, sx = 1, sy = 1, sz = 1, wseg = 8, hseg = 6) { return this.add(new THREE.SphereGeometry(r, wseg, hseg), color, x, y, z, 0, 0, 0, sx, sy, sz); }
  build() {
    const g = this.list.length ? mergeGeometries(this.list) : new THREE.BufferGeometry();
    g.computeBoundingSphere();
    return g;
  }
}

// MeshStandardMaterial where vertices with glow = 1 shine like neon (one draw call for body + lights).
// perVertexRM: roughness / metalness come from a per-vertex 'rm' attribute (Blender models).
export function glowStandard(params = {}, glowGain = 2.4, perVertexRM = false) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...params });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;' + (perVertexRM ? '\nattribute vec2 rm;\nvarying vec2 vRM;' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;' + (perVertexRM ? '\nvRM = rm;' : ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;' + (perVertexRM ? '\nvarying vec2 vRM;' : ''))
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * vGlow * ${glowGain.toFixed(2)};
        diffuseColor.rgb *= 1.0 - vGlow * 0.85;`);
    if (perVertexRM) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;');
    }
  };
  m.customProgramCacheKey = () => 'glowStd' + glowGain + (perVertexRM ? 'rm' : '');
  return m;
}

export const MAT = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2, flatShading: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  // characters (skinned) and vehicle details
  skin: glowStandard({ roughness: 0.55, metalness: 0.25, flatShading: true }),
  detail: glowStandard({ roughness: 0.4, metalness: 0.45 }),
  // Blender models: smooth shading, roughness / metalness per vertex
  detailRM: glowStandard({}, 2.4, true),
  skinRM: glowStandard({}, 2.4, true),
  paint: {},
};
// car paint; the vertex colour carries the baked ambient occlusion (white on procedural cars)
// shiny clear-coat paint (a glossy lacquer layer over metallic paint) on Medium and High
let clearcoat = 1;
export function paintMat(hex) {
  if (!MAT.paint[hex]) MAT.paint[hex] = new THREE.MeshPhysicalMaterial({ color: hex, vertexColors: true, roughness: 0.32, metalness: 0.6, envMapIntensity: 1.5, clearcoat, clearcoatRoughness: 0.05 });
  return MAT.paint[hex];
}
export function setPaintQuality(hi) {
  clearcoat = hi ? 1 : 0;
  for (const m of Object.values(MAT.paint)) m.clearcoat = clearcoat;
}

export function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = false; return m; }

// One-line text decal texture (NYPD, TAXI, ...) on a transparent background
const decalCache = {};
export function decalTexture(text, color, bg = 'rgba(0,0,0,0)') {
  const k = text + color + bg;
  if (decalCache[k]) return decalCache[k];
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.font = '900 44px Orbitron, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 10; g.fillStyle = color; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  decalCache[k] = t;
  return t;
}
