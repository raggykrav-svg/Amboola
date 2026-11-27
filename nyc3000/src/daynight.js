// Day and night. The clock runs 24 game hours in 20 real minutes (Options → Time of day can
// keep it always day or always night). In the day the sky is blue, the sun casts shadows and
// the neon is dim; at sunset the sky turns orange and pink; at night the neon glows brightest.
import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
// sky colours (top, middle, horizon) and light settings at key hours
const KEYS = [
  { h: 0, top: C('#05030f'), mid: C('#1a0f3a'), bot: C('#3a1a5a'), fog: C('#24123f'), hemi: 1.1, sun: 1.1, sunCol: C('#a89aff'), glow: 1, bloom: 0.7, exp: 1.15 },
  { h: 5, top: C('#0a0a24'), mid: C('#2a1a4a'), bot: C('#5a2a5a'), fog: C('#2a1844'), hemi: 1.1, sun: 1.0, sunCol: C('#a89aff'), glow: 1, bloom: 0.7, exp: 1.15 },
  { h: 6.5, top: C('#3a5a9a'), mid: C('#d88aa8'), bot: C('#ffb27a'), fog: C('#b08a9a'), hemi: 1.3, sun: 1.6, sunCol: C('#ffb27a'), glow: 0.7, bloom: 0.5, exp: 1.1 },
  { h: 9, top: C('#3a7ad8'), mid: C('#7ab0ea'), bot: C('#c8def0'), fog: C('#a8c0dc'), hemi: 1.7, sun: 2.6, sunCol: C('#fff4e0'), glow: 0.35, bloom: 0.28, exp: 1.0 },
  { h: 16, top: C('#3a7ad8'), mid: C('#7ab0ea'), bot: C('#c8def0'), fog: C('#a8c0dc'), hemi: 1.7, sun: 2.6, sunCol: C('#fff4e0'), glow: 0.35, bloom: 0.28, exp: 1.0 },
  { h: 18.5, top: C('#2a3a8a'), mid: C('#e86a7a'), bot: C('#ffaa4a'), fog: C('#c87a7a'), hemi: 1.3, sun: 1.7, sunCol: C('#ff9a5a'), glow: 0.75, bloom: 0.5, exp: 1.1 },
  { h: 20, top: C('#0a0620'), mid: C('#2a1240'), bot: C('#5a2050'), fog: C('#2a1240'), hemi: 1.1, sun: 1.1, sunCol: C('#a89aff'), glow: 1, bloom: 0.7, exp: 1.15 },
  { h: 24, top: C('#05030f'), mid: C('#1a0f3a'), bot: C('#3a1a5a'), fog: C('#24123f'), hemi: 1.1, sun: 1.1, sunCol: C('#a89aff'), glow: 1, bloom: 0.7, exp: 1.15 },
];
const HEMI_NIGHT = [C('#6a5aff'), C('#2a1030')], HEMI_DAY = [C('#cfe0ff'), C('#6a5e50')];
const AMB_NIGHT = C('#30284a'), AMB_DAY = C('#8a8aa0');

export const DAY_LENGTH = 1200; // seconds for 24 game hours
export function clockText(h) { const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

export class DayNight {
  constructor(o) {
    Object.assign(this, o); // scene, renderer, bloom, hemi, amb, sun, city
    this.c = document.createElement('canvas'); this.c.width = 4; this.c.height = 128;
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.day = 0; this.hour = -1; this.cur = {};
    // the sun (and the moon) in the sky
    const mk = (inner, outer, size) => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, inner); gr.addColorStop(0.25, inner); gr.addColorStop(0.32, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false }));
      s.scale.setScalar(size); s.renderOrder = -1; this.scene.add(s); return s;
    };
    this.sunSprite = mk('#fff8e0', 'rgba(255,210,120,.35)', 120);
    this.moonSprite = mk('#e8e8ff', 'rgba(160,160,255,.2)', 50);
    this.dir = new THREE.Vector3(0.35, 0.8, 0.3).normalize();
  }
  attach(city) {
    this.city = city;
    city.sky.material.map = this.tex; city.sky.material.needsUpdate = true;
    this.baseGlow = city.windowMats.map(m => m.emissiveIntensity);
    this.groundGlow = city.ground.material.emissiveIntensity;
    this.hour = -1;
  }
  // mix the key frames for hour h
  _sample(h) {
    let a = KEYS[0], b = KEYS[1];
    for (let i = 0; i + 1 < KEYS.length; i++) if (h >= KEYS[i].h && h <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    const t = (h - a.h) / Math.max(1e-6, b.h - a.h), o = this.cur;
    for (const k of ['top', 'mid', 'bot', 'fog', 'sunCol']) (o[k] || (o[k] = new THREE.Color())).copy(a[k]).lerp(b[k], t);
    for (const k of ['hemi', 'sun', 'glow', 'bloom', 'exp']) o[k] = a[k] + (b[k] - a[k]) * t;
    return o;
  }
  // light of the day: 0 at night, 1 in the middle of the day
  get daylight() { return Math.max(0, Math.min(1, (this.cur.hemi - 1.1) / 0.6)); }
  get night() { return this.hour >= 20.5 || this.hour < 5.5; }

  update(h, camera, useBloom) {
    if (!this.city) return;
    const o = this._sample(h), d = this.daylight;
    // the sun goes round: up at 6, highest at 12, down at 18; the moon does the night half
    const sunA = (h - 6) / 12 * Math.PI, up = Math.sin(sunA);
    const sunDir = new THREE.Vector3(Math.cos(sunA) * 0.8, Math.max(0.05, up), 0.35).normalize();
    const moonDir = new THREE.Vector3(-Math.cos(sunA) * 0.6, Math.max(0.15, -up), -0.4).normalize();
    // the shadow light follows whichever is up (and changes smoothly around sunrise/sunset)
    const k = Math.max(0, Math.min(1, (up + 0.1) / 0.25));
    this.dir.copy(moonDir).lerp(sunDir, k).normalize();
    if (Math.abs(h - this.hour) > 0.02 || this.hour < 0) {
      this.hour = h;
      const g = this.c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#' + o.top.getHexString()); gr.addColorStop(0.55, '#' + o.mid.getHexString()); gr.addColorStop(1, '#' + o.bot.getHexString());
      g.fillStyle = gr; g.fillRect(0, 0, 4, 128); this.tex.needsUpdate = true;
      this.scene.fog.color.copy(o.fog);
      this.hemi.color.copy(HEMI_NIGHT[0]).lerp(HEMI_DAY[0], d); this.hemi.groundColor.copy(HEMI_NIGHT[1]).lerp(HEMI_DAY[1], d);
      this.hemi.intensity = o.hemi;
      this.amb.color.copy(AMB_NIGHT).lerp(AMB_DAY, d);
      this.sun.color.copy(o.sunCol); this.sun.intensity = o.sun;
      this.city.windowMats.forEach((m, i) => (m.emissiveIntensity = this.baseGlow[i] * o.glow));
      this.city.ground.material.emissiveIntensity = this.groundGlow * (0.4 + 0.6 * o.glow);
      this.city.holoSky.visible = o.glow > 0.5;
      this.bloom.strength = o.bloom;
      this.renderer.toneMappingExposure = o.exp;
    }
    // sun and moon sprites far away in the sky
    const far = camera.far * 0.8;
    this.sunSprite.position.copy(camera.position).addScaledVector(sunDir, far);
    this.sunSprite.visible = up > -0.05; this.sunSprite.material.opacity = Math.min(1, (up + 0.05) * 5);
    this.moonSprite.position.copy(camera.position).addScaledVector(moonDir, far);
    this.moonSprite.visible = up < 0.1; this.moonSprite.material.opacity = Math.min(1, (0.1 - up) * 5);
  }
}
