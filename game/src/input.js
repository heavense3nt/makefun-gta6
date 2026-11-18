// input.js — keyboard + mouse state, with edge-triggered "pressed" events.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedQueue = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.wheelDelta = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedQueue.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; this.dragging = false; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.dragging = true;
      this.lastX = e.clientX; this.lastY = e.clientY;
      if (e.button === 0) this.pressedQueue.add('MouseLeft');
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.clientX - this.lastX;
      this.mouseDY += e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => { this.wheelDelta += e.deltaY; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.pressedQueue.has(code); }
  // Axis helpers: -1 / 0 / +1.
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  // WASD + arrows as movement input. right: D / ArrowRight, forward: W / ArrowUp.
  moveAxes() {
    const ix = this.axis('KeyA', 'KeyD') || this.axis('ArrowLeft', 'ArrowRight');
    const iz = this.axis('KeyS', 'KeyW') || this.axis('ArrowDown', 'ArrowUp');
    return { ix, iz };
  }
  // Consume per-frame deltas at the end of the frame.
  endFrame() {
    this.pressedQueue.clear();
    this.mouseDX = 0; this.mouseDY = 0; this.wheelDelta = 0;
  }
}
