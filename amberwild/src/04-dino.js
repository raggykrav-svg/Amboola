// ---------- dinosaurs: procedural bodies, walk cycles and behaviour
const SPECIES = {
  compy: { name: 'Compy', biped: 1, bl: .5, br: .13, nl: .3, ns: 2, nUp: .9, hl: .2, hr: .07, tl: .8, ts: 4, leg: .4, legR: .04, arm: .12, col: 0x6f9a4a, belly: 0xdcd8a4, stripe: .25, hp: 18, spd: 5.3, turn: 6, dmg: 0, temper: 'skittish', sense: 12, drops: { meat: 1, feather: 2 }, voice: 'squeak', info: 'Tiny, nervous, quick. Easy meat and feathers if you can catch one.' },
  raptor: { name: 'Raptor', biped: 1, bl: 1.7, br: .47, nl: .95, ns: 3, nUp: .8, hl: .78, hr: .21, tl: 3, ts: 5, leg: 1.38, legR: .125, arm: .52, col: 0x8a5f38, belly: 0xdccba0, stripe: .3, feathers: 1, teeth: 1, hp: 110, spd: 9.2, turn: 4.5, dmg: 13, temper: 'aggro', sense: 26, drops: { meat: 3, hide: 2, feather: 3, bone: 1 }, tame: { food: 'meat', n: 3 }, ride: { spd: 11.5, bite: 24 }, voice: 'screech', info: 'Hunts in packs of three. Wear one down, feed it raw meat while it is dazed, and it will hunt for you.' },
  trike: { name: 'Triceratops', bl: 3.2, br: 1, nl: .6, ns: 1, nUp: .1, hl: 1.5, hr: .5, frill: 1, tl: 2.6, ts: 4, leg: 1.4, legR: .28, col: 0x8f7d5c, belly: 0xcdbb8c, stripe: 0, hp: 420, spd: 6, turn: 2.2, dmg: 28, temper: 'territorial', sense: 10, drops: { meat: 6, hide: 5, bone: 4 }, tame: { food: 'berries', n: 8 }, ride: { spd: 8.4, bite: 65 }, voice: 'bellow', info: 'Peaceful until crowded. A dazed one will take berries. Nothing breaks a gate faster.' },
  stego: { name: 'Stegosaurus', bl: 3.4, br: .95, nl: .9, ns: 2, nUp: -.25, hl: .6, hr: .2, plates: 1, tl: 3.2, ts: 5, leg: 1.25, legR: .26, col: 0x5f7a4a, belly: 0xb9b98a, stripe: .18, hp: 340, spd: 4.6, turn: 2, dmg: 24, temper: 'territorial', sense: 8, drops: { meat: 5, hide: 4, bone: 4 }, voice: 'bellow', info: 'Slow grazer with a spiked tail. Give it room.' },
  bronto: { name: 'Brachiosaurus', bl: 7, br: 2.1, nl: 8.5, ns: 6, nUp: 1.0, hl: 1.3, hr: .45, tl: 9, ts: 7, leg: 4.3, legR: .7, col: 0x7d8a8f, belly: 0xc3cbbc, stripe: .12, hp: 3000, spd: 2.6, turn: .7, dmg: 0, temper: 'gentle', sense: 0, drops: { meat: 20, hide: 12, bone: 10 }, voice: 'bellow', info: 'Walking hills that browse the lake shore. They ignore everything smaller than a tree.' },
  ptero: { name: 'Pteranodon', fly: 1, bl: .9, br: .22, nl: .5, ns: 2, nUp: .3, hl: .95, hr: .12, tl: .3, ts: 1, wing: 3.3, col: 0xb89a7a, belly: 0xe8dcc0, stripe: 0, hp: 35, spd: 11, temper: 'fly', drops: { feather: 5, hide: 1, meat: 1 }, voice: 'screech', info: 'Circles the cliffs and the volcano. A long bow shot brings one down.' },
  rex: { name: 'Tyrant', biped: 1, bl: 4.4, br: 1.25, nl: 1.6, ns: 2, nUp: .55, hl: 1.9, hr: .6, tl: 6, ts: 6, leg: 3.4, legR: .42, arm: .55, col: 0x4c4338, belly: 0xac9b78, stripe: .22, teeth: 1, hp: 1500, spd: 8.4, turn: 2.4, dmg: 38, temper: 'aggro', sense: 50, boss: 1, drops: { meat: 20, hide: 10, bone: 12 }, voice: 'roar', info: 'The ash basin west of the lake belongs to it. Bring a pack, arrows and a way out.' },
};
const SKINS = {
  s_bubble: { a: 0xf06aa8, b: 0xffd3e4, s: 0xffffff, dots: 5.5, dc: [0x35d0c0, 0xffe04a, 0xffffff, 0x7a5cff] },
  s_obsidian: { a: 0x17151a, b: 0x3a3238, s: 0xff6a1a },
  s_glacier: { a: 0x9fd4ef, b: 0xf2fbff, s: 0x2f6f9a },
};
const DMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72 }), DMAT2 = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide });
function skinFn(sp, skin) {
  const k = SKINS[skin], a = new THREE.Color(k ? k.a : sp.col), b = new THREE.Color(k ? k.b : sp.belly), s = k ? new THREE.Color(k.s) : a.clone().multiplyScalar(.4), f = 5.5 / (sp.br + .25), amt = k ? .9 : sp.stripe * 2.4;
  return (x, y, z, ny, out) => {
    out.copy(b).lerp(a, smooth(-.5, .25, ny));
    if (k && k.dots) { const h = hash2(Math.floor(x * k.dots / sp.br * .3) * 7 + Math.floor(y * k.dots / sp.br * .3) * 13, Math.floor(z * k.dots / sp.br * .3)); if (h > .74) out.set(k.dc[(h * 977 | 0) % k.dc.length]); }
    else if (amt && ny > -.3 && Math.sin(z * f + Math.sin(x * f * .7) * 1.3) > .5) out.lerp(s, amt);
  };
}
const PROTO = {};
function dinoProto(key, skin, hat, saddle) {
  const id = [key, skin, hat, saddle].join('|'); if (PROTO[id]) return PROTO[id];
  const sp = SPECIES[key], sk = skinFn(sp, skin), br = sp.br, bl = sp.bl, root = new THREE.Group(), bone = 0xece4cf, dark = 0x2a2420;
  const grp = (name, parent, x, y, z, rx = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); g.rotation.x = rx; g.userData.rx = rx; parent.add(g); return g; };
  const mesh = (parent, parts, mat = DMAT) => { const m = new THREE.Mesh(merge(parts), mat); m.castShadow = true; parent.add(m); return m; };
  const fwd = (r0, r1, L) => [part(G.sph(r0, 8, 6), sk), part(G.cyl(r1, r0, L, 8), sk, [0, 0, L / 2], [PI / 2, 0, 0])];
  const back = (r0, r1, L) => [part(G.sph(r0, 8, 6), sk), part(G.cyl(r1, r0, L, 8), sk, [0, 0, -L / 2], [-PI / 2, 0, 0])];
  const leg = sp.leg || 0, lr = sp.legR || 0;
  const hipY = sp.fly ? 0 : sp.biped ? .964 * leg + lr * .4 + br * .3 : .975 * leg + br * .35;
  const body = grp('body', root, 0, hipY, 0); body.userData.y = hipY;
  const bp = [part(G.sph(1, 14, 10), sk, null, null, [br, br * 1.02, bl / 2])];
  if (sp.biped) bp.push(part(G.sph(1, 10, 8), sk, [0, br * .1, bl * .3], null, [br * .82, br * .85, bl * .25]));
  if (sp.plates) for (let i = 0; i < 7; i++) { const z = bl * .42 - i * bl * .14, s = (1 - Math.abs(i - 3) * .2) * br; bp.push(part(G.cyl(.02, s * .55, s * 1.1, 4), 0xb5653a, [(i % 2 ? .12 : -.12) * br, br * .95 + s * .4, z], [0, PI / 4, 0], [.25, 1, 1], 0x7a4a2a)); }
  if (sp.feathers) for (let i = 0; i < 6; i++) bp.push(part(G.cone(.05, .3, 4), 0x2e2a26, [0, br * .95, bl * .3 - i * bl * .13], [-.9, 0, 0]));
  if (saddle) bp.push(part(G.box(br * 1.5, br * .22, bl * .36), 0x6a4426, [0, br * .98, 0]), part(G.box(br * 2.08, br * 1.1, bl * .1), 0x8a5a30, [0, br * .2, bl * .02]), part(G.box(br * 1.1, br * .3, bl * .06), 0x4a3020, [0, br * 1.12, -bl * .17]), part(G.box(br * 1.7, br * .08, bl * .46), 0xb03a2a, [0, br * .9, 0]));
  mesh(body, bp);
  // neck and head
  let par = body, r0 = br * (sp.biped ? .55 : .6); const nL = sp.nl / sp.ns;
  for (let i = 0; i < sp.ns; i++) { const r1 = lerp(r0, sp.hr * .95, 1 / (sp.ns - i)), g = grp('neck' + i, par, 0, i ? 0 : br * (sp.biped ? .32 : .1), i ? nL : bl * .4, -sp.nUp / sp.ns); mesh(g, fwd(r0, r1, nL)); par = g; r0 = r1; }
  const head = grp('head', par, 0, 0, nL, sp.nUp * .85), hl = sp.hl, hr = sp.hr;
  const hp = [part(G.sph(1, 10, 8), sk, [0, 0, hl * .25], null, [hr, hr * .95, hl * .42])];
  if (sp.fly) hp.push(part(G.cone(hr * .55, hl * .95, 6), 0xd8b070, [0, -hr * .1, hl * .95], [PI / 2, 0, 0], [.6, 1, 1]), part(G.cone(hr * .5, hl * .8, 5), 0xc2552d, [0, hr * .5, -hl * .2], [-PI / 2 - .5, 0, 0], [.35, 1, 1]));
  else hp.push(part(G.cyl(hr * .5, hr * .86, hl * .62, 8), sk, [0, hr * .05, hl * .68], [PI / 2, 0, 0], [1, 1, .82]), part(G.sph(hr * .5, 8, 6), sk, [0, hr * .05, hl * .98], null, [1, .8, .8]));
  for (const s of [-1, 1]) hp.push(part(G.sph(hr * .2, 6, 5), key === 'rex' ? 0xff8a1a : 0xf2c230, [s * hr * .78, hr * .42, hl * .34]), part(G.sph(hr * .1, 5, 4), dark, [s * hr * .9, hr * .44, hl * .4]), part(G.box(hr * .25, hr * .14, hr * .7), sk, [s * hr * .7, hr * .68, hl * .34], [0, 0, s * -.5]));
  if (sp.teeth) for (let i = 0; i < 7; i++) for (const s of [-1, 1]) hp.push(part(G.cone(hr * .07, hr * .26, 4), bone, [s * hr * (.62 - i * .03), -hr * .36, hl * (.42 + i * .085)], [PI, 0, 0]));
  if (sp.frill) { hp.push(part(G.sph(1, 12, 6), sk, [0, hr * 1.1, -hl * .12], [-.55, 0, 0], [hr * 2.1, hr * 2, hr * .22]), part(G.cone(hr * .34, hl * .5, 6), bone, [0, hr * .2, hl * 1.12], [PI / 2 + .25, 0, 0]), part(G.cone(hr * .16, hr * .9, 6), bone, [0, hr * .75, hl * .86], [.5, 0, 0])); for (const s of [-1, 1]) hp.push(part(G.cone(hr * .2, hl * .82, 6), bone, [s * hr * .55, hr * 1.25, hl * .62], [.95, 0, 0])); for (let i = 0; i < 7; i++) { const a = (i / 6 - .5) * 2.6; hp.push(part(G.cone(hr * .16, hr * .4, 4), bone, [Math.sin(a) * hr * 2, hr * 1.1 + Math.cos(a) * hr * 1.7, -hl * .12 - Math.cos(a) * hr * 1.05], [-.55, 0, -a])); } }
  if (sp.feathers) for (let i = 0; i < 5; i++) hp.push(part(G.box(.02, hr * (1.1 - i * .12), hr * .5), i % 2 ? 0xc0392b : 0xe8a020, [0, hr * 1.1, hl * .1 - i * hr * .32], [-.5, 0, 0]));
  if (key === 'rex') for (const s of [-1, 1]) hp.push(part(G.box(hr * .3, hr * .22, hr * .9), dark, [s * hr * .62, hr * .86, hl * .36], [0, 0, s * -.4]));
  if (hat === 'h_crown') for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; hp.push(part(G.cone(hr * .22, hr * .75, 4), i % 2 ? 0x5fa043 : 0x9bd05a, [Math.sin(a) * hr * .75, hr * 1.05, hl * .2 + Math.cos(a) * hr * .75], [Math.cos(a) * .5, 0, -Math.sin(a) * .5], [1, 1, .4])); }
  if (hat === 'h_helm') hp.push(part(G.sph(hr * 1.04, 10, 6), bone, [0, hr * .35, hl * .2], null, [1, .8, 1.25], 0xb8ae96), part(G.cone(hr * .2, hr * 1.1, 5), bone, [hr * .8, hr * 1.1, hl * .2], [0, 0, -.6]), part(G.cone(hr * .2, hr * 1.1, 5), bone, [-hr * .8, hr * 1.1, hl * .2], [0, 0, .6]));
  mesh(head, hp);
  if (!sp.fly) { const jaw = grp('jaw', head, 0, -hr * .32, hl * .12), jp = [part(G.cyl(hr * .36, hr * .66, hl * .82, 7), sk, [0, -hr * .12, hl * .42], [PI / 2, 0, 0], [1, 1, .42])]; if (sp.teeth) for (let i = 0; i < 6; i++) for (const s of [-1, 1]) jp.push(part(G.cone(hr * .06, hr * .2, 4), bone, [s * hr * (.5 - i * .03), hr * .08, hl * (.36 + i * .085)])); mesh(jaw, jp); }
  // tail
  par = body; r0 = br * (sp.biped ? .62 : .55); const tL = sp.tl / sp.ts;
  for (let i = 0; i < sp.ts; i++) {
    const r1 = lerp(r0, .02 + br * .03, 1 / (sp.ts - i)), g = grp('tail' + i, par, 0, i ? 0 : br * .08, i ? -tL : -bl * .4, i ? 0 : (sp.biped ? .1 : -.22)), tp = back(r0, r1, tL);
    if (sp.plates && i < 2) tp.push(part(G.cyl(.02, r0 * .7, r0 * 1.5, 4), 0xb5653a, [0, r0 * 1.3, -tL * .5], [0, PI / 4, 0], [.25, 1, 1]));
    if (sp.plates && i === sp.ts - 1) for (const s of [-1, 1]) for (const q of [.4, .8]) tp.push(part(G.cone(r0 * .5, br * .75, 5), bone, [s * br * .3, br * .12, -tL * q], [0, 0, -s * 1.25]));
    if (sp.feathers && i === sp.ts - 1) for (const s of [-1, 0, 1]) tp.push(part(G.box(.02, .04, tL * 1.1), s ? 0xc0392b : 0xe8a020, [s * .06, .02, -tL * .7], [0, s * .3, 0], [4, 1, 1]));
    mesh(g, tp); par = g; r0 = r1;
  }
  // legs
  const claw = 0x2a2420;
  if (sp.biped) for (const [s, n] of [[1, 'L'], [-1, 'R']]) {
    const hip = grp('hip' + n, body, s * br * .62, -br * .28, -bl * .04, -.55);
    mesh(hip, [part(G.sph(lr * 1.9, 7, 6), sk), part(G.cyl(lr * 1.7, lr * 1.05, leg * .42, 7), sk, [0, -leg * .21, 0])]);
    const kn = grp('kn' + n, hip, 0, -leg * .42, 0, 1.15); mesh(kn, [part(G.sph(lr * 1.05, 6, 5), sk), part(G.cyl(lr, lr * .62, leg * .4, 6), sk, [0, -leg * .2, 0])]);
    const an = grp('an' + n, kn, 0, -leg * .4, 0, -1);
    const fp = [part(G.cyl(lr * .62, lr * .55, leg * .3, 6), sk, [0, -leg * .15, 0]), part(G.box(lr * 2.6, lr * .7, lr * 4), sk, [0, -leg * .3, lr * 1.2], [.4, 0, 0])];
    for (const q of [-1, 0, 1]) fp.push(part(G.cone(lr * .32, lr * 1.3, 4), claw, [q * lr * .85, -leg * .3 + lr * .55, lr * 3.2], [PI / 2 + .4, 0, 0]));
    mesh(an, fp);
    if (sp.arm) { const arm = grp('arm' + n, body, s * br * .6, -br * .3, bl * .34, -.6), ap = [part(G.cyl(br * .13, br * .08, sp.arm, 5), sk, [0, -sp.arm / 2, 0]), part(G.cone(br * .07, sp.arm * .4, 4), claw, [0, -sp.arm, .03], [PI - .5, 0, 0])]; if (sp.feathers) ap.push(part(G.box(.02, sp.arm * 1.1, sp.arm * .7), 0xc0392b, [s * .04, -sp.arm * .5, -sp.arm * .35])); mesh(arm, ap, DMAT2); }
  } else if (!sp.fly) for (const [fz, f] of [[bl * .3, 'F'], [-bl * .3, 'B']]) for (const [s, n] of [[1, 'L'], [-1, 'R']]) {
    const hip = grp('hip' + f + n, body, s * br * .62, -br * .32, fz, f === 'F' ? .1 : -.2);
    mesh(hip, [part(G.sph(lr * 1.35, 7, 6), sk), part(G.cyl(lr * 1.25, lr, leg * .5, 7), sk, [0, -leg * .25, 0])]);
    const kn = grp('kn' + f + n, hip, 0, -leg * .5, 0, f === 'F' ? -.18 : .32);
    const fp = [part(G.sph(lr, 6, 5), sk), part(G.cyl(lr * .95, lr * 1.08, leg * .5, 7), sk, [0, -leg * .25, 0])]; for (const q of [-1, 0, 1]) fp.push(part(G.sph(lr * .3, 5, 4), claw, [q * lr * .6, -leg * .47, lr * .95]));
    mesh(kn, fp);
  }
  if (sp.fly) for (const [s, n] of [[1, 'L'], [-1, 'R']]) {
    const wg = grp('wing' + n, body, s * br * .6, br * .3, bl * .1), W = sp.wing, g = new THREE.BufferGeometry();
    const v = [0, 0, .45, s * W * .45, 0, .55, 0, 0, -.55, s * W * .45, 0, .55, s * W, 0, -.1, 0, 0, -.55, s * W * .45, 0, .55, s * W * .46, .03, .62, s * W, 0, -.1];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    mesh(wg, [part(g, 0xc9a882), part(G.cyl(.03, .045, W * .47, 5), sp.col, [s * W * .22, 0, .5], [0, 0, PI / 2])], DMAT2);
  }
  return PROTO[id] = { root, hipY };
}

let dinoSeq = 0;
const TAME_NAMES = ['Rook', 'Ember', 'Fen', 'Sable', 'Thorn', 'Juno', 'Moss', 'Kite', 'Brindle', 'Ash', 'Pip', 'Onyx', 'Wren', 'Tusk'];
class Dino {
  constructor(key, x, z, o = {}) {
    Object.assign(this, { key, sp: SPECIES[key], x, z, y: hAt(x, z), hx: x, hz: z, yaw: Math.random() * TAU, v: 0, hp: SPECIES[key].hp, max: SPECIES[key].hp, alive: true, state: 'idle', st: Math.random() * 3, cd: 0, target: null, tamed: false, saddle: false, stay: false, feed: 0, warn: 0, ph: Math.random() * 9, jaw: 0, jawT: 0, turnS: 0, seed: dinoSeq++ * 1.7, atk: 0, deadT: 0, loot: null, rider: false, name: SPECIES[key].name, vy: 0 }, o);
    if (this.sp.fly) { this.fa = Math.random() * TAU; this.fr = 35 + Math.random() * 40; this.alt = 26 + Math.random() * 22; }
    this.hitR = Math.max(this.sp.br * 1.2, this.sp.bl * .34); this.reach = this.sp.bl * .55 + this.sp.hl + .9; this.build(); dinos.push(this);
  }
  build() {
    if (this.root) scene.remove(this.root);
    const p = dinoProto(this.key, this.tamed ? S.equip.skin : null, this.tamed ? S.equip.hat : null, this.saddle);
    this.root = p.root.clone(); this.rig = {}; this.root.traverse(o => { if (o.name) this.rig[o.name] = o; }); this.hipY = p.hipY; this.hitY = this.sp.fly ? 0 : p.hipY;
    if (this.sp.boss) this.root.scale.setScalar(1); scene.add(this.root);
  }
  headPos(out) { return this.rig.head.getWorldPosition(out); }
  seatPos(out) { return this.rig.body.localToWorld(out.set(0, this.sp.br * 1.02, 0)); }
  hurt(dmg, from, head) {
    if (!this.alive) return; if (head) dmg *= 2; this.hp -= dmg; this.jawT = .5;
    floatText(this.x, this.y + this.hitY + this.sp.br + .4, this.z, Math.round(dmg), head ? 'crit' : ''); puff(this.x, this.y + this.hitY, this.z, 0xb01818, 6, 2.5, 2, .5); sfxAt('hit', this.x, this.z);
    focusOn(this);
    if (this.hp <= 0) return this.die(from);
    if (this.sp.tame && !this.tamed && this.state !== 'dazed' && this.hp < this.max * .35) { this.state = 'dazed'; this.st = 28; this.target = null; this.v = 0; if (from === player || (from && from.tamed)) tip(`The ${this.sp.name} is dazed. Feed it ${ITEM[this.sp.tame.food].toLowerCase()} with F to tame it.`); return; }
    if (this.tamed) { if (from && from !== player && from.alive) this.target = from; return; }
    const who = from && from.alive ? from : null;
    if (this.sp.temper === 'skittish' || this.sp.temper === 'gentle' || this.sp.temper === 'fly') { this.state = 'flee'; this.st = 6; } else if (who && this.state !== 'dazed') { this.target = who; this.state = 'chase'; this.st = 22; }
    if (this.sp.temper === 'aggro' && who) for (const d of dinos) if (d !== this && d.key === this.key && d.alive && !d.tamed && !d.target && d.state !== 'dazed' && dist2(d.x, d.z, this.x, this.z) < 30) { d.target = who; d.state = 'chase'; d.st = 22; }
  }
  die(from) {
    this.alive = false; this.hp = 0; this.v = 0; this.deadT = 0; this.loot = { ...this.sp.drops }; this.rider && dismount(true);
    sfxAt(this.sp.voice, this.x, this.z, 90);
    if (this.tamed) { S.tames = S.tames.filter(t => t.id !== this.tid); toast(`${this.name} has fallen`, 'bad'); }
    else if (from === player || (from && from.tamed) || from === 'spikes') { codex(this.key, 'kills'); const am = { compy: 4, raptor: 25, trike: 60, stego: 50, bronto: 150, ptero: 20, rex: 1500 }[this.key]; addAmber(am); if (this.sp.boss) { S.flags.rex = true; banner('TYRANT SLAIN', 'The ash basin is quiet. +1500 amber'); sfx('win'); } }
    if (player.foe === this) player.foe = null;
  }
  tame() {
    this.tamed = true; this.state = 'follow'; this.hp = this.max; this.target = null; this.tid = Date.now() + Math.random(); this.name = pick(TAME_NAMES.filter(n => !S.tames.some(t => t.name === n)).concat(['Scout']));
    S.tames.push({ id: this.tid, k: this.key, name: this.name, saddle: false }); codex(this.key, 'tamed'); S.qd.tamed = 1;
    this.build(); sfx('tame'); for (let i = 0; i < 4; i++) puff(this.x, this.y + this.hitY + 1, this.z, 0xff6a9a, 6, 2, 3, 1); banner(`${this.name} JOINED YOUR PACK`, `Tamed ${this.sp.name}. Press F to pet, Q to make the pack wait.`); save();
  }
  walkable(x, z) { if (Math.abs(x) > HALF - 20 || Math.abs(z) > HALF - 20) return false; const h = hAt(x, z); if (h < (this.sp.leg > 2 ? -1.6 : .2)) return false; if (h - this.y > 1.6 + this.sp.leg * .4) return false; return !ringBlocked(x, z, this.sp.br + .2); }
  move(tx, tz, speed, dt) {
    const d = angDiff(this.yaw, Math.atan2(tx - this.x, tz - this.z)), tr = this.sp.turn * dt; this.yaw += clamp(d, -tr, tr); this.turnS = lerp(this.turnS, clamp(d, -1, 1), 5 * dt);
    const v = speed * (Math.abs(d) > 1.3 ? .3 : 1), nx = this.x + Math.sin(this.yaw) * v * dt, nz = this.z + Math.cos(this.yaw) * v * dt;
    if (this.walkable(nx, nz)) { this.x = nx; this.z = nz; this.v = v; return true; } this.v = 0; return false;
  }
  update(dt) {
    const sp = this.sp, dp = dist2(this.x, this.z, player.x, player.z);
    this.root.visible = dp < 210 || this.key === 'bronto';
    if (!this.alive) return this.dead(dt);
    if (dp > 230 && !this.tamed) return;
    if (sp.fly) return this.flyUpdate(dt, dp);
    this.st -= dt; this.cd -= dt; this.v = 0; let t = this.target;
    if (t && (!t.alive || (t === player && (!player.alive || mode !== 'play')))) t = this.target = null;
    if (this.rider) { /* driven by the player */ }
    else if (this.state === 'dazed') { if (this.st <= 0) { this.state = 'flee'; this.st = 8; this.hp = Math.max(this.hp, this.max * .5); this.feed = 0; } }
    else if (this.tamed) {
      if (!t && player.foe && player.foe.alive && player.foe !== this && !player.foe.tamed && dist2(this.x, this.z, player.foe.x, player.foe.z) < 45) t = this.target = player.foe;
      if (t && dist2(t.x, t.z, player.x, player.z) > 70) t = this.target = null;
      if (t) this.fight(t, dt); else if (!this.stay) { if (dp > 110) { this.x = player.x - Math.sin(player.cy) * 6; this.z = player.z - Math.cos(player.cy) * 6; this.y = hAt(this.x, this.z); } else if (dp > 4.5 + sp.br * 2) this.move(player.x, player.z, dp > 12 ? sp.spd * 1.15 : sp.spd * .4, dt); }
    } else {
      const sense = sp.sense * (player.sneak ? .45 : 1) * (player.mount ? 1.2 : 1), see = player.alive && mode === 'play' && dp < sense && !player.swim;
      if (sp.temper === 'aggro' && !t && see && this.state !== 'flee') { t = this.target = player; this.state = 'chase'; this.st = 25; sfxAt(sp.voice, this.x, this.z, 110); if (sp.boss) banner('THE TYRANT HAS YOUR SCENT', ''); }
      if (sp.temper === 'territorial' && !t) { if (see) { this.warn += dt; this.yaw += clamp(angDiff(this.yaw, Math.atan2(player.x - this.x, player.z - this.z)), -2 * dt, 2 * dt); if (this.warn > .2 && this.jawT <= 0) { this.jawT = 1; sfxAt(sp.voice, this.x, this.z, 70); } if (this.warn > 3.2) { t = this.target = player; this.state = 'chase'; this.st = 14; } } else this.warn = Math.max(0, this.warn - dt); }
      if (sp.temper === 'skittish' && see && this.state !== 'flee') { this.state = 'flee'; this.st = 4; sfxAt('squeak', this.x, this.z, 30); }
      if (t) { if (this.st <= 0 || dist2(this.x, this.z, this.hx, this.hz) > 150) { this.target = null; this.state = 'wander'; this.st = 6; this.tx = this.hx; this.tz = this.hz; } else this.fight(t, dt); }
      else if (this.state === 'flee') { const a = Math.atan2(this.x - player.x, this.z - player.z) + Math.sin(now * 2 + this.seed) * .5; if (!this.move(this.x + Math.sin(a) * 10, this.z + Math.cos(a) * 10, sp.spd, dt)) this.yaw += 2.5 * dt; if (this.st <= 0) this.state = 'idle'; }
      else if (!(sp.temper === 'territorial' && this.warn > 0)) {
        if (this.st <= 0) { if (Math.random() < .45) { this.state = 'idle'; this.st = 2 + Math.random() * 5; } else { const a = Math.random() * TAU, d = 6 + Math.random() * 26; this.tx = this.hx + Math.sin(a) * d; this.tz = this.hz + Math.cos(a) * d; this.state = 'wander'; this.st = 5 + Math.random() * 6; } }
        if (this.state === 'wander') { if (dist2(this.x, this.z, this.tx, this.tz) < 1.5 || !this.move(this.tx, this.tz, sp.spd * .3, dt)) this.st = Math.min(this.st, .3); }
      }
    }
    this.y = lerp(this.y, hAt(this.x, this.z), clamp(12 * dt, 0, 1));
    this.animate(dt);
  }
  fight(t, dt) {
    const d = dist2(this.x, this.z, t.x, t.z), reach = this.reach + (t.hitR || .4);
    if (this.atk > 0) { this.atk -= dt; this.jawT = .3; if (this.atk <= .25 && !this.hitDone) { this.hitDone = true; if (d < reach + .9 && Math.abs(angDiff(this.yaw, Math.atan2(t.x - this.x, t.z - this.z))) < 1) t.hurt(this.tamed ? this.sp.dmg * 1.3 || 6 : this.sp.dmg, this); } return; }
    let gx = t.x, gz = t.z; const wp = ringPath(this.x, this.z, t.x, t.z); if (wp) { gx = wp[0]; gz = wp[1]; }
    if (d > reach * .85 || wp) { if (!this.move(gx, gz, this.sp.spd * (this.tamed ? 1.1 : 1), dt)) this.yaw += 1.5 * dt; }
    else this.yaw += clamp(angDiff(this.yaw, Math.atan2(t.x - this.x, t.z - this.z)), -this.sp.turn * dt, this.sp.turn * dt);
    if (d < reach && this.cd <= 0 && this.sp.dmg) { this.atk = .5; this.hitDone = false; this.cd = 1.3 + Math.random() * .5; if (Math.random() < .5) sfxAt(this.sp.voice, this.x, this.z, 70); }
  }
  flyUpdate(dt) {
    if (this.state === 'flee') { this.st -= dt; if (this.st <= 0) this.state = 'idle'; }
    this.fa += this.sp.spd / this.fr * dt * (this.state === 'flee' ? 1.6 : 1); const nx = this.hx + Math.sin(this.fa) * this.fr, nz = this.hz + Math.cos(this.fa) * this.fr;
    this.yaw = Math.atan2(nx - this.x, nz - this.z); this.x = nx; this.z = nz; this.y = Math.max(hAt(nx, nz) + 12, this.alt + Math.sin(now * .3 + this.seed) * 5);
    const r = this.rig, f = Math.sin(now * 4.5 + this.seed) * .5; r.wingL.rotation.z = f; r.wingR.rotation.z = -f;
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.set(0, this.yaw, -.35, 'YXZ');
  }
  dead(dt) {
    this.deadT += dt; const r = this.root;
    if (this.sp.fly && this.y > hAt(this.x, this.z) + .3) { this.vy -= 14 * dt; this.y = Math.max(hAt(this.x, this.z) + .3, this.y + this.vy * dt); r.rotation.z += 3 * dt; r.position.y = this.y; return; }
    r.rotation.z = lerp(r.rotation.z, 1.5, clamp(6 * dt, 0, 1)); r.position.y = this.y + Math.min(this.deadT, .5) * this.sp.br * .9;
    const gone = this.loot ? 150 : 3; if (this.deadT > gone) { r.scale.multiplyScalar(1 - 2.5 * dt); if (r.scale.x < .05) this.remove(); }
  }
  remove() { scene.remove(this.root); const i = dinos.indexOf(this); if (i >= 0) dinos.splice(i, 1); if (!this.tamed && !this.noRespawn) spawnLater.push([now + (this.sp.boss ? 900 : 240), this.key, this.hx, this.hz]); if (focus === this) focus = null; }
  animate(dt) {
    const r = this.rig, sp = this.sp, t = now + this.seed, leg = sp.leg;
    this.ph += this.v * dt * 2.3 / leg; const run = this.v / sp.spd, mv = clamp(run * 1.6, 0, 1.25), s = Math.sin(this.ph), c = Math.cos(this.ph), body = r.body;
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.set(0, this.yaw, this.state === 'dazed' ? Math.sin(t * 2.2) * .07 : 0);
    const lunge = this.atk > 0 ? Math.sin((1 - this.atk / .5) * PI) : 0;
    body.position.y = body.userData.y + Math.abs(s) * leg * .035 * mv - (this.state === 'dazed' ? leg * .12 : 0); body.position.z = lunge * sp.bl * .2;
    body.rotation.x = Math.sin(t * 1.2) * .012 + lunge * .18 + (sp.biped ? mv * .06 : 0); body.rotation.z = c * .03 * mv;
    if (sp.biped) for (const [n, q] of [['L', 1], ['R', -1]]) { const a = q * s, b = Math.max(0, q * c); r['hip' + n].rotation.x = -.55 - a * .62 * mv; r['kn' + n].rotation.x = 1.15 + b * .75 * mv - a * .1 * mv; r['an' + n].rotation.x = -1 - b * .45 * mv + a * .2 * mv; if (r['arm' + n]) r['arm' + n].rotation.x = -.6 + lunge * -.6 + Math.sin(t * 2 + q) * .05; }
    else for (const [n, q] of [['FL', 1], ['FR', -1], ['BL', -1], ['BR', 1]]) { const a = q * s, b = Math.max(0, q * c), h = r['hip' + n], k = r['kn' + n]; h.rotation.x = h.userData.rx - a * .42 * mv; k.rotation.x = k.userData.rx + b * .55 * mv; }
    for (let i = 0; i < sp.ts; i++) { const g = r['tail' + i]; g.rotation.y = Math.sin(t * 1.7 - i * .7) * (.05 + .09 * mv + (this.tamed && !this.v ? .08 : 0)) - this.turnS * .3; if (i) g.rotation.x = Math.sin(t * 1.1 - i * .5) * .025; }
    const idle = this.v < .1 && !this.target, low = this.state === 'dazed' ? .55 : 0;
    for (let i = 0; i < sp.ns; i++) { const g = r['neck' + i]; g.rotation.y = this.turnS * .25 + (idle ? Math.sin(t * .45) * .22 / sp.ns : 0); g.rotation.x = g.userData.rx + (low + (sp.temper === 'gentle' || !sp.biped ? Math.max(0, Math.sin(t * .22)) * (idle ? .5 : 0) : 0) + lunge * .25) / sp.ns - mv * .06; }
    r.head.rotation.x = r.head.userData.rx - lunge * .2; r.head.rotation.z = idle ? Math.sin(t * .8) * .08 : 0;
    this.jawT -= dt; this.jaw = lerp(this.jaw, this.jawT > 0 || lunge > .2 ? .75 : .04 + Math.max(0, Math.sin(t * 1.6)) * .05, clamp(14 * dt, 0, 1)); r.jaw.rotation.x = this.jaw;
  }
}
const spawnLater = [];
function spawnDinos() {
  const r = rng(404), land = (cx, cz, R, min = 1.2) => { for (let i = 0; i < 40; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R, x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, h = hAt(x, z); if (h > min && slopeAt(x, z) < .7 && biome(x, z) !== 'volc' && !ringBlocked(x, z, 22)) return [x, z]; } return null; };
  const some = (k, n, cx, cz, R) => { for (let i = 0; i < n; i++) { const p = land(cx, cz, R); if (p) new Dino(k, p[0], p[1]); } };
  some('compy', 6, POI.spawn[0], POI.spawn[1] - 30, 45); some('compy', 20, 0, 60, 250);
  for (const [x, z] of [[-70, 150], [110, 150], [-150, 60], [40, -60], [150, -110], [-40, 20]]) { const p = land(x, z, 30); if (p) some('raptor', 3, p[0], p[1], 9); }
  some('trike', 4, -20, 170, 60); some('trike', 4, 120, 60, 70); some('stego', 3, -110, 120, 60); some('stego', 3, 60, -40, 60);
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + .5; new Dino('bronto', POI.lake[0] + Math.sin(a) * 62, POI.lake[1] + Math.cos(a) * 62); }
  for (let i = 0; i < 9; i++) { const c = i < 4 ? POI.volcano : [Math.sin(i * 1.3) * 250, Math.cos(i * 1.3) * 250]; new Dino('ptero', c[0] + (r() - .5) * 40, c[1] + (r() - .5) * 40); }
  new Dino('rex', POI.rex[0], POI.rex[1]);
  for (const t of S.tames) { const d = new Dino(t.k, player.x + 3 + Math.random() * 3, player.z + 3, { tamed: true, saddle: t.saddle, name: t.name, tid: t.id, state: 'follow' }); d.build(); }
}
function updateDinos(dt) {
  for (let i = dinos.length - 1; i >= 0; i--) dinos[i].update(dt);
  // keep bodies from overlapping
  for (let i = 0; i < dinos.length; i++) { const a = dinos[i]; if (!a.alive || a.sp.fly || !a.root.visible) continue; for (let j = i + 1; j < dinos.length; j++) { const b = dinos[j]; if (!b.alive || b.sp.fly) continue; const dx = b.x - a.x, dz = b.z - a.z, m = (a.sp.br + b.sp.br) * 1.15, d = Math.hypot(dx, dz); if (d < m && d > .001) { const p = (m - d) / d * .5, wa = b.sp.br / (a.sp.br + b.sp.br), wb = 1 - wa; if (!a.rider) { a.x -= dx * p * wa; a.z -= dz * p * wa; } if (!b.rider) { b.x += dx * p * wb; b.z += dz * p * wb; } } } }
  for (let i = spawnLater.length - 1; i >= 0; i--) { const s = spawnLater[i]; if (s[0] < now && dist2(s[2], s[3], player.x, player.z) > 90) { new Dino(s[1], s[2], s[3]); spawnLater.splice(i, 1); } }
}
function codex(k, f) { const c = S.codex[k] || (S.codex[k] = { seen: 1, kills: 0, tamed: 0 }); if (f) c[f]++; }
