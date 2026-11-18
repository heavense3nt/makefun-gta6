// main.js — VELDORA: the game itself. Boots the renderer, builds Veldora Bay,
// wires player / traffic / police / pedestrians / missions / combat / HUD together,
// runs the loop, and stages screenshot scenes from ?shot= (start, play, chase, mission).

import { mulberry32 } from './math3.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { TrafficManager, Car, CAR_COLORS } from './vehicles.js';
import { PoliceManager } from './police.js';
import { PedestrianManager } from './pedestrians.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { Effects } from './effects.js';
import { CameraRig } from './camera.js';
import { HUD } from './hud.js';
import { SaveGame } from './save.js';
import { pick } from './math3.js';

const THREE = window.THREE;

class Game {
  constructor() {
    this.THREE = THREE;
    const params = new URLSearchParams(location.search);
    this.seed = parseInt(params.get('seed') || '20261118', 10) || 1;
    this.shot = params.get('shot') || 'start';
    this.rng = mulberry32(this.seed + 7);
    this.money = 0;
    this.state = 'menu'; // menu | playing | paused | busted | complete
    this.krollCar = null;

    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.cameraRig = new CameraRig(THREE, this.camera);

    this.input = new Input(canvas);
    this.audio = new SoundFX();
    this.city = buildCity(THREE, this.scene, this.seed);
    this.effects = new Effects(THREE, this.scene);
    this.player = new Player(THREE, this.scene, { x: this.city.garagePos.x, z: this.city.garagePos.z + 6 });
    this.police = new PoliceManager(THREE, this.scene, this);
    this.traffic = new TrafficManager(THREE, this.scene, this, 10);
    this.peds = new PedestrianManager(THREE, this.scene, this, 22);
    this.combat = new Combat(this);
    this.missions = new MissionManager(this);
    this.hud = new HUD(this);
    this.save = new SaveGame(this);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this._wireMenu();
    this._stageShot();
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  _wireMenu() {
    const menu = document.getElementById('menu');
    const save = this.save.load();
    const contBtn = document.getElementById('btn-continue');
    if (save && save.missionIndex < 5) {
      contBtn.style.display = 'inline-block';
      contBtn.textContent = `Continue — Job ${save.missionIndex + 1} ($${save.money})`;
    }
    document.getElementById('btn-start').addEventListener('click', () => {
      this.audio.ensure(); this.audio.startMusic(); this.audio.click();
      this.save.clear();
      this.missions.index = 0; this.missions.completed = 0; this.money = 0;
      this.hud.setCash(0);
      this._beginPlay();
    });
    contBtn.addEventListener('click', () => {
      this.audio.ensure(); this.audio.startMusic(); this.audio.click();
      this.save.apply(this.save.load());
      this._beginPlay();
    });
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.state = 'playing';
      document.getElementById('paused').style.display = 'none';
    });
    document.getElementById('btn-restart').addEventListener('click', () => location.reload());
    document.getElementById('btn-again').addEventListener('click', () => location.reload());
  }

  _beginPlay() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('paused').style.display = 'none';
    document.getElementById('busted').style.display = 'none';
    document.getElementById('complete').style.display = 'none';
    this.state = 'playing';
    if (!this.missions.active && !this.missions.done) this.missions.start();
    this.hud.toast('Selamat datang di Veldora Bay. Mara menunggumu di garasi.');
  }

  // Stage a scene for a screenshot (?shot=play|chase|mission) or leave the menu.
  _stageShot() {
    if (this.shot === 'play') {
      // on foot on a busy street, facing down the road, camera behind
      this.player.x = 2; this.player.z = 78; this.player.heading = 0;
      this.player.mesh.position.set(2, 0, 78);
      this.cameraRig.yaw = Math.PI;
      this.cameraRig.targetDistance = 7;
      this._beginPlay();
    } else if (this.shot === 'chase') {
      // driving down the avenue at speed, police closing in — auto-drive so the
      // staged scene moves without keyboard input
      const car = new Car(THREE, this.scene, 0, 40, 0, pick(this.rng, CAR_COLORS), false);
      this.traffic.cars.push(car);
      this.player.enterCar(car, this);
      this.autoDrive = true;
      car.speed = 14;
      this.police.addWanted(3, 'staged chase');
      this._spawnChasePolice();
      this._beginPlay();
    } else if (this.shot === 'mission') {
      // on foot at the harbor, facing the rivals and the crates
      this.missions.index = 3;
      this.player.x = -70; this.player.z = 210; this.player.heading = Math.PI / 2;
      this.player.mesh.position.set(-70, 0, 210);
      this.cameraRig.yaw = this.player.heading + Math.PI;
      this.cameraRig.targetDistance = 8;
      this._beginPlay();
    }
  }

  _spawnChasePolice() {
    for (const [px, pz] of [[-9, 18], [10, 26], [0, 58]]) {
      const car = new Car(THREE, this.scene, px, pz, 0, 0xf2f2f2, true);
      car.driver = 'ai';
      car.speed = 16;
      this.police.cars.push(car);
    }
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'menu') this.cameraRig.update(dt, this);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  update(dt) {
    // pause
    if (this.input.takePressed('Escape')) {
      this.state = 'paused';
      document.getElementById('paused').style.display = 'flex';
      return;
    }
    // enter / exit car
    if (this.input.takePressed('KeyE')) {
      if (this.player.inCar) {
        this.player.exitCar(this);
        this.audio.click();
      } else {
        const car = this.traffic.nearestCar(this.player.x, this.player.z, 4.5);
        if (car) {
          const wasTraffic = car.driver === 'ai';
          this.player.enterCar(car, this);
          this.audio.click();
          if (wasTraffic) this.police.addWanted(car.isPolice ? 2 : 1, 'mencuri mobil');
        }
      }
    }
    // car smoke when badly damaged
    if (this.player.inCar && this.player.inCar.health < 40 && Math.random() < dt * 6) {
      this.effects.smoke(this.player.inCar.x, this.player.inCar.z, this);
    }
    this.player.update(dt, this);
    if (this.player.inCar) this.player.inCar.drivePlayer(dt, this);
    this.traffic.update(dt, this);
    this.police.update(dt, this);
    this.peds.update(dt, this);
    this.combat.update(dt, this);
    this.missions.update(dt, this);
    this.effects.update(dt);
    this.cameraRig.update(dt, this);
    // ramming Kroll's car damages it
    if (this.krollCar && this.player.inCar) {
      const d = Math.hypot(this.krollCar.x - this.player.inCar.x, this.krollCar.z - this.player.inCar.z);
      if (d < 4.5) {
        this.krollCar.damage(30 * dt, this);
        this.player.inCar.speed *= 0.92;
        this.cameraRig.addShake(0.25);
      }
    }
    // HUD
    this.hud.setHealth(this.player.health, this.player.maxHealth);
    this.hud.setSpeed(this.player.inCar ? Math.abs(this.player.inCar.speed) * 3.6 : 0);
    this.hud.drawMinimap(this);
    this.save.update(dt);
    // engine sound follows the driven car
    const driving = this.player.inCar;
    this.audio.setEngine(driving ? Math.abs(this.player.inCar.speed) / 28 : 0, !!driving);
  }

  onPlayerDown() {
    this.onBusted('Kai tumbang — polisi membawamu ke kantor.');
  }

  onBusted(msg) {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.audio.busted();
    this.audio.setEngine(0, false);
    const lost = Math.floor(this.money * 0.1);
    this.money -= lost;
    this.hud.setCash(this.money);
    document.getElementById('busted-msg').textContent = (msg || 'BUSTED!') + ` Kamu kehilangan $${lost}.`;
    document.getElementById('busted').style.display = 'flex';
    setTimeout(() => {
      // respawn at the garage, clean slate
      if (this.player.inCar) this.player.exitCar(this);
      this.player.x = this.city.garagePos.x; this.player.z = this.city.garagePos.z + 6;
      this.player.health = 100;
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.police.clearWanted();
      this.missions.marker && this.missions.start();
      document.getElementById('busted').style.display = 'none';
      this.state = 'playing';
      this.save.save();
    }, 2600);
  }

  onAllMissionsDone() {
    this.state = 'complete';
    this.audio.stopMusic();
    document.getElementById('complete-stats').textContent =
      `5 jobs selesai · $${this.money} di kantong · Veldora Bay milikmu sekarang.`;
    document.getElementById('complete').style.display = 'flex';
    this.save.save();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    new Game();
  } catch (err) {
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = 'Game failed to start: ' + err.message;
    console.error(err);
  }
});
