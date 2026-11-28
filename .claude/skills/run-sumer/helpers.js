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

// ---- driving and jobs
// helpers for driving tests
window.__nearCar = (x, z) => {
  const s = window.sumer; let best = null, bd = 1e9;
  for (const grp of s.city.details.values()) for (const c of (grp.userData.parked || [])) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
  return best;
};
window.__getIn = (x, z) => {
  const s = window.sumer, c = window.__nearCar(x, z); if (!c) return 'no car';
  const fx = Math.cos(c.ry), fz = -Math.sin(c.ry), rx = -fz, rz = fx;
  s.player.teleport(c.x + rx * 2.0, c.z + rz * 2.0);
  s.step(1 / 30);
  s.interact();
  for (let i = 0; i < 4; i++) s.step(1 / 30);
  s.hud(); s.render();
  const d = s.driving.car;
  return d ? { in: true, type: d.t, x: +d.x.toFixed(1), z: +d.z.toFixed(1), prompt: document.getElementById('prompt').className } : { in: false, near: [c.x, c.z], p: [s.player.pos.x, s.player.pos.z] };
};
window.__drive = (codes, secs) => {
  const s = window.sumer;
  for (const c of codes) dispatchEvent(new KeyboardEvent('keydown', { code: c }));
  let maxK = 0;
  for (let i = 0; i < Math.round(secs * 30); i++) { s.step(1 / 30); maxK = Math.max(maxK, s.driving.speedKmh()); }
  for (const c of codes) dispatchEvent(new KeyboardEvent('keyup', { code: c }));
  s.hud(); s.render();
  const d = s.driving.car;
  return d ? { kmh: Math.round(s.driving.speedKmh()), maxK: Math.round(maxK), x: +d.x.toFixed(1), z: +d.z.toFixed(1), ry: +d.ry.toFixed(2), street: document.getElementById('street').textContent } : 'not driving';
};
// job tests: walk to a marker, press E, then put the car at each stop
window.__startJob = (id) => {
  const s = window.sumer, g = s.jobs.givers.find((q) => q.id === id);
  if (s.state() !== 'play') s.startPlay(g.x, g.z);
  const car = s.driving.car;
  if (car) { car.x = g.x + 1.5; car.z = g.z + 1.5; car.vx = car.vz = car.vF = 0; } // drive into the marker
  else s.player.teleport(g.x + 1.5, g.z + 1.5);
  for (let i = 0; i < 3; i++) s.step(1 / 30);
  const near = !!s.jobs.giverNear();
  s.interact();
  for (let i = 0; i < 10; i++) s.step(1 / 30);
  s.hud(); s.render();
  const j = s.jobs.job;
  return { near, job: j && j.id, step: j && j.step, inCar: !!s.driving.car, target: s.jobs.target && s.jobs.target.label, route: s.jobs.route && s.jobs.route.length, panel: document.getElementById('jt').textContent, money: s.wallet.money };
};
// put the car at (x, z), stopped, and run the game for a moment
window.__carAt = (x, z, secs = 0.6) => {
  const s = window.sumer, c = s.driving.car; if (!c) return 'no car';
  c.x = x; c.z = z; c.vx = c.vz = c.vF = 0;
  for (let i = 0; i < Math.round(secs * 30); i++) { c.vx = c.vz = c.vF = 0; s.step(1 / 30); }
  s.hud(); s.render();
  const j = s.jobs.job;
  return { job: j && j.id, step: j && j.step, target: s.jobs.target && s.jobs.target.label, money: s.wallet.money, panel: document.getElementById('jt').textContent + ' | ' + document.getElementById('jx').textContent + ' | ' + document.getElementById('jr').textContent };
};
window.__jobGoal = () => { const t = window.sumer.jobs.target; return t ? [t.x, t.z] : null; };

// ---- police
window.__pol = () => { const P = window.sumer.police, p = window.sumer.player.pos; return { wanted: P.wanted, seen: P.seen, lostT: +P.lostT.toFixed(1), bustT: +P.bustT.toFixed(1), cars: P.cars.map((c) => [c.mode[0], Math.round(Math.hypot(c.c.x - p.x, c.c.z - p.z)), Math.round(Math.abs(c.c.vF) * 3.6)]) }; };
// run the game for game seconds, printing the police state every `every` seconds
window.__run = (secs, every = 1) => { const s = window.sumer, out = []; for (let i = 0; i < Math.round(secs * 30); i++) { s.step(1 / 30); if (i % Math.round(every * 30) === 0) out.push(window.__pol()); } return out; };
1;
