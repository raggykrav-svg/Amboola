// Your own apartment: a penthouse near where you start (SHOP → HOME & PETS).
// Buy things to put in it (an arcade machine, an aquarium, a jukebox…). The trophy case fills
// up with a trophy for every medal you win. Up to four of your own cars wait in your garage
// on the street outside. Sleep in the bed to save. The house icon on the map shows the door.
import * as THREE from 'three';
import { Parts } from './parts.js';

const V3 = THREE.Vector3;
export const HOME_PRICE = 3000;
export const DECOR = [
  { id: 'sign', name: 'NEON SIGN', price: 300, text: '"HOME BASE" in pink neon on the wall', icon: '✨', color: '#ff2bd6' },
  { id: 'lava', name: 'LAVA LAMPS', price: 250, text: 'Three glowing lava lamps', icon: '🕯', color: '#ff8a3a' },
  { id: 'trophy', name: 'TROPHY CASE', price: 500, text: 'Shows a gold trophy for every medal you win', icon: '🏆', color: '#ffd23a' },
  { id: 'fish', name: 'HOLO FISH', price: 600, text: 'Hologram fish swimming through the air', icon: '🐟', color: '#29f3ff' },
  { id: 'juke', name: 'JUKEBOX', price: 700, text: 'A shiny retro jukebox with lights', icon: '🎵', color: '#b98cff' },
  { id: 'tank', name: 'AQUARIUM', price: 900, text: 'A big fish tank with robot fish', icon: '🐠', color: '#3aa0ff' },
  { id: 'arcade', name: 'ARCADE MACHINE', price: 1200, text: 'Your own arcade machine (NEON BLASTER)', icon: '🕹', color: '#3aff9a' },
  { id: 'gaming', name: 'GAMING SETUP', price: 1500, text: 'A big screen and a racing gaming chair', icon: '🎮', color: '#ff5a4e' },
  { id: 'robot', name: 'GOLDEN ROBOT', price: 2000, text: 'A giant golden robot statue', icon: '🤖', color: '#ffd23a' },
];
// where each thing stands in the penthouse (Blender room coordinates: x east, y north), its size for bumping into it
const SPOTS = {
  sign: [-2.8, -4.9, Math.PI, 0], lava: [1.8, 4.6, 0, 0.4], trophy: [-5.45, -3.2, 0, 0.45], fish: [0.5, -2.6, 0, 0],
  juke: [2.5, -4.55, Math.PI, 0.45], tank: [-1.3, -4.55, Math.PI, 0.5], arcade: [5.35, 0.3, Math.PI / 2, 0.45], gaming: [3.7, -0.9, Math.PI / 2, 0.6], robot: [-1.8, 4.4, Math.PI, 0.6],
};

const glow = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c), toneMapped: false });
const solid = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });
function textPlane(text, color, w, h) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d');
  g.font = `900 ${Math.round(c.height * 0.62)}px Orbitron, Arial Black`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color; g.fillText(text, 256, c.height / 2); g.shadowBlur = 0; g.fillStyle = '#fff'; g.globalAlpha = 0.65; g.fillText(text, 256, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
}

// ---------- the things you can buy ----------
function makeItem(id, t) {
  const grp = new THREE.Group(), P = new Parts();
  const add = (p, mat) => { const m = new THREE.Mesh(p.build(), mat || solid()); grp.add(m); return m; };
  if (id === 'sign') {
    const s = textPlane('HOME BASE', '#ff2bd6', 2.6, 0.7); s.position.set(0, 2.55, 0.06); grp.add(s);
  } else if (id === 'lava') {
    for (let k = 0; k < 3; k++) {
      P.cyl(0.12, 0.16, 0.12, 10, '#c0c4d0', k * 0.45 - 0.45, 0.06, 0); P.cyl(0.08, 0.12, 0.08, 10, '#c0c4d0', k * 0.45 - 0.45, 0.62, 0);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.46, 12), glow(['#ff2bd6', '#ff8a3a', '#29f3ff'][k])); l.position.set(k * 0.45 - 0.45, 0.35, 0); grp.add(l);
    }
    add(P);
  } else if (id === 'trophy') {
    P.box(0.45, 1.9, 1.7, '#3a2a1a', 0, 0.95, 0); for (let k = 0; k < 4; k++) P.box(0.42, 0.04, 1.6, '#e8d8b0', 0.02, 0.2 + k * 0.48, 0);
    add(P);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.8, 1.62), new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.18, roughness: 0.05 })); glass.position.set(0.235, 0.95, 0); grp.add(glass);
    grp.userData.cups = new THREE.Group(); grp.add(grp.userData.cups);
  } else if (id === 'fish') {
    grp.userData.fish = [];
    for (let k = 0; k < 6; k++) {
      const f = new THREE.Group(), m = glow(['#29f3ff', '#ff2bd6', '#3aff9a'][k % 3]); m.transparent = true; m.opacity = 0.75;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m); b.scale.set(1, 0.6, 2); f.add(b);
      const tl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), m); tl.rotation.x = -Math.PI / 2; tl.position.z = 0.38; f.add(tl);
      grp.add(f); grp.userData.fish.push({ f, a: k * 1.05, r: 1.2 + (k % 3) * 0.6, y: 1.6 + (k % 2) * 0.6, s: 0.4 + k * 0.07 });
    }
  } else if (id === 'juke') {
    P.box(0.9, 1.5, 0.55, '#6a1a2a', 0, 0.75, 0); P.cyl(0.45, 0.45, 0.55, 16, '#6a1a2a', 0, 1.5, 0, Math.PI / 2, 0, 0);
    add(P);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 6, 20, Math.PI), glow('#ffd23a')); arc.position.set(0, 1.5, 0.29); grp.add(arc);
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.02), glow(['#ff2bd6', '#29f3ff', '#3aff9a', '#ffd23a', '#b98cff'][k])); b.position.set(-0.28 + k * 0.14, 0.75, 0.285); grp.add(b); grp.userData.bars = (grp.userData.bars || []).concat(b); }
  } else if (id === 'tank') {
    P.box(1.3, 0.7, 0.55, '#1a1c24', 0, 0.35, 0); P.box(1.3, 0.06, 0.55, '#1a1c24', 0, 1.53, 0);
    add(P);
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a8aff, transparent: true, opacity: 0.35, roughness: 0.05, emissive: 0x0a3a8a, emissiveIntensity: 0.8 })); w.position.y = 1.1; grp.add(w);
    grp.userData.fish = [];
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.04), glow(['#ffa43a', '#ff2bd6', '#3aff9a', '#ffd23a'][k])); grp.add(f); grp.userData.fish.push({ f, a: k * 1.6, s: 0.6 + k * 0.15, y: 0.9 + k * 0.1 }); }
  } else if (id === 'arcade') {
    P.box(0.8, 1.2, 0.7, '#1a1a2a', 0, 0.6, 0); P.box(0.8, 0.7, 0.4, '#1a1a2a', 0, 1.55, 0.15); P.box(0.8, 0.12, 0.5, '#2a2a3a', 0, 1.22, -0.25, -0.3, 0, 0);
    P.box(0.04, 1.95, 0.72, '#3aff9a', -0.41, 0.98, 0); P.box(0.04, 1.95, 0.72, '#3aff9a', 0.41, 0.98, 0);
    add(P);
    const scr = textPlane('NEON BLASTER', '#3aff9a', 0.62, 0.44); scr.position.set(0, 1.55, -0.06); scr.rotation.y = Math.PI; grp.add(scr);
    const top = textPlane('ARCADE', '#ff2bd6', 0.7, 0.16); top.position.set(0, 1.85, -0.06); top.rotation.y = Math.PI; grp.add(top);
    grp.userData.screen = scr;
  } else if (id === 'gaming') {
    P.box(1.6, 0.05, 0.7, '#2a2a34', 0, 0.75, 0); P.box(0.08, 0.75, 0.08, '#2a2a34', -0.7, 0.37, 0); P.box(0.08, 0.75, 0.08, '#2a2a34', 0.7, 0.37, 0);
    P.box(0.6, 0.15, 0.6, '#c01848', 0, 0.5, 0.9); P.box(0.6, 0.9, 0.15, '#c01848', 0, 0.95, 1.2); P.cyl(0.04, 0.04, 0.45, 6, '#888', 0, 0.22, 0.9);
    add(P);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ toneMapped: false })); scr.position.set(0, 1.25, -0.25); grp.add(scr);
    grp.userData.tv = scr;
    const rgb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.02), glow('#29f3ff')); rgb.position.set(0, 0.77, -0.35); grp.add(rgb); grp.userData.rgb = rgb;
  } else if (id === 'robot') {
    const G = '#ffcf3a';
    P.box(0.9, 0.2, 0.9, '#3a2a1a', 0, 0.1, 0);
    P.box(0.26, 0.8, 0.26, G, -0.2, 0.6, 0); P.box(0.26, 0.8, 0.26, G, 0.2, 0.6, 0);
    P.box(0.8, 0.75, 0.5, G, 0, 1.38, 0); P.box(0.22, 0.65, 0.22, G, -0.55, 1.4, 0, 0, 0, 0.3); P.box(0.22, 0.65, 0.22, G, 0.6, 1.75, 0, 0, 0, -2.6);
    P.box(0.55, 0.45, 0.45, G, 0, 2.0, 0); P.box(0.06, 0.3, 0.06, G, 0, 2.35, 0);
    add(P, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.9, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.4 }));
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.02), glow('#fff7c0')); eyes.position.set(0, 2.03, -0.235); grp.add(eyes);
  }
  return grp;
}
function cup(color) {
  const P = new Parts(), G = '#ffcf3a';
  P.box(0.16, 0.05, 0.16, color, 0, 0.025, 0); P.cyl(0.02, 0.04, 0.1, 8, G, 0, 0.1, 0); P.cyl(0.08, 0.035, 0.12, 12, G, 0, 0.21, 0);
  P.add(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), G, -0.08, 0.22, 0, 0, 0, Math.PI / 2); P.add(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), G, 0.08, 0.22, 0, 0, 0, -Math.PI / 2);
  return new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.25, emissive: 0x4a3000, emissiveIntensity: 0.4 }));
}

export class Home {
  constructor(game) { this.g = game; this.owned = false; this.items = new Set(); this.door = null; this.built = new Map(); this.garageCars = []; }
  reset(save) {
    const h = (save && save.home) || {};
    this.owned = !!h.owned; this.items = new Set(h.items || []);
    this.pickDoor();
    if (this.owned && this.door) this.g.looted.add(this.door.id); // no stash to find in your own home
  }
  save() { return { home: { owned: this.owned, items: [...this.items] } }; }
  // the flat door nearest to where you start
  pickDoor() {
    const g = this.g; if (this.door) { this.door.isHome = this.owned; return; }
    let best = null, bd = Infinity;
    for (const d of g.city.doors) { if (d.kind === 'shop' || d.kind === 'hotel' || d.hotelFloor) continue; const dd = Math.hypot(d.x - 13, d.z + 22); if (dd < bd) { bd = dd; best = d; } }
    this.door = best; if (best) best.isHome = this.owned;
  }
  buy() {
    const g = this.g;
    if (this.owned) return 'owned';
    if (g.cash < HOME_PRICE) return 'cash';
    g.cash -= HOME_PRICE; this.owned = true; this.door.isHome = true; g.looted.add(this.door.id);
    g.audio.play('cash'); g.prog.medal('home');
    g.gps.set({ x: this.door.x + this.door.nx * 2, z: this.door.z + this.door.nz * 2 }, 'YOUR APARTMENT');
    return 'ok';
  }
  buyItem(id) {
    const g = this.g, it = DECOR.find(x => x.id === id);
    if (!this.owned) return 'home';
    if (this.items.has(id)) return 'owned';
    if (g.cash < it.price) return 'cash';
    g.cash -= it.price; this.items.add(id); g.audio.play('cash');
    if (this.items.size >= 5) g.prog.medal('decor');
    if (g.interior && g.interior.home) this.furnish(g.interior.room);
    return 'ok';
  }
  // put everything you bought into the room (once each), and update the trophies
  furnish(R) {
    const g = this.g, o = R.origin;
    for (const id of this.items) {
      if (this.built.has(id)) continue;
      const m = makeItem(id, g.time), [bx, by, rot, half] = SPOTS[id];
      m.position.set(o.x + bx, 0.02, o.z - by); m.rotation.y = rot;
      g.scene.add(m); R.objects.push(m); this.built.set(id, m);
      if (half) g.city.addBox({ x0: o.x + bx - half, x1: o.x + bx + half, z0: o.z - by - half, z1: o.z - by + half, y0: 0, y1: 1.8 });
    }
    const tc = this.built.get('trophy');
    if (tc) {
      const cups = tc.userData.cups; cups.clear();
      const cols = ['#ff2bd6', '#29f3ff', '#3aff9a', '#ffd23a', '#ff5a4e', '#b98cff'];
      [...g.prog.medals].slice(0, 24).forEach((id, k) => { const c = cup(cols[k % cols.length]); c.position.set(0, 0.22 + Math.floor(k / 6) * 0.48, -0.65 + (k % 6) * 0.26); cups.add(c); });
    }
    for (const m of this.built.values()) m.visible = true;
  }
  // inside: animate the fun stuff
  updateInside(dt) {
    const t = this.g.time;
    const f = this.built.get('fish');
    if (f) for (const q of f.userData.fish) { q.a += dt * q.s; q.f.position.set(Math.cos(q.a) * q.r, q.y + Math.sin(q.a * 2) * 0.15, Math.sin(q.a) * q.r); q.f.rotation.y = -q.a; }
    const tk = this.built.get('tank');
    if (tk) for (const q of tk.userData.fish) { q.a += dt * q.s; q.f.position.set(Math.cos(q.a) * 0.5, q.y + Math.sin(q.a * 3) * 0.08, 0.05); q.f.rotation.y = Math.sin(q.a) > 0 ? 0 : Math.PI; }
    const j = this.built.get('juke');
    if (j) j.userData.bars.forEach((b, k) => (b.scale.y = 0.5 + Math.abs(Math.sin(t * 4 + k)) * 0.6));
    const gm = this.built.get('gaming');
    if (gm) { if (!gm.userData.tv.material.map && this.g.city.bbTex.length) { gm.userData.tv.material.map = this.g.city.bbTex[3 % this.g.city.bbTex.length].tex; gm.userData.tv.material.needsUpdate = true; } gm.userData.rgb.material.color.setHSL((t * 0.2) % 1, 1, 0.55); }
  }
  // your garage: up to four of your cars parked on the street by your door
  updateGarage() {
    const g = this.g, d = this.door;
    if (!this.owned || !d || g.interior) return;
    const pp = g.wpos(), near = Math.hypot(pp.x - d.x, pp.z - d.z) < 140;
    if (!near) { this.parked = false; return; }
    if (this.parked) return;
    this.parked = true;
    const types = [...g.garage].filter(tp => !g.vehicles.some(v => v.owned === tp)).slice(0, 4);
    const tx = -d.nz, tz = d.nx;
    types.forEach((tp, k) => {
      for (let tries = 0; tries < 6; tries++) {
        const s = (k * 6.5 - 9.75) + tries * 26 * (tries % 2 ? 1 : -1);
        const x = d.x + d.nx * 9 + tx * s, z = d.z + d.nz * 9 + tz * s;
        if (g.city.collide(x, z, 2.4, 0.2, 1.8).hit || g.vehicles.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 5)) continue;
        const v = g._addVehicle(tp, x, z, Math.atan2(-tx, -tz), 'parked'); v.hasDriver = false; v.owned = tp;
        if (v.flying) v.pos.y = 0.7;
        break;
      }
    });
  }
}
