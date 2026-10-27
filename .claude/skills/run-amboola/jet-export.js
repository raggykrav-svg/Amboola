(async () => {
  window.__manualFrames = true;
  const A = window.amboola, i = A.CARS.findIndex(c => c.id === 'amboolajet');
  document.querySelector(`.caritem[data-i="${i}"]`).click();
  const car = A.gCar, body = car.body;
  // name the materials the photo script knows; hide the afterburner flames
  body.traverse(o => { if (!o.isMesh) return; const m = o.material;
    if (m === car.paint) m.name = 'Paint'; else if (m.transparent && m.blending === 2) o.visible = false;
    else if (m.isMeshPhysicalMaterial || m.isMeshStandardMaterial) { const c = m.color.getHex(); if (c === 0xc8141b) m.name = 'Accent'; else if (!m.name) m.name = m.color.getHSL({}).l < .1 ? 'GlossBlack' : 'Part'; }
    if (o.geometry.parameters?.radius === 1 && o.scale.z > 2) m.name = 'Glass'; });
  const { GLTFExporter } = await import('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/exporters/GLTFExporter.js');
  const buf = await new GLTFExporter().parseAsync(body, { binary: true, onlyVisible: true });
  let s = ''; const u = new Uint8Array(buf); for (let k = 0; k < u.length; k += 32768) s += String.fromCharCode.apply(null, u.subarray(k, k + 32768));
  return { name: A.CARS[i].name, paint: car.paint.color.getHexString(), b64: btoa(s) };
})()
