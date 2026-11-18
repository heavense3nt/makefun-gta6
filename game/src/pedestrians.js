// pedestrians.js — the people of Solmar Bay: shoppers, joggers, beach
// walkers and tourists who stroll the sidewalks, scatter when a car barrels
// at them, and panic when gunfire starts.
import * as THREE from 'three';
import { CONFIG, CITY } from './config.js';
import { makeRng, pick, randRange, clamp } from './utils.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xd87a4a, 0xe8e8e8, 0x222226];
const PANTS = [0x2a3242, 0x4a3a2a, 0x3a4a5a, 0x5a5a5a, 0x7a2a3a];
const SKINS = [0xe8b88a, 0xc88a5a, 0x8a5a3a, 0xf0c8a0, 0x6a3a22];

function buildPedMesh(rng) {
  const g = new THREE.Group();
  const skin = pick(rng, SKINS);
  const shirt = pick(rng, SHIRTS);
  const pants = pick(rng, PANTS);
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pantsMat);
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone(); legR.position.x = 0.14;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirtMat);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.75;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), shirtMat);
  armL.position.set(-0.4, 1.15, 0);
  const armR = armL.clone(); armR.position.x = 0.4;
  g.add(legL, legR, torso, head, armL, armR);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

export class Pedestrians {
  constructor(scene, city, buildings) {
    this.scene = scene;
    this.city = city;
    this.buildings = buildings;
    this.rng = makeRng(CONFIG.seed + 33);
    this.peds = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    for (let i = 0; i < CONFIG.pedestrians; i++) this.spawn();
  }
  spawn() {
    const rng = this.rng;
    const p = this.city.randomRoadPoint(rng);
    const mesh = buildPedMesh(rng);
    const x = p.x + (rng() < 0.5 ? 8.5 : -8.5);
    const z = p.z + randRange(rng, -8, 8);
    mesh.position.set(x, 0, z);
    this.group.add(mesh);
    this.peds.push({
      mesh, x, z,
      heading: rng() * Math.PI * 2,
      speed: randRange(rng, 1.0, 2.0),
      walkPhase: rng() * 6,
      target: null,
      panic: 0,
    });
  }
  pickTarget(ped) {
    const p = this.city.randomRoadPoint(this.rng);
    ped.target = { x: p.x + 8.5, z: p.z };
  }
  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.panic = 3 + Math.random() * 2;
    }
  }
  update(dt, playerX, playerZ, playerSpeed) {
    for (const ped of this.peds) {
      if (!ped.target) this.pickTarget(ped);
      const dx = ped.target.x - ped.x;
      const dz = ped.target.z - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) { this.pickTarget(ped); continue; }
      const want = Math.atan2(dx, dz);
      let diff = want - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
      // Flee fast from a speeding player or a nearby car.
      let speed = ped.speed;
      if (ped.panic > 0) {
        ped.panic -= dt;
        speed = 5.2;
        const fx = ped.x - playerX, fz = ped.z - playerZ;
        const fl = Math.hypot(fx, fz) || 1;
        ped.heading = Math.atan2(fx / fl, fz / fl);
      }
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      const fixed = this.buildings.collide(ped.x, ped.z, 0.5);
      ped.x = clamp(fixed.x, -CITY.half - 10, CITY.half + 40);
      ped.z = clamp(fixed.z, -CITY.half - 10, CITY.half + 40);
      ped.walkPhase += dt * speed * 4;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.8;
      ped.mesh.userData.armR.rotation.x = swing * 0.8;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }
}
