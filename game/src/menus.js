// menus.js — the title, pause and busted screens: buttons, mission list,
// and the save-slot line. All DOM, no canvas.
import { MISSION_BRIEFS } from './story.js';

export class Menus {
  constructor(callbacks) {
    this.cb = callbacks;
    this.startScreen = document.getElementById('startScreen');
    this.pauseScreen = document.getElementById('pauseScreen');
    this.overScreen = document.getElementById('overScreen');
    this.playBtn = document.getElementById('playBtn');
    this.continueBtn = document.getElementById('continueBtn');
    this.missionList = document.getElementById('missionList');
    this.playBtn.addEventListener('click', () => { this.cb.onPlay(false); });
    this.continueBtn.addEventListener('click', () => { this.cb.onPlay(true); });
    document.getElementById('resumeBtn').addEventListener('click', () => this.cb.onResume());
    document.getElementById('saveBtn').addEventListener('click', () => this.cb.onSave());
    document.getElementById('quitBtn').addEventListener('click', () => this.cb.onQuitToTitle());
    document.getElementById('retryBtn').addEventListener('click', () => this.cb.onRetry());
    document.getElementById('overQuitBtn').addEventListener('click', () => this.cb.onQuitToTitle());
  }
  showStart(saveExists, completed) {
    this.startScreen.classList.remove('hidden');
    this.pauseScreen.classList.add('hidden');
    this.overScreen.classList.add('hidden');
    this.continueBtn.classList.toggle('hidden', !saveExists);
    this.playBtn.textContent = saveExists ? '▶  NEW GAME' : '▶  PLAY';
    this.missionList.innerHTML = '<b>THE FIVE JOBS</b><br>' + MISSION_BRIEFS.map((m, i) => {
      const cls = completed[i] ? 'done' : (completed.indexOf(false) === i ? 'next' : '');
      const mark = completed[i] ? '✓' : (completed.indexOf(false) === i ? '→' : '·');
      return `<span class="${cls}">${mark} ${m.title}</span>`;
    }).join('<br>');
  }
  hideStart() { this.startScreen.classList.add('hidden'); }
  showPause() { this.pauseScreen.classList.remove('hidden'); }
  hidePause() { this.pauseScreen.classList.add('hidden'); }
  showOver(text) {
    document.getElementById('overText').textContent = text;
    this.overScreen.classList.remove('hidden');
  }
  hideOver() { this.overScreen.classList.add('hidden'); }
}
