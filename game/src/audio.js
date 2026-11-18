// VELDORA v6 — all sound is synthesised with WebAudio, no audio files.
export function createAudio() {
  let ctx = null;
  let musicTimer = null;
  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, gain, slideTo) {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, gain, freq) {
    const c = ensure(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = c.createGain(); g.gain.value = gain || 0.15;
    src.connect(f); f.connect(g); g.connect(c.destination); src.start();
  }
  return {
    unlock() { ensure(); },
    gunshot() { noise(0.12, 0.25, 900); tone(180, 0.08, 'square', 0.06, 60); },
    siren() { tone(700, 0.5, 'sine', 0.05, 1100); },
    horn() { tone(370, 0.25, 'square', 0.07); tone(466, 0.25, 'square', 0.05); },
    pickup() { tone(660, 0.1, 'sine', 0.09); setTimeout(() => tone(880, 0.14, 'sine', 0.09), 90); },
    mission() { tone(523, 0.15, 'triangle', 0.1); setTimeout(() => tone(784, 0.2, 'triangle', 0.1), 140); },
    engine(speed01) { tone(60 + speed01 * 140, 0.12, 'sawtooth', 0.03); },
    startMusic() {
      if (musicTimer || !ensure()) return;
      const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
      let i = 0;
      musicTimer = setInterval(() => { tone(bass[i % bass.length], 0.45, 'triangle', 0.05); i++; }, 480);
    },
  };
}
