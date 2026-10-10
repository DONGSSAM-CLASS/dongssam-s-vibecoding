import * as THREE from 'three';
import { L, isIndoor } from './layout.js';
import { addBox, addBoxC, addCyl, removeCollider, moveCyl } from './collision.js';
import { buildStudent, animateStudent, defaultPortrait } from './student.js';
import { instanceStudent, animateMeshyStudent } from './models.js';
import { hit } from './input.js';
import * as TX from './textures.js';
import { mulberry32 } from './util.js';
import { relicById } from './relics.js';

// 상호작용 물건: 상자(반닫이), 가방, 사물함, 쑥·팥 채집, 교실 문, 게시판, 연못, 해시계 받침돌, 진열장, 책장, 약품장, 봉인석
export function roomAt(x, z) {
  if (!isIndoor(x, z)) return 'outside';
  if (z > L.inside.corridor.z0) {
    if (x > -2 && x < 10) return 'lobby';
    return 'corridor';
  }
  for (const r of L.inside.rooms) if (x >= r.x0 && x < r.x1) return r.id;
  return 'corridor';
}

const BOARD_TEXT = {
  lobbyBoard: `【역사 선생님의 메모】

우리 학교 '역사 유물 특별전'을 준비하던 중, 유물들이 사라졌다.
악령이 깨어난 건 그때부터다. 유물들이 숨은 곳을 적어 둔다.

· 사인참사검 — 등나무 쉼터 꼭대기 단의 오래된 반닫이
· 다뉴세문경 — 소나무 정원 연못, 햇빛에 반짝이는 곳
· 백제 금동대향로 — 역사교실 가운데 진열장 (문이 잠김. 열쇠는 1학년 교실 분실물 가방에?)
· 곡옥 — 도서실 가운데 책장, 낡은 책 사이
· 비격진천뢰 — 운동장 서쪽 끝, 초록 철망 옆 반닫이
· 신기전 — 과학실 약품장
· 앙부일구 — 정문 화단의 받침돌. 해시계는 해가 떠 있어야 깨어난다.

일곱 유물이 모이면 운동장 한가운데 봉인석이 드러날 것이다.
그곳에서 악령의 우두머리 '어둑시니'를 불러내 물리쳐라.
※ 어둑시니는 올려다볼수록 커진다. 너무 쳐다보지 말 것!`,
  courtBoard: `【번동중 학생 안내】

요즘 해가 지면 학교에 이상한 것들이 떠돈다는 소문이 있습니다.

· 하얀 소복의 '원귀'는 원한의 구슬을 던집니다.
· 푸른 '도깨비불'은 빠르게 날아와 부딪힙니다.
· '그림자 악령'은 거의 보이지 않습니다. 손전등(F)이나 번개, 거울빛에 모습이 드러납니다.

팥과 쑥을 챙기고, 위험하면 팥죽을 쑤어 드세요.
등나무 쉼터 꼭대기에 무언가 오래된 상자가 있다는데…`,
};

export class Interactables {
  constructor(game, worldInfo, schoolInfo) {
    this.g = game;
    this.list = [];
    this.focus = null;
    this.rnd = mulberry32(2024);
    this.mats = {
      chestWood: new THREE.MeshStandardMaterial({ map: TX.toTex(TX.woodTexture([110, 52, 32]), { repeat: [1, 1] }), roughness: 0.55 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc9a046, metalness: 0.9, roughness: 0.35 }),
      ssuk: new THREE.MeshStandardMaterial({ map: TX.toTex(TX.leafTexture([150, 170, 130], 61, 120)), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }),
      patLeaf: new THREE.MeshStandardMaterial({ map: TX.toTex(TX.leafTexture([96, 140, 60], 62, 120)), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 }),
      pod: new THREE.MeshStandardMaterial({ color: 0x7a5a2e, roughness: 0.8 }),
      locker: new THREE.MeshStandardMaterial({ color: 0x9ab4cc, roughness: 0.4, metalness: 0.45 }),
      door: new THREE.MeshStandardMaterial({ map: TX.toTex(TX.woodTexture([170, 128, 84]), { repeat: [1, 1] }), roughness: 0.6 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xbfd8ea, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.4, depthWrite: false }),
      board: new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.8 }),
    };
    this.glowTex = this.makeGlow();
    this.build(worldInfo, schoolInfo);
  }

  makeGlow() {
    const c = TX.makeCanvas(64, 64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.4, 'rgba(255,210,120,0.4)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  add(o) {
    o.enabled = o.enabled ?? true;
    o.room = o.room ?? roomAt(o.pos.x, o.pos.z);
    this.list.push(o);
    return o;
  }

  // ---------- 모델 ----------
  chestMesh(x, y, z, ry) {
    const grp = new THREE.Group();
    const M = this.mats;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.52), M.chestWood);
    body.position.y = 0.25;
    grp.add(body);
    // 반닫이: 앞판 위쪽이 열리는 구조 → 여기선 뚜껑으로 표현
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.5, -0.26);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.07, 0.54), M.chestWood);
    lid.position.set(0, 0.035, 0.26);
    lidPivot.add(lid);
    grp.add(lidPivot);
    // 장석(놋쇠 장식)
    for (const sx of [-1, 1]) for (const sy of [0.06, 0.44]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.01), M.brass);
      c.position.set(sx * 0.42, sy, 0.265);
      grp.add(c);
    }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16), M.brass);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(0, 0.36, 0.27);
    grp.add(plate);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.015), M.brass);
    latch.position.set(0, 0.47, 0.28);
    lidPivot.add(latch);
    latch.position.set(0, -0.03, 0.54);
    for (const sx of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), M.brass);
      h.position.set(sx * 0.48, 0.32, 0);
      h.rotation.y = Math.PI / 2;
      grp.add(h);
    }
    grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    grp.position.set(x, y, z);
    grp.rotation.y = ry;
    this.g.scene.add(grp);
    return { grp, lidPivot };
  }

  bagMesh(x, y, z, ry, color) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.17), mat);
    body.position.y = 0.2;
    grp.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.32, 12, 1, false, 0, Math.PI), mat);
    top.rotation.z = Math.PI / 2;
    top.position.y = 0.4;
    grp.add(top);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.06), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.75), roughness: 0.8 }));
    pocket.position.set(0, 0.13, 0.11);
    grp.add(pocket);
    const strapM = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    for (const s of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.02), strapM);
      st.position.set(s * 0.09, 0.22, -0.095);
      grp.add(st);
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 10, Math.PI), strapM);
    handle.position.y = 0.48;
    grp.add(handle);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    grp.position.set(x, y, z);
    grp.rotation.y = ry;
    this.g.scene.add(grp);
    return { grp, mat };
  }

  herbMesh(x, z, kind) {
    const grp = new THREE.Group();
    const M = this.mats;
    const rnd = this.rnd;
    const n = kind === 'pat' ? 5 : 6;
    for (let i = 0; i < n; i++) {
      const s = kind === 'pat' ? 0.7 : 0.45;
      const g = new THREE.PlaneGeometry(s, s);
      const m = new THREE.Mesh(g, kind === 'pat' ? M.patLeaf : M.ssuk);
      m.position.set((rnd() - 0.5) * 0.3, s * 0.45 + rnd() * 0.1, (rnd() - 0.5) * 0.3);
      m.rotation.set((rnd() - 0.5) * 0.6, (i / n) * Math.PI, 0);
      m.castShadow = true;
      grp.add(m);
    }
    if (kind === 'pat') {
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.08, 3, 6), M.pod);
        p.position.set((rnd() - 0.5) * 0.4, 0.2 + rnd() * 0.35, (rnd() - 0.5) * 0.4);
        p.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        grp.add(p);
      }
    }
    grp.position.set(x, 0, z);
    this.g.scene.add(grp);
    return grp;
  }

  floatingRelic(id, x, y, z, beam = false) {
    const grp = new THREE.Group();
    const model = this.g.relics.build(id);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    model.scale.setScalar(Math.min(2.5, 0.45 / size * 1.6));
    const c = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    model.position.sub(c);
    grp.add(model);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffd890, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
    sp.scale.setScalar(1.3);
    grp.add(sp);
    if (beam) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      b.position.y = 3;
      grp.add(b);
    }
    grp.position.set(x, y, z);
    this.g.scene.add(grp);
    return grp;
  }

  // ---------- 배치 ----------
  build(W, S) {
    const g = this.g;
    const A = S.interior;
    const topH = L.stands.steps * L.stands.rise;

    // 1) 사인참사검: 등나무 쉼터 꼭대기 단 반닫이
    this.chest(65.35, topH, -12.3, -Math.PI / 2, { relic: 'sword' }, '오래된 반닫이');
    // 2) 다뉴세문경: 연못 속 반짝임
    {
      const p = L.pond;
      const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xfff6d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glint.position.set(p.x + 3.6, -0.05, p.z + 0.8);
      glint.scale.setScalar(0.8);
      g.scene.add(glint);
      const o = this.add({
        id: 'pond', kind: 'pond', pos: new THREE.Vector3(p.x + 4.8, 0.3, p.z + 0.8), r: 2.4, glint,
        label: () => '연못 속 반짝이는 것을 건지기',
        action: () => {
          o.enabled = false;
          g.scene.remove(glint);
          g.audio.footstep('water', 1.5);
          g.player.playAnim('gather', 0.7);
          g.acquireRelic('mirror');
        },
      });
    }
    // 3) 금동대향로: 역사교실 진열장
    {
      const hist = L.inside.rooms.find((r) => r.id === 'history');
      const cx = (hist.x0 + hist.x1) / 2, cz = (L.main.z0 + 0.2 + L.inside.corridor.z0 - 0.2) / 2;
      const fr = this.floatingRelic('censer', cx, 1.25, cz);
      const o = this.add({
        id: 'censerCase', kind: 'case', pos: new THREE.Vector3(cx, 1.1, cz), r: 2.0, model: fr,
        label: () => '진열장에서 백제 금동대향로 꺼내기',
        action: () => { o.enabled = false; g.scene.remove(fr); g.acquireRelic('censer'); },
      });
    }
    // 4) 곡옥: 도서실 가운데 책장
    {
      const sh = A.shelves[1];
      const o = this.add({
        id: 'shelf', kind: 'shelf', pos: new THREE.Vector3(sh.x - 1.2, 1.0, sh.z + 0.45), r: 2.0,
        label: () => '낡은 책들 사이를 살펴보기',
        action: () => { o.enabled = false; g.audio.play('door'); g.player.playAnim('gather', 0.6); g.acquireRelic('jade'); },
      });
      // 다른 책장은 쪽지
      const s0 = A.shelves[0];
      const o2 = this.add({
        id: 'shelf0', kind: 'shelf', pos: new THREE.Vector3(s0.x + 1.0, 1.0, s0.z + 0.45), r: 2.0,
        label: () => '책장 살펴보기',
        action: () => { o2.enabled = false; g.ui.board('『삼국사기』 사이에 끼워진 쪽지', '신라 사람들은 금관에 굽은 옥을 매달았다.\n누군가 곡옥 하나를 가운데 책장에 숨겨 두었다고 한다.'); },
      });
    }
    // 5) 비격진천뢰: 운동장 서쪽 끝 철망 옆
    this.chest(-48.4, 0, 13.5, Math.PI / 2, { relic: 'bomb' }, '철망 옆 반닫이');
    // 6) 신기전: 과학실 약품장
    {
      const c = A.cabinets[0];
      const o = this.add({
        id: 'cabinet', kind: 'cabinet', pos: new THREE.Vector3(c.x, 1.0, c.z), r: 1.8,
        label: () => '약품장 열어 보기',
        action: () => { o.enabled = false; g.audio.play('locker'); g.acquireRelic('rocket'); },
      });
    }
    // 7) 앙부일구: 정문 화단 받침돌(해가 떠 있을 때만)
    {
      const pd = W.pedestal;
      const fr = this.floatingRelic('sundial', pd.x, 1.35, pd.z);
      const o = this.add({
        id: 'pedestal', kind: 'pedestal', pos: new THREE.Vector3(pd.x, 1.2, pd.z), r: 2.4, model: fr,
        label: () => (this.sunUp() ? '받침돌 위의 앙부일구 들기' : '해시계가 잠들어 있다 (해가 뜨면 다시 오자)'),
        action: () => {
          if (!this.sunUp()) {
            g.audio.play('locked');
            g.ui.toast('영침에 그림자가 생기지 않는다… 해가 떠 있고 날이 맑을 때 다시 오자', 'warn', 2600);
            return;
          }
          o.enabled = false; g.scene.remove(fr); g.acquireRelic('sundial');
        },
      });
    }

    // ---------- 가방 ----------
    const deskBag = (room, idx, content, color) => {
      const ds = A.desks.filter((d) => d.room === room);
      const d = ds[idx % ds.length];
      this.bag(d.x, 0.74, d.z, this.rnd() * 6, content, color);
    };
    deskBag('c12', 6, [['key_history', 1], ['pat', 2]], 0xc0392b);
    deskBag('c11', 9, [['bigbag', 1], ['ssuk', 1]], 0x2e6fb5);
    deskBag('c11', 15, [['hanji', 1], ['pat', 1]], 0x3a3a3a);
    deskBag('c12', 13, [['meok', 1]], 0xd4a017);
    // 바깥 가방
    this.bag(59.3, 0.42 * 2, 2.0, 1.2, [['pat', 2], ['ssuk', 1]], 0x27ae60);
    this.bag(64.75, topH + 0.78, -16.5, 0.4, [['hanji', 1], ['meok', 1]], 0x8e44ad);
    this.bag(36.0, 0, 21.0, 2.0, [['pat', 1]], 0xe67e22);
    this.bag(-46.5, 0, -28, 0.3, [['ssuk', 2]], 0x34495e);

    // 그 밖의 반닫이(소모품)
    this.chest(95.0, 0, 30.0, -Math.PI / 2, { items: [['pat', 3], ['hanji', 1]] }, '광장 구석의 반닫이');
    this.chest(-44.0, 0, 38.5, 0.3, { items: [['ssuk', 2], ['meok', 1]] }, '화단 반닫이');
    this.chest(55.0, 0, -40.5, Math.PI, { items: [['pat', 2], ['ssuk', 2]] }, '동관 앞 반닫이');

    // ---------- 사물함(복도) ----------
    const lockers = A.lockers;
    const pick = [3, 9, 17, 24, 31, 38, 44, 52, 57, 63];
    const contents = [[['pat', 1]], [], [['ssuk', 1]], [['hanji', 1]], [], [['pat', 2]], [['meok', 1]], [], [['ssuk', 1], ['pat', 1]], [['pat', 1]]];
    pick.forEach((li, k) => {
      const lk = lockers[li % lockers.length];
      if (!lk) return;
      const pivot = new THREE.Group();
      pivot.position.set(lk.x - 0.29, 0.9, lk.z + 0.235);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.76, 0.025), this.mats.locker);
      door.position.x = 0.29;
      pivot.add(door);
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      tag.position.set(0.29, 0.5, 0.014);
      pivot.add(tag);
      this.g.scene.add(pivot);
      const o = this.add({
        id: 'locker' + k, kind: 'locker', pos: new THREE.Vector3(lk.x, 1.0, lk.z + 0.3), r: 1.6, room: 'corridor', pivot, content: contents[k], open: false,
        label: () => (o.open ? (o.content.length ? '사물함 뒤지기' : '빈 사물함') : '사물함 열기'),
        action: () => {
          if (!o.open) { o.open = true; o.anim = 0; g.audio.play('locker'); }
          if (o.content.length) { this.giveItems(o.content); o.content = []; }
          else g.ui.toast('텅 비어 있다');
        },
      });
    });

    // ---------- 채집: 쑥(정원·화단), 팥(텃밭) ----------
    const ssukSpots = [[72, 2], [76, -18], [82, 10], [88, -30], [93, 8], [70, -28], [-40, 36], [-20, 40], [30, 38], [45, 34], [86, 18], [74, 20]];
    ssukSpots.forEach(([x, z], k) => this.herb(x, z, 'ssuk', k));
    // 학교 텃밭(정문 서쪽)
    const garden = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 5), new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 1 }));
    garden.position.set(-12, 0.12, 39);
    garden.receiveShadow = true;
    g.scene.add(garden);
    addBoxC(-12, 39, 10, 5, 0, 0.25);
    const sign = this.signMesh('학교 텃밭 — 팥', -12, 41.8);
    void sign;
    for (let i = 0; i < 6; i++) this.herb(-16 + (i % 3) * 4, 38 + Math.floor(i / 3) * 2, 'pat', 100 + i, 0.25);

    // ---------- 교실 문 ----------
    for (const d of A.doors) this.door(d);
    // 중앙현관 자동문
    this.autoDoor();

    // ---------- 게시판 ----------
    this.boardAt('lobbyBoard', -1.85, 1.6, -46, Math.PI / 2, true);
    this.boardAt('courtBoard', 47.5, 1.4, 23.5, Math.PI + 0.6, false);

    // ---------- 봉인석(운동장 중앙) ----------
    {
      const c = L.sealStone;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x6d6a62, roughness: 0.8 }));
      const tc = TX.makeCanvas(128, 256);
      const ctx = tc.getContext('2d');
      ctx.fillStyle = '#6d6a62'; ctx.fillRect(0, 0, 128, 256);
      ctx.fillStyle = '#e8c478'; ctx.font = '900 40px "Noto Serif KR", serif'; ctx.textAlign = 'center';
      '封印石'.split('').forEach((ch, i) => ctx.fillText(ch, 64, 70 + i * 60));
      stone.material = [stone.material, stone.material, stone.material, stone.material, new THREE.MeshStandardMaterial({ map: TX.toTex(tc), roughness: 0.8, emissive: 0x6a4a10, emissiveIntensity: 0.4 }), stone.material];
      stone.position.set(c.x, -2.5, c.z);
      stone.castShadow = true;
      g.scene.add(stone);
      this.seal = stone;
      const o = this.add({
        id: 'seal', kind: 'seal', pos: new THREE.Vector3(c.x, 1.2, c.z), r: 2.6, enabled: false,
        label: () => '봉인석에 일곱 유물의 힘을 모으기 (보스전 시작)',
        action: () => { o.enabled = false; g.startBoss(); },
      });
      this.sealIa = o;
    }
  }

  sunUp() {
    const g = this.g;
    return g.sky.sunElev > 0.08 && g.weather.cloud < 0.7;
  }

  signMesh(text, x, z) {
    const c = TX.makeCanvas(256, 96);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2ead8'; ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#2a4a2a'; ctx.font = '700 30px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(text, 128, 60);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), new THREE.MeshStandardMaterial({ map: TX.toTex(c), roughness: 0.8 }));
    m.position.set(x, 0.9, z);
    this.g.scene.add(m);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), this.mats.board);
    post.position.set(x, 0.45, z - 0.02);
    this.g.scene.add(post);
    return m;
  }

  chest(x, y, z, ry, content, name) {
    const { grp, lidPivot } = this.chestMesh(x, y, z, ry);
    const w = Math.abs(Math.sin(ry)) > 0.5 ? [0.52, 0.95] : [0.95, 0.52];
    const col = addBoxC(x, z, w[0], w[1], y, y + 0.55, 'ia');
    const o = this.add({
      id: 'chest_' + x + '_' + z, kind: 'chest', pos: new THREE.Vector3(x, y + 0.5, z), r: 2.2, grp, lidPivot, content, open: false, col,
      label: () => (o.open ? '빈 반닫이' : `${name} 열기`),
      action: () => {
        if (o.open) { this.g.ui.toast('이미 비어 있다'); return; }
        o.open = true;
        o.anim = 0;
        this.g.audio.play('chest');
        setTimeout(() => {
          if (o.content.relic) this.g.acquireRelic(o.content.relic);
          if (o.content.items) this.giveItems(o.content.items);
        }, 450);
      },
    });
    if (content.relic) o.sparkle = true;
    return o;
  }

  bag(x, y, z, ry, content, color) {
    const { grp, mat } = this.bagMesh(x, y, z, ry, color);
    const o = this.add({
      id: 'bag_' + x.toFixed(1) + '_' + z.toFixed(1), kind: 'bag', pos: new THREE.Vector3(x, y + 0.25, z), r: 1.9, grp, content, looted: false,
      label: () => (o.looted ? '빈 가방' : '책가방 뒤져 보기'),
      action: () => {
        if (o.looted) { this.g.ui.toast('아무것도 없다'); return; }
        o.looted = true;
        mat.color.multiplyScalar(0.7);
        this.g.player.playAnim('gather', 0.5);
        this.g.audio.play('gather');
        this.giveItems(o.content);
      },
    });
    return o;
  }

  herb(x, z, kind, k, y = 0) {
    const grp = this.herbMesh(x, z, kind);
    grp.position.y = y;
    const o = this.add({
      id: 'herb_' + kind + k, kind: 'herb', herb: kind, pos: new THREE.Vector3(x, y + 0.4, z), r: 1.8, grp, regrow: 0,
      label: () => (kind === 'pat' ? '팥 꼬투리 따기' : '쑥 캐기'),
      action: () => {
        if (!this.g.inventory.add(kind, kind === 'pat' ? 2 : 1, kind === 'pat' ? '🫘 팥 꼬투리를 땄다 (+2)' : '🌿 쑥을 캤다 (+1)')) return;
        this.g.player.playAnim('gather', 0.6);
        this.g.audio.play('gather');
        o.enabled = false;
        grp.visible = false;
        o.regrow = 120; // 게임 속 약 4시간 뒤 다시 자람
      },
    });
    return o;
  }

  door(d) {
    const M = this.mats;
    const grp = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(d.w, 2.25, 0.06), M.door);
    panel.position.y = 1.125;
    grp.add(panel);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(d.w * 0.6, 0.6), M.glass);
    win.position.set(0, 1.6, 0.035);
    grp.add(win);
    const win2 = win.clone();
    win2.position.z = -0.035;
    grp.add(win2);
    const plate = TX.makeCanvas(128, 48);
    const ctx = plate.getContext('2d');
    ctx.fillStyle = '#1f3a5f'; ctx.fillRect(0, 0, 128, 48);
    ctx.fillStyle = '#fff'; ctx.font = '700 22px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.room.name, 64, 32);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22), new THREE.MeshBasicMaterial({ map: TX.toTex(plate) }));
    sign.position.set(0, 2.55, 0.12);
    grp.add(sign);
    grp.position.set(d.x, 0, d.z + 0.08);
    this.g.scene.add(grp);
    const col = addBox(d.x - d.w / 2, d.x + d.w / 2, d.z - 0.1, d.z + 0.15, 0, 2.3, 'door');
    const o = this.add({
      id: 'door_' + d.room.id, kind: 'door', pos: new THREE.Vector3(d.x, 1.2, d.z), r: 2.0, room: 'any', grp, panelX: d.x, w: d.w, open: false, locked: d.locked, col, anim: 0,
      label: () => (o.locked ? `${d.room.name} — 잠겨 있다` : o.open ? `${d.room.name} 문 닫기` : `${d.room.name} 문 열기`),
      action: () => {
        if (o.locked) {
          if (this.g.inventory.count('key_history')) {
            o.locked = false;
            this.g.inventory.remove('key_history');
            this.g.ui.toast('🗝 역사교실 문이 열렸다!', 'big', 2000);
            this.g.audio.play('quest');
          } else {
            this.g.audio.play('locked');
            this.g.ui.toast('잠겨 있다. 열쇠가 필요하다 (1학년 교실을 찾아보자)', 'warn', 2400);
            return;
          }
        }
        o.open = !o.open;
        this.g.audio.play('door');
        if (o.open) removeCollider(o.col);
        else o.col = addBox(d.x - d.w / 2, d.x + d.w / 2, d.z - 0.1, d.z + 0.15, 0, 2.3, 'door');
      },
    });
  }

  autoDoor() {
    const z = L.entrance.z1 - 0.12;
    const panels = [];
    for (const [x0, dir] of [[3, -1], [5, 1]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2.9, 0.04), this.mats.glass);
      m.position.set(x0, 1.45, z);
      m.renderOrder = 3;
      this.g.scene.add(m);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.3 }));
      frame.position.y = -1.42;
      m.add(frame);
      panels.push({ m, x0, dir });
    }
    this.auto = { panels, open: 0, col: addBox(2, 6, z - 0.1, z + 0.1, 0, 3, 'door'), z };
  }

  boardAt(id, x, y, z, ry, indoor) {
    const grp = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 0.08), this.mats.board);
    grp.add(frame);
    const c = TX.makeCanvas(512, 320);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b8935f'; ctx.fillRect(0, 0, 512, 320);
    const papers = [['#fffbe8', 20, 20, 200, 150], ['#e8f4ff', 240, 30, 240, 120], ['#fff', 40, 190, 180, 110], ['#ffeef0', 260, 170, 220, 130]];
    for (const [col, px, py, pw, ph] of papers) {
      ctx.fillStyle = col; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(px + pw / 2, py + 8, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#555';
      for (let l = 0; l < 5; l++) ctx.fillRect(px + 14, py + 30 + l * 18, pw - 28 - (l % 2) * 30, 4);
    }
    ctx.fillStyle = '#7a1f1f'; ctx.font = '900 34px "Noto Serif KR", serif';
    ctx.fillText(id === 'lobbyBoard' ? '역사 선생님의 메모' : '학생 안내', 30, 175);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.2), new THREE.MeshStandardMaterial({ map: TX.toTex(c), roughness: 0.9 }));
    face.position.z = 0.045;
    grp.add(face);
    if (!indoor) {
      for (const s of [-0.85, 0.85]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 8), this.mats.board);
        p.position.set(s, -0.6, -0.05);
        grp.add(p);
      }
      addBoxC(x, z, 1.0, 1.0, 0, 2);
    }
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    grp.position.set(x, y, z);
    grp.rotation.y = ry;
    this.g.scene.add(grp);
    const dir = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const o = this.add({
      id, kind: 'board', pos: new THREE.Vector3(x, y, z).addScaledVector(dir, 0.3), r: 2.6, room: indoor ? 'lobby' : 'outside',
      label: () => '게시판 읽기',
      action: () => {
        this.g.ui.board(id === 'lobbyBoard' ? '본관 1층 게시판' : '다목적 코트 게시판', BOARD_TEXT[id]);
        if (id === 'lobbyBoard') this.g.quest.onReadHints();
      },
    });
    return o;
  }

  giveItems(list) {
    const inv = this.g.inventory;
    for (const [id, n] of list) {
      if (id === 'bigbag') { inv.upgradeBag(); continue; }
      inv.add(id, n);
    }
  }

  // ---------- 매 프레임 ----------
  // 같은 반 친구(선택하지 않은 쪽 학생): 운동장 동쪽 끝에서 기다리며 단서를 알려 줌
  spawnFriend(playerGender) {
    const g = this.g;
    if (this.friend) { g.scene.remove(this.friend.model); removeCollider(this.friend.col); this.list.splice(this.list.indexOf(this.friend.ia), 1); }
    const gender = playerGender === 'male' ? 'female' : 'male';
    const name = gender === 'male' ? '최서준' : '이하윤';
    // Meshy 모델이 있으면 그것을, 없으면 코드로 만든 학생 모델을 씀
    const meshy = g.studentModels && g.studentModels[gender];
    const model = meshy ? instanceStudent(meshy) : buildStudent(gender, { name });
    model.traverse((o) => { if (o.isMesh) o.layers.enable(1); });
    const x = 35.2, z = 20.4;
    model.position.set(x, 0, z);
    g.scene.add(model);
    const col = addCyl(x, z, 0.3, 0, 1.7);
    const lines = () => {
      const st = g.quest.stage;
      if (st === 0) return '너도 봤어? 어젯밤부터 <b>등나무 쉼터 꼭대기 단</b>에 있는 오래된 반닫이에서 이상한 빛이 새어 나온대.<br>난 무서워서 못 가겠어… 네가 한번 열어 봐 줄래?';
      if (st === 1 && !g.quest.hintsRead) return '악령이 정말 나타났어! <b>본관 중앙현관 게시판</b>에 역사 선생님 메모가 붙어 있대. 유물이 숨은 곳이 적혀 있을 거야.<br>그리고 악령은 햇빛 아래에서 조금 약해진대.';
      if (st === 1) return `벌써 유물을 ${g.relics.owned.size}개나 찾았구나! 밤에는 악령이 더 많아지니까 <b>팥</b>이랑 <b>쑥</b>을 꼭 챙겨.<br>팥 3개에 쑥 1개면 <b>팥죽</b>도 만들 수 있어 (가방 I).`;
      if (st === 2 || st === 3) return '운동장 한가운데에 봉인석이 솟았어! 어둑시니는 <b>쳐다볼수록 커진대</b>.<br>신기전이나 금동대향로처럼 보지 않고도 맞힐 수 있는 유물을 써 봐!';
      return '고마워! 네 덕분에 학교에 다시 아침이 왔어. 유물 도감(I)에서 유물 이야기를 다시 읽어 보자.';
    };
    const ia = this.add({
      id: 'friend', kind: 'npc', pos: new THREE.Vector3(x, 1.4, z), r: 2.6, room: 'outside',
      label: () => `${name}에게 말 걸기`,
      action: () => {
        g.audio.play('click');
        g.ui.openModal(`<div class="talk"><img src="${defaultPortrait(gender, 'face')}" alt="${name}"><div><div class="meta">같은 반 친구</div><h2 style="font-size:24px;margin:2px 0 8px">${name}</h2><div class="desc" style="margin:0">${lines()}</div></div></div>`);
      },
    });
    this.friend = { model, col, ia, phase: 0, homeX: x, walkDirection: -1 };
  }

  update(dt, active) {
    // 친구: 가까이 오면 멈추고 바라봄. GLB 친구는 운동장 가장자리를 짧게 걸음
    if (this.friend) {
      const f = this.friend, P = this.g.player;
      f.phase += dt;
      const dx = P.pos.x - f.model.position.x, dz = P.pos.z - f.model.position.z;
      let speed = 0;
      if (f.model.userData.meshy?.walk && Math.hypot(dx, dz) > 4.5 && this.g.quest.stage < 3) {
        if (f.model.position.x <= f.homeX - 1.2) f.walkDirection = 1;
        if (f.model.position.x >= f.homeX + 1.2) f.walkDirection = -1;
        const before = f.model.position.x;
        f.model.position.x = THREE.MathUtils.clamp(before + f.walkDirection * dt * 0.65, f.homeX - 1.2, f.homeX + 1.2);
        speed = Math.abs(f.model.position.x - before) / Math.max(dt, 0.001);
        moveCyl(f.col, f.model.position.x, f.model.position.z);
        f.ia.pos.x = f.model.position.x;
        f.ia.pos.z = f.model.position.z;
      }
      const want = speed > 0.01 ? f.walkDirection * Math.PI / 2 : Math.hypot(dx, dz) < 12 ? Math.atan2(dx, dz) : -2.2;
      let d = want - f.model.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      f.model.rotation.y += d * Math.min(1, dt * 2.5);
      if (f.model.userData.meshy) animateMeshyStudent(f.model, dt, speed);
      else {
        animateStudent(f.model, f.phase * 0.8, 0.04, 0);
        f.model.userData.headG.rotation.x = Math.sin(f.phase * 0.7) * 0.04;
      }
    }
    const g = this.g, P = g.player;
    const eye = P.eyePos;
    const f = P.forward(new THREE.Vector3());
    const myRoom = roomAt(P.pos.x, P.pos.z);
    let best = null, bs = -1;
    for (const o of this.list) {
      // 애니메이션
      if (o.kind === 'chest' && o.open && o.anim < 1) { o.anim = Math.min(1, o.anim + dt * 2.2); o.lidPivot.rotation.x = -1.7 * easeOut(o.anim); }
      if (o.kind === 'locker' && o.open && o.anim < 1) { o.anim = Math.min(1, o.anim + dt * 3); o.pivot.rotation.y = -1.9 * easeOut(o.anim); }
      if (o.kind === 'door') {
        const target = o.open ? 1 : 0;
        o.anim += (target - o.anim) * Math.min(1, dt * 6);
        o.grp.position.x = o.panelX - o.w * 0.95 * o.anim;
      }
      if (o.kind === 'herb' && !o.enabled) {
        o.regrow -= dt * (24 / g.sky.dayLength) * 60 / 2;
        if (o.regrow <= 0) { o.enabled = true; o.grp.visible = true; }
      }
      if ((o.kind === 'case' || o.kind === 'pedestal') && o.enabled && o.model) {
        o.model.rotation.y += dt * 0.8;
        o.model.position.y = o.pos.y + 0.15 + Math.sin(performance.now() * 0.002) * 0.05;
      }
      if (o.sparkle && !o.open && Math.random() < dt * 3) g.fx.trail(o.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, Math.random() * 0.4, (Math.random() - 0.5) * 0.5)), 0xffe2a0, 0.12, 1.2);
      if (o.kind === 'pond' && o.enabled) o.glint.material.opacity = 0.5 + Math.sin(performance.now() * 0.004) * 0.4 * g.sky.dayFactor;

      // 바라보는 물건 고르기
      if (!o.enabled || !active) continue;
      if (o.room !== 'any' && o.room !== myRoom && !(o.room === 'lobby' && myRoom === 'corridor') && !(o.room === 'corridor' && myRoom === 'lobby')) continue;
      const d = o.pos.distanceTo(eye);
      if (d > o.r + 0.6) continue;
      const dir = o.pos.clone().sub(eye).normalize();
      const dot = dir.dot(f);
      const need = d < 1.2 ? 0.55 : 0.82;
      if (dot < need) continue;
      const score = dot - d * 0.05;
      if (score > bs) { bs = score; best = o; }
    }
    // 자동문
    if (this.auto) {
      const near = Math.abs(P.pos.x - 4) < 4 && Math.abs(P.pos.z - this.auto.z) < 3.2;
      const want = near ? 1 : 0;
      const prev = this.auto.open;
      this.auto.open += (want - this.auto.open) * Math.min(1, dt * 4);
      for (const p of this.auto.panels) p.m.position.x = p.x0 + p.dir * 1.9 * this.auto.open;
      if (prev < 0.5 && this.auto.open >= 0.5) { removeCollider(this.auto.col); g.audio.play('door'); }
      if (prev >= 0.5 && this.auto.open < 0.5) this.auto.col = addBox(2, 6, this.auto.z - 0.1, this.auto.z + 0.1, 0, 3, 'door');
    }
    this.focus = best;
    g.ui.prompt(best ? best.label() : null);
    if (best && active && hit('KeyE')) best.action();
  }

  enableSeal() {
    this.sealIa.enabled = true;
    this.sealRise = true;
  }

  updateSeal(dt) {
    if (this.sealRise && this.seal.position.y < 1.2) {
      this.seal.position.y = Math.min(1.2, this.seal.position.y + dt * 0.6);
      if (Math.random() < 0.5) this.g.fx.smokePuff(new THREE.Vector3(this.seal.position.x, 0.2, this.seal.position.z), 0x8a7a60, 2, 1.5, 0.4, 1.5, 1.2, 0.4);
      if (this.seal.position.y >= 1.2 && !this.sealCol) this.sealCol = addBoxC(this.seal.position.x, this.seal.position.z, 1.1, 0.5, 0, 2.4);
    }
  }

  serialize() {
    const s = {};
    for (const o of this.list) {
      if (o.kind === 'chest') s[o.id] = o.open ? 1 : 0;
      else if (o.kind === 'bag') s[o.id] = o.looted ? 1 : 0;
      else if (o.kind === 'locker') s[o.id] = o.open ? 1 : 0;
      else if (o.kind === 'door') s[o.id] = o.locked ? 0 : 1;
      else if (['pond', 'case', 'shelf', 'cabinet', 'pedestal'].includes(o.kind)) s[o.id] = o.enabled ? 0 : 1;
    }
    return s;
  }

  load(s) {
    for (const o of this.list) {
      if (!s[o.id]) continue;
      if (o.kind === 'chest') { o.open = true; o.anim = 1; o.lidPivot.rotation.x = -1.7; }
      else if (o.kind === 'bag') { o.looted = true; }
      else if (o.kind === 'locker') { o.open = true; o.anim = 1; o.pivot.rotation.y = -1.9; o.content = []; }
      else if (o.kind === 'door') { o.locked = false; }
      else {
        o.enabled = false;
        if (o.model) this.g.scene.remove(o.model);
        if (o.glint) this.g.scene.remove(o.glint);
      }
    }
  }
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
export { relicById };
