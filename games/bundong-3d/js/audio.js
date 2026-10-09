// 모든 소리는 Web Audio로 직접 합성(외부 음원 없음)
// 바람·비·천둥·새·풀벌레·연못 물소리·바닥별 발소리·악령·유물 스킬·국악풍 효과음
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.volume = 0.8;
    this.state = { wind: 0.4, rain: 0, indoor: 0, day: 1, night: 0, storm: 0, boss: 0 };
    this.listener = { x: 0, y: 0, z: 0, fx: 0, fz: -1 };
    this.nextBird = 2;
    this.nextCricket = 0;
    this.drumTime = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    // 실내 먹먹함
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.amb = ctx.createGain();
    this.amb.connect(this.muffle);
    this.muffle.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    // 공간감(간단한 잔향)
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(1.6, 2.5);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.18;
    this.sfx.connect(this.verb);
    this.verb.connect(this.verbGain);
    this.verbGain.connect(this.master);
    this.master.connect(ctx.destination);

    this.noiseBuf = this.makeNoise(4, 'white');
    this.brownBuf = this.makeNoise(4, 'brown');
    this.pinkBuf = this.makeNoise(4, 'pink');

    // 바람
    this.windSrc = this.loop(this.brownBuf);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.amb);
    // 나뭇잎 사각거림(높은 대역)
    this.leafSrc = this.loop(this.pinkBuf);
    this.leafFilter = ctx.createBiquadFilter();
    this.leafFilter.type = 'highpass';
    this.leafFilter.frequency.value = 3500;
    this.leafGain = ctx.createGain();
    this.leafGain.gain.value = 0;
    this.leafSrc.connect(this.leafFilter).connect(this.leafGain).connect(this.amb);
    // 비
    this.rainSrc = this.loop(this.noiseBuf);
    this.rainFilter = ctx.createBiquadFilter();
    this.rainFilter.type = 'lowpass';
    this.rainFilter.frequency.value = 5000;
    const rainHP = ctx.createBiquadFilter();
    rainHP.type = 'highpass'; rainHP.frequency.value = 500;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    this.rainSrc.connect(rainHP).connect(this.rainFilter).connect(this.rainGain).connect(this.amb);
    // 연못 물소리(위치 소리)
    this.pond = this.makePanner(84, 0.2, -2, 4, 30);
    const ps = this.loop(this.pinkBuf);
    const pf = ctx.createBiquadFilter();
    pf.type = 'bandpass'; pf.frequency.value = 1100; pf.Q.value = 1.5;
    const pg = ctx.createGain(); pg.gain.value = 0.18;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 3.3;
    const lfoG = ctx.createGain(); lfoG.gain.value = 400;
    lfo.connect(lfoG).connect(pf.frequency); lfo.start();
    ps.connect(pf).connect(pg).connect(this.pond.panner);
    this.pond.out.connect(this.amb);
    // 밤의 낮은 긴장음
    this.drone = ctx.createOscillator();
    this.drone.type = 'sawtooth';
    this.drone.frequency.value = 55;
    const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 180;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0;
    this.drone.connect(df).connect(this.droneGain).connect(this.amb);
    this.drone.start();
    const d2 = ctx.createOscillator(); d2.type = 'sine'; d2.frequency.value = 82.4;
    d2.connect(this.droneGain); d2.start();
    this.ready = true;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  makeNoise(sec, type) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (type === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
      else d[i] = w;
    }
    return buf;
  }

  impulse(sec, decay) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  loop(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * 3);
    return s;
  }

  makePanner(x, y, z, ref = 3, max = 60) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.maxDistance = max;
    p.rolloffFactor = 1.2;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    return { panner: p, out: p };
  }

  setListener(pos, fwd) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02); l.positionY.setTargetAtTime(pos.y, t, 0.02); l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02); l.forwardY.setTargetAtTime(fwd.y, t, 0.02); l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
    this.listener = { x: pos.x, y: pos.y, z: pos.z };
  }

  // 환경음 갱신
  update(dt, s) {
    if (!this.ready) return;
    Object.assign(this.state, s);
    const t = this.ctx.currentTime;
    const S = this.state;
    const gust = 0.7 + 0.3 * Math.sin(t * 0.31) * Math.sin(t * 0.13 + 1);
    this.windGain.gain.setTargetAtTime((0.05 + S.wind * 0.35) * gust * (1 - S.indoor * 0.75), t, 0.3);
    this.windFilter.frequency.setTargetAtTime(250 + S.wind * 500 * gust, t, 0.4);
    this.leafGain.gain.setTargetAtTime(S.wind * 0.04 * gust * (1 - S.indoor), t, 0.3);
    this.rainGain.gain.setTargetAtTime(S.rain * 0.32 * (1 - S.indoor * 0.6), t, 0.5);
    this.muffle.frequency.setTargetAtTime(S.indoor ? 1600 : 18000, t, 0.25);
    this.droneGain.gain.setTargetAtTime(S.night * 0.035 + S.boss * 0.06, t, 1.0);

    // 새소리(낮), 풀벌레(밤)
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.nextBird = 2 + Math.random() * 6;
      if (S.day > 0.5 && S.rain < 0.2 && !S.indoor) this.bird();
    }
    this.nextCricket -= dt;
    if (this.nextCricket <= 0) {
      this.nextCricket = 0.35 + Math.random() * 0.5;
      if (S.night > 0.5 && S.rain < 0.3 && !S.indoor) this.cricket();
    }
    // 보스전 북 장단
    if (S.boss > 0.5) {
      this.drumTime -= dt;
      if (this.drumTime <= 0) {
        this.drumTime = 0.5;
        this._beat = ((this._beat || 0) + 1) % 8;
        const pat = [1, 0, 0.5, 0, 1, 0.5, 0, 0.7];
        if (pat[this._beat]) this.buk(pat[this._beat]);
      }
    }
  }

  env(g, t, a, peak, d, sustain = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
  }

  noiseHit({ freq = 1000, q = 1, type = 'bandpass', gain = 0.3, dur = 0.12, attack = 0.002, buf = null, dest = null, rate = 1, start = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + start;
    const s = ctx.createBufferSource();
    s.buffer = buf || this.noiseBuf;
    s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, attack, gain, dur);
    s.connect(f).connect(g).connect(dest || this.sfx);
    s.start(t, Math.random() * 2);
    s.stop(t + attack + dur + 0.05);
    return f;
  }

  tone({ freq = 440, type = 'sine', gain = 0.2, dur = 0.3, attack = 0.005, slide = 0, dest = null, start = 0, detune = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain();
    this.env(g, t, attack, gain, dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t); o.stop(t + attack + dur + 0.05);
    return o;
  }

  // 가야금처럼 튕기는 소리(카플러스-스트롱)
  pluck(freq, gain = 0.25, start = 0) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * 1.4);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const p = Math.floor(sr / freq);
    const ring = new Float32Array(p);
    for (let i = 0; i < p; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const nx = (idx + 1) % p;
      const v = (ring[idx] + ring[nx]) * 0.498;
      d[i] = ring[idx];
      ring[idx] = v;
      idx = nx;
    }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    s.connect(g).connect(this.sfx);
    s.start(ctx.currentTime + start);
  }

  bird() {
    const base = 2600 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    const mag = Math.random() < 0.35; // 까치 소리
    for (let i = 0; i < n; i++) {
      if (mag) this.noiseHit({ freq: 1800, q: 4, gain: 0.05, dur: 0.09, start: i * 0.16, dest: this.amb });
      else this.tone({ freq: base * (1 + Math.random() * 0.1), slide: 1.3 + Math.random() * 0.4, type: 'sine', gain: 0.025, dur: 0.07, start: i * 0.11, dest: this.amb });
    }
  }

  cricket() {
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this.tone({ freq: f, type: 'triangle', gain: 0.012, dur: 0.03, start: i * 0.05, dest: this.amb });
  }

  buk(k = 1) {
    this.tone({ freq: 90, slide: 0.5, type: 'sine', gain: 0.5 * k, dur: 0.35 });
    this.noiseHit({ freq: 200, q: 0.8, type: 'lowpass', gain: 0.25 * k, dur: 0.12, buf: this.brownBuf });
  }

  footstep(surface, k = 1) {
    if (!this.ready) return;
    const r = 0.9 + Math.random() * 0.2;
    switch (surface) {
      case 'turf': this.noiseHit({ freq: 1500 * r, q: 0.7, gain: 0.12 * k, dur: 0.09, buf: this.pinkBuf }); this.noiseHit({ freq: 4500, q: 1, gain: 0.03 * k, dur: 0.05 }); break;
      case 'track': this.noiseHit({ freq: 380 * r, q: 1.2, gain: 0.22 * k, dur: 0.07, type: 'lowpass' }); break;
      case 'court': this.noiseHit({ freq: 600 * r, q: 1.5, gain: 0.2 * k, dur: 0.06 }); break;
      case 'brick': case 'concrete':
        this.noiseHit({ freq: 2200 * r, q: 1.8, gain: 0.13 * k, dur: 0.05 });
        this.noiseHit({ freq: 300, q: 1, type: 'lowpass', gain: 0.18 * k, dur: 0.06 });
        break;
      case 'tile':
        this.noiseHit({ freq: 2800 * r, q: 2.2, gain: 0.15 * k, dur: 0.04 });
        this.tone({ freq: 160 * r, type: 'sine', gain: 0.08 * k, dur: 0.06 });
        break;
      case 'grass': this.noiseHit({ freq: 2800 * r, q: 0.6, gain: 0.1 * k, dur: 0.14, attack: 0.02, buf: this.pinkBuf }); break;
      case 'water':
        this.noiseHit({ freq: 900 * r, q: 0.8, gain: 0.25 * k, dur: 0.25, attack: 0.01 });
        this.tone({ freq: 500 * r, slide: 2, gain: 0.05, dur: 0.1 });
        break;
      default: this.noiseHit({ freq: 800, q: 1, gain: 0.15 * k, dur: 0.06 });
    }
    // 젖은 바닥이면 찰박
    if (this.state.rain > 0.3 && surface !== 'tile' && surface !== 'water') this.noiseHit({ freq: 1200, q: 0.9, gain: 0.08 * k, dur: 0.12, attack: 0.01 });
  }

  thunder(dist = 1) {
    if (!this.ready) return;
    const delay = 0.3 + dist * 2.5;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.brownBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 3.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1.2 / (0.6 + dist), t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    s.connect(f).connect(g).connect(this.amb);
    s.start(t); s.stop(t + 5);
  }

  // 위치가 있는 효과음
  at(x, y, z, fn, ref = 4) {
    if (!this.ready) return;
    const p = this.makePanner(x, y, z, ref, 80);
    p.out.connect(this.sfx);
    const prev = this.sfx;
    this._dest = p.panner;
    fn(p.panner);
    this._dest = null;
    void prev;
    setTimeout(() => p.out.disconnect(), 6000);
  }

  ghostMoan(x, y, z, kind = 'wraith') {
    this.at(x, y, z, (dest) => {
      if (kind === 'wisp') {
        this.tone({ freq: 900 + Math.random() * 300, slide: 1.6, type: 'sine', gain: 0.12, dur: 0.5, dest });
        return;
      }
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f0 = kind === 'boss' ? 70 : kind === 'shadow' ? 110 : 220 + Math.random() * 80;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * 1.5, t + 0.6);
      o.frequency.linearRampToValueAtTime(f0 * 0.8, t + 1.8);
      const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
      const vg = ctx.createGain(); vg.gain.value = f0 * 0.04;
      vib.connect(vg).connect(o.frequency);
      const form = ctx.createBiquadFilter(); form.type = 'bandpass'; form.frequency.value = kind === 'boss' ? 300 : 800; form.Q.value = 4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(kind === 'boss' ? 0.6 : 0.22, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
      o.connect(form).connect(g).connect(dest);
      o.start(t); vib.start(t); o.stop(t + 2.1); vib.stop(t + 2.1);
    }, kind === 'boss' ? 15 : 4);
  }

  play(name, opt = {}) {
    if (!this.ready) return;
    const d = opt.dest || null;
    switch (name) {
      case 'click': this.tone({ freq: 1800, type: 'square', gain: 0.04, dur: 0.02 }); break;
      case 'jump': this.noiseHit({ freq: 600, q: 0.8, gain: 0.08, dur: 0.08 }); break;
      case 'hurt':
        this.tone({ freq: 180, slide: 0.6, type: 'sawtooth', gain: 0.1, dur: 0.18 });
        this.noiseHit({ freq: 400, q: 0.6, gain: 0.2, dur: 0.15 });
        break;
      case 'shieldHit': this.tone({ freq: 1400, slide: 0.7, type: 'triangle', gain: 0.12, dur: 0.25 }); break;
      case 'swoosh': {
        const f = this.noiseHit({ freq: 600, q: 1.2, gain: 0.32, dur: 0.22, attack: 0.03, dest: d });
        f.frequency.exponentialRampToValueAtTime(3500, this.ctx.currentTime + 0.18);
        break;
      }
      case 'shing': this.tone({ freq: 2400, type: 'triangle', gain: 0.07, dur: 0.6, detune: 8, dest: d }); this.tone({ freq: 3610, type: 'sine', gain: 0.05, dur: 0.8, dest: d }); break;
      case 'hitGhost': this.noiseHit({ freq: 1600, q: 2, gain: 0.2, dur: 0.1, dest: d }); this.tone({ freq: 700, slide: 0.5, type: 'square', gain: 0.05, dur: 0.12, dest: d }); break;
      case 'wave':
        this.tone({ freq: 300, slide: 4, type: 'sawtooth', gain: 0.1, dur: 0.5 });
        this.noiseHit({ freq: 2000, q: 0.7, gain: 0.25, dur: 0.5, attack: 0.05 });
        break;
      case 'purify':
        [0, 2, 4].forEach((k, i) => this.pluck([392, 440, 523.3, 587.3, 659.3][k], 0.18, i * 0.07));
        this.tone({ freq: 1568, type: 'sine', gain: 0.05, dur: 1.2, start: 0.1 });
        break;
      case 'pickup': [0, 1, 2, 4].forEach((k, i) => this.pluck([392, 440, 523.3, 587.3, 659.3][k], 0.22, i * 0.09)); break;
      case 'relic':
        // 황종-태주-고선-임종-남려(국악 5음) 상행
        [0, 1, 2, 3, 4].forEach((k, i) => this.pluck([261.6, 293.7, 329.6, 392, 440][k], 0.28, i * 0.12));
        this.tone({ freq: 130.8, type: 'sine', gain: 0.25, dur: 3, start: 0.6 });
        this.tone({ freq: 196, type: 'sine', gain: 0.15, dur: 3, start: 0.6 });
        break;
      case 'chest':
        this.noiseHit({ freq: 300, q: 4, gain: 0.25, dur: 0.4, attack: 0.05, buf: this.brownBuf });
        this.tone({ freq: 140, slide: 1.4, type: 'sawtooth', gain: 0.05, dur: 0.35 });
        break;
      case 'locker': this.noiseHit({ freq: 1200, q: 3, gain: 0.2, dur: 0.15 }); this.tone({ freq: 520, type: 'square', gain: 0.04, dur: 0.08 }); break;
      case 'door': this.noiseHit({ freq: 500, q: 1.2, gain: 0.25, dur: 0.5, attack: 0.05, buf: this.pinkBuf }); break;
      case 'locked': this.tone({ freq: 220, type: 'square', gain: 0.06, dur: 0.08 }); this.tone({ freq: 196, type: 'square', gain: 0.06, dur: 0.1, start: 0.1 }); break;
      case 'gather': this.noiseHit({ freq: 3200, q: 0.7, gain: 0.15, dur: 0.25, attack: 0.03, buf: this.pinkBuf }); this.pluck(659.3, 0.12, 0.15); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noiseHit({ freq: 900, q: 1, gain: 0.12, dur: 0.06, start: i * 0.15 }); this.pluck(523.3, 0.15, 0.5); break;
      case 'heal': this.tone({ freq: 523.3, type: 'sine', gain: 0.1, dur: 0.6 }); this.tone({ freq: 784, type: 'sine', gain: 0.08, dur: 0.8, start: 0.1 }); break;
      case 'incense':
        this.noiseHit({ freq: 1200, q: 0.5, gain: 0.18, dur: 1.2, attack: 0.3, buf: this.pinkBuf });
        this.tone({ freq: 880, type: 'sine', gain: 0.1, dur: 2.2 }); this.tone({ freq: 1320, type: 'sine', gain: 0.06, dur: 2.5, start: 0.05 });
        break;
      case 'jade':
        [1568, 2093, 2637].forEach((f, i) => this.tone({ freq: f, type: 'sine', gain: 0.08, dur: 1.5, start: i * 0.06 }));
        break;
      case 'mirror':
        this.tone({ freq: 2000, slide: 2, type: 'sine', gain: 0.12, dur: 0.6 });
        this.noiseHit({ freq: 6000, q: 0.6, gain: 0.15, dur: 0.6, attack: 0.02 });
        break;
      case 'fuse': this.noiseHit({ freq: 5000, q: 0.5, gain: 0.08, dur: 1.2, attack: 0.05, dest: d }); break;
      case 'boom':
        this.noiseHit({ freq: 180, q: 0.6, type: 'lowpass', gain: 1.0, dur: 1.4, buf: this.brownBuf, dest: d });
        this.tone({ freq: 70, slide: 0.4, type: 'sine', gain: 0.8, dur: 0.8, dest: d });
        this.noiseHit({ freq: 2500, q: 0.5, gain: 0.35, dur: 0.3, dest: d });
        break;
      case 'rocket': {
        const f = this.noiseHit({ freq: 1500, q: 0.8, gain: 0.25, dur: 0.7, attack: 0.02 });
        f.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.7);
        this.tone({ freq: 900, slide: 0.5, type: 'sawtooth', gain: 0.03, dur: 0.6 });
        break;
      }
      case 'pop': this.noiseHit({ freq: 900, q: 1, gain: 0.35, dur: 0.18, dest: d }); break;
      case 'tick':
        for (let i = 0; i < 6; i++) this.noiseHit({ freq: 3500, q: 6, gain: 0.12, dur: 0.02, start: i * 0.25 });
        this.tone({ freq: 196, type: 'sine', gain: 0.35, dur: 3.5, start: 0.1 });
        this.tone({ freq: 294, type: 'sine', gain: 0.12, dur: 3, start: 0.1, detune: 6 });
        break;
      case 'throwPat': this.noiseHit({ freq: 2500, q: 0.8, gain: 0.2, dur: 0.3, attack: 0.02 }); for (let i = 0; i < 6; i++) this.noiseHit({ freq: 4000, q: 3, gain: 0.05, dur: 0.02, start: 0.25 + Math.random() * 0.3 }); break;
      case 'cooldown': this.tone({ freq: 300, type: 'square', gain: 0.03, dur: 0.05 }); break;
      case 'ghostDie':
        this.tone({ freq: 800, slide: 3, type: 'sine', gain: 0.12, dur: 0.8, dest: d });
        this.noiseHit({ freq: 5000, q: 0.7, gain: 0.1, dur: 0.8, attack: 0.05, dest: d });
        break;
      case 'ghostAttack': this.tone({ freq: 140, slide: 0.5, type: 'sawtooth', gain: 0.14, dur: 0.3, dest: d }); break;
      case 'bossRoar':
        this.tone({ freq: 55, slide: 0.7, type: 'sawtooth', gain: 0.5, dur: 2.5 });
        this.noiseHit({ freq: 200, q: 0.5, type: 'lowpass', gain: 0.6, dur: 2.5, attack: 0.3, buf: this.brownBuf });
        break;
      case 'quest': this.pluck(392, 0.2); this.pluck(523.3, 0.2, 0.12); this.pluck(659.3, 0.2, 0.24); break;
      case 'victory':
        [0, 1, 2, 3, 4, 3, 4].forEach((k, i) => this.pluck([392, 440, 523.3, 587.3, 659.3][k], 0.28, i * 0.18));
        this.buk(1);
        break;
    }
  }
}
