// Procedural audio: no asset files. Ambience, wind, engines, suit sounds, creature calls, music pads.
const SCALES = {
  khepri: [0, 3, 5, 7, 10], vesper: [0, 2, 4, 7, 9], nivalis: [0, 2, 3, 7, 8], pelagos: [0, 2, 5, 7, 9], space: [0, 5, 7, 12, 14],
};
const ROOT = { khepri: 110, vesper: 130.8, nivalis: 98, pelagos: 123.5, space: 73.4 };

export class AudioSystem {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.ready = false;
    this.env = { planet: 'khepri', underwater: false, wind: 1, storm: 0, space: false, inShip: false, thrust: 0, cruise: false, day: 1, rad: 0 };
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.t = 0; this.nextNote = 2; this.geigerT = 0; this.scanLoopOn = false;
  }

  init() {
    if (this.ready) { this.ctx?.resume?.(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = this.settings.volume ?? 0.8;
      this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000;
      this.comp = ctx.createDynamicsCompressor();
      this.lp.connect(this.comp); this.comp.connect(this.master); this.master.connect(ctx.destination);
      this.noiseBuf = this.makeNoise(2);
      // wind
      this.windSrc = this.loopNoise(); this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = 0.7;
      this.windG = ctx.createGain(); this.windG.gain.value = 0; this.windSrc.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.lp);
      // drone
      this.drone = ctx.createGain(); this.drone.gain.value = 0; this.drone.connect(this.lp);
      this.droneO = [0, 1, 2].map((i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = 55; const g = ctx.createGain(); g.gain.value = [0.5, 0.35, 0.18][i]; o.connect(g); g.connect(this.drone); o.start(); return o; });
      // engine
      this.engG = ctx.createGain(); this.engG.gain.value = 0; this.engF = ctx.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 300;
      this.engO = ctx.createOscillator(); this.engO.type = 'sawtooth'; this.engO.frequency.value = 48; this.engN = this.loopNoise();
      const engNG = ctx.createGain(); engNG.gain.value = 0.5; this.engN.connect(engNG); engNG.connect(this.engF); this.engO.connect(this.engF);
      this.engF.connect(this.engG); this.engG.connect(this.lp); this.engO.start();
      // music bus
      this.music = ctx.createGain(); this.music.gain.value = this.settings.music ?? 0.5; this.music.connect(this.lp);
      // scan loop
      this.scanO = ctx.createOscillator(); this.scanO.type = 'triangle'; this.scanO.frequency.value = 400; this.scanG = ctx.createGain(); this.scanG.gain.value = 0;
      this.scanO.connect(this.scanG); this.scanG.connect(this.lp); this.scanO.start();
      // mining loop
      this.mineG = ctx.createGain(); this.mineG.gain.value = 0; const ms = this.loopNoise(); const mf = ctx.createBiquadFilter(); mf.type = 'bandpass'; mf.frequency.value = 1800; mf.Q.value = 3;
      ms.connect(mf); mf.connect(this.mineG); this.mineG.connect(this.lp);
      this.ready = true;
    } catch (e) { console.warn('Audio unavailable', e); }
  }

  makeNoise(sec) {
    const ctx = this.ctx, n = ctx.sampleRate * sec, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = w * 0.5 + last * 6 * 0.5; }
    return b;
  }
  loopNoise() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(); return s; }

  setVolume(v) { if (this.master) this.master.gain.value = v; }
  setMusic(v) { if (this.music) this.music.gain.value = v; }
  setListener(x, z, yaw) { this.listener.x = x; this.listener.z = z; this.listener.yaw = yaw; }

  setEnv(e) { Object.assign(this.env, e); }

  // ---------- one shots
  tone(freq, dur = 0.15, type = 'sine', vol = 0.15, slide = 0, delay = 0, dest) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.lp); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  burst(dur = 0.1, freq = 800, q = 1, vol = 0.2, type = 'bandpass', delay = 0, dest) {
    if (!this.ready) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.lp); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  footstep(sprint) {
    const p = this.env.planet;
    const surf = { khepri: [420, 0.9], vesper: [260, 1.4], nivalis: [900, 2.2], pelagos: [320, 1.1] }[p] || [400, 1];
    this.burst(0.09, surf[0] * (0.85 + Math.random() * 0.3), surf[1], sprint ? 0.2 : 0.13, 'bandpass');
  }
  splash() { this.burst(0.35, 600, 0.5, 0.25, 'lowpass'); }
  jump() { this.burst(0.08, 300, 1, 0.1, 'lowpass'); }
  land(speed) { this.burst(0.2, 180, 0.8, Math.min(0.4, speed * 0.03), 'lowpass'); }
  scanDone() { this.tone(660, 0.12, 'sine', 0.16); this.tone(880, 0.12, 'sine', 0.16, 0, 0.1); this.tone(1320, 0.3, 'sine', 0.14, 0, 0.2); }
  discover() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, 0, i * 0.09)); }
  link() { [392, 523, 659, 784, 1046, 1568].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.11, 0, i * 0.12)); }
  pickup() { this.tone(520, 0.08, 'square', 0.07); this.tone(780, 0.1, 'square', 0.07, 0, 0.07); }
  click() { this.tone(900, 0.04, 'square', 0.05); }
  alert() { this.tone(440, 0.2, 'sawtooth', 0.12); this.tone(330, 0.3, 'sawtooth', 0.12, 0, 0.2); }
  hurt() { this.burst(0.18, 140, 0.6, 0.35, 'lowpass'); this.tone(90, 0.25, 'sawtooth', 0.15, -40); }
  door() { this.burst(1.6, 120, 0.7, 0.28, 'lowpass'); this.tone(70, 1.6, 'sawtooth', 0.12, 30); }
  fire() { this.tone(1400, 0.25, 'sawtooth', 0.1, -1000); }
  thunder() { this.burst(2.8, 90, 0.5, 0.5, 'lowpass', 0.3); this.burst(0.5, 600, 0.5, 0.25, 'bandpass'); }
  build() { this.tone(200, 0.3, 'triangle', 0.15, 200); this.burst(0.3, 1200, 2, 0.1); }
  boot() { [196, 294, 392, 588].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.1, 0, i * 0.22)); }
  creature(sp, x, z, y) {
    if (!this.ready) return;
    const dx = x - this.listener.x, dz = z - this.listener.z, d = Math.hypot(dx, dz);
    const range = sp.colossal ? 1400 : 160;
    if (d > range) return;
    const vol = Math.pow(1 - d / range, 1.5) * (sp.colossal ? 0.6 : 0.22);
    const ctx = this.ctx, pan = ctx.createStereoPanner();
    const yaw = this.listener.yaw;
    pan.pan.value = Math.max(-1, Math.min(1, d > 0.01 ? (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d : 0)); pan.connect(this.lp);
    const base = sp.tone || 300;
    if (sp.colossal) { // three-tone sequence, deep register
      [1, 1.25, 1.5].forEach((m, i) => this.tone(base * m, 2.2, 'sine', vol, 0, i * 1.3, pan));
    } else if (sp.arch === 'flyer') { [1, 1.25, 1.5].forEach((m, i) => this.tone(base * m, 0.4, 'sine', vol, 0, i * 0.28, pan)); }
    else if (sp.diet === 'carnivore') { this.tone(base, 0.8, 'sawtooth', vol * 0.7, -base * 0.4, 0, pan); }
    else if (sp.arch === 'floater') { this.tone(base, 0.7, 'triangle', vol, base * 0.5, 0, pan); this.burst(0.2, 3000, 4, vol * 0.4, 'bandpass', 0, pan); }
    else if (sp.arch === 'crawler') { for (let i = 0; i < 4; i++) this.burst(0.03, base * 4, 5, vol * 0.8, 'bandpass', i * 0.07, pan); }
    else { this.tone(base, 0.5, 'triangle', vol, base * 0.2, 0, pan); }
  }

  // ---------- continuous
  scanLoop(on, progress = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.scanG.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.05);
    this.scanO.frequency.setTargetAtTime(380 + progress * 700, t, 0.05);
  }
  mineLoop(on) { if (!this.ready) return; this.mineG.gain.setTargetAtTime(on ? 0.12 : 0, this.ctx.currentTime, 0.05); }

  update(dt) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime, e = this.env;
    this.t += dt;
    // underwater / cockpit muffling
    const cut = e.underwater ? 420 : (e.inShip ? 5200 : 20000);
    this.lp.frequency.setTargetAtTime(cut, t, 0.15);
    // wind: outdoors on planets only
    const windVol = (e.space || e.inShip || e.underwater) ? 0.0 : Math.min(0.32, 0.035 * e.wind + e.storm * 0.18);
    this.windG.gain.setTargetAtTime(windVol, t, 0.4);
    this.windF.frequency.setTargetAtTime(280 + e.wind * 160 + e.storm * 500 + Math.sin(this.t * 0.35) * 120, t, 0.3);
    // drone
    const root = ROOT[e.space ? 'space' : e.planet] || 110;
    const dv = e.space ? 0.05 : (e.underwater ? 0.07 : 0.035) * (0.6 + 0.4 * (1 - e.day));
    this.drone.gain.setTargetAtTime(dv, t, 1);
    this.droneO.forEach((o, i) => o.frequency.setTargetAtTime(root * [0.5, 0.75 + 0.0013 * Math.sin(this.t * 0.1), 1.003][i], t, 1));
    // engine
    const thr = e.inShip ? e.thrust : 0;
    this.engG.gain.setTargetAtTime(e.inShip ? 0.04 + Math.min(0.28, thr * 0.1) : 0, t, 0.12);
    this.engO.frequency.setTargetAtTime(40 + thr * 22 + (e.cruise ? 80 : 0), t, 0.2);
    this.engF.frequency.setTargetAtTime(160 + thr * 260 + (e.cruise ? 900 : 0), t, 0.2);
    // music
    this.nextNote -= dt;
    if (this.nextNote <= 0) { this.playNote(); this.nextNote = 2.2 + Math.random() * 4.5; }
    // geiger
    if (e.rad > 0.05) {
      this.geigerT -= dt;
      if (this.geigerT <= 0) { this.burst(0.012, 3000 + Math.random() * 2000, 2, 0.12, 'highpass'); this.geigerT = Math.random() * (0.6 - e.rad * 0.55) + 0.02; }
    }
  }

  playNote() {
    const e = this.env; const key = e.space ? 'space' : e.planet;
    const sc = SCALES[key] || SCALES.khepri, root = (ROOT[key] || 110) * 2;
    const step = sc[Math.floor(Math.random() * sc.length)], oct = Math.random() < 0.3 ? 2 : 1;
    const f = root * Math.pow(2, step / 12) * oct * (e.underwater ? 0.5 : 1);
    const dur = 5 + Math.random() * 4;
    const ctx = this.ctx, t0 = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 1.004;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.07, t0 + dur * 0.4); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); o2.connect(g); g.connect(this.music);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
  }
}
