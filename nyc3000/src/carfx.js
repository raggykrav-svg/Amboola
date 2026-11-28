// Better-looking cars:
//  - a city reflection world (glowing windows, neon signs, street lamps; a blue sky in the day)
//    that shiny car paint, glass and chrome mirror
//  - headlights: soft light beams and a pool of light on the road in front (at night)
//  - tail lights that glow red and get brighter when a car brakes
//  - neon underglow on some of the city's cars at night
// The beams, pools and tail lights are three instanced meshes for all cars together (3 draw calls).
import * as THREE from 'three';

const V3 = THREE.Vector3;

// ---------- the reflection world ----------
export function makeCityEnvironment(renderer, day) {
  const env = new THREE.Scene();
  const top = day ? [0.25, 0.48, 0.9] : [0.02, 0.02, 0.06], hor = day ? [0.78, 0.86, 0.95] : [0.2, 0.08, 0.32], gnd = day ? [0.18, 0.18, 0.22] : [0.04, 0.03, 0.07];
  const v3 = a => `vec3(${a.map(x => x.toFixed(3)).join(',')})`;
  env.add(new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y;
      vec3 c = mix(${v3(hor)}, ${v3(top)}, smoothstep(0.0, 0.7, h));
      c = mix(c, ${v3(gnd)}, smoothstep(0.0, -0.15, h));
      gl_FragColor = vec4(c, 1.0); }`,
  })));
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const box = new THREE.BoxGeometry(1, 1, 1), plane = new THREE.PlaneGeometry(1, 1);
  const bodyMat = new THREE.MeshBasicMaterial({ color: day ? 0x8a93a8 : 0x0a0a14 });
  const neon = [0x29f3ff, 0xff2bd6, 0xffa43a, 0x8a4dff, 0x3aff9a, 0xff1e3c, 0xffd23a];
  // a ring of towers around the car
  for (let k = 0; k < 26; k++) {
    const a = k / 26 * Math.PI * 2 + rnd() * 0.1, r = 26 + rnd() * 10, w = 5 + rnd() * 6, h = 14 + rnd() * 34;
    const b = new THREE.Mesh(box, bodyMat); b.scale.set(w, h, w); b.position.set(Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r); b.lookAt(0, h / 2 - 3, 0); env.add(b);
    // rows of lit windows facing the car
    const rows = Math.floor(h / 2.2);
    for (let q = 0; q < rows; q++) {
      if (rnd() < (day ? 0.5 : 0.35)) continue;
      const win = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: day ? new THREE.Color(0.55, 0.7, 0.9) : new THREE.Color(rnd() < 0.7 ? 0xffd9a0 : 0x9fe9ff).multiplyScalar(1.4 + rnd()), side: THREE.DoubleSide }));
      win.scale.set(w * (0.5 + rnd() * 0.4), 0.7, 1);
      win.position.set(Math.cos(a) * (r - w / 2 - 0.05), q * 2.2 - 1.5, Math.sin(a) * (r - w / 2 - 0.05)); win.lookAt(0, q * 2.2 - 1.5, 0); env.add(win);
    }
    // a neon sign on some of them
    if (rnd() < 0.6) {
      const s = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: new THREE.Color(neon[k % neon.length]).multiplyScalar(day ? 1.2 : 3), side: THREE.DoubleSide }));
      const sh = 1 + rnd() * 4; s.scale.set(1.2 + rnd() * 3, sh, 1);
      s.position.set(Math.cos(a) * (r - w / 2 - 0.3), 2 + rnd() * 12, Math.sin(a) * (r - w / 2 - 0.3)); s.lookAt(0, s.position.y, 0); env.add(s);
    }
  }
  // street lamps all around at head height, and the sun in the day
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, l = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: new THREE.Color(k % 2 ? 0x9fe9ff : 0xff9ae6).multiplyScalar(day ? 0.6 : 2.5), side: THREE.DoubleSide }));
    l.scale.set(1.2, 0.4, 1); l.position.set(Math.cos(a) * 14, 5, Math.sin(a) * 14); l.lookAt(0, 5, 0); env.add(l);
  }
  if (day) { const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(6) })); sun.position.set(30, 40, 20); env.add(sun); }
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
}

// ---------- lights on the cars ----------
function radial(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const beamMat = () => new THREE.ShaderMaterial({
  uniforms: { uAmount: { value: 1 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  vertexShader: /* glsl */`
    varying float vT; varying vec3 vCol; varying float vRim;
    void main() {
      vT = clamp(-position.z / 13.0, 0.0, 1.0);
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      vRim = abs(dot(n, normalize(cameraPosition - wp.xyz)));
      vCol = instanceColor;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform float uAmount; varying float vT; varying vec3 vCol; varying float vRim;
    void main() { gl_FragColor = vec4(vCol * pow(1.0 - vT, 1.8) * smoothstep(0.0, 0.18, vT) * vRim * uAmount, 1.0); }`,
});

const MAX = 90;
export class CarFX {
  constructor(scene) {
    this.scene = scene; this.boxes = new Map();
    // headlight beams: a cone from the lamp, pointing forward and a little down
    const cone = new THREE.ConeGeometry(1.5, 13, 14, 1, true); cone.translate(0, -6.5, 0); cone.rotateX(Math.PI / 2 - 0.05);
    this.beams = new THREE.InstancedMesh(cone, beamMat(), MAX * 2);
    // light on the road in front
    const pool = new THREE.PlaneGeometry(1, 1); pool.rotateX(-Math.PI / 2);
    this.pools = new THREE.InstancedMesh(pool, new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }), MAX);
    // tail light glows
    this.tails = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), MAX * 2);
    for (const m of [this.beams, this.pools, this.tails]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 3; scene.add(m); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    this.beams.setColorAt(0, new THREE.Color()); this.pools.setColorAt(0, new THREE.Color()); this.tails.setColorAt(0, new THREE.Color());
    this._m = new THREE.Matrix4(); this._l = new THREE.Matrix4(); this._c = new THREE.Color(); this._q = new THREE.Quaternion(); this._s = new V3(); this._p = new V3(); this._y = new V3(0, 1, 0);
  }
  // where the lamps are on this kind of car (from its size)
  _box(v) {
    let b = this.boxes.get(v.type);
    if (!b) {
      const m = v.mesh, pos = m.position.clone(), rot = m.rotation.clone();
      m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.updateMatrixWorld(true);
      const bx = new THREE.Box3();
      v.body.traverse(o => { if (o.isMesh && o.visible && o.geometry) { o.geometry.computeBoundingBox(); bx.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
      m.position.copy(pos); m.rotation.copy(rot); m.updateMatrixWorld(true);
      b = { front: bx.min.z + 0.05, rear: bx.max.z - 0.05, half: Math.max(0.2, bx.max.x * 0.7), y: bx.min.y + (bx.max.y - bx.min.y) * 0.36, bike: !!v.def.bike };
      if (b.bike) { b.half = 0; b.y = bx.min.y + (bx.max.y - bx.min.y) * 0.55; }
      this.boxes.set(v.type, b);
    }
    return b;
  }
  update(dt, g, camera, night, on, glowOn) {
    const show = on && night > 0.12;
    let nb = 0, np = 0, nt = 0;
    if (g && g.active) {
      const cam = camera.position, list = g.vehicles.slice().filter(v => !v.flying && v.mode !== 'wreck' && v.mesh.visible && v.hasDriver !== false || v === g.player.vehicle);
      list.sort((a, b) => a.pos.distanceToSquared(cam) - b.pos.distanceToSquared(cam));
      for (const v of list) {
        if (nt >= MAX * 2 - 2 || v.pos.distanceTo(cam) > 170) break;
        const B = this._box(v), c = Math.cos(v.yaw), s = Math.sin(v.yaw);
        const at = (lx, ly, lz, out) => out.set(v.pos.x + lx * c + lz * s, v.pos.y + ly, v.pos.z - lx * s + lz * c);
        // brake lights: the car is slowing down (or you're holding S)
        const dv = ((v._lastSp ?? v.speed) - v.speed) / Math.max(dt, 1e-3); v._lastSp = v.speed;
        v._brake = Math.max(0, (v._brake || 0) - dt * 3); if (dv > 6 || (v === g.player.vehicle && g.input.down('KeyS') && v.speed > 1)) v._brake = 1;
        const tb = (show ? 0.45 : 0.18) + v._brake * 0.9;
        for (const sx of B.bike ? [0] : [-1, 1]) {
          at(sx * B.half, B.y, B.rear + 0.02, this._p);
          this._q.setFromAxisAngle(this._y, v.yaw);
          this._m.compose(this._p, this._q, this._s.set(B.bike ? 0.45 : 0.75, 0.42, 1));
          this.tails.setMatrixAt(nt, this._m); this.tails.setColorAt(nt, this._c.setRGB(1, 0.08, 0.12).multiplyScalar(tb)); nt++;
        }
        if (!show) continue;
        const head = v.def.police ? this._c.setRGB(0.75, 0.85, 1) : this._c.setRGB(1, 0.95, 0.85);
        for (const sx of B.bike ? [0] : [-1, 1]) {
          at(sx * B.half, B.y, B.front, this._p);
          this._q.setFromAxisAngle(this._y, v.yaw);
          this._m.compose(this._p, this._q, this._s.set(1, 1, 1));
          this.beams.setMatrixAt(nb, this._m); this.beams.setColorAt(nb, this._c.copy(head).multiplyScalar((v === g.player.vehicle ? 0.06 : 0.11) * night)); nb++;
        }
        at(0, 0.04, B.front - 6.5, this._p);
        this._q.setFromAxisAngle(this._y, v.yaw);
        this._m.compose(this._p, this._q, this._s.set(B.bike ? 3.2 : 5.5, 1, 10));
        this.pools.setMatrixAt(np, this._m); this.pools.setColorAt(np, this._c.copy(head).multiplyScalar(0.3 * night)); np++;
        // some city cars have neon underglow at night
        if (glowOn && !v.glowChecked) { v.glowChecked = true; if (!v.glow && v.mode === 'traffic' && Math.random() < 0.35) this._underglow(v); }
      }
      // underglow only shows at night (your own one always)
      for (const v of g.vehicles) if (v.cityGlow) v.glow.visible = night > 0.2;
    }
    this.beams.count = nb; this.pools.count = np; this.tails.count = nt;
    for (const m of [this.beams, this.pools, this.tails]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  _underglow(v) {
    const cols = ['#29f3ff', '#ff2bd6', '#3aff9a', '#b98cff', '#ffd23a'];
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.pools.material.map, color: new THREE.Color(cols[Math.floor(Math.random() * cols.length)]).multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; glow.scale.set(v.def.bike ? 1.6 : 3.6, v.def.bike ? 3.2 : 6.4, 1);
    v.mesh.add(glow); v.glow = glow; v.cityGlow = true;
  }
}
