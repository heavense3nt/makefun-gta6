// VELDORA v6 — HUD: wanted stars, cash, clock, health/armour, ammo, live circular minimap.
export function createHud() {
  const starsEl = document.getElementById('stars');
  const cashEl = document.getElementById('cash');
  const clockEl = document.getElementById('clock');
  const healthFill = document.getElementById('health-fill');
  const armorFill = document.getElementById('armor-fill');
  const ammoEl = document.getElementById('ammo');
  const speedEl = document.getElementById('speed');
  const missionTitle = document.getElementById('mission-title');
  const missionText = document.getElementById('mission-text');
  const toastEl = document.getElementById('toast');
  const dialogueEl = document.getElementById('dialogue');
  const minimap = document.getElementById('minimap');
  const mm = minimap.getContext('2d');
  let toastTimer = null;
  let dialogueTimer = null;

  function starString(wanted) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < wanted ? '★' : '<span class="off">★</span>';
    return s;
  }
  return {
    update(state) {
      starsEl.innerHTML = starString(state.wanted);
      cashEl.textContent = '$' + state.cash.toLocaleString('en-US');
      clockEl.textContent = state.clockText;
      healthFill.style.width = Math.max(0, state.health) + '%';
      armorFill.style.width = Math.max(0, state.armor) + '%';
      ammoEl.textContent = `PISTOL — ${state.ammoMag} / ${state.ammoReserve}`;
      speedEl.textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 2.24)} MPH · ${state.carName || ''}` : 'ON FOOT';
      missionTitle.textContent = state.missionName || 'VELDORA';
      missionText.textContent = state.missionObjective || 'Press M to start the first job';
    },
    toast(text) {
      toastEl.textContent = text;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.textContent = ''; }, 2600);
    },
    say(text) {
      dialogueEl.textContent = text; dialogueEl.style.display = 'block';
      clearTimeout(dialogueTimer);
      dialogueTimer = setTimeout(() => { dialogueEl.style.display = 'none'; }, 5200);
    },
    // Circular minimap: sea west, roads grid, traffic dots, police red, beacon gold, player white.
    drawMinimap(state) {
      const S = 180; const scale = S / 440;
      mm.clearRect(0, 0, S, S);
      mm.save();
      mm.beginPath(); mm.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); mm.clip();
      mm.fillStyle = '#16324a'; mm.fillRect(0, 0, S, S);
      mm.fillStyle = '#2a5a3a'; mm.fillRect(20, 0, S - 20, S);
      mm.fillStyle = '#1d6f8e'; mm.fillRect(0, 0, 16, S);
      mm.strokeStyle = 'rgba(255,255,255,.35)'; mm.lineWidth = 2;
      for (let i = -4; i <= 4; i++) {
        const p = (i * 44 + 220) * scale;
        mm.beginPath(); mm.moveTo(p, 0); mm.lineTo(p, S); mm.stroke();
        mm.beginPath(); mm.moveTo(0, p); mm.lineTo(S, p); mm.stroke();
      }
      const dot = (x, z, color, r) => {
        mm.fillStyle = color; mm.beginPath();
        mm.arc((x + 220) * scale, (z + 220) * scale, r, 0, Math.PI * 2); mm.fill();
      };
      if (state.beacon) dot(state.beacon.x, state.beacon.z, '#ffd23e', 5);
      for (const c of state.trafficDots || []) dot(c.x, c.z, '#9fb8cc', 2.5);
      for (const u of state.policeDots || []) dot(u.x, u.z, '#ff3b30', 3.5);
      dot(state.x, state.z, '#ffffff', 4);
      mm.restore();
      mm.strokeStyle = 'rgba(255,255,255,.6)'; mm.lineWidth = 2;
      mm.beginPath(); mm.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); mm.stroke();
    },
  };
}
