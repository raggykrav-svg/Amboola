// Better graphics (Options: "Wet reflections" and "Extra effects"):
//  - wet streets: a half-resolution mirror image of the city is drawn into the puddles, so neon
//    signs, billboards, lamps and cars shine in the road (with ripples while it rains)
//  - soft light beams under the street lamps at night
//  - stars in the night sky
//  - a film look: colour grading, a vignette, a little lens fringing at the edges, film grain
//  - smooth (multisampled) edges when the post effects are on
// The LOW preset keeps all of this off, so weak laptops stay fast.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CITY } from './textures.js';

const { CELL, ROAD, SIDEWALK, HALF } = CITY;

// where the puddles are: the same tiling as the street texture (one tile per block)
export function puddleTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const m = v => v / CELL * S;
  let seed = 11; const rnd = (a, b) => a + ((seed = (seed * 16807) % 2147483647) / 2147483647) * (b - a);
  g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, S, S);           // everything is a bit damp
  g.fillStyle = '#4a4a4a'; g.fillRect(0, 0, m(ROAD), S); g.fillRect(0, 0, S, m(ROAD)); // the roads are wetter
  g.filter = 'blur(6px)';
  for (let i = 0; i < 70; i++) { // puddles on the roads
    const a = i % 2, x = a ? rnd(0, m(ROAD)) : rnd(0, S), y = a ? rnd(0, S) : rnd(0, m(ROAD));
    g.fillStyle = `rgba(255,255,255,${rnd(0.55, 1)})`;
    g.beginPath(); g.ellipse(x, y, rnd(8, 40), rnd(5, 18), rnd(0, 3), 0, 7); g.fill();
  }
  for (let i = 0; i < 18; i++) { // and a few on the sidewalks
    const x = rnd(m(ROAD), m(ROAD + SIDEWALK)), y = rnd(m(ROAD), S);
    g.fillStyle = `rgba(255,255,255,${rnd(0.4, 0.8)})`;
    g.beginPath(); g.ellipse(i % 2 ? x : y, i % 2 ? y : x, rnd(4, 12), rnd(3, 8), rnd(0, 3), 0, 7); g.fill();
  }
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

const PuddleShader = {
  name: 'PuddleShader',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    tMask: { value: null }, uOrigin: { value: new THREE.Vector2() }, uTime: { value: 0 }, uRain: { value: 1 },
    uStrength: { value: 1 }, uFog: { value: 0.003 }, uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv; varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tMask; uniform vec2 uOrigin, uTexel; uniform float uTime, uRain, uStrength, uFog;
    varying vec4 vUv; varying vec3 vWorld;
    void main() {
      float wet = texture2D(tMask, (vWorld.xz - uOrigin) / ${CELL.toFixed(1)}).r;
      // rain ripples wobble the mirror image a little
      vec2 rip = vec2(sin(vWorld.x * 1.3 + vWorld.z * 0.4 + uTime * 3.0) + 0.5 * sin(vWorld.z * 2.9 - uTime * 4.3), cos(vWorld.z * 1.1 - vWorld.x * 0.3 + uTime * 2.6) + 0.5 * sin(vWorld.x * 3.1 + uTime * 3.7));
      vec4 p = vUv; p.xy += rip * 0.0007 * uRain * p.w;
      vec2 uv = p.xy / p.w;
      // damp asphalt gives a blurry reflection, puddles a sharp one
      float blur = mix(6.0, 1.0, wet);
      vec3 c = texture2D(tDiffuse, uv).rgb * 0.4;
      c += texture2D(tDiffuse, uv + vec2(uTexel.x, 0.0) * blur).rgb * 0.15;
      c += texture2D(tDiffuse, uv - vec2(uTexel.x, 0.0) * blur).rgb * 0.15;
      c += texture2D(tDiffuse, uv + vec2(0.0, uTexel.y) * blur * 2.0).rgb * 0.15;
      c += texture2D(tDiffuse, uv - vec2(0.0, uTexel.y) * blur * 2.0).rgb * 0.15;
      float d = distance(cameraPosition, vWorld);
      float fade = exp(-d * uFog * 1.4) * smoothstep(0.02, 0.25, wet);
      // like real water: stronger looking along the road, weaker straight down
      float fres = mix(0.35, 1.0, pow(1.0 - abs(normalize(cameraPosition - vWorld).y), 2.0));
      fade *= fres;
      gl_FragColor = vec4(c * wet * uStrength * fade, 1.0);
    }`,
};

// light beams under the street lamps: bright at the lamp, fading toward the ground
const BeamShader = {
  vertexShader: /* glsl */`
    varying float vH; varying vec3 vCol; varying float vRim;
    void main() {
      vH = position.y / 6.6 + 0.5;
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      vRim = abs(dot(n, normalize(cameraPosition - wp.xyz)));
      vCol = instanceColor;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */`
    uniform float uAmount; varying float vH; varying vec3 vCol; varying float vRim;
    void main() {
      float a = pow(vH, 1.6) * vRim * vRim * uAmount;
      gl_FragColor = vec4(vCol * a, 1.0);
    }`,
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uAmount; uniform vec2 uRes; varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5; float r = dot(c, c);
      vec2 off = c * r * 0.018 * uAmount;               // lens fringing at the edges
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.0 + 0.18 * uAmount);     // a bit more colour
      col = (col - 0.5) * (1.0 + 0.08 * uAmount) + 0.5;  // and contrast
      col += uAmount * (vec3(-0.012, 0.004, 0.022) * (1.0 - l) + vec3(0.02, 0.008, -0.012) * l); // teal shadows, warm lights
      col *= mix(1.0, smoothstep(0.9, 0.15, r * 1.7), 0.5 * uAmount); // vignette
      float n = fract(sin(dot(vUv * uRes + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.03 * uAmount;                // film grain
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export class Graphics {
  constructor({ renderer, scene, camera, composer }) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.composer = composer;
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    this.reflector = null; this.beams = null; this.stars = null; this.on = { reflections: false, post: false };
    this.mask = puddleTexture();
  }
  attach(city) {
    this.city = city;
    const gm = city.ground.material; gm.roughnessMap = this._roughMap(); gm.roughness = 1; gm.envMapIntensity = 0.45; gm.needsUpdate = true;
    this._buildBeams(); this._buildStars();
  }
  // damp ground everywhere, glossy puddles (cheap: the sky and neon environment shine in them)
  _roughMap() {
    const src = this.mask.image, c = document.createElement('canvas'); c.width = c.height = src.width;
    const g = c.getContext('2d'); g.filter = 'invert(1)'; g.drawImage(src, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'multiply'; g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  _buildReflector() {
    const s = 6000, geo = new THREE.PlaneGeometry(s, s);
    const r = new Reflector(geo, { shader: PuddleShader, textureWidth: 512, textureHeight: 512, clipBias: 0.003, multisample: 0 });
    r.rotation.x = -Math.PI / 2; r.position.y = 0.025; r.renderOrder = 1;
    const m = r.material;
    m.transparent = true; m.blending = THREE.AdditiveBlending; m.depthWrite = false;
    m.uniforms.tMask.value = this.mask;
    m.uniforms.uOrigin.value.set(-HALF - ROAD / 2, -HALF - ROAD / 2);
    r.castShadow = r.receiveShadow = false;
    this.scene.add(r); this.reflector = r;
    this.resize();
  }
  _buildBeams() {
    const L = this.city.lampHeads || []; if (!L.length) return;
    const geo = new THREE.ConeGeometry(3.0, 6.6, 14, 1, true); // apex at the top (+y)
    const mat = new THREE.ShaderMaterial({ ...BeamShader, uniforms: { uAmount: { value: 1 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.InstancedMesh(geo, mat, L.length);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    L.forEach(([x, y, z, c], i) => { m.makeTranslation(x, y - 3.3, z); mesh.setMatrixAt(i, m); mesh.setColorAt(i, col.set(c).multiplyScalar(0.16)); });
    mesh.frustumCulled = false; mesh.renderOrder = 2;
    this.scene.add(mesh); this.beams = mesh;
  }
  _buildStars() {
    const n = 1400, pos = new Float32Array(n * 3), cols = new Float32Array(n * 3);
    let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, y = 0.08 + rnd() * 0.92, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 0.97, y * 0.97, Math.sin(a) * r * 0.97], i * 3);
      const b = 0.5 + rnd() * 0.5, tint = rnd();
      cols.set([b * (tint < 0.2 ? 0.8 : 1), b * 0.92, b * (tint > 0.8 ? 0.75 : 1)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    pts.renderOrder = -1; pts.frustumCulled = false;
    this.city.sky.add(pts); this.stars = pts;
  }
  // settings changed
  apply(settings) {
    const low = !settings.bloom; // the post effects only run in the bloom (composer) path
    this.on.post = !!settings.post && !low;
    this.on.reflections = !!settings.reflections;
    this.resScale = settings.preset === 'high' ? 0.5 : 0.35;
    if (this.on.reflections && !this.reflector && this.city) this._buildReflector();
    if (this.reflector) this.reflector.visible = this.on.reflections;
    this.grade.enabled = this.on.post;
    this.resize();
  }
  resize() {
    if (!this.reflector) return;
    const v = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(256, Math.round(v.x * this.resScale)), h = Math.max(144, Math.round(v.y * this.resScale));
    this.reflector.getRenderTarget().setSize(w, h);
    this.reflector.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.grade.uniforms.uRes.value.set(v.x, v.y);
  }
  update(dt, { night, rain, inside, fog }) {
    const t = performance.now() / 1000;
    this.grade.uniforms.uTime.value = t;
    if (this.reflector) {
      this.reflector.visible = this.on.reflections && !inside;
      const u = this.reflector.material.uniforms;
      u.uTime.value = t; u.uRain.value = rain ? 1 : 0.15; u.uFog.value = fog;
      u.uStrength.value = 0.35 + 0.75 * night; // the bright day sky would wash the street out
    }
    if (this.beams) { this.beams.visible = this.on.post && night > 0.05 && !inside; this.beams.material.uniforms.uAmount.value = night; }
    if (this.stars) { this.stars.visible = night > 0.05; this.stars.material.opacity = night * (rain ? 0.55 : 1); }
  }
}
