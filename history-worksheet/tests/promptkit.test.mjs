import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../promptkit.js',import.meta.url),'utf8'),context);
const P=context.window.PromptKit;let count=0;
for(const kind of P.KINDS)for(const tool of ['canva','gemini','codex','claude'])for(const level of tool==='canva'||tool==='gemini'?['basic']:['basic','adv']){
 const value={topic:'임진왜란',grade:'중학교 2학년',mins:'15분',style:P.STYLES[0][0],question:'어떤 근거로 판단했나요?',extra:'힌트 버튼을 넣어 주세요.',tool};
 for(const [id,,options,def] of kind.x||[])value[id]=options?def:'';
 const result=P.build(kind,value,level);
 assert.ok(result.includes('임진왜란')&&result.includes(value.extra));
 assert.ok(!/undefined|NaN|—|임진왜란를/.test(result),kind.id+':'+tool+':'+level);
 if(level==='basic'&&tool==='canva')assert.ok(result.includes('Canva Code')&&!result.includes('[만드는 방법] CSS와'));
 if(level==='basic'&&tool==='gemini')assert.ok(result.includes('index.html')&&result.includes('Canvas'));
 if(level==='basic'&&(tool==='codex'||tool==='claude'))assert.ok(result.includes('실제로 만들어'));
 if(level==='adv')assert.ok(result.includes('Firestore')&&result.includes('보안 규칙'));
 count++;
}
console.log('도구·기초/심화·웹앱 종류 조합 '+count+'개 통과');
