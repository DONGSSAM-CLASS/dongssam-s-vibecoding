// 교사 화면: 방 만들기 · QR · 장면 진행 · 실시간 투표 막대 · 마지막 비교와 학생 답 모아 보기
import { openDb, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, serverTimestamp } from './firebase.js';
import { GAME, SCENES, CHOICE_KEYS } from './content.js';
import { ART } from './art.js';
import * as U from './ui.js';

const app = U.$('#app');
const topEl = U.$('#top');
const params = new URLSearchParams(location.search);
const LESSON_MS = 15 * 60 * 1000;

let db, code, room;
let players = [], votes = [], answers = [];
let unsub = {}, subKeys = {};

const fresh = (c) => ({
  code: c, round: 1, phase: 'lobby', scene: 0, outcomes: {}, tallies: {}, revealed: {}, quizStats: {},
  startedAt: null, endedAt: null, phaseAt: Date.now(), createdAt: serverTimestamp(),
});

const studentUrl = () => {
  const base = location.origin + location.pathname.replace(/teacher\.html$/, '');
  return `${base}?room=${code}${params.has('emu') ? `&emu=${params.get('emu')}` : ''}`;
};
const shortAddr = () => (location.host + location.pathname.replace(/teacher\.html$/, '')).replace(/\/$/, '');

// ── 방 만들기 / 이어 하기 ─────────────────────────────
function setupView() {
  topEl.hidden = true;
  let last = params.get('room');
  try { last = last || localStorage.getItem('jf_teacher_room'); } catch { /* 무시 */ }
  U.show(app, 'setup', `
    <section class="card hero">
      <div class="art">${ART.title}</div>
      <p class="kicker">교사 화면 · 수업 15분 · 중학교 3학년</p>
      <h1 class="title">${GAME.title}</h1>
      <p class="subtitle">${U.esc(GAME.subtitle)}</p>
      <div class="intro">${GAME.intro.map((p) => `<p>${U.esc(p)}</p>`).join('')}</div>
      <div class="row center">
        <button class="btn big" id="newRoom">새 수업 방 만들기</button>
        ${last && /^\d{4}$/.test(last) ? `<button class="btn meok big" id="resume">${last}번 방 이어 하기</button>` : ''}
      </div>
      <p class="err" role="alert"></p>
    </section>
    ${U.factsHTML()}`);
  U.$('#newRoom').addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = '방 만드는 중…';
    try { await openRoom(await createRoom()); } catch (err) {
      e.target.disabled = false; e.target.textContent = '새 수업 방 만들기';
      U.$('.err').textContent = `방을 만들지 못했어요: ${err.message}`;
    }
  });
  U.$('#resume')?.addEventListener('click', async () => {
    const s = await getDoc(doc(db, 'rooms', last));
    if (s.exists()) openRoom(last); else U.$('.err').textContent = `${last}번 방을 찾지 못했어요. 새 방을 만들어 주세요.`;
  });
}

async function createRoom() {
  for (let i = 0; i < 30; i++) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    const ref = doc(db, 'rooms', c);
    if (!(await getDoc(ref)).exists()) { await setDoc(ref, fresh(c)); return c; }
  }
  throw new Error('빈 방 번호를 찾지 못했어요. 다시 눌러 주세요.');
}

function openRoom(c) {
  code = c;
  try { localStorage.setItem('jf_teacher_room', c); } catch { /* 무시 */ }
  history.replaceState(null, '', `?room=${c}${params.has('emu') ? `&emu=${params.get('emu')}` : ''}`);
  unsub.room?.();
  unsub.room = onSnapshot(doc(db, 'rooms', c), (s) => { room = s.data(); if (room) onRoom(); });
}

// ── 구독 관리 ─────────────────────────────────────────
function sub(name, key, makeQuery, cb) {
  if (subKeys[name] === key) return;
  unsub[name]?.(); unsub[name] = null; subKeys[name] = key;
  if (!key) return;
  unsub[name] = onSnapshot(makeQuery(), (snap) => { cb(snap.docs.map((d) => d.data())); });
}

function onRoom() {
  const R = room.round, S = room.scene;
  const col = (n) => collection(db, 'rooms', code, n);
  sub('players', `${R}`, () => query(col('players'), where('round', '==', R)), (d) => { players = d; refresh(); });
  sub('votes', ['vote', 'result'].includes(room.phase) ? `${R}|${S}` : '', () => query(col('votes'), where('round', '==', R), where('scene', '==', S)), (d) => { votes = d; refresh(); });
  sub('quiz', ['quiz', 'answer'].includes(room.phase) ? `${R}|${S}` : '', () => query(col('quiz'), where('round', '==', R), where('scene', '==', S)), (d) => { answers = d; refresh(); });
  if (!subKeys.votes) votes = [];
  if (!subKeys.quiz) answers = [];
  render();
  refresh();
}

const voteCounts = () => votes.reduce((a, v) => { a[v.choice] = (a[v.choice] || 0) + 1; return a; }, {});

// ── 진행 버튼 ─────────────────────────────────────────
async function go(patch) {
  U.$$('.ctl').forEach((b) => { b.disabled = true; });
  try { await updateDoc(doc(db, 'rooms', code), { ...patch, phaseAt: Date.now() }); } catch (e) {
    alert(`저장하지 못했어요: ${e.message}`);
    U.$$('.ctl').forEach((b) => { b.disabled = false; });
  }
}
const actions = {
  start: () => go({ phase: 'vote', scene: 0, startedAt: Date.now() }),
  close: () => {
    const t = voteCounts();
    const m = U.majority(t);
    return go({ phase: 'result', [`outcomes.${room.scene}`]: m.key, [`tallies.${room.scene}`]: t });
  },
  quiz: () => go({ phase: 'quiz' }),
  reveal: () => go({
    phase: 'answer', [`revealed.${room.scene}`]: true,
    [`quizStats.${room.scene}`]: { correct: answers.filter((a) => a.correct).length, total: answers.length },
  }),
  next: () => (room.scene < SCENES.length - 1 ? go({ phase: 'vote', scene: room.scene + 1 }) : go({ phase: 'end', endedAt: Date.now() })),
  again: () => {
    if (!confirm('같은 방 번호로 처음부터 다시 할까요? 학생들의 엽전·살림도 처음으로 돌아갑니다.')) return;
    const f = fresh(code);
    delete f.createdAt;
    return go({ ...f, round: room.round + 1 });
  },
  newRoom: async () => {
    if (!confirm('새 방을 만들까요? 학생들은 새 방 번호로 다시 들어와야 합니다.')) return;
    Object.values(unsub).forEach((f) => f?.()); unsub = {}; subKeys = {};
    U.resetView();
    openRoom(await createRoom());
  },
};

// ── 화면 ──────────────────────────────────────────────
const STEPS = ['이야기·투표', '결과', '사료 퀴즈', '정답'];
const stepIdx = { vote: 0, result: 1, quiz: 2, answer: 3 };

function renderTop() {
  topEl.hidden = false;
  const i = stepIdx[room.phase];
  topEl.innerHTML = `
    <div class="tb-brand"><b>${GAME.title}</b><small>교사 화면</small></div>
    <div class="tb-room">방 <b>${code}</b></div>
    <div class="tb-count">참여 <b id="pcount">${players.length}</b>명</div>
    <div class="tb-steps">${room.phase === 'lobby' ? '<span class="on">입장 대기</span>' : room.phase === 'end' ? '<span class="on">마무리</span>' : SCENES.map((_, n) => `<span class="${n < room.scene ? 'done' : n === room.scene ? 'on' : ''}">장면 ${n + 1}${n === room.scene ? ` · ${STEPS[i]}` : ''}</span>`).join('')}</div>
    <div class="tb-clock" id="clock"></div>`;
  tick();
}

function tick() {
  const el = U.$('#clock');
  if (!el || !room) return;
  if (!room.startedAt) { el.textContent = '수업 15:00'; el.classList.remove('late'); return; }
  const left = LESSON_MS - ((room.endedAt || Date.now()) - room.startedAt);
  const t = Math.abs(Math.round(left / 1000));
  el.textContent = `${left < 0 ? '초과 ' : '남은 '}${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  el.classList.toggle('late', left < 2 * 60 * 1000);
}
setInterval(tick, 1000);

function render() {
  renderTop();
  const s = SCENES[room.scene];
  const key = `${room.round}|${room.phase}|${room.scene}`;
  const html = ({ lobby: lobbyHTML, vote: voteHTML, result: resultHTML, quiz: quizHTML, answer: answerHTML, end: endHTML }[room.phase] || lobbyHTML)(s);
  if (U.show(app, key, html)) {
    U.$$('[data-act]', app).forEach((b) => b.addEventListener('click', () => actions[b.dataset.act]()));
    if (room.phase === 'lobby') drawQR();
  }
}

function lobbyHTML() {
  return `<div class="grid2">
    <section class="card center join-card">
      <p class="kicker">휴대전화 카메라로 찍거나 주소를 입력하세요</p>
      <div id="qr" class="qr" aria-label="학생용 QR 코드"></div>
      <p class="addr">${U.esc(shortAddr())}</p>
      <p class="room-code"><small>방 번호</small><b>${code}</b></p>
    </section>
    <section class="card">
      <h1 class="h1">입장한 농민 <span class="count"><b id="pcount2">${players.length}</b>명</span></h1>
      <div class="chips" id="plist"></div>
      <ol class="howto">
        <li>QR을 찍거나 주소에 들어가 방 번호와 <b>별명</b>을 넣는다.</li>
        <li>장면마다 휴대전화로 고르면 막대가 쌓이고, 다수의 선택으로 이야기가 이어진다.</li>
        <li>사료 퀴즈를 맞히면 엽전 ${GAME.quizReward}닢. 장터에서 살아남을 물건을 산다.</li>
      </ol>
      <button class="btn big ctl" data-act="start">이야기 시작 ▶</button>
    </section>
  </div>
  ${U.factsHTML()}`;
}

function drawQR() {
  const el = U.$('#qr');
  if (!el) return;
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(studentUrl());
    qr.make();
    el.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
  } catch (e) { el.textContent = studentUrl(); }
}

const sceneCard = (s, body) => `
  <section class="card scene">
    <div class="art">${ART[s.art]}</div>
    ${U.sceneHead(s, room.scene)}
    <h1 class="h1">${U.esc(s.title)}</h1>
    ${body}
  </section>`;

function voteHTML(s) {
  return `<div class="grid2 wide-left">
    ${sceneCard(s, `<p class="who">이번 장면의 너: ${U.esc(s.who)}</p>
      <div class="story big-text">${U.storyParas(s, room.outcomes)}</div>${U.peopleHTML(s)}`)}
    <section class="card live">
      <h2 class="h2">${U.esc(s.question)}</h2>
      <ul class="choice-list">${s.choices.map((c) => `<li class="k${c.key}"><b class="key">${c.key}</b><span><strong>${U.esc(c.label)}</strong> ${U.esc(c.text)}</span></li>`).join('')}</ul>
      ${U.barsHTML(s, voteCounts())}
      <p class="progress">투표 <b id="vcount">0</b> / <span class="pc">${players.length}</span>명</p>
      <button class="btn big ctl" data-act="close">투표 마감 · 결과 보기</button>
    </section>
  </div>`;
}

function resultHTML(s) {
  const k = room.outcomes?.[room.scene];
  const c = s.choices.find((x) => x.key === k) || s.choices[0];
  const t = room.tallies?.[room.scene] || {};
  const m = U.majority(t);
  return `<div class="grid2 wide-left">
    ${sceneCard(s, `<div class="outcome k${c.key}"><b class="key">${c.key}</b><div><strong>우리 반은 「${U.esc(c.label)}」</strong><p class="big-text">${U.esc(c.outcome)}</p></div></div>
      ${m.tie ? '<p class="small">표가 같아 앞쪽 선택으로 이야기를 이어 갑니다.</p>' : ''}${m.none ? '<p class="small">투표가 없어 첫 번째 선택으로 이어 갑니다.</p>' : ''}
      <section class="event"><h2 class="h3">${U.esc(s.event.title)}</h2><p class="big-text">${U.esc(s.event.text)}</p>
      <p class="small">학생 화면에 살림 변화가 표시됩니다. 장터 물건(${Object.keys(s.event.items).length}가지)이 있으면 덜 다치거나 더 얻습니다.</p></section>`)}
    <section class="card live">
      <h2 class="h2">최종 투표</h2>
      ${U.barsHTML(s, t, { winner: c.key })}
      <button class="btn big ctl" data-act="quiz">사료 퀴즈 열기 ▶</button>
    </section>
  </div>`;
}

function quizHTML(s) {
  return `<div class="grid2 wide-left">
    <section class="card quiz">
      ${U.sceneHead(s, room.scene)}
      <h1 class="h1">사료 퀴즈</h1>
      <blockquote class="source big-text">${U.esc(s.quiz.source)}<cite>${U.esc(s.quiz.cite)}</cite></blockquote>
      <h2 class="q">${U.esc(s.quiz.q)}</h2>
      <div class="options">${s.quiz.options.map((o, i) => `<div class="option"><b class="num">${'①②③④'[i]}</b>${U.esc(o)}</div>`).join('')}</div>
    </section>
    <section class="card live center">
      <h2 class="h2">답을 낸 학생</h2>
      <p class="huge"><b id="acount">0</b><small> / <span class="pc">${players.length}</span>명</small></p>
      <p>맞히면 엽전 ${GAME.quizReward}닢</p>
      <button class="btn big ctl" data-act="reveal">정답 공개</button>
    </section>
  </div>`;
}

function answerHTML(s) {
  const last = room.scene === SCENES.length - 1;
  return `<div class="grid2 wide-left">
    <section class="card quiz">
      ${U.sceneHead(s, room.scene)}
      <h1 class="h1">정답: ${'①②③④'[s.quiz.answer]} ${U.esc(s.quiz.options[s.quiz.answer])}</h1>
      <div class="options" id="optStats"></div>
      <p class="explain big-text">${U.esc(s.quiz.explain)}</p>
    </section>
    <section class="card live center">
      <h2 class="h2">맞힌 학생</h2>
      <p class="huge"><b id="okcount">0</b><small> / <span id="acount2">0</span>명</small></p>
      <p>학생들은 지금 장터에서 물건을 살 수 있어요.</p>
      <button class="btn big ctl" data-act="next">${last ? '마지막: 우리 반 vs 실제 역사 ▶' : `장면 ${room.scene + 2}로 ▶`}</button>
    </section>
  </div>`;
}

function endHTML() {
  return `<section class="card leader hero">
      <p class="kicker">마무리</p>
      <h1 class="title">${U.esc(GAME.leaderLine)}</h1>
      <p class="big-text">${U.esc(GAME.leaderDetail)}</p>
      <div class="stats" id="classStats"></div>
    </section>
    <section class="card"><h2 class="h2">우리 반의 선택 · 실제 역사</h2>${U.compareHTML(room)}</section>
    <section class="card">
      <h2 class="h2">마지막 질문</h2>
      <p class="lead">${U.esc(GAME.finalQuestion)}</p>
      <div class="wall" id="wall"></div>
    </section>
    <div class="row center">
      <button class="btn big ctl" data-act="again">같은 방에서 다시 하기</button>
      <button class="btn meok big" data-act="newRoom">새 방 만들기</button>
    </div>
    ${U.factsHTML()}`;
}

// 실시간으로 바뀌는 부분만 갱신 (화면 전체를 다시 그리지 않음)
function refresh() {
  if (!room) return;
  const set = (sel, v) => U.$$(sel).forEach((el) => { el.textContent = v; });
  set('#pcount', players.length); set('#pcount2', players.length); set('.pc', players.length);
  const pl = U.$('#plist');
  if (pl) pl.innerHTML = players.length ? players.sort((a, b) => a.joinedAt - b.joinedAt).map((p) => `<span class="chip">${U.esc(p.nick)}</span>`).join('') : '<p class="small">아직 아무도 들어오지 않았어요.</p>';
  if (room.phase === 'vote') { U.updateBars(app, voteCounts()); set('#vcount', votes.length); }
  if (room.phase === 'quiz') set('#acount', answers.length);
  if (room.phase === 'answer') {
    const s = SCENES[room.scene];
    const ok = answers.filter((a) => a.correct).length;
    set('#okcount', ok); set('#acount2', answers.length);
    const box = U.$('#optStats');
    if (box) box.innerHTML = s.quiz.options.map((o, i) => {
      const n = answers.filter((a) => a.choice === i).length;
      const pct = answers.length ? Math.round((n / answers.length) * 100) : 0;
      return `<div class="option stat ${i === s.quiz.answer ? 'right' : ''}"><b class="num">${'①②③④'[i]}</b><span>${U.esc(o)}</span><i style="width:${pct}%"></i><em>${n}명 · ${pct}%</em></div>`;
    }).join('');
  }
  if (room.phase === 'end') {
    const wall = U.$('#wall');
    const said = players.filter((p) => p.answer);
    if (wall) wall.innerHTML = said.length ? said.map((p) => `<figure><blockquote>${U.esc(p.answer)}</blockquote><figcaption>— ${U.esc(p.nick)}</figcaption></figure>`).join('') : '<p class="small">학생들이 한 문장을 쓰면 여기에 바로 올라옵니다.</p>';
    const n = players.length || 1;
    const avg = (f) => Math.round(players.reduce((a, p) => a + f(p), 0) / n * 10) / 10;
    const cs = U.$('#classStats');
    if (cs) cs.innerHTML = `
      <div><small>참여</small><b>${players.length}명</b></div>
      <div><small>평균 퀴즈</small><b>${avg((p) => p.correct)}</b><span>/ ${SCENES.length}</span></div>
      <div><small>평균 살림</small><b>${avg((p) => p.hp)}</b></div>
      <div><small>걸린 시간</small><b class="sm">${room.endedAt && room.startedAt ? U.fmtTime(room.endedAt - room.startedAt) : '-'}</b></div>`;
  }
}

// ── 시작 ───────────────────────────────────────────────
(async () => {
  try { db = await openDb(); } catch (e) { app.innerHTML = U.errorCard(e) + U.factsHTML(); return; }
  const r = params.get('room');
  if (r && /^\d{4}$/.test(r) && (await getDoc(doc(db, 'rooms', r))).exists()) openRoom(r);
  else setupView();
})();
