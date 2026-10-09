// 가방(인벤토리)과 만들기
export const ITEMS = {
  pat: { name: '팥', icon: '🫘', desc: '붉은 팥은 예로부터 나쁜 기운을 쫓는다고 여겨졌습니다. 동짓날 팥죽을 쑤어 먹고 대문에 뿌린 것도 그 까닭이에요.<br><b>G</b> 키: 앞으로 뿌려 악령을 잠시 기절시킴', use: 'G' },
  ssuk: { name: '쑥', icon: '🌿', desc: '단군 신화에도 나오는 약초. 몸을 따뜻하게 하고 상처를 돌보는 데 썼습니다.<br><b>H</b> 키: 체력 25 회복', use: 'H' },
  juk: { name: '팥죽', icon: '🥣', desc: '동지 팥죽. 체력을 모두 회복하고, 40초 동안 악령에게 받는 피해가 절반이 되며 악령이 가까이 오지 못합니다.<br><b>J</b> 키: 먹기', use: 'J' },
  hanji: { name: '한지', icon: '📜', desc: '닥나무 껍질로 만든 우리 종이. 질기고 오래갑니다. 먹과 함께 부적을 만들 수 있어요.' },
  meok: { name: '먹', icon: '🖋', desc: '소나무를 태운 그을음을 아교로 굳혀 만든 먹. 한지와 함께 부적을 만들 수 있어요.' },
  bujeok: { name: '부적', icon: '🧧', desc: '가방에 있으면 쓰러질 때 한 번 자동으로 일어납니다(체력 50%).' },
  key_history: { name: '역사교실 열쇠', icon: '🗝', desc: '본관 1층 역사교실 문을 여는 열쇠. "분실물 — 역사 선생님께 돌려주세요" 라는 이름표가 달려 있다.' },
  note: { name: '쪽지', icon: '📝', desc: '누군가 남긴 쪽지.' },
};

export const RECIPES = [
  { out: 'juk', n: 1, need: { pat: 3, ssuk: 1 }, label: '팥 3 + 쑥 1 → 팥죽' },
  { out: 'bujeok', n: 1, need: { hanji: 1, meok: 1 }, label: '한지 1 + 먹 1 → 부적' },
];

export class Inventory {
  constructor(game) {
    this.g = game;
    this.items = {}; // id -> 개수
    this.cap = 6; // 서로 다른 칸 수
    this.notes = [];
  }

  count(id) { return this.items[id] || 0; }
  slotsUsed() { return Object.keys(this.items).filter((k) => this.items[k] > 0).length; }

  add(id, n = 1, msg) {
    if (!this.items[id] && this.slotsUsed() >= this.cap) {
      this.g.ui.toast('가방이 가득 찼다! (튼튼한 책가방을 찾으면 늘어남)', 'warn');
      return false;
    }
    this.items[id] = (this.items[id] || 0) + n;
    this.g.ui.toast(msg || `${ITEMS[id].icon} ${ITEMS[id].name} +${n}`);
    this.g.audio.play('pickup');
    this.g.ui.refreshConsumables();
    return true;
  }

  remove(id, n = 1) {
    if (this.count(id) < n) return false;
    this.items[id] -= n;
    if (this.items[id] <= 0) delete this.items[id];
    this.g.ui.refreshConsumables();
    return true;
  }

  upgradeBag() {
    this.cap = 12;
    this.g.ui.toast('🎒 튼튼한 책가방! 가방 칸이 12칸으로 늘었다', 'big', 2500);
    this.g.audio.play('quest');
  }

  canCraft(r) { return Object.entries(r.need).every(([k, v]) => this.count(k) >= v); }

  craft(r) {
    if (!this.canCraft(r)) return false;
    for (const [k, v] of Object.entries(r.need)) this.remove(k, v);
    this.add(r.out, r.n, `${ITEMS[r.out].icon} ${ITEMS[r.out].name}을(를) 만들었다`);
    return true;
  }

  use(id) {
    const g = this.g, P = g.player;
    if (P.dead) return;
    if (id === 'ssuk') {
      if (!this.count('ssuk')) return g.ui.toast('쑥이 없다 — 정원에서 캐 보자', 'warn');
      if (P.hp >= P.maxHp) return g.ui.toast('이미 체력이 가득하다');
      this.remove('ssuk');
      P.heal(25);
      P.playAnim('eat', 0.6);
      g.audio.play('eat');
    } else if (id === 'juk') {
      if (!this.count('juk')) return g.ui.toast('팥죽이 없다 — 가방(I)에서 팥 3 + 쑥 1로 만들 수 있다', 'warn');
      this.remove('juk');
      P.hp = P.maxHp;
      P.buffs.juk = 40;
      P.playAnim('eat', 0.8);
      g.audio.play('eat');
      g.audio.play('heal');
      g.ui.toast('🥣 동지 팥죽의 기운! 40초 동안 악령이 가까이 오지 못한다', 'big', 2200);
    } else if (id === 'pat') {
      if (!this.count('pat')) return g.ui.toast('팥이 없다 — 사물함·가방·텃밭에서 구하자', 'warn');
      this.remove('pat');
      g.relics.throwBeans();
    }
  }

  serialize() { return { items: this.items, cap: this.cap, notes: this.notes }; }
  load(d) { this.items = d.items || {}; this.cap = d.cap || 6; this.notes = d.notes || []; }
}
