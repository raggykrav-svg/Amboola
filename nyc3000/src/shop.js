// Pause-menu screens: the SHOP (cars, guns, supplies) and the CHALLENGES board.
// Each shop card shows a little 3D picture of the real model, rendered once.
import * as THREE from 'three';
import { VEHICLE_TYPES, WEAPONS, makeVehicleMesh, makeGun } from './models.js';
import { PRICES } from './game.js';
import { TYPES, CRED_LEVELS } from './challenges.js';
import { thumbnail } from './thumbs.js';
import { IMPLANTS } from './activities.js';
import { SKILLS, MEDALS, MAX_RANK, xpFor } from './progress.js';
import { CAR_UPGRADES, GUN_UPGRADES, GLOWS, PAINT_JOBS, GLOW_PRICE, PAINT_PRICE, buyCarUpgrade, buyGunUpgrade, setGlow, setPaint } from './upgrades.js';
import { DECOR, HOME_PRICE } from './home.js';
export const DOG_PRICE = 800;

export const CAR_SHOP = [
  { type: 'sedan', price: 400, cred: 0, paint: '#1a6bd8' },
  { type: 'bike', price: 700, cred: 0, paint: '#1a8ad8' },
  { type: 'chopper', price: 1200, cred: 0, paint: '#2a1a2a' },
  { type: 'compact', price: 300, cred: 0, paint: '#ff4ab0' },
  { type: 'muscle', price: 900, cred: 0, paint: '#d8c21a' },
  { type: 'van', price: 1100, cred: 0, paint: '#e8e8f0' },
  { type: 'taxi', price: 1500, cred: 1, paint: '#f2c21a' },
  { type: 'hover', price: 2500, cred: 2, paint: '#c01848' },
  { type: 'super', price: 4200, cred: 3, paint: '#c01848' },
  { type: 'police', price: 3500, cred: 3, paint: '#121318' },
  { type: 'flypolice', price: 5000, cred: 4, paint: '#121318' },
];
const SUPPLIES = [
  { id: 'ammo', name: 'AMMO PACK', text: 'Refills every gun you own', color: '#ffa43a' },
  { id: 'medkit', name: 'MEDKIT', text: 'Full health and shield', color: '#3aff7a' },
];

const $ = id => document.getElementById(id);
const money = n => '$' + Math.floor(n).toLocaleString('en-US');


function credLine(g) {
  const lvl = g.credLevel, next = CRED_LEVELS[lvl + 1];
  return next ? `STREET CRED ${lvl} · ${g.cred} / ${next}` : `STREET CRED ${lvl} · MAX`;
}

export function renderShop(ctx, tab = 'cars') {
  const g = ctx.game;
  $('shopCash').textContent = money(g.cash);
  $('shopCred').textContent = credLine(g);
  document.querySelectorAll('#shopTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const say = (msg, ok) => { const m = $('shopMsg'); m.textContent = msg; m.className = 'shop-msg ' + (ok ? 'ok' : 'bad'); };
  const card = (img, name, stats, btnText, disabled, locked, owned, onClick) => {
    const el = document.createElement('div');
    el.className = 'card' + (locked ? ' locked' : '') + (owned ? ' owned' : '');
    el.innerHTML = `<div class="pic">${img ? `<img src="${img}" alt="">` : ''}</div><div class="card-name"></div><div class="card-stats"></div><button class="buy"></button>`;
    el.querySelector('.card-name').textContent = name;
    el.querySelector('.card-stats').textContent = stats;
    const b = el.querySelector('.buy'); b.textContent = btnText; b.disabled = disabled;
    b.onclick = () => { onClick(); ctx.audio.play('ui'); };
    return el;
  };
  const grid = $('shopGrid'); grid.innerHTML = '';
  if (tab === 'cars') {
    for (const it of CAR_SHOP) {
      const def = VEHICLE_TYPES[it.type], owned = g.garage.has(it.type), locked = !owned && g.credLevel < it.cred;
      const img = thumbnail(ctx, 'car-' + it.type, () => makeVehicleMesh(it.type, it.paint), [-1.2, 0.55, -1.4]);
      const kmh = Math.round(def.maxSpeed * 3.6 * (def.flying ? 1.4 : 1));
      const stats = `${def.flying ? 'FLIES · ' : ''}${kmh} KM/H · ARMOR ${def.armor}${def.cannon ? ' · CANNON' : ''}`;
      const text = owned ? 'DELIVER (FREE)' : locked ? `LOCKED · STREET CRED ${it.cred}` : `BUY ${money(it.price)}`;
      grid.appendChild(card(img, def.name, stats, text, locked || (!owned && g.cash < it.price), locked, owned, () => {
        const r = g.buyCar(it.type, it.price, it.cred);
        if (r === 'ok') say(`${def.name} is yours! It's parked next to you.`, true);
        else if (r === 'delivered') say(`Your ${def.name} is parked next to you.`, true);
        else say(r === 'cash' ? 'Not enough cash.' : 'Earn more Street Cred in challenges first.', false);
        renderShop(ctx, tab);
      }));
    }
  } else if (tab === 'upgrades') {
    const res = (r, okText) => say(r === 'ok' ? okText : r === 'cash' ? 'Not enough cash.' : 'Already at the top level.', r === 'ok');
    const icon = (el, ch, col) => { el.querySelector('.pic').innerHTML = `<span style="color:${col};font-size:42px">${ch}</span>`; el.classList.add('supply'); };
    for (const U of CAR_UPGRADES) {
      const lvl = g.upg[U.id] || 0, max = lvl >= U.prices.length;
      const lv = U.prices.length > 1 ? ` · LEVEL ${lvl}/${U.prices.length}` : lvl ? ' · INSTALLED' : '';
      const el = card(null, U.name, U.text + lv, max ? (U.prices.length > 1 ? 'MAX LEVEL' : 'INSTALLED') : `BUY ${money(U.prices[lvl])}`, max || g.cash < U.prices[lvl], false, max, () => { res(buyCarUpgrade(g, U.id), `${U.name} installed on all your rides!`); renderShop(ctx, tab); });
      icon(el, U.icon, U.color); grid.appendChild(el);
    }
    // colour pickers: underglow and paint
    const swatches = (name, text, list, cur, price, onPick) => {
      const el = card(null, name, text, '', true, false, false, () => {});
      el.classList.add('supply');
      const b = el.querySelector('.buy'); b.remove();
      const row = document.createElement('div'); row.className = 'swatches';
      for (const c of list) { const s = document.createElement('button'); s.style.background = c; s.className = cur === c ? 'on' : ''; s.title = c; s.disabled = g.cash < price && cur !== c; s.onclick = () => { onPick(c); ctx.audio.play('ui'); renderShop(ctx, tab); }; row.appendChild(s); }
      el.appendChild(row);
      return el;
    };
    const gl = swatches('NEON UNDERGLOW', g.upg.glow ? 'Pick a colour (free to change)' : `Glowing lights under your car · ${money(GLOW_PRICE)}`, GLOWS, g.upg.glow, g.upg.glow ? 0 : GLOW_PRICE, c => res(setGlow(g, c), 'Underglow on! Get in a car to see it.'));
    gl.querySelector('.pic').innerHTML = `<span style="color:${g.upg.glow || '#29f3ff'};font-size:42px">▂▂</span>`; grid.appendChild(gl);
    const pj = swatches('PAINT JOB', `A new colour for all your own cars · ${money(PAINT_PRICE)}`, PAINT_JOBS, g.upg.paint, PAINT_PRICE, c => res(setPaint(g, c), 'Fresh paint on all your cars!'));
    pj.querySelector('.pic').innerHTML = `<span style="color:${g.upg.paint || '#c01848'};font-size:42px">🖌</span>`; grid.appendChild(pj);
    // guns you own
    WEAPONS.forEach((w, i) => {
      if (!g.player.owned[i]) return;
      for (const U of GUN_UPGRADES) {
        const lvl = (g.upg.gun[w.id] && g.upg.gun[w.id][U.id]) || 0, max = lvl >= U.prices.length;
        const img = thumbnail(ctx, 'gun-' + w.id, () => makeGun(w.id), [1.0, 0.25, 0.35]);
        grid.appendChild(card(img, `${w.name}: ${U.name}`, `${U.text} · LEVEL ${lvl}/${U.prices.length}`, max ? 'MAX LEVEL' : `BUY ${money(U.prices[lvl])}`, max || g.cash < U.prices[lvl], false, max, () => { res(buyGunUpgrade(g, i, U.id), `${w.name} upgraded!`); renderShop(ctx, tab); }));
      }
    });
  } else if (tab === 'home') {
    const H = g.home, res = (r, okText) => say(r === 'ok' ? okText : r === 'cash' ? 'Not enough cash.' : r === 'home' ? 'Buy the apartment first!' : 'You already have it.', r === 'ok');
    const icon = (el, ch, col) => { el.querySelector('.pic').innerHTML = `<span style="color:${col};font-size:42px">${ch}</span>`; el.classList.add('supply'); };
    const ap = card(null, 'YOUR OWN APARTMENT', 'A penthouse near Times Square with a view, a hot tub and a garage for 4 of your cars. Sleep in the bed to save.', H.owned ? 'YOURS! (HOUSE ICON ON THE MAP)' : `BUY ${money(HOME_PRICE)}`, H.owned || g.cash < HOME_PRICE, false, H.owned, () => { res(H.buy(), 'The apartment is yours! The GPS shows you the way home.'); renderShop(ctx, tab); });
    icon(ap, '🏠', '#ffd23a'); grid.appendChild(ap);
    const dog = card(null, 'ROBOT DOG: SPARKY', 'Follows you, fights bad guys and fetches ammo, health and cash for you.', g.buddy.owned ? 'YOUR BEST FRIEND' : `ADOPT ${money(DOG_PRICE)}`, g.buddy.owned || g.cash < DOG_PRICE, false, g.buddy.owned, () => {
      if (g.cash >= DOG_PRICE && !g.buddy.owned) { g.cash -= DOG_PRICE; g.buddy.adopt(); ctx.audio.play('cash'); say('Sparky is waiting for you! WOOF!', true); } renderShop(ctx, tab);
    });
    icon(dog, '🐕', '#3aff9a'); grid.appendChild(dog);
    for (const it of DECOR) {
      const own = H.items.has(it.id), locked = !H.owned;
      const el = card(null, it.name, it.text, own ? 'IN YOUR HOME' : locked ? `${money(it.price)} · BUY THE APARTMENT FIRST` : `BUY ${money(it.price)}`, own || locked || g.cash < it.price, locked, own, () => { res(H.buyItem(it.id), `${it.name} is in your apartment now!`); renderShop(ctx, tab); });
      icon(el, it.icon, it.color); grid.appendChild(el);
    }
  } else if (tab === 'cyber') {
    // implants: you can look anywhere, but only a cyber clinic can put them in
    if (!g.atClinic) say('Implants are installed at a CYBER CLINIC (white dots on the minimap, green cross sign).', false);
    for (const it of IMPLANTS) {
      const owned = g.implants.has(it.id), locked = !owned && g.credLevel < it.cred;
      const text = owned ? 'INSTALLED' : locked ? `LOCKED · STREET CRED ${it.cred}` : !g.atClinic ? `${money(it.price)} · AT A CLINIC` : `INSTALL ${money(it.price)}`;
      const el = card(null, `${it.name}`, `${it.slot} · ${it.text}`, text, owned || locked || !g.atClinic || g.cash < it.price, locked, owned, () => {
        const r = g.acts.buyImplant(it.id);
        say(r === 'ok' ? `${it.name} installed!` : r === 'cash' ? 'Not enough cash.' : r === 'clinic' ? 'Go to a cyber clinic.' : 'Earn more Street Cred first.', r === 'ok');
        renderShop(ctx, tab);
      });
      el.querySelector('.pic').innerHTML = `<span style="color:${it.color};font-size:44px">${{ LEGS: '⚡', SKIN: '⬢', HEART: '♥', EYES: '◉', BRAIN: '⌛' }[it.slot]}</span>`;
      el.classList.add('supply');
      grid.appendChild(el);
    }
  } else {
    WEAPONS.forEach((w, i) => {
      if (!w.price) return;
      const owned = g.player.owned[i], locked = !owned && g.credLevel < (w.cred || 0);
      const img = thumbnail(ctx, 'gun-' + w.id, () => makeGun(w.id), [1.0, 0.25, 0.35]);
      const stats = `DAMAGE ${w.dmg * w.pellets}${w.explode ? ' + BLAST' : ''} · ${w.auto ? 'AUTO' : 'SINGLE'} · MAG ${w.mag}${w.zoom ? ' · ZOOM' : ''}`;
      const text = owned ? `OWNED · KEY ${i + 1}` : locked ? `LOCKED · STREET CRED ${w.cred}` : `BUY ${money(w.price)}`;
      grid.appendChild(card(img, w.name, stats, text, owned || locked || g.cash < w.price, locked, owned, () => {
        const r = g.buyGun(i);
        say(r === 'ok' ? `${w.name} bought! Press ${i + 1} to use it.` : r === 'cash' ? 'Not enough cash.' : 'Earn more Street Cred in challenges first.', r === 'ok');
        renderShop(ctx, tab);
      }));
    });
    for (const sp of SUPPLIES) {
      const price = PRICES[sp.id];
      const el = card(null, sp.name, sp.text, `BUY ${money(price)}`, g.cash < price, false, false, () => {
        const r = g.buySupply(sp.id);
        say(r === 'ok' ? `${sp.name} bought.` : r === 'full' ? (sp.id === 'ammo' ? 'Your ammo is already full.' : 'You are already healthy.') : 'Not enough cash.', r === 'ok');
        renderShop(ctx, tab);
      });
      el.querySelector('.pic').innerHTML = `<span style="color:${sp.color}">${sp.id === 'ammo' ? '▮▮▮' : '✚'}</span>`;
      el.classList.add('supply');
      grid.appendChild(el);
    }
  }
}

export function renderChallenges(ctx) {
  const g = ctx.game, rows = g.ch.list();
  $('chCred').textContent = credLine(g);
  $('chCount').textContent = `${rows.filter(r => r.done).length} / ${rows.length} DONE`;
  const lvl = g.credLevel, lo = CRED_LEVELS[lvl], hi = CRED_LEVELS[lvl + 1] || lo + 1;
  $('chCredFill').style.width = Math.min(100, (g.cred - lo) / (hi - lo) * 100) + '%';
  const list = $('chList'); list.innerHTML = '';
  for (const r of rows) {
    const el = document.createElement('div');
    el.className = 'ch-row' + (r.done ? ' done' : '') + (r.tracked ? ' tracked' : '');
    el.innerHTML = `<span class="ch-icon"></span><div class="ch-text"><div class="ch-type"></div><div class="ch-name"></div></div>
      <div class="ch-reward"></div><div class="ch-dist"></div><button class="mbtn small"></button>`;
    el.querySelector('.ch-icon').textContent = r.type.icon;
    el.querySelector('.ch-icon').style.color = r.type.color;
    el.querySelector('.ch-type').textContent = r.type.label;
    el.querySelector('.ch-type').style.color = r.type.color;
    el.querySelector('.ch-name').textContent = r.def.name;
    el.querySelector('.ch-reward').textContent = `${money(r.def.cash)} · +${r.def.cred} SC`;
    el.querySelector('.ch-dist').textContent = r.done ? 'DONE ✔' : r.active ? 'ACTIVE' : `${r.dist} m`;
    const b = el.querySelector('button');
    b.textContent = r.done ? 'DONE' : r.tracked ? 'UNTRACK' : 'TRACK';
    b.disabled = r.done;
    b.onclick = () => { g.ch.track(r.def.id); ctx.audio.play('ui'); renderChallenges(ctx); };
    list.appendChild(el);
  }
}

export { TYPES };

// SKILLS & MEDALS: spend skill points, see the medals you've won
export function renderProfile(ctx, tab = 'skills') {
  const g = ctx.game, P = g.prog;
  $('pfLevel').textContent = `LEVEL ${P.level}`;
  $('pfXP').textContent = P.level >= 30 ? 'MAX LEVEL' : `${P.xp} / ${xpFor(P.level)} XP to level ${P.level + 1}`;
  $('pfFill').style.width = (P.level >= 30 ? 100 : P.xp / xpFor(P.level) * 100) + '%';
  document.querySelectorAll('#pfTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const grid = $('pfGrid'); grid.innerHTML = '';
  if (tab === 'skills') {
    $('pfHelp').innerHTML = `You get XP for everything: challenges, beating bad guys, races, story missions, golden robots, neon tags… Every level gives a <b>skill point</b>. You have <b style="color:#3aff9a">${P.points} skill point${P.points === 1 ? '' : 's'}</b>.`;
    for (const sk of SKILLS) {
      const r = P.rank(sk.id), el = document.createElement('div');
      el.className = 'pf-card' + (r >= MAX_RANK ? ' max' : '');
      el.innerHTML = `<div class="pf-icon"></div><div class="pf-text"><b></b><span></span><div class="pips">${[0, 1, 2].map(i => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div></div><button class="mbtn small"></button>`;
      el.querySelector('.pf-icon').textContent = sk.icon; el.querySelector('.pf-icon').style.color = sk.color;
      el.querySelector('b').textContent = sk.name; el.querySelector('span').textContent = sk.text;
      const b = el.querySelector('button');
      b.textContent = r >= MAX_RANK ? 'MAX' : `RANK ${r + 1}`; b.disabled = r >= MAX_RANK || P.points <= 0;
      b.onclick = () => { if (P.buySkill(sk.id)) ctx.audio.play('objective'); renderProfile(ctx, tab); };
      grid.appendChild(el);
    }
  } else {
    $('pfHelp').innerHTML = `<b>${P.medals.size} / ${MEDALS.length}</b> medals · golden robot statues found: <b style="color:#ffd23a">${P.statues.size} / ${P.spots.length || 20}</b> (they glow gold: look on rooftops, in alleys and on the highway)`;
    for (const m of MEDALS) {
      const got = P.medals.has(m.id), el = document.createElement('div');
      el.className = 'pf-medal' + (got ? ' got' : '');
      el.innerHTML = `<div class="pf-icon"></div><b></b><span></span>`;
      el.querySelector('.pf-icon').textContent = got ? m.icon : '?';
      el.querySelector('b').textContent = m.name; el.querySelector('span').textContent = m.text;
      grid.appendChild(el);
    }
  }
}
