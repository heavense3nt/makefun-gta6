// VELDORA v7 — canvas-painted textures: no image files, no network.
import * as THREE from 'three';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A building face: dusk-lit windows on a coloured wall.
export function buildingTexture(base, litRatio) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
    for (let y = 10; y < h - 8; y += 22) {
      for (let x = 10; x < w - 12; x += 20) {
        const lit = Math.random() < litRatio;
        g.fillStyle = lit ? '#ffd98a' : '#1c2436';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
}

// Asphalt with a dashed centre line.
export function roadTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#23262e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3e48';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.fillStyle = '#d8c56a'; g.fillRect(w / 2 - 2, 8, 4, 26);
    g.fillRect(w / 2 - 2, 72, 4, 26);
  });
}

// Sand with speckles.
export function sandTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#c9a86a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#b8945a' : '#d9bc82';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// Sidewalk / plaza paving.
export function pavementTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#4a4a52'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#33333a'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}
