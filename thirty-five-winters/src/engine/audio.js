// Procedural Web Audio: every sound and every bar of music here is synthesised at runtime (original work).
// Layers: ambience beds, positional SFX with speed-of-sound delay, UI, and a generative score built on
// Korean pentatonic modes voiced by daegeum-, haegeum-, gayageum- and buk-like synth instruments.
import { clamp } from './util.js';

const SPEED_OF_SOUND = 343;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.6, sfx: 0.85, amb: 0.7, ui: 0.6 };
    this.listener = { x: 0, y: 0, z: 0 };
    this.ambNodes = [];
    this.music = null;
    this.ksCache = new Map();
    this.voices = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.connect(comp);
    const bus = (name) => { const g = ctx.createGain(); g.connect(this.master); return g; };
    this.bus = { music: bus(), sfx: bus(), amb: bus(), ui: bus() };
    // shared reverb (outdoor valley tail)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.8, 2.2);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.55;
    this.reverb.connect(this.revGain); this.revGain.connect(this.bus.sfx);
    this.musicRev = ctx.createConvolver(); this.musicRev.buffer = this._impulse(3.5, 2.6);
    const mrg = ctx.createGain(); mrg.gain.value = 0.35; this.musicRev.connect(mrg); mrg.connect(this.bus.music);
    this.noiseBuf = this._noise(2, 'white');
    this.pinkBuf = this._noise(4, 'pink');
    this.brownBuf = this._noise(4, 'brown');
    this.applyVolumes();
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setVolumes(v) { Object.assign(this.vol, v); this.applyVolumes(); }
  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.bus.music.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.bus.amb.gain.setTargetAtTime(this.vol.amb * 0.7, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(this.vol.ui * 0.6, t, 0.05);
  }
  duck(amount = 0.4, time = 1.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, g = this.bus.music.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.vol.music * 0.55 * amount, t + 0.05);
    g.linearRampToValueAtTime(this.vol.music * 0.55, t + time);
  }

  _noise(sec, type) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2; }
      else if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }
  _impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // early reflections from valley walls + diffuse tail
        const early = (i % Math.floor(ctx.sampleRate * (0.07 + c * 0.013)) < 30) ? 0.6 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + early * Math.pow(1 - t, 4) * (Math.random() - 0.5));
      }
    }
    return buf;
  }
  _src(buf, loop = false) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; }

  setListener(x, y, z, fx, fz) {
    this.listener = { x, y, z };
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(x, t, 0.02); L.positionY.setTargetAtTime(y, t, 0.02); L.positionZ.setTargetAtTime(z, t, 0.02);
      L.forwardX.setTargetAtTime(fx, t, 0.02); L.forwardY.setTargetAtTime(0, t, 0.02); L.forwardZ.setTargetAtTime(fz, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(x, y, z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
  }

  // Returns {input, delay} chain ending in panner -> sfx bus (+reverb send)
  _spatial(pos, { ref = 6, rolloff = 1.1, wet = 0.25, delay = true, maxDist = 600 } = {}) {
    const ctx = this.ctx;
    const dx = pos.x - this.listener.x, dy = (pos.y || 0) - this.listener.y, dz = pos.z - this.listener.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxDist) return null;
    const p = ctx.createPanner();
    p.panningModel = d < 40 ? 'HRTF' : 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = 10000;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y || 0; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y || 0, pos.z);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = clamp(18000 / (1 + d / 35), 380, 18000); // air absorption
    lp.connect(p); p.connect(this.bus.sfx);
    const send = ctx.createGain(); send.gain.value = wet * clamp(0.4 + d / 120, 0.4, 2.2);
    p.connect(send); send.connect(this.reverb);
    const when = ctx.currentTime + (delay ? d / SPEED_OF_SOUND : 0);
    return { input: lp, when, dist: d };
  }

  // ---------- SFX ----------
  shot(pos, { kind = 'rifle', own = false } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const sp = own ? { input: this._ownChain(), when: ctx.currentTime, dist: 0 } : this._spatial(pos, { ref: 10, rolloff: 0.9, wet: 0.5, maxDist: 2500 });
    if (!sp) return;
    const { input, when, dist } = sp;
    const heavy = kind === 'mg' ? 0.8 : kind === 'pistol' ? 0.55 : kind === 'carbine' ? 0.8 : 1;
    // crack
    const n = this._src(this.noiseBuf); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = dist > 150 ? 700 : 1700; bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1.3 * heavy, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, when + (dist > 150 ? 0.5 : 0.22));
    n.connect(bp); bp.connect(g); g.connect(input);
    n.start(when, Math.random() * 1.5, 0.6);
    // body thump
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110 * heavy, when); o.frequency.exponentialRampToValueAtTime(38, when + 0.18);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.9 * heavy, when); og.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
    o.connect(og); og.connect(input); o.start(when); o.stop(when + 0.3);
    // rolling echo for distant shots
    if (dist > 60) {
      const e = this._src(this.brownBuf); const eg = ctx.createGain();
      eg.gain.setValueAtTime(0, when + 0.05); eg.gain.linearRampToValueAtTime(0.25, when + 0.15);
      eg.gain.exponentialRampToValueAtTime(0.001, when + 1.6);
      e.connect(eg); eg.connect(input); e.start(when, Math.random() * 2, 1.8);
    }
  }
  _ownChain() {
    const ctx = this.ctx; const g = ctx.createGain(); g.gain.value = 0.85; g.connect(this.bus.sfx);
    const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(this.reverb); return g;
  }
  _click(input, when, freq = 2600, gain = 0.5, len = 0.03) {
    const ctx = this.ctx;
    const n = this._src(this.noiseBuf); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.001, when + len);
    n.connect(bp); bp.connect(g); g.connect(input); n.start(when, Math.random(), len + 0.02);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq * 1.3;
    const og = ctx.createGain(); og.gain.setValueAtTime(gain * 0.08, when); og.gain.exponentialRampToValueAtTime(0.0001, when + len * 0.8);
    o.connect(og); og.connect(input); o.start(when); o.stop(when + len);
  }
  bolt(pos, own = true) {
    if (!this.ctx) return;
    const sp = own ? { input: this._ownChain(), when: this.ctx.currentTime } : this._spatial(pos, { ref: 3, delay: false, maxDist: 60 });
    if (!sp) return;
    this._click(sp.input, sp.when + 0.05, 1800, 0.35); this._click(sp.input, sp.when + 0.17, 2400, 0.3);
    this._click(sp.input, sp.when + 0.33, 2100, 0.35); this._click(sp.input, sp.when + 0.45, 1600, 0.4);
  }
  reload(rounds = 5) {
    if (!this.ctx) return;
    const input = this._ownChain(), t = this.ctx.currentTime;
    this._click(input, t + 0.1, 1700, 0.3);
    for (let i = 0; i < rounds; i++) this._click(input, t + 0.5 + i * 0.16, 3000 + i * 80, 0.18, 0.02);
    this._click(input, t + 0.55 + rounds * 0.16, 1500, 0.4); this._click(input, t + 0.75 + rounds * 0.16, 2000, 0.35);
  }
  dry() { if (!this.ctx) return; this._click(this._ownChain(), this.ctx.currentTime, 2800, 0.4, 0.02); }
  step(pos, surface = 'dirt', own = false, weight = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const sp = own ? { input: (() => { const g = ctx.createGain(); g.gain.value = 0.35; g.connect(this.bus.sfx); return g; })(), when: ctx.currentTime }
      : this._spatial(pos, { ref: 2, rolloff: 1.6, wet: 0.05, delay: false, maxDist: 40 });
    if (!sp) return;
    const { input, when } = sp;
    const cfg = {
      snow: [900, 0.5, 0.16, 'lowpass'], dirt: [420, 1.0, 0.09, 'bandpass'], grass: [2600, 0.6, 0.12, 'highpass'],
      wood: [260, 3, 0.07, 'bandpass'], mud: [240, 1.2, 0.18, 'lowpass'], stone: [1600, 2, 0.05, 'bandpass'], leaves: [3200, 0.5, 0.16, 'bandpass'],
    }[surface] || [420, 1, 0.09, 'bandpass'];
    const n = this._src(this.noiseBuf); const f = ctx.createBiquadFilter(); f.type = cfg[3]; f.frequency.value = cfg[0] * (0.85 + Math.random() * 0.3); f.Q.value = cfg[1];
    const g = ctx.createGain(); const a = 0.55 * weight;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(a, when + 0.008); g.gain.exponentialRampToValueAtTime(0.001, when + cfg[2]);
    n.connect(f); f.connect(g); g.connect(input); n.start(when, Math.random() * 1.8, cfg[2] + 0.05);
    if (surface === 'snow') { // crunch grains
      for (let i = 0; i < 4; i++) this._click(input, when + 0.02 + i * 0.025, 3500 + Math.random() * 2000, 0.06 * weight, 0.012);
    }
  }
  impact(pos, surface = 'dirt') {
    if (!this.ctx) return;
    const sp = this._spatial(pos, { ref: 3, rolloff: 1.4, wet: 0.2, maxDist: 120 }); if (!sp) return;
    const ctx = this.ctx, { input, when } = sp;
    const n = this._src(this.noiseBuf); const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = surface === 'wood' ? 500 : surface === 'stone' ? 2400 : 900; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.7, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
    n.connect(f); f.connect(g); g.connect(input); n.start(when, Math.random(), 0.15);
    if (surface === 'stone' || surface === 'metal') { // ricochet whine
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2400, when); o.frequency.exponentialRampToValueAtTime(900, when + 0.35);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.08, when); og.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
      o.connect(og); og.connect(input); o.start(when); o.stop(when + 0.4);
    }
  }
  whiz() { // bullet passing near the listener
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this._src(this.noiseBuf); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    n.connect(f); f.connect(g); g.connect(pan); pan.connect(this.bus.sfx); n.start(t, Math.random(), 0.2);
  }
  thud(pos, gain = 0.6) {
    if (!this.ctx) return;
    const sp = pos ? this._spatial(pos, { ref: 3, delay: false, maxDist: 80 }) : { input: this._ownChain(), when: this.ctx.currentTime };
    if (!sp) return;
    const ctx = this.ctx, { input, when } = sp;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(45, when + 0.15);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
    o.connect(g); g.connect(input); o.start(when); o.stop(when + 0.25);
    const n = this._src(this.noiseBuf); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(gain * 0.6, when); ng.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
    n.connect(f); f.connect(ng); ng.connect(input); n.start(when, Math.random(), 0.12);
  }
  whistle(pos) {
    if (!this.ctx) return;
    const sp = pos ? this._spatial(pos, { ref: 8, rolloff: 0.7, wet: 0.5, maxDist: 900 }) : { input: this._ownChain(), when: this.ctx.currentTime };
    if (!sp) return;
    const ctx = this.ctx, { input, when } = sp;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2350;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = 140;
    lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.35, when + 0.03);
    g.gain.setValueAtTime(0.35, when + 0.5); g.gain.linearRampToValueAtTime(0, when + 0.6);
    g.gain.setValueAtTime(0, when + 0.7); g.gain.linearRampToValueAtTime(0.35, when + 0.73); g.gain.linearRampToValueAtTime(0, when + 1.4);
    o.connect(g); g.connect(input); o.start(when); lfo.start(when); o.stop(when + 1.5); lfo.stop(when + 1.5);
  }
  paper() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const n = this._src(this.noiseBuf); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500 + Math.random() * 2000;
      const g = ctx.createGain(); const s = t + i * 0.06 + Math.random() * 0.03;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.12, s + 0.01); g.gain.exponentialRampToValueAtTime(0.001, s + 0.08);
      n.connect(f); f.connect(g); g.connect(this.bus.ui); n.start(s, Math.random(), 0.1);
    }
  }
  cloth() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this._src(this.pinkBuf); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(1200, t); f.frequency.linearRampToValueAtTime(3000, t + 0.4); f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.05); g.gain.linearRampToValueAtTime(0.0, t + 0.45);
    n.connect(f); f.connect(g); g.connect(this.bus.sfx); n.start(t, Math.random(), 0.5);
  }
  hurt() {
    if (!this.ctx) return;
    this.thud(null, 0.8);
    this.duck(0.5, 0.6);
  }
  heartbeat(rate = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [0, 0.22].forEach((o, i) => {
      const osc = ctx.createOscillator(); osc.frequency.value = i ? 48 : 58;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + o); g.gain.linearRampToValueAtTime(0.5 * rate, t + o + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + o + 0.18);
      osc.connect(g); g.connect(this.bus.sfx); osc.start(t + o); osc.stop(t + o + 0.2);
    });
  }
  sting(kind) { // detection feedback
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (kind === 'suspicious') {
      [0, 0.12].forEach((o, i) => this._tone(this.bus.ui, [880, 1046][i], t + o, 0.25, 'triangle', 0.12));
    } else if (kind === 'alert') {
      this._drum(this.bus.ui, t, 'buk', 0.9); this._tone(this.bus.ui, 220, t, 0.6, 'sawtooth', 0.08, 900);
    } else if (kind === 'objective') {
      [523, 659, 784].forEach((f, i) => this._tone(this.bus.ui, f, t + i * 0.09, 0.5, 'triangle', 0.12));
    } else if (kind === 'fail') {
      [392, 330, 262].forEach((f, i) => this._tone(this.bus.ui, f, t + i * 0.18, 0.7, 'triangle', 0.12));
    } else if (kind === 'xp') {
      this._tone(this.bus.ui, 1318, t, 0.3, 'sine', 0.08); this._tone(this.bus.ui, 1760, t + 0.07, 0.4, 'sine', 0.06);
    }
  }
  ui(kind = 'click') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'hover') this._tone(this.bus.ui, 1200, t, 0.05, 'sine', 0.04);
    else if (kind === 'back') this._tone(this.bus.ui, 520, t, 0.1, 'triangle', 0.1);
    else if (kind === 'page') this.paper();
    else { this._tone(this.bus.ui, 760, t, 0.06, 'triangle', 0.12); this._tone(this.bus.ui, 1140, t + 0.03, 0.08, 'sine', 0.06); }
  }
  hitmark() { if (!this.ctx) return; this._tone(this.bus.ui, 1900, this.ctx.currentTime, 0.05, 'square', 0.04, 4000); }
  radioStatic(dur = 1.5) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this._src(this.noiseBuf); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15, t + 0.1); g.gain.setValueAtTime(0.15, t + dur - 0.2); g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(f); f.connect(g); g.connect(this.bus.sfx); n.start(t, 0, dur);
  }
  // Unintelligible voice-like murmur (loudspeaker broadcast, radio announcer, crowd)
  voice(pos, dur = 3, { pitch = 140, gain = 0.35, radio = false } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const sp = pos ? this._spatial(pos, { ref: 10, rolloff: 0.8, wet: 0.4, delay: true, maxDist: 400 }) : { input: this.bus.sfx, when: ctx.currentTime };
    if (!sp) return;
    const { input, when } = sp;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = pitch;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 7;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);
    let out = g;
    if (radio) { const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800; g.connect(hp); hp.connect(lp); out = lp; }
    out.connect(input);
    const F1 = [730, 530, 270, 570, 300, 660], F2 = [1090, 1840, 2290, 840, 870, 1720];
    let tt = when;
    while (tt < when + dur) {
      const v = Math.floor(Math.random() * 6), syl = 0.09 + Math.random() * 0.14;
      f1.frequency.setTargetAtTime(F1[v], tt, 0.02); f2.frequency.setTargetAtTime(F2[v], tt, 0.02);
      o.frequency.setTargetAtTime(pitch * (0.9 + Math.random() * 0.3), tt, 0.04);
      g.gain.setTargetAtTime(Math.random() < 0.12 ? 0 : gain, tt, 0.015);
      tt += syl;
      if (Math.random() < 0.15) { g.gain.setTargetAtTime(0, tt, 0.02); tt += 0.15 + Math.random() * 0.2; }
    }
    g.gain.setTargetAtTime(0, when + dur, 0.03);
    o.start(when); o.stop(when + dur + 0.3);
  }
  _tone(dest, freq, when, dur, type = 'sine', gain = 0.1, lp = 0) {
    const ctx = this.ctx; const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    if (lp) { const f = ctx.createBiquadFilter(); f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(dest); o.start(when); o.stop(when + dur + 0.05);
  }
  _drum(dest, when, kind, gain = 0.6) {
    const ctx = this.ctx;
    if (kind === 'buk' || kind === 'deong') {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(kind === 'buk' ? 95 : 140, when); o.frequency.exponentialRampToValueAtTime(kind === 'buk' ? 48 : 80, when + 0.3);
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
      o.connect(g); g.connect(dest); o.start(when); o.stop(when + 0.65);
    }
    if (kind === 'ttak' || kind === 'buk') {
      const n = this._src(this.noiseBuf); const f = ctx.createBiquadFilter(); f.type = kind === 'ttak' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'ttak' ? 2500 : 700;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain * (kind === 'ttak' ? 0.5 : 0.25), when); g.gain.exponentialRampToValueAtTime(0.001, when + (kind === 'ttak' ? 0.06 : 0.12));
      n.connect(f); f.connect(g); g.connect(dest); n.start(when, Math.random(), 0.15);
    }
  }

  // ---------- Ambience ----------
  setAmbience(spec = {}) {
    if (!this.ctx) { this.pendingAmb = spec; return; }
    this.stopAmbience();
    const ctx = this.ctx, out = this.bus.amb, nodes = this.ambNodes;
    const loopNoise = (buf, type, freq, q, gain) => {
      const s = this._src(buf, true); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(gain, ctx.currentTime, 1.5);
      s.connect(f); f.connect(g); g.connect(out); s.start(0, Math.random() * 3); nodes.push(s, g); return { s, f, g };
    };
    if (spec.wind) {
      const w = loopNoise(this.pinkBuf, 'lowpass', 500, 0.8, 0.25 * spec.wind);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 260;
      lfo.connect(lg); lg.connect(w.f.frequency); lfo.start(); nodes.push(lfo);
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = 0.1 * spec.wind;
      lfo2.connect(lg2); lg2.connect(w.g.gain); lfo2.start(); nodes.push(lfo2);
      const hi = loopNoise(this.noiseBuf, 'bandpass', 2200, 2, 0.02 * spec.wind); // whistle through branches
      const lfo3 = ctx.createOscillator(); lfo3.frequency.value = 0.05; const lg3 = ctx.createGain(); lg3.gain.value = 600;
      lfo3.connect(lg3); lg3.connect(hi.f.frequency); lfo3.start(); nodes.push(lfo3);
    }
    if (spec.rain) {
      loopNoise(this.noiseBuf, 'highpass', 1800, 0.5, 0.12 * spec.rain);
      loopNoise(this.pinkBuf, 'lowpass', 700, 0.5, 0.15 * spec.rain);
    }
    if (spec.river) loopNoise(this.brownBuf, 'bandpass', 500, 0.6, 0.35 * spec.river);
    if (spec.fire) loopNoise(this.brownBuf, 'lowpass', 200, 0.7, 0.12 * spec.fire);
    if (spec.city) loopNoise(this.pinkBuf, 'bandpass', 380, 0.9, 0.12 * spec.city);
    this.ambSpec = spec;
    this.ambTimer = 0;
  }
  stopAmbience() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const n of this.ambNodes) {
      if (n.gain) { n.gain.cancelScheduledValues(t); n.gain.setTargetAtTime(0, t, 0.4); }
      else if (n.stop) { try { n.stop(t + 2); } catch (_) { /* already stopped */ } }
    }
    this.ambNodes = [];
    this.ambSpec = null;
  }
  // random one-shot events for beds (birds, insects, crackles, distant war)
  updateAmbience(dt) {
    if (!this.ctx || !this.ambSpec) return;
    const s = this.ambSpec, ctx = this.ctx, t = ctx.currentTime;
    this.ambTimer -= dt;
    if (this.ambTimer > 0) return;
    this.ambTimer = 0.2 + Math.random() * 0.6;
    const L = this.listener;
    const around = (r) => ({ x: L.x + (Math.random() - 0.5) * r, y: L.y + 6, z: L.z + (Math.random() - 0.5) * r });
    if (s.birds && Math.random() < 0.25 * s.birds) this._bird(around(80));
    if (s.insects && Math.random() < 0.5 * s.insects) this._insect();
    if (s.fire && Math.random() < 0.7) for (let i = 0; i < 3; i++) this._click(this.bus.amb, t + Math.random() * 0.2, 1500 + Math.random() * 3000, 0.08 * s.fire, 0.01);
    if (s.frogs && Math.random() < 0.5 * s.frogs) this._frog();
    if (s.war && Math.random() < 0.06 * s.war) {
      const a = Math.random() * Math.PI * 2, d = 600 + Math.random() * 1500;
      const p = { x: L.x + Math.cos(a) * d, y: 0, z: L.z + Math.sin(a) * d };
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) setTimeout(() => this.shot(p), i * (200 + Math.random() * 500));
    }
    if (s.camp && Math.random() < 0.08 * s.camp) this.voice(around(30), 1 + Math.random() * 2, { pitch: 110 + Math.random() * 80, gain: 0.08 });
    if (s.city && Math.random() < 0.05 * s.city) this._click(this.bus.amb, t, 900, 0.15, 0.2); // cart wheel knock
  }
  _bird(pos) {
    const sp = this._spatial(pos, { ref: 10, rolloff: 1, wet: 0.3, delay: false, maxDist: 200 }); if (!sp) return;
    const ctx = this.ctx, { input, when } = sp;
    const base = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); const st = when + i * (0.09 + Math.random() * 0.05);
      o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.7), st + 0.07);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.07, st + 0.01); g.gain.exponentialRampToValueAtTime(0.001, st + 0.08);
      o.connect(g); g.connect(input); o.start(st); o.stop(st + 0.1);
    }
  }
  _insect() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.value = 4200 + Math.random() * 1500;
    const am = ctx.createOscillator(); am.frequency.value = 20 + Math.random() * 20; const ag = ctx.createGain(); ag.gain.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0; am.connect(ag); ag.connect(g.gain);
    const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.025, t + 0.1); env.gain.linearRampToValueAtTime(0, t + 0.6 + Math.random());
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1;
    o.connect(g); g.connect(env); env.connect(pan); pan.connect(this.bus.amb); o.start(t); am.start(t); o.stop(t + 1.8); am.stop(t + 1.8);
  }
  _frog() {
    const ctx = this.ctx, t = ctx.currentTime; const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1; pan.connect(this.bus.amb);
    const f = 300 + Math.random() * 300;
    for (let i = 0; i < 3; i++) this._tone(pan, f, t + i * 0.12, 0.08, 'square', 0.02, 900);
  }

  // ---------- Music ----------
  // Scales in semitones from the tonic. pyeongjo ≈ sol-la-do-re-mi, gyemyeonjo ≈ mi-sol-la-si-re (minor colour).
  playMusic(name) {
    if (!this.ctx) { this.pendingMusic = name; return; }
    if (this.music && this.music.name === name) return;
    const old = this.music;
    if (old) { old.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8); setTimeout(() => old.out.disconnect(), 4000); old.stopped = true; }
    if (!name || !TRACKS[name]) { this.music = null; return; }
    const out = this.ctx.createGain(); out.gain.value = 0; out.gain.setTargetAtTime(1, this.ctx.currentTime, 1.2);
    out.connect(this.bus.music); out.connect(this.musicRev);
    this.music = { name, track: TRACKS[name], out, beat: 0, next: this.ctx.currentTime + 0.1, intensity: 0 };
  }
  setIntensity(v) { if (this.music) this.music.intensity = v; }
  updateMusic() {
    const m = this.music; if (!m || !this.ctx || m.stopped) return;
    const ctx = this.ctx, tr = m.track, spb = 60 / tr.tempo;
    while (m.next < ctx.currentTime + 0.25) {
      const bar = Math.floor(m.beat / tr.barBeats) % tr.bars;
      const beatInBar = m.beat % tr.barBeats;
      for (const layer of tr.layers) {
        if (layer.minIntensity && m.intensity < layer.minIntensity) continue;
        const evs = layer.events(bar, beatInBar, m);
        for (const ev of evs) this._note(m.out, layer.inst, ev, m.next + (ev.off || 0) * spb, spb, tr.root);
      }
      m.beat += 1; m.next += spb;
    }
  }
  _note(out, inst, ev, when, spb, root) {
    const ctx = this.ctx;
    const freq = ev.f || root * Math.pow(2, ev.semi / 12);
    const dur = (ev.len || 1) * spb, g = ev.g ?? 1;
    if (inst === 'gayageum') {
      const s = this._src(this._ks(freq)); const gg = ctx.createGain(); gg.gain.value = 0.32 * g;
      s.playbackRate.setValueAtTime(1, when);
      if (ev.bend) { s.playbackRate.setValueAtTime(1, when + 0.15); s.playbackRate.linearRampToValueAtTime(Math.pow(2, ev.bend / 12), when + 0.35); }
      s.connect(gg); gg.connect(out); s.start(when);
    } else if (inst === 'daegeum') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2; const g2 = ctx.createGain(); g2.gain.value = 0.12;
      const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(freq * 0.012, when + Math.min(dur, 0.6));
      vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
      const env = ctx.createGain(); env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(0.16 * g, when + 0.09);
      env.gain.setValueAtTime(0.16 * g, when + dur * 0.7); env.gain.linearRampToValueAtTime(0, when + dur);
      o.connect(env); o2.connect(g2); g2.connect(env); env.connect(out);
      const br = this._src(this.noiseBuf); const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = freq * 2; bf.Q.value = 2;
      const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0, when); bg.gain.linearRampToValueAtTime(0.06 * g, when + 0.04); bg.gain.linearRampToValueAtTime(0.012 * g, when + 0.2); bg.gain.linearRampToValueAtTime(0, when + dur);
      br.connect(bf); bf.connect(bg); bg.connect(out);
      o.start(when); o2.start(when); vib.start(when); br.start(when, Math.random(), dur + 0.1);
      o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05); vib.stop(when + dur + 0.05);
    } else if (inst === 'haegeum') {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq * (ev.slide ? Math.pow(2, -ev.slide / 12) : 1), when); o.frequency.exponentialRampToValueAtTime(freq, when + 0.12);
      const vib = ctx.createOscillator(); vib.frequency.value = 6; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, when); vg.gain.linearRampToValueAtTime(freq * 0.018, when + dur * 0.6);
      vib.connect(vg); vg.connect(o.frequency);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.4;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
      const env = ctx.createGain(); env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(0.07 * g, when + 0.15);
      env.gain.setValueAtTime(0.07 * g, when + dur * 0.8); env.gain.linearRampToValueAtTime(0, when + dur);
      o.connect(bp); bp.connect(lp); lp.connect(env); env.connect(out);
      o.start(when); vib.start(when); o.stop(when + dur + 0.05); vib.stop(when + dur + 0.05);
    } else if (inst === 'pad') {
      const env = ctx.createGain(); env.gain.setValueAtTime(0, when); env.gain.linearRampToValueAtTime(0.045 * g, when + dur * 0.35); env.gain.linearRampToValueAtTime(0, when + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(env); env.connect(out);
      for (const det of [-6, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det; o.connect(lp); o.start(when); o.stop(when + dur + 0.05); }
    } else if (inst === 'buk' || inst === 'ttak' || inst === 'deong') {
      this._drum(out, when, inst, 0.5 * g);
    } else if (inst === 'bell') {
      [1, 2.76, 5.4].forEach((h, i) => this._tone(out, freq * h, when, 2.5 / (i + 1), 'sine', 0.05 * g / (i + 1)));
    }
  }
  _ks(freq) { // Karplus-Strong plucked string buffer (cached per pitch)
    const key = Math.round(freq);
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * 2.2);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq)); const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % N];
      const v = (a + b) * 0.4985; ring[idx] = v; d[i] = a * (i < 40 ? i / 40 : 1); idx = (idx + 1) % N;
    }
    this.ksCache.set(key, buf);
    return buf;
  }

  update(dt) { this.updateMusic(); this.updateAmbience(dt); }
}

// ---------- Original score ----------
// Melodies are written as scale-degree strings: "deg[^|_]:beats" (^ up an octave, _ down), "r:beats" rest.
const PYEONG = [0, 2, 5, 7, 9];          // sol la do re mi (as intervals from sol)
const GYEMYEON = [0, 3, 5, 7, 10];       // mi sol la si re (minor pentatonic colour)
function parseLine(str, scale) {
  const out = []; let beat = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [p, l] = tok.split(':'); const len = parseFloat(l || '1');
    if (p !== 'r') {
      const deg = parseInt(p, 10); const oct = (p.match(/\^/g) || []).length - (p.match(/_/g) || []).length;
      const semi = scale[((deg % 5) + 5) % 5] + 12 * (Math.floor(deg / 5) + oct);
      out.push({ beat, semi, len });
    }
    beat += len;
  }
  return { notes: out, length: beat };
}
function melodyLayer(str, scale, barBeats, { octave = 0, bendEvery = 0, slide = 0, gain = 1 } = {}) {
  const { notes, length } = parseLine(str, scale);
  return (bar, beatInBar) => {
    const pos = ((bar * barBeats + beatInBar) % length);
    const evs = [];
    for (const n of notes) if (n.beat >= pos && n.beat < pos + 1) {
      evs.push({ off: n.beat - pos, semi: n.semi + 12 * octave, len: n.len * 0.98, bend: bendEvery && n.len >= 2 ? -1 : 0, slide, g: gain });
    }
    return evs;
  };
}
function pattern(steps, fn) { // steps per beat pattern list
  return (bar, beat) => fn(bar, beat, steps);
}

const TRACKS = {
  title: {
    tempo: 56, barBeats: 4, bars: 8, root: 164.81, // E3, gyemyeonjo
    layers: [
      { inst: 'pad', events: (bar, b) => (b === 0 ? [{ semi: [0, -2, 3, 0, 0, -5, -2, 0][bar], len: 4 }, { semi: [7, 5, 10, 7, 7, 3, 5, 7][bar], len: 4 }] : []) },
      { inst: 'gayageum', events: (bar, b) => [{ semi: [0, 7, 12, 10][b] + (bar % 4 === 3 ? -2 : 0), len: 1, g: b === 0 ? 1 : 0.6, bend: b === 2 && bar % 2 ? -1 : 0 }] },
      { inst: 'daegeum', events: melodyLayer('r:4 2^:3 1^:1 0^:2 4:2 3:4 r:2 2:1 3:1 4:3 3:1 2:2 0:2 1:6 r:2 r:4', GYEMYEON, 4, { octave: 0 }) },
      { inst: 'buk', events: (bar, b) => (b === 0 && bar % 2 === 0 ? [{ semi: 0, g: 0.5 }] : []) },
    ],
  },
  hub: {
    tempo: 72, barBeats: 3, bars: 8, root: 196, // G3 pyeongjo, gutgeori-like triple feel
    layers: [
      { inst: 'gayageum', events: (bar, b) => [{ semi: [[0, 7, 12], [5, 9, 12], [2, 7, 14], [0, 9, 12]][bar % 4][b], g: b === 0 ? 0.9 : 0.5 }] },
      { inst: 'haegeum', events: melodyLayer('2:2 3:1 4:2 3:1 2:3 1:2 0:1 1:2 2:1 3:3 2:2 1:1 0:3 r:3', PYEONG, 3, { octave: 1, slide: 1 }) },
      { inst: 'deong', events: (bar, b) => (b === 0 ? [{ semi: 0, g: 0.4 }] : b === 2 ? [] : []) },
      { inst: 'ttak', events: (bar, b) => (b === 1 || b === 2 ? [{ semi: 0, g: 0.25 }] : []) },
    ],
  },
  explore: {
    tempo: 60, barBeats: 4, bars: 8, root: 146.83, // D3 gyemyeonjo, sparse
    layers: [
      { inst: 'pad', events: (bar, b) => (b === 0 && bar % 2 === 0 ? [{ semi: 0, len: 8, g: 0.8 }, { semi: 7, len: 8, g: 0.6 }] : []) },
      { inst: 'gayageum', events: (bar, b) => (b === 0 || (b === 2 && bar % 2) ? [{ semi: [0, 3, 7, 10, 7, 5, 3, 0][bar], g: 0.6, bend: bar % 3 === 0 ? -1 : 0 }] : []) },
      { inst: 'daegeum', minIntensity: 0, events: melodyLayer('r:8 4:3 3:1 2:4 r:4 1:2 2:2 0:4 r:4', GYEMYEON, 4, { octave: 1, gain: 0.7 }) },
      { inst: 'buk', minIntensity: 0.4, events: (bar, b) => (b === 0 || b === 2 ? [{ semi: 0, g: 0.4 + 0.3 * (b === 0) }] : []) },
      { inst: 'haegeum', minIntensity: 0.4, events: (bar, b) => (b === 0 && bar % 2 === 1 ? [{ semi: 12 + [0, 3, 5, 3][Math.floor(bar / 2) % 4], len: 3.5, slide: 2, g: 0.8 }] : []) },
    ],
  },
  combat: {
    tempo: 104, barBeats: 4, bars: 4, root: 146.83,
    layers: [
      { inst: 'buk', events: (bar, b) => [{ semi: 0, g: b === 0 ? 1 : 0.55 }, ...(b === 3 ? [{ semi: 0, off: 0.5, g: 0.5 }] : [])] },
      { inst: 'ttak', events: (bar, b) => [{ semi: 0, off: 0.5, g: 0.35 }] },
      { inst: 'haegeum', events: (bar, b) => (b === 0 ? [{ semi: [12, 15, 10, 12][bar], len: 3.6, slide: 3 }] : []) },
      { inst: 'gayageum', events: (bar, b) => [{ semi: [0, 7, 3, 7][b] + [0, 0, -2, 0][bar], g: 0.6 }, { semi: [0, 7, 3, 7][b] + 12, off: 0.5, g: 0.35 }] },
      { inst: 'pad', events: (bar, b) => (b === 0 ? [{ semi: [0, 3, -2, 0][bar], len: 4, g: 0.7 }] : []) },
    ],
  },
  sorrow: {
    tempo: 48, barBeats: 4, bars: 8, root: 164.81,
    layers: [
      { inst: 'pad', events: (bar, b) => (b === 0 ? [{ semi: [0, 3, -4, -2, 0, 3, 5, 0][bar], len: 4, g: 0.8 }] : []) },
      { inst: 'daegeum', events: melodyLayer('4:3 3:1 2:4 1:2 2:1 1:1 0:4 r:2 2:2 3:3 4:1 3:2 2:2 0:6 r:2', GYEMYEON, 4, { octave: 1, gain: 0.85 }) },
      { inst: 'gayageum', events: (bar, b) => (b === 0 ? [{ semi: [0, 3, -4, -2, 0, 3, 5, 0][bar] - 12, g: 0.6, bend: -1 }] : []) },
    ],
  },
  map: {
    tempo: 66, barBeats: 4, bars: 4, root: 196,
    layers: [
      { inst: 'gayageum', events: (bar, b) => [{ semi: [0, 7, 9, 7][b] + [0, 2, 5, 0][bar], g: 0.55 }] },
      { inst: 'pad', events: (bar, b) => (b === 0 ? [{ semi: [0, 2, 5, 0][bar], len: 4, g: 0.6 }] : []) },
      { inst: 'buk', events: (bar, b) => (b === 0 ? [{ semi: 0, g: 0.35 }] : []) },
    ],
  },
  liberation: {
    tempo: 70, barBeats: 4, bars: 8, root: 196, // pyeongjo, warm and open
    layers: [
      { inst: 'pad', events: (bar, b) => (b === 0 ? [{ semi: [0, 5, 2, 7, 0, 5, 9, 0][bar], len: 4, g: 0.8 }, { semi: [7, 9, 7, 14, 7, 12, 14, 12][bar], len: 4, g: 0.5 }] : []) },
      { inst: 'gayageum', events: (bar, b) => [{ semi: [0, 7, 12, 14][b] + [0, 5, 2, 7, 0, 5, 9, 0][bar], g: b === 0 ? 0.8 : 0.45 }] },
      { inst: 'daegeum', events: melodyLayer('2:2 3:2 4:3 3:1 2:2 4:2 1^:4 0^:2 4:2 3:3 2:1 1:2 2:2 0:8', PYEONG, 4, { octave: 1 }) },
      { inst: 'bell', events: (bar, b) => (b === 0 && bar % 4 === 0 ? [{ semi: 24, g: 0.6 }] : []) },
      { inst: 'buk', events: (bar, b) => (b === 0 ? [{ semi: 0, g: 0.5 }] : b === 2 ? [{ semi: 0, g: 0.25 }] : []) },
    ],
  },
};
