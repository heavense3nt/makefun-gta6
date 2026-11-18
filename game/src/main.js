// VELDORA v6 — boot + game loop: Aurel Bay, Jax Marlowe, the Veldora crew's five jobs.
// ?seed=N fixes the city. ?shot=start|play|chase|mission stages a scene and sets window.__shotReady.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRandom } from './random.js';
import { clamp } from './utils.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createProps, createBeacon } from './props.js';
import { createVehicles, driveCar } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createPlayer } from './player.js';
import { createCombat } from './combat.js';
import { createCamera } from './camera.js';
import { createEffects, createDayCycle } from './effects.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { saveGame, loadGame } from './save.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;
const rng = createRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1200);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const dayCycle = createDayCycle(scene);
const city = createCity(scene, rng);
const props = createProps(scene, rng, city.colliders);
const vehicles = createVehicles(scene, rng, city.colliders);
const peds = createPedestrians(scene, rng);
const police = createPolice(scene, rng);
const player = createPlayer(scene);
const combat = createCombat(scene);
const cam = createCamera();
const effects = createEffects(scene);
const missions = createMissions();
const hud = createHud();
const audio = createAudio();
const beacon = createBeacon(scene);
const input = createInput(canvas);

const saved = loadGame();
const state = {
  cash: saved ? saved.cash : 250,
  wanted: 0,
  hour: 18.67, // 18:40, golden dusk
  inCar: false,
  car: null,
  carName: '',
  speed: 0,
  missionIndex: saved ? saved.missionIndex : -1,
  screen: 'title', // title | play | paused | busted
  coolTimer: 0,
  shootCooldown: 0,
  reloadTimer: 0,
};
if (saved) { player.x = saved.x; player.z = saved.z; player.health = saved.health; player.armor = saved.armor; player.ammoReserve = saved.ammoReserve; }

const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const bustedScreen = document.getElementById('busted-screen');
const hudEl = document.getElementById('hud');

// Test hook (documented, not gameplay): lets a headless check read live state.
window.__veldora = { state, player, cam, vehicles, police, combat, missions, city };

function setWanted(n) { state.wanted = clamp(n, 0, CONFIG.wantedMax); }
function say(text) { hud.say(text); }

const missionState = {
  get x() { return player.x; }, get z() { return player.z; },
  get inCar() { return state.inCar; }, get carName() { return state.carName; },
  get wanted() { return state.wanted; },
  get guardsLeft() { return combat.guards.length; },
  get cash() { return state.cash; }, set cash(v) { state.cash = v; },
  say, setWanted,
  spawnGuards(pos) { combat.spawnGuards(pos); },
};

function startMission(i) {
  const m = missions.start(i, missionState);
  beacon.set(m.target.x, m.target.z);
  hud.toast(`${m.name} — ${m.objective}`);
  audio.mission();
  state.missionIndex = i;
  saveGame({ ...state, missionIndex: i, x: player.x, z: player.z, health: player.health, armor: player.armor, ammoReserve: player.ammoReserve });
}

function enterCar(car) {
  state.inCar = true; state.car = car; state.carName = car.name;
  // CAMERA SNAP (mandatory): one assignment, camYaw = car.heading + PI. No easing.
  cam.snapToCar(car.heading);
  hud.toast(`Stole the ${car.name}!`);
  audio.horn();
  if (state.wanted < 1) setWanted(1);
  car.traffic = false;
}

function exitCar() {
  const car = state.car;
  player.x = car.x + Math.cos(car.heading) * 3;
  player.z = car.z - Math.sin(car.heading) * 3;
  player.y = 0; player.vy = 0;
  state.inCar = false; state.car = null; state.carName = ''; state.speed = 0;
}

function bust() {
  state.screen = 'busted';
  bustedScreen.style.display = 'flex';
  setWanted(0); player.health = CONFIG.playerHealth;
  player.x = 0; player.z = 40;
  state.inCar = false; state.car = null;
  audio.siren();
}

function startGame() {
  titleScreen.style.display = 'none';
  state.screen = 'play';
  audio.unlock(); audio.startMusic();
  if (state.missionIndex < 0) say('Jax Marlowe is back in Aurel Bay. Press M for the first job.');
}

function step(dt, t) {
  state.hour += dt * 0.008;
  dayCycle.update(state.hour % 24);
  const mouse = input.consumeMouse();
  // One-shot actions.
  if (input.takePressed('KeyM')) {
    if (!missions.current) {
      const next = (state.missionIndex + 1) % 5;
      startMission(next);
    }
  }
  if (input.takePressed('KeyP')) {
    if (state.screen === 'play') { state.screen = 'paused'; pauseScreen.style.display = 'flex'; saveGame({ ...state, x: player.x, z: player.z, health: player.health, armor: player.armor, ammoReserve: player.ammoReserve }); }
    else if (state.screen === 'paused') { state.screen = 'play'; pauseScreen.style.display = 'none'; }
  }
  if (input.takePressed('KeyH')) hudEl.style.display = hudEl.style.display === 'none' ? '' : 'none';
  if (input.takePressed('Enter') && state.screen === 'busted') { bustedScreen.style.display = 'none'; state.screen = 'play'; }

  if (state.screen !== 'play') return;

  if (input.takePressed('KeyE')) {
    if (state.inCar) exitCar();
    else {
      const car = vehicles.nearestStealable(player.x, player.z, 4.5);
      if (car) enterCar(car);
    }
  }
  if (input.takePressed('KeyF') && state.inCar) audio.horn();
  if (input.takePressed('KeyR') && player.ammoMag < CONFIG.pistolMag && player.ammoReserve > 0 && state.reloadTimer <= 0) {
    state.reloadTimer = 1.1;
  }
  if (state.reloadTimer > 0) {
    state.reloadTimer -= dt;
    if (state.reloadTimer <= 0) {
      const need = CONFIG.pistolMag - player.ammoMag;
      const take = Math.min(need, player.ammoReserve);
      player.ammoMag += take; player.ammoReserve -= take;
    }
  }

  // Movement.
  if (state.inCar) {
    state.speed = driveCar(state.car, dt, input.forwardInput(), input.strafeInput());
    player.x = state.car.x; player.z = state.car.z; player.y = 0;
    if (Math.abs(state.speed) > 1) audio.engine(Math.abs(state.speed) / CONFIG.carMaxSpeed);
  } else {
    player.move(dt, cam.camYaw, input.forwardInput(), input.strafeInput(), input.sprint(), input.takePressed('Space'), city.colliders);
  }

  // Shooting (on foot, or from the car window).
  state.shootCooldown -= dt;
  if (input.isShooting() && state.shootCooldown <= 0 && state.reloadTimer <= 0 && player.ammoMag > 0) {
    state.shootCooldown = 0.22;
    player.ammoMag--;
    const origin = new THREE.Vector3(player.x, player.y + 1.5, player.z);
    const fwd = new THREE.Vector3(-Math.sin(cam.camYaw), -0.05, -Math.cos(cam.camYaw));
    const target = origin.clone().add(fwd.multiplyScalar(60));
    const hit = combat.shoot(origin, target);
    effects.muzzle(player.x + fwd.x * 1.2, player.y + 1.5, player.z + fwd.z * 1.2);
    audio.gunshot();
    peds.scare(player.x, player.z, 30);
    if (state.wanted < 2) setWanted(2);
    if (hit) hud.toast('Guard down!');
  }

  // Pickups.
  for (const p of props.collectNear(player.x, player.z, 2.2)) {
    if (p.kind === 'cash') { state.cash += p.value; hud.toast(`+$${p.value} street cash`); }
    else { player.heal(p.value); hud.toast(`+${p.value} health`); }
    audio.pickup();
  }

  // Police + wanted heat.
  police.update(dt, player.x, player.z, state.wanted, state.inCar, bust);
  const nearestPolice = police.nearestDist(player.x, player.z);
  if (state.wanted > 0 && nearestPolice > 70) {
    state.coolTimer += dt;
    if (state.coolTimer > 6) { setWanted(state.wanted - 1); state.coolTimer = 0; if (state.wanted === 0) hud.toast('You lost them. Heat is off.'); }
  } else state.coolTimer = 0;
  if (state.wanted > 0 && Math.random() < dt * 0.1) audio.siren();

  // Guards shoot back.
  combat.updateGuards(dt, player.x, player.z, player.y, (dmg) => {
    if (player.hurt(dmg)) bust();
  });

  // Mission check.
  if (missions.current && missions.current.check(missionState)) {
    const m = missions.complete(missionState);
    beacon.hide();
    hud.toast(`${m.name} complete! +$${m.reward}`);
    audio.mission();
    state.missionIndex = missions.index;
    saveGame({ ...state, x: player.x, z: player.z, health: player.health, armor: player.armor, ammoReserve: player.ammoReserve });
  }

  vehicles.update(dt, t);
  peds.update(dt);
  props.update(dt, t);
  beacon.update(t);
  combat.update(dt);
  effects.update(dt);

  // Camera + HUD.
  const target = state.inCar ? { x: state.car.x, y: 0, z: state.car.z } : { x: player.x, y: player.y, z: player.z };
  const camPos = cam.update(dt, target, mouse.x, mouse.y, state.inCar);
  cam.apply(camera, camPos, target);
  const hours = Math.floor(state.hour % 24);
  const mins = Math.floor((state.hour % 1) * 60);
  hud.update({
    wanted: state.wanted, cash: state.cash,
    clockText: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
    health: player.health, armor: player.armor,
    ammoMag: player.ammoMag, ammoReserve: player.ammoReserve,
    inCar: state.inCar, speed: state.speed, carName: state.carName,
    missionName: missions.current ? missions.current.name : null,
    missionObjective: missions.current ? missions.current.objective : null,
    x: player.x, z: player.z,
    beacon: missions.current ? missions.current.target : null,
    trafficDots: vehicles.cars.filter((c) => c.traffic).map((c) => ({ x: c.x, z: c.z })),
    policeDots: police.units.filter((u) => u.active).map((u) => ({ x: u.x, z: u.z })),
  });
  hud.drawMinimap({
    x: player.x, z: player.z,
    beacon: missions.current ? missions.current.target : null,
    trafficDots: vehicles.cars.filter((c) => c.traffic).map((c) => ({ x: c.x, z: c.z })),
    policeDots: police.units.filter((u) => u.active).map((u) => ({ x: u.x, z: u.z })),
  });
}

function stageShot(name) {
  // Stage a scene for screenshots, then flag readiness after two paints.
  if (name === 'start') {
    state.screen = 'title';
    player.x = 0; player.z = 40;
    cam.camYaw = Math.PI * 0.9;
  } else if (name === 'play') {
    titleScreen.style.display = 'none'; state.screen = 'play';
    player.x = 10; player.z = 10;
    setWanted(0);
  } else if (name === 'chase') {
    titleScreen.style.display = 'none'; state.screen = 'play';
    const comet = vehicles.comet;
    // Stage the chase on the north avenue: car on the road, police closing in.
    comet.x = 44; comet.z = -60; comet.heading = 0;
    comet.mesh.position.set(44, 0, -60); comet.mesh.rotation.y = 0;
    enterCar(comet);
    comet.speed = 24;
    player.x = comet.x; player.z = comet.z;
    setWanted(3);
    police.update(0.1, player.x, player.z, 3, true, () => {});
    startMission(2);
    beacon.set(comet.x, comet.z + 40);
  } else if (name === 'mission') {
    titleScreen.style.display = 'none'; state.screen = 'play';
    player.x = 44; player.z = 100;
    startMission(4);
  }
  const target = state.inCar ? { x: state.car.x, y: 0, z: state.car.z } : { x: player.x, y: player.y, z: player.z };
  const camPos = cam.update(0.016, target, 0, 0, state.inCar);
  cam.apply(camera, camPos, target);
  hud.update({
    wanted: state.wanted, cash: state.cash, clockText: '18:40',
    health: player.health, armor: player.armor, ammoMag: player.ammoMag, ammoReserve: player.ammoReserve,
    inCar: state.inCar, speed: state.speed, carName: state.carName,
    missionName: missions.current ? missions.current.name : null,
    missionObjective: missions.current ? missions.current.objective : null,
    x: player.x, z: player.z,
    beacon: missions.current ? missions.current.target : null,
    trafficDots: vehicles.cars.filter((c) => c.traffic).map((c) => ({ x: c.x, z: c.z })),
    policeDots: police.units.filter((u) => u.active).map((u) => ({ x: u.x, z: u.z })),
  });
  hud.drawMinimap({ x: player.x, z: player.z, beacon: missions.current ? missions.current.target : null, trafficDots: [], policeDots: [] });
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

titleScreen.addEventListener('click', startGame);
canvas.addEventListener('click', () => { if (state.screen === 'title') startGame(); });

let last = performance.now();
let elapsed = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now; elapsed += dt;
  if (!shot) step(dt, elapsed);
  renderer.render(scene, camera);
}
if (shot) stageShot(shot);
else requestAnimationFrame(frame);
