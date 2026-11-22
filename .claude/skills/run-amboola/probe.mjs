// node .claude/skills/run-amboola/probe.mjs <repoRoot> <outLog> probes/a.js [probes/b.js …]  — loads the game (models and all, high quality, 640x360), then evaluates each probe file in turn and logs its result
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const [ROOT, OUT, ...FILES] = process.argv.slice(2);
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
for (const f of FILES) { errs = []; const t0 = Date.now(); const r = await page.evaluate(src => (0, eval)(src), fs.readFileSync(f, 'utf8')).catch(e => ({ harness: String(e).slice(0, 400) }));
  log(`${path.basename(f)} (${Math.round((Date.now() - t0) / 1000)} s): ${JSON.stringify(r, null, 1)}${errs.length ? '\n   ERRS: ' + [...new Set(errs)].slice(0, 8).join('\n   ') : ''}`); }
log('done'); await browser.close();
