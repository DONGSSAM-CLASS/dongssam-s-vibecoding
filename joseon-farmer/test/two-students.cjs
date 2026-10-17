// 점검: 교사 화면 1개 + 학생 화면 2개를 동시에 열어 실시간으로 모이는지 확인
// 실행: (joseon-farmer 폴더에서) npx firebase-tools emulators:start --project demo-joseon
//       다른 창에서 node test/two-students.cjs   (playwright 필요: npm i playwright)
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.env.BASE || 'http://localhost:5000';
const SHOTS = process.env.SHOTS || '';

(async () => {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const errors = [];
  const watch = (page, who) => {
    page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${who}: ${m.text()}`); });
  };
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

  const tctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const teacher = await tctx.newPage(); watch(teacher, 'teacher');
  await teacher.goto(`${BASE}/teacher.html`);
  await teacher.click('#newRoom');
  await teacher.waitForSelector('.room-code b');
  const code = (await teacher.textContent('.room-code b')).trim();
  assert.match(code, /^\d{4}$/);
  assert.ok(await teacher.$('#qr svg'), 'QR이 그려져야 함');
  console.log('방 번호', code);

  const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const students = [];
  for (const nick of ['고양농부', '세종팬']) {
    const ctx = await browser.newContext(phone);
    const p = await ctx.newPage(); watch(p, nick);
    await p.goto(`${BASE}/?room=${code}`);
    await p.fill('#nick', nick);
    await p.click('#join button');
    await p.waitForSelector('#status:not([hidden])');
    students.push(p);
  }
  const [s1, s2] = students;
  await shot(s1, 's-lobby');
  await teacher.waitForFunction(() => document.querySelector('#pcount2')?.textContent === '2');
  await teacher.waitForFunction(() => document.querySelectorAll('#plist .chip').length === 2);
  console.log('✔ 두 학생 입장이 교사 화면에 실시간 표시');
  await shot(teacher, 't-lobby');

  // s1: 장터에서 호미 사기 (3 → 1닢)
  await s1.click('#shopBtn');
  await shot(s1, 's-shop');
  await s1.click('.item button[data-id="hoe"]');
  await s1.click('#closeShop');
  assert.equal((await s1.textContent('.st-coins b')).trim(), '1');

  const coins = async (p) => Number((await p.textContent('#status .st-coins b')).trim());
  const hp = async (p) => Number((await p.textContent('#status .st-hp small')).replace(/\D/g, ''));
  const bar = (p, k) => p.textContent(`.bar-row[data-key="${k}"] .n`);

  // 장면 1
  await teacher.click('[data-act="start"]');
  await Promise.all(students.map((p) => p.waitForSelector('.choice')));
  await s1.click('.choice[data-key="A"]');
  await s2.click('.choice[data-key="C"]');
  await teacher.waitForFunction(() => document.querySelector('#vcount')?.textContent === '2');
  assert.equal(await bar(teacher, 'A'), '1'); assert.equal(await bar(teacher, 'C'), '1');
  await s2.click('.choice[data-key="A"]'); // 마음을 바꿈
  await teacher.waitForFunction(() => document.querySelector('.bar-row[data-key="A"] .n').textContent === '2');
  assert.equal(await bar(teacher, 'C'), '0');
  await s1.waitForFunction(() => document.querySelector('.bar-row[data-key="A"] .n').textContent === '2');
  console.log('✔ 투표 막대 실시간 (교사·학생 모두), 표 바꾸기 반영');
  await shot(teacher, 't-vote'); await shot(s1, 's-vote');

  await teacher.click('[data-act="close"]');
  await Promise.all(students.map((p) => p.waitForSelector('.outcome.kA')));
  await s1.waitForFunction(() => document.querySelector('#status .st-hp small').textContent.includes('80'));
  assert.equal(await hp(s1), 80); // 60 + 선택 5 + 가을걷이 10 + 호미 5
  assert.equal(await hp(s2), 75);
  console.log('✔ 다수 선택(A)으로 이야기 진행, 호미 효과 반영');
  await shot(s1, 's-result');

  await teacher.click('[data-act="quiz"]');
  await Promise.all(students.map((p) => p.waitForSelector('button.option')));
  await s1.click('button.option[data-i="1"]');
  await s2.click('button.option[data-i="0"]');
  await teacher.waitForFunction(() => document.querySelector('#acount')?.textContent === '2');
  await shot(teacher, 't-quiz');
  await teacher.click('[data-act="reveal"]');
  await s1.waitForSelector('.reveal.ok');
  await s2.waitForSelector('.reveal.no');
  await s1.waitForTimeout(250);
  await shot(s1, 's-answer-ok');
  assert.equal(await coins(s1), 4); assert.equal(await coins(s2), 3);
  await teacher.waitForFunction(() => document.querySelector('#okcount')?.textContent === '1');
  console.log('✔ 정답 공개 → 맞힌 학생만 엽전 +3');
  await shot(teacher, 't-answer');

  // 장면 2~4: s1은 늘 정답, s2는 오답. 장면 2에서 s2는 B, s1은 A → 동점이면 A
  const picks = [null, ['A', 'B'], ['B', 'B'], ['C', 'A']];
  for (let sc = 1; sc < 4; sc++) {
    await teacher.click('[data-act="next"]');
    await Promise.all(students.map((p) => p.waitForSelector(`.choice`)));
    await s1.click(`.choice[data-key="${picks[sc][0]}"]`);
    await s2.click(`.choice[data-key="${picks[sc][1]}"]`);
    await teacher.waitForFunction(() => document.querySelector('#vcount')?.textContent === '2');
    if (sc === 3) await shot(s2, 's-vote-night');
    await teacher.click('[data-act="close"]');
    await Promise.all(students.map((p) => p.waitForSelector('.outcome')));
    if (sc === 2) await shot(teacher, 't-result-stele');
    await teacher.click('[data-act="quiz"]');
    await Promise.all(students.map((p) => p.waitForSelector('button.option')));
    if (sc === 3) await s1.click('#shopBtn').then(() => s1.click('.item button[data-id="herb"]')).then(() => s1.click('#closeShop'));
    await s1.click('button.option[data-i="' + [1, 2, 1, 1][sc] + '"]');
    await s2.click('button.option[data-i="3"]');
    await teacher.waitForFunction(() => document.querySelector('#acount')?.textContent === '2');
    await teacher.click('[data-act="reveal"]');
    await s1.waitForSelector('.reveal.ok');
    if (sc === 2) { await s1.click('#shopBtn'); await s1.click('.item button[data-id="rice"]').catch(() => {}); await s1.click('#closeShop'); }
  }
  // 4장 사건이 반영되기 전 s1이 약초를 샀는지 확인용
  await teacher.click('[data-act="next"]');
  await Promise.all(students.map((p) => p.waitForSelector('.end')));
  const room = await teacher.evaluate(async () => (await (await fetch('/__/firebase/init.json')).json()).projectId);
  assert.equal(room, 'demo-joseon');
  // s1은 퀴즈 4개를 맞혔지만 물건을 늦게 사서 살림이 15 → 가운데 칭호
  assert.match(await s1.textContent('.tier strong'), /꿋꿋한 농사꾼/);
  assert.match(await s2.textContent('.tier strong'), /모진 세월/);
  assert.match(await s1.textContent('.stats'), /100점/);
  console.log('s1 결과:', (await s1.textContent('.stats')).replace(/\s+/g, ' '));
  console.log('s2 결과:', (await s2.textContent('.stats')).replace(/\s+/g, ' '), '/', await s2.textContent('.tier strong'));
  await teacher.waitForSelector('.compare .cmp-row:nth-child(5)');
  await s1.fill('#ans', '평화로운 시기에도 농민은 고단했지만, 임금이 귀 기울일 때는 목소리를 낼 수 있었다.');
  await s1.click('#final button');
  await teacher.waitForFunction(() => document.querySelectorAll('#wall figure').length === 1);
  console.log('✔ 마지막 한 문장이 교사 화면 벽에 실시간 표시');
  await shot(s1, 's-end'); await shot(teacher, 't-end');

  // 같은 방에서 다시 하기 → 학생 상태 초기화
  teacher.once('dialog', (d) => d.accept());
  await teacher.click('[data-act="again"]');
  await Promise.all(students.map((p) => p.waitForFunction(() => document.querySelector('#status .st-coins b')?.textContent === '3')));
  await teacher.waitForFunction(() => document.querySelector('#pcount2')?.textContent === '2');
  console.log('✔ 같은 방에서 다시 하기 → 학생 엽전·살림 초기화');

  // 보안 규칙: 지우기 불가, 이상한 값 거부
  const rules = await s1.evaluate(async (c) => {
    const fs = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    const { getApp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
    const db = fs.getFirestore(getApp());
    const out = {};
    const tryIt = async (name, f) => { try { await f(); out[name] = 'allowed'; } catch (e) { out[name] = e.code; } };
    await tryIt('deleteRoom', () => fs.deleteDoc(fs.doc(db, 'rooms', c)));
    await tryIt('badVote', () => fs.setDoc(fs.doc(db, 'rooms', c, 'votes', 'x'), { round: 1, scene: 0, pid: 'x', choice: 'Z', at: 1 }));
    await tryIt('otherCollection', () => fs.setDoc(fs.doc(db, 'secrets', 'x'), { a: 1 }));
    await tryIt('noRoomVote', () => fs.setDoc(fs.doc(db, 'rooms', '0000', 'votes', 'x'), { round: 1, scene: 0, pid: 'x', choice: 'A', at: 1 }));
    await tryIt('goodVote', () => fs.setDoc(fs.doc(db, 'rooms', c, 'votes', 'zz'), { round: 99, scene: 0, pid: 'zz', choice: 'A', at: 1 }));
    return out;
  }, code);
  console.log('보안 규칙:', rules);
  assert.deepEqual(rules, { deleteRoom: 'permission-denied', badVote: 'permission-denied', otherCollection: 'permission-denied', noRoomVote: 'permission-denied', goodVote: 'allowed' });

  if (errors.length) { console.log('콘솔 오류:\n' + errors.join('\n')); process.exitCode = 1; } else console.log('✔ 콘솔 오류 없음');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
