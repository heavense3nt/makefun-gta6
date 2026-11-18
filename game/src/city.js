// VELDORA v6 — Aurel Bay itself: ground, sea, beach, roads, and ~180 buildings.
// The city is a grid of blocks; the west edge is beach + ocean, the east edge rises into hills.
// Buildings are individual meshes (so the dossier outline shows them) with seeded variety.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildingTexture, roadTexture, sandTexture } from './textures.js';

const PALETTE = ['#8a7f72', '#6f7d8c', '#a08a6a', '#7a6a80', '#5f7480', '#9c8f7a', '#74806a', '#8c6f5f'];

export function createCity(scene, rng) {
  const group = new THREE.Group();
  const half = CONFIG.citySize / 2;
  const colliders = []; // {x, z, r} circles the player/cars cannot cross
  const buildings = [];

  // Ground: grass-green inland, sand on the west strip, sea plane beyond it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.citySize, CONFIG.citySize),
    new THREE.MeshLambertMaterial({ color: 0x4d7a45 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(36, CONFIG.citySize), new THREE.MeshLambertMaterial({ map: sandTexture() }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-half + 18, 0.05, 0); group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(300, CONFIG.citySize + 200),
    new THREE.MeshLambertMaterial({ color: 0x1d6f8e, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(-half - 150, CONFIG.seaLevel, 0); group.add(sea);

  // Roads: one plane per street, with a dashed-centre texture.
  const roadTex = roadTexture();
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;
  const streets = [];
  for (let i = -4; i <= 4; i++) streets.push(i * pitch);
  for (const s of streets) {
    for (const [w, h, x, z] of [
      [CONFIG.citySize, CONFIG.roadWidth, 0, s],
      [CONFIG.roadWidth, CONFIG.citySize, s, 0],
    ]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: roadTex }));
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, z); group.add(r);
    }
  }

  // Buildings, one per block quadrant, skipping the beach strip and the central plaza.
  const texA = buildingTexture('#8a7f72', 0.35);
  const texB = buildingTexture('#6f7d8c', 0.45);
  const texC = buildingTexture('#a08a6a', 0.3);
  const texs = [texA, texB, texC];
  let count = 0;
  for (let gx = -4; gx <= 4 && count < CONFIG.buildingCount; gx++) {
    for (let gz = -4; gz <= 4 && count < CONFIG.buildingCount; gz++) {
      const cx = gx * pitch; const cz = gz * pitch;
      if (cx < -half + 46) continue; // beach
      if (Math.abs(cx) < 24 && Math.abs(cz) < 24) continue; // central plaza
      for (const [ox, oz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
        if (count >= CONFIG.buildingCount) break;
        if (rng.next() < 0.12) continue; // empty lots / parks
        const w = rng.range(9, 15); const d = rng.range(9, 15);
        const hgt = rng.range(7, 34) * (Math.abs(gx) >= 3 || Math.abs(gz) >= 3 ? 0.7 : 1.25);
        const mat = new THREE.MeshLambertMaterial({ map: texs[count % 3], color: PALETTE[count % PALETTE.length] });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
        b.position.set(cx + ox, hgt / 2, cz + oz);
        group.add(b); buildings.push(b);
        colliders.push({ x: cx + ox, z: cz + oz, r: Math.max(w, d) * 0.62 });
        count++;
        if (rng.next() < 0.3) { // rooftop antenna
          const a = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
          a.position.set(cx + ox, hgt + 2.5, cz + oz); group.add(a);
        }
      }
    }
  }

  // Marina sign + pier on the beach, plaza fountain in the centre.
  const signMat = new THREE.MeshLambertMaterial({ color: 0xffd23e });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 0.6), signMat);
  sign.position.set(-half + 40, 7, 0); group.add(sign);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 6), new THREE.MeshLambertMaterial({ color: 0x7a5230 }));
  pier.position.set(-half - 6, 0.4, 30); group.add(pier);

  // Street lamps along the main avenues.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lampGlow = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffe9a8, emissiveIntensity: 0.7 });
  for (const s of streets) {
    for (let t = -half + 30; t < half - 20; t += 44) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
      pole.position.set(t, 3, s + CONFIG.roadWidth / 2 + 1); group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlow);
      bulb.position.set(t, 6.1, s + CONFIG.roadWidth / 2 + 1); group.add(bulb);
    }
  }
  // Palms on the beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  for (let i = 0; i < 26; i++) {
    const x = -half + rng.range(8, 34); const z = rng.range(-half + 20, half - 20);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
    trunk.position.set(x, 3, z); trunk.rotation.z = rng.range(-0.15, 0.15); group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 7), leafMat);
    leaves.position.set(x, 6.8, z); group.add(leaves);
  }

  scene.add(group);
  return { group, colliders, buildings, buildingCount: count, streets, half };
}
