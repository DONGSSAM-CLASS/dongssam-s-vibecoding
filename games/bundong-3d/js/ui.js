import { FICTION_NOTE } from './history.js';
import { L } from './layout.js';
import { RELICS, relicById } from './relics.js';
import { ITEMS, RECIPES } from './inventory.js';
import { settings, saveSettings } from './settings.js';
import { fmtTime, angleDiff } from './util.js';
import { defaultPortrait } from './student.js';

const $ = (id) => document.getElementById(id);

export const HOW_HTML = `<table>
<tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 방향키</td><td>이동</td></tr>
<tr><td>마우스</td><td>둘러보기</td></tr>
<tr><td><kbd>Shift</kbd></td><td>달리기 (기력 소모)</td></tr>
<tr><td><kbd>Space</kbd></td><td>점프 (보스의 바닥 공격 피하기)</td></tr>
<tr><td><kbd>Ctrl</kbd> / <kbd>C</kbd></td><td>앉기</td></tr>
<tr><td><kbd>E</kbd></td><td>상호작용 — 상자 열기, 가방 뒤지기, 채집, 문 열기, 게시판 읽기</td></tr>
<tr><td>좌클릭</td><td>든 유물의 스킬 사용</td></tr>
<tr><td>우클릭</td><td>사인참사검 특수기 (검기)</td></tr>
<tr><td><kbd>1</kbd>~<kbd>7</kbd> / 휠</td><td>유물 바꾸기</td></tr>
<tr><td><kbd>G</kbd> / <kbd>H</kbd> / <kbd>J</kbd></td><td>팥 뿌리기 / 쑥 먹기 / 팥죽 먹기</td></tr>
<tr><td><kbd>F</kbd></td><td>손전등 (그림자 악령이 드러남)</td></tr>
<tr><td><kbd>I</kbd> / <kbd>Tab</kbd></td><td>가방 · 만들기 · 유물 도감</td></tr>
<tr><td><kbd>M</kbd></td><td>학교 지도</td></tr>
<tr><td><kbd>Esc</kbd></td><td>메뉴 (설정·저장·날씨·시간)</td></tr>
</table>`;

export class UI {
  constructor(game) {
    this.g = game;
    this.toastBox = $('toasts');
    this.shakeAmt = 0;
    this.last = {};
    this.modalCb = null;
    this.mapBase = null;
    this.photos = { male: null, female: null };
    document.querySelectorAll('.how').forEach((el) => (el.innerHTML = HOW_HTML));
    this.buildCompass();
  }

  // ---------- 화면 전환 ----------
  show(id) {
    for (const s of ['loading', 'title', 'select', 'hud', 'pause', 'dead', 'victory', 'howTitle', 'bag', 'mapPanel', 'modal']) {
      const el = $(s);
      if (el) el.classList.toggle('hidden', !(Array.isArray(id) ? id.includes(s) : s === id));
    }
  }
  hide(id) { $(id).classList.add('hidden'); }
  isOpen(id) { return !$(id).classList.contains('hidden'); }

  loading(frac, text) {
    $('loadFill').style.width = Math.round(frac * 100) + '%';
    if (text) $('loadText').textContent = text;
  }

  // ---------- 알림 ----------
  toast(msg, cls = '', ms = 1800) {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = msg;
    this.toastBox.appendChild(el);
    while (this.toastBox.children.length > 4) this.toastBox.firstChild.remove();
    setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, ms);
  }

  prompt(text) {
    if (this.last.prompt === text) return;
    this.last.prompt = text;
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); return; }
    el.innerHTML = `<b>E</b>${text}`;
    el.classList.remove('hidden');
  }

  hurt(n) {
    const v = $('vignette');
    v.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(170,0,0,${Math.min(0.75, 0.25 + n / 30)}) 100%)`;
    clearTimeout(this._hurtT);
    this._hurtT = setTimeout(() => (v.style.background = ''), 300);
    this.shake(0.15);
  }

  hitMarker() {
    const c = $('crosshair');
    c.classList.add('hit');
    clearTimeout(this._hitT);
    this._hitT = setTimeout(() => c.classList.remove('hit'), 150);
  }

  screenFlash(color) {
    const el = $('hitFlash');
    el.style.transition = 'none';
    el.style.background = color;
    requestAnimationFrame(() => { el.style.transition = 'background .5s'; el.style.background = 'rgba(0,0,0,0)'; });
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  // ---------- HUD ----------
  setPlayer(name, gender, photo) {
    $('hudName').textContent = name;
    $('hudPortrait').src = photo || defaultPortrait(gender);
  }

  refreshHotbar() {
    const R = this.g.relics;
    const hb = $('hotbar');
    hb.innerHTML = '';
    RELICS.forEach((r, i) => {
      const own = R.owned.has(r.id);
      const d = document.createElement('div');
      d.className = 'slot' + (own ? '' : ' empty') + (R.current === i ? ' on' : '');
      d.innerHTML = `<span class="num">${i + 1}</span><div class="ico">${own && R.icons[r.id] ? `<img src="${R.icons[r.id]}" alt="">` : own ? r.icon : '?'}</div><div class="nm">${own ? r.name : '???'}</div><div class="cd" style="height:0"></div>`;
      hb.appendChild(d);
    });
    this.slotEls = [...hb.children];
  }

  refreshConsumables() {
    const inv = this.g.inventory;
    $('consPat').querySelector('span').textContent = inv.count('pat');
    $('consSsuk').querySelector('span').textContent = inv.count('ssuk');
    $('consJuk').querySelector('span').textContent = inv.count('juk');
    if (this.isOpen('bag')) this.renderBag();
  }

  refreshQuest() {
    const q = this.g.quest.objectives();
    $('quest').innerHTML = q.map((o) => `<div class="q${o.done ? ' done' : ''}"><div class="qt">${o.t}</div>${o.d}</div>`).join('');
  }

  buildCompass() {
    const strip = $('compassStrip');
    const labels = [];
    const names = { 0: '북', 45: '북동', 90: '동', 135: '남동', 180: '남', 225: '남서', 270: '서', 315: '북서' };
    for (let d = 0; d < 360; d += 15) {
      const s = document.createElement('span');
      s.textContent = names[d] || '·';
      if (names[d]) s.className = 'cardinal' + (d === 0 ? ' n' : '');
      strip.appendChild(s);
      labels.push({ d, el: s });
    }
    this.compassLabels = labels;
  }

  update(dt) {
    const g = this.g, P = g.player;
    // 체력/기력/보호막
    const hp = Math.ceil(P.hp);
    if (this.last.hp !== hp) { this.last.hp = hp; $('hpFill').style.width = (P.hp / P.maxHp) * 100 + '%'; $('hpText').textContent = hp; }
    $('stFill').style.width = P.stamina + '%';
    const sh = P.shield > 0;
    $('shBar').classList.toggle('hidden', !sh);
    if (sh) $('shFill').style.width = (P.shield / 60) * 100 + '%';
    const lowHp = P.hp < 30 && !P.dead;
    if (lowHp && !this._hurtT) $('vignette').style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(140,0,0,${0.25 + Math.sin(performance.now() * 0.006) * 0.12}) 100%)`;
    // 버프
    const buffs = [];
    if (P.buffs.juk) buffs.push(`🥣 팥죽 ${Math.ceil(P.buffs.juk)}s`);
    if (g.relics.timeSlow > 0) buffs.push(`🕰 시간 늦춤 ${Math.ceil(g.relics.timeSlow)}s`);
    if (P.flashlight) buffs.push('🔦 손전등');
    if (g.inventory.count('bujeok')) buffs.push('🧧 부적');
    const bstr = buffs.join('|');
    if (this.last.buffs !== bstr) { this.last.buffs = bstr; $('buffs').innerHTML = buffs.map((b) => `<span class="buff">${b}</span>`).join(''); }
    // 시계/날씨
    const clock = fmtTime(g.sky.hours);
    if (this.last.clock !== clock) { this.last.clock = clock; $('clock').textContent = clock + (g.sky.nightFactor > 0.5 ? ' 🌙' : ''); }
    const wn = g.weather.name;
    if (this.last.wn !== wn) { this.last.wn = wn; $('weatherIcon').textContent = g.weather.icon; $('weatherName').textContent = wn; }
    // 정화 수
    const pc = g.stats.purified;
    if (this.last.pc !== pc) { this.last.pc = pc; $('purified').querySelector('span').textContent = pc; this.refreshQuest(); }
    // 재사용 대기
    if (this.slotEls) {
      RELICS.forEach((r, i) => {
        const el = this.slotEls[i]?.querySelector('.cd');
        if (!el) return;
        const t = g.relics.cd[r.id] || 0;
        const frac = r.cd ? t / r.cd : 0;
        el.style.height = Math.round(frac * 100) + '%';
      });
    }
    // 나침반
    const heading = ((-P.yaw * 180) / Math.PI) % 360;
    const W = $('compass').clientWidth || 420;
    const pxPerDeg = W / 120;
    for (const l of this.compassLabels) {
      const off = angleDiff((l.d * Math.PI) / 180, (heading * Math.PI) / 180) * 180 / Math.PI;
      l.el.style.left = W / 2 + off * pxPerDeg + 'px';
      l.el.style.display = Math.abs(off) > 62 ? 'none' : '';
    }
    const tgt = g.quest.target();
    const mark = $('compassMark');
    if (tgt) {
      const bearing = Math.atan2(tgt.x - P.pos.x, -(tgt.z - P.pos.z));
      const off = (angleDiff(bearing, (heading * Math.PI) / 180) * 180) / Math.PI;
      const dist = Math.hypot(tgt.x - P.pos.x, tgt.z - P.pos.z);
      mark.style.display = '';
      mark.style.left = W / 2 + Math.max(-58, Math.min(58, off)) * pxPerDeg + 'px';
      mark.textContent = `◆ ${Math.round(dist)}m`;
    } else mark.style.display = 'none';
    // 미니맵(매 프레임 2번에 1번)
    this._mm = (this._mm || 0) + 1;
    if (this._mm % 2 === 0) this.drawMinimap();
  }

  bossHp(frac, scale) {
    $('bossBar').classList.remove('hidden');
    $('bossFill').style.width = Math.max(0, frac * 100) + '%';
    const nm = document.querySelector('.boss-name');
    const txt = scale > 1.3 ? `어둑시니 — 쳐다볼수록 커진다! (${scale.toFixed(1)}배)` : '어둑시니';
    if (nm.textContent !== txt) nm.textContent = txt;
  }
  hideBoss() { $('bossBar').classList.add('hidden'); }

  // ---------- 지도 ----------
  buildMapBase(yardCanvas) {
    const Y = L.yard;
    const s = 4;
    const W = (Y.x1 - Y.x0) * s, H = (Y.z1 - Y.z0) * s;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(yardCanvas, 0, 0, W, H);
    const X = (x) => (x - Y.x0) * s, Z = (z) => (z - Y.z0) * s;
    const rect = (r, col, label) => {
      ctx.fillStyle = col;
      ctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
      if (label) {
        ctx.fillStyle = '#fff'; ctx.font = '700 16px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(label, X((r.x0 + r.x1) / 2), Z((r.z0 + r.z1) / 2) + 6);
      }
    };
    rect(L.main, '#4d6fa8', '본관');
    rect(L.entrance, '#8a8780');
    rect(L.tower, '#d99a3a');
    rect(L.annex, '#6b4335', '별관');
    rect(L.east, '#9c8f80', '동관');
    // 실내 방 이름
    ctx.font = '600 11px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#e8eefc';
    for (const r of L.inside.rooms) ctx.fillText(r.name, X((r.x0 + r.x1) / 2), Z(-47));
    const lab = (t, x, z) => { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = '700 14px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t, X(x) + 1, Z(z) + 1); ctx.fillStyle = '#fff'; ctx.fillText(t, X(x), Z(z)); };
    lab('운동장', -7, 0); lab('코트', 45, 0); lab('등나무 쉼터', 61.5, -20); lab('소나무 정원', 82, -18); lab('연못', 84, -2); lab('벽돌 광장', 78, 33); lab('정문', 10, 43); lab('텃밭', -12, 39);
    this.mapBase = c;
  }

  drawMinimap() {
    if (!this.mapBase) return;
    const g = this.g, P = g.player;
    const cv = $('minimap');
    const ctx = cv.getContext('2d');
    const S = cv.width;
    const Y = L.yard;
    const s = 4, zoom = 0.75;
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#23291f'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(P.yaw);
    ctx.scale(zoom, zoom);
    ctx.drawImage(this.mapBase, -(P.pos.x - Y.x0) * s, -(P.pos.z - Y.z0) * s);
    const M = (x, z) => [(x - P.pos.x) * s, (z - P.pos.z) * s];
    // 단서 원
    for (const h of g.quest.hintCircles()) {
      const [x, z] = M(h.x, h.z);
      ctx.strokeStyle = 'rgba(255,214,90,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, z, 6 * s, 0, Math.PI * 2); ctx.stroke();
    }
    // 악령
    for (const gh of g.ghosts.list) {
      if (!gh.alive || (gh.type === 'shadow' && !gh.visibleNow)) continue;
      const [x, z] = M(gh.pos.x, gh.pos.z);
      ctx.fillStyle = gh.type === 'boss' ? '#b070ff' : '#ff4a3a';
      ctx.beginPath(); ctx.arc(x, z, gh.type === 'boss' ? 12 : 5, 0, Math.PI * 2); ctx.fill();
    }
    const t = g.quest.target();
    if (t) {
      const [x, z] = M(t.x, t.z);
      ctx.fillStyle = '#ffd25a';
      ctx.beginPath(); ctx.moveTo(x, z - 9); ctx.lineTo(x + 7, z); ctx.lineTo(x, z + 9); ctx.lineTo(x - 7, z); ctx.fill();
    }
    ctx.restore();
    // 플레이어 화살표
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 9); ctx.lineTo(S / 2 + 6, S / 2 + 6); ctx.lineTo(S / 2, S / 2 + 2); ctx.lineTo(S / 2 - 6, S / 2 + 6); ctx.fill();
    ctx.fillStyle = '#ff7a5a'; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center';
    const na = -P.yaw - Math.PI / 2;
    ctx.fillText('N', S / 2 + Math.cos(na) * (S / 2 - 10), S / 2 + Math.sin(na) * (S / 2 - 10) + 4);
  }

  drawBigMap() {
    const g = this.g, P = g.player;
    const cv = $('bigmap');
    const ctx = cv.getContext('2d');
    const Y = L.yard;
    const k = Math.min(cv.width / this.mapBase.width, cv.height / this.mapBase.height);
    ctx.fillStyle = '#1b2016'; ctx.fillRect(0, 0, cv.width, cv.height);
    const ox = (cv.width - this.mapBase.width * k) / 2, oy = (cv.height - this.mapBase.height * k) / 2;
    ctx.drawImage(this.mapBase, ox, oy, this.mapBase.width * k, this.mapBase.height * k);
    const M = (x, z) => [ox + (x - Y.x0) * 4 * k, oy + (z - Y.z0) * 4 * k];
    for (const h of g.quest.hintCircles()) {
      const [x, z] = M(h.x, h.z);
      ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, z, 6 * 4 * k, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd25a'; ctx.font = '700 13px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(h.name + '?', x, z - 6 * 4 * k - 4);
    }
    const t = g.quest.target();
    if (t) { const [x, z] = M(t.x, t.z); ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.arc(x, z, 6, 0, Math.PI * 2); ctx.fill(); }
    const [px, pz] = M(P.pos.x, P.pos.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-P.yaw);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(0, 3); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '700 14px "Noto Sans KR", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('흰 화살표: 나   노란 원: 유물 단서   ◆: 목표', 14, cv.height - 14);
  }

  // ---------- 모달 ----------
  openModal(html, cb) {
    $('modalBody').innerHTML = html;
    $('modal').classList.remove('hidden');
    this.modalCb = cb || null;
    this.g.pauseForUI(true);
  }

  closeModal() {
    if (!this.isOpen('modal')) return;
    $('modal').classList.add('hidden');
    const cb = this.modalCb;
    this.modalCb = null;
    this.g.pauseForUI(false);
    if (cb) cb();
  }

  relicCard(id) {
    const r = relicById(id);
    const img = this.g.relics.icons[id];
    this.openModal(`
      <div class="meta">유물을 얻었다!</div>
      <h2>${r.name}</h2>
      <div class="hanja">${r.hanja}</div>
      ${img ? `<img class="relic-img" src="${img}" alt="${r.name}">` : ''}
      <div class="meta">${r.era} · ${r.where}</div>
      <div class="desc">${r.desc}</div>
      <div class="meta" style="margin-top:10px">${r.modelNote}</div>
      ${historySources(r)}
      <div class="skill"><b>게임 속 창작 스킬</b><br>${r.skill}</div>
      <div class="meta">${FICTION_NOTE}</div>`);
  }

  board(title, text) {
    this.openModal(`<h2 style="font-size:24px">${title}</h2><div class="board">${text}</div>`);
  }

  // ---------- 가방 ----------
  openBag(tab = 'items') {
    this.setBagTab(tab);
    $('bag').classList.remove('hidden');
    this.g.pauseForUI(true);
  }
  closePanels() {
    let any = false;
    for (const id of ['bag', 'mapPanel']) if (this.isOpen(id)) { $(id).classList.add('hidden'); any = true; }
    if (any) this.g.pauseForUI(false);
    return any;
  }
  setBagTab(tab) {
    document.querySelectorAll('#bag .tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    $('bagItems').classList.toggle('hidden', tab !== 'items');
    $('bagCodex').classList.toggle('hidden', tab !== 'codex');
    if (tab === 'items') this.renderBag(); else this.renderCodex();
  }
  renderBag() {
    const inv = this.g.inventory;
    $('bagCap').textContent = `가방 칸 ${inv.slotsUsed()} / ${inv.cap}`;
    const grid = $('bagGrid');
    grid.innerHTML = '';
    for (let i = 0; i < inv.cap; i++) {
      const ids = Object.keys(inv.items).filter((k) => inv.items[k] > 0);
      const id = ids[i];
      const d = document.createElement('div');
      d.className = 'bslot';
      if (id) {
        d.innerHTML = `${ITEMS[id].icon}<small>${ITEMS[id].name}</small><i>${inv.items[id]}</i>`;
        d.onclick = () => {
          const it = ITEMS[id];
          $('bagDetail').innerHTML = `<b style="font-size:18px">${it.icon} ${it.name}</b> × ${inv.items[id]}<br>${it.desc}` +
            (it.use ? `<br><button class="btn small" id="useItem">사용하기</button>` : '');
          const b = $('useItem');
          if (b) b.onclick = () => { inv.use(id); this.renderBag(); };
        };
      }
      grid.appendChild(d);
    }
    const cl = $('craftList');
    cl.innerHTML = '';
    for (const r of RECIPES) {
      const d = document.createElement('div');
      d.className = 'recipe';
      const ok = inv.canCraft(r);
      d.innerHTML = `<span style="font-size:22px">${ITEMS[r.out].icon}</span><span>${r.label}<br><small style="color:var(--ink-dim)">${ITEMS[r.out].desc.split('<br>')[0]}</small></span>`;
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = '만들기';
      b.disabled = !ok;
      b.onclick = () => { inv.craft(r); this.renderBag(); };
      d.appendChild(b);
      cl.appendChild(d);
    }
  }
  renderCodex() {
    const R = this.g.relics;
    $('bagCodex').innerHTML = `<div class="codex">` + RELICS.map((r, i) => {
      const own = R.owned.has(r.id);
      return `<div class="cx${own ? '' : ' locked'}">
        ${own && R.icons[r.id] ? `<img src="${R.icons[r.id]}" alt="">` : ''}
        <h3>${i + 1}. ${own ? r.name : '???'}</h3>
        <div class="meta">${own ? `${r.hanja} · ${r.era}<br>${r.where}` : '아직 찾지 못한 유물'}</div>
        ${own ? `<div>${r.desc}</div><div class="meta" style="margin-top:8px">${r.modelNote}</div>${historySources(r)}<div class="skill" style="margin-top:6px"><b>게임 속 창작 스킬</b><br>${r.skill}</div><div class="meta">${FICTION_NOTE}</div>` : ''}
      </div>`;
    }).join('') + `</div>`;
  }

  openMap() {
    $('mapPanel').classList.remove('hidden');
    this.drawBigMap();
    this.g.pauseForUI(true);
  }

  // ---------- 설정 ----------
  bindSettings() {
    const g = this.g;
    const sens = $('setSens'), fov = $('setFov'), vol = $('setVol'), qual = $('setQuality'), day = $('setDay'), wea = $('setWeather'), inv = $('setInvert');
    sens.value = settings.sens; fov.value = settings.fov; vol.value = settings.volume; qual.value = settings.quality; day.value = settings.dayLength; wea.value = settings.weather; inv.checked = settings.invert;
    sens.oninput = () => { settings.sens = +sens.value; saveSettings(); };
    fov.oninput = () => { settings.fov = +fov.value; saveSettings(); };
    vol.oninput = () => { settings.volume = +vol.value; g.audio.setVolume(settings.volume); saveSettings(); };
    qual.onchange = () => { settings.quality = qual.value; saveSettings(); g.applyQuality(); this.toast('그래픽 품질을 바꿨습니다 (일부는 새로고침 후 적용)'); };
    day.onchange = () => { settings.dayLength = +day.value; g.sky.dayLength = settings.dayLength; saveSettings(); };
    wea.onchange = () => { settings.weather = wea.value; g.weather.setMode(wea.value); saveSettings(); };
    inv.onchange = () => { settings.invert = inv.checked; saveSettings(); };
    $('btnSkipDay').onclick = () => { g.sky.hours = 7.0; this.toast('아침 7시로 시간을 옮겼다'); };
    $('btnSkipNight').onclick = () => { g.sky.hours = 20.5; this.toast('밤 8시 30분으로 시간을 옮겼다'); };
    document.querySelectorAll('.pause-tabs .tab').forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll('.pause-tabs .tab').forEach((x) => x.classList.toggle('on', x === t));
        document.querySelectorAll('.ppane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== t.dataset.ptab));
      };
    });
    document.querySelectorAll('#bag .tab').forEach((t) => (t.onclick = () => this.setBagTab(t.dataset.tab)));
    document.querySelectorAll('[data-close]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.close;
        if (id === 'howTitle') { $(id).classList.add('hidden'); return; }
        $(id).classList.add('hidden');
        this.g.pauseForUI(false);
      };
    });
  }
}

function historySources(r) {
  return '<div class="history-sources">자료: ' + r.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}</a>`).join(' · ') + '</div>';
}
