// weather.js — Solmar Bay's sky: a warm sun, drifting clouds, and a slow
// day cycle that slides into a golden dusk. The lamps come on as it darkens.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { makeRng, randRange, clamp } from './utils.js';

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(99);
    this.sun = new THREE.DirectionalLight(0xfff2c8, 2.6);
    this.sun.position.set(120, 180, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -260;
    this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260;
    this.sun.shadow.camera.bottom = -260;
    this.sun.shadow.camera.far = 700;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    this.ambient = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
    scene.add(this.ambient);
    scene.background = new THREE.Color(PALETTE.sky);
    scene.fog = new THREE.Fog(0x9fc4e8, 320, 900);
    // Puffy clouds: clusters of white spheres drifting slowly.
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const puffs = 3 + Math.floor(this.rng() * 3);
      for (let j = 0; j < puffs; j++) {
        const r = randRange(this.rng, 6, 13);
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
        s.position.set(j * 9 - puffs * 4, randRange(this.rng, -2, 2), randRange(this.rng, -5, 5));
        s.scale.y = 0.55;
        g.add(s);
      }
      g.position.set(randRange(this.rng, -320, 320), randRange(this.rng, 90, 150), randRange(this.rng, -320, 320));
      scene.add(g);
      this.clouds.push({ group: g, speed: randRange(this.rng, 1.2, 3.2) });
    }
  }
  // minutes: 0..1440. Day 6:00–18:00 is bright; dusk 18:00–20:00 warms up.
  update(dt, minutes, props) {
    const dayFrac = ((minutes - 360) / 720); // 0 at 6:00, 1 at 18:00
    const t = clamp(dayFrac, 0, 1);
    const sunAngle = Math.PI * (0.08 + t * 0.84);
    this.sun.position.set(Math.cos(sunAngle) * 260, Math.sin(sunAngle) * 220 + 20, 90);
    const dusk = t > 0.82 ? (t - 0.82) / 0.18 : 0;
    const night = minutes < 360 || minutes > 1200 ? 1 : 0;
    const dark = Math.max(dusk, night);
    this.sun.intensity = 2.6 - dark * 1.9;
    this.sun.color.setHex(dusk > 0.4 ? 0xffb36b : 0xfff2c8);
    this.ambient.intensity = 0.9 - dark * 0.45;
    const sky = new THREE.Color(PALETTE.sky);
    if (dusk > 0) sky.lerp(new THREE.Color(0xff9a5a), dusk * 0.7);
    if (night) sky.lerp(new THREE.Color(0x1a2340), 0.8);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    if (props) props.setNight(dark);
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > 360) c.group.position.x = -360;
    }
  }
}
