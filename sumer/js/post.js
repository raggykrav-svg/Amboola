// Post-processing for Medium and up: the scene is drawn into an antialiased HDR image with a depth
// texture, ambient occlusion (soft contact shadows where walls meet the ground, under balconies and
// trees) is worked out from that depth, then one pass puts it together with tone mapping, a gentle
// warm grade and a soft vignette.
import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export function postSupported(renderer) {
  const e = renderer.extensions;
  return e.has('EXT_color_buffer_float') || e.has('EXT_color_buffer_half_float');
}

export class Post {
  constructor(renderer, scene, camera, q) {
    this.r = renderer; this.scene = scene; this.camera = camera; this.q = q;
    this.size = new THREE.Vector2();
    renderer.getDrawingBufferSize(this.size);
    const w = this.size.x, h = this.size.y;
    this.depth = new THREE.DepthTexture(w, h, THREE.FloatType);
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: q.msaa || 0, depthTexture: this.depth });
    this.ao = null;
    if (q.ao) {
      const s = q.aoScale || 0.5;
      this.ao = new GTAOPass(scene, camera, Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
      this.ao.setGBuffer(this.depth, undefined); // normals are rebuilt from depth: no second scene pass
      this.ao.output = GTAOPass.OUTPUT.Off;      // we only want the AO image; it is mixed in below
      this.ao.updateGtaoMaterial({ radius: 2.0, distanceExponent: 1.4, thickness: 1.4, distanceFallOff: 1, scale: 1.1, samples: q.aoSamples || 12, screenSpaceRadius: false });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    }
    this.mat = new THREE.ShaderMaterial({
      defines: { USE_AO: this.ao ? 1 : 0 },
      uniforms: {
        tScene: { value: this.rt.texture }, tAO: { value: this.ao ? this.ao.gtaoMap : null },
        uAO: { value: 0.8 }, uVig: { value: 0.22 }, uWarm: { value: new THREE.Vector3(1.02, 1.0, 0.97) },
      },
      vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tScene;
        #if USE_AO == 1
          uniform sampler2D tAO;
        #endif
        uniform float uAO, uVig; uniform vec3 uWarm;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tScene, vUv);
          #if USE_AO == 1
            float ao = texture2D(tAO, vUv).r;
            c.rgb *= mix(1.0, ao, uAO);
            #ifdef DEBUG_AO
              gl_FragColor = vec4(vec3(ao), 1.0); return;
            #endif
          #endif
          c.rgb *= uWarm;
          float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
          c.rgb = max(mix(vec3(lum), c.rgb, 0.86), 0.0);   // a little less saturated, like an architect's render
          float d = distance(vUv, vec2(0.5));
          c.rgb *= mix(1.0, 0.8, smoothstep(0.38, 0.9, d) * uVig / 0.22);
          gl_FragColor = vec4(c.rgb, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }

  setSize() {
    this.r.getDrawingBufferSize(this.size);
    const w = this.size.x, h = this.size.y;
    this.depth.image.width = w; this.depth.image.height = h;
    this.rt.setSize(w, h);
    if (this.ao) { const s = this.q.aoScale || 0.5; this.ao.setSize(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))); }
  }

  // night: softer AO and a little more vignette
  setNight(n) { this.mat.uniforms.uAO.value = n >= 1 ? 0.55 : 0.8; this.mat.uniforms.uVig.value = n >= 1 ? 0.3 : 0.22; this.mat.uniforms.uWarm.value.set(n >= 1 ? 1.0 : 1.02, 1.0, n >= 1 ? 1.02 : 0.97); }

  debugAO(on) { if (on) this.mat.defines.DEBUG_AO = 1; else delete this.mat.defines.DEBUG_AO; this.mat.needsUpdate = true; }

  render() {
    const r = this.r;
    r.setRenderTarget(this.rt);
    r.render(this.scene, this.camera);
    if (this.ao) this.ao.render(r, null, this.rt);
    r.setRenderTarget(null);
    this.quad.render(r);
  }
}
