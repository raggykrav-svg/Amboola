// fire a fully loaded V24 car (and a stock one) straight at buildings from many street spots at full speed; did it end up inside a building?
(() => {
  const A = window.amboola, c = A.CARS.find(c => c.id === 'devel16'); A.wallet.owned.add('devel16');
  const spec = A.tunedSpec(c, A.UPG_FULL, 'v24'); const P = A.player; const orig = P.spec; P.spec = spec;
  const inside = (x, z) => { const g = A.colGrid; let hitb = null; for (const list of g.values()) for (const b of list) if (x > b.x0 + .3 && x < b.x1 - .3 && z > b.z0 + .3 && z < b.z1 - .3) { hitb = b; break; } return hitb; };
  const res = []; let bad = 0;
  window.__autoInput = () => ({ throttle: 1, brake: 0, steer: 0, handbrake: false, nitro: false });
  for (let k = 0; k < 24; k++) {
    // a spot on a street, aimed along x or z at full speed
    const x = (Math.random() - .5) * 1200, z = (Math.random() - .5) * 1200, h = Math.floor(Math.random() * 4) * Math.PI / 2 + (Math.random() - .5) * .6;
    Object.assign(P, { x, z, heading: h, vx: Math.sin(h) * spec.vmax / 3.6, vz: Math.cos(h) * spec.vmax / 3.6, yawRate: 0, y: 0, air: false });
    if (inside(x, z)) continue;
    for (const dt of [1 / 20]) for (let i = 0; i < 40; i++) { A.simStep(dt, { throttle: 1, brake: 0, steer: 0, handbrake: 0, nitro: 0 }); P.vx = Math.sin(P.heading) * Math.max(P.speed || 0, 100); P.vz = Math.cos(P.heading) * Math.max(P.speed || 0, 100); const b = inside(P.x, P.z); if (b) { bad++; res.push(`inside a building at ${P.x.toFixed(0)},${P.z.toFixed(0)} (box ${b.x0.toFixed(0)}..${b.x1.toFixed(0)} × ${b.z0.toFixed(0)}..${b.z1.toFixed(0)})`); break; } }
  }
  P.spec = orig; delete window.__autoInput;
  return { bad, res: res.slice(0, 8), boxes: [...A.colGrid.values()].reduce((a, l) => a + l.length, 0) };
})()
