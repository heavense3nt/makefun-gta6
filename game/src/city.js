// VELDORA v7 — the ground under the city: asphalt, sidewalks, beach,
// ocean, pier, lamps and palms, plus the marina sign.
import * as THREE from 'three';
import { CITY, COLORS } from './config.js';
import { roadTexture, sandTexture, pavementTexture } from './textures.js';

export function buildCity(scene, city) {
  const group = new THREE.Group();
  group.name = 'city';
  const size = CITY.half * 2 + 200;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ map: pavementTexture() }),
  );
  ground.material.map.repeat.set(24, 24);
  ground.material.map.wrapS = THREE.RepeatWrapping;
  ground.material.map.wrapT = THREE.RepeatWrapping;
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, 0, 0);
  group.add(ground);

  // Roads: dark strips along every avenue, with dashed centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture() });
  roadMat.map.wrapS = THREE.RepeatWrapping;
  roadMat.map.wrapT = THREE.RepeatWrapping;
  for (const v of city.roads) {
    for (const horizontal of [true, false]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 16, CITY.roadHalf * 2), roadMat.clone());
      strip.material.map = roadMat.map;
      strip.material.map.repeat.set(16, 1);
      strip.rotation.x = -Math.PI / 2;
      if (horizontal) { strip.rotation.z = Math.PI / 2; strip.position.set(v, 0.02, 0); }
      else strip.position.set(0, 0.02, v);
      group.add(strip);
    }
  }

  // Beach and ocean to the east.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(26, CITY.half * 2 + 40),
    new THREE.MeshLambertMaterial({ map: sandTexture() }),
  );
  sand.material.map.repeat.set(2, 18);
  sand.material.map.wrapS = THREE.RepeatWrapping;
  sand.material.map.wrapT = THREE.RepeatWrapping;
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 12, 0.01, 0);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, CITY.half * 2 + 200),
    new THREE.MeshLambertMaterial({ color: COLORS.sea, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CITY.oceanX + 110, 0.05, 0);
  group.add(sea);

  // Pier out into the sea at the marina.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 0.8, 8), pierMat);
  pier.position.set(150, 0.4, -30);
  group.add(pier);
  for (let x = 132; x <= 176; x += 11) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), pierMat);
    post.position.set(x, -0.4, -33.4);
    group.add(post);
    const post2 = post.clone(); post2.position.z = -26.6; group.add(post2);
  }

  // Marina sign: glowing letters on the waterfront.
  const signMat = new THREE.MeshBasicMaterial({ color: 0xff5a7a });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 0.6), signMat);
  sign.position.set(118, 7, -30);
  group.add(sign);
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 7, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  signPost.position.set(118, 3.5, -30);
  group.add(signPost);

  // Lamps: pole + warm glowing head, lit at dusk.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d34 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  for (const l of city.lamps) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(l.x, 2.7, l.z);
    group.add(pole);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(l.x, 5.5, l.z);
    group.add(head);
  }

  // Palms along the beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2a7a4a });
  for (const p of city.palms) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5, 6), trunkMat);
    trunk.position.set(p.x, 2.5, p.z);
    trunk.rotation.z = 0.12;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 7), leafMat);
    crown.position.set(p.x + 0.6, 6, p.z);
    group.add(crown);
  }

  // Benches in the plaza and park blocks.
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
  for (const b of city.benches) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    bench.position.set(b.x, 0.45, b.z);
    group.add(bench);
  }

  scene.add(group);
  return group;
}
