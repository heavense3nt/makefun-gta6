// VELDORA — procedural audio: every sound is synthesized with WebAudio, no files.
// Engine hum, sirens, gunshots, crashes, pickups and a lazy synthwave bass loop.

V.Audio = (function buildAudio() {
  const api = {
    enabled: false, muted: false, ctx: null, master: null,
    engineOsc: null, engineGain: null, engineFilter: null,
    musicTimer: null, musicStep: 0, sirenOn: false, sirenOsc: null, sirenGain: null,
  };

  /** Start the audio context on the first user gesture; safe to call any time. */
  api.unlock = function unlock() {
    if (api.ctx) {
      if (api.ctx.state === 'suspended') api.ctx.resume().catch(function () {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      api.ctx = new AC();
      api.master = api.ctx.createGain();
      api.master.gain.value = 0.55;
      api.master.connect(api.ctx.destination);
      api.enabled = true;
      api.startEngine();
      api.startMusic();
    } catch (e) { api.enabled = false; }
  };

  api.toggleMute = function toggleMute() {
    api.muted = !api.muted;
    if (api.master) api.master.gain.value = api.muted ? 0 : 0.55;
    return api.muted;
  };

  /** A short filtered-noise burst (crash, gunshot body, skid). */
  function noiseBurst(dur, freq, gain, type) {
    if (!api.enabled || api.muted) return;
    const ctx = api.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = type || 'lowpass';
    filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filt); filt.connect(g); g.connect(api.master);
    src.start();
  }

  /** A short oscillator blip with a pitch slide. */
  function blip(freqA, freqB, dur, gain, type) {
    if (!api.enabled || api.muted) return;
    const ctx = api.ctx;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freqA, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g); g.connect(api.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  api.shot = function shot() { noiseBurst(0.14, 1800, 0.5, 'bandpass'); blip(220, 60, 0.1, 0.25, 'square'); };
  api.crash = function crash(hard) { noiseBurst(hard ? 0.4 : 0.2, hard ? 500 : 900, hard ? 0.7 : 0.35); };
  api.pickup = function pickup() { blip(880, 880, 0.07, 0.25); setTimeout(function () { blip(1318, 1318, 0.12, 0.25); }, 70); };
  api.missionDone = function missionDone() {
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { blip(f, f, 0.22, 0.3, 'triangle'); }, i * 110);
    });
  };
  api.busted = function busted() { blip(392, 196, 0.5, 0.35, 'sawtooth'); };
  api.click = function click() { blip(1200, 900, 0.05, 0.18, 'square'); };
  api.horn = function horn() { blip(370, 370, 0.18, 0.2, 'sawtooth'); setTimeout(function () { blip(370, 370, 0.18, 0.2, 'sawtooth'); }, 200); };

  /** Continuous engine hum whose pitch follows the player's speed (0..1). */
  api.startEngine = function startEngine() {
    const ctx = api.ctx;
    api.engineOsc = ctx.createOscillator();
    api.engineOsc.type = 'sawtooth';
    api.engineOsc.frequency.value = 55;
    api.engineFilter = ctx.createBiquadFilter();
    api.engineFilter.type = 'lowpass';
    api.engineFilter.frequency.value = 420;
    api.engineGain = ctx.createGain();
    api.engineGain.gain.value = 0.0;
    api.engineOsc.connect(api.engineFilter);
    api.engineFilter.connect(api.engineGain);
    api.engineGain.connect(api.master);
    api.engineOsc.start();
  };

  /** Call every frame: speed01 0..1, driving true when the player is in a car. */
  api.setEngine = function setEngine(speed01, driving) {
    if (!api.enabled || !api.engineOsc) return;
    const t = api.ctx.currentTime;
    const target = driving ? 0.05 + speed01 * 0.09 : 0.0;
    api.engineGain.gain.setTargetAtTime(target, t, 0.08);
    api.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    api.engineFilter.frequency.setTargetAtTime(380 + speed01 * 1400, t, 0.1);
  };

  /** Two-tone police siren loop, on while any wanted stars are up. */
  api.setSiren = function setSiren(on) {
    if (!api.enabled) return;
    if (on === api.sirenOn) return;
    api.sirenOn = on;
    if (on) {
      const ctx = api.ctx;
      api.sirenOsc = ctx.createOscillator();
      api.sirenOsc.type = 'triangle';
      api.sirenOsc.frequency.value = 720;
      api.sirenGain = ctx.createGain();
      api.sirenGain.gain.value = 0.0;
      api.sirenOsc.connect(api.sirenGain);
      api.sirenGain.connect(api.master);
      api.sirenOsc.start();
      api.sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
      api._sirenFlip = setInterval(function () {
        if (!api.sirenOsc) return;
        api.sirenOsc.frequency.setTargetAtTime(
          api.sirenOsc.frequency.value > 800 ? 700 : 950, api.ctx.currentTime, 0.05);
      }, 420);
    } else {
      clearInterval(api._sirenFlip);
      if (api.sirenOsc) {
        try { api.sirenOsc.stop(); } catch (e) {}
        api.sirenOsc = null;
      }
    }
  };

  /** A lazy 8-step bass + hat loop, quiet under everything else. */
  api.startMusic = function startMusic() {
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
    api.musicTimer = setInterval(function () {
      if (!api.enabled || api.muted) return;
      const step = api.musicStep % 8;
      api.musicStep++;
      const f = bass[step];
      if (f) blip(f, f * 0.995, 0.24, 0.16, 'triangle');
      if (step % 2 === 0) noiseBurst(0.03, 6000, 0.05, 'highpass');
    }, 240);
  };

  return api;
})();
