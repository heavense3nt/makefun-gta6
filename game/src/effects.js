// Cheap particles: dust kicked up by tyres, smoke from a wrecked car, sparks
// when metal meets concrete. One pooled Points cloud per burst type, recycled
// so the frame never allocates mid-chase.

const THREE = window.THREE;

export function createEffects(scene) {
  const bursts = [];

  function burst(pos, color, count, speed, life, size, gravity) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      vels.push({ x: Math.cos(a) * speed, y: up * speed, z: Math.sin(a) * speed });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    bursts.push({ points, vels, life, maxLife: life, gravity: gravity ?? 6 });
  }

  function dust(pos) { burst(pos, 0xcbb98a, 10, 2.2, 0.6, 0.5, 1); }
  function smoke(pos) { burst(pos, 0x555555, 14, 1.6, 1.4, 1.1, -1); }
  function sparks(pos) { burst(pos, 0xffd23e, 18, 6, 0.5, 0.28, 12); }

  function step(dt) {
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const b = bursts[i];
      b.life -= dt;
      const attr = b.points.geometry.getAttribute('position');
      for (let j = 0; j < b.vels.length; j += 1) {
        const v = b.vels[j];
        v.y -= b.gravity * dt;
        attr.array[j * 3] += v.x * dt;
        attr.array[j * 3 + 1] += v.y * dt;
        attr.array[j * 3 + 2] += v.z * dt;
      }
      attr.needsUpdate = true;
      b.points.material.opacity = Math.max(0, b.life / b.maxLife) * 0.9;
      if (b.life <= 0) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  return { dust, smoke, sparks, step };
}
