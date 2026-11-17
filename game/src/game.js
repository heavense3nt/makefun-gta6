// VELDORA — bootstrap, game loop, camera, input, state machine and the glue
// between the city, the cars, the people, the law and the missions.

V.Game = {
  state: 'menu', cash: 500, legend: false,
  onEvent: null, onHurt: null, onCrime: null,
};

(function bootGame() {
  const params = new URLSearchParams(location.search);
  const shotMode = params.get('shot') || null;
  const seed = parseInt(params.get('seed') || '7', 10) || 7;

  const rngCity = V.makeRng(seed);
  const rngTraffic = V.makeRng(seed + 101);
  const rngCrowd = V.makeRng(seed + 202);
  V._rng = V.makeRng(seed + 303); // shared pick() rng for car names/colours

  // ---------- renderer / scene ----------
  const app = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  app.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc8a882, 220, 700);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(60, 40, 120);

  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a6a4a, 0.85);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffd9a0, 1.5);
  sunLight.position.set(-180, 240, -120);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -190; sunLight.shadow.camera.right = 190;
  sunLight.shadow.camera.top = 190; sunLight.shadow.camera.bottom = -190;
  sunLight.shadow.camera.far = 700;
  scene.add(sunLight);

  // ---------- world ----------
  const city = V.buildCity(scene, rngCity);
  const traffic = new V.Traffic(scene, city, rngTraffic, 12);
  const crowd = new V.Crowd(scene, city, rngCrowd, 22);
  const parked = V.spawnParkedCars(scene, city, rngTraffic, 8);
  const player = new V.Player(scene, rngCrowd, city.spots.spawn);
  const police = new V.Police(scene, city, rngTraffic);
  const hud = new V.Hud(city);
  const missions = new V.Missions({
    scene: scene, city: city, police: police, audio: V.Audio,
    toast: function (t, ms) { hud.toast(t, ms); },
    onEvent: function (kind, data) { gameEvent(kind, data); },
  });

  // cash pickups scattered around town
  const pickups = [];
  (function spawnPickups() {
    const spots = [[40, 100], [-100, -20], [100, 60], [-20, -100], [140, 40], [-140, -60], [60, -140], [-60, 20]];
    spots.forEach(function (s) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.32, 8, 18),
        new THREE.MeshBasicMaterial({ color: 0xffd23e }));
      m.position.set(s[0], 1.4, s[1]);
      m.rotation.y = 0.6;
      scene.add(m);
      pickups.push({ mesh: m, x: s[0], z: s[1], taken: false });
    });
  })();

  // ---------- state ----------
  const G = V.Game;
  G.cash = 500;
  G.state = 'menu';
  let camYaw = Math.PI, camPitch = 0.32, camDist = 9;
  let stagedCamDist = 0; // a shot's fixed camera distance (0 = follow normally)
  let menuOrbit = 0;
  let lastDragAt = 0;
  let mapTimer = 0;
  let cleanupTimer = 0;

  const input = {
    forward: false, back: false, left: false, right: false,
    sprint: false, jump: false, handbrake: false, shoot: false,
  };

  G.onHurt = function onHurt(health) { hud.setHealth(health); hud.flashDamage(); };
  G.onCrime = function onCrime(stars) { hud.setStars(stars); V.Audio.setSiren(stars > 0); };
  G.onEvent = gameEvent;

  function gameEvent(kind, data) {
    if (kind === 'completed' && data) {
      G.cash += data.reward;
      hud.setCash(G.cash);
      saveGame(true);
    }
    if (kind === 'legend') {
      G.legend = true;
      hud.toast('YOU ARE THE KING OF VELDORA', 6000);
    }
    if (kind === 'wasted') {
      endScreen('WASTED', 'Rook got flattened. The VPD scraped you off the road — $200 gone.');
      applyPenalty(200);
    }
    if (kind === 'failed') { /* mission failed: stay in free roam */ }
  }

  function applyPenalty(n) {
    G.cash = Math.max(0, G.cash - n);
    hud.setCash(G.cash);
  }

  function endScreen(title, text) {
    G.state = 'end';
    hud.showEnd(title, text);
    hud.hide('hud');
    V.Audio.setSiren(false);
    V.Audio.setEngine(0, false);
  }

  function respawn() {
    police.clear();
    player.reset(city.spots.hospital, 100);
    hud.setHealth(100);
    hud.setStars(0);
    hud.hide('end');
    hud.show('hud');
    G.state = 'playing';
    camYaw = Math.PI;
    hud.toast('Back on your feet. Stay out of trouble... or don\'t.', 3500);
  }

  function saveGame(silent) {
    const ok = V.writeSave({
      cash: G.cash, unlocked: missions.unlocked, legend: G.legend,
      health: player.health, x: player.pos.x, z: player.pos.z,
    });
    if (!silent) hud.toast(ok ? 'Game saved.' : 'Save failed (storage blocked).', 2200);
  }

  function loadGame() {
    const s = V.loadSave();
    if (!s) return false;
    G.cash = s.cash;
    missions.unlocked = Math.max(1, Math.min(5, s.unlocked || 1));
    G.legend = !!s.legend;
    player.reset({ x: s.x || 0, z: s.z || 55 }, s.health || 100);
    hud.setCash(G.cash);
    hud.setHealth(player.health);
    return true;
  }

  // ---------- menus ----------
  function startPlaying() {
    hud.showOnly([]);
    hud.show('hud');
    hud.hide('menu');
    hud.hide('howto');
    hud.hide('pause');
    hud.hide('end');
    G.state = 'playing';
    V.Audio.unlock();
    V.Audio.click();
    hud.setCash(G.cash);
    hud.setHealth(player.health);
    hud.setStars(police.wanted());
  }
  hud.el.btnNew.onclick = function () {
    G.cash = 500;
    G.legend = false;
    missions.unlocked = 1;
    missions.stop(false);
    police.clear();
    player.reset(city.spots.spawn, 100);
    saveGame(true);
    startPlaying();
    hud.toast('Welcome to Veldora, Rook. Mission 1 is waiting — open the pause menu.', 5000);
    missions.start(0);
  };
  hud.el.btnContinue.onclick = function () {
    if (loadGame()) { startPlaying(); hud.toast('Welcome back, Rook.', 2500); }
    else { hud.toast('No save found yet — start a new game.', 2500); }
  };
  hud.el.btnHow.onclick = function () { hud.showOnly(['howto']); V.Audio.click(); };
  hud.el.btnHowBack.onclick = function () { hud.showOnly(['menu']); V.Audio.click(); };
  hud.el.btnResume.onclick = function () { startPlaying(); };
  hud.el.btnSave.onclick = function () { saveGame(false); };
  hud.el.btnRestartMission.onclick = function () {
    if (missions.active) { missions.start(missions.active.index); }
    startPlaying();
  };
  hud.el.btnQuit.onclick = function () {
    saveGame(true);
    G.state = 'menu';
    hud.showOnly(['menu']);
    hud.hide('hud');
    missions.stop(false);
    police.clear();
    player.reset(city.spots.spawn, 100);
  };
  hud.el.btnEndOk.onclick = respawn;
  hud.el.btnContinue.disabled = !V.loadSave();

  // ---------- input ----------
  const KEYMAP = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'jump',
  };
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') e.preventDefault();
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = true;
    if (e.repeat) return;
    if (e.code === 'KeyM') { V.Audio.unlock(); V.Audio.toggleMute(); }
    if (e.code === 'KeyE') tryInteract();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyR' && missions.active) missions.start(missions.active.index);
  });
  window.addEventListener('keyup', function (e) {
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = false;
  });
  function togglePause() {
    if (G.state === 'playing') {
      G.state = 'paused';
      hud.fillMissions(missions.unlocked, missions.active ? missions.active.index : -1, function (i) {
        missions.start(i);
        startPlaying();
      });
      hud.showOnly(['pause']);
      hud.hide('hud');
    } else if (G.state === 'paused') {
      startPlaying();
    }
  }
  function tryInteract() {
    if (G.state !== 'playing') return;
    if (player.inCar) { player.exitCar({ audio: V.Audio, toast: function () {} }); return; }
    const car = player.nearestEnterable({
      parked: parked, missionTaxi: missions.taxiCar, missionSteal: missions.stealCar,
    });
    if (car) player.enterCar(car, { police: police, audio: V.Audio, toast: function (t, ms) { hud.toast(t, ms); } });
  }

  // mouse: drag orbits the camera, a still press shoots
  let mouseDown = false, dragMoved = false, lastX = 0, lastY = 0;
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', function (e) {
    mouseDown = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY;
    input.shoot = true;
    V.Audio.unlock();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!mouseDown) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 4) { dragMoved = true; input.shoot = false; }
    if (dragMoved) {
      camYaw -= dx * 0.005;
      camPitch = V.clamp(camPitch + dy * 0.004, 0.06, 1.15);
      lastDragAt = performance.now();
    }
  });
  window.addEventListener('pointerup', function () {
    mouseDown = false;
    input.shoot = false;
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- shot staging (deterministic scenes for the screenshots) ----------
  function stageShot(kind) {
    hud.showOnly([]);
    hud.show('hud');
    hud.hide('menu');
    G.state = 'playing';
    if (kind === 'cover') {
      missions.start(0);
      // at the crossroads, looking straight at the taxi stand between the blocks
      player.pos.set(0, 0, 128);
      player.heading = -1.15;
      camYaw = -1.15; camPitch = 0.3; stagedCamDist = 11;
    } else if (kind === 'chase') {
      const car = V.buildCar(scene, { color: 0xc23b3b, kind: 'sport', name: 'Comet S', topSpeed: 48 });
      car.pos.set(0, 0, 20);
      car.heading = 0;
      player.pos.set(0, 0, 20);
      player.health = 100;
      player.enterCar(car, { police: police, audio: V.Audio, toast: function () {} });
      car.speed = 30;
      police.stars = 3;
      police.spawnForStars(player.pos);
      police.cars.forEach(function (p, i) {
        p.car.pos.set(-4 + i * 8, 0, 20 - 22 - i * 12);
        p.car.heading = 0;
        p.car.speed = 32;
      });
      // front view: camera ahead of the car looking back, police visible behind it
      camYaw = Math.PI; camPitch = 0.25; stagedCamDist = 13;
    } else if (kind === 'mission') {
      missions.unlocked = 2;
      missions.start(1);
      if (missions.active) {
        missions.active.step = 1;
        missions._beginStep();
      }
      player.pos.set(-60, 0, 148);
      player.heading = 0.63;
      camYaw = 0.63; camPitch = 0.3;
    } else if (kind === 'city') {
      player.pos.set(0, 0, -40);
      player.heading = 0;
      camYaw = 0; camPitch = 0.55; stagedCamDist = 70;
    }
    hud.setCash(G.cash);
    hud.setStars(police.wanted());
  }
  if (shotMode) stageShot(shotMode);

  // ---------- main loop ----------
  const clock = new THREE.Clock();
  let firstFrame = true;

  function allCars() {
    const list = traffic.cars().concat(police.allCars(), parked);
    if (player.car) list.push(player.car);
    return list;
  }

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta() || 0.016, 0.05);
    const now = performance.now();

    if (G.state === 'menu') {
      menuOrbit += dt * 0.05;
      camera.position.set(
        Math.sin(menuOrbit) * 190, 95 + Math.sin(menuOrbit * 0.7) * 18,
        Math.cos(menuOrbit) * 190);
      camera.lookAt(20, 18, 0);
      renderer.render(scene, camera);
      return;
    }
    if (G.state === 'paused' || G.state === 'end') {
      renderer.render(scene, camera);
      return;
    }

    // ----- playing -----
    const driveInput = {
      forward: input.forward, back: input.back,
      left: input.left, right: input.right,
      handbrake: input.jump,
    };
    const ctx = {
      camera: camera, colliders: city.colliders, crowd: crowd, traffic: traffic,
      police: police, parked: parked, missionTaxi: missions.taxiCar,
      missionSteal: missions.stealCar, audio: V.Audio,
      toast: function (t, ms) { hud.toast(t, ms); },
    };

    if (player.inCar) {
      if (shotMode === 'chase') driveInput.forward = true; // keep the getaway rolling
      const crashed = V.drivePlayerCar(player.car, driveInput, dt, city.colliders, allCars());
      if (crashed) {
        V.Audio.crash(true);
        hud.flashDamage();
        if (!shotMode && Math.abs(player.car.speed) > 20) player.damage(4, 'crash');
      }
      // auto-align camera behind the car when the player is not dragging
      // (never in a staged shot: the shot sets its own angle)
      if (!shotMode && now - lastDragAt > 2000) camYaw = V.angleToward(camYaw, player.car.heading, dt * 1.4);
      if (stagedCamDist) camDist = stagedCamDist;
      else if (shotMode !== 'city') camDist = 13;
      V.Audio.setEngine(Math.abs(player.car.speed) / player.car.topSpeed, true);
    } else {
      player.update(dt, input, camYaw, ctx);
      if (stagedCamDist) camDist = stagedCamDist;
      else if (shotMode !== 'city') camDist = 9;
      V.Audio.setEngine(0, false);
    }

    traffic.update(dt, player.inCar ? player.car : null);
    crowd.update(dt);
    const law = police.update(dt, player, city.colliders, allCars());
    if (law.busted) {
      endScreen('BUSTED', 'The VPD picked you up. You lost $150 — and the whole city saw it.');
      applyPenalty(150);
    }
    if (law.rammed) {
      V.Audio.crash(true);
      hud.flashDamage();
      if (!shotMode) player.damage(6, 'ram');
    }
    missions.update(dt, player);

    // pickups
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 1.4 + Math.sin(now * 0.003 + i) * 0.25;
      if (V.dist2d(player.pos.x, player.pos.z, p.x, p.z) < 3) {
        p.taken = true;
        p.mesh.visible = false;
        G.cash += 25;
        hud.setCash(G.cash);
        V.Audio.pickup();
        hud.toast('+$25', 1200);
      }
    }

    // clean up long-fallen pedestrians
    cleanupTimer += dt;
    if (cleanupTimer > 5) {
      cleanupTimer = 0;
      for (let i = crowd.list.length - 1; i >= 0; i--) {
        const p = crowd.list[i];
        if (p.fallen) {
          p.fallenAt = p.fallenAt || now;
          if (now - p.fallenAt > 9000) {
            scene.remove(p.group);
            crowd.list.splice(i, 1);
          }
        }
      }
    }

    // ----- HUD -----
    const target = missions.targetPos();
    const stepText = missions.stepText();
    const activeName = missions.active ? missions.active.def.name : null;
    hud.setObjective(activeName, stepText,
      target ? V.dist2d(player.pos.x, player.pos.z, target.x, target.z) : null);
    hud.setHealth(player.health);
    hud.setStars(police.wanted());
    if (player.inCar) hud.setSpeed(Math.abs(player.car.speed) * 3.6, player.car.name);
    else hud.setSpeed(0, null);
    hud.setCrosshair(!player.inCar && G.state === 'playing');
    if (!player.inCar) {
      const near = player.nearestEnterable({
        parked: parked, missionTaxi: missions.taxiCar, missionSteal: missions.stealCar,
      });
      hud.setPrompt(near ? '<b>[E]</b> Enter ' + near.name : null);
    } else {
      hud.setPrompt('<b>[E]</b> Exit car');
    }
    mapTimer += dt;
    if (mapTimer > 0.15) {
      mapTimer = 0;
      hud.drawMinimap(player, target, police.cars.map(function (p) { return p.car; }), police.cops);
    }

    // ----- camera -----
    const focus = player.inCar ? player.car.pos : player.pos;
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const wantX = focus.x - fx * camDist * cp;
    const wantY = focus.y + 1.6 + camDist * sp;
    const wantZ = focus.z - fz * camDist * cp;
    const k = firstFrame ? 1 : Math.min(1, dt * 8);
    camera.position.x += (wantX - camera.position.x) * k;
    camera.position.y += (wantY - camera.position.y) * k;
    camera.position.z += (wantZ - camera.position.z) * k;
    camera.lookAt(focus.x + fx * 2, focus.y + 1.6, focus.z + fz * 2);
    const targetFov = player.inCar ? 60 + Math.abs(player.car.speed) / player.car.topSpeed * 9 : 60;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
    }
    firstFrame = false;
    renderer.render(scene, camera);
  }
  tick();
})();
