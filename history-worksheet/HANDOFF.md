# 인수인계: 역사 웹앱 워크숍 학습지

작성: 2026-10-18 · 요청자: 동쌤(김동은 선생님, GitHub `DONGSSAM-CLASS`)
다음 작업자(Codex 등)가 이 문서 하나로 이어서 작업할 수 있게 정리했습니다.

## 1. 한 줄 요약

바이브코딩 역사수업 연수용 **인터랙티브 학습지(연수생 모드)**와 **진행자 화면(관리자 모드)**을 Firebase 프로젝트 `vibecoding-dongssam`에 배포했습니다. 실제 진행자 Google 로그인과 휴대전화 QR 입장 확인이 남아 있습니다.

## 2. 저장소 상태

| 항목 | 상태 |
|---|---|
| 저장소 | `DONGSSAM-CLASS/dongssam-s-vibecoding` |
| 작업 폴더 | `history-worksheet/` |
| PR | [#18](https://github.com/DONGSSAM-CLASS/dongssam-s-vibecoding/pull/18) **병합 완료** (`main`의 `4ece247`) |
| 작업 브랜치 | `claude/nifty-brown-q0knfv`. `main`보다 커밋이 더 있어요(`.firebaserc` 추가, `DEPLOY.md`에 실제 주소 반영, 이 인수인계 문서들). 아직 `main`에 없으니 배포 후 PR로 합쳐 주세요. |
| 배포 | **완료(2026-10-18).** 학습지, `/admin.html`, `/firebase-config.js`가 HTTP 200으로 열리고 Firestore 규칙도 반영됐어요. |
| Firebase 설정 | 새 프로젝트의 웹 앱 설정값 입력 완료. 익명·Google 로그인 사용 설정 완료, Firestore 위치는 `asia-northeast3`예요. |

> 선생님 컴퓨터의 dongssamplay@gmail.com 로그인으로 새 프로젝트를 만들고 배포했습니다. 배포 설정을 넣기 전에 보안 규칙 33개와 브라우저 테스트 39개를 모두 다시 통과했습니다. 내장 브라우저의 진행자 Google 로그인 팝업은 완료되지 않아 실제 진행자 로그인과 휴대전화 QR 입장은 추가 확인이 필요합니다.

## 3. 무엇을 만들었나

원본은 황금보라 선생님의 학습지(`bora-lessons.web.app/suup/hist/worksheet.html`)입니다. 이를 **푸른 계열 색만 쓰는 청사진 테마**로 새로 만들고, 동쌤의 작품과 기능으로 바꿨습니다.

### 학습지 1~11쪽 (`index.html`)

| 쪽 | 내용 |
|---|---|
| 1·4·5쪽 | 생각 나누기. 고르기 칩과 쓰기 칸, [이 쪽 답 복사] |
| 2쪽 | 동쌤 웹앱 16편. 썸네일은 실제 첫 화면을 찍은 `shots/*.jpg`예요(동쌤 홈페이지 `dongssam-home-20260914.web.app`의 `projects.js` 기준). |
| 3쪽 | 체험 게임 세 가지: 임시정부 12분 체험판(`dongssam-history-12m-20261018.web.app`), History Globe, 역사 레이싱 |
| 6쪽 | 프롬프트 만들기. 웹앱 종류 12가지 × 기초/심화(`promptkit.js`) |
| 7쪽 | 배포 따라 하기. Netlify Drop과 Firebase Hosting 두 탭 |
| 8~9쪽 | 작품 카드와 갤러리, 좋아요 |
| 10쪽 | 쉬운 퀴즈 6문제. 정답 번호: 2, 1, 3, 4, 1, 2 |
| 11쪽 | 별점 설문 |

**공통 기능:** 한 칸씩 보기, 타이머, QR, 밝은 화면과 어두운 화면

### 수업방 (`live.js`, Firebase 설정이 있을 때만 켜짐)

- **연수생:** 익명 로그인으로 들어오고, 수업방 번호 4자리와 이름을 넣습니다. 진행자 화면의 QR 주소는 `index.html?room=1234` 형식이에요.
- **실시간으로 보내는 것:** 지금 보는 쪽, 본 쪽, 답, 배포 단계, 퀴즈 점수, 작품
- **설문:** 이름 없이 따로 모입니다.
- **작품 갤러리와 좋아요:** 같은 수업방 사람이 모두 함께 봅니다.
- **진행자가 쪽을 열면:** 연수생 화면이 따라 넘어갑니다. 최근 20초 안에 학습지에 글을 쓴 사람은 끌려가지 않고, [진행자가 연 쪽으로] 단추만 뜹니다.
- **진행자 타이머:** 연수생 화면에도 함께 표시됩니다.

### 진행자 화면 (`admin.html`, `admin.js`)

- **들어갈 수 있는 계정:** `dongssamplay@gmail.com` 구글 계정만
- **수업방:** 만들기, 연수생용 QR과 주소, 새로 들어오기 막기
- **요약:** 숫자 타일 5개와 쪽별 인원 막대그래프
- **진행표:** 사람별로 보여 주고, 누르면 그 사람의 답 전체가 열려요. 참가자 지우기도 여기서 해요.
- **보기 탭:** 답 모아 보기(고르기 문항은 막대그래프, 글은 카드), 작품, 설문
- **모두에게:** 쪽 열기와 타이머
- **진행표 복사:** 스프레드시트에 바로 붙여 넣을 수 있는 TSV 형식

## 4. 파일 구조

```
history-worksheet/
├─ index.html          학습지 마크업(문구는 여기)
├─ worksheet.css       공통 디자인(색 토큰, 밝은/어두운 화면). admin.html도 씀
├─ worksheet.js        학습지 동작. window.WS 로 live.js에 갈고리 제공
├─ promptkit.js        6쪽 프롬프트 재료(KINDS, STYLES, FIXES, build)
├─ live.js             수업방 연결(Firebase compat SDK 10.14.1을 gstatic에서 동적으로 불러옴)
├─ admin.html/.js      진행자 화면
├─ firebase-config.js  ★ 배포 때 웹 앱 설정값을 넣을 곳 + 진행자 이메일(WS_ADMINS)
├─ firestore.rules     보안 규칙(진행자 이메일이 isAdmin()에 하드코딩)
├─ firebase.json       hosting public "." (tests/, *.md, *.log 등은 제외), firestore rules, 에뮬레이터 포트
├─ .firebaserc         기본 프로젝트 vibecoding-dongssam
├─ shots/              썸네일 17장(640×400 JPEG)
├─ DEPLOY.md           선생님용 배포 안내
├─ HANDOFF.md          이 문서
├─ CODEX_PROMPT.md     Codex에 붙여 넣을 배포 이어하기 프롬프트
└─ tests/              보안 규칙 테스트 + Playwright 브라우저 테스트
```

## 5. Firestore 구조와 보안 규칙

```
rooms/{4자리}                 title, ownerUid, ownerEmail, createdAt, open, step{id, at(ms)}, timerEnd(ms)
rooms/{4자리}/people/{uid}    name, joinedAt, updatedAt, stepIndex, stepId, stepTitle, seen[], answers{}, deploy{tab, netlify{done,total}, firebase{done,total}}, quiz{done,right,total}, surveyDone, work{name,url}
rooms/{4자리}/works/{uid}     name, maker, url, desc, shot(dataURL), updatedAt   (한 사람에 하나)
rooms/{4자리}/likes/{uid}     ids[]
rooms/{4자리}/survey/{uid}    star(0~5), s2, s3, updatedAt   (이름 없음)
```

- **수업방:** 진행자만 만들고 고칩니다. 로그인한 사람(익명 포함)은 읽을 수 있어요.
- **people:** 본인과 진행자만 읽습니다. 본인만 쓸 수 있고, 칸 이름과 글자 수를 검사합니다.
- **works·likes:** 로그인한 사람은 누구나 읽습니다. 본인만 쓸 수 있고, 작품 주소는 http(s)만 허용합니다.
- **survey:** 진행자만 읽고, 본인만 씁니다.
- **닫힌 수업방(`open:false`):** 새로 들어오는 사람(문서 create)을 막습니다.
- **진행자 이메일을 바꿀 때는** 두 곳을 함께 고쳐야 해요.
  - `firestore.rules`의 `isAdmin()`
  - `firebase-config.js`의 `WS_ADMINS`

## 6. 테스트

```
cd history-worksheet/tests
npm install
npx playwright install chromium   # 처음 한 번(Playwright 1.56.1로 고정되어 있음)
npm test                          # Firebase 에뮬레이터(auth, firestore)를 켜고 두 테스트를 돌림. Java 11+ 필요
```

- **마지막 결과:** 보안 규칙 33/33, 브라우저 39/39 통과(2026-10-18). PR CI도 모두 초록.
- **브라우저 테스트가 확인하는 것:**
  - 이 기기 모드 전체
  - 진행자 1명과 연수생 3명이 동시에 쓰는 수업방 흐름
  - 콘솔 오류
  - 390px 가로 넘침
  - 화면 글에 줄표(—)가 없는지
- **에뮬레이터 모드:** localhost 주소에 `?emu`를 붙이면 에뮬레이터 모드가 돼요. 이때 진행자 화면에 [테스트 진행자로 로그인] 단추가 나와요.
- **화면 사진:** 테스트가 `tests/shots-out/`에 남겨요(git에서는 무시돼요).

## 7. 지켜야 할 원칙(선생님 요청)

- **색:** 푸른 계열만 써요. 색은 모두 `worksheet.css`의 `:root` 토큰으로 정의하고, 어두운 화면용 값도 따로 있어요.
- **문장:** 번역체 없이 자연스러운 우리말로 써요. **줄표(—)는 쓰지 않아요.** 테스트가 검사합니다.
- **퀴즈:** 쉬운 수준을 유지해요.
- **사용자:** 터미널을 처음 쓰는 선생님이에요. 안내는 단계별로 아주 쉽게 해 주세요.
- **비밀값:** 토큰, 비밀번호, 서비스 계정 키는 저장소에 올리지 말고, 채팅으로도 받지 마세요. Firebase 웹 설정값(apiKey 등)은 공개해도 되는 값이라 `firebase-config.js`에 커밋해도 됩니다.

## 8. 배포 결과와 남은 확인

1. **완료:** `dongssamplay@gmail.com` 계정으로 새 프로젝트 `vibecoding-dongssam` 생성, 서울 지역 기본 Firestore 생성, `worksheet` 웹 앱 등록, 공개 설정값 입력, 익명·Google 로그인 활성화.
2. **테스트:** 배포 설정 입력 전 기존 소스에서 `npm test` 실행, 보안 규칙 33개와 브라우저 39개 통과. 테스트 파일은 변경하지 않았어요.
3. **배포:** Hosting과 Firestore 규칙 배포 완료. 규칙 파일의 컴파일과 실제 반영도 확인했어요.
4. **주소 확인:** `https://vibecoding-dongssam.web.app/`, `/admin.html`, `/firebase-config.js` 모두 HTTP 200. 실제 학습지에서 수업방 메뉴도 표시돼요. 운영 Firebase SDK로 익명 로그인과 Firestore 수업방 읽기도 성공했고 검사에 쓴 임시 계정은 삭제했어요.
5. **남은 수동 확인:** 일반 브라우저에서 `/admin.html` 진행자 로그인 → 수업방 만들기 → 휴대전화 QR 입장 → 진행표에 이름이 뜨는지 확인해 주세요. 내장 브라우저에서는 Google 로그인 팝업이 완료되지 않았어요.
6. **저장소:** 배포 설정과 이 기록을 작업 브랜치에 커밋하고 `main`으로 PR을 열어요.

## 9. 참고

- **미리보기:** 이전 작업자가 만든 Claude 아티팩트(이 기기 모드만): https://claude.ai/artifact/3568fwhgw3izUz9XwU856x (선생님 계정 전용)
- **썸네일을 다시 찍을 때:** Playwright로 각 앱을 1280×800으로 열고 6초 기다려 캡처한 뒤 640×400 JPEG(품질 74)로 줄였어요. 파일 이름은 `index.html`의 `src="shots/…"`와 같아야 해요.
- **썸네일을 못 불러올 때:** 글자 타일이 대신 보여요.
