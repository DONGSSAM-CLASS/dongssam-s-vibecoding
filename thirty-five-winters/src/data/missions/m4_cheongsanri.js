// Chapter 4 — Cheongsan-ri, October 1920. A medic with the Northern Military Administration Office Army.
import { S, NARR, SAY, FACT, pickup, dropoff, talk, hub, near, propMesh } from './common.js';

const SUNDEOK = S('Yi Sun-deok', '이순덕');
const BONGSU = S('Han Bong-su', '한봉수');
const JAEHO = S('O Jae-ho', '오재호');
const SEONGMIN = S('Mun Seong-min', '문성민');
const SGT = S('Section leader (fictional)', '분대장 (가상 인물)');
const CH = S('Chapter 4 · Cheongsan-ri', '4장 · 청산리');
const PROT = { id: 'sundeok', name: SUNDEOK, outfit: 'medic1920', weapon: 'none',
  desc: S('a 20-year-old from a Korean village in Yongjeong who trained as a nurse at a mission hospital and joined the army\'s medical section.', '용정의 한인 마을 출신 스무 살. 선교 병원에서 간호를 배우고 부대 의무반에 들어왔다.') };
const SQUAD = [
  { id: 'bongsu', name: BONGSU, role: 'rifle', outfit: 'army1920b', weapon: 'rifle_mosin' },
  { id: 'jaeho', name: JAEHO, role: 'scout', outfit: 'army1920', weapon: 'rifle_mosin', seed: 3 },
  { id: 'seongmin', name: SEONGMIN, role: 'marksman', outfit: 'army1920', weapon: 'rifle_mosin', seed: 5 },
];
const forest = (kit, area, n) => kit.forest(area, n, ['larch', 'larch', 'birch', 'oak', 'pine'], [], [0.9, 1.35]);

export const h4 = hub({
  id: 'h4', chapter: 'ch4', chapterLabel: CH, title: S('Forest camp on the march', '행군 중의 숲 속 야영지'), date: S('Mid-October 1920', '1920년 10월 중순'), place: S('Forests near Cheongsan-ri, Helong County', '화룡현 청산리 부근 숲'),
  unit: S('Northern Military Administration Office Army', '북로군정서군'), protagonist: PROT,
  intro: [FACT('Facing a large Japanese expeditionary force, the independence armies left their bases and moved toward the forests below Mt Baekdu.', '대규모 일본군의 출병에 맞서 독립군은 근거지를 떠나 백두산 아래 숲으로 이동했다.', 5)],
  env: {
    biome: 'manchuria_autumn', season: 'autumn', time: 'dusk', weather: 'clear', grade: 'autumn', ambience: { wind: 0.7, fire: 0.8, camp: 0.8, birds: 0.3 }, wind: 0.9,
    terrain: { size: 150, seed: 81, noiseAmp: 5, features: [{ type: 'flat', x: 0, z: 0, r: 26, h: 1, fall: 10 }, { type: 'road', path: [[-70, -10], [0, 0], [70, 8]], width: 2 }] },
    build(kit) { forest(kit, { x: 0, z: 0, w: 150, d: 150 }, 140); kit.campfire(0, 0); kit.campfire(-14, 8); kit.house('tent', 8, 10, 0.4); kit.house('tent', -8, -12, -0.3); kit.house('tent', 14, -6, 1.2); kit.stretcher(-4, 6, 0.3); kit.crates(6, -8, 0.2, 3); kit.crates(-12, -2, 0.6, 2, 'sack'); kit.table(10, 2, 0.5); kit.flag(-2, -4, '1919', 4); for (const z of [24, 28]) kit.target(-20, z, Math.PI / 2); },
  },
  start: { pos: [2, -4], facing: 0 },
  squad: SQUAD.map((s, i) => ({ ...s, pos: [-3 + i * 2, 3] })),
  npcs: [{ id: 'm1', outfit: 'army1920w', pos: [-12, 6], detectable: false, mode: 'wander', seed: 13 }, { id: 'm2', outfit: 'army1920', pos: [10, 6], detectable: false, seed: 14 }],
  stations: [{ kind: 'training', pos: [-16, 24] }, { kind: 'maintenance', pos: [6, -6] }, { kind: 'tailor', pos: [-10, -10] }, { kind: 'kitchen', pos: [-12, 6] }, { kind: 'infirmary', pos: [-4, 8] }, { kind: 'letters', pos: [10, 4] }, { kind: 'talk', pos: [1, 4] }, { kind: 'supply', pos: [-12, -3] }, { kind: 'depart', pos: [0, -18] }],
});

const GORGE = [[0, -88], [2, -50], [-2, -20], [1, 10], [0, 40], [2, 70]];
export const m4a = {
  id: 'm4a', chapter: 'ch4', chapterLabel: CH,
  title: S('The Gorge above Baegunpyeong', '백운평 위 골짜기'), date: S('21 October 1920', '1920년 10월 21일'), place: S('Baegunpyeong, Cheongsan-ri', '청산리 백운평'),
  unit: S('Medical section, Northern Military Administration Office Army', '북로군정서군 의무반'), protagonist: PROT,
  historyNote: S('On 21 October the Northern Military Administration Office Army waited in ambush on both sides of the narrow valley above Baegunpyeong; Yi Beom-seok\'s unit held the line. The Japanese vanguard walked into it.', '10월 21일 북로군정서군은 백운평 위 좁은 골짜기 양쪽에 매복했고, 이범석 부대가 매복선을 맡았다. 일본군 선발대가 그 안으로 들어왔다.'),
  createdNote: S('Sun-deok, her squad, the aid post and the wounded are fictional; the ambush is shown from the perspective of medical support.', '순덕과 분대, 구호소와 부상자는 가상이다. 매복을 의무 지원의 시선으로 보여 준다.'),
  briefing: [
    S('The army is spread along the slopes of a narrow, wooded gorge. Riflemen lie hidden on both sides; the aid post is behind the line to the north.', '부대는 좁고 숲이 우거진 골짜기 비탈에 퍼져 있다. 소총수들은 양쪽에 숨어 있고, 구호소는 전선 뒤 북쪽에 있다.'),
    S('You carry no rifle. When the firing starts, reach the wounded on the line, stop the bleeding, and get the worst of them back to the aid post. Keep your head down.', '당신은 총이 없다. 사격이 시작되면 전선의 부상자에게 가서 피를 멈추고, 가장 심한 이를 구호소로 옮겨라. 머리를 숙여라.'),
  ],
  after: [S('The vanguard was destroyed and the following Japanese troops were driven back. The independence army moved on that night; the next day brought the fighting at Cheonsupyeong and Eorang-chon.', '선발대는 무너졌고 뒤따르던 일본군도 물러났다. 독립군은 그날 밤 이동했고, 이튿날 천수평과 어랑촌에서 싸움이 이어졌다.')],
  music: 'explore', combatMusic: 'combat', seed: 19201021, ammo: 0, bandages: 9, holdFireUntilSignal: true,
  env: {
    biome: 'manchuria_autumn', season: 'autumn', time: 'day', weather: 'clear', grade: 'autumn', ambience: { wind: 0.8, birds: 0.5 }, wind: 1.1,
    terrain: { size: 200, seed: 83, noiseAmp: 5, edgeRise: 26, features: [
      { type: 'valley', path: [[0, -100], [2, -50], [-2, -20], [1, 10], [0, 40], [2, 100]], width: 30, floor: 5, depth: 16 },
      { type: 'road', path: GORGE, width: 1.8 }, { type: 'flat', x: 6, z: 58, r: 8, h: null, fall: 6 },
    ] },
    build(kit) {
      forest(kit, { x: -40, z: 0, w: 56, d: 190 }, 150); forest(kit, { x: 40, z: 0, w: 56, d: 190 }, 150);
      for (let i = 0; i < 70; i++) { const sx = (i % 2 ? 1 : -1) * (12 + Math.random() * 24); kit.bush(sx, -50 + Math.random() * 90, 1 + Math.random() * 0.3); }
      for (let i = 0; i < 16; i++) kit.rock((i % 2 ? 1 : -1) * (13 + Math.random() * 10), -20 + i * 3, 1.1, true);
      for (let i = 0; i < 8; i++) kit.log((i % 2 ? 1 : -1) * (15 + (i % 3) * 3), -10 + i * 5, 0.4 * (i % 3), 4);
      kit.stretcher(8, 58, 0.2); kit.stretcher(4, 60, -0.3); kit.crates(10, 62, 0, 2); kit.house('tent', 2, 64, 0.2, { w: 4, d: 3, color: '#9a9478' });
    },
  },
  start: { pos: [6, 56], facing: Math.PI },
  extraction: [2, 80, 7],
  squad: SQUAD.map((s, i) => ({ ...s, pos: [4 + i * 2, 53] })),
  allies: [
    ...Array.from({ length: 7 }, (_, i) => { const p = [16 + (i % 2) * 3, -24 + i * 6]; return { id: 'Lw' + i, name: S('Rifleman on the west slope', '서쪽 비탈 소총수'), outfit: ['army1920', 'army1920b'][i % 2], weapon: 'rifle_mosin', pos: p, holdPos: p, reserve: 25, seed: 60 + i }; }),
    ...Array.from({ length: 7 }, (_, i) => { const p = [-16 - (i % 2) * 3, -22 + i * 6]; return { id: 'Le' + i, name: S('Rifleman on the east slope', '동쪽 비탈 소총수'), outfit: ['army1920b', 'army1920'][i % 2], weapon: 'rifle_mosin', pos: p, holdPos: p, reserve: 25, seed: 70 + i }; }),
  ],
  enemies: Array.from({ length: 14 }, (_, i) => ({ id: 'j' + i, group: 'van', outfit: 'jp_army1920', weapon: 'rifle_jp', label: 'column', pos: [(i % 2 ? 0.8 : -0.8), -88 - (i >> 1) * 1.4], viewRange: 34, accuracy: 0.85,
    column: { path: GORGE, s: -i * 2.3, speed: 1.5, lateral: i % 2 ? 0.8 : -0.8 } })),
  groups: { van: { routAt: 35, retreat: [0, -86] } },
  intro: [
    FACT('21 October 1920. The army lies hidden on the slopes of the gorge above Baegunpyeong.', '1920년 10월 21일. 부대가 백운평 위 골짜기 비탈에 숨어 있다.', 5),
    SAY(SGT, 'Medic — stay by the post until they\'re in. When it starts, the line will need you more than it needs another rifle.', '의무병, 놈들이 들어올 때까지 구호소 곁에 있어. 시작되면 전선엔 총 한 자루보다 네가 더 필요해.'),
  ],
  objectives: [
    { id: 'wait', type: 'ambush', groups: ['van'], signalAt: 98, signalLate: 130, autoSignal: true, marker: [0, -10], checkpoint: false,
      text: S('Stay low by the aid post. The vanguard is coming up the gorge', '구호소 곁에 몸을 낮추고 기다리기. 선발대가 골짜기로 올라온다'),
      onSignal: (g) => g.narrate([FACT('The riflemen on both slopes opened fire on the vanguard in the narrow of the gorge.', '양쪽 비탈의 소총수들이 골짜기 좁은 곳의 선발대에 일제히 사격했다.', 4), SAY(SGT, 'Fire! Fire! — Medic, west slope, go!', '사격! 사격! — 의무병, 서쪽 비탈로!')]) },
    { id: 'treat', type: 'treat', need: 3, marker: (g) => { const w = g.allies.find((a) => a.state === 'wounded' && !a.treated); return w ? [w.x, w.z] : null; }, checkpoint: true, checkpointPos: [6, 50],
      text: S('Reach the wounded on the line and treat them (3)', '전선의 부상자에게 가서 치료하기 (3)'), xp: ['rescue', 15] },
    { id: 'evac', type: 'count', prefix: 'evac_', need: 1, marker: [6, 58], text: S('Carry a badly wounded rifleman back to the aid post', '중상자 한 명을 구호소로 업어 오기'), xp: ['rescue', 15] },
    { id: 'out', type: 'extract', zone: [2, 80, 7], text: S('The vanguard has broken. Withdraw north with your squad before their main body arrives', '선발대가 무너졌다. 본대가 오기 전에 분대와 함께 북쪽으로 물러나기'),
      onStart: (g) => { for (const id in g.groups) g.routGroup(g.groups[id]); g.narrate([SAY(SGT, 'That\'s their vanguard. The rest won\'t be far. Wounded first — we\'re moving!', '저건 선발대일 뿐이다. 나머지가 멀지 않아. 부상자 먼저 — 이동한다!')]); } },
  ],
  optional: [
    { id: 'all', text: S('No wounded rifleman bleeds out', '출혈로 잃는 소총수가 없게 하기'), check: (g, m) => m.index >= 3 && !g.allies.some((a) => a.state === 'lost'), fail: (g) => g.allies.some((a) => a.state === 'lost'), xp: ['rescue', 20] },
  ],
  tick(g, m, dt) {
    // after the first volley, the line takes casualties; at least one needs carrying
    if (!m.signalled || m.index > 2) return;
    m.woundT = (m.woundT ?? 6) - dt;
    const open = g.allies.filter((a) => a.state === 'wounded' && !a.treated).length;
    if (m.woundT <= 0 && open < 2) {
      m.woundT = 9 + Math.random() * 6;
      const cands = g.allies.filter((a) => !a.squad && a.active).sort((a, b) => a.dist(g.player) - b.dist(g.player)).slice(0, 6);
      const a = cands[Math.floor(Math.random() * cands.length)];
      if (a) { a.hp = 1; a.damage(5); m.wounds = (m.wounds || 0) + 1; if (m.wounds === 2) a.severe = true; }
    }
  },
  onDrop(g, m, a) { if (a.kind === 'ally' && near(a, 6, 58, 6)) { m.flag('evac_' + a.id); a.bleedT = Infinity; } },
  failIf: (g) => (g.squad.filter((a) => a.state === 'lost').length >= 3 ? 'squadLost' : null),
  rewards: { ammo: 20, medicine: 2 },
  setup(g) { g.allies.filter((a) => !a.squad).forEach((a) => { a.crouch = true; }); g.squad.forEach((a) => { a.order = 'follow'; }); },
};

// ------------------------------------------------------------------------------------------- Eorang-chon
const LINE = [[-22, 28], [0, 32], [22, 28]];
export const m4b = {
  id: 'm4b', chapter: 'ch4', chapterLabel: CH,
  title: S('The Heights at Eorang-chon', '어랑촌 고지'), date: S('22 October 1920', '1920년 10월 22일'), place: S('Eorang-chon, Helong County', '화룡현 어랑촌'),
  unit: S('Medical & supply, Northern Military Administration Office Army', '북로군정서군 의무·보급'), protagonist: PROT,
  historyNote: S('On 22 October, at Eorang-chon, Kim Jwa-jin\'s troops held the heights against a large Japanese force; Hong Beom-do\'s force, nearby, joined the fight. It was the largest of the Cheongsan-ri battles. The independence armies withdrew that night.', '10월 22일 어랑촌에서 김좌진 부대가 고지를 지키며 대규모 일본군을 막았고, 가까이 있던 홍범도 부대가 전투에 합류했다. 청산리 일대 전투 가운데 가장 큰 싸움이었다. 독립군은 그날 밤 물러났다.'),
  createdNote: S('The supply runs, the food baskets and every named character are created for the game. Many accounts say villagers brought food to the fighters.', '보급 운반, 밥 바구니, 이름 있는 인물은 모두 게임 구성이다. 많은 기록이 주민들이 싸우는 이들에게 먹을 것을 날랐다고 전한다.'),
  briefing: [
    S('After a night march with almost no food, the army holds a line of heights above the village of Eorang-chon. A much larger Japanese force is coming.', '거의 먹지 못한 채 밤새 행군한 부대가 어랑촌 마을 위 고지에 전선을 폈다. 훨씬 큰 일본군이 오고 있다.'),
    S('The riflemen are short of ammunition. Carry crates from the cache to each section, treat the wounded, and keep the line standing until dark.', '소총수들은 탄약이 모자란다. 보관소의 상자를 각 분대로 나르고, 부상자를 치료하며, 어두워질 때까지 전선을 지켜라.'),
  ],
  after: [
    S('The battles around Cheongsan-ri lasted until about 26 October. Then the independence armies withdrew north and east. Japanese troops turned on the Korean villages of Gando.', '청산리 일대 전투는 10월 26일 무렵까지 이어졌다. 이후 독립군은 북쪽과 동쪽으로 물러났고, 일본군은 간도의 한인 마을을 덮쳤다.'),
  ],
  music: 'explore', combatMusic: 'combat', seed: 19201022, ammo: 0, bandages: 9,
  env: {
    biome: 'manchuria_autumn', season: 'autumn', time: 'dawn', weather: 'clear', grade: 'autumn', ambience: { wind: 0.9, birds: 0.2 }, wind: 1.2, cold: true,
    terrain: { size: 200, seed: 87, noiseAmp: 5, edgeRise: 22, features: [
      { type: 'ridge', path: [[-70, 32], [0, 36], [70, 32]], width: 30, height: 14 },
      { type: 'flat', x: 0, z: -50, r: 22, h: -2, fall: 12 }, { type: 'road', path: [[-80, -55], [0, -50], [80, -45]], width: 2.5 },
      { type: 'road', path: [[0, -48], [4, 0], [0, 60], [0, 90]], width: 1.6 },
    ] },
    build(kit) {
      forest(kit, { x: 0, z: 72, w: 190, d: 40 }, 120); forest(kit, { x: -70, z: 0, w: 50, d: 70 }, 50); forest(kit, { x: 70, z: 0, w: 50, d: 70 }, 50);
      for (const [x, z] of LINE) { kit.wall(x - 4, z - 3, x + 4, z - 3, 0.95, 'earth'); kit.rock(x + 6, z - 2, 1.1, true); kit.log(x - 7, z - 2, 0.2, 4); }
      for (let i = 0; i < 40; i++) kit.bush(-70 + Math.random() * 140, -20 + Math.random() * 40, 1.1);
      kit.house('choga', -14, -52, 0.1); kit.house('manchu', 10, -56, -0.1); kit.house('choga', 26, -48, 0.3); kit.house('choga', -30, -46, -0.2);
      kit.crops({ x: -6, z: -36, w: 30, d: 10 }); kit.hay(16, -40);
      kit.crates(6, 52, 0.1, 3); kit.house('tent', -6, 56, 0.1, { color: '#9a9478' }); kit.stretcher(-2, 52, 0.4);
    },
  },
  start: { pos: [2, 76], facing: Math.PI },
  extraction: [0, 82, 7],
  squad: SQUAD.map((s, i) => ({ ...s, pos: [0 + i * 2, 72] })),
  allies: LINE.flatMap(([x, z], k) => Array.from({ length: 4 }, (_, i) => { const p = [x - 4 + i * 2.6, z - 1.5]; return { id: `L${k}_${i}`, name: S('Rifleman on the line', '전선의 소총수'), outfit: ['army1920w', 'army1920b', 'army1920'][(i + k) % 3], weapon: 'rifle_mosin', pos: p, holdPos: p, reserve: 3, seed: 90 + k * 4 + i, holdFire: false }; })),
  groups: { w1: { routAt: 30, retreat: [0, -86] }, w2: { routAt: 30, retreat: [20, -86] }, w3: { routAt: 30, retreat: [-20, -86] } },
  intro: [
    FACT('22 October 1920, before dawn. The army climbs to the heights above Eorang-chon.', '1920년 10월 22일 새벽. 부대가 어랑촌 위 고지로 오른다.', 5),
    SAY(BONGSU, 'My stomach thinks my throat\'s been cut. Not a grain since yesterday noon.', '배가 목이 잘린 줄 알겠소. 어제 점심 뒤로 쌀 한 톨 못 먹었으니.'),
  ],
  objectives: [
    { id: 'march', type: 'reach', zone: [4, 46, 6], withSquad: true, text: S('Follow the path up to the supply cache behind the line', '길을 따라 전선 뒤 보급소까지 오르기') },
    { id: 'ammo', type: 'count', prefix: 'sup_', need: 3, marker: (g, m) => { const k = [0, 1, 2].find((i) => !g.flags.has('sup_' + i)); return k == null ? null : LINE[k]; }, checkpoint: true, checkpointPos: [4, 48],
      text: S('Carry an ammunition crate from the cache to each of the three sections on the line', '보급소의 탄약 상자를 전선 세 분대에 하나씩 나르기'), xp: ['supply', 15],
      onStart: (g) => g.narrate([SAY(SGT, 'Three crates, three sections. They\'re down to their last clips — move!', '상자 셋, 분대 셋. 마지막 탄창뿐이다 — 서둘러!')]) },
    { id: 'hold', type: 'hold', timer: 150, zone: [0, 28, 40], checkpoint: true, checkpointPos: [2, 40],
      text: S('Hold the heights: treat the wounded and keep the sections supplied until dark', '고지를 지키기: 어두워질 때까지 부상자를 치료하고 분대에 보급하기'),
      onStart: (g, m) => { m.waveT = 0; m.waves = 0; g.narrate([SAY(JAEHO, 'There — in the village, and on the road behind it. That\'s not a company, that\'s a regiment.', '저기 — 마을에, 그 뒤 길에도. 저건 중대가 아니야. 연대다.')]); } },
    { id: 'night', type: 'extract', zone: [0, 82, 7], text: S('Darkness. Gather the wounded and withdraw north with the army', '어둠이 내렸다. 부상자를 거두어 부대와 함께 북쪽으로 물러나기'),
      onStart: (g) => { for (const id in g.groups) g.routGroup(g.groups[id]); g.renderer.setGrade('night'); g.narrate([FACT('The independence armies withdrew by night after the battle at Eorang-chon.', '독립군은 어랑촌 전투 뒤 밤을 틈타 물러났다.', 4)]); } },
  ],
  optional: [
    { id: 'food', text: S('Bring the villagers\' food baskets to the line (3)', '마을 사람들의 밥 바구니를 전선에 나르기 (3)'), check: (g, m) => m.count('food_') >= 3, xp: ['supply', 15], onComplete: (g) => g.progress.addOrg({ trust: 10, food: 2 }) },
  ],
  tick(g, m, dt) {
    if (m.current?.id !== 'hold') return;
    m.waveT += dt;
    const spawnWave = (group, n, xs) => { for (let i = 0; i < n; i++) g.spawnAttacker({ id: group + i, group, outfit: 'jp_army1920', weapon: 'rifle_jp', label: 'soldier', pos: [xs + (i % 4) * 4 - 6, -60 - Math.floor(i / 4) * 3], viewRange: 60, accuracy: 0.8 }, g.allies.find((a) => !a.squad && a.active) || g.player); };
    if (m.waves === 0 && m.waveT > 1) { m.waves = 1; spawnWave('w1', 8, 0); }
    if (m.waves === 1 && m.waveT > 45) { m.waves = 2; spawnWave('w2', 8, 24); }
    if (m.waves === 2 && m.waveT > 80) {
      m.waves = 3;
      for (let i = 0; i < 6; i++) { const p = [-48 - (i % 3) * 3, 10 + i * 3]; g.spawnAlly({ id: 'H' + i, name: S('Hong Beom-do\'s force', '홍범도 부대'), outfit: ['army1920b', 'army1920w'][i % 2], weapon: 'rifle_mosin', pos: p, holdPos: [p[0] + 14, p[1] - 6], order: 'move', reserve: 20, holdFire: false, seed: 120 + i }); }
      for (const id of ['w1', 'w2']) { const gg = g.groups[id]; if (gg) gg.morale -= 15; }
      g.narrate([FACT('Hong Beom-do\'s force, nearby, joined the fight at Eorang-chon.', '가까이 있던 홍범도 부대가 어랑촌 전투에 합류했다.', 5), SAY(SEONGMIN, 'Rifles on the east flank — they\'re ours!', '동쪽 측면에 총소리 — 우리 편이다!')]);
    }
    if (m.waves === 3 && m.waveT > 95) { m.waves = 4; spawnWave('w3', 6, -24); }
  },
  setup(g) {
    // three crates at the cache, delivered one at a time; each resupplies the section on arrival
    [[4, 50], [6, 50.5], [8, 50]].forEach((p, i) => pickup(g, { id: 'crate' + i, pos: p, kind: 'ammo', carry: true, hold: 0.6, prompt: S('Lift an ammunition crate', '탄약 상자 들기'), enabled: (gg) => !gg.player.carryItem && !gg.player.carrying }));
    LINE.forEach(([x, z], k) => dropoff(g, { id: 'sec' + k, pos: [x, z - 4.5], kind: 'ammo', prompt: S('Hand out the ammunition', '탄약 나눠 주기'), enabled: (gg) => !gg.flags.has('sup_' + k),
      flag: () => 'sup_' + k, onUse: (gg) => { for (const a of gg.allies) if (!a.squad && Math.hypot(a.x - x, a.z - z) < 12) { a.reserve += 20; a.lowAmmoSaid = false; } gg.award('supply', 6, 'xpShare'); gg.say(gg.allies.find((a) => Math.hypot(a.x - x, a.z - z) < 12), 'thanksAmmo'); } }));
    // villagers' baskets (optional): left at the edge of the village below the heights
    [[-22, -30], [-18, -32], [-26, -28]].forEach((p, i) => pickup(g, { id: 'basket' + i, pos: p, kind: 'bundle', carry: true, hold: 0.5, prompt: S('Take a basket of food from the villagers', '마을 사람들의 밥 바구니 받기'), enabled: (gg) => !gg.player.carryItem && !gg.player.carrying }));
    LINE.forEach(([x, z], k) => dropoff(g, { id: 'feed' + k, pos: [x + 2, z - 4.5], kind: 'bundle', marker: null, prompt: S('Share the food along the section', '분대에 밥 나누기'), flag: () => 'food_' + k + '_' + Math.random().toString(36).slice(2, 5) }));
    g.addInteractable({ id: 'villagers', pos: [-22, -27], prompt: S('Talk to the women from the village', '마을 아낙들과 이야기하기'), marker: 'item', onUse: (gg) => gg.narrate([SAY(S('Village woman (fictional)', '마을 아낙 (가상 인물)'), 'We wrapped rice balls in our skirts. Take them up — and come back for more if you can.', '치마폭에 주먹밥을 쌌어요. 가져가요. 할 수 있으면 더 가지러 와요.')]) });
    g.civilians.forEach(() => {});
    for (const a of g.allies) if (!a.squad) { a.crouch = true; }
  },
  civilians: [
    { id: 'vw1', name: S('Village woman', '마을 아낙'), outfit: 'settler_w', pos: [-22, -26], detectable: false, facing: 0 },
    { id: 'vw2', name: S('Village woman', '마을 아낙'), outfit: 'refugee_w', pos: [-25, -25], detectable: false, facing: 0.4 },
  ],
  failIf: (g) => (g.squad.filter((a) => a.state === 'lost').length >= 3 ? 'squadLost' : null),
  rewards: { ammo: 15, food: 1, medicine: 1 },
};
