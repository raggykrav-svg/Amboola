// node sweep.mjs <repoRoot> <outLog> [only,comma]  — start every activity, drive it with an autopilot (rendering every 8th frame), end it,
// then check: page errors, NaN, the car still drives in free roam, leftover HUD, the camera near the car, state back to 'drive'
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const [ROOT, OUT, ONLY] = process.argv.slice(2);
const require = createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');
const V = '0.169.0', THREE_DIR = '/tmp/amboola-three/package';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
let errs = []; page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | '))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push('console.error ' + m.text().slice(0, 300)); });
await page.route(`https://cdn.jsdelivr.net/npm/three@${V}/**`, r => r.fulfill({ path: path.join(THREE_DIR, new URL(r.request().url()).pathname.replace(`/npm/three@${V}/`, '')), contentType: 'application/javascript' }));
await page.route('https://fonts.googleapis.com/**', r => r.abort());
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg' };
await page.route('http://amboola.test/**', r => { const p = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname)); fs.existsSync(p) ? r.fulfill({ path: p, contentType: MIME[path.extname(p)] || 'application/octet-stream' }) : r.fulfill({ status: 404 }); });
await page.addInitScript(() => { localStorage.setItem('amboola.noad', '1'); localStorage.setItem('amboola.fps60', '0'); localStorage.setItem('amboola.q', 'high'); });
await page.goto('http://amboola.test/index.html');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 240000 });
await page.evaluate(() => window.amboola.titlePlay());
await page.waitForFunction(() => window.amboola?.modelsDone, null, { timeout: 400000 }).catch(() => console.log('models not all done'));
page.setDefaultTimeout(900000);
const log = s => { console.log(s); fs.appendFileSync(OUT, s + '\n'); };
fs.writeFileSync(OUT, '');
await page.evaluate(() => { const A = window.amboola; A.wallet.usd = 5e7; A.CARS.forEach(c => A.wallet.owned.add(c.id)); A.startDrive(); window.__manualFrames = true;
  let t = 0; window.__auto = { throttle: .75, steer: 0 };
  window.__autoInput = () => { t++; const a = window.__auto; return { throttle: a.throttle, brake: a.brake || 0, steer: a.steer ?? Math.sin(t / 37) * .35, handbrake: false, nitro: false }; };
  const real = A.composer.render.bind(A.composer); window.__render = true; A.composer.render = (...x) => { if (window.__render) real(...x); };
  window.hudVis = () => [...document.querySelectorAll('[id]')].filter(e => { if (e.closest('#menu')) return false; const st = getComputedStyle(e); return e.offsetParent !== null && st.visibility !== 'hidden' && +st.opacity > .05 && e.getBoundingClientRect().width > 0; }).map(e => e.id);
  window.run = (n, every = 8) => { const out = { thrown: [], nan: 0 }; for (let i = 0; i < n; i++) { window.__render = i % every === 0; try { A.tick(1 / 20); } catch (e) { if (out.thrown.length < 3) out.thrown.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
      const p = A.player; if (p && ![p.x, p.z, p.vx, p.vz, p.heading].every(Number.isFinite)) out.nan++; } window.__render = true; return out; };
  for (let i = 0; i < 40; i++) A.tick(1 / 20); window.__base = new Set(window.hudVis()); });
const ACTS = [
  ['taxi', 'A.startTaxi()', 'A.endTaxi()'],
  ['outlaw', "A.startCrime('outlaw')", 'A.endCrime(true)'],
  ['police', "A.startCrime('police')", 'A.endCrime(true)'],
  ...[0, 1, 2, 3, 4].map(i => ['drag' + i, `A.startDrag(A.DRAG_EVENTS[${i}])`, 'A.endDrag(true)']),
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => ['track' + i, `A.TRACKS[${i}] && A.startRace(A.TRACKS[${i}])`, 'A.endRace(true)']),
  ['soccer', 'A.startSoccer()', 'A.endSoccer(true)'],
  ['monster', 'A.startMonster()', 'A.endMonster(true)'],
  ['tow', "A.startJob('tow')", 'A.endJob(true)'],
  ['fire', "A.startJob('fire')", 'A.endJob(true)'],
  ['lantern', 'A.startLantern()', 'A.endActs()'],
  ['king', 'A.startKing()', 'A.endActs()'],
  ['worldRace', 'A.startWorldRace()', 'A.endActs()'],
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['cRace' + i, `A.COUNTRIES[${i}] && A.startCRace(A.COUNTRIES[${i}])`, 'A.endActs()']),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['deliv' + i, `A.COUNTRIES[${i}] && A.startDeliv(A.COUNTRIES[${i}])`, 'A.endActs()']),
  ...Array.from({ length: 24 }, (_, i) => ['chal' + i, `A.CHALS[${i}] && A.chalStart(A.CHALS[${i}])`, "A.chal && A.chalEnd(null, 'quit')"]),
  ...[0, 1, 2, 3, 4].map(i => ['party' + i, `A.startPC(${i})`, 'A.endPC(true)']),
  ...[0, 1, 2].map(i => ['meet' + i, `A.MEETS[${i}] && (A.openMeet(A.MEETS[${i}]), document.querySelector('#meetList button[data-k]')?.click())`, 'A.meet && A.endMeetRace(false, true)']),
  ['troodosRace', "A.troOpen(); A.troGo('race')", 'A.troEnd(true)'],
  ['heli', "A.startHeli(A.CARS.find(c => c.heli))", 'A.endHeli()'],
  ['jet', "A.startFlight(A.CARS.find(c => c.jet && !c.heli))", 'A.endFlight()'],
  ['flyCar', 'A.startFlyCar()', 'A.flyLand()'],
  ['photo', 'A.startPhoto()', 'A.endPhoto()'],
  ['wash', 'A.startWash()', ''],
  ['refuel', 'A.refuel()', ''],
  ['crash', 'A.player.vx = 60; A.player.vz = 0; A.player.heading = Math.PI / 2', ''],
  ['foot', 'A.HOTELS[0] && A.footStart(A.HOTELS[0])', 'A.footEnd()'],
  ['map', 'A.openMap()', 'A.closeMap()'],
  ['future', 'A.futTravel(true)', 'A.futTravel(false)'],
];
const only = ONLY ? ONLY.split(',') : null;
for (const [name, start, end] of ACTS) {
  if (only && !only.includes(name)) continue;
  errs = [];
  const r = await page.evaluate(async ([start, end]) => {
    const A = window.amboola, res = {};
    const home = () => { const P = A.player; Object.assign(P, { x: -5.7, z: 150, heading: Math.PI, vx: 0, vz: 0, yawRate: 0, y: 0, air: false }); };
    try { if (A.foot) A.footEnd(true); } catch (e) { } if (A.state === 'drive') home();
    try { const v = eval(start); if (v && v.then) await Promise.race([v, new Promise(r => setTimeout(r, 60000))]); } catch (e) { return { startErr: String(e.stack || e).split('\n').slice(0, 3).join(' | ') }; }
    await new Promise(r => setTimeout(r, 300));
    res.st = A.state; const a = run(180, 20); res.thrown = a.thrown; res.nan = a.nan;
    const p = A.player; res.kmh = Math.round((p.speed || 0) * 3.6);
    res.camD = Math.round(Math.hypot(A.camera.position.x - p.x, A.camera.position.z - p.z));
    try { if (end) { const v = eval(end); if (v && v.then) await Promise.race([v, new Promise(r => setTimeout(r, 60000))]); } } catch (e) { res.endErr = String(e.stack || e).split('\n').slice(0, 3).join(' | '); }
    await new Promise(r => setTimeout(r, 300));
    const b = run(30, 15); if (b.thrown.length) res.thrownAfter = b.thrown;
    res.stAfter = A.state;
    if (A.state !== 'drive') { try { A.endActs(); A.startDrive(); run(10); } catch (e) { } res.forcedDrive = true; }
    // the car must still drive: brake to a stop, then 4 s of full throttle straight
    window.__auto = { throttle: 0, brake: 1, steer: 0 }; run(10, 40); try { if (A.foot) A.footEnd(true); } catch (e) { } home(); run(2, 40); const z0 = { x: A.player.x, z: A.player.z };
    window.__auto = { throttle: 1, steer: 0 }; const c = run(80, 40); window.__auto = { throttle: .75, steer: null }; delete window.__auto.steer;
    const P = A.player; res.drove = Math.round(Math.hypot(P.x - z0.x, P.z - z0.z)); if (c.thrown.length) res.thrownDrive = c.thrown;
    res.leftover = window.hudVis().filter(id => !window.__base.has(id)).slice(0, 12);
    res.ctxLost = !document.getElementById('ctxLost').classList.contains('hidden');
    res.busy = ['race', 'drag', 'taxi', 'crime', 'chal', 'pc', 'soccer', 'monster', 'job', 'roadRace', 'cRace', 'deliv', 'worldRace', 'meet', 'lantern', 'heli', 'flight', 'foot', 'storyRun'].filter(k => { try { return !!A[k]; } catch (e) { return false; } });
    return res;
  }, [start, end]).catch(e => ({ harness: String(e).slice(0, 300) }));
  log(`${name}: ${JSON.stringify(r)}${errs.length ? '\n   ERRS: ' + [...new Set(errs)].slice(0, 4).join('\n   ') : ''}`);
}
log('done');
await browser.close();
