import { launch } from './bot.mjs';
const out = process.argv[2] || '/tmp';
const t = await launch();
await t.start('m1a');
const log = async (k) => { const s = await t.state(); console.log(k, s.obj, s.idx, s.done ? 'DONE' : '', s.prog || '', s.squad.join(',')); };
await log('start');
for (let i = 0; i < 3; i++) {
  const p = [[-11.5, -15.5], [-9, -16], [-12, -12.5]][i];
  await t.tp(p[0] + 1.2, p[1] + 0.2); await t.face(p[0], p[1]); await t.hold('KeyF', 700);
  await t.tp(0, 4.5); await t.face(0, 3.2); await t.key('KeyF');
}
await log('grain');
await t.tp(33, 19.5); await t.wait(500); await log('report');
await t.tp(35, 20, -Math.PI / 2); await t.key('Space'); await t.wait(300); await log('cover');
// shooting: aim at each target, fire, reload
const targets = await t.eval(() => window.__app.game.level.targets.map((tg) => [tg.x, tg.y, tg.z]));
for (const [x, y, z] of targets) {
  for (let k = 0; k < 4; k++) {
    await t.mouseDown('Mouse2'); await t.aimAt(x, y, z); await t.holdMany(['ShiftLeft'], 600);
    await t.mouse('left'); await t.wait(300); await t.mouseUp('Mouse2');
    await t.key('KeyR'); await t.wait(1900);
    const hit = await t.eval((pos) => window.__app.game.level.targets.find((tg) => tg.x === pos[0]).hit, [x, y, z]);
    if (hit) break;
  }
}
await t.shot(out + '/m1a_shoot.png');
await log('shoot');
const h = await t.eval(() => { const a = window.__app.game.squad.find((s) => s.id === 'hyeonbin'); return [a.x, a.z]; });
await t.tp(h[0] + 1, h[1]); await t.face(h[0], h[1]); await t.hold('KeyF', 3500); await log('aid');
await t.tp(40, 30); await t.aimAt(56, 1, 40); await t.key('Digit1'); await t.wait(500); await t.key('Digit2'); await t.wait(300); await log('squad');
await t.tp(0, 7); await t.wait(500); await log('home');
await t.realWait(2500); console.log((await t.state()).appState);
console.log(t.logs.join('\n'));
await t.b.close();
