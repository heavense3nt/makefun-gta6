// VELDORA — missions and story: five jobs for Rook Vane, from first fare to
// King of Veldora. A mission is a chain of steps; each step has a place to reach,
// a car to enter, a package to grab, or a chase to survive.

V.MISSION_DEFS = [
  {
    name: 'FIRST FARE', reward: 200,
    briefing: 'Mara needs a cab to the Grand Veldora Hotel. Take the taxi at the stand — and don\'t keep her waiting.',
    steps: [
      { kind: 'goto', x: -40, z: 138, radius: 6, text: 'Get to the taxi stand' },
      { kind: 'enter', text: 'Get in the taxi', taxi: true },
      { kind: 'goto', x: -60, z: 138, radius: 8, text: 'Drive Mara to the Grand Veldora Hotel', time: 100, needCar: true },
    ],
  },
  {
    name: 'HOT WHEELS', reward: 350,
    briefing: 'The Crows want the red Comet S sitting at the docks. Take it. Bring it to the garage on the west side.',
    steps: [
      { kind: 'goto', x: -60, z: 165, radius: 8, text: 'Get to the docks' },
      { kind: 'enter', text: 'Steal the red Comet S', stealCar: true },
      { kind: 'goto', x: -140, z: 78, radius: 8, text: 'Deliver the Comet to the garage', needCar: true },
    ],
  },
  {
    name: 'THE DROP', reward: 500,
    briefing: 'A package is waiting at the hideout. Grab it, then run it to the Spire — the law will be all over you.',
    steps: [
      { kind: 'pickup', x: 140, z: -82, radius: 5, text: 'Pick up the package at the hideout' },
      { kind: 'goto', x: 20, z: 20, radius: 10, text: 'Deliver the package to the Spire plaza', needCar: false, wanted: 2 },
    ],
  },
  {
    name: 'PAYBACK', reward: 600,
    briefing: 'The Syndicate set you up. Three stars, sixty seconds, the whole city on your tail. Survive — then vanish at the hideout.',
    steps: [
      { kind: 'survive', time: 60, text: 'Survive the chase — 60 seconds', wanted: 3 },
      { kind: 'goto', x: 140, z: -82, radius: 8, text: 'Lose them and reach the hideout' },
    ],
  },
  {
    name: 'KING OF VELDORA', reward: 1000,
    briefing: 'One last run, three stops, no mistakes. Hotel, docks, Spire — then the city is yours.',
    steps: [
      { kind: 'goto', x: -60, z: 138, radius: 8, text: 'Checkpoint 1 of 3: the Hotel', time: 160, needCar: true },
      { kind: 'goto', x: -60, z: 165, radius: 8, text: 'Checkpoint 2 of 3: the Docks', needCar: true },
      { kind: 'goto', x: 20, z: 20, radius: 10, text: 'Final stop: the Spire plaza', needCar: true },
    ],
  },
];

/** The mission runner: tracks the active job, its steps, timers and markers. */
V.Missions = function Missions(ctx) {
  this.ctx = ctx; // {scene, city, police, audio, toast, onEvent}
  this.unlocked = 1; // how many missions the player may start
  this.active = null; // {def, index, step, timeLeft}
  this.marker = null; // floating beacon group
  this.packageMesh = null;
  this.taxiCar = null;
  this.stealCar = null;
  this._makeMarker();
};

V.Missions.prototype._makeMarker = function _makeMarker() {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.95 }));
  gem.position.y = 7;
  g.add(gem);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 30;
  g.add(pillar);
  g.visible = false;
  this.ctx.scene.add(g);
  this.marker = g;
  this._gem = gem;
};

V.Missions.prototype._showPackage = function _showPackage(x, z) {
  this._hidePackage();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1),
    new THREE.MeshLambertMaterial({ color: 0x8a5fc2, emissive: 0x4a2a7a }));
  box.position.set(x, 0.6, z);
  box.castShadow = true;
  this.ctx.scene.add(box);
  this.packageMesh = box;
};
V.Missions.prototype._hidePackage = function _hidePackage() {
  if (this.packageMesh) { this.ctx.scene.remove(this.packageMesh); this.packageMesh = null; }
};

V.Missions.prototype.start = function start(index) {
  if (index < 0 || index >= V.MISSION_DEFS.length) return false;
  if (index >= this.unlocked) return false;
  this.stop(false);
  const def = V.MISSION_DEFS[index];
  this.active = { def: def, index: index, step: 0, timeLeft: 0 };
  this._beginStep();
  this.ctx.toast(def.name + ' — ' + def.briefing, 5200);
  return true;
};

V.Missions.prototype.stop = function stop(clearStars) {
  this.active = null;
  this.marker.visible = false;
  this._hidePackage();
  if (this.taxiCar) { this.ctx.scene.remove(this.taxiCar.group); this.taxiCar = null; }
  if (this.stealCar) { this.ctx.scene.remove(this.stealCar.group); this.stealCar = null; }
  if (clearStars !== false && this.ctx.police) this.ctx.police.stars = 0;
};

V.Missions.prototype._beginStep = function _beginStep() {
  const a = this.active;
  const step = a.def.steps[a.step];
  a.timeLeft = step.time || 0;
  this.marker.visible = false;
  this._hidePackage();
  if (step.kind === 'goto' || step.kind === 'pickup') {
    this.marker.position.set(step.x, 0, step.z);
    this.marker.visible = true;
  }
  if (step.kind === 'pickup') this._showPackage(step.x, step.z);
  if (step.kind === 'enter' && step.taxi) {
    const s = this.ctx.city.spots.taxiStand;
    this.taxiCar = V.buildCar(this.ctx.scene, { color: 0xe8b93a, kind: 'sedan', taxi: true, name: 'City Taxi' });
    this.taxiCar.pos.set(s.x, 0, s.z);
    this.taxiCar.heading = Math.PI;
    this.taxiCar.group.rotation.y = Math.PI;
    this.marker.position.set(s.x, 0, s.z);
    this.marker.visible = true;
  }
  if (step.kind === 'enter' && step.stealCar) {
    const s = this.ctx.city.spots.docks;
    this.stealCar = V.buildCar(this.ctx.scene, { color: 0xc23b3b, kind: 'sport', name: 'Comet S' });
    this.stealCar.pos.set(s.x + 8, 0, s.z - 6);
    this.stealCar.heading = Math.PI / 2;
    this.stealCar.group.rotation.y = Math.PI / 2;
    this.marker.position.set(s.x + 8, 0, s.z - 6);
    this.marker.visible = true;
  }
  if (step.wanted && this.ctx.police) this.ctx.police.stars = step.wanted;
};

V.Missions.prototype.currentStep = function currentStep() {
  return this.active ? this.active.def.steps[this.active.step] : null;
};
V.Missions.prototype.targetPos = function targetPos() {
  const s = this.currentStep();
  if (!s) return null;
  if (s.kind === 'goto' || s.kind === 'pickup') return { x: s.x, z: s.z };
  if (s.kind === 'enter' && this.taxiCar) return { x: this.taxiCar.pos.x, z: this.taxiCar.pos.z };
  if (s.kind === 'enter' && this.stealCar) return { x: this.stealCar.pos.x, z: this.stealCar.pos.z };
  return null;
};
V.Missions.prototype.stepText = function stepText() {
  const a = this.active;
  if (!a) return null;
  const s = a.def.steps[a.step];
  let t = s.text;
  if (s.time) t += ' — ' + V.clock(a.timeLeft);
  return t;
};

/** Advance the active mission; call every frame with the player's live state. */
V.Missions.prototype.update = function update(dt, player) {
  const a = this.active;
  if (!a) return;
  const step = a.def.steps[a.step];
  // beacon bob + spin
  if (this.marker.visible) {
    this._gem.rotation.y += dt * 2;
    this._gem.position.y = 7 + Math.sin(performance.now() * 0.003) * 0.5;
  }
  if (this.packageMesh) this.packageMesh.rotation.y += dt * 1.5;
  // timers
  if (step.time) {
    a.timeLeft -= dt;
    if (a.timeLeft <= 0) {
      this.ctx.toast('MISSION FAILED — out of time', 3500);
      this.ctx.audio.busted();
      this.stop(false);
      if (this.ctx.onEvent) this.ctx.onEvent('failed');
      return;
    }
  }
  let done = false;
  if (step.kind === 'goto' || step.kind === 'pickup') {
    if (step.needCar && !player.inCar) done = false;
    else done = V.dist2d(player.pos.x, player.pos.z, step.x, step.z) < step.radius;
  } else if (step.kind === 'enter') {
    const car = step.taxi ? this.taxiCar : this.stealCar;
    done = !!player.inCar && player.car === car;
    if (done && step.stealCar) {
      this.ctx.police.addCrime(1);
      this.ctx.toast('Stolen! The law saw that one.', 2500);
    }
  } else if (step.kind === 'survive') {
    done = a.timeLeft <= 0;
  }
  if (!done) return;
  // step complete
  this.ctx.audio.pickup();
  a.step++;
  if (a.step >= a.def.steps.length) {
    const reward = a.def.reward;
    const idx = a.index;
    this.ctx.toast('MISSION COMPLETE — +' + V.money(reward), 4000);
    this.ctx.audio.missionDone();
    const wasLast = idx === V.MISSION_DEFS.length - 1;
    this.stop(false);
    if (this.ctx.onEvent) this.ctx.onEvent('completed', { reward: reward, index: idx, wasLast: wasLast });
    if (idx + 1 < V.MISSION_DEFS.length) this.unlocked = Math.max(this.unlocked, idx + 2);
    if (wasLast && this.ctx.onEvent) this.ctx.onEvent('legend');
  } else {
    this._beginStep();
  }
};
