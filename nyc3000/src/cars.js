// Procedural vehicles: extruded side-profile bodies with bevelled edges, glass cabins,
// rims with neon rings, light bars, decals; hover cars with nacelles, fins and thrusters.
// Each vehicle is two draw calls (glossy paint + details/lights) plus sirens on police.
import * as THREE from 'three';
import { Parts, MAT, paintMat, mesh, decalTexture } from './parts.js';
import { modelNode, markerPos, flatten } from './assets.js';

export const VEHICLE_TYPES = {
  sedan: { name: 'NEO-SEDAN', flying: false, maxSpeed: 52, accel: 14, armor: 100 },
  muscle: { name: 'VOLT RUNNER', flying: false, maxSpeed: 60, accel: 17, armor: 120 },
  police: { name: 'NYPD INTERCEPTOR', flying: false, maxSpeed: 62, accel: 18, armor: 160, police: true },
  hover: { name: 'HOVER SPORTS CAR', flying: true, maxSpeed: 95, accel: 24, armor: 110, cannon: true },
  taxi: { name: 'SKY TAXI', flying: true, maxSpeed: 75, accel: 18, armor: 120, cannon: true },
  flypolice: { name: 'NYPD SKY CRUISER', flying: true, maxSpeed: 100, accel: 26, armor: 180, police: true, cannon: true },
};
export const PAINTS = ['#c01848', '#1a6bd8', '#e8e8f0', '#202028', '#7a2bd8', '#16a08a', '#d86a16', '#8a1010', '#3a3f4a', '#d8c21a'];

// Extrude a side profile (x = forward, y = up) across the width; front ends up at -Z.
function profile(points, width, bevel = 0.07, holes = null, arcs = null) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.arc) s.absarc(p.arc[0], p.arc[1], p.arc[2], p.arc[3], p.arc[4], p.arc[5]);
    else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  void holes; void arcs;
  const depth = Math.max(0.02, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2); // shape x (forward) -> -z ... rotateY(90deg) maps x to -z
  g.computeVertexNormals();
  return g;
}

// ---------- ground cars ----------
function groundCar(type) {
  const muscle = type === 'muscle', police = type === 'police';
  const L = muscle ? 4.9 : 4.65, W = muscle ? 2.08 : 2.0, wb = muscle ? 1.5 : 1.45, wr = muscle ? 0.42 : 0.38;
  const half = L / 2, zc = 0.34;
  const paint = new Parts(), det = new Parts({ glow: true });
  const arch = (x, dir) => ({ arc: [x, wr + 0.02, wr + 0.08, dir > 0 ? Math.PI : 0, dir > 0 ? 0 : Math.PI, dir > 0] });
  // body: front is +x in profile space
  const body = [
    [-half + 0.05, zc], [-wb - wr - 0.08, zc], arch(-wb, 1), [wb - wr - 0.08, zc], arch(wb, 1),
    [half - 0.08, zc + 0.02], [half + 0.02, zc + 0.2], [half - 0.02, zc + 0.36],
    muscle ? [1.0, 0.92] : [1.15, 0.86], muscle ? [-1.7, 0.94] : [-1.65, 0.93],
    [-half + 0.1, muscle ? 0.95 : 0.87], [-half - 0.02, 0.62],
  ];
  paint.add(profile(body, W, 0.08), '#ffffff');
  // cabin glass + roof
  const cab = muscle
    ? [[-1.4, 0.92], [-0.55, 1.28], [0.35, 1.3], [1.05, 0.9]]
    : [[-1.55, 0.91], [-0.8, 1.36], [0.5, 1.38], [1.2, 0.86]];
  det.add(profile(cab, W * 0.8, 0.05), '#0b1626');
  const roof = muscle ? [[-0.58, 1.26], [-0.5, 1.33], [0.32, 1.35], [0.4, 1.28]] : [[-0.83, 1.34], [-0.75, 1.42], [0.48, 1.44], [0.55, 1.36]];
  paint.add(profile(roof, W * 0.78, 0.03), '#ffffff');
  // wheels: tyre, rim, hub, neon ring
  const neon = police ? '#4aa0ff' : (muscle ? '#ff2bd6' : '#29f3ff');
  for (const zx of [-wb, wb]) for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.13), z = -zx;
    det.lit().add(new THREE.CylinderGeometry(wr, wr, 0.27, 16), '#0b0b0e', x, wr, z, 0, 0, Math.PI / 2);
    det.add(new THREE.CylinderGeometry(wr * 0.66, wr * 0.66, 0.275, 10), '#8f98ad', x, wr, z, 0, 0, Math.PI / 2);
    det.add(new THREE.CylinderGeometry(wr * 0.2, wr * 0.2, 0.28, 6), '#1a1c22', x, wr, z, 0, 0, Math.PI / 2);
    for (let k = 0; k < 5; k++) det.add(new THREE.BoxGeometry(0.278, 0.05, wr * 1.1), '#3a404e', x, wr, z, k * Math.PI / 5, 0, 0);
    det.glow().add(new THREE.TorusGeometry(wr * 0.7, 0.018, 4, 18), neon, x + sx * 0.14, wr, z, 0, Math.PI / 2, 0).lit();
  }
  // lights
  const nose = -half - 0.01;
  det.glow();
  det.box(0.55, 0.06, 0.06, '#e8f6ff', -0.6, 0.62, nose + 0.06, 0.25);
  det.box(0.55, 0.06, 0.06, '#e8f6ff', 0.6, 0.62, nose + 0.06, 0.25);
  det.box(W * 0.62, 0.025, 0.04, neon, 0, 0.5, nose + 0.02);
  det.box(W * 0.9, 0.07, 0.05, '#ff1e3c', 0, muscle ? 0.82 : 0.76, half + 0.02);
  det.box(0.03, 0.03, L * 0.72, neon, -W / 2 - 0.01, 0.48, 0);
  det.box(0.03, 0.03, L * 0.72, neon, W / 2 + 0.01, 0.48, 0);
  det.box(W * 0.8, 0.02, L * 0.62, neon, 0, zc - 0.02, 0); // underglow strip
  if (muscle) { det.box(0.08, 0.08, 0.04, '#ffa43a', -0.45, 0.42, half + 0.03); det.box(0.08, 0.08, 0.04, '#ffa43a', 0.45, 0.42, half + 0.03); }
  det.lit();
  // details: mirrors, door seams, grille, bumpers
  for (const sx of [-1, 1]) {
    det.box(0.16, 0.08, 0.12, '#111318', sx * (W / 2 + 0.06), 1.0, -0.85);
    det.box(0.012, 0.42, 0.02, '#07080b', sx * (W / 2 + 0.006), 0.66, -0.35);
    det.box(0.012, 0.42, 0.02, '#07080b', sx * (W / 2 + 0.006), 0.66, 0.75);
    det.box(0.012, 0.02, 0.18, '#9aa4b8', sx * (W / 2 + 0.008), 0.78, 0.0);
  }
  det.box(W * 0.6, 0.14, 0.04, '#07080b', 0, 0.42, nose + 0.03);
  det.box(W * 0.98, 0.1, 0.1, '#15161c', 0, zc + 0.04, nose + 0.08);
  det.box(W * 0.98, 0.1, 0.1, '#15161c', 0, zc + 0.04, half - 0.06);
  if (muscle) {
    det.box(0.7, 0.08, 0.9, '#111318', 0, 0.97, -1.3);
    det.glow().box(0.5, 0.02, 0.02, '#ff2bd6', 0, 1.02, -1.75).lit();
    det.box(0.06, 0.28, 0.12, '#111318', -0.65, 1.06, 2.15); det.box(0.06, 0.28, 0.12, '#111318', 0.65, 1.06, 2.15);
    det.box(1.9, 0.05, 0.36, '#111318', 0, 1.22, 2.2, -0.12);
    det.glow().box(1.9, 0.02, 0.02, '#ff2bd6', 0, 1.25, 2.04).lit();
  }
  if (police) {
    det.box(1.3, 0.1, 0.42, '#0d0e12', 0, 1.47, 0.12);
    for (const sx of [-1, 1]) det.box(0.02, 0.32, 1.9, '#e8e8f0', sx * (W / 2 + 0.008), 0.66, 0.2);
    det.box(W * 0.82, 0.02, 0.5, '#e8e8f0', 0, 0.875, -1.4);
  }
  return { paint: paint.build(), det: det.build(), L, W, siren: police ? { y: 1.56, z: 0.12, w: 0.42 } : null, decal: police ? { text: 'NYPD', y: 0.66, z: 0.25, x: W / 2 + 0.03, col: '#1d3fb0' } : null };
}

// ---------- flying cars ----------
function hoverCar(type) {
  const taxi = type === 'taxi', police = type === 'flypolice';
  const L = police ? 5.3 : taxi ? 5.0 : 4.85, W = taxi ? 2.15 : 2.05, half = L / 2;
  const paint = new Parts(), det = new Parts({ glow: true });
  const thr = police ? '#4aa0ff' : taxi ? '#ffd23a' : '#29f3ff';
  const body = taxi
    ? [[-half, 0.28], [-half - 0.05, 0.75], [-half + 0.5, 0.92], [half - 1.0, 0.88], [half + 0.05, 0.55], [half - 0.1, 0.28], [0.5, 0.18], [-1.2, 0.18]]
    : [[-half + 0.1, 0.26], [-half - 0.04, 0.6], [-half + 0.4, 0.78], [0.9, 0.7], [half + 0.1, 0.36], [half - 0.15, 0.24], [0.6, 0.14], [-1.4, 0.16]];
  paint.add(profile(body, W, 0.12), '#ffffff');
  // canopy
  if (taxi) {
    det.add(profile([[-1.5, 0.9], [-0.9, 1.42], [0.6, 1.44], [1.35, 0.86]], W * 0.82, 0.06), '#0b1626');
    paint.add(profile([[-0.95, 1.4], [-0.88, 1.47], [0.58, 1.49], [0.65, 1.42]], W * 0.8, 0.03), '#ffffff');
  } else {
    det.add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#0a1424', 0, 0.68, 0.15, 0, 0, 0, W * 0.36, 0.5, police ? 1.6 : 1.45);
    det.glow().add(new THREE.TorusGeometry(1, 0.012, 4, 24), thr, 0, 0.69, 0.15, Math.PI / 2, 0, 0, W * 0.36, police ? 1.6 : 1.45, 1).lit();
  }
  // nacelles with intake rings and exhaust glow
  const nx = W / 2 + 0.22;
  for (const sx of [-1, 1]) {
    det.lit().add(new THREE.CapsuleGeometry(0.3, 1.6, 3, 10), police ? '#1a1d26' : '#22252f', sx * nx, 0.42, 0.25, Math.PI / 2, 0, 0);
    det.add(new THREE.CylinderGeometry(0.24, 0.3, 0.3, 12), '#0d0e12', sx * nx, 0.42, 1.35, Math.PI / 2, 0, 0);
    det.glow().add(new THREE.CircleGeometry(0.22, 12), thr, sx * nx, 0.42, 1.51, 0, 0, 0);
    det.add(new THREE.TorusGeometry(0.31, 0.025, 4, 16), thr, sx * nx, 0.42, -0.65, 0, 0, 0);
    det.add(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 14), thr, sx * nx, 0.1, 0.25);
    det.box(0.04, 0.04, 1.4, thr, sx * (nx + 0.3), 0.45, 0.25).lit();
    det.box(0.5, 0.06, 0.6, '#1a1d26', sx * (W / 2 + 0.05), 0.42, 0.25); // pylons
    // tail fin
    det.add(new THREE.BoxGeometry(0.05, 0.5, 0.7), police ? '#e8e8f0' : '#1a1d26', sx * 0.55, 0.95, half - 0.45, 0.35, 0, sx * -0.35);
    det.glow().box(0.055, 0.04, 0.6, thr, sx * 0.62, 1.15, half - 0.38, 0.35, 0, sx * -0.35).lit();
  }
  // lights
  det.glow();
  det.box(W * 0.62, 0.05, 0.05, '#e8f6ff', 0, 0.42, -half - 0.08);
  det.box(W * 0.75, 0.06, 0.05, '#ff1e3c', 0, 0.68, half + 0.01);
  det.box(0.03, 0.03, L * 0.75, taxi ? '#ffd23a' : '#ff2bd6', -W / 2 - 0.025, 0.55, 0);
  det.box(0.03, 0.03, L * 0.75, taxi ? '#ffd23a' : '#ff2bd6', W / 2 + 0.025, 0.55, 0);
  det.add(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 14), thr, 0, 0.14, -1.2);
  det.add(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 14), thr, 0, 0.14, 1.0);
  det.lit();
  det.box(W * 0.5, 0.1, 0.1, '#0d0e12', 0, 0.3, -half + 0.05);
  if (taxi) {
    det.box(0.9, 0.24, 0.32, '#111318', 0, 1.62, 0.0);
    det.glow().box(0.86, 0.18, 0.33, '#ffd23a', 0, 1.62, 0.0).lit();
    for (const sx of [-1, 1]) det.glow().box(0.02, 0.06, L * 0.6, '#111111', sx * (W / 2 + 0.03), 0.72, 0.2).lit();
  }
  if (police) {
    det.box(1.3, 0.1, 0.42, '#0d0e12', 0, 1.2, 0.3);
    for (const sx of [-1, 1]) det.box(0.02, 0.26, 2.2, '#e8e8f0', sx * (W / 2 + 0.035), 0.5, 0.1);
  }
  return {
    paint: paint.build(), det: det.build(), L, W,
    siren: police ? { y: 1.29, z: 0.3, w: 0.42 } : null,
    decal: police ? { text: 'NYPD', y: 0.5, z: 0.1, x: W / 2 + 0.06, col: '#1d3fb0' } : taxi ? { text: 'TAXI', y: 1.62, z: 0.0, x: 0.18, col: '#111111', roof: true } : null,
  };
}

// ---------- Blender cars (public/models/cars.glb): LOD 0 up close, LOD 1 far away ----------
const isPaint = m => (m.name.startsWith('paint') ? 'paint' : 'det');
function blenderCar(type) {
  const node = modelNode('cars', type);
  if (!node) return null;
  const hi = flatten(node, isPaint, { glow: true });
  const low = modelNode('cars', type + '_lod1');
  const lo = low ? flatten(low, isPaint, { glow: true }) : hi;
  const G = { blender: true, paint: hi.paint, det: hi.det, paint1: lo.paint, det1: lo.det, siren: null, decal: null };
  const s = markerPos('cars', type + '_siren');
  if (s) G.siren = { y: s.y, z: s.z };
  const d = markerPos('cars', type + '_decal');
  if (d) G.decal = { text: 'NYPD', x: d.x, y: d.y, z: d.z, col: '#1d3fb0' };
  const t = modelNode('cars', 'taxi_sign');
  if (type === 'taxi' && t) G.decal = { text: 'TAXI', roof: true, y: t.position.y, z: t.position.z, d: (t.userData.d || 0.3), col: '#111111' };
  return G;
}

const cache = {};
function geos(type) {
  if (!cache[type]) cache[type] = blenderCar(type) || (VEHICLE_TYPES[type].flying ? hoverCar(type) : groundCar(type));
  return cache[type];
}

const sirenGeo = new THREE.BoxGeometry(0.5, 0.12, 0.34);
const sirenRed = new THREE.MeshBasicMaterial({ color: 0xff1030, toneMapped: false });
const sirenBlue = new THREE.MeshBasicMaterial({ color: 0x2060ff, toneMapped: false });
export function flashSirens(t) {
  const a = Math.floor(t * 6) % 2;
  sirenRed.color.setHex(a ? 0xff1030 : 0x200005);
  sirenBlue.color.setHex(a ? 0x050820 : 0x2060ff);
}
const decalMats = {};
const decalGeo = new THREE.PlaneGeometry(1.3, 0.33);

export function makeVehicleMesh(type, paintHex) {
  const G = geos(type);
  const grp = new THREE.Group();
  const color = type === 'police' || type === 'flypolice' ? '#121318' : type === 'taxi' ? '#f2c21a' : paintHex;
  const body = new THREE.Group(); grp.add(body);
  if (G.blender) {
    const lod = new THREE.LOD(), near = new THREE.Group(), far = new THREE.Group();
    near.add(mesh(G.paint, paintMat(color)), mesh(G.det, MAT.detailRM));
    far.add(mesh(G.paint1, paintMat(color)), mesh(G.det1, MAT.detailRM));
    lod.addLevel(near, 0); lod.addLevel(far, 32);
    body.add(lod);
  } else {
    body.add(mesh(G.paint, paintMat(color)));
    body.add(mesh(G.det, MAT.detail));
  }
  if (G.siren) {
    const { y, z } = G.siren;
    const r = new THREE.Mesh(sirenGeo, sirenRed); r.position.set(-0.32, y, z); body.add(r);
    const b = new THREE.Mesh(sirenGeo, sirenBlue); b.position.set(0.32, y, z); body.add(b);
  }
  if (G.decal) {
    const d = G.decal, k = d.text + d.col;
    if (!decalMats[k]) decalMats[k] = new THREE.MeshBasicMaterial({ map: decalTexture(d.text, d.col), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(decalGeo, decalMats[k]);
      if (d.roof) { p.scale.set(0.55, 0.55, 1); p.position.set(0, d.y, (d.z || 0) + sx * ((d.d || 0.3) / 2 + 0.015)); p.rotation.y = sx > 0 ? 0 : Math.PI; }
      else { p.position.set(sx * d.x, d.y, d.z); p.rotation.y = sx * Math.PI / 2; }
      body.add(p);
    }
  }
  grp.userData.body = body;
  return grp;
}
