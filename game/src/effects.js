// VELDORA v7 — particles: muzzle flashes, exhaust puffs, skid marks and
// cash sparkles. One pooled Points-free system of small quads.
import * as THREE from 'three';

export function createEffects(scene) {
  const group = new THREE.Group();
  group.name = 'effects';
  scene.add(group);
  const pool = [];
  const geo = new THREE.PlaneGeometry(0.5, 0.5);
  return {
    group, pool, geo,
    spawn(x, y, z, color, count, speed, life, size) {
      for (let i = 0; i < count; i++) {
        let p = pool.find((q) => !q.alive);
        if (!p) {
          if (pool.length > 220) return;
          p = { mesh: new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide })) };
          group.add(p.mesh);
          pool.push(p);
        }
        p.alive = true; p.life = life; p.maxLife = life;
        p.mesh.material.color.setHex(color);
        p.mesh.material.opacity = 1;
        p.mesh.scale.setScalar(size || 1);
        p.mesh.position.set(x, y, z);
        p.vx = (Math.random() - 0.5) * speed;
        p.vy = Math.random() * speed * 0.7;
        p.vz = (Math.random() - 0.5) * speed;
        p.mesh.visible = true;
      }
    },
    skid(x, z) {
      const mark = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 1.4),
        new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55 }),
      );
      mark.rotation.x = -Math.PI / 2;
      mark.rotation.z = Math.random() * Math.PI;
      mark.position.set(x, 0.03, z);
      group.add(mark);
      if (group.children.length > 400) group.remove(group.children[0]);
    },
    update(dt) {
      for (const p of pool) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 4 * dt;
        p.mesh.material.opacity = p.life / p.maxLife;
      }
    },
  };
}
