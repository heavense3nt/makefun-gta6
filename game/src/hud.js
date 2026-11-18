// hud.js — the 2D overlay: wanted stars, cash, clock, health/armor bars,
// speedometer, mission objective, dialogue box, toasts and the circular
// minimap that draws roads, the player, cars, cops and the mission beacon.
import { CITY } from './config.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      wanted: document.getElementById('wanted'),
      cash: document.getElementById('cash'),
      clock: document.getElementById('clock'),
      objective: document.getElementById('objective'),
      objectiveText: document.getElementById('objectiveText'),
      objectiveKicker: document.getElementById('objectiveKicker'),
      healthFill: document.getElementById('healthFill'),
      armorFill: document.getElementById('armorFill'),
      ammo: document.getElementById('ammo'),
      speedo: document.getElementById('speedo'),
      speedVal: document.getElementById('speedVal'),
      gearLabel: document.getElementById('gearLabel'),
      crosshair: document.getElementById('crosshair'),
      toast: document.getElementById('toast'),
      dialogue: document.getElementById('dialogue'),
      hint: document.getElementById('hint'),
      vignette: document.getElementById('vignette'),
      minimap: document.getElementById('minimap'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.dialogueTimer = null;
    this.clockMinutes = 12 * 60;
  }
  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }
  setWanted(level) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < level ? 'on' : ''}">★</span>`;
    this.el.wanted.innerHTML = stars;
    this.el.wanted.classList.toggle('hot', level >= 3);
  }
  setCash(cash) { this.el.cash.textContent = '$' + Math.floor(cash).toLocaleString('en-US'); }
  setVitals(health, armor) {
    this.el.healthFill.style.width = Math.max(0, health) + '%';
    this.el.armorFill.style.width = Math.max(0, armor) + '%';
    this.el.vignette.style.opacity = health < 35 ? String((35 - health) / 35 * 0.85) : '0';
  }
  setAmmo(ammo, reserve, inCar) {
    this.el.ammo.textContent = inCar ? 'DRIVING — E to exit · F horn' : `PISTOL  ${ammo} / ${reserve}  (R reload)`;
    this.el.crosshair.classList.toggle('hidden', inCar);
  }
  setSpeed(mph, gear, inCar) {
    this.el.speedo.classList.toggle('hidden', !inCar);
    if (!inCar) return;
    this.el.speedVal.textContent = String(Math.round(mph));
    this.el.gearLabel.textContent = gear;
  }
  setObjective(text, kicker = 'MISSION') {
    if (!text) { this.el.objective.classList.add('hidden'); return; }
    this.el.objective.classList.remove('hidden');
    this.el.objectiveKicker.textContent = kicker;
    this.el.objectiveText.textContent = text;
  }
  setHint(text) { this.el.hint.textContent = text; }
  toast(title, sub = '') {
    this.el.toast.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), 2600);
  }
  say(who, text, ms = 5200) {
    this.el.dialogue.innerHTML = `<b>${who}:</b> ${text}`;
    this.el.dialogue.classList.remove('hidden');
    clearTimeout(this.dialogueTimer);
    this.dialogueTimer = setTimeout(() => this.el.dialogue.classList.add('hidden'), ms);
  }
  tickClock(dt) {
    this.clockMinutes = (this.clockMinutes + dt * 0.6) % (24 * 60);
    const h = Math.floor(this.clockMinutes / 60);
    const m = Math.floor(this.clockMinutes % 60);
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return this.clockMinutes;
  }
  // Circular minimap: roads as lines, sea at the bottom, player arrow in the
  // middle, traffic white, police flashing blue/red, beacon gold.
  drawMinimap(state) {
    const ctx = this.mapCtx;
    const S = 176;
    const range = 260; // world units shown across the map
    const scale = S / (range * 2);
    const toMap = (x, z) => [S / 2 + (x - state.px) * scale, S / 2 + (z - state.pz) * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#2a2f3a'; ctx.fillRect(0, 0, S, S);
    // Sea strip at the south edge of the world.
    const seaTop = toMap(0, CITY.half + 10)[1];
    if (seaTop < S) {
      ctx.fillStyle = '#1f7fa8';
      ctx.fillRect(0, Math.max(0, seaTop), S, S);
      ctx.fillStyle = '#e8d29a';
      ctx.fillRect(0, Math.max(0, seaTop - 8), S, 8);
    }
    // Roads.
    ctx.strokeStyle = '#565b66'; ctx.lineWidth = 5;
    for (const c of state.roadLines) {
      const [x1] = toMap(c, 0); const [, z1] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(x1, -10); ctx.lineTo(x1, S + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, z1); ctx.lineTo(S + 10, z1); ctx.stroke();
    }
    // Mission beacon.
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#ffffff';
    for (const c of state.traffic) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Police: flashing.
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4444' : '#4488ff';
    for (const c of state.police) {
      const [x, y] = toMap(c.x, c.z);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow, pointing along the heading.
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(Math.atan2(Math.sin(state.heading), Math.cos(state.heading)) * -1 + Math.PI);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}
