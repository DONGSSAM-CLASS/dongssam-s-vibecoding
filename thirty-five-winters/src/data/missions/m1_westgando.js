// Chapter 1 — West Gando, 1911–1919. Training school, base, and the 1919 night exercise.
import { S, NARR, SAY, FACT, pickup, dropoff, talk, hub, near } from './common.js';

const DOYUN = S('Kang Do-yun', '강도윤');
const GILSU = S('Park Gil-su', '박길수');
const HYEONBIN = S('Jo Hyeon-bin', '조현빈');
const BAE = S('Instructor Bae', '배 교관');
const PROT = { id: 'doyun', name: DOYUN, outfit: 'trainee1911', weapon: 'rifle_old',
  desc: S('a 19-year-old from Gyeongsang Province whose family emigrated in 1911; one of the first trainees.', '1911년 가족과 함께 망명한 경상도 출신 열아홉 살 청년. 첫 훈련생 가운데 하나.') };
const CH = S('Chapter 1 · West Gando', '1장 · 서간도');

const villageBuild = (kit, { snow = false } = {}) => {
  kit.house('storehouse', 0, 0, 0, { w: 8, d: 4.5, snow });
  kit.flag(6, 4, '1910', 4.6);
  kit.house('manchu', -20, 8, 0.2, { snow }); kit.house('manchu', -24, -10, -0.15, { snow }); kit.house('choga', 18, 14, Math.PI + 0.1, { snow });
  kit.house('choga', 16, -18, 0.3, { snow }); kit.house('manchu', -6, 22, Math.PI, { snow });
  kit.fence([[-30, -2], [-30, 18], [-12, 18]], 'brush'); kit.fence([[8, -26], [26, -26], [26, -10]], 'brush');
  kit.well(-8, 8); kit.pots(-16, 14); kit.hay(10, 22); kit.hay(-30, 22);
  kit.crops({ x: -46, z: 34, w: 30, d: 22 }); kit.crops({ x: 44, z: -38, w: 26, d: 18 });
  kit.forest({ x: 0, z: 78, w: 190, d: 30 }, 60, ['larch', 'birch', 'pine', 'oak'], []);
  kit.forest({ x: -80, z: 0, w: 30, d: 150 }, 40, ['larch', 'birch', 'oak'], []);
  kit.forest({ x: 0, z: -80, w: 190, d: 28 }, 50, ['larch', 'pine', 'oak'], []);
  for (let i = 0; i < 40; i++) kit.grass(-70 + Math.random() * 140, -60 + Math.random() * 120, 1);
};

export const m1a = {
  id: 'm1a', chapter: 'ch1', chapterLabel: CH,
  title: S('The Storehouse School', '옥수수 창고 학교'), date: S('Summer 1911', '1911년 여름'), place: S('Samwonbo, Liuhe County', '유하현 삼원보'),
  unit: S('Sinheung training school (신흥강습소)', '신흥강습소'),
  protagonist: PROT,
  historyNote: S('In 1911 emigrants opened the Sinheung training school at Samwonbo — by many accounts in a borrowed corn storehouse. Settlers were short of food and land.', '1911년 망명자들은 삼원보에 신흥강습소를 열었다. 옥수수 창고를 빌려 시작했다는 기록이 많다. 이주민들은 식량과 땅이 모자랐다.'),
  createdNote: S('Do-yun, his comrades, Instructor Bae and the drills are created for the game. Early training used few, often outdated rifles.', '강도윤과 동료, 배 교관, 훈련 내용은 게임 구성이다. 초기 훈련에는 낡은 소총이 적게 쓰였다.'),
  briefing: [
    S('The new school needs grain for its first season, and the instructors want to see what the new trainees can do.', '새 학교는 첫 철을 날 곡식이 필요하고, 교관들은 새 훈련생의 실력을 보려 한다.'),
    S('Carry the grain, then report to the drill ground: cover, shooting, first aid and moving as a squad.', '곡식을 나른 뒤 훈련장으로 가라. 엄폐, 사격, 응급처치, 분대 이동을 익힌다.'),
  ],
  after: [S('Settlers struggled with poor harvests and hostility; around 1912 the school moved to Hanihe in Tonghua County, where teachers and students built new buildings with their own hands.', '이주민들은 흉년과 배척에 시달렸고, 1912년 무렵 학교는 통화현 합니하로 옮겨 교사와 학생이 손수 새 건물을 지었다.')],
  music: 'hub', seed: 1911, ammo: 12, bandages: 2,
  env: {
    biome: 'manchuria_summer', season: 'summer', time: 'day', weather: 'clear', grade: 'spring', region: 'manchuria',
    ambience: { wind: 0.5, birds: 1, insects: 0.4 }, wind: 0.8,
    terrain: { size: 200, seed: 31, noiseAmp: 5, features: [
      { type: 'flat', x: 0, z: 0, r: 30, h: 0.5, fall: 14 }, { type: 'flat', x: 46, z: 22, w: 40, d: 30, h: 0.8, fall: 10 },
      { type: 'road', path: [[-100, -6], [-30, -4], [0, -6], [30, -2], [100, 4]], width: 3 }, { type: 'road', path: [[0, -4], [0, 4]], width: 2 },
      { type: 'field', x: -46, z: 34, w: 30, d: 22 }, { type: 'field', x: 44, z: -38, w: 26, d: 18 },
      { type: 'hill', x: -60, z: -55, r: 40, h: 10 }, { type: 'hill', x: 70, z: 60, r: 40, h: 12 },
    ] },
    build(kit, ctx) {
      villageBuild(kit);
      // drill ground
      kit.wall(36, 12, 36, 28, 1.05, 'earth');
      kit.log(42, 34, 0.3, 4); kit.rock(44, 8, 1.1);
      ctx.level.targets = [kit.target(58, 14, -Math.PI / 2), kit.target(62, 22, -Math.PI / 2), kit.target(57, 30, -Math.PI / 2)];
      kit.banner(30, 22, Math.PI / 2, 3);
      kit.cart(-10, -14, 0.5);
    },
  },
  start: { pos: [-6, -21], facing: 0.3 },
  squad: [
    { id: 'gilsu', name: GILSU, role: 'scout', outfit: 'trainee1911', weapon: 'rifle_old', pos: [32, 26], order: 'hold', holdPos: [32, 26], reserve: 6 },
    { id: 'hyeonbin', name: HYEONBIN, role: 'rifle', outfit: 'trainee1911', weapon: 'rifle_old', pos: [32, 29], order: 'hold', holdPos: [32, 29], reserve: 6, seed: 4 },
  ],
  civilians: [
    { id: 'bae', name: BAE, outfit: 'instructor', pos: [33, 18], facing: Math.PI / 2, detectable: false },
    { id: 'f1', outfit: 'settler_w', pos: [-40, 26], mode: 'wander', detectable: false },
    { id: 'f2', outfit: 'settler_m', pos: [-50, 30], mode: 'wander', detectable: false, seed: 3 },
    { id: 'f3', outfit: 'child', pos: [-10, 10], mode: 'wander', detectable: false },
    { id: 'f4', outfit: 'settler_m', pos: [12, -10], mode: 'wander', detectable: false, seed: 6 },
  ],
  tutorial: [
    { text: S('Walk to the sacks by the cart and hold {0} to lift one. You cannot run or shoot while carrying.', '수레 옆 자루로 가서 {0}를 길게 눌러 드세요. 들고 있는 동안은 뛰거나 쏠 수 없습니다.'), actions: ['interact'], until: 'carry' },
    { text: S('Press {0} next to a wall, rock or log to take cover. Low cover protects you while you stay crouched.', '벽·바위·통나무 옆에서 {0}를 누르면 엄폐합니다. 낮은 엄폐물은 웅크리고 있을 때 몸을 지켜 줍니다.'), actions: ['cover'], until: 'cover' },
    { text: S('Hold {0} to aim. The crosshair widens when you move, are tired, or have just fired.', '{0}를 누르고 있으면 조준합니다. 움직이거나 지쳤거나 막 쐈을 때 조준선이 벌어집니다.'), actions: ['aim'], until: 'aim' },
    { text: S('Press {0} to fire.', '{0}로 사격합니다.'), actions: ['fire'], until: 'fire' },
    { text: S('This old rifle takes one round at a time: press {0} to reload after every shot.', '이 낡은 소총은 한 발씩 장전합니다. 쏠 때마다 {0}로 재장전하세요.'), actions: ['reload'], until: 'reload' },
    { text: S('While aiming, hold {0} to hold your breath and steady the rifle for a moment. It tires you.', '조준 중 {0}를 누르고 있으면 숨을 참아 잠시 총이 안정됩니다. 피로가 쌓입니다.'), actions: ['sprint'], until: 'breath' },
    { text: S('Hold {0} beside a wounded comrade to treat them. An untreated comrade bleeds — reach them in time.', '부상한 동료 옆에서 {0}를 길게 눌러 치료하세요. 치료받지 못하면 출혈로 위험합니다.'), actions: ['interact'], until: 'treat' },
    { text: S('Aim at a spot and press {0} to send your squad there. {1} holds them in place, {2} orders covering fire on the spot you aim at, {3} falls back to the rally point.', '한 지점을 겨누고 {0}를 누르면 동료가 그곳으로 갑니다. {1} 대기, {2} 겨눈 곳에 엄호 사격, {3} 집결지로 후퇴.'), actions: ['cmd_follow', 'cmd_hold', 'cmd_cover', 'cmd_fallback'], until: 'cmd_hold' },
    { text: S('When hurt, press {0} to bandage yourself. Bandages are scarce.', '다치면 {0}로 스스로 붕대를 감으세요. 붕대는 귀합니다.'), actions: ['bandage'], until: 'time', ms: 7000 },
  ],
  intro: [
    FACT('Summer 1911, Samwonbo. The Sinheung training school has opened in a borrowed storehouse.', '1911년 여름, 삼원보. 빌린 창고에서 신흥강습소가 문을 열었다.', 5),
    NARR('There is no money for a building yet. There is not even enough grain.', '건물을 지을 돈은커녕 곡식도 넉넉지 않다.'),
  ],
  objectives: [
    { id: 'grain', type: 'count', prefix: 'grain_', need: 3, marker: [-10, -14], text: S('Carry three sacks of grain from the cart to the storehouse school', '수레의 곡식 자루 셋을 창고 학교로 나르기') },
    { id: 'report', type: 'reach', zone: [33, 18, 3.2], text: S('Report to Instructor Bae at the drill ground', '훈련장의 배 교관에게 보고하기'),
      onComplete: (g) => g.narrate([SAY(BAE, 'Kang Do-yun. Get behind that earth wall, low. A wall only helps if you stay behind it.', '강도윤. 저 흙담 뒤로 가라, 낮게. 담은 그 뒤에 있을 때만 쓸모가 있다.')]) },
    { id: 'cover', type: 'custom', marker: [35, 20], check: (g) => !!g.player.cover && near(g.player, 36, 20, 4), text: S('Take cover behind the earth wall', '흙담 뒤에 엄폐하기'),
      onComplete: (g) => g.narrate([SAY(BAE, 'Good. Now the targets. One round at a time — this rifle is older than you. Breathe, then squeeze.', '좋다. 이제 표적이다. 한 발씩 — 이 총은 너보다 나이가 많다. 숨 쉬고, 당겨라.')]) },
    { id: 'shoot', type: 'count', prefix: 'tgt_', need: 3, marker: [60, 22], checkpoint: true, checkpointPos: [34, 20], text: S('Hit the three straw targets (aim, fire, reload)', '짚 표적 셋 맞히기 (조준·사격·재장전)'), xp: ['combat', 10],
      onComplete: (g) => g.narrate([SAY(BAE, 'Not bad. Rounds are worth more than rice here — never forget it.', '나쁘지 않다. 여기선 총알이 쌀보다 귀하다. 잊지 마라.')]) },
    { id: 'aid', type: 'treat', need: 1, marker: (g) => { const h = g.squad.find((a) => a.id === 'hyeonbin'); return h ? [h.x, h.z] : null; }, text: S('First-aid drill: Hyeon-bin plays wounded — treat him', '응급처치 훈련: 부상자 역할의 현빈 치료하기'),
      onStart: (g) => { const h = g.squad.find((a) => a.id === 'hyeonbin'); if (h) { h.state = 'wounded'; h.treated = false; h.severe = false; h.bleedT = 999; } g.narrate([SAY(HYEONBIN, 'Ugh — I\'m hit! …That\'s my line, isn\'t it? Come on, bandage me.', '윽, 맞았다! …이게 내 대사 맞지? 어서 붕대 감아 줘.')]); },
      onComplete: (g) => { const h = g.squad.find((a) => a.id === 'hyeonbin'); if (h) { h.state = 'ok'; h.hp = 100; } } },
    { id: 'squad', type: 'flags', flags: ['cmdMove', 'cmdHold'], marker: [56, 40], text: S('Squad drill: send your comrades to the far marker (aim + order), then order them to hold', '분대 훈련: 동료들을 먼 표지로 보내고(조준+명령) 대기시키기'), xp: ['teamwork', 10],
      onStart: (g) => { g.squad.forEach((a) => (a.order = 'follow')); } },
    { id: 'home', type: 'reach', zone: [0, 6, 4], text: S('Evening — return to the storehouse school', '저녁 — 창고 학교로 돌아가기'),
      onStart: (g) => g.narrate([SAY(BAE, 'That\'s enough for today. Tomorrow we dig ditches. A soldier who can\'t farm won\'t eat.', '오늘은 여기까지. 내일은 도랑을 판다. 농사 못 짓는 병사는 굶는다.')]) },
  ],
  optional: [
    { id: 'clean', text: S('Hit every target with your first three shots', '처음 세 발로 표적 모두 맞히기'), check: (g, m) => m.count('tgt_') >= 3 && g.stats.shots <= 3, fail: (g, m) => g.stats.shots > 3 && m.count('tgt_') < 3, xp: ['combat', 12] },
  ],
  setup(g) {
    const sacks = [[-11.5, -15.5], [-9, -16], [-12, -12.5]];
    sacks.forEach((p, i) => pickup(g, { id: 'sack' + i, pos: p, kind: 'sack', carry: true, hold: 0.5, prompt: S('Lift a sack of grain', '곡식 자루 들기'), enabled: (gg) => !gg.player.carryItem, onUse: (gg) => gg.tutorial?.flag('carry') }));
    dropoff(g, { id: 'school', pos: [0, 3.2], kind: 'sack', prompt: S('Stack the grain in the storehouse', '창고에 곡식 쌓기'), flag: (it) => 'grain_' + it.id });
    talk(g, { id: 'baeTalk', actor: g.civilians[0], prompt: S('Talk to Instructor Bae', '배 교관과 이야기하기'), once: false, enabled: (gg) => gg.mission.index >= 2,
      lines: [SAY(BAE, 'Cover, targets, wounds, orders. In that order. The enemy will not wait for you to remember.', '엄폐, 표적, 부상, 명령. 그 순서다. 적은 네가 기억해 낼 때까지 기다려 주지 않는다.')] });
  },
  onImpact(g, m, hit) {
    const tg = (g.level.targets || []).find((t) => hit.shape && t.shape === hit.shape);
    if (tg && !tg.hit && m.index >= 3) { tg.hit = true; tg.face.rotation.x = -1.2; m.flag('tgt_' + g.level.targets.indexOf(tg)); g.audio.thud(hit.point, 0.4); g.hud.hitMarker(); }
  },
  onCommand(g, m, cmd, pt) {
    if (m.current?.id !== 'squad') return;
    if (cmd === 'follow' && pt && Math.hypot(pt[0] - 56, pt[1] - 40) < 9) m.flag('cmdMove');
    if (cmd === 'hold' && m.has('cmdMove')) m.flag('cmdHold');
  },
  rewards: { food: 2, parts: 1 },
};

export const h1 = hub({
  id: 'h1', chapter: 'ch1', chapterLabel: CH, title: S('Hanihe', '합니하'), date: S('1913–1918', '1913–1918'), place: S('Hanihe, Tonghua County', '통화현 합니하'),
  unit: S('Sinheung Middle School (military course)', '신흥중학 군사반'), protagonist: PROT,
  intro: [FACT('Hanihe, Tonghua County. The school, now Sinheung Middle School, runs ordinary classes and a military course. Teachers and students built it themselves.', '통화현 합니하. 신흥중학이 된 학교는 중학반과 군사반을 운영한다. 교사와 학생이 손수 지었다.', 6)],
  env: {
    biome: 'manchuria_spring', season: 'spring', time: 'day', weather: 'clear', grade: 'spring', ambience: { wind: 0.6, birds: 1, river: 0.6 }, wind: 0.7,
    terrain: { size: 160, seed: 41, noiseAmp: 4, waterLevel: -2.2, features: [
      { type: 'flat', x: 0, z: 0, r: 34, h: 1.2, fall: 12 }, { type: 'river', path: [[-90, -38], [-20, -44], [40, -36], [90, -46]], width: 8, depth: 6 },
      { type: 'road', path: [[-80, 10], [0, 4], [80, 12]], width: 2.5 }, { type: 'ridge', path: [[-80, 60], [80, 55]], width: 26, height: 14 } ] },
    build(kit) {
      kit.house('barracks', 0, 12, Math.PI, { w: 18, d: 6 });
      kit.house('barracks', -18, -6, Math.PI / 2, { w: 12, d: 5 });
      kit.house('storehouse', 18, -6, -Math.PI / 2, { w: 7 });
      kit.house('manchu', -30, 18, 0.2); kit.house('choga', 28, 20, -0.2);
      kit.flag(0, -2, '1910', 5.5);
      kit.wall(20, 22, 32, 22, 1.0, 'earth'); for (const z of [26, 30, 34]) kit.target(46, z, -Math.PI / 2);
      kit.campfire(-4, -10); kit.table(6, -10, 0.2); kit.table(-12, -14, 0.5); kit.crates(14, -14, 0.3, 3); kit.crates(-24, 4, 0, 2, 'sack');
      kit.forest({ x: 0, z: 62, w: 150, d: 26 }, 50, ['larch', 'birch', 'pine']); kit.forest({ x: 0, z: -66, w: 150, d: 22 }, 40, ['willow', 'birch', 'poplar']);
      kit.bridge(-6, -30, -6, -58, 3);
    },
  },
  start: { pos: [0, -14], facing: Math.PI },
  squad: [
    { id: 'gilsu', name: GILSU, role: 'scout', outfit: 'trainee1911', weapon: 'rifle_old', pos: [-3, -8] },
    { id: 'hyeonbin', name: HYEONBIN, role: 'rifle', outfit: 'trainee1911', weapon: 'rifle_old', pos: [-5, -11], seed: 4 },
  ],
  npcs: [
    { id: 'n1', outfit: 'settler_w', pos: [-28, 12], mode: 'wander', detectable: false },
    { id: 'n2', outfit: 'student1910', pos: [8, 2], mode: 'wander', detectable: false },
    { id: 'n3', outfit: 'trainee1911', pos: [24, 26], detectable: false, facing: -Math.PI / 2, seed: 7 },
  ],
  stations: [
    { kind: 'training', pos: [26, 24] }, { kind: 'maintenance', pos: [6, -10] }, { kind: 'tailor', pos: [-12, -14] },
    { kind: 'kitchen', pos: [-4, -12] }, { kind: 'infirmary', pos: [-18, -2] }, { kind: 'letters', pos: [16, -12] },
    { kind: 'talk', pos: [-4, -7] }, { kind: 'supply', pos: [14, -14] }, { kind: 'depart', pos: [0, -24] },
  ],
});

export const m1b = {
  id: 'm1b', chapter: 'ch1', chapterLabel: CH,
  title: S('Night Exercise at Gosanja', '고산자의 야간 연습'), date: S('Spring 1919', '1919년 봄'), place: S('Gosanja, Liuhe County', '유하현 고산자'),
  unit: S('Trainees, soon the Sinheung Military Academy', '곧 신흥무관학교가 될 훈련생들'),
  protagonist: { ...PROT, outfit: 'cadet1919', weapon: 'none' },
  historyNote: S('After the March First Movement, young people crossed into West Gando in numbers; in 1919 the school moved to Gosanja and was reorganised as the Sinheung Military Academy.', '3·1 운동 뒤 많은 청년이 서간도로 건너왔고, 1919년 학교는 고산자로 옮겨 신흥무관학교로 개편되었다.'),
  createdNote: S('The exercise, its route and the instructors\' lantern patrols are created for the game. No live rounds: being caught means failing the exercise.', '야간 연습과 그 경로, 등불을 든 교관 순찰은 게임 구성이다. 실탄은 쓰지 않는다. 붙잡히면 연습 실패다.'),
  briefing: [
    S('Newcomers bring news from home: on 1 March people all over Korea gathered peacefully and called for independence. In April a Provisional Government was proclaimed in Shanghai.', '새로 온 이들이 고향 소식을 전한다. 3월 1일 전국에서 사람들이 평화롭게 모여 독립을 외쳤고, 4월 상하이에서 임시정부가 수립되었다고.'),
    S('Tonight\'s exercise: lead your section to the hilltop hut, take the sealed exercise order and bring it back without being caught by the instructors\' lantern patrols.', '오늘 밤 연습: 분대를 이끌고 산마루 오두막에 가서 봉인된 연습 명령서를 가져오라. 등불을 든 교관 순찰에 붙잡히지 말 것.'),
  ],
  after: [
    S('In 1919 the school was reorganised as the Sinheung Military Academy. It closed in 1920 under Japanese pressure, bandit raids and failed harvests, but its graduates went on to serve as officers and instructors in many independence army units.', '1919년 학교는 신흥무관학교로 개편되었다. 1920년 일제의 탄압과 마적 습격, 흉작 속에 문을 닫았지만, 졸업생들은 여러 독립군 부대의 간부와 교관이 되었다.'),
  ],
  music: 'explore', seed: 1919, ammo: 0, bandages: 1,
  env: {
    biome: 'manchuria_night_spring', season: 'spring', time: 'night', weather: 'clear', grade: 'night', ambience: { wind: 0.5, insects: 0.7, frogs: 0.5 }, wind: 0.6,
    terrain: { size: 200, seed: 51, noiseAmp: 6, features: [
      { type: 'hill', x: 0, z: 62, r: 34, h: 16 }, { type: 'flat', x: 0, z: 62, r: 6, h: 15.5, fall: 6 },
      { type: 'valley', path: [[-100, 10], [-20, 20], [40, 5], [100, 20]], width: 26, depth: 6 },
      { type: 'road', path: [[0, -80], [5, -30], [-4, 10], [0, 40], [0, 58]], width: 2.2 },
      { type: 'flat', x: 0, z: -70, r: 16, h: 1, fall: 10 }, { type: 'hill', x: -55, z: -30, r: 30, h: 9 }, { type: 'hill', x: 55, z: -20, r: 30, h: 8 },
    ] },
    build(kit) {
      kit.house('barracks', -10, -76, 0.1, { w: 14, d: 5 }); kit.campfire(4, -66); kit.flag(-2, -64, '1919', 4.5);
      kit.house('hut', 0, 64, Math.PI, { w: 4.5, d: 3.5 });
      kit.forest({ x: -40, z: 30, w: 70, d: 60 }, 70, ['larch', 'pine', 'birch']);
      kit.forest({ x: 42, z: 34, w: 60, d: 60 }, 60, ['larch', 'pine', 'oak']);
      kit.forest({ x: 0, z: -20, w: 30, d: 30 }, 14, ['oak', 'birch']);
      for (let i = 0; i < 26; i++) kit.bush(-60 + Math.random() * 120, -40 + Math.random() * 90, 1);
      kit.rock(10, 22, 1.3, true); kit.rock(-12, 34, 1.2, true); kit.rock(6, 46, 1.1); kit.log(-6, 8, 0.6, 5); kit.log(14, -6, -0.4, 4);
      kit.crops({ x: -30, z: -40, w: 26, d: 18 });
      kit.bridge(-4, 2, -4, 18, 2.5);
    },
  },
  start: { pos: [2, -60], facing: 0 },
  extraction: [2, -62, 6],
  squad: [
    { id: 'gilsu', name: GILSU, role: 'scout', outfit: 'cadet1919', weapon: 'none', pos: [0, -62] },
    { id: 'hyeonbin', name: HYEONBIN, role: 'rifle', outfit: 'cadet1919', weapon: 'none', pos: [4, -62], seed: 4 },
  ],
  enemies: [
    { id: 'i1', outfit: 'instructor', label: 'instructor', weapon: 'none', noShoot: true, lantern: true, pos: [-4, 12], route: [[-4, 6, 4, 0], [-4, 22, 4, Math.PI]], pingpong: true, viewRange: 26, fov: 1.7, speedWalk: 0.9 },
    { id: 'i2', outfit: 'instructor', label: 'instructor', weapon: 'none', noShoot: true, lantern: true, pos: [20, 30], route: [[24, 24, 2], [10, 40, 2], [-16, 42, 2], [-22, 26, 2]], viewRange: 26, fov: 1.7, speedWalk: 1.0 },
    { id: 'i3', outfit: 'instructor', label: 'instructor', weapon: 'none', noShoot: true, lantern: true, pos: [3, 54], facing: Math.PI, viewRange: 22, fov: 1.6, scanArc: 2.4 },
    { id: 'i4', outfit: 'instructor', label: 'instructor', weapon: 'none', noShoot: true, lantern: true, pos: [30, -10], route: [[34, -16, 3], [18, 2, 3]], pingpong: true, viewRange: 24, fov: 1.7, speedWalk: 0.9 },
  ],
  civilians: [{ id: 'newcomer', name: S('A newcomer from Pyongan Province', '평안도에서 온 신입'), outfit: 'hanbok_m', pos: [6, -64], facing: -Math.PI / 2, detectable: false, seed: 9 }],
  intro: [NARR('Spring 1919. Gosanja. Newcomers arrive almost every day now.', '1919년 봄, 고산자. 이제 거의 날마다 새로 오는 이들이 있다.')],
  objectives: [
    { id: 'news', type: 'flag', flag: 'news', marker: [6, -64], text: S('Hear the newcomer\'s news from home', '고향 소식을 전하는 신입의 이야기 듣기') },
    { id: 'scout', type: 'observe', need: 3, marker: [0, -8], text: S('Scout the valley: observe three lantern patrols (Gil-su reports what he sees)', '골짜기 정찰: 등불 순찰 셋 관찰하기 (길수가 본 것을 보고한다)'), xp: ['intel', 8] },
    { id: 'hut', type: 'flag', flag: 'order', marker: [0, 62.5], checkpoint: true, checkpointPos: [0, -10], text: S('Reach the hilltop hut unseen and take the sealed exercise order', '들키지 않고 산마루 오두막에 가서 봉인된 연습 명령서 가져오기') },
    { id: 'back', type: 'extract', zone: [2, -62, 6], checkpoint: true, checkpointPos: [0, 58], text: S('Bring the order and your whole section back to camp', '명령서와 분대 전원을 데리고 야영지로 돌아오기') },
  ],
  optional: [
    { id: 'ghost', text: S('Finish without any instructor noticing your section', '어떤 교관도 눈치채지 못하게 끝내기'), check: (g, m) => m.index >= 4, fail: (g) => g.enemies.some((e) => e.mode !== 'patrol' && e.mode !== 'guard'), xp: ['intel', 15] },
  ],
  setup(g) {
    talk(g, { id: 'newsTalk', actor: g.civilians[0], prompt: S('Listen to the newcomer', '신입의 이야기 듣기'), flag: 'news', lines: [
      SAY(S('Newcomer', '신입'), 'In our town the whole market shouted "Manse" — old women, schoolboys, everyone. No one had a weapon. They came at us anyway.', '우리 고을에선 장터 사람들이 다 만세를 불렀어요. 할머니도 학생도. 아무도 무기가 없었는데, 그래도 그들이 덤벼들었지요.'),
      FACT('The March First Movement (1919) was a peaceful mass movement that spread nationwide and abroad; it was met with violent repression.', '3·1 운동(1919)은 전국과 해외로 퍼진 평화적 대중 운동이었고, 폭력적인 탄압을 받았다.', 6),
      SAY(S('Newcomer', '신입'), 'They say there is a government now, in Shanghai. A republic. I came here to learn to defend it.', '이제 상하이에 정부가 생겼답니다. 민국이래요. 그걸 지킬 줄 알고 싶어서 왔습니다.'),
      FACT('The Provisional Government of the Republic of Korea was proclaimed in Shanghai on 11 April 1919.', '대한민국 임시정부는 1919년 4월 11일 상하이에서 수립되었다.', 5),
    ] });
    pickup(g, { id: 'order', pos: [0.8, 61.2], kind: 'docs', prompt: S('Take the sealed exercise order', '봉인된 연습 명령서 챙기기'), flag: 'order', y: g.groundY(0.8, 61.2) + 0.8, onUse: (gg) => gg.narrate([SAY(GILSU, 'Got it? Then down the far side — they\'ll expect us back the way we came.', '챙겼어? 그럼 반대쪽으로 내려가자. 우리가 온 길로 돌아올 줄 알 테니까.')]) });
    g.squad.forEach((a) => { a.viewRange = a.role === 'scout' ? 40 : 26; });
  },
  rewards: { food: 1, cloth: 2, network: 5 },
};
