// VELDORA v6 — third-person orbit camera.
// CAR ENTRY SNAP (mandatory): on enterCar, camYaw = car.heading + PI in ONE assignment.
import * as THREE from 'three';
import { wrapAngle } from './utils.js';

export function createCamera() {
  return {
    camYaw: Math.PI,
    camPitch: 0.32,
    distance: 11,
    // Snap the camera behind the car the instant the player gets in — no easing.
    snapToCar(carHeading) { this.camYaw = carHeading + Math.PI; },
    update(dt, target, mouseDX, mouseDY, inCar) {
      this.camYaw = wrapAngle(this.camYaw - mouseDX * 0.004);
      this.camPitch = Math.max(0.08, Math.min(1.1, this.camPitch + mouseDY * 0.003));
      const dist = inCar ? 13 : 11;
      const cx = target.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
      const cy = target.y + 2 + Math.sin(this.camPitch) * dist;
      const cz = target.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
      return { x: cx, y: cy, z: cz };
    },
    apply(camera, pos, target) {
      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(target.x, target.y + 1.6, target.z);
    },
  };
}
