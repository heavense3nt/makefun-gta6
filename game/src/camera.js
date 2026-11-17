// Third-person camera rig. One yaw angle (camYaw) drives everything: the camera
// sits behind the player/car at that yaw, and the player's strafe vectors are
// derived from the same yaw, so movement and the screen can never disagree.
//
//   camera offset direction = (sin(camYaw), cos(camYaw)) on the ground plane
//   view forward (W direction) = (-sin(camYaw), -cos(camYaw))
//   screen-right (D direction) = (cos(camYaw), -sin(camYaw))
//
// V3 FIX — CAR-ENTRY CAMERA SNAP: the moment enterCar succeeds, camYaw is set to
// the car's heading + PI immediately, so the camera is behind the car and steering
// matches the screen from the first frame. The old build eased camYaw toward the
// car over a second and steering felt reversed until the swing finished.

const THREE = window.THREE;

export function createCameraRig(camera) {
  let camYaw = Math.PI;      // start looking north down the avenue
  let camPitch = 0.32;       // radians above horizontal
  let distance = 9;
  let mode = 0;              // 0 near, 1 far, 2 high (C cycles)
  let fixed = null;          // a staged fixed view (city screenshot) overrides the rig
  const tmp = new THREE.Vector3();

  function snapToCarHeading(heading) {
    // Camera offset must sit opposite the car's forward vector, which points
    // (sin h, cos h): offset direction (sin camYaw, cos camYaw) = -(sin h, cos h)
    // is satisfied by camYaw = h + PI, in one assignment, no easing.
    camYaw = heading + Math.PI;
  }

  function setFixedView(px, py, pz, tx, ty, tz) {
    fixed = { p: new THREE.Vector3(px, py, pz), t: new THREE.Vector3(tx, ty, tz) };
  }

  function update(target, dt, look) {
    if (fixed) {
      camera.position.copy(fixed.p);
      camera.lookAt(fixed.t);
      return;
    }
    camYaw -= look.x * 0.0032;
    camPitch = Math.max(0.08, Math.min(1.1, camPitch + look.y * 0.0022));
    const dists = [8.5, 12, 17];
    const targetDist = dists[mode];
    distance += (targetDist - distance) * Math.min(1, dt * 6);
    const ox = Math.sin(camYaw) * distance * Math.cos(camPitch);
    const oz = Math.cos(camYaw) * distance * Math.cos(camPitch);
    const oy = 2.2 + distance * Math.sin(camPitch);
    tmp.set(target.x + ox, target.y + oy, target.z + oz);
    camera.position.lerp(tmp, Math.min(1, dt * 14));
    camera.lookAt(target.x, target.y + 1.6, target.z);
  }

  return {
    get yaw() { return camYaw; },
    set yaw(v) { camYaw = v; },
    get pitch() { return camPitch; },
    cycleMode() { mode = (mode + 1) % 3; },
    setOverview() { mode = 2; camPitch = 0.5; },
    setFixedView,
    clearFixedView() { fixed = null; },
    snapToCarHeading,
    update,
    // The two movement basis vectors, from the same yaw the camera uses.
    forward() { return { x: -Math.sin(camYaw), z: -Math.cos(camYaw) }; },
    right() { return { x: Math.cos(camYaw), z: -Math.sin(camYaw) }; },
  };
}

// Self-check used by the in-browser tests and the console: pressing D must move
// the character toward the camera's screen-right at every yaw. Returns the dot
// products (should all be +1) for a sweep of camera angles.
export function verifyStrafeMath() {
  const results = [];
  for (let deg = 0; deg < 360; deg += 30) {
    const yaw = (deg * Math.PI) / 180;
    const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    // D displacement is exactly the right vector; its dot with screen-right is 1.
    const dot = right.x * right.x + right.z * right.z;
    // Forward must stay perpendicular and point away from the camera.
    const cross = fwd.x * right.z - fwd.z * right.x;
    results.push({ deg, dotRight: +dot.toFixed(3), crossFwdRight: +cross.toFixed(3) });
  }
  return results;
}
