# Codex에 붙여 넣을 프롬프트: 학습지 Firebase 배포 이어 하기

## 쓰는 법

1. 선생님 컴퓨터에서 Codex(앱 또는 터미널의 `codex`)를 열어요. 브라우저로 구글 로그인을 해야 하니, 클라우드가 아니라 **선생님 컴퓨터에서 도는 Codex**여야 해요.
2. 작업 폴더는 이 저장소(`dongssam-s-vibecoding`)로 정해요. 저장소가 컴퓨터에 없다면 Codex에게 받아 달라고 하면 돼요.
3. 아래 상자 안의 글을 **통째로** 복사해서 Codex에 붙여 넣어요.

---

```
너는 지금부터 「역사 웹앱 워크숍 학습지」 작업을 이어받아 Firebase 배포를 끝내는 역할이야.
나는 역사 교사이고 터미널을 처음 써 봐. 내가 직접 해야 하는 일은 아주 쉽게, 한 단계씩, 어디를 누르는지까지 알려 줘.
대답은 자연스러운 한국어로 하고, 줄표(—)는 쓰지 마.

[저장소]
- GitHub: DONGSSAM-CLASS/dongssam-s-vibecoding
- 브랜치: claude/nifty-brown-q0knfv (main보다 커밋이 더 있음)
- 작업 폴더: history-worksheet/
- 먼저 history-worksheet/HANDOFF.md 를 끝까지 읽고 지금 상태와 지켜야 할 원칙을 파악해. 배포 안내는 DEPLOY.md에 있어.

[목표]
Firebase 프로젝트 vibecoding-dongssam(소유 계정 dongssamplay@gmail.com)에 학습지와 보안 규칙을 배포하고,
https://vibecoding-dongssam.web.app 과 /admin.html 이 실제로 작동하는 것까지 확인한 뒤, 바뀐 파일을 커밋하고 main으로 PR을 열어.

[순서]
1. 저장소를 받아(없으면 clone) claude/nifty-brown-q0knfv 브랜치로 바꾸고, history-worksheet 폴더에서 작업해.
2. node, npm, firebase CLI가 있는지 확인해. 없으면 설치를 도와줘(Node.js LTS는 내가 nodejs.org에서 설치해야 하면 그렇게 안내해 줘. firebase CLI는 npm install -g firebase-tools).
3. firebase login 을 실행해. 브라우저가 열리면 내가 dongssamplay@gmail.com으로 로그인할 거야. 로그인한 계정을 확인해 줘.
4. firebase projects:list 로 프로젝트 ID가 정확히 vibecoding-dongssam 인지 확인해. 다르면 .firebaserc 와 DEPLOY.md, HANDOFF.md의 주소를 실제 ID로 고쳐.
5. Firestore 데이터베이스가 있는지 확인하고(firebase firestore:databases:list), 없으면 asia-northeast3 에 (default) 데이터베이스를 만들어.
6. 웹 앱이 있는지 확인하고(firebase apps:list WEB), 없으면 firebase apps:create WEB worksheet 로 만들어. 그다음 firebase apps:sdkconfig WEB <앱ID> 로 설정값을 받아서
   history-worksheet/firebase-config.js 의 window.WS_FIREBASE = null; 을 그 값(apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)으로 바꿔. WS_ADMINS와 에뮬레이터 분기는 그대로 둬.
7. Authentication의 익명 로그인과 Google 로그인은 콘솔에서만 켤 수 있어. 나에게 정확히 이렇게 안내해 줘:
   console.firebase.google.com → vibecoding-dongssam → 빌드 → Authentication → (처음이면 시작하기) → 로그인 방법 탭 →
   익명: 사용 설정 → 저장 / 새 제공업체 추가 → Google: 사용 설정, 지원 이메일 dongssamplay@gmail.com → 저장.
   내가 다 했다고 하면 다음으로 넘어가.
8. 배포 전에 테스트해: history-worksheet/tests 에서 npm install, npx playwright install chromium, npm test.
   보안 규칙 33개와 브라우저 테스트 39개가 모두 통과해야 해. Java 11 이상이 없으면 설치를 안내하거나, 정말 어려우면 테스트를 건너뛴 이유를 나에게 분명히 말하고 넘어가.
   테스트를 고치거나 끄거나 건너뛰는 방식으로 통과시키지 마.
9. history-worksheet 폴더에서 firebase deploy 를 실행해(hosting과 firestore 규칙이 함께 올라가). 끝에 나온 Hosting URL을 알려 줘.
10. 확인:
   - https://vibecoding-dongssam.web.app/ 와 /admin.html, /firebase-config.js 가 200으로 열리는지 확인해.
   - 나에게 이렇게 해 보라고 안내해 줘: admin.html에서 dongssamplay@gmail.com으로 로그인 → 새 수업방 만들기 → 휴대전화로 QR을 찍어 이름을 넣고 입장 → 진행자 화면 진행표에 이름이 뜨는지 확인.
   - 진행자 로그인에서 오류(auth/unauthorized-domain 등)가 나면 Authentication → 설정 → 승인된 도메인에 vibecoding-dongssam.web.app 과 vibecoding-dongssam.firebaseapp.com 이 있는지 확인하게 해 줘.
11. 바뀐 파일(firebase-config.js, 필요하면 .firebaserc와 문서)을 커밋해서 claude/nifty-brown-q0knfv 에 푸시하고, main으로 PR을 열어. PR 설명에는 배포한 주소와 확인한 내용을 적어.
   HANDOFF.md의 「저장소 상태」 표도 배포 완료로 고쳐 줘.

[지켜야 할 것]
- 토큰, 비밀번호, 서비스 계정 키는 저장소에 커밋하지 말고, 나에게 채팅으로 보내 달라고 하지도 마. (Firebase 웹 설정값 apiKey 등은 공개해도 되는 값이라 커밋해도 괜찮아.)
- 디자인은 푸른 계열만, 문장은 자연스러운 우리말로, 줄표(—)는 쓰지 마. 이미 끝난 기능은 바꾸지 마.
- 진행자 이메일은 dongssamplay@gmail.com 하나야. 바꿔야 하면 firestore.rules의 isAdmin()과 firebase-config.js의 WS_ADMINS를 함께 고쳐.
- 무엇을 하기 전에 한 줄로 무엇을 하는지 말해 주고, 내가 해야 할 일이 생기면 거기서 멈추고 기다려.
- 오류가 나면 오류 문장을 그대로 보여 주고, 원인과 해결 방법을 쉽게 설명해 줘.
```
