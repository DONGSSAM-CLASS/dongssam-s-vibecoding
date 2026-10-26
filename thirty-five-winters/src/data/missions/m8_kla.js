// Chapter 8 — Korean Liberation Army, 1940–1945.
import * as THREE from 'three';
import { S, NARR, SAY, FACT, pickup, dropoff, talk, hub, near, clue, propMesh } from './common.js';
import { flagTexture } from '../../world/props.js';

const CH = S('Chapter 8 · The Liberation Army', '8장 · 한국광복군');
const USEOK = S('Jeong U-seok', '정우석');
const GYEONGMIN = S('Cha Gyeong-min', '차경민');
const RAO = S('Sergeant Arjun Rao', '아르준 라오 하사');
const HAJIN = S('Yun Ha-jin', '윤하진');
const MINGI = S('Yi Min-gi', '이민기');
const EUNHO = S('Gwon Eun-ho', '권은호');
const REED = S('OSS instructor (fictional)', 'OSS 교관 (가상 인물)');

function hangFlag(g, x, z, h = 4) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 5), new THREE.MeshLambertMaterial({ color: '#6a5136' }));
  pole.position.set(x, g.groundY(x, z) + h / 2, z); g.scene.add(pole);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshLambertMaterial({ map: flagTexture('1940'), side: THREE.DoubleSide }));
  f.geometry.translate(0.75, 0, 0); f.position.set(x, g.groundY(x, z) + h - 0.55, z); f.rotation.y = 0.3; g.scene.add(f);
}

// ------------------------------------------------------------------------------------------- 8a Chongqing 1940
export const m8a = {
  id: 'm8a', chapter: 'ch8', chapterLabel: CH,
  title: S('The Founding', '창설'), date: S('17 September 1940', '1940년 9월 17일'), place: S('Chongqing, at the Jialing Guest House', '충칭 가릉빈관'),
  unit: S('Student volunteer, Provisional Government', '임시정부 학생 자원봉사자'),
  protagonist: { id: 'useok', name: USEOK, outfit: 'student1910', weapon: 'none',
    desc: S('a 19-year-old student whose family followed the Provisional Government inland.', '임시정부를 따라 내륙으로 옮겨 온 집안의 열아홉 살 학생.') },
  historyNote: S('On 17 September 1940 the Provisional Government held the founding ceremony of the Korean Liberation Army\'s general headquarters at the Jialing Guest House in Chongqing. Ji Cheong-cheon became commander-in-chief and Yi Beom-seok chief of staff.', '1940년 9월 17일 임시정부는 충칭 가릉빈관에서 한국광복군 총사령부 성립 전례식을 열었다. 지청천이 총사령, 이범석이 참모장이 되었다.'),
  createdNote: S('U-seok, the elderly guest and the preparations are created for the game; no one at the ceremony speaks invented lines.', '우석, 노인 손님, 준비 과정은 게임 구성이다. 식장에서 창작 대사를 말하는 실존 인물은 없다.'),
  briefing: [S('The Provisional Government, driven inland by the war, is founding its own army today. You have been asked to help get everything ready in the fog.', '전쟁에 밀려 내륙으로 온 임시정부가 오늘 자신의 군대를 창설한다. 당신은 안개 속에서 준비를 돕게 되었다.')],
  after: [S('The Liberation Army began with only a small number of soldiers. Through recruiting in occupied China, the joining of Korean Volunteer Corps members in 1942 and young men escaping the Japanese army, it grew year by year.', '광복군은 적은 병력으로 시작했다. 점령지 중국에서의 초모, 1942년 조선의용대원들의 합류, 일본군을 탈출한 청년들로 해마다 커졌다.'), FACT('In December 1941 the Provisional Government declared war on Japan.', '1941년 12월 임시정부는 일본에 선전 포고를 했다.')],
  music: 'hub', seed: 1940, ammo: 0, bandages: 0,
  env: {
    biome: 'chongqing', season: 'autumn', time: 'overcast', weather: 'fog', grade: 'fog', ambience: { city: 0.6, river: 0.3, wind: 0.3 }, wind: 0.4,
    terrain: { size: 160, seed: 151, noiseAmp: 3, waterLevel: -6, features: [
      { type: 'hill', x: 0, z: 30, r: 70, h: 14 }, { type: 'flat', x: 0, z: 40, w: 30, d: 20, h: 13.5, fall: 6 },
      { type: 'river', path: [[-90, -60], [0, -58], [90, -64]], width: 30, depth: 8 }, { type: 'road', path: [[-10, -30], [-6, 0], [-2, 20], [0, 32]], width: 3 },
    ] },
    build(kit) {
      kit.house('pavilion', 0, 46, Math.PI, { w: 16, d: 8 });
      for (const [x, z, r] of [[-24, 10, Math.PI / 2], [22, 6, -Math.PI / 2], [-26, -12, Math.PI / 2], [24, -16, -Math.PI / 2], [-20, 28, Math.PI / 2], [20, 30, -Math.PI / 2]]) kit.house('shophouse', x, z, r, { w: 8, d: 7, color: '#8a837a', lantern: false });
      kit.house('brick', -6, -36, 0, { w: 10 }); // office below
      for (let i = 0; i < 8; i++) kit.wall(-8, -26 + i * 6, -8, -24 + i * 6, 0.4, 'stone'), kit.wall(6, -26 + i * 6, 6, -24 + i * 6, 0.4, 'stone');
      kit.forest({ x: -50, z: 40, w: 40, d: 60 }, 30, ['bamboo', 'oak']); kit.forest({ x: 50, z: 40, w: 40, d: 60 }, 30, ['bamboo', 'pine']);
      kit.boat(-20, -60, 0.3); kit.boat(30, -62, -0.2);
      for (let i = 0; i < 8; i++) kit.table(-8 + (i % 4) * 5, 36 + Math.floor(i / 4) * 3, 0, false);
    },
  },
  start: { pos: [-4, -30], facing: 0 },
  civilians: [
    { id: 'elder', name: S('An elderly guest', '노인 손님'), outfit: 'scholar', pos: [2, -22], facing: 0, escort: true, group: 'guest', mode: 'idle', detectable: false },
    { id: 'o1', outfit: 'kla1940', pos: [-4, 40], detectable: false, seed: 41 }, { id: 'o2', outfit: 'kla1940', pos: [4, 40], detectable: false, seed: 42 },
    { id: 'o3', outfit: 'officer_civ', pos: [0, 42], detectable: false, seed: 43 }, { id: 'o4', outfit: 'kla1940w', pos: [8, 38], detectable: false, seed: 44 },
    { id: 'o5', outfit: 'chinese_nra', pos: [-10, 38], detectable: false, seed: 45 }, { id: 'o6', outfit: 'hanbok_w', pos: [12, 36], detectable: false, seed: 46 },
  ],
  intro: [FACT('Chongqing, 17 September 1940. The wartime capital of China, often under air attack.', '1940년 9월 17일 충칭. 공습이 잦던 중국의 전시 수도.', 5)],
  objectives: [
    { id: 'flags', type: 'flag', flag: 'flags', marker: [-6, -32], text: S('Collect the flags from the office', '사무실에서 깃발 챙기기') },
    { id: 'hang', type: 'count', prefix: 'hung_', need: 2, marker: (g) => (g.flags.has('hung_0') ? [6, 34] : [-6, 34]), text: S('Hang the flags at the guest house gate (2)', '빈관 정문에 깃발 달기 (2)') },
    { id: 'guest', type: 'escort', group: 'guest', zone: [0, 38, 6], text: S('Help the elderly guest up the steps to the ceremony', '노인 손님을 모시고 계단을 올라 식장으로 가기'),
      onStart: (g) => g.narrate([SAY(S('An elderly guest', '노인 손님'), 'I left Hanseong thirty years ago. Let me see a Korean army with my own eyes before I die.', '서른 해 전에 한성을 떠났지. 죽기 전에 우리 군대를 내 눈으로 봐야겠네.')]) },
    { id: 'ceremony', type: 'wait', timer: 22, zone: [0, 38, 10], text: S('The ceremony', '성립 전례식'),
      onStart: (g) => g.narrate([
        FACT('The Provisional Government proclaimed the founding of the Korean Liberation Army as the army of the Republic of Korea.', '임시정부는 대한민국의 국군으로서 한국광복군의 성립을 선포했다.', 6),
        FACT('Ji Cheong-cheon was named commander-in-chief and Yi Beom-seok chief of staff. Chinese officials and foreign guests attended.', '지청천이 총사령, 이범석이 참모장이 되었다. 중국 관리와 외국 손님들도 참석했다.', 6),
        SAY(USEOK, 'Thirty years of being told we had no country. And here, today, an army.', '나라가 없다는 말을 서른 해나 들었다. 그런데 오늘, 여기, 군대가 있다.'),
      ]) },
  ],
  setup(g) {
    pickup(g, { id: 'fl', pos: [-6, -32.5], kind: 'docs', carry: true, prompt: S('Take the folded flags', '접힌 깃발 챙기기'), flag: 'flags', y: g.groundY(-6, -32.5) + 0.8 });
    [[-6, 34], [6, 34]].forEach(([x, z], i) => g.addInteractable({ id: 'hang' + i, pos: [x, z], prompt: S('Hang a flag', '깃발 달기'), marker: 'item', enabled: (gg) => gg.flags.has('flags'),
      onUse: (gg) => { hangFlag(gg, x, z); gg.mission.flag('hung_' + i); if (gg.flags.has('hung_0') && gg.flags.has('hung_1')) { gg.player.carryItem = null; gg.player.model.setCarryItem(null); } } }));
  },
  rewards: { funds: 2, network: 5 },
};

// ------------------------------------------------------------------------------------------- 8b Imphal 1944
export const m8b = {
  id: 'm8b', chapter: 'ch8', chapterLabel: CH,
  title: S('Voices at Imphal', '임팔의 목소리'), date: S('May 1944', '1944년 5월'), place: S('Hills near Imphal, India–Burma front', '인도·버마 전선 임팔 부근 산지'),
  unit: S('India–Burma Theatre Operations Unit, Korean Liberation Army (with British forces)', '한국광복군 인면전구공작대 (영국군과 협력)'),
  protagonist: { id: 'gyeongmin', name: GYEONGMIN, outfit: 'kla_jungle', weapon: 'rifle_lee',
    desc: S('a fictional member created for the game: a 26-year-old who studied in Tokyo and speaks Japanese, English and Korean.', '게임을 위해 만든 가상 대원. 도쿄에서 공부해 일본어·영어·우리말을 하는 스물여섯 살.') },
  historyNote: S('From December 1943 the Liberation Army\'s India–Burma unit worked with British forces at Imphal: broadcasting to Japanese troops, translating captured documents and questioning prisoners.', '1943년 12월부터 광복군 인면전구공작대는 임팔에서 영국군과 함께 일본군을 향한 방송, 노획 문서 번역, 포로 심문을 맡았다.'),
  createdNote: S('The real unit\'s members are documented; Gyeong-min, Sergeant Rao, the prisoner and the documents are invented to show the kind of work they did.', '실제 대원은 기록으로 남아 있다. 경민, 라오 하사, 포로, 문서는 그 활동을 보여 주려고 만든 가상이다.'),
  briefing: [
    S('The monsoon has begun. Japanese forces are dug into the hills facing the British positions.', '우기가 시작되었다. 일본군이 영국군 진지와 마주한 산에 참호를 팠다.'),
    S('Translate the documents brought in last night, question the prisoner, then go forward with Sergeant Rao to broadcast to the Japanese lines.', '어젯밤 들어온 문서를 번역하고, 포로를 심문한 뒤, 라오 하사와 함께 앞으로 나가 일본군 진지에 방송하라.'),
  ],
  after: [S('The unit stayed with the British through the campaign; more members were sent in 1945. They returned to Chongqing in September 1945, after the war had ended.', '공작대는 작전 내내 영국군과 함께했고 1945년 추가 대원이 파견되었다. 전쟁이 끝난 뒤인 1945년 9월 충칭으로 돌아왔다.')],
  music: 'explore', combatMusic: 'combat', seed: 1944.5, ammo: 30, bandages: 3,
  env: {
    biome: 'jungle', season: 'summer', time: 'overcast', weather: 'rain', grade: 'monsoon', ambience: { rain: 1, insects: 0.6, frogs: 0.5, war: 0.5 }, wind: 0.7,
    terrain: { size: 200, seed: 161, noiseAmp: 9, edgeRise: 22, features: [
      { type: 'ridge', path: [[-90, 60], [0, 66], [90, 58]], width: 30, height: 16 }, { type: 'ridge', path: [[-90, -50], [0, -46], [90, -54]], width: 30, height: 12 },
      { type: 'flat', x: 0, z: -48, r: 14, h: null, fall: 8 }, { type: 'road', path: [[0, -48], [10, -10], [-6, 20], [0, 50]], width: 1.4 },
      { type: 'flat', x: -6, z: 26, r: 6, h: null, fall: 5 },
    ] },
    build(kit) {
      kit.forest({ x: 0, z: 0, w: 200, d: 200 }, 220, ['jungle', 'palm', 'bamboo', 'jungle'], [{ path: [[0, -48], [10, -10], [-6, 20], [0, 50]], w: 3 }, { x: 0, z: -48, r: 12 }], [0.8, 1.2]);
      for (let i = 0; i < 90; i++) kit.fern(-90 + Math.random() * 180, -80 + Math.random() * 160, 1.2);
      kit.house('hut', -4, -52, 0.2, { w: 6 }); kit.house('hut', 8, -46, -0.4, { w: 5 }); kit.trenchLine([[-14, -40], [-2, -38], [12, -40]]);
      kit.table(-2, -46, 0.2); kit.radio(-1.6, -46.2, 0.2); kit.crates(10, -52, 0.3, 2);
      kit.trenchLine([[-40, 62], [-10, 66], [20, 64], [44, 60]]);
      kit.rock(-6, 26, 1.3, true); kit.rock(-12, 22, 1.1, true); kit.log(2, 22, 0.5, 4);
    },
  },
  start: { pos: [0, -50], facing: 0 },
  extraction: [0, -48, 7],
  squad: [{ id: 'rao', name: RAO, role: 'rifle', outfit: 'british_ind', weapon: 'rifle_lee', pos: [2, -52], reserve: 30 }],
  civilians: [{ id: 'pow', name: S('Japanese prisoner (fictional)', '일본군 포로 (가상 인물)'), outfit: 'jp_jungle1944', pos: [10, -50], facing: Math.PI, detectable: false, mode: 'idle' }],
  enemies: [
    { id: 'jp1', group: 'jp', outfit: 'jp_jungle1944', weapon: 'rifle_jp', label: 'patrol', pos: [-30, 40], route: [[-30, 40, 4], [20, 44, 4]], pingpong: true, viewRange: 24, fov: 1.6 },
    { id: 'jp2', group: 'jp', outfit: 'jp_jungle1944', weapon: 'rifle_jp', label: 'patrol', pos: [20, 30], route: [[30, 30, 3], [10, 20, 3], [-20, 30, 3]], viewRange: 22, fov: 1.6, intel: true },
    ...Array.from({ length: 5 }, (_, i) => ({ id: 'tr' + i, group: 'jp', outfit: 'jp_jungle1944', weapon: 'rifle_jp', label: 'soldier', pos: [-30 + i * 14, 64], facing: Math.PI, viewRange: 28, fov: 1.5, scanArc: 1.2 })),
  ],
  groups: { jp: { routAt: 15, retreat: [0, 84] } },
  intro: [FACT('1944. Japanese forces have pushed toward Imphal; the British hold the plain and the hills around it.', '1944년. 일본군이 임팔로 밀고 들어왔고 영국군은 평원과 주변 산을 지키고 있다.', 5), SAY(RAO, 'Tea first, then the papers. They are still damp from the rain — like everything else here.', '차부터 드시죠. 문서는 그다음입니다. 여기 모든 게 그렇듯 비에 젖어 있어요.')],
  objectives: [
    { id: 'docs', type: 'count', prefix: 'doc_', need: 3, marker: [-2, -46], text: S('Translate the captured documents (3)', '노획 문서 번역하기 (3)'), xp: ['intel', 12] },
    { id: 'pow', type: 'flag', flag: 'questioned', marker: [10, -50], text: S('Question the prisoner — calmly, in his own language', '포로를 심문하기 — 차분하게, 그의 말로') },
    { id: 'forward', type: 'flag', flag: 'speaker', marker: [-6, 24], checkpoint: true, checkpointPos: [0, -44], text: S('Carry the loudspeaker to the rocks on the forward slope and set it up', '확성기를 앞 비탈 바위로 옮겨 설치하기') },
    { id: 'broadcast', type: 'hold', timer: 40, zone: [-6, 24, 10], text: S('Broadcast to the Japanese positions — Rao covers you', '일본군 진지에 방송하기 — 라오가 엄호한다'),
      onStart: (g, m) => { m.bT = 0; g.narrate([SAY(GYEONGMIN, '(in Japanese, into the speaker) Soldiers of the 15th Army — you are hungry, and the rain will not stop. Surrender is not shameful…', '(일본어로, 확성기에) 제15군 병사들이여. 굶주렸고, 비는 그치지 않는다. 항복은 부끄러운 일이 아니다…'), SAY(GYEONGMIN, '(in Korean) And any Koreans among you — you were never theirs.', '(우리말로) 그리고 그 안의 조선 사람들이여. 당신들은 처음부터 그들의 것이 아니었다.')]); for (const e of g.enemies) if (e.active && e.route) { e.lastKnown = { x: -6, z: 24, t: g.time }; e.mode = 'search'; e.searchT = 0; } } },
    { id: 'back', type: 'extract', zone: [0, -48, 7], text: S('Back to the post before the gully floods', '골짜기에 물이 차기 전에 초소로 돌아가기') },
  ],
  tick(g, m, dt) { if (m.current?.id !== 'broadcast') return; m.bT = (m.bT || 0) - dt; if (m.bT <= 0) { m.bT = 5; g.audio.voice({ x: -6, y: 3, z: 24 }, 4.5, { pitch: 165, gain: 0.5 }); } },
  setup(g) {
    const texts = [S('Ration return: rice for nine days, received for three.', '식량 보고: 아흐레 치 쌀 가운데 사흘 치만 받음.'), S('Order: patrol the north path at dusk, two men.', '명령: 해 질 녘 북쪽 오솔길 순찰, 2명.'), S('Letter home, unsent: "Mother, the rain here never stops."', '부치지 못한 편지: "어머니, 여기 비는 그치지를 않습니다."')];
    [[-2.6, -46.3], [-1.4, -45.8], [-2, -45.2]].forEach((p, i) => g.addInteractable({ id: 'd' + i, pos: p, prompt: S('Translate a document (hold)', '문서 번역 (길게)'), hold: 2, marker: 'item', radius: 1.6,
      onUse: (gg) => { gg.mission.flag('doc_' + i); gg.journalAdd('clue', null, null, texts[i]); gg.hud.toast(texts[i]); gg.award('intel', 4, null, true); if (i === 1) gg.enemies.filter((e) => e.id === 'jp1').forEach((e) => gg.markObserved(e, null, true)); } }));
    talk(g, { id: 'pw', actor: g.civilians[0], prompt: S('Question the prisoner', '포로 심문하기'), flag: 'questioned', enabled: (gg) => gg.mission.index >= 1, lines: [
      SAY(GYEONGMIN, '(in Japanese) You are safe here. Eat first. When did your unit last receive rice?', '(일본어로) 여기선 안전하오. 먼저 드시오. 부대가 마지막으로 쌀을 받은 게 언제요?'),
      SAY(S('Japanese prisoner', '일본군 포로'), 'Two weeks ago. They told us Imphal would be ours in three weeks. We have been eating grass.', '두 주 전이오. 삼 주면 임팔을 얻는다 했소. 우린 풀을 먹고 있소.'),
      SAY(S('Japanese prisoner', '일본군 포로'), 'The path along the ridge — they patrol it at dusk. Two men. Tell your loudspeaker to speak slowly; half of us are too tired to listen fast.', '능선 오솔길은 해 질 녘에 둘이 순찰하오. 확성기에 천천히 말하라 하시오. 절반은 지쳐서 빨리 못 알아듣소.'),
    ], onUse: (gg) => { gg.enemies.forEach((e) => { if (e.route) gg.markObserved(e, null, true); }); gg.award('intel', 8); } });
    pickup(g, { id: 'spk', pos: [8, -52.5], kind: 'loudspeaker', carry: true, prompt: S('Shoulder the loudspeaker', '확성기 메기'), hold: 0.5, enabled: (gg) => gg.mission.index >= 2 });
    dropoff(g, { id: 'rocks', pos: [-6, 24], kind: 'loudspeaker', prompt: S('Set up the loudspeaker among the rocks', '바위 틈에 확성기 설치하기'), flag: 'speaker', onUse: (gg) => propMesh(gg, 'loudspeaker', -6, 25, gg.groundY(-6, 25) + 0.4) });
  },
  failIf: (g) => (g.squad[0]?.state === 'lost' ? 'squadLost' : null),
  rewards: { network: 6, medicine: 1 },
};

// ------------------------------------------------------------------------------------------- 8c Fuyang 1944
export const m8c = {
  id: 'm8c', chapter: 'ch8', chapterLabel: CH,
  title: S('Those Who Crossed Over', '건너온 사람들'), date: S('Autumn 1944, night', '1944년 가을, 밤'), place: S('The plain north of Fuyang, Anhui', '안후이성 푸양 북쪽 평원'),
  unit: S('Recruiting branch, Korean Liberation Army', '한국광복군 징모 분처'),
  protagonist: { id: 'useok', name: USEOK, outfit: 'kla1940', weapon: 'rifle_mauser',
    desc: S('now 23, a recruiter with the Liberation Army branch near Fuyang.', '이제 스물셋, 푸양 근처 광복군 분처의 초모 요원.') },
  historyNote: S('Liberation Army recruiting branches worked behind the lines to bring in Koreans — including young men conscripted into the Japanese army who escaped. In June 1945 the Fuyang branch became the 3rd Detachment.', '광복군 징모 분처는 적 후방에서 한인을 받아들였다. 일본군에 끌려갔다가 탈출한 청년들도 있었다. 1945년 6월 푸양 분처는 제3지대가 되었다.'),
  createdNote: S('U-seok, the guide, the three escapees and their route are created for the game.', '우석, 안내인, 탈출한 세 사람과 경로는 게임 구성이다.'),
  briefing: [S('A message came through a Chinese village: three Korean soldiers have deserted a Japanese unit and are hiding in the sorghum near the river. Find them before the Japanese do, and bring them across the patrol road and the ford.', '중국 마을을 거쳐 소식이 왔다. 일본군 부대를 탈출한 한인 병사 셋이 강가 수수밭에 숨어 있다. 일본군보다 먼저 찾아, 순찰로와 여울을 건너 데려오라.')],
  after: [S('Young men who escaped the Japanese army were trained by the Liberation Army; some went on to Chongqing and to the OSS joint training in 1945.', '일본군을 탈출한 청년들은 광복군의 훈련을 받았고, 일부는 충칭으로, 또 1945년 OSS 합동 훈련으로 이어졌다.')],
  music: 'explore', combatMusic: 'combat', seed: 1944.9, ammo: 25, bandages: 3,
  env: {
    biome: 'anhui_plain', season: 'autumn', time: 'night', weather: 'clear', grade: 'night', ambience: { wind: 0.6, insects: 0.8, frogs: 0.3, river: 0.4 }, wind: 0.7,
    terrain: { size: 220, seed: 171, noiseAmp: 2, waterLevel: -1.4, edgeRise: 16, features: [
      { type: 'river', path: [[-110, 10], [0, 14], [110, 8]], width: 16, depth: 4 }, { type: 'flat', x: 0, z: 14, r: 7, h: -0.6, fall: 4 },
      { type: 'road', path: [[-110, -30], [110, -26]], width: 3.4 }, { type: 'field', x: -40, z: 50, w: 50, d: 30 }, { type: 'field', x: 40, z: -60, w: 50, d: 30 },
      { type: 'road', path: [[0, -100], [0, -30], [0, 14], [4, 60], [0, 100]], width: 1.4 },
    ] },
    build(kit) {
      kit.crops({ x: -40, z: 50, w: 50, d: 30 }); kit.crops({ x: 40, z: -60, w: 50, d: 30 }); kit.crops({ x: 50, z: 50, w: 40, d: 26 });
      kit.house('ruin', 30, 70, 0.3, { w: 6 }); kit.house('brick', -60, -80, 0.2, { w: 9 }); kit.house('brick', -44, -86, -0.1, { w: 8 }); kit.house('brick', -70, -66, 1.2, { w: 8 }); kit.flag(-52, -72, '1940', 4.5);
      kit.house('storehouse', 60, 84, 0.4, { w: 6 }); // brick kiln stand-in
      for (let i = 0; i < 30; i++) kit.tree(['willow', 'poplar'][i % 2], -100 + i * 7, 26 + (i % 3) * 3, 1);
      for (let i = 0; i < 40; i++) kit.bush(-100 + Math.random() * 200, -50 + Math.random() * 100, 1.1);
      kit.wall(-20, -24, -8, -24, 1.2, 'sandbag'); kit.telegraph([[-110, -22], [110, -18]], 26);
    },
  },
  start: { pos: [58, 92], facing: Math.PI },
  extraction: [-56, -76, 8],
  squad: [],
  civilians: [
    { id: 'guide', name: S('Lao Zhou, a Chinese guide (fictional)', '중국인 안내인 라오저우 (가상 인물)'), outfit: 'chinese_vol', pos: [62, 82], facing: Math.PI, detectable: false },
    { id: 'e1', name: MINGI, outfit: 'conscript_deserter', pos: [-52, 56], facing: 1, escort: true, group: 'esc', mode: 'hide' },
    { id: 'e2', name: S('Hwang Tae-yong', '황태용'), outfit: 'conscript_deserter', pos: [-30, 44], facing: -1, escort: true, group: 'esc', mode: 'hide', seed: 4 },
    { id: 'e3', name: S('Gang Chang-ho', '강창호'), outfit: 'conscript_deserter', pos: [-44, 62], facing: 2, escort: true, group: 'esc', mode: 'hide', seed: 7 },
    { id: 'post', name: S('Branch officer (fictional)', '분처 간부 (가상 인물)'), outfit: 'kla1940', pos: [-54, -74], facing: 0, detectable: false, seed: 9 },
  ],
  enemies: [
    { id: 'rp1', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'patrol', pos: [-60, -28], route: [[-80, -29, 3], [60, -27, 3]], pingpong: true, viewRange: 28, fov: 1.6, lantern: true },
    { id: 'rp2', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'patrol', pos: [60, -26], route: [[70, -26, 3], [-60, -28, 3]], pingpong: true, viewRange: 28, fov: 1.6, lantern: true },
    { id: 'bp', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'sentry', pos: [-14, -22], facing: 0, viewRange: 26, fov: 1.6, scanArc: 2.4 },
    { id: 'fp', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'sentry', pos: [6, 22], facing: 0, viewRange: 22, fov: 1.5, scanArc: 2.2, lantern: true },
    { id: 'sp', group: 'jp', outfit: 'jp_army1940', weapon: 'rifle_jp', label: 'patrol', pos: [-20, 60], route: [[-60, 70, 4], [-10, 40, 4]], pingpong: true, viewRange: 24, fov: 1.6 },
  ],
  groups: { jp: { routAt: 25, retreat: [100, 0] } },
  intro: [NARR('Autumn 1944. A moonless night on the North China plain.', '1944년 가을. 화북 평원의 달 없는 밤.')],
  objectives: [
    { id: 'guide', type: 'flag', flag: 'guided', marker: [62, 82], text: S('Meet the guide at the old kiln', '옛 가마터에서 안내인 만나기') },
    { id: 'find', type: 'count', prefix: 'found_', need: 3, marker: [-40, 54], text: S('Find the three escapees hiding in the sorghum (follow the tracks)', '수수밭에 숨은 탈출병 셋 찾기 (발자국을 따라가라)') },
    { id: 'cross', type: 'escort', group: 'esc', zone: [0, -40, 10], checkpoint: true, checkpointPos: [-36, 40], text: S('Lead them over the ford and across the patrol road', '그들을 이끌고 여울과 순찰로를 건너기') },
    { id: 'post', type: 'escort', group: 'esc', zone: [-56, -76, 9], checkpoint: true, checkpointPos: [0, -44], text: S('Bring them to the recruiting post in the village', '마을의 징모 분처로 데려가기'),
      onStart: (g) => { for (const c of g.civilians) if (c.def.group === 'esc' && c.mode === 'safe') { c.mode = 'follow'; c.leader = g.player; } g.refreshLists(); } },
    { id: 'report', type: 'flag', flag: 'reported', marker: [-54, -74], text: S('Report to the branch officer', '분처 간부에게 보고하기') },
  ],
  optional: [{ id: 'quiet', text: S('No shots fired', '총성 없이 끝내기'), check: (g, m) => m.has('reported') && g.stats.shots === 0 && g.stats.alerts === 0, fail: (g) => g.stats.alerts > 0, xp: ['rescue', 20] }],
  setup(g) {
    const [guide, e1, e2, e3, post] = g.civilians;
    talk(g, { id: 'gd', actor: guide, prompt: S('Talk to the guide', '안내인과 이야기하기'), flag: 'guided', lines: [SAY(guide.name, 'They came through our village at dusk, shoeless. I hid them in the sorghum by the river. The patrol road has two lanterns tonight; the ford has one.', '해 질 녘 맨발로 우리 마을을 지나갔소. 강가 수수밭에 숨겨 두었지. 오늘 밤 순찰로에 등불이 둘, 여울에 하나 있소.')] });
    g.effects.trail([[56, 76], [30, 64], [0, 56], [-28, 46]]);
    clue(g, { id: 'cap', pos: [12, 60], text: S('A Japanese army cap, insignia torn off. Bare footprints lead west.', '휘장을 뜯어낸 일본군 군모. 맨발 자국이 서쪽으로 이어진다.') });
    const greet = [
      [SAY(MINGI, 'Korean? …You\'re Korean. I was a student in Tokyo until they put a uniform on me. We ran three nights ago.', '조선 사람이오? …조선 사람이구나. 도쿄에서 학생이었는데 군복을 입혔소. 사흘 전 밤에 도망쳤소.')],
      [SAY(e2.name, 'I thought we would die in this field. I\'ll follow you anywhere that isn\'t back.', '이 밭에서 죽는 줄 알았소. 돌아가는 길만 아니면 어디든 따라가겠소.')],
      [SAY(e3.name, 'My feet are cut to pieces but I can walk. Just tell me when to stop.', '발이 다 찢어졌지만 걸을 수 있소. 멈출 때만 말해 주시오.')],
    ];
    [e1, e2, e3].forEach((c, i) => talk(g, { id: 'f' + i, actor: c, prompt: S('Speak quietly in Korean', '조용히 우리말로 말 걸기'), flag: 'found_' + i, enabled: (gg) => gg.flags.has('guided'), lines: greet[i], onUse: (gg) => { c.mode = 'follow'; c.leader = gg.player; c.slot = i; gg.refreshLists(); } }));
    talk(g, { id: 'rp', actor: post, prompt: S('Report', '보고하기'), flag: 'reported', enabled: (gg) => gg.mission.index >= 4, lines: [SAY(post.name, 'Three more. Get them dry clothes and food. Tomorrow they start learning to be soldiers of their own country.', '셋이 더 왔군. 마른 옷과 먹을 걸 줘라. 내일부터 제 나라의 군인이 되는 법을 배운다.')] });
  },
  rewards: { network: 8, food: 1 },
};

// ------------------------------------------------------------------------------------------- h8 / 8d Dugok 1945
const PROT_HAJIN = { id: 'hajin', name: HAJIN, outfit: 'kla1940w', weapon: 'carbine',
  desc: S('a 23-year-old radio trainee of the 2nd Detachment, born in exile in Manchuria; her father carried a letter across Hanseong in 1910.', '만주 망명지에서 태어난 스물세 살 제2지대 무전 훈련생. 아버지는 1910년 한성을 가로질러 편지를 날랐다.') };
const dugokTerrain = { size: 180, seed: 181, noiseAmp: 4, features: [
  { type: 'flat', x: 0, z: 0, r: 34, h: 1, fall: 14 }, { type: 'ridge', path: [[-90, 80], [0, 86], [90, 78]], width: 30, height: 20 },
  { type: 'road', path: [[0, -90], [0, 0], [30, 50], [40, 70]], width: 2 }, { type: 'field', x: -40, z: -40, w: 40, d: 30 }, { type: 'field', x: 50, z: -30, w: 30, d: 30 },
  { type: 'flat', x: 44, z: 62, r: 10, h: null, fall: 8 },
] };
const dugokBuild = (kit) => {
  kit.house('barracks', 0, 14, Math.PI, { w: 18, d: 6, color: '#8a7a5e' }); kit.house('barracks', -18, -4, Math.PI / 2, { w: 14, d: 5, color: '#8a7a5e' });
  kit.house('hut', 18, -4, -Math.PI / 2, { w: 5 }); kit.radio(16.2, -3.6, -Math.PI / 2); kit.house('tent', 14, 10, 0.2, { color: '#7c7552' });
  kit.flag(0, -6, '1940', 6); kit.campfire(-6, -10);
  for (const z of [20, 24, 28]) kit.target(-30, z, Math.PI / 2); kit.wall(-14, 18, -14, 30, 1.0, 'sandbag');
  kit.crops({ x: -40, z: -40, w: 40, d: 30 }); kit.crops({ x: 50, z: -30, w: 30, d: 30 });
  kit.house('manchu', 44, 62, 0.3, { w: 8 }); kit.fence([[36, 56], [52, 56]], 'brush');
  kit.forest({ x: 0, z: 70, w: 170, d: 30 }, 70, ['poplar', 'willow', 'oak', 'pine']); kit.forest({ x: -70, z: 10, w: 30, d: 80 }, 30, ['poplar', 'willow']);
  for (let i = 0; i < 30; i++) kit.bush(-70 + Math.random() * 140, 20 + Math.random() * 50, 1.1);
};

export const h8 = hub({
  id: 'h8', chapter: 'ch8', chapterLabel: CH, title: S('Dugok, 2nd Detachment camp', '두곡, 제2지대 진영'), date: S('July 1945', '1945년 7월'), place: S('Dugok (Duqu), near Xi\'an', '시안 근처 두곡(두취)'),
  unit: S('2nd Detachment, Korean Liberation Army — OSS joint training', '한국광복군 제2지대 — OSS 합동 훈련'), protagonist: PROT_HAJIN,
  intro: [FACT('In spring 1945 the Liberation Army and the US OSS agreed to train Korean volunteers as agents to be sent into Korea (Operation Eagle). The 2nd Detachment trained at Dugok.', '1945년 봄 광복군과 미국 OSS는 한인 지원자를 국내로 들여보낼 요원으로 훈련하기로 했다(독수리 작전). 제2지대는 두곡에서 훈련했다.', 6)],
  env: { biome: 'xian_summer', season: 'summer', time: 'day', weather: 'clear', grade: 'dawn1945', ambience: { wind: 0.5, insects: 0.7, birds: 0.6, camp: 0.6 }, wind: 0.6, terrain: dugokTerrain, build: dugokBuild },
  start: { pos: [0, -14], facing: 0 },
  squad: [{ id: 'mingi', name: MINGI, role: 'scout', outfit: 'kla1940', weapon: 'carbine', pos: [-3, -8] }, { id: 'eunho', name: EUNHO, role: 'comm', outfit: 'kla1940', weapon: 'carbine', pos: [3, -8], seed: 3 }],
  npcs: [{ id: 'oss', name: REED, outfit: 'oss', pos: [12, 6], detectable: false, mode: 'wander' }, { id: 'k1', outfit: 'kla1940', pos: [-10, 4], detectable: false, seed: 51 }],
  stations: [{ kind: 'training', pos: [-24, 24] }, { kind: 'maintenance', pos: [-8, -12] }, { kind: 'tailor', pos: [-14, 6] }, { kind: 'kitchen', pos: [-4, -10] }, { kind: 'infirmary', pos: [10, 8] }, { kind: 'letters', pos: [6, -8] }, { kind: 'talk', pos: [0, -6] }, { kind: 'supply', pos: [-12, -8] }, { kind: 'depart', pos: [0, -24] }],
});

export const m8d = {
  id: 'm8d', chapter: 'ch8', chapterLabel: CH,
  title: S('Dugok, August 1945', '1945년 8월, 두곡'), date: S('August 1945', '1945년 8월'), place: S('Dugok (Duqu), near Xi\'an', '시안 근처 두곡(두취)'),
  unit: S('2nd Detachment, Korean Liberation Army — OSS joint training', '한국광복군 제2지대 — OSS 합동 훈련'), protagonist: PROT_HAJIN,
  historyNote: S('The first OSS course at Dugok finished on 4 August 1945, and the Liberation Army and the OSS declared a joint operation. The insertion into Korea was being prepared when Japan surrendered; it was never carried out.', '두곡의 OSS 1기 훈련은 1945년 8월 4일 끝났고 광복군과 OSS는 공동 작전을 선언했다. 국내 침투를 준비하던 중 일본이 항복해 작전은 실행되지 않았다.'),
  createdNote: S('Ha-jin, her squad, the instructor and the exercise are created for the game. The game does not show an invasion of Korea or a liberated Seoul — none took place.', '하진과 분대, 교관, 훈련은 게임 구성이다. 게임은 국내 진공이나 서울 탈환을 보여 주지 않는다 — 그런 일은 없었다.'),
  briefing: [S('Final field exercise before the next phase: send the practice transmission, slip through the instructors\' picket to the target farmstead, note the "enemy" posts on the way back.', '다음 단계 전 마지막 야외 훈련: 연습 전문을 보내고, 교관들의 경계선을 빠져나가 목표 농가에 닿고, 돌아오며 "적" 초소를 기록하라.'), S('Rumours have been running through camp for days.', '며칠째 진영에 소문이 돈다.')],
  after: [],
  music: 'hub', combatMusic: 'hub', seed: 1945, ammo: 30, bandages: 2,
  env: { biome: 'xian_summer', season: 'summer', time: 'day', weather: 'clear', grade: 'dawn1945', ambience: { wind: 0.5, insects: 0.8, birds: 0.6 }, wind: 0.6, terrain: dugokTerrain, build: dugokBuild },
  start: { pos: [0, -14], facing: 0 },
  squad: [{ id: 'mingi', name: MINGI, role: 'scout', outfit: 'kla1940', weapon: 'carbine', pos: [-3, -16] }, { id: 'eunho', name: EUNHO, role: 'comm', outfit: 'kla1940', weapon: 'carbine', pos: [3, -16], seed: 3 }],
  civilians: [{ id: 'reed', name: REED, outfit: 'oss', pos: [16, -1], facing: -Math.PI / 2, detectable: false }, { id: 'c1', outfit: 'kla1940', pos: [-8, -2], detectable: false, seed: 61 }, { id: 'c2', outfit: 'kla1940w', pos: [6, 4], detectable: false, seed: 62, mode: 'wander' }],
  enemies: [
    { id: 'x1', group: 'ex', outfit: 'oss', weapon: 'none', noShoot: true, label: 'instructor', pos: [10, 34], route: [[-10, 34, 4], [24, 36, 4]], pingpong: true, viewRange: 26, fov: 1.6 },
    { id: 'x2', group: 'ex', outfit: 'kla1940', weapon: 'none', noShoot: true, label: 'instructor', pos: [30, 48], facing: Math.PI, viewRange: 24, fov: 1.5, scanArc: 2.2 },
    { id: 'x3', group: 'ex', outfit: 'kla1940', weapon: 'none', noShoot: true, label: 'instructor', pos: [52, 50], route: [[56, 46, 3], [34, 60, 3]], pingpong: true, viewRange: 22, fov: 1.6 },
  ],
  intro: [NARR('August 1945. The plain is gold, and the air hums with rumours nobody dares believe.', '1945년 8월. 들판은 금빛이고, 아무도 감히 믿지 못하는 소문이 공기 속에 웅웅거린다.')],
  objectives: [
    { id: 'radio', type: 'flag', flag: 'sent', marker: [16.5, -3.5], text: S('Radio drill: send the practice message from the radio hut (hold)', '무전 훈련: 무전 오두막에서 연습 전문 보내기 (길게)'), xp: ['teamwork', 15] },
    { id: 'farm', type: 'reach', zone: [44, 62, 4], checkpoint: true, checkpointPos: [0, 18], text: S('Exercise: get past the instructors\' picket to the target farmstead unseen', '훈련: 교관 경계선을 들키지 않고 지나 목표 농가에 닿기') },
    { id: 'note', type: 'observe', group: 'ex', need: 3, marker: [30, 44], text: S('Note all three instructor posts (observe them)', '교관 초소 셋을 모두 기록하기 (관찰)'), xp: ['intel', 10] },
    { id: 'home', type: 'reach', zone: [0, -6, 6], withSquad: true, text: S('Return to camp', '진영으로 돌아오기') },
    { id: 'noon', type: 'reach', zone: [16, -2, 6], withSquad: true, text: S('Noon, 15 August. Everyone is crowding round the radio hut', '8월 15일 정오. 모두가 무전 오두막 주위로 모여든다'),
      onStart: (g) => { g.renderer.setGrade('dawn1945'); g.narrate([SAY(EUNHO, 'Ha-jin! Come — the radio — there is going to be an announcement from Tokyo!', '하진! 이리 와 — 라디오 — 도쿄에서 발표가 있대!')]); } },
    { id: 'broadcast', type: 'wait', timer: 26, text: S('Listen', '듣기'),
      onStart: (g) => {
        g.audio.radioStatic(3); setTimeout(() => g.audio.voice(null, 9, { pitch: 120, gain: 0.35, radio: true }), 2500);
        g.narrate([
          FACT('At noon on 15 August 1945, Japan\'s surrender was announced by radio.', '1945년 8월 15일 정오, 일본의 항복이 라디오로 방송되었다.', 6),
          SAY(MINGI, '…It\'s over? It\'s over. We\'re — we\'re free.', '…끝났다고? 끝났어. 우리는 — 우리는 해방이야.'),
          SAY(EUNHO, 'But we were going in. We trained for this. We were supposed to go in ourselves.', '그런데 우리는 들어가려 했잖아. 그걸 위해 훈련했는데. 우리 손으로 들어가야 했는데.'),
          SAY(HAJIN, 'Both are true. Thirty-five winters, and it ended in a voice on the radio. And still — we are going home.', '둘 다 맞아. 서른다섯 번의 겨울이 라디오 목소리로 끝났어. 그래도 — 우리는 집에 가.'),
          FACT('Liberation came through decades of independence struggle together with the Allied victory over Japan. The Liberation Army\'s planned entry into Korea never took place.', '광복은 수십 년의 독립운동과 연합국의 대일전 승리가 함께 만든 것이었다. 광복군의 국내 진입 계획은 끝내 실행되지 못했다.', 7),
        ]);
      } },
  ],
  setup(g) {
    g.addInteractable({ id: 'tx', pos: [16.5, -3.5], prompt: S('Send the practice message (hold)', '연습 전문 보내기 (길게)'), hold: 4, marker: 'item', onUse: (gg) => { gg.mission.flag('sent'); gg.audio.radioStatic(1.5); gg.narrate([SAY(REED, 'Clean. Faster than last week. Now — the field. Don\'t let them see you.', '깨끗해. 지난주보다 빠르군. 이제 들판이다. 들키지 마.')]); } });
  },
  rewards: {},
};
