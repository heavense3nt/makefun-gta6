// VELDORA boot and game loop: builds the renderer, the sun-soaked sky, the
// city and every system, then runs the loop that ties them together — on-foot
// movement, driving, police, missions, combat, HUD, save and screens.
// One loop, fixed 1/60 s steps, whatever the display's rate.
//
// The two v3 control fixes live here in use:
//   1. STRAFE — player.step() moves along rig.forward()/rig.right(); D adds
//      +right (screen-right) at every yaw. Verified by verifyStrafeMath() and
//      by the in-browser key-press test (window.__veldora).
//   2. CAR-ENTRY CAMERA SNAP — enterCar() calls rig.snapToCarHeading() the
//      moment the player gets in, so steering matches the screen at once.

import { CITY, PLAYER, WANTED, MISSIONS } from './config.js';
import { createInput, ACT_ENTER, ACT_SHOOT, ACT_PAUSE, ACT_MISSION, ACT_JUMP, ACT_MUTE, ACT_CAMERA } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createCameraRig, verifyStrafeMath } from './camera.js';
import { createPlayer } from './player.js';
import { createVehicleSystem } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;
const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const canvas = document.getElementById('scene');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc3e8);
scene.fog = new THREE.Fog(0xcfe5f2, 190, 720);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 8, 20);

const sun = new THREE.DirectionalLight(0xfff2c8, 1.6);
sun.position.set(180, 260, 120);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfdfff, 0x8a7a5a, 0.9));
// the sun itself, a bright disc low over the sea
const sunDisc = new THREE.Mesh(
  new THREE.CircleGeometry(26, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff6cf, fog: false }),
);
sunDisc.position.set(620, 150, -60);
sunDisc.lookAt(camera.position);
scene.add(sunDisc);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- world and systems ----
const city = createCity(scene);
const audio = createAudio();
const input = createInput(canvas);
const rig = createCameraRig(camera);
const player = createPlayer(scene, new THREE.Vector3(0, 0, 8));
const vehicleSystem = createVehicleSystem(scene, city);
city.cometCar = vehicleSystem.comet;
const peds = createPedestrians(scene, city);
const police = createPolice(scene, vehicleSystem, city);
const combat = createCombat(scene, camera);
const effects = createEffects(scene);
const hud = createHud();

// tag every shootable mesh so combat can tell what a ray hit
for (const ped of peds.peds) {
  ped.mesh.userData.targetRef = ped;
  ped.mesh.userData.targetKind = ped.gang ? 'gang' : 'ped';
}
for (const car of vehicleSystem.cars) {
  car.mesh.userData.targetRef = { kind: 'car', car };
  car.mesh.userData.targetKind = 'car';
}

let mode = 'menu'; // menu | play | paused | busted
let cash = 0;
let currentCar = null;
let lastShotAt = null;
let saveTimer = 0;
let dustTimer = 0;

const missions = createMissions(scene, city, {
  toast: (msg) => hud.toast(msg),
  audio,
  addCash: (n) => { cash += n; },
  addWanted: (n) => police.addStars(n, () => {}),
  save: () => saveGame(),
  spawnGang: (pos) => {
    for (let i = 0; i < 3; i += 1) {
      const ped = peds.spawn(pos.x + (i - 1) * 4, pos.z + (i % 2) * 3, { armed: true, gang: true });
      ped.mesh.userData.targetRef = ped;
      ped.mesh.userData.targetKind = 'gang';
    }
  },
});

function saveGame() {
  writeSave({ cash, completed: missions.completed, x: player.pos.x, z: player.pos.z });
}

function announce(msg) { status.textContent = msg; }

function setCash(v) { cash = v; }

function startPlay(opts = {}) {
  const save = opts.fresh ? null : loadSave();
  if (save && !opts.fresh) {
    cash = save.cash;
    missions.setCompleted(save.completed);
    player.teleport(save.x, save.z);
  } else if (opts.fresh) {
    cash = 0;
    missions.setCompleted(0);
    player.teleport(0, 8);
  }
  police.clearAll();
  player.setHealth(PLAYER.maxHealth);
  currentCar = null;
  player.mesh.visible = true;
  mode = 'play';
  hud.show('play');
  audio.unlock();
  audio.startEngine();
  announce('Playing Veldora. Press R to start the first job.');
}

// ---- THE CAR-ENTRY CAMERA SNAP (v3 fix #2) ----
// The moment enterCar succeeds, camYaw becomes the car's heading + PI, so the
// camera sits behind the car and A/D steer the way the screen shows, from the
// very first frame. No easing, no slow swing.
function enterCar(car, opts = {}) {
  currentCar = car;
  car.parked = false;
  car.traffic = false;
  player.mesh.visible = false;
  rig.snapToCarHeading(car.heading);
  if (!opts.silent) {
    audio.click();
    hud.toast(`You took the ${car.name}.`);
    police.addStars(WANTED.stealCar, () => {});
  }
  window.__veldora.lastSnap = { camYaw: rig.yaw, heading: car.heading, at: performance.now() };
}

function exitCar() {
  if (!currentCar) return;
  const car = currentCar;
  car.speed = 0;
  currentCar = null;
  const px = car.mesh.position.x - Math.sin(car.heading + Math.PI / 2) * 2.4;
  const pz = car.mesh.position.z - Math.cos(car.heading + Math.PI / 2) * 2.4;
  player.teleport(px, pz);
  player.mesh.visible = true;
  audio.click();
}

function getBusted(reason) {
  mode = 'busted';
  const fine = Math.min(cash, WANTED.bustedFine);
  cash -= fine;
  hud.el.bustedText.textContent = `${reason} Bail and fines cost you $${fine}.`;
  hud.show('busted');
  audio.fail();
  audio.stopSiren();
  audio.stopEngine();
  police.clearAll();
  if (currentCar) { currentCar.speed = 0; currentCar = null; }
  player.mesh.visible = true;
  player.setHealth(PLAYER.maxHealth);
  player.teleport(0, 8);
  saveGame();
  announce(`Busted. $${fine} fine.`);
}

// The game object the screenshot staging (shots.js) drives: the systems, the
// entry points, and the driveAssist flag that holds the throttle open for the
// chase frame. Top-level on purpose — stepGame reads it every frame.
const game = {
  player, vehicleSystem, police, missions, hud, rig, city,
  startPlay, enterCar, setCash, driveAssist: false,
  setCameraOverview: () => rig.setOverview(),
};

// ---- shooting ----
function firePistol() {
  if (mode !== 'play' || currentCar) return;
  audio.unlock();
  const origin = player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const aimPoint = origin.clone().add(dir.multiplyScalar(60));
  const targets = [];
  for (const ped of peds.peds) if (ped.alive) targets.push(ped.mesh);
  for (const cop of police.cops) targets.push(cop.car ? cop.car.mesh : cop.mesh);
  const result = combat.shoot(origin, aimPoint, targets);
  if (!result) return;
  lastShotAt = result.point.clone();
  audio.shoot();
  const target = result.target;
  if (result.hit === 'ped' || result.hit === 'gang') {
    const ped = target;
    peds.kill(ped);
    effects.smoke(result.point);
    police.addStars(WANTED.shoot, () => {});
    if (ped.gang) missions.gangDown();
    hud.toast(ped.gang ? 'Dock Rat down.' : 'You shot a civilian! The cops are coming.');
  } else if (result.hit === 'cop') {
    police.removeCop(target.cop);
    effects.smoke(result.point);
    police.addStars(WANTED.killCop, () => {});
    hud.toast('You shot a cop! Every unit in Veldora is coming for you.');
  } else if (result.hit === 'copCar') {
    effects.sparks(result.point);
    police.addStars(WANTED.shoot, () => {});
    hud.toast('You shot at a police car — bad idea, Rico.');
  } else if (result.hit === 'car') {
    effects.sparks(result.point);
  } else if (result.hit === 'none') {
    // stray shot still draws attention
    police.addStars(0, () => {});
  }
}

// ---- per-frame update ----
function stepGame(dt) {
  const actions = input.takeActions();
  const look = input.takeLook();

  if (actions & ACT_MUTE) {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Sound off.' : 'Sound on.');
  }
  if (actions & ACT_PAUSE) {
    if (mode === 'play') {
      mode = 'paused';
      hud.el.pauseStats.textContent = `Cash $${cash.toLocaleString('en-US')} · Jobs done ${missions.completed}/5 · Wanted ${police.starCount()}★`;
      hud.show('paused');
      audio.setEngine(0, false);
    } else if (mode === 'paused') {
      mode = 'play';
      hud.show('play');
    }
    return;
  }
  if (mode !== 'play') return;

  if (actions & ACT_CAMERA) rig.cycleMode();
  if (actions & ACT_MISSION && missions.activeIndex < 0 && missions.completed < MISSIONS.length) {
    missions.start(missions.completed);
  }
  if (actions & ACT_SHOOT) firePistol();
  if (actions & ACT_ENTER) {
    if (currentCar) exitCar();
    else {
      const car = vehicleSystem.nearestCar(player.pos, 4.2);
      if (car) enterCar(car);
    }
  }

  const jump = !!(actions & ACT_JUMP);
  let speedNow = 0;
  let heading = player.facing;

  if (currentCar) {
    // Screenshot staging can hold the throttle open (driveAssist) so the
    // chase frame shows the car at speed, not coasting to a stop.
    const driveInput = game.driveAssist
      ? { throttle: () => 1, strafe: () => 0, held: input.held }
      : input;
    speedNow = vehicleSystem.driveStep(currentCar, dt, driveInput, true);
    heading = currentCar.heading;
    // run over pedestrians
    for (const ped of peds.peds) {
      if (!ped.alive) continue;
      const d = Math.hypot(ped.mesh.position.x - currentCar.mesh.position.x,
        ped.mesh.position.z - currentCar.mesh.position.z);
      if (d < 2 && Math.abs(currentCar.speed) > 4) {
        peds.kill(ped);
        effects.dust(ped.mesh.position);
        audio.thud();
        police.addStars(WANTED.runOverPed, () => {});
        hud.toast('You ran someone over! Wanted level up.');
      }
    }
    // dust at speed, engine note follows the throttle
    dustTimer -= dt;
    if (Math.abs(currentCar.speed) > 12 && dustTimer <= 0) {
      dustTimer = 0.12;
      effects.dust(currentCar.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)));
    }
    audio.setEngine(Math.abs(currentCar.speed) / currentCar.model.topSpeed, true);
  } else {
    const moved = player.step(dt, input, rig, city.colliders, { jump });
    speedNow = moved.speed;
    heading = player.facing;
    // gang members close in and swing at Rico
    for (const ped of peds.peds) {
      if (!ped.alive || !ped.gang) continue;
      const d = Math.hypot(ped.mesh.position.x - player.pos.x, ped.mesh.position.z - player.pos.z);
      if (d < 2.4 && player.hurt(7)) {
        hud.toast('A Dock Rat is beating on you!');
        if (player.health <= 0) { getBusted('The Dock Rats left you in the gutter.'); return; }
      }
    }
    audio.setEngine(0, false);
  }

  // police: chase, arrest, and the siren that follows the stars
  police.step(dt, currentCar ? currentCar.mesh.position : player.pos, !!currentCar,
    (reason) => getBusted(reason),
    (stars) => { if (stars > 0) audio.startSiren(); else audio.stopSiren(); });

  // pedestrians wander; a gunshot or a speeding car scatters them
  const threat = lastShotAt ?? (currentCar && Math.abs(currentCar.speed) > 10 ? currentCar.mesh.position : null);
  peds.step(dt, player.pos, threat);

  // missions advance; their beacon is the minimap's gold dot
  missions.step(dt, currentCar ? currentCar.mesh.position : player.pos, !!currentCar, currentCar);

  // camera follows the player or the car
  const target = currentCar ? currentCar.mesh.position : player.pos;
  rig.update(target, dt, look);

  // sea shimmer
  const seaMesh = city.group.children.find((c) => c.geometry?.type === 'PlaneGeometry' && c.position.x > 400);
  if (seaMesh) seaMesh.position.y = -0.4 + Math.sin(performance.now() / 1400) * 0.08;

  effects.step(dt);
  combat.step(dt);

  // HUD state
  const beaconTarget = missions.activeIndex >= 0 ? missions.targetOf() : null;
  const focus = currentCar ? currentCar.mesh.position : player.pos;
  const dist = beaconTarget ? Math.round(Math.hypot(focus.x - beaconTarget.x, focus.z - beaconTarget.z)) : 0;
  const objective = missions.objectiveText();
  if (beaconTarget) objective.dist = `${dist}m to target`;
  hud.update({
    stars: police.starCount(),
    cash,
    health: player.health,
    inCar: !!currentCar,
    speed: currentCar ? currentCar.speed : 0,
    carName: currentCar ? currentCar.name : '',
    objective,
    playerPos: focus,
    heading,
    cars: vehicleSystem.cars,
    cops: police.cops,
    peds: peds.peds,
    beaconPos: beaconTarget,
    armed: !currentCar,
    prompt: !currentCar && vehicleSystem.nearestCar(player.pos, 4.2)
      ? `Press E to enter the ${vehicleSystem.nearestCar(player.pos, 4.2).name}` : '',
  });

  // autosave every 20 s of play
  saveTimer += dt;
  if (saveTimer > 20) { saveTimer = 0; saveGame(); }
}

// ---- screens wiring ----
document.getElementById('startBtn').addEventListener('click', () => { audio.unlock(); startPlay({ fresh: true }); });
document.getElementById('continueBtn').addEventListener('click', () => { audio.unlock(); startPlay({}); });
document.getElementById('resumeBtn').addEventListener('click', () => { mode = 'play'; hud.show('play'); });
document.getElementById('quitBtn').addEventListener('click', () => {
  saveGame();
  mode = 'menu';
  audio.stopEngine(); audio.stopSiren();
  hud.show('menu');
  refreshContinue();
});
document.getElementById('bustedBtn').addEventListener('click', () => {
  mode = 'play';
  hud.show('play');
  audio.startEngine();
});

function refreshContinue() {
  const save = loadSave();
  document.getElementById('continueBtn').classList.toggle('hidden', !save);
}
refreshContinue();
hud.show('menu');
announce('Veldora. Press Start Engine to play.');

// ---- debug + test hooks (used by the v3 verification, never by the game) ----
window.__veldora = {
  strafeCheck: verifyStrafeMath(),
  get mode() { return mode; },
  get camYaw() { return rig.yaw; },
  get playerPos() { return { x: player.pos.x, z: player.pos.z }; },
  // While driving, the car is what moves — the on-foot position stays parked.
  get carPos() {
    return currentCar
      ? { x: currentCar.mesh.position.x, z: currentCar.mesh.position.z }
      : { x: player.pos.x, z: player.pos.z };
  },
  get heading() { return currentCar ? currentCar.heading : player.facing; },
  get inCar() { return !!currentCar; },
  get stars() { return police.starCount(); },
  get cash() { return cash; },
  get missionsDone() { return missions.completed; },
  get missionActive() { return missions.activeIndex; },
  startPlay: (fresh) => startPlay({ fresh: !!fresh }),
  enterCarAt: (x, z) => {
    const car = vehicleSystem.nearestCar(new THREE.Vector3(x, 0, z), 30);
    if (car) enterCar(car, { silent: true });
    return !!car;
  },
  setYaw: (yaw) => { rig.yaw = yaw; },
  teleport: (x, z) => player.teleport(x, z),
  // Test helper: put the player's car on the central avenue, facing north,
  // so a drive test measures the car, not the nearest building.
  placeCarOnRoad: () => {
    if (!currentCar) return false;
    currentCar.mesh.position.set(3, 0, 100);
    currentCar.heading = Math.PI;
    currentCar.speed = 0;
    rig.snapToCarHeading(Math.PI);
    return true;
  },
  get lastSnap() { return window.__veldora._snap ?? null; },
  set lastSnap(v) { window.__veldora._snap = v; },
};

// ---- main loop ----
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (mode === 'play') {
    while (accumulator >= STEP) { stepGame(STEP); accumulator -= STEP; }
  } else {
    accumulator = 0;
    // the menu still shows a living city behind the title
    rig.update(player.pos, 0.016, { x: 0.4, y: 0 });
    peds.step(0.016, player.pos, null);
    for (const car of vehicleSystem.cars) if (car.traffic) vehicleSystem.driveStep(car, 0.016, input, false);
    effects.step(0.016);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---- screenshot staging ----
if (shotName) stageShot(shotName, game);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') {
    mode = 'paused';
    hud.show('paused');
  }
});
