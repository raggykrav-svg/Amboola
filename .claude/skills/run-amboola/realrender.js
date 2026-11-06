// Real-render check: plays every story chapter and road race with the real picture (nothing stubbed) and reports,
// per chapter, any throw, the camera or the car drifting off the physics, a NaN body, and whether the picture on the
// canvas actually changes while you drive (a 32x18 copy every 10 frames). It is the test for "the HUD goes on but the
// 3D picture is frozen" bugs, which the stubbed headless tests can't see.
//
//   node driver.mjs shots /tmp/rr '[{"click":"#drive","wait":3000},
//     {"eval":"window.__rr = { future: true, stride: 2, offset: 0, frames: 50 }"},
//     {"eval":"@.claude/skills/run-amboola/realrender.js","wait":300}]'
//
// Options (window.__rr): future (build the year 3000 first), stride/offset (split the list over parallel runs),
// frames (per chapter, at 1/20 s), only (a list of chapter / road race ids). SwiftShader at 640x360
// (AMBOOLA_VIEWPORT=640x360): about 30 min for everything in FUTURE mode on two parallel runs.
(async () => {
  const A = window.amboola, O = { future: false, stride: 1, offset: 0, frames: 50, ...(window.__rr || {}) }, out = [], P = () => A.player;
  window.__manualFrames = true;
  const errs = [], ce = console.error; console.error = (...a) => { errs.push(a.map(x => String(x?.stack || x)).join(' ').slice(0, 400)); ce.apply(console, a); };
  const talk = async () => { for (let k = 0; k < 20 && A.SAY.on; k++) A.sayNext(); await new Promise(r => setTimeout(r, 30)); for (let k = 0; k < 20 && A.SAY.on; k++) A.sayNext(); };
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 18; const g = cv.getContext('2d', { willReadFrequently: true });
  const snap = () => { g.drawImage(A.renderer.domElement, 0, 0, 32, 18); return g.getImageData(0, 0, 32, 18).data; };
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4) / 3; };
  if (O.future) { await A.futEnsure(); A.futApply(true); for (let k = 0; k < 5; k++) A.tick(1 / 30); }
  let all = [];
  for (const St of A.STORIES) for (const ch of St.chapters) all.push(['story', St, ch]);
  for (const E of A.ROAD_RACES) all.push(['race', null, E]);
  if (O.only) all = all.filter(([, , ch]) => O.only.includes(ch.id));
  for (const [kind, St, ch] of all.filter((_, i) => i % O.stride === O.offset)) {
    const tag = kind === 'story' ? ch.id : 'road:' + ch.id, e0 = errs.length, issues = [];
    try {
      if (kind === 'story') {
        A.storyPlay(St, ch); for (let k = 0; k < 200 && !A.SAY.on; k++) await new Promise(r => setTimeout(r, 50));
        await talk(); for (let k = 0; k < 200 && !A.storyRun; k++) await new Promise(r => setTimeout(r, 50));
        if (!A.storyRun) { out.push(tag + ': did not start'); continue; }
      } else A.startRoadRace(ch);
      const f0 = A.renderer.info.render.frame; let s0 = null, moved = 0, still = 0; const x0 = P().x, z0 = P().z;
      A.keys.KeyW = true;
      for (let f = 0; f < O.frames; f++) {
        try { A.tick(1 / 20); } catch (e) { issues.push(`f${f} THROW ${String(e).slice(0, 160)}`); }
        const p = P(), cam = A.camera.position, cd = Math.hypot(cam.x - p.x, cam.z - p.z);
        if (!(cd < 40)) issues.push(`f${f} camera ${cd.toFixed(0)} m away`);
        const gp = p.car.group.position; if (!(Math.hypot(gp.x - p.x, gp.z - p.z) < 3)) issues.push(`f${f} car off its place`);
        if (!p.car.body.matrixWorld.elements.every(isFinite)) issues.push(`f${f} body NaN`);
        if (f % 10 === 9) { const s = snap(); if (s0) { if (diff(s0, s) < .5) still++; else moved++; } s0 = s; }
        if (issues.length > 6) break;
      }
      A.keys.KeyW = false;
      const renders = A.renderer.info.render.frame - f0, dist = Math.hypot(P().x - x0, P().z - z0);
      out.push(`${tag}: ${issues.length ? issues.slice(0, 3).join(' | ') : 'ok'} · renders ${renders} · drove ${dist.toFixed(0)} m · picture changed ${moved}/${moved + still}${errs.length > e0 ? ' · ERR ' + errs.slice(e0, e0 + 2).join(' || ') : ''}`);
    } catch (e) { out.push(tag + ' EXC ' + String(e.stack).slice(0, 300)); }
    if (A.storyRun) A.storyAbort(true); if (A.roadRace) A.endRoadRace(0, true); await talk(); try { A.tick(1 / 30); } catch (e) { }
  }
  return out;
})()
