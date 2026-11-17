// All sound in Veldora is synthesised live with WebAudio — no audio files, no
// network. A tiny synth kit: engine hum, gunshot, siren, coin chime, mission
// fanfare and UI clicks, all from oscillators and filtered noise.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = null;
  let sirenOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + dur);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) this.stopEngine();
      return muted;
    },
    get muted() { return muted; },
    click() { tone(660, 0.07, 'square', 0.12); },
    shoot() { noise(0.16, 0.5, 1800); tone(180, 0.1, 'sawtooth', 0.25, 60); },
    chime() { tone(880, 0.12, 'sine', 0.25); setTimeout(() => tone(1318, 0.2, 'sine', 0.25), 90); },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'triangle', 0.3), i * 110));
    },
    fail() { tone(220, 0.5, 'sawtooth', 0.2, 110); },
    thud() { noise(0.12, 0.3, 300); },
    startEngine() {
      if (!ensure() || muted) return;
      this.stopEngine();
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 420;
      engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    },
    /** speedRatio 0..1 while driving; 0 idles the hum down. */
    setEngine(speedRatio, on) {
      if (!engineOsc || !engineGain) return;
      const target = on ? 0.05 + speedRatio * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, ctx.currentTime, 0.12);
    },
    stopEngine() {
      try { engineOsc?.stop(); } catch { /* already stopped */ }
      engineOsc = null; engineGain = null;
    },
    startSiren() {
      if (!ensure() || sirenTimer) return;
      sirenTimer = setInterval(() => {
        if (muted) return;
        sirenOn = !sirenOn;
        tone(sirenOn ? 760 : 580, 0.42, 'sine', 0.07);
      }, 430);
    },
    stopSiren() { if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; } },
  };
}
