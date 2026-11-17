// VELDORA — the HUD: cash, wanted stars, health, speed, mission objective,
// a live minimap, toasts, prompts, menus and saving to localStorage.

V.Hud = function Hud(city) {
  this.city = city;
  this.el = {};
  ['hud', 'cash', 'stars', 'objName', 'objText', 'objDist', 'healthFill',
   'speedBox', 'speedNum', 'carName', 'crosshair', 'prompt', 'toast', 'damage',
   'menu', 'howto', 'pause', 'end', 'endTitle', 'endText', 'missionList',
   'btnNew', 'btnContinue', 'btnHow', 'btnHowBack', 'btnResume', 'btnSave',
   'btnRestartMission', 'btnQuit', 'btnEndOk'].forEach(function (id) {
    this.el[id] = document.getElementById(id);
  }, this);
  this.map = document.getElementById('minimap');
  this.mapCtx = this.map.getContext('2d');
  this.toastTimer = null;
  this.lastStars = -1;
};

V.Hud.prototype.show = function show(id) { this.el[id].classList.remove('hidden'); };
V.Hud.prototype.hide = function hide(id) { this.el[id].classList.add('hidden'); };
V.Hud.prototype.showOnly = function showOnly(ids) {
  const all = ['menu', 'howto', 'pause', 'end'];
  const self = this;
  all.forEach(function (id) { self.el[id].classList.toggle('hidden', ids.indexOf(id) < 0); });
};

V.Hud.prototype.setCash = function setCash(n) { this.el.cash.textContent = V.money(n); };

V.Hud.prototype.setStars = function setStars(n) {
  if (n === this.lastStars) return;
  this.lastStars = n;
  let html = '';
  for (let i = 0; i < 5; i++) html += i < n ? '★' : '<span class="dim">★</span>';
  this.el.stars.innerHTML = html;
};

V.Hud.prototype.setHealth = function setHealth(h) {
  this.el.healthFill.style.width = V.clamp(h, 0, 100) + '%';
};

V.Hud.prototype.setSpeed = function setSpeed(kmh, carName) {
  if (!carName) { this.hide('speedBox'); return; }
  this.show('speedBox');
  this.el.speedNum.textContent = Math.round(kmh);
  this.el.carName.textContent = carName;
};

V.Hud.prototype.setObjective = function setObjective(name, text, dist) {
  this.el.objName.textContent = name || 'FREE ROAM';
  this.el.objText.textContent = text || 'Explore Veldora. Find a car, cause trouble, or take a mission.';
  this.el.objDist.textContent = dist !== null && dist !== undefined ? Math.round(dist) + ' m' : '';
};

V.Hud.prototype.setPrompt = function setPrompt(html) {
  if (!html) { this.hide('prompt'); return; }
  this.el.prompt.innerHTML = html;
  this.show('prompt');
};

V.Hud.prototype.toast = function toast(text, ms) {
  const t = this.el.toast;
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(this.toastTimer);
  const self = this;
  this.toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 3000);
};

V.Hud.prototype.flashDamage = function flashDamage() {
  const d = this.el.damage;
  d.style.opacity = '1';
  setTimeout(function () { d.style.opacity = '0'; }, 120);
};

V.Hud.prototype.setCrosshair = function setCrosshair(on) {
  this.el.crosshair.classList.toggle('hidden', !on);
};

/** Draw the round minimap: roads, blocks, sea, blips for player, police, target. */
V.Hud.prototype.drawMinimap = function drawMinimap(player, target, policeCars, cops) {
  const g = this.mapCtx;
  const S = 190, C = S / 2;
  const scale = S / 380; // world -190..190 -> map
  function mx(x) { return C + x * scale; }
  function my(z) { return C + z * scale; }
  g.clearRect(0, 0, S, S);
  // land + sea
  g.fillStyle = '#6f8f52';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#2a7ab8';
  g.fillRect(0, my(172), S, S - my(172));
  g.fillStyle = '#e2cd96';
  g.fillRect(0, my(166), S, my(172) - my(166));
  // blocks
  g.fillStyle = '#8a8f94';
  const city = this.city;
  city.blockCenters.forEach(function (bx) {
    city.blockCenters.forEach(function (bz) {
      g.fillRect(mx(bx - 19), my(bz - 19), 38 * scale, 38 * scale);
    });
  });
  // roads
  g.strokeStyle = '#33363c';
  g.lineWidth = 10 * scale;
  city.roadCoords.forEach(function (c) {
    g.beginPath(); g.moveTo(mx(-168), my(c)); g.lineTo(mx(168), my(c)); g.stroke();
    g.beginPath(); g.moveTo(mx(c), my(-168)); g.lineTo(mx(c), my(168)); g.stroke();
  });
  // mission target
  if (target) {
    g.fillStyle = '#ffd23e';
    g.save();
    g.translate(mx(target.x), my(target.z));
    g.rotate(Math.PI / 4);
    const s = 7;
    g.fillRect(-s / 2, -s / 2, s, s);
    g.restore();
  }
  // police
  g.fillStyle = '#ff4444';
  policeCars.forEach(function (c) {
    g.beginPath(); g.arc(mx(c.pos.x), my(c.pos.z), 3.5, 0, Math.PI * 2); g.fill();
  });
  cops.forEach(function (c) {
    g.beginPath(); g.arc(mx(c.pos.x), my(c.pos.z), 2.5, 0, Math.PI * 2); g.fill();
  });
  // player arrow (rotates with heading)
  g.save();
  g.translate(mx(player.pos.x), my(player.pos.z));
  g.rotate(player.heading);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#111111';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath();
  g.fill(); g.stroke();
  g.restore();
};

/** Fill the pause menu's mission list; onPick(index) starts that mission. */
V.Hud.prototype.fillMissions = function fillMissions(unlocked, activeIndex, onPick) {
  const list = this.el.missionList;
  list.innerHTML = '';
  V.MISSION_DEFS.forEach(function (def, i) {
    const b = document.createElement('button');
    const locked = i >= unlocked;
    b.className = locked ? 'locked' : '';
    b.innerHTML = (i + 1) + '. ' + def.name +
      (i === activeIndex ? ' — IN PROGRESS' : '') +
      '<span class="rw">' + V.money(def.reward) + '</span>';
    if (!locked) b.onclick = function () { onPick(i); };
    list.appendChild(b);
  });
};

V.Hud.prototype.showEnd = function showEnd(title, text) {
  this.el.endTitle.textContent = title;
  this.el.endTitle.style.color = title === 'BUSTED' ? '#6aa8ff' : '#ff5a4e';
  this.el.endText.textContent = text;
  this.showOnly(['end']);
};

/* ---------------- save / load ---------------- */
V.SAVE_KEY = 'veldora-save-v1';
V.loadSave = function loadSave() {
  try {
    const raw = localStorage.getItem(V.SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number' || typeof s.unlocked !== 'number') return null;
    return s;
  } catch (e) { return null; }
};
V.writeSave = function writeSave(state) {
  try {
    localStorage.setItem(V.SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) { return false; }
};
