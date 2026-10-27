'use strict';
/* 진행자 화면. 구글 계정으로 로그인한 진행자만 수업방을 만들고, 연수생 진행 상황을 실시간으로 봅니다.
   읽고 쓰는 권한은 firestore.rules가 지키고, 여기서는 그 규칙에 맞춰 화면만 그립니다. */
(function () {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CFG = window.WS_FIREBASE, ADMINS = (window.WS_ADMINS || []).map(e => e.toLowerCase());
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const ONLINE_MS = 150000;   // 연수생 화면은 1분마다 신호를 보냅니다. 2분 반 안에 신호가 있으면 접속 중으로 봅니다.

/* 학습지의 쪽 순서. index.html의 data-step과 같아야 합니다. */
const STEPS = [
  ['c1', '1쪽', '웹앱 경험과 만들고 싶은 것'], ['archive', '2쪽', '동쌤 작품 둘러보기'], ['play', '3쪽', '체험 게임 세 가지'],
  ['c2', '4쪽', '해 보니 어땠나요?'], ['c4', '5쪽', '만들 때 조심할 점'], ['make', '6쪽', '도구별 만들기와 수정'],
  ['deploy', '7쪽', '배포 따라 하기'], ['work', '8쪽', '내 작품 카드 만들기'], ['gallery', '9쪽', '작품 갤러리와 좋아요'],
  ['quiz', '10쪽', '마무리 퀴즈'], ['survey', '11쪽', '연수 만족도']
];
/* 답 모아 보기에 쓰는 질문. pick은 고르기 문항(막대그래프로 셉니다). */
const QS = [
  ['tool', '선택한 실습 도구', 'pick'],
  ['n0', 'AI로 웹앱을 몇 번 만들어 보셨어요?', 'pick'],
  ['pain', '만들면서 어려웠던 점, 망설여진 까닭'],
  ['c1', '만들어 보고 싶은 역사 웹앱'],
  ['best', '가장 기억에 남는 체험', 'pick'],
  ['fun', '해 본 느낌 한마디', 'pick'],
  ['c2', '해 보니 어땠나요? 수업에 쓴다면?'],
  ['worry', '가장 신경 쓰이는 것(여러 개)', 'multi'],
  ['c4', '만들 때 조심해야 할 점'],
  ['pk', '고른 웹앱 종류', 'pick'],
  ['p1', '만들 웹앱의 단원·주제'],
  ['p5', '학생에게 던질 질문']
];

let fb = null, me = null, rooms = [], room = null, roomData = {}, people = [], works = [], likes = {}, survey = [];
let unsubRoom = [], tab = 'people';

function say(t, warn) { const n = $('#saveStatus'); n.textContent = t; n.classList.toggle('warn', !!warn); }
function setState(el, t, warn) { if (!el) return; el.textContent = t; el.classList.toggle('warn', !!warn); }
function show(id) { ['noConfig', 'signIn', 'denied', 'roomsPanel', 'dash'].forEach(x => { $('#' + x).hidden = !(Array.isArray(id) ? id.includes(x) : id === x); }); }
async function copy(text, stateEl, okMsg = '복사했어요.') {
  try { await navigator.clipboard.writeText(text); setState(stateEl, okMsg); }
  catch { $('#copyText').value = text; $('#copyBox').showModal(); setTimeout(() => $('#copyText').select(), 30); }
}
const ms = t => t && t.toMillis ? t.toMillis() : (typeof t === 'number' ? t : 0);
function ago(t) {
  const m = ms(t); if (!m) return '없음';
  const s = Math.max(0, Math.round((Date.now() - m) / 1000));
  return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`;
}
const online = p => Date.now() - ms(p.updatedAt) < ONLINE_MS;
const joinUrl = code => { const u = new URL('index.html', location.href); u.search = `?room=${code}${CFG && CFG.emulator ? '&emu' : ''}`; return u.href; };

// ── 시작과 로그인 ───────────────────────────────────────────────────────
const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
async function boot() {
  if (!CFG) { show('noConfig'); return; }
  try {
    await load(SDK + 'firebase-app-compat.js');
    await Promise.all([load(SDK + 'firebase-auth-compat.js'), load(SDK + 'firebase-firestore-compat.js')]);
  } catch { say('Firebase를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.', true); return; }
  const app = firebase.initializeApp(CFG);
  const auth = app.auth(), db = app.firestore();
  if (CFG.emulator) { auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true }); db.useEmulator('127.0.0.1', 8080); $('#emuIn').hidden = false; }
  fb = { auth, db, FV: firebase.firestore.FieldValue };
  auth.onAuthStateChanged(u => {
    me = u;
    $('#signOut').hidden = !u || u.isAnonymous;
    $('#who').textContent = u && !u.isAnonymous ? u.email || '' : '';
    if (!u || u.isAnonymous) { stopRoom(); show('signIn'); return; }
    if (!u.emailVerified || !ADMINS.includes(String(u.email).toLowerCase())) { stopRoom(); $('#deniedEmail').textContent = u.email || '이'; show('denied'); return; }
    show(['roomsPanel']); loadRooms();
  });
}
$('#googleIn').onclick = async () => {
  const p = new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account', login_hint: ADMINS[0] || '' });
  setState($('#signState'), '로그인 창을 열었어요…');
  try { await fb.auth.signInWithPopup(p); setState($('#signState'), ''); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') { await fb.auth.signInWithRedirect(p); return; }
    setState($('#signState'), e.code === 'auth/popup-closed-by-user' ? '로그인 창이 닫혔어요. 다시 눌러 주세요.' : '로그인하지 못했어요. 잠시 뒤 다시 해 주세요.', true);
  }
};
/* 에뮬레이터 전용: 구글 창 없이 진행자 계정으로 로그인합니다(테스트용). */
$('#emuIn').onclick = () => fb.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(
  JSON.stringify({ sub: 'test-admin', email: ADMINS[0], email_verified: true })));
$('#signOut').onclick = () => fb.auth.signOut();
$('#deniedOut').onclick = () => fb.auth.signOut();

// ── 수업방 목록과 만들기 ─────────────────────────────────────────────────
async function loadRooms(selectCode) {
  try {
    const s = await fb.db.collection('rooms').where('ownerUid', '==', me.uid).get();
    rooms = s.docs.map(d => ({ code: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  } catch { setState($('#roomsState'), '수업방 목록을 불러오지 못했어요. 새로고침해 주세요.', true); rooms = []; }
  paintRooms();
  const want = selectCode || (room && room.code) || sessionStorage.getItem('ws-admin-room');
  const pick = rooms.find(r => r.code === want) || rooms[0];
  if (pick) openRoom(pick.code);
}
function paintRooms() {
  $('#rooms').innerHTML = rooms.length ? rooms.map(r => `<button type="button" data-room="${esc(r.code)}" class="${room && room.code === r.code ? 'on' : ''}"><b>${esc(r.code)}</b><span>${esc(r.title || '이름 없는 수업방')}</span><span>${r.createdAt ? new Date(ms(r.createdAt)).toLocaleDateString('ko-KR') : ''}${r.open === false ? ' · 들어오기 막힘' : ''}</span></button>`).join('')
    : '<span class="hint">아직 만든 수업방이 없어요. 아래에서 새 수업방을 만들어 주세요.</span>';
}
$('#rooms').addEventListener('click', e => { const b = e.target.closest('[data-room]'); if (b) openRoom(b.dataset.room); });
$('#newRoom').addEventListener('submit', async e => {
  e.preventDefault();
  $('#newBtn').disabled = true; setState($('#roomsState'), '수업방을 만드는 중이에요…');
  try {
    let code = '';
    for (let i = 0; i < 12 && !code; i++) {
      const c = String(Math.floor(1000 + Math.random() * 9000));
      if (!(await fb.db.doc(`rooms/${c}`).get()).exists) code = c;
    }
    if (!code) throw new Error();
    await fb.db.doc(`rooms/${code}`).set({ title: $('#newTitle').value.trim().slice(0, 40), ownerUid: me.uid, ownerEmail: me.email,
      createdAt: fb.FV.serverTimestamp(), open: true, step: null, timerEnd: null });
    $('#newTitle').value = '';
    setState($('#roomsState'), `수업방 ${code}을(를) 만들었어요.`);
    await loadRooms(code);
  } catch { setState($('#roomsState'), '수업방을 만들지 못했어요. 잠시 뒤 다시 해 주세요.', true); }
  $('#newBtn').disabled = false;
});

// ── 수업방 열기: 실시간 구독 ─────────────────────────────────────────────
function stopRoom() { unsubRoom.forEach(f => f()); unsubRoom = []; }
function openRoom(code) {
  stopRoom();
  room = rooms.find(r => r.code === code) || { code };
  sessionStorage.setItem('ws-admin-room', code);
  people = []; works = []; likes = {}; survey = []; roomData = {};
  paintRooms(); show(['roomsPanel', 'dash']);
  $('#code').textContent = code;
  $('#joinUrl').textContent = joinUrl(code);
  const qr = $('#qr'); qr.innerHTML = '';
  if (window.QRCode) new QRCode(qr, { text: joinUrl(code), width: 280, height: 280, colorDark: '#0B2545', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
  else qr.textContent = 'QR을 불러오지 못했어요.';
  const ref = fb.db.doc(`rooms/${code}`);
  const err = () => say('실시간 연결이 끊겼어요. 새로고침해 주세요.', true);
  unsubRoom.push(ref.onSnapshot(d => { roomData = d.data() || {}; paintRoomBits(); }, err));
  unsubRoom.push(ref.collection('people').onSnapshot(s => { people = s.docs.map(d => ({ id: d.id, ...d.data() })); paint(); }, err));
  unsubRoom.push(ref.collection('works').onSnapshot(s => { works = s.docs.map(d => ({ id: d.id, ...d.data() })); paint(); }, err));
  unsubRoom.push(ref.collection('likes').onSnapshot(s => { likes = {}; s.docs.forEach(d => { likes[d.id] = d.data().ids || []; }); paint(); }, err));
  unsubRoom.push(ref.collection('survey').onSnapshot(s => { survey = s.docs.map(d => d.data()); paint(); }, err));
  say('실시간으로 보고 있어요.');
}
$('#stepSel').innerHTML = STEPS.map(([id, n, t]) => `<option value="${id}">${n} · ${t}</option>`).join('');
function paintRoomBits() {
  $('#roomTitle').textContent = roomData.title || '이름 없는 수업방';
  const open = roomData.open !== false;
  $('#closedTag').hidden = open;
  $('#toggleOpen').textContent = open ? '새로 들어오기 막기' : '새로 들어오기 다시 열기';
  const st = roomData.step && STEPS.find(s => s[0] === roomData.step.id);
  $('#stepNow').textContent = st ? `${ago(roomData.step.at)} 「${st[1]} · ${st[2]}」을(를) 열었어요.` : '아직 연 쪽이 없어요. 연수생은 각자 자유롭게 넘겨요.';
  paintTimer();
}
let timerTick = null;
function paintTimer() {
  clearInterval(timerTick);
  const draw = () => {
    const left = Math.round(((roomData.timerEnd || 0) - Date.now()) / 1000);
    $('#timerNow').textContent = roomData.timerEnd ? (left > 0 ? `남은 시간 ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}` : '타이머가 끝났어요.') : '타이머가 꺼져 있어요.';
    if (!roomData.timerEnd || left <= 0) clearInterval(timerTick);
  };
  draw(); timerTick = setInterval(draw, 1000);
}
$('#stepGo').onclick = async () => {
  try { await fb.db.doc(`rooms/${room.code}`).update({ step: { id: $('#stepSel').value, at: Date.now() } }); setState($('#dashState'), '모두에게 열었어요. 글을 쓰는 중인 사람에게는 버튼으로 알려요.'); }
  catch { setState($('#dashState'), '열지 못했어요. 다시 눌러 주세요.', true); }
};
$$('[data-t]').forEach(b => b.onclick = async () => {
  const sec = Number(b.dataset.t);
  try { await fb.db.doc(`rooms/${room.code}`).update({ timerEnd: sec ? Date.now() + sec * 1000 : null }); }
  catch { setState($('#dashState'), '타이머를 바꾸지 못했어요.', true); }
});
$('#toggleOpen').onclick = async () => {
  try { await fb.db.doc(`rooms/${room.code}`).update({ open: roomData.open === false }); await loadRooms(room.code); }
  catch { setState($('#dashState'), '바꾸지 못했어요.', true); }
};
$('#copyJoin').onclick = () => copy(joinUrl(room.code), $('#dashState'), '연수생용 주소를 복사했어요.');

// ── 그리기 ──────────────────────────────────────────────────────────────
let paintJob = null;
function paint() {
  if (paintJob) return;
  paintJob = setTimeout(() => { paintJob = null; paintNow(); }, 120);
}
function paintNow() {
  people.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  paintTiles(); paintFlow();
  if (tab === 'people') paintPeople();
  if (tab === 'answers') paintAnswers();
  if (tab === 'works') paintWorks();
  if (tab === 'survey') paintSurvey();
}
function deployText(p) {
  const d = p.deploy || {}, t = ['canva','gemini','firebase','netlify'].includes(d.tab) ? d.tab : 'netlify', c = d[t] || { done: 0, total: t === 'firebase' ? 9 : t === 'gemini' ? 4 : 6 };
  return { label: ({canva:'Canva 게시',gemini:'Canvas 공유',firebase:'Firebase',netlify:'HTML 배포'})[t], done: c.done || 0, total: c.total || 1, finished: (c.done || 0) >= (c.total || 1) };
}
function paintTiles() {
  const n = people.length, on = people.filter(online).length;
  const deployed = people.filter(p => deployText(p).finished || (p.work && p.work.url)).length;
  const stars = survey.filter(s => s.star > 0), avg = stars.length ? (stars.reduce((a, s) => a + s.star, 0) / stars.length).toFixed(1) : '–';
  const tiles = [['참가', n, '명'], ['지금 접속', on, `명 / ${n}명`], ['배포 마침', deployed, '명'], ['작품 올림', works.length, '편'], ['설문 평균', avg, `★ · ${stars.length}명 응답`]];
  $('#tiles').innerHTML = tiles.map(([l, v, u]) => `<div class="tile2"><span>${l}</span><b>${v}</b><small>${u}</small></div>`).join('');
}
function paintFlow() {
  const counts = STEPS.map(([id]) => people.filter(p => p.stepId === id));
  const max = Math.max(1, ...counts.map(c => c.length));
  $('#flow').innerHTML = STEPS.map(([id, n], i) => `<div title="${esc(counts[i].map(p => p.name).join(', ') || '없음')}">
    <span class="n">${counts[i].length}</span><span class="bar"><i style="height:${Math.round(counts[i].length / max * 100)}%"></i></span><span class="l">${n}</span></div>`).join('');
}
function paintPeople() {
  if (!people.length) { $('#peopleRows').innerHTML = `<tr><td colspan="8" class="muted">아직 들어온 연수생이 없어요. 위의 QR이나 주소를 나눠 주세요.</td></tr>`; return; }
  $('#peopleRows').innerHTML = people.map(p => {
    const seen = new Set(p.seen || []), d = deployText(p), q = p.quiz || {}, cur = STEPS.find(s => s[0] === p.stepId);
    return `<tr data-pid="${esc(p.id)}">
      <td><span class="pname"><i class="dot${online(p) ? ' on' : ''}" title="${online(p) ? '접속 중' : '접속 안 함'}"></i>${esc(p.name || '이름 없음')}</span></td>
      <td>${cur ? `${cur[1]} · ${esc(cur[2])}` : '<span class="muted">아직 없음</span>'}</td>
      <td><span class="seen">${STEPS.map((s, i) => `<i class="${s[0] === p.stepId ? 'c' : seen.has(i) ? 'y' : ''}" title="${s[1]}"></i>`).join('')}</span></td>
      <td><span class="meter"><span><i style="width:${Math.round(d.done / d.total * 100)}%"></i></span>${d.label} ${d.done}/${d.total}</span></td>
      <td>${p.work && p.work.url ? `<a href="${esc(p.work.url)}" target="_blank" rel="noopener">${esc(p.work.name || '열기')} ↗</a>` : '<span class="muted">아직</span>'}</td>
      <td class="num">${q.done ? `${q.right}/${q.total}` : '<span class="muted">–</span>'}</td>
      <td>${p.surveyDone ? '냈어요' : '<span class="muted">아직</span>'}</td>
      <td class="num">${ago(p.updatedAt)}</td></tr>`;
  }).join('');
}
$('#peopleRows').addEventListener('click', e => {
  if (e.target.closest('a')) return;
  const tr = e.target.closest('[data-pid]'); if (tr) openPerson(tr.dataset.pid);
});
let personId = null;
function openPerson(id) {
  const p = people.find(x => x.id === id); if (!p) return;
  personId = id;
  const a = p.answers || {}, d = deployText(p), q = p.quiz || {}, cur = STEPS.find(s => s[0] === p.stepId);
  $('#pName').textContent = p.name || '이름 없음';
  const rows = [
    ['마지막 활동', `${ago(p.updatedAt)}${online(p) ? ' (접속 중)' : ''}`],
    ['지금 보는 쪽', cur ? `${cur[1]} · ${cur[2]}` : '아직 없음'],
    ['본 쪽', (p.seen || []).map(i => STEPS[i] ? STEPS[i][1] : '').filter(Boolean).join(', ') || '없음'],
    ['배포', `${d.label} ${d.done}/${d.total}단계`],
    ['작품', p.work && p.work.url ? `${p.work.name} (${p.work.url})` : '아직 없음'],
    ['퀴즈', q.done ? `${q.total}문제 중 ${q.right}개 맞힘` : '아직 안 풂'],
    ...QS.map(([f, label]) => [label, f === 'worry' ? String(a[f] || '').split(',').filter(Boolean).join(', ') : a[f]]).filter(r => r[1]),
    ...(a.pl ? [['만드는 방식', a.pl]] : [])
  ];
  $('#pBody').innerHTML = `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  $('#pDelete').textContent = '이 참가자 지우기'; $('#pDelete').classList.remove('arm');
  $('#personBox').showModal();
}
$('#pDelete').onclick = async () => {
  const b = $('#pDelete');
  if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = '정말 지울까요? 한 번 더 눌러 주세요'; return; }
  try { await fb.db.doc(`rooms/${room.code}/people/${personId}`).delete(); $('#personBox').close(); }
  catch { b.textContent = '지우지 못했어요'; }
};

$('#qSel').innerHTML = QS.map(([f, label]) => `<option value="${f}">${esc(label)}</option>`).join('');
$('#qSel').addEventListener('change', paintAnswers);
function answersFor(f) { return people.map(p => ({ name: p.name || '이름 없음', v: String((p.answers || {})[f] || '').trim() })).filter(x => x.v); }
function bars(entries, total) {
  const max = Math.max(1, ...entries.map(e => e[1]));
  return `<div class="bars">${entries.map(([k, n]) => `<div><span>${esc(k)}</span><span class="track"><i style="width:${Math.round(n / max * 100)}%"></i></span><em>${n}명</em></div>`).join('')}</div>` +
    `<p class="hint">${total}명이 답했어요.</p>`;
}
function paintAnswers() {
  const [f, , type] = QS.find(q => q[0] === $('#qSel').value) || QS[0];
  const list = answersFor(f);
  if (!list.length) { $('#answerView').innerHTML = '<p class="hint">아직 이 질문에 답한 사람이 없어요.</p>'; return; }
  if (type) {
    const c = {};
    list.forEach(x => (type === 'multi' ? x.v.split(',') : [x.v]).filter(Boolean).forEach(o => { c[o] = (c[o] || 0) + 1; }));
    $('#answerView').innerHTML = bars(Object.entries(c).sort((a, b) => b[1] - a[1]), list.length);
  } else {
    $('#answerView').innerHTML = `<div class="cards">${list.map(x => `<div class="acard"><b>${esc(x.name)}</b><p>${esc(x.v)}</p></div>`).join('')}</div>`;
  }
}
$('#copyAnswers').onclick = () => {
  const [f, label] = QS.find(q => q[0] === $('#qSel').value) || QS[0];
  const list = answersFor(f);
  copy(`[${label}]\n` + (list.map(x => `${x.name}: ${f === 'worry' ? x.v.split(',').join(', ') : x.v}`).join('\n') || '(아직 답이 없어요)'), $('#dashState'), '이 질문의 답을 복사했어요.');
};
function paintWorks() {
  const n = {}; Object.values(likes).forEach(ids => ids.forEach(id => { n[id] = (n[id] || 0) + 1; }));
  const list = works.map(w => ({ ...w, likes: n[w.id] || 0 })).sort((a, b) => b.likes - a.likes || ms(b.updatedAt) - ms(a.updatedAt));
  $('#worksView').innerHTML = list.length ? list.map(w => `<div class="work">
      <div class="tile" style="--h:${200 + ([...String(w.name)].reduce((a, c) => a + c.charCodeAt(0), 0) % 30)}"><b>${esc([...String(w.name || '?')][0])}</b>${w.shot ? `<img src="${esc(w.shot)}" alt="">` : ''}</div>
      <div class="info"><span class="name">${esc(w.name)}</span><span class="maker">${esc(w.maker || '')}</span>${w.desc ? `<span class="desc">${esc(w.desc)}</span>` : ''}
        <div class="acts"><a class="pill" href="${esc(w.url)}" target="_blank" rel="noopener">해 보기 ↗</a><span class="pill like on">♥ ${w.likes}</span></div></div></div>`).join('')
    : '<div class="empty">아직 올라온 작품이 없어요. 연수생이 8쪽에서 올리면 여기에 바로 나타나요.</div>';
}
function paintSurvey() {
  const done = survey.filter(s => s.star > 0 || (s.s2 || '').trim() || (s.s3 || '').trim());
  if (!done.length) { $('#surveyView').innerHTML = '<p class="hint">아직 설문에 답한 사람이 없어요. 설문은 이름 없이 모여요.</p>'; return; }
  const dist = [5, 4, 3, 2, 1].map(k => [`${'★'.repeat(k)}`, done.filter(s => s.star === k).length]);
  const good = done.map(s => (s.s2 || '').trim()).filter(Boolean), more = done.map(s => (s.s3 || '').trim()).filter(Boolean);
  const list = (t, xs) => `<h3 class="sub" style="font-size:16px;margin:18px 0 8px">${t} (${xs.length})</h3>` + (xs.length ? `<div class="cards">${xs.map(x => `<div class="acard"><p>${esc(x)}</p></div>`).join('')}</div>` : '<p class="hint">아직 없어요.</p>');
  $('#surveyView').innerHTML = bars(dist, done.length) + list('좋았던 점', good) + list('아쉬웠던 점이나 더 배우고 싶은 것', more);
}
$('#copyTable').onclick = () => {
  const head = ['이름', '지금 보는 쪽', '본 쪽 수', '배포 방법', '배포 단계', '작품 이름', '작품 주소', '퀴즈', '설문', '마지막 활동'];
  const rows = people.map(p => {
    const d = deployText(p), q = p.quiz || {}, cur = STEPS.find(s => s[0] === p.stepId);
    return [p.name, cur ? `${cur[1]} ${cur[2]}` : '', (p.seen || []).length, d.label, `${d.done}/${d.total}`, p.work ? p.work.name : '', p.work ? p.work.url : '', q.done ? `${q.right}/${q.total}` : '', p.surveyDone ? '냄' : '', ago(p.updatedAt)];
  });
  copy([head, ...rows].map(r => r.map(c => String(c ?? '').replace(/\s+/g, ' ')).join('\t')).join('\n'), $('#dashState'), '진행표를 복사했어요. 스프레드시트에 붙여 넣으세요.');
};

$$('.tabs [data-tab]').forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  $$('.tabs [data-tab]').forEach(x => x.setAttribute('aria-selected', x === b));
  $$('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== tab; });
  paint();
});
$$('dialog [data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
setInterval(() => { if (room && !document.hidden) { paintTiles(); paintPeople(); paintRoomBits(); } }, 30000);   // "n분 전"을 새로 그립니다

boot();
window.WSAdmin = { get people() { return people; }, get room() { return room; } };
})();
