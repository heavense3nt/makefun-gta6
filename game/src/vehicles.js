// VELDORA v6 — cars: the player can steal any of them; traffic cars drive the avenues.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, wrapAngle } from './utils.js';

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c33a, 0x3a3a3a, 0x7a4a9c, 0xd8d8d8, 0x2a8a4a, 0x1d1d1d];
const CAR_NAMES = ['Comet GT', 'Sedan', 'Taxi', 'Van', 'Sports', 'Coupe', 'Pickup', 'Hatch'];

export function buildCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, kind === 'van' ? 3.2 : 2.2), glassMat);
  cabin.position.set(0, 1.2, kind === 'van' ? 0.2 : -0.2); g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    sign.position.set(0, 1.65, -0.2); g.add(sign);
  }
  return g;
}

export function createVehicles(scene, rng, colliders) {
  const cars = [];
  const kinds = ['sports', 'sedan', 'taxi', 'van', 'coupe', 'pickup'];
  for (let i = 0; i < 14; i++) {
    const kind = kinds[i % kinds.length];
    const color = kind === 'taxi' ? 0xe8c33a : CAR_COLORS[i % CAR_COLORS.length];
    const mesh = buildCarMesh(color, kind);
    // Park on a random avenue, or cruise it as traffic.
    const avenue = Math.floor(rng.range(-4, 5)) * (CONFIG.blockSize + CONFIG.roadWidth);
    const along = rng.range(-180, 180);
    const horizontal = rng.next() < 0.5;
    const x = horizontal ? along : avenue;
    const z = horizontal ? avenue : along;
    const heading = horizontal ? (rng.next() < 0.5 ? 0 : Math.PI) : (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    mesh.position.set(x, 0, z); mesh.rotation.y = heading;
    scene.add(mesh);
    cars.push({
      mesh, kind, color, x, z, heading,
      speed: 0, traffic: i >= 4, // first 4 are parked and stealable; the rest cruise
      name: kind === 'sports' && i === 0 ? 'Comet GT' : CAR_NAMES[i % CAR_NAMES.length],
      cruiseSpeed: rng.range(7, 12),
    });
  }
  // The red Comet GT target car for mission 3, parked by the marina.
  const comet = cars[0];
  comet.mesh.position.set(-150, 0, 60); comet.heading = Math.PI / 2; comet.mesh.rotation.y = comet.heading;
  comet.x = -150; comet.z = 60; comet.name = 'Comet GT'; comet.traffic = false;
  return {
    cars, comet,
    nearestStealable(x, z, maxDist) {
      let best = null; let bd = maxDist;
      for (const c of cars) {
        if (c.traffic) continue;
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
    update(dt, t) {
      for (const c of cars) {
        if (c.traffic) {
          c.speed = c.cruiseSpeed;
          c.x += Math.sin(c.heading) * c.speed * dt;
          c.z += Math.cos(c.heading) * c.speed * dt;
          if (c.x > 205) c.x = -205; if (c.x < -205) c.x = 205;
          if (c.z > 205) c.z = -205; if (c.z < -205) c.z = 205;
          c.mesh.position.set(c.x, 0, c.z);
        }
      }
    },
  };
}

// Drive a car: W/S accelerate/brake, A/D steer. Returns the new speed.
export function driveCar(car, dt, forwardInput, strafeInput) {
  car.speed = clamp(car.speed + forwardInput * CONFIG.carAccel * dt - (forwardInput === 0 ? Math.sign(car.speed) * 6 * dt : 0), -12, CONFIG.carMaxSpeed);
  if (forwardInput < 0) car.speed = clamp(car.speed - CONFIG.carBrake * dt * 0.4, -12, CONFIG.carMaxSpeed);
  if (Math.abs(car.speed) > 0.2) {
    car.heading += strafeInput * CONFIG.carTurn * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 10, 0.25, 1);
  }
  car.heading = wrapAngle(car.heading);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.x = clamp(car.x, -205, 205); car.z = clamp(car.z, -205, 205);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  return car.speed;
}
