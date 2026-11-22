// Models: guns, drones, pickups. People live in people.js, vehicles in cars.js.
import * as THREE from 'three';
import { Parts, MAT, paintMat, mesh } from './parts.js';

export { Parts, MAT, paintMat };
export { Humanoid, pedKindFor } from './people.js';
export { VEHICLE_TYPES, PAINTS, makeVehicleMesh, flashSirens } from './cars.js';

// ---------- GUNS ----------
export const WEAPONS = [
  { id: 'rifle', name: 'PLASMA RIFLE', mag: 28, reserve: 120, rate: 0.1, dmg: 18, speed: 115, spread: 0.012, auto: true, color: 0x29f3ff, pellets: 1, reload: 1.6, sound: 'rifle' },
  { id: 'pistol', name: 'PULSE PISTOL', mag: 12, reserve: 72, rate: 0.22, dmg: 34, speed: 130, spread: 0.006, auto: false, color: 0xff2bd6, pellets: 1, reload: 1.1, sound: 'pistol' },
  { id: 'shotgun', name: 'SCATTER CANNON', mag: 6, reserve: 30, rate: 0.75, dmg: 13, speed: 100, spread: 0.07, auto: false, color: 0xffa43a, pellets: 8, reload: 2.0, sound: 'shotgun' },
  // sold in the pause-menu shop
  { id: 'smg', name: 'VOLT SMG', mag: 40, reserve: 200, rate: 0.065, dmg: 11, speed: 125, spread: 0.022, auto: true, color: 0x3aff9a, pellets: 1, reload: 1.4, sound: 'smg', price: 600, cred: 0 },
  { id: 'sniper', name: 'RAIL SNIPER', mag: 5, reserve: 30, rate: 0.9, dmg: 130, speed: 260, spread: 0, auto: false, color: 0xbff4ff, pellets: 1, reload: 2.2, sound: 'rail', zoom: true, price: 1500, cred: 1 },
  { id: 'launcher', name: 'PLASMA LAUNCHER', mag: 3, reserve: 12, rate: 1.0, dmg: 60, speed: 75, spread: 0, auto: false, color: 0xff7a2a, pellets: 1, reload: 2.4, sound: 'cannon', explode: 6, price: 3000, cred: 2 },
];

// Gun front is -Z. userData: muzzle (Object3D), grip / fore (hand targets), stock (length behind the origin).
const gunCache = {};
function gunGeo(id) {
  if (gunCache[id]) return gunCache[id];
  const P = new Parts({ glow: true });
  let info;
  if (id === 'rifle') {
    P.slab(0.1, 0.15, 0.62, '#2b3140', 0, 0.02, -0.22, 0, 0, 0, 0.3);
    P.box(0.11, 0.06, 0.5, '#3a4152', 0, 0.11, -0.26);                    // top cover
    P.cyl(0.035, 0.035, 0.42, 8, '#1a1d26', 0, 0.03, -0.72, Math.PI / 2);   // barrel
    P.cyl(0.055, 0.055, 0.2, 8, '#2b3140', 0, 0.03, -0.62, Math.PI / 2);    // shroud
    P.box(0.07, 0.19, 0.1, '#14161c', 0, -0.11, -0.04, 0.3);                // grip
    P.box(0.08, 0.2, 0.12, '#1a1d26', 0, -0.12, -0.24, -0.15);              // magazine
    P.box(0.07, 0.11, 0.14, '#14161c', 0, -0.06, -0.42);                    // fore-grip block
    P.slab(0.09, 0.13, 0.27, '#2b3140', 0, 0.0, 0.17, 0, 0, 0, 0.3);         // stock
    P.box(0.05, 0.06, 0.2, '#14161c', 0, 0.19, -0.2);                        // scope
    P.glow();
    P.box(0.112, 0.025, 0.42, '#29f3ff', 0, 0.06, -0.26);
    for (const z of [-0.56, -0.64, -0.72]) P.cyl(0.06, 0.06, 0.02, 8, '#29f3ff', 0, 0.03, z, Math.PI / 2);
    P.sphere(0.035, '#bfffff', 0, 0.03, -0.94);
    P.box(0.095, 0.08, 0.015, '#29f3ff', 0, 0.0, 0.305);
    P.box(0.052, 0.02, 0.02, '#ff2bd6', 0, 0.19, -0.31);
    P.box(0.082, 0.03, 0.1, '#29f3ff', 0, -0.12, -0.24);
    info = { muzzle: -0.97, grip: [0, -0.1, -0.03], fore: [-0.02, -0.1, -0.22], stock: 0.3 };
  } else if (id === 'pistol') {
    P.slab(0.075, 0.12, 0.34, '#2b2a38', 0, 0.04, -0.12, 0, 0, 0, 0.3);
    P.box(0.07, 0.19, 0.09, '#14161c', 0, -0.08, 0.0, 0.25);
    P.cyl(0.03, 0.03, 0.08, 8, '#14161c', 0, 0.05, -0.32, Math.PI / 2);
    P.glow();
    P.box(0.082, 0.025, 0.26, '#ff2bd6', 0, 0.085, -0.14);
    P.sphere(0.03, '#ffb0ff', 0, 0.05, -0.37);
    P.box(0.075, 0.03, 0.02, '#ff2bd6', 0, -0.03, 0.045);
    info = { muzzle: -0.38, grip: [0, -0.1, 0.02], fore: [-0.04, -0.12, 0.0], stock: 0.42 };
  } else if (id === 'shotgun') {
    P.slab(0.14, 0.15, 0.56, '#3a2d26', 0, 0.02, -0.18, 0, 0, 0, 0.25);
    P.cyl(0.05, 0.05, 0.5, 8, '#2a2f3a', 0, 0.06, -0.66, Math.PI / 2);
    P.cyl(0.045, 0.045, 0.5, 8, '#2a2f3a', 0, -0.03, -0.62, Math.PI / 2);
    P.box(0.12, 0.09, 0.22, '#4a3a30', 0, -0.04, -0.5);                     // pump
    P.box(0.08, 0.21, 0.1, '#14161c', 0, -0.11, -0.02, 0.3);
    P.slab(0.1, 0.14, 0.28, '#2a201b', 0, 0, 0.21, 0, 0, 0, 0.3);
    P.glow();
    P.box(0.145, 0.035, 0.36, '#ffa43a', 0, 0.1, -0.2);
    P.cyl(0.06, 0.06, 0.02, 8, '#ffd27a', 0, 0.06, -0.92, Math.PI / 2);
    P.box(0.125, 0.02, 0.2, '#ffa43a', 0, -0.09, -0.5);
    info = { muzzle: -0.93, grip: [0, -0.1, -0.02], fore: [-0.02, -0.09, -0.3], stock: 0.34 };
  } else if (id === 'smg') {
    P.slab(0.09, 0.14, 0.44, '#262c38', 0, 0.02, -0.16, 0, 0, 0, 0.3);
    P.cyl(0.03, 0.03, 0.2, 8, '#14161c', 0, 0.04, -0.46, Math.PI / 2);
    P.box(0.07, 0.17, 0.09, '#14161c', 0, -0.1, -0.02, 0.25);
    P.box(0.06, 0.3, 0.07, '#1a1d26', 0, -0.2, -0.2, -0.1); // long magazine
    P.box(0.06, 0.12, 0.08, '#14161c', 0, -0.08, -0.33);
    P.box(0.05, 0.05, 0.22, '#2a303c', 0, 0.02, 0.13);   // folding stock
    P.box(0.05, 0.12, 0.04, '#2a303c', 0, -0.03, 0.24);
    P.glow();
    P.box(0.095, 0.022, 0.32, '#3aff9a', 0, 0.09, -0.16);
    P.box(0.065, 0.03, 0.08, '#3aff9a', 0, -0.28, -0.2);
    P.sphere(0.03, '#c8ffd8', 0, 0.04, -0.57);
    info = { muzzle: -0.6, grip: [0, -0.1, -0.02], fore: [-0.02, -0.1, -0.3], stock: 0.24 };
  } else if (id === 'sniper') {
    P.slab(0.1, 0.15, 0.7, '#2e3442', 0, 0.02, -0.2, 0, 0, 0, 0.3);
    P.cyl(0.03, 0.03, 0.75, 8, '#14161c', 0, 0.04, -0.9, Math.PI / 2);   // rail barrel
    for (const z of [-0.65, -0.95, -1.2]) P.box(0.1, 0.03, 0.05, '#2e3442', 0, 0.04, z);
    P.box(0.07, 0.19, 0.1, '#14161c', 0, -0.11, -0.02, 0.3);
    P.box(0.07, 0.14, 0.1, '#1a1d26', 0, -0.09, -0.24);
    P.slab(0.09, 0.15, 0.32, '#2e3442', 0, -0.01, 0.2, 0, 0, 0, 0.3);
    P.cyl(0.045, 0.045, 0.36, 10, '#14161c', 0, 0.18, -0.2, Math.PI / 2);  // scope
    P.box(0.04, 0.06, 0.04, '#14161c', 0, 0.12, -0.12);
    P.box(0.04, 0.06, 0.04, '#14161c', 0, 0.12, -0.3);
    P.glow();
    for (const z of [-0.65, -0.95, -1.2]) P.box(0.105, 0.012, 0.03, '#bff4ff', 0, 0.06, z);
    P.box(0.105, 0.02, 0.5, '#29f3ff', 0, 0.1, -0.22);
    P.cyl(0.04, 0.04, 0.01, 10, '#ff2bd6', 0, 0.18, -0.385, Math.PI / 2);
    P.sphere(0.03, '#e8ffff', 0, 0.04, -1.29);
    info = { muzzle: -1.32, grip: [0, -0.1, -0.03], fore: [-0.02, -0.1, -0.26], stock: 0.36 };
  } else if (id === 'launcher') {
    P.cyl(0.1, 0.1, 0.95, 12, '#2a2e3a', 0, 0.03, -0.3, Math.PI / 2);
    P.cyl(0.12, 0.12, 0.12, 12, '#1a1d26', 0, 0.03, -0.76, Math.PI / 2);
    P.cyl(0.11, 0.11, 0.1, 12, '#1a1d26', 0, 0.03, 0.15, Math.PI / 2);
    P.box(0.07, 0.2, 0.1, '#14161c', 0, -0.13, -0.05, 0.25);
    P.box(0.07, 0.18, 0.08, '#14161c', 0, -0.13, -0.42, -0.15);
    P.box(0.05, 0.1, 0.12, '#14161c', 0, 0.17, -0.3);
    P.glow();
    for (const z of [-0.55, -0.3, -0.05]) P.cyl(0.105, 0.105, 0.03, 12, '#ff7a2a', 0, 0.03, z, Math.PI / 2);
    P.cyl(0.08, 0.08, 0.01, 12, '#ffb070', 0, 0.03, -0.83, Math.PI / 2);
    P.box(0.02, 0.02, 0.06, '#ff2bd6', 0, 0.23, -0.3);
    info = { muzzle: -0.84, grip: [0, -0.12, -0.04], fore: [-0.02, -0.12, -0.38], stock: 0.24 };
  }
  gunCache[id] = { geo: P.build(), info };
  return gunCache[id];
}

export function makeGun(id) {
  const { geo, info } = gunGeo(id);
  const grp = new THREE.Group();
  grp.add(mesh(geo, MAT.detail));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.04, info.muzzle); grp.add(muzzle);
  grp.userData.muzzle = muzzle;
  grp.userData.grip = new THREE.Vector3(...info.grip);
  grp.userData.fore = new THREE.Vector3(...info.fore);
  grp.userData.stock = info.stock;
  return grp;
}

// ---------- DRONE ----------
let droneGeo = null;
export function makeDrone(police = false) {
  if (!droneGeo) {
    const b = new Parts(), g = new Parts();
    b.add(new THREE.IcosahedronGeometry(0.6, 1), '#1c1f2a', 0, 0, 0, 0, 0, 0, 1, 0.62, 1);
    b.box(1.9, 0.08, 0.16, '#2a2f3d', 0, 0.1, 0, 0, Math.PI / 4);
    b.box(1.9, 0.08, 0.16, '#2a2f3d', 0, 0.1, 0, 0, -Math.PI / 4);
    b.box(0.12, 0.12, 0.5, '#111', -0.3, -0.25, -0.3);
    b.box(0.12, 0.12, 0.5, '#111', 0.3, -0.25, -0.3);
    b.cyl(0.3, 0.42, 0.12, 10, '#2a2f3d', 0, 0.3, 0);
    for (const [x, z] of [[0.67, 0.67], [-0.67, 0.67], [0.67, -0.67], [-0.67, -0.67]]) {
      b.cyl(0.07, 0.07, 0.14, 6, '#111', x, 0.16, z);
      g.add(new THREE.TorusGeometry(0.28, 0.035, 4, 14), '#ffffff', x, 0.14, z, Math.PI / 2);
    }
    g.add(new THREE.SphereGeometry(0.18, 10, 8), '#ffffff', 0, -0.02, -0.5);
    g.box(0.5, 0.03, 0.03, '#ffffff', 0, -0.05, -0.56);
    droneGeo = { b: b.build(), g: g.build() };
  }
  const grp = new THREE.Group();
  grp.add(mesh(droneGeo.b, MAT.body));
  const gm = new THREE.MeshBasicMaterial({ color: police ? 0x4aa0ff : 0xff1e3c, toneMapped: false });
  const gl = mesh(droneGeo.g, gm, false); grp.add(gl);
  grp.userData.glowMat = gm;
  return grp;
}

// ---------- PICKUPS ----------
const pickupGeo = {};
export function makePickup(kind) {
  const grp = new THREE.Group();
  if (!pickupGeo[kind]) {
    const b = new Parts(), g = new Parts(), c = kind === 'health' ? '#3aff7a' : kind === 'cash' ? '#ffd23a' : '#ffa43a';
    b.box(0.7, 0.45, 0.5, kind === 'cash' ? '#1f5a30' : '#1d2230', 0, 0, 0);
    g.box(0.72, 0.08, 0.52, c, 0, 0.08, 0);
    g.box(0.2, 0.2, 0.54, c, 0, -0.05, 0);
    if (kind === 'health') g.box(0.54, 0.08, 0.2, c, 0, 0.06, 0); // plus sign on top
    pickupGeo[kind] = { b: b.build(), g: g.build() };
  }
  grp.add(mesh(pickupGeo[kind].b, MAT.body));
  grp.add(mesh(pickupGeo[kind].g, MAT.glow, false));
  return grp;
}
