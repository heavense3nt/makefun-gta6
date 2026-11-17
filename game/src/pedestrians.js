// Pedestrians of Veldora: office workers, beachgoers, dock hands and, when a
// mission needs them, armed Dock Rats. They stroll the sidewalks between random
// road points, scatter when a gun goes off or a car bears down on them, and the
// ones the player runs over are what make the wanted level jump.

import { makeRng, pick } from './config.js';
import { collideCircle } from './city.js';

const THREE = window.THREE;

const SHIRTS = [0xe8e8e8, 0x38b24a, 0xd8382e, 0x8a5fd0, 0xf2c230, 0x2e6fd8, 0xff7f2a, 0x38c8b2];
const SKINS = [0xd8a077, 0xb98a5e, 0x8a5a3a, 0xe8b898];

function buildPed(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKINS) });
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, [0x2a3550, 0x3a3a3a, 0x5a4a3a]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), shirt);
  torso.position.y = 1.12; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.36), skin);
  head.position.y = 1.68; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), pants);
  legL.position.set(-0.15, 0.36, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function createPedestrians(scene, city) {
  const rng = makeRng(4242);
  const peds = [];
  const pitch = 56;

  function randomSidewalkPoint() {
    const line = (Math.floor(rng() * 9) - 4) * pitch;
    const t = (rng() * 2 - 1) * 220;
    if (rng() < 0.5) return { x: line + (rng() < 0.5 ? -8 : 8), z: t };
    return { x: t, z: line + (rng() < 0.5 ? -8 : 8) };
  }

  function spawn(x, z, opts = {}) {
    const mesh = buildPed(rng);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      mesh, target: randomSidewalkPoint(), speed: 1.2 + rng() * 1.1,
      phase: rng() * 6, fleeing: false, fleeTimer: 0,
      armed: !!opts.armed, gang: !!opts.gang, health: opts.armed ? 50 : 100,
      alive: true, id: peds.length,
    };
    if (opts.armed) {
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      gun.position.set(0.35, 0.95, 0.2);
      mesh.add(gun);
    }
    peds.push(ped);
    // tag the mesh so combat's raycast can tell what a shot hit
    mesh.userData.targetRef = ped;
    mesh.userData.targetKind = ped.gang ? 'gang' : 'ped';
    return ped;
  }

  for (let i = 0; i < 26; i += 1) {
    const p = randomSidewalkPoint();
    spawn(p.x, p.z);
  }

  function step(dt, playerPos, threatPos) {
    for (const ped of peds) {
      if (!ped.alive) continue;
      // flee from a nearby threat (gunfire point or speeding car)
      if (threatPos) {
        const d = Math.hypot(ped.mesh.position.x - threatPos.x, ped.mesh.position.z - threatPos.z);
        if (d < 14) { ped.fleeing = true; ped.fleeTimer = 2.5; }
      }
      let tx, tz, speed = ped.speed;
      if (ped.fleeing) {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.fleeing = false;
        const dx = ped.mesh.position.x - (threatPos?.x ?? playerPos.x);
        const dz = ped.mesh.position.z - (threatPos?.z ?? playerPos.z);
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.mesh.position.x + (dx / d) * 10;
        tz = ped.mesh.position.z + (dz / d) * 10;
        speed = 4.5;
      } else {
        tx = ped.target.x; tz = ped.target.z;
      }
      const dx = tx - ped.mesh.position.x;
      const dz = tz - ped.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2 && !ped.fleeing) { ped.target = randomSidewalkPoint(); continue; }
      const vx = (dx / dist) * speed;
      const vz = (dz / dist) * speed;
      ped.mesh.position.x += vx * dt;
      ped.mesh.position.z += vz * dt;
      ped.mesh.rotation.y = Math.atan2(vx, vz);
      ped.phase += dt * speed * 2.2;
      const swing = Math.sin(ped.phase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      const push = collideCircle(city.colliders, ped.mesh.position.x, ped.mesh.position.z, 0.4);
      if (push) { ped.mesh.position.x += push.x; ped.mesh.position.z += push.z; }
    }
  }

  function nearestTo(pos, maxDist, filter) {
    let best = null; let bestD = maxDist;
    for (const ped of peds) {
      if (!ped.alive) continue;
      if (filter && !filter(ped)) continue;
      const d = Math.hypot(ped.mesh.position.x - pos.x, ped.mesh.position.z - pos.z);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  }

  function kill(ped) {
    ped.alive = false;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.3;
  }

  return { peds, spawn, step, nearestTo, kill, randomSidewalkPoint };
}
