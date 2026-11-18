// vehicles.js — cars in Veldora Bay: the player's ride, traffic, and police cruisers.
// A car is a box-built mesh (body, cabin, wheels, lights). Driving is arcade physics:
// throttle, brake/reverse, steering that scales with speed. Traffic follows waypoints
// along the street grid; the player steers with W/S and A/D.

import { resolveCircleAABB, clamp, angleDiff, angleLerp, pick, range } from './math3.js';

export const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe0b93c, 0x3aa655, 0xd8d8d8, 0x22262e, 0x7a4a9e, 0xe07b39];

export function buildCarMesh(THREE, color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f2f2 : color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0x777744 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    h.position.set(hx, 0.62, 2.21); g.add(h);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x550000 });
  for (const hx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), tailMat);
    t.position.set(hx, 0.62, -2.21); g.add(t);
  }
  if (isPolice) {
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x881111 }));
    barR.position.set(-0.4, 1.45, -0.2); g.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x111188 }));
    barB.position.set(0.4, 1.45, -0.2); g.add(barB);
    g.userData.lightBar = [barR, barB];
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x1a3a8a }));
    door.position.set(0, 0.55, 0.4); g.add(door);
  }
  return g;
}

export class Car {
  constructor(THREE, scene, x, z, heading, color, isPolice) {
    this.THREE = THREE;
    this.isPolice = !!isPolice;
    this.mesh = buildCarMesh(THREE, color, isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.maxSpeed = isPolice ? 30 : 27;
    this.driver = null; // Player or 'ai'
    this.aiTarget = null; // {x,z} waypoint for traffic / police
    this.health = 100;
    this.radius = 1.9;
    this.steerVis = 0;
  }

  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  // Player driving: input fwd/right axes, dt seconds.
  drivePlayer(dt, game) {
    // Staged screenshot scenes auto-drive (no keyboard in headless Chrome).
    const input = game.autoDrive ? { fwd: 1, right: 0 } : game.input.axis();
    const accel = 15, brake = 26, drag = 0.6;
    if (input.fwd > 0) this.speed += accel * dt;
    else if (input.fwd < 0) this.speed -= (this.speed > 0.5 ? brake : 9) * dt;
    else this.speed -= Math.sign(this.speed) * drag * 4 * dt;
    if (Math.abs(this.speed) < 0.15 && input.fwd === 0) this.speed = 0;
    this.speed = clamp(this.speed, -9, this.maxSpeed);
    // Steering: D (right=+1) turns the car toward its own right while moving forward,
    // i.e. heading increases; reversing flips the sense, as in a real car.
    const steer = input.right * clamp(Math.abs(this.speed) / 8, 0, 1) * 1.9;
    this.heading += steer * Math.sign(this.speed) * dt;
    this._integrate(dt, game);
  }

  // AI driving toward a waypoint (traffic / police chase).
  driveAI(dt, game, targetSpeed) {
    if (!this.aiTarget) return;
    const dx = this.aiTarget.x - this.x, dz = this.aiTarget.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) { this.speed *= 0.9; return; }
    const desired = Math.atan2(dx, dz);
    const diff = angleDiff(this.heading, desired);
    this.heading += clamp(diff, -1.8 * dt, 1.8 * dt);
    const want = Math.min(targetSpeed, dist * 0.5 + 4);
    this.speed += ((Math.abs(diff) > 0.6 ? want * 0.4 : want) - this.speed) * Math.min(1, dt * 1.5);
    this._integrate(dt, game);
  }

  _integrate(dt, game) {
    const f = this.forward;
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    for (const box of game.city.colliders) {
      const r = resolveCircleAABB(nx, nz, this.radius, box);
      if (r.hit) this.speed *= 0.4;
      nx = r.x; nz = r.z;
    }
    nx = clamp(nx, game.city.bounds.minX, game.city.bounds.maxX);
    nz = clamp(nz, game.city.bounds.minZ, game.city.bounds.maxZ);
    this.x = nx; this.z = nz;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // wheels spin
    const spin = this.speed * dt * 2;
    this.mesh.children.forEach((c) => { if (c.geometry && c.geometry.type === 'CylinderGeometry') c.rotation.x += spin; });
  }

  damage(amount, game) {
    this.health -= amount;
    if (this.health <= 0) game.effects.explode(this.x, this.z, game);
  }
  destroy(game) {
    game.effects.explode(this.x, this.z, game);
    this.health = 0;
  }
}

export class TrafficManager {
  constructor(THREE, scene, game, count) {
    this.game = game;
    this.cars = [];
    const rng = game.rng;
    for (let i = 0; i < count; i++) {
      const street = pick(rng, game.city.streets);
      const along = pick(rng, game.city.streets);
      const horizontal = rng() < 0.5;
      const x = horizontal ? along : street;
      const z = horizontal ? street : along;
      const heading = horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const car = new Car(THREE, scene, x, z, heading, pick(rng, CAR_COLORS), false);
      car.driver = 'ai';
      car.aiTarget = this._nextWaypoint(car, game);
      this.cars.push(car);
    }
  }

  _nextWaypoint(car, game) {
    const streets = game.city.streets;
    // pick a random nearby intersection to drive to
    const nx = pick(game.rng, streets), nz = pick(game.rng, streets);
    return { x: nx, z: nz };
  }

  update(dt, game) {
    for (const car of this.cars) {
      if (!car.aiTarget || Math.hypot(car.aiTarget.x - car.x, car.aiTarget.z - car.z) < 4) {
        car.aiTarget = this._nextWaypoint(car, game);
      }
      car.driveAI(dt, game, 10);
    }
    // keep traffic cars from piling onto the player car
    const pc = game.player.inCar;
    if (pc) {
      for (const car of this.cars) {
        const dx = car.x - pc.x, dz = car.z - pc.z;
        const d = Math.hypot(dx, dz);
        if (d < 4 && d > 0.01) {
          car.x += (dx / d) * (4 - d) * 0.5;
          car.z += (dz / d) * (4 - d) * 0.5;
          car.speed *= 0.9; pc.speed *= 0.85;
        }
      }
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const car of [...this.cars, ...this.game.police.cars]) {
      if (car.driver) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }
}
