// VELDORA v7 — the wanted system: stars, police interceptors that chase
// and ram, heat that cools when unseen, and a bust when they corner Kai.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { buildCarMesh } from './vehicles.js';
import { wrapAngle, dist2d } from './utils.js';

export function createWanted() {
  return { stars: 0, unseenTimer: 0, bustTimer: 0, police: [] };
}

export function addHeat(wanted, stars) {
  wanted.stars = Math.min(WANTED.maxStars, wanted.stars + stars);
  wanted.unseenTimer = 0;
}

function spawnPolice(scene, wanted, x, z) {
  const mesh = buildCarMesh({ name: 'sedan', w: 1.9, l: 4.2, h: 0.75 }, 0x1a1a22);
  // White doors + light bar.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  bar.position.set(0, 1.5, 0);
  mesh.add(bar);
  scene.add(mesh);
  const car = { mesh, kind: { name: 'sedan' }, x, z, heading: 0, speed: 0, isPolice: true, isPlayer: false, bar };
  wanted.police.push(car);
  return car;
}

export function syncPolice(scene, wanted, playerPos) {
  const want = wanted.stars === 0 ? 0 : Math.min(1 + Math.floor(wanted.stars / 2), 4);
  while (wanted.police.length < want) {
    const angle = Math.random() * Math.PI * 2;
    spawnPolice(scene, wanted, playerPos.x + Math.sin(angle) * 45, playerPos.z + Math.cos(angle) * 45);
  }
  while (wanted.police.length > want) {
    const car = wanted.police.pop();
    scene.remove(car.mesh);
  }
}

export function updateWanted(scene, wanted, dt, player, inCar, playerCar) {
  const pos = inCar && playerCar ? { x: playerCar.x, z: playerCar.z } : player.pos;
  syncPolice(scene, wanted, pos);
  // Heat cools when no police can see the player.
  let seen = false;
  for (const cop of wanted.police) {
    const d = dist2d(cop.x, cop.z, pos.x, pos.z);
    if (d < 40) seen = true;
    // Chase: steer at the player, ram when close.
    const wantHeading = Math.atan2(pos.x - cop.x, pos.z - cop.z);
    cop.heading += wrapAngle(wantHeading - cop.heading) * Math.min(1, 2.4 * dt);
    cop.speed = Math.min(cop.speed + 14 * dt, 26 + wanted.stars * 1.5);
    cop.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.z += Math.cos(cop.heading) * cop.speed * dt;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    // Flashing light bar.
    cop.bar.material.color.setHex(Math.floor(performance.now() / 220) % 2 === 0 ? 0xff2222 : 0x2266ff);
    // Ram: shove the player car, or hurt Kai on foot.
    if (d < 2.8) {
      if (inCar && playerCar) { playerCar.speed *= 0.55; playerCar.x += Math.sin(cop.heading) * 1.2; playerCar.z += Math.cos(cop.heading) * 1.2; }
      else { player.health -= 14 * dt; }
    }
  }
  if (wanted.stars > 0) {
    if (seen) wanted.unseenTimer = 0;
    else {
      wanted.unseenTimer += dt;
      if (wanted.unseenTimer > WANTED.decaySeconds) {
        wanted.stars -= 1;
        wanted.unseenTimer = 0;
      }
    }
    // Busted: a cop on foot range for long enough.
    if (!inCar) {
      let close = false;
      for (const cop of wanted.police) if (dist2d(cop.x, cop.z, pos.x, pos.z) < WANTED.bustRadius) close = true;
      wanted.bustTimer = close ? wanted.bustTimer + dt : 0;
    } else wanted.bustTimer = 0;
  }
  return wanted.bustTimer >= WANTED.bustSeconds;
}
