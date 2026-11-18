// textures.js — procedural canvas textures for VELDORA. The game ships no image files:
// building facades, roads and the beach are painted on canvases at boot and used as
// THREE.CanvasTexture maps. Returns THREE textures; needs THREE passed in (global).

export function makeBuildingTexture(THREE, rng, baseColor, floors) {
  const w = 128, h = 256;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = baseColor; g.fillRect(0, 0, w, h);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.08)'); grad.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // windows
  const cols = 4, rows = Math.max(4, floors || 8);
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < 0.28;
      g.fillStyle = lit ? '#ffd98a' : (rng() < 0.5 ? '#1d2733' : '#27384a');
      g.fillRect(c * cw + cw * 0.22, r * ch + ch * 0.25, cw * 0.56, ch * 0.5);
    }
  }
  // rooftop edge
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, 6);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeRoadTexture(THREE) {
  const w = 256, h = 256;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h);
  // asphalt noise
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  // center dashes along both axes (tile repeats per block)
  g.fillStyle = '#e8c33a';
  for (let i = 0; i < 4; i++) { g.fillRect(w / 2 - 3, i * 64 + 10, 6, 34); g.fillRect(i * 64 + 10, h / 2 - 3, 34, 6); }
  // edge lines
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(6, 0, 3, h); g.fillRect(w - 9, 0, 3, h); g.fillRect(0, 6, w, 3); g.fillRect(0, h - 9, w, 3);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSidewalkTexture(THREE) {
  const w = 128, h = 128;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#8d8578'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeBeachTexture(THREE) {
  const w = 256, h = 256;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#e2c98f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(120,90,40,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
