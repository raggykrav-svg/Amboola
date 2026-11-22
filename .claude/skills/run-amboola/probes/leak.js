// drive the same 6 cars in turn 5 times: do GPU geometries / textures / shader programs keep growing?
(async () => {
  const A = window.amboola, R = A.renderer, ids = ['gr86', 'gt3rs', 'm5', 'chironss', 'taycangt', 'mustang'], out = [];
  ids.forEach(id => A.wallet.owned.add(id)); for (const id of ids) await A.loadModel(id).catch(() => {});
  for (let round = 0; round < 5; round++) {
    for (const id of ids) { A.selectCar(A.CARS.findIndex(c => c.id === id)); A.startDrive(); for (let i = 0; i < 4; i++) A.tick(1 / 20); }
    const m = R.info.memory; out.push(`round ${round}: geometries ${m.geometries} textures ${m.textures} programs ${R.info.programs?.length} heap ${Math.round(performance.memory?.usedJSHeapSize / 1e6)} MB`);
  }
  return out;
})()
