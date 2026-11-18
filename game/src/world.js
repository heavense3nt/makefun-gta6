// world.js — assembles Solmar Bay: renderer, sky, streets, buildings, props,
// traffic, pedestrians, police, the player, combat and missions. One object
// owns the whole simulation so main.js only drives the loop and the menus.
import * as THREE from 'three';
import { CONFIG, CITY } from './config.js';
import { City } from './city.js';
import { Buildings } from './buildings.js';
import { Props } from './props.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { Driving } from './driving.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { Weather } from './weather.js';
import { Activities } from './activities.js';
import { Missions } from './missions.js';
import { AudioEngine } from './audio.js';
import { clamp } from './utils.js';

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
    this.audio = new AudioEngine();
    this.city = new City(this.scene);
    this.buildings = new Buildings(this.scene, this.city);
    this.props = new Props(this.scene, this.city);
    this.effects = new Effects(this.scene);
    this.traffic = new Traffic(this.scene, this.city, this.buildings);
    this.pedestrians = new Pedestrians(this.scene, this.city, this.buildings);
    this.police = new Police(this.scene, this.city, this.buildings, this.audio);
    this.player = new Player(this.scene, this.buildings);
    this.driving = new Driving(this.buildings, this.traffic, this.police, this.audio, this.effects);
    this.combat = new Combat(this.scene, this.audio, this.effects, this.police);
    this.weather = new Weather(this.scene);
    this.activities = new Activities(this.scene, this.city, this.effects);
    this.missions = new Missions(this.scene, this.audio, this.effects, this.combat, this.traffic, this.police);
    this.clockMinutes = 12 * 60 + 24;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  get px() { return this.player.inCar ? this.player.inCar.x : this.player.x; }
  get pz() { return this.player.inCar ? this.player.inCar.z : this.player.z; }
  get heading() { return this.player.inCar ? this.player.inCar.heading : this.player.heading; }
  get speedMph() {
    const s = this.player.inCar ? this.player.inCar.speed : this.player.speed;
    return Math.abs(s) * 2.237;
  }
  // One simulation step. Returns events main.js turns into HUD/toasts.
  update(dt, input, camRig) {
    const events = [];
    const player = this.player;
    // Enter / exit cars.
    if (input.pressed('KeyE')) {
      if (player.inCar) {
        const car = this.driving.detach();
        player.exitCar();
        this.traffic.addParked(car);
        this.audio.setEngine(0, false);
      } else {
        let car = this.traffic.nearestFreeCar(player.x, player.z, 5.5);
        let fromPolice = false;
        if (!car) {
          car = this.police.cars.find((c) => Math.hypot(c.x - player.x, c.z - player.z) < 5.5);
          fromPolice = !!car;
        }
        if (car) {
          if (car.isPolice) this.police.addHeat(0.5);
          else if (!car.stolen) this.police.addHeat(0.35);
          if (fromPolice) {
            const i = this.police.cars.indexOf(car);
            if (i >= 0) this.police.cars.splice(i, 1);
            this.police.group.remove(car.mesh);
          } else {
            this.traffic.removeCar(car);
          }
          // Keep the mesh in the scene: the player is driving it now.
          this.scene.add(car.mesh);
          player.enterCar(car);
          this.driving.attach(car);
          // THE CAMERA SNAP: one assignment, heading + PI, no easing.
          camRig.snapBehindCar(car);
          this.audio.click();
          this.pedestrians.scare(player.x, player.z, 8);
        }
      }
    }
    if (player.inCar) {
      const res = this.driving.update(dt, input);
      if (res.crashed) {
        camRig.addShake(0.5);
        this.police.addHeat(0.15);
      }
      if (input.pressed('KeyF')) this.audio.horn();
      if (player.inCar.health <= 0) {
        this.effects.explosion(player.inCar.x, 1, player.inCar.z);
        this.audio.explosion();
        camRig.addShake(1);
        const wreck = player.inCar;
        this.driving.detach();
        player.inCar = null;
        player.mesh.visible = true;
        player.x = wreck.x + 3; player.z = wreck.z + 3;
        player.damage(25);
        this.scene.remove(wreck.mesh);
        events.push({ type: 'carDestroyed' });
      }
      this.audio.setEngine(clamp(Math.abs(player.inCar.speed) / 46, 0, 1), true);
    } else {
      player.updateOnFoot(dt, input, camRig.camYaw);
      this.audio.setEngine(0, false);
    }
    // Shooting (on foot only).
    if (!player.inCar && input.pressed('MouseLeft')) {
      const hit = this.combat.shoot(this.camera, player, this.pedestrians);
      if (hit && hit.kind === 'enemy') camRig.addShake(0.15);
    }
    if (input.pressed('KeyR')) this.combat.reload();
    this.combat.update(dt, player);
    // World life.
    this.traffic.update(dt);
    this.pedestrians.update(dt, this.px, this.pz, player.inCar ? Math.abs(player.inCar.speed) : player.speed);
    const pol = this.police.update(dt, this.px, this.pz, !!player.inCar, player.inCar ? player.inCar.speed : player.speed);
    if (pol.busted) events.push({ type: 'busted' });
    // Cash on the street.
    const got = this.effects.collectCash(this.px, this.pz);
    if (got > 0) {
      player.cash += got;
      this.audio.cash();
      events.push({ type: 'cash', amount: got });
    }
    this.activities.update(dt, this.px, this.pz, player);
    this.effects.update(dt);
    // Missions.
    this.missions.update(dt, {
      px: this.px, pz: this.pz,
      inCar: !!player.inCar, car: player.inCar || null,
    });
    // Clock + sky.
    this.clockMinutes = (this.clockMinutes + dt * 0.9) % (24 * 60);
    this.weather.update(dt, this.clockMinutes, this.props);
    if (player.health <= 0) events.push({ type: 'died' });
    return events;
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
