// audio.js — procedural WebAudio sound for VELDORA. No audio files: every sound is
// synthesized (engine hum, siren, gunshot, pickup blips, mission stingers, a bass loop).
// The context is created lazily on the first user gesture; every call is guarded so the
// game runs fine in a headless browser with no audio device.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.musicTimer = null;
    this.musicOn = false;
    this._bassNotes = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41]; // A1 A1 C2 G1 ...
    this._bassStep = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 400;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      return true;
    } catch (e) { this.ctx = null; return false; }
  }

  setEngine(speed01, on) {
    if (!this.ctx || !this.engineGain) return;
    try {
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, t, 0.08);
      this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
    } catch (e) {}
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  _noise(dur, vol, freq) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) {}
  }

  gunshot() { this._noise(0.14, 0.5, 2500); this._tone(180, 0.08, 'square', 0.15, 60); }
  punch() { this._noise(0.08, 0.25, 500); }
  pickup() { this._tone(660, 0.09, 'sine', 0.2); setTimeout(() => this._tone(990, 0.12, 'sine', 0.2), 80); }
  cash() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.14, 'triangle', 0.2), i * 70)); }
  missionDone() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 'triangle', 0.22), i * 90)); }
  busted() { this._tone(220, 0.5, 'sawtooth', 0.2, 110); }
  sirenBlip() { this._tone(950, 0.18, 'square', 0.06, 1400); setTimeout(() => this._tone(1400, 0.18, 'square', 0.06, 950), 180); }
  click() { this._tone(800, 0.05, 'square', 0.1); }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const step = () => {
      if (!this.musicOn || !this.ctx) return;
      const f = this._bassNotes[this._bassStep % this._bassNotes.length];
      this._bassStep++;
      this._tone(f, 0.32, 'triangle', 0.12);
      if (this._bassStep % 4 === 2) this._tone(f * 2, 0.15, 'sine', 0.05);
      this.musicTimer = setTimeout(step, 340);
    };
    step();
  }
  stopMusic() { this.musicOn = false; if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; } }
}
