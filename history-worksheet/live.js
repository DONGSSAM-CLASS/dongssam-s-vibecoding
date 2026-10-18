'use strict';
/* 수업방 연결. firebase-config.js에 설정이 있을 때만 켜지고, 없으면 아무것도 하지 않습니다.
   - 연수생은 익명 로그인으로 들어와 rooms/{번호}/people/{내 uid}에 진행 상황을 씁니다.
   - 작품은 rooms/{번호}/works/{uid}, 좋아요는 likes/{uid}, 설문은 survey/{uid}(이름 없이)에 씁니다.
   - 진행자가 rooms/{번호} 문서에 연 쪽(step)과 타이머(timerEnd)를 쓰면 여기서 따라갑니다. */
(function () {
  const CFG = window.WS_FIREBASE, W = window.WS;
  if (!CFG || !W) return;
  const { $, store, say, toast, setState } = W;
  const ROOM_KEY = 'blue-hist-room', SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const SENT = ['n0', 'pain', 'c1', 'best', 'fun', 'c2', 'worry', 'c4', 'p1', 'p5', 'p6'];
  const LOCAL_WORK_HINT = $('#workHint').textContent, LOCAL_SURVEY_HINT = $('#surveyHint').textContent;
  $('#roomBtn').hidden = false;

  let fb = null, room = store.get(ROOM_KEY, null), unsubs = [], liveWorks = [], likeDocs = {}, myLikes = [];
  let lastStepAt = store.get(ROOM_KEY + '-stepAt', 0), lastTimer = null, syncJob = null, surveyJob = null, broken = false, worksReady = false;

  const load = src => new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Firebase를 불러오지 못했어요.'));
    document.head.append(s);
  });
  async function boot() {
    if (fb) return fb;
    if (!window.firebase) {
      await load(SDK + 'firebase-app-compat.js');
      await Promise.all([load(SDK + 'firebase-auth-compat.js'), load(SDK + 'firebase-firestore-compat.js')]);
    }
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(CFG);
    const auth = app.auth(), db = app.firestore();
    if (CFG.emulator && !boot.emu) { auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true }); db.useEmulator('127.0.0.1', 8080); boot.emu = true; }
    const user = await new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u); }); });
    if (!user) await auth.signInAnonymously();
    fb = { auth, db, uid: auth.currentUser.uid, FV: firebase.firestore.FieldValue };
    return fb;
  }
  const roomRef = () => fb.db.doc(`rooms/${room.code}`);
  const sub = name => roomRef().collection(name);
  const withTimeout = (p, ms = 10000) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('연결이 느려요. 잠시 뒤 다시 해 주세요.')), ms))]);

  // ── 수업방 들어가기와 나가기 ───────────────────────────────────────────
  function paintRoom() {
    const chip = $('#roomChip');
    chip.hidden = !room;
    document.body.classList.toggle('inroom', !!room);
    $('#roomBtn').textContent = room ? `수업방 ${room.code}` : '수업방 들어가기';
    if (room) { chip.textContent = `수업방 ${room.code} · ${room.name}`; chip.classList.toggle('off', broken); }
    $('#workHint').textContent = room ? '수업방에 들어와 있어서, 올린 작품이 모든 선생님의 갤러리에 바로 나타나요. 작품은 한 사람에 하나씩이고, 다시 올리면 바뀌어요.' : LOCAL_WORK_HINT;
    $('#surveyHint').textContent = room ? '수업방에 들어와 있어서, 별점과 의견이 이름 없이 진행자에게 바로 전달돼요.' : LOCAL_SURVEY_HINT;
  }
  function openRoomBox(code) {
    $('#roomForm').hidden = !!room; $('#roomIn').hidden = !room;
    if (room) { $('#roomInCode').textContent = room.code; $('#roomInName').textContent = room.name; }
    else {
      $('#roomCode').value = code || $('#roomCode').value;
      $('#roomName').value = $('#roomName').value || store.get(ROOM_KEY + '-name', '') || W.answers['work-maker'] || '';
      setState($('#roomState'), '');
    }
    if (!$('#roomBox').open) $('#roomBox').showModal();
    setTimeout(() => (room ? $('#roomLeave') : (code ? $('#roomName') : $('#roomCode'))).focus(), 30);
  }
  $('#roomBtn').addEventListener('click', () => { $('#moreMenu').hidden = true; openRoomBox(); });
  $('#roomChip').addEventListener('click', () => openRoomBox());

  $('#roomForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#roomCode').value.replace(/\D/g, ''), name = $('#roomName').value.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (code.length !== 4) { setState($('#roomState'), '수업방 번호는 숫자 네 자리예요.', true); $('#roomCode').focus(); return; }
    if (!name) { setState($('#roomState'), '이름을 써 주세요.', true); $('#roomName').focus(); return; }
    $('#roomGo').disabled = true; setState($('#roomState'), '들어가는 중이에요…');
    try {
      await withTimeout(boot());
      const snap = await withTimeout(fb.db.doc(`rooms/${code}`).get());
      if (!snap.exists) throw new Error('그 번호의 수업방이 없어요. 번호를 다시 확인해 주세요.');
      if (snap.data().open === false) throw new Error('이 수업방은 닫혔어요. 진행자에게 물어봐 주세요.');
      room = { code, name };
      store.set(ROOM_KEY, room); store.set(ROOM_KEY + '-name', name);
      await withTimeout(sub('people').doc(fb.uid).set({ name, joinedAt: fb.FV.serverTimestamp() }, { merge: true }));
      if (!W.answers['work-maker']) W.setValue('work-maker', name);
      start(); push();
      $('#roomBox').close();
      toast(`수업방 ${code}에 들어왔어요.`);
    } catch (err) {
      setState($('#roomState'), err.code === 'permission-denied' ? '이 수업방에 들어갈 수 없어요. 번호를 다시 확인해 주세요.' : (err.message || '들어가지 못했어요. 잠시 뒤 다시 해 주세요.'), true);
      room = store.get(ROOM_KEY, null);
    }
    $('#roomGo').disabled = false;
  });
  $('#roomLeave').addEventListener('click', () => {
    stop(); room = null; store.del(ROOM_KEY); W.useGallery(null); paintRoom();
    $('#roomBox').close(); say('수업방에서 나왔어요. 답은 계속 이 기기에 저장돼요.');
  });

  // ── 실시간으로 받기 ───────────────────────────────────────────────────
  function stop() { unsubs.forEach(f => f()); unsubs = []; clearTimeout(syncJob); clearTimeout(surveyJob); }
  function start() {
    stop(); liveWorks = []; likeDocs = {}; myLikes = []; worksReady = false;
    paintRoom(); W.useGallery(liveGallery);
    unsubs.push(roomRef().onSnapshot(d => {
      const r = d.data() || {};
      if (r.step && r.step.id && r.step.at > lastStepAt) { lastStepAt = r.step.at; store.set(ROOM_KEY + '-stepAt', lastStepAt); W.offerStep(r.step.id); }
      const t = r.timerEnd || null;
      if (t !== lastTimer) { lastTimer = t; if (t && t > Date.now()) W.startTimer(t); else if (!t) W.stopTimer(); }
    }, fail));
    unsubs.push(sub('works').onSnapshot(s => {
      liveWorks = s.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() || Date.now()) - (a.updatedAt?.toMillis?.() || Date.now()));
      worksReady = true;
      countLikes(); W.paintGallery(); schedule(0);
    }, fail));
    unsubs.push(sub('likes').onSnapshot(s => {
      likeDocs = {}; s.docs.forEach(d => { likeDocs[d.id] = d.data().ids || []; });
      myLikes = likeDocs[fb.uid] || []; countLikes(); W.paintGallery();
    }, fail));
  }
  function countLikes() {
    const n = {}; Object.values(likeDocs).forEach(ids => ids.forEach(id => { n[id] = (n[id] || 0) + 1; }));
    liveWorks.forEach(w => { w.likes = n[w.id] || 0; w.liked = myLikes.includes(w.id); });
  }
  function fail(err) {
    broken = true; paintRoom();
    say(err && err.code === 'permission-denied' ? '수업방에 접근할 수 없어요. 수업방에서 나갔다가 다시 들어와 주세요.' : '수업방 연결이 잠시 끊겼어요. 답은 이 기기에 계속 저장돼요.', true);
  }
  function ok() { if (broken) { broken = false; paintRoom(); say('수업방에 다시 연결됐어요.'); } }

  const liveGallery = {
    live: true,
    items: () => liveWorks,
    canEdit: w => !!fb && w.id === fb.uid,
    newId: () => fb.uid,
    async save(item) {
      const { id, likes, liked, ...data } = item;
      if ((data.shot || '').length > 380000) data.shot = '';
      await withTimeout(sub('works').doc(fb.uid).set({ ...data, shot: data.shot || '', maker: data.maker || room.name, updatedAt: fb.FV.serverTimestamp() }));
    },
    async remove(id) { if (id === fb.uid) await withTimeout(sub('works').doc(id).delete()); },
    async like(id) {
      const set = new Set(myLikes); if (set.has(id)) set.delete(id); else set.add(id);
      myLikes = [...set]; likeDocs[fb.uid] = myLikes; countLikes();
      await sub('likes').doc(fb.uid).set({ ids: myLikes });
    }
  };

  // ── 진행 상황 보내기 ──────────────────────────────────────────────────
  function schedule(ms = 1200) { if (!room || !fb) return; clearTimeout(syncJob); syncJob = setTimeout(push, ms); }
  async function push() {
    if (!room || !fb) return;
    const a = W.answers, i = W.stepIndex, step = W.steps[i];
    const ans = {};
    SENT.forEach(f => { const v = String(a[f] || '').trim(); if (v) ans[f] = v.slice(0, 2000); });
    const kind = (window.PromptKit.KINDS.find(k => k.id === a.pk) || window.PromptKit.KINDS[0]);
    if (a.p9) { ans.pk = kind.n; ans.pl = a.pl === 'adv' ? '심화' : '기초'; }
    const mine = liveWorks.find(w => w.id === fb.uid);
    try {
      await sub('people').doc(fb.uid).set({
        name: room.name, updatedAt: fb.FV.serverTimestamp(),
        stepIndex: i, stepId: step.dataset.step, stepTitle: step.dataset.title, seen: W.seen,
        answers: ans, deploy: { tab: a.dtab === 'firebase' ? 'firebase' : 'netlify', ...W.deployCounts() },
        quiz: W.quizScore(), surveyDone: !!(a.star || String(a.s2 || '').trim() || String(a.s3 || '').trim()),
        ...(worksReady ? { work: mine ? { name: mine.name, url: mine.url } : null } : {})
      }, { merge: true });
      ok();
    } catch (err) { fail(err); }
  }
  async function pushSurvey() {
    if (!room || !fb) return;
    const a = W.answers;
    try {
      await sub('survey').doc(fb.uid).set({ star: Number(a.star || 0), s2: String(a.s2 || '').slice(0, 2000), s3: String(a.s3 || '').slice(0, 2000), updatedAt: fb.FV.serverTimestamp() });
    } catch (err) { fail(err); }
  }
  document.addEventListener('ws:change', e => {
    if (['star', 's2', 's3'].includes(e.detail)) { clearTimeout(surveyJob); surveyJob = setTimeout(pushSurvey, 1500); }
    schedule();
  });
  ['ws:step', 'ws:quiz', 'ws:cleared'].forEach(t => document.addEventListener(t, () => schedule(400)));
  document.addEventListener('ws:work', () => schedule(1500));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(syncJob); push(); } else schedule(200); });
  setInterval(() => { if (!document.hidden) schedule(0); }, 60000);   // 1분마다 "아직 있어요"

  // ── 시작 ──────────────────────────────────────────────────────────────
  const urlCode = (new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '').slice(0, 4);
  paintRoom();
  if (room && (!urlCode || urlCode === room.code)) {
    boot().then(() => { start(); push(); }).catch(fail);
  } else if (urlCode.length === 4) {
    if (room) { stop(); room = null; store.del(ROOM_KEY); paintRoom(); }
    openRoomBox(urlCode);
  }
  window.WSLive = { push, get room() { return room; } };
})();
