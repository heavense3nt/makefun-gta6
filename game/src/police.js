// VELDORA — the law: wanted stars that rise with crimes, police cars and foot
// cops that chase, ram and arrest, and the cool-down that lets you slip away.

/** One police car in pursuit. */
function PoliceCar(scene, city, rng, x, z) {
  this.car = V.buildCar(scene, { color: 0x1a1d20, kind: 'sedan', police: true, topSpeed: 44, accel: 24, name: 'Interceptor' });
  this.car.pos.set(x, 0, z);
  this.car.occupied = true;
  this.car.police = true;
  this.city = city;
  this.rng = rng;
  this.flash = 0;
}
PoliceCar.prototype.update = function update(dt, target, colliders, others) {
  const c = this.car;
  const dx = target.x - c.pos.x, dz = target.z - c.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const want = Math.atan2(dx, dz);
  c.heading = V.angleToward(c.heading, want, dt * 2.6);
  const speedTarget = d > 6 ? c.topSpeed : c.topSpeed * 0.6;
  c.speed += (speedTarget - c.speed) * Math.min(1, dt * 1.2);
  c.pos.x += Math.sin(c.heading) * c.speed * dt;
  c.pos.z += Math.cos(c.heading) * c.speed * dt;
  c.group.rotation.y = c.heading;
  c.wheels.forEach(function (w) { w.rotation.x += c.speed * dt * 2.4; });
  V.resolveCircle(c.pos, c.radius, colliders);
  for (let i = 0; i < others.length; i++) {
    const o = others[i];
    if (o === c || !o.pos) continue;
    const dd = V.dist2d(c.pos.x, c.pos.z, o.pos.x, o.pos.z);
    const min = c.radius + (o.radius || 2.4) - 0.4;
    if (dd < min && dd > 0.01) {
      const push = (min - dd) / 2;
      const nx = (c.pos.x - o.pos.x) / dd, nz = (c.pos.z - o.pos.z) / dd;
      c.pos.x += nx * push; c.pos.z += nz * push;
      if (!o.isPlayer && o.speed !== undefined) { o.pos.x -= nx * push; o.pos.z -= nz * push; }
    }
  }
  // flashing light bar
  this.flash += dt;
  if (c.lightBar) {
    const on = Math.floor(this.flash * 4) % 2 === 0;
    c.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x441111);
    c.lightBar.userData.blue.material.color.setHex(on ? 0x111144 : 0x2244ff);
  }
  return d;
};

/** One foot cop chasing the player on foot. */
function FootCop(scene, rng, x, z) {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d2f55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.9, 8), navy);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.78;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), navy);
  cap.position.y = 1.98;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), navy);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  g.position.set(x, 0, z);
  scene.add(g);
  this.group = g;
  this.legL = legL; this.legR = legR;
  this.pos = g.position;
  this.heading = 0;
  this.phase = rng() * 6;
  this.arrestTimer = 0;
  this.rng = rng;
}
FootCop.prototype.update = function update(dt, target) {
  if (this.fallen) return 999;
  const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const want = Math.atan2(dx, dz);
  this.heading = V.angleToward(this.heading, want, dt * 5);
  const spd = d > 3 ? 5.2 : 2.0;
  this.pos.x += Math.sin(this.heading) * spd * dt;
  this.pos.z += Math.cos(this.heading) * spd * dt;
  this.group.rotation.y = this.heading;
  this.phase += dt * spd * 2.4;
  const s = Math.sin(this.phase) * 0.6;
  this.legL.rotation.x = s;
  this.legR.rotation.x = -s;
  if (d < 2.2) this.arrestTimer += dt; else this.arrestTimer = 0;
  return d;
};
FootCop.prototype.remove = function remove(scene) { scene.remove(this.group); };

/** The wanted system: stars, spawns, pursuit, cool-down, busted. */
V.Police = function Police(scene, city, rng) {
  this.scene = scene;
  this.city = city;
  this.rng = rng;
  this.stars = 0;
  this.cars = [];
  this.cops = [];
  this.coolTimer = 0;
  this.crimeTimer = 0;
  this.spawnTimer = 0;
};
V.Police.prototype.wanted = function wanted() { return Math.round(this.stars); };
V.Police.prototype.addCrime = function addCrime(level, x, z) {
  this.stars = V.clamp(this.stars + level, 0, 5);
  this.crimeTimer = 0;
  this.coolTimer = 0;
  if (V.Game) V.Game.onCrime && V.Game.onCrime(this.stars);
};
V.Police.prototype.clear = function clear() {
  const scene = this.scene;
  this.cars.forEach(function (p) { scene.remove(p.car.group); });
  this.cops.forEach(function (c) { c.remove(scene); });
  this.cars = [];
  this.cops = [];
  this.stars = 0;
  this.coolTimer = 0;
};
V.Police.prototype.spawnForStars = function spawnForStars(playerPos) {
  const want = this.wanted();
  const wantCars = want >= 1 ? Math.min(1 + Math.floor(want / 2), 3) : 0;
  const wantCops = want >= 2 ? Math.min(want - 1, 3) : 0;
  while (this.cars.length < wantCars) {
    const a = this.rng() * Math.PI * 2;
    const x = V.clamp(playerPos.x + Math.cos(a) * 70, -160, 160);
    const z = V.clamp(playerPos.z + Math.sin(a) * 70, -160, 160);
    this.cars.push(new PoliceCar(this.scene, this.city, this.rng, x, z));
  }
  while (this.cops.length < wantCops) {
    const a = this.rng() * Math.PI * 2;
    const x = V.clamp(playerPos.x + Math.cos(a) * 30, -160, 160);
    const z = V.clamp(playerPos.z + Math.sin(a) * 30, -160, 160);
    this.cops.push(new FootCop(this.scene, this.rng, x, z));
  }
};
V.Police.prototype.update = function update(dt, player, colliders, others) {
  this.crimeTimer += dt;
  const want = this.wanted();
  if (want === 0) {
    if (this.cars.length || this.cops.length) this.clear();
    return { busted: false, rammed: false };
  }
  this.spawnForStars(player.pos);
  this.spawnTimer += dt;
  // cool down: no crime for 25s and no cop close -> lose a star
  let nearest = 999;
  for (let i = 0; i < this.cars.length; i++) {
    const d = this.cars[i].update(dt, player.pos, colliders, others);
    if (d < nearest) nearest = d;
  }
  for (let i = 0; i < this.cops.length; i++) {
    const d = this.cops[i].update(dt, player.pos);
    if (d < nearest) nearest = d;
  }
  if (this.crimeTimer > 25 && nearest > 55) {
    this.coolTimer += dt;
    if (this.coolTimer > 6) {
      this.stars = Math.max(0, this.stars - 1);
      this.coolTimer = 0;
      if (this.stars === 0) this.clear();
    }
  } else {
    this.coolTimer = 0;
  }
  // trim extras if stars dropped
  const wantCars = Math.min(1 + Math.floor(want / 2), 3);
  while (this.cars.length > wantCars) { const p = this.cars.pop(); this.scene.remove(p.car.group); }
  const wantCops = want >= 2 ? Math.min(want - 1, 3) : 0;
  while (this.cops.length > wantCops) { const c = this.cops.pop(); c.remove(this.scene); }
  // busted: a cop stands next to the player on foot
  let busted = false;
  if (!player.inCar) {
    for (let i = 0; i < this.cops.length; i++) {
      if (this.cops[i].arrestTimer > 2) { busted = true; break; }
    }
  }
  // rammed: a police car hit the player's car hard
  let rammed = false;
  if (player.inCar) {
    for (let i = 0; i < this.cars.length; i++) {
      const pc = this.cars[i].car;
      const d = V.dist2d(pc.pos.x, pc.pos.z, player.pos.x, player.pos.z);
      if (d < pc.radius + 2.2 && Math.abs(pc.speed) > 10) { rammed = true; break; }
    }
  }
  return { busted: busted, rammed: rammed };
};
V.Police.prototype.allCars = function allCars() {
  return this.cars.map(function (p) { return p.car; });
};
