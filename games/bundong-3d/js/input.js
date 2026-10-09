// 키보드·마우스 입력과 포인터 잠금
export const input = {
  keys: new Set(),
  pressed: new Set(), // 이번 프레임에 눌린 키
  mouse: { dx: 0, dy: 0, left: false, right: false, leftPressed: false, rightPressed: false, wheel: 0 },
  locked: false,
  fallback: false,
  onFallback: null,
  canvas: null,
  onUnlock: null,
};

export function initInput(canvas) {
  input.canvas = canvas;
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ControlLeft'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  // 포인터 잠금이 막힌 환경(일부 iframe 등)에서는 '끌어서 둘러보기'로 대신함
  let drag = null;
  window.addEventListener('mousemove', (e) => {
    if (input.locked) {
      input.mouse.dx += e.movementX || 0;
      input.mouse.dy += e.movementY || 0;
    } else if (input.fallback && drag && e.target === canvas) {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      input.mouse.dx += dx * 1.6;
      input.mouse.dy += dy * 1.6;
    }
  });
  window.addEventListener('mousedown', (e) => {
    if (input.locked) {
      if (e.button === 0) { input.mouse.left = true; input.mouse.leftPressed = true; }
      if (e.button === 2) { input.mouse.right = true; input.mouse.rightPressed = true; }
    } else if (input.fallback && e.target === canvas) {
      drag = { button: e.button, moved: 0 };
      if (e.button === 2) { input.mouse.right = true; input.mouse.rightPressed = true; }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (input.fallback && drag && e.button === 0 && drag.moved < 6 && e.target === canvas) input.mouse.leftPressed = true;
    drag = null;
    if (e.button === 0) input.mouse.left = false;
    if (e.button === 2) input.mouse.right = false;
  });
  document.addEventListener('pointerlockerror', () => lockFailed());
  window.addEventListener('wheel', (e) => { if (input.locked) input.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    const was = input.locked;
    input.locked = document.pointerLockElement === canvas;
    if (input.locked) input.lockFails = 0;
    if (was && !input.locked && input.onUnlock) input.onUnlock();
  });
}

// 잠금 실패가 두 번 이어지면(예: 잠금을 막은 iframe) 끌어서 둘러보기로 전환
let lastFail = 0;
function lockFailed() {
  const now = performance.now();
  if (now - lastFail < 50) return; // 같은 실패가 두 경로로 들어옴
  lastFail = now;
  input.lockFails = (input.lockFails || 0) + 1;
  if (input.lockFails >= 2 && !input.fallback) {
    input.fallback = true;
    if (input.onFallback) input.onFallback();
  }
}

export function lock() {
  if (input.locked || input.fallback) return;
  if (!input.canvas.requestPointerLock) { input.lockFails = 1; lockFailed(); return; }
  try {
    const p = input.canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => lockFailed());
  } catch (e) { lockFailed(); }
}

export function unlock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function endFrame() {
  input.pressed.clear();
  input.mouse.dx = input.mouse.dy = 0;
  input.mouse.leftPressed = input.mouse.rightPressed = false;
  input.mouse.wheel = 0;
}

export const down = (c) => input.keys.has(c);
export const hit = (c) => input.pressed.has(c);
