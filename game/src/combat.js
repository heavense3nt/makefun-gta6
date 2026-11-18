// combat.js — shooting and punching in Veldora Bay.
// Hitscan pistol: a ray from the camera through the crosshair. Ammo 12, R reloads.
// Punch with F at close range. Hitting a pedestrian or a cop raises the wanted level.

export class Combat {
  constructor(game) {
    this.game = game;
    this.ammo = 12;
    this.ammoMax = 12;
    this.reloadTimer = 0;
    this.shootCooldown = 0;
  }

  update(dt, game) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.ammo = this.ammoMax; game.hud.setAmmo(this.ammo, this.ammoMax); }
    }
    if (game.input.takePressed('KeyR') && this.ammo < this.ammoMax && this.reloadTimer <= 0) {
      this.reloadTimer = 1.1;
      game.audio.click();
    }
    if (game.player.inCar) return;
    if (game.input.takeClick() && this.shootCooldown <= 0 && this.reloadTimer <= 0) this.shoot(game);
    if (game.input.takePressed('KeyF')) this.punch(game);
  }

  shoot(game) {
    if (this.ammo <= 0) { game.audio.click(); this.reloadTimer = 1.1; return; }
    this.ammo--;
    this.shootCooldown = 0.28;
    game.audio.gunshot();
    game.hud.setAmmo(this.ammo, this.ammoMax);
    const THREE = game.THREE;
    const cam = game.cameraRig.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.position.clone();
    const ray = new THREE.Raycaster(origin, dir, 0.1, 90);
    // targets: pedestrians and cars (police + traffic)
    const meshes = [];
    for (const ped of game.peds.peds) if (!ped.dead) meshes.push(ped.mesh);
    for (const car of [...game.traffic.cars, ...game.police.cars]) meshes.push(car.mesh);
    const hits = ray.intersectObjects(meshes, true);
    game.effects.muzzle(origin.clone().add(dir.clone().multiplyScalar(1.2)), dir, game);
    // scare nearby pedestrians
    for (const ped of game.peds.peds) {
      if (!ped.dead && Math.hypot(ped.x - game.player.x, ped.z - game.player.z) < 25) ped.scare();
    }
    if (!hits.length) return;
    // walk up from the hit child mesh to the ped/car root group
    const roots = new Set();
    for (const ped of game.peds.peds) roots.add(ped.mesh);
    for (const car of [...game.traffic.cars, ...game.police.cars]) roots.add(car.mesh);
    let obj = hits[0].object;
    while (obj && !roots.has(obj)) obj = obj.parent;
    if (!obj) return;
    for (const ped of game.peds.peds) {
      if (ped.mesh === obj && !ped.dead) {
        ped.health -= 55;
        game.effects.bloodPuff(ped.x, ped.z, game);
        if (ped.health <= 0) {
          ped.die(game);
          game.police.addWanted(ped.rival ? 1 : 2, ped.rival ? 'menembak rival' : 'menembak warga');
          if (ped.rival) game.missions.onRivalDown(ped);
        } else game.police.addWanted(1, 'menembak warga');
        return;
      }
    }
    for (const car of [...game.traffic.cars, ...game.police.cars]) {
      if (car.mesh === obj) {
        car.damage(34, game);
        if (car.isPolice) game.police.addWanted(1, 'menembak polisi');
        return;
      }
    }
  }

  punch(game) {
    const p = game.player;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.45;
    game.audio.punch();
    const range = 2.2;
    for (const ped of game.peds.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - p.x, ped.z - p.z);
      if (d < range) {
        ped.health -= 30;
        ped.scare();
        if (ped.health <= 0) { ped.die(game); game.police.addWanted(1, 'memukul warga'); }
        return;
      }
    }
  }

  // A rival shoots at the player (called from Pedestrian.update).
  enemyShoot(rival, game) {
    const p = game.player;
    if (p.inCar) { // rivals shoot the car instead
      const car = p.inCar;
      car.damage(8, game);
      game.effects.muzzle(new (game.THREE.Vector3)(rival.x, 1.4, rival.z),
        new (game.THREE.Vector3)(car.x - rival.x, 0, car.z - rival.z).normalize(), game);
      return;
    }
    const d = Math.hypot(p.x - rival.x, p.z - rival.z);
    const hitChance = Math.max(0.15, 0.55 - d * 0.012);
    game.effects.muzzle(new (game.THREE.Vector3)(rival.x, 1.4, rival.z),
      new (game.THREE.Vector3)(p.x - rival.x, 0, p.z - rival.z).normalize(), game);
    if (Math.random() < hitChance) p.damage(9, game);
  }
}
