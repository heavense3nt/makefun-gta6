// VELDORA v7 — Solmar Bay: all tuning numbers in one place.
// A coastal open-world crime game: city, traffic, police, missions.
export const CITY = {
  half: 120, // city spans x,z in [-120, 120]
  beachX: 108, // sand strip starts here, ocean beyond x = 132
  oceanX: 132,
  block: 30, // road spacing
  roadHalf: 4, // half width of a road
};

export const PLAYER = {
  radius: 0.55,
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  accel: 42,
  jumpSpeed: 8.5,
  gravity: 24,
  maxHealth: 100,
  maxArmor: 100,
};

export const CAR = {
  accel: 26,
  brake: 34,
  maxSpeed: 34,
  reverseMax: 10,
  turnRate: 2.1,
  grip: 6,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 14, // unseen time to drop one star
  bustRadius: 2.6,
  bustSeconds: 2.2,
};

export const MISSIONS = [
  { id: 1, name: 'First Fare', brief: 'Drive the taxi to the marina pickup.' },
  { id: 2, name: 'The Pickup', brief: 'Collect the package from the alley behind the arcade.' },
  { id: 3, name: 'Hot Wheels', brief: 'Steal the red sports car from the showroom lot.' },
  { id: 4, name: 'Heat Wave', brief: 'Lose a 3-star wanted level — stay out of sight.' },
  { id: 5, name: 'The Big Score', brief: 'Hit the bank vault, grab the cash, lose the heat.' },
];

export const COLORS = {
  duskSky: 0x2a2f55,
  duskFog: 0x3a3f66,
  sun: 0xffb36b,
  sea: 0x14586b,
  sand: 0xc9a86a,
  asphalt: 0x23262e,
};

export const SHOT = { width: 1280, height: 800 };
