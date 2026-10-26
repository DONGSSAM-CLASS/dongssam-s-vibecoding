// Generic bot: plays every mission objective-by-objective using real key presses for actions,
// teleports between objectives, and reports progress, assists, softlocks and console errors.
// usage: node tests/run_all.mjs [missionId,...] [outDir]
import { launch } from './bot.mjs';
import { writeFileSync } from 'fs';

const only = (process.argv[2] && process.argv[2] !== 'all') ? process.argv[2].split(',') : null;
const out = process.argv[3] || '/tmp';
const t = await launch({ w: 960, h: 540 });
const ids = await t.eval(() => Object.keys(window.__app.data.MISSIONS));
const report = [];

const cur = () => t.eval(() => {
  const g = window.__app.game, m = g.mission, o = m.current;
  if (!o) return { done: m.done, failed: m.failed };
  let marker = o.marker ?? o.zone ?? null; if (typeof marker === 'function') marker = marker(g);
  if (o.type === 'extract') marker = o.zone || g.def.extraction;
  return { id: o.id, type: o.type, idx: m.index, zone: o.zone || (o.type === 'extract' ? g.def.extraction : null), marker, groups: o.groups, group: o.group, ids: o.ids, actor: o.actor, timer: o.timer, done: m.done, failed: m.failed, prog: m.state.progress, onSignal: !!o.onSignal, autoSignal: !!o.autoSignal, hp: g.player.hp, pstate: g.player.state };
});
const tpAll = (x, z) => t.eval(([x, z]) => {
  const g = window.__app.game, p = g.player;
  p.x = x; p.z = z; p.y = g.groundY(x, z); p.vx = p.vz = 0;
  [...g.squad, ...g.civilians.filter((c) => c.mode === 'follow' || (c.carriedBy === p))].forEach((a, i) => { if (a.state === 'lost' || a.carriedBy) return; const ang = i * 1.3; a.x = x + Math.cos(ang) * (1.6 + i * 0.3); a.z = z + Math.sin(ang) * (1.6 + i * 0.3); a.y = g.groundY(a.x, a.z); a.path = null; });
}, [x, z]);
const heal = () => t.eval(() => { const g = window.__app.game; if (g.player.state === 'wounded') g.player.revive(100); g.player.hp = 100; });
const interactables = () => t.eval(() => { const g = window.__app.game; return g.interactables.filter((i) => i.enabled(g)).map((i) => { const p = typeof i.pos === 'function' ? i.pos(g) : i.pos; return { id: i.id, x: p[0], z: p[1], hold: i.hold || 0, carryNeeded: false }; }); });

async function useAt(x, z, hold) {
  // stand 1.1 m away facing the target, then press / hold the interact key
  await t.eval(([x, z]) => { const g = window.__app.game, p = g.player; const a = Math.atan2(x - p.x, z - p.z) || 0; const nx = x - Math.sin(a) * 1.1, nz = z - Math.cos(a) * 1.1; p.x = nx; p.z = nz; p.y = g.groundY(nx, nz); p.facing = Math.atan2(x - nx, z - nz); g.cam.yaw = p.facing; }, [x, z]);
  await t.wait(150);
  if (hold > 0) await t.hold('KeyF', (hold + 0.4) * 1000); else await t.key('KeyF');
  await t.wait(200);
}

async function playMission(id) {
  const r = { id, steps: [], assists: [], result: null, errors: [] };
  t.logs.length = 0;
  // put the journey at this mission's step so a hub's departure advances to the right place
  await t.eval((id) => { const a = window.__app; const i = a.data.SEQUENCE.findIndex((s) => s.id === id); if (i >= 0) a.progress.s.step = i; }, id);
  await t.start(id, 0, 'story');
  await t.realWait(400);
  let guard = 0, lastIdx = -1, sameCount = 0, lastProg = null;
  while (guard++ < 120) {
    const o = await cur();
    if (o.done || o.failed) break;
    if (o.idx !== lastIdx) { r.steps.push(`${o.idx}:${o.id}(${o.type})`); lastIdx = o.idx; sameCount = 0; lastProg = o.prog; } else if (o.prog !== lastProg) { lastProg = o.prog; sameCount = 0; } else sameCount++;
    if (o.hp < 60 || o.pstate === 'wounded') await heal();
    if (sameCount > (['count', 'flags', 'flag'].includes(o.type) ? 14 : 8)) { // softlock guard: force-complete and record it
      r.assists.push(`force ${o.id}`);
      await t.eval(() => { const m = window.__app.game.mission; m.current.onComplete?.(m.g, m, false); m.index++; if (m.index >= m.objectives.length) m.complete(); else m.beginObjective(); });
      continue;
    }
    switch (o.type) {
      case 'reach': case 'extract': {
        const [x, z] = o.zone; await tpAll(x, z);
        // carried / wounded companions come along
        await t.eval(([x, z]) => { const g = window.__app.game; g.squad.forEach((a, i) => { if (a.state === 'wounded' && !a.carriedBy) { a.x = x + 1 + i; a.z = z - 1; a.y = g.groundY(a.x, a.z); } }); }, [x, z]);
        await t.wait(800); break;
      }
      case 'escort': {
        // ask the group to follow (real interaction), then bring them in
        const civ = await t.eval((grp) => { const g = window.__app.game; const c = g.civilians.find((c) => (grp ? c.def.group === grp : c.def.escort) && c.mode !== 'safe' && c.active); return c ? [c.x, c.z, c.mode] : null; }, o.group);
        if (civ && civ[2] !== 'follow') { await useAt(civ[0], civ[1], 0); }
        const [x, z] = o.zone; await tpAll(x, z); await t.wait(800); break;
      }
      case 'observe': {
        const targets = await t.eval(([grp, ids]) => window.__app.game.enemies.filter((e) => e.active && !e.observed && (!grp || e.group === grp) && (!ids || ids.includes(e.id))).map((e) => [e.id, e.x, e.z]), [o.group, o.ids]);
        for (const [eid, ex, ez] of targets.slice(0, 4)) {
          await t.eval(([ex, ez]) => { const g = window.__app.game, p = g.player; const d = 22; let best = null; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = ex + Math.cos(a) * d, z = ez + Math.sin(a) * d; if (!g.terrain.inBounds(x, z, 3)) continue; p.x = x; p.z = z; p.y = g.groundY(x, z); const e = g.enemies.find((q) => Math.hypot(q.x - ex, q.z - ez) < 0.5); if (e && g.visibility(p, e) > 0.4) { best = [x, z]; break; } } if (best) { p.x = best[0]; p.z = best[1]; p.y = g.groundY(p.x, p.z); } p.crouch = true; }, [ex, ez]);
          await t.faceActor(eid); await t.wait(1400);
        }
        const still = await cur();
        if (still.idx === o.idx && sameCount > 2) { r.assists.push(`observe ${o.id}`); await t.eval(([grp, ids]) => { const g = window.__app.game; g.enemies.filter((e) => (!grp || e.group === grp) && (!ids || ids.includes(e.id))).forEach((e) => g.markObserved(e, g.player, true)); }, [o.group, o.ids]); }
        break;
      }
      case 'treat': {
        const w = await t.eval(() => { const g = window.__app.game; const a = [...g.squad, ...g.allies].find((a) => a.state === 'wounded' && !a.treated && !a.carriedBy); return a ? [a.x, a.z] : null; });
        if (w) await useAt(w[0], w[1], 3.2); else await t.wait(3000);
        break;
      }
      case 'carry': {
        const a = await t.eval((id) => { const g = window.__app.game; const a = g.actors.find((x) => x.id === id); return a ? [a.x, a.z, a.state, a.treated] : null; }, o.actor);
        if (!a) break;
        if (a[2] === 'wounded' && !a[3]) await useAt(a[0], a[1], 3.2);
        const b = await t.eval((id) => { const a = window.__app.game.actors.find((x) => x.id === id); return [a.x, a.z, a.state, a.carriedBy ? 1 : 0]; }, o.actor);
        if (!b[3]) await useAt(b[0], b[1], 1.0);
        await tpAll(o.zone[0], o.zone[1]); await t.wait(200); await t.key('KeyF'); await t.wait(600);
        break;
      }
      case 'hold': case 'wait': {
        if (o.zone) await tpAll(o.zone[0], o.zone[1]);
        await t.key('KeyC');
        for (let k = 0; k < Math.ceil((o.timer || 5) / 10) + 2; k++) { await heal(); await t.wait(10000); const c = await cur(); if (c.idx !== o.idx) break; }
        break;
      }
      case 'ambush': {
        for (let k = 0; k < 200; k++) { await t.wait(1000); const c = await cur(); if (c.idx !== o.idx || (c.prog && c.prog.length > 3)) break; }
        if (!o.autoSignal) await t.key('KeyG');
        for (let k = 0; k < 120; k++) { await heal(); await t.wait(1000); const c = await cur(); if (c.idx !== o.idx) break; }
        const c = await cur(); if (c.idx === o.idx) { r.assists.push(`rout ${o.id}`); await t.eval((gs) => { const g = window.__app.game; gs.forEach((id) => g.groups[id] && g.routGroup(g.groups[id])); }, o.groups); await t.wait(25000); }
        break;
      }
      case 'rout': {
        for (let k = 0; k < 90; k++) { await heal(); await t.wait(1000); const c = await cur(); if (c.idx !== o.idx) break; }
        const c = await cur(); if (c.idx === o.idx) { r.assists.push(`rout ${o.id}`); await t.eval((gs) => { const g = window.__app.game; gs.forEach((id) => g.groups[id] && g.routGroup(g.groups[id])); }, o.groups); await t.wait(25000); }
        break;
      }
      case 'custom': {
        if (o.marker) { await tpAll(o.marker[0], o.marker[1]); await t.key('Space'); await t.wait(800); }
        break;
      }
      default: { // flag / count / flags: walk the enabled interactables, deliver what is carried
        if (o.id === 'base') { // hub: use a station for real, then set out through the UI
          const st = await t.eval(() => { const g = window.__app.game; const k = g.interactables.find((i) => i.id === 'st_kitchen'); const d = g.interactables.find((i) => i.id === 'st_depart'); return [k && k.pos, d && d.pos]; });
          if (st[0]) { await useAt(st[0][0], st[0][1], 0); await t.wait(200); await t.p.click('.s-station [data-act="feed"]').catch(() => {}); await t.p.click('.s-station [data-act="closeSt"]').catch(() => {}); await t.wait(200); }
          await useAt(st[1][0], st[1][1], 0); await t.wait(200); await t.p.click('.s-station [data-act="go"]').catch((e) => r.assists.push('no depart button ' + e.message)); await t.wait(500);
          break;
        }
        if (o.onSignal && o.marker) { await tpAll(o.marker[0], o.marker[1]); await t.wait(300); await t.key('KeyG'); await t.wait(500); break; }
        const its = await interactables();
        const carrying = await t.eval(() => !!window.__app.game.player.carryItem);
        // prefer the interactable nearest the objective marker
        const mk = o.marker || [0, 0];
        its.sort((a, b) => Math.hypot(a.x - mk[0], a.z - mk[1]) - Math.hypot(b.x - mk[0], b.z - mk[1]));
        const pick = its[sameCount % Math.max(1, its.length)];
        if (pick) await useAt(pick.x, pick.z, pick.hold);
        else if (o.marker) { await tpAll(o.marker[0], o.marker[1]); await t.wait(800); }
        void carrying;
      }
    }
  }
  await t.realWait(1600);
  const end = await t.eval(() => ({ appState: window.__app.state, done: window.__app.game.mission?.done, failed: window.__app.game.mission?.failed, stats: window.__app.game.stats, squad: window.__app.game.squad?.map((a) => a.id + ':' + a.state) }));
  r.result = end; r.errors = [...t.logs];
  if (end.failed) r.assists.push('FAILED: ' + await t.eval(() => window.__app.game.mission?.failReason));
  await t.shot(`${out}/run_${id}.png`);
  return r;
}

for (const id of ids) {
  if (only && !only.includes(id)) continue;
  try {
    const r = await playMission(id);
    report.push(r);
    console.log(`${id}: ${r.result.done && !r.result.failed ? 'COMPLETE' : 'NOT COMPLETE'} state=${r.result.appState} steps=${r.steps.length} assists=[${r.assists.join('; ')}] errors=${r.errors.length} squad=${(r.result.squad || []).join(',')}`);
    if (r.errors.length) console.log('   ' + r.errors.slice(0, 3).join('\n   '));
  } catch (e) { console.log(`${id}: CRASH ${e.message}`); report.push({ id, crash: e.message }); }
  await t.eval(() => { window.__app.cleanupMission(); window.__app.ui.closeAll(); });
}
writeFileSync(`${out}/run_all.json`, JSON.stringify(report, null, 1));
await t.b.close();
