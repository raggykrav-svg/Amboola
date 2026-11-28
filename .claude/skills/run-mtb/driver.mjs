#!/usr/bin/env node
// Headless driver for Amboola MTB (mtb/index.html, a single-file Three.js bike game).
//
//   node .claude/skills/run-mtb/driver.mjs [outDir] [stepsJSON]
//
// - Serves the repo at http://mtb.test/ and three.js from a local `npm pack` copy (the sandbox proxy
//   breaks the jsdelivr CDN for Chromium); Google Fonts are blocked.
// - SwiftShader software WebGL: a frame can take seconds, so the page's own loop is paused (?test=1)
//   and every screenshot is rendered on demand (mtb.step + mtb.render).
// - Env: MTB_Q=low|medium|high|ultra (default low), MTB_VIEWPORT=1280x720, MTB_VENUE=desert|forest|alpine,
//   MTB_MOBILE=1 (touch phone; use with MTB_VIEWPORT=390x844)
//
// Step fields (processed in this order): venue, eval, frames, shot
//   {"venue": "forest"}       load another venue (waits for it)
//   {"eval": "js"}            run JS in the page (prints the result); "@path/file.js" runs a file
//   {"frames": 4}             simulate n frames of 1/60 s (default 0)
//   {"shot": "name"}          render and save <outDir>/name.png
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');

const html = fs.readFileSync(path.join(ROOT, 'mtb/index.html'), 'utf8');
const THREE_VER = html.match(/three@([\d.]+)\/build/)[1];
const CACHE = process.env.AMBOOLA_CACHE || '/tmp/amboola-three';
const THREE_DIR = path.join(CACHE, 'package');
if (!fs.existsSync(path.join(THREE_DIR, 'build/three.module.js'))) {
  fs.mkdirSync(CACHE, { recursive: true });
  console.error(`[mtb] fetching three@${THREE_VER} via npm pack…`);
  execSync(`npm pack three@${THREE_VER} --silent && tar xzf three-${THREE_VER}.tgz`, { cwd: CACHE, stdio: 'inherit' });
}
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json' };
const out = path.resolve(process.argv[2] || '/tmp/mtb-shots');
const steps = JSON.parse(process.argv[3] || JSON.stringify([{ shot: 'title' }]));
fs.mkdirSync(out, { recursive: true });
const [vw, vh] = (process.env.MTB_VIEWPORT || '1280x720').split('x').map(Number);
const q = process.env.MTB_Q || 'low';
const t0 = Date.now();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const mobile = !!process.env.MTB_MOBILE;
const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) })).newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', m => { const t = m.text(); if (process.env.MTB_LOG) console.log('[page]', t); if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource|GPU stall|GL_CLOSE_PATH|swiftshader|KHR_parallel_shader_compile|ReadPixels/i.test(t)) errors.push(m.type() + ': ' + t); });
await page.route(`https://cdn.jsdelivr.net/npm/three@${THREE_VER}/**`, r => {
  const p = new URL(r.request().url()).pathname.replace(`/npm/three@${THREE_VER}/`, '');
  r.fulfill({ path: path.join(THREE_DIR, p), contentType: 'application/javascript' });
});
await page.route('https://fonts.googleapis.com/**', r => r.abort());
await page.route('https://fonts.gstatic.com/**', r => r.abort());
await page.route('http://mtb.test/**', r => {
  const p = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
  fs.existsSync(p) ? r.fulfill({ path: p, contentType: MIME[path.extname(p)] || 'application/octet-stream' }) : r.fulfill({ status: 404 });
});
await page.goto(`http://mtb.test/mtb/index.html?test=1&q=${q}&v=${process.env.MTB_VENUE || 'desert'}`);
const waitReady = async () => {
  const until = Date.now() + 900000;
  while (Date.now() < until) {
    if (errors.some(e => e.startsWith('PAGEERROR'))) { console.log(errors.join('\n')); await browser.close(); process.exit(1); }
    const ok = await page.evaluate(() => !!window.mtb?.ready || /Error/.test(document.getElementById('loadMsg')?.textContent || '')).catch(() => false);
    if (ok) return;
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('timed out waiting for the game\n' + errors.join('\n')); await browser.close(); process.exit(1);
};
await waitReady();
const msg = await page.textContent('#loadMsg');
console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${msg}`);
if (/Error/.test(msg)) { console.log(errors.join('\n')); await browser.close(); process.exit(1); }

async function snap(f) {
  try { await page.screenshot({ path: f, timeout: 180000 }); }
  catch (e) {
    const cdp = await page.context().newCDPSession(page);
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(f, Buffer.from(r.data, 'base64')); await cdp.detach();
  }
}
for (const st of steps) {
  const ts = Date.now();
  if (st.venue) {
    await page.evaluate(v => { window.mtb.ready = false; window.mtb.loadVenueUI(v); }, st.venue);
    await waitReady();
    console.log(`venue ${st.venue} in ${((Date.now() - ts) / 1000).toFixed(1)} s`);
  }
  if (st.eval && st.eval.startsWith('@')) st.eval = fs.readFileSync(st.eval.slice(1), 'utf8');
  const res = await page.evaluate(async st => {
    const V = window.mtb, r = {};
    if (st.eval) { r.eval = (0, eval)(st.eval); if (r.eval && typeof r.eval.then === 'function') r.eval = await r.eval; }
    if (st.frames) V.step(1 / 60, st.frames);
    if (st.shot) { V.render(); r.stats = V.stats ? V.stats() : null; }
    return r;
  }, st);
  if (res.eval !== undefined) console.log('eval', typeof res.eval === 'string' ? res.eval : JSON.stringify(res.eval));
  if (st.shot) {
    const f = path.join(out, st.shot + '.png'); await snap(f);
    console.log(`shot ${f} (${((Date.now() - ts) / 1000).toFixed(1)} s) ${JSON.stringify(res.stats)}`);
  }
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.some(e => e.startsWith('PAGEERROR')) ? 1 : 0);
