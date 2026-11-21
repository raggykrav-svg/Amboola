// Models made in Blender (scripts in blender/, output in public/models/*.glb).
// They're loaded once at boot and flattened into the same kind of geometry the
// procedural builders make (vertex colours with baked AO, a per-vertex glow flag
// and per-vertex roughness/metalness), so each car or person stays one or two
// draw calls. If a file is missing, the game uses its procedural models instead.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const scenes = {};

export async function loadModels(files, onProgress) {
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all(files.map(async name => {
    try {
      const gltf = await loader.loadAsync(`models/${name}.glb`);
      gltf.scene.updateMatrixWorld(true);
      scenes[name] = gltf.scene;
    } catch (e) {
      console.warn(`models/${name}.glb not loaded, using procedural models`, e && e.message);
    }
    onProgress && onProgress(++done / files.length);
  }));
}

export const hasModels = file => !!scenes[file];
export const modelNode = (file, name) => (scenes[file] ? scenes[file].getObjectByName(name) || null : null);
export function modelNames(file, prefix) {
  const out = [];
  if (scenes[file]) for (const c of scenes[file].children) if (c.name.startsWith(prefix)) out.push(c.name);
  return out;
}
// Marker empties: their position in model space (glTF is already Y-up, front = -Z like the game)
export function markerPos(file, name) {
  const o = modelNode(file, name);
  return o ? new THREE.Vector3().setFromMatrixPosition(o.matrixWorld) : null;
}

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _inv = new THREE.Matrix4();

// Flatten a GLB node into geometry groups. classify(material) returns a group name
// ('paint', 'det', ...) or null to skip. Every group gets position, normal and colour;
// opts.glow adds 'glow' + 'rm', opts.uv keeps uv, opts.bones (name -> index) remaps skinning.
export function flatten(node, classify, opts = {}) {
  const groups = {};
  node.updateMatrixWorld(true);
  _inv.copy(node.matrixWorld).invert();
  node.traverse(o => {
    if (!o.isMesh) return;
    const mat = o.material;
    const key = classify(mat);
    if (!key) return;
    const src = o.geometry;
    const n = src.attributes.position.count;
    _m.multiplyMatrices(_inv, o.matrixWorld);
    _n.getNormalMatrix(_m);
    const g = new THREE.BufferGeometry();
    const pos = src.attributes.position.clone().applyMatrix4(_m);
    const nrm = src.attributes.normal.clone().applyNormalMatrix(_n);
    g.setAttribute('position', pos);
    g.setAttribute('normal', nrm);
    const ao = src.attributes.color;
    const em = mat.emissive && mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.001;
    const base = em ? mat.emissive : mat.color;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = ao && !em ? ao.getX(i) : 1;
      col[i * 3] = base.r * a; col[i * 3 + 1] = base.g * a; col[i * 3 + 2] = base.b * a;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (opts.glow) {
      g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(em ? 1 : 0), 1));
      const rm = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { rm[i * 2] = mat.roughness ?? 0.5; rm[i * 2 + 1] = mat.metalness ?? 0; }
      g.setAttribute('rm', new THREE.BufferAttribute(rm, 2));
    }
    if (opts.uv && src.attributes.uv) g.setAttribute('uv', src.attributes.uv.clone());
    if (opts.bones) {
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      if (o.isSkinnedMesh && src.attributes.skinIndex) {
        const bones = o.skeleton.bones, a = src.attributes.skinIndex, w = src.attributes.skinWeight;
        for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
          const b = bones[a.getComponent(i, k)], bn = b ? b.name.replace(/_\d+$/, '') : '';
          si[i * 4 + k] = opts.bones[bn] !== undefined ? opts.bones[bn] : 0;
          sw[i * 4 + k] = w.getComponent(i, k);
        }
      } else for (let i = 0; i < n; i++) sw[i * 4] = 1;
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    }
    if (src.index) g.setIndex(src.index.clone());
    (groups[key] || (groups[key] = [])).push(g);
  });
  const out = {};
  for (const k in groups) {
    out[k] = groups[k].length === 1 ? groups[k][0] : mergeGeometries(groups[k]);
    out[k].computeBoundingSphere();
  }
  return out;
}
