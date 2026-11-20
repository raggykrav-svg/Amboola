// Visual effects: rain, plasma bolts, sparks, flashes, explosions.
import * as THREE from 'three';

export class Rain {
  constructor(scene) {
    this.scene = scene; this.mesh = null; this.level = -1;
    this.uniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(70, 45, 70) } };
  }
  setLevel(level) {
    if (level === this.level) return;
    this.level = level;
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    if (!level) return;
    const n = [0, 1200, 2600, 4800][level];
    const pos = new Float32Array(n * 6), seed = new Float32Array(n * 2);
    const S = this.uniforms.uSize.value;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * S.x, y = Math.random() * S.y, z = Math.random() * S.z, sp = 0.8 + Math.random() * 0.4;
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0; seed[i * 2 + 1] = 1; // 0 = top vertex, 1 = bottom
      seed.set([0, 1], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const end = new Float32Array(n * 2); for (let i = 0; i < n; i++) { end[i * 2] = 0; end[i * 2 + 1] = 1; }
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime; uniform vec3 uCam; uniform vec3 uSize; attribute float aEnd; varying float vA;
        void main() {
          vec3 p = position;
          float sp = 28.0 + fract(position.x * 13.37) * 10.0;
          p.y -= uTime * sp;
          p.x -= uTime * 3.0;
          vec3 wp = uCam + mod(p - uCam, uSize) - uSize * 0.5;
          wp.y += uSize.y * 0.15;
          wp.y -= aEnd * 0.9; wp.x -= aEnd * 0.1;
          vA = 1.0 - aEnd * 0.8;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.5, 0.65, 1.0, 0.22 * vA); }`,
    });
    this.mesh = new THREE.LineSegments(g, m);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  update(dt, cam) { this.uniforms.uTime.value += dt; this.uniforms.uCam.value.copy(cam); }
}

const boltGeo = new THREE.BoxGeometry(0.18, 0.18, 4.2);
const boltMats = {};
function boltMat(c) {
  if (!boltMats[c]) boltMats[c] = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  return boltMats[c];
}

export class Effects {
  constructor(scene, glowTex) {
    this.scene = scene; this.glowTex = glowTex;
    this.bolts = [];
    this.flashes = [];
    // sparks
    this.maxSparks = 600;
    this.sp = []; this.spPos = new Float32Array(this.maxSparks * 3); this.spCol = new Float32Array(this.maxSparks * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.spPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.spCol, 3));
    this.sparkPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.sparkPts.frustumCulled = false;
    scene.add(this.sparkPts);
    this.light = new THREE.PointLight(0x29f3ff, 0, 14, 2);
    scene.add(this.light);
    this.lightT = 0;
  }
  bolt(from, dir, speed, color, owner, dmg, range = 220) {
    const m = new THREE.Mesh(boltGeo, boltMat(color));
    if (!this.boltSpr) this.boltSpr = {};
    if (!this.boltSpr[color]) this.boltSpr[color] = new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const sp = new THREE.Sprite(this.boltSpr[color]); sp.scale.setScalar(1.1); sp.position.z = 1.6; m.add(sp);
    m.position.copy(from);
    m.lookAt(from.x + dir.x, from.y + dir.y, from.z + dir.z);
    this.scene.add(m);
    const b = { m, pos: from.clone(), vel: dir.clone().multiplyScalar(speed), owner, dmg, life: range / speed, color };
    this.bolts.push(b);
    return b;
  }
  flash(pos, color, size = 1.2, life = 0.06) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    s.position.copy(pos); s.scale.setScalar(size);
    this.scene.add(s);
    this.flashes.push({ s, life, max: life, size });
  }
  muzzle(pos, color, lights) {
    this.flash(pos, color, 0.55, 0.05);
    if (lights) { this.light.position.copy(pos); this.light.color.set(color); this.light.intensity = 12; this.lightT = 0.05; }
  }
  sparks(pos, color, n = 12, speed = 6) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (this.sp.length >= this.maxSparks) this.sp.shift();
      this.sp.push({ p: pos.clone(), v: new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.1, (Math.random() - 0.5)).normalize().multiplyScalar(speed * (0.4 + Math.random())), life: 0.3 + Math.random() * 0.4, c });
    }
  }
  explosion(pos) {
    this.flash(pos, 0xff7a2a, 9, 0.5);
    this.flash(pos, 0xffffff, 5, 0.18);
    this.sparks(pos, 0xffa43a, 60, 16);
    this.sparks(pos, 0xff2bd6, 30, 10);
    this.light.position.copy(pos); this.light.color.set(0xff7a2a); this.light.intensity = 200; this.light.distance = 40; this.lightT = 0.3;
  }
  update(dt) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]; f.life -= dt;
      if (f.life <= 0) { this.scene.remove(f.s); f.s.material.dispose(); this.flashes.splice(i, 1); continue; }
      const k = f.life / f.max; f.s.material.opacity = k; f.s.scale.setScalar(f.size * (1.4 - k * 0.4));
    }
    let n = 0;
    for (let i = this.sp.length - 1; i >= 0; i--) {
      const s = this.sp[i]; s.life -= dt;
      if (s.life <= 0) { this.sp.splice(i, 1); continue; }
      s.v.y -= 14 * dt; s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.3; s.v.x *= 0.6; s.v.z *= 0.6; }
    }
    for (const s of this.sp) {
      this.spPos[n * 3] = s.p.x; this.spPos[n * 3 + 1] = s.p.y; this.spPos[n * 3 + 2] = s.p.z;
      const k = Math.min(1, s.life * 3);
      this.spCol[n * 3] = s.c.r * k; this.spCol[n * 3 + 1] = s.c.g * k; this.spCol[n * 3 + 2] = s.c.b * k;
      n++;
    }
    this.sparkPts.geometry.setDrawRange(0, n);
    this.sparkPts.geometry.attributes.position.needsUpdate = true;
    this.sparkPts.geometry.attributes.color.needsUpdate = true;
    if (this.lightT > 0) { this.lightT -= dt; if (this.lightT <= 0) { this.light.intensity = 0; this.light.distance = 14; } }
  }
  removeBolt(i) { const b = this.bolts[i]; this.scene.remove(b.m); this.bolts.splice(i, 1); }
  clear() {
    while (this.bolts.length) this.removeBolt(0);
    for (const f of this.flashes) this.scene.remove(f.s);
    this.flashes.length = 0; this.sp.length = 0;
  }
}
