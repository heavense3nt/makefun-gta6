// VELDORA v7 — combat: pistol with raycast shots, reload, armed guards
// who shoot back, and street cash + first-aid pickups.
import * as THREE from 'three';
import { dist2d } from './utils.js';

export function createCombat() {
  return {
    ammo: 12, reserve: 60, reloading: 0,
    guards: [], // {mesh, x, z, health, shootTimer}
    cashPickups: [], // {mesh, x, z, value, taken}
    medkits: [], // {mesh, x, z, taken}
  };
}

export function spawnGuard(scene, combat, x, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), new THREE.MeshLambertMaterial({ color: 0x3a3f46 }));
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
  head.position.y = 1.95;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.3, 0.4);
  group.add(body, head, gun);
  group.position.set(x, 0, z);
  scene.add(group);
  const guard = { mesh: group, x, z, health: 3, shootTimer: 1.5 + Math.random() };
  combat.guards.push(guard);
  return guard;
}

export function spawnPickup(scene, combat, kind, x, z, value) {
  const color = kind === 'cash' ? 0x2e8a3a : 0xd8d8d8;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.25, 0.6),
    new THREE.MeshLambertMaterial({ color, emissive: kind === 'cash' ? 0x1a5a22 : 0x882222 }),
  );
  mesh.position.set(x, 0.35, z);
  scene.add(mesh);
  const item = { mesh, x, z, value: value || 0, taken: false };
  if (kind === 'cash') combat.cashPickups.push(item); else combat.medkits.push(item);
  return item;
}

// Fire one raycast shot from the camera through the crosshair.
// Returns { hit: 'guard' | 'building' | null, guard }.
export function shoot(combat, origin, direction, maxDist) {
  if (combat.ammo <= 0 || combat.reloading > 0) return { hit: null };
  combat.ammo -= 1;
  const ray = new THREE.Raycaster(origin, direction, 0.1, maxDist);
  let bestGuard = null; let bestD = maxDist;
  for (const g of combat.guards) {
    if (g.health <= 0) continue;
    const d = dist2d(origin.x, origin.z, g.x, g.z);
    if (d > maxDist) continue;
    // Cheap cone test: guard within ~4 degrees of the ray.
    const toGuard = new THREE.Vector3(g.x - origin.x, 0, g.z - origin.z).normalize();
    const dir2 = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    if (toGuard.dot(dir2) > 0.997 && d < bestD) { bestD = d; bestGuard = g; }
  }
  if (bestGuard) {
    bestGuard.health -= 1;
    if (bestGuard.health <= 0) bestGuard.mesh.visible = false;
    return { hit: 'guard', guard: bestGuard };
  }
  void ray;
  return { hit: null };
}

export function updateCombat(combat, dt, player, onGuardShot) {
  if (combat.reloading > 0) {
    combat.reloading -= dt;
    if (combat.reloading <= 0) {
      const need = 12 - combat.ammo;
      const take = Math.min(need, combat.reserve);
      combat.ammo += take; combat.reserve -= take;
    }
  }
  for (const g of combat.guards) {
    if (g.health <= 0) continue;
    const d = dist2d(g.x, g.z, player.pos.x, player.pos.z);
    g.shootTimer -= dt;
    if (d < 26 && g.shootTimer <= 0) {
      g.shootTimer = 1.6 + Math.random() * 0.8;
      g.mesh.lookAt(player.pos.x, 1.3, player.pos.z);
      if (onGuardShot) onGuardShot(g);
    }
    // Guards walk straight at Kai (they can clip buildings — known cosmetic limit).
    if (d < 26 && d > 6) {
      const dx = (player.pos.x - g.x) / d; const dz = (player.pos.z - g.z) / d;
      g.x += dx * 3.2 * dt; g.z += dz * 3.2 * dt;
      g.mesh.position.set(g.x, 0, g.z);
      g.mesh.lookAt(player.pos.x, 0, player.pos.z);
    }
  }
  // Pickups bob and spin; collect on touch.
  for (const list of [combat.cashPickups, combat.medkits]) {
    for (const item of list) {
      if (item.taken) continue;
      item.mesh.rotation.y += dt * 2;
      item.mesh.position.y = 0.35 + Math.sin(performance.now() / 300) * 0.08;
    }
  }
  return combat;
}

export function collectPickups(combat, player) {
  let cash = 0; let healed = 0;
  for (const item of combat.cashPickups) {
    if (!item.taken && dist2d(item.x, item.z, player.pos.x, player.pos.z) < 1.6) {
      item.taken = true; item.mesh.visible = false; cash += item.value;
    }
  }
  for (const item of combat.medkits) {
    if (!item.taken && dist2d(item.x, item.z, player.pos.x, player.pos.z) < 1.6) {
      item.taken = true; item.mesh.visible = false; healed += 35;
    }
  }
  return { cash, healed };
}
