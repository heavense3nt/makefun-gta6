// driving.js — the player car: arcade handling with real feel. Accelerate,
// brake, reverse, steer (grip falls off at speed so fast turns slide), and
// collisions with traffic, buildings and police that cost speed and health.
import { CONFIG, CITY } from './config.js';
import { clamp } from './utils.js';

export class Driving {
  constructor(buildings, traffic, police, audio, effects) {
    this.buildings = buildings;
    this.traffic = traffic;
    this.police = police;
    this.audio = audio;
    this.effects = effects;
    this.car = null;
    this.crashCooldown = 0;
  }
  attach(car) { this.car = car; }
  detach() { const c = this.car; this.car = null; return c; }
  get active() { return this.car !== null; }
  update(dt, input) {
    const car = this.car;
    if (!car) return { crashed: false };
    this.crashCooldown -= dt;
    const fwd = input.axis('KeyS', 'KeyW');
    const steerIn = input.axis('KeyD', 'KeyA'); // A (left) = +1, D (right) = -1
    const braking = input.down('Space');
    const spec = car.spec;
    // Throttle / brake / reverse.
    if (fwd > 0) car.speed += spec.accel * dt * (1 - car.speed / spec.top * 0.55);
    else if (fwd < 0) {
      if (car.speed > 0.5) car.speed -= CONFIG.carBrake * dt;
      else car.speed -= spec.accel * 0.55 * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    }
    if (braking) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CONFIG.carBrake * dt);
    car.speed = clamp(car.speed, -CONFIG.carReverseMax, spec.top);
    // Steering: full lock at low speed, less at high speed; only turns while moving.
    const speedFactor = clamp(Math.abs(car.speed) / 14, 0, 1);
    const steerAmount = steerIn * CONFIG.carTurnRate * (1.15 - 0.75 * speedFactor);
    car.heading += steerAmount * dt * Math.sign(car.speed || 1) * clamp(Math.abs(car.speed) / 6, 0, 1);
    car.steer = steerIn;
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // Building collision: slide along the wall, lose speed, spark + thud.
    const fixed = this.buildings.collide(nx, nz, 2.1);
    let crashed = false;
    if (Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01) {
      if (Math.abs(car.speed) > 8 && this.crashCooldown <= 0) {
        crashed = true;
        this.crashCooldown = 0.6;
        this.audio.crash();
        this.effects.sparks(fixed.x, 1, fixed.z);
        car.health -= Math.abs(car.speed) * 0.4;
      }
      car.speed *= 0.55;
    }
    car.x = clamp(fixed.x, -CITY.half - 14, CITY.half + 30);
    car.z = clamp(fixed.z, -CITY.half - 14, CITY.half + 30);
    // Bump traffic cars and police cruisers.
    for (const other of [...this.traffic.cars, ...this.police.cars]) {
      if (other === car) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) * 0.5;
        other.x += (dx / d) * push;
        other.z += (dz / d) * push;
        car.speed *= 0.82;
        if (Math.abs(car.speed) > 10 && this.crashCooldown <= 0) {
          crashed = true;
          this.crashCooldown = 0.6;
          this.audio.crash();
          this.effects.sparks(car.x, 1, car.z);
          if (other.isPolice) this.police.addHeat(0.4);
        }
      }
    }
    // Skid smoke on hard turns at speed.
    if (Math.abs(steerIn) > 0.5 && Math.abs(car.speed) > 18 && Math.random() < dt * 20) {
      this.effects.smoke(car.x - Math.sin(car.heading) * 1.6, 0.4, car.z - Math.cos(car.heading) * 1.6);
    }
    car.updateMesh();
    return { crashed };
  }
}
