// VELDORA city: a procedural sun-soaked coastal city built from one seeded
// generator — ~180 towers, a road grid, a beach and a sea, plus landmarks the
// player can navigate by (the Spire, the lighthouse, the marina, the stadium).
// Every building also registers an AABB collider the player, cars and peds use.

import { CITY, PALETTE, makeRng, pick } from './config.js';

const THREE = window.THREE;

function windowTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      g.fillStyle = rng() < litRatio ? '#ffe9a8' : 'rgba(20,30,44,0.85)';
      g.fillRect(x, y, 6, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const mat = opts.material ?? new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (opts.ry) mesh.rotation.y = opts.ry;
  return mesh;
}

export function createCity(scene) {
  const rng = makeRng(20261117);
  const colliders = [];   // { minX, maxX, minZ, maxZ }
  const carSpawns = [];   // { x, z, heading } parked-car spots on road edges
  const landmarks = {};
  const group = new THREE.Group();
  scene.add(group);

  // ---- ground: grass base, asphalt roads, sand beach, sea ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(60, -0.05, 0);
  group.add(ground);

  const pitch = CITY.blockPitch;
  const half = CITY.blocks * pitch + CITY.roadWidth / 2;
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (let i = -CITY.blocks; i <= CITY.blocks; i += 1) {
    const c = i * pitch;
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, half * 2), roadMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0, 0); group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CITY.roadWidth), roadMat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.01, c); group.add(ew);
    // dashed centre lines
    for (let d = -half + 8; d < half; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), new THREE.MeshBasicMaterial({ color: 0xf2e9c8 }));
      dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.02, d); group.add(dash);
    }
  }
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 620),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(CITY.beachX + 130, 0.02, 0);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 900),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(CITY.seaX + 340, -0.4, 0);
  group.add(sea);

  // ---- buildings: fill every block with 1-3 towers ----
  // Landmark exclusion zones keep towers out of the Spire and stadium lots.
  const EXCLUDE = [{ x: 28, z: -84, r: 18 }, { x: 196, z: -84, r: 36 }];
  const glassMats = PALETTE.towerGlass.map((c) => new THREE.MeshLambertMaterial({ map: windowTexture(rng, '#5a7ea0', 0.22), color: c }));
  const warmMats = PALETTE.towerWarm.map((c) => new THREE.MeshLambertMaterial({ map: windowTexture(rng, '#c08a5e', 0.16), color: c }));
  let built = 0;
  const plaza = { bx: 0, bz: 0 }; // central plaza block stays open
  for (let bx = -CITY.blocks; bx <= CITY.blocks; bx += 1) {
    for (let bz = -CITY.blocks; bz <= CITY.blocks; bz += 1) {
      if (bx === plaza.bx && bz === plaza.bz) continue;
      if (bx === 3 && bz === -2) continue; // stadium lot
      if (bx === -3 && bz === 2) continue; // park lot
      const cx = bx * pitch;
      const cz = bz * pitch;
      // Towers stand at the block's corners, in the band between the road edge
      // (6) and the block edge (22): a tower 10-16 wide centred 14 out leaves
      // the roads themselves clear, so cars can drive every avenue end to end.
      const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (let i = corners.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [corners[i], corners[j]] = [corners[j], corners[i]];
      }
      const count = Math.min(4, 2 + Math.floor(rng() * 2));
      for (let k = 0; k < count && built < CITY.buildingTarget; k += 1) {
        const w = 10 + rng() * 6;
        const d = 10 + rng() * 6;
        const h = 10 + rng() * rng() * 55;
        const [sx, sz] = corners[k];
        const ox = sx * (14 + (rng() - 0.5) * Math.max(0, 12 - w));
        const oz = sz * (14 + (rng() - 0.5) * Math.max(0, 12 - d));
        const x = cx + ox;
        const z = cz + oz;
        let blocked = false;
        for (const e of EXCLUDE) {
          if (Math.hypot(x - e.x, z - e.z) < e.r + Math.max(w, d) / 2) { blocked = true; break; }
        }
        if (blocked) continue;
        const mat = rng() < 0.55 ? pick(rng, glassMats) : pick(rng, warmMats);
        const tower = box(w, h, d, 0, x, h / 2, z, { material: mat });
        group.add(tower);
        // rooftop rim
        const rim = box(w + 0.6, 0.8, d + 0.6, 0x3a3f47, x, h + 0.4, z);
        group.add(rim);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        built += 1;
      }
    }
  }

  // ---- landmarks ----
  // Veldora Spire: the tallest tower, set back in its own lot off the avenue
  // (never on a road — the avenue must stay drivable), with a lit crown.
  const spire = box(22, 95, 22, 0, 28, 47.5, -84, {
    material: new THREE.MeshLambertMaterial({ map: windowTexture(rng, '#7a9cc0', 0.3), color: 0xbfd8ee }),
  });
  group.add(spire);
  const crown = box(24, 4, 24, 0xffd23e, 28, 97, -84);
  group.add(crown);
  colliders.push({ minX: 17, maxX: 39, minZ: -95, maxZ: -73 });
  landmarks.spire = new THREE.Vector3(28, 0, -84);

  // Lighthouse at the end of the marina pier.
  const pier = box(8, 2, 90, 0x8a7a5e, CITY.seaX + 6, 1, 40);
  group.add(pier);
  const light = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4, 26, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  light.position.set(CITY.seaX + 6, 15, 82);
  group.add(light);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe98a }),
  );
  lamp.position.set(CITY.seaX + 6, 29, 82);
  group.add(lamp);
  landmarks.lighthouse = new THREE.Vector3(CITY.seaX + 6, 0, 82);
  landmarks.marina = new THREE.Vector3(CITY.seaX - 10, 0, 40);

  // Stadium bowl on its own lot east of the avenue, clear of the roads.
  const stadium = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 30, 12, 20),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  stadium.position.set(196, 6, -84);
  group.add(stadium);
  colliders.push({ minX: 174, maxX: 218, minZ: -106, maxZ: -62 });
  landmarks.stadium = new THREE.Vector3(196, 0, -84);

  // Central plaza: fountain + palms + benches.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.6, 18),
    new THREE.MeshLambertMaterial({ color: 0x9cc8e8 }),
  );
  fountain.position.set(0, 0.8, 0);
  group.add(fountain);
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 2.2, 5, 8),
    new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.7 }),
  );
  jet.position.set(0, 4, 0);
  group.add(jet);
  landmarks.plaza = new THREE.Vector3(0, 0, 0);

  // Palm trees along the beach and plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4a });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 7), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = (rng() - 0.5) * 0.16;
    group.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const leaf = box(0.3, 0.15, 4.4, 0, x, 7.2, z, { material: leafMat, ry: (i / 6) * Math.PI * 2 });
      leaf.position.x += Math.sin((i / 6) * Math.PI * 2) * 1.8;
      leaf.position.z += Math.cos((i / 6) * Math.PI * 2) * 1.8;
      leaf.rotation.x = 0.35;
      group.add(leaf);
    }
  }
  for (let z = -240; z <= 240; z += 28) palm(CITY.beachX - 6 + rng() * 4, z);
  // Plaza palms in a ring around the fountain, clear of the north-south vista
  // so the cover shot looks down the avenue at the Spire, not at a trunk.
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 + rng() * 0.4;
    const r = 17 + rng() * 5;
    palm(Math.sin(a) * r, Math.cos(a) * r);
  }

  // Street lights along the main avenue.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let z = -220; z <= 220; z += 56) {
    for (const sx of [-8, 8]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(sx, 3.5, z);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(sx, 7.2, z);
      group.add(bulb);
    }
  }

  // Park lot: trees.
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x3a7a34 });
  for (let i = 0; i < 14; i += 1) {
    const x = -3 * pitch + (rng() - 0.5) * 34;
    const z = 2 * pitch + (rng() - 0.5) * 34;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), trunkMat);
    trunk.position.set(x, 1.5, z); group.add(trunk);
    const crownMesh = new THREE.Mesh(new THREE.SphereGeometry(2.6 + rng() * 1.4, 8, 6), treeMat);
    crownMesh.position.set(x, 4.6, z); group.add(crownMesh);
  }
  landmarks.park = new THREE.Vector3(-3 * pitch, 0, 2 * pitch);
  landmarks.garage = new THREE.Vector3(-2 * pitch, 0, 3 * pitch);
  landmarks.fishMarket = new THREE.Vector3(pitch, 0, 3 * pitch);
  landmarks.beachHut = new THREE.Vector3(CITY.beachX - 4, 0, -60);
  landmarks.alley = new THREE.Vector3(-56, 0, -100); // on the north-south road, clear of towers

  // Parked-car spots: along road edges, clear of intersections.
  for (let i = 0; i < 26; i += 1) {
    const alongRoad = rng() < 0.5;
    const line = (Math.floor(rng() * 9) - 4) * pitch;
    const t = (rng() * 2 - 1) * 200;
    const side = rng() < 0.5 ? -1 : 1;
    if (alongRoad) carSpawns.push({ x: line + side * 8.5, z: t, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    else carSpawns.push({ x: t, z: line + side * 8.5, heading: side > 0 ? 0 : Math.PI });
  }

  return { group, colliders, carSpawns, landmarks, buildingCount: built };
}

// AABB test: is the circle (x, z, radius) inside any collider? If so, return the
// push-out correction on the axis of least penetration.
export function collideCircle(colliders, x, z, radius) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        return { x: (dx / d) * (radius - d), z: (dz / d) * (radius - d) };
      }
      // centre inside the box: push out on the shallowest axis
      const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) return { x: -(pl + radius), z: 0 };
      if (m === pr) return { x: pr + radius, z: 0 };
      if (m === pt) return { x: 0, z: -(pt + radius) };
      return { x: 0, z: pb + radius };
    }
  }
  return null;
}
