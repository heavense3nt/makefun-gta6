// VELDORA v7 — the five missions: a small state machine. Each mission has
// a target point, a beacon, and a completion test. Completing one pays
// cash and starts the next; finishing all five ends the story.
import { MISSIONS } from './config.js';
import { dist2d } from './utils.js';
import { missionBrief } from './story.js';

export function createMissions(city) {
  const L = city.landmarks;
  return {
    index: 0, // 0-based: mission 1 is index 0
    state: 'idle', // idle | active | done
    target: null,
    timer: 0,
    cashEarned: 0,
    landmarks: L,
  };
}

function missionTarget(m, city) {
  const L = city.landmarks;
  switch (m.index) {
    case 0: return { x: L.marina.x, z: L.marina.z, radius: 5, label: 'Marina pickup' };
    case 1: return { x: L.alley.x, z: L.alley.z, radius: 4, label: 'Alley package' };
    case 2: return { x: L.showroom.x, z: L.showroom.z, radius: 5, label: 'Showroom sports car' };
    case 3: return { x: L.hideout.x, z: L.hideout.z, radius: 6, label: 'Hideout — lose the heat' };
    case 4: return { x: L.bank.x, z: L.bank.z, radius: 5, label: 'Bank vault' };
    default: return null;
  }
}

export function startMission(m, city) {
  if (m.index >= MISSIONS.length) return null;
  m.state = 'active';
  m.target = missionTarget(m, city);
  m.timer = 0;
  return { mission: MISSIONS[m.index], lines: missionBrief(m.index + 1), target: m.target };
}

export function updateMissions(m, dt, playerPos, inCar, wantedStars, hasSportsCar) {
  if (m.state !== 'active' || !m.target) return null;
  m.timer += dt;
  const d = dist2d(playerPos.x, playerPos.z, m.target.x, m.target.z);
  // Mission 3 needs the sports car, mission 4 needs the heat gone.
  if (m.index === 2 && !hasSportsCar) return null;
  if (m.index === 3 && wantedStars > 0) return null;
  if (d < m.target.radius) {
    const done = MISSIONS[m.index];
    const payout = 250 + m.index * 250;
    m.cashEarned += payout;
    m.index += 1;
    m.state = m.index >= MISSIONS.length ? 'done' : 'idle';
    m.target = null;
    return { completed: done, payout, allDone: m.state === 'done' };
  }
  return null;
}

export function currentMissionName(m) {
  if (m.index >= MISSIONS.length) return 'Story complete';
  return `${MISSIONS[m.index].id}. ${MISSIONS[m.index].name}`;
}
