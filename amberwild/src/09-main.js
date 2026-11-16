// ---------- boot and main loop
const DAYLEN = 720;   // seconds for a full day
let prScale = 1, fpsAcc = 0, fpsN = 0, seenT = 0, saveT = 0;
function applyQuality() {
  Q = QUAL[S.opt.q] || QUAL.med; prScale = 1;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pr)); scene.fog.far = Q.far; setShadows(); buildGrass();
  for (const k of ['conifer', 'jungle', 'palm', 'bush', 'boulder']) if (I[k]) I[k].m.castShadow = true;
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
function startPlay(first) {
  mode = 'play'; $('#title').hidden = true; $('#hud').hidden = false; $('#touch').hidden = !inp.touch; initAudio(); refreshHot(); questT = 0; player.cy = player.yaw = PI; player.cp = .2; grab();
  if (first) { banner('DAY 1', 'Find sticks, stones and fibre along the shore'); tip(inp.touch ? 'Left thumb moves, right thumb looks. USE picks things up.' : 'WASD to move, mouse to look, E to pick things up, Tab for your bag.'); }
}
function tick(dt) {
  const p = player; now += dt;
  if (mode === 'play') {
    S.time += dt / DAYLEN; if (S.time >= 1) { S.time -= 1; S.day++; }
    updatePlayer(dt); updateBuild(); findNear(); updateDinos(dt); updateOutpost(dt); updateBoss(); updateArrows(dt); updateFires(dt); updateNodes(); updateQuests(dt); updateCamera(dt); updateHud(dt);
    if ((seenT -= dt) < 0) { seenT = 1; for (const d of dinos) if (!S.codex[d.key] && dist2(d.x, d.z, p.x, p.z) < (d.sp.br > 1 ? 70 : 32)) { codex(d.key); toast(`New field note: ${d.sp.name}`, 'amber'); } S.pos = [p.x, p.z]; }
    if ((saveT -= dt) < 0) { saveT = 20; save(); }
    if (audio.wind) audio.wind.gain.value = .03 + clamp(p.y / 90, 0, 1) * .09 + (p.v > 6 ? .03 : 0);
    if (Math.random() < dt * .1 && dayF > .6 && audio.ctx) { const f = 1800 + Math.random() * 1400; tone(f, f * 1.2, .07, 'sine', .03); tone(f * 1.1, f * .9, .09, 'sine', .03, .1); }
  } else if (mode === 'dead') {
    p.deadT += dt; p.human.root.rotation.x = lerp(p.human.root.rotation.x, -PI / 2, clamp(6 * dt, 0, 1)); p.human.root.position.y = p.y + .15; updateDinos(dt); updateOutpost(dt); updateArrows(dt); updateCamera(dt);
  } else if (mode === 'title' || mode === 'creator') {
    p.y = groundAt(p.x, p.z, 99); const h = p.human; h.root.visible = true; h.root.position.set(p.x, p.y, p.z);
    if (mode === 'title') { h.root.rotation.y = 0; h.setHeld(null); h.pose(dt, { move: 0, emote: null }); const a = now * .035 + 2.4; camera.position.set(40 + Math.sin(a) * 250, 62, 40 + Math.cos(a) * 250); camera.lookAt(0, 22, 0); }
    else { h.root.rotation.y = crYaw; h.setHeld(null); h.pose(dt, { move: 0, emote: crCat === 6 ? 'flex' : null }); const face = crCat >= 2 && crCat <= 5, d = face ? 1.15 : 3.5, ty = p.y + (face ? 1.62 : 1.02) * h.root.scale.y; camera.fov = 40; camera.updateProjectionMatrix(); camera.position.lerp(_v.set(p.x + (face ? .12 : .9), ty + (face ? .02 : .25), p.z + d), clamp(6 * dt, 0, 1)); camera.lookAt(p.x + (face ? 0 : .35), ty, p.z); }
    updateDinos(dt); updateFires(dt);
  }
  const keep = S.time; if (mode === 'title' || mode === 'creator') S.time = .43;
  updateParticles(dt); updateSky(dt, camera.position.x, p.y, camera.position.z); updateGrass(); S.time = keep;
  if (!window.__skipRender) renderer.render(scene, camera);
}
let last = 0;
function frame(t) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; if (window.__manual || mode === 'boot') return;
  if (mode === 'panel') { renderer.render(scene, camera); return; }
  tick(dt);
  // drop resolution a notch when the frame rate sags, raise it back when there is room
  fpsAcc += dt; fpsN++; if (fpsAcc > 2.5) { const fps = fpsN / fpsAcc; fpsAcc = fpsN = 0; const max = Math.min(devicePixelRatio || 1, Q.pr); if (fps < 30 && prScale > .55) prScale *= .85; else if (fps > 55 && prScale < 1) prScale = Math.min(1, prScale * 1.1); renderer.setPixelRatio(max * prScale); }
}
function boot() {
  const cv = $('#gl');
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .82; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xb4d6ea, 70, 560);
  camera = new THREE.PerspectiveCamera(62, 1, .12, 2400); scene.add(camera);
  if (!S.opt.q) S.opt.q = (matchMedia('(pointer:coarse)').matches || innerWidth < 800) ? 'low' : 'med';
  Q = QUAL[S.opt.q];
  buildTerrain(); buildWater(); buildSky(); buildProps(); buildMap(); initParticles();
  if (S.pos && S.created) { player.x = S.pos[0]; player.z = S.pos[1]; }
  player.y = hAt(player.x, player.z);
  for (const b of S.builds) addBuild({ ...b });
  buildOutpost(); rebuildPlayer(); spawnDinos(); applyQuality(); resize(); addEventListener('resize', resize); initInput(); refreshHot();
  // a first camp so the shore does not feel empty
  if (!S.builds.some(b => b.t === 'fire')) { const x = POI.spawn[0] + 2.5, z = POI.spawn[1] - 3; addBuild({ t: 'fire', x, y: hAt(x, z), z, r: 0, fixed: true }); }
  $('#loading').hidden = true; $('#title').hidden = false; $('#tPlay').textContent = S.created ? 'Continue' : 'Play'; $('#tNew').hidden = !S.created; mode = 'title';
  window.amberwild = { get S() { return S; }, player, dinos, npcs, outpost, tick, startPlay, openCreator, closeCreator, openPanel, closePanel, setBuild, Dino, hAt, POI, camera, get mode() { return mode; }, keys, inp, setSlot, eat, shoot, findNear, SPECIES, QUESTS, openWheel, respawn, craft, gain, addAmber, builds, renderer, scene };
  requestAnimationFrame(frame);
}
cv_ready();
function cv_ready() { setTimeout(() => { try { boot(); } catch (e) { console.error(e); $('#loadT').textContent = 'Could not start: ' + e.message; } }, 30); }
