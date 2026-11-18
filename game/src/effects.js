// effects.js — particles and flashes: sparks from crashes, tyre smoke,
// muzzle flashes, explosion fireballs and floating cash pickups that spin
// above the street.
import * as THREE from 'three';

class Burst {
  constructor(scene, x, y, z, color, count, speed, life, size, gravity) {
    this.life = life;
    this.age = 0;
    this.gravity = gravity;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * Math.PI;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = Math.cos(a) * Math.cos(e) * s;
      this.vel[i * 3 + 1] = Math.sin(e) * s + speed * 0.3;
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(e) * s;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 1 });
    this.points = new THREE.Points(geo, this.mat);
    scene.add(this.points);
  }
  update(dt) {
    this.age += dt;
    const n = this.pos.length / 3;
    for (let i = 0; i < n; i++) {
      this.vel[i * 3 + 1] -= this.gravity * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) this.pos[i * 3 + 1] = 0.05;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.mat.opacity = Math.max(0, 1 - this.age / this.life);
    return this.age < this.life;
  }
  dispose(scene) {
    scene.remove(this.points);
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.pickups = [];
    this.flash = new THREE.PointLight(0xffcc66, 0, 18, 2);
    this.flash.position.set(0, 2, 0);
    scene.add(this.flash);
    this.flashTimer = 0;
  }
  sparks(x, y, z) {
    this.bursts.push(new Burst(this.scene, x, y, z, 0xffcc44, 26, 9, 0.5, 0.28, 12));
  }
  smoke(x, y, z) {
    this.bursts.push(new Burst(this.scene, x, y, z, 0x9a9a9a, 10, 1.6, 0.9, 0.7, -1.2));
  }
  explosion(x, y, z) {
    this.bursts.push(new Burst(this.scene, x, y + 1, z, 0xff7a1a, 60, 16, 1.1, 0.55, 6));
    this.bursts.push(new Burst(this.scene, x, y + 1, z, 0xffe14a, 34, 11, 0.7, 0.45, 4));
    this.bursts.push(new Burst(this.scene, x, y + 1, z, 0x555555, 24, 5, 1.6, 0.9, -2));
    this.flash.position.set(x, y + 2, z);
    this.flash.intensity = 60;
    this.flashTimer = 0.18;
  }
  muzzle(x, y, z) {
    this.flash.position.set(x, y, z);
    this.flash.intensity = 26;
    this.flashTimer = 0.07;
    this.bursts.push(new Burst(this.scene, x, y, z, 0xffe14a, 8, 6, 0.18, 0.3, 0));
  }
  blood(x, y, z) {
    this.bursts.push(new Burst(this.scene, x, y, z, 0xaa1111, 14, 4, 0.6, 0.3, 10));
  }
  addCashPickup(x, z, amount) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x37d67a });
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.45), mat);
    bill.position.y = 1.1;
    const glow = new THREE.PointLight(0x37d67a, 3, 8, 2);
    glow.position.y = 1.2;
    g.add(bill, glow);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.pickups.push({ mesh: g, x, z, amount, spin: 0 });
  }
  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      if (!this.bursts[i].update(dt)) {
        this.bursts[i].dispose(this.scene);
        this.bursts.splice(i, 1);
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
    for (const p of this.pickups) {
      p.spin += dt * 2.4;
      p.mesh.rotation.y = p.spin;
      p.mesh.children[0].position.y = 1.1 + Math.sin(p.spin * 1.6) * 0.25;
    }
  }
  // Returns the amount collected, or 0.
  collectCash(x, z) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(p.x - x, p.z - z) < 2.2) {
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        return p.amount;
      }
    }
    return 0;
  }
}
