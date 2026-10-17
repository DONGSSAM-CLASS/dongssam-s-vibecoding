// 학생 화면: 방 번호 + 별명으로 들어와 장면마다 투표하고, 사료 퀴즈로 엽전을 모아 장터에서 물건을 산다.
import { openDb, doc, getDoc, setDoc, onSnapshot, collection, query, where } from './firebase.js';
import { GAME, SCENES, ITEMS, CHOICE_KEYS } from './content.js';
import { ART, ITEM_ICONS, COIN } from './art.js';
import * as U from './ui.js';

const app = U.$('#app');
const statusEl = U.$('#status');
const params = new URLSearchParams(location.search);

// 탭마다 다른 학생(같은 PC에서 두 창을 열어도 따로 셈), 새로 고침해도 유지
const pid = (() => {
  try {
    let p = sessionStorage.getItem('jf_pid');
    if (!p) { p = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('jf_pid', p); }
    return p;
  } catch { return Math.random().toString(36).slice(2, 12); }
})();

let db, code, room, me, unsubRoom, unsubVotes, votesFor = '';
let lastHp = null;

const lsKey = () => `jf:${code}:${pid}`;
const load = () => { try { return JSON.parse(localStorage.getItem(lsKey()) || 'null'); } catch { return null; } };
const persistLocal = () => { try { localStorage.setItem(lsKey(), JSON.stringify(me)); } catch { /* 저장 불가여도 진행 */ } };

function freshMe(nick, round) {
  return { nick, round, coins: GAME.startCoins, hp: GAME.startHp, items: [], correct: 0, applied: {}, paid: {}, votes: {}, quiz: {}, answer: '', joinedAt: Date.now() };
}

async function savePlayer() {
  persistLocal();
  try {
    await setDoc(doc(db, 'rooms', code, 'players', pid), {
      nick: me.nick, round: me.round, coins: me.coins, hp: me.hp, items: me.items,
      correct: me.correct, answer: me.answer, joinedAt: me.joinedAt, at: Date.now(),
    });
  } catch (e) { console.warn('save', e); }
}

// ── 시작 화면 ─────────────────────────────────────────
function startView(msg = '') {
  statusEl.hidden = true;
  const last = (() => { try { return JSON.parse(localStorage.getItem('jf_last') || '{}'); } catch { return {}; } })();
  const room0 = params.get('room') || last.code || '';
  U.show(app, `start-${Date.now()}`, `
    <section class="card hero">
      <div class="art">${ART.title}</div>
      <p class="kicker">역사 수업 · 반 전체가 함께 고르는 이야기</p>
      <h1 class="title">${GAME.title}</h1>
      <p class="subtitle">${U.esc(GAME.subtitle)}</p>
      <div class="intro">${GAME.intro.map((p) => `<p>${U.esc(p)}</p>`).join('')}</div>
      <form id="join" class="join" autocomplete="off">
        <label>방 번호 <input id="code" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required placeholder="네 자리" value="${U.esc(room0)}"></label>
        <label>별명 <input id="nick" maxlength="10" required placeholder="예: 고양 농부" value="${U.esc(last.nick || '')}"></label>
        <p class="hint">실제 이름 대신 별명을 써 주세요. (10자까지)</p>
        <p class="err" role="alert">${U.esc(msg)}</p>
        <button class="btn big" type="submit">시작</button>
      </form>
    </section>
    ${U.factsHTML()}`);
  U.$('#join').addEventListener('submit', async (e) => {
    e.preventDefault();
    const c = U.$('#code').value.trim();
    const n = U.$('#nick').value.trim().slice(0, 10);
    const btn = e.submitter || U.$('#join button');
    if (!/^\d{4}$/.test(c) || !n) { U.pulse(U.$('#join'), 'shake'); U.$('.err').textContent = '방 번호 네 자리와 별명을 넣어 주세요.'; return; }
    btn.disabled = true; btn.textContent = '들어가는 중…';
    try { await join(c, n); } catch (err) {
      btn.disabled = false; btn.textContent = '시작';
      U.pulse(U.$('#join'), 'shake');
      U.$('.err').textContent = err.message === 'NO_ROOM' ? `${c}번 방이 없어요. 선생님 화면의 번호를 다시 확인해 주세요.` : '연결하지 못했어요. 인터넷을 확인해 주세요.';
    }
  });
}

async function join(c, nick) {
  const snap = await getDoc(doc(db, 'rooms', c));
  if (!snap.exists()) throw new Error('NO_ROOM');
  code = c;
  try { localStorage.setItem('jf_last', JSON.stringify({ code: c, nick })); } catch { /* 무시 */ }
  const r = snap.data();
  me = load();
  if (!me || me.round !== r.round) me = freshMe(nick, r.round);
  me.nick = nick;
  await savePlayer();
  history.replaceState(null, '', `?room=${c}${params.has('emu') ? `&emu=${params.get('emu')}` : ''}`);
  unsubRoom?.();
  unsubRoom = onSnapshot(doc(db, 'rooms', c), (s) => { room = s.data(); onRoom(); });
}

// ── 방 상태가 바뀔 때 ─────────────────────────────────
function onRoom() {
  if (!room) return;
  if (room.round !== me.round) { me = freshMe(me.nick, room.round); U.resetView(); savePlayer(); }
  const changed = settle();
  if (changed) savePlayer();
  watchVotes();
  render();
  renderStatus();
}

// 지난 장면의 결과(사건)와 퀴즈 보상을 한 번씩만 반영
function settle() {
  let changed = false;
  SCENES.forEach((s, i) => {
    const k = room.outcomes?.[i];
    if (k && !me.applied[i]) {
      const c = s.choices.find((x) => x.key === k) || s.choices[0];
      const parts = [{ label: `우리 반의 선택 (${c.key} ${c.label})`, hp: c.hp || 0, coins: c.coins || 0 }, { label: s.event.title, hp: s.event.base, coins: 0 }];
      for (const [id, bonus] of Object.entries(s.event.items)) {
        if (me.items.includes(id)) parts.push({ label: `${ITEMS.find((x) => x.id === id).name} 덕분에`, hp: bonus, coins: 0, item: id });
      }
      const hp = parts.reduce((a, p) => a + p.hp, 0);
      const coins = parts.reduce((a, p) => a + p.coins, 0);
      me.hp = Math.max(0, Math.min(100, me.hp + hp));
      me.coins += coins;
      me.applied[i] = { parts, hp, coins };
      changed = true;
    }
    if (room.revealed?.[i] && !me.paid[i]) {
      const mine = me.quiz[i];
      const ok = mine === s.quiz.answer;
      if (ok) { me.coins += GAME.quizReward; me.correct += 1; }
      me.paid[i] = mine == null ? 'none' : ok ? 'ok' : 'no';
      changed = true;
    }
  });
  return changed;
}

function watchVotes() {
  const want = room.phase === 'vote' ? `${room.round}|${room.scene}` : '';
  if (want === votesFor) return;
  unsubVotes?.(); unsubVotes = null; votesFor = want;
  if (!want) return;
  const q = query(collection(db, 'rooms', code, 'votes'), where('round', '==', room.round), where('scene', '==', room.scene));
  unsubVotes = onSnapshot(q, (snap) => {
    const counts = {};
    snap.forEach((d) => { const v = d.data(); counts[v.choice] = (counts[v.choice] || 0) + 1; });
    U.updateBars(app, counts);
  });
}

// ── 화면 그리기 ────────────────────────────────────────
function render() {
  const s = SCENES[room.scene];
  const key = `${room.round}|${room.phase}|${room.scene}`;
  const views = { lobby: lobbyView, vote: voteView, result: resultView, quiz: quizView, answer: answerView, end: endView };
  (views[room.phase] || lobbyView)(s, key);
}

function lobbyView(_, key) {
  if (!U.show(app, key, `
    <section class="card center">
      <div class="art">${ART.title}</div>
      <p class="kicker">${code}번 방에 들어왔어요</p>
      <h1 class="title">${U.esc(me.nick)}</h1>
      <p class="lead">선생님 화면에 첫 장면이 뜨면 여기에서 고를 수 있어요.</p>
      <p>기다리는 동안 아래 <b>장터</b>에서 엽전 ${GAME.startCoins}닢으로 물건을 미리 사 둘 수 있어요. 어떤 물건이 언제 쓸모 있을지는 이야기 속에서 알게 됩니다.</p>
      <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
    </section>`)) return;
}

function voteView(s, key) {
  const mine = me.votes[room.scene];
  const fresh = U.show(app, key, `
    <article class="card scene">
      <div class="art">${ART[s.art]}</div>
      ${U.sceneHead(s, room.scene)}
      <h1 class="h1">${U.esc(s.title)}</h1>
      <p class="who">이번 장면의 너: ${U.esc(s.who)}</p>
      <p class="lead">${U.esc(s.short)}</p>
      <details class="story"><summary>이야기 전부 읽기</summary>${U.storyParas(s, room.outcomes)}${U.peopleHTML(s)}</details>
      <h2 class="q">${U.esc(s.question)}</h2>
      <div class="choices">${s.choices.map((c) => `
        <button class="choice k${c.key}" data-key="${c.key}"><b class="key">${c.key}</b><span><strong>${U.esc(c.label)}</strong>${U.esc(c.text)}</span></button>`).join('')}
      </div>
      <div class="after-vote" ${mine ? '' : 'hidden'}>
        <p class="ok-msg">투표했어요! 마감 전까지는 바꿀 수 있어요. 큰 화면을 함께 보세요.</p>
        ${U.barsHTML(s, {})}
      </div>
    </article>`);
  if (fresh) {
    U.$$('.choice', app).forEach((b) => b.addEventListener('click', () => vote(b.dataset.key)));
    votesFor = ''; watchVotes();
  }
  U.$$('.choice', app).forEach((b) => b.classList.toggle('picked', b.dataset.key === me.votes[room.scene]));
}

async function vote(k) {
  const scene = room.scene;
  me.votes[scene] = k;
  persistLocal();
  U.$$('.choice', app).forEach((b) => b.classList.toggle('picked', b.dataset.key === k));
  const after = U.$('.after-vote', app);
  if (after.hidden) { after.hidden = false; }
  U.$$('.bar-row', app).forEach((r) => r.classList.toggle('mine', r.dataset.key === k));
  try {
    await setDoc(doc(db, 'rooms', code, 'votes', `${room.round}_${scene}_${pid}`), { round: room.round, scene, pid, choice: k, at: Date.now() });
  } catch (e) { U.$('.ok-msg', app).textContent = '저장하지 못했어요. 다시 눌러 주세요.'; }
}

function deltaHTML(a) {
  if (!a) return '';
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  return `<ul class="delta">${a.parts.filter((p) => p.hp || p.coins).map((p) => `
    <li>${p.item ? ITEM_ICONS[p.item] : ''}<span>${U.esc(p.label)}</span>
      ${p.hp ? `<b class="${p.hp > 0 ? 'up' : 'down'}">살림 ${sign(p.hp)}</b>` : ''}
      ${p.coins ? `<b class="up">엽전 ${sign(p.coins)}</b>` : ''}</li>`).join('')}
    <li class="sum"><span>이번 장면 합계</span><b class="${a.hp >= 0 ? 'up' : 'down'}">살림 ${sign(a.hp)}</b></li>
  </ul>`;
}

function resultView(s, key) {
  const k = room.outcomes?.[room.scene];
  const c = s.choices.find((x) => x.key === k) || s.choices[0];
  const t = room.tallies?.[room.scene] || {};
  const m = U.majority(t);
  const a = me.applied[room.scene];
  if (!U.show(app, key, `
    <article class="card scene">
      <div class="art">${ART[s.art]}</div>
      ${U.sceneHead(s, room.scene)}
      <h1 class="h1">우리 반의 선택</h1>
      <div class="outcome k${c.key}"><b class="key">${c.key}</b><div><strong>${U.esc(c.label)}</strong><p>${U.esc(c.outcome)}</p></div></div>
      ${m.tie ? '<p class="small">표가 같아 앞쪽 선택으로 이야기가 이어집니다.</p>' : ''}
      ${U.barsHTML(s, t, { mine: me.votes[room.scene], winner: c.key })}
      <section class="event">
        <h2 class="h3">${U.esc(s.event.title)}</h2>
        <p>${U.esc(s.event.text)}</p>
        ${deltaHTML(a)}
      </section>
      <p class="small center">선생님이 사료 퀴즈를 열면 엽전을 모을 수 있어요.</p>
    </article>`)) return;
  if (a) U.pulse(U.$('.event', app), a.hp >= 0 ? 'glow-ok' : 'shake');
}

function quizView(s, key) {
  const fresh = U.show(app, key, `
    <article class="card quiz">
      ${U.sceneHead(s, room.scene)}
      <h1 class="h1">사료 퀴즈</h1>
      <blockquote class="source">${U.esc(s.quiz.source)}<cite>${U.esc(s.quiz.cite)}</cite></blockquote>
      <h2 class="q">${U.esc(s.quiz.q)}</h2>
      <div class="options">${s.quiz.options.map((o, i) => `<button class="option" data-i="${i}"><b class="num">${'①②③④'[i]}</b><span>${U.esc(o)}</span></button>`).join('')}</div>
      <p class="ok-msg" ${me.quiz[room.scene] == null ? 'hidden' : ''}>답을 냈어요. 정답 공개를 기다려요! (공개 전까지 바꿀 수 있어요)</p>
    </article>`);
  if (fresh) U.$$('.option', app).forEach((b) => b.addEventListener('click', () => answer(Number(b.dataset.i))));
  U.$$('.option', app).forEach((b) => b.classList.toggle('picked', Number(b.dataset.i) === me.quiz[room.scene]));
}

async function answer(i) {
  const scene = room.scene;
  me.quiz[scene] = i;
  persistLocal();
  U.$$('.option', app).forEach((b) => b.classList.toggle('picked', Number(b.dataset.i) === i));
  U.$('.ok-msg', app).hidden = false;
  try {
    await setDoc(doc(db, 'rooms', code, 'quiz', `${room.round}_${scene}_${pid}`), { round: room.round, scene, pid, choice: i, correct: i === SCENES[scene].quiz.answer, at: Date.now() });
  } catch (e) { U.$('.ok-msg', app).textContent = '저장하지 못했어요. 다시 눌러 주세요.'; }
}

function answerView(s, key) {
  const res = me.paid[room.scene];
  const mine = me.quiz[room.scene];
  const head = res === 'ok' ? '정답!' : res === 'no' ? '아쉬워요' : '답을 내지 않았어요';
  if (!U.show(app, key, `
    <article class="card quiz reveal ${res}">
      ${U.sceneHead(s, room.scene)}
      <h1 class="h1">${head}</h1>
      ${res === 'ok' ? `<p class="reward">${COIN}<span>엽전 +${GAME.quizReward}닢</span></p>` : ''}
      <h2 class="q">${U.esc(s.quiz.q)}</h2>
      <div class="options">${s.quiz.options.map((o, i) => `<div class="option ${i === s.quiz.answer ? 'right' : ''} ${i === mine && i !== s.quiz.answer ? 'wrong' : ''}"><b class="num">${'①②③④'[i]}</b><span>${U.esc(o)}</span>${i === mine ? '<em>← 내 답</em>' : ''}</div>`).join('')}</div>
      <p class="explain">${U.esc(s.quiz.explain)}</p>
      <p class="small center">엽전이 모였다면 아래 <b>장터</b>에서 다음 장면에 대비하세요.</p>
    </article>`)) return;
  const card = U.$('.reveal', app);
  if (res === 'ok') { U.pulse(card, 'glow-ok'); U.confetti(card); } else U.pulse(card, 'shake');
}

const TIERS = [
  { name: '고을을 지킨 지혜로운 어른', desc: '사료를 꿰뚫어 보고 집안의 살림도 지켜 냈다.' },
  { name: '꿋꿋한 농사꾼', desc: '모진 세월 속에서도 버티며 배웠다.' },
  { name: '모진 세월을 견딘 백성', desc: '살아남은 것만으로도 대단한 시절이었다.' },
];
const tierOf = (correct, hp) => (correct >= 3 && hp >= 40 ? 0 : correct >= 2 || hp >= 40 ? 1 : 2);

function endView(_, key) {
  const t = tierOf(me.correct, me.hp);
  const time = room.endedAt && room.startedAt ? U.fmtTime(room.endedAt - room.startedAt) : '-';
  if (!U.show(app, key, `
    <section class="card end">
      <p class="kicker">${U.esc(me.nick)}의 집안 이야기</p>
      <h1 class="title">이야기의 끝</h1>
      <div class="tier t${t}"><small>나의 칭호</small><strong>${TIERS[t].name}</strong><span>${TIERS[t].desc}</span></div>
      <div class="stats">
        <div><small>점수</small><b>${me.correct * 25}점</b><span>사료 퀴즈 ${me.correct}/${SCENES.length}</span></div>
        <div><small>살림</small><b>${me.hp}</b><span>100점 만점</span></div>
        <div><small>남은 엽전</small><b>${me.coins}닢</b><span>물건 ${me.items.length}개</span></div>
        <div><small>걸린 시간</small><b class="sm">${time}</b><span>첫 장면부터 끝까지</span></div>
      </div>
      <ol class="tiers">${TIERS.map((x, i) => `<li class="${i === t ? 'on' : ''}"><b>${x.name}</b> <small>${i === 0 ? '퀴즈 3개 이상 + 살림 40 이상' : i === 1 ? '퀴즈 2개 이상 또는 살림 40 이상' : '그 밖'}</small></li>`).join('')}</ol>
    </section>
    <section class="card leader"><h2 class="h2">${U.esc(GAME.leaderLine)}</h2><p>${U.esc(GAME.leaderDetail)}</p></section>
    <section class="card"><h2 class="h2">우리 반의 선택 · 실제 역사</h2>${U.compareHTML(room)}</section>
    <section class="card final-q">
      <h2 class="h2">마지막 질문</h2>
      <p class="lead">${U.esc(GAME.finalQuestion)}</p>
      <form id="final"><textarea id="ans" maxlength="150" rows="3" placeholder="한 문장으로 적어 보세요." required>${U.esc(me.answer)}</textarea>
      <button class="btn" type="submit">${me.answer ? '고쳐서 다시 내기' : '내기'}</button><p class="ok-msg" ${me.answer ? '' : 'hidden'}>선생님 화면에 올라갔어요.</p></form>
    </section>
    <div class="center"><button class="btn meok big" id="again">다시 하기</button></div>
    ${U.factsHTML()}`)) return;
  if (t === 0) U.confetti(U.$('.tier', app));
  U.$('#final').addEventListener('submit', async (e) => {
    e.preventDefault();
    me.answer = U.$('#ans').value.trim().slice(0, 150);
    if (!me.answer) return;
    await savePlayer();
    U.$('#final .ok-msg').hidden = false;
    U.$('#final button').textContent = '고쳐서 다시 내기';
    U.pulse(U.$('.final-q'), 'glow-ok');
  });
  U.$('#again').addEventListener('click', () => {
    try { localStorage.removeItem(lsKey()); sessionStorage.removeItem('jf_pid'); } catch { /* 무시 */ }
    location.href = `?room=${code}${params.has('emu') ? `&emu=${params.get('emu')}` : ''}`;
  });
}

// ── 아래 상태 막대와 장터 ─────────────────────────────
function renderStatus() {
  statusEl.hidden = false;
  statusEl.innerHTML = `
    <div class="st-coins" title="엽전">${COIN}<b>${me.coins}</b><small>닢</small></div>
    <div class="st-hp"><small>살림 ${me.hp}</small><div class="meter"><i style="width:${me.hp}%"></i></div></div>
    <div class="st-items">${me.items.map((id) => ITEM_ICONS[id]).join('')}</div>
    <button class="btn small" id="shopBtn">장터</button>`;
  if (lastHp !== null && lastHp !== me.hp) U.pulse(U.$('.st-hp', statusEl), me.hp > lastHp ? 'glow-ok' : 'shake');
  lastHp = me.hp;
  U.$('#shopBtn').addEventListener('click', openShop);
}

function openShop() {
  const box = document.createElement('div');
  box.className = 'modal';
  box.innerHTML = `<div class="card shop" role="dialog" aria-modal="true" aria-label="장터">
    <div class="shop-head"><h2 class="h2">고양 장터</h2><div class="st-coins">${COIN}<b>${me.coins}</b><small>닢</small></div></div>
    <p class="small">물건은 한 번 사면 이야기 끝까지 지닌다. 어느 장면에서 쓸모 있을지 짐작해 보자. (게임 속 값이며 실제 물가와 다름)</p>
    <div class="items">${ITEMS.map((it) => {
      const has = me.items.includes(it.id);
      return `<div class="item ${has ? 'has' : ''}">${ITEM_ICONS[it.id]}<div><b>${it.name}</b><p>${it.desc}</p></div>
        <button class="btn small ${has ? 'meok' : ''}" data-id="${it.id}" ${has || me.coins < it.price ? 'disabled' : ''}>${has ? '가짐' : `${it.price}닢`}</button></div>`;
    }).join('')}</div>
    <button class="btn meok" id="closeShop">닫기</button>
  </div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  U.$('#closeShop', box).addEventListener('click', close);
  U.$$('.item button', box).forEach((b) => b.addEventListener('click', () => {
    const it = ITEMS.find((x) => x.id === b.dataset.id);
    if (me.items.includes(it.id) || me.coins < it.price) { U.pulse(b.closest('.item'), 'shake'); return; }
    me.coins -= it.price; me.items.push(it.id);
    savePlayer(); renderStatus();
    close(); openShop();
    U.pulse(U.$(`.item button[data-id="${it.id}"]`).closest('.item'), 'glow-ok');
  }));
}

// ── 시작 ───────────────────────────────────────────────
(async () => {
  try { db = await openDb(); } catch (e) { app.innerHTML = U.errorCard(e) + U.factsHTML(); return; }
  startView();
})();
