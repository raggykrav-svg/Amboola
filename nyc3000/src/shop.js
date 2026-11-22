// Pause-menu screens: the SHOP (cars, guns, supplies) and the CHALLENGES board.
// Each shop card shows a little 3D picture of the real model, rendered once.
import * as THREE from 'three';
import { VEHICLE_TYPES, WEAPONS, makeVehicleMesh, makeGun } from './models.js';
import { PRICES } from './game.js';
import { TYPES, CRED_LEVELS } from './challenges.js';
import { thumbnail } from './thumbs.js';

export const CAR_SHOP = [
  { type: 'sedan', price: 400, cred: 0, paint: '#1a6bd8' },
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
