// Upgrades for your cars and guns (SHOP → UPGRADES): engine, armour, nitro, neon underglow,
// paint, and more damage / bigger magazines for each gun.
import * as THREE from 'three';
import { WEAPONS } from './models.js';
import { MAT, paintMat } from './parts.js';

export const CAR_UPGRADES = [
  { id: 'engine', name: 'ENGINE TUNE', text: '+10% top speed per level', prices: [600, 1200, 2000], icon: '⚙', color: '#ffa43a' },
  { id: 'armor', name: 'ARMOR PLATING', text: '+30% car integrity per level', prices: [500, 1000, 1600], icon: '⛨', color: '#29f3ff' },
  { id: 'nitro', name: 'NITRO BOOST', text: 'Hold SHIFT (or N in a flying car) for a speed boost', prices: [1500], icon: '🔥', color: '#ff5a4e' },
];
export const GLOWS = ['#29f3ff', '#ff2bd6', '#3aff9a', '#ffd23a', '#ff5a4e', '#b98cff'];
export const PAINT_JOBS = ['#c01848', '#1a6bd8', '#18a050', '#f2c21a', '#ff6a1a', '#8a2be2', '#e8e8f0', '#15151c'];
export const GLOW_PRICE = 400, PAINT_PRICE = 200;
export const GUN_UPGRADES = [
  { id: 'dmg', name: 'DAMAGE', text: '+15% damage', prices: [400, 800, 1400] },
  { id: 'mag', name: 'BIG MAGAZINE', text: '+30% bullets per magazine', prices: [300, 700] },
];

export function newUpgrades(save) {
  const u = (save && save.upg) || {};
  return { engine: u.engine || 0, armor: u.armor || 0, nitro: u.nitro || 0, glow: u.glow || null, paint: u.paint || null, gun: { ...(u.gun || {}) } };
}
export function magSize(game, i) {
  const w = WEAPONS[i], lvl = (game.upg && game.upg.gun[w.id]?.mag) || 0;
  return Math.round(w.mag * (1 + 0.3 * lvl));
}

// buy one step of an upgrade; returns 'ok', 'cash', 'max'
export function buyCarUpgrade(g, id) {
  const U = CAR_UPGRADES.find(x => x.id === id), lvl = g.upg[id] || 0;
  if (lvl >= U.prices.length) return 'max';
  if (g.cash < U.prices[lvl]) return 'cash';
  g.cash -= U.prices[lvl]; g.upg[id] = lvl + 1; g.audio.play('cash'); g.prog.medal('tuned');
  if (g.player.vehicle) applyToCar(g, g.player.vehicle, true);
  return 'ok';
}
export function buyGunUpgrade(g, wi, id) {
  const w = WEAPONS[wi], U = GUN_UPGRADES.find(x => x.id === id);
  const cur = g.upg.gun[w.id] || (g.upg.gun[w.id] = { dmg: 0, mag: 0 }), lvl = cur[id] || 0;
  if (lvl >= U.prices.length) return 'max';
  if (g.cash < U.prices[lvl]) return 'cash';
  g.cash -= U.prices[lvl]; cur[id] = lvl + 1; g.audio.play('cash'); g.prog.medal('tuned');
  return 'ok';
}
export function setGlow(g, hex) {
  if (!g.upg.glow && g.cash < GLOW_PRICE) return 'cash';
  if (!g.upg.glow) { g.cash -= GLOW_PRICE; g.prog.medal('tuned'); }
  g.upg.glow = hex; g.audio.play('cash');
  if (g.player.vehicle) applyToCar(g, g.player.vehicle, true);
  return 'ok';
}
export function setPaint(g, hex) {
  if (g.cash < PAINT_PRICE) return 'cash';
  g.cash -= PAINT_PRICE; g.upg.paint = hex; g.audio.play('cash'); g.prog.medal('tuned');
  for (const v of g.vehicles) if (v.owned) repaint(v, hex);
  return 'ok';
}
function repaint(v, hex) {
  const paints = new Set(Object.values(MAT.paint));
  v.mesh.traverse(o => { if (o.isMesh && paints.has(o.material)) o.material = paintMat(hex); });
}
const glowGeo = new THREE.PlaneGeometry(1, 1);
// when you get in: armour, underglow and (for your own cars) your paint job
export function applyToCar(g, v, again) {
  const u = g.upg;
  const m = 1 + 0.3 * (u.armor || 0);
  if (v.armorMult !== m) { const k = m / (v.armorMult || 1); v.maxHealth *= k; v.health *= k; v.armorMult = m; }
  if (u.glow) {
    if (!v.glow) {
      v.glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      v.glow.rotation.x = -Math.PI / 2; v.glow.position.y = v.flying ? -0.35 : 0.06;
      v.glow.scale.set(v.def.bike ? 1.2 : 2.8, v.def.bike ? 2.6 : 5.2, 1);
      v.mesh.add(v.glow);
    }
    v.glow.material.color.set(u.glow).multiplyScalar(1.4); v.cityGlow = false; v.glow.visible = true;
  }
  if (u.paint && v.owned && !v.def.police && v.type !== 'taxi' && (again || v.paintJob !== u.paint)) { repaint(v, u.paint); v.paintJob = u.paint; }
}
