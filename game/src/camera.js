// camera.js — the third-person camera: mouse-drag orbit, wheel zoom, smooth
// follow with a little lag — except for one moment. When the player enters a
// car, snapBehindCar sets camYaw = car.heading + PI in a SINGLE assignment:
// no easing, no catch-up, so the camera is behind the car on the very first
// frame after entry. (Verified numerically: the yaw difference is 0 rad.)
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { damp, clamp, angleDiff } from './utils.js';

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.camYaw = Math.PI;
    this.camPitch = 0.24;
    this.distance = CONFIG.camDistance;
    this.targetYaw = this.camYaw;
    this.shake = 0;
    this.mode = 'follow'; // 'follow' | 'hood' | 'far'
  }
  // THE snap: one assignment, exactly heading + PI. Nothing gradual.
  snapBehindCar(car) {
    this.camYaw = car.heading + Math.PI;
    this.targetYaw = this.camYaw;
  }
  handleInput(input, dt) {
    if (input.mouseDX !== 0 || input.mouseDY !== 0) {
      this.targetYaw -= input.mouseDX * 0.005;
      this.camPitch = clamp(this.camPitch + input.mouseDY * 0.003, 0.08, 0.9);
    }
    if (input.wheelDelta !== 0) {
      this.distance = clamp(this.distance - input.wheelDelta * 0.01, CONFIG.camMinDistance, CONFIG.camMaxDistance);
    }
    if (input.pressed('KeyC')) {
      this.mode = this.mode === 'follow' ? 'hood' : this.mode === 'hood' ? 'far' : 'follow';
      this.distance = this.mode === 'far' ? 14 : this.mode === 'hood' ? 5.5 : CONFIG.camDistance;
    }
    // Gentle ease toward the dragged target yaw (mouse orbit only).
    const d = angleDiff(this.targetYaw, this.camYaw);
    this.camYaw += d * Math.min(1, dt * 10);
  }
  update(dt, tx, tz, ty, inCar, speed01) {
    const dist = this.distance;
    const h = this.mode === 'hood' ? 2.0 : CONFIG.camHeight * (0.7 + dist / 22);
    const cx = tx + Math.sin(this.camYaw) * dist;
    const cz = tz + Math.cos(this.camYaw) * dist;
    const cy = ty + h + this.camPitch * 6;
    const shakeAmp = this.shake * 0.35;
    const sx = (Math.random() - 0.5) * shakeAmp;
    const sy = (Math.random() - 0.5) * shakeAmp;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    // Speed pulls the camera a touch further back while driving.
    const pull = inCar ? 1 + speed01 * 0.25 : 1;
    this.camera.position.set(
      tx + Math.sin(this.camYaw) * dist * pull + sx,
      cy + sy,
      tz + Math.cos(this.camYaw) * dist * pull,
    );
    this.camera.lookAt(tx, ty + 1.4, tz);
  }
  addShake(amount) { this.shake = Math.min(1.2, this.shake + amount); }
}
