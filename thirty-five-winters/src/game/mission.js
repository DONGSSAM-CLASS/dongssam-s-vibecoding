// Mission runtime: a readable objective chain with checkpoints, optional goals, scripted triggers,
// ambush signalling and extraction. Mission files describe *what*; this file decides *when*.
import { L } from '../engine/i18n.js';
import { polylineLength } from '../engine/util.js';

export class MissionRuntime {
  constructor(game, def, { checkpoint = 0 } = {}) {
    this.g = game; this.def = def;
    this.objectives = def.objectives;
    this.index = 0; this.state = {};
    this.done = false; this.failed = false;
    this.checkpointIndex = checkpoint;
    this.triggers = (def.triggers || []).map((t) => ({ ...t, fired: false }));
    this.optional = (def.optional || []).map((o) => ({ ...o, complete: false, failed: false }));
    this.holdFireUntilSignal = !!def.holdFireUntilSignal;
    this.timerT = 0;
    this.elapsed = 0;
    // forward game events to optional hooks in the mission file
    for (const h of ['onImpact', 'onPlayerShot', 'onCommand', 'onObserved', 'onEnemyDown', 'onAllyWounded', 'onAllyTreated', 'onAllyLost', 'onGroupRouted', 'onEnemyAlert', 'onAlert', 'onDrop', 'onPlayerDowned', 'onEnemyRouted']) {
      if (def[h]) this[h] = (...a) => def[h](this.g, this, ...a);
    }
  }
  get current() { return this.objectives[this.index]; }
  start() {
    const g = this.g;
    // fast-forward to the checkpoint: run completed objectives' world effects without their narration
    if (this.checkpointIndex > 0) {
      for (let i = 0; i < this.checkpointIndex; i++) { const o = this.objectives[i]; o.onSkip?.(g, this); o.onComplete?.(g, this, true); }
      this.index = this.checkpointIndex;
      const cp = this.objectives[this.index];
      if (cp.checkpointPos) {
        const [x, z] = cp.checkpointPos; g.player.x = x; g.player.z = z; g.player.y = g.groundY(x, z);
        g.player.facing = cp.checkpointFacing ?? g.player.facing;
        g.squad.forEach((a, i) => { a.x = x - 1.5 - i; a.z = z - 1.5; a.y = g.groundY(a.x, a.z); });
      }
      g.hud.toast('checkpointLoaded');
    } else if (this.def.intro) g.narrate(this.def.intro);
    this.beginObjective();
  }
  beginObjective() {
    const o = this.current; if (!o) return;
    this.state = { t: 0, count: 0 };
    if (o.timer) this.timerT = o.timer;
    o.onStart?.(this.g, this);
    if (o.lines) this.g.narrate(o.lines);
    this.g.hud.objective(o, this.index);
    if (o.checkpoint && this.index > 0 && !this.skippingSave) {
      this.checkpointIndex = this.index;
      this.g.app.saveCheckpoint(this.def.id, this.index);
      this.g.hud.toast('checkpoint');
    }
  }
  flag(f) { this.g.flags.add(f); }
  has(f) { return this.g.flags.has(f); }
  count(prefix) { let n = 0; for (const f of this.g.flags) if (f.startsWith(prefix)) n++; return n; }
  rallyPoint() { const o = this.current; return o?.rally || this.def.rally || this.def.extraction?.slice(0, 2) || [this.def.start.pos[0], this.def.start.pos[1]]; }

  // progress string + done check for each objective type
  evaluate(o, dt) {
    const g = this.g, p = g.player, st = this.state;
    st.t += dt;
    switch (o.type) {
      case 'reach': {
        const [x, z, r] = o.zone;
        const inside = Math.hypot(p.x - x, p.z - z) < r;
        if (o.withSquad) {
          const need = g.squad.filter((a) => a.state !== 'lost');
          const near = need.filter((a) => Math.hypot(a.x - x, a.z - z) < r + 6 || a.carriedBy === p).length;
          st.progress = `${near}/${need.length}`;
          return inside && near === need.length;
        }
        if (o.carrying && !p.carryItem && !p.carrying) return false;
        return inside;
      }
      case 'flag': return this.has(o.flag);
      case 'flags': { const n = o.flags.filter((f) => this.has(f)).length; st.progress = `${n}/${o.need ?? o.flags.length}`; return n >= (o.need ?? o.flags.length); }
      case 'count': { const n = this.count(o.prefix); st.progress = `${Math.min(n, o.need)}/${o.need}`; return n >= o.need; }
      case 'observe': {
        const pool = o.ids ? g.enemies.filter((e) => o.ids.includes(e.id)) : o.group ? g.enemies.filter((e) => e.group === o.group) : g.enemies;
        const n = pool.filter((e) => (o.routes ? e.routeKnown : e.observed)).length;
        const need = o.need ?? pool.length;
        st.progress = `${Math.min(n, need)}/${need}`; return n >= need;
      }
      case 'escort': {
        const civs = g.civilians.filter((c) => (o.group ? c.def.group === o.group : c.def.escort));
        const [x, z, r] = o.zone;
        let safe = 0;
        for (const c of civs) {
          if (c.mode === 'safe') { safe++; continue; }
          const carried = c.carriedBy === p;
          if (Math.hypot(c.x - x, c.z - z) < r && !carried && c.active) { c.mode = 'safe'; c.leader = null; c.dest = [x + (Math.random() - 0.5) * r, z + (Math.random() - 0.5) * r]; c.mode = 'safe'; g.stats.civiliansSafe++; g.award('rescue', 8, 'xpCivilian'); safe++; g.refreshLists(); }
          if (c.state === 'wounded' && !carried && Math.hypot(c.x - x, c.z - z) < r) { c.mode = 'safe'; safe++; g.stats.civiliansSafe++; }
        }
        st.progress = `${safe}/${civs.length}`;
        return safe >= (o.need ?? civs.length);
      }
      case 'carry': {
        const a = g.actors.find((x) => x.id === o.actor); if (!a) return true;
        const [x, z, r] = o.zone;
        return Math.hypot(a.x - x, a.z - z) < r && !a.carriedBy;
      }
      case 'treat': { const n = g.stats.treated - (st.base ?? (st.base = g.stats.treated)); st.progress = `${Math.min(n, o.need)}/${o.need}`; return n >= o.need; }
      case 'hold': case 'wait': {
        this.timerT -= dt * (o.zone && Math.hypot(p.x - o.zone[0], p.z - o.zone[1]) > o.zone[2] ? 0 : 1);
        st.progress = `${Math.ceil(Math.max(0, this.timerT))}s`;
        return this.timerT <= 0;
      }
      case 'ambush': return this.evalAmbush(o, dt);
      case 'rout': {
        const done = o.groups.every((id) => g.groupDone(id));
        const left = g.enemies.filter((e) => o.groups.includes(e.group) && e.active && e.mode !== 'retreat').length;
        st.progress = left ? `${left}` : '';
        return done;
      }
      case 'extract': {
        const [x, z, r] = o.zone || this.def.extraction;
        const inside = Math.hypot(p.x - x, p.z - z) < r;
        const need = g.squad.filter((a) => a.state !== 'lost');
        const near = need.filter((a) => (Math.hypot(a.x - x, a.z - z) < r + 5 && a.state !== 'wounded') || a.carriedBy === p || (a.state === 'wounded' && Math.hypot(a.x - x, a.z - z) < r + 5)).length;
        st.progress = need.length ? `${near}/${need.length}` : '';
        if (inside && near < need.length && !st.warned) { st.warned = true; g.hud.toast('squadMissing', 'warn'); }
        const waitingWounded = need.some((a) => a.state === 'wounded' && !a.carriedBy && Math.hypot(a.x - x, a.z - z) >= r + 5);
        if (inside && (near === need.length || (o.allowLeave && st.t > 1))) return true;
        st.blocked = waitingWounded;
        return false;
      }
      case 'custom': return o.check(g, this, dt);
      default: return false;
    }
  }
  evalAmbush(o, dt) {
    const g = this.g, st = this.state;
    const col = g.enemies.filter((e) => o.groups.includes(e.group));
    // the head of the column: the active marcher furthest along the road
    let lead = null; for (const e of col) if (e.active && e.column && (!lead || e.column.s > lead.column.s)) lead = e;
    if (!this.signalled) {
      // the column's progress into the kill zone
      const s = lead?.column ? lead.column.s : 0;
      st.len = lead?.column ? polylineLength(lead.column.path) : 1;
      st.ready = lead?.column ? s >= o.signalAt : false;
      if (st.ready && o.autoSignal) { this.doSignal(false); return false; }
      st.progress = st.ready ? L('signalNow') : '';
      if (st.ready && !st.readyPinged && !o.autoSignal) { st.readyPinged = true; g.hud.toast('signalNow', 'objective'); g.audio.sting('objective'); }
      // premature contact: the column itself deploys before the trap closes
      const watch = o.watchGroups || o.groups;
      if (g.enemies.some((e) => e.active && watch.includes(e.group) && e.mode === 'combat') && !this.signalled) { this.doSignal(true); }
      if (lead?.column && s > o.signalLate) { this.doSignal(true, true); }
      return false;
    }
    const done = o.groups.every((id) => g.groupDone(id));
    const left = col.filter((e) => e.active && e.mode !== 'retreat').length;
    st.progress = `${left}`;
    return done;
  }
  // can the player give a signal now? (ambushes the player commands, or objectives whose onSignal is the player's trigger)
  signalPending() { const o = this.current; if (!o || this.done) return false; return o.type === 'ambush' ? !o.autoSignal && !this.signalled : !!o.onSignal; }
  trySignal() {
    const o = this.current;
    if (o?.type === 'ambush') {
      if (this.signalled || o.autoSignal) return;
      if (!this.state.ready) { this.g.hud.toast('tooEarly', 'warn'); this.state.earlyTries = (this.state.earlyTries || 0) + 1; if (this.state.earlyTries < 2) return; }
      this.doSignal(false);
    } else if (o?.onSignal) o.onSignal(this.g, this);
  }
  doSignal(premature, late) {
    const g = this.g, o = this.current;
    this.signalled = true; g.signalGiven = true; g.weaponsFree = true;
    this.ambushBonus = !premature;
    g.audio.whistle(premature ? null : null);
    g.player.anim.signal = true; setTimeout(() => (g.player.anim.signal = false), 900);
    for (const e of g.enemies) {
      if (!o.groups.includes(e.group) || !e.active) continue;
      if (e.column) e.column.halt = true;
      e.ambushed = !premature;
      if (!premature) e.suppress = 0.7;
      e.enterCombat(g.player, true);
    }
    for (const a of g.allies) a.holdFire = false;
    if (premature) { g.hud.toast(late ? 'ambushLate' : 'ambushSprung', 'warn'); this.premature = true; }
    else { g.award('teamwork', 10, 'xpSignal'); for (const id of o.groups) { const gg = g.groups[id]; if (gg) gg.morale -= 10; } }
    o.onSignal?.(g, this, premature);
    g.subtitleSfx('sfxVolley');
  }

  update(dt) {
    if (this.done) return;
    const g = this.g;
    this.elapsed += dt;
    for (const t of this.triggers) {
      if (t.fired && t.once !== false) continue;
      if (t.when(g, this)) { t.fired = true; t.do(g, this); }
    }
    for (const op of this.optional) {
      if (op.complete || op.failed) continue;
      if (op.fail && op.fail(g, this)) { op.failed = true; g.hud.toast({ en: `Optional failed: ${L(op.text)}`, ko: `선택 목표 실패: ${L(op.text)}` }, 'warn'); continue; }
      if (op.check(g, this)) { op.complete = true; g.audio.sting('objective'); g.hud.toast({ en: `Optional complete: ${L(op.text)}`, ko: `선택 목표 완료: ${L(op.text)}` }, 'objective'); if (op.xp) g.award(op.xp[0], op.xp[1]); op.onComplete?.(g, this); }
    }
    this.def.tick?.(g, this, dt);
    if (this.def.failIf) { const r = this.def.failIf(g, this); if (r) { this.fail(r); return; } }
    const o = this.current; if (!o) return;
    if (this.evaluate(o, dt)) {
      o.onComplete?.(g, this, false);
      if (o.xp) g.award(o.xp[0], o.xp[1], o.xpReason);
      g.audio.sting('objective');
      this.index++;
      if (this.index >= this.objectives.length) { this.complete(); return; }
      this.beginObjective();
    } else g.hud.objectiveProgress(this.state);
  }
  complete() {
    if (this.done) return;
    this.done = true;
    const g = this.g;
    g.input.enabled = false;
    setTimeout(() => g.app.missionComplete(this.summary(true)), 1200);
    g.hud.toast('missionComplete', 'objective');
  }
  fail(reason) {
    if (this.done) return;
    this.done = true; this.failed = true; this.failReason = reason;
    const g = this.g;
    g.input.enabled = false;
    g.audio.sting('fail');
    setTimeout(() => g.app.missionFailed(reason, this.checkpointIndex), 900);
  }
  summary(success) {
    const g = this.g;
    return {
      id: this.def.id, success, time: this.elapsed, stats: { ...g.stats },
      squad: g.squad.map((a) => ({ id: a.id, name: a.name, role: a.role, state: a.state === 'lost' ? 'lost' : a.state === 'wounded' ? 'wounded' : a.state === 'injured' ? 'injured' : 'ok', ammo: a.reserve + a.ammo })),
      optional: this.optional.map((o) => ({ text: o.text, complete: o.complete })),
      xp: { ...(g.missionXP || {}) },
      ammoLeft: g.player.reserve + g.player.ammo, bandagesLeft: g.player.bandages,
      signal: this.signalled ? (this.premature ? 'premature' : 'clean') : null,
      rewards: this.def.rewards,
    };
  }
}
