// ---------- crafting and base building
const RECIPES = [
  { id: 'axe', n: 'Stone axe', d: 'Fells trees, breaks rock, bites harder than fists.', cost: { wood: 2, stone: 2, fibre: 1 }, tool: 'axe' },
  { id: 'spear', n: 'Spear', d: 'Long reach. Your first real weapon.', cost: { wood: 3, stone: 1, fibre: 2 }, tool: 'spear' },
  { id: 'bow', n: 'Bow', d: 'Hold to draw. Release in the bright band for a perfect shot.', cost: { wood: 4, fibre: 4 }, tool: 'bow' },
  { id: 'arrows', n: 'Arrows ×6', d: 'Stone tips, feather fletching.', cost: { wood: 1, stone: 1, feather: 1 }, give: { arrows: 6 } },
  { id: 'bandage', n: 'Bandage', d: 'Restores 40 health. Key 6.', cost: { fibre: 3 }, give: { bandage: 1 } },
  { id: 'saddle', n: 'Saddle', d: 'Lets you ride a tamed raptor or triceratops.', cost: { hide: 4, fibre: 4, bone: 2 }, give: { saddle: 1 } },
  { id: 'armor', n: 'Bone armour', d: 'Takes 30% off every hit.', cost: { bone: 6, hide: 4 }, tool: 'armor' },
];
const canPay = c => Object.keys(c).every(k => S.inv[k] >= c[k]);
const pay = c => { for (const k in c) S.inv[k] -= c[k]; };
function craft(id) {
  const r = RECIPES.find(q => q.id === id); if (!r || (r.tool && S.tools[r.tool]) || !canPay(r.cost)) return sfx('deny');
  pay(r.cost); if (r.tool) { S.tools[r.tool] = 1; if (SLOTS.includes(r.tool)) player.slot = SLOTS.indexOf(r.tool); } if (r.give) for (const k in r.give) S.inv[k] += r.give[k];
  S.qd['c_' + id] = 1; toast(`Crafted ${r.n}`, 'gain'); sfx('craft'); refreshHot(); renderPanel(); save();
}

const PIECES = [
  { id: 'floor', n: 'Floor', cost: { wood: 4 } }, { id: 'wall', n: 'Wall', cost: { wood: 3, fibre: 1 } }, { id: 'door', n: 'Doorway', cost: { wood: 3 } }, { id: 'roof', n: 'Roof', cost: { wood: 3, fibre: 2 } },
  { id: 'fire', n: 'Campfire', cost: { wood: 3, stone: 4 } }, { id: 'bed', n: 'Bed', cost: { wood: 2, fibre: 6 } }, { id: 'torch', n: 'Torch', cost: { wood: 1, fibre: 1 } }, { id: 'spikes', n: 'Spikes', cost: { wood: 4, stone: 2 } },
];
const builds = [], walls = [], floors = new Map(), BGEO = {};
let ghost, buildSel = 0, buildRot = 0, ghostOk = false, ghostAt = null;
const GHOST_OK = new THREE.MeshBasicMaterial({ color: 0x9be36a, transparent: true, opacity: .45, depthWrite: false }), GHOST_NO = new THREE.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: .45, depthWrite: false });
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffa02a });
function pieceGeo(id) {
  if (BGEO[id]) return BGEO[id];
  const w1 = 0xa8845a, w2 = 0x8a6a48, w3 = 0xb8946a, th = 0xc2a45c, p = [];
  if (id === 'floor') { for (let i = 0; i < 6; i++) p.push(part(G.box(.48, .12, 3), i % 2 ? w1 : w3, [-1.25 + i * .5, -.06, 0])); for (const [x, z] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) p.push(part(G.cyl(.11, .13, 2.4, 6), w2, [x, -1.25, z])); p.push(part(G.box(3, .12, .14), w2, [0, -.18, -1.4]), part(G.box(3, .12, .14), w2, [0, -.18, 1.4])); }
  if (id === 'wall' || id === 'door') { for (let i = 0; i < 10; i++) { const x = -1.35 + i * .3; if (id === 'door' && i > 2 && i < 7) { p.push(part(G.cyl(.075, .075, .55, 6), i % 2 ? w1 : w3, [x, 2.5, 0])); continue; } p.push(part(G.cyl(.07, .085, 2.8 + (i % 3) * .06, 6), i % 2 ? w1 : w3, [x, 1.4, 0])); } p.push(part(G.box(3, .1, .2), w2, [0, 2.3, 0])); if (id === 'wall') p.push(part(G.box(3, .1, .2), w2, [0, .6, 0])); }
  if (id === 'roof') { p.push(part(G.box(3.4, .1, 3.4), w2, [0, 0, 0])); for (let i = 0; i < 9; i++) p.push(part(G.box(3.5, .09, .44), i % 2 ? th : 0xa88c4a, [0, .1 + (i % 2) * .03, -1.52 + i * .38], [.12, 0, 0])); }
  if (id === 'fire') { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; p.push(part(G.ico(.16, 0), 0x77726a, [Math.sin(a) * .5, .08, Math.cos(a) * .5])); } for (let i = 0; i < 4; i++) p.push(part(G.cyl(.05, .06, .8, 5), 0x3a2a1c, [0, .18, 0], [PI / 2 - .5, i * PI / 2 + .3, 0])); }
  if (id === 'bed') { p.push(part(G.box(1, .16, 2), w2, [0, .12, 0]), part(G.box(.94, .1, 1.94), 0xb89a6a, [0, .25, 0]), part(G.box(.9, .06, 1.1), 0x8a5a30, [0, .32, -.35]), part(G.box(.6, .1, .3), 0xd8ceb0, [0, .34, .75])); }
  if (id === 'torch') { p.push(part(G.cyl(.035, .05, 1.7, 6), w2, [0, .85, 0]), part(G.cyl(.08, .05, .2, 6), 0x3a2a1c, [0, 1.75, 0])); }
  if (id === 'spikes') { p.push(part(G.cyl(.09, .09, 2.8, 6), w2, [0, .35, 0], [0, 0, PI / 2])); for (let i = 0; i < 7; i++) p.push(part(G.cone(.07, 1.5, 5), i % 2 ? w1 : w3, [-1.2 + i * .4, .65, (i % 2 ? .25 : -.25)], [(i % 2 ? .7 : -.7), 0, 0])); }
  return BGEO[id] = merge(p);
}
function buildSpot() {
  const p = player, x = p.x + fwdX() * 3.6, z = p.z + fwdZ() * 3.6, id = PIECES[buildSel].id, cx = Math.round(x / 3) * 3, cz = Math.round(z / 3) * 3, key = cx / 3 + ',' + cz / 3;
  const base = (kx, kz) => { const f = floors.get(kx + ',' + kz); return f !== undefined ? f : hAt(kx * 3, kz * 3); };
  if (id === 'floor') return { x: cx, z: cz, y: Math.max(hAt(cx, cz), hAt(cx - 1.5, cz - 1.5), hAt(cx + 1.5, cz + 1.5), hAt(cx - 1.5, cz + 1.5), hAt(cx + 1.5, cz - 1.5)) + .25, r: 0, ok: !floors.has(key) && hAt(cx, cz) > .2 };
  if (id === 'wall' || id === 'door') { const ox = x - cx, oz = z - cz, onX = Math.abs(ox) > Math.abs(oz), wx = cx + (onX ? Math.sign(ox) * 1.5 : 0), wz = cz + (onX ? 0 : Math.sign(oz) * 1.5), kx = cx / 3, kz = cz / 3, y = Math.max(base(kx, kz), base(kx + (onX ? Math.sign(ox) : 0), kz + (onX ? 0 : Math.sign(oz)))); return { x: wx, z: wz, y: Math.max(y, hAt(wx, wz)), r: onX ? 1 : 0, ok: !builds.some(b => (b.t === 'wall' || b.t === 'door') && b.x === wx && b.z === wz) }; }
  if (id === 'roof') return { x: cx, z: cz, y: base(cx / 3, cz / 3) + 2.92, r: buildRot % 2, ok: !builds.some(b => b.t === 'roof' && b.x === cx && b.z === cz) };
  return { x, z, y: groundAt(x, z, p.y + 1), r: buildRot, ok: hAt(x, z) > .2 };
}
function addBuild(b, fresh) {
  const m = new THREE.Mesh(pieceGeo(b.t), PMAT); m.position.set(b.x, b.y, b.z); m.rotation.y = b.r * PI / 2; m.castShadow = m.receiveShadow = true; scene.add(m); b.m = m; builds.push(b);
  if (b.t === 'floor') floors.set(b.x / 3 + ',' + b.z / 3, b.y);
  if (b.t === 'wall' || b.t === 'door') walls.push(b.w = { x: b.x, z: b.z, y: b.y, dx: b.r ? 0 : 1, dz: b.r ? 1 : 0, door: b.t === 'door' });
  if (b.t === 'fire' || b.t === 'torch') { const f = new THREE.Group(), y = b.t === 'fire' ? .2 : 1.85, s = b.t === 'fire' ? 1 : .45; for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(G.cone(.2 - i * .04, .7 - i * .1, 6), FLAME); c.position.set((i - 1) * .12, .3, (i % 2) * .1); f.add(c); } f.position.set(b.x, b.y + y, b.z); f.scale.setScalar(s); scene.add(f); b.f = f; fires.push(b.fire = { x: b.x, y: b.y + y + .5, z: b.z, f, s }); }
  if (fresh) { S.builds.push({ t: b.t, x: b.x, y: b.y, z: b.z, r: b.r }); S.qd['b_' + b.t] = (S.qd['b_' + b.t] || 0) + 1; puff(b.x, b.y + .6, b.z, 0xc9a26a, 14, 3, 2.5); sfx('build'); save(); }
}
function removeBuild(b) {
  scene.remove(b.m); if (b.f) scene.remove(b.f); builds.splice(builds.indexOf(b), 1); if (b.w) walls.splice(walls.indexOf(b.w), 1); if (b.fire) fires.splice(fires.indexOf(b.fire), 1); if (b.t === 'floor') floors.delete(b.x / 3 + ',' + b.z / 3);
  const i = S.builds.findIndex(q => q.t === b.t && q.x === b.x && q.z === b.z && q.y === b.y); if (i >= 0) S.builds.splice(i, 1);
  const c = PIECES.find(q => q.id === b.t).cost; for (const k in c) if (c[k] > 1) S.inv[k] += c[k] >> 1; toast(`Removed ${b.t}. Half the materials returned.`); sfx('chop'); save();
}
function setBuild(on) {
  player.build = on; player.drawing = false; $('#buildbar').hidden = !on; $('#hotbar').hidden = on; if (!ghost) { ghost = new THREE.Mesh(pieceGeo('floor'), GHOST_OK); ghost.renderOrder = 5; scene.add(ghost); } ghost.visible = on;
  if (on) { renderBuildBar(); tip('Build: pick a piece with 1–8, R to turn, click to place, X to remove what you face, B to finish.'); }
}
function updateBuild() {
  if (!player.build) return;
  const s = ghostAt = buildSpot(), pc = PIECES[buildSel]; ghostOk = s.ok && canPay(pc.cost) && !ringBlocked(s.x, s.z, 3);
  ghost.geometry = pieceGeo(pc.id); ghost.material = ghostOk ? GHOST_OK : GHOST_NO; ghost.position.set(s.x, s.y, s.z); ghost.rotation.y = s.r * PI / 2;
  if (inp.lmbHit) { inp.lmbHit = false; if (ghostOk) { pay(pc.cost); addBuild({ t: pc.id, x: s.x, y: s.y, z: s.z, r: s.r }, true); startAct('swing', .4); renderBuildBar(); } else { sfx('deny'); toast(canPay(pc.cost) ? 'Can\'t build there' : 'Not enough materials', 'bad'); } }
}
function removeFacing() { const x = player.x + fwdX() * 2.5, z = player.z + fwdZ() * 2.5; let best = null, bd = 2.6; for (const b of builds) { if (b.fixed) continue; const d = dist2(x, z, b.x, b.z) + (b.t === 'roof' ? .8 : 0); if (d < bd) { bd = d; best = b; } } if (best && !best.fixed) { removeBuild(best); renderBuildBar(); } }

// up to four real lights follow the nearest flames
const fireLights = [];
function updateFires(dt) {
  if (!fireLights.length) for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff9a3a, 0, 22, 1.6); scene.add(l); fireLights.push(l); }
  for (const f of fires) { f.d = dist2(f.x, f.z, player.x, player.z); if (f.d < 90) { const k = 1 + Math.sin(now * 13 + f.x) * .16 + Math.sin(now * 7.3 + f.z) * .1; f.f.scale.set(f.s, f.s * k, f.s); f.f.rotation.y += dt * 3; if (f.d < 40 && Math.random() < dt * 5) puff(f.x, f.y, f.z, 0xffb040, 1, .5, 1.6, .7); } }
  const near = fires.filter(f => f.d < 70).sort((a, b) => a.d - b.d);
  fireLights.forEach((l, i) => { const f = near[i]; if (f) { l.position.set(f.x, f.y + .3, f.z); l.intensity = (26 + Math.sin(now * 11 + i) * 5) * f.s * lerp(1, .45, dayF); } else l.intensity = 0; });
  // spikes hurt wild animals that push into them
  for (const b of builds) if (b.t === 'spikes') for (const d of dinos) if (d.alive && !d.tamed && !d.sp.fly && dist2(d.x, d.z, b.x, b.z) < 1.4 + d.sp.br) { d.spikeT = (d.spikeT || 0) - dt; if (d.spikeT <= 0) { d.spikeT = .7; d.hurt(14, 'spikes'); } }
}
