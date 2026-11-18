// camera.js — the third-person camera rig for VELDORA.
// Orbits the player on foot (drag to swing, wheel to zoom); while driving it chases
// the car from behind. Entering a car snaps the yaw behind it in one assignment
// (CONTROL FIX #2: snapCamYaw), never eased, so steering never feels reversed.

import { angleLerp, snapCamYaw, clamp } from './math3.js';

export class CameraRig {
  constructor(THREE, camera) {
    this.THREE = THREE;
    this.camera = camera;
    this.yaw = Math.PI; // behind the player at spawn (player faces +Z... see main)
    this.pitch = 0.32;
    this.distance = 9;
    this.targetDistance = 9;
    this.snapNext = false;
    this.shake = 0;
  }

  update(dt, game) {
    const input = game.input;
    const d = input.takeMouseDelta();
    this.yaw -= d.x * 0.005;
    this.pitch = clamp(this.pitch + d.y * 0.003, 0.05, 1.1);
    this.targetDistance = clamp(this.targetDistance + input.takeWheel() * 0.01, 5, 16);
    this.distance += (this.targetDistance - this.distance) * Math.min(1, dt * 8);

    const p = game.player;
    let tx, tz, ty;
    if (p.inCar) {
      const car = p.inCar;
      tx = car.x; tz = car.z; ty = 1.6;
      if (this.snapNext) {
        // CONTROL FIX #2 — snap in one assignment, no easing.
        this.yaw = snapCamYaw(car.heading);
        this.snapNext = false;
      } else {
        // chase: ease the yaw behind the car while driving
        const want = snapCamYaw(car.heading);
        this.yaw = angleLerp(this.yaw, want, dt * 2.2);
      }
      this.distance += (11 - this.distance) * Math.min(1, dt * 2);
    } else {
      tx = p.x; tz = p.z; ty = 1.7;
    }

    const cd = Math.cos(this.pitch), sd = Math.sin(this.pitch);
    const cx = tx + Math.sin(this.yaw) * cd * this.distance;
    const cz = tz + Math.cos(this.yaw) * cd * this.distance;
    const cy = ty + sd * this.distance;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      this.camera.position.set(
        cx + (Math.random() - 0.5) * this.shake,
        cy + (Math.random() - 0.5) * this.shake,
        cz + (Math.random() - 0.5) * this.shake);
    } else {
      this.camera.position.set(cx, cy, cz);
    }
    this.camera.lookAt(tx, ty, tz);
  }

  addShake(amount) { this.shake = Math.min(1, this.shake + amount); }
}
