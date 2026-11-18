// main.js — VELDORA's entry point: the game loop, the title → play → pause →
// busted state machine, HUD wiring, mission events, saving, and the ?shot=
// modes the screenshots use (start / street / chase / mission).
import { CONFIG } from './config.js';
import { World } from './world.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { HUD } from './hud.js';
import { Menus } from './menus.js';
import { STORY_INTRO, FAIL_LINES } from './story.js';
import { saveExists, writeSave, readSave, clearSave } from './save.js';
import { buildCarMesh, Car } from './vehicles.js';
import { clamp } from './utils.js';

const canvas = document.getElementById('view');
const world = new World(canvas);
const input = new Input(canvas);
const camRig = new CameraRig(world.camera, canvas);
const hud = new HUD();
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot') || '';

let state = 'title'; // 'title' | 'playing' | 'paused' | 'over'
let lastTime = performance.now();
let introShown = false;
let gameWon = false;

const menus = new Menus({
  onPlay: (cont) => startGame(cont),
  onResume: () => { state = 'playing'; menus.hidePause(); hud.show(); },
  onSave: () => { doSave(); hud.toast('GAME SAVED', 'Progress kept for next time'); },
  onQuitToTitle: () => toTitle(),
  onRetry: () => startGame(false),
});

world.missions.onEvent = (type, data) => {
  if (type === 'brief') {
    hud.setObjective('', 'MISSION');
    hud.toast(data.brief.title, 'New job — press M for details');
    data.brief.lines.forEach(([who, text], i) => setTimeout(() => hud.say(who, text), 400 + i * 4200));
    world.audio.missionStart();
  } else if (type === 'objective') {
    hud.setObjective(data.text);
  } else if (type === 'say') {
    hud.say(data.who, data.text);
  } else if (type === 'complete') {
    const reward = CONFIG.missionRewards[data.index];
    world.player.cash += reward;
    hud.setCash(world.player.cash);
    hud.toast('MISSION COMPLETE', `+$${reward.toLocaleString('en-US')} — ${data.text}`);
    hud.setObjective('');
    if (world.missions.nextIndex() >= 0) {
      setTimeout(() => hud.say('Mara Voss', 'Next job\'s ready when you are. Press M.'), 3000);
    }
  } else if (type === 'fail') {
    hud.toast('MISSION FAILED', data.reason || '');
  } else if (type === 'gameWon') {
    gameWon = true;
    hud.toast('★ VELDORA CREW LEGEND ★', 'All five jobs done. Solmar Bay is yours.');
  }
};

function applySave(save) {
  const p = world.player;
  p.cash = save.cash ?? CONFIG.startCash;
  p.health = save.health ?? 100;
  p.armor = save.armor ?? 0;
  p.x = save.x ?? 0; p.z = save.z ?? 8;
  p.heading = save.heading ?? Math.PI;
  world.missions.completed = save.completed ?? [false, false, false, false, false];
  world.clockMinutes = save.clockMinutes ?? world.clockMinutes;
  camRig.camYaw = p.heading + Math.PI;
  camRig.targetYaw = camRig.camYaw;
  p.updateMesh();
}

function doSave() {
  const p = world.player;
  writeSave({
    cash: p.cash, health: p.health, armor: p.armor,
    x: world.px, z: world.pz, heading: world.heading,
    completed: world.missions.completed,
    clockMinutes: world.clockMinutes,
  });
}

function startGame(continueSaved) {
  world.audio.ensure();
  menus.hideStart();
  menus.hideOver();
  hud.show();
  if (continueSaved) {
    const save = readSave();
    if (save) applySave(save);
  } else {
    clearSave();
    world.player.cash = CONFIG.startCash;
    world.player.health = 100;
    world.player.armor = 0;
    world.missions.completed = [false, false, false, false, false];
    world.police.clearWanted();
    gameWon = false;
  }
  state = 'playing';
  if (!introShown) {
    introShown = true;
    STORY_INTRO.forEach(([who, text], i) => setTimeout(() => hud.say(who, text), 600 + i * 4600));
    hud.setObjective('Press M to start the first job', 'FREE ROAM');
  }
  hud.setCash(world.player.cash);
  hud.setWanted(0);
}

function toTitle() {
  state = 'title';
  doSave();
  hud.hide();
  menus.showStart(saveExists(), world.missions.completed);
}

function gameOver(text) {
  state = 'over';
  world.audio.setSiren(false);
  world.audio.setEngine(0, false);
  world.audio.busted();
  menus.showOver(text);
  hud.hide();
}

// --- Screenshot modes: deterministic staged scenes, no menus ------------
function setupShot(mode) {
  world.audio.ensure();
  hud.show();
  menus.hideStart();
  state = 'playing';
  const p = world.player;
  if (mode === 'start') {
    // Title screen over the city: stay on the title state.
    state = 'title';
    hud.hide();
    menus.showStart(false, [false, false, false, false, false]);
    return;
  }
  if (mode === 'street') {
    p.x = -7; p.z = 30; p.heading = Math.PI;
    camRig.camYaw = p.heading + Math.PI;
    camRig.targetYaw = camRig.camYaw;
    hud.setObjective('Explore Solmar Bay — press M to start the first job', 'FREE ROAM');
    hud.setHint('WASD move · E steal car · Click shoot');
  } else if (mode === 'chase') {
    // Player in a red sports car ON the road (x=-7 is a road centreline),
    // 3 stars, two cruisers closing in from behind.
    const mesh = buildCarMesh('sports', 0xd82020);
    world.scene.add(mesh);
    const car = new Car(mesh, 'sports', -7, 20, Math.PI);
    car.speed = 26;
    car.updateMesh();
    p.enterCar(car);
    world.driving.attach(car);
    camRig.snapBehindCar(car);
    world.police.setWanted(3);
    world.police.playerX = car.x; world.police.playerZ = car.z;
    for (const pc of world.police.cars) {
      pc.x = car.x + (Math.random() * 10 - 5);
      pc.z = car.z + 24 + Math.random() * 12;
      pc.heading = Math.PI;
      pc.speed = 24;
      pc.updateMesh();
    }
    // One cruiser cuts across ahead so the chase reads in the frame.
    const lead = world.police.cars[0];
    if (lead) {
      lead.x = car.x - 9; lead.z = car.z - 48;
      lead.heading = Math.PI; lead.speed = 20;
      lead.updateMesh();
    }
    hud.setObjective('LOSE THE COPS — get your wanted level to zero', 'MISSION 4 · HEAT WAVE');
    hud.setHint('WASD drive · Space brake');
  } else if (mode === 'mission') {
    world.missions.start(4);
    p.x = 53; p.z = 6; p.heading = Math.PI; // on the road, facing the bank down the street
    camRig.camYaw = p.heading + Math.PI;
    camRig.targetYaw = camRig.camYaw;
    // Jump the finale to its firefight stage for the shot.
    world.missions.stage = 1;
    world.missions.setMarker(53, -30, 0xffd23e);
    world.combat.spawnEnemy(59, -24);
    world.combat.spawnEnemy(47, -34);
    world.combat.spawnEnemy(55, -40);
    world.effects.addCashPickup(53, -30, 2500);
    hud.setObjective('Grab the vault cash and fight past the guards', 'MISSION 5 · THE BIG SCORE');
    hud.setHint('Click shoot · R reload');
  }
  hud.setCash(p.cash);
  hud.setWanted(world.police.wanted);
  p.updateMesh();
  world.render();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (state === 'playing') {
    // Pause.
    if (input.pressed('Escape') || input.pressed('KeyP')) {
      state = 'paused';
      menus.showPause();
      hud.hide();
      input.endFrame();
      return;
    }
    // Start next mission.
    if (input.pressed('KeyM') && world.missions.active < 0) {
      const next = world.missions.nextIndex();
      if (next >= 0) world.missions.start(next);
      else hud.toast('ALL JOBS DONE', 'Solmar Bay is yours, legend.');
    }
    // Hide HUD toggle.
    if (input.pressed('KeyH')) hud.el.hud.classList.toggle('hidden');
    camRig.handleInput(input, dt);
    const events = world.update(dt, input, camRig);
    for (const e of events) {
      if (e.type === 'busted') gameOver(FAIL_LINES.busted);
      else if (e.type === 'died') gameOver(FAIL_LINES.died);
      else if (e.type === 'cash') hud.toast(`+$${e.amount}`, 'Street cash');
      else if (e.type === 'carDestroyed') hud.toast('CAR DESTROYED', 'That one\'s scrap now.');
    }
    // Camera follows the player (or the car).
    const inCar = !!world.player.inCar;
    camRig.update(dt, world.px, world.pz, inCar ? 0 : 0, inCar, clamp(Math.abs(world.speedMph) / 100, 0, 1));
    // HUD.
    hud.setWanted(world.police.wanted);
    hud.setCash(world.player.cash);
    hud.setVitals(world.player.health, world.player.armor);
    hud.setAmmo(world.combat.ammo, world.combat.reserve, inCar);
    const mph = world.speedMph;
    const gear = !inCar ? '' : world.player.inCar.speed < -0.5 ? 'R' : mph < 25 ? '1' : mph < 50 ? '2' : mph < 75 ? '3' : '4';
    hud.setSpeed(mph, gear, inCar);
    hud.tickClock(dt);
    hud.drawMinimap({
      px: world.px, pz: world.pz, heading: world.heading,
      roadLines: world.city.roadLines,
      marker: world.missions.markerPos,
      traffic: world.traffic.cars,
      police: world.police.cars,
    });
    if (state !== 'playing') { input.endFrame(); return; }
  } else if (state === 'title') {
    // Slow cinematic orbit behind the title screen.
    camRig.camYaw += dt * 0.05;
    camRig.update(dt, 0, 40, 0, false, 0);
    world.weather.update(dt, world.clockMinutes, world.props);
    world.traffic.update(dt);
    world.pedestrians.update(dt, 0, 40, 0);
    world.effects.update(dt);
  }
  world.render();
  input.endFrame();
}

// Test hooks for the automated play-test (not part of the game UI).
window.__veldora = {
  world, camRig, hud, input,
  state: () => state,
  start: (cont) => startGame(cont),
  shot: (mode) => setupShot(mode),
};

// Boot.
menus.showStart(saveExists(), world.missions.completed);
if (shotMode) setupShot(shotMode);
requestAnimationFrame(frame);
