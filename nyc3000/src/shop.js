// Pause-menu screens: the SHOP (cars, guns, supplies) and the CHALLENGES board.
// Each shop card shows a little 3D picture of the real model, rendered once.
import * as THREE from 'three';
import { VEHICLE_TYPES, WEAPONS, makeVehicleMesh, makeGun } from './models.js';
import { PRICES } from './game.js';
import { TYPES, CRED_LEVELS } from './challenges.js';

export const CAR_SHOP = [
  { type: 'sedan', price: 400, cred: 0, paint: '#1a6bd8' },
  { type: 'muscle', price: 900, cred: 0, paint: '#d8c21a' },
  { type: 'taxi', price: 1500, cred: 1, paint: '#f2c21a' },
  { type: 'hover', price: 2500, cred: 2, paint: '#c01848' },
  { type: 'police', price: 3500, cred: 3, paint: '#121318' },
  { type: 'flypolice', price: 5000, cred: 4, paint: '#121318' },
];
const SUPPLIES = [
  { id: 'ammo', name: 'AMMO PACK', text: 'Refills every gun you own', color: '#ffa43a' },
  { id: 'medkit', name: 'MEDKIT', text: 'Full health and shield', color: '#3aff7a' },
];

const $ = id => document.getElementById(id);
const thumbs = {};
const money = n => '$' + Math.floor(n).toLocaleString('en-US');

// render a model into a small picture with the game's renderer
function thumbnail(ctx, key, make, view) {
  if (thumbs[key]) return thumbs[key];
  const { renderer, scene: main } = ctx;
  const W = 480, H = 280;
  const rt = new THREE.WebGLRenderTarget(W, H);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1634);
  scene.environment = main.environment;
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x3a2050, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(3, 5, 2); scene.add(sun);
  const back = new THREE.DirectionalLight(0xff4ab0, 1.4); back.position.set(-3, 2, -4); scene.add(back);
  const obj = make(); scene.add(obj); obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  const cam = new THREE.PerspectiveCamera(28, W / H, 0.01, 200);
  cam.position.copy(c).add(new THREE.Vector3(...view).normalize().multiplyScalar(size * 1.55));
  cam.lookAt(c);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(scene, cam);
  const buf = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prev); rt.dispose();
  const big = document.createElement('canvas'); big.width = W; big.height = H;
  const bctx = big.getContext('2d'), img = bctx.createImageData(W, H);
  const lut = new Uint8Array(256); for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, 1 / 2.2));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4;
    img.data[o] = lut[buf[s]]; img.data[o + 1] = lut[buf[s + 1]]; img.data[o + 2] = lut[buf[s + 2]]; img.data[o + 3] = 255;
  }
  bctx.putImageData(img, 0, 0);
  const small = document.createElement('canvas'); small.width = W / 2; small.height = H / 2;
  small.getContext('2d').drawImage(big, 0, 0, W / 2, H / 2); // downscale = smooth edges
  return (thumbs[key] = small.toDataURL('image/jpeg', 0.85));
}

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
