// VELDORA config: every tunable number of the game lives here, so the rest of the
// code reads like the design doc instead of a pile of magic numbers.
// The city is deterministic: one seeded generator builds the same streets, towers
// and palms on every load, so a save or a screenshot always finds the same Veldora.

export const CITY = {
  blockPitch: 56,      // centre-to-centre distance of city blocks
  blocks: 4,           // blocks from -4..4 on each axis
  roadWidth: 12,
  buildingTarget: 180, // how many towers the generator aims to raise
  beachX: 232,         // sand starts here; the sea runs east of it
  seaX: 268,
  worldRadius: 300,    // minimap / police / despawn horizon
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.55,
  maxHealth: 100,
};

export const CAR = {
  accel: 26,
  brake: 42,
  reverseAccel: 14,
  maxSpeed: 46,        // m/s, sports cars go faster (see vehicles.js)
  maxReverse: 12,
  steerRate: 1.9,      // rad/s at full lock, scaled down with speed
  drag: 0.55,
  enterRadius: 4.2,
};

export const WANTED = {
  maxStars: 5,
  stealCar: 1,
  shoot: 1,
  runOverPed: 2,
  killCop: 2,
  decaySeconds: 18,    // one star fades after this long with no new crime
  bustedFine: 150,
};

export const MISSIONS = [
  { id: 1, name: 'First Fare', reward: 200,
    blurb: 'A nervous courier waits at the plaza. Drive him to the marina before he loses his nerve.' },
  { id: 2, name: 'Hot Wheels', reward: 400,
    blurb: 'A sunset-orange Comet GT is parked by the Spire. Take it. Deliver it to the garage on Dock Street.' },
  { id: 3, name: 'The Drop', reward: 600,
    blurb: 'Grab the package from the alley, then run it to the beach hut. The cops will be watching.' },
  { id: 4, name: 'Payback', reward: 800,
    blurb: 'Three Dock Rats are leaning on your old crew at the fish market. Settle it — loud or quiet.' },
  { id: 5, name: 'King of Veldora', reward: 1500,
    blurb: 'One sprint, five checkpoints, ninety seconds. Beat the clock and the coast is yours.' },
];

// Deterministic RNG (mulberry32) so the city, traffic paint and pedestrians are
// identical on every load and every screenshot.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export const PALETTE = {
  skyTop: 0x2f7fc9, skyBottom: 0xffe3b3, sun: 0xfff2c8,
  asphalt: 0x2e3138, sidewalk: 0x9aa0a8, sand: 0xe8cf9a, sea: 0x1e7fa8,
  seaDeep: 0x0d5a80, grass: 0x5da24a,
  towerGlass: [0x7fb4d8, 0x9cc8e8, 0x6fa8c8, 0xa8cce0],
  towerWarm: [0xe8b98a, 0xd8a070, 0xc98f6a, 0xe0c090],
  carPaint: [0xd8382e, 0x2e6fd8, 0xf2c230, 0x38b24a, 0x8a5fd0, 0xe8e8e8, 0x222226, 0xff7f2a],
  policePaint: 0x1c2f4a, taxiPaint: 0xf2c230,
};
