// Mission-time game runtime. Owns the level, actors, combat resolution, perception, squad orders,
// interactables, the observation journal, and routes events to HUD, audio, progress and the mission.
import * as THREE from 'three';
import { Level } from '../world/level.js';
import { NavGrid } from './nav.js';
import { Player } from './player.js';
import { Enemy, Ally, Civilian } from './ai.js';
import { CameraRig } from './camera.js';
import { MissionRuntime } from './mission.js';
import { DIFFICULTY } from './weapons.js';
import { clamp, reseed } from '../engine/util.js';
import { L } from '../engine/i18n.js';
import { BARKS } from '../data/barks.js';
import { attachCarried } from '../world/characters.js';

const _v = new THREE.Vector3();

export class Game {
  constructor(app) {
    this.app = app;
    this.renderer = app.renderer; this.input = app.input; this.audio = app.audio; this.hud = app.hud;
    this.settings = app.settings; this.progress = app.progress;
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 4000);
    this.cam = new CameraRig(this.camera, this);
    this.running = false;
  }
  get diff() { return DIFFICULTY[this.settings.difficulty] || DIFFICULTY.standard; }
  get skills() { return this.progress.skillsFor(this.protagonist); }
  skillLevel(k) { return this.progress.skillLevel(this.protagonist, k); }

  // ---------------------------------------------------------------- load
  load(def, { checkpoint = 0, loadout = {} } = {}) {
    this.dispose();
    reseed(def.seed || 1234);
    this.def = def;
    this.env = def.env;
    this.protagonist = def.protagonist.id;
    this.time = 0; this.stepBudget = 6;
    this.level = new Level(def.env, { quality: this.renderer.quality });
    this.scene = this.level.scene; this.terrain = this.level.terrain; this.world = this.level.world; this.effects = this.level.effects;
    this.flags = new Set(); this.counters = {};
    this.interactables = []; this.markers3d = [];
    this.actors = []; this.enemies = []; this.allies = []; this.civilians = []; this.squad = [];
    this.groups = {};
    this.coverClaims = new Map();
    this.journal = []; this.stats = { shots: 0, hits: 0, downed: 0, subdued: 0, treated: 0, rescued: 0, carried: 0, observed: 0, clues: 0, delivered: 0, supplies: 0, civiliansSafe: 0, alerts: 0, ammoShared: 0 };
    this.alertLevel = 0; this.weaponsFree = false; this.signalGiven = false;
    this.equip = { ...(loadout.equip || {}) };
    this.missionFood = loadout.food !== false;
    this.loadout = loadout;
    this.ctx = { game: this };
    this.level.build({ game: this, def });
    this.terrain.bridges = this.level.kit.bridges || [];
    this.nav = new NavGrid(this.terrain, this.world, 2);
    // player
    const P = def.protagonist;
    const pdef = { id: 'player', pos: def.start.pos, facing: def.start.facing ?? 0, outfit: P.outfit, weapon: P.weapon || 'none',
      reserve: loadout.ammo ?? def.ammo ?? 15, bandages: (loadout.bandages ?? def.bandages ?? 2) + this.diff.bandages, binoculars: this.equip.binoculars || P.binoculars, condition: loadout.condition ?? 0.8 };
    this.player = new Player(this, pdef);
    this.player.name = P.name;
    this.actors.push(this.player);
    if (P.carry) { this.player.carryItem = { kind: P.carry }; this.player.model.setCarryItem(P.carry); }
    // squad
    (def.squad || []).forEach((s, i) => {
      if (this.progress.isLost(s.id)) return;
      const a = new Ally(this, { ...s, slot: i, kind: 'ally', reserve: loadout.allyAmmo?.[s.id] ?? s.reserve ?? 15 });
      a.name = s.name;
      if (this.progress.companion(s.id)?.injured) { a.state = 'injured'; a.hp = 60; }
      this.allies.push(a); this.squad.push(a); this.actors.push(a);
    });
    for (const u of def.allies || []) { const a = new Ally(this, { ...u, squad: false, order: u.order || 'hold' }); this.allies.push(a); this.actors.push(a); }
    for (const e of def.enemies || []) this.spawnEnemy(e);
    for (const c of def.civilians || []) { const a = new Civilian(this, c); a.name = c.name; this.civilians.push(a); this.actors.push(a); }
    for (const [id, gdef] of Object.entries(def.groups || {})) this.groups[id] = { id, morale: 100, routAt: gdef.routAt ?? 40, retreat: gdef.retreat, size: 0, losses: 0, routed: false, ...gdef };
    for (const e of this.enemies) { const gg = this.groups[e.group] || (this.groups[e.group] = { id: e.group, morale: 100, routAt: 40, size: 0, losses: 0 }); gg.size++; }
    this.refreshLists();
    // lantern carriers light their surroundings (and are easier to see coming)
    for (const e of this.enemies) if (e.lantern) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), new THREE.MeshBasicMaterial({ color: '#ffd28a' }));
      lamp.position.set(0, -0.36, 0.05); e.model.arms[0].fore.add(lamp);
      this.level.lightSources.push({ get x() { return e.x; }, get y() { return e.y + 1.0; }, get z() { return e.z; }, color: '#ffb664', get intensity() { return e.active ? 1.2 : 0; }, dist: 11 });
    }
    // mission
    this.mission = new MissionRuntime(this, def, { checkpoint });
    def.setup?.(this, this.mission);
    this.mission.start();
    // camera & presentation
    this.cam.snapBehind(this.player);
    this.renderer.setGrade(def.env.grade || 'neutral', true);
    this.effects.setWeather(def.env.weather, this.camera);
    this.audio.setAmbience(def.env.ambience || {});
    this.audio.playMusic(def.music || 'explore');
    this.hud.bindGame(this);
    this.running = true;
    this.input.enabled = true;
  }
  spawnEnemy(e) {
    const a = new Enemy(this, e);
    this.enemies.push(a); this.actors.push(a);
    if (this.groups[a.group]) this.groups[a.group].size++;
    if (e.preObserved || this.progress.networkIntel(this.def) && e.intel) this.markObserved(a, null, true);
    return a;
  }
  spawnAlly(def) {
    const a = new Ally(this, { squad: false, order: 'hold', ...def });
    a.name = def.name; this.allies.push(a); this.actors.push(a); this.refreshLists();
    return a;
  }
  // enemy that arrives already fighting (assault waves)
  spawnAttacker(def, target) {
    const e = this.spawnEnemy({ ...def, mode: 'guard' });
    const t = target || this.player;
    e.lastKnown = { x: t.x, z: t.z, t: this.time, who: t };
    e.enterCombat(t, true);
    return e;
  }
  refreshLists() {
    this.squadAndPlayer = [this.player, ...this.squad];
    this.detectables = [this.player, ...this.allies.filter((a) => a.squad || a.def.detectable), ...this.civilians.filter((c) => c.def.detectable !== false && (c.mode === 'follow' || c.def.detectable))];
    this.combatTargets = [this.player, ...this.allies];
  }
  dispose() {
    this.running = false;
    if (this.scene) {
      this.scene.traverse((o) => { if (o.geometry && !o.geometry.__shared) o.geometry.dispose?.(); });
    }
    this.scene = null; this.level = null;
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    if (!this.running) return;
    this.time += dt; this.stepBudget = 6;
    const p = this.player;
    // camera look
    const look = this.input.takeLook();
    const slow = this.aimAssistSlow();
    p.update(dt);
    if (p.state === 'wounded' && !this.mission.done) {
      this.downTimer -= dt; this.hud.downTimer?.(this.downTimer);
      if (this.downTimer <= 0) this.mission.fail('downed');
    } else if (this.hud.isDowned) this.hud.downed(false);
    for (const a of this.allies) a.update(dt);
    for (const e of this.enemies) e.update(dt);
    for (const c of this.civilians) c.update(dt);
    this.updateCarried();
    if (this.env.time === 'night') {
      const src = this.level.lightSources || [];
      for (const a of this.detectables) a.lit = src.some((l) => l.intensity > 0 && Math.hypot(l.x - a.x, l.z - a.z) < l.dist * 0.55);
    }
    this.updateObservation(dt);
    this.updateAlert(dt);
    this.mission.update(dt);
    this.cam.update(dt, look, p, { aim: p.aim, bino: p.bino, slow, sens: this.settings.sensitivity ?? 1 });
    for (const a of this.actors) if (!a.gone && a.model.root.visible) a.syncModel(dt);
    this.level.update(dt, this.time, p);
    this.effects.update(dt, this.camera.position);
    const f = this.cam.forward;
    this.audio.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, f.x, f.z);
    // injury colour drain + heartbeat
    const hpK = p.hp / p.maxHp;
    this.renderer.uniforms.uInjury.value = p.state === 'wounded' ? 1 : clamp((0.55 - hpK) * 1.6, 0, 0.8);
    this.renderer.uniforms.uBino.value = p.bino ? 1 : 0;
    this.hbT = (this.hbT || 0) - dt;
    if (hpK < 0.35 && this.hbT <= 0 && p.active) { this.audio.heartbeat(1 - hpK); this.hbT = 0.7 + hpK * 1.5; }
    this.hud.update(dt);
  }
  aimAssistSlow() {
    const lvl = this.settings.aimAssist ?? 1; // 0 off, 1 low, 2 high
    const p = this.player;
    if (!lvl || !p.aim) { this.assistTarget = null; return 1; }
    const cam = this.camera.position, f = this.cam.forward;
    let best = null, bestA = (lvl === 2 || this.input.device !== 'kb' ? 0.07 : 0.035);
    for (const e of this.enemies) {
      if (!e.active || !e.visibleToPlayer) continue;
      _v.set(e.x - cam.x, e.chestY() - cam.y, e.z - cam.z); const d = _v.length(); _v.divideScalar(d);
      const ang = Math.acos(clamp(_v.dot(f), -1, 1));
      if (ang < bestA) { bestA = ang; best = e; }
    }
    this.assistTarget = best;
    if (!best) return 1;
    // gentle magnetism on controllers and touch only
    if (this.input.device !== 'kb' || lvl === 2) {
      const want = Math.atan2(best.x - cam.x, best.z - cam.z);
      const dy = ((want - this.cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.cam.yaw += dy * 0.06 * lvl;
    }
    return lvl === 2 ? 0.45 : 0.65;
  }

  // ---------------------------------------------------------------- queries
  groundY(x, z) {
    let y = this.terrain.heightAt(x, z);
    for (const b of this.terrain.bridges || []) if (this.inBridge(b, x, z)) y = Math.max(y, b.y);
    return y;
  }
  inBridge(b, x, z) { const dx = x - b.x, dz = z - b.z, c = Math.cos(-b.ry), s = Math.sin(-b.ry); const lx = dx * c + dz * s, lz = -dx * s + dz * c; return Math.abs(lx) < b.len / 2 + 0.3 && Math.abs(lz) < b.width / 2; }
  onBridge(x, z) { return (this.terrain.bridges || []).some((b) => this.inBridge(b, x, z)); }
  actorsNear(x, z, r) { const out = []; for (const a of this.actors) if (!a.gone && Math.abs(a.x - x) < r && Math.abs(a.z - z) < r) out.push(a); return out; }
  // fraction (0..1) of target visible to observer, reduced by concealment
  visibility(obs, t) {
    const ex = obs.x, ey = obs.eyeY(), ez = obs.z;
    const pts = [t.headY(), t.chestY()];
    let vis = 0, conceal = 0;
    for (const y of pts) {
      if (this.terrain.blocks(ex, ey, ez, t.x, y, t.z, 2.5)) continue;
      const s = this.world.segment(ex, ey, ez, t.x, y, t.z, 'sight');
      if (s.shape) continue;
      vis += 0.5; conceal = Math.max(conceal, s.conceal);
    }
    if (vis <= 0) return 0;
    const here = this.world.concealAt(t.x, t.z, t.headY());
    conceal = Math.max(conceal, here * (t.crouch ? 1 : 0.55));
    return vis * (1 - conceal * 0.9);
  }
  nearestThreat(a) {
    let best = null, bd = 80;
    for (const e of this.enemies) { if (!e.active || e.mode !== 'combat') continue; const d = a.dist(e); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  nearestVisibleEnemy(a, range) {
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (!e.active || e.mode === 'retreat' && Math.random() < 0.5) continue;
      const d = a.dist(e); if (d > bd) continue;
      if (this.visibility(a, e) > 0.15) { bd = d; best = e; }
    }
    return best;
  }
  coverTaken(c, who) { for (const [k, v] of this.coverClaims) if (v !== who && v.active && Math.hypot(k[0] - c.x, k[1] - c.z) < 1.2) return true; return false; }
  claimCover(pos, who) { for (const [k, v] of this.coverClaims) if (v === who) this.coverClaims.delete(k); this.coverClaims.set(pos, who); }
  compassDir(from, to) {
    // world +z is "north" on mission maps
    const a = Math.atan2(to.x - from.x, to.z - from.z);
    const dirs = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'];
    const ko = ['북', '북서', '서', '남서', '남', '남동', '동', '북동'];
    const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    return { en: dirs[i], ko: ko[i] };
  }

  // ---------------------------------------------------------------- tracing / combat
  // ray from (ox,oy,oz) along dir. returns {point, actor, shape, surface, t}
  trace(ox, oy, oz, dx, dy, dz, range, { includeEnemies = true, includeAllies = false, skipNear = 0, ignore = null } = {}) {
    const ex = ox + dx * range, ey = oy + dy * range, ez = oz + dz * range;
    let best = range, hit = null;
    // world shapes
    const s = this.world.segment(ox, oy, oz, ex, ey, ez, 'bullets');
    if (s.shape && s.t * range > skipNear) { best = s.t * range; hit = { shape: s.shape, surface: s.shape.surface || 'wood' }; }
    // terrain march (coarse then fine)
    const step = 1.5;
    for (let d = Math.max(skipNear, 0.5); d < best; d += step) {
      const x = ox + dx * d, y = oy + dy * d, z = oz + dz * d;
      if (this.terrain.heightAt(x, z) > y) {
        let lo = d - step, hi = d;
        for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (this.terrain.heightAt(ox + dx * m, oz + dz * m) > oy + dy * m) hi = m; else lo = m; }
        best = hi; hit = { surface: this.terrain.surfaceAt(x, z), terrain: true }; break;
      }
    }
    // actors as vertical capsules
    const list = [...(includeEnemies ? this.enemies : []), ...(includeAllies ? this.allies : [])];
    for (const a of list) {
      if (a === ignore || a.gone || a.carriedBy || a.state === 'routed') continue;
      if (!a.active && a.kind === 'enemy') continue;
      const wx = a.x - ox, wz = a.z - oz;
      const tca = wx * dx + wz * dz; const hl = Math.hypot(dx, dz) || 1e-6;
      const t = tca / (hl * hl);
      if (t < skipNear || t > best) continue;
      const px = ox + dx * t - a.x, pz = oz + dz * t - a.z;
      if (Math.hypot(px, pz) > 0.34) continue;
      const y = oy + dy * t; const top = a.headY() + 0.12, bot = a.y;
      if (y < bot || y > top) continue;
      best = t; hit = { actor: a, surface: 'cloth' };
    }
    const point = new THREE.Vector3(ox + dx * best, oy + dy * best, oz + dz * best);
    return { ...(hit || {}), point, t: best, miss: !hit };
  }
  playerShoot(p) {
    const w = p.weapon;
    this.stats.shots++;
    const aim = this.cam.aimPoint(w.range || 400);
    const origin = new THREE.Vector3(p.x, p.eyeY() + 0.02, p.z);
    origin.x += -Math.cos(this.cam.yaw) * 0.18; origin.z += Math.sin(this.cam.yaw) * 0.18;
    const dir = aim.point.clone().sub(origin).normalize();
    // spread: random direction inside cone
    const sp = p.spread();
    const r = Math.sqrt(Math.random()) * sp, a = Math.random() * Math.PI * 2;
    const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(dir, up).normalize(), u2 = new THREE.Vector3().crossVectors(right, dir);
    dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(u2, Math.sin(a) * r).normalize();
    const hit = this.trace(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, w.range || 400, { skipNear: 0.4 });
    const muzzle = p.model.muzzleWorld(new THREE.Vector3());
    this.effects.muzzle(muzzle, dir);
    this.audio.shot(muzzle, { kind: w.sound, own: true });
    this.cam.recoil(0.022 + (w.kind === 'carbine' ? -0.01 : 0));
    this.camShake(0.18);
    this.input.rumble(0.35, 70);
    this.noise(p.x, p.z, 140, 'shot', p);
    this.mission.onPlayerShot?.(hit);
    if (hit.actor) {
      const e = hit.actor;
      this.stats.hits++;
      this.audio.hitmark(); this.hud.hitMarker();
      this.effects.impact(hit.point, 'dirt');
      e.damage(100, p);
    } else if (!hit.miss) {
      this.effects.impact(hit.point, hit.surface);
      this.audio.impact(hit.point, hit.surface);
      // near-miss suppression
      for (const e of this.enemies) if (e.active && Math.hypot(e.x - hit.point.x, e.z - hit.point.z) < 3) { e.suppress = Math.min(1, e.suppress + 0.4); if (e.mode !== 'combat') e.enterCombat(p); }
      this.mission.onImpact?.(hit);
    }
  }
  enemyFire(e, t, vis, mult = 1) {
    const g = this;
    const muzzle = e.model.muzzleWorld(new THREE.Vector3());
    const dir = new THREE.Vector3(t.x - e.x, t.chestY() - muzzle.y, t.z - e.z).normalize();
    this.effects.muzzle(muzzle, dir);
    this.audio.shot(muzzle, { kind: 'rifle' });
    const d = e.dist(t);
    let p = 0.34 * clamp(1.1 - d / 60, 0.08, 1) * clamp(vis, 0, 1) * mult * e.accuracy;
    if (t.speed > 4) p *= 0.45; else if (t.speed > 2.5) p *= 0.6; else if (t.speed > 1) p *= 0.8;
    if (t.crouch) p *= 0.8;
    p *= g.diff.enemyAcc * (1 - e.suppress * 0.6) * (g.env.time === 'night' ? 0.7 : 1);
    if (t === this.player && this.player.cover) p *= 0.75;
    if (Math.random() < p) {
      const dmg = t === this.player ? 24 * g.diff.dmgTaken : 38;
      t.damage(dmg, e);
      if (t === this.player) { this.audio.hurt(); this.hud.damageFrom(e); this.camShake(0.5); this.input.rumble(0.7, 160); }
      else { this.audio.thud({ x: t.x, y: t.y + 1, z: t.z }, 0.4); }
    } else {
      // the miss lands near the target or strikes its cover
      const mx = t.x + (Math.random() - 0.5) * 2.2, mz = t.z + (Math.random() - 0.5) * 2.2;
      const s = this.world.segment(muzzle.x, muzzle.y, muzzle.z, mx, t.chestY(), mz, 'bullets');
      let pt;
      if (s.shape) pt = { x: muzzle.x + (mx - muzzle.x) * s.t, y: muzzle.y + (t.chestY() - muzzle.y) * s.t, z: muzzle.z + (mz - muzzle.z) * s.t };
      else pt = { x: mx, y: this.groundY(mx, mz) + 0.05, z: mz };
      setTimeout(() => { if (!this.running) return; this.effects.impact(pt, s.shape ? (s.shape.surface || 'wood') : this.terrain.surfaceAt(mx, mz)); this.audio.impact(pt, s.shape?.surface || 'dirt'); }, Math.min(600, d / 0.8));
      if (t === this.player || this.player.dist(t) < 4) { setTimeout(() => this.audio.whiz(), Math.min(400, d * 1.2)); this.player.suppressedT = this.time; }
    }
    this.noise(e.x, e.z, 120, 'shot', e);
  }
  allyFire(a, e) {
    const muzzle = a.model.muzzleWorld(new THREE.Vector3());
    const dir = new THREE.Vector3(e.x - a.x, 0, e.z - a.z).normalize();
    this.effects.muzzle(muzzle, dir); this.audio.shot(muzzle, { kind: 'rifle' });
    const d = a.dist(e), vis = this.visibility(a, e);
    const team = 1 + 0.07 * (this.skillLevel('teamwork') - 1);
    let p = 0.3 * clamp(1.15 - d / 80, 0.1, 1) * vis * a.skill * team * (a.state === 'injured' ? 0.7 : 1) * (1 - a.suppress * 0.5);
    if (e.crouch) p *= 0.7;
    if (this.mission.ambushBonus && e.ambushed) p *= 1.25;
    if (Math.random() < p) { e.damage(100, a); this.effects.impact({ x: e.x, y: e.chestY(), z: e.z }, 'dirt'); }
    else { e.suppress = Math.min(1, e.suppress + 0.3); const pt = { x: e.x + (Math.random() - 0.5) * 2, y: this.groundY(e.x, e.z) + 0.1, z: e.z + (Math.random() - 0.5) * 2 }; this.effects.impact(pt, this.terrain.surfaceAt(pt.x, pt.z)); }
    this.noise(a.x, a.z, 120, 'shot', a);
  }
  allySuppress(a, pt) {
    const muzzle = a.model.muzzleWorld(new THREE.Vector3());
    this.effects.muzzle(muzzle, new THREE.Vector3(pt[0] - a.x, 0, pt[1] - a.z).normalize()); this.audio.shot(muzzle, { kind: 'rifle' });
    const team = 1 + 0.1 * (this.skillLevel('teamwork') - 1);
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (Math.hypot(e.x - pt[0], e.z - pt[1]) < 7) {
        e.suppress = Math.min(1, e.suppress + 0.45 * team);
        if (e.mode !== 'combat' && e.mode !== 'retreat') e.enterCombat(a);
        if (Math.random() < 0.06 * team * this.visibility(a, e)) e.damage(100, a);
        const gg = this.groups[e.group]; if (gg) gg.morale -= 0.6 * team;
      }
    }
    const ix = pt[0] + (Math.random() - 0.5) * 6, iz = pt[1] + (Math.random() - 0.5) * 6;
    this.effects.impact({ x: ix, y: this.groundY(ix, iz) + 0.1, z: iz }, this.terrain.surfaceAt(ix, iz));
    this.noise(a.x, a.z, 120, 'shot', a);
    this.stats.suppress = (this.stats.suppress || 0) + 1;
  }
  noise(x, z, r, kind, src) {
    for (const e of this.enemies) {
      if (!e.active || e === src) continue;
      if (src && src.kind === 'enemy' && kind === 'shot') { if (e.mode !== 'combat' && !(e.blindT > 0) && Math.hypot(e.x - x, e.z - z) < r * 0.6 && e.group === src.group && src.awareOf) e.enterCombat(src.awareOf); continue; }
      if (Math.hypot(e.x - x, e.z - z) < r) e.hear(x, z, kind, src);
    }
    if (kind === 'shot') for (const c of this.civilians) if (c.active && Math.hypot(c.x - x, c.z - z) < 30) c.panicT = Math.max(c.panicT, 1.5);
  }
  camShake(a) { this.cam.shake(a); }

  // ---------------------------------------------------------------- squad
  squadCommand(cmd) {
    const p = this.player;
    const live = this.squad.filter((a) => a.active);
    if (!live.length) { this.hud.toast('noSquad'); return; }
    let pt = null;
    if (cmd === 'follow' || cmd === 'cover') {
      const hit = this.cam.aimPoint(90);
      pt = [hit.point.x, hit.point.z];
    }
    const nearSelf = pt && Math.hypot(pt[0] - p.x, pt[1] - p.z) < 3;
    live.forEach((a, i) => {
      a.path = null;
      if (cmd === 'follow') {
        if (nearSelf || !pt || (this.input.device === 'touch')) { a.order = 'follow'; a.coverPos = null; }
        else { a.order = 'move'; const ang = (i - (live.length - 1) / 2) * 1.6; a.holdPos = this.safeSpot(pt[0] + ang, pt[1] + ang * 0.3); }
      } else if (cmd === 'hold') { a.order = 'hold'; a.holdPos = [a.x, a.z]; }
      else if (cmd === 'cover') {
        a.order = 'cover'; a.holdPos = [a.x, a.z]; a.fireAt = pt;
      } else if (cmd === 'fallback') { a.order = 'fallback'; }
    });
    const k = cmd === 'follow' ? (nearSelf || !pt || this.input.device === 'touch' ? 'following' : 'moving') : cmd === 'hold' ? 'holding' : cmd === 'cover' ? 'covering' : 'fallingBack';
    this.say(live[0], k);
    this.hud.orderFlash(cmd, pt);
    this.award('teamwork', 1, null, true);
    this.tutorial?.flag('cmd_' + cmd);
    this.mission.onCommand?.(cmd, pt);
  }
  safeSpot(x, z) { const [rx, rz] = this.world.resolve(x, z, 0.5); return [rx, rz]; }
  // order of the touch "squad" button: follow → hold → cover
  cycleSquad() { const o = this.squad.find((a) => a.active)?.order; this.squadCommand(o === 'follow' || o === 'move' ? 'hold' : o === 'hold' ? 'cover' : 'follow'); }

  // ---------------------------------------------------------------- carried bodies & interaction
  updateCarried() {
    const p = this.player;
    if (p.carrying) {
      const c = p.carrying;
      c.x = p.x; c.z = p.z; c.y = p.y;
      attachCarried(c.model, p.model);
    }
  }
  addInteractable(it) { it.enabled ??= () => true; it.radius ??= 2.2; this.interactables.push(it); return it; }
  removeInteractable(id) { this.interactables = this.interactables.filter((i) => i.id !== id); }
  findInteractable(p) {
    let best = null, bd = Infinity;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const consider = (it, x, z, r) => {
      const d = Math.hypot(x - p.x, z - p.z); if (d > r) return;
      const dot = ((x - p.x) * fx + (z - p.z) * fz) / (d || 1);
      const score = d - dot * 0.8;
      if (score < bd) { bd = score; best = it; }
    };
    for (const it of this.interactables) { if (!it.enabled(this)) continue; const [x, z] = typeof it.pos === 'function' ? it.pos(this) : it.pos; consider(it, x, z, it.radius); }
    // dynamic: wounded allies / civilians, sharing ammo, carrying
    if (p.carrying) return { id: '_drop', prompt: 'putDown', hold: 0, dyn: true, onUse: () => this.dropCarried() };
    for (const a of [...this.squad, ...this.allies.filter((x) => !x.squad), ...this.civilians]) {
      if (a.carriedBy || a.gone) continue;
      if (a.state === 'wounded' && !a.treated && a.kind === 'ally') consider({ id: '_treat_' + a.id, prompt: 'treat', name: a.name, hold: 3 - this.skillLevel('firstAid') * 0.3, channel: 'treat', dyn: true, actor: a, onUse: () => this.playerTreat(a) }, a.x, a.z, 2);
      else if (a.state === 'wounded' && (a.treated || a.kind === 'civilian')) consider({ id: '_carry_' + a.id, prompt: 'carry', name: a.name, hold: 0.8, dyn: true, actor: a, onUse: () => this.pickUp(a) }, a.x, a.z, 2);
      else if (a.kind === 'ally' && a.squad && a.active && a.reserve + a.ammo < 8 && p.reserve >= 10) consider({ id: '_ammo_' + a.id, prompt: 'shareAmmo', name: a.name, hold: 0.6, dyn: true, actor: a, onUse: () => this.shareAmmo(a) }, a.x, a.z, 1.8);
      else if (a.kind === 'civilian' && a.active && a.def.escort && a.mode !== 'safe') consider({ id: '_lead_' + a.id, prompt: a.mode === 'follow' ? 'tellWait' : 'leadOn', name: a.name, hold: 0, dyn: true, actor: a, onUse: () => this.toggleCivilian(a) }, a.x, a.z, 2.2);
    }
    for (const e of this.enemies) if (e.state === 'down' && !e.searched && this.player.weapon.mag) consider({ id: '_search_' + e.id, prompt: 'searchFallen', hold: 1.2, dyn: true, actor: e, onUse: () => this.searchFallen(e) }, e.x, e.z, 1.6);
    return best;
  }
  interact(it) {
    if (it.dyn) { it.onUse(this); return; }
    if (it.sound !== false) this.audio.paper();
    it.onUse(this, it);
    if (it.once !== false) this.removeInteractable(it.id);
  }
  playerTreat(a) {
    const p = this.player;
    if (p.bandages <= 0 && !this.def.medicKit) { this.hud.toast('noBandages'); return; }
    if (!this.def.medicKit) p.bandages--;
    a.treat(p);
  }
  pickUp(a) {
    const p = this.player;
    if (p.carryItem) { this.hud.toast('handsFull'); return; }
    p.carrying = a; a.carriedBy = p; a.state = a.state === 'wounded' ? 'carried' : a.state;
    p.crouch = false; p.leaveCover();
    this.audio.cloth(); this.stats.carried++;
    this.hud.toast('carrying');
    this.tutorial?.flag('carry');
  }
  dropCarried() {
    const p = this.player, a = p.carrying; if (!a) return;
    p.carrying = null; a.carriedBy = null; a.state = 'wounded';
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    [a.x, a.z] = this.world.resolve(p.x + fx * 0.9, p.z + fz * 0.9, 0.4); a.y = this.groundY(a.x, a.z);
    a.model.root.quaternion.identity(); a.facing = p.facing;
    this.audio.cloth();
    this.mission.onDrop?.(a);
  }
  shareAmmo(a) {
    const p = this.player, n = Math.min(10, p.reserve - 5);
    if (n <= 0) return;
    p.reserve -= n; a.reserve += n; a.lowAmmoSaid = false;
    this.stats.ammoShared += n;
    this.say(a, 'thanksAmmo');
    this.award('supply', 6, 'xpShare');
  }
  // one word to the group moves (or halts) everyone travelling with them
  toggleCivilian(c) {
    const follow = c.mode !== 'follow';
    const grp = this.civilians.filter((o) => o.active && o.mode !== 'safe' && (o === c || (c.def.group && o.def.group === c.def.group && o.dist(c) < 18)));
    grp.forEach((o, i) => { o.mode = follow ? 'follow' : 'hide'; o.leader = follow ? this.player : null; o.slot = i; o.path = null; });
    this.say(c, follow ? 'civFollow' : 'civWait');
    this.refreshLists();
  }
  searchFallen(e) {
    e.searched = true;
    const n = 2 + Math.floor(Math.random() * 3);
    this.player.reserve += n;
    this.hud.toast({ en: `Recovered ${n} rounds`, ko: `탄약 ${n}발 회수` });
    this.stats.supplies++;
    this.award('supply', 2, null, true);
  }

  // ---------------------------------------------------------------- observation (scouting)
  updateObservation(dt) {
    const p = this.player, cam = this.camera.position, f = this.cam.forward;
    this.obsT = (this.obsT || 0) - dt;
    const tick = this.obsT <= 0; if (tick) this.obsT = 0.15;
    const night = this.env.time === 'night';
    const terrainLv = this.skillLevel('terrain');
    for (const e of this.enemies) {
      if (!e.active) { e.visibleToPlayer = false; continue; }
      if (!tick) continue;
      _v.set(e.x - cam.x, e.chestY() - cam.y, e.z - cam.z); const d = _v.length(); _v.divideScalar(d);
      const inView = _v.dot(f) > (p.bino ? 0.96 : 0.72);
      const range = (p.bino ? 140 : 70) * (night ? 0.5 : 1) * (this.env.weather === 'fog' ? 0.6 : this.env.weather === 'snow' ? 0.8 : 1);
      e.visibleToPlayer = inView && d < range && this.visibility(p, e) > 0.12;
      if (e.visibleToPlayer) {
        e.lastSeenByPlayer = { x: e.x, z: e.z, t: this.time };
        e.observeT += 0.15 * (p.bino ? 3 : 1) * (1 + 0.15 * (terrainLv - 1));
        if (!e.observed && e.observeT > 0.6) this.markObserved(e, p);
        if (e.observed && !e.routeKnown && e.route && e.observeT > 4.5) { e.routeKnown = true; this.journalAdd('route', e); this.award('intel', 4, 'xpRoute'); }
      }
    }
  }
  markObserved(e, by, silent = false) {
    if (e.observed) return;
    e.observed = true; e.lastSeenByPlayer = { x: e.x, z: e.z, t: this.time };
    this.stats.observed++;
    this.journalAdd('enemy', e, by);
    if (!silent) { this.award('intel', 2, null, true); if (by === this.player) this.tutorial?.flag('observe'); }
    this.mission.onObserved?.(e);
  }
  journalAdd(type, e, by, text) {
    this.journal.unshift({ type, t: this.time, label: e?.label, x: e?.x, z: e?.z, by: by?.name || null, text, id: e?.id });
    if (this.journal.length > 60) this.journal.pop();
    this.hud.journalPing(type);
  }

  // ---------------------------------------------------------------- alert & events
  updateAlert(dt) {
    let lvl = 0;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const m = e.mode;
      const l = m === 'combat' || m === 'detain' ? 3 : m === 'search' ? 2 : m === 'suspicious' ? 1 : 0;
      if (l > lvl) lvl = l;
    }
    if (lvl !== this.alertLevel) {
      if (lvl === 3 && this.alertLevel < 3) { this.stats.alerts++; this.audio.sting('alert'); }
      this.alertLevel = lvl;
      this.mission.onAlert?.(lvl);
    }
    if (lvl >= 3 && !this.weaponsFree && !this.mission.holdFireUntilSignal) this.weaponsFree = true;
    this.audio.setIntensity(lvl >= 2 ? 1 : lvl / 2);
    const want = lvl >= 3 ? (this.def.combatMusic || 'combat') : (this.def.music || 'explore');
    this.musicHold = Math.max(0, (this.musicHold || 0) - dt);
    if (lvl >= 3) this.musicHold = 8;
    if (want !== this.audio.music?.name && (lvl >= 3 || this.musicHold <= 0)) this.audio.playMusic(want);
  }
  onEnemySuspicious(e, t) { if (t === this.player || t.kind === 'civilian' || t.kind === 'ally') { this.audio.sting('suspicious'); this.hud.alertPing(e, 1); } }
  onEnemyAlert(e, t) {
    this.hud.alertPing(e, 3);
    this.subtitleSfx('sfxShout');
    // alert nearby comrades of the same group
    for (const o of this.enemies) if (o !== e && o.active && o.mode !== 'combat' && !(o.blindT > 0) && (o.group === e.group || o.dist(e) < 30)) o.enterCombat(t);
    this.mission.onEnemyAlert?.(e, t);
  }
  onEnemyCalm() {}
  onEnemyDown(e, by, subdued) {
    this.stats.downed++; if (subdued) this.stats.subdued++;
    const g = this.groups[e.group];
    if (g && !g.routed) {
      g.losses++;
      g.morale -= (100 / Math.max(3, g.size)) * (e.ambushed ? 1.3 : 1.1);
      if (g.morale <= g.routAt) this.routGroup(g);
    }
    if (by === this.player) this.award('combat', subdued ? 4 : 3, null, true);
    this.mission.onEnemyDown?.(e, by);
  }
  routGroup(g) {
    if (g.routed) return;
    g.routed = true;
    const B = this.terrain.bounds - 3;
    const rp = g.retreat ? [clamp(g.retreat[0], -B, B), clamp(g.retreat[1], -B, B)] : null;
    for (const e of this.enemies) if (e.group === g.id && e.active) { e.mode = 'retreat'; e.retreatTo = rp; e.retreatT = this.time; e.path = null; e.column = null; }
    this.subtitleSfx('sfxRetreat');
    this.say(this.squad.find((a) => a.active), 'enemyRetreat');
    this.mission.onGroupRouted?.(g);
  }
  // a group is finished when every member is down, gone, or clearly withdrawing out of the fight
  groupDone(id) {
    const g = this.groups[id]; if (!g) return true;
    return this.enemies.filter((e) => e.group === id).every((e) => !e.active || e.state === 'routed' ||
      (e.mode === 'retreat' && (this.time - (e.retreatT || this.time) > 20 || Math.hypot(e.x - this.player.x, e.z - this.player.z) > 55)));
  }
  onEnemyRouted(e) { this.mission.onEnemyRouted?.(e); }
  onAllyWounded(a) {
    this.say(a, 'hit'); this.hud.toast({ en: `${L(a.name)} is wounded!`, ko: `${L(a.name)} 부상!` }, 'warn');
    this.audio.sting('suspicious');
    this.mission.onAllyWounded?.(a);
  }
  onAllyTreated(a, by) {
    this.stats.treated++;
    if (by === this.player) { this.award('rescue', 10, 'xpTreat'); this.tutorial?.flag('treat'); }
    this.say(a, a.severe ? 'treatedSevere' : 'treated');
    this.mission.onAllyTreated?.(a);
  }
  onAllyLost(a) {
    this.hud.toast({ en: `${L(a.name)} could not be saved.`, ko: `${L(a.name)}을(를) 끝내 구하지 못했다.` }, 'loss');
    this.audio.sting('fail');
    this.progress.markLost(a.id, this.def.id);
    this.mission.onAllyLost?.(a);
  }
  onPlayerDowned() {
    const p = this.player;
    if (p.carrying) this.dropCarried();
    this.audio.duck(0.2, 3);
    const helper = this.squad.find((a) => a.active && a.role === 'medic' && a.dist(p) < 45) || this.squad.find((a) => a.active && a.dist(p) < 30);
    this.hud.downed(true, !!helper);
    if (helper && helper.role !== 'medic') { helper.role = helper.role; helper.treatTarget = p; helper._reviver = true; }
    this.downTimer = helper ? 30 : 2.5;
    this.mission.onPlayerDowned?.();
  }
  onCaught(by, t) {
    if (this.mission.done) return;
    if (t === this.player || t.kind === 'ally') this.mission.fail('caught');
    else if (t.kind === 'civilian') this.mission.fail('civCaught');
  }
  award(cat, amount, reason, quiet = false) {
    const r = this.progress.addXP(this.protagonist, cat, amount);
    this.missionXP = this.missionXP || {}; this.missionXP[cat] = (this.missionXP[cat] || 0) + amount;
    if (!quiet || r.levelUp) this.hud.xp(cat, amount, reason, r.levelUp);
  }
  say(who, key, vars) {
    if (!who) return;
    const lines = typeof key === 'string' ? BARKS[key] : key;
    if (!lines) return;
    const line = Array.isArray(lines) ? lines[Math.floor(Math.random() * lines.length)] : lines;
    this.hud.subtitle(who.name || who, line, vars, who.kind);
  }
  narrate(lines) { this.hud.queueLines(lines); }
  subtitleSfx(key) { if (this.settings.sfxCaptions) this.hud.caption(key); }
}
