// Chapter 6 — 1932–1933. Two different Korean armies, two regions, both allied with Chinese forces.
import { S, NARR, SAY, FACT, pickup, dropoff, talk, hub, near, propMesh } from './common.js';

const CH = S('Chapter 6 · Allied Fronts', '6장 · 두 갈래의 연합 전선');
const MYEONGSU = S('Choe Myeong-su', '최명수');
const DEOKPAL = S('Baek Deok-pal', '백덕팔');
const WANGLI = S('Wang Li', '왕리');
const DONGGYU = S('Seo Dong-gyu', '서동규');
const YUNHO = S('Sin Yun-ho', '신윤호');
const GANGHWA = S('Ryu Gang-hwa', '류강화');
const ZHAO = S('Zhao Feng', '자오펑');
const CVOL = S('Chinese volunteer officer (fictional)', '중국 의용군 장교 (가상 인물)');

// ------------------------------------------------------------------------------------------- 6a  KRA, South Manchuria
export const m6a = {
  id: 'm6a', chapter: 'ch6', chapterLabel: CH,
  title: S('Outside Yeongneung-ga', '영릉가 밖에서'), date: S('March 1932', '1932년 3월'), place: S('Yeongneung-ga, Xinbin (Heunggyeong) County, South Manchuria', '남만주 신빈(흥경)현 영릉가'),
  unit: S('Korean Revolutionary Army (조선혁명군), with Chinese volunteer forces', '조선혁명군, 중국 의용군과 연합'),
  protagonist: { id: 'myeongsu', name: MYEONGSU, outfit: 'army1930', weapon: 'rifle_mauser', binoculars: true,
    desc: S('a 27-year-old scout of the Korean Revolutionary Army, born to settlers near Xingjing.', '흥경 부근 이주민 집안에서 태어난 스물일곱 살 조선혁명군 정찰병.') },
  historyNote: S('In March 1932 Yang Se-bong\'s Korean Revolutionary Army and Chinese volunteer forces drove Japanese and Manchukuo troops out of Yeongneung-ga. The Korean–Chinese alliance in South Manchuria fought on around Xinbin (Heunggyeong).', '1932년 3월 양세봉의 조선혁명군과 중국 의용군은 영릉가에서 일본군과 만주국군을 몰아냈다. 남만주의 한중 연합은 신빈(흥경) 일대에서 싸움을 이어 갔다.'),
  createdNote: S('Myeong-su, his squad, the temple meeting and the telegraph task are created for the game; the joint assault is shown only at its edge.', '명수와 분대, 사당에서의 만남, 전신선 임무는 게임 구성이다. 연합 공격은 가장자리만 보여 준다.'),
  briefing: [
    S('Japanese and Manchukuo troops hold the walled town. The allied plan needs eyes on its approaches and its telegraph line cut before the assault.', '일본군과 만주국군이 성곽 마을을 지키고 있다. 연합 작전에는 접근로 정찰과, 공격 전 전신선 절단이 필요하다.'),
    S('Meet the Chinese volunteers\' liaison at the ruined temple, scout the walls, cut the wire, then signal the assault from the hollow by the east gate.', '폐사당에서 중국 의용군 연락관을 만나고, 성벽을 정찰하고, 전신선을 끊은 뒤 동문 옆 우묵한 곳에서 공격 신호를 보내라.'),
  ],
  after: [S('After Yeongneung-ga the allies fought at Heunggyeong and elsewhere through 1932–33. Yang Se-bong was killed in 1934; the Korean Revolutionary Army continued its struggle for years afterwards.', '영릉가 뒤에도 연합군은 1932~33년 흥경 등지에서 싸웠다. 양세봉은 1934년 전사했고, 조선혁명군은 그 뒤로도 여러 해 투쟁을 이어 갔다.')],
  music: 'explore', combatMusic: 'combat', seed: 1932, ammo: 30, bandages: 3,
  env: {
    biome: 'manchuria_lateWinter', season: 'winter', time: 'dawn', weather: 'clear', grade: 'dawn1945', ambience: { wind: 1, birds: 0.2 }, wind: 1.1, cold: true,
    terrain: { size: 220, seed: 121, noiseAmp: 6, edgeRise: 22, features: [
      { type: 'flat', x: 0, z: 30, w: 70, d: 50, h: 0.5, fall: 16 },
      { type: 'road', path: [[-110, 30], [-40, 30], [40, 30], [110, 26]], width: 4 }, { type: 'road', path: [[0, 30], [0, -40], [-20, -100]], width: 2.4 },
      { type: 'hill', x: -60, z: -40, r: 36, h: 12 }, { type: 'hill', x: 60, z: -50, r: 40, h: 10 }, { type: 'flat', x: -58, z: -44, r: 7, h: null, fall: 5 },
      { type: 'valley', path: [[-80, 0], [-36, 6], [-24, 22]], width: 10, depth: 3 },
    ] },
    build(kit) {
      // walled town
      for (const [a, b, c, d] of [[-30, 6, 30, 6], [-30, 54, 30, 54], [30, 6, 30, 26], [30, 34, 30, 54], [-30, 6, -30, 26], [-30, 34, -30, 54]]) kit.wall(a, b, c, d, 1.7, 'earth'); // parapet walls the garrison can see over
      for (const [x, z, r] of [[-16, 18, 0], [0, 16, 0], [16, 20, 0], [-16, 44, Math.PI], [2, 44, Math.PI], [18, 42, Math.PI]]) kit.house('brick', x, z, r, { w: 8, d: 6 });
      kit.house('pavilion', -58, -44, 0, { w: 9, d: 6 }); // ruined temple on the hill
      kit.telegraph([[-110, 24], [-34, 24], [-26, 28]], 24);
      kit.forest({ x: -70, z: -40, w: 60, d: 60 }, 60, ['larch', 'pine', 'dead']); kit.forest({ x: 70, z: -50, w: 60, d: 60 }, 60, ['larch', 'pine', 'oak']);
      kit.forest({ x: 0, z: 92, w: 200, d: 24 }, 50, ['larch', 'pine']);
      for (let i = 0; i < 30; i++) kit.bush(-90 + Math.random() * 180, -70 + Math.random() * 60, 1.1);
      for (let i = 0; i < 10; i++) kit.rock(-50 + Math.random() * 100, -40 + Math.random() * 30, 1.2, true);
      kit.crops({ x: 54, z: 12, w: 24, d: 16 }); kit.hay(-44, 14); kit.hay(44, 2); kit.cart(-40, 34, 0.2);
    },
  },
  start: { pos: [-60, -56], facing: 0.4 },
  extraction: [-58, -44, 8],
  squad: [
    { id: 'deokpal', name: DEOKPAL, role: 'rifle', outfit: 'army1930', weapon: 'rifle_mauser', pos: [-62, -58] },
    { id: 'wangli', name: WANGLI, role: 'marksman', outfit: 'chinese_vol', weapon: 'rifle_mauser', pos: [-58, -59], seed: 7 },
  ],
  civilians: [{ id: 'liaison', name: CVOL, outfit: 'chinese_vol', pos: [-56, -40], facing: Math.PI, detectable: false, seed: 9 }],
  enemies: [
    { id: 'w1', group: 'gar', outfit: 'jp_army1930', weapon: 'rifle_jp', label: 'sentry', pos: [-10, 7], facing: Math.PI, viewRange: 40, fov: 1.5, scanArc: 1.6 },
    { id: 'w2', group: 'gar', outfit: 'jp_army1930', weapon: 'rifle_jp', label: 'sentry', pos: [14, 7], facing: Math.PI, viewRange: 40, fov: 1.5, scanArc: 1.6 },
    { id: 'g1', group: 'gar', outfit: 'jp_army1930', weapon: 'rifle_jp', label: 'sentry', pos: [-32, 30], facing: -Math.PI / 2, viewRange: 36, fov: 1.6, scanArc: 1.8 },
    { id: 'p1', group: 'gar', outfit: 'chinese_nra', weapon: 'rifle_mauser', label: 'patrol', pos: [-40, 18], route: [[-44, 14, 3], [-44, 40, 3], [-36, 46, 3]], pingpong: true, viewRange: 30, fov: 1.6 },
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'in' + i, group: 'gar', outfit: i % 2 ? 'chinese_nra' : 'jp_army1930', weapon: 'rifle_jp', label: 'soldier', pos: [-14 + i * 6, 28 + (i % 2) * 6], facing: Math.PI, viewRange: 30, fov: 1.6, scanArc: 2 })),
  ],
  groups: { gar: { routAt: 50, retreat: [80, 30] } },
  intro: [NARR('March 1932. The frost is breaking; the roads are mud by noon.', '1932년 3월. 서리가 풀려 한낮이면 길이 진창이 된다.'), FACT('After the Manchurian Incident (1931), Korean and Chinese anti-Japanese forces in South Manchuria allied against the occupation.', '만주사변(1931) 뒤 남만주의 한국·중국 항일 부대는 점령에 맞서 연합했다.', 5)],
  objectives: [
    { id: 'meet', type: 'flag', flag: 'met', marker: [-56, -40], text: S('Meet the Chinese volunteers\' liaison at the ruined temple', '폐사당에서 중국 의용군 연락관 만나기') },
    { id: 'scout', type: 'observe', group: 'gar', need: 5, marker: [-14, 0], text: S('Scout the town: observe the sentries and the patrol (5) — use your binoculars', '마을 정찰: 보초와 순찰 관찰하기 (5) — 망원경을 써라'), xp: ['intel', 10] },
    { id: 'wire', type: 'flag', flag: 'wire', marker: [-34, 24], checkpoint: true, checkpointPos: [-52, -30], text: S('Cut the garrison\'s telegraph wire at the last pole before the wall — unseen', '성벽 앞 마지막 전신주에서 수비대 전신선 끊기 — 들키지 말 것') },
    { id: 'signal', type: 'flag', flag: 'signalled', marker: [-40, 2], checkpoint: true, checkpointPos: [-50, -10], text: S('Reach the hollow by the east gate and signal the allied assault (G / interact)', '동문 옆 우묵한 곳에서 연합 공격 신호 보내기 (G / 상호작용)'),
      onSignal: (g, m) => { if (near(g.player, -40, 2, 9)) { m.flag('signalled'); g.audio.whistle(null); } else g.hud.toast(S('Get to the hollow by the east gate first', '먼저 동문 옆 우묵한 곳으로'), 'warn'); } },
    { id: 'assault', type: 'rout', groups: ['gar'], text: S('Support the assault: covering fire on the wall (order your squad: 3)', '공격 지원: 성벽에 엄호 사격 (분대 명령: 3)'),
      onStart: (g) => {
        g.weaponsFree = true;
        // Korean companies press on the east gate; Chinese volunteers come over the south wall
        for (let i = 0; i < 6; i++) g.spawnAlly({ id: 'K' + i, name: S('Korean Revolutionary Army', '조선혁명군'), outfit: 'army1930', weapon: 'rifle_mauser', pos: [-60 - i, 4 + i * 2], holdPos: [-35, 21 + i * 3], order: 'move', reserve: 30, holdFire: false, seed: 140 + i });
        for (let i = 0; i < 6; i++) g.spawnAlly({ id: 'C' + i, name: S('Chinese volunteer', '중국 의용군'), outfit: 'chinese_vol', weapon: 'rifle_mauser', pos: [-14 + i * 5, -30], holdPos: [-14 + i * 5, 2], order: 'move', reserve: 30, holdFire: false, seed: 150 + i });
        for (const e of g.enemies) if (e.active) e.enterCombat(g.allies[g.allies.length - 1], true);
        g.narrate([FACT('Korean and Chinese troops attacked the town together.', '한국과 중국 부대가 함께 마을을 공격했다.', 4), SAY(WANGLI, 'Keep their heads down on the wall — our people are crossing the field!', '성벽 위 놈들 머리를 못 들게 해 — 우리 사람들이 들판을 건넌다!')]);
      } },
    { id: 'aid', type: 'treat', need: 2, marker: (g) => { const w = g.allies.find((a) => a.state === 'wounded' && !a.treated); return w ? [w.x, w.z] : null; }, text: S('Help the wounded at the field\'s edge (2)', '들판 끝의 부상자 돕기 (2)'), xp: ['rescue', 10],
      onStart: (g) => { const c = g.allies.filter((a) => !a.squad && a.active).slice(0, 2); c.forEach((a) => { a.hp = 1; a.damage(5); }); if (!c.length) g.mission.flag('noAid'); } },
    { id: 'back', type: 'extract', zone: [-58, -44, 8], text: S('The town is taken. Report back at the temple', '마을을 되찾았다. 사당으로 돌아가 보고하기') },
  ],
  triggers: [{ when: (g, m) => m.current?.id === 'aid' && m.has('noAid'), do: (g, m) => { m.index++; m.beginObjective(); } }],
  setup(g) {
    talk(g, { id: 'lt', actor: g.civilians[0], prompt: S('Talk to the liaison', '연락관과 이야기하기'), flag: 'met', lines: [
      SAY(CVOL, 'Your commander and ours agree: we strike when the wire is cut and we see your signal. Our men come from the south-east, yours from the east.', '당신네 사령관과 우리 사령관이 합의했소. 전신선이 끊기고 신호가 보이면 친다. 우리는 남동쪽, 당신들은 동쪽에서.'),
      SAY(MYEONGSU, 'Same enemy, same mud. We\'ll see you on the wall.', '적도 같고 진창도 같지요. 성벽에서 봅시다.'),
    ] });
    g.addInteractable({ id: 'wirecut', pos: [-34, 24], prompt: S('Cut the telegraph wire (hold)', '전신선 끊기 (길게)'), hold: 2.2, marker: 'item', enabled: (gg) => gg.mission.index >= 2,
      onUse: (gg) => { gg.mission.flag('wire'); gg.audio.bolt(null, true); gg.award('intel', 8); gg.narrate([SAY(DEOKPAL, 'That\'s their voice gone. Now they\'re deaf and mute.', '저놈들 목소리를 끊었소. 이제 귀도 입도 막혔지.')]); } });
  },
  failIf: (g) => (g.squad.filter((a) => a.state === 'lost').length >= 2 ? 'squadLost' : null),
  rewards: { ammo: 20, food: 2, parts: 1 },
};

// ------------------------------------------------------------------------------------------- h6 / 6b  KIA, North Manchuria
export const h6 = hub({
  id: 'h6', chapter: 'ch6', chapterLabel: CH, title: S('Joint camp in the hills', '산속의 연합 진영'), date: S('June 1933', '1933년 6월'), place: S('Hills of Wangqing County, North Manchuria', '북만주 왕청현 산지'),
  unit: S('Korean Independence Army (한국독립군) & Jilin National Salvation Army', '한국독립군 · 길림구국군'),
  protagonist: { id: 'donggyu', name: DONGGYU, outfit: 'army1933s', weapon: 'rifle_mauser' },
  intro: [FACT('The Korean Independence Army of the Korean Independence Party, under Ji Cheong-cheon, fought alongside Chinese forces in North Manchuria.', '지청천이 이끈 한국독립당의 한국독립군은 북만주에서 중국군과 함께 싸웠다.', 5)],
  env: {
    biome: 'manchuria_summer', season: 'summer', time: 'overcast', weather: 'rain', grade: 'summer', ambience: { rain: 0.8, wind: 0.5, camp: 0.6 }, wind: 0.8,
    terrain: { size: 150, seed: 131, noiseAmp: 6, features: [{ type: 'flat', x: 0, z: 0, r: 28, h: 1, fall: 12 }] },
    build(kit) { kit.forest({ x: 0, z: 0, w: 150, d: 150 }, 130, ['larch', 'oak', 'birch', 'pine']); for (let i = 0; i < 5; i++) kit.house('tent', -16 + i * 8, 12, 0.2 * i, { color: i % 2 ? '#7d7a62' : '#6f6d58' }); kit.campfire(0, 0); kit.house('hut', 18, -6, -0.8, { w: 5 }); kit.crates(-10, -6, 0.3, 3); kit.table(8, 4, 0.2); kit.radio(8.5, 4.2, 0.2); kit.flag(-4, 6, '1919', 4); for (const z of [26, 30]) kit.target(-22, z, Math.PI / 2); },
  },
  start: { pos: [0, -12], facing: 0 },
  squad: [
    { id: 'yunho', name: YUNHO, role: 'marksman', outfit: 'army1933s', weapon: 'rifle_mauser', pos: [-4, -2] },
    { id: 'ganghwa', name: GANGHWA, role: 'medic', outfit: 'army1930', weapon: 'rifle_mauser', pos: [-2, -4], seed: 3 },
    { id: 'zhaofeng', name: ZHAO, role: 'scout', outfit: 'chinese_vol', weapon: 'rifle_mauser', pos: [2, -3], seed: 6 },
  ],
  npcs: [{ id: 'cs', outfit: 'chinese_vol', pos: [10, 10], detectable: false, mode: 'wander', seed: 21 }, { id: 'ks', outfit: 'army1933s', pos: [-12, 8], detectable: false, seed: 22 }],
  stations: [{ kind: 'training', pos: [-20, 24] }, { kind: 'maintenance', pos: [-10, -8] }, { kind: 'tailor', pos: [14, 8] }, { kind: 'kitchen', pos: [-3, 2] }, { kind: 'infirmary', pos: [18, -2] }, { kind: 'letters', pos: [8, 6] }, { kind: 'talk', pos: [-1, -3] }, { kind: 'supply', pos: [-12, -4] }, { kind: 'depart', pos: [0, -22] }],
});

const PASS = [[2, -90], [-4, -50], [3, -10], [-2, 30], [2, 70], [0, 92]];
export const m6b = {
  id: 'm6b', chapter: 'ch6', chapterLabel: CH,
  title: S('The Daejeonjaryeong Pass', '대전자령'), date: S('Late June 1933', '1933년 6월 말'), place: S('Daejeonjaryeong pass, Wangqing County, North Manchuria', '북만주 왕청현 대전자령'),
  unit: S('Korean Independence Army, with the Jilin National Salvation Army', '한국독립군, 길림구국군과 연합'),
  protagonist: { id: 'donggyu', name: DONGGYU, outfit: 'army1933s', weapon: 'rifle_mauser',
    desc: S('a 23-year-old signaller of the Korean Independence Army who runs messages between Korean and Chinese positions.', '한국과 중국 진지 사이로 전령을 뛰는 스물세 살 한국독립군 통신병.') },
  historyNote: S('In late June–early July 1933 the Korean Independence Army and the Jilin National Salvation Army ambushed a Japanese force passing through the Daejeonjaryeong pass and captured large amounts of supplies.', '1933년 6월 말~7월 초 한국독립군과 길림구국군은 대전자령 고개를 지나던 일본군을 매복 공격해 많은 군수품을 노획했다.'),
  createdNote: S('Dong-gyu, his squad, the signal runs and the decision over the captured supplies are created for the game.', '동규와 분대, 신호 전달, 노획품을 둘러싼 결정은 게임 구성이다.'),
  briefing: [
    S('A Japanese column with supply carts must cross the long pass. Korean companies wait on the south slope, Chinese companies on the north.', '보급 수레를 거느린 일본군 대열이 긴 고개를 넘어야 한다. 한국 중대는 남쪽 비탈, 중국 중대는 북쪽 비탈에서 기다린다.'),
    S('You are the signaller: confirm both sides are ready, then give one signal both can hear when the column is deep in the pass.', '당신은 통신병이다. 양쪽이 준비되었는지 확인하고, 대열이 고개 깊숙이 들어오면 양쪽 모두 들을 수 있게 단 한 번 신호하라.'),
  ],
  after: [S('After Daejeonjaryeong, relations within the alliance grew strained and Japanese pressure mounted. From late 1933 Ji Cheong-cheon and many of the army\'s leaders moved into China proper, where they would later help found the Korean Liberation Army.', '대전자령 뒤 연합 내부의 관계는 어려워지고 일본의 압박은 커졌다. 1933년 말부터 지청천과 많은 간부가 중국 관내로 옮겨 갔고, 훗날 한국광복군 창설에 참여했다.')],
  music: 'explore', combatMusic: 'combat', seed: 1933, ammo: 30, bandages: 3, holdFireUntilSignal: true,
  env: {
    biome: 'manchuria_summer', season: 'summer', time: 'overcast', weather: 'rain', grade: 'summer', ambience: { rain: 1, wind: 0.6 }, wind: 1,
    terrain: { size: 200, seed: 133, noiseAmp: 5, edgeRise: 26, features: [
      { type: 'valley', path: [[2, -100], [-4, -50], [3, -10], [-2, 30], [2, 70], [0, 100]], width: 36, floor: 4, depth: 18 },
      { type: 'road', path: PASS, width: 3 },
    ] },
    build(kit) {
      kit.forest({ x: -45, z: 0, w: 50, d: 190 }, 130, ['larch', 'oak', 'birch', 'pine']); kit.forest({ x: 45, z: 0, w: 50, d: 190 }, 130, ['larch', 'oak', 'birch', 'pine']);
      for (let i = 0; i < 60; i++) { const sx = (i % 2 ? 1 : -1) * (16 + Math.random() * 20); kit.bush(sx, -70 + Math.random() * 140, 1.2); }
      for (let i = 0; i < 14; i++) kit.rock((i % 2 ? 1 : -1) * (16 + Math.random() * 10), -40 + i * 6, 1.2, true);
      for (let i = 0; i < 3; i++) kit.cart(3 + (i % 2) * 2, 12 + i * 8, 1.5); // the supply carts, abandoned in the pass after the fight
    },
  },
  start: { pos: [-24, -40], facing: 0 },
  extraction: [-2, 90, 7],
  squad: [
    { id: 'yunho', name: YUNHO, role: 'marksman', outfit: 'army1933s', weapon: 'rifle_mauser', pos: [-26, -42] },
    { id: 'ganghwa', name: GANGHWA, role: 'medic', outfit: 'army1930', weapon: 'rifle_mauser', pos: [-24, -43], seed: 3 },
    { id: 'zhaofeng', name: ZHAO, role: 'scout', outfit: 'chinese_vol', weapon: 'rifle_mauser', pos: [-22, -42], seed: 6 },
  ],
  allies: [
    ...Array.from({ length: 6 }, (_, i) => { const p = [-20 - (i % 2) * 3, -10 + i * 7]; return { id: 'K' + i, name: S('Korean Independence Army', '한국독립군'), outfit: i % 2 ? 'army1930' : 'army1933s', weapon: 'rifle_mauser', pos: p, holdPos: p, reserve: 25, seed: 150 + i }; }),
    ...Array.from({ length: 6 }, (_, i) => { const p = [20 + (i % 2) * 3, -8 + i * 7]; return { id: 'C' + i, name: S('Jilin National Salvation Army', '길림구국군'), outfit: 'chinese_vol', weapon: 'rifle_mauser', pos: p, holdPos: p, reserve: 25, seed: 160 + i }; }),
  ],
  civilians: [
    { id: 'kc', name: S('Korean company leader (fictional)', '한국 중대장 (가상 인물)'), outfit: 'army1933s', pos: [-22, 4], facing: Math.PI / 2, detectable: false, seed: 23 },
    { id: 'cc', name: S('Chinese company leader (fictional)', '중국 중대장 (가상 인물)'), outfit: 'chinese_vol', pos: [22, 16], facing: -Math.PI / 2, detectable: false, seed: 24 },
  ],
  enemies: Array.from({ length: 14 }, (_, i) => ({ id: 'j' + i, group: 'col', outfit: 'jp_army1930', weapon: 'rifle_jp', label: 'column', pos: [(i % 2 ? 0.9 : -0.9), -94 - (i >> 1) * 1.3], viewRange: 34, accuracy: 0.85,
    column: { path: PASS, s: -i * 2.4, speed: 1.45, lateral: i % 2 ? 0.9 : -0.9, halt: true }, blindT: 99999 })),
  groups: { col: { routAt: 35, retreat: [0, -88] } },
  intro: [FACT('Late June 1933. Rain over the Daejeonjaryeong pass.', '1933년 6월 말. 대전자령 고개에 비가 내린다.', 4), SAY(ZHAO, 'In this rain they will hear nothing until the first shot.', '이 빗속이면 첫 총성 전까진 아무것도 못 들을 거요.')],
  objectives: [
    { id: 'korean', type: 'flag', flag: 'kready', marker: [-22, 4], text: S('Confirm the Korean company on the south slope is ready', '남쪽 비탈 한국 중대의 준비 확인하기') },
    { id: 'chinese', type: 'flag', flag: 'cready', marker: [22, 16], checkpoint: true, checkpointPos: [-20, 0], text: S('Cross the pass and confirm the Chinese company on the north slope', '고개를 건너 북쪽 비탈 중국 중대 확인하기'),
      onStart: (g) => g.narrate([SAY(YUNHO, 'Cross now, while the road\'s empty. Back on our side before they come.', '길이 비었을 때 지금 건너. 놈들이 오기 전에 우리 쪽으로 돌아와.')]) },
    { id: 'pos', type: 'reach', zone: [-18, 10, 6], text: S('Return to the south slope and take position by the Korean company', '남쪽 비탈로 돌아와 한국 중대 곁에 자리 잡기'),
      onComplete: (g) => { for (const e of g.enemies) e.column.halt = false; } },
    { id: 'ambush', type: 'ambush', groups: ['col'], signalAt: 100, signalLate: 128, marker: [0, 14], checkpoint: true, checkpointPos: [-18, 10],
      text: S('Hold fire. When the column is deep in the pass, give the signal to both sides (G / interact)', '사격 금지. 대열이 고개 깊숙이 들어오면 양쪽에 신호하라 (G / 상호작용)'),
      onStart: (g) => { for (const e of g.enemies) e.blindT = 0; g.squad.forEach((a) => { a.order = 'hold'; a.holdPos = [a.x, a.z]; }); },
      onSignal: (g, m, pre) => g.narrate(pre ? [SAY(YUNHO, 'They\'ve seen us — fire!', '들켰다 — 쏴!')] : [FACT('Korean and Chinese troops opened fire on the column from both slopes.', '한국군과 중국군이 양쪽 비탈에서 대열에 사격했다.', 4)]) },
    { id: 'carts', type: 'count', prefix: 'cart_', need: 3, marker: (g) => { const k = [0, 1, 2].find((i) => !g.flags.has('cart_' + i)); return k == null ? null : [3 + (k % 2) * 2, 12 + k * 8]; },
      text: S('Secure the three supply carts in the pass', '고개의 보급 수레 셋 확보하기'), xp: ['supply', 15] },
    { id: 'share', type: 'flag', flag: 'shared', marker: [8, 22], text: S('Decide with the Chinese company leader how to divide the captured supplies', '중국 중대장과 노획품 나눌 방법 정하기') },
    { id: 'out', type: 'extract', zone: [-2, 90, 7], text: S('Withdraw over the pass before Japanese reinforcements arrive', '일본군 증원이 오기 전에 고개 너머로 물러나기') },
  ],
  setup(g) {
    const [kc, cc] = g.civilians;
    talk(g, { id: 'k', actor: kc, prompt: S('Check with the Korean company leader', '한국 중대장과 확인하기'), flag: 'kready', lines: [SAY(kc.name, 'Ready. Tell the Chinese: one whistle, long, and we all fire together. Not before.', '준비됐다. 중국 쪽에 전해라. 긴 호루라기 한 번, 그때 다 같이 쏜다. 그 전엔 안 된다.')] });
    talk(g, { id: 'c', actor: cc, prompt: S('Check with the Chinese company leader', '중국 중대장과 확인하기'), flag: 'cready', enabled: (gg) => gg.flags.has('kready'), lines: [SAY(cc.name, 'One long whistle. Good. Tell your commander my men have waited two days in this rain — we will not miss.', '긴 호루라기 한 번. 좋소. 당신네 사령관께 전하시오. 우리 병사들은 이 빗속에서 이틀을 기다렸소. 놓치지 않을 거요.')] });
    [0, 1, 2].forEach((i) => g.addInteractable({ id: 'cart' + i, pos: [3 + (i % 2) * 2, 12 + i * 8], prompt: S('Secure the cart (hold)', '수레 확보 (길게)'), hold: 1.2, marker: 'item', enabled: (gg) => gg.mission.index >= 4,
      onUse: (gg) => { gg.mission.flag('cart_' + i); gg.stats.supplies++; gg.award('supply', 5, null, true); } }));
    const decide = (equal) => (gg) => {
      gg.mission.flag('shared');
      if (equal) { gg.progress.addOrg({ ammo: 30, food: 3, medicine: 1, trust: 10 }); gg.narrate([SAY(cc.name, 'Half and half. Then we fight the next one together too.', '반반이라. 그럼 다음 싸움도 함께하는 거요.'), NARR('Choosing equal shares: fewer supplies for your army, more trust between allies (game construction).', '반반 나누기: 우리 군의 보급은 줄지만 동맹의 신뢰는 커진다 (게임 구성).')]); }
      else { gg.progress.addOrg({ ammo: 50, food: 5, medicine: 2, trust: -10 }); gg.narrate([SAY(cc.name, 'You take the larger share? …I will tell my commander.', '당신네가 더 가져가겠다고? …우리 사령관께 그대로 전하겠소.'), NARR('Keeping the larger share: more supplies now, strained trust with your allies (game construction).', '더 많이 가져가기: 지금 보급은 늘지만 동맹과의 신뢰가 상한다 (게임 구성).')]); }
    };
    g.addInteractable({ id: 'eq', pos: [7, 22], prompt: S('Propose equal shares with the Chinese company', '중국 중대와 똑같이 나누자고 하기'), marker: 'item', enabled: (gg) => gg.mission.index >= 5 && !gg.flags.has('shared'), onUse: decide(true) });
    g.addInteractable({ id: 'more', pos: [9.5, 24], prompt: S('Claim the larger share for your army', '우리 군이 더 많이 가져가자고 하기'), marker: 'item', enabled: (gg) => gg.mission.index >= 5 && !gg.flags.has('shared'), onUse: decide(false) });
  },
  onSignal: null,
  failIf: (g) => (g.squad.filter((a) => a.state === 'lost').length >= 3 ? 'squadLost' : null),
  rewards: { parts: 2 },
};
