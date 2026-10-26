// Chapter 5 — 1920–1925. Refugees and testimony after the Gando massacre; Svobodny 1921; a Jeongui-bu courier in 1925.
// The massacre is never shown: the player meets survivors, burnt-out houses and smoke on the horizon.
import { S, NARR, SAY, FACT, pickup, dropoff, talk, near } from './common.js';

const CH = S('Chapter 5 · Winter of Ashes', '5장 · 재의 겨울');
const YEONHUI = S('Kim Yeon-hui', '김연희');
const SEUNG = S('O Se-ung', '오세웅');
const TAESIK = S('Jang Tae-sik', '장태식');
const HYEON = S('Namgung Hyeon', '남궁현');

// ------------------------------------------------------------------------------------------- 5a
export const m5a = {
  id: 'm5a', chapter: 'ch5', chapterLabel: CH,
  title: S('The Road Out of Gando', '간도를 떠나는 길'), date: S('November 1920', '1920년 11월'), place: S('Hills near Yongjeong, North Gando', '북간도 용정 부근 산지'),
  unit: S('Village schoolteacher and liaison', '마을 학교 교사이자 연락원'),
  protagonist: { id: 'yeonhui', name: YEONHUI, outfit: 'refugee_w', weapon: 'none',
    desc: S('a 26-year-old teacher at a Korean village school, who also carried messages for the local association.', '한인 마을 학교의 스물여섯 살 교사. 지역 단체의 연락도 맡았다.') },
  historyNote: S('From October 1920 Japanese troops sent into Gando massacred Korean civilians and burned villages, schools and churches. Foreign missionaries and journalists recorded what they saw. Victim numbers differ between sources.', '1920년 10월부터 간도에 출병한 일본군은 한인 민간인을 학살하고 마을·학교·교회를 불태웠다. 외국인 선교사와 기자들이 이를 기록했다. 희생자 수는 자료마다 다르다.'),
  createdNote: S('Yeon-hui, the survivors, the route and the mission station are created for the game. The game does not show the killings.', '연희와 생존자들, 피란 경로와 선교 거점은 게임 구성이다. 게임은 학살 장면을 보여 주지 않는다.'),
  briefing: [
    S('Your village was burned three days ago. A few families escaped into the ravine behind the school.', '사흘 전 마을이 불탔다. 몇몇 가족이 학교 뒤 골짜기로 피했다.'),
    S('Soldiers still patrol the roads. Lead the families north over the hills to the mission station, where the doctor has offered shelter — and where what happened can be written down and sent abroad.', '군인들이 아직 길을 순찰한다. 가족들을 이끌고 언덕을 넘어 북쪽 선교 거점으로 가라. 의사가 피신처를 내주었고, 그곳에서 일어난 일을 기록해 바깥으로 보낼 수 있다.'),
    S('You are unarmed. Tell the group to wait in cover while you scout, then lead them across when the way is clear.', '당신은 비무장이다. 정찰하는 동안 일행을 숨어 기다리게 하고, 길이 비면 이끌어 건너라.'),
  ],
  after: [
    S('Testimony and records made by missionaries, journalists and Korean organisations carried news of the massacre beyond Gando. A Korean reporter who went to investigate disappeared.', '선교사·기자·한인 단체가 남긴 증언과 기록이 참변의 소식을 간도 밖으로 전했다. 취재하러 간 한국인 기자는 실종되었다.'),
  ],
  music: 'sorrow', combatMusic: 'combat', seed: 19201101, ammo: 0, bandages: 3,
  env: {
    biome: 'manchuria_winter', season: 'winter', time: 'overcast', weather: 'snow', grade: 'winter', ambience: { wind: 1.2 }, wind: 1.4, cold: true,
    terrain: { size: 220, seed: 91, noiseAmp: 8, edgeRise: 26, features: [
      { type: 'valley', path: [[-110, -10], [-40, 0], [20, -8], [110, 4]], width: 34, depth: 8 },
      { type: 'road', path: [[-110, -6], [-40, 2], [20, -6], [110, 6]], width: 3 },
      { type: 'flat', x: 30, z: -40, r: 16, h: null, fall: 10 }, { type: 'valley', path: [[60, -90], [48, -60], [40, -46]], width: 14, depth: 6 },
      { type: 'flat', x: -60, z: 70, r: 18, h: null, fall: 10 }, { type: 'road', path: [[-60, 70], [-50, 40], [-30, 10]], width: 1.5 },
      { type: 'hill', x: -10, z: 40, r: 30, h: 8 },
    ] },
    build(kit, ctx) {
      // the burnt village (ruins, no bodies), smoke on the horizon
      kit.house('ruin', 26, -38, 0.2); kit.house('ruin', 38, -44, -0.3, { w: 7 }); kit.house('ruin', 18, -48, 0.6, { w: 6 }); kit.house('ruin', 34, -30, 1.4, { w: 9 });
      ctx.effects.smokeColumn(30, -40, { color: '#4d4a47', height: 30, rate: 0.35 });
      ctx.effects.smokeColumn(-90, -60, { color: '#5b5856', height: 50, rate: 0.5 });
      ctx.effects.smokeColumn(100, 40, { color: '#5b5856', height: 50, rate: 0.6 });
      kit.house('manchu', -58, 74, Math.PI, { snow: true, w: 10 }); kit.house('choga', -70, 64, Math.PI / 2, { snow: true });
      kit.forest({ x: 0, z: 70, w: 200, d: 40 }, 110, ['larch', 'pine', 'birch', 'dead']);
      kit.forest({ x: 0, z: -78, w: 200, d: 30 }, 80, ['larch', 'pine', 'dead']);
      kit.forest({ x: -10, z: 36, w: 50, d: 30 }, 40, ['pine', 'birch']);
      for (let i = 0; i < 50; i++) kit.bush(-100 + Math.random() * 200, -70 + Math.random() * 140, 1);
      for (let i = 0; i < 16; i++) kit.rock(-100 + Math.random() * 200, -60 + Math.random() * 120, 1.2, true);
      kit.cart(-6, -2, 1.2); kit.hay(-24, 8);
    },
  },
  start: { pos: [52, -62], facing: 0 },
  enemies: [
    { id: 'r1', outfit: 'jp_army1920', weapon: 'rifle_jp', noShoot: true, label: 'patrol', pos: [-60, 0], route: [[-80, 2, 4], [40, -4, 4]], pingpong: true, viewRange: 32, fov: 1.6, speedWalk: 1.1 },
    { id: 'r2', outfit: 'jp_army1920', weapon: 'rifle_jp', noShoot: true, label: 'patrol', pos: [30, -5], route: [[50, -2, 3], [-20, 0, 3]], pingpong: true, viewRange: 32, fov: 1.6, speedWalk: 1.0 },
    { id: 'r3', outfit: 'jp_army1920', weapon: 'rifle_jp', noShoot: true, label: 'sentry', pos: [-6, 4], facing: Math.PI, viewRange: 28, fov: 1.5, scanArc: 2.0 },
    { id: 'r4', outfit: 'jp_army1920', weapon: 'rifle_jp', noShoot: true, label: 'patrol', pos: [-30, 30], route: [[-40, 26, 3], [-16, 36, 3], [-30, 46, 3]], viewRange: 26, fov: 1.6, speedWalk: 0.9 },
    { id: 'r5', outfit: 'jp_army1920', weapon: 'rifle_jp', noShoot: true, label: 'patrol', pos: [30, -34], route: [[34, -34, 6], [22, -44, 6]], pingpong: true, viewRange: 24, fov: 1.6, speedWalk: 0.7 },
  ],
  civilians: [
    { id: 's1', name: S('Grandmother Choe', '최씨 할머니'), outfit: 'refugee_w', pos: [54, -66], facing: 0.5, escort: true, group: 'fam', mode: 'hide' },
    { id: 's2', name: S('Mrs Pak', '박씨 아주머니'), outfit: 'settler_w', pos: [50, -67], facing: -0.3, escort: true, group: 'fam', mode: 'hide' },
    { id: 's3', name: S('Dong-su (child)', '동수 (아이)'), outfit: 'child', pos: [52, -68], escort: true, group: 'fam', mode: 'hide' },
    { id: 's4', name: S('Old Mr Yun', '윤씨 노인'), outfit: 'refugee_m', pos: [56, -64], facing: 1, escort: true, group: 'fam', mode: 'hide' },
    { id: 's5', name: S('Sun-i (child)', '순이 (아이)'), outfit: 'child', pos: [49, -64], escort: true, group: 'fam', mode: 'hide', seed: 4 },
    { id: 'doc', name: S('The mission doctor (fictional)', '선교 병원 의사 (가상 인물)'), outfit: 'officer_civ', pos: [-56, 66], facing: Math.PI, detectable: false, skin: '#e9c7a8' },
  ],
  intro: [
    NARR('November 1920. Snow over the ashes.', '1920년 11월. 재 위로 눈이 내린다.'),
    FACT('Japanese troops burned Korean villages, schools and churches across Gando that autumn and winter.', '그해 가을과 겨울, 일본군은 간도 곳곳의 한인 마을과 학교, 교회를 불태웠다.', 5),
  ],
  objectives: [
    { id: 'listen', type: 'count', prefix: 'testimony_', need: 3, marker: [52, -66], text: S('Sit with the survivors and write down what they saw (3)', '생존자들 곁에 앉아 본 것을 받아 적기 (3)'), xp: ['intel', 15] },
    { id: 'scout', type: 'observe', need: 3, marker: [10, -10], text: S('Scout the valley road: observe the soldiers on it (3)', '골짜기 길 정찰: 길 위의 군인 관찰하기 (3)') },
    { id: 'cross', type: 'escort', group: 'fam', zone: [-10, 40, 12], checkpoint: true, checkpointPos: [48, -60],
      text: S('Lead the families across the valley to the pine wood on the hill (tell them to wait when you scout ahead)', '가족들을 이끌고 골짜기를 건너 언덕 위 솔숲으로 가기 (앞을 살필 땐 기다리게 하라)'),
      onStart: (g) => g.narrate([SAY(YEONHUI, 'Stay close, keep low, and when I raise my hand — stop.', '바짝 붙어서 몸을 낮춰요. 내가 손을 들면 — 멈춰요.')]) },
    { id: 'station', type: 'escort', group: 'fam', zone: [-58, 64, 10], checkpoint: true, checkpointPos: [-10, 40],
      text: S('Bring everyone to the mission station on the north hill', '모두를 북쪽 언덕의 선교 거점으로 데려가기'),
      onStart: (g) => { for (const c of g.civilians) if (c.def.group === 'fam' && c.mode === 'safe') { c.mode = 'follow'; c.leader = g.player; } g.refreshLists(); } },
    { id: 'record', type: 'flag', flag: 'recorded', marker: [-56, 66], text: S('Give the testimony to the mission doctor', '선교 병원 의사에게 증언 기록 전하기'), xp: ['intel', 20] },
  ],
  optional: [
    { id: 'unseen', text: S('Bring the families through without any soldier growing suspicious', '어떤 군인도 의심하지 않게 가족들을 데려오기'), check: (g, m) => m.has('recorded'), fail: (g) => g.enemies.some((e) => e.mode === 'search' || e.mode === 'detain'), xp: ['rescue', 25] },
  ],
  setup(g) {
    const sv = g.civilians;
    const lines = [
      [SAY(sv[0].name, 'They came before light. They told the men to come out to the yard. I don\'t want to say the rest. Write that we were here, that we had a school.', '날 밝기 전에 왔어. 사내들을 마당으로 나오라고 했지. 그다음은 말하고 싶지 않아. 우리가 여기 살았다고, 학교가 있었다고 적어 줘.')],
      [SAY(sv[1].name, 'The church went first, then the school. My husband carried the books out. He didn\'t come back from the yard.', '교회가 먼저, 그다음 학교였어요. 남편이 책을 들고 나갔는데 마당에서 돌아오지 않았어요.')],
      [SAY(sv[3].name, 'Seventy-one years old and I have never been asked to say what I saw. Write my name properly. Yun, with the right character.', '일흔한 해를 살면서 본 걸 말해 달라는 말은 처음 듣네. 내 이름 바로 써 주게. 윤가, 제 글자로.')],
    ];
    [0, 1, 3].forEach((k, i) => talk(g, { id: 'tst' + i, actor: sv[k], prompt: S('Listen and write it down', '들으며 받아 적기'), flag: 'testimony_' + i, lines: lines[i] }));
    talk(g, { id: 'docTalk', actor: sv[5], prompt: S('Give the testimony to the doctor', '의사에게 증언 기록 건네기'), flag: 'recorded', enabled: (gg) => gg.mission.index >= 4, lines: [
      SAY(sv[5].name, 'Come in, all of you. The children first, by the stove.', '모두 들어오세요. 아이들 먼저, 난로 곁으로.'),
      SAY(sv[5].name, 'I will copy these tonight and send them out by two different roads. People abroad must read this.', '오늘 밤 이것을 베껴 두 갈래 길로 내보내겠습니다. 바깥 사람들이 읽어야 합니다.'),
      FACT('Missionaries and journalists recorded the Gando massacre and made it known abroad.', '선교사와 기자들이 간도 참변을 기록해 바깥에 알렸다.', 5),
    ] });
  },
  rewards: { trust: 15, network: 5 },
};

// ------------------------------------------------------------------------------------------- 5b
export const m5b = {
  id: 'm5b', chapter: 'ch5', chapterLabel: CH,
  title: S('Free City', '자유시'), date: S('June 1921', '1921년 6월'), place: S('Svobodny, on the Zeya River (Russian Far East)', '제야강 변 스보보드니 (러시아 극동)'),
  unit: S('Soldier of a unit that crossed from Manchuria', '만주에서 건너온 부대의 대원'),
  protagonist: { id: 'seung', name: SEUNG, outfit: 'army1920b', weapon: 'none',
    desc: S('a 21-year-old who fought at Cheongsan-ri and crossed into Russia with the Korean Independence Corps.', '청산리에서 싸우고 대한독립군단과 함께 러시아로 건너온 스물한 살 대원.') },
  historyNote: S('Korean units gathered at Svobodny were caught in a struggle over command, tied to rival Korean communist factions. When the Sakhalin Volunteer Corps refused to be disarmed, it was attacked by Red Army troops and the rival Korean force; many were killed, drowned or captured. It was not a battle against Japan.', '자유시에 모인 한인 부대들은 고려공산당 파벌 갈등과 얽힌 지휘권 다툼에 휘말렸다. 무장해제를 거부한 사할린의용대를 적군과 상대 한인 부대가 공격해 많은 이가 죽거나 물에 빠지거나 포로가 되었다. 일본군과의 전투가 아니었다.'),
  createdNote: S('Se-ung, Tae-sik and the people in the camp are fictional, and so are their conversations. The game does not show the attack; it follows two men trying to reach the river afterwards.', '세웅과 태식, 진영의 사람들과 그들의 대화는 가상이다. 게임은 공격 장면을 보여 주지 않고, 그 뒤 강으로 가려는 두 사람을 따라간다.'),
  briefing: [
    S('Months after crossing the border, your unit waits in a camp outside Svobodny. Two command councils claim the Korean units; there is talk of orders to hand over all weapons.', '국경을 넘은 지 몇 달, 부대는 스보보드니 밖 진영에서 기다린다. 두 지휘 기구가 한인 부대들을 서로 거느리겠다고 하고, 무기를 모두 내놓으라는 명령이 내려온다는 말이 돈다.'),
    S('Walk the camp and hear what people say. Then, when it all goes wrong, get your wounded friend Tae-sik to the reeds by the river.', '진영을 걸으며 사람들의 말을 들어라. 그리고 모든 것이 어긋났을 때, 다친 친구 태식을 강가 갈대숲까지 데려가라.'),
  ],
  after: [
    S('The Free City incident devastated the independence army that had crossed from Manchuria. Survivors made their way back over years; the movement in Manchuria had to be rebuilt almost from the beginning.', '자유시 참변은 만주에서 건너온 독립군에 큰 타격을 주었다. 살아남은 이들은 여러 해에 걸쳐 돌아왔고, 만주의 운동은 거의 처음부터 다시 세워야 했다.'),
    S('Dates and casualty figures differ between sources.', '날짜와 희생자 수는 자료마다 다르다.'),
  ],
  music: 'sorrow', combatMusic: 'sorrow', seed: 1921, ammo: 0, bandages: 2,
  env: {
    biome: 'siberia_summer', season: 'summer', time: 'dusk', weather: 'clear', grade: 'dusk', ambience: { wind: 0.5, insects: 0.8, river: 0.8, camp: 0.6 }, wind: 0.6,
    terrain: { size: 180, seed: 101, noiseAmp: 3, waterLevel: -1.8, edgeRise: 18, features: [
      { type: 'river', path: [[-100, -64], [0, -70], [100, -60]], width: 24, depth: 6 },
      { type: 'flat', x: 0, z: 20, w: 120, d: 60, h: 0.8, fall: 14 }, { type: 'road', path: [[-80, 20], [80, 26]], width: 3 },
      { type: 'road', path: [[0, 20], [6, -40], [10, -56]], width: 1.6 },
    ] },
    build(kit) {
      for (let i = 0; i < 6; i++) kit.house('barracks', -50 + i * 20, 42, Math.PI, { w: 14, d: 5, roof: '#5d5a4e' });
      for (let i = 0; i < 8; i++) kit.house('tent', -60 + i * 16, 6, (i % 2) * 0.3, { w: 4, d: 3, color: '#8a876c' });
      kit.campfire(-20, 18); kit.campfire(20, 16); kit.table(0, 30, 0.2); kit.crates(14, 30, 0.2, 3); kit.crates(-34, 28, 0.6, 2, 'sack');
      kit.forest({ x: 0, z: 74, w: 170, d: 20 }, 60, ['birch', 'larch', 'poplar']);
      kit.forest({ x: -60, z: -36, w: 60, d: 30 }, 50, ['birch', 'willow', 'poplar']); kit.forest({ x: 60, z: -36, w: 60, d: 30 }, 50, ['birch', 'willow']);
      for (let i = 0; i < 40; i++) kit.bush(-80 + Math.random() * 160, -56 + Math.random() * 30, 1.2);
      kit.crops({ x: 10, z: -52, w: 30, d: 6 }, 'stalk'); // reeds along the bank
      kit.boat(-20, -60, 0.2);
    },
  },
  start: { pos: [-10, 14], facing: 0 },
  squad: [{ id: 'taesik', name: TAESIK, role: 'rifle', outfit: 'army1920', weapon: 'none', pos: [-12, 12], order: 'follow' }],
  civilians: [
    { id: 'p1', name: S('A soldier from Milsan', '밀산에서 온 대원'), outfit: 'army1920', pos: [-20, 22], facing: 0.5, detectable: false, seed: 31 },
    { id: 'p2', name: S('A soldier who came from Russia', '러시아에서 온 대원'), outfit: 'sovietRA', pos: [4, 30], facing: Math.PI, detectable: false, seed: 32 },
    { id: 'p3', name: S('An old fighter from Gando', '간도에서 온 노병'), outfit: 'army1920w', pos: [20, 20], facing: -1, detectable: false, seed: 33 },
  ],
  enemies: [],
  intro: [NARR('June 1921. Svobodny — the "Free City". Midges, river damp, and rumours.', '1921년 6월. 스보보드니, "자유시". 날벌레와 강의 눅눅함, 그리고 소문.')],
  objectives: [
    { id: 'listen', type: 'count', prefix: 'heard_', need: 3, marker: (g) => { const c = g.civilians.find((c) => !g.flags.has('heard_' + c.id)); return c ? [c.x, c.z] : null; }, text: S('Walk through the camp and hear what people say (3)', '진영을 돌며 사람들의 말을 듣기 (3)') },
    { id: 'night', type: 'wait', timer: 4, text: S('…', '…'),
      onStart: (g) => { g.renderer.setGrade('night'); g.narrate([
        FACT('The units were ordered to submit to a single command and hand over their weapons. The Sakhalin Volunteer Corps refused.', '부대들에 하나의 지휘에 따르고 무기를 넘기라는 명령이 내려졌다. 사할린의용대는 이를 거부했다.', 6),
        FACT('It was attacked by Red Army troops and the rival Korean force. Many were killed, drowned in the river, or taken prisoner.', '적군과 상대 한인 부대가 공격했다. 많은 이가 죽거나 강에 빠지거나 포로가 되었다.', 6),
      ]); } },
    { id: 'river', type: 'carry', actor: 'taesik', zone: [12, -50, 6], checkpoint: true, checkpointPos: [-10, 10],
      text: S('Get Tae-sik to the reeds by the river without being seen by the units enforcing the disarmament', '무장해제를 집행하는 부대에 들키지 않고 태식을 강가 갈대숲까지 데려가기'),
      onStart: (g) => {
        const t = g.squad[0]; t.state = 'wounded'; t.treated = false; t.severe = true; t.bleedT = 200 * g.diff.bleed; t.x = -14; t.z = 6; t.y = g.groundY(-14, 6);
        for (const c of g.civilians) c.model.root.visible = false, c.state = 'gone';
        const pts = [[[-40, -10], [30, -16]], [[40, -30], [-30, -26]], [[-6, 0], [-6, 0]]];
        pts.forEach((r, i) => g.spawnEnemy({ id: 'x' + i, outfit: i === 1 ? 'army1920' : 'sovietRA', weapon: 'rifle_mosin', noShoot: true, label: 'soldier', lantern: true, pos: r[0], route: [[...r[0], 4], [...r[1], 4]], pingpong: true, viewRange: 22, fov: 1.6, speedWalk: 1.0 }));
        g.refreshLists();
        g.narrate([SAY(TAESIK, 'Se-ung… my leg. Leave the rifle, we haven\'t got one anyway. Just get me to the water.', '세웅아… 다리가. 총은 두고 가. 어차피 없잖아. 물가까지만 데려다 줘.')]);
      } },
    { id: 'hide', type: 'wait', timer: 6, zone: [12, -50, 8], text: S('Stay down in the reeds until the lanterns pass', '등불이 지나갈 때까지 갈대숲에 엎드려 있기'),
      onStart: (g) => g.narrate([SAY(TAESIK, 'We crossed one river to come here. We\'ll cross another to go home.', '여기 오려고 강 하나를 건넜지. 집에 가려면 또 하나를 건너야겠네.')]) },
  ],
  setup(g) {
    const [p1, p2, p3] = g.civilians;
    talk(g, { id: 'h1', actor: p1, prompt: S('Listen', '듣기'), flag: 'heard_p1', lines: [SAY(p1.name, 'We came here to fight Japan. Now there are two councils, and each says the other has no right to command us.', '우리는 일본과 싸우려고 여기 왔어. 그런데 지휘하겠다는 곳이 둘이고, 서로 상대가 우리를 거느릴 자격이 없다고 하지.')] });
    talk(g, { id: 'h2', actor: p2, prompt: S('Listen', '듣기'), flag: 'heard_p2', lines: [SAY(p2.name, 'The Russians want one army they can count. Japan wants every Korean rifle in Russia taken away. The orders say: hand everything over.', '러시아 쪽은 셀 수 있는 군대 하나를 원해. 일본은 러시아에 있는 한인의 총을 모조리 빼앗으라 하고. 명령은 이래 — 모두 넘겨라.'), FACT('Japan pressed Soviet Russia to disarm Korean units on its territory.', '일본은 소련에 자국 영토 내 한인 부대의 무장해제를 요구했다.', 4)] });
    talk(g, { id: 'h3', actor: p3, prompt: S('Listen', '듣기'), flag: 'heard_p3', lines: [SAY(p3.name, 'I have buried friends from Bongo-dong to Cheongsan-ri. I did not walk all this way to be disarmed by Koreans.', '봉오동에서 청산리까지 동무들을 묻었네. 같은 조선 사람한테 무장해제 당하려고 여기까지 걸어온 게 아니야.')] });
  },
  failIf: (g) => (g.squad[0]?.state === 'lost' ? 'squadLost' : null),
  rewards: {},
};

// ------------------------------------------------------------------------------------------- 5c
export const m5c = {
  id: 'm5c', chapter: 'ch5', chapterLabel: CH,
  title: S('Three Governments', '세 개의 부(府)'), date: S('Autumn 1925', '1925년 가을'), place: S('Korean farming villages, South Manchuria (Jeongui-bu area)', '남만주 한인 농촌 (정의부 지역)'),
  unit: S('District liaison of Jeongui-bu', '정의부 지방 연락원'),
  protagonist: { id: 'hyeon', name: HYEON, outfit: 'liaison_m', weapon: 'none',
    desc: S('a 30-year-old former Sinheung student who now keeps accounts for a Jeongui-bu district office.', '신흥무관학교 출신의 서른 살. 지금은 정의부 지방 사무소의 장부를 맡는다.') },
  historyNote: S('Jeongui-bu (1924) governed Korean settlers across South Manchuria with its own administration, schools, taxes and army; Chamui-bu worked along the Amnok, Sinmin-bu in the north. After the Mitsuya Agreement of June 1925, Chinese authorities in Manchuria arrested activists and handed them to Japan.', '정의부(1924)는 남만주 한인 이주민을 자치 행정·학교·세금·군대로 다스렸다. 참의부는 압록강 연안, 신민부는 북쪽에서 활동했다. 1925년 6월 미쓰야 협정 뒤 만주의 중국 당국은 독립운동가를 체포해 일본에 넘겼다.'),
  createdNote: S('Namgung Hyeon, the households, the school and the district office are created for the game.', '남궁현과 농가들, 학교, 지방 사무소는 게임 구성이다.'),
  briefing: [
    S('Collect the year\'s contributions from two farm households, leave the school\'s textbooks at the village school, and bring the accounts to the district office in the hills.', '두 농가에서 올해의 의연금을 거두고, 마을 학교에 교과서를 두고, 장부를 산속 지방 사무소로 가져가라.'),
    S('Since the summer, local police have been working with Japanese consular police. Both now patrol the roads.', '여름부터 지방 경찰이 일본 영사관 경찰과 손잡았다. 이제 둘 다 길을 순찰한다.'),
  ],
  after: [S('In 1928–1929 the three bodies tried to merge; they regrouped as the National Government (국민부) and the Reform Council (혁신의회), which in turn gave rise to the armies of the 1930s.', '1928~1929년 세 부는 통합을 시도했고, 국민부와 혁신의회로 재편되었다. 이는 1930년대의 군대로 이어졌다.')],
  music: 'explore', combatMusic: 'combat', seed: 1925, ammo: 0, bandages: 1,
  env: {
    biome: 'manchuria_autumn', season: 'autumn', time: 'day', weather: 'clear', grade: 'autumn', ambience: { wind: 0.7, birds: 0.7 }, wind: 0.9,
    terrain: { size: 200, seed: 111, noiseAmp: 6, features: [
      { type: 'flat', x: -30, z: -30, r: 30, h: 0.5, fall: 14 }, { type: 'flat', x: 50, z: 60, r: 12, h: null, fall: 10 },
      { type: 'road', path: [[-100, -40], [-30, -30], [20, 0], [60, 20], [100, 30]], width: 3.4 }, { type: 'road', path: [[20, 0], [40, 40], [50, 60]], width: 1.5 },
      { type: 'field', x: -50, z: -10, w: 30, d: 20 }, { type: 'field', x: 0, z: -56, w: 30, d: 18 }, { type: 'hill', x: 60, z: 70, r: 40, h: 14 },
    ] },
    build(kit) {
      kit.house('choga', -42, -40, 0.2); kit.house('manchu', -20, -48, -0.1); kit.house('choga', -10, -26, Math.PI / 2); kit.house('barracks', -36, -16, 0.1, { w: 12, d: 5, roof: '#7a6a50' }); // school
      kit.crops({ x: -50, z: -10, w: 30, d: 20 }); kit.crops({ x: 0, z: -56, w: 30, d: 18 });
      kit.house('manchu', 50, 62, Math.PI, { w: 8 }); kit.fence([[40, 54], [60, 54]], 'brush');
      kit.house('brick', 28, 6, 0.4, { w: 8 }); kit.signpost(16, 2, 0.6);
      kit.forest({ x: 60, z: 40, w: 60, d: 60 }, 80, ['larch', 'oak', 'pine', 'birch']); kit.forest({ x: -60, z: 50, w: 70, d: 40 }, 60, ['larch', 'oak']);
      for (let i = 0; i < 40; i++) kit.bush(-80 + Math.random() * 160, -60 + Math.random() * 120, 1.1);
      kit.hay(-24, -36); kit.hay(-50, -30); kit.cart(-4, -36, 0.4);
    },
  },
  start: { pos: [-70, -46], facing: 1.2 },
  enemies: [
    { id: 'cp1', outfit: 'chinese_nra', label: 'police', weapon: 'rifle_mauser', noShoot: true, pos: [20, 4], facing: -Math.PI / 2, viewRange: 26, fov: 1.6, scanArc: 2.4 },
    { id: 'cp2', outfit: 'chinese_nra', label: 'police', weapon: 'rifle_mauser', noShoot: true, pos: [-10, -30], route: [[-40, -34, 3], [10, -20, 3]], pingpong: true, viewRange: 24, fov: 1.6 },
    { id: 'jp1', outfit: 'jp_police1919', label: 'police', weapon: 'none', noShoot: true, pos: [40, 20], route: [[60, 20, 3], [30, 34, 3], [36, 46, 3]], pingpong: true, viewRange: 24, fov: 1.6 },
    { id: 'jp2', outfit: 'jp_police1919', label: 'police', weapon: 'none', noShoot: true, pos: [-50, -2], route: [[-60, 4, 4], [-30, 2, 4]], pingpong: true, viewRange: 22, fov: 1.6 },
  ],
  civilians: [
    { id: 'f1', name: S('Farmer Ko', '고씨 농부'), outfit: 'settler_m', pos: [-42, -45], facing: 0, detectable: false },
    { id: 'f2', name: S('Widow Seo', '서씨 부인'), outfit: 'settler_w', pos: [-20, -53], facing: 0, detectable: false },
    { id: 't1', name: S('Village teacher', '마을 훈장'), outfit: 'scholar', pos: [-36, -10], facing: Math.PI, detectable: false },
    { id: 'off', name: S('District office secretary (fictional)', '지방 사무소 서기 (가상 인물)'), outfit: 'liaison_m', pos: [50, 58], facing: Math.PI, detectable: false, seed: 6 },
    { id: 'k1', outfit: 'child', pos: [-34, -6], mode: 'wander', detectable: false }, { id: 'k2', outfit: 'child', pos: [-30, -8], mode: 'wander', detectable: false, seed: 3 },
  ],
  intro: [FACT('1925. Korean settlers in South Manchuria pay contributions to Jeongui-bu, which runs their schools and self-government.', '1925년. 남만주의 한인 이주민들은 학교와 자치를 맡은 정의부에 의연금을 낸다.', 5)],
  objectives: [
    { id: 'collect', type: 'count', prefix: 'paid_', need: 2, marker: (g) => { const c = g.civilians.slice(0, 2).find((c) => !g.flags.has('paid_' + c.id)); return c ? [c.x, c.z] : null; }, text: S('Collect the contributions from the two households', '두 농가에서 의연금 거두기') },
    { id: 'school', type: 'flag', flag: 'books', marker: [-36, -10], text: S('Leave the textbooks with the village teacher', '마을 훈장에게 교과서 전하기') },
    { id: 'office', type: 'flag', flag: 'accounts', marker: [50, 58], checkpoint: true, checkpointPos: [-34, -14], text: S('Bring the accounts to the district office in the hills — the crossroads are watched', '장부를 산속 지방 사무소로 가져가기 — 갈림길을 지키고 있다') },
  ],
  optional: [{ id: 'quiet', text: S('Avoid every patrol', '모든 순찰을 피하기'), check: (g, m) => m.has('accounts'), fail: (g) => g.enemies.some((e) => e.mode === 'search' || e.mode === 'detain'), xp: ['intel', 15] }],
  setup(g) {
    const [f1, f2, t1, off] = g.civilians;
    talk(g, { id: 'c1', actor: f1, prompt: S('Collect the contribution', '의연금 받기'), flag: 'paid_f1', lines: [SAY(f1.name, 'Half a sack\'s worth, in coins. The harvest was thin. Tell them the school must stay open.', '쌀 반 섬 값, 동전이오. 수확이 시원찮았소. 학교만은 꼭 열어 두라 전해 주시오.')] });
    talk(g, { id: 'c2', actor: f2, prompt: S('Collect the contribution', '의연금 받기'), flag: 'paid_f2', lines: [SAY(f2.name, 'My son is at the school. Take this — and the socks are for whoever needs them in the hills.', '아들이 그 학교에 다녀요. 이걸 가져가요. 버선은 산에 있는 누구든 필요한 사람에게.')] });
    talk(g, { id: 'c3', actor: t1, prompt: S('Hand over the textbooks', '교과서 전하기'), flag: 'books', lines: [SAY(t1.name, 'Korean readers and history. We teach them in the morning, and hide them in the afternoon.', '조선말 독본과 역사책이군요. 아침엔 가르치고, 오후엔 숨기지요.')] });
    talk(g, { id: 'c4', actor: off, prompt: S('Deliver the accounts', '장부 전하기'), flag: 'accounts', enabled: (gg) => gg.mission.index >= 2, lines: [SAY(off.name, 'Every coin recorded. After the agreement this summer, the police on both sides of the road are looking for exactly this book.', '한 푼도 빠짐없이 적혔군요. 올여름 협정 뒤로, 길 양쪽 경찰이 찾는 게 바로 이 장부요.'), FACT('Under the 1925 Mitsuya Agreement, Chinese authorities in Manchuria arrested Korean activists and handed them to Japan.', '1925년 미쓰야 협정으로 만주의 중국 당국은 한인 독립운동가를 체포해 일본에 넘겼다.', 5)] });
  },
  rewards: { funds: 4, network: 10, trust: 5 },
};
