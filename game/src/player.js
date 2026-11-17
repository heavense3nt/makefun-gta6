// Rico Marlowe on foot: walk/run, jump, pistol. Movement is camera-relative
// and screen-correct — the whole point of the v3 strafe fix lives here:
//
//   forward = camera rig forward()  (W moves away from the camera)
//   right   = camera rig right()    (D moves toward the camera's screen-right)
//
// In the old build the strafe vectors were swapped, so D displaced the character
// to screen-left (dot product -1.00 with screen-right). Here D adds +right, A
// adds -right, and the displacement's dot product with screen-right is +1.00 at
// every camera yaw. See camera.js verifyStrafeMath() and the in-browser test.

import { PLAYER } from './config.js';
import { collideCircle } from './city.js';

const THREE = window.THREE;

function buildBody() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e6fd8 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1410 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.18; group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.78; group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.44), hair);
  hairTop.position.y = 2.0; group.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), jeans);
  legL.position.set(-0.17, 0.39, 0); group.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), shirt);
  armL.position.set(-0.44, 1.2, 0); group.add(armL);
  const armR = armL.clone(); armR.position.x = 0.44; group.add(armR);
  // pistol held in the right hand
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  gun.position.set(0.44, 0.95, 0.22); group.add(gun);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export function createPlayer(scene, startPos) {
  const mesh = buildBody();
  mesh.position.copy(startPos);
  scene.add(mesh);
  let velY = 0;
  let grounded = true;
  let walkPhase = 0;
  let faceYaw = 0;
  let health = PLAYER.maxHealth;
  let hurtCooldown = 0;

  function step(dt, input, rig, colliders, onStep) {
    const fwd = rig.forward();
    const right = rig.right();
    const strafe = input.strafe();    // +1 when D is held
    const throttle = input.throttle(); // +1 when W is held
    // THE FIX: D adds the screen-right vector, A subtracts it. Never swapped.
    let mx = fwd.x * throttle + right.x * strafe;
    let mz = fwd.z * throttle + right.z * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.001) { mx /= len; mz /= len; }
    const speed = input.held.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const moving = len > 0.001;

    mesh.position.x += mx * speed * dt;
    mesh.position.z += mz * speed * dt;
    if (moving) {
      faceYaw = Math.atan2(mx, mz);
      walkPhase += dt * speed * 1.6;
    }
    // gravity + jump
    velY -= PLAYER.gravity * dt;
    mesh.position.y += velY * dt;
    if (mesh.position.y <= 0) { mesh.position.y = 0; velY = 0; grounded = true; }
    if (onStep?.jump && grounded) { velY = PLAYER.jumpSpeed; grounded = false; }

    // building collision (push out of AABBs)
    const push = collideCircle(colliders, mesh.position.x, mesh.position.z, PLAYER.radius);
    if (push) { mesh.position.x += push.x; mesh.position.z += push.z; }
    // stay inside the world
    mesh.position.x = Math.max(-290, Math.min(300, mesh.position.x));
    mesh.position.z = Math.max(-290, Math.min(290, mesh.position.z));

    // face movement direction, legs swing while walking
    mesh.rotation.y += (faceYaw - mesh.rotation.y) * Math.min(1, dt * 12);
    const swing = moving ? Math.sin(walkPhase) * 0.55 : 0;
    mesh.userData.legL.rotation.x = swing;
    mesh.userData.legR.rotation.x = -swing;
    mesh.userData.armL.rotation.x = -swing * 0.7;
    mesh.userData.armR.rotation.x = swing * 0.7;
    hurtCooldown = Math.max(0, hurtCooldown - dt);
    return { moving, speed: moving ? speed : 0 };
  }

  return {
    mesh,
    get pos() { return mesh.position; },
    get health() { return health; },
    get facing() { return faceYaw; },
    hurt(amount) {
      if (hurtCooldown > 0) return false;
      hurtCooldown = 0.6;
      health = Math.max(0, health - amount);
      return true;
    },
    heal(amount) { health = Math.min(PLAYER.maxHealth, health + amount); },
    setHealth(v) { health = Math.max(0, Math.min(PLAYER.maxHealth, v)); },
    teleport(x, z) { mesh.position.set(x, 0, z); velY = 0; },
    step,
  };
}
