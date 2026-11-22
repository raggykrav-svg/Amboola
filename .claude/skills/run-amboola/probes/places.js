// fast travel to every map place, settle, drive 3 s: inside a building? NaN? sunk below the ground? errors? the car moves?
(async () => {
  const A = window.amboola, out = [], P = () => A.player;
  A.buildPlaces(); window.__render = false;
  const inside = (x, z) => { for (const list of A.colGrid.values()) for (const b of list) if (x > b.x0 + .4 && x < b.x1 - .4 && z > b.z0 + .4 && z < b.z1 - .4) return true; return false; };
  const ce = console.error, errs = []; console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 200)); ce.apply(console, a); };
  let n = 0;
  for (const d of A.PLACES) {
    if (d.party != null) continue; n++;
    const e0 = errs.length, iss = [];
    try { A.endActs(); if (A.state !== 'drive') A.startDrive(); A.travelTo(d); A.closeMap?.(); } catch (e) { out.push(`${d.n}: travel THROW ${String(e).slice(0, 120)}`); continue; }
    for (let i = 0; i < 6; i++) { try { A.tick(1 / 20); } catch (e) { iss.push('THROW ' + String(e).slice(0, 100)); break; } }
    if (A.state !== 'drive') { out.push(`${d.n}: state ${A.state}`); try { A.endActs(); A.startDrive(); } catch (e) { } continue; }
    const p = P(), x0 = p.x, z0 = p.z, y0 = p.y || 0;
    if (inside(p.x, p.z) && !p.air) iss.push('INSIDE A BUILDING');
    window.__autoInput = () => ({ throttle: 1, brake: 0, steer: 0, handbrake: false, nitro: false });
    for (let i = 0; i < 60; i++) { try { A.tick(1 / 20); } catch (e) { iss.push('THROW ' + String(e).slice(0, 100)); break; } if (A.state !== 'drive') break; }
    delete window.__autoInput;
    const q = P(); if (![q.x, q.z, q.y || 0].every(Number.isFinite)) iss.push('NaN');
    const moved = Math.hypot(q.x - x0, q.z - z0); if (moved < 4 && A.state === 'drive') iss.push(`STUCK (moved ${moved.toFixed(1)} m)`);
    if ((q.y || 0) < -3 && !A.swim) iss.push(`UNDERGROUND y=${(q.y || 0).toFixed(1)}`);
    const cam = A.camera.position; if (Math.hypot(cam.x - q.x, cam.z - q.z) > 40) iss.push('CAMERA FAR');
    if (errs.length > e0) iss.push('ERR ' + errs.slice(e0, e0 + 2).join(' || '));
    if (iss.length) out.push(`${d.n} [${d.kind || d.type || ''}] @${Math.round(x0)},${Math.round(z0)} y${y0.toFixed(1)}: ${iss.join(' · ')}`);
  }
  window.__render = true; console.error = ce; return { places: n, issues: out.length, out };
})()
