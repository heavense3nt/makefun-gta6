// Screenshot staging: ?shot=cover|chase|mission|city sets the real game up in a
// photogenic state and lets it run live for a couple of seconds before the
// capture. Nothing here is faked — the same world, HUD and rules a player sees,
// just positioned and warmed up. window.__shotReady flips true once the scene
// has settled, so the capture script knows when to shoot. Every staged position
// sits on a road or in the open plaza, never inside a building footprint, so
// the camera is never blocked and nothing gets pushed out by collision.

export function stageShot(name, game) {
  const { player, vehicleSystem, police, missions, hud, rig, city } = game;
  hud.show('play');
  game.startPlay({ silent: true });

  if (name === 'cover') {
    // Rico on foot on the avenue south of the plaza, looking north past the
    // fountain at the Spire and the skyline, mission 1 started.
    player.teleport(0, 26);
    rig.yaw = Math.PI;
    missions.start(0);
    game.setCash(250);
  } else if (name === 'chase') {
    // Rico driving the Comet GT north down the central avenue at speed, 3
    // stars, VPD interceptors on his tail and one cutting across ahead.
    const car = vehicleSystem.comet;
    car.mesh.position.set(3, 0, 150);
    car.heading = Math.PI;
    car.speed = 18;
    game.enterCar(car, { silent: true });
    game.driveAssist = true; // hold the throttle so the frame shows speed
    police.addStars(3, () => {});
    const cops = police.cops;
    cops.forEach((cop, i) => {
      if (!cop.car) return;
      if (i === 0) { cop.car.mesh.position.set(3, 0, 215); cop.car.heading = Math.PI; cop.car.speed = 26; }
      else if (i === 1) { cop.car.mesh.position.set(14, 0, -40); cop.car.heading = Math.PI; cop.car.speed = 12; }
      else { cop.car.mesh.position.set(-4, 0, 220); cop.car.heading = Math.PI; cop.car.speed = 26; }
    });
    game.setCash(1250);
    missions.start(0);
  } else if (name === 'mission') {
    // Job 3, The Drop: Rico at the alley marker on the north-south road,
    // package about to be grabbed, wanted 2, the beacon burning gold.
    player.teleport(-54, -98);
    rig.yaw = Math.PI * 0.85;
    missions.start(2);
    police.addStars(2, () => {});
    game.setCash(640);
  } else if (name === 'city') {
    // Wide postcard view: a high fixed camera off the beach, looking
    // north-west across the whole city — sand and sea at the edge of frame,
    // the tower grid, the Spire and the plaza beyond.
    player.teleport(150, 0);
    rig.setFixedView(250, 80, 140, 0, 0, -20);
    missions.start(0);
    game.setCash(250);
  } else {
    player.teleport(0, 26);
    rig.yaw = Math.PI;
    missions.start(0);
  }

  // Let the world run live for a moment so traffic, peds and police settle
  // into the frame, then signal the capture.
  let frames = 0;
  function tick() {
    frames += 1;
    if (frames < 20) requestAnimationFrame(tick);
    else window.__shotReady = true;
  }
  requestAnimationFrame(tick);
}
