// Procedural textures, painted on canvases at load time (no image downloads).
import * as THREE from 'three';

const TS = 256;          // facade tile size (px)
export const FCOLS = 12; // facade atlas columns (styles)
export const FROWS = 4;  // rows: 0 upper floor, 1 ground (homes), 2 ground (shops), 3 ground (open parking)

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ facade atlas
// colour canvas + mask canvas. Mask: 255 wall (tinted by the building colour), 128 frames/shutters, 0 glass (lit at night)
export function makeFacadeAtlas(renderer) {
  const W = TS * FCOLS, H = TS * FROWS;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const mk = document.createElement('canvas'); mk.width = W; mk.height = H;
  const c = cv.getContext('2d'), m = mk.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  m.fillStyle = '#ffffff'; m.fillRect(0, 0, W, H);
  const R = rng(42);
  // tile origin: column col, row r (row 0 is drawn at the canvas bottom so v grows upwards after the flip)
  let X = 0, Y = 0;
  const at = (col, row) => { X = col * TS; Y = (FROWS - 1 - row) * TS; };
  const px = (u) => X + u * TS, py = (v) => Y + v * TS; // u,v in 0..1 inside the tile, v from the top
  const box = (u0, v0, u1, v1, col, mask) => {
    c.fillStyle = col; c.fillRect(px(u0), py(v0), (u1 - u0) * TS, (v1 - v0) * TS);
    m.fillStyle = `rgb(${mask},${mask},${mask})`; m.fillRect(px(u0), py(v0), (u1 - u0) * TS, (v1 - v0) * TS);
  };
  const glass = (u0, v0, u1, v1, top = '#3c4a58', bot = '#6f8496') => {
    const g = c.createLinearGradient(0, py(v0), 0, py(v1));
    g.addColorStop(0, top); g.addColorStop(0.55, bot); g.addColorStop(1, top);
    c.fillStyle = g; c.fillRect(px(u0), py(v0), (u1 - u0) * TS, (v1 - v0) * TS);
    m.fillStyle = '#000'; m.fillRect(px(u0), py(v0), (u1 - u0) * TS, (v1 - v0) * TS);
    // a soft sky reflection streak
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.beginPath(); c.moveTo(px(u0 + (u1 - u0) * 0.15), py(v1)); c.lineTo(px(u0 + (u1 - u0) * 0.45), py(v0)); c.lineTo(px(u0 + (u1 - u0) * 0.62), py(v0)); c.lineTo(px(u0 + (u1 - u0) * 0.32), py(v1)); c.fill();
  };
  const frame = (u0, v0, u1, v1, col, t = 0.012) => {
    box(u0, v0, u1, v0 + t, col, 128); box(u0, v1 - t, u1, v1, col, 128);
    box(u0, v0, u0 + t, v1, col, 128); box(u1 - t, v0, u1, v1, col, 128);
  };
  const louvres = (u0, v0, u1, v1, col, dark) => {
    box(u0, v0, u1, v1, col, 128);
    const n = Math.max(4, Math.round((v1 - v0) * 40));
    for (let i = 0; i < n; i++) {
      const v = v0 + (v1 - v0) * (i + 0.6) / n;
      box(u0 + 0.008, v, u1 - 0.008, v + (v1 - v0) / n * 0.32, dark, 128);
    }
    frame(u0, v0, u1, v1, dark, 0.008);
  };
  const shutterRoll = (u0, v0, u1, v1) => {
    box(u0, v0, u1, v1, '#d9d2c2', 128);
    for (let v = v0; v < v1; v += 0.018) box(u0, v, u1, v + 0.005, '#b9b1a0', 128);
  };
  const slab = (v0, v1, col = '#e9e6df') => box(0, v0, 1, v1, col, 200);
  const stones = (fine) => {
    // limestone courses (tinted, with joints)
    const ch = fine ? 0.085 : 0.11;
    for (let v = 0, row = 0; v < 1; v += ch, row++) {
      const off = (row % 2) * 0.17;
      for (let u = -off; u < 1; u += fine ? 0.26 : 0.34) {
        const t = 0.90 + R() * 0.1;
        const g = Math.round(255 * t);
        c.fillStyle = `rgb(${g},${Math.round(g * 0.985)},${Math.round(g * 0.95)})`;
        c.fillRect(px(Math.max(0, u)), py(v), Math.min(1, u + (fine ? 0.26 : 0.34)) * TS - Math.max(0, u) * TS, ch * TS);
      }
      c.fillStyle = 'rgba(90,80,60,0.35)'; c.fillRect(px(0), py(v), TS, 2);
      for (let u = -off; u < 1; u += fine ? 0.26 : 0.34) c.fillRect(px(Math.max(0, u)), py(v), 2, ch * TS);
    }
  };
  const door = (u0, v0, u1, v1, col, panel) => {
    box(u0, v0, u1, v1, col, 128);
    frame(u0, v0, u1, v1, panel, 0.015);
    box(u0 + 0.05, v0 + 0.08, u1 - 0.05, v0 + 0.45, panel, 128);
  };
  const shop = (u0, v0, u1, v1, sign) => {
    box(u0, v0, u1, v0 + 0.16, sign, 128);              // sign band
    glass(u0 + 0.01, v0 + 0.19, u1 - 0.01, v1, '#2c3a46', '#7d93a6');
    frame(u0, v0 + 0.17, u1, v1, '#55595e', 0.014);
    box((u0 + u1) / 2 - 0.006, v0 + 0.19, (u0 + u1) / 2 + 0.006, v1, '#55595e', 128);
    // things in the window
    c.fillStyle = 'rgba(255,230,180,0.18)'; c.fillRect(px(u0 + 0.06), py(v1 - 0.25), (u1 - u0 - 0.12) * TS, 0.2 * TS);
  };
  const pilotis = () => {
    box(0, 0, 1, 1, '#4a4844', 128);
    const g = c.createLinearGradient(0, py(0), 0, py(1)); g.addColorStop(0, '#2c2b29'); g.addColorStop(1, '#5a5650');
    c.fillStyle = g; c.fillRect(px(0), py(0), TS, TS);
    box(0, 0, 0.11, 1, '#ffffff', 255); box(0.89, 0, 1, 1, '#ffffff', 255);   // columns
    box(0, 0, 1, 0.08, '#ffffff', 255);                                       // slab edge
    // a parked car silhouette
    c.fillStyle = '#6d7177'; c.fillRect(px(0.2), py(0.62), 0.6 * TS, 0.22 * TS);
    c.fillStyle = '#3a3d41'; c.fillRect(px(0.3), py(0.52), 0.4 * TS, 0.12 * TS);
    c.fillStyle = '#111'; c.fillRect(px(0.25), py(0.82), 0.1 * TS, 0.08 * TS); c.fillRect(px(0.65), py(0.82), 0.1 * TS, 0.08 * TS);
  };

  // 0: apartment block (Cypriot "polykatoikia"): slab band, balcony door + window with roller shutter box
  at(0, 0); slab(0.92, 1.0); box(0, 0, 1, 0.04, '#f2f0ea', 200);
  // balcony door and a window, each with a roller-shutter box (the typical Cypriot flat)
  box(0.08, 0.12, 0.44, 0.2, '#e4ddcc', 128);
  glass(0.1, 0.2, 0.42, 0.92); shutterRoll(0.1, 0.2, 0.42, 0.4);
  frame(0.09, 0.19, 0.43, 0.92, '#ecebe8', 0.018); box(0.255, 0.2, 0.265, 0.92, '#ecebe8', 128);
  box(0.55, 0.2, 0.9, 0.27, '#e4ddcc', 128);
  glass(0.57, 0.27, 0.88, 0.68); shutterRoll(0.57, 0.27, 0.88, 0.5);
  frame(0.56, 0.26, 0.89, 0.69, '#ecebe8', 0.018); box(0.545, 0.68, 0.9, 0.71, '#ece6d8', 160);
  at(0, 1); slab(0.94, 1.0); door(0.1, 0.22, 0.42, 1.0, '#7c8a96', '#c6c9cc'); glass(0.12, 0.27, 0.40, 0.75); frame(0.1, 0.22, 0.42, 1, '#c6c9cc', 0.016);
  glass(0.55, 0.3, 0.9, 0.75); frame(0.54, 0.29, 0.91, 0.76, '#cfd2d4', 0.014);
  at(0, 2); slab(0.95, 1.0); shop(0.03, 0.06, 0.97, 1.0, '#3b4a5c');
  at(0, 3); pilotis();
  // 1: house: smaller window with green wooden shutters
  at(1, 0); slab(0.95, 1.0, '#f0ece4');
  glass(0.34, 0.3, 0.66, 0.82, '#33404a', '#5f7383'); frame(0.33, 0.29, 0.67, 0.83, '#f4f4f2', 0.02);
  louvres(0.16, 0.29, 0.33, 0.83, '#4f7a5a', '#3d6148'); louvres(0.67, 0.29, 0.84, 0.83, '#4f7a5a', '#3d6148');
  box(0.31, 0.83, 0.69, 0.86, '#e8e2d4', 160);
  at(1, 1); slab(0.96, 1.0, '#e0d9c9'); door(0.32, 0.18, 0.68, 1.0, '#7a5132', '#5b3a22'); box(0.3, 0.15, 0.7, 0.18, '#e9e3d6', 160);
  at(1, 2); slab(0.95, 1.0); shop(0.05, 0.08, 0.95, 1.0, '#6a3b2f');
  at(1, 3); pilotis();
  // 2: old town limestone with tall louvred shutters
  at(2, 0); stones(false);
  box(0.28, 0.1, 0.72, 0.16, '#efe6d0', 160);                // lintel
  glass(0.33, 0.16, 0.67, 0.86, '#2b343c', '#4c5a66');
  louvres(0.33, 0.16, 0.5, 0.86, '#5d7d95', '#46647a'); louvres(0.5, 0.16, 0.67, 0.86, '#5d7d95', '#46647a');
  box(0.29, 0.86, 0.71, 0.9, '#efe6d0', 160);
  at(2, 1); stones(false);
  c.fillStyle = '#efe6d0'; c.beginPath(); c.arc(px(0.5), py(0.3), 0.22 * TS, Math.PI, 0); c.fill();
  m.fillStyle = 'rgb(160,160,160)'; m.beginPath(); m.arc(px(0.5), py(0.3), 0.22 * TS, Math.PI, 0); m.fill();
  door(0.31, 0.3, 0.69, 1.0, '#6b4a2c', '#4f3520');
  c.fillStyle = '#4f3520'; c.beginPath(); c.arc(px(0.5), py(0.31), 0.18 * TS, Math.PI, 0); c.fill();
  at(2, 2); stones(false);
  c.fillStyle = '#efe6d0'; c.beginPath(); c.arc(px(0.5), py(0.34), 0.4 * TS, Math.PI, 0); c.fill();
  glass(0.12, 0.34, 0.88, 1.0, '#2e2a26', '#8a7a66'); frame(0.11, 0.33, 0.89, 1.0, '#3e2e20', 0.018);
  c.fillStyle = '#3a4038'; c.beginPath(); c.arc(px(0.5), py(0.35), 0.36 * TS, Math.PI, 0); c.fill();
  m.fillStyle = '#000'; m.beginPath(); m.arc(px(0.5), py(0.35), 0.36 * TS, Math.PI, 0); m.fill();
  at(2, 3); stones(false); door(0.3, 0.2, 0.7, 1.0, '#6b4a2c', '#4f3520');
  // 3: glass curtain wall tower
  at(3, 0); glass(0, 0, 1, 0.86, '#3d5568', '#8fb0c6'); box(0, 0.86, 1, 1, '#4b5763', 128);
  for (let u = 0; u < 1; u += 0.3333) box(u, 0, u + 0.012, 1, '#a9b3bb', 128);
  box(0, 0.42, 1, 0.43, '#a9b3bb', 128);
  at(3, 1); glass(0, 0, 1, 1, '#2f4252', '#7c9cb3'); for (let u = 0; u < 1; u += 0.5) box(u, 0, u + 0.014, 1, '#9aa5ad', 128); box(0, 0.25, 1, 0.26, '#9aa5ad', 128);
  at(3, 2); glass(0, 0.1, 1, 1, '#2f4252', '#7c9cb3'); box(0, 0, 1, 0.1, '#33404c', 128); for (let u = 0; u < 1; u += 0.5) box(u, 0, u + 0.014, 1, '#9aa5ad', 128);
  at(3, 3); glass(0, 0, 1, 1, '#2f4252', '#7c9cb3'); for (let u = 0; u < 1; u += 0.5) box(u, 0, u + 0.014, 1, '#9aa5ad', 128);
  // 4: industrial / warehouse (ribbed metal)
  for (let r = 0; r < 4; r++) {
    at(4, r);
    for (let u = 0; u < 1; u += 0.0625) { box(u, 0, u + 0.03, 1, '#ffffff', 255); box(u + 0.03, 0, u + 0.0625, 1, '#e4e4e4', 255); }
    if (r === 0) { glass(0.05, 0.12, 0.95, 0.24, '#55636e', '#90a2ae'); frame(0.05, 0.12, 0.95, 0.24, '#8b9196', 0.01); }
    if (r === 1 || r === 3) { box(0.15, 0.25, 0.85, 1.0, '#9ca3a8', 128); for (let v = 0.25; v < 1; v += 0.03) box(0.15, v, 0.85, v + 0.008, '#7f878d', 128); }
    if (r === 2) shop(0.08, 0.2, 0.92, 1.0, '#7a2f2a');
  }
  // 5: church: fine stone, tall arched window
  at(5, 0); stones(true);
  c.fillStyle = '#f2ead6'; c.beginPath(); c.arc(px(0.5), py(0.3), 0.17 * TS, Math.PI, 0); c.fill(); c.fillRect(px(0.33), py(0.3), 0.34 * TS, 0.6 * TS);
  m.fillStyle = 'rgb(160,160,160)'; m.beginPath(); m.arc(px(0.5), py(0.3), 0.17 * TS, Math.PI, 0); m.fill(); m.fillRect(px(0.33), py(0.3), 0.34 * TS, 0.6 * TS);
  c.fillStyle = '#2b3550'; c.beginPath(); c.arc(px(0.5), py(0.32), 0.13 * TS, Math.PI, 0); c.fill(); c.fillRect(px(0.37), py(0.32), 0.26 * TS, 0.55 * TS);
  m.fillStyle = '#000'; m.beginPath(); m.arc(px(0.5), py(0.32), 0.13 * TS, Math.PI, 0); m.fill(); m.fillRect(px(0.37), py(0.32), 0.26 * TS, 0.55 * TS);
  c.fillStyle = 'rgba(200,60,60,0.35)'; c.fillRect(px(0.37), py(0.5), 0.26 * TS, 0.1 * TS);
  for (const r of [1, 2, 3]) {
    at(5, r); stones(true);
    c.fillStyle = '#f2ead6'; c.beginPath(); c.arc(px(0.5), py(0.32), 0.24 * TS, Math.PI, 0); c.fill();
    door(0.28, 0.32, 0.72, 1.0, '#5e3b22', '#432914');
    c.fillStyle = '#432914'; c.beginPath(); c.arc(px(0.5), py(0.33), 0.2 * TS, Math.PI, 0); c.fill();
  }
  // 6: modern white (new seafront apartments / hotels): full glass doors + glass balustrade
  at(6, 0); box(0, 0, 1, 1, '#ffffff', 255); slab(0.9, 1.0, '#fafafa');
  glass(0.06, 0.05, 0.94, 0.9, '#3e4f5d', '#8aa4b8');
  for (const u of [0.06, 0.35, 0.65, 0.93]) box(u, 0.05, u + 0.012, 0.9, '#3a3f44', 128);
  c.fillStyle = 'rgba(200,225,235,0.55)'; c.fillRect(px(0.02), py(0.58), 0.96 * TS, 0.32 * TS);
  m.fillStyle = 'rgb(128,128,128)'; m.fillRect(px(0.02), py(0.58), 0.96 * TS, 0.32 * TS);
  box(0.02, 0.575, 0.98, 0.585, '#c9cdd0', 128);
  at(6, 1); box(0, 0, 1, 1, '#ffffff', 255); glass(0.05, 0.12, 0.95, 1.0, '#33434f', '#88a0b2'); box(0.5, 0.12, 0.512, 1, '#3a3f44', 128); frame(0.05, 0.12, 0.95, 1.0, '#3a3f44', 0.012);
  at(6, 2); box(0, 0, 1, 1, '#ffffff', 255); shop(0.03, 0.04, 0.97, 1.0, '#1f2b36');
  at(6, 3); pilotis();
  // 7: office: ribbon windows
  at(7, 0); box(0, 0, 1, 1, '#ffffff', 255);
  glass(0, 0.3, 1, 0.82, '#33495a', '#86a3b8'); for (let u = 0; u < 1; u += 0.25) box(u, 0.3, u + 0.012, 0.82, '#7d878f', 128);
  box(0, 0.82, 1, 0.84, '#c4c8cb', 160);
  at(7, 1); box(0, 0, 1, 1, '#ffffff', 255); glass(0.04, 0.15, 0.96, 1, '#33495a', '#86a3b8'); frame(0.04, 0.15, 0.96, 1, '#7d878f', 0.012);
  at(7, 2); box(0, 0, 1, 1, '#ffffff', 255); shop(0.02, 0.05, 0.98, 1, '#2d3a55');
  at(7, 3); pilotis();
  // 8: castle: rough stone, arrow slit
  for (let r = 0; r < 4; r++) {
    at(8, r); stones(false);
    if (r === 0) { box(0.47, 0.35, 0.53, 0.75, '#2a2620', 0); }
    if (r === 1) { c.fillStyle = '#5a4a36'; c.fillRect(px(0.34), py(0.35), 0.32 * TS, 0.65 * TS); }
  }
  // 9: plain plaster (garages, sheds, utility)
  at(9, 0); box(0, 0.94, 1, 1, '#efece5', 200); glass(0.38, 0.35, 0.62, 0.6); frame(0.37, 0.34, 0.63, 0.61, '#d6d6d6', 0.014);
  at(9, 1); box(0.1, 0.2, 0.9, 1, '#a8acae', 128); for (let v = 0.2; v < 1; v += 0.03) box(0.1, v, 0.9, v + 0.008, '#8e9396', 128);
  at(9, 2); shop(0.05, 0.08, 0.95, 1, '#47524a');
  at(9, 3); box(0.1, 0.2, 0.9, 1, '#a8acae', 128);
  // 10: greenhouse panels
  for (let r = 0; r < 4; r++) { at(10, r); box(0, 0, 1, 1, '#e8efe9', 128); for (let u = 0; u < 1; u += 0.25) box(u, 0, u + 0.02, 1, '#c3c9c4', 128); box(0, 0.48, 1, 0.5, '#c3c9c4', 128); }
  // 11: apartment variant: two windows with sliding shutters and a small balcony door
  at(11, 0); slab(0.93, 1.0); box(0, 0, 1, 0.03, '#f2f0ea', 200);
  glass(0.08, 0.32, 0.4, 0.8); frame(0.07, 0.31, 0.41, 0.81, '#d0d3d5', 0.014);
  box(0.24, 0.32, 0.4, 0.8, '#c8bfa9', 128); for (let u = 0.24; u < 0.4; u += 0.02) box(u, 0.32, u + 0.006, 0.8, '#b0a68e', 128);
  glass(0.55, 0.2, 0.92, 0.9); frame(0.54, 0.19, 0.93, 0.9, '#d0d3d5', 0.014); shutterRoll(0.55, 0.2, 0.92, 0.33);
  at(11, 1); slab(0.94, 1.0); door(0.55, 0.2, 0.88, 1.0, '#8a8f93', '#c9ccce'); glass(0.57, 0.25, 0.86, 0.7); glass(0.12, 0.3, 0.42, 0.72); frame(0.11, 0.29, 0.43, 0.73, '#d0d3d5', 0.014);
  at(11, 2); slab(0.95, 1.0); shop(0.03, 0.06, 0.97, 1.0, '#5a2f45');
  at(11, 3); pilotis();

  // weathering: soft noise + rain streaks on tinted wall pixels
  const id = c.getImageData(0, 0, W, H), md = m.getImageData(0, 0, W, H);
  const d = id.data, mdd = md.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = 0.955 + 0.045 * Math.random() + 0.02 * Math.sin(x * 0.11 + Math.sin(y * 0.05) * 2) * Math.sin(y * 0.07);
      d[i] *= n; d[i + 1] *= n; d[i + 2] *= n;
    }
  }
  // build RGBA with rows flipped (canvas top -> texture top)
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const src = y * W * 4, dst = (H - 1 - y) * W * 4;
    for (let x = 0; x < W * 4; x += 4) {
      out[dst + x] = d[src + x]; out[dst + x + 1] = d[src + x + 1]; out[dst + x + 2] = d[src + x + 2]; out[dst + x + 3] = mdd[src + x];
    }
  }
  const tex = new THREE.DataTexture(out, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

// ------------------------------------------------------------------ ground detail atlas (2x2 tiles, grey multipliers)
export function makeGroundAtlas(renderer) {
  const S = 512, W = S * 2;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const c = cv.getContext('2d');
  const id = c.createImageData(W, W); const d = id.data;
  const R = rng(7);
  // value noise helper
  const vn = (seed, f) => {
    const g = new Float32Array((f + 1) * (f + 1)); const r = rng(seed);
    for (let i = 0; i < g.length; i++) g[i] = r();
    for (let i = 0; i <= f; i++) { g[i * (f + 1) + f] = g[i * (f + 1)]; g[f * (f + 1) + i] = g[i]; }
    return (u, v) => {
      const x = u * f, y = v * f, ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[iy * (f + 1) + ix], b = g[iy * (f + 1) + ix + 1], cc = g[(iy + 1) * (f + 1) + ix], dd = g[(iy + 1) * (f + 1) + ix + 1];
      return (a * (1 - sx) + b * sx) * (1 - sy) + (cc * (1 - sx) + dd * sx) * sy;
    };
  };
  const n1 = vn(1, 8), n2 = vn(2, 32), n3 = vn(3, 128), n4 = vn(4, 4);
  const put = (tx, ty, x, y, v) => {
    const i = ((ty * S + y) * W + tx * S + x) * 4;
    const g = Math.max(0, Math.min(255, v * 212));
    d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    // asphalt: grain + patches
    let a = 0.92 + (R() - 0.5) * 0.22 + (n2(u, v) - 0.5) * 0.12 + (n1(u, v) - 0.5) * 0.1;
    if (n4(u, v) > 0.72) a *= 0.9;
    put(0, 0, x, y, a);
    // paving: 0.4 m slabs on a 4 m tile -> 10 slabs, 0.5 m on 4 m -> 8
    const su = (u * 10) % 1, sv = (v * 10) % 1;
    const sid = Math.floor(u * 10) * 31 + Math.floor(v * 10) * 17;
    let p = 0.97 + ((Math.sin(sid * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.07 - 0.035 + (R() - 0.5) * 0.06 + (n2(u, v) - 0.5) * 0.06;
    if (su < 0.03 || sv < 0.03) p *= 0.78;
    put(1, 0, x, y, p);
    // grass: blotchy
    let gr = 0.9 + (n1(u, v) - 0.5) * 0.35 + (n2(u, v) - 0.5) * 0.2 + (n3(u, v) - 0.5) * 0.25 + (R() - 0.5) * 0.2;
    put(0, 1, x, y, gr);
    // sand / dirt: fine grain + ripples
    let s = 0.95 + (R() - 0.5) * 0.12 + (n2(u, v) - 0.5) * 0.1 + Math.sin((u * 6 + n1(u, v) * 1.5) * Math.PI * 2) * 0.025;
    put(1, 1, x, y, s);
  }
  c.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

// radial glow sprite for lamps, the sun flare and lights at night
export function makeGlow() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(0.25, 'rgba(255,210,150,0.55)'); g.addColorStop(1, 'rgba(255,190,120,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------ leaf atlas (2 x 2 cells of 512 px)
// 0 olive spray (narrow silver-green leaves), 1 broad leaves (ficus, carob, citrus), 2 pine needles,
// 3 palm frond (rib from the bottom of the cell to the top, leaflets both sides).
// The 64 px block at the bottom-right corner is opaque white: trunks and branches sample it.
export const LEAF_S = 1024;
export function leafCell(i) {
  const cx = (i % 2) * 512, cy = Math.floor(i / 2) * 512, S = LEAF_S, pad = 6;
  return { u0: (cx + pad) / S, u1: (cx + 512 - pad) / S, v0: 1 - (cy + 512 - pad) / S, v1: 1 - (cy + pad) / S };
}
export const WHITE_UV = [1 - 32 / 1024, 32 / 1024];

export function makeLeafAtlas(renderer) {
  const S = LEAF_S;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const R = rng(1234);
  const hsl = (h, s, l) => `hsl(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)`;
  const leaf = (x, y, len, wid, ang, col, rib = 0.14) => {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.45, -wid, len, 0);
    c.quadraticCurveTo(len * 0.45, wid, 0, 0);
    c.fillStyle = col; c.fill();
    if (rib) { c.strokeStyle = `rgba(255,255,240,${rib})`; c.lineWidth = Math.max(0.8, wid * 0.12); c.beginPath(); c.moveTo(len * 0.06, 0); c.lineTo(len * 0.86, 0); c.stroke(); }
    c.restore();
  };
  // a spray: twigs from the middle outwards, leaves along them (a roughly round, ragged cluster)
  const spray = (ox, oy, opt) => {
    const cx = ox + 256, cy = oy + 270;
    for (let k = 0; k < opt.twigs; k++) {
      const a = (k / opt.twigs) * Math.PI * 2 + (R() - 0.5) * 0.5;
      const L = opt.reach * (0.6 + 0.4 * R()) * (Math.sin(a) > 0.3 ? 0.85 : 1);
      const bend = (R() - 0.5) * 0.6;
      c.strokeStyle = opt.twig; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(cx, cy);
      const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L;
      const mx = cx + Math.cos(a + bend) * L * 0.55, my = cy + Math.sin(a + bend) * L * 0.55;
      c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
      for (let t = 0.18; t <= 1.0; t += opt.step / L) {
        const it = 1 - t, bx = it * it * cx + 2 * it * t * mx + t * t * ex, by = it * it * cy + 2 * it * t * my + t * t * ey;
        const tx = 2 * it * (mx - cx) + 2 * t * (ex - mx), ty = 2 * it * (my - cy) + 2 * t * (ey - my);
        const ta = Math.atan2(ty, tx);
        for (const sd of [-1, 1]) {
          const la = ta + sd * (opt.spread + (R() - 0.5) * 0.4);
          const col = opt.color(R());
          leaf(bx, by, opt.len * (0.8 + 0.4 * R()) * (1 - 0.25 * t), opt.wid * (0.85 + 0.3 * R()), la, col, opt.rib);
        }
      }
      leaf(ex, ey, opt.len, opt.wid, a, opt.color(R()), opt.rib); // tip leaf
    }
  };
  // 0: olive
  spray(0, 0, { twigs: 22, reach: 215, step: 11, len: 44, wid: 6.5, spread: 0.55, rib: 0.1, twig: '#5d5446',
    color: (r) => r < 0.4 ? hsl(78, 14, 60 + r * 14) : hsl(82 + r * 10, 20, 36 + r * 16) });
  // 1: broad leaves
  spray(512, 0, { twigs: 20, reach: 205, step: 13, len: 40, wid: 15, spread: 0.7, rib: 0.16, twig: '#4b3f30',
    color: (r) => r < 0.2 ? hsl(88, 40, 50) : hsl(98 + r * 14, 34, 27 + r * 20) });
  // 2: pine needles: tufts
  for (let k = 0; k < 30; k++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 170;
    const tx = 256 + Math.cos(a) * d, ty = 512 + 266 + Math.sin(a) * d;
    const n = 26 + Math.floor(R() * 16);
    for (let i = 0; i < n; i++) {
      const b = R() * Math.PI * 2, L = 28 + R() * 46;
      c.strokeStyle = hsl(95 + R() * 15, 28 + R() * 10, 18 + R() * 20); c.lineWidth = 2 + R() * 1.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + Math.cos(b) * L, ty + Math.sin(b) * L); c.stroke();
    }
  }
  // 3: palm frond (base at the bottom of the cell)
  {
    const ox = 512, oy = 512, cx = ox + 235;
    c.strokeStyle = '#8c8650'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, oy + 506); c.quadraticCurveTo(cx + 10, oy + 260, cx - 4, oy + 8); c.stroke();
    for (let y = oy + 490; y > oy + 14; y -= 6.5) {
      const t = (oy + 506 - y) / 492;
      const L = 175 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - 0.35 * t) + 12;
      const x = cx + 10 * Math.sin(t * Math.PI) - 4 * t;
      for (const sd of [-1, 1]) {
        const ang = -Math.PI / 2 + sd * (Math.PI / 2 - 0.62) + (R() - 0.5) * 0.12;
        leaf(x, y, L, 5.5 + R() * 2, ang, hsl(84 + R() * 16, 36, 26 + R() * 16), 0.12);
      }
    }
  }
  // opaque white block for trunks
  c.fillStyle = '#ffffff'; c.fillRect(S - 64, S - 64, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return tex;
}
