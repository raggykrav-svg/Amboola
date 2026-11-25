// Sky, sun, sea, the hills behind the city, the far coast and the time of day.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import earcut from 'earcut';

export const TIMES = {
  morning: { label: 'Morning', el: 15, az: 100, turb: 3.5, ray: 1.4, mie: 0.004, mieG: 0.8, sun: 0xffe2b8, sunI: 2.6, sky: 0xbfd6ee, gnd: 0x8f8069, hemiI: 1.15, fog: 0xc8d6e3, fogD: 0.00016, exp: 0.62, night: 0 },
  day: { label: 'Midday', el: 63, az: 195, turb: 2.6, ray: 1.0, mie: 0.003, mieG: 0.75, sun: 0xfff5e6, sunI: 3.1, sky: 0xc7dcf2, gnd: 0x9a8b74, hemiI: 1.2, fog: 0xc8d8e6, fogD: 0.00014, exp: 0.55, night: 0 },
  sunset: { label: 'Sunset', el: 5.5, az: 252, turb: 6, ray: 2.4, mie: 0.006, mieG: 0.86, sun: 0xffa868, sunI: 3.2, sky: 0xd7b7b0, gnd: 0x8a7060, hemiI: 1.7, fog: 0xd8ab92, fogD: 0.00017, exp: 0.78, night: 0.35 },
  night: { label: 'Night', el: -12, az: 285, moon: [38, 150], turb: 2, ray: 0.4, mie: 0.002, mieG: 0.8, sun: 0xa9bfff, sunI: 0.9, sky: 0x5d6f99, gnd: 0x2a2b33, hemiI: 1.6, fog: 0x1b2433, fogD: 0.00018, exp: 1.25, night: 1 },
};
export const TIME_ORDER = ['morning', 'day', 'sunset', 'night'];

export function dirFrom(elDeg, azDeg) {
  const el = THREE.MathUtils.degToRad(elDeg), az = THREE.MathUtils.degToRad(azDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

// three's Sky is a big box around the camera. Its faces cross behind the camera, and some GPUs (and the
// software renderer used for tests) then give one flat colour per face. Here the sky is a full-screen quad
// instead, and each pixel's view direction comes from the camera, so nothing is ever clipped.
function screenSpaceSky(sky, camera) {
  const m = sky.material;
  sky.geometry.dispose();
  sky.geometry = new THREE.PlaneGeometry(2, 2);
  m.uniforms.uInvProj = { value: camera.projectionMatrixInverse };
  m.uniforms.uCamWorld = { value: camera.matrixWorld };
  m.vertexShader = m.vertexShader
    .replace('void main() {', 'uniform mat4 uInvProj; uniform mat4 uCamWorld;\nvoid main() {')
    .replace(/vec4 worldPosition = modelMatrix \* vec4\( position, 1\.0 \);\s*vWorldPosition = worldPosition\.xyz;/,
      'vec4 vp = uInvProj * vec4(position.xy, 1.0, 1.0); vp /= vp.w; vWorldPosition = cameraPosition + (uCamWorld * vec4(vp.xyz, 0.0)).xyz * 1000.0;')
    .replace(/gl_Position = projectionMatrix \* modelViewMatrix \* vec4\( position, 1\.0 \);\s*gl_Position\.z = gl_Position\.w;[^\n]*/,
      'gl_Position = vec4(position.xy, 0.9999, 1.0);');
  m.side = THREE.FrontSide; // the box was seen from inside (BackSide); the quad faces the camera
  m.depthTest = false; m.depthWrite = false;
  m.needsUpdate = true;
}

export class Environment {
  constructor(renderer, scene, city, quality) {
    this.renderer = renderer; this.scene = scene; this.city = city;
    this.sky = new Sky(); this.sky.frustumCulled = false;
    screenSpaceSky(this.sky, scene.userData.camera);
    this.sky.renderOrder = -100; // drawn first: the flat ground does not write depth (painter's order)
    scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality.shadows > 0;
    this.sun.shadow.mapSize.set(quality.shadows || 1024, quality.shadows || 1024);
    const sc = this.sun.shadow.camera; const S = quality.shadowSize || 90;
    sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.near = 1; sc.far = 900;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.6;
    this.shadowSize = S;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xc7dcf2, 0x9a8b74, 1.2);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xc8d8e6, 0.00014);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.night = 0;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.makeSea();
    this.makeFarLand();
    this.makeHills();
    this.makeStars();
    this.time = 0;
  }

  setTime(key) {
    const T = TIMES[key]; this.key = key; this.T = T;
    const u = this.sky.material.uniforms;
    u.turbidity.value = T.turb; u.rayleigh.value = T.ray; u.mieCoefficient.value = T.mie; u.mieDirectionalG.value = T.mieG;
    this.sunDir.copy(dirFrom(T.el, T.az));
    u.sunPosition.value.copy(this.sunDir);
    const L = T.moon ? dirFrom(T.moon[0], T.moon[1]) : this.sunDir;
    this.lightDir = L.clone();
    this.sun.color.set(T.sun); this.sun.intensity = T.sunI;
    this.hemi.color.set(T.sky); this.hemi.groundColor.set(T.gnd); this.hemi.intensity = T.hemiI;
    this.scene.fog.color.set(T.fog); this.scene.fog.density = T.fogD * (this.fogScale || 1);
    this.renderer.toneMappingExposure = T.exp;
    this.night = T.night;
    // environment map from the sky (reflections in glass and water)
    const envScene = new THREE.Scene();
    const sky2 = new Sky(); sky2.scale.setScalar(1000);
    for (const k in u) if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = u[k].value;
    envScene.add(sky2);
    if (T.night >= 1) { envScene.background = new THREE.Color(0x0b1220); sky2.visible = false; }
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0, 0.1, 2000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = T.night >= 1 ? 0.25 : 0.85;
    sky2.material.dispose(); sky2.geometry.dispose();
    // sea + hills colours
    const su = this.sea.material.uniforms;
    su.uSunDir.value.copy(this.sunDir.y > -0.05 ? this.sunDir : L);
    su.uSunCol.value.set(T.sun).multiplyScalar(T.night >= 1 ? 0.25 : 1.0);
    su.uFog.value.set(T.fog);
    su.uNight.value = T.night;
    const sk = new THREE.Color(T.night >= 1 ? 0x0e1626 : key === 'sunset' ? 0x8f8aa8 : 0x5b95c9);
    su.uSky.value.copy(sk);
    su.uHorizon.value.set(T.fog);
    this.hillMat.uniforms.uFog.value.set(T.fog);
    this.hillMat.uniforms.uSunDir.value.copy(L);
    this.hillMat.uniforms.uLight.value.set(T.sun).multiplyScalar(T.night >= 1 ? 0.25 : 1);
    this.hillMat.uniforms.uAmb.value.set(T.sky).multiplyScalar(T.night >= 1 ? 0.3 : 0.55);
    this.stars.visible = T.night >= 1;
    this.sky.visible = T.night < 1;
    this.scene.background = T.night >= 1 ? new THREE.Color(0x0a1424) : null;
  }

  // keep the shadow camera and sky following the player
  update(dt, cam, focus) {
    this.time += dt;
    this.sea.material.uniforms.uTime.value = this.time;
    this.sea.material.uniforms.uFogD.value = this.scene.fog.density;
    this.hillMat.uniforms.uFogD.value = this.scene.fog.density;
    const S = this.shadowSize;
    // snap the shadow camera to texels to avoid shimmering
    const texel = (2 * S) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + this.lightDir.x * 400, Math.max(30, this.lightDir.y * 400), fz + this.lightDir.z * 400);
    this.sun.target.updateMatrixWorld();
    this.stars.position.copy(cam.position);
    this.sea.position.set(cam.position.x, -0.32, cam.position.z);
  }

  makeSea() {
    const city = this.city, sh = city.header.shore;
    const tex = new THREE.DataTexture(city.shore.slice(), sh.w, sh.h, THREE.RGFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    // polar grid centred on the camera: small triangles near you, big ones far away (keeps precision)
    const SEG = 72, radii = [0];
    for (let r = 1.5; r < 90000; r *= 1.32) radii.push(r);
    radii.push(120000);
    const pos = [], idx = [];
    for (let k = 0; k < radii.length; k++) for (let i = 0; i < SEG; i++) {
      const a = (i + (k % 2) * 0.5) / SEG * Math.PI * 2;
      pos.push(Math.cos(a) * radii[k], 0, Math.sin(a) * radii[k]);
    }
    for (let k = 0; k + 1 < radii.length; k++) for (let i = 0; i < SEG; i++) {
      const a = k * SEG + i, b = k * SEG + (i + 1) % SEG, c = (k + 1) * SEG + i, d = (k + 1) * SEG + (i + 1) % SEG;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uShore: { value: tex }, uShoreXf: { value: new THREE.Vector4(sh.x0, sh.z0, 1 / (sh.w * sh.res), 1 / (sh.h * sh.res)) },
        uDeep: { value: new THREE.Color(0x0d4a78) }, uMid: { value: new THREE.Color(0x137a99) }, uShallow: { value: new THREE.Color(0x35b8bd) },
        uSky: { value: new THREE.Color(0xc7dcf2) }, uHorizon: { value: new THREE.Color(0xc8d8e6) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color(0xffffff) }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.00014 }, uNight: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vW;
        #include <common>
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime, uFogD, uNight; uniform sampler2D uShore; uniform vec4 uShoreXf;
        uniform vec3 uDeep, uMid, uShallow, uSky, uHorizon, uSunDir, uSunCol, uFog;
        varying vec3 vW;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
        float waves(vec2 p, float t){
          float s = 0.0;
          s += sin(dot(p, vec2(0.28, 0.96))*0.55 + t*0.9)*0.55;
          s += sin(dot(p, vec2(-0.62, 0.78))*1.1 + t*1.35)*0.3;
          s += sin(dot(p, vec2(0.93, -0.36))*2.3 + t*2.1)*0.14;
          s += (noise(p*0.6 + vec2(t*0.35, t*0.2)) - 0.5) * 0.5;
          s += (noise(p*1.7 - vec2(t*0.5, -t*0.3)) - 0.5) * 0.22;
          return s;
        }
        void main(){
          vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;
          vec2 p = vW.xz;
          // finite differences grow with distance so far waves do not alias into rings
          float e = max(0.15, dist * 0.004);
          float h0 = waves(p, uTime), hx = waves(p + vec2(e,0.0), uTime), hz = waves(p + vec2(0.0,e), uTime);
          float amp = 0.11 * clamp(1.0 - dist/1800.0, 0.05, 1.0) * clamp(0.15 / e * 4.0, 0.25, 1.0);
          vec3 N = normalize(vec3(-(hx-h0)/e*amp, 1.0, -(hz-h0)/e*amp));
          vec2 sd2 = texture2D(uShore, (vW.xz - uShoreXf.xy) * uShoreXf.zw).rg * 1020.0;
          float sd = sd2.r; // metres to the coast (sea side)
          vec3 water = mix(uShallow, uMid, smoothstep(8.0, 120.0, sd));
          water = mix(water, uDeep, smoothstep(140.0, 700.0, sd));
          water *= mix(1.0, 0.28, uNight);
          float ndv = max(dot(N, V), 0.0);
          float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
          vec3 R = reflect(-V, N);
          vec3 refl = mix(uHorizon, uSky, clamp(R.y * 2.5, 0.0, 1.0));
          vec3 col = mix(water, refl, clamp(fres * 0.8, 0.0, 0.62));
          float spec = pow(max(dot(R, uSunDir), 0.0), 220.0);
          col += uSunCol * spec * 2.4 * step(-0.02, uSunDir.y);
          // little whitecaps & surf near the beach
          float foam = smoothstep(0.7, 0.95, noise(p*1.4 + vec2(uTime*0.6, 0.0))) * (1.0 - smoothstep(2.0, 10.0, sd)) * 0.7;
          foam += smoothstep(0.86, 0.97, noise(p*2.2 + uTime*0.3)) * 0.08 * (1.0 - smoothstep(0.0, 250.0, dist));
          col = mix(col, vec3(0.92,0.95,0.96) * mix(1.0, 0.3, uNight), clamp(foam, 0.0, 0.6));
          float f = 1.0 - exp(-pow(uFogD * dist, 2.0));
          col = mix(col, uFog, f);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      depthWrite: false,
    });
    this.sea = new THREE.Mesh(geo, mat);
    this.sea.renderOrder = -20; this.sea.frustumCulled = false;
    this.scene.add(this.sea);
  }

  makeFarLand() {
    const far = this.city.header.far || [];
    const pos = [], idx = [];
    for (const poly of far) {
      const flat = [], holes = [];
      poly.forEach((ring, k) => { if (k > 0) holes.push(flat.length / 2); for (const [x, z] of ring) flat.push(x, z); });
      const tri = earcut(flat, holes);
      const base = pos.length / 3;
      for (let i = 0; i < flat.length; i += 2) pos.push(flat[i], -0.02, flat[i + 1]);
      for (const t of tri) idx.push(base + t);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ color: 0xb8a988, depthWrite: false });
    this.farLand = new THREE.Mesh(g, m); this.farLand.renderOrder = -19; this.farLand.receiveShadow = false;
    this.scene.add(this.farLand);
  }

  makeHills() {
    // dry hills behind the city rising towards the Troodos mountains (not real elevation data; a backdrop)
    const A = this.city.header.area; // [x0,z0,x1,z1]
    const zc = (x) => {
      let z = A[1] - 150;
      if (x > 12000) z -= (x - 12000) * 0.42;
      if (x < -16000) z += Math.min(5200, (-16000 - x) * 0.18);
      return z;
    };
    const NXh = 220, NDh = 90;
    const pos = new Float32Array((NXh + 1) * (NDh + 1) * 3), col = new Float32Array((NXh + 1) * (NDh + 1) * 3);
    const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vnoise = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      return (hash(ix, iy) * (1 - ux) + hash(ix + 1, iy) * ux) * (1 - uy) + (hash(ix, iy + 1) * (1 - ux) + hash(ix + 1, iy + 1) * ux) * uy;
    };
    const fbm = (x, y) => vnoise(x, y) * 0.5 + vnoise(x * 2.1, y * 2.1) * 0.27 + vnoise(x * 4.3, y * 4.3) * 0.15 + vnoise(x * 8.7, y * 8.7) * 0.08;
    const c1 = new THREE.Color(0xb59b6b), c2 = new THREE.Color(0x8a8455), c3 = new THREE.Color(0x4f5f3a), c4 = new THREE.Color(0xa58a62);
    let k = 0;
    for (let j = 0; j <= NDh; j++) {
      const t = j / NDh; const dn = Math.pow(t, 1.7) * 52000; // metres north of the edge
      for (let i = 0; i <= NXh; i++) {
        const x = -60000 + (i / NXh) * 120000;
        const z = zc(x) - dn;
        const ramp = 1 - Math.exp(-dn / 5200);
        const n = fbm(x / 4200, z / 4200);
        let h = ramp * (220 + 620 * n) + Math.max(0, dn - 6000) * 0.012 * n;
        // Troodos massif (Olympus ~1950 m) north-west of the city
        const tx = (x + 17000) / 16000, tz = (z + 36000) / 13000;
        h += 1350 * Math.exp(-(tx * tx + tz * tz)) * (0.75 + 0.5 * n) * ramp;
        h *= Math.min(1, dn / 900);
        pos[k * 3] = x; pos[k * 3 + 1] = h - 2; pos[k * 3 + 2] = z;
        const c = c1.clone().lerp(c2, n).lerp(c3, Math.min(1, Math.max(0, (h - 650) / 700)) * 0.85).lerp(c4, Math.max(0, 0.3 - ramp) * 0.8);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; k++;
      }
    }
    const idx = [];
    for (let j = 0; j < NDh; j++) for (let i = 0; i < NXh; i++) {
      const a = j * (NXh + 1) + i, b = a + 1, c = a + NXh + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    this.hillMat = new THREE.ShaderMaterial({
      uniforms: { uFog: { value: new THREE.Color() }, uFogD: { value: 0.00014 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uLight: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(0.5, 0.5, 0.5) } },
      vertexShader: `varying vec3 vC; varying vec3 vN; varying vec3 vW; attribute vec3 color;
        void main(){ vC = color; vN = normal; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uFog, uSunDir, uLight, uAmb; uniform float uFogD; varying vec3 vC; varying vec3 vN; varying vec3 vW;
        void main(){ float d = length(cameraPosition - vW);
          vec3 c = vC * (uAmb + uLight * max(dot(normalize(vN), uSunDir), 0.0) * 0.85);
          float f = 1.0 - exp(-pow(uFogD * 0.32 * d, 1.6));
          gl_FragColor = vec4(mix(c, uFog, clamp(f, 0.0, 0.97)), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.hills = new THREE.Mesh(g, this.hillMat);
    this.hills.frustumCulled = false;
    this.scene.add(this.hills);
  }

  makeStars() {
    const n = 1800, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.95 + 0.05;
      const th = u * Math.PI * 2, y = v;
      const r = Math.sqrt(1 - y * y);
      p[i * 3] = Math.cos(th) * r * 9000; p[i * 3 + 1] = y * 9000; p[i * 3 + 2] = Math.sin(th) * r * 9000;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false });
    this.stars = new THREE.Points(g, m); this.stars.frustumCulled = false; this.stars.renderOrder = -30;
    this.scene.add(this.stars);
  }
}
