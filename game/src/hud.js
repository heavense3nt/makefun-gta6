// VELDORA v7 — HUD: wanted stars, cash, clock, health/armour bars, ammo,
// speedometer, mission objective, dialogue toasts, and a live circular
// minimap drawn on a 2D canvas (roads, sea, traffic, police, beacon).
import { WANTED } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    stars: el('stars'), cash: el('cash'), clock: el('clock'),
    hpBar: el('hp-bar'), armorBar: el('armor-bar'), ammo: el('ammo'),
    speed: el('speed'), objective: el('objective'), toast: el('toast'),
    minimap: el('minimap'), banner: el('banner'),
  };
}

export function updateHud(hud, s) {
  const stars = '★'.repeat(s.wanted) + '☆'.repeat(WANTED.maxStars - s.wanted);
  hud.stars.textContent = stars;
  hud.stars.style.color = s.wanted > 0 ? '#ff5252' : '#ffd94a';
  hud.cash.textContent = `$${s.cash.toLocaleString('en-US')}`;
  const mins = String(Math.floor(s.clock / 60) % 60).padStart(2, '0');
  const hrs = String(Math.floor(s.clock / 3600) % 24).padStart(2, '0');
  hud.clock.textContent = `${hrs}:${mins}`;
  hud.hpBar.style.width = `${Math.max(0, s.health)}%`;
  hud.armorBar.style.width = `${Math.max(0, s.armor)}%`;
  hud.ammo.textContent = s.reloading ? 'RELOADING…' : `${s.ammo} / ${s.reserve}`;
  hud.speed.textContent = s.inCar ? `${Math.round(s.speedKmh)} MPH` : '';
  hud.objective.textContent = s.objective || '';
}

let toastTimer = null;
export function showToast(hud, text, ms) {
  hud.toast.textContent = text;
  hud.toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { hud.toast.style.opacity = '0'; }, ms || 3600);
}

export function showBanner(hud, text, ms) {
  hud.banner.textContent = text;
  hud.banner.style.opacity = '1';
  setTimeout(() => { hud.banner.style.opacity = '0'; }, ms || 2600);
}

// Circular minimap: north is up, the player is centred.
export function drawMinimap(hud, city, view) {
  const c = hud.minimap;
  const g = c.getContext('2d');
  const W = c.width; const H = c.height;
  const cx = W / 2; const cy = H / 2; const R = W / 2 - 2;
  const scale = R / 150; // view radius ~150 m
  g.clearRect(0, 0, W, H);
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(16,20,32,0.85)'; g.fillRect(0, 0, W, H);
  const px = (x) => cx + (x - view.x) * scale;
  const pz = (z) => cy + (z - view.z) * scale;
  // Sea to the east.
  g.fillStyle = '#14586b';
  g.fillRect(px(132), 0, W, H);
  // Roads.
  g.strokeStyle = '#555a66'; g.lineWidth = 3;
  for (const v of city.roads) {
    g.beginPath(); g.moveTo(px(v), pz(-130)); g.lineTo(px(v), pz(130)); g.stroke();
    g.beginPath(); g.moveTo(px(-130), pz(v)); g.lineTo(px(130), pz(v)); g.stroke();
  }
  // Buildings as faint blocks.
  g.fillStyle = '#3a4152';
  for (const b of city.buildings) {
    g.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * scale, b.d * scale);
  }
  // Mission beacon.
  if (view.beacon) {
    g.fillStyle = '#ffd94a';
    g.beginPath(); g.arc(px(view.beacon.x), pz(view.beacon.z), 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd94a'; g.lineWidth = 2;
    g.beginPath(); g.arc(px(view.beacon.x), pz(view.beacon.z), 10 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2); g.stroke();
  }
  // Traffic dots, police in red, player in white.
  g.fillStyle = '#9aa3b2';
  for (const t of view.traffic || []) { g.fillRect(px(t.x) - 1, pz(t.z) - 1, 3, 3); }
  g.fillStyle = '#ff5252';
  for (const p of view.police || []) { g.fillRect(px(p.x) - 2, pz(p.z) - 2, 4, 4); }
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(cx, cy, 3.5, 0, Math.PI * 2); g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
}
