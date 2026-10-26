// Smoke test: boot, title, start a mission directly, take screenshots, report console errors.
// usage: node tests/smoke.mjs [missionId] [outDir] [width] [height]
import { chromium } from 'playwright';
const [,, mission = 'm0', out = '/tmp', w = '1280', h = '720', extra = ''] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
await p.goto('http://127.0.0.1:5188/index.html');
await p.waitForFunction(() => window.__app, null, { timeout: 30000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/title.png` });
await p.evaluate((id) => { const a = window.__app; a.progress.reset(); a.startMission(a.data.MISSIONS[id], 0); }, mission);
await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/mission_${mission}.png` });
if (extra) { await p.evaluate(extra); await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/mission_${mission}_b.png` }); }
const info = await p.evaluate(() => { const g = window.__app.game; return { running: g.running, obj: g.mission?.current?.id, player: g.player && [g.player.x, g.player.z], draws: window.__app.renderer.gl.info.render.calls, tris: window.__app.renderer.gl.info.render.triangles }; });
console.log(JSON.stringify(info));
console.log(logs.slice(0, 20).join('\n'));
await b.close();
