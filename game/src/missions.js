// VELDORA's story: five jobs for Rico Marlowe, from first fare to King of the
// coast. Each mission is a small state machine with a beacon marker in the world,
// a minimap blip, an objective line and a cash reward. Missions run one at a
// time; R starts the next one when the player is ready.

import { MISSIONS } from './config.js';

const THREE = window.THREE;

function makeBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.22, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  group.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffe98a }),
  );
  diamond.position.y = 5;
  group.add(diamond);
  group.userData = { diamond };
  group.visible = false;
  scene.add(group);
  return group;
}

export function createMissions(scene, city, hooks) {
  const beacon = makeBeacon(scene);
  let activeIndex = -1;   // index into MISSIONS of the running job, -1 = none
  let completed = 0;      // how many jobs are done (also the save's progress)
  let stage = 0;          // per-mission stage
  let timer = 0;
  let raceCheckpoints = [];
  let raceIndex = 0;
  let gangLeft = 0;
  let packageHeld = false;

  const L = city.landmarks;

  function targetOf() {
    if (activeIndex < 0) return null;
    const id = MISSIONS[activeIndex].id;
    if (id === 1) return stage === 0 ? L.plaza : L.marina;
    if (id === 2) return stage === 0 ? new THREE.Vector3(3, 0, -70) : L.garage;
    if (id === 3) return stage === 0 ? L.alley : L.beachHut;
    if (id === 4) return L.fishMarket;
    if (id === 5) return raceCheckpoints[raceIndex] ?? null;
    return null;
  }

  function objectiveText() {
    if (activeIndex < 0) {
      if (completed >= MISSIONS.length) return { title: 'King of Veldora', text: 'All five jobs done. The coast is yours, Rico. Free-roam, cause chaos, enjoy the sunset.', dist: '' };
      return { title: `Next job: ${MISSIONS[completed].name}`, text: `${MISSIONS[completed].blurb} Press R to start.`, dist: '' };
    }
    const m = MISSIONS[activeIndex];
    const texts = {
      1: stage === 0 ? 'Meet the courier at the plaza fountain.' : 'Drive the courier to the marina pier.',
      2: stage === 0 ? 'Steal the orange Comet GT by the Spire (press E at the car).' : 'Deliver the Comet GT to the garage on Dock Street.',
      3: stage === 0 ? 'Pick up the package in the alley (walk into the marker).' : 'Run the package to the beach hut. The cops are onto you — go!',
      4: `Deal with the Dock Rats at the fish market. ${gangLeft} left.`,
      5: `Checkpoint ${raceIndex + 1} of 5 — ${Math.max(0, Math.ceil(timer))}s left!`,
    };
    return { title: `${m.name} — $${m.reward}`, text: texts[m.id], dist: '' };
  }

  function start(index) {
    activeIndex = index;
    stage = 0;
    timer = index === 4 ? 90 : 0;
    gangLeft = 0;
    packageHeld = false;
    if (index === 4) {
      raceCheckpoints = [
        new THREE.Vector3(0, 0, 112), new THREE.Vector3(168, 0, 112),
        new THREE.Vector3(168, 0, -112), new THREE.Vector3(-168, 0, -112),
        new THREE.Vector3(0, 0, 0),
      ];
      raceIndex = 0;
    }
    if (index === 3) {
      hooks.spawnGang(L.fishMarket);
      gangLeft = 3;
    }
    if (index === 2) hooks.toast('The Comet GT glints by the Spire. Take it.');
    const t = targetOf();
    if (t) { beacon.position.set(t.x, 0, t.z); beacon.visible = true; }
    hooks.toast(`Job ${index + 1}: ${MISSIONS[index].name} — $${MISSIONS[index].reward}`);
    hooks.audio.fanfare();
  }

  function complete() {
    const m = MISSIONS[activeIndex];
    hooks.addCash(m.reward);
    hooks.toast(`Job done: ${m.name}! +$${m.reward}`);
    hooks.audio.fanfare();
    completed = Math.max(completed, activeIndex + 1);
    activeIndex = -1;
    beacon.visible = false;
    hooks.save();
    if (completed >= MISSIONS.length) {
      hooks.toast('KING OF VELDORA. Every job done — the coast is yours.');
    }
  }

  function fail(reason) {
    hooks.toast(reason);
    hooks.audio.fail();
    activeIndex = -1;
    beacon.visible = false;
  }

  function gangDown() {
    if (activeIndex !== 3) return;
    gangLeft = Math.max(0, gangLeft - 1);
    if (gangLeft === 0) complete();
  }

  function step(dt, playerPos, inCar, car) {
    if (activeIndex < 0) return;
    const m = MISSIONS[activeIndex];
    if (m.id === 5) {
      timer -= dt;
      if (timer <= 0) { fail('Out of time! The crown slips away — press R to run it again.'); return; }
    }
    const t = targetOf();
    if (!t) return;
    beacon.userData.diamond.rotation.y += dt * 2;
    beacon.userData.diamond.position.y = 5 + Math.sin(performance.now() / 300) * 0.6;
    const dist = Math.hypot(playerPos.x - t.x, playerPos.z - t.z);
    // Mission 1: the courier rides with you once you reach him — stage 2 needs a car.
    if (m.id === 1 && stage === 0 && dist < 4) {
      stage = 1;
      hooks.toast('Courier: "Marina pier. Fast. And don\'t scratch the paint."');
    } else if (m.id === 1 && stage === 1 && dist < 5 && inCar) complete();
    else if (m.id === 2 && stage === 0 && car === city.cometCar && inCar) {
      stage = 1;
      hooks.toast('The Comet is yours. Now lose yourself in the garage.');
      hooks.addWanted(1);
    } else if (m.id === 2 && stage === 1 && dist < 6 && inCar && car === city.cometCar) complete();
    else if (m.id === 3 && stage === 0 && dist < 4) {
      stage = 1; packageHeld = true;
      hooks.toast('Package grabbed. Beach hut, south end. Move!');
      hooks.addWanted(2);
    } else if (m.id === 3 && stage === 1 && dist < 5) complete();
    else if (m.id === 4 && gangLeft === 0) complete();
    else if (m.id === 5 && dist < 6) {
      raceIndex += 1;
      hooks.audio.chime();
      if (raceIndex >= raceCheckpoints.length) complete();
    }
    const nt = targetOf();
    if (nt) beacon.position.set(nt.x, 0, nt.z);
  }

  return {
    beacon,
    get activeIndex() { return activeIndex; },
    get completed() { return completed; },
    setCompleted(v) { completed = v; },
    targetOf,
    objectiveText,
    start,
    gangDown,
    step,
    get packageHeld() { return packageHeld; },
    get raceTimer() { return timer; },
  };
}
