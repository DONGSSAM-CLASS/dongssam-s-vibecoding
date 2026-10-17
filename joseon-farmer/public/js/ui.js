// 학생·교사 화면이 함께 쓰는 화면 조각
import { SCENES, FACTS, FICTIONAL, CHOICE_KEYS } from './content.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 화면 전환: 같은 key면 다시 그리지 않음 (막대·인원 수는 따로 갱신)
let currentKey = null;
export function show(root, key, html) {
  if (key === currentKey) return false;
  currentKey = key;
  root.innerHTML = `<div class="view">${html}</div>`;
  window.scrollTo({ top: 0 });
  return true;
}
export const resetView = () => { currentKey = null; };

export function confetti(target) {
  const box = document.createElement('div');
  box.className = 'burst';
  const colors = ['var(--dan)', 'var(--meok)', 'var(--ok)', '#C9A45C', 'var(--hanji-deep)'];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('i');
    const a = (Math.PI * 2 * i) / 28 + Math.random() * 0.3;
    const d = 90 + Math.random() * 110;
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * d - 40}px`);
    s.style.setProperty('--r', `${Math.random() * 540 - 270}deg`);
    s.style.background = colors[i % colors.length];
    box.appendChild(s);
  }
  (target || document.body).appendChild(box);
  setTimeout(() => box.remove(), 1300);
}

export function pulse(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // 애니메이션 다시 시작
  el.classList.add(cls);
}

export const fmtTime = (ms) => {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}분 ${String(t % 60).padStart(2, '0')}초`;
};

export const sceneHead = (s, i) => `
  <div class="scene-head">
    <span class="chip red">장면 ${i + 1} / ${SCENES.length}</span>
    <span class="chip">${esc(s.year)} · ${esc(s.reign)}</span>
    <span class="chip ghost">${esc(s.place)}</span>
  </div>`;

export const peopleHTML = (s) => `
  <ul class="people">${s.people.map((p) => `
    <li><b>${esc(p.name)}</b> <span class="tag ${p.real ? 'real' : 'fake'}">${p.real ? '실존 인물' : '가상 인물'}</span> <small>${esc(p.note)}</small></li>`).join('')}
  </ul>`;

export const storyParas = (s, outcomes) => s.story.map((p) => {
  if (p === '{FAMILY}') {
    const prev = outcomes?.[1];
    return prev ? `<p class="family">${esc(s.familyLine[prev])} <small>(2장 우리 반의 선택에서 이어짐)</small></p>` : '';
  }
  return `<p>${esc(p)}</p>`;
}).join('');

// 투표 막대: counts = {A:n,B:n,C:n}
export function barsHTML(s, counts = {}, { mine = null, winner = null } = {}) {
  const total = CHOICE_KEYS.reduce((a, k) => a + (counts[k] || 0), 0);
  return `<div class="bars" data-total="${total}">${s.choices.map((c) => {
    const n = counts[c.key] || 0;
    const pct = total ? Math.round((n / total) * 100) : 0;
    return `<div class="bar-row k${c.key} ${mine === c.key ? 'mine' : ''} ${winner === c.key ? 'win' : ''}" data-key="${c.key}">
      <div class="bar-label"><b class="key">${c.key}</b> ${esc(c.label)} ${mine === c.key ? '<em>← 내 선택</em>' : ''}${winner === c.key ? '<em class="w">다수</em>' : ''}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-num"><span class="n">${n}</span>명 · <span class="p">${pct}</span>%</div>
    </div>`;
  }).join('')}</div>`;
}

export function updateBars(root, counts = {}) {
  const box = root?.querySelector('.bars');
  if (!box) return;
  const total = CHOICE_KEYS.reduce((a, k) => a + (counts[k] || 0), 0);
  box.dataset.total = total;
  box.querySelectorAll('.bar-row').forEach((row) => {
    const n = counts[row.dataset.key] || 0;
    const pct = total ? Math.round((n / total) * 100) : 0;
    row.querySelector('.bar-fill').style.width = `${pct}%`;
    row.querySelector('.n').textContent = n;
    row.querySelector('.p').textContent = pct;
  });
}

export function majority(counts = {}) {
  let best = CHOICE_KEYS[0], max = -1, tie = false;
  for (const k of CHOICE_KEYS) {
    const n = counts[k] || 0;
    if (n > max) { best = k; max = n; tie = false; } else if (n === max) tie = true;
  }
  return { key: best, tie: tie && max > 0, none: max <= 0 };
}

// 마지막 화면: 우리 반의 선택 vs 실제 역사
export function compareHTML(room) {
  return `<div class="compare">
    <div class="cmp-row cmp-head"><div>장면</div><div>우리 반의 선택</div><div>실제 역사</div></div>
    ${SCENES.map((s, i) => {
      const k = room.outcomes?.[i];
      const c = s.choices.find((x) => x.key === k);
      const t = room.tallies?.[i] || {};
      const total = CHOICE_KEYS.reduce((a, x) => a + (t[x] || 0), 0);
      const pct = total && k ? Math.round(((t[k] || 0) / total) * 100) : 0;
      const real = s.history.bars ? (() => {
        const sum = s.history.bars.reduce((a, b) => a + b.value, 0);
        return `<div class="mini-bars">${s.history.bars.map((b) => `<div><span>${esc(b.label)} ${b.value.toLocaleString('ko-KR')}명</span><i style="width:${Math.round((b.value / sum) * 100)}%"></i></div>`).join('')}</div>`;
      })() : '';
      return `<div class="cmp-row">
        <div><b>${i + 1}. ${esc(s.title)}</b><small>${esc(s.year)} · ${esc(s.era)}</small></div>
        <div>${c ? `<b class="pick k${k}">${k} ${esc(c.label)}</b> <small>${pct}% (${total}명 중 ${t[k] || 0}명)</small><p>${esc(c.text)}</p>` : '<small>아직 고르지 않음</small>'}</div>
        <div><b>${esc(s.history.headline)}</b>${real}<p>${esc(s.history.text)}</p></div>
      </div>`;
    }).join('')}
  </div>`;
}

export function factsHTML() {
  return `<details class="facts card">
    <summary>교사 확인용 사실 목록 (사건 · 연도 · 인물)</summary>
    <div class="table-wrap"><table>
      <thead><tr><th>사건</th><th>연도</th><th>인물</th><th>근거·비고</th></tr></thead>
      <tbody>${FACTS.map((f) => `<tr><td>${esc(f.event)}</td><td>${esc(f.year)}</td><td>${esc(f.who)}</td><td>${esc(f.note)}${f.check ? ` <span class="warn">${esc(f.check)}</span>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="small">가상 인물: ${FICTIONAL.map(esc).join(' · ')} — 이야기를 위해 지어낸 인물이며 화면에 "가상 인물"로 표시됩니다. 사료 인용은 쉬운 말로 옮긴 것이니 원문은 조선왕조실록(sillok.history.go.kr)에서 확인하세요.</p>
  </details>`;
}

export function errorCard(err) {
  const noCfg = err?.message === 'NO_CONFIG';
  return `<div class="card center">
    <h2 class="h2">연결하지 못했어요</h2>
    <p>${noCfg ? 'Firebase 설정값이 비어 있어요. README의 「4단계: 설정값 붙여 넣기」를 따라 <code>public/js/firebase-config.js</code>를 채우거나, Firebase Hosting 주소로 열어 주세요.' : '인터넷 연결을 확인하고 새로 고침해 주세요.'}</p>
    <p class="small">${esc(err?.message || err)}</p>
  </div>`;
}
