// utils.js — small pure helpers: seeded random, angles, and the camera-relative
// movement math the whole game (and the control tests) share.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
// Shortest signed angle difference, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
// Deterministic mulberry32 RNG so the city, traffic and missions are identical
// on every load for a given seed (screenshots stay reproducible).
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function randRange(rng, a, b) { return a + rng() * (b - a); }

// --- Camera-relative movement -------------------------------------------
// camYaw is the azimuth of the CAMERA around its target: the camera sits at
// target + (sin(camYaw), 0, cos(camYaw)) * distance and looks back at the
// target. So the direction the camera looks (screen-forward) is:
//   forward = (-sin(camYaw), 0, -cos(camYaw))
// and screen-right is forward x up:
//   right   = ( cos(camYaw), 0, -sin(camYaw))
// A car whose nose points along heading h has its tail at heading + PI, so a
// camera parked behind the car uses camYaw = heading + PI.
export function cameraForward(camYaw) {
  return { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
}
export function cameraRight(camYaw) {
  return { x: Math.cos(camYaw), z: -Math.sin(camYaw) };
}
// Movement from input: ix = +1 when D (right) is held, -1 for A; iz = +1 for
// W (forward), -1 for S. The result is normalised (or zero when idle).
// Pressing D alone MUST give a direction whose dot product with the camera's
// screen-right vector is exactly +1 at every yaw.
export function moveDirection(camYaw, ix, iz) {
  const f = cameraForward(camYaw);
  const r = cameraRight(camYaw);
  let x = f.x * iz + r.x * ix;
  let z = f.z * iz + r.z * ix;
  const len = Math.hypot(x, z);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}
// Heading (atan2-style, x first) of a 2D direction, matching car heading.
export function headingOf(x, z) { return Math.atan2(x, z); }
// Distance on the XZ plane.
export function dist2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
