// ---------- HUD, menus, creator, shop, emotes, input
let focus = null, focusT = 0, panelTab = 'bag', everLocked = false, lockTries = 0, wheelOpen = false;
function toast(msg, cls = '') { const b = $('#toasts'), d = el('div', 'toast ' + cls, msg); b.prepend(d); setTimeout(() => d.classList.add('out'), 2800); setTimeout(() => d.remove(), 3300); while (b.children.length > 6) b.lastChild.remove(); }
function gain(k, n) { S.inv[k] += n; toast(`+${n} ${ITEM[k]}`, 'gain'); refreshHot(); }
function addAmber(n) { if (!n) return; S.amber += n; toast(`+${n} amber`, 'amber'); $('#amberN').textContent = S.amber; }
let bannerT, tipT;
function banner(a, b) { const e = $('#banner'); e.children[0].textContent = a; e.children[1].textContent = b || ''; e.style.opacity = 1; clearTimeout(bannerT); bannerT = setTimeout(() => e.style.opacity = 0, 3600); }
function tip(t) { const e = $('#tip'); e.textContent = t; e.style.opacity = 1; clearTimeout(tipT); tipT = setTimeout(() => e.style.opacity = 0, 5500); }
function fade() { const f = $('#fade'); f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 700); }
function floatText(x, y, z, t, cls = '') { _v.set(x, y, z).project(camera); if (_v.z > 1 || Math.abs(_v.x) > 1.1) return; const d = el('div', 'float ' + cls, t); d.style.left = (_v.x * .5 + .5) * innerWidth + (Math.random() - .5) * 30 + 'px'; d.style.top = (-_v.y * .5 + .5) * innerHeight + 'px'; $('#floats').append(d); setTimeout(() => d.remove(), 900); }
function focusOn(e) { focus = e; focusT = 5; }
let bowFlashT = 0;
function bowFlash(t, good) { $('#bowLbl').textContent = t; $('#bowLbl').style.color = good ? 'var(--amber)' : 'var(--bone)'; bowFlashT = 1; }

function refreshHot() {
  const food = S.inv.cooked + S.inv.berries + S.inv.meat, defs = [['Hands', 1, ''], ['Axe', S.tools.axe, ''], ['Spear', S.tools.spear, ''], ['Bow', S.tools.bow, S.tools.bow ? S.inv.arrows : ''], ['Eat', food, food || ''], ['Heal', S.inv.bandage, S.inv.bandage || '']];
  $('#hotbar').innerHTML = defs.map((d, i) => `<button class="slot${i < 4 && player.slot === i ? ' on' : ''}${d[1] ? '' : ' off'}" data-slot="${i}"><span class="k">${i + 1}</span><span class="c">${d[2]}</span><span class="n">${d[0]}</span></button>`).join('');
  $('#amberN').textContent = S.amber;
}
function renderBuildBar() { $('#buildbar').innerHTML = PIECES.map((p, i) => `<button class="slot${i === buildSel ? ' on' : ''}${canPay(p.cost) ? '' : ' poor'}" data-piece="${i}"><span class="k">${i + 1}</span><span class="n">${p.n}</span><span class="cost">${Object.keys(p.cost).map(k => p.cost[k] + ' ' + ITEM[k].toLowerCase()).join(', ')}</span></button>`).join(''); }

// ---------- per-frame HUD
const mini = { c: null, x: null };
function updateHud(dt) {
  const set = (id, v, max = 100) => { const e = $(id); e.querySelector('b').style.width = clamp(v / max * 100, 0, 100) + '%'; e.querySelector('em').textContent = id === '#bSt' ? '' : Math.ceil(v); };
  set('#bHp', S.hp); set('#bWa', S.water); set('#bFo', S.food); set('#bSt', player.stam);
  const h = (S.time * 24) | 0, m = ((S.time * 24 % 1) * 60) | 0; $('#clock').textContent = `DAY ${S.day} · ${String(h).padStart(2, 0)}:${String(m - m % 10).padStart(2, 0)}`;
  const hu = $('#hurt'); if (+hu.style.opacity > 0 && player.hurtT <= 0) hu.style.opacity = S.hp < 25 ? .35 : 0;
  // prompts
  const pr = [], n = player.near, f = player.nearF; if (n) pr.push(`<div><kbd>E</kbd>${n.label}</div>`); if (f) pr.push(`<div><kbd>F</kbd>${f.label}</div>`);
  const html = pr.join(''), pe = $('#prompt'); if (pe.dataset.h !== html) { pe.dataset.h = html; pe.innerHTML = html; }
  $('#tUse').style.opacity = n ? 1 : .35; $('#tFeed').style.opacity = f ? 1 : .35;
  // target bar
  if (focusT > 0 && focus) { focusT -= dt; $('#focus').hidden = false; $('#focusN').textContent = focus.name || ''; $('#focusTag').textContent = focus.state === 'dazed' ? '· DAZED' : focus.tamed ? '· PACK' : ''; $('#focusB').style.width = clamp(focus.hp / focus.max * 100, 0, 100) + '%'; if (!focus.alive && focusT > 1) focusT = 1; } else $('#focus').hidden = true;
  // bow meter
  const drawing = player.drawing; bowFlashT -= dt; $('#bowm').hidden = !drawing; $('#bowTxt').hidden = !(drawing || bowFlashT > 0);
  if (drawing) { const p = Math.min(player.draw, 1); $('#bowFill').setAttribute('stroke-dasharray', `${p * 100} 100`); $('#bowFill').setAttribute('stroke', player.draw > .74 && player.draw < .88 ? '#ffb02e' : player.draw > 1.02 ? '#e5484d' : '#f0e6d2'); $('#bowPct').textContent = Math.round(p * 100) + '%'; if (bowFlashT <= 0) $('#bowLbl').textContent = ''; }
  $('#cross').style.opacity = player.build ? 0 : 1;
  drawMini();
}
function drawMini() {
  const c = mini.c || (mini.c = $('#mini')), x = mini.x || (mini.x = c.getContext('2d')), W = c.width, R = W / 2, p = player, sc = W / 150, rot = PI + p.cy, co = Math.cos(rot), si = Math.sin(rot);
  x.save(); x.clearRect(0, 0, W, W); x.beginPath(); x.arc(R, R, R, 0, TAU); x.clip(); x.translate(R, R); x.rotate(rot); x.scale(sc, sc); x.imageSmoothingEnabled = true;
  x.drawImage(mapCanvas, -HALF - p.x, -HALF - p.z, WORLD, WORLD); x.restore();
  const dot = (wx, wz, col, r, edge) => { let dx = (wx - p.x) * sc, dz = (wz - p.z) * sc, sx = dx * co - dz * si, sy = dx * si + dz * co; const d = Math.hypot(sx, sy); if (d > R - 8) { if (!edge) return; sx *= (R - 8) / d; sy *= (R - 8) / d; } x.fillStyle = col; x.beginPath(); x.arc(R + sx, R + sy, r, 0, TAU); x.fill(); };
  for (const d of dinos) if (d.alive) { if (d.tamed) dot(d.x, d.z, '#9bd05a', 6); else if (d.target === p || (d.sp.temper === 'aggro' && dist2(d.x, d.z, p.x, p.z) < 60)) dot(d.x, d.z, '#e5484d', d.sp.boss ? 9 : 5); }
  for (const n of npcs) if (n.alive) dot(n.x, n.z, '#e5484d', 5);
  for (const b of builds) if (b.t === 'bed') dot(b.x, b.z, '#f0e6d2', 5);
  const q = QUESTS[S.quest]; if (q && q.mark) dot(q.mark[0], q.mark[1], '#ffb02e', 8, true);
  dot(p.x, p.z - 9999, '#f0e6d2', 5, true);   // north
  x.fillStyle = '#12100d'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center';
  x.fillStyle = '#ffb02e'; x.beginPath(); x.moveTo(R, R - 11); x.lineTo(R + 8, R + 8); x.lineTo(R, R + 3); x.lineTo(R - 8, R + 8); x.fill();
}

// ---------- menu sheet
const TABS = [['bag', 'Bag'], ['shop', 'Shop'], ['pack', 'Pack'], ['codex', 'Codex'], ['opts', 'Settings']];
const SHOP = [
  { id: 'o3', kind: 'Outfit', n: 'Ash Stalker', p: 900, d: 'Charcoal cloak for moonless hunts.', c: ['#26262b', '#8d2f2f'] },
  { id: 'o4', kind: 'Outfit', n: 'Sun Dancer', p: 900, d: 'Pale linen and beaten gold.', c: ['#e8d8b0', '#e0a030'] },
  { id: 'o5', kind: 'Outfit', n: 'Reef Runner', p: 700, d: 'Dyed with lagoon shells.', c: ['#1f8a8a', '#f0e6d0'] },
  { id: 's_bubble', kind: 'Pack skin', n: 'Bubble Pop', p: 1200, d: 'Your tamed dinosaurs turn pink with party dots.', c: ['#f06aa8', '#35d0c0'] },
  { id: 's_obsidian', kind: 'Pack skin', n: 'Obsidian Vein', p: 1500, d: 'Black glass hide with ember stripes.', c: ['#17151a', '#ff6a1a'] },
  { id: 's_glacier', kind: 'Pack skin', n: 'Glacier', p: 1000, d: 'Ice blue with deep-water stripes.', c: ['#9fd4ef', '#2f6f9a'] },
  { id: 'h_crown', kind: 'Pack hat', n: 'Leaf Crown', p: 500, d: 'A ring of fresh fronds for every head in the pack.', c: ['#5fa043', '#9bd05a'] },
  { id: 'h_helm', kind: 'Pack hat', n: 'Bone Helm', p: 650, d: 'Horned skull caps. Subtle.', c: ['#ece4cf', '#b8ae96'] },
  { id: 'b_rime', kind: 'Bow', n: 'Rimefeather Bow', p: 800, d: 'Arrows leave a trail of frost.', c: ['#8fd3ff', '#ffffff'] },
  { id: 'b_ember', kind: 'Bow', n: 'Emberstring Bow', p: 800, d: 'Arrows leave a trail of sparks.', c: ['#ff7a2a', '#ffd27a'] },
  { id: 'e_dance', kind: 'Emote', n: 'Stomp Dance', p: 300, d: 'For when the hunt goes well.', c: ['#7a5cff', '#f06aa8'] },
  { id: 'e_flex', kind: 'Emote', n: 'Flex', p: 300, d: 'For when it goes very well.', c: ['#c68a5c', '#6f4426'] },
  { id: 'e_drum', kind: 'Emote', n: 'Air Drum', p: 250, d: 'No drum required.', c: ['#4cc4d8', '#12100d'] },
];
const EMOTES = [['wave', 'Wave'], ['cheer', 'Cheer'], ['sit', 'Sit'], ['point', 'Point'], ['dance', 'Stomp', 'e_dance'], ['flex', 'Flex', 'e_flex'], ['drum', 'Drum', 'e_drum']];
const owns = id => S.owned.includes(id);
function isEquipped(it) { return it.id[0] === 'o' ? OUTFIT[S.look.outfit]?.id === it.id : it.id[0] === 's' ? S.equip.skin === it.id : it.id[0] === 'h' ? S.equip.hat === it.id : it.id[0] === 'b' ? S.equip.bow === it.id : false; }
function equip(it) {
  const k = it.id[0], on = isEquipped(it);
  if (k === 'o') { S.look.outfit = on ? 0 : OUTFIT.findIndex(o => o.id === it.id); rebuildPlayer(); }
  if (k === 's') { S.equip.skin = on ? null : it.id; for (const d of dinos) if (d.tamed) d.build(); }
  if (k === 'h') { S.equip.hat = on ? null : it.id; for (const d of dinos) if (d.tamed) d.build(); }
  if (k === 'b') { S.equip.bow = on ? null : it.id; rebuildPlayer(); }
  sfx('click'); save();
}
function buy(id) { const it = SHOP.find(q => q.id === id); if (!it) return; if (owns(id)) { equip(it); return renderPanel(); } if (S.amber < it.p) { sfx('deny'); return; } S.amber -= it.p; S.owned.push(id); sfx('coin'); if (it.id[0] !== 'e') equip(it); renderPanel(); refreshHot(); save(); }
function openCrate() { const left = SHOP.filter(q => !owns(q.id)); if (!left.length || S.amber < 450) return sfx('deny'); S.amber -= 450; const it = pick(left); S.owned.push(it.id); if (it.id[0] !== 'e') equip(it); sfx('tame'); renderPanel(); refreshHot(); $('#crateMsg').textContent = `The crate held: ${it.n} (${it.kind.toLowerCase()}, worth ${it.p}).`; save(); }
function renderPanel() {
  $('#tabs').innerHTML = TABS.map(t => `<button data-tab="${t[0]}" class="${t[0] === panelTab ? 'on' : ''}">${t[1]}</button>`).join('') + `<span class="sp"></span><span class="am"><i class="gem"></i>${S.amber}</span><button data-act="close">Resume</button>`;
  const b = $('#pbody'); let h = '';
  if (panelTab === 'bag') {
    h = `<div class="cols"><div><h3 class="lbl">Carrying</h3><div class="inv">${Object.keys(ITEM).map(k => `<div class="${S.inv[k] ? '' : 'z'}"><span>${ITEM[k]}</span><b>${S.inv[k]}</b></div>`).join('')}</div>
      <h3 class="lbl">You</h3><button class="btn sm" data-act="look">Change appearance</button></div><div><h3 class="lbl">Craft</h3>${RECIPES.map(r => { const have = r.tool && S.tools[r.tool]; return `<div class="rec"><div><b>${r.n}</b><p>${r.d}</p>${Object.keys(r.cost).map(k => `<span class="chip${S.inv[k] < r.cost[k] ? ' no' : ''}">${ITEM[k]} ${S.inv[k]}/${r.cost[k]}</span>`).join('')}</div><button class="btn sm${have ? '' : ' pri'}" data-craft="${r.id}" ${have || !canPay(r.cost) ? 'disabled' : ''}>${have ? 'Owned' : 'Craft'}</button></div>`; }).join('')}</div></div>`;
  }
  if (panelTab === 'shop') {
    h = `<h3 class="lbl">Traded for amber you find and earn on the island</h3><div class="cards">${SHOP.map(it => { const o = owns(it.id), e = isEquipped(it); return `<div class="card${o ? ' own' : ''}${e ? ' eq' : ''}"><div class="sw" style="background:linear-gradient(135deg,${it.c[0]} 0 58%,${it.c[1]} 58%)"><span class="lbl">${it.kind}</span></div><div class="in"><b>${it.n}</b><p>${it.d}</p><button class="btn sm${o ? '' : ' pri'}" data-buy="${it.id}" ${!o && S.amber < it.p ? 'disabled' : ''}>${o ? (it.id[0] === 'e' ? 'In your wheel' : e ? 'Take off' : 'Use') : it.p + ' amber'}</button></div></div>`; }).join('')}</div>
      <div class="crate"><div><b class="lbl">Fossil crate</b><p id="crateMsg" style="margin:2px 0 0;color:var(--dim)">One random thing you do not own yet. Nothing here costs real money.</p></div><button class="btn pri" data-act="crate" ${S.amber < 450 || SHOP.every(q => owns(q.id)) ? 'disabled' : ''}>Open · 450 amber</button></div>`;
  }
  if (panelTab === 'pack') {
    const pk = dinos.filter(d => d.tamed && d.alive);
    h = `<h3 class="lbl">Your pack</h3>${pk.length ? pk.map(d => `<div class="rec"><div><b>${d.name}</b><p>${d.sp.name} · ${Math.ceil(d.hp)}/${d.max} health · ${d.saddle ? 'saddled' : 'no saddle'} · ${d.stay ? 'waiting' : 'following'}</p></div><button class="btn sm" data-stay="${d.tid}">${d.stay ? 'Follow' : 'Wait'}</button></div>`).join('') : '<p style="color:var(--dim);margin:0">Nobody yet. Raptors and triceratops can be tamed once they are dazed.</p>'}
      <h3 class="lbl">The trail</h3>${QUESTS.map((q, i) => `<div class="q ${i < S.quest ? 'done' : i === S.quest ? 'cur' : ''}"><i>${i < S.quest ? '✓' : i + 1}</i><div><b>${q.t}</b>${i === S.quest ? `<div style="color:var(--dim);font-size:12.5px">${q.d}</div>` : ''}</div></div>`).join('')}`;
  }
  if (panelTab === 'codex') h = `<h3 class="lbl">Field notes</h3><div class="cards">${Object.keys(SPECIES).map(k => { const sp = SPECIES[k], c = S.codex[k]; return `<div class="card"><div class="sw" style="background:linear-gradient(135deg,#${(c ? sp.col : 0x2c251d).toString(16).padStart(6, 0)} 0 58%,#${(c ? sp.belly : 0x1f1a15).toString(16).padStart(6, 0)} 58%)"><span class="lbl">${c ? sp.temper === 'aggro' ? 'Hunter' : sp.temper === 'territorial' ? 'Territorial' : 'Harmless' : 'Unseen'}</span></div><div class="in"><b>${c ? sp.name : '???'}</b><p>${c ? sp.info : 'Get close to one to add it to your notes.'}</p>${c ? `<span class="chip">Hunted ${c.kills}</span>${sp.tame ? `<span class="chip">Tamed ${c.tamed}</span>` : ''}` : ''}</div></div>`; }).join('')}</div>`;
  if (panelTab === 'opts') {
    const q = S.opt.q;
    h = `<h3 class="lbl">Settings</h3><div class="set"><label>Graphics</label>${['low', 'med', 'high'].map(k => `<button class="btn sm${q === k ? ' pri' : ''}" data-q="${k}">${k === 'med' ? 'Medium' : k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
      <div class="set"><label for="oSens">Look speed</label><input type="range" id="oSens" min=".3" max="2.5" step=".1" value="${S.opt.sens}"></div><div class="set"><label for="oVol">Volume</label><input type="range" id="oVol" min="0" max="1" step=".05" value="${S.opt.vol}"></div>
      <h3 class="lbl">Controls</h3><div class="keys">${[['WASD', 'Move'], ['Mouse', 'Look'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['C', 'Sneak'], ['Click', 'Use tool, hold to draw bow'], ['1–4', 'Hands, axe, spear, bow'], ['5 / 6', 'Eat / bandage'], ['E', 'Interact, ride'], ['F', 'Feed, pet'], ['Q', 'Pack waits or follows'], ['Tab', 'Bag and crafting'], ['B', 'Build'], ['G', 'Emotes'], ['V', 'First person'], ['Esc', 'Menu']].map(k => `<div><kbd>${k[0]}</kbd>${k[1]}</div>`).join('')}</div>
      <h3 class="lbl">Save</h3><div class="row"><button class="btn sm" data-act="title">Save and quit to title</button><button class="btn sm" data-act="reset">Erase save</button></div>`;
  }
  b.innerHTML = h;
}
function openPanel(tab) { if (mode !== 'play' && mode !== 'panel') return; if (tab) panelTab = tab; mode = 'panel'; if (player.build) setBuild(false); closeWheel(); $('#panel').hidden = false; document.exitPointerLock?.(); renderPanel(); save(); sfx('click'); }
function closePanel() { if (mode !== 'panel') return; $('#panel').hidden = true; mode = 'play'; grab(); }
function grab() { if (inp.touch) return; try { const r = $('#gl').requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch { } }

// ---------- emote wheel
function openWheel() { if (mode !== 'play' || player.mount) return; wheelOpen = true; document.exitPointerLock?.(); const n = EMOTES.length; $('#wheelIn').innerHTML = EMOTES.map((e, i) => { const a = i / n * TAU, lock = e[2] && !owns(e[2]); return `<button data-emote="${e[0]}" class="${lock ? 'lock' : ''}" style="left:${50 + Math.sin(a) * 38}%;top:${50 - Math.cos(a) * 38}%">${e[1]}${lock ? '<br><small>shop</small>' : ''}</button>`; }).join('') + '<div class="mid">Pick an emote</div>'; $('#wheel').hidden = false; }
function closeWheel() { if (!wheelOpen) return; wheelOpen = false; $('#wheel').hidden = true; }

// ---------- character creator
const CATS = [['body', 'Body', BODY.map(b => b.n)], ['skin', 'Skin', SKIN], ['hair', 'Hair', HAIR], ['hairCol', 'Hair colour', HAIRCOL], ['beard', 'Beard', BEARD], ['paint', 'War paint', PAINT], ['outfit', 'Outfit', null]];
let crCat = 0, crYaw = 0;
function renderCreator() {
  $('#crCats').innerHTML = CATS.map((c, i) => `<button data-cat="${i}" class="${i === crCat ? 'on' : ''}" style="margin-left:${Math.round((1 - Math.cos((i - 3) * .32)) * 90)}px">${c[1]}</button>`).join('');
  const [key, title, list] = CATS[crCat]; let opts;
  if (key === 'outfit') opts = OUTFIT.map((o, i) => o.npc ? '' : `<button class="opt${S.look.outfit === i ? ' on' : ''}" data-opt="${i}" ${o.id && !owns(o.id) ? 'disabled style="opacity:.45"' : ''}><i style="background:linear-gradient(135deg,#${o.a.toString(16).padStart(6, 0)} 50%,#${o.b.toString(16).padStart(6, 0)} 50%)"></i>${o.n}${o.id && !owns(o.id) ? `<small>${o.id === 'o6' ? 'claim the outpost' : 'in the shop'}</small>` : ''}</button>`).join('');
  else opts = list.map((v, i) => `<button class="opt${S.look[key] === i ? ' on' : ''}" data-opt="${i}">${typeof v === 'number' ? `<i style="background:#${v.toString(16).padStart(6, 0)}"></i>` : v}</button>`).join('');
  $('#crOpts').innerHTML = `<h3 class="lbl">${title}</h3><div class="grid">${opts}</div>`;
}
function openCreator() { if (player.mount) dismount(true); mode = 'creator'; crYaw = 0; $('#panel').hidden = true; $('#hud').hidden = true; $('#title').hidden = true; $('#creator').hidden = false; $('#crGo').textContent = S.created ? 'Done' : 'Wake on the shore'; document.exitPointerLock?.(); renderCreator(); }
function closeCreator() { $('#creator').hidden = true; const first = !S.created; S.created = true; save(); startPlay(first); }

// ---------- input
function initInput() {
  const cv = $('#gl');
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return; if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); if (e.repeat) return; keys[e.code] = true; initAudio();
    if (mode === 'panel') { if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyI') closePanel(); return; }
    if (mode !== 'play') return;
    const p = player, dg = e.code.startsWith('Digit') ? +e.code[5] : 0;
    if (wheelOpen) { if (e.code === 'KeyG' || e.code === 'Escape') { closeWheel(); grab(); } return; }
    if (p.build) { if (dg >= 1 && dg <= PIECES.length) { buildSel = dg - 1; renderBuildBar(); sfx('click'); } if (e.code === 'KeyR') buildRot = (buildRot + 1) % 4; if (e.code === 'KeyX') removeFacing(); if (e.code === 'KeyB' || e.code === 'Escape') setBuild(false); if (e.code === 'Tab') openPanel('bag'); return; }
    if (dg >= 1 && dg <= 4) setSlot(dg - 1); if (dg === 5) eat(); if (dg === 6) heal();
    if (e.code === 'KeyE' && p.near) p.near.go(); if (e.code === 'KeyF' && p.nearF) p.nearF.go();
    if (e.code === 'Tab' || e.code === 'KeyI') openPanel('bag'); if (e.code === 'Escape') openPanel();
    if (e.code === 'KeyB' && !p.mount) setBuild(true); if (e.code === 'KeyG') openWheel(); if (e.code === 'KeyV') p.fp = !p.fp;
    if (e.code === 'KeyQ') { const pk = dinos.filter(d => d.tamed && d.alive && !d.rider); if (pk.length) { const s = !pk[0].stay; pk.forEach(d => d.stay = s); toast(s ? 'Pack: wait here' : 'Pack: follow me'); sfx('click'); } }
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; inp.lmb = false; });
  cv.addEventListener('mousedown', e => { initAudio(); if (mode === 'creator') return; if (mode !== 'play' || e.button !== 0) return; if (!inp.locked && !inp.touch) { grab(); if (everLocked || lockTries++ < 1) return; } inp.lmb = true; inp.lmbHit = true; });
  addEventListener('mouseup', e => { if (e.button === 0) inp.lmb = false; });
  addEventListener('mousemove', e => { if (mode === 'creator' && e.buttons) crYaw += e.movementX * .01; if (mode !== 'play') return; if (inp.locked || e.buttons) { inp.mx += e.movementX; inp.my += e.movementY; } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => { if (mode !== 'play' || player.build) return; const own = [0, 1, 2, 3].filter(i => i === 0 || S.tools[SLOTS[i]]), i = own.indexOf(player.slot); setSlot(own[(i + (e.deltaY > 0 ? 1 : own.length - 1)) % own.length]); }, { passive: true });
  document.addEventListener('pointerlockchange', () => { inp.locked = document.pointerLockElement === cv; if (inp.locked) everLocked = true; else if (mode === 'play' && !wheelOpen && !player.build) openPanel(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  // every button in the DOM goes through here
  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return; const d = t.dataset; initAudio();
    if (d.slot !== undefined) { const i = +d.slot; if (i < 4) setSlot(i); else if (i === 4) eat(); else heal(); }
    else if (d.piece !== undefined) { buildSel = +d.piece; renderBuildBar(); }
    else if (d.tab) { panelTab = d.tab; renderPanel(); sfx('click'); }
    else if (d.craft) craft(d.craft); else if (d.buy) buy(d.buy);
    else if (d.stay) { const dn = dinos.find(q => String(q.tid) === d.stay); if (dn) dn.stay = !dn.stay; renderPanel(); }
    else if (d.q) { S.opt.q = d.q; applyQuality(); renderPanel(); save(); }
    else if (d.emote) { const em = EMOTES.find(q => q[0] === d.emote); if (em[2] && !owns(em[2])) { sfx('deny'); return; } player.emote = d.emote; closeWheel(); grab(); sfx('click'); }
    else if (d.cat !== undefined) { crCat = +d.cat; renderCreator(); sfx('click'); }
    else if (d.opt !== undefined) { S.look[CATS[crCat][0]] = +d.opt; rebuildPlayer(); renderCreator(); sfx('click'); }
    else if (d.act === 'close') closePanel(); else if (d.act === 'look') openCreator(); else if (d.act === 'crate') openCrate();
    else if (d.act === 'title') { save(); location.reload(); }
    else if (d.act === 'reset') { if (t.dataset.sure) { try { localStorage.removeItem(SAVE_KEY); } catch { } location.reload(); } else { t.dataset.sure = 1; t.textContent = 'Really erase everything?'; } }
    else if (t.id === 'tPlay') { if (S.created) startPlay(); else openCreator(); }
    else if (t.id === 'tNew') { if (t.dataset.sure) { const o = S.opt; S = fresh(); S.opt = o; save(); location.reload(); } else { t.dataset.sure = 1; t.textContent = 'Erase the old save?'; } }
    else if (t.id === 'crGo') closeCreator();
    else if (t.id === 'crRand') { const r = n => Math.random() * n | 0; Object.assign(S.look, { body: r(BODY.length), skin: r(SKIN.length), hair: r(HAIR.length), hairCol: r(HAIRCOL.length), beard: r(BEARD.length), paint: r(PAINT.length) }); rebuildPlayer(); renderCreator(); sfx('click'); }
    else if (t.id === 'deadGo') respawn();
  });
  $('#wheel').addEventListener('click', e => { if (e.target.id === 'wheel') { closeWheel(); grab(); } });
  document.addEventListener('input', e => { if (e.target.id === 'oSens') S.opt.sens = +e.target.value; if (e.target.id === 'oVol') { S.opt.vol = +e.target.value; if (audio.out) audio.out.gain.value = S.opt.vol; } });
  // touch: left side is a floating stick, right side drags the camera
  let stickId = null, sx = 0, sy = 0, lookId = null, lx = 0, ly = 0; const stick = $('#stick');
  const onTouch = () => { if (inp.touch) return; inp.touch = true; document.body.classList.add('touch'); $('#touch').hidden = mode !== 'play'; };
  addEventListener('touchstart', onTouch, { passive: true });
  cv.addEventListener('touchstart', e => { onTouch(); initAudio(); e.preventDefault(); for (const t of e.changedTouches) { if (mode === 'creator') { lookId = t.identifier; lx = t.clientX; continue; } if (t.clientX < innerWidth * .42 && stickId === null) { stickId = t.identifier; sx = t.clientX; sy = t.clientY; stick.style.display = 'block'; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; } } }, { passive: false });
  cv.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) { if (t.identifier === stickId) { let dx = (t.clientX - sx) / 50, dy = (t.clientY - sy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } inp.jx = dx; inp.jy = dy; stick.firstChild.style.transform = `translate(${dx * 32}px,${dy * 32}px)`; } if (t.identifier === lookId) { if (mode === 'creator') crYaw += (t.clientX - lx) * .01; else { inp.mx += (t.clientX - lx) * 2.4; inp.my += (t.clientY - ly) * 2.4; } lx = t.clientX; ly = t.clientY; } } }, { passive: false });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === stickId) { stickId = null; inp.jx = inp.jy = 0; stick.style.display = 'none'; stick.firstChild.style.transform = ''; } if (t.identifier === lookId) lookId = null; } };
  cv.addEventListener('touchend', end); cv.addEventListener('touchcancel', end);
  const hold = (id, down, up) => { const b = $(id); b.addEventListener('touchstart', e => { e.preventDefault(); onTouch(); initAudio(); down(); }, { passive: false }); b.addEventListener('touchend', e => { e.preventDefault(); up && up(); }); };
  hold('#tAtk', () => { inp.lmb = true; inp.lmbHit = true; }, () => inp.lmb = false); hold('#tJump', () => keys.Space = true, () => keys.Space = false);
  hold('#tUse', () => { inp.useHold = true; if (player.near && mode === 'play') player.near.go(); }, () => inp.useHold = false); hold('#tFeed', () => { if (player.nearF && mode === 'play') player.nearF.go(); });
  hold('#tBag', () => openPanel('bag')); hold('#tBuild', () => { if (mode === 'play' && !player.mount) setBuild(!player.build); }); hold('#tEmo', () => openWheel());
}
