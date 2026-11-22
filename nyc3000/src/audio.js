// Tiny synthesized sound engine (Web Audio, no files).
export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.muted = false;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.setVolume(this.volume);
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._rain();
    this._engine();
    this._siren();
    this._music();
  }
  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v * 0.8;
  }
  toggleMute() { this.muted = !this.muted; this.setVolume(this.volume); return this.muted; }

  _rain() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.4;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = (this.rainLevel || 0) * 0.05;
    src.connect(f).connect(this.rainGain).connect(this.master); src.start();
  }
  setRain(level) { this.rainLevel = level; if (this.rainGain) this.rainGain.gain.setTargetAtTime(level * 0.05, this.ctx.currentTime, 0.5); }

  _engine() {
    const ctx = this.ctx;
    this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 50;
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 25;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; this.engFilter = f;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engOsc.connect(f); this.engOsc2.connect(f); f.connect(this.engGain).connect(this.master);
    this.engOsc.start(); this.engOsc2.start();
  }
  setEngine(on, speed01, flying) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = flying ? 90 : 45;
    this.engOsc.frequency.setTargetAtTime(base + speed01 * (flying ? 160 : 140), t, 0.08);
    this.engOsc2.frequency.setTargetAtTime((base + speed01 * 100) * 0.5, t, 0.08);
    this.engFilter.frequency.setTargetAtTime(flying ? 900 + speed01 * 1500 : 400 + speed01 * 1600, t, 0.1);
    this.engGain.gain.setTargetAtTime(on ? 0.07 + speed01 * 0.05 : 0, t, 0.15);
  }

  _siren() {
    const ctx = this.ctx;
    this.sirOsc = ctx.createOscillator(); this.sirOsc.type = 'triangle'; this.sirOsc.frequency.value = 700;
    this.sirGain = ctx.createGain(); this.sirGain.gain.value = 0;
    this.sirOsc.connect(this.sirGain).connect(this.master); this.sirOsc.start();
    this.sirT = 0;
  }
  setSiren(level, dt) {
    if (!this.ctx) return;
    this.sirT += dt;
    const f = (Math.floor(this.sirT * 2.2) % 2) ? 960 : 720;
    this.sirOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.03);
    this.sirGain.gain.setTargetAtTime(level * 0.05, this.ctx.currentTime, 0.2);
  }

  // Simple dark-synth loop for title & menu.
  _music() {
    const ctx = this.ctx;
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);
    this.musicOn = false;
    this._nextBeat = 0; this._step = 0;
  }
  setMusic(on) {
    if (!this.ctx) return;
    this.musicOn = on;
    this.musicGain.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.6);
    if (on && this._nextBeat < this.ctx.currentTime) this._nextBeat = this.ctx.currentTime + 0.05;
  }
  tickMusic() {
    if (!this.ctx || !this.musicOn) return;
    const ctx = this.ctx, bpm = 100, sp = 60 / bpm / 4;
    // A minor riff: A F C G
    const roots = [45, 41, 48, 43];
    while (this._nextBeat < ctx.currentTime + 0.2) {
      const t = this._nextBeat, s = this._step;
      const bar = Math.floor(s / 16) % 4, root = roots[bar];
      // bass 16ths
      const note = root + ((s % 4 === 2) ? 12 : 0);
      this._tone(t, 440 * Math.pow(2, (note - 69) / 12), sp * 0.9, 'sawtooth', 0.12, 500, this.musicGain);
      // arp
      if (s % 2 === 0) {
        const arp = [0, 3, 7, 12, 7, 3, 10, 7][(s / 2) % 8];
        this._tone(t, 440 * Math.pow(2, (root + 24 + arp - 69) / 12), sp * 1.6, 'square', 0.035, 2200, this.musicGain);
      }
      // kick
      if (s % 4 === 0) this._kick(t);
      if (s % 8 === 4) this._noiseHit(t, 0.08, 3000, 0.08, this.musicGain);
      this._nextBeat += sp; this._step++;
    }
  }
  _kick(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.musicGain); o.start(t); o.stop(t + 0.3);
  }
  _tone(t, freq, dur, type, vol, cutoff = 8000, dest) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(dest || this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  _noiseHit(t, dur, freq, vol, dest, type = 'highpass') {
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest || this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  _sweep(t, f0, f1, dur, type, vol) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  // distance attenuation helper
  play(name, dist = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, a = Math.max(0, 1 - dist / 120);
    if (a <= 0.01) return;
    switch (name) {
      case 'rifle': this._sweep(t, 1800, 220, 0.12, 'sawtooth', 0.12 * a); this._noiseHit(t, 0.05, 4000, 0.08 * a); break;
      case 'smg': this._sweep(t, 2200, 500, 0.08, 'sawtooth', 0.08 * a); this._noiseHit(t, 0.03, 5000, 0.05 * a); break;
      case 'rail': this._sweep(t, 400, 3200, 0.18, 'sawtooth', 0.12 * a); this._sweep(t + 0.05, 3000, 200, 0.35, 'square', 0.08 * a); this._noiseHit(t, 0.2, 2500, 0.12 * a); break;
      case 'pistol': this._sweep(t, 2600, 400, 0.16, 'square', 0.1 * a); break;
      case 'shotgun': this._noiseHit(t, 0.35, 600, 0.4 * a, null, 'lowpass'); this._sweep(t, 400, 60, 0.3, 'sawtooth', 0.15 * a); break;
      case 'enemy': this._sweep(t, 1200, 300, 0.12, 'square', 0.06 * a); break;
      case 'cannon': this._sweep(t, 900, 80, 0.25, 'sawtooth', 0.16 * a); this._noiseHit(t, 0.12, 1500, 0.1 * a); break;
      case 'hit': this._noiseHit(t, 0.06, 2500, 0.12 * a); break;
      case 'hurt': this._sweep(t, 300, 90, 0.2, 'square', 0.12); break;
      case 'explode': this._noiseHit(t, 1.1, 900, 0.6 * a, null, 'lowpass'); this._sweep(t, 160, 30, 0.8, 'sawtooth', 0.25 * a); break;
      case 'reload': this._tone(t, 500, 0.05, 'square', 0.06); this._tone(t + 0.12, 800, 0.05, 'square', 0.06); this._tone(t + 0.5, 1200, 0.06, 'square', 0.07); break;
      case 'empty': this._tone(t, 220, 0.05, 'square', 0.06); break;
      case 'switch': this._tone(t, 900, 0.04, 'square', 0.05); this._tone(t + 0.05, 1400, 0.05, 'square', 0.05); break;
      case 'door': this._noiseHit(t, 0.15, 400, 0.2, null, 'lowpass'); this._tone(t, 160, 0.12, 'square', 0.08); break;
      case 'yell': this._sweep(t, 500, 900, 0.25, 'sawtooth', 0.05 * a); break;
      case 'ui': this._tone(t, 1400, 0.05, 'square', 0.05); break;
      case 'start': this._sweep(t, 200, 1600, 0.5, 'sawtooth', 0.12); this._noiseHit(t, 0.6, 300, 0.2, null, 'lowpass'); break;
      case 'star': this._tone(t, 880, 0.12, 'square', 0.08); this._tone(t + 0.12, 660, 0.18, 'square', 0.08); break;
      case 'pickup': this._tone(t, 700, 0.06, 'triangle', 0.1); this._tone(t + 0.07, 1050, 0.1, 'triangle', 0.1); break;
      case 'objective': [0, 4, 7, 12].forEach((n, i) => this._tone(t + i * 0.09, 523 * Math.pow(2, n / 12), 0.2, 'triangle', 0.1)); break;
      case 'cash': this._tone(t, 1568, 0.07, 'square', 0.07); this._tone(t + 0.08, 2093, 0.3, 'triangle', 0.11); this._noiseHit(t + 0.06, 0.12, 6000, 0.05); break;
      case 'alarm': for (let k = 0; k < 10; k++) this._tone(t + k * 0.22, k % 2 ? 880 : 1175, 0.18, 'square', 0.05); break;
      case 'sleep': [12, 7, 4, 0].forEach((n, i) => this._tone(t + i * 0.18, 392 * Math.pow(2, n / 12), 0.4, 'triangle', 0.07)); break;
      case 'alert': this._tone(t, 520, 0.12, 'square', 0.09); this._tone(t + 0.12, 780, 0.22, 'square', 0.09); break;
      case 'punch': this._noiseHit(t, 0.12, 300, 0.35, null, 'lowpass'); this._sweep(t, 180, 60, 0.15, 'sine', 0.2); break;
      case 'woof': this._sweep(t, 420, 220, 0.12, 'sawtooth', 0.08); this._sweep(t + 0.2, 460, 230, 0.12, 'sawtooth', 0.08); break;
      case 'scan': this._sweep(t, 300, 1800, 0.25, 'sine', 0.05); break;
      case 'crash': this._noiseHit(t, 0.4, 500, 0.35 * a, null, 'lowpass'); break;
    }
  }
}
