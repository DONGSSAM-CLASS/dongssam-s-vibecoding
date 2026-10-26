import { launch } from './bot.mjs';
const out = process.argv[2] || '/tmp';
const sigKey = process.argv[3] || 'KeyG'; // KeyF checks that interact also gives the signal
const t = await launch();
await t.start('m3');
const log = async (k) => { const s = await t.state(); console.log(k, '|', s.obj, s.idx, s.done ? 'DONE' : '', s.failed ? 'FAILED' : '', '|', s.prog || '', '| hp', Math.round(s.hp), '| alert', s.alert, '|', s.squad.join(',')); };
await log('start');
for (let i = 0; i < 12; i++) { await t.faceActor('v' + (i % 3)); await t.wait(1500); const s = await t.state(); if (s.obj !== 'watch') break; }
await log('watch');
await t.mouseDown('Mouse2'); const v = await t.eval(() => { const e = window.__app.game.enemies.find((e) => e.id === 'v0'); return [e.x, e.chestY(), e.z]; }); await t.aimAt(...v); await t.mouse('left'); await t.mouseUp('Mouse2'); await t.wait(1500);
await log('lure');
await t.shot(out + '/m3_lure.png');
// retreat with real movement for a few seconds, then teleport the rest
await t.eval(() => { const g = window.__app.game; g.cam.yaw = 0; });
await t.hold('KeyW', 4000); await log('running');
await t.tp(0, -8); await t.tpSquad(1, -10); await t.wait(1500); await log('fallback');
await t.tp(34, 22); await t.tpSquad(35, 24); await t.wait(1500); await log('climb');
for (let i = 0; i < 160; i++) { await t.wait(1000); const s = await t.state(); if (s.prog && s.prog.length > 3) break; }
await log('ready?');
await t.shot(out + '/m3_ambush_wait.png');
await t.key(sigKey); await t.wait(500); await log('signal');
for (let i = 0; i < 120; i++) { await t.wait(1000); const s = await t.state(); if (s.obj !== 'ambush') break; if (i % 15 === 0) await log('fight ' + i); }
await t.shot(out + '/m3_fight.png');
await log('rout');
const y = await t.eval(() => { const a = window.__app.game.squad.find((s) => s.id === 'yongdal'); return a && [a.x, a.z, a.state]; });
console.log('yongdal', y);
if (y && y[2] === 'wounded') { await t.tp(y[0] + 1, y[1]); await t.face(y[0], y[1]); await t.hold('KeyF', 3500); await t.hold('KeyF', 1200); await log('carrying'); await t.tp(36, 26); await t.key('KeyF'); await t.wait(500); }
await log('carry');
await t.tp(0, 84); await t.tpSquad(1, 82); await t.wait(1500); await log('extract');
await t.realWait(2500); console.log((await t.state()).appState);
console.log(JSON.stringify(await t.eval(() => window.__app.game.stats)));
console.log(t.logs.join('\n'));
await t.b.close();
