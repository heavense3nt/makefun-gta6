// combat.js — the pistol: click to shoot from the camera's crosshair, a short
// ray through the world. Armed rivals in missions shoot back. Hits on cops
// and civilians raise the heat; hits on mission targets win the job.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, randRange } from './utils.js';

export class Combat {
  constructor(scene, audio, effects, police) {
    this.scene = scene;
    this.audio = audio;
    this.effects = effects;
    this.police = police;
    this.ammo = CONFIG.pistolAmmo;
    this.reserve = 60;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.enemies = [];
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = CONFIG.pistolRange;
  }
  spawnEnemy(x, z, health = 100) {
    const g = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc88a5a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.75, 0.36), dark);
    torso.position.y = 1.22;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
    head.position.y = 1.85;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), dark);
    legL.position.set(-0.15, 0.42, 0);
    const legR = legL.clone(); legR.position.x = 0.15;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.4, 1.3, 0.4);
    g.add(torso, head, legL, legR, gun);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = { mesh: g, x, z, health, shootTimer: randRange(makeRng((Math.random() * 1e9) | 0), 0.5, 1.5), dead: false };
    this.enemies.push(e);
    return e;
  }
  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }
  // Shoot from the camera through the screen centre. Returns what was hit.
  shoot(camera, player, pedestrians) {
    if (this.cooldown > 0 || this.reloadTimer > 0 || this.ammo <= 0) return null;
    this.cooldown = 0.28;
    this.ammo--;
    this.audio.gunshot();
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const origin = this.raycaster.ray.origin;
    const dir = this.raycaster.ray.direction;
    const muzzle = origin.clone().addScaledVector(dir, 1.2);
    this.effects.muzzle(muzzle.x, muzzle.y, muzzle.z);
    // Test enemies first (they are the fair fight).
    for (const e of this.enemies) {
      if (e.dead) continue;
      const hit = this.rayHits(e.x, 1.3, e.z, 0.9, origin, dir);
      if (hit) {
        e.health -= CONFIG.pistolDamage;
        this.effects.blood(e.x, 1.3, e.z);
        if (e.health <= 0) {
          e.dead = true;
          this.scene.remove(e.mesh);
          player.kills++;
          this.effects.addCashPickup(e.x, e.z, 120);
          return { kind: 'enemy', target: e };
        }
        return { kind: 'enemy', target: e };
      }
    }
    // Police cruisers can be shot too — but the city answers.
    for (const car of this.police.cars) {
      const hit = this.rayHits(car.x, 1.0, car.z, 2.2, origin, dir);
      if (hit) {
        this.police.addHeat(0.5);
        this.effects.sparks(car.x, 1, car.z);
        return { kind: 'police', target: car };
      }
    }
    // Civilians: hitting one is a crime, and the street panics.
    for (const ped of pedestrians.peds) {
      const hit = this.rayHits(ped.x, 1.3, ped.z, 0.7, origin, dir);
      if (hit) {
        pedestrians.scare(ped.x, ped.z, 14);
        this.police.addHeat(0.6);
        this.effects.blood(ped.x, 1.3, ped.z);
        return { kind: 'ped', target: ped };
      }
    }
    return { kind: 'miss' };
  }
  rayHits(cx, cy, cz, radius, origin, dir) {
    // Ray vs sphere: quick closed-form test.
    const ox = cx - origin.x, oy = cy - origin.y, oz = cz - origin.z;
    const t = ox * dir.x + oy * dir.y + oz * dir.z;
    if (t < 0 || t > CONFIG.pistolRange) return false;
    const px = origin.x + dir.x * t - cx;
    const py = origin.y + dir.y * t - cy;
    const pz = origin.z + dir.z * t - cz;
    return px * px + py * py + pz * pz < radius * radius;
  }
  reload() {
    if (this.reloadTimer > 0 || this.ammo >= CONFIG.pistolAmmo || this.reserve <= 0) return;
    this.reloadTimer = 1.1;
    this.audio.blip(300, 0.08, 'square', 0.12);
  }
  update(dt, player) {
    this.cooldown -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = CONFIG.pistolAmmo - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.audio.blip(520, 0.08, 'square', 0.12);
      }
    }
    // Enemies advance on the player and fire back.
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = player.x - e.x, dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2.2) {
        const sp = 3.4;
        e.x += (dx / dist) * sp * dt;
        e.z += (dz / dist) * sp * dt;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 34) {
        e.shootTimer = 1.1 + Math.random() * 0.9;
        this.audio.gunshot();
        const hit = Math.random() < 0.32;
        if (hit) {
          const dead = player.damage(9 + Math.random() * 7);
          this.effects.blood(player.x, 1.3, player.z);
          if (dead) this.onPlayerDown?.();
        }
      }
    }
  }
}
