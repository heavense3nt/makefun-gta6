// missions.js — five jobs for the Veldora crew, each a small state machine
// with a 3D beacon, a HUD objective and a cash payout. Missions drive the
// story; between jobs the city is free roam with side cash to grab.
import * as THREE from 'three';
import { CITY } from './config.js';
import { MISSION_BRIEFS, MISSION_COMPLETE } from './story.js';
import { buildCarMesh, Car } from './vehicles.js';

const SPOTS = {
  marina: { x: -60, z: CITY.half + 18 },
  plaza: { x: 0, z: -CITY.half + 22 },
  garage: { x: 84, z: 66 },
  alley: { x: 66, z: 84 },
  casino: { x: -102, z: -84 },
  bank: { x: 53, z: -30 }, // on the north-south road at x=53, open sightline
  hideout: { x: 204, z: 204 },
};

export class Missions {
  constructor(scene, audio, effects, combat, traffic, police) {
    this.scene = scene;
    this.audio = audio;
    this.effects = effects;
    this.combat = combat;
    this.traffic = traffic;
    this.police = police;
    this.completed = [false, false, false, false, false];
    this.active = -1;      // index of the running mission, -1 = free roam
    this.stage = 0;
    this.marker = null;
    this.markerPos = null;
    this.targetCar = null;
    this.onEvent = null;   // (type, data) -> main.js: toasts, cash, dialogue
    this.stageTimer = 0;
  }
  nextIndex() { return this.completed.findIndex((c) => !c); }
  start(index) {
    if (index < 0 || index > 4 || this.completed[index]) return false;
    this.active = index;
    this.stage = 0;
    this.stageTimer = 0;
    this.audio.missionStart();
    const brief = MISSION_BRIEFS[index];
    this.emit('brief', { index, brief });
    this.setupStage();
    return true;
  }
  emit(type, data) { if (this.onEvent) this.onEvent(type, data); }
  // Beacon: a glowing column + ring so the objective is visible across town.
  setMarker(x, z, color = 0xffd23e) {
    this.clearMarker();
    this.markerPos = { x, z };
    const g = new THREE.Group();
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    col.position.y = 13;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.6, 24),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    const light = new THREE.PointLight(color, 18, 26, 1.8);
    light.position.y = 4;
    g.add(col, ring, light);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.marker = g;
  }
  clearMarker() {
    if (this.marker) { this.scene.remove(this.marker); this.marker = null; }
    this.markerPos = null;
  }
  setupStage() {
    const i = this.active;
    if (i === 0) {
      this.setMarker(SPOTS.marina.x, SPOTS.marina.z);
      this.emit('objective', { text: 'Pick up the client at the marina pier' });
    } else if (i === 1) {
      this.setMarker(SPOTS.alley.x, SPOTS.alley.z, 0x37d67a);
      this.emit('objective', { text: 'Grab the package in the alley behind the garage' });
    } else if (i === 2) {
      this.setMarker(SPOTS.casino.x, SPOTS.casino.z, 0xd82020);
      this.emit('objective', { text: 'Steal the red sports car outside the casino' });
      if (!this.targetCar) {
        const mesh = buildCarMesh('sports', 0xd82020);
        this.scene.add(mesh);
        this.targetCar = new Car(mesh, 'sports', SPOTS.casino.x + 6, SPOTS.casino.z, Math.PI / 2);
        this.traffic.addCar(this.targetCar);
      }
    } else if (i === 3) {
      this.police.setWanted(3);
      this.emit('objective', { text: 'LOSE THE COPS — get your wanted level to zero' });
    } else if (i === 4) {
      this.setMarker(SPOTS.bank.x, SPOTS.bank.z, 0xffd23e);
      this.emit('objective', { text: 'Reach the Meridian Bank vault' });
    }
  }
  complete() {
    const i = this.active;
    this.completed[i] = true;
    this.clearMarker();
    this.active = -1;
    this.stage = 0;
    this.audio.missionDone();
    this.emit('complete', { index: i, text: MISSION_COMPLETE[i] });
    if (i === 4) this.emit('gameWon', {});
  }
  fail(reason) {
    this.clearMarker();
    this.active = -1;
    this.stage = 0;
    this.emit('fail', { reason });
  }
  atMarker(px, pz, radius = 5) {
    if (!this.markerPos) return false;
    return Math.hypot(px - this.markerPos.x, pz - this.markerPos.z) < radius;
  }
  update(dt, ctx) {
    // Beacon pulse.
    if (this.marker) {
      this.marker.rotation.y += dt * 0.8;
      this.marker.children[0].material.opacity = 0.2 + Math.sin(performance.now() / 300) * 0.1;
    }
    if (this.active < 0) return;
    const i = this.active;
    const { px, pz, inCar, car } = ctx;
    if (i === 0) {
      if (this.stage === 0 && this.atMarker(px, pz, 6)) {
        this.stage = 1;
        this.setMarker(SPOTS.plaza.x, SPOTS.plaza.z);
        this.emit('objective', { text: 'Drive the client to the north plaza — no cops, no crashes' });
        this.emit('say', { who: 'Client', text: 'Drive smooth, kid. I have a meeting, not a funeral.' });
      } else if (this.stage === 1 && inCar && this.atMarker(px, pz, 7)) {
        this.complete();
      }
    } else if (i === 1) {
      if (this.stage === 0 && !inCar && this.atMarker(px, pz, 4)) {
        this.stage = 1;
        this.setMarker(SPOTS.marina.x, SPOTS.marina.z, 0x37d67a);
        this.emit('objective', { text: 'Bring the package back to Mara at the marina' });
        this.audio.pickup();
      } else if (this.stage === 1 && this.atMarker(px, pz, 6)) {
        this.complete();
      }
    } else if (i === 2) {
      if (this.stage === 0 && this.targetCar && this.targetCar.stolen) {
        this.stage = 1;
        this.police.addHeat(1);
        this.setMarker(SPOTS.garage.x, SPOTS.garage.z, 0x37d67a);
        this.emit('objective', { text: 'Deliver the sports car to Lena\'s garage' });
        this.emit('say', { who: 'Mara Voss', text: 'You\'ve got it! Now get it to Lena before Denton\'s boys catch up.' });
      } else if (this.stage === 1 && car === this.targetCar && this.atMarker(px, pz, 7)) {
        this.traffic.removeCar(this.targetCar);
        this.scene.remove(this.targetCar.mesh);
        this.targetCar = null;
        this.complete();
      }
    } else if (i === 3) {
      if (this.police.wanted === 0) this.complete();
    } else if (i === 4) {
      if (this.stage === 0 && this.atMarker(px, pz, 6)) {
        this.stage = 1;
        this.combat.spawnEnemy(SPOTS.bank.x + 6, SPOTS.bank.z + 6);
        this.combat.spawnEnemy(SPOTS.bank.x - 6, SPOTS.bank.z - 4);
        this.combat.spawnEnemy(SPOTS.bank.x + 2, SPOTS.bank.z - 10);
        this.effects.addCashPickup(SPOTS.bank.x, SPOTS.bank.z, 2500);
        this.emit('objective', { text: 'Grab the vault cash and fight past the guards' });
        this.emit('say', { who: 'Denton Hale', text: 'Boys! Somebody\'s robbing MY bank!' });
      } else if (this.stage === 1) {
        const guardsLeft = this.combat.enemies.filter((e) => !e.dead).length;
        if (guardsLeft === 0) {
          this.stage = 2;
          this.police.setWanted(4);
          this.setMarker(SPOTS.hideout.x, SPOTS.hideout.z, 0x37d67a);
          this.emit('objective', { text: 'Lose the 4-star heat and reach the hideout' });
        }
      } else if (this.stage === 2 && this.police.wanted === 0 && this.atMarker(px, pz, 8)) {
        this.complete();
      }
    }
  }
}
