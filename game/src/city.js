// city.js — the ground of Solmar Bay: asphalt grid, sidewalks, sand beach,
// ocean, pier, road graph for traffic, and the building plots the city fills.
import * as THREE from 'three';
import { CONFIG, CITY, PALETTE, } from './config.js';
import { makeRng } from './utils.js';

export class City {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(CONFIG.seed);
    this.plots = [];      // {x, z, w, d} buildable rectangles inside blocks
    this.roadLines = [];  // road centre lines, for traffic + minimap
    this.buildGround();
    this.buildRoads();
    this.buildBeach();
    this.buildPlots();
  }
  buildGround() {
    const g = new THREE.Group();
    const size = CITY.size + 260;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    g.add(ground);
    // Big flat ocean to the south (positive Z) beyond the beach.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(size, 320),
      new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.35, CITY.half + 150);
    g.add(sea);
    const deep = new THREE.Mesh(
      new THREE.PlaneGeometry(size, 200),
      new THREE.MeshLambertMaterial({ color: PALETTE.seaDeep }),
    );
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(0, -0.4, CITY.half + 380);
    g.add(deep);
    this.scene.add(g);
  }
  buildRoads() {
    const g = new THREE.Group();
    const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
    const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
    const n = CONFIG.cityBlocks;
    const pitch = CITY.pitch;
    const road = CONFIG.roadWidth;
    const span = CITY.size + road;
    // Roads are strips centred on the gaps between blocks. Block i spans
    // [-half + i*pitch, -half + i*pitch + blockSize]; the road after it is
    // centred at -half + i*pitch + blockSize + road/2.
    for (let i = 0; i < n; i++) {
      const edge = -CITY.half + i * pitch + CONFIG.blockSize;
      const c = edge + road / 2;
      const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(road, span), roadMat);
      vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(c, 0.02, 0);
      vRoad.receiveShadow = true; g.add(vRoad);
      const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(span, road), roadMat);
      hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.02, c);
      hRoad.receiveShadow = true; g.add(hRoad);
      // Dashed centre lines.
      for (let d = -CITY.half; d < CITY.half; d += 12) {
        const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
        dashV.rotation.x = -Math.PI / 2; dashV.position.set(c, 0.04, d + 6);
        g.add(dashV);
        const dashH = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
        dashH.rotation.x = -Math.PI / 2; dashH.position.set(d + 6, 0.04, c);
        g.add(dashH);
      }
      // Sidewalk frames around each block.
      const bx = -CITY.half + i * pitch + CONFIG.blockSize / 2;
      for (let j = 0; j < n; j++) {
        const bz = -CITY.half + j * pitch + CONFIG.blockSize / 2;
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.blockSize + 4, CONFIG.blockSize + 4), walkMat);
        walk.rotation.x = -Math.PI / 2; walk.position.set(bx, 0.01, bz);
        walk.receiveShadow = true; g.add(walk);
      }
      this.roadLines.push(c);
    }
    // Outer ring road around the whole grid.
    const outer = CITY.half + road / 2;
    for (const [w, h, x, z] of [
      [road, span + road * 2, -outer, 0], [road, span + road * 2, outer, 0],
      [span + road * 2, road, 0, -outer], [span + road * 2, road, 0, outer],
    ]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, h), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.02, z);
      r.receiveShadow = true; g.add(r);
    }
    this.roadLines.push(-outer, outer);
    this.scene.add(g);
  }
  buildBeach() {
    const g = new THREE.Group();
    const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size + 260, 46), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.0, CITY.half + 34);
    sand.receiveShadow = true;
    g.add(sand);
    // Boardwalk pier reaching into the sea.
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 90), wood);
    pier.position.set(-60, 0.6, CITY.half + 80);
    pier.castShadow = true; g.add(pier);
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.4, 6), wood);
      post.position.set(-60 + (i % 2 === 0 ? -4.4 : 4.4), -0.6, CITY.half + 48 + i * 16);
      g.add(post);
    }
    this.scene.add(g);
  }
  buildPlots() {
    const n = CONFIG.cityBlocks;
    const pitch = CITY.pitch;
    const rng = this.rng;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const bx = -CITY.half + i * pitch;
        const bz = -CITY.half + j * pitch;
        // Split each block into 1-4 plots (mostly 4, so the city stays dense).
        const splits = rng() < 0.15 ? 1 : rng() < 0.35 ? 2 : 4;
        const bs = CONFIG.blockSize;
        if (splits === 1) {
          this.plots.push({ x: bx + 3, z: bz + 3, w: bs - 6, d: bs - 6 });
        } else if (splits === 2) {
          this.plots.push({ x: bx + 3, z: bz + 3, w: bs - 6, d: bs / 2 - 4 });
          this.plots.push({ x: bx + 3, z: bz + bs / 2 + 1, w: bs - 6, d: bs / 2 - 4 });
        } else {
          const q = bs / 2;
          for (const [ox, oz] of [[0, 0], [q, 0], [0, q], [q, q]]) {
            this.plots.push({ x: bx + ox + 2, z: bz + oz + 2, w: q - 4, d: q - 4 });
          }
        }
      }
    }
  }
  // Is a point on a road (drivable)? Roads are the gaps between blocks plus ring.
  isOnRoad(x, z) {
    const n = CONFIG.cityBlocks;
    const pitch = CITY.pitch;
    const road = CONFIG.roadWidth;
    const inGrid = Math.abs(x) <= CITY.half + road && Math.abs(z) <= CITY.half + road;
    if (!inGrid) return Math.abs(z) > CITY.half; // beach / sea edge
    for (let i = 0; i < n; i++) {
      const edge = -CITY.half + i * pitch + CONFIG.blockSize;
      if (x >= edge - 1 && x <= edge + road + 1) return true;
      if (z >= edge - 1 && z <= edge + road + 1) return true;
    }
    return Math.abs(x) > CITY.half - 1 || Math.abs(z) > CITY.half - 1;
  }
  // Nearest road centreline coordinate on one axis (for traffic waypoints).
  nearestRoadCoord(v) {
    let best = this.roadLines[0];
    let bd = Infinity;
    for (const c of this.roadLines) {
      const d = Math.abs(c - v);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  randomRoadPoint(rng) {
    const c = this.roadLines[Math.floor(rng() * this.roadLines.length)];
    const along = (rng() * 2 - 1) * CITY.half;
    return rng() < 0.5 ? { x: c, z: along } : { x: along, z: c };
  }
}
