#!/usr/bin/env node
// Headless driver for Villa Oliva (villa/index.html, a single-file Three.js walk-through).
//
//   node .claude/skills/run-villa/driver.mjs [outDir] [stepsJSON]
//
// - Serves the repo itself at http://villa.test/ and three.js from a local `npm pack` copy
//   (the sandbox proxy breaks the jsdelivr CDN for Chromium); Google Fonts are blocked.
// - SwiftShader software WebGL: a frame can take several seconds, so the page's own loop is paused and
//   every screenshot is rendered on demand (villa.step + villa.render).
// - Env: VILLA_Q=low|medium|high|ultra (default high), VILLA_VIEWPORT=1280x720, VILLA_TIME=17.8, VILLA_MOBILE=1
//
// Step fields (processed in this order): place, time, look, drone, eval, frames, shot
//   {"place": 0}            teleport to PLACES[0] and walk mode (0 living room, 1 kitchen, 2 atrium, ...)
//   {"time": 22.3}          set the time of day and refresh sky, shadows and the indoor probe
//   {"look": [yaw, pitch]}  point the camera
//   {"drone": {"yaw":0.6,"pitch":0.6,"dist":120}}   aerial view
//   {"eval": "js"}          run JS in the page (prints the result); "@path/file.js" runs a file
//   {"frames": 4}           simulate n frames of 1/30 s before the shot (default 3)
//   {"shot": "name"}        render and save <outDir>/name.png
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');

const html = fs.readFileSync(path.join(ROOT, 'villa/index.html'), 'utf8');
const THREE_VER = html.match(/three@([\d.]+)\/build/)[1];
const CACHE = process.env.AMBOOLA_CACHE || '/tmp/amboola-three';
const THREE_DIR = path.join(CACHE, 'package');
if (!fs.existsSync(path.join(THREE_DIR, 'build/three.module.js'))) {
  fs.mkdirSync(CACHE, { recursive: true });
  console.error(`[villa] fetching three@${THREE_VER} via npm pack…`);
  execSync(`npm pack three@${THREE_VER} --silent && tar xzf three-${THREE_VER}.tgz`, { cwd: CACHE, stdio: 'inherit' });
}
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json' };
const out = path.resolve(process.argv[2] || '/tmp/villa-shots');
const steps = JSON.parse(process.argv[3] || JSON.stringify([
  { shot: 'title' },
  { place: 0, shot: 'living' },
  { place: 6, shot: 'terrace' },
  { drone: { yaw: 0.55, pitch: 0.62, dist: 125 }, shot: 'aerial' },
  { time: 22.3, drone: { yaw: 0.55, pitch: 0.62, dist: 125 }, shot: 'aerial-night' },
]));
fs.mkdirSync(out, { recursive: true });
const [vw, vh] = (process.env.VILLA_VIEWPORT || '1280x720').split('x').map(Number);
const q = process.env.VILLA_Q || 'high';
const t0 = Date.now();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// VILLA_MOBILE=1: a touch phone (coarse pointer), so the joystick and touch buttons appear
const mobile = !!process.env.VILLA_MOBILE;
const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) })).newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource|GPU stall|GL_CLOSE_PATH|swiftshader|KHR_parallel_shader_compile/i.test(t)) errors.push(m.type() + ': ' + t); });
await page.route(`https://cdn.jsdelivr.net/npm/three@${THREE_VER}/**`, r => {
  const p = new URL(r.request().url()).pathname.replace(`/npm/three@${THREE_VER}/`, '');
  r.fulfill({ path: path.join(THREE_DIR, p), contentType: 'application/javascript' });
});
await page.route('https://fonts.googleapis.com/**', r => r.abort());
await page.route('http://villa.test/**', r => {
  const p = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
  fs.existsSync(p) ? r.fulfill({ path: p, contentType: MIME[path.extname(p)] || 'application/octet-stream' }) : r.fulfill({ status: 404 });
});
await page.goto(`http://villa.test/villa/index.html?test=1&q=${q}&t=${process.env.VILLA_TIME || 17.8}`);
try {
  await page.waitForFunction(() => window.villa?.ready || /Error/.test(document.getElementById('loadMsg')?.textContent || ''), null, { timeout: 900000, polling: 1000 });
} catch (e) { console.log(errors.join('\n')); throw e; }
const msg = await page.textContent('#loadMsg');
console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${msg}`);
if (msg !== 'Ready') { console.log(errors.join('\n')); await browser.close(); process.exit(1); }
await page.evaluate(() => window.villa.pause(true));

async function snap(f) {
  try { await page.screenshot({ path: f, timeout: 120000 }); }
  catch (e) {
    const cdp = await page.context().newCDPSession(page);
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(f, Buffer.from(r.data, 'base64')); await cdp.detach();
  }
}
for (const st of steps) {
  const ts = Date.now();
  if (st.eval && st.eval.startsWith('@')) st.eval = fs.readFileSync(st.eval.slice(1), 'utf8');   // {"eval": "@file.js"}
  const res = await page.evaluate(async st => {
    const V = window.villa, r = {};
    if (st.place !== undefined) {
      document.getElementById('title').classList.add('hidden'); document.getElementById('hud').classList.remove('hidden');
      document.getElementById('droneBar').classList.add('hidden');
      V.teleport(st.place); V.mode = 'walk';
    }
    if (st.time !== undefined) { V.setTime(st.time); V.refresh(); }
    if (st.look) V.look(st.look[0], st.look[1]);
    if (st.drone) { document.getElementById('title').classList.add('hidden'); V.enterDrone(); Object.assign(V.drone, st.drone, { auto: false }); }
    if (st.eval) r.eval = (0, eval)(st.eval);
    V.step(1 / 30, st.frames ?? 3);
    if (st.shot) { V.render(); r.stats = V.stats(); }
    return r;
  }, st);
  if (res.eval !== undefined) console.log('eval', JSON.stringify(res.eval));
  if (st.shot) {
    const f = path.join(out, st.shot + '.png'); await snap(f);
    console.log(`shot ${f} (${((Date.now() - ts) / 1000).toFixed(1)} s) ${JSON.stringify(res.stats)}`);
  }
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.some(e => e.startsWith('PAGEERROR')) ? 1 : 0);
