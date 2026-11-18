// VELDORA v7 — keyboard + mouse input, with one-shot presses.
// NOTE: takePressed() returns a COPY of the pressed set before clearing it.
// Returning the live set and then clearing it would eat every one-shot
// action (reload, horn, pause) — the classic shared-Set bug.
export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.dragging = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.down.delete(e.code);
    this._onMouseDown = () => { this.dragging = true; };
    this._onMouseUp = () => { this.dragging = false; };
    this._onMouseMove = (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onWheel = (e) => { this.wheel += e.deltaY; e.preventDefault(); };
    this._onBlur = () => { this.down.clear(); this.dragging = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('blur', this._onBlur);
  }

  is(code) { return this.down.has(code); }

  // One-shot actions consumed once per frame.
  takePressed() {
    const copy = new Set(this.pressed);
    this.pressed.clear();
    return copy;
  }

  // Mouse deltas consumed once per frame.
  takeMouse() {
    const dx = this.mouseDX; const dy = this.mouseDY; const w = this.wheel;
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    return { dx, dy, wheel: w };
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onBlur);
  }
}
