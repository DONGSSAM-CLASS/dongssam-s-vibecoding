// Unified input: keyboard + mouse (pointer lock), standard-mapping gamepads, and touch overlay.
// Gameplay reads abstract actions only, so rebinding and device swaps never touch game code.
import { clamp } from './util.js';

export const ACTIONS = [
  'moveF', 'moveB', 'moveL', 'moveR', 'sprint', 'crouch', 'cover', 'interact', 'reload', 'melee',
  'bandage', 'binoculars', 'aim', 'fire', 'cmd_follow', 'cmd_hold', 'cmd_cover', 'cmd_fallback',
  'signal', 'log', 'map', 'pause',
];
export const REBINDABLE = ACTIONS.filter((a) => a !== 'pause');

export const DEFAULT_KEYS = {
  moveF: ['KeyW', 'ArrowUp'], moveB: ['KeyS', 'ArrowDown'], moveL: ['KeyA', 'ArrowLeft'], moveR: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft'], crouch: ['KeyC', 'ControlLeft'], cover: ['Space'], interact: ['KeyF', 'KeyE'],
  reload: ['KeyR'], melee: ['KeyV'], bandage: ['KeyH'], binoculars: ['KeyZ'], aim: ['Mouse2'], fire: ['Mouse0'],
  cmd_follow: ['Digit1'], cmd_hold: ['Digit2'], cmd_cover: ['Digit3'], cmd_fallback: ['Digit4'],
  signal: ['KeyG'], log: ['Tab', 'KeyJ'], map: ['KeyM'], pause: ['Escape', 'KeyP'],
};
export const DEFAULT_PAD = {
  interact: [0], crouch: [1], reload: [2], cover: [3], binoculars: [4], bandage: [5], aim: [6], fire: [7],
  log: [8], pause: [9], sprint: [10], melee: [11], cmd_follow: [12], cmd_fallback: [13], cmd_hold: [14], cmd_cover: [15],
  signal: [], map: [], moveF: [], moveB: [], moveL: [], moveR: [],
};
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', 'D↑', 'D↓', 'D←', 'D→'];

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Mouse')) return ['LMB', 'MMB', 'RMB', 'M4', 'M5'][+code.slice(5)] || code;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { ShiftLeft: 'Shift', ShiftRight: 'RShift', ControlLeft: 'Ctrl', ControlRight: 'RCtrl', Space: 'Space', Escape: 'Esc',
    Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', AltLeft: 'Alt', Enter: 'Enter', Backquote: '`' };
  return map[code] || code;
}
export const padLabel = (i) => PAD_NAMES[i] ?? `B${i}`;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = structuredClone(DEFAULT_KEYS);
    this.pad = structuredClone(DEFAULT_PAD);
    this.state = {};      // action -> {down, pressed, released, t}
    ACTIONS.forEach((a) => (this.state[a] = { down: false, pressed: false, released: false, t: 0 }));
    this.raw = new Set(); // codes held (keyboard + mouse)
    this.tapped = new Set(); // pressed since the last update (so quick taps are never lost at low frame rates)
    this.lookDX = 0; this.lookDY = 0;
    this.moveX = 0; this.moveY = 0;
    this.device = matchMedia('(pointer: coarse)').matches ? 'touch' : 'kb';
    this.isTouch = 'ontouchstart' in window && matchMedia('(pointer: coarse)').matches;
    this.sens = 1; this.padSens = 1; this.invertY = false;
    this.enabled = false; // gameplay capture
    this.touchState = { joy: null, look: null, buttons: new Set(), toggles: new Set() };
    this.rebind = null;
    this.padIndex = -1;
    this.padPrev = [];
    this.listeners = [];
    this._bind();
  }

  _bind() {
    const on = (t, e, f, o) => { t.addEventListener(e, f, o); this.listeners.push([t, e, f]); };
    on(window, 'keydown', (e) => {
      if (this.rebind && this.rebind.device === 'kb') {
        e.preventDefault();
        if (e.code !== 'Escape') this._applyRebind(e.code); else this._cancelRebind();
        return;
      }
      this.device = 'kb';
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.enabled) e.preventDefault();
      if (e.repeat) return;
      this.raw.add(e.code); this.tapped.add(e.code);
    });
    on(window, 'keyup', (e) => this.raw.delete(e.code));
    on(window, 'blur', () => { this.raw.clear(); });
    on(window, 'mousedown', (e) => {
      if (this.rebind && this.rebind.device === 'kb' && e.target.closest?.('.rebind-capture')) {
        e.preventDefault(); this._applyRebind('Mouse' + e.button); return;
      }
      if (!this.enabled) return;
      if (e.target !== this.canvas && !e.target.closest?.('#hud')) return;
      this.device = 'kb';
      this.raw.add('Mouse' + e.button); this.tapped.add('Mouse' + e.button);
      if (document.pointerLockElement !== this.canvas && !this.isTouch) this.requestLock();
    });
    on(window, 'mouseup', (e) => this.raw.delete('Mouse' + e.button));
    on(window, 'contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    on(window, 'mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.lookDX += e.movementX; this.lookDY += e.movementY;
      }
    });
    on(document, 'pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas) { this.raw.delete('Mouse0'); this.raw.delete('Mouse2'); }
      this.onLockChange?.(document.pointerLockElement === this.canvas);
    });
    on(window, 'gamepadconnected', (e) => { this.padIndex = e.gamepad.index; this.device = 'pad'; this.onDevice?.('pad'); });
    on(window, 'gamepaddisconnected', () => { this.padIndex = -1; });
  }

  requestLock() {
    try { const p = this.canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch (_) { /* unsupported */ }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  get locked() { return document.pointerLockElement === this.canvas; }

  beginRebind(action, device, slot, cb) { this.rebind = { action, device, slot, cb }; }
  _applyRebind(code) {
    const { action, device, slot, cb } = this.rebind;
    const table = device === 'kb' ? this.keys : this.pad;
    // remove the code from other actions so one key never fires two actions
    for (const a of REBINDABLE) table[a] = (table[a] || []).filter((c) => c !== code);
    const arr = table[action] || (table[action] = []);
    arr[slot] = code;
    table[action] = arr.filter((c) => c != null);
    this.rebind = null; cb?.(true);
  }
  _cancelRebind() { const cb = this.rebind?.cb; this.rebind = null; cb?.(false); }
  resetBindings() { this.keys = structuredClone(DEFAULT_KEYS); this.pad = structuredClone(DEFAULT_PAD); }
  serialize() { return { keys: this.keys, pad: this.pad }; }
  load(b) {
    if (b?.keys) this.keys = { ...structuredClone(DEFAULT_KEYS), ...b.keys };
    if (b?.pad) this.pad = { ...structuredClone(DEFAULT_PAD), ...b.pad };
  }

  // Called once per frame before game update.
  update(dt) {
    const gp = this._pollPad();
    if (this.rebind && this.rebind.device === 'pad' && gp) {
      for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i].pressed && !this.padPrev[i] && i !== 9) { this._applyRebind(i); break; }
      }
    }
    const ts = this.touchState;
    for (const a of ACTIONS) {
      let down = (this.keys[a] || []).some((c) => this.raw.has(c) || this.tapped.has(c));
      if (gp) down = down || (this.pad[a] || []).some((i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
      if (ts.buttons.has(a) || ts.toggles.has(a)) down = true;
      const s = this.state[a];
      s.pressed = down && !s.down;
      s.released = !down && s.down;
      s.t = down ? s.t + dt : 0;
      s.down = down;
    }
    this.tapped.clear();
    // movement axis
    let mx = (this.state.moveR.down ? 1 : 0) - (this.state.moveL.down ? 1 : 0);
    let my = (this.state.moveF.down ? 1 : 0) - (this.state.moveB.down ? 1 : 0);
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const m = Math.hypot(ax, ay);
      if (m > 0.18) { const k = Math.min(1, (m - 0.18) / 0.82) / m; mx += ax * k; my -= ay * k; }
      const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
      const rm = Math.hypot(rx, ry);
      if (rm > 0.15) {
        const k = Math.pow(Math.min(1, (rm - 0.15) / 0.85), 1.6) / rm;
        this.lookDX += rx * k * 900 * dt * this.padSens;
        this.lookDY += ry * k * 600 * dt * this.padSens;
      }
    }
    if (ts.joy) { mx += ts.joy.x; my -= ts.joy.y; }
    const mm = Math.hypot(mx, my);
    if (mm > 1) { mx /= mm; my /= mm; }
    this.moveX = mx; this.moveY = my;
  }

  // consume accumulated look delta (pixels-ish)
  takeLook() {
    const k = this.device === 'kb' ? this.sens : 1;
    const dx = this.lookDX * k, dy = this.lookDY * k * (this.invertY ? -1 : 1);
    this.lookDX = 0; this.lookDY = 0;
    return [dx, dy];
  }
  endFrame() { /* edge flags are recomputed each update */ }

  down(a) { return this.enabled && this.state[a].down; }
  pressed(a) { return this.enabled && this.state[a].pressed; }
  released(a) { return this.enabled && this.state[a].released; }
  held(a) { return this.enabled ? this.state[a].t : 0; }
  // menu-level edge (works even when gameplay capture disabled)
  menuPressed(a) { return this.state[a].pressed; }
  clearEdges() { for (const a of ACTIONS) { this.state[a].pressed = false; this.state[a].released = false; } }

  _pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    if (this.padIndex >= 0) gp = pads[this.padIndex];
    if (!gp) for (const p of pads) if (p && p.connected) { gp = p; this.padIndex = p.index; break; }
    if (!gp) return null;
    let any = false;
    for (let i = 0; i < gp.buttons.length; i++) if (gp.buttons[i].pressed) any = true;
    if (Math.abs(gp.axes[0]) > 0.4 || Math.abs(gp.axes[1]) > 0.4 || Math.abs(gp.axes[2] || 0) > 0.4) any = true;
    if (any && this.device !== 'pad') { this.device = 'pad'; this.onDevice?.('pad'); }
    const prev = this.padPrev;
    this.padPressed = gp.buttons.map((b, i) => b.pressed && !prev[i]);
    this.padPrev = gp.buttons.map((b) => b.pressed);
    return gp;
  }
  // Menu navigation helpers for gamepad: returns 'up','down','left','right','ok','back' edges.
  padNav() {
    const p = this.padPressed || [];
    if (p[12]) return 'up'; if (p[13]) return 'down'; if (p[14]) return 'left'; if (p[15]) return 'right';
    if (p[0]) return 'ok'; if (p[1]) return 'back'; if (p[9]) return 'start';
    return null;
  }

  rumble(strength = 0.4, ms = 80) {
    const gp = this.padIndex >= 0 ? navigator.getGamepads()[this.padIndex] : null;
    gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch?.(() => {});
  }

  // ---- touch overlay ----
  attachTouch(root) {
    this.touchRoot = root;
    const ts = this.touchState;
    const joyEl = root.querySelector('.t-joy'), knob = root.querySelector('.t-knob');
    const lookEl = root.querySelector('.t-look');
    let joyId = null, joyCx = 0, joyCy = 0, lookId = null, lx = 0, ly = 0;
    const R = 56;
    joyEl.addEventListener('touchstart', (e) => {
      e.preventDefault(); this.device = 'touch';
      const t = e.changedTouches[0]; joyId = t.identifier;
      const r = joyEl.getBoundingClientRect(); joyCx = r.left + r.width / 2; joyCy = r.top + r.height / 2;
      ts.joy = { x: 0, y: 0 };
      move(t);
    }, { passive: false });
    const move = (t) => {
      let dx = t.clientX - joyCx, dy = t.clientY - joyCy;
      const m = Math.hypot(dx, dy); if (m > R) { dx *= R / m; dy *= R / m; }
      ts.joy = { x: dx / R, y: dy / R };
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // push far = sprint
      if (m > R * 0.98 && Math.abs(dy) > Math.abs(dx) && dy < 0) ts.buttons.add('sprint'); else ts.buttons.delete('sprint');
    };
    joyEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === joyId) move(t);
    }, { passive: false });
    const endJoy = (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        joyId = null; ts.joy = null; knob.style.transform = ''; ts.buttons.delete('sprint');
      }
    };
    joyEl.addEventListener('touchend', endJoy); joyEl.addEventListener('touchcancel', endJoy);
    lookEl.addEventListener('touchstart', (e) => {
      e.preventDefault(); this.device = 'touch';
      const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY;
    }, { passive: false });
    lookEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === lookId) {
        this.lookDX += (t.clientX - lx) * 1.6 * this.padSens; this.lookDY += (t.clientY - ly) * 1.6 * this.padSens;
        lx = t.clientX; ly = t.clientY;
      }
    }, { passive: false });
    const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
    lookEl.addEventListener('touchend', endLook); lookEl.addEventListener('touchcancel', endLook);
    root.querySelectorAll('[data-act]').forEach((b) => {
      const a = b.dataset.act, toggle = b.dataset.toggle === '1';
      const start = (e) => {
        e.preventDefault(); e.stopPropagation(); this.device = 'touch';
        if (toggle) { if (ts.toggles.has(a)) ts.toggles.delete(a); else ts.toggles.add(a); b.classList.toggle('on', ts.toggles.has(a)); }
        else { ts.buttons.add(a); b.classList.add('on'); }
        // fire button also drives look so the player can adjust aim while shooting
        if (a === 'fire') { lookId = e.changedTouches[0].identifier; lx = e.changedTouches[0].clientX; ly = e.changedTouches[0].clientY; }
      };
      const end = (e) => { e.preventDefault(); if (!toggle) { ts.buttons.delete(a); b.classList.remove('on'); } };
      b.addEventListener('touchstart', start, { passive: false });
      b.addEventListener('touchend', end); b.addEventListener('touchcancel', end);
      if (a === 'fire') b.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) if (t.identifier === lookId) {
          this.lookDX += (t.clientX - lx) * 1.2 * this.padSens; this.lookDY += (t.clientY - ly) * 1.2 * this.padSens; lx = t.clientX; ly = t.clientY;
        }
      }, { passive: false });
    });
  }
  setTouchToggle(a, on) {
    const ts = this.touchState;
    if (on) ts.toggles.add(a); else ts.toggles.delete(a);
    this.touchRoot?.querySelector(`[data-act="${a}"]`)?.classList.toggle('on', on);
  }
  pulseTouch(a) { this.touchState.buttons.add(a); setTimeout(() => this.touchState.buttons.delete(a), 60); }

  promptFor(action) {
    if (this.device === 'pad') return padLabel((this.pad[action] || [])[0]);
    if (this.device === 'touch') return null;
    return keyLabel((this.keys[action] || [])[0]);
  }
}
export { clamp };
