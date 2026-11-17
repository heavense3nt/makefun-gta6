// The HUD: wanted stars, cash, health, speed, mission objective, a round live
// minimap, toasts and the prompt line. The minimap is a top-down canvas: roads,
// sea, the player arrow, cars, cops (blue), the mission beacon (gold) and the
// race checkpoints, all scaled from world coordinates.

import { CITY } from './config.js';

export function createHud() {
  const el = {
    hud: document.getElementById('hud'),
    stars: document.getElementById('stars'),
    cash: document.getElementById('cash'),
    healthFill: document.getElementById('healthFill'),
    speed: document.getElementById('speed'),
    objTitle: document.getElementById('objTitle'),
    objText: document.getElementById('objText'),
    objDist: document.getElementById('objDist'),
    minimap: document.getElementById('minimap'),
    crosshair: document.getElementById('crosshair'),
    hint: document.getElementById('hint'),
    toast: document.getElementById('toast'),
    prompt: document.getElementById('prompt'),
    startScreen: document.getElementById('startScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    bustedScreen: document.getElementById('bustedScreen'),
    pauseStats: document.getElementById('pauseStats'),
    bustedText: document.getElementById('bustedText'),
    loading: document.getElementById('loading'),
  };
  const mapCtx = el.minimap.getContext('2d');
  let toastTimer = null;

  const WORLD = 620; // world span shown on the minimap (-310..310)

  function worldToMap(x, z) {
    const s = 190 / WORLD;
    return { x: 95 + x * s, y: 95 + z * s };
  }

  function drawMinimap(playerPos, heading, cars, cops, peds, beaconPos) {
    const g = mapCtx;
    g.clearRect(0, 0, 190, 190);
    // sea + sand on the east edge
    g.fillStyle = '#12333f';
    g.fillRect(0, 0, 190, 190);
    const sea = worldToMap(CITY.seaX, 0);
    g.fillStyle = '#1e7fa8';
    g.fillRect(sea.x, 0, 190 - sea.x, 190);
    const beach = worldToMap(CITY.beachX, 0);
    g.fillStyle = '#e8cf9a';
    g.fillRect(beach.x, 0, sea.x - beach.x, 190);
    // roads
    g.strokeStyle = '#3a3f47';
    g.lineWidth = 5;
    const pitch = CITY.blockPitch;
    for (let i = -4; i <= 4; i += 1) {
      const c = worldToMap(i * pitch, 0);
      g.beginPath(); g.moveTo(c.x, 0); g.lineTo(c.x, 190); g.stroke();
      g.beginPath(); g.moveTo(0, c.y); g.lineTo(190, c.y); g.stroke();
    }
    // mission beacon
    if (beaconPos) {
      const b = worldToMap(beaconPos.x, beaconPos.z);
      g.fillStyle = '#ffd23e';
      g.beginPath(); g.arc(b.x, b.y, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(b.x, b.y, 10, 0, Math.PI * 2); g.stroke();
    }
    // traffic + parked cars (grey dots)
    g.fillStyle = '#cfd6dd';
    for (const car of cars) {
      if (car.police) continue;
      const p = worldToMap(car.mesh.position.x, car.mesh.position.z);
      g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // cops (blue flashing dots)
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    g.fillStyle = flash ? '#ff2a2a' : '#2a6fff';
    for (const cop of cops) {
      const pos = cop.car ? cop.car.mesh.position : cop.mesh.position;
      const p = worldToMap(pos.x, pos.z);
      g.beginPath(); g.arc(p.x, p.y, 4, 0, Math.PI * 2); g.fill();
    }
    // player arrow, rotated to heading
    const p = worldToMap(playerPos.x, playerPos.z);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath();
    g.fill();
    g.restore();
    // north ring
    g.strokeStyle = 'rgba(255,255,255,.9)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(95, 95, 92, 0, Math.PI * 2); g.stroke();
  }

  function toast(message, seconds = 3.2) {
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    el.toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.style.opacity = '0'; }, seconds * 1000);
  }

  function update(state) {
    // stars
    let starsHtml = '';
    for (let i = 0; i < 5; i += 1) {
      starsHtml += `<span class="${i < state.stars ? '' : 'off'}">★</span>`;
    }
    el.stars.innerHTML = starsHtml;
    el.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
    el.healthFill.style.width = `${Math.max(0, state.health)}%`;
    if (state.inCar) {
      el.speed.classList.remove('hidden');
      el.speed.innerHTML = `${Math.round(Math.abs(state.speed) * 3.6)} <small>km/h · ${state.carName}</small>`;
    } else el.speed.classList.add('hidden');
    el.objTitle.textContent = state.objective.title;
    el.objText.textContent = state.objective.text;
    el.objDist.textContent = state.objective.dist;
    el.crosshair.classList.toggle('hidden', state.inCar || !state.armed);
    el.prompt.classList.toggle('hidden', !state.prompt);
    if (state.prompt) el.prompt.textContent = state.prompt;
    drawMinimap(state.playerPos, state.heading, state.cars, state.cops, state.peds, state.beaconPos);
  }

  function show(screen) {
    el.startScreen.classList.toggle('hidden', screen !== 'menu');
    el.pauseScreen.classList.toggle('hidden', screen !== 'paused');
    el.bustedScreen.classList.toggle('hidden', screen !== 'busted');
    el.hud.classList.toggle('hidden', screen !== 'play');
    el.loading.classList.add('hidden');
    if (screen === 'play') el.hint.textContent = 'WASD move & drive · SHIFT run · SPACE jump · E enter car · F shoot · C camera · P pause · M mute';
  }

  return { el, update, toast, show };
}
