// All sounds are made in the browser (Web Audio): footsteps on each surface, sea waves,
// cicadas in the summer trees, crickets at night, seagulls, splashes and the discovery chime.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.vol = 0.8; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.on ? this.vol : 0; this.master.connect(ctx.destination);
    // noise buffers
    const n = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = this.white.getChannelData(0); for (let i = 0; i < n; i++) w[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, n * 2, ctx.sampleRate);
    const b = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < n * 2; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 1.5); return s; };
    // sea waves: brown noise, low-passed, slowly swelling
    this.waves = ctx.createGain(); this.waves.gain.value = 0;
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 520;
    const swell = ctx.createGain(); swell.gain.value = 0.6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11; const lfoG = ctx.createGain(); lfoG.gain.value = 0.45;
    lfo.connect(lfoG); lfoG.connect(swell.gain); lfo.start();
    loop(this.brown).connect(wlp); wlp.connect(swell); swell.connect(this.waves); this.waves.connect(this.master);
    // city hum
    this.hum = ctx.createGain(); this.hum.gain.value = 0;
    const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 160;
    loop(this.brown).connect(hlp); hlp.connect(this.hum); this.hum.connect(this.master);
    // cicadas: band-passed noise, buzzing amplitude
    this.cic = ctx.createGain(); this.cic.gain.value = 0;
    const cbp = ctx.createBiquadFilter(); cbp.type = 'bandpass'; cbp.frequency.value = 5400; cbp.Q.value = 5;
    const cam = ctx.createGain(); cam.gain.value = 0.5;
    const co = ctx.createOscillator(); co.type = 'square'; co.frequency.value = 38; const coG = ctx.createGain(); coG.gain.value = 0.5;
    co.connect(coG); coG.connect(cam.gain); co.start();
    const cswell = ctx.createGain(); cswell.gain.value = 0.6;
    const cs = ctx.createOscillator(); cs.frequency.value = 0.07; const csG = ctx.createGain(); csG.gain.value = 0.35;
    cs.connect(csG); csG.connect(cswell.gain); cs.start();
    loop(this.white).connect(cbp); cbp.connect(cam); cam.connect(cswell); cswell.connect(this.cic); this.cic.connect(this.master);
    this.cicBase = 0;
    // crickets at night
    this.crk = ctx.createGain(); this.crk.gain.value = 0;
    const ko = ctx.createOscillator(); ko.frequency.value = 4300; const kam = ctx.createGain(); kam.gain.value = 0;
    const kl = ctx.createOscillator(); kl.type = 'square'; kl.frequency.value = 2.6; const klG = ctx.createGain(); klG.gain.value = 0.5;
    const kl2 = ctx.createOscillator(); kl2.type = 'square'; kl2.frequency.value = 31; const kl2G = ctx.createGain(); kl2G.gain.value = 0.5;
    kl.connect(klG); klG.connect(kam.gain); kl2.connect(kl2G); kl2G.connect(kam.gain); kl.start(); kl2.start();
    ko.connect(kam); kam.connect(this.crk); this.crk.connect(this.master); ko.start();
    this.gullT = 4;
  }

  setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? this.vol : 0, this.ctx.currentTime, 0.1); }
  setVol(v) { this.vol = v; this.setOn(this.on); }

  burst(freq, q, dur, gain, type = 'bandpass', rate = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.white; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }

  // surface codes from the city raster: 0 water, 3 grass, 4 sand, 5 asphalt, 6/7 paving/sidewalk, 10 pier
  step(surface, run) {
    if (!this.ctx) return;
    const k = run ? 1.35 : 1;
    switch (surface) {
      case 0: this.burst(900, 0.7, 0.35 * k, 0.16 * k, 'lowpass'); break;
      case 3: case 2: this.burst(1100 + Math.random() * 300, 1.2, 0.11, 0.07 * k); this.burst(3500, 2, 0.05, 0.02 * k); break;
      case 4: this.burst(600 + Math.random() * 200, 0.8, 0.16, 0.09 * k, 'lowpass'); break;
      case 10: this.burst(320 + Math.random() * 60, 6, 0.12, 0.2 * k); this.burst(1600, 2, 0.04, 0.05 * k); break;
      case 5: this.burst(1300 + Math.random() * 300, 1.6, 0.07, 0.08 * k); break;
      default: this.burst(1900 + Math.random() * 400, 1.8, 0.06, 0.09 * k); this.burst(4200, 3, 0.03, 0.03 * k);
    }
  }
  splash() { this.burst(700, 0.6, 0.7, 0.3, 'lowpass'); this.burst(2500, 1, 0.4, 0.08); }
  land() { this.burst(300, 1, 0.12, 0.18, 'lowpass'); }

  // ---------------------------------------------------------------- cars
  engineOn() {
    if (!this.ctx || this.eng) return;
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 1.4;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 36;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 18;
    const o2g = ctx.createGain(); o2g.gain.value = 0.4;
    o1.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(g); g.connect(this.master);
    o1.start(); o2.start();
    const sk = ctx.createBufferSource(); sk.buffer = this.white; sk.loop = true;
    const sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 1700; sbp.Q.value = 1.3;
    const sg = ctx.createGain(); sg.gain.value = 0;
    sk.connect(sbp); sbp.connect(sg); sg.connect(this.master); sk.start();
    this.eng = { g, lp, o1, o2, sg, sk };
    this.burst(240, 2.5, 0.45, 0.1, 'bandpass', 0.6); // starter
  }
  engineOff() {
    const e = this.eng; if (!e) return;
    const t = this.ctx.currentTime;
    e.g.gain.setTargetAtTime(0, t, 0.08); e.sg.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.sk.stop(); } catch { /* already stopped */ } }, 700);
    this.eng = null;
  }
  // speed m/s, throttle 0..1, sideways slip m/s, top speed: five gears, a low growl
  engine(v, thr, slip, vmax) {
    const e = this.eng; if (!e) return;
    const t = this.ctx.currentTime;
    const gears = [0, 0.16, 0.34, 0.54, 0.76, 1.01];
    const f = Math.min(1, v / vmax);
    let gi = 0; while (gi < 4 && f > gears[gi + 1]) gi++;
    const rpm = (f - gears[gi]) / (gears[gi + 1] - gears[gi]);
    const hz = 32 + rpm * 62 + gi * 5 + thr * 5;
    e.o1.frequency.setTargetAtTime(hz, t, 0.05); e.o2.frequency.setTargetAtTime(hz * 0.5, t, 0.05);
    e.lp.frequency.setTargetAtTime(320 + thr * 850 + rpm * 350, t, 0.08);
    e.g.gain.setTargetAtTime(0.045 + thr * 0.05 + rpm * 0.02, t, 0.08);
    e.sg.gain.setTargetAtTime(Math.min(0.11, Math.max(0, slip - 2.5) * 0.028), t, 0.05);
  }
  door() { this.burst(260, 1.5, 0.18, 0.25, 'lowpass'); this.burst(1300, 3, 0.05, 0.06); }
  crash(k) { this.burst(130, 0.8, 0.55, 0.12 + 0.5 * k, 'lowpass'); this.burst(2600, 1, 0.3, 0.05 + 0.15 * k); }
  horn(on) {
    const ctx = this.ctx; if (!ctx) return;
    if (on && !this.hornN) {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(g);
      const os = [392, 494].map((f) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
      g.gain.setTargetAtTime(0.07, ctx.currentTime, 0.01);
      this.hornN = { g, os };
    } else if (!on && this.hornN) {
      const h = this.hornN; this.hornN = null;
      h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => h.os.forEach((o) => { try { o.stop(); } catch { /* stopped */ } }), 200);
    }
  }
  tone(f, dur, gain = 0.12, type = 'sine', at = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  beep(high) { this.tone(high ? 1046 : 523, high ? 0.5 : 0.22, 0.14, 'square'); }
  ding() { this.tone(1318, 0.35, 0.12); this.tone(1760, 0.5, 0.08, 'sine', 0.06); }
  cash() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, 0.1, 'triangle', i * 0.07)); this.burst(5000, 2, 0.12, 0.05); }
  shutter() { this.burst(3000, 2, 0.04, 0.2); this.burst(1500, 2, 0.06, 0.12); }
  // police siren: the European two-tone (hi-lo), louder as the nearest police car gets closer
  siren(on, dist) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    if (on && !this.sir) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 466;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.9;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(bp); bp.connect(g); g.connect(this.master); o.start();
      this.sir = { o, g };
    } else if (!on && this.sir) {
      const s = this.sir; this.sir = null;
      s.g.gain.setTargetAtTime(0, t, 0.15);
      setTimeout(() => { try { s.o.stop(); } catch { /* stopped */ } }, 900);
      return;
    }
    if (this.sir) {
      const hi = (t % 1.1) < 0.55;
      this.sir.o.frequency.setTargetAtTime(hi ? 622 : 466, t, 0.012);
      this.sir.g.gain.setTargetAtTime(0.1 * Math.min(1, Math.max(0.05, 1 - dist / 380)), t, 0.1);
    }
  }
  chirp() { // a short "whoop" when the police notice you
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(1250, t + 0.35); o.frequency.exponentialRampToValueAtTime(600, t + 0.6);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(bp); bp.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.7);
  }
  sad() { this.tone(392, 0.3, 0.1, 'triangle'); this.tone(330, 0.45, 0.1, 'triangle', 0.25); }

  chime() {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime;
    [659.25, 830.6, 987.8, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); const t = t0 + i * 0.11;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.3);
    });
  }
  click() {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.value = 880; const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.1);
  }
  gull() {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime, n = 2 + Math.floor(Math.random() * 3), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain(); out.gain.value = 0.05 + Math.random() * 0.04;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; out.connect(pan); pan.connect(this.master); } else out.connect(this.master);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.32;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1500, t); o.frequency.linearRampToValueAtTime(2100, t + 0.05); o.frequency.exponentialRampToValueAtTime(950, t + 0.26);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
      o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
    }
  }

  // ambience from where you are: sea distance (m), trees nearby (0..1), night (0..1), inland city (0..1)
  update(dt, env) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, T = 0.6;
    const sea = Math.max(0, 1 - Math.max(0, env.sea) / 260);
    this.waves.gain.setTargetAtTime(0.42 * Math.pow(sea, 1.4) + (env.swim ? 0.25 : 0), t, T);
    this.hum.gain.setTargetAtTime(0.10 * env.city * (1 - env.night * 0.6), t, T);
    this.cic.gain.setTargetAtTime(0.06 * env.trees * (1 - env.night) * (env.drone ? 0.2 : 1), t, T);
    this.crk.gain.setTargetAtTime(0.025 * env.night * (0.4 + env.trees), t, T);
    this.gullT -= dt;
    if (this.gullT < 0) { this.gullT = 6 + Math.random() * 16; if (sea > 0.25 && env.night < 0.5) this.gull(); }
  }
}
