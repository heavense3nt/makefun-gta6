// VELDORA v7 — cars: traffic that loops the blocks, and cars the player
// can steal. A car is a box body + cabin + wheels; traffic follows loops.
import * as THREE from 'three';
import { mulberry32, pick, range } from './random.js';
import { wrapAngle, dist2d } from './utils.js';

const CAR_COLORS = [0xc23b2e, 0x2e6ac2, 0xd8a83c, 0x3a3f46, 0x7a3ac2, 0x2e8a5a, 0xd8d8d8, 0x222222];
const CAR_KINDS = [
  { name: 'sedan', w: 1.9, l: 4.2, h: 0.75 },
  { name: 'taxi', w: 1.9, l: 4.2, h: 0.75 },
  { name: 'sports', w: 2.0, l: 4.4, h: 0.62 },
  { name: 'van', w: 2.1, l: 5.0, h: 1.1 },
];

export function buildCarMesh(kind, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(kind.w, kind.h, kind.l), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(kind.w * 0.85, 0.6, kind.l * 0.45), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
  }
  if (kind.name === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd94a }));
    sign.position.set(0, 1.55, -0.2);
    group.add(sign);
  }
  return group;
}

export function createTraffic(scene, city, count) {
  const rng = mulberry32(city.seed + 77);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const loop = city.loops[i % city.loops.length];
    const wp = Math.floor(rng() * loop.length);
    const kind = pick(rng, CAR_KINDS);
    const color = kind.name === 'taxi' ? 0xd8a83c : pick(rng, CAR_COLORS);
    const mesh = buildCarMesh(kind, color);
    scene.add(mesh);
    const p = loop[wp];
    cars.push({
      mesh, kind, color,
      x: p.x + range(rng, -2, 2), z: p.z + range(rng, -2, 2),
      heading: rng() * Math.PI * 2, speed: range(rng, 6, 10),
      loop, wp, stopped: false, isPlayer: false, isPolice: false,
    });
  }
  return cars;
}

export function createParkedCar(scene, x, z, heading, kindName, color) {
  const kind = CAR_KINDS.find((k) => k.name === kindName) || CAR_KINDS[0];
  const mesh = buildCarMesh(kind, color);
  scene.add(mesh);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return { mesh, kind, color, x, z, heading, speed: 0, isPlayer: false, isPolice: false, parked: true };
}

export function updateTraffic(cars, dt) {
  for (const car of cars) {
    if (car.isPlayer || car.parked) continue;
    const target = car.loop[(car.wp + 1) % car.loop.length];
    const dx = target.x - car.x; const dz = target.z - car.z;
    const want = Math.atan2(dx, dz);
    car.heading += wrapAngle(want - car.heading) * Math.min(1, 3.2 * dt);
    const d = dist2d(car.x, car.z, target.x, target.z);
    if (d < 3) car.wp = (car.wp + 1) % car.loop.length;
    car.speed = 8;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null; let bestD = maxDist;
  for (const car of cars) {
    const d = dist2d(x, z, car.x, car.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
