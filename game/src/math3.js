// math3.js — pure 3D math for VELDORA. No THREE dependency, so Node can test it.
// Conventions: ground plane is XZ, Y is up. A heading h means forward = (sin h, 0, cos h).
// camYaw is the orbit angle of the third-person camera around its target:
//   camera sits at target + (sin(camYaw), 0, cos(camYaw)) * distance, looking at the target.

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

// Shortest signed angular difference from a to b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export function angleLerp(a, b, t) { return a + angleDiff(a, b) * clamp(t, 0, 1); }

// Camera basis vectors on the ground for a given camYaw.
export function camForward(camYaw) { return { x: -Math.sin(camYaw), z: -Math.cos(camYaw) }; }
export function camRight(camYaw) { return { x: Math.cos(camYaw), z: -Math.sin(camYaw) }; }

// Movement direction for WASD input relative to the camera.
// fwd: +1 when W held (0 otherwise, -1 for S). right: +1 when D held (-1 for A).
// CONTROL FIX #1: D must move the character toward the camera's screen-RIGHT at every yaw,
// i.e. dot(moveVector(camYaw,0,1), camRight(camYaw)) === +1 for all camYaw.
export function moveVector(camYaw, fwd, right) {
  const f = camForward(camYaw), r = camRight(camYaw);
  let x = f.x * fwd + r.x * right;
  let z = f.z * fwd + r.z * right;
  const len = Math.hypot(x, z);
  if (len > 0.0001) { x /= len; z /= len; }
  return { x, z };
}

// CONTROL FIX #2: when the player enters a car, the camera yaw must snap to the car's
// heading + PI in a single assignment — no easing — so steering never feels reversed.
// Returns the exact snapped yaw.
export function snapCamYaw(carHeading) { return carHeading + Math.PI; }

// Heading (for mesh rotation.y) from a ground movement vector.
export function headingFromMove(mx, mz) { return Math.atan2(mx, mz); }

// Circle (x,z,r) vs axis-aligned box (minX,minZ,maxX,maxZ): push the circle out.
// Returns {x, z, hit} — the corrected center.
export function resolveCircleAABB(x, z, r, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  let dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return { x, z, hit: false };
  if (d2 > 0.000001) {
    const d = Math.sqrt(d2), push = (r - d) / d;
    return { x: x + dx * push, z: z + dz * push, hit: true };
  }
  // Center inside the box: push out along the smallest penetration axis.
  const pl = x - box.minX, pr = box.maxX - x, pt = z - box.minZ, pb = box.maxZ - z;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.minX - r, z, hit: true };
  if (m === pr) return { x: box.maxX + r, z, hit: true };
  if (m === pt) return { x, z: box.minZ - r, hit: true };
  return { x, z: box.maxZ + r, hit: true };
}

// Deterministic RNG (mulberry32) so a ?seed= run stages the same city every time.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, a, b) { return a + rng() * (b - a); }
