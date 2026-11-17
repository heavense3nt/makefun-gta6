// Cars: build them, drive them, steal them. Parked cars sit at the city car
// spawns; traffic cars cruise the road grid; police cars are their own kind.
// Enter/exit with E. On entry the camera snaps behind the car (see camera.js).
//
// Car model convention: forward is +Z in local space, so mesh.rotation.y equals
// the heading and forward = (sin h, 0, cos h). That is what snapToCarHeading
// relies on: camYaw = heading + PI puts the camera behind the car.

import { CAR, PALETTE, makeRng, pick } from './config.js';
import { collideCircle } from './city.js';

const THREE = window.THREE;

const MODELS = [
  { name: 'Comet GT', color: 0xff7f2a, topSpeed: 54, accel: 30 },
  { name: 'Harbor Sedan', color: 0x2e6fd8, topSpeed: 44, accel: 24 },
  { name: 'Marina Coupe', color: 0xd8382e, topSpeed: 48, accel: 26 },
  { name: 'Dock Van', color: 0xe8e8e8, topSpeed: 38, accel: 20 },
  { name: 'Sunset Taxi', color: 0xf2c230, topSpeed: 44, accel: 24 },
];

function buildCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? PALETTE.policePaint : color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.2), paint);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.12, -0.2); g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
  for (const lx of [-0.65, 0.65]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), lightMat);
    light.position.set(lx, 0.62, 2.12); g.add(light);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    bar.position.set(0, 1.5, -0.2); g.add(bar);
    g.userData.lightBar = bar;
  }
  return g;
}

export function createVehicleSystem(scene, city) {
  const rng = makeRng(777);
  const cars = [];
  let idCounter = 0;

  function addCar(x, z, heading, model, opts = {}) {
    const mesh = buildCarMesh(model.color, !!opts.police);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      id: idCounter += 1,
      mesh, model, heading, speed: 0, steer: 0,
      police: !!opts.police, parked: !!opts.parked, traffic: !!opts.traffic,
      target: null, cruise: 10 + rng() * 6, name: opts.police ? 'VPD Interceptor' : model.name,
      wanted: false,
    };
    // tag the mesh so combat's raycast can tell a police car from a civilian one
    mesh.userData.targetRef = opts.police ? { kind: 'copCar', car } : { kind: 'car', car };
    mesh.userData.targetKind = opts.police ? 'copCar' : 'car';
    cars.push(car);
    return car;
  }

  // Parked cars from the city spawns (stealable).
  for (const spot of city.carSpawns.slice(0, 18)) {
    addCar(spot.x, spot.z, spot.heading, pick(rng, MODELS), { parked: true });
  }
  // The mission-2 Comet GT, parked on the avenue by the Spire, always sunset orange.
  const comet = addCar(3, -70, Math.PI, MODELS[0], { parked: true });

  // Traffic: a dozen cars cruising the grid.
  const pitch = 56;
  for (let i = 0; i < 12; i += 1) {
    const line = (Math.floor(rng() * 9) - 4) * pitch;
    const along = rng() < 0.5;
    const car = addCar(
      along ? line + 3 : (rng() * 2 - 1) * 200,
      along ? (rng() * 2 - 1) * 200 : line + 3,
      along ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      pick(rng, MODELS), { traffic: true },
    );
    car.target = pickRoadPoint(rng);
  }

  function pickRoadPoint(rng2) {
    const line = (Math.floor(rng2() * 9) - 4) * pitch;
    if (rng2() < 0.5) return { x: line + 3, z: (rng2() * 2 - 1) * 220 };
    return { x: (rng2() * 2 - 1) * 220, z: line + 3 };
  }

  function driveStep(car, dt, input, isPlayer) {
    if (isPlayer) {
      const throttle = input.throttle();
      const steerIn = input.strafe(); // A/D steer left/right, screen-correct behind the car
      const targetSteer = steerIn * 0.55;
      car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
      if (throttle > 0) car.speed += car.model.accel * dt;
      else if (throttle < 0) {
        if (car.speed > 0.5) car.speed -= CAR.brake * dt;
        else car.speed -= CAR.reverseAccel * dt;
      } else {
        car.speed -= Math.sign(car.speed) * CAR.drag * 6 * dt;
        if (Math.abs(car.speed) < 0.3) car.speed = 0;
      }
      car.speed = Math.max(-CAR.maxReverse, Math.min(car.model.topSpeed, car.speed));
      car.heading += car.steer * (car.speed / car.model.topSpeed) * CAR.steerRate * dt * (car.speed < 0 ? -1 : 1);
    } else if (car.traffic) {
      // Cruise toward the target road point; pick a new one on arrival.
      const dx = car.target.x - car.mesh.position.x;
      const dz = car.target.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6) car.target = pickRoadPoint(rng);
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.steer = Math.max(-0.5, Math.min(0.5, diff * 1.4));
      car.speed += (car.cruise - car.speed) * Math.min(1, dt * 0.8);
      car.heading += car.steer * (car.speed / 40) * 1.6 * dt;
    }
    // integrate
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    car.mesh.position.x += fx * car.speed * dt;
    car.mesh.position.z += fz * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    // building collision: stop dead on impact
    const push = collideCircle(city.colliders, car.mesh.position.x, car.mesh.position.z, 2.1);
    if (push) {
      car.mesh.position.x += push.x;
      car.mesh.position.z += push.z;
      if (Math.abs(car.speed) > 8) car.speed *= -0.25;
      else car.speed = 0;
      if (car.traffic) car.target = pickRoadPoint(rng);
    }
    // keep inside the world; traffic wraps to the far side
    if (car.traffic) {
      if (Math.abs(car.mesh.position.x) > 280 || Math.abs(car.mesh.position.z) > 280) {
        car.mesh.position.set((rng() * 2 - 1) * 200, 0, (rng() * 2 - 1) * 200);
        car.target = pickRoadPoint(rng);
      }
    } else {
      car.mesh.position.x = Math.max(-290, Math.min(300, car.mesh.position.x));
      car.mesh.position.z = Math.max(-290, Math.min(290, car.mesh.position.z));
    }
    return Math.abs(car.speed);
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.police) continue;
      const d = Math.hypot(car.mesh.position.x - pos.x, car.mesh.position.z - pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  return {
    cars,
    comet,
    driveStep,
    nearestCar,
    addCar,
    pickRoadPoint: (r) => pickRoadPoint(r),
    removeCar(car) {
      scene.remove(car.mesh);
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    },
  };
}
