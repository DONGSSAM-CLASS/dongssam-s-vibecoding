// Full-journey flow test: new journey from the title, clicking the real buttons through every chapter card,
// travel map, briefing, mission (completed by script — missions are covered by run_all/play_* tests),
// results screen and hub, up to the ending and credits. Captures screenshots of each screen type.
// usage: node tests/flow.mjs <outDir> [--mobile] [--ko]
import { launch } from './bot.mjs';
import fs from 'node:fs';

const out = process.argv[2] || 'shots';
const mobile = process.argv.includes('--mobile'), ko = process.argv.includes('--ko');
fs.mkdirSync(out, { recursive: true });
const t = await launch(mobile ? { w: 844, h: 390, mobile: true } : { w: 1280, h: 720 });
const tag = (mobile ? 'm_' : 'd_') + (ko ? 'ko_' : 'en_');
const shot = async (name) => { await t.p.waitForFunction(() => { const s = window.__app.ui.top; return !s || s.el.classList.contains('in'); }, null, { timeout: 10000 }).catch(() => {}); await t.realWait(900); await t.shot(`${out}/${tag}${name}.png`); };
const seen = new Set();
const once = async (name) => { if (seen.has(name)) return; seen.add(name); await shot(name); };
const info = () => t.eval(() => { const a = window.__app; return { state: a.state, ui: a.ui.top?.name, step: a.progress.s.step, travel: !!document.querySelector('.s-travel'), running: a.game.running, hub: !!a.game.def?.hub, mid: a.game.def?.id }; });
const click = async (sel) => { await t.p.click(sel, { timeout: 8000 }); await t.realWait(250); };

await t.eval(() => { localStorage.removeItem('tfw_save_v1'); });
await t.p.reload(); await t.p.waitForFunction(() => window.__app?.ui?.top?.name === 'title', null, { timeout: 30000 }); await t.realWait(600);
await t.eval(() => window.__app.renderer.setQuality('low'));
if (ko) await click('[data-act="lang"][data-lang="ko"]');
await shot('01_title');
// side screens from the title
await click('[data-act="archive"]'); await shot('02_archive'); await click('.s-archive [data-act="back"], [data-act="back"]');
await click('[data-act="settings"]'); await shot('03_settings'); await click('[data-act="back"]');
await click('[data-act="chapters"]'); await shot('04_chapters'); await click('[data-act="back"]');
await click('[data-act="new"]');

const visited = [];
let guard = 0, last = '';
while (guard++ < 400) {
  const s = await info();
  const key = `${s.step}:${s.state}:${s.ui}:${s.travel}`;
  if (key !== last) { visited.push(key); last = key; }
  if (s.state === 'ending' || s.ui === 'ending' || s.ui === 'credits') { await once('90_ending'); break; }
  if (s.travel) { await once('10_travel'); await click('.s-travel [data-k="go"]'); continue; }
  if (s.ui === 'chaptercard') { await once('11_chaptercard'); await click('[data-act="go"]'); continue; }
  if (s.ui === 'briefing') { await once('12_briefing'); await click('[data-act="begin"]'); await t.p.waitForFunction(() => window.__app.game.running, null, { timeout: 60000 }); continue; }
  if (s.ui === 'results') { await once('20_results'); await click('[data-act="next"]'); continue; }
  if (s.ui === 'failed') throw new Error('mission failed during flow at ' + key);
  if (s.state === 'mission' && s.running) {
    await t.sim(1500);
    if (!s.hub && !seen.has('13_hud')) {
      await once('13_hud');
      await t.eval(() => window.__app.pause()); await t.realWait(200); await once('14_pause');
      await click('[data-act="log"]'); await once('15_log');
      const tabs = await t.p.$$('[data-act="tab"]'); for (const b of tabs) { if ((await b.getAttribute('data-tab')) === 'map') { await b.click(); await t.realWait(250); await once('16_map'); } }
      await t.eval(() => { const a = window.__app; a.ui.closeAll(); a.resume(); }); await t.sim(300);
    }
    if (s.hub && !seen.has('30_hub')) {
      await once('30_hub');
      await t.eval(() => window.__app.ui.station('kitchen')); await once('31_station');
      await t.eval(() => window.__app.ui.closeStation());
    }
    await t.eval(() => window.__app.game.mission.complete()); await t.sim(4000); await t.realWait(500);
    continue;
  }
  await t.realWait(500);
  if (guard > 390) throw new Error('flow stuck at ' + key);
}
const end = await info();
console.log(`flow ${tag}: steps=${visited.length} end=${end.state}/${end.ui} errors=${t.logs.length}`);
for (const l of t.logs.slice(0, 10)) console.log('  ', l);
await t.b.close();
