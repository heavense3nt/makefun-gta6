// VELDORA — pedestrians: city folk who stroll the sidewalks, cross at corners,
// and scatter when a gun goes off or a car comes at them too fast.

const PED_SHIRTS = [0xe86a6a, 0x6aa8e8, 0x7ac47a, 0xe8c96a, 0xb06ad8, 0x6ad8d0, 0xe8e8e8, 0x3a3f45];
const PED_SKINS = [0xf0c8a0, 0xc98d5f, 0x8a5a32, 0xf5d7b0, 0xa06a42];

/** One pedestrian: a simple figure with a swinging walk. */
function Pedestrian(scene, rng, x, z) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: V.pick(rng, PED_SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: V.pick(rng, PED_SKINS) });
  const pants = new THREE.MeshLambertMaterial({ color: V.pick(rng, [0x2a3a5a, 0x3a3a3a, 0x5a4a3a]) });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.85, 8), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
  head.position.y = 1.75;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), pants);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.65, 0.13), shirt);
  armL.position.set(-0.46, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.46;
  g.add(armR);
  g.position.set(x, 0, z);
  scene.add(g);
  this.group = g;
  this.legL = legL; this.legR = legR; this.armL = armL; this.armR = armR;
  this.pos = g.position;
  this.heading = rng() * Math.PI * 2;
  this.speed = V.range(rng, 1.2, 2.2);
  this.walkPhase = rng() * Math.PI * 2;
  this.target = null;
  this.fleeing = 0;
  this.rng = rng;
  this.pickTarget();
}
Pedestrian.prototype.pickTarget = function pickTarget() {
  // walk to a nearby sidewalk corner, then pick another
  const gx = Math.round(this.pos.x / 40) * 40 + V.pick(this.rng, [-20, 20]);
  const gz = Math.round(this.pos.z / 40) * 40 + V.pick(this.rng, [-20, 20]);
  this.target = { x: V.clamp(gx, -160, 160), z: V.clamp(gz, -160, 165) };
};
Pedestrian.prototype.scare = function scare(x, z) {
  this.fleeing = 3;
  const dx = this.pos.x - x, dz = this.pos.z - z;
  const d = Math.sqrt(dx * dx + dz * dz) || 1;
  this.target = { x: V.clamp(this.pos.x + (dx / d) * 40, -160, 160), z: V.clamp(this.pos.z + (dz / d) * 40, -160, 165) };
};
Pedestrian.prototype.update = function update(dt) {
  if (this.fallen) return;
  if (!this.target) this.pickTarget();
  const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1.5) { this.pickTarget(); return; }
  const want = Math.atan2(dx, dz);
  this.heading = V.angleToward(this.heading, want, dt * 4);
  const spd = this.fleeing > 0 ? this.speed * 2.6 : this.speed;
  this.fleeing = Math.max(0, this.fleeing - dt);
  this.pos.x += Math.sin(this.heading) * spd * dt;
  this.pos.z += Math.cos(this.heading) * spd * dt;
  this.group.rotation.y = this.heading;
  this.walkPhase += dt * spd * 4.5;
  const s = Math.sin(this.walkPhase) * 0.55;
  this.legL.rotation.x = s;
  this.legR.rotation.x = -s;
  this.armL.rotation.x = -s * 0.7;
  this.armR.rotation.x = s * 0.7;
};

/** The crowd manager. */
V.Crowd = function Crowd(scene, city, rng, count) {
  this.list = [];
  this.rng = rng;
  for (let i = 0; i < (count || 22); i++) {
    const bx = V.pick(rng, city.blockCenters) + V.range(rng, -16, 16);
    const bz = V.pick(rng, city.blockCenters) + V.range(rng, -16, 16);
    this.list.push(new Pedestrian(scene, rng, bx, bz));
  }
};
V.Crowd.prototype.update = function update(dt) {
  for (let i = 0; i < this.list.length; i++) this.list[i].update(dt);
};
/** Scare every pedestrian within `radius` of (x, z). */
V.Crowd.prototype.scareNear = function scareNear(x, z, radius) {
  for (let i = 0; i < this.list.length; i++) {
    const p = this.list[i];
    if (V.dist2d(p.pos.x, p.pos.z, x, z) < radius) p.scare(x, z);
  }
};
