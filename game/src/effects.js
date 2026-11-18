// VELDORA v6 — visual effects: muzzle flashes, hit sparks, smoke puffs, day cycle.
import * as THREE from 'three';

export function createEffects(scene) {
  const group = new THREE.Group(); scene.add(group);
  const puffs = [];
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0.5 });
  return {
    muzzle(x, y, z) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      m.position.set(x, y, z); group.add(m); puffs.push({ mesh: m, life: 0.07, grow: 0 });
    },
    smoke(x, y, z) {
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.7, 8, 6), puffMat.clone());
        m.position.set(x + (Math.random() - 0.5) * 2, y + Math.random() * 1.5, z + (Math.random() - 0.5) * 2);
        group.add(m); puffs.push({ mesh: m, life: 1.6, grow: 1.4 });
      }
    },
    update(dt) {
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]; p.life -= dt;
        if (p.life <= 0) { group.remove(p.mesh); puffs.splice(i, 1); continue; }
        if (p.grow) { p.mesh.scale.multiplyScalar(1 + dt * p.grow); p.mesh.material.opacity = Math.max(0, p.life / 1.6) * 0.5; }
      }
    },
  };
}

// Golden dusk that slowly drifts: sun + hemisphere light follow the clock.
export function createDayCycle(scene) {
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(120, 140, 60); scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xaac8e8, 0x5a4a3a, 1.15); scene.add(hemi);
  scene.fog = new THREE.Fog(0xe8b07a, 200, 560);
  scene.background = new THREE.Color(0xf0b070);
  return {
    update(hour) {
      // hour 17..21: sun sinks, light warms.
      const t = Math.max(0, Math.min(1, (hour - 17) / 4));
      sun.intensity = 2.4 - t * 0.8;
      sun.color.setHSL(0.09 - t * 0.03, 0.7, 0.7 - t * 0.1);
      scene.background.setHSL(0.08 - t * 0.02, 0.5, 0.68 - t * 0.18);
    },
  };
}
