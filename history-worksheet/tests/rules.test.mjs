// firestore.rules 테스트. Firestore 에뮬레이터 위에서 돌립니다(npm test가 에뮬레이터를 켜 줍니다).
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const env = await initializeTestEnvironment({
  projectId: 'demo-worksheet',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') }
});
const ADMIN = { email: 'dongssamplay@gmail.com', email_verified: true };
const admin = env.authenticatedContext('admin-uid', ADMIN).firestore();
const stranger = env.authenticatedContext('google-other', { email: 'someone@gmail.com', email_verified: true }).firestore();
const amy = env.authenticatedContext('amy').firestore();   // 익명 연수생
const ben = env.authenticatedContext('ben').firestore();
const nobody = env.unauthenticatedContext().firestore();

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n    ', e.message); }
}
const room = { title: '테스트 수업방', ownerUid: 'admin-uid', ownerEmail: ADMIN.email, open: true, step: null, timerEnd: null };
const person = { name: '에이미', stepIndex: 0, stepId: 'c1', stepTitle: '1쪽', seen: [0], answers: { c1: '방탈출' }, deploy: { tab: 'netlify' }, quiz: { done: 0, right: 0, total: 6 }, surveyDone: false, work: null };
const work = { name: '임진왜란 방탈출', maker: '에이미', url: 'https://example.web.app/', desc: '중2', shot: '' };

console.log('보안 규칙');
await env.clearFirestore();
await t('로그인 안 한 사람은 수업방을 못 읽어요', () => assertFails(nobody.doc('rooms/1234').get()));
await t('연수생은 수업방을 못 만들어요', () => assertFails(amy.doc('rooms/1234').set({ ...room, ownerUid: 'amy' })));
await t('진행자가 아닌 구글 계정도 못 만들어요', () => assertFails(stranger.doc('rooms/1234').set({ ...room, ownerUid: 'google-other' })));
await t('진행자는 수업방을 만들어요', () => assertSucceeds(admin.doc('rooms/1234').set(room)));
await t('수업방 번호는 숫자 네 자리만', () => assertFails(admin.doc('rooms/abc').set(room)));
await t('연수생은 수업방 정보를 읽어요', () => assertSucceeds(amy.doc('rooms/1234').get()));
await t('연수생은 진행자 쪽 열기를 못 바꿔요', () => assertFails(amy.doc('rooms/1234').update({ step: { id: 'quiz', at: 1 } })));
await t('진행자는 쪽 열기와 타이머를 바꿔요', () => assertSucceeds(admin.doc('rooms/1234').update({ step: { id: 'quiz', at: 1 }, timerEnd: 9 })));

await t('연수생은 자기 진행 상황을 써요', () => assertSucceeds(amy.doc('rooms/1234/people/amy').set(person)));
await t('다른 사람 이름으로는 못 써요', () => assertFails(amy.doc('rooms/1234/people/ben').set(person)));
await t('정해지지 않은 칸은 못 써요', () => assertFails(amy.doc('rooms/1234/people/amy').set({ ...person, admin: true })));
await t('이름이 너무 길면 안 돼요', () => assertFails(amy.doc('rooms/1234/people/amy').set({ ...person, name: '가'.repeat(31) })));
await t('연수생은 자기 진행 상황을 읽어요', () => assertSucceeds(amy.doc('rooms/1234/people/amy').get()));
await t('연수생은 다른 사람 진행 상황을 못 읽어요', () => assertFails(ben.doc('rooms/1234/people/amy').get()));
await t('연수생은 진행 상황 목록을 못 읽어요', () => assertFails(ben.collection('rooms/1234/people').get()));
await t('진행자가 아닌 구글 계정은 목록을 못 읽어요', () => assertFails(stranger.collection('rooms/1234/people').get()));
await t('진행자는 목록을 읽어요', () => assertSucceeds(admin.collection('rooms/1234/people').get()));
await t('없는 수업방에는 못 들어가요', () => assertFails(amy.doc('rooms/9999/people/amy').set(person)));

await t('작품을 올려요', () => assertSucceeds(amy.doc('rooms/1234/works/amy').set(work)));
await t('주소가 http(s)가 아니면 안 돼요', () => assertFails(amy.doc('rooms/1234/works/amy').set({ ...work, url: 'javascript:alert(1)' })));
await t('다른 사람 작품은 못 바꿔요', () => assertFails(ben.doc('rooms/1234/works/amy').set(work)));
await t('다른 사람 작품은 못 지워요', () => assertFails(ben.doc('rooms/1234/works/amy').delete()));
await t('같은 수업방 사람은 작품을 봐요', () => assertSucceeds(ben.collection('rooms/1234/works').get()));
await t('좋아요를 눌러요', () => assertSucceeds(ben.doc('rooms/1234/likes/ben').set({ ids: ['amy'] })));
await t('남의 좋아요는 못 바꿔요', () => assertFails(amy.doc('rooms/1234/likes/ben').set({ ids: [] })));

await t('설문을 내요', () => assertSucceeds(amy.doc('rooms/1234/survey/amy').set({ star: 5, s2: '좋아요', s3: '' })));
await t('별점은 0~5만', () => assertFails(amy.doc('rooms/1234/survey/amy').set({ star: 9, s2: '', s3: '' })));
await t('연수생은 설문 결과를 못 읽어요', () => assertFails(amy.doc('rooms/1234/survey/amy').get()));
await t('진행자는 설문 결과를 읽어요', () => assertSucceeds(admin.collection('rooms/1234/survey').get()));

await t('진행자가 들어오기를 막으면', () => assertSucceeds(admin.doc('rooms/1234').update({ open: false })));
await t('새 사람은 못 들어와요', () => assertFails(ben.doc('rooms/1234/people/ben').set({ ...person, name: '벤' })));
await t('이미 들어온 사람은 계속 써요', () => assertSucceeds(amy.doc('rooms/1234/people/amy').set({ ...person, stepIndex: 3 }, { merge: true })));
await t('진행자는 참가자를 지워요', () => assertSucceeds(admin.doc('rooms/1234/people/amy').delete()));

await env.cleanup();
console.log(`\n보안 규칙: ${pass}개 통과, ${fail}개 실패`);
if (fail) process.exit(1);
