// 브라우저 테스트. ① 서버 없이 쓰는 학습지 ② 수업방(진행자 1명 + 연수생 3명)을 실제 브라우저로 눌러 봅니다.
// ②는 Firebase 에뮬레이터가 켜져 있어야 합니다(npm test가 켜 줍니다). 화면 사진은 tests/shots-out/에 남깁니다.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = fileURLToPath(new URL('./shots-out/', import.meta.url));
await mkdir(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try { const body = await readFile(join(ROOT, path || 'index.html')); res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(5055);
const BASE = 'http://localhost:5055/';
const LIVE = !!process.env.FIRESTORE_EMULATOR_HOST || process.argv.includes('--live');

let pass = 0, fail = 0;
const errors = [];
async function t(name, fn) {
  try { await fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n    ', String(e.message).split('\n')[0]); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || '조건이 맞지 않아요'); }
const browser = await chromium.launch();
async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, ...opts });
  await ctx.addInitScript(() => { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${p.url()} ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_NAME|net::|Failed to load resource/.test(m.text())) errors.push(`${p.url()} ${m.text()}`); });
  return p;
}
const dot = (p, id) => p.evaluate(id => { const i = [...document.querySelectorAll('.step[data-step]')].findIndex(s => s.dataset.step === id); document.querySelector(`[data-dot="${i}"]`).click(); }, id);
const until = (p, fn, arg, timeout = 15000) => p.waitForFunction(fn, arg, { timeout, polling: 200 });

// ── ① 서버 없이 쓰는 학습지 ─────────────────────────────────────────────
console.log('학습지(이 기기 모드)');
{
  const p = await page();
  await p.goto(BASE + 'index.html');
  await t('첫 화면이 1쪽이고 수업방 메뉴는 숨어 있어요', async () => {
    ok((await p.textContent('#stepTitle')).startsWith('1쪽'));
    ok(await p.isHidden('#roomBtn'), '수업방 메뉴가 보여요');
  });
  await t('화면 글에 줄표(—)가 없어요', async () => {
    const txt = await p.evaluate(() => document.body.innerText + [...document.querySelectorAll('[placeholder],[data-title],[title],[aria-label]')].map(e => e.getAttribute('placeholder') || e.dataset.title || e.title || e.getAttribute('aria-label')).join(' '));
    ok(!txt.includes('—'), '줄표가 남아 있어요');
  });
  await t('고르기와 쓰기가 저장되고 복사돼요', async () => {
    await p.click('[data-pick="n0"] button:has-text("1–2번")');
    await p.fill('#f-pain', '오류 고치기가 어려워요');
    await p.click('[data-copy="n0,pain,c1"]');
    const c = await p.evaluate(() => window.__copied);
    ok(c.includes('1–2번') && c.includes('오류 고치기가 어려워요'), c);
  });
  await t('2쪽 썸네일 16장이 모두 떠요', async () => {
    await dot(p, 'archive');
    await until(p, () => [...document.querySelectorAll('.arch img')].filter(i => i.naturalWidth > 0).length === 16);
  });
  await t('3쪽 체험 카드 3개와 썸네일', async () => {
    await dot(p, 'play');
    ok(await p.locator('.play').count() === 3);
    await until(p, () => [...document.querySelectorAll('.play img')].every(i => i.naturalWidth > 0));
  });
  await t('6쪽 프롬프트가 고른 대로 바뀌어요', async () => {
    await dot(p, 'make');
    await p.fill('#f-p1', '임진왜란');
    await p.selectOption('#pkKind', 'slides');
    await p.click('[data-pkm="parts"][data-opt="지도"]');
    await p.click('[data-pl="adv"]');
    await p.selectOption('#s-ps', '직접 쓰기'); await p.fill('#o-ps', '청자 빛 고려 분위기');
    const pr = await p.inputValue('#f-p9');
    ok(pr.includes('임진왜란') && pr.includes('9. 지도:') && pr.includes('Firebase') && pr.includes('청자 빛 고려 분위기'), pr.slice(0, 200));
    ok(!pr.includes('—'), '프롬프트에 줄표가 있어요');
    await p.click('#copyPrompt');
    ok((await p.evaluate(() => window.__copied)) === pr);
  });
  await t('모든 웹앱 종류가 기초·심화 모두 프롬프트를 만들어요', async () => {
    const bad = await p.evaluate(() => {
      const out = [];
      for (const k of window.PromptKit.KINDS) for (const lv of ['basic', 'adv']) {
        const v = { topic: '병자호란', grade: '중학교 2학년', mins: '15분', style: '시대 분위기에 맞게', question: '', extra: '' };
        (k.x || []).forEach(([id, , opts, def]) => { v[id] = opts ? def : ''; });   // 화면에서처럼 기본값을 채워요
        const s = window.PromptKit.build(k, v, lv);
        if (!s.includes('병자호란') || /undefined|NaN|—/.test(s)) out.push(k.id + lv);
      }
      return out;
    });
    ok(!bad.length, bad.join(','));
  });
  await t('7쪽 배포: 탭을 바꾸고 단계를 체크하고 명령어를 복사해요', async () => {
    await dot(p, 'deploy');
    ok(await p.isVisible('#panel-netlify') && await p.isHidden('#panel-firebase'));
    await p.click('[data-dtab="firebase"]');
    ok(await p.isHidden('#panel-netlify') && await p.isVisible('#panel-firebase'));
    await p.click('label:has(#f1)'); await p.click('label:has(#f3)');
    ok((await p.textContent('#panel-firebase [data-dstate]')).includes('9단계 중 2단계'));
    await p.click('#panel-firebase .cmd [data-cmd] >> nth=0');
    ok((await p.evaluate(() => window.__copied)) === 'npm install -g firebase-tools');
  });
  await t('8–9쪽: 작품을 올리고 좋아요·고치기·지우기', async () => {
    await dot(p, 'work');
    await p.fill('#f-wname', '임진왜란 방탈출'); await p.fill('#f-wurl', 'https://example.netlify.app');
    await p.click('#workSend');
    await dot(p, 'gallery');
    ok(await p.locator('.work').count() === 1);
    await p.click('.work [data-like]'); ok((await p.textContent('.work [data-like]')).includes('1'));
    await p.click('.work [data-del]'); await p.click('.work [data-del]');
    ok(await p.locator('.work').count() === 0);
  });
  await t('10쪽 퀴즈: 쉬운 6문제를 다 맞히면 6 / 6', async () => {
    await dot(p, 'quiz');
    const answers = await p.evaluate(() => [...document.querySelectorAll('.qcard')].length);
    ok(answers === 6);
    for (const [q, a] of [[0, 1], [1, 0], [2, 2], [3, 3], [4, 0], [5, 1]]) await p.click(`[data-q="${q}"] [data-a="${a}"]`);
    ok((await p.textContent('#scoreNum')) === '6 / 6');
  });
  await t('11쪽 별점과 설문 복사', async () => {
    await dot(p, 'survey');
    await p.click('[data-star="4"]'); await p.fill('#f-s2', '바로 써먹을 수 있었어요');
    await p.click('[data-copy="star,s2,s3"]');
    ok((await p.evaluate(() => window.__copied)).includes('★★★★'));
  });
  await t('새로고침해도 답과 쪽이 남아요', async () => {
    await p.reload();
    ok((await p.textContent('#stepTitle')).startsWith('11쪽'));
    ok((await p.inputValue('#f-pain')) === '오류 고치기가 어려워요');
  });
  await t('타이머, 전체 보기, QR', async () => {
    await p.click('#moreBtn'); await p.click('[data-timer="180"]');
    await p.waitForTimeout(1100); ok(/^0[23]:\d\d$/.test(await p.textContent('#timer')));
    await p.click('#timer'); ok(await p.isHidden('#timer'));
    await p.click('#moreBtn'); await p.click('#qrBtn');
    await until(p, () => !!document.querySelector('#qrHost canvas, #qrHost img'));
    await p.click('#qrBox [data-close]');
    await p.click('#moreBtn'); await p.click('#allBtn'); ok(await p.isHidden('#stepbar'));
    await p.click('#moreBtn'); await p.click('#allBtn'); ok(await p.isVisible('#stepbar'));
  });
  await t('휴대전화 폭에서 가로로 넘치지 않아요', async () => {
    for (const id of ['c1', 'archive', 'play', 'make', 'deploy', 'work', 'gallery', 'quiz', 'survey']) {
      await dot(p, id);
      const w = await p.evaluate(() => document.documentElement.scrollWidth);
      ok(w <= 390, `${id}: ${w}px`);
    }
  });
  await t('이 기기 답 지우기', async () => {
    await p.click('#moreBtn'); await p.click('#clearBtn'); await p.click('#clearYes');
    ok((await p.inputValue('#f-pain')) === '' && (await p.textContent('#stepTitle')).startsWith('1쪽'));
  });
  await p.screenshot({ path: OUT + 'local-1.png' });
  await p.context().close();
}

// ── ② 수업방: 진행자 1명 + 연수생 3명 ──────────────────────────────────
if (LIVE) {
  console.log('\n수업방(Firebase 에뮬레이터)');
  const admin = await page({ viewport: { width: 1280, height: 900 } });
  const amy = await page(), ben = await page(), cara = await page();
  let code = '';
  const row = name => admin.locator('#peopleRows tr', { hasText: name });
  const person = (name) => admin.evaluate(n => (window.WSAdmin.people.find(p => p.name === n) || null), name);

  await t('진행자: 로그인하기 전에는 대시보드가 안 보여요', async () => {
    await admin.goto(BASE + 'admin.html?emu');
    await admin.waitForSelector('#signIn:not([hidden])');
    ok(await admin.isHidden('#dash'));
  });
  await t('진행자: 로그인하고 수업방을 만들어요', async () => {
    await admin.click('#emuIn');
    await admin.waitForSelector('#roomsPanel:not([hidden])');
    await admin.fill('#newTitle', '10월 18일 역사연구팀 연수');
    await admin.click('#newBtn');
    await admin.waitForSelector('#dash:not([hidden])');
    await until(admin, () => /^\d{4}$/.test(document.querySelector('#code').textContent) && document.querySelector('#code').textContent !== '0000');
    code = await admin.textContent('#code');
    ok((await admin.textContent('#joinUrl')).includes(`room=${code}`));
    await until(admin, () => !!document.querySelector('#qr canvas, #qr img'));
  });
  await t('연수생: QR 주소로 열면 이름을 묻고 들어와요', async () => {
    await amy.goto(BASE + `index.html?room=${code}&emu`);
    await amy.waitForSelector('#roomBox[open]');
    ok((await amy.inputValue('#roomCode')) === code);
    await amy.fill('#roomName', '김민지');
    await amy.click('#roomGo');
    await amy.waitForSelector('#roomChip:not([hidden])');
    ok((await amy.textContent('#roomChip')).includes('김민지'));
  });
  await t('진행자 화면에 바로 나타나요', async () => { await row('김민지').waitFor({ timeout: 10000 }); });
  await t('잘못된 번호는 알려 줘요', async () => {
    await cara.goto(BASE + 'index.html?emu');
    await cara.click('#moreBtn'); await cara.click('#roomBtn');
    await cara.fill('#roomCode', code === '1111' ? '2222' : '1111'); await cara.fill('#roomName', '최다은');
    await cara.click('#roomGo');
    await until(cara, () => document.querySelector('#roomState').textContent.includes('없어요'));
  });
  await t('연수생의 답과 쪽이 진행자에게 실시간으로 가요', async () => {
    await amy.click('[data-pick="n0"] button:has-text("3–5번")');
    await amy.fill('#f-c1', '독립운동 방탈출');
    await dot(amy, 'c2');
    await until(admin, () => { const p = window.WSAdmin.people.find(x => x.name === '김민지'); return p && p.stepId === 'c2' && p.answers && p.answers.c1 === '독립운동 방탈출' && p.answers.n0 === '3–5번'; });
    ok((await row('김민지').textContent()).includes('4쪽'));
  });
  await t('진행자: 답 모아 보기에서 고르기 문항은 막대로, 글은 카드로', async () => {
    await admin.click('[data-tab="answers"]');
    await admin.selectOption('#qSel', 'n0');
    ok((await admin.textContent('#answerView')).includes('3–5번'));
    await admin.selectOption('#qSel', 'c1');
    ok((await admin.textContent('#answerView')).includes('독립운동 방탈출'));
    await admin.click('[data-tab="people"]');
  });
  await t('두 번째 연수생도 들어와요', async () => {
    await ben.goto(BASE + `index.html?room=${code}&emu`);
    await ben.fill('#roomName', '이준호'); await ben.click('#roomGo');
    await ben.waitForSelector('#roomChip:not([hidden])');
    await row('이준호').waitFor({ timeout: 10000 });
  });
  await t('진행자가 쪽을 열면 쓰지 않던 사람은 바로 넘어가요', async () => {
    await admin.selectOption('#stepSel', 'make'); await admin.click('#stepGo');
    await until(ben, () => document.querySelector('#stepTitle').textContent.startsWith('6쪽'));
  });
  await t('글을 쓰던 사람은 단추로 알려 주고, 누르면 넘어가요', async () => {
    await until(amy, () => !document.querySelector('#stepFollow').hidden);
    ok((await amy.textContent('#stepTitle')).startsWith('4쪽'), '쓰던 사람이 끌려갔어요');
    await amy.click('#stepFollow');
    ok((await amy.textContent('#stepTitle')).startsWith('6쪽'));
  });
  await t('진행자 타이머가 연수생 화면에 떠요', async () => {
    await admin.click('[data-t="180"]');
    await until(amy, () => !document.querySelector('#timer').hidden && /^0[23]:\d\d$/.test(document.querySelector('#timer').textContent));
    await until(ben, () => !document.querySelector('#timer').hidden);
    await admin.click('[data-t="0"]');
    await until(amy, () => document.querySelector('#timer').hidden);
  });
  await t('작품을 올리면 다른 연수생 갤러리에 나타나요', async () => {
    await dot(amy, 'work');
    ok((await amy.inputValue('#f-wmaker')) === '김민지', '만든 사람이 이름으로 채워지지 않았어요');
    await amy.fill('#f-wname', '독립운동 방탈출'); await amy.fill('#f-wurl', 'https://indep-escape.web.app');
    await amy.click('#workSend');
    await until(amy, () => document.querySelector('#workState').textContent.includes('올렸어요'));
    await dot(ben, 'gallery');
    await until(ben, () => document.querySelectorAll('#gallery .work').length === 1);
    ok(await ben.locator('#gallery .work [data-edit]').count() === 0, '남의 작품에 고치기 단추가 있어요');
  });
  await t('좋아요가 모두에게 함께 세어져요', async () => {
    await ben.click('#gallery .work [data-like]');
    await dot(amy, 'gallery');
    await until(amy, () => document.querySelector('#gallery .work [data-like]').textContent.includes('1'));
    ok(await amy.locator('#gallery .work [data-edit]').count() === 1, '내 작품에 고치기 단추가 없어요');
    await admin.click('[data-tab="works"]');
    await until(admin, () => document.querySelector('#worksView').textContent.includes('♥ 1'));
    await admin.click('[data-tab="people"]');
    await until(admin, () => (window.WSAdmin.people.find(x => x.name === '김민지') || {}).work);
  });
  await t('퀴즈 점수와 배포 단계가 진행표에 보여요', async () => {
    await dot(amy, 'quiz');
    await amy.click('[data-q="0"] [data-a="1"]'); await amy.click('[data-q="1"] [data-a="2"]');
    await dot(amy, 'deploy'); await amy.click('label:has(#d1)'); await amy.click('label:has(#d2)');
    await until(admin, () => { const p = window.WSAdmin.people.find(x => x.name === '김민지'); return p && p.quiz && p.quiz.done === 2 && p.quiz.right === 1 && p.deploy.netlify.done === 2; });
    const r = await row('김민지').textContent();
    ok(r.includes('1/6') && r.includes('Netlify 2/6'), r);
  });
  await t('설문은 이름 없이 진행자에게 모여요', async () => {
    await dot(ben, 'survey');
    await ben.click('[data-star="4"]'); await ben.fill('#f-s2', '실습이 많아서 좋았어요');
    await admin.click('[data-tab="survey"]');
    await until(admin, () => document.querySelector('#surveyView').textContent.includes('실습이 많아서 좋았어요'));
    ok(!(await admin.textContent('#surveyView')).includes('이준호'), '설문에 이름이 보여요');
    await until(admin, () => document.querySelector('#tiles').textContent.includes('4.0'));
    await admin.click('[data-tab="people"]');
  });
  await t('진행자: 사람을 누르면 답이 모두 보여요', async () => {
    await row('김민지').click();
    await admin.waitForSelector('#personBox[open]');
    const txt = await admin.textContent('#pBody');
    ok(txt.includes('독립운동 방탈출') && txt.includes('3–5번'), txt.slice(0, 120));
    await admin.click('#personBox [data-close]');
  });
  await t('진행자: 진행표를 스프레드시트용으로 복사해요', async () => {
    await admin.click('#copyTable');
    const c = await admin.evaluate(() => window.__copied);
    ok(c.split('\n').length === 3 && c.includes('김민지\t'), c);
  });
  await admin.screenshot({ path: OUT + 'admin.png', fullPage: true });
  await amy.screenshot({ path: OUT + 'participant.png' });
  await t('새로고침해도 수업방에 그대로 있어요', async () => {
    await amy.reload();
    await amy.waitForSelector('#roomChip:not([hidden])');
    await until(amy, () => document.querySelectorAll('#gallery .work').length === 1);
  });
  await t('새로고침 뒤에도 진행표에 내 작품이 남아요', async () => {
    await until(admin, () => {
      const work = window.WSAdmin.people.find(x => x.name === '김민지')?.work;
      return work?.name === '독립운동 방탈출' && work?.url === 'https://indep-escape.web.app/';
    });
  });
  await t('연수생은 진행자 화면에 못 들어가요', async () => {
    await cara.goto(BASE + 'admin.html?emu');
    await cara.waitForSelector('#signIn:not([hidden])');
    ok(await cara.isHidden('#dash'));
  });
  await t('진행자가 들어오기를 막으면 새 사람은 못 들어와요', async () => {
    await admin.click('#toggleOpen');
    await admin.waitForSelector('#closedTag:not([hidden])');
    await cara.goto(BASE + `index.html?room=${code}&emu`);
    await cara.fill('#roomName', '최다은'); await cara.click('#roomGo');
    await until(cara, () => document.querySelector('#roomState').textContent.includes('닫혔어요'));
  });
  await t('진행자: 참가자를 지워요', async () => {
    await row('이준호').click(); await admin.click('#pDelete'); await admin.click('#pDelete');
    await until(admin, () => !window.WSAdmin.people.some(x => x.name === '이준호'));
  });
  await t('연수생: 수업방에서 나가면 이 기기 모드로 돌아와요', async () => {
    await amy.click('#roomChip'); await amy.click('#roomLeave');
    ok(await amy.isHidden('#roomChip'));
    ok((await amy.textContent('#workHint')).includes('이 기기에만'));
  });
  await t('진행자 화면도 가로로 넘치지 않아요(휴대전화)', async () => {
    await admin.setViewportSize({ width: 390, height: 900 });
    const w = await admin.evaluate(() => document.documentElement.scrollWidth);
    ok(w <= 390, `${w}px`);
    await admin.screenshot({ path: OUT + 'admin-phone.png', fullPage: true });
  });
} else {
  console.log('\n(수업방 테스트는 Firebase 에뮬레이터가 켜져 있을 때만 돌아요. npm test로 실행하세요.)');
}

await t('페이지 오류가 없어요', async () => ok(!errors.length, errors.join(' | ')));
await browser.close(); server.close();
console.log(`\n브라우저 테스트: ${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
