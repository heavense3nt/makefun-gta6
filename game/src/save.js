// VELDORA v6 — save to localStorage: cash, health, mission progress, player position.
import { CONFIG } from './config.js';

export function saveGame(state) {
  try {
    window.localStorage.setItem(CONFIG.saveKey, JSON.stringify({
      cash: state.cash, health: state.health, armor: state.armor,
      missionIndex: state.missionIndex, x: state.x, z: state.z,
      ammoReserve: state.ammoReserve,
    }));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(CONFIG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
