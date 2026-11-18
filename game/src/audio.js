// audio.js — all sound is synthesised with WebAudio: no audio files, no
// network. Engine hum, sirens, gunshots, pickups, UI clicks and a small
// bassline loop that keeps the city moving.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineLoop();
    this.startMusic();
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  blip(freq, dur, type = 'sine', vol = 0.25, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  click() { this.blip(720, 0.06, 'square', 0.12); }
  pickup() { this.blip(660, 0.09, 'sine', 0.22); setTimeout(() => this.blip(990, 0.14, 'sine', 0.22), 80); }
  cash() { [880, 1108, 1318].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.22), i * 70)); }
  gunshot() { this.noise(0.14, 0.5, 2600); this.blip(160, 0.1, 'square', 0.2, 60); }
  crash() { this.noise(0.35, 0.5, 700); this.blip(90, 0.3, 'sawtooth', 0.25, 40); }
  explosion() { this.noise(0.9, 0.7, 420); this.blip(70, 0.8, 'sine', 0.4, 28); }
  horn() { this.blip(370, 0.22, 'square', 0.14); this.blip(466, 0.22, 'square', 0.1); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.25), i * 110)); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.28), i * 120)); }
  busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => this.blip(f, 0.4, 'sawtooth', 0.2), i * 220)); }
  // Continuous engine hum: pitch follows speed 0..1.
  startEngineLoop() {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 55;
    f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.value = 0.0;
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start();
    this.engineOsc = o; this.engineGain = g;
  }
  setEngine(speed01, on) {
    if (!this.engineOsc) return;
    const t = this.now();
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, t, 0.1);
  }
  // Two-tone police siren while any wanted level is active.
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 700;
      g.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.type = 'square'; lfo.frequency.value = 0.9;
      lg.gain.value = 220;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.sirenOsc = o; this.sirenLfo = lfo; this.sirenGain = g;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null; this.sirenLfo = null;
    }
  }
  // Lazy sunset groove: a 16-step bassline + hats, all oscillators.
  startMusic() {
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
      const step = this.musicStep % 16;
      const f = bass[step];
      if (f) this.blip(f, 0.22, 'triangle', 0.16);
      if (step % 4 === 2) this.noise(0.03, 0.05, 6000);
      this.musicStep++;
    }, 190);
  }
}
