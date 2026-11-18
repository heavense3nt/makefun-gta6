// missions.js — the VELDORA story: five jobs for Mara Solano's garage.
// Kai Mercer, a new driver in Veldora Bay, works off a debt to Mara while Vince
// Kroll's crew tries to run him out of town. Each mission sets an objective, a
// beacon in the world, and pays cash on completion. Progress is saved.

import { Car } from './vehicles.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'Job 1 — First Wheels',
    briefing: 'Mara needs wheels. Steal any car on the street and bring it to the garage.',
    reward: 300,
  },
  {
    id: 'coastal-run',
    title: 'Job 2 — Coastal Run',
    briefing: 'A package for the harbor, and the buyer will not wait. Drive it there in 75 seconds.',
    reward: 500,
  },
  {
    id: 'heat-on-the-strip',
    title: 'Job 3 — Heat on the Strip',
    briefing: "Kroll tipped off the cops. You're at 2 stars — lose the heat and stay free.",
    reward: 600,
  },
  {
    id: 'harbor-heist',
    title: 'Job 4 — Harbor Heist',
    briefing: "Kroll's crew guards Mara's crates at the harbor. Take out 5 rivals, then grab the crates.",
    reward: 900,
  },
  {
    id: 'bayfront-showdown',
    title: 'Job 5 — Bayfront Showdown',
    briefing: "Vince Kroll himself is running. Chase his car down, stop it, then come home.",
    reward: 1500,
  },
];

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.index = 0; // current mission
    this.completed = 0;
    this.active = false;
    this.phase = 'go'; // per-mission phase
    this.timer = 0;
    this.kills = 0;
    this.crates = 0;
    this.rivals = [];
    this.krollCar = null;
    this.marker = null;
  }

  get current() { return MISSIONS[this.index] || null; }
  get done() { return this.index >= MISSIONS.length; }

  start() {
    if (this.done) return;
    this.active = true;
    const m = this.current;
    this.phase = 'go';
    this.timer = 0; this.kills = 0; this.crates = 0;
    const game = this.game;
    game.hud.setObjective(`${m.title}: ${m.briefing}`);
    game.hud.toast(`${m.title} — $${m.reward}`);
    if (this.index === 0) {
      this.marker = { x: game.city.garagePos.x, z: game.city.garagePos.z };
      game.effects.setBeacon(this.marker.x, this.marker.z);
    } else if (this.index === 1) {
      this.marker = { x: game.city.harborPos.x, z: game.city.harborPos.z };
      game.effects.setBeacon(this.marker.x, this.marker.z);
      this.timer = 75;
    } else if (this.index === 2) {
      game.police.addWanted(2, 'Kroll tipped off the cops');
      game.hud.setObjective(`${m.title}: lose the heat — stay out of sight until the stars clear.`);
      this.marker = null;
    } else if (this.index === 3) {
      this.marker = { x: game.city.harborPos.x, z: game.city.harborPos.z };
      game.effects.setBeacon(this.marker.x, this.marker.z);
      this.rivals = game.peds.spawnRivals(this.marker.x + 10, this.marker.z - 10, 5);
    } else if (this.index === 4) {
      this._spawnKroll(game);
    }
  }

  _spawnKroll(game) {
    const THREE = game.THREE;
    const car = new Car(THREE, game.scene, 120, -120, Math.PI, 0x111111, false);
    car.driver = 'ai';
    car.maxSpeed = 26;
    car.aiTarget = { x: -200, z: 200 };
    car.health = 120;
    this.krollCar = car;
    game.krollCar = car;
    this.marker = { x: car.x, z: car.z };
    game.effects.setBeacon(car.x, car.z);
    game.hud.setObjective(`${this.current.title}: chase Kroll's black car and stop it!`);
  }

  onRivalDown(ped) {
    if (this.index !== 3 || !this.active) return;
    this.kills++;
    this.game.hud.setObjective(`${this.current.title}: rivals down ${this.kills}/5 — then grab the crates.`);
    if (this.kills >= 5) {
      this.phase = 'crates';
      this.game.hud.toast('Rivals clear — grab the 3 crates at the harbor!');
      this.marker = { x: this.game.city.harborPos.x, z: this.game.city.harborPos.z };
      this.game.effects.setBeacon(this.marker.x, this.marker.z);
    }
  }

  complete() {
    const game = this.game;
    const m = this.current;
    game.money += m.reward;
    game.hud.setCash(game.money);
    game.audio.cash();
    game.audio.missionDone();
    game.hud.toast(`${m.title} complete! +$${m.reward}`);
    this.completed++;
    this.index++;
    this.active = false;
    game.effects.clearBeacon();
    game.save.save();
    if (this.done) {
      game.onAllMissionsDone();
    } else {
      setTimeout(() => this.start(), 1500);
    }
  }

  update(dt, game) {
    if (!this.active || this.done) return;
    const p = game.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const pz = p.inCar ? p.inCar.z : p.z;
    if (this.index === 0) {
      // steal a car, then bring it to the garage
      if (this.phase === 'go' && p.inCar) {
        this.phase = 'return';
        game.hud.setObjective(`${this.current.title}: nice ride — now bring it to Mara's garage.`);
        this.marker = { x: game.city.garagePos.x, z: game.city.garagePos.z };
        game.effects.setBeacon(this.marker.x, this.marker.z);
      }
      if (this.phase === 'return' && this.marker &&
          Math.hypot(px - this.marker.x, pz - this.marker.z) < 12) this.complete();
    } else if (this.index === 1) {
      this.timer -= dt;
      game.hud.setObjective(`${this.current.title}: deliver to the harbor — ${Math.max(0, Math.ceil(this.timer))}s left!`);
      if (this.timer <= 0) {
        game.hud.toast('Too slow — the buyer walked. Try again.');
        this.start(); // restart the mission
        return;
      }
      if (this.marker && Math.hypot(px - this.marker.x, pz - this.marker.z) < 12) this.complete();
    } else if (this.index === 2) {
      if (game.police.wanted === 0) {
        game.hud.setObjective(`${this.current.title}: heat lost. Nice driving.`);
        this.complete();
      }
    } else if (this.index === 3) {
      if (this.phase === 'crates' && this.marker &&
          Math.hypot(px - this.marker.x, pz - this.marker.z) < 10) {
        this.crates++;
        game.audio.pickup();
        game.hud.toast(`Crate ${this.crates}/3 secured`);
        if (this.crates >= 3) this.complete();
        else {
          // move the marker to the next crate pile
          this.marker = { x: this.marker.x + 24, z: this.marker.z + (this.crates % 2 === 0 ? 8 : -8) };
          game.effects.setBeacon(this.marker.x, this.marker.z);
        }
      }
    } else if (this.index === 4) {
      const kc = this.krollCar;
      if (kc) {
        this.marker = { x: kc.x, z: kc.z };
        game.effects.setBeacon(kc.x, kc.z);
        // Kroll flees along the grid
        if (!kc.aiTarget || Math.hypot(kc.aiTarget.x - kc.x, kc.aiTarget.z - kc.z) < 6) {
          const streets = game.city.streets;
          kc.aiTarget = { x: streets[Math.floor(Math.random() * streets.length)], z: streets[Math.floor(Math.random() * streets.length)] };
        }
        kc.driveAI(dt, game, 24);
        if (kc.health <= 0) {
          game.hud.setObjective(`${this.current.title}: Kroll's car is done — drive back to the garage.`);
          this.phase = 'return';
          this.marker = { x: game.city.garagePos.x, z: game.city.garagePos.z };
          game.effects.setBeacon(this.marker.x, this.marker.z);
          this.krollCar = null;
        }
      } else if (this.phase === 'return' && this.marker &&
          Math.hypot(px - this.marker.x, pz - this.marker.z) < 12) {
        this.complete();
      }
    }
  }
}
