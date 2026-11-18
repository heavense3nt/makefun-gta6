// vehicles.js — every car in Solmar Bay is built from boxes: body, cabin,
// wheels, lights. Sedans, taxis, sports cars, vans and police interceptors.
// Traffic cars cruise the road grid, stop for nothing, and honk when blocked.
import * as THREE from 'three';
import { CONFIG, CITY } from './config.js';
import { makeRng, pick, randRange, clamp } from './utils.js';

export const CAR_TYPES = {
  sedan:   { len: 4.4, wid: 1.9, accel: 22, top: 34, colors: [0x3a6fd8, 0xc8c8c8, 0x222226, 0x7a2a2a, 0x2a7a4a] },
  taxi:    { len: 4.4, wid: 1.9, accel: 22, top: 34, colors: [0xffc21c] },
  sports:  { len: 4.2, wid: 2.0, accel: 32, top: 48, colors: [0xd82020, 0xff7a1a, 0xffe14a, 0x1ad8d8] },
  van:     { len: 5.2, wid: 2.1, accel: 16, top: 27, colors: [0xe8e8e8, 0x4a6a8a, 0x8a4a2a] },
  police:  { len: 4.5, wid: 1.95, accel: 30, top: 42, colors: [0x14181f] },
};

export function buildCarMesh(type, colorHex) {
  const spec = CAR_TYPES[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242f });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.wid, 0.75, spec.len), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.wid - 0.3, 0.65, spec.len * 0.5), glassMat);
  cabin.position.set(0, 1.3, -spec.len * 0.06);
  cabin.castShadow = true;
  g.add(cabin);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx * (spec.wid / 1.9), 0.38, wz * (spec.len / 4.4));
    g.add(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.08), headMat);
    h.position.set(hx * (spec.wid / 1.9), 0.72, spec.len / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.08), tailMat);
    t.position.set(hx * (spec.wid / 1.9), 0.72, -spec.len / 2 - 0.02);
    g.add(t);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe14a }));
    sign.position.set(0, 1.78, -0.2);
    g.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    bar.position.set(0, 1.72, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.3, 1.86, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.3, 1.86, -0.2);
    g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
  }
  if (type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(spec.wid - 0.2, 0.1, 0.5), darkMat);
    spoiler.position.set(0, 1.15, -spec.len / 2 + 0.2);
    g.add(spoiler);
  }
  g.userData.spec = spec;
  return g;
}

export class Car {
  constructor(mesh, type, x, z, heading) {
    this.mesh = mesh;
    this.type = type;
    this.spec = CAR_TYPES[type];
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.isPolice = type === 'police';
    this.stolen = false;
    this.updateMesh();
  }
  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  updateMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
}

// Traffic: ordinary drivers looping the grid, obeying the road graph loosely.
export class Traffic {
  constructor(scene, city, buildings) {
    this.scene = scene;
    this.city = city;
    this.buildings = buildings;
    this.rng = makeRng(CONFIG.seed + 21);
    this.cars = [];
    this.parked = []; // cars the player stole and left standing (still stealable)
    this.group = new THREE.Group();
    scene.add(this.group);
    this.spawnAll();
  }
  spawnAll() {
    const rng = this.rng;
    for (let i = 0; i < CONFIG.trafficCars; i++) {
      const type = pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'sports']);
      const color = pick(rng, CAR_TYPES[type].colors);
      const p = this.city.randomRoadPoint(rng);
      const heading = rng() < 0.5 ? 0 : Math.PI / 2;
      const mesh = buildCarMesh(type, color);
      this.group.add(mesh);
      const car = new Car(mesh, type, p.x, p.z, heading);
      car.speed = randRange(rng, 6, 11);
      car.cruise = car.speed;
      car.target = this.nextTarget(car);
      this.cars.push(car);
    }
  }
  nextTarget(car) {
    const rng = this.rng;
    const p = this.city.randomRoadPoint(rng);
    return { x: p.x, z: p.z };
  }
  nearestFreeCar(x, z, maxDist) {
    let best = null; let bd = maxDist;
    for (const c of [...this.cars, ...this.parked]) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    const j = this.parked.indexOf(car);
    if (j >= 0) this.parked.splice(j, 1);
    this.group.remove(car.mesh);
  }
  addParked(car) {
    if (!this.parked.includes(car)) this.parked.push(car);
    this.group.add(car.mesh);
  }
  addCar(car) {
    this.cars.push(car);
    this.group.add(car.mesh);
  }
  respawn(dt) {
    // Keep the streets full: replace a stolen car after a while.
    if (this.cars.length < CONFIG.trafficCars && this.rng() < dt * 0.15) {
      const type = pick(this.rng, ['sedan', 'sedan', 'taxi', 'van']);
      const color = pick(this.rng, CAR_TYPES[type].colors);
      const p = this.city.randomRoadPoint(this.rng);
      const mesh = buildCarMesh(type, color);
      this.group.add(mesh);
      const car = new Car(mesh, type, p.x, p.z, this.rng() < 0.5 ? 0 : Math.PI / 2);
      car.speed = randRange(this.rng, 6, 11);
      car.cruise = car.speed;
      car.target = this.nextTarget(car);
      this.cars.push(car);
    }
  }
  update(dt) {
    for (const car of this.cars) {
      const dx = car.target.x - car.x;
      const dz = car.target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) { car.target = this.nextTarget(car); continue; }
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
      // Slow down for a car ahead on the same road.
      let slow = false;
      for (const o of this.cars) {
        if (o === car) continue;
        const ox = o.x - car.x, oz = o.z - car.z;
        const along = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (along > 0 && along < 9 && side < 2.4) { slow = true; break; }
      }
      const targetSpeed = slow ? 0 : car.cruise;
      car.speed += clamp(targetSpeed - car.speed, -14 * dt, 8 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = this.buildings.collide(car.x, car.z, 2.2);
      car.x = fixed.x; car.z = fixed.z;
      car.x = clamp(car.x, -CITY.half - 14, CITY.half + 14);
      car.z = clamp(car.z, -CITY.half - 14, CITY.half + 30);
      car.updateMesh();
    }
    this.respawn(dt);
  }
}
