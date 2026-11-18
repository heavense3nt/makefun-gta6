// VELDORA v6 — pedestrians stroll the sidewalks and flee when shots are fired.
import * as THREE from 'three';
import { clamp } from './utils.js';

const SHIRT_COLORS = [0xd8d8d8, 0xc23b2e, 0x2e6fc2, 0x2a8a4a, 0xe8c33a, 0x7a4a9c, 0x333333, 0xff8a5a];

export function createPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRT_COLORS[i % SHIRT_COLORS.length] });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.35), shirt);
    body.position.y = 1.05; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
    head.position.y = 1.75; g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x222831 }));
    legs.position.y = 0.35; g.add(legs);
    const x = rng.range(-190, 190); const z = rng.range(-190, 190);
    g.position.set(x, 0, z);
    scene.add(g);
    peds.push({
      mesh: g, x, z, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1, 2), panic: 0,
      legPhase: rng.range(0, 6),
    });
  }
  return {
    peds,
    scare(x, z, radius) {
      for (const p of peds) {
        if (Math.hypot(p.x - x, p.z - z) < radius) p.panic = 3;
      }
    },
    update(dt) {
      for (const p of peds) {
        let speed = p.speed;
        if (p.panic > 0) {
          p.panic -= dt; speed = 5.5;
          // Run away from the city centre panic source: keep current heading, it changes on scare.
        }
        p.x += Math.sin(p.heading) * speed * dt;
        p.z += Math.cos(p.heading) * speed * dt;
        if (Math.abs(p.x) > 200 || Math.abs(p.z) > 200) { p.heading += Math.PI; }
        if (Math.random() < dt * 0.08) p.heading += (Math.random() - 0.5) * 1.6;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
        p.legPhase += dt * speed * 3;
        p.mesh.position.y = Math.abs(Math.sin(p.legPhase)) * 0.06;
      }
    },
  };
}
