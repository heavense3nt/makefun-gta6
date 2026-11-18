// VELDORA v6 — the Aurel Bay police: interceptors chase, ram, and bust the player on foot.
// Wanted heat cools when no police can see the player.
import * as THREE from 'three';
import { clamp, wrapAngle, angleDiff } from './utils.js';
import { buildCarMesh } from './vehicles.js';

export function createPolice(scene, rng) {
  const units = [];
  for (let i = 0; i < 4; i++) {
    const mesh = buildCarMesh(0x1d2f4a, 'sedan');
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 0.9 }));
    bar.position.set(0, 1.55, -0.2); mesh.add(bar);
    mesh.visible = false;
    scene.add(mesh);
    units.push({ mesh, bar, x: 0, z: 0, heading: 0, speed: 0, active: false, flash: 0 });
  }
  return {
    units,
    spawnCount(wanted) { return Math.min(wanted, 4); },
    update(dt, playerX, playerZ, wanted, playerInCar, onBust) {
      const want = this.spawnCount(wanted);
      units.forEach((u, i) => {
        if (i >= want) { u.active = false; u.mesh.visible = false; return; }
        if (!u.active) {
          // Spawn on a road a block away from the player.
          const a = rng.range(0, Math.PI * 2);
          u.x = clamp(playerX + Math.sin(a) * 55, -200, 200);
          u.z = clamp(playerZ + Math.cos(a) * 55, -200, 200);
          u.heading = Math.atan2(playerX - u.x, playerZ - u.z);
          u.speed = 0; u.active = true; u.mesh.visible = true;
        }
        // Steer toward the player, faster than traffic, slower than the fastest car.
        const targetHeading = Math.atan2(playerX - u.x, playerZ - u.z);
        u.heading = wrapAngle(u.heading + clamp(angleDiff(targetHeading, u.heading), -2.2 * dt, 2.2 * dt));
        u.speed = clamp(u.speed + 14 * dt, 0, 26);
        u.x += Math.sin(u.heading) * u.speed * dt;
        u.z += Math.cos(u.heading) * u.speed * dt;
        u.mesh.position.set(u.x, 0, u.z);
        u.mesh.rotation.y = u.heading;
        u.flash += dt * 8;
        u.bar.material.emissive.setHex(Math.sin(u.flash) > 0 ? 0xff2a2a : 0x2a6cff);
        const d = Math.hypot(playerX - u.x, playerZ - u.z);
        if (d < 3.2 && !playerInCar) onBust();
        if (d < 3.5 && playerInCar) {
          // Ram: shove the player's car sideways a touch.
          u.speed *= 0.92;
        }
      });
    },
    nearestDist(playerX, playerZ) {
      let best = 999;
      for (const u of units) if (u.active) best = Math.min(best, Math.hypot(u.x - playerX, u.z - playerZ));
      return best;
    },
  };
}
