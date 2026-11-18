// police.js — the wanted system and the Veldora Bay PD.
// Wanted 0–5 stars. Crimes raise it; it decays when the player stays clean and unseen.
// Police cruisers spawn at the city edge, chase the player (on foot or in a car), ram,
// and bust the player if they stay close on foot. Sirens blip as they close in.

import { pick } from './math3.js';
import { Car } from './vehicles.js';

const MAX_POLICE = [0, 1, 2, 3, 4, 5];

export class PoliceManager {
  constructor(THREE, scene, game) {
    this.game = game;
    this.THREE = THREE;
    this.scene = scene;
    this.wanted = 0;
    this.cars = [];
    this.spawnTimer = 0;
    this.cleanTimer = 0;
    this.bustTimer = 0;
    this.sirenTimer = 0;
  }

  addWanted(n, reason) {
    const before = this.wanted;
    this.wanted = Math.min(5, this.wanted + n);
    if (this.wanted > before) {
      this.game.hud.toast(`Wanted naik: ${'★'.repeat(this.wanted)} — ${reason}`);
      this.game.hud.setWanted(this.wanted);
    }
  }

  clearWanted() {
    this.wanted = 0;
    this.game.hud.setWanted(0);
    for (const c of this.cars) this._removeCar(c);
    this.cars = [];
  }

  _spawnPolice() {
    const game = this.game;
    const p = game.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    // spawn ahead of the player on a nearby street
    const streets = game.city.streets;
    const sx = pick(game.rng, streets), sz = pick(game.rng, streets);
    const car = new Car(this.THREE, this.scene, sx, sz, 0, 0xf2f2f2, true);
    car.driver = 'ai';
    this.cars.push(car);
    this.game.audio.sirenBlip();
  }

  _removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  update(dt, game) {
    const p = game.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    const want = MAX_POLICE[this.wanted];
    // spawn up to the wanted level's count
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      this._spawnPolice();
      this.spawnTimer = 2.5;
    }
    // decay: no crime for a while and no cruiser nearby
    if (this.wanted > 0) {
      this.cleanTimer += dt;
      let nearest = 1e9;
      for (const c of this.cars) nearest = Math.min(nearest, Math.hypot(c.x - px, c.z - pz));
      if (this.cleanTimer > 18 && nearest > 70) {
        this.wanted--;
        game.hud.setWanted(this.wanted);
        this.cleanTimer = 0;
        if (this.wanted === 0) game.hud.toast('Polisi kehilangan jejakmu.');
      }
    } else this.cleanTimer = 0;

    // chase
    let closest = 1e9;
    for (const car of [...this.cars]) {
      car.aiTarget = { x: px, z: pz };
      car.driveAI(dt, game, 13 + this.wanted * 2.2);
      const d = Math.hypot(car.x - px, car.z - pz);
      closest = Math.min(closest, d);
      // flashing light bar
      if (car.mesh.userData.lightBar) {
        const t = Math.floor(performance.now() / 250) % 2;
        car.mesh.userData.lightBar[0].material.emissive.setHex(t === 0 ? 0xff0000 : 0x220000);
        car.mesh.userData.lightBar[1].material.emissive.setHex(t === 1 ? 0x0044ff : 0x000022);
      }
      // ram the player's car
      if (p.inCar && d < 4.2) {
        p.inCar.speed *= 0.82;
        p.inCar.health -= 6 * dt;
        if (p.inCar.health <= 0) { game.effects.explode(p.inCar.x, p.inCar.z, game); p.exitCar(game); }
      }
    }
    // busted: a cruiser stays close while the player is on foot
    if (!p.inCar && this.wanted > 0 && closest < 3.2) {
      this.bustTimer += dt;
      game.hud.setBustProgress(this.bustTimer / 3);
      if (this.bustTimer >= 3) game.onBusted();
    } else {
      this.bustTimer = 0;
      game.hud.setBustProgress(0);
    }
    // siren blips while chased
    this.sirenTimer -= dt;
    if (this.wanted > 0 && closest < 60 && this.sirenTimer <= 0) {
      game.audio.sirenBlip();
      this.sirenTimer = 2.2;
    }
  }
}
