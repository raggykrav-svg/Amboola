// a long drive round the city (20 game minutes, autopilot, rendering every 10th frame): do memory, scene size or frame cost keep growing?
(() => {
  const A = window.amboola, R = A.renderer, out = []; let t = 0, kids = () => { let n = 0; A.scene.traverse(() => n++); return n; };
  window.__autoInput = () => { t++; return { throttle: .7, brake: 0, steer: Math.sin(t / 53) * .45, handbrake: false, nitro: false }; };
  const ce = console.error, errs = []; console.error = (...a) => { errs.push(String(a[0]).slice(0, 200)); ce.apply(console, a); };
  for (let round = 0; round <= 8; round++) {
    const t0 = performance.now();
    for (let i = 0; i < 3000; i++) { window.__render = i % 10 === 0; try { A.tick(1 / 20); } catch (e) { errs.push('THROW ' + String(e).slice(0, 150)); } const p = A.player; if (Math.abs(p.x) > 1500 || Math.abs(p.z) > 1500 || !isFinite(p.x)) p.resetToRoad(); }
    const m = R.info.memory; out.push(`${round * 2.5} min: geo ${m.geometries} tex ${m.textures} sceneObjs ${kids()} heap ${Math.round(performance.memory.usedJSHeapSize / 1e6)} MB · ${((performance.now() - t0) / 3000).toFixed(1)} ms/tick · errs ${errs.length}`);
  }
  delete window.__autoInput; window.__render = true; console.error = ce; return { out, errs: [...new Set(errs)].slice(0, 6) };
})()
