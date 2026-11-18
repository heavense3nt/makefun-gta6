// city.js — Veldora Bay: a sun-soaked coastal city on a street grid.
// Streets every 40 m, blocks of 30 m, ~180 buildings, a beach and sea to the south,
// Mara's garage (mission hub), a park, a plaza and a harbor. Exports the colliders
// and the road graph the traffic, police and pedestrians drive and walk on.

import { mulberry32, pick, range } from './math3.js';
import { makeBuildingTexture, makeRoadTexture, makeSidewalkTexture, makeBeachTexture } from './textures.js';

export const STREET_STEP = 40;
export const STREET_HALF = 5;
export const CITY_EXTENT = 240; // streets run from -240 to +240 on both axes

const PALETTE = ['#c96f4a', '#d9a05b', '#7fa3b8', '#b8c4c9', '#e0cfa8', '#9db08a', '#c9a0a0', '#8a9bb0'];

export function buildCity(THREE, scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const streets = [];
  for (let i = 0; i <= 12; i++) streets.push(-CITY_EXTENT + i * STREET_STEP);

  // --- ground: sidewalk base, road strips, beach, sea
  const groundMat = new THREE.MeshLambertMaterial({ map: makeSidewalkTexture(THREE) });
  const groundTex = groundMat.map; groundTex.repeat.set(40, 40);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -10); scene.add(ground);

  const roadTex = makeRoadTexture(THREE);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const s of streets) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(520, STREET_HALF * 2), roadMat.clone());
    rx.material.map = roadTex.clone(); rx.material.map.needsUpdate = true;
    rx.material.map.repeat.set(13, 1);
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.02, s); scene.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(STREET_HALF * 2, 520), roadMat.clone());
    rz.material.map = roadTex.clone(); rz.material.map.needsUpdate = true;
    rz.material.map.repeat.set(1, 13);
    rz.rotation.x = -Math.PI / 2; rz.position.set(s, 0.02, 0); scene.add(rz);
  }

  // beach (south) and sea
  const beachMat = new THREE.MeshLambertMaterial({ map: makeBeachTexture(THREE) });
  beachMat.map.repeat.set(10, 2);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(560, 60), beachMat);
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.01, 280); scene.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 260),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, 440); scene.add(sea);

  // --- buildings: one per block, a second small one on some blocks
  const facadeMats = PALETTE.map((c) => new THREE.MeshLambertMaterial({
    map: makeBuildingTexture(THREE, mulberry32(Math.floor(rng() * 1e9)), c, 6 + Math.floor(rng() * 10)),
  }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const special = {
    garage: { ix: 4, iz: 5 },   // Mara's garage, mission hub
    park: { ix: 7, iz: 7 },     // green park, no buildings
    plaza: { ix: 6, iz: 5 },    // open plaza
  };
  let buildingCount = 0;
  const blockCenter = (i) => -CITY_EXTENT + STREET_STEP / 2 + i * STREET_STEP;
  for (let ix = 0; ix < 12; ix++) {
    for (let iz = 0; iz < 12; iz++) {
      const cx = blockCenter(ix), cz = blockCenter(iz);
      const isSpecial = Object.values(special).some((s) => s.ix === ix && s.iz === iz);
      if (isSpecial) continue;
      if (cz > 200) continue; // beach blocks stay open
      const h = range(rng, 9, 52);
      const w = range(rng, 16, 26), d = range(rng, 16, 26);
      const ox = range(rng, -3, 3), oz = range(rng, -3, 3);
      const mesh = new THREE.Mesh(boxGeo, pick(rng, facadeMats));
      mesh.scale.set(w, h, d);
      mesh.position.set(cx + ox, h / 2, cz + oz);
      scene.add(mesh);
      colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      buildingCount++;
      if (rng() < 0.3) { // second, smaller building on the same block
        const h2 = range(rng, 6, 16), w2 = range(rng, 8, 12), d2 = range(rng, 8, 12);
        const m2 = new THREE.Mesh(boxGeo, pick(rng, facadeMats));
        const px = cx - ox, pz = cz - oz;
        m2.scale.set(w2, h2, d2);
        m2.position.set(px, h2 / 2, pz);
        scene.add(m2);
        colliders.push({ minX: px - w2 / 2, maxX: px + w2 / 2, minZ: pz - d2 / 2, maxZ: pz + d2 / 2 });
        buildingCount++;
      }
    }
  }

  // --- Mara's garage (low wide building + sign post)
  const gx = blockCenter(special.garage.ix), gz = blockCenter(special.garage.iz);
  const garage = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x3a6ea5 }));
  garage.scale.set(26, 7, 18); garage.position.set(gx, 3.5, gz); scene.add(garage);
  colliders.push({ minX: gx - 13, maxX: gx + 13, minZ: gz - 9, maxZ: gz + 9 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 0.5), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
  sign.position.set(gx, 8.2, gz + 9.2); scene.add(sign);

  // --- park: trees + benches
  const px = blockCenter(special.park.ix), pz = blockCenter(special.park.iz);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const leafGeo = new THREE.SphereGeometry(2.4, 8, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7d3a });
  for (let i = 0; i < 10; i++) {
    const tx = px + range(rng, -12, 12), tz = pz + range(rng, -12, 12);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.set(tx, 1.5, tz); scene.add(trunk);
    const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.set(tx, 4.2, tz); scene.add(leaf);
  }
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0x5d9b4d }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(px, 0.03, pz); scene.add(grass);

  // --- harbor: crates and containers along the beach road
  const crateGeo = new THREE.BoxGeometry(1, 1, 1);
  const crateMats = [0xd95f43, 0x3f7d9e, 0xd9a441].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 14; i++) {
    const s = range(rng, 1.5, 3);
    const crate = new THREE.Mesh(crateGeo, pick(rng, crateMats));
    crate.scale.set(s, s, s);
    const cx2 = -160 + i * 26 + range(rng, -4, 4);
    crate.position.set(cx2, s / 2, 232 + range(rng, -6, 6));
    crate.rotation.y = range(rng, 0, Math.PI);
    scene.add(crate);
    colliders.push({ minX: cx2 - s / 2, maxX: cx2 + s / 2, minZ: 232 - s / 2, maxZ: 232 + s / 2 });
  }

  // --- streetlights at every other intersection
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333a42 });
  const lampGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
  for (let ix = 0; ix <= 12; ix += 2) {
    for (let iz = 0; iz <= 12; iz += 2) {
      const lx = streets[ix] + 6, lz = streets[iz] + 6;
      const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(lx, 3, lz); scene.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat); lamp.position.set(lx, 6.2, lz); scene.add(lamp);
    }
  }

  // --- palms along the beach
  const palmTrunk = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x7a5a35 });
  const palmLeaf = new THREE.ConeGeometry(2.2, 1.6, 6);
  const palmLeafMat = new THREE.MeshLambertMaterial({ color: 0x2f7d46 });
  for (let i = 0; i < 14; i++) {
    const x = -240 + i * 37 + range(rng, -6, 6);
    const trunk = new THREE.Mesh(palmTrunk, palmMat); trunk.position.set(x, 3.5, 258); scene.add(trunk);
    const leaf = new THREE.Mesh(palmLeaf, palmLeafMat); leaf.position.set(x, 7.6, 258); scene.add(leaf);
  }

  // --- sky, sun, fog
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0x9fc8e8, 180, 620);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(120, 180, 60); scene.add(sun);

  return {
    colliders,
    streets,
    buildingCount,
    garagePos: { x: gx, z: gz + 14 },
    harborPos: { x: -40, z: 232 },
    parkPos: { x: px, z: pz },
    plazaPos: { x: blockCenter(special.plaza.ix), z: blockCenter(special.plaza.iz) },
    bounds: { minX: -260, maxX: 260, minZ: -260, maxZ: 300 },
  };
}
