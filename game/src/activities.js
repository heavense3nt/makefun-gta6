// activities.js — free-roam side money: spinning cash drops and first-aid
// kits scattered around Solmar Bay, respawning over time so there is always
// a reason to take one more street.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng } from './utils.js';

export class Activities {
  constructor(scene, city, effects) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.rng = makeRng(CONFIG.seed + 55);
    this.collected = 0;
    this.respawnTimer = 0;
    this.healthKits = [];
    this.spawnInitial();
  }
  spawnInitial() {
    for (let i = 0; i < 9; i++) {
      const p = this.city.randomRoadPoint(this.rng);
      this.effects.addCashPickup(p.x, p.z, 100 + Math.floor(this.rng() * 4) * 50);
    }
    for (let i = 0; i < 3; i++) this.spawnHealthKit();
  }
  spawnHealthKit() {
    const p = this.city.randomRoadPoint(this.rng);
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xd83232 }));
    crossH.position.z = 0.48;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xd83232 }));
    crossV.position.z = 0.48;
    box.position.y = 1;
    crossH.position.y = 1; crossV.position.y = 1;
    g.add(box, crossH, crossV);
    g.position.set(p.x, 0, p.z);
    this.scene.add(g);
    this.healthKits.push({ mesh: g, x: p.x, z: p.z, spin: 0 });
  }
  update(dt, px, pz, player) {
    // Cash pickups are collected by the Effects system; this just respawns.
    this.respawnTimer += dt;
    if (this.respawnTimer > 20) {
      this.respawnTimer = 0;
      if (this.effects.pickups.length < 9) {
        const p = this.city.randomRoadPoint(this.rng);
        this.effects.addCashPickup(p.x, p.z, 100 + Math.floor(this.rng() * 4) * 50);
      }
      if (this.healthKits.length < 3) this.spawnHealthKit();
    }
    for (let i = this.healthKits.length - 1; i >= 0; i--) {
      const k = this.healthKits[i];
      k.spin += dt * 2;
      k.mesh.rotation.y = k.spin;
      if (Math.hypot(k.x - px, k.z - pz) < 2.4) {
        player.heal(40);
        this.scene.remove(k.mesh);
        this.healthKits.splice(i, 1);
      }
    }
  }
}
