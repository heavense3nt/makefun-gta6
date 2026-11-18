// player.js — Kai Reyes on foot: camera-relative movement (D always strafes
// to the camera's screen-right, at any yaw), sprinting, jumping, and stealing
// cars. Entering a car SNAPS the camera behind it in one assignment —
// camYaw = car.heading + PI — with no easing, so the view never swings wild.
import * as THREE from 'three';
import { CONFIG, CITY } from './config.js';
import { clamp, moveDirection, headingOf } from './utils.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8a1f2a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3242 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.85, 0.24), jeans);
  legL.position.set(-0.15, 0.42, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.75, 0.36), jacket);
  torso.position.y = 1.22;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skin);
  head.position.y = 1.85;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.48), hair);
  cap.position.y = 2.1;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.66, 0.17), jacket);
  armL.position.set(-0.42, 1.22, 0);
  const armR = armL.clone(); armR.position.x = 0.42;
  g.add(legL, legR, torso, head, cap, armL, armR);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.armL = armL; g.userData.armR = armR;
  return g;
}

export class Player {
  constructor(scene, buildings) {
    this.buildings = buildings;
    this.mesh = buildPlayerMesh();
    scene.add(this.mesh);
    this.x = 0; this.z = 8;
    this.heading = Math.PI; // facing north, down the beach road
    this.health = CONFIG.playerHealth;
    this.armor = 0;
    this.speed = 0;
    this.walkPhase = 0;
    this.inCar = null;
    this.onGround = true;
    this.vy = 0;
    this.cash = CONFIG.startCash;
    this.kills = 0;
    this.updateMesh();
  }
  updateMesh() {
    this.mesh.position.set(this.x, this.vy > 0 || !this.onGround ? this.jumpY || 0 : 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
  // On-foot step. camYaw is the camera azimuth; movement is relative to it.
  updateOnFoot(dt, input, camYaw) {
    const { ix, iz } = input.moveAxes();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const top = sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
    const dir = moveDirection(camYaw, ix, iz);
    const moving = dir.x !== 0 || dir.z !== 0;
    const targetSpeed = moving ? top : 0;
    this.speed += clamp(targetSpeed - this.speed, -30 * dt, 22 * dt);
    if (moving) {
      this.heading = headingOf(dir.x, dir.z);
      const nx = this.x + dir.x * this.speed * dt;
      const nz = this.z + dir.z * this.speed * dt;
      const fixed = this.buildings.collide(nx, nz, CONFIG.playerRadius);
      this.x = clamp(fixed.x, -CITY.half - 14, CITY.half + 44);
      this.z = clamp(fixed.z, -CITY.half - 14, CITY.half + 44);
    }
    // Jump.
    if (input.pressed('Space') && this.onGround) {
      this.vy = 6.2; this.onGround = false;
    }
    if (!this.onGround) {
      this.vy -= 18 * dt;
      this.jumpY = (this.jumpY || 0) + this.vy * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.onGround = true; this.vy = 0; }
    }
    this.walkPhase += dt * this.speed * 1.6;
    const swing = Math.sin(this.walkPhase) * (this.speed > 0.5 ? 0.6 : 0);
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.armL.rotation.x = -swing * 0.7;
    this.mesh.userData.armR.rotation.x = swing * 0.7;
    this.updateMesh();
  }
  // Steal the nearest car. Returns the car, or null. The camera snap lives
  // in camera.js's snapBehindCar, called by main with this exact assignment.
  enterCar(car) {
    if (!car) return null;
    this.inCar = car;
    car.stolen = true;
    this.mesh.visible = false;
    return car;
  }
  exitCar() {
    const car = this.inCar;
    if (!car) return null;
    this.inCar = null;
    // Step out on the driver's side.
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.x = car.x + side.x * 2.4;
    this.z = car.z + side.z * 2.4;
    const fixed = this.buildings.collide(this.x, this.z, CONFIG.playerRadius);
    this.x = fixed.x; this.z = fixed.z;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.updateMesh();
    return car;
  }
  damage(amount) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.6);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
}
