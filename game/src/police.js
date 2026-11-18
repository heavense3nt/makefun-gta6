// police.js — the Solmar Bay Police Department. The wanted level (0–5 stars)
// decides how many interceptors hunt the player; they chase, ram, and — when
// the player is slow and close on foot — make the bust. Heat cools off when
// the player stays out of sight.
import * as THREE from 'three';
import { CONFIG, CITY } from './config.js';
import { makeRng, clamp, randRange } from './utils.js';
import { buildCarMesh, Car } from './vehicles.js';

export class Police {
  constructor(scene, city, buildings, audio) {
    this.scene = scene;
    this.city = city;
    this.buildings = buildings;
    this.audio = audio;
    this.rng = makeRng(CONFIG.seed + 45);
    this.wanted = 0;
    this.cars = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.heat = 0;          // 0..1, builds while committing crimes
    this.coolTimer = 0;     // seconds since last crime
    this.bustTimer = 0;
    this.sirenOn = false;
  }
  addHeat(amount) {
    if (this.wanted >= CONFIG.maxWanted) return;
    this.heat += amount;
    this.coolTimer = 0;
    const next = Math.min(CONFIG.maxWanted, Math.floor(this.heat));
    if (next > this.wanted) this.setWanted(next);
  }
  setWanted(level) {
    this.wanted = level;
    this.heat = level;
    this.syncCars();
    this.audio.setSiren(level > 0);
  }
  clearWanted() {
    this.wanted = 0;
    this.heat = 0;
    this.syncCars();
    this.audio.setSiren(false);
  }
  syncCars() {
    const want = this.wanted * CONFIG.policeCarsPerStar;
    while (this.cars.length < want) this.spawnCar();
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.group.remove(c.mesh);
    }
  }
  spawnCar() {
    const rng = this.rng;
    const mesh = buildCarMesh('police', 0x14181f);
    this.group.add(mesh);
    // Spawn a block or two away from the player, on a road.
    const px = this.playerX ?? 0;
    const pz = this.playerZ ?? 0;
    const p = this.city.randomRoadPoint(rng);
    const car = new Car(mesh, 'police', p.x, p.z, rng() * Math.PI * 2);
    car.speed = 8;
    this.cars.push(car);
    return car;
  }
  // Police can see the player when close, or always at 3+ stars (citywide APB).
  canSee(px, pz) {
    if (this.wanted >= 3) return true;
    for (const c of this.cars) {
      if (Math.hypot(c.x - px, c.z - pz) < 55) return true;
    }
    return false;
  }
  update(dt, px, pz, playerInCar, playerSpeed) {
    this.playerX = px; this.playerZ = pz;
    // Heat cools when the player is unseen for a while.
    if (this.wanted > 0) {
      if (this.canSee(px, pz)) this.coolTimer = 0;
      else this.coolTimer += dt;
      if (this.coolTimer > CONFIG.wantedDecaySeconds) {
        this.setWanted(this.wanted - 1);
        this.coolTimer = 0;
      }
    }
    let busted = false;
    const t = performance.now() / 1000;
    for (const car of this.cars) {
      const dx = px - car.x;
      const dz = pz - car.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Predict the player's motion a little so the chase feels smart.
      const steer = clamp(diff * 1.8, -1, 1);
      car.heading += steer * 2.1 * dt * clamp(car.speed / 8, 0.4, 1);
      const targetSpeed = Math.min(CONFIG.policeTopSpeed, 18 + this.wanted * 4.5);
      car.speed += clamp(targetSpeed - car.speed, -20 * dt, 12 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = this.buildings.collide(car.x, car.z, 2.2);
      car.x = fixed.x; car.z = fixed.z;
      car.x = clamp(car.x, -CITY.half - 14, CITY.half + 14);
      car.z = clamp(car.z, -CITY.half - 14, CITY.half + 30);
      car.updateMesh();
      // Flash the light bar.
      const on = Math.sin(t * 9) > 0;
      if (car.mesh.userData.lightRed) {
        car.mesh.userData.lightRed.material.color.setHex(on ? 0xff2222 : 0x551111);
        car.mesh.userData.lightBlue.material.color.setHex(on ? 0x111155 : 0x2244ff);
      }
      // Ram: slow the player down hard on contact (handled by driving too).
      // Bust: on foot, slow, and a cruiser right on top of you.
      if (!playerInCar && dist < 3.4 && Math.abs(playerSpeed) < 2.5) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.6) busted = true;
      } else {
        this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
      }
    }
    return { busted };
  }
}
