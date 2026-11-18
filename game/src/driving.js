// VELDORA v7 — driving the stolen car: arcade handling with a handbrake
// feel, skid marks left behind, and a horn.
import { CAR } from './config.js';
import { clamp, wrapAngle } from './utils.js';
import { resolveBuildings, clampToCity } from './world.js';

export function updateDriving(car, dt, input, city, onSkid) {
  const fwd = input.is('KeyW') || input.is('ArrowUp');
  const back = input.is('KeyS') || input.is('ArrowDown');
  const left = input.is('KeyA') || input.is('ArrowLeft');
  const right = input.is('KeyD') || input.is('ArrowRight');
  const handbrake = input.is('Space');
  if (fwd) car.speed += CAR.accel * dt;
  if (back) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 8 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 22 * dt;
  car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
  if (Math.abs(car.speed) < 0.05 && !fwd && !back) car.speed = 0;
  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  const steerAmount = steer * CAR.turnRate * (handbrake ? 1.5 : 1) * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.heading += steerAmount * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  resolveBuildings(city, car, 1.6);
  const clamped = clampToCity(car.x, car.z);
  if (clamped.x !== car.x || clamped.z !== car.z) car.speed *= 0.4;
  car.x = clamped.x; car.z = clamped.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Body lean into turns, and a skid when the handbrake is down at speed.
  car.mesh.rotation.z = -steer * 0.04 * clamp(Math.abs(car.speed) / 20, 0, 1);
  if (handbrake && Math.abs(car.speed) > 12 && onSkid) onSkid(car.x, car.z);
  return { speedKmh: Math.abs(car.speed) * 3.6 };
}
