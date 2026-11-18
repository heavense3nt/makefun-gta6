// VELDORA v7 — WebAudio synth sound: no audio files, no network.
// Engine hum, siren wail, gunshots, pickup blips and a bassline.
export function createAudio() {
  let ctx = null; let master = null; let engineOsc = null; let engineGain = null;
  let musicTimer = null; let sirenOsc = null; let sirenGain = null;
  const notes = [55, 55, 65.41, 49, 55, 82.41, 73.42, 65.41];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }

  function blip(freq, dur, type, vol) {
    if (!ensure()) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    shot() { blip(900, 0.09, 'square', 0.25); blip(160, 0.12, 'sawtooth', 0.2); },
    pickup() { blip(880, 0.08, 'sine', 0.2); setTimeout(() => blip(1320, 0.1, 'sine', 0.2), 70); },
    cash() { blip(660, 0.07, 'triangle', 0.2); setTimeout(() => blip(990, 0.09, 'triangle', 0.2), 60); },
    horn() { blip(370, 0.25, 'square', 0.15); },
    mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.22), i * 110)); },
    engine(on, speed01) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator(); engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
        engineGain.gain.value = 0.05;
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 320;
        engineOsc.connect(filter); filter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      if (engineOsc) {
        engineOsc.frequency.value = 55 + (speed01 || 0) * 130;
        engineGain.gain.value = on ? 0.04 + (speed01 || 0) * 0.05 : 0;
        if (!on) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; }
      }
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenGain = ctx.createGain();
        sirenOsc.type = 'sine'; sirenGain.gain.value = 0.05;
        const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.7; lfoGain.gain.value = 320;
        lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 750;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); sirenOsc._lfo.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
      }
    },
    music(on) {
      if (!ensure()) return;
      if (on && !musicTimer) {
        let i = 0;
        musicTimer = setInterval(() => {
          if (!ctx) return;
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'triangle'; o.frequency.value = notes[i % notes.length];
          g.gain.setValueAtTime(0.12, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          o.connect(g); g.connect(master);
          o.start(); o.stop(ctx.currentTime + 0.5);
          i += 1;
        }, 420);
      } else if (!on && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
  };
}
