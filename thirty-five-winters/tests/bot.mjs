// Bot playtest harness: drives the real game through keyboard input and debug teleports.
import { chromium } from 'playwright';
export async function launch({ w = 1280, h = 720, mobile = false } = {}) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
  p.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await p.goto('http://127.0.0.1:5188/index.html');
  await p.waitForFunction(() => window.__app, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  const api = {
    p, b, logs,
    async start(id, cp = 0, diff = 'standard') { await p.evaluate(([id, cp, d]) => { const a = window.__app; a.settings.difficulty = d; a.renderer.setQuality('low'); a.startMission(a.data.MISSIONS[id], cp); }, [id, cp, diff]); await p.waitForFunction(() => window.__app.game.running, null, { timeout: 30000 }); await api.sim(300); },
    async tp(x, z, facing) { await p.evaluate(([x, z, f]) => { const g = window.__app.game, pl = g.player; pl.x = x; pl.z = z; pl.y = g.groundY(x, z); if (f != null) { pl.facing = f; g.cam.yaw = f; } pl.vx = pl.vz = 0; }, [x, z, facing]); await api.sim(100); },
    async tpSquad(x, z) { await p.evaluate(([x, z]) => { const g = window.__app.game; g.squad.forEach((a, i) => { a.x = x + i; a.z = z - 1; a.y = g.groundY(a.x, a.z); a.path = null; }); }, [x, z]); },
    async faceActor(id) { await p.evaluate((id) => { const g = window.__app.game, pl = g.player; const e = g.actors.find((a) => a.id === id); const a = Math.atan2(e.x - pl.x, e.z - pl.z); pl.facing = a; g.cam.yaw = a; g.cam.pitch = -0.05; }, id); },
    // point the crosshair at a world position (iterates because the camera orbits the player)
    async aimAt(x, y, z) {
      for (let i = 0; i < 4; i++) {
        await p.evaluate(([x, y, z]) => { const g = window.__app.game, c = g.camera.position; const dx = x - c.x, dy = y - c.y, dz = z - c.z; g.cam.yaw = Math.atan2(dx, dz); g.cam.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [x, y, z]);
        await api.sim(120);
      }
    },
    async face(x, z) { await p.evaluate(([x, z]) => { const g = window.__app.game, pl = g.player; const a = Math.atan2(x - pl.x, z - pl.z); pl.facing = a; g.cam.yaw = a; }, [x, z]); },
    async sim(ms) { await p.evaluate((s) => window.__app.simulate(s), ms / 1000); },
    async key(code, ms = 100) { await p.keyboard.down(code); await api.sim(ms); await p.keyboard.up(code); await api.sim(66); },
    async hold(code, ms) { await p.keyboard.down(code); await api.sim(ms); await p.keyboard.up(code); await api.sim(33); },
    async holdMany(codes, ms) { for (const c of codes) await p.keyboard.down(c); await api.sim(ms); for (const c of codes) await p.keyboard.up(c); await api.sim(33); },
    async mouse(btn = 'left', ms = 80) { await p.evaluate((b) => window.__app.input.raw.add(b), btn === 'left' ? 'Mouse0' : 'Mouse2'); await api.sim(ms); await p.evaluate((b) => window.__app.input.raw.delete(b), btn === 'left' ? 'Mouse0' : 'Mouse2'); await api.sim(50); },
    async mouseDown(btn) { await p.evaluate((b) => window.__app.input.raw.add(b), btn); },
    async mouseUp(btn) { await p.evaluate((b) => window.__app.input.raw.delete(b), btn); },
    async wait(ms) { await api.sim(ms); },
    async realWait(ms) { await p.waitForTimeout(ms); },
    async state() { return p.evaluate(() => { const a = window.__app, g = a.game, m = g.mission; return { appState: a.state, obj: m?.current?.id, idx: m?.index, done: m?.done, failed: m?.failed, alert: g.alertLevel, hp: g.player?.hp, pos: g.player && [Math.round(g.player.x), Math.round(g.player.z)], flags: g.flags && [...g.flags], prog: m?.state?.progress, squad: g.squad?.map((s) => s.id + ':' + s.state), ui: a.ui.top?.name }; }); },
    async waitObj(id, timeout = 20000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { const s = await api.state(); if (s.obj !== id || s.done) return s; await p.waitForTimeout(250); } return api.state(); },
    async enemies() { return p.evaluate(() => window.__app.game.enemies.map((e) => ({ id: e.id, mode: e.mode, st: e.state, pos: [Math.round(e.x), Math.round(e.z)], obs: e.observed, oT: +e.observeT.toFixed(1), vis: e.visibleToPlayer, det: +(e.detect.get(window.__app.game.player) || 0).toFixed(2) }))); },
    async shot(path) { await p.screenshot({ path }); },
    async eval(fn, arg) { return p.evaluate(fn, arg); },
  };
  return api;
}
