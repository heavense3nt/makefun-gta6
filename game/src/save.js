// save.js — VELDORA save game in localStorage: cash, mission progress, position,
// health. Autosaves on mission completion and every 20 seconds of play.

const KEY = 'veldora-save-v1';

export class SaveGame {
  constructor(game) {
    this.game = game;
    this.timer = 0;
  }

  save() {
    try {
      const p = this.game.player;
      const data = {
        money: this.game.money,
        missionIndex: this.game.missions.index,
        completed: this.game.missions.completed,
        x: p.inCar ? p.inCar.x : p.x,
        z: p.inCar ? p.inCar.z : p.z,
        health: p.health,
        ammo: this.game.combat.ammo,
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  update(dt) {
    this.timer += dt;
    if (this.timer > 20) { this.timer = 0; this.save(); }
  }

  apply(data) {
    const game = this.game;
    game.money = data.money || 0;
    game.missions.index = data.missionIndex || 0;
    game.missions.completed = data.completed || 0;
    game.player.x = data.x || 0;
    game.player.z = data.z || 0;
    game.player.health = data.health || 100;
    game.player.mesh.position.set(game.player.x, 0, game.player.z);
    game.combat.ammo = data.ammo != null ? data.ammo : 12;
    game.hud.setCash(game.money);
    game.hud.setHealth(game.player.health, game.player.maxHealth);
    game.hud.setAmmo(game.combat.ammo, game.combat.ammoMax);
  }
}
