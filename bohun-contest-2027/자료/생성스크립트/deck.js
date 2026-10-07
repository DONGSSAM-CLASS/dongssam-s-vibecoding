const pptxgen = require('pptxgenjs');
const SKILL = '/root/.claude/skills/synced/4e24799b-3084-4389-9cf9-cc68b960ec00_6a3b1269-56f2-4219-b79c-4802612148ea/pptx';
const { applyTheme } = require(SKILL + '/scripts/apply_theme.js');

const OUT = process.argv[2];
const FONT = '맑은 고딕';
const THEME = {
  name: 'FACT 기록관',
  headFontFace: FONT, bodyFontFace: FONT,
  colors: {
    dk1: '1B2433', lt1: 'FFFFFF', dk2: '1F3A5F', lt2: 'EEF2F7',
    accent1: '1F3A5F', accent2: 'B08D3C', accent3: 'A23B2C', accent4: '2E6B4F', accent5: '6B7A90', accent6: 'D9C08A',
    hlink: '1F3A5F', folHlink: '6B7A90',
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
pres.title = '기억은 FACT로 지킨다 - 수업 PPT';
pres.author = '서울번동중학교 김동은';
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: 'DARK',
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 1.5, w: 8.6, h: 1.4, fontSize: 40, bold: true, color: C.background1, align: 'left', valign: 'bottom' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.7, y: 3.05, w: 8.6, h: 1.2, fontSize: 18, color: C.accent6, align: 'left', valign: 'top' }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 1.25, y: 0.35, w: 8.25, h: 0.7, fontSize: 30, bold: true, color: C.text2, align: 'left', valign: 'middle', margin: 0 }, text: '' } },
    { text: { text: '기억은 FACT로 지킨다 · 임시정부·광복군 기록관 프로젝트', options: { x: 0.5, y: 5.22, w: 7, h: 0.3, fontSize: 10, color: C.accent5, isTextBox: true } } },
  ],
  slideNumber: { x: 9.0, y: 5.22, w: 0.5, h: 0.3, fontSize: 10, color: C.accent5, align: 'right' },
});

// ---------- helpers ----------
let sectionName = '';
function content(title, letter) {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: sectionName });
  s.addText(title, { placeholder: 'title' });
  // motif: FACT stage badge
  s.addShape(pres.shapes.OVAL, { x: 0.5, y: 0.42, w: 0.56, h: 0.56, fill: { color: C.accent2 }, line: { color: C.accent2 }, objectName: 'stage-badge' });
  s.addText(letter, { x: 0.5, y: 0.42, w: 0.56, h: 0.56, fontSize: 20, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0, isTextBox: true, objectName: 'stage-letter' });
  return s;
}
function dark(title, body) {
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: sectionName });
  s.addText(title, { placeholder: 'title' });
  if (body) s.addText(body, { placeholder: 'body' });
  return s;
}
function card(s, x, y, w, h, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: o.fill || C.background2 }, line: { color: o.line || o.fill || C.background2, width: o.lineW || 1 }, objectName: o.name || 'card' });
}
const txt = (s, text, x, y, w, h, o = {}) => s.addText(text, { x, y, w, h, fontSize: o.size || 16, color: o.color || C.text1, bold: o.bold, italic: o.italic, align: o.align || 'left', valign: o.valign || 'top', margin: o.margin ?? 0.08, isTextBox: true, paraSpaceAfter: o.psa, objectName: o.name });
function qr(s, x, y, label) {
  x = 8.1; y = 3.7;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 1.4, h: 1.35, rectRadius: 0.1, fill: { color: C.background1 }, line: { color: C.accent5, width: 1.5, dashType: 'dash' }, objectName: 'qr-slot' });
  txt(s, 'QR\n' + label, x, y, 1.4, 1.35, { size: 11, color: C.accent5, align: 'center', valign: 'middle' });
}
function steps(s, items, y, o = {}) {
  const n = items.length, gap = 0.3, w = (9 - gap * (n - 1)) / n;
  items.forEach(([head, body], i) => {
    const x = 0.5 + i * (w + gap);
    card(s, x, y, w, o.h || 2.6, { fill: o.fill });
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.2, w: 0.5, h: 0.5, fill: { color: C.text2 }, line: { color: C.text2 } });
    txt(s, String(i + 1), x + 0.2, y + 0.2, 0.5, 0.5, { size: 16, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0 });
    txt(s, head, x + 0.2, y + 0.8, w - 0.4, 0.5, { size: 18, bold: true, color: C.text2 });
    txt(s, body, x + 0.2, y + 1.3, w - 0.4, (o.h || 2.6) - 1.4, { size: 14 });
  });
}

// ===== 표지 =====
sectionName = '표지';
pres.addSection({ title: sectionName });
let s = dark('기억은 FACT로 지킨다', '임시정부·광복군 기록관 프로젝트 · 중학교 역사 · 4차시 + 실천');
s.addNotes('프로젝트 전체 표지. 사전 설문은 1차시 전날 과제로 실시합니다.');

s = content('기록관의 네 가지 임무', '★');
const fact = [['F', 'Feel', '임시정부와 광복군의\n선택을 체험한다', '1·2차시'], ['A', 'Authenticate', 'AI가 말하는 역사를\n사료로 검증한다', '3차시'], ['C', 'Connect', '임시정부의 약속을\n오늘의 헌법과 잇는다', '4차시'], ['T', 'Take action', '정확한 기억을 우리\n동네와 학교에 전한다', '실천']];
fact.forEach(([l, en, ko, when], i) => {
  const x = 0.5 + i * 2.325;
  card(s, x, 1.35, 2.025, 3.35);
  s.addShape(pres.shapes.OVAL, { x: x + 0.66, y: 1.6, w: 0.7, h: 0.7, fill: { color: C.accent2 }, line: { color: C.accent2 } });
  txt(s, l, x + 0.66, 1.6, 0.7, 0.7, { size: 24, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0 });
  txt(s, en, x + 0.1, 2.45, 1.825, 0.45, { size: 16, bold: true, color: C.text2, align: 'center' });
  txt(s, ko, x + 0.1, 2.95, 1.825, 1.0, { size: 14, align: 'center' });
  txt(s, when, x + 0.1, 4.1, 1.825, 0.4, { size: 12, color: C.accent5, align: 'center' });
});
s.addNotes('“잘못된 기억은 희생을 지운다. 정확히 기억하는 것이 보훈이다.” 이 문장을 프로젝트 내내 칠판 한쪽에 고정해 둡니다. 기록관 임명장을 나눠 줍니다.');

// ===== 1차시 =====
sectionName = '1차시 · 임시정부, 27년의 약속';
pres.addSection({ title: sectionName });
dark('1차시 · 임시정부, 27년의 약속', 'Feel ① · 웹앱 「임시정부 : 광복을 위한 꿈」').addNotes('1차시 45분: 도입 7분, 플레이 22분, 기록 카드 9분, 정리 7분.');

s = content('우리 헌법의 첫 문장, 빈칸을 채워 보세요', 'F');
card(s, 0.5, 1.35, 9, 2.1, { fill: C.background2 });
txt(s, '“유구한 역사와 전통에 빛나는 우리 대한국민은\n3·1운동으로 건립된 (                         )의 법통과\n불의에 항거한 4·19민주이념을 계승하고 …”', 0.8, 1.55, 8.4, 1.4, { size: 20, color: C.text2 });
txt(s, '대한민국헌법 전문 (1987)', 0.8, 2.95, 8.4, 0.4, { size: 12, color: C.accent5 });
card(s, 0.5, 3.7, 9, 1.25, { fill: C.text2 });
txt(s, '100년도 더 전에, 그것도 나라 밖에서 세운 정부를\n왜 오늘의 헌법은 ‘뿌리’라고 할까요?', 0.8, 3.8, 8.4, 1.05, { size: 20, bold: true, color: C.background1, valign: 'middle' });
s.addNotes('정답: 대한민국임시정부. 답을 공개한 뒤 아래 질문을 던지고, 이 질문은 4차시 마지막에 다시 답하게 된다고 예고합니다.');

s = content('오늘의 임무: 임시정부 요원이 되어 보기', 'F');
steps(s, [['2인 1기기', '한 명은 조작, 한 명은 사료 기록.\n미션마다 역할 교대'], ['사료 카드 수집', '앱 속 장면마다 나오는 사료를 기록 카드에 옮겨 적기'], ['한 가지 질문', '“이 선택을 한 사람들은 무엇을 포기했을까?”']], 1.35, { h: 2.15 });
qr(s, 7.9, 3.55, '임시정부 : 광복을 위한 꿈');
txt(s, '플레이 22분 · 진행이 빠른 모둠은 사료 원문 읽기 심화 미션', 0.5, 3.75, 7.3, 0.6, { size: 14, color: C.accent5 });
s.addNotes('시작 전 2분 조작 안내. 장면 이름은 실제 앱에 맞게 바꿔 말합니다. 순회하며 “무엇을 포기했을까?”를 반복해서 묻습니다.');

s = content('임정 활동 기록 카드 + 감정 온도계', 'F');
const rows1 = [
  [{ text: '활동', options: { bold: true, color: 'FFFFFF', fill: { color: HEX.dk2 } } }, { text: '시기', options: { bold: true, color: 'FFFFFF', fill: { color: HEX.dk2 } } }, { text: '근거가 된 사료', options: { bold: true, color: 'FFFFFF', fill: { color: HEX.dk2 } } }, { text: '오늘과 이어지는 점', options: { bold: true, color: 'FFFFFF', fill: { color: HEX.dk2 } } }],
  ['1.', '', '', ''], ['2.', '', '', ''], ['3.', '', '', ''],
];
s.addTable(rows1, { x: 0.5, y: 1.35, w: 5.6, colW: [1.1, 0.9, 1.8, 1.8], rowH: 0.5, fontSize: 13, fontFace: FONT, color: HEX.dk1, border: { type: 'solid', pt: 0.75, color: 'B7C2D0' }, valign: 'middle' });
card(s, 6.4, 1.35, 3.1, 3.3);
txt(s, '감정 온도계', 6.6, 1.5, 2.7, 0.45, { size: 18, bold: true, color: C.text2 });
for (let i = 0; i < 10; i++) {
  const lvl = 10 - i;
  s.addShape(pres.shapes.RECTANGLE, { x: 7.0, y: 2.05 + i * 0.24, w: 0.45, h: 0.2, fill: { color: lvl > 6 ? HEX.accent3 : lvl > 3 ? HEX.accent2 : HEX.accent6 }, line: { color: 'FFFFFF' } });
  txt(s, String(lvl), 7.5, 2.0 + i * 0.24, 0.4, 0.28, { size: 10, color: C.accent5, margin: 0 });
}
txt(s, '가장 마음이 움직인 장면과 그 이유', 7.95, 2.05, 1.45, 2.3, { size: 13 });
txt(s, '학습자료 1 · 9분', 0.5, 4.4, 5.6, 0.4, { size: 12, color: C.accent5 });
s.addNotes('감정 표현에는 정답이 없다고 안내합니다(SEL 자기인식). 모둠별 카드 1장을 패들렛 ‘기록 보관함’에 올립니다.');

s = content('출구 카드', 'F');
card(s, 0.5, 1.35, 9, 1.7, { fill: C.text2 });
txt(s, '임시정부가 27년 동안 버틸 수 있었던 힘은\n무엇이었을까?', 0.8, 1.45, 8.4, 1.5, { size: 24, bold: true, color: C.background1, valign: 'middle' });
card(s, 0.5, 3.3, 9, 1.55);
txt(s, '다음 시간 예고', 0.75, 3.4, 3, 0.4, { size: 14, bold: true, color: C.accent2 });
txt(s, '광복의 날, 임시정부 주석 김구는 왜 기뻐하지 않았을까?', 0.75, 3.85, 8.5, 0.8, { size: 20, color: C.text2 });
s.addNotes('출구 카드는 사후 설문 서술형과 비교하는 자료로 보관합니다.');

// ===== 2차시 =====
sectionName = '2차시 · 아직 오지 않은 광복';
pres.addSection({ title: sectionName });
dark('2차시 · 아직 오지 않은 광복', 'Feel ② · 웹앱 「아직 오지 않은 광복」').addNotes('2차시 45분: 도입 5분, 추리 플레이 22분, 토의 10분, 정리 8분.');

s = content('사료 퍼즐: 김구는 왜 기뻐하지 않았을까', 'F');
txt(s, '“', 0.5, 1.15, 1, 1.2, { size: 80, bold: true, color: C.accent2 });
txt(s, '아! 왜적이 항복! 이것은 내게 기쁜 소식이라기보다는\n(                                        ).\n천신만고로 수년간 애를 써서 참전할 준비를 한 것도 다 허사다.', 1.3, 1.45, 8.2, 1.9, { size: 20, color: C.text2 });
txt(s, '김구, 『백범일지』 · 1945년 8월, 중국 시안(西安)에서', 1.3, 3.35, 8.2, 0.4, { size: 12, color: C.accent5 });
card(s, 1.3, 3.9, 8.2, 0.95);
txt(s, '오늘 여러분은 광복군이 되어, 이 빈칸의 이유를 직접 추리합니다.', 1.5, 3.95, 7.8, 0.85, { size: 18, bold: true, color: C.text2, valign: 'middle' });
s.addNotes('빈칸 정답(하늘이 무너지는 듯한 일이었다)은 정리 단계에서 공개합니다. 인용 판본과 쪽수는 수업 자료에 표기합니다.');

s = content('광복군 추리 작전: 모둠 역할', 'F');
steps(s, [['사료 리더', '앱의 사료를 소리 내어 읽고 핵심 문장에 밑줄'], ['판단자', '사료를 근거로 모둠의 선택을 결정'], ['기록자', '선택 · 근거 사료 · 예상 결과를 판단 기록지에 기록']], 1.35, { h: 2.15 });
qr(s, 7.9, 3.55, '아직 오지 않은 광복');
txt(s, '1940 창설(충칭) → OSS 합작 훈련 → 국내 진공 작전 준비\n“정답 선택”보다 “근거 있는 선택”', 0.5, 3.75, 7.3, 0.9, { size: 14, color: C.accent5 });
s.addNotes('판단 기록지(학습자료 3)를 씁니다. 결과보다 판단의 근거를 칭찬합니다.');

s = content('광복군의 준비는 헛된 것이었을까?', 'F');
[['헛되었다', HEX.accent3], ['의미 있었다', HEX.accent4], ['모르겠다', HEX.accent2]].forEach(([l, col], i) => {
  const x = 0.5 + i * 3.1;
  card(s, x, 1.35, 2.8, 2.0);
  s.addShape(pres.shapes.OVAL, { x: x + 1.05, y: 1.55, w: 0.7, h: 0.7, fill: { color: col }, line: { color: col } });
  txt(s, l, x + 0.1, 2.4, 2.6, 0.6, { size: 20, bold: true, color: C.text2, align: 'center' });
});
card(s, 0.5, 3.6, 9, 1.25, { fill: C.background2 });
txt(s, '신호등 카드를 든 뒤, 근거가 된 사료 한 문장을 함께 말해 봅시다.\n“스스로 싸워 얻으려 한 광복”은 광복 이후에 어떤 의미가 있었을까?', 0.75, 3.7, 8.5, 1.05, { size: 16, color: C.text2, valign: 'middle' });
s.addNotes('책임 있는 의사결정(SEL). 광복 이후 국제 정세·분단과 잇되 학년 수준에 맞춥니다.');

s = content('우리 동네 이야기: 77년 만의 귀환', 'F');
card(s, 0.5, 1.35, 4.2, 3.5, { fill: C.text2 });
txt(s, '17위', 0.7, 1.55, 3.8, 1.2, { size: 60, bold: true, color: C.accent6 });
txt(s, '중국에서 숨진 광복군들은 우리 학교 근처 수유리 한국광복군 합동묘소에 함께 묻혀 있었습니다.', 0.7, 2.8, 3.8, 1.8, { size: 15, color: C.background1 });
card(s, 5.0, 1.35, 4.5, 1.6);
txt(s, '2022년 8월', 5.2, 1.45, 4.1, 0.5, { size: 20, bold: true, color: C.accent2 });
txt(s, '광복 77년 만에 국립대전현충원으로 이장', 5.2, 1.95, 4.1, 0.9, { size: 16, color: C.text2 });
card(s, 5.0, 3.25, 4.5, 1.6, { fill: C.background2 });
txt(s, '이분들의 광복은\n언제 온 걸까요?', 5.2, 3.35, 4.1, 1.4, { size: 22, bold: true, color: C.text2, valign: 'middle' });
s.addNotes('사료 퍼즐 정답 공개 → 이 이야기 → 광복군에게 한 줄 감사 메모(4차시 편지 재료로 봉투 보관). 다음 시간 예고: “AI에게 광복군에 대해 물었더니 이렇게 답했습니다. 믿어도 될까요?”');

// ===== 3차시 =====
sectionName = '3차시 · AI가 말하는 역사, 믿어도 될까?';
pres.addSection({ title: sectionName });
dark('3차시 · AI가 말하는 역사, 믿어도 될까?', 'Authenticate · 웹앱 「역사탐정 프로젝트」').addNotes('3차시 45분: 도입 5분, 검증 3단계 5분, 사건 파일 20분, 팩트카드 8분, 정리 7분.');

s = content('AI가 이렇게 말했습니다', 'A');
card(s, 0.5, 1.35, 9, 1.5, { fill: C.background2 });
txt(s, 'AI 답변', 0.75, 1.45, 2, 0.35, { size: 12, bold: true, color: C.accent5 });
txt(s, '“한국광복군은 미국과 함께 국내 진공 작전을 펼쳐 서울을 되찾았다.”', 0.75, 1.85, 8.5, 0.85, { size: 22, color: C.text2 });
txt(s, '지난 시간에 배운 것과 무엇이 다른가요? 이 문장이 퍼지면 무엇이 지워질까요?', 0.5, 3.05, 9, 0.5, { size: 16, color: C.text1 });
card(s, 0.5, 3.7, 9, 1.15, { fill: C.text2 });
txt(s, '잘못된 기억은 희생을 지운다. 정확히 기억하는 것이 보훈이다.', 0.75, 3.8, 8.5, 0.95, { size: 22, bold: true, color: C.background1, valign: 'middle' });
s.addNotes('기대 답: 작전은 실행되지 못했다. 광복군이 못다 이룬 꿈과 김구의 탄식이 지워진다.');

s = content('기억을 지키는 탐정의 검증 3단계', 'A');
steps(s, [['출처 확인', '누가, 언제 만든 정보인가?'], ['맥락화', '그 시대 상황에서 말이 되는가?'], ['교차검증', '신뢰할 만한 자료 2개 이상이 같은 말을 하는가?']], 1.35, { h: 2.15 });
txt(s, '검증 자료: 국사편찬위원회 한국사데이터베이스·우리역사넷 · 독립기념관 한국독립운동정보시스템 · 공훈전자사료관 · 국가법령정보센터', 0.5, 3.75, 7.3, 0.9, { size: 13, color: C.accent5 });
qr(s, 7.9, 3.55, '역사탐정 프로젝트');
s.addNotes('학생 개인 계정의 생성형 AI는 쓰지 않습니다. 교사가 미리 생성·검토한 사건 파일을 앱에서 제공합니다.');

s = content('사건 파일: 사실일까, 오류일까?', 'A');
const claims = [
  '임시정부는 1919년 4월 중국 베이징에서 수립되었다.',
  '임시헌장 제1조는 “대한민국은 입헌군주제로 함”이다.',
  '한국광복군은 1940년 9월 17일 충칭에서 창설되었다.',
  '광복군은 OSS와 국내 진공 작전을 실행해 서울을 되찾았다.',
  '현행 헌법 전문에는 임시정부의 법통 계승이 명시되어 있다.',
  '김구는 1945년 8월 15일 서울에서 광복 소식을 들었다.',
];
claims.forEach((c, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.5 + col * 4.6, y = 1.3 + row * 1.2;
  card(s, x, y, 4.4, 1.0);
  s.addShape(pres.shapes.OVAL, { x: x + 0.15, y: y + 0.25, w: 0.5, h: 0.5, fill: { color: C.text2 }, line: { color: C.text2 } });
  txt(s, String(i + 1), x + 0.15, y + 0.25, 0.5, 0.5, { size: 14, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0 });
  txt(s, c, x + 0.8, y + 0.08, 3.5, 0.84, { size: 14, color: C.text1, valign: 'middle' });
});
txt(s, '사실인 진술도 섞여 있습니다 · 사실 / 오류 / 판단 보류로 분류하고, 오류는 근거와 함께 바로잡기 (학습자료 4)', 0.5, 4.85, 9, 0.35, { size: 12, color: C.accent5 });
s.addNotes('정답(교사용): 1 오류-상하이 / 2 오류-민주공화제 / 3 사실 / 4 오류-일본 항복으로 실행되지 못함 / 5 사실 / 6 오류-시안. 사실 진술을 오류로 판정한 모둠에는 교차검증 단계를 다시 안내합니다.');

s = content('보훈 팩트카드 만들기 → 갤러리 워크', 'A');
card(s, 0.5, 1.35, 4.6, 3.5, { fill: C.background2 });
[['AI가 말했다', ''], ['바로잡은 사실', ''], ['검증 단계 체크', ''], ['근거 (APA 7판)', ''], ['기억해야 하는 이유', '']].forEach(([l], i) => {
  txt(s, l, 0.75, 1.5 + i * 0.62, 2.2, 0.4, { size: 14, bold: true, color: C.text2 });
  s.addShape(pres.shapes.LINE, { x: 2.9, y: 1.85 + i * 0.62, w: 2.0, h: 0, line: { color: C.accent5, width: 0.75 } });
});
steps2: {
  const items = [['카드 제작 8분', '모둠별 오류 1개 → 카드 1장'], ['패들렛 게시', 'QR로 ‘강북 보훈 기억 지도’에 연결'], ['검증 도장', '다른 모둠 카드의 근거를 다시 확인하고 👍 또는 ❓']];
  items.forEach(([h, b], i) => {
    const y = 1.35 + i * 1.2;
    card(s, 5.4, y, 4.1, 1.0);
    txt(s, h, 5.6, y + 0.08, 3.7, 0.4, { size: 16, bold: true, color: C.text2 });
    txt(s, b, 5.6, y + 0.48, 3.7, 0.45, { size: 14 });
  });
}
s.addNotes('❓ 표시를 받은 카드는 다음 시간 전까지 수정합니다(동료 평가). 성찰: “정확히 기억하는 것이 왜 보훈일까?” 한 문장.');

// ===== 4차시 =====
sectionName = '4차시 · 임시정부가 설계한 나라';
pres.addSection({ title: sectionName });
dark('4차시 · 임시정부가 설계한 나라', 'Connect · 웹앱 「임시정부 : 새로운 나라를 향해」').addNotes('4차시 45분: 도입 5분, 3D RPG 17분, 감사 편지 15분, 정리 8분.');

s = content('100년의 거울', 'C');
card(s, 0.5, 1.35, 4.35, 2.5, { fill: C.background2 });
txt(s, '1919 · 대한민국 임시헌장', 0.75, 1.5, 3.9, 0.4, { size: 14, bold: true, color: C.accent5 });
txt(s, '제1조\n대한민국은 민주공화제로 함', 0.75, 2.0, 3.9, 1.6, { size: 24, bold: true, color: C.text2 });
card(s, 5.15, 1.35, 4.35, 2.5, { fill: C.text2 });
txt(s, '1987 · 대한민국헌법', 5.4, 1.5, 3.9, 0.4, { size: 14, bold: true, color: C.accent6 });
txt(s, '제1조 ①\n대한민국은 민주공화국이다.', 5.4, 2.0, 3.9, 1.6, { size: 24, bold: true, color: C.background1 });
txt(s, '100년 넘게 이어진 이 문장을 지키기 위해, 누가 무엇을 했을까요?', 0.5, 4.1, 9, 0.6, { size: 18, color: C.text2, align: 'center' });
s.addNotes('2027년은 현행 헌법 40주년, 6·10 민주항쟁 40주년입니다. 1차시 헌법 전문 퀴즈와 연결합니다.');

s = content('기록관 미션: 새 나라의 제도를 찾아라', 'C');
steps(s, [['걷고 찾기', '1인칭 3D 공간에서 임시정부가 설계한 제도 찾기'], ['오늘과 짝짓기', '임시정부가 꿈꾼 제도 → 오늘 헌법·사회에서 찾은 모습, 3쌍 기록'], ['더 생각하기', '4·19와 6월 민주항쟁 때 시민들은 이 약속을 어떻게 지켰을까?']], 1.35, { h: 2.15 });
qr(s, 7.9, 3.55, '임시정부 : 새로운 나라를 향해');
txt(s, '학습자료 6 · 17분', 0.5, 3.75, 7.3, 0.5, { size: 14, color: C.accent5 });
s.addNotes('헌법 전문의 ‘4·19민주이념’으로 독립과 민주를 잇습니다. 실제 앱 공간·제도 항목명에 맞춰 안내합니다.');

s = content('기록관의 감사 편지: 3요소', 'C');
[['사실', '팩트카드로 확인한 그분의 활동'], ['감정', '감정 온도계와 2차시 감사 메모에서'], ['다짐', '오늘 내가 이어 갈 약속']].forEach(([h, b], i) => {
  const x = 0.5 + i * 3.1;
  card(s, x, 1.35, 2.8, 2.2);
  txt(s, String(i + 1), x + 0.2, 1.45, 0.6, 0.8, { size: 36, bold: true, color: C.accent2 });
  txt(s, h, x + 0.9, 1.6, 1.7, 0.6, { size: 22, bold: true, color: C.text2 });
  txt(s, b, x + 0.2, 2.35, 2.4, 1.0, { size: 14 });
});
card(s, 0.5, 3.8, 9, 1.05, { fill: C.background2 });
txt(s, '받는 분: 1~2차시에 만난 인물 · 수유동 묘역의 임시정부 요인(이시영 등) · 77년 만에 귀환한 수유리 광복군 17위', 0.75, 3.85, 8.5, 0.95, { size: 14, color: C.text2, valign: 'middle' });
s.addNotes('2차시 감사 메모 봉투를 돌려줍니다. 막연한 미사여구보다 사실에 근거한 감사를 강조합니다. 편지는 앱에서 인쇄하거나 PDF로 저장합니다.');

s = content('나의 보훈 약속', 'T');
[['기억 산책', '4·19민주묘지 → 북한산 역사 순례길'], ['편지 전달', '보훈청·광복회와 협의해 실제 전달'], ['체험부스', '1학년 대상 기록관 도슨트'], ['팩트카드+', '강북 보훈 기억 지도에 추가']].forEach(([h, b], i) => {
  const x = 0.5 + i * 2.325;
  card(s, x, 1.35, 2.025, 1.9);
  txt(s, h, x + 0.15, 1.5, 1.725, 0.5, { size: 18, bold: true, color: C.text2 });
  txt(s, b, x + 0.15, 2.05, 1.725, 1.1, { size: 13 });
});
card(s, 0.5, 3.5, 9, 1.35, { fill: C.text2 });
txt(s, '1차시 질문, 이제 답할 수 있나요?\n왜 오늘의 헌법은 임시정부를 ‘뿌리’라고 할까?', 0.75, 3.6, 8.5, 1.15, { size: 20, bold: true, color: C.background1, valign: 'middle' });
s.addNotes('학습자료 7(나의 보훈 약속)을 작성합니다. 실천 활동 후 사후 설문을 실시합니다.');

// ===== 마무리 =====
sectionName = '마무리';
pres.addSection({ title: sectionName });
dark('정확히 기억하는 것이 보훈이다', '기록관은 이제 여러분입니다.').addNotes('프로젝트 마무리. 사후 설문 안내.');

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('written', OUT);
})();
