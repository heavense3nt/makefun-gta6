// Keyboard and mouse input for Veldora. Held keys are read every frame as a
// movement intent; one-shot presses (enter car, shoot, pause, mission) are queued
// as flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. Pointer lock gives mouse-look on the canvas.

export const ACT_ENTER = 1;
export const ACT_SHOOT = 2;
export const ACT_PAUSE = 4;
export const ACT_MISSION = 8;
export const ACT_JUMP = 16;
export const ACT_MUTE = 32;
export const ACT_CAMERA = 64;

const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = { forward: false, back: false, left: false, right: false, run: false };
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let pointerLocked = false;

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) { held[name] = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'KeyE') actions |= ACT_ENTER;
    else if (event.code === 'KeyF') actions |= ACT_SHOOT;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    else if (event.code === 'KeyR') actions |= ACT_MISSION;
    else if (event.code === 'Space') { actions |= ACT_JUMP; event.preventDefault(); }
    else if (event.code === 'KeyM') actions |= ACT_MUTE;
    else if (event.code === 'KeyC') actions |= ACT_CAMERA;
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
  });

  canvas.addEventListener('click', () => {
    if (!pointerLocked && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (pointerLocked) { lookDX += event.movementX; lookDY += event.movementY; }
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) actions |= ACT_SHOOT;
  });

  return {
    held,
    takeActions() { const taken = actions; actions = 0; return taken; },
    /** Mouse-look delta since the last call, in pixels. */
    takeLook() { const d = { x: lookDX, y: lookDY }; lookDX = 0; lookDY = 0; return d; },
    /** -1/0/1 strafe intent: right key minus left key. D must mean screen-right. */
    strafe() { return (held.right ? 1 : 0) - (held.left ? 1 : 0); },
    /** -1/0/1 forward intent: forward key minus back key. */
    throttle() { return (held.forward ? 1 : 0) - (held.back ? 1 : 0); },
  };
}
