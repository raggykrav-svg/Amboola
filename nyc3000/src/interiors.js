// Shop and flat interiors (Blender: public/models/interiors.glb). Each room is built once,
// far outside the city; walking through a street door teleports the player into it.
// Lighting is baked into the vertex colours in Blender, so the rooms are drawn unlit.
import * as THREE from 'three';
import { modelNode, flatten } from './assets.js';
import { signTexture } from './textures.js';

const ORIGIN = { shop: new THREE.Vector3(1600, 0, 1600), flat: new THREE.Vector3(1800, 0, 1600) };
const isGlow = m => m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.001;

export function buildRooms(scene, city) {
  const rooms = {};
  for (const kind of ['shop', 'flat']) {
    const node = modelNode('interiors', 'room_' + kind);
    if (!node) return null;
    const o = ORIGIN[kind];
    const g = flatten(node, m => (isGlow(m) ? 'glow' : 'room'), { rgb: true });
    const grp = new THREE.Group();
    grp.position.set(o.x, 0.01, o.z);
    const roomMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    roomMat.color.setScalar(0.5); // keep walls under the bloom threshold so only lamps and neon glow
    grp.add(new THREE.Mesh(g.room, roomMat), new THREE.Mesh(g.glow, city.trimMat));
    scene.add(grp);
    const at = name => { const m = modelNode('interiors', `room_${kind}_${name}`); return m ? m.position.clone().add(o) : null; };
    for (let k = 0; ; k++) {
      const c = modelNode('interiors', `room_${kind}_col${k}`); if (!c) break;
      const p = c.position, s = c.scale;
      city.addBox({ x0: o.x + p.x - Math.abs(s.x), x1: o.x + p.x + Math.abs(s.x), z0: o.z + p.z - Math.abs(s.z), z1: o.z + p.z + Math.abs(s.z), y0: Math.max(0, p.y - Math.abs(s.y)), y1: p.y + Math.abs(s.y) });
    }
    rooms[kind] = { kind, origin: o, group: grp, objects: [grp], spawn: at('spawn'), exit: at('exit') };
  }
  // shop: the shop's name on the wall behind the counter
  const S = rooms.shop;
  S.clerk = at2('shop', 'clerk'); S.counter = at2('shop', 'counter'); S.cash = at2('shop', 'cash');
  const sp = at2('shop', 'sign');
  S.sign = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.62), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true }));
  S.sign.position.copy(sp).setX(sp.x - 0.02); S.sign.rotation.y = -Math.PI / 2;
  scene.add(S.sign); S.objects.push(S.sign);
  const signs = {};
  S.setSign = (name, color) => {
    const k = name + color;
    if (!signs[k]) signs[k] = signTexture(name, color, { bg: 'rgba(0,0,0,0)' });
    S.sign.material.map = signs[k]; S.sign.material.needsUpdate = true;
  };
  // flat: bed, a TV that shows the city's animated billboards, loot spots, a skyline outside the window
  const F = rooms.flat;
  F.bed = at2('flat', 'bed');
  F.loot = [0, 1, 2, 3].map(k => at2('flat', 'loot' + k)).filter(Boolean);
  const tvNode = modelNode('interiors', 'room_flat_tv'), tv = at2('flat', 'tv');
  F.tv = new THREE.Mesh(new THREE.PlaneGeometry(tvNode.userData.w || 2.1, tvNode.userData.h || 1.15),
    new THREE.MeshBasicMaterial({ map: city.bbTex[0].tex, toneMapped: false }));
  F.tv.position.copy(tv).setZ(tv.z + 0.01);
  scene.add(F.tv); F.objects.push(F.tv);
  F.setChannel = k => { F.tv.material.map = city.bbTex[k % city.bbTex.length].tex; F.tv.material.needsUpdate = true; };
  const view = at2('flat', 'view');
  const lists = [[], [], []];
  for (let k = 0; k < 14; k++) {
    const w = 14 + (k * 7) % 18, h = 60 + (k * 37) % 120, x = view.x + 18 + (k % 4) * 22 + (k * 13) % 9, z = view.z - 70 + k * 11;
    lists[k % 3].push(city._uvBox(w, h, w, x, h / 2 - 70, z, new THREE.Color(0.6, 0.6, 0.75)));
  }
  lists.forEach((l, m) => { const sky = new THREE.Mesh(mergeBoxes(l), city.windowMats[m]); scene.add(sky); F.objects.push(sky); });
  // only the room the player is in gets drawn
  Object.defineProperty(rooms, 'show', { value: kind => { for (const k of ['shop', 'flat']) for (const ob of rooms[k].objects) ob.visible = k === kind; } });
  rooms.show(null);
  return rooms;

  function at2(kind, name) { const m = modelNode('interiors', `room_${kind}_${name}`); return m ? m.position.clone().add(ORIGIN[kind]) : null; }
}

function mergeBoxes(list) {
  // the city's merge helper lives in BufferGeometryUtils; boxes are tiny, so merge by hand
  let n = 0, ni = 0;
  for (const g of list) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2); col.set(g.attributes.color.array, o * 3);
    for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + o;
    o += g.attributes.position.count; oi += g.index.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}
