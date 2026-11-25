// Headless driver for Sumer (sumer/index.html): serves the repo, maps the jsDelivr URLs to local
// npm copies, runs a list of steps and saves screenshots.
// usage: node .claude/skills/run-sumer/driver.mjs <outDir> ['<json steps>'] [width height]
// env: Q=low|medium|high|ultra (graphics), DPR=2 (sharper pictures), TOUCH=1 (phone), SUMER_CACHE=dir
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { execSync } = require('child_process');
const pw = require(execSync('npm root -g').toString().trim() + '/playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const CACHE = process.env.SUMER_CACHE || '/tmp/sumer-cache';
const out = process.argv[2] || '/tmp/sumer-shots';
const DEFAULT = [
  { shot: 'title' },
  { eval: "__go(352, 196, -0.785, 0.02)" }, { eval: '__live(6)', shot: 'molos' },
  { eval: "__walk(['KeyW'], 3)" }, { eval: "__walk(['KeyW', 'ShiftLeft'], 2)" },
  { eval: "__go(352, 196, -0.785, -0.05, 'third')", shot: 'third' },
  { eval: "(() => { sumer.setTime('sunset'); return __go(352, 196, -0.3, 0.08); })()", shot: 'sunset' },
  { eval: "(() => { sumer.setTime('night'); return __go(46, -277, 0, 0.06); })()", shot: 'night' },
  { eval: "(() => { sumer.setTime('day'); return __drone(4060, 25, -1990, -2.3, -0.35); })()", shot: 'drone' },
  { eval: "(() => { sumer.openMap(); return 1; })()", wait: 10000, shot: 'map' },
];
const steps = process.argv[3] ? JSON.parse(process.argv[3]) : DEFAULT;
const W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720);
fs.mkdirSync(out, { recursive: true });

// local copies of the CDN modules
function pkg(name, ver) {
  const dir = path.join(CACHE, `${name}-${ver}`);
  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    fs.mkdirSync(dir, { recursive: true });
    const tgz = execSync(`npm pack ${name}@${ver} --silent`, { cwd: CACHE }).toString().trim().split('\n').pop();
    execSync(`tar xzf ${path.join(CACHE, tgz)} -C ${dir} --strip-components=1`);
  }
  return dir;
}
const THREE_DIR = pkg('three', '0.169.0'), EARCUT_DIR = pkg('earcut', '3.0.1');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gz': 'application/gzip', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +(process.env.DPR || 1), hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
await page.route('**/*', async (route) => {
  const url = route.request().url();
  let file = null;
  if (url.startsWith('http://sumer.test/')) file = path.join(ROOT, decodeURIComponent(new URL(url).pathname));
  else if (url.includes('cdn.jsdelivr.net/npm/three@0.169.0/')) file = path.join(THREE_DIR, url.split('three@0.169.0/')[1].split('?')[0]);
  else if (url.includes('cdn.jsdelivr.net/npm/earcut@3.0.1/')) file = path.join(EARCUT_DIR, url.split('earcut@3.0.1/')[1].split('?')[0]);
  else if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  if (!file) return route.abort();
  if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
  return route.fulfill({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
});
const t0 = Date.now();
await page.goto(`http://sumer.test/sumer/index.html?shots&q=${process.env.Q || 'medium'}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.sumer && window.sumer.state() === 'title', null, { timeout: 240000 }).catch((e) => errors.push('never reached the title: ' + e.message));
console.log('title after', ((Date.now() - t0) / 1000).toFixed(1), 's');
// stop the frame loop: the test steps the game itself (SwiftShader is too slow for real time)
await page.evaluate(fs.readFileSync(path.join(HERE, 'helpers.js'), 'utf8'));
for (const s of steps) {
  if (s.eval) {
    const code = s.eval.startsWith('@') ? fs.readFileSync(s.eval.slice(1), 'utf8') : s.eval;
    try { const v = await page.evaluate(code); if (v !== undefined) console.log('eval', JSON.stringify(v).slice(0, 1500)); } catch (e) { console.log('eval error', e.message.slice(0, 400)); }
  }
  if (s.press) await page.keyboard.press(s.press);
  await page.waitForTimeout(s.wait ?? 300);
  if (s.shot) {
    await page.evaluate(() => window.sumer.render());
    const f = `${out}/${s.shot}.png`;
    await page.screenshot({ path: f, timeout: 180000 });
    console.log('shot', f);
  }
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 30).join('\n') : 'no page errors');
console.log('total', ((Date.now() - t0) / 1000).toFixed(1), 's');
await browser.close();
process.exit(errors.length ? 1 : 0);
