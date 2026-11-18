// VELDORA v7 — third-person camera: mouse orbit, wheel zoom.
// CAR-ENTRY SNAP FIX: entering a car sets camYaw = car.heading + PI in ONE
// assignment — no easing, no catch-up — so steering never feels reversed.
import * as THREE from 'three';
import { clamp } from './utils.js';

export function createCamera() {
  return {
    yaw: Math.PI * 0.75,
    pitch: 0.42,
    distance: 9,
    target: new THREE.Vector3(0, 1.5, 0),
    pos: new THREE.Vector3(0, 6, 10),
  };
}

export function snapCameraToCar(camera, carHeading) {
  camera.yaw = carHeading + Math.PI;
}

export function updateCamera(camera, dt, mouse, focus, inCar) {
  camera.yaw -= mouse.dx * 0.0045;
  camera.pitch = clamp(camera.pitch + mouse.dy * 0.003, 0.12, 1.1);
  camera.distance = clamp(camera.distance + mouse.wheel * 0.01, 5, 20);
  camera.target.set(focus.x, focus.y + (inCar ? 1.6 : 1.4), focus.z);
  const d = camera.distance;
  const cx = focus.x + Math.sin(camera.yaw) * Math.cos(camera.pitch) * d;
  const cz = focus.z + Math.cos(camera.yaw) * Math.cos(camera.pitch) * d;
  const cy = focus.y + 1.4 + Math.sin(camera.pitch) * d;
  camera.pos.set(cx, Math.max(cy, 1.2), cz);
}

export function applyCamera(threeCamera, camera) {
  threeCamera.position.copy(camera.pos);
  threeCamera.lookAt(camera.target);
}
