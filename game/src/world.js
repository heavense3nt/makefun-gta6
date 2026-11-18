// VELDORA v7 — the city itself: layout data only, no three.js here.
// Solmar Bay: a road grid, ~180 buildings, a beach and a marina. Seeded, so
// every run builds the same city.
import { CITY } from './config.js';
import { mulberry32, range, intRange, pick, chance } from './random.js';

const PALETTE = ['#5a6b8a', '#7a6a8a', '#8a6a5a', '#5a7a6a', '#6a7a8a', '#8a7a5a', '#4a5a7a', '#9a8a6a'];

export function generateCity(seed) {
  const rng = mulberry32(seed);
  const roads = [];
  for (let v = -105; v <= 105; v += 30) roads.push(v);
  const buildings = [];
  // Blocks between neighbouring roads; a couple of blocks stay open as a
  // plaza and a park so the city breathes.
  const openBlocks = new Set(['-1,0', '0,-1']);
  for (let bx = 0; bx < roads.length - 1; bx++) {
    for (let bz = 0; bz < roads.length - 1; bz++) {
      const key = `${bx - 3},${bz - 3}`;
      const x0 = roads[bx] + CITY.roadHalf + 2;
      const x1 = roads[bx + 1] - CITY.roadHalf - 2;
      const z0 = roads[bz] + CITY.roadHalf + 2;
      const z1 = roads[bz + 1] - CITY.roadHalf - 2;
      if (openBlocks.has(key)) continue;
      const count = intRange(rng, 3, 4);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 7, 11);
        const d = range(rng, 7, 11);
        const x = range(rng, x0 + w / 2, x1 - w / 2);
        const z = range(rng, z0 + d / 2, z1 - d / 2);
        const h = chance(rng, 0.14) ? range(rng, 26, 44) : range(rng, 8, 22);
        buildings.push({ x, z, w, d, h, color: pick(rng, PALETTE), lit: range(rng, 0.25, 0.7), roof: chance(rng, 0.3) });
      }
    }
  }
  // Traffic loops: rectangles around a few blocks, driven clockwise.
  const loops = [];
  for (const [cx, cz] of [[-60, -60], [0, 30], [60, -30], [-30, 60], [30, 0]]) {
    loops.push([
      { x: cx - 15, z: cz - 15 }, { x: cx + 15, z: cz - 15 },
      { x: cx + 15, z: cz + 15 }, { x: cx - 15, z: cz + 15 },
    ]);
  }
  // Landmarks the missions use.
  const landmarks = {
    plaza: { x: 0, z: 0 },
    marina: { x: 112, z: -30 },
    pier: { x: 150, z: -30 },
    bank: { x: -15, z: -45 },
    showroom: { x: 45, z: 15 },
    arcade: { x: -45, z: 45 },
    alley: { x: -52, z: 52 },
    taxiStand: { x: 15, z: 15 },
    hideout: { x: -90, z: 90 },
  };
  // Street props: palms along the beach, lamps along every road, benches.
  const palms = [];
  for (let z = -105; z <= 105; z += 15) palms.push({ x: 112, z: z + range(rng, -4, 4) });
  const lamps = [];
  for (const v of roads) {
    for (let u = -105; u <= 105; u += 30) {
      lamps.push({ x: v + 5, z: u });
      lamps.push({ x: u, z: v + 5 });
    }
  }
  const benches = [];
  for (let i = 0; i < 14; i++) benches.push({ x: range(rng, -100, 100), z: range(rng, -100, 100) });
  return { buildings, roads, loops, landmarks, palms, lamps, benches, seed };
}

// Circle (player / car) vs building AABBs: push the circle out, return true on hit.
export function collideBuildings(city, x, z, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
    const cz = Math.max(b.z - b.d / 2, Math.min(z, b.z + b.d / 2));
    const dx = x - cx; const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) hit = true;
  }
  return hit;
}

// Resolve a circle out of building AABBs in place; returns the corrected position.
export function resolveBuildings(city, pos, radius) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x - b.w / 2, Math.min(pos.x, b.x + b.w / 2));
    const cz = Math.max(b.z - b.d / 2, Math.min(pos.z, b.z + b.d / 2));
    const dx = pos.x - cx; const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
    } else {
      // Dead centre: push out along the smallest penetration axis.
      const px = Math.min(pos.x - (b.x - b.w / 2), (b.x + b.w / 2) - pos.x);
      const pz = Math.min(pos.z - (b.z - b.d / 2), (b.z + b.d / 2) - pos.z);
      if (px < pz) pos.x = pos.x < b.x ? b.x - b.w / 2 - radius : b.x + b.w / 2 + radius;
      else pos.z = pos.z < b.z ? b.z - b.d / 2 - radius : b.z + b.d / 2 + radius;
    }
  }
  return pos;
}

export function clampToCity(x, z) {
  const m = CITY.half + 8;
  return { x: Math.max(-m, Math.min(m, x)), z: Math.max(-m, Math.min(m, z)) };
}
