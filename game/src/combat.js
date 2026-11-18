// VELDORA v6 — pistol combat: raycast shots, guards who shoot back, muzzle flash + tracer.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createCombat(scene) {
  const group = new THREE.Group(); scene.add(group);
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const guards = [];
  return {
    guards,
    spawnGuards(positions) {
      for (const p of positions) this.spawnGuard(p.x, p.z);
    },
    spawnGuard(x, z) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.95, 0.38), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      body.position.y = 1.1; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
      head.position.y = 1.85; g.add(head);
      g.position.set(x, 0, z); scene.add(g);
      guards.push({ mesh: g, x, z, health: 100, shootTimer: 1 + Math.random() });
    },
    clearGuards() {
      for (const g of guards) scene.remove(g.mesh);
      guards.length = 0;
    },
    // Shoot from the player toward a world point. Returns the guard hit, if any.
    shoot(origin, target) {
      const dir = new THREE.Vector3(target.x - origin.x, target.y - origin.y, target.z - origin.z);
      const len = dir.length(); dir.normalize();
      const geo = new THREE.BoxGeometry(0.06, 0.06, len);
      const m = new THREE.Mesh(geo, tracerMat);
      m.position.set((origin.x + target.x) / 2, (origin.y + target.y) / 2, (origin.z + target.z) / 2);
      m.lookAt(target.x, target.y, target.z);
      group.add(m); tracers.push({ mesh: m, life: 0.09 });
      let hit = null; let best = len;
      for (const g of guards) {
        // Closest approach of the ray to the guard's centre line.
        const gx = g.x - origin.x; const gz = g.z - origin.z;
        const along = gx * dir.x + gz * dir.z;
        if (along < 0 || along > len) continue;
        const px = origin.x + dir.x * along; const pz = origin.z + dir.z * along;
        const d = Math.hypot(g.x - px, g.z - pz);
        if (d < 1.2 && along < best) { best = along; hit = g; }
      }
      if (hit) {
        hit.health -= CONFIG.pistolDamage;
        if (hit.health <= 0) { scene.remove(hit.mesh); guards.splice(guards.indexOf(hit), 1); }
      }
      return hit;
    },
    updateGuards(dt, playerX, playerZ, playerZy, onPlayerHit) {
      for (const g of guards) {
        const d = Math.hypot(g.x - playerX, g.z - playerZ);
        g.mesh.lookAt(playerX, 0, playerZ);
        if (d < 26) {
          g.shootTimer -= dt;
          if (g.shootTimer <= 0) {
            g.shootTimer = 1.4 + Math.random() * 0.8;
            if (Math.random() < 0.55) onPlayerHit(12);
          }
        } else if (d > 3) {
          // Walk straight at the player (mission-5 guards, noted limitation).
          const dx = (playerX - g.x) / d; const dz = (playerZ - g.z) / d;
          g.x += dx * 3.2 * dt; g.z += dz * 3.2 * dt;
          g.mesh.position.set(g.x, 0, g.z);
        }
      }
    },
    update(dt) {
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) { group.remove(tracers[i].mesh); tracers.splice(i, 1); }
      }
    },
  };
}
