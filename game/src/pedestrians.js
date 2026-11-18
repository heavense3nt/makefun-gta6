// VELDORA v7 — pedestrians: strolling locals who panic and flee when a
// gunshot rings out or the wanted level climbs.
import * as THREE from 'three';
import { mulberry32, pick, range } from './random.js';
import { dist2d } from './utils.js';
import { resolveBuildings } from './world.js';

const SHIRTS = [0xd84a4a, 0x4a8ad8, 0x4ad88a, 0xd8c84a, 0x8a4ad8, 0xd88a4a, 0xdddddd];

export function createPedestrians(scene, city, count) {
  const rng = mulberry32(city.seed + 913);
  const peds = [];
  const bodyGeo = new THREE.CapsuleGeometry(0.34, 0.75, 4, 8);
  const headGeo = new THREE.SphereGeometry(0.24, 10, 8);
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  for (let i = 0; i < count; i++) {
    const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, shirt);
    body.position.y = 0.95;
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.7;
    group.add(body, head);
    const x = range(rng, -105, 105); const z = range(rng, -105, 105);
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      mesh: group,
      x, z,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 0.8, 1.6),
      panic: 0,
      targetX: x, targetZ: z,
      retarget: rng() * 6,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, city, threat) {
  for (const p of peds) {
    if (threat && threat.level > 0) {
      const d = dist2d(p.x, p.z, threat.x, threat.z);
      if (d < 22) p.panic = Math.max(p.panic, 3);
    }
    if (p.panic > 0) {
      p.panic -= dt;
      const away = Math.atan2(p.x - (threat ? threat.x : 0), p.z - (threat ? threat.z : 0));
      p.heading = away;
      p.speed = 5.2;
    } else {
      p.retarget -= dt;
      if (p.retarget <= 0) {
        p.retarget = 4 + Math.random() * 6;
        p.targetX = p.x + (Math.random() - 0.5) * 40;
        p.targetZ = p.z + (Math.random() - 0.5) * 40;
        p.targetX = Math.max(-110, Math.min(110, p.targetX));
        p.targetZ = Math.max(-110, Math.min(110, p.targetZ));
      }
      const dx = p.targetX - p.x; const dz = p.targetZ - p.z;
      if (Math.hypot(dx, dz) > 1) p.heading = Math.atan2(dx, dz);
      p.speed = 1.2;
    }
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    resolveBuildings(city, p, 0.4);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
  }
}
