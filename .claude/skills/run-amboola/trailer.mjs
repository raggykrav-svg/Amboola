#!/usr/bin/env node
// Record the Amboola trailer: steps the game frame-by-frame (deterministic, so SwiftShader's ~2 fps doesn't matter),
// screenshots every frame and encodes an H.264 MP4 with ffmpeg.
//   node .claude/skills/run-amboola/trailer.mjs [out.mp4]      (env FFMPEG=/path/to/ffmpeg, FPS=24)
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const require = createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || '/tmp/amboola-trailer.mp4'), FPS = +(process.env.FPS || 24), FRAMES = '/tmp/amboola-frames';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), V = html.match(/three@([\d.]+)\/build/)[1], THREE_DIR = `/tmp/amboola-three/package`;
if (!fs.existsSync(THREE_DIR)) execSync(`mkdir -p /tmp/amboola-three && cd /tmp/amboola-three && npm pack three@${V} --silent && tar xzf three-${V}.tgz`);
// SCENE=i re-records only scene i onwards over an existing frame folder (e.g. to fix one shot)
const SCENE = +(process.env.SCENE || 0);
if (!SCENE) fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.addInitScript(() => { localStorage.setItem('amboola.helped', '1'); localStorage.setItem('amboola.q', 'high'); localStorage.setItem('amboola.car', '0'); });
await page.route(`https://cdn.jsdelivr.net/npm/three@${V}/**`, r => r.fulfill({ path: path.join(THREE_DIR, new URL(r.request().url()).pathname.replace(`/npm/three@${V}/`, '')), contentType: 'application/javascript' }));
// fonts: fetched with curl (the headless browser can't reach Google Fonts through the sandbox proxy)
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => { try { const body = execFileSync('curl', ['-sS', '--max-time', '20', r.request().url()], { maxBuffer: 1 << 26 }); r.fulfill({ body, contentType: r.request().url().includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); } catch { r.abort(); } });
await page.route('http://amboola.test/**', r => r.fulfill({ path: path.join(ROOT, 'index.html'), contentType: 'text/html' }));
await page.goto('http://amboola.test/index.html');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 180000 });
await page.evaluate(([fps, sc]) => { window.__FPS = fps; window.__manualFrames = true; window.__startScene = sc; }, [FPS, SCENE]);
await page.addScriptTag({ path: path.join(HERE, 'trailer-director.js') });
const total = await page.evaluate(() => window.__trailerTotal); let n = SCENE ? await page.evaluate(i => window.__sceneStart(i), SCENE) : 0; const t0 = Date.now();
for (;;) {
  const r = await page.evaluate(() => window.__trailerStep()); if (r.done || (process.env.MAXF && n >= +process.env.MAXF)) break;
  await page.screenshot({ path: `${FRAMES}/${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (n % 48 === 0) console.log(`frame ${n}/${total} scene ${r.scene} · ${((Date.now() - t0) / n).toFixed(0)} ms/frame`);
}
await browser.close();
const ff = process.env.FFMPEG || 'ffmpeg';
execFileSync(ff, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${FRAMES}/%05d.jpg`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
console.log(`wrote ${OUT} (${n} frames, ${(n / FPS).toFixed(1)} s, ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
