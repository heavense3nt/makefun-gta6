// VELDORA v7 — boot and the one loop: input every frame, the world in
// fixed 1/60 s steps, three.js paints what is there.
// Screens: title, play, paused, busted.
// ?shot=start|play|mission|street (with &seed=N) stages that scene, paints
// it twice and sets window.__shotReady for a screenshot.
// window.__veldora exposes the live state for play-testing.
import * as THREE from 'three';
import { CITY, MISSIONS, PLAYER } from './config.js';
import { mulberry32 } from './random.js';
import { clamp, strafeDot } from './utils.js';
import { Input } from './input.js';
import { generateCity } from './world.js';
import { buildBuildings } from './buildings.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayer, moveDirection } from './player.js';
import { createCamera, updateCamera, applyCamera, snapCameraToCar } from './camera.js';
import { createTraffic, createParkedCar, updateTraffic, nearestCar } from './vehicles.js';
import { updateDriving } from './driving.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createWanted, addHeat, updateWanted } from './police.js';
import { createCombat, spawnGuard, spawnPickup, shoot, updateCombat, collectPickups } from './combat.js';
import { createMissions, startMission, updateMissions, currentMissionName } from './missions.js';
import { DIALOGUE } from './story.js';
import { createHud, updateHud, drawMinimap, showToast, showBanner } from './hud.js';
import { createMenus, showScreen, fillJobList } from './menus.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2f55);
scene.fog = new THREE.Fog(0x3a3f66, 60, 260);
const camera3 = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
const hemi = new THREE.HemisphereLight(0x8a90c0, 0x2a2438, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
sun.position.set(-60, 80, 40);
scene.add(sun);

const city = generateCity(seed);
buildCity(scene, city);
buildBuildings(scene, city);

const input = new Input(canvas);
const cam = createCamera();
const player = createPlayer(scene, 0, 8);
const traffic = createTraffic(scene, city, 14);
const taxi = createParkedCar(scene, 15, 15, Math.PI / 2, 'taxi', 0xd8a83c);
traffic.push(taxi);
const sportsCar = createParkedCar(scene, city.landmarks.showroom.x, city.landmarks.showroom.z, 0, 'sports', 0xc23b2e);
sportsCar.sports = true;
traffic.push(sportsCar);
const peds = createPedestrians(scene, city, 26);
const wanted = createWanted();
const combat = createCombat();
const missions = createMissions(city);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud();
const menus = createMenus();
fillJobList(menus, MISSIONS);

// Street cash and first-aid, scattered where a player will find them.
const rng = mulberry32(seed + 31);
for (let i = 0; i < 8; i++) {
  spawnPickup(scene, combat, 'cash', -100 + rng() * 200, -100 + rng() * 200, 50 + Math.floor(rng() * 150));
}
for (let i = 0; i < 4; i++) {
  spawnPickup(scene, combat, 'medkit', -100 + rng() * 200, -100 + rng() * 200, 0);
}

const S = {
  screen: 'title',
  cash: 0,
  clock: 18 * 3600,
  inCar: false,
  playerCar: null,
  hudHidden: false,
  mouseDownPos: null,
  mouseDownTime: 0,
};

const saved = loadSave();
if (saved) {
  S.cash = saved.cash || 0;
  player.health = saved.health || PLAYER.maxHealth;
  missions.index = Math.min(saved.missionIndex || 0, MISSIONS.length);
}

function announce(msg) { status.textContent = msg; }
function say(lines) {
  for (const [who, line] of lines) showToast(hud, `${who}: ${line}`, 4200);
}

canvas.addEventListener('mousedown', (e) => { S.mouseDownPos = { x: e.clientX, y: e.clientY }; S.mouseDownTime = performance.now(); });
canvas.addEventListener('mouseup', (e) => {
  if (!S.mouseDownPos) return;
  const moved = Math.hypot(e.clientX - S.mouseDownPos.x, e.clientY - S.mouseDownPos.y);
  const quick = performance.now() - S.mouseDownTime < 500;
  S.mouseDownPos = null;
  if (moved < 6 && quick && S.screen === 'play' && !S.inCar) fireShot();
});

function fireShot() {
  const dir = new THREE.Vector3();
  camera3.getWorldDirection(dir);
  const origin = camera3.position.clone();
  const result = shoot(combat, origin, dir, 60);
  audio.shot();
  effects.spawn(origin.x + dir.x * 2, origin.y + dir.y * 2 - 0.2, origin.z + dir.z * 2, 0xffd94a, 6, 4, 0.18, 0.6);
  if (result.hit === 'guard') {
    showToast(hud, 'Guard down!', 1200);
    S.cash += 25;
  }
  if (wanted.stars < 2) addHeat(wanted, 1);
}

function enterCar(car) {
  S.inCar = true;
  S.playerCar = car;
  car.isPlayer = true;
  car.parked = false;
  player.mesh.visible = false;
  snapCameraToCar(cam, car.heading);
  audio.engine(true, 0);
  showToast(hud, car.sports ? 'Sports car stolen! The crew will love this.' : 'Car stolen — the heat is on.', 2600);
  addHeat(wanted, 1);
}

function exitCar() {
  const car = S.playerCar;
  S.inCar = false;
  S.playerCar = null;
  if (car) car.isPlayer = false;
  player.pos.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.2;
  player.pos.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.2;
  player.pos.y = 0;
  player.mesh.visible = true;
  audio.engine(false, 0);
}

function startGame() {
  S.screen = 'play';
  showScreen(menus, null);
  audio.unlock();
  audio.music(true);
  announce('Playing. Solmar Bay is yours.');
  if (missions.index === 0 && missions.state === 'idle') say(DIALOGUE.intro);
}

function pauseGame() {
  S.screen = 'pause';
  showScreen(menus, 'pause');
  writeSave({ cash: S.cash, health: player.health, missionIndex: missions.index });
}

function bustGame() {
  S.screen = 'busted';
  showScreen(menus, 'busted');
  audio.music(false);
  audio.siren(false);
  audio.engine(false, 0);
  say(DIALOGUE.busted);
}

function step(dt) {
  const pressed = input.takePressed();
  const mouse = input.takeMouse();
  S.clock += dt * 30; // 30 game-seconds per real second
  if (pressed.has('KeyP') || pressed.has('Escape')) {
    if (S.screen === 'play') pauseGame();
    else if (S.screen === 'pause') { S.screen = 'play'; showScreen(menus, null); }
  }
  if (S.screen !== 'play') return;
  if (pressed.has('KeyH')) {
    S.hudHidden = !S.hudHidden;
    document.getElementById('hud').style.display = S.hudHidden ? 'none' : 'block';
  }
  if (pressed.has('KeyM') && missions.state === 'idle') {
    const started = startMission(missions, city);
    if (started) {
      say(started.lines);
      showBanner(hud, `${started.mission.name.toUpperCase()} — ${started.mission.brief}`);
      if (missions.index === 3) addHeat(wanted, 3);
      if (missions.index === 4) {
        addHeat(wanted, 4);
        for (const [gx, gz] of [[-18, -48], [-12, -42], [-15, -38]]) spawnGuard(scene, combat, gx, gz);
        for (let i = 0; i < 3; i++) spawnPickup(scene, combat, 'cash', -18 + i * 3, -46, 500);
      }
    }
  }
  if (pressed.has('KeyE')) {
    if (S.inCar) exitCar();
    else {
      const car = nearestCar(traffic, player.pos.x, player.pos.z, 3.6);
      if (car) enterCar(car);
    }
  }
  if (pressed.has('KeyR') && combat.ammo < 12 && combat.reserve > 0 && combat.reloading <= 0) {
    combat.reloading = 1.4;
  }
  if (pressed.has('KeyF') && S.inCar) audio.horn();

  // Movement.
  let speedKmh = 0;
  if (S.inCar && S.playerCar) {
    const r = updateDriving(S.playerCar, dt, input, city, (x, z) => effects.skid(x, z));
    speedKmh = r.speedKmh;
    audio.engine(true, Math.abs(S.playerCar.speed) / 34);
  } else {
    updatePlayer(player, dt, input, cam.yaw, city);
    audio.engine(false, 0);
  }
  updateTraffic(traffic, dt);
  updatePedestrians(peds, dt, city, wanted.stars > 0 ? { x: player.pos.x, z: player.pos.z, level: wanted.stars } : null);
  const busted = updateWanted(scene, wanted, dt, player, S.inCar, S.playerCar);
  audio.siren(wanted.stars > 0);
  updateCombat(combat, dt, player, () => {
    player.health -= 6;
    effects.spawn(player.pos.x, 1.5, player.pos.z, 0xff5252, 5, 3, 0.3, 0.5);
  });
  const got = collectPickups(combat, player);
  if (got.cash > 0) { S.cash += got.cash; audio.cash(); showToast(hud, `+$${got.cash} street cash`, 1400); }
  if (got.healed > 0) { player.health = Math.min(PLAYER.maxHealth, player.health + got.healed); audio.pickup(); }
  const missionEvent = updateMissions(missions, dt, S.inCar ? S.playerCar : player.pos, S.inCar, wanted.stars, !!(S.playerCar && S.playerCar.sports));
  if (missionEvent) {
    S.cash += missionEvent.payout;
    audio.mission();
    showBanner(hud, `JOB DONE — +$${missionEvent.payout}`);
    if (missionEvent.allDone) say(DIALOGUE.done);
  }
  effects.update(dt);
  // Camera follows the player or the car.
  const focus = S.inCar && S.playerCar ? { x: S.playerCar.x, y: 0, z: S.playerCar.z } : player.pos;
  updateCamera(cam, dt, mouse, focus, S.inCar);
  applyCamera(camera3, cam);
  // HUD + minimap.
  updateHud(hud, {
    wanted: wanted.stars, cash: S.cash, clock: S.clock,
    health: player.health, armor: player.armor,
    ammo: combat.ammo, reserve: combat.reserve, reloading: combat.reloading > 0,
    speedKmh, inCar: S.inCar,
    objective: missions.state === 'active' ? `◉ ${currentMissionName(missions)} — ${missions.target ? missions.target.label : ''}` : currentMissionName(missions),
  });
  drawMinimap(hud, city, {
    x: focus.x, z: focus.z,
    beacon: missions.target ? { x: missions.target.x, z: missions.target.z } : null,
    traffic: traffic.filter((c) => !c.isPlayer),
    police: wanted.police,
  });
  if (player.health <= 0) {
    player.health = PLAYER.maxHealth;
    bustGame();
  }
  if (busted) bustGame();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - (frame.last || now)) / 1000, MAX_FRAME);
  frame.last = now;
  frame.acc = (frame.acc || 0) + dt;
  if (S.screen === 'title') {
    // Title backdrop: slow orbit over the plaza.
    cam.yaw += dt * 0.05;
    updateCamera(cam, dt, { dx: 0, dy: 0, wheel: 0 }, { x: 0, y: 0, z: 0 }, false);
    applyCamera(camera3, cam);
    updateTraffic(traffic, dt);
    updatePedestrians(peds, dt, city, null);
  } else if (S.screen === 'play' || S.screen === 'pause') {
    while (frame.acc >= STEP) { step(STEP); frame.acc -= STEP; }
  }
  renderer.render(scene, camera3);
}

menus.playBtn.addEventListener('click', startGame);
menus.resumeBtn.addEventListener('click', () => { S.screen = 'play'; showScreen(menus, null); });
menus.restartBtn.addEventListener('click', () => {
  player.health = PLAYER.maxHealth;
  wanted.stars = 0; wanted.police.length = 0;
  player.pos.x = 0; player.pos.z = 8; player.pos.y = 0;
  S.screen = 'play';
  showScreen(menus, null);
});

window.addEventListener('resize', () => {
  camera3.aspect = window.innerWidth / window.innerHeight;
  camera3.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.screen === 'play') pauseGame();
});

// ---- Screenshot staging: deterministic scenes from the real sim ----
function stageShot(name) {
  if (name === 'start') {
    // Title screen over a high dusk view of the plaza and skyline.
    S.screen = 'title';
    cam.yaw = Math.PI * 0.8;
    cam.pitch = 0.6;
    cam.distance = 20;
    updateCamera(cam, 0, { dx: 0, dy: 0, wheel: 0 }, { x: 0, y: 0, z: 0 }, false);
    applyCamera(camera3, cam);
    drawMinimap(hud, city, { x: 0, z: 0, beacon: null, traffic: traffic.filter((c) => !c.isPlayer), police: [] });
    let painted = 0;
    function paintTitle() {
      renderer.render(scene, camera3);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paintTitle);
      else window.__shotReady = true;
    }
    requestAnimationFrame(paintTitle);
    return;
  }
  S.screen = 'play';
  showScreen(menus, null);
  if (name === 'play') {
    // Kai in the red sports car, 3 stars, a cruiser cutting across ahead.
    enterCar(sportsCar);
    sportsCar.x = 15; sportsCar.z = -15; sportsCar.heading = Math.PI; sportsCar.speed = 17;
    sportsCar.mesh.position.set(sportsCar.x, 0, sportsCar.z);
    sportsCar.mesh.rotation.y = sportsCar.heading;
    addHeat(wanted, 2); // enterCar already added 1 star: total 3
    updateWanted(scene, wanted, 0.1, player, true, sportsCar);
    const cop = wanted.police[0];
    if (cop) {
      cop.x = 28; cop.z = -38; cop.heading = Math.PI * 0.85;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    }
    missions.state = 'active';
    missions.target = { x: 112, z: -30, radius: 5, label: 'Marina pickup' };
    missions.index = 0;
    cam.distance = 12; cam.pitch = 0.5;
  } else if (name === 'mission') {
    // Mission 5 firefight at the bank: guards, vault cash, beacon.
    missions.index = 4; missions.state = 'active';
    missions.target = { x: city.landmarks.bank.x, z: city.landmarks.bank.z, radius: 5, label: 'Bank vault' };
    player.pos.x = -45; player.pos.z = -45;
    player.mesh.position.set(player.pos.x, 0, player.pos.z);
    player.mesh.rotation.y = Math.PI / 2; // facing east, down the road at the bank
    for (const [gx, gz] of [[-18, -48], [-12, -42], [-15, -38]]) spawnGuard(scene, combat, gx, gz);
    for (let i = 0; i < 3; i++) spawnPickup(scene, combat, 'cash', -18 + i * 3, -46, 500);
    addHeat(wanted, 3);
    cam.yaw = -Math.PI / 2; // look east down the avenue at the bank
    cam.distance = 11; cam.pitch = 0.45;
  } else if (name === 'street') {
    // Kai on foot on the road, city vista behind him.
    player.pos.x = -8; player.pos.z = 20;
    player.mesh.position.set(player.pos.x, 0, player.pos.z);
    player.mesh.rotation.y = Math.PI * 0.9;
    cam.yaw = Math.PI * 0.9;
    cam.distance = 10; cam.pitch = 0.42;
    missions.state = 'idle';
  }
  // Settle the sim for a couple of frames so traffic/peds are in place.
  for (let i = 0; i < 30; i++) {
    updateTraffic(traffic, STEP);
    updatePedestrians(peds, STEP, city, null);
  }
  updateCamera(cam, 0, { dx: 0, dy: 0, wheel: 0 }, S.inCar && S.playerCar ? { x: S.playerCar.x, y: 0, z: S.playerCar.z } : player.pos, S.inCar);
  applyCamera(camera3, cam);
  updateHud(hud, {
    wanted: wanted.stars, cash: S.cash, clock: S.clock,
    health: player.health, armor: player.armor,
    ammo: combat.ammo, reserve: combat.reserve, reloading: false,
    speedKmh: S.inCar ? 60 : 0, inCar: S.inCar,
    objective: missions.state === 'active' ? `◉ ${currentMissionName(missions)} — ${missions.target ? missions.target.label : ''}` : currentMissionName(missions),
  });
  drawMinimap(hud, city, {
    x: S.inCar ? S.playerCar.x : player.pos.x, z: S.inCar ? S.playerCar.z : player.pos.z,
    beacon: missions.target ? { x: missions.target.x, z: missions.target.z } : null,
    traffic: traffic.filter((c) => !c.isPlayer),
    police: wanted.police,
  });
  let painted = 0;
  function paint() {
    renderer.render(scene, camera3);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// Test hooks for the play-test: strafe dot and camera snap, verified live.
window.__veldora = {
  state: S, player, cam, city, wanted, combat, missions,
  strafeDotAt(yaw) {
    const dir = moveDirection({ is: (code) => code === 'KeyD' }, yaw);
    return strafeDot(dir.x, dir.z, yaw);
  },
  snapCheck() {
    const before = cam.yaw;
    snapCameraToCar(cam, 1.25);
    return { before, after: cam.yaw, diff: Math.abs(cam.yaw - (1.25 + Math.PI)) };
  },
  buildingCount() { return city.buildings.length; },
};

if (shot) stageShot(shot);
else {
  announce('VELDORA. Press PLAY to start.');
  requestAnimationFrame(frame);
}
