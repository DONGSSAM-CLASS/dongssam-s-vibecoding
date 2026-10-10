import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { settings, loadSettings, QUALITY } from './settings.js';
import { L, isIndoor } from './layout.js';
import { U, updateNightGlow } from './materials.js';
import { Sky } from './sky.js';
import { buildWorld } from './world.js';
import { buildSchool } from './school.js';
import { buildVegetation } from './vegetation.js';
import { Player } from './player.js';
import { FX } from './fx.js';
import { Weather } from './weather.js';
import { Ghosts } from './ghosts.js';
import { Relics, RELICS } from './relics.js';
import { Interactables } from './interact.js';
import { Inventory } from './inventory.js';
import { Quest } from './quest.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { initInput, input, lock, unlock, endFrame, hit } from './input.js';
import * as TX from './textures.js';
import { defaultPortrait } from './student.js';
import { loadStudentModels } from './models.js';
import { clamp } from './util.js';

const SAVE_KEY = 'bundong3d.save';
const $ = (id) => document.getElementById(id);
const tick = () => new Promise((r) => setTimeout(r, 0));

class Game {
  constructor() {
    this.state = 'loading';
    this.stats = { purified: 0, skills: 0, time: 0 };
    this.testMode = new URLSearchParams(location.search).has('test');
    this.godMode = false;
    this.gender = null;
    this.playerName = '';
    this.photos = { male: null, female: null };
  }

  async init() {
    loadSettings();
    const q = (this.q = QUALITY[settings.quality] || QUALITY.medium);
    this.ui = new UI(this);
    this.ui.loading(0.02, '글꼴을 불러오는 중…');
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); await document.fonts.load('900 40px "Noto Serif KR"'); } catch (e) { /* 기본 글꼴 */ }

    // 렌더러
    const canvas = $('game');
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = (this.scene = new THREE.Scene());

    this.audio = new AudioEngine();
    this.audio.setVolume(settings.volume);
    initInput(canvas);
    input.onUnlock = () => this.onPointerUnlock();
    input.onFallback = () => this.ui.toast('마우스 잠금을 쓸 수 없는 환경입니다 — 화면을 끌어서 둘러보고, 클릭하면 유물을 씁니다. 메뉴는 P 키', '', 5000);

    this.ui.loading(0.08, '하늘과 해를 띄우는 중…');
    await tick();
    this.sky = new Sky(renderer, scene);
    this.sky.dayLength = settings.dayLength;
    this.sky.setShadow(q.shadowMap, q.shadowRange);

    this.ui.loading(0.18, '운동장을 고르는 중…');
    await tick();
    this.world = buildWorld(scene, q);
    this.ui.loading(0.38, '번동중학교 본관을 짓는 중…');
    await tick();
    this.school = buildSchool(scene);
    this.ui.loading(0.55, '소나무와 등나무를 심는 중…');
    await tick();
    this.veg = buildVegetation(scene, q);

    this.ui.loading(0.68, '학생과 유물을 준비하는 중…');
    await tick();
    this.fx = new FX(scene);
    this.weather = new Weather(scene);
    this.player = new Player(this);
    this.sky.sun.shadow.camera.layers.enable(1);
    this.relics = new Relics(this);
    await this.relics.loadOverrides();
    this.studentModels = await loadStudentModels();
    this.relics.renderIcons();
    this.inventory = new Inventory(this);
    this.ghosts = new Ghosts(this);
    this.quest = new Quest(this);
    this.ui.loading(0.8, '상자와 가방을 숨기는 중…');
    await tick();
    this.interact = new Interactables(this, this.world, this.school);
    this.ui.buildMapBase(TX.yardTexture(1024));

    // 실내등·가로등 빛 묶음(가까운 곳에만 실제 빛을 배치)
    this.indoorLights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xf4f6ff, 0, 11, 1.6);
      scene.add(l);
      this.indoorLights.push(l);
    }
    this.lampLights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.SpotLight(0xffd9a0, 0, 26, 1.0, 0.6, 1.4);
      scene.add(l, l.target);
      this.lampLights.push(l);
    }

    // 후처리
    this.ui.loading(0.9, '빛을 다듬는 중…');
    await tick();
    const composer = (this.composer = new EffectComposer(renderer));
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
    this.mainPass = new RenderPass(scene, this.player.camera);
    composer.addPass(this.mainPass);
    const vm = new RenderPass(this.player.vmScene, this.player.vmCamera);
    vm.clear = false;
    vm.clearDepth = true;
    this.vmPass = vm;
    composer.addPass(vm);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.55, 0.92);
    this.bloom.enabled = q.bloom;
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.fx.setScale(innerHeight);

    addEventListener('resize', () => this.onResize());
    this.bindUI();
    this.weather.setMode(settings.weather === 'auto' ? 'auto' : settings.weather);
    this.weather.set(settings.weather === 'auto' ? 'clear' : settings.weather, true);

    // 첫 화면: 영상처럼 운동장 동쪽 끝에서 천천히 둘러보기
    this.titleT = 0;
    this.sky.hours = 8.33;
    this.sky.updateEnv();
    // 셰이더 미리 컴파일
    renderer.compile(scene, this.player.camera);
    this.ui.loading(1, '준비 완료');
    await tick();
    this.state = 'title';
    this.ui.show('title');
    if (this.loadSave(true)) $('btnContinue').classList.remove('hidden');
    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.frame());
    window.__game = this;
  }

  applyQuality() {
    const q = (this.q = QUALITY[settings.quality] || QUALITY.medium);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.onResize();
    this.sky.setShadow(q.shadowMap, q.shadowRange);
    this.bloom.enabled = q.bloom;
  }

  onResize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.player.camera.aspect = w / h;
    this.player.camera.updateProjectionMatrix();
    this.fx.setScale(h);
  }

  // ---------- UI 연결 ----------
  bindUI() {
    const ui = this.ui;
    ui.bindSettings();
    $('btnNew').onclick = () => { this.audio.init(); this.newGame = true; this.openSelect(); };
    $('btnContinue').onclick = () => { this.audio.init(); this.newGame = false; this.continueGame(); };
    $('btnHowTitle').onclick = () => $('howTitle').classList.remove('hidden');
    $('btnBackTitle').onclick = () => { this.state = 'title'; ui.show('title'); };
    $('btnStart').onclick = () => this.startGame();
    $('btnResume').onclick = () => this.resume();
    $('btnSave').onclick = () => { this.save(); ui.toast('저장했습니다'); };
    $('btnToTitle').onclick = () => location.reload();
    $('btnRespawn').onclick = () => this.respawn();
    $('btnFreeRoam').onclick = () => { ui.hide('victory'); this.resume(); };
    $('btnVictoryTitle').onclick = () => location.reload();
    $('modalOk').onclick = () => { ui.closeModal(); };
    $('clickToPlay').onclick = () => { if (this.state === 'play') lock(); else this.resume(); };
    $('game').addEventListener('click', () => { if (this.state === 'play' && !input.locked && !this.testMode) lock(); });

    // 캐릭터 선택
    for (const g of ['male', 'female']) {
      const img = document.querySelector(`[data-photo="${g}"]`);
      img.src = defaultPortrait(g, 'card');
      try { const saved = localStorage.getItem('bundong3d.photo.' + g); if (saved) { this.photos[g] = saved; img.src = saved; } } catch (e) { /* 무시 */ }
      const input2 = document.querySelector(`[data-upload="${g}"]`);
      input2.onchange = () => {
        const f = input2.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          this.shrinkPhoto(rd.result, (url) => {
            this.photos[g] = url;
            img.src = url;
            try { localStorage.setItem('bundong3d.photo.' + g, url); } catch (e) { /* 용량 초과 */ }
          });
        };
        rd.readAsDataURL(f);
      };
    }
    document.querySelectorAll('.sel-card').forEach((c) => {
      c.onclick = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
        document.querySelectorAll('.sel-card').forEach((x) => x.classList.toggle('on', x === c));
        this.gender = c.dataset.gender;
        $('btnStart').disabled = false;
        this.audio.play('click');
      };
    });
    window.addEventListener('keydown', (e) => {
      // 메뉴가 처리한 키는 게임 입력으로 넘기지 않음
      if (this.state !== 'play') input.pressed.delete(e.code);
      if (e.code === 'Escape') {
        if (this.state === 'ui') {
          if (this.ui.isOpen('modal')) this.ui.closeModal();
          else this.ui.closePanels();
        } else if (this.state === 'paused') this.resume();
      }
      if (this.state === 'ui' && (e.code === 'KeyE' || e.code === 'Enter') && this.ui.isOpen('modal')) {
        e.preventDefault();
        setTimeout(() => this.ui.closeModal(), 0);
      }
      if (this.state === 'ui' && (e.code === 'KeyI' || e.code === 'Tab') && this.ui.isOpen('bag')) { e.preventDefault(); this.ui.closePanels(); input.pressed.delete(e.code); }
      if (this.state === 'ui' && e.code === 'KeyM' && this.ui.isOpen('mapPanel')) { this.ui.closePanels(); input.pressed.delete(e.code); }
    });
  }

  shrinkPhoto(url, cb) {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 480 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * s; c.height = img.height * s;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.85));
    };
    img.src = url;
  }

  openSelect() {
    this.state = 'select';
    this.ui.show('select');
    $('playerName').value = this.playerName || '';
  }

  startGame() {
    if (!this.gender) return;
    this.playerName = ($('playerName').value || '').trim() || '김번동';
    this.player.name = this.playerName;
    this.player.setGender(this.gender);
    this.interact.spawnFriend(this.gender);
    this.ui.setPlayer(this.playerName, this.gender, this.photos[this.gender]);
    const P = this.player;
    P.pos.set(L.spawn.x, 0, L.spawn.z);
    P.yaw = L.spawn.yaw;
    P.pitch = 0;
    this.sky.hours = 8.33;
    this.enterPlay();
    setTimeout(() => {
      this.ui.openModal(`<h2>프롤로그</h2>
        <div class="desc">10월의 맑은 아침, ${this.playerName}은(는) 번동중학교 운동장에 들어섰다.<br>
        그런데 역사교실의 '우리 역사 유물 특별전'에 놓여 있던 유물 일곱 점이 밤사이 사라지고,
        학교 곳곳에서 정체를 알 수 없는 <b>악령</b>이 깨어나기 시작했다.<br><br>
        유물에는 옛사람들이 담아 둔 힘이 깃들어 있다고 한다.
        <b>학교 곳곳에 숨은 유물을 찾아 그 힘으로 악령을 정화하고</b>, 악령의 우두머리를 다시 봉인하자!</div>
        <div class="skill">이동 <b>WASD</b> · 둘러보기 <b>마우스</b> · 상호작용 <b>E</b> · 가방 <b>I</b> · 지도 <b>M</b> · 메뉴 <b>Esc</b><br>
        첫 단서: 등나무 쉼터 쪽에서 이상한 기운이 느껴진다… (화면 위 나침반의 ◆ 표시를 따라가 보자)</div>`,
      () => this.ui.toast(`${this.playerName}, 번동중학교에 온 걸 환영해!`, 'big', 2600));
    }, 300);
  }

  continueGame() {
    if (!this.loadSave(false)) return this.openSelect();
    this.enterPlay();
    this.ui.toast('이어서 시작합니다', 'big');
  }

  enterPlay() {
    this.state = 'play';
    this.ui.show('hud');
    this.ui.refreshHotbar();
    this.ui.refreshConsumables();
    this.ui.refreshQuest();
    if (!this.testMode) lock();
  }

  resume() {
    if (this.player.dead) return;
    this.state = 'play';
    this.ui.show('hud');
    if (!this.testMode) lock();
  }

  pauseForUI(on) {
    if (on) {
      if (this.state === 'play') { this.state = 'ui'; unlock(); }
    } else if (this.state === 'ui') {
      if (this.ui.isOpen('modal') || this.ui.isOpen('bag') || this.ui.isOpen('mapPanel')) return;
      this.resume();
    }
  }

  onPointerUnlock() {
    if (this.state === 'play' || (input.fallback && this.state === 'play')) {
      this.state = 'paused';
      this.ui.show(['hud', 'pause']);
    }
  }

  // ---------- 진행 이벤트 ----------
  acquireRelic(id) {
    this.relics.give(id);
    this.audio.play('relic');
    this.fx.purify(this.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
    this.ui.relicCard(id);
    this.quest.onRelic(id);
    this.save();
  }

  onPlayerDeath() {
    if (this.inventory.count('bujeok')) {
      this.inventory.remove('bujeok');
      this.player.dead = false;
      this.player.hp = this.player.maxHp * 0.5;
      this.fx.purify(this.player.pos.clone().add(new THREE.Vector3(0, 1, 0)));
      this.ui.toast('🧧 부적이 타오르며 다시 일어났다!', 'big', 2200);
      this.audio.play('jade');
      return;
    }
    this.state = 'dead';
    unlock();
    this.ui.show(['hud', 'dead']);
  }

  respawn() {
    this.player.respawn();
    for (const gh of [...this.ghosts.list]) if (gh.type !== 'boss' && gh.pos.distanceTo(this.player.pos) < 25) { gh.alive = false; gh.dispose(); }
    this.ghosts.list = this.ghosts.list.filter((g) => g.alive);
    this.ui.toast('보건실에서 깨어났다. 조심하자!', '', 2500);
    this.resume();
  }

  startBoss() {
    this.quest.stage = 3;
    this.weather.forced = 'storm';
    if (this.sky.nightFactor < 0.5) this.sky.hours = 21.5;
    this.ghosts.clear();
    this.ghosts.spawnBoss();
    this.ui.toast('땅이 흔들린다… 어둑시니가 깨어났다!', 'big', 3000);
    this.ui.shake(0.6);
    this.ui.refreshQuest();
  }

  onBossDefeated() {
    this.quest.stage = 4;
    this.weather.forced = null;
    this.weather.set('clear');
    this.sky.hours = 6.0;
    this.ui.hideBoss();
    this.audio.play('victory');
    this.ghosts.clear();
    this.ghosts.enabled = false;
    this.relics.timeSlow = 0;
    this.ui.refreshQuest();
    this.save();
    const t = Math.round(this.stats.time / 60);
    setTimeout(() => {
      $('victoryText').innerHTML = `<p>동이 트며 번동중학교에 아침 햇살이 다시 비친다.</p>
        <p>정화한 악령 <b>${this.stats.purified}</b>마리 · 사용한 유물 스킬 <b>${this.stats.skills}</b>회 · 플레이 시간 <b>${t}</b>분</p>
        <p style="font-size:14px;color:#c9c2b2">일곱 유물은 다시 역사교실 진열장으로 돌아갈 것입니다. 유물 도감(I → 유물 도감)에서 다시 읽어 볼 수 있어요.</p>`;
      this.state = 'victory';
      unlock();
      this.ui.show(['hud', 'victory']);
    }, 2500);
  }

  // ---------- 저장 ----------
  save() {
    if (this.state === 'title' || this.state === 'loading') return;
    const P = this.player;
    const d = {
      v: 1, gender: this.gender, name: this.playerName,
      pos: [P.pos.x, P.pos.y, P.pos.z], yaw: P.yaw, hp: P.hp,
      hours: this.sky.hours, weather: this.weather.state,
      relics: [...this.relics.owned], current: this.relics.current,
      inv: this.inventory.serialize(), ia: this.interact.serialize(),
      quest: { stage: Math.min(this.quest.stage, 2), hints: this.quest.hintsRead }, stats: this.stats,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { /* 저장 불가 */ }
  }

  loadSave(peek) {
    let d;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || d.v !== 1) return false;
    if (peek) return true;
    this.gender = d.gender || 'male';
    this.playerName = d.name || '김번동';
    this.player.name = this.playerName;
    this.player.setGender(this.gender);
    this.interact.spawnFriend(this.gender);
    this.ui.setPlayer(this.playerName, this.gender, this.photos[this.gender]);
    const P = this.player;
    P.pos.set(...d.pos);
    if (isIndoor(P.pos.x, P.pos.z) === false && P.pos.y > 3) P.pos.y = 0;
    P.yaw = d.yaw; P.hp = Math.max(30, d.hp);
    this.sky.hours = d.hours;
    this.weather.set(d.weather || 'clear', true);
    for (const id of d.relics || []) this.relics.give(id, true);
    if (d.current >= 0) this.relics.select(d.current);
    this.inventory.load(d.inv || {});
    this.interact.load(d.ia || {});
    this.quest.stage = d.quest?.stage || 0;
    this.quest.hintsRead = !!d.quest?.hints;
    Object.assign(this.stats, d.stats || {});
    if (this.quest.stage >= 1) this.ghosts.enabled = true;
    if (this.quest.stage === 2) this.interact.enableSeal();
    return true;
  }

  // ---------- 매 프레임 ----------
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    U.uTime.value = t;
    const playing = this.state === 'play';
    const active = playing && (input.locked || input.fallback || this.testMode);
    const world = playing || this.state === 'ui' || this.state === 'paused' || this.state === 'dead' || this.state === 'victory';
    const running = playing || this.state === 'title' || this.state === 'select';
    const P = this.player;

    if (this.state === 'title' || this.state === 'select') this.updateTitleCam(dt);

    // 시간과 날씨는 일시정지 중에는 멈춤
    if (running) {
      const focus = playing ? P.pos : P.camera.position;
      this.sky.weather = { cloud: this.weather.cloud, storm: this.weather.storm, fog: this.weather.fog, flash: this.weather.flash, rain: this.weather.rain };
      this.sky.update(dt, focus, playing ? 1 : 0.4);
      this.weather.update(dt, P.camera, this);
      this.world.pond.update(dt);
    }
    if (playing) {
      this.stats.time += dt;
      P.update(dt, active);
      if (active) this.handleKeys();
      this.relics.update(dt, active);
      this.ghosts.update(dt, t);
      this.interact.update(dt, active);
      this.interact.updateSeal(dt);
      this.ui.update(dt);
      this._autosave = (this._autosave || 0) + dt;
      if (this._autosave > 60) { this._autosave = 0; this.save(); }
    } else if (world) {
      P.updateViewModel(0, 0, 0);
    }
    if (running || world) this.fx.update(running ? dt : 0);

    // 빛 묶음
    this.updateLightPools();
    const n = this.sky.nightFactor;
    const flicker = this.quest.stage === 3 ? 0.7 + Math.random() * 0.3 : 1;
    updateNightGlow(n, flicker);

    // 소리
    if (this.audio.ready) {
      const cam = P.camera;
      this.audio.setListener(cam.position, P.forward());
      this.audio.update(dt, {
        wind: this.weather.cur.wind, rain: this.weather.rain, indoor: playing && P.indoor ? 1 : 0,
        day: this.sky.dayFactor, night: n, boss: this.quest.stage === 3 ? 1 : 0,
      });
    }

    // 화면 흔들림
    const sh = this.ui.shakeAmt;
    if (sh > 0.001 && playing) {
      P.camera.position.x += (Math.random() - 0.5) * sh * 0.3;
      P.camera.position.y += (Math.random() - 0.5) * sh * 0.3;
      this.ui.shakeAmt *= Math.exp(-dt * 8);
    }
    this.vmPass.enabled = playing || this.state === 'ui' || this.state === 'paused';
    const needClick = playing && !active;
    if (needClick !== this._needClick) { this._needClick = needClick; $('clickToPlay').classList.toggle('hidden', !needClick); }
    this.composer.render(dt);
    endFrame();
  }

  handleKeys() {
    const ui = this.ui;
    if (hit('KeyI') || hit('Tab')) ui.openBag('items');
    else if (hit('KeyM')) ui.openMap();
    if (hit('KeyG')) this.inventory.use('pat');
    if (hit('KeyH')) this.inventory.use('ssuk');
    if (hit('KeyJ')) this.inventory.use('juk');
    if ((this.testMode || input.fallback) && hit('KeyP')) { this.state = 'play'; this.onPointerUnlock(); }
  }

  updateTitleCam(dt) {
    // 참고 영상의 카메라 움직임: 운동장(서) → 본관(북) → 계단탑·쉼터(동) → 소나무(남동)
    this.titleT += dt;
    const P = this.player;
    const cam = P.camera;
    const T = 26;
    const k = (Math.sin((this.titleT / T) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const yaw = 1.55 - k * 3.85;
    cam.position.set(37.5, 1.55 + Math.sin(this.titleT * 1.7) * 0.01, 23.5);
    cam.rotation.set(0.05, yaw, 0);
    P.yaw = yaw;
    P.pitch = 0.05;
  }

  updateLightPools() {
    const P = this.player;
    const pos = this.state === 'play' || this.state === 'ui' || this.state === 'paused' ? P.pos : P.camera.position;
    // 실내등: 플레이어가 실내에 있을 때 가까운 4개
    const fixtures = this.school.interior.lights;
    const inside = isIndoor(pos.x, pos.z);
    const flick = this.quest.stage === 3;
    if (inside) {
      const near = fixtures.map((f) => ({ f, d: (f.x - pos.x) ** 2 + (f.z - pos.z) ** 2 })).sort((a, b) => a.d - b.d).slice(0, 4);
      near.forEach((e, i) => {
        const l = this.indoorLights[i];
        l.position.set(e.f.x, e.f.y, e.f.z);
        l.intensity = 9 * (flick && Math.random() < 0.05 ? 0.2 : 1);
      });
    } else for (const l of this.indoorLights) l.intensity = 0;
    // 가로등: 밤에 가까운 3개
    const n = this.sky.nightFactor;
    const lamps = this.world.lamps;
    const near = lamps.map((p) => ({ p, d: p.distanceToSquared(pos) })).sort((a, b) => a.d - b.d).slice(0, 3);
    near.forEach((e, i) => {
      const l = this.lampLights[i];
      l.position.copy(e.p);
      l.target.position.set(e.p.x, 0, e.p.z);
      l.intensity = n * 90;
    });
  }
}

const game = new Game();
game.init().catch((e) => {
  console.error(e);
  const el = document.getElementById('loadText');
  if (el) el.textContent = '오류: ' + e.message + ' (Chrome/Edge 최신 버전에서 실행해 주세요)';
});
void clamp; void RELICS;
