// effects.js — particles and beacons for VELDORA: muzzle flashes, explosions,
// smoke, blood puffs, and the glowing mission marker column.

export class Effects {
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.particles = []; // {mesh, vel, life, maxLife, grav}
    this.beacon = null;
  }

  _spawn(pos, color, size, vel, life, grav) {
    const m = new this.THREE.Mesh(
      new this.THREE.BoxGeometry(size, size, size),
      new this.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    m.position.copy(pos);
    this.scene.add(m);
    this.particles.push({ mesh: m, vel, life, maxLife: life, grav: grav || 0 });
  }

  muzzle(pos, dir, game) {
    for (let i = 0; i < 6; i++) {
      const v = dir.clone().multiplyScalar(14 + Math.random() * 10);
      v.x += (Math.random() - 0.5) * 4; v.y += (Math.random() - 0.5) * 4; v.z += (Math.random() - 0.5) * 4;
      this._spawn(pos, 0xffd23f, 0.12, v, 0.12, 0);
    }
  }

  bloodPuff(x, z, game) {
    for (let i = 0; i < 10; i++) {
      const v = new this.THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
      this._spawn(new this.THREE.Vector3(x, 1.2, z), 0x8a1515, 0.14, v, 0.5, -9);
    }
  }

  explode(x, z, game) {
    game.audio._noise(0.5, 0.6, 600);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 10;
      const v = new this.THREE.Vector3(Math.cos(a) * sp, Math.random() * 8 + 2, Math.sin(a) * sp);
      this._spawn(new this.THREE.Vector3(x, 1, z), Math.random() < 0.5 ? 0xff7b1c : 0x333333, 0.3 + Math.random() * 0.3, v, 0.7 + Math.random() * 0.4, -6);
    }
    // scorch light flash
    const light = new this.THREE.PointLight(0xff7722, 60, 30);
    light.position.set(x, 3, z);
    this.scene.add(light);
    setTimeout(() => this.scene.remove(light), 350);
  }

  smoke(x, z, game) {
    const v = new this.THREE.Vector3((Math.random() - 0.5), 1.5, (Math.random() - 0.5));
    this._spawn(new this.THREE.Vector3(x, 0.5, z), 0x999999, 0.5, v, 0.9, 1);
  }

  setBeacon(x, z) {
    this.clearBeacon();
    const geo = new this.THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true);
    const mat = new this.THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: this.THREE.DoubleSide, depthWrite: false });
    this.beacon = new this.THREE.Mesh(geo, mat);
    this.beacon.position.set(x, 20, z);
    this.scene.add(this.beacon);
    const ring = new this.THREE.Mesh(
      new this.THREE.RingGeometry(1.4, 2.0, 24),
      new this.THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: this.THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.06, z);
    this.scene.add(ring);
    this.beacon.userData.ring = ring;
  }
  clearBeacon() {
    if (!this.beacon) return;
    this.scene.remove(this.beacon);
    if (this.beacon.userData.ring) this.scene.remove(this.beacon.userData.ring);
    this.beacon = null;
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); continue; }
      p.vel.y += p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    }
    if (this.beacon) this.beacon.rotation.y += dt * 0.8;
  }
}
