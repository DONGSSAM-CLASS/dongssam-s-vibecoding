// AI for opponents, companions, allied units and civilians.
import { Actor } from './actor.js';
import { clamp, pointOnPolyline, polylineLength, rand } from '../engine/util.js';

const DETECT_TARGET_KINDS = new Set(['player', 'ally', 'civilian']);

// ===================================================================================== Enemy
export class Enemy extends Actor {
  constructor(game, def) {
    super(game, { ...def, kind: 'enemy' });
    this.group = def.group || 'g0';
    this.mode = def.mode || (def.route ? 'patrol' : def.column ? 'column' : 'guard');
    this.route = def.route || null; this.routeIdx = 0; this.routeDir = 1; this.waitT = 0;
    this.guardPos = [this.x, this.z]; this.guardFacing = this.facing; this.scanArc = def.scanArc ?? 1.2; this.scanT = Math.random() * 6;
    this.viewRange = def.viewRange ?? 34; this.fov = def.fov ?? 1.9; // radians, full cone
    this.detect = new Map();
    this.awareOf = null; this.lastKnown = null;
    this.coverPos = null; this.shootT = 1.5 + Math.random() * 2; this.peekT = 0;
    this.searchT = 0; this.staggerT = 0; this.wary = false;
    this.lantern = !!def.lantern;
    this.speedWalk = def.speedWalk ?? 1.35;
    this.column = def.column || null; // {path, s, spacing, index, speed}
    this.observeT = 0; this.observed = false; this.routeKnown = false;
    this.label = def.label || 'soldier';
    this.noShoot = !!def.noShoot; // police/instructors in non-combat missions only detain
    this.accuracy = def.accuracy ?? 1;
    this.detectT = Math.random() * 0.1;
    this.calloutT = 0;
    this.blindT = def.blindT ?? 0;
  }

  subdue(by) {
    if (!this.active) return;
    this.state = 'down'; this.subdued = true; this.hp = 0;
    this.game.onEnemyDown(this, by, true);
  }
  onIncapacitated(from) { this.state = 'down'; this.game.onEnemyDown(this, from, false); }

  // ---- perception ----
  perceive(dt) {
    const g = this.game;
    if (this.blindT > 0) { this.blindT -= dt; return; } // lost the trail (scripted)
    this.detectT -= dt; if (this.detectT > 0) return; const step = 0.1 + Math.random() * 0.02; this.detectT = step;
    const night = g.env.time === 'night';
    let range = this.viewRange * (night ? (this.lantern ? 0.55 : 0.42) : 1) * (g.env.weather === 'snow' || g.env.weather === 'rain' ? 0.78 : g.env.weather === 'fog' ? 0.6 : 1);
    if (this.mode === 'column') range *= 0.75;
    const fx = Math.sin(this.facing), fz = Math.cos(this.facing), cosHalf = Math.cos(this.fov / 2);
    for (const t of g.detectables) {
      if (!t.active || t.carriedBy) continue;
      const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
      let cur = this.detect.get(t) || 0;
      let seen = 0;
      if (d < range * 1.1) {
        const inCone = (dx * fx + dz * fz) / (d || 1) > cosHalf;
        if (inCone || d < 2.2) {
          const vis = g.visibility(this, t);
          if (vis > 0.05) {
            const lit = night && t.lit ? 1.6 : 1;
            let rate = 1.25 * vis * Math.pow(Math.max(0, 1 - d / range), 0.6) * lit;
            rate *= t.crouch ? 0.55 : 1;
            rate *= t.speed > 4 ? 1.45 : t.speed < 0.3 ? 0.65 : 1;
            rate *= this.mode === 'suspicious' || this.mode === 'search' || this.wary ? 1.7 : 1;
            rate *= g.diff.detect;
            if (t.kind === 'player' && g.equip.camo && g.terrain.surfaceAt(t.x, t.z) === 'snow') rate *= 0.7;
            if (t.kind === 'civilian') rate *= 0.85;
            if (d < 3.5) rate *= 2.5;
            seen = rate;
          }
        }
      }
      if (seen > 0) { cur = Math.min(1.2, cur + seen * step); this.lastKnown = { x: t.x, z: t.z, t: g.time, who: t }; }
      else cur = Math.max(0, cur - step * (this.mode === 'combat' ? 0.05 : 0.18));
      this.detect.set(t, cur);
      if (this.mode === 'combat') continue;
      if (cur >= 1) { this.enterCombat(t); return; }
      if (cur >= 0.38 && (this.mode === 'patrol' || this.mode === 'guard' || this.mode === 'column' || this.mode === 'search')) {
        if (this.mode !== 'suspicious') { this.prevMode = this.mode === 'search' ? (this.prevMode || 'patrol') : this.mode; this.mode = 'suspicious'; this.searchT = 0; g.onEnemySuspicious(this, t); }
      }
    }
  }
  enterCombat(t, force = false) {
    const g = this.game;
    if (this.mode === 'combat' || this.mode === 'retreat') return;
    if (this.blindT > 0 && !force) return; // scripted: marching on, oblivious
    this.blindT = 0;
    this.mode = 'combat'; this.awareOf = t; this.lastKnown = { x: t.x, z: t.z, t: g.time, who: t };
    this.coverPos = null; this.shootT = 1.6 + Math.random() * 1.8; // take in the situation before the first shot
    g.onEnemyAlert(this, t);
  }
  hear(x, z, kind, src) {
    if (!this.active || this.mode === 'combat' || this.mode === 'retreat' || this.blindT > 0) return;
    this.lastKnown = { x, z, t: this.game.time, who: src };
    if (kind === 'shot' || kind === 'alarm') {
      if (src && this.game.visibility(this, src) > 0.2 && this.dist(src) < this.viewRange) this.enterCombat(src);
      else { this.prevMode = this.mode === 'suspicious' || this.mode === 'search' ? this.prevMode : this.mode; this.mode = 'search'; this.searchT = 0; this.wary = true; }
    } else if (this.mode !== 'search') { this.prevMode = this.mode === 'suspicious' ? this.prevMode : this.mode; this.mode = 'suspicious'; this.searchT = 0; }
  }

  update(dt) {
    if (!this.active) { this.stop(dt); return; }
    const g = this.game;
    this.suppress = Math.max(0, this.suppress - dt * 0.25);
    this.anim.aim = false; this.anim.signal = false;
    if (this.staggerT > 0) { this.staggerT -= dt; this.stop(dt); this.anim.flinch = this.staggerT > 1.2; return; }
    if (this.mode !== 'retreat') this.perceive(dt);
    const mode = this.mode;
    if (mode === 'patrol') this.doPatrol(dt);
    else if (mode === 'guard') this.doGuard(dt);
    else if (mode === 'column') this.doColumn(dt);
    else if (mode === 'suspicious') this.doSuspicious(dt);
    else if (mode === 'search') this.doSearch(dt);
    else if (mode === 'combat') this.doCombat(dt);
    else if (mode === 'retreat') this.doRetreat(dt);
    else if (mode === 'detain') this.doDetain(dt);
    this.crouch = mode === 'combat' && this.coverPos && this.peekT <= 0 && this.atCover;
    this.model.setWeaponMode(mode === 'combat' || mode === 'search' || mode === 'suspicious' || mode === 'retreat' || mode === 'detain' ? 'ready' : 'slung');
  }
  doPatrol(dt) {
    const r = this.route; if (!r || r.length < 2) return this.doGuard(dt);
    if (this.waitT > 0) {
      this.waitT -= dt; this.stop(dt);
      const p = r[this.routeIdx];
      if (p[3] != null) this.faceTo(p[3] + Math.sin(this.game.time * 0.8) * 0.6, dt, 2);
      else this.faceTo(this.facing + Math.sin(this.game.time * 0.9) * 0.02, dt, 2);
      return;
    }
    const p = r[this.routeIdx];
    if (this.goTo(p[0], p[1], this.speedWalk * (this.wary ? 1.15 : 1), dt, 0.9)) {
      this.waitT = p[2] ?? 1.5;
      if (this.def.pingpong) { if (this.routeIdx + this.routeDir >= r.length || this.routeIdx + this.routeDir < 0) this.routeDir *= -1; this.routeIdx += this.routeDir; }
      else this.routeIdx = (this.routeIdx + 1) % r.length;
    }
  }
  doGuard(dt) {
    this.scanT += dt;
    if (this.distXZ(this.guardPos[0], this.guardPos[1]) > 1.2) { this.goTo(this.guardPos[0], this.guardPos[1], this.speedWalk, dt, 0.6); return; }
    this.stop(dt);
    this.faceTo(this.guardFacing + Math.sin(this.scanT * 0.45) * this.scanArc * 0.5, dt, 2.5);
  }
  doColumn(dt) {
    const c = this.column;
    if (c.halt) { this.stop(dt); return; }
    c.s += (c.speed ?? 1.4) * dt;
    const L = polylineLength(c.path);
    if (c.s >= L) { this.stop(dt); c.arrived = true; return; }
    const [px, pz] = pointOnPolyline(c.path, Math.max(0, c.s));
    if (c.s < 0) { this.stop(dt); return; }
    const [ax, az] = pointOnPolyline(c.path, Math.max(0, c.s + 2));
    const ang = Math.atan2(ax - px, az - pz);
    const ox = Math.cos(ang) * (c.lateral || 0), oz = -Math.sin(ang) * (c.lateral || 0);
    this.goTo(px + ox, pz + oz, (c.speed ?? 1.4) * 1.35, dt, 0.4);
  }
  doSuspicious(dt) {
    const g = this.game, lk = this.lastKnown;
    this.searchT += dt;
    this.stop(dt);
    if (lk) this.faceToward(lk.x, lk.z, dt, 5);
    this.anim.headYaw = Math.sin(g.time * 2) * 0.3;
    // walk a few steps toward the disturbance after a beat
    if (this.searchT > 1.4 && lk && this.distXZ(lk.x, lk.z) > 3) { this.mode = 'search'; this.searchT = 0; }
    let maxD = 0; for (const v of this.detect.values()) maxD = Math.max(maxD, v);
    if (this.searchT > 5 && maxD < 0.2) this.resumeRoutine();
  }
  doSearch(dt) {
    const lk = this.lastKnown; this.searchT += dt;
    if (!lk) return this.resumeRoutine();
    if (!this.searchPt) this.searchPt = [lk.x, lk.z];
    if (this.goTo(this.searchPt[0], this.searchPt[1], 1.7, dt, 1.2)) {
      this.faceTo(this.facing + dt * 1.2, dt, 3);
      if (Math.random() < dt * 0.4) { const a = Math.random() * 6.28; this.searchPt = [lk.x + Math.cos(a) * 7, lk.z + Math.sin(a) * 7]; if (!this.game.nav.walkable(...this.searchPt)) this.searchPt = [lk.x, lk.z]; }
    }
    if (this.searchT > 18) { this.searchPt = null; this.resumeRoutine(); }
  }
  resumeRoutine() {
    this.mode = this.prevMode && this.prevMode !== 'suspicious' && this.prevMode !== 'search' ? this.prevMode : (this.route ? 'patrol' : this.column ? 'column' : 'guard');
    this.wary = true; this.searchPt = null;
    for (const k of this.detect.keys()) this.detect.set(k, 0.1);
    this.game.onEnemyCalm(this);
  }
  pickTarget() {
    const g = this.game; let best = null, bd = Infinity;
    for (const t of g.combatTargets) {
      if (!t.active || t.carriedBy) continue;
      const d = this.dist(t); if (d > 90) continue;
      const v = g.visibility(this, t);
      const score = d * (v > 0.1 ? 1 : 3) * (t === this.awareOf ? 0.8 : 1);
      if (score < bd) { bd = score; best = t; }
    }
    return best;
  }
  doCombat(dt) {
    const g = this.game;
    this.retargetT = (this.retargetT || 0) - dt;
    if (this.retargetT <= 0 || !this.awareOf || !this.awareOf.active) { this.retargetT = 2; const t = this.pickTarget(); if (t) this.awareOf = t; }
    const t = this.awareOf;
    if (!t || !t.active) { this.stop(dt); return; }
    if (this.noShoot) { this.mode = 'detain'; return; }
    const vis = g.visibility(this, t);
    if (vis > 0.1) this.lastKnown = { x: t.x, z: t.z, t: g.time, who: t };
    // choose cover facing the threat
    this.coverT = (this.coverT || 0) - dt;
    if (!this.coverPos || this.coverT <= 0) {
      this.coverT = 6 + Math.random() * 4;
      const c = g.world.findCover(this.x, this.z, t.x, t.z, 12, 0.7).filter((c) => Math.hypot(c.x - t.x, c.z - t.z) > 6 && !g.coverTaken(c, this))[0];
      this.coverPos = c ? [c.x, c.z] : null; this.coverHigh = c?.high;
      if (this.coverPos) g.claimCover(this.coverPos, this);
    }
    this.atCover = false;
    if (this.coverPos) {
      if (this.goTo(this.coverPos[0], this.coverPos[1], 3.4, dt, 0.6, true)) this.atCover = true;
    } else if (vis < 0.1 && this.lastKnown) {
      // no cover and no sight: close in carefully
      this.goTo(this.lastKnown.x + (Math.random() - 0.5) * 4, this.lastKnown.z + (Math.random() - 0.5) * 4, 1.9, dt, 6);
    } else this.stop(dt);
    if (this.atCover || !this.coverPos) this.faceToward(t.x, t.z, dt, 6);
    // fire control: no shooting while running for cover
    if (this.coverPos && !this.atCover) this.shootT = Math.max(this.shootT, 0.8);
    this.shootT -= dt * (1 - this.suppress * 0.6);
    this.peekT = Math.max(0, this.peekT - dt);
    if (this.shootT < 0.7 && this.suppress < 0.75) this.peekT = 0.9; // rise before the shot
    if (this.peekT > 0) this.anim.aim = true;
    if (this.shootT <= 0) {
      this.shootT = (this.weapon.cycle || 1) * 2.2 + 1.2 + Math.random() * 2.2 + this.suppress * 3;
      if (vis > 0.08 && this.ammo !== 0) g.enemyFire(this, t, vis);
      else if (this.lastKnown && g.time - this.lastKnown.t > 6) { this.coverPos = null; }
    }
  }
  doRetreat(dt) {
    const g = this.game;
    const rp = this.retreatTo || g.mission?.def.retreatPoint || [0, g.terrain.bounds - 3];
    this.anim.aim = false;
    if (this.goTo(rp[0], rp[1], 3.8, dt, 4) || g.time - (this.retreatT || g.time) > 45) { this.state = 'routed'; this.model.root.visible = false; g.onEnemyRouted(this); }
    // occasional covering shot while withdrawing
    this.shootT -= dt;
    if (this.shootT <= 0 && this.awareOf?.active && g.visibility(this, this.awareOf) > 0.3) { this.shootT = 4 + Math.random() * 3; g.enemyFire(this, this.awareOf, 0.5, 0.4); }
  }
  doDetain(dt) { // non-combat opponents (police, instructors) close in to catch the courier
    const t = this.awareOf; if (!t || !t.active) { this.resumeRoutine(); return; }
    const g = this.game;
    const vis = g.visibility(this, t);
    if (vis > 0.1) this.lastKnown = { x: t.x, z: t.z, t: g.time, who: t };
    const lk = this.lastKnown;
    if (lk) this.goTo(lk.x, lk.z, 3.3, dt, 0.9);
    this.anim.signal = true;
    if (this.dist(t) < 1.4) g.onCaught(this, t);
    if (lk && g.time - lk.t > 7) { this.mode = 'search'; this.searchT = 6; this.awareOf = null; }
  }
}

// ===================================================================================== Ally
export class Ally extends Actor {
  constructor(game, def) {
    super(game, { ...def, kind: 'ally' });
    this.order = def.order || 'follow';
    this.squad = def.squad !== false;
    this.holdPos = def.holdPos || [this.x, this.z];
    this.slot = def.slot ?? 0;
    this.bleedT = 0; this.severe = false; this.treated = false; this.timesDowned = 0;
    this.shootT = 1 + Math.random() * 2; this.coverPos = null;
    this.reportCd = 0; this.treatT = 0; this.treatTarget = null;
    this.fireAt = null;
    this.holdFire = def.holdFire ?? true;
    this.skill = def.skill ?? (this.role === 'marksman' ? 1.5 : 1);
    this.viewRange = this.role === 'scout' ? 46 : 30;
    this.reserve = def.reserve ?? 15; this.ammo = this.weapon.mag;
    this.lowAmmoSaid = false;
  }
  get bleedLeft() { return this.bleedT; }
  onIncapacitated(from) {
    const g = this.game;
    this.timesDowned++;
    this.state = 'wounded';
    this.severe = this.timesDowned > 1 || Math.random() < 0.35;
    this.treated = false;
    this.bleedT = (this.def.bleed ?? 75) * g.diff.bleed * (g.equip.fieldKit ? 1.25 : 1);
    g.onAllyWounded(this);
  }
  treat(by) {
    const g = this.game;
    this.treated = true;
    if (this.severe) { this.state = 'wounded'; this.bleedT = Infinity; }
    else { this.state = 'injured'; this.hp = 45; }
    g.onAllyTreated(this, by);
  }
  update(dt) {
    const g = this.game;
    this.reportCd = Math.max(0, this.reportCd - dt);
    this.anim.aim = false; this.anim.treat = false; this.anim.kneel = false;
    if (this.carriedBy) return;
    if (this.state === 'wounded') {
      this.stop(dt);
      if (!this.treated) {
        this.bleedT -= dt;
        if (this.bleedT <= 0) { this.state = 'lost'; g.onAllyLost(this); }
      }
      return;
    }
    if (!this.active) { this.stop(dt); return; }
    this.suppress = Math.max(0, this.suppress - dt * 0.3);
    const p = g.player;
    const injuredMul = this.state === 'injured' ? 0.7 : 1;
    // medics prioritise the wounded; any nearby comrade drags the player back up if no medic can
    if (this.role === 'medic' && this.medicDuty(dt)) return;
    if (this._reviver) {
      if (p.state !== 'wounded') this._reviver = false;
      else {
        if (this.goTo(p.x, p.z, 4.6, dt, 1.1)) { this.anim.treat = true; this.faceToward(p.x, p.z, dt, 8); this.reviveT = (this.reviveT || 0) + dt; if (this.reviveT > 6) { p.revive(35); this._reviver = false; this.reviveT = 0; } }
        return;
      }
    }
    // scouts share what they see
    if (this.role === 'scout' || this.squad) this.observe(dt);
    const combat = g.alertLevel >= 3;
    const weaponsFree = !this.holdFire || g.weaponsFree;
    let dest = null, speed = 3.0 * injuredMul;
    switch (this.order) {
      case 'follow': {
        const back = 2.6 + this.slot * 1.3, side = (this.slot % 2 ? 1 : -1) * (1 + Math.floor(this.slot / 2) * 0.8);
        const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
        let tx = p.x - fx * back + fz * side, tz = p.z - fz * back - fx * side;
        if (combat && !this.coverPos) {
          const threat = g.nearestThreat(this);
          if (threat) { const c = g.world.findCover(p.x, p.z, threat.x, threat.z, 9, 0.7).filter((c) => !g.coverTaken(c, this))[0]; if (c) { this.coverPos = [c.x, c.z]; g.claimCover(this.coverPos, this); } }
        }
        if (combat && this.coverPos && Math.hypot(this.coverPos[0] - p.x, this.coverPos[1] - p.z) < 12) { tx = this.coverPos[0]; tz = this.coverPos[1]; }
        else if (!combat) this.coverPos = null;
        const d = this.distXZ(tx, tz);
        if (d > 1.2) { dest = [tx, tz]; speed = (d > 6 || p.speed > 4 ? 5.0 : p.crouch ? 1.7 : 3.0) * injuredMul; }
        this.crouch = p.crouch || combat || g.alertLevel >= 1;
        break;
      }
      case 'hold': case 'move': {
        const [hx, hz] = this.holdPos;
        if (this.distXZ(hx, hz) > 0.8) { dest = [hx, hz]; speed = (this.order === 'move' ? 3.4 : 2.6) * injuredMul; }
        this.crouch = this.distXZ(hx, hz) < 2 ? true : g.alertLevel >= 2;
        break;
      }
      case 'cover': {
        const [hx, hz] = this.holdPos;
        if (this.distXZ(hx, hz) > 0.8) { dest = [hx, hz]; speed = 3.6 * injuredMul; }
        this.crouch = true;
        break;
      }
      case 'fallback': {
        const rp = g.mission?.rallyPoint() || [p.x, p.z];
        if (this.distXZ(rp[0], rp[1]) > 2) { dest = rp; speed = 4.6 * injuredMul; this.crouch = false; }
        else { this.crouch = true; }
        break;
      }
    }
    if (dest) this.goTo(dest[0], dest[1], this.crouch && speed < 3.5 ? Math.min(speed, 1.9) : speed, dt, 0.8);
    else this.stop(dt);
    // weapons
    this.model.setWeaponMode(combat || this.order === 'cover' ? 'ready' : 'slung');
    this.shootT -= dt;
    let target = null;
    if (!this.weapon.mag) target = null;
    else if (this.order === 'cover' && this.fireAt) target = 'area';
    else if (weaponsFree && combat) target = g.nearestVisibleEnemy(this, this.role === 'marksman' ? 120 : 75);
    if (target) {
      if (target !== 'area') this.faceToward(target.x, target.z, dt, 6); else this.faceToward(this.fireAt[0], this.fireAt[1], dt, 6);
      this.anim.aim = this.shootT < 0.8;
      if (this.shootT <= 0) {
        if (this.ammo <= 0) {
          if (this.reserve > 0) { const n = Math.min(this.weapon.mag, this.reserve); this.reserve -= n; this.ammo = n; this.shootT = this.weapon.reload + 0.5; }
          else { if (!this.lowAmmoSaid) { g.say(this, 'outOfAmmo'); this.lowAmmoSaid = true; } this.shootT = 3; }
        } else {
          this.ammo--;
          const base = (this.weapon.cycle || 1.1) * 1.8 + 0.8 + Math.random() * 1.6;
          this.shootT = target === 'area' ? base * 0.75 : base;
          if (target === 'area') g.allySuppress(this, this.fireAt);
          else g.allyFire(this, target);
          if (this.ammo + this.reserve === 4 && !this.lowAmmoSaid) { g.say(this, 'lowAmmo'); }
        }
      }
    }
  }
  observe(dt) {
    const g = this.game;
    this.obsT = (this.obsT || 0) - dt; if (this.obsT > 0) return; this.obsT = 0.4;
    for (const e of g.enemies) {
      if (!e.active || e.observed) continue;
      const d = this.dist(e); if (d > this.viewRange * (g.env.time === 'night' ? 0.55 : 1)) continue;
      if (g.visibility(this, e) > 0.3) {
        if (this.role === 'scout') { g.markObserved(e, this); if (this.reportCd <= 0) { g.say(this, 'spotted', { dir: g.compassDir(this, e), dist: Math.round(d) }); this.reportCd = 6; } }
      }
    }
  }
  medicDuty(dt) {
    const g = this.game;
    if (this.treatTarget && (this.treatTarget.state !== 'wounded' && !(this.treatTarget === g.player && g.player.state === 'wounded') || this.treatTarget.treated)) { this.treatTarget = null; this.treatT = 0; }
    if (!this.treatTarget) {
      let best = null, bd = 28;
      for (const a of g.squadAndPlayer) {
        if (a === this) continue;
        const needs = (a.state === 'wounded' && !a.treated) || (a === g.player && a.state === 'wounded');
        if (!needs || a.carriedBy) continue;
        const d = this.dist(a); if (d < bd) { bd = d; best = a; }
      }
      if (!best) return false;
      this.treatTarget = best; this.treatT = 0;
      if (this.reportCd <= 0) { g.say(this, 'medicMoving'); this.reportCd = 5; }
    }
    const t = this.treatTarget;
    if (this.goTo(t.x, t.z, 4.4, dt, 1.1)) {
      this.anim.treat = true; this.faceToward(t.x, t.z, dt, 8);
      this.treatT += dt * (g.equip.fieldKit ? 1.3 : 1);
      if (this.treatT > 4) {
        if (t === g.player) g.player.revive(45); else t.treat(this);
        this.treatTarget = null; this.treatT = 0;
      }
    }
    return true;
  }
}

// ===================================================================================== Civilian
export class Civilian extends Actor {
  constructor(game, def) {
    super(game, { ...def, kind: 'civilian', weapon: 'none' });
    this.mode = def.mode || 'idle'; // idle | follow | hide | safe | wander
    this.leader = null; this.slot = def.slot ?? 0;
    this.panicT = 0;
    this.home = [this.x, this.z];
    this.injured = !!def.injured; if (this.injured) this.state = 'wounded';
    this.talkLines = def.talk;
  }
  update(dt) {
    const g = this.game;
    if (this.carriedBy) return;
    if (this.state === 'wounded') { this.stop(dt); return; }
    if (!this.active) { this.stop(dt); return; }
    this.panicT = Math.max(0, this.panicT - dt);
    if (this.panicT > 0) { this.crouch = true; this.stop(dt); return; }
    if (this.mode === 'follow' && this.leader) {
      const L = this.leader;
      const back = 2.2 + this.slot * 1.1, side = (this.slot % 2 ? 0.9 : -0.9);
      const fx = Math.sin(L.facing), fz = Math.cos(L.facing);
      const tx = L.x - fx * back + fz * side, tz = L.z - fz * back - fx * side;
      const d = this.distXZ(tx, tz);
      this.crouch = L.crouch;
      if (d > 1.0) this.goTo(tx, tz, d > 6 ? 3.6 : L.crouch ? 1.6 : 2.8, dt, 0.7); else this.stop(dt);
    } else if (this.mode === 'hide') { this.crouch = true; this.stop(dt); }
    else if (this.mode === 'goto' && this.dest) { if (this.goTo(this.dest[0], this.dest[1], 2.8, dt, 1)) { this.mode = 'idle'; this.facing = this.def.facing ?? this.facing; } }
    else if (this.mode === 'wander') {
      this.wT = (this.wT || 0) - dt;
      if (this.wT <= 0) { this.wT = 4 + Math.random() * 6; const a = Math.random() * 6.28; this.dest = [this.home[0] + Math.cos(a) * 5, this.home[1] + Math.sin(a) * 5]; }
      if (this.dest && this.goTo(this.dest[0], this.dest[1], 1.2, dt, 0.8)) this.dest = null;
    } else this.stop(dt);
    if (this.def.gesture) this.anim[this.def.gesture] = true;
  }
}
export { DETECT_TARGET_KINDS, rand, clamp };
