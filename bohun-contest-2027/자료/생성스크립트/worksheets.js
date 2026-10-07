const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ShadingType, PageBreak, Header, Footer, PageNumber,
  VerticalAlign, LevelFormat,
} = require('docx');

const FONT = '맑은 고딕';
const NAVY = '1F3A5F';
const GOLD = 'B08D3C';
const LIGHT = 'EEF2F7';
const CREAM = 'FBF6EA';
const W = 9638; // A4 content width (DXA) with ~1.9cm margins

const t = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 21, bold: o.bold, color: o.color, italics: o.italics });
const p = (runs, o = {}) => new Paragraph({
  children: Array.isArray(runs) ? runs : [typeof runs === 'string' ? t(runs, o) : runs],
  alignment: o.align, spacing: { before: o.before ?? 60, after: o.after ?? 60, line: o.line },
  border: o.border, shading: o.shading,
});
const blank = (n = 1) => Array.from({ length: n }, () => p(''));
const pb = () => new Paragraph({ children: [new PageBreak()] });

const thin = { style: BorderStyle.SINGLE, size: 4, color: '8A9BB0' };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function cell(content, width, o = {}) {
  const kids = (Array.isArray(content) ? content : [content]).map(c =>
    typeof c === 'string' ? p(c, { size: o.size, bold: o.bold, color: o.color, align: o.align }) : c);
  return new TableCell({
    children: kids, width: { size: width, type: WidthType.DXA }, borders,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    verticalAlign: o.valign || VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    columnSpan: o.span,
  });
}
function table(widths, rows, o = {}) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({
      height: o.heights ? { value: o.heights[i] ?? o.heights[o.heights.length - 1], rule: 'atLeast' } : undefined,
      children: r.map((c, j) => {
        if (c && c.cell) return cell(c.cell, c.w ?? widths[j], c);
        const isHead = o.head && i === 0;
        return cell(c ?? '', widths[j], isHead ? { fill: NAVY, color: 'FFFFFF', bold: true, align: AlignmentType.CENTER } : {});
      }),
    })),
  });
}

function sheetTitle(no, title, sub) {
  return [
    p([t(no, { size: 18, bold: true, color: GOLD })], { after: 0 }),
    p([t(title, { size: 32, bold: true, color: NAVY })], { before: 0, after: 40 }),
    sub ? p([t(sub, { size: 19, color: '555555' })], { after: 120 }) : p(''),
    nameLine(),
  ];
}
function nameLine() {
  return table([W], [[{ cell: [p([t('기록관   (      )학년  (      )반  (      )번   이름 (                    )      모둠 (            )', { size: 20 })])], fill: LIGHT }]]);
}
const h = (text) => p([t(text, { size: 23, bold: true, color: NAVY })], { before: 200, after: 80, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 2 } } });
const note = (text) => p([t('※ ' + text, { size: 18, color: '666666' })]);

// ---------- pages ----------
const pages = [];

// Cover / 임명장
pages.push(
  ...blank(3),
  p([t('기억은 FACT로 지킨다', { size: 28, bold: true, color: GOLD })], { align: AlignmentType.CENTER }),
  p([t('기 록 관   임 명 장', { size: 56, bold: true, color: NAVY })], { align: AlignmentType.CENTER, before: 200, after: 300 }),
  table([W], [[{ cell: [
    p('', {}),
    p([t('(        )학년 (     )반  이름 :  ____________________', { size: 26 })], { align: AlignmentType.CENTER }),
    p('', {}),
    p([t('위 학생을 「임시정부·광복군 기록관」으로 임명합니다.', { size: 24 })], { align: AlignmentType.CENTER }),
    p([t('기록관은 앞으로 네 번의 수업 동안 아래 임무를 수행합니다.', { size: 22 })], { align: AlignmentType.CENTER }),
    p('', {}),
    p([t('F  Feel        ', { bold: true, color: NAVY, size: 22 }), t('임시정부와 광복군의 선택을 직접 체험한다', { size: 22 })], { align: AlignmentType.CENTER }),
    p([t('A  Authenticate', { bold: true, color: NAVY, size: 22 }), t('  AI가 말하는 역사를 사료로 검증한다', { size: 22 })], { align: AlignmentType.CENTER }),
    p([t('C  Connect     ', { bold: true, color: NAVY, size: 22 }), t('  임시정부의 약속을 오늘의 헌법과 잇는다', { size: 22 })], { align: AlignmentType.CENTER }),
    p([t('T  Take action ', { bold: true, color: NAVY, size: 22 }), t('  정확한 기억을 우리 동네와 학교에 전한다', { size: 22 })], { align: AlignmentType.CENTER }),
    p('', {}),
    p([t('“잘못된 기억은 희생을 지운다. 정확히 기억하는 것이 보훈이다.”', { size: 22, italics: true, color: GOLD })], { align: AlignmentType.CENTER }),
    p('', {}),
    p([t('2027년    월    일', { size: 22 })], { align: AlignmentType.CENTER }),
    p([t('서울번동중학교 역사과', { size: 24, bold: true })], { align: AlignmentType.CENTER }),
    p('', {}),
  ], fill: CREAM }]]),
  ...blank(1),
  table([W / 2, W / 2], [[
    { cell: [p([t('웹앱 QR 자리', { color: '999999' })], { align: AlignmentType.CENTER })] },
    { cell: [p([t('패들렛 기록 보관함 QR 자리', { color: '999999' })], { align: AlignmentType.CENTER })] },
  ]], { heights: [1600] }),
  pb(),
);

// 학습자료 1
pages.push(
  ...sheetTitle('학습자료 1 · 1차시 · Feel', '임정 활동 기록 카드', '웹앱 「임시정부 : 광복을 위한 꿈」을 플레이하며 임시정부의 활동 3가지를 기록하세요.'),
  h('① 내가 기록한 임시정부의 활동'),
  table([1800, 1300, 3000, 3538], [
    ['활동', '시기', '근거가 된 사료(앱 속 사료 카드)', '오늘의 대한민국과 이어지는 점'],
    ['1.', '', '', ''], ['2.', '', '', ''], ['3.', '', '', ''],
  ], { head: true, heights: [400, 1300] }),
  h('② 감정 온도계'),
  p('가장 마음이 움직인 장면: ______________________________________________'),
  table(Array(10).fill(W / 10), [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ cell: [p([t(String(n), { bold: true, color: NAVY })], { align: AlignmentType.CENTER })] }))], { heights: [500] }),
  note('마음이 움직인 정도에 ○ 하세요. 정답은 없습니다.'),
  p('그 이유: ________________________________________________________________'),
  p('_______________________________________________________________________'),
  h('③ 출구 카드'),
  p([t('임시정부가 27년 동안 버틸 수 있었던 힘은 무엇이었을까?', { bold: true })]),
  table([W], [['']], { heights: [1100] }),
  pb(),
);

// 학습자료 2+3
pages.push(
  ...sheetTitle('학습자료 2·3 · 2차시 · Feel', '아직 오지 않은 광복 — 판단 기록지', '웹앱 「아직 오지 않은 광복」에서 광복군이 되어 사료를 읽고 선택하세요.'),
  h('사료 퍼즐 — 김구, 『백범일지』'),
  table([W], [[{ cell: [
    p([t('“아! 왜적이 항복! 이것은 내게 기쁜 소식이라기보다는 (                                        ).', { size: 22 })]),
    p([t(' 천신만고로 수년간 애를 써서 참전할 준비를 한 것도 다 허사다.”', { size: 22 })]),
  ], fill: CREAM }]]),
  p('예상: 김구가 기뻐하지 않은 이유는 ______________________________________ 때문일 것이다.'),
  h('모둠 역할'),
  table([W / 3, W / 3, W / 3], [['사료 리더', '판단자', '기록자'], ['', '', '']], { head: true, heights: [400, 500] }),
  h('판단 기록'),
  table([900, 2000, 3000, 1869, 1869], [
    ['장면', '우리의 선택', '근거가 된 사료(한 문장 인용)', '예상한 결과', '실제 결과'],
    ['1', '', '', '', ''], ['2', '', '', '', ''], ['3', '', '', '', ''],
  ], { head: true, heights: [400, 1000] }),
  h('토의 — 광복군의 준비는 헛된 것이었을까?'),
  p('우리 모둠의 신호등:  🔴 헛되었다    🟢 의미 있었다    🟡 모르겠다'),
  p('근거: ___________________________________________________________________'),
  p('_______________________________________________________________________'),
  h('광복군에게 보내는 한 줄 감사 메모 (4차시 편지 재료)'),
  table([W], [['']], { heights: [800] }),
  pb(),
);

// 학습자료 4 사건 파일 (학생용)
const claims = [
  '대한민국 임시정부는 1919년 4월 중국 베이징에서 수립되었다.',
  '대한민국 임시헌장 제1조는 “대한민국은 입헌군주제로 함”이다.',
  '한국광복군은 1940년 9월 17일 충칭에서 창설되었다.',
  '광복군은 미국 OSS와 함께 국내 진공 작전을 실행해 서울을 되찾았다.',
  '현행 헌법 전문에는 대한민국임시정부의 법통 계승이 명시되어 있다.',
  '김구는 1945년 8월 15일 서울에서 광복 소식을 들었다.',
];
pages.push(
  ...sheetTitle('학습자료 4 · 3차시 · Authenticate', '사건 파일 — “AI가 말한 임시정부·광복군”', '웹앱 「역사탐정 프로젝트」의 검증 3단계로 AI의 말을 수사하세요. 사실인 진술도 섞여 있습니다!'),
  table([W / 3, W / 3, W / 3], [
    ['① 출처 확인', '② 맥락화', '③ 교차검증'],
    ['누가, 언제 만든 정보인가?', '그 시대 상황에서 말이 되는가?', '신뢰할 만한 자료 2개 이상이 같은 말을 하는가?'],
  ], { head: true }),
  ...blank(1),
  table([500, 3700, 1300, 4138], [
    ['#', 'AI의 진술', '판정', '바로잡은 사실 / 근거 자료'],
    ...claims.map((c, i) => [String(i + 1), c, '사실 / 오류 / 보류', '']),
  ], { head: true, heights: [400, 950] }),
  note('검증 자료: 국사편찬위원회 한국사데이터베이스·우리역사넷, 독립기념관 한국독립운동정보시스템, 국가보훈부 공훈전자사료관, 국가법령정보센터'),
  pb(),
);

// 학습자료 5 팩트카드 x2
const factCard = () => table([W], [[{ cell: [
  p([t('보훈 팩트카드  No. (      )', { bold: true, size: 24, color: NAVY })]),
  p([t('🤖 AI가 말했다: ', { bold: true })]), p('______________________________________________________________________'), p('______________________________________________________________________'),
  p([t('✅ 바로잡은 사실: ', { bold: true })]), p('______________________________________________________________________'), p('______________________________________________________________________'),
  p([t('🔎 검증 단계:  ', { bold: true }), t('□ 출처 확인   □ 맥락화   □ 교차검증')]),
  p([t('📚 근거 (APA 7판): ', { bold: true })]), p('______________________________________________________________________'), p('______________________________________________________________________'),
  p([t('   예) 국사편찬위원회. (연도). 자료명. 사이트명. URL', { size: 17, color: '777777' })]),
  p([t('💬 이 사실을 기억해야 하는 이유: ', { bold: true })]), p('______________________________________________________________________'), p('______________________________________________________________________'),
  p([t('제작: (          )모둠            [QR → 강북 보훈 기억 지도]', { size: 19, color: '555555' })]),
], fill: CREAM }]]);
pages.push(
  ...sheetTitle('학습자료 5 · 3차시 · Authenticate', '보훈 팩트카드', '사건 파일에서 오류 1개를 골라 바로잡고, 출처를 밝혀 카드로 만드세요.'),
  ...blank(1), factCard(), ...blank(1), factCard(),
  pb(),
);

// 학습자료 6
pages.push(
  ...sheetTitle('학습자료 6 · 4차시 · Connect', '100년의 거울 — 임시헌장과 오늘의 헌법', '웹앱 「임시정부 : 새로운 나라를 향해」에서 찾은 제도를 오늘의 헌법·사회와 비교하세요.'),
  table([1900, 2600, 2600, 2538], [
    ['구분', '대한민국 임시헌장 (1919)', '대한민국헌법 (1987)', '이어진 점 / 달라진 점'],
    ['국가 형태', '제1조 “대한민국은 민주공화제로 함”', '제1조 ① “대한민국은 민주공화국이다.”', ''],
    ['평등', '제3조 남녀·귀천·빈부의 계급 없이 일체 평등', '제11조 평등권', ''],
    ['앱에서 찾은 제도 ①', '', '', ''],
    ['앱에서 찾은 제도 ②', '', '', ''],
    ['앱에서 찾은 제도 ③', '', '', ''],
  ], { head: true, heights: [400, 900] }),
  h('헌법 전문이 계승한다고 밝힌 두 가지'),
  p('“…3·1운동으로 건립된 ( ____________________ )의 법통과 불의에 항거한 ( ________ ) 민주이념을 계승하고…”'),
  h('기록관의 감사 편지 — 3요소 설계'),
  table([2000, 7638], [
    ['받는 분', ''],
    ['① 사실', '(팩트카드로 확인한 그분의 활동)'],
    ['② 감정', '(감정 온도계·감사 메모에서 가져오기)'],
    ['③ 다짐', '(오늘 내가 이어 갈 약속)'],
  ], { heights: [500, 900] }),
  note('편지 본문은 웹앱의 편지 기능에 작성하고, 인쇄하거나 PDF로 저장해 실천 활동에서 전달합니다.'),
  pb(),
);

// 학습자료 7
pages.push(
  ...sheetTitle('학습자료 7 · 4차시 · Take action', '나의 보훈 약속', '네 번의 수업을 마친 기록관으로서 실천을 계획하세요.'),
  h('① 내가 선택한 실천 (하나 이상)'),
  p('□ 수유동 ‘기억 산책’       □ 감사 편지 전달       □ 1학년 대상 체험부스 도슨트       □ 팩트카드 추가 제작'),
  h('② 실천 계획'),
  table([2000, 7638], [['언제', ''], ['누구와', ''], ['어떻게', ''], ['준비물', '']], { heights: [700] }),
  h('③ 이 실천이 ‘정확한 기억’을 지키는 방법인 이유'),
  table([W], [['']], { heights: [1200] }),
  h('④ 1차시 질문에 대한 나의 답'),
  p([t('“100년도 더 전에 나라 밖에서 세운 정부를, 왜 오늘의 헌법은 ‘뿌리’라고 할까?”', { bold: true })]),
  table([W], [['']], { heights: [1200] }),
  h('⑤ 실천 후 소감 (실천 활동 뒤 작성)'),
  table([W], [['']], { heights: [1200] }),
  pb(),
);

// 설문지
const items = [
  '나는 대한민국 임시정부가 오늘의 대한민국과 어떻게 이어지는지 설명할 수 있다.',
  '나는 독립운동가와 광복군의 희생이 내 삶과 관련 있다고 느낀다.',
  '나는 우리 동네에 있는 보훈 관련 장소를 알고 있다.',
  '나는 독립유공자와 그 가족에게 감사를 표현할 방법을 알고 있다.',
  '나는 보훈과 관련된 활동에 참여할 의향이 있다.',
  '나는 AI나 인터넷에서 얻은 역사 정보를 그대로 믿지 않고 확인한다.',
  '나는 역사 정보의 출처를 찾고 표기할 수 있다.',
  '부정확한 역사 정보를 바로잡는 것도 보훈의 한 방법이라고 생각한다.',
];
pages.push(
  ...sheetTitle('설문지 · 사전 / 사후 (같은 문항)', '보훈 의식·정보 검증 태도 설문', '□ 사전 (프로젝트 시작 전)    □ 사후 (프로젝트 마친 뒤)'),
  note('성적과 관계없습니다. 솔직하게 답해 주세요. 결과는 수업 개선에만 쓰입니다. 구글 설문으로 실시할 때도 같은 문항을 씁니다.'),
  table([500, 5638, 700, 700, 700, 700, 700], [
    ['#', '문항', '전혀 아니다 1', '2', '3', '4', '매우 그렇다 5'],
    ...items.map((q, i) => [String(i + 1), q, '', '', '', '', '']),
  ], { head: true, heights: [500, 650] }),
  h('서술형'),
  p('9. ‘보훈’ 하면 떠오르는 단어 3개를 쓰세요.  ① ________  ② ________  ③ ________'),
  p('10. (사후만) 이 프로젝트 전과 후, 나의 생각은 어떻게 달라졌나요?'),
  table([W], [['']], { heights: [1300] }),
  pb(),
);

// 교사용 정답
const answers = [
  ['1', '오류', '상하이에서 수립.', '우리역사넷, 한국독립운동정보시스템'],
  ['2', '오류', '“대한민국은 민주공화제로 함”.', '국사편찬위원회 한국사데이터베이스'],
  ['3', '사실', '—', '공훈전자사료관, 한국독립운동정보시스템'],
  ['4', '오류', 'OSS 합작 훈련 뒤 국내 투입을 준비했으나 일본 항복으로 작전은 실행되지 못함.', '우리역사넷, 『백범일지』'],
  ['5', '사실', '—', '국가법령정보센터 대한민국헌법 전문'],
  ['6', '오류', '광복군 특수훈련을 점검하러 간 중국 시안(西安)에서 소식을 들음.', '『백범일지』, 우리역사넷 「8·15 광복에 대한 김구의 입장」'],
];
pages.push(
  p([t('교사용 · 학생 배부 금지', { size: 18, bold: true, color: 'B03030' })]),
  p([t('정답 및 지도 메모', { size: 32, bold: true, color: NAVY })]),
  h('사건 파일 정답 (학습자료 4)'),
  table([500, 900, 4738, 3500], [['#', '판정', '바로잡은 사실', '검증 자료'], ...answers], { head: true }),
  h('사료 퍼즐 정답 (학습자료 2)'),
  p('“하늘이 무너지는 듯한 일이었다” — 광복군의 국내 진공 작전을 눈앞에 두고 일본이 항복해, 우리 힘으로 광복을 이루지 못한 데 대한 탄식'),
  h('헌법 전문 빈칸 (학습자료 6)'),
  p('대한민국임시정부 / 4·19'),
  h('2차시 마무리 이야기'),
  p('수유리 한국광복군 합동묘소에 함께 묻혀 있던 광복군 17위는 광복 77년 만인 2022년 8월 국립대전현충원으로 이장되었다.'),
  h('지도 메모'),
  p('· 사건 파일의 AI 진술은 교사가 미리 생성·검토한 것을 앱에 넣어 제공한다(학생 개인 계정의 생성형 AI 미사용).'),
  p('· “정답 선택”보다 “근거 있는 선택”을 칭찬한다. 사실 진술(3·5번)을 오류로 판정한 모둠에는 교차검증 단계를 다시 안내한다.'),
  p('· 웹앱 장면명·미션명은 실제 앱 화면에 맞게 학습지를 수정한다.'),
);

const doc = new Document({
  creator: '서울번동중학교 김동은',
  title: '기억은 FACT로 지킨다 - 학습지 묶음',
  styles: { default: { document: { run: { font: FONT, size: 21 } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1134, right: 1134 } } },
    headers: { default: new Header({ children: [p([t('기억은 FACT로 지킨다 : 임시정부·광복군 기록관 프로젝트', { size: 16, color: '888888' })], { align: AlignmentType.RIGHT })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '888888' })] })] }) },
    children: pages,
  }],
});

Packer.toBuffer(doc).then(b => { fs.writeFileSync(process.argv[2], b); console.log('written', process.argv[2]); });
