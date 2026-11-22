// every car: build it in the garage, drive it 3 s (full throttle), check errors / NaN / it moves
(async () => {
  const A = window.amboola, out = []; const ce = console.error, errs = []; console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 200)); ce.apply(console, a); };
  A.CARS.forEach(c => A.wallet.owned.add(c.id));
  for (let i = 0; i < A.CARS.length; i++) {
    const c = A.CARS[i]; if (c.jet) continue; const e0 = errs.length, iss = [];
    try { await A.loadModel(c.id).catch(() => {}); A.endActs(); A.selectCar(i); A.startDrive(); } catch (e) { out.push(`${c.id}: START THROW ${String(e).slice(0, 140)}`); continue; }
    const p = A.player; Object.assign(p, { x: -5.7, z: 150, heading: Math.PI, vx: 0, vz: 0 });
    window.__autoInput = () => ({ throttle: 1, brake: 0, steer: 0, handbrake: false, nitro: false });
    for (let k = 0; k < 60; k++) { window.__render = k % 30 === 0; try { A.tick(1 / 20); } catch (e) { iss.push('THROW ' + String(e).slice(0, 120)); break; } }
    window.__render = true; delete window.__autoInput;
    const d = Math.hypot(p.x + 5.7, p.z - 150); if (!Number.isFinite(d)) iss.push('NaN'); else if (d < 8) iss.push(`barely moved ${d.toFixed(1)} m`);
    if (errs.length > e0) iss.push('ERR ' + errs.slice(e0, e0 + 2).join(' || '));
    if (iss.length) out.push(`${c.id}: ${iss.join(' · ')}`);
  }
  console.error = ce; return { cars: A.CARS.length, out };
})()
