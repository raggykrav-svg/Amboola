// ---------- people: one procedural rig for the player and the rival tribe
const BODY = [{ n: 'Slim', w: .88, d: .86, h: 1 }, { n: 'Athletic', w: 1, d: 1, h: 1 }, { n: 'Strong', w: 1.18, d: 1.1, h: 1.02 }, { n: 'Heavy', w: 1.24, d: 1.36, h: .98 }, { n: 'Compact', w: 1.06, d: 1.05, h: .9 }, { n: 'Tall', w: .95, d: .95, h: 1.1 }];
const SKIN = [0xf1c9a5, 0xe0ac7e, 0xc68a5c, 0xa0683f, 0x6f4426, 0x4a2c18];
const HAIR = ['Bald', 'Crop', 'Shag', 'Long', 'Mohawk', 'Topknot', 'Braids'];
const HAIRCOL = [0x1a1410, 0x3b2716, 0x6b4423, 0xa8703a, 0xd9b36a, 0x9a9a98, 0xc0392b, 0x2e86ab];
const BEARD = ['None', 'Stubble', 'Full', 'Braided'];
const PAINT = ['None', 'Ochre stripes', 'Chalk dots', 'River band', 'Blood mask'];
const OUTFIT = [
  { n: 'Hide Wrap', a: 0x8a6a45, b: 0x5e452c, kilt: 1, sash: 1 },
  { n: 'Fern Kilt', a: 0x4f7a35, b: 0x8a6a45, kilt: 2, top: 1 },
  { n: 'Bone Guard', a: 0x6b4f35, b: 0xe8dfc8, kilt: 1, pads: 1, top: 1 },
  { n: 'Ash Stalker', a: 0x26262b, b: 0x8d2f2f, kilt: 1, top: 1, cloak: 1, id: 'o3' },
  { n: 'Sun Dancer', a: 0xe8d8b0, b: 0xe0a030, kilt: 2, sash: 1, pads: 1, id: 'o4' },
  { n: 'Reef Runner', a: 0x1f8a8a, b: 0xf0e6d0, kilt: 1, top: 1, id: 'o5' },
  { n: 'Chieftain', a: 0x7a1f1f, b: 0xf0c040, kilt: 1, top: 1, pads: 1, cloak: 1, id: 'o6' },
  { n: 'Rival', a: 0xa8382c, b: 0xd8d0c0, kilt: 1, pads: 1, npc: 1 },
];
const BOWCOL = { null: [0x7a5a38, 0xe8dfc8], b_rime: [0x8fd3ff, 0xffffff], b_ember: [0xff7a2a, 0xffd27a] };
const HMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78 });

function makeHuman(look, bowSkin = null) {
  const B = BODY[look.body] || BODY[1], w = B.w, d = B.d, skin = SKIN[look.skin] ?? SKIN[2], O = OUTFIT[look.outfit] || OUTFIT[0], hc = HAIRCOL[look.hairCol] ?? HAIRCOL[0];
  const root = new THREE.Group(), J = {};
  const grp = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const mesh = (parent, parts) => { const m = new THREE.Mesh(merge(parts), HMAT); m.castShadow = true; parent.add(m); return m; };
  root.scale.setScalar(B.h);
  J.body = grp(root, 0, .92, 0);
  const pel = [part(G.box(.3 * w, .17, .2 * d), O.a), part(G.cyl(.172 * w, .172 * w, .05, 10), O.b, [0, .07, 0], null, [1, 1, d * .72])];
  if (O.kilt === 1) pel.push(part(G.cyl(.165 * w, .225 * w, .34, 10), O.a, [0, -.13, 0], null, [1, 1, d * .74], O.b));
  if (O.kilt === 2) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; pel.push(part(G.box(.085, .36, .02), i % 2 ? O.a : O.b, [Math.sin(a) * .19 * w, -.14, Math.cos(a) * .15 * d], [0, a, 0])); }
  mesh(J.body, pel);
  J.spine = grp(J.body, 0, .08, 0);
  const ch = [part(G.cap(.165, .22, 12), skin, [0, .3, 0], null, [w * 1.14, 1, d * .78]), part(G.cap(.14, .1, 10), skin, [0, .1, 0], null, [w * 1.05, 1, d * .8]), part(G.cyl(.055, .068, .13, 8), skin, [0, .57, 0]), part(G.sph(.075, 8, 6), skin, [.11 * w, .4, .085 * d], null, [1.1, .8, .6]), part(G.sph(.075, 8, 6), skin, [-.11 * w, .4, .085 * d], null, [1.1, .8, .6])];
  if (O.top) ch.push(part(G.cyl(.182, .165, .27, 12), O.a, [0, .31, 0], null, [w * 1.12, 1, d * .86], O.b));
  if (O.sash) ch.push(part(G.box(.075, .66, .025), O.b, [0, .27, .125 * d], [0, 0, .72]), part(G.box(.075, .66, .025), O.b, [0, .27, -.125 * d], [0, 0, -.72]));
  if (O.pads) { for (const s of [-1, 1]) ch.push(part(G.sph(.09, 8, 6), O.b, [s * .215 * w, .5, 0], null, [1.1, .65, 1.1])); for (let i = 0; i < 3; i++) ch.push(part(G.box(.2 * w, .025, .02), O.b, [0, .22 + i * .07, .135 * d])); }
  mesh(J.spine, ch);
  if (O.cloak) { J.cloak = grp(J.spine, 0, .52, -.13 * d); mesh(J.cloak, [part(G.box(.46 * w, .9, .025), O.a, [0, -.45, 0]), part(G.box(.46 * w, .06, .03), O.b, [0, -.88, 0])]); }
  // head, face, hair
  J.head = grp(J.spine, 0, .62, 0);
  const hd = [part(G.sph(.125, 14, 12), skin, [0, .1, 0], null, [.9, 1.06, .98]), part(G.sph(.09, 10, 8), skin, [0, .03, .02], null, [.9, .8, .95]), part(G.box(.026, .045, .034), skin, [0, .088, .122]), part(G.box(.052, .009, .01), 0x7a3a30, [0, .04, .112])];
  for (const s of [-1, 1]) hd.push(part(G.sph(.016, 8, 6), 0xf4f0e8, [s * .044, .118, .099], null, [1.25, .8, .6]), part(G.sph(.0095, 6, 5), 0x1c1410, [s * .044, .118, .106], null, [1, 1, .6]), part(G.box(.044, .012, .02), skin, [s * .044, .131, .104]), part(G.box(.046, .011, .014), hc, [s * .044, .146, .108], [0, 0, -s * .12]), part(G.sph(.022, 5, 4), skin, [s * .104, .1, 0], null, [.5, 1, .8]));
  const pc = [0, 0xd08a2a, 0xf4f0e8, 0x2e86ab, 0xa82020][look.paint] || 0;
  if (look.paint === 1) for (const s of [-1, 1]) for (let i = 0; i < 2; i++) hd.push(part(G.box(.034, .009, .01), pc, [s * .066, .082 - i * .02, .086], [0, s * .5, 0]));
  if (look.paint === 2) for (let i = -2; i <= 2; i++) hd.push(part(G.sph(.008, 5, 4), pc, [i * .03, .165 - Math.abs(i) * .006, .1 - Math.abs(i) * .008]));
  if (look.paint === 3) hd.push(part(G.box(.18, .022, .012), pc, [0, .086, .096]), part(G.box(.012, .022, .1), pc, [.098, .086, .05]), part(G.box(.012, .022, .1), pc, [-.098, .086, .05]));
  if (look.paint === 4) hd.push(part(G.box(.17, .05, .012), pc, [0, .12, .09]));
  const cap = () => part(G.sph(.132, 14, 10), hc, [0, .136, -.016], null, [.93, .8, 1]);
  if (look.hair === 1) hd.push(cap());
  if (look.hair === 2) { hd.push(cap()); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; hd.push(part(G.cone(.035, .1, 5), hc, [Math.sin(a) * .09, .16 - (i % 2) * .04, Math.cos(a) * .085 - .02], [Math.cos(a) * 1.9, 0, -Math.sin(a) * 1.9])); } }
  if (look.hair === 3) hd.push(cap(), part(G.box(.2, .3, .07), hc, [0, .02, -.085]), part(G.box(.04, .22, .09), hc, [.1, .04, -.02]), part(G.box(.04, .22, .09), hc, [-.1, .04, -.02]));
  if (look.hair === 4) for (let i = 0; i < 6; i++) hd.push(part(G.box(.03, .1 - Math.abs(i - 2) * .012, .05), hc, [0, .245 - i * i * .004, .07 - i * .04], [-.25 + i * .2, 0, 0]));
  if (look.hair === 5) hd.push(cap(), part(G.sph(.046, 7, 6), hc, [0, .255, -.035]), part(G.cyl(.02, .025, .04, 6), hc, [0, .225, -.03]));
  if (look.hair === 6) { hd.push(cap()); for (let i = 0; i < 6; i++) { const a = PI * .55 + i / 5 * PI * .9; hd.push(part(G.cyl(.016, .012, .26, 5), hc, [Math.cos(a) * .1, .0, Math.sin(a) * -.02 - .08], [.12, 0, 0])); } }
  if (look.beard === 1) hd.push(part(G.sph(.1, 10, 6), new THREE.Color(skin).lerp(new THREE.Color(hc), .45).getHex(), [0, .052, .012], null, [.92, .6, .95]));
  if (look.beard >= 2) hd.push(part(G.sph(.085, 9, 6), hc, [0, .028, .045], null, [1, .85, .75]));
  if (look.beard === 3) hd.push(part(G.cone(.035, .16, 6), hc, [0, -.08, .07], [PI, 0, 0]));
  mesh(J.head, hd);
  // limbs
  for (const [s, n] of [[1, 'L'], [-1, 'R']]) {
    const sh = J['sh' + n] = grp(J.spine, s * .215 * w, .47, 0);
    mesh(sh, [part(G.sph(.075 * w, 8, 6), skin), part(G.cap(.06 * w, .19, 8), skin, [0, -.14, 0])]);
    const elb = J['el' + n] = grp(sh, 0, -.28, 0);
    mesh(elb, [part(G.sph(.056 * w, 7, 6), skin), part(G.cap(.05 * w, .18, 8), skin, [0, -.125, 0]), part(G.cyl(.058 * w, .054 * w, .08, 8), O.b, [0, -.2, 0]), part(G.sph(.055, 8, 6), skin, [0, -.285, 0], null, [.75, 1.1, 1])]);
    J['hand' + n] = grp(elb, 0, -.275, 0);
    const hip = J['hip' + n] = grp(J.body, s * .09 * w, -.03, 0);
    mesh(hip, [part(G.cap(.09 * w, .26, 8), skin, [0, -.2, 0])]);
    const kn = J['kn' + n] = grp(hip, 0, -.43, 0);
    mesh(kn, [part(G.sph(.078 * w, 7, 6), skin), part(G.cap(.066 * w, .28, 8), skin, [0, -.2, 0]), part(G.box(.1, .07, .24), O.b, [0, -.425, .05]), part(G.cyl(.074 * w, .068 * w, .12, 8), O.b, [0, -.32, 0])]);
  }
  // things to hold
  const wd = 0x7a5a38, st = 0x8d8a84, bc = BOWCOL[bowSkin] || BOWCOL.null, held = {};
  const item = (hand, parts) => { const m = mesh(hand, parts); m.visible = false; return m; };
  held.axe = item(J.handR, [part(G.cyl(.016, .02, .56, 6), wd, [0, 0, .2], [PI / 2, 0, 0]), part(G.box(.035, .17, .11), st, [0, -.03, .43]), part(G.cyl(.028, .028, .05, 6), 0xc9b78a, [0, 0, .41], [PI / 2, 0, 0])]);
  held.spear = item(J.handR, [part(G.cyl(.016, .018, 1.9, 6), wd, [0, 0, .35], [PI / 2, 0, 0]), part(G.cone(.04, .22, 5), st, [0, 0, 1.4], [PI / 2, 0, 0]), part(G.cyl(.024, .024, .07, 6), 0xc9b78a, [0, 0, 1.27], [PI / 2, 0, 0])]);
  held.hammer = item(J.handR, [part(G.cyl(.018, .02, .46, 6), wd, [0, 0, .17], [PI / 2, 0, 0]), part(G.cyl(.07, .07, .2, 8), 0x9a7b55, [0, 0, .38], [0, 0, PI / 2])]);
  const bw = G.tor(.62, .016, 1.8); bw.rotateZ(-.9); bw.rotateX(PI / 2); bw.rotateZ(-PI / 2); bw.translate(0, .62, 0);
  const sy = .62 - .62 * Math.cos(.9), sl = .62 * Math.sin(.9) * 2;
  held.bow = item(J.handL, [part(bw, bc[0]), part(G.cyl(.004, .004, sl, 4), bc[1], [0, sy, 0], [PI / 2, 0, 0]), part(G.cyl(.022, .022, .12, 6), bc[1], [0, 0, 0], [PI / 2, 0, 0])]);
  held.food = item(J.handR, [part(G.sph(.06, 7, 6), 0x9a4a2a, [0, 0, .08], null, [1, .8, 1.4]), part(G.cyl(.012, .012, .12, 5), 0xe8dfc8, [0, 0, -.02], [PI / 2, 0, 0])]);
  const h = { root, J, held, look, ph: 0, show: null, setHeld(n) { if (this.show === n) return; this.show = n; for (const k in held) held[k].visible = k === n; }, pose };
  return h;
}
const HJ = ['body', 'spine', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'hipR', 'knR'];
// st: { move, sneak, air, swim, ride, act, k (0..1 through the action), draw, emote, pitch, dead }
function pose(dt, st) {
  const J = this.J, t = now; for (const n of HJ) J[n].rotation.set(0, 0, 0);
  let by = .92; const mv = clamp(st.move / 3.4, 0, 1.7);
  this.ph += st.move * dt * (st.sneak ? 3 : 2.25 - mv * .25); const s = Math.sin(this.ph), c = Math.cos(this.ph);
  // base: breathing + walk cycle
  J.spine.rotation.x = Math.sin(t * 1.5) * .015 + mv * .09; J.spine.rotation.y = s * .12 * mv;
  J.hipL.rotation.x = -s * .62 * mv; J.hipR.rotation.x = s * .62 * mv; J.knL.rotation.x = Math.max(0, c) * 1.1 * mv + .04; J.knR.rotation.x = Math.max(0, -c) * 1.1 * mv + .04;
  J.shL.rotation.x = s * .55 * mv; J.shR.rotation.x = -s * .55 * mv; J.shL.rotation.z = .07; J.shR.rotation.z = -.07; J.elL.rotation.x = -(.15 + .5 * mv); J.elR.rotation.x = -(.15 + .5 * mv);
  by += Math.abs(c) * .035 * mv;
  if (st.sneak) { by -= .2; J.spine.rotation.x += .5; J.head.rotation.x = -.35; for (const n of ['L', 'R']) { J['hip' + n].rotation.x -= .75; J['kn' + n].rotation.x += 1.1; } }
  if (st.air) { J.hipL.rotation.x = -.5; J.knL.rotation.x = .9; J.hipR.rotation.x = .15; J.knR.rotation.x = .5; J.shL.rotation.z = .9; J.shR.rotation.z = -.9; }
  if (st.swim) { J.body.rotation.x = 1.25; by = .35; const a = Math.sin(t * 4); J.shL.rotation.x = -2.6 + a * .7; J.shR.rotation.x = -2.6 - a * .7; J.hipL.rotation.x = a * .4; J.hipR.rotation.x = -a * .4; J.head.rotation.x = -.9; }
  if (st.ride) { by = .92; for (const [n, q] of [['L', 1], ['R', -1]]) { J['hip' + n].rotation.set(-1.15, 0, q * .55); J['kn' + n].rotation.x = 1.2; J['sh' + n].rotation.x = -.75; J['el' + n].rotation.x = -.5; } J.spine.rotation.x = .12 + mv * .06; }
  // actions on top
  const k = st.k || 0;
  if (st.act === 'swing') { const a = k < .35 ? lerp(-.6, -2.9, k / .35) : lerp(-2.9, -.35, smooth(.35, .7, k)); J.shR.rotation.x = a; J.elR.rotation.x = -.55; J.spine.rotation.y = k < .35 ? -.25 : .3; J.spine.rotation.x += k > .35 ? .22 : -.05; }
  if (st.act === 'thrust') { const a = k < .3 ? lerp(-.2, .55, k / .3) : lerp(.55, -1.25, smooth(.3, .55, k)); J.shR.rotation.x = a; J.elR.rotation.x = k < .3 ? -1.3 : lerp(-1.3, -.1, smooth(.3, .55, k)); J.spine.rotation.y = k < .3 ? -.4 : .35; J.spine.rotation.x += k > .3 ? .2 : 0; }
  if (st.act === 'pick') { J.spine.rotation.x = Math.sin(k * PI) * .95; J.shR.rotation.x = -Math.sin(k * PI) * 1.1; J.elR.rotation.x = -.2; }
  if (st.act === 'eat') { J.shR.rotation.x = -1.15; J.elR.rotation.x = -2.1 + Math.sin(k * PI * 6) * .12; J.head.rotation.x = .12; }
  if (st.act === 'pet') { J.shR.rotation.x = -1.25 + Math.sin(t * 7) * .16; J.elR.rotation.x = -.45; J.spine.rotation.x += .2; }
  if (st.draw > 0) { const p = st.pitch || 0; J.spine.rotation.y = .55; J.spine.rotation.x = 0; J.shL.rotation.set(-1.5 + p, 0, .55); J.elL.rotation.x = -.05; J.shR.rotation.set(-1.45 + p, 0, .25); J.elR.rotation.x = -lerp(.4, 2.25, clamp(st.draw, 0, 1)); J.head.rotation.y = -.5; }
  const e = st.emote;
  if (e === 'wave') { J.shR.rotation.set(0, 0, -2.55); J.elR.rotation.z = Math.sin(t * 9) * .55; J.head.rotation.z = Math.sin(t * 4.5) * .08; }
  if (e === 'cheer') { J.shL.rotation.set(0, 0, 2.7 + Math.sin(t * 12) * .15); J.shR.rotation.set(0, 0, -2.7 - Math.sin(t * 12) * .15); J.elL.rotation.x = J.elR.rotation.x = -.2; by += Math.abs(Math.sin(t * 7)) * .22; J.knL.rotation.x = J.knR.rotation.x = .3; J.hipL.rotation.x = J.hipR.rotation.x = -.15; }
  if (e === 'sit') { by = .32; for (const n of ['L', 'R']) { J['hip' + n].rotation.x = -1.5; J['kn' + n].rotation.x = 1.25; J['sh' + n].rotation.x = -.5; J['el' + n].rotation.x = -.9; } J.hipL.rotation.z = .25; J.hipR.rotation.z = -.25; J.spine.rotation.x = -.05; }
  if (e === 'point') { J.shR.rotation.set(-1.5, 0, -.1); J.elR.rotation.x = 0; J.spine.rotation.y = .2; }
  if (e === 'dance') { const a = Math.sin(t * 8), b = Math.sin(t * 4); by += Math.abs(a) * .07; J.body.rotation.y = b * .45; J.spine.rotation.z = b * .2; J.shL.rotation.set(0, 0, 1.6 + a * .9); J.shR.rotation.set(0, 0, -1.6 + a * .9); J.elL.rotation.z = 1; J.elR.rotation.z = -1; J.hipL.rotation.x = Math.max(0, b) * -.7; J.knL.rotation.x = Math.max(0, b) * 1.1; J.hipR.rotation.x = Math.max(0, -b) * -.7; J.knR.rotation.x = Math.max(0, -b) * 1.1; J.head.rotation.z = -b * .15; }
  if (e === 'flex') { const a = Math.sin(t * 5) * .12; J.shL.rotation.set(0, 0, 1.55); J.shR.rotation.set(0, 0, -1.55); J.elL.rotation.z = 2 + a; J.elR.rotation.z = -2 - a; J.spine.rotation.x = -.12; J.head.rotation.y = Math.sin(t * 2) * .4; }
  if (e === 'drum') { const a = Math.sin(t * 14); J.shL.rotation.x = -1 + Math.max(0, a) * .5; J.shR.rotation.x = -1 + Math.max(0, -a) * .5; J.elL.rotation.x = J.elR.rotation.x = -.9; by += Math.abs(a) * .02; J.head.rotation.x = Math.sin(t * 7) * .12; }
  J.body.position.y = by;
  if (J.cloak) J.cloak.rotation.x = .08 + mv * .35 + Math.sin(t * 2.2) * .04;
  // the spear stays level whatever the arm does
  this.held.spear.rotation.x = -(J.shR.rotation.x + J.elR.rotation.x) - J.spine.rotation.x + (st.pitch || 0) * .6;
}
