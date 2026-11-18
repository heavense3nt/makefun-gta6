// VELDORA v6 — keyboard + mouse input. One-shot actions are consumed once per press.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let shooting = false;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('mousedown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    if (e.button === 0) shooting = true;
  });
  window.addEventListener('mouseup', (e) => { dragging = false; if (e.button === 0) shooting = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); shooting = false; dragging = false; });

  return {
    // -1..1 on each axis, from WASD / arrows.
    forwardInput() { return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); },
    strafeInput() { return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0); },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takePressed(code) {
      if (pressed.has(code)) { pressed.delete(code); return true; }
      return false;
    },
    consumeMouse() { const d = { x: mouseDX, y: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    isShooting() { return shooting; },
    clearPressed() { pressed.clear(); },
  };
}
