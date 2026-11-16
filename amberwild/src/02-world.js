// ---------- the island: height grid, terrain, water, sky, plants, rocks, pickups
const WORLD = 768, GN = 256, CELL = WORLD / GN, HALF = WORLD / 2;
const POI = { spawn: [10, 262], volcano: [-50, -175], lake: [70, 40], outpost: [195, -20], rex: [-165, -40] };
const H = new Float32Array((GN + 1) * (GN + 1));
const QUAL = { low: { pr: 1, shadow: 0, grass: 4500, far: 430 }, med: { pr: 1.25, shadow: 1024, grass: 10000, far: 560 }, high: { pr: 1.75, shadow: 2048, grass: 18000, far: 680 } };
let sun, hemi, sky, water, terrain, grass, heightTex, lava, clouds, Q = QUAL.med;

let flatY = null;
function heightGen(x, z, raw) {
  const d = Math.hypot(x, z) / 320 + (fbm(x * .004 + 40, z * .004 + 40, 3) - .5) * .35;
  const mask = smooth(1, .5, d);
  let h = -7 + mask * (9 + fbm(x * .0065, z * .0065, 5) * 38 + Math.pow(fbm(x * .02 + 7, z * .02 + 3, 3), 2) * 9);
  const dv = dist2(x, z, ...POI.volcano);
  h += Math.pow(Math.max(0, 1 - dv / 125), 1.7) * 105 * smooth(0, .3, mask);
  h -= smooth(32, 6, dv) * 62;
  h = lerp(h, -3.4, smooth(46, 16, dist2(x, z, ...POI.lake)));
  const flat = (p, R, y) => { h = lerp(h, y, smooth(R, R * .45, dist2(x, z, p[0], p[1]))); };
  if (raw) return h;
  if (!flatY) flatY = { o: Math.max(6, heightGen(POI.outpost[0], POI.outpost[1], true)), r: Math.max(5, heightGen(POI.rex[0], POI.rex[1], true) - 2) };
  flat(POI.spawn, 30, 1.9); flat(POI.outpost, 46, flatY.o); flat(POI.rex, 50, flatY.r);
  return h;
}
function hAt(x, z) {
  const fx = clamp((x + HALF) / CELL, 0, GN - .001), fz = clamp((z + HALF) / CELL, 0, GN - .001), ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * (GN + 1) + ix;
  return lerp(lerp(H[i], H[i + 1], tx), lerp(H[i + GN + 1], H[i + GN + 2], tx), tz);
}
const slopeAt = (x, z) => Math.hypot(hAt(x + 1.5, z) - hAt(x - 1.5, z), hAt(x, z + 1.5) - hAt(x, z - 1.5)) / 3;
function biome(x, z) {
  const h = hAt(x, z); if (h < .3) return 'water'; if (h < 2.6) return 'sand';
  const dv = dist2(x, z, ...POI.volcano); if (dv < 70 || (dv < 125 && h > 34)) return 'volc';
  if (slopeAt(x, z) > .8) return 'rock';
  return fbm(x * .011 + 90, z * .011 + 90, 3) > .5 ? 'jungle' : 'plain';
}

function noiseCanvas(n, lo, hi, scale) {
  const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), im = x.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const px = i % n, py = i / n | 0, v = lo + (hi - lo) * (hash2(px, py) * .5 + vnoise(px / scale, py / scale) * .5); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0); return c;
}

function buildTerrain() {
  for (let iz = 0; iz <= GN; iz++) for (let ix = 0; ix <= GN; ix++) H[iz * (GN + 1) + ix] = heightGen(ix * CELL - HALF, iz * CELL - HALF);
  const g = new THREE.PlaneGeometry(WORLD, WORLD, GN, GN); g.rotateX(-PI / 2);
  const P = g.attributes.position, C = new Float32Array(P.count * 3), ht = new Uint16Array(P.count * 4), hf = THREE.DataUtils.toHalfFloat;
  const cs = n => new THREE.Color(n), sandW = cs(0xa8905e), sand = cs(0xdcc694), deep = cs(0x2a5560), plA = cs(0x6f9440), plB = cs(0x93a84e), juA = cs(0x3c6a2c), juB = cs(0x54813a), rock = cs(0x7b756b), vA = cs(0x4c443f), vB = cs(0x262220), hot = cs(0x8a2a12), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), h = H[i]; P.setY(i, h);
    const s = slopeAt(x, z), b = biome(x, z), n = fbm(x * .05, z * .05, 3); let gm = 0;
    if (b === 'water') c.copy(sandW).lerp(deep, smooth(.3, -5, h));
    else if (b === 'sand') c.copy(sandW).lerp(sand, smooth(.3, 1.6, h));
    else if (b === 'volc') { c.copy(vA).lerp(vB, smooth(30, 85, h) * .8 + n * .2); const dv = dist2(x, z, ...POI.volcano); c.lerp(hot, smooth(30, 8, dv) * .8); }
    else { if (b === 'jungle') c.copy(juA).lerp(juB, n); else c.copy(plA).lerp(plB, n); c.lerp(rock, smooth(.55, .95, s)); if (s < .7) gm = b === 'jungle' ? .75 : 1; }
    if (dist2(x, z, ...POI.outpost) < 19) { gm = 0; c.lerp(sandW, .6); }
    if (dist2(x, z, ...POI.spawn) < 6) gm = 0;
    C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
    ht[i * 4] = hf(h); ht[i * 4 + 1] = hf(gm); ht[i * 4 + 3] = hf(1);
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeVertexNormals();
  const det = new THREE.CanvasTexture(noiseCanvas(256, 175, 255, 9)); det.wrapS = det.wrapT = THREE.RepeatWrapping; det.repeat.set(110, 110); det.colorSpace = THREE.SRGBColorSpace; det.anisotropy = 4;
  terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: det, roughness: .96 })); terrain.receiveShadow = true; scene.add(terrain);
  heightTex = new THREE.DataTexture(ht, GN + 1, GN + 1, THREE.RGBAFormat, THREE.HalfFloatType); heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter; heightTex.needsUpdate = true;
}

function buildWater() {
  // tileable ripple normal map from summed sines
  const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n; const x2 = cv.getContext('2d'), im = x2.createImageData(n, n), W = [[3, 1, 0], [-2, 4, 1.3], [5, -3, 2.1], [1, 7, .7], [-6, -2, 3.3], [8, 5, 1.9]];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let dx = 0, dy = 0; for (const [a, b, p] of W) { const k = Math.cos((a * x + b * y) / n * TAU + p) / Math.hypot(a, b) * 2.2; dx += a * k; dy += b * k; }
    const l = Math.hypot(dx, dy, 3), i = (y * n + x) * 4; im.data[i] = (-dx / l * .5 + .5) * 255; im.data[i + 1] = (-dy / l * .5 + .5) * 255; im.data[i + 2] = (3 / l * .5 + .5) * 255; im.data[i + 3] = 255;
  }
  x2.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(260, 260);
  water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshStandardMaterial({ color: 0x1d6e7c, transparent: true, opacity: .8, roughness: .1, metalness: .25, normalMap: t, normalScale: new THREE.Vector2(.5, .5) }));
  water.rotation.x = -PI / 2; water.receiveShadow = true; scene.add(water);
  lava = new THREE.Mesh(new THREE.CircleGeometry(15, 20), new THREE.MeshBasicMaterial({ color: 0xff5a14 })); lava.rotation.x = -PI / 2;
  lava.position.set(POI.volcano[0], hAt(...POI.volcano) + 2.5, POI.volcano[1]); scene.add(lava);
}

function buildSky() {
  sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 14), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunD: { value: new V3(0, 1, 0) }, sunC: { value: new THREE.Color() }, night: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 top, hor, sunD, sunC; uniform float night; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){ vec3 d = normalize(vD); vec3 c = mix(hor, top, pow(clamp(d.y, 0., 1.), .45)); c = mix(c, hor * .75, smoothstep(0., -.25, d.y));
        float s = max(dot(d, sunD), 0.); c += sunC * (pow(s, 700.) * 5. + pow(s, 14.) * .22);
        float m = max(dot(d, -sunD), 0.); c += vec3(.8, .86, 1.) * pow(m, 1200.) * 3. * night;
        c += step(.9972, h(floor(d * 210.))) * night * smoothstep(0., .25, d.y) * .9;
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a5c44, 1); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2.5); scene.add(sun, sun.target);
  // a few drifting clouds
  const cg = merge([0, 1, 2, 3, 4].map(i => part(G.ico(9 + i % 3 * 3, 1), 0xffffff, [(i - 2) * 11, (i % 2) * 2.5, (i % 3 - 1) * 6], null, [1.5, .5, 1.1], 0xc9d3de)));
  clouds = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: .9 }), 16); clouds.frustumCulled = false;
  const r = rng(77); clouds.userData.p = [];
  for (let i = 0; i < 16; i++) clouds.userData.p.push([(r() - .5) * 1100, 150 + r() * 70, (r() - .5) * 1100, .8 + r() * 1.4]);
  scene.add(clouds);
}
function setShadows() {
  renderer.shadowMap.enabled = !!Q.shadow; sun.castShadow = !!Q.shadow;
  if (Q.shadow) { const s = sun.shadow; s.mapSize.set(Q.shadow, Q.shadow); if (s.map) { s.map.dispose(); s.map = null; } const c = s.camera; c.left = c.bottom = -48; c.right = c.top = 48; c.near = 1; c.far = 260; c.updateProjectionMatrix(); s.bias = -.0006; s.normalBias = .35; }
}
const SKYC = { nT: new THREE.Color(0x04060f), dT: new THREE.Color(0x2c6dc4), nH: new THREE.Color(0x0c1424), dH: new THREE.Color(0xb4d6ea), dusk: new THREE.Color(0xf58f52), sunW: new THREE.Color(0xfff4e0), sunO: new THREE.Color(0xff9a50), moon: new THREE.Color(0x8fb0ff) };
let dayF = 1;
function updateSky(dt, fx, fy, fz) {
  const a = (S.time - .25) * TAU, e = Math.sin(a), u = sky.material.uniforms;
  u.sunD.value.set(Math.cos(a) * .82, e, .42).normalize();
  const d = dayF = smooth(-.12, .22, e), k = smooth(.42, 0, Math.abs(e));
  u.top.value.copy(SKYC.nT).lerp(SKYC.dT, d); u.hor.value.copy(SKYC.nH).lerp(SKYC.dH, d).lerp(SKYC.dusk, k * .65 * smooth(-.3, 0, e));
  u.sunC.value.copy(SKYC.sunW).lerp(SKYC.sunO, k).multiplyScalar(smooth(-.08, .05, e)); u.night.value = 1 - d;
  scene.fog.color.copy(u.hor.value); sky.position.set(fx, 0, fz);
  hemi.intensity = lerp(1.7, 2.5, d); hemi.color.copy(u.top.value).lerp(SKYC.dH, .6);
  const day = e > -.05; sun.color.copy(day ? SKYC.sunW : SKYC.moon); if (day) sun.color.lerp(SKYC.sunO, k);
  sun.intensity = day ? lerp(.2, 3.1, smooth(-.05, .3, e)) : .95;
  const sd = day ? u.sunD.value : _v.copy(u.sunD.value).negate();
  sun.target.position.set(Math.round(fx / 4) * 4, fy, Math.round(fz / 4) * 4); sun.position.copy(sun.target.position).addScaledVector(sd, 120);
  water.material.normalMap.offset.x += dt * .0045; water.material.normalMap.offset.y += dt * .003;
  water.material.color.setHex(0x1d6e7c).multiplyScalar(lerp(.25, 1, d));
  lava.material.color.setHex(0xff5a14).multiplyScalar(.85 + Math.sin(now * 2) * .15);
  const cp = clouds.userData.p; for (let i = 0; i < cp.length; i++) { const p = cp[i]; p[0] += dt * 1.6; if (p[0] > 600) p[0] = -600; _m4.compose(_v.set(p[0], p[1], p[2]), _q.identity(), _s.set(p[3], p[3], p[3])); clouds.setMatrixAt(i, _m4); }
  clouds.instanceMatrix.needsUpdate = true;
}

// ---------- instanced props + interactable nodes in a spatial hash
const nodes = [], ngrid = new Map(), NG = 12, ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const nkey = (x, z) => Math.floor(x / NG) * 4096 + Math.floor(z / NG);
function addNode(n) { nodes.push(n); const k = nkey(n.x, n.z); let a = ngrid.get(k); if (!a) ngrid.set(k, a = []); a.push(n); return n; }
function nearNodes(x, z, r, fn) {
  const a = Math.floor((x - r) / NG), b = Math.floor((x + r) / NG), c = Math.floor((z - r) / NG), d = Math.floor((z + r) / NG);
  for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) { const l = ngrid.get(i * 4096 + j); if (l) for (const n of l) if (n.alive && dist2(x, z, n.x, n.z) < r + n.r) fn(n); }
}
class Inst {
  constructor(geo, mat, max, cast = true) { this.m = new THREE.InstancedMesh(geo, mat, max); this.m.count = 0; this.max = max; this.m.castShadow = cast; this.m.receiveShadow = true; this.m.frustumCulled = false; this.mats = []; scene.add(this.m); }
  add(x, y, z, ry = 0, s = 1, sy = s, rx = 0) { if (this.m.count >= this.max) return -1; const i = this.m.count++, M = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new V3(s, sy, s)); this.mats.push(M); this.m.setMatrixAt(i, M); return i; }
  show(i, on) { this.m.setMatrixAt(i, on ? this.mats[i] : ZERO); this.m.instanceMatrix.needsUpdate = true; }
}
const PMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
const PMAT2 = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide });
const I = {};
function propGeos() {
  const bark = 0x8a6a4a, bark2 = 0x6a5038;
  const conifer = [part(G.cyl(.16, .34, 7, 7), bark, [0, 3.5, 0], null, null, bark2)];
  for (let i = 0; i < 5; i++) conifer.push(part(G.cone(2.5 - i * .42, 2.3, 8), i % 2 ? 0x3a7040 : 0x316338, [0, 3.4 + i * 1.45, 0], [0, i, 0], null, 0x234a2a));
  const jungle = [part(G.cyl(.26, .5, 6.4, 7), 0x94785a, [0, 3.2, 0], null, null, bark2), part(G.cone(.9, 1.2, 6), 0x94785a, [0, .5, 0])];
  [[0, 7.4, 0, 2.9], [1.9, 6.6, .6, 2.1], [-1.7, 6.8, -.9, 2.2], [.3, 6.5, -1.9, 1.9], [-.6, 6.4, 1.8, 2]].forEach(([x, y, z, r], i) => jungle.push(part(G.ico(r, 1), i % 2 ? 0x3f7a35 : 0x4d8c3c, [x, y, z], [i, i * 2, 0], [1, .72, 1], 0x2c5c2c)));
  const palm = []; let px = 0, py = 0;
  for (let i = 0; i < 5; i++) { const t = .08 + i * .07; palm.push(part(G.cyl(.2 - i * .014, .24 - i * .014, 1.75, 7), i % 2 ? 0x8a7350 : 0x7a6444, [px + Math.sin(t) * .85, py + .85, 0], [0, 0, -t])); px += Math.sin(t) * 1.7; py += Math.cos(t) * 1.7; }
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; palm.push(part(G.sph(1, 6, 4), i % 2 ? 0x4c8a3a : 0x5c9a40, [px + Math.sin(a) * 1.35, py - .2, Math.cos(a) * 1.35], [.5, a, 0], [.42, .05, 2.1], 0x2c5a26)); }
  palm.push(part(G.sph(.17, 6, 5), 0x4a3320, [px + .2, py - .2, .1]), part(G.sph(.17, 6, 5), 0x4a3320, [px - .15, py - .25, -.15]));
  const fern = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + (i % 2) * .2; fern.push(part(G.sph(1, 4, 2), i % 2 ? 0x5fa043 : 0x4c8c3a, [Math.sin(a) * .42, .32 + (i % 3) * .06, Math.cos(a) * .42], [-.55, a, 0], [.16, .03, .62], 0x2d5c28)); }
  const bush = [[0, .5, 0, .62], [.45, .4, .2, .48], [-.4, .42, -.25, .5], [.05, .38, -.5, .42]].map(([x, y, z, r], i) => part(G.ico(r, 1), i % 2 ? 0x3c6e30 : 0x47803a, [x, y, z], [i, i, 0], [1, .85, 1], 0x234a22));
  const berries = []; const rb = rng(5); for (let i = 0; i < 12; i++) { const a = rb() * TAU, e = rb() * 1.1; berries.push(part(G.sph(.065, 5, 4), 0xc81e4a, [Math.sin(a) * Math.cos(e) * .68, .5 + Math.sin(e) * .55, Math.cos(a) * Math.cos(e) * .68])); }
  const rk = G.ico(1, 2); { const P = rk.attributes.position; for (let i = 0; i < P.count; i++) { const k = .78 + hash2(P.getX(i) * 50, P.getY(i) * 50 + P.getZ(i) * 90) * .44; P.setXYZ(i, P.getX(i) * k, P.getY(i) * k * .8, P.getZ(i) * k); } rk.computeVertexNormals(); }
  const boulder = [part(rk, 0x6f8052, [0, .45, 0], null, null, 0x77726a)];
  const st = G.ico(.2, 0); const stone = [part(st, 0x8d8a84, [0, .09, 0], null, [1.2, .7, 1], 0x66625c)];
  const stick = [part(G.cyl(.03, .04, .9, 5), 0x7a5a38, [0, .05, 0], [0, 0, PI / 2]), part(G.cyl(.02, .025, .35, 5), 0x7a5a38, [.15, .07, .12], [PI / 2, 0, .5])];
  const reed = []; for (let i = 0; i < 6; i++) reed.push(part(G.cone(.035, 1.1 + (i % 3) * .3, 4), 0x7fae52, [Math.sin(i * 2.1) * .18, .55 + (i % 3) * .15, Math.cos(i * 2.1) * .18], [Math.sin(i) * .12, 0, Math.cos(i) * .12]));
  return { conifer: merge(conifer), jungle: merge(jungle), palm: merge(palm), fern: merge(fern), bush: merge(bush), berries: merge(berries), boulder: merge(boulder), stone: merge(stone), stick: merge(stick), reed: merge(reed) };
}
function clearOf(x, z) { return dist2(x, z, ...POI.spawn) > 11 && dist2(x, z, ...POI.outpost) > 27 && dist2(x, z, ...POI.rex) > 14; }
function buildProps() {
  const g = propGeos(), r = rng(20261);
  I.conifer = new Inst(g.conifer, PMAT, 520); I.jungle = new Inst(g.jungle, PMAT, 720); I.palm = new Inst(g.palm, PMAT2, 300);
  I.fern = new Inst(g.fern, PMAT2, 950, false); I.bush = new Inst(g.bush, PMAT, 240); I.berries = new Inst(g.berries, PMAT, 240, false);
  I.boulder = new Inst(g.boulder, PMAT, 330); I.stone = new Inst(g.stone, PMAT, 380, false); I.stick = new Inst(g.stick, PMAT, 380, false); I.reed = new Inst(g.reed, PMAT, 300, false);
  I.amber = new Inst(new THREE.OctahedronGeometry(.26, 0), new THREE.MeshStandardMaterial({ color: 0xffa51f, emissive: 0xff7a00, emissiveIntensity: 1.3, roughness: .25, transparent: true, opacity: .92 }), 90, false);
  const P = () => [(r() - .5) * 690, (r() - .5) * 690];
  for (let n = 0; n < 9000; n++) {   // trees
    const [x, z] = P(), b = biome(x, z), h = hAt(x, z); if (!clearOf(x, z)) continue;
    let k = null;
    if (b === 'sand' && h > 1.1 && r() < .34) k = 'palm'; else if (b === 'jungle' && r() < .62) k = h > 26 || r() < .15 ? 'conifer' : 'jungle'; else if (b === 'plain' && r() < .05) k = r() < .5 ? 'conifer' : 'jungle';
    if (!k) continue; const s = .8 + r() * .6, i = I[k].add(x, h - .15, z, r() * TAU, s, s * (.9 + r() * .3)); if (i < 0) continue;
    addNode({ t: 'tree', k, x, z, y: h, r: k === 'palm' ? .22 : .4 * s, i, alive: true, hp: 5, solid: true });
  }
  for (let n = 0; n < 5200; n++) {   // undergrowth, rocks and things to pick up
    const [x, z] = P(), b = biome(x, z), h = hAt(x, z), q = r(); if (b === 'water' || !clearOf(x, z)) { if (b === 'water' && h > -.7 && q < .25) I.reed.add(x, h - .05, z, r() * TAU, .8 + r() * .7); continue; }
    if (b === 'jungle' || (b === 'plain' && q < .35)) { if (q < .2) { const i = I.fern.add(x, h, z, r() * TAU, .9 + r() * .8); if (i >= 0) addNode({ t: 'fern', x, z, y: h, r: 0, i, alive: true }); continue; } }
    if ((b === 'plain' || b === 'jungle') && q > .93) { const ry = r() * TAU, s = .9 + r() * .4, i = I.bush.add(x, h - .05, z, ry, s); if (i >= 0) { I.berries.add(x, h - .05, z, ry, s); addNode({ t: 'bush', x, z, y: h, r: .5, i, alive: true, ripe: true, solid: true }); } continue; }
    if (q > .86 && q <= .93 || (b === 'rock' || b === 'volc') && q < .12) { const s = .7 + r() * 1.6, i = I.boulder.add(x, h - .2, z, r() * TAU, s, s * (.7 + r() * .5)); if (i >= 0) addNode({ t: 'rock', x, z, y: h, r: s * .85, i, alive: true, hp: 6, solid: true }); continue; }
    if (q > .78 && q <= .82) { const i = I.stone.add(x, h, z, r() * TAU, .8 + r() * .8); if (i >= 0) addNode({ t: 'stone', x, z, y: h, r: 0, i, alive: true }); continue; }
    if (q > .82 && q <= .86 && b !== 'volc') { const i = I.stick.add(x, h, z, r() * TAU, .8 + r() * .5); if (i >= 0) addNode({ t: 'stick', x, z, y: h, r: 0, i, alive: true }); continue; }
    if (q > .2 && q < .212 || (b === 'volc' && q > .3 && q < .33)) { const i = I.amber.add(x, h + .45, z, r() * TAU, .8 + r() * .5, 1.5); if (i >= 0) addNode({ t: 'amber', x, z, y: h, r: 0, i, alive: true }); }
  }
  // starter supplies around the camp so the first minutes are easy
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, d = 5 + (i % 4) * 2.5, x = POI.spawn[0] + Math.sin(a) * d, z = POI.spawn[1] - 6 + Math.cos(a) * d * .7, h = hAt(x, z), k = ['stone', 'stick', 'fern', 'stick'][i % 4]; if (h < .4) continue; const j = I[k].add(x, h, z, a, 1); if (j >= 0) addNode({ t: k, x, z, y: h, r: 0, i: j, alive: true }); }
  for (const k in I) I[k].m.instanceMatrix.needsUpdate = true;
  // giant bones
  const bone = []; for (let i = 0; i < 8; i++) { const s = 1 - Math.abs(i - 3.5) * .09; bone.push(part(G.tor(2.6 * s, .16, PI), 0xe9e2d0, [0, 0, i * 1.3 - 4.5], [0, 0, 0], null, 0xb8ae96)); }
  bone.push(part(G.cyl(.24, .2, 11, 6), 0xe9e2d0, [0, 2.5, 0], [PI / 2, 0, 0]), part(G.sph(1.2, 8, 6), 0xe9e2d0, [0, 1, 7.2], null, [.8, .8, 1.5], 0xb8ae96));
  const bg = merge(bone);
  [[POI.rex[0] + 16, POI.rex[1] + 9, 1], [POI.rex[0] - 20, POI.rex[1] - 12, 2.6], [-40, 232, .5], [120, 120, 4]].forEach(([x, z, ry]) => { const m = new THREE.Mesh(bg, PMAT); m.position.set(x, hAt(x, z) - .5, z); m.rotation.set(.08, ry, .12); m.castShadow = m.receiveShadow = true; scene.add(m); });
}
const NODE_INST = { tree: n => [I[n.k]], rock: () => [I.boulder], fern: () => [I.fern], bush: () => [I.berries], stone: () => [I.stone], stick: () => [I.stick], amber: () => [I.amber] };
const respawns = [];
function takeNode(n, secs) { for (const m of NODE_INST[n.t](n)) m.show(n.i, false); if (n.t === 'bush') n.ripe = false; else n.alive = false; respawns.push([now + secs, n]); }
function updateNodes() {
  for (let i = respawns.length - 1; i >= 0; i--) if (respawns[i][0] < now) { const n = respawns[i][1]; if (dist2(n.x, n.z, player.x, player.z) < 30) { respawns[i][0] = now + 30; continue; } n.alive = true; n.ripe = true; n.hp = n.t === 'rock' ? 6 : 5; for (const m of NODE_INST[n.t](n)) m.show(n.i, true); respawns.splice(i, 1); }
  for (const k in I) if (k === 'amber') I.amber.m.material.emissiveIntensity = 1.1 + Math.sin(now * 3) * .5;
}

// ---------- grass: blades wrap around the camera and read the height texture
function buildGrass() {
  if (grass) { scene.remove(grass); grass.geometry.dispose(); }
  const n = Q.grass, base = [], idx = [], r = rng(9);
  for (let b = 0; b < 3; b++) { const a = b * 2.1 + .3, ox = Math.sin(a) * .09, oz = Math.cos(a) * .09, w = .02, cx = Math.cos(a) * w, cz = -Math.sin(a) * w, lean = .1, o = b * 5;
    base.push(ox - cx, 0, oz - cz, ox + cx, 0, oz + cz, ox - cx * .6 + ox * lean, .5, oz - cz * .6 + oz * lean, ox + cx * .6 + ox * lean, .5, oz + cz * .6 + oz * lean, ox * 3.2, 1, oz * 3.2);
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2, o + 2, o + 3, o + 4); }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(base, 3)); g.setIndex(idx);
  const off = new Float32Array(n * 3), SZ = 76; for (let i = 0; i < n; i++) { off[i * 3] = r() * SZ; off[i * 3 + 1] = r(); off[i * 3 + 2] = r() * SZ; }
  g.setAttribute('off', new THREE.InstancedBufferAttribute(off, 3)); g.instanceCount = n;
  grass = new THREE.Mesh(g, new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uCam: { value: new V3() }, uT: { value: 0 }, uH: { value: heightTex }, uS: { value: SZ }, uLight: { value: new THREE.Color(1, 1, 1) }, uFog: { value: new THREE.Color() }, uFar: { value: 600 } },
    vertexShader: `uniform vec3 uCam; uniform float uT, uS; uniform sampler2D uH; attribute vec3 off; varying float vY, vF, vR;
      void main(){ vec2 w = mod(off.xz - uCam.xz + uS * .5, uS) - uS * .5 + uCam.xz;
        vec2 uv = (w / ${WORLD}. + .5) * (${GN}. / ${GN + 1}.) + .5 / ${GN + 1}.; vec4 t = texture2D(uH, uv);
        float d = length(w - uCam.xz), sc = t.g * smoothstep(uS * .5, uS * .3, d) * (.55 + off.y * .8);
        float a = off.y * 6.283, c = cos(a), s = sin(a); vec3 p = position; p.xz = mat2(c, -s, s, c) * p.xz; sc *= smoothstep(.5, 2.2, d); p.xz *= sc * 1.25; p.y *= sc * .46;
        float wind = sin(uT * 1.7 + w.x * .33 + w.y * .27) * .16 + sin(uT * 3.3 + w.x * 1.1) * .05; p.xz += wind * position.y * position.y * sc * vec2(1., .6);
        vec4 mv = modelViewMatrix * vec4(w.x + p.x, t.r + p.y, w.y + p.z, 1.); vY = position.y; vR = off.y; vF = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uLight, uFog; uniform float uFar; varying float vY, vF, vR;
      void main(){ vec3 c = mix(vec3(.10, .21, .05), mix(vec3(.27, .43, .11), vec3(.38, .46, .14), vR), vY * vY) * uLight; c = mix(c, uFog, smoothstep(50., uFar, vF));
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  grass.frustumCulled = false; scene.add(grass);
}
function updateGrass() {
  const u = grass.material.uniforms; u.uCam.value.copy(camera.position); u.uT.value = now; u.uFog.value.copy(scene.fog.color); u.uFar.value = scene.fog.far;
  const l = lerp(.3, 1.05, dayF); u.uLight.value.setRGB(l, l, lerp(l * 1.25, l, dayF));
}

// ---------- minimap picture
let mapCanvas;
function buildMap() {
  const n = 384; mapCanvas = document.createElement('canvas'); mapCanvas.width = mapCanvas.height = n; const x2 = mapCanvas.getContext('2d'), im = x2.createImageData(n, n);
  const C = { water: [38, 92, 104], sand: [214, 196, 146], volc: [70, 62, 58], rock: [120, 114, 104], jungle: [62, 104, 48], plain: [118, 150, 70] };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const wx = (x + .5) / n * WORLD - HALF, wz = (y + .5) / n * WORLD - HALF, c = C[biome(wx, wz)], h = hAt(wx, wz), sh = clamp(1 + (hAt(wx - 3, wz - 3) - h) * .06, .7, 1.3), i = (y * n + x) * 4; im.data[i] = c[0] * sh; im.data[i + 1] = c[1] * sh; im.data[i + 2] = c[2] * sh; im.data[i + 3] = 255; }
  x2.putImageData(im, 0, 0);
}
