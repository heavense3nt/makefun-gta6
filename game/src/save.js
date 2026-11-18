// save.js — localStorage saves: cash, health, position, wanted level,
// mission progress and the cars the player owns. One slot, one key.
const KEY = 'veldora-save-v1';

export function saveExists() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}
export function readSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
