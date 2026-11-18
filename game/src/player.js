// player.js — Kai Mercer on foot: a simple humanoid, camera-relative movement,
// sprint, jump-less street movement, health, and getting in and out of cars.
// Movement uses math3.moveVector, so D always strafes toward the camera's screen-right.

import { moveVector, headingFromMove, resolveCircleAABB, clamp } from './math3.js';

function buildHumanoid(THREE, shirtColor, pantsColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.08; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.34), skin);
  head.position.y = 1.66; g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.36), hair);
  hairM.position.y = 1.88; g.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.17, 0.36, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), shirt);
  armL.position.set(-0.42, 1.1, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  g.userData.legs = [legL, legR]; g.userData.arms = [armL, armR];
  return g;
}

export class Player {
  constructor(THREE, scene, spawn) {
    this.THREE = THREE;
    this.mesh = buildHumanoid(THREE, 0x2f6fb2, 0x22262e);
    this.mesh.position.set(spawn.x, 0, spawn.z);
    scene.add(this.mesh);
    this.x = spawn.x; this.z = spawn.z;
    this.heading = 0;
    this.speed = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.inCar = null; // Car instance when driving
    this.walkPhase = 0;
    this.punchCooldown = 0;
  }

  get pos() { return { x: this.x, z: this.z }; }

  update(dt, game) {
    if (this.inCar) return; // driving is handled by the car
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    const input = game.input.axis();
    const mv = moveVector(game.cameraRig.yaw, input.fwd, input.right);
    const moving = input.fwd !== 0 || input.right !== 0;
    const sprint = game.input.held('ShiftLeft') || game.input.held('ShiftRight');
    const targetSpeed = moving ? (sprint ? 8.5 : 4.6) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
    if (this.speed > 0.1) {
      this.heading = headingFromMove(mv.x, mv.z);
      let nx = this.x + mv.x * this.speed * dt;
      let nz = this.z + mv.z * this.speed * dt;
      for (const box of game.city.colliders) {
        const r = resolveCircleAABB(nx, nz, 0.5, box);
        nx = r.x; nz = r.z;
      }
      nx = clamp(nx, game.city.bounds.minX, game.city.bounds.maxX);
      nz = clamp(nz, game.city.bounds.minZ, game.city.bounds.maxZ);
      this.x = nx; this.z = nz;
      this.walkPhase += dt * this.speed * 1.6;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // walk swing
    const swing = moving ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.8;
    this.mesh.userData.arms[1].rotation.x = swing * 0.8;
  }

  damage(amount, game) {
    if (this.inCar) return;
    this.health = Math.max(0, this.health - amount);
    game.hud.flashDamage();
    if (this.health <= 0) game.onPlayerDown();
  }
  heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); }

  enterCar(car, game) {
    this.inCar = car;
    car.driver = this;
    this.mesh.visible = false;
    // CONTROL FIX #2: snap the camera behind the car in ONE assignment, no easing.
    game.cameraRig.yaw = car.heading + Math.PI;
    game.cameraRig.snapNext = true;
  }
  exitCar(game) {
    if (!this.inCar) return;
    const car = this.inCar;
    car.driver = null;
    this.inCar = null;
    // step out to the car's left side
    this.x = car.x - Math.cos(car.heading) * 2.2;
    this.z = car.z + Math.sin(car.heading) * 2.2;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    game.cameraRig.yaw = car.heading + Math.PI;
  }
}
