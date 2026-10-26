// Screens and panels (DOM). Works with mouse, keyboard, gamepad (focus navigation) and touch.
import { L, getLang, setLang } from '../engine/i18n.js';
import { ICON } from './icons.js';
import { keyLabel, padLabel, REBINDABLE } from '../engine/input.js';
import { SKILLS } from '../game/progress.js';
import { CODEX, TIMELINE, REFS } from '../data/codex.js';
import { WEAPONS, DIFFICULTY } from '../game/weapons.js';
import { drawTacticalMap } from './map.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const t = (k, v) => esc(L(k, v));

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('screens');
    this.stack = [];
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      this.app.audio.unlock();
      this.app.audio.ui(b.dataset.snd || 'click');
      this.onAct(b.dataset.act, b, e);
    });
    this.root.addEventListener('input', (e) => { const el = e.target; if (el.dataset.set) this.app.setSetting(el.dataset.set, el.type === 'range' ? parseFloat(el.value) : el.type === 'checkbox' ? el.checked : el.value); });
    this.root.addEventListener('change', (e) => { const el = e.target; if (el.dataset.set) this.app.setSetting(el.dataset.set, el.type === 'range' ? parseFloat(el.value) : el.type === 'checkbox' ? el.checked : el.value); });
    this.root.addEventListener('mouseover', (e) => { const b = e.target.closest('button'); if (b && b !== this._hov) { this._hov = b; this.app.audio.ui('hover'); } });
    // actions that work on any screen
    this.handlers = { lang: (b) => this.app.setSetting('lang', b.dataset.lang) };
  }
  get top() { return this.stack[this.stack.length - 1]; }
  open(name, html, { handlers = {}, cls = '', onBack = null, keep = false } = {}) {
    if (!keep) this.closeAll();
    const el = document.createElement('section');
    el.className = `screen s-${name} ${cls}`;
    el.innerHTML = html;
    this.root.appendChild(el);
    this.stack.push({ name, el, handlers, onBack });
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => this.focusFirst(), 30);
    return el;
  }
  close() { const s = this.stack.pop(); if (s) { s.el.classList.remove('in'); setTimeout(() => s.el.remove(), 220); } setTimeout(() => this.focusFirst(), 30); }
  closeAll() { while (this.stack.length) { const s = this.stack.pop(); s.el.remove(); } }
  back() { const s = this.top; if (!s) return false; if (s.onBack) { s.onBack(); return true; } if (this.stack.length > 1) { this.close(); return true; } return false; }
  onAct(act, el, e) {
    for (let i = this.stack.length - 1; i >= 0; i--) { const h = this.stack[i].handlers[act]; if (h) { h(el, e); return; } }
    const g = this.handlers[act]; if (g) g(el, e);
  }
  focusables() { const s = this.top; if (!s) return []; return [...s.el.querySelectorAll('button:not([disabled]), input, select, [tabindex="0"]')].filter((x) => x.offsetParent !== null); }
  focusFirst() { const f = this.focusables(); const pref = f.find((x) => x.classList.contains('primary')) || f[0]; if (pref && this.app.input.device === 'pad') pref.focus(); }
  padNav(dir) {
    const f = this.focusables(); if (!f.length) return;
    let i = f.indexOf(document.activeElement);
    if (dir === 'ok') { if (i >= 0) { const el = f[i]; if (el.tagName === 'INPUT' && el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true })); } else el.click(); } else f[0].focus(); return; }
    if (dir === 'back') { if (!this.back()) this.app.onMenuBack?.(); return; }
    const el = f[i];
    if ((dir === 'left' || dir === 'right') && el && (el.type === 'range' || el.tagName === 'SELECT')) {
      if (el.type === 'range') { el.value = parseFloat(el.value) + (dir === 'right' ? 1 : -1) * parseFloat(el.step || 1); }
      else { el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + (dir === 'right' ? 1 : -1))); }
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return;
    }
    if (dir === 'up' || dir === 'left') i = i <= 0 ? f.length - 1 : i - 1; else i = (i + 1) % f.length;
    f[i].focus(); f[i].scrollIntoView({ block: 'nearest' });
    this.app.audio.ui('hover');
  }
  btn(act, label, { cls = '', icon = '', dis = false, attrs = '' } = {}) { return `<button class="btn ${cls}" data-act="${act}" ${dis ? 'disabled' : ''} ${attrs}>${icon ? `<span class="bi">${ICON[icon] || ''}</span>` : ''}<span>${label}</span></button>`; }
  langToggle() { return `<div class="lang">${['en', 'ko'].map((l) => `<button class="lbtn ${getLang() === l ? 'on' : ''}" data-act="lang" data-lang="${l}">${l === 'en' ? 'English' : '한국어'}</button>`).join('')}</div>`; }

  // ======================================================== TITLE
  title() {
    const P = this.app.progress, has = P.hasSave && P.s.reached > 0;
    const html = `
      <div class="title-wrap">
        <div class="title-mark"><div class="seal">${getLang() === 'ko' ? '光復' : '光復'}</div></div>
        <h1 class="game-title">${t('gameTitle')}</h1>
        <div class="game-sub">${t('gameSub')}</div>
        <nav class="menu">
          ${has ? this.btn('continue', t('continue'), { cls: 'primary', icon: 'depart' }) : ''}
          ${this.btn('new', t('newJourney'), { cls: has ? '' : 'primary', icon: 'flag' })}
          ${this.btn('chapters', t('chapters'), { icon: 'map' })}
          ${this.btn('archive', t('archive'), { icon: 'book' })}
          ${this.btn('settings', t('settings'), { icon: 'gear' })}
          ${this.btn('credits', t('credits'), { icon: 'info' })}
        </nav>
        ${this.langToggle()}
        <p class="disclaimer">${t('disclaimer')}</p>
      </div>`;
    this.open('title', html, { handlers: {
      continue: () => this.app.continueJourney(),
      new: () => (has ? this.confirm(t('confirmNew'), () => this.app.newJourney()) : this.app.newJourney()),
      chapters: () => this.chapters(), archive: () => this.archive(), settings: () => this.settings(), credits: () => this.credits(),
    } });
  }
  confirm(msg, yes, no) {
    this.open('confirm', `<div class="card modal"><p>${msg}</p><div class="row">${this.btn('yes', t('yes'), { cls: 'primary' })}${this.btn('no', t('no'))}</div></div>`, { keep: true, cls: 'overlay', handlers: { yes: () => { this.close(); yes(); }, no: () => { this.close(); no?.(); } } });
  }

  // ======================================================== CHAPTERS
  chapters(fromPause = false) {
    const { CHAPTERS } = this.app.data;
    const P = this.app.progress, classroom = this.app.settings.classroom;
    const reached = P.s.reached;
    const cards = CHAPTERS.map((c) => {
      const first = this.app.stepIndexOfChapter(c.id);
      const open = classroom || first <= reached;
      const missions = c.missions.map((m) => this.app.data.MISSIONS[m]).filter((m) => m && !m.hub);
      return `<article class="chap ${open ? '' : 'locked'}">
        <div class="chap-years">${esc(c.years)}</div>
        <h3>${t(c.title)}</h3>
        <div class="chap-meta">${t(c.region)}</div>
        <ul class="chap-ms">${missions.map((m) => `<li>${t(m.title)} <small>${esc(m.date ? L(m.date) : '')}</small></li>`).join('')}</ul>
        ${open ? this.btn('playChap', t('play'), { attrs: `data-ch="${c.id}"`, cls: 'small' }) : `<div class="locked-note">${ICON.lock}${t('lockedChapter')}</div>`}
      </article>`;
    }).join('');
    this.open('chapters', `<div class="panel wide"><header><h2>${t('chapters')}</h2>${this.btn('back', t('back'), { cls: 'ghost', icon: 'close' })}</header>
      <p class="hint">${t(classroom ? 'classroomOn' : 'chapterHint')}</p><div class="chap-grid">${cards}</div></div>`, {
      keep: fromPause, cls: fromPause ? 'overlay' : '',
      handlers: { back: () => (fromPause ? this.close() : this.title()), playChap: (b) => this.confirm(t('confirmChapter'), () => this.app.playChapter(b.dataset.ch)) },
      onBack: () => (fromPause ? this.close() : this.title()),
    });
  }

  // ======================================================== CHAPTER CARD & TRAVEL
  chapterCard(ch, onGo) {
    const html = `<div class="chapter-card">
      <div class="cc-num">${ch.num === 0 ? t('prologue') : t('chapterN', { n: ch.num })}</div>
      <div class="cc-years">${esc(ch.years)}</div>
      <h1>${t(ch.title)}</h1>
      <div class="cc-meta"><span>${ICON.map}${t(ch.region)}</span><span>${ICON.squad}${t(ch.unit)}</span></div>
      <p class="cc-intro">${t(ch.intro)}</p>
      <div class="cc-badges"><span class="badge fact">${t('badgeFact')}</span><span class="badge made">${t('badgeMade')}</span></div>
      ${this.btn('go', t('continue'), { cls: 'primary', icon: 'depart' })}
    </div>`;
    this.open('chaptercard', html, { handlers: { go: onGo }, onBack: onGo });
  }

  // ======================================================== BRIEFING
  briefing(m, onBegin) {
    const P = this.app.progress;
    const prot = m.protagonist;
    const lo = this.app.currentLoadout(m);
    const w = WEAPONS[prot.weapon || 'none'];
    const squad = (m.squad || []).map((s) => {
      const lost = P.isLost(s.id), inj = P.companion(s.id)?.injured;
      return `<li class="${lost ? 'lost' : ''}"><span class="ic">${ICON[s.role] || ICON.rifle}</span><b>${t(s.name)}</b> <small>${t('role_' + s.role)}${lost ? ' · ' + t('sq_lost') : inj ? ' · ' + t('sq_injured') : ''}</small></li>`;
    }).join('');
    const html = `<div class="panel brief">
      <header class="brief-head">
        <div class="brief-stamp"><div class="bs-date">${t(m.date)}</div><div class="bs-place">${t(m.place)}</div></div>
        <div><div class="brief-chap">${t(m.chapterLabel)}</div><h2>${t(m.title)}</h2>
        <div class="brief-unit">${ICON.squad}<span>${t(m.unit)}</span></div></div>
      </header>
      <div class="brief-grid">
        <div class="brief-col">
          <h4>${t('youAre')}</h4>
          <p class="prot"><b>${t(prot.name)}</b> — ${t(prot.desc)} <span class="badge made small">${t('fictional')}</span></p>
          <h4>${t('situation')}</h4>
          <div class="brief-text">${(m.briefing || []).map((p) => `<p>${t(p)}</p>`).join('')}</div>
          <h4>${t('plan')}</h4>
          <ol class="brief-obj">${m.objectives.filter((o) => !o.hidden).map((o) => `<li>${t(o.text)}</li>`).join('')}</ol>
        </div>
        <div class="brief-col side">
          <h4>${t('squad')}</h4><ul class="brief-squad">${squad || `<li class="muted">${t('alone')}</li>`}</ul>
          <h4>${t('loadout')}</h4>
          <ul class="brief-load">
            ${w.mag ? `<li>${ICON.rifle}<span>${t(w.name)}</span></li><li>${ICON.ammo}<span>${t('roundsN', { n: lo.ammo })}</span></li>` : `<li>${ICON.liaison}<span>${t('unarmed')}</span></li>`}
            <li>${ICON.bandage}<span>${t('bandagesN', { n: lo.bandages })}</span></li>
            <li>${ICON.food}<span>${t(lo.food ? 'rationsPacked' : 'noRations')}</span></li>
            ${Object.entries(this.app.progress.s.equip).filter(([, v]) => v).map(([k]) => `<li>${ICON.check}<span>${t('eq_' + k)}</span></li>`).join('')}
          </ul>
          <div class="brief-hist"><span class="badge fact">${t('badgeFact')}</span><p>${t(m.historyNote)}</p>
          <span class="badge made">${t('badgeMade')}</span><p>${t(m.createdNote)}</p></div>
        </div>
      </div>
      <footer>${this.btn('sources', t('sources'), { icon: 'book', cls: 'ghost' })}${this.btn('begin', t('begin'), { cls: 'primary', icon: 'depart' })}</footer>
    </div>`;
    this.open('briefing', html, { handlers: { begin: onBegin, sources: () => this.refsFor(m.chapter) }, onBack: () => {} });
  }
  refsFor(chId) {
    const ch = this.app.data.CHAPTERS.find((c) => c.id === chId);
    this.open('refs', `<div class="panel"><header><h2>${t('sources')}</h2>${this.btn('back', t('back'), { cls: 'ghost', icon: 'close' })}</header>${this.refList(ch?.refs || [])}${this.factBlock(ch)}</div>`, { keep: true, cls: 'overlay', handlers: { back: () => this.close() } });
  }
  refList(ids) {
    return `<ul class="refs">${ids.map((id) => REFS[id]).filter(Boolean).map((r) => `<li><b>${t(r.title)}</b><br><small>${t(r.org)}</small>${r.url ? `<br><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>` : ''}</li>`).join('')}</ul>`;
  }
  factBlock(ch) {
    if (!ch?.history) return '';
    return `<div class="factblock"><h4><span class="badge fact">${t('badgeFact')}</span></h4><ul>${ch.history.facts.map((f) => `<li>${t(f)}</li>`).join('')}</ul>
      <h4><span class="badge made">${t('badgeMade')}</span></h4><ul>${ch.history.created.map((f) => `<li>${t(f)}</li>`).join('')}</ul></div>`;
  }

  // ======================================================== RESULTS / FAIL
  results(m, sum, onNext) {
    const s = sum.stats;
    const squad = sum.squad.map((a) => `<li class="${a.state}"><b>${t(a.name)}</b><span>${t('res_' + a.state)}</span></li>`).join('');
    const xp = Object.entries(sum.xp).filter(([, v]) => v > 0).map(([k, v]) => `<li><span>${t('xp_' + k)}</span><b>+${Math.round(v)}</b></li>`).join('');
    const pid = m.protagonist.id, P = this.app.progress;
    const skills = SKILLS.map((k) => { const lp = P.levelProgress(pid, k); return `<li><span>${t('skill_' + k)}</span><div class="lv"><b>${lp.l}</b><i style="width:${Math.round(lp.k * 100)}%"></i></div></li>`; }).join('');
    const opt = sum.optional.map((o) => `<li class="${o.complete ? 'ok' : 'no'}">${o.complete ? ICON.check : ICON.close}${t(o.text)}</li>`).join('');
    const rewards = Object.entries(sum.rewards || {}).map(([k, v]) => `<span class="res-chip">${ICON[k] || ''}${t('org_' + k)} ${v > 0 ? '+' : ''}${v}</span>`).join('');
    const html = `<div class="panel results">
      <header><div><div class="brief-chap">${t(m.chapterLabel)} · ${t(m.date)}</div><h2>${t('missionComplete')}: ${t(m.title)}</h2></div></header>
      <div class="res-grid">
        <div><h4>${t('companions')}</h4><ul class="res-squad">${squad || `<li>${t('alone')}</li>`}</ul>
          ${opt ? `<h4>${t('optionalObj')}</h4><ul class="res-opt">${opt}</ul>` : ''}
          <h4>${t('fieldRecord')}</h4>
          <ul class="res-stats">
            <li><span>${t('st_observed')}</span><b>${s.observed}</b></li><li><span>${t('st_treated')}</span><b>${s.treated}</b></li>
            <li><span>${t('st_civ')}</span><b>${s.civiliansSafe}</b></li><li><span>${t('st_alerts')}</span><b>${s.alerts}</b></li>
            <li><span>${t('st_shots')}</span><b>${s.shots}</b></li><li><span>${t('st_shared')}</span><b>${s.ammoShared}</b></li>
            <li><span>${t('st_time')}</span><b>${Math.floor(sum.time / 60)}:${String(Math.floor(sum.time % 60)).padStart(2, '0')}</b></li>
          </ul>
          ${rewards ? `<h4>${t('supplies')}</h4><div class="res-chips">${rewards}</div>` : ''}
        </div>
        <div><h4>${t('xpEarned')}</h4><ul class="res-xp">${xp || `<li>—</li>`}</ul>
          <h4>${t('skillsOf', { name: m.protagonist.name })}</h4><ul class="res-skills">${skills}</ul>
          <div class="brief-hist"><span class="badge fact">${t('whatHappened')}</span>${(m.after || []).map((p) => `<p>${t(p)}</p>`).join('')}</div>
        </div>
      </div>
      <footer>${this.btn('next', t('continue'), { cls: 'primary', icon: 'depart' })}</footer></div>`;
    this.open('results', html, { handlers: { next: onNext } });
  }
  failed(m, reason, cp, { retryCp, restart, quit }) {
    const html = `<div class="panel fail"><h2>${t('missionFailed')}</h2><p class="fail-reason">${t('fail_' + reason)}</p><p class="hint">${t('failTip_' + reason)}</p>
      <div class="row">${cp > 0 ? this.btn('cp', t('retryCheckpoint'), { cls: 'primary', icon: 'reload' }) : ''}${this.btn('restart', t('restartMission'), { cls: cp > 0 ? '' : 'primary', icon: 'reload' })}${this.btn('quit', t('quitTitle'), { cls: 'ghost' })}</div></div>`;
    this.open('fail', html, { handlers: { cp: retryCp, restart, quit } });
  }

  // ======================================================== PAUSE / LOG / MAP
  pause() {
    const g = this.app.game;
    const html = `<div class="panel pause"><header><h2>${t('paused')}</h2><div class="pause-sub">${t(g.def.title)} · ${t(g.def.date)}</div></header>
      <nav class="menu">${this.btn('resume', t('resume'), { cls: 'primary', icon: 'depart' })}${this.btn('log', t('missionLog'), { icon: 'journal' })}${this.btn('archive', t('archive'), { icon: 'book' })}
      ${this.btn('settings', t('settings'), { icon: 'gear' })}${g.mission.checkpointIndex > 0 ? this.btn('cp', t('restartCheckpoint'), { icon: 'reload' }) : ''}${this.btn('restart', t('restartMission'), { icon: 'reload' })}
      ${g.def.hub ? '' : this.btn('chapters', t('restartChapter'), { icon: 'map' })}${this.btn('quit', t('quitTitle'), { cls: 'ghost' })}</nav>${this.langToggle()}</div>`;
    this.open('pause', html, { cls: 'overlay', handlers: {
      resume: () => this.app.resume(), log: () => this.log('obj'), archive: () => this.archive(true), settings: () => this.settings(true),
      cp: () => this.confirm(t('confirmRestart'), () => this.app.restartMission(true)), restart: () => this.confirm(t('confirmRestart'), () => this.app.restartMission(false)),
      chapters: () => this.confirm(t('confirmRestart'), () => this.app.playChapter(g.def.chapter)), quit: () => this.confirm(t('confirmQuit'), () => this.app.quitToTitle()),
    }, onBack: () => this.app.resume() });
  }
  log(tab = 'obj') {
    this.logOpened = true;
    const g = this.app.game, m = g.mission;
    const tabs = ['obj', 'journal', 'map', 'squad'];
    const objs = m.objectives.map((o, i) => `<li class="${i < m.index ? 'done' : i === m.index ? 'cur' : 'todo'}">${i < m.index ? ICON.check : i === m.index ? ICON.objective : ''}<span>${i <= m.index || !o.hidden ? t(o.text) : '…'}</span></li>`).join('');
    const opts = m.optional.map((o) => `<li class="${o.complete ? 'done' : o.failed ? 'failed' : 'cur'}">${o.complete ? ICON.check : ''}<span>${t(o.text)}</span></li>`).join('');
    const journal = g.journal.length ? g.journal.map((j) => `<li><span class="jt">${Math.floor(j.t / 60)}:${String(Math.floor(j.t % 60)).padStart(2, '0')}</span>${this.journalText(j, g)}</li>`).join('') : `<li class="muted">${t('journalEmpty')}</li>`;
    const squad = g.squad.map((a) => `<li><b>${t(a.name)}</b> <small>${t('role_' + a.role)}</small><span>${t('sq_' + (a.state === 'wounded' ? (a.treated ? 'stable' : 'bleeding') : a.state === 'ok' ? a.order : a.state))}</span><span>${ICON.ammo}${a.ammo + a.reserve}</span></li>`).join('') || `<li class="muted">${t('alone')}</li>`;
    const body = { obj: `<h4>${t('objectives')}</h4><ul class="log-obj">${objs}</ul>${opts ? `<h4>${t('optionalObj')}</h4><ul class="log-obj">${opts}</ul>` : ''}<div class="brief-hist"><span class="badge made">${t('badgeMade')}</span><p>${t(g.def.createdNote)}</p></div>`,
      journal: `<p class="hint">${t('journalHint')}</p><ul class="journal">${journal}</ul>`,
      map: `<canvas id="tacmap" class="tacmap"></canvas><div class="maplegend">${t('mapLegend')}</div>`,
      squad: `<ul class="log-squad">${squad}</ul><h4>${t('carrying')}</h4><p>${ICON.ammo} ${g.player.ammo + g.player.reserve} · ${ICON.bandage} ${g.player.bandages}</p>` }[tab];
    const html = `<div class="panel log"><header><h2>${t('missionLog')}</h2>${this.btn('back', t('back'), { cls: 'ghost', icon: 'close' })}</header>
      <div class="tabs">${tabs.map((k) => `<button class="tab ${k === tab ? 'on' : ''}" data-act="tab" data-tab="${k}">${t('tab_' + k)}</button>`).join('')}</div><div class="tabbody">${body}</div></div>`;
    if (this.top?.name === 'log') { this.top.el.remove(); this.stack.pop(); }
    this.open('log', html, { keep: true, cls: 'overlay', handlers: { back: () => this.close(), tab: (b) => this.log(b.dataset.tab) } });
    if (tab === 'map') setTimeout(() => drawTacticalMap(document.getElementById('tacmap'), g), 20);
  }
  journalText(j, g) {
    const pos = j.x != null ? this.gridRef(j.x, j.z, g) : '';
    const lab = t('lab_' + (j.label || 'soldier'));
    if (j.type === 'enemy') return `${ICON.eye}<span>${t('jr_enemy', { what: lab, pos })}${j.by ? ' — ' + t('jr_by', { name: j.by }) : ''}</span>`;
    if (j.type === 'route') return `${ICON.map}<span>${t('jr_route', { what: lab, pos })}</span>`;
    if (j.type === 'clue') return `${ICON.info}<span>${t(j.text)}</span>`;
    return `<span>${t(j.text || '')}</span>`;
  }
  gridRef(x, z, g) { const T = g.terrain; const cols = 'ABCDEFGH'; const c = Math.floor((-x + T.half) / T.size * 8), r = Math.floor((T.half - z) / T.size * 8); return `${cols[Math.max(0, Math.min(7, c))]}${Math.max(1, Math.min(8, r + 1))}`; }
  journalPing() { /* reserved: flash log icon */ }

  // ======================================================== HUB STATIONS
  station(kind) {
    const app = this.app, P = app.progress, org = P.org, hub = app.hubState();
    const slots = hub.slots;
    const H = {};
    const cost = (k, n) => `${ICON[k]}<b>${n}</b>`;
    const useSlot = (fn) => () => { if (hub.slots <= 0) { app.hud.toast('noTime', 'warn'); return; } fn(); hub.slots--; P.save(); this.station(kind); };
    let body = '';
    const m = app.nextMissionDef();
    const companions = (app.currentChapter().companions || []).map((id) => ({ id, ...(app.data.COMPANIONS[id] || {}) })).filter((c) => !P.isLost(c.id));
    if (kind === 'training') {
      const pid = app.currentProtagonist().id;
      body = `<p>${t('st_training_desc')}</p><ul class="opts">${SKILLS.map((k) => { const lp = P.levelProgress(pid, k); return `<li><div><b>${t('skill_' + k)}</b> <small>${t('lvl')} ${lp.l}</small><p>${t('drill_' + k)}</p></div>${this.btn('drill', t('train'), { attrs: `data-k="${k}"`, dis: slots <= 0 || (k === 'marksmanship' && org.ammo < 5) || org.food < 1, cls: 'small' })}</li>`; }).join('')}</ul><p class="hint">${t('drillCost')}</p>`;
      H.drill = (b) => useSlot(() => { const k = b.dataset.k; P.addOrg({ food: -1, ...(k === 'marksmanship' ? { ammo: -5 } : {}) }); const r = P.addXP(app.currentProtagonist().id, 'training_' + k, 45); app.toastAnywhere(r.levelUp ? { en: `${L('skill_' + k)} → level ${r.levelUp.level}`, ko: `${L('skill_' + k)} → ${r.levelUp.level}단계` } : 'trained'); })();
    } else if (kind === 'maintenance') {
      const pid = app.currentProtagonist().id, cond = P.s.condition[pid] ?? 0.8;
      body = `<p>${t('st_maint_desc')}</p><div class="meter"><span>${t('condition')}</span><div class="mbar"><i style="width:${Math.round(cond * 100)}%"></i></div><b>${Math.round(cond * 100)}%</b></div>
        <ul class="opts"><li><div><b>${t('cleanRifle')}</b><p>${t('cleanRifle_d')}</p></div>${this.btn('clean', cost('parts', 1), { dis: slots <= 0 || org.parts < 1 || cond >= 1, cls: 'small' })}</li>
        <li><div><b>${t('eq_cleanBolt')}</b><p>${t('cleanBolt_d')}</p></div>${P.s.equip.cleanBolt ? `<span class="owned">${ICON.check}</span>` : this.btn('bolt', cost('parts', 2), { dis: slots <= 0 || org.parts < 2, cls: 'small' })}</li></ul>`;
      H.clean = useSlot(() => { P.addOrg({ parts: -1 }); P.s.condition[pid] = Math.min(1, cond + 0.2); });
      H.bolt = useSlot(() => { P.addOrg({ parts: -2 }); P.s.equip.cleanBolt = true; });
    } else if (kind === 'tailor') {
      body = `<p>${t('st_tailor_desc')}</p><ul class="opts">
        <li><div><b>${t('eq_warmClothes')}</b><p>${t('warm_d')}</p></div>${P.s.equip.warmClothes ? `<span class="owned">${ICON.check}</span>` : this.btn('warm', cost('cloth', 2), { dis: slots <= 0 || org.cloth < 2, cls: 'small' })}</li>
        <li><div><b>${t('eq_camo')}</b><p>${t('camo_d')}</p></div>${P.s.equip.camo ? `<span class="owned">${ICON.check}</span>` : this.btn('camo', cost('cloth', 1), { dis: slots <= 0 || org.cloth < 1, cls: 'small' })}</li>
        <li><div><b>${t('mendClothes')}</b><p>${t('mend_d')}</p></div>${this.btn('mend', cost('cloth', 1), { dis: slots <= 0 || org.cloth < 1, cls: 'small' })}</li></ul>`;
      H.warm = useSlot(() => { P.addOrg({ cloth: -2 }); P.s.equip.warmClothes = true; });
      H.camo = useSlot(() => { P.addOrg({ cloth: -1 }); P.s.equip.camo = true; });
      H.mend = useSlot(() => { P.addOrg({ cloth: -1, trust: 4 }); app.toastAnywhere('mended'); });
    } else if (kind === 'kitchen') {
      const fed = hub.fed || (hub.fed = {});
      body = `<p>${t('st_kitchen_desc')}</p><ul class="opts">${companions.map((c) => `<li><div><b>${t(c.name)}</b><p>${fed[c.id] ? t('fedYes') : t('fedNo')}</p></div>${fed[c.id] ? `<span class="owned">${ICON.check}</span>` : this.btn('feed', cost('food', 1), { attrs: `data-id="${c.id}"`, dis: org.food < 1, cls: 'small' })}</li>`).join('')}
        <li><div><b>${t('packRations')}</b><p>${t('packRations_d')}</p></div>${hub.rations ? `<span class="owned">${ICON.check}</span>` : this.btn('ration', cost('food', 1), { dis: org.food < 1, cls: 'small' })}</li>
        <li><div><b>${t('shareVillage')}</b><p>${t('shareVillage_d')}</p></div>${this.btn('share', cost('food', 2), { dis: org.food < 2 || hub.shared, cls: 'small' })}</li></ul>`;
      H.feed = (b) => { P.addOrg({ food: -1 }); fed[b.dataset.id] = true; P.setCompanion(b.dataset.id, { fed: true }); P.save(); this.station(kind); };
      H.ration = () => { P.addOrg({ food: -1 }); hub.rations = true; P.save(); this.station(kind); };
      H.share = () => { P.addOrg({ food: -2, trust: 12 }); hub.shared = true; app.toastAnywhere('sharedFood'); P.save(); this.station(kind); };
    } else if (kind === 'infirmary') {
      const injured = companions.filter((c) => P.companion(c.id)?.injured);
      body = `<p>${t('st_infirm_desc')}</p><ul class="opts">
        <li><div><b>${t('rollBandages')}</b><p>${t('rollBandages_d', { n: hub.bandages || 0 })}</p></div>${this.btn('band', cost('medicine', 1), { dis: org.medicine < 1, cls: 'small' })}</li>
        ${injured.map((c) => `<li><div><b>${t(c.name)}</b><p>${t('injuredRest')}</p></div>${this.btn('heal', cost('medicine', 1), { attrs: `data-id="${c.id}"`, dis: slots <= 0 || org.medicine < 1, cls: 'small' })}</li>`).join('')}
        <li><div><b>${t('eq_stretcher')}</b><p>${t('stretcher_d')}</p></div>${P.s.equip.stretcher ? `<span class="owned">${ICON.check}</span>` : this.btn('stretch', `${cost('parts', 1)}${cost('cloth', 1)}`, { dis: slots <= 0 || org.parts < 1 || org.cloth < 1, cls: 'small' })}</li>
        <li><div><b>${t('eq_fieldKit')}</b><p>${t('fieldKit_d')}</p></div>${P.s.equip.fieldKit ? `<span class="owned">${ICON.check}</span>` : this.btn('kit', `${cost('medicine', 2)}`, { dis: slots <= 0 || org.medicine < 2, cls: 'small' })}</li></ul>`;
      H.band = () => { P.addOrg({ medicine: -1 }); hub.bandages = (hub.bandages || 0) + 2; P.save(); this.station(kind); };
      H.heal = (b) => useSlot(() => { P.addOrg({ medicine: -1 }); P.setCompanion(b.dataset.id, { injured: false }); })();
      H.stretch = useSlot(() => { P.addOrg({ parts: -1, cloth: -1 }); P.s.equip.stretcher = true; });
      H.kit = useSlot(() => { P.addOrg({ medicine: -2 }); P.s.equip.fieldKit = true; });
    } else if (kind === 'letters') {
      const ch = app.currentChapter();
      const L2 = ch.letter;
      body = L2 ? `<article class="letter"><div class="letter-from">${t(L2.from)}</div>${L2.body.map((p) => `<p>${t(p)}</p>`).join('')}<div class="badge made small">${t('badgeMade')}</div></article>
        ${hub.wrote ? `<p class="hint">${t('wroteBack')}</p>` : this.btn('write', t('writeBack'), { cls: 'primary small' })}` : `<p>${t('noLetters')}</p>`;
      H.write = () => { hub.wrote = true; P.addXP(app.currentProtagonist().id, 'teamwork', 12); P.save(); app.toastAnywhere('wrote'); this.station(kind); };
    } else if (kind === 'talk') {
      const talked = hub.talked || (hub.talked = {});
      body = `<p>${t('st_talk_desc')}</p><div class="talks">${companions.map((c) => {
        const line = (app.currentChapter().talks || {})[c.id];
        return `<div class="talk"><div class="talk-h"><span class="ic">${ICON[c.role] || ICON.rifle}</span><b>${t(c.name)}</b><small>${t('role_' + c.role)}</small></div>
          ${talked[c.id] && line ? line.map((l) => `<p>${t(l)}</p>`).join('') : this.btn('talk', t('sitWith'), { attrs: `data-id="${c.id}"`, cls: 'small', dis: !line })}</div>`;
      }).join('') || `<p class="muted">${t('alone')}</p>`}</div><div class="badge made small">${t('badgeMade')}</div>`;
      H.talk = (b) => { talked[b.dataset.id] = true; P.addXP(app.currentProtagonist().id, 'teamwork', 10); P.save(); this.station(kind); };
    } else if (kind === 'supply') {
      const lo = app.currentLoadout(m);
      const res = ['food', 'ammo', 'medicine', 'cloth', 'parts', 'funds'].map((k) => `<li>${ICON[k]}<span>${t('org_' + k)}</span><b>${org[k]}</b></li>`).join('');
      const w = WEAPONS[m?.protagonist?.weapon || 'none'];
      body = `<p>${t('st_supply_desc')}</p><ul class="org">${res}<li>${ICON.trust}<span>${t('org_trust')}</span><b>${org.trust}</b></li><li>${ICON.network}<span>${t('org_network')}</span><b>${org.network}</b></li></ul>
        ${m && w.mag ? `<div class="meter"><span>${t('carryAmmo')}</span><input type="range" min="5" max="${Math.max(5, Math.min(40, org.ammo))}" step="5" value="${lo.ammo}" data-act-input="ammo" id="ammoSlider"><b id="ammoVal">${lo.ammo}</b></div><p class="hint">${t('ammoHint')}</p>` : ''}
        <ul class="opts"><li><div><b>${t('supportNetwork')}</b><p>${t('supportNetwork_d')}</p></div>${this.btn('net', cost('funds', 1), { dis: org.funds < 1 || org.network >= 100, cls: 'small' })}</li>
        <li><div><b>${t('buyMedicine')}</b><p>${t('buyMedicine_d')}</p></div>${this.btn('buymed', cost('funds', 2), { dis: org.funds < 2, cls: 'small' })}</li></ul>`;
      H.net = () => { P.addOrg({ funds: -1, network: 12 }); P.save(); this.station(kind); };
      H.buymed = () => { P.addOrg({ funds: -2, medicine: 1 }); P.save(); this.station(kind); };
    } else if (kind === 'depart') {
      body = `<p>${t('departQ')}</p><p class="hint">${t('slotsLeft', { n: slots })}</p>${this.btn('go', t('depart'), { cls: 'primary', icon: 'depart' })}`;
      H.go = () => { this.closeStation(); app.game.mission.flag('depart'); };
    }
    const html = `<div class="panel station"><header><span class="st-ic">${ICON[{ training: 'train', maintenance: 'parts', tailor: 'cloth', kitchen: 'food', infirmary: 'medic', letters: 'letter', talk: 'talk', supply: 'network', depart: 'depart' }[kind]]}</span><h2>${t('station_' + kind)}</h2>
      <div class="slots">${[0, 1, 2].map((i) => `<i class="${i < slots ? 'on' : ''}" title="${t('timeSlot')}"></i>`).join('')}<small>${t('slotsLeft', { n: slots })}</small></div>${this.btn('closeSt', t('back'), { cls: 'ghost', icon: 'close' })}</header>
      <div class="st-body">${body}</div></div>`;
    if (this.top?.name === 'station') { this.top.el.remove(); this.stack.pop(); }
    const el = this.open('station', html, { keep: true, cls: 'overlay', handlers: { ...H, closeSt: () => this.closeStation() }, onBack: () => this.closeStation() });
    const sl = el.querySelector('#ammoSlider');
    if (sl) sl.addEventListener('input', () => { app.setLoadoutAmmo(parseInt(sl.value, 10)); el.querySelector('#ammoVal').textContent = sl.value; });
    app.setPaused(true, true);
  }
  closeStation() { if (this.top?.name === 'station') this.close(); this.app.setPaused(false, true); }

  // ======================================================== ARCHIVE
  archive(fromPause = false, tab = 'people', sel = null) {
    const tabs = ['people', 'units', 'events', 'equipment', 'flags', 'timeline', 'chapters', 'refs', 'about'];
    let body = '';
    if (['people', 'units', 'events', 'equipment', 'flags'].includes(tab)) {
      const list = CODEX[tab];
      const cur = list.find((e) => e.id === sel) || list[0];
      body = `<div class="codex"><ul class="codex-list">${list.map((e) => `<li><button class="${e.id === cur.id ? 'on' : ''}" data-act="entry" data-id="${e.id}">${t(e.name)}${e.years ? `<small>${esc(e.years)}</small>` : ''}</button></li>`).join('')}</ul>
        <article class="codex-entry"><h3>${t(cur.name)}</h3>${cur.years ? `<div class="ce-years">${esc(cur.years)}</div>` : ''}${cur.hanja ? `<div class="ce-hanja">${esc(cur.hanja)}</div>` : ''}
        ${cur.flag ? `<canvas class="flagcv" data-flag="${cur.flag}" width="384" height="256"></canvas>` : ''}
        <span class="badge fact">${t('badgeFact')}</span>${cur.text.map((p) => `<p>${t(p)}</p>`).join('')}
        ${cur.game ? `<span class="badge made">${t('inGame')}</span><p>${t(cur.game)}</p>` : ''}
        ${cur.note ? `<p class="note">${ICON.info}${t(cur.note)}</p>` : ''}
        ${cur.refs ? `<div class="ce-refs">${t('sources')}: ${cur.refs.map((r) => REFS[r] ? (REFS[r].url ? `<a href="${esc(REFS[r].url)}" target="_blank" rel="noopener">${esc(t(REFS[r].title))}</a>` : esc(t(REFS[r].title))) : esc(r)).join(' · ')}</div>` : ''}</article></div>`;
    } else if (tab === 'timeline') {
      body = `<ol class="timeline">${TIMELINE.map((e) => `<li class="${e.game ? 'has-game' : ''}"><div class="tl-date">${esc(e.date)}</div><div class="tl-body"><b>${t(e.text)}</b>${e.game ? `<span class="badge made small">${t('playable')}: ${t(e.game)}</span>` : ''}</div></li>`).join('')}</ol>`;
    } else if (tab === 'chapters') {
      body = this.app.data.CHAPTERS.map((c) => `<section class="chap-hist"><h3>${c.num === 0 ? t('prologue') : t('chapterN', { n: c.num })} · ${t(c.title)} <small>${esc(c.years)}</small></h3>${this.factBlock(c)}${this.refList(c.refs)}</section>`).join('');
    } else if (tab === 'refs') {
      body = `<p class="hint">${t('refsIntro')}</p>${this.refList(Object.keys(REFS))}`;
    } else if (tab === 'about') {
      body = `<div class="about">${['about1', 'about2', 'about3', 'about4', 'about5', 'about6'].map((k) => `<p>${t(k)}</p>`).join('')}</div>`;
    }
    const html = `<div class="panel wide archive"><header><h2>${t('archive')}</h2>${this.btn('back', t('back'), { cls: 'ghost', icon: 'close' })}</header>
      <div class="tabs scroll">${tabs.map((k) => `<button class="tab ${k === tab ? 'on' : ''}" data-act="atab" data-tab="${k}">${t('atab_' + k)}</button>`).join('')}</div><div class="tabbody">${body}</div></div>`;
    const keep = fromPause || this.top?.name === 'archive';
    if (this.top?.name === 'archive') { this.top.el.remove(); this.stack.pop(); }
    const goBack = () => (fromPause ? this.close() : this.title());
    const el = this.open('archive', html, { keep: fromPause, cls: fromPause ? 'overlay' : '', handlers: { back: goBack, atab: (b) => this.archive(fromPause, b.dataset.tab), entry: (b) => this.archive(fromPause, tab, b.dataset.id) }, onBack: goBack });
    void keep;
    el.querySelectorAll('.flagcv').forEach((cv) => import('../world/props.js').then(({ flagTexture }) => { const tex = flagTexture(cv.dataset.flag); cv.getContext('2d').drawImage(tex.image, 0, 0); }));
  }

  // ======================================================== SETTINGS
  settings(fromPause = false, tab = 'gameplay') {
    const S = this.app.settings, inp = this.app.input;
    const tabs = ['gameplay', 'controls', 'access', 'audio', 'graphics'];
    const sel = (key, opts) => `<select data-set="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(S[key]) === String(v) ? 'selected' : ''}>${t(l)}</option>`).join('')}</select>`;
    const rng = (key, min, max, step) => `<input type="range" min="${min}" max="${max}" step="${step}" value="${S[key]}" data-set="${key}">`;
    const chk = (key) => `<input type="checkbox" ${S[key] ? 'checked' : ''} data-set="${key}">`;
    const row = (label, ctl, hint = '') => `<div class="srow"><label>${t(label)}${hint ? `<small>${t(hint)}</small>` : ''}</label><div class="sctl">${ctl}</div></div>`;
    let body = '';
    if (tab === 'gameplay') body = row('language', sel('lang', [['en', 'English'], ['ko', '한국어']])) + row('difficulty', sel('difficulty', Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label])), 'difficulty_h') + row('aimAssist', sel('aimAssist', [[0, 'off'], [1, 'low'], [2, 'high']]), 'aimAssist_h') + row('autoReload', chk('autoReload')) + row('allyTags', chk('allyTags')) + row('classroom', chk('classroom'), 'classroom_h');
    else if (tab === 'controls') {
      const rows = REBINDABLE.filter((a) => !a.startsWith('move') || true).map((a) => `<div class="srow bind"><label>${t('act_' + a)}</label><div class="sctl"><button class="kbtn rebind-capture" data-act="rebind" data-a="${a}" data-dev="kb">${esc((inp.keys[a] || []).map(keyLabel).join(' / ') || '—')}</button><button class="kbtn rebind-capture" data-act="rebind" data-a="${a}" data-dev="pad">${esc((inp.pad[a] || []).map(padLabel).join(' / ') || '—')}</button></div></div>`).join('');
      body = row('sensitivity', rng('sensitivity', 0.3, 2.5, 0.1)) + row('padSensitivity', rng('padSensitivity', 0.3, 2.5, 0.1)) + row('invertY', chk('invertY')) +
        `<h4>${t('keyBindings')}</h4><div class="bindhead"><span></span><span>${t('keyboardMouse')}</span><span>${t('gamepad')}</span></div>${rows}<div class="row">${this.btn('resetBinds', t('resetBindings'), { cls: 'ghost small' })}</div><p class="hint">${t('rebindHint')}</p>`;
    } else if (tab === 'access') body = row('subtitleSize', sel('subSize', [['s', 'small'], ['m', 'medium'], ['l', 'large'], ['xl', 'xlarge']])) + row('subBg', chk('subBg')) + row('sfxCaptions', chk('sfxCaptions'), 'sfxCaptions_h') +
      row('colorblind', sel('colorblind', [['off', 'off'], ['deutan', 'cb_deutan'], ['protan', 'cb_protan'], ['tritan', 'cb_tritan']]), 'colorblind_h') + row('shake', rng('shake', 0, 1, 0.1), 'shake_h') + row('reduceMotion', chk('reduceMotion')) + row('highContrast', chk('highContrast')) + row('holdToggle', chk('holdToggle'), 'holdToggle_h');
    else if (tab === 'audio') body = ['master', 'music', 'sfx', 'amb', 'ui'].map((k) => row('vol_' + k, rng('vol_' + k, 0, 1, 0.05))).join('');
    else if (tab === 'graphics') body = row('quality', sel('quality', [['low', 'low'], ['medium', 'medium'], ['high', 'high']]), 'quality_h') + row('outlines', chk('outlines'), 'outlines_h') + row('grain', rng('grain', 0, 1, 0.1));
    const html = `<div class="panel settings"><header><h2>${t('settings')}</h2>${this.btn('back', t('back'), { cls: 'ghost', icon: 'close' })}</header>
      <div class="tabs">${tabs.map((k) => `<button class="tab ${k === tab ? 'on' : ''}" data-act="stab" data-tab="${k}">${t('stab_' + k)}</button>`).join('')}</div><div class="tabbody">${body}</div></div>`;
    if (this.top?.name === 'settings') { this.top.el.remove(); this.stack.pop(); }
    const goBack = () => { this.app.saveSettings(); fromPause ? this.close() : this.title(); };
    this.open('settings', html, { keep: fromPause, cls: fromPause ? 'overlay' : '', handlers: {
      back: goBack, stab: (b) => this.settings(fromPause, b.dataset.tab),
      rebind: (b) => { b.textContent = L('pressKey'); b.classList.add('wait'); inp.beginRebind(b.dataset.a, b.dataset.dev, 0, () => { this.app.saveSettings(); this.settings(fromPause, 'controls'); }); },
      resetBinds: () => { inp.resetBindings(); this.app.saveSettings(); this.settings(fromPause, 'controls'); },
    }, onBack: goBack });
  }
  credits() {
    const html = `<div class="panel"><header><h2>${t('credits')}</h2>${this.btn('back', t('back'), { cls: 'ghost', icon: 'close' })}</header>
      <div class="about">${['cr1', 'cr2', 'cr3', 'cr4', 'cr5'].map((k) => `<p>${t(k)}</p>`).join('')}</div></div>`;
    this.open('credits', html, { handlers: { back: () => this.title() }, onBack: () => this.title() });
  }
  ending(lines, onDone) {
    const html = `<div class="ending">${lines.map((p, i) => `<p style="animation-delay:${i * 1.6}s">${t(p)}</p>`).join('')}<div style="animation-delay:${lines.length * 1.6}s" class="end-btn">${this.btn('done', t('continue'), { cls: 'primary' })}</div></div>`;
    this.open('ending', html, { handlers: { done: onDone } });
  }
}
