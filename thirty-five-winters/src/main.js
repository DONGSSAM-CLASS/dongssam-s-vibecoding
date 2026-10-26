// App shell: boot, the journey state machine, settings, pause, saves, and the title backdrop.
import * as THREE from 'three';
import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { AudioEngine } from './engine/audio.js';
import { L, setLang, getLang, onLang } from './engine/i18n.js';
import { Hud } from './ui/hud.js';
import { UI } from './ui/ui.js';
import { TravelMap } from './ui/map.js';
import { Game } from './game/game.js';
import { Progress } from './game/progress.js';
import { setOutlines } from './world/characters.js';
import { Level } from './world/level.js';
import { Character } from './world/characters.js';
import { CHAPTERS, SEQUENCE, COMPANIONS, ENDING } from './data/chapters.js';
import { MISSIONS } from './data/missions/index.js';
import { ICON } from './ui/icons.js';

const SETTINGS_KEY = 'tfw_settings_v1';
const DEFAULTS = {
  lang: 'en', difficulty: 'standard', aimAssist: 1, autoReload: true, allyTags: false, classroom: false,
  sensitivity: 1, padSensitivity: 1, invertY: false, subSize: 'm', subBg: true, sfxCaptions: true, colorblind: 'off',
  shake: 0.8, reduceMotion: false, highContrast: false, holdToggle: false,
  vol_master: 0.8, vol_music: 0.6, vol_sfx: 0.85, vol_amb: 0.7, vol_ui: 0.6, quality: null, outlines: true, grain: 0.8,
};

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input(this.canvas);
    this.audio = new AudioEngine();
    this.settings = this.loadSettings();
    this.progress = new Progress();
    this.data = { CHAPTERS, SEQUENCE, COMPANIONS, MISSIONS };
    this.hud = new Hud(this);
    this.ui = new UI(this);
    this.travel = new TravelMap(this);
    this.game = new Game(this);
    this.state = 'boot'; this.paused = false;
    this.applySettings(true);
    this.input.onLockChange = (locked) => { if (!locked && this.state === 'mission' && !this.paused && !this.ui.stack.length && !this.input.isTouch && !this.suppressLockPause) this.pause(); };
    window.addEventListener('blur', () => { if (this.state === 'mission' && !this.paused) this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'mission' && !this.paused) this.pause(); });
    onLang(() => this.refreshLang());
    this.setupTouch();
    this.setupTitleScene();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    const unlock = () => { this.audio.unlock(); if (this.audio.pendingMusic) { this.audio.playMusic(this.audio.pendingMusic); this.audio.pendingMusic = null; } if (this.audio.pendingAmb) { this.audio.setAmbience(this.audio.pendingAmb); this.audio.pendingAmb = null; } this.audio.applyVolumes(); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock); window.addEventListener('touchstart', unlock);
    document.getElementById('loading')?.remove();
    this.toTitle();
    window.__app = this; // test & debug hook
  }

  // ------------------------------------------------------------ settings
  loadSettings() { let s = {}; try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (_) { /* ignore */ } const out = { ...DEFAULTS, ...s }; if (!out.quality) out.quality = this.renderer.quality; if (s.bindings) this.input.load(s.bindings); return out; }
  saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...this.settings, bindings: this.input.serialize() })); } catch (_) { /* ignore */ } }
  setSetting(k, v) {
    if (k === 'aimAssist') v = parseInt(v, 10);
    this.settings[k] = v; this.applySettings(false, k); this.saveSettings();
    if (k === 'lang' || k === 'classroom') this.refreshTop();
  }
  applySettings(first, key) {
    const S = this.settings, b = document.body;
    if (first || key === 'lang') setLang(S.lang);
    b.dataset.sub = S.subSize; b.classList.toggle('subbg', !!S.subBg); b.dataset.cb = S.colorblind;
    b.classList.toggle('hc', !!S.highContrast); b.classList.toggle('reduce', !!S.reduceMotion);
    this.input.sens = S.sensitivity; this.input.padSens = S.padSensitivity; this.input.invertY = !!S.invertY;
    this.audio.setVolumes({ master: S.vol_master, music: S.vol_music, sfx: S.vol_sfx, amb: S.vol_amb, ui: S.vol_ui });
    if (first || key === 'quality') this.renderer.setQuality(S.quality);
    this.renderer.uniforms.uGrain.value = S.reduceMotion ? S.grain * 0.4 : S.grain;
    setOutlines(!!S.outlines && S.quality !== 'low');
  }
  refreshLang() { this.hud.prev = {}; if (this.game.running) { this.hud.buildSquad(); const o = this.game.mission?.current; if (o) this.hud.objective(o); this.hud.el.hWName.textContent = this.game.player?.weapon?.mag ? L(this.game.player.weapon.name) : ''; } this.updateTouchLabels(); }
  refreshTop() {
    const top = this.ui.top?.name;
    if (top === 'title') this.ui.title();
    else if (top === 'settings') this.ui.settings(this.ui.stack.length > 1, 'gameplay');
    else if (top === 'pause') { this.ui.close(); this.ui.pause(); }
  }

  // ------------------------------------------------------------ loop
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    try { this.frame(t); } catch (e) { if (!this._errShown) { this._errShown = true; console.error(e); } }
  }
  frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    this.input.update(dt);
    const nav = this.input.padNav();
    if (this.state === 'mission' && !this.paused && this.game.running) {
      if (this.input.menuPressed('pause')) this.pause();
      else if (this.input.pressed('log')) { this.pause(true); this.ui.log('obj'); }
      else if (this.input.pressed('map')) { this.pause(true); this.ui.log('map'); }
      else this.game.update(dt);
      this.renderer.render(this.game.scene, this.game.camera, dt);
    } else {
      if (this.ui.stack.length) {
        if (nav) this.ui.padNav(nav);
        if (this.input.menuPressed('pause') && !this.input.rebind) { if (this.state === 'mission' && this.ui.top?.name === 'pause') this.resume(); else if (!this.ui.back() && this.state === 'mission') this.resume(); }
      } else if (nav === 'ok' || nav === 'start') document.querySelector('.s-travel [data-k="go"]')?.click();
      if (this.state === 'mission' && this.game.scene) {
        // the world is frozen behind menus: redraw a few times a second instead of every frame
        this.menuRenderT = (this.menuRenderT || 0) - dt;
        if (this.menuRenderT <= 0) { this.menuRenderT = 0.25; this.renderer.render(this.game.scene, this.game.camera, dt); }
      } else if (this.title) {
        this.updateTitleScene(dt);
        this.renderer.render(this.title.level.scene, this.title.cam, dt);
      }
    }
    this.audio.update(dt);
  }

  // Test hook: advance game logic in fixed steps without waiting for rendered frames.
  simulate(sec, dt = 1 / 30) {
    const n = Math.max(1, Math.round(sec / dt));
    for (let i = 0; i < n; i++) {
      this.input.update(dt);
      if (this.state === 'mission' && !this.paused && this.game.running) this.game.update(dt);
      this.audio.update(dt);
    }
  }

  // ------------------------------------------------------------ title backdrop: a column walking through a snowy valley at dawn
  setupTitleScene() {
    const env = {
      biome: 'manchuria_winter', season: 'winter', time: 'dawn', weather: 'snow', grade: 'winter', wind: 1.2,
      terrain: { size: 220, seed: 11, noiseAmp: 7, features: [{ type: 'valley', path: [[-110, -20], [-30, 0], [40, -6], [110, 10]], width: 46, depth: 12 }, { type: 'road', path: [[-110, -18], [-30, 2], [40, -4], [110, 12]], width: 2.4 }, { type: 'ridge', path: [[-100, 50], [100, 40]], width: 30, height: 16 }] },
      build(kit) {
        kit.forest({ x: 0, z: 42, w: 210, d: 40 }, 110, ['larch', 'pine', 'birch'], [], [0.9, 1.4]);
        kit.forest({ x: 0, z: -48, w: 210, d: 36 }, 80, ['larch', 'pine'], [], [0.9, 1.3]);
        kit.house('choga', 26, -16, 0.2, { snow: true }); kit.house('manchu', 40, -20, -0.1, { snow: true });
        kit.flag(8, -2, '1919', 4.2);
        for (let i = 0; i < 30; i++) kit.bush(-90 + i * 6, 18 + (i % 3) * 3, 0.9);
      },
    };
    const level = new Level(env, { quality: this.renderer.quality }); level.build({});
    level.effects.setWeather('snow');
    const walkers = [];
    const outfits = ['army1920w', 'army1920b', 'refugee_w', 'medic1920', 'army1920', 'refugee_m', 'child', 'army1920b'];
    outfits.forEach((o, i) => { const c = new Character(o, { weapon: o.startsWith('army') ? 'rifle' : 'none', seed: i }); level.scene.add(c.root); walkers.push({ c, s: -i * 2.6 }); });
    const cam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 4000);
    this.title = { level, walkers, cam, t: 0, path: [[-60, -6], [-30, 2], [0, 0], [40, -4], [80, 6]] };
    this.renderer.onResize = (w, h) => { for (const c of [this.title?.cam, this.game.camera]) if (c) { c.aspect = w / h; c.updateProjectionMatrix(); } };
  }
  updateTitleScene(dt) {
    const T = this.title; T.t += dt;
    const p = T.path;
    const along = (s) => { s = ((s % 140) + 140) % 140; const t = s / 140 * (p.length - 1); const i = Math.min(p.length - 2, Math.floor(t)), f = t - i; return [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f, Math.atan2(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1])]; };
    for (const w of T.walkers) {
      w.s += dt * 1.15;
      const [x, z, a] = along(w.s);
      w.c.root.position.set(x, T.level.terrain.heightAt(x, z), z); w.c.root.rotation.y = a;
      w.c.update(dt, { speed: 1.15 });
    }
    const [fx, fz] = along(T.walkers[2].s);
    const ang = T.t * 0.03;
    T.cam.position.set(fx + Math.cos(ang) * 14 - 6, T.level.terrain.heightAt(fx, fz) + 4.2, fz - 12 + Math.sin(ang) * 3);
    T.cam.lookAt(fx + 4, T.level.terrain.heightAt(fx, fz) + 2.4, fz);
    T.level.update(dt, T.t, { x: fx, y: 0, z: fz });
    T.level.effects.update(dt, T.cam.position);
  }

  // ------------------------------------------------------------ flow
  toTitle() {
    this.state = 'title'; this.paused = false;
    this.hud.show(false); this.showTouch(false); this.input.enabled = false; this.input.exitLock();
    this.renderer.setGrade('winter', true); this.renderer.uniforms.uInjury.value = 0; this.renderer.uniforms.uBino.value = 0;
    this.audio.stopAmbience(); this.audio.setAmbience({ wind: 1 }); this.audio.playMusic('title');
    this.ui.title();
  }
  newJourney() { this.progress.reset(); this.runStep(0); }
  continueJourney() {
    const cp = this.progress.s.checkpoint;
    if (cp && SEQUENCE[this.progress.s.step]?.id === cp.missionId) { this.startMission(MISSIONS[cp.missionId], cp.index, true); return; }
    this.runStep(this.progress.s.step);
  }
  stepIndexOfChapter(id) { return SEQUENCE.findIndex((s) => s.type === 'chapter' && s.id === id); }
  playChapter(id) { this.cleanupMission(); this.runStep(this.stepIndexOfChapter(id)); }
  currentChapter() { for (let i = this.progress.s.step; i >= 0; i--) if (SEQUENCE[i]?.type === 'chapter') return CHAPTERS.find((c) => c.id === SEQUENCE[i].id); return CHAPTERS[0]; }
  nextMissionDef() { for (let i = this.progress.s.step; i < SEQUENCE.length; i++) { const s = SEQUENCE[i]; if (s.type === 'mission') return MISSIONS[s.id]; if (s.type === 'chapter' && i > this.progress.s.step) break; } return null; }
  currentProtagonist() { return (this.nextMissionDef() || MISSIONS[SEQUENCE[this.progress.s.step]?.id] || {}).protagonist || { id: 'p0' }; }
  hubState() { const id = SEQUENCE[this.progress.s.step]?.id || 'none'; const h = this.progress.s.hub; if (!h[id]) h[id] = { slots: 3 }; return h[id]; }
  toastAnywhere(k) { if (this.game.running) this.hud.toast(k); }

  runStep(i) {
    const P = this.progress;
    if (i >= SEQUENCE.length) { this.toTitle(); return; }
    P.s.step = i; P.s.reached = Math.max(P.s.reached, i); P.save();
    const s = SEQUENCE[i];
    this.ui.closeAll();
    if (s.type === 'chapter') {
      const ch = CHAPTERS.find((c) => c.id === s.id);
      this.state = 'card'; this.hud.show(false); this.showTouch(false);
      this.renderer.setGrade(ch.grade || 'sepia1910', true);
      this.audio.playMusic(ch.music || 'title');
      P.s.arrived ||= {}; if (!P.s.arrived[ch.id]) { P.s.arrived[ch.id] = true; P.addOrg(ch.supplyOnArrive || {}); }
      this.ui.chapterCard(ch, () => this.runStep(i + 1));
    } else if (s.type === 'travel') {
      this.state = 'travel'; this.hud.show(false); this.showTouch(false); this.cleanupMission();
      this.travel.show(s.route, () => this.runStep(i + 1));
    } else if (s.type === 'mission') {
      const m = MISSIONS[s.id];
      this.state = 'briefing'; this.hud.show(false); this.showTouch(false);
      this.ui.briefing(m, () => this.startMission(m, 0));
    } else if (s.type === 'hub') {
      this.startMission(MISSIONS[s.id], 0);
    } else if (s.type === 'ending') {
      this.state = 'ending'; this.cleanupMission(); this.hud.show(false); this.showTouch(false);
      this.audio.playMusic('liberation'); this.renderer.setGrade('dawn1945', true);
      P.s.finished = true; P.save();
      this.ui.ending(ENDING, () => { this.ui.credits(); });
    }
  }
  currentLoadout(m) {
    const P = this.progress, org = P.org, hub = P.s.hub[SEQUENCE[P.s.step - 1]?.id] || P.s.hub[SEQUENCE[P.s.step]?.id] || {};
    const lo = P.s.loadout && P.s.loadout.missionId === m?.id ? P.s.loadout : null;
    const armed = (m?.protagonist?.weapon || 'none') !== 'none';
    const ammo = armed ? (lo?.ammo ?? Math.min(org.ammo, m?.ammo ?? 15)) : 0;
    return { ammo, bandages: (m?.bandages ?? 2) + (hub.bandages || 0), food: !!hub.rations || org.food >= 1 };
  }
  setLoadoutAmmo(n) { const m = this.nextMissionDef(); this.progress.s.loadout = { missionId: m?.id, ammo: n }; this.progress.save(); }

  startMission(m, checkpoint = 0, resumed = false) {
    const P = this.progress;
    this.ui.closeAll();
    this.state = 'mission'; this.paused = false;
    let loadout = this.run?.missionId === m.id ? this.run.loadout : null;
    if (!loadout) {
      if (m.hub) loadout = { ammo: 0, bandages: 0, food: true, equip: P.s.equip };
      else {
        const lo = this.currentLoadout(m);
        const hub = P.s.hub[SEQUENCE[P.s.step - 1]?.id] || {};
        // the organisation pays for the mission: ammunition, food, medicine
        const allyAmmo = {};
        let pool = Math.max(0, P.org.ammo - lo.ammo);
        for (const s of m.squad || []) { if (P.isLost(s.id)) continue; const n = Math.min(s.reserve ?? 15, pool); allyAmmo[s.id] = n; pool -= n; }
        const used = lo.ammo + Object.values(allyAmmo).reduce((a, b) => a + b, 0);
        if ((m.protagonist.weapon || 'none') !== 'none' || used) P.addOrg({ ammo: -used });
        let food = lo.food; if (food && !hub.rations) P.addOrg({ food: -1 });
        loadout = { ammo: lo.ammo, bandages: lo.bandages, food, allyAmmo, equip: { ...P.s.equip }, condition: P.s.condition[m.protagonist.id] ?? 0.8 };
      }
      this.run = { missionId: m.id, loadout };
    }
    this.fade(() => {
      this.game.load(m, { checkpoint, loadout });
      this.hud.show(true); this.showTouch(this.input.isTouch);
      this.input.enabled = true;
      if (!this.input.isTouch) this.showClickToPlay();
      if (!m.hub) { P.s.checkpoint = { missionId: m.id, index: checkpoint }; P.save(); }
    });
  }
  saveCheckpoint(id, index) { this.progress.setCheckpoint(id, index); }
  cleanupMission() { if (this.game.running) { this.game.dispose(); } this.audio.stopAmbience(); this.renderer.uniforms.uInjury.value = 0; this.renderer.uniforms.uBino.value = 0; }
  missionComplete(sum) {
    const P = this.progress, m = this.game.def;
    this.input.enabled = false; this.input.exitLock(); this.showTouch(false);
    this.run = null;
    if (m.hub) { P.s.loadout = null; this.cleanupMission(); this.hud.show(false); this.runStep(P.s.step + 1); return; }
    // return what is left to the organisation; apply rewards; record companions
    const leftAlly = sum.squad.reduce((a, s) => a + (s.state === 'lost' ? 0 : s.ammo), 0);
    P.addOrg({ ammo: sum.ammoLeft + leftAlly, medicine: Math.floor(sum.bandagesLeft / 2), ...(m.rewards || {}) });
    for (const s of sum.squad) if (s.state === 'injured' || s.state === 'wounded') P.setCompanion(s.id, { injured: true });
    P.s.condition[m.protagonist.id] = Math.max(0.4, (P.s.condition[m.protagonist.id] ?? 0.8) - 0.1);
    P.s.completed[m.id] = { t: sum.time, lost: sum.squad.filter((s) => s.state === 'lost').length };
    P.s.loadout = null; P.clearCheckpoint(); P.save();
    this.state = 'results'; this.hud.show(false);
    this.audio.playMusic(sum.squad.some((s) => s.state === 'lost') ? 'sorrow' : 'hub');
    this.ui.results(m, sum, () => { this.cleanupMission(); this.runStep(P.s.step + 1); });
  }
  missionFailed(reason, cp) {
    const m = this.game.def;
    this.state = 'failed'; this.input.enabled = false; this.input.exitLock(); this.showTouch(false); this.hud.show(false);
    this.audio.playMusic('sorrow');
    this.ui.failed(m, reason, cp, { retryCp: () => this.startMission(m, cp), restart: () => this.startMission(m, 0), quit: () => { this.cleanupMission(); this.toTitle(); } });
  }
  restartMission(fromCp) { const m = this.game.def, cp = fromCp ? this.game.mission.checkpointIndex : 0; this.startMission(m, cp); }
  quitToTitle() { this.progress.save(); this.cleanupMission(); this.run = null; this.toTitle(); }
  pause(silent) {
    if (this.state !== 'mission' || this.paused) return;
    this.paused = true; this.input.enabled = false; this.suppressLockPause = true; this.input.exitLock(); setTimeout(() => (this.suppressLockPause = false), 100);
    this.audio.duck(0.35, 0.2); this.showTouch(false);
    if (!silent) this.ui.pause();
  }
  setPaused(p, keepUi) { if (p) { this.paused = true; this.input.enabled = false; this.suppressLockPause = true; this.input.exitLock(); setTimeout(() => (this.suppressLockPause = false), 100); this.showTouch(false); } else { this.paused = false; this.input.enabled = true; this.input.clearEdges(); this.showTouch(this.input.isTouch); if (!this.input.isTouch) this.showClickToPlay(); } void keepUi; }
  resume() {
    this.ui.closeAll(); this.paused = false; this.input.enabled = true; this.input.clearEdges();
    this.showTouch(this.input.isTouch);
    if (!this.input.isTouch) { this.input.requestLock(); this.showClickToPlay(); }
  }
  onMenuBack() { if (this.state === 'mission') this.resume(); }
  showClickToPlay() {
    if (this.input.locked || this.input.device === 'pad') return;
    let el = document.getElementById('clickplay');
    if (!el) { el = document.createElement('div'); el.id = 'clickplay'; document.body.appendChild(el); el.addEventListener('click', () => { this.input.requestLock(); el.classList.remove('on'); this.audio.unlock(); }); }
    el.innerHTML = `<span>${ICON.hand}${L('clickToPlay')}</span>`;
    el.classList.add('on');
    const off = () => { if (this.input.locked || this.input.device === 'pad') { el.classList.remove('on'); } else if (this.state === 'mission' && !this.paused) requestAnimationFrame(off); else el.classList.remove('on'); };
    requestAnimationFrame(off);
  }
  fade(mid) {
    const f = document.getElementById('fade'); f.classList.add('on');
    setTimeout(() => { try { mid(); } catch (e) { console.error(e); } setTimeout(() => f.classList.remove('on'), 120); }, 380);
  }

  // ------------------------------------------------------------ touch
  setupTouch() {
    const t = document.getElementById('touch');
    const btn = (act, icon, label, extra = '') => `<button class="tb tb-${act}" data-act="${act}" ${extra} aria-label="${label}"><span class="ti">${ICON[icon]}</span><span class="tl" data-l="${label}"></span></button>`;
    t.innerHTML = `<div class="t-look"></div><div class="t-joy"><div class="t-knob"></div></div>
      <div class="t-right">${btn('fire', 'fire', 'touchBtn_fire')}${btn('aim', 'aim', 'touchBtn_aim', 'data-toggle="1"')}${btn('interact', 'hand', 'touchBtn_interact')}${btn('reload', 'reload', 'touchBtn_reload')}${btn('crouch', 'crouch', 'touchBtn_crouch', 'data-toggle="1"')}${btn('cover', 'cover', 'touchBtn_cover')}${btn('binoculars', 'bino', 'touchBtn_binoculars')}${btn('bandage', 'bandage', 'touchBtn_bandage')}</div>
      <div class="t-left">${btn('sprint', 'run', 'touchBtn_sprint')}<button class="tb tb-squad" id="tSquad"><span class="ti">${ICON.squad}</span><span class="tl" data-l="touchBtn_squad"></span></button><button class="tb tb-log" id="tLog"><span class="ti">${ICON.journal}</span><span class="tl" data-l="touchBtn_log"></span></button></div>`;
    this.input.attachTouch(t);
    // crouch toggle must mirror the game's state (C toggles in game logic), so drive it as a pulse instead
    const cr = t.querySelector('[data-act="crouch"]'); cr.removeAttribute('data-toggle');
    t.querySelector('#tSquad').addEventListener('touchstart', (e) => { e.preventDefault(); if (this.game.running && !this.paused) this.game.cycleSquad(); });
    t.querySelector('#tLog').addEventListener('touchstart', (e) => { e.preventDefault(); if (this.game.running && !this.paused) { this.pause(true); this.ui.log('obj'); } });
    this.updateTouchLabels();
  }
  updateTouchLabels() { document.querySelectorAll('#touch .tl').forEach((el) => (el.textContent = L(el.dataset.l))); }
  showTouch(v) { document.getElementById('touch').classList.toggle('hidden', !v); document.body.classList.toggle('touchmode', !!this.input.isTouch); }
  touchInteract(on) { document.querySelector('#touch .tb-interact')?.classList.toggle('ready', on); }
}

window.addEventListener('error', (e) => { const el = document.getElementById('fatal'); if (el && !window.__app) { el.textContent = 'Error: ' + e.message; el.style.display = 'block'; } });
new App();
