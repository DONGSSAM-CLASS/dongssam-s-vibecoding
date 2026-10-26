// Player controller. Strength comes from position, patience and teamwork, not reflexes:
// there is no dodge roll; cover, stance, breath control and fatigue decide how well you shoot.
import { Actor } from './actor.js';
import { clamp, angleDiff } from '../engine/util.js';
import { WEAPONS } from './weapons.js';

const SIGNAL_PROMPT = { id: '__signal', prompt: { en: 'Give the signal', ko: '신호하기' } };

export class Player extends Actor {
  constructor(game, def) {
    super(game, { ...def, kind: 'player' });
    this.stamina = 100; this.maxStamina = 100;
    this.bandages = def.bandages ?? 2;
    this.condition = def.condition ?? 0.8; // weapon condition 0..1 (maintenance lowers jam chance)
    this.jammed = false;
    this.cover = null;
    this.carryItem = null;  // {kind, id}
    this.interactT = 0; this.interactTarget = null;
    this.bandageT = 0; this.meleeCd = 0; this.meleeT = 0;
    this.breath = 0; this.breathCd = 0;
    this.downT = 0;
    this.hasBino = !!def.binoculars;
    this.bino = false;
    this.swayX = 0; this.swayY = 0; this.swayT = Math.random() * 10;
    this.lastShotT = -10;
    this.tutorialFlags = new Set();
    this.radius = 0.32;
  }
  get skills() { return this.game.skills; }
  lvl(k) { return this.game.skillLevel(k); }

  update(dt) {
    const g = this.game, inp = g.input;
    this.meleeCd = Math.max(0, this.meleeCd - dt); this.cycleT = Math.max(0, this.cycleT - dt);
    this.breathCd = Math.max(0, this.breathCd - dt);
    this.anim.melee = false;
    if (this.state === 'wounded') { this.updateDowned(dt); return; }
    if (!this.active) return;
    const busy = this.bandageT > 0 || this.interactT > 0 && this.interactTarget?.channel;
    // ---- stance ----
    if (inp.pressed('crouch')) { this.crouch = !this.crouch; if (this.cover && !this.crouch && this.cover.low) this.leaveCover(); }
    if (inp.pressed('cover')) { if (this.cover) this.leaveCover(); else this.tryCover(); }
    // ---- aim / binoculars ----
    const canAim = this.weapon.mag > 0 && !this.carrying && !this.carryItem;
    this.bino = this.hasBino && inp.down('binoculars') && !this.carrying;
    // optional toggle aim for keyboard/mouse and gamepad (touch buttons always toggle)
    if (g.settings.holdToggle && !inp.isTouch) { if (inp.pressed('aim')) this.aimLatch = !this.aimLatch; if (!canAim || this.state !== 'ok') this.aimLatch = false; }
    else this.aimLatch = false;
    this.aim = canAim && (inp.down('aim') && !(g.settings.holdToggle && !inp.isTouch) || this.aimLatch) && !busy && !this.bino;
    if (this.weapon.mag > 0) this.model.setWeaponMode(this.aim || this.reloadT > 0 || g.alertLevel >= 2 && !this.carrying ? 'ready' : 'slung');
    // ---- movement ----
    const yaw = g.cam.yaw;
    const mx = inp.moveX, my = inp.moveY;
    // camera yaw convention: forward = (sin yaw, cos yaw); right = (-cos yaw, sin yaw)
    const dx = Math.sin(yaw) * my - Math.cos(yaw) * mx, dz = Math.cos(yaw) * my + Math.sin(yaw) * mx;
    const wantMove = Math.hypot(mx, my) > 0.1 && !busy && this.bandageT <= 0;
    const endurance = this.lvl('endurance');
    let sprint = inp.down('sprint') && wantMove && !this.aim && !this.crouch && this.stamina > 5 && !this.cover;
    if (this.aim && inp.down('sprint') && this.breathCd <= 0 && this.stamina > 10) { this.breath = Math.min(1, this.breath + dt * 4); this.stamina -= dt * 14; if (this.stamina < 10) this.breathCd = 2.5; }
    else this.breath = Math.max(0, this.breath - dt * 3);
    let speed = this.crouch ? 1.65 : 3.1;
    if (sprint) speed = 5.4 + endurance * 0.15;
    if (this.aim) speed = Math.min(speed, this.crouch ? 1.1 : 1.6);
    if (this.carrying) speed = (g.equip.stretcher && this.carrying.kind === 'ally' ? 2.4 : 1.7) + endurance * 0.12;
    else if (this.carryItem) speed = Math.min(speed, 2.4 + endurance * 0.1);
    if (this.cover) speed = Math.min(speed, 1.6);
    const cold = g.env.cold ? (g.equip.warmClothes ? 0.3 : 1) : 0;
    if (sprint) this.stamina -= dt * (17 - endurance * 1.4) * (1 + cold * 0.3);
    else this.stamina += dt * (9 + endurance * 1.2) * (this.carrying ? 0.2 : 1) * (1 - cold * 0.25);
    if (this.carrying) this.stamina -= dt * (4 - endurance * 0.4) * (g.equip.stretcher ? 0.5 : 1);
    this.maxStamina = 100 * (g.missionFood ? 1 : 0.75);
    this.stamina = clamp(this.stamina, 0, this.maxStamina);
    if (wantMove) {
      const faceAim = this.aim || this.bino;
      this.move(dx, dz, speed, dt, !faceAim);
      if (faceAim) this.faceTo(yaw, dt, 16);
      if (this.cover && this.coverDist() > 1.3) this.leaveCover();
    } else {
      this.move(0, 0, 0, dt, false);
      if (this.aim || this.bino) this.faceTo(yaw, dt, 16);
    }
    if (this.cover) this.crouch = this.cover.low ? !this.aim : this.crouch;
    // ---- weapon ----
    this.updateWeapon(dt, inp);
    // ---- bandage self ----
    if (inp.pressed('bandage') && this.bandageT <= 0 && this.bandages > 0 && this.hp < this.maxHp && !this.carrying) { this.bandageT = 3.2 - this.lvl('firstAid') * 0.25; g.audio.cloth(); g.hud.toast('bandaging'); }
    if (this.bandageT > 0) {
      this.anim.treat = true; this.bandageT -= dt;
      if (wantMove || this.aim) { this.bandageT = 0; this.anim.treat = false; }
      else if (this.bandageT <= 0) { this.bandages--; this.hp = Math.min(this.maxHp, this.hp + 38 + this.lvl('firstAid') * 7); this.anim.treat = false; g.audio.cloth(); }
    } else this.anim.treat = false;
    // ---- melee ----
    if (inp.pressed('melee') && this.meleeCd <= 0 && !this.carrying) this.melee();
    if (this.meleeT > 0) { this.meleeT -= dt; this.anim.melee = true; }
    // ---- interact ----
    this.updateInteract(dt, inp);
    // ---- squad commands & signal ----
    for (const c of ['cmd_follow', 'cmd_hold', 'cmd_cover', 'cmd_fallback']) if (inp.pressed(c)) g.squadCommand(c.slice(4));
    if (inp.pressed('signal')) g.mission?.trySignal();
    // sway (breathing + fatigue) for aimed fire
    this.swayT += dt * (0.9 + (1 - this.stamina / 100) * 1.4);
    const sw = this.spread() * (this.aim ? 1.2 : 0);
    this.swayX = (Math.sin(this.swayT * 1.3) + Math.sin(this.swayT * 2.9) * 0.4) * sw;
    this.swayY = (Math.cos(this.swayT * 1.1) * 0.7 + Math.sin(this.swayT * 3.7) * 0.3) * sw;
    this.anim.aim = this.aim; this.anim.reload = this.reloadT > 0;
    this.anim.headYaw = clamp(angleDiff(this.facing, yaw), -1, 1);
  }

  spread() {
    const w = this.weapon; if (!w.mag) return 0;
    let base = this.aim ? w.spread : w.hip;
    let k = 1;
    if (this.crouch) k *= 0.78;
    if (this.cover && this.aim) k *= 0.8;
    k *= 1 + Math.min(this.speed / 2.5, 1.4);
    k *= 1 + (1 - this.stamina / Math.max(1, this.maxStamina)) * 0.75;
    k *= 1 - 0.07 * (this.lvl('marksmanship') - 1);
    k *= 1 - this.breath * 0.5;
    k *= 1 + Math.max(0, 0.6 - (this.game.time - this.lastShotT)) * 1.5;
    if (this.game.env.cold && !this.game.equip.warmClothes) k *= 1.12;
    return base * k;
  }

  updateWeapon(dt, inp) {
    const g = this.game, w = this.weapon;
    if (!w.mag) return;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { const n = Math.min(w.mag - this.ammo, this.reserve); this.ammo += n; this.reserve -= n; }
    }
    if (inp.pressed('reload') && !this.carrying) {
      if (this.jammed) { this.jammed = false; this.reloadT = 1.1; g.audio.bolt(null, true); g.hud.toast('jamCleared'); }
      else if (this.ammo < w.mag && this.reserve > 0 && this.reloadT <= 0) {
        this.reloadT = w.reload * (1 - 0.05 * (this.lvl('marksmanship') - 1)); g.audio.reload(Math.min(w.mag - this.ammo, this.reserve));
      }
    }
    if (inp.pressed('fire') && !this.carrying && !this.carryItem && this.bandageT <= 0) {
      if (this.reloadT > 0) return;
      if (this.jammed) { g.audio.dry(); g.hud.toast('jammed'); return; }
      if (this.cycleT > 0) return;
      if (this.ammo <= 0) { g.audio.dry(); g.hud.toast(this.reserve > 0 ? 'reloadHint' : 'noAmmo'); return; }
      this.ammo--; this.cycleT = w.cycle * (g.equip.cleanBolt ? 0.85 : 1); this.lastShotT = g.time;
      g.playerShoot(this);
      this.anim.recoil = true;
      if (Math.random() < (1 - this.condition) * 0.12) { this.jammed = true; setTimeout(() => g.hud.toast('jammed'), 300); }
      else if (w.kind === 'rifle' && this.ammo > 0) setTimeout(() => g.audio.bolt(null, true), 220);
      if (this.ammo === 0 && this.reserve > 0 && g.settings.autoReload) setTimeout(() => { if (this.ammo === 0 && this.reloadT <= 0 && this.active) { this.reloadT = w.reload; g.audio.reload(Math.min(w.mag, this.reserve)); } }, 500);
    }
  }

  tryCover() {
    const c = this.game.world.nearestCoverShape(this.x, this.z, 1.7);
    if (!c) { this.game.hud.toast('noCover'); return; }
    const s = c.shape;
    // snap against the surface
    let px, pz;
    if (s.kind === 'circle') { px = s.x + c.nx * (s.r + 0.45); pz = s.z + c.nz * (s.r + 0.45); }
    else { px = this.x - c.nx * (c.d - 0.45); pz = this.z - c.nz * (c.d - 0.45); }
    [px, pz] = this.game.world.resolve(px, pz, this.radius);
    this.x = px; this.z = pz; this.y = this.game.groundY(px, pz);
    this.cover = { shape: s, low: s.h < 1.45, nx: c.nx, nz: c.nz };
    if (this.cover.low) this.crouch = true;
    this.game.audio.cloth();
    this.game.tutorial?.flag('cover');
  }
  coverDist() {
    if (!this.cover) return 99;
    const s = this.cover.shape;
    if (s.kind === 'circle') return Math.hypot(this.x - s.x, this.z - s.z) - s.r;
    const [lx, lz] = this.game.world._local(s, this.x, this.z);
    return Math.hypot(lx - clamp(lx, -s.hw, s.hw), lz - clamp(lz, -s.hd, s.hd));
  }
  leaveCover() { this.cover = null; }

  melee() {
    const g = this.game;
    this.meleeCd = 1.25; this.meleeT = 0.35;
    const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
    let target = null, best = 2.0;
    for (const e of g.enemies) {
      if (!e.active) continue;
      const d = this.dist(e); if (d > best) continue;
      const dot = ((e.x - this.x) * fx + (e.z - this.z) * fz) / (d || 1);
      if (dot > 0.45) { best = d; target = e; }
    }
    g.audio.cloth();
    if (!target) return;
    const unaware = target.awareOf !== this || target.mode === 'patrol' || target.mode === 'guard';
    g.audio.thud({ x: target.x, y: target.y + 1, z: target.z }, 0.7);
    g.camShake(0.25);
    if (unaware || target.staggerT > 0) target.subdue(this);
    else { target.staggerT = 1.4; target.suppress = Math.min(1, target.suppress + 0.6); g.noise(this.x, this.z, 10, 'melee', this); }
  }

  updateInteract(dt, inp) {
    const g = this.game;
    const target = g.findInteractable(this);
    // with nothing in reach, interact gives the mission signal (so gamepad and touch players can signal too)
    const sig = !target && g.mission?.signalPending();
    g.hud.setPrompt(target || (sig ? SIGNAL_PROMPT : null));
    if (!target) { this.interactT = 0; this.interactTarget = null; if (sig && inp.pressed('interact')) g.mission.trySignal(); return; }
    const hold = target.hold || 0;
    // one interaction per press: holding the key does not chain into the next action
    if (this.interactLock) { if (!inp.down('interact')) this.interactLock = false; else return; }
    if (inp.down('interact')) {
      if (this.interactTarget?.id !== target.id) { this.interactTarget = target; this.interactT = 0; if (!hold && inp.pressed('interact')) { g.interact(target); this.interactTarget = null; this.interactLock = true; } return; }
      if (hold) {
        this.interactT += dt * (target.speedMul ? target.speedMul(this) : 1);
        if (target.channel) this.anim.treat = target.channel === 'treat';
        if (this.interactT >= hold) { this.interactT = 0; this.interactTarget = null; this.anim.treat = false; this.interactLock = true; g.interact(target); }
        else this.interactTarget = target;
      }
    } else {
      if (this.interactTarget && this.interactT > 0) this.anim.treat = false;
      this.interactT = 0; this.interactTarget = null;
    }
  }

  onIncapacitated(from) {
    this.state = 'wounded'; this.downT = 0;
    this.game.onPlayerDowned(from);
  }
  updateDowned(dt) {
    this.downT += dt;
    this.move(0, 0, 0, dt, false);
    this.anim.aim = false;
  }
  revive(hp = 40) { this.state = 'ok'; this.hp = hp; this.crouch = true; this.game.hud.toast('revived'); }
}
export { WEAPONS };
