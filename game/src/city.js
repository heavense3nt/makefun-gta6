// VELDORA — the city itself: a sun-soaked coastal grid with roads, towers, a beach
// and a sea, all built procedurally from a seed. Exports V.buildCity(scene, rng).

V.buildCity = function buildCity(scene, rng) {
  const ROAD_W = 10, BLOCK = 40, HALF = 168;
  const roadCoords = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
  const blockCenters = [-140, -100, -60, -20, 20, 60, 100, 140];
  const city = {
    colliders: [], buildings: [], roads: [], bounds: { min: -HALF, max: HALF },
    seaZ: 172, roadCoords: roadCoords, blockCenters: blockCenters,
    spots: {},
  };

  // ---------- canvas texture helpers ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  function buildingTexture(base, lit) {
    return canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 40; i++) g.fillRect(rng() * w, rng() * h, 3, 3);
      for (let y = 12; y < h - 10; y += 22) {
        for (let x = 10; x < w - 10; x += 20) {
          g.fillStyle = rng() < lit ? '#ffd98a' : '#20262e';
          g.fillRect(x, y, 12, 14);
        }
      }
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, 0, w, 6);
    });
  }

  const facadeTex = [
    buildingTexture('#c98f5f', 0.25),
    buildingTexture('#8fa3b8', 0.2),
    buildingTexture('#b8a88a', 0.3),
    buildingTexture('#7d8a99', 0.15),
    buildingTexture('#d9a05b', 0.35),
  ];
  const roadTex = canvasTex(128, 256, function (g, w, h) {
    g.fillStyle = '#33363c'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 120; i++) g.fillRect(rng() * w, rng() * h, 2, 2);
    g.fillStyle = '#e8e8e8';
    g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
    g.fillStyle = '#f5d76e';
    for (let y = 0; y < h; y += 32) g.fillRect(w / 2 - 2, y, 4, 18);
  });
  roadTex.repeat.set(1, 14);
  const walkTex = canvasTex(128, 128, function (g, w, h) {
    g.fillStyle = '#9aa0a3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
    }
  });
  walkTex.repeat.set(3, 3);

  // ---------- sky, sun, sea ----------
  const skyTex = canvasTex(4, 256, function (g, w, h) {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#3d7ac2'); grad.addColorStop(0.55, '#8ec3e8');
    grad.addColorStop(0.8, '#ffd9a0'); grad.addColorStop(1, '#ffb37a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }));
  sun.position.set(-260, 260, -700);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  // a few lazy clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(V.range(rng, 8, 16), 8, 6), cloudMat);
      s.position.set(j * 12 - 18 + rng() * 6, rng() * 3, rng() * 6);
      s.scale.y = 0.45;
      cl.add(s);
    }
    cl.position.set(V.range(rng, -500, 500), V.range(rng, 120, 220), V.range(rng, -500, 100));
    scene.add(cl);
  }

  // ---------- ground, beach, sea ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x7d9b58 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 26),
    new THREE.MeshLambertMaterial({ color: 0xe2cd96 }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.0, 178);
  scene.add(beach);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 320),
    new THREE.MeshLambertMaterial({ color: 0x2a7ab8, transparent: true, opacity: 0.94 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, 350);
  scene.add(sea);

  // ---------- roads + sidewalks ----------
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const roadGeoX = new THREE.PlaneGeometry(340, ROAD_W);
  const roadGeoZ = new THREE.PlaneGeometry(ROAD_W, 340);
  roadCoords.forEach(function (c, i) {
    const rx = new THREE.Mesh(roadGeoX, roadMat);
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(0, 0.02 + (i % 2) * 0.005, c);
    scene.add(rx);
    const rz = new THREE.Mesh(roadGeoZ, roadMat);
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(c, 0.02 + ((i + 1) % 2) * 0.005, 0);
    scene.add(rz);
    city.roads.push({ axis: 'z', at: c, min: -165, max: 165 });
    city.roads.push({ axis: 'x', at: c, min: -165, max: 165 });
  });
  const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
  blockCenters.forEach(function (bx) {
    blockCenters.forEach(function (bz) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 2, BLOCK - 2), walkMat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(bx, 0.012, bz);
      scene.add(w);
    });
  });

  // ---------- buildings ----------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  function addBuilding(x, z, w, d, hgt, mat) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, hgt, d);
    m.position.set(x, hgt / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w + 0.6, 0.5, d + 0.6);
    roof.position.set(x, hgt + 0.25, z);
    scene.add(roof);
    city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    city.buildings.push({ x: x, z: z, w: w, d: d, h: hgt });
    return m;
  }
  const parks = new Set(['-140,140', '140,-140', '20,20']);
  blockCenters.forEach(function (bx) {
    blockCenters.forEach(function (bz) {
      const key = bx + ',' + bz;
      const distC = Math.abs(bx) + Math.abs(bz);
      if (parks.has(key)) return; // park / plaza instead
      const n = distC < 60 ? 2 : (rng() < 0.55 ? 2 : 1);
      for (let k = 0; k < n; k++) {
        const w = V.range(rng, 12, 20), d = V.range(rng, 12, 20);
        const hgt = distC < 60 ? V.range(rng, 22, 46) : V.range(rng, 8, 26);
        const ox = n === 1 ? 0 : (k === 0 ? -8 : 8);
        const oz = n === 1 ? 0 : (k === 0 ? -8 : 8);
        const mat = new THREE.MeshLambertMaterial({
          map: V.pick(rng, facadeTex),
        });
        addBuilding(bx + ox, bz + oz, w, d, hgt, mat);
      }
    });
  });

  // ---------- landmarks ----------
  // Veldora Spire — the tall tower at the plaza (20,20)
  addBuilding(20, 20, 26, 26, 72, new THREE.MeshLambertMaterial({ map: facadeTex[1], color: 0xd8e2ea }));
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 22, 6),
    new THREE.MeshLambertMaterial({ color: 0x888888 }));
  antenna.position.set(20, 83, 20);
  scene.add(antenna);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  beacon.position.set(20, 94, 20);
  scene.add(beacon);
  city.spots.spire = { x: 20, z: 20 };
  // Grand Veldora Hotel on the beach road
  addBuilding(-60, 150, 34, 16, 30, new THREE.MeshLambertMaterial({ map: facadeTex[4] }));
  city.spots.hotel = { x: -60, z: 138 };
  // Docks: wooden piers into the sea
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  [-100, -60, 100].forEach(function (px) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 30), pierMat);
    pier.position.set(px, 0.6, 200);
    scene.add(pier);
  });
  city.spots.docks = { x: -60, z: 165 };
  // Hospital (north-west), garage (west), hideout (north-east)
  addBuilding(-140, -140, 26, 18, 18, new THREE.MeshLambertMaterial({ map: facadeTex[3], color: 0xe8f0f4 }));
  city.spots.hospital = { x: -140, z: -118 };
  addBuilding(-140, 60, 24, 18, 12, new THREE.MeshLambertMaterial({ map: facadeTex[0] }));
  city.spots.garage = { x: -140, z: 78 };
  addBuilding(140, -100, 22, 18, 14, new THREE.MeshLambertMaterial({ map: facadeTex[2] }));
  city.spots.hideout = { x: 140, z: -82 };
  city.spots.spawn = { x: 0, z: 55 };
  city.spots.taxiStand = { x: -40, z: 138 };

  // ---------- parks, palms, lamps ----------
  function addPalm(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 7 * s, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
    trunk.position.y = 3.5 * s;
    trunk.rotation.z = 0.08;
    g.add(trunk);
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3f });
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 4.5 * s, 4), crownMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6 * s, 7.2 * s, Math.sin(a) * 1.6 * s);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
  }
  for (let x = -160; x <= 160; x += 20) { addPalm(x + 6, 172, 1); if (rng() < 0.5) addPalm(x - 4, 166, 0.9); }
  parks.forEach(function (key) {
    const parts = key.split(',');
    const px = +parts[0], pz = +parts[1];
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 4, BLOCK - 4),
      new THREE.MeshLambertMaterial({ color: 0x5d8a48 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(px, 0.02, pz);
    scene.add(lawn);
    for (let i = 0; i < 4; i++) addPalm(px + V.range(rng, -14, 14), pz + V.range(rng, -14, 14), V.range(rng, 0.8, 1.2));
  });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  roadCoords.forEach(function (c) {
    [-120, -40, 40, 120].forEach(function (o) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), lampMat);
      pole.position.set(o + 5.4, 3.5, c);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.5), lampHeadMat);
      head.position.set(o + 4.6, 7, c);
      scene.add(head);
    });
  });

  // ---------- district labels ----------
  function districtLabel(text, x, y, z) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const g = c.getContext('2d');
    g.font = 'bold 52px Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 10;
    g.fillText(text, 256, 48);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(46, 8.6, 1);
    spr.position.set(x, y, z);
    scene.add(spr);
  }
  districtLabel('DOWNTOWN', 0, 58, -60);
  districtLabel('DOCKS', -60, 46, 150);
  districtLabel('VELDORA BEACH', 80, 40, 168);

  // invisible walls at the city edge + sea line
  city.colliders.push({ minX: -HALF - 4, maxX: -HALF, minZ: -400, maxZ: 400 });
  city.colliders.push({ minX: HALF, maxX: HALF + 4, minZ: -400, maxZ: 400 });
  city.colliders.push({ minX: -400, maxX: 400, minZ: -HALF - 4, maxZ: -HALF });
  city.colliders.push({ minX: -400, maxX: 400, minZ: 186, maxZ: 190 });

  return city;
};
