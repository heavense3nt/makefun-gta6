// buildings.js — Solmar Bay's skyline: ~180 stucco towers, shops and houses,
// each with lit windows from a generated canvas texture. Exports the AABB
// colliders the player, cars and AI all respect.
import * as THREE from 'three';
import { CONFIG, CITY, PALETTE } from './config.js';
import { makeRng, pick, randRange } from './utils.js';

function windowTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 10;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffe9a8' : '#2a3548';
      g.fillRect(10 + i * 30, 12 + j * 24, 18, 14);
    }
  }
  // Ground-floor shopfront: a thin awning band, not a giant stripe.
  g.fillStyle = '#4a3622';
  g.fillRect(0, 244, 128, 12);
  g.fillStyle = '#ffd23e';
  g.fillRect(6, 247, 116, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Buildings {
  constructor(scene, city) {
    this.scene = scene;
    this.colliders = [];
    this.rng = makeRng(CONFIG.seed + 7);
    this.build(city);
  }
  build(city) {
    const rng = this.rng;
    const group = new THREE.Group();
    const textures = PALETTE.buildingColors.slice(0, 4).map((col, i) => {
      const hex = '#' + col.toString(16).padStart(6, '0');
      return windowTexture(makeRng(CONFIG.seed + 31 + i), hex, 0.35);
    });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
    let placed = 0;
    for (const plot of city.plots) {
      if (placed >= CONFIG.buildingTarget) break;
      // Distance from the centre decides height: downtown towers, coast low.
      const cx = plot.x + plot.w / 2;
      const cz = plot.z + plot.d / 2;
      const distC = Math.hypot(cx, cz) / CITY.half;
      const coast = cz > CITY.half - 60 ? 0.35 : 1;
      let h;
      if (distC < 0.28) h = randRange(rng, 34, 62);
      else if (distC < 0.55) h = randRange(rng, 16, 34);
      else h = randRange(rng, 7, 16) * coast + 4;
      h = Math.max(6, h);
      const w = plot.w * randRange(rng, 0.62, 0.9);
      const d = plot.d * randRange(rng, 0.62, 0.9);
      const tex = pick(rng, textures);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(cx, h / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      // Roof slab + the odd rooftop box / antenna.
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6), roofMat);
      roof.position.set(cx, h + 0.35, cz);
      group.add(roof);
      if (rng() < 0.4) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(randRange(rng, 2, 4), 1.4, randRange(rng, 2, 4)),
          new THREE.MeshLambertMaterial({ color: 0x9aa2ac }));
        ac.position.set(cx + randRange(rng, -w / 4, w / 4), h + 1.4, cz + randRange(rng, -d / 4, d / 4));
        group.add(ac);
      }
      if (h > 40 && rng() < 0.5) {
        const ant = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.2, 9, 5),
          new THREE.MeshLambertMaterial({ color: 0xcc3333 }));
        ant.position.set(cx, h + 5, cz);
        group.add(ant);
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(0.45, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xff4444 }));
        tip.position.set(cx, h + 9.6, cz);
        group.add(tip);
      }
      this.colliders.push({
        minX: cx - w / 2, maxX: cx + w / 2,
        minZ: cz - d / 2, maxZ: cz + d / 2,
      });
      placed++;
    }
    this.count = placed;
    this.scene.add(group);
  }
  // Circle (x, z, radius) vs building AABBs: push the circle out, return the
  // corrected position. Used by the player, cars, traffic and pedestrians.
  collide(x, z, radius) {
    for (const b of this.colliders) {
      const nx = Math.max(b.minX, Math.min(x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 < 1e-8) { x = b.maxX + radius; continue; }
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      }
    }
    return { x, z };
  }
  hitsBuilding(x, z, radius = 0.4) {
    for (const b of this.colliders) {
      if (x + radius > b.minX && x - radius < b.maxX &&
          z + radius > b.minZ && z - radius < b.maxZ) return true;
    }
    return false;
  }
}
