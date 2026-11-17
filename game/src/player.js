// VELDORA — Rook Vane on foot: third-person movement, jumping, pistol combat,
// and stealing cars. The player also drives when inCar (physics live in vehicles.js).

/** Build Rook's figure: teal jacket, dark jeans, pistol in hand. */
function buildRookMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f7a6a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.42), jacket);
  body.position.y = 1.08;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), dark);
  hair.position.y = 1.98;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), jeans);
  legL.position.set(-0.17, 0.38, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), jacket);
  armL.position.set(-0.48, 1.1, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  g.add(armR);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.42), dark);
  gun.position.set(0.48, 0.72, 0.25);
  g.add(gun);
  return { group: g, legL: legL, legR: legR, armL: armL, armR: armR, gun: gun };
}

V.Player = function Player(scene, rng, start) {
  const m = buildRookMesh();
  this.mesh = m;
  this.group = m.group;
  this.pos = this.group.position;
  this.pos.set(start.x, 0, start.z);
  this.heading = Math.PI;
  this.speed = 0;
  this.vy = 0;
  this.onGround = true;
  this.health = 100;
  this.inCar = false;
  this.car = null;
  this.walkPhase = 0;
  this.fireCooldown = 0;
  this.hurtTimer = 0;
  this.regenTimer = 0;
  this.rng = rng;
  scene.add(this.group);
  // reusable tracer + muzzle light
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
  this.tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
  this.tracer.frustumCulled = false;
  scene.add(this.tracer);
  this.tracerLife = 0;
  this.flash = new THREE.PointLight(0xffc860, 0, 14);
  scene.add(this.flash);
  this.raycaster = new THREE.Raycaster();
};

V.Player.prototype.damage = function damage(n, source) {
  if (this.health <= 0) return;
  this.health -= n;
  this.hurtTimer = 0.4;
  this.regenTimer = 0;
  if (V.Game && V.Game.onHurt) V.Game.onHurt(this.health);
  if (this.health <= 0) {
    this.health = 0;
    if (V.Game && V.Game.onEvent) V.Game.onEvent('wasted', { source: source });
  }
};

V.Player.prototype.reset = function reset(pos, health) {
  this.pos.set(pos.x, 0, pos.z);
  this.heading = Math.PI;
  this.speed = 0;
  this.vy = 0;
  this.health = health === undefined ? 100 : health;
  this.group.rotation.set(0, this.heading, 0);
  this.group.visible = true;
  if (this.car) { this.car.isPlayer = false; this.car.occupied = false; this.car = null; }
  this.inCar = false;
};

/** Find the nearest car the player may enter (parked or mission car). */
V.Player.prototype.nearestEnterable = function nearestEnterable(ctx) {
  let best = null, bestD = 4.5;
  const cars = [];
  ctx.parked.forEach(function (c) { if (!c.isPlayer) cars.push(c); });
  if (ctx.missionTaxi) cars.push(ctx.missionTaxi);
  if (ctx.missionSteal) cars.push(ctx.missionSteal);
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const d = V.dist2d(this.pos.x, this.pos.z, c.pos.x, c.pos.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
};

V.Player.prototype.enterCar = function enterCar(car, ctx) {
  this.inCar = true;
  this.car = car;
  car.isPlayer = true;
  car.occupied = true;
  this.group.visible = false;
  car.speed = 0;
  if (ctx.police) {
    let seen = false;
    ctx.police.cars.forEach(function (p) {
      if (V.dist2d(p.car.pos.x, p.car.pos.z, car.pos.x, car.pos.z) < 45) seen = true;
    });
    ctx.police.cops.forEach(function (c) {
      if (V.dist2d(c.pos.x, c.pos.z, car.pos.x, car.pos.z) < 45) seen = true;
    });
    if (seen) ctx.police.addCrime(1);
  }
  ctx.audio.horn();
  if (ctx.toast) ctx.toast(car.name + ' — yours now. Go!', 2200);
};

V.Player.prototype.exitCar = function exitCar(ctx) {
  if (!this.car) return;
  const car = this.car;
  car.isPlayer = false;
  car.occupied = false;
  car.speed = 0;
  this.inCar = false;
  this.car = null;
  const sx = Math.cos(car.heading + Math.PI / 2), sz = -Math.sin(car.heading + Math.PI / 2);
  this.pos.set(car.pos.x + sx * 2.6, 0, car.pos.z + sz * 2.6);
  this.group.visible = true;
  this.group.rotation.y = this.heading;
};

V.Player.prototype._hittables = function _hittables(ctx) {
  const list = [];
  ctx.crowd.list.forEach(function (p) {
    if (!p.fallen) list.push({ mesh: p.group, kind: 'ped', ref: p });
  });
  ctx.police.cops.forEach(function (c) {
    list.push({ mesh: c.group, kind: 'cop', ref: c });
  });
  const allCars = ctx.traffic.cars().concat(ctx.police.allCars(), ctx.parked);
  allCars.forEach(function (c) {
    list.push({ mesh: c.group, kind: 'car', ref: c });
  });
  return list;
};

V.Player.prototype.shoot = function shoot(camera, ctx) {
  if (this.fireCooldown > 0 || this.inCar) return;
  this.fireCooldown = 0.24;
  ctx.audio.shot();
  this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  this.raycaster.far = 90;
  const targets = this._hittables(ctx);
  const meshes = targets.map(function (t) { return t.mesh; });
  const hits = this.raycaster.intersectObjects(meshes, true);
  const from = new THREE.Vector3();
  this.mesh.gun.getWorldPosition(from);
  let end = null;
  if (hits.length > 0) {
    const hit = hits[0];
    end = hit.point.clone();
    let owner = null;
    let node = hit.object;
    while (node && !owner) {
      for (let i = 0; i < targets.length; i++) {
        if (targets[i].mesh === node) { owner = targets[i]; break; }
      }
      node = node.parent;
    }
    if (owner) {
      if (owner.kind === 'ped') {
        owner.ref.fallen = true;
        owner.ref.group.rotation.x = -Math.PI / 2;
        owner.ref.group.position.y = 0.35;
        ctx.police.addCrime(1);
        ctx.crowd.scareNear(owner.ref.pos.x, owner.ref.pos.z, 25);
      } else if (owner.kind === 'cop') {
        owner.ref.fallen = true;
        owner.ref.group.rotation.x = -Math.PI / 2;
        owner.ref.group.position.y = 0.35;
        ctx.police.addCrime(2);
      } else if (owner.kind === 'car') {
        if (owner.ref.police) ctx.police.addCrime(1);
        owner.ref.speed = Math.max(0, (owner.ref.speed || 0) - 4);
      }
    }
  } else {
    end = new THREE.Vector3();
    this.raycaster.ray.at(90, end);
  }
  // tracer + flash
  const pos = this.tracer.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, end.x, end.y, end.z);
  pos.needsUpdate = true;
  this.tracer.material.opacity = 0.9;
  this.tracerLife = 0.09;
  this.flash.position.copy(from);
  this.flash.intensity = 6;
  ctx.crowd.scareNear(this.pos.x, this.pos.z, 18);
};

V.Player.prototype.update = function update(dt, input, camYaw, ctx) {
  this.fireCooldown = Math.max(0, this.fireCooldown - dt);
  this.hurtTimer = Math.max(0, this.hurtTimer - dt);
  if (this.tracerLife > 0) {
    this.tracerLife -= dt;
    if (this.tracerLife <= 0) this.tracer.material.opacity = 0;
  }
  this.flash.intensity = Math.max(0, this.flash.intensity - dt * 60);
  // slow health regen
  this.regenTimer += dt;
  if (this.regenTimer > 6 && this.health > 0 && this.health < 100) {
    this.health = Math.min(100, this.health + 4 * dt);
  }
  if (this.inCar) return; // driving is handled by vehicles.js via game.js
  // on-foot movement, relative to the camera
  let fx = 0, fz = 0;
  if (input.forward) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
  if (input.back) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
  if (input.left) { fx -= Math.cos(camYaw); fz += Math.sin(camYaw); }
  if (input.right) { fx += Math.cos(camYaw); fz -= Math.sin(camYaw); }
  const moving = fx !== 0 || fz !== 0;
  const top = input.sprint ? 9.5 : 5.2;
  if (moving) {
    const len = Math.sqrt(fx * fx + fz * fz);
    fx /= len; fz /= len;
    this.speed += (top - this.speed) * Math.min(1, dt * 8);
    const want = Math.atan2(fx, fz);
    this.heading = V.angleToward(this.heading, want, dt * 10);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
  } else {
    this.speed = Math.max(0, this.speed - 20 * dt);
  }
  // jump + gravity
  if (input.jump && this.onGround) { this.vy = 8; this.onGround = false; }
  if (!this.onGround) {
    this.vy -= 22 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.onGround = true; }
  }
  V.resolveCircle(this.pos, 0.6, ctx.colliders);
  this.pos.x = V.clamp(this.pos.x, -167, 167);
  this.pos.z = V.clamp(this.pos.z, -167, 185);
  // walk animation
  this.walkPhase += dt * this.speed * 1.6;
  const s = Math.sin(this.walkPhase) * (this.speed > 0.5 ? 0.6 : 0);
  this.mesh.legL.rotation.x = s;
  this.mesh.legR.rotation.x = -s;
  this.mesh.armL.rotation.x = -s * 0.7;
  this.mesh.armR.rotation.x = s * 0.7;
  this.group.rotation.y = this.heading;
  if (input.shoot) this.shoot(ctx.camera, ctx);
};
