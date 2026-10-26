// Chapter 3 — Bongo-dong, June 1920: base in the upper village, then the lure and the ambush.
import { S, NARR, SAY, FACT, talk, hub, near } from './common.js';
import { distToPolyline } from '../../engine/util.js';

const TAEJUN = S('Park Tae-jun', '박태준');
const MANSEOK = S('Yi Man-seok', '이만석');
const CHANGGEUN = S('Choe Chang-geun', '최창근');
const YONGDAL = S('Kim Yong-dal', '김용달');
const CAPT = S('Company commander (fictional)', '중대장 (가상 인물)');
const CH = S('Chapter 3 · Bongo-dong', '3장 · 봉오동');
const PROT = { id: 'taejun', name: TAEJUN, outfit: 'army1920', weapon: 'rifle_mosin',
  desc: S('a 24-year-old former charcoal-burner from Musan, now a rifleman in the combined force.', '무산에서 숯을 굽던 스물네 살 청년. 연합 부대의 소총수.') };
const SQUAD = [
  { id: 'manseok', name: MANSEOK, role: 'scout', outfit: 'army1920b', weapon: 'rifle_mosin' },
  { id: 'changgeun', name: CHANGGEUN, role: 'marksman', outfit: 'army1920', weapon: 'rifle_mosin', seed: 3 },
  { id: 'yongdal', name: YONGDAL, role: 'comm', outfit: 'army1920b', weapon: 'rifle_mosin', seed: 5 },
];

const ROAD = [[0, -88], [-2, -60], [3, -30], [0, -8], [-3, 20], [0, 45], [2, 70]];
const terrainBongo = (extra = []) => ({ size: 200, seed: 61, noiseAmp: 4, edgeRise: 24, backdropHeight: 70, features: [
  { type: 'valley', path: [[0, -100], [-2, -60], [3, -30], [0, 0], [-2, 30], [0, 62]], width: 44, floor: 9, depth: 15 },
  { type: 'ridge', path: [[-70, 86], [0, 84], [70, 86]], width: 16, height: 4 },
  { type: 'flat', x: 0, z: 45, r: 16, h: null, fall: 8 }, { type: 'flat', x: 0, z: -10, r: 10, h: null, fall: 8 },
  { type: 'hill', x: -14, z: -60, r: 9, h: 3 },
  { type: 'road', path: ROAD, width: 2.6 },
  ...extra] });

const villageProps = (kit) => {
  // upper village (상촌) with the training ground, middle/lower hamlets
  kit.house('choga', -10, 50, Math.PI / 2); kit.house('manchu', 10, 54, -Math.PI / 2); kit.house('choga', -8, 38, Math.PI / 2); kit.house('manchu', 12, 40, -Math.PI / 2, { w: 8 });
  kit.house('barracks', 0, 62, Math.PI, { w: 14, d: 5, roof: '#5f5446' });
  kit.fence([[-16, 30], [-16, 58]], 'brush'); kit.fence([[17, 32], [17, 58]], 'brush');
  kit.house('choga', -8, -12, Math.PI / 2); kit.house('choga', 9, -6, -Math.PI / 2);
  kit.pots(-12, 44); kit.well(4, 48); kit.hay(-14, -4); kit.hay(14, 30);
  kit.crops({ x: -10, z: 10, w: 12, d: 14 }); kit.crops({ x: 12, z: 18, w: 10, d: 12 });
};
const slopes = (kit) => {
  kit.forest({ x: -50, z: 0, w: 46, d: 190 }, 120, ['larch', 'oak', 'birch', 'pine'], [], [0.9, 1.3]);
  kit.forest({ x: 50, z: 0, w: 46, d: 190 }, 120, ['larch', 'oak', 'birch', 'pine'], [], [0.9, 1.3]);
  kit.forest({ x: 0, z: 88, w: 160, d: 18 }, 40, ['larch', 'pine', 'oak']);
  for (let i = 0; i < 60; i++) { const sx = (i % 2 ? 1 : -1) * (24 + Math.random() * 26); kit.bush(sx, -80 + Math.random() * 160, 1 + Math.random() * 0.4); }
  for (let i = 0; i < 18; i++) { const sx = (i % 2 ? 1 : -1) * (26 + Math.random() * 18); kit.rock(sx, -60 + Math.random() * 130, 1 + Math.random() * 0.5, true); }
};

export const h3 = hub({
  id: 'h3', chapter: 'ch3', chapterLabel: CH, title: S('Upper village, Bongo-dong', '봉오동 상촌'), date: S('Early June 1920', '1920년 6월 초'), place: S('Bongo-dong, Wangqing County', '왕청현 봉오동'),
  unit: S('Combined force (Hong Beom-do · Choe Jin-dong · An Mu)', '연합 부대 (홍범도 · 최진동 · 안무)'), protagonist: PROT,
  intro: [FACT('Bongo-dong was a base of the independence armies; the upper village had a training ground, and Choe Jin-dong\'s family lived here.', '봉오동은 독립군의 근거지였다. 상촌에는 훈련장이 있었고 최진동의 가족이 이곳에 살았다.', 6)],
  env: {
    biome: 'manchuria_summer', season: 'summer', time: 'day', weather: 'clear', grade: 'summer', ambience: { wind: 0.5, birds: 1, insects: 0.6, camp: 0.6 }, wind: 0.6,
    terrain: terrainBongo(),
    build(kit) { villageProps(kit); slopes(kit); kit.flag(-2, 34, '1919', 5); kit.campfire(4, 30); kit.table(-4, 28, 0.3); kit.crates(8, 26, 0.2, 3); kit.crates(-6, 24, 0, 2, 'sack'); for (const z of [70, 74, 78]) kit.target(-12, z, Math.PI / 2); },
  },
  start: { pos: [0, 24], facing: 0 },
  squad: SQUAD.map((s, i) => ({ ...s, pos: [-3 + i * 2, 30] })),
  npcs: [
    { id: 'v1', outfit: 'settler_w', pos: [-8, 46], mode: 'wander', detectable: false },
    { id: 'v2', outfit: 'child', pos: [6, 50], mode: 'wander', detectable: false },
    { id: 's1', outfit: 'army1920', pos: [-6, 66], detectable: false, facing: Math.PI, seed: 11 },
    { id: 's2', outfit: 'army1920b', pos: [6, 68], detectable: false, mode: 'wander', seed: 12 },
  ],
  stations: [
    { kind: 'training', pos: [-8, 72] }, { kind: 'maintenance', pos: [-4, 28] }, { kind: 'tailor', pos: [-12, 42] },
    { kind: 'kitchen', pos: [4, 32] }, { kind: 'infirmary', pos: [12, 44] }, { kind: 'letters', pos: [-10, 52] },
    { kind: 'talk', pos: [1, 28] }, { kind: 'supply', pos: [8, 24] }, { kind: 'depart', pos: [0, 16] },
  ],
});

export const m3 = {
  id: 'm3', chapter: 'ch3', chapterLabel: CH,
  title: S('The Valley of Phoenix Trees', '봉오동'), date: S('7 June 1920', '1920년 6월 7일'), place: S('Bongo-dong, Wangqing County', '왕청현 봉오동'),
  unit: S('Lure detachment, combined force', '연합 부대 유인조'), protagonist: PROT,
  historyNote: S('A small unit drew the pursuing Japanese force into the valley; companies on the east, west and north heights waited around the upper village and fired from three sides. Platoon leader Yi Hwa-il is named in accounts of the luring.', '소부대가 추격해 온 일본군을 계곡으로 끌어들였고, 상촌을 둘러싼 동·서·북 고지의 중대들이 세 방향에서 사격했다. 기록에는 유인을 맡은 소대장 이화일이 나온다.'),
  createdNote: S('Tae-jun\'s squad, their exact route and the company commander are fictional. Orders from the real commanders are paraphrased, never quoted.', '태준의 분대, 그들이 지난 길, 중대장은 가상이다. 실제 지휘관의 명령은 풀어 쓴 것이며 인용이 아니다.'),
  briefing: [
    S('A Japanese battalion has crossed the Tumen in pursuit. The command\'s plan: draw it up the valley to the upper village, where companies wait on three sides.', '일본군 대대가 두만강을 건너 추격해 왔다. 지휘부의 계획: 적을 골짜기 위쪽 상촌까지 끌어들이고, 세 방향에서 중대들이 기다린다.'),
    S('Your squad is part of the lure. Watch their vanguard, fire to be seen, then fall back up the valley without being caught. Then join your company on the west heights and wait for the column to enter the trap.', '당신의 분대는 유인조다. 선발대를 관찰하고, 보이게 사격한 뒤 붙잡히지 않게 골짜기 위로 물러나라. 이어 서쪽 고지의 중대에 합류해 대열이 함정에 들어오기를 기다려라.'),
    S('Do not fire before the signal. A trap that closes early catches nothing.', '신호 전에 쏘지 마라. 일찍 닫힌 함정에는 아무것도 걸리지 않는다.'),
  ],
  after: [
    S('The Japanese force withdrew from Bongo-dong. The battle raised the morale of the independence armies; Korean and Japanese accounts of its losses differ widely.', '일본군은 봉오동에서 퇴각했다. 이 전투는 독립군의 사기를 크게 높였으며, 피해 규모는 한국 측과 일본 측 기록이 크게 다르다.'),
    S('Within months Japan sent a far larger force into Gando.', '몇 달 뒤 일본은 훨씬 큰 병력을 간도에 보냈다.'),
  ],
  music: 'explore', combatMusic: 'combat', seed: 1920, ammo: 30, bandages: 3, holdFireUntilSignal: true,
  env: {
    biome: 'manchuria_summer', season: 'summer', time: 'day', weather: 'overcast', grade: 'summer', ambience: { wind: 0.7, birds: 0.6, insects: 0.4 }, wind: 0.9,
    light: { sunI: 1.6 },
    terrain: terrainBongo(),
    build(kit) { villageProps(kit); slopes(kit); kit.rock(-16, -62, 1.2, true); kit.rock(-11, -58, 1.0); kit.log(-17, -56, 0.8, 4);
      kit.wall(36, 16, 42, 22, 0.9, 'earth'); kit.wall(30, 26, 38, 30, 0.9, 'earth'); kit.wall(-36, 26, -42, 32, 0.9, 'earth'); kit.wall(-8, 80, 8, 80, 0.9, 'earth'); },
  },
  start: { pos: [-14, -60], facing: Math.PI },
  rally: [0, -8],
  extraction: [0, 84, 7],
  squad: SQUAD.map((s, i) => ({ ...s, pos: [-16 - i * 1.5, -57 - i] })),
  allies: [
    ...[[34, 18], [38, 25], [31, 29]].map((p, i) => ({ id: 'w' + i, name: S('West-heights company', '서쪽 고지 중대'), outfit: i % 2 ? 'army1920b' : 'army1920', weapon: 'rifle_mosin', pos: p, holdPos: p, reserve: 20, seed: 20 + i })),
    ...[[-34, 22], [-38, 30], [-31, 36]].map((p, i) => ({ id: 'e' + i, name: S('East-heights company', '동쪽 고지 중대'), outfit: i % 2 ? 'army1920' : 'army1920b', weapon: 'rifle_mosin', pos: p, holdPos: p, reserve: 20, seed: 30 + i })),
    ...[[-6, 78], [0, 80], [6, 78]].map((p, i) => ({ id: 'n' + i, name: S('North-heights company', '북쪽 고지 중대'), outfit: 'army1920b', weapon: 'rifle_mosin', pos: p, holdPos: p, reserve: 20, seed: 40 + i })),
    ...[[28, -4], [33, 2]].map((p, i) => ({ id: 's' + i, name: S('Southwest-slope company', '남서 산허리 중대'), outfit: 'army1920', weapon: 'rifle_mosin', pos: p, holdPos: p, reserve: 20, seed: 50 + i })),
  ],
  enemies: [
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'v' + i, group: 'van', outfit: 'jp_army1920', weapon: 'rifle_jp', label: 'patrol', pos: [0, -88 - i * 3], viewRange: 42, column: { path: ROAD, s: -i * 3, speed: 1.15, lateral: i % 2 ? 0.8 : -0.8 }, accuracy: 0.9 })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: 'c' + i, group: 'main', outfit: 'jp_army1920', weapon: 'rifle_jp', label: 'column', pos: [(i % 2 ? 1 : -1) * 0.9, -88 - (i >> 1) * 1.2], viewRange: 40, column: { path: ROAD, s: -14 - i * 2.4, speed: 1.55, lateral: i % 2 ? 0.9 : -0.9, halt: true }, accuracy: 0.9, blindT: 99999 })),
  ],
  groups: { van: { routAt: 20, retreat: [0, -86] }, main: { routAt: 30, retreat: [0, -86] } },
  intro: [
    FACT('7 June 1920. A Japanese force that crossed the Tumen is following the road into the Bongo-dong valley.', '1920년 6월 7일. 두만강을 건너온 일본군이 봉오동 골짜기로 이어진 길을 따라 들어오고 있다.', 5),
    SAY(MANSEOK, 'Their scouts first. Watch how they move before we show ourselves.', '먼저 척후가 온다. 우리를 드러내기 전에 어떻게 움직이는지 봐 둬.'),
  ],
  objectives: [
    { id: 'watch', type: 'observe', group: 'van', need: 3, marker: [0, -84], text: S('Observe the Japanese vanguard coming up the road (binoculars help)', '길을 따라 올라오는 일본군 선발대 관찰하기 (망원경이 도움이 된다)') },
    { id: 'lure', type: 'flag', flag: 'lured', marker: (g) => { const v = g.enemies.find((e) => e.group === 'van' && e.active); return v ? [v.x, v.z] : null; }, text: S('Fire on the vanguard so they see you and give chase', '선발대에 사격해 그들이 보고 쫓아오게 하기'),
      onStart: (g) => g.narrate([SAY(CHANGGEUN, 'One shot, close enough to sting. Then we run like we mean it.', '한 발이면 돼. 따끔할 만큼만. 그다음엔 진짜처럼 뛰는 거야.')]) },
    { id: 'fallback', type: 'reach', zone: [0, -8, 7], withSquad: true, checkpoint: true, checkpointPos: [-14, -56], text: S('Fall back up the valley to the lower hamlet — stay ahead, stay together', '골짜기 위 하촌까지 물러나기 — 앞서되, 함께'),
      onStart: (g) => { g.squadCommand('follow'); } },
    { id: 'climb', type: 'reach', zone: [34, 22, 6], withSquad: true, checkpoint: true, checkpointPos: [0, -6], text: S('Climb to your company on the west heights', '서쪽 고지의 중대에 합류하기'),
      onStart: (g) => {
        g.narrate([SAY(YONGDAL, 'They\'ve stopped chasing — they\'re regrouping with the column. It worked. Up the slope, quick!', '추격을 멈췄다 — 본대와 합치고 있어. 먹혔어. 빨리 비탈 위로!')]);
        for (const e of g.enemies) if (e.group === 'van' && e.active) { const { t } = distToPolyline(e.x, e.z, ROAD); e.mode = 'column'; e.column.s = t * 158 + 6; e.column.halt = false; e.column.speed = 1.3; e.awareOf = null; e.blindT = 45; e.path = null; for (const k of e.detect.keys()) e.detect.set(k, 0); }
      } },
    { id: 'ambush', type: 'ambush', groups: ['van', 'main'], watchGroups: ['main'], signalAt: 124, signalLate: 150, marker: [0, 40], checkpoint: true, checkpointPos: [34, 22],
      text: S('Hold fire. When the column\'s head reaches the upper village, give the signal (G / interact)', '사격 금지. 대열의 선두가 상촌에 이르면 신호하라 (G / 상호작용)'),
      onStart: (g) => { for (const e of g.enemies) if (e.group === 'main') e.blindT = 0; g.narrate([SAY(CAPT, 'Down, all of you. Not a sound. I fire on your word — when their head is in the village and their tail is past the bend.', '모두 엎드려. 소리 내지 마라. 네 말에 쏜다 — 선두가 마을에 들고 꼬리가 굽이를 지났을 때.'), FACT('On the heights around the upper village the companies waited in ambush.', '상촌을 둘러싼 고지에서 중대들이 매복해 기다렸다.', 4)]); g.squad.forEach((a) => { a.order = 'hold'; a.holdPos = [a.x, a.z]; }); },
      onSignal: (g, m, premature) => { g.narrate(premature ? [SAY(CAPT, 'Too soon — they\'re deploying! Fire, fire!', '너무 일러 — 산개한다! 쏴, 쏴!')] : [SAY(CAPT, 'Now! All companies — fire!', '지금이다! 전 중대 — 사격!'), FACT('The companies on the east, west and north heights opened fire on the column.', '동·서·북 고지의 중대들이 대열에 일제히 사격했다.', 4)]); } },
    { id: 'carry', type: 'carry', actor: 'yongdal', zone: [36, 26, 4], marker: (g) => { const y = g.squad.find((a) => a.id === 'yongdal'); return y ? [y.x, y.z] : null; },
      text: S('Yong-dal was hit running a message — reach him, treat him and carry him to the aid post on the ridge', '전령으로 뛰던 용달이 맞았다 — 응급처치하고 능선 구호소까지 업어 오기'),
      onStart: (g) => {
        const y = g.squad.find((a) => a.id === 'yongdal');
        if (y && y.state !== 'lost') { y.x = 18; y.z = 30; y.y = g.groundY(18, 30); y.state = 'wounded'; y.treated = false; y.severe = true; y.timesDowned = 1; y.bleedT = 70 * g.diff.bleed; g.say(y, 'hit'); }
        else g.mission.flag('yongdalGone');
      } },
    { id: 'withdraw', type: 'extract', zone: [0, 84, 7], text: S('The enemy has withdrawn. Move everyone to the north ridge before their reinforcements come', '적이 물러났다. 증원이 오기 전에 모두 북쪽 능선으로 이동하기'),
      onStart: (g) => g.narrate([SAY(CAPT, 'Don\'t chase them. Gather the wounded and go — the whole army will come after this.', '쫓지 마라. 부상자를 거두고 떠난다. 이 뒤에는 대군이 올 거다.')]) },
  ],
  optional: [
    { id: 'clean', text: S('Signal at the right moment (no early contact)', '정확한 순간에 신호하기 (조기 접촉 없이)'), check: (g, m) => m.signalled && !m.premature, fail: (g, m) => m.signalled && m.premature, xp: ['teamwork', 15] },
    { id: 'nolost', text: S('No one in your squad is lost', '분대원을 아무도 잃지 않기'), check: (g, m) => m.index >= 6 && g.squad.every((a) => a.state !== 'lost'), fail: (g) => g.squad.some((a) => a.state === 'lost'), xp: ['rescue', 20] },
  ],
  triggers: [
    { when: (g, m) => m.index === 1 && g.enemies.some((e) => e.group === 'van' && e.mode === 'combat'), do: (g, m) => m.flag('lured') },
    { when: (g, m) => m.has('lured'), do: (g) => { for (const e of g.enemies) if (e.group === 'van' && e.active && e.mode !== 'combat') e.enterCombat(g.player); for (const e of g.enemies) if (e.group === 'main') e.column.halt = false; g.narrate([SAY(MANSEOK, 'They\'ve seen us — back, back! Keep the trees between us!', '봤다 — 물러나, 물러나! 나무를 사이에 두고!')]); } },
    { when: (g, m) => m.current?.id === 'carry' && (m.has('yongdalGone') || g.squad.find((a) => a.id === 'yongdal')?.state === 'lost'), do: (g, m) => { m.index++; m.beginObjective(); } },
  ],
  failIf: (g) => (g.squad.filter((a) => a.state === 'lost').length >= 3 ? 'squadLost' : null),
  rewards: { ammo: 25, parts: 2, food: 1 },
  setup(g) {
    g.allies.filter((a) => !a.squad).forEach((a) => { a.order = 'hold'; a.crouch = true; });
  },
};
