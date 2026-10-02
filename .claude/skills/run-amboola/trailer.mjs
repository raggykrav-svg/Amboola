#!/usr/bin/env node
// Record the Amboola trailer: steps the game frame-by-frame (deterministic, so SwiftShader's ~2 fps doesn't matter),
// screenshots every frame and encodes an H.264 MP4 with ffmpeg.
//   node .claude/skills/run-amboola/trailer.mjs [out.mp4]      (env FFMPEG=/path/to/ffmpeg, FPS=24, PYTHON=python-with-numpy)
// The soundtrack (music + sound effects on the cuts, drag-tree beeps and launches) is synthesized by soundtrack.py from the
// director's timeline and muxed in; without numpy the video is written silent.
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const require = createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'));
const { chromium } = require('playwright');
const OUT = path.resolve(process.argv[2] || '/tmp/amboola-trailer.mp4'), FPS = +(process.env.FPS || 24), FRAMES = '/tmp/amboola-frames';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), V = html.match(/three@([\d.]+)\/build/)[1], THREE_DIR = `/tmp/amboola-three/package`;
if (!fs.existsSync(THREE_DIR)) execSync(`mkdir -p /tmp/amboola-three && cd /tmp/amboola-three && npm pack three@${V} --silent && tar xzf three-${V}.tgz`);
// PREVIEW=dir runs every scene with rendering off and only screenshots the middle frame of each scene (a few minutes,
// for checking the whole cut before the real recording).
const PREVIEW = process.env.PREVIEW && path.resolve(process.env.PREVIEW);
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
// serve the repo (index.html, the models/*.glb.js car models, media/ images for the Blender gallery)
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
await page.route('http://amboola.test/**', r => { const p = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
  fs.existsSync(p) && fs.statSync(p).isFile() ? r.fulfill({ path: p, contentType: MIME[path.extname(p)] || 'application/octet-stream' }) : r.fulfill({ status: 404 }); });
await page.goto('http://amboola.test/index.html');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 180000 });
await page.evaluate(([fps, sc]) => { window.__FPS = fps; window.__manualFrames = true; window.__startScene = sc; }, [FPS, SCENE]);
await page.addScriptTag({ path: path.join(HERE, 'trailer-director.js') });
await page.waitForFunction(() => window.__trailerReady(), null, { timeout: 60000 });   // gallery images loaded
const total = await page.evaluate(() => window.__trailerTotal);
fs.writeFileSync(`${FRAMES}/timeline.json`, JSON.stringify(await page.evaluate(() => window.__timeline())));
const models = await page.evaluate(() => Object.keys(window.amboola.MODELS).length); console.log(`${models} car models loaded, ${total} frames to record`); let n = SCENE ? await page.evaluate(i => window.__sceneStart(i), SCENE) : 0; const t0 = Date.now();
if (PREVIEW) {
  fs.mkdirSync(PREVIEW, { recursive: true });
  const mids = await page.evaluate(() => { const c = window.__sceneCount, s = window.__sceneStart; return Array.from({ length: c }, (_, i) => Math.floor((s(i) + (i + 1 < c ? s(i + 1) : window.__trailerTotal)) / 2)); });
  await page.evaluate(() => { const C = window.amboola.composer; C.__render = C.render; C.render = () => {}; });
  for (let f = n; ; f++) {
    const shoot = mids.indexOf(f + 1);   // render the frame before a mid frame so the screenshot shows it
    if (shoot >= 0) await page.evaluate(() => { const C = window.amboola.composer; C.render = C.__render; });
    let r; try { r = await page.evaluate(() => window.__trailerStep()); } catch (e) {
      console.log(`CRASH at frame ${f}:`, e.message.split('\n')[0], await page.evaluate(() => { const p = window.amboola.player; return JSON.stringify({ car: p.spec.id, x: p.x, z: p.z, y: p.y, vx: p.vx, vz: p.vz, rpm: p.rpm, gear: p.gear, slope: p.slope, crime: !!window.amboola.crime, mtn: p.y > 1 }); })); break; }
    if (r.done) break;
    if (shoot >= 0) { await page.screenshot({ path: `${PREVIEW}/scene${String(shoot).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 80 }); await page.evaluate(() => { window.amboola.composer.render = () => {}; }); console.log(`preview scene ${shoot} (frame ${f + 1})`); }
  }
  await browser.close(); process.exit(0);
}
for (;;) {
  const r = await page.evaluate(() => window.__trailerStep()); if (r.done || (process.env.MAXF && n >= +process.env.MAXF)) break;
  await page.screenshot({ path: `${FRAMES}/${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  if (n % 48 === 0) console.log(`frame ${n}/${total} scene ${r.scene} · ${((Date.now() - t0) / n).toFixed(0)} ms/frame`);
}
await browser.close();
const ff = process.env.FFMPEG || 'ffmpeg', WAV = `${FRAMES}/soundtrack.wav`;
const PY = process.env.PYTHON || ['/tmp/blender/blender-4.2.3-linux-x64/4.2/python/bin/python3.11', 'python3'].find(p => p === 'python3' || fs.existsSync(p));
let audio = false; try { execFileSync(PY, [path.join(HERE, 'soundtrack.py'), `${FRAMES}/timeline.json`, WAV], { stdio: 'inherit' }); audio = true; } catch { console.log('soundtrack skipped (needs python + numpy) - silent video'); }
execFileSync(ff, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${FRAMES}/%05d.jpg`, ...(audio ? ['-i', WAV, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
console.log(`wrote ${OUT} (${n} frames, ${(n / FPS).toFixed(1)} s, ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
