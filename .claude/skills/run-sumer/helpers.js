// Test helpers evaluated in the Sumer page by driver.mjs (they use the window.sumer debug handle).
window.__manualFrames = true; // the page's own frame loop stops; helpers step the game

// walk-mode teleport: x, z in metres (origin near the castle, x east, z south), yaw 0 = north
window.__go = (x, z, yaw, pitch = 0, mode = 'first', ticks = 8) => {
  const s = window.sumer;
  if (s.state() !== 'play') s.startPlay(x, z, yaw);
  s.player.setMode(mode);
  s.player.teleport(x, z, yaw);
  s.player.pitch = pitch;
  s.warm();
  for (let i = 0; i < ticks; i++) s.step(1 / 30);
  s.player.pitch = pitch;
  s.hud(); s.render();
  const p = s.player;
  return { x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1), feet: +p.feet.toFixed(2), street: document.getElementById('street').textContent, district: document.getElementById('district').textContent, tris: s.renderer.info.render.triangles, calls: s.renderer.info.render.calls };
};

// hold keys for a number of game seconds
window.__walk = (codes, secs) => {
  const s = window.sumer;
  for (const c of codes) dispatchEvent(new KeyboardEvent('keydown', { code: c }));
  const p0 = s.player.pos.clone();
  for (let i = 0; i < Math.round(secs * 30); i++) s.step(1 / 30);
  for (const c of codes) dispatchEvent(new KeyboardEvent('keyup', { code: c }));
  for (let i = 0; i < 6; i++) s.step(1 / 30);
  s.hud(); s.render();
  const p = s.player.pos;
  return { moved: +Math.hypot(p.x - p0.x, p.z - p0.z).toFixed(2), to: [+p.x.toFixed(1), +p.z.toFixed(1)], feet: +s.player.feet.toFixed(2), swim: s.player.swim, street: document.getElementById('street').textContent };
};

// let the world run (people, cars, trees) for some game seconds
window.__live = (secs) => {
  const s = window.sumer;
  for (let i = 0; i < secs * 30; i++) s.step(1 / 30);
  s.hud(); s.render();
  return { people: s.life.people.length, cars: s.life.cars.length, tris: s.renderer.info.render.triangles, calls: s.renderer.info.render.calls };
};

// drone camera at (x, y, z)
window.__drone = (x, y, z, yaw, pitch) => {
  const s = window.sumer;
  if (s.state() !== 'play') s.startPlay(x, z, yaw);
  s.player.setMode('drone');
  s.player.drone.set(x, y, z); s.player.yaw = yaw; s.player.pitch = pitch;
  const t0 = performance.now();
  while (performance.now() - t0 < 4000) { if (!s.city.update(x, z, 200, x, z)) break; }
  s.forest.update(x, z, true);
  for (let i = 0; i < 4; i++) s.step(1 / 30);
  s.player.drone.set(x, y, z); s.player.yaw = yaw; s.player.pitch = pitch; s.step(0.001);
  s.hud(); s.render();
  return { tris: s.renderer.info.render.triangles, calls: s.renderer.info.render.calls };
};

// press an on-screen button (Playwright clicks time out under SwiftShader; this calls the handler)
window.__click = (id) => {
  document.getElementById(id).click();
  for (let i = 0; i < 3; i++) window.sumer.step(1 / 30);
  window.sumer.render();
  const vis = (x) => !document.getElementById(x).classList.contains('hide');
  return { state: window.sumer.state(), mode: window.sumer.player && window.sumer.player.mode, pause: vis('pause'), settings: vis('settings'), help: vis('help'), map: vis('mapui'), title: vis('title'), time: window.sumer.env.key };
};

// triangles per kind of object (to find what is expensive)
window.__tris = () => {
  const out = {};
  window.sumer.scene.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    const g = o.geometry; if (!g) return;
    const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    const k = (o.isInstancedMesh ? 'instanced ' : '') + o.material.type + ' ' + (o.name || (o.parent && o.parent.name) || '').replace(/\d+$/, '');
    out[k] = (out[k] || 0) + n * (o.isInstancedMesh ? o.count : 1);
  });
  return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}: ${Math.round(v / 1000)}k`);
};
1;
