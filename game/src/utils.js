// VELDORA v6 — small math helpers used by every system.
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function angleDiff(a, b) { return wrapAngle(a - b); }
export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
// Camera basis: the camera sits behind the player at camYaw and looks toward it.
// view forward = (-sin(camYaw), 0, -cos(camYaw)); screen-right = (cos(camYaw), 0, -sin(camYaw)).
export function cameraForward(camYaw) { return { x: -Math.sin(camYaw), z: -Math.cos(camYaw) }; }
export function cameraRight(camYaw) { return { x: Math.cos(camYaw), z: -Math.sin(camYaw) }; }
// Move direction for on-foot input: W = forward, D = screen-right, so D always dots +1 with screen-right.
export function moveDirection(camYaw, forwardInput, strafeInput) {
  const f = cameraForward(camYaw);
  const r = cameraRight(camYaw);
  const x = f.x * forwardInput + r.x * strafeInput;
  const z = f.z * forwardInput + r.z * strafeInput;
  const len = Math.hypot(x, z);
  if (len < 0.001) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}
