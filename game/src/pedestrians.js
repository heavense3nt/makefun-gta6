// pedestrians.js — people of Veldora Bay walking the sidewalks.
// They stroll between intersections, wait at corners, and run away from gunfire.
// Some are "rivals" for missions: they stand their ground and shoot back.

import { pick, range, clamp } from './math3.js';

const SHIRTS = [0xd95f43, 0x3f7d9e, 0xd9a441, 0x7a4a9e, 0x4a9e6a, 0xc9c9c9, 0x9e3f5f, 0x3f5f9e];

function buildPed(THREE, shirt, pants) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(Math.random, [0xd9a077, 0xc98a5a, 0x8a5a3a, 0xe8b98a]) });
  const shirtM = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsM = new THREE.MeshLambertMaterial({ color: pants });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.66, 0.32), shirtM);
  torso.position.y = 1.02; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
  head.position.y = 1.56; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.24), pantsM);
  legL.position.set(-0.16, 0.33, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), shirtM);
  armL.position.set(-0.38, 1.04, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.38; g.add(armR);
  g.userData.legs = [legL, legR];
  return g;
}

export class Pedestrian {
  constructor(THREE, scene, x, z, rival) {
    this.mesh = buildPed(THREE, pick(Math.random, SHIRTS), pick(Math.random, [0x22262e, 0x3a3f4a, 0x5a4a3a]));
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = range(Math.random, 0.8, 1.6);
    this.target = null;
    this.health = 100;
    this.rival = !!rival;
    this.fleeing = false;
    this.fleeTimer = 0;
    this.shootTimer = 0;
    this.walkPhase = Math.random() * 6;
    this.dead = false;
  }

  pickTarget(game) {
    const streets = game.city.streets;
    this.target = { x: pick(game.rng, streets) + 7, z: pick(game.rng, streets) + 7 };
  }

  update(dt, game) {
    if (this.dead) return;
    if (this.fleeing) {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) this.fleeing = false;
    }
    const p = game.player;
    const px = p.inCar ? p.inCar.x : p.x, pz = p.inCar ? p.inCar.z : p.z;
    const dp = Math.hypot(this.x - px, this.z - pz);
    if (this.rival) {
      // rivals stand and shoot when the player is near
      if (dp < 26) {
        this.heading = Math.atan2(px - this.x, pz - this.z);
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
          this.shootTimer = 1.4;
          game.combat.enemyShoot(this, game);
        }
      }
    } else if (this.fleeing || dp < 6) {
      // run away from the player
      this.heading = Math.atan2(this.x - px, this.z - pz);
      const sp = 3.4;
      this.x += Math.sin(this.heading) * sp * dt;
      this.z += Math.cos(this.heading) * sp * dt;
      this.walkPhase += dt * 9;
    } else {
      if (!this.target || Math.hypot(this.target.x - this.x, this.target.z - this.z) < 2) this.pickTarget(game);
      const desired = Math.atan2(this.target.x - this.x, this.target.z - this.z);
      let diff = desired - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += clamp(diff, -2 * dt, 2 * dt);
      this.x += Math.sin(this.heading) * this.speed * dt;
      this.z += Math.cos(this.heading) * this.speed * dt;
      this.walkPhase += dt * this.speed * 2.4;
    }
    this.x = clamp(this.x, -258, 258);
    this.z = clamp(this.z, -258, 296);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = Math.sin(this.walkPhase) * 0.45;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
  }

  scare() { this.fleeing = true; this.fleeTimer = 4; }
  die(game) {
    this.dead = true;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.3;
    game.effects.bloodPuff(this.x, this.z, game);
  }
}

export class PedestrianManager {
  constructor(THREE, scene, game, count) {
    this.game = game;
    this.scene = scene;
    this.THREE = THREE;
    this.peds = [];
    for (let i = 0; i < count; i++) {
      const streets = game.city.streets;
      const x = pick(game.rng, streets) + 7;
      const z = pick(game.rng, streets) + 7;
      const ped = new Pedestrian(THREE, scene, x, z, false);
      ped.pickTarget(game);
      this.peds.push(ped);
    }
  }

  spawnRivals(x, z, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const ped = new Pedestrian(this.THREE, this.scene, x + (i - count / 2) * 4, z + (i % 2) * 3, true);
      this.peds.push(ped);
      out.push(ped);
    }
    return out;
  }

  update(dt, game) {
    for (const ped of this.peds) ped.update(dt, game);
    // drop dead peds after a while (keep the array small)
    if (this.peds.length > 60) this.peds = this.peds.filter((p) => !p.dead || Math.random() < 0.5);
  }
}
