// Settings: graphics presets + controls, persisted in localStorage.
const KEY = 'nyc3000.settings';

export const PRESETS = {
  low: { resScale: 0.6, shadows: false, bloom: false, viewDist: 380, fpsCap: 60, rain: 1, crowd: 1 },
  medium: { resScale: 0.85, shadows: true, bloom: true, viewDist: 650, fpsCap: 0, rain: 2, crowd: 2 },
  high: { resScale: 1.0, shadows: true, bloom: true, viewDist: 1000, fpsCap: 0, rain: 3, crowd: 3 },
};

const DEFAULTS = {
  preset: 'medium',
  ...PRESETS.medium,
  showFps: false,
  sensitivity: 1.0,
  invertY: false,
  volume: 0.7,
  daytime: 'cycle',
};

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
export const storage = { get: safeGet, set: safeSet, del(k) { try { localStorage.removeItem(k); } catch { } } };

export function guessPreset() {
  // Weak GPUs / small screens / phones start on Low.
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;
  if (mem <= 4 || cores <= 4) return 'low';
  return 'medium';
}

export function loadSettings() {
  let s = null;
  try { s = JSON.parse(safeGet(KEY)); } catch { s = null; }
  if (!s) {
    const p = guessPreset();
    s = { ...DEFAULTS, preset: p, ...PRESETS[p] };
  }
  return { ...DEFAULTS, ...s };
}

export function saveSettings(s) { safeSet(KEY, JSON.stringify(s)); }

// Option rows shown in the Options menu.
export const OPTION_DEFS = [
  { key: 'preset', label: 'Quality preset', type: 'seg', options: [['low', 'LOW'], ['medium', 'MEDIUM'], ['high', 'HIGH'], ['custom', 'CUSTOM']],
    hint: 'Low runs smoothly on weak laptops. Changing a setting below switches to Custom.' },
  { key: 'resScale', label: 'Resolution scale', type: 'range', min: 0.4, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
  { key: 'shadows', label: 'Shadows', type: 'seg', options: [[false, 'OFF'], [true, 'ON']] },
  { key: 'bloom', label: 'Neon glow (bloom)', type: 'seg', options: [[false, 'OFF'], [true, 'ON']] },
  { key: 'viewDist', label: 'View distance', type: 'range', min: 250, max: 1200, step: 50, fmt: v => v + ' m' },
  { key: 'rain', label: 'Rain', type: 'seg', options: [[0, 'OFF'], [1, 'LIGHT'], [2, 'MEDIUM'], [3, 'STORM']] },
  { key: 'daytime', label: 'Time of day', type: 'seg', options: [['cycle', 'DAY + NIGHT'], ['day', 'ALWAYS DAY'], ['night', 'ALWAYS NIGHT']], hint: 'A full day takes 20 minutes.' },
  { key: 'crowd', label: 'Traffic & crowds', type: 'seg', options: [[1, 'LOW'], [2, 'MEDIUM'], [3, 'HIGH']] },
  { key: 'fpsCap', label: 'Frame rate cap', type: 'seg', options: [[0, 'VSYNC'], [60, '60'], [30, '30']] },
  { key: 'showFps', label: 'Show FPS counter', type: 'seg', options: [[false, 'OFF'], [true, 'ON']] },
  { key: 'sensitivity', label: 'Mouse sensitivity', type: 'range', min: 0.2, max: 3, step: 0.1, fmt: v => v.toFixed(1) + 'x' },
  { key: 'invertY', label: 'Invert mouse Y', type: 'seg', options: [[false, 'OFF'], [true, 'ON']] },
  { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
];

export const GRAPHICS_KEYS = Object.keys(PRESETS.low);
