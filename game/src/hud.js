// hud.js — VELDORA's HUD and menus: wanted stars, cash, health, ammo, speed,
// the mission objective, a live minimap, toasts, and the start / busted /
// complete screens. All DOM; the minimap is a 2D canvas drawn from game state.

export class HUD {
  constructor(game) {
    this.game = game;
    const root = document.getElementById('hud');
    root.innerHTML = `
      <div id="objective" class="panel"></div>
      <div id="topright" class="panel">
        <div id="stars"></div>
        <div id="cash">$0</div>
        <div id="healthbar"><div id="healthfill"></div></div>
        <div id="ammo">🔫 12 / 12</div>
      </div>
      <div id="minimap-wrap"><canvas id="minimap" width="180" height="180"></canvas>
        <div id="bustbar"><div id="bustfill"></div></div>
      </div>
      <div id="speed"></div>
      <div id="crosshair">+</div>
      <div id="toasts"></div>
      <div id="hint">WASD jalan/nyetir · E naik/turun mobil · klik tembak · F pukul · R reload · Shift lari · drag mouse putar kamera</div>`;
    this.objectiveEl = document.getElementById('objective');
    this.starsEl = document.getElementById('stars');
    this.cashEl = document.getElementById('cash');
    this.healthFill = document.getElementById('healthfill');
    this.ammoEl = document.getElementById('ammo');
    this.speedEl = document.getElementById('speed');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastsEl = document.getElementById('toasts');
    this.bustFill = document.getElementById('bustfill');
    this.setWanted(0);
    this.setCash(0);
    this.setHealth(100, 100);
    this.setAmmo(12, 12);
  }

  setObjective(text) { this.objectiveEl.textContent = text; }
  setWanted(n) {
    this.starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    this.starsEl.className = n > 0 ? 'hot' : '';
  }
  setCash(n) { this.cashEl.textContent = '$' + n.toLocaleString('en-US'); }
  setHealth(h, max) {
    this.healthFill.style.width = Math.max(0, (h / max) * 100) + '%';
    this.healthFill.style.background = h > 50 ? '#3fae5a' : h > 25 ? '#e0a53c' : '#d93b2e';
  }
  setAmmo(a, max) { this.ammoEl.textContent = `🔫 ${a} / ${max}`; }
  setSpeed(kmh) { this.speedEl.textContent = kmh > 1 ? `${Math.round(kmh)} km/h` : ''; }
  setBustProgress(f) { this.bustFill.style.width = (f * 100) + '%'; }

  toast(text, ms) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toastsEl.appendChild(el);
    while (this.toastsEl.children.length > 4) this.toastsEl.removeChild(this.toastsEl.firstChild);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, ms || 4200);
  }

  flashDamage() {
    const el = document.getElementById('damage-flash');
    if (!el) return;
    el.style.opacity = '0.45';
    setTimeout(() => { el.style.opacity = '0'; }, 120);
  }

  drawMinimap(game) {
    const g = this.mapCtx, S = 180;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#20262e'; g.fillRect(0, 0, S, S);
    const toMap = (x, z) => [((x + 280) / 580) * S, ((z + 280) / 580) * S];
    // beach + sea
    g.fillStyle = '#e2c98f';
    let [bx, by] = toMap(-280, 250); g.fillRect(0, by, S, S - by);
    g.fillStyle = '#1e6f9e';
    [bx, by] = toMap(-280, 310); g.fillRect(0, by, S, S - by);
    // roads
    g.strokeStyle = '#4a4f57'; g.lineWidth = 2;
    for (const s of game.city.streets) {
      const [x1, y1] = toMap(s, -260), [x2, y2] = toMap(s, 300);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [x3, y3] = toMap(-260, s), [x4, y4] = toMap(260, s);
      g.beginPath(); g.moveTo(x3, y3); g.lineTo(x4, y4); g.stroke();
    }
    // garage
    const [gx, gy] = toMap(game.city.garagePos.x, game.city.garagePos.z);
    g.fillStyle = '#ffd23f'; g.fillRect(gx - 3, gy - 3, 6, 6);
    // mission marker
    if (game.missions.marker) {
      const [mx, my] = toMap(game.missions.marker.x, game.missions.marker.z);
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    // traffic (white) and police (red)
    g.fillStyle = '#ddd';
    for (const c of game.traffic.cars) { const [x, y] = toMap(c.x, c.z); g.fillRect(x - 1, y - 1, 2, 2); }
    g.fillStyle = '#ff3333';
    for (const c of game.police.cars) { const [x, y] = toMap(c.x, c.z); g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    // player arrow
    const p = game.player;
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    const [ux, uy] = toMap(px, pz);
    const heading = p.inCar ? p.inCar.heading : p.heading;
    g.save();
    g.translate(ux, uy);
    // map: world +x -> right, world +z -> down; arrow drawn pointing up (0,-1),
    // so rotate by PI - heading to point it along (sin h, cos h).
    g.rotate(Math.PI - heading);
    g.fillStyle = '#3fae5a';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
    g.restore();
    // north label
    g.fillStyle = '#aaa'; g.font = '10px sans-serif'; g.fillText('N', 4, 12);
  }
}
