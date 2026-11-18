// VELDORA v7 — Kai on foot: camera-relative movement.
// STRAFE FIX: D moves the player exactly along the camera's screen-right
// vector at every yaw, so the strafe dot product is +1.00 (see utils.js).
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp, screenForward, screenRight } from './utils.js';
import { resolveBuildings, clampToCity } from './world.js';

export function createPlayer(scene, x, z) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.9, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0x2a6abf }),
  );
  body.position.y = 1.05;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
  );
  head.position.y = 1.95;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  visor.position.set(0, 1.98, 0.26);
  group.add(body, head, visor);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    mesh: group,
    pos: { x, y: 0, z },
    vel: { x: 0, z: 0 },
    vy: 0,
    heading: 0,
    onGround: true,
    health: PLAYER.maxHealth,
    armor: 0,
  };
}

// Returns the movement direction for the current keys, in world space.
export function moveDirection(input, camYaw) {
  const f = screenForward(camYaw);
  const r = screenRight(camYaw);
  let mx = 0; let mz = 0;
  if (input.is('KeyW') || input.is('ArrowUp')) { mx += f.x; mz += f.z; }
  if (input.is('KeyS') || input.is('ArrowDown')) { mx -= f.x; mz -= f.z; }
  if (input.is('KeyD') || input.is('ArrowRight')) { mx += r.x; mz += r.z; }
  if (input.is('KeyA') || input.is('ArrowLeft')) { mx -= r.x; mz -= r.z; }
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx /= len; mz /= len; }
  return { x: mx, z: mz };
}

export function updatePlayer(player, dt, input, camYaw, city) {
  const dir = moveDirection(input, camYaw);
  const sprint = input.is('ShiftLeft') || input.is('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  player.vel.x += (dir.x * speed - player.vel.x) * Math.min(1, PLAYER.accel * dt / speed * 10);
  player.vel.z += (dir.z * speed - player.vel.z) * Math.min(1, PLAYER.accel * dt / speed * 10);
  // Simple exponential approach to the target velocity.
  const k = 1 - Math.exp(-10 * dt);
  player.vel.x += (dir.x * speed - player.vel.x) * k;
  player.vel.z += (dir.z * speed - player.vel.z) * k;
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  if (Math.hypot(player.vel.x, player.vel.z) > 0.4) {
    player.heading = Math.atan2(player.vel.x, player.vel.z);
  }
  if (input.is('Space') && player.onGround) {
    player.vy = PLAYER.jumpSpeed;
    player.onGround = false;
  }
  player.vy -= PLAYER.gravity * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= 0) { player.pos.y = 0; player.vy = 0; player.onGround = true; }
  resolveBuildings(city, player.pos, PLAYER.radius);
  const clamped = clampToCity(player.pos.x, player.pos.z);
  player.pos.x = clamped.x; player.pos.z = clamped.z;
  player.mesh.position.set(player.pos.x, player.pos.y, player.pos.z);
  player.mesh.rotation.y = player.heading;
  // Walk bob.
  const moving = Math.hypot(player.vel.x, player.vel.z);
  player.mesh.position.y = player.pos.y + Math.abs(Math.sin(performance.now() / 140)) * (moving > 1 ? 0.06 : 0);
}
