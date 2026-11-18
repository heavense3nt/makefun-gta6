// VELDORA v7 — menus: title screen, pause, and the busted screen.
// All DOM, all original art direction (dusk gradient + VELDORA wordmark).
export function createMenus() {
  const el = (id) => document.getElementById(id);
  return {
    title: el('title-screen'),
    pause: el('pause-screen'),
    busted: el('busted-screen'),
    playBtn: el('play-btn'),
    resumeBtn: el('resume-btn'),
    restartBtn: el('restart-btn'),
    titleJobs: el('title-jobs'),
  };
}

export function showScreen(menus, name) {
  menus.title.style.display = name === 'title' ? 'flex' : 'none';
  menus.pause.style.display = name === 'pause' ? 'flex' : 'none';
  menus.busted.style.display = name === 'busted' ? 'flex' : 'none';
}

export function fillJobList(menus, missions) {
  menus.titleJobs.innerHTML = missions.map((m) => `<li>${m.id}. ${m.name} — ${m.brief}</li>`).join('');
}
