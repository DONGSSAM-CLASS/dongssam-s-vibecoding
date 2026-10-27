// Local Firestore emulator only. This does not create users or rooms in production.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
const env=await initializeTestEnvironment({projectId:'demo-worksheet',firestore:{rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const admin=env.authenticatedContext('load-admin',{email:'dongssamplay@gmail.com',email_verified:true}).firestore();
const code='7250',N=120,started=Date.now();
try{
 await env.clearFirestore();
 await admin.doc('rooms/'+code).set({title:'120명 동시 입력 점검',ownerUid:'load-admin',open:true});
 const tools=['Canva AI','Gemini','Codex','Claude Code'];
 const tabs=['canva','gemini','firebase','netlify'];
 const clients=Array.from({length:N},(_,i)=>env.authenticatedContext('load-'+i).firestore());
 const ref=(db,i)=>db.doc(`rooms/${code}/people/load-${i}`);
 await Promise.all(clients.map((db,i)=>ref(db,i).set({name:'검증용 '+i,stepIndex:5,stepId:'make',stepTitle:'6쪽 · 도구별 만들기와 수정',seen:[0,5],answers:{tool:tools[i%4],p1:'임진왜란 '+i},deploy:{tab:tabs[i%4],[tabs[i%4]]:{done:0,total:[6,4,9,6][i%4]}},quiz:{done:0,right:0,total:6},surveyDone:false,work:null})));
 let result=await admin.collection(`rooms/${code}/people`).get();
 assert.equal(result.size,N);
 await Promise.all(clients.map((db,i)=>ref(db,i).set({stepIndex:6,stepId:'deploy',stepTitle:'7쪽 · 배포 따라 하기',deploy:{tab:tabs[i%4],[tabs[i%4]]:{done:[6,4,9,6][i%4],total:[6,4,9,6][i%4]}}},{merge:true})));
 result=await admin.collection(`rooms/${code}/people`).get();
 assert.equal(result.size,N);
 for(const doc of result.docs){const i=Number(doc.id.slice(5)),d=doc.data();assert.equal(d.answers.tool,tools[i%4]);assert.equal(d.answers.p1,'임진왜란 '+i);assert.equal(d.stepId,'deploy');assert.equal(d.deploy[d.deploy.tab].done,d.deploy[d.deploy.tab].total);}
 await assertFails(ref(clients[0],1).update({name:'다른 사람 덮어쓰기'}));
 console.log(JSON.stringify({participants:N,parallelWrites:N*2,providers:4,elapsedMs:Date.now()-started,integrity:'passed',crossUserWrite:'denied'}));
}finally{await env.cleanup();}
