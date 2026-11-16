// ---------- the player: movement, camera, tools, bow, riding, interaction
const player = { x: POI.spawn[0], y: 2, z: POI.spawn[1], vy: 0, yaw: PI, cy: PI, cp: .22, ground: true, stam: 100, slot: 0, act: null, actT: 0, actDur: .45, hitDone: true, draw: 0, drawing: false, mount: null, emote: null, alive: true, foe: null, foeT: 0, fp: false, swim: false, sneak: false, hurtT: 0, hitR: .4, hitY: 1, near: null, nearF: null, stepT: 0, v: 0, human: null, build: false, name: 'You' };
const SLOTS = ['hands', 'axe', 'spear', 'bow'];
player.hurt = function (dmg, from) {
  if (!this.alive || mode !== 'play') return; dmg *= S.tools.armor ? .7 : 1; if (this.mount) dmg *= .8;
  S.hp -= dmg; this.hurtT = .5; this.emote = null; sfx('hurt'); $('#hurt').style.opacity = clamp(dmg / 30, .35, .9);
  if (from && from.alive && from.hurt) { this.foe = from; this.foeT = 12; }
  if (S.hp <= 0) { S.hp = 0; this.alive = false; if (this.mount) dismount(true); mode = 'dead'; this.deadT = 0; $('#dead').hidden = false; document.exitPointerLock?.(); }
};
function respawn() {
  const p = S.spawn || [POI.spawn[0], POI.spawn[1]]; player.x = p[0]; player.z = p[1]; player.y = groundAt(p[0], p[1], 99); player.vy = 0; player.alive = true; S.hp = 70; S.food = Math.max(S.food, 45); S.water = Math.max(S.water, 45);
  for (const d of dinos) if (d.target === player) { d.target = null; d.state = 'idle'; d.st = 4; }
  for (const d of dinos) if (d.tamed && d.alive) { d.x = player.x + 3; d.z = player.z + 2; d.target = null; }
  $('#dead').hidden = true; $('#hurt').style.opacity = 0; player.hurtT = 0; mode = 'play'; player.human.root.rotation.set(0, 0, 0);
}
function rebuildPlayer() {
  if (player.human) scene.remove(player.human.root);
  player.human = makeHuman(S.look, S.equip.bow); scene.add(player.human.root); player.human.show = null;
}
const fwdX = () => Math.sin(player.cy), fwdZ = () => Math.cos(player.cy);
function setSlot(i) { if (player.build) return; if (i === 1 && !S.tools.axe || i === 2 && !S.tools.spear || i === 3 && !S.tools.bow) { toast(`Craft a ${['', 'stone axe', 'spear', 'bow'][i]} first (Tab)`, 'bad'); sfx('deny'); return; } player.slot = i; player.drawing = false; player.draw = 0; refreshHot(); sfx('click'); }
function eat() {
  const k = S.inv.cooked ? 'cooked' : S.inv.berries ? 'berries' : S.inv.meat ? 'meat' : null; if (!k) { toast('Nothing to eat', 'bad'); return; }
  S.inv[k]--; if (k === 'cooked') { S.food = Math.min(100, S.food + 38); S.hp = Math.min(100, S.hp + 10); } if (k === 'berries') { S.food = Math.min(100, S.food + 11); S.water = Math.min(100, S.water + 7); } if (k === 'meat') { S.food = Math.min(100, S.food + 15); S.hp -= 4; toast('Raw meat. Cook it at a campfire next time.', 'bad'); }
  startAct('eat', .8); sfx('eat'); refreshHot();
}
function heal() { if (!S.inv.bandage) { toast('No bandages. Craft some from fibre.', 'bad'); return; } if (S.hp >= 100) return; S.inv.bandage--; S.hp = Math.min(100, S.hp + 40); startAct('eat', .6); sfx('craft'); refreshHot(); }
function startAct(a, dur) { player.act = a; player.actT = 0; player.actDur = dur; player.hitDone = false; player.emote = null; }

// everything that can be hit
function targets(fn) { for (const d of dinos) if (d.alive && d.root.visible) fn(d); for (const n of npcs) if (n.alive) fn(n); if (outpost.gate.alive) fn(outpost.gate); }
function meleeHit() {
  const m = player.mount, ox = player.x, oz = player.z, tool = SLOTS[player.slot];
  const range = m ? m.reach + .6 : tool === 'spear' ? 3.4 : 2.5, dmg = m ? m.sp.ride.bite : tool === 'spear' ? 30 : tool === 'axe' ? 17 : 4, face = m ? m.yaw : player.cy;
  let best = null, bd = 1e9;
  targets(t => { if (t === m || t.tamed) return; const d = dist2(ox, oz, t.x, t.z) - (t.hitR || .4); if (d < range && d < bd && Math.abs(angDiff(face, Math.atan2(t.x - ox, t.z - oz))) < (d < 1 ? 1.6 : .95) && Math.abs((t.y + (t.hitY || 0)) - (player.y + 1)) < 4 + (t.hitR || 0)) { best = t; bd = d; } });
  if (best) { best.hurt(dmg * (best === outpost.gate && m && m.key === 'trike' ? 1 : best === outpost.gate ? .55 : 1), m || player); player.foe = best.hurt && best !== outpost.gate ? best : player.foe; player.foeT = 14; shake(.12); return; }
  if (m) return;
  let node = null; bd = 1e9;
  nearNodes(ox, oz, 2.7, n => { if (n.t !== 'tree' && n.t !== 'rock') return; const d = dist2(ox, oz, n.x, n.z) - n.r; if (d < bd && Math.abs(angDiff(face, Math.atan2(n.x - ox, n.z - oz))) < 1.1) { node = n; bd = d; } });
  if (!node) return;
  if (tool !== 'axe') { toast(node.t === 'tree' ? 'You need a stone axe to fell trees' : 'You need a stone axe to break rock', 'bad'); return; }
  node.hp--; shake(.08);
  if (node.t === 'tree') { sfx('chop'); puff(node.x, node.y + 1.3, node.z, 0xc9a26a, 7, 3, 2); gain('wood', 1); if (node.hp <= 0) { gain('wood', 3); puff(node.x, node.y + 5, node.z, 0x4d8c3c, 26, 6, 3, 1.2); takeNode(node, 260); if (Math.random() < .4) gain('fibre', 1); } }
  else { sfx('rock'); puff(node.x, node.y + .8, node.z, 0xa8a49c, 7, 3, 2); gain('stone', 1); if (node.hp <= 0) { gain('stone', 2); takeNode(node, 300); } }
}

// ---------- arrows
const arrows = [], AMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
let arrowGeo;
function shoot(ox, oy, oz, dx, dy, dz, speed, dmg, from, crit) {
  if (!arrowGeo) arrowGeo = merge([part(G.cyl(.012, .012, .8, 5), 0xc9a26a, [0, 0, 0], [PI / 2, 0, 0]), part(G.cone(.03, .1, 4), 0x8d8a84, [0, 0, .44], [PI / 2, 0, 0]), part(G.box(.07, .002, .12), 0xe8dfc8, [0, 0, -.34]), part(G.box(.002, .07, .12), 0xe8dfc8, [0, 0, -.34])]);
  let a = arrows.find(q => !q.live && q.t <= 0); if (!a) { if (arrows.length > 40) return; a = { m: new THREE.Mesh(arrowGeo, AMAT), p: new V3(), v: new V3() }; scene.add(a.m); arrows.push(a); }
  a.p.set(ox, oy, oz); a.v.set(dx, dy, dz).normalize().multiplyScalar(speed); a.live = true; a.t = 9; a.dmg = dmg; a.from = from; a.crit = crit; a.m.visible = true; a.trail = from === player ? S.equip.bow : null;
}
const _a = new V3(), _b = new V3(), _h = new V3();
function updateArrows(dt) {
  for (const a of arrows) {
    if (!a.live) { if (a.t > 0 && (a.t -= dt) <= 0) a.m.visible = false; continue; }
    a.v.y -= 11 * dt; _a.copy(a.p); a.p.addScaledVector(a.v, dt); a.t -= dt; a.m.position.copy(a.p); a.m.lookAt(_b.copy(a.p).add(a.v));
    if (a.trail && Math.random() < .7) puff(a.p.x, a.p.y, a.p.z, a.trail === 'b_rime' ? 0x9fdcff : 0xff8a2a, 1, .3, .2, .5);
    let hit = null, head = false; const step = _a.distanceTo(a.p);
    const test = (cx, cy, cz, r) => { _b.set(cx, cy, cz).sub(_a); const t = clamp(_b.dot(a.v) / a.v.length() / (step || 1), 0, 1); return _h.copy(_a).lerp(a.p, t).distanceTo(_b.set(cx, cy, cz)) < r; };
    if (a.from === player || a.from.tamed) targets(t => { if (hit || t.tamed || t === player.mount) return; if (Math.abs(t.x - a.p.x) + Math.abs(t.z - a.p.z) > 14) return; if (t.headPos) { t.headPos(_v); if (test(_v.x, _v.y, _v.z, (t.sp ? t.sp.hr * 1.5 : .17) + .1)) { hit = t; head = true; return; } } if (test(t.x, t.y + (t.hitY || 0), t.z, (t.hitR || .4) + .1)) hit = t; });
    else if (player.alive && test(player.x, player.y + (player.mount ? 2 : 1), player.z, .55)) hit = player;
    if (hit) { a.live = false; a.t = 0; a.m.visible = false; let d = a.dmg * (a.crit ? 1.7 : 1); if (hit === outpost.gate) d *= .25; hit.hurt(d, a.from, head); if (a.from === player) { sfx('thunk'); if (hit !== outpost.gate) { player.foe = hit; player.foeT = 14; } } continue; }
    if (a.p.y < hAt(a.p.x, a.p.z) || a.t <= 0 || ringBlocked(a.p.x, a.p.z, 0) && a.p.y < outpost.y + 4) { a.live = false; a.t = 7; sfxAt('thunk', a.p.x, a.p.z, 25); }
  }
}

// ---------- ground and collisions
function groundAt(x, z, y) { let h = hAt(x, z); const f = floors.get(Math.round(x / 3) + ',' + Math.round(z / 3)); if (f !== undefined && y >= f - .7) h = Math.max(h, f); return h; }
function collide(p, r) {
  nearNodes(p.x, p.z, r + 2.5, n => { if (!n.solid) return; const dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz), m = r + n.r * (n.t === 'rock' ? .8 : 1); if (d < m && d > .001) { p.x += dx / d * (m - d); p.z += dz / d * (m - d); } });
  for (const w of walls) { if (Math.abs(w.x - p.x) > 4 || Math.abs(w.z - p.z) > 4 || p.y > w.y + 2.6 || p.y < w.y - 2) continue; const ax = w.x - w.dx * 1.5, az = w.z - w.dz * 1.5, t = clamp(((p.x - ax) * w.dx + (p.z - az) * w.dz) / 3, 0, 1); if (w.door && t > .3 && t < .7) continue; const qx = ax + w.dx * 3 * t, qz = az + w.dz * 3 * t, dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz), m = r + .12; if (d < m && d > .001) { p.x += dx / d * (m - d); p.z += dz / d * (m - d); } }
  ringPush(p, r);
  p.x = clamp(p.x, -HALF + 12, HALF - 12); p.z = clamp(p.z, -HALF + 12, HALF - 12);
}

// ---------- riding
function mountUp(d) { player.mount = d; d.rider = true; d.target = null; d.state = 'follow'; player.emote = null; player.drawing = false; S.qd.rode = 1; sfx(d.sp.voice, .5); tip('Riding: WASD to steer, Shift to sprint, Space to leap, click to bite. E to get down.'); }
function dismount(quiet) { const d = player.mount; if (!d) return; d.rider = false; player.mount = null; player.x = d.x + Math.cos(d.yaw) * (d.sp.br + .9); player.z = d.z - Math.sin(d.yaw) * (d.sp.br + .9); player.y = groundAt(player.x, player.z, 99); player.vy = 0; if (!quiet) sfx('click'); }

// ---------- interaction
function findNear() {
  const p = player; p.near = null; p.nearF = null; if (p.build || p.mount) { if (p.mount) p.near = { label: 'Get down', go: () => dismount() }; return; }
  let bd = 1e9; const set = (d, o) => { if (d < bd) { bd = d; p.near = o; } };
  for (const d of dinos) {
    const dd = dist2(p.x, p.z, d.x, d.z) - d.hitR; if (dd > 3.2) continue;
    if (!d.alive) { if (d.loot && Math.abs(d.y - p.y) < 3) set(dd - 1, { label: `Harvest ${d.sp.name}`, go: () => { for (const k in d.loot) gain(k, d.loot[k]); d.loot = null; d.deadT = 0; startAct('pick', .5); sfx('chop'); S.qd.hunted = 1; } }); continue; }
    if (d.tamed) { if (d.sp.ride) set(dd, d.saddle ? { label: `Ride ${d.name}`, go: () => mountUp(d) } : { label: S.inv.saddle ? `Saddle ${d.name}` : `${d.name} needs a saddle (craft one)`, go: () => { if (!S.inv.saddle) return sfx('deny'); S.inv.saddle--; d.saddle = true; const t = S.tames.find(t => t.id === d.tid); if (t) t.saddle = true; d.build(); sfx('craft'); save(); } }); p.nearF = { label: `Pet ${d.name}`, go: () => { startAct('pet', 1.6); d.jawT = .3; sfx('heart'); puff(d.x, d.y + d.hitY + d.sp.br + .5, d.z, 0xff6a9a, 8, 1.2, 2.5, 1.1); d.hp = Math.min(d.max, d.hp + d.max * .1); S.qd.pet = 1; } }; }
    else if (d.state === 'dazed' && d.sp.tame) { const f = d.sp.tame.food; p.nearF = { label: `Feed ${ITEM[f].toLowerCase()} (${d.feed}/${d.sp.tame.n})`, go: () => { if (!S.inv[f]) { toast(`You have no ${ITEM[f].toLowerCase()}`, 'bad'); return sfx('deny'); } S.inv[f]--; d.feed++; d.st = Math.max(d.st, 12); startAct('pet', .7); sfx('eat'); puff(d.x, d.y + d.hitY + d.sp.br, d.z, 0xff6a9a, 5, 1.2, 2.5, 1); if (d.feed >= d.sp.tame.n) d.tame(); refreshHot(); } }; }
  }
  for (const b of builds) { const dd = dist2(p.x, p.z, b.x, b.z); if (dd > 2.6) continue; if (b.t === 'fire') set(dd, { label: S.inv.meat ? `Cook ${S.inv.meat} raw meat` : 'Campfire (bring raw meat)', go: () => { if (!S.inv.meat) return; const n = S.inv.meat; S.inv.meat = 0; S.inv.cooked += n; toast(`+${n} Cooked meat`, 'gain'); S.qd.cooked = 1; sfx('craft'); refreshHot(); } }); if (b.t === 'bed') set(dd, { label: dayF < .5 ? 'Sleep until morning' : 'Rest here (sets your camp)', go: () => { S.spawn = [b.x, b.z]; if (dayF < .5) { S.time = .27; S.day++; S.hp = Math.min(100, S.hp + 40); fade(); } toast('Camp set. You will wake here.', 'gain'); S.qd.bed = 1; save(); } }); }
  if (outpost.canCapture && dist2(p.x, p.z, outpost.x, outpost.z) < 4.5) set(0, { label: 'Hold to claim the totem', hold: true, go: () => { } });
  nearNodes(p.x, p.z, 2.3, n => { if (n.t === 'tree' || n.t === 'rock' || n.t === 'hut' || (n.t === 'bush' && !n.ripe)) return; const dd = dist2(p.x, p.z, n.x, n.z) + .3; set(dd, { label: { stone: 'Pick up stone', stick: 'Pick up stick', fern: 'Gather fibre', bush: 'Pick berries', amber: 'Take amber' }[n.t], go: () => { startAct('pick', .45); sfx('pick'); if (n.t === 'stone') gain('stone', 1); if (n.t === 'stick') gain('wood', 1); if (n.t === 'fern') gain('fibre', 2); if (n.t === 'bush') { gain('berries', 3); gain('fibre', 1); } if (n.t === 'amber') { addAmber(20); sfx('coin'); } takeNode(n, n.t === 'amber' ? 900 : n.t === 'bush' ? 200 : 170); } }); });
  if (!p.near && hAt(p.x, p.z) < .35 && S.water < 99) p.near = { label: 'Drink', go: () => { S.water = Math.min(100, S.water + 30); startAct('pick', .6); sfx('splash'); } };
}

let camShake = 0; const shake = a => { camShake = Math.max(camShake, a); };
function updatePlayer(dt) {
  const p = player, h = p.human, m = p.mount;
  // look
  const sens = .0023 * S.opt.sens; p.cy -= inp.mx * sens; p.cp = clamp(p.cp + inp.my * sens, -1.15, 1.3); inp.mx = inp.my = 0;
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - inp.jy, r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + inp.jx;
  const il = Math.hypot(f, r); if (il > 1) { f /= il; r /= il; } const moving = il > .12;
  if (moving && p.emote) p.emote = null;
  const sprint = (keys.ShiftLeft || keys.ShiftRight || (inp.touch && il > .92)) && moving && p.stam > 1 && !p.drawing;
  p.sneak = !!(keys.ControlLeft || keys.KeyC) && !m && !p.swim;
  const mvx = fwdX() * f - fwdZ() * r, mvz = fwdZ() * f + fwdX() * r;
  if (m) {
    const spd = m.sp.ride.spd * (sprint ? 1 : .55); m.v = 0;
    if (moving) { m.move(m.x + mvx * 10, m.z + mvz * 10, spd, dt); if (sprint) p.stam -= 7 * dt; }
    if (m.atk > 0) { m.atk -= dt; if (m.atk <= .25 && !m.hitDone) { m.hitDone = true; meleeHit(); } }
    m.y = lerp(m.y, hAt(m.x, m.z), clamp(12 * dt, 0, 1)) + (m.leap || 0); if (m.leapV !== undefined) { m.leap = (m.leap || 0) + m.leapV * dt; m.leapV -= 22 * dt; if (m.leap <= 0) { m.leap = 0; m.leapV = undefined; } }
    if (keys.Space && m.leapV === undefined && m.key === 'raptor') { m.leapV = 8; sfx('swing'); }
    m.animate(dt); m.seatPos(_v); p.x = m.x; p.z = m.z; p.y = _v.y - .78; p.yaw = m.yaw; p.v = m.v; p.swim = false; p.ground = true;
  } else {
    const hT = hAt(p.x, p.z); p.swim = hT < -1.15 && p.y <= -.9;
    const spd = p.swim ? 2.6 : p.sneak ? 1.9 : sprint ? 6.7 : p.drawing ? 2.2 : 3.7;
    if (sprint) p.stam -= 11 * dt;
    if (moving && p.alive) {
      const nx = p.x + mvx * spd * dt, nz = p.z + mvz * spd * dt, gh = groundAt(nx, nz, p.y);
      if (!(gh - p.y > .75 && p.ground && slopeAt(nx, nz) > 1.25)) { p.x = nx; p.z = nz; }
      p.v = spd * il;
    } else p.v = 0;
    collide(p, .36);
    for (const d of dinos) if (d.alive && !d.sp.fly && d.sp.br > .3) { const dx = p.x - d.x, dz = p.z - d.z, dd = Math.hypot(dx, dz), mm = d.sp.br + .3; if (dd < mm && dd > .001) { p.x += dx / dd * (mm - dd); p.z += dz / dd * (mm - dd); } }
    const g = groundAt(p.x, p.z, p.y);
    if (p.swim) { p.y = lerp(p.y, -1.3, 6 * dt); p.vy = 0; p.ground = false; if (keys.Space && hT > -1.6) p.vy = 4; }
    else { if (keys.Space && p.ground && p.stam > 6) { p.vy = 6.2; p.ground = false; p.stam -= 6; p.emote = null; } p.vy -= 18 * dt; p.y += p.vy * dt; if (p.y <= g) { if (p.vy < -13) p.hurt((-p.vy - 13) * 4); p.y = g; p.vy = 0; p.ground = true; } else if (p.y - g > .25) p.ground = false; if (p.ground && p.y - g < .5 && p.vy <= 0) p.y = g; }
    const aim = p.drawing || p.act === 'swing' || p.act === 'thrust' || p.fp;
    p.yaw += clamp(angDiff(p.yaw, aim ? p.cy : moving ? Math.atan2(mvx, mvz) : p.yaw), -14 * dt, 14 * dt);
    if (moving && p.ground && (p.stepT -= dt * spd) < 0) { p.stepT = 2.3; sfx(hT < .2 ? 'splash' : 'step'); }
  }
  if (!sprint) p.stam = Math.min(100, p.stam + (moving ? 9 : 16) * dt);
  // tools
  const tool = SLOTS[p.slot];
  if (p.act) { p.actT += dt; if (!p.hitDone && (p.act === 'swing' || p.act === 'thrust') && p.actT > p.actDur * .5) { p.hitDone = true; meleeHit(); } if (p.actT >= p.actDur) p.act = null; }
  if (!p.build && p.alive) {
    if (m && tool !== 'bow') { if (inp.lmbHit && m.atk <= 0) { m.atk = .5; m.hitDone = false; m.jawT = .4; sfx(m.sp.voice, .5); } }
    else if (tool === 'bow') {
      if (inp.lmb && !p.drawing && !p.act) { if (S.inv.arrows > 0) { p.drawing = true; p.draw = 0; } else if (inp.lmbHit) { toast('No arrows. Craft some (Tab).', 'bad'); sfx('deny'); } }
      if (p.drawing) {
        p.draw += dt / 1.15;
        if (!inp.lmb) {
          p.drawing = false;
          if (p.draw > .18) {
            const pw = clamp(p.draw, 0, 1), perfect = p.draw > .74 && p.draw < .88, over = p.draw > 1.02, sp = over ? .05 : .008;
            camera.getWorldDirection(_v); _b.copy(camera.position).addScaledVector(_v, 60); const oy = p.y + (m ? 1.45 : p.sneak ? 1.15 : 1.45);
            _b.sub(_a.set(p.x, oy, p.z)); _b.y += _b.length() * (.055 - pw * .03); _b.x += (Math.random() - .5) * sp * 60; _b.z += (Math.random() - .5) * sp * 60;
            shoot(p.x + _v.x * .5, oy, p.z + _v.z * .5, _b.x, _b.y, _b.z, 30 + pw * 34, 20 + pw * 26, player, perfect);
            S.inv.arrows--; sfx('bow'); refreshHot(); if (perfect) { sfx('perfect'); S.qd.perfect = 1; }
            bowFlash(perfect ? 'PERFECT' : over ? 'OVERDRAWN' : pw < .5 ? 'WEAK' : 'GOOD', perfect);
          }
          p.draw = 0;
        }
      }
    } else if (inp.lmbHit && !p.act) { startAct(tool === 'spear' ? 'thrust' : 'swing', tool === 'spear' ? .5 : tool === 'axe' ? .48 : .36); sfx('swing'); }
  }
  inp.lmbHit = false;
  if (p.foeT > 0 && (p.foeT -= dt) <= 0) p.foe = null;
  // survival
  S.food = Math.max(0, S.food - dt * .12 * (sprint ? 1.6 : 1)); S.water = Math.max(0, S.water - dt * .16 * (sprint ? 1.5 : 1));
  if (!S.food || !S.water) { S.hp -= dt * 1.2; if (S.hp <= 0 && p.alive) p.hurt(1); } else if (S.food > 35 && S.water > 35 && p.hurtT <= 0) S.hp = Math.min(100, S.hp + dt * .9);
  if (p.hurtT > 0) p.hurtT -= dt;
  // pose
  h.setHeld(p.build ? 'hammer' : p.act === 'eat' ? 'food' : tool === 'hands' ? null : tool);
  h.root.position.set(p.x, p.y, p.z); h.root.rotation.y = p.yaw; h.root.visible = !p.fp;
  h.pose(dt, { move: m ? 0 : p.v, sneak: p.sneak, air: !p.ground && !p.swim && !m, swim: p.swim, ride: !!m, act: p.act, k: p.actT / p.actDur, draw: p.drawing ? Math.max(.05, p.draw) : 0, pitch: p.cp * .8, emote: p.emote });
}
function updateCamera(dt) {
  const p = player, m = p.mount, cp = Math.cos(p.cp), fx = fwdX() * cp, fy = -Math.sin(p.cp), fz = fwdZ() * cp;
  const aim = p.drawing ? smooth(0, .5, p.draw) : 0, wantFov = 62 - aim * 14 + (p.v > 6 ? 5 : 0); camera.fov = lerp(camera.fov, wantFov, clamp(8 * dt, 0, 1)); camera.updateProjectionMatrix();
  camShake = Math.max(0, camShake - dt * .6); const sx = (Math.random() - .5) * camShake, sy = (Math.random() - .5) * camShake + (p.drawing && p.draw > 1 ? Math.sin(now * 40) * .012 : 0);
  if (p.fp) { camera.position.set(p.x + fx * .15, p.y + (p.sneak ? 1.2 : 1.62) * (p.human.root.scale.y) + sy, p.z + fz * .15); camera.lookAt(camera.position.x + fx, camera.position.y + fy, camera.position.z + fz); return; }
  const dist = (m ? 5.5 + m.sp.br * 4 : 4.3) * (1 - aim * .42), side = .55 + aim * .25, py = p.y + (m ? 2 : p.sneak ? 1.25 : 1.6);
  const px = p.x - fwdZ() * side, pz = p.z + fwdX() * side;
  let cx = px - fx * dist, cy = py - fy * dist, cz = pz - fz * dist; const g = Math.max(hAt(cx, cz), -.05) + .45; if (cy < g) cy = g;
  camera.position.set(cx + sx, cy + sy, cz); camera.lookAt(px + fx * 12, py + fy * 12, pz + fz * 12);
}
