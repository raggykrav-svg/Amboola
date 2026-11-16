// ---------- the rival outpost, its warriors, and the trail of quests
const outpost = { x: POI.outpost[0], z: POI.outpost[1], y: 0, R: 17, ga: -PI / 2, gap: .2, alarm: false, canCapture: false, cap: 0, banners: [], gate: { alive: true, hp: 300, max: 300, hitR: 2.6, hitY: 1.8, name: 'Outpost gate', isGate: true } };
outpost.gate.hurt = function (dmg, from) {
  if (!this.alive) return; this.hp -= dmg; outpost.alarm = true; focusOn(this); floatText(this.x, this.y + 3, this.z, Math.round(dmg)); puff(this.x, this.y + 2, this.z, 0xc9a26a, 8, 4, 3); sfxAt('chop', this.x, this.z);
  if (this.hp <= 0) { this.alive = false; this.hp = 0; this.m.visible = false; for (let i = 0; i < 5; i++) puff(this.x, this.y + 1 + i * .6, this.z, 0x8a6a45, 14, 7, 5, 1.3); sfx('roar', .5); shake(.3); banner('THE GATE IS DOWN', 'Clear the outpost and claim the totem'); }
};
function ringBlocked(x, z, r) {
  const o = outpost, dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz); if (Math.abs(d - o.R) > .7 + r) return false;
  return o.gate.alive || Math.abs(angDiff(o.ga, Math.atan2(dx, dz))) > o.gap - r / o.R * .5;
}
function ringPush(p, r) {
  const o = outpost, dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), w = .55 + r; if (Math.abs(d - o.R) > w || d < .01) return;
  if (!o.gate.alive && Math.abs(angDiff(o.ga, Math.atan2(dx, dz))) < o.gap - r / o.R) return;
  const t = (d > o.R ? o.R + w : o.R - w) / d; p.x = o.x + dx * t; p.z = o.z + dz * t;
}
// waypoint through the gate when start and goal are on different sides of the wall
function ringPath(fx, fz, tx, tz) {
  const o = outpost, a = dist2(fx, fz, o.x, o.z) < o.R, b = dist2(tx, tz, o.x, o.z) < o.R; if (a === b) return null;
  const sx = Math.sin(o.ga), sz = Math.cos(o.ga), k1 = o.R + (a ? -3.5 : 3.5), k2 = o.R + (a ? 3.5 : -3.5), x1 = o.x + sx * k1, z1 = o.z + sz * k1;
  return dist2(fx, fz, x1, z1) > 2.5 && Math.abs(angDiff(o.ga, Math.atan2(fx - o.x, fz - o.z))) > .08 ? [x1, z1] : [o.x + sx * k2, o.z + sz * k2];
}
function buildOutpost() {
  const o = outpost, g = o.gate; o.y = hAt(o.x, o.z); const w1 = 0xa58462, w2 = 0x86684a, red = 0xc23a2e;
  const log = merge([part(G.cyl(.25, .29, 4.4, 6), w1, [0, 2.2, 0], null, null, w2), part(G.cone(.25, .6, 6), 0xc9b78a, [0, 4.7, 0])]);
  const n = 190, ring = new Inst(log, PMAT, n);
  for (let i = 0; i < n; i++) { const a = i / n * TAU; if (Math.abs(angDiff(o.ga, a)) < o.gap) continue; const x = o.x + Math.sin(a) * o.R, z = o.z + Math.cos(a) * o.R; ring.add(x, hAt(x, z) - .4, z, a * 7, 1, .9 + hash2(i, 3) * .25); }
  ring.m.instanceMatrix.needsUpdate = true;
  g.x = o.x + Math.sin(o.ga) * o.R; g.z = o.z + Math.cos(o.ga) * o.R; g.y = hAt(g.x, g.z);
  const gp = []; for (let i = 0; i < 12; i++) gp.push(part(G.cyl(.2, .22, 3.8, 6), i % 2 ? w1 : 0x8a6a45, [0, 1.9, -3.1 + i * .56])); gp.push(part(G.box(.3, .3, 6.8), w2, [.2, 2.9, 0]), part(G.box(.3, .3, 6.8), w2, [.2, 1, 0]), part(G.sph(.5, 8, 6), 0xe9e2d0, [-.35, 3.2, 0], null, [.9, 1, .8]));
  g.m = new THREE.Mesh(merge(gp), PMAT); g.m.position.set(g.x, g.y - .2, g.z); g.m.castShadow = true; scene.add(g.m);
  // huts, totem, platforms
  const hut = merge([part(G.cyl(2.3, 2.5, 2.2, 10), 0xb89a6a, [0, 1.1, 0], null, null, 0x8a6a45), part(G.cone(3.1, 2.6, 10), 0xc2a45c, [0, 3.5, 0], null, null, 0x8a7030), part(G.box(.9, 1.6, .2), 0x2a2018, [0, .8, 2.42])]);
  for (const [a, d, ry] of [[1.2, 9.5, -1.9], [2.6, 10, -.5], [.1, 10.5, PI]]) { const x = o.x + Math.sin(a) * d, z = o.z + Math.cos(a) * d, m = new THREE.Mesh(hut, PMAT); m.position.set(x, hAt(x, z) - .1, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); addNode({ t: 'hut', x, z, y: o.y, r: 2.5, alive: true, solid: true }); }
  const tp = [part(G.cyl(.5, .6, 1.3, 8), red, [0, .65, 0]), part(G.box(1.1, .9, 1), 0xe9e2d0, [0, 1.7, 0]), part(G.cyl(.5, .5, 1.2, 8), 0x2a2420, [0, 2.7, 0]), part(G.box(3.2, .5, .25), red, [0, 3.2, 0]), part(G.sph(.6, 8, 6), 0xe9e2d0, [0, 3.9, 0], null, [.85, 1, 1.2]), part(G.cone(.2, 1, 5), 0xe9e2d0, [.5, 4.5, 0], [0, 0, -.5]), part(G.cone(.2, 1, 5), 0xe9e2d0, [-.5, 4.5, 0], [0, 0, .5])];
  for (const s of [-1, 1]) tp.push(part(G.sph(.12, 6, 5), 0xffb02e, [s * .25, 1.8, .5]));
  const tm = new THREE.Mesh(merge(tp), PMAT); tm.position.set(o.x, o.y, o.z); tm.rotation.y = o.ga; tm.castShadow = true; scene.add(tm); addNode({ t: 'hut', x: o.x, z: o.z, y: o.y, r: .7, alive: true, solid: true });
  const plat = merge([part(G.box(2.6, .16, 2.6), w1, [0, 2.9, 0]), ...[[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].map(([x, z]) => part(G.cyl(.12, .14, 3.2, 6), w2, [x, 1.4, z]))]);
  o.plats = [o.ga - .55, o.ga + .55].map(a => { const x = o.x + Math.sin(a) * (o.R - 2.2), z = o.z + Math.cos(a) * (o.R - 2.2), m = new THREE.Mesh(plat, PMAT); m.position.set(x, hAt(x, z), z); m.rotation.y = a; m.castShadow = true; scene.add(m); return [x, z]; });
  const bm = new THREE.MeshStandardMaterial({ color: S.flags.outpost ? 0xffb02e : red, roughness: .8, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) { const a = o.ga + .35 + i * (TAU - .7) / 5, x = o.x + Math.sin(a) * (o.R + .1), z = o.z + Math.cos(a) * (o.R + .1), b = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.9), bm); b.position.set(x, hAt(x, z) + 5.6, z); b.rotation.y = a; scene.add(b); o.banners.push(b); const pole = new THREE.Mesh(G.cyl(.05, .05, 2.6, 5), PMAT); pole.position.set(x, hAt(x, z) + 5.4, z); scene.add(pole); }
  o.bm = bm;
  for (const a of [o.ga + 1.6, o.ga - 1.6]) { const x = o.x + Math.sin(a) * 6, z = o.z + Math.cos(a) * 6; addBuild({ t: 'fire', x, y: hAt(x, z), z, r: 0, fixed: true }); }
  if (S.flags.outpost) { g.alive = false; g.m.visible = false; return; }
  const r = rng(31), mk = (role, x, z, up = 0) => new Warrior(role, x, z, up, r);
  mk('chief', o.x + Math.sin(o.ga) * 4, o.z + Math.cos(o.ga) * 4);
  for (let i = 0; i < 5; i++) { const a = o.ga + (i - 2) * .32; mk('spear', o.x + Math.sin(a) * (o.R - 5), o.z + Math.cos(a) * (o.R - 5)); }
  for (const p of o.plats) mk('archer', p[0], p[1], 3);
}
class Warrior {
  constructor(role, x, z, up, r) {
    const chief = role === 'chief';
    Object.assign(this, { role, x, z, up, y: hAt(x, z) + up, yaw: outpost.ga, hp: chief ? 280 : role === 'archer' ? 60 : 85, alive: true, cd: 1 + r() * 2, v: 0, act: null, actT: 0, draw: 0, hitR: .45, hitY: 1, deadT: 0, name: chief ? 'Red Hand chief' : role === 'archer' ? 'Red Hand archer' : 'Red Hand warrior', sc: chief ? 1.22 : 1 });
    this.max = this.hp; this.human = makeHuman({ body: chief ? 2 : [0, 1, 4, 1][r() * 4 | 0], skin: r() * 6 | 0, hair: chief ? 4 : 1 + (r() * 6 | 0), hairCol: r() * 3 | 0, beard: chief ? 3 : r() * 3 | 0, outfit: chief ? 6 : 7, paint: 4 });
    this.human.root.scale.multiplyScalar(this.sc); this.human.setHeld(role === 'archer' ? 'bow' : 'spear'); scene.add(this.human.root); npcs.push(this);
  }
  headPos(out) { return out.set(this.x, this.y + 1.66 * this.sc, this.z); }
  hurt(dmg, from, head) {
    if (!this.alive) return; if (head) dmg *= 2; this.hp -= dmg; outpost.alarm = true; focusOn(this); floatText(this.x, this.y + 2, this.z, Math.round(dmg), head ? 'crit' : ''); puff(this.x, this.y + 1.2, this.z, 0xb01818, 6, 2.5, 2, .5); sfxAt('hit', this.x, this.z);
    if (this.hp <= 0) { this.alive = false; addAmber(this.role === 'chief' ? 300 : 40); if (player.foe === this) player.foe = null; if (this.role === 'chief') banner('THE CHIEF HAS FALLEN', ''); }
  }
  update(dt) {
    const h = this.human, o = outpost;
    if (!this.alive) { this.deadT += dt; h.root.rotation.x = lerp(h.root.rotation.x, -PI / 2, clamp(7 * dt, 0, 1)); h.root.position.y = this.y - this.up * Math.min(1, this.deadT * 2) + .15; if (this.deadT > 25) { scene.remove(h.root); npcs.splice(npcs.indexOf(this), 1); } return; }
    this.cd -= dt; this.v = 0; let t = null, td = 55;
    if (o.alarm) { if (player.alive && mode === 'play') { const d = dist2(this.x, this.z, player.x, player.z); if (d < td) { t = player; td = d; } } for (const d of dinos) if (d.tamed && d.alive && !d.rider) { const q = dist2(this.x, this.z, d.x, d.z); if (q < td - 4) { t = d; td = q; } } }
    if (this.act) { this.actT += dt; if (this.act === 'thrust' && !this.hitDone && this.actT > .28) { this.hitDone = true; if (t && td < 2.6 + (t.hitR || .4)) t.hurt(this.role === 'chief' ? 22 : 11, this); } if (this.actT > .55) this.act = null; }
    if (t) {
      const want = Math.atan2(t.x - this.x, t.z - this.z);
      if (this.role === 'archer') {
        this.yaw += clamp(angDiff(this.yaw, want), -5 * dt, 5 * dt);
        if (this.draw > 0) { this.draw += dt / .9; if (this.draw >= 1) { this.draw = 0; this.cd = 2.4 + Math.random() * 1.6; const oy = this.y + 1.5, ty = t.y + (t.hitY || 1) + (t === player && player.mount ? 1 : 0), d = td, sp = 36, lead = d / sp; shoot(this.x, oy, this.z, t.x + (t === player ? Math.sin(player.yaw) * player.v * lead * .7 : 0) - this.x + (Math.random() - .5) * d * .09, ty - oy + .5 * 11 * lead * lead + (Math.random() - .5) * d * .05, t.z + (t === player ? Math.cos(player.yaw) * player.v * lead * .7 : 0) - this.z + (Math.random() - .5) * d * .09, sp, 9, this, false); sfxAt('bow', this.x, this.z, 50); } }
        else if (this.cd <= 0 && td < 50) this.draw = .01;
      } else if (!o.gate.alive || dist2(t.x, t.z, o.x, o.z) < o.R) {
        const wp = ringPath(this.x, this.z, t.x, t.z), gx = wp ? wp[0] : t.x, gz = wp ? wp[1] : t.z, reach = 1.9 + (t.hitR || .4);
        this.yaw += clamp(angDiff(this.yaw, Math.atan2(gx - this.x, gz - this.z)), -7 * dt, 7 * dt);
        if (td > reach || wp) { const sp = this.role === 'chief' ? 3.9 : 4.6; this.x += Math.sin(this.yaw) * sp * dt; this.z += Math.cos(this.yaw) * sp * dt; this.v = sp; ringPush(this, .4); }
        else if (this.cd <= 0 && !this.act) { this.act = 'thrust'; this.actT = 0; this.hitDone = false; this.cd = 1.25 + Math.random() * .5; sfxAt('swing', this.x, this.z, 30); }
      } else this.yaw += clamp(angDiff(this.yaw, o.ga), -3 * dt, 3 * dt);
      for (const n of npcs) if (n !== this && n.alive && !n.up) { const dx = this.x - n.x, dz = this.z - n.z, d = Math.hypot(dx, dz); if (d < .9 && d > .01 && !this.up) { this.x += dx / d * (.9 - d) * .5; this.z += dz / d * (.9 - d) * .5; } }
    } else this.yaw += Math.sin(now * .4 + this.x) * .2 * dt;
    if (!this.up) this.y = hAt(this.x, this.z);
    h.root.position.set(this.x, this.y, this.z); h.root.rotation.y = this.yaw;
    h.pose(dt, { move: this.v, act: this.act, k: this.actT / .55, draw: this.draw, pitch: 0 });
  }
}
function updateOutpost(dt) {
  const o = outpost, d = dist2(player.x, player.z, o.x, o.z);
  for (let i = npcs.length - 1; i >= 0; i--) if (d < 230) npcs[i].update(dt);
  if (S.flags.outpost) return;
  if (!o.alarm && d < 36 && player.alive && !player.sneak) { o.alarm = true; sfx('bellow', .7); banner('THE RED HAND HAVE SEEN YOU', 'Break the gate. Trike horns and raptor jaws work best.'); }
  if (o.alarm && d > 120) o.alarm = false;
  o.canCapture = !o.gate.alive && !npcs.some(n => n.alive);
  if (o.canCapture && d < 4.5 && keys.KeyE || o.canCapture && d < 4.5 && inp.useHold) { o.cap += dt / 4; if (o.cap >= 1) { S.flags.outpost = true; o.bm.color.setHex(0xffb02e); addAmber(1200); if (!S.owned.includes('o6')) S.owned.push('o6'); banner('OUTPOST CLAIMED', 'The plateau is yours. Chieftain outfit unlocked.'); sfx('win'); save(); } } else o.cap = Math.max(0, o.cap - dt);
  // top-of-screen objective
  const ob = $('#obj');
  if (d < 95) { ob.hidden = false; const gate = o.gate.alive, left = npcs.filter(n => n.alive).length; $('#objT').textContent = gate ? 'RED HAND OUTPOST · BREACH THE GATE' : left ? `RED HAND OUTPOST · ${left} DEFENDER${left > 1 ? 'S' : ''} LEFT` : 'RED HAND OUTPOST · CLAIM THE TOTEM'; $('#objB').style.width = (gate ? (1 - o.gate.hp / o.gate.max) : left ? 1 - left / 8 : o.cap) * 100 + '%'; }
  else if (!bossNear) ob.hidden = true;
}
let bossNear = null;
function updateBoss() {
  const rex = dinos.find(d => d.sp.boss && d.alive), d = rex ? dist2(player.x, player.z, rex.x, rex.z) : 999, on = d < 75 && (rex.target || d < 55);
  if (on) { bossNear = rex; $('#obj').hidden = false; $('#objT').textContent = 'THE TYRANT'; $('#objB').style.width = rex.hp / rex.max * 100 + '%'; }
  else if (bossNear) { bossNear = null; $('#obj').hidden = true; }
}

const qb = k => S.qd['b_' + k] || 0;
const QUESTS = [
  { t: 'Scavenge the shore', d: 'Pick up sticks, stones and fern fibre around your camp. Press E next to them.', done: () => S.tools.axe || (S.inv.wood >= 3 && S.inv.stone >= 3 && S.inv.fibre >= 3), prog: () => `Wood ${Math.min(3, S.inv.wood)}/3 · Stone ${Math.min(3, S.inv.stone)}/3 · Fibre ${Math.min(3, S.inv.fibre)}/3`, amber: 30 },
  { t: 'Make a stone axe', d: 'Open your bag with Tab and craft a stone axe.', done: () => S.tools.axe, amber: 40 },
  { t: 'Arm yourself', d: 'Chop a tree for wood (key 2, then click), then craft a spear.', done: () => S.tools.spear, amber: 40 },
  { t: 'First hunt', d: 'Bring down a Compy, or anything braver, and harvest it with E.', done: () => S.qd.hunted, amber: 50 },
  { t: 'Fire and food', d: 'Press B, place a campfire, then cook your raw meat on it.', done: () => S.qd.cooked, amber: 60 },
  { t: 'A roof for the night', d: 'Build a floor, two walls, a roof and a bed.', done: () => qb('floor') >= 1 && qb('wall') + qb('door') >= 2 && qb('roof') >= 1 && qb('bed') >= 1, prog: () => `Floor ${Math.min(1, qb('floor'))}/1 · Walls ${Math.min(2, qb('wall') + qb('door'))}/2 · Roof ${Math.min(1, qb('roof'))}/1 · Bed ${Math.min(1, qb('bed'))}/1`, amber: 120 },
  { t: 'Bow hunter', d: 'Craft a bow and arrows. Hold the click to draw and let go inside the bright band.', done: () => S.qd.perfect, amber: 80 },
  { t: 'Make a friend', d: 'Wound a raptor until it is dazed, then feed it 3 raw meat with F.', done: () => S.qd.tamed, amber: 200 },
  { t: 'Saddle up', d: 'Craft a saddle, put it on your raptor and ride it.', done: () => S.qd.rode, amber: 150 },
  { t: 'Tribe rivalry', d: 'The Red Hand hold the eastern plateau. Break their gate and claim the totem.', done: () => S.flags.outpost, amber: 0, mark: POI.outpost },
  { t: 'The Tyrant', d: 'Something huge rules the ash basin in the west. Bring your pack.', done: () => S.flags.rex, amber: 0, mark: POI.rex },
];
let questT = 0;
function updateQuests(dt) {
  if ((questT -= dt) > 0) return; questT = .4; const q = QUESTS[S.quest];
  if (q && q.done()) { S.quest++; if (q.amber) addAmber(q.amber); banner('TRAIL COMPLETE', q.t); sfx('craft'); save(); }
  const n = QUESTS[S.quest];
  $('#questN').textContent = n ? `TRAIL ${S.quest + 1} / ${QUESTS.length}` : 'THE ISLAND IS YOURS'; $('#questT').textContent = n ? n.t : 'Free roam'; $('#questD').textContent = n ? n.d : 'Hunt, build, grow your pack. More amber waits in the volcano.'; $('#questP').textContent = n && n.prog ? n.prog() : '';
}
