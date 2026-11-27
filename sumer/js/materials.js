// Shared materials with small shader additions (facade atlas, tiled roofs, ground detail, wind in trees).
import * as THREE from 'three';
import { FCOLS, FROWS } from './textures.js';

const NOISE = /* glsl */`
float shash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float snoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(shash(i), shash(i + vec2(1.0, 0.0)), u.x), mix(shash(i + vec2(0.0, 1.0)), shash(i + vec2(1.0, 1.0)), u.x), u.y); }
`;

export function makeMaterials(facadeTex, groundTex, glowTex, leafTex = null, msaa = 0) {
  const U = { uNight: { value: 0 }, uTime: { value: 0 } };

  const groundPatch = (sh) => {
    sh.uniforms.uDetail = { value: groundTex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aDet; varying vec2 vDet; varying vec2 vGXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDet = aDet; vGXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; varying vec2 vDet; varying vec2 vGXZ;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (abs(vDet.y - 9.0) < 0.01) {
          // open ground between houses: patches of concrete, dirt and garden green
          float n1 = snoise(vGXZ * 0.03) * 0.65 + snoise(vGXZ * 0.09 + 3.1) * 0.35;
          float n2 = snoise(vGXZ * 0.07 + 11.7) * 0.7 + snoise(vGXZ * 0.23) * 0.3;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.56, 0.55, 0.52), smoothstep(0.42, 0.7, n1) * 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.24, 0.32, 0.14), smoothstep(0.6, 0.85, n2) * 0.5);
        }
        {
          vec2 tuv = vGXZ / max(vDet.y, 0.5);
          float t = floor(vDet.x + 0.5);
          vec2 cell = vec2(mod(t, 2.0), 1.0 - floor(t / 2.0));
          vec2 auv = (cell + clamp(fract(tuv), 0.002, 0.998)) * 0.5;
          float dv = textureGrad(uDetail, auv, dFdx(tuv) * 0.5, dFdy(tuv) * 0.5).r;
          diffuseColor.rgb *= dv * 1.2;
        }`);
  };
  const ground = new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false });
  ground.onBeforeCompile = groundPatch;
  ground.customProgramCacheKey = () => 'sumer-ground';
  const raised = new THREE.MeshLambertMaterial({ vertexColors: true });
  raised.onBeforeCompile = groundPatch;
  raised.customProgramCacheKey = () => 'sumer-ground';
  const marks = new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });

  const building = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.0, envMapIntensity: 0.45 });
  building.onBeforeCompile = (sh) => {
    sh.uniforms.uFacade = { value: facadeTex };
    sh.uniforms.uNight = U.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aFac; attribute vec3 aTint; attribute vec4 aInfo;
        varying vec2 vFac; varying vec3 vTint; varying vec4 vInfo; varying vec3 vBW; varying vec3 vBN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFac = aFac; vTint = aTint; vInfo = aInfo;
        vBW = (modelMatrix * vec4(position, 1.0)).xyz; vBN = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uFacade; uniform float uNight;
        varying vec2 vFac; varying vec3 vTint; varying vec4 vInfo; varying vec3 vBW; varying vec3 vBN;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float glassAmt = 0.0; float litW = 0.0;
        {
          float kind = vInfo.w;
          if (kind < 0.5) {
            vec2 cell = vFac; float fl = floor(cell.y);
            float row = fl < 0.5 ? vInfo.y : 0.0;
            vec2 f = clamp(fract(cell), 0.004, 0.996);
            vec2 sc = vec2(1.0 / ${FCOLS}.0, 1.0 / ${FROWS}.0);
            vec2 auv = (vec2(vInfo.x, row) + f) * sc;
            vec4 t = textureGrad(uFacade, auv, dFdx(cell) * sc, dFdy(cell) * sc);
            float wallM = smoothstep(0.6, 0.95, t.a);
            glassAmt = 1.0 - smoothstep(0.05, 0.3, t.a);
            vec3 tint = mix(vec3(1.0), vTint, 0.85);
            diffuseColor.rgb = mix(t.rgb, t.rgb * tint, wallM);
            float h = shash(vec2(floor(cell.x) + vInfo.z * 113.0, fl * 7.0 + vInfo.z * 57.0));
            litW = glassAmt * step(h, 0.4) * uNight * (0.6 + 0.4 * shash(vec2(fl, vInfo.z * 31.0)));
          } else if (kind < 1.5) {
            float n = snoise(vBW.xz * 0.45) * 0.6 + snoise(vBW.xz * 2.1) * 0.4;
            diffuseColor.rgb = vTint * (0.84 + 0.24 * n);
          } else if (kind < 2.5) {
            vec3 nn = normalize(vBN); vec2 dn = normalize(nn.xz + vec2(1e-4));
            float along = dot(vBW.xz, dn) / 0.32; float across = dot(vBW.xz, vec2(-dn.y, dn.x)) / 0.24;
            float rowi = floor(along); float rp = fract(along); float cp = fract(across + rowi * 0.5);
            float shade = 0.7 + 0.3 * smoothstep(0.0, 0.65, rp) * (0.82 + 0.18 * sin(cp * 6.2831));
            diffuseColor.rgb = vTint * shade * (0.86 + 0.26 * snoise(vBW.xz * 0.55 + rowi * 0.37));
          } else {
            diffuseColor.rgb = vTint * (0.9 + 0.1 * snoise(vBW.xz * 0.7 + vBW.y * 0.3));
          }
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.32, glassAmt);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.74, 0.42) * litW * 2.4;`);
  };
  building.customProgramCacheKey = () => 'sumer-building';

  const detail = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 });

  const tree = new THREE.MeshLambertMaterial({ vertexColors: true });
  tree.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #endif
          float k = max(0.0, transformed.y - 1.2);
          float s = sin(uTime * 1.25 + ip.x * 0.31 + ip.z * 0.17) + 0.4 * sin(uTime * 2.7 + ip.x * 0.9);
          transformed.x += s * 0.012 * k; transformed.z += s * 0.008 * k;
        }`);
  };
  tree.customProgramCacheKey = () => 'sumer-tree';

  // leafy trees: alpha-tested leaf cards with the same wind
  let leaf = null, leafDepth = null;
  if (leafTex) {
    leaf = new THREE.MeshLambertMaterial({ vertexColors: true, map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide });
    leaf.alphaToCoverage = msaa > 0;
    leaf.onBeforeCompile = (sh) => {
      tree.onBeforeCompile(sh);
      sh.fragmentShader = sh.fragmentShader
        // keep the round-crown normal on both sides of a card (no dark backs)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );')
        // leaves thin out in small mipmaps: give alpha back as the texture gets smaller
        .replace('#include <alphatest_fragment>', `{
            vec2 tsz = vec2(textureSize(map, 0));
            vec2 ddx = dFdx(vMapUv * tsz), ddy = dFdy(vMapUv * tsz);
            float lod = 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy)));
            diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + max(lod, 0.0) * 0.3));
          }
          #include <alphatest_fragment>`);
    };
    leaf.customProgramCacheKey = () => 'sumer-leaf' + (msaa > 0 ? '-a2c' : '');
    leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide });
  }
  // the flat ground does not write depth (its layers are drawn in order); this copy writes only depth
  // after them, so ambient occlusion sees the ground where walls meet the street
  const groundDepth = new THREE.MeshBasicMaterial({ colorWrite: false });

  const glow = new THREE.PointsMaterial({ map: glowTex, size: 5.5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0, fog: true });
  glow.userData.on = false;
  const pool = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffa860, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });

  return { U, ground, raised, marks, building, detail, tree, glow, pool, leaf, leafDepth, groundDepth };
}
