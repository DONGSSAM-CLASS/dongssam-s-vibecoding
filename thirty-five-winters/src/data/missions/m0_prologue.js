// Prologue — Hanseong, 29 August 1910, evening. Stealth / controls tutorial. Unarmed courier.
import { S, NARR, SAY, FACT, pickup, dropoff, talk } from './common.js';

const SEOJIN = S('Yun Seo-jin', '윤서진');
const TEACHER = S('Teacher Han', '한 선생');
const JEONG = S('Master Jeong', '정 어른');

export const m0 = {
  id: 'm0', chapter: 'prologue', chapterLabel: S('Prologue · 1910', '프롤로그 · 1910'),
  title: S('The Last Summer', '마지막 여름'), date: S('29 August 1910', '1910년 8월 29일'), place: S('Hanseong (Seoul)', '한성(서울)'),
  unit: S('Civilian courier (no weapon)', '민간 연락원 (비무장)'),
  protagonist: { id: 'seojin', name: SEOJIN, outfit: 'hanbok_m', weapon: 'none',
    desc: S('a 17-year-old bookshop apprentice who runs errands for a night-school teacher.', '야학 선생님의 심부름을 하는 열일곱 살 책방 견습생.') },
  historyNote: S('On this day the annexation treaty, signed on 22 August, was proclaimed. Gendarmes and police watched the streets.', '이날 8월 22일에 조인된 병합 조약이 공포되었다. 헌병과 경찰이 거리를 지켰다.'),
  createdNote: S('Seo-jin, Teacher Han, the Jeong family, the letter and this neighbourhood\'s layout are fictional.', '윤서진, 한 선생, 정씨 집안, 편지, 이 동네의 모습은 창작이다.'),
  briefing: [
    S('Teacher Han has a letter that must reach Master Jeong near the West Gate tonight. The streets are full of gendarmes.', '한 선생님에게 오늘 밤 서대문 근처 정 어른께 꼭 전해야 할 편지가 있다. 거리에는 헌병이 가득하다.'),
    S('You carry no weapon. If a gendarme stops you, the letter is lost. Watch their routes, use shadows and carts, and cross when backs are turned.', '당신은 무기가 없다. 헌병에게 붙잡히면 편지를 잃는다. 순찰 경로를 지켜보고, 그늘과 수레를 이용해 등을 돌렸을 때 건너라.'),
  ],
  after: [
    S('From late 1910 families such as Yi Hoe-yeong\'s and Yi Sang-ryong\'s sold their property and crossed the Amnok River to build a base in West Gando. The Jeongs in this story stand for families like them.', '1910년 말부터 이회영·이상룡 일가 등이 재산을 정리하고 압록강을 건너 서간도에 기지를 세웠다. 이 이야기의 정씨 집안은 그런 집안들을 대신한다.'),
  ],
  music: 'explore', combatMusic: 'combat', seed: 1910, ammo: 0, bandages: 1,
  env: {
    biome: 'seoul_summer', season: 'summer', time: 'dusk', weather: 'clear', grade: 'sepia1910', region: 'seoul',
    ambience: { city: 1, insects: 0.8, wind: 0.3 }, wind: 0.5,
    terrain: { size: 180, seed: 21, noiseAmp: 1.6, detailAmp: 0.1, edgeRise: 26, backdropHeight: 70, features: [
      { type: 'flat', x: 0, z: 0, w: 170, d: 14, h: 0.4, fall: 6 },
      { type: 'road', path: [[-90, 0], [90, 0]], width: 11 },
      { type: 'road', path: [[24, 0], [24, 60]], width: 3.5 },
      { type: 'road', path: [[-30, 0], [-30, -48], [-56, -48]], width: 3.2 },
      { type: 'hill', x: -20, z: 75, r: 50, h: 9 }, { type: 'hill', x: 60, z: -70, r: 45, h: 7 },
    ] },
    build(kit) {
      // north side of the main street
      const north = [[-62, 13, 'giwa'], [-46, 12, 'shophouse'], [-14, 13, 'giwa'], [2, 12, 'shophouse'], [40, 13, 'giwa'], [56, 12, 'shophouse'], [70, 13, 'giwa']];
      for (const [x, z, t] of north) kit.house(t, x, z, Math.PI, t === 'shophouse' ? { w: 8, d: 7, color: '#8f8578', lantern: true } : { w: 11 });
      const south = [[-70, -13, 'giwa'], [-50, -12, 'shophouse'], [-12, -13, 'giwa'], [6, -12, 'shophouse'], [24, -13, 'giwa'], [44, -12, 'shophouse'], [62, -13, 'giwa']];
      for (const [x, z, t] of south) kit.house(t, x, z, 0, t === 'shophouse' ? { w: 8, d: 7, color: '#85796b', lantern: true } : { w: 11 });
      // bookshop courtyard (start) and the alley north
      kit.house('giwa', 34, 40, Math.PI / 2, { w: 9, d: 5 });
      kit.house('choga', 14, 46, 0, { w: 7 });
      kit.house('choga', 10, 30, Math.PI, { w: 7 });
      kit.wall(28, 52, 44, 52, 1.6, 'stone'); kit.wall(44, 52, 44, 30, 1.6, 'stone'); kit.wall(28, 30, 44, 30, 1.6, 'stone');
      kit.wall(28, 52, 28, 44, 1.6, 'stone'); kit.wall(28, 36, 28, 30, 1.6, 'stone');
      kit.pots(40, 48); kit.well(32, 48);
      // street furniture (cover & concealment)
      kit.tramTracks([[-90, 0], [90, 0]]);
      kit.telegraph([[-88, 7.5], [88, 7.5]], 22);
      kit.cart(14, 4.5, 0.2); kit.cart(-22, -5, -0.3); kit.crates(31, -5, 0, 3, 'sack'); kit.crates(-6, 5, 0, 2); kit.crates(-40, 5.5, 0.1, 3, 'sack');
      kit.crates(50, -5.5, 0, 2); kit.cart(-60, 4.5, 0.4);
      for (const x of [-75, -35, 15, 52]) kit.lamp(x, 6.5);
      // south alley to the West Gate quarter
      kit.house('giwa', -42, -30, Math.PI / 2, { w: 10 }); kit.house('choga', -18, -32, -Math.PI / 2, { w: 8 });
      kit.house('choga', -18, -50, -Math.PI / 2, { w: 8 }); kit.house('giwa', -44, -62, 0, { w: 10 });
      kit.wall(-36, -22, -36, -40, 1.8, 'stone'); kit.wall(-24, -22, -24, -42, 1.8, 'stone');
      kit.hay(-27, -36); kit.crates(-33, -44, 0.3, 2, 'sack');
      // the Jeong house
      kit.house('giwa', -64, -40, Math.PI / 2, { w: 10, d: 6 });
      kit.wall(-70, -30, -52, -30, 1.7, 'stone'); kit.wall(-70, -52, -52, -52, 1.7, 'stone'); kit.wall(-52, -52, -52, -44, 1.7, 'stone'); kit.wall(-52, -36, -52, -30, 1.7, 'stone');
      kit.pots(-58, -48);
      // trees and greenery around the edges
      kit.forest({ x: -10, z: 68, w: 150, d: 30 }, 40, ['pine', 'willow', 'oak'], [], [0.8, 1.1]);
      kit.forest({ x: 20, z: -72, w: 140, d: 24 }, 30, ['pine', 'oak'], [], [0.8, 1.1]);
      for (let i = 0; i < 16; i++) kit.bush(-80 + i * 10, 22 + (i % 3) * 2, 0.8);
      kit.tree('willow', -30, 6.5, 0.9); kit.tree('willow', 66, -6.5, 0.9);
      kit.signpost(-24, -8, 0.3);
      // hiding spots at the north alley mouth and along the back lanes
      kit.bush(21.2, 18.6, 1.0); kit.bush(27.2, 18.2, 0.9); kit.hay(19, 22);
      kit.bush(8, -21, 1); kit.bush(-6, -22, 1); kit.hay(-2, -26); kit.bush(-20, -21, 0.9);
      kit.crates(16, -22, 0.4, 2, 'sack');
    },
  },
  start: { pos: [41, 47], facing: -Math.PI * 0.62 },
  enemies: [
    { id: 'g1', outfit: 'jp_gendarme1910', weapon: 'none', label: 'gendarme', noShoot: true, pos: [32, 4.5], route: [[42, 4.5, 3], [-2, 4.5, 3]], pingpong: true, viewRange: 24, fov: 1.6, speedWalk: 1.25 },
    { id: 'g2', outfit: 'jp_gendarme1910', weapon: 'none', label: 'gendarme', noShoot: true, pos: [-8, -4.5], route: [[8, -4.5, 3], [-40, -4.5, 3]], pingpong: true, viewRange: 24, fov: 1.6, speedWalk: 1.1 },
    { id: 'g3', outfit: 'jp_gendarme1910', weapon: 'none', label: 'gendarme', noShoot: true, pos: [-27, -8.5], facing: 0, viewRange: 18, fov: 1.5, scanArc: 2.0 },
    { id: 'p1', outfit: 'jp_police1919', weapon: 'none', label: 'police', noShoot: true, pos: [-46, -48], route: [[-46, -48, 3, Math.PI / 2], [-30, -48, 3, -Math.PI / 2]], pingpong: true, viewRange: 16, fov: 1.5, speedWalk: 1.0 },
  ],
  civilians: [
    { id: 'teacher', name: TEACHER, outfit: 'scholar', pos: [30, 38], facing: Math.PI / 2, detectable: false },
    { id: 'jeong', name: JEONG, outfit: 'scholar', pos: [-58, -40], facing: Math.PI / 2, detectable: false, seed: 3 },
    { id: 'jeongw', name: S('Jeong\'s wife', '정 어른 부인'), outfit: 'hanbok_w', pos: [-60, -46], facing: 0.5, detectable: false, mode: 'wander' },
    { id: 'v1', outfit: 'hanbok_w', pos: [10, 9], mode: 'wander', detectable: false },
    { id: 'v2', outfit: 'hanbok_m', pos: [-20, -9], mode: 'wander', detectable: false, seed: 2 },
    { id: 'v3', outfit: 'scholar', pos: [52, 9], mode: 'wander', detectable: false, seed: 5 },
    { id: 'v4', outfit: 'child', pos: [-8, 9], mode: 'wander', detectable: false },
  ],
  tutorial: [
    { text: S('Use {0} to move and {1} to look around.', '{0}로 움직이고 {1}로 주위를 둘러보세요.'), actions: ['move', 'look'], until: 'move' },
    { text: S('Walk to the notice on the alley wall and press {0} to read it.', '골목 벽의 방(榜) 앞으로 가서 {0}를 눌러 읽으세요.'), actions: ['interact'], until: 'notice' },
    { text: S('Press {0} to crouch. Crouching is slower but quieter and harder to spot.', '{0}를 누르면 웅크립니다. 느리지만 조용하고 눈에 덜 띕니다.'), actions: ['crouch'], until: 'crouch' },
    { text: S('Keep a gendarme in view for a moment (or hold {0} with binoculars, later). Observed soldiers are marked and logged.', '헌병을 잠시 시야에 두세요. 관찰한 군인은 표시되고 수첩에 적힙니다.'), actions: ['binoculars'], until: 'observe' },
    { text: S('Press {0} to open the mission log: objectives, your observation journal and the map.', '{0}를 눌러 임무 기록을 여세요. 목표, 정찰 수첩, 지도가 있습니다.'), actions: ['log'], until: 'log' },
    { text: S('A ▼ marker means a soldier you can see now; a dashed circle is where you last saw one. "?" means they noticed something.', '▼ 표시는 지금 보이는 군인, 점선 원은 마지막으로 본 위치입니다. "?"는 무언가를 눈치챘다는 뜻입니다.'), actions: [], until: 'time', ms: 9000 },
    { text: S('Hold {0} to sprint — fast but loud and tiring. Gendarmes hear running feet.', '{0}를 누르고 있으면 질주합니다. 빠르지만 시끄럽고 지칩니다. 헌병은 뛰는 발소리를 듣습니다.'), actions: ['sprint'], until: 'sprint' },
  ],
  intro: [
    NARR('Hanseong. The evening of 29 August 1910.', '한성. 1910년 8월 29일 저녁.'),
    NARR('Today the notices went up on every wall.', '오늘 거리마다 방이 붙었다.'),
  ],
  objectives: [
    { id: 'notice', type: 'flag', flag: 'notice', marker: [25.5, 29], text: S('Read the notice on the alley wall', '골목 벽에 붙은 방을 읽기') },
    { id: 'letter', type: 'flag', flag: 'letter', marker: (g) => [g.civilians[0].x, g.civilians[0].z], text: S('Collect the letter from Teacher Han in the bookshop courtyard', '책방 마당의 한 선생님께 편지 받기') },
    { id: 'watch', type: 'observe', ids: ['g1', 'g2'], need: 2, marker: [24, 14], text: S('From the alley mouth, observe the two gendarmes patrolling the main street', '골목 어귀에서 큰길을 순찰하는 헌병 둘을 관찰하기') },
    { id: 'cross', type: 'reach', zone: [-30, -32, 4.5], checkpoint: true, checkpointPos: [24, 18], checkpointFacing: Math.PI, text: S('Cross the main street unseen and reach the south alley', '들키지 않고 큰길을 건너 남쪽 골목으로 가기') },
    { id: 'deliver', type: 'flag', flag: 'delivered', marker: (g) => [g.civilians[1].x, g.civilians[1].z], checkpoint: true, checkpointPos: [-30, -32], text: S('Deliver the letter to Master Jeong near the West Gate', '서대문 근처 정 어른께 편지 전하기') },
  ],
  optional: [
    { id: 'books', text: S('Hide the night school\'s books in the cellar (3)', '야학 책을 광에 숨기기 (3)'), check: (g, m) => m.count('booksHidden') >= 3, xp: ['supply', 15],
      onComplete: (g) => { g.progress.addOrg({ trust: 8 }); } },
    { id: 'unseen', text: S('Reach Master Jeong without raising suspicion', '의심을 사지 않고 정 어른께 닿기'), check: (g, m) => m.has('delivered'), fail: (g) => g.stats.alerts > 0 || g.enemies.some((e) => e.mode === 'search'), xp: ['intel', 15] },
  ],
  setup(g) {
    const [teacher, jeong] = g.civilians;
    g.addInteractable({ id: 'notice', pos: [25.5, 29], prompt: S('Read the notice', '방 읽기'), marker: 'item', onUse: (gg) => {
      gg.tutorial?.flag('notice'); gg.mission.flag('notice');
      gg.narrate([
        FACT('The notice proclaims the annexation of the Korean Empire by Japan. The treaty was signed on 22 August 1910 and proclaimed today, 29 August.', '방에는 대한제국을 일본에 병합한다는 내용이 적혀 있다. 조약은 1910년 8월 22일 조인되어 오늘 8월 29일 공포되었다.', 7),
        SAY(SEOJIN, 'So it is written down now. As if a country could be signed away.', '이제 글로 박아 놓았구나. 나라를 도장 하나로 넘길 수 있다는 듯이.'),
      ]);
    } });
    talk(g, { id: 'teacherTalk', actor: teacher, prompt: S('Talk to Teacher Han', '한 선생님과 이야기하기'), enabled: (gg) => gg.flags.has('notice'), flag: 'letter',
      lines: [
        SAY(TEACHER, 'Seo-jin. This goes to Master Jeong by the West Gate — into his hands, no one else\'s.', '서진아. 이걸 서대문 정 어른께 전해라. 꼭 그분 손에.'),
        SAY(TEACHER, 'If you are stopped, you are a bookshop boy on an errand. Nothing more. Watch the gendarmes before you cross.', '누가 세우거든 너는 심부름 가는 책방 아이일 뿐이다. 건너기 전에 헌병을 잘 보아라.'),
        SAY(TEACHER, 'And if you have a moment… those books by the gate cannot stay on the shelves any longer. The cellar is behind the well.', '그리고 틈이 나거든… 문간의 책들은 이제 책장에 둘 수가 없구나. 광은 우물 뒤에 있다.'),
      ],
      onUse: (gg) => { gg.player.model.setCarryItem('docs'); gg.player.hasLetter = true; } });
    // optional: hide books (carry one bundle at a time)
    [[30.5, 33], [32, 33], [33.5, 33]].forEach((p, i) => pickup(g, { id: 'book' + i, pos: p, kind: 'books', carry: true, prompt: S('Pick up a bundle of books', '책 꾸러미 들기'), hold: 0.4, enabled: (gg) => gg.flags.has('letter') && !gg.player.carryItem }));
    dropoff(g, { id: 'cellar', pos: [41, 50.5], kind: 'books', prompt: S('Hide the books in the cellar', '광에 책 숨기기'), flag: (it) => 'booksHidden_' + it.id,
      onUse: (gg) => { gg.player.model.setCarryItem('docs'); } });
    talk(g, { id: 'jeongTalk', actor: jeong, prompt: S('Give the letter to Master Jeong', '정 어른께 편지 드리기'), enabled: (gg) => gg.mission.index >= 4, flag: 'delivered',
      lines: [
        SAY(JEONG, 'From Han? …So it is decided.', '한 선생이 보냈느냐? …그래, 정해졌구나.'),
        SAY(JEONG, 'We will sell the land before the river freezes and go north, over the Amnok. Tell your teacher we will build something there that they cannot proclaim away.', '강이 얼기 전에 땅을 팔고 압록강 너머 북쪽으로 가련다. 선생께 전해라. 저쪽에, 방 한 장으로 없앨 수 없는 것을 세우겠다고.'),
        NARR('Families like the fictional Jeongs — and real ones like Yi Hoe-yeong\'s and Yi Sang-ryong\'s — left for West Gando that winter.', '가상의 정씨 집안 같은 — 그리고 실제의 이회영·이상룡 일가 같은 — 집안들이 그해 겨울 서간도로 떠났다.', 6),
      ],
      onUse: (gg) => { gg.player.model.setCarryItem(null); } });
  },
  // the courier is unarmed: being stopped ends the errand
  failIf: () => null,
  rewards: { funds: 2, trust: 5 },
};
