// VELDORA — vehicles: car factory, traffic that drives the grid, parked cars to
// steal, and arcade driving physics with building and car collisions.

/** Resolve a ground circle against building AABBs: push it out, report a hit. */
V.resolveCircle = function resolveCircle(pos, radius, colliders) {
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const cx = V.clamp(pos.x, c.minX, c.maxX);
    const cz = V.clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = pos.x - c.minX, pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return hit;
};

const CAR_PAINTS = [0xc23b3b, 0x2e6fc2, 0xe8b93a, 0x3aa655, 0x8a5fc2, 0xd96a2e, 0xcccccc, 0x222831, 0xe8e8e8, 0x2fb3a6];
const CAR_NAMES = ['Veloce GT', 'Marlin Sedan', 'Cortez Coupe', 'Bantam Van', 'Solara', 'Comet S', 'Dune Buggy', 'Regal'];

/** Build one car mesh group. opts: {color, name, kind, police, taxi}. */
V.buildCar = function buildCar(scene, opts) {
  opts = opts || {};
  const color = opts.color !== undefined ? opts.color : V.pick(V._rng || Math.random, CAR_PAINTS);
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18222e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d20 });
  const low = opts.kind === 'sport';
  const bodyH = low ? 0.7 : 1.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, bodyH, 4.4), paint);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, low ? 2.0 : 2.3), glass);
  cabin.position.set(0, 1.35 - (low ? 0.15 : 0), low ? 0.1 : -0.15);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheels = [];
  [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(function (p) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(p[0], 0.38, p[1]);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  [-0.6, 0.6].forEach(function (x) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.1), headMat);
    h.position.set(x, 0.85, 2.22);
    group.add(h);
  });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  [-0.6, 0.6].forEach(function (x) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.1), tailMat);
    t.position.set(x, 0.85, -2.22);
    group.add(t);
  });
  let lightBar = null;
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.78, -0.1);
    group.add(bar);
    lightBar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    r.position.x = -0.38;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    b.position.x = 0.38;
    lightBar.add(r); lightBar.add(b);
    lightBar.position.set(0, 1.95, -0.1);
    lightBar.userData.red = r; lightBar.userData.blue = b;
    group.add(lightBar);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.82, -0.1);
    group.add(sign);
  }
  scene.add(group);
  return {
    group: group, wheels: wheels, lightBar: lightBar,
    color: color, name: opts.name || V.pick(V._rng || Math.random, CAR_NAMES),
    kind: opts.kind || 'sedan', police: !!opts.police,
    pos: group.position, heading: 0, speed: 0, steer: 0,
    topSpeed: opts.topSpeed || (low ? 46 : 34),
    accel: opts.accel || (low ? 22 : 15),
    occupied: false, isPlayer: false, radius: 2.4,
  };
};

/** One traffic car driving the road grid. */
function TrafficCar(scene, city, rng) {
  const road = V.pick(rng, city.roads);
  const car = V.buildCar(scene, { color: V.pick(rng, CAR_PAINTS) });
  car.occupied = true;
  const dir = rng() < 0.5 ? 1 : -1;
  const along = V.range(rng, -150, 150);
  const lane = dir * 2.6;
  this.car = car;
  this.road = road;
  this.dir = dir;
  this.along = along;
  this.lane = lane;
  this.speed = V.range(rng, 8, 13);
  this.cruise = this.speed;
  this.rng = rng;
  this.city = city;
  this.place();
}
TrafficCar.prototype.place = function place() {
  const c = this.car;
  if (this.road.axis === 'z') {
    c.pos.set(this.road.at + this.lane, 0, this.along);
    c.heading = this.dir > 0 ? 0 : Math.PI;
  } else {
    c.pos.set(this.along, 0, this.road.at + this.lane);
    c.heading = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  c.group.rotation.y = c.heading;
};
TrafficCar.prototype.update = function update(dt, others, playerCar) {
  const c = this.car;
  // slow down for a car ahead on the same road
  let target = this.cruise;
  const ahead = [];
  if (playerCar) ahead.push(playerCar);
  others.forEach(function (o) { if (o !== this) ahead.push(o.car); }, this);
  for (let i = 0; i < ahead.length; i++) {
    const o = ahead[i];
    if (!o) continue;
    const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 11) {
      const fx = this.road.axis === 'z' ? 0 : this.dir;
      const fz = this.road.axis === 'z' ? this.dir : 0;
      const dot = (dx * fx + dz * fz) / (dist || 1);
      if (dot > 0.6) { target = Math.min(target, 3); break; }
    }
  }
  c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
  this.along += c.speed * this.dir * dt;
  // turn at an intersection sometimes
  const nearCross = Math.abs(((this.along % 40) + 40) % 40) < 1.5;
  if (nearCross && this.rng() < dt * 0.25) {
    const cross = V.pick(this.rng, this.city.roads.filter(function (r) { return r.axis !== this.road.axis; }, this));
    this.road = cross;
    this.dir = this.rng() < 0.5 ? 1 : -1;
    this.lane = this.dir * 2.6;
    this.along = V.clamp(this.along, -160, 160);
  }
  if (this.along > 165 || this.along < -165) {
    this.along = this.along > 0 ? -165 : 165;
    this.road = V.pick(this.rng, this.city.roads);
  }
  this.place();
  c.wheels.forEach(function (w) { w.rotation.x += c.speed * dt * 2.4; });
};

/** Traffic manager: a dozen cars circulating the city. */
V.Traffic = function Traffic(scene, city, rng, count) {
  this.list = [];
  for (let i = 0; i < (count || 12); i++) this.list.push(new TrafficCar(scene, city, rng));
};
V.Traffic.prototype.update = function update(dt, playerCar) {
  for (let i = 0; i < this.list.length; i++) this.list[i].update(dt, this.list, playerCar);
};
V.Traffic.prototype.cars = function cars() {
  return this.list.map(function (t) { return t.car; });
};

/** Parked cars along road edges, waiting to be stolen. */
V.spawnParkedCars = function spawnParkedCars(scene, city, rng, count) {
  const parked = [];
  const spots = [
    { x: -35, z: 55 }, { x: 45, z: -35 }, { x: -75, z: -75 }, { x: 85, z: 85 },
    { x: -5, z: 125 }, { x: 125, z: -5 }, { x: -125, z: 15 }, { x: 15, z: -125 },
    { x: 65, z: 45 }, { x: -45, z: -105 }, { x: 105, z: -65 }, { x: -85, z: 105 },
  ];
  for (let i = 0; i < Math.min(count || 8, spots.length); i++) {
    const s = spots[i];
    const sport = i === 3;
    const car = V.buildCar(scene, {
      color: sport ? 0xc23b3b : V.pick(rng, CAR_PAINTS),
      kind: sport ? 'sport' : 'sedan',
      name: sport ? 'Comet S' : undefined,
    });
    car.pos.set(s.x, 0, s.z);
    car.heading = (i % 2 === 0) ? 0 : Math.PI / 2;
    car.group.rotation.y = car.heading;
    car.parkedSpot = { x: s.x, z: s.z };
    parked.push(car);
  }
  return parked;
};

/** Arcade driving for the player's car. Returns true on a hard crash. */
V.drivePlayerCar = function drivePlayerCar(car, input, dt, colliders, others) {
  const wasSpeed = car.speed;
  if (input.forward) car.speed += car.accel * dt;
  if (input.back) car.speed -= car.accel * 0.9 * dt;
  if (!input.forward && !input.back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
  if (input.handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
  }
  car.speed = V.clamp(car.speed, -14, car.topSpeed);
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerMax = 0.55 * (1 - Math.min(0.6, Math.abs(car.speed) / car.topSpeed));
  car.steer += (steerTarget * (input.handbrake ? steerMax * 1.5 : steerMax) - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * (car.speed / 8) * dt * (car.speed >= 0 ? 1 : -1);
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  car.group.rotation.y = car.heading;
  car.group.position.y = Math.sin(performance.now() * 0.02) * 0.01 * Math.abs(car.speed) / 20;
  car.wheels.forEach(function (w, i) {
    w.rotation.x += car.speed * dt * 2.4;
    if (i < 2) w.rotation.y = car.steer * 0.5;
  });
  // buildings
  const hitWall = V.resolveCircle(car.pos, car.radius, colliders);
  if (hitWall) {
    if (Math.abs(wasSpeed) > 12) { car.speed *= -0.25; return true; }
    car.speed *= 0.4;
  }
  // other cars: soft push-apart
  for (let i = 0; i < others.length; i++) {
    const o = others[i];
    if (o === car || !o.pos) continue;
    const d = V.dist2d(car.pos.x, car.pos.z, o.pos.x, o.pos.z);
    const min = car.radius + (o.radius || 2.4) - 0.4;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const nx = (car.pos.x - o.pos.x) / d, nz = (car.pos.z - o.pos.z) / d;
      car.pos.x += nx * push; car.pos.z += nz * push;
      if (o.speed !== undefined && !o.isPlayer) { o.pos.x -= nx * push; o.pos.z -= nz * push; }
      if (Math.abs(car.speed) > 14) { car.speed *= 0.6; return true; }
      car.speed *= 0.85;
    }
  }
  return false;
};
