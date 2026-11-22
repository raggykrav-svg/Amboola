// the page has been open 50 minutes: drive at the ski village (the lift updates there) and race in every country
(() => {
  const A = window.amboola, pn = performance.now.bind(performance), out = []; performance.now = () => pn() + 3.0e6; window.__render = false;
  const ce = console.error, errs = []; console.error = (...a) => { errs.push(a.map(x => String(x?.stack || x)).join(' ').slice(0, 300)); ce.apply(console, a); };
  const P = A.player; Object.assign(P, { x: A.SNOW.vx + 8, z: A.SNOW.vz + 8, vx: 0, vz: 0 });
  let thrown = 0; for (let i = 0; i < 40; i++) { try { A.tick(1 / 20); } catch (e) { thrown++; if (thrown < 2) out.push('THROW ' + String(e.stack).split('\n').slice(0, 4).join(' | ')); } }
  out.push(`snow: thrown ${thrown}, errors ${errs.length}`);
  for (let i = 0; i < A.COUNTRIES.length; i++) { const e0 = errs.length; A.endActs(); A.startCRace(A.COUNTRIES[i]); let th = 0; for (let k = 0; k < 30; k++) { try { A.tick(1 / 20); } catch (e) { th++; } } out.push(`${A.COUNTRIES[i].id}: thrown ${th}, errors ${errs.length - e0}${errs.length > e0 ? ' ' + errs[e0].slice(0, 200) : ''}`); }
  A.endActs(); console.error = ce; performance.now = pn; window.__render = true; return out;
})()
