#!/usr/bin/env node
// Headless driver for Amboola (single-file Three.js game in index.html).
//
//   node .claude/skills/run-amboola/driver.mjs shots [outDir] [stepsJSON]
//   node .claude/skills/run-amboola/driver.mjs bench
//
// - Serves the repo's files itself (no http server needed) at http://amboola.test/
// - Serves three.js from a local `npm pack` copy (the sandbox proxy breaks the jsdelivr CDN),
//   blocks Google Fonts (canvas/CSS fall back to system fonts).
// - Uses SwiftShader software WebGL: ~2 fps, so game time runs ~20x slower than wall time.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const THREE_VER = html.match(/three@([\d.]+)\/build/)[1];
const CACHE = process.env.AMBOOLA_CACHE || '/tmp/amboola-three';
const THREE_DIR = path.join(CACHE, 'package');
if (!fs.existsSync(path.join(THREE_DIR, 'build/three.module.js'))) {
  fs.mkdirSync(CACHE, { recursive: true });
  console.error(`[driver] fetching three@${THREE_VER} via npm pack…`);
  execSync(`npm pack three@${THREE_VER} --silent && tar xzf three-${THREE_VER}.tgz`, { cwd: CACHE, stdio: 'inherit' });
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.json': 'application/json' };
async function open(viewport = { width: 1280, height: 720 }) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport, deviceScaleFactor: +(process.env.AMBOOLA_DPR || 1) })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console.error: ' + m.text()); });
  await page.route(`https://cdn.jsdelivr.net/npm/three@${THREE_VER}/**`, r => {
    const p = new URL(r.request().url()).pathname.replace(`/npm/three@${THREE_VER}/`, '');
    r.fulfill({ path: path.join(THREE_DIR, p), contentType: 'application/javascript' });
  });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('http://amboola.test/**', r => {
    const p = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    fs.existsSync(p) ? r.fulfill({ path: p, contentType: MIME[path.extname(p)] || 'application/octet-stream' }) : r.fulfill({ status: 404 });
  });
  // the start-up car commercial would cover the garage; skip it unless AMBOOLA_AD=1
  if (!process.env.AMBOOLA_AD) await page.addInitScript(() => localStorage.setItem('amboola.noad', '1'));
  await page.goto('http://amboola.test/index.html');
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden') || /Error/.test(document.getElementById('loadmsg').textContent), null, { timeout: 180000 })
    .catch(e => { throw new Error('game never finished loading (a script error stops the module from running at all):\n' + errors.join('\n')); });
  const msg = await page.textContent('#loadmsg');
  if (msg !== 'Ready') throw new Error('load failed: ' + msg + '\n' + errors.join('\n'));
  return { browser, page, errors };
}

const mode = process.argv[2] || 'shots';
if (mode === 'shots') {
  const out = path.resolve(process.argv[3] || '/tmp/amboola-shots');
  // default flow: garage -> drive -> throttle -> handbrake drift -> hood cam -> pause
  const steps = JSON.parse(process.argv[4] || JSON.stringify([
    { shot: 'garage' }, { click: '#drive', wait: 2500, shot: 'drive' },
    { key: ['KeyW'], ms: 15000, shot: 'accel' }, { key: ['KeyW', 'KeyA', 'Space'], ms: 5000, shot: 'drift' },
    { press: 'KeyC' }, { press: 'KeyC', wait: 1500, shot: 'hood' }, { press: 'Escape', wait: 1000, shot: 'pause' },
  ]));
  fs.mkdirSync(out, { recursive: true });
  const [vw, vh] = (process.env.AMBOOLA_VIEWPORT || '1280x720').split('x').map(Number);
  const { browser, page, errors } = await open({ width: vw, height: vh });
  for (const st of steps) {
    if (st.car !== undefined) await page.evaluate(i => document.querySelector(`.caritem[data-i="${i}"]`).click(), st.car);
    if (st.click) await page.click(st.click);
    if (st.key) { for (const k of st.key) await page.keyboard.down(k); await page.waitForTimeout(st.ms || 1000); for (const k of st.key) await page.keyboard.up(k); }
    if (st.press) await page.keyboard.press(st.press);
    if (st.eval) console.log('eval', JSON.stringify(await page.evaluate(src => (0, eval)(src), st.eval.startsWith('@') ? fs.readFileSync(st.eval.slice(1), 'utf8') : st.eval)));
    await page.waitForTimeout(st.wait ?? 400);
    if (st.shot) { const f = path.join(out, st.shot + '.png'); await page.screenshot({ path: f }); console.log('shot', f); }
  }
  const p = await page.evaluate(() => { const p = window.amboola.player; return p ? { kmh: +(p.speed * 3.6).toFixed(1), gear: p.gear, rpm: Math.round(p.rpm), x: +p.x.toFixed(1), z: +p.z.toFixed(1) } : null; });
  console.log('player', JSON.stringify(p));
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
} else if (mode === 'bench') {
  // Fixed-timestep physics bench for every car (real-time rendering too slow headless).
  const { browser, page, errors } = await open({ width: 640, height: 360 });
  await page.click('#drive'); await page.waitForTimeout(500);
  const rows = await page.evaluate(() => {
    const A = window.amboola, P = A.player.constructor, out = [];
    for (const spec of A.CARS) {
      const p = Object.create(P.prototype); Object.assign(p, { spec, x: 0, z: 0, heading: 0, vx: 0, vz: 0, yawRate: 0, steer: 0, gear: 1, rpm: spec.idle, reverse: false, shiftT: 0, manual: false, throttle: 0 });
      const dt = 1 / 180; let t = 0, t100 = null, vmax = 0;
      for (let i = 0; i < 180 * 60; i++) { p.update(dt, { throttle: 1, brake: 0, steer: 0, handbrake: 0 }); t += dt; const k = p.speed * 3.6; if (!t100 && k >= 100) t100 = t; vmax = Math.max(vmax, k); }
      p.vx = 0; p.vz = 100 / 3.6; let d = 0; while (p.speed > .1 && d < 500) { const z0 = p.z; p.update(dt, { throttle: 0, brake: 1, steer: 0, handbrake: 0 }); d += p.z - z0; }
      out.push(`${spec.name.padEnd(24)} 0-100 ${t100?.toFixed(2)}s (spec ${spec.zero})  vmax ${vmax.toFixed(0)} (spec ${spec.vmax})  brake 100-0 ${d.toFixed(1)}m`);
    }
    return out;
  });
  console.log(rows.join('\n'));
  console.log(errors.length ? errors.join('\n') : 'no page errors');
  await browser.close();
} else { console.error('usage: driver.mjs shots [outDir] [stepsJSON] | bench'); process.exit(2); }
