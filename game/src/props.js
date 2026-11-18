// VELDORA v6 — street props: benches, hydrants, cash pickups, first-aid kits, beacons.
import * as THREE from 'three';
import { clamp } from './utils.js';

export function createProps(scene, rng, colliders) {
  const group = new THREE.Group();
  const pickups = []; // {mesh, kind, x, z, taken}
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x5a3d24 });
  const hydMat = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  for (let i = 0; i < 40; i++) {
    const x = rng.range(-190, 190); const z = rng.range(-190, 190);
    if (Math.abs(x) < 26 && Math.abs(z) < 26) continue;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    bench.position.set(x, 0.5, z); group.add(bench);
    colliders.push({ x, z, r: 1.4 });
    if (i % 4 === 0) {
      const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8), hydMat);
      hyd.position.set(x + 3, 0.45, z); group.add(hyd);
    }
  }
  // Street cash + first aid, scattered on sidewalks.
  const cashMat = new THREE.MeshLambertMaterial({ color: 0x7dff9a, emissive: 0x2a8a4a, emissiveIntensity: 0.6 });
  const aidMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xaa2222, emissiveIntensity: 0.5 });
  for (let i = 0; i < 14; i++) {
    const x = rng.range(-180, 180); const z = rng.range(-180, 180);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.6), cashMat);
    mesh.position.set(x, 0.4, z); group.add(mesh);
    pickups.push({ mesh, kind: 'cash', x, z, taken: false, value: 150 });
  }
  for (let i = 0; i < 6; i++) {
    const x = rng.range(-180, 180); const z = rng.range(-180, 180);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), aidMat);
    mesh.position.set(x, 0.4, z); group.add(mesh);
    pickups.push({ mesh, kind: 'aid', x, z, taken: false, value: 40 });
  }
  scene.add(group);
  return {
    group, pickups,
    update(dt, t) {
      for (const p of pickups) {
        if (p.taken) continue;
        p.mesh.rotation.y += dt * 1.5;
        p.mesh.position.y = 0.4 + Math.sin(t * 2 + p.x) * 0.12;
      }
    },
    collectNear(x, z, radius) {
      const got = [];
      for (const p of pickups) {
        if (p.taken) continue;
        if (Math.hypot(p.x - x, p.z - z) < radius) { p.taken = true; p.mesh.visible = false; got.push(p); }
      }
      return got;
    },
    reset() { for (const p of pickups) { p.taken = false; p.mesh.visible = true; } },
  };
}

// A tall glowing beacon marking the current mission objective.
export function createBeacon(scene) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  mesh.visible = false; scene.add(mesh);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 24), new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  return {
    set(x, z) { mesh.position.set(x, 30, z); ring.position.set(x, 0.15, z); mesh.visible = true; ring.visible = true; },
    hide() { mesh.visible = false; ring.visible = false; },
    update(t) { const s = 1 + Math.sin(t * 3) * 0.15; ring.scale.set(s, s, 1); },
  };
}
