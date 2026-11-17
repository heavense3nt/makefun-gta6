// Pistol combat: hitscan shots from Rico's hand toward the camera's aim point.
// A shot that lands on a pedestrian or a cop drops them and raises the heat;
// a shot at a car chips its paint and startles the driver. Muzzle flash and a
// tracer line make every shot read on screen.

const THREE = window.THREE;

export function createCombat(scene, camera) {
  const raycaster = new THREE.Raycaster();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.9 });
  let flash = null;
  let flashTimer = 0;
  let tracer = null;
  let tracerTimer = 0;
  let cooldown = 0;

  function muzzleFlash(origin) {
    if (!flash) {
      flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd23e }),
      );
      scene.add(flash);
    }
    flash.position.copy(origin);
    flash.visible = true;
    flashTimer = 0.06;
  }

  function showTracer(from, to) {
    if (tracer) scene.remove(tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    tracer = new THREE.Line(geo, tracerMat);
    scene.add(tracer);
    tracerTimer = 0.08;
  }

  // Returns { hit: 'ped'|'cop'|'car'|'none', target } for the shot.
  function shoot(origin, aimPoint, targets) {
    if (cooldown > 0) return null;
    cooldown = 0.28;
    const dir = aimPoint.clone().sub(origin).normalize();
    raycaster.set(origin, dir);
    raycaster.far = 90;
    const meshes = [];
    for (const t of targets) meshes.push(t.mesh ?? t);
    const hits = raycaster.intersectObjects(meshes, true);
    const end = origin.clone().add(dir.clone().multiplyScalar(90));
    let result = { hit: 'none', target: null, point: end };
    if (hits.length > 0) {
      const hit = hits[0];
      result.point = hit.point.clone();
      // walk up to the object that owns a `userData.targetRef`
      let obj = hit.object;
      while (obj && !obj.userData.targetRef) obj = obj.parent;
      if (obj?.userData.targetRef) {
        result.target = obj.userData.targetRef;
        result.hit = obj.userData.targetKind ?? 'ped';
      }
    }
    muzzleFlash(origin.clone().add(dir.clone().multiplyScalar(0.8)));
    showTracer(origin, result.point);
    return result;
  }

  function step(dt) {
    cooldown = Math.max(0, cooldown - dt);
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0 && flash) flash.visible = false;
    }
    if (tracerTimer > 0) {
      tracerTimer -= dt;
      if (tracerTimer <= 0 && tracer) { scene.remove(tracer); tracer = null; }
    }
  }

  return { shoot, step };
}
