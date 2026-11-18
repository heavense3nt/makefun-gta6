// config.js — every tunable number for VELDORA in one place.
export const CONFIG = {
  seed: 20261118,
  // City: a grid of blocks. ROAD = street width, BLOCK = block size, N = blocks per side.
  cityBlocks: 8,
  blockSize: 46,
  roadWidth: 14,
  // Building counts: downtown core is tall, the coast is low.
  buildingTarget: 182,
  // Player
  walkSpeed: 7.2,
  sprintSpeed: 11.5,
  playerRadius: 0.55,
  playerHealth: 100,
  // Driving
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 46,
  carReverseMax: 12,
  carTurnRate: 1.9,
  carGrip: 6.5,
  // Wanted / police
  maxWanted: 5,
  policeCarsPerStar: 2,
  policeTopSpeed: 40,
  wantedDecaySeconds: 26,
  // Combat
  pistolDamage: 34,
  pistolRange: 60,
  pistolAmmo: 12,
  // World life
  trafficCars: 14,
  pedestrians: 26,
  // Camera
  camDistance: 8.5,
  camHeight: 3.6,
  camMinDistance: 5,
  camMaxDistance: 16,
  // Economy
  startCash: 250,
  missionRewards: [600, 900, 1500, 2200, 5000],
};
export const CITY = (() => {
  const n = CONFIG.cityBlocks;
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;
  const half = (n * pitch) / 2;
  return { pitch, half, size: n * pitch };
})();
// Palette of the city: sun-soaked pastel stucco, terracotta roofs, teal sea.
export const PALETTE = {
  sky: 0x8ec9ee,
  sun: 0xfff2c8,
  ground: 0x9a8f7a,
  road: 0x33363d,
  roadLine: 0xd8d3c0,
  sidewalk: 0xb8b0a0,
  sand: 0xe8d29a,
  sea: 0x1f7fa8,
  seaDeep: 0x0e5a80,
  buildingColors: [0xe8dcc8, 0xf2e3c8, 0xd8c2a8, 0xc8d8e0, 0xe8c8b8, 0xd8d8c8, 0xf0d8a8, 0xc8b8d8],
  roofColors: [0xb85c38, 0x8a5a3a, 0x5a6a7a, 0x9a4a3a, 0x6a7a5a],
  windowLit: 0xffe9a8,
  windowDark: 0x2a3548,
  palmTrunk: 0x7a5a38,
  palmLeaf: 0x2f8f4a,
};
