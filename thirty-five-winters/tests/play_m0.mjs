import { launch } from './bot.mjs';
const out = process.argv[2] || '/tmp';
const t = await launch();
await t.start('m0');
console.log('start', await t.state());
// walk forward with real input for a second
await t.hold('KeyW', 1200); console.log('after walk', await t.state());
await t.tp(25.5, 31, Math.PI); await t.key('KeyF'); await t.wait(300); console.log('notice', await t.state());
await t.tp(29, 39.5); await t.face(30, 38); await t.key('KeyF'); await t.wait(300); console.log('letter', await t.state());
// optional books
for (let i = 0; i < 3; i++) { await t.tp([30.5, 32, 33.5][i], 34.2); await t.face([30.5, 32, 33.5][i], 33); await t.hold('KeyF', 700); await t.tp(41, 49.5); await t.face(41, 50.5); await t.key('KeyF'); await t.wait(200); }
console.log('books', await t.state());
await t.tp(21.2, 18.6, Math.PI); await t.key('KeyC'); for (let i = 0; i < 8; i++) { await t.faceActor(i % 2 ? 'g1' : 'g2'); await t.wait(1200); } console.log('observe', await t.state());
await t.shot(out + '/m0_street.png');
await t.tp(-30, -32, Math.PI); await t.wait(800); console.log('cross', await t.state());
await t.tp(-56.5, -40, -Math.PI / 2); await t.face(-58, -40); await t.key('KeyF'); await t.wait(1500); console.log('deliver', await t.state());
await t.realWait(2500); console.log('end', await t.state());
await t.shot(out + '/m0_results.png');
console.log(JSON.stringify(await t.enemies()));
console.log(t.logs.join('\n'));
await t.b.close();
