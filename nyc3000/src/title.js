// Title scene (concept4): dark armored Statue of Liberty, glowing red eyes, red lasers, red-black city.
import * as THREE from 'three';
import { Parts } from './models.js';
import { glowTexture } from './textures.js';

export function buildTitleScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070000);
  scene.fog = new THREE.FogExp2(0x1a0003, 0.0045);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 600);
  const glow = glowTexture();

  const metal = new THREE.MeshStandardMaterial({ color: 0x4a4a58, metalness: 0.45, roughness: 0.4, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22222a, metalness: 0.4, roughness: 0.55, flatShading: true });
  const red = new THREE.MeshBasicMaterial({ color: 0xff1030, toneMapped: false });
  const redGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

  const statue = new THREE.Group(); scene.add(statue);
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); statue.add(m); return m; };
  // pedestal
  add(new THREE.BoxGeometry(22, 6, 22), dark, 0, 3, 0);
  add(new THREE.BoxGeometry(15, 12, 15), dark, 0, 12, 0);
  add(new THREE.BoxGeometry(17, 1.5, 17), metal, 0, 18.5, 0);
  const trim = new Parts();
  for (const y of [6.2, 14, 19.4]) { trim.box(15.3, 0.25, 0.2, '#ff1030', 0, y, 7.6); trim.box(0.2, 0.25, 15.3, '#ff1030', 7.6, y, 0); trim.box(0.2, 0.25, 15.3, '#ff1030', -7.6, y, 0); }
  for (let i = -3; i <= 3; i++) trim.box(0.4, 7, 0.2, '#ff1030', i * 2, 11, 7.55);
  statue.add(new THREE.Mesh(trim.build(), redGlow));
  // robe body
  const prof = [[3.6, 0], [3.4, 2], [3.0, 6], [2.6, 10], [2.5, 13], [2.8, 15], [2.2, 16.5], [0.9, 17.4], [0.7, 18.2]].map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(prof, 9), metal, 0, 19.2, 0);
  // armor plates: chest, belt, pauldrons
  add(new THREE.BoxGeometry(4.2, 3.2, 1.4), dark, 0, 32.5, -1.9, -0.1);
  add(new THREE.TorusGeometry(2.75, 0.35, 4, 9), dark, 0, 29.5, 0, Math.PI / 2);
  add(new THREE.TorusGeometry(3.05, 0.3, 4, 9), dark, 0, 25, 0, Math.PI / 2);
  add(new THREE.SphereGeometry(1.6, 6, 4), dark, -2.6, 34.4, 0, 0, 0, 0.3).scale.set(1, 0.6, 1);
  add(new THREE.SphereGeometry(1.6, 6, 4), dark, 2.6, 34.4, 0, 0, 0, -0.3).scale.set(1, 0.6, 1);
  const chestGlow = new Parts();
  chestGlow.box(0.15, 2.4, 0.1, '#ff1030', -0.9, 32.5, -2.62); chestGlow.box(0.15, 2.4, 0.1, '#ff1030', 0.9, 32.5, -2.62);
  chestGlow.box(1.2, 0.2, 0.1, '#ff1030', 0, 31.4, -2.62);
  chestGlow.add(new THREE.OctahedronGeometry(0.45, 0), '#ff3050', 0, 33, -2.65);
  statue.add(new THREE.Mesh(chestGlow.build(), redGlow));
  // head (helmet)
  const head = new THREE.Group(); head.position.set(0, 38.3, 0); statue.add(head);
  const hm = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 0), metal); hm.scale.set(1, 1.18, 1.05); head.add(hm);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 1.3), dark); jaw.position.set(0, -1.05, -0.55); head.add(jaw);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 0.6), dark); visor.position.set(0, 0.1, -1.2); head.add(visor);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), red); e.position.set(s * 0.48, 0.12, -1.52); head.add(e);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff1030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sp.scale.setScalar(2.4); sp.position.copy(e.position); sp.position.z -= 0.1; head.add(sp); eyes.push(sp);
  }
  // crown spikes
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.36;
    const g = new THREE.Group(); g.position.set(0, 1.0, 0); g.rotation.set(-0.35, 0, a); head.add(g);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.32, 3.4, 4), metal); sp.position.y = 2.1; g.add(sp);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 4), red); tip.position.y = 3.7; g.add(tip);
  }
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.25, 4, 10), dark); crownRing.rotation.x = Math.PI / 2 - 0.2; crownRing.position.y = 0.7; head.add(crownRing);
  // raised right arm + torch
  const arm = new THREE.Group(); arm.position.set(2.6, 34.2, 0); arm.rotation.set(0.12, 0, -0.18); statue.add(arm);
  const up = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 6, 6), metal); up.position.y = 3; arm.add(up);
  const gauntlet = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.2, 6), dark); gauntlet.position.y = 6.2; arm.add(gauntlet);
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 3, 6), dark); torch.position.y = 8.6; arm.add(torch);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.5, 1.3, 8), metal); cup.position.y = 10.6; arm.add(cup);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 6), new THREE.MeshBasicMaterial({ color: 0xff2a10, toneMapped: false })); flame.position.y = 12.4; arm.add(flame);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff3018, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  fl.scale.setScalar(9); fl.position.y = 12.4; arm.add(fl);
  const torchLight = new THREE.PointLight(0xff2010, 80, 40, 2); torchLight.position.y = 12; arm.add(torchLight);
  // left arm holding tablet
  const larm = new THREE.Group(); larm.position.set(-2.7, 33.8, 0); larm.rotation.set(-0.9, 0, 0.25); statue.add(larm);
  const lu = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 5, 6), metal); lu.position.y = -2.4; larm.add(lu);
  const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.8, 3.2), dark); tablet.position.set(-0.5, -5, -1.2); tablet.rotation.x = 0.7; larm.add(tablet);
  const tg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 2.2), red); tg.position.set(-0.83, -5, -1.2); tg.rotation.x = 0.7; larm.add(tg);

  // red-black city silhouettes
  const city = new Parts();
  const cityGlow = new Parts();
  for (let i = 0; i < 90; i++) {
    let x = (Math.random() - 0.5) * 420, z = -50 - Math.random() * 220;
    if (i % 3 === 0) { x = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 120); z = -40 + Math.random() * 70; }
    const w = 8 + Math.random() * 16, h = 30 + Math.random() * 150;
    city.box(w, h, w, '#0a0a0e', x, h / 2, z);
    for (let k = 0; k < 6; k++) cityGlow.box(w * 0.6, 0.4, 0.2, Math.random() < 0.8 ? '#7a0010' : '#ff2040', x, 10 + Math.random() * (h - 12), z + w / 2 + 0.2);
    if (Math.random() < 0.4) cityGlow.box(0.6, 0.6, 0.6, '#ff1030', x, h + 0.5, z);
  }
  scene.add(new THREE.Mesh(city.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.2 })));
  scene.add(new THREE.Mesh(cityGlow.build(), redGlow));
  // ground
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x0a0204, roughness: 0.2, metalness: 0.6 }));
  gr.rotation.x = -Math.PI / 2; scene.add(gr);
  const grid = new THREE.GridHelper(800, 80, 0x550010, 0x2a0008); grid.position.y = 0.05; scene.add(grid);

  // lasers: from eyes and from searchlights on the ground
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff1030, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const lasers = [];
  const mkLaser = (len, w) => { const g = new THREE.CylinderGeometry(w, w, len, 4, 1, true); g.translate(0, len / 2, 0); return new THREE.Mesh(g, laserMat); };
  for (let i = 0; i < 8; i++) {
    const l = mkLaser(400, 0.12 + Math.random() * 0.1);
    const piv = new THREE.Group(); piv.position.set((i - 3.5) * 22, 0, -60 - Math.random() * 60); piv.add(l); scene.add(piv);
    lasers.push({ piv, a: Math.random() * 6, s: 0.2 + Math.random() * 0.4, k: i });
  }
  const eyeBeams = [];
  for (const s of [-1, 1]) {
    const l = mkLaser(300, 0.08); const piv = new THREE.Group(); piv.position.set(s * 0.48, 0.12, -1.6); piv.add(l); head.add(piv);
    eyeBeams.push(piv);
  }
  // lights
  scene.add(new THREE.AmbientLight(0x300008, 1.0));
  const rim = new THREE.DirectionalLight(0xff1a30, 5); rim.position.set(-30, 40, 40); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xff3040, 2.0); rim2.position.set(40, 20, 30); scene.add(rim2);
  const under = new THREE.PointLight(0xff2030, 900, 90, 1.5); under.position.set(0, 10, 28); scene.add(under);
  const front = new THREE.DirectionalLight(0x8090c0, 1.6); front.position.set(0, 20, -60); scene.add(front);
  // red rain
  const N = 2500, pos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 140, y = Math.random() * 90, z = -Math.random() * 80 - 5; pos.set([x, y, z, x - 0.2, y - 1.6, z], i * 6); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xff5060, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(rain);

  statue.rotation.y = Math.PI; // face the camera (statue front is -z)
  let t = 0;
  function update(dt) {
    t += dt;
    camera.position.set(Math.sin(t * 0.08) * 8, 9 + Math.sin(t * 0.13) * 1.5, 44 + Math.cos(t * 0.08) * 3);
    camera.lookAt(0, 41, 0);
    for (const L of lasers) { L.piv.rotation.z = Math.sin(t * L.s + L.a) * 0.6; L.piv.rotation.x = -0.25 + Math.cos(t * L.s * 0.7 + L.a) * 0.25; }
    eyeBeams.forEach((b, i) => { b.rotation.x = -Math.PI / 2 - 0.18 + Math.sin(t * 0.5) * 0.06; b.rotation.z = (i ? -1 : 1) * (0.25 + Math.sin(t * 0.7) * 0.2); });
    const pulse = 0.85 + Math.sin(t * 3) * 0.15;
    eyes.forEach(e => e.scale.setScalar(2.4 * pulse));
    fl.scale.setScalar(8 + Math.sin(t * 13) * 0.6 + Math.sin(t * 7) * 0.5);
    flame.scale.set(1, 1 + Math.sin(t * 11) * 0.08, 1);
    const p = rain.geometry.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = p.array[i * 6 + 1] - dt * 50; if (y < 0) y += 90;
      p.array[i * 6 + 1] = y; p.array[i * 6 + 4] = y - 1.6;
    }
    p.needsUpdate = true;
  }
  return { scene, camera, update };
}
