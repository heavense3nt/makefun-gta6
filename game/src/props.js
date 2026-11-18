// props.js — street furniture that makes the city feel lived-in: palm trees
// along the beach road, lamps that glow at dusk, benches, hydrants, bus stops
// and the big VELDORA sign over the marina.
import * as THREE from 'three';
import { CONFIG, CITY, PALETTE } from './config.js';
import { makeRng, randRange } from './utils.js';

export class Props {
  constructor(scene, city) {
    this.scene = scene;
    this.rng = makeRng(CONFIG.seed + 13);
    this.lampLights = [];
    this.build(city);
  }
  build(city) {
    const rng = this.rng;
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
    const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    // Palms down the beach road and scattered on sidewalks.
    for (let i = 0; i < 46; i++) {
      const x = -CITY.half + (i + 0.5) * (CITY.size / 46) + randRange(rng, -4, 4);
      const z = CITY.half + 8 + randRange(rng, -3, 3);
      this.palm(g, x, z, trunkMat, leafMat, rng);
    }
    for (let i = 0; i < 30; i++) {
      const p = city.randomRoadPoint(rng);
      const x = p.x + (rng() < 0.5 ? 9 : -9);
      const z = p.z + (rng() < 0.5 ? 9 : -9);
      if (Math.abs(x) < CITY.half && Math.abs(z) < CITY.half) this.palm(g, x, z, trunkMat, leafMat, rng);
    }
    // Lamps along every other road intersection.
    for (const cx of city.roadLines) {
      for (const cz of city.roadLines) {
        if (rng() < 0.45) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), lampMat);
        pole.position.set(cx + 7.6, 3.25, cz + 7.6);
        pole.castShadow = true;
        g.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), lampGlowMat);
        bulb.position.set(cx + 7.6, 6.7, cz + 7.6);
        g.add(bulb);
        const light = new THREE.PointLight(0xffe9a8, 0, 26, 1.6);
        light.position.set(cx + 7.6, 6.6, cz + 7.6);
        g.add(light);
        this.lampLights.push(light);
      }
    }
    // Benches + hydrants near the beach.
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x7a4a28 });
    for (let i = 0; i < 12; i++) {
      const x = -CITY.half + 20 + i * 34;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
      bench.position.set(x, 0.8, CITY.half + 12);
      g.add(bench);
      for (const lx of [-1.3, 1.3]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.9), lampMat);
        leg.position.set(x + lx, 0.4, CITY.half + 12);
        g.add(leg);
      }
    }
    const hydMat = new THREE.MeshLambertMaterial({ color: 0xd83232 });
    for (let i = 0; i < 10; i++) {
      const p = city.randomRoadPoint(rng);
      const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8), hydMat);
      hyd.position.set(p.x + 8, 0.45, p.z + 8);
      g.add(hyd);
    }
    // Big marina sign: the city's name in lights.
    this.buildSign(g, -60, CITY.half + 60);
    this.scene.add(g);
  }
  palm(g, x, z, trunkMat, leafMat, rng) {
    const h = randRange(rng, 5, 8);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, h, 7), trunkMat);
    trunk.position.set(x, h / 2, z);
    trunk.rotation.z = randRange(rng, -0.08, 0.08);
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.3, h + 0.4, z + Math.sin(a) * 1.3);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      g.add(leaf);
    }
  }
  buildSign(g, x, z) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#14102a';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffd23e';
    ctx.font = '900 84px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VELDORA', 256, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(16, 4, 0.6),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    board.position.set(x, 9, z);
    board.castShadow = true;
    g.add(board);
    for (const px of [-7, 7]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 9, 6),
        new THREE.MeshLambertMaterial({ color: 0x3a3f4a }));
      post.position.set(x + px, 4.5, z);
      g.add(post);
    }
  }
  // Dusk: lamps come on as the sun drops.
  setNight(factor) {
    for (const l of this.lampLights) l.intensity = factor * 30;
  }
}
