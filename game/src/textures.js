// VELDORA v6 — canvas-generated textures: building windows, road markings, beach sand.
import * as THREE from 'three';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildingTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 12; y < h - 12; y += 22) {
      for (let x = 10; x < w - 10; x += 18) {
        g.fillStyle = Math.random() < lit ? '#ffd98a' : '#1c2733';
        g.fillRect(x, y, 10, 13);
      }
    }
  });
}

export function roadTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#2a2d34'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8c33a';
    for (let y = 0; y < h; y += 32) g.fillRect(w / 2 - 2, y, 4, 18);
    g.fillStyle = 'rgba(255,255,255,.25)';
    g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
}

export function sandTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#d9b77c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#c9a86b' : '#e6c98f';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}
