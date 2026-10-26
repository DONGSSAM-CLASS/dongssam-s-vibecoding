// Persistent journey state: where the story is, the organisation's supplies, each viewpoint
// character's skills, companions' fates, equipment, and autosave/checkpoints (localStorage).
const KEY = 'tfw_save_v1';
export const SKILLS = ['marksmanship', 'terrain', 'firstAid', 'endurance', 'teamwork'];
const THRESH = [0, 60, 150, 280, 450];
const SPLIT = {
  combat: { marksmanship: 1 }, rescue: { firstAid: 0.7, endurance: 0.3 }, intel: { terrain: 1 },
  supply: { endurance: 0.6, teamwork: 0.4 }, teamwork: { teamwork: 1 },
  training_marksmanship: { marksmanship: 1 }, training_terrain: { terrain: 1 }, training_firstAid: { firstAid: 1 },
  training_endurance: { endurance: 1 }, training_teamwork: { teamwork: 1 },
};

export function freshState() {
  return {
    version: 1, step: 0, reached: 0, finished: false,
    org: { food: 8, ammo: 50, medicine: 4, cloth: 3, parts: 2, funds: 5, trust: 50, network: 60 },
    skills: {}, inherited: {}, companions: {}, equip: {}, condition: {},
    hub: {}, completed: {}, choices: {}, codexSeen: [], log: [], checkpoint: null, totalXP: 0,
    created: Date.now(),
  };
}

export class Progress {
  constructor() { this.s = this.load() || freshState(); }
  load() { try { const raw = localStorage.getItem(KEY); if (!raw) return null; const s = JSON.parse(raw); return s.version === 1 ? s : null; } catch (_) { return null; } }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); this.savedAt = Date.now(); } catch (_) { /* storage unavailable: play continues without saves */ } }
  get hasSave() { return !!this.load(); }
  reset() { this.s = freshState(); this.save(); }

  // ---- skills
  ensure(pid, base = {}) {
    if (this.s.skills[pid]) return this.s.skills[pid];
    const sk = Object.fromEntries(SKILLS.map((k) => [k, base[k] || 0]));
    // inherited lessons: a share of everything earlier viewpoint characters learned
    const inh = Math.round(this.s.totalXP * 0.2);
    if (inh > 0) { for (const k of SKILLS) sk[k] += Math.round(inh / SKILLS.length); this.s.inherited[pid] = inh; }
    this.s.skills[pid] = sk;
    return sk;
  }
  skillsFor(pid) { return this.ensure(pid); }
  skillLevel(pid, k) { const xp = this.ensure(pid)[k] || 0; let l = 1; for (let i = 1; i < THRESH.length; i++) if (xp >= THRESH[i]) l = i + 1; return l; }
  levelProgress(pid, k) {
    const xp = this.ensure(pid)[k] || 0, l = this.skillLevel(pid, k);
    if (l >= 5) return { l, k: 1, xp };
    const a = THRESH[l - 1], b = THRESH[l];
    return { l, k: (xp - a) / (b - a), xp, next: b };
  }
  addXP(pid, cat, amount) {
    const sk = this.ensure(pid), split = SPLIT[cat] || { teamwork: 1 };
    let levelUp = null;
    for (const [k, w] of Object.entries(split)) {
      const before = this.skillLevel(pid, k);
      sk[k] += amount * w;
      const after = this.skillLevel(pid, k);
      if (after > before) levelUp = { skill: k, level: after };
    }
    this.s.totalXP += amount;
    return { levelUp };
  }
  // ---- companions
  companion(id) { return this.s.companions[id]; }
  isLost(id) { return this.s.companions[id]?.state === 'lost'; }
  markLost(id, mission) { this.s.companions[id] = { ...(this.s.companions[id] || {}), state: 'lost', lostIn: mission }; this.s.log.push({ t: 'lost', id, mission }); }
  setCompanion(id, patch) { this.s.companions[id] = { ...(this.s.companions[id] || { state: 'ok' }), ...patch }; }
  // ---- organisation
  get org() { return this.s.org; }
  addOrg(delta) { for (const [k, v] of Object.entries(delta || {})) this.s.org[k] = Math.max(0, Math.min(k === 'trust' || k === 'network' ? 100 : 999, (this.s.org[k] || 0) + v)); }
  networkIntel() { return this.s.org.network >= 50; }
  // ---- checkpoints
  setCheckpoint(missionId, index) { this.s.checkpoint = { missionId, index }; this.save(); }
  clearCheckpoint() { this.s.checkpoint = null; }
}
