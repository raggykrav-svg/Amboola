// In-page scene script for the Amboola trailer. Loaded by trailer.mjs; every call to window.__trailerStep()
// sets up/drives the current scene and advances the game by exactly one video frame (1/FPS s).
// window.__timeline() lists the frames where the soundtrack hits (cuts, drag-tree beeps, launches, impacts); it is
// computed from the scene table, so it is known before recording and matches the picture exactly.
(() => {
  const A = window.amboola, FPS = window.__FPS || 24, DT = 1 / FPS, $ = id => document.getElementById(id);
  // a car fresh from startDrive() has no .speed until its first physics step: default it so the autopilots never steer with NaN
  const P = () => { const p = A.player; if (p && !Number.isFinite(p.speed)) p.speed = Math.hypot(p.vx || 0, p.vz || 0); return p; }, idle = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const carIdx = id => A.CARS.findIndex(c => c.id === id), car = id => A.CARS[carIdx(id)];
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // ---------- overlays: captions, white flash, fade, Blender gallery ----------
  const st = document.createElement('style');
  st.textContent = `#toast,#help,#helpbtn,#chain,#raceprompt,#minimap,#maptag{display:none!important}
  #tcap{position:fixed;left:0;right:0;bottom:84px;z-index:60;text-align:center;pointer-events:none;font-family:Orbitron,sans-serif;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.95)}
  #tcap b{display:block;font-weight:900;font-size:46px;letter-spacing:.2em} #tcap small{display:block;margin-top:8px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:23px;letter-spacing:.3em;color:#ffb01f}
  #tcap em{display:block;margin-top:14px;font-style:normal;font-family:Rajdhani,sans-serif;font-weight:700;font-size:19px;letter-spacing:.24em;color:#fff}
  #tcap.top{bottom:auto;top:26px}
  #tcap.big{bottom:auto;top:36%} #tcap.big b{font-size:118px;letter-spacing:.18em;background:linear-gradient(90deg,#ff5a1f,#ffb01f);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 26px rgba(255,90,31,.55))}
  #tcap.go b{font-size:150px;color:#20ff40;text-shadow:0 0 40px #20ff40,0 0 90px #20ff40}
  #tfade,#tflash{position:fixed;inset:0;z-index:59;pointer-events:none;opacity:0} #tfade{background:#000} #tflash{background:#fff;z-index:61}
  #tgal{position:fixed;inset:0;z-index:58;background:#07080b;opacity:0;pointer-events:none;overflow:hidden} #tgal img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none}`;
  document.head.appendChild(st);
  const mk = id => { const e = document.createElement('div'); e.id = id; document.body.appendChild(e); return e; };
  const cap = mk('tcap'), fade = mk('tfade'), flash = mk('tflash'), gal = mk('tgal');
  const setCap = (t, s, cls = '', extra = '') => { cap.className = cls; cap.innerHTML = t ? `<b>${t}</b>${s ? `<small>${s}</small>` : ''}${extra ? `<em>${extra}</em>` : ''}` : ''; };
  let flashK = -1; const doFlash = () => { flashK = 0; };
  // ---------- autopilots ----------
  let rt = { t: 0, pts: [] };
  const followRoute = (tx, tz, vmax) => { const p = P();
    if ((rt.t -= DT) <= 0) { rt.pts = A.taxiRoute(p.x, p.z, tx, tz); rt.t = .4; }
    const dist = Math.hypot(p.x - tx, p.z - tz); let wp = rt.pts.find(([a, b]) => Math.hypot(a - p.x, b - p.z) > 10) || [tx, tz]; if (dist < 30) wp = [tx, tz];
    const d = wrap(Math.atan2(wp[0] - p.x, wp[1] - p.z) - p.heading); let vT = Math.abs(d) > .5 ? 9 : vmax; if (dist < 40) vT = Math.max(0, (dist - 3) * .5);
    return { throttle: p.speed < vT ? 1 : 0, brake: p.speed > vT + 2 ? 1 : 0, steer: clamp(-d * 2.2, -1, 1), handbrake: 0 }; };
  const followPoly = (xs, zs, n, dir, vmax) => { const p = P(); let bi = 0, bd = 1e18;
    for (let i = 0; i < n; i += 2) { const d = (xs[i] - p.x) ** 2 + (zs[i] - p.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    const k = clamp(bi + dir * (6 + Math.round(p.speed * .45)), 0, n - 1), d = wrap(Math.atan2(xs[k] - p.x, zs[k] - p.z) - p.heading), vT = Math.abs(d) > .35 ? Math.max(12, vmax * .45) : vmax;
    return { throttle: p.speed < vT ? 1 : 0, brake: p.speed > vT + 3 ? 1 : 0, steer: clamp(-d * 2.6, -1, 1), handbrake: 0 }; };
  const raceDrive = () => { const p = P(), T = A.race.T, nr = A.trackNearest(T, p.x, p.z, -1), a = (nr.i + Math.round((12 + p.speed * .5) / T.step)) % T.n;
    const d = wrap(Math.atan2(T.x[a] - p.x, T.z[a] - p.z) - p.heading); let allow = 999;
    for (let k = 0; k < 150; k += 3) { const kk = Math.abs(T.k[(nr.i + k) % T.n]); if (kk < 2e-4) continue; const vc = Math.sqrt(9.81 * p.spec.grip * .95 / kk); allow = Math.min(allow, Math.sqrt(vc * vc + 2 * 9.81 * p.spec.grip * .8 * k * T.step)); }
    return { throttle: p.speed < allow ? 1 : 0, brake: p.speed > allow + 2 ? 1 : 0, steer: clamp(-d * 3, -1, 1), handbrake: 0 }; };
  // drag: no throttle before the green (that would be a red light), flat out to the line, hold the lane, brake after
  const dragIn = () => { const p = P(), D = A.drag; if (!D) return idle;
    const steer = clamp((p.z - (A.DRAG.z - A.DRAG.lane)) * .25 - (p.vz || 0) * .08, -1, 1), done = D.p.total != null;
    return { throttle: D.state !== 'tree' && !done ? 1 : 0, brake: done ? .6 : 0, steer, handbrake: 0 }; };
  let input = idle; window.__autoInput = () => input;
  const place = (x, z, h, v = 0) => { const p = P(); Object.assign(p, { x, z, heading: h, vx: Math.sin(h) * v, vz: Math.cos(h) * v, yawRate: 0, y: 0, slope: 0, reverse: false }); A.camPos.set(x - Math.sin(h) * 7, 2.6, z - Math.cos(h) * 7); };
  const garageCar = id => A.selectCar(carIdx(id));
  const drive = id => { garageCar(id); A.startDrive(); P().manual = false; };
  const toGarage = () => { window.__camHook = null; $('bGarage').click(); $('results').classList.add('hidden'); };
  const leave = () => { window.__camHook = null; $('resLeave').click(); };
  const cam = (pos, look, fov = 50) => (c) => { c.position.set(...pos()); c.lookAt(...look()); c.fov = fov; c.updateProjectionMatrix(); return true; };
  // a drag run that starts `lead` seconds before the green
  const startDragAt = (me, rival, ev, lead) => { drive(me); A.startDrag(A.DRAG_EVENTS[ev], rival && car(rival)); A.drag.t = -lead; };
  const ffDrag = toGo => { for (let i = 0; i < 60 * 40 && A.drag && A.drag.p.d < A.drag.ev.dist - toGo; i++) { input = dragIn(); A.simStep(1 / 60, input); } };
  const G = s => Math.round(s * FPS);   // seconds -> frames
  const LAUNCH = 2.0;                     // seconds from scene start to the green light in the drag scenes
  const treeSfx = [[G(LAUNCH - 1.5), 'beep'], [G(LAUNCH - 1), 'beep'], [G(LAUNCH - .5), 'beep'], [G(LAUNCH), 'launch']];
  // ---------- scenes ----------
  const MONTAGE = [['gt3rs', 'PORSCHE 911 GT3 RS'], ['jesko', 'KOENIGSEGG JESKO'], ['revuelto', 'LAMBORGHINI REVUELTO'], ['sf90', 'FERRARI SF90'], ['senna', 'McLAREN SENNA'],
    ['tourbillon', 'BUGATTI TOURBILLON'], ['grsupra', 'TOYOTA GR SUPRA'], ['cyberbeast', 'TESLA CYBERTRUCK'], ['918', 'PORSCHE 918 SPYDER'], ['svj', 'AVENTADOR SVJ'], ['laferrari', 'LaFERRARI'],
    ['w1', 'McLAREN W1'], ['bolide', 'BUGATTI BOLIDE'], ['gemera', 'KOENIGSEGG GEMERA'], ['gryaris', 'TOYOTA GR YARIS'], ['roadster2', 'TESLA ROADSTER'], ['dakar', 'PORSCHE 911 DAKAR'], ['urusp', 'URUS PERFORMANTE']];
  const GALLERY = ['porsches', 'supercars', 'hypercars', 'koenigsegg-toyota', 'teslas', 'gt3rs'].map(n => `media/${n}-blender.jpg`);
  let decoded = 0; const imgs = GALLERY.map(src => { const im = new Image(); im.src = src; im.decode().then(() => decoded++); gal.appendChild(im); return im; });
  window.__trailerReady = () => decoded === imgs.length;
  const S = [
    // 1 · cold open: a drag launch, Jesko vs Chiron, camera in front of the cars
    { n: G(LAUNCH) + 30, sfx: treeSfx, enter() { $('menu').style.display = 'none'; A.applyTime('sunset'); startDragAt('jesko', 'chironss', 0, LAUNCH); setCap('READY?', '', 'big');
        const D = A.DRAG; window.__camHook = cam(() => [D.x0 + 19, 0.95, D.z + .6], () => [D.x0 + 1, 1.0, D.z], 52); },
      frame(k) { input = dragIn(); if (k === G(LAUNCH)) { setCap('GO!', '', 'big go'); doFlash(); } }, exit() { leave(); } },
    // 2 · title over the neon city
    { n: 64, sfx: [[0, 'impact']], enter() { drive('chironss'); A.applyTime('night'); A.camMode = 0; place(-5.7, -40, Math.PI, 32); rt.t = 0; doFlash(); setCap('AMBOOLA', 'TOKYO OPEN WORLD · 東京', 'big'); },
      frame() { input = followRoute(-5.7, -760, 44); } },
    // 3 · car montage in the garage, one car every 10 frames on the beat
    ...MONTAGE.map(([id, name], i) => ({ n: 10, sfx: i ? [] : [[0, 'whoosh']], enter() { if (i === 0) toGarage(); $('menu').style.display = 'none'; garageCar(id); i < 9 ? setCap(name, '59 CARS · 8 BRANDS', 'top') : setCap(name, 'PORSCHE · FERRARI · LAMBORGHINI · McLAREN', 'top', 'BUGATTI · KOENIGSEGG · TOYOTA · TESLA'); } })),
    // 4 · the Blender gallery
    ...GALLERY.map((img, i) => ({ n: 14, sfx: i ? [] : [[0, 'whoosh']], enter() { imgs.forEach((im, j) => im.style.display = j === i ? 'block' : 'none'); gal.style.opacity = 1; setCap(i < 3 ? 'BUILT IN BLENDER' : 'EVERY CAR · REAL 3D MODEL', 'MODELLED AT REAL SIZE · DRIVEN BY REAL SPECS'); },
      frame(k) { imgs[i].style.transform = `scale(${1.04 + k * .006})`; }, exit() { if (i === GALLERY.length - 1) gal.style.opacity = 0; } })),
    // 5 · the story: earn money, buy a Supra ...
    { n: 56, sfx: [[0, 'whoosh'], [24, 'cash']], enter() { $('menu').style.display = ''; garageCar('grsupra'); A.earn(80000); A.updateMenu(); setCap('EARN MONEY · BUY CARS', 'REAL PRICES · $30,000 GR86 → $5.8 MILLION BUGATTI'); },
      frame(k) { if (k === 24) A.garageGo(); } },
    // 6 · ... and upgrade it
    { n: 84, sfx: [[0, 'whoosh'], [14, 'cash'], [24, 'cash'], [34, 'cash'], [44, 'cash'], [54, 'cash']], enter() { A.earn(60000); A.updateMenu(); $('upgBtn').click(); setCap('UPGRADE YOUR CAR', 'ENGINE · TIRES · 5 LEVELS EACH', 'top'); },
      frame(k) { if (k >= 14 && k <= 54 && k % 10 === 4) document.querySelector(`#upgRows button[data-k="${(k - 14) % 20 ? 't' : 'e'}"]`)?.click(); },
      exit() { $('upgClose').click(); $('menu').style.display = 'none'; } },
    // 7 · drag race with the tuned Supra: chase cam at the launch, then trackside at the finish line, then the results
    { n: G(LAUNCH) + 50, sfx: [[0, 'whoosh'], ...treeSfx], enter() { A.applyTime('sunset'); startDragAt('grsupra', null, 0, LAUNCH); setCap('DRAG RACES', '¼ MILE · ½ MILE · LAUNCH ON THE GREEN');
        const D = A.DRAG; window.__camHook = cam(() => [P().x - 10, 1.25, D.z - .4], () => [P().x + 25, 1.0, D.z]); },
      frame(k) { input = dragIn(); if (k === G(LAUNCH)) doFlash(); } },
    { n: 34, sfx: [[0, 'whoosh'], [20, 'impact']], enter() { ffDrag(46); setCap('', ''); const D = A.DRAG, fx = D.x0 + A.drag.ev.dist + 4;
        window.__camHook = cam(() => [fx, 1.2, D.z - D.lane - 5.4], () => [P().x, .9, D.z]); }, frame() { input = dragIn(); } },
    { n: 52, sfx: [[0, 'cash']], enter() { window.__camHook = null; setCap('', ''); }, frame() { input = dragIn(); }, exit() { leave(); } },
    // 8 · open world
    { n: 76, sfx: [[0, 'whoosh']], enter() { drive('revuelto'); A.applyTime('sunset'); A.camMode = 0; place(-5.7, 150, Math.PI, 18); rt.t = 0; setCap('OPEN-WORLD TOKYO', 'NEON · TRAFFIC · DAY & NIGHT'); }, frame() { input = followRoute(-5.7, -700, 44); } },
    { n: 72, sfx: [[0, 'whoosh']], enter() { drive('gr86'); A.applyTime('sunset'); A.camMode = 1; place(-2, 90, Math.PI, 24); setCap('DRIFT', 'SKILL CHAINS PAY CASH'); },
      frame(k) { input = k < 12 ? { throttle: 1, brake: 0, steer: 0, handbrake: 0 } : k < 32 ? { throttle: .7, brake: 0, steer: 1, handbrake: 1 } : { throttle: 1, brake: 0, steer: -.55, handbrake: 0 }; } },
    { n: 110, sfx: [[0, 'whoosh']], enter() { drive('sf90'); A.applyTime('day'); A.camMode = 0; A.startRace(A.TRACKS[0]); A.race.t = -1.4; setCap('6 RACE TRACKS', 'AI RIVALS · LAP RECORDS · PRIZE MONEY'); },
      frame() { input = A.race && A.race.state !== 'countdown' ? raceDrive() : idle; }, exit() { leave(); } },
    // 9 · outlaw: crack a safe, the police come after you
    { n: 110, sfx: [[0, 'whoosh'], [6, 'siren']], enter() { drive('jesko'); A.applyTime('night'); A.camMode = 0; A.startCrime('outlaw'); const s = A.crime.safes[0]; place(s.x, s.z + 1, 0, 0); setCap('BE THE OUTLAW', 'CRACK SAFES · ESCAPE THE POLICE'); },
      frame(k) { const c = A.crime, p = P();
        if (k === 3) c.cool = 0;
        if (c.police.length && !c.__placed) { c.__placed = true; for (const [i, r] of c.police.entries()) r.place(p.x - Math.sin(p.heading) * (26 + i * 12), p.z - Math.cos(p.heading) * (26 + i * 12), p.heading); }
        const tgt = c.hide || A.HIDEOUTS[0]; input = k < 6 ? idle : followRoute(tgt.x, tgt.z, 26);
        const r = c.police[0]; window.__camHook = r ? (cm) => { const hx = Math.sin(r.h), hz = Math.cos(r.h); cm.position.set(r.x - hx * 9 + hz * 2.5, 3.2, r.z - hz * 9 - hx * 2.5); cm.lookAt(p.x, 1, p.z); cm.fov = 55; cm.updateProjectionMatrix(); return true; } : null; },
      exit() { window.__camHook = null; A.endCrime(true); } },
    // 10 · ... or be the police and chase him down
    { n: 96, sfx: [[0, 'whoosh'], [4, 'siren']], enter() { drive('modelsplaid'); A.applyTime('night'); A.camMode = 0; A.startCrime('police'); const o = A.crime.outlaw;
        place(o.x - Math.sin(o.h) * 22, o.z - Math.cos(o.h) * 22, o.h, 14); rt.t = 0; setCap('OR BE THE POLICE', 'CATCH THE OUTLAW · TAKE HIS CASH'); },
      frame() { const o = A.crime?.outlaw; input = o ? followRoute(o.x, o.z, 46) : idle; }, exit() { A.endCrime(true); } },
    // 11 · the mountain and the view
    { n: 72, sfx: [[0, 'whoosh']], enter() { drive('dakar'); const M = A.MTN, i = Math.round(M.n * .45); A.applyTime('sunset'); A.camMode = 0; place(M.x[i], M.z[i], Math.atan2(M.tx[i], M.tz[i]), 20); P().y = M.y[i]; setCap('MT. AMBOOLA', 'CLIMB THE MOUNTAIN ROAD'); },
      frame() { const M = A.MTN; input = followPoly(M.x, M.z, M.n, 1, 26); } },
    { n: 84, sfx: [[0, 'whoosh']], enter() { const M = A.MTN, a = Math.atan2(-M.cz, -M.cx); A.applyTime('night'); place(M.cx + Math.cos(a) * 24, M.cz + Math.sin(a) * 24, Math.atan2(Math.cos(a), Math.sin(a))); P().y = M.plazaY; input = idle; A.vp.t = 5; setCap('THE CITY BELOW YOU', '208 m VIEWPOINT'); } },
    // 12 · taxi + map
    { n: 64, sfx: [[0, 'whoosh']], enter() { drive('model3p'); A.applyTime('sunset'); A.camMode = 0; place(-5.7, 150, Math.PI, 12); A.startTaxi(); setCap('TAXI JOBS', 'PICK UP · DROP OFF · TIPS'); },
      frame() { const s = A.taxi.spot; input = followRoute(s.x, s.z, 22); }, exit() { A.endTaxi(); } },
    { n: 60, sfx: [[0, 'whoosh']], enter() { A.applyTime('sunset'); place(-5.7, 150, Math.PI); input = idle; A.openMap(); window.__q = 'shibuya'; setCap('MAP · SEARCH · GPS', 'FAST TRAVEL ANYWHERE'); },
      frame(k) { const i = $('bmSearch'); if (k % 4 === 0 && k / 4 <= window.__q.length) { i.value = window.__q.slice(0, k / 4); i.dispatchEvent(new Event('input')); } if (k === 40) document.querySelector('.bmRes')?.click(); },
      exit() { A.closeMap(); } },
    // 13 · end card
    { n: 120, sfx: [[0, 'impact']], enter() { drive('grsupra'); A.applyTime('night'); A.camMode = 0; place(-5.7, -40, Math.PI, 30); rt.t = 0; doFlash();
        setCap('AMBOOLA', 'PLAY FREE IN YOUR BROWSER · NO DOWNLOAD', 'big', '59 CARS · DRAG · RACES · DRIFT · TAXI · OUTLAW · POLICE'); },
      frame() { input = followRoute(-5.7, -760, 42); } },
  ];
  let si = (window.__startScene || 0) - 1, k = 0, jumped = si >= 0; const total = S.reduce((a, s) => a + s.n, 0);
  const startOf = i => S.slice(0, i).reduce((a, s) => a + s.n, 0);
  window.__trailerTotal = total; window.__sceneStart = startOf; window.__sceneCount = S.length;
  window.__timeline = () => ({ fps: FPS, total, scenes: S.map((s, i) => startOf(i)), title: startOf(1), end: startOf(S.length - 1),
    events: S.flatMap((s, i) => (s.sfx || []).map(([f, type]) => ({ f: startOf(i) + f, type }))) });
  window.__trailerStep = () => {
    if (jumped || si < 0 || k >= S[si].n) { if (!jumped && si >= 0 && S[si].exit) S[si].exit(); jumped = false; si++; k = 0; if (si >= S.length) return { done: true }; S[si].enter(); }
    const sc = S[si]; if (sc.frame) sc.frame(k);
    const g = startOf(si) + k;
    fade.style.opacity = g < 6 ? 1 - g / 6 : g > total - 18 ? (g - (total - 18)) / 18 : 0;
    flash.style.opacity = flashK >= 0 && flashK < 5 ? .85 * (1 - flashK / 5) : 0; if (flashK >= 0) flashK++;
    // captions punch in (scale down from 1.25) and fade out at the end of a scene
    const ca = Math.min(1, (k + 1) / 4, (sc.n - k) / 4); cap.style.opacity = ca; cap.style.transform = `scale(${1 + .25 * Math.max(0, 1 - k / 5)})`;
    A.tick(DT); k++;
    return { done: false, scene: si, frame: g };
  };
})();
