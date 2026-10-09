import * as THREE from 'three';
import { L } from './layout.js';
import { RELICS } from './relics.js';

// 이야기 진행: 0 첫 유물 → 1 유물 모으기·악령 정화 → 2 봉인석 → 3 보스전 → 4 승리
const HINT_POS = {
  sword: [65.3, -12.3], mirror: [88.6, -1.2], censer: [25, -47.7], jade: [14.3, -48.5],
  bomb: [-48.4, 13.5], rocket: [-23.2, -51.8], sundial: [14, 37],
};

export class Quest {
  constructor(game) {
    this.g = game;
    this.stage = 0;
    this.hintsRead = false;
  }

  get relicCount() { return this.g.relics.owned.size; }

  objectives() {
    const n = this.relicCount, k = this.g.stats.purified;
    const list = [];
    if (this.stage === 0) {
      list.push({ t: '첫 번째 유물', d: '등나무 쉼터 꼭대기 단의 오래된 반닫이를 열어 보자' });
      list.push({ t: '조작', d: 'WASD 이동 · 마우스 시점 · E 상호작용 · Esc 메뉴' });
    } else if (this.stage === 1) {
      list.push({ t: '유물 찾기', d: `학교에 숨은 역사 유물 (${n}/7)`, done: n >= 7 });
      list.push({ t: '악령 정화', d: `정화한 악령 ${k}마리`, done: false });
      if (!this.hintsRead) list.push({ t: '단서', d: '본관 중앙현관 게시판에서 유물의 행방을 알아보자' });
      else list.push({ t: '단서', d: '지도(M)에 표시된 노란 원 근처를 살펴보자' });
      if (this.g.relics.owned.has('censer') === false && this.hintsRead && !this.g.inventory.count('key_history')) list.push({ t: '열쇠', d: '역사교실 열쇠 — 1학년 교실 가방' });
    } else if (this.stage === 2) {
      list.push({ t: '최후의 의식', d: '운동장 한가운데 솟아오른 봉인석으로 가자' });
    } else if (this.stage === 3) {
      list.push({ t: '어둑시니', d: '쳐다볼수록 커진다! 시선을 피하며 유물로 공격하라' });
      list.push({ t: '팁', d: '신기전·향로·진천뢰는 보지 않고도 맞힐 수 있다 · 바닥 어둠은 점프로' });
    } else {
      list.push({ t: '완료', d: '번동중학교에 평화가 돌아왔다. 자유롭게 둘러보자' });
    }
    return list;
  }

  // 나침반·지도 표시용 목표 위치
  target() {
    const g = this.g;
    if (this.stage === 0) return new THREE.Vector3(65.3, 2, -12.3);
    if (this.stage === 1) {
      if (!this.hintsRead) return new THREE.Vector3(-1.5, 1.5, -46);
      let best = null, bd = Infinity;
      for (const r of RELICS) {
        if (g.relics.owned.has(r.id)) continue;
        const [x, z] = HINT_POS[r.id];
        const d = Math.hypot(x - g.player.pos.x, z - g.player.pos.z);
        if (d < bd) { bd = d; best = new THREE.Vector3(x, 1, z); }
      }
      return best;
    }
    if (this.stage === 2) return new THREE.Vector3(L.sealStone.x, 1, L.sealStone.z);
    if (this.stage === 3 && g.ghosts.boss) return g.ghosts.boss.pos;
    return null;
  }

  hintCircles() {
    if (!this.hintsRead) return [];
    return RELICS.filter((r) => !this.g.relics.owned.has(r.id)).map((r) => ({ id: r.id, name: r.name, x: HINT_POS[r.id][0], z: HINT_POS[r.id][1] }));
  }

  onRelic(id) {
    const g = this.g;
    if (this.stage === 0 && id === 'sword') {
      this.stage = 1;
      g.ghosts.enabled = true;
      setTimeout(() => {
        g.ui.toast('검이 울린다… 학교에 악령이 몰려온다!', 'big', 3000);
        g.audio.play('bossRoar');
      }, 1200);
    }
    if (this.relicCount >= 7 && this.stage <= 1) {
      this.stage = 2;
      g.interact.enableSeal();
      setTimeout(() => g.ui.toast('일곱 유물이 모두 모였다! 운동장 한가운데 봉인석이 솟아오른다', 'big', 3500), 800);
      g.audio.play('quest');
    }
    g.ui.refreshQuest();
  }

  onPurify() { this.g.ui.refreshQuest(); }

  onReadHints() {
    if (!this.hintsRead) {
      this.hintsRead = true;
      this.g.ui.toast('지도(M)에 유물의 위치가 표시되었다', 'big', 2500);
      this.g.audio.play('quest');
      this.g.ui.refreshQuest();
    }
  }
}
