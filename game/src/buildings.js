// VELDORA v7 — building meshes: one shared box geometry, per-building
// materials from canvas facade textures. ~180 buildings, dusk-lit windows.
import * as THREE from 'three';
import { buildingTexture } from './textures.js';

const MATERIALS = new Map();

function materialFor(color, lit) {
  const key = `${color}|${lit.toFixed(2)}`;
  if (!MATERIALS.has(key)) {
    MATERIALS.set(key, new THREE.MeshLambertMaterial({ map: buildingTexture(color, lit) }));
  }
  return MATERIALS.get(key);
}

export function buildBuildings(scene, city) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2c2f38 });
  const group = new THREE.Group();
  group.name = 'buildings';
  for (const b of city.buildings) {
    const mesh = new THREE.Mesh(geo, materialFor(b.color, b.lit));
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    group.add(mesh);
    if (b.roof) {
      const roof = new THREE.Mesh(geo, roofMat);
      roof.scale.set(b.w * 0.7, 1.2, b.d * 0.7);
      roof.position.set(b.x, b.h + 0.6, b.z);
      group.add(roof);
    }
  }
  scene.add(group);
  return group;
}
