// Shop and flat interiors (Blender: public/models/interiors.glb): six kinds of shop and four
// kinds of flat. Each room is built once, far outside the city; walking through a street door
// moves the player into the room that fits the door (a shop's sign decides what's inside).
// Lighting is baked into the vertex colours in Blender, so the rooms are drawn unlit.
import * as THREE from 'three';
import { modelNode, modelNames, flatten } from './assets.js';
import { signTexture } from './textures.js';

const isGlow = m => m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.001;
// what's behind a shop door, by the name on its sign (anything else is a corner mart)
const SHOP_TYPES = {
  'KAIJU RAMEN': 'ramen', 'NOODLE BOTS': 'ramen', 'QUANTUM BURGER': 'diner', 'PLASMA PIZZA': 'diner', 'CYBER DELI': 'diner',
  'HOLO-BANK': 'bank', 'NEO WALL ST': 'bank', 'NEURAL LINK BAR': 'bar', 'CHROME DOLLS': 'bar', 'HOTEL 3000': 'bar',
  'ARCADE 9': 'arcade', '24/7 HOLOSHOW': 'arcade', 'PLASMA ARMS': 'guns', 'IRON & NEON GUNS': 'guns',
};
// every door gets a lighting mood on top of its room
const MOODS = [[1, 1, 1], [1.1, 0.95, 0.84], [0.86, 0.96, 1.12], [1.08, 0.86, 1.05], [0.9, 1.08, 0.95], [1.05, 1.0, 0.9]];
const DIRS = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }; // Blender compass -> game xz
const hash = n => Math.imul(n + 7, 2654435761) >>> 0;

export function buildRooms(scene, city) {
  const names = modelNames('interiors', 'room_').filter(n => !n.includes('__'));
  if (!names.length) return null;
  const rooms = { list: [] };
  const counts = { shop: 0, flat: 0 };
  const signs = {};
  for (const name of names) {
    const key = name.slice(5), [kind, type] = key.split('_');
    if (kind !== 'shop' && kind !== 'flat') continue;
    const node = modelNode('interiors', name);
    const o = new THREE.Vector3(1600 + 240 * counts[kind]++, 0, kind === 'shop' ? 1600 : 2150);
    const g = flatten(node, m => (isGlow(m) ? 'glow' : 'room'), { rgb: true });
    const grp = new THREE.Group();
    grp.position.set(o.x, 0.01, o.z);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    grp.add(new THREE.Mesh(g.room, mat));
    if (g.glow) grp.add(new THREE.Mesh(g.glow, city.trimMat));
    scene.add(grp);
    const R = { key, kind, type, origin: o, objects: [grp], props: { ...node.userData }, mat, loot: [] };
    const mark = k => modelNode('interiors', `${name}__${k}`);
    const at = k => { const m = mark(k); return m ? m.position.clone().add(o) : null; };
    for (let k = 0; ; k++) {
      const c = mark('col' + k); if (!c) break;
      const p = c.position, s = c.scale;
      city.addBox({ x0: o.x + p.x - Math.abs(s.x), x1: o.x + p.x + Math.abs(s.x), z0: o.z + p.z - Math.abs(s.z), z1: o.z + p.z + Math.abs(s.z),
        y0: Math.max(0, p.y - Math.abs(s.y)), y1: p.y + Math.abs(s.y), low: !!c.userData.low });
    }
    R.spawn = at('spawn'); R.exit = at('exit');
    R.clerk = at('clerk'); R.clerkYaw = mark('clerk') ? mark('clerk').userData.yaw || 0 : 0;
    R.counter = at('counter'); R.cash = at('cash'); R.bed = at('bed');
    for (let k = 0; at('loot' + k); k++) R.loot.push(at('loot' + k));
    // a screen plane at a marker: the shop's name sign, or the flat's TV
    const plane = (m, toneMapped) => {
      const d = m.userData, mesh = new THREE.Mesh(new THREE.PlaneGeometry(d.w || 2.4, d.h || 0.6),
        new THREE.MeshBasicMaterial({ toneMapped, transparent: !toneMapped }));
      mesh.position.copy(m.position).add(o);
      mesh.rotation.y = d.rot || 0;
      mesh.translateZ(0.015);
      scene.add(mesh); R.objects.push(mesh);
      return mesh;
    };
    if (mark('sign')) {
      R.sign = plane(mark('sign'), false);
      R.setSign = (text, color) => {
        const k = text + color;
        if (!signs[k]) signs[k] = signTexture(text, color, { bg: 'rgba(0,0,0,0)' });
        R.sign.material.map = signs[k]; R.sign.material.needsUpdate = true;
      };
    } else R.setSign = () => {};
    if (mark('tv')) {
      R.tv = plane(mark('tv'), false);
      R.tv.material.transparent = false;
      R.setChannel = k => { R.tv.material.map = city.bbTex[k % city.bbTex.length].tex; R.tv.material.needsUpdate = true; };
      R.setChannel(0);
    } else R.setChannel = () => {};
    // city skyline outside the windows
    for (let v = 0; mark('view' + v); v++) {
      const m = mark('view' + v), [dx, dz] = DIRS[m.userData.dir] || DIRS.E, p = m.position.clone().add(o);
      const lists = [[], [], []];
      for (let k = 0; k < 14; k++) {
        const w = 14 + (k * 7) % 18, h = 60 + (k * 37) % 120, far = 18 + (k % 4) * 22 + (k * 13) % 9, side = -70 + k * 11;
        const x = p.x + dx * far + (dz ? side : 0), z = p.z + dz * far + (dx ? side : 0);
        lists[k % 3].push(city._uvBox(w, h, w, x, h / 2 - 70, z, new THREE.Color(0.6, 0.6, 0.75)));
      }
      lists.forEach((l, i) => { const sky = new THREE.Mesh(mergeBoxes(l), city.windowMats[i]); scene.add(sky); R.objects.push(sky); });
    }
    R.setMood = id => { const t = MOODS[hash(id) % MOODS.length]; mat.color.setRGB(t[0] * 0.5, t[1] * 0.5, t[2] * 0.5); };
    R.setMood(0);
    rooms[key] = R; rooms.list.push(R);
  }
  const flats = rooms.list.filter(R => R.kind === 'flat').map(R => R.type).sort();
  Object.defineProperties(rooms, {
    // only the room the player is in gets drawn
    show: { value: key => { for (const R of rooms.list) for (const ob of R.objects) ob.visible = R.key === key; } },
    forDoor: {
      value: d => {
        const type = d.kind === 'shop' ? (SHOP_TYPES[d.name] || 'mart') : flats[hash(d.id) % Math.max(1, flats.length)];
        return rooms[d.kind + '_' + type] || rooms.list.find(R => R.kind === d.kind) || null;
      },
    },
  });
  rooms.show(null);
  return rooms;
}

function mergeBoxes(list) {
  // the boxes are tiny, so merge them by hand (position, normal, uv, colour, index)
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
