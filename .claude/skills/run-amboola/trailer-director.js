// In-page scene script for the Amboola trailer. Loaded by trailer.mjs; every call to window.__trailerStep()
// sets up/drives the current scene and advances the game by exactly one video frame (1/FPS s).
(() => {
  const A = window.amboola, FPS = window.__FPS || 24, DT = 1 / FPS, $ = id => document.getElementById(id);
  const P = () => A.player, idle = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  const carIdx = id => A.CARS.findIndex(c => c.id === id);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // ---------- captions ----------
  const st = document.createElement('style');
  st.textContent = `#toast,#help,#helpbtn,#chain,#raceprompt{display:none!important}
  #tcap{position:fixed;left:0;right:0;bottom:92px;z-index:60;text-align:center;pointer-events:none;font-family:Orbitron,sans-serif;color:#fff;text-shadow:0 3px 18px rgba(0,0,0,.9)}
  #tcap b{display:block;font-weight:900;font-size:44px;letter-spacing:.22em} #tcap small{display:block;margin-top:8px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:22px;letter-spacing:.32em;color:#ffb01f}
  #tcap.big{bottom:auto;top:40%} #tcap.big b{font-size:110px;letter-spacing:.2em;background:linear-gradient(90deg,#ff5a1f,#ffb01f);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 24px rgba(255,90,31,.5))}
  #tfade{position:fixed;inset:0;z-index:59;background:#000;pointer-events:none;opacity:0}`;
  document.head.appendChild(st);
  const cap = document.createElement('div'); cap.id = 'tcap'; document.body.appendChild(cap);
  const fade = document.createElement('div'); fade.id = 'tfade'; document.body.appendChild(fade);
  const setCap = (t, s, big) => { cap.className = big ? 'big' : ''; cap.innerHTML = t ? `<b>${t}</b>${s ? `<small>${s}</small>` : ''}` : ''; };
  // ---------- autopilots ----------
  let rt = { t: 0, pts: [] };
  const followRoute = (tx, tz, vmax) => { const p = P();
    if ((rt.t -= DT) <= 0) { rt.pts = A.taxiRoute(p.x, p.z, tx, tz); rt.t = .4; }
    const dist = Math.hypot(p.x - tx, p.z - tz); let wp = rt.pts.find(([a, b]) => Math.hypot(a - p.x, b - p.z) > 10) || [tx, tz]; if (dist < 30) wp = [tx, tz];
    const d = wrap(Math.atan2(wp[0] - p.x, wp[1] - p.z) - p.heading); let vT = Math.abs(d) > .5 ? 9 : vmax; if (dist < 40) vT = Math.max(0, (dist - 3) * .5);
    return { throttle: p.speed < vT ? 1 : 0, brake: p.speed > vT + 2 ? 1 : 0, steer: Math.max(-1, Math.min(1, -d * 2.2)), handbrake: 0 }; };
  const followPoly = (xs, zs, n, dir, vmax, lane = 0) => { const p = P(); let bi = 0, bd = 1e18;
    for (let i = 0; i < n; i += 2) { const d = (xs[i] - p.x) ** 2 + (zs[i] - p.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    const k = Math.max(0, Math.min(n - 1, bi + dir * (6 + Math.round(p.speed * .45)))), tx = xs[k], tz = zs[k];
    const d = wrap(Math.atan2(tx - p.x, tz - p.z) - p.heading); const vT = Math.abs(d) > .35 ? Math.max(12, vmax * .45) : vmax;
    return { throttle: p.speed < vT ? 1 : 0, brake: p.speed > vT + 3 ? 1 : 0, steer: Math.max(-1, Math.min(1, -d * 2.6)), handbrake: 0 }; };
  const raceDrive = () => { const p = P(), T = A.race.T, nr = A.trackNearest(T, p.x, p.z, -1), a = (nr.i + Math.round((12 + p.speed * .5) / T.step)) % T.n;
    const d = wrap(Math.atan2(T.x[a] - p.x, T.z[a] - p.z) - p.heading); let allow = 999;
    for (let k = 0; k < 150; k += 3) { const kk = Math.abs(T.k[(nr.i + k) % T.n]); if (kk < 2e-4) continue; const vc = Math.sqrt(9.81 * p.spec.grip * .95 / kk); allow = Math.min(allow, Math.sqrt(vc * vc + 2 * 9.81 * p.spec.grip * .8 * k * T.step)); }
    return { throttle: p.speed < allow ? 1 : 0, brake: p.speed > allow + 2 ? 1 : 0, steer: Math.max(-1, Math.min(1, -d * 3)), handbrake: 0 }; };
  let input = idle; window.__autoInput = () => input;
  const place = (x, z, h, v = 0) => { const p = P(); Object.assign(p, { x, z, heading: h, vx: Math.sin(h) * v, vz: Math.cos(h) * v, yawRate: 0, y: 0, slope: 0, reverse: false }); A.camPos.set(x - Math.sin(h) * 7, 2.6, z - Math.cos(h) * 7); };
  const garageCar = id => { A.selectCar(carIdx(id)); };
  const drive = id => { garageCar(id); A.startDrive(); };
  // ---------- scenes ----------
  const S = [
    { n: 60, enter() { $('menu').style.display = 'none'; garageCar('gt3rs'); setCap('AMBOOLA', 'TOKYO OPEN WORLD · 東京', true); } },
    ...[['gt3rs', 'PORSCHE 911 GT3 RS'], ['revuelto', 'LAMBORGHINI REVUELTO'], ['sf90', 'FERRARI SF90 STRADALE'], ['senna', 'McLAREN SENNA'], ['tourbillon', 'BUGATTI TOURBILLON'], ['cyberbeast', 'TESLA CYBERTRUCK'], ['cayennegt', 'PORSCHE CAYENNE TURBO GT'], ['918', 'PORSCHE 918 SPYDER']]
      .map(([id, name], i) => ({ n: 22, enter() { garageCar(id); setCap(name, i === 0 ? '47 CARS · 6 BRANDS' : 'PORSCHE · FERRARI · LAMBORGHINI · McLAREN · BUGATTI · TESLA'); } })),
    { n: 120, enter() { $('menu').style.display = ''; A.applyTime('sunset'); drive('gt3rs'); place(-5.7, 150, Math.PI, 8); A.camMode = 0; setCap('OPEN-WORLD TOKYO', 'NEON · TRAFFIC · SCRAMBLE CROSSING'); }, frame() { input = followRoute(-5.7, -700, 42); } },
    { n: 96, enter() { A.applyTime('night'); A.camMode = 1; place(-5.7, -60, Math.PI, 22); rt.t = 0; setCap('DAY · SUNSET · NIGHT', 'THE CITY LIGHTS UP'); }, frame() { input = followRoute(-5.7, -760, 40); } },
    { n: 80, enter() { A.applyTime('sunset'); A.camMode = 1; place(-2, 90, Math.PI, 24); setCap('DRIFT', 'SKILL CHAINS · SMOKE · SKID MARKS'); },
      frame(k) { input = k < 14 ? { throttle: 1, brake: 0, steer: 0, handbrake: 0 } : k < 34 ? { throttle: .7, brake: 0, steer: 1, handbrake: 1 } : { throttle: 1, brake: 0, steer: -.55, handbrake: 0 }; } },
    { n: 84, enter() { const M = A.MTN, i = Math.round(M.n * .45); A.applyTime('sunset'); A.camMode = 0; place(M.x[i], M.z[i], Math.atan2(M.tx[i], M.tz[i]), 20); P().y = M.y[i]; setCap('MT. AMBOOLA', 'DRIVE THE MOUNTAIN ROAD'); },
      frame() { const M = A.MTN; input = followPoly(M.x, M.z, M.n, 1, 26); } },
    { n: 132, enter() { const M = A.MTN, a = Math.atan2(-M.cz, -M.cx); A.applyTime('night'); place(M.cx + Math.cos(a) * 24, M.cz + Math.sin(a) * 24, Math.atan2(Math.cos(a), Math.sin(a))); P().y = M.plazaY; input = idle; A.vp.t = 5; setCap('208 m VIEWPOINT', 'THE WHOLE CITY BELOW YOU'); } },
    { n: 132, enter() { A.applyTime('day'); A.camMode = 0; A.startRace(A.TRACKS[0]); A.race.t = -1.6; setCap('6 RACE TRACKS', 'AI RIVALS · LAP TIMES · RECORDS'); },
      frame() { input = A.race && A.race.state !== 'countdown' ? raceDrive() : idle; }, exit() { window.__endRace && window.__endRace(); } },
    { n: 96, enter() { A.applyTime('sunset'); A.camMode = 0; place(-5.7, 150, Math.PI, 12); A.startTaxi(); setCap('TAXI JOBS', 'FOLLOW THE ARROWS ON THE ROAD'); },
      frame() { const s = A.taxi.spot; input = followRoute(s.x, s.z, 22); }, exit() { A.endTaxi(); } },
    { n: 132, enter() { A.applyTime('night'); A.startCrime('outlaw'); const c = A.crime, s = c.safes[0]; place(s.x, s.z + 1, 0, 0); window.__crimeT = 0; setCap('OUTLAW', 'STEAL THE MONEY · ESCAPE THE POLICE'); },
      frame(k) { const c = A.crime, p = P();
        if (k === 3) { c.cool = 0; }
        if (c.police.length && !c.__placed) { c.__placed = true; for (const [i, r] of c.police.entries()) r.place(p.x - Math.sin(p.heading) * (26 + i * 12), p.z - Math.cos(p.heading) * (26 + i * 12), p.heading); }
        const tgt = c.hide || A.HIDEOUTS[0]; input = k < 6 ? idle : followRoute(tgt.x, tgt.z, 24);
        const r = c.police[0]; window.__camHook = r ? (cam, dt) => { const hx = Math.sin(r.h), hz = Math.cos(r.h); cam.position.set(r.x - hx * 9 + hz * 2.5, 3.2, r.z - hz * 9 - hx * 2.5); cam.lookAt(p.x, 1, p.z); cam.fov = 55; cam.updateProjectionMatrix(); return true; } : null; },
      exit() { window.__camHook = null; A.endCrime(true); } },
    { n: 84, enter() { A.applyTime('sunset'); place(-5.7, 150, Math.PI); input = idle; A.openMap(); window.__q = 'shibuya'; setCap('MAP · SEARCH · GPS', 'FIND ANYWHERE · FAST TRAVEL'); },
      frame(k) { const i = $('bmSearch'); if (k % 5 === 0 && k / 5 <= window.__q.length) { i.value = window.__q.slice(0, k / 5); i.dispatchEvent(new Event('input')); } if (k === 55) document.querySelector('.bmRes')?.click(); },
      exit() { A.closeMap(); } },
    { n: 96, enter() { A.applyTime('night'); A.camMode = 1; place(-5.7, -40, Math.PI, 26); rt.t = 0; setCap('AMBOOLA', 'PLAY FREE IN YOUR BROWSER', true); }, frame() { input = followRoute(-5.7, -760, 40); } },
  ];
  window.__endRace = () => { if (A.race) { const b = document.getElementById('bLeave'); A.race && b && b.onclick && b.onclick(); } };
  let si = -1, k = 0; const total = S.reduce((a, s) => a + s.n, 0);
  window.__trailerTotal = total;
  window.__trailerStep = () => {
    if (si < 0 || k >= S[si].n) { if (si >= 0 && S[si].exit) S[si].exit(); si++; k = 0; if (si >= S.length) return { done: true }; S[si].enter(); }
    const sc = S[si]; if (sc.frame) sc.frame(k);
    // fade from/to black at the very start and end, captions fade in per scene
    const g = S.slice(0, si).reduce((a, s) => a + s.n, 0) + k; fade.style.opacity = g < 10 ? 1 - g / 10 : g > total - 14 ? (g - (total - 14)) / 14 : 0;
    cap.style.opacity = Math.min(1, k / 8, (sc.n - k) / 6);
    A.tick(DT); k++;
    return { done: false, scene: si, frame: g };
  };
})();
