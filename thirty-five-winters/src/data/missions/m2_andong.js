// Chapter 2 — Andong (now Dandong), autumn 1919. An unarmed liaison of the Communications Bureau.
import { S, NARR, SAY, FACT, pickup, dropoff, talk } from './common.js';

const MAEHWA = S('Han Mae-hwa', '한매화');
const BOATMAN = S('Boatman (fictional)', '뱃사공 (가상 인물)');
const CLERK = S('Office clerk (fictional)', '사무실 서기 (가상 인물)');
const COURIER = S('Courier to Sinuiju (fictional)', '신의주행 연락원 (가상 인물)');
const CH = S('Chapter 2 · Paper Roads', '2장 · 종이의 길');

export const m2 = {
  id: 'm2', chapter: 'ch2', chapterLabel: CH,
  title: S('Paper Roads', '종이의 길'), date: S('Autumn 1919, night', '1919년 가을, 밤'), place: S('Andong, by the Amnok River', '압록강 변 안동'),
  unit: S('Liaison, Communications Bureau of the Provisional Government', '임시정부 교통국 연락원'),
  protagonist: { id: 'maehwa', name: MAEHWA, outfit: 'liaison_w', weapon: 'none',
    desc: S('a 22-year-old former schoolteacher from Uiju who carries papers between the river, the firm and couriers bound for Korea.', '의주 출신 스물두 살의 전직 교사. 강가와 회사, 국내로 가는 연락원 사이에서 문서를 나른다.') },
  historyNote: S('From May 1919 the Provisional Government\'s Communications Bureau had an office on the upper floor of Iryung Yanghaeng, George L. Shaw\'s trading firm in Andong. Newspapers and documents moved between Shanghai, Andong and Korea through it.', '1919년 5월부터 임시정부 교통국은 조지 L. 쇼가 운영한 안동의 무역회사 이륭양행 2층에 사무실을 두었다. 신문과 문서가 이곳을 거쳐 상하이·안동·국내를 오갔다.'),
  createdNote: S('Mae-hwa, the boatman, the clerk, the courier, the route and the town layout are created for the game. Shaw does not appear as a character.', '매화, 뱃사공, 서기, 연락원, 경로와 거리 모습은 게임 구성이다. 쇼는 인물로 등장하지 않는다.'),
  briefing: [
    S('A bundle has come up the river from Shanghai: copies of the newspaper The Independent and papers from the Provisional Government.', '상하이에서 강을 거슬러 꾸러미가 왔다. 「독립신문」과 임시정부의 문서들이다.'),
    S('Take it from the boatman, carry it to the firm\'s back courtyard, then bring the clerk\'s reply to the courier waiting by the willows for the crossing to Sinuiju.', '뱃사공에게서 받아 회사 뒤뜰로 나르고, 서기의 답신을 신의주로 건너갈 연락원이 기다리는 버드나무 아래로 가져가라.'),
    S('Japanese police patrol the streets at night, and informants watch the market. You are unarmed — if you are stopped, the papers and the people named in them are lost.', '밤거리에는 일본 경찰이 순찰하고 장터에는 밀정이 있다. 당신은 비무장이다. 붙잡히면 문서도, 문서에 이름이 적힌 사람들도 위험하다.'),
  ],
  after: [
    S('The Communications Bureau and the Yeontongje network linked the Provisional Government with Korea. Japanese police worked steadily to uncover them; many liaisons were arrested.', '교통국과 연통제는 임시정부와 국내를 이었다. 일본 경찰은 끈질기게 이를 캐냈고 많은 연락원이 체포되었다.'),
    S('In 1920 Shaw himself was arrested by the Japanese and later released on bail; he eventually had to leave Andong.', '1920년 쇼 자신도 일본에 체포되었다가 보석으로 풀려났고, 결국 안동을 떠나야 했다.'),
  ],
  music: 'explore', combatMusic: 'combat', seed: 1919.5, ammo: 0, bandages: 1,
  env: {
    biome: 'china_river', season: 'autumn', time: 'night', weather: 'fog', grade: 'night', ambience: { city: 0.5, river: 0.9, wind: 0.4, insects: 0.3 }, wind: 0.5,
    fogDensity: 0.011,
    terrain: { size: 180, seed: 71, noiseAmp: 1.4, detailAmp: 0.1, waterLevel: -1.6, edgeRise: 20, features: [
      { type: 'flat', x: 0, z: 10, w: 170, d: 110, h: 0.6, fall: 10 },
      { type: 'river', path: [[-100, -72], [0, -70], [100, -74]], width: 26, depth: 7 },
      { type: 'road', path: [[-90, -18], [90, -18]], width: 7 }, { type: 'road', path: [[20, -55], [20, 50]], width: 5 },
      { type: 'road', path: [[-36, -18], [-36, 40]], width: 3 }, { type: 'road', path: [[-70, -48], [70, -48]], width: 4 },
    ] },
    build(kit) {
      // waterfront
      kit.boat(30, -63, 0.1); kit.boat(44, -65, -0.2); kit.boat(-20, -64, 0.3);
      kit.bridge(26, -50, 26, -62, 3, 0.8); kit.crates(34, -50, 0, 3); kit.crates(12, -50, 0.5, 3, 'sack'); kit.crates(-8, -51, 0.2, 2);
      kit.bridge(-60, -46, -60, -96, 5, 2.2); // railway bridge to Sinuiju (stylised)
      kit.house('brick', 50, -40, 0, { w: 10 }); kit.house('brick', -24, -38, 0, { w: 9 });
      // main street with shophouses
      for (const [x, z, r] of [[-64, -6, Math.PI], [-48, -6, Math.PI], [-20, -6, Math.PI], [-4, -6, Math.PI], [36, -6, Math.PI], [54, -6, Math.PI], [-58, -30, 0], [-6, -30, 0], [36, -30, 0], [58, -30, 0]]) kit.house('shophouse', x, z, r, { w: 9, d: 7, color: ['#7e786e', '#8a7f72', '#76716a'][Math.abs(x) % 3] });
      for (const x of [-72, -40, -12, 12, 44, 70]) kit.lamp(x, -14);
      kit.cart(0, -22, 0.3); kit.cart(-46, -14.5, -0.2); kit.crates(28, -23, 0, 2, 'sack'); kit.crates(-28, -13, 0.4, 3);
      // the trading firm and back courtyard
      kit.house('western', 40, 30, Math.PI, { w: 14, d: 10 });
      kit.wall(30, 14, 30, 22, 2.0, 'brick'); kit.wall(30, 14, 50, 14, 2.0, 'brick'); kit.wall(50, 14, 50, 22, 2.0, 'brick');
      kit.crates(44, 18, 0.2, 2); kit.lamp(36, 17);
      // back lanes north
      kit.house('brick', -10, 30, Math.PI / 2, { w: 10 }); kit.house('brick', -52, 30, 0, { w: 10 }); kit.house('shophouse', 4, 52, Math.PI, { w: 8 }); kit.house('brick', 64, 50, Math.PI, { w: 10 });
      kit.wall(-30, 10, -30, 46, 1.8, 'brick'); kit.wall(-42, 10, -42, 46, 1.8, 'brick');
      kit.crates(-36, 30, 0, 2); kit.crates(-36, 20, 0.3, 2, 'sack');
      // willows by the western bank
      kit.tree('willow', -50, -56, 1.1); kit.tree('willow', -44, -58, 1); kit.tree('willow', -70, -54, 1.1);
      for (let i = 0; i < 10; i++) kit.bush(-80 + i * 5, -52 + (i % 2) * 2, 1);
      kit.forest({ x: 0, z: 76, w: 170, d: 14 }, 30, ['willow', 'poplar']);
    },
  },
  start: { pos: [28, -52], facing: Math.PI },
  enemies: [
    { id: 'pw', outfit: 'jp_police1919', label: 'police', weapon: 'none', noShoot: true, lantern: true, pos: [10, -46], route: [[46, -46, 3], [-30, -46, 3]], pingpong: true, viewRange: 24, fov: 1.6, speedWalk: 1.0 },
    { id: 'pm1', outfit: 'jp_police1919', label: 'police', weapon: 'none', noShoot: true, lantern: true, pos: [20, -18], route: [[20, -18, 5, Math.PI / 2], [20, -18, 5, -Math.PI / 2]], viewRange: 22, fov: 1.6 },
    { id: 'pm2', outfit: 'jp_police1919', label: 'police', weapon: 'none', noShoot: true, pos: [-50, -18], route: [[-60, -18, 2], [50, -18, 2]], pingpong: true, viewRange: 22, fov: 1.6, speedWalk: 1.1 },
    { id: 'inf', outfit: 'liaison_m', label: 'informant', weapon: 'none', noShoot: true, pos: [6, -26], route: [[-14, -24, 4], [10, -24, 4], [10, -12, 3]], viewRange: 18, fov: 2.0, speedWalk: 0.8 },
    { id: 'pf', outfit: 'jp_police1919', label: 'police', weapon: 'none', noShoot: true, lantern: true, pos: [52, 6], route: [[60, 8, 3], [26, 8, 3]], pingpong: true, viewRange: 20, fov: 1.5, speedWalk: 0.9 },
    { id: 'pb', outfit: 'jp_police1919', label: 'police', weapon: 'none', noShoot: true, lantern: true, pos: [-56, -40], facing: Math.PI, viewRange: 20, fov: 1.5, scanArc: 1.6 },
  ],
  civilians: [
    { id: 'boatman', name: BOATMAN, outfit: 'refugee_m', pos: [27, -58], facing: 0, detectable: false },
    { id: 'clerk', name: CLERK, outfit: 'liaison_m', pos: [44, 20], facing: Math.PI, detectable: false, seed: 4 },
    { id: 'courier', name: COURIER, outfit: 'hanbok_m', pos: [-47, -55], facing: 0, detectable: false, seed: 8 },
    { id: 'c1', outfit: 'chinese_nra', pos: [-20, -12], mode: 'wander', detectable: false, seed: 2 },
    { id: 'c2', outfit: 'hanbok_w', pos: [40, -12], mode: 'wander', detectable: false },
  ],
  intro: [
    NARR('Andong, across the river from Sinuiju. Autumn 1919, after curfew.', '신의주 건너편 안동. 1919년 가을, 통행금지 뒤.'),
    SAY(MAEHWA, 'Lantern on the boat, two flashes. That\'s him.', '배 위 등불이 두 번 깜박였다. 그 사람이다.'),
  ],
  tutorial: [
    { text: S('Police with lanterns are easy to spot — but standing in lantern light makes YOU easy to spot too.', '등불 든 경찰은 쉽게 보인다. 하지만 등불 빛 안에 서면 당신도 쉽게 보인다.'), actions: [], until: 'time', ms: 8000 },
    { text: S('Not every watcher wears a uniform. The man loitering in the market is an informant.', '모든 감시자가 제복을 입지는 않는다. 장터를 서성이는 저 남자는 밀정이다.'), actions: [], until: 'time', ms: 8000 },
  ],
  objectives: [
    { id: 'meet', type: 'flag', flag: 'bundle', marker: [27, -58], text: S('Meet the boatman at the wharf and take the bundle', '부두에서 뱃사공을 만나 꾸러미 받기') },
    { id: 'firm', type: 'flag', flag: 'delivered', marker: [44, 20], checkpoint: true, checkpointPos: [28, -50], text: S('Carry the bundle through the town to the firm\'s back courtyard', '꾸러미를 들고 거리를 지나 회사 뒤뜰로 가기') },
    { id: 'courier', type: 'flag', flag: 'handed', marker: [-47, -55], checkpoint: true, checkpointPos: [40, 18], text: S('Bring the clerk\'s reply to the courier by the willows on the western bank', '서기의 답신을 서쪽 강변 버드나무 아래 연락원에게 전하기') },
  ],
  optional: [
    { id: 'quiet', text: S('Never raise suspicion', '한 번도 의심을 사지 않기'), check: (g, m) => m.has('handed'), fail: (g) => g.enemies.some((e) => e.mode === 'search' || e.mode === 'detain' || e.mode === 'combat'), xp: ['intel', 20] },
    { id: 'notes', text: S('Note the night\'s patrols for the Bureau (observe all six watchers)', '교통국을 위해 오늘 밤 감시자 여섯을 모두 관찰하기'), check: (g) => g.enemies.every((e) => e.observed), xp: ['intel', 15], onComplete: (g) => g.progress.addOrg({ network: 8 }) },
  ],
  setup(g) {
    const [boatman, clerk, courier] = g.civilians;
    talk(g, { id: 'bm', actor: boatman, prompt: S('Give the password to the boatman', '뱃사공에게 암호 대기'), flag: 'bundle', lines: [
      SAY(MAEHWA, 'Is the river cold tonight?', '오늘 밤 강물이 찹니까?'), SAY(BOATMAN, 'Colder upstream.', '위쪽이 더 차지요.'),
      SAY(BOATMAN, 'Forty copies of the paper and the envelope. The police changed shifts an hour ago — the new ones walk slower and look harder.', '신문 마흔 부와 봉투요. 경찰이 한 시간 전에 교대했소. 새로 온 자들은 느리게 걷고 더 꼼꼼히 봐요.'),
      FACT('The Independent (독립신문) was first published in Shanghai in August 1919 and circulated secretly.', '「독립신문」은 1919년 8월 상하이에서 창간되어 비밀리에 퍼졌다.', 5),
    ], onUse: (gg) => { gg.player.carryItem = { kind: 'docs', id: 'bundle' }; gg.player.model.setCarryItem('sack'); } });
    talk(g, { id: 'cl', actor: clerk, prompt: S('Hand the bundle to the clerk', '서기에게 꾸러미 건네기'), flag: 'delivered', enabled: (gg) => gg.flags.has('bundle'), lines: [
      SAY(CLERK, 'Forty. Good. These go north tonight.', '마흔 부. 좋습니다. 오늘 밤 북쪽으로 갑니다.'),
      SAY(CLERK, 'Take this reply to the courier by the willows — he crosses to Sinuiju before dawn. Go the long way round.', '이 답신을 버드나무 아래 연락원에게 — 동트기 전에 신의주로 건넙니다. 돌아서 가세요.'),
    ], onUse: (gg) => { gg.player.carryItem = { kind: 'docs', id: 'reply' }; gg.player.model.setCarryItem('docs'); gg.stats.delivered++; gg.award('intel', 10, null); } });
    talk(g, { id: 'co', actor: courier, prompt: S('Pass the reply to the courier', '연락원에게 답신 넘기기'), flag: 'handed', enabled: (gg) => gg.flags.has('delivered'), lines: [
      SAY(COURIER, 'I\'ll be on the far bank before the first train.', '첫 기차 전에 건너편에 닿겠소.'),
      NARR('Papers like these crossed the river night after night — until the network was uncovered, and rebuilt, and uncovered again.', '이런 문서들이 밤마다 강을 건넜다. 연락망이 드러나고, 다시 세워지고, 또 드러날 때까지.'),
    ], onUse: (gg) => { gg.player.carryItem = null; gg.player.model.setCarryItem(null); gg.stats.delivered++; } });
  },
  rewards: { network: 10, funds: 2 },
};
