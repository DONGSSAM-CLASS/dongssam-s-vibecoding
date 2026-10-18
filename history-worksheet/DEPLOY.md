# 학습지 배포하기 (Firebase)

2026-10-18 배포 완료. `dongssamplay@gmail.com` 계정에 `vibecoding-dongssam` 프로젝트와 웹 앱을 만들고 서울(`asia-northeast3`) Firestore를 준비했습니다. 익명·Google 로그인을 켜고 Hosting과 Firestore 규칙을 배포했습니다. 아래 두 화면과 `/firebase-config.js`의 HTTP 200 응답을 확인했습니다. 실제 진행자 로그인과 휴대전화 QR 입장은 추가 확인이 필요합니다.

학습지는 Firebase 설정이 없어도 각자의 기기 안에서 작동해요. 진행자 화면과 수업방을 쓰려면 Firebase에 올려야 해요.

| 화면 | 주소 | 누가 쓰나요 |
|---|---|---|
| 학습지 | `https://vibecoding-dongssam.web.app/` | 연수생. 진행자 화면의 QR로 들어오면 수업방에 바로 들어가요. |
| 진행자 화면 | `https://vibecoding-dongssam.web.app/admin.html` | `dongssamplay@gmail.com` 구글 계정만 들어갈 수 있어요. |

## 1. Firebase 콘솔에서 준비하기 (dongssamplay@gmail.com 계정으로, 처음 한 번)

1. [Firebase 콘솔](https://console.firebase.google.com/)에서 **프로젝트 만들기**. 프로젝트 이름은 `vibecoding-dongssam`이에요(`.firebaserc`에 이미 적혀 있어요). Gemini와 애널리틱스는 꺼도 돼요.
2. 왼쪽 메뉴 **빌드 → Authentication → 시작하기**를 누르고, **로그인 방법** 탭에서 두 가지를 켜요.
   - **익명**: 사용 설정 (연수생은 로그인 없이 들어와요)
   - **Google**: 사용 설정, 지원 이메일은 dongssamplay@gmail.com (진행자 로그인)
3. **빌드 → Firestore Database → 데이터베이스 만들기**. 위치는 `asia-northeast3 (서울)`, **프로덕션 모드**로 시작해요. 보안 규칙은 배포할 때 이 폴더의 `firestore.rules`로 바뀌어요.
4. **프로젝트 설정(톱니바퀴) → 일반 → 내 앱 → 웹(</>)**을 눌러 앱을 등록해요(호스팅 설정 체크는 안 해도 돼요). 화면에 나오는 `firebaseConfig` 값이 필요해요.

## 2. 올리기

### 방법 A. 직접 올리기

1. `firebase-config.js`의 `window.WS_FIREBASE = null;`을 콘솔에서 받은 값으로 바꿔요.
   ```js
   window.WS_FIREBASE = { apiKey: '…', authDomain: '…', projectId: '…', appId: '…' };
   ```
2. 이 폴더(`history-worksheet`)에서 명령 창을 열고:
   ```
   npm install -g firebase-tools
   firebase login
   firebase deploy
   ```
   학습지와 보안 규칙(`firestore.rules`)이 한 번에 올라가요.

### 방법 B. Claude에게 맡기기

Claude Code 클라우드 세션은 선생님 구글 계정에 직접 로그인할 수 없어서, 배포용 토큰이 필요해요.

1. 선생님 컴퓨터에서 `npx firebase-tools login:ci`를 실행하고 dongssamplay@gmail.com으로 로그인해요. 마지막에 토큰이 한 줄 나와요.
2. 이 토큰을 **채팅에 붙여 넣지 말고**, Claude Code 환경 설정(세션 제목 옆 환경 메뉴 → 편집)의 환경 변수에 `FIREBASE_TOKEN`이라는 이름으로 넣어요.
3. 새 세션을 열고 "학습지를 Firebase에 배포해 줘"라고 하면, 웹 앱 등록, 설정값 채우기, 배포, 실제 주소 확인까지 진행해요.
   위 1단계(프로젝트, Authentication, Firestore 켜기)는 콘솔에서 먼저 해 두세요.

배포가 끝나면 토큰은 `firebase logout --token 토큰`으로 언제든 끊을 수 있어요.

## 진행자 계정을 바꾸거나 더하려면

두 곳을 똑같이 고친 뒤 다시 배포해요.

- `firestore.rules`의 `isAdmin()` 안 이메일 목록
- `firebase-config.js`의 `window.WS_ADMINS`

## 배포 전에 테스트하기

`tests` 폴더에서 `npm install` 한 번, 그다음 `npm test`. Firebase 에뮬레이터를 켜고 보안 규칙 33가지와 브라우저 동작 39가지(진행자 1명과 연수생 3명이 동시에 쓰는 경우 포함)를 확인해요. Java 11 이상이 필요해요.
