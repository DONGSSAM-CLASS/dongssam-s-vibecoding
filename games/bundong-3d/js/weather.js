import * as THREE from 'three';
import { isIndoor } from './layout.js';
import { U, updateWet } from './materials.js';
import { rand, rr, damp } from './util.js';

// 날씨: 맑음 → 구름 → 비 → 뇌우 → 안개 → 눈 … 확률에 따라 자연스럽게 바뀜(전환은 천천히 섞임)
export const WEATHERS = {
  clear: { name: '맑음', icon: '☀', cloud: 0.0, rain: 0, snow: 0, fog: 0, storm: 0, wind: 0.35 },
  cloudy: { name: '흐림', icon: '☁', cloud: 0.65, rain: 0, snow: 0, fog: 0.05, storm: 0, wind: 0.55 },
  rain: { name: '비', icon: '🌧', cloud: 0.85, rain: 0.7, snow: 0, fog: 0.15, storm: 0.2, wind: 0.7 },
  storm: { name: '뇌우', icon: '⛈', cloud: 1.0, rain: 1.0, snow: 0, fog: 0.2, storm: 1, wind: 1.0 },
  fog: { name: '안개', icon: '🌫', cloud: 0.5, rain: 0, snow: 0, fog: 0.75, storm: 0, wind: 0.15 },
  snow: { name: '눈', icon: '❄', cloud: 0.8, rain: 0, snow: 0.8, fog: 0.2, storm: 0, wind: 0.4 },
};
// 다음 날씨 확률표
const NEXT = {
  clear: [['clear', 3], ['cloudy', 4], ['fog', 1]],
  cloudy: [['clear', 3], ['rain', 3], ['fog', 1], ['snow', 0.6], ['cloudy', 1]],
  rain: [['cloudy', 3], ['storm', 2], ['rain', 1], ['fog', 1]],
  storm: [['rain', 3], ['cloudy', 1]],
  fog: [['clear', 2], ['cloudy', 2]],
  snow: [['cloudy', 2], ['clear', 1], ['snow', 1]],
};

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.state = 'clear';
    this.mode = 'auto';
    this.timer = rr(150, 260);
    this.cur = { ...WEATHERS.clear };
    this.flash = 0;
    this.nextBolt = 6;
    this.wet = 0;
    this.forced = null;
    // 빗줄기(선분) — 카메라 주위에서 반복
    const N = 6000;
    this.N = N;
    const pos = new Float32Array(N * 6);
    this.drops = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.drops[i * 3] = rr(-25, 25);
      this.drops[i * 3 + 1] = rr(0, 22);
      this.drops[i * 3 + 2] = rr(-25, 25);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.4, depthWrite: false }));
    this.rainMesh.frustumCulled = false;
    scene.add(this.rainMesh);
    // 눈송이
    const sg = new THREE.BufferGeometry();
    this.flakes = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.flakes[i * 3] = rr(-25, 25); this.flakes[i * 3 + 1] = rr(0, 22); this.flakes[i * 3 + 2] = rr(-25, 25); }
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.snowMesh = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false }));
    this.snowMesh.frustumCulled = false;
    scene.add(this.snowMesh);
    this.windDir = new THREE.Vector2(1, 0.3).normalize();
  }

  get cloud() { return this.cur.cloud; }
  get fog() { return this.cur.fog; }
  get storm() { return this.cur.storm; }
  get rain() { return this.cur.rain; }
  get name() { return WEATHERS[this.state].name; }
  get icon() { return WEATHERS[this.state].icon; }

  set(state, instant = false) {
    this.state = state;
    if (instant) Object.assign(this.cur, WEATHERS[state]);
    this.timer = rr(150, 280);
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'auto') this.set(mode);
  }

  update(dt, cam, game) {
    if (this.forced) {
      if (this.state !== this.forced) this.state = this.forced;
    } else if (this.mode === 'auto') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const opts = NEXT[this.state];
        const tot = opts.reduce((s, o) => s + o[1], 0);
        let r = rand() * tot;
        for (const [s, w] of opts) { r -= w; if (r <= 0) { this.set(s); break; } }
        game.ui.toast(`날씨가 바뀌고 있다: ${WEATHERS[this.state].icon} ${WEATHERS[this.state].name}`, '', 2500);
      }
    }
    // 목표 값으로 천천히 섞기
    const T = WEATHERS[this.state];
    for (const k of ['cloud', 'rain', 'snow', 'fog', 'storm', 'wind']) this.cur[k] = damp(this.cur[k], T[k], 0.08, dt);
    U.uWind.value = 0.25 + this.cur.wind * 0.9;

    // 번개
    this.flash = Math.max(0, this.flash - dt * 3.5);
    if (this.cur.storm > 0.6) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = rr(5, 14);
        this.flash = 1;
        setTimeout(() => (this.flash = 0.8), 120);
        game.audio.thunder(rand());
        game.ui.screenFlash('rgba(220,230,255,0.25)');
        // 번개 빛에 그림자 악령이 드러남
        for (const gh of game.ghosts.list) if (gh.type === 'shadow') gh.reveal(1.2);
      }
    }

    // 젖음
    const wetTarget = Math.max(this.cur.rain, this.cur.snow * 0.5);
    this.wet = wetTarget > this.wet ? damp(this.wet, wetTarget, 0.25, dt) : damp(this.wet, wetTarget, 0.02, dt);
    updateWet(this.wet);

    // 비·눈 입자
    const indoor = isIndoor(cam.position.x, cam.position.z);
    const rainA = this.cur.rain;
    this.rainMesh.visible = rainA > 0.02;
    if (this.rainMesh.visible) {
      const p = this.rainMesh.geometry.attributes.position.array;
      const n = Math.floor(this.N * Math.min(1, rainA));
      const wx = this.windDir.x * this.cur.wind * 4, wz = this.windDir.y * this.cur.wind * 4;
      const sp = 22;
      for (let i = 0; i < this.N; i++) {
        const d = this.drops;
        d[i * 3 + 1] -= sp * dt;
        d[i * 3] += wx * dt; d[i * 3 + 2] += wz * dt;
        if (d[i * 3 + 1] < 0) { d[i * 3 + 1] += 22; d[i * 3] = rr(-25, 25); d[i * 3 + 2] = rr(-25, 25); }
        const x = cam.position.x + wrap(d[i * 3]), y = cam.position.y - 6 + d[i * 3 + 1], z = cam.position.z + wrap(d[i * 3 + 2]);
        const hide = i >= n || (indoor && Math.abs(x - cam.position.x) < 30);
        p[i * 6] = x; p[i * 6 + 1] = hide ? -100 : y; p[i * 6 + 2] = z;
        p[i * 6 + 3] = x - wx * 0.03; p[i * 6 + 4] = hide ? -100 : y + 0.45; p[i * 6 + 5] = z - wz * 0.03;
      }
      this.rainMesh.geometry.attributes.position.needsUpdate = true;
      this.rainMesh.material.opacity = 0.25 + game.sky.dayFactor * 0.2 + this.flash * 0.3;
    }
    const snowA = this.cur.snow;
    this.snowMesh.visible = snowA > 0.02 && !indoor;
    if (this.snowMesh.visible) {
      const p = this.snowMesh.geometry.attributes.position.array;
      const n = Math.floor(this.N * snowA);
      const t = performance.now() * 0.001;
      for (let i = 0; i < this.N; i++) {
        const d = this.flakes;
        d[i * 3 + 1] -= 1.4 * dt;
        d[i * 3] += (Math.sin(t + i) * 0.5 + this.windDir.x * this.cur.wind) * dt;
        d[i * 3 + 2] += Math.cos(t * 0.7 + i) * 0.5 * dt;
        if (d[i * 3 + 1] < 0) d[i * 3 + 1] += 22;
        p[i * 3] = cam.position.x + wrap(d[i * 3]);
        p[i * 3 + 1] = i < n ? cam.position.y - 6 + d[i * 3 + 1] : -100;
        p[i * 3 + 2] = cam.position.z + wrap(d[i * 3 + 2]);
      }
      this.snowMesh.geometry.attributes.position.needsUpdate = true;
    }
  }
}

function wrap(v) {
  return ((((v + 25) % 50) + 50) % 50) - 25;
}
