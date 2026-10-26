// In-mission HUD. Survival first (health, fatigue, ammo, squad), then objective and alert, then feedback.
// Enemy markers only ever show what the player (or a scout) has actually seen: live while in sight,
// a fading "last seen" ghost afterwards. Nothing is revealed through walls.
import * as THREE from 'three';
import { L, getLang } from '../engine/i18n.js';
import { ICON } from './icons.js';
import { clamp } from '../engine/util.js';

const _v = new THREE.Vector3();
const ROLE_ICON = { scout: 'scout', comm: 'comm', medic: 'medic', marksman: 'marksman', rifle: 'rifle', liaison: 'liaison' };

export class Hud {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('hud');
    this.root.innerHTML = `
      <div class="h-obj" id="hObj"><div class="h-obj-tag" id="hObjTag"></div><div class="h-obj-text" id="hObjText"></div><div class="h-obj-sub"><span id="hObjProg"></span><span id="hObjDist"></span></div></div>
      <div class="h-top"><div class="h-compass" id="hCompass"><div class="h-compass-strip" id="hCompassStrip"></div><div class="h-compass-marks" id="hCompassMarks"></div><div class="h-compass-center"></div></div>
        <div class="h-alert" id="hAlert"><span class="h-alert-icon" id="hAlertIcon"></span><span id="hAlertText"></span></div></div>
      <div class="h-squad" id="hSquad"></div>
      <div class="h-vitals"><div class="h-stance" id="hStance"></div>
        <div class="h-bars"><div class="h-bar h-hp"><span class="ic">${ICON.health}</span><div class="h-track"><div class="h-fill" id="hHp"></div><div class="h-ghost" id="hHpGhost"></div></div></div>
        <div class="h-bar h-st"><span class="ic">${ICON.stamina}</span><div class="h-track"><div class="h-fill" id="hSt"></div><div class="h-cap" id="hStCap"></div></div></div></div>
        <div class="h-band"><span class="ic">${ICON.bandage}</span><b id="hBand">0</b></div></div>
      <div class="h-weapon" id="hWeapon"><div class="h-wname" id="hWName"></div><div class="h-ammo"><div class="h-pips" id="hPips"></div><div class="h-res"><span class="ic">${ICON.ammo}</span><b id="hRes">0</b></div></div><div class="h-wstate" id="hWState"></div></div>
      <div class="h-cross" id="hCross"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="h-hit" id="hHit"></div>
      <div class="h-prompt" id="hPrompt"><div class="h-key" id="hKey"></div><div class="h-ptext" id="hPText"></div><svg class="h-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle class="p" id="hRing" cx="20" cy="20" r="17"/></svg></div>
      <div class="h-marks" id="hMarks"></div>
      <div class="h-dmg" id="hDmg"></div>
      <div class="h-toasts" id="hToasts"></div>
      <div class="h-xp" id="hXP"></div>
      <div class="h-subs" id="hSubs"></div>
      <div class="h-caption" id="hCaption"></div>
      <div class="h-tut" id="hTut"><div class="h-tut-title" id="hTutTitle"></div><div class="h-tut-body" id="hTutBody"></div></div>
      <div class="h-downed" id="hDowned"><div class="h-downed-card"><h2 id="hDownedTitle"></h2><p id="hDownedText"></p><div class="h-downed-timer" id="hDownedTimer"></div></div></div>
      <div class="h-order" id="hOrder"></div>
      <button class="h-pausebtn" id="hPauseBtn" aria-label="Pause">${ICON.pause}</button>`;
    const $ = (id) => document.getElementById(id);
    this.el = new Proxy({}, { get: (_, k) => $(k) });
    this.subQueue = []; this.subT = 0;
    this.markPool = [];
    this.prev = {};
    $('hPauseBtn').addEventListener('click', () => app.pause());
    this.buildCompass();
  }
  show(v) { this.root.classList.toggle('hidden', !v); }
  bindGame(game) {
    this.g = game;
    this.prev = {};
    this.el.hSubs.innerHTML = ''; this.el.hToasts.innerHTML = ''; this.el.hXP.innerHTML = '';
    this.subQueue = []; this.subT = 0;
    this.buildSquad();
    this.downed(false);
    this.el.hObjTag.textContent = `${L(game.def.chapterLabel || '')}`;
    this.tut = game.def.tutorial ? game.def.tutorial.map((t) => ({ ...t, done: false })) : null;
    this.tutIdx = 0; this.tutSeen = new Set(); this.tutMoved = 0; this.tutYaw = undefined;
    game.tutorial = { flag: (f) => this.tutFlag(f) };
    this.showTutorial();
    this.el.hWName.textContent = game.player.weapon.mag ? L(game.player.weapon.name) : '';
    this.el.hWeapon.classList.toggle('hidden', !game.player.weapon.mag);
  }
  buildCompass() {
    const strip = this.el.hCompassStrip;
    let h = '';
    const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let k = -1; k <= 1; k++) for (let d = 0; d < 360; d += 15) {
      const x = (k * 360 + d) * 2;
      h += lab[d] ? `<span class="c-lab${d % 90 ? ' minor' : ''}" style="left:${x}px">${lab[d]}</span>` : `<span class="c-tick" style="left:${x}px"></span>`;
    }
    strip.innerHTML = h;
  }
  buildSquad() {
    const g = this.g;
    this.el.hSquad.innerHTML = g.squad.map((a) => `<div class="sq" id="sq_${a.id}"><span class="sq-ic">${ICON[ROLE_ICON[a.role] || 'rifle']}</span><div class="sq-main"><div class="sq-name">${L(a.name)}</div><div class="sq-bar"><i></i></div><div class="sq-st"></div></div></div>`).join('');
  }

  // ---- per frame
  update(dt) {
    const g = this.g; if (!g) return;
    const p = g.player, E = this.el;
    const set = (k, v, fn) => { if (this.prev[k] !== v) { this.prev[k] = v; fn(v); } };
    // vitals
    set('hp', Math.round(p.hp), (v) => { E.hHp.style.width = v + '%'; E.hHp.parentElement.parentElement.classList.toggle('low', v < 35); });
    this.ghostHp = Math.max(p.hp, (this.ghostHp ?? p.hp) - dt * 25); E.hHpGhost.style.width = this.ghostHp + '%';
    set('st', Math.round(p.stamina), (v) => { E.hSt.style.width = v + '%'; });
    set('stc', Math.round(p.maxStamina), (v) => { E.hStCap.style.width = (100 - v) + '%'; });
    set('band', p.bandages, (v) => { E.hBand.textContent = v; });
    const stance = p.carrying ? 'carry' : p.cover ? 'cover' : p.crouch ? 'crouch' : 'stand';
    set('stance', stance + (p.bino ? 'b' : ''), () => { E.hStance.innerHTML = (stance === 'carry' ? ICON.hand : ICON[stance]) + `<span>${L('stance_' + stance)}</span>`; });
    // weapon
    const w = p.weapon;
    if (w.mag) {
      set('pips', `${p.ammo}/${w.mag}`, () => { E.hPips.innerHTML = w.mag > 6 ? `<b class="big">${p.ammo}</b><span>/${w.mag}</span>` : Array.from({ length: w.mag }, (_, i) => `<i class="${i < p.ammo ? 'on' : ''}"></i>`).join(''); });
      set('res', p.reserve, (v) => { E.hRes.textContent = v; E.hRes.parentElement.classList.toggle('low', v < 5); });
      const ws = p.jammed ? 'jammed' : p.reloadT > 0 ? 'reloading' : p.carrying ? 'carrying' : p.ammo === 0 ? (p.reserve > 0 ? 'empty' : 'noAmmo') : '';
      set('ws', ws, (v) => { E.hWState.textContent = v ? L('w_' + v) : ''; E.hWState.className = 'h-wstate ' + v; });
    }
    // crosshair: grows with real spread so the player can read steadiness
    const showX = p.aim || (w.mag && g.alertLevel >= 2 && !p.carrying);
    E.hCross.classList.toggle('hidden', !showX || p.bino);
    if (showX) {
      const px = clamp(p.spread() * 900, 3, 60);
      E.hCross.style.setProperty('--sp', px + 'px');
      E.hCross.classList.toggle('steady', p.breath > 0.5);
      E.hCross.classList.toggle('target', !!g.assistTarget);
    }
    // alert
    const al = g.alertLevel;
    set('alert', al, (v) => { E.hAlert.className = 'h-alert lvl' + v; E.hAlertIcon.innerHTML = v === 0 ? ICON.eyeOff : ICON.eye; E.hAlertText.textContent = L('alert' + v); });
    // squad
    for (const a of g.squad) {
      const el = document.getElementById('sq_' + a.id); if (!el) continue;
      const st = a.state === 'lost' ? 'lost' : a.state === 'wounded' ? (a.treated ? 'stable' : 'bleeding') : a.state === 'carried' ? 'carried' : a.state === 'injured' ? 'injured' : a.order;
      const key = st + Math.round(a.hp) + (a.state === 'wounded' && !a.treated ? Math.ceil(a.bleedT) : '') + (a.reserve + a.ammo < 6 ? 'l' : '');
      if (el.dataset.k !== key) {
        el.dataset.k = key;
        el.className = 'sq ' + st;
        el.querySelector('.sq-bar i').style.width = (a.state === 'wounded' ? 0 : a.hp) + '%';
        let txt = L('sq_' + st);
        if (st === 'bleeding') txt += ` ${Math.ceil(a.bleedT)}s`;
        if (a.reserve + a.ammo < 6 && a.active && a.weapon.mag) txt += ' · ' + L('lowAmmoShort');
        el.querySelector('.sq-st').textContent = txt;
      }
    }
    // objective distance & compass
    const o = g.mission.current;
    const cam = g.camera.position, yaw = g.cam.yaw;
    const yawDeg = ((-yaw * 180 / Math.PI) % 360 + 360) % 360; // compass: 0 = north(+z)
    E.hCompassStrip.style.transform = `translateX(${-(yawDeg + 360) * 2 + 180}px)`;
    let marks = '';
    const compassMark = (x, z, cls, label = '') => {
      const a = Math.atan2(x - p.x, z - p.z); let dd = ((-a * 180 / Math.PI) - yawDeg); dd = ((dd + 540) % 360) - 180;
      if (Math.abs(dd) > 88) return;
      marks += `<span class="cm ${cls}" style="left:${180 + dd * 2}px">${label}</span>`;
    };
    const objPos = this.objectivePos();
    if (objPos) {
      compassMark(objPos[0], objPos[1], 'obj', '◆');
      const d = Math.round(Math.hypot(objPos[0] - p.x, objPos[1] - p.z));
      set('od', d, (v) => { E.hObjDist.textContent = v > 2 ? `${v} m` : ''; });
    } else set('od', -1, () => { E.hObjDist.textContent = ''; });
    for (const e of g.enemies) if (e.active && e.observed && e.lastSeenByPlayer && g.time - e.lastSeenByPlayer.t < 90) compassMark(e.lastSeenByPlayer.x, e.lastSeenByPlayer.z, e.visibleToPlayer ? 'en live a' + e.mode : 'en ghost', '▼');
    for (const a of g.squad) if (a.state === 'wounded' && !a.carriedBy) compassMark(a.x, a.z, 'wd', '✚');
    set('cm', marks, (v) => { E.hCompassMarks.innerHTML = v; });
    // world-space markers
    this.updateMarkers(objPos);
    // prompt hold ring
    if (this.promptTarget && this.promptTarget.hold) {
      const k = p.interactTarget?.id === this.promptTarget.id ? p.interactT / this.promptTarget.hold : 0;
      E.hRing.style.strokeDashoffset = String(107 * (1 - clamp(k, 0, 1)));
    }
    // subtitles
    this.subT -= dt;
    if (this.subT <= 0 && this.subQueue.length) this.showNextSub();
    else if (this.subT <= 0 && this.curSub) { this.curSub.classList.add('out'); const c = this.curSub; setTimeout(() => c.remove(), 400); this.curSub = null; }
    // tutorial auto-detection
    if (this.tut) this.tutAuto(dt);
  }
  objectivePos() {
    const g = this.g, o = g.mission.current; if (!o) return null;
    let m = o.marker ?? (o.zone ? o.zone : null);
    if (typeof m === 'function') m = m(g);
    if (o.type === 'extract') m = o.zone || g.def.extraction;
    if (!m) return null;
    return [m[0], m[1]];
  }
  updateMarkers(objPos) {
    const g = this.g, cam = g.camera, W = innerWidth, H = innerHeight;
    let i = 0;
    const put = (x, y, z, cls, html, edge) => {
      _v.set(x, y, z).project(cam);
      let sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
      const behind = _v.z > 1;
      if (behind || sx < 0 || sx > W || sy < 0 || sy > H) {
        if (!edge) return;
        if (behind) { sx = W - sx; sy = H - sy; }
        sx = clamp(sx, 60, W - 60); sy = clamp(sy, 110, H - 150);
        cls += ' edge';
      }
      let el = this.markPool[i];
      if (!el) { el = document.createElement('div'); this.el.hMarks.appendChild(el); this.markPool[i] = el; }
      el.className = 'wm ' + cls; el.style.transform = `translate(${sx}px,${sy}px)`;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.style.display = '';
      i++;
    };
    if (objPos && !g.mission.done) {
      const d = Math.round(Math.hypot(objPos[0] - g.player.x, objPos[1] - g.player.z));
      if (d > 3) put(objPos[0], g.groundY(objPos[0], objPos[1]) + 2.2, objPos[1], 'obj', `<i>◆</i><span>${d}m</span>`, true);
    }
    for (const e of g.enemies) {
      if (!e.active || !e.observed) continue;
      if (e.visibleToPlayer) put(e.x, e.headY() + 0.55, e.z, 'en a' + e.mode + (e.mode === 'suspicious' ? ' sus' : ''), `<i></i>${e.mode === 'suspicious' || e.mode === 'search' ? '<b>?</b>' : e.mode === 'combat' || e.mode === 'detain' ? '<b>!</b>' : ''}`);
      else if (e.lastSeenByPlayer && g.time - e.lastSeenByPlayer.t < 60) put(e.lastSeenByPlayer.x, g.groundY(e.lastSeenByPlayer.x, e.lastSeenByPlayer.z) + 1.9, e.lastSeenByPlayer.z, 'en ghost', `<i></i>`);
    }
    for (const a of g.squad) {
      if (a.state === 'lost' || a.carriedBy) continue;
      const wounded = a.state === 'wounded';
      const far = Math.hypot(a.x - g.player.x, a.z - g.player.z) > 8;
      if (wounded) put(a.x, a.y + 0.9, a.z, 'ally wd' + (a.treated ? ' stable' : ''), `<i>✚</i><span>${L(a.name)}${a.treated ? '' : ' ' + Math.ceil(a.bleedT) + 's'}</span>`, true);
      else if (far || this.app.settings.allyTags) put(a.x, a.headY() + 0.5, a.z, 'ally', `<span>${L(a.name)}</span>`);
    }
    for (const c of g.civilians) if (c.def.escort && c.mode !== 'safe' && c.active) put(c.x, c.headY() + 0.45, c.z, 'civ' + (c.mode === 'follow' ? ' f' : ''), `<i>●</i>`);
    for (const it of g.interactables) if (it.marker && it.enabled(g)) {
      const [x, z] = typeof it.pos === 'function' ? it.pos(g) : it.pos;
      if (it.label) { if (Math.hypot(x - g.player.x, z - g.player.z) < 28) put(x, g.groundY(x, z) + 1.9, z, 'item station', `<span>${L(it.label)}</span>`); }
      else put(x, (it.y ?? g.groundY(x, z)) + 1.2, z, 'item ' + it.marker, `<i>${it.marker === 'clue' ? '?' : '•'}</i>`);
    }
    if (g.mission.current?.type === 'extract' || g.def.extraction && g.mission.current?.showExtraction) {
      const [x, z] = g.mission.current.zone || g.def.extraction; put(x, g.groundY(x, z) + 2.6, z, 'ext', `<i>${ICON.flag}</i>`, true);
    }
    for (let k = i; k < this.markPool.length; k++) this.markPool[k].style.display = 'none';
  }

  // ---- events
  objective(o, idx) {
    const E = this.el;
    E.hObj.classList.remove('flash'); void E.hObj.offsetWidth; E.hObj.classList.add('flash');
    E.hObjText.textContent = L(o.text);
    E.hObjProg.textContent = '';
    this.curObj = o;
  }
  objectiveProgress(st) {
    const v = st.progress || '';
    if (this.prev.prog !== v) { this.prev.prog = v; this.el.hObjProg.textContent = v; }
  }
  setPrompt(it) {
    const E = this.el, inp = this.app.input;
    if ((it?.id ?? null) === (this.promptTarget?.id ?? null) && this.prev.pl === getLang() + inp.device) { this.promptTarget = it; return; }
    this.promptTarget = it; this.prev.pl = getLang() + inp.device;
    if (!it) { E.hPrompt.classList.remove('on'); return; }
    E.hPrompt.classList.add('on');
    E.hPrompt.classList.toggle('hold', !!it.hold);
    const key = inp.promptFor('interact');
    E.hKey.textContent = key || '';
    E.hKey.classList.toggle('touch', !key);
    let txt = L(typeof it.prompt === 'string' ? 'p_' + it.prompt : it.prompt);
    if (it.name) txt = txt.replace('{name}', L(it.name));
    E.hPText.textContent = txt;
    const tb = document.querySelector('#touch [data-act="interact"]'); if (tb) tb.classList.toggle('ready', !!it);
    this.app.touchInteract?.(!!it);
  }
  toast(key, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = L(typeof key === 'string' ? 't_' + key : key);
    if (el.textContent === 't_' + key) el.textContent = key;
    this.el.hToasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
    while (this.el.hToasts.children.length > 4) this.el.hToasts.firstChild.remove();
  }
  xp(cat, amount, reason, levelUp) {
    const el = document.createElement('div'); el.className = 'xpp';
    el.innerHTML = `<b>+${Math.round(amount)}</b> ${L('xp_' + cat)}${reason ? ` · ${L('t_' + reason)}` : ''}`;
    this.el.hXP.appendChild(el); setTimeout(() => el.remove(), 2400);
    if (levelUp) { this.toast({ en: `${L('skill_' + levelUp.skill)} improved to level ${levelUp.level}`, ko: `${L('skill_' + levelUp.skill)} ${levelUp.level}단계로 향상` }, 'level'); this.app.audio.sting('xp'); }
  }
  hitMarker() { const h = this.el.hHit; h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); }
  damageFrom(e) {
    const g = this.g, p = g.player;
    const a = Math.atan2(e.x - p.x, e.z - p.z) - g.cam.yaw;
    const el = document.createElement('div'); el.className = 'dmgarc';
    el.style.transform = `rotate(${-a * 180 / Math.PI}deg)`;
    this.el.hDmg.appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  alertPing(e, lvl) { /* compass + markers already show state; keep for hooks */ }
  journalPing() { this.app.ui?.journalPing?.(); }
  orderFlash(cmd, pt) {
    const E = this.el.hOrder;
    E.innerHTML = `${ICON[{ follow: 'follow', hold: 'hold', cover: 'coverfire', fallback: 'fallback' }[cmd]]}<span>${L('cmd_' + cmd)}</span>`;
    E.classList.remove('on'); void E.offsetWidth; E.classList.add('on');
  }
  subtitle(name, line, vars, kind) {
    this.subQueue.push({ name: L(name), text: L(line, vars), kind });
    if (this.subQueue.length > 4) this.subQueue.shift();
    if (!this.curSub || this.subT <= 0) this.showNextSub();
  }
  queueLines(lines) { for (const l of lines) this.subQueue.push({ name: l.who ? L(l.who) : '', text: L(l.text), kind: l.kind || (l.who ? 'ally' : 'narr'), dur: l.dur }); if (!this.curSub) this.showNextSub(); }
  showNextSub() {
    const s = this.subQueue.shift(); if (!s) return;
    if (this.curSub) { const c = this.curSub; c.classList.add('out'); setTimeout(() => c.remove(), 300); }
    const el = document.createElement('div'); el.className = 'sub ' + (s.kind || '');
    el.innerHTML = (s.name ? `<b>${s.name}</b>` : '') + `<span>${s.text}</span>`;
    this.el.hSubs.appendChild(el); this.curSub = el;
    this.subT = s.dur ?? clamp(1.6 + s.text.length * (getLang() === 'ko' ? 0.09 : 0.05), 2.5, 8);
  }
  caption(key) {
    const c = this.el.hCaption; c.textContent = L('cap_' + key); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
  }
  downed(on, help) {
    this.isDowned = on;
    this.el.hDowned.classList.toggle('on', on);
    if (on) { this.el.hDownedTitle.textContent = L('downedTitle'); this.el.hDownedText.textContent = L(help ? 'downedHelp' : 'downedAlone'); }
  }
  downTimer(t) { this.el.hDownedTimer.textContent = Math.max(0, Math.ceil(t)) + 's'; }

  // ---- tutorial
  showTutorial() {
    const E = this.el;
    if (!this.tut || this.tutIdx >= this.tut.length) { E.hTut.classList.remove('on'); return; }
    const t = this.tut[this.tutIdx];
    E.hTut.classList.add('on');
    E.hTutTitle.textContent = `${L('tutorial')} ${this.tutIdx + 1}/${this.tut.length}`;
    E.hTutBody.innerHTML = this.tutText(t);
    this.tutShownAt = performance.now();
  }
  tutText(t) {
    const inp = this.app.input, dev = inp.device;
    const keys = (t.actions || []).map((a) => {
      if (a === 'move') return dev === 'pad' ? 'LS' : dev === 'touch' ? L('touchStick') : 'WASD';
      if (a === 'look') return dev === 'pad' ? 'RS' : dev === 'touch' ? L('touchDrag') : L('mouse');
      const k = inp.promptFor(a); return k || L('touchBtn_' + a);
    });
    return L(t.text).replace(/\{(\d)\}/g, (_, i) => `<kbd>${keys[+i] ?? ''}</kbd>`);
  }
  tutFlag(f) {
    if (!this.tut) return;
    (this.tutSeen ||= new Set()).add(f);
    const t = this.tut[this.tutIdx];
    if (t && t.until === f) { t.done = true; this.tutIdx++; this.el.hTut.classList.add('done'); setTimeout(() => { this.el.hTut.classList.remove('done'); this.showTutorial(); }, 500); }
  }
  tutAuto(dt) {
    const g = this.g, p = g.player, inp = this.app.input, t = this.tut[this.tutIdx];
    if (!t) return;
    if (this.tutSeen?.has(t.until) && !this.tutAdvancing) { this.tutAdvancing = true; setTimeout(() => { this.tutAdvancing = false; }, 600); this.tutFlag(t.until); return; }
    if (this.prev.tdev !== inp.device) { this.prev.tdev = inp.device; this.el.hTutBody.innerHTML = this.tutText(t); }
    const f = t.until;
    if (f === 'move' && p.speed > 1) this.tutMoved = (this.tutMoved || 0) + dt;
    if (f === 'move' && this.tutMoved > 1.2) this.tutFlag('move');
    if (f === 'look' && Math.abs(g.cam.yaw - (this.tutYaw ??= g.cam.yaw)) > 0.8) this.tutFlag('look');
    if (f === 'crouch' && p.crouch) this.tutFlag('crouch');
    if (f === 'sprint' && p.speed > 4.5) this.tutFlag('sprint');
    if (f === 'aim' && p.aim) this.tutFlag('aim');
    if (f === 'fire' && g.stats.shots > 0) this.tutFlag('fire');
    if (f === 'reload' && p.reloadT > 0) this.tutFlag('reload');
    if (f === 'bino' && p.bino) this.tutFlag('bino');
    if (f === 'breath' && p.breath > 0.6) this.tutFlag('breath');
    if (f === 'bandage' && p.bandageT > 0) this.tutFlag('bandage');
    if (f === 'log' && this.app.ui.logOpened) this.tutFlag('log');
    if (f === 'time' && performance.now() - this.tutShownAt > (t.ms || 6000)) this.tutFlag('time');
  }
}
