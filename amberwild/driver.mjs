// Headless check: node amberwild/driver.mjs <outDir> ['<js to eval after boot>']
// Serves three.js from a local `npm pack` copy (/tmp/amboola-three), steps the game by hand and takes screenshots.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const dir = path.dirname(new URL(import.meta.url).pathname), out = process.argv[2] || '/tmp/amberwild-shots', T = '/tmp/amboola-three/package';
if (!fs.existsSync(T)) { fs.mkdirSync('/tmp/amboola-three', { recursive: true }); execSync('npm pack three@0.169.0 --silent && tar xzf three-0.169.0.tgz', { cwd: '/tmp/amboola-three' }); }
fs.mkdirSync(out, { recursive: true });
const [vw, vh] = (process.env.VIEWPORT || '1280x720').split('x').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: vw, height: vh }, hasTouch: !!process.env.TOUCH });
const errs = []; page.on('pageerror', e => errs.push(e.stack || e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
await page.route('https://cdn.jsdelivr.net/npm/three@0.169.0/**', r => r.fulfill({ path: path.join(T, new URL(r.request().url()).pathname.replace('/npm/three@0.169.0/', '')), contentType: 'text/javascript' }));
await page.route('https://fonts.g*/**', r => r.abort());
await page.route('http://aw.test/**', r => r.fulfill({ path: path.join(dir, 'index.html'), contentType: 'text/html' }));
await page.addInitScript(q => { window.__manual = true; window.__skipRender = true; if (q && !localStorage.getItem('amberwild.save.v1')) localStorage.setItem('amberwild.save.v1', JSON.stringify({ inv: {}, opt: { q, sens: 1, vol: .7 } })); }, process.env.Q || 'low');
await page.goto('http://aw.test/');
await page.waitForFunction(() => window.amberwild || document.querySelector('#loadT').textContent.startsWith('Could'), null, { timeout: 120000 });
console.log('boot:', await page.evaluate(() => window.amberwild ? 'ok' : document.querySelector('#loadT').textContent));
const steps = process.argv[3] ? JSON.parse(process.argv[3].startsWith('@') ? fs.readFileSync(process.argv[3].slice(1), 'utf8') : process.argv[3]) : [{ shot: 'title' }];
for (const s of steps) {
  if (s.click) await page.click(s.click);
  if (s.eval) console.log('eval', JSON.stringify(await page.evaluate(s.eval)));
  const n = s.ticks ?? 2; await page.evaluate(([n, dt]) => { window.__skipRender = true; for (let i = 0; i < n; i++) window.amberwild.tick(dt); window.__skipRender = false; window.amberwild.tick(dt); window.__skipRender = true; }, [n, s.dt || 1 / 30]);
  if (s.shot) { await page.screenshot({ timeout: 180000, path: path.join(out, s.shot + '.png') }); console.log('shot', path.join(out, s.shot + '.png')); }
}
console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close(); process.exit(errs.length ? 1 : 0);
