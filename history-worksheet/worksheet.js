'use strict';
/* 역사 웹앱 워크숍 학습지. 서버가 없어도 이 파일만으로 돌아갑니다.
   ① 쓴 답은 이 브라우저에 저장 ② 한 쪽씩 보기와 타이머 ③ 고른 대로 프롬프트를 짜 줌(AI를 부르지 않음)
   ④ 작품 카드와 좋아요 갤러리 ⑤ 바로 채점되는 퀴즈 ⑥ 별점 설문
   수업방에 들어오면 live.js가 WS의 갈고리를 써서 진행 상황을 진행자에게 보냅니다. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const emit = (type, detail) => document.dispatchEvent(new CustomEvent('ws:' + type, { detail }));

// ── 저장 ────────────────────────────────────────────────────────────────
const KEY = 'blue-hist-ws', WORKS = 'blue-hist-works', QUIZ = 'blue-hist-quiz';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
function say(t, warn) { const n = $('#saveStatus'); n.textContent = t; n.classList.toggle('warn', !!warn); }
function setState(el, t, warn) { if (!el) return; el.textContent = t; el.classList.toggle('warn', !!warn); }
let toastJob = null;
function toast(t) {
  const n = $('#toast'); n.textContent = t; n.hidden = false;
  clearTimeout(toastJob); toastJob = setTimeout(() => { n.hidden = true; }, 3200);
}

let answers = store.get(KEY, {}) || {};
if (!answers || typeof answers !== 'object' || Array.isArray(answers)) answers = {};
if (!['canva','gemini','codex','claude'].includes(answers.tool)) answers.tool = answers.pl === 'adv' ? 'codex' : 'gemini';
function save() {
  if (store.set(KEY, answers)) say('이 브라우저에 저장했어요. 공용 기기라면 끝나고 답을 지워 주세요.');
  else say('이 브라우저는 저장이 꺼져 있어요. [내 답 모두 복사]로 옮겨 두세요.', true);
}
function setValue(field, value) {
  answers[field] = value;
  $$(`[data-save="${field}"]`).forEach(el => { if (el.value !== value) el.value = value; });
  paintPicks();
  save();
  emit('change', field);
}
$$('[data-save]').forEach(el => {
  const f = el.dataset.save;
  if (answers[f] != null) el.value = answers[f];
  el.addEventListener('input', () => setValue(f, el.value));
});
const get = f => String(answers[f] || '').trim().replace(/\s+/g, ' ');

// ── 고르기 칩 ────────────────────────────────────────────────────────────
$$('.pick').forEach(box => {
  const field = box.dataset.pick, multi = !!box.dataset.multi;
  const opts = document.createElement('div');
  opts.className = 'chips';
  opts.innerHTML = box.dataset.options.split('|').map(o => `<button type="button" data-opt="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join('');
  box.append(opts);
  opts.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const o = b.dataset.opt;
    if (multi) {
      const list = String(answers[field] || '').split(',').filter(Boolean);
      const at = list.indexOf(o);
      if (at >= 0) list.splice(at, 1); else list.push(o);
      setValue(field, list.join(','));
    } else setValue(field, answers[field] === o ? '' : o);
  });
});
function paintPicks() {
  $$('.pick').forEach(box => {
    const list = String(answers[box.dataset.pick] || '').split(',');
    $$('.chips button', box).forEach(b => { const on = list.includes(b.dataset.opt); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  });
}
paintPicks();

// ── 복사 ────────────────────────────────────────────────────────────────
function openCopyBox(text) {
  $('#copyText').value = text;
  $('#copyBox').showModal();
  setTimeout(() => { $('#copyText').focus(); $('#copyText').select(); }, 30);
}
async function copyText(text, stateEl, okMsg = '복사했어요.') {
  if (!String(text).trim()) { setState(stateEl, '먼저 답을 써 주세요.', true); return false; }
  try { await navigator.clipboard.writeText(text); setState(stateEl, okMsg); return true; }
  catch { setState(stateEl, '직접 복사하는 창을 열었어요.', true); openCopyBox(text); return false; }
}
const LABELS = { star: '연수 만족도(별점)', tool: '선택한 실습 도구' };
const TOOL_NAMES = { canva:'Canva AI', gemini:'Gemini', codex:'Codex', claude:'Claude Code' };
function labelOf(f) {
  if (LABELS[f]) return LABELS[f];
  const el = $(`[data-save="${f}"]`) || $(`[data-pick="${f}"]`);
  const q = el && (el.closest('.qwrap') || el).querySelector('.q');
  return q ? q.textContent.trim() : f;
}
function answerText(fields) {
  return fields.map(f => {
    const v = f === 'tool' ? TOOL_NAMES[answers.tool] : f === 'star' ? (answers.star ? '★'.repeat(answers.star) + ` (${answers.star}/5)` : '') : String(answers[f] || '').trim();
    return v ? `■ ${labelOf(f)}\n${f === 'worry' ? v.split(',').join(', ') : v}` : '';
  }).filter(Boolean).join('\n\n');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  copyText(answerText(b.dataset.copy.split(',')), b.parentElement.querySelector('[data-state]'));
});
$('#copyAll').onclick = () => {
  closeMenu();
  const fields = ['tool', 'n0', 'pain', 'c1', 'best', 'fun', 'c2', 'worry', 'c4', 'p1', 'p5', 'p6', 'work-name', 'work-url', 'work-desc', 'star', 's2', 's3'];
  const text = answerText(fields);
  if (!text) { say('아직 쓴 답이 없어요.', true); return; }
  copyText('[역사 웹앱 워크숍 학습지: 내 답]\n\n' + text, null).then(ok => { if (ok) say('내 답을 모두 복사했어요.'); });
};

// ── 6쪽 프롬프트 만들기 ─────────────────────────────────────────────────
const PK = window.PromptKit;
const GRADES = ['초등 5–6학년', '중학교 1학년', '중학교 2학년', '중학교 3학년', '고등학교'];
const MINS = ['10분', '15분', '20분', '한 차시(45분)'];
const OWN = '직접 쓰기';
const pkKind = () => PK.KINDS.find(k => k.id === answers.pk) || PK.KINDS.find(k => k.id === 'quiz') || PK.KINDS[0];
const pkLevel = () => ['codex','claude'].includes(answers.tool) && answers.pl === 'adv' ? 'adv' : 'basic';
const pkVal = (key, def) => { const c = answers[key] || def; return c === OWN ? (String(answers[key + '-own'] || '').trim() || def) : c; };
const pkMulti = (id, def) => String(answers['x-' + id] ?? def).split(',').map(x => x.trim()).filter(Boolean);
function sel(key, label, opts, def) {
  const cur = answers[key] || def;
  return `<label class="qwrap"><span class="q">${label}</span><select class="line" id="s-${key}" data-pks="${key}">` +
    [...opts, OWN].map(o => `<option${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('') + '</select>' +
    (cur === OWN ? `<input class="line" id="o-${key}" data-pko="${key}" placeholder="직접 써 주세요" value="${esc(answers[key + '-own'] || '')}">` : '') + '</label>';
}
function paintPk() {
  const kind = pkKind();
  $('#pkKind').innerHTML = [...new Set(PK.KINDS.map(k => k.g))].map(g => `<optgroup label="${g}">` +
    PK.KINDS.filter(k => k.g === g).map(k => `<option value="${k.id}"${k === kind ? ' selected' : ''}>${k.n}</option>`).join('') + '</optgroup>').join('');
  $('#pkDesc').textContent = kind.d;
  $('#pkGrade').innerHTML = sel('pg', '대상', GRADES, '중학교 2학년');
  $('#pkMins').innerHTML = sel('pm', '수업에서 쓸 시간', MINS, '15분');
  $('#pkLook').innerHTML = sel('ps', '디자인', PK.STYLES.map(s => s[0]), PK.STYLES[0][0]);
  $('#pkExtra').innerHTML = (kind.x || []).map(([id, label, opts, def, multi]) => multi
    ? `<div class="qwrap"><span class="q">${label}</span><div class="multi">${opts.map(o => {
        const n = pkMulti(id, def).indexOf(o) + 1;
        return `<button type="button" data-pkm="${id}" data-opt="${esc(o)}" class="${n ? 'on' : ''}" aria-pressed="${!!n}">${n ? `<i>${n}</i>` : ''}${esc(o)}</button>`;
      }).join('')}</div><input class="line" id="x-${id}-own" data-pkx="${id}-own" placeholder="다른 장을 직접 쓰기(쉼표로 구분)" value="${esc(answers['x-' + id + '-own'] || '')}"></div>`
    : opts ? sel('x-' + id, label, opts, def)
    : id === 'idea'
      ? `<label class="qwrap"><span class="q">${label}</span><textarea id="x-${id}" data-pkx="${id}" placeholder="${esc(def)}">${esc(answers['x-' + id] || '')}</textarea></label>`
      : `<label class="qwrap"><span class="q">${label}</span><input class="line" id="x-${id}" data-pkx="${id}" placeholder="${esc(def)}" value="${esc(answers['x-' + id] || '')}"></label>`).join('');
  $('#pkExtra').hidden = !(kind.x || []).length;
  $$('#pkLevel [data-pl]').forEach(b => { const on = b.dataset.pl === pkLevel(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function paintPkLen() { $('#pkLen').textContent = answers.p9 ? `(${answers.p9.length.toLocaleString()}자)` : ''; }
function buildPk() {
  const kind = pkKind();
  const v = { topic: get('p1') || '[주제]', grade: pkVal('pg', '중학교 2학년'), mins: pkVal('pm', '15분'), style: pkVal('ps', PK.STYLES[0][0]),
              question: get('p5'), extra: get('p6') };
  (kind.x || []).forEach(([id, , opts, def, multi]) => {
    v[id] = multi ? [...pkMulti(id, def), ...String(answers['x-' + id + '-own'] || '').split(',').map(x => x.trim()).filter(Boolean)].join(',')
      : opts ? pkVal('x-' + id, def) : String(answers['x-' + id] || '').trim();
  });
  setValue('p9', PK.build(kind, { ...v, tool: answers.tool }, pkLevel()));
  paintPkLen();
  setState($('#buildState'), get('p1') ? '' : '주제를 쓰면 [주제] 자리가 바뀌어요.', !get('p1'));
}
document.addEventListener('click', e => {
  const m = e.target.closest('[data-pkm]');
  if (m) {
    const id = m.dataset.pkm, def = (pkKind().x.find(x => x[0] === id) || [])[3] || '';
    const list = pkMulti(id, def), at = list.indexOf(m.dataset.opt);
    if (at >= 0) list.splice(at, 1); else list.push(m.dataset.opt);
    setValue('x-' + id, list.join(','));
    paintPk(); buildPk(); return;
  }
  const l = e.target.closest('[data-pl]');
  if (l) { setValue('pl', l.dataset.pl); paintPk(); buildPk(); }
});
document.addEventListener('input', e => {
  const x = e.target.closest('[data-pkx]'), o = e.target.closest('[data-pko]');
  if (o) { setValue(o.dataset.pko + '-own', o.value); buildPk(); }
  else if (x) { setValue('x-' + x.dataset.pkx, x.value); buildPk(); }
  else if (['p1', 'p5', 'p6'].includes(e.target.dataset.save)) buildPk();
  else if (e.target.dataset.save === 'p9') paintPkLen();
});
$('#pkKind').addEventListener('change', e => { setValue('pk', e.target.value); paintPk(); buildPk(); });
document.addEventListener('change', e => {
  const s = e.target.closest('[data-pks]'); if (!s) return;
  setValue(s.dataset.pks, s.value); paintPk(); buildPk();
  if (s.value === OWN) { const o = $(`[data-pko="${s.dataset.pks}"]`); if (o) o.focus(); }
});
$('#copyPrompt').onclick = () => copyText(answers.p9 || '', $('#buildState'), '복사했어요. AI 입력창에 붙여 넣으세요.');
/* AI 버튼은 진짜 링크입니다. 누르는 순간 복사하고, 링크는 그대로 새 탭에서 열립니다. */
$$('[data-ai]').forEach(a => a.addEventListener('click', () => {
  const tip = a.dataset.ai === 'gemini' ? '복사했어요. 제미나이에서 [캔버스]를 켜고 붙여 넣으세요.' : '복사했어요. 클로드 입력창에 붙여 넣으세요.';
  navigator.clipboard.writeText(answers.p9 || '').then(() => setState($('#buildState'), tip), () => setState($('#buildState'), '자동 복사가 막혔어요. [복사] 버튼을 먼저 눌러 주세요.', true));
}));
$('#fixChips').innerHTML = PK.FIXES.map((f, i) => `<button type="button" data-fix="${i}">${esc(f[0])}</button>`).join('');
$('#fixChips').addEventListener('click', e => {
  const b = e.target.closest('[data-fix]'); if (!b) return;
  copyText(PK.FIXES[b.dataset.fix][1], $('#buildState'), `「${PK.FIXES[b.dataset.fix][0]}」 문장을 복사했어요. [대괄호] 부분만 바꿔서 쓰세요.`);
});
paintPk();
/* 직접 고쳐 둔 프롬프트는 새로고침해도 덮어쓰지 않습니다. 고르기를 바꿀 때만 다시 짭니다. */
if (!answers.p9) buildPk(); else paintPkLen();

// ── 7쪽 배포: 방법 고르기, 체크, 명령어 복사 ─────────────────────────────
function deployCounts() {
  const out = {};
  $$('[data-dpanel]').forEach(p => {
    const boxes = $$('[data-check]', p);
    out[p.dataset.dpanel] = { done: boxes.filter(b => b.checked).length, total: boxes.length };
  });
  return out;
}
function paintDeploy() {
  const tab = ['canva','gemini','firebase','netlify'].includes(answers.dtab) ? answers.dtab : (answers.tool === 'canva' ? 'canva' : answers.tool === 'gemini' ? 'gemini' : 'firebase');
  $$('[data-dtab]').forEach(b => { const on = b.dataset.dtab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  $$('[data-dpanel]').forEach(p => { p.hidden = p.dataset.dpanel !== tab; });
  const c = deployCounts();
  $$('[data-dpanel]').forEach(p => {
    const { done, total } = c[p.dataset.dpanel];
    setState($('[data-dstate]', p), done === total ? '배포를 마쳤어요! 8쪽에서 작품 카드를 만들어요.' : `${total}단계 중 ${done}단계를 마쳤어요.`);
  });
}
$$('[data-dtab]').forEach(b => b.addEventListener('click', () => { setValue('dtab', b.dataset.dtab); paintDeploy(); }));
$('.dtabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.stopPropagation();
  const visible = $$('[data-dtab]').filter(b => !b.hidden).map(b => b.dataset.dtab);
  const current = Math.max(0, visible.indexOf(answers.dtab));
  const next = visible[(current + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
  setValue('dtab', next); paintDeploy(); $(`[data-dtab="${next}"]`).focus();
});
$$('[data-check]').forEach(b => {
  b.checked = answers['chk-' + b.dataset.check] === '1';
  b.addEventListener('change', () => { setValue('chk-' + b.dataset.check, b.checked ? '1' : ''); paintDeploy(); });
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]'); if (!b) return;
  copyText(b.previousElementSibling.textContent, $('#cmdState'), '복사했어요. 해당 도구의 입력창이나 안내된 명령 창에 붙여 넣으세요.').then(ok => {
    if (!ok) return;
    b.textContent = '복사됨'; setTimeout(() => { b.textContent = '복사'; }, 1500);
  });
});
paintDeploy();
/* 썸네일을 불러오지 못하면 그 자리의 글자 타일이 그대로 보이게 합니다 */
$$('.tile img').forEach(i => { const drop = () => i.remove(); if (i.complete && !i.naturalWidth) drop(); else i.addEventListener('error', drop); });

// ── 8–9쪽 작품 카드와 갤러리 ─────────────────────────────────────────────
/* 갤러리는 두 가지 저장소를 씁니다. 평소에는 이 기기(localGallery), 수업방에 들어오면 live.js가 바꿔 끼웁니다. */
let works = store.get(WORKS, []) || [];
let shot = '', editing = null;
const safeHttp = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const hueOf = s => 200 + ([...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % 30);
function saveWorks() { return store.set(WORKS, works); }
const localGallery = {
  live: false,
  items: () => works,
  canEdit: () => true,
  newId: () => editing || Date.now().toString(36),
  async save(item) {
    const at = works.findIndex(w => w.id === item.id);
    if (at >= 0) { item.likes = works[at].likes; item.liked = works[at].liked; works[at] = item; } else { item.likes = 0; item.liked = false; works.unshift(item); }
    if (!saveWorks()) throw new Error('사진이 커서 저장 공간이 모자라요. 사진을 빼고 올려 보세요.');
  },
  async remove(id) { works = works.filter(w => w.id !== id); saveWorks(); },
  async like(id) { const w = works.find(x => x.id === id); if (!w) return; w.liked = !w.liked; w.likes += w.liked ? 1 : -1; saveWorks(); }
};
let gallery = localGallery;
function shrink(file) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const w = Math.min(560, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', .72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(); };
    img.src = url;
  });
}
function paintShot() { $('#shotPreview').hidden = !shot; if (shot) $('#shotImg').src = shot; }
$('#workShot').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { shot = await shrink(f); paintShot(); setState($('#workState'), ''); }
  catch { setState($('#workState'), '이 사진은 열 수 없어요. PNG나 JPG 파일로 다시 골라 주세요.', true); }
  e.target.value = '';
});
$('#shotClear').onclick = () => { shot = ''; paintShot(); };
function clearForm() {
  ['work-name', 'work-url', 'work-desc'].forEach(f => setValue(f, ''));
  shot = ''; editing = null; paintShot();
  $('#workSend').textContent = '갤러리에 올리기'; $('#workCancel').hidden = true;
}
$('#workSend').onclick = async () => {
  const name = get('work-name'), url = safeHttp(get('work-url'));
  if (!name) { setState($('#workState'), '웹앱 이름을 써 주세요.', true); $('#f-wname').focus(); return; }
  if (!url) { setState($('#workState'), '링크는 https:// 로 시작하는 주소로 써 주세요.', true); $('#f-wurl').focus(); return; }
  const was = !!editing;
  const item = { id: gallery.newId(), name, maker: get('work-maker'), url, desc: get('work-desc'), shot };
  $('#workSend').disabled = true;
  try {
    await gallery.save(item);
    clearForm(); paintGallery();
    setState($('#workState'), was ? '고쳤어요. 9쪽에서 확인해 보세요.' : '올렸어요! 9쪽 갤러리에서 확인해 보세요.');
    emit('work', item);
  } catch (err) { setState($('#workState'), err.message || '올리지 못했어요. 잠시 뒤 다시 눌러 주세요.', true); }
  $('#workSend').disabled = false;
};
$('#workCancel').onclick = () => { clearForm(); setState($('#workState'), ''); };
function paintGallery() {
  const box = $('#gallery'), list = gallery.items();
  if (!list.length) {
    box.innerHTML = `<div class="empty">아직 올라온 작품이 없어요.<br>8쪽에서 이름과 주소를 쓰고 [갤러리에 올리기]를 누르면 여기에 카드가 생겨요.</div>`;
    return;
  }
  box.innerHTML = list.map(w => `<div class="work" data-id="${esc(w.id)}">
    <div class="tile" style="--h:${hueOf(w.name)}"><b>${esc([...w.name][0] || '?')}</b>${w.shot ? `<img src="${esc(w.shot)}" alt="">` : ''}</div>
    <div class="info"><span class="name">${esc(w.name)}</span>${w.maker ? `<span class="maker">${esc(w.maker)}</span>` : ''}${w.desc ? `<span class="desc">${esc(w.desc)}</span>` : ''}
      <div class="acts">
        <a class="pill" href="${esc(safeHttp(w.url))}" target="_blank" rel="noopener">해 보기 ↗</a>
        <button type="button" class="pill like${w.liked ? ' on' : ''}" data-like aria-pressed="${!!w.liked}">♥ ${w.likes || 0}</button>
        <button type="button" class="pill quiet" data-share>소개 복사</button>
        ${gallery.canEdit(w) ? '<button type="button" class="pill quiet" data-edit>고치기</button><button type="button" class="pill quiet" data-del>지우기</button>' : ''}
      </div></div></div>`).join('');
}
$('#gallery').addEventListener('click', async e => {
  const card = e.target.closest('.work'); if (!card) return;
  const w = gallery.items().find(x => x.id === card.dataset.id); if (!w) return;
  if (e.target.closest('[data-like]')) { await gallery.like(w.id); paintGallery(); }
  else if (e.target.closest('[data-share]')) {
    const b = e.target.closest('[data-share]');
    copyText(`[${w.name}]${w.maker ? ` 만든 사람: ${w.maker}` : ''}\n${w.desc ? w.desc + '\n' : ''}${w.url}`, null).then(ok => { if (ok) b.textContent = '복사했어요'; });
  }
  else if (e.target.closest('[data-edit]')) {
    editing = w.id; setValue('work-name', w.name); setValue('work-maker', w.maker || ''); setValue('work-url', w.url); setValue('work-desc', w.desc || '');
    shot = w.shot || ''; paintShot();
    $('#workSend').textContent = '고친 내용 올리기'; $('#workCancel').hidden = false;
    setState($('#workState'), `「${w.name}」을(를) 고치는 중이에요.`);
    goToStep('work');
  }
  else if (e.target.closest('[data-del]')) {
    const b = e.target.closest('[data-del]');
    if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = '정말 지울까요?'; setTimeout(() => { if (b.isConnected) { b.classList.remove('arm'); b.textContent = '지우기'; } }, 3000); return; }
    await gallery.remove(w.id); paintGallery();
  }
});
paintGallery();

// ── 10쪽 퀴즈 ────────────────────────────────────────────────────────────
const QUESTIONS = [
  ['바이브코딩은 AI에게 무엇을 해 달라고 하는 걸까요?', ['그림 그리기', '말로 설명한 웹앱 만들기', '시험 채점하기', '동영상 편집하기'], 1,
    '만들고 싶은 웹앱을 우리말로 설명하면 AI가 코드를 써 줘요.'],
  ['6쪽에서 만든 프롬프트는 어디에 붙여 넣을까요?', ['제미나이나 클로드 같은 AI 입력창', '한글 문서', '메모장', '카카오톡 프로필'], 0,
    'AI 입력창에 붙여 넣으면 웹앱을 만들어 줘요. 제미나이는 [캔버스]를 켜고 붙여 넣으세요.'],
  ['AI가 만든 역사 웹앱에서 선생님이 꼭 확인해야 할 것은?', ['글자 색깔', '코드 줄 수', '연도와 인물 같은 역사 사실', '파일 크기'], 2,
    'AI가 연도나 인물을 틀리게 쓸 때가 있어요. 수업 전에 꼭 확인해 주세요.'],
  ['배포를 하면 무엇이 생길까요?', ['종이 학습지', '새 컴퓨터', '이메일 계정', '학생들이 들어올 수 있는 인터넷 주소'], 3,
    '배포하면 …netlify.app이나 …web.app 같은 주소가 생겨요. QR로 만들어 나눠 주면 돼요.'],
  ['Netlify Drop에 웹앱을 올리기 전에 먼저 할 일은?', ['구글 계정으로 로그인하기', '카드 등록하기', '프로그램 설치하기', '컴퓨터 다시 켜기'], 0,
    '로그인하고 올려야 사이트가 사라지지 않아요. 카드 등록은 필요 없어요.'],
  ['만든 웹앱에서 버튼이 안 눌릴 때 가장 좋은 방법은?', ['처음부터 포기하기', 'AI에게 무엇이 안 되는지 말하고 고쳐 달라고 하기', '컴퓨터 끄기', '그냥 두기'], 1,
    '"[시작] 버튼을 눌렀는데 반응이 없어. 고쳐 줘"처럼 말하면 돼요. 6쪽 아래의 고칠 때 쓰는 말을 써도 좋아요.']
];
let quiz = store.get(QUIZ, {}) || {};
function quizScore() {
  return { done: Object.keys(quiz).length, right: QUESTIONS.filter((x, i) => quiz[i] === x[2]).length, total: QUESTIONS.length };
}
function paintQuiz() {
  $('#quiz').innerHTML = QUESTIONS.map(([q, opts, ans, why], i) => {
    const picked = quiz[i];
    return `<div class="qcard" data-q="${i}"><span class="qn">문제 ${i + 1}</span><span class="q">${esc(q)}</span>
      <div class="opts">${opts.map((o, j) => {
        const cls = picked == null ? '' : j === ans ? 'right' : j === picked ? 'wrong' : '';
        return `<button type="button" data-a="${j}" class="${cls}"${picked != null ? ' disabled' : ''}><b>${'①②③④'[j]}</b><span>${esc(o)}</span></button>`;
      }).join('')}</div>${picked != null ? `<div class="why">${picked === ans ? '정답이에요!' : '아쉬워요.'} ${esc(why)}</div>` : ''}</div>`;
  }).join('');
  const { done, right, total } = quizScore();
  $('#scoreNum').textContent = `${right} / ${total}`;
  $('#scoreWord').textContent = done < total ? `${done}문제를 풀었어요. 남은 문제도 풀어 보세요.`
    : right === total ? '다 맞혔어요. 오늘부터 바이브코딩 선생님이에요!' : right >= 4 ? '잘했어요. 틀린 문제는 풀이를 한 번 더 읽어 보세요.' : '풀이를 읽고 [다시 풀기]로 한 번 더 해 보세요.';
}
$('#quiz').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  quiz[b.closest('[data-q]').dataset.q] = Number(b.dataset.a);
  store.set(QUIZ, quiz); paintQuiz(); emit('quiz', quizScore());
});
$('#quizReset').onclick = () => { quiz = {}; store.set(QUIZ, quiz); paintQuiz(); emit('quiz', quizScore()); };
paintQuiz();

// ── 11쪽 별점 ────────────────────────────────────────────────────────────
const STAR_WORDS = ['', '조금 아쉬웠어요', '보통이었어요', '도움이 되었어요', '많이 도움이 되었어요', '최고였어요!'];
function paintStars() {
  const n = Number(answers.star || 0);
  $$('#stars [data-star]').forEach(b => { const on = Number(b.dataset.star) <= n; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $('#starWord').textContent = n ? `${n}점, ${STAR_WORDS[n]}` : '별을 눌러 골라 주세요.';
}
$('#stars').addEventListener('click', e => {
  const b = e.target.closest('[data-star]'); if (!b) return;
  setValue('star', String(answers.star) === b.dataset.star ? '' : b.dataset.star); paintStars();
});
paintStars();

// ── 한 쪽씩 보기 ─────────────────────────────────────────────────────────
const STEPS = $$('.step[data-step]');
let stepIndex = Math.max(0, Math.min(STEPS.length - 1, Number(store.get(KEY + '-step', 0)) || 0));
let oneAtATime = store.get(KEY + '-one', true) !== false;
let seen = new Set(store.get(KEY + '-seen', [0]));
let pendingStep = -1;
$('#dots').innerHTML = STEPS.map((s, i) => `<button type="button" data-dot="${i}" aria-label="${esc(s.dataset.title)}" title="${esc(s.dataset.title)}"></button>`).join('');
function paintFollow() {
  const b = $('#stepFollow');
  if (pendingStep < 0 || pendingStep === stepIndex) { b.hidden = true; pendingStep = -1; return; }
  b.hidden = false; b.textContent = '진행자가 연 쪽으로 → ' + STEPS[pendingStep].dataset.title;
}
function paintSteps(focus) {
  document.body.classList.toggle('one', oneAtATime);
  $('#stepbar').hidden = !oneAtATime;
  $('#allBtn').textContent = oneAtATime ? '전체 보기' : '한 쪽씩 보기';
  STEPS.forEach((s, i) => s.classList.toggle('now', oneAtATime && i === stepIndex));
  seen.add(stepIndex);
  store.set(KEY + '-step', stepIndex); store.set(KEY + '-seen', [...seen]);
  emit('step', stepIndex);
  if (!oneAtATime) return;
  $('#stepTitle').textContent = STEPS[stepIndex].dataset.title;
  $('#stepCount').textContent = `${stepIndex + 1} / ${STEPS.length}`;
  $$('#dots [data-dot]').forEach((d, i) => { d.classList.toggle('on', i === stepIndex); d.classList.toggle('done', seen.has(i)); });
  $('#stepPrev').disabled = stepIndex === 0;
  $('#stepNext').disabled = stepIndex === STEPS.length - 1;
  paintFollow();
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focus) { const first = STEPS[stepIndex].querySelector('textarea, input.line'); if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch {} }, 0); }
}
function goStep(n, focus = true) { stepIndex = Math.max(0, Math.min(STEPS.length - 1, n)); paintSteps(focus); }
function goToStep(id) {
  const i = STEPS.findIndex(s => s.dataset.step === id); if (i < 0) return;
  if (oneAtATime) goStep(i); else STEPS[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
}
/* 쓰는 중에는 진행자를 따라 화면을 옮기지 않습니다. 쓰던 자리를 잃으면 안 되니까 버튼만 띄웁니다. */
let lastTyped = 0;
document.addEventListener('input', e => { if (e.target.closest('#sheet')) lastTyped = Date.now(); }, true);   // 수업방 창에 이름을 쓰는 건 세지 않아요
const isWriting = () => Date.now() - lastTyped < 20000;
function offerStep(id) {
  const i = STEPS.findIndex(s => s.dataset.step === id); if (i < 0) return;
  if (!oneAtATime) { oneAtATime = true; store.set(KEY + '-one', true); }
  if (i === stepIndex) { pendingStep = -1; paintSteps(); return; }
  if (isWriting()) { pendingStep = i; paintFollow(); toast('진행자가 다음 쪽을 열었어요. 다 쓰고 위의 버튼을 눌러 주세요.'); }
  else { pendingStep = -1; goStep(i, false); toast(`진행자가 「${STEPS[i].dataset.title}」을(를) 열었어요.`); }
}
$('#stepPrev').onclick = () => goStep(stepIndex - 1);
$('#stepNext').onclick = () => goStep(stepIndex + 1);
$('#stepFollow').onclick = () => { if (pendingStep >= 0) goStep(pendingStep); };
$('#dots').addEventListener('click', e => { const d = e.target.closest('[data-dot]'); if (d) goStep(Number(d.dataset.dot)); });
$('#allBtn').onclick = () => { oneAtATime = !oneAtATime; store.set(KEY + '-one', oneAtATime); closeMenu(); paintSteps(); };
document.addEventListener('keydown', e => {
  if (!oneAtATime || e.target.closest('input,textarea,select,dialog,[role=tablist]')) return;
  if (e.key === 'ArrowLeft') goStep(stepIndex - 1);
  if (e.key === 'ArrowRight') goStep(stepIndex + 1);
});
paintSteps();

// ── 타이머 ───────────────────────────────────────────────────────────────
let timerJob = null, timerEnd = 0;
function tick() {
  const left = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
  $('#timer').textContent = left ? `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}` : '끝!';
  $('#timer').classList.toggle('done', !left);
  if (!left) { clearInterval(timerJob); timerJob = null; }
}
function startTimer(endMs) {
  if (!oneAtATime) { oneAtATime = true; store.set(KEY + '-one', true); paintSteps(); }
  clearInterval(timerJob); timerEnd = endMs;
  $('#timer').hidden = false; tick(); timerJob = setInterval(tick, 500);
}
function stopTimer() { clearInterval(timerJob); timerJob = null; $('#timer').hidden = true; $('#timer').classList.remove('done'); }
$$('[data-timer]').forEach(b => b.onclick = () => { startTimer(Date.now() + Number(b.dataset.timer) * 1000); closeMenu(); });
$('#timer').onclick = stopTimer;

// ── 메뉴와 창 ────────────────────────────────────────────────────────────
function closeMenu() { $('#moreMenu').hidden = true; $('#moreBtn').setAttribute('aria-expanded', 'false'); }
$('#moreBtn').onclick = e => { e.stopPropagation(); const open = $('#moreMenu').hidden; $('#moreMenu').hidden = !open; $('#moreBtn').setAttribute('aria-expanded', String(open)); };
document.addEventListener('click', e => { if (!$('#moreMenu').hidden && !e.target.closest('#moreMenu')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
$$('dialog [data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

function drawQR(host, url) {
  host.innerHTML = '';
  if (!window.QRCode) { host.textContent = 'QR 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'; return; }
  new QRCode(host, { text: url, width: 240, height: 240, colorDark: '#0B2545', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.M });
}
$('#qrBtn').onclick = () => {
  closeMenu();
  const url = store.get(KEY + '-qr', '') || location.href.split('#')[0];
  $('#qrUrl').value = url; drawQR($('#qrHost'), url); $('#qrBox').showModal();
};
$('#qrForm').addEventListener('submit', e => {
  e.preventDefault();
  const url = safeHttp($('#qrUrl').value.trim()); if (!url) { $('#qrUrl').focus(); return; }
  store.set(KEY + '-qr', url); drawQR($('#qrHost'), url);
});

$('#clearBtn').onclick = () => { closeMenu(); $('#clearBox').showModal(); };
$('#clearYes').onclick = () => {
  [KEY, WORKS, QUIZ, KEY + '-step', KEY + '-seen', KEY + '-one', KEY + '-qr'].forEach(k => store.del(k));
  answers = {}; works = []; quiz = {}; shot = ''; editing = null; seen = new Set([0]); stepIndex = 0;
  $$('[data-save]').forEach(el => { el.value = ''; });
  $$('[data-check]').forEach(b => { b.checked = false; });
  paintPicks(); paintPk(); buildPk(); paintDeploy(); paintShot(); paintGallery(); paintQuiz(); paintStars(); paintSteps();
  $('#clearBox').close();
  say('이 기기에 저장된 답을 모두 지웠어요.');
  emit('cleared');
};

/* live.js가 쓰는 갈고리 */
window.WS = {
  $, $$, esc, say, toast, setState, store, setValue, copyText,
  buildPrompt: buildPk, paintPromptBuilder: paintPk, paintPromptLength: paintPkLen, paintDeploy, goToStep,
  get answers() { return answers; },
  get stepIndex() { return stepIndex; },
  get seen() { return [...seen]; },
  steps: STEPS,
  quizScore, deployCounts,
  offerStep, startTimer, stopTimer,
  useGallery(g) { gallery = g || localGallery; paintGallery(); },
  paintGallery
};
