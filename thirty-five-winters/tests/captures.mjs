// Evidence captures: one in-mission view per era plus renderer counters (draw calls / triangles).
// usage: node tests/captures.mjs <outDir> [quality=medium] [ids,comma,separated]
import { launch } from './bot.mjs';
import fs from 'node:fs';

const out = process.argv[2] || 'shots';
const quality = process.argv[3] || 'medium';
fs.mkdirSync(out, { recursive: true });
const t = await launch({ w: 1280, h: 720 });
const only = process.argv[4]?.split(',');
// [mission id, checkpoint to start from]
const VIEWS_ALL = [
  ['m0', 2], ['m1a', 0], ['m3', 0], ['m4a', 0], ['m5a', 0],
  ['m6a', 0], ['m7', 0], ['m8b', 0], ['h8', 0],
];
const VIEWS = only ? VIEWS_ALL.filter((v) => only.includes(v[0])) : VIEWS_ALL;
const rows = [];
for (const [id, cp] of VIEWS) {
  await t.eval(([id, cp, q]) => { const a = window.__app; a.renderer.setQuality(q); a.startMission(a.data.MISSIONS[id], cp); }, [id, cp, quality]);
  await t.p.waitForFunction(() => window.__app.game.running, null, { timeout: 60000 });
  await t.sim(2500);
  await t.eval(() => { const a = window.__app; a.hud.el.hTut?.classList.remove('on'); document.getElementById('clickplay')?.style.setProperty('opacity', '0'); });
  await t.p.waitForFunction(() => getComputedStyle(document.getElementById('fade')).opacity === '0', null, { timeout: 20000 });
  await t.realWait(1200);
  const info = await t.eval(() => { const r = window.__app.renderer.gl.info.render; return { calls: r.calls, tris: r.triangles }; });
  rows.push({ id, ...info });
  await t.shot(`${out}/era_${id}.png`);
}
console.log(JSON.stringify(rows));
console.log('errors', t.logs.length, t.logs.slice(0, 5).join('\n'));
await t.b.close();
