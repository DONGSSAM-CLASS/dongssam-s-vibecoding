import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BUILDERS, buildRocket } from './relicModels.js';
import { input, hit } from './input.js';
import { groundAt, rayCast } from './collision.js';

// 실제 한국사 유물 7점 — 설명은 박물관 공개 자료를 바탕으로 학생 눈높이에 맞춰 정리
export const RELICS = [
  {
    id: 'sword', name: '사인참사검', hanja: '四寅斬邪劍', era: '조선 시대', where: '국립중앙박물관 소장',
    desc: '호랑이(寅)의 기운이 네 번 겹치는 때 — 인년·인월·인일·인시 — 에 만든 칼이라 "사인검"이라 부릅니다. "참사(斬邪)"는 사악한 것을 벤다는 뜻이에요. 칼날 한쪽에는 금으로 상감한 별자리(북두칠성과 28수)가, 다른 쪽에는 나쁜 기운을 물리치는 주문이 새겨져 있습니다. 실제 싸움보다 나쁜 기운을 막는 벽사(辟邪)의 의미가 큰 칼이었습니다.',
    skill: '좌클릭 <b>참사검격</b> — 앞을 베어 악령 공격<br>우클릭 <b>이십팔수 검기</b> — 별빛 검기를 멀리 날림 (재사용 5초)',
    icon: '🗡️', cd: 0.5, cd2: 5,
    hold: { pos: [0.0, -0.01, -0.03], rot: [-0.85, 0.2, 0.45], scale: 0.72 },
    holdGLB: { rot: [-0.75, 0.2, -0.2] },
  },
  {
    id: 'mirror', name: '다뉴세문경', hanja: '多鈕細文鏡', era: '청동기 시대 (기원전 4세기 무렵)', where: '국보 · 숭실대학교 한국기독교박물관 소장',
    desc: '"꼭지가 여러 개(多鈕) 달리고 가는 무늬(細文)가 새겨진 거울"이라는 뜻입니다. 지름 약 21cm 안에 1만 3천여 개의 가는 선이 0.3mm 간격으로 새겨져 있어, 지금 기술로도 똑같이 만들기 어렵다고 합니다. 거울은 햇빛을 반사해 신성한 힘을 보여 주는 제사장의 물건이었어요.',
    skill: '좌클릭 <b>조요경 섬광</b> — 앞쪽 악령을 기절시키고, 숨은 그림자 악령의 모습을 드러냄 (재사용 8초)',
    icon: '🪞', cd: 8,
    hold: { pos: [-0.02, 0.06, -0.06], rot: [0.15, 0.35, 0.0], scale: 1.0 },
  },
  {
    id: 'censer', name: '백제 금동대향로', hanja: '百濟金銅大香爐', era: '백제 (6~7세기)', where: '국보 · 국립부여박물관 소장',
    desc: '1993년 부여 능산리 절터의 진흙 속에서 발견되었습니다. 높이 약 62cm로, 아래에는 용이 연꽃 줄기를 입에 물고, 몸체는 연꽃 봉오리, 뚜껑은 신선이 사는 산봉우리, 꼭대기에는 봉황이 앉아 있어요. 뚜껑에는 다섯 악사와 여러 동물·사람이 새겨져 백제 사람들이 꿈꾼 이상 세계를 보여 줍니다.',
    skill: '좌클릭 <b>정화의 향</b> — 바라보는 곳에 향 연기를 피워 악령을 지속 정화, 안에 있으면 체력 회복 (재사용 15초)',
    icon: '🏮', cd: 15,
    hold: { pos: [-0.02, -0.03, -0.06], rot: [0.15, 0.3, 0.0], scale: 0.62 },
  },
  {
    id: 'jade', name: '곡옥', hanja: '曲玉', era: '삼국 시대 · 신라 (5~6세기)', where: '신라 금관·목걸이 장식 (국립경주박물관 등)',
    desc: '쉼표처럼 굽은 옥으로, 신라 금관과 귀걸이·목걸이에 주렁주렁 매달려 있습니다. 머리에 금 모자(금모)를 씌운 것도 있어요. 생명의 씨앗, 초승달, 짐승의 이빨을 본뗬다는 여러 해석이 있으며, 왕과 귀족을 지키는 힘을 상징했습니다.',
    skill: '좌클릭 <b>생명의 결계</b> — 12초 동안 피해를 막는 보호막 + 즉시 회복 (재사용 22초)<br>지니고만 있어도 체력이 천천히 회복',
    icon: '🟢', cd: 22,
    hold: { pos: [0.0, 0.04, -0.04], rot: [0.2, 0.4, 0.0], scale: 2.4 },
    holdGLB: { rot: [0.2, 0.4, 1.15], scale: 1.8 },
  },
  {
    id: 'bomb', name: '비격진천뢰', hanja: '飛擊震天雷', era: '조선 선조 (16세기 말)', where: '보물 · 실물이 국립박물관 등에 전함',
    desc: '"날아가서 하늘을 뒤흔드는 우레"라는 뜻의 조선의 시한폭탄입니다. 선조 때 화포장 이장손이 만들었고, 임진왜란 때 경주성을 되찾는 전투 등에서 쓰였어요. 쇠로 만든 공 안에 화약과 쇳조각을 넣고, 도화선 역할을 하는 나무 심지를 감아 터지는 시간을 조절했습니다.',
    skill: '좌클릭 <b>진천뢰 투척</b> — 던지면 잠시 뒤 터져 넓은 범위의 악령을 정화 (재사용 7초)',
    icon: '💣', cd: 7,
    hold: { pos: [0.0, 0.02, -0.06], rot: [0, 0, 0], scale: 0.75 },
  },
  {
    id: 'rocket', name: '신기전', hanja: '神機箭', era: '조선 세종 (1448년 기록)', where: '『국조오례서례』 병기도설에 설계도 전함',
    desc: '고려 말 최무선이 만든 "주화"를 세종 때 개량한 로켓 화살입니다. 화살대에 종이로 만든 화약통(약통)을 달아 스스로 날아갔어요. 문종 때 만든 화차에 꽂으면 한 번에 100발까지 쏠 수 있었고, 설계도가 정확한 치수와 함께 남아 있어 세계적으로도 귀한 기록입니다.',
    skill: '좌클릭 <b>신기전 일제 발사</b> — 로켓 화살 5발이 가까운 악령을 쫓아감 (재사용 8초)',
    icon: '🚀', cd: 8,
    hold: { pos: [0.02, 0.0, 0.28], rot: [-1.5, 0.0, 0.1], scale: 0.62 },
  },
  {
    id: 'sundial', name: '앙부일구', hanja: '仰釜日晷', era: '조선 세종 16년 (1434)', where: '보물 · 국립고궁박물관 소장(후대 제작품)',
    desc: '"하늘을 우러르는 가마솥 모양의 해시계"라는 뜻입니다. 세종 때 장영실 등이 만들어 한양 거리(혜정교, 종묘 앞)에 두고 백성 누구나 시각을 알 수 있게 했어요. 글을 모르는 백성을 위해 시각을 동물 그림(12지신)으로 표시했고, 영침의 그림자로 시각과 절기를 함께 알 수 있습니다.',
    skill: '좌클릭 <b>시간의 그림자</b> — 9초 동안 주변 악령의 시간이 느려짐 (재사용 28초)',
    icon: '🕰️', cd: 28,
    hold: { pos: [0.0, 0.0, -0.06], rot: [0.35, 0.0, 0.0], scale: 0.85 },
    holdGLB: { pos: [0, 0.1, -0.1], rot: [0.2, 0.15, 0], scale: 0.7 },
  },
];

export const relicById = (id) => RELICS.find((r) => r.id === id);

const _v = new THREE.Vector3(), _f = new THREE.Vector3();

export class Relics {
  constructor(game) {
    this.g = game;
    this.owned = new Set();
    this.current = -1;
    this.cd = {};
    this.cd2 = {};
    this.models = {};
    this.icons = {};
    this.overrides = {}; // GLB로 교체된 모델
    this.projectiles = [];
    this.zones = [];
    this.timeSlow = 0;
  }

  async loadOverrides() {
    // assets/relics/manifest.json 예: { "censer": "censer.glb" }
    if (location.protocol === 'file:') return;
    try {
      const res = await fetch('assets/relics/manifest.json', { cache: 'no-store' });
      if (!res.ok) return;
      const man = await res.json();
      const loader = new GLTFLoader();
      for (const [id, file] of Object.entries(man)) {
        if (!relicById(id) || !file) continue;
        try {
          const gltf = await loader.loadAsync('assets/relics/' + file);
          const obj = gltf.scene;
          // 크기를 원래 모델에 맞춤
          const ref = BUILDERS[id]();
          const b1 = new THREE.Box3().setFromObject(ref), b2 = new THREE.Box3().setFromObject(obj);
          const s1 = b1.getSize(new THREE.Vector3()).length(), s2 = b2.getSize(new THREE.Vector3()).length();
          if (s2 > 0) obj.scale.multiplyScalar(s1 / s2);
          const c2 = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
          const c1 = b1.getCenter(new THREE.Vector3());
          obj.position.add(c1.sub(c2));
          const wrap = new THREE.Group();
          wrap.add(obj);
          this.overrides[id] = wrap;
        } catch (e) { console.warn('GLB 불러오기 실패', id, e); }
      }
    } catch (e) { /* 목록 없음 → 절차적 모델 사용 */ }
  }

  build(id) {
    if (this.overrides[id]) return this.overrides[id].clone(true);
    return BUILDERS[id]();
  }

  handModel(id) {
    if (this.models[id]) return this.models[id];
    const r = relicById(id);
    const inner = this.build(id);
    const wrap = new THREE.Group();
    wrap.add(inner);
    // 생성 모델의 손잡이·받침 위치를 따로 보정. 기본 모델의 자세는 유지
    const hold = this.overrides[id] ? { ...r.hold, ...r.holdGLB } : r.hold;
    wrap.position.set(...hold.pos);
    wrap.rotation.set(...hold.rot);
    wrap.scale.setScalar(hold.scale);
    wrap.userData.inner = inner;
    this.models[id] = wrap;
    return wrap;
  }

  // 유물 아이콘(작은 오프스크린 렌더러로 한 번 그림)
  renderIcons() {
    const size = 256;
    let r;
    try {
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { return; }
    r.setSize(size, size);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0x8899aa, side: THREE.BackSide })));
    const top = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    top.position.set(3, 6, 4);
    envScene.add(top);
    scene.environment = pm.fromScene(envScene).texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x554433, 1.2));
    const d = new THREE.DirectionalLight(0xfff0dd, 2.5);
    d.position.set(2, 3, 4);
    scene.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    for (const rel of RELICS) {
      const obj = this.build(rel.id);
      if (rel.id === 'sword') obj.rotation.z = -0.8;
      if (rel.id === 'rocket') obj.rotation.z = -0.9;
      if (rel.id === 'sundial') obj.rotation.x = 0.5;
      if (rel.id === 'mirror') obj.rotation.y = 0.3;
      scene.add(obj);
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3()).length();
      cam.position.copy(c).add(new THREE.Vector3(0, s * 0.15, s * 1.75));
      cam.lookAt(c);
      r.render(scene, cam);
      this.icons[rel.id] = r.domElement.toDataURL('image/png');
      scene.remove(obj);
    }
    r.dispose();
    r.forceContextLoss();
  }

  give(id, silent = false) {
    if (this.owned.has(id)) return;
    this.owned.add(id);
    const idx = RELICS.findIndex((r) => r.id === id);
    if (!silent) this.select(idx);
    this.g.ui.refreshHotbar();
  }

  select(idx) {
    const rel = RELICS[idx];
    if (!rel || !this.owned.has(rel.id) || idx === this.current) return;
    this.current = idx;
    this.g.player.hold(this.handModel(rel.id));
    this.g.player.playAnim('equip', 0.35);
    this.g.audio.play('click');
    this.g.ui.refreshHotbar();
  }

  get held() { return this.current >= 0 ? RELICS[this.current] : null; }

  ready(id, alt = false) {
    const t = (alt ? this.cd2 : this.cd)[id] || 0;
    return t <= 0;
  }

  update(dt, active) {
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    for (const k in this.cd2) this.cd2[k] = Math.max(0, this.cd2[k] - dt);
    if (this.timeSlow > 0) this.timeSlow -= dt;
    const P = this.g.player;
    if (active && !P.dead) {
      // 유물 바꾸기
      for (let i = 0; i < RELICS.length; i++) if (hit('Digit' + (i + 1))) this.select(i);
      if (input.mouse.wheel) {
        const own = RELICS.map((r, i) => (this.owned.has(r.id) ? i : -1)).filter((i) => i >= 0);
        if (own.length) {
          let k = own.indexOf(this.current);
          k = (k + input.mouse.wheel + own.length) % own.length;
          this.select(own[k]);
        }
      }
      const rel = this.held;
      if (rel) {
        if (input.mouse.leftPressed || (rel.id === 'sword' && input.mouse.left)) this.use(rel, false);
        if (input.mouse.rightPressed && rel.id === 'sword') this.use(rel, true);
      }
    }
    // 곡옥 지속 회복
    if (this.owned.has('jade') && !P.dead && P.hp < P.maxHp) P.heal(0.7 * dt);
    // 칼 빛
    const sw = this.models.sword;
    if (sw) {
      const m = sw.userData.inner.userData.glowMat;
      if (m) m.emissiveIntensity = Math.max(0, m.emissiveIntensity - dt * 3);
    }
    this.updateProjectiles(dt);
    this.updateZones(dt);
  }

  use(rel, alt) {
    const id = rel.id;
    if (!this.ready(id, alt)) {
      if (!(id === 'sword' && !alt)) { this.g.audio.play('cooldown'); this.g.ui.toast(`${rel.name} — 아직 기운이 모이는 중`, 'warn', 900); }
      return;
    }
    (alt ? this.cd2 : this.cd)[id] = alt ? rel.cd2 : rel.cd;
    const g = this.g, P = g.player;
    const eye = P.eyePos;
    const fwd = P.forward(_f).clone();
    switch (id) {
      case 'sword': alt ? this.swordWave(eye, fwd) : this.swordSlash(eye, fwd); break;
      case 'mirror': this.mirrorFlash(eye, fwd); break;
      case 'censer': this.censer(eye, fwd); break;
      case 'jade': this.jadeShield(); break;
      case 'bomb': this.throwBomb(eye, fwd); break;
      case 'rocket': this.fireRockets(eye, fwd); break;
      case 'sundial': this.sundial(); break;
    }
    g.stats.skills++;
  }

  // ---- 사인참사검 ----
  swordSlash(eye, fwd) {
    const g = this.g;
    g.player.playAnim('slash', 0.42);
    g.audio.play('swoosh');
    const glow = this.models.sword?.userData.inner.userData.glowMat;
    if (glow) glow.emissiveIntensity = 1.2;
    setTimeout(() => {
      const P = g.player;
      const e = P.eyePos, f = P.forward(new THREE.Vector3());
      g.fx.slash(e.clone().addScaledVector(f, 0.9).add(new THREE.Vector3(0, -0.25, 0)), P.yaw, P.pitch, 0xfff0c8, 1.6, 2.2);
      let n = 0;
      for (const gh of g.ghosts.list) {
        if (!gh.alive) continue;
        _v.copy(gh.pos).sub(e);
        const dist = _v.length() - gh.radius;
        if (dist > 3.0) continue;
        _v.normalize();
        if (_v.dot(f) < 0.25 && dist > 0.6) continue;
        gh.damage(24, 'sword');
        gh.knock(f, 3);
        g.fx.burst(gh.pos, 0xfff0c0, 14, 4, 0.4, 0.2);
        n++;
      }
      if (n) { g.audio.play('hitGhost'); g.audio.play('shing'); g.ui.hitMarker(); }
    }, 110);
  }

  swordWave(eye, fwd) {
    const g = this.g;
    g.player.playAnim('wave', 0.5);
    g.audio.play('wave');
    const glow = this.models.sword?.userData.inner.userData.glowMat;
    if (glow) glow.emissiveIntensity = 3;
    const geo = new THREE.RingGeometry(0.9, 1.3, 24, 1, -1.1, 2.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(eye).addScaledVector(fwd, 1).add(new THREE.Vector3(0, -0.2, 0));
    m.rotation.order = 'YXZ';
    m.rotation.set(-Math.PI / 2 + this.g.player.pitch, this.g.player.yaw, 0);
    m.rotateZ(Math.PI / 2);
    g.scene.add(m);
    this.projectiles.push({ kind: 'wave', obj: m, vel: fwd.clone().multiplyScalar(26), life: 0.9, hitSet: new Set() });
  }

  // ---- 다뉴세문경 ----
  mirrorFlash(eye, fwd) {
    const g = this.g;
    g.player.playAnim('raise', 0.6);
    g.audio.play('mirror');
    g.fx.cone(eye.clone().addScaledVector(fwd, 0.6).add(new THREE.Vector3(0, -0.1, 0)), fwd, 0xfff4d0, 22, 0.32, 0.6);
    g.fx.flash(eye.clone().addScaledVector(fwd, 3), 0xfff2cc, 120, 0.5, 30);
    g.ui.screenFlash('rgba(255,250,230,0.35)');
    for (const gh of g.ghosts.list) {
      if (!gh.alive) continue;
      _v.copy(gh.pos).sub(eye);
      const d = _v.length();
      if (gh.type === 'shadow' && d < 40) gh.reveal(12);
      if (d < 23 && _v.normalize().dot(fwd) > Math.cos(0.38)) {
        gh.reveal(12);
        gh.stun(3);
        gh.damage(12, 'mirror');
        g.fx.burst(gh.pos, 0xfff8e0, 10, 3, 0.5, 0.25);
      }
    }
  }

  // ---- 금동대향로 ----
  censer(eye, fwd) {
    const g = this.g;
    g.player.playAnim('raise', 0.7);
    g.audio.play('incense');
    // 바라보는 땅 위치
    let d = rayCast(eye.x, eye.y, eye.z, fwd.x, fwd.y, fwd.z, 14);
    let p = eye.clone().addScaledVector(fwd, Math.min(d, 14) - 0.3);
    if (fwd.y < -0.05) {
      const tg = (eye.y - 0.05) / -fwd.y;
      if (tg < d) p = eye.clone().addScaledVector(fwd, tg);
    }
    if (p.distanceTo(eye) < 1.5 || fwd.y > 0.3) p = g.player.pos.clone().addScaledVector(new THREE.Vector3(fwd.x, 0, fwd.z).normalize(), 3);
    p.y = groundAt(p.x, p.z, p.y + 1, 0.2);
    // 바닥에 작은 향로를 놓음
    const model = this.build('censer');
    model.scale.setScalar(1.6);
    model.position.copy(p);
    g.scene.add(model);
    g.fx.ring(p, 0xffd27a, 0.5, 5, 0.8);
    this.zones.push({ kind: 'incense', pos: p, r: 5, life: 9, max: 9, model, tick: 0 });
  }

  // ---- 곡옥 ----
  jadeShield() {
    const g = this.g, P = g.player;
    P.playAnim('raise', 0.6);
    g.audio.play('jade');
    P.shield = 60;
    P.shieldTime = 12;
    P.heal(25);
    g.fx.sphere(P.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x5fffb0, 0.3, 2.5, 0.8);
    g.fx.burst(P.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0x6fffc0, 40, 3, 1, 0.2, -1);
    g.ui.screenFlash('rgba(80,255,170,0.18)');
  }

  // ---- 비격진천뢰 ----
  throwBomb(eye, fwd) {
    const g = this.g;
    g.player.playAnim('throw', 0.5);
    setTimeout(() => {
      const P = g.player;
      const e = P.eyePos, f = P.forward(new THREE.Vector3());
      const m = this.build('bomb');
      m.scale.setScalar(1.2);
      m.position.copy(e).addScaledVector(f, 0.6);
      g.scene.add(m);
      const vel = f.clone().multiplyScalar(15).add(new THREE.Vector3(0, 4.5, 0));
      this.projectiles.push({ kind: 'bomb', obj: m, vel, life: 2.2, fuse: true });
      g.audio.play('fuse');
      // 손에서 잠깐 사라졌다 다시 나타남
      const hm = this.models.bomb;
      if (hm) { hm.visible = false; setTimeout(() => (hm.visible = true), 700); }
    }, 180);
  }

  explode(pos) {
    const g = this.g;
    g.audio.at(pos.x, pos.y, pos.z, (d) => g.audio.play('boom', { dest: d }), 10);
    g.fx.burst(pos, 0xffb04a, 70, 12, 0.7, 0.5, 4);
    g.fx.burst(pos, 0xfff0c0, 30, 6, 0.4, 0.35, 0);
    g.fx.smokePuff(pos, 0x3a3632, 24, 3, 1.2, 3.5, 3, 0.55);
    g.fx.ring(pos, 0xffc070, 0.5, 7, 0.5);
    g.fx.flash(pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffa040, 400, 0.45, 30);
    const dist = pos.distanceTo(g.player.pos);
    g.ui.shake(Math.max(0, 1 - dist / 25) * 0.6);
    for (const gh of g.ghosts.list) {
      if (!gh.alive) continue;
      const d = gh.pos.distanceTo(pos);
      if (d < 7) {
        gh.damage(85 * (1 - d / 9), 'bomb');
        gh.knock(_v.copy(gh.pos).sub(pos).normalize(), 8);
        gh.stun(0.8);
      }
    }
  }

  // ---- 신기전 ----
  fireRockets(eye, fwd) {
    const g = this.g;
    g.player.playAnim('raise', 0.5);
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const P = g.player;
        const e = P.eyePos, f = P.forward(new THREE.Vector3());
        const right = new THREE.Vector3(-f.z, 0, f.x).normalize();
        const m = buildRocket(0.7);
        const start = e.clone().addScaledVector(f, 0.8).addScaledVector(right, (i - 2) * 0.15).add(new THREE.Vector3(0, -0.15, 0));
        m.position.copy(start);
        g.scene.add(m);
        // 가장 가까운 앞쪽 악령
        let best = null, bs = Infinity;
        for (const gh of g.ghosts.list) {
          if (!gh.alive || (gh.type === 'shadow' && !gh.visibleNow)) continue;
          _v.copy(gh.pos).sub(e);
          const d = _v.length();
          if (d > 50) continue;
          const score = d * (1.6 - _v.normalize().dot(f));
          if (score < bs) { bs = score; best = gh; }
        }
        const v = f.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.12 + Math.random() * 0.1, (Math.random() - 0.5) * 0.25)).normalize().multiplyScalar(22);
        this.projectiles.push({ kind: 'rocket', obj: m, vel: v, life: 3, target: best });
        g.audio.play('rocket');
      }, i * 110);
    }
  }

  // ---- 앙부일구 ----
  sundial() {
    const g = this.g;
    g.player.playAnim('raise', 0.8);
    g.audio.play('tick');
    this.timeSlow = 9;
    g.fx.ring(g.player.pos, 0xffe08a, 1, 45, 1.4, 0.2);
    g.fx.ring(g.player.pos, 0xfff4c8, 1, 30, 1.0, 1.5);
    g.ui.screenFlash('rgba(255,220,140,0.22)');
    g.ui.toast('앙부일구의 그림자가 악령의 시간을 붙잡았다! (9초)', 'big', 1800);
  }

  // ---- 팥 뿌리기(소모품) ----
  throwBeans() {
    const g = this.g, P = g.player;
    const e = P.eyePos, f = P.forward(new THREE.Vector3());
    P.playAnim('throw', 0.45);
    g.audio.play('throwPat');
    for (let i = 0; i < 40; i++) {
      const v = f.clone().multiplyScalar(9 + Math.random() * 5).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3));
      g.fx.glow.emit(e.clone().addScaledVector(f, 0.5), v, new THREE.Color(0xc2302a), 0.8, 0.09, 0.07, 1, 9, 0.5);
    }
    for (const gh of g.ghosts.list) {
      if (!gh.alive) continue;
      _v.copy(gh.pos).sub(e);
      const d = _v.length();
      if (d < 9.5 && _v.normalize().dot(f) > Math.cos(0.5)) {
        gh.stun(2.5);
        gh.damage(10, 'pat');
        gh.knock(f, 4);
      }
    }
  }

  updateProjectiles(dt) {
    const g = this.g;
    const slowK = 1;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt * slowK;
      const o = p.obj;
      if (p.kind === 'wave') {
        o.position.addScaledVector(p.vel, dt);
        o.material.opacity = Math.max(0, p.life / 0.9);
        g.fx.trail(o.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 2)), 0xffe9a8, 0.3, 0.5);
        for (const gh of g.ghosts.list) {
          if (!gh.alive || p.hitSet.has(gh)) continue;
          if (gh.pos.distanceTo(o.position) < 1.6 + gh.radius) {
            p.hitSet.add(gh);
            gh.damage(40, 'wave');
            gh.knock(p.vel.clone().normalize(), 6);
            g.fx.burst(gh.pos, 0xffe9a8, 20, 5, 0.5, 0.3);
            g.ui.hitMarker();
          }
        }
        const vl = p.vel.length();
        const d = rayCast(o.position.x, o.position.y, o.position.z, p.vel.x / vl, p.vel.y / vl, p.vel.z / vl, 0.6);
        if (d < 0.6) p.life = 0;
      } else if (p.kind === 'bomb') {
        p.vel.y -= 18 * dt;
        const step = p.vel.clone().multiplyScalar(dt);
        const len = step.length();
        const d = len > 0 ? rayCast(o.position.x, o.position.y, o.position.z, step.x / len, 0, step.z / len, len + 0.12) : Infinity;
        if (d < len + 0.12) { p.vel.x *= -0.4; p.vel.z *= -0.4; }
        else { o.position.x += step.x; o.position.z += step.z; }
        o.position.y += step.y;
        const gy = groundAt(o.position.x, o.position.z, o.position.y + 0.2, 0.1) + 0.12;
        if (o.position.y < gy) {
          o.position.y = gy;
          if (Math.abs(p.vel.y) > 2) g.audio.at(o.position.x, o.position.y, o.position.z, (dd) => g.audio.play('pop', { dest: dd }));
          p.vel.y *= -0.35; p.vel.x *= 0.6; p.vel.z *= 0.6;
        }
        o.rotation.x += p.vel.z * dt * 3; o.rotation.z -= p.vel.x * dt * 3;
        // 심지 불꽃
        const tip = o.localToWorld(new THREE.Vector3(0.03, 0.15, 0.01));
        g.fx.glow.emit(tip, new THREE.Vector3((Math.random() - 0.5), 1 + Math.random(), (Math.random() - 0.5)), new THREE.Color(0xffb040), 0.3, 0.12, 0.02, 1, 0, 1);
        if (p.life <= 0) this.explode(o.position.clone());
      } else if (p.kind === 'rocket') {
        if (p.target && p.target.alive) {
          const want = p.target.pos.clone().sub(o.position).normalize().multiplyScalar(26);
          p.vel.lerp(want, Math.min(1, dt * 3.5));
        } else p.vel.y -= 2 * dt;
        o.position.addScaledVector(p.vel, dt);
        o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.vel.clone().normalize());
        const tail = o.position.clone().addScaledVector(p.vel.clone().normalize(), -0.1);
        g.fx.glow.emit(tail, new THREE.Vector3(0, 0, 0), new THREE.Color(0xffa040), 0.25, 0.25, 0.02, 1, 0, 0);
        if (Math.random() < 0.6) g.fx.smoke.emit(tail, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.3, (Math.random() - 0.5) * 0.3), new THREE.Color(0xbbbbbb), 1.4, 0.3, 1.2, 0.35, 0, 0.5);
        let boom = false;
        for (const gh of g.ghosts.list) {
          if (gh.alive && gh.pos.distanceTo(o.position) < gh.radius + 0.4) { boom = true; break; }
        }
        const gy = groundAt(o.position.x, o.position.z, o.position.y + 0.2, 0.1);
        if (o.position.y < gy + 0.05) boom = true;
        const rl = p.vel.length() || 1;
        if (rayCast(o.position.x, o.position.y, o.position.z, p.vel.x / rl, p.vel.y / rl, p.vel.z / rl, 0.5) < 0.5) boom = true;
        if (boom || p.life <= 0) {
          p.life = 0;
          g.fx.burst(o.position, 0xffc060, 25, 6, 0.4, 0.3, 2);
          g.fx.flash(o.position, 0xffa040, 60, 0.25, 12);
          g.audio.at(o.position.x, o.position.y, o.position.z, (dd) => g.audio.play('pop', { dest: dd }));
          for (const gh of g.ghosts.list) {
            if (!gh.alive) continue;
            const d = gh.pos.distanceTo(o.position);
            if (d < gh.radius + 1.8) { gh.damage(24, 'rocket'); gh.knock(p.vel.clone().normalize(), 3); }
          }
        }
      }
      if (p.life <= 0) {
        g.scene.remove(o);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateZones(dt) {
    const g = this.g;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      z.tick -= dt;
      if (z.kind === 'incense') {
        // 연기와 금빛 입자
        if (Math.random() < 0.7) g.fx.smokePuff(z.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xd9d2c4, 2, z.r * 1.4, 0.5, 3, 2.2, 0.22);
        if (Math.random() < 0.8) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * z.r;
          g.fx.glow.emit(z.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0.2, Math.sin(a) * r)), new THREE.Vector3(0, 0.8 + Math.random(), 0), new THREE.Color(0xffd27a), 1.5, 0.18, 0.02, 1, 0, 0.2);
        }
        if (z.tick <= 0) {
          z.tick = 0.5;
          for (const gh of g.ghosts.list) {
            if (gh.alive && gh.pos.distanceTo(z.pos) < z.r + gh.radius) {
              gh.damage(8, 'incense');
              gh.slowFor(0.6, 0.5);
            }
          }
          const P = g.player;
          if (P.pos.distanceTo(z.pos) < z.r) P.heal(3);
        }
        if (z.model) z.model.rotation.y += dt * 0.3;
      }
      if (z.life <= 0) {
        if (z.model) g.scene.remove(z.model);
        this.zones.splice(i, 1);
      }
    }
  }

  clearTransient() {
    for (const p of this.projectiles) this.g.scene.remove(p.obj);
    for (const z of this.zones) if (z.model) this.g.scene.remove(z.model);
    this.projectiles.length = 0;
    this.zones.length = 0;
  }
}
