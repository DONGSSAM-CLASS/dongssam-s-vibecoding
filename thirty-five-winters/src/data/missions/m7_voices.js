// Chapter 7 — Korean Volunteer Corps on the Hubei front, 1939. Propaganda work, not a battle.
import { S, NARR, SAY, FACT, pickup, dropoff, talk, hub, near, propMesh } from './common.js';

const CH = S('Chapter 7 · Voices Across the Line', '7장 · 전선 너머의 목소리');
const HAYEON = S('Mun Ha-yeon', '문하연');
const JIYONG = S('Ha Ji-yong', '하지용');
const SUNBOK = S('Kim Sun-bok', '김순복');
const PROT = { id: 'hayeon', name: HAYEON, outfit: 'kvc1938w', weapon: 'rifle_mauser',
  desc: S('a 24-year-old former teacher from Busan who writes and broadcasts the Corps\' messages in Korean and Japanese.', '부산 출신 스물네 살 전직 교사. 조선의용대의 메시지를 우리말과 일본어로 쓰고 방송한다.') };
const SQUAD = [
  { id: 'jiyong', name: JIYONG, role: 'comm', outfit: 'kvc1938', weapon: 'rifle_mauser' },
  { id: 'sunbok', name: SUNBOK, role: 'scout', outfit: 'kvc1938', weapon: 'rifle_mauser', seed: 4 },
];

export const h7 = hub({
  id: 'h7', chapter: 'ch7', chapterLabel: CH, title: S('Corps billet behind the lines', '전선 뒤 의용대 숙영지'), date: S('Spring 1939', '1939년 봄'), place: S('A village behind the Hubei front (5th War Zone)', '후베이 전선 후방 마을 (제5전구)'),
  unit: S('Korean Volunteer Corps (조선의용대)', '조선의용대'), protagonist: PROT,
  intro: [FACT('Korean Volunteer Corps teams were attached to Chinese war zones for propaganda and intelligence work.', '조선의용대 대원들은 중국군 각 전구에 배속되어 선전과 정보 활동을 했다.', 5)],
  env: {
    biome: 'china_river', season: 'spring', time: 'day', weather: 'overcast', grade: 'monsoon', ambience: { wind: 0.4, birds: 0.6, camp: 0.5, war: 0.3 }, wind: 0.6,
    terrain: { size: 150, seed: 141, noiseAmp: 3, features: [{ type: 'flat', x: 0, z: 0, r: 30, h: 0.6, fall: 12 }, { type: 'field', x: 40, z: -30, w: 40, d: 30 }] },
    build(kit) { for (const [x, z, r] of [[-10, 10, Math.PI], [12, 12, Math.PI], [-14, -12, 0], [14, -14, 0]]) kit.house('brick', x, z, r, { w: 9 }); kit.table(0, 0, 0.3); kit.table(4, 2, -0.4); kit.crates(-6, 2, 0.2, 2); kit.campfire(-2, -6); kit.forest({ x: 0, z: 60, w: 150, d: 30 }, 40, ['bamboo', 'willow', 'poplar']); kit.forest({ x: -60, z: 0, w: 30, d: 100 }, 30, ['bamboo', 'willow']); kit.banner(6, 6, 0, 3); kit.loudspeaker(-4, 6, 0); },
  },
  start: { pos: [0, -6], facing: 0 },
  squad: SQUAD.map((s, i) => ({ ...s, pos: [-2 + i * 3, -2] })),
  npcs: [{ id: 'cn1', outfit: 'chinese_nra', pos: [8, -4], detectable: false, mode: 'wander', seed: 31 }, { id: 'kv1', outfit: 'kvc1938', pos: [-8, 4], detectable: false, seed: 32 }],
  stations: [{ kind: 'training', pos: [20, -24] }, { kind: 'maintenance', pos: [-6, 0] }, { kind: 'tailor', pos: [-12, -8] }, { kind: 'kitchen', pos: [-2, -8] }, { kind: 'infirmary', pos: [12, -10] }, { kind: 'letters', pos: [3, 2] }, { kind: 'talk', pos: [1, -3] }, { kind: 'supply', pos: [-14, 6] }, { kind: 'depart', pos: [0, -20] }],
});

const WALLS = [[-18, 6], [6, 14], [22, 2]];
export const m7 = {
  id: 'm7', chapter: 'ch7', chapterLabel: CH,
  title: S('Words for the Other Side', '건너편에 보내는 말'), date: S('1939, a rainy night', '1939년, 비 내리는 밤'), place: S('No-man\'s land on the Hubei front', '후베이 전선의 무인 지대'),
  unit: S('Propaganda team, Korean Volunteer Corps', '조선의용대 선전조'), protagonist: PROT,
  historyNote: S('Korean Volunteer Corps members wrote slogans in Japanese on walls near the front, left leaflets, broadcast to Japanese positions and questioned prisoners — appealing to Japanese soldiers and to Koreans conscripted into the Japanese army.', '조선의용대원들은 전선 가까운 벽에 일본어 구호를 쓰고, 전단을 두고, 일본군 진지를 향해 방송하고, 포로를 심문했다. 일본군 병사와 일본군에 끌려온 한인을 향한 호소였다.'),
  createdNote: S('Ha-yeon, her team, the ruined village and the note from a conscript are created for the game. The slogans are shown as brush strokes, not quoted texts.', '하연과 동료, 폐허 마을, 징집병의 쪽지는 게임 구성이다. 구호는 인용문이 아닌 붓 자국으로만 나타낸다.'),
  briefing: [
    S('Between the lines lies a ruined village. Tonight, under rain, your team will paint messages on its walls, leave leaflets by a Japanese listening post, and broadcast from the old watchtower.', '전선 사이에 폐허가 된 마을이 있다. 오늘 밤 빗속에서 조는 그 벽에 메시지를 쓰고, 일본군 청음초 곁에 전단을 두고, 낡은 망루에서 방송한다.'),
    S('A broadcast gives your position away. Have your squad cover the approaches, and leave as soon as it ends.', '방송은 위치를 드러낸다. 분대에 접근로를 엄호하게 하고, 끝나면 곧바로 떠나라.'),
  ],
  after: [
    S('From 1941 most of the Corps moved north into the Taihang Mountains; in July 1942 that main body became the Korean Volunteer Army under the North China Korean Independence League.', '1941년부터 의용대 대부분이 북쪽 타이항산으로 이동했고, 1942년 7월 그 주력은 화북조선독립동맹 산하 조선의용군이 되었다.'),
    S('Those who stayed in Chongqing with Kim Won-bong joined the Korean Liberation Army in 1942 as its 1st Detachment. The two paths divided here.', '김원봉과 함께 충칭에 남은 이들은 1942년 한국광복군에 합류해 제1지대가 되었다. 두 길이 이렇게 갈라졌다.'),
  ],
  music: 'explore', combatMusic: 'combat', seed: 1939, ammo: 20, bandages: 2,
  env: {
    biome: 'china_river', season: 'spring', time: 'night', weather: 'rain', grade: 'night', ambience: { rain: 1, wind: 0.5, war: 0.6, frogs: 0.6 }, wind: 0.8,
    terrain: { size: 200, seed: 143, noiseAmp: 2.5, waterLevel: -1.2, edgeRise: 18, features: [
      { type: 'flat', x: 0, z: 8, r: 30, h: 0.4, fall: 10 }, { type: 'field', x: -40, z: -30, w: 40, d: 30 }, { type: 'field', x: 40, z: -34, w: 36, d: 30 },
      { type: 'river', path: [[-100, -64], [0, -60], [100, -66]], width: 10, depth: 3 },
      { type: 'road', path: [[0, -90], [0, 8], [4, 60], [0, 90]], width: 2 }, { type: 'hill', x: 0, z: 74, r: 30, h: 5 },
    ] },
    build(kit, ctx) {
      for (const [x, z, r] of [[-18, 10, 0], [6, 18, Math.PI], [24, 6, -Math.PI / 2], [-6, -6, 0.2], [16, -10, 0.4]]) kit.house('ruin', x, z, r, { w: 8 });
      kit.house('pavilion', -24, -14, 0.3, { w: 6, d: 5 }); // the old watchtower / shrine hall
      kit.trenchLine([[-50, 62], [-20, 66], [10, 64], [40, 60]]); // Japanese line, north
      kit.wall(-8, 56, 8, 56, 1.3, 'sandbag'); // listening post
      kit.trenchLine([[-50, -80], [0, -84], [50, -80]]); // Chinese line, south
      kit.forest({ x: -70, z: 10, w: 40, d: 100 }, 50, ['bamboo', 'willow', 'dead']); kit.forest({ x: 70, z: 10, w: 40, d: 100 }, 50, ['bamboo', 'willow', 'dead']);
      kit.crops({ x: -40, z: -30, w: 40, d: 30 }, 'grass'); kit.crops({ x: 40, z: -34, w: 36, d: 30 }, 'grass');
      for (let i = 0; i < 30; i++) kit.bush(-60 + Math.random() * 120, -50 + Math.random() * 100, 1.1);
      kit.bridge(-3, -70, -3, -52, 2.4, 0.2);
      ctx.level.walls = WALLS;
    },
  },
  start: { pos: [0, -76], facing: 0 },
  extraction: [0, -78, 7],
  squad: SQUAD.map((s, i) => ({ ...s, pos: [-2 + i * 3, -78] })),
  enemies: [
    { id: 'lp1', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'sentry', pos: [-3, 57.5], facing: Math.PI, viewRange: 30, fov: 1.6, scanArc: 1.8 },
    { id: 'lp2', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'sentry', pos: [4, 57.5], facing: Math.PI, viewRange: 30, fov: 1.6, scanArc: 1.8 },
    { id: 'pt1', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'patrol', pos: [30, 40], route: [[40, 44, 3], [-30, 44, 3]], pingpong: true, viewRange: 26, fov: 1.6, lantern: true },
    { id: 'pt2', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'patrol', pos: [-30, 30], route: [[-34, 30, 4], [-10, 24, 4], [10, 30, 4]], viewRange: 24, fov: 1.6 },
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'tr' + i, group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'soldier', pos: [-40 + i * 15, 66], facing: Math.PI, viewRange: 30, fov: 1.5, scanArc: 1.2 })),
  ],
  groups: { jp: { routAt: 10, retreat: [0, 80] } },
  intro: [NARR('Rain on the paddies. Somewhere north, a Japanese sentry coughs.', '논 위로 비가 내린다. 북쪽 어딘가에서 일본군 보초가 기침한다.'), SAY(JIYONG, 'Brushes, paint, leaflets, the speaker. And no shooting unless they make us.', '붓, 먹, 전단, 확성기. 그리고 놈들이 어쩔 수 없게 만들기 전엔 쏘지 않는다.')],
  objectives: [
    { id: 'paint', type: 'count', prefix: 'paint_', need: 3, marker: (g) => { const k = [0, 1, 2].find((i) => !g.flags.has('paint_' + i)); return k == null ? null : WALLS[k]; }, text: S('Paint messages on three walls of the ruined village (hold)', '폐허 마을의 벽 세 곳에 메시지 쓰기 (길게)'), xp: ['intel', 10] },
    { id: 'leaflets', type: 'flag', flag: 'leaflets', marker: [0, 50], checkpoint: true, checkpointPos: [0, 4], text: S('Leave the leaflet bundle near the Japanese listening post', '일본군 청음초 근처에 전단 꾸러미 두기') },
    { id: 'tower', type: 'flag', flag: 'speaker', marker: [-24, -14], checkpoint: true, checkpointPos: [0, 30], text: S('Set up the loudspeaker in the old hall — post your squad to cover the approaches first', '낡은 전각에 확성기 설치하기 — 먼저 분대를 접근로 엄호에 배치하라') },
    { id: 'broadcast', type: 'hold', timer: 45, zone: [-24, -14, 10], text: S('Broadcast: stay by the speaker until the message has been read out', '방송: 메시지를 다 읽을 때까지 확성기 곁에 머물기'),
      onStart: (g, m) => { g.narrate([SAY(JIYONG, '(into the speaker, in Japanese) Soldiers! Your families are waiting… (the rest is lost in the rain)', '(확성기에 일본어로) 병사들이여! 고향의 가족이 기다리고 있다… (나머지는 빗소리에 묻힌다)'), SAY(HAYEON, '(in Korean) To the Korean men in their ranks: you were taken from your homes. You do not have to die for them.', '(우리말로) 일본군 속의 조선 청년들이여. 당신들은 집에서 끌려왔다. 그들을 위해 죽지 않아도 된다.')]); m.bT = 0;
        // the broadcast draws a search party toward the hall
        for (const e of g.enemies) if (e.active && (e.id === 'pt1' || e.id === 'pt2')) { e.lastKnown = { x: -24, z: -14, t: g.time }; e.mode = 'search'; e.searchT = 0; e.path = null; }
        for (let i = 0; i < 4; i++) g.spawnEnemy({ id: 'sp' + i, group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'patrol', pos: [-30 + i * 4, 62], mode: 'search', viewRange: 26, fov: 1.6 }).lastKnown = { x: -24, z: -14, t: g.time }; } },
    { id: 'out', type: 'extract', zone: [0, -78, 7], text: S('Done. Back across the bridge to the Chinese lines — now', '끝났다. 다리를 건너 중국군 전선으로 — 지금'),
      onStart: (g) => g.narrate([SAY(SUNBOK, 'Lanterns coming down the road — go, go!', '등불이 길로 내려온다 — 가, 가!')]) },
  ],
  optional: [
    { id: 'note', text: S('Find the note a Korean conscript left under the loose stone', '한인 징집병이 헐거운 돌 밑에 남긴 쪽지 찾기'), check: (g, m) => m.has('note'), xp: ['intel', 15], onComplete: (g) => g.progress.addOrg({ network: 6 }) },
    { id: 'noshot', text: S('Finish without firing a shot', '한 발도 쏘지 않고 끝내기'), check: (g, m) => m.index >= 5 && g.stats.shots === 0, fail: (g) => g.stats.shots > 0, xp: ['teamwork', 15] },
  ],
  tick(g, m, dt) {
    if (m.current?.id !== 'broadcast') return;
    m.bT = (m.bT || 0) - dt;
    if (m.bT <= 0) { m.bT = 4.5; g.audio.voice({ x: -24, y: 3, z: -14 }, 4, { pitch: m.bT % 2 ? 150 : 210, gain: 0.5 }); g.noise(-24, -14, 90, 'voice', null); }
  },
  setup(g) {
    WALLS.forEach(([x, z], i) => g.addInteractable({ id: 'wall' + i, pos: [x, z], prompt: S('Paint a message (hold)', '메시지 쓰기 (길게)'), hold: 3, channel: 'treat', marker: 'item',
      onUse: (gg) => { gg.mission.flag('paint_' + i); gg.audio.cloth(); const m = propMesh(gg, 'clue', x, z, gg.groundY(x, z) + 1.4); m.rotation.x = Math.PI / 2; m.scale.set(2.4, 1, 1.4); gg.award('intel', 3, null, true); } }));
    pickup(g, { id: 'bundle', pos: [1, -74], kind: 'leaflets', carry: true, prompt: S('Take the leaflet bundle', '전단 꾸러미 챙기기'), hold: 0.4 });
    dropoff(g, { id: 'lp', pos: [0, 50], kind: 'leaflets', prompt: S('Leave the leaflets weighed down with a stone', '전단을 돌로 눌러 두기'), flag: 'leaflets', enabled: (gg) => gg.mission.index >= 1 });
    pickup(g, { id: 'speaker', pos: [2, -76], kind: 'loudspeaker', carry: true, prompt: S('Shoulder the loudspeaker', '확성기 메기'), hold: 0.5, enabled: (gg) => gg.flags.has('leaflets') && !gg.player.carryItem });
    dropoff(g, { id: 'hall', pos: [-24, -11], kind: 'loudspeaker', prompt: S('Set up the loudspeaker', '확성기 설치하기'), flag: 'speaker', onUse: (gg) => propMesh(gg, 'loudspeaker', -24, -12, gg.groundY(-24, -12) + 1.2) });
    g.addInteractable({ id: 'stone', pos: [10, 22], prompt: S('Look under the loose stone', '헐거운 돌 밑을 살피기'), marker: 'clue', hold: 0.8, onUse: (gg) => { gg.mission.flag('note'); gg.journalAdd('clue', null, null, S('Note in Korean: "Thirty of us in the 3rd company are Korean. Keep broadcasting."', '우리말 쪽지: "3중대에 조선 사람 서른 명이 있소. 방송을 계속해 주시오."')); gg.narrate([SAY(HAYEON, '(reading) "Thirty of us in the 3rd company are Korean. Keep broadcasting." …They heard us.', '(읽으며) "3중대에 조선 사람 서른 명이 있소. 방송을 계속해 주시오." …들었구나.')]); } });
  },
  failIf: (g) => (g.squad.filter((a) => a.state === 'lost').length >= 2 ? 'squadLost' : null),
  rewards: { network: 8, funds: 2 },
};
