// VELDORA — shared utilities: seeded random, math helpers, the global game namespace.
// Every game file attaches its pieces to V (window.VELDORA) so the classic scripts
// can share state without modules.

const V = window.VELDORA = window.VELDORA || {};

/** mulberry32 — a tiny deterministic PRNG so screenshot scenes reproduce exactly. */
V.makeRng = function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Clamp a number into [lo, hi]. */
V.clamp = function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); };

/** Linear interpolation. */
V.lerp = function lerp(a, b, t) { return a + (b - a) * t; };

/** Shortest signed angle difference, in radians. */
V.angleDiff = function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Move angle `a` toward `b` by at most `step` radians. */
V.angleToward = function angleToward(a, b, step) {
  const d = V.angleDiff(b, a);
  if (Math.abs(d) <= step) return b;
  return a + Math.sign(d) * step;
};

/** Pick one element of an array with the given rng. */
V.pick = function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; };

/** Random float in [lo, hi). */
V.range = function range(rng, lo, hi) { return lo + rng() * (hi - lo); };

/** Random integer in [lo, hi]. */
V.rangeInt = function rangeInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); };

/** Format a cash amount like $1,250. */
V.money = function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); };

/** Format seconds as M:SS. */
V.clock = function clock(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

/** Distance on the ground plane between two {x,z} points. */
V.dist2d = function dist2d(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
};

/** A small vector pool: reuse objects to avoid per-frame garbage. */
V.tmpVec = function tmpVec() { return new THREE.Vector3(); };
