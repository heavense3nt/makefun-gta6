// The Veldora PD: a wanted level of 0–5 stars, police interceptors that chase
// the player on sight, and foot cops who move in to arrest. Get busted on foot
// and the screen goes black with a $150 fine; lose the cops or lay low and the
// stars fade one at a time.

import { WANTED, makeRng } from './config.js';

const THREE = window.THREE;

export function createPolice(scene, vehicleSystem, city) {
  const rng = makeRng(999);
  const cops = [];       // { mesh, car|null, arrestTimer }
  let stars = 0;
  let decayTimer = 0;
  let sirenWanted = false;

  function starCount() { return stars; }

  function addStars(n, onChange) {
    const before = stars;
    stars = Math.max(0, Math.min(WANTED.maxStars, stars + n));
    decayTimer = 0;
    if (stars !== before) onChange?.(stars);
    return stars;
  }

  function spawnInterceptor(playerPos) {
    const angle = rng() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * 55;
    const z = playerPos.z + Math.sin(angle) * 55;
    const car = vehicleSystem.addCar(x, z, Math.atan2(playerPos.x - x, playerPos.z - z),
      { name: 'VPD Interceptor', color: 0x1c2f4a, topSpeed: 50, accel: 30 }, { police: true });
    car.cruise = 30;
    cops.push({ car, mesh: null, arrestTimer: 0, kind: 'car' });
    return car;
  }

  function spawnFootCop(playerPos) {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), navy);
    torso.position.y = 1.16; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
    head.position.y = 1.76; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.42), navy);
    cap.position.y = 1.98; g.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.76, 0.24), navy);
    legL.position.set(-0.16, 0.38, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    const angle = rng() * Math.PI * 2;
    g.position.set(playerPos.x + Math.cos(angle) * 30, 0, playerPos.z + Math.sin(angle) * 30);
    scene.add(g);
    const entry = { car: null, mesh: g, arrestTimer: 0, kind: 'foot', phase: 0 };
    g.userData.targetRef = { kind: 'cop', cop: entry };
    g.userData.targetKind = 'cop';
    cops.push(entry);
  }

  function desiredCops() { return stars; }

  function step(dt, playerPos, playerInCar, onBusted, onSiren) {
    // keep the force at the wanted level
    while (cops.length < desiredCops()) {
      if (stars >= 2 || cops.filter((c) => c.kind === 'car').length < 2) spawnInterceptor(playerPos);
      else spawnFootCop(playerPos);
    }
    // decay: no new crime for a while and the heat cools off
    if (stars > 0) {
      decayTimer += dt;
      if (decayTimer > WANTED.decaySeconds) {
        decayTimer = 0;
        stars -= 1;
        onSiren?.(stars);
      }
    }
    const siren = stars > 0;
    if (siren !== sirenWanted) { sirenWanted = siren; onSiren?.(stars); }

    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      const copPos = cop.car ? cop.car.mesh.position : cop.mesh.position;
      const dist = Math.hypot(copPos.x - playerPos.x, copPos.z - playerPos.z);
      if (dist > 190) { // too far: the unit gives up and despawns
        if (cop.car) vehicleSystem.removeCar(cop.car);
        else scene.remove(cop.mesh);
        cops.splice(i, 1);
        continue;
      }
      if (cop.kind === 'car') {
        // chase: steer straight at the player, faster than traffic
        const dx = playerPos.x - copPos.x;
        const dz = playerPos.z - copPos.z;
        const want = Math.atan2(dx, dz);
        let diff = want - cop.car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cop.car.steer = Math.max(-0.6, Math.min(0.6, diff * 1.6));
        cop.car.speed += (34 - cop.car.speed) * Math.min(1, dt * 1.2);
        cop.car.heading += cop.car.steer * (cop.car.speed / 40) * 1.9 * dt;
        cop.car.mesh.position.x += Math.sin(cop.car.heading) * cop.car.speed * dt;
        cop.car.mesh.position.z += Math.cos(cop.car.heading) * cop.car.speed * dt;
        cop.car.mesh.rotation.y = cop.car.heading;
        // ram the player: on foot it hurts, in a car it slows you down
        if (dist < 3.2) {
          if (playerInCar) {
            cop.car.speed *= 0.4;
          } else {
            cop.arrestTimer += dt;
            if (cop.arrestTimer > 1.6) { onBusted('A VPD unit ran you down.'); return; }
          }
        } else cop.arrestTimer = Math.max(0, cop.arrestTimer - dt);
        // light bar flash
        const bar = cop.car.mesh.userData.lightBar;
        if (bar) bar.material.color.setHex(Math.floor(performance.now() / 260) % 2 ? 0xff2a2a : 0x2a6fff);
      } else {
        // foot cop runs at the player; close for 2.5 s and you are arrested
        const dx = playerPos.x - copPos.x;
        const dz = playerPos.z - copPos.z;
        const d = Math.hypot(dx, dz) || 1;
        const speed = playerInCar ? 0 : 7.5;
        cop.mesh.position.x += (dx / d) * speed * dt;
        cop.mesh.position.z += (dz / d) * speed * dt;
        cop.mesh.rotation.y = Math.atan2(dx, dz);
        cop.phase += dt * 9;
        if (dist < 2.2 && !playerInCar) {
          cop.arrestTimer += dt;
          if (cop.arrestTimer > 2.5) { onBusted('A VPD officer cuffed you.'); return; }
        } else cop.arrestTimer = Math.max(0, cop.arrestTimer - dt);
      }
    }
  }

  function clearAll() {
    for (const cop of cops) {
      if (cop.car) vehicleSystem.removeCar(cop.car);
      else if (cop.mesh) scene.remove(cop.mesh);
    }
    cops.length = 0;
    stars = 0;
    decayTimer = 0;
  }

  // A shot foot cop goes down: remove the unit and the heat it brought.
  function removeCop(entry) {
    const i = cops.indexOf(entry);
    if (i < 0) return;
    if (entry.car) vehicleSystem.removeCar(entry.car);
    else if (entry.mesh) scene.remove(entry.mesh);
    cops.splice(i, 1);
  }

  return { starCount, addStars, step, clearAll, removeCop, get cops() { return cops; } };
}
