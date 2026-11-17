// Save game: cash, jobs completed and Rico's last position, kept in this
// browser's localStorage under one key. Loading is forgiving — a corrupt or
// missing save just starts a fresh story.

const KEY = 'veldora-save-v3';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? Math.max(0, data.cash | 0) : 0,
      completed: Number.isFinite(data.completed) ? Math.max(0, Math.min(5, data.completed | 0)) : 0,
      x: Number.isFinite(data.x) ? data.x : 0,
      z: Number.isFinite(data.z) ? data.z : 8,
      stars: 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash | 0,
      completed: state.completed | 0,
      x: Math.round(state.x * 10) / 10,
      z: Math.round(state.z * 10) / 10,
      savedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* storage off */ }
}
