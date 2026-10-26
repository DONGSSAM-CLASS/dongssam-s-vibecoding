// Base actor: position on the terrain, collision-aware movement, nav-path following, model sync.
import { Character } from '../world/characters.js';
import { WEAPONS } from './weapons.js';
import { clamp, dampAngle, angleDiff } from '../engine/util.js';

let N = 0;
export class Actor {
  constructor(game, def) {
    this.game = game; this.def = def;
    this.id = def.id || `${def.kind}_${N++}`;
    this.kind = def.kind;
    this.name = def.name || null;
    this.role = def.role || null;
    this.x = def.pos[0]; this.z = def.pos[1];
    this.y = game.groundY(this.x, this.z);
    this.facing = def.facing ?? 0;
    this.vx = 0; this.vz = 0; this.speed = 0;
    this.radius = def.radius ?? 0.33;
    this.maxHp = def.hp ?? 100; this.hp = this.maxHp;
    this.state = 'ok';
    this.crouch = false; this.aim = false;
    this.weapon = WEAPONS[def.weapon || 'none'] || WEAPONS.none;
    this.ammo = this.weapon.mag; this.reserve = def.reserve ?? this.weapon.mag * 4;
    this.cycleT = 0; this.reloadT = 0;
    this.model = new Character(def.outfit || 'settler_m', { weapon: this.weapon.model || 'none', seed: def.seed ?? N });
    this.model.stepCb = (side) => this.onStep(side);
    game.scene.add(this.model.root);
    this.anim = {};
    this.path = null; this.pathGoal = null; this.pathT = 0; this.stuckT = 0;
    this.suppress = 0;
    this.lastHitT = -10;
    this.tags = new Set(def.tags || []);
    this.carrying = null; this.carriedBy = null;
    this.visibleToPlayer = false;
    this.syncModel(0);
  }
  get active() { return this.state === 'ok' || this.state === 'injured'; }
  get incapacitated() { return this.state === 'wounded' || this.state === 'down' || this.state === 'lost' || this.state === 'carried'; }
  get gone() { return this.state === 'gone'; }
  eyeY() { return this.y + (this.crouch ? 1.05 : 1.55) * this.model.scale; }
  chestY() { return this.y + (this.state === 'wounded' || this.state === 'down' ? 0.25 : (this.crouch ? 0.8 : 1.25)) * this.model.scale; }
  headY() { return this.y + (this.state === 'wounded' || this.state === 'down' ? 0.3 : (this.crouch ? 1.1 : 1.6)) * this.model.scale; }
  dist(o) { return Math.hypot(o.x - this.x, o.z - this.z); }
  distXZ(x, z) { return Math.hypot(x - this.x, z - this.z); }

  // steer with acceleration, slope penalty, collision and arena bounds
  move(dx, dz, speed, dt, face = true) {
    const m = Math.hypot(dx, dz);
    let tx = 0, tz = 0;
    if (m > 1e-4) {
      tx = dx / m * speed; tz = dz / m * speed;
      const sl = this.game.terrain.slopeAt(this.x + dx / m * 0.6, this.z + dz / m * 0.6);
      const uphill = (sl.gx * dx + sl.gz * dz) / m;
      if (uphill > 0.35) { const k = clamp(1 - (uphill - 0.35) * 0.9, 0.25, 1); tx *= k; tz *= k; }
    }
    const acc = m > 1e-4 ? 12 : 14;
    this.vx += (tx - this.vx) * Math.min(1, acc * dt); this.vz += (tz - this.vz) * Math.min(1, acc * dt);
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const T = this.game.terrain;
    nx = clamp(nx, -T.bounds, T.bounds); nz = clamp(nz, -T.bounds, T.bounds);
    if (T.waterLevel > -50 && !this.game.onBridge(nx, nz) && T.heightAt(nx, nz) < T.waterLevel - 0.45) { nx = this.x; nz = this.z; }
    [nx, nz] = this.game.world.resolve(nx, nz, this.radius, this.y + 0.2);
    // actor separation
    for (const o of this.game.actorsNear(nx, nz, 1.2)) {
      if (o === this || o.incapacitated || o.carriedBy || o.gone) continue;
      const ddx = nx - o.x, ddz = nz - o.z, d = Math.hypot(ddx, ddz), mm = this.radius + o.radius;
      if (d < mm && d > 1e-4) { const push = (mm - d) * 0.5; nx += ddx / d * push; nz += ddz / d * push; }
    }
    const moved = Math.hypot(nx - this.x, nz - this.z);
    this.speed = moved / Math.max(dt, 1e-4);
    this.x = nx; this.z = nz;
    this.y = this.game.groundY(nx, nz);
    if (face && m > 1e-4 && this.speed > 0.2) this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 10, dt);
    return moved;
  }
  faceTo(angle, dt, rate = 8) { this.facing = dampAngle(this.facing, angle, rate, dt); }
  faceToward(x, z, dt, rate = 8) { this.faceTo(Math.atan2(x - this.x, z - this.z), dt, rate); }

  // follow a nav path toward (gx, gz). returns true when within arrive distance
  goTo(gx, gz, speed, dt, arrive = 0.8, face = true) {
    const d = this.distXZ(gx, gz);
    if (d < arrive) { this.move(0, 0, 0, dt, false); this.path = null; return true; }
    this.pathT -= dt;
    if (!this.path || !this.pathGoal || Math.hypot(this.pathGoal[0] - gx, this.pathGoal[1] - gz) > 1.5 || this.pathT < 0) {
      this.path = this.game.nav.find(this.x, this.z, gx, gz) || [[gx, gz]];
      this.pathGoal = [gx, gz]; this.pathT = 2.5 + Math.random();
    }
    let [wx, wz] = this.path[0];
    if (Math.hypot(wx - this.x, wz - this.z) < 0.7 && this.path.length > 1) { this.path.shift(); [wx, wz] = this.path[0]; }
    const moved = this.move(wx - this.x, wz - this.z, speed, dt, face);
    if (moved < speed * dt * 0.15) { this.stuckT += dt; if (this.stuckT > 1.2) { this.path = null; this.stuckT = 0; this.vx += (Math.random() - 0.5) * 2; this.vz += (Math.random() - 0.5) * 2; } }
    else this.stuckT = 0;
    return false;
  }
  stop(dt) { this.move(0, 0, 0, dt, false); }

  onStep(side) {
    const g = this.game, surf = g.terrain.surfaceAt(this.x, this.z);
    g.effects.footprint(this.x, this.z, this.facing, side);
    const d = Math.hypot(g.player.x - this.x, g.player.z - this.z);
    if (this === g.player) g.audio.step(null, surf, true, this.crouch ? 0.5 : this.speed > 4 ? 1.3 : 0.9);
    else if (d < 22 && g.stepBudget-- > 0) g.audio.step({ x: this.x, y: this.y, z: this.z }, surf, false, this.crouch ? 0.4 : 0.8);
    if (this === g.player && this.speed > 4.2) g.noise(this.x, this.z, 9, 'step', this);
  }

  damage(amount, from) {
    if (!this.active) return;
    this.hp -= amount; this.lastHitT = this.game.time;
    this.anim.flinch = true;
    if (this.hp <= 0) { this.hp = 0; this.onIncapacitated(from); }
  }
  onIncapacitated() { this.state = 'down'; }

  syncModel(dt) {
    const m = this.model;
    if (this.carriedBy) return;
    m.root.position.set(this.x, this.y, this.z);
    m.root.rotation.y = this.facing;
    const a = this.anim;
    m.update(dt, {
      speed: this.speed, crouch: this.crouch && !this.incapacitated, aim: a.aim, carry: !!this.carrying, down: this.incapacitated && this.state !== 'carried',
      kneel: a.kneel, treat: a.treat, reload: a.reload, recoil: a.recoil, melee: a.melee, wave: a.wave, sit: a.sit, signal: a.signal, flinch: a.flinch,
    });
    a.recoil = false; a.flinch = false;
    m.headYaw = a.headYaw ?? 0;
  }
  remove() { this.model.dispose(); this.state = 'gone'; }
}

export { angleDiff };
