// input.js — keyboard + mouse input for VELDORA (desktop, keyboard and mouse).
// Tracks held keys, edge-triggered presses, and camera orbit dragging.
// Mouse orbit: hold the left button and drag to swing the camera; the wheel zooms.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered: consumed once per frame by takePressed
    this.mouseDX = 0; this.mouseDY = 0;
    this.wheelDelta = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // left click (shoot) edge
    this.dragging = false;
    this.lastX = 0; this.lastY = 0;
    this.enabled = true;
    this._canvas = canvas;
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onBlur = () => { this.keys.clear(); this.dragging = false; };
    this._onMouseDown = (e) => {
      if (!this.enabled) return;
      if (e.button === 0) { this.mouseDown = true; this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; this.mouseClicked = true; }
    };
    this._onMouseUp = (e) => { if (e.button === 0) { this.mouseDown = false; this.dragging = false; } };
    this._onMouseMove = (e) => {
      if (this.dragging) {
        this.mouseDX += e.clientX - this.lastX;
        this.mouseDY += e.clientY - this.lastY;
        this.lastX = e.clientX; this.lastY = e.clientY;
      }
    };
    this._onWheel = (e) => { this.wheelDelta += e.deltaY; };
    this._onContext = (e) => e.preventDefault();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('wheel', this._onWheel, { passive: true });
    canvas.addEventListener('contextmenu', this._onContext);
  }

  held(code) { return this.keys.has(code); }
  // WASD + arrows as -1/0/+1 axes.
  axis() {
    const f = (this.held('KeyW') || this.held('ArrowUp') ? 1 : 0) - (this.held('KeyS') || this.held('ArrowDown') ? 1 : 0);
    const r = (this.held('KeyD') || this.held('ArrowRight') ? 1 : 0) - (this.held('KeyA') || this.held('ArrowLeft') ? 1 : 0);
    return { fwd: f, right: r };
  }
  takePressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  takeClick() { const c = this.mouseClicked; this.mouseClicked = false; return c; }
  takeMouseDelta() { const d = { x: this.mouseDX, y: this.mouseDY }; this.mouseDX = 0; this.mouseDY = 0; return d; }
  takeWheel() { const w = this.wheelDelta; this.wheelDelta = 0; return w; }
  endFrame() { this.pressed.clear(); this.mouseClicked = false; }
}
