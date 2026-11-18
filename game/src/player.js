// VELDORA v6 — Jax Marlowe on foot: movement, jumping, health, and the pistol.
// STRAFE (mandatory): D moves toward camera screen-right at every yaw — see utils.moveDirection.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, moveDirection } from './utils.js';

export function createPlayer(scene) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8a2a2a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.38), jacket);
  body.position.y = 1.1; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 1.85; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), new THREE.MeshLambertMaterial({ color: 0x1d2733 }));
  legs.position.y = 0.38; g.add(legs);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.55), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.35, 1.25, 0.3); g.add(gun);
  g.position.set(0, 0, 40);
  scene.add(g);
  return {
    mesh: g, x: 0, z: 40, y: 0, vy: 0, heading: 0,
    health: CONFIG.playerHealth, armor: 0,
    ammoMag: CONFIG.pistolMag, ammoReserve: CONFIG.pistolReserve,
    reloading: 0, legPhase: 0,
    move(dt, camYaw, forwardInput, strafeInput, sprint, jump, colliders) {
      const speed = sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
      const dir = moveDirection(camYaw, forwardInput, strafeInput);
      const nx = this.x + dir.x * speed * dt;
      const nz = this.z + dir.z * speed * dt;
      // Building collision: slide along circles.
      let blocked = false;
      for (const c of colliders) {
        if (Math.hypot(nx - c.x, nz - c.z) < c.r + 0.5) { blocked = true; break; }
      }
      if (!blocked) {
        this.x = clamp(nx, -205, 205); this.z = clamp(nz, -205, 205);
        if (dir.x || dir.z) {
          this.heading = Math.atan2(dir.x, dir.z);
          this.legPhase += dt * speed * 1.6;
        }
      }
      if (jump && this.y === 0) this.vy = CONFIG.jumpSpeed;
      this.vy -= CONFIG.gravity * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) this.vy = 0;
      this.mesh.position.set(this.x, this.y + Math.abs(Math.sin(this.legPhase)) * 0.05, this.z);
      this.mesh.rotation.y = this.heading;
    },
    hurt(amount) {
      const absorbed = Math.min(this.armor, amount);
      this.armor -= absorbed;
      this.health -= (amount - absorbed);
      return this.health <= 0;
    },
    heal(amount) { this.health = Math.min(CONFIG.playerHealth, this.health + amount); },
  };
}
