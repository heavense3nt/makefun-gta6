// VELDORA v7 — small math helpers shared by every system.
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Wrap an angle to [-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx; const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Camera-relative screen-right unit vector for a camera yaw.
// With yaw measured so forward = (sin(yaw), 0, cos(yaw)) ... see camera.js:
// forward = (-sin(camYaw), 0, -cos(camYaw)), so right = (-cos(camYaw), 0, sin(camYaw)).
export function screenRight(camYaw) {
  return { x: -Math.cos(camYaw), z: Math.sin(camYaw) };
}

export function screenForward(camYaw) {
  return { x: -Math.sin(camYaw), z: -Math.cos(camYaw) };
}

// Dot product of a movement direction with the camera screen-right vector.
// Must be +1.00 when the player presses D at any camera yaw (strafe fix).
export function strafeDot(moveX, moveZ, camYaw) {
  const r = screenRight(camYaw);
  return moveX * r.x + moveZ * r.z;
}
